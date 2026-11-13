// Panou: firma + Craft Cafe, pe tableta. Datele vin criptate in data.enc.json.
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('panou.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('panou.' + k, JSON.stringify(v)); } catch {} },
};
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LUNI = ['ian.', 'feb.', 'mar.', 'apr.', 'mai', 'iun.', 'iul.', 'aug.', 'sept.', 'oct.', 'nov.', 'dec.'];
const LUNI_L = ['ianuarie', 'februarie', 'martie', 'aprilie', 'mai', 'iunie', 'iulie', 'august', 'septembrie', 'octombrie', 'noiembrie', 'decembrie'];
const nf = new Intl.NumberFormat('ro-RO', { maximumFractionDigits: 0 });
const nf2 = new Intl.NumberFormat('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const d0 = iso => iso ? new Date(iso.slice(0, 10) + 'T12:00:00') : null;
const roDate = iso => { const d = d0(iso); return d ? `${d.getDate()} ${LUNI[d.getMonth()]}` : '—'; };
const roDateL = iso => { const d = d0(iso); return d ? `${d.getDate()} ${LUNI_L[d.getMonth()]}` : '—'; };
const daysFrom = iso => Math.round((d0(iso) - d0(new Date().toISOString())) / 864e5);
const money = (v, u = 'lei') => v == null || v === '' ? '—' : `<span class="num" data-count="${Number(v)}">${nf.format(v)}</span><small>${esc(u)}</small>`;
const LVL = { rosu: 'Urgent', galben: 'De făcut', verde: 'În regulă', gri: 'Neverificat', asteapta: 'Aștept confirmarea', info: 'De știut' };
const LIGHT_TXT = { rosu: 'Urgent', galben: 'De făcut', verde: 'În regulă', gri: 'Neverificat' };
const AREA = { firma: 'Firma', bani: 'Bani', cafenea: 'Cafeneaua' };
const AVATAR = { Georgiana: '🦒', Lori: '🐒', Stefania: '🦜' };

const ICON = {
  azi: '<path d="M12 3v2M12 19v2M4.2 4.2l1.4 1.4M18.4 18.4l1.4 1.4M3 12h2M19 12h2M4.2 19.8l1.4-1.4M18.4 5.6l1.4-1.4"/><circle cx="12" cy="12" r="4.2"/>',
  firma: '<path d="M4 21V8l8-5 8 5v13"/><path d="M9 21v-6h6v6M4 21h16M9 10h.01M15 10h.01"/>',
  bani: '<rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18M16 15h2"/>',
  cafenea: '<path d="M4 9h12v5a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5V9Z"/><path d="M16 10h1.5a2.5 2.5 0 0 1 0 5H16M8 3c0 1.5 1 1.5 1 3M12 3c0 1.5 1 1.5 1 3"/>',
  programari: '<rect x="3" y="5" width="18" height="16" rx="3"/><path d="M3 10h18M8 3v4M16 3v4M8 14h3"/>',
  echipa: '<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.6c2.8.2 5 2.1 5 5.4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2.5"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
  tema: '<path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a7 7 0 0 0 10.5 10.5Z"/>',
  sync: '<path d="M20 7v5h-5M4 17v-5h5"/><path d="M5.6 9a7 7 0 0 1 12.6-1.7L20 12M4 12l1.8 4.7A7 7 0 0 0 18.4 15"/>',
};
const svg = (n, s = 26) => `<svg viewBox="0 0 24 24" width="${s}" height="${s}" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICON[n]}</svg>`;

// ------------------------------------------------------------------ tema
const theme = LS.get('tema', 'dark');
document.documentElement.dataset.theme = theme;
function toggleTheme() {
  const t = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
  document.documentElement.dataset.theme = t; LS.set('tema', t);
  $('meta[name=theme-color]').content = t === 'dark' ? '#060807' : '#F5EFE3';
}

// ------------------------------------------------------------------ criptare
const b64 = s => Uint8Array.from(atob(s), c => c.charCodeAt(0));
async function derive(pw, enc) {
  const base = await crypto.subtle.importKey('raw', new TextEncoder().encode(pw), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey({ name: 'PBKDF2', salt: b64(enc.salt), iterations: enc.iter, hash: 'SHA-256' },
    base, { name: 'AES-GCM', length: 256 }, false, ['decrypt']);
}
async function decrypt(key, enc) {
  const pt = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: b64(enc.iv) }, key, b64(enc.ct));
  return JSON.parse(new TextDecoder().decode(pt));
}
function idb() {
  return new Promise((res, rej) => {
    const r = indexedDB.open('panou', 1);
    r.onupgradeneeded = () => r.result.createObjectStore('k');
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
  });
}
async function keyGet() {
  try {
    const db = await idb();
    return await new Promise(res => { const q = db.transaction('k').objectStore('k').get('key'); q.onsuccess = () => res(q.result); q.onerror = () => res(null); });
  } catch { return null; }
}
async function keyPut(v) {
  try { const db = await idb(); db.transaction('k', 'readwrite').objectStore('k').put(v, 'key'); } catch {}
}
async function keyDel() {
  try { const db = await idb(); db.transaction('k', 'readwrite').objectStore('k').delete('key'); } catch {}
}

// ------------------------------------------------------------------ stare
let ENC = null, DATA = null, KEY = null, SCREEN = location.hash.slice(1) || 'azi', LIVE = null;

async function loadEnc() {
  try {
    const r = await fetch('data.enc.json?t=' + Date.now(), { cache: 'no-store' });
    if (!r.ok) throw new Error(r.status);
    ENC = await r.json(); LS.set('enc', ENC);
  } catch {
    ENC = LS.get('enc', null);
    if (ENC) ENC._offline = true;
  }
  return ENC;
}

async function boot() {
  await loadEnc();
  const stored = await keyGet();
  if (ENC && stored && stored.exp > Date.now() && stored.salt === ENC.salt) {
    try { KEY = stored.key; DATA = await decrypt(KEY, ENC); return render(); } catch { await keyDel(); }
  }
  lockScreen();
}

function lockScreen(msg = '') {
  const at = ENC?.at ? new Date(ENC.at) : null;
  app.innerHTML = `<div class="lock"><form class="lock-card" id="lf" autocomplete="on">
    <div class="mark"><i></i><i></i><i></i></div>
    <h1>Panou</h1><p>Firma și cafeneaua, într-un singur loc.</p>
    <input type="text" name="username" value="panou" autocomplete="username" class="sr" tabindex="-1" aria-hidden="true">
    <label class="field"><span>Parola</span><input class="input" id="pw" type="password" autocomplete="current-password" required ${ENC ? '' : 'disabled'}></label>
    <label class="check"><input type="checkbox" id="rm" checked> Ține minte pe tableta asta 30 de zile</label>
    <button class="btn primary full" id="go" ${ENC ? '' : 'disabled'}>Deschide</button>
    <p class="err" id="er">${esc(msg || (ENC ? '' : 'Nu am date încă. Conectează tableta la internet și reîncarcă.'))}</p>
    <div class="meta"><span>${at ? 'Date din ' + at.getDate() + ' ' + LUNI[at.getMonth()] + ', ' + at.toTimeString().slice(0, 5) : ''}</span><span>${ENC?._offline ? 'fără internet' : ''}</span></div>
  </form></div>`;
  const f = $('#lf');
  setTimeout(() => $('#pw')?.focus(), 50);
  f.onsubmit = async e => {
    e.preventDefault();
    const btn = $('#go'); btn.disabled = true; btn.textContent = 'Se deschide…'; $('#er').textContent = '';
    try {
      const key = await derive($('#pw').value, ENC);
      DATA = await decrypt(key, ENC); KEY = key;
      if ($('#rm').checked) await keyPut({ key, salt: ENC.salt, exp: Date.now() + 30 * 864e5 });
      render();
    } catch {
      btn.disabled = false; btn.textContent = 'Deschide';
      $('#er').textContent = 'Parola nu e bună. Încearcă din nou.';
      $('#pw').select();
    }
  };
}

async function lockNow() { await keyDel(); DATA = null; KEY = null; lockScreen(); }

// ------------------------------------------------------------------ actiuni (Facut / Amana)
const actState = () => LS.get('actiuni', {});
function setAct(id, stare) {
  const s = actState(); s[id] = { stare, data: new Date().toISOString().slice(0, 10) }; LS.set('actiuni', s);
  api('owner_action_state', { id, stare }).catch(() => {});
}
function undoAct(id) { const s = actState(); delete s[id]; LS.set('actiuni', s); }
function actionsView() {
  const s = actState(), today = new Date().toISOString().slice(0, 10);
  const open = [], done = [];
  for (const a of DATA.actions) {
    const st = s[a.id];
    if (st?.stare === 'amana' && (d0(today) - d0(st.data)) / 864e5 < 2) continue;
    if (st?.stare === 'facut' || a.level === 'asteapta') done.push({ ...a, _done: st?.data || a.done }); else open.push(a);
  }
  return { open, done };
}

// ------------------------------------------------------------------ API aplicatia de tura (live)
async function api(action, payload = {}) {
  const s = DATA?.staff_api;
  if (!s?.url || !s?.token) throw new Error('neconfigurat');
  const r = await fetch(s.url, { method: 'POST', body: JSON.stringify({ action, token: s.token, ...payload }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'eroare');
  return j;
}
async function refreshLive() {
  try {
    const since = new Date(Date.now() - 21 * 864e5).toISOString().slice(0, 10);
    LIVE = await api('owner_dump', { since });
    LIVE._at = new Date();
    toast('Actualizat acum');
  } catch (e) { if (e.message !== 'neconfigurat') toast('Nu am putut actualiza: ' + e.message); }
  render();
}
function toast(t) {
  const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.append(el);
  setTimeout(() => el.remove(), 2600);
}

// ------------------------------------------------------------------ randare
const SCREENS = [
  ['azi', 'Azi'], ['firma', 'Firma'], ['bani', 'Bani'], ['cafenea', 'Cafenea'], ['programari', 'Programări'], ['echipa', 'Echipa'],
];
function lightOf(id) { return { firma: DATA.lights.firma.level, bani: DATA.lights.bani.level, cafenea: DATA.lights.cafenea.level }[id]; }

function render() {
  if (!DATA) return lockScreen();
  const scr = SCREENS.some(s => s[0] === SCREEN) ? SCREEN : 'azi';
  app.innerHTML = `<div class="shell">
    <nav class="rail" aria-label="Meniu">
      <div class="mark" title="Panou"><i></i><i></i><i></i></div>
      ${SCREENS.map(([id, t]) => {
        const lv = lightOf(id);
        return `<button class="nav ${scr === id ? 'on' : ''}" data-go="${id}" aria-current="${scr === id ? 'page' : 'false'}">${svg(id === 'azi' ? 'azi' : id)}<span>${t}</span>${lv && lv !== 'verde' ? `<i class="dot c-${lv}" style="background:var(--c)"></i>` : ''}</button>`;
      }).join('')}
      <div class="spacer"></div>
      <button class="nav" id="th" aria-label="Schimbă tema">${svg('tema', 22)}<span>Temă</span></button>
      <button class="nav" id="lk" aria-label="Blochează">${svg('lock', 22)}<span>Blochează</span></button>
    </nav>
    <main><div class="screen">${VIEWS[scr]()}</div></main></div>`;
  app.querySelectorAll('[data-go]').forEach(b => b.onclick = () => go(b.dataset.go));
  $('#th').onclick = toggleTheme; $('#lk').onclick = lockNow;
  bind(scr);
  countUp();
}
function go(s) { SCREEN = s; history.replaceState(null, '', '#' + s); render(); window.scrollTo({ top: 0 }); }

function countUp() {
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  app.querySelectorAll('[data-count]').forEach(el => {
    const end = Number(el.dataset.count); if (!isFinite(end) || Math.abs(end) < 10) return;
    const t0 = performance.now(), dur = 650;
    const step = t => { const p = Math.min(1, (t - t0) / dur), e = 1 - Math.pow(1 - p, 3); el.textContent = nf.format(end * e); if (p < 1) requestAnimationFrame(step); };
    requestAnimationFrame(step);
  });
}

function staleBanner() {
  const at = new Date(DATA.generated_at), h = (Date.now() - at) / 36e5;
  if (h < 26) return '';
  return `<div class="stale">⏱ Datele sunt din ${at.getDate()} ${LUNI[at.getMonth()]}, ora ${at.toTimeString().slice(0, 5)}. Verificarea de dimineață n-a mai rulat de atunci (Mac-ul a fost oprit?).</div>`;
}
function srcChips() {
  return DATA.sources.map(s => `<button class="chip ${esc(s.status)}" data-src="${esc(s.id)}"><i></i>${esc(s.nume)}${s.status === 'ok' ? '' : ' · ' + ({ vechi: 'date vechi', indisponibil: 'indisponibil', neconfigurat: 'nepornit' }[s.status] || s.status)}</button>`).join('');
}
function srcPop(id) {
  const s = DATA.sources.find(x => x.id === id); if (!s) return;
  popup(`<h4>Sursa: ${esc(s.nume)}</h4><p style="margin:0 0 10px">${esc({ ok: 'Citită azi.', vechi: 'Datele nu sunt de azi.', indisponibil: 'Nu am putut-o citi.', neconfigurat: 'Nu e încă pornită.' }[s.status] || s.status)}</p>
    <p class="note" style="margin:0">${esc(s.nota || '—')}${s.as_of ? `<br>Date din: <b>${roDateL(s.as_of)}</b>` : ''}</p>`);
}
function popup(html) {
  const p = document.createElement('div'); p.className = 'pop';
  p.innerHTML = `<div class="card">${html}<div style="text-align:right;margin-top:16px"><button class="btn">Închide</button></div></div>`;
  p.onclick = e => { if (e.target === p || e.target.closest('.btn')) p.remove(); };
  document.body.append(p);
}

function actionCard(a) {
  const due = a.due ? daysFrom(a.due) : null;
  const dueTxt = a.due ? (due < 0 ? `termen ${roDateL(a.due)} · depășit cu ${-due} zile` : due === 0 ? 'termen azi' : `termen ${roDateL(a.due)} · în ${due} zile`) : '';
  const lvl = a._done ? 'asteapta' : a.level;
  return `<article class="act c-${lvl} ${a._done ? 'done' : ''}" data-id="${esc(a.id)}">
    <div class="top"><span class="tag">${LVL[lvl] || lvl}</span><span class="tag area">${AREA[a.area] || ''}</span></div>
    <h3>${esc(a.title)}</h3>
    <p class="why">${esc(a.why)}</p>
    ${a._done ? `<p class="step"><b>Marcat făcut</b>Pe ${roDateL(a._done)}. Rămâne aici până o confirmă sursa (cel mult 7 zile).</p>` : `<p class="step"><b>Ce faci</b>${esc(a.step)}</p>`}
    <div class="bottom">
      <div>${a.amount != null ? `<div class="amt num">${money(a.amount, a.currency === 'lei' ? 'lei' : a.currency)}</div>` : ''}
        ${dueTxt ? `<div class="due ${due < 0 ? 'late' : ''}">${dueTxt}</div>` : ''}
        <div class="src">Sursa: ${esc(a.source)}${a.as_of ? ' · ' + roDateL(a.as_of) : ''}</div></div>
      <div class="btns">${a._done ? `<button class="btn ghost" data-undo="${esc(a.id)}">Anulează</button>` :
        `<button class="btn ghost" data-later="${esc(a.id)}">Amână o zi</button><button class="btn primary" data-done="${esc(a.id)}">Făcut</button>`}</div>
    </div></article>`;
}
function bindActions() {
  app.querySelectorAll('[data-done]').forEach(b => b.onclick = () => { setAct(b.dataset.done, 'facut'); toast('Marcat făcut'); render(); });
  app.querySelectorAll('[data-later]').forEach(b => b.onclick = () => { setAct(b.dataset.later, 'amana'); toast('Amânat până poimâine'); render(); });
  app.querySelectorAll('[data-undo]').forEach(b => b.onclick = () => { undoAct(b.dataset.undo); render(); });
}

function shiftsBlock(list, label) {
  return `<div class="card"><h4>${label}</h4>${list.map(s => `<div class="shift"><div class="av">${AVATAR[s.nume] || '☕'}</div>
    <div class="grow"><div class="t" style="font-weight:600">${esc(s.nume)}${s.schimb ? ` <span class="badge">în locul ${esc(s.in_locul)}</span>` : ''}</div>
    <div class="s" style="color:var(--muted);font-size:14px">${s.tura === 'dim' ? 'Dimineață' : 'Seară'} · ${esc(s.ore)}</div></div></div>`).join('')}</div>`;
}

const VIEWS = {
  azi() {
    const { open, done } = actionsView();
    const nr = open.filter(a => a.level === 'rosu').length, ng = open.filter(a => a.level === 'galben').length;
    let verdict = 'Totul e <em class="g">în regulă</em> azi.';
    if (nr || ng) verdict = 'Ai ' + [nr ? `<em class="r">${nr} ${nr === 1 ? 'lucru urgent' : 'lucruri urgente'}</em>` : '', ng ? `<em>${ng} de făcut</em> în zilele următoare` : ''].filter(Boolean).join(' și ') + '.';
    const at = new Date(DATA.generated_at);
    const L = DATA.lights;
    const cal = DATA.firma.calendar.slice(0, 3);
    const ev = (LIVE?.programari || DATA.programari.viitoare).filter(e => e.data >= new Date().toISOString().slice(0, 10)).slice(0, 3);
    return `${staleBanner()}
      <div class="eyebrow">${esc(DATA.azi_text)}</div>
      <h1 class="verdict">${verdict}</h1>
      <div class="srcs"><span>Verificat la ${at.toTimeString().slice(0, 5)}</span>${srcChips()}</div>
      <section class="lights">${['firma', 'bani', 'cafenea'].map(k => {
        const l = L[k];
        return `<button class="light c-${l.level}" data-go="${k}"><span class="glow"></span>
          <span class="lv"><i></i>${LIGHT_TXT[l.level]}</span><h3>${esc(l.titlu)}</h3>
          <div class="kpis">${l.kpis.map(p => `<div class="kpi"><div class="l">${esc(p.label)}</div>
            <div class="v num ${p.text ? 't' : ''}">${p.text ? esc(p.text) : money(p.value, p.unit)}</div><div class="n">${esc(p.note || '')}</div></div>`).join('')}</div></button>`;
      }).join('')}</section>
      <div class="cols">
        <section><h2 class="sec">Ce ai de făcut <small>${open.length ? open.length + ' acțiuni, cele urgente primele' : ''}</small></h2>
          <div class="stack">${open.length ? open.map(actionCard).join('') : '<div class="empty"><b>Nimic de făcut azi.</b>Toate verificările sunt în regulă.</div>'}</div>
          ${done.length ? `<h2 class="sec" style="font-size:22px">Marcate făcute <small>aștept confirmarea din surse</small></h2><div class="stack">${done.map(actionCard).join('')}</div>` : ''}
        </section>
        <aside class="stack" style="margin-top:36px">
          ${shiftsBlock(DATA.cafenea.ture_azi, 'Azi la cafenea')}
          <div class="card"><h4>Programări</h4>${ev.length ? ev.map(e => `<div class="row"><div class="datebox"><b>${d0(e.data).getDate()}</b><span>${LUNI[d0(e.data).getMonth()]}</span></div><div class="grow"><div class="t">${esc(e.tip || 'Programare')} · ${esc(e.ora || '')}</div><div class="s">${esc(e.pachet || '')}${e.copii ? ' · ' + esc(e.copii) + ' copii' : ''}</div></div></div>`).join('') : '<p style="margin:0;color:var(--muted)">Nicio programare în zilele următoare.</p>'}</div>
          <div class="card"><h4>Termene apropiate</h4>${cal.map(c => `<div class="row"><div class="datebox"><b>${d0(c.termen).getDate()}</b><span>${LUNI[d0(c.termen).getMonth()]}</span></div><div class="grow"><div class="t">${esc(c.nume)}</div><div class="s">${esc(c.frecventa)}</div></div></div>`).join('')}</div>
        </aside>
      </div>`;
  },

  firma() {
    const F = DATA.firma, fis = F.fiscal;
    const acts = actionsView().open.filter(a => a.area === 'firma');
    return `<div class="page-h"><div><div class="eyebrow">Contabilitate și taxe</div><h1>Firma</h1></div><div class="srcs">${srcChips()}</div></div>
      <div class="grid2" style="margin-top:22px">
        <div class="card"><h4>Termene ANAF</h4><div class="rows">${F.calendar.map(c => `<div class="row"><div class="datebox"><b>${d0(c.termen).getDate()}</b><span>${LUNI[d0(c.termen).getMonth()]}</span></div>
          <div class="grow"><div class="t">${esc(c.nume)}</div><div class="s">${esc(c.frecventa)} · în ${c.zile} zile</div></div>${c.confirmat ? '' : '<span class="badge">de confirmat</span>'}</div>`).join('')}</div>
          <p class="note" style="margin:12px 0 0">Calendarul se confirmă cu lista de declarații de la Sandina.</p></div>
        <div class="card"><h4>SAGA la zi</h4><div class="rows">${F.saga_module.map(m => `<div class="row c-${m.level === 'verde' ? 'verde' : m.level}"><span class="dot"></span>
          <div class="grow"><div class="t">${esc(m.nume)}</div><div class="s">înregistrat până la ${roDateL(m.pana_la)}</div></div><span class="r num" style="color:var(--c)">${-daysFrom(m.pana_la)} zile</span></div>`).join('')}</div>
          <p class="note" style="margin:12px 0 0">Din harta SAGA din ${roDateL(F.saga_as_of)}. ${F.nevalidate ? `<b>${F.nevalidate}</b> note nevalidate. ` : ''}e-Factura: <b>${F.efactura ? 'conectată' : 'neconectată'}</b>.</p></div>
      </div>
      <h2 class="sec">Impozite de confirmat <small>${esc(fis.sursa)}</small></h2>
      <div class="grid3">
        <div class="card"><h4>Impozit pe profit</h4><div class="acct"><div class="bal num">${money(fis.impozit_profit_de_plata)}</div></div><div class="s" style="color:var(--muted);font-size:14px">${esc(fis.impozit_profit_detaliu)}</div></div>
        <div class="card"><h4>Retrageri netaxate 2026</h4><div class="acct"><div class="bal num">${money(fis.retrageri_netaxate)}</div></div><div class="s" style="color:var(--muted);font-size:14px">de regularizat ca dividende</div></div>
        <div class="card"><h4>Impozit dividende estimat</h4><div class="acct"><div class="bal num">${money(fis.impozit_dividende_estimat)}</div></div><div class="s" style="color:var(--muted);font-size:14px">dacă retragerile devin dividende interimare</div></div>
      </div>
      <h2 class="sec">Acțiuni pentru firmă</h2>
      <div class="stack">${acts.length ? acts.map(actionCard).join('') : '<div class="empty"><b>Nimic deschis.</b></div>'}</div>`;
  },

  bani() {
    const B = DATA.bani;
    const acts = actionsView().open.filter(a => a.area === 'bani');
    const fact = Object.entries(B.facturat_luna || {});
    return `<div class="page-h"><div><div class="eyebrow">Conturi, credite, facturi</div><h1>Bani</h1></div><div class="srcs">${srcChips()}</div></div>
      <div class="grid3" style="margin-top:22px">${B.conturi.map(c => {
        const age = c.varsta_zile, lv = age == null ? 'gri' : age <= 8 ? 'verde' : age <= 21 ? 'galben' : 'rosu';
        return `<div class="card acct"><h4>${esc(c.nume)} · ${esc(c.cont)}</h4>
          <div class="bal num">${c.sold == null ? '<span style="color:var(--faint)">—</span>' : money(c.sold, c.moneda)}</div>
          <span class="age c-${lv}"><span class="dot"></span>${c.data ? 'extras din ' + roDateL(c.data) + (age != null ? ` · acum ${age} zile` : '') : 'niciun extras în folder'}</span>
          ${c.credit && c.sold == null && c.data ? '<div class="s" style="color:var(--faint);font-size:13px;margin-top:6px">soldul creditului se vede în extrasul PDF</div>' : ''}</div>`;
      }).join('')}</div>
      <div class="grid3" style="margin-top:16px">
        <div class="card"><h4>Facturat în ${esc(B.luna)}</h4>${fact.length ? fact.map(([m, v]) => `<div class="acct"><div class="bal num">${money(v, m)}</div></div>`).join('') : '<p style="margin:0;color:var(--muted)">Nicio factură emisă luna asta.</p>'}
          ${B.incasari_urmarite ? '' : `<p class="note" style="margin:12px 0 0">Încasările nu sunt marcate în factureaza (ultima: ${B.ultima_plata_marcata ? roDateL(B.ultima_plata_marcata) + ' ' + d0(B.ultima_plata_marcata).getFullYear() : '—'}). Le vezi în extrase.</p>`}</div>
        <div class="card"><h4>Linia de credit</h4><div class="acct"><div class="bal num">${money(B.linie_credit.folosit)}</div></div><div style="color:var(--muted);font-size:14px">folosit la ${roDateL(B.linie_credit.la)} (din audit)</div></div>
        <div class="card"><h4>Rata la spațiu</h4><div class="acct"><div class="bal num">${money(B.rata_spatiu)}<small>/lună</small></div></div><div style="color:var(--muted);font-size:14px">credit ING 680.000 lei, 120 de rate</div></div>
      </div>
      <h2 class="sec">Acțiuni pentru bani</h2>
      <div class="stack">${acts.length ? acts.map(actionCard).join('') : '<div class="empty"><b>Nimic deschis.</b></div>'}</div>`;
  },

  cafenea() {
    const C = DATA.cafenea, live = LIVE;
    const reps = (live?.rapoarte || C.rapoarte || []).slice().sort((a, b) => (b.data || '').localeCompare(a.data || ''));
    const y = reps[0];
    const acts = actionsView().open.filter(a => a.area === 'cafenea');
    const days = C.zile, maxB = Math.max(C.prag * 1.4, ...days.map(d => d.bonuri || 0));
    const W = 860, H = 220, bw = W / days.length;
    const chart = `<svg class="chart" viewBox="0 0 ${W} ${H + 30}" role="img" aria-label="Bonuri pe zi, ultimele 14 zile">
      <line x1="0" x2="${W}" y1="${H - C.prag / maxB * H}" y2="${H - C.prag / maxB * H}" stroke="var(--yellow)" stroke-dasharray="6 6" stroke-width="1.5"/>
      <text x="${W - 4}" y="${H - C.prag / maxB * H - 6}" text-anchor="end">prag ${C.prag} bonuri</text>
      ${days.map((d, i) => { const v = d.bonuri || 0, h = v / maxB * H; const c = d.bonuri == null ? 'var(--line2)' : v >= C.prag ? 'var(--green)' : 'var(--yellow)';
        return `<rect x="${i * bw + 8}" y="${d.bonuri == null ? H - 4 : H - h}" width="${bw - 16}" height="${d.bonuri == null ? 4 : Math.max(h, 2)}" rx="6" fill="${c}"/>
        <text x="${i * bw + bw / 2}" y="${H + 20}" text-anchor="middle">${d0(d.data).getDate()}</text>`; }).join('')}
    </svg>`;
    const setup = DATA.sources.find(s => s.id === 'tura')?.status !== 'ok' && !live;
    return `<div class="page-h"><div><div class="eyebrow">Craft Cafe · Play &amp; Study</div><h1>Cafeneaua</h1></div>
      <div class="srcs">${DATA.staff_api?.url ? `<button class="chip" id="rf">${svg('sync', 16)} Actualizează acum</button>` : ''}${srcChips()}</div></div>
      ${setup ? `<div class="setup" style="margin-top:22px"><h3>Aplicația de tură nu e încă pornită</h3><p>Rapoartele de închidere, bifele și programările apar aici după ce scriptul Google e autorizat. Pașii sunt în Panou_Tableta/PORNIRE.md, pe Mac.</p></div>` : ''}
      <div class="grid3" style="margin-top:22px">
        <div class="card"><h4>Ultimul raport${y ? ' · ' + roDateL(y.data) : ''}</h4>${y ? `
          <div class="acct"><div class="bal num">${money(y.z_total)}</div></div>
          <div class="rows"><div class="row"><div class="grow">Bonuri</div><div class="r num">${esc(y.bonuri)}</div></div>
          <div class="row"><div class="grow">Numerar / card</div><div class="r num">${nf.format(y.z_numerar || 0)} / ${nf.format(y.z_card || 0)}</div></div>
          <div class="row c-${Math.abs(+y.dif_numerar || 0) >= 1 ? 'rosu' : 'verde'}"><div class="grow">Diferență numerar</div><div class="r num" style="color:var(--c)">${nf2.format(+y.dif_numerar || 0)}</div></div>
          <div class="row c-${Math.abs(+y.dif_card || 0) >= 1 ? 'rosu' : 'verde'}"><div class="grow">Diferență card</div><div class="r num" style="color:var(--c)">${nf2.format(+y.dif_card || 0)}</div></div>
          <div class="row"><div class="grow">Închis de</div><div class="r">${esc(y.nume)}</div></div></div>
          ${y.poze?.length ? `<button class="btn full" style="margin-top:12px" data-photos="${esc(y.id)}">Vezi pozele (${y.poze.length})</button>` : ''}` : '<p style="margin:0;color:var(--muted)">Niciun raport primit încă.</p>'}</div>
        <div class="card" style="grid-column:span 2"><h4>Bonuri pe zi · ultimele 14 zile</h4>${chart}</div>
      </div>
      <div class="grid3" style="margin-top:16px">
        ${shiftsBlock(C.ture_azi, 'Azi')}${shiftsBlock(C.ture_maine, 'Mâine')}
        <div class="card"><h4>De comandat</h4>${(C.de_comandat || []).length ? `<div class="rows">${C.de_comandat.map(o => `<div class="row"><div class="grow"><div class="t">${esc(o.produs)}</div><div class="s">${esc(o.cat || '')} · ${esc(o.de_la || '')}, ${roDate(o.data)}</div></div></div>`).join('')}</div>` : '<p style="margin:0;color:var(--muted)">Nimic cerut în ultimele rapoarte.</p>'}</div>
      </div>
      ${reps.length > 1 ? `<h2 class="sec">Rapoarte de închidere</h2><div class="card"><div class="rows">${reps.slice(0, 14).map(r => `<div class="row"><div class="datebox"><b>${d0(r.data).getDate()}</b><span>${LUNI[d0(r.data).getMonth()]}</span></div>
        <div class="grow"><div class="t">${money(r.z_total)} · ${esc(r.bonuri)} bonuri</div><div class="s">${esc(r.nume)}${r.pierderi?.length ? ' · ' + r.pierderi.length + ' pierderi' : ''}${r.probleme ? ' · ' + esc(String(r.probleme).slice(0, 60)) : ''}</div></div>
        <span class="badge c-${Math.abs(+r.dif_numerar || 0) >= 1 || Math.abs(+r.dif_card || 0) >= 1 ? 'rosu' : 'verde'}" style="color:var(--c)">${Math.abs(+r.dif_numerar || 0) >= 1 || Math.abs(+r.dif_card || 0) >= 1 ? 'diferență' : 'ok'}</span></div>`).join('')}</div></div>` : ''}
      <h2 class="sec">Acțiuni pentru cafenea</h2>
      <div class="stack">${acts.length ? acts.map(actionCard).join('') : '<div class="empty"><b>Nimic deschis.</b></div>'}</div>`;
  },

  programari() {
    const P = LIVE ? { viitoare: LIVE.programari || [], cereri_site: LIVE.cereri_site || [] } : DATA.programari;
    const today = new Date().toISOString().slice(0, 10);
    const list = (P.viitoare || []).filter(e => e.data >= today).sort((a, b) => (a.data + a.ora).localeCompare(b.data + b.ora));
    const can = !!DATA.staff_api?.url;
    return `<div class="page-h"><div><div class="eyebrow">Petreceri, ateliere, sală</div><h1>Programări</h1></div>${can ? `<button class="chip" id="rf">${svg('sync', 16)} Actualizează acum</button>` : ''}</div>
      <div class="cols" style="margin-top:22px">
        <section class="stack">
          <div class="card"><h4>Următoarele</h4>${list.length ? `<div class="rows">${list.map(e => `<div class="row"><div class="datebox"><b>${d0(e.data).getDate()}</b><span>${LUNI[d0(e.data).getMonth()]}</span></div>
            <div class="grow"><div class="t">${esc(e.tip)} · ${esc(e.ora)} · ${esc(e.pachet || '')}</div><div class="s">${e.copii ? esc(e.copii) + ' copii · ' : ''}${esc(e.contact || '')}${e.avans ? ' · avans ' + nf.format(e.avans) + ' lei' : ''}${e.obs ? ' · ' + esc(e.obs) : ''}</div></div></div>`).join('')}</div>` : '<p style="margin:0;color:var(--muted)">Nicio programare.</p>'}</div>
          <div class="card"><h4>Cereri noi de pe site</h4>${(P.cereri_site || []).length ? `<div class="rows">${P.cereri_site.map((c, i) => `<div class="row"><div class="grow"><div class="t">${esc(c.tip)} · ${esc(c.nume)}</div><div class="s">${esc(c.telefon || '')} · ${roDate(c.data)} · ${esc(String(c.detalii || '').slice(0, 90))}</div></div>${can ? `<button class="btn" data-req="${i}">Fă programare</button>` : ''}</div>`).join('')}</div>` : '<p style="margin:0;color:var(--muted)">Nicio cerere nouă.</p>'}</div>
        </section>
        <aside class="card"><h4>Adaugă o programare</h4>
          ${can ? '' : '<p class="note" style="margin:0 0 14px">Se poate adăuga după ce pornești aplicația de tură (PORNIRE.md).</p>'}
          <form class="form" id="evf">
            <label><span>Data</span><input class="input" type="date" name="data" required value="${today}"></label>
            <label><span>Ora</span><input class="input" type="time" name="ora" required value="15:00"></label>
            <label><span>Tip</span><select name="tip"><option>Petrecere</option><option>Atelier</option><option>Sală închiriată</option></select></label>
            <label><span>Pachet</span><select name="pachet"><option>Safari Mini · 590</option><option>Safari Party · 990</option><option>Jungle Explorer · 1.490</option><option>Big Safari · 1.890</option><option>Atelier</option><option>Sală · 80/oră</option></select></label>
            <label><span>Copii</span><input class="input" type="number" name="copii" min="0" inputmode="numeric"></label>
            <label><span>Avans (lei)</span><input class="input" type="number" name="avans" min="0" inputmode="decimal"></label>
            <label class="wide"><span>Contact</span><input class="input" name="contact" placeholder="Nume și telefon"></label>
            <label class="wide"><span>Observații</span><textarea name="obs" placeholder="Tort, alergii, temă…"></textarea></label>
            <button class="btn primary wide" ${can ? '' : 'disabled'}>Salvează programarea</button>
          </form></aside>
      </div>`;
  },

  echipa() {
    const E = LIVE ? { sarcini: LIVE.sarcini || [], bife_azi: LIVE.bife_azi || [], schimburi: LIVE.schimburi || [] } : DATA.echipa;
    const can = !!DATA.staff_api?.url;
    const names = DATA.echipa.nume;
    const today = new Date().toISOString().slice(0, 10);
    const open = (E.sarcini || []).filter(t => !t.facut_la).slice(-20).reverse();
    const doneT = (E.sarcini || []).filter(t => t.facut_la).slice(-10).reverse();
    const bife = E.bife_azi || [];
    return `<div class="page-h"><div><div class="eyebrow">Fetele de la cafenea</div><h1>Echipa</h1></div>${can ? `<button class="chip" id="rf">${svg('sync', 16)} Actualizează acum</button>` : ''}</div>
      <div class="cols" style="margin-top:22px">
        <section class="stack">
          <div class="grid2">${shiftsBlock(DATA.cafenea.ture_azi, 'Azi în tură')}
            <div class="card"><h4>Checklist azi</h4>${['dim', 'sea'].map(t => { const n = bife.filter(b => b.tura === t).length; const tot = t === 'dim' ? 27 : 33;
              return `<div class="row"><div class="grow"><div class="t">${t === 'dim' ? 'Dimineață' : 'Seară'}</div><div class="s">${n} din aprox. ${tot} bife</div></div><div style="width:120px;height:10px;border-radius:6px;background:var(--surface2);overflow:hidden"><div style="height:100%;width:${Math.min(100, n / tot * 100)}%;background:var(--green)"></div></div></div>`; }).join('')}
              ${can ? '' : '<p class="note" style="margin:10px 0 0">Bifele apar live după pornirea aplicației de tură.</p>'}</div></div>
          <div class="card"><h4>Sarcini deschise</h4>${open.length ? `<div class="rows">${open.map(t => `<div class="row"><div class="grow"><div class="t">${esc(t.text)}</div><div class="s">${esc(t.pentru)} · ${roDate(t.data)}${t.sursa === 'verificare' ? ' · din verificarea de dimineață' : ''}</div></div></div>`).join('')}</div>` : '<p style="margin:0;color:var(--muted)">Nicio sarcină deschisă.</p>'}</div>
          ${doneT.length ? `<div class="card"><h4>Făcute recent</h4><div class="rows">${doneT.map(t => `<div class="row c-verde"><span class="dot"></span><div class="grow"><div class="t">${esc(t.text)}</div><div class="s">${esc(t.facut_de || '')} · ${esc(String(t.facut_la).slice(0, 16).replace('T', ' '))}</div></div></div>`).join('')}</div></div>` : ''}
        </section>
        <aside class="stack">
          <div class="card"><h4>Sarcină nouă</h4><form class="form" id="tf">
            <label class="wide"><span>Ce trebuie făcut</span><textarea name="text" required placeholder="ex. Curățați vitrina Hendi pe interior"></textarea></label>
            <label><span>Pentru</span><select name="pentru"><option value="tura dim">Tura de dimineață</option><option value="tura sea">Tura de seară</option>${names.map(n => `<option>${n}</option>`).join('')}<option value="toate">Toate</option></select></label>
            <label><span>Ziua</span><input class="input" type="date" name="data" value="${today}"></label>
            <button class="btn primary wide" ${can ? '' : 'disabled'}>Trimite sarcina</button></form></div>
          <div class="card"><h4>Schimbă o tură</h4><form class="form" id="sf">
            <label><span>Ziua</span><input class="input" type="date" name="data" value="${today}"></label>
            <label><span>Tura</span><select name="tura"><option value="dim">Dimineață</option><option value="sea">Seară</option></select></label>
            <label class="wide"><span>Lucrează</span><select name="nume">${names.map(n => `<option>${n}</option>`).join('')}</select></label>
            <button class="btn wide" ${can ? '' : 'disabled'}>Salvează schimbul</button></form></div>
        </aside>
      </div>`;
  },
};

function bind(scr) {
  bindActions();
  app.querySelectorAll('[data-src]').forEach(b => b.onclick = e => { e.stopPropagation(); srcPop(b.dataset.src); });
  const rf = $('#rf'); if (rf) rf.onclick = refreshLive;
  const formData = f => Object.fromEntries(new FormData(f).entries());
  const ev = $('#evf'); if (ev) ev.onsubmit = async e => { e.preventDefault(); try { await api('owner_add_event', { event: formData(ev) }); toast('Programare salvată'); await refreshLive(); } catch (x) { toast('Nu s-a salvat: ' + x.message); } };
  const tf = $('#tf'); if (tf) tf.onsubmit = async e => { e.preventDefault(); try { await api('owner_add_task', { task: formData(tf) }); toast('Sarcină trimisă'); await refreshLive(); } catch (x) { toast('Nu s-a trimis: ' + x.message); } };
  const sf = $('#sf'); if (sf) sf.onsubmit = async e => { e.preventDefault(); try { await api('owner_swap', formData(sf)); toast('Schimb salvat'); await refreshLive(); } catch (x) { toast('Nu s-a salvat: ' + x.message); } };
  app.querySelectorAll('[data-req]').forEach(b => b.onclick = () => {
    const c = (LIVE?.cereri_site || DATA.programari.cereri_site)[+b.dataset.req]; const f = $('#evf');
    f.contact.value = `${c.nume || ''} ${c.telefon || ''}`.trim(); f.obs.value = String(c.detalii || '').slice(0, 300); f.scrollIntoView({ behavior: 'smooth' });
  });
  app.querySelectorAll('[data-photos]').forEach(b => b.onclick = async () => {
    const r = (LIVE?.rapoarte || DATA.cafenea.rapoarte).find(x => x.id === b.dataset.photos);
    popup('<h4>Poze raport</h4><div id="ph" style="display:grid;gap:10px">Se încarcă…</div>');
    try {
      const imgs = await Promise.all(r.poze.map(id => api('owner_photo', { fileId: id })));
      $('#ph').innerHTML = imgs.map(i => `<img src="data:${i.mime};base64,${i.b64}" style="width:100%;border-radius:12px" alt="">`).join('');
    } catch (x) { $('#ph').textContent = 'Nu s-au putut încărca: ' + x.message; }
  });
}

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
window.addEventListener('hashchange', () => { const s = location.hash.slice(1); if (s && s !== SCREEN && DATA) { SCREEN = s; render(); } });
boot();
