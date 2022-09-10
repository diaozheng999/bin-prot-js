import { Typedef } from "./types";

export const Float: Typedef<number> = {
  read(buffer) {
    return buffer.readFloat();
  },

  prepare(context) {
    return { size: 8, context };
  },

  write(buffer, value) {
    buffer.writeFloat(value);
  },
};
