import { ReadBuffer, WriteBuffer } from "./buffer.js";

/**
 * A triple of serialisation/deserialisation definitions for a specific type.
 *
 * In `bin_prot`, these will be defined as `bin_read_t`, `bin_write_t` and
 * `bin_size_t`.
 *
 * We use these values a bit differently here, where `prepare` function (
 * equivalent of a `bin_size_t`) is also allowed to precompute part of the
 * written value to prevent double work. This precomputed value should then
 * be passed to `write` method to write to the buffer.
 *
 * @example
 * // Reading from a TypeClass
 * const buffer = new ReadBuffer(buf);
 * const value = typeClass.read(buffer);
 *
 * @example
 * // writing to a TypeClass
 * const buffer = new WriteBuffer(buf);
 * const { context } = typeClass.prepare(value);
 * typeClass.write(buffer, context);
 *
 * @example
 * // retrieving the binary size of a value
 * const { size } = typeClass.prepare(value);
 *
 * @template T the type to deserialise to
 * @template U the intermediate type that will be returned by the `prepare`
 * method that should be passed to `write`.
 */
export interface TypeClass<T, U = T> {
  /**
   * Read a value from the underlying buffer. Should increment the cursor to the
   * next element after the value has been read.
   *
   * This is equivalent to `bin_read_t`.
   *
   * @param buffer the buffer to read from
   * @returns deserialised value
   */
  read(buffer: ReadBuffer): T;
  /**
   * Prepares a value for writing. This function should do two things:
   * 1. Return the size in bytes of the buffer to be written
   * 2. Precompute the values to be used in writing. The returned value should
   *    be easily writable by the functions provided in `WriteBuffer` or another
   *    TypeClass without much hassle.
   *
   * This is roughly equivalent to `bin_size_t`
   *
   * @param value the value to serialise
   * @returns the binary size as well as a packed value to be written.
   */
  prepare(value: T): { size: number; context: U };
  /**
   * Writes the value to the underlying buffer. It should increment the cursor
   * to the next empty byte.
   *
   * This is equivalent to `bin_write_t`.
   *
   * It takes in the prepared value from `prepare` instead of an actual value.
   * This is to allow a deeply-nested TypeClass to perform some calculation
   * while preparing the size of the container.
   *
   * @param buffer the buffer to be written to
   * @param value the prepared value to write
   */
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
