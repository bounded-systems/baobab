// The core claim, as an executable gate:
//   deterministic · token-sensitive · blessing-sensitive.
//
// A component's address must (1) be identical on re-run with identical inputs,
// (2) change when a slotted token changes, and (3) change when lone's blessing flips
// (e.g. drop a button's accessible name → "unnamed button" error → address moves).

import { assert, assertEquals, assertNotEquals } from "@std/assert";
import { address, type Props, type Template, type Tokens } from "../src/mod.ts";

const tokens: Tokens = {
  "color.fg": "#0C5A42",
  "radius.md": "8px",
  "size.touch": "44px",
  "color.unused": "#FFFFFF",
};

// Structure only — slots tokens, takes a label prop. Its accessible name IS the label;
// drop the label and lone flags an unnamed button.
const button: Template = (t, p) =>
  `<button type="button" style="border-radius:${t["radius.md"]};` +
  `min-inline-size:${t["size.touch"]};color:${t["color.fg"]}">${
    p.label ?? ""
  }</button>`;

Deno.test("blesses clean and content-addresses a labeled button", async () => {
  const a = await address(tokens, button, { label: "Search" }, "button");
  assert(a.blessed, "labeled button should bless (no error findings)");
  assertEquals(a.findings.filter((f) => f.severity === "error").length, 0);
  assertEquals(a.sha.length, 64, "sha256 hex is 64 chars");
  assert(/^[0-9a-f]{64}$/.test(a.sha), "sha is lowercase hex");
});

Deno.test("deterministic — re-run with identical inputs yields the identical address", async () => {
  const a = await address(tokens, button, { label: "Search" }, "button");
  const b = await address(tokens, button, { label: "Search" }, "button");
  assertEquals(a.sha, b.sha);
});

Deno.test("token-sensitive — bumping a slotted token changes the address", async () => {
  const a = await address(tokens, button, { label: "Search" }, "button");
  const bumped = await address(
    { ...tokens, "radius.md": "9999px" },
    button,
    { label: "Search" },
    "button",
  );
  assertNotEquals(a.sha, bumped.sha);
});

Deno.test("records only the tokens actually slotted (tokens-used)", async () => {
  const a = await address(tokens, button, { label: "Search" }, "button");
  assertEquals(
    Object.keys(a.used).sort(),
    ["color.fg", "radius.md", "size.touch"],
    "color.unused is never read, so it must not enter the address",
  );
  // Therefore: changing a token the component never slots leaves the address untouched.
  const other = await address(
    { ...tokens, "color.unused": "#000000" },
    button,
    { label: "Search" },
    "button",
  );
  assertEquals(a.sha, other.sha);
});

Deno.test("blessing-sensitive — dropping the accessible name flips the blessing and moves the address", async () => {
  const good = await address(tokens, button, { label: "Search" }, "button");
  const bad = await address(tokens, button, {}, "button"); // no label → unnamed button

  assert(good.blessed, "labeled button blesses");
  assert(!bad.blessed, "unnamed button does not bless");
  assert(
    bad.findings.some((f) => f.severity === "error"),
    "unnamed button yields an error finding",
  );
  assertNotEquals(
    good.sha,
    bad.sha,
    "the address must move when the blessing flips",
  );
});

Deno.test("defaults blessSelector to the rendered root element", async () => {
  const withSelector = await address(tokens, button, { label: "Go" }, "button");
  const noSelector = await address(tokens, button, { label: "Go" });
  assertEquals(withSelector.sha, noSelector.sha);
});

Deno.test("throws when blessSelector matches nothing", async () => {
  let threw = false;
  try {
    await address(tokens, button, { label: "x" }, "section");
  } catch {
    threw = true;
  }
  assert(threw, "a selector that matches no element should throw");
});

// A second component to show the property is not button-specific.
const linkButton: Template = (t, p) =>
  `<a href="${p.href ?? "#"}" style="color:${t["color.fg"]}">${
    p.label ?? ""
  }</a>`;

Deno.test("blessing-sensitive across a second component (link-button)", async () => {
  const props: Props = { label: "View profile", href: "/me" };
  const good = await address(tokens, linkButton, props, "a");
  const bad = await address(tokens, linkButton, { href: "/me" }, "a"); // no link text

  assert(good.blessed, "named link blesses");
  assert(!bad.blessed, "unnamed link does not bless");
  assertNotEquals(good.sha, bad.sha);
});
