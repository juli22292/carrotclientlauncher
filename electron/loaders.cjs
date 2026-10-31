const fs = require('node:fs/promises');
const path = require('node:path');
const { spawn, execFile } = require('node:child_process');
const AdmZip = require('adm-zip');
const network = require('./network.cjs');
const definitions = require('./loader-definitions.json');
const ids = definitions.map(loader => loader.id);
const nameOf = id => definitions.find(loader => loader.id === id)?.name || id;
const stable = value => /^\d+(?:\.\d+){1,3}$/.test(value);
const newest = (a,b) => b.version.localeCompare(a.version, 'en', { numeric:true });

function neoMinecraft(version) {
  const p = version.split('.');
  if (Number(p[0]) >= 26) {
    const suffix = version.split('+')[1];
    return `${p[0]}.${p[1]}${p[2] !== '0' ? '.' + p[2] : ''}${suffix ? '-' + suffix : ''}`;
  }
  return `1.${p[0]}${p[1] !== '0' ? '.' + p[1] : ''}`;
}

function mergeProfile(base, extension) {
  const libraries = new Map();
  for (const lib of [...base.libraries, ...(extension.libraries || [])]) {
    const [group, artifact, , classifier=''] = lib.name.split(':');
    libraries.set(`${group}:${artifact}:${classifier}`, lib);
  }
  return { ...base, ...extension, libraries:[...libraries.values()],
    arguments:{ game:[...base.arguments.game, ...(extension.arguments?.game || [])],
      jvm:[...base.arguments.jvm, ...(extension.arguments?.jvm || [])] } };
}

function runInstaller(java, jar, root, { signal, progress=()=>{}, logFile }={}) {
  signal?.throwIfAborted();
  return new Promise((resolve,reject) => {
    const child = spawn(java, ['-Djava.awt.headless=true','-jar',jar,'--installClient',root],
      { cwd:path.dirname(jar), windowsHide:true, stdio:['ignore','pipe','pipe'] });
    let tail='', ended=false, last=0, timedOut=false;
    const log = require('node:fs').createWriteStream(logFile || jar+'.log');
    log.on('error',()=>{});
    const stop = () => {
      if (process.platform === 'win32' && child.pid) execFile('taskkill',['/PID',String(child.pid),'/T','/F'],{windowsHide:true},()=>{});
      else child.kill();
    };
    const timer = setTimeout(()=>{timedOut=true;stop();}, 15*60*1000);
    const finish = error => {
      if (ended) return; ended=true; clearTimeout(timer); signal?.removeEventListener('abort',stop); log.end();
      if (error) reject(error); else resolve();
    };
    signal?.addEventListener('abort',stop,{once:true});
    const output = chunk => {
      const value=chunk.toString(); tail=(tail+value).slice(-16000); log.write(value);
      if (Date.now()-last>500) {
        const line=value.split(/[\r\n]+/).filter(l=>/download|processing|patch|extract|install|consider/i.test(l)).at(-1);
        if (line) { progress(line.slice(0,150)); last=Date.now(); }
      }
    };
    child.stdout.on('data',output); child.stderr.on('data',output);
    child.once('error',e=>finish(new Error('Loader-Installer konnte nicht gestartet werden: '+e.message)));
    child.once('close',code=>{
      if (signal?.aborted) return finish(signal.reason || new Error('Installation abgebrochen.'));
      if (timedOut) return finish(new Error('Der Loader-Installer hat zu lange benötigt. Bitte die Internetverbindung prüfen und erneut versuchen.'));
      if (code !== 0) return finish(new Error(`Loader-Installation fehlgeschlagen (${code}). ${tail.split(/[\r\n]+/).filter(Boolean).slice(-3).join(' ').slice(0,500)}`));
      finish();
    });
  });
}

class Loaders {
  constructor(root, { getJson=network.json, getText=network.text, getDownload=network.download, install=runInstaller }={}) {
    this.root=root; this.json=getJson; this.text=getText; this.download=getDownload; this.run=install; this.cache=new Map();
  }
  async versions(loader, game, signal) {
    if (!ids.includes(loader) || !/^[\w.-]{1,80}$/.test(game)) throw new Error('Ungültiger Modloader oder Minecraft-Version.');
    if (loader==='vanilla') return [];
    const key=loader+':'+game, cached=this.cache.get(key);
    if (cached && Date.now()-cached.time<10*60*1000) return cached.value;
    let list=[];
    if (loader==='fabric' || loader==='quilt') {
      const host=loader==='fabric'?'https://meta.fabricmc.net/v2':'https://meta.quiltmc.org/v3';
      const data=await this.json(`${host}/versions/loader/${encodeURIComponent(game)}`,signal);
      if (!Array.isArray(data)) throw new Error('Die Loader-Versionsliste konnte nicht gelesen werden.');
      list=data.map(item=>({version:item.loader.version,stable:loader==='fabric'?item.loader.stable:stable(item.loader.version)}));
    } else if (loader==='forge' || game==='1.20.1') {
      const group=loader==='forge'?'net/minecraftforge/forge':'net/neoforged/forge';
      const host=loader==='forge'?'https://maven.minecraftforge.net':'https://maven.neoforged.net/releases';
      const xml=await this.text(`${host}/${group}/maven-metadata.xml`,signal);
      list=[...xml.matchAll(/<version>([^<]+)<\/version>/g)].map(m=>m[1]).filter(v=>v.startsWith(game+'-')).map(v=>({version:v.slice(game.length+1),artifactVersion:v,group,host,stable:stable(v.slice(game.length+1))}));
    } else {
      const data=await this.json('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge',signal);
      list=(data.versions||[]).filter(v=>!v.startsWith('0')&&neoMinecraft(v)===game).map(version=>({version,artifactVersion:version,group:'net/neoforged/neoforge',host:'https://maven.neoforged.net/releases',stable:stable(version)}));
    }
    list=list.filter(v=>/^[\w.+-]{1,80}$/.test(v.version)).sort((a,b)=>Number(b.stable)-Number(a.stable)||newest(a,b));
    this.cache.set(key,{time:Date.now(),value:list}); return list;
  }
  async prepare(instance, base, { signal, onBytes, stage=()=>{}, ensureJava }={}) {
    const loader=instance.loader;
    if (!ids.includes(loader)) throw new Error('Unbekannter Modloader.');
    if (loader==='vanilla') return { profile:base, loaderVersion:'' };
    const list=await this.versions(loader,instance.version,signal);
    const pin=instance.loaderVersion?.replace(instance.version+'-','');
    const selected=pin?list.find(v=>v.version===pin):list[0];
    if (!selected) throw new Error(`${nameOf(loader)}${pin?' '+pin:''} ist für Minecraft ${instance.version} nicht verfügbar. Wähle eine passende Minecraft-/Loader-Version.`);
    stage(`${nameOf(loader)} ${selected.version} wird vorbereitet`);
    if (loader==='fabric' || loader==='quilt') {
      const host=loader==='fabric'?'https://meta.fabricmc.net/v2':'https://meta.quiltmc.org/v3';
      const extension=await this.json(`${host}/versions/loader/${encodeURIComponent(instance.version)}/${encodeURIComponent(selected.version)}/profile/json`,signal);
      return {profile:mergeProfile(base,extension),loaderVersion:selected.version};
    }
    const artifact=selected.group.split('/').at(-1), version=selected.artifactVersion;
    const url=`${selected.host}/${selected.group}/${version}/${artifact}-${version}-installer.jar`;
    const checksum=(await this.text(url+'.sha1',signal)).trim().split(/\s+/)[0];
    if (!/^[a-f0-9]{40}$/i.test(checksum)) throw new Error('Die Prüfsumme des offiziellen Loader-Installers fehlt.');
    const jar=network.safeChild(this.root,`loader-installers/${loader}-${instance.version}-${selected.version}.jar`);
    await this.download({url,sha1:checksum,maxSize:64*1024*1024},jar,signal,onBytes);
    const archive=new AdmZip(jar), metadata=JSON.parse(archive.readAsText('install_profile.json'));
    const extension=JSON.parse(archive.readAsText('version.json'));
    if (metadata.minecraft!==instance.version || extension.inheritsFrom!==instance.version || !/^[\w.+-]{1,160}$/.test(extension.id)) throw new Error('Der Loader-Installer passt nicht zur Minecraft-Version.');
    const java=await ensureJava(base.javaVersion?.majorVersion || 8,signal,onBytes);
    const vanillaDir=network.safeChild(this.root,'versions/'+instance.version);
    await fs.mkdir(vanillaDir,{recursive:true}); await fs.writeFile(path.join(vanillaDir,instance.version+'.json'),JSON.stringify(base));
    const launcher=path.join(this.root,'launcher_profiles.json');
    try { await fs.writeFile(launcher,JSON.stringify({profiles:{}}),{flag:'wx'}); } catch(e) {if(e.code!=='EEXIST')throw e;}
    await this.run(java,jar,this.root,{signal,progress:line=>stage(`${nameOf(loader)} · ${line}`),logFile:jar+'.carrot.log'});
    const installed=JSON.parse(await fs.readFile(network.safeChild(this.root,`versions/${extension.id}/${extension.id}.json`),'utf8'));
    if (installed.id!==extension.id || installed.inheritsFrom!==instance.version) throw new Error('Das installierte Loader-Profil ist ungültig.');
    return {profile:mergeProfile(base,installed),loaderVersion:selected.version};
  }
}
module.exports={Loaders,ids,nameOf,neoMinecraft,mergeProfile,runInstaller};
