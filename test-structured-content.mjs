// Exact deployed renderer chunks, real GFM/remark/KaTeX, minimal test DOM at HTML boundary.
// Usage: node test-structured-content.mjs [Two Toggles extracted directory]
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const dest = mkdtempSync(join(tmpdir(), "aia-structured-test-"));
const baseline = process.argv[2] || join(import.meta.dirname, "base");
const assets = join(dest, "out", "renderer", "assets");
const names = ["trial-DGJV07EL.js", "panel-BRyOr7Vn.js", "math-message-CfGW1i5D.js", "trial-CHpZpqOI.css"];
try {
  mkdirSync(assets, { recursive: true });
  for (const name of names) copyFileSync(join(baseline, "out", "renderer", "assets", name), join(assets, name));
  execFileSync(process.execPath, [join(import.meta.dirname, "patch-structured-content.mjs"), dest]);
  for (const name of names.filter((name) => name.endsWith(".js"))) execFileSync(process.execPath, ["--check", join(assets, name)]);
  const entry = join(assets, names[0]);
  const source = readFileSync(entry, "utf8");
  const boot = /^createRoot\(document\.getElementById\("root"\)\)\.render\(.+\);$/gm;
  assert.equal([...source.matchAll(boot)].length, 1);
  writeFileSync(entry, source.replace(boot, ""));
  const html = [];
  globalThis.window = { aiaTrial: {}, matchMedia: () => ({}) };
  globalThis.DOMParser = class {};
  globalThis.document = {
    compatMode: "CSS1Compat",
    createElement(tag) {
      return {
        set innerHTML(value) {
          this.textContent = value;
          if (tag === "template") {
            html.push(value);
            this.content = { nodeType: 11, childNodes: [] };
          }
        }
      };
    }
  };
  const { default: MathMessage } = await import(pathToFileURL(join(assets, names[2])));
  const sample = "Plain inline `one()` and $x^2$.\n\n$$\n\\frac{1}{2}\n$$\n\n\\(\\alpha + 1\\)\n\n```js\n  const x = 1;\n\n```\n\n```math\n$literal$\n```";
  const markdown = MathMessage({ text: sample });
  const copy = [];
  const wrappers = [];
  function walk(el) {
    if (Array.isArray(el)) return el.forEach(walk);
    if (!el || typeof el !== "object" || !el.props) return;
    if (typeof el.type === "function" && el.type.name.startsWith("Structured")) {
      if (el.type.name === "StructuredCopy") copy.push([el.props.label, el.props.value]);
      else {
        const next = el.type(el.props);
        if (next.props.className?.startsWith("aia-structured-")) wrappers.push(next.props.className);
        return walk(next);
      }
    }
    walk(el.props.children);
  }
  walk(markdown.type(markdown.props));
  assert.deepEqual(copy, [["复制 LaTeX", "x^2"], ["复制 LaTeX", "\\frac{1}{2}"],
    ["复制 LaTeX", "\\alpha + 1"], ["复制代码", "  const x = 1;\n"], ["复制代码", "$literal$"]]);
  assert.deepEqual(wrappers, ["aia-structured-inline", "aia-structured-display", "aia-structured-inline",
    "aia-structured-code", "aia-structured-code"]);
  assert.equal(html.length, 3);
  assert.ok(html.every((rendered) => rendered.includes('class="katex"')));
  assert.ok(html[1].includes('class="katex-display"'));
  console.log("Structured-content AST and raw-copy regressions passed.");
} finally {
  rmSync(dest, { recursive: true, force: true });
}
