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
const { json } = require('./network.cjs');
protocol.registerSchemesAsPrivileged([{ scheme: 'carrot', privileges: { standard: true, secure: true, supportFetchAPI: true } }]);
app.setName('CarrotClientLauncher');
app.setAppUserModelId('de.carrotclient.launcher');
if (process.env.CARROT_DATA_DIR) {
  const directory = path.resolve(process.env.CARROT_DATA_DIR);
  require('node:fs').mkdirSync(directory, { recursive: true }); app.setPath('userData', directory);
}
let window, store, engine, auth, presence, updates;
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
    engine = new Engine(store, emit); auth = new Auth(store, emit); await auth.init();
    const updateEnabled = app.isPackaged && process.platform === 'win32' && process.env.CARROT_DISABLE_UPDATES !== '1';
    updates = new Updates({ client: updateEnabled ? require('electron-updater').autoUpdater : null, version: app.getVersion(), emit, enabled: updateEnabled, canInstall: () => !engine.running.size && !engine.busy });
    updatePresence();
    bind('getData', () => ({ ...store.data, account: auth.public(), microsoftAccount: auth.microsoftPublic(), offlineProfile: auth.offlinePublic(), authState: auth.state(), microsoftClientId: MICROSOFT_CLIENT_ID, root: store.root, totalMemory: Math.floor(os.totalmem() / 1024 / 1024), status: engine.status(), appVersion: app.getVersion(), update: updates.state() }));
    bind('checkForUpdates', () => updates.check()); bind('downloadUpdate', () => updates.download()); bind('installUpdate', () => updates.install());
    bind('getVersions', () => engine.versions());
    bind('createInstance', async value => { await engine.versions(); if (!engine.manifest.versions.some(v => v.id === value.version)) throw new Error('Unbekannte Minecraft-Version.'); const result = await store.create(value); emit('data'); return result; });
    bind('updateInstance', async (id, value) => { const result = await store.update(id, value); emit('data'); return result; });
    bind('removeInstance', async id => { if (engine.running.has(id) || engine.busy?.instanceId === id) throw new Error('Beende zuerst das Spiel bzw. den Download.'); await store.remove(id); emit('data'); });
    bind('install', id => engine.install(id));
    bind('launch', async id => { const result = await engine.launch(id, await auth.session()); if (store.data.settings.minimizeOnLaunch) window.minimize(); return result; });
    bind('cancelDownload', () => engine.cancel());
    bind('saveSettings', async value => { const result = await store.settings(value); updatePresence(); emit('data'); return result; });
    bind('chooseJava', async () => { const result = await dialog.showOpenDialog(window, { title: 'Java auswählen', filters: [{ name: 'Java', extensions: ['exe'] }], properties: ['openFile'] }); return result.canceled ? null : result.filePaths[0]; });
    bind('openFolder', async id => { const result = await shell.openPath(id ? store.directory(id) : store.root); if (result) throw new Error(result); });
    bind('searchProjects', async ({ query = '', type = 'mod', offset = 0 } = {}) => {
      if (!['mod', 'modpack', 'shader', 'resourcepack'].includes(type) || typeof query !== 'string' || query.length > 200) throw new Error('Ungültige Suche.');
      const params = new URLSearchParams({ query, facets: JSON.stringify([[`project_type:${type}`]]), index: 'downloads', limit: '12', offset: String(Math.max(0, Math.min(1000, Number(offset) || 0))) });
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
