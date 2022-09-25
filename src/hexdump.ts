export function byteToString(value: number) {
  const bytes = value.toString(16);
  if (bytes.length < 2) {
    return `0${bytes}`;
  }
  return bytes;
}
