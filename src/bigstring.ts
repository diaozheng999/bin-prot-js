import { Nat0 } from "./nat0.js";
import { TypeClass } from "./types.js";

export const Bigstring: TypeClass<Uint8Array, [number, Uint8Array]> = {
  read(buffer) {
    const size = Nat0.read(buffer);
    return buffer.readBytes(size);
  },
  prepare(value) {
    const size = value.byteLength;
    const header = Nat0.prepare(size);
    return { size: size + header.size, context: [header.context, value] };
  },
  write(buffer, [header, contents]) {
    Nat0.write(buffer, header);
    buffer.blit(contents);
  },
};
