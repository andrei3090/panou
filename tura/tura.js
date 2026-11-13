// Aplicatia de tura · Craft Cafe Play & Study
const $ = (s, el = document) => el.querySelector(s);
const app = $('#app');
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const LS = {
  get(k, d) { try { return JSON.parse(localStorage.getItem('tura.' + k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem('tura.' + k, JSON.stringify(v)); } catch { toast('Memoria telefonului e plină'); } },
};
const TODAY = () => { const d = new Date(); d.setMinutes(d.getMinutes() - d.getTimezoneOffset()); return d.toISOString().slice(0, 10); };
const ANIMAL = ['🦒', '🐒', '🦜', '🐘', '🦁', '🐢'];
const CHECK = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';

let CFG = { api: '' }, CL = null, S = LS.get('sesiune', null), TODAYDATA = null, TAB = 'tura';
const demo = () => !CFG.api;

// ------------------------------------------------------------------ retea + coada
async function call(action, payload = {}) {
  if (demo()) throw new Error('demo');
  const r = await fetch(CFG.api, { method: 'POST', body: JSON.stringify({ action, ...payload }) });
  const j = await r.json();
  if (!j.ok) throw new Error(j.error || 'eroare');
  return j;
}
const queue = () => LS.get('coada', []);
function enqueue(action, payload) { const q = queue(); q.push({ action, payload, t: Date.now() }); LS.set('coada', q); flush(); }
let flushing = false;
async function flush() {
  if (flushing || demo() || !navigator.onLine) return;
  flushing = true;
  try {
    let q = queue();
    while (q.length) {
      try { await call(q[0].action, { token: S?.token, ...q[0].payload }); }
      catch (e) { if (/token|sesiune/i.test(e.message)) { logout(); } break; }
      q.shift(); LS.set('coada', q);
    }
  } finally { flushing = false; renderBadge(); }
}
addEventListener('online', flush);

// ------------------------------------------------------------------ pornire
async function boot() {
  try { CFG = await (await fetch('config.json?t=' + Date.now(), { cache: 'no-store' })).json(); } catch { CFG = LS.get('cfg', { api: '' }); }
  LS.set('cfg', CFG);
  try { CL = await (await fetch('checklist.json')).json(); LS.set('cl', CL); } catch { CL = LS.get('cl', null); }
  if (S && S.data !== TODAY()) S = null;
  if (!S) return loginNames();
  await loadToday();
  render();
  flush();
}

async function loginNames() {
  let names = ['Barista A', 'Barista B', 'Barista C'];
  if (!demo()) { try { names = (await call('staff_names')).names; } catch { names = LS.get('names', names); } LS.set('names', names); }
  app.innerHTML = `<div class="login"><img class="logo" src="logo.png" alt="Craft Cafe · Play & Study">
    <h1>Cine ești azi?</h1>
    ${demo() ? '<div class="demo">Mod de probă: aplicația nu e încă legată, nimic nu se trimite.</div>' : ''}
    <div class="names">${names.map((n, i) => `<button class="name" data-n="${esc(n)}"><span class="e">${ANIMAL[i % 6]}</span>${esc(n)}</button>`).join('')}</div></div>`;
  app.querySelectorAll('[data-n]').forEach(b => b.onclick = () => pinScreen(b.dataset.n));
}

function pinScreen(name) {
  let pin = '';
  const draw = (err = '') => {
    app.innerHTML = `<div class="login"><img class="logo" src="logo.png" alt="" style="height:80px">
      <h1>Bună, ${esc(name)}!</h1><div style="color:var(--muted)">Scrie PIN-ul tău</div>
      <div class="pinrow">${[0, 1, 2, 3].map(i => `<i class="${i < pin.length ? 'f' : ''}"></i>`).join('')}</div>
      <div class="pad">${[1, 2, 3, 4, 5, 6, 7, 8, 9].map(d => `<button data-d="${d}">${d}</button>`).join('')}
        <button class="ghost" data-back>Înapoi</button><button data-d="0">0</button><button class="ghost" data-del>Șterge</button></div>
      <div class="err">${esc(err)}</div></div>`;
    app.querySelectorAll('[data-d]').forEach(b => b.onclick = () => { if (pin.length < 4) { pin += b.dataset.d; draw(); if (pin.length === 4) submit(); } });
    $('[data-del]').onclick = () => { pin = pin.slice(0, -1); draw(); };
    $('[data-back]').onclick = loginNames;
  };
  const submit = async () => {
    if (demo()) { S = { nume: name, token: 'demo', data: TODAY() }; LS.set('sesiune', S); await loadToday(); return render(); }
    try {
      const r = await call('staff_login', { nume: name, pin });
      S = { nume: name, token: r.token, data: TODAY() }; LS.set('sesiune', S);
      await loadToday(); render(); flush();
    } catch (e) { pin = ''; draw(/blocat/i.test(e.message) ? e.message : 'PIN greșit. Mai încearcă.'); }
  };
  draw();
}
function logout() { S = null; LS.set('sesiune', null); loginNames(); }

async function loadToday() {
  if (demo()) {
    TODAYDATA = LS.get('today', null);
    if (!TODAYDATA || TODAYDATA.data !== TODAY()) TODAYDATA = { data: TODAY(), tura: S.nume === 'Barista B' ? 'sea' : 'dim', ore: '05:45–14:15', colega: 'Barista B', sarcini: [], programari: [], bife: {} };
    return;
  }
  try { TODAYDATA = await call('staff_today', { token: S.token }); LS.set('today', TODAYDATA); }
  catch (e) { if (/token|sesiune/i.test(e.message)) return logout(); TODAYDATA = LS.get('today', null); }
}

// ------------------------------------------------------------------ bife
const tickKey = () => 'bife.' + TODAY();
const ticks = () => ({ ...(TODAYDATA?.bife || {}), ...LS.get(tickKey(), {}) });
function toggle(id) {
  const t = LS.get(tickKey(), {}); const all = ticks();
  const on = !all[id];
  if (on) t[id] = { la: new Date().toTimeString().slice(0, 5), de: S.nume }; else t[id] = null;
  LS.set(tickKey(), t);
  navigator.vibrate?.(12);
  enqueue('staff_tick', { data: TODAY(), tura: TODAYDATA.tura, item: id, facut: on });
  return on;
}

function sectionsFor(tura) {
  const sec = Object.fromEntries(CL.checklist.sectiuni.map(s => [s.id, s]));
  return tura === 'sea' ? [['predare', 'primește'], ['runde', ['14:00', '16:00', '18:00']], ['inchidere']]
    : [['deschidere'], ['runde', ['08:00', '10:00', '12:00']], ['predare', 'predă']];
}
function itemIds(tura) {
  const ids = [];
  for (const [sid, extra] of sectionsFor(tura)) {
    const s = CL.checklist.sectiuni.find(x => x.id === sid);
    if (sid === 'runde') s.itemi.forEach((_, r) => extra.forEach(h => ids.push(`runde.${r}.${h}`)));
    else if (s.grupuri) s.grupuri.forEach((g, gi) => g.itemi.forEach((_, ii) => ids.push(`${sid}.${gi}.${ii}`)));
    else s.itemi.forEach((_, ii) => ids.push(`${sid}.${ii}`));
  }
  return ids;
}
function progress() {
  const ids = itemIds(TODAYDATA.tura), t = ticks();
  return ids.length ? ids.filter(i => t[i]).length / ids.length : 0;
}

// ------------------------------------------------------------------ randare
function render() {
  if (!S) return loginNames();
  if (!TODAYDATA) { app.innerHTML = '<div class="wrap"><p>Nu am putut încărca tura. Verifică internetul.</p><button class="btn" onclick="location.reload()">Reîncearcă</button></div>'; return; }
  const p = progress();
  const tura = TODAYDATA.tura;
  app.innerHTML = `<div class="wrap">
    <header class="top"><img class="logo" src="logo.png" alt="Craft Cafe · Play &amp; Study">
      <div class="t"><h1>Bună, ${esc(S.nume)}!</h1>${tura ? `<span class="pill">${tura === 'dim' ? '🌅 Dimineață' : '🌙 Seară'} · ${esc(TODAYDATA.ore || '')}</span>` : '<span class="pill">Azi nu ești în program</span>'}</div>
      ${tura ? `<div class="ring"><svg width="62" height="62"><circle cx="31" cy="31" r="26" stroke="#E6DCC8" stroke-width="7" fill="none"/><circle cx="31" cy="31" r="26" stroke="#2F6B47" stroke-width="7" fill="none" stroke-linecap="round" stroke-dasharray="${2 * Math.PI * 26}" stroke-dashoffset="${2 * Math.PI * 26 * (1 - p)}"/></svg><b>${Math.round(p * 100)}%</b></div>` : ''}
    </header>
    ${demo() ? '<div class="demo">Mod de probă: nimic nu se trimite încă.</div>' : ''}
    ${queue().length ? `<div class="demo">⏳ ${queue().length} ${queue().length === 1 ? 'lucru așteaptă' : 'lucruri așteaptă'} internetul ca să fie trimise.</div>` : ''}
    <div id="body">${VIEW[TAB]()}</div></div>
    <nav class="tabs"><div class="in">
      <button class="tab ${TAB === 'tura' ? 'on' : ''}" data-tab="tura"><span class="e">✅</span>Tura mea</button>
      <button class="tab ${TAB === 'sarcini' ? 'on' : ''}" data-tab="sarcini"><span class="e">📋</span>Sarcini<i class="n" id="nb" style="${openTasks().length ? '' : 'display:none'}">${openTasks().length}</i></button>
      <button class="tab ${TAB === 'raport' ? 'on' : ''}" data-tab="raport"><span class="e">🧾</span>Raport</button>
      <button class="tab" data-out><span class="e">👋</span>Ieșire</button></div></nav>`;
  app.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { TAB = b.dataset.tab; render(); scrollTo(0, 0); });
  $('[data-out]').onclick = () => { if (confirm('Ieși din aplicație?')) logout(); };
  BIND[TAB]?.();
}
function renderBadge() { const n = openTasks().length, el = $('#nb'); if (el) { el.textContent = n; el.style.display = n ? '' : 'none'; } }
const openTasks = () => (TODAYDATA?.sarcini || []).filter(t => !t.facut_la && !LS.get('sarcini_facute', {})[t.id]);

const VIEW = {
  tura() {
    if (!TODAYDATA.tura) return `<div class="card"><h2><span class="e">🔄</span>Lucrezi azi?</h2><div class="f">
      <p>Azi nu ești în programul de ture. Dacă ții locul unei colege, alege tura:</p>
      <button class="btn full" data-swap="dim" style="margin-bottom:10px">🌅 Dimineață ${TODAYDATA.colegi?.dim ? '(în locul ' + esc(TODAYDATA.colegi.dim) + ')' : ''}</button>
      <button class="btn full" data-swap="sea">🌙 Seară ${TODAYDATA.colegi?.sea ? '(în locul ' + esc(TODAYDATA.colegi.sea) + ')' : ''}</button></div></div>`;
    const t = ticks();
    const ev = TODAYDATA.programari || [];
    let html = ev.length ? `<div class="card"><h2><span class="e">🎉</span>Azi la cafenea</h2>${ev.map(e => `<div class="ev"><b>${esc(e.ora)} · ${esc(e.tip)} · ${esc(e.pachet || '')}</b>${e.copii ? esc(e.copii) + ' copii · ' : ''}${esc(e.obs || '')}</div>`).join('')}</div>` : '';
    for (const [sid, extra] of sectionsFor(TODAYDATA.tura)) {
      const s = CL.checklist.sectiuni.find(x => x.id === sid);
      if (sid === 'runde') {
        html += `<div class="card"><h2><span class="e">${s.emoji}</span>Runde la 2 ore</h2><div class="rounds">${s.itemi.map((it, r) => `<div class="rrow"><div class="l">${esc(it)}</div><div class="hours">${extra.map(h => {
          const id = `runde.${r}.${h}`; return `<button class="hour ${t[id] ? 'on' : ''}" data-t="${id}">${h}</button>`; }).join('')}</div></div>`).join('')}</div>
          <div class="rules">${s.reguli.map(x => '• ' + esc(x)).join('<br>')}</div></div>`;
        continue;
      }
      const row = (id, txt) => `<button class="item ${t[id] ? 'on' : ''}" data-t="${id}"><span class="box">${CHECK}</span><span class="txt">${esc(txt)}${t[id] ? `<span class="who">${esc(t[id].de || '')} · ${esc(t[id].la || '')}</span>` : ''}</span></button>`;
      const body = s.grupuri ? s.grupuri.map((g, gi) => `<div class="grp"><h3>${esc(g.nume)}</h3>${g.itemi.map((x, ii) => row(`${sid}.${gi}.${ii}`, x)).join('')}</div>`).join('')
        : `<div class="grp">${s.itemi.map((x, ii) => row(`${sid}.${ii}`, x)).join('')}</div>`;
      html += `<div class="card" id="s-${sid}"><h2><span class="e">${s.emoji}</span>${esc(s.titlu)}${extra ? `<small>${esc(extra)}</small>` : ''}</h2><div class="sub">${esc(s.cand)}</div>${body}</div>`;
    }
    if (TODAYDATA.tura === 'sea') html += `<button class="btn primary full" data-tab2="raport">🧾 Completează raportul de închidere</button>`;
    return html;
  },
  sarcini() {
    const done = LS.get('sarcini_facute', {});
    const list = TODAYDATA.sarcini || [];
    if (!list.length) return '<div class="card"><h2><span class="e">📋</span>Sarcini de azi</h2><div class="empty">Nicio sarcină în plus azi. 🌿</div></div>';
    return `<div class="card"><h2><span class="e">📋</span>Sarcini de azi</h2>${list.map(x => { const on = x.facut_la || done[x.id];
      return `<button class="item ${on ? 'on' : ''}" data-task="${esc(x.id)}" style="padding:14px 16px"><span class="box">${CHECK}</span><span class="txt">${esc(x.text)}<span class="who">${x.sursa === 'verificare' ? 'din verificarea de dimineață' : 'de la Andrei'}</span></span></button>`; }).join('')}</div>`;
  },
  raport() {
    if (TODAYDATA.tura !== 'sea' && !LS.get('raport_fortat', false)) return `<div class="card"><h2><span class="e">🧾</span>Raport de închidere</h2><div class="f">
      <p>Raportul îl completează cine închide (tura de seară).</p><button class="btn full" data-force>Închid eu azi</button></div></div>`;
    const sent = LS.get('raport_trimis', null);
    if (sent === TODAY()) return `<div class="card"><h2><span class="e">✅</span>Raport trimis</h2><div class="empty">Raportul de azi a fost trimis. Mulțumim!</div></div>`;
    return raportForm();
  },
};

// ------------------------------------------------------------------ raport de inchidere
const R = () => LS.get('raport.' + TODAY(), { bn: {}, pierderi: [{}], comanda: [{}], petreceri: [], ver: {} });
const saveR = r => LS.set('raport.' + TODAY(), r);
const nval = v => { const x = parseFloat(String(v ?? '').replace(',', '.')); return isFinite(x) ? x : 0; };
const fmt = v => (Math.round(v * 100) / 100).toLocaleString('ro-RO', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const photos = {};

function raportForm() {
  const RI = CL.raport_inchidere, r = R();
  const field = ([label, unit, key]) => `<div class="fr"><label>${esc(label)}<small>${esc(unit)}</small></label><input inputmode="decimal" data-k="${key}" value="${esc(r[key] ?? '')}" class="num"></div>`;
  return `
  <div class="card"><h2><span class="e">🧾</span>Casa de marcat<small>din raportul Z</small></h2><div class="f">${RI.campuri_casa.map(field).join('')}</div></div>
  <div class="card"><h2><span class="e">💳</span>Card<small>terminalul POS</small></h2><div class="f">${field(RI.campuri_card[0])}<div class="calc" id="c-card"></div></div></div>
  <div class="card"><h2><span class="e">🐘</span>Numără banii<small>bucăți</small></h2><div class="f"><div class="bn">${RI.bancnote.map(b => `<div><b>${b === 'monede' ? 'monede (lei)' : b + ' lei'}</b><div class="ctl">${b === 'monede' ? `<input inputmode="decimal" data-bn="monede" value="${esc(r.bn.monede ?? '')}" style="width:100%;min-height:36px;border-radius:10px;border:1.5px solid var(--line2);text-align:center">` : `<button data-bm="${b}">−</button><span data-bv="${b}">${r.bn[b] || 0}</span><button data-bp="${b}">+</button>`}</div></div>`).join('')}</div>
    <div class="calc ok" style="margin-top:10px">Numărat în sertar <span id="bn-total" class="num"></span></div></div></div>
  <div class="card"><h2><span class="e">💵</span>Numerar</h2><div class="f">${field(RI.campuri_numerar[0])}${field(RI.campuri_numerar[1])}${field(RI.campuri_numerar[2])}
    <div class="calc" id="c-num"></div>${field(RI.campuri_numerar[4])}<div class="calc ok" id="c-plic"></div>
    <div id="expl-wrap"><label style="font-size:14px;font-weight:700;color:var(--clay)">De ce nu se potrivește?</label><textarea data-k="explicatie" placeholder="ex. rest greșit la un client, plată furnizor fără bon…">${esc(r.explicatie || '')}</textarea></div></div></div>
  <div class="card"><h2><span class="e">🗑️</span>Pierderi<small>expirat, stricat, greșit, protocol</small></h2><div class="f lines" id="l-pierderi"></div></div>
  <div class="card"><h2><span class="e">📦</span>De comandat</h2><div class="f lines" id="l-comanda"></div></div>
  <div class="card"><h2><span class="e">🎉</span>Petreceri și ateliere azi</h2><div class="f lines" id="l-petreceri"></div>
    <div class="f" style="padding-top:0"><div class="fr"><label>${esc(RI.copii_loc_joaca)}</label><input inputmode="numeric" data-k="copii" value="${esc(r.copii ?? '')}"></div></div></div>
  <div class="card"><h2><span class="e">⚠️</span>Probleme și incidente</h2><div class="f"><textarea data-k="probleme" placeholder="${esc(RI.probleme.indiciu)}">${esc(r.probleme || '')}</textarea></div></div>
  <div class="card"><h2><span class="e">📸</span>Poze obligatorii</h2><div class="f"><div class="photos">
    ${['z', 'pos'].map(k => `<label class="ph ${photos[k] ? 'ok' : ''}" id="ph-${k}">${photos[k] ? `<img src="data:image/jpeg;base64,${photos[k]}" alt="">` : ''}<span>${k === 'z' ? 'Raportul Z' : 'Bonul POS'}<br>${photos[k] ? '✓ refă' : '📷 fă poza'}</span><input type="file" accept="image/*" capture="environment" data-ph="${k}"></label>`).join('')}</div></div></div>
  <div class="card"><h2><span class="e">✅</span>Verificat la plecare</h2><div class="f">${RI.verificari.filter(v => !/Poze trimise/.test(v)).map((v, i) => `<label class="chk"><input type="checkbox" data-ver="${i}" ${r.ver[i] ? 'checked' : ''}> ${esc(v)}</label>`).join('')}</div></div>
  <button class="btn primary full" id="send">Trimite raportul</button><div class="err" id="serr" style="text-align:center"></div>`;
}

function lines(id, key, cols) {
  const r = R(); const el = $('#' + id); if (!el) return;
  const rows = r[key] || [];
  el.innerHTML = rows.map((x, i) => `<div class="ln ${cols === 3 ? 'c3' : ''}">${key === 'pierderi'
      ? `<input placeholder="Produs" data-l="${key}.${i}.produs" value="${esc(x.produs || '')}"><input placeholder="Cant." data-l="${key}.${i}.cant" value="${esc(x.cant || '')}">`
      : key === 'comanda' ? `<input placeholder="Produs" data-l="${key}.${i}.produs" value="${esc(x.produs || '')}"><input placeholder="Cât e / trebuie" data-l="${key}.${i}.cat" value="${esc(x.cat || '')}">`
        : `<input placeholder="Ora · ce a fost" data-l="${key}.${i}.ce" value="${esc(x.ce || '')}"><input placeholder="Încasat" inputmode="decimal" data-l="${key}.${i}.incasat" value="${esc(x.incasat || '')}">`}
      <button class="x" data-rm="${key}.${i}" aria-label="Șterge">×</button>
      ${key === 'pierderi' ? `<select data-l="${key}.${i}.motiv" style="grid-column:1/-1">${['', ...CL.raport_inchidere.pierderi.motive].map(m => `<option ${x.motiv === m ? 'selected' : ''} value="${m}">${m || 'Motiv…'}</option>`).join('')}</select>` : ''}</div>`).join('')
    + `<button class="add" data-addl="${key}">+ Adaugă rând</button>`;
}

function recalc() {
  const r = R();
  let bnT = nval(r.bn.monede);
  for (const b of CL.raport_inchidere.bancnote) if (b !== 'monede') bnT += (r.bn[b] || 0) * Number(b);
  $('#bn-total').textContent = fmt(bnT) + ' lei';
  if (bnT > 0) { r.numerar = bnT.toFixed(2); saveR(r); const inp = $('[data-k="numerar"]'); if (inp && document.activeElement !== inp) inp.value = r.numerar; }
  const difC = nval(r.pos_total) - nval(r.z_card);
  const difN = nval(r.numerar) + nval(r.plati) - nval(r.fond_start) - nval(r.z_numerar);
  const plic = nval(r.numerar) - nval(r.fond_ramas);
  const set = (id, label, v) => { const el = $('#' + id); el.className = 'calc ' + (Math.abs(v) < 0.5 ? 'ok' : 'bad'); el.innerHTML = `${label}<span class="num">${v > 0 ? '+' : ''}${fmt(v)} lei</span>`; };
  set('c-card', 'Diferență card (trebuie 0)', difC);
  set('c-num', 'Diferență numerar (trebuie 0)', difN);
  $('#c-plic').innerHTML = `În plicul zilei<span class="num">${fmt(plic)} lei</span>`;
  $('#expl-wrap').style.display = Math.abs(difC) >= 0.5 || Math.abs(difN) >= 0.5 ? '' : 'none';
  return { difC, difN, plic };
}

async function compress(file) {
  const img = await createImageBitmap(file);
  const s = Math.min(1, 1600 / Math.max(img.width, img.height));
  const c = document.createElement('canvas'); c.width = Math.round(img.width * s); c.height = Math.round(img.height * s);
  c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
  return c.toDataURL('image/jpeg', 0.72).split(',')[1];
}

const BIND = {
  tura() {
    app.querySelectorAll('[data-t]').forEach(b => b.onclick = () => {
      const on = toggle(b.dataset.t);
      b.classList.toggle('on', on);
      const t = ticks()[b.dataset.t]; const txt = b.querySelector('.txt');
      if (txt) { txt.querySelector('.who')?.remove(); if (on && t) txt.insertAdjacentHTML('beforeend', `<span class="who">${esc(t.de)} · ${esc(t.la)}</span>`); }
      const p = progress(); const ring = $('.ring');
      if (ring) { ring.querySelector('circle:last-child').setAttribute('stroke-dashoffset', 2 * Math.PI * 26 * (1 - p)); ring.querySelector('b').textContent = Math.round(p * 100) + '%'; }
      if (on && p >= 1) party('Gata, tura e bifată!', 'Mulțumim, ' + S.nume + '!');
    });
    app.querySelectorAll('[data-swap]').forEach(b => b.onclick = async () => {
      TODAYDATA.tura = b.dataset.swap; TODAYDATA.ore = b.dataset.swap === 'dim' ? '05:45–14:15' : '13:00–20:30';
      LS.set('today', TODAYDATA); enqueue('staff_swap', { tura: b.dataset.swap }); render();
    });
    const r2 = $('[data-tab2]'); if (r2) r2.onclick = () => { TAB = 'raport'; render(); scrollTo(0, 0); };
  },
  sarcini() {
    app.querySelectorAll('[data-task]').forEach(b => b.onclick = () => {
      const d = LS.get('sarcini_facute', {}); const id = b.dataset.task; const on = !d[id];
      if (on) d[id] = new Date().toISOString(); else delete d[id];
      LS.set('sarcini_facute', d); b.classList.toggle('on', on); navigator.vibrate?.(12);
      if (on) enqueue('staff_task_done', { id }); renderBadge();
    });
  },
  raport() {
    const f = $('[data-force]'); if (f) { f.onclick = () => { LS.set('raport_fortat', true); render(); }; return; }
    if (!$('#send')) return;
    lines('l-pierderi', 'pierderi'); lines('l-comanda', 'comanda'); lines('l-petreceri', 'petreceri');
    const body = $('#body');
    body.addEventListener('input', e => {
      const el = e.target, r = R();
      if (el.dataset.k) r[el.dataset.k] = el.value;
      if (el.dataset.bn) r.bn[el.dataset.bn] = el.value;
      if (el.dataset.l) { const [k, i, p] = el.dataset.l.split('.'); (r[k][i] ||= {})[p] = el.value; }
      if (el.dataset.ver) r.ver[el.dataset.ver] = el.checked;
      saveR(r); recalc();
    });
    body.addEventListener('click', e => {
      const el = e.target.closest('button'); if (!el) return;
      const r = R();
      if (el.dataset.bp || el.dataset.bm) { const b = el.dataset.bp || el.dataset.bm; r.bn[b] = Math.max(0, (r.bn[b] || 0) + (el.dataset.bp ? 1 : -1)); saveR(r); $(`[data-bv="${b}"]`).textContent = r.bn[b]; recalc(); }
      if (el.dataset.addl) { r[el.dataset.addl] = [...(r[el.dataset.addl] || []), {}]; saveR(r); lines('l-' + el.dataset.addl, el.dataset.addl); }
      if (el.dataset.rm) { const [k, i] = el.dataset.rm.split('.'); r[k].splice(+i, 1); saveR(r); lines('l-' + k, k); }
    });
    body.addEventListener('change', async e => {
      const el = e.target; if (!el.dataset.ph || !el.files?.[0]) return;
      const k = el.dataset.ph; const lab = $('#ph-' + k); lab.querySelector('span').textContent = 'Se pregătește…';
      try { photos[k] = await compress(el.files[0]); } catch { toast('Poza nu s-a putut citi. Mai încearcă.'); }
      const scroll = scrollY; render(); scrollTo(0, scroll);
    });
    recalc();
    $('#send').onclick = async () => {
      const r = R(), c = recalc(), err = $('#serr');
      const need = ['z_total', 'z_numerar', 'z_card', 'pos_total', 'fond_start', 'numerar'].filter(k => r[k] === undefined || r[k] === '');
      if (need.length) { err.textContent = 'Completează sumele din Z, POS și numerar.'; return; }
      if ((Math.abs(c.difC) >= 0.5 || Math.abs(c.difN) >= 0.5) && !(r.explicatie || '').trim()) { err.textContent = 'Scrie de ce nu se potrivesc banii.'; return; }
      if (!photos.z || !photos.pos) { err.textContent = 'Fă pozele la raportul Z și la bonul POS.'; return; }
      const clean = a => (a || []).filter(x => Object.values(x).some(v => String(v || '').trim()));
      const report = { data: TODAY(), nume: S.nume, z_nr: r.z_nr, bonuri: r.bonuri, z_total: nval(r.z_total), z_numerar: nval(r.z_numerar), z_card: nval(r.z_card),
        x_dimineata: r.x_dimineata ? nval(r.x_dimineata) : null, pos_total: nval(r.pos_total), dif_card: +c.difC.toFixed(2), fond_start: nval(r.fond_start),
        plati: nval(r.plati), numerar: nval(r.numerar), dif_numerar: +c.difN.toFixed(2), fond_ramas: nval(r.fond_ramas), plic: +c.plic.toFixed(2),
        bancnote: r.bn, explicatie: r.explicatie || '', pierderi: clean(r.pierderi), de_comandat: clean(r.comanda), petreceri: clean(r.petreceri),
        copii: r.copii || '', probleme: r.probleme || '', verificari: r.ver };
      enqueue('staff_report', { report, poze: [{ nume: 'Z', b64: photos.z }, { nume: 'POS', b64: photos.pos }] });
      LS.set('raport_trimis', TODAY());
      party('Raport trimis!', demo() ? 'Mod de probă: nu s-a trimis nicăieri.' : 'Mulțumim! Poți încuia liniștită. 🌙');
      setTimeout(render, 2500);
    };
  },
};

function party(title, sub) {
  const el = document.createElement('div'); el.className = 'party';
  el.innerHTML = `<div><div class="big">${ANIMAL[Math.floor(Math.random() * 6)]}</div><h2>${esc(title)}</h2><p>${esc(sub)}</p></div>`;
  el.onclick = () => el.remove(); document.body.append(el); setTimeout(() => el.remove(), 2400);
}
function toast(t) { const el = document.createElement('div'); el.className = 'toast'; el.textContent = t; document.body.append(el); setTimeout(() => el.remove(), 2600); }

if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
document.addEventListener('visibilitychange', () => { if (!document.hidden && S) { if (S.data !== TODAY()) logout(); else flush(); } });
boot();
