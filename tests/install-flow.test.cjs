const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto');
const AdmZip=require('adm-zip');
const {Store}=require('../electron/store.cjs');
const {Content}=require('../electron/content.cjs');
async function fixture(t,services={}){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'carrot-flow-'));
 t.after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('carrot-flow-'));await fs.rm(root,{recursive:true,force:true,maxRetries:5});});
 const store=await new Store(root).init(),i=await store.create({name:'Existing pack',version:'1.21.1',loader:'fabric',loaderVersion:'0.16.10',modpack:{title:'Existing pack'}});
 const engine={running:new Set(),starting:new Set(),jobs:[],busy:null,manifest:{versions:[{id:'1.21.1',releaseTime:'2024-08-08'}]},async versions(){return this.manifest},status(){return{}},change(job,patch){Object.assign(job,patch)}};
 const c=new Content(store,engine,()=>{},services),game=store.directory(i.id);await fs.mkdir(path.join(game,'saves','World'),{recursive:true});await fs.writeFile(path.join(game,'saves/World/level.dat'),'live-world');
 return {root,store,i,engine,c,game};
}
function zipBuffer(entries){const z=new AdmZip();for(const[name,text]of Object.entries(entries))z.addFile(name,Buffer.from(text));return z.toBuffer();}
async function source(root,name,entries){const file=path.join(root,name);await fs.writeFile(file,zipBuffer(entries));return file;}
const digest=b=>crypto.createHash('sha1').update(b).digest('hex');

test('resource packs and shaders can change while Minecraft runs; mods and full backups remain protected',async t=>{
 const {root,store,i,engine,c,game}=await fixture(t),pack=await source(root,'Live.zip',{'pack.mcmeta':'{}'}),shader=await source(root,'Shader.zip',{'shaders/test.fsh':'shader'});
 engine.running.add(i.id);await c.importFiles(i.id,'resourcepack',[pack]);await c.importFiles(i.id,'shader',[shader]);await c.changeContent(i.id,'resourcepacks','Live.zip');await c.changeContent(i.id,'shaderpacks','Shader.zip',true);
 await assert.rejects(c.importFiles(i.id,'mod',[pack]),/Beende zuerst/);await assert.rejects(c.task(i.id,'Full backup',signal=>c.backups.create(i.id,'Manuelle Sicherung',signal)),/Beende zuerst/);
 assert.equal(await fs.readFile(path.join(game,'saves/World/level.dat'),'utf8'),'live-world');const backups=await c.backups.list(i.id);assert(backups.length>=4);assert(backups.every(b=>b.folders?.every(f=>f==='resourcepacks'||f==='shaderpacks')));
 for(const b of backups)await assert.rejects(fs.access(path.join(store.root,'backups',i.id,b.id,'game','saves')));
});

test('content-only restore preserves current worlds, settings, loader and unrelated project records',async t=>{
 const {root,store,i,c,game}=await fixture(t),pack=await source(root,'Before.zip',{'pack.mcmeta':'{}'});await c.importFiles(i.id,'resourcepack',[pack]);
 const old=[{projectId:'oldpack',folder:'resourcepacks',file:'Before.zip',versionId:'oldversion'},{projectId:'mod',folder:'mods',file:'mod.jar',versionId:'mod1'}];await fs.writeFile(path.join(game,'carrot-content.json'),JSON.stringify(old));
 const key=await c.backups.create(i.id,'Content snapshot',undefined,['resourcepacks']);await fs.writeFile(path.join(game,'saves/World/level.dat'),'newer-world');await fs.writeFile(path.join(game,'options.txt'),'newer-settings');await fs.unlink(path.join(game,'resourcepacks/Before.zip'));await fs.writeFile(path.join(game,'resourcepacks/After.zip'),'new');await fs.writeFile(path.join(game,'carrot-content.json'),JSON.stringify([{projectId:'newpack',folder:'resourcepacks',file:'After.zip'},{...old[1],versionId:'mod2'}]));i.installed=true;await store.save();
 await c.backups.restore(i.id,key);assert.equal(await fs.readFile(path.join(game,'saves/World/level.dat'),'utf8'),'newer-world');assert.equal(await fs.readFile(path.join(game,'options.txt'),'utf8'),'newer-settings');assert.equal(i.installed,true);assert.equal(i.loader,'fabric');const records=await c.records(i.id);assert.equal(records.find(r=>r.projectId==='mod').versionId,'mod2');assert.equal((await c.inventory(i.id)).find(r=>r.type==='resourcepack').projectId,'oldpack');await assert.rejects(fs.access(path.join(game,'resourcepacks/After.zip')));
});

test('invalid backup scopes and incompatible mod snapshots are rejected before changing game files',async t=>{
 const {i,c,game}=await fixture(t);await assert.rejects(c.backups.create(i.id,'Bad',undefined,['saves']),/Sicherungsumfang/);const key=await c.backups.create(i.id,'Mods',undefined,['mods']);i.loader='neoforge';await assert.rejects(c.backups.restore(i.id,key),/anderen Minecraft/);assert.equal(await fs.readFile(path.join(game,'saves/World/level.dat'),'utf8'),'live-world');
});

test('full backups from older releases without content scope metadata still restore completely',async t=>{
 const {store,i,c,game}=await fixture(t),key=await c.backups.create(i.id,'Manuelle Sicherung'),file=path.join(store.root,'backups',i.id,key,'backup.json');const meta=JSON.parse(await fs.readFile(file,'utf8'));delete meta.folders;delete meta.contentRecords;await fs.writeFile(file,JSON.stringify(meta));await fs.writeFile(path.join(game,'saves/World/level.dat'),'changed');i.version='1.20.1';await c.backups.restore(i.id,key);assert.equal(i.version,'1.21.1');assert.equal(await fs.readFile(path.join(game,'saves/World/level.dat'),'utf8'),'live-world');
});

test('live installation is decided by every dependency, not just the root project type',async t=>{
 const buffers={pack:zipBuffer({'pack.mcmeta':'{}'}),mod:zipBuffer({'fabric.mod.json':'{"id":"dep","version":"1"}'})};let withDependency=false;
 const {i,c,engine,game}=await fixture(t,{getJson:async url=>{const u=new URL(url);if(u.pathname.includes('/project/')){const id=u.pathname.split('/')[3];if(!u.pathname.endsWith('/version'))return{id,title:id,project_type:id==='pack'?'resourcepack':'mod'};return[{id:'v'+id,project_id:id,version_number:'1',game_versions:['1.21.1'],loaders:['fabric'],dependencies:withDependency&&id==='pack'?[{dependency_type:'required',project_id:'mod'}]:[],files:[{primary:true,filename:id+(id==='pack'?'.zip':'.jar'),url:'https://cdn.modrinth.com/'+id,hashes:{sha1:digest(buffers[id])},size:buffers[id].length}]}];}throw new Error(url);},getDownload:async(opts,dest)=>{await fs.mkdir(path.dirname(dest),{recursive:true});await fs.writeFile(dest,buffers[opts.url.endsWith('pack')?'pack':'mod']);}});
 engine.running.add(i.id);let plan=await c.plan(i.id,'pack');assert.equal(plan.requiresGameExit,false);await c.installPlan(plan.key);await fs.access(path.join(game,'resourcepacks/pack.zip'));withDependency=true;plan=await c.plan(i.id,'pack');assert.equal(plan.requiresGameExit,true);await assert.rejects(c.installPlan(plan.key),/Beende zuerst/);await assert.rejects(fs.access(path.join(game,'mods/mod.jar')));
});

test('remote modpack creates exactly one separate instance in one operation and retains provenance',async t=>{
 const bytes=zipBuffer({'modrinth.index.json':JSON.stringify({formatVersion:1,game:'minecraft',name:'Original pack',dependencies:{minecraft:'1.21.1','fabric-loader':'0.16.10'},files:[]}),'overrides/options.txt':'from-pack'});
 const {root,store,i,c,game}=await fixture(t,{getJson:async()=>({project_id:'pack',name:'Stable pack',files:[{primary:true,filename:'pack.mrpack',url:'https://cdn.modrinth.com/pack.mrpack',hashes:{sha1:digest(bytes)},size:bytes.length}]}),getDownload:async(opts,dest)=>{assert.equal(opts.sha1,digest(bytes));await fs.writeFile(dest,bytes);}});
 const result=await c.importProjectPack('pack','vpack',{name:'My pack',optional:false});assert.equal(store.data.instances.length,2);assert.notEqual(result.id,i.id);assert.equal(result.name,'My pack');assert.equal(result.modpack.projectId,'pack');assert.equal(result.modpack.versionId,'vpack');assert.equal(result.loaderVersion,'0.16.10');assert.equal(await fs.readFile(path.join(store.directory(result.id),'options.txt'),'utf8'),'from-pack');assert.equal(await fs.readFile(path.join(game,'saves/World/level.dat'),'utf8'),'live-world');assert.equal((await new Store(root).init()).instance(result.id).modpack.title,'Original pack');assert(!(await fs.readdir(root)).some(n=>n.startsWith('modpack-')));
});

test('failed or cancelled remote packs never create an instance or modify the existing pack',async t=>{
 const {root,store,c,engine,game}=await fixture(t,{getJson:async()=>({project_id:'another',files:[]})});await assert.rejects(c.importProjectPack('pack','vpack',{name:'New'}),/gehört nicht/);assert.equal(store.data.instances.length,1);
 c.json=async()=>({project_id:'pack',files:[{filename:'pack.mrpack',url:'https://cdn.modrinth.com/pack.mrpack',hashes:{sha1:'a'.repeat(40)},size:10}]});c.download=async(_,dest,signal)=>{signal.throwIfAborted();await new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new Error('cancelled')),{once:true}));};const pending=c.importProjectPack('pack','vpack',{name:'Cancelled'});await new Promise(setImmediate);engine.busy.controller.abort();await assert.rejects(pending,/cancelled|abort/i);assert.equal(store.data.instances.length,1);assert.equal(await fs.readFile(path.join(game,'saves/World/level.dat'),'utf8'),'live-world');assert(!(await fs.readdir(root)).some(n=>n.startsWith('modpack-')));
});
