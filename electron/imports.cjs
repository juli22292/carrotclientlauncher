const fs=require('node:fs/promises');
const path=require('node:path');
const os=require('node:os');
const crypto=require('node:crypto');
const {exists,readJson,copyGame,copyTree,privateName,relativePath}=require('./files.cjs');
const {safeChild}=require('./network.cjs');
const SOURCES=['modrinth','laby','lunar','norisk','badlion','folder'];
const labels={modrinth:'Modrinth',laby:'Laby Launcher',lunar:'Lunar Client',norisk:'NoRiskClient',badlion:'Badlion Client',folder:'Minecraft-Ordner'};
function rows(file,table){const {DatabaseSync}=require('node:sqlite');const db=new DatabaseSync(file,{readOnly:true});try{db.exec('PRAGMA query_only=ON; PRAGMA trusted_schema=OFF;');if(!db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(table))return [];return db.prepare('SELECT * FROM "'+table+'" LIMIT 1000').all();}finally{db.close();}}
function parse(value){try{return typeof value==='string'?JSON.parse(value):value;}catch{return null;}}
function values(v){if(Array.isArray(v))return v;return v&&typeof v==='object'?Object.values(v):[];}
function loaderOf(p){const l=typeof p==='string'?p:p?.type||p?.loader_type||'';return String(l).toLowerCase().replace('none','vanilla');}
function metadata(p={}){const deps=p.dependencies||{},loader=loaderOf(p.loader||p.modloader||p.modLoader||p.loader_type)|| (deps['fabric-loader']?'fabric':deps.forge?'forge':deps.neoforge?'neoforge':deps['quilt-loader']?'quilt':'vanilla');return {loaderDetected:!!(p.loader||p.modloader||p.modLoader||p.loader_type||deps['fabric-loader']||deps.forge||deps.neoforge||deps['quilt-loader']),name:String(p.name||p.title||p.metadata?.name||'Importierte Instanz').slice(0,40),version:String(p.game_version||p.gameVersion||p.minecraftVersion||p.minecraft_version||p.minecraft?.version||deps.minecraft||''),loader,loaderVersion:String(p.loader_version?.version||p.loader_version||p.loaderVersion||deps['fabric-loader']||deps.forge||deps.neoforge||deps['quilt-loader']||''),description:String(p.description||p.summary||'').slice(0,300)};}
function roots(source,env=process.env,home=os.homedir()){
 const app=env.APPDATA||path.join(home,'AppData','Roaming'),mc=path.join(app,'.minecraft');
 return ({modrinth:[path.join(app,'ModrinthApp'),path.join(app,'com.modrinth.theseus')],norisk:[path.join(app,'norisk','NoRiskClientV3'),path.join(app,'noriskclientv3')],lunar:[path.join(home,'.lunarclient')],laby:[path.join(app,'.laby'),path.join(app,'LabyMod'),path.join(home,'.laby'),mc],badlion:[mc],folder:[]})[source]||[];
}
async function gameDirectory(root,p){
 const value=p.gameDir||p.game_directory||p.minecraftDir||p.minecraftDirectory||p.path;
 if(value){const candidates=path.isAbsolute(value)?[value]:[path.resolve(root,'profiles',value),path.resolve(root,'meta','profiles',value),path.resolve(root,value)];for(const c of candidates)if(await exists(c))return c;return null;}
 return root;
}
async function inferVersion(root,p){
 const raw=p.lastVersionId||p.version?.id||p.version||'';
 if(typeof raw==='string'&&raw){try{const v=await readJson(safeChild(root,'versions/'+relativePath(raw)+'/'+relativePath(raw)+'.json'));return v.inheritsFrom||v.id;}catch{}const match=raw.match(/(?:^|[-_])(1\.\d+(?:\.\d+)?|2[6-9]\.\d+(?:\.\d+)?)(?:$|[-_])/);if(match)return match[1];}
 return '';
}
class Importer {
 constructor(){this.candidates=new Map();}
 async scan(source,selected){
  if(!SOURCES.includes(source))throw new Error('Unbekannter Launcher.');this.candidates.clear();const found=[],errors=[],seen=new Set();
  const add=async(root,p={},extra={})=>{const dir=await gameDirectory(root,p);if(!dir||!await exists(dir))return;const key=dir+'|'+(p.id||p.name||'');if(seen.has(key))return;seen.add(key);const m=metadata(p);if(!m.version)m.version=await inferVersion(root,p);if(m.name==='Importierte Instanz')m.name=path.basename(dir).slice(0,40);const warnings=[];if(!['modrinth','folder'].includes(source))warnings.push('Client-eigene Mods, HUDs, Cosmetics und Konten sind nicht als gleichwertige Funktionen anderer Modloader übertragbar. Übernommen werden kompatible Spieldaten.');if(!m.version)warnings.push('Minecraft-Version konnte nicht sicher erkannt werden. Bitte vor dem Import auswählen.');if(!['vanilla','fabric','forge','neoforge','quilt'].includes(m.loader))warnings.push('Der Modloader '+m.loader+' wird von CarrotClientLauncher nicht unterstützt. Bitte ein anderes Profil wählen.');const id=crypto.randomUUID();const data={id,source,sourceName:labels[source],path:dir,...m,warnings,...extra};this.candidates.set(id,data);found.push({...data,remoteMods:undefined,clientSettings:undefined});};
  for(const root of selected?[selected]:roots(source)){
   if(!await exists(root))continue;
   try{
    const initial=found.length;
    if(source==='modrinth'){
     for(const dbfile of ['app.db','theseus.db'])if(await exists(path.join(root,dbfile))){
      const file=path.join(root,dbfile),sets=rows(file,'instance_content_sets');
      for(const p of rows(file,'instances')){const c=sets.find(s=>s.id===p.applied_content_set_id);if(c)await add(root,{...p,...c,name:p.name,path:p.path});}
      for(const p of rows(file,'profiles'))await add(root,p);
     }
    }
    if(source==='norisk'){
     for(const file of [path.join(root,'meta','app.db'),path.join(root,'app.db')])if(await exists(file)){const mods=rows(file,'profile_mods');for(const p of rows(file,'profiles'))await add(root,p,{remoteMods:mods.filter(m=>m.profile_id===p.id).map(m=>({...parse(m.source),enabled:!!m.enabled}))});}
     for(const file of [path.join(root,'profiles.json'),path.join(root,'meta','profiles.json')])if(await exists(file)){const p=await readJson(file);for(const item of values(p.profiles||p))await add(root,item,{remoteMods:item.mods||[]});}
    }
    if(source==='laby'||source==='badlion'||source==='folder'){
     for(const file of ['launcher_profiles.json','launcher_profiles_microsoft_store.json'])if(await exists(path.join(root,file))){const p=await readJson(path.join(root,file));for(const item of values(p.profiles)){if(source==='laby'&&!/laby/i.test(JSON.stringify({name:item.name,version:item.lastVersionId})))continue;const version=await inferVersion(root,item);await add(root,{...item,game_version:version,loader:source==='laby'?'vanilla':undefined});}}
    }
    // Per-profile JSON and exported plain Minecraft folders; bounded traversal never reads account files.
    const walk=async(dir,depth)=>{
     if(depth>4)return;const entries=await fs.readdir(dir,{withFileTypes:true});
     for(const name of ['profile.json','instance.json','modrinth.index.json'])if(entries.some(e=>e.name===name&&e.isFile())){try{const p=await readJson(path.join(dir,name));if(!p.mainClass&&!p.profile)await add(dir,p);}catch(e){errors.push(labels[source]+': '+e.message);}}
     if(entries.some(e=>['saves','options.txt','resourcepacks'].includes(e.name))&&found.length===initial)await add(dir,{name:path.basename(dir)});
     for(const e of entries)if(e.isDirectory()&&!e.isSymbolicLink()&&!privateName(e.name)&&!['mods','saves','resourcepacks','shaderpacks','assets','libraries','runtime','logs','screenshots','config','cache','meta'].includes(e.name))await walk(path.join(dir,e.name),depth+1);
    };
    if(found.length===initial||source==='lunar'||source==='laby')await walk(root,0);
    if(found.length===initial&&selected)await add(root,{name:path.basename(root)});
   }catch(e){errors.push(labels[source]+': '+e.message);}
  }
  return {profiles:found.slice(0,250),errors,source,sourceName:labels[source]};
 }
 candidate(id){const c=this.candidates.get(id);if(!c)throw new Error('Bitte die Profile erneut suchen.');return c;}
 async copy(id,destination,signal,onFile,selection={}){const c=this.candidate(id),copyVersion=selection.version||c.version,copyLoader=selection.loader||c.loader;await copyGame(c.path,destination,{signal,onFile});
  // Laby's "Open Fabric Directory" can point directly at a mods directory;
  // Lunar also keeps jars in version-specific fabric-* subdirectories.
  const collectMods=async(dir,depth=0)=>{if(depth>3||!await exists(dir))return;for(const e of await fs.readdir(dir,{withFileTypes:true})){signal?.throwIfAborted();if(e.isSymbolicLink())throw new Error('Mod-Verknüpfungen bitte im Quell-Launcher auflösen.');if(e.isFile()&&/\.jar(?:\.disabled)?$/i.test(e.name)){const dest=path.join(destination,'mods',relativePath(e.name));if(await exists(dest)){if(await require('./network.cjs').hashFile(dest,'sha1')!==await require('./network.cjs').hashFile(path.join(dir,e.name),'sha1'))throw new Error('Mehrere unterschiedliche Mods haben denselben Namen: '+e.name);}else await copyTree(path.join(dir,e.name),dest,{signal,onFile});}else if(e.isDirectory()&&(e.name==='dependencies'||e.name===copyLoader||e.name===copyVersion||e.name===`${copyLoader}-${copyVersion}`))await collectMods(path.join(dir,e.name),depth+1);}};
  if(['laby','lunar','folder'].includes(c.source)){await collectMods(path.join(c.path,'mods'));if(/^(?:mods|(?:fabric|forge|neoforge|quilt)(?:[-_].*)?)$/i.test(path.basename(c.path)))await collectMods(c.path);}
  if(c.source==='norisk')for(const mod of c.remoteMods||[]){const src=mod.source||mod;const name=mod.file_name_override||src.file_name;if(!name||!name.endsWith('.jar'))continue;relativePath(name);if(path.basename(name)!==name)throw new Error('Ungültiger Mod-Dateiname im NoRisk-Profil.');const target=path.join(destination,'mods',name+(mod.enabled===false?'.disabled':''));if(await exists(target))continue;const normal=path.join(destination,'mods',name);if(mod.enabled===false&&await exists(normal)){await fs.rename(normal,target);continue;}const url=src.download_url,hash=src.file_hash_sha1;if(url&&/^[a-f0-9]{40}$/i.test(hash||'')){await require('./network.cjs').download({url,sha1:hash,maxSize:256*1024*1024},target,signal);}else if(!await exists(normal))throw new Error('Die Mod '+name+' fehlt im Quellprofil. Starte das Profil einmal im NoRiskClient und versuche den Import erneut.');}
  // Retain proprietary UI preferences only as inert reference files, never as executable client components.
  const base=c.source==='lunar'?path.join(os.homedir(),'.lunarclient','settings','game'):c.source==='badlion'?path.join(c.path,'BLClient-Mod-Profiles'):c.source==='laby'?path.join(c.path,'labymod-neo','configs'):null;
  if(base&&await exists(base)){
   const copySettings=async(src,target,depth=0)=>{if(depth>8)return;for(const e of await fs.readdir(src,{withFileTypes:true})){if(e.isSymbolicLink()||privateName(e.name))continue;relativePath(e.name);if(e.isDirectory())await copySettings(path.join(src,e.name),path.join(target,e.name),depth+1);else if(/\.(json|txt|properties|toml|yml|yaml)$/i.test(e.name))await copyTree(path.join(src,e.name),path.join(target,e.name),{signal});}};
   await copySettings(base,path.join(destination,'imported-client-settings',c.source));
   if(c.source==='badlion')for(const name of await fs.readdir(c.path))if(/^BLClient-Mod-Profiles-[\w.-]+$/.test(name))await copySettings(path.join(c.path,name),path.join(destination,'imported-client-settings','badlion',name));
  }
  return c;
 }
}
module.exports={Importer,roots,metadata,rows};
