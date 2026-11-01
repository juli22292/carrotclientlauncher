const { app, BrowserWindow, ipcMain, shell, dialog, nativeImage, protocol, net, session } = require('electron');
const path = require('node:path');
const os = require('node:os');
const { pathToFileURL, fileURLToPath } = require('node:url');
const { Store } = require('./store.cjs');
const { Engine } = require('./engine.cjs');
const { Auth } = require('./auth.cjs');
const { DiscordPresence, syncPresence } = require('./discord.cjs');
const { Updates } = require('./updates.cjs');
const { MICROSOFT_CLIENT_ID } = require('./config.cjs');
const { Content } = require('./content.cjs');
const { report } = require('./diagnostics.cjs');
const { json } = require('./network.cjs');
const { searchParameters } = require('./search.cjs');
protocol.registerSchemesAsPrivileged([{ scheme: 'carrot', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.setName('CarrotClientLauncher');
app.setAppUserModelId('de.carrotclient.launcher');
if (process.env.CARROT_DATA_DIR) {
  const directory = path.resolve(process.env.CARROT_DATA_DIR);
  require('node:fs').mkdirSync(directory, { recursive: true }); app.setPath('userData', directory);
}
let window, store, engine, auth, presence, updates, content;
const updatePresence = () => syncPresence(presence, engine, store, process.env.CARROT_DISABLE_DISCORD === '1');
const emit = (event, value) => { if (event === 'status') updatePresence(); if (window && !window.isDestroyed()) window.webContents.send('carrot:' + event, value); };
function bind(name, handler) {
  ipcMain.handle('carrot:' + name, async (event, ...args) => {
    const url = event.senderFrame?.url || '';
    if (event.sender !== window?.webContents || !(url.startsWith('carrot://app/') || (process.env.CARROT_DEV_URL && new URL(url).origin === process.env.CARROT_DEV_URL))) throw new Error('Unbekannte Anfrage.');
    try { return await handler(...args); } catch (e) { throw new Error(e.message.replace(/Bearer\s+\S+/g, '[redacted]')); }
  });
}
function createWindow() {
  window = new BrowserWindow({ width: 1440, height: 940, minWidth: 1080, minHeight: 720, frame: false, backgroundColor: '#121714', title: 'CarrotClientLauncher', icon: nativeImage.createFromPath(path.join(__dirname, '../assets/icon.ico')), show: false,
    webPreferences: { preload: path.join(__dirname, 'preload.cjs'), contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false }
  });
  window.webContents.setWindowOpenHandler(() => ({ action: 'deny' }));
  window.webContents.on('will-navigate', event => event.preventDefault());
  window.once('ready-to-show', () => { window.show(); if (process.env.CARROT_SMOKE_TEST) setTimeout(() => app.quit(), 3000); });
  if (process.env.CARROT_DEV_URL) window.loadURL(process.env.CARROT_DEV_URL); else window.loadURL('carrot://app/index.html');
}
if (!app.requestSingleInstanceLock()) app.quit();
else {
  app.on('second-instance', () => { if (window?.isMinimized()) window.restore(); window?.focus(); });
  app.whenReady().then(async () => {
    const dist = path.resolve(__dirname, '../dist');
    protocol.handle('carrot', request => {
      const url = new URL(request.url); const file = path.resolve(dist, '.' + decodeURIComponent(url.pathname));
      if (url.hostname !== 'app' || !file.startsWith(dist + path.sep)) return new Response('', { status: 403 });
      return net.fetch(pathToFileURL(file).href);
    });
    session.defaultSession.setPermissionRequestHandler((_, __, callback) => callback(false));
    store = await new Store(process.env.CARROT_DATA_DIR || path.join(app.getPath('appData'), 'CarrotClientLauncher')).init();
    presence = new DiscordPresence();
    engine = new Engine(store, emit); content=new Content(store,engine,emit);auth = new Auth(store, emit); await auth.init();
    const updateEnabled = app.isPackaged && process.platform === 'win32' && process.env.CARROT_DISABLE_UPDATES !== '1';
    updates = new Updates({ client: updateEnabled ? require('electron-updater').autoUpdater : null, version: app.getVersion(), emit, enabled: updateEnabled, canInstall: () => !engine.running.size && !engine.starting.size && !engine.busy });
    updatePresence();
    bind('getData', () => ({ ...store.data, account: auth.public(), microsoftAccount: auth.microsoftPublic(), offlineProfile: auth.offlinePublic(), authState: auth.state(), microsoftClientId: MICROSOFT_CLIENT_ID, root: store.root, totalMemory: Math.floor(os.totalmem() / 1024 / 1024), status: engine.status(), appVersion: app.getVersion(), update: updates.state() }));
    bind('checkForUpdates', () => updates.check()); bind('downloadUpdate', () => updates.download()); bind('installUpdate', () => updates.install());
    bind('getVersions', () => engine.versions());
    bind('getLoaderVersions',async(loader,version)=>(await engine.loaders.versions(loader,version)).map(({version,stable})=>({version,stable})));
    bind('createInstance', async value => {
      await engine.versions(); if (!engine.manifest.versions.some(v => v.id === value.version)) throw new Error('Unbekannte Minecraft-Version.');
      if(value.loader!=='vanilla'){const available=await engine.loaders.versions(value.loader,value.version);const selected=value.loaderVersion?available.find(v=>v.version===value.loaderVersion):available[0];if(!selected)throw new Error('Für diese Kombination ist keine passende Loader-Version verfügbar.');value={...value,loaderVersion:selected.version};}
      const result = await store.create(value); emit('data'); return result;
    });
    bind('updateInstance', async (id, value) => { const result = await store.update(id, value); emit('data'); return result; });
    bind('changeInstanceVersion',(id,value)=>content.changeVersion(id,value));
    bind('chooseInstanceImage',async(id,kind)=>{if(!['cover','icon'].includes(kind))throw new Error('Unbekannter Bildtyp.');store.instance(id);const result=await dialog.showOpenDialog(window,{title:kind==='icon'?'Instanzsymbol auswählen':'Instanzbild auswählen',filters:[{name:'Bilder',extensions:['png','jpg','jpeg','webp']}],properties:['openFile']});if(result.canceled)return null;const file=result.filePaths[0];if((await require('node:fs/promises').stat(file)).size>10*1024*1024)throw new Error('Bitte ein Bild unter 10 MB verwenden.');const image=nativeImage.createFromPath(file);if(image.isEmpty())throw new Error('Das Bild konnte nicht gelesen werden.');const resized=image.resize({width:kind==='icon'?128:1024});const value=kind==='icon'?resized.toDataURL():'data:image/jpeg;base64,'+resized.toJPEG(85).toString('base64');await store.update(id,{[kind]:value});emit('data');return value;});
    bind('getMods',id=>content.mods(id));
    bind('getContent',id=>content.inventory(id));
    bind('toggleContent',(id,folder,file)=>content.changeContent(id,folder,file));
    bind('removeContent',(id,folder,file)=>content.changeContent(id,folder,file,true));
    bind('chooseContentFiles',async(id,type)=>{
      if(!['mod','resourcepack','shader'].includes(type))throw new Error('Unbekannter Inhaltstyp.');content.guard(id,{allowRunning:type!=='mod'});
      const result=await dialog.showOpenDialog(window,{title:'Dateien zur Instanz hinzufügen',filters:[{name:type==='mod'?'Minecraft-Mods':'Minecraft-Pakete',extensions:[type==='mod'?'jar':'zip']}],properties:['openFile','multiSelections']});
      return result.canceled?0:content.importFiles(id,type,result.filePaths);
    });
    bind('toggleMod',(id,file)=>content.toggleMod(id,file));
    bind('getModUpdates',id=>content.task(id,'Mod-Updates werden gesucht',()=>content.updates(id)));
    bind('planProject',(id,project,version)=>content.plan(id,project,version));
    bind('installProject',key=>content.installPlan(key));
    bind('projectVersions',async project=>{if(typeof project!=='string'||!/^[-\w]{1,100}$/.test(project))throw new Error('Ungültiges Projekt.');return json('https://api.modrinth.com/v2/project/'+project+'/version?include_changelog=false');});
    bind('listBackups',id=>content.backups.list(id));
    bind('createBackup',id=>content.task(id,'Spieldaten werden gesichert',signal=>content.backups.create(id,'Manuelle Sicherung',signal)));
    bind('restoreBackup',(id,key)=>content.task(id,'Sicherung wird wiederhergestellt',signal=>content.backups.restore(id,key,signal)));
    const diagnosticSecrets=()=>[auth.account?.accessToken,auth.account?.refreshToken,auth.account?.id,auth.account?.name,auth.account?.xuid,auth.offline?.name,store.root];
    bind('getDiagnostics',id=>report(store,id,diagnosticSecrets()));
    bind('exportDiagnostics',async id=>{const result=await dialog.showSaveDialog(window,{title:'Bereinigtes Spielprotokoll speichern',defaultPath:'carrotclient-diagnose.txt',filters:[{name:'Textdatei',extensions:['txt']}]});if(result.canceled)return false;await require('node:fs/promises').writeFile(result.filePath,(await report(store,id,diagnosticSecrets())).text,'utf8');return true;});
    bind('scanImports',source=>content.importer.scan(source));
    bind('chooseImportFolder',async source=>{const result=await dialog.showOpenDialog(window,{title:'Spiel- oder Profilordner auswählen',properties:['openDirectory']});return result.canceled?null:content.importer.scan(source,result.filePaths[0]);});
    bind('importProfile',value=>content.importProfile(value));
    bind('chooseModpack',async()=>{const result=await dialog.showOpenDialog(window,{title:'Modrinth-Modpack importieren',filters:[{name:'Modrinth-Modpack',extensions:['mrpack']}],properties:['openFile']});return result.canceled?null:content.inspectPack(result.filePaths[0]);});
    bind('inspectDroppedModpack',file=>{if(typeof file!=='string'||!file.toLowerCase().endsWith('.mrpack'))throw new Error('Bitte eine .mrpack-Datei auswählen.');return content.inspectPack(file);});
    bind('importModpack',value=>content.importPack(value));
    bind('importProjectPack',(project,version,options)=>content.importProjectPack(project,version,options));
    bind('prepareProjectPack',async(project,version)=>{if(!/^[-\w]{1,100}$/.test(project)||!/^[-\w]{1,100}$/.test(version))throw new Error('Ungültiges Modpack.');return content.task(null,'Modpack wird geladen',async signal=>{const v=await json('https://api.modrinth.com/v2/version/'+version,signal);if(v.project_id!==project)throw new Error('Dieses Modpack gehört nicht zum ausgewählten Projekt.');const f=v.files.find(f=>f.primary)||v.files[0];if(!f||!f.filename.endsWith('.mrpack')||!/^[a-f0-9]{40}$/i.test(f.hashes?.sha1||''))throw new Error('Kein gültiges Modpack vorhanden.');const root=path.join(store.root,'pack-cache');await require('node:fs/promises').mkdir(root,{recursive:true});const target=path.join(root,version+'.mrpack');await require('./network.cjs').download({url:f.url,sha1:f.hashes.sha1,size:f.size,maxSize:1024*1024*1024},target,signal);return content.inspectPack(target);});});
    bind('removeInstance', async id => { if (engine.running.has(id) || engine.starting.has(id) || engine.busy?.instanceId === id) throw new Error('Beende zuerst das Spiel bzw. den Download.'); await store.remove(id); emit('data'); });
    bind('install', id => engine.install(id));
    bind('launch', async id => { const result = await engine.launch(id, await auth.session()); if (store.data.settings.minimizeOnLaunch) window.minimize(); return result; });
    bind('cancelDownload', () => engine.cancel());
    bind('saveSettings', async value => { const result = await store.settings(value); updatePresence(); emit('data'); return result; });
    bind('chooseJava', async () => { const result = await dialog.showOpenDialog(window, { title: 'Java auswählen', filters: [{ name: 'Java', extensions: ['exe'] }], properties: ['openFile'] }); return result.canceled ? null : result.filePaths[0]; });
    bind('openFolder', async id => { const result = await shell.openPath(id ? store.directory(id) : store.root); if (result) throw new Error(result); });
    bind('searchProjects', async ({instanceId='',...options}={}) => {
      const params=searchParameters(options,instanceId?store.instance(instanceId):null);
      return json('https://api.modrinth.com/v2/search?' + params);
    });
    bind('openExternal', async value => { const url = new URL(value); if (url.protocol !== 'https:' || !['modrinth.com', 'www.minecraft.net', 'learn.microsoft.com', 'portal.azure.com', 'microsoft.com', 'www.microsoft.com', 'login.microsoftonline.com'].includes(url.hostname)) throw new Error('Dieser Link ist nicht freigegeben.'); await shell.openExternal(url.href); });
    bind('beginLogin', () => auth.begin()); bind('cancelLogin', () => auth.cancel()); bind('logout', () => auth.logout());
    bind('useOffline', name => auth.useOffline(name)); bind('useMicrosoft', () => auth.useMicrosoft());
    bind('windowAction', action => { if (action === 'minimize') window.minimize(); if (action === 'maximize') window.isMaximized() ? window.unmaximize() : window.maximize(); if (action === 'close') window.close(); });
    createWindow();
    updates.start();
  }).catch(e => { dialog.showErrorBox('CarrotClientLauncher', e.message); app.quit(); });
  app.on('before-quit', () => { presence?.stop(); updates?.stop(); });
  app.on('window-all-closed', () => { auth?.cancel(); engine?.cancel(); app.quit(); });
}
