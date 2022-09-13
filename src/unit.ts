import { ReadBuffer, ReadError, WriteBuffer } from "./buffer.js";
import { TypeClass } from "./types.js";

export const Unit: TypeClass<undefined> = {
  read(buffer: ReadBuffer) {
    buffer.pushReadBoundary();
    const value = buffer.readUint8();
    if (value) {
      throw new ReadError(
        buffer,
        `expected 0x00, read 0x${value.toString(16)}`
      );
    }
    buffer.popReadBoundary();
    return undefined;
  },

  prepare() {
    return { size: 1, context: undefined };
  },

  write(buffer: WriteBuffer) {
    buffer.writeUint8(0);
  },
};
