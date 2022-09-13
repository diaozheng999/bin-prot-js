import { ReadBuffer, ReadError, WriteBuffer } from "./buffer.js";
import { CODE_INT16, CODE_INT32, CODE_INT64, CODE_NEG_INT8 } from "./nat0.js";
import { Typedef } from "./types.js";

export type PreparedInt =
  | number
  | [typeof CODE_NEG_INT8, number]
  | [typeof CODE_INT16, number]
  | [typeof CODE_INT32, number]
  | [typeof CODE_INT64, bigint];

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
      return { size: 1, context: Number(n) };
    } else if (n < 0x8000) {
      return { size: 3, context: [CODE_INT16, Number(n) & 0xffff] };
    } else if (n < 0x80000000) {
      return { size: 5, context: [CODE_INT32, Number(n) & 0xffffffff] };
    } else {
      const bn = typeof n === "number" ? BigInt(n) : n;
      return { size: 9, context: [CODE_INT64, bn] };
    }
  } else {
    if (n >= -0x80) {
      return { size: 2, context: [CODE_NEG_INT8, Number(n) & 0xff] };
    } else if (n >= -0x8000) {
      return { size: 3, context: [CODE_INT16, Number(n) & 0xffff] };
    } else if (n >= -0x80000000) {
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

export const Int: Typedef<number, PreparedInt> = {
  read(buffer) {
    const result = unsafeReadInt(buffer);
    if (typeof result !== "number") {
      throw new ReadError(buffer, "Use Int64 to read 64-bit ints into BigInt.");
    }
    buffer.popReadBoundary();
    return result;
  },
  prepare: prepareInt,
  write: writeInt,
};

export const Int64: Typedef<bigint, PreparedInt> = {
  read(buffer) {
    const result = unsafeReadInt(buffer);
    buffer.popReadBoundary();
    return BigInt(result);
  },
  prepare: prepareInt,
  write: writeInt,
};

export const VariantInt: Typedef<number, number> = {
  read(buffer) {
    buffer.pushReadBoundary();
    const __buf = new WriteBuffer(buffer);
    (__buf as any).ptr = 4;
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

export const Int8Bit: Typedef<number, number> = {
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

export const Int16Bit: Typedef<number, number> = {
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

export const Int32Bit: Typedef<number, number> = {
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

export const Int64Bit: Typedef<bigint, bigint> = {
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

export const Network16: Typedef<number, number> = {
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

export const Network32: Typedef<number, number> = {
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

export const Network64: Typedef<bigint, bigint> = {
  read(buffer) {
    return buffer.readInt64(true);
  },
  prepare(context) {
    return { size: 8, context };
  },
  write(buffer, value) {
    buffer.writeInt64(value, true);
  },
}