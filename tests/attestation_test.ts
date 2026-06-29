// makeStatement — wrap an address as an in-toto Statement v1.

import { assert, assertEquals } from "@std/assert";
import {
  address,
  makeStatement,
  type Template,
  type Tokens,
} from "../src/mod.ts";

const tokens: Tokens = {
  "color.fg": "#0C5A42",
  "radius.md": "8px",
  "size.touch": "44px",
};
const button: Template = (t, p) =>
  `<button type="button" style="border-radius:${t["radius.md"]};` +
  `min-inline-size:${t["size.touch"]};color:${t["color.fg"]}">${
    p.label ?? ""
  }</button>`;

Deno.test("the statement's subject digest IS the component address", async () => {
  const a = await address(tokens, button, { label: "Search" }, "button");
  const stmt = makeStatement("button@brand", a);

  assertEquals(stmt._type, "https://in-toto.io/Statement/v1");
  assertEquals(
    stmt.predicateType,
    "https://bounded-systems.github.io/baobab/component/v0",
  );
  assertEquals(stmt.subject.length, 1);
  assertEquals(stmt.subject[0].name, "button@brand");
  assertEquals(stmt.subject[0].digest.sha256, a.sha);
  assertEquals(stmt.predicate.blessing.blessed, true);
  assertEquals(stmt.predicate.materials.tokens, a.used);
});

Deno.test("carries optional pinning provenance when supplied", async () => {
  const a = await address(tokens, button, { label: "Search" }, "button");
  const stmt = makeStatement("button@brand", a, {
    repo: "bdelanghe/brand",
    commit: "2796ce547318909079bbb42093986efa809942f4",
  });
  assert(stmt.predicate.materials.pinning);
  assertEquals(stmt.predicate.materials.pinning?.repo, "bdelanghe/brand");
});

Deno.test("omits the pinning key when none is supplied", async () => {
  const a = await address(tokens, button, { label: "Search" }, "button");
  const stmt = makeStatement("button@brand", a);
  assertEquals("pinning" in stmt.predicate.materials, false);
});

Deno.test("serializes to stable JSON", async () => {
  const a = await address(tokens, button, { label: "Search" }, "button");
  const json = JSON.stringify(makeStatement("button@brand", a));
  assert(json.includes(a.sha));
});
