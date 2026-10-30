const { contextBridge, ipcRenderer } = require('electron');
const methods = ['getData', 'getVersions', 'createInstance', 'updateInstance', 'removeInstance', 'install', 'launch', 'cancelDownload', 'saveSettings', 'chooseJava', 'openFolder', 'searchProjects', 'openExternal', 'beginLogin', 'cancelLogin', 'logout', 'useOffline', 'useMicrosoft', 'checkForUpdates', 'downloadUpdate', 'installUpdate', 'windowAction'];
const api = Object.fromEntries(methods.map(name => [name, (...args) => ipcRenderer.invoke('carrot:' + name, ...args)]));
api.on = (event, callback) => {
  if (!['data', 'status', 'auth', 'game-error', 'update'].includes(event)) return () => {};
  const listener = (_, value) => callback(value); ipcRenderer.on('carrot:' + event, listener);
  return () => ipcRenderer.removeListener('carrot:' + event, listener);
};
contextBridge.exposeInMainWorld('carrot', api);
