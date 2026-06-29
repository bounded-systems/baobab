// flattenTokens — resolve W3C design-token aliases and flatten to a slot map.

import { assertEquals, assertThrows } from "@std/assert";
import { flattenTokens } from "../src/mod.ts";

Deno.test("flattens nested groups to dot-paths and stringifies leaves", () => {
  const flat = flattenTokens({
    color: {
      forest: { $value: "#0C5A42", $type: "color" },
    },
    radius: {
      "radius-md": { $value: "8px" },
    },
  });
  assertEquals(flat, { "color.forest": "#0C5A42", "radius.radius-md": "8px" });
});

Deno.test("resolves {alias} references recursively", () => {
  const flat = flattenTokens({
    primitive: { "green-700": { $value: "#0C5A42" } },
    color: {
      forest: { $value: "{primitive.green-700}" },
      brand: { $value: "{color.forest}" }, // alias to an alias
    },
  });
  assertEquals(flat["color.forest"], "#0C5A42");
  assertEquals(flat["color.brand"], "#0C5A42");
});

Deno.test("joins array values into a font stack", () => {
  const flat = flattenTokens({
    font: { display: { $value: ["Inter", "system-ui", "sans-serif"] } },
  });
  assertEquals(flat["font.display"], "Inter, system-ui, sans-serif");
});

Deno.test("skips $-prefixed group metadata", () => {
  const flat = flattenTokens({
    color: {
      $description: "brand palette",
      $type: "color",
      ink: { $value: "#111111" },
    },
  });
  assertEquals(flat, { "color.ink": "#111111" });
});

Deno.test("throws on an alias cycle", () => {
  assertThrows(() =>
    flattenTokens({
      a: { $value: "{b}" },
      b: { $value: "{a}" },
    })
  );
});

Deno.test("throws when an alias targets a non-token", () => {
  assertThrows(() => flattenTokens({ a: { $value: "{nope.missing}" } }));
});
