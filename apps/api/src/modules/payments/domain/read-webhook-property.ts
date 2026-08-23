/**
 * Reads a dotted path (e.g. `"transaction.status"`) out of a webhook's `data`
 * object, the same shape `signature.properties` itself names.
 *
 * Returns a string either way — numbers are stringified, since that is exactly
 * what the gateway did before hashing them into the checksum in the first place.
 */
export function readWebhookProperty(
  data: Record<string, unknown>,
  path: string,
): string | undefined {
  const value = path.split('.').reduce<unknown>((node, key) => {
    if (node !== null && typeof node === 'object' && key in node) {
      return (node as Record<string, unknown>)[key];
    }

    return undefined;
  }, data);

  if (typeof value === 'string') return value;
  if (typeof value === 'number') return String(value);

  return undefined;
}
