import React, { useEffect, useRef, useState } from 'react';
import { Download, ExternalLink, LoaderCircle, Plus } from 'lucide-react';
import { loaderName } from './loaders.js';
const api = window.carrot;
const message = e => e.message.replace(/^Error invoking remote method '[^']+': Error: /, '');

export default function InstallProjectModal({ Modal, project: p, instances, initialInstanceId, close, onPack, notify, onCreate }) {
  const isPack = p.project_type === 'modpack';
  const eligible = instances.filter(i => p.project_type !== 'mod' || i.loader !== 'vanilla');
  const [id, setId] = useState(eligible.find(i => i.id === initialInstanceId)?.id || eligible[0]?.id || '');
  const [plan, setPlan] = useState(null), [packVersions, setPackVersions] = useState([]), [version, setVersion] = useState('');
  const [busy, setBusy] = useState(false), [loading, setLoading] = useState(isPack), [error, setError] = useState('');
  const busyRef = useRef(false);
  const selected = eligible.find(i => i.id === id);
  useEffect(() => {
    if (!isPack) return;
    let active = true;
    api.projectVersions(p.project_id).then(versions => { if (!active) return; const supported = versions.filter(v => v.loaders.some(l => ['fabric','forge','neoforge','quilt','minecraft'].includes(l))); setPackVersions(supported); setVersion(supported[0]?.id || ''); }).catch(e => { if (active) setError(message(e)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [p.project_id, isPack]);
  const install = async () => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true); setError('');
    try {
      if (isPack) { onPack(await api.prepareProjectPack(p.project_id, version)); return; }
      if (!plan) { setPlan(await api.planProject(id, p.project_id)); return; }
      await api.installProject(plan.key); notify('Projekt und Abhängigkeiten installiert.'); close();
    } catch (e) { setError(message(e)); } finally { busyRef.current = false; setBusy(false); }
  };
  return <Modal title={isPack ? 'Modpack importieren' : 'Inhalt installieren'} close={() => { if (!busy) close(); }}>
    <div className="project-detail-header">{p.icon_url?.startsWith('https://cdn.modrinth.com/') && <img src={p.icon_url} alt=""/>}<div><h2>{p.title}</h2><p>von {p.author}</p></div></div>
    <p className="modal-paragraph">{p.description}</p>
    {isPack ? <><label className="field">Modpack-Version<select aria-label="Modpack-Version" value={version} disabled={loading || busy} onChange={e => setVersion(e.target.value)}>{packVersions.length ? packVersions.map(v => <option key={v.id} value={v.id}>{v.name} · {v.game_versions.join(', ')}</option>) : <option value="">{loading ? 'Versionen werden geladen …' : 'Keine unterstützte Modpack-Version verfügbar'}</option>}</select></label><p className="fine-print">Das Modpack wird als eigene Instanz mit der zugehörigen Minecraft-Version und dem Modloader importiert.</p></> : eligible.length ? <><label className="field">Zielinstanz<select value={id} disabled={busy} onChange={e => { setId(e.target.value); setPlan(null); setError(''); }} aria-label="Zielinstanz">{eligible.map(i => <option key={i.id} value={i.id}>{i.name} · {i.version} / {loaderName(i.loader)}</option>)}</select></label>{selected && <p className="install-target">{loaderName(selected.loader)} · Minecraft {selected.version}</p>}{plan && <div className="install-plan"><h3>Diese Dateien werden installiert</h3><ul>{plan.files.map(f => <li key={f.projectId}><strong>{f.title}</strong><span>{f.versionNumber}</span></li>)}</ul><p>Erforderliche Abhängigkeiten sind enthalten. Bei aktivierten automatischen Backups wird vorher eine Sicherung erstellt.</p></div>}</> : <div className="info-note"><p>{p.project_type === 'mod' ? 'Für Mods benötigst du eine Instanz mit einem Modloader. Erstelle eine neue Instanz oder ändere den Loader in ihren Einstellungen.' : 'Erstelle zuerst eine Zielinstanz für diesen Inhalt.'}</p></div>}
    {error && <p className="form-error" role="alert">{error}</p>}
    <div className="modal-row-actions"><button className="text-button" disabled={busy} onClick={() => api.openExternal(`https://modrinth.com/${p.project_type}/${p.slug || p.project_id}`).catch(e => setError(message(e)))}><ExternalLink size={14}/> Projektseite auf Modrinth</button>{!isPack && !eligible.length && <button className="button secondary compact" onClick={onCreate}><Plus size={15}/> Neue Instanz</button>}</div>
    <footer className="modal-footer"><button className="button secondary" disabled={busy} onClick={close}>Schließen</button><button className="button primary" disabled={busy || loading || (isPack ? !version : !selected)} onClick={install}>{busy ? <LoaderCircle size={16} className="spin"/> : <Download size={16}/>} {isPack ? 'Modpack vorbereiten' : plan ? 'Jetzt installieren' : 'Installation prüfen'}</button></footer>
  </Modal>;
}
