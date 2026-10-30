const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { Store, validateSettings } = require('../electron/store.cjs');
const { Engine, allowed, argsFrom, maven } = require('../electron/engine.cjs');
const { MICROSOFT_CLIENT_ID } = require('../electron/config.cjs');
const { offlineSession } = require('../electron/auth.cjs');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { safeChild, checkUrl } = require('../electron/network.cjs');

test('Mojang OS and feature rules choose Windows x64 and custom resolution arguments', () => {
  assert.equal(allowed([{ action:'allow', os:{ name:'osx' } }]),false);
  assert.equal(allowed([{ action:'allow', os:{ name:'windows' } }]),true);
  assert.equal(allowed([{ action:'allow', os:{ name:'windows', arch:'x86' } }]),false);
  assert.equal(allowed([{ action:'allow', features:{ has_custom_resolution:true } }],{}),false);
  assert.deepEqual(argsFrom(['--width','${width}', { rules:[{ action:'allow', features:{ has_custom_resolution:true } }], value:['--height','${height}'] }],{width:1280,height:720}, {has_custom_resolution:true}),['--width','1280','--height','720']);
  assert.deepEqual(argsFrom([{ rules:[{ action:'allow', features:{ has_custom_resolution:true } }], value:'--height' }],{},{}),[]);
  assert.throws(() => argsFrom(['${missing}'],{},{}));
});
test('Fabric Maven coordinates resolve correctly', () => {
  assert.deepEqual(maven({name:'net.fabricmc:fabric-loader:0.18.0',url:'https://maven.fabricmc.net/'}),{path:'net/fabricmc/fabric-loader/0.18.0/fabric-loader-0.18.0.jar',url:'https://maven.fabricmc.net/net/fabricmc/fabric-loader/0.18.0/fabric-loader-0.18.0.jar'});
});
test('downloads reject traversal and non-approved hosts', () => {
  assert.throws(() => safeChild('C:\\launcher\\libraries','..\\secrets.txt'));
  assert.throws(() => safeChild('C:\\launcher\\libraries','C:\\Windows\\test'));
  assert.throws(() => checkUrl('https://example.com/bad.jar'));
  assert.throws(() => checkUrl('http://libraries.minecraft.net/test.jar'));
  assert.equal(checkUrl('https://libraries.minecraft.net/a.jar'),'https://libraries.minecraft.net/a.jar');
});
test('settings bound memory and resolution and ignore obsolete identity overrides', () => {
  assert.deepEqual(validateSettings({username:'Any_Name',memory:999999,width:3,microsoftClientId:'another-id'}),{});
  assert.equal(validateSettings({memory:2048,width:1920}).width,1920);
});
test('instances survive reload and archiving preserves worlds', async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(),'carrot-unit-'));
  try {
    const store = await new Store(root).init();
    const i = await store.create({name:'  Meine Welt  ',version:'1.21.1',loader:'vanilla',color:'moss'});
    assert.equal(i.name,'Meine Welt');
    await fs.mkdir(path.join(store.directory(i.id),'saves','Survival'),{recursive:true});
    await fs.writeFile(path.join(store.directory(i.id),'saves','Survival','level.dat'),'world');
    const loaded = await new Store(root).init(); assert.equal(loaded.data.instances.length,1);
    await loaded.remove(i.id); assert.equal(loaded.data.instances.length,0);
    const [folder] = await fs.readdir(path.join(root,'archive'));
    assert.equal(await fs.readFile(path.join(root,'archive',folder,'saves','Survival','level.dat'),'utf8'),'world');
    await assert.rejects(() => loaded.create({name:'x',version:'../../bad',loader:'vanilla'}));
  } finally { assert.equal(path.dirname(root),os.tmpdir()); assert.ok(path.basename(root).startsWith('carrot-unit-')); await fs.rm(root,{recursive:true,force:true}); }
});

test('a missing, expired or unlicensed account cannot start downloads or a game process', async () => {
  const engine = new Engine({},()=>{});
  let installed = false; engine.install=async()=>{ installed=true; };
  const valid={id:'123456789012345678901234567890ab',name:'TestPlayer',accessToken:'test-access',expires:Date.now()+3600000,ownsGame:true,clientId:MICROSOFT_CLIENT_ID};
  for(const account of [null,{...valid,expires:0},{...valid,ownsGame:false},{...valid,accessToken:'0'},{...valid,clientId:'another-app'}]){
    await assert.rejects(engine.launch('instance',account),error=>error.code==='LOGIN_REQUIRED');
  }
  assert.equal(installed,false); assert.equal(engine.jobs.length,0); assert.equal(engine.running.size,0);
});

test('explicit offline profiles launch with their own UUID and no online token, and preserve log zeros', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'carrot-unit-'));
  let child;
  try {
    const store=await new Store(root).init();
    const instance=await store.create({name:'Offline world',version:'1.21.1',loader:'vanilla'});instance.installed=true;
    const game=store.directory(instance.id);
    await fs.writeFile(path.join(game,'profile.json'),JSON.stringify({java:'unused.exe',baseVersion:'1.21.1',profile:{id:'1.21.1',type:'release',assetIndex:{id:'test'},libraries:[],arguments:{jvm:[],game:['--username','${auth_player_name}','--uuid','${auth_uuid}','--accessToken','${auth_access_token}','--userType','${user_type}','--xuid','${auth_xuid}']},mainClass:'test.Main'}}));
    let args;
    const engine=new Engine(store,()=>{},{spawnProcess:(_java,values)=>{
      args=values;child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();setImmediate(()=>child.emit('spawn'));return child;
    }});
    const account=offlineSession('Steve');
    await engine.launch(instance.id,account);
    for(const [key,value] of [['--username','Steve'],['--uuid','5627dd98e6be3c21b8a8e92344183641'],['--accessToken','0'],['--userType','legacy'],['--xuid','']])assert.equal(args[args.indexOf(key)+1],value);
    assert.equal(args.includes('--demo'),false);assert.equal(engine.running.has(instance.id),true);
    child.stdout.write('Minecraft 1.20.6 started at 00:10\n');child.emit('exit',0);await store.pending;
    const deadline=Date.now()+2000;let text='';
    while(Date.now()<deadline){text=await fs.readFile(path.join(game,'launcher-game.log'),'utf8');if(text.includes('00:10'))break;await new Promise(r=>setTimeout(r,10));}
    assert.match(text,/Minecraft 1\.20\.6 started at 00:10/);assert.equal(engine.running.size,0);
  }finally{
    child?.emit('exit',0);
    assert.equal(path.dirname(root),os.tmpdir());assert.ok(path.basename(root).startsWith('carrot-unit-'));
    await fs.rm(root,{recursive:true,force:true,maxRetries:5,retryDelay:100});
  }
});

test('upgrading saved settings removes identity overrides while preserving instances', async () => {
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'carrot-unit-'));
  try {
    const store=await new Store(root).init();
    const instance=await store.create({name:'Behalten',version:'1.21.1',loader:'vanilla'});
    const saved=JSON.parse(await fs.readFile(store.file,'utf8'));
    saved.settings.username='PreviousName'; saved.settings.microsoftClientId='previous-app';
    await fs.writeFile(store.file,JSON.stringify(saved));
    const upgraded=await new Store(root).init();
    assert.equal(upgraded.data.instances[0].id,instance.id);
    const migrated=JSON.parse(await fs.readFile(store.file,'utf8'));
    assert.equal('username' in migrated.settings,false); assert.equal('microsoftClientId' in migrated.settings,false);
  }finally{assert.equal(path.dirname(root),os.tmpdir());assert.ok(path.basename(root).startsWith('carrot-unit-'));await fs.rm(root,{recursive:true,force:true});}
});
