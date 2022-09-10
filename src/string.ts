import { Nat0, readNat0, writeNat0 } from "./nat0";
import { Typedef } from "./types";

export const String: Typedef<string, [number, Uint8Array]> = {
  read(buffer) {
    const size = readNat0(buffer);
    const value = buffer.readString(size);
    return value;
  },

  prepare(string) {
    const encodedBuffer = new TextEncoder().encode(string);

    const { size, context } = Nat0.prepare(encodedBuffer.byteLength);

    return {
      size: size + encodedBuffer.byteLength,
      context: [context, encodedBuffer],
    };
  },

  write(buffer, [size, encoded]) {
    writeNat0(buffer, size);
    buffer.blit(encoded);
  },
};
