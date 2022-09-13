import { ReadBuffer, ReadError, WriteBuffer } from "./buffer.js";
import { TypeClass } from "./types.js";

export const Bool: TypeClass<boolean> = {
  read(buffer: ReadBuffer) {
    buffer.pushReadBoundary();
    const value = buffer.readUint8();
    if (value !== 0 && value !== 1) {
      throw new ReadError(
        buffer,
        `expected 0x00 or 0x01, read 0x${value.toString(16)}`
      );
    }
    buffer.popReadBoundary();
    return !!value;
  },

  prepare(context: boolean) {
    return { size: 1, context };
  },

  write(buffer: WriteBuffer, value: boolean) {
    buffer.writeUint8(+value);
  },
};
