#!/usr/bin/env python3
"""Apply the AIA interface polish to an extracted exact-release ASAR tree."""
import argparse
from pathlib import Path

ASSETS = Path("out/renderer/assets")
ENTRY = ASSETS / "trial-DGJV07EL.js"
PANEL = ASSETS / "panel-BRyOr7Vn.js"
CSS = ASSETS / "trial-CHpZpqOI.css"

def once(text, old, new):
    count = text.count(old)
    if count != 1:
        raise ValueError(f"Expected one anchor, got {count}: {old[:112]!r}")
    return text.replace(old, new, 1)

def entry(text):
    text = once(text, "const preferenceGlyph = {", """const preferenceGlyph = {
  model: "m12 4-8 4.5 8 4.5 8-4.5L12 4ZM4 12l8 4.5 8-4.5M4 15.5l8 4.5 8-4.5",""")
    text = once(text, "  const [expanded, setExpanded] = reactExports.useState(false);", """  const [expanded, setExpanded] = reactExports.useState(false);
  const [openingMotion, setOpeningMotion] = reactExports.useState();
  const pendingOpeningMotion = reactExports.useRef();""")
    text = once(text, "const motion = () => setReducedMotion(media.matches);", """const motion = () => {
      setReducedMotion(media.matches);
      if (media.matches) setOpeningMotion(void 0);
    };""")
    text = once(text, """    void api.windowMode(expanded ? "expanded" : images.length || selection || personError ? "preview" : "compact", reducedMotion).catch((e) => setPersonError(errorText(e)));""", """    const pending = expanded ? pendingOpeningMotion.current : void 0;
    void api.windowMode(expanded ? "expanded" : images.length || selection || personError ? "preview" : "compact", reducedMotion).then(() => {
      if (!pending || pendingOpeningMotion.current !== pending || !expandedRef.current) return;
      requestAnimationFrame(() => {
        if (pendingOpeningMotion.current !== pending || !expandedRef.current) return;
        pendingOpeningMotion.current = void 0;
        if (!media.matches) setOpeningMotion(pending);
      });
    }).catch((e) => {
      if (pending && pendingOpeningMotion.current === pending) pendingOpeningMotion.current = void 0;
      setPersonError(errorText(e));
    });""")
    text = once(text, """    if (firstOpen) {
      const bounds = editor.current?.getBoundingClientRect();""", """    if (firstOpen) {
      if (!media.matches) pendingOpeningMotion.current = rid;
      const bounds = editor.current?.getBoundingClientRect();""")
    text = once(text, """    expandedRef.current = false;
    setExpanded(false);""", """    expandedRef.current = false;
    pendingOpeningMotion.current = void 0;
    setOpeningMotion(void 0);
    setExpanded(false);""")
    tail = ' : "is-compact"} ' + '\x24{idle && visible ? "is-idle" : ""}'
    text = once(text, tail, tail + ' ' + '\x24{expanded && openingMotion && !reducedMotion ? "is-opening-chat" : ""}')
    text = once(text, """jsxRuntimeExports.jsxs("form", { className: "composer", onSubmit:""", """jsxRuntimeExports.jsxs("form", { className: "composer", onAnimationEnd: (event) => {
          if (event.target === event.currentTarget && event.animationName === "aia-composer-settle") setOpeningMotion(void 0);
        }, onSubmit:""")
    text = once(text, """                  "aria-expanded": modelMenu,
                  title: config ? "当前模型：" + config.model : "切换模型",""", """                  "aria-expanded": modelMenu,
                  "aria-controls": modelMenu ? "aia-model-menu" : void 0,
                  title: config ? "切换模型 · 当前：" + config.model : "切换模型",""")
    left = text.index('                    /* @__PURE__ */ jsxRuntimeExports.jsx("span", { children: "模型" }),')
    right = text.index("\n                  ]", left)
    text = text[:left] + '                    /* @__PURE__ */ jsxRuntimeExports.jsx(PreferenceGlyph, { name: "model" })' + text[right:]
    return once(text, """{ className: "preference-menu model-menu", role: "group", "aria-label": "选择模型", children:""", """{ id: "aia-model-menu", className: "preference-menu model-menu", role: "group", "aria-label": "选择模型", children:""")

def panel(text):
    text = once(text, '  edit: "m8 16 1-4L17 4a1.4 1.4 0 0 1 2 0l1 1a1.4 1.4 0 0 1 0 2l-8 8-4 1ZM15.7 5.4l2.9 2.9M4 20h16"', '  edit: "m5 19 1-4.5L16.8 3.7a1.4 1.4 0 0 1 2 0l1.5 1.5a1.4 1.4 0 0 1 0 2L9.5 18 5 19Zm9.8-13.3 3.5 3.5"')
    text = once(text, """      const fromY = Math.max(0, Math.min(134, window.innerHeight - launch.bottom - box.top));
      const fromX = Math.max(-45, Math.min(45, launch.left - box.left));""", """      const fromY = Math.max(10, Math.min(58, window.innerHeight - launch.bottom - box.top));
      const fromX = Math.max(-24, Math.min(24, launch.left - box.left));""")
    return once(text, """      effect = bubble.animate([{ transform: \x60translate(\x24{fromX}px, \x24{fromY}px) scale(.96)\x60 }, { transform: "translate(0, 0) scale(1)" }], { duration: 240, easing: "cubic-bezier(.2,.8,.2,1)" });""", """      effect = bubble.animate([
        { transform: \x60translate(\x24{fromX}px, \x24{fromY}px) scale(.985)\x60, easing: "cubic-bezier(.16,.80,.30,1)" },
        { transform: "translate(0, -1px)", offset: .82 },
        { transform: "translate(0, 0)" }
      ], { duration: 240 });""")

CSS_RULES = """
/* Icon-only model switcher; preserve names for title, assistive tech and the popover. */
.composer .model-trigger { display:grid; place-items:center; width:28px; flex:0 0 28px; }
.composer .model-trigger[aria-expanded=true] { color:var(--accent-hover); background:#e8dbcd; }
.model-menu { width:min(205px, 76vw); }
.model-choices button:focus-visible { outline-offset:-2px; }

/* User tools sit in their own hit area, never on top of the bubble. */
.turn.user { flex-direction:column; align-items:flex-end; margin-bottom:10px; }
.turn.user .message-tools {
  position:static; align-self:flex-end; margin-top:5px; margin-right:2px; gap:4px;
}
.turn.user .message-tools:empty { display:none; }
.turn.user .message-tools:has(> [aria-label="编辑重发"]) {
  opacity:1; pointer-events:auto;
}
.turn.user .message-tools:has(> [aria-label="编辑重发"]) > :not([aria-label="编辑重发"]) {
  opacity:0; pointer-events:none;
}
.turn.user:is(:hover,:focus-within) .message-tools:has(> [aria-label="编辑重发"]) > :not([aria-label="编辑重发"]) {
  opacity:1; pointer-events:auto;
}
@media (hover:none) {
  .turn.user .message-tools:has(> [aria-label="编辑重发"]) > :not([aria-label="编辑重发"]) {
    opacity:1; pointer-events:auto;
  }
}
.turn.user .message-tools button.message-action[aria-label="编辑重发"] {
  width:24px; height:24px; flex:none; background:transparent; color:#756251;
}
.turn.user .message-tools button.message-action[aria-label="编辑重发"] svg { width:16px; height:16px; }
.turn.user .message-tools button.message-action[aria-label="编辑重发"]:is(:hover,:focus-visible):not(:disabled) {
  background:transparent; color:var(--accent-hover);
}
.turn.user .message-tools button.message-action[aria-label="编辑重发"]:focus-visible {
  outline:2px solid currentColor; outline-offset:1px;
}

/* The native resize remains one step: only inner surfaces move briefly on the first send. */
@media (prefers-reduced-motion:no-preference) {
  .is-opening-chat .panel {
    transform-origin:center 100%; animation:aia-panel-rise 230ms cubic-bezier(.16,.8,.25,1);
  }
  .is-opening-chat .composer {
    transform-origin:right 90%; animation:aia-composer-settle 250ms;
  }
}
@keyframes aia-panel-rise {
  from { transform:translateY(8px) scale(.993); opacity:.83; }
  to { transform:translateY(0) scale(1); opacity:1; }
}
@keyframes aia-composer-settle {
  0% { transform:translateY(3px) scaleX(.968); animation-timing-function:cubic-bezier(.18,.80,.32,1); }
  80% { transform:translateY(0) scaleX(1.003); animation-timing-function:ease-out; }
  100% { transform:translateY(0) scaleX(1); }
}
"""

def css(text):
    if "aia-composer-settle" in text:
        raise ValueError("Interface polish is already present")
    return text.rstrip() + "\n" + CSS_RULES

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("tree", type=Path, help="Modifiable copy of extracted app.asar program tree")
    tree = parser.parse_args().tree.resolve()
    changes = [(tree / rel, patch) for rel, patch in ((ENTRY, entry), (PANEL, panel), (CSS, css))]
    # Validate all patch anchors before writing to the staged tree.
    updates = [(path, patch(path.read_text(encoding="utf8"))) for path, patch in changes]
    for path, updated in updates:
        path.write_text(updated, encoding="utf8")
        print(path.relative_to(tree))

if __name__ == "__main__":
    main()

