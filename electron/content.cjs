const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {modMetadata}=require('./mod-metadata.cjs');
const {json,download,hashFile,safeChild}=require('./network.cjs');
const {exists,readJson,relativePath,copyTree,removeChild}=require('./files.cjs');
const {Backups}=require('./backups.cjs');
const {Importer}=require('./imports.cjs');
const {packInfo,installPack}=require('./packs.cjs');
const projectKey=v=>{if(typeof v!=='string'||!/^[-\w]{1,100}$/.test(v))throw new Error('Ungültiges Modrinth-Projekt.');return v;};
const folderOf=type=>({mod:'mods',shader:'shaderpacks',resourcepack:'resourcepacks'})[type];
class Content {
 constructor(store,engine,emit,{getJson=json,getDownload=download}={}){this.store=store;this.engine=engine;this.emit=emit;this.json=getJson;this.download=getDownload;this.backups=new Backups(store);this.importer=new Importer();this.packFiles=new Map();this.plans=new Map();}
 guard(id){if(this.engine.busy||this.engine.starting?.size)throw new Error('Bitte warte, bis der aktuelle Vorgang abgeschlossen ist.');if(id&&this.engine.running.has(id))throw new Error('Beende zuerst diese Minecraft-Instanz.');if(id)this.store.instance(id);}
 async task(id,stage,fn){this.guard(id);const controller=new AbortController(),job={id:crypto.randomUUID(),instanceId:id||'import',name:id?this.store.instance(id).name:'Profilimport',state:'running',stage,progress:0,bytes:0,started:Date.now()};this.engine.jobs.unshift(job);this.engine.jobs=this.engine.jobs.slice(0,30);this.engine.busy={instanceId:job.instanceId,controller};const progress=(value,text)=>this.engine.change(job,{progress:Math.min(100,Math.round(value)),...(text?{stage:text}:{})});this.emit('status',this.engine.status());try{const result=await fn(controller.signal,progress);this.engine.change(job,{state:'complete',progress:100,stage:'Abgeschlossen',finished:Date.now()});return result;}catch(e){this.engine.change(job,{state:controller.signal.aborted?'cancelled':'error',stage:controller.signal.aborted?'Abgebrochen':e.message,finished:Date.now()});throw e;}finally{this.engine.busy=null;this.emit('status',this.engine.status());this.emit('data');}}
 async inspectPack(file){if((await fs.stat(file)).size>1024*1024*1024)throw new Error('Das Modpack ist größer als 1 GB.');const info=packInfo(file),key=crypto.randomUUID();this.packFiles.clear();this.packFiles.set(key,file);return {key,...info};}
 async validVersion(version){await this.engine.versions();const v=this.engine.manifest.versions.find(v=>v.id===version);if(!v||new Date(v.releaseTime)<new Date('2020-06-23'))throw new Error('Unterstützt werden Minecraft Java 1.16 und neuer. Ältere Profile können nicht unverändert gestartet werden.');}
 async importPack({key,name,optional=false}){const file=this.packFiles.get(key);if(!file)throw new Error('Bitte das Modpack erneut auswählen.');const info=packInfo(file);await this.validVersion(info.version);return this.task(null,'Modpack wird importiert',async(signal,progress)=>{const stage=safeChild(this.store.root,'import-'+crypto.randomUUID());await fs.mkdir(stage,{recursive:true});try{await installPack(file,stage,{signal,optional:!!optional,progress});signal.throwIfAborted();const instance=await this.store.create({...info,name:name||info.name},{preparedDirectory:stage});this.packFiles.delete(key);return instance;}finally{await removeChild(this.store.root,stage);}});}
 async discard(id){const dir=this.store.directory(id);await removeChild(path.join(this.store.root,'instances'),dir);this.store.data.instances=this.store.data.instances.filter(i=>i.id!==id);await this.store.save();}
 async importProfile({id,version,loader}){const c=this.importer.candidate(id),chosenLoader=c.loaderDetected?c.loader:(loader||c.loader);if(!['vanilla','fabric','forge','neoforge','quilt'].includes(chosenLoader))throw new Error('Dieser Modloader wird noch nicht unterstützt.');const actual=c.version||version;await this.validVersion(actual);return this.task(null,'Spieldaten werden kopiert',async(signal,progress)=>{const stage=safeChild(this.store.root,'import-'+crypto.randomUUID());await fs.mkdir(stage,{recursive:true});try{let count=0;await this.importer.copy(id,stage,signal,()=>{if(++count%40===0)progress(40,`${count} Dateien übernommen`);},{version:actual,loader:chosenLoader});
   // Client-specific bundled mods are not redistributed or treated as ordinary Fabric mods.
   if(!['modrinth','folder'].includes(c.source)){const mods=path.join(stage,'mods');if(await exists(mods))for(const name of await fs.readdir(mods))if(/laby|lunar|norisk|badlion/i.test(name)&&/\.jar$/.test(name))await fs.rename(path.join(mods,name),path.join(mods,name+'.disabled'));}
   signal.throwIfAborted();const instance=await this.store.create({...c,version:actual,loader:chosenLoader},{preparedDirectory:stage});instance.importedFrom=c.sourceName;instance.importWarnings=c.warnings;await this.store.save();progress(100,'Profil importiert');return instance;
  }finally{await removeChild(this.store.root,stage);}});}
 async changeVersion(id,{version,loader,loaderVersion=''}){this.guard(id);await this.validVersion(version);if(!['vanilla','fabric','forge','neoforge','quilt'].includes(loader))throw new Error('Unbekannter Modloader.');if(!/^[\w.+-]{0,80}$/.test(loaderVersion))throw new Error('Ungültige Loader-Version.');let pin='';if(loader!=='vanilla'){const available=await this.engine.loaders.versions(loader,version);const chosen=loaderVersion?available.find(v=>v.version===loaderVersion):available[0];if(!chosen)throw new Error('Keine passende Loader-Version verfügbar.');pin=chosen.version;}const i=this.store.instance(id);if(i.version===version&&i.loader===loader&&(i.loaderVersion||'')===pin)return i;return this.task(id,'Sicherung vor Versionswechsel',async signal=>{await this.backups.automatic(id,'Vor Versionswechsel',signal);Object.assign(i,{version,loader,loaderVersion:pin,installed:false});await this.store.save();return i;});}
 async records(id){const file=path.join(this.store.directory(id),'carrot-content.json');try{const data=await readJson(file);if(!Array.isArray(data)||data.length>10000)throw new Error();for(const r of data){if(!r||!['mods','shaderpacks','resourcepacks'].includes(r.folder)||typeof r.file!=='string'||path.basename(r.file)!==r.file||!/^[-\w]{1,100}$/.test(r.projectId||''))throw new Error();relativePath(r.file);}return data;}catch(e){if(e.code==='ENOENT')return [];throw new Error('Die Inhaltsverwaltung ist beschädigt. Bitte zuerst ein Backup wiederherstellen.');}}
 async mods(id){const dir=path.dirname(this.contentFile(id,'mods','check.jar'));if(!await exists(dir))return [];const records=await this.records(id),out=[];for(const name of await fs.readdir(dir)){if(!/\.jar(?:\.disabled)?$/i.test(name))continue;relativePath(name);const stat=await fs.lstat(path.join(dir,name));if(!stat.isFile()||stat.isSymbolicLink())continue;const meta=stat.size<128*1024*1024?modMetadata(path.join(dir,name)):{};const r=records.find(r=>r.folder==='mods'&&r.file===name.replace(/\.disabled$/,''));out.push({file:name,modId:meta.id||'',name:meta.name||r?.title||name,version:meta.version||r?.versionNumber||'',enabled:!name.endsWith('.disabled'),projectId:r?.projectId||'',versionId:r?.versionId||'',iconUrl:r?.iconUrl||'',size:stat.size});}return out.sort((a,b)=>a.name.localeCompare(b.name));}
 async inventory(id){
  const records=await this.records(id),out=(await this.mods(id)).map(m=>({...m,type:'mod',folder:'mods'}));
  for(const [type,folder] of [['resourcepack','resourcepacks'],['shader','shaderpacks']]){
   const dir=path.dirname(this.contentFile(id,folder,'check.zip'));if(!await exists(dir))continue;
   for(const file of await fs.readdir(dir)){
    if(!/\.zip(?:\.disabled)?$/i.test(file))continue;
    const stat=await fs.lstat(safeChild(dir,file));if(!stat.isFile()||stat.isSymbolicLink())continue;
    const record=records.find(r=>r.folder===folder&&r.file===file.replace(/\.disabled$/,''));
    out.push({file,folder,type,name:record?.title||file.replace(/\.zip(?:\.disabled)?$/i,''),version:record?.versionNumber||'',enabled:!file.endsWith('.disabled'),projectId:record?.projectId||'',versionId:record?.versionId||'',iconUrl:record?.iconUrl||'',size:stat.size});
   }
  }
  return out.sort((a,b)=>a.name.localeCompare(b.name,'de'));
 }
 contentFile(id,folder,file){
  if(!['mods','resourcepacks','shaderpacks'].includes(folder)||typeof file!=='string'||path.basename(file)!==file)throw new Error('Ungültige Inhaltsdatei.');
  relativePath(file);if(!(folder==='mods'?/\.jar(?:\.disabled)?$/i:/\.zip(?:\.disabled)?$/i).test(file))throw new Error('Nicht unterstützter Dateityp.');
  const dir=safeChild(this.store.directory(id),folder);
  try{if(require('node:fs').lstatSync(dir).isSymbolicLink())throw new Error('Verknüpfte Inhaltsordner werden nicht verändert.');}catch(e){if(e.code!=='ENOENT')throw e;}
  return safeChild(dir,file);
 }
 async changeContent(id,folder,file,remove=false){
  const source=this.contentFile(id,folder,file);
  return this.task(id,remove?'Datei wird entfernt':'Inhalt wird umgeschaltet',async signal=>{
   const stat=await fs.lstat(source);if(!stat.isFile()||stat.isSymbolicLink())throw new Error('Nur normale Dateien können geändert werden.');
   const dest=remove?null:this.contentFile(id,folder,file.endsWith('.disabled')?file.slice(0,-9):file+'.disabled');
   if(dest&&await exists(dest))throw new Error('Eine Datei mit diesem Namen existiert bereits.');
   await this.backups.automatic(id,remove?'Vor Entfernen einer Inhaltsdatei':'Vor Inhaltsänderung',signal);signal.throwIfAborted();
   if(remove)await fs.unlink(source);else await fs.rename(source,dest);
  });
 }
 async importFiles(id,type,files){
  const folder=folderOf(type);if(!folder||!Array.isArray(files)||!files.length||files.length>50)throw new Error('Wähle zwischen einer und 50 Dateien.');
  if(type==='mod'&&this.store.instance(id).loader==='vanilla')throw new Error('Wähle zuerst einen Modloader in den Instanz-Einstellungen.');
  return this.task(id,'Dateien werden hinzugefügt',async(signal,progress)=>{
   const stage=safeChild(this.store.root,'content-'+crypto.randomUUID()),game=this.store.directory(id),added=[];await fs.mkdir(stage,{recursive:true});
   try{
    const names=new Set();
    for(const file of files){
     if(typeof file!=='string')throw new Error('Ungültige Quelldatei.');
     const name=path.basename(file),target=this.contentFile(id,folder,name),stat=await fs.lstat(file);
     if(name.endsWith('.disabled')||!stat.isFile()||stat.isSymbolicLink()||stat.size>256*1024*1024)throw new Error('Bitte normale JAR-/ZIP-Dateien unter 256 MB auswählen.');
     if(names.has(name.toLowerCase())||await exists(target)||await exists(target+'.disabled'))throw new Error('Die Datei '+name+' ist bereits vorhanden. Entferne zuerst die bisherige Datei oder verwende das Mod-Update.');
     names.add(name.toLowerCase());await fs.copyFile(file,safeChild(stage,name));signal.throwIfAborted();
    }
    await this.backups.automatic(id,'Vor Dateiimport',signal);await fs.mkdir(path.join(game,folder),{recursive:true});
    for(const name of names){signal.throwIfAborted();const actual=files.map(f=>path.basename(f)).find(f=>f.toLowerCase()===name);const dest=this.contentFile(id,folder,actual);await fs.copyFile(safeChild(stage,actual),dest,require('node:fs').constants.COPYFILE_EXCL);added.push(dest);progress(added.length/files.length*100);}
    return files.length;
   }catch(error){for(const file of added)await fs.unlink(file).catch(()=>{});throw error;}
   finally{await removeChild(this.store.root,stage);}
  });
 }
 async toggleMod(id,file){return this.changeContent(id,'mods',file);}
 async projectVersions(projectId,instance,type='mod',signal){const params=new URLSearchParams({game_versions:JSON.stringify([instance.version]),include_changelog:'false'});if(type==='mod')params.set('loaders',JSON.stringify([instance.loader]));if(type==='modpack')params.set('loaders',JSON.stringify(['fabric','forge','neoforge','quilt','minecraft']));return this.json(`https://api.modrinth.com/v2/project/${projectKey(projectId)}/version?${params}`,signal);}
 async plan(id,projectId,versionId){const instance=this.store.instance(id),records=await this.records(id),files=[],seen=new Set();let rootType;
  const visit=async(pid,vid,depth=0)=>{if(depth>20||seen.size>80)throw new Error('Zu viele Mod-Abhängigkeiten.');const p=await this.json('https://api.modrinth.com/v2/project/'+projectKey(pid));const type=p.project_type;if(!folderOf(type))throw new Error('Für Modpacks bitte den Modpack-Import verwenden.');if(type==='mod'&&instance.loader==='vanilla')throw new Error('Für Mods bitte eine Instanz mit Fabric, Forge, NeoForge oder Quilt wählen.');const v=vid?await this.json('https://api.modrinth.com/v2/version/'+projectKey(vid)):(await this.projectVersions(pid,instance,type))[0];if(!v||v.project_id!==p.id||!v.game_versions.includes(instance.version)||(type==='mod'&&!v.loaders.includes(instance.loader)))throw new Error('Keine kompatible Version für '+p.title+' ('+instance.version+' / '+instance.loader+').');
   const previous=files.find(f=>f.projectId===p.id);if(previous&&previous.versionId!==v.id)throw new Error('Widersprüchliche Versionen einer Abhängigkeit: '+p.title);if(seen.has(v.id))return;seen.add(v.id);if(!rootType)rootType=type;
   const file=v.files.find(f=>f.primary)||v.files[0];if(!file)throw new Error('Keine Datei für '+p.title);relativePath(file.filename);if(path.basename(file.filename)!==file.filename||!(type==='mod'?/\.jar$/i:/\.zip$/i).test(file.filename))throw new Error('Nicht unterstützter Dateityp.');if(!/^[a-f0-9]{40}$/i.test(file.hashes?.sha1||''))throw new Error('Die Dateiprüfsumme fehlt.');
   files.push({projectId:p.id,versionId:v.id,versionNumber:v.version_number,title:p.title,iconUrl:p.icon_url||'',type,folder:folderOf(type),file:file.filename,url:file.url,sha1:file.hashes.sha1,size:file.size});
   for(const dep of v.dependencies||[]){if(dep.dependency_type==='incompatible'&&records.some(r=>r.projectId===dep.project_id||r.versionId===dep.version_id))throw new Error(p.title+' ist mit einer installierten Mod nicht kompatibel.');if(dep.dependency_type!=='required')continue;if(!dep.project_id&&!dep.version_id)throw new Error('Eine externe Abhängigkeit muss manuell installiert werden: '+(dep.file_name||p.title));let target=dep.project_id;if(!target)target=(await this.json('https://api.modrinth.com/v2/version/'+projectKey(dep.version_id))).project_id;await visit(target,dep.version_id,depth+1);}
  };
  await visit(projectId,versionId);const key=crypto.randomUUID();this.plans.set(key,{id,files,version:instance.version,loader:instance.loader});while(this.plans.size>30)this.plans.delete(this.plans.keys().next().value);return {key,files:files.map(({url,sha1,...r})=>r)};
 }
 async installPlan(key){const plan=this.plans.get(key);if(!plan)throw new Error('Bitte die Installation erneut vorbereiten.');const i=this.store.instance(plan.id);if(i.version!==plan.version||i.loader!==plan.loader)throw new Error('Die Instanz hat sich geändert. Bitte erneut vorbereiten.');return this.task(plan.id,'Mods und Abhängigkeiten werden geladen',async(signal,progress)=>{
  const stage=safeChild(this.store.root,'content-'+crypto.randomUUID());await fs.mkdir(stage,{recursive:true});
  try{let n=0;for(const f of plan.files){await this.download({url:f.url,sha1:f.sha1,size:f.size,maxSize:256*1024*1024},safeChild(stage,f.folder+'/'+f.file),signal);progress(++n/plan.files.length*70,'Dateien und Prüfsummen werden geladen');}
   const records=await this.records(plan.id);const existingMods=await this.mods(plan.id);for(const f of plan.files.filter(f=>f.folder==='mods')){const meta=modMetadata(safeChild(stage,f.folder+'/'+f.file));if(meta.id)for(const m of existingMods.filter(m=>m.modId===meta.id))if(!records.some(r=>r.folder==='mods'&&r.file===m.file.replace(/\.disabled$/,'')))records.push({projectId:f.projectId,folder:'mods',file:m.file.replace(/\.disabled$/,'')});}await this.backups.automatic(plan.id,'Vor Mod-Installation / Update',signal);signal.throwIfAborted();const game=this.store.directory(plan.id),rollback=safeChild(stage,'rollback');await fs.mkdir(rollback,{recursive:true});const changed=[];
   try{for(const f of plan.files){const old=records.filter(r=>r.projectId===f.projectId),disabled=old.some(r=>require('node:fs').existsSync(path.join(game,r.folder,r.file+'.disabled')));for(const r of old)for(const suffix of ['', '.disabled']){const relative=relativePath(r.folder+'/'+r.file+suffix),src=safeChild(game,relative);if(await exists(src)){await copyTree(src,safeChild(rollback,relative));await fs.unlink(src);changed.push(relative);}}
     const relative=f.folder+'/'+f.file+(disabled?'.disabled':''),dest=safeChild(game,relative);if(await exists(dest)){await copyTree(dest,safeChild(rollback,relative));}changed.push(relative);await copyTree(safeChild(stage,f.folder+'/'+f.file),dest);}
    const updated=records.filter(r=>!plan.files.some(f=>r.projectId===f.projectId)).concat(plan.files.map(({projectId,versionId,versionNumber,title,iconUrl,type,folder,file,sha1})=>({projectId,versionId,versionNumber,title,iconUrl,type,folder,file,sha1})));await fs.writeFile(path.join(game,'carrot-content.json.tmp'),JSON.stringify(updated));await fs.rename(path.join(game,'carrot-content.json.tmp'),path.join(game,'carrot-content.json'));
   }catch(error){for(const relative of new Set(changed)){const dest=safeChild(game,relative);await fs.rm(dest,{force:true});if(await exists(safeChild(rollback,relative)))await copyTree(safeChild(rollback,relative),dest);}throw error;}
   this.plans.delete(key);return true;
  }finally{await removeChild(this.store.root,stage);}
 });}
 async updates(id){const instance=this.store.instance(id),mods=await this.mods(id),updates=[],records=await this.records(id);let changed=false;for(const mod of mods){let pid=mod.projectId,vid=mod.versionId;if(!pid){try{const sha1=await hashFile(path.join(this.store.directory(id),'mods',mod.file),'sha1');const v=await this.json('https://api.modrinth.com/v2/version_file/'+sha1);pid=v.project_id;vid=v.id;if(!pid||!vid)continue;records.push({projectId:pid,versionId:vid,versionNumber:v.version_number,title:mod.name,type:'mod',folder:'mods',file:mod.file.replace(/\.disabled$/,''),sha1});changed=true;}catch{continue;}}
  const available=(await this.projectVersions(pid,instance))[0];if(available&&available.id!==vid&&new Date(available.date_published||0)>new Date((await this.json('https://api.modrinth.com/v2/version/'+projectKey(vid))).date_published||0))updates.push({file:mod.file,name:mod.name,projectId:pid,versionId:available.id,versionNumber:available.version_number});}if(changed){const game=this.store.directory(id);await fs.writeFile(path.join(game,'carrot-content.json.tmp'),JSON.stringify(records));await fs.rename(path.join(game,'carrot-content.json.tmp'),path.join(game,'carrot-content.json'));}return updates;}
}
module.exports={Content};
