import React, { useEffect, useState } from 'react';
import { ArrowRight, Check, CircleAlert, Copy, ExternalLink, LoaderCircle, LogIn, LogOut, ShieldCheck, UserRound, WifiOff } from 'lucide-react';

const api = window.carrot;
const message = error => error.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
function MicrosoftMark() {
  return <svg viewBox="0 0 20 20" width="17" height="17" aria-hidden="true"><path fill="#f25022" d="M1 1h8v8H1z"/><path fill="#7fba00" d="M11 1h8v8h-8z"/><path fill="#00a4ef" d="M1 11h8v8H1z"/><path fill="#ffb900" d="M11 11h8v8h-8z"/></svg>;
}
export function AccountSettings({ data, onAccount }) {
  const offline = data.account?.type === 'offline';
  return <section className="settings-section">
    <div className="settings-section-title"><UserRound size={20}/><div><h2>Dein Spielprofil</h2><p>Microsoft-Konto oder Cracked / Offline auswählen.</p></div></div>
    <div className="setting-block account-setting">
      <div className="account-setting-icon"><UserRound size={23}/></div>
      <div><h3>{data.account?.name || 'Noch kein Profil ausgewählt'}</h3><p>{offline ? 'Cracked / Offline · Namensbasierte UUID' : data.account ? 'Microsoft · Minecraft: Java Edition · Lizenz geprüft' : 'Mit Microsoft anmelden oder einen Offline-Spielernamen wählen.'}</p></div>
      <button className="button secondary compact" onClick={onAccount}>Profil wählen<ArrowRight size={15}/></button>
    </div>
  </section>;
}
export function AccountModal({ Modal, data, close, notify }) {
  const [login, setLogin] = useState(data.authState || { state: 'idle' });
  const [busy, setBusy] = useState(false), [now, setNow] = useState(Date.now());
  const [mode, setMode] = useState(data.account?.type === 'offline' ? 'offline' : 'microsoft');
  const [offlineName, setOfflineName] = useState(data.offlineProfile?.name || '');
  const [offlineError, setOfflineError] = useState('');
  const microsoft = data.microsoftAccount || (data.account?.type !== 'offline' ? data.account : null);
  useEffect(() => api.on('auth', setLogin), []);
  useEffect(() => {
    if (login.state !== 'waiting') return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [login.state]);
  const begin = async () => {
    setBusy(true);
    try {
      await api.cancelLogin();
      const device = await api.beginLogin();
      setLogin(device); setNow(Date.now());
      try { await api.openExternal(device.url); } catch { notify('Die Microsoft-Seite konnte nicht automatisch geöffnet werden. Nutze die Schaltfläche im Dialog.', true); }
    } catch (error) { setLogin({ state: 'error', error: message(error) }); }
    finally { setBusy(false); }
  };
  const open = async () => { try { await api.openExternal(login.url); } catch (error) { notify(message(error), true); } };
  const copy = async () => { try { await navigator.clipboard.writeText(login.code); notify('Anmeldecode kopiert.'); } catch { notify('Der Code konnte nicht kopiert werden. Du kannst ihn auf der Microsoft-Seite von Hand eingeben.', true); } };
  const logout = async () => {
    setBusy(true);
    try { await api.logout(); close(); notify('Du bist abgemeldet.'); }
    catch (error) { notify(message(error), true); }
    finally { setBusy(false); }
  };
  const chooseMode = async value => {
    if (value === mode) return;
    setBusy(true);
    try {
      await api.cancelLogin();
      if (value === 'microsoft' && data.account?.type === 'offline') await api.useMicrosoft();
      setMode(value); setLogin({ state: 'idle' }); setOfflineError('');
    } catch (error) { notify(message(error), true); }
    finally { setBusy(false); }
  };
  const saveOffline = async event => {
    event.preventDefault(); setBusy(true); setOfflineError('');
    try { await api.useOffline(offlineName); }
    catch (error) { setOfflineError(message(error)); }
    finally { setBusy(false); }
  };
  const copyUuid = async () => {
    try { await navigator.clipboard.writeText(data.offlineProfile.id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')); notify('Offline-UUID kopiert.'); }
    catch { notify('Die UUID konnte nicht kopiert werden.', true); }
  };
  const seconds = Math.max(0, Math.ceil((login.expiresAt - now) / 1000));
  const expired = login.state === 'waiting' && seconds === 0;
  const waiting = login.state === 'waiting' && !expired;
  const checking = login.state === 'verifying' || login.state === 'starting';
  return <Modal title={data.account ? 'Dein Spielprofil' : 'Willkommen bei CarrotClient'} subtitle="Wähle, mit welchem Profil du spielen möchtest." close={close}>
    <div className="account-modes" role="tablist" aria-label="Anmeldeart">
      <button role="tab" aria-selected={mode === 'microsoft'} aria-controls="microsoft-panel" id="microsoft-tab" className={mode === 'microsoft' ? 'selected' : ''} onClick={() => chooseMode('microsoft')} disabled={busy}><MicrosoftMark/> Microsoft</button>
      <button role="tab" aria-selected={mode === 'offline'} aria-controls="offline-panel" id="offline-tab" className={mode === 'offline' ? 'selected' : ''} onClick={() => chooseMode('offline')} disabled={busy}><WifiOff size={16}/> Cracked / Offline</button>
    </div>
    {mode === 'offline' ? <div id="offline-panel" role="tabpanel" aria-labelledby="offline-tab">
      <div className="login-intro offline-intro"><div className="login-intro-icon"><WifiOff size={26}/></div><h3>Dein Name. Dein Abenteuer.</h3><p>Wähle einen Spielernamen für dein Offline-Profil.</p></div>
      <form onSubmit={saveOffline}>
        <label className="field">Offline-Spielername<input value={offlineName} onChange={e => setOfflineName(e.target.value)} minLength={3} maxLength={16} pattern="[A-Za-z0-9_]{3,16}" placeholder="Zum Beispiel: CarrotPlayer" required autoComplete="off" spellCheck={false}/></label>
        <p className="offline-name-hint">3–16 Zeichen · Buchstaben, Zahlen und Unterstriche</p>
        {data.offlineProfile && <div className="offline-uuid"><span>UUID für {data.offlineProfile.name}</span><div><code>{data.offlineProfile.id.replace(/(.{8})(.{4})(.{4})(.{4})(.{12})/, '$1-$2-$3-$4-$5')}</code><button type="button" className="icon-button tiny" onClick={copyUuid} aria-label="Offline-UUID kopieren"><Copy size={15}/></button></div></div>}
        <div className="info-note"><WifiOff size={18}/><p>Für Einzelspieler und Server mit Offline-Modus. Server mit Microsoft-Authentifizierung benötigen ein Microsoft-Konto. Ein anderer Name oder eine andere Schreibweise erhält eine andere UUID.</p></div>
        {offlineError && <div className="login-error" role="alert"><CircleAlert size={18}/><p>{offlineError}</p></div>}
        <footer className="modal-footer"><button type="button" className="button secondary" onClick={data.account?.type === 'offline' ? logout : close} disabled={busy}>{data.account?.type === 'offline' ? 'Abmelden' : 'Schließen'}</button><button type="submit" className="button primary" disabled={busy || !/^[A-Za-z0-9_]{3,16}$/.test(offlineName.trim())}>{busy ? <LoaderCircle className="spin" size={16}/> : <UserRound size={16}/>} Offline-Profil verwenden</button></footer>
      </form>
    </div> : <div id="microsoft-panel" role="tabpanel" aria-labelledby="microsoft-tab">
    {microsoft && !waiting && !checking && login.state !== 'error' ? <>
      <div className="account-modal-profile"><div className="avatar large"><span/><i/><b/></div><div><h3>{microsoft.name}</h3><p>Microsoft-Konto · Minecraft: Java Edition</p></div><ShieldCheck size={23}/></div>
      <div className="account-verified"><Check size={15}/> Minecraft-Lizenz und Java-Profil geprüft</div>
      <p className="modal-paragraph">Deine Microsoft-Anmeldung wird beim Spielen automatisch erneuert.</p>
      <footer className="modal-footer"><button className="button secondary" onClick={logout} disabled={busy}>{busy ? <LoaderCircle className="spin" size={16}/> : <LogOut size={16}/>} Abmelden</button><button className="button primary" onClick={close}>Alles klar <Check size={16}/></button></footer>
    </> : waiting ? <>
      <div className="login-step"><span>1</span><div><h3>Kopiere deinen Anmeldecode</h3><p>Dieser Code verbindet ausschließlich deine aktuelle Anmeldung.</p></div></div>
      <button className="device-code" onClick={copy} aria-label="Anmeldecode kopieren">{login.code}<Copy size={18}/></button>
      <div className="login-step"><span>2</span><div><h3>Bei Microsoft anmelden</h3><p>Gib den Code auf der geöffneten Microsoft-Seite ein und bestätige die Anmeldung für CarrotClientLauncher.</p></div></div>
      <div className="login-wait" role="status"><LoaderCircle className="spin" size={16}/> Warten auf deine Anmeldung … <span>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</span></div>
      <footer className="modal-footer"><button className="button secondary" onClick={close}>Abbrechen</button><button className="button primary" onClick={open}>Microsoft-Seite öffnen <ExternalLink size={16}/></button></footer>
    </> : checking ? <>
      <div className="login-checking"><LoaderCircle className="spin" size={30}/><h3>{login.state === 'starting' ? 'Anmeldung wird vorbereitet …' : 'Dein Minecraft-Konto wird geprüft …'}</h3><p>Das dauert einen kleinen Moment.</p></div>
      <footer className="modal-footer"><button className="button secondary" onClick={close}>Abbrechen</button></footer>
    </> : <>
      <div className="login-intro"><div className="login-intro-icon"><UserRound size={32}/></div><h3>Dein Account. Dein Abenteuer.</h3><p>Melde dich mit deinem Microsoft-Konto an, dem Minecraft: Java Edition gehört.</p></div>
      {(login.state === 'error' || expired) && <div className="login-error" role="alert"><CircleAlert size={19}/><p>{expired ? 'Der Code ist abgelaufen. Starte eine neue Anmeldung.' : login.error}</p></div>}
      <div className="info-note"><ShieldCheck size={18}/><p>Du meldest dich direkt bei Microsoft im Browser an. Anschließend prüfen wir deine Minecraft-Lizenz und laden dein Java-Profil.</p></div>
      <footer className="modal-footer"><button className="button secondary" onClick={close}>Schließen</button><button className="button primary microsoft-button" onClick={begin} disabled={busy}><MicrosoftMark/>{login.state === 'error' || expired ? 'Erneut versuchen' : 'Mit Microsoft anmelden'}<LogIn size={16}/></button></footer>
    </>}
    </div>}
  </Modal>;
}
