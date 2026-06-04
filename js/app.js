/* =========================================================
   ONDA — app.js
   PWA directory di radio in streaming. Nessun backend, nessun
   login, nessuna pubblicità, nessun tracciamento.
   ONDA NON ospita né registra audio: si limita a collegarsi a
   flussi pubblici (Radio Browser API + alcune radio demo).
   ========================================================= */

'use strict';

/* ---------------------------------------------------------
   CONFIG — modifica qui email di contatto e radio demo
   --------------------------------------------------------- */
const CONFIG = {
  // Email usata dal pulsante "segnala / richiedi rimozione".
  // >>> CAMBIALA con la tua email reale <<<
  contactEmail: 'info@alessandropezzali.it',

  // Endpoint Radio Browser (mirror pubblico). Nessuna chiave richiesta.
  rbBase: 'https://de1.api.radio-browser.info/json/stations/search?',

  // Radio demo / "in evidenza": tutte HTTPS e affidabili, usate anche
  // come fallback se l'API non risponde.
  demo: [
    { id:'kiss',  name:'Radio Kiss Kiss', genre:'Hit · Dance · IT', code:'KISS',  url:'https://kisskiss.fluidstream.eu/KissKiss.mp3' },
    { id:'rp',    name:'Radio Paradise',  genre:'Eclectic Mix',     code:'RP',    url:'https://stream.radioparadise.com/mp3-128' },
    { id:'rpmel', name:'RP Mellow Mix',   genre:'Mellow · Chill',   code:'RP',    url:'https://stream.radioparadise.com/mellow-128' },
    { id:'rprock',name:'RP Rock Mix',     genre:'Rock',             code:'RP',    url:'https://stream.radioparadise.com/rock-128' },
    { id:'groove',name:'Groove Salad',    genre:'Ambient · Downtempo', code:'SOMA', url:'https://ice1.somafm.com/groovesalad-128-mp3' },
    { id:'secret',name:'Secret Agent',    genre:'Lounge · Spy Jazz',   code:'SOMA', url:'https://ice1.somafm.com/secretagent-128-mp3' },
    { id:'lush',  name:'Lush',            genre:'Vocal · Chill',       code:'SOMA', url:'https://ice1.somafm.com/lush-128-mp3' },
    { id:'u80s',  name:'Underground 80s', genre:'Synth · New Wave',    code:'SOMA', url:'https://ice1.somafm.com/u80s-128-mp3' },
    { id:'indie', name:'Indie Pop Rocks', genre:'Indie · Alt',         code:'SOMA', url:'https://ice1.somafm.com/indiepop-128-mp3' },
    { id:'drone', name:'Drone Zone',      genre:'Atmospheric Ambient', code:'SOMA', url:'https://ice1.somafm.com/dronezone-128-mp3' }
  ],

  // Nazioni per il filtro (codice ISO → etichetta).
  countries: [
    ['', 'Tutte le nazioni'], ['IT','Italia'], ['US','USA'], ['GB','Regno Unito'],
    ['FR','Francia'], ['DE','Germania'], ['ES','Spagna'], ['NL','Paesi Bassi'],
    ['CH','Svizzera'], ['AT','Austria'], ['BE','Belgio'], ['PT','Portogallo'],
    ['IE','Irlanda'], ['CA','Canada'], ['BR','Brasile'], ['MX','Messico'],
    ['AR','Argentina'], ['JP','Giappone'], ['AU','Australia']
  ],

  // Generi rapidi (tag Radio Browser).
  genres: ['pop','rock','dance','jazz','classical','news','talk','chill','lounge',
           'hip hop','electronic','reggae','country','folk','metal','indie','80s','90s']
};

/* ---------------------------------------------------------
   STORAGE — localStorage con fallback in memoria
   (così non crasha in contesti dove lo storage è bloccato)
   --------------------------------------------------------- */
const Store = (() => {
  let ok = true;
  const mem = {};
  try { localStorage.setItem('__onda__', '1'); localStorage.removeItem('__onda__'); }
  catch (e) { ok = false; }
  return {
    get(key, def) {
      try {
        if (ok) { const v = localStorage.getItem(key); return v ? JSON.parse(v) : def; }
        return (key in mem) ? mem[key] : def;
      } catch (e) { return def; }
    },
    set(key, val) {
      try { if (ok) localStorage.setItem(key, JSON.stringify(val)); else mem[key] = val; }
      catch (e) { mem[key] = val; }
    }
  };
})();

/* ---------------------------------------------------------
   HELPERS
   --------------------------------------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));
const HTTPS = location.protocol === 'https:';
const isHls = (url) => /\.m3u8(\?|$)/i.test(url || '');
const isBlocked = (url) => HTTPS && /^http:/i.test(url || ''); // mixed content su HTTPS
const sameUrl = (a, b) => (a || '').trim() === (b || '').trim();

function toast(msg) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => t.classList.remove('show'), 2600);
}

// Ricava 1-2 sigle per il placeholder avatar.
function deriveCode(name) {
  const w = (name || 'Radio').replace(/[^\p{L}\p{N} ]/gu, '').trim().split(/\s+/);
  if (w.length === 1) return w[0].slice(0, 4).toUpperCase();
  return (w[0][0] + (w[1][0] || '')).toUpperCase();
}

/* ---------------------------------------------------------
   STATE
   --------------------------------------------------------- */
const State = {
  current: null,         // stazione corrente {id,name,genre,code,url,favicon}
  playing: false,
  favorites: Store.get('onda.favorites', []),
  recents: Store.get('onda.recents', [])
};

/* ---------------------------------------------------------
   AUDIO PLAYER (HTML5 + HLS + Media Session)
   --------------------------------------------------------- */
const audio = new Audio();
audio.preload = 'none';
let hls = null;
let pendingPlay = false;

const ICON_PLAY  = '<path d="M8 5v14l11-7z"/>';
const ICON_PAUSE = '<path d="M6 5h4v14H6zM14 5h4v14h-4z"/>';

function loadStream(url) {
  if (hls) { try { hls.destroy(); } catch (e) {} hls = null; }
  try { audio.pause(); } catch (e) {}
  audio.removeAttribute('src');
  audio.load();

  if (isHls(url)) {
    if (window.Hls && window.Hls.isSupported()) {
      hls = new window.Hls();
      hls.loadSource(url);
      hls.attachMedia(audio);
      hls.on(window.Hls.Events.MANIFEST_PARSED, () => { if (pendingPlay) doPlay(); });
      hls.on(window.Hls.Events.ERROR, (e, d) => { if (d && d.fatal) onError(); });
    } else if (audio.canPlayType('application/vnd.apple.mpegurl')) {
      audio.src = url; // Safari legge HLS nativamente
    } else {
      onError('Questo stream (HLS) non è supportato da questo browser');
      return;
    }
  } else {
    audio.src = url;
  }
}

function doPlay() {
  pendingPlay = false;
  const p = audio.play();
  if (p && p.catch) p.catch(() => setPlayerStatus('avvio bloccato — tocca di nuovo play', true));
}

function start() {
  setPlayerStatus('sintonizzazione…');
  if (hls) { pendingPlay = true; setTimeout(() => { if (pendingPlay) doPlay(); }, 1500); }
  else doPlay();
}

function playStation(st) {
  if (!st || !st.url) return;
  if (isBlocked(st.url)) {
    toast('Stream non riproducibile online (HTTP). Apri l\u2019app in locale per questa radio.');
    return;
  }
  State.current = st;
  updatePlayerUI();
  showPlayer(true);
  loadStream(st.url);
  start();
  updateMediaSession(st);
}

function togglePlay() {
  if (!State.current) {
    const first = CONFIG.demo.find(s => !isBlocked(s.url));
    if (first) playStation(first);
    return;
  }
  if (State.playing) audio.pause();
  else { loadStream(State.current.url); start(); }
}

function onError() {
  State.playing = false;
  setPlayerStatus('stream non raggiungibile — prova un\u2019altra radio', true);
  setIcons();
  markPlayingCards();
  toast('Questa radio non risponde in questo momento.');
}

audio.addEventListener('playing', () => {
  State.playing = true;
  setPlayerStatus('in onda · ' + (State.current ? State.current.name : ''));
  setIcons();
  $('#player').classList.add('live');
  markPlayingCards();
  if (State.current) addRecent(State.current);
});
audio.addEventListener('pause', () => {
  State.playing = false;
  setPlayerStatus('in pausa');
  setIcons();
  $('#player').classList.remove('live');
  markPlayingCards();
});
audio.addEventListener('waiting', () => setPlayerStatus('buffering…'));
audio.addEventListener('error', onError);

function updateMediaSession(st) {
  if (!('mediaSession' in navigator)) return;
  try {
    navigator.mediaSession.metadata = new MediaMetadata({
      title: st.name,
      artist: st.genre || 'ONDA',
      album: 'ONDA',
      artwork: [{ src: st.favicon || 'icons/icon-512.png', sizes: '512x512', type: 'image/png' }]
    });
    navigator.mediaSession.setActionHandler('play', () => togglePlay());
    navigator.mediaSession.setActionHandler('pause', () => audio.pause());
  } catch (e) { /* alcuni browser non supportano tutto */ }
}

/* ---------------------------------------------------------
   PLAYER UI (barra in basso)
   --------------------------------------------------------- */
function showPlayer(on) { $('#player').classList.toggle('show', !!on); }
function setIcons() {
  $('#barIcon').innerHTML = State.playing ? ICON_PAUSE : ICON_PLAY;
}
function setPlayerStatus(text) { $('#barStatus').textContent = text; }
function updatePlayerUI() {
  const st = State.current;
  if (!st) return;
  $('#barName').textContent = st.name;
  setPlayerStatus('in pausa');
  setIcons();
  // avatar
  const ava = $('#barAva');
  ava.innerHTML = '';
  if (st.favicon) {
    const img = new Image();
    img.src = st.favicon;
    img.onerror = () => { ava.textContent = st.code || deriveCode(st.name); };
    ava.appendChild(img);
  } else {
    ava.textContent = st.code || deriveCode(st.name);
  }
}

/* ---------------------------------------------------------
   PREFERITI & RECENTI
   --------------------------------------------------------- */
function isFav(st) { return State.favorites.some(f => sameUrl(f.url, st.url)); }
function toggleFav(st) {
  if (isFav(st)) {
    State.favorites = State.favorites.filter(f => !sameUrl(f.url, st.url));
    toast('Rimossa dai preferiti');
  } else {
    State.favorites.unshift(st);
    toast('Aggiunta ai preferiti');
  }
  Store.set('onda.favorites', State.favorites);
  renderFavorites();
  // aggiorna eventuali cuori visibili
  $$('.station').forEach(c => {
    if (c._st && sameUrl(c._st.url, st.url)) {
      const b = c.querySelector('.act.fav');
      if (b) b.classList.toggle('on', isFav(st));
    }
  });
}
function addRecent(st) {
  State.recents = State.recents.filter(r => !sameUrl(r.url, st.url));
  State.recents.unshift(st);
  if (State.recents.length > 24) State.recents.length = 24;
  Store.set('onda.recents', State.recents);
  renderRecents();
}

/* ---------------------------------------------------------
   RENDER stazioni
   --------------------------------------------------------- */
function stationCard(st) {
  const card = document.createElement('div');
  card.className = 'station';
  card._st = st;

  // avatar
  const ava = document.createElement('div');
  ava.className = 'avatar';
  if (st.favicon) {
    const img = new Image();
    img.src = st.favicon;
    img.alt = '';
    img.onerror = () => { ava.innerHTML = '<span>' + (st.code || deriveCode(st.name)) + '</span>'; };
    ava.appendChild(img);
  } else {
    ava.innerHTML = '<span>' + (st.code || deriveCode(st.name)) + '</span>';
  }

  // meta
  const meta = document.createElement('div');
  meta.className = 'meta';
  const nm = document.createElement('div');
  nm.className = 'nm';
  nm.appendChild(document.createTextNode(st.name));
  if (isBlocked(st.url)) { const b = document.createElement('span'); b.className = 'badge http'; b.textContent = 'HTTP'; nm.appendChild(b); }
  else if (isHls(st.url)) { const b = document.createElement('span'); b.className = 'badge hls'; b.textContent = 'HLS'; nm.appendChild(b); }
  const gn = document.createElement('div');
  gn.className = 'gn';
  gn.textContent = st.genre || '';
  meta.appendChild(nm); meta.appendChild(gn);

  // equalizer
  const eq = document.createElement('span');
  eq.className = 'eq';
  eq.innerHTML = '<i></i><i></i><i></i>';

  // actions: preferito + segnala
  const actions = document.createElement('div');
  actions.className = 'actions';
  const fav = document.createElement('button');
  fav.className = 'act fav' + (isFav(st) ? ' on' : '');
  fav.title = 'Preferito';
  fav.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21l7.8-7.5 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
  fav.addEventListener('click', (e) => { e.stopPropagation(); toggleFav(st); });
  const report = document.createElement('button');
  report.className = 'act report';
  report.title = 'Segnala / richiedi rimozione';
  report.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 22V4h13l-2 4 2 4H4"/></svg>';
  report.addEventListener('click', (e) => { e.stopPropagation(); reportStation(st); });
  actions.appendChild(fav); actions.appendChild(report);

  card.appendChild(ava);
  card.appendChild(meta);
  card.appendChild(eq);
  card.appendChild(actions);

  // tap sulla card → play / pausa se è quella corrente
  card.addEventListener('click', () => {
    if (State.current && sameUrl(State.current.url, st.url)) togglePlay();
    else playStation(st);
  });
  return card;
}

function renderList(container, stations, emptyMsg) {
  container.innerHTML = '';
  if (!stations.length) { container.innerHTML = '<div class="empty">' + emptyMsg + '</div>'; return; }
  stations.forEach(st => container.appendChild(stationCard(st)));
  markPlayingCards();
}
function markPlayingCards() {
  $$('.station').forEach(c => {
    const on = State.current && c._st && sameUrl(c._st.url, State.current.url);
    c.classList.toggle('active', !!on);
    c.classList.toggle('playing', !!on && State.playing);
  });
}

function renderHome() {
  renderList($('#homeDemo'), CONFIG.demo, 'Nessuna radio.');
  // anteprima recenti
  const recentPrev = State.recents.slice(0, 4);
  $('#homeRecentTitle').style.display = recentPrev.length ? 'flex' : 'none';
  renderList($('#homeRecent'), recentPrev, '');
}
function renderFavorites() {
  renderList($('#favList'), State.favorites,
    'Nessun preferito.<br>Tocca il <b>cuore</b> su una radio per aggiungerla qui.');
}
function renderRecents() {
  renderList($('#recentList'), State.recents,
    'Nessun ascolto recente.<br>Le radio che apri compaiono qui.');
}

/* ---------------------------------------------------------
   SEGNALA / RIMOZIONE (mailto precompilato)
   --------------------------------------------------------- */
function reportStation(st) {
  const subject = 'ONDA — segnalazione/rimozione: ' + st.name;
  const body =
    'Radio: ' + st.name + '\n' +
    'Stream: ' + st.url + '\n\n' +
    'Messaggio (es. stream non funzionante, richiesta di rimozione del collegamento):\n';
  location.href = 'mailto:' + CONFIG.contactEmail +
    '?subject=' + encodeURIComponent(subject) +
    '&body=' + encodeURIComponent(body);
}

/* ---------------------------------------------------------
   RICERCA — Radio Browser API
   --------------------------------------------------------- */
let activeGenre = '';

function normalize(d) {
  return {
    id: d.stationuuid || d.url_resolved || d.url,
    name: (d.name || 'Radio').trim(),
    genre: [d.country, (d.tags || '').split(',').slice(0, 2).join(' · ')].filter(Boolean).join(' · ') || (d.codec || ''),
    code: deriveCode(d.name),
    url: d.url_resolved || d.url,
    favicon: d.favicon && /^https:/i.test(d.favicon) ? d.favicon : ''
  };
}
function dedupe(arr) {
  const seen = new Set();
  return arr.filter(d => {
    const u = (d.url_resolved || d.url || '');
    if (!u || seen.has(u)) return false;
    seen.add(u); return true;
  });
}

async function rb(params) {
  const r = await fetch(CONFIG.rbBase + params, { headers: { 'Accept': 'application/json' } });
  return await r.json();
}

async function doSearch() {
  const name = $('#searchInput').value.trim();
  const country = $('#countrySelect').value;
  const tag = activeGenre;
  if (!name && !country && !tag) { toast('Scrivi un nome, scegli una nazione o un genere'); return; }

  const res = $('#searchResults');
  res.innerHTML = '<div class="empty">ricerca in corso…</div>';

  const q = [];
  if (name) q.push('name=' + encodeURIComponent(name));
  if (country) q.push('countrycode=' + encodeURIComponent(country));
  if (tag) q.push('tag=' + encodeURIComponent(tag));
  q.push('hidebroken=true', 'order=clickcount', 'reverse=true', 'limit=40');

  try {
    let data = dedupe(await rb(q.join('&')));
    // su HTTPS tieni solo stream riproducibili (https)
    if (HTTPS) data = data.filter(d => /^https:/i.test(d.url_resolved || d.url || ''));
    const stations = data.slice(0, 30).map(normalize);
    renderList(res, stations,
      'Nessuna radio ' + (HTTPS ? 'HTTPS ' : '') + 'trovata.<br>Prova un altro nome, nazione o genere.');
  } catch (e) {
    // fallback: mostra le demo se l'API non risponde
    renderList(res, CONFIG.demo, 'Ricerca non disponibile. Ecco alcune radio sempre attive.');
    toast('Servizio di ricerca non raggiungibile: mostro le radio demo.');
  }
}

/* ---------------------------------------------------------
   SLEEP TIMER
   --------------------------------------------------------- */
let sleepTimer = null, sleepEndsAt = 0, sleepTick = null;
function setSleep(minutes) {
  clearTimeout(sleepTimer); clearInterval(sleepTick);
  $$('.sleep .opt').forEach(o => o.classList.toggle('on', Number(o.dataset.min) === minutes));
  if (!minutes) { $('#sleepStatus').textContent = 'Timer spento.'; sleepEndsAt = 0; return; }
  sleepEndsAt = Date.now() + minutes * 60000;
  sleepTimer = setTimeout(() => {
    audio.pause(); $('#sleepStatus').textContent = 'Riproduzione fermata dal timer.';
    $$('.sleep .opt').forEach(o => o.classList.toggle('on', Number(o.dataset.min) === 0));
  }, minutes * 60000);
  const upd = () => {
    const left = Math.max(0, sleepEndsAt - Date.now());
    const m = Math.floor(left / 60000), s = Math.floor((left % 60000) / 1000);
    $('#sleepStatus').textContent = 'Si ferma tra ' + m + ':' + String(s).padStart(2, '0');
  };
  upd(); sleepTick = setInterval(upd, 1000);
}

/* ---------------------------------------------------------
   NAVIGAZIONE (viste + tab bar)
   --------------------------------------------------------- */
function showView(name) {
  $$('.view').forEach(v => v.classList.toggle('active', v.id === 'view-' + name));
  $$('.tab').forEach(t => t.classList.toggle('active', t.dataset.view === name));
  window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* ---------------------------------------------------------
   INIT
   --------------------------------------------------------- */
function buildFilters() {
  // nazioni
  const sel = $('#countrySelect');
  CONFIG.countries.forEach(([code, label]) => {
    const o = document.createElement('option'); o.value = code; o.textContent = label; sel.appendChild(o);
  });
  // generi
  const chips = $('#genreChips');
  CONFIG.genres.forEach(g => {
    const c = document.createElement('button');
    c.className = 'chip'; c.textContent = g;
    c.addEventListener('click', () => {
      if (activeGenre === g) { activeGenre = ''; c.classList.remove('on'); }
      else { activeGenre = g; $$('.chip').forEach(x => x.classList.remove('on')); c.classList.add('on'); }
      doSearch();
    });
    chips.appendChild(c);
  });
}

function bindUI() {
  // player bar
  $('#barBtn').addEventListener('click', togglePlay);
  $('#volume').addEventListener('input', e => { audio.volume = e.target.value / 100; });
  audio.volume = 0.85;

  // tab bar
  $$('.tab').forEach(t => t.addEventListener('click', () => showView(t.dataset.view)));
  // info (legale)
  $('#infoBtn').addEventListener('click', () => showView('info'));

  // ricerca
  $('#searchGo').addEventListener('click', doSearch);
  $('#searchInput').addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  // sleep timer
  $$('.sleep .opt').forEach(o => o.addEventListener('click', () => setSleep(Number(o.dataset.min))));
}

function initSplash() {
  const splash = $('#splash');
  const enter = () => splash.classList.add('hide');
  $('#enterBtn').addEventListener('click', enter);
  // qualsiasi primo tocco sblocca comunque (utile su iPhone)
  splash.addEventListener('click', enter);
}

function registerSW() {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('service-worker.js').catch(() => {});
    });
  }
}

function init() {
  buildFilters();
  bindUI();
  // collega il link di contatto (sezione Termini) all'email configurata
  const c = $('#contactLink');
  if (c) c.href = 'mailto:' + CONFIG.contactEmail;
  renderHome();
  renderFavorites();
  renderRecents();
  initSplash();
  registerSW();
  showView('home');
}
document.addEventListener('DOMContentLoaded', init);
