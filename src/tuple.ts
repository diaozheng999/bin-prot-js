import type { PreparedContextOfType, TypeClass, ValueOfType } from "./types.js";

export type ValueOfArray<T> = T extends []
  ? []
  : T extends [infer Head, ...infer Tail]
  ? [ValueOfType<Head>, ...ValueOfArray<Tail>]
  : never;

export type PreparedContextOfArray<T> = T extends []
  ? []
  : T extends [infer Head, ...infer Tail]
  ? [PreparedContextOfType<Head>, ...PreparedContextOfArray<Tail>]
  : never;

export function Tuple<T extends TypeClass<unknown, unknown>[]>(
  ...typedefs: T
): TypeClass<ValueOfArray<T>, PreparedContextOfArray<T>> {
  const len = typedefs.length;
  return {
    read(buffer) {
      const result: any[] = [];
      for (const typedef of typedefs) {
        result.push(typedef.read(buffer));
      }
      return result as ValueOfArray<T>;
    },
    prepare(value: unknown[]) {
      let size = 0;
      const context: any[] = [];
      for (let i = 0; i < len; ++i) {
        let result = typedefs[i].prepare(value[i]);
        size += result.size;
        context.push(result.context);
      }
      return { size, context: context as PreparedContextOfArray<T> };
    },
    write(buffer, context: unknown[]) {
      for (let i = 0; i < len; ++i) {
        typedefs[i].write(buffer, context[i]);
      }
    },
  };
}
