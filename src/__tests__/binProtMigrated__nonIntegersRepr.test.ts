import { expect, test } from "@jest/globals";
import { Bool } from "../bool.js";
import { ReadBuffer, WriteBuffer } from "../buffer.js";
import { Char } from "../char.js";
import { Float } from "../float.js";
import { MD5, MD5String } from "../md5.js";
import { TypeClass } from "../types.js";
import { Unit } from "../unit.js";

interface ToTest<T, U> {
  def: TypeClass<T, U>;
  values: T[];
  equal: (a: T, b: T) => boolean;
  serialize: (a: T) => string;
  hiBound?: number;
  loBound: number;
}

const buf = new ArrayBuffer(1024);

function genTests<T, U>(t: ToTest<T, U>) {
  const testOutput: string[] = [];

  const binProttedValues = t.values.map((value) => {
    const buffer = new WriteBuffer(buf);
    const { context } = t.def.prepare(value);
    t.def.write(buffer, context);
    return buffer.copy();
  });

  const hexSize = binProttedValues.reduce(
    (acc, buf) => Math.max(acc, buf.currentPosition()),
    0
  );

  let min = Infinity;
  let max = 0;

  for (let i = 0; i < t.values.length; ++i) {
    let output = "";
    const s = binProttedValues[i];
    const v = t.values[i];
    const len = s.currentPosition();
    output += `${s.hexdump(hexSize)} -> ${t.serialize(v)}`;

    const readBuffer = new ReadBuffer(s.sub().buffer);
    const received = t.def.read(readBuffer);

    const receivedLen = readBuffer.currentPosition();

    const hiBound = t.hiBound ?? Infinity;
    if (len < t.loBound || len > hiBound) {
      output += `bin_size outside of range ${t.loBound}..${hiBound}: ${len}`;
    }
    if (!t.equal(v, received) || len !== receivedLen) {
      output += `, read test failed: read ${receivedLen} byte${
        receivedLen === 1 ? "" : "s"
      } as ${t.serialize(received)}`;
    }
    output += "\n";
    testOutput.push(output);
    min = Math.min(min, len);
    max = Math.max(max, len);
  }

  if (t.hiBound !== undefined) {
    if (min !== t.loBound) {
      testOutput.push(`invalid lower bound: ${min}, expected: ${t.loBound}\n`);
    }
  } else if (min !== t.loBound || max !== t.hiBound) {
    testOutput.push(
      `invalid bounds: ${min}..${max}, expected: ${t.loBound}..${t.hiBound}\n`
    );
  }

  return "\n" + testOutput.join("");
}

test("bin_prot: unit", () => {
  expect(
    genTests({
      def: Unit,
      values: [undefined],
      equal: Object.is,
      serialize: () => `()`,
      hiBound: 1,
      loBound: 1,
    })
  ).toMatchInlineSnapshot(`
    "
    00 -> ()
    "
  `);
});

test("bin_prot: bool", () => {
  expect(
    genTests({
      def: Bool,
      values: [true, false],
      equal: Object.is,
      serialize: (a) => `${a}`,
      hiBound: 1,
      loBound: 1,
    })
  ).toMatchInlineSnapshot(`
    "
    01 -> true
    00 -> false
    "
  `);
});

test("bin_prot: char", () => {
  expect(
    genTests({
      def: Char,
      values: ["\x00", "A", "z", ";", "\xFF"],
      equal: Object.is,
      serialize: (a) => JSON.stringify(a),
      hiBound: 1,
      loBound: 1,
    })
  ).toMatchInlineSnapshot(`
    "
    00 -> "\\u0000"
    41 -> "A"
    7a -> "z"
    3b -> ";"
    ff -> "ÿ"
    "
  `);
});

test("bin_prot: digest", () => {
  expect(
    genTests({
      def: MD5.default,
      values: [
        new MD5String([
          0x01, 0x23, 0x45, 0x67, 0x89, 0xab, 0xcd, 0xef, 0x01, 0x23, 0x45,
          0x67, 0x89, 0xab, 0xcd, 0xef,
        ]),
      ],

      equal: MD5String.equal,
      hiBound: 16,
      loBound: 16,
      serialize: (a) => a.toString(),
    })
  ).toMatchInlineSnapshot(`
    "
    ef cd ab 89 67 45 23 01 ef cd ab 89 67 45 23 01 -> 0123456789abcdef0123456789abcdef
    "
  `);
});

test("bin_prot: float", () => {
  expect(
    genTests({
      def: Float,
      values: [
        Number.EPSILON,
        Infinity,
        Number.MAX_VALUE,
        2.2250738585072014e-308,
        Number.MIN_VALUE,
        -1,
        -Infinity,
        1,
        1e-7,
        0,
        NaN,
      ],

      equal: (a, b) => {
        if (isNaN(a) || isNaN(b)) {
          return isNaN(a) && isNaN(b);
        }
        return a === b;
      },
      serialize: (v) => v.toString(),
      hiBound: 8,
      loBound: 8,
    })
  ).toMatchInlineSnapshot(`
    "
    3c b0 00 00 00 00 00 00 -> 2.220446049250313e-16
    7f f0 00 00 00 00 00 00 -> Infinity
    7f ef ff ff ff ff ff ff -> 1.7976931348623157e+308
    00 10 00 00 00 00 00 00 -> 2.2250738585072014e-308
    00 00 00 00 00 00 00 01 -> 5e-324
    bf f0 00 00 00 00 00 00 -> -1
    ff f0 00 00 00 00 00 00 -> -Infinity
    3f f0 00 00 00 00 00 00 -> 1
    3e 7a d7 f2 9a bc af 48 -> 1e-7
    00 00 00 00 00 00 00 00 -> 0
    7f f8 00 00 00 00 00 00 -> NaN
    "
  `);
});
