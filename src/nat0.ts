import { ReadBuffer, WriteBuffer } from "./buffer";
import { Typedef } from "./types";

export const CODE_NEG_INT8 = 0xff;
export const CODE_INT16 = 0xfe;
export const CODE_INT32 = 0xfd;
export const CODE_INT64 = 0xfc;

export function readNat0(buffer: ReadBuffer) {
  const value = buffer.readUint8();
  switch (value) {
    case CODE_INT16:
      return buffer.readUint16();
    case CODE_INT32:
      return buffer.readUint32();
    case CODE_INT64:
      const int = buffer.readUint64();
      return +int.toString(10);
    default:
      return value;
  }
}

export function sizeNat0(number: number) {
  if (number < 0x80) {
    return 1;
  }
  if (number < 0x10000) {
    return 3;
  }
  if (number < 0x100000000) {
    return 5;
  }
  return 9;
}

export function writeNat0(buffer: WriteBuffer, number: number) {
  if (number < 0x80) {
    buffer.writeUint8(number);
  } else if (number < 0x10000) {
    buffer.writeUint8(CODE_INT16);
    buffer.writeUint16(number);
  } else if (number < 0x100000000) {
    buffer.writeUint8(CODE_INT32);
    buffer.writeUint32(number);
  } else {
    buffer.writeUint8(CODE_INT64);
  }
}

export const Nat0: Typedef<number> = {
  read: readNat0,
  write: writeNat0,
  prepare(context) {
    const size = sizeNat0(context);
    return { size, context };
  },
};
