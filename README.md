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

## Status

Seed. The structure is TBD — see [`docs/RFC.md`](docs/RFC.md) for the design and milestones.
