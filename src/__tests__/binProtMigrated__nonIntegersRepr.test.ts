import { expect, test } from "@jest/globals";
import { Bool } from "../bool.js";
import { ReadBuffer, WriteBuffer } from "../buffer.js";
import { TypeClass } from "../types.js";
import { Unit } from "../unit.js";
import { Char } from "../char.js";

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
