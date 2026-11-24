const {test} = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const os = require('node:os');
const {join} = require('node:path');
const {randomUUID,createHash} = require('node:crypto');
const main = fs.readFileSync(join(process.env.AIA_ASSEMBLY || __dirname + '/search-dev','out/main/index.js'),'utf8');
const take = (a,b) => main.slice(main.indexOf(a),main.indexOf(b,main.indexOf(a)+a.length));
const constants = 'const DEFAULT_BASE="https://api.deepseek.com", DEFAULT_MODEL="deepseek-flash";';
function fixture() {
 const base = { ...fs,join,randomUUID,createHash,Buffer,AbortSignal,TextDecoder,URL,Response,Error,Array,JSON,Set,Map };
 vm.createContext(base);
 vm.runInContext(constants+take('function json(file)', 'function readPlacement') .split('const TEXT_SYSTEM')[0]+take('const TEXT_SYSTEM','function statusError')+ '\nObject.assign(globalThis,{TrialStore,requestBody,officialSearch,officialSearchQuery,streamAnswer});',base);
 return base;
}
test('official settings are separate under safe storage; no gateway key forwarded or exposed', () => {
 const f=fixture(), dir=fs.mkdtempSync(join(os.tmpdir(),'aia-search-test-'));
 try {
  const s=new f.TrialStore(dir,{isEncryptionAvailable:()=>true,encryptString:t=>Buffer.from('secure:'+t),decryptString:b=>b.toString().replace(/^secure:/,'')});
  const relay={baseUrl:'https://example.invalid/v1',model:'relay',images:false};
  let c=s.saveConfig({...relay,apiKey:'relay-key'});
  assert.equal(c.hasSearchKey,false);
  assert.throws(()=>s.searchCredentials(),/官方搜索 Key/);
  c=s.saveConfig({...relay,searchApiKey:'deepseek-key'});
  assert.equal(c.hasSearchKey,true);
  assert.equal(c.hasSeparateSearchKey,true);
  assert.equal(c.encryptedSearchKey, undefined);
  assert.equal(s.searchCredentials(),'deepseek-key');
  assert.equal(s.credentials().key,'relay-key');
  assert.equal(s.credentials().encryptedSearchKey,undefined);
  c=s.saveConfig({...relay,model:'relay-new'});
  assert.equal(s.searchCredentials(),'deepseek-key');
  assert.equal(c.webSearch,false);
  c=s.saveConfig({...relay,clearSearchKey:true});
  assert.equal(c.hasSearchKey,false);
  c=s.saveConfig({baseUrl:'https://api.deepseek.com/v1',model:'deepseek-flash',images:false,apiKey:'official-model-key'});
  assert.equal(c.hasSearchKey,true);
  assert.equal(s.searchCredentials(),'official-model-key');
 } finally { fs.rmSync(dir,{recursive:true,force:true}); }
});
test('one bounded official call, valid HTTPS/HTTP links, truthful source evidence, no search credentials at chat provider',async ()=>{
 const f=fixture(), calls=[];
 const query=f.officialSearchQuery('  带  空格 🐟 '+ '🐟'.repeat(200));
 assert.equal(Array.from(query).length,128);
 assert.equal(query.startsWith('带 空格 🐟 '),true);
 const signal=new AbortController().signal;
 const fake=async (url,init)=>{
  calls.push({ url,init,payload:JSON.parse(init.body) });
  if(calls.length===1) return Response.json({results:[
   {url:'javascript:alert(1)',title:'bad'},
   {url:'https://name:pw@example.org/'},
   {url:'https://example.org/source',title:'report',snippet:'preview only',summary:'article summary',content:'do not include giant page'},
   {url:'https://example.org/source',title:'duplicate'},null
  ]});
  return new Response('data: {"choices":[{"delta":{"content":"回答[1]","annotations":[{"type":"url_citation","url":"https://fake.invalid"}]},"finish_reason":"stop"}]}\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
 };
 const results=await f.officialSearch('official-secret',query,signal,fake);
 const session={kind:'chat',messages:[{role:'user',text:'historical secret'},{role:'assistant',text:'old'},{role:'user',text:'typed today',images:[{dataUrl:'data:image/png;base64,AA=='}]}]};
 let text='';
 const answer=await f.streamAnswer({baseUrl:'https://gateway.invalid/v1',model:'demo',images:true,key:'relay-secret'},session,signal,d=>text+=d,fake,results);
 assert.equal(text,'回答[1]');
 assert.equal(calls.length,2);
 assert.equal(calls[0].url,'https://api.deepseek.com/v1/tools/search');
 assert.equal(calls[0].init.headers.Authorization,'Bearer official-secret');
 assert.equal(calls[0].init.redirect,'error');
 assert.equal(JSON.stringify(calls[0].payload),JSON.stringify({query,count:4,need_content:false}));
 assert.equal(calls[1].url,'https://gateway.invalid/v1/chat/completions');
 assert.equal(calls[1].init.headers.Authorization,'Bearer relay-secret');
 assert.ok(!calls[1].init.body.includes('official-secret'));
 assert.ok(!calls[1].init.body.includes('giant page'));
 assert.equal(calls[1].payload.tools,undefined);
 assert.equal(calls[1].payload.messages[1].content,'historical secret');
 assert.ok(calls[1].payload.messages.at(-1).content[0].text.includes('article summary'));
 assert.equal(calls[1].payload.messages.at(-1).content[1].image_url.url,'data:image/png;base64,AA==');
 assert.equal(JSON.stringify(answer.sources),JSON.stringify([{title:'report',url:'https://example.org/source'}]));
});
test('billing/auth/rate failures and empty results never retry and never masquerade as plain answer',async ()=>{
 const f=fixture();
 for(const [res,expected] of [[new Response('secret',{status:401}),/鉴权/],[new Response('',{status:402}),/余额/],[new Response('',{status:429}),/限流/],[Response.json({results:[]}),/没有找到/],[Response.json({}),/格式/]]) {
  let n=0;
  await assert.rejects(f.officialSearch('mock','question',new AbortController().signal,async()=>{n++;return res}),expected);
  assert.equal(n,1);
 }
});
test('search is a one-shot renderer intent, absent without key, no reason toggle or attached content',()=>{
 const dir=process.env.AIA_ASSEMBLY || __dirname+'/search-dev';
 const a=fs.readFileSync(join(dir,'out/renderer/assets/trial-DGJV07EL.js'),'utf8');
 assert.ok(a.includes('active.hasSearchKey && searchArmed && !citation'));
 assert.ok(a.includes('if (useOfficialSearch) setSearchArmed(false)'));
 assert.ok(a.includes('config?.hasSearchKey && !history && !settings && !selection'));
 assert.ok(!a.includes('"aria-label": "深度思考"'));
 assert.ok(a.includes('action === "edit" && !!message && config?.hasSearchKey'));
 assert.ok(main.includes('search ? await officialSearch'));
 for (const fn of ['historyClick','resetChat','collapse']) assert.ok(a.includes('function '+fn+'() {\n    setSearchArmed(false);'));
 assert.ok(main.includes('if (input.selection) throw'));
});
