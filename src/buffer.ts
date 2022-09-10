export class ReadError extends Error {
  constructor(buffer: ReadBuffer, message: string) {
    super(message);
    this.name = "EncodingError";
    buffer.resetPointer();
  }
}

export class ReadBuffer {
  private ptr = 0;

  private boundaries: number[] = [];

  constructor(private contents: ArrayBuffer) {}

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
    const buf = new Uint8Array(this.contents, this.ptr);
    const result = buf[0];
    this.ptr++;
    return result;
  }

  readInt8() {
    const buf = new Int8Array(this.contents, this.ptr);
    const result = buf[0];
    this.ptr++;
    return result;
  }

  readFloat() {
    const buf = new Float64Array(this.contents, this.ptr);
    const result = buf[0];
    this.ptr += 8;
    return result;
  }

  readUint16() {
    const buf = new Uint16Array(this.contents, this.ptr);
    const result = buf[0];
    this.ptr += 2;
    return result;
  }

  readInt16() {
    const buf = new Int16Array(this.contents, this.ptr);
    const result = buf[0];
    this.ptr += 2;
    return result;
  }

  readUint32() {
    const buf = new Uint32Array(this.contents, this.ptr);
    const result = buf[0];
    this.ptr += 4;
    return result;
  }

  readInt32() {
    const buf = new Int32Array(this.contents, this.ptr);
    const result = buf[0];
    this.ptr += 4;
    return result;
  }

  readUint64() {
    const buf = new BigUint64Array(this.contents, this.ptr);
    const result = buf[0];
    this.ptr += 8;
    return result;
  }

  readInt64() {
    const buf = new BigInt64Array(this.contents, this.ptr);
    const result = buf[0];
    this.ptr += 8;
    return result;
  }

  readString(byteLength: number) {
    const buf = new Int8Array(this.contents, this.ptr, byteLength);
    const result = new TextDecoder().decode(buf);
    this.ptr += byteLength;
    return result;
  }
}

export class WriteBuffer {
  private ptr = 0;
  private contents: ArrayBuffer;

  constructor(size: number) {
    this.contents = new ArrayBuffer(size);
  }

  writeUint8(value: number) {
    const buf = new Uint8Array(this.contents, this.ptr);
    buf[0] = value & 0xff;
    this.ptr++;
  }

  writeUint16(value: number) {
    const buf = new Uint16Array(this.contents, this.ptr);
    buf[0] = value & 0xffff;
    this.ptr += 2;
  }

  writeUint32(value: number) {
    const buf = new Uint32Array(this.contents, this.ptr);
    buf[0] = value;
    this.ptr += 4;
  }

  writeUint64(value: number | bigint) {
    const buf = new BigUint64Array(this.contents, this.ptr);
    buf[0] = BigInt(value);
    this.ptr += 8;
  }
  writeInt64(value: number | bigint) {
    const buf = new BigInt64Array(this.contents, this.ptr);
    buf[0] = BigInt(value);
    this.ptr += 8;
  }

  writeFloat(value: number) {
    const buf = new Float64Array(this.contents, this.ptr);
    buf[0] = value;
    this.ptr += 8;
  }

  blit(buffer: Uint8Array) {
    const buf = new Uint8Array(this.contents, this.ptr);
    const len = buffer.length;
    for (let i = 0; i < len; ++i) {
      buf[i] = buffer[i];
    }
    this.ptr += len;
  }
}
