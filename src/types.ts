import { ReadBuffer, WriteBuffer } from "./buffer.js";

export interface Typedef<T, U = T> {
  read(buffer: ReadBuffer): T;
  prepare(value: T): { size: number; context: U };
  write(buffer: WriteBuffer, value: U): void;
}

export type ValueOfType<T> = T extends Typedef<infer U, unknown> ? U : never;
export type PreparedContextOfType<T> = T extends Typedef<unknown, infer U>
  ? U
  : never;
