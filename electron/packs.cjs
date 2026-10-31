const fs=require('node:fs/promises');
const path=require('node:path');
const AdmZip=require('adm-zip');
const {gamePath,relativePath}=require('./files.cjs');
const {safeChild,checkUrl,download,pool}=require('./network.cjs');
function inspectArchive(file){
 const zip=new AdmZip(file),entries=zip.getEntries();let total=0;const seen=new Set();
 if(entries.length>30000)throw new Error('Das Modpack enthält zu viele Dateien.');
 for(const e of entries){const name=relativePath(e.entryName.replace(/\/$/,''));const key=name.toLowerCase();if(seen.has(key))throw new Error('Das Modpack enthält doppelte Dateipfade.');seen.add(key);if((e.header.attr>>>16&0xf000)===0xa000)throw new Error('Verknüpfungen im Modpack sind nicht erlaubt.');total+=e.header.size;if(e.header.size>256*1024*1024||total>2*1024*1024*1024)throw new Error('Das Modpack überschreitet die Entpackgrenze (256 MB pro Datei / 2 GB insgesamt).');}
 const index=zip.getEntry('modrinth.index.json');if(!index||index.header.size>4*1024*1024)throw new Error('Diese Datei ist kein gültiges Modrinth-Modpack (.mrpack).');
 const data=JSON.parse(index.getData().toString('utf8'));
 if(data.formatVersion!==1||data.game!=='minecraft'||!Array.isArray(data.files)||data.files.length>20000)throw new Error('Dieses Modpack-Format wird nicht unterstützt.');
 const dependencies=data.dependencies||{};
 if(!dependencies.minecraft||!/^[\w.-]{1,80}$/.test(dependencies.minecraft))throw new Error('Die Minecraft-Version des Modpacks fehlt.');
 if(Object.keys(dependencies).some(k=>!['minecraft','fabric-loader'].includes(k)))throw new Error('Dieses Modpack benötigt '+Object.keys(dependencies).filter(k=>k!=='minecraft').join(', ')+'. Unterstützt werden derzeit Vanilla und Fabric.');
 if(dependencies['fabric-loader']&&!/^[\w.+-]{1,80}$/.test(dependencies['fabric-loader']))throw new Error('Ungültige Fabric-Version.');
 const paths=new Set();
 if(data.files.some(f=>f.path?.toLowerCase()==='carrot-content.json'))throw new Error('Ein Modpack darf keine Launcher-Verwaltungsdaten überschreiben.');
 for(const f of data.files){const p=gamePath(f.path);if(paths.has(p.toLowerCase()))throw new Error('Das Modpack enthält doppelte Downloads.');paths.add(p.toLowerCase());if(!/^[a-f0-9]{40}$/i.test(f.hashes?.sha1||'')&&!/^[a-f0-9]{128}$/i.test(f.hashes?.sha512||''))throw new Error('Eine Dateiprüfsumme fehlt im Modpack.');if(!Number.isSafeInteger(f.fileSize)||f.fileSize<0||f.fileSize>256*1024*1024)throw new Error('Ungültige Dateigröße im Modpack.');if(!Array.isArray(f.downloads)||!f.downloads.length)throw new Error('Eine Download-Adresse fehlt.');f.downloads.forEach(checkUrl);if(f.env?.client&&!['required','optional','unsupported'].includes(f.env.client))throw new Error('Ungültige Client-Zuordnung.');}
 for(const e of entries){if(e.isDirectory)continue;for(const prefix of ['overrides/','client-overrides/'])if(e.entryName.startsWith(prefix)){const p=gamePath(e.entryName.slice(prefix.length));if(p==='carrot-content.json')throw new Error('Ein Modpack darf keine Launcher-Verwaltungsdaten überschreiben.');}}
 return {zip,data,entries};
}
function packInfo(file){const {data}=inspectArchive(file);return {name:String(data.name||'Modpack').slice(0,40),description:String(data.summary||'').slice(0,300),version:data.dependencies.minecraft,loader:data.dependencies['fabric-loader']?'fabric':'vanilla',loaderVersion:data.dependencies['fabric-loader']||'',files:data.files.filter(f=>f.env?.client!=='unsupported').length,optional:data.files.filter(f=>f.env?.client==='optional').length};}
async function installPack(file,target,{signal,optional=false,progress=()=>{}}={}){
 const {zip,data,entries}=inspectArchive(file),files=data.files.filter(f=>f.env?.client!=='unsupported'&&(optional||f.env?.client!=='optional'));let done=0;
 await pool(files,async f=>{signal?.throwIfAborted();let failure;for(const url of f.downloads){try{await download({url,sha1:f.hashes.sha1,sha512:f.hashes.sha512,size:f.fileSize,maxSize:256*1024*1024},safeChild(target,gamePath(f.path)),signal);failure=null;break;}catch(e){failure=e;if(signal?.aborted)throw e;}}if(failure)throw failure;progress(++done/Math.max(files.length,1)*85,'Modpack-Dateien werden geprüft und geladen');},5);
 for(const prefix of ['overrides/','client-overrides/'])for(const entry of entries){signal?.throwIfAborted();if(entry.isDirectory||!entry.entryName.startsWith(prefix))continue;const destination=safeChild(target,gamePath(entry.entryName.slice(prefix.length)));await fs.mkdir(path.dirname(destination),{recursive:true});await fs.writeFile(destination,entry.getData(),{flag:'w'});}
 progress(100,'Modpack importiert');return packInfo(file);
}
module.exports={inspectArchive,packInfo,installPack};
