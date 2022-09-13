import { expect, test } from "@jest/globals";

import { ReadBuffer, WriteBuffer } from "../buffer.js";
import { Int } from "../int.js";
import { Typedef } from "../types.js";

const testWindowLen = 16n;

export interface ToTest<T> {
  name: string;
  def: Typedef<T, unknown>;
  toInt64: (value: T) => bigint;
  ofInt64: (value: bigint) => T;
  min: T;
  max: T;
  hiBound: number;
  loBound: number;
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
  } else if (sizeM < size) {
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
    for (let i = a; i < b; ++i) {
      acc.add(i);
    }
  }

  return acc;
}

function genTests<T>(t: ToTest<T>) {
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
  ).sort();

  const results: string[] = [];

  const [min, max] = points.reduce(
    ([min, max], n) => {
      let output = "";

      const { context } = t.def.prepare(t.ofInt64(n));
      const buf = new WriteBuffer(buffer, true);
      const len = buf.currentPosition();
      t.def.write(buf, context);
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

test("bin_prot", () => {
  const test: ToTest<number> = {
    name: "int",
    def: Int,
    toInt64: (n) => BigInt(n),
    ofInt64: (n) => Number(n),
    min: -2147482648,
    max: 2147483647,
    hiBound: 9,
    loBound: 1,
  };

  expect(genTests(test)).toMatchSnapshot();
});
