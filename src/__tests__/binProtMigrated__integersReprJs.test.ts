import { expect, test } from "@jest/globals";

import { runTests } from "./binProtMigrated__integersRepr.inc.js";

test("bin_prot: javascript integer tests", () => {
  expect(
    runTests({
      int: [-2147483648, 2147483647],
      int32bit: [-1073741824, 1073741823],
      int64bit: [-1073741824n, 1073741823n],
    })
  ).toMatchSnapshot();
});
