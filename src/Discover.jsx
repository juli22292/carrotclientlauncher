import { categoryName } from './categories.js';
import { t, getLocale } from "./i18n.js";
import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, ArrowRight, Box, Check, Compass, Download, Grid2X2, Layers3, List, LockKeyhole, Package, RefreshCw, Search, WandSparkles, X, CircleAlert } from 'lucide-react';
import { loaderName } from './loaders.js';
const api = window.carrot;
const types = [{
  id: 'mod',
  name: 'Mods',
  icon: Box
}, {
  id: 'modpack',
  name: 'Modpacks',
  icon: Layers3
}, {
  id: 'resourcepack',
  name: 'Ressourcenpakete',
  icon: Package
}, {
  id: 'shader',
  name: 'Shader',
  icon: WandSparkles
}];
const number = n => Intl.NumberFormat(getLocale(), {
  notation: 'compact',
  maximumFractionDigits: 1
}).format(n || 0);
const cleanError = e => e.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
export default function Discover({
  instances,
  instanceId,
  onInstanceChange,
  onReturn,
  onProject,
  state,
  onState,
  refreshKey,
  onCreate,
  contextual = false
}) {
  const {
    type = 'mod',
    query = '',
    offset = 0,
    index = 'downloads',
    limit = 20,
    view = 'list',
    hideInstalled = false
  } = state;
  const [results, setResults] = useState(null),
    [loading, setLoading] = useState(true),
    [error, setError] = useState(''),
    [inventory, setInventory] = useState([]),
    [inventoryError, setInventoryError] = useState(''),
    [inventoryLoading, setInventoryLoading] = useState(false),
    [retry, setRetry] = useState(0);
  const search = useRef();
  const instance = instances.find(i => i.id === instanceId);
  const effectiveType = contextual && type === 'modpack' ? 'mod' : type;
  const searchingPack = effectiveType === 'modpack';
  const visibleTypes = contextual ? types.filter(t => t.id !== 'modpack') : types;
  const targetId = searchingPack ? '' : instanceId;
  const ids = [...new Set(inventory.map(m => m.projectId).filter(Boolean))];
  const excluded = instanceId && hideInstalled && !searchingPack ? ids.slice(0, 2000).sort().join(',') : '';
  const change = patch => {
    onState({
      ...state,
      ...patch
    });
    if (patch.offset !== undefined && patch.offset !== offset) document.querySelector('.page-content')?.scrollTo(0, 0);
  };
  useEffect(() => {
    let active = true;
    setInventory([]);
    setInventoryError('');
    setInventoryLoading(!!instanceId);
    if (instanceId) api.getContent(instanceId).then(items => {
      if (active) setInventory(items);
    }).catch(e => {
      if (active) setInventoryError(cleanError(e));
    }).finally(() => {
      if (active) setInventoryLoading(false);
    });
    return () => {
      active = false;
    };
  }, [instanceId, refreshKey, retry]);
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError('');
    const timer = setTimeout(() => api.searchProjects({
      query,
      type: effectiveType,
      offset,
      index,
      limit,
      instanceId: targetId,
      exclude: excluded ? excluded.split(',') : []
    }).then(value => {
      if (active) setResults(value);
    }).catch(e => {
      if (active) setError(cleanError(e));
    }).finally(() => {
      if (active) setLoading(false);
    }), 300);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [query, effectiveType, offset, index, limit, targetId, excluded, retry]);
  useEffect(() => {
    const key = e => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f' && !document.querySelector('[role="dialog"]')) {
        e.preventDefault();
        search.current?.focus();
      }
    };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, []);
  const lastPage = Math.max(1, Math.ceil(Math.min(results?.total_hits || 0, 100000 + limit) / limit));
  const pager = <div className="pagination"><button className="button secondary compact" disabled={loading || offset === 0} onClick={() => change({
      offset: Math.max(0, offset - limit)
    })}><ArrowLeft size={15} />{t(" Zurück")}</button><span>{t('Seite {0} von {1}',{0:Math.floor(offset / limit)+1,1:lastPage.toLocaleString(getLocale())})}</span><button className="button secondary compact" disabled={loading || offset + limit >= (results?.total_hits || 0) || offset + limit > 100000} onClick={() => change({
      offset: offset + limit
    })}>{t("Weiter ")}<ArrowRight size={15} /></button></div>;
  return <section className="discovery-workspace" aria-label={t("Inhalte entdecken")}>
    <header className="page-header"><div><div className="eyebrow">MODRINTH</div><h1>{t("Inhalte entdecken")}<span className="heading-dot">.</span></h1><p>{searchingPack ? t("Wähle ein Modpack für eine neue Instanz.") : instance ? t("Mods und Pakete für {0}.", {
            0: instance.name
          }) : t("Suche nach Mods und Paketen oder wähle zuerst eine Zielinstanz.")}</p></div><span className="badge"><Compass size={15} /> Modrinth</span></header>
    <div className="discover-context">{searchingPack ? <div className="pack-context-copy"><Layers3 size={23} /><div><strong>{t("Ein Modpack wird eine neue Instanz")}</strong><span>{t("Wähle ein Paket und seine Version. Minecraft, Modloader und Dateien werden daraus übernommen.")}</span></div></div> : contextual && instance ? <div className="discovery-fixed-target" aria-label={t("Aktive Zielinstanz")}><img src={instance.icon || instance.cover || './instance-landscape.png'} alt="" /><div><small>{t("Inhalte hinzufügen zu")}</small><strong>{instance.name}</strong><span>Minecraft {instance.version} · {loaderName(instance.loader)}</span></div></div> : <label>{t("Installieren für")}<select aria-label={t("Entdecken für Instanz")} value={instanceId} onChange={e => {
          onInstanceChange(e.target.value);
          change({
            offset: 0
          });
        }}><option value="">{t("Ohne Zielinstanz stöbern")}</option>{instances.map(i => <option key={i.id} value={i.id}>{i.name} · {i.version} / {loaderName(i.loader)}</option>)}</select></label>}{contextual && instance && <button className="text-button" onClick={onReturn}><ArrowLeft size={15} />{t(" Zurück zur Instanz")}</button>}{!instances.length && !searchingPack && <button className="text-button" onClick={onCreate}>{t("Instanz erstellen ")}<ArrowRight size={15} /></button>}</div>
    <div className="discover-tabs" role="tablist" aria-label={t("Projekttyp")}>{visibleTypes.map(typeInfo => <button role="tab" id={`discover-tab-${typeInfo.id}`} aria-controls="discover-results-panel" tabIndex={effectiveType===typeInfo.id?0:-1} onKeyDown={e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const index=visibleTypes.findIndex(item=>item.id===effectiveType),next=e.key==='Home'?0:e.key==='End'?visibleTypes.length-1:(index+(e.key==='ArrowRight'?1:-1)+visibleTypes.length)%visibleTypes.length;change({type:visibleTypes[next].id,offset:0});document.getElementById(`discover-tab-${visibleTypes[next].id}`)?.focus();}} key={typeInfo.id} aria-selected={effectiveType === typeInfo.id} className={effectiveType === typeInfo.id ? 'active' : ''} onClick={() => change({
        type: typeInfo.id,
        offset: 0
      })}><typeInfo.icon size={17} />{t(typeInfo.name)}</button>)}</div>
    <div className="discovery-layout"><div className="discovery-main" id="discover-results-panel" role="tabpanel" aria-labelledby={`discover-tab-${effectiveType}`}>
      <div className="search-field discovery-search"><Search size={19} /><input ref={search} maxLength={200} aria-label={t("Modrinth durchsuchen")} placeholder={t(({mod:'Mods suchen …',modpack:'Modpacks suchen …',resourcepack:'Ressourcenpakete suchen …',shader:'Shader suchen …'})[effectiveType])} value={query} onChange={e => change({
            query: e.target.value,
            offset: 0
          })} />{query ? <button className="icon-button tiny" aria-label={t("Suche löschen")} onClick={() => change({
            query: '',
            offset: 0
          })}><X size={16} /></button> : <kbd>{t("Strg F")}</kbd>}</div>
      <div className="discovery-sort"><label>{t("Sortieren")}<select aria-label={t("Suchergebnisse sortieren")} value={index} onChange={e => change({
              index: e.target.value,
              offset: 0
            })}><option value="downloads">Downloads</option><option value="relevance">{t("Relevanz")}</option><option value="updated">{t("Zuletzt aktualisiert")}</option><option value="newest">{t("Neu hinzugefügt")}</option><option value="follows">{t("Beliebt")}</option></select></label><label>{t("Pro Seite")}<select aria-label={t("Ergebnisse pro Seite")} value={limit} onChange={e => change({
              limit: Number(e.target.value),
              offset: 0
            })}><option value={20}>20</option><option value={40}>40</option></select></label><div className="view-toggle"><button className={view === 'list' ? 'selected' : ''} aria-label={t("Ergebnisse als Liste")} aria-pressed={view === 'list'} onClick={() => change({
              view: 'list'
            })}><List size={18} /></button><button className={view === 'grid' ? 'selected' : ''} aria-label={t("Ergebnisse als Kacheln")} aria-pressed={view === 'grid'} onClick={() => change({
              view: 'grid'
            })}><Grid2X2 size={18} /></button></div></div>
      <div className="results-heading" role="status"><span>{loading ? t("Projekte werden geladen …") : error ? t("Suche fehlgeschlagen") : (results?.total_hits===1?t('1 Projekt'):t('{0} Projekte',{0:number(results?.total_hits)}))}</span><span>{instance && !searchingPack ? `${instance.version} · ${loaderName(instance.loader)}` : t("Alle Versionen")}</span></div>
      {inventoryError && <p className="form-error" role="alert">{t("Installierte Inhalte konnten nicht gelesen werden. ")}{t(inventoryError)}<button className="text-button" onClick={() => setRetry(n => n + 1)}>{t("Erneut lesen")}</button></p>}
      {error ? <div className="content-empty"><CircleAlert size={30} /><h3>{t("Modrinth ist gerade nicht erreichbar")}</h3><p>{t(error)}</p><button className="button secondary compact" onClick={() => setRetry(n => n + 1)}><RefreshCw size={16} />{t(" Erneut versuchen")}</button></div> : loading ? <div className={`discovery-results ${view}`} aria-busy="true">{[0, 1, 2, 3].map(n => <div className="discovery-skeleton skeleton" key={n}><i /><span /></div>)}</div> : results?.hits.length ? <><div className={`discovery-results ${view}`}>{results.hits.map(p => {
              const installed = inventory.filter(m => m.projectId === p.project_id),
                hasInstall = installed.length > 0;
              return <article className={`project-card discover-result ${searchingPack ? 'modpack-result' : ''}`} key={p.project_id}>
          <button className="discovery-project-main" onClick={() => onProject(p)}><ProjectImage project={p} /><div><h3>{p.title}</h3><span className="project-author">{t("von ")}{p.author}</span>{searchingPack && <span className="pack-card-label">{t("Modpack · eigene Instanz")}</span>}<p>{p.description}</p><div className="project-tags">{(p.display_categories || []).slice(0, 3).map(c => <span key={c}>{categoryName(c)}</span>)}</div></div></button>
          <div className="discovery-project-actions">{hasInstall ? <span className="installed-badge"><Check size={14} />{installed.some(m => m.enabled) ? t("Installiert") : t("Deaktiviert")}</span> : instance && type !== 'modpack' ? <button className="button secondary compact" onClick={() => onProject(p)}><Download size={15} />{t(" Installieren")}</button> : <button className="button secondary compact" onClick={() => onProject(p)}>{searchingPack ? t("Modpack erstellen") : t("Details")}</button>}<span><Download size={13} />{number(p.downloads)}</span>{hasInstall && <button className="text-button" onClick={onReturn}>{t("Verwalten ")}<ArrowRight size={13} /></button>}</div>
        </article>;
            })}</div>{pager}</> : <div className="content-empty"><Search size={30} /><h3>{t("Keine passenden Projekte")}</h3><p>{hideInstalled && instance ? t("Ändere den Suchbegriff oder blende installierte Inhalte wieder ein.") : instance?.loader === 'vanilla' && type === 'mod' ? t("Diese Instanz nutzt Vanilla. Wähle in ihren Einstellungen einen Modloader oder suche nach Ressourcenpaketen.") : t("Versuche einen anderen Suchbegriff oder einen anderen Inhaltstyp.")}</p><button className="button secondary compact" onClick={() => change({
            query: '',
            hideInstalled: false,
            offset: 0
          })}>{t("Suche zurücksetzen")}</button></div>}
    </div><aside className="discovery-sidebar" aria-label={t("Suchfilter")}><h2>{searchingPack ? t('Modpack-Installation') : t("Passende Inhalte")}</h2>{instance && !searchingPack ? <><div className="compatibility-filter"><span>{t("Minecraft-Version")}</span><strong><LockKeyhole size={14} />{instance.version}</strong></div><div className="compatibility-filter"><span>Modloader</span><strong><LockKeyhole size={14} />{loaderName(instance.loader)}</strong></div><p>{t("Version und Loader kommen aus deiner Instanz. Vor der Installation prüft der Launcher die Dateien und benötigten Abhängigkeiten.")}</p><label className="checkbox-label hide-installed"><input type="checkbox" checked={hideInstalled} disabled={inventoryLoading || !!inventoryError || type === 'modpack'} onChange={e => change({
              hideInstalled: e.target.checked,
              offset: 0
            })} />{t(" Installierte Inhalte ausblenden")}</label><small>{t("Erkannt werden über Modrinth zugeordnete Projekte.")}</small></> : <><p>{searchingPack ? t("Ein Modpack bringt seine Spielversion, seinen Modloader und seine Mod-Auswahl mit.") : t("Mit einer Zielinstanz zeigt die Suche Inhalte für deren Minecraft-Version und Modloader an.")}</p><small>{t("Modpacks importierst du als neue Instanz mit der jeweiligen Spielversion.")}</small></>}<button className="text-button" onClick={() => api.openExternal('https://modrinth.com/'+({mod:'mods',modpack:'modpacks',resourcepack:'resourcepacks',shader:'shaders'})[effectiveType]).catch(() => {})}>{t("Modrinth im Browser ")}<ArrowRight size={14} /></button></aside></div>
  </section>;
}
function ProjectImage({
  project: p
}) {
  const [failed, setFailed] = useState(false);
  return !failed && p.icon_url?.startsWith('https://cdn.modrinth.com/') ? <img className="project-icon" src={p.icon_url} loading="lazy" alt="" onError={() => setFailed(true)} /> : <div className="project-icon fallback-icon"><Package size={25} /></div>;
}
