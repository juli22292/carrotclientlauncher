const fs=require('node:fs/promises');
const path=require('node:path');
const crypto=require('node:crypto');
const {copyGame,removeChild,exists,gameNames,readJson}=require('./files.cjs');
const {safeChild}=require('./network.cjs');
const loaderIds=require('./loader-definitions.json').map(loader=>loader.id);
class Backups {
  constructor(store){this.store=store;}
  root(id){this.store.instance(id);return path.join(this.store.root,'backups',id);}
  async list(id){const root=this.root(id);if(!await exists(root))return [];const items=[];for(const name of await fs.readdir(root)){if(!/^[a-f0-9-]{36}$/.test(name))continue;try{const m=await readJson(safeChild(root,name+'/backup.json'));items.push({id:name,createdAt:m.createdAt,reason:m.reason,version:m.instance.version,loader:m.instance.loader});}catch{}}return items.sort((a,b)=>b.createdAt-a.createdAt);}
  async create(id,reason='Manuelle Sicherung',signal){
    const instance=this.store.instance(id),root=this.root(id),key=crypto.randomUUID(),temp=safeChild(root,key+'.tmp'),dest=safeChild(root,key);
    await fs.mkdir(path.join(temp,'game'),{recursive:true});
    try{await copyGame(this.store.directory(id),path.join(temp,'game'),{signal});await fs.writeFile(path.join(temp,'backup.json'),JSON.stringify({createdAt:Date.now(),reason,instance:{version:instance.version,loader:instance.loader,loaderVersion:instance.loaderVersion||''}}));await fs.rename(temp,dest);return key;}
    catch(e){await removeChild(root,temp);throw e;}
  }
  async automatic(id,reason,signal){if(!this.store.data.settings.autoBackup)return;await this.create(id,reason,signal);const list=await this.list(id);for(const old of list.filter(x=>x.reason!=='Manuelle Sicherung').slice(5))await removeChild(this.root(id),safeChild(this.root(id),old.id));}
  async restore(id,key,signal){
    if(!/^[a-f0-9-]{36}$/.test(key))throw new Error('Ungültige Sicherung.');
    const source=safeChild(this.root(id),key),meta=await readJson(path.join(source,'backup.json'));
    if(!/^[\w.-]{1,80}$/.test(meta.instance?.version)||!loaderIds.includes(meta.instance?.loader))throw new Error('Die Sicherung ist ungültig.');
    const staged=safeChild(this.store.root,'restore-'+crypto.randomUUID());await fs.mkdir(staged,{recursive:true});
    try{
      await copyGame(path.join(source,'game'),staged,{signal});signal?.throwIfAborted();
      const rescue=await this.create(id,'Vor Wiederherstellung');
      const game=this.store.directory(id);
      try{for(const name of gameNames)if(await exists(path.join(game,name)))await removeChild(game,path.join(game,name));await copyGame(staged,game);}
      catch(error){for(const name of gameNames)if(await exists(path.join(game,name)))await removeChild(game,path.join(game,name));await copyGame(path.join(this.root(id),rescue,'game'),game);throw error;}
      const loaderVersion=typeof meta.instance.loaderVersion==='string'&&/^[\w.+-]{0,80}$/.test(meta.instance.loaderVersion)?meta.instance.loaderVersion:'';
      Object.assign(this.store.instance(id),{version:meta.instance.version,loader:meta.instance.loader,loaderVersion,installed:false});await this.store.save();return rescue;
    }finally{await removeChild(this.store.root,staged);}
  }
}
module.exports={Backups};
