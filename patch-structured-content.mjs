import { existsSync, readFileSync, realpathSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";

const arg = process.argv[2];
if (!arg || process.argv.length !== 3) throw new Error("Usage: node patch-structured-content.mjs <assembly ASAR contents>");
const target = realpathSync(arg);
const baseline = resolve(import.meta.dirname, "base");
if (target === baseline || target.startsWith(baseline + "/")) throw new Error("Use an assembly copy, not the immutable baseline");
const assets = join(target, "out", "renderer", "assets");
if (!existsSync(assets)) throw new Error("Expected out/renderer/assets under the assembly directory");
const panelFile = join(assets, "panel-BRyOr7Vn.js");
const mathFile = join(assets, "math-message-CfGW1i5D.js");
const cssFile = join(assets, "trial-CHpZpqOI.css");
function exactOnce(text, from, to) {
  const start = text.indexOf(from);
  if (start < 0 || text.indexOf(from, start + from.length) >= 0) throw new Error("Missing or repeated exact anchor: " + from);
  return text.slice(0, start) + to + text.slice(start + from.length);
}

let panel = readFileSync(panelFile, "utf8");
let math = readFileSync(mathFile, "utf8");
let css = readFileSync(cssFile, "utf8");
panel = exactOnce(panel, 'const markdownComponents = { img: () => null };', String.raw`function StructuredCopy({ value, label }) {
  const [status, setStatus] = React.useState("");
  const serial = React.useRef(0);
  const timer = React.useRef();
  React.useEffect(() => () => { ++serial.current; clearTimeout(timer.current); }, [value]);
  async function copy() {
    const ticket = ++serial.current;
    clearTimeout(timer.current);
    let next = "ok";
    try { await window.aiaTrial.copyReply(value); } catch { next = "error"; }
    if (serial.current !== ticket) return;
    setStatus(next);
    timer.current = setTimeout(() => setStatus(""), 1400);
  }
  const feedback = status === "ok" ? "已复制" : status === "error" ? "复制失败" : "";
  return jsxRuntimeExports.jsxs("span", { className: "aia-structured-action", "data-state": status, children: [
    jsxRuntimeExports.jsx("button", {
      className: "aia-structured-copy", type: "button", "aria-label": label, title: feedback || label, onClick: copy,
      children: jsxRuntimeExports.jsx("svg", {
        viewBox: "0 0 24 24", width: 15, height: 15, fill: "none", "aria-hidden": "true",
        stroke: "currentColor", strokeWidth: 1.6, strokeLinecap: "round", strokeLinejoin: "round",
        children: jsxRuntimeExports.jsx("path", { d: status === "ok" ? messageGlyph.check : status === "error" ? "M12 6v7m0 4h.01" : messageGlyph.copy })
      })
    }),
    jsxRuntimeExports.jsx("span", { className: "aia-structured-sr", role: "status", children: feedback })
  ] });
}
function StructuredCode({ node, children, ...props }) {
  const code = node?.children?.find((child) => child.type === "element" && child.tagName === "code");
  const value = code?.children?.filter((child) => child.type === "text").map((child) => child.value).join("").replace(/\n$/, "");
  const pre = jsxRuntimeExports.jsx("pre", { ...props, children });
  if (!code) return pre;
  return jsxRuntimeExports.jsxs("div", { className: "aia-structured-code", children: [
    pre, value && jsxRuntimeExports.jsx(StructuredCopy, { value, label: "复制代码" })
  ] });
}
function StructuredMath({ node, children, ...props }) {
  const latex = node?.properties?.dataAiaLatex;
  if (typeof latex !== "string") return jsxRuntimeExports.jsx("span", { ...props, children });
  return jsxRuntimeExports.jsxs("span", { className: node.properties.dataAiaDisplay ? "aia-structured-display" : "aia-structured-inline", children: [
    children, latex && jsxRuntimeExports.jsx(StructuredCopy, { value: latex, label: "复制 LaTeX" })
  ] });
}
const markdownComponents = { img: () => null, pre: StructuredCode, span: StructuredMath };`);
panel = exactOnce(panel, '  Markdown as M,\n', '  Markdown as M,\n  markdownComponents as aiaStructuredMarkdownComponents,\n');

math = exactOnce(math, 'M as Markdown } from "./panel-BRyOr7Vn.js";', 'M as Markdown, aiaStructuredMarkdownComponents } from "./panel-BRyOr7Vn.js";');
math = exactOnce(math, '      parent.children.splice(index, 1, ...result);', String.raw`      if (index < 0) return;
      const latex = scope === element2 ? value : value.replace(/\n$/, "");
      parent.children.splice(index, 1, {
        type: "element", tagName: "span",
        properties: { dataAiaLatex: latex, dataAiaDisplay: displayMode },
        children: result
      });`);
math = exactOnce(math, 'const components = { img: () => null };', 'const components = aiaStructuredMarkdownComponents;');

const marker = "/* AIA structured content v1 */";
if (css.includes(marker)) throw new Error("Structured content styles are already present");
css += `
${marker}
.aia-structured-code,.aia-structured-display {
  position:relative; display:block; min-width:0; max-width:100%;
  background:#1e2229; color:#f0f1f3; border:1px solid #ffffff19; border-radius:9px;
  margin:8px 0; color-scheme:dark;
}
.message .aia-structured-code > pre {
  margin:0; padding:9px 32px 9px 10px; max-width:100%; overflow-x:auto;
  background:transparent; color:inherit; border:0; border-radius:inherit;
}
.message .aia-structured-code > pre code { background:transparent; color:inherit; padding:0; }
.message .aia-structured-display > .katex-display {
  margin:0; padding:9px 33px 9px 10px; overflow-x:auto; overflow-y:hidden; color:inherit;
}
.aia-structured-inline { position:relative; }
.aia-structured-action {
  position:absolute; top:4px; right:4px; z-index:3; opacity:0; pointer-events:none;
  user-select:none; -webkit-app-region:no-drag;
}
.aia-structured-inline > .aia-structured-action { top:auto; bottom:calc(100% - 2px); right:0; }
.aia-structured-code:hover > .aia-structured-action,
.aia-structured-display:hover > .aia-structured-action,
.aia-structured-inline:hover > .aia-structured-action,
.aia-structured-action:focus-within,.aia-structured-action[data-state="ok"],
.aia-structured-action[data-state="error"] { opacity:1; pointer-events:auto; }
.aia-structured-copy {
  box-sizing:border-box; display:grid; place-items:center; padding:0; width:24px; height:24px;
  border:1px solid #ffffff30; border-radius:6px; background:#323944; color:#eff2f5;
  cursor:pointer; -webkit-app-region:no-drag;
}
.aia-structured-copy:hover { background:#414c5b; }
.aia-structured-copy:focus-visible { outline:2px solid #aacbff; outline-offset:1px; }
.aia-structured-action[data-state="ok"] .aia-structured-copy { color:#a2e5ba; }
.aia-structured-action[data-state="error"] .aia-structured-copy { color:#ffc2b4; }
.aia-structured-sr {
  position:absolute; width:1px; height:1px; padding:0; margin:-1px;
  overflow:hidden; clip-path:inset(50%); white-space:nowrap;
}
`;

for (const [path, content] of [[panelFile, panel], [mathFile, math], [cssFile, css]]) writeFileSync(path, content);
