import React, { useState, useEffect, useRef } from 'react';
import { AccountModal, AccountSettings } from './Account.jsx';
import { UpdateNotice, UpdateSettings } from './Updates.jsx';
import { ImportModal, InstancePage, InstallProjectModal } from './LibraryTools.jsx';
import { House, Compass, Library, Download, Settings, Plus, ArrowUpRight, ArrowRight, ChevronRight, ChevronDown, Search, Play, Box, MoreHorizontal, X, Minus, Square, FolderOpen, Check, LoaderCircle, CheckCircle2, CircleAlert, SlidersHorizontal, Sprout, Cpu, Monitor, ExternalLink, LogOut, Copy, Clock3, Leaf, Layers3, WandSparkles, Package, Grid2X2, List, RefreshCw, ShieldCheck, Mountain, CheckCheck, LogIn, UserRound } from 'lucide-react';
import { loaders, loaderName } from './loaders.js';
import LoaderPicker from './LoaderPicker.jsx';
import Discover from './Discover.jsx';
import { t, useLocale, getLocale, setLocale } from './i18n.js';
const api = window.carrot;
const nav = [{
  id: 'home',
  name: 'Startseite',
  icon: House
}, {
  id: 'discover',
  name: 'Entdecken',
  icon: Compass
}, {
  id: 'library',
  name: 'Bibliothek',
  icon: Library
}];
const types = [{
  id: 'mod',
  name: 'Mods',
  icon: Box
}, {
  id: 'modpack',
  name: 'Modpacks',
  icon: Layers3
}, {
  id: 'shader',
  name: 'Shader',
  icon: WandSparkles
}, {
  id: 'resourcepack',
  name: 'Ressourcenpakete',
  icon: Package
}];
const formatNumber = n => Intl.NumberFormat(getLocale(), {
  notation: 'compact',
  maximumFractionDigits: 1
}).format(n || 0);
const duration = s => s < 60 ? t("Noch nicht gespielt") : s < 3600 ? t("{0} Min. gespielt", {
  0: Math.floor(s / 60)
}) : t("{0} Std. gespielt", {
  0: (s / 3600).toLocaleString(getLocale(), {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  })
});
const cleanError = e => e.message.replace(/^Error invoking remote method '[^']+': Error: /, '');
function Carrot({
  className = ''
}) {
  return <img className={className} src="./carrot.svg" alt="" />;
}
function InstanceImage({
  className = '',
  instance
}) {
  return <img className={`instance-image ${className}`} src={(className.includes('thumbnail') ? instance?.icon || instance?.cover : instance?.cover) || './instance-landscape.png'} alt="" />;
}
function Modal({
  children,
  footer,
  form,
  title,
  subtitle,
  close,
  wide = false
}) {
  const ref = useRef();
  const closeRef = useRef(close);
  closeRef.current = close;
  useEffect(() => {
    const prior = document.activeElement;
    (ref.current?.querySelector('input:not([type="checkbox"]),select,textarea') || ref.current?.querySelector('button'))?.focus();
    const key = e => {
      if (e.key === 'Escape') closeRef.current();
      if (e.key === 'Tab') {
        const nodes = [...ref.current.querySelectorAll('button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea:not(:disabled),a[href]')];
        const first = nodes[0],
          last = nodes.at(-1);
        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last?.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first?.focus();
        }
      }
    };
    document.addEventListener('keydown', key);
    return () => {
      document.removeEventListener('keydown', key);
      prior?.focus();
    };
  }, []);
  return <div className="modal-backdrop" onMouseDown={e => {
    if (e.target === e.currentTarget) close();
  }}><section ref={ref} role="dialog" aria-modal="true" aria-label={t(title)} className={`modal ${wide ? 'wide' : ''}`}><header><div><h2>{t(title)}</h2>{subtitle && <p>{subtitle}</p>}</div><button type="button" className="icon-button" onClick={close} aria-label={t("Schließen")}><X size={20} /></button></header>{form ? <form {...form} className="modal-form"><div className="modal-body">{children}</div>{footer}</form> : <><div className="modal-body">{children}</div>{footer}</>}</section></div>;
}
export default function App() {
  const locale = useLocale();
  const changeLanguage = async language => {
    const prior = getLocale();
    setLocale(language);
    try {
      await api.saveSettings({
        language
      });
    } catch (e) {
      setLocale(prior);
      notify(cleanError(e), true);
    }
  };
  const navigate = next => {
    setPage(next);
    document.querySelector('.page-content')?.scrollTo(0, 0);
    if (next === 'discover') {
      setDiscoverContext(false);
      setDiscoverInstanceId('');
    }
  };
  const [page, setPage] = useState('home'),
    [data, setData] = useState(null),
    [status, setStatus] = useState({
      jobs: [],
      running: []
    });
  const [modal, setModal] = useState(null),
    [toast, setToast] = useState(null),
    [versions, setVersions] = useState(null),
    [versionError, setVersionError] = useState('');
  const [recommendations, setRecommendations] = useState([]),
    [recError, setRecError] = useState(false),
    [libraryQuery, setLibraryQuery] = useState(''),
    [libraryFilter, setLibraryFilter] = useState('all'),
    [view, setView] = useState('grid');
  const [pending, setPending] = useState(null);
  const [updateState, setUpdateState] = useState(null);
  const [selectedInstanceId, setSelectedInstanceId] = useState(null),
    [discoverInstanceId, setDiscoverInstanceId] = useState(''),
    [discoverContext, setDiscoverContext] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [instanceTabs, setInstanceTabs] = useState({}),
    [discoverState, setDiscoverState] = useState({
      type: 'mod',
      query: '',
      offset: 0,
      index: 'downloads',
      limit: 20,
      view: 'list',
      hideInstalled: false
    });
  const notify = (message, error = false) => setToast({
    message,
    error,
    id: Date.now()
  });
  const run = async fn => {
    try {
      return await fn();
    } catch (e) {
      notify(cleanError(e), true);
    }
  };
  const refresh = async () => {
    const d = await api.getData();
    setLocale(d.settings.language);
    setData(d);
    setStatus(d.status);
    setUpdateState(d.update);
  };
  const loadVersions = () => {
    setVersionError('');
    api.getVersions().then(setVersions).catch(e => setVersionError(cleanError(e)));
  };
  useEffect(() => {
    if (!api) return;
    refresh().catch(e => notify(cleanError(e), true));
    loadVersions();
    const off = [api.on('data', () => refresh()), api.on('status', setStatus), api.on('update', setUpdateState), api.on('game-error', e => notify(e.message, true)), api.on('auth', e => {
      if (e.state === 'connected') {
        setModal(null);
        refresh();
        notify(e.account?.type === 'offline' ? t("Dein Offline-Profil ist aktiv.") : t("Dein Minecraft-Konto ist verbunden."));
      }
    })];
    return () => off.forEach(fn => fn());
  }, []);
  const loadRecommendations = () => {
    setRecError(false);
    api.searchProjects({
      type: 'resourcepack'
    }).then(r => setRecommendations(r.hits.slice(0, 3))).catch(() => setRecError(true));
  };
  useEffect(() => {
    if (api) loadRecommendations();
  }, []);
  useEffect(() => {
    if (toast) {
      const t = setTimeout(() => setToast(null), toast.error ? 9000 : 4500);
      return () => clearTimeout(t);
    }
  }, [toast]);
  if (!api) return <div className="standalone-message"><Carrot /><h1>CarrotClientLauncher</h1><p>{t("Öffne den Launcher über carrotclientlauncher.exe.")}</p></div>;
  if (!data) return <div className="boot"><Carrot /><LoaderCircle className="spin" size={20} /><span>{t("Deine Welten werden vorbereitet …")}</span></div>;
  const activeJob = status.jobs.find(j => j.state === 'running');
  const instances = [...data.instances].sort((a, b) => Number(!!b.favorite) - Number(!!a.favorite) || (b.lastPlayed || b.createdAt) - (a.lastPlayed || a.createdAt));
  const recent = [...data.instances].filter(i => i.lastPlayed).sort((a, b) => b.lastPlayed - a.lastPlayed)[0];
  const filtered = instances.filter(i => i.name.toLowerCase().includes(libraryQuery.toLowerCase()) && (libraryFilter === 'all' || (libraryFilter === 'favorites' ? i.favorite : libraryFilter === 'modpacks' ? !!i.modpack : i.loader === libraryFilter)));
  const create = () => setModal({
    type: 'create'
  });
  const launch = i => {
    if (!data.account) {
      setModal({
        type: 'account'
      });
      return;
    }
    return run(async () => {
      setPending(i.id);
      try {
        await api.launch(i.id);
        notify(t("Viel Spaß in deiner Welt!"));
      } finally {
        setPending(null);
      }
    });
  };
  const openInstance = i => {
    setSelectedInstanceId(i.id);
    setModal(null);
    setPage('instance');
    document.querySelector('.page-content')?.scrollTo(0, 0);
  };
  const instanceCard = i => <article key={i.id} className={`instance-card ${view === 'list' && page === 'library' ? 'list-card' : ''}`}>
    <button className={`instance-cover ${i.color}`} onClick={() => openInstance(i)} aria-label={t("{0} verwalten", {
      0: i.name
    })}><InstanceImage instance={i} /><span className="cover-label">{i.favorite ? '★ · ' : ''}{loaderName(i.loader).toUpperCase()}</span>{status.running.includes(i.id) && <span className="live-tag"><i />{t(" Läuft")}</span>}</button>
    <div className="instance-info"><div className="instance-heading"><button onClick={() => openInstance(i)}><h3>{i.name}</h3></button><button className="icon-button tiny" aria-label={t("{0}: Optionen", {
          0: i.name
        })} onClick={() => openInstance(i)}><MoreHorizontal size={19} /></button></div><p><span className={`loader-dot ${i.loader}`} />{i.version}<span className="dot-separator">·</span>{loaderName(i.loader)}</p><div className="instance-footer"><span><Clock3 size={13} />{duration(i.playtime)}</span><button className="play-button" disabled={!!pending || !!activeJob || status.running.includes(i.id)} onClick={() => launch(i)} aria-label={t("{0} starten", {
          0: i.name
        })}>{pending === i.id ? <LoaderCircle size={17} className="spin" /> : data.account ? <Play size={17} fill="currentColor" /> : <LogIn size={17} />}</button></div></div>
  </article>;
  return <div className="app-shell" onDragOver={e => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      setDragging(true);
    }
  }} onDragLeave={e => {
    if (!e.currentTarget.contains(e.relatedTarget)) setDragging(false);
  }} onDrop={e => {
    e.preventDefault();
    setDragging(false);
    const file = [...e.dataTransfer.files].find(f => f.name.toLowerCase().endsWith('.mrpack'));
    if (file) run(async () => setModal({
      type: 'import',
      pack: await api.inspectDroppedModpack(file)
    }));else notify('Bitte eine .mrpack-Datei hineinziehen.', true);
  }}>
    {dragging && <div className="file-drop-overlay"><Download size={38} /><h2>{t("Modpack hier ablegen")}</h2><p>{t(".mrpack-Datei als neue Instanz importieren")}</p></div>}
    <aside className="sidebar">
      <div className="brand"><Carrot /><div><strong>carrot<span>client</span></strong><small>MINECRAFT LAUNCHER</small></div><span className="beta">BETA</span></div>
      <div className="workspace-label">MINECRAFT: JAVA EDITION</div>
      <nav aria-label={t("Hauptnavigation")}>{nav.map(item => <button key={item.id} className={`nav-item ${page === item.id || page === 'instance' && item.id === 'library' ? 'active' : ''}`} title={t(item.name)} onClick={() => navigate(item.id)}><item.icon size={19} /><span>{t(item.name)}</span>{item.id === 'library' && <small>{instances.length}</small>}</button>)}</nav>
      <div className="sidebar-divider" />
      <div className="sidebar-section-title"><span>{t("DEINE INSTANZEN")}</span><button className="icon-button tiny" aria-label={t("Neue Instanz erstellen")} onClick={create}><Plus size={17} /></button></div>
      <div className="sidebar-instances">{instances.slice(0, 5).map(i => <button key={i.id} title={i.name} className={`sidebar-instance ${page === 'instance' && selectedInstanceId === i.id ? 'selected' : ''}`} onClick={() => openInstance(i)}><InstanceImage instance={i} className="instance-thumbnail" /><span>{i.name}<small>{i.version} · {loaderName(i.loader)}</small></span>{status.running.includes(i.id) && <i className="online-dot" />}</button>)}{!instances.length && <button className="sidebar-empty" onClick={create}><Plus size={18} /><span>{t("Erste Instanz")}<br />{t("erstellen")}</span></button>}</div>
      <div className="sidebar-bottom"><button title={t('Downloads')} className={`nav-item ${page === 'downloads' ? 'active' : ''}`} onClick={() => setPage('downloads')}><Download size={19} /><span>Downloads</span>{activeJob && <span className="download-dot" />}</button><button title={t('Einstellungen')} className={`nav-item ${page === 'settings' ? 'active' : ''}`} onClick={() => setPage('settings')}><Settings size={19} /><span>{t("Einstellungen")}</span></button><button className="account-button" title={t('Dein Spielprofil')} onClick={() => setModal({
          type: 'account'
        })}>{data.account ? <div className="avatar"><span /><i /><b /></div> : <div className="account-placeholder"><UserRound size={20} /></div>}<span><strong>{data.account?.name || t("Anmelden")}</strong><small>{data.account?.type === 'offline' ? 'Cracked / Offline' : data.account ? 'Microsoft-Konto' : t("Microsoft oder Offline")}</small></span><ChevronDown size={15} /></button></div>
    </aside>
    <main className="main-shell">
      <div className="titlebar"><div className="breadcrumb">Launcher <ChevronRight size={13} /><span>{page === 'instance' ? data.instances.find(i => i.id === selectedInstanceId)?.name || t("Instanz") : page === 'settings' ? t("Einstellungen") : page === 'downloads' ? 'Downloads' : t(nav.find(n => n.id === page)?.name)}</span></div><label className="language-switch"><span>{t("Sprache")}</span><select aria-label={t('Sprache auswählen')} value={locale} onChange={e => changeLanguage(e.target.value)}><option value="de">Deutsch</option><option value="en">English</option></select></label><div className="window-controls"><button onClick={() => api.windowAction('minimize')} aria-label={t("Minimieren")}><Minus size={15} /></button><button onClick={() => api.windowAction('maximize')} aria-label={t("Maximieren")}><Square size={12} /></button><button className="close-window" onClick={() => api.windowAction('close')} aria-label={t("Fenster schließen")}><X size={17} /></button></div></div>
      <div className="page-content">
      <UpdateNotice state={updateState} open={() => {
          setPage('settings');
          document.querySelector('.page-content')?.scrollTo(0, 0);
        }} />
      {page === 'home' && <>
        <header className="page-header"><div><div className="eyebrow"><span />{t(" STARTSEITE")}</div><h1>{t("Schön, dass du da bist")}<span className="heading-dot">.</span></h1><p>{t("Starte ein Spielprofil oder lege eine neue Instanz an.")}</p></div><div className="header-actions"><button className="button secondary compact" onClick={() => setModal({
                type: "import"
              })}><Download size={17} />{t(" Profile importieren")}</button><button className="button secondary compact" onClick={create}><Plus size={17} />{t(" Neue Instanz")}</button></div></header>
        <section className="hero"><img className="hero-landscape" src="./home-landscape.png" alt={t("Minecraft-Landschaft mit grünen Wäldern, verschneiten Tannen und Bergen")} /><div className="hero-copy"><span className="hero-badge"><span /> MINECRAFT: JAVA EDITION</span><h2>{t("Minecraft starten.")}</h2><p>{t("Wähle ein Profil mit deiner Minecraft-Version und deinen Mods.")}<br />{t("Du kannst auch Profile aus anderen Launchern importieren.")}</p><button className="button primary" disabled={!!pending || !!activeJob || !!((recent || instances[0]) && status.running.includes((recent || instances[0]).id))} onClick={() => recent || instances[0] ? launch(recent || instances[0]) : create()}><Play size={17} /><span>{recent || instances[0] ? t("{0} spielen", {
                    0: (recent || instances[0]).name
                  }) : t("Erste Instanz erstellen")}</span> <ArrowRight size={17} /></button></div><span className="hero-caption"><Box size={13} /> VANILLA · FABRIC · FORGE · NEOFORGE · QUILT</span></section>
        {recent && <section className="recent-instance"><InstanceImage instance={recent} className="instance-thumbnail" /><div><small>{t("ZULETZT GESPIELT")}</small><strong>{recent.name}</strong><span>{recent.version} · {loaderName(recent.loader)}</span></div><button className="button primary compact" disabled={!!pending || !!activeJob || status.running.includes(recent.id)} onClick={() => launch(recent)}><Play size={16} />{t(" Weiterspielen")}</button></section>}<section className="section"><div className="section-heading"><h2>{t("Deine Instanzen ")}<span className="count">{instances.length}</span></h2><button className="text-button" onClick={() => setPage('library')}>{t("Zur Bibliothek ")}<ArrowRight size={15} /></button></div>{instances.length ? <div className="instance-grid home-grid">{instances.slice(0, 3).map(instanceCard)}{instances.length < 3 && <button className="add-instance-tile" onClick={create}><span><Plus size={24} /></span><strong>{t("Neue Instanz erstellen")}</strong><small>{t("Version und Modloader selbst auswählen.")}</small></button>}</div> : <div className="welcome-grid"><button className="first-instance" onClick={create}><InstanceImage /><div><span className="small-label">{t("ERSTE SCHRITTE")}</span><h3>{t("Dein erstes Spielprofil")}</h3><p>{t("Wähle einen Namen, eine Minecraft-Version und bei Bedarf einen Modloader.")}</p><span className="text-link">{t("Erste Instanz erstellen ")}<ArrowRight size={16} /></span></div><Plus className="first-plus" size={22} /></button><div className="tip-card"><Sprout size={23} /><h3>{t("Eine Instanz – ein Spielprofil")}</h3><p>{t("Deine Instanzen haben getrennte Welten, Mods und Einstellungen. Du kannst mehrere Minecraft-Versionen nebeneinander nutzen.")}</p><span>{t("Minecraft und Java werden beim ersten Start geladen.")}</span></div></div>}</section>
        <section className="section recommendations"><div className="section-heading"><div><h2>{t("Ressourcenpakete auf Modrinth")}</h2><p>{t("Ressourcenpakete aus der Community. Entdeckt auf Modrinth.")}</p></div><button className="text-button" onClick={() => navigate('discover')}>{t("Mehr entdecken ")}<ArrowRight size={15} /></button></div><div className="recommend-grid">{recommendations.map(p => <button key={p.project_id} className="recommend-card" onClick={() => setModal({
                type: 'project',
                project: p
              })}><ProjectIcon p={p} /><span><strong>{p.title}</strong><small>{t("von ")}{p.author}</small><span className="recommend-downloads"><Download size={11} />{formatNumber(p.downloads)} Downloads</span></span><ArrowUpRight size={17} /></button>)}{!recommendations.length && (recError ? <div className="inline-error"><CircleAlert size={17} /><span>{t("Modrinth ist gerade nicht erreichbar.")}</span><button className="text-button" onClick={loadRecommendations}>{t("Erneut versuchen")}</button></div> : [0, 1, 2].map(n => <div className="recommend-card skeleton" key={n}><i /><span /></div>))}</div></section>
        <footer className="page-footer"><span><Carrot />{t(" Minecraft: Java Edition für Windows")}</span><span>CarrotClientLauncher <b>v{data.appVersion}</b></span></footer>
      </>}
      {page === 'library' && <><header className="page-header"><div><div className="eyebrow">{t("BIBLIOTHEK")}</div><h1>{t("Deine Bibliothek")}<span className="heading-dot">.</span></h1><p>{t("Deine Spielprofile, Versionen und Mods.")}</p></div><div className="header-actions"><button className="button secondary compact" onClick={() => setModal({
                type: "import"
              })}><Download size={17} />{t(" Profile importieren")}</button><button className="button primary compact" onClick={create}><Plus size={17} />{t(" Neue Instanz")}</button></div></header><div className="library-toolbar"><div className="search-field"><Search size={18} /><input aria-label={t("Instanzen suchen")} placeholder={t("Instanz suchen …")} value={libraryQuery} onChange={e => setLibraryQuery(e.target.value)} />{libraryQuery && <button className="icon-button tiny" onClick={() => setLibraryQuery('')} aria-label={t("Suche löschen")}><X size={15} /></button>}</div><select aria-label={t("Modloader filtern")} value={libraryFilter} onChange={e => setLibraryFilter(e.target.value)}><option value="all">{t("Alle Instanzen")}</option><option value="favorites">{t("Favoriten")}</option><option value="modpacks">Modpacks</option>{loaders.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}</select><div className="view-toggle"><button className={view === 'grid' ? 'selected' : ''} aria-label={t("Kachelansicht")} onClick={() => setView('grid')}><Grid2X2 size={18} /></button><button className={view === 'list' ? 'selected' : ''} aria-label={t("Listenansicht")} onClick={() => setView('list')}><List size={19} /></button></div></div>{filtered.length ? <div className={`instance-grid ${view === 'list' ? 'list-view' : ''}`}>{filtered.map(instanceCard)}{view === 'grid' && <button className="add-instance-tile" onClick={create}><span><Plus size={25} /></span><strong>{t("Neue Instanz")}</strong><small>{t("Minecraft-Version und Modloader wählen.")}</small></button>}</div> : <Empty icon={Library} title={instances.length ? t("Keine Instanz gefunden") : t("Noch keine Instanz vorhanden")} text={instances.length ? t("Versuche einen anderen Namen oder Modloader.") : t("Erstelle ein Spielprofil oder importiere ein vorhandenes Profil.")}>{!instances.length && <button className="button primary" onClick={create}><Plus size={18} />{t(" Erste Instanz erstellen")}</button>}</Empty>}</>}
      {page === 'discover' && <Discover contextual={discoverContext} state={discoverState} onState={setDiscoverState} refreshKey={data} onCreate={create} instances={instances} instanceId={discoverInstanceId} onInstanceChange={setDiscoverInstanceId} onReturn={() => {
          const i = instances.find(i => i.id === discoverInstanceId);
          if (i) openInstance(i);
        }} onProject={p => setModal({
          type: 'project',
          project: p,
          instanceId: discoverState.type === 'modpack' ? '' : discoverInstanceId
        })} />}
      {page === 'downloads' && <><header className="page-header"><div><div className="eyebrow">{t("EINMAL LADEN. IMMER WIEDER SPIELEN.")}</div><h1>{t("Deine Downloads")}<span className="heading-dot">.</span></h1><p>{t("Minecraft, Bibliotheken und Java. Alles an einem Ort.")}</p></div><span className="badge"><ShieldCheck size={14} />{t(" Prüfsummen verifiziert")}</span></header>{!status.jobs.length ? <Empty icon={Download} title={t("Alles ruhig in der Leitung.")} text={t("Sobald du eine Instanz installierst oder zum ersten Mal startest, siehst du hier den Fortschritt.")}><button className="button secondary" onClick={() => setPage('library')}>{t("Zur Bibliothek ")}<ArrowRight size={16} /></button></Empty> : <div className="download-list">{status.jobs.map(j => <div className={`download-row ${j.state}`} key={j.id}><div className="download-icon">{j.state === 'running' ? <LoaderCircle className="spin" /> : j.state === 'complete' ? <CheckCircle2 /> : <CircleAlert />}</div><div className="download-info"><div><h3>{j.name}</h3><span>{j.state === 'running' ? `${j.progress}%` : j.state === 'complete' ? t("Abgeschlossen") : j.state === 'cancelled' ? t("Abgebrochen") : t("Fehlgeschlagen")}</span></div><p>{t(j.stage)}</p>{j.state === 'running' && <div className="progress-track"><i style={{
                    width: `${j.progress}%`
                  }} /></div>}<small>{(j.bytes / 1024 / 1024).toLocaleString(getLocale(), {
                    minimumFractionDigits: 1,
                    maximumFractionDigits: 1
                  })}{t(" MB heruntergeladen")}</small></div>{j.state === 'running' && <button className="button secondary compact" onClick={() => run(() => api.cancelDownload())}>{t("Abbrechen")}</button>}</div>)}</div>}</>}
    {page === 'instance' && (() => {
          const i = data.instances.find(v => v.id === selectedInstanceId);
          if (!i) return null;
          return <InstancePage Modal={Modal} initialTab={instanceTabs[i.id] || 'mods'} onTabChange={tab => setInstanceTabs(t => ({
            ...t,
            [i.id]: tab
          }))} account={data.account} running={status.running.includes(i.id)} key={i.id} instance={i} versions={versions} busy={!!pending || !!activeJob} close={() => setPage('library')} launch={() => {
            setModal(null);
            launch(i);
          }} archive={() => setModal({
            type: 'archive',
            instance: i
          })} discover={(type = 'mod') => {
            setDiscoverState(s => ({
              ...s,
              type,
              offset: s.type === type && discoverInstanceId === i.id ? s.offset : 0,
              query: s.type === type && discoverInstanceId === i.id ? s.query : ''
            }));
            setDiscoverInstanceId(i.id);
            setDiscoverContext(true);
            setPage('discover');
          }} install={() => run(async () => {
            setModal(null);
            setPage('downloads');
            await api.install(i.id);
          })} notify={notify} />;
        })()}
      {page === 'settings' && <SettingsPage data={data} notify={notify} run={run} onAccount={() => setModal({
          type: 'account'
        })} updateState={updateState} onUpdateState={setUpdateState} gameBusy={status.running.length > 0 || !!activeJob} onLanguage={changeLanguage} />}
      </div>
      {activeJob && <button className="download-strip" onClick={() => setPage('downloads')}><LoaderCircle size={16} className="spin" /><span><strong>{activeJob.name}</strong> · {t(activeJob.stage)}</span><div className="progress-track"><i style={{
            width: `${activeJob.progress}%`
          }} /></div><b>{activeJob.progress}%</b><ChevronRight size={17} /></button>}
      <div className="statusbar"><span><span className={data.account ? 'online-dot' : 'offline-dot'} /> {data.account ? `${data.account.type === 'offline' ? t("Offline als") : t("Verbunden als")} ${data.account.name}` : t("Nicht angemeldet")}<span className="status-separator" />Minecraft: Java Edition</span><span>{versions ? t("Aktuell: {0}", {
            0: versions.latest.release
          }) : t("Versionen werden geladen")}<span className="status-separator" /><span className="status-brand">CARROTCLIENT</span></span></div>
    </main>
    {modal?.type === 'create' && <CreateModal versions={versions} versionError={t(versionError)} retry={loadVersions} settings={data.settings} close={() => setModal(null)} onCreate={async value => {
      const instance = await api.createInstance(value);
      await refresh();
      setModal(null);
      setPage('library');
      notify(`„${instance.name}“ ist bereit zum Installieren.`);
    }} />}
    {modal?.type === 'project' && <InstallProjectModal Modal={Modal} project={modal.project} instances={instances} initialInstanceId={modal.instanceId} onCreate={create} close={() => setModal(null)} runningIds={status.running} job={activeJob} onInstalled={async instance => {
      await refresh();
      setModal(null);
      openInstance(instance);
      notify('„' + instance.name + '“ wurde als eigene Instanz erstellt.');
    }} notify={notify} />}
    {modal?.type === 'account' && <AccountModal Modal={Modal} data={data} close={() => {
      api.cancelLogin();
      setModal(null);
    }} notify={notify} />}
    {modal?.type === 'import' && <ImportModal Modal={Modal} versions={versions} initialPack={modal.pack} close={() => setModal(null)} onDone={async instance => {
      await refresh();
      setModal(null);
      openInstance(instance);
      notify('„' + instance.name + '“ wurde importiert.');
    }} />}
    {modal?.type === 'archive' && <Modal title={t("Instanz archivieren?")} subtitle={modal.instance.name} close={() => setModal(null)} footer={<footer className="modal-footer"><button className="button secondary" onClick={() => setModal(null)}>{t("Abbrechen")}</button><button className="button primary" onClick={() => run(async () => {
        await api.removeInstance(modal.instance.id);
        setModal(null);
        setPage('library');
        setSelectedInstanceId(null);
        notify('Instanz archiviert. Deine Dateien sind sicher.');
      })}>{t("Archivieren")}</button></footer>}><p className="modal-paragraph">{t("Die Instanz wird aus deiner Bibliothek entfernt. Deine Welten und Dateien bleiben im Archiv im Launcher-Ordner erhalten.")}</p></Modal>}
    {toast && <div key={toast.id} className={`toast ${toast.error ? 'error' : ''}`} role={toast.error ? 'alert' : 'status'}>{toast.error ? <CircleAlert size={20} /> : <CheckCircle2 size={20} />}<span>{t(toast.message)}</span><button className="icon-button" aria-label={t("Hinweis schließen")} onClick={() => setToast(null)}><X size={17} /></button></div>}
  </div>;
}
function Empty({
  icon: Icon,
  title,
  text,
  children
}) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={29} /></div><h2>{t(title)}</h2><p>{t(text)}</p>{children}</div>;
}
function ProjectIcon({
  p
}) {
  return p.icon_url && p.icon_url.startsWith('https://cdn.modrinth.com/') ? <img className="project-icon" src={p.icon_url} alt="" loading="lazy" onError={e => {
    e.currentTarget.style.visibility = 'hidden';
  }} /> : <div className="project-icon fallback-icon"><Package /></div>;
}
function CreateModal({
  close,
  versions,
  versionError,
  retry,
  onCreate,
  settings
}) {
  const [name, setName] = useState(''),
    [loader, setLoader] = useState('vanilla'),
    [loaderVersion, setLoaderVersion] = useState(''),
    [loaderReady, setLoaderReady] = useState(true),
    [version, setVersion] = useState(''),
    [color, setColor] = useState('moss'),
    [snapshots, setSnapshots] = useState(settings.snapshots),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  useEffect(() => {
    if (versions && !version) setVersion(versions.latest.release);
  }, [versions]);
  const submit = async e => {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      await onCreate({
        name,
        loader,
        loaderVersion,
        version,
        color
      });
    } catch (e) {
      setError(cleanError(e));
      setBusy(false);
    }
  };
  return <Modal wide title={t("Neue Instanz erstellen")} subtitle={t("Wähle einen Namen, die Spielversion und einen Modloader.")} close={() => {
    if (!busy) close();
  }} footer={<footer className="modal-footer"><button type="button" className="button secondary" onClick={close} disabled={busy}>{t("Abbrechen")}</button><button type="submit" className="button primary" disabled={busy || !name.trim() || !version || !loaderReady}>{busy ? <LoaderCircle className="spin" size={16} /> : <Plus size={17} />}{t(" Instanz erstellen")}</button></footer>} form={{
    onSubmit: submit
  }}><><div className="create-preview"><InstanceImage /><div><h3>{name || t("Neue Instanz")}</h3><p>{version || t("Version auswählen")} · {loaderName(loader)}</p><div className="color-picker" aria-label={t("Instanzfarbe")}>{['moss', 'clay', 'lake', 'plum'].map(c => <button type="button" aria-label={t("Farbe {0}", {
              0: c
            })} aria-pressed={color === c} key={c} className={`${c} ${color === c ? 'selected' : ''}`} onClick={() => setColor(c)}>{color === c && <Check size={13} />}</button>)}</div></div></div><label className="field">{t("Name der Instanz")}<input placeholder={t("Zum Beispiel: Meine Survival-Welt")} value={name} maxLength={40} required onChange={e => setName(e.target.value)} autoFocus /></label><label className="field">{t("Minecraft-Version")}<select required aria-label={t("Minecraft-Version")} value={version} onChange={e => {
          setVersion(e.target.value);
          setLoaderVersion('');
        }} disabled={!versions}><option value="">{versionError ? t("Versionen nicht verfügbar") : t("Versionen werden geladen …")}</option>{versions?.versions.filter(v => v.type === 'release' || snapshots).map(v => <option key={v.id} value={v.id}>{v.id}{v.id === versions.latest.release ? t(" · Neueste Version") : ''}{v.type === 'snapshot' ? ' · Snapshot' : ''}</option>)}</select></label>{versionError && <div className="form-error">{t(versionError)}<button type="button" className="text-button" onClick={retry}>{t("Erneut laden")}</button></div>}<label className="checkbox-label"><input type="checkbox" checked={snapshots} onChange={e => {
          setSnapshots(e.target.checked);
          if (!e.target.checked) setVersion(versions?.latest.release || '');
        }} />{t(" Snapshots anzeigen")}</label><LoaderPicker gameVersion={version} loader={loader} loaderVersion={loaderVersion} onChange={(l, v) => {
        setLoader(l);
        setLoaderVersion(v);
      }} onAvailability={setLoaderReady} /><p className="create-footnote"><ShieldCheck size={14} />{t(" Minecraft und Java werden beim ersten Start geladen.")}</p>{error && <p className="form-error" role="alert">{t(error)}</p>}</></Modal>;
}
function SettingsPage({
  data,
  notify,
  run,
  onAccount,
  updateState,
  onUpdateState,
  gameBusy,
  onLanguage
}) {
  const [settings, setSettings] = useState({
      ...data.settings
    }),
    [busy, setBusy] = useState(false);
  const update = (key, value) => setSettings(s => ({
    ...s,
    [key]: value
  }));
  const changed = Object.keys(settings).some(key => key !== 'language' && settings[key] !== data.settings[key]);
  const save = () => run(async () => {
    setBusy(true);
    try {
      await api.saveSettings({
        ...settings,
        language: getLocale()
      });
      notify(t("Deine Einstellungen sind gespeichert."));
    } finally {
      setBusy(false);
    }
  });
  return <><header className="page-header"><div><div className="eyebrow">{t("EINSTELLUNGEN")}</div><h1>{t("Launcher-Einstellungen")}<span className="heading-dot">.</span></h1><p>{t("Passe Java, Arbeitsspeicher und das Verhalten des Launchers an.")}</p></div><button className="button primary compact" disabled={!changed || busy} onClick={save}>{busy ? <LoaderCircle size={16} className="spin" /> : <Check size={17} />}{t(" Änderungen speichern")}</button></header><div className="settings-content"><section className="settings-section"><div className="settings-section-title"><UserRound size={20} /><div><h2>{t("Sprache & Oberfläche")}</h2><p>{t("Wähle die Sprache für den gesamten Launcher.")}</p></div></div><div className="setting-block language-setting"><label className="field">{t("Sprache")}<select aria-label={t("Sprache in den Einstellungen")} value={getLocale()} onChange={e => onLanguage(e.target.value)}><option value="de">Deutsch</option><option value="en">English</option></select></label><p>{t("Wird sofort übernommen und für den nächsten Start gespeichert.")}</p></div></section><UpdateSettings state={updateState} run={run} onState={onUpdateState} gameBusy={gameBusy} /><section className="settings-section"><div className="settings-section-title"><Cpu size={20} /><div><h2>{t("Leistung & Java")}</h2><p>{t("Arbeitsspeicher und Laufzeit für Minecraft.")}</p></div></div><div className="setting-block"><div className="setting-line"><label htmlFor="memory">{t("Arbeitsspeicher")}</label><span className="memory-value">{(settings.memory / 1024).toLocaleString(getLocale(), {
                minimumFractionDigits: 1,
                maximumFractionDigits: 1
              })} <small>GB</small></span></div><input id="memory" className="range" type="range" min="1024" max={Math.min(16384, Math.floor(data.totalMemory / 1024) * 1024)} step="512" value={settings.memory} onChange={e => update('memory', +e.target.value)} /><div className="range-labels"><span>1 GB</span><span>{Math.floor(data.totalMemory / 1024)}{t(" GB auf deinem PC verfügbar")}</span></div><p>{t("4 GB sind ein guter Anfang. Größere Mod-Sammlungen brauchen häufig 6–8 GB.")}</p></div><div className="setting-block"><label className="field">{t("Java-Laufzeit")}<div className="input-button"><input placeholder={t("Automatisch · passende Version herunterladen")} value={settings.javaPath} onChange={e => update('javaPath', e.target.value)} /><button className="button secondary compact" onClick={() => run(async () => {
                const p = await api.chooseJava();
                if (p) update('javaPath', p);
              })}><FolderOpen size={16} />{t(" Auswählen")}</button></div></label>{settings.javaPath && <button className="text-button" onClick={() => update('javaPath', '')}>{t("Wieder automatisch verwalten")}</button>}<p>{t("Der Launcher lädt die passende Eclipse-Temurin-Laufzeit automatisch, wenn sie fehlt.")}</p></div></section><section className="settings-section"><div className="settings-section-title"><Monitor size={20} /><div><h2>{t("Spiel & Launcher")}</h2><p>{t("Fenstergröße und Verhalten beim Spielen.")}</p></div></div><div className="setting-block"><span className="field-label">{t("Fenstergröße beim Start")}</span><div className="resolution-inputs"><label><input type="number" min="480" max="7680" value={settings.width} onChange={e => update('width', +e.target.value)} /> <span>{t("Breite")}</span></label><X size={15} /><label><input type="number" min="480" max="7680" value={settings.height} onChange={e => update('height', +e.target.value)} /><span>{t("Höhe")}</span></label><span>Pixel</span></div></div><Toggle title={t("Launcher beim Spielen minimieren")} text={t("Minimiert den Launcher, sobald Minecraft gestartet wurde.")} value={settings.minimizeOnLaunch} onChange={v => update('minimizeOnLaunch', v)} /><Toggle title={t("Discord-Aktivität anzeigen")} text={t("Zeigt im geöffneten Discord dein Hauptmenü oder die laufende Minecraft-Version.")} value={settings.discordRichPresence} onChange={v => update('discordRichPresence', v)} /><Toggle title={t("Snapshots anzeigen")} text={t("Experimentelle Minecraft-Versionen in der Versionsauswahl anbieten.")} value={settings.snapshots} onChange={v => update('snapshots', v)} /></section><section className="settings-section"><div className="settings-section-title"><ShieldCheck size={20} /><div><h2>{t("Sicherungen")}</h2><p>{t("Ein Schritt zurück, falls eine Änderung nicht passt.")}</p></div></div><Toggle title={t("Automatische Backups")} text={t("Sichert Spieldaten vor Mod-Installationen, Updates und Versionswechseln. Die letzten fünf automatischen Sicherungen bleiben erhalten; manuelle Backups werden nicht automatisch gelöscht.")} value={settings.autoBackup !== false} onChange={v => update('autoBackup', v)} /></section><AccountSettings data={data} onAccount={onAccount} /><section className="settings-section"><div className="settings-section-title"><FolderOpen size={20} /><div><h2>{t("Deine Dateien")}</h2><p>{t("Instanzen, Mods und Spielstände.")}</p></div></div><div className="setting-block folder-setting"><code>{data.root}</code><button className="button secondary compact" onClick={() => run(() => api.openFolder())}><FolderOpen size={15} />{t(" Ordner öffnen")}</button></div></section><div className="about-launcher"><Carrot /><div><h3>CarrotClientLauncher <span>v{data.appVersion} · Beta</span></h3><p>{t("Ein unabhängiges Community-Projekt. Nicht mit Mojang oder Microsoft verbunden.")}</p></div></div></div></>;
}
function Toggle({
  title,
  text,
  value,
  onChange
}) {
  return <div className="setting-block toggle-setting"><div><h3>{t(title)}</h3><p>{t(text)}</p></div><button role="switch" aria-label={t(title)} aria-checked={value} className={`toggle ${value ? 'on' : ''}`} onClick={() => onChange(!value)}><span /></button></div>;
}
