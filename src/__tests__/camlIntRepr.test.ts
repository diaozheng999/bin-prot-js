import { expect, test } from "@jest/globals";

import { ReadBuffer, WriteBuffer } from "../buffer.js";
import {
  Int,
  Int16Bit,
  Int32Bit,
  Int64,
  Int64Bit,
  Network16,
  Network32,
  Network64,
  VariantInt,
} from "../int.js";
import { Nat0 } from "../nat0.js";
import { Typedef } from "../types.js";

const testWindowLen = 16n;

interface ToTestBase<T> {
  min: T;
  max: T;
  hiBound: number;
  loBound: number;
}

interface ToTest<T> extends ToTestBase<T> {
  name: string;
  def: Typedef<T, unknown>;
  toInt64: (value: T) => bigint;
  ofInt64: (value: bigint) => T;
}

let buffer = new ArrayBuffer(32);

function binProttedSizeOf<T>({ def, ofInt64 }: ToTest<T>, n: bigint) {
  const { context } = def.prepare(ofInt64(n));
  const buf = new WriteBuffer(buffer, true);
  def.write(buf, context);
  return buf.currentPosition();
}

function mean(a: bigint, b: bigint) {
  if (a < 0n === b < 0n) {
    return b + ((a - b) >> 1n);
  } else {
    return (a + b) >> 1n;
  }
}

function findSizeIncrease<T>(
  t: ToTest<T>,
  size: number,
  a: bigint,
  b: bigint
): bigint {
  expect(a).toBeLessThan(b);
  const m = mean(a, b);
  const n = m + 1n;
  expect(n).toBeLessThanOrEqual(b);
  const sizeM = binProttedSizeOf(t, m);
  const sizeN = binProttedSizeOf(t, n);
  expect(sizeM).toBeLessThanOrEqual(sizeN);
  if (sizeM === size && sizeM < sizeN) {
    return m;
  } else if (sizeM <= size) {
    return findSizeIncrease(t, size, m + 1n, b);
  } else {
    return findSizeIncrease(t, size, a, m);
  }
}

function findSizeDecrease<T>(
  t: ToTest<T>,
  size: number,
  a: bigint,
  b: bigint
): bigint {
  expect(a).toBeLessThan(b);
  const m = mean(a, b);
  const n = m + 1n;
  expect(n).toBeLessThanOrEqual(b);
  const sizeM = binProttedSizeOf(t, m);
  const sizeN = binProttedSizeOf(t, n);
  expect(sizeM).toBeGreaterThanOrEqual(sizeN);
  if (sizeM === size && sizeM > sizeN) {
    return m;
  } else if (sizeM >= size) {
    return findSizeDecrease(t, size, n, b);
  } else {
    return findSizeDecrease(t, size, a, m);
  }
}

function findSizeIncreasePoints<T>(
  t: ToTest<T>,
  size1: number,
  size2: number,
  a: bigint,
  b: bigint,
  acc: Set<bigint>
) {
  while (size1 !== size2) {
    const p = findSizeIncrease(t, size1, a, b);
    a = p + 1n;
    size1 = binProttedSizeOf(t, a);
    acc.add(p);
  }
}

function findSizeDecreasePoints<T>(
  t: ToTest<T>,
  size1: number,
  size2: number,
  a: bigint,
  b: bigint,
  acc: Set<bigint>
) {
  while (size1 !== size2) {
    const p = findSizeDecrease(t, size1, a, b);
    a = p + 1n;
    size1 = binProttedSizeOf(t, a);
    acc.add(p);
  }
}

function findInterestingPoints<T>(t: ToTest<T>) {
  const a = t.toInt64(t.min);
  const b = t.toInt64(t.max);
  const size0 = binProttedSizeOf(t, 0n);
  const acc = new Set([0n, a, b]);

  if (a < 0n) {
    findSizeDecreasePoints(t, binProttedSizeOf(t, a), size0, a, 0n, acc);
  }

  if (b > 0n) {
    findSizeIncreasePoints(t, size0, binProttedSizeOf(t, b), 0n, b, acc);
  }
  return acc;
}

function* powerOfTwos(filter: (n: bigint) => boolean) {
  for (let n = 0n; n < 64n; ++n) {
    const x = 1n << n;
    if (filter(x)) {
      yield x;
    }
    if (filter(-x)) {
      yield -x;
    }
  }
}

function validPowerOfTwos<T>(t: ToTest<T>) {
  const min = t.toInt64(t.min);
  const max = t.toInt64(t.max);
  return new Set(powerOfTwos((n) => n >= min && n <= max));
}

function addWindowAroundPoints<T>(t: ToTest<T>, points: Iterable<bigint>) {
  const min = t.toInt64(t.min);
  const max = t.toInt64(t.max);

  const acc = new Set<bigint>();

  for (const i of points) {
    const d = testWindowLen / 2n;
    const a = i <= min + d ? min : i - d;
    const b = i >= max - d ? max : i + d;
    for (let i = a; i <= b; ++i) {
      acc.add(i);
    }
  }

  return acc;
}

function genTests(t: ToTest<any>) {
  const points = Array.from(
    new Set(
      addWindowAroundPoints(
        t,
        (function* () {
          yield* findInterestingPoints(t);
          yield* validPowerOfTwos(t);
        })()
      )
    ).values()
  ).sort((a, b) => {
    if (a === b) {
      return 0;
    }
    if (a < b) {
      return -1;
    }
    return 1;
  });

  const results: string[] = [];

  const [min, max] = points.reduce(
    ([min, max], n) => {
      let output = "";

      const { context } = t.def.prepare(t.ofInt64(n));
      const buf = new WriteBuffer(buffer, true);
      t.def.write(buf, context);
      const len = buf.currentPosition();
      output += `${t.name}| ${buf.hexdump(9)} -> ${n}`;

      const readbuffer = new ReadBuffer(buffer);

      const received = t.toInt64(t.def.read(readbuffer));
      const receivedLen = readbuffer.currentPosition();
      if (len < t.loBound || len > t.hiBound) {
        output += `, bin_size outside of range ${t.loBound}..${t.hiBound}: ${len}`;
      }
      if (n !== received || receivedLen !== len) {
        output += `, read test failed: read ${receivedLen} byte${
          receivedLen === 1 ? "" : "s"
        } as ${received}`;
      }
      results.push(output + `\n`);
      return [Math.min(min, len), Math.max(max, len)];
    },
    [Infinity, 0]
  );
  if (min !== t.loBound || max !== t.hiBound) {
    results.push(
      `${t.name}| invalid bounds: ${min}..${max}, expected: ${t.loBound}..${t.hiBound}\n`
    );
  }

  return results.join("");
}

function num(
  name: string,
  def: Typedef<number, unknown>,
  base: ToTestBase<number>
): ToTest<number> {
  return {
    ...base,
    toInt64: (x) => BigInt(x),
    ofInt64: (x) => Number(x),
    name,
    def,
  };
}

function bint(
  name: string,
  def: Typedef<bigint, unknown>,
  base: ToTestBase<bigint>
): ToTest<bigint> {
  return {
    ...base,
    toInt64: (x) => x,
    ofInt64: (x) => x,
    name,
    def,
  };
}

test("bin_prot", () => {
  const tests = [
    num("int", Int, {
      min: -2147483648,
      max: 2147483647,
      loBound: 1,
      hiBound: 5,
    }),
    num("int32", Int, {
      min: -2147483648,
      max: 2147483647,
      loBound: 1,
      hiBound: 5,
    }),
    bint("int64", Int64, {
      min: -9223372036854775808n,
      max: 9223372036854775807n,
      loBound: 1,
      hiBound: 9,
    }),
    num("nat0", Nat0, {
      min: 0,
      max: 2147483647,
      loBound: 1,
      hiBound: 5,
    }),
    num("variant_int", VariantInt, {
      min: -(1 << 30),
      max: (1 << 30) - 1,
      hiBound: 4,
      loBound: 4,
    }),
    num("int_16bit", Int16Bit, {
      min: 0,
      max: (1 << 16) - 1,
      hiBound: 2,
      loBound: 2,
    }),
    num("int_32bit", Int32Bit, {
      min: -1073741824,
      max: 1073741823,
      hiBound: 4,
      loBound: 4,
    }),
    bint("int_64bit", Int64Bit, {
      min: -1073741824n,
      max: 1073741823n,
      loBound: 8,
      hiBound: 8,
    }),
    bint("int64_bits", Int64Bit, {
      min: -9223372036854775808n,
      max: 9223372036854775807n,
      loBound: 8,
      hiBound: 8,
    }),
    num("network16_int", Network16, {
      min: 0,
      max: (1 << 16) - 1,
      hiBound: 2,
      loBound: 2,
    }),
    num("network32_int", Network32, {
      min: -1073741824,
      max: 1073741823,
      hiBound: 4,
      loBound: 4,
    }),
    bint("network64_int", Network64, {
      min: -1073741824n,
      max: 1073741823n,
      loBound: 8,
      hiBound: 8,
    }),
    num("network32_int32", Network32, {
      min: -2147483648,
      max: 2147483647,
      hiBound: 4,
      loBound: 4,
    }),
    bint("network64_int64", Network64, {
      min: -9223372036854775808n,
      max: 9223372036854775807n,
      loBound: 8,
      hiBound: 8,
    }),
  ];

  const result = `
let%expect_test ("javascript integer tests" [@tags "js-only"]) =
  Integers_repr.run_tests ();
  [%expect
    {|
${tests.map(genTests).join("")}|}]
;;\n`;

  expect(result).toMatchSnapshot();
});
