const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const root = process.argv[2] || path.join(__dirname, 'staged');
const assets = path.join(root, 'out/renderer/assets');

const moduleText = fs.readFileSync(path.join(assets, 'trial-DGJV07EL.js'), 'utf8');
const standalone = moduleText.slice(moduleText.indexOf('let panelLoad;'), moduleText.indexOf('createRoot(document.getElementById("root")).render('));
const style = fs.readFileSync(path.join(assets, 'trial-CHpZpqOI.css'), 'utf8');
assert.ok(standalone.includes('function App() {'));

const jsx = (type, props) => ({type, props});
const listChildren = (node) => [node?.props?.children].flat(Infinity).filter(a => a !== false && a !== undefined && a !== null);
const find = (node, fn) => {
  if (node && fn(node)) return node;
  for (const a of listChildren(node)) { const n = find(a,fn); if(n) return n; }
};
const noop = () => {};
const tick = () => new Promise(r => setImmediate(r));
const modes = [];

function createMockUI(initialReduced) {
  let ui, dirty = true, base = 0, commit = [];
  let raf = [], seq = 1, expands = [], sent = [], lists = 0, focused = '';
  let nextNumber = 0, activeFrame = false;
  const memory = [], hooks = new Map(), listeners = {}, mediaEvents = {};
  const media = {matches:initialReduced, addEventListener:(n,f) => {mediaEvents[n]=f;}, removeEventListener:noop};
  const bind = n => callback => {listeners[n]=callback;return noop;};
  const config = {hasKey:true,model:'mock-model',baseUrl:'https://mock.invalid/v1',capabilities:{}};
  const fakeButton = {focus:() => {focused='switch';}};
  const editor = {value:'', focus:() => {focused='editor';}, getBoundingClientRect:() => ({left:20,top:38})};
  const anchor = {contains:()=>true,querySelector:()=>fakeButton};
  const w = {
    innerHeight:100, setTimeout,
    matchMedia:() => media,
    addEventListener:(n,f) => {hooks.set(n,f);},
    removeEventListener:(n,f) => { if(hooks.get(n)===f) hooks.delete(n); },
    aiaTrial:{
      windowMode: (mode, reduced) => {
        modes.push([mode,reduced]);
        return mode==='expanded' && !reduced ? new Promise(resolve=>expands.push(resolve)) : Promise.resolve();
      },
      config:async () => config,
      listModels:async () => {lists++;return ['mock-model','switched'];},
      saveConfig:async input=>({...config,...input}),
      list:async ()=>[],
      load:async id=>({id,messages:[]}),
      send:async opt=>{sent.push(opt);return {id:'conversation'};},
      onStream:bind('stream'), onSelection:bind('selection'), onCollapse:bind('collapse'),
      onReveal:bind('reveal'), onMaintenanceCheck:bind('maintenance')
    },
  };
  const react = {
    lazy: () => function FakePanel() {},
    Suspense: 'suspense',
    useState(initial) {
      const id=base++;
      if (!memory[id]) memory[id]={value:initial};
      return [memory[id].value, next => {
        const curr=memory[id].value;
        const value=typeof next==='function' ? next(curr) : next;
        if(!Object.is(curr,value)){memory[id].value=value;dirty=true;}
      }];
    },
    useRef(initial) {
      const id=base++;
      return memory[id] ??= {current:initial};
    },
    useEffect(fn,deps) {
      const id=base++;
      const prev=memory[id];
      if(prev && deps?.length===prev.deps?.length && deps?.every((d,i)=>Object.is(d,prev.deps[i])))return;
      memory[id]={deps};
      commit.push(()=>{prev?.cleanup?.();memory[id].cleanup=fn();});
    },
    useLayoutEffect(fn,deps) { react.useEffect(fn,deps); }
  };
  const env = {
    window:w,
    document:{hasFocus:()=>true,hidden:false,addEventListener:noop,removeEventListener:noop},
    crypto:{randomUUID:()=>String(++nextNumber)},
    __vitePreload:async ()=>undefined,
    reactExports:react, jsxRuntimeExports:{jsx,jsxs:jsx,Fragment:'fragment'},
    clearTimeout, URL, IMAGE_TYPES:["image/png"], Node:class {}, console,
    requestAnimationFrame(fn) {raf.push([++seq,fn]);return seq;},
    cancelAnimationFrame(id) {raf=raf.filter(([n])=>n!==id);}
  };
  vm.createContext(env);
  vm.runInContext(standalone.replace("import.meta.url", "'fixture:renderer'") + '\nglobalThis.fixtureApp=App;',env);
  function render() {
    if(!dirty)return;
    dirty=false; base=0; commit=[];
    ui=env.fixtureApp();
    for(const [test,obj] of [
      [n=>n.type==='textarea',editor],
      [n=>n.props?.className==='preference-anchor',anchor]
    ]) {
      const node=find(ui,test);
      if(node?.props?.ref)node.props.ref.current=obj;
    }
    for(const fn of commit)fn();
  }
  async function flush() {
    for(let i=0;i<7;i++){render();await tick();}
    render();
  }
  return {
    flush, modes, mediaEvents, media, sent, expands, listeners,
    switcher:()=>find(ui,n=>n.props?.['aria-label']==='切换模型'),
    menu:()=>find(ui,n=>n.props?.id==='aia-model-menu'),
    form:()=>find(ui,n=>n.type==='form'&&n.props?.className==='composer'),
    fill:draft=>find(ui,n=>n.type==='textarea').props.onChange({target:{value:draft}}),
    className:()=>ui.props.className,
    press:key=>hooks.get('keydown')({key,preventDefault:noop}),
    frame:()=>{const now=raf;raf=[];for(const [,f] of now)f(10);},
    lists:()=>lists,
    focus:()=>focused
  };
}
async function main() {
  const m=createMockUI(false);
  await m.flush();
  assert.match(m.className(),/is-compact/);
  assert.equal(m.switcher(),undefined);
  m.fill('测试联网搜索功能');
  await m.flush();
  m.form().props.onSubmit({preventDefault:noop});
  await m.flush();
  assert.equal(m.sent.length,1);
  assert.match(m.className(),/is-expanded/);
  assert.doesNotMatch(m.className(),/is-opening-chat/);
  assert.equal(m.expands.length,1);
  m.expands[0]();
  await m.flush();
  assert.doesNotMatch(m.className(),/is-opening-chat/);
  m.frame();
  await m.flush();
  assert.match(m.className(),/is-opening-chat/);
  const icon=m.switcher().props.children[0];
  const iconResult=icon.type(icon.props);
  assert.equal(iconResult.type,'svg');
  assert.equal(iconResult.props['aria-hidden'],'true');
  assert.match(iconResult.props.children.props.d,/^m12 4/);
  assert.match(m.switcher().props.title,/mock-model/);
  m.switcher().props.onClick();
  await m.flush();
  assert.equal(m.switcher().props['aria-expanded'],true);
  assert.equal(m.switcher().props['aria-controls'],'aia-model-menu');
  assert.ok(m.menu());
  assert.equal(m.lists(),0);
  m.press('Escape');
  await m.flush();
  assert.equal(m.menu(),undefined);
  assert.equal(m.focus(),'switch');
  const form=m.form();
  form.props.onAnimationEnd({animationName:'aia-composer-settle',target:form,currentTarget:form});
  await m.flush();
  assert.doesNotMatch(m.className(),/is-opening-chat/);
  m.press('Escape');
  await m.flush();
  assert.match(m.className(),/is-compact/);
  assert.doesNotMatch(m.className(),/is-opening-chat/);
  const reduced=createMockUI(true);
  await reduced.flush();
  reduced.fill('without motion');
  await reduced.flush();
  reduced.form().props.onSubmit({preventDefault:noop});
  await reduced.flush();
  reduced.frame();
  await reduced.flush();
  assert.match(reduced.className(),/is-expanded/);
  assert.doesNotMatch(reduced.className(),/is-opening-chat/);
  assert.equal(reduced.expands.length,0);
  assert.match(style,/\.turn\.user \.message-tools\s*\{\s*position:static;[^}]*margin-top:5px/);
  assert.match(style,/\[aria-label="编辑重发"\]\s*\{\s*width:24px; height:24px; flex:none; background:transparent/);
  assert.match(style,/prefers-reduced-motion:no-preference/);
  console.log('PASS actual patched App state/markup with mocked IPC: expansion ACK, one frame before motion, one-shot animation-reset, reduced motion, icon-only model menu and Escape focus, static pencil CSS scope.');
}
main().catch(e=>{console.error(e);process.exitCode=1;});

