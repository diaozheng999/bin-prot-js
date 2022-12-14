import { ReadBuffer, ReadError, WriteBuffer } from "./buffer.js";
import { CODE_INT16, CODE_INT32, CODE_INT64, CODE_NEG_INT8 } from "./nat0.js";
import { TypeClass } from "./types.js";

export type PreparedInt =
  | number
  | [typeof CODE_NEG_INT8, number]
  | [typeof CODE_INT16, number]
  | [typeof CODE_INT32, number]
  | [typeof CODE_INT64, bigint];

/**
 * Reads a variable-sized int from buffer. It is marked unsafe because it pushes
 * a read boundary but does not pop it.
 *
 * Consumers of this function should call `buffer.popReadBoundary()` before
 * returning.
 *
 * @param buffer the buffer to read from
 * @returns the number. If the number is larger than 32-bits, it will be
 * returned as BigInt, even though it can still be represented within
 * MAX_SAFE_INTEGER.
 */
export function unsafeReadInt(buffer: ReadBuffer) {
  const tag = buffer.readUint8();
  buffer.pushReadBoundary();
  switch (tag) {
    case CODE_INT64:
      return buffer.readInt64();
    case CODE_INT32:
      return buffer.readInt32();
    case CODE_INT16:
      return buffer.readInt16();
    case CODE_NEG_INT8:
      return buffer.readInt8();
    default:
      return tag;
  }
}

export function prepareInt(n: number | bigint): {
  size: number;
  context: PreparedInt;
} {
  if (n >= 0) {
    if (n < 0x80) {
      return { size: 1, context: Number(n) & 0xff };
    } else if (n < 0x8000) {
      return { size: 3, context: [CODE_INT16, Number(n) & 0xffff] };
    } else if (n <= 2147483647) {
      return { size: 5, context: [CODE_INT32, Number(n)] };
    } else {
      const bn = typeof n === "number" ? BigInt(n) : n;
      return { size: 9, context: [CODE_INT64, bn] };
    }
  } else {
    if (n >= -0x80) {
      return { size: 2, context: [CODE_NEG_INT8, Number(n) & 0xff] };
    } else if (n >= -0x8000) {
      return { size: 3, context: [CODE_INT16, Number(n) & 0xffff] };
    } else if (n >= -2147483648) {
      return { size: 5, context: [CODE_INT32, Number(n)] };
    } else {
      return { size: 9, context: [CODE_INT64, BigInt(n)] };
    }
  }
}

export function writeInt(buffer: WriteBuffer, ctx: PreparedInt) {
  if (typeof ctx === "number") {
    buffer.writeUint8(ctx);
    return;
  }
  buffer.writeUint8(ctx[0]);
  switch (ctx[0]) {
    case CODE_NEG_INT8:
      buffer.writeUint8(ctx[1]);
      break;
    case CODE_INT16:
      buffer.writeUint16(ctx[1]);
      break;
    case CODE_INT32:
      buffer.writeUint32(ctx[1]);
      break;
    case CODE_INT64:
      buffer.writeInt64(ctx[1]);
      break;
  }
}

/**
 * Integer using variable encoding. This will safely read up to 53-bits.
 */
export const Int: TypeClass<number, PreparedInt> = {
  read(buffer) {
    const result = unsafeReadInt(buffer);
    if (result >= Number.MAX_SAFE_INTEGER) {
      throw new ReadError(buffer, `Value too large. ${result}`);
    }
    buffer.popReadBoundary();
    return Number(result);
  },
  prepare: prepareInt,
  write: writeInt,
};

/**
 * Integer of up to 64 bits using variable encoding. Anything larger than
 * 32-bits will be returned as BigInt.
 */
export const VarInt64: TypeClass<number | bigint, PreparedInt> = {
  read(buffer) {
    const result = unsafeReadInt(buffer);
    buffer.popReadBoundary();
    return result;
  },
  prepare: prepareInt,
  write: writeInt,
};

/**
 * A 64-bit integer using variable encoding. This will always return
 * a bigint.
 */
export const Int64: TypeClass<bigint, PreparedInt> = {
  read(buffer) {
    const result = unsafeReadInt(buffer);
    buffer.popReadBoundary();
    return BigInt(result);
  },
  prepare: prepareInt,
  write: writeInt,
};

/**
 * Integer used to encode polymorphic variants
 */
export const VariantInt: TypeClass<number, number> = {
  read(buffer) {
    buffer.pushReadBoundary();
    const result = buffer.readUint32();
    if ((result & 1) !== 0) {
      buffer.popReadBoundary();
      return result >> 1;
    }
    throw new ReadError(buffer, "VariantInt is not properly encoded.");
  },
  prepare(context) {
    return { size: 4, context };
  },
  write(buffer, value) {
    const encoded = ((value | 0) << 1) | 1;
    buffer.writeUint32(encoded);
  },
};

/**
 * 8-bit signed integer
 */
export const Int8Bit: TypeClass<number, number> = {
  read(buffer) {
    return buffer.readInt8();
  },
  prepare(context) {
    return { size: 1, context };
  },
  write(buffer, value) {
    buffer.writeUint8(value & 0xff);
  },
};

/**
 * 16-bit signed integer using fixed length encoding, little endian.
 */
export const Int16Bit: TypeClass<number, number> = {
  read(buffer) {
    return buffer.readUint16();
  },
  prepare(context) {
    return { size: 2, context };
  },
  write(buffer, value) {
    buffer.writeUint16(value);
  },
};

/**
 * 32-bit signed integer using fixed length encoding, little endian.
 */
export const Int32Bit: TypeClass<number, number> = {
  read(buffer) {
    return buffer.readInt32();
  },
  prepare(context) {
    return { size: 4, context };
  },
  write(buffer, value) {
    buffer.writeUint32(value | 0);
  },
};

/**
 * 64-bit signed integer using fixed length encoding, little endian.
 */
export const Int64Bit: TypeClass<bigint, bigint> = {
  read(buffer) {
    return buffer.readInt64();
  },
  prepare(context) {
    return { size: 8, context };
  },
  write(buffer, value) {
    buffer.writeInt64(value);
  },
};

/**
 * writes any writable javascript integral number as a 64-bit integer using
 * fixed length encoding, little endian.
 */
export const Int53Bit: TypeClass<number, bigint> = {
  read(buffer) {
    buffer.pushReadBoundary();
    const value = buffer.readInt64();
    if (value > Number.MAX_SAFE_INTEGER) {
      throw new ReadError(buffer, "Value larger than MAX_SAFE_INTEGER");
    }
    buffer.popReadBoundary();
    return Number(value);
  },
  prepare(value) {
    return { size: 8, context: BigInt(value) };
  },
  write: Int64Bit.write,
};

/**
 * 16-bit signed integer using fixed length encoding, big endian.
 */
export const Network16: TypeClass<number, number> = {
  read(buffer) {
    return buffer.readUint16(true);
  },
  prepare(context) {
    return { size: 2, context };
  },
  write(buffer, value) {
    buffer.writeUint16(value, true);
  },
};

/**
 * 32-bit signed integer using fixed length encoding, big endian.
 */
export const Network32: TypeClass<number, number> = {
  read(buffer) {
    return buffer.readInt32(true);
  },
  prepare(context) {
    return { size: 4, context };
  },
  write(buffer, value) {
    buffer.writeUint32(value | 0, true);
  },
};

/**
 * 64-bit signed integer using fixed length encoding, big endian.
 */
export const Network64: TypeClass<bigint, bigint> = {
  read(buffer) {
    return buffer.readInt64(true);
  },
  prepare(context) {
    return { size: 8, context };
  },
  write(buffer, value) {
    buffer.writeInt64(value, true);
  },
};

/**
 * writes any writable javascript integral number as a 64-bit integer using
 * fixed length encoding, big endian.
 */
export const Network53: TypeClass<number, bigint> = {
  read(buffer) {
    buffer.pushReadBoundary();
    const result = buffer.readInt64(true);
    if (result > Number.MAX_SAFE_INTEGER) {
      throw new ReadError(buffer, "Number too large");
    }
    buffer.popReadBoundary();
    return Number(result);
  },
  prepare(context) {
    return { size: 8, context: BigInt(context) };
  },
  write: Network64.write,
};
