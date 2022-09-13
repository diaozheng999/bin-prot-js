import { ReadBuffer, WriteBuffer } from "./buffer.js";
import { Record } from "./record.js";
import { PreparedContextOfArray, Tuple, ValueOfArray } from "./tuple.js";
import { PreparedContextOfType, TypeClass, ValueOfType } from "./types.js";

export type VariantSpecWithoutPayload<T extends string> = {
  type: T;
};
export type VariantSpecWithPayload<T extends string, V, U> = {
  type: T;
  payload: TypeClass<V, U>;
};

export type VariantSpec =
  | VariantSpecWithoutPayload<string>
  | VariantSpecWithPayload<string, unknown, unknown>;

export type ValueOfVariantSpec<T> = T extends VariantSpecWithPayload<
  infer T,
  infer V,
  unknown
>
  ? { type: T; payload: V }
  : T extends VariantSpecWithoutPayload<infer U>
  ? U
  : never;

export type ValueOfVariants<T> = T extends []
  ? never
  : T extends [infer Variant, ...infer Rest]
  ? ValueOfVariantSpec<Variant> | ValueOfVariants<Rest>
  : never;

export type PreparedContextOfVariantSpec<T> = T extends VariantSpecWithPayload<
  string,
  unknown,
  infer U
>
  ? U
  : never;

export type PreparedContextOfVariants<T> = T extends []
  ? never
  : T extends [infer Variant, ...infer Rest]
  ? PreparedContextOfVariantSpec<Variant> | PreparedContextOfVariants<Rest>
  : never;

export function Variant<TName extends string>(
  name: TName
): VariantSpecWithoutPayload<TName>;
export function Variant<
  TName extends string,
  TSpec extends { [key: string]: TypeClass<unknown, unknown> }
>(
  name: TName,
  spec: TSpec
): VariantSpecWithPayload<
  TName,
  { [k in keyof TSpec]: ValueOfType<TSpec[k]> },
  PreparedContextOfType<TSpec[keyof TSpec]>[]
>;
export function Variant<TName extends string, T, U>(
  name: TName,
  spec: TypeClass<T, U>
): VariantSpecWithPayload<TName, T, U>;
export function Variant<
  TName extends string,
  TSpec extends TypeClass<unknown, unknown>[]
>(
  name: TName,
  ...spec: TSpec
): VariantSpecWithPayload<
  TName,
  ValueOfArray<TSpec>,
  PreparedContextOfArray<TSpec>
>;
export function Variant(name: string, ...spec: any[]): any {
  if (!spec) {
    return { type: name };
  }

  if (spec.length > 1) {
    return { type: name, payload: Tuple(...spec) };
  }

  if (
    spec[0].hasOwnProperty("read") &&
    spec[0].hasOwnProperty("prepare") &&
    spec[0].hasOwnProperty("write")
  ) {
    return { type: name, ayload: spec[0] };
  }

  return { type: name, payload: Record(spec[0]) };
}

function hasPayload<T, U>(
  spec: VariantSpec
): spec is VariantSpecWithPayload<string, T, U> {
  return "payload" in spec;
}

export function Enum<T extends VariantSpec[]>(
  ...variants: T
): TypeClass<ValueOfVariants<T>, [number, PreparedContextOfVariants<T>]> {
  const idx: Record<string, number> = {};
  const len = variants.length;

  for (let i = 0; i < len; ++i) {
    idx[variants[i].type] = i;
  }

  const readVariant = (buffer: ReadBuffer, i: number) => {
    const variant = variants[i];
    if (hasPayload(variant)) {
      const payload = variant.payload.read(buffer);
      return { type: variant.type, payload };
    }
    return variant.type;
  };

  const prepareVariant = (
    n: number,
    value: string | { type: string; payload: unknown }
  ): { size: number; context: [number, PreparedContextOfVariants<T>] } => {
    if (typeof value === "string") {
      const i = idx[value];
      const variant = variants[i];
      if (hasPayload(variant)) {
        throw new Error("Write error: variant should have payload.");
      }
      return {
        size: n,
        context: [i, undefined as PreparedContextOfVariants<T>],
      };
    } else {
      const i = idx[value.type];
      const variant = variants[i];
      if (!hasPayload(variant)) {
        throw new Error("Write error: variant should not have payload.");
      }
      const { size, context } = variant.payload.prepare(value.payload);
      return {
        size: n + size,
        context: [i, context as PreparedContextOfVariants<T>],
      };
    }
  };

  const writeVariant = (
    buffer: WriteBuffer,
    variant: VariantSpec,
    content: unknown
  ) => {
    if (hasPayload(variant)) {
      variant.payload.write(buffer, content);
    }
  };

  if (len <= 256) {
    return {
      read(buffer): any {
        const i = buffer.readUint8();
        return readVariant(buffer, i);
      },
      prepare(value: string | { type: string; payload: unknown }) {
        return prepareVariant(1, value);
      },
      write(buffer, [i, payload]) {
        buffer.writeUint8(i);
        writeVariant(buffer, variants[i], payload);
      },
    };
  } else if (len <= 65536) {
    return {
      read(buffer): any {
        const i = buffer.readUint16();
        return readVariant(buffer, i);
      },
      prepare(value: string | { type: string; payload: unknown }) {
        return prepareVariant(2, value);
      },
      write(buffer, [i, payload]) {
        buffer.writeUint16(i);
        writeVariant(buffer, variants[i], payload);
      },
    };
  } else {
    throw new Error("Enum of greater than 65536 entries is not supported.");
  }
}
