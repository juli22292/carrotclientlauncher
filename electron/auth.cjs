const fs = require('node:fs/promises');
const path = require('node:path');
const { createHash } = require('node:crypto');
const { MICROSOFT_CLIENT_ID } = require('./config.cjs');
const SCOPE = 'XboxLive.signin offline_access';
const OAUTH = 'https://login.microsoftonline.com/consumers/oauth2/v2.0/';
const MINECRAFT = 'https://api.minecraftservices.com';

class AuthError extends Error {
  constructor(code, message) { super(message); this.code = code; }
}
function oauthError(data) {
  const codes = data.error_codes || [];
  if (codes.includes(7000218)) return new AuthError('PUBLIC_CLIENT_REQUIRED', 'Aktiviere in der Microsoft-App unter Authentifizierung die Option „Öffentliche Clientflows zulassen“.');
  if (codes.includes(700016)) return new AuthError('APP_NOT_FOUND', 'Microsoft findet die registrierte Launcher-App nicht. Prüfe die Anwendungs-ID im Entra-Portal.');
  if (data.error === 'expired_token') return new AuthError('CODE_EXPIRED', 'Der Anmeldecode ist abgelaufen. Starte die Anmeldung erneut.');
  if (['authorization_declined', 'access_denied'].includes(data.error)) return new AuthError('ACCESS_DENIED', 'Die Microsoft-Anmeldung wurde abgelehnt. Du kannst es erneut versuchen.');
  if (data.error === 'invalid_grant') return new AuthError('SESSION_EXPIRED', 'Deine Microsoft-Anmeldung ist abgelaufen. Bitte melde dich erneut an.');
  if (['invalid_client', 'unauthorized_client'].includes(data.error)) return new AuthError('APP_CONFIGURATION', 'Microsoft hat die Launcher-App abgelehnt. Prüfe persönliche Microsoft-Konten und öffentliche Clientflows in der App-Registrierung.');
  return new AuthError('MICROSOFT_LOGIN_FAILED', 'Die Microsoft-Anmeldung ist fehlgeschlagen. Prüfe die Verbindung und versuche es erneut.');
}
function requireAccount(account) {
  if (!account || !/^[a-f0-9]{32}$/i.test(account.id || '') || !/^[A-Za-z0-9_]{3,16}$/.test(account.name || '') || typeof account.accessToken !== 'string' || account.accessToken.length < 1 || account.accessToken === '0' || account.ownsGame !== true || account.clientId !== MICROSOFT_CLIENT_ID || !Number.isFinite(account.expires) || account.expires <= Date.now()) {
    throw new AuthError('LOGIN_REQUIRED', 'Bitte melde dich zuerst mit einem Microsoft-Konto mit Minecraft: Java Edition an.');
  }
  return account;
}
function offlineSession(name) {
  if (typeof name !== 'string' || !/^[A-Za-z0-9_]{3,16}$/.test(name.trim())) throw new AuthError('INVALID_OFFLINE_NAME', 'Nutze 3 bis 16 Zeichen: Buchstaben, Zahlen oder Unterstriche.');
  name = name.trim();
  // Java's UUID.nameUUIDFromBytes for the standard OfflinePlayer namespace.
  const bytes = createHash('md5').update('OfflinePlayer:' + name, 'utf8').digest();
  bytes[6] = (bytes[6] & 0x0f) | 0x30; bytes[8] = (bytes[8] & 0x3f) | 0x80;
  return { type: 'offline', name, id: bytes.toString('hex'), accessToken: '0' };
}
function requireSession(account) {
  if (account?.type !== 'offline') return requireAccount(account);
  const session = offlineSession(account.name);
  if (account.id !== session.id || account.accessToken !== '0') throw new AuthError('INVALID_OFFLINE_PROFILE', 'Das Offline-Profil ist ungültig. Wähle deinen Spielernamen erneut.');
  return session;
}
class Auth {
  constructor(store, emit, services = {}) {
    this.store = store; this.emit = emit; this.file = path.join(store.root, 'account.bin');
    this.storage = services.storage || require('electron').safeStorage;
    this.fetch = services.fetch || ((...args) => global.fetch(...args));
    this.delay = services.delay || require('node:timers/promises').setTimeout;
    this.now = services.now || Date.now;
    this.account = null; this.offline = null; this.offlineActive = false; this.offlineFile = path.join(store.root, 'offline-profile.json');
    this.pending = null; this.refreshing = null; this.revision = 0;
    this.writes = Promise.resolve(); this.loginState = { state: 'idle' };
  }
  async init() {
    try {
      const saved = JSON.parse(await fs.readFile(this.offlineFile, 'utf8'));
      this.offline = offlineSession(saved.name); this.offlineActive = saved.active === true;
    } catch {}
    try {
      if (!this.storage.isEncryptionAvailable()) return;
      const saved = JSON.parse(this.storage.decryptString(await fs.readFile(this.file)));
      if (saved.clientId === MICROSOFT_CLIENT_ID && saved.ownsGame === true && typeof saved.refreshToken === 'string' && saved.refreshToken && /^[a-f0-9]{32}$/i.test(saved.id || '') && /^[A-Za-z0-9_]{3,16}$/.test(saved.name || '') && typeof saved.accessToken === 'string' && saved.accessToken && saved.accessToken !== '0' && Number.isFinite(saved.expires)) this.account = saved;
    } catch {}
  }
  microsoftPublic() { return this.account ? { name: this.account.name, id: this.account.id } : null; }
  offlinePublic() { return this.offline ? { name: this.offline.name, id: this.offline.id, type: 'offline' } : null; }
  public() { return this.offlineActive ? this.offlinePublic() : this.microsoftPublic(); }
  persistOffline(profile, active = false) {
    const value = profile ? JSON.stringify({ name: profile.name, active }) : null;
    const next = this.writes.catch(() => {}).then(async () => {
      if (!value) { await fs.rm(this.offlineFile, { force: true }); await fs.rm(this.offlineFile + '.tmp', { force: true }); return; }
      await fs.writeFile(this.offlineFile + '.tmp', value); await fs.rename(this.offlineFile + '.tmp', this.offlineFile);
    });
    this.writes = next; return next;
  }
  async useOffline(name) {
    const profile = offlineSession(name);
    this.cancel(); const revision = ++this.revision; this.refreshing?.controller.abort();
    await this.persistOffline(profile, true);
    if (revision !== this.revision) throw new AuthError('CANCELLED', 'Profilwechsel abgebrochen.');
    this.offline = profile; this.offlineActive = true;
    this.stateChanged({ state: 'connected', account: this.public() }); this.emit('data');
    return this.public();
  }
  async useMicrosoft() {
    this.cancel(); const revision = ++this.revision; this.refreshing?.controller.abort();
    await this.persistOffline(this.offline, false);
    if (revision !== this.revision) throw new AuthError('CANCELLED', 'Profilwechsel abgebrochen.');
    this.offlineActive = false;
    this.stateChanged({ state: 'idle' }); this.emit('data');
    return this.public();
  }
  state() { return this.loginState; }
  stateChanged(value) { this.loginState = value; this.emit('auth', value); }
  persist(account) {
    const value = account ? JSON.stringify(account) : null;
    const next = this.writes.catch(() => {}).then(async () => {
      if (!value) { await fs.rm(this.file, { force: true }); await fs.rm(this.file + '.tmp', { force: true }); return; }
      if (!this.storage.isEncryptionAvailable()) throw new AuthError('STORAGE_UNAVAILABLE', 'Windows kann die Anmeldung gerade nicht sicher speichern. Bitte versuche es nach einem Windows-Neustart erneut.');
      await fs.writeFile(this.file + '.tmp', this.storage.encryptString(value));
      await fs.rename(this.file + '.tmp', this.file);
    });
    this.writes = next; return next;
  }
  async request(url, { body, form = false, accessToken, signal } = {}) {
    let response;
    try {
      response = await this.fetch(url, {
        method: body ? 'POST' : 'GET',
        headers: { Accept: 'application/json', ...(body ? { 'Content-Type': form ? 'application/x-www-form-urlencoded' : 'application/json' } : {}), ...(accessToken ? { Authorization: 'Bearer ' + accessToken } : {}) },
        ...(body ? { body: form ? new URLSearchParams(body) : JSON.stringify(body) } : {}),
        redirect: 'error', signal: AbortSignal.any([AbortSignal.timeout(30000), ...(signal ? [signal] : [])])
      });
    } catch (error) {
      if (signal?.aborted) throw error;
      throw new AuthError('NETWORK_ERROR', 'Die Anmeldedienste sind gerade nicht erreichbar. Prüfe deine Internetverbindung und versuche es erneut.');
    }
    let data; try { data = await response.json(); } catch { data = {}; }
    if (!data || typeof data !== 'object' || Array.isArray(data)) data = {};
    return { ok: response.ok, status: response.status, data };
  }
  async begin() {
    if (this.pending) throw new AuthError('LOGIN_IN_PROGRESS', 'Eine Anmeldung läuft bereits.');
    if (this.offlineActive) await this.useMicrosoft();
    if (!this.storage.isEncryptionAvailable()) throw new AuthError('STORAGE_UNAVAILABLE', 'Windows kann die Anmeldung gerade nicht sicher speichern.');
    const controller = new AbortController(), revision = ++this.revision;
    this.pending = controller; this.stateChanged({ state: 'starting' });
    try {
      const { ok, data } = await this.request(OAUTH + 'devicecode', { body: { client_id: MICROSOFT_CLIENT_ID, scope: SCOPE }, form: true, signal: controller.signal });
      controller.signal.throwIfAborted();
      if (!ok) throw oauthError(data);
      const url = new URL(data.verification_uri);
      if (url.protocol !== 'https:' || !['www.microsoft.com', 'microsoft.com', 'login.microsoftonline.com'].includes(url.hostname) || !data.device_code || !data.user_code || !(data.expires_in > 0)) throw new AuthError('INVALID_RESPONSE', 'Microsoft hat eine ungültige Anmeldeantwort gesendet. Bitte versuche es erneut.');
      const device = { state: 'waiting', code: data.user_code, url: url.href, expiresAt: this.now() + data.expires_in * 1000 };
      this.stateChanged(device);
      this.poll(data, revision, controller).catch(error => {
        if (!controller.signal.aborted && revision === this.revision) this.stateChanged({ state: 'error', error: error.message, code: error.code || 'LOGIN_FAILED' });
      }).finally(() => { if (this.pending === controller) this.pending = null; });
      return device;
    } catch (error) {
      if (this.pending === controller) this.pending = null;
      if (!controller.signal.aborted && revision === this.revision) this.stateChanged({ state: 'error', error: error.message, code: error.code || 'LOGIN_FAILED' });
      throw error;
    }
  }
  async poll(device, revision, controller) {
    const signal = controller.signal, end = this.now() + device.expires_in * 1000;
    let interval = Math.max(5, device.interval || 5);
    while (this.now() < end) {
      await this.delay(interval * 1000, undefined, { signal }); signal.throwIfAborted();
      const { ok, data } = await this.request(OAUTH + 'token', { body: { grant_type: 'urn:ietf:params:oauth:grant-type:device_code', client_id: MICROSOFT_CLIENT_ID, device_code: device.device_code }, form: true, signal });
      signal.throwIfAborted();
      if (data.error === 'authorization_pending') continue;
      if (data.error === 'slow_down') { interval += 5; continue; }
      if (!ok) throw oauthError(data);
      this.stateChanged({ state: 'verifying', stage: 'Minecraft-Konto wird geprüft …' });
      await this.exchange(data, signal, revision);
      this.stateChanged({ state: 'connected', account: this.public() }); this.emit('data'); return;
    }
    throw new AuthError('CODE_EXPIRED', 'Der Anmeldecode ist abgelaufen. Starte die Anmeldung erneut.');
  }
  async exchange(token, signal, revision, previous = null) {
    const active = () => { signal?.throwIfAborted(); if (revision !== this.revision) throw new AuthError('CANCELLED', 'Anmeldung abgebrochen.'); };
    active();
    if (!token.access_token) throw new AuthError('INVALID_RESPONSE', 'Microsoft hat kein gültiges Zugriffstoken übermittelt.');
    let response = await this.request('https://user.auth.xboxlive.com/user/authenticate', { body: { Properties: { AuthMethod: 'RPS', SiteName: 'user.auth.xboxlive.com', RpsTicket: 'd=' + token.access_token }, RelyingParty: 'http://auth.xboxlive.com', TokenType: 'JWT' }, signal });
    if (!response.ok || !response.data.Token || !response.data.DisplayClaims?.xui?.[0]?.uhs) throw new AuthError('XBOX_LOGIN_FAILED', 'Xbox-Anmeldung fehlgeschlagen. Prüfe, ob für dein Microsoft-Konto ein Xbox-Profil eingerichtet ist.');
    const userHash = response.data.DisplayClaims.xui[0].uhs;
    response = await this.request('https://xsts.auth.xboxlive.com/xsts/authorize', { body: { Properties: { SandboxId: 'RETAIL', UserTokens: [response.data.Token] }, RelyingParty: 'rp://api.minecraftservices.com/', TokenType: 'JWT' }, signal });
    if (!response.ok) {
      const message = { 2148916233: 'Erstelle zuerst ein Xbox-Profil für dein Microsoft-Konto auf xbox.com.', 2148916235: 'Xbox Live ist für die Region dieses Kontos nicht verfügbar.', 2148916236: 'Microsoft verlangt für dieses Konto eine Altersbestätigung.', 2148916237: 'Microsoft verlangt für dieses Konto eine Altersbestätigung.', 2148916238: 'Dieses Konto benötigt eine Microsoft-Familienfreigabe für Xbox und Minecraft.' }[response.data.XErr];
      throw new AuthError('XBOX_ACCOUNT_REQUIRED', message || 'Xbox hat die Anmeldung abgelehnt. Prüfe dein Xbox-Profil und die Familienfreigaben.');
    }
    if (!response.data.Token) throw new AuthError('INVALID_RESPONSE', 'Xbox hat keine gültige Anmeldebestätigung übermittelt.');
    const xuid = response.data.DisplayClaims?.xui?.[0]?.xid || '';
    response = await this.request(MINECRAFT + '/authentication/login_with_xbox', { body: { identityToken: `XBL3.0 x=${userHash};${response.data.Token}` }, signal });
    if (!response.ok) {
      if (response.status === 403) throw new AuthError('MINECRAFT_APP_ACCESS', 'Minecraft verweigert dieser Launcher-App den Zugriff. Prüfe die Mojang-Freigabe für die registrierte Client-ID (HTTP 403).');
      throw new AuthError('MINECRAFT_LOGIN_FAILED', 'Minecraft hat die Anmeldung abgelehnt. Bitte versuche es später erneut.');
    }
    const mc = response.data;
    if (typeof mc.access_token !== 'string' || !(Number(mc.expires_in) > 0)) throw new AuthError('INVALID_RESPONSE', 'Minecraft hat keine gültige Sitzung übermittelt.');
    const entitlements = await this.request(MINECRAFT + '/entitlements/mcstore', { accessToken: mc.access_token, signal });
    if (!entitlements.ok) throw new AuthError('OWNERSHIP_CHECK_FAILED', 'Deine Minecraft-Java-Lizenz konnte gerade nicht geprüft werden. Bitte versuche es erneut.');
    if (!Array.isArray(entitlements.data.items)) throw new AuthError('OWNERSHIP_CHECK_FAILED', 'Minecraft hat keine gültigen Lizenzinformationen übermittelt. Bitte versuche es erneut.');
    if (!entitlements.data.items.some(item => ['game_minecraft', 'product_minecraft'].includes(item.name))) throw new AuthError('MINECRAFT_REQUIRED', 'Dieses Microsoft-Konto besitzt keine aktive Lizenz für Minecraft: Java Edition. Melde dich mit dem Konto an, dem das Spiel gehört.');
    const profileResponse = await this.request(MINECRAFT + '/minecraft/profile', { accessToken: mc.access_token, signal });
    if (profileResponse.status === 404) throw new AuthError('PROFILE_REQUIRED', 'Lege zuerst dein Minecraft-Java-Profil auf minecraft.net an und melde dich anschließend erneut an.');
    if (!profileResponse.ok) throw new AuthError('PROFILE_UNAVAILABLE', 'Dein Minecraft-Profil ist gerade nicht erreichbar. Bitte versuche es erneut.');
    const profile = profileResponse.data;
    if (!/^[a-f0-9]{32}$/i.test(profile.id || '') || !/^[A-Za-z0-9_]{3,16}$/.test(profile.name || '')) throw new AuthError('INVALID_PROFILE', 'Minecraft hat kein gültiges Java-Profil übermittelt.');
    if (previous && previous.id !== profile.id) throw new AuthError('ACCOUNT_CHANGED', 'Das Microsoft-Konto hat sich geändert. Bitte melde dich erneut an.');
    const refreshToken = token.refresh_token || previous?.refreshToken;
    if (!refreshToken) throw new AuthError('INVALID_RESPONSE', 'Microsoft hat keine erneuerbare Sitzung übermittelt. Starte die Anmeldung erneut.');
    const candidate = { name: profile.name, id: profile.id, xuid, accessToken: mc.access_token, refreshToken, expires: this.now() + Number(mc.expires_in) * 1000, ownsGame: true, clientId: MICROSOFT_CLIENT_ID };
    active(); await this.persist(candidate); active(); this.account = candidate;
    return candidate;
  }
  async session() {
    if (this.offlineActive && this.offline) return offlineSession(this.offline.name);
    if (!this.account) throw new AuthError('LOGIN_REQUIRED', 'Bitte melde dich zuerst mit deinem Microsoft-Konto an.');
    if (this.account.expires > this.now() + 120000) return requireAccount(this.account);
    if (this.refreshing) return this.refreshing.promise;
    const controller = new AbortController(), revision = this.revision, previous = this.account;
    const promise = (async () => {
      const { ok, data } = await this.request(OAUTH + 'token', { body: { grant_type: 'refresh_token', client_id: MICROSOFT_CLIENT_ID, refresh_token: previous.refreshToken, scope: SCOPE }, form: true, signal: controller.signal });
      if (!ok) {
        if (data.error === 'invalid_grant' && revision === this.revision) await this.logout();
        throw oauthError(data);
      }
      return requireAccount(await this.exchange(data, controller.signal, revision, previous));
    })();
    this.refreshing = { controller, promise };
    try { return await promise; } finally { if (this.refreshing?.promise === promise) this.refreshing = null; }
  }
  cancel() {
    const pending = this.pending; if (!pending) return;
    this.revision++; pending.abort(); this.pending = null;
    this.persist(this.account).catch(() => {});
    this.stateChanged({ state: 'idle' });
  }
  async logout() {
    this.cancel(); this.revision++; this.refreshing?.controller.abort();
    this.account = null; this.offline = null; this.offlineActive = false;
    await this.persist(null); await this.persistOffline(null);
    this.stateChanged({ state: 'idle' }); this.emit('data');
  }
}
module.exports = { Auth, AuthError, requireAccount, requireSession, offlineSession, oauthError };
