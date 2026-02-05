import sanitizeHtml from 'sanitize-html';

export function sanitize(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: [],
    allowedAttributes: {},
    disallowedTagsMode: 'escape',
  });
}

export function sanitizeObject<T extends Record<string, unknown>>(obj: T, fields: string[]): T {
  const result = { ...obj };
  for (const field of fields) {
    if (typeof result[field] === 'string') {
      (result as Record<string, unknown>)[field] = sanitize(result[field] as string);
    }
  }
  return result;
}
