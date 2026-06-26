// baobab spike (M2) — a component's identity is hash(tokens + template + lone blessing).
//
// A baobab component has no fixed identity until three things are fixed:
//   1. tokens   — the values a *pinning* (e.g. brand) supplies
//   2. template — the *structure*: a pure function (tokens, props) -> markup
//   3. blessing — lone's accessibility/semantic verdict on the rendered DOM
//
// Its content address = sha256 over a canonical encoding of (tokens, template, rendered,
// blessing). Change any one — a token value, the template, the rendered instance, or the
// a11y outcome — and the address changes. So "this exact component, themed this way,
// blessed clean" becomes a provable, addressable fact instead of an assertion. Same
// in-toto/SLSA discipline robertdelanghe.dev applies to a whole build — one level down.
//
// Run: deno task spike

import { validate } from "@bounded-systems/lone";
import { parseHTML } from "linkedom";
import { encodeHex } from "@std/encoding/hex";

type Tokens = Record<string, string>;
type Props = { label?: string };
type Template = (t: Tokens, p: Props) => string;

// 2. template — structure with token slots. Its source is hashed verbatim. The button's
// accessible name is its text label; drop the label and lone flags it (unnamed button) —
// the blessing, and so the address, change.
const button: Template = (t, p) =>
  `<button type="button"` +
  ` style="border-radius:${t["radius.md"]};min-inline-size:${t["size.touch"]};color:${t["color.fg"]}">` +
  `${p.label ?? ""}</button>`;

/** The full content-address of one rendered, blessed component instance. */
async function address(tokens: Tokens, template: Template, props: Props) {
  const rendered = template(tokens, props);
  const { document } = parseHTML(`<!doctype html><body>${rendered}`);
  const el = document.querySelector("button")!;
  const { findings } = await validate(el);
  const blessed = !findings.some((f: { severity: string }) => f.severity === "error");

  // canonical, stable encoding of the four identity inputs
  const sortObj = (o: Tokens) =>
    Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));
  const blessing = findings
    .map((f: { code: string; severity: string; path?: string }) =>
      ({ code: f.code, severity: f.severity, path: f.path ?? "" }))
    .sort((a, b) => (a.code + a.path < b.code + b.path ? -1 : 1));
  const material = new TextEncoder().encode(JSON.stringify({
    tokens: sortObj(tokens),
    template: template.toString(),
    rendered,
    blessing,
  }));
  const sha = encodeHex(new Uint8Array(await crypto.subtle.digest("SHA-256", material)));
  return { sha, blessed, findings, blessing };
}

// A pinning supplies these (inline here; in the real system, brand owns them).
const tokens: Tokens = { "color.fg": "#0C5A42", "radius.md": "8px", "size.touch": "44px" };

const a = await address(tokens, button, { label: "Search" });
const a2 = await address(tokens, button, { label: "Search" }); // re-run, same inputs
const b = await address({ ...tokens, "radius.md": "9999px" }, button, { label: "Search" }); // token edit
const c = await address(tokens, button, {}); // drop the accessible name

const row = (k: string, r: typeof a) =>
  `${k.padEnd(30)} ${r.sha.slice(0, 16)}…  blessed=${String(r.blessed).padEnd(5)} findings=${r.findings.length}`;
console.log(row("button (labeled)", a));
console.log(row("  re-run (must equal above)", a2));
console.log(row("  radius token bumped", b));
console.log(row("  label dropped", c));

console.log(`\ndeterministic:       ${a.sha === a2.sha ? "✓ identical address" : "✗ MISMATCH"}`);
console.log(`token-sensitive:     ${a.sha !== b.sha ? "✓ address changed on token edit" : "✗ collision"}`);
console.log(`blessing-sensitive:  ${a.sha !== c.sha ? "✓ address changed when a11y changed" : "✗ collision"}` +
  `  (blessed ${a.blessed} → ${c.blessed}, +${c.findings.length - a.findings.length} finding)`);

// Emit an in-toto-style attestation for the blessed instance — the provable artifact.
const attestation = {
  _type: "https://in-toto.io/Statement/v1",
  subject: [{ name: "button@search", digest: { sha256: a.sha } }],
  predicateType: "https://bounded-systems.github.io/baobab/component/v0",
  predicate: {
    materials: {
      tokens,
      template: button.toString(),
      blessingEngine: "jsr:@bounded-systems/lone@^0.1",
    },
    blessing: { blessed: a.blessed, findings: a.blessing },
  },
};
await Deno.writeTextFile("spike/button.att.json", JSON.stringify(attestation, null, 2) + "\n");
console.log("\nwrote spike/button.att.json (sample component attestation)");

// The spike is itself a gate: a component that won't bless shouldn't get an address.
Deno.exit(a.blessed ? 0 : 1);
