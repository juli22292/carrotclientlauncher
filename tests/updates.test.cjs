const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { setTimeout: delay } = require('node:timers/promises');
const { Updates, UPDATE_INTERVAL_MS, UPDATE_SOURCE } = require('../electron/updates.cjs');

class Client extends EventEmitter {
  checks = 0; downloads = 0; installations = [];
  setFeedURL(value) { this.feed = value; }
  async checkForUpdates() { this.checks++; this.emit('checking-for-update'); this.emit('update-available', { version: '0.0.2' }); }
  async downloadUpdate() { this.downloads++; this.emit('download-progress', { percent: 50, transferred: 500, total: 1000 }); this.emit('update-downloaded', { version: '0.0.2' }); return ['setup.exe']; }
  quitAndInstall(...args) { this.installations.push(args); }
}
function fixture(t, options = {}) {
  const client = new Client(), events = [];
  const service = new Updates({ client, version: '0.0.1', emit: (name, state) => events.push({ name, state }), ...options });
  t.after(() => service.stop()); return { client, service, events };
}
test('checks the public GitHub repository every minute and never downloads or installs automatically', async t => {
  const f = fixture(t, { intervalMs: 15 });
  assert.equal(UPDATE_INTERVAL_MS, 60000); assert.deepEqual(f.client.feed, UPDATE_SOURCE);
  assert.equal(f.client.autoDownload, false); assert.equal(f.client.autoInstallOnAppQuit, false);
  assert.equal(f.client.allowDowngrade, false); assert.equal(f.client.allowPrerelease, false);
  f.service.start(); f.service.start(); await delay(45); f.service.stop();
  assert.ok(f.client.checks >= 2); assert.equal(f.client.downloads, 0); assert.deepEqual(f.client.installations, []);
  const count = f.client.checks; await delay(30); assert.equal(f.client.checks, count);
});
test('checking, downloading and installing are separate explicit actions', async t => {
  const f = fixture(t);
  await assert.rejects(f.service.download(), /zuerst/); assert.throws(() => f.service.install(), /vollständig/);
  await f.service.check(); assert.equal(f.service.state().status, 'available'); assert.equal(f.client.downloads, 0);
  await f.service.download(); assert.equal(f.service.state().status, 'downloaded'); assert.deepEqual(f.client.installations, []);
  assert.ok(f.events.some(e => e.state.status === 'downloading' && e.state.progress === 50));
  await f.service.check(); assert.equal(f.service.state().status, 'downloaded');
  f.service.install(); assert.deepEqual(f.client.installations, [[false, true]]); assert.equal(f.service.state().status, 'installing');
});
test('concurrent requests share the same check and download operations', async t => {
  const f = fixture(t);
  f.client.checkForUpdates = async () => { f.client.checks++; f.client.emit('checking-for-update'); await delay(20); f.client.emit('update-available', {version:'0.0.2'}); };
  f.client.downloadUpdate = async () => { f.client.downloads++; await delay(20); f.client.emit('update-downloaded', {version:'0.0.2'}); };
  const check = f.service.check();
  await Promise.all([check, f.service.check(), f.service.download(), f.service.download()]);
  assert.equal(f.client.checks, 1); assert.equal(f.client.downloads, 1); assert.equal(f.service.state().status, 'downloaded');
});
test('game and install jobs block installation without discarding the downloaded update', async t => {
  let busy = true; const f = fixture(t, { canInstall: () => !busy });
  await f.service.check(); await f.service.download();
  assert.throws(() => f.service.install(), /Beende zuerst/); assert.equal(f.service.state().status, 'downloaded'); assert.equal(f.client.installations.length, 0);
  busy = false; f.service.install(); assert.equal(f.client.installations.length, 1);
});
test('network errors and failed downloads remain recoverable and never install anything', async t => {
  const f = fixture(t);
  f.client.checkForUpdates = async () => { throw new Error('network down'); };
  await f.service.check(); assert.equal(f.service.state().status, 'error');
  f.client.checkForUpdates = Client.prototype.checkForUpdates.bind(f.client); await f.service.check();
  f.client.downloadUpdate = async () => { throw new Error('bad sha512'); };
  await f.service.download(); assert.equal(f.service.state().status, 'error'); assert.equal(f.service.state().version, '0.0.2');
  f.client.downloadUpdate = Client.prototype.downloadUpdate.bind(f.client); await f.service.download();
  assert.equal(f.service.state().status, 'downloaded'); assert.equal(f.client.installations.length, 0);
});
test('disabled development and UI tests do not contact GitHub or run an installer', async t => {
  const f = fixture(t, { enabled: false }); f.service.start(); await f.service.check();
  assert.equal(f.service.state().status, 'disabled'); assert.equal(f.client.checks, 0);
  await assert.rejects(f.service.download(), /deaktiviert/); assert.throws(() => f.service.install(), /vollständig/);
});
test('no-update response displays the checked current version and installer launch failure can be retried', async t => {
  const f = fixture(t);
  f.client.checkForUpdates = async () => f.client.emit('update-not-available', { version:'0.0.1' });
  await f.service.check(); assert.equal(f.service.state().status, 'current'); assert.equal(f.service.state().version, null);
  f.client.checkForUpdates = Client.prototype.checkForUpdates.bind(f.client); await f.service.check(); await f.service.download();
  f.client.quitAndInstall = () => { throw new Error('start failed'); };
  assert.throws(() => f.service.install(), /Installer/); assert.equal(f.service.state().status, 'downloaded');
});
