// baobab — contrast contract (no defaults).
//
// A pinning's semantic tokens don't just need values — pairs of them (typically a
// foreground role and the background role it's meant to sit on, e.g. an "on-X" role
// against X) need to stay legible together. baobab declares the *shape* of that
// check: the relationship (contrastRatio, checkContrast), not which token paths
// pair up or what ratio they must clear. A pinning owns its own contract, since
// only the pinning knows its own semantic vocabulary.

import type { Tokens } from "./tokens.ts";

/** One relationship a pinning wants held: a foreground/background token pair and the ratio they must clear. */
export interface ContrastPair {
  /** Flattened token path for the foreground/text color, e.g. `"color.on-accent"`. */
  fg: string;
  /** Flattened token path for the background/surface color, e.g. `"color.accent"`. */
  bg: string;
  /** Minimum WCAG contrast ratio this pair must clear (4.5 = AA normal text, 3 = AA large text/UI, 7 = AAA). */
  min: number;
  /** Optional human label for reporting, e.g. `"primary button text on fill"`. */
  label?: string;
}

/** A checked pair: the contract plus its measured ratio and verdict. */
export interface ContrastResult extends ContrastPair {
  ratio: number;
  pass: boolean;
}

function hexToLinear(hex: string): [number, number, number] {
  const n = hex.replace("#", "");
  const full = n.length === 3 ? [...n].map((c) => c + c).join("") : n;
  if (!/^[0-9a-fA-F]{6}$/.test(full)) {
    throw new Error(`not a hex color: ${hex}`);
  }
  const chans = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16) / 255);
  const lin = (
    c: number,
  ) => (c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
  return chans.map(lin) as [number, number, number];
}

/** WCAG 2.x relative luminance of an sRGB hex color (`#RGB` or `#RRGGBB`). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToLinear(hex);
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two sRGB hex colors. Order-independent — always ≥ 1. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a);
  const lb = relativeLuminance(b);
  const [lighter, darker] = la >= lb ? [la, lb] : [lb, la];
  return (lighter + 0.05) / (darker + 0.05);
}

/**
 * Check a pinning's resolved tokens against its own contrast contract.
 *
 * baobab ships zero pairs and zero thresholds — a pinning supplies both, since
 * only the pinning knows its own semantic vocabulary and which pairs actually
 * matter to it. This is the token-level counterpart to `address()`'s
 * component-level `lone` blessing: same "prove it, don't assert it" discipline,
 * one level down, and it doesn't need a component or a template to run.
 *
 * @param tokens a flattened token slot map (from `flattenTokens`)
 * @param pairs the pinning's own contract: which token paths pair up, and the
 *   minimum ratio each pair must clear
 * @throws if a pair references a token path that isn't in `tokens`
 */
export function checkContrast(
  tokens: Tokens,
  pairs: readonly ContrastPair[],
): ContrastResult[] {
  return pairs.map((pair) => {
    const fg = tokens[pair.fg];
    const bg = tokens[pair.bg];
    if (fg == null) {
      throw new Error(`contrast pair references unknown token: "${pair.fg}"`);
    }
    if (bg == null) {
      throw new Error(`contrast pair references unknown token: "${pair.bg}"`);
    }
    const ratio = contrastRatio(fg, bg);
    return { ...pair, ratio, pass: ratio >= pair.min };
  });
}
