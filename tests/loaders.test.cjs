const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const AdmZip=require('adm-zip');
const {Loaders,neoMinecraft,mergeProfile}=require('../electron/loaders.cjs');
const {Store}=require('../electron/store.cjs');
const {Backups}=require('../electron/backups.cjs');
const {packInfo}=require('../electron/packs.cjs');
const {modMetadata}=require('../electron/mod-metadata.cjs');
const base={id:'1.21.1',libraries:[{name:'org.ow2.asm:asm:9.6'},{name:'example:game:1'}],arguments:{game:['--username','${auth_player_name}'],jvm:['-cp','${classpath}']},mainClass:'net.minecraft.client.main.Main',javaVersion:{majorVersion:21}};
async function root(t){const p=await fs.mkdtemp(path.join(os.tmpdir(),'carrot-loaders-'));t.after(async()=>{assert.equal(path.dirname(p),os.tmpdir());assert(path.basename(p).startsWith('carrot-loaders-'));await fs.rm(p,{recursive:true,force:true,maxRetries:5,retryDelay:100});});return p;}
test('NeoForge release numbers map to precise legacy and new Minecraft versions',()=>{
 assert.equal(neoMinecraft('21.1.265'),'1.21.1');assert.equal(neoMinecraft('21.0.167'),'1.21');assert.equal(neoMinecraft('20.4.237'),'1.20.4');assert.equal(neoMinecraft('26.3.0.100'),'26.3');assert.equal(neoMinecraft('26.1.2.10'),'26.1.2');assert.equal(neoMinecraft('26.1.0.0-alpha+snapshot-1'),'26.1-snapshot-1');
});
test('loader catalogs filter game versions, sort numeric versions and prefer stable releases',async()=>{
 const service=new Loaders('unused',{getJson:async url=>url.includes('neoforged')?{versions:['21.1.9','21.1.12-beta','21.1.10','21.2.1','26.3.0.100']}:[{loader:{version:'0.9.0'}},{loader:{version:'0.30.2'}},{loader:{version:'0.31.0-beta.1'}}],getText:async()=>'<versions><version>1.21.1-52.1.9</version><version>1.21.1-52.1.20</version><version>1.20.1-47.4.28</version></versions>'});
 assert.equal((await service.versions('quilt','1.21.1'))[0].version,'0.30.2');assert.deepEqual((await service.versions('forge','1.21.1')).map(v=>v.version),['52.1.20','52.1.9']);assert.deepEqual((await service.versions('neoforge','1.21.1')).map(v=>v.version),['21.1.10','21.1.9','21.1.12-beta']);assert.equal((await service.versions('neoforge','26.3'))[0].version,'26.3.0.100');await assert.rejects(service.versions('wrong','1.21.1'),/Ungültiger/);
});
test('profile inheritance replaces conflicting libraries and retains both JVM and game arguments',()=>{
 const p=mergeProfile(base,{id:'forge',mainClass:'Bootstrap',libraries:[{name:'org.ow2.asm:asm:9.8'},{name:'forge:client:1',downloads:{artifact:{path:'forge/client.jar',url:''}}}],arguments:{game:['--launchTarget','forgeclient'],jvm:['-p','${library_directory}/modules']}});
 assert.equal(p.mainClass,'Bootstrap');assert.equal(p.libraries.some(l=>l.name==='org.ow2.asm:asm:9.6'),false);assert.equal(p.libraries.length,3);assert(p.arguments.game.includes('--username'));assert(p.arguments.game.includes('forgeclient'));assert(p.arguments.jvm.includes('${library_directory}/modules'));
});
test('official Forge/NeoForge installer pipeline pins version, validates metadata and reads generated profile',async t=>{
 const p=await root(t);let called=false;const extension={id:'forge-52.1.20',inheritsFrom:'1.21.1',mainClass:'bootstrap.Main',libraries:[],arguments:{game:['--launchTarget','forgeclient']}};
 const service=new Loaders(p,{getText:async url=>url.endsWith('.sha1')?'a'.repeat(40):'<version>1.21.1-52.1.20</version>',getDownload:async(item,file)=>{assert.equal(item.sha1,'a'.repeat(40));assert.match(item.url,/maven\.minecraftforge\.net/);await fs.mkdir(path.dirname(file),{recursive:true});const zip=new AdmZip();zip.addFile('install_profile.json',Buffer.from(JSON.stringify({minecraft:'1.21.1'})));zip.addFile('version.json',Buffer.from(JSON.stringify(extension)));zip.writeZip(file);},install:async(java,jar,dir)=>{called=true;assert.equal(java,'java21.exe');assert.equal(dir,p);const dest=path.join(p,'versions',extension.id);await fs.mkdir(dest,{recursive:true});await fs.writeFile(path.join(dest,extension.id+'.json'),JSON.stringify(extension));}});
 const result=await service.prepare({version:'1.21.1',loader:'forge',loaderVersion:'52.1.20'},base,{ensureJava:async major=>{assert.equal(major,21);return 'java21.exe';}});assert(called);assert.equal(result.loaderVersion,'52.1.20');assert.equal(result.profile.mainClass,'bootstrap.Main');assert.equal(JSON.parse(await fs.readFile(path.join(p,'launcher_profiles.json'))).profiles.constructor,Object);called=false;await assert.rejects(service.prepare({version:'1.21.1',loader:'forge',loaderVersion:'1.0.0'},base),/nicht verfügbar/);assert.equal(called,false);
});
test('all five instance loaders survive persistence and backups with their pinned versions',async t=>{
 const p=await root(t),store=await new Store(p).init(),backups=new Backups(store);
 for(const loader of ['vanilla','fabric','forge','neoforge','quilt']){const i=await store.create({name:loader,version:'1.21.1',loader,loaderVersion:'1.2.3'});const key=await backups.create(i.id);i.loader='vanilla';await backups.restore(i.id,key);assert.equal(i.loader,loader);assert.equal(i.loaderVersion,'1.2.3');}
 const loaded=await new Store(p).init();assert.equal(loaded.data.instances.length,5);
});
test('mrpack recognizes Forge, NeoForge and Quilt and rejects contradictory dependencies',async t=>{
 const p=await root(t);for(const [key,loader] of [['forge','forge'],['neoforge','neoforge'],['quilt-loader','quilt']]){const file=path.join(p,loader+'.mrpack'),z=new AdmZip();z.addFile('modrinth.index.json',Buffer.from(JSON.stringify({formatVersion:1,game:'minecraft',name:loader,dependencies:{minecraft:'1.21.1',[key]:'1.2.3'},files:[]})));z.writeZip(file);assert.equal(packInfo(file).loader,loader);assert.equal(packInfo(file).loaderVersion,'1.2.3');}
 const file=path.join(p,'mixed.mrpack'),z=new AdmZip();z.addFile('modrinth.index.json',Buffer.from(JSON.stringify({formatVersion:1,game:'minecraft',dependencies:{minecraft:'1.21.1',forge:'52.1.20',neoforge:'21.1.265'},files:[]})));z.writeZip(file);assert.throws(()=>packInfo(file),/mehrere Modloader/);
});
test('mod list reads Quilt and Forge/NeoForge identity and manifest versions',async t=>{
 const p=await root(t);const q=new AdmZip();q.addFile('quilt.mod.json',Buffer.from(JSON.stringify({quilt_loader:{id:'quiltmod',version:'2.0',metadata:{name:'Quilt Mod'}}})));q.writeZip(path.join(p,'quilt.jar'));assert.deepEqual(modMetadata(path.join(p,'quilt.jar')),{id:'quiltmod',name:'Quilt Mod',version:'2.0'});
 for(const name of ['mods.toml','neoforge.mods.toml']){const f=new AdmZip();f.addFile('META-INF/'+name,Buffer.from('modLoader="javafml"\n[[mods]]\nmodId="example"\nversion="${file.jarVersion}"\ndisplayName="Example Mod"\n'));f.addFile('META-INF/MANIFEST.MF',Buffer.from('Manifest-Version: 1.0\nImplementation-Version: 3.2.1\n'));const file=path.join(p,name+'.jar');f.writeZip(file);assert.deepEqual(modMetadata(file),{id:'example',name:'Example Mod',version:'3.2.1'});}
});
test('NeoForge launch keeps generated libraries and excludes the inherited original jar from module scanning',async t=>{
 const p=await root(t),store=await new Store(p).init(),i=await store.create({name:'Neo modules',version:'1.21.1',loader:'neoforge'});i.installed=true;
 const {Engine}=require('../electron/engine.cjs'),{offlineSession}=require('../electron/auth.cjs'),{EventEmitter}=require('node:events'),{PassThrough}=require('node:stream');
 const profile={...base,id:'neoforge-21.1.265',assetIndex:{id:'test'},libraries:[{name:'generated:client:1',downloads:{artifact:{path:'generated/client.jar',url:''}}}],arguments:{game:[],jvm:['-DignoreList=client-extra,${version_name}.jar','-cp','${classpath}']}};
 await fs.writeFile(path.join(store.directory(i.id),'profile.json'),JSON.stringify({profile,java:'unused',baseVersion:i.version}));let captured,child;
 const engine=new Engine(store,()=>{},{spawnProcess:(_java,args)=>{captured=args;child=new EventEmitter();child.stdout=new PassThrough();child.stderr=new PassThrough();setImmediate(()=>child.emit('spawn'));return child;}});
 await engine.launch(i.id,offlineSession('CarrotTest'));assert(captured.includes('-DignoreList=client-extra,neoforge-21.1.265.jar,1.21.1.jar'));assert(captured[captured.indexOf('-cp')+1].includes(path.join('generated','client.jar')));child.emit('exit',0);await store.pending;
});
