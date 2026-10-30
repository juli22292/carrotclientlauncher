const UPDATE_INTERVAL_MS = 60_000;
const UPDATE_SOURCE = { provider: 'github', owner: 'juli22292', repo: 'carrotclientlauncher', private: false };

class Updates {
  constructor({ client, version, emit, enabled = true, canInstall = () => true, intervalMs = UPDATE_INTERVAL_MS }) {
    this.client = client; this.emit = emit; this.canInstall = canInstall; this.intervalMs = intervalMs;
    this.timer = null; this.checking = null; this.downloading = null;
    this.value = { enabled, status: enabled ? 'idle' : 'disabled', currentVersion: version, version: null, progress: 0, transferred: 0, total: 0, lastChecked: null, error: '' };
    if (!enabled) return;
    client.autoDownload = false;
    client.autoInstallOnAppQuit = false;
    client.autoRunAppAfterInstall = true;
    client.allowDowngrade = false;
    client.allowPrerelease = false;
    client.setFeedURL(UPDATE_SOURCE);
    client.on('checking-for-update', () => this.change({ status: 'checking', error: '' }));
    client.on('update-available', info => this.change({ status: 'available', version: info.version, progress: 0, lastChecked: Date.now(), error: '' }));
    client.on('update-not-available', () => this.change({ status: 'current', version: null, lastChecked: Date.now(), error: '' }));
    client.on('download-progress', progress => this.change({ status: 'downloading', progress: Math.max(0, Math.min(100, progress.percent || 0)), transferred: progress.transferred || 0, total: progress.total || 0 }));
    client.on('update-downloaded', info => this.change({ status: 'downloaded', version: info.version, progress: 100, error: '' }));
    client.on('error', () => this.change({ status: 'error', error: 'Das Update konnte nicht geprüft oder geladen werden. Prüfe deine Internetverbindung und versuche es erneut.' }));
  }
  state() { return { ...this.value }; }
  change(value) { Object.assign(this.value, value); this.emit('update', this.state()); }
  start() {
    if (!this.value.enabled || this.timer) return;
    this.check().catch(() => {});
    this.timer = setInterval(() => this.check().catch(() => {}), this.intervalMs);
    this.timer.unref();
  }
  stop() { clearInterval(this.timer); this.timer = null; }
  async check() {
    if (!this.value.enabled) return this.state();
    if (this.downloading || ['downloaded', 'installing'].includes(this.value.status)) return this.state();
    if (this.checking) return this.checking;
    const operation = (async () => {
      try { await this.client.checkForUpdates(); }
      catch {
        this.change({ status: 'error', lastChecked: Date.now(), error: 'GitHub ist gerade nicht erreichbar oder es wurde noch kein Release veröffentlicht. Versuche es später erneut.' });
      }
      return this.state();
    })();
    this.checking = operation;
    try { return await operation; } finally { if (this.checking === operation) this.checking = null; }
  }
  async download() {
    if (!this.value.enabled) throw new Error('Updates sind in diesem Test- oder Entwicklungsmodus deaktiviert.');
    if (this.downloading) return this.downloading;
    if (this.checking) await this.checking;
    if (this.downloading) return this.downloading;
    if (this.value.status === 'downloaded') return this.state();
    if (!this.value.version || !['available', 'error'].includes(this.value.status)) throw new Error('Prüfe zuerst, ob eine neue Version verfügbar ist.');
    this.change({ status: 'downloading', progress: 0, transferred: 0, total: 0, error: '' });
    const operation = (async () => {
      try { await this.client.downloadUpdate(); }
      catch {
        this.change({ status: 'error', error: 'Der Update-Download ist fehlgeschlagen. Du kannst den Download erneut starten.' });
      }
      return this.state();
    })();
    this.downloading = operation;
    try { return await operation; } finally { if (this.downloading === operation) this.downloading = null; }
  }
  install() {
    if (!this.value.enabled || this.value.status !== 'downloaded') throw new Error('Lade das Update zuerst vollständig herunter.');
    if (!this.canInstall()) throw new Error('Beende zuerst Minecraft und laufende Downloads, bevor du das Launcher-Update installierst.');
    this.change({ status: 'installing', error: '' });
    try { this.client.quitAndInstall(false, true); }
    catch (error) { this.change({ status: 'downloaded', error: 'Der Installer konnte nicht gestartet werden. Versuche es erneut.' }); throw new Error(this.value.error); }
    return this.state();
  }
}
module.exports = { Updates, UPDATE_INTERVAL_MS, UPDATE_SOURCE };
