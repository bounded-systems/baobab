# RFC: baobab — a content-addressed, accessibility-verified design system

**Status:** draft · **Date:** 2026-06-26 · **Owner:** Robert DeLanghe / Bounded Systems

## Summary

Push the in-toto/SLSA provenance discipline that robertdelanghe.dev applies to *the whole
site* down to *each component*. **baobab** is the design-system **structure** — no
defaults. A **pinning** (e.g. `brand`) supplies the values. Each component is configurable
(token-driven), accessibility-verified (blessed by `lone`), and **content-addressed**
(a signed sha over its inputs + blessing). Accessibility compliance becomes *proven and
addressable*, not asserted.

## Naming

- **`lone`** — the lone tree = the **accessibility tree**. The per-component spec engine:
  untrusted DOM → typed `Blessed<T>` / `Finding[]` across a stable contract boundary.
  Shipped on JSR (`@bounded-systems/lone`), pinned by `deno.lock`.
- **`baobab`** — the *species each component is*. A baobab stands alone, long-lived,
  self-watering: a component that stands on its own — its own sha, its own blessing, no
  dependence on the surrounding page ("canopy").

## Structure vs. pinning (the core split)

baobab holds **structure, no defaults**. A concrete value belongs to a pinning.

```
baobab    structure              token structure · component structure · lone spec
  └─ brand    exact pinning       the token-and-such SET (BS colors, fonts, mark)
```

Same shape as `contract/*.schema.json : data/*.json`. baobab : brand :: schema : data.

## The layers

```
tokens (structure)  ── baobab: the W3C token *shape*; a pinning fills the values
      │
      ▼
baobab component    ── structure (template + token slots); a pinning themes it
      │
      ▼
lone blessing       ── Blessed<T> + Finding[]; the a11y/semantic contract, per component
      │
      ▼
component sha       ── hash(token-config + template + lone blessing) → signed attestation
```

`materials` = (token config, template, `lone`@version) · `process` = lone blessing ·
`subject` = the component, hashed · `attestation` = signed. The site build's shape, one
level down.

## Milestones

- **M1 — lone on JSR.** ✅ `@bounded-systems/lone@0.1.0` published; consumers import
  `jsr:@bounded-systems/lone` pinned by `deno.lock` (robertdelanghe.dev gate switched).
- **M2 — component-sha spike.** One component end-to-end:
  `hash(template + token-config + lone blessing)` → signed attestation.
- **M3 — extract baobab from brand.** Move the *structure* out of `brand` into baobab;
  `brand` becomes baobab's exact pinning (values only). No defaults land in baobab.
- **M4 — per-component provenance.** Attest the whole set; a per-component analogue of
  robertdelanghe.dev's `/provenance`.

## Open decisions

1. Token-structure format: extend the W3C Design Tokens spec, or a baobab schema over it?
2. Component model: framework-agnostic templates, or web components?
3. Attestation signing-key story for component shas (reuse the site's, or a baobab key?).
