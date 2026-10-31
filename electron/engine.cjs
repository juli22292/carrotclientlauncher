const fs = require('node:fs/promises');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const { spawn, execFile } = require('node:child_process');
const { promisify } = require('node:util');
const AdmZip = require('adm-zip');
const { json, download, pool, safeChild } = require('./network.cjs');
const { requireSession } = require('./auth.cjs');
const { MICROSOFT_CLIENT_ID } = require('./config.cjs');
const exec = promisify(execFile);
const manifestUrl = 'https://piston-meta.mojang.com/mc/game/version_manifest_v2.json';

function allowed(rules, features = {}) {
  if (!rules?.length) return true;
  let result = false;
  for (const r of rules) {
    const platform = r.os;
    if (platform?.name && platform.name !== 'windows') continue;
    if (platform?.arch && !['x86_64', 'amd64', 'x64'].includes(platform.arch)) continue;
    if (platform?.version && !new RegExp(platform.version).test(os.release())) continue;
    if (r.features && !Object.entries(r.features).every(([k, v]) => (features[k] || false) === v)) continue;
    result = r.action === 'allow';
  }
  return result;
}
function argsFrom(items, variables, features) {
  return (items || []).flatMap(a => typeof a === 'string' ? [a] : allowed(a.rules, features) ? (Array.isArray(a.value) ? a.value : [a.value]) : [])
    .map(a => a.replace(/\$\{([^}]+)\}/g, (_, key) => { if (!(key in variables)) throw new Error('Unbekanntes Startargument: ' + key); return String(variables[key]); }));
}
function maven(lib) {
  if (lib.downloads?.artifact) return lib.downloads.artifact;
  const [group, name, version, classifier] = lib.name.split(':');
  const relative = `${group.replaceAll('.', '/')}/${name}/${version}/${name}-${version}${classifier ? '-' + classifier : ''}.jar`;
  return { path: relative, url: (lib.url || 'https://libraries.minecraft.net/') + relative };
}
async function javaVersion(file) {
  try { const r = await exec(file, ['-version'], { windowsHide: true, timeout: 10000 }); const match = (r.stderr + r.stdout).match(/version\s+"(?:1\.)?(\d+)/); return match ? Number(match[1]) : 0; } catch { return 0; }
}
function extractZip(file, root, excludes = []) {
  const archive = new AdmZip(file);
  for (const entry of archive.getEntries()) {
    if (entry.isDirectory || excludes.some(e => entry.entryName.startsWith(e))) continue;
    safeChild(root, entry.entryName.replaceAll('\\', '/'));
    archive.extractEntryTo(entry, root, true, true);
  }
}
class Engine {
  constructor(store, emit, { spawnProcess = spawn } = {}) { this.store = store; this.emit = emit; this.spawnProcess = spawnProcess; this.jobs = []; this.running = new Map(); this.starting=new Set();this.busy = null; this.manifest = null; }
  async versions() {
    if (!this.manifest) {
      try { this.manifest = await json(manifestUrl); await fs.writeFile(path.join(this.store.root, 'versions-cache.json'), JSON.stringify(this.manifest)); }
      catch (e) { try { this.manifest = JSON.parse(await fs.readFile(path.join(this.store.root, 'versions-cache.json'), 'utf8')); } catch { throw e; } }
    }
    return { latest: this.manifest.latest, versions: this.manifest.versions.filter(v => ['release', 'snapshot'].includes(v.type) && new Date(v.releaseTime) >= new Date('2020-06-23')).map(({ id, type }) => ({ id, type })) };
  }
  status() { return { jobs: this.jobs, running: [...this.running.keys()], busy: this.busy?.instanceId }; }
  change(job, data) { Object.assign(job, data); this.emit('status', this.status()); }
  cancel() { this.busy?.controller.abort(new Error('Download abgebrochen.')); }
  async install(id) {
    if (this.busy) throw new Error('Es läuft bereits ein Download. Bitte warte kurz.');
    const instance = this.store.instance(id);
    if (this.running.has(id)) throw new Error('Diese Instanz läuft bereits.');
    const controller = new AbortController(), signal = controller.signal;
    const job = { id: crypto.randomUUID(), instanceId: id, name: instance.name, state: 'running', stage: 'Vorbereitung', progress: 0, bytes: 0, started: Date.now() };
    this.jobs.unshift(job); this.jobs = this.jobs.slice(0, 30); this.busy = { controller, instanceId: id }; this.emit('status', this.status());
    let lastUpdate = 0;
    const onBytes = n => { job.bytes += n; if (Date.now() - lastUpdate > 200) { this.emit('status', this.status()); lastUpdate = Date.now(); } };
    try {
      await this.versions();
      const entry = this.manifest.versions.find(v => v.id === instance.version);
      if (!entry) throw new Error('Diese Minecraft-Version ist nicht verfügbar.');
      const base = await json(entry.url, signal);
      if (!base.arguments) throw new Error('Diese ältere Version wird noch nicht unterstützt. Wähle Minecraft 1.16 oder neuer.');
      const root = this.store.root, game = this.store.directory(id), versionDir = path.join(root, 'versions', instance.version);
      await fs.mkdir(versionDir, { recursive: true });
      await download(base.downloads.client, path.join(versionDir, instance.version + '.jar'), signal, onBytes);
      this.change(job, { progress: 8, stage: 'Bibliotheken werden geladen' });
      let profile = base;
      if (instance.loader === 'fabric') {
        const loaders = await json(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(instance.version)}`, signal);
        const loader = instance.loaderVersion ? loaders.find(l => l.loader.version === instance.loaderVersion) : loaders.find(l => l.loader.stable) || loaders[0];
        if (!loader) throw new Error('Für diese Minecraft-Version ist Fabric noch nicht verfügbar.');
        instance.loaderVersion=loader.loader.version;
        const fabric = await json(`https://meta.fabricmc.net/v2/versions/loader/${encodeURIComponent(instance.version)}/${loader.loader.version}/profile/json`, signal);
        profile = { ...base, id: fabric.id, mainClass: fabric.mainClass, libraries: [...fabric.libraries, ...base.libraries], arguments: { game: [...base.arguments.game, ...(fabric.arguments?.game || [])], jvm: [...base.arguments.jvm, ...(fabric.arguments?.jvm || [])] } };
      }
      const libraries = profile.libraries.filter(l => allowed(l.rules));
      const tasks = [];
      for (const lib of libraries) {
        const artifact = maven(lib);
        if (artifact?.url) tasks.push({ ...artifact, destination: safeChild(path.join(root, 'libraries'), artifact.path) });
        const classifier = lib.natives?.windows?.replace('${arch}', '64');
        const native = lib.downloads?.classifiers?.[classifier];
        if (native) tasks.push({ ...native, destination: safeChild(path.join(root, 'libraries'), native.path), native: true, excludes: lib.extract?.exclude || [] });
      }
      let completed = 0;
      await pool(tasks, async task => { signal.throwIfAborted(); await download(task, task.destination, signal, onBytes); completed++; this.change(job, { progress: 8 + Math.round(completed / tasks.length * 22) }); });
      const natives = path.join(game, 'natives'); await fs.mkdir(natives, { recursive: true });
      for (const task of tasks.filter(t => t.native)) extractZip(task.destination, natives, task.excludes);
      this.change(job, { progress: 30, stage: 'Spielinhalte werden geladen' });
      const assetsRoot = path.join(root, 'assets');
      const indexFile = safeChild(path.join(assetsRoot, 'indexes'), base.assetIndex.id + '.json');
      await download(base.assetIndex, indexFile, signal, onBytes);
      const index = JSON.parse(await fs.readFile(indexFile, 'utf8'));
      const assets = [...new Map(Object.entries(index.objects).map(([name, value]) => [value.hash, { ...value, name }])).values()];
      completed = 0;
      await pool(assets, async asset => {
        const relative = `${asset.hash.slice(0, 2)}/${asset.hash}`;
        await download({ url: `https://resources.download.minecraft.net/${relative}`, sha1: asset.hash, size: asset.size }, safeChild(path.join(assetsRoot, 'objects'), relative), signal, onBytes);
        completed++;
        if (completed % 30 === 0 || completed === assets.length) this.change(job, { progress: 30 + Math.round(completed / assets.length * 55) });
      }, 12);
      this.change(job, { progress: 85, stage: `Java ${base.javaVersion?.majorVersion || 8} wird vorbereitet` });
      const java = await this.ensureJava(base.javaVersion?.majorVersion || 8, signal, onBytes);
      for (const folder of ['mods', 'resourcepacks', 'shaderpacks', 'saves']) await fs.mkdir(path.join(game, folder), { recursive: true });
      await fs.writeFile(path.join(game, 'profile.json'), JSON.stringify({ profile, java, baseVersion: instance.version }));
      instance.installed = true; await this.store.save();
      this.change(job, { state: 'complete', progress: 100, stage: 'Bereit zum Spielen', finished: Date.now() });
      return true;
    } catch (e) { this.change(job, { state: signal.aborted ? 'cancelled' : 'error', stage: signal.aborted ? 'Abgebrochen' : e.message, finished: Date.now() }); throw e; }
    finally { this.busy = null; this.emit('status', this.status()); this.emit('data'); }
  }
  async ensureJava(major, signal, onBytes) {
    const custom = this.store.data.settings.javaPath;
    if (custom) { const found = await javaVersion(custom); if (found !== major) throw new Error(`Diese Version benötigt Java ${major}; ausgewählt ist ${found || 'kein gültiges Java'}. Nutze „Automatisch“.`); return custom; }
    // Use the exact Java generation requested by the version to avoid incompatible JVM flags.
    const runtimeRoot = path.join(this.store.root, 'runtime', String(major));
    try { const cached = (await fs.readdir(runtimeRoot)).find(n => n.startsWith('jdk-') || n.startsWith('jre-')); if (cached) { const java = path.join(runtimeRoot, cached, 'bin', 'java.exe'); if (await javaVersion(java) === major) return java; } } catch {}
    const candidates = ['java'];
    if (process.env.JAVA_HOME) candidates.unshift(path.join(process.env.JAVA_HOME, 'bin', 'java.exe'));
    for (const candidate of candidates) if (await javaVersion(candidate) === major) return candidate;
    const assets = await json(`https://api.adoptium.net/v3/assets/latest/${major}/hotspot?architecture=x64&image_type=jre&os=windows&vendor=eclipse`, signal);
    const binary = assets[0]?.binary?.package;
    if (!binary) throw new Error(`Java ${major} konnte nicht automatisch gefunden werden. Bitte wähle Java in den Einstellungen.`);
    const zip = path.join(this.store.root, 'runtime', `java-${major}.zip`);
    await download({ url: binary.link, sha256: binary.checksum, size: binary.size }, zip, signal, onBytes);
    await fs.mkdir(runtimeRoot, { recursive: true }); extractZip(zip, runtimeRoot);
    await fs.rm(zip, { force: true });
    const folder = (await fs.readdir(runtimeRoot)).find(n => n.startsWith('jdk-') || n.startsWith('jre-'));
    if (!folder) throw new Error('Java konnte nicht entpackt werden.');
    const java = path.join(runtimeRoot, folder, 'bin', 'java.exe');
    if (await javaVersion(java) !== major) throw new Error('Die heruntergeladene Java-Laufzeit funktioniert nicht.');
    return java;
  }
  async launch(id, account) {
    account = requireSession(account);
    if(this.busy)throw new Error('Bitte warte, bis der aktuelle Vorgang abgeschlossen ist.');
    if (this.running.has(id)||this.starting.has(id)) throw new Error('Diese Instanz läuft bereits oder wird gestartet.');
    this.starting.add(id);
    try {
    const instance = this.store.instance(id);
    if (!instance.installed) await this.install(id);
    const game = this.store.directory(id), settings = this.store.data.settings;
    const { profile, java, baseVersion } = JSON.parse(await fs.readFile(path.join(game, 'profile.json'), 'utf8'));
    const libraries = profile.libraries.filter(l => allowed(l.rules)).map(l => maven(l)).filter(a => a?.url).map(a => safeChild(path.join(this.store.root, 'libraries'), a.path));
    const variables = {
      auth_player_name: account.name, auth_uuid: account.id, auth_access_token: account.accessToken,
      clientid: MICROSOFT_CLIENT_ID, auth_xuid: account.xuid || '', user_type: account.type === 'offline' ? 'legacy' : 'msa', user_properties: '{}', version_name: profile.id,
      game_directory: game, assets_root: path.join(this.store.root, 'assets'), assets_index_name: profile.assetIndex.id, version_type: profile.type,
      resolution_width: settings.width, resolution_height: settings.height, natives_directory: path.join(game, 'natives'), launcher_name: 'CarrotClientLauncher', launcher_version: require('../package.json').version,
      classpath: [...libraries, path.join(this.store.root, 'versions', baseVersion, baseVersion + '.jar')].join(path.delimiter), library_directory: path.join(this.store.root, 'libraries'), classpath_separator: path.delimiter
    };
    const features = { has_custom_resolution: true };
    const args = [`-Xmx${settings.memory}M`, '-Xms512M', ...argsFrom(profile.arguments.jvm, variables, features), profile.mainClass, ...argsFrom(profile.arguments.game, variables, features)];
    const launchJob={id:crypto.randomUUID(),instanceId:id,name:instance.name,state:'running',stage:'Minecraft startet',progress:95,bytes:0,started:Date.now()};this.jobs.unshift(launchJob);this.jobs=this.jobs.slice(0,30);this.change(launchJob,{});
    const log = require('node:fs').createWriteStream(path.join(game, 'launcher-game.log'));
    const child = this.spawnProcess(java, args, { cwd: game, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] });
    await new Promise((resolve, reject) => { child.once('spawn', resolve); child.once('error', reject); }).catch(e => { log.end();this.change(launchJob,{state:'error',stage:'Minecraft konnte nicht gestartet werden',finished:Date.now()});throw new Error('Minecraft konnte nicht gestartet werden: ' + e.message); });
    const redact = chunk => { let text = chunk.toString(); if (account.type !== 'offline' && account.accessToken) text = text.replaceAll(account.accessToken, '[redacted]'); log.write(text); };
    child.stdout.on('data', redact); child.stderr.on('data', redact);
    const start = Date.now(); this.running.set(id, child); instance.lastPlayed = start;
    let outputTail='';child.stdout.on('data',chunk=>{outputTail=(outputTail+chunk.toString()).slice(-32000);});child.stderr.on('data',chunk=>{outputTail=(outputTail+chunk.toString()).slice(-32000);});
    child.once('exit', async code => { log.end(); this.running.delete(id); instance.lastExitCode=code;instance.playtime += Math.round((Date.now() - start) / 1000); await this.store.save(); this.emit('status', this.status()); this.emit('data'); if (code) {const diagnosis=require('./diagnostics.cjs').explain(outputTail,code);this.emit('game-error', { id, message:diagnosis.title+'. '+diagnosis.help });} });
    this.change(launchJob,{state:'complete',progress:100,stage:'Minecraft läuft',finished:Date.now()});
    this.emit('status', this.status()); await this.store.save(); this.emit('data');
    return { launched: true };
    }finally{this.starting.delete(id);}
  }
}
module.exports = { Engine, allowed, argsFrom, maven, javaVersion };
