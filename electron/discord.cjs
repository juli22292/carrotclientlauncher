const net = require('node:net');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { DISCORD_APPLICATION_ID, DISCORD_IMAGE_URL } = require('./config.cjs');

// Discord's documented local IPC protocol: 8-byte LE header followed by UTF-8 JSON.
// https://discord.com/developers/docs/topics/rpc#rpc-over-ipc
function frame(opcode, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(JSON.stringify(payload));
  const header = Buffer.alloc(8);
  header.writeUInt32LE(opcode, 0); header.writeUInt32LE(body.length, 4);
  return Buffer.concat([header, body]);
}
function ipcPaths() {
  const prefix = process.env.XDG_RUNTIME_DIR || process.env.TMPDIR || process.env.TMP || process.env.TEMP || '/tmp';
  return Array.from({ length: 10 }, (_, i) => process.platform === 'win32' ? `\\\\?\\pipe\\discord-ipc-${i}` : path.join(prefix, `discord-ipc-${i}`));
}

class DiscordPresence {
  constructor({ clientId = DISCORD_APPLICATION_ID, image = DISCORD_IMAGE_URL, paths = ipcPaths(), retryMs = 15000, timeoutMs = 5000, updateIntervalMs = 5000 } = {}) {
    this.clientId = clientId; this.image = image; this.paths = paths;
    this.retryMs = retryMs; this.timeoutMs = timeoutMs; this.updateIntervalMs = updateIntervalMs;
    this.enabled = false; this.socket = null; this.ready = false; this.pending = null;
    this.retryTimer = null; this.flushTimer = null; this.timeoutTimer = null;
    this.lastSent = null; this.lastSentAt = 0;
    this.update(null);
  }
  update(instance) {
    this.activity = {
      name: 'CarrotClientLauncher', type: 0,
      details: instance ? `Spielt ${require('./loader-definitions.json').find(loader=>loader.id===instance.loader)?.name||instance.loader||'Vanilla'} ${instance.version}` : 'Aktiv im Hauptmenü',
      assets: { large_image: this.image, large_text: 'CarrotClientLauncher' }
    };
    this.flush();
  }
  setEnabled(enabled) {
    if (this.enabled === enabled) return;
    this.enabled = enabled;
    if (enabled) this.connect(); else this.disconnect();
  }
  later(callback, delay) {
    const timer = setTimeout(callback, delay); timer.unref(); return timer;
  }
  clearTimers() {
    for (const key of ['retryTimer', 'flushTimer', 'timeoutTimer']) { clearTimeout(this[key]); this[key] = null; }
  }
  connect(index = 0) {
    if (!this.enabled || this.socket || !this.paths.length) return;
    let socket;
    try { socket = net.createConnection({ path: this.paths[index] }); }
    catch { this.retry(index, false); return; }
    this.socket = socket; socket.unref();
    let buffer = Buffer.alloc(0);
    this.timeoutTimer = this.later(() => socket.destroy(), this.timeoutMs);
    socket.on('connect', () => {
      if (this.socket === socket) this.write(0, { v: 1, client_id: this.clientId });
    });
    socket.on('error', () => socket.destroy());
    socket.on('close', () => {
      if (this.socket !== socket) return;
      const wasReady = this.ready;
      this.clearTimers(); this.socket = null; this.ready = false; this.pending = null; this.lastSent = null;
      this.retry(index, wasReady);
    });
    socket.on('data', chunk => {
      if (this.socket !== socket) return;
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 8 && !socket.destroyed) {
        const opcode = buffer.readUInt32LE(0), length = buffer.readUInt32LE(4);
        if (length > 1024 * 1024) { socket.destroy(); return; }
        if (buffer.length < length + 8) return;
        const body = buffer.subarray(8, length + 8); buffer = buffer.subarray(length + 8);
        if (opcode === 3) { this.write(4, body); continue; }
        if (opcode === 2) { socket.destroy(); return; }
        if (opcode !== 1) continue;
        let message;
        try { message = JSON.parse(body.toString('utf8')); }
        catch { socket.destroy(); return; }
        if (!message || typeof message !== 'object') { socket.destroy(); return; }
        if (message.evt === 'ERROR') { socket.destroy(); return; }
        if (message.cmd === 'DISPATCH' && message.evt === 'READY' && !this.ready) {
          clearTimeout(this.timeoutTimer); this.timeoutTimer = null; this.ready = true; this.flush();
        } else if (this.pending && message.cmd === 'SET_ACTIVITY' && message.nonce === this.pending.nonce) {
          clearTimeout(this.timeoutTimer); this.timeoutTimer = null;
          this.lastSent = this.pending.activity; this.pending = null; this.flush();
        }
      }
    });
  }
  retry(index, wasReady) {
    if (!this.enabled) return;
    if (!wasReady && index + 1 < this.paths.length) this.connect(index + 1);
    else this.retryTimer = this.later(() => { this.retryTimer = null; this.connect(); }, this.retryMs);
  }
  write(opcode, payload) {
    if (!this.socket || this.socket.destroyed) return false;
    try { this.socket.write(frame(opcode, payload)); return true; }
    catch { this.socket.destroy(); return false; }
  }
  flush() {
    if (!this.enabled || !this.ready || this.pending || !this.socket || this.socket.destroyed) return;
    const activity = JSON.stringify(this.activity);
    if (activity === this.lastSent) return;
    // Coalesce rapid status changes and stay below Discord's activity update limit.
    const wait = this.lastSentAt + this.updateIntervalMs - Date.now();
    if (wait > 0) {
      if (!this.flushTimer) this.flushTimer = this.later(() => { this.flushTimer = null; this.flush(); }, wait);
      return;
    }
    clearTimeout(this.flushTimer); this.flushTimer = null;
    const nonce = randomUUID(); this.pending = { nonce, activity }; this.lastSentAt = Date.now();
    if (this.write(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: this.activity }, nonce })) {
      const socket = this.socket;
      this.timeoutTimer = this.later(() => socket.destroy(), this.timeoutMs);
    }
  }
  disconnect() {
    this.clearTimers();
    const socket = this.socket, wasReady = this.ready;
    this.socket = null; this.ready = false; this.pending = null; this.lastSent = null;
    if (!socket || socket.destroyed) return;
    if (wasReady) {
      // Flush the clear before closing; process exit also clears Discord's PID-bound activity.
      try { socket.end(frame(1, { cmd: 'SET_ACTIVITY', args: { pid: process.pid, activity: null }, nonce: randomUUID() })); socket.destroySoon(); }
      catch { socket.destroy(); }
    } else socket.destroy();
  }
  stop() { this.setEnabled(false); }
}

function syncPresence(presence, engine, store, disabled = false) {
  if (!presence || !engine || !store) return;
  const id = [...engine.running.keys()].at(-1);
  presence.update(store.data.instances.find(instance => instance.id === id) || null);
  presence.setEnabled(!disabled && store.data.settings.discordRichPresence);
}
module.exports = { DiscordPresence, syncPresence };
