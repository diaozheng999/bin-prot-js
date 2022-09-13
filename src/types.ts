import { ReadBuffer, WriteBuffer } from "./buffer.js";

export interface TypeClass<T, U = T> {
  read(buffer: ReadBuffer): T;
  prepare(value: T): { size: number; context: U };
  write(buffer: WriteBuffer, value: U): void;
}

export interface BinProt<T, U = T> {
  typeClass: TypeClass<T, U>;
  read(buffer: ArrayBufferLike, offset?: number): T;
  pack(value: T): Uint8Array;
  write(buffer: ArrayBufferLike, value: T, offset?: number): void;
  size(value: T): number;
}

export type ValueOfType<T> = T extends TypeClass<infer U, unknown> ? U : never;
export type PreparedContextOfType<T> = T extends TypeClass<unknown, infer U>
  ? U
  : never;
