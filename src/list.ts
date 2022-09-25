import { Nat0 } from "./nat0.js";
import { TypeClass } from "./types.js";

export function List<T, U>(
  spec: TypeClass<T, U>
): TypeClass<T[], [number, U[]]> {
  return {
    read(buffer) {
      const len = Nat0.read(buffer);
      const result: T[] = [];
      for (let i = 0; i < len; ++i) {
        result.push(spec.read(buffer));
      }
      return result;
    },
    prepare(values) {
      const len = values.length;
      const header = Nat0.prepare(len);
      let size = header.size;
      const prepared: U[] = [];
      for (const value of values) {
        const itemResult = spec.prepare(value);
        size += itemResult.size;
        prepared.push(itemResult.context);
      }
      return { size, context: [header.context, prepared] };
    },
    write(buffer, [size, contents]) {
      Nat0.write(buffer, size);
      for (const item of contents) {
        spec.write(buffer, item);
      }
    },
  };
}

export const Array = List;

export const FloatArray: TypeClass<Float64Array, [number, Uint8Array]> = {
  read(buffer) {
    const len = Nat0.read(buffer) * Float64Array.BYTES_PER_ELEMENT;
    const result = new Uint8Array(len);
    result.set(new Uint8Array(buffer.slice(0, len)));
    return new Float64Array(result);
  },
  prepare(values) {
    const len = values.length;
    const header = Nat0.prepare(len);
    return {
      size: header.size + len * Float64Array.BYTES_PER_ELEMENT,
      context: [header.context, new Uint8Array(values)],
    };
  },
  write(buffer, [size, context]) {
    Nat0.write(buffer, size);
    buffer.blit(context);
  },
};
