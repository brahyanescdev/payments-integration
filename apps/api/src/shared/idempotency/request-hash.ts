import { createHash } from 'node:crypto';

/**
 * A stable hash of a request body.
 *
 * `JSON.stringify` on an object with the same keys in a different order produces
 * a different string, which would make the idempotency check reject a logically
 * identical retry just because a client library reordered its fields. Sorting
 * keys recursively before hashing is what makes the comparison about the data,
 * not its serialisation order.
 */
export function hashRequestBody(body: unknown): string {
  return createHash('sha256').update(stableStringify(body)).digest('hex');
}

function stableStringify(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  if (value !== null && typeof value === 'object') {
    const keys = Object.keys(value).sort();
    const entries = keys.map(
      (key) => `${JSON.stringify(key)}:${stableStringify((value as Record<string, unknown>)[key])}`,
    );

    return `{${entries.join(',')}}`;
  }

  return JSON.stringify(value);
}
