# spike: component-sha (baobab M2)

Proves the core baobab claim end-to-end: **a component's identity is
`sha256(tokens + template + rendered + lone blessing)`** — so "this exact component,
themed this way, blessed clean" is a *provable, addressable* fact, not an assertion.

```
deno task spike
```

Takes one component (a token-driven `<button>`) and computes its content address four ways:

| variant | address | blessed | findings |
| --- | --- | --- | --- |
| labeled | `b213a242…` | true | 0 |
| re-run (same inputs) | `b213a242…` | true | 0 |
| radius token bumped | `65d1a7d1…` | true | 0 |
| label dropped | `d9bb1588…` | **false** | 1 |

…which demonstrates:

- **deterministic** — same inputs → identical address.
- **token-sensitive** — change a value the pinning supplies → new address.
- **blessing-sensitive** — break accessibility (drop the button's name) → lone finds it,
  `blessed` flips `true → false`, and the address changes.

It emits [`button.att.json`](./button.att.json), an in-toto Statement v1 whose `subject`
digest is the component address and whose `predicate` records the materials (tokens +
template + the lone version) and the blessing. The same in-toto/SLSA shape
robertdelanghe.dev signs for a whole build — here, for a single component.

`lone` is consumed from JSR (`jsr:@bounded-systems/lone@^0.1`); the tokens are inlined
(in the real system a *pinning* like `brand` owns them — baobab itself ships no defaults).

Next (M3+): drive `tokens` from a real pinning, generalize `address()` over a component
set, and sign the attestation in CI.
