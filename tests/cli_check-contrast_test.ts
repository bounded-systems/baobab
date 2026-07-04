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
