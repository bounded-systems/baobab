# spike: component-sha (baobab M2)

Proves the core baobab claim end-to-end: **a component's identity is
`sha256(tokens + template + rendered + lone blessing)`** — so "this exact
component, themed this way, blessed clean" is a _provable, addressable_ fact,
not an assertion.

```
deno task spike
```

Takes one component (a token-driven `<button>`) and computes its content address
four ways:

| variant              | address     | blessed   | findings |
| -------------------- | ----------- | --------- | -------- |
| labeled              | `b213a242…` | true      | 0        |
| re-run (same inputs) | `b213a242…` | true      | 0        |
| radius token bumped  | `65d1a7d1…` | true      | 0        |
| label dropped        | `d9bb1588…` | **false** | 1        |

…which demonstrates:

- **deterministic** — same inputs → identical address.
- **token-sensitive** — change a value the pinning supplies → new address.
- **blessing-sensitive** — break accessibility (drop the button's name) → lone
  finds it, `blessed` flips `true → false`, and the address changes.

It emits [`button.att.json`](./button.att.json), an in-toto Statement v1 whose
`subject` digest is the component address and whose `predicate` records the
materials (tokens + template + the lone version) and the blessing. The same
in-toto/SLSA shape robertdelanghe.dev signs for a whole build — here, for a
single component.

`lone` is consumed from JSR (`jsr:@bounded-systems/lone@^0.1`); the tokens are
inlined (in the real system a _pinning_ like `brand` owns them — baobab itself
ships no defaults).

---

# spike: with-pinning (baobab M3)

Takes the two steps M2 deferred: **consume a real pinning** and **generalize
`address()` over a component _set_.** Same identity claim, no longer a toy.

```
deno task spike:pinning
```

**The pinning is real, not inlined.** It loads `bdelanghe/brand`'s
[`tokens/tokens.json`](https://github.com/bdelanghe/brand/blob/main/tokens/tokens.json)
(W3C design-tokens format), pinned by commit, then:

1. **resolves the W3C aliases** — `{primitive.green-700}` → `#0C5A42`,
   recursively (colors alias primitives; `text.*` typography aliases
   `font.*`/`size.*`), and
2. **flattens** the tiers to a slot map the templates read:
   `{ "color.forest": "#0C5A42", "radius.radius-md": "12px", "font.display": "Space Grotesk, sans-serif", … }`.

baobab still ships zero defaults — every value comes from the pinning.

**`address()` is generalized over a component set.** Three text-based,
token-driven components, each blessing the right element and recording **only
the tokens it actually slots** (captured via a recording `Proxy`, so
"tokens-used" — not the whole pinning — enters the address):

| component       | lone blesses  | good props                    | breaks when…                           |
| --------------- | ------------- | ----------------------------- | -------------------------------------- |
| `button`        | `<button>`    | visible text label            | label dropped → unnamed button         |
| `link-button`   | `<a>`         | text + `href`                 | link text dropped → unnamed link       |
| `labeled-input` | `<div>` field | `<label for>`/`id` associated | association broken → unlabeled control |

Each component reproduces the three M2 properties from the brand pinning —
deterministic, token-sensitive (bump a brand token → new address),
blessing-sensitive (remove an a11y prop → lone flags it, `blessed` flips
`true → false`, address changes) — and emits a per-component in-toto Statement
v1 to [`spike/att/`](./att/) (`materials` now also records the `pinning` repo +
commit). The spike is a gate: it exits non-zero if any canonical component fails
to bless.

`brand` : `baobab` :: `data/*.json` : `contract/*.schema.json` — the
structure-vs-pinning split the RFC names, now exercised end-to-end across a set.

---

# signing in CI (baobab M4)

M2/M3 _emit_ the in-toto Statements; M4 **signs** them, so each component
attestation is independently verifiable — a per-component analogue of
robertdelanghe.dev's signed `/provenance`, over the same GitHub OIDC → Sigstore
path `bounded-systems/lone` uses to publish to JSR.

[`.github/workflows/attest.yml`](../.github/workflows/attest.yml) runs on push to
`main` (paths `spike/**`) and `workflow_dispatch`. It checks out, sets up Deno,
re-runs `deno task spike` + `deno task spike:pinning` to emit the attestations,
then **keyless-signs each `*.att.json` with cosign** and uploads the
`att.json` + `.sig` + `.crt` as a build artifact.

**Keyless OIDC — no long-lived keys.** The job requests `id-token: write`. cosign
exchanges the ambient GitHub Actions OIDC token at **Fulcio** for a short-lived
(~10 min) signing certificate bound to the workflow identity
(`https://github.com/bounded-systems/baobab/.github/workflows/attest.yml@refs/heads/main`,
issuer `https://token.actions.githubusercontent.com`), signs the blob, and logs
the signature + certificate in the **Rekor** transparency log. The private key
never persists.

**Why `cosign sign-blob` and not `actions/attest`.** The spike already emits a
complete in-toto Statement v1 whose `subject` digest is a _synthetic
content-address_ — `sha256(tokens + template + rendered + blessing)`, not the
hash of a file on disk. GitHub's native attestation API is keyed by, and verified
against, a real artifact digest, so it doesn't map to a synthetic subject.
Signing the Statement as a blob preserves it byte-for-byte and keeps verification
self-contained.

**Verify** (download the artifact, then):

```sh
cosign verify-blob \
  --certificate        spike/att/button.att.json.crt \
  --signature          spike/att/button.att.json.sig \
  --certificate-identity-regexp '^https://github.com/bounded-systems/baobab/\.github/workflows/attest\.yml@.*' \
  --certificate-oidc-issuer https://token.actions.githubusercontent.com \
  spike/att/button.att.json
```

**Trust chain.** `att.json` bytes → cosign signature → Fulcio leaf cert (identity
= the workflow) → Fulcio root (Sigstore TUF roots) + Rekor inclusion proof.
Verifying re-derives the digest of `att.json`, checks the signature against the
cert, that the cert chains to Fulcio and matches the expected workflow identity,
and that the entry is in Rekor — so "this exact component Statement was produced
and signed by this repo's CI" becomes a checkable fact, not an assertion.

> **Verified vs. not.** Locally verified: the Deno tasks run and re-emit the
> committed attestation bytes deterministically (clean `git status`), and the
> workflow YAML parses. **Keyless signing cannot run locally** — it needs the
> GitHub Actions OIDC environment (Fulcio won't issue a cert without that
> ambient token). CI is the first real signing.
