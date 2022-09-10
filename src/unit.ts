import { ReadBuffer, ReadError, WriteBuffer } from "./buffer";
import { Typedef } from "./types";

export const Unit: Typedef<undefined> = {
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