import { ReadBuffer, WriteBuffer } from "./buffer.js";

export interface TypeClass<T, U = T> {
  read(buffer: ReadBuffer): T;
  prepare(value: T): { size: number; context: U };
  write(buffer: WriteBuffer, value: U): void;
}

export type ValueOfType<T> = T extends TypeClass<infer U, unknown> ? U : never;
export type PreparedContextOfType<T> = T extends TypeClass<unknown, infer U>
  ? U
  : never;
