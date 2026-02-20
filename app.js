// =====================================================
// HYPE ROLEPLAY – PLANNER   app.js  (Firebase Edition)
// =====================================================

// ── FIREBASE INIT ──────────────────────────────────
const firebaseConfig = {
    apiKey: "AIzaSyAZc5JWUh6VrHk_CemrwxdlmAX6WNDil48",
    authDomain: "social-media-hype.firebaseapp.com",
    projectId: "social-media-hype",
    storageBucket: "social-media-hype.firebasestorage.app",
    messagingSenderId: "49808034889",
    appId: "1:49808034889:web:dd6a438be6ce49c1790398",
    measurementId: "G-4Q2PNW053C"
};
firebase.initializeApp(firebaseConfig);
const db = firebase.firestore();
const dataRef = db.collection('plannerData').doc('main');
const usersRef = db.collection('config').doc('users');
let _syncUnsub = null; // real-time listener unsubscribe handle

// ── CLOUDINARY CONFIG ───────────────────────────────
const CLOUDINARY_CLOUD = 'dm9jzth0g';
const CLOUDINARY_PRESET = 'social midia hype';

async function uploadToCloudinary(file) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', CLOUDINARY_PRESET);
    formData.append('resource_type', 'auto');
    const res = await fetch(`https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD}/auto/upload`, { method: 'POST', body: formData });
    if (!res.ok) throw new Error('Erro no upload');
    const json = await res.json();
    return json.secure_url;
}

function addFileUploadSection(item, accept = 'image/*,video/*,.pdf') {
    const body = document.getElementById('modalBody');
    const sec = document.createElement('div');
    sec.className = 'field-group';
    sec.id = 'fileUploadSection';
    sec.innerHTML = `<label>📎 Arquivo Entregue</label>
    ${item?.fileUrl ? `<div id="filePreview" style="margin-bottom:8px">
        <a href="${item.fileUrl}" target="_blank" class="btn-ghost" style="display:inline-flex;align-items:center;gap:6px;font-size:13px">📄 Ver arquivo enviado</a>
        <button id="removeFileBtn" class="btn-ghost" style="color:#e05;margin-left:8px;font-size:12px">🗑️ Remover</button>
    </div>` : ''}
    <input type="file" id="fileUploadInput" accept="${accept}" style="margin-top:4px;color:#ccc;font-size:13px">
    <small style="color:#888;margin-top:4px;display:block">Imagens, vídeos ou PDF</small>`;
    body.appendChild(sec);

    const removeBtn = document.getElementById('removeFileBtn');
    if (removeBtn) {
        removeBtn.addEventListener('click', () => {
            document.getElementById('filePreview').remove();
            // Mark for removal
            document.getElementById('fileUploadInput').dataset.removeFile = 'true';
        });
    }
}

function addCreativeIdeasSection(item) {
    const body = document.getElementById('modalBody');
    const sec = document.createElement('div');
    sec.className = 'field-group';
    sec.id = 'creativeIdeasSection';

    sec.innerHTML = `<label>🔗 Links de Referência</label>
    <textarea id="referenciaLinks" class="field" placeholder="Cole URLs de referência, uma por linha" style="min-height:80px;resize:vertical;margin-top:4px">${(item?.referenciaLinks || []).join('\n')}</textarea>`;
    body.appendChild(sec);
}

// ── PARTICLES ──────────────────────────────────────
(function () {
    const cv = document.getElementById('particleCanvas');
    const cx = cv.getContext('2d');
    let W, H, pts = [];
    const cols = ['rgba(196,181,253,', 'rgba(251,207,232,', 'rgba(167,139,250,', 'rgba(244,114,182,', 'rgba(255,255,255,'];

    function resize() { W = cv.width = window.innerWidth; H = cv.height = window.innerHeight; }
    function mk() {
        const life = Math.random() * 200 + 80;
        return { x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.6 + .3, vx: (Math.random() - .5) * .22, vy: -(Math.random() * .35 + .08), col: cols[Math.floor(Math.random() * cols.length)], a: Math.random() * .45 + .08, life, maxLife: life, star: Math.random() > .72 };
    }
    function init() { pts = []; for (let i = 0; i < 80; i++) { const p = mk(); p.life = Math.random() * p.life; p.maxLife = p.life; pts.push(p); } }
    function loop() {
        cx.clearRect(0, 0, W, H);
        pts.forEach((p, i) => {
            p.x += p.vx; p.y += p.vy; p.life--;
            const a = p.a * Math.sin(p.life / p.maxLife * Math.PI);
            if (p.star) { cx.save(); cx.globalAlpha = a * .65; cx.fillStyle = p.col + '1)'; cx.font = `${p.r * 7}px serif`; cx.textAlign = 'center'; cx.textBaseline = 'middle'; cx.fillText('✦', p.x, p.y); cx.restore(); }
            else { cx.beginPath(); cx.arc(p.x, p.y, p.r, 0, Math.PI * 2); cx.fillStyle = p.col + a.toFixed(2) + ')'; cx.fill(); }
            if (p.life <= 0 || p.y < -10 || p.x < -10 || p.x > W + 10) { pts[i] = mk(); pts[i].maxLife = pts[i].life; }
        });
        requestAnimationFrame(loop);
    }
    window.addEventListener('resize', () => { resize(); init(); });
    resize(); init(); loop();
})();


// ── AUTH ────────────────────────────────────────────
const ROLE_TABS = { admin: ['dashboard', 'calendario', 'videos', 'artes', 'demanda', 'usuarios'], designer: ['dashboard', 'calendario', 'artes', 'demanda'], videomaker: ['dashboard', 'calendario', 'videos', 'demanda'] };
const ROLE_LABELS = { admin: '👑 Admin', designer: '🎨 Designer', videomaker: '🎬 Videomaker' };

// ─── USERS (Firestore-backed, localStorage cache) ──
function getUsers() { return JSON.parse(localStorage.getItem('hype_users_v1') || '[]'); }

function saveUsers(users) {
    localStorage.setItem('hype_users_v1', JSON.stringify(users));
    usersRef.set({ list: users }).catch(e => console.warn('SaveUsers Firestore error:', e));
}

function initUsers() {
    // Seed default admin if first time
    const DEFAULT = [{ username: 'admin', password: 'hype2025', role: 'admin' }];
    usersRef.get().then(doc => {
        if (doc.exists && doc.data().list?.length > 0) {
            // Trust Firestore as source of truth
            localStorage.setItem('hype_users_v1', JSON.stringify(doc.data().list));
        } else {
            // First run: push defaults to Firestore
            const local = getUsers().length ? getUsers() : DEFAULT;
            localStorage.setItem('hype_users_v1', JSON.stringify(local));
            usersRef.set({ list: local });
        }
    }).catch(() => {
        // Offline fallback
        if (!getUsers().length) localStorage.setItem('hype_users_v1', JSON.stringify(DEFAULT));
    });
}

function doLogin() {
    const user = document.getElementById('loginUser').value.trim().toLowerCase();
    const pass = document.getElementById('loginPass').value;
    const err = document.getElementById('loginError');
    err.textContent = '';
    const found = getUsers().find(u => u.username.toLowerCase() === user && u.password === pass);
    if (!found) { err.textContent = 'Usuário ou senha incorretos.'; return; }
    sessionStorage.setItem('hype_session', JSON.stringify({ username: found.username, role: found.role }));
    applyLogin(found.username, found.role);
}

function applyLogin(username, role) {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('appRoot').classList.add('visible');
    document.body.className = document.body.className.replace(/role-\S+/g, '').trim();
    document.body.classList.add('role-' + role);

    const av = document.getElementById('sfAvatar'); if (av) av.textContent = username.charAt(0).toUpperCase();
    const un = document.getElementById('sfUsername'); if (un) un.textContent = username;
    const rl = document.getElementById('sfRole'); if (rl) rl.textContent = ROLE_LABELS[role] || role;

    const allowed = ROLE_TABS[role] || [];
    let firstTab = null;
    document.querySelectorAll('.nav-item').forEach(btn => {
        const roles = (btn.dataset.roles || '').split(',');
        if (roles.includes(role)) { btn.style.display = ''; if (!firstTab) firstTab = btn.dataset.tab; }
        else { btn.style.display = 'none'; }
        btn.classList.remove('active');
    });
    document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
    if (firstTab) {
        const btn = document.querySelector(`.nav-item[data-tab="${firstTab}"]`);
        if (btn) btn.classList.add('active');
        const panel = document.getElementById('tab-' + firstTab);
        if (panel) panel.classList.add('active');
        const tt = document.getElementById('topbarTitle'); if (tt) tt.textContent = topTitles[firstTab] || '';
    }
    const mnav = document.querySelector('.month-nav');
    if (mnav) mnav.style.display = (role === 'admin') ? 'flex' : 'none';

    updateDate(); updateMonthLabel();

    // Load data then start real-time sync
    loadData().then(() => {
        renderAll();
        startRealtimeSync();
    });
}

function doLogout() {
    sessionStorage.removeItem('hype_session');
    if (_syncUnsub) { _syncUnsub(); _syncUnsub = null; }
    document.body.className = document.body.className.replace(/role-\S+/g, '').trim();
    document.getElementById('appRoot').classList.remove('visible');
    document.getElementById('loginScreen').classList.remove('hidden');
    document.getElementById('loginUser').value = '';
    document.getElementById('loginPass').value = '';
    document.getElementById('loginError').textContent = '';
}


// ── STATE ──────────────────────────────────────────
let currentMonth, currentYear;
let data = { videos: [], artes: [], demanda: [], eventos: {}, meta: {} };
let editTarget = null, calDate = null, modalSection = null;
let _isSaving = false; // guard to avoid re-render loop on own writes

const statuses = ['a-fazer', 'em-andamento', 'revisao', 'concluido', 'publicado', 'cancelado'];
const statusLabels = { 'a-fazer': 'A Fazer', 'em-andamento': 'Em Andamento', 'revisao': 'Revisão', 'concluido': 'Concluído', 'publicado': 'Publicado', 'cancelado': 'Cancelado' };
const statusEmoji = { 'a-fazer': '✦', 'em-andamento': '⏳', 'revisao': '✧', 'concluido': '✅', 'publicado': '🚀', 'cancelado': '✗' };
const calMonths = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro'];
const calDays = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
const topTitles = { dashboard: 'Dashboard', calendario: 'Calendário', videos: 'Vídeos', artes: 'Artes', demanda: 'Demanda Mensal', usuarios: 'Usuários' };


// ── FIREBASE DATA LAYER ────────────────────────────
async function loadData() {
    try {
        const doc = await dataRef.get();
        if (doc.exists) {
            data = doc.data();
            // ensure arrays exist
            data.videos = data.videos || [];
            data.artes = data.artes || [];
            data.demanda = data.demanda || [];
            data.eventos = data.eventos || {};
            data.meta = data.meta || {};
        }
    } catch (e) {
        console.warn('Firestore loadData error (using empty data):', e);
    }
}

function saveData() {
    _isSaving = true;
    const clean = JSON.parse(JSON.stringify(data)); // strip undefined
    dataRef.set(clean).catch(e => console.warn('Firestore saveData error:', e))
        .finally(() => setTimeout(() => { _isSaving = false; }, 500));
    // Also cache locally for resilience
    try { localStorage.setItem('hype_v4', JSON.stringify(clean)); } catch (e) { }
}

function startRealtimeSync() {
    if (_syncUnsub) _syncUnsub(); // cancel previous listener
    _syncUnsub = dataRef.onSnapshot(doc => {
        if (!doc.exists) return;
        if (_isSaving) return; // ignore echo of own writes
        if (doc.metadata.hasPendingWrites) return; // still local, wait for server confirmation
        data = doc.data();
        data.videos = data.videos || [];
        data.artes = data.artes || [];
        data.demanda = data.demanda || [];
        data.eventos = data.eventos || {};
        data.meta = data.meta || {};
        renderAll();
        updateMonthLabel();
    }, err => console.warn('Firestore sync error:', err));
}

function renderAll() {
    renderDashboard(); renderCalendar(); renderVideos(); renderArtes(); renderDemanda(); renderUsers();
}


// ── INIT ───────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
    const now = new Date();
    currentMonth = now.getMonth();
    currentYear = now.getFullYear();

    initUsers();

    // Login
    document.getElementById('loginBtn').addEventListener('click', doLogin);
    document.getElementById('loginPass').addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); });
    document.getElementById('loginUser').addEventListener('keydown', e => { if (e.key === 'Enter') document.getElementById('loginPass').focus(); });
    document.getElementById('pwToggle').addEventListener('click', () => {
        const f = document.getElementById('loginPass');
        f.type = f.type === 'password' ? 'text' : 'password';
    });

    // Restore session
    const sess = sessionStorage.getItem('hype_session');
    if (sess) { const { username, role } = JSON.parse(sess); applyLogin(username, role); }

    // Sidebar nav
    document.querySelectorAll('.nav-item').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.nav-item').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.panel').forEach(p => p.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById('tab-' + btn.dataset.tab).classList.add('active');
            const el = document.getElementById('topbarTitle'); if (el) el.textContent = topTitles[btn.dataset.tab] || '';
        });
    });

    // Month nav
    document.getElementById('prevMonth').addEventListener('click', () => { currentMonth--; if (currentMonth < 0) { currentMonth = 11; currentYear--; } updateMonthLabel(); renderCalendar(); renderDemanda(); });
    document.getElementById('nextMonth').addEventListener('click', () => { currentMonth++; if (currentMonth > 11) { currentMonth = 0; currentYear++; } updateMonthLabel(); renderCalendar(); renderDemanda(); });

    // Buttons
    document.getElementById('addVideoBtn').addEventListener('click', () => openVideoModal());
    document.getElementById('addArteBtn').addEventListener('click', () => openArteModal());
    document.getElementById('addDemandaBtn').addEventListener('click', () => openDemandaModal());
    document.getElementById('addUserBtn').addEventListener('click', () => openUserModal());
    document.getElementById('saveMetaBtn').addEventListener('click', saveMeta);
    document.getElementById('logoutBtn').addEventListener('click', doLogout);

    // Modal
    document.getElementById('modalCloseBtn').addEventListener('click', closeModal);
    document.getElementById('modalCancelBtn').addEventListener('click', closeModal);
    document.getElementById('modalConfirmBtn').addEventListener('click', saveModal);
    document.getElementById('modalOverlay').addEventListener('click', e => { if (e.target === document.getElementById('modalOverlay')) closeModal(); });

    // Calendar panel
    document.getElementById('addEventBtn').addEventListener('click', addCalEvent);
    document.getElementById('closePanelBtn').addEventListener('click', () => { document.getElementById('eventDetailPanel').style.display = 'none'; calDate = null; });
    document.getElementById('eventDetailPanel').addEventListener('click', e => { if (e.target === document.getElementById('eventDetailPanel')) { document.getElementById('eventDetailPanel').style.display = 'none'; calDate = null; } });
});


// ── HELPERS ────────────────────────────────────────
function genId() { return Date.now().toString(36) + Math.random().toString(36).slice(2, 5); }

function updateDate() {
    const d = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
    const m = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
    const n = new Date();
    const el = document.getElementById('currentDate'); if (el) el.textContent = `${d[n.getDay()]}, ${n.getDate()} ${m[n.getMonth()]} ${n.getFullYear()}`;
}
function updateMonthLabel() {
    const mk = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const lbl = `${calMonths[currentMonth]} ${currentYear}`;
    const ml = document.getElementById('monthLabel'); if (ml) ml.textContent = lbl;
    const dml = document.getElementById('demandaMonthLabel'); if (dml) dml.textContent = lbl;
    const meta = data.meta[mk] || {};
    const mv = document.getElementById('metaVideos'); if (mv) mv.value = meta.videos || '';
    const ma = document.getElementById('metaArtes'); if (ma) ma.value = meta.artes || '';
}
function showNotif(msg) {
    const el = document.createElement('div'); el.className = 'notif'; el.textContent = msg;
    document.body.appendChild(el); setTimeout(() => el.remove(), 2900);
}


// ── STATUS ─────────────────────────────────────────
function cycleStatus(section, id) {
    const item = data[section].find(i => i.id === id); if (!item) return;
    const oldStatus = item.status;
    item.status = statuses[(statuses.indexOf(item.status) + 1) % statuses.length];

    if ((item.status === 'concluido' || item.status === 'publicado') &&
        oldStatus !== 'concluido' && oldStatus !== 'publicado') {
        const today = new Date();
        const dk = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
        if (!data.eventos[dk]) data.eventos[dk] = [];
        const emoji = item.status === 'publicado' ? '🚀' : '✅';
        const label = item.status === 'publicado' ? 'Publicado' : 'Entregue';
        const setor = section === 'videos' ? 'Vídeo' : section === 'artes' ? 'Arte' : 'Demanda';
        const calType = section === 'videos' ? 'video' : section === 'artes' ? 'arte' : 'outro';
        data.eventos[dk].push({ title: `${emoji} [${label} · ${setor}] ${item.titulo}`, type: calType });
        renderCalendar();
    }

    saveData();
    if (section === 'videos') renderVideos(); else if (section === 'artes') renderArtes(); else renderDemanda();
    renderDashboard(); showNotif('Status: ' + statusLabels[item.status]);
}
function makeBadge(sec, id, st) {
    const sp = document.createElement('span');
    sp.className = `badge ${st}`; sp.title = 'Clique para avançar o status';
    sp.textContent = `${statusEmoji[st]} ${statusLabels[st]}`;
    sp.addEventListener('click', () => cycleStatus(sec, id));
    return sp;
}


// ── DASHBOARD ──────────────────────────────────────
function renderDashboard() {
    const all = [...(data.videos || []), ...(data.artes || [])];
    const mk = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const mv = (data.videos || []).filter(v => v.date && v.date.startsWith(mk));
    const ma = (data.artes || []).filter(a => a.date && a.date.startsWith(mk));
    const total = all.length;
    const done = all.filter(i => i.status === 'concluido').length;
    const pub = all.filter(i => i.status === 'publicado').length;
    const prog = all.filter(i => i.status === 'em-andamento').length;
    const todo = all.filter(i => i.status === 'a-fazer').length;
    const s = (id, v) => { const e = document.getElementById(id); if (e) e.textContent = v; };
    const w = (id, p) => { const e = document.getElementById(id); if (e) e.style.width = p + '%'; };
    const pct = v => total === 0 ? 0 : Math.min(100, Math.round(v / total * 100));
    s('stat-videos', mv.length); s('stat-artes', ma.length);
    s('stat-done', done); s('stat-progress', prog); s('stat-todo', todo); s('stat-pub', pub);
    w('bar-videos', mv.length ? 55 : 0); w('bar-artes', ma.length ? 55 : 0);
    w('bar-done', pct(done)); w('bar-progress', pct(prog)); w('bar-todo', pct(todo)); w('bar-pub', pct(pub));

    const recent = [...(data.demanda || [])].sort((a, b) => b.id > a.id ? 1 : -1).slice(0, 6);
    const list = document.getElementById('recentList'); if (!list) return;
    if (!recent.length) { list.innerHTML = '<p class="empty-msg">Nenhuma tarefa ainda.</p>'; return; }
    list.innerHTML = '';
    recent.forEach(item => {
        const div = document.createElement('div'); div.className = 'recent-item';
        div.style.cursor = 'pointer'; // Make it look clickable
        div.innerHTML = `<span class="recent-item-icon">${item.categoria === 'video' ? '🎬' : item.categoria === 'arte' ? '🎨' : '✦'}</span>
      <div class="recent-item-info"><div class="recent-item-title">${item.titulo}</div>
      <div class="recent-item-sub">${item.responsavel || 'Sem responsável'} · ${item.prazo || 'Sem prazo'}</div></div>`;
        div.appendChild(makeBadge('demanda', item.id, item.status));

        // Add click listener to open details (skipping the badge click)
        div.addEventListener('click', (e) => {
            // If clicked on badge, don't open modal (badge cycles status)
            if (e.target.closest('.badge')) return;
            openDemandaModal(item.id);
        });

        list.appendChild(div);
    });
}


// ── CALENDAR ───────────────────────────────────────
function renderCalendar() {
    const ct = document.getElementById('calTitle'); if (ct) ct.textContent = `${calMonths[currentMonth]} ${currentYear}`;
    const grid = document.getElementById('calendarGrid'); if (!grid) return;
    grid.innerHTML = '';
    calDays.forEach(d => { const h = document.createElement('div'); h.className = 'cal-header-day'; h.textContent = d; grid.appendChild(h); });
    const first = new Date(currentYear, currentMonth, 1).getDay();
    const dim = new Date(currentYear, currentMonth + 1, 0).getDate();
    const now = new Date();
    const todayKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    for (let i = 0; i < first; i++) { const e = document.createElement('div'); e.className = 'cal-day empty'; grid.appendChild(e); }
    for (let d = 1; d <= dim; d++) {
        const dk = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
        const evs = (data.eventos || {})[dk] || [];
        const el = document.createElement('div');
        el.className = 'cal-day' + (dk === todayKey ? ' today' : '') + (evs.length > 0 ? ' has-events' : '');
        const num = document.createElement('div'); num.className = 'cal-day-num'; num.textContent = d; el.appendChild(num);
        evs.slice(0, 2).forEach(ev => { const c = document.createElement('div'); c.className = `chip chip-${ev.type}`; c.textContent = ev.title; el.appendChild(c); });
        if (evs.length > 2) { const more = document.createElement('div'); more.className = 'chip chip-outro'; more.textContent = `+${evs.length - 2} mais`; el.appendChild(more); }
        el.addEventListener('click', () => openCalPanel(dk, d));
        grid.appendChild(el);
    }
}
function openCalPanel(dk, day) {
    calDate = dk;
    const [y, m, d] = dk.split('-');
    const dateObj = new Date(y, m - 1, d);
    const dayStr = String(day).padStart(2, '0');
    const weekdays = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
    const weekdayStr = weekdays[dateObj.getDay()];
    const monthYearStr = `${calMonths[currentMonth]} de ${currentYear}`;

    const pNum = document.getElementById('panelDayNum'); if (pNum) pNum.textContent = dayStr;
    const pWd = document.getElementById('panelWeekday'); if (pWd) pWd.textContent = weekdayStr;
    const pMy = document.getElementById('panelMonthYear'); if (pMy) pMy.textContent = monthYearStr;

    renderCalEvents(dk);
    const p = document.getElementById('eventDetailPanel'); if (p) { p.style.display = 'flex'; }
}
function renderCalEvents(dk) {
    const evs = (data.eventos || {})[dk] || [];
    const c = document.getElementById('panelEvents'); if (!c) return;
    c.innerHTML = '';
    if (!evs.length) { c.innerHTML = '<p class="empty-msg" style="border:none; background:rgba(250,245,255,.01)">Nenhuma tarefa planejada para este dia.</p>'; return; }
    evs.forEach((ev, idx) => {
        const row = document.createElement('div'); row.className = `ep-row agenda-item chip-${ev.type}`;
        row.style.flexDirection = 'column'; row.style.alignItems = 'flex-start';

        const top = document.createElement('div'); top.style.display = 'flex'; top.style.alignItems = 'center'; top.style.gap = '10px'; top.style.width = '100%';
        top.innerHTML = `<span class="chip chip-${ev.type}">${typeLabel(ev.type)}</span><span class="ep-row-text">${ev.title}</span><button class="ep-del" title="Remover" style="margin-left:auto;">×</button>`;
        row.appendChild(top);

        if (ev.obs) {
            const obsDiv = document.createElement('div');
            obsDiv.style.fontSize = '11px'; obsDiv.style.color = 'var(--wm)'; obsDiv.style.marginTop = '4px'; obsDiv.style.fontStyle = 'italic'; obsDiv.style.paddingLeft = '5px';
            obsDiv.textContent = ev.obs;
            row.appendChild(obsDiv);
        }

        top.querySelector('.ep-del').addEventListener('click', () => {
            data.eventos[dk].splice(idx, 1); if (!data.eventos[dk].length) delete data.eventos[dk];
            saveData(); renderCalendar(); renderCalEvents(dk);
        });
        c.appendChild(row);
    });
}
function typeLabel(t) { return { video: '🎬 Vídeo', arte: '🎨 Arte', post: '📸 Post', live: '📡 Live', outro: '✦ Outro' }[t] || t; }
function addCalEvent() {
    if (!calDate) return;
    const title = document.getElementById('newEventTitle').value.trim();
    const obs = document.getElementById('newEventObs').value.trim();
    const type = document.getElementById('newEventType').value;
    if (!title) { showNotif('Digite um título ✦'); return; }
    if (!data.eventos[calDate]) data.eventos[calDate] = [];
    data.eventos[calDate].push({ title, type, obs });
    document.getElementById('newEventTitle').value = '';
    document.getElementById('newEventObs').value = '';
    saveData(); renderCalendar(); renderCalEvents(calDate); showNotif('Evento adicionado ✦');
}


// ── TABLES ─────────────────────────────────────────
function renderVideos() {
    const tb = document.getElementById('videosTbody'); if (!tb) return;
    const list = data.videos || [];
    if (!list.length) { tb.innerHTML = '<tr><td colspan="7"><p class="empty-msg">Nenhum vídeo ainda.</p></td></tr>'; return; }
    tb.innerHTML = '';
    list.forEach(item => {
        const tr = document.createElement('tr');
        const sc = document.createElement('td'); sc.appendChild(makeBadge('videos', item.id, item.status));

        // Make title clickable
        const titleTd = document.createElement('td');
        titleTd.innerHTML = `<strong>${item.titulo}</strong>${item.fileUrl ? ` <a href="${item.fileUrl}" target="_blank" title="Ver arquivo" style="font-size:13px;text-decoration:none">📎</a>` : ''}`;
        titleTd.style.cursor = 'pointer';
        titleTd.title = 'Ver detalhes';
        titleTd.addEventListener('click', (e) => { if (e.target.tagName === 'A') return; openVideoModal(item.id); });

        tr.appendChild(titleTd);
        tr.innerHTML += `<td>${item.tipo || '—'}</td><td>${item.responsavel || '—'}</td><td>${item.date || '—'}</td>`;
        tr.appendChild(sc);
        const pd = document.createElement('td'); pd.textContent = item.plataforma || '—'; tr.appendChild(pd);
        const ac = document.createElement('td');

        // Check if admin
        const sess = sessionStorage.getItem('hype_session');
        const role = sess ? JSON.parse(sess).role : 'designer';
        if (role === 'admin') {
            ac.innerHTML = '<button class="btn-tbl">✏️</button><button class="btn-tbl d">🗑️</button>';
            ac.querySelectorAll('.btn-tbl')[0].addEventListener('click', () => openVideoModal(item.id));
            ac.querySelectorAll('.btn-tbl')[1].addEventListener('click', () => delItem('videos', item.id));
        } else {
            ac.innerHTML = '<button class="btn-tbl">👁️</button>';
            ac.querySelectorAll('.btn-tbl')[0].addEventListener('click', () => openVideoModal(item.id));
        }

        tr.appendChild(ac); tb.appendChild(tr);
    });
}
function renderArtes() {
    const tb = document.getElementById('artesTbody'); if (!tb) return;
    const list = data.artes || [];
    if (!list.length) { tb.innerHTML = '<tr><td colspan="7"><p class="empty-msg">Nenhuma arte ainda.</p></td></tr>'; return; }
    tb.innerHTML = '';
    list.forEach(item => {
        const tr = document.createElement('tr');
        const sc = document.createElement('td'); sc.appendChild(makeBadge('artes', item.id, item.status));

        // Make title clickable
        const titleTd = document.createElement('td');
        titleTd.innerHTML = `<strong>${item.titulo}</strong>${item.fileUrl ? ` <a href="${item.fileUrl}" target="_blank" title="Ver arquivo" style="font-size:13px;text-decoration:none">📎</a>` : ''}`;
        titleTd.style.cursor = 'pointer';
        titleTd.title = 'Ver detalhes';
        titleTd.addEventListener('click', (e) => { if (e.target.tagName === 'A') return; openArteModal(item.id); });

        tr.appendChild(titleTd);
        tr.innerHTML += `<td>${item.tipo || '—'}</td><td>${item.responsavel || '—'}</td><td>${item.date || '—'}</td>`;
        tr.appendChild(sc);
        const fd = document.createElement('td'); fd.textContent = item.formato || '—'; tr.appendChild(fd);
        const ac = document.createElement('td');

        // Check if admin
        const sess = sessionStorage.getItem('hype_session');
        const role = sess ? JSON.parse(sess).role : 'designer';
        if (role === 'admin') {
            ac.innerHTML = '<button class="btn-tbl">✏️</button><button class="btn-tbl d">🗑️</button>';
            ac.querySelectorAll('.btn-tbl')[0].addEventListener('click', () => openArteModal(item.id));
            ac.querySelectorAll('.btn-tbl')[1].addEventListener('click', () => delItem('artes', item.id));
        } else {
            ac.innerHTML = '<button class="btn-tbl">👁️</button>';
            ac.querySelectorAll('.btn-tbl')[0].addEventListener('click', () => openArteModal(item.id));
        }

        tr.appendChild(ac); tb.appendChild(tr);
    });
}
function renderDemanda() {
    const mk = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const items = (data.demanda || []).filter(d => !d.month || d.month === mk);
    const tb = document.getElementById('demandaTbody'); if (!tb) return;
    if (!items.length) { tb.innerHTML = '<tr><td colspan="11"><p class="empty-msg">Nenhuma demanda.</p></td></tr>'; return; }
    tb.innerHTML = '';
    items.forEach((item, idx) => {
        const tr = document.createElement('tr');
        const sc = document.createElement('td'); sc.appendChild(makeBadge('demanda', item.id, item.status));
        const pc = document.createElement('td'); const ps = document.createElement('span');
        ps.className = `priority ${item.prioridade}`;
        ps.textContent = (item.prioridade || '').charAt(0).toUpperCase() + (item.prioridade || '').slice(1);
        pc.appendChild(ps);
        let solDt = '—';
        if (item.solicitadoEm) { const [y, m, d] = item.solicitadoEm.split('-'); solDt = `${d}/${m}/${y}`; }

        // Structure table row
        tr.innerHTML = `<td>${idx + 1}</td><td class="cell-date-sol">${solDt}</td>`;

        // Clickable Title with file indicator
        const titleTd = document.createElement('td');
        titleTd.innerHTML = `<strong>${item.titulo}</strong>${item.fileUrl ? ` <a href="${item.fileUrl}" target="_blank" title="Ver arquivo" style="font-size:13px;text-decoration:none">📎</a>` : ''}`;
        titleTd.style.cursor = 'pointer';
        titleTd.title = 'Ver detalhes';
        titleTd.addEventListener('click', (e) => { if (e.target.tagName === 'A') return; openDemandaModal(item.id); });
        tr.appendChild(titleTd);

        tr.innerHTML += `<td>${item.categoria === 'video' ? '🎬' : item.categoria === 'arte' ? '🎨' : '✦'} ${item.categoria || '—'}</td><td>${item.plataforma || '—'}</td>`;
        tr.appendChild(pc);
        const rd = document.createElement('td'); rd.textContent = item.responsavel || '—'; tr.appendChild(rd);
        const pd = document.createElement('td'); pd.textContent = item.prazo || '—'; tr.appendChild(pd);
        tr.appendChild(sc);
        const od = document.createElement('td'); od.textContent = item.obs || '—'; od.style.cssText = 'max-width:140px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;'; tr.appendChild(od);
        const ac = document.createElement('td');

        // Check if admin
        const sess = sessionStorage.getItem('hype_session');
        const role = sess ? JSON.parse(sess).role : 'designer';
        if (role === 'admin') {
            ac.innerHTML = '<button class="btn-tbl">✏️</button><button class="btn-tbl d">🗑️</button>';
            ac.querySelectorAll('.btn-tbl')[0].addEventListener('click', () => openDemandaModal(item.id));
            ac.querySelectorAll('.btn-tbl')[1].addEventListener('click', () => delItem('demanda', item.id));
        } else {
            ac.innerHTML = '<button class="btn-tbl">👁️</button>';
            ac.querySelectorAll('.btn-tbl')[0].addEventListener('click', () => openDemandaModal(item.id));
        }

        tr.appendChild(ac); tb.appendChild(tr);
    });
}

function saveMeta() {
    const mk = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    if (!data.meta) data.meta = {};
    data.meta[mk] = { videos: parseInt(document.getElementById('metaVideos').value) || 0, artes: parseInt(document.getElementById('metaArtes').value) || 0 };
    saveData(); showNotif('Metas salvas ✦');
}
function delItem(sec, id) {
    if (!confirm('Remover este item?')) return;
    data[sec] = (data[sec] || []).filter(i => i.id !== id);
    saveData();
    if (sec === 'videos') renderVideos(); else if (sec === 'artes') renderArtes(); else renderDemanda();
    renderDashboard(); showNotif('Removido.');
}


// ── USERS TABLE ────────────────────────────────────
function renderUsers() {
    const tb = document.getElementById('usersTbody'); if (!tb) return;
    const users = getUsers();
    if (!users.length) { tb.innerHTML = '<tr><td colspan="3"><p class="empty-msg">Nenhum usuário.</p></td></tr>'; return; }
    tb.innerHTML = '';
    users.forEach((u, idx) => {
        const tr = document.createElement('tr');
        const roleBadge = { admin: '👑 Admin', designer: '🎨 Designer', videomaker: '🎬 Videomaker' }[u.role] || u.role;
        tr.innerHTML = `<td><strong>${u.username}</strong></td><td>${roleBadge}</td>`;
        const ac = document.createElement('td');
        if (u.username !== 'admin') {
            ac.innerHTML = '<button class="btn-tbl">✏️</button><button class="btn-tbl d">🗑️</button>';
            ac.querySelectorAll('.btn-tbl')[0].addEventListener('click', () => openUserModal(idx));
            ac.querySelectorAll('.btn-tbl')[1].addEventListener('click', () => deleteUser(idx));
        } else {
            ac.innerHTML = '<button class="btn-tbl">✏️ Editar senha</button>';
            ac.querySelectorAll('.btn-tbl')[0].addEventListener('click', () => openUserModal(idx));
        }
        tr.appendChild(ac); tb.appendChild(tr);
    });
}
function deleteUser(idx) {
    const users = getUsers();
    if (!confirm(`Remover "${users[idx].username}"?`)) return;
    users.splice(idx, 1); saveUsers(users); renderUsers(); showNotif('Usuário removido.');
}


// ── MODAL ──────────────────────────────────────────
function openModal(t) { document.getElementById('modalTitle').textContent = t; document.getElementById('modalOverlay').style.display = 'flex'; }
function closeModal() { document.getElementById('modalOverlay').style.display = 'none'; document.getElementById('modalBody').innerHTML = ''; editTarget = null; modalSection = null; }

function fld(label, key, type = 'text', opts = {}) {
    const v = opts.value || '';
    if (type === 'select') { const oh = opts.options.map(o => `<option value="${o.v}"${o.v === v ? ' selected' : ''}>${o.l}</option>`).join(''); return `<div class="field-group"><label>${label}</label><select class="field sel" data-key="${key}">${oh}</select></div>`; }
    if (type === 'textarea') return `<div class="field-group"><label>${label}</label><textarea class="field" data-key="${key}" style="min-height:80px;resize:vertical">${v}</textarea></div>`;
    return `<div class="field-group"><label>${label}</label><input type="${type}" class="field" data-key="${key}" value="${v}" placeholder="${opts.ph || ''}"/></div>`;
}
function getVals() { const o = {}; document.getElementById('modalBody').querySelectorAll('[data-key]').forEach(e => { o[e.dataset.key] = e.value; }); return o; }

const ST_OPTS = statuses.map(s => ({ v: s, l: statusLabels[s] }));

function openVideoModal(id) {
    modalSection = 'videos'; const item = id ? (data.videos || []).find(v => v.id === id) : null; editTarget = id ? { section: 'videos', id } : null;
    document.getElementById('modalBody').innerHTML = [fld('Título', 'titulo', 'text', { value: item?.titulo, ph: 'Ex: Apresentação do servidor' }), fld('Tipo', 'tipo', 'select', { value: item?.tipo || 'Reels', options: [{ v: 'Reels', l: '🎞️ Reels' }, { v: 'YouTube', l: '▶️ YouTube' }, { v: 'TikTok', l: '🎵 TikTok' }, { v: 'Stories', l: '📱 Stories' }, { v: 'Live', l: '📡 Live' }, { v: 'Cortado', l: '✂️ Cortado' }] }), fld('Responsável', 'responsavel', 'text', { value: item?.responsavel, ph: 'Nome do editor' }), fld('Data Prevista', 'date', 'date', { value: item?.date }), fld('Plataforma', 'plataforma', 'select', { value: item?.plataforma || 'Instagram', options: [{ v: 'Instagram', l: '📸 Instagram' }, { v: 'YouTube', l: '▶️ YouTube' }, { v: 'TikTok', l: '🎵 TikTok' }, { v: 'Discord', l: '💬 Discord' }, { v: 'Todos', l: '🌐 Todos' }] }), fld('Status', 'status', 'select', { value: item?.status || 'a-fazer', options: ST_OPTS }), fld('Observações', 'obs', 'textarea', { value: item?.obs })].join('');

    // Read-only for non-admins, except Status
    const sess = sessionStorage.getItem('hype_session');
    const role = sess ? JSON.parse(sess).role : 'designer';
    if (role !== 'admin') {
        const body = document.getElementById('modalBody');
        body.querySelectorAll('input, select, textarea').forEach(el => el.disabled = true);
        // Re-enable only the Status field
        const statusEl = body.querySelector('[data-key="status"]');
        if (statusEl) statusEl.disabled = false;
        document.getElementById('modalConfirmBtn').style.display = 'inline-block';
        document.getElementById('modalConfirmBtn').textContent = 'Salvar Status';
        document.getElementById('modalCancelBtn').textContent = 'Fechar';
    } else {
        document.getElementById('modalConfirmBtn').style.display = 'inline-block';
        document.getElementById('modalConfirmBtn').textContent = 'Salvar';
        document.getElementById('modalCancelBtn').textContent = 'Cancelar';
    }

    addFileUploadSection(item, 'video/*');
    openModal(id ? (role === 'admin' ? '✏️ Editar Vídeo' : '👁️ Visualizar Vídeo') : '🎬 Novo Vídeo');
}
function openArteModal(id) {
    modalSection = 'artes'; const item = id ? (data.artes || []).find(a => a.id === id) : null; editTarget = id ? { section: 'artes', id } : null;
    document.getElementById('modalBody').innerHTML = [fld('Título', 'titulo', 'text', { value: item?.titulo, ph: 'Ex: Banner do evento' }), fld('Tipo', 'tipo', 'select', { value: item?.tipo || 'Post Feed', options: [{ v: 'Post Feed', l: '🖼️ Post Feed' }, { v: 'Stories', l: '📱 Stories' }, { v: 'Banner', l: '🎨 Banner' }, { v: 'Logo', l: '✨ Logo' }, { v: 'Thumbnail', l: '🖥️ Thumbnail' }, { v: 'Flyer', l: '📄 Flyer' }] }), fld('Responsável', 'responsavel', 'text', { value: item?.responsavel, ph: 'Nome do designer' }), fld('Data Prevista', 'date', 'date', { value: item?.date }), fld('Formato', 'formato', 'select', { value: item?.formato || '1080x1080', options: [{ v: '1080x1080', l: '1080×1080 (Feed)' }, { v: '1080x1920', l: '1080×1920 (Stories)' }, { v: '1920x1080', l: '1920×1080 (Banner)' }, { v: '1280x720', l: '1280×720 (Thumb)' }, { v: 'Outro', l: 'Outro' }] }), fld('Status', 'status', 'select', { value: item?.status || 'a-fazer', options: ST_OPTS }), fld('Observações', 'obs', 'textarea', { value: item?.obs })].join('');

    // Read-only for non-admins, except Status
    const sess = sessionStorage.getItem('hype_session');
    const role = sess ? JSON.parse(sess).role : 'designer';
    if (role !== 'admin') {
        const body = document.getElementById('modalBody');
        body.querySelectorAll('input, select, textarea').forEach(el => el.disabled = true);
        // Re-enable only the Status field
        const statusEl = body.querySelector('[data-key="status"]');
        if (statusEl) statusEl.disabled = false;
        document.getElementById('modalConfirmBtn').style.display = 'inline-block';
        document.getElementById('modalConfirmBtn').textContent = 'Salvar Status';
        document.getElementById('modalCancelBtn').textContent = 'Fechar';
    } else {
        document.getElementById('modalConfirmBtn').style.display = 'inline-block';
        document.getElementById('modalConfirmBtn').textContent = 'Salvar';
        document.getElementById('modalCancelBtn').textContent = 'Cancelar';
    }

    addFileUploadSection(item, 'image/*,.pdf');
    openModal(id ? (role === 'admin' ? '✏️ Editar Arte' : '👁️ Visualizar Arte') : '🎨 Nova Arte');
}
function openDemandaModal(id) {
    modalSection = 'demanda';
    const mk = `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
    const item = id ? (data.demanda || []).find(d => d.id === id) : null; editTarget = id ? { section: 'demanda', id } : null;
    const body = document.getElementById('modalBody');
    body.innerHTML = [fld('Título', 'titulo', 'text', { value: item?.titulo, ph: 'Ex: Post de recrutamento' }), fld('Categoria', 'categoria', 'select', { value: item?.categoria || 'video', options: [{ v: 'video', l: '🎬 Vídeo' }, { v: 'arte', l: '🎨 Arte' }, { v: 'outro', l: '✦ Outro' }] }), fld('Plataforma', 'plataforma', 'select', { value: item?.plataforma || 'Instagram', options: [{ v: 'Instagram', l: '📸 Instagram' }, { v: 'TikTok', l: '🎵 TikTok' }, { v: 'YouTube', l: '▶️ YouTube' }, { v: 'Discord', l: '💬 Discord' }, { v: 'Twitter/X', l: '🐦 Twitter/X' }, { v: 'Todos', l: '🌐 Todos' }, { v: 'N/A', l: '— N/A' }] }), fld('Prioridade', 'prioridade', 'select', { value: item?.prioridade || 'media', options: [{ v: 'alta', l: '🔴 Alta' }, { v: 'media', l: '🟡 Média' }, { v: 'baixa', l: '🟢 Baixa' }] }), fld('Responsável', 'responsavel', 'text', { value: item?.responsavel, ph: 'Nome do responsável' }), fld('Prazo', 'prazo', 'date', { value: item?.prazo }), fld('Status', 'status', 'select', { value: item?.status || 'a-fazer', options: ST_OPTS }), fld('Descrição', 'descricao', 'textarea', { value: item?.descricao }), fld('Observações', 'obs', 'textarea', { value: item?.obs })].join('');
    body.dataset.monthKey = mk;

    // Read-only for non-admins, except Status
    const sess = sessionStorage.getItem('hype_session');
    const role = sess ? JSON.parse(sess).role : 'designer';
    if (role !== 'admin') {
        body.querySelectorAll('input, select, textarea').forEach(el => el.disabled = true);
        // Re-enable only the Status field
        const statusEl = body.querySelector('[data-key="status"]');
        if (statusEl) statusEl.disabled = false;
        document.getElementById('modalConfirmBtn').style.display = 'inline-block';
        document.getElementById('modalConfirmBtn').textContent = 'Salvar Status';
        document.getElementById('modalCancelBtn').textContent = 'Fechar';
    } else {
        document.getElementById('modalConfirmBtn').style.display = 'inline-block';
        document.getElementById('modalConfirmBtn').textContent = 'Salvar';
        document.getElementById('modalCancelBtn').textContent = 'Cancelar';
    }

    addFileUploadSection(item, 'image/*,video/*,.pdf');
    addCreativeIdeasSection(item);
    openModal(id ? (role === 'admin' ? '✏️ Editar Demanda' : '👁️ Visualizar Demanda') : '✦ Nova Demanda');
}
function openUserModal(idx) {
    modalSection = 'usuario';
    const users = getUsers(); const item = idx !== undefined ? users[idx] : null; editTarget = idx !== undefined ? { type: 'user', idx } : null;
    const isAdmin = item?.username === 'admin';
    document.getElementById('modalBody').innerHTML = [!isAdmin ? fld('Usuário', 'username', 'text', { value: item?.username, ph: 'login sem espaços' }) : `<div class="field-group"><label>Usuário</label><input class="field" value="admin" disabled/></div>`, fld('Senha', 'password', 'text', { value: item?.password, ph: 'senha de acesso' }), !isAdmin ? fld('Perfil', 'role', 'select', { value: item?.role || 'designer', options: [{ v: 'designer', l: '🎨 Designer' }, { v: 'videomaker', l: '🎬 Videomaker' }] }) : ''].join('');
    openModal(item ? '✏️ Editar Usuário' : '+ Novo Usuário');
}

async function saveModal() {
    const vals = getVals();

    if (modalSection === 'usuario') {
        const users = getUsers();
        if (editTarget?.type === 'user') {
            const u = users[editTarget.idx];
            if (u.username !== 'admin' && vals.username) u.username = vals.username.trim().toLowerCase();
            if (vals.password?.trim()) u.password = vals.password.trim();
            if (u.username !== 'admin' && vals.role) u.role = vals.role;
        } else {
            if (!vals.username?.trim()) { showNotif('Digite um nome de usuário.'); return; }
            if (!vals.password?.trim()) { showNotif('Digite uma senha.'); return; }
            if (users.find(u => u.username.toLowerCase() === vals.username.trim().toLowerCase())) { showNotif('Este usuário já existe.'); return; }
            users.push({ username: vals.username.trim().toLowerCase(), password: vals.password.trim(), role: vals.role || 'designer' });
        }
        saveUsers(users); renderUsers(); closeModal(); showNotif('Usuário salvo ✦');
        return;
    }

    // Handle file upload (runs for all roles when a file is selected)
    let uploadedFileUrl = null;
    const fileInput = document.getElementById('fileUploadInput');
    const removeFile = fileInput?.dataset.removeFile === 'true';
    if (fileInput?.files?.length > 0) {
        const btn = document.getElementById('modalConfirmBtn');
        const origText = btn.textContent;
        btn.textContent = '⏳ Enviando...';
        btn.disabled = true;
        try {
            uploadedFileUrl = await uploadToCloudinary(fileInput.files[0]);
            showNotif('Arquivo enviado ✦');
        } catch (e) {
            showNotif('Erro no upload. Tente novamente.');
            btn.textContent = origText;
            btn.disabled = false;
            return;
        }
        btn.disabled = false;
        btn.textContent = origText;
    }

    // Handle reference images upload (demanda only)
    let newRefImgUrls = [];
    const refImgInput = document.getElementById('refImgInput');
    if (refImgInput?.files?.length > 0) {
        const btn = document.getElementById('modalConfirmBtn');
        const origText = btn.textContent;
        btn.textContent = '⏳ Enviando referências...';
        btn.disabled = true;
        try {
            for (const file of refImgInput.files) {
                const url = await uploadToCloudinary(file);
                newRefImgUrls.push(url);
            }
        } catch (e) {
            showNotif('Erro ao enviar imagem de referência.');
            btn.textContent = origText;
            btn.disabled = false;
            return;
        }
        btn.disabled = false;
        btn.textContent = origText;
    }

    // Gather reference links
    const referenciaLinksEl = document.getElementById('referenciaLinks');
    const referenciaLinks = referenciaLinksEl
        ? referenciaLinksEl.value.split('\n').map(l => l.trim()).filter(l => l.length > 0)
        : null;

    // Check admin role — non-admins only save status + file
    const _sess = sessionStorage.getItem('hype_session');
    const _role = _sess ? JSON.parse(_sess).role : 'designer';

    if (_role !== 'admin') {
        // Non-admin: only save status and file url
        if (editTarget) {
            const arr = data[editTarget.section];
            const idx = arr.findIndex(i => i.id === editTarget.id);
            if (idx !== -1) {
                arr[idx].status = vals.status;
                if (uploadedFileUrl) arr[idx].fileUrl = uploadedFileUrl;
                if (removeFile) delete arr[idx].fileUrl;
                // Save reference images and links (non-admin can also add refs)
                if (newRefImgUrls.length > 0) {
                    const existing = arr[idx].referenciaImgs || [];
                    const kept = existing.filter((_, i) => !window._removedRefImgs?.has(i));
                    arr[idx].referenciaImgs = [...kept, ...newRefImgUrls];
                } else if (window._removedRefImgs?.size > 0) {
                    const existing = arr[idx].referenciaImgs || [];
                    arr[idx].referenciaImgs = existing.filter((_, i) => !window._removedRefImgs.has(i));
                }
                if (referenciaLinks !== null) arr[idx].referenciaLinks = referenciaLinks;
            }
        }
        saveData();
        if (editTarget?.section === 'videos') renderVideos();
        else if (editTarget?.section === 'artes') renderArtes();
        else renderDemanda();
        renderDashboard();
        closeModal();
        showNotif('Salvo ✦');
        return;
    }

    if (!vals.titulo?.trim()) { showNotif('Digite um título ✦'); return; }

    if (editTarget) {
        const arr = data[editTarget.section];
        const idx = arr.findIndex(i => i.id === editTarget.id);
        if (idx !== -1) {
            const oldTitulo = arr[idx].titulo;
            const newTitulo = vals.titulo;

            arr[idx] = { ...arr[idx], ...vals };
            if (uploadedFileUrl) arr[idx].fileUrl = uploadedFileUrl;
            if (removeFile) delete arr[idx].fileUrl;
            // Save reference images and links (admin)
            if (newRefImgUrls.length > 0) {
                const existing = arr[idx].referenciaImgs || [];
                const kept = existing.filter((_, i) => !window._removedRefImgs?.has(i));
                arr[idx].referenciaImgs = [...kept, ...newRefImgUrls];
            } else if (window._removedRefImgs?.size > 0) {
                const existing = arr[idx].referenciaImgs || [];
                arr[idx].referenciaImgs = existing.filter((_, i) => !window._removedRefImgs.has(i));
            }
            if (referenciaLinks !== null) arr[idx].referenciaLinks = referenciaLinks;

            // Update calendar events if title changed
            if (oldTitulo && newTitulo && oldTitulo !== newTitulo) {
                if (data.eventos) {
                    for (const day in data.eventos) {
                        data.eventos[day].forEach(ev => {
                            // Check if the old title is a substring of the event title
                            if (ev.title.includes(oldTitulo)) {
                                ev.title = ev.title.replace(oldTitulo, newTitulo);
                            } else {
                                // Sometimes emojis or prefixes differ. A safer fallback:
                                // if the event title ends with the old title, we replace the end.
                                const lowerEv = ev.title.toLowerCase();
                                const lowerOld = oldTitulo.toLowerCase();
                                if (lowerEv.includes(lowerOld)) {
                                    const idx = lowerEv.indexOf(lowerOld);
                                    ev.title = ev.title.substring(0, idx) + newTitulo + ev.title.substring(idx + oldTitulo.length);
                                }
                            }
                        });
                    }
                }
            }

            if (editTarget.section === 'demanda') {
                const linked = arr[idx].linkedId;
                if (linked) {
                    const target = arr[idx].categoria === 'video' ? data.videos : data.artes;
                    const li = target.findIndex(x => x.id === linked);
                    if (li !== -1) target[li] = { ...target[li], titulo: vals.titulo, responsavel: vals.responsavel, date: vals.prazo, status: vals.status };
                }
            }
        }
    } else {
        const mk = document.getElementById('modalBody').dataset.monthKey || `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}`;
        const newId = genId();
        const _now = new Date();
        const _sol = modalSection === 'demanda' ? `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}` : undefined;
        const newItem = { id: newId, ...(_sol ? { solicitadoEm: _sol } : {}), ...vals, month: mk };

        if (modalSection === 'demanda') {
            if (vals.categoria === 'video') {
                const linkedId = genId();
                if (!data.videos) data.videos = [];
                data.videos.push({ id: linkedId, titulo: vals.titulo, tipo: 'Reels', responsavel: vals.responsavel || '', date: vals.prazo || '', plataforma: 'Instagram', status: vals.status || 'a-fazer', obs: vals.obs || '', month: mk, demandaId: newId });
                newItem.linkedId = linkedId;
                showNotif('Demanda criada ✦ — adicionada em Vídeos!');
            } else if (vals.categoria === 'arte') {
                const linkedId = genId();
                if (!data.artes) data.artes = [];
                data.artes.push({ id: linkedId, titulo: vals.titulo, tipo: 'Post Feed', responsavel: vals.responsavel || '', date: vals.prazo || '', formato: '1080x1080', status: vals.status || 'a-fazer', obs: vals.obs || '', month: mk, demandaId: newId });
                newItem.linkedId = linkedId;
                showNotif('Demanda criada ✦ — adicionada em Artes!');
            } else { showNotif('Demanda salva ✦'); }

            // Register on calendar
            const _dk = _sol || `${currentYear}-${String(currentMonth + 1).padStart(2, '0')}-01`;
            const todayDk = `${_now.getFullYear()}-${String(_now.getMonth() + 1).padStart(2, '0')}-${String(_now.getDate()).padStart(2, '0')}`;
            if (!data.eventos) data.eventos = {};
            if (!data.eventos[todayDk]) data.eventos[todayDk] = [];
            const _calType = vals.categoria === 'video' ? 'video' : vals.categoria === 'arte' ? 'arte' : 'outro';
            const _setor = vals.categoria === 'video' ? 'Vídeo' : vals.categoria === 'arte' ? 'Arte' : 'Outro';
            data.eventos[todayDk].push({ title: `📋 [${_setor}] ${vals.titulo}`, type: _calType });
        } else { showNotif('Salvo ✦'); }

        if (!data[modalSection]) data[modalSection] = [];
        data[modalSection].push(newItem);
    }

    saveData(); renderVideos(); renderArtes(); renderDemanda(); renderDashboard(); renderCalendar(); closeModal();
}
