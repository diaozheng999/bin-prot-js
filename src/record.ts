import { Tuple } from "./tuple.js";
import { PreparedContextOfType, TypeClass, ValueOfType } from "./types.js";

export function Record<T extends { [key: string]: TypeClass<unknown, unknown> }>(
  spec: T
): TypeClass<
  { [k in keyof T]: ValueOfType<T[k]> },
  PreparedContextOfType<T[keyof T]>[]
> {
  const keys = Object.keys(spec);
  const specs = Object.values(spec);
  const len = keys.length;

  const typecon: TypeClass<unknown[], PreparedContextOfType<T[keyof T]>[]> =
    Tuple(...specs);

  return {
    read(buffer) {
      const result: any = {};
      const values = typecon.read(buffer);
      for (let i = 0; i < len; ++i) {
        result[keys[i]] = values[i];
      }
      return result;
    },
    prepare(value) {
      const prepared: unknown[] = [];

      for (let i = 0; i < len; ++i) {
        prepared.push(value[keys[i]]);
      }

      return typecon.prepare(prepared);
    },
    write(buffer, data) {
      typecon.write(buffer, data);
    },
  };
}
