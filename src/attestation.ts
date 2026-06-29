// baobab — wrap a component address as an in-toto Statement v1.
//
// The address IS the subject digest: the statement says "this content-address (sha256 of
// tokens + template + rendered + lone blessing) is component <name>, blessed thus, from
// this pinning". Sign it keyless (GitHub OIDC → Sigstore) and a component's accessibility
// compliance is independently verifiable — the per-component analogue of a signed build
// provenance. Extracted from spike/component-sha.ts + spike/with-pinning.ts (M2/M3).

import type { Address, Finding } from "./address.ts";
import type { Tokens } from "./tokens.ts";

/** Optional pinning provenance — where the slotted token values came from. */
export interface PinningInfo {
  /** e.g. `"bdelanghe/brand"`. */
  repo?: string;
  /** Commit the pinning was read at (pins the values for reproducibility). */
  commit?: string;
  /** Direct URL to the token source. */
  url?: string;
}

/** The materials that, together with the blessing, define the subject digest. */
export interface ComponentMaterials {
  /** The tokens the component actually slotted. */
  tokens: Tokens;
  /** The exact rendered markup. */
  rendered: string;
  /** The blessing engine, e.g. `"jsr:@bounded-systems/lone"`. */
  blessingEngine: string;
  /** Where the token values came from (when known). */
  pinning?: PinningInfo;
}

/** An in-toto Statement v1 whose subject digest is a baobab component address. */
export interface InTotoStatement {
  _type: "https://in-toto.io/Statement/v1";
  subject: Array<{ name: string; digest: { sha256: string } }>;
  predicateType: "https://bounded-systems.github.io/baobab/component/v0";
  predicate: {
    materials: ComponentMaterials;
    blessing: { blessed: boolean; findings: Finding[] };
  };
}

/** The lone version this package addresses against (the blessing engine of record). */
export const BLESSING_ENGINE = "jsr:@bounded-systems/lone";

/**
 * Build an in-toto Statement v1 for a component address.
 *
 * The subject digest is the address `sha` — so verifying the statement verifies the exact
 * `(tokens, template, rendered, blessing)` tuple that produced it.
 *
 * @param name component identity, e.g. `"button@brand"`
 * @param address the result of {@link address}
 * @param pinning optional provenance for the slotted token values
 */
export function makeStatement(
  name: string,
  address: Address,
  pinning?: PinningInfo,
): InTotoStatement {
  return {
    _type: "https://in-toto.io/Statement/v1",
    subject: [{ name, digest: { sha256: address.sha } }],
    predicateType: "https://bounded-systems.github.io/baobab/component/v0",
    predicate: {
      materials: {
        tokens: address.used,
        rendered: address.rendered,
        blessingEngine: BLESSING_ENGINE,
        ...(pinning ? { pinning } : {}),
      },
      blessing: { blessed: address.blessed, findings: address.blessing },
    },
  };
}
