const fs = require('node:fs/promises');
const path = require('node:path');
const crypto = require('node:crypto');
const os = require('node:os');
const loaderIds = require('./loader-definitions.json').map(loader=>loader.id);

const defaults = {
  memory: Math.max(1024, Math.min(4096, Math.floor(os.totalmem() / 1024 / 1024 / 2 / 512) * 512)),
  javaPath: '', width: 1280, height: 720, snapshots: false, minimizeOnLaunch: true, discordRichPresence: true, autoBackup: true, language: 'de'
};
function validateSettings(value) {
  const out = {};
  if (['de', 'en'].includes(value.language)) out.language = value.language;
  if (Number.isInteger(value.memory) && value.memory >= 1024 && value.memory <= Math.min(32768, Math.floor(os.totalmem() / 1024 / 1024))) out.memory = value.memory;
  if (typeof value.javaPath === 'string' && value.javaPath.length < 1000) out.javaPath = value.javaPath;
  for (const key of ['width', 'height']) if (Number.isInteger(value[key]) && value[key] >= 480 && value[key] <= 7680) out[key] = value[key];
  for (const key of ['snapshots', 'minimizeOnLaunch', 'discordRichPresence', 'autoBackup']) if (typeof value[key] === 'boolean') out[key] = value[key];
  return out;
}
class Store {
  constructor(root) { this.root = root; this.file = path.join(root, 'launcher.json'); this.data = { settings: { ...defaults }, instances: [] }; this.pending = Promise.resolve(); }
  async init() {
    await fs.mkdir(this.root, { recursive: true });
    try {
      const saved = JSON.parse(await fs.readFile(this.file, 'utf8'));
      this.data = { settings: { ...defaults, ...validateSettings(saved.settings || {}) }, instances: (saved.instances || []).filter(i => /^[a-f0-9-]{36}$/.test(i.id)) };
      if ('username' in (saved.settings || {}) || 'microsoftClientId' in (saved.settings || {})) await this.save();
    } catch (e) { if (e.code !== 'ENOENT') await fs.copyFile(this.file, this.file + '.backup').catch(() => {}); }
    return this;
  }
  save() {
    const content = JSON.stringify(this.data, null, 2);
    const next = this.pending.catch(() => {}).then(async () => { await fs.writeFile(this.file + '.tmp', content); await fs.rename(this.file + '.tmp', this.file); });
    this.pending = next;
    return next;
  }
  instance(id) { const i = this.data.instances.find(i => i.id === id); if (!i) throw new Error('Diese Instanz wurde nicht gefunden.'); return i; }
  directory(id) { this.instance(id); return path.join(this.root, 'instances', id); }
  async create({ name, version, loader, color, loaderVersion = '', description = '', modpack = null }, { preparedDirectory } = {}) {
    if (typeof name !== 'string' || !name.trim() || name.trim().length > 40) throw new Error('Bitte gib einen Namen mit 1 bis 40 Zeichen ein.');
    if (typeof version !== 'string' || !/^[a-zA-Z0-9_.-]{1,80}$/.test(version)) throw new Error('Ungültige Minecraft-Version.');
    if (!loaderIds.includes(loader)) throw new Error('Unbekannter Modloader.');
    const i = { id: crypto.randomUUID(), name: name.trim(), version, loader, color: ['moss', 'clay', 'lake', 'plum'].includes(color) ? color : 'moss', createdAt: Date.now(), lastPlayed: null, playtime: 0, installed: false };
    i.loaderVersion = /^[\w.+-]{0,80}$/.test(loaderVersion) ? loaderVersion : '';
    i.description = String(description).slice(0,300); i.favorite = false;
    if(modpack&&typeof modpack==='object'){
      i.modpack={title:String(modpack.title||name).slice(0,100),versionName:String(modpack.versionName||'').slice(0,100)};
      for(const field of ['projectId','versionId'])if(typeof modpack[field]==='string'&&/^[-\w]{1,100}$/.test(modpack[field]))i.modpack[field]=modpack[field];
    }
    const directory=path.join(this.root,'instances',i.id);await fs.mkdir(path.dirname(directory),{recursive:true});
    if(preparedDirectory){const staged=path.resolve(preparedDirectory);if(!staged.startsWith(path.resolve(this.root)+path.sep))throw new Error('Ungültiges Importverzeichnis.');await fs.rename(staged,directory);}else await fs.mkdir(directory,{recursive:true});
    this.data.instances.push(i);await this.save();return i;
  }
  async update(id, value) {
    const instance = this.instance(id);
    if (typeof value.name === 'string' && value.name.trim() && value.name.trim().length <= 40) instance.name = value.name.trim();
    if (typeof value.description === 'string') instance.description = value.description.slice(0,300);
    if (typeof value.favorite === 'boolean') instance.favorite = value.favorite;
    for (const key of ['cover', 'icon']) if (value[key] === '' || (typeof value[key] === 'string' && value[key].length < 1800000 && /^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(value[key]))) instance[key] = value[key];
    await this.save(); return instance;
  }
  async remove(id) {
    this.instance(id);
    // Keep saves recoverable: remove from library and move the entire instance to a local archive.
    const source = this.directory(id), target = path.join(this.root, 'archive', id + '-' + Date.now());
    await fs.mkdir(path.dirname(target), { recursive: true });
    await fs.rename(source, target).catch(e => { if (e.code !== 'ENOENT') throw e; });
    this.data.instances = this.data.instances.filter(i => i.id !== id); await this.save();
  }
  async settings(value) { Object.assign(this.data.settings, validateSettings(value)); await this.save(); return this.data.settings; }
}
module.exports = { Store, validateSettings };
