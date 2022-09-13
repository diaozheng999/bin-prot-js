import { ReadBuffer, ReadError, WriteBuffer } from "./buffer.js";
import { Typedef } from "./types.js";

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
      return buffer.readUint64();
    default:
      return value;
  }
}

export function sizeNat0(number: number | bigint) {
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

export function writeNat0(buffer: WriteBuffer, number: number | bigint) {
  if (number < 0x80) {
    buffer.writeUint8(Number(number));
  } else if (number < 0x10000) {
    buffer.writeUint8(CODE_INT16);
    buffer.writeUint16(Number(number));
  } else if (number < 0x100000000) {
    buffer.writeUint8(CODE_INT32);
    buffer.writeUint32(Number(number));
  } else {
    buffer.writeUint8(CODE_INT64);
    buffer.writeUint64(BigInt(number));
  }
}

export const Nat0: Typedef<number> = {
  read(buffer) {
    buffer.pushReadBoundary();
    const n = readNat0(buffer);
    if (typeof n === "bigint") {
      if (n > BigInt(Number.MAX_SAFE_INTEGER)) {
        throw new ReadError(buffer, `Value is too large: ${n}`);
      }
      return Number(n);
    }
    return n;
  },
  write: writeNat0,
  prepare(context) {
    const size = sizeNat0(context);
    return { size, context };
  },
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Nat0_64: Typedef<number | bigint> = {
  read: readNat0,
  write: writeNat0,
  prepare(context) {
    const size = sizeNat0(context);
    return { size, context };
  },
};
