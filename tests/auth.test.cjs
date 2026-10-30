const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { Auth, oauthError, offlineSession, requireSession } = require('../electron/auth.cjs');
const { MICROSOFT_CLIENT_ID } = require('../electron/config.cjs');
const profile={id:'123456789012345678901234567890ab',name:'TestPlayer'};
const response=(data,status=200)=>new Response(JSON.stringify(data),{status,headers:{'Content-Type':'application/json'}});
const turn=()=>new Promise(resolve=>setTimeout(resolve,2));
async function until(condition){const end=Date.now()+3000;while(!condition()){if(Date.now()>end)throw new Error('Timed out waiting for authentication state');await turn();}}
function storage(){
  const key=crypto.randomBytes(32);
  return {isEncryptionAvailable:()=>true,encryptString(value){const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv);const bytes=Buffer.concat([cipher.update(value,'utf8'),cipher.final()]);return Buffer.concat([iv,cipher.getAuthTag(),bytes]);},decryptString(value){const cipher=crypto.createDecipheriv('aes-256-gcm',key,value.subarray(0,12));cipher.setAuthTag(value.subarray(12,28));return Buffer.concat([cipher.update(value.subarray(28)),cipher.final()]).toString('utf8');}};
}
async function fixture(t,overrides={}){
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'carrot-auth-'));
  const requests=[],events=[],waits=[];
  const services={storage:storage(),delay:async ms=>{waits.push(ms);await turn();}};
  const defaultFetch=async(url,options)=>{
    requests.push({url,options});
    if(overrides.fetch){const result=await overrides.fetch(url,options,requests);if(result)return result;}
    if(url.endsWith('/devicecode'))return response({device_code:'private-device-token',user_code:'TEST-CODE',verification_uri:'https://www.microsoft.com/link',expires_in:900,interval:5});
    if(url.endsWith('/token'))return response({access_token:'microsoft-access-test',refresh_token:'refresh-test'});
    if(url.includes('user.auth.xboxlive.com'))return response({Token:'xbl-test',DisplayClaims:{xui:[{uhs:'user-hash'}]}});
    if(url.includes('xsts.auth.xboxlive.com'))return response({Token:'xsts-test',DisplayClaims:{xui:[{uhs:'user-hash',xid:'1234'}]}});
    if(url.endsWith('/login_with_xbox'))return response({access_token:'minecraft-access-test',expires_in:86400});
    if(url.endsWith('/entitlements/mcstore'))return response({items:[{name:'game_minecraft'}]});
    if(url.endsWith('/minecraft/profile'))return response(profile);
    throw new Error('Unexpected URL '+url);
  };
  services.fetch=defaultFetch;
  Object.assign(services,overrides.services||{});
  const auth=new Auth({root},(event,value)=>events.push({event,value}),services);
  t.after(async()=>{auth.cancel();await auth.writes.catch(()=>{});assert.equal(path.dirname(root),os.tmpdir());assert.ok(path.basename(root).startsWith('carrot-auth-'));await fs.rm(root,{recursive:true,force:true});});
  return {root,auth,requests,events,waits,services};
}

test('successful Microsoft, Xbox and Minecraft login verifies ownership and stores only a sealed session',async t=>{
  const f=await fixture(t);
  const device=await f.auth.begin();
  assert.equal(device.code,'TEST-CODE');assert.equal('device_code' in device,false);
  await until(()=>f.auth.state().state==='connected');
  assert.deepEqual(f.auth.public(),profile);
  const sealed=await fs.readFile(f.auth.file);
  assert.equal(sealed.includes(Buffer.from('refresh-test')),false);
  const saved=JSON.parse(f.services.storage.decryptString(sealed));
  assert.equal(saved.clientId,MICROSOFT_CLIENT_ID);assert.equal(saved.ownsGame,true);
  const publicEvents=JSON.stringify(f.events);
  for(const secret of ['private-device-token','microsoft-access-test','refresh-test','minecraft-access-test'])assert.equal(publicEvents.includes(secret),false);
  const deviceRequest=f.requests.find(r=>r.url.endsWith('/devicecode')).options.body;
  assert.equal(deviceRequest.get('client_id'),MICROSOFT_CLIENT_ID);
  assert.equal(deviceRequest.get('scope'),'XboxLive.signin offline_access');
  const ownership=f.requests.find(r=>r.url.endsWith('/entitlements/mcstore'));
  assert.equal(ownership.options.headers.Authorization,'Bearer minecraft-access-test');
  const reloaded=new Auth({root:f.root},()=>{},f.services);await reloaded.init();assert.deepEqual(reloaded.public(),profile);
  await reloaded.logout();assert.equal(reloaded.public(),null);await assert.rejects(fs.stat(reloaded.file),{code:'ENOENT'});
});

test('offline names use Minecraft version-3 UUIDs and reject invalid identities',()=>{
  assert.equal(offlineSession('Steve').id,'5627dd98e6be3c21b8a8e92344183641');
  assert.equal(offlineSession('Notch').id,'b50ad385829d3141a2167e7d7539ba7f');
  assert.equal(offlineSession(' Steve ').name,'Steve');
  assert.notEqual(offlineSession('Steve').id,offlineSession('steve').id);
  for(const name of ['',null,'ab','too_long_player_name','bad name','../Steve','Äpfel'])assert.throws(()=>offlineSession(name),e=>e.code==='INVALID_OFFLINE_NAME');
  assert.deepEqual(requireSession(offlineSession('Steve')),offlineSession('Steve'));
  assert.throws(()=>requireSession({...offlineSession('Steve'),id:'123456789012345678901234567890ab'}),e=>e.code==='INVALID_OFFLINE_PROFILE');
  assert.throws(()=>requireSession({...offlineSession('Steve'),accessToken:'fake-token'}),e=>e.code==='INVALID_OFFLINE_PROFILE');
});

test('offline mode needs no authentication requests or secure storage and survives restart',async t=>{
  const f=await fixture(t,{services:{storage:{isEncryptionAvailable:()=>false}}});
  await f.auth.init();assert.equal(f.auth.public(),null);
  const active=await f.auth.useOffline('CarrotPlayer');
  assert.deepEqual(active,{type:'offline',name:'CarrotPlayer',id:offlineSession('CarrotPlayer').id});
  assert.equal('accessToken' in active,false);assert.equal('ownsGame' in active,false);
  assert.deepEqual(await f.auth.session(),offlineSession('CarrotPlayer'));assert.equal(f.requests.length,0);
  const saved=JSON.parse(await fs.readFile(f.auth.offlineFile,'utf8'));assert.deepEqual(saved,{name:'CarrotPlayer',active:true});
  const reloaded=new Auth({root:f.root},()=>{},f.services);await reloaded.init();assert.deepEqual(reloaded.public(),active);
  await reloaded.useMicrosoft();assert.equal(reloaded.public(),null);
  await assert.rejects(reloaded.session(),e=>e.code==='LOGIN_REQUIRED');
  assert.equal(reloaded.offlinePublic().name,'CarrotPlayer');
  const again=new Auth({root:f.root},()=>{},f.services);await again.init();assert.equal(again.public(),null);
  await again.useOffline('Steve');await again.logout();assert.equal(again.public(),null);
  await assert.rejects(fs.stat(again.offlineFile),{code:'ENOENT'});
});

test('switching modes retains the Microsoft session and never reuses its UUID or token for offline play',async t=>{
  const f=await fixture(t);await f.auth.begin();await until(()=>f.auth.state().state==='connected');
  const original=await f.auth.session(),calls=f.requests.length;
  await f.auth.useOffline('Steve');assert.deepEqual(f.auth.microsoftPublic(),profile);
  const offline=await f.auth.session();assert.equal(offline.id,offlineSession('Steve').id);assert.equal(offline.accessToken,'0');
  assert.notEqual(offline.id,original.id);assert.equal(f.requests.length,calls);
  await f.auth.useMicrosoft();assert.deepEqual(f.auth.public(),profile);assert.equal((await f.auth.session()).accessToken,original.accessToken);
});

test('switching to offline during Microsoft sign-in cancels the pending login',async t=>{
  const f=await fixture(t,{fetch:async url=>url.endsWith('/token')?response({error:'authorization_pending'},400):null});
  await f.auth.begin();await f.auth.useOffline('Steve');await turn();
  assert.equal(f.auth.public().type,'offline');assert.equal(f.auth.public().name,'Steve');assert.equal(f.auth.pending,null);
  assert.equal(f.requests.some(r=>r.url.includes('user.auth.xboxlive.com')),false);
  await f.auth.logout();await turn();assert.equal(f.auth.public(),null);
});

test('logout prevents a delayed offline profile switch from restoring the session',async t=>{
  const f=await fixture(t);
  const switching=assert.rejects(f.auth.useOffline('Steve'),e=>e.code==='CANCELLED');
  await f.auth.logout();await switching;
  assert.equal(f.auth.public(),null);await assert.rejects(fs.stat(f.auth.offlineFile),{code:'ENOENT'});
});

test('missing Minecraft ownership never creates an authenticated session',async t=>{
  const f=await fixture(t,{fetch:async url=>url.endsWith('/entitlements/mcstore')?response({items:[]}):null});
  await f.auth.begin();await until(()=>f.auth.state().state==='error');
  assert.equal(f.auth.state().code,'MINECRAFT_REQUIRED');assert.equal(f.auth.public(),null);
  assert.equal(f.requests.some(r=>r.url.endsWith('/minecraft/profile')),false);
  await assert.rejects(fs.stat(f.auth.file),{code:'ENOENT'});
});

test('Minecraft application rejection and missing profile have specific recoverable errors',async t=>{
  for(const [endpoint,body,status,code] of [['/login_with_xbox',{error:'Invalid app registration'},403,'MINECRAFT_APP_ACCESS'],['/minecraft/profile',{},404,'PROFILE_REQUIRED']]){
    const f=await fixture(t,{fetch:async url=>url.endsWith(endpoint)?response(body,status):null});
    await f.auth.begin();await until(()=>f.auth.state().state==='error');
    assert.equal(f.auth.state().code,code);assert.equal(f.auth.public(),null);await assert.rejects(fs.stat(f.auth.file),{code:'ENOENT'});
  }
});

test('polling observes pending and slow_down without exposing protocol details',async t=>{
  let polls=0;
  const f=await fixture(t,{fetch:async url=>{if(!url.endsWith('/token'))return null;polls++;if(polls===1)return response({error:'authorization_pending'},400);if(polls===2)return response({error:'slow_down'},400);return null;}});
  await f.auth.begin();await until(()=>f.auth.state().state==='connected');
  assert.deepEqual(f.waits,[5000,5000,10000]);assert.equal(polls,3);
});

test('expired and declined device codes stop polling and allow a new attempt',async t=>{
  for(const error of ['expired_token','authorization_declined']){
    const f=await fixture(t,{fetch:async url=>url.endsWith('/token')?response({error},400):null});
    await f.auth.begin();await until(()=>f.auth.state().state==='error'&&!f.auth.pending);
    assert.equal(f.auth.state().code,error==='expired_token'?'CODE_EXPIRED':'ACCESS_DENIED');
    assert.equal(f.auth.public(),null);assert.equal((await f.auth.begin()).state,'waiting');f.auth.cancel();
  }
});

test('cancelling a pending request cannot sign in later or leave a saved session',async t=>{
  let complete;
  const f=await fixture(t,{fetch:async url=>url.endsWith('/devicecode')?new Promise(resolve=>{complete=resolve;}):null});
  const attempt=f.auth.begin();await until(()=>!!complete);
  await assert.rejects(f.auth.begin(),error=>error.code==='LOGIN_IN_PROGRESS');
  f.auth.cancel();complete(response({device_code:'cancelled',user_code:'CANCELLED',verification_uri:'https://www.microsoft.com/link',expires_in:900}));
  await assert.rejects(attempt);await f.auth.writes;
  assert.equal(f.auth.state().state,'idle');assert.equal(f.auth.public(),null);await assert.rejects(fs.stat(f.auth.file),{code:'ENOENT'});
});

test('logout during an exchange prevents a late login from restoring the session',async t=>{
  let complete;
  const f=await fixture(t,{fetch:async url=>url.endsWith('/token')?new Promise(resolve=>{complete=resolve;}):null});
  await f.auth.begin();await until(()=>!!complete);
  await f.auth.logout();complete(response({access_token:'late-token',refresh_token:'late-refresh'}));
  await turn();await turn();await f.auth.writes;
  assert.equal(f.auth.public(),null);assert.equal(f.auth.state().state,'idle');
  await assert.rejects(fs.stat(f.auth.file),{code:'ENOENT'});
});

test('concurrent launches share one refresh and recheck the Minecraft license',async t=>{
  const f=await fixture(t);
  f.auth.account={...profile,accessToken:'old',refreshToken:'old-refresh',expires:0,ownsGame:true,clientId:MICROSOFT_CLIENT_ID};
  const accounts=await Promise.all([f.auth.session(),f.auth.session(),f.auth.session()]);
  assert.equal(accounts.length,3);assert.equal(accounts[0].accessToken,'minecraft-access-test');
  const tokens=f.requests.filter(r=>r.url.endsWith('/token'));assert.equal(tokens.length,1);assert.equal(tokens[0].options.body.get('grant_type'),'refresh_token');
  assert.equal(f.requests.filter(r=>r.url.endsWith('/entitlements/mcstore')).length,1);
});

test('revoked refresh tokens log out cleanly without a fallback identity',async t=>{
  const f=await fixture(t,{fetch:async url=>url.endsWith('/token')?response({error:'invalid_grant'},400):null});
  f.auth.account={...profile,accessToken:'old',refreshToken:'revoked',expires:0,ownsGame:true,clientId:MICROSOFT_CLIENT_ID};
  await f.auth.persist(f.auth.account);
  await assert.rejects(f.auth.session(),error=>error.code==='SESSION_EXPIRED');
  assert.equal(f.auth.public(),null);await assert.rejects(fs.stat(f.auth.file),{code:'ENOENT'});
});

test('unavailable secure storage and absent accounts block authentication and play',async t=>{
  const f=await fixture(t,{services:{storage:{isEncryptionAvailable:()=>false}}});
  await assert.rejects(f.auth.begin(),error=>error.code==='STORAGE_UNAVAILABLE');assert.equal(f.requests.length,0);
  await assert.rejects(f.auth.session(),error=>error.code==='LOGIN_REQUIRED');
  assert.equal(oauthError({error_codes:[7000218]}).code,'PUBLIC_CLIENT_REQUIRED');
});
