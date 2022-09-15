import { ReadError } from "./buffer.js";
import { Int53Bit } from "./int.js";
import { TypeClass } from "./types.js";

export function Blob<T, U>(
  element: TypeClass<T, U>
): TypeClass<T, [bigint, U]> {
  return {
    read(buffer) {
      buffer.pushReadBoundary();
      const expectedSize = Int53Bit.read(buffer);
      const start = buffer.currentPosition();
      const result = element.read(buffer);
      const end = buffer.currentPosition();
      if (end - start !== expectedSize) {
        throw new ReadError(
          buffer,
          `Size declaration mismatch! declared ${expectedSize}, read ${
            end - start
          }`
        );
      }
      return result;
    },

    prepare(value) {
      const contents = element.prepare(value);
      const header = Int53Bit.prepare(contents.size);
      return {
        size: header.size + contents.size,
        context: [header.context, contents.context],
      };
    },

    write(buffer, [header, contents]) {
      Int53Bit.write(buffer, header);
      element.write(buffer, contents);
    },
  };
}
