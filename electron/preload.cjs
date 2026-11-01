const { contextBridge, ipcRenderer, webUtils } = require('electron');
const methods = ['getData', 'getVersions', 'createInstance', 'updateInstance', 'removeInstance', 'install', 'launch', 'cancelDownload', 'saveSettings', 'chooseJava', 'openFolder', 'searchProjects', 'openExternal', 'beginLogin', 'cancelLogin', 'logout', 'useOffline', 'useMicrosoft', 'checkForUpdates', 'downloadUpdate', 'installUpdate', 'windowAction'];
const api = Object.fromEntries(methods.map(name => [name, (...args) => ipcRenderer.invoke('carrot:' + name, ...args)]));
api.getLoaderVersions=(...args)=>ipcRenderer.invoke('carrot:getLoaderVersions',...args);
api.importProjectPack=(...args)=>ipcRenderer.invoke('carrot:importProjectPack',...args);
for(const name of ['getContent','toggleContent','removeContent','chooseContentFiles'])api[name]=(...args)=>ipcRenderer.invoke('carrot:'+name,...args);
for(const name of ['changeInstanceVersion','chooseInstanceImage','getMods','toggleMod','getModUpdates','planProject','installProject','projectVersions','listBackups','createBackup','restoreBackup','getDiagnostics','exportDiagnostics','scanImports','chooseImportFolder','importProfile','chooseModpack','importModpack','prepareProjectPack'])api[name]=(...args)=>ipcRenderer.invoke('carrot:'+name,...args);
api.inspectDroppedModpack=file=>ipcRenderer.invoke('carrot:inspectDroppedModpack',webUtils.getPathForFile(file));
api.on = (event, callback) => {
  if (!['data', 'status', 'auth', 'game-error', 'update'].includes(event)) return () => {};
  const listener = (_, value) => callback(value); ipcRenderer.on('carrot:' + event, listener);
  return () => ipcRenderer.removeListener('carrot:' + event, listener);
};
contextBridge.exposeInMainWorld('carrot', api);
