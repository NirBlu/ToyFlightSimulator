import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";

// The game must run from a plain static server (python -m http.server), no bundler.
const walk = (dir) =>
  readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? walk(p) : p.endsWith(".js") ? [p] : [];
  });
const code = (file) =>
  readFileSync(file, "utf8")
    .replace(/\/\*[\s\S]*?\*\//g, "")
    .replace(/^\s*\/\/.*$/gm, "");
const html = readFileSync("index.html", "utf8");
const version = html.match(/src\/main\.js\?v=(\d+)/)[1];

test("no bare module specifiers anywhere the browser loads", () => {
  for (const file of [...walk("src"), ...walk("vendor/addons")]) {
    const src = code(file);
    const specs = [
      ...src.matchAll(/(?:import|export)[^'"]*?from\s*['"]([^'"]+)['"]/g),
    ].map((m) => m[1]);
    specs.push(
      ...[...src.matchAll(/import\(\s*['"]([^'"]+)['"]\s*\)/g)].map(
        (m) => m[1],
      ),
    );
    for (const s of specs)
      assert.match(s, /^\.{1,2}\//, `${file} imports bare "${s}"`);
  }
});
test("no Vite-only or Node-only globals in game code", () => {
  for (const file of walk("src")) {
    const src = code(file);
    assert.doesNotMatch(
      src,
      /import\.meta\.env\.(?!\?)/,
      `${file} uses import.meta.env without ?.`,
    );
    assert.doesNotMatch(src, /process\.env/, `${file} uses process.env`);
    assert.doesNotMatch(src, /import\s+['"][^'"]+\.css/, `${file} imports CSS`);
  }
});
test("game modules share one cache-bust version; Three.js is imported once, unversioned", () => {
  for (const file of walk("src")) {
    const src = code(file);
    for (const [, s] of src.matchAll(/from\s*['"]([^'"]+)['"]/g)) {
      if (s.includes("vendor/"))
        assert.ok(
          !s.includes("?"),
          `${file}: vendor import must not be versioned (${s})`,
        );
      else
        assert.ok(
          s.endsWith(`?v=${version}`),
          `${file}: ${s} should end with ?v=${version}`,
        );
    }
  }
});
