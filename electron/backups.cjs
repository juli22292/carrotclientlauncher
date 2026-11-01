const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {copyGame,copyTree,removeChild,exists,gameNames,readJson,relativePath}=require('./files.cjs');
const {safeChild}=require('./network.cjs');
const loaderIds=require('./loader-definitions.json').map(loader=>loader.id);
function contentFolders(value){
  if(value==null)return null;
  if(!Array.isArray(value)||!value.length||value.length>3||value.some(v=>!['mods','resourcepacks','shaderpacks'].includes(v)))throw new Error('Ungültiger Sicherungsumfang.');
  return [...new Set(value)];
}
function contentRecords(value){
  if(!Array.isArray(value)||value.length>10000)throw new Error('Ungültige Inhaltszuordnung in der Sicherung.');
  for(const record of value){
    if(!record||!['mods','resourcepacks','shaderpacks'].includes(record.folder)||typeof record.file!=='string'||path.basename(record.file)!==record.file||!/^[-\w]{1,100}$/.test(record.projectId||''))throw new Error('Ungültige Inhaltszuordnung in der Sicherung.');
    relativePath(record.file);
  }
  return value;
}
class Backups {
  constructor(store){this.store=store;}
  root(id){this.store.instance(id);return path.join(this.store.root,'backups',id);}
  async records(id){try{return contentRecords(await readJson(path.join(this.store.directory(id),'carrot-content.json')));}catch(e){if(e.code==='ENOENT')return [];throw e;}}
  async restoreRecords(id,folders,records){
    const restored=contentRecords(records),current=await this.records(id),game=this.store.directory(id);
    const merged=current.filter(r=>!folders.includes(r.folder)).concat(restored.filter(r=>folders.includes(r.folder)));
    await fs.writeFile(path.join(game,'carrot-content.json.tmp'),JSON.stringify(merged));await fs.rename(path.join(game,'carrot-content.json.tmp'),path.join(game,'carrot-content.json'));
  }
  async list(id){const root=this.root(id);if(!await exists(root))return [];const items=[];for(const name of await fs.readdir(root)){if(!/^[a-f0-9-]{36}$/.test(name))continue;try{const m=await readJson(safeChild(root,name+'/backup.json'));items.push({id:name,createdAt:m.createdAt,reason:m.reason,version:m.instance.version,loader:m.instance.loader,folders:contentFolders(m.folders)});}catch{}}return items.sort((a,b)=>b.createdAt-a.createdAt);}
  async copy(source,target,signal,folders){
    if(!folders)return copyGame(source,target,{signal});
    for(const folder of folders)if(await exists(safeChild(source,folder)))await copyTree(safeChild(source,folder),safeChild(target,folder),{signal});
  }
  async create(id,reason='Manuelle Sicherung',signal,scope=null){
    const folders=contentFolders(scope);
    const instance=this.store.instance(id),root=this.root(id),key=crypto.randomUUID(),temp=safeChild(root,key+'.tmp'),dest=safeChild(root,key);
    await fs.mkdir(path.join(temp,'game'),{recursive:true});
    try{const records=folders?(await this.records(id)).filter(r=>folders.includes(r.folder)):undefined;await this.copy(this.store.directory(id),path.join(temp,'game'),signal,folders);await fs.writeFile(path.join(temp,'backup.json'),JSON.stringify({createdAt:Date.now(),reason,folders,contentRecords:records,instance:{version:instance.version,loader:instance.loader,loaderVersion:instance.loaderVersion||''}}));await fs.rename(temp,dest);return key;}
    catch(e){await removeChild(root,temp);throw e;}
  }
  async automatic(id,reason,signal,folders=null){if(!this.store.data.settings.autoBackup)return;await this.create(id,reason,signal,folders);const list=await this.list(id);for(const old of list.filter(x=>x.reason!=='Manuelle Sicherung').slice(5))await removeChild(this.root(id),safeChild(this.root(id),old.id));}
  async restore(id,key,signal){
    if(!/^[a-f0-9-]{36}$/.test(key))throw new Error('Ungültige Sicherung.');
    const source=safeChild(this.root(id),key),meta=await readJson(path.join(source,'backup.json'));
    const folders=contentFolders(meta.folders),current=this.store.instance(id);
    if(folders)contentRecords(meta.contentRecords);
    if(!/^[\w.-]{1,80}$/.test(meta.instance?.version)||!loaderIds.includes(meta.instance?.loader))throw new Error('Die Sicherung ist ungültig.');
    if(folders?.includes('mods')&&(current.version!==meta.instance.version||current.loader!==meta.instance.loader||(current.loaderVersion||'')!==(meta.instance.loaderVersion||'')))throw new Error('Diese Mod-Sicherung gehört zu einer anderen Minecraft-/Loader-Version. Wechsle zuerst zur Version der Sicherung.');
    const staged=safeChild(this.store.root,'restore-'+crypto.randomUUID());await fs.mkdir(staged,{recursive:true});
    try{
      await this.copy(path.join(source,'game'),staged,signal,folders);signal?.throwIfAborted();
      const rescue=await this.create(id,'Vor Wiederherstellung',undefined,folders);
      const game=this.store.directory(id);
      const names=folders||gameNames;
      try{for(const name of names)if(await exists(path.join(game,name)))await removeChild(game,path.join(game,name));await this.copy(staged,game,undefined,folders);if(folders)await this.restoreRecords(id,folders,meta.contentRecords);}
      catch(error){for(const name of names)if(await exists(path.join(game,name)))await removeChild(game,path.join(game,name));await this.copy(path.join(this.root(id),rescue,'game'),game,undefined,folders);if(folders)await this.restoreRecords(id,folders,(await readJson(path.join(this.root(id),rescue,'backup.json'))).contentRecords);throw error;}
      const loaderVersion=typeof meta.instance.loaderVersion==='string'&&/^[\w.+-]{0,80}$/.test(meta.instance.loaderVersion)?meta.instance.loaderVersion:'';
      if(!folders){Object.assign(this.store.instance(id),{version:meta.instance.version,loader:meta.instance.loader,loaderVersion,installed:false});await this.store.save();}return rescue;
    }finally{await removeChild(this.store.root,staged);}
  }
}
module.exports={Backups};
