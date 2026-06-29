// baobab — token structure (no defaults).
//
// baobab declares the *shape* of a design-token set (the W3C design-tokens format);
// a pinning (e.g. `brand`) supplies every value. These utilities resolve W3C aliases
// (`{primitive.green-700}` → `#0C5A42`, recursively) and flatten the nested tree to the
// flat `{ "color.forest": "#0C5A42", … }` slot map a component template reads.
//
// Extracted from spike/with-pinning.ts (M3).

/** A flat, resolved slot map: `{ "color.forest": "#0C5A42", "radius.radius-md": "8px" }`. */
export type Tokens = Record<string, string>;

// deno-lint-ignore no-explicit-any -- a raw W3C design-token tree is arbitrarily shaped JSON.
type Json = any;

const ALIAS = /^\{(.+)\}$/;
const isLeaf = (n: Json): boolean =>
  n != null && typeof n === "object" && "$value" in n;

/** Look up a leaf token by dot-path (e.g. `"primitive.green-700"`) in the raw tree. */
function lookup(root: Json, path: string): Json {
  let node: Json = root;
  for (const seg of path.split(".")) node = node?.[seg];
  if (!isLeaf(node)) throw new Error(`alias target is not a token: {${path}}`);
  return node;
}

/** Resolve a `$value`, chasing `{alias}` references recursively; throws on cycles. */
function resolve(root: Json, value: Json, seen = new Set<string>()): Json {
  if (typeof value === "string") {
    const m = value.match(ALIAS);
    if (!m) return value;
    const path = m[1];
    if (seen.has(path)) throw new Error(`alias cycle at {${path}}`);
    seen.add(path);
    return resolve(root, lookup(root, path).$value, seen);
  }
  if (Array.isArray(value)) {
    return value.map((v) => resolve(root, v, new Set(seen)));
  }
  if (value != null && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map((
        [k, v],
      ) => [k, resolve(root, v, new Set(seen))]),
    );
  }
  return value;
}

/** Render a resolved value as a CSS-ready string (arrays → comma-joined font stack). */
function css(value: Json): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value != null && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/**
 * Flatten a W3C design-token tree to a resolved slot map.
 *
 * Aliases are chased to concrete values; nested groups become dot-paths;
 * `$description` and other `$`-prefixed group metadata are skipped.
 *
 * @param root the raw, parsed W3C design-tokens object (a pinning supplies this)
 * @returns `{ "color.forest": "#0C5A42", … }`
 */
export function flattenTokens(root: Json): Tokens {
  const out: Tokens = {};
  const walk = (node: Json, prefix: string): void => {
    if (isLeaf(node)) {
      out[prefix] = css(resolve(root, node.$value));
      return;
    }
    if (node != null && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith("$")) continue; // $description, $type, …
        walk(v, prefix ? `${prefix}.${k}` : k);
      }
    }
  };
  walk(root, "");
  return out;
}
