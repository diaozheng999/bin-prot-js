export class ReadError extends Error {
  constructor(buffer: ReadBuffer, message: string) {
    super(message);
    this.name = "EncodingError";
    buffer.resetPointer();
  }
}

const enum ReadToken {
  Read,
  Write,
}

class Buffer implements ArrayBuffer {
  protected ptr = 0;

  protected contents: ArrayBufferLike;

  protected unalignedBypassBuffer = new ArrayBuffer(8);

  public byteLength: number;

  private _view: DataView | undefined;

  protected get view() {
    if (!this._view) {
      this._view = new DataView(this.contents);
    }
    return this._view;
  }

  constructor(
    private readonly readToken: ReadToken,
    size: number | ArrayBufferLike,
    zero?: boolean
  ) {
    if (typeof size === "number") {
      this.contents = new ArrayBuffer(size);
    } else {
      this.contents = size;
    }
    this.byteLength = this.contents.byteLength;

    if (zero) {
      const view = new Int8Array(this.contents);
      view.fill(0);
    }
  }
  get [Symbol.toStringTag]() {
    switch (this.readToken) {
      case ReadToken.Read:
        return "ReadBuffer";

      case ReadToken.Write:
        return "WriteBuffer";
    }
  }

  currentPosition() {
    return this.ptr;
  }

  buffer() {
    return new Uint8Array(this.contents, 0, this.ptr);
  }

  remaining() {
    return new Uint8Array(this.contents, this.ptr);
  }

  arrayBuffer() {
    return this.contents;
  }

  slice(begin: number, end?: number | undefined): ArrayBuffer {
    switch (this.readToken) {
      case ReadToken.Read:
        const i = begin + this.ptr;
        const n = end === undefined ? undefined : end + this.ptr;
        this.assertLength(i, this.contents.byteLength);
        if (n !== undefined) {
          this.assertLength(n, this.contents.byteLength);
        }
        return this.contents.slice(i, n);

      case ReadToken.Write:
        this.assertLength(begin, this.ptr);
        if (end !== undefined) {
          this.assertLength(end, this.ptr);
        }
        return this.contents.slice(begin, end ?? this.ptr);
    }
  }

  hexdump(maxLength: number) {
    let result = [];

    const array = new Uint8Array(this.slice(0));

    this.assertLength(array.length, maxLength);

    // print the dots first
    for (let i = array.length; i < maxLength; ++i) {
      result.push("..");
    }

    for (let i = array.length - 1; i >= 0; --i) {
      const s = array[i].toString(16);
      if (s.length < 2) {
        result.push(`0${s}`);
      } else {
        result.push(array[i].toString(16));
      }
    }
    return result.join(" ");
  }

  assertLength(i: number, n: number, comment?: string) {
    if (i > n) {
      const error = new Error(
        comment ?? `attempting to index ${i} of buffer size ${n}`
      );
      error.name = "BufferShortError";
      throw error;
    }
  }
}

export class ReadBuffer extends Buffer {
  private boundaries: number[] = [];

  constructor(contents: ArrayBufferLike) {
    super(ReadToken.Read, contents, false);
  }

  pushReadBoundary() {
    this.boundaries.push(this.ptr);
  }

  popReadBoundary() {
    this.boundaries.pop();
  }

  resetPointer() {
    if (this.boundaries.length) {
      this.ptr = this.boundaries[this.boundaries.length - 1];
      this.popReadBoundary();
    }
  }

  readUint8() {
    const value = this.view.getUint8(this.ptr);
    this.ptr++;
    return value;
  }

  readInt8() {
    const value = this.view.getInt8(this.ptr);
    this.ptr++;
    return value;
  }

  readFloat(bigEndian?: boolean) {
    const value = this.view.getFloat64(this.ptr, !bigEndian);
    this.ptr += 8;
    return value;
  }

  readUint16(bigEndian?: boolean) {
    const value = this.view.getUint16(this.ptr, !bigEndian);
    this.ptr += 2;
    return value;
  }

  readInt16(bigEndian?: boolean) {
    const value = this.view.getInt16(this.ptr, !bigEndian);
    this.ptr += 2;
    return value;
  }

  readUint32(bigEndian?: boolean) {
    const value = this.view.getUint32(this.ptr, !bigEndian);
    this.ptr += 4;
    return value;
  }

  readInt32(bigEndian?: boolean) {
    const value = this.view.getInt32(this.ptr, !bigEndian);
    this.ptr += 4;
    return value;
  }

  readUint64(bigEndian?: boolean) {
    const value = this.view.getBigUint64(this.ptr, !bigEndian);
    this.ptr += 8;
    return value;
  }

  readInt64(bigEndian?: boolean) {
    const value = this.view.getBigInt64(this.ptr, !bigEndian);
    this.ptr += 8;
    return value;
  }

  readString(byteLength: number) {
    const buf = new Int8Array(this.contents, this.ptr, byteLength);
    const result = new TextDecoder().decode(buf);
    this.ptr += byteLength;
    return result;
  }
}

export class WriteBuffer extends Buffer {
  constructor(size: number | ArrayBufferLike, zero?: boolean) {
    super(ReadToken.Write, size, zero);
  }

  sub() {
    return new Uint8Array(this.contents, 0, this.ptr);
  }

  writeUint8(value: number) {
    this.view.setUint8(this.ptr, value & 0xff);
    this.ptr++;
  }

  writeUint16(value: number, bigEndian?: boolean) {
    this.view.setUint16(this.ptr, value & 0xffff, !bigEndian);
    this.ptr += 2;
  }

  writeUint32(value: number, bigEndian?: boolean) {
    this.view.setUint32(this.ptr, value, !bigEndian);
    this.ptr += 4;
  }

  writeUint64(value: number | bigint, bigEndian?: boolean) {
    this.view.setBigUint64(this.ptr, BigInt(value), !bigEndian);
    this.ptr += 8;
  }

  writeInt64(value: number | bigint, bigEndian?: boolean) {
    this.view.setBigInt64(this.ptr, BigInt(value), !bigEndian);
    this.ptr += 8;
  }

  writeFloat(value: number, bigEndian?: boolean) {
    this.view.setFloat64(this.ptr, value, !bigEndian);
    this.ptr += 8;
  }

  blit(buffer: Uint8Array, length?: number) {
    const buf = new Uint8Array(this.contents, this.ptr);
    const len = length ?? buffer.length;
    for (let i = 0; i < len; ++i) {
      buf[i] = buffer[i];
    }
    this.ptr += len;
  }
}
