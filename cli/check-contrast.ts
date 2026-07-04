#!/usr/bin/env -S deno run --allow-read
// baobab CLI — the downstream-usable half of checkContrast.
//
// Every pinning needs the same three steps (load tokens, load its own contract,
// run checkContrast, report) — that glue doesn't belong hand-written in each
// pinning's repo any more than the ratio math does. This CLI is that glue;
// bounded-systems/baobab's check-contrast.yml reusable workflow wraps it for
// GitHub Actions callers, but it also runs standalone for local/other-CI use:
//
//   deno run --allow-read jsr:@bounded-systems/baobab/cli/check-contrast \
//     --tokens tokens/tokens.json --contract tokens/contrast.contract.json
//
// tokens.json is a raw W3C design-token tree (flattened here via flattenTokens).
// contrast.contract.json is a JSON array of ContrastPair: the pinning's own list
// of which token paths pair up and what ratio each must clear — baobab ships
// neither the tokens nor the contract, only this runner.
import { checkContrast, type ContrastPair, flattenTokens } from "../src/mod.ts";

function arg(name: string): string {
  const flag = `--${name}`;
  const i = Deno.args.indexOf(flag);
  if (i === -1 || i + 1 >= Deno.args.length) {
    console.error(`missing required flag: ${flag} <path>`);
    Deno.exit(2);
  }
  return Deno.args[i + 1];
}

const tokensPath = arg("tokens");
const contractPath = arg("contract");

const tokenTree = JSON.parse(await Deno.readTextFile(tokensPath));
const contract: ContrastPair[] = JSON.parse(
  await Deno.readTextFile(contractPath),
);

const tokens = flattenTokens(tokenTree);
const results = checkContrast(tokens, contract);

let bad = 0;
for (const r of results) {
  const label = r.label ? ` (${r.label})` : "";
  if (r.pass) {
    console.log(
      `✓ ${r.fg} on ${r.bg}${label}: ${r.ratio.toFixed(2)}:1 ≥ ${r.min}:1`,
    );
  } else {
    bad++;
    console.error(
      `✗ ${r.fg} on ${r.bg}${label}: ${
        r.ratio.toFixed(2)
      }:1 < ${r.min}:1 required`,
    );
  }
}

if (bad) {
  console.error(`\n✗ check-contrast: ${bad}/${results.length} pair(s) failed`);
  Deno.exit(1);
}
console.log(
  `\n✓ check-contrast: ${results.length}/${results.length} pair(s) pass`,
);
