import {test,expect} from '@playwright/test';
import { SALES_TERMS_TEXT } from '../lib/legal/sales-terms';
import { SALES_TERMS_DOWNLOAD, SALES_TERMS_VERSION } from '../lib/legal/sales-terms-version';

test('S8 people discovery endpoints do not expose real members to anonymous or demo readers', async ({browser,baseURL}) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE,'Retained demo identity');
  const anonymous=await browser.newContext({baseURL}), demo=await browser.newContext({baseURL,storageState:process.env.E2E_DEMO_STORAGE_STATE});
  try {
    for (const [context,status] of [[anonymous,401],[demo,403]] as const) {
      const exact=await context.request.post('/api/validate-user',{data:{input:'Veggat'}});
      expect(exact.status()).toBe(status);expect(exact.headers()['cache-control']).toContain('no-store');expect(exact.headers()['vary']).toContain('Cookie');
      expect(await exact.json()).toMatchObject(status===403?{error:'DEMO_READ_ONLY'}:{isValid:false});
      const suggested=await context.request.get('/api/users/suggestions?limit=5');
      expect(suggested.status()).toBe(status===401?401:200);expect(suggested.headers()['cache-control']).toContain('no-store');
      if(status!==401) expect(await suggested.json()).toEqual({suggestions:[]});
    }
    expect((await demo.request.get('/api/users/suggestions?limit=-1')).status()).toBe(400);
  } finally {await anonymous.close();await demo.close();}
});


test('S8 people discovery offers responsive search, retry and confirmed follow states', async ({browser,baseURL},info) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE,'Retained demo identity; all follow writes intercepted');
  const context=await browser.newContext({baseURL,storageState:process.env.E2E_DEMO_STORAGE_STATE,viewport:{width:390,height:844},reducedMotion:'reduce'});
  if(process.env.E2E_PEOPLE_THEME==='dark') await context.addInitScript(()=>localStorage.setItem('veggat:theme','dark'));
  const session=await (await context.request.get('/api/auth/session')).json();expect(session.user.id).toMatch(/^demo_/);
  const page=await context.newPage(), errors:string[]=[];
  page.on('pageerror',error=>errors.push(error.message));
  let demoSession=false, suggestionFailure=true, followFailure=true, followWrites=0, suggestionReads=0;
  const row={id:'qa-person',name:'Alex Example',email:null,image:'/users/avatar.webp',bio:null,followerCount:2,isFollowing:false};
  const posts=Array.from({length:12},(_,index)=>({id:'qa-discovery-post-'+index,title:'Discovery layout '+index,
    description:'Public reading sample '+index+'. The people panel must stay reachable above a populated mobile feed.',
    type:'PUBLIC_THREAD',tags:['layout'],userId:'qa-author',user:{id:'qa-author',name:'Layout sample',email:''},createdAt:'2026-01-01T12:00:00.000Z',messageCount:1,hasPoll:false}));
  await page.route('**/api/conversations?**',route=>route.fulfill({json:{conversations:posts,nextCursor:null}}));
  await page.route('**/api/conversations/*/view',route=>route.fulfill({json:{success:true}}));
  await page.route('**/api/auth/session',route=>route.fulfill({json:demoSession?session:{...session,user:{...session.user,id:'qa-viewer',isDemo:false,role:'USER'}}}));
  await page.route('**/api/users/suggestions?**',route=>{suggestionReads++;return route.fulfill(suggestionFailure?{status:503,json:{error:'Unavailable'}}:{json:{suggestions:[{...row,reason:'Recent chat',priority:1}]}});});
  await page.route('**/api/users/search?**',async route=>{
    const term=new URL(route.request().url()).searchParams.get('q');
    if(term==='slow') await new Promise(resolve=>setTimeout(resolve,800));
    if(term==='error') return route.fulfill({status:429,json:{error:'Wait'}});
    return route.fulfill({json:{users:term==='nobody'?[]:[{...row,role:null,name:term==='slow'?'Stale result':'Taylor Example'}],count:term==='nobody'?0:1}});
  });
  await page.route('**/api/users/qa-person/follow',async route=>{
    followWrites++;await new Promise(resolve=>setTimeout(resolve,200));
    return route.fulfill(followFailure?{status:503,json:{error:'Unavailable'}}:{json:{success:true,isFollowing:route.request().method()==='POST',followerCount:3,followingCount:1}});
  });
  try {
    await page.goto('/pulse',{waitUntil:'domcontentloaded'});
    await expect(page.getByRole('button',{name:'Open menu',exact:true})).toBeEnabled();
    const consent=page.getByRole('button',{name:'Essential Only',exact:true});if(await consent.isVisible())await consent.click();
    const refreshed=page.waitForResponse(r=>r.url().includes('/api/auth/session'));
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await refreshed;
    expect(suggestionReads).toBe(0);
    await expect(page.getByRole('feed',{name:'Pulse feed'}).getByRole('article')).toHaveCount(12);
    const disclosure=page.locator('details > summary').filter({hasText:'Find people'});
    const disclosureBox=await disclosure.boundingBox(), feedBox=await page.getByRole('feed',{name:'Pulse feed'}).boundingBox();
    expect(disclosureBox!.y+disclosureBox!.height).toBeLessThanOrEqual(feedBox!.y);
    await page.locator('details > summary').filter({hasText:'Find people'}).click();
    const panel=page.getByRole('region',{name:'Find people',exact:true}).filter({visible:true});
    await expect(panel.getByText('People could not be loaded. Try again.')).toBeVisible();
    expect(suggestionReads).toBe(1);
    suggestionFailure=false;await panel.getByRole('button',{name:'Retry people'}).click();
    await expect(panel.getByRole('link',{name:/Alex Example/})).toBeVisible();
    await expect(panel.getByRole('link',{name:/Alex Example/})).toHaveAttribute('href','/profile/qa-person');
    await expect(panel.locator('a[href="/users"]')).toHaveCount(0);
    const follow=panel.getByRole('button',{name:'Follow Alex Example'});
    await expect(follow).toHaveCSS('opacity','1');expect((await follow.boundingBox())!.height).toBeGreaterThanOrEqual(44);
    await follow.focus();await page.keyboard.press('Enter');
    await expect(panel.getByRole('alert')).toContainText('Could not confirm');expect(followWrites).toBe(1);await expect(follow).toBeDisabled();
    await panel.getByRole('button',{name:'Refresh people'}).click();await expect(follow).toBeEnabled();
    followFailure=false;await follow.click();await expect(panel.getByRole('button',{name:'Unfollow Alex Example'})).toBeVisible();expect(followWrites).toBe(2);
    const input=panel.getByRole('searchbox',{name:'Search people'});
    await input.fill('slow');await page.waitForRequest(r=>r.url().includes('q=slow'));
    await input.fill('Taylor');await expect(panel.getByRole('link',{name:/Taylor Example/})).toBeVisible();
    await expect(panel.getByText('Stale result')).toHaveCount(0);
    await input.fill('error');await expect(panel.getByText('Too many searches. Wait a moment, then retry.')).toBeVisible();
    await input.fill('nobody');await expect(panel.getByText('No people found.')).toBeVisible();
    await input.fill('a');await expect(panel.getByText('Type at least 2 characters.')).toBeVisible();await input.fill('Alex');
    for(const [width,height] of [[360,800],[390,844],[844,390],[768,1024],[1024,1280],[1280,800],[1920,1080],[2560,1440]]) {
      await page.setViewportSize({width,height});
      const shown=page.getByRole('region',{name:'Find people',exact:true}).filter({visible:true});
      await shown.scrollIntoViewIfNeeded();
      if(width>=1024){await shown.getByRole('searchbox').fill('Alex');}
      await expect(shown.getByRole('link',{name:/Taylor Example/})).toBeVisible();
      const box=await shown.boundingBox();expect(box!.width).toBeGreaterThan(220);expect(box!.x).toBeGreaterThanOrEqual(0);expect(box!.x+box!.width).toBeLessThanOrEqual(width+1);
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      const button=shown.getByRole('button',{name:'Follow Taylor Example'});await expect(button).toHaveCSS('opacity','1');expect((await button.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      await page.screenshot({path:info.outputPath('people-'+width+'.png')});
    }
    await page.setViewportSize({width:1280,height:800});
    const explore=page.locator('[data-pulse-explore-scroll]');await explore.scrollIntoViewIfNeeded();
    const site=page.locator('[data-site-scroll]'),position=await site.evaluate(element=>element.scrollTop);
    const exploreBox=(await explore.boundingBox())!;await page.mouse.move(exploreBox.x+exploreBox.width-15,Math.max(150,exploreBox.y+200));await page.mouse.wheel(0,600);
    await expect.poll(()=>explore.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
    expect(await site.evaluate(element=>element.scrollTop)).toBe(position);
    await expect(page.getByRole('feed',{name:'Pulse feed'}).getByRole('article').first()).toHaveCSS('backdrop-filter','none');
    await page.screenshot({path:info.outputPath('feed-after-sidebar-wheel.png')});
    // Account transition clears private UI instead of retaining the previous person's list.
    demoSession=true;const reset=page.waitForResponse(r=>r.url().includes('/api/auth/session'));await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await reset;
    await expect(panel.getByText('People search is off in the demo.')).toBeVisible();await expect(panel.getByRole('searchbox')).toHaveCount(0);
    expect(errors).toEqual([]);
  }finally{await context.close();}
});


test('S8 Pulse cards provide labelled keyboard actions and responsive touch targets', async ({browser,baseURL},info) => {
  test.skip(!process.env.E2E_DEMO_STORAGE_STATE,'Retained demo identity; all post writes intercepted');
  const context=await browser.newContext({baseURL,storageState:process.env.E2E_DEMO_STORAGE_STATE,viewport:{width:390,height:844},reducedMotion:'reduce'});
  const page=await context.newPage(),errors:string[]=[],writes:string[]=[];
  let releaseHeartbeat:(()=>void)|undefined;
  page.on('pageerror',error=>errors.push(error.message));
  const session=await (await context.request.get('/api/auth/session')).json();expect(session.user.id).toMatch(/^demo_/);
  const post={id:'qa-keyboard-pulse',title:'Keyboard sample',description:'A readable post with keyboard-accessible actions.',type:'PUBLIC_THREAD',tags:['layout'],userId:'qa-author',user:{id:'qa-author',name:'Layout sample',email:''},createdAt:'2026-01-01T12:00:00.000Z',messageCount:1,hasPoll:false,
    repostOfConversation:{id:'qa-original-pulse',title:'The original post',user:{name:'Original author'}}};
  await page.route('**/api/auth/session',route=>route.fulfill({json:{...session,user:{...session.user,id:'qa-viewer',isDemo:false,role:'USER'}}}));
  await page.route('**/api/conversations?**',route=>route.fulfill({json:{conversations:[post],nextCursor:null}}));
  await page.route('**/api/conversations/*/view',route=>route.fulfill({json:{success:true}}));
  await page.route('**/api/users/suggestions?**',route=>route.fulfill({json:{suggestions:[]}}));
  await page.route('**/api/conversations/qa-keyboard-pulse/pulse',async route=>{
    writes.push(route.request().postData()??'');
    if(writes.length===1)await new Promise<void>(resolve=>{releaseHeartbeat=resolve;});
    return route.fulfill({json:{currentPulse:writes.length===1?'POSITIVE':null,positivePulseCount:writes.length===1?1:0}});
  });
  try {
    await page.goto('/pulse',{waitUntil:'domcontentloaded'});
    await expect(page.getByRole('button',{name:'Open menu',exact:true})).toBeEnabled();
    const consent=page.getByRole('button',{name:'Essential Only',exact:true});if(await consent.isVisible())await consent.click();
    const refreshed=page.waitForResponse(r=>r.url().includes('/api/auth/session'));
    await page.evaluate(()=>document.dispatchEvent(new Event('visibilitychange')));await refreshed;
    const card=page.getByRole('feed',{name:'Pulse feed'}).getByRole('article');await expect(card).toHaveCount(1);
    const options=card.getByRole('button',{name:'Pulse options for Layout sample'});
    await options.focus();await page.keyboard.press('Enter');
    await expect(page.getByRole('menu')).toBeVisible();await page.keyboard.press('Escape');await expect(options).toBeFocused();
    const heartbeat=card.getByRole('button',{name:'Heartbeat pulse by Layout sample'});
    await expect(heartbeat).toHaveAttribute('aria-pressed','false');
    await heartbeat.focus();await page.keyboard.press('Space');await expect(heartbeat).toHaveAttribute('aria-busy','true');await expect(heartbeat).toBeFocused();
    await page.keyboard.press('Space');expect(writes).toHaveLength(1);releaseHeartbeat!();
    await expect(heartbeat).toHaveAttribute('aria-pressed','true');await expect(heartbeat).toHaveAttribute('aria-busy','false');await expect(heartbeat).toBeFocused();
    await page.keyboard.press('Space');await expect(heartbeat).toHaveAttribute('aria-pressed','false');await expect(heartbeat).toHaveAttribute('aria-busy','false');expect(writes).toEqual(['{"type":"POSITIVE"}','{"type":"POSITIVE"}']);
    const tag=card.getByRole('button',{name:'Filter by #layout'});await tag.focus();await page.keyboard.press('Enter');
    await expect(page).toHaveURL(/\/pulse\?tag=layout$/);await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(card.getByRole('link',{name:/Quoting Original author/})).toHaveAttribute('href','/conversations/qa-original-pulse');
    await expect(card.getByRole('link',{name:'Open pulse by Layout sample'})).toHaveAttribute('href','/pulse/qa-keyboard-pulse');
    for(const [width,height] of [[360,800],[390,844],[844,390],[1024,1280],[1280,800],[2560,1440]]) {
      await page.setViewportSize({width,height});await card.scrollIntoViewIfNeeded();
      for(const control of [options,heartbeat,tag]){const rect=(await control.boundingBox())!;expect(rect.width).toBeGreaterThanOrEqual(44);expect(rect.height).toBeGreaterThanOrEqual(44);}
      expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
      expect(await page.locator('[data-site-scroll]').evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
      expect(await card.evaluate(element=>element.scrollWidth<=element.clientWidth)).toBe(true);
      await expect(card).toHaveCSS('transition-property','none');
      await page.screenshot({path:info.outputPath('pulse-actions-'+width+'.png')});
    }
    expect(errors).toEqual([]);
  }finally{releaseHeartbeat?.();await context.close();}
});


test('Platform consent paints before app bundles without flashing saved choices or granting tracking',async({browser,baseURL})=>{
  test.skip(process.env.E2E_CONSENT!=='1','Focused pre-hydration consent acceptance');
  test.setTimeout(120000);
  for(const choice of ['new','essential','analytics','invalid','blocked'] as const){
    const context=await browser.newContext({baseURL,viewport:{width:390,height:844},reducedMotion:'reduce'});
    await context.addInitScript(choice=>{
      if(choice==='essential'||choice==='analytics')localStorage.setItem('veggat:cookieConsent',JSON.stringify({version:1,analytics:choice==='analytics'}));
      if(choice==='invalid')localStorage.setItem('veggat:cookieConsent','{"version":2,"analytics":true}');
      if(choice==='blocked'){const read=Storage.prototype.getItem;Storage.prototype.getItem=function(key){if(key==='veggat:cookieConsent')throw Error('Storage blocked');return read.call(this,key);};}
    },choice);
    const page=await context.newPage(),scripts:string[]=[],errors:string[]=[];
    page.on('pageerror',error=>errors.push(error.message));
    let release=()=>{},heldBundles=0;const bundles=new Promise<void>(resolve=>{release=resolve;});
    // Hosted chunk URLs can carry deployment query strings.
    await page.route(/\/_next\/static\/.*\.js(?:\?.*)?$/,async route=>{heldBundles++;await bundles;await route.continue();});
    await page.route('**/_vercel/**',route=>{scripts.push(new URL(route.request().url()).pathname);return route.fulfill({contentType:'application/javascript',body:''});});
    try{
      await page.goto('/',{waitUntil:'commit'});
      await expect.poll(()=>heldBundles).toBeGreaterThan(0);
      const panel=page.getByRole('region',{name:'Cookie Preferences',exact:true});
      await expect(page.locator('[data-cookie-banner]')).toHaveCount(1);
      expect(await page.locator('#consent-visibility').evaluate((element:HTMLScriptElement)=>Boolean(element.nonce))).toBe(true);
      if(choice==='essential'||choice==='analytics')await expect(panel).toBeHidden();
      else{await expect(panel).toBeVisible();await expect(panel).toHaveCSS('opacity','1');await expect(panel.getByRole('button',{name:'Customize cookie preferences',exact:true})).toBeDisabled();}
      expect(scripts).toEqual([]);
      release();
      // Background connections are not hydration readiness. Bound the idle wait
      // and prove the actual menu responds before inspecting the state handover.
      await page.waitForLoadState('networkidle',{timeout:5000}).catch(()=>{});
      await page.getByRole('button',{name:'Open menu',exact:true}).click();
      await expect(page.getByRole('heading',{name:'Navigation Menu',exact:true})).toBeVisible();
      await page.getByRole('button',{name:'Close',exact:true}).click();
      await expect(page.getByRole('heading',{name:'Navigation Menu',exact:true})).toBeHidden();
      expect(await page.locator('html').getAttribute('data-saved-consent')).toBeNull();
      if(choice==='essential'||choice==='analytics')await expect(panel).toHaveCount(0);else await expect(panel).toBeVisible();
      if(choice==='analytics')await expect.poll(()=>scripts.some(path=>path.includes('/insights/'))&&scripts.some(path=>path.includes('/speed-insights/'))).toBe(true);
      else expect(scripts).toEqual([]);
      expect(errors).toEqual([]);
    }finally{release();await context.close();}
  }
});


test('Platform consent controls fit every viewport and release scrolling immediately', async ({browser,baseURL},testInfo)=>{
  test.skip(process.env.E2E_CONSENT !== '1','Focused optional-telemetry and consent presentation acceptance');
  test.setTimeout(120_000);
  const context=await browser.newContext({baseURL,viewport:{width:390,height:844},reducedMotion:'no-preference'});
  if(process.env.E2E_CONSENT_THEME==='dark') await context.addInitScript(()=>localStorage.setItem('veggat:theme','dark'));
  const page=await context.newPage(), scripts:string[]=[], errors:string[]=[];
  page.on('pageerror',e=>errors.push(e.message));
  // Observe actual SDK script mounting, without sending synthetic QA visits or
  // performance measurements to analytics. Event-level revocation has units.
  await page.route('**/_vercel/**',route=>{scripts.push(new URL(route.request().url()).pathname);return route.fulfill({contentType:'application/javascript',body:''});});
  try{
    await page.goto('/terms',{waitUntil:'domcontentloaded'});
    const panel=page.getByRole('region',{name:'Cookie Preferences',exact:true});
    await expect(panel).toBeVisible();expect(scripts).toEqual([]);
    await panel.getByRole('button',{name:'Customize cookie preferences',exact:true}).click();
    await expect(panel.getByRole('switch',{name:'Analytics',exact:true})).not.toBeChecked();
    for(const size of [{width:360,height:800},{width:390,height:844},{width:844,height:390},{width:768,height:1024},{width:1024,height:768},{width:1280,height:800},{width:1920,height:1080},{width:2560,height:1080}]){
      await page.setViewportSize(size);
      await expect.poll(()=>panel.evaluate(el=>{const b=el.getBoundingClientRect();return b.left>=15&&b.right<=innerWidth-15&&b.top>=15&&b.bottom<=innerHeight-15;})).toBe(true);
      expect(await panel.evaluate(el=>el.scrollWidth<=el.clientWidth)).toBe(true);
      for(const name of ['Essential Only','Save Preferences','Back']){
        const control=panel.getByRole('button',{name,exact:true});await expect(control).toBeInViewport();expect((await control.boundingBox())!.height).toBeGreaterThanOrEqual(44);
      }
      const scroll=panel.locator('[data-cookie-scroll]'), box=await scroll.boundingBox();
      const before=await page.locator('[data-site-scroll]').evaluate(el=>el.scrollTop);
      await page.mouse.move(box!.x+box!.width/2,box!.y+box!.height/2);await page.mouse.wheel(0,5000);
      await expect.poll(()=>scroll.evaluate(el=>Math.abs(el.scrollHeight-el.clientHeight-el.scrollTop))).toBeLessThan(2);
      expect(await page.locator('[data-site-scroll]').evaluate(el=>el.scrollTop)).toBe(before);
      if([390,844,1280].includes(size.width))await page.screenshot({path:testInfo.outputPath(`consent-${size.width}.png`)});
    }
    await page.setViewportSize({width:1280,height:800});
    expect(await panel.evaluate(el=>el.contains(document.elementFromPoint(120,720)))).toBe(false);
    await panel.getByRole('button',{name:'Essential Only',exact:true}).click();
    // Deliberately no exit-animation wait before this first wheel gesture.
    await page.mouse.move(640,700);await page.mouse.wheel(0,700);
    await expect.poll(()=>page.locator('[data-site-scroll]').evaluate(el=>el.scrollTop)).toBeGreaterThan(200);
    await expect(panel).toHaveCount(0);expect(scripts).toEqual([]);
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('veggat:cookieConsent')!).analytics)).toBe(false);
    const reopen=async()=>{
      await page.getByRole('button',{name:'Open menu',exact:true}).click();
      const drawer=page.getByRole('dialog',{name:'Navigation Menu',exact:true});
      await drawer.getByRole('button',{name:'Cookie preferences',exact:true}).click();await expect(drawer).toBeHidden();await expect(panel).toBeVisible();
      await expect(panel.getByRole('heading',{name:'Cookie Preferences',exact:true})).toBeFocused();
    };
    await reopen();await panel.getByRole('switch',{name:'Analytics',exact:true}).check();
    expect(scripts).toEqual([]);await panel.getByRole('button',{name:'Save Preferences',exact:true}).click();
    await expect.poll(()=>scripts.some(path=>path.includes('/insights/'))).toBe(true);
    await expect.poll(()=>scripts.some(path=>path.includes('/speed-insights/'))).toBe(true);
    await reopen();await expect(panel.getByRole('switch',{name:'Analytics',exact:true})).toBeChecked();
    await panel.getByRole('switch',{name:'Analytics',exact:true}).focus();await page.keyboard.press('Space');
    await panel.getByRole('button',{name:'Save Preferences',exact:true}).click();
    expect(await page.evaluate(()=>JSON.parse(localStorage.getItem('veggat:cookieConsent')!).analytics)).toBe(false);
    scripts.length=0;await page.reload({waitUntil:'domcontentloaded'});await expect(page.getByRole('heading',{name:'Salgsvilkår',exact:true})).toBeVisible();
    await page.getByRole('button',{name:'Open menu',exact:true}).click();await expect(page.getByRole('dialog',{name:'Navigation Menu',exact:true})).toBeVisible();await page.keyboard.press('Escape');
    expect(scripts).toEqual([]);await expect(panel).toHaveCount(0);expect(errors).toEqual([]);
  }finally{await context.close();}
});


test('S4 full terms are readable without JavaScript, navigable and downloadable at every viewport', async ({ browser, baseURL }, testInfo) => {
  test.skip(process.env.E2E_TERMS !== '1', 'Focused terms release acceptance');
  test.setTimeout(120_000);
  const context = await browser.newContext({ baseURL, viewport: { width: 390, height: 844 }, reducedMotion: 'reduce', javaScriptEnabled: false });
  const page = await context.newPage();
  try {
    await page.goto('/terms', { waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-cookie-banner]')).toBeHidden();
    const article = page.getByRole('article', { name: 'Salgsvilkår' });
    await expect(article.getByRole('heading', { name: 'Salgsvilkår', exact: true })).toBeVisible();
    await expect(article).toHaveAttribute('lang', 'nb');
    for (const size of [{ width: 360, height: 800 }, { width: 390, height: 844 }, { width: 844, height: 390 }, { width: 768, height: 1024 }, { width: 1024, height: 768 }, { width: 1280, height: 800 }, { width: 1920, height: 1080 }, { width: 2560, height: 1080 }]) {
      await page.setViewportSize(size);
      const contents = article.getByRole('navigation', { name: 'Innhold i salgsvilkårene' });
      await contents.getByRole('link', { name: '4. Angrerett', exact: true }).click();
      await expect(page).toHaveURL(/\/terms#section-4$/);
      await expect(article.getByRole('heading', { name: '4. Angrerett', exact: true })).toBeInViewport();
      const form = article.getByText('Vis angreskjema', { exact: true });
      await form.scrollIntoViewIfNeeded();
      if (!await form.locator('..').getAttribute('open').then(value => value !== null)) await form.click();
      await expect(article.getByText(/ANGRESKJEMA — VARER OG TJENESTER/)).toBeVisible();
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
      expect(await page.locator('[data-site-scroll]').evaluate(node => node.scrollWidth <= node.clientWidth)).toBe(true);
      if ([390, 1280].includes(size.width)) {
        await page.screenshot({ path: testInfo.outputPath(`terms-form-${size.width}.png`) });
        await article.getByRole('heading', { name: 'Salgsvilkår', exact: true }).scrollIntoViewIfNeeded();
        await page.screenshot({ path: testInfo.outputPath(`terms-top-${size.width}.png`) });
      }
    }
    const downloadPromise = page.waitForEvent('download');
    await article.getByRole('link', { name: 'Last ned vilkår og angreskjema (.txt)', exact: true }).click();
    const download = await downloadPromise;
    expect(download.suggestedFilename()).toBe(`veggat-sales-terms-${SALES_TERMS_VERSION}.txt`);
    const stream = await download.createReadStream();
    expect(stream).not.toBeNull();
    const chunks: Buffer[] = [];
    for await (const chunk of stream!) chunks.push(Buffer.from(chunk));
    expect(Buffer.concat(chunks).toString('utf8')).toBe(SALES_TERMS_TEXT);
    expect((await context.request.get('/api/legal/terms?version=stale')).status()).toBe(409);
    const publicCopy = await context.request.get(SALES_TERMS_DOWNLOAD);
    expect(publicCopy.status()).toBe(200); expect(publicCopy.headers()['x-content-type-options']).toBe('nosniff');
  } finally { await context.close(); }
});
