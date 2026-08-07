function camelToSnake(str: string): string {
  return str.replace(/([A-Z])/g, (_, c: string) => `_${c.toLowerCase()}`);
}

function snakeToCamel(str: string): string {
  return str.replace(/_([a-z])/g, (_, c: string) => c.toUpperCase());
}

/**
 * Convert camelCase object keys to snake_case.
 * Skips `tagIds` – that field is managed via junction tables, not as a column.
 */
export function toSnake(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === 'tagIds') continue;
    result[camelToSnake(key)] = value;
  }
  return result;
}

/**
 * Convert snake_case object keys to camelCase.
 * `tag_ids` → `tagIds` is handled naturally by the regex.
 */
export function toCamel(obj: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    result[snakeToCamel(key)] = value;
  }
  return result;
}
