/** Shallow-merge locale namespace objects (common, auth, tabs, …). */
export function mergeLocales(...parts) {
  return Object.assign({}, ...parts);
}
