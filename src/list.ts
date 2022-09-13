import { Nat0 } from "./nat0.js";
import { Typedef } from "./types.js";

export function List<T, U>(spec: Typedef<T, U>): Typedef<T[], [number, U[]]> {
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
