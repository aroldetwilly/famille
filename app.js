// =====================================================================
//  APPLICATION FAMILLE — interface
// =====================================================================
import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

const APP_VERSION = 'v4 · accueil tâches';
const C = window.FAMILLE_CONFIG || {};
const $ = (s) => document.querySelector(s);
const app = $('#app');
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const store = {
  get: (k) => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch {} },
};

if (!C.SUPABASE_URL || C.SUPABASE_URL.includes('XXXX')) {
  app.innerHTML = `<div class="login"><h1>Famille</h1><p class="muted">Configuration manquante : remplis le fichier <b>config.js</b> (étape 4 du guide).</p></div>`;
  throw new Error('config');
}

// Ne garder que https://xxxx.supabase.co (enlève /rest/v1/, / final, espaces…)
try { C.SUPABASE_URL = new URL(C.SUPABASE_URL.trim()).origin; } catch {}
C.SUPABASE_KEY = String(C.SUPABASE_KEY || '').trim();
C.FAMILY_EMAIL = String(C.FAMILY_EMAIL || '').trim().toLowerCase();
const sb = createClient(C.SUPABASE_URL, C.SUPABASE_KEY);
const FN = `${C.SUPABASE_URL}/functions/v1/famille`;

// ---------------------------------------------------------------------
//  Constantes
// ---------------------------------------------------------------------
const SHOP_CATS = ['Fruits & légumes', 'Frais', 'Boucherie & poisson', 'Boulangerie', 'Épicerie', 'Surgelés', 'Boissons',
  'Hygiène & beauté', 'Maison & entretien', 'Pharmacie', 'Animaux', 'Autre'];
const DOC_CATS = ['Carte grise', 'Ordonnance', 'Identité', 'Assurance', 'Santé', 'École', 'Autre'];
const MAINT_KINDS = ['Contrôle technique', 'Vidange', 'Révision', 'Pneus', 'Assurance', 'Autre'];
const REMIND_OPTS = [
  { v: '', l: 'Pas de rappel' }, { v: '60', l: '1 heure avant' }, { v: '180', l: '3 heures avant' },
  { v: '1440', l: 'La veille (24 h avant)' }, { v: '2880', l: '2 jours avant' }, { v: '10080', l: '1 semaine avant' },
];
const ICONS = {
  accueil: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h14V10"/>',
  agenda: '<rect x="3.5" y="5" width="17" height="15" rx="2"/><path d="M3.5 10h17M8 3v4M16 3v4"/>',
  courses: '<path d="M3 4h2l2.2 11h10.6L20 8H6.2"/><circle cx="9" cy="19.5" r="1.3"/><circle cx="17" cy="19.5" r="1.3"/>',
  taches: '<rect x="4" y="4" width="16" height="16" rx="3"/><path d="m8.5 12 2.5 2.5 4.5-5"/>',
  plus: '<circle cx="5" cy="12" r="1.4"/><circle cx="12" cy="12" r="1.4"/><circle cx="19" cy="12" r="1.4"/>',
};
const TABS = [['accueil', 'Accueil'], ['agenda', 'Agenda'], ['courses', 'Courses'], ['taches', 'Tâches'], ['plus', 'Plus']];
const SUBPAGES = { factures: 'Factures', vehicules: 'Véhicules', documents: 'Documents', famille: 'Où êtes-vous ?', reglages: 'Réglages' };

// ---------------------------------------------------------------------
//  État
// ---------------------------------------------------------------------
const S = {
  session: null,
  me: store.get('me'),
  tab: 'accueil',
  D: { members: [], appointments: [], bills: [], vehicles: [], maintenance: [], documents: [], shopping: [], chores: [], chore_log: [], chore_plan: [], locations: [], settings: [] },
  urls: {},          // liens signés des fichiers
  showPast: false,
  shopCat: store.get('shopCat') || 'Épicerie',
  week: null,        // lundi de la semaine affichée (AAAA-MM-JJ)
};
const member = (id) => S.D.members.find((m) => m.id === id);
const nameOf = (id) => member(id)?.name || id || '?';
const names = (ids) => (ids || []).map(nameOf).join(' & ');
const initial = (id) => (nameOf(id)[0] || '?').toUpperCase();
const setting = (k) => S.D.settings.find((s) => s.key === k)?.value;

// ---------------------------------------------------------------------
//  Dates
// ---------------------------------------------------------------------
const todayStr = () => { const d = new Date(); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const addDays = (s, n) => { const d = new Date(s + 'T12:00:00'); d.setDate(d.getDate() + n); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const daysUntil = (s) => Math.round((new Date(s + 'T12:00:00') - new Date(todayStr() + 'T12:00:00')) / 86400000);
const fmt = (d, o) => new Intl.DateTimeFormat('fr-FR', o).format(d);
const fmtDT = (iso) => fmt(new Date(iso), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
const fmtTime = (iso) => fmt(new Date(iso), { hour: '2-digit', minute: '2-digit' });
const fmtDay = (s) => fmt(new Date(s + 'T12:00:00'), { weekday: 'short', day: 'numeric', month: 'short' });
const fmtDayLong = (iso) => fmt(new Date(iso), { weekday: 'long', day: 'numeric', month: 'long' });
const ago = (iso) => {
  const m = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (m < 1) return "à l'instant"; if (m < 60) return `il y a ${m} min`;
  const h = Math.round(m / 60); if (h < 24) return `il y a ${h} h`;
  return `le ${fmtDT(iso)}`;
};
const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16); };
const euro = (n) => n == null || n === '' ? '' : Number(n).toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' });
const dueTag = (d) => d < 0 ? `<span class="tag danger">en retard</span>` : d === 0 ? `<span class="tag danger">aujourd'hui</span>`
  : d <= 7 ? `<span class="tag warn">dans ${d} j</span>` : `<span class="tag">dans ${d} j</span>`;

// ---------------------------------------------------------------------
//  Petits outils d'interface
// ---------------------------------------------------------------------
let toastTimer;
function toast(msg) {
  const t = $('#toast'); t.textContent = msg; t.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => (t.hidden = true), 2600);
}
function closeModal() { const m = $('#modal'); m.hidden = true; m.innerHTML = ''; }
$('#modal').addEventListener('click', (e) => { if (e.target.id === 'modal' || e.target.closest('[data-close]')) closeModal(); });

function openSheet(title, html) {
  const m = $('#modal');
  m.innerHTML = `<div class="sheet"><div class="sheet-h"><b>${esc(title)}</b><button class="x" data-close aria-label="Fermer">✕</button></div>${html}</div>`;
  m.hidden = false;
  return m.querySelector('.sheet');
}

function fieldHtml(f, v) {
  const id = 'f_' + f.k;
  const lab = (inner) => `<label class="f"><span>${esc(f.label)}</span>${inner}</label>`;
  const opts = (f.options || []).map((o) => typeof o === 'string' ? { v: o, l: o } : o);
  switch (f.type) {
    case 'textarea': return lab(`<textarea id="${id}" name="${f.k}">${esc(v)}</textarea>`);
    case 'select': return lab(`<select id="${id}" name="${f.k}">${opts.map((o) => `<option value="${esc(o.v)}" ${String(v ?? '') === String(o.v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`);
    case 'datetime': return lab(`<input type="datetime-local" id="${id}" name="${f.k}" value="${esc(toLocalInput(v))}" ${f.required ? 'required' : ''}>`);
    case 'date': return lab(`<input type="date" id="${id}" name="${f.k}" value="${esc(v || '')}" ${f.required ? 'required' : ''}>`);
    case 'time': return lab(`<input type="time" id="${id}" name="${f.k}" value="${esc(v || '')}">`);
    case 'number': return lab(`<input type="number" inputmode="decimal" step="${f.step || 'any'}" id="${id}" name="${f.k}" value="${esc(v ?? '')}" placeholder="${esc(f.placeholder || '')}">`);
    case 'file': return lab(`<input type="file" id="${id}" name="${f.k}" accept="image/*,application/pdf" ${f.required ? 'required' : ''}>${f.hint ? `<span class="small muted">${esc(f.hint)}</span>` : ''}`);
    case 'checks': return `<div class="f" style="margin-bottom:12px"><span class="small muted" style="display:block;margin-bottom:6px">${esc(f.label)}</span><div class="chips">${opts.map((o) =>
      `<label><input type="checkbox" name="${f.k}" value="${esc(o.v)}" ${(v || []).includes(o.v) ? 'checked' : ''}> ${esc(o.l)}</label>`).join('')}</div></div>`;
    case 'checkbox': return `<div class="chips" style="margin-bottom:12px"><label><input type="checkbox" name="${f.k}" ${v ? 'checked' : ''}> ${esc(f.label)}</label></div>`;
    default: return lab(`<input type="text" id="${id}" name="${f.k}" value="${esc(v ?? '')}" placeholder="${esc(f.placeholder || '')}" ${f.required ? 'required' : ''} autocomplete="off">`);
  }
}

function openForm({ title, fields, values = {}, onSave, onDelete, saveLabel = 'Enregistrer' }) {
  const sheet = openSheet(title, `<form>${fields.map((f) => fieldHtml(f, values[f.k])).join('')}
    <div class="row gap"><button class="btn primary" type="submit" style="flex:1">${esc(saveLabel)}</button>
    ${onDelete ? '<button type="button" class="btn danger" data-del>Supprimer</button>' : ''}</div></form>`);
  const form = sheet.querySelector('form');
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const out = {};
    for (const f of fields) {
      if (f.type === 'checks') out[f.k] = [...form.querySelectorAll(`[name="${f.k}"]:checked`)].map((i) => i.value);
      else if (f.type === 'checkbox') out[f.k] = form.querySelector(`[name="${f.k}"]`).checked;
      else if (f.type === 'file') out[f.k] = form.querySelector(`[name="${f.k}"]`).files[0] || null;
      else {
        const raw = form.querySelector(`[name="${f.k}"]`).value.trim();
        if (f.type === 'number') out[f.k] = raw === '' ? null : Number(raw.replace(',', '.'));
        else if (f.type === 'datetime') out[f.k] = raw ? new Date(raw).toISOString() : null;
        else out[f.k] = raw === '' ? null : raw;
      }
    }
    const btn = form.querySelector('[type=submit]'); btn.disabled = true; btn.textContent = 'Enregistrement…';
    try { await onSave(out); closeModal(); }
    catch (err) { console.error(err); alert('Erreur : ' + (err.message || err)); btn.disabled = false; btn.textContent = saveLabel; }
  });
  form.querySelector('[data-del]')?.addEventListener('click', async () => {
    if (!confirm('Supprimer définitivement ?')) return;
    try { await onDelete(); closeModal(); } catch (err) { alert('Erreur : ' + err.message); }
  });
  setTimeout(() => form.querySelector('input[type=text],textarea')?.focus({ preventScroll: true }), 50);
}

function ask(title, choices) {          // petite feuille de choix -> Promise
  return new Promise((resolve) => {
    const sheet = openSheet(title, `<div class="choice">${choices.map((c, i) =>
      `<button class="btn block ${c.primary ? 'primary' : ''}" data-i="${i}">${esc(c.label)}</button>`).join('')}</div>`);
    sheet.addEventListener('click', (e) => {
      const b = e.target.closest('[data-i]'); if (!b) return;
      closeModal(); resolve(choices[+b.dataset.i].value);
    });
  });
}

// ---------------------------------------------------------------------
//  Données
// ---------------------------------------------------------------------
const ORDER = { members: 'sort', appointments: 'starts_at', bills: 'due_date', vehicles: 'sort', maintenance: 'due_date', documents: 'created_at', shopping: 'created_at', chores: 'sort' };
async function load(t) {
  let q = sb.from(t).select('*');
  if (t === 'chore_log') q = q.gte('day', planRange()[0]).lte('day', planRange()[1]).limit(1000);
  else if (t === 'chore_plan') q = q.gte('day', planRange()[0]).lte('day', planRange()[1]).limit(2000);
  else if (ORDER[t]) q = q.order(ORDER[t], { ascending: true, nullsFirst: false });
  const { data, error } = await q;
  if (error) { console.warn(t, error.message); return; }
  S.D[t] = data;
}
const loadAll = () => Promise.all(Object.keys(S.D).map(load));

async function db(promise) {
  const { data, error } = await promise;
  if (error) throw error;
  return data;
}

async function notify(payload) {
  try {
    const { data: { session } } = await sb.auth.getSession();
    const r = await fetch(FN + '?action=notify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token, apikey: C.SUPABASE_KEY },
      body: JSON.stringify(payload),
    });
    return await r.json();
  } catch (e) { console.warn('notify', e); return { error: e.message }; }
}
async function callFn(action, opts = {}) {
  const { data: { session } } = await sb.auth.getSession();
  const r = await fetch(`${FN}?action=${action}`, {
    method: opts.body ? 'POST' : 'GET',
    headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + session.access_token, apikey: C.SUPABASE_KEY },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  return r.json();
}

async function upload(file) {
  const clean = file.name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\w.\-]+/g, '_');
  const path = `${crypto.randomUUID()}/${clean}`;
  const { error } = await sb.storage.from('docs').upload(path, file, { contentType: file.type || undefined });
  if (error) throw error;
  return path;
}
async function ensureUrls(paths) {
  const need = paths.filter((p) => p && !(S.urls[p] && S.urls[p].exp > Date.now()));
  if (!need.length) return false;
  const { data } = await sb.storage.from('docs').createSignedUrls(need, 3600);
  for (const d of data || []) if (d.signedUrl) S.urls[d.path] = { url: d.signedUrl, exp: Date.now() + 50 * 60000 };
  return true;
}
const fileLink = (p, label = 'Ouvrir le fichier') => S.urls[p] ? `<a class="btn sm" href="${esc(S.urls[p].url)}" target="_blank" rel="noopener">📎 ${esc(label)}</a>` : '';

// ---------------------------------------------------------------------
//  Notifications push (abonnement)
// ---------------------------------------------------------------------
const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
const isStandalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
const pushSupported = 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;

function b64uToU8(s) {
  s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '=';
  return Uint8Array.from(atob(s), (c) => c.charCodeAt(0));
}
async function subscribePush(interactive) {
  if (!pushSupported) {
    if (interactive) alert(isIOS ? "Sur iPhone : ouvre l'appli depuis l'icône de l'écran d'accueil (Safari > Partager > Sur l'écran d'accueil), puis réessaie." : 'Ce navigateur ne gère pas les notifications. Utilise Chrome.');
    return false;
  }
  if (Notification.permission !== 'granted') {
    if (!interactive) return false;
    const p = await Notification.requestPermission();
    if (p !== 'granted') { alert("Notifications refusées. Active-les dans les réglages du téléphone pour l'appli Famille."); return false; }
  }
  const reg = await navigator.serviceWorker.ready;
  const { publicKey } = await (await fetch(FN + '?action=vapid')).json();
  let sub = await reg.pushManager.getSubscription();
  if (sub && store.get('vapid') && store.get('vapid') !== publicKey) { await sub.unsubscribe(); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: b64uToU8(publicKey) });
  store.set('vapid', publicKey);
  const j = sub.toJSON();
  await db(sb.from('push_subscriptions').upsert({ endpoint: j.endpoint, member_id: S.me, p256dh: j.keys.p256dh, auth: j.keys.auth, user_agent: navigator.userAgent.slice(0, 200) }));
  store.set('pushOk', '1');
  return true;
}

// ---------------------------------------------------------------------
//  Localisation
// ---------------------------------------------------------------------
async function shareLocation(requester) {
  if (!navigator.geolocation) return alert("La localisation n'est pas disponible sur ce téléphone.");
  toast('📍 Recherche de ta position…');
  navigator.geolocation.getCurrentPosition(async (pos) => {
    let battery = null;
    try { if (navigator.getBattery) battery = Math.round((await navigator.getBattery()).level * 100); } catch {}
    await db(sb.from('locations').upsert({
      member_id: S.me, lat: pos.coords.latitude, lng: pos.coords.longitude,
      accuracy: pos.coords.accuracy, battery, updated_at: new Date().toISOString(),
    }));
    toast('📍 Position partagée');
    notify({
      to: requester ? [requester] : 'all', exclude: [S.me],
      title: `📍 ${nameOf(S.me)} a partagé sa position`,
      body: battery != null ? `Batterie : ${battery} %` : 'Touche pour voir la carte', url: './?tab=famille',
    });
    await load('locations'); render();
  }, (err) => alert('Position impossible : ' + (err.code === 1 ? "autorise la localisation pour l'appli dans les réglages du téléphone." : err.message)),
  { enableHighAccuracy: true, timeout: 20000, maximumAge: 30000 });
}

let leafletLoading;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  return leafletLoading ||= new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet';
    css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}
async function drawMap() {
  const el = $('#map'); if (!el) return;
  const pts = S.D.locations.filter((l) => l.lat != null);
  if (!pts.length) { el.innerHTML = '<p class="empty" style="padding:16px">Aucune position partagée pour l\'instant.</p>'; return; }
  await loadLeaflet();
  const map = L.map(el, { zoomControl: false, attributionControl: true });
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© OpenStreetMap' }).addTo(map);
  const bounds = [];
  for (const p of pts) {
    const icon = L.divIcon({ className: '', html: `<div class="avatar" style="background:var(--card)">${esc(initial(p.member_id))}</div>`, iconSize: [34, 34], iconAnchor: [17, 17] });
    L.marker([p.lat, p.lng], { icon }).addTo(map).bindPopup(`<b>${esc(nameOf(p.member_id))}</b><br>${esc(ago(p.updated_at))}${p.battery != null ? `<br>🔋 ${p.battery} %` : ''}`);
    bounds.push([p.lat, p.lng]);
  }
  if (bounds.length === 1) map.setView(bounds[0], 15); else map.fitBounds(bounds, { padding: [40, 40] });
}

// ---------------------------------------------------------------------
//  Rendu
// ---------------------------------------------------------------------
function render() {
  if (!S.session) return renderLogin();
  if (!S.me || !member(S.me)) return renderWho();
  const isSub = !!SUBPAGES[S.tab];
  const title = isSub ? SUBPAGES[S.tab] : TABS.find((t) => t[0] === S.tab)?.[1];
  const activeTab = isSub ? 'plus' : S.tab;
  const scrollY = window.scrollY;
  app.innerHTML = `
    <header class="top">${isSub ? '<button class="back" data-act="go" data-tab="plus" aria-label="Retour">‹</button>' : ''}<h1>${esc(title)}</h1>
      <div class="avatar" data-act="go" data-tab="reglages" style="cursor:pointer" title="${esc(nameOf(S.me))}">${esc(initial(S.me))}</div></header>
    <main>${(VIEWS[S.tab] || VIEWS.accueil)()}</main>
    <nav class="tabs">${TABS.map(([k, l]) => `<button class="${k === activeTab ? 'on' : ''}" data-act="go" data-tab="${k}">
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">${ICONS[k]}</svg>${l}</button>`).join('')}</nav>`;
  if (S.keepScroll) window.scrollTo(0, scrollY);
  S.keepScroll = false;
  AFTER[S.tab]?.();
}
const rerender = () => { S.keepScroll = true; render(); };

function renderLogin() {
  app.innerHTML = `<div class="login"><h1>Famille</h1><p class="muted">Connexion à faire une seule fois sur ce téléphone.</p>
    <form id="loginForm" style="margin-top:24px">
      <label class="f" style="text-align:left"><span>Mot de passe de la famille</span><input type="password" name="pw" required autocomplete="current-password"></label>
      <button class="btn primary block" type="submit">Se connecter</button></form>
    ${isIOS && !isStandalone ? `<div class="notice" style="margin-top:20px;text-align:left"><b>📱 iPhone : installe d'abord l'appli</b>Touche <b>Partager</b> (carré avec flèche) puis <b>Sur l'écran d'accueil</b>. Ouvre ensuite l'appli depuis son icône et connecte-toi là.</div>` : ''}</div>`;
  $('#loginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true;
    const { error } = await sb.auth.signInWithPassword({ email: C.FAMILY_EMAIL, password: e.target.pw.value });
    if (error) {
      const m = error.message || String(error);
      const why = /invalid login/i.test(m) ? `Mot de passe incorrect, ou e-mail du config.js (${C.FAMILY_EMAIL}) différent du compte Supabase.`
        : /not confirmed/i.test(m) ? 'Compte non confirmé : dans Supabase > Authentication > Users, confirme l\'utilisateur.'
        : /api key|apikey|jwt/i.test(m) ? 'Clé SUPABASE_KEY incorrecte dans config.js.'
        : /fetch|network|load failed/i.test(m) ? 'Impossible de joindre Supabase : vérifie SUPABASE_URL dans config.js.'
        : '';
      alert(`Connexion impossible.\n${why}\n\nDétail : ${m}`);
      btn.disabled = false;
    }
  });
}

function renderWho() {
  app.innerHTML = `<div class="login"><h1>Qui es-tu ?</h1><p class="muted">Pour savoir à qui envoyer les notifications.</p>
    <div class="who">${S.D.members.map((m) => `<button data-act="iam" data-id="${m.id}"><div class="avatar lg">${esc(m.name[0])}</div><b>${esc(m.name)}</b><span class="small muted">${esc(m.role || '')}</span></button>`).join('')}</div>
    ${S.D.members.length ? '' : '<p class="muted" style="margin-top:20px">Aucun membre trouvé : vérifie que le fichier 1-base.sql a bien été exécuté et que ton e-mail est dans 2-reglages.sql.</p>'}</div>`;
}

// ---------- Vues ----------

function apptItem(a) {
  const d = new Date(a.starts_at);
  return `<div class="item tap" data-act="editAppt" data-id="${a.id}">
    <div class="date-badge"><b>${d.getDate()}</b><span>${esc(fmt(d, { month: 'short' }).replace('.', ''))}</span></div>
    <div class="grow"><div class="t">${esc(a.title)}</div>
    <div class="s">${a.member_id ? esc(nameOf(a.member_id)) + ' · ' : ''}${esc(fmtTime(a.starts_at))}${a.location ? ' · ' + esc(a.location) : ''}</div>
    ${a.comment ? `<div class="s">${esc(a.comment)}</div>` : ''}</div>${a.file_path ? '📎' : ''}</div>`;
}
function billItem(b) {
  return `<div class="item ${b.paid ? 'done' : ''}">
    <div class="grow tap" data-act="editBill" data-id="${b.id}"><div class="t">${esc(b.title)} ${b.amount != null ? `· ${esc(euro(b.amount))}` : ''}</div>
    <div class="s">${b.paid ? `Payée par ${esc(nameOf(b.paid_by))} le ${esc(fmtDT(b.paid_at))}` : `Avant le ${esc(fmtDay(b.due_date))} ${dueTag(daysUntil(b.due_date))}`}</div>
    ${b.comment ? `<div class="s">${esc(b.comment)}</div>` : ''}</div>
    ${b.paid ? '' : `<button class="btn sm" data-act="payBill" data-id="${b.id}">Payée</button>`}</div>`;
}
// ---------- Planning des tâches ----------
const DAY_LETTERS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'];
const DAY_NAMES = ['Lundi', 'Mardi', 'Mercredi', 'Jeudi', 'Vendredi', 'Samedi', 'Dimanche'];
const isParent = () => member(S.me)?.parent ?? ['ronald', 'laet'].includes(S.me);
const mondayOf = (s) => addDays(s, -((new Date(s + 'T12:00:00').getDay() + 6) % 7));
const curMonday = () => mondayOf(todayStr());
const weekDays = (mon) => [0, 1, 2, 3, 4, 5, 6].map((i) => addDays(mon, i));
const weekIndex = (mon) => Math.round((Date.parse(mon + 'T12:00:00Z') - Date.parse('2024-01-01T12:00:00Z')) / (7 * 86400000));
function planRange() {
  const a = curMonday(), b = S.week || a;
  return [a < b ? a : b, addDays(a > b ? a : b, 6)];
}
const planCell = (choreId, day) => S.D.chore_plan.find((p) => p.chore_id === choreId && p.day === day);
const planDone = (choreId, day) => S.D.chore_log.find((l) => l.chore_id === choreId && l.day === day);
const choreDays = (c) => (c.days?.length ? c.days : [1, 2, 3, 4, 5, 6, 7]).map(Number).sort();

// Qui fait la tâche c tel jour selon la rotation (déterministe : pas besoin de mémoriser un « tour »)
function rotationFor(c, day) {
  const people = S.D.members.map((m) => m.id).filter((id) => (c.assignees || []).includes(id));
  if (!people.length) return [];
  if (c.allow_duo && people.length > 1) return people;
  const days = choreDays(c);
  const wd = (new Date(day + 'T12:00:00').getDay() + 6) % 7 + 1;
  const k = days.indexOf(wd);
  const ci = Math.max(0, S.D.chores.findIndex((x) => x.id === c.id));
  return [people[(weekIndex(mondayOf(day)) * days.length + k + ci) % people.length]];
}
function generatedRows(c, mon, fromDay) {
  return weekDays(mon).filter((d, i) => d >= fromDay && choreDays(c).includes(i + 1))
    .map((day) => ({ chore_id: c.id, day, assignees: rotationFor(c, day) })).filter((r) => r.assignees.length);
}
// Remplit automatiquement une semaine (actuelle ou future) pour les tâches qui n'ont encore rien
async function ensureWeek(mon) {
  if (mon < curMonday()) return false;
  const days = weekDays(mon), from = mon === curMonday() ? todayStr() : mon;
  const rows = S.D.chores.filter((c) => !S.D.chore_plan.some((p) => p.chore_id === c.id && days.includes(p.day)))
    .flatMap((c) => generatedRows(c, mon, from));
  if (!rows.length) return false;
  await sb.from('chore_plan').upsert(rows, { onConflict: 'chore_id,day', ignoreDuplicates: true });
  await load('chore_plan');
  return true;
}
const initials = (ids) => ids.map(initial).join('+');
const isParentId = (id) => member(id)?.parent ?? ['ronald', 'laet'].includes(id);
function todayItem(c, p) {
  const done = planDone(c.id, p.day);
  const others = p.assignees.filter((a) => a !== S.me);
  const sub = done
    ? `Fait${done.done_by.length === 1 && done.done_by[0] !== S.me ? ' par ' + esc(nameOf(done.done_by[0])) : ''} à ${esc(fmtTime(done.done_at))}`
    : others.length ? `Avec ${esc(names(others))}` : 'Seul(e)';
  return `<div class="item ${done ? 'done' : ''}"><div class="grow"><div class="t">${esc(c.name)}</div><div class="s">${sub}</div></div>
    ${done ? `<button class="check-done" data-act="planUndo" data-chore="${c.id}" data-day="${p.day}" aria-label="Fait (toucher pour annuler)">✓</button>`
      : `<button class="btn sm primary" data-act="planDo" data-chore="${c.id}" data-day="${p.day}">À faire</button>`}</div>`;
}
const bar = (n, total, cls = '') => `<div class="bar ${cls}"><i style="width:${total ? Math.round((100 * n) / total) : 0}%"></i></div>`;
function myTasksCard() {
  const mine = todayPlan().filter(([, p]) => p.assignees.includes(S.me));
  if (!mine.length) return isParentId(S.me) ? '' : `<div class="mytasks"><div class="head"><b>Mes tâches du jour</b></div><p class="empty" style="padding:4px 14px 14px">Rien à faire aujourd'hui 🎉</p></div>`;
  const done = mine.filter(([c, p]) => planDone(c.id, p.day)).length;
  const all = done === mine.length;
  return `<div class="mytasks"><div class="head"><b>Mes tâches du jour</b><span>${done} sur ${mine.length}${mine.length > 1 ? '' : ''}</span></div>
    ${bar(done, mine.length)}${mine.map(([c, p]) => todayItem(c, p)).join('')}
    ${all ? '<div class="item"><div class="grow t" style="text-align:center">🎉 Tout est fait, bravo !</div></div>' : ''}</div>`;
}
function kidsCard() {
  if (!isParentId(S.me)) return '';
  const tp = todayPlan();
  const rows = S.D.members.filter((m) => !isParentId(m.id)).map((m) => {
    const t = tp.filter(([, p]) => p.assignees.includes(m.id));
    const left = t.filter(([c, p]) => !planDone(c.id, p.day));
    return { m, total: t.length, done: t.length - left.length, left };
  });
  const total = rows.reduce((a, r) => a + r.total, 0), done = rows.reduce((a, r) => a + r.done, 0);
  return `<div class="mytasks"><div class="head"><b>Les enfants aujourd'hui</b><span>${done} sur ${total}</span></div>
    ${rows.map((r) => `<div class="item kid"><div class="avatar">${esc(r.m.name[0])}</div><div class="grow">
      <div class="row" style="justify-content:space-between"><span class="t">${esc(r.m.name)}</span><span class="s">${r.done} / ${r.total}</span></div>
      ${bar(r.done, r.total, 'sm')}
      <div class="s">${!r.total ? 'Rien de prévu aujourd\'hui' : r.left.length ? 'Reste : ' + esc(r.left.map(([c]) => c.name).join(', ')) : 'Tout est fait ✅'}</div></div></div>`).join('')}
    <div class="item tap" data-act="go" data-tab="taches"><div class="grow"><div class="s">Voir le planning de la semaine</div></div>›</div></div>`;
}
const todayPlan = () => S.D.chores.map((c) => [c, planCell(c.id, todayStr())]).filter(([, p]) => p && p.assignees.length);

function maintItem(m, withVehicle) {
  const v = S.D.vehicles.find((x) => x.id === m.vehicle_id);
  return `<div class="item"><div class="grow tap" data-act="editMaint" data-id="${m.id}">
    <div class="t">${withVehicle ? esc(v?.name || '') + ' · ' : ''}${esc(m.kind)}</div>
    <div class="s">${m.due_date ? `Le ${esc(fmtDay(m.due_date))} ${dueTag(daysUntil(m.due_date))}` : 'Sans date'}${m.km_target ? ` · vers ${m.km_target.toLocaleString('fr-FR')} km` : ''}</div>
    ${m.comment ? `<div class="s">${esc(m.comment)}</div>` : ''}</div>
    <button class="btn sm" data-act="maintDone" data-id="${m.id}">Fait</button></div>`;
}

const VIEWS = {
  accueil() {
    const now = Date.now();
    const notices = [];
    if (isIOS && !isStandalone) notices.push(`<div class="notice"><b>📱 Installe l'appli sur l'écran d'accueil</b>Dans Safari : Partager → « Sur l'écran d'accueil ». Indispensable pour les notifications sur iPhone.</div>`);
    else if (pushSupported && (Notification.permission !== 'granted' || !store.get('pushOk')))
      notices.push(`<div class="notice"><b>🔔 Active les notifications</b>Pour recevoir les rappels, les courses, les tâches faites et les alertes bus.<div class="row gap"><button class="btn primary" data-act="enablePush">Activer</button></div></div>`);

    const appts = S.D.appointments.filter((a) => Date.parse(a.starts_at) > now - 3600000).slice(0, 4);
    const bills = S.D.bills.filter((b) => !b.paid && daysUntil(b.due_date) <= 30);
    const maint = S.D.maintenance.filter((m) => !m.done && m.due_date && daysUntil(m.due_date) <= 45);
    const shop = S.D.shopping.filter((s) => !s.done).length;
    const hello = new Date().getHours() < 18 ? 'Bonjour' : 'Bonsoir';
    return `${notices.join('')}
      <p style="margin:2px 0 4px;font-size:20px;font-weight:600">${hello} ${esc(nameOf(S.me))} 👋</p>
      <p class="muted" style="margin:0 0 6px">${esc(fmtDayLong(new Date().toISOString()))}</p>
      ${myTasksCard()}${kidsCard()}
      <h2>Prochains rendez-vous</h2>${appts.length ? `<div class="list">${appts.map(apptItem).join('')}</div>` : '<p class="empty">Aucun rendez-vous à venir.</p>'}
      ${bills.length ? `<h2>Factures à payer</h2><div class="list">${bills.map(billItem).join('')}</div>` : ''}
      ${maint.length ? `<h2>Entretien véhicules</h2><div class="list">${maint.map((m) => maintItem(m, true)).join('')}</div>` : ''}
      <h2>Courses</h2><div class="list"><div class="item tap" data-act="go" data-tab="courses"><div class="grow"><div class="t">🛒 ${shop} article${shop > 1 ? 's' : ''} sur la liste</div></div>›</div></div>`;
  },

  agenda() {
    const now = Date.now();
    const list = S.D.appointments.filter((a) => S.showPast ? Date.parse(a.starts_at) < now : Date.parse(a.starts_at) > now - 3600000);
    if (S.showPast) list.reverse();
    const groups = {};
    for (const a of list) (groups[fmt(new Date(a.starts_at), { month: 'long', year: 'numeric' })] ||= []).push(a);
    return `<div class="row" style="margin-bottom:6px"><button class="btn sm" data-act="togglePast">${S.showPast ? '← Rendez-vous à venir' : 'Voir les rendez-vous passés'}</button></div>
      ${Object.keys(groups).length ? Object.entries(groups).map(([m, items]) => `<h2>${esc(m)}</h2><div class="list">${items.map(apptItem).join('')}</div>`).join('')
        : `<p class="empty">${S.showPast ? 'Aucun rendez-vous passé.' : 'Aucun rendez-vous à venir. Touche + pour en ajouter un.'}</p>`}
      <button class="fab" data-act="newAppt" aria-label="Ajouter">+</button>`;
  },

  courses() {
    const todo = S.D.shopping.filter((s) => !s.done), done = S.D.shopping.filter((s) => s.done);
    const groups = {};
    for (const it of todo) (groups[it.category || 'Autre'] ||= []).push(it);
    const ordered = SHOP_CATS.filter((c) => groups[c]).concat(Object.keys(groups).filter((c) => !SHOP_CATS.includes(c)));
    const row = (it) => `<div class="item ${it.done ? 'done' : ''}"><button class="check ${it.done ? 'on' : ''}" data-act="toggleShop" data-id="${it.id}" aria-label="Cocher">${it.done ? '✓' : ''}</button>
      <div class="grow tap" data-act="editShop" data-id="${it.id}"><div class="t">${esc(it.name)}${it.qty ? ` <span class="muted">· ${esc(it.qty)}</span>` : ''}</div>
      <div class="s">${esc(nameOf(it.added_by))}</div></div></div>`;
    return `<form class="addbar" id="shopForm"><input type="text" name="item" placeholder="Ajouter un article…" autocomplete="off" enterkeyhint="done">
      <select name="cat">${SHOP_CATS.map((c) => `<option ${c === S.shopCat ? 'selected' : ''}>${esc(c)}</option>`).join('')}</select></form>
      <p class="small muted" style="margin:0 0 6px">Astuce : « lait x2 » ajoute la quantité. Les autres sont prévenus 3 min après ton dernier ajout.</p>
      ${ordered.length ? ordered.map((c) => `<h2>${esc(c)}</h2><div class="list">${groups[c].map(row).join('')}</div>`).join('') : '<p class="empty">La liste est vide 🎉</p>'}
      ${done.length ? `<h2>Dans le caddie (${done.length})</h2><div class="list">${done.map(row).join('')}</div>
        <button class="btn block" data-act="clearShop">Retirer les articles cochés</button>` : ''}`;
  },

  taches() {
    const mon = S.week || curMonday(), days = weekDays(mon), today = todayStr();
    const label = `Semaine du ${fmt(new Date(days[0] + 'T12:00:00'), { day: 'numeric' })} au ${fmt(new Date(days[6] + 'T12:00:00'), { day: 'numeric', month: 'short' })}`;
    const cell = (c, day) => {
      const p = planCell(c.id, day), td = day === today ? ' today' : '';
      const inner = (() => {
        if (!p || !p.assignees.length) return '';
        const done = planDone(c.id, day);
        const duo = p.assignees.length > 1 ? ' duo' : '';
        if (done) return `<span class="c ok${duo}">✓</span>`;
        return `<span class="c${duo}${day < today ? ' miss' : ''}">${esc(initials(p.assignees))}</span>`;
      })();
      return `<td class="cell${td}" data-act="cell" data-chore="${c.id}" data-day="${day}">${inner}</td>`;
    };
    return `<div class="wk"><button data-act="week" data-d="-7" aria-label="Semaine précédente">‹</button>
        <b data-act="week" data-d="0">${esc(label)}</b><button data-act="week" data-d="7" aria-label="Semaine suivante">›</button></div>
      ${S.D.chores.length ? `<table class="grid"><thead><tr><th class="task">Tâche</th>${days.map((d, i) =>
        `<th class="${d === today ? 'today' : ''}">${DAY_LETTERS[i]}<b>${new Date(d + 'T12:00:00').getDate()}</b></th>`).join('')}</tr></thead>
        <tbody>${S.D.chores.map((c) => `<tr><td class="task" data-act="editChore" data-id="${c.id}">${esc(c.name)}</td>${days.map((d) => cell(c, d)).join('')}</tr>`).join('')}</tbody></table>`
        : '<p class="empty">Aucune tâche.</p>'}
      <div class="legend">${S.D.members.map((m) => `<span><span class="c">${esc(m.name[0])}</span>${esc(m.name)}</span>`).join('')}
        <span><span class="c duo">S+T</span>À deux</span><span><span class="c ok">✓</span>Fait</span><span><span class="c miss">S</span>Oublié</span></div>
      ${isParent() ? `<div class="row" style="gap:8px;margin-top:12px">
          <button class="btn sm" style="flex:1" data-act="weekRotation">↻ Remplir avec la rotation</button>
          <button class="btn sm" style="flex:1" data-act="weekCopy">⧉ Copier sem. précédente</button></div>
        <button class="btn block" data-act="newChore" style="margin-top:8px">+ Ajouter une tâche</button>
        <p class="small muted" style="margin-top:12px">Touche une case pour choisir qui la fait, ou le nom d'une tâche pour la modifier (jours, personnes). Chaque nouvelle semaine se remplit toute seule avec la rotation.</p>`
        : `<p class="small muted" style="margin-top:12px">Tes tâches du jour se cochent depuis l'Accueil. Seuls les parents peuvent modifier le planning.</p>`}`;
  },

  plus() {
    const unpaid = S.D.bills.filter((b) => !b.paid).length;
    const tile = (tab, i, t, s) => `<button class="menu-tile" data-act="go" data-tab="${tab}"><span class="i">${i}</span><b>${t}</b><span>${s}</span></button>`;
    return `<div class="grid2">
      ${tile('factures', '💶', 'Factures', unpaid ? `${unpaid} à payer` : 'Tout est payé')}
      ${tile('vehicules', '🚗', 'Véhicules', `${S.D.vehicles.length} véhicules`)}
      ${tile('documents', '📄', 'Documents', `${S.D.documents.length} fichier${S.D.documents.length > 1 ? 's' : ''}`)}
      ${tile('famille', '📍', 'Où êtes-vous ?', 'Position à la demande')}
      ${tile('reglages', '⚙️', 'Réglages', 'Notifications, agenda, bus')}
    </div>`;
  },

  factures() {
    const unpaid = S.D.bills.filter((b) => !b.paid);
    const paid = S.D.bills.filter((b) => b.paid).sort((a, b) => (b.paid_at || '').localeCompare(a.paid_at || '')).slice(0, 15);
    const total = unpaid.reduce((s, b) => s + Number(b.amount || 0), 0);
    return `<h2>À payer${total ? ` · ${esc(euro(total))}` : ''}</h2>${unpaid.length ? `<div class="list">${unpaid.map(billItem).join('')}</div>` : '<p class="empty">Aucune facture en attente 👍</p>'}
      ${paid.length ? `<h2>Payées récemment</h2><div class="list">${paid.map(billItem).join('')}</div>` : ''}
      <button class="fab" data-act="newBill" aria-label="Ajouter">+</button>`;
  },

  vehicules() {
    return S.D.vehicles.map((v) => {
      const todo = S.D.maintenance.filter((m) => m.vehicle_id === v.id && !m.done);
      const hist = S.D.maintenance.filter((m) => m.vehicle_id === v.id && m.done).sort((a, b) => (b.done_at || '').localeCompare(a.done_at || '')).slice(0, 4);
      return `<h2>${v.kind === 'Moto' ? '🏍️' : '🚗'} ${esc(v.name)}</h2><div class="list">
        <div class="item tap" data-act="editVehicle" data-id="${v.id}"><div class="grow"><div class="t">${esc(v.name)}${v.plate ? ` · ${esc(v.plate)}` : ''}</div>
        <div class="s">${v.km ? `${v.km.toLocaleString('fr-FR')} km` : 'Kilométrage non renseigné'} · modifier</div></div>›</div>
        ${todo.map((m) => maintItem(m, false)).join('')}
        ${hist.map((m) => `<div class="item done"><div class="grow tap" data-act="editMaint" data-id="${m.id}"><div class="t">${esc(m.kind)}</div>
          <div class="s">Fait le ${esc(m.done_at ? fmtDay(m.done_at) : '?')}${m.done_km ? ` à ${m.done_km.toLocaleString('fr-FR')} km` : ''}</div></div></div>`).join('')}
        <div class="item"><button class="btn sm" data-act="newMaint" data-id="${v.id}">+ Programmer un entretien</button></div></div>`;
    }).join('') + `<button class="btn block" data-act="newVehicle" style="margin-top:8px">+ Ajouter un véhicule</button>`;
  },

  documents() {
    const groups = {};
    for (const d of S.D.documents) (groups[d.category || 'Autre'] ||= []).push(d);
    const order = DOC_CATS.filter((c) => groups[c]).concat(Object.keys(groups).filter((c) => !DOC_CATS.includes(c)));
    return (order.length ? order.map((c) => `<h2>${esc(c)}</h2><div class="list">${groups[c].map((d) => {
      const v = S.D.vehicles.find((x) => x.id === d.vehicle_id);
      return `<div class="item"><div class="grow tap" data-act="editDoc" data-id="${d.id}"><div class="t">${esc(d.title)}</div>
        <div class="s">${[d.member_id && nameOf(d.member_id), v?.name, fmt(new Date(d.created_at), { day: 'numeric', month: 'short', year: 'numeric' })].filter(Boolean).map(esc).join(' · ')}</div></div>
        ${S.urls[d.file_path] ? `<a class="btn sm" href="${esc(S.urls[d.file_path].url)}" target="_blank" rel="noopener">Ouvrir</a>` : '<span class="small muted">…</span>'}</div>`;
    }).join('')}</div>`).join('') : '<p class="empty">Aucun document. Touche + pour ajouter une carte grise, une ordonnance…</p>')
      + `<button class="fab" data-act="newDoc" aria-label="Ajouter">+</button>`;
  },

  famille() {
    return `<div id="map"></div>
      <button class="btn primary block" data-act="shareLoc" style="margin-bottom:6px">📍 Partager ma position</button>
      <div class="list" style="margin-top:12px">${S.D.members.filter((m) => m.id !== S.me).map((m) => {
        const l = S.D.locations.find((x) => x.member_id === m.id);
        return `<div class="item"><div class="avatar">${esc(m.name[0])}</div><div class="grow"><div class="t">${esc(m.name)}</div>
          <div class="s">${l ? `Position ${esc(ago(l.updated_at))}${l.battery != null ? ` · 🔋 ${l.battery} %` : ''}` : 'Pas encore de position'}</div></div>
          <button class="btn sm" data-act="askLoc" data-id="${m.id}">Où es-tu ?</button></div>`;
      }).join('')}</div>
      <p class="small muted">La personne reçoit une notification. Quand elle la touche, sa position s'affiche ici. La batterie est indiquée pour les téléphones Android.</p>`;
  },

  reglages() {
    const bus = setting('bus') || {};
    const pushState = !pushSupported ? (isIOS && !isStandalone ? "Installe d'abord l'appli sur l'écran d'accueil" : 'Non disponible sur ce navigateur')
      : Notification.permission === 'granted' && store.get('pushOk') ? '✅ Activées sur ce téléphone' : 'Désactivées';
    return `<h2>Ce téléphone</h2><div class="list">
        <div class="item"><div class="avatar">${esc(initial(S.me))}</div><div class="grow"><div class="t">${esc(nameOf(S.me))}</div><div class="s">Téléphone de ${esc(nameOf(S.me))}</div></div>
        <button class="btn sm" data-act="changeMe">Changer</button></div>
        <div class="item"><div class="grow"><div class="t">Notifications</div><div class="s">${esc(pushState)}</div></div>
        <button class="btn sm" data-act="enablePush">Activer</button><button class="btn sm" data-act="testPush">Tester</button></div></div>

      <h2>Synchronisation agenda</h2><div class="card">
        <p class="small" style="margin-top:0">Les rendez-vous, échéances de factures et entretiens apparaissent dans ton agenda (lecture seule, mise à jour automatique).</p>
        <div id="icsBox"><button class="btn" data-act="icsUrl">Obtenir le lien d'agenda</button></div></div>

      <h2>Alertes bus</h2><div class="card">
        <form id="busForm">
          ${fieldHtml({ k: 'enabled', type: 'checkbox', label: 'Surveiller le bus du matin (jours d\'école, hors vacances zone C)' }, bus.enabled !== false)}
          <div class="grid2">${fieldHtml({ k: 'line', label: 'Ligne' }, bus.line)}${fieldHtml({ k: 'time', type: 'time', label: 'Heure du bus' }, bus.time)}</div>
          <div class="grid2">${fieldHtml({ k: 'stop', label: 'Arrêt (mot clé)' }, bus.stop)}${fieldHtml({ k: 'minDelay', type: 'number', label: 'Alerte si retard ≥ (min)' }, bus.minDelay ?? 3)}</div>
          ${fieldHtml({ k: 'recipients', type: 'checks', label: 'Qui reçoit les alertes ?', options: S.D.members.map((m) => ({ v: m.id, l: m.name })) }, bus.recipients || ['so'])}
          <div class="row"><button class="btn primary" type="submit">Enregistrer</button><button class="btn" type="button" data-act="busTest">Tester la connexion</button></div>
        </form><div id="busOut"></div></div>

      <h2>Compte</h2><div class="list"><div class="item tap" data-act="logout"><div class="grow"><div class="t" style="color:var(--danger)">Se déconnecter de ce téléphone</div></div></div></div>
      <p class="small muted" style="text-align:center;margin-top:24px">Famille · appli privée · ${APP_VERSION}</p>`;
  },
};

const AFTER = {
  famille: drawMap,
  documents: async () => { if (await ensureUrls(S.D.documents.map((d) => d.file_path))) rerender(); },
  agenda: async () => { if (await ensureUrls(S.D.appointments.map((a) => a.file_path).filter(Boolean))) {} },
  courses: () => {
    const f = $('#shopForm'); if (!f) return;
    f.cat.addEventListener('change', () => { S.shopCat = f.cat.value; store.set('shopCat', S.shopCat); });
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      let name = f.item.value.trim(); if (!name) return;
      let qty = null;
      const m = name.match(/^(.*?)\s*[x×]\s*(\d+)$/i); if (m) { name = m[1]; qty = 'x' + m[2]; }
      f.item.value = '';
      await db(sb.from('shopping').insert({ name: name[0].toUpperCase() + name.slice(1), qty, category: f.cat.value, added_by: S.me }));
      await load('shopping'); rerender(); $('#shopForm')?.item.focus();
    });
  },
  reglages: () => {
    const f = $('#busForm'); if (!f) return;
    f.addEventListener('submit', async (e) => {
      e.preventDefault();
      const cur = setting('bus') || {};
      const val = {
        ...cur, enabled: f.enabled.checked, line: f.line.value.trim(), time: f.time.value || '07:30', stop: f.stop.value.trim(),
        minDelay: Number(f.minDelay.value) || 3, recipients: [...f.querySelectorAll('[name=recipients]:checked')].map((i) => i.value),
      };
      if (val.line !== cur.line || val.stop !== cur.stop) { val.lineRef = ''; val.stopRefs = []; }
      await db(sb.from('settings').upsert({ key: 'bus', value: val }));
      await load('settings'); toast('Réglages du bus enregistrés');
    });
  },
};

// ---------------------------------------------------------------------
//  Actions
// ---------------------------------------------------------------------
const memberOpts = (empty) => [...(empty ? [{ v: '', l: empty }] : []), ...S.D.members.map((m) => ({ v: m.id, l: m.name }))];

const ACT = {
  go: (d) => { S.tab = d.tab; history.replaceState(null, '', '?tab=' + d.tab); window.scrollTo(0, 0); render(); },
  iam: async (d) => { S.me = d.id; store.set('me', d.id); render(); if (store.get('pushOk')) subscribePush(false).catch(() => {}); },
  changeMe: () => { S.me = null; store.set('me', null); render(); },
  logout: async () => { if (confirm('Se déconnecter ?')) { await sb.auth.signOut(); store.set('me', null); location.reload(); } },
  togglePast: () => { S.showPast = !S.showPast; render(); },

  enablePush: async () => {
    try { if (await subscribePush(true)) { toast('🔔 Notifications activées'); rerender(); } }
    catch (e) { alert('Erreur : ' + e.message); }
  },
  testPush: async () => {
    const r = await notify({ to: [S.me], title: '🔔 Test réussi', body: 'Les notifications fonctionnent sur ce téléphone.' });
    toast(r.sent ? 'Notification envoyée ✅' : "Aucun appareil abonné : touche d'abord « Activer »");
  },
  icsUrl: async () => {
    const box = $('#icsBox'); box.innerHTML = '<p class="muted small">Chargement…</p>';
    const { url, error } = await callFn('icsurl');
    if (error) { box.textContent = 'Erreur : ' + error; return; }
    box.innerHTML = `<p class="mono">${esc(url)}</p><div class="row">
      <button class="btn sm" data-act="copy" data-text="${esc(url)}">Copier le lien</button>
      <a class="btn sm" href="${esc(url.replace(/^https:/, 'webcal:'))}">S'abonner (iPhone)</a></div>
      <p class="small muted"><b>iPhone</b> : touche « S'abonner », puis « S'abonner » à nouveau.<br>
      <b>Android / Google Agenda</b> : sur un ordinateur, va sur calendar.google.com → « Autres agendas » → « + » → « À partir de l'URL » → colle le lien. Google met à jour toutes les quelques heures.</p>`;
  },
  copy: async (d) => { try { await navigator.clipboard.writeText(d.text); toast('Lien copié'); } catch { prompt('Copie ce lien :', d.text); } },
  busTest: async () => {
    const out = $('#busOut'); out.innerHTML = '<p class="muted small">Interrogation d\'Île-de-France Mobilités…</p>';
    const r = await callFn('busdebug');
    const lines = [];
    if (!r.primKey) lines.push("⚠️ Clé PRIM manquante : ajoute le secret PRIM_API_KEY dans Supabase (guide, étape 3).");
    if (r.error) lines.push('⚠️ ' + r.error);
    if (r.refs) lines.push(`Ligne trouvée : ${r.refs.lineRef}\nArrêt(s) : ${(r.refs.stopNames || r.refs.stopRefs).join(', ')}`);
    lines.push(`Jour d'école aujourd'hui : ${r.schoolDayToday ? 'oui' : 'non'}`);
    if (r.departures) lines.push('Prochains départs :\n' + (r.departures.map((d) => `  ${d.prevu} → ${d.estime}${d.retard ? ` (+${d.retard} min)` : ''}${d.supprime ? ' SUPPRIMÉ' : ''}  vers ${d.vers}`).join('\n') || '  (aucun pour le moment)'));
    if (r.messages?.length) lines.push('Infos trafic :\n' + r.messages.map((m) => '  • ' + m.text).join('\n'));
    out.innerHTML = `<pre class="mono">${esc(lines.join('\n\n'))}</pre>`;
  },

  // ----- Rendez-vous -----
  newAppt: () => apptForm({ member_id: S.me, remind_minutes: 1440 }),
  editAppt: (d) => apptForm(S.D.appointments.find((a) => a.id === d.id)),

  // ----- Factures -----
  newBill: () => billForm({ remind_days: 3 }),
  editBill: (d) => billForm(S.D.bills.find((b) => b.id === d.id)),
  payBill: async (d) => {
    const b = S.D.bills.find((x) => x.id === d.id);
    if (!confirm(`Marquer « ${b.title} » comme payée ?`)) return;
    await db(sb.from('bills').update({ paid: true, paid_by: S.me, paid_at: new Date().toISOString() }).eq('id', b.id));
    notify({ exclude: [S.me], title: `💶 Facture payée : ${b.title}`, body: `${euro(b.amount)} payée par ${nameOf(S.me)}`.trim(), url: './?tab=factures' });
    await load('bills'); rerender(); toast('Facture payée ✅');
  },

  // ----- Courses -----
  toggleShop: async (d) => {
    const it = S.D.shopping.find((x) => x.id === d.id); it.done = !it.done; rerender();
    await db(sb.from('shopping').update({ done: it.done }).eq('id', it.id));
  },
  editShop: (d) => {
    const it = S.D.shopping.find((x) => x.id === d.id);
    openForm({
      title: 'Article', values: it,
      fields: [{ k: 'name', label: 'Article', required: true }, { k: 'qty', label: 'Quantité' }, { k: 'category', type: 'select', label: 'Rayon', options: SHOP_CATS }],
      onSave: async (v) => { await db(sb.from('shopping').update(v).eq('id', it.id)); await load('shopping'); rerender(); },
      onDelete: async () => { await db(sb.from('shopping').delete().eq('id', it.id)); await load('shopping'); rerender(); },
    });
  },
  clearShop: async () => {
    if (!confirm('Retirer tous les articles cochés ?')) return;
    await db(sb.from('shopping').delete().eq('done', true)); await load('shopping'); rerender();
  },

  // ----- Tâches -----
  planDo: async (d) => {
    const c = S.D.chores.find((x) => x.id === d.chore), p = planCell(d.chore, d.day);
    if (!c || !p || planDone(c.id, d.day)) return;
    await db(sb.from('chore_log').insert({ chore_id: c.id, chore_name: c.name, done_by: p.assignees, day: d.day }));
    notify({ exclude: [S.me], title: `✅ ${c.name} : c'est fait !`, body: `Par ${names(p.assignees)}.`, url: './?tab=taches' });
    await load('chore_log'); rerender(); toast('Bravo ! Tout le monde est prévenu ✅');
  },
  planUndo: async (d) => {
    const c = S.D.chores.find((x) => x.id === d.chore), l = planDone(d.chore, d.day);
    if (!l || !confirm(`Annuler « ${c.name} » ?`)) return;
    await db(sb.from('chore_log').delete().eq('id', l.id));
    await load('chore_log'); rerender(); toast('Annulé');
  },
  week: async (d) => {
    const n = Number(d.d);
    S.week = n ? addDays(S.week || curMonday(), n) : curMonday();
    await Promise.all([load('chore_plan'), load('chore_log')]);
    await ensureWeek(S.week);
    rerender();
  },
  cell: async (d) => {
    const c = S.D.chores.find((x) => x.id === d.chore), p = planCell(d.chore, d.day);
    const done = planDone(d.chore, d.day), canMark = d.day <= todayStr() && p?.assignees.length;
    const choices = [];
    if (canMark) choices.push(done ? { label: '↩︎ Annuler « fait »', value: 'undo' } : { label: '✓ Marquer fait', value: 'do', primary: true });
    if (isParent() && !done) {
      for (const m of S.D.members) choices.push({ label: m.name, value: ['set', [m.id]] });
      const kids = S.D.members.filter((m) => !m.parent && !['ronald', 'laet'].includes(m.id)).map((m) => m.id);
      if (kids.length > 1) choices.push({ label: `À deux (${names(kids)})`, value: ['set', kids] });
      if (p?.assignees.length) choices.push({ label: 'Personne', value: ['set', []] });
    }
    if (!choices.length) return toast(isParent() ? 'Rien à modifier' : 'Seuls les parents peuvent modifier le planning');
    const r = await ask(`${c.name} · ${fmtDay(d.day)}`, choices);
    if (!r) return;
    if (r === 'do') return ACT.planDo(d);
    if (r === 'undo') return ACT.planUndo(d);
    await db(sb.from('chore_plan').upsert({ chore_id: c.id, day: d.day, assignees: r[1] }, { onConflict: 'chore_id,day' }));
    await load('chore_plan'); rerender();
  },
  weekRotation: async () => {
    const mon = S.week || curMonday();
    if (mon < curMonday()) return toast('Impossible de modifier une semaine passée');
    if (!confirm('Refaire le planning de cette semaine avec la rotation ? (les tâches déjà faites sont gardées)')) return;
    const from = mon === curMonday() ? todayStr() : mon;
    await replaceWeek(mon, from, S.D.chores.flatMap((c) => generatedRows(c, mon, from)));
    toast('Planning refait ✅');
  },
  weekCopy: async () => {
    const mon = S.week || curMonday();
    if (mon < curMonday()) return toast('Impossible de modifier une semaine passée');
    const prev = addDays(mon, -7);
    const { data } = await sb.from('chore_plan').select('*').gte('day', prev).lte('day', addDays(prev, 6));
    if (!data?.length) return toast('La semaine précédente est vide');
    if (!confirm('Copier le planning de la semaine précédente ? (les tâches déjà faites sont gardées)')) return;
    const from = mon === curMonday() ? todayStr() : mon;
    const rows = data.map((p) => ({ chore_id: p.chore_id, day: addDays(p.day, 7), assignees: p.assignees })).filter((r) => r.day >= from);
    await replaceWeek(mon, from, rows);
    toast('Semaine copiée ✅');
  },
  newChore: () => isParent() ? choreForm({ assignees: ['so', 'thais'], days: [1, 2, 3, 4, 5, 6, 7] }) : null,
  editChore: (d) => isParent() ? choreForm(S.D.chores.find((c) => c.id === d.id)) : toast('Seuls les parents peuvent modifier les tâches'),

  // ----- Véhicules -----
  newVehicle: () => vehicleForm({ kind: 'Voiture' }),
  editVehicle: (d) => vehicleForm(S.D.vehicles.find((v) => v.id === d.id)),
  newMaint: (d) => maintForm({ vehicle_id: d.id, kind: 'Contrôle technique' }),
  editMaint: (d) => maintForm(S.D.maintenance.find((m) => m.id === d.id)),
  maintDone: (d) => {
    const m = S.D.maintenance.find((x) => x.id === d.id);
    const v = S.D.vehicles.find((x) => x.id === m.vehicle_id);
    const suggest = m.kind === 'Contrôle technique' ? addDays(todayStr(), v?.kind === 'Moto' ? 3 * 365 : 2 * 365) : m.kind === 'Vidange' || m.kind === 'Révision' ? addDays(todayStr(), 365) : '';
    openForm({
      title: `${m.kind} fait`, saveLabel: 'Valider',
      values: { done_at: todayStr(), done_km: v?.km, next_date: suggest },
      fields: [
        { k: 'done_at', type: 'date', label: 'Fait le', required: true },
        { k: 'done_km', type: 'number', label: 'Kilométrage', step: '1' },
        { k: 'next_date', type: 'date', label: 'Prochain(e) ' + m.kind.toLowerCase() + ' (laisser vide si aucun)' },
        { k: 'next_km', type: 'number', label: 'Prochain à (km), facultatif', step: '1' },
      ],
      onSave: async (val) => {
        await db(sb.from('maintenance').update({ done: true, done_at: val.done_at, done_km: val.done_km }).eq('id', m.id));
        if (val.next_date || val.next_km) await db(sb.from('maintenance').insert({ vehicle_id: m.vehicle_id, kind: m.kind, due_date: val.next_date, km_target: val.next_km }));
        if (val.done_km && (!v.km || val.done_km > v.km)) await db(sb.from('vehicles').update({ km: val.done_km }).eq('id', v.id));
        await Promise.all([load('maintenance'), load('vehicles')]); rerender();
      },
    });
  },

  // ----- Documents -----
  newDoc: () => docForm({ category: 'Ordonnance' }),
  editDoc: (d) => docForm(S.D.documents.find((x) => x.id === d.id)),

  // ----- Localisation -----
  shareLoc: () => shareLocation(null),
  askLoc: async (d) => {
    const r = await notify({ to: [d.id], title: `📍 ${nameOf(S.me)} demande où tu es`, body: 'Touche ici pour partager ta position.', url: `./?share=${S.me}`, tag: 'loc' });
    toast(r.sent ? `Demande envoyée à ${nameOf(d.id)}` : `${nameOf(d.id)} n'a pas encore activé les notifications`);
  },
};

document.addEventListener('click', (e) => {
  const el = e.target.closest('[data-act]'); if (!el) return;
  const fn = ACT[el.dataset.act]; if (!fn) return;
  e.preventDefault();
  Promise.resolve(fn(el.dataset, el)).catch((err) => { console.error(err); alert('Erreur : ' + (err.message || err)); });
});

// ---------- Formulaires ----------
function apptForm(a) {
  ensureUrls([a.file_path].filter(Boolean)).then(() => { const box = $('#apptFile'); if (box && a.file_path) box.innerHTML = fileLink(a.file_path); });
  openForm({
    title: a.id ? 'Rendez-vous' : 'Nouveau rendez-vous', values: { ...a, remind_minutes: a.remind_minutes == null ? '' : String(a.remind_minutes) },
    fields: [
      { k: 'title', label: 'Objet', required: true, placeholder: 'Dentiste, ophtalmo, réunion…' },
      { k: 'member_id', type: 'select', label: 'Pour qui ?', options: memberOpts('Toute la famille') },
      { k: 'starts_at', type: 'datetime', label: 'Date et heure', required: true },
      { k: 'location', label: 'Lieu', placeholder: 'Adresse ou nom du cabinet' },
      { k: 'comment', type: 'textarea', label: 'Commentaire' },
      { k: 'remind_minutes', type: 'select', label: 'Rappel', options: REMIND_OPTS },
      { k: 'file', type: 'file', label: a.file_path ? 'Remplacer la pièce jointe' : 'Pièce jointe (ordonnance, convocation…)' },
    ],
    onSave: async (v) => {
      const row = { title: v.title, member_id: v.member_id, starts_at: v.starts_at, location: v.location, comment: v.comment,
        remind_minutes: v.remind_minutes == null ? null : Number(v.remind_minutes) };
      if (v.file) row.file_path = await upload(v.file);
      if (!a.id || a.starts_at !== v.starts_at || a.remind_minutes !== row.remind_minutes) row.reminded = false;
      if (a.id) await db(sb.from('appointments').update(row).eq('id', a.id));
      else {
        await db(sb.from('appointments').insert({ ...row, created_by: S.me }));
        notify({ exclude: [S.me], title: `📅 Nouveau RDV : ${row.title}`, body: `${row.member_id ? nameOf(row.member_id) + ' · ' : ''}${fmtDT(row.starts_at)}${row.location ? ' · ' + row.location : ''}`, url: './?tab=agenda' });
      }
      await load('appointments'); rerender();
    },
    onDelete: a.id ? async () => { await db(sb.from('appointments').delete().eq('id', a.id)); await load('appointments'); rerender(); } : null,
  });
  if (a.file_path) $('#modal form')?.insertAdjacentHTML('afterbegin', `<div id="apptFile" style="margin-bottom:12px">${fileLink(a.file_path)}</div>`);
}

function billForm(b) {
  openForm({
    title: b.id ? 'Facture' : 'Nouvelle facture', values: b,
    fields: [
      { k: 'title', label: 'Facture', required: true, placeholder: 'EDF, assurance, cantine…' },
      { k: 'amount', type: 'number', label: 'Montant (€)' },
      { k: 'due_date', type: 'date', label: 'À payer avant le', required: true },
      { k: 'remind_days', type: 'number', label: 'Rappel combien de jours avant ?', step: '1' },
      { k: 'comment', type: 'textarea', label: 'Commentaire' },
      ...(b.paid ? [{ k: 'paid', type: 'checkbox', label: 'Payée' }] : []),
    ],
    onSave: async (v) => {
      const row = { title: v.title, amount: v.amount, due_date: v.due_date, remind_days: v.remind_days ?? 3, comment: v.comment };
      if (b.paid && v.paid === false) Object.assign(row, { paid: false, paid_by: null, paid_at: null });
      if (!b.id || b.due_date !== v.due_date || b.remind_days !== row.remind_days) row.remind_stage = 0;
      if (b.id) await db(sb.from('bills').update(row).eq('id', b.id));
      else {
        await db(sb.from('bills').insert({ ...row, created_by: S.me }));
        notify({ exclude: [S.me], title: `💶 Nouvelle facture : ${row.title}`, body: `${euro(row.amount)} avant le ${fmtDay(row.due_date)}`.trim(), url: './?tab=factures' });
      }
      await load('bills'); rerender();
    },
    onDelete: b.id ? async () => { await db(sb.from('bills').delete().eq('id', b.id)); await load('bills'); rerender(); } : null,
  });
}

// Remplace les cases non faites d'une semaine (à partir de « from ») par « rows »
async function replaceWeek(mon, from, rows) {
  const end = addDays(mon, 6);
  const doneKeys = new Set(S.D.chore_log.map((l) => l.chore_id + l.day));
  const toDelete = S.D.chore_plan.filter((p) => p.day >= from && p.day <= end && !doneKeys.has(p.chore_id + p.day)).map((p) => p.id);
  if (toDelete.length) await db(sb.from('chore_plan').delete().in('id', toDelete));
  const keep = rows.filter((r) => !doneKeys.has(r.chore_id + r.day));
  if (keep.length) await db(sb.from('chore_plan').upsert(keep, { onConflict: 'chore_id,day' }));
  await load('chore_plan'); rerender();
}

function choreForm(c) {
  const opts = S.D.members.map((m) => ({ v: m.id, l: m.name }));
  openForm({
    title: c.id ? 'Tâche' : 'Nouvelle tâche', values: { ...c, days: choreDays(c).map(String) },
    fields: [
      { k: 'name', label: 'Tâche', required: true },
      { k: 'days', type: 'checks', label: 'Quels jours ?', options: DAY_NAMES.map((n, i) => ({ v: String(i + 1), l: n.slice(0, 3) + '.' })) },
      { k: 'assignees', type: 'checks', label: 'Qui ? (plusieurs personnes = chacun son tour)', options: opts },
      { k: 'allow_duo', type: 'checkbox', label: 'Se fait à deux (toutes les personnes cochées ensemble)' },
    ],
    onSave: async (v) => {
      if (!v.assignees.length) throw new Error('Choisis au moins une personne.');
      if (!v.days.length) throw new Error('Choisis au moins un jour.');
      const order = S.D.members.map((m) => m.id).filter((id) => v.assignees.includes(id));
      const row = { name: v.name, assignees: order, allow_duo: v.allow_duo, days: v.days.map(Number).sort() };
      let id = c.id;
      if (id) await db(sb.from('chores').update(row).eq('id', id));
      else id = (await db(sb.from('chores').insert({ ...row, sort: S.D.chores.length + 1 }).select('id')))[0].id;
      // Les cases à venir (non faites) de cette tâche sont recalculées
      await db(sb.from('chore_plan').delete().eq('chore_id', id).gt('day', todayStr()));
      if (!planDone(id, todayStr())) await db(sb.from('chore_plan').delete().eq('chore_id', id).eq('day', todayStr()));
      await Promise.all([load('chores'), load('chore_plan')]);
      await ensureWeek(curMonday()); if (S.week && S.week !== curMonday()) await ensureWeek(S.week);
      rerender();
    },
    onDelete: c.id ? async () => { await db(sb.from('chores').delete().eq('id', c.id)); await Promise.all([load('chores'), load('chore_plan')]); rerender(); } : null,
  });
}

function vehicleForm(v) {
  openForm({
    title: v.id ? 'Véhicule' : 'Nouveau véhicule', values: v,
    fields: [
      { k: 'name', label: 'Nom', required: true, placeholder: 'Clio, 308, MT-07…' },
      { k: 'kind', type: 'select', label: 'Type', options: ['Voiture', 'Moto'] },
      { k: 'plate', label: 'Immatriculation' },
      { k: 'km', type: 'number', label: 'Kilométrage actuel', step: '1' },
    ],
    onSave: async (val) => {
      if (v.id) await db(sb.from('vehicles').update(val).eq('id', v.id));
      else await db(sb.from('vehicles').insert({ ...val, sort: S.D.vehicles.length + 1 }));
      await load('vehicles'); rerender();
    },
    onDelete: v.id ? async () => { await db(sb.from('vehicles').delete().eq('id', v.id)); await Promise.all([load('vehicles'), load('maintenance')]); rerender(); } : null,
  });
}

function maintForm(m) {
  openForm({
    title: m.id ? 'Entretien' : 'Programmer un entretien', values: m,
    fields: [
      { k: 'vehicle_id', type: 'select', label: 'Véhicule', options: S.D.vehicles.map((v) => ({ v: v.id, l: v.name })) },
      { k: 'kind', type: 'select', label: 'Type', options: MAINT_KINDS },
      { k: 'due_date', type: 'date', label: 'Date prévue (rappels à J-30, J-7 et le jour J)' },
      { k: 'km_target', type: 'number', label: 'Ou kilométrage prévu (facultatif)', step: '1' },
      { k: 'comment', type: 'textarea', label: 'Commentaire (garage, pièces…)' },
    ],
    onSave: async (v) => {
      if (!v.due_date && !v.km_target) throw new Error('Indique une date ou un kilométrage.');
      const row = { ...v };
      if (!m.id || m.due_date !== v.due_date) row.remind_stage = 0;
      if (m.id) await db(sb.from('maintenance').update(row).eq('id', m.id));
      else await db(sb.from('maintenance').insert(row));
      await load('maintenance'); rerender();
    },
    onDelete: m.id ? async () => { await db(sb.from('maintenance').delete().eq('id', m.id)); await load('maintenance'); rerender(); } : null,
  });
}

function docForm(d) {
  openForm({
    title: d.id ? 'Document' : 'Nouveau document', values: d,
    fields: [
      { k: 'title', label: 'Nom du document', required: true, placeholder: 'Carte grise Clio, Ordonnance Thaïs…' },
      { k: 'category', type: 'select', label: 'Catégorie', options: DOC_CATS },
      { k: 'member_id', type: 'select', label: 'Personne concernée', options: memberOpts('—') },
      { k: 'vehicle_id', type: 'select', label: 'Véhicule concerné', options: [{ v: '', l: '—' }, ...S.D.vehicles.map((v) => ({ v: v.id, l: v.name }))] },
      { k: 'file', type: 'file', label: d.id ? 'Remplacer le fichier' : 'Fichier (photo ou PDF)', required: !d.id, hint: 'Tu peux prendre une photo directement.' },
    ],
    onSave: async (v) => {
      const row = { title: v.title, category: v.category, member_id: v.member_id, vehicle_id: v.vehicle_id };
      if (v.file) {
        row.file_path = await upload(v.file); row.file_name = v.file.name;
        if (d.file_path) await sb.storage.from('docs').remove([d.file_path]);
      }
      if (d.id) await db(sb.from('documents').update(row).eq('id', d.id));
      else await db(sb.from('documents').insert({ ...row, created_by: S.me }));
      await load('documents'); rerender();
    },
    onDelete: d.id ? async () => {
      await sb.storage.from('docs').remove([d.file_path]);
      await db(sb.from('documents').delete().eq('id', d.id)); await load('documents'); rerender();
    } : null,
  });
}

// ---------------------------------------------------------------------
//  Navigation via les liens des notifications
// ---------------------------------------------------------------------
function handleUrl(href) {
  const u = new URL(href, location.href);
  const tab = u.searchParams.get('tab');
  const share = u.searchParams.get('share');
  if (tab && (VIEWS[tab])) S.tab = tab;
  if (share) {
    S.tab = 'famille';
    history.replaceState(null, '', '?tab=famille');
    render();
    setTimeout(() => shareLocation(share), 300);
    return;
  }
  render();
}
navigator.serviceWorker?.addEventListener('message', (e) => { if (e.data?.type === 'nav') handleUrl(e.data.url); });

// ---------------------------------------------------------------------
//  Démarrage
// ---------------------------------------------------------------------
let channel;
function startRealtime() {
  if (channel) return;
  let timer; const pending = new Set();
  channel = sb.channel('famille').on('postgres_changes', { event: '*', schema: 'public' }, (p) => {
    pending.add(p.table); clearTimeout(timer);
    timer = setTimeout(async () => {
      const tables = [...pending]; pending.clear();
      await Promise.all(tables.filter((t) => t in S.D).map(load));
      if ($('#modal').hidden && !document.activeElement?.matches('input,textarea,select')) rerender();
    }, 400);
  }).subscribe();
}

async function onSession(session) {
  S.session = session;
  if (!session) { render(); return; }
  await loadAll();
  if (await ensureWeek(curMonday())) await load('chore_plan');
  startRealtime();
  handleUrl(location.href);
  if (S.me && store.get('pushOk') && pushSupported && Notification.permission === 'granted') subscribePush(false).catch(() => {});
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js', { updateViaCache: 'none' }).then((r) => r.update()).catch((e) => console.warn('SW', e));
document.addEventListener('visibilitychange', async () => {
  if (document.visibilityState === 'visible' && S.session) { await loadAll(); await ensureWeek(curMonday()); if ($('#modal').hidden) rerender(); }
});

const { data: { session } } = await sb.auth.getSession();
await onSession(session);
sb.auth.onAuthStateChange((event, s) => {
  // setTimeout : évite un blocage connu de supabase-js si on l'appelle dans ce callback
  if (event === 'SIGNED_IN' && !S.session) setTimeout(() => onSession(s), 0);
  else if (event === 'SIGNED_OUT') setTimeout(() => onSession(null), 0);
  else if (s) S.session = s;
});
