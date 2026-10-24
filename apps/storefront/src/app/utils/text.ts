/** "traditional jewellery" → "Traditional Jewellery" */
export function toTitleCase(value: string): string {
  if (!value) {
    return '';
  }
  return value
    .trim()
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}
