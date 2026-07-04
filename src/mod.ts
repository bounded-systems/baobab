/**
 * # baobab — component addressing utilities (0.1)
 *
 * baobab is the *structure* of a design system — no defaults. This first publishable
 * version ships its proven core: **a component's identity is its content address.**
 *
 * ```
 * address = sha256( tokens-used + template source + rendered markup + lone blessing )
 * ```
 *
 * Fix the tokens a pinning slots, the template structure, the rendered instance, and
 * lone's accessibility verdict, and "this exact component, themed this way, blessed
 * clean" becomes a provable, addressable fact. Change any one and the address changes.
 *
 * @example Address a button, then attest it
 * ```ts
 * import { address, makeStatement } from "@bounded-systems/baobab";
 *
 * const tokens = { "radius.md": "8px", "color.fg": "#0C5A42", "size.touch": "44px" };
 * const button = (t, p) =>
 *   `<button type="button" style="border-radius:${t["radius.md"]};` +
 *   `min-inline-size:${t["size.touch"]};color:${t["color.fg"]}">${p.label ?? ""}</button>`;
 *
 * const a = await address(tokens, button, { label: "Search" }, "button");
 * a.sha;     // → "…"  the content address
 * a.blessed; // → true (lone found no errors)
 * a.used;    // → only the 3 tokens the template slotted
 *
 * const statement = makeStatement("button@brand", a);
 * ```
 *
 * @example Check a pinning's own contrast contract
 * ```ts
 * import { checkContrast, flattenTokens } from "@bounded-systems/baobab";
 *
 * const tokens = flattenTokens(pinningTokenTree); // a pinning supplies this
 * const results = checkContrast(tokens, [
 *   { fg: "color.on-accent", bg: "color.accent", min: 4.5, label: "text on fill" },
 * ]);
 * results[0].pass; // → true/false — baobab ships the check, the pinning owns the pairs
 * ```
 *
 * @module
 */

export { address } from "./address.ts";
export type { Address, Finding, Props, Template } from "./address.ts";

export { flattenTokens } from "./tokens.ts";
export type { Tokens } from "./tokens.ts";

export { checkContrast, contrastRatio, relativeLuminance } from "./contrast.ts";
export type { ContrastPair, ContrastResult } from "./contrast.ts";

export { BLESSING_ENGINE, makeStatement } from "./attestation.ts";
export type {
  ComponentMaterials,
  InTotoStatement,
  PinningInfo,
} from "./attestation.ts";
