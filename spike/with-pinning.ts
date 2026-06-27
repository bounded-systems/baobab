// baobab spike (M3) — consume a REAL pinning, address a SET of components.
//
// M2 (component-sha.ts) proved the core claim with INLINE tokens for one <button>:
//   a component's identity = sha256(tokens + template + rendered + lone blessing).
//
// M3 takes the two next steps the RFC calls for:
//   1. tokens come from a *real pinning* — `bdelanghe/brand`'s W3C design-tokens file
//      (`tokens/tokens.json`), pinned by commit. baobab ships no defaults; the pinning
//      supplies every value. We RESOLVE the W3C aliases (`{primitive.green-700}` →
//      `#0C5A42`, recursively) and FLATTEN to a slot map the templates read.
//   2. `address()` is generalized over a *component set* — each component declares its
//      template (structure) + the element lone blesses. Only the tokens a component
//      actually slots ("tokens-used", captured via a recording Proxy) enter its address.
//
// For every component we show the same three properties M2 showed for the button:
//   deterministic · token-sensitive · blessing-sensitive — and emit a per-component
//   in-toto Statement v1 attestation (the M2 shape, one per component).
//
// Run: deno task spike:pinning

import { validate } from "@bounded-systems/lone";
import { parseHTML } from "linkedom";
import { encodeHex } from "@std/encoding/hex";

// ── the pinning ────────────────────────────────────────────────────────────
// brand is baobab's exact pinning. Pinned by commit so the spike is deterministic;
// the values are the *real* ones, not inlined. baobab itself ships zero defaults.
const BRAND_REPO = "bdelanghe/brand";
const BRAND_COMMIT = "2796ce547318909079bbb42093986efa809942f4";
const BRAND_TOKENS_URL =
  `https://raw.githubusercontent.com/${BRAND_REPO}/${BRAND_COMMIT}/tokens/tokens.json`;

// ── W3C design-tokens: resolve aliases + flatten ─────────────────────────────
// deno-lint-ignore no-explicit-any
type Json = any;
type Tokens = Record<string, string>;

const ALIAS = /^\{(.+)\}$/;
const isLeaf = (n: Json) => n && typeof n === "object" && "$value" in n;

/** Look up a leaf by dot-path (e.g. "primitive.green-700") in the raw token tree. */
function lookup(root: Json, path: string): Json {
  let node: Json = root;
  for (const seg of path.split(".")) node = node?.[seg];
  if (!isLeaf(node)) throw new Error(`alias target is not a token: {${path}}`);
  return node;
}

/** Resolve a `$value` to a concrete value, chasing `{alias}` references recursively. */
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
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value).map((
        [k, v],
      ) => [k, resolve(root, v, new Set(seen))]),
    );
  }
  return value;
}

/** Render a resolved value as a CSS-ready string (arrays → font stack). */
function css(value: Json): string {
  if (Array.isArray(value)) return value.join(", ");
  if (value && typeof value === "object") return JSON.stringify(value);
  return String(value);
}

/** Flatten the token tree to `{ "color.forest": "#0C5A42", ... }` with aliases resolved. */
function flatten(root: Json): Tokens {
  const out: Tokens = {};
  const walk = (node: Json, prefix: string) => {
    if (isLeaf(node)) {
      out[prefix] = css(resolve(root, node.$value));
      return;
    }
    if (node && typeof node === "object") {
      for (const [k, v] of Object.entries(node)) {
        if (k.startsWith("$")) continue; // $description etc.
        walk(v, prefix ? `${prefix}.${k}` : k);
      }
    }
  };
  walk(root, "");
  return out;
}

// ── the component set ────────────────────────────────────────────────────────
// Each is structure-only: a pure (tokens, props) -> html that *slots* brand tokens.
// `bless` is the element lone judges. `good` props bless clean; `bad` breaks one a11y
// affordance so the blessing — and the address — flips.
type Props = Record<string, unknown>;
type Template = (t: Tokens, p: Props) => string;
interface Component {
  name: string;
  bless: string; // selector for the element lone validates
  template: Template;
  good: Props;
  bad: Props; // one a11y prop removed
  badNote: string;
  bumpToken: string; // a token this component slots; bumping it must change the address
}

const components: Component[] = [
  {
    name: "button",
    bless: "button",
    bumpToken: "radius.radius-md",
    template: (t, p) =>
      `<button type="button" style="` +
      `background:${t["color.forest"]};color:${t["color.white"]};border:0;` +
      `border-radius:${t["radius.radius-md"]};font-family:${
        t["font.display"]
      };` +
      `font-size:${t["size.text-body"]};padding:10px 16px">${
        p.label ?? ""
      }</button>`,
    good: { label: "Search" },
    bad: { label: "" }, // no visible text → unnamed button
    badNote: "label dropped",
  },
  {
    name: "link-button",
    bless: "a",
    bumpToken: "color.forest",
    template: (t, p) =>
      `<a href="${p.href ?? "#"}" style="` +
      `color:${t["color.forest"]};border:1px solid ${t["color.line"]};` +
      `border-radius:${t["radius.radius-md"]};font-family:${
        t["font.display"]
      };` +
      `font-size:${
        t["size.text-body"]
      };padding:10px 16px;text-decoration:none">` +
      `${p.label ?? ""}</a>`,
    good: { label: "View profile", href: "/me" },
    bad: { label: "", href: "/me" }, // no link text → unnamed link
    badNote: "link text dropped",
  },
  {
    name: "labeled-input",
    bless: "div", // the field wrapper: lone resolves <label for> within the subtree
    bumpToken: "radius.radius-md",
    template: (t, p) =>
      `<div style="font-family:${t["font.display"]}">` +
      `<label for="${p.id}" style="color:${t["color.ink-mono"]};` +
      `font-size:${t["size.text-label"]}">${p.labelText ?? ""}</label>` +
      `<input${p.associate ? ` id="${p.id}"` : ``} type="${
        p.type ?? "text"
      }" style="` +
      `border:1px solid ${t["color.line"]};border-radius:${
        t["radius.radius-md"]
      };` +
      `color:${t["color.ink"]};font-size:${
        t["size.text-body"]
      };padding:8px 10px"></div>`,
    good: { id: "email", labelText: "Email", type: "email", associate: true },
    bad: { id: "email", labelText: "Email", type: "email", associate: false }, // for/id broken
    badNote: "label association broken",
  },
];

// ── generalized address() ────────────────────────────────────────────────────
type Finding = { code: string; severity: string; path?: string };
interface Address {
  sha: string;
  blessed: boolean;
  findings: Finding[];
  blessing: Finding[];
  used: Tokens;
  rendered: string;
}

const sortObj = (o: Tokens): Tokens =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));

/** Content-address one rendered, blessed component instance from the brand pinning. */
async function address(
  flat: Tokens,
  c: Component,
  props: Props,
): Promise<Address> {
  // record exactly which tokens this render slots — only those enter the address.
  const used: Tokens = {};
  const proxy = new Proxy(flat, {
    get(target, key) {
      if (typeof key === "string" && key in target) used[key] = target[key];
      return Reflect.get(target, key);
    },
  });
  const rendered = c.template(proxy as Tokens, props);

  const { document } = parseHTML(`<!doctype html><body>${rendered}`);
  const el = document.querySelector(c.bless)!;
  const { findings } = await validate(el) as { findings: Finding[] };
  const blessed = !findings.some((f) => f.severity === "error");

  const blessing = findings
    .map((f) => ({ code: f.code, severity: f.severity, path: f.path ?? "" }))
    .sort((a, b) => (a.code + a.path < b.code + b.path ? -1 : 1));

  const material = new TextEncoder().encode(JSON.stringify({
    tokens: sortObj(used), // tokens-used, not the whole pinning
    template: c.template.toString(),
    rendered,
    blessing,
  }));
  const sha = encodeHex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", material)),
  );
  return { sha, blessed, findings, blessing, used, rendered };
}

// ── run the set ──────────────────────────────────────────────────────────────
const raw = await (await fetch(BRAND_TOKENS_URL)).json();
const flat = flatten(raw);
console.log(
  `pinning: ${BRAND_REPO}@${BRAND_COMMIT.slice(0, 7)} · ${
    Object.keys(flat).length
  } tokens resolved`,
);
console.log(
  `  e.g. color.forest=${flat["color.forest"]}  radius.radius-md=${
    flat["radius.radius-md"]
  }  font.display=${flat["font.display"]}\n`,
);

await Deno.mkdir("spike/att", { recursive: true });

const W = 28;
const row = (k: string, r: Address) =>
  `  ${k.padEnd(W)} ${r.sha.slice(0, 16)}…  blessed=${
    String(r.blessed).padEnd(5)
  } findings=${r.findings.length}`;

let allGoodBless = true;
const summary: string[] = [];

for (const c of components) {
  console.log(`■ ${c.name}  (lone blesses <${c.bless}>)`);

  const good = await address(flat, c, c.good);
  const rerun = await address(flat, c, c.good); // same inputs
  const bumped = await address({ ...flat, [c.bumpToken]: "1px" }, c, c.good); // pinning edit
  const broken = await address(flat, c, c.bad); // a11y prop removed

  console.log(row("good (from brand)", good));
  console.log(row("re-run (must equal)", rerun));
  console.log(row(`${c.bumpToken} bumped`, bumped));
  console.log(row(c.badNote, broken));

  const deterministic = good.sha === rerun.sha;
  const tokenSensitive = good.sha !== bumped.sha;
  const blessingSensitive = good.sha !== broken.sha && good.blessed &&
    !broken.blessed;
  console.log(
    `    deterministic ${deterministic ? "✓" : "✗"}  ` +
      `token-sensitive ${tokenSensitive ? "✓" : "✗"}  ` +
      `blessing-sensitive ${blessingSensitive ? "✓" : "✗"} ` +
      `(blessed ${good.blessed}→${broken.blessed})\n`,
  );

  allGoodBless &&= good.blessed;
  summary.push(
    `${c.name.padEnd(15)} ${good.sha.slice(0, 12)}…  det=${
      deterministic ? "✓" : "✗"
    } ` +
      `tok=${tokenSensitive ? "✓" : "✗"} bless=${
        blessingSensitive ? "✓" : "✗"
      } ` +
      `(${Object.keys(good.used).length} tokens used)`,
  );

  // per-component in-toto attestation — the M2 shape, one per component.
  const attestation = {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name: `${c.name}@brand`, digest: { sha256: good.sha } }],
    predicateType: "https://bounded-systems.github.io/baobab/component/v0",
    predicate: {
      materials: {
        pinning: {
          repo: BRAND_REPO,
          commit: BRAND_COMMIT,
          url: BRAND_TOKENS_URL,
        },
        tokens: sortObj(good.used),
        template: c.template.toString(),
        blessingEngine: "jsr:@bounded-systems/lone@^0.1",
      },
      blessing: { blessed: good.blessed, findings: good.blessing },
    },
  };
  await Deno.writeTextFile(
    `spike/att/${c.name}.att.json`,
    JSON.stringify(attestation, null, 2) + "\n",
  );
}

console.log("── summary ──────────────────────────────────────────────");
for (const s of summary) console.log(s);
console.log(
  `\nwrote spike/att/{${components.map((c) => c.name).join(",")}}.att.json`,
);

// The spike is a gate: a canonical component that won't bless gets no address.
if (!allGoodBless) {
  console.error("\n✗ a canonical component failed to bless — no address.");
  Deno.exit(1);
}
console.log(
  "\n✓ every canonical component blessed clean from the brand pinning.",
);
