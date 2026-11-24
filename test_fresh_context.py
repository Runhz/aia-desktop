from pathlib import Path
import json
import subprocess
import unittest
from fresh_context import patch

BASE = Path(__file__).parent / 'base/out/renderer/assets/trial-DGJV07EL.js'
class FreshContextTest(unittest.TestCase):
    def test_compact_detach_and_payload(self):
        s = patch(BASE.read_text())
        detach = s[s.index('  function detachCollapsedContext()'):s.index('  function raisePanel(')]
        decision = next(line.strip() for line in s.splitlines() if 'const id2 = citation || startingCompact' in line)
        js = f"""
        const assert = require('node:assert/strict');
        const currentSession = {{current:'old'}}, recentCollapsedSession = {{}};
        let visible='old', messages=['old'], setSessionId = s => visible=s, setMessages = m => messages=m;
        {detach}
        function payload(citation,startingCompact) {{ {decision} return id2; }}
        assert.equal(payload(null,true),undefined);
        assert.equal(payload(null,false),'old');
        assert.equal(payload({{}},false),undefined);
        detachCollapsedContext();
        assert.equal(currentSession.current,undefined);
        assert.equal(visible,undefined);
        assert.deepEqual(messages,[]);
        assert.equal(recentCollapsedSession.current,'old');
        assert.equal(payload(null,false),undefined);
        currentSession.current='new';
        assert.equal(payload(null,false),'new');
        """
        subprocess.run(['node','-e',js],check=True)
    def test_send_failure_cannot_reconnect_prior_thread(self):
        s = patch(BASE.read_text())
        send = s[s.index('  async function send(forced)'):s.index('  const onSendSelection',s.index('  async function send(forced)'))]
        self.assertLess(send.index('if (firstOpen) detachCollapsedContext();'),send.index('await api.config()'))
        self.assertIn('recentCollapsedSession.current = event.sessionId;',s)
        self.assertIn('void openSession(previous, editingRef.current?.sessionId === previous);',s)

if __name__=='__main__':
    unittest.main()
