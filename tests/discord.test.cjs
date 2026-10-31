const test = require('node:test');
const assert = require('node:assert/strict');
const net = require('node:net');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { setTimeout: delay } = require('node:timers/promises');
const { DiscordPresence, syncPresence } = require('../electron/discord.cjs');
const { Store } = require('../electron/store.cjs');
const { Engine } = require('../electron/engine.cjs');
const { DISCORD_APPLICATION_ID, MICROSOFT_CLIENT_ID } = require('../electron/config.cjs');

function packet(opcode, data) {
  const body = Buffer.from(JSON.stringify(data)), bytes = Buffer.alloc(8 + body.length);
  bytes.writeUInt32LE(opcode); bytes.writeUInt32LE(body.length, 4); body.copy(bytes, 8); return bytes;
}
async function until(check) {
  const deadline = Date.now() + 3000;
  while (Date.now() < deadline) { if (check()) return; await delay(10); }
  assert.fail('Timed out waiting for the expected Discord activity.');
}
async function fixture(t, options = {}) {
  const pipe = process.platform === 'win32' ? `\\\\?\\pipe\\carrot-discord-test-${randomUUID()}` : path.join(os.tmpdir(), `carrot-discord-${randomUUID()}`);
  const connections = new Set(), messages = [], handshakes = [], pongs = [];
  let acknowledge = true;
  const server = net.createServer(socket => {
    connections.add(socket); socket.on('close', () => connections.delete(socket)); socket.on('error', () => {});
    let buffer = Buffer.alloc(0);
    socket.on('data', chunk => {
      buffer = Buffer.concat([buffer, chunk]);
      while (buffer.length >= 8) {
        const opcode = buffer.readUInt32LE(), length = buffer.readUInt32LE(4);
        if (buffer.length < length + 8) return;
        const data = JSON.parse(buffer.subarray(8, length + 8).toString()); buffer = buffer.subarray(length + 8);
        if (opcode === 0) {
          handshakes.push(data);
          // READY arrives with a fragmented header, just as an OS stream may deliver it.
          const ready = packet(1, { cmd: 'DISPATCH', evt: 'READY', data: {} });
          socket.write(ready.subarray(0, 5)); setImmediate(() => { if (!socket.destroyed) socket.write(ready.subarray(5)); });
        } else if (opcode === 4) pongs.push(data);
        else if (opcode === 1) {
          messages.push(data);
          if (acknowledge && !socket.destroyed) socket.write(packet(1, { cmd: data.cmd, nonce: data.nonce, data: data.args?.activity }));
        }
      }
    });
  });
  const listen = () => new Promise((resolve, reject) => { server.once('error', reject); server.listen(pipe, () => { server.removeListener('error', reject); resolve(); }); });
  if (!options.late) await listen();
  const presence = new DiscordPresence({ paths: [pipe], retryMs: 20, timeoutMs: 300, updateIntervalMs: 5, ...options });
  t.after(async () => {
    presence.stop();
    for (const socket of connections) socket.destroy();
    if (server.listening) await new Promise(resolve => server.close(resolve));
  });
  return { presence, connections, messages, handshakes, pongs, listen, setAcknowledge: value => { acknowledge = value; }, activities: () => messages.filter(m => m.args?.activity).map(m => m.args.activity) };
}

test('Discord IPC sends the own app ID, menu activity and icon, handles ping and clears on disable', async t => {
  const f = await fixture(t); f.presence.setEnabled(true);
  await until(() => f.activities().length === 1);
  assert.deepEqual(f.handshakes, [{ v: 1, client_id: '1565491737235947671' }]);
  assert.equal(DISCORD_APPLICATION_ID, f.handshakes[0].client_id);
  assert.equal(f.messages[0].args.pid, process.pid);
  assert.equal(f.activities()[0].name, 'CarrotClientLauncher');
  assert.equal(f.activities()[0].type, 0);
  assert.equal(f.activities()[0].details, 'Aktiv im Hauptmenü');
  assert.match(f.activities()[0].assets.large_image, /^https:\/\/cdn\.discordapp\.com\/app-icons\/1565491737235947671\//);
  const socket = [...f.connections][0];
  socket.write(Buffer.concat([packet(3, { ping: 'keep-alive' }), packet(1, { cmd: 'UNRELATED', evt: 'IGNORED' })]));
  await until(() => f.pongs.length === 1); assert.deepEqual(f.pongs[0], { ping: 'keep-alive' });
  f.presence.setEnabled(false);
  await until(() => f.messages.some(m => m.args?.activity === null));
  const count = f.handshakes.length; await delay(50); assert.equal(f.handshakes.length, count);
  f.presence.setEnabled(true); await until(() => f.activities().length === 2);
});

test('Discord may start later or restart: reconnect restores only the latest activity', async t => {
  const f = await fixture(t, { late: true }); f.presence.setEnabled(true);
  f.presence.update({ version: '1.21.1' }); await delay(30);
  assert.equal(f.activities().length, 0);
  await f.listen(); await until(() => f.activities().length === 1);
  assert.equal(f.activities()[0].details, 'Spielt Vanilla 1.21.1');
  for (const socket of f.connections) socket.destroy();
  await until(() => !f.presence.ready);
  f.presence.update({ version: '25w14craftmine' });
  await until(() => f.handshakes.length === 2 && f.activities().length === 2);
  assert.equal(f.activities()[1].details, 'Spielt Vanilla 25w14craftmine');
});

test('rapid updates are coalesced and unchanged status events do not flood Discord', async t => {
  const f = await fixture(t, { updateIntervalMs: 100 }); f.presence.setEnabled(true);
  await until(() => f.activities().length === 1);
  for (let i = 0; i < 20; i++) f.presence.update({ version: `1.21.${i}` });
  f.presence.update(null);
  await delay(130); assert.equal(f.activities().length, 1);
  f.presence.update({ version: '1.21.1' });
  await until(() => f.activities().length === 2);
  assert.equal(f.activities()[1].details, 'Spielt Vanilla 1.21.1');
  for (let i = 0; i < 20; i++) f.presence.update({ version: '1.21.1' });
  await delay(130); assert.equal(f.activities().length, 2);
});

test('Discord errors, malformed packets and unanswered commands recover without uncaught failures', async t => {
  const f = await fixture(t, { timeoutMs: 60 }); f.presence.setEnabled(true);
  await until(() => f.activities().length === 1);
  [...f.connections][0].write(packet(1, { evt: 'ERROR', data: { message: 'temporarily unavailable' } }));
  await until(() => f.activities().length === 2);
  const invalid = Buffer.alloc(9); invalid.writeUInt32LE(1); invalid.writeUInt32LE(1, 4); invalid[8] = 0x7b;
  [...f.connections][0].write(invalid);
  await until(() => f.activities().length === 3);
  f.setAcknowledge(false); f.presence.update({ version: '1.20.6' });
  await until(() => f.activities().length >= 4);
  const count = f.handshakes.length; f.setAcknowledge(true);
  await until(() => f.handshakes.length > count);
  assert.equal(f.activities().at(-1).details, 'Spielt Vanilla 1.20.6');
});

test('actual engine lifecycle switches versions, handles parallel instances and returns to menu after exit or crash', async t => {
  const f = await fixture(t);
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'carrot-presence-'));
  const store = await new Store(root).init(); const children = [];
  t.after(async () => {
    for (const child of children) child.emit('exit', 0);
    await store.pending;
    assert.equal(path.dirname(root), os.tmpdir()); assert.ok(path.basename(root).startsWith('carrot-presence-'));
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const events = [];
  let engine;
  engine = new Engine(store, (event, value) => { events.push({ event, value }); if (event === 'status') syncPresence(f.presence, engine, store); }, {
    spawnProcess: () => {
      const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
      children.push(child); setImmediate(() => child.emit('spawn')); return child;
    }
  });
  syncPresence(f.presence, engine, store); await until(() => f.activities().length === 1);
  const account = { id: '123456789012345678901234567890ab', name: 'TestPlayer', accessToken: 'test-access', expires: Date.now() + 3600000, ownsGame: true, clientId: MICROSOFT_CLIENT_ID };
  async function installed(version, loader) {
    const instance = await store.create({ name: 'Private instance name', version, loader }); instance.installed = true;
    await fs.writeFile(path.join(store.directory(instance.id), 'profile.json'), JSON.stringify({ java: 'unused.exe', baseVersion: version, profile: { id: loader === 'fabric' ? `fabric-loader-0.18.0-${version}` : version, libraries: [], arguments: { jvm: [], game: [] }, mainClass: 'test.Main', assetIndex: { id: 'test' }, type: 'release' } }));
    return instance;
  }
  const first = await installed('1.21.1', 'fabric'), second = await installed('1.21.1', 'vanilla');
  // Creating, selecting or downloading an instance does not publish a playing activity.
  engine.emit('status', engine.status()); await delay(20); assert.equal(f.activities().length, 1);
  await engine.launch(first.id, account); await until(() => f.activities().at(-1).details === 'Spielt Fabric 1.21.1');
  assert.equal(JSON.stringify(f.activities()).includes('Private instance name'), false);
  await engine.launch(second.id, account); await until(() => f.activities().at(-1).details === 'Spielt Vanilla 1.21.1');
  children[1].emit('exit', 1); await until(() => f.activities().at(-1).details === 'Spielt Fabric 1.21.1');
  assert.ok(events.some(e => e.event === 'game-error'));
  children[0].emit('exit', 0); await until(() => f.activities().at(-1).details === 'Aktiv im Hauptmenü');
  await store.settings({ discordRichPresence: false }); syncPresence(f.presence, engine, store);
  await until(() => f.messages.some(m => m.args?.activity === null));
  const reloaded = await new Store(root).init(); assert.equal(reloaded.data.settings.discordRichPresence, false);
});

test('spawn failure and an immediate game exit cannot leave a stale playing status', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'carrot-presence-'));
  const store = await new Store(root).init();
  t.after(async () => {
    await store.pending;
    assert.equal(path.dirname(root), os.tmpdir()); assert.ok(path.basename(root).startsWith('carrot-presence-'));
    await fs.rm(root, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 });
  });
  const i = await store.create({ name: 'Short-lived', version: '1.21.1', loader: 'vanilla' }); i.installed = true;
  await fs.writeFile(path.join(store.directory(i.id), 'profile.json'), JSON.stringify({ java: 'unused.exe', baseVersion: i.version, profile: { id: i.version, libraries: [], arguments: { jvm: [], game: [] }, mainClass: 'test.Main', assetIndex: { id: 'test' }, type: 'release' } }));
  const account = { id: '123456789012345678901234567890ab', name: 'TestPlayer', accessToken: 'test-access', expires: Date.now() + 3600000, ownsGame: true, clientId: MICROSOFT_CLIENT_ID };
  let fail = true;
  const statuses = [];
  const engine = new Engine(store, (event, value) => { if (event === 'status') statuses.push(value.running); }, { spawnProcess: () => {
    const child = new EventEmitter(); child.stdout = new PassThrough(); child.stderr = new PassThrough();
    setImmediate(() => { if (fail) child.emit('error', new Error('Java missing')); else { child.emit('spawn'); setImmediate(() => child.emit('exit', 1)); } });
    return child;
  } });
  await assert.rejects(engine.launch(i.id, account), /Java missing/);
  assert.equal(engine.running.size, 0); assert.ok(statuses.every(running=>running.length===0));
  statuses.length=0;
  fail = false;
  const originalSave = store.save.bind(store);
  store.save = async () => { await delay(30); return originalSave(); };
  await engine.launch(i.id, account);
  await until(() => statuses.some(running=>running.includes(i.id)) && statuses.at(-1)?.length===0 && engine.running.size===0);
  assert.deepEqual(statuses.find(running=>running.length), [i.id]); assert.deepEqual(statuses.at(-1), []); assert.equal(engine.running.size, 0);
});
