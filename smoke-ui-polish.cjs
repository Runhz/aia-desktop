const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const { chromium } = require('playwright');

const staged = process.argv[2] || path.join(__dirname,'staged');
const root = path.join(staged,'out/renderer');
const origin = 'https://aia-ui-fixture.invalid';

async function fixture(page) {
  const faults = [];
  page.on('pageerror', e => faults.push(e.message));
  await page.route('**/*', async route => {
    const url = new URL(route.request().url());
    if (url.origin !== origin) return route.abort();
    const file = path.join(root,url.pathname);
    try {
      const body = await fs.readFile(file);
      return route.fulfill({body, contentType:
         file.endsWith('.css') ? 'text/css' :
         file.endsWith('.js') ? 'application/javascript' : 'text/html'});
    } catch {
      return route.fulfill({status:404});
    }
  });
  await page.addInitScript(() => {
    const w = window;
    const listeners = {};
    const listen = name => callback => {
      listeners[name] = callback;
      return () => { if (listeners[name] === callback) delete listeners[name]; };
    };
    const rec = w.fixture = {sent:0, listings:0, saves:0, moments:[], sends:[], ordinaryModes:[], waapi:[]};
    w.addEventListener('animationstart', e => {
      if (e.animationName.startsWith('aia-')) rec.moments.push(e.animationName);
    });
    const nativeAnimate = Element.prototype.animate;
    Element.prototype.animate = function (keyframes, options) {
      if (this.matches('.user .message')) rec.waapi.push({keyframes,options});
      return nativeAnimate.call(this,keyframes,options);
    };
    let cfg = {baseUrl:'https://fixture.model.invalid/v1', model:'fixture-original', hasKey:true, images:false,
      capabilities:{thinking:true,webSearch:true}, thinking:'off', webSearch:false};
    let history = [];
    w.aiaTrial = {
      onMaintenanceCheck:listen('maintenance'), onReveal:listen('reveal'), onCollapse:listen('collapse'),
      onSelection:listen('selection'), onStream:listen('stream'),
      windowMode: async (mode, reduced) => {
        rec.ordinaryModes.push({mode,reduced});
        if (mode === 'expanded' && !reduced && rec.sends.length === 0 && !rec.allowExpand) {
          await new Promise(resolve => { rec.ackExpand=resolve; });
        }
      },
      config: async () => cfg,
      saveConfig: async fields => {
        rec.saves++;
        return cfg = {...cfg,...fields};
      },
      listModels: async () => {
        rec.listings++;
        return ['fixture-original','fixture-new'];
      },
      send: async opt => {
        rec.sent++;
        rec.sends.push({text:opt.text, requestId:opt.requestId});
        const id = opt.requestId;
        history = [...history, {id:'fixture-user-'+id,role:'user',text:opt.text},
          {id:'fixture-assistant-'+id,role:'assistant',text:'Mock reply only.',status:'done'}];
        return {id:'fixture-chat'};
      },
      load: async id => ({id,messages:history}),
      list: async () => [],
      copyReply: async () => {},
      stop: async () => {}
    };
    rec.complete = () => {
      const last = rec.sends.at(-1);
      listeners.stream({type:'delta',text:'Mock partial',requestId:last.requestId,sessionId:'fixture-chat'});
      setTimeout(() => listeners.stream({type:'done',requestId:last.requestId,sessionId:'fixture-chat'}), 220);
    };
  });
  await page.goto(origin+'/trial.html');
  await page.getByRole('textbox',{name:'输入问题'}).waitFor();
  return faults;
}

async function main() {
  const browser=await chromium.launch({executablePath:process.env.CHROMIUM||'/usr/bin/chromium',args:['--no-sandbox']});
  try {
    const page=await browser.newPage({viewport:{width:386,height:100}});
    const faults=await fixture(page);
    const prompt=page.getByRole('textbox',{name:'输入问题'});
    const model=page.getByRole('button',{name:'切换模型',exact:true});
    assert.equal(await model.count(),0);
    await prompt.fill('测试联网搜索功能');
    await prompt.press('Enter');
    await page.waitForFunction(() => window.fixture.ackExpand && window.fixture.sent === 1);
    assert.equal(await page.locator('.is-opening-chat').count(),0);
    await page.setViewportSize({width:516,height:660});
    await page.evaluate(() => {window.fixture.allowExpand=true; window.fixture.ackExpand();});
    await page.waitForFunction(() => window.fixture.moments.includes('aia-composer-settle'));
    await page.waitForFunction(() => window.fixture.moments.includes('aia-panel-rise'));
    await model.waitFor();
    assert.equal(await model.textContent(),'');
    assert.equal(await model.locator('svg').count(),1);
    assert.match(await model.getAttribute('title'), /fixture-original/);
    assert.equal(await model.evaluate(el=>el.getBoundingClientRect().width),28);
    assert.equal(await page.evaluate(()=>window.fixture.listings),0);
    await model.click();
    assert.equal(await model.getAttribute('aria-expanded'),'true');
    const menu=page.getByRole('group',{name:'选择模型'});
    await menu.waitFor();
    assert.equal(await menu.getAttribute('id'), await model.getAttribute('aria-controls'));
    await page.waitForFunction(() => document.activeElement?.id==='aia-chat-model');
    await page.keyboard.press('Escape');
    await menu.waitFor({state:'detached'});
    assert.equal(await model.evaluate(el=>el===document.activeElement),true);
    await page.keyboard.press('Space');
    await menu.waitFor();
    assert.equal(await page.evaluate(()=>window.fixture.listings),0);
    await menu.getByRole('button',{name:'获取模型列表'}).click();
    await menu.getByRole('button',{name:'fixture-new',exact:true}).click();
    await menu.waitFor({state:'detached'});
    assert.match(await model.getAttribute('title'),/fixture-new/);
    assert.deepEqual(await page.evaluate(()=>[window.fixture.listings,window.fixture.saves]),[1,1]);
    await page.evaluate(()=>window.fixture.complete());
    const pencil=page.getByRole('button',{name:'编辑重发'}).first();
    await page.getByText('Mock reply only.',{exact:true}).waitFor();
    assert.equal(await pencil.isEnabled(),true);
    const dimensions=await pencil.evaluate(el=>{
      const style=getComputedStyle(el);
      const button=el.getBoundingClientRect();
      const bubble=el.closest('.turn').querySelector('.message').getBoundingClientRect();
      return {gap:button.top-bubble.bottom, fill:style.backgroundColor, color:style.color,
        position:getComputedStyle(el.parentElement).position, width:button.width,height:button.height};
    });
    assert.ok(dimensions.gap>=5);
    assert.equal(dimensions.fill,'rgba(0, 0, 0, 0)');
    assert.equal(dimensions.position,'static');
    assert.equal(dimensions.width,24);
    assert.equal(dimensions.height,24);
    await pencil.hover();
    await page.waitForFunction(() => getComputedStyle(document.querySelector('.turn.user [aria-label="编辑重发"]')).color==='rgb(137, 63, 44)');
    assert.equal(await pencil.evaluate(el=>getComputedStyle(el).backgroundColor),'rgba(0, 0, 0, 0)');
    await pencil.click();
    const edit=page.getByRole('textbox',{name:'编辑原消息'});
    await edit.waitFor();
    assert.equal(await edit.inputValue(),'测试联网搜索功能');
    await page.keyboard.press('Escape');
    await prompt.waitFor();
    assert.equal(await prompt.inputValue(),'');
    await page.keyboard.press('Tab');
    await pencil.focus();
    assert.equal(await pencil.evaluate(el=>getComputedStyle(el).outlineStyle),'solid');
    await prompt.fill('Second mock');
    await prompt.press('Enter');
    await page.waitForFunction(()=>window.fixture.sent===2);
    await page.waitForFunction(()=>!document.querySelector('.is-opening-chat'));
    const smoke=await page.evaluate(()=>({motion:[...window.fixture.moments],waapi:window.fixture.waapi.length}));
    assert.deepEqual(smoke.motion.sort(),['aia-composer-settle','aia-panel-rise'].sort());
    assert.equal(smoke.waapi,1);
    await page.keyboard.press('Escape');
    await page.locator('.is-compact').waitFor();
    await page.keyboard.press('Control+,');
    await page.getByRole('heading',{name:'模型配置'}).waitFor();
    assert.deepEqual(await page.evaluate(()=>window.fixture.moments.sort()),smoke.motion);
    assert.deepEqual(faults,[]);

    const reduced=await browser.newPage({viewport:{width:516,height:660},reducedMotion:'reduce'});
    const reducedFaults=await fixture(reduced);
    await reduced.getByRole('textbox',{name:'输入问题'}).fill('Reduced test');
    await reduced.getByRole('textbox',{name:'输入问题'}).press('Enter');
    await reduced.waitForFunction(()=>window.fixture.sent===1);
    await reduced.getByRole('button',{name:'切换模型',exact:true}).waitFor();
    await reduced.evaluate(()=>window.fixture.complete());
    await reduced.getByText('Mock reply only.',{exact:true}).waitFor();
    assert.deepEqual(await reduced.evaluate(()=>({
      motion:window.fixture.moments, blob:window.fixture.waapi, mode:window.fixture.ordinaryModes.at(-1)
    })),{motion:[],blob:[],mode:{mode:'expanded',reduced:true}});
    assert.deepEqual(reducedFaults,[]);
    console.log('PASS Chromium: native ack and two compositor tracks, 1 bubble transfer/no replays, reduced motion, icon menu keyboard/model choice, independent bare pencil layout/contrast/Edit+Esc, collapse and settings.');
  } finally { await browser.close(); }
}
main().catch(e=>{console.error(e);process.exitCode=1});

