import { expect, test } from "@jest/globals";

import { runTests } from "./binProtMigrated__integersRepr.inc.js";

test("bin_prot: 64 bit integer tests", () => {
  expect(
    runTests({
      int: [-4611686018427387904n, 4611686018427387903n],
      int32bit: [-2147483648, 2147483647],
      int64bit: [-4611686018427387904n, 4611686018427387903n],
    })
  ).toMatchSnapshot();
});
