import { Nat0 } from "./nat0.js";
import { TypeClass } from "./types.js";

export function HashTable<TK, UK, TV, UV>(
  keySpec: TypeClass<TK, UK>,
  valueSpec: TypeClass<TV, UV>
): TypeClass<Map<TK, TV>, [number, [UK, UV][]]> {
  return {
    read(buffer) {
      const size = Nat0.read(buffer);
      const map = new Map<TK, TV>();
      for (let i = 0; i < size; ++i) {
        const key = keySpec.read(buffer);
        const value = valueSpec.read(buffer);
        map.set(key, value);
      }
      return map;
    },
    prepare(value) {
      const n = value.size;
      const header = Nat0.prepare(n);
      let size = header.size;
      const contents: [UK, UV][] = [];
      for (const [k, v] of value.entries()) {
        const keyU = keySpec.prepare(k);
        const valueU = valueSpec.prepare(v);
        size += keyU.size + valueU.size;
        contents.push([keyU.context, valueU.context]);
      }
      return { size, context: [header.context, contents] };
    },
    write(buffer, [header, contents]) {
      Nat0.write(buffer, header);
      for (const [key, value] of contents) {
        keySpec.write(buffer, key);
        valueSpec.write(buffer, value);
      }
    },
  };
}
