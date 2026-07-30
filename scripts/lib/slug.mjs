const SEPARATORS = /[（）()［］\[\]｛｝{}／/\\、，,\s]+/g;

export function toSlug(name) {
  return String(name)
    .replace(SEPARATORS, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^-+|-+$/g, '');
}

export function setPath(setId, name) {
  return `/set/${setId}-${toSlug(name)}`;
}
