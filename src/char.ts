import type { TypeClass } from "./types.js";

export const Char: TypeClass<string, number> = {
  read(buffer) {
    return String.fromCharCode(buffer.readUint8());
  },

  prepare(char) {
    const context = char.charCodeAt(0);
    if (context >= 0 && context <= 255) {
      return { size: 1, context };
    }
    const error = new Error(
      `Only support 1-character non-unicode strings, given "${char}"`
    );
    error.name = "WriteError";
    throw error;
  },

  write(buffer, code) {
    buffer.writeUint8(code);
  },
};
