# baobab

A baobab stands alone — long-lived, self-watering, needs no canopy. So does a *baobab
component*: it carries its own structure and its own accessibility contract, independent
of the page around it.

**baobab is the _structure_ of a design system — no defaults.** It defines the *shape*:
the token structure, the component structure, and the per-component accessibility spec.
It ships **zero concrete values**. A concrete design system is baobab + a value set:

```
baobab    structure, no defaults          the contract / shape
  └─ brand    baobab's exact pinning       the token-and-such SET (Bounded Systems' colors, fonts, mark)
lone      per-component a11y spec engine   jsr:@bounded-systems/lone
```

It's the same split this ecosystem already runs on — structure vs. pinning:

| structure (no defaults) | pinning (the values) |
| --- | --- |
| `contract/*.schema.json` | `data/*.json` |
| **baobab** | **brand** |

## Layers

- **Tokens** — baobab declares the token *structure* (the W3C design-token shape);
  a pinning (brand) fills it with values. No color, no size, no font lives in baobab.
- **Components** — baobab declares component *structure*; a pinning themes it via tokens.
- **lone** — each component carries its expected `Blessed<T>` — its semantic/accessibility
  contract. `lone` blesses the rendered subtree against it (consumed from JSR, pinned by
  `deno.lock`).
- **Component sha** — a component's identity is `hash(token-config + template + lone
  blessing)`, signed. Accessibility compliance becomes *proven and addressable*, not
  asserted — the same in-toto/SLSA discipline robertdelanghe.dev applies to a whole build,
  pushed down to a single component.

## Invariant

No defaults will ever live here. A concrete value belongs to a *pinning* (e.g. `brand`),
never to the structure. If a PR adds a color, a size, or a font to baobab, it's in the
wrong repo.

## baobab 0.1 — component addressing utilities

The first publishable version ships baobab's proven core: **a component's identity is its
content address.**

```
address = sha256( tokens-used + template source + rendered markup + lone blessing )
```

Fix the tokens a pinning slots, the template structure, the rendered instance, and lone's
accessibility verdict, and *"this exact component, themed this way, blessed clean"* becomes
a provable, addressable fact. Change any one — a token value, the template, a prop, or the
a11y outcome — and the address changes.

```ts
import { address, makeStatement } from "@bounded-systems/baobab";

// A pinning (e.g. brand) supplies these. baobab ships zero values.
const tokens = { "radius.md": "8px", "color.fg": "#0C5A42", "size.touch": "44px" };

// A component is structure only: a pure (tokens, props) -> markup function.
const button = (t, p) =>
  `<button type="button" style="border-radius:${t["radius.md"]};` +
  `min-inline-size:${t["size.touch"]};color:${t["color.fg"]}">${p.label ?? ""}</button>`;

const a = await address(tokens, button, { label: "Search" }, "button");
a.sha;     // → the content address (sha256 hex)
a.blessed; // → true  (lone found no error-severity findings)
a.used;    // → only the 3 tokens the template actually slotted

// Drop the label → lone flags an unnamed button → the address moves.
const b = await address(tokens, button, {}, "button");
a.sha === b.sha; // → false   (blessing-sensitive)

// Wrap the address as an in-toto Statement v1 (subject digest = the address).
const statement = makeStatement("button@brand", a, { repo: "bdelanghe/brand" });
```

### API

| export | what it does |
| --- | --- |
| `address(tokens, template, props, blessSelector?)` | render → bless → `sha256(tokens-used + template + rendered + blessing)`; returns `{ sha, blessed, findings, blessing, used, rendered }` |
| `flattenTokens(root)` | resolve W3C design-token `{alias}` references and flatten to a `{ "color.forest": "#0C5A42" }` slot map |
| `makeStatement(name, address, pinning?)` | wrap an address as an in-toto Statement v1 whose subject digest **is** the address |
| `checkContrast(tokens, pairs)` | check a pinning's own token pairs against its own WCAG thresholds; returns `{ ...pair, ratio, pass }[]` |
| `contrastRatio(hexA, hexB)` / `relativeLuminance(hex)` | WCAG 2.x contrast math, order-independent, no dependency |
| types | `Tokens`, `Props`, `Template`, `Finding`, `Address`, `InTotoStatement`, `PinningInfo`, `ComponentMaterials`, `ContrastPair`, `ContrastResult` |

Blessing is delegated to [`jsr:@bounded-systems/lone`](https://jsr.io/@bounded-systems/lone),
pinned by `deno.lock`. The proofs the package guarantees — **deterministic · token-sensitive ·
blessing-sensitive** — are enforced as a CI gate (`deno task ci`).

The original spikes (`spike/component-sha.ts`, `spike/with-pinning.ts`) remain in-repo as
worked examples (the M3 spike addresses a real component set against the `brand` pinning);
they are excluded from the published JSR distribution.

## Token-level contrast (0.2)

`address()`'s `lone` blessing proves a *rendered component* is accessible — but nothing
checked whether a pinning's token *values* were even legible together in the first place.
`checkContrast` is the token-level counterpart, one level down: same "prove it, don't
assert it" discipline, but it doesn't need a component or a template to run.

```ts
import { checkContrast, flattenTokens } from "@bounded-systems/baobab";

const tokens = flattenTokens(pinningTokenTree); // a pinning supplies this
const results = checkContrast(tokens, [
  // a pinning supplies its own pairs + thresholds — baobab ships neither
  { fg: "color.on-accent", bg: "color.accent", min: 4.5, label: "text on fill" },
]);
results[0].pass; // → true/false
```

A pinning shouldn't need to hand-write the load-tokens/load-contract/report glue either —
`cli/check-contrast.ts` is that glue, runnable directly:

```sh
deno run --allow-read jsr:@bounded-systems/baobab/cli/check-contrast \
  --tokens tokens/tokens.json --contract tokens/contrast.contract.json
```

...or as a reusable GitHub Actions workflow, so a pinning's own CI is one `uses:` line:

```yaml
jobs:
  check-contrast:
    uses: bounded-systems/baobab/.github/workflows/check-contrast.yml@main
    with:
      tokens-path: tokens/tokens.json
      contract-path: tokens/contrast.contract.json
```

`contrast.contract.json` is a plain `ContrastPair[]` — the pinning's own list of which
token paths pair up and what WCAG ratio each must clear:

```json
[
  { "fg": "color.on-accent", "bg": "color.accent", "min": 4.5, "label": "text on fill" }
]
```

### Roadmap

- **0.1 — addressing utilities** (this release): the core `address()` + tokens + in-toto.
- **0.2 — component framework**: a first-class `Component` (template + bless target +
  token contract), component-set addressing, and the brand pinning as a consumable.
- **0.3 — contract layer**: per-component `Blessed<T>` specs as declared contracts, so a
  component declares the accessibility shape it must meet, not just the verdict it got.

## Status

0.2 — component addressing utilities + token-level contrast contract (published to JSR).
See [`docs/RFC.md`](docs/RFC.md) for the full design and milestones.
