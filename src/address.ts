// baobab — the core: a component's identity is its content address.
//
//   address = sha256( tokens-used + template source + rendered markup + lone blessing )
//
// Fix four things and a component stops being an assertion and becomes an addressable
// fact: (1) the tokens a pinning slots, (2) the template structure, (3) the exact rendered
// instance, (4) lone's accessibility/semantic verdict on it. Change any one — a token
// value, the template, a prop, or the a11y outcome — and the address changes. "This exact
// component, themed this way, blessed clean" is then provable, not claimed.
//
// Extracted from spike/component-sha.ts (M2) + spike/with-pinning.ts (M3).

import { validate } from "@bounded-systems/lone";
import type { Element } from "@bounded-systems/lone";
import { parseHTML } from "linkedom";
import { encodeHex } from "@std/encoding/hex";

import type { Tokens } from "./tokens.ts";

/** Props passed to a component template (the per-instance, non-token inputs). */
export type Props = Record<string, unknown>;

/** A component's *structure*: a pure `(tokens, props) → markup` function. No defaults. */
export type Template = (tokens: Tokens, props: Props) => string;

/** A single accessibility/semantic finding, normalized from lone's verdict. */
export interface Finding {
  /** Stable rule code, e.g. `LONE_NAMEABLE_NAME_REQUIRED`. */
  code: string;
  /** `"error"` blocks blessing; `"warning"` / `"info"` do not. */
  severity: string;
  /** JSONPath into the validated subtree (`""` when lone reports none). */
  path: string;
}

/** The full content-address of one rendered, blessed component instance. */
export interface Address {
  /** SHA-256 hex over `{ tokens-used, template, rendered, blessing }`. */
  sha: string;
  /** `true` when lone reported no `error`-severity findings. */
  blessed: boolean;
  /** lone's raw findings for the blessed element. */
  findings: Finding[];
  /** The canonical, sorted findings that entered the digest. */
  blessing: Finding[];
  /** Only the tokens the template actually slotted (captured via a recording Proxy). */
  used: Tokens;
  /** The exact markup the template produced. */
  rendered: string;
}

const sortObj = (o: Tokens): Tokens =>
  Object.fromEntries(Object.entries(o).sort(([a], [b]) => (a < b ? -1 : 1)));

// deno-lint-ignore no-explicit-any -- lone's Finding carries extra fields we normalize away.
const toFinding = (f: any): Finding => ({
  code: String(f.code),
  severity: String(f.severity),
  path: f.path ?? "",
});

/**
 * Content-address one rendered component instance.
 *
 * Renders `template(tokens, props)`, runs lone over `blessSelector` (or the rendered
 * root element when omitted), and hashes `{ tokens-used, template source, rendered,
 * blessing }`. Only the tokens the template *reads* enter the address — so an unrelated
 * pinning change does not perturb a component that never slotted it.
 *
 * @param tokens   the flat slot map a pinning supplies (see {@link flattenTokens})
 * @param template the component structure, `(tokens, props) → markup`
 * @param props    the per-instance inputs
 * @param blessSelector CSS selector for the element lone judges; defaults to the
 *                       rendered root element
 */
export async function address(
  tokens: Tokens,
  template: Template,
  props: Props,
  blessSelector?: string,
): Promise<Address> {
  // Record exactly which tokens this render slots — only those enter the address.
  const used: Tokens = {};
  const proxy = new Proxy(tokens, {
    get(target, key) {
      if (typeof key === "string" && key in target) used[key] = target[key];
      return Reflect.get(target, key);
    },
  });
  const rendered = template(proxy as Tokens, props);

  // linkedom's parseHTML returns a DOM-shaped object; its nodes aren't typed as the global
  // `Element` lone's validator expects, so we narrow to the surface we use and cast.
  const { document } = parseHTML(
    `<!doctype html><body>${rendered}`,
  ) as unknown as { document: { querySelector(s: string): Element | null } };

  // Default to the rendered root element. linkedom's tree-walk accessors are unreliable for
  // a fragment, but tag-name querySelector is solid — so derive the root tag from the markup.
  const selector = blessSelector ?? rendered.match(/<\s*([a-zA-Z][\w-]*)/)?.[1];
  const el = selector ? document.querySelector(selector) : null;
  if (!el) {
    throw new Error(
      blessSelector
        ? `blessSelector "${blessSelector}" matched no element in the rendered markup`
        : "rendered markup produced no root element to bless",
    );
  }

  const { findings: raw } = await validate(el);
  const findings = raw.map(toFinding);
  const blessed = !findings.some((f) => f.severity === "error");

  // Canonical, stable encoding of the four identity inputs.
  const blessing = [...findings].sort((a, b) =>
    a.code + a.path < b.code + b.path ? -1 : 1
  );
  const material = new TextEncoder().encode(JSON.stringify({
    tokens: sortObj(used),
    template: template.toString(),
    rendered,
    blessing,
  }));
  const sha = encodeHex(
    new Uint8Array(await crypto.subtle.digest("SHA-256", material)),
  );

  return { sha, blessed, findings, blessing, used, rendered };
}
