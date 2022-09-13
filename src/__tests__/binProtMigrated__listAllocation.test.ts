// adapted from https://github.com/janestreet/bin_prot/blob/master/test/list_allocation.ml
// note that we only assert the shapes, but NOT the fact that the functions do not allocate

import { expect, test } from "@jest/globals";
import { WriteBuffer } from "../buffer.js";
import { Int } from "../int.js";
import { List } from "../list.js";
import { String } from "../string.js";
import { TypeClass } from "../types.js";

const buf = new ArrayBuffer(10000);

function runTest<T extends unknown[], U>(typeClass: TypeClass<T, U>, array: T) {
  let result = "\n";
  const { size, context } = typeClass.prepare(array);
  result += `size: ${size}\n`;

  const buffer = new WriteBuffer(buf);
  typeClass.write(buffer, context);

  result += `pos after writing: ${buffer.currentPosition()}\n`;

  return result;
}

test("bin_prot: list allocation sizes only", () => {
  expect(runTest(List(Int), [1, 2, 3, 4, 5])).toMatchInlineSnapshot(`
    "
    size: 6
    pos after writing: 6
    "
  `);

  expect(runTest(List(String), ["one", "two", "three", "four"]))
    .toMatchInlineSnapshot(`
    "
    size: 20
    pos after writing: 20
    "
  `);
});
