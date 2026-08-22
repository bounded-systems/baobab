// cli/check-contrast.ts — the downstream-usable runner, exercised as a real
// subprocess (not just imported) so its exit codes and CLI contract are covered,
// not just the library function underneath it.

import { assertEquals, assertStringIncludes } from "@std/assert";

const here = new URL(".", import.meta.url);
const cli = new URL("../cli/check-contrast.ts", here);

async function run(tokens: unknown, contract: unknown) {
  const tokensFile = await Deno.makeTempFile({ suffix: ".json" });
  const contractFile = await Deno.makeTempFile({ suffix: ".json" });
  try {
    await Deno.writeTextFile(tokensFile, JSON.stringify(tokens));
    await Deno.writeTextFile(contractFile, JSON.stringify(contract));
    const cmd = new Deno.Command(Deno.execPath(), {
      args: [
        "run",
        "--allow-read",
        cli.pathname,
        "--tokens",
        tokensFile,
        "--contract",
        contractFile,
      ],
      stdout: "piped",
      stderr: "piped",
    });
    const { code, stdout, stderr } = await cmd.output();
    return {
      code,
      stdout: new TextDecoder().decode(stdout),
      stderr: new TextDecoder().decode(stderr),
    };
  } finally {
    await Deno.remove(tokensFile);
    await Deno.remove(contractFile);
  }
}

const tokenTree = {
  color: {
    "on-accent": { $value: "#FFFFFF" },
    accent: { $value: "#A6432F" },
  },
};

Deno.test("cli check-contrast: exits 0 and reports a pass", async () => {
  const { code, stdout } = await run(tokenTree, [
    {
      fg: "color.on-accent",
      bg: "color.accent",
      min: 4.5,
      label: "text on fill",
    },
  ]);
  assertEquals(code, 0);
  assertStringIncludes(stdout, "1/1 pair(s) pass");
});

Deno.test("cli check-contrast: exits 1 and reports a failure", async () => {
  const { code, stderr } = await run(tokenTree, [
    { fg: "color.on-accent", bg: "color.accent", min: 21 },
  ]);
  assertEquals(code, 1);
  assertStringIncludes(stderr, "1/1 pair(s) failed");
});

Deno.test("cli check-contrast: exits 2 on a missing required flag", async () => {
  const cmd = new Deno.Command(Deno.execPath(), {
    args: ["run", "--allow-read", cli.pathname, "--tokens", "/dev/null"],
    stdout: "piped",
    stderr: "piped",
  });
  const { code, stderr } = await cmd.output();
  assertEquals(code, 2);
  assertStringIncludes(new TextDecoder().decode(stderr), "--contract");
});

// ── The regression gate for #18 ───────────────────────────────────────────────
// This CLI used to import through ../src/mod.ts, whose barrel re-exports
// address.ts → `linkedom` (npm) + `@bounded-systems/lone`. Newer Deno refuses to
// resolve npm deps under a bare `jsr:` entrypoint with no node_modules directory,
// so every pinning calling check-contrast.yml went red on a tree that had not
// changed — a gate not running, which is the same as not having it.
//
// The import swap fixed that; this test is what keeps it fixed. The subprocess
// tests above run from a checkout where every dependency resolves, so they were
// green throughout the outage and could never have caught it. What actually
// matters is a STATIC property — that nothing this entrypoint reaches, at any
// depth, names a module outside the repo — so that is what this asserts.
const stripComments = (src: string) =>
  src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");

// `import x from "y"`, `export { a } from "y"`, and side-effect `import "y"`.
// `[^;]*?` spans the newlines of a multi-line clause but stops at the statement.
const IMPORT_RE =
  /\b(?:import|export)\s+(?:[^;]*?\sfrom\s+)?["']([^;"']+)["']/g;

async function importGraph(entry: URL): Promise<Map<string, string[]>> {
  const seen = new Map<string, string[]>();
  const queue = [entry];
  while (queue.length) {
    const url = queue.pop()!;
    if (seen.has(url.href)) continue;
    const specs = [
      ...stripComments(await Deno.readTextFile(url))
        .matchAll(IMPORT_RE),
    ].map((m) => m[1]);
    seen.set(url.href, specs);
    for (const s of specs) if (s.startsWith(".")) queue.push(new URL(s, url));
  }
  return seen;
}

Deno.test("cli check-contrast: its whole import graph stays dependency-free", async () => {
  const graph = await importGraph(
    new URL("../cli/check-contrast.ts", import.meta.url),
  );
  const foreign = [...graph].flatMap(([file, specs]) =>
    specs.filter((s) => !s.startsWith("."))
      .map((s) => `${file.split("/").pop()} imports ${s}`)
  );
  assertEquals(
    foreign,
    [],
    "the CLI must reach only relative modules — anything else has to resolve on " +
      "the consumer's machine, which is what #18 was:\n  " +
      foreign.join("\n  "),
  );
});
