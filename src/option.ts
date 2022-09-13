import { Bool } from "./bool.js";
import { Typedef } from "./types.js";

export const none = Symbol("none");

export function Option<T, U>(
  typedef: Typedef<T, U>
): Typedef<T | undefined, U | typeof none> {
  return {
    read(buffer) {
      const isSome = Bool.read(buffer);
      if (isSome) {
        return typedef.read(buffer);
      }
      return undefined;
    },
    prepare(value) {
      if (value === undefined) {
        return { size: 1, context: none };
      }
      const { size, context } = typedef.prepare(value);
      return { size: size + 1, context };
    },
    write(buffer, context) {
      if (context === none) {
        buffer.writeUint8(0);
      } else {
        buffer.writeUint8(1);
        typedef.write(buffer, context);
      }
    },
  };
}
