"""Patch the recovered AIA renderer in a staging copy, not the immutable base."""
import sys
from pathlib import Path

def patch(s):
    def swap(old,new):
        nonlocal s
        if s.count(old)!=1:
            raise ValueError(f'Expected one renderer anchor: {old[:130]!r}')
        s=s.replace(old,new,1)
    swap('  const currentSession = reactExports.useRef(sessionId);','''  const currentSession = reactExports.useRef(sessionId);
  const recentCollapsedSession = reactExports.useRef(void 0);''')
    swap('  function raisePanel() {\n    void warmPanel()', '''  function detachCollapsedContext() {
    if (currentSession.current) recentCollapsedSession.current = currentSession.current;
    currentSession.current = void 0;
    setSessionId(void 0);
    setMessages([]);
  }
  function raisePanel(resuming = false) {
    if (!expandedRef.current && !resuming && !editingRef.current && !request.current) detachCollapsedContext();
    void warmPanel()''')
    swap('  async function send(forced) {\n    const text', '''  async function send(forced) {
    // Record entry mode before opening the panel or doing async configuration work.
    const startingCompact = !expandedRef.current;
    if (startingCompact && editingRef.current && !forced) {
      setPersonError("按 Ctrl+Shift+Y 恢复未完成的编辑，或从历史打开原对话。");
      return;
    }
    const text''')
    swap('    const firstOpen = !expandedRef.current;\n    if (firstOpen) {', '''    const firstOpen = startingCompact;
    if (firstOpen) detachCollapsedContext();
    if (firstOpen) {''')
    swap('      const id2 = citation ? void 0 : currentSession.current;', '      const id2 = citation || startingCompact ? void 0 : currentSession.current;')
    swap('  function collapse() {\n    expandedRef.current = false;', '''  function collapse() {
    if (currentSession.current) recentCollapsedSession.current = currentSession.current;
    expandedRef.current = false;''')
    swap('      if (!expandedRef.current) {\n        request.current = void 0;', '''      if (!expandedRef.current) {
        recentCollapsedSession.current = event.sessionId;
        request.current = void 0;''')
    swap('  async function openSession(id2) {', '  async function openSession(id2, preserveEdit = false) {')
    swap('      clearEdit(true);\n      setSessionId(id2);','      if (!preserveEdit) clearEdit(true);\n      setSessionId(id2);')
    swap('      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "h") {', '''      if (!expandedRef.current && (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === "y" &&
          !request.current && !mutation.current && !preferenceLock.current && viewLoading.current === void 0 && !currentSelection.current) {
        const previous = recentCollapsedSession.current;
        if (previous) {
          event.preventDefault();
          raisePanel(true);
          void openSession(previous, editingRef.current?.sessionId === previous);
        }
      }
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "h") {''')
    return s

if __name__=='__main__':
    p=Path(sys.argv[1]).resolve()
    if 'base' in p.parts:
        raise SystemExit('Apply to a staging copy, never the immutable base')
    p.write_text(patch(p.read_text()))
