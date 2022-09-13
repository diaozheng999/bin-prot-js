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

  readOffset(
    ctor: BigUint64ArrayConstructor | BigInt64ArrayConstructor
  ): bigint;
  readOffset(
    ctor:
      | Uint8ArrayConstructor
      | Int8ArrayConstructor
      | Uint16ArrayConstructor
      | Int16ArrayConstructor
      | Uint32ArrayConstructor
      | Int32ArrayConstructor
      | Float32ArrayConstructor
      | Float64ArrayConstructor
  ): number;
  readOffset(
    ctor:
      | Uint8ArrayConstructor
      | Int8ArrayConstructor
      | Uint16ArrayConstructor
      | Int16ArrayConstructor
      | Uint32ArrayConstructor
      | Int32ArrayConstructor
      | BigUint64ArrayConstructor
      | BigInt64ArrayConstructor
      | Float32ArrayConstructor
      | Float64ArrayConstructor
  ) {
    let results: number | bigint;
    if (this.ptr % ctor.BYTES_PER_ELEMENT) {
      const buf = new Uint8Array(this.contents, this.ptr);
      const bypassBytes = new Uint8Array(this.unalignedBypassBuffer, 0);
      for (let i = 0; i < ctor.BYTES_PER_ELEMENT; ++i) {
        bypassBytes[i] = buf[i];
      }
      const bypassBuf = new ctor(this.unalignedBypassBuffer, 0);
      results = bypassBuf[0];
    } else {
      const buf = new ctor(this.contents, this.ptr);
      results = buf[0];
    }
    this.ptr += ctor.BYTES_PER_ELEMENT;
    return results;
  }

  readUint8() {
    return this.readOffset(Uint8Array);
  }

  readInt8() {
    return this.readOffset(Int8Array);
  }

  readFloat() {
    return this.readOffset(Float64Array);
  }

  readUint16() {
    return this.readOffset(Uint16Array);
  }

  readInt16() {
    return this.readOffset(Int16Array);
  }

  readUint32() {
    return this.readOffset(Uint32Array);
  }

  readInt32() {
    return this.readOffset(Int32Array);
  }

  readUint64() {
    return this.readOffset(BigUint64Array);
  }

  readInt64() {
    return this.readOffset(BigInt64Array);
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

  writeOffsetBigInt(
    ctor: BigUint64ArrayConstructor | BigInt64ArrayConstructor,
    value: number | bigint
  ): void {
    if (this.ptr % ctor.BYTES_PER_ELEMENT) {
      const buf = new ctor(this.unalignedBypassBuffer, 0);
      buf[0] = BigInt(value);
      this.blit(new Uint8Array(buf), ctor.BYTES_PER_ELEMENT);
    } else {
      const buf = new ctor(this.contents, this.ptr);
      buf[0] = BigInt(value);
      this.ptr += ctor.BYTES_PER_ELEMENT;
    }
  }
  writeOffset(
    ctor:
      | Uint8ArrayConstructor
      | Int8ArrayConstructor
      | Uint16ArrayConstructor
      | Int16ArrayConstructor
      | Uint32ArrayConstructor
      | Int32ArrayConstructor
      | Float32ArrayConstructor
      | Float64ArrayConstructor,
    value: number | bigint
  ) {
    if (this.ptr % ctor.BYTES_PER_ELEMENT) {
      const buf = new ctor(this.unalignedBypassBuffer, 0);
      buf[0] = Number(value);
      this.blit(new Uint8Array(buf), ctor.BYTES_PER_ELEMENT);
    } else {
      const buf = new ctor(this.contents, this.ptr);
      buf[0] = Number(value);
      this.ptr += ctor.BYTES_PER_ELEMENT;
    }
  }

  writeUint8(value: number) {
    this.writeOffset(Uint8Array, value & 0xff);
  }

  writeUint16(value: number) {
    this.writeOffset(Uint16Array, value & 0xffff);
  }

  writeUint32(value: number) {
    this.writeOffset(Uint32Array, value);
  }

  writeUint64(value: number | bigint) {
    this.writeOffsetBigInt(BigUint64Array, value);
  }

  writeInt64(value: number | bigint) {
    this.writeOffsetBigInt(BigInt64Array, value);
  }

  writeFloat(value: number) {
    this.writeOffset(Float64Array, value);
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
