import { byteToString } from "./hexdump.js";
import { TypeClass } from "./types.js";

export interface MD5able<T> {
  fromBytes(bytes: number[]): T;
  toBytes(value: T): number[];
}

export class MD5String {
  private readonly buf: Array<number> = [];
  private stringRepr: string | undefined;

  static fromBytes(bytes: number[]) {
    return new MD5String(bytes);
  }

  static toBytes(value: MD5String) {
    return value.toBytes();
  }

  static compare(left: MD5String, right: MD5String) {
    let pos = 0;
    for (let i = 0; i < 16; ++i) {
      const cmp = Math.sign(left.buf[i] - right.buf[i]);
      pos = pos || cmp;
    }
    return pos;
  }

  static equal(left: MD5String, right: MD5String) {
    return MD5String.compare(left, right) === 0;
  }

  constructor(buffer: ArrayLike<number>) {
    for (let i = 0; i < 16; ++i) {
      const byte = buffer[i];
      if (byte >= 0 && byte < 256) {
        this.buf[i] = byte;
      } else {
        throw new Error("Invalid byte!");
      }
    }
  }

  toBytes() {
    return this.buf;
  }

  toString() {
    if (!this.stringRepr) {
      this.stringRepr = this.buf.map(byteToString).join("");
    }
    return this.stringRepr;
  }
}

export function MD5<T>(impl: MD5able<T>): TypeClass<T, Uint8Array> {
  return {
    read(buffer) {
      const buf = buffer.readBytes(16);
      return impl.fromBytes(Array.from(buf));
    },
    prepare(value) {
      const buf = new Uint8Array(16);
      const bytes = impl.toBytes(value);

      if (bytes.length !== 16) {
        throw new Error("MD5 encode error!");
      }

      for (const byte of bytes) {
        if (!(byte >= 0 && byte <= 255)) {
          throw new Error("MD5 encode error!");
        }
      }

      buf.set(bytes);
      return { size: 16, context: buf };
    },
    write(buffer, context) {
      buffer.blit(context);
    },
  };
}

MD5.default = MD5(MD5String);
