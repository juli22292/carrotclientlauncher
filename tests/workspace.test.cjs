const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const AdmZip=require('adm-zip');
const {Store}=require('../electron/store.cjs');
const {Content}=require('../electron/content.cjs');
const {searchParameters}=require('../electron/search.cjs');
async function fixture(t,loader='fabric'){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'carrot-workspace-'));
 t.after(async()=>{assert.equal(path.dirname(path.resolve(root)),path.resolve(os.tmpdir()));assert(path.basename(root).startsWith('carrot-workspace-'));await fs.rm(root,{recursive:true,force:true,maxRetries:5});});
 const store=await new Store(root).init(),instance=await store.create({name:'Test',version:'1.21.1',loader});
 const engine={running:new Set(),starting:new Set(),jobs:[],busy:null,status(){return{}},change(job,patch){Object.assign(job,patch)}};
 return {root,store,instance,engine,content:new Content(store,engine,()=>{})};
}
async function archive(root,name,entries){const file=path.join(root,name),zip=new AdmZip();for(const[k,v]of Object.entries(entries))zip.addFile(k,Buffer.from(JSON.stringify(v)));zip.writeZip(file);return file;}

test('content inventory includes imported mods, resource packs and shaders, and preserves source files',async t=>{
 const {root,store,instance:i,content}=await fixture(t);
 const mod=await archive(root,'Example.JAR',{'fabric.mod.json':{id:'example',name:'Example Mod',version:'1.0'}}),pack=await archive(root,'Resources.zip',{'pack.mcmeta':{pack:{pack_format:34,description:'Test'}}}),shader=await archive(root,'Shader.zip',{'shaders/test.json':{}});
 await content.importFiles(i.id,'mod',[mod]);await content.importFiles(i.id,'resourcepack',[pack]);await content.importFiles(i.id,'shader',[shader]);
 const entries=await content.inventory(i.id);assert.equal(entries.length,3);assert.deepEqual(new Set(entries.map(e=>e.type)),new Set(['mod','resourcepack','shader']));assert.equal(entries.find(e=>e.type==='mod').name,'Example Mod');assert(entries.every(e=>e.enabled));
 assert.deepEqual(await fs.readFile(mod),await fs.readFile(path.join(store.directory(i.id),'mods','Example.JAR')));
 const before=await fs.readFile(pack);await assert.rejects(content.importFiles(i.id,'resourcepack',[pack]),/bereits vorhanden/);assert.deepEqual(await fs.readFile(path.join(store.directory(i.id),'resourcepacks','Resources.zip')),before);
});
test('pack toggles and removal create recoverable backups and never modify the original archive',async t=>{
 const {root,store,instance:i,content}=await fixture(t),file=await archive(root,'Pack.zip',{'pack.mcmeta':{pack:{description:'Test'}}});
 await content.importFiles(i.id,'resourcepack',[file]);await content.changeContent(i.id,'resourcepacks','Pack.zip');assert.equal((await content.inventory(i.id))[0].enabled,false);
 await content.changeContent(i.id,'resourcepacks','Pack.zip.disabled',true);assert.equal((await content.inventory(i.id)).length,0);
 const backups=await content.backups.list(i.id),beforeRemoval=backups.find(b=>b.reason==='Vor Entfernen einer Inhaltsdatei');assert(beforeRemoval);await content.backups.restore(i.id,beforeRemoval.id);
 assert.equal((await content.inventory(i.id))[0].enabled,false);assert.deepEqual(await fs.readFile(file),await fs.readFile(path.join(store.directory(i.id),'resourcepacks','Pack.zip.disabled')));
});
test('invalid or colliding imports leave every destination and source untouched',async t=>{
 const {root,store,instance:i,content}=await fixture(t),pack=await archive(root,'Valid.zip',{'pack.mcmeta':{}}),invalid=path.join(root,'Invalid.txt');await fs.writeFile(invalid,'original');
 await assert.rejects(content.importFiles(i.id,'resourcepack',[pack,invalid]),/Dateityp/);assert.equal((await content.inventory(i.id)).length,0);assert.equal(await fs.readFile(invalid,'utf8'),'original');
 const nested=path.join(root,'other');await fs.mkdir(nested);await fs.copyFile(pack,path.join(nested,'valid.ZIP'));await assert.rejects(content.importFiles(i.id,'resourcepack',[pack,path.join(nested,'valid.ZIP')]),/bereits vorhanden/);assert.equal((await content.inventory(i.id)).length,0);
 await assert.rejects(content.changeContent(i.id,'mods','../outside.jar'),/Ungültig/);await assert.rejects(content.changeContent(i.id,'saves','level.dat'),/Ungültig/);
 assert.equal((await fs.readdir(root)).some(f=>f.startsWith('content-')),false);assert.equal(store.data.instances.length,1);
});
test('running games and linked directories cannot be changed by content operations',async t=>{
 const {root,store,instance:i,content,engine}=await fixture(t),pack=await archive(root,'Pack.zip',{'pack.mcmeta':{}});
 engine.running.add(i.id);await assert.rejects(content.importFiles(i.id,'resourcepack',[pack]),/Beende zuerst/);engine.running.clear();
 const outside=path.join(root,'linked-source');await fs.mkdir(outside);await fs.copyFile(pack,path.join(outside,'Pack.zip'));await fs.symlink(outside,path.join(store.directory(i.id),'resourcepacks'),'junction');
 await assert.rejects(content.importFiles(i.id,'resourcepack',[pack]),/Verknüpfte/);await assert.rejects(content.changeContent(i.id,'resourcepacks','Pack.zip',true),/Verknüpfte/);assert.deepEqual(await fs.readFile(pack),await fs.readFile(path.join(outside,'Pack.zip')));
 const vanilla=await store.create({name:'Vanilla',version:'1.21.1',loader:'vanilla'});await assert.rejects(content.importFiles(vanilla.id,'mod',[pack]),/Modloader/);
});
test('discovery uses exact instance compatibility, requested page/order and AND exclusions',()=>{
 const p=searchParameters({query:'Sodium',type:'mod',offset:40,limit:40,index:'updated',exclude:['abc','def']},{loader:'neoforge',version:'1.21.1'});
 assert.equal(p.get('offset'),'40');assert.equal(p.get('limit'),'40');assert.equal(p.get('index'),'updated');const facets=JSON.parse(p.get('facets'));assert.deepEqual(facets,[['project_type:mod'],['versions:1.21.1'],['categories:neoforge'],['project_id != abc'],['project_id != def']]);
 const packs=JSON.parse(searchParameters({type:'modpack'},{version:'1.21.1',loader:'vanilla'}).get('facets'));assert.deepEqual(packs,[['project_type:modpack'],['versions:1.21.1']]);
});
test('discovery rejects malformed query, paging and exclusion values before contacting Modrinth',()=>{
 for(const options of [{query:{}},{index:'bad'},{offset:-1},{offset:1.5},{limit:500},{exclude:['bad\"id']},{exclude:'all'},{category:'a:b'}])assert.throws(()=>searchParameters(options));
});
