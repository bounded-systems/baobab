// checkContrast — the token-level counterpart to address()'s component-level
// lone blessing. baobab ships the ratio math; a pinning supplies which token
// paths pair up and what threshold they must clear.

import { assertEquals, assertThrows } from "@std/assert";
import { checkContrast, contrastRatio, relativeLuminance } from "../src/mod.ts";

Deno.test("relativeLuminance: white is 1, black is 0", () => {
  assertEquals(relativeLuminance("#FFFFFF"), 1);
  assertEquals(relativeLuminance("#000000"), 0);
});

Deno.test("contrastRatio: black on white is the WCAG max, 21:1", () => {
  assertEquals(contrastRatio("#000000", "#FFFFFF"), 21);
});

Deno.test("contrastRatio: order-independent", () => {
  assertEquals(
    contrastRatio("#A6432F", "#FFFFFF"),
    contrastRatio("#FFFFFF", "#A6432F"),
  );
});

Deno.test("contrastRatio: accepts 3-digit hex", () => {
  assertEquals(contrastRatio("#000", "#FFF"), 21);
});

Deno.test("checkContrast: reports pass/fail against each pair's own threshold", () => {
  const tokens = { "color.on-accent": "#FFFFFF", "color.accent": "#A6432F" };
  const [result] = checkContrast(tokens, [
    {
      fg: "color.on-accent",
      bg: "color.accent",
      min: 4.5,
      label: "text on fill",
    },
  ]);
  assertEquals(result.pass, true);
  assertEquals(result.label, "text on fill");

  const [strict] = checkContrast(tokens, [
    { fg: "color.on-accent", bg: "color.accent", min: 21 },
  ]);
  assertEquals(strict.pass, false);
});

Deno.test("checkContrast: throws when a pair references a token not in the map", () => {
  const tokens = { "color.accent": "#A6432F" };
  assertThrows(
    () =>
      checkContrast(tokens, [{
        fg: "color.missing",
        bg: "color.accent",
        min: 4.5,
      }]),
    Error,
    "color.missing",
  );
});
