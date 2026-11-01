import React, { useEffect, useRef, useState } from 'react';
import { Box, Check, Download, ExternalLink, LoaderCircle, Plus } from 'lucide-react';
import { loaderName } from './loaders.js';
const api = window.carrot;
const message = e => e.message.replace(/^Error invoking remote method '[^']+': Error: /, '');

export default function InstallProjectModal({ Modal, project: p, instances, initialInstanceId, close, onInstalled, notify, onCreate, runningIds = [], job }) {
  const isPack = p.project_type === 'modpack';
  const eligible = instances.filter(i => p.project_type !== 'mod' || i.loader !== 'vanilla');
  const contextual = !!initialInstanceId;
  const [id, setId] = useState(initialInstanceId || (eligible.length === 1 ? eligible[0].id : ''));
  const [plan, setPlan] = useState(null), [packVersions, setPackVersions] = useState([]), [version, setVersion] = useState('');
  const [name, setName] = useState(p.title.slice(0,40)), [optional, setOptional] = useState(false);
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(true), [error, setError] = useState('');
  const busyRef = useRef(false);
  const [retry,setRetry] = useState(0);
  const selected = eligible.find(i => i.id === id);
  const requiresExit = plan?.requiresGameExit ?? plan?.files.some(f => f.folder === 'mods');
  const mustCloseGame = !!(requiresExit && runningIds.includes(id));
  const packVersion = packVersions.find(v => v.id === version);
  useEffect(() => {
    if (!isPack) return;
    let active = true; setLoading(true); setError('');
    api.projectVersions(p.project_id).then(versions => {
      if (!active) return;
      const supported = versions.filter(v => v.loaders.some(l => ['fabric','forge','neoforge','quilt','minecraft'].includes(l)) && v.files.some(f => f.filename?.endsWith('.mrpack')));
      setPackVersions(supported); setVersion((supported.find(v => v.version_type === 'release') || supported[0])?.id || '');
    }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [p.project_id, isPack, retry]);
  useEffect(() => {
    if (isPack) return;
    let active = true; setPlan(null); setError(''); setLoading(!!selected);
    if (selected) api.planProject(id, p.project_id).then(value => { if (active) setPlan(value); }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [p.project_id, id, isPack, selected?.id, retry]);
  const install = async () => {
    if (busyRef.current || loading || mustCloseGame) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (isPack) { await onInstalled(await api.importProjectPack(p.project_id, version, { name: name.trim(), optional })); return; }
      const result = await api.installProject(plan.key);
      notify(result?.requiresGameExit || requiresExit ? 'Mods installiert. Sie werden beim nächsten Minecraft-Start geladen.' : p.project_type === 'shader' ? 'Shader installiert. Wähle ihn im Shader-Menü im Spiel aus.' : 'Ressourcenpaket installiert. Aktiviere es im Spiel – ein Neustart ist nicht nötig.');
      close();
    } catch (e) { if(!isPack)setPlan(null);setError(message(e)); } finally { busyRef.current = false; setBusy(false); }
  };
  return <Modal title={isPack ? 'Modpack erstellen' : 'Inhalt hinzufügen'} close={() => { if (!busy) close(); }}>
    <div className="project-detail-header">{p.icon_url?.startsWith('https://cdn.modrinth.com/') && <img src={p.icon_url} alt=""/>}<div><h2>{p.title}</h2><p>von {p.author}</p></div></div>
    <p className="modal-paragraph">{p.description}</p>
    {isPack ? <>
      <label className="field">Name der neuen Instanz<input aria-label="Modpack-Instanzname" maxLength={40} value={name} disabled={busy} onChange={e => setName(e.target.value)}/></label>
      <label className="field">Modpack-Version<select aria-label="Modpack-Version" value={version} disabled={loading || busy} onChange={e => setVersion(e.target.value)}>{packVersions.length ? packVersions.map(v => <option key={v.id} value={v.id}>{v.name} · {v.version_type === 'beta' ? 'Beta' : v.version_type === 'alpha' ? 'Alpha' : 'Release'}</option>) : <option value="">{loading ? 'Versionen werden geladen …' : 'Keine unterstützte Modpack-Version verfügbar'}</option>}</select></label>
      {packVersion && <div className="pack-version-summary"><span>Minecraft {packVersion.game_versions.join(', ')}</span><span>{packVersion.loaders.filter(l => l !== 'minecraft').map(loaderName).join(', ') || 'Vanilla'}</span></div>}
      <label className="checkbox-label pack-optional"><input type="checkbox" checked={optional} disabled={busy} onChange={e => setOptional(e.target.checked)}/> Optionale Client-Dateien des Pakets mitinstallieren</label>
      <p className="fine-print">Das Modpack bekommt einen eigenen Spielordner mit der vorgesehenen Minecraft-Version, dem Modloader und seinen Dateien.</p>
    </> : selected ? <>
      {contextual ? <div className="locked-install-target" aria-label="Festgelegte Zielinstanz"><Box size={22}/><div><small>Wird dieser Instanz hinzugefügt</small><strong>{selected.name}</strong><span>Minecraft {selected.version} · {loaderName(selected.loader)}</span></div><Check size={17}/></div> : <label className="field">Zielinstanz<select value={id} disabled={busy} onChange={e => setId(e.target.value)} aria-label="Zielinstanz"><option value="">Instanz auswählen</option>{eligible.map(i => <option key={i.id} value={i.id}>{i.name} · {i.version} / {loaderName(i.loader)}</option>)}</select></label>}
      {loading ? <p className="tool-working" role="status"><LoaderCircle size={15} className="spin"/> Passende Version und Abhängigkeiten werden geprüft …</p> : plan && <div className="install-plan"><h3>Diese Dateien werden installiert</h3><ul>{plan.files.map(f => <li key={f.projectId}><strong>{f.title}</strong><span>{f.versionNumber}</span></li>)}</ul><p>{requiresExit ? 'Mods werden beim nächsten Spielstart geladen.' : 'Im Spiel auswählen oder neu laden. Minecraft kann geöffnet bleiben.'}</p></div>}
      {mustCloseGame && <p className="form-error">Beende diese Minecraft-Instanz, bevor du Mods installierst. Ressourcenpakete und Shader können während des Spielens hinzugefügt werden.</p>}
    </> : contextual ? <div className="info-note"><p>{instances.some(i => i.id === initialInstanceId) ? 'Diese Instanz verwendet Vanilla. Wähle in ihren Einstellungen einen Modloader, um Mods hinzuzufügen.' : 'Die ausgewählte Instanz ist nicht mehr vorhanden. Öffne die Bibliothek und wähle sie erneut aus.'}</p></div> : eligible.length ? <label className="field">Zielinstanz<select value={id} onChange={e => setId(e.target.value)} aria-label="Zielinstanz"><option value="">Instanz auswählen</option>{eligible.map(i => <option key={i.id} value={i.id}>{i.name} · {i.version} / {loaderName(i.loader)}</option>)}</select></label> : <div className="info-note"><p>{p.project_type === 'mod' ? 'Erstelle zuerst eine Instanz mit einem Modloader.' : 'Erstelle zuerst eine Zielinstanz für diesen Inhalt.'}</p></div>}
    {busy && <div className="install-progress" role="status"><LoaderCircle size={16} className="spin"/><span>{job?.stage || (isPack ? 'Modpack wird erstellt …' : 'Dateien werden installiert …')}</span></div>}
    {error && <div className="form-error" role="alert">{error}<button className="text-button" disabled={busy} onClick={()=>isPack&&packVersions.length?install():setRetry(n=>n+1)}>Erneut versuchen</button></div>}
    <div className="modal-row-actions"><button className="text-button" disabled={busy} onClick={() => api.openExternal('https://modrinth.com/'+p.project_type+'/'+(p.slug || p.project_id)).catch(e => setError(message(e)))}><ExternalLink size={14}/> Auf Modrinth ansehen</button>{!isPack && !contextual && !eligible.length && <button className="button secondary compact" onClick={onCreate}><Plus size={15}/> Neue Instanz</button>}</div>
    <footer className="modal-footer"><button className="button secondary" disabled={busy} onClick={close}>Abbrechen</button><button className="button primary" disabled={busy || loading || mustCloseGame || (isPack ? !version || !name.trim() : !selected || !plan)} onClick={install}>{busy ? <LoaderCircle size={16} className="spin"/> : <Download size={16}/>} {isPack ? 'Modpack erstellen' : 'Jetzt installieren'}</button></footer>
  </Modal>;
}
