import { ReadBuffer, ReadError, WriteBuffer } from "./buffer.js";
import { TypeClass } from "./types.js";

export const CODE_NEG_INT8 = 0xff;
export const CODE_INT16 = 0xfe;
export const CODE_INT32 = 0xfd;
export const CODE_INT64 = 0xfc;

export function readNat0(buffer: ReadBuffer): number;
export function readNat0(buffer: ReadBuffer, useInt64: true): number | bigint;
export function readNat0(buffer: ReadBuffer, useInt64?: boolean) {
  const value = buffer.readUint8();
  switch (value) {
    case CODE_INT16:
      return buffer.readUint16();
    case CODE_INT32:
      return buffer.readUint32();
    case CODE_INT64:
      buffer.pushReadBoundary();
      const n = buffer.readUint64();
      if (n > BigInt(Number.MAX_SAFE_INTEGER)) {
        if (useInt64) {
          return n;
        } else {
          throw new ReadError(buffer, `Value is too large: ${n}`);
        }
      }
      return Number(n);
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

export const Nat0: TypeClass<number> = {
  read(buffer) {
    return readNat0(buffer);
  },
  write: writeNat0,
  prepare(context) {
    const size = sizeNat0(context);
    return { size, context };
  },
};

// eslint-disable-next-line @typescript-eslint/naming-convention
export const Nat0_64: TypeClass<number | bigint> = {
  read(buffer) {
    return readNat0(buffer, true);
  },
  write: writeNat0,
  prepare(context) {
    const size = sizeNat0(context);
    return { size, context };
  },
};
