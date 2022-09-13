import { ReadBuffer, WriteBuffer } from "./buffer.js";
import { BinProt, TypeClass } from "./types.js";

export function create<T, U>(typeClass: TypeClass<T, U>): BinProt<T, U> {
  return {
    typeClass,
    read(buffer, offset) {
      const readBuffer = new ReadBuffer(buffer.slice(offset ?? 0));
      return typeClass.read(readBuffer);
    },
    write(buffer, value, offset) {
      const writeBuffer = new WriteBuffer(buffer.slice(offset ?? 0));
      const { context } = typeClass.prepare(value);
      typeClass.write(writeBuffer, context);
    },
    size(value) {
      const { size } = typeClass.prepare(value);
      return size;
    },
    pack(value) {
      const { size, context } = typeClass.prepare(value);
      const buffer = new ArrayBuffer(size);
      const writeBuffer = new WriteBuffer(buffer);
      typeClass.write(writeBuffer, context);
      return writeBuffer.sub();
    },
  };
}
