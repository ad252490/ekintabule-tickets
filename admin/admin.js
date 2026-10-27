/* ================================================
   EKINTABULI Admin - Advanced Dashboard
   - QR constrained to ticket margins
   - Batch ZIP download (front-only, 100 at a time)
   - Animated dashboard, charts, ms countdown
   ================================================ */

// ================================================
// 1. CONFIGURATION
// ================================================
const CONFIG = {
    eventName: 'EKINTABULI',
    eventSub: 'Christmas 2025',
    
    ticketPrice: 10000,
    ticketWidth: 600,
    ticketHeight: 220,
    qrSize: 180,
    captureScale: 4
};

// ================================================
// 2. STATE
// ================================================
let allTickets = [];
let filteredTickets = [];
let currentPage = 1;
let isFirebaseConnected = false;

// For animated numbers
let prevStats = {
    gen: 0,
    sold: 0,
    used: 0,
    rev: 0,
    downloaded: 0,
    remaining: 0
};

// Charts
let statusChart = null;
let checkinChart = null;

// ================================================
// 3. UTIL & HELPERS
// ================================================
const sleep = ms => new Promise(r => setTimeout(r, ms));
const formatCurrency = n => n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
const getVerifyUrl = () => 'https://ad252490.github.io/ekintabule-tickets/verify/';
const getTicketLink = t => `${getVerifyUrl()}?t=${encodeURIComponent(t.encryptedCode)}`;
function showNotification(msg, type='success') {
    const c = document.getElementById('notificationContainer');
    if(!c) return;
    const n = document.createElement('div');
    n.className = `notification`;
    n.style.borderLeftColor = type==='error'
        ? '#dc3545'
        : type==='warning'
        ? '#ffcc33'
        : '#d4af37';
    n.innerHTML = `<span>${type==='success'?'✅':type==='error'?'❌':'⚠️'}</span><span>${msg}</span>`;
    c.appendChild(n);
    setTimeout(() => { 
        n.style.opacity='0'; 
        n.style.transform = 'translateY(4px)'; 
        setTimeout(()=>n.remove(),300); 
    }, 4000);
}

// Download tracking helpers
function getExportedCount() {
    return parseInt(localStorage.getItem('ekt_exported_count') || '0', 10);
}

function setExportedCount(n) {
    localStorage.setItem('ekt_exported_count', String(n));
}

function setLastDownloadRange(startIndex, endIndex) {
    const rangeStr = (endIndex === 0) ? '' : `${startIndex + 1}-${endIndex}`;
    localStorage.setItem('ekt_last_download_range', rangeStr);
}

function getLastDownloadRange() {
    return localStorage.getItem('ekt_last_download_range') || '';
}

// Activity log
function logEvent(message, type = 'info') {
    const list = document.getElementById('activityList');
    if (!list) return;
    const li = document.createElement('li');
    li.className = `activity-item activity-${type}`;
    li.innerHTML = `<span class="time">${new Date().toLocaleTimeString()}</span><span class="msg">${message}</span>`;
    list.prepend(li);
    while (list.children.length > 10) list.removeChild(list.lastChild);
}

// Animated numbers
function animateNumber(id, from, to, formatFn = v => v.toString(), duration = 600) {
    const el = document.getElementById(id);
    if (!el) return;
    if (from === to) {
        el.textContent = formatFn(to);
        return;
    }
    const start = performance.now();
    const diff = to - from;
    function frame(now) {
        const t = Math.min(1, (now - start) / duration);
        const eased = t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t; // easeInOut
        const current = from + diff * eased;
        el.textContent = formatFn(Math.round(current));
        if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
}

// Charts init
function initChartsIfNeeded() {
    const statusCtx = document.getElementById('statusChart')?.getContext('2d');
    const checkinCtx = document.getElementById('checkinChart')?.getContext('2d');

    if (statusCtx && !statusChart) {
        statusChart = new Chart(statusCtx, {
            type: 'doughnut',
            data: {
                labels: ['Generated', 'Sold', 'Used'],
                datasets: [{
                    data: [0, 0, 0],
                    backgroundColor: ['#f59e0b', '#22c55e', '#64748b'],
                    borderWidth: 0
                }]
            },
            options: {
                responsive: true,
                plugins: {
                    legend: {
                        position: 'bottom',
                        labels: { color: '#e5e7eb', font: { size: 11 } }
                    }
                },
                cutout: '60%'
            }
        });
    }

    if (checkinCtx && !checkinChart) {
        checkinChart = new Chart(checkinCtx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [{
                    label: 'Check-ins',
                    data: [],
                    borderColor: '#22c55e',
                    backgroundColor: 'rgba(34,197,94,0.15)',
                    tension: 0.3,
                    fill: true,
                    pointRadius: 2
                }]
            },
            options: {
                responsive: true,
                scales: {
                    x: {
                        ticks: { color: '#9ca3af', maxRotation: 0, autoSkip: true },
                        grid: { color: 'rgba(148,163,184,0.15)' }
                    },
                    y: {
                        ticks: { color: '#9ca3af' },
                        grid: { color: 'rgba(148,163,184,0.15)' }
                    }
                },
                plugins: {
                    legend: {
                        labels: { color: '#e5e7eb', font: { size: 11 } }
                    }
                }
            }
        });
    }
}

function updateCharts() {
    if (!statusChart || !checkinChart) {
        initChartsIfNeeded();
        if (!statusChart || !checkinChart) return;
    }

    // Status distribution
    let gen = 0, sold = 0, used = 0;
    allTickets.forEach(t => {
        if (t.status === 'USED') used++;
        else if (t.status === 'SOLD') sold++;
        else gen++;
    });
    statusChart.data.datasets[0].data = [gen, sold, used];
    statusChart.update('none');

    // Approximate check-ins over time (by createdAt & status)
    const usedTickets = allTickets.filter(t => t.status === 'USED' && t.createdAt?.seconds);
    const byDay = {};
    usedTickets.forEach(t => {
        const d = new Date(t.createdAt.seconds * 1000);
        const key = d.toISOString().substring(0, 10); // YYYY-MM-DD
        byDay[key] = (byDay[key] || 0) + 1;
    });
    const sortedKeys = Object.keys(byDay).sort();
    const labels = sortedKeys;
    const values = sortedKeys.map(k => byDay[k]);

    checkinChart.data.labels = labels;
    checkinChart.data.datasets[0].data = values;
    checkinChart.update('none');
}

// Dashboard update
function updateDashboard() {
    const s = { gen:0, sold:0, used:0, rev:0 };
    allTickets.forEach(t => {
        s.gen++;
        if(t.status === 'SOLD' || t.status === 'USED') {
            s.sold++;
            s.rev += parseInt(t.price || 0);
        }
        if(t.status === 'USED') s.used++;
    });

    // Animated stats
    animateNumber('statGenerated', prevStats.gen, s.gen, v => v.toLocaleString());
    animateNumber('statSold', prevStats.sold, s.sold, v => v.toLocaleString());
    animateNumber('statUsed', prevStats.used, s.used, v => v.toLocaleString());
    animateNumber('statRevenue', prevStats.rev, s.rev, v => formatCurrency(v));

    prevStats.gen = s.gen;
    prevStats.sold = s.sold;
    prevStats.used = s.used;
    prevStats.rev = s.rev;

    const g = id => document.getElementById(id);

    // Attendance rate
    if (g('attendanceRate')) {
        const rate = s.sold > 0 ? Math.round((s.used / s.sold) * 100) : 0;
        g('attendanceRate').textContent = `${rate}% Attendance`;
    }

    // Download / export stats
    const exportedCount = getExportedCount();
    const lastRange = getLastDownloadRange();

    animateNumber('statDownloaded', prevStats.downloaded, exportedCount, v => v.toLocaleString());
    prevStats.downloaded = exportedCount;

    if (g('statDownloadedRange')) g('statDownloadedRange').textContent = lastRange || '—';

    const totalGenerated = s.gen;
    const remainingToDownload = Math.max(0, totalGenerated - exportedCount);
    const progressPct = totalGenerated > 0
        ? Math.round((exportedCount / totalGenerated) * 100)
        : 0;

    animateNumber('statRemainingToDownload', prevStats.remaining, remainingToDownload, v => v.toLocaleString());
    prevStats.remaining = remainingToDownload;

    if (g('statDownloadProgress')) g('statDownloadProgress').textContent = `${progressPct}%`;

    // Next batch hint
    const hint = document.getElementById('nextBatchHint');
    if (hint) {
        const BATCH_SIZE = 100;
        if (totalGenerated === 0) {
            hint.textContent = 'Generate tickets to start downloads.';
        } else if (exportedCount >= totalGenerated) {
            hint.textContent = 'No more tickets to download.';
        } else {
            const nextStart = exportedCount + 1;
            const nextEnd = Math.min(exportedCount + BATCH_SIZE, totalGenerated);
            hint.textContent = `Next ZIP: tickets ${nextStart}–${nextEnd}.`;
        }
    }

    const hasData = s.gen > 0;
    ['downloadPdfBtn', 'downloadZipBtn', 'exportBtn'].forEach(id => {
        const b = document.getElementById(id);
        if (b) b.disabled = !hasData;
    });

    // Update charts
    updateCharts();
}

// Countdown with ms
function updateCountdown() {
    const target = new Date('2025-12-25T18:00:00'); // Event time
    const now = new Date();
    const diffMs = target - now;
    const elMain = document.getElementById('statCountdown');
    const elSub = document.getElementById('statCountdownSub');
    if (!elMain) return;

    if (diffMs <= 0) {
        elMain.textContent = 'Event Started';
        if (elSub) elSub.textContent = '';
        return;
    }

    const totalSec = diffMs / 1000;
    const days = Math.floor(totalSec / 86400);
    const hours = Math.floor((totalSec % 86400) / 3600);
    const mins = Math.floor((totalSec % 3600) / 60);
    const secs = Math.floor(totalSec % 60);
    const ms = Math.floor(diffMs % 1000 / 10); // hundredths

    elMain.textContent = `${days}d ${hours}h ${mins}m`;
    if (elSub) {
        elSub.textContent = `${secs.toString().padStart(2,'0')}.${ms.toString().padStart(2,'0')}s remaining`;
    }
}

// Wait until QRCode has actually rendered an <img> or <canvas>
function waitForQRCodeRendered(container) {
    return new Promise(resolve => {
        if (!container) return resolve();
        const existing = container.querySelector('img,canvas');
        if (existing) return resolve();
        const obs = new MutationObserver(() => {
            const img = container.querySelector('img,canvas');
            if (img) {
                obs.disconnect();
                setTimeout(resolve, 20);
            }
        });
        obs.observe(container, { childList: true, subtree: true });
        setTimeout(() => { obs.disconnect(); resolve(); }, 2000);
    });
}

// Compute QR size
function getQrSizeForTicket() {
    const rightWidth = Math.floor(CONFIG.ticketWidth * 0.28);
    const whiteBoxPadding = 8;
    const sideMargin = 12;
    const availableWidth = Math.max(0, rightWidth - (whiteBoxPadding * 2) - sideMargin);
    const reservedVertical = 30 + 10;
    const availableHeight = Math.max(0, CONFIG.ticketHeight - reservedVertical);
    const computed = Math.min(CONFIG.qrSize, availableWidth, availableHeight);
    const size = Math.max(40, Math.floor(computed));
    return size;
}

// ================================================
// 4. SECURITY
// ================================================
function generateSecureTicketId(n) {
    const rnd = Array.from(crypto.getRandomValues(new Uint8Array(3)), b => b.toString(36)).join('').substring(0,4).toUpperCase();
    return `EKT-25-${String(n).padStart(4,'0')}-${rnd}`;
}

function encryptTicketCode() {   // now a random 128-bit token (kept under the old name/field 'encryptedCode')
    const a = new Uint8Array(16); crypto.getRandomValues(a);
    return Array.from(a, b => b.toString(16).padStart(2, '0')).join('');
}

// ================================================
// 5. INITIALIZATION
// ================================================
document.addEventListener('DOMContentLoaded', () => {
    console.log("System Started");

    // Ensure ticketCanvas is hidden but renderable
    const ticketCanvas = document.getElementById('ticketCanvas');
    if (ticketCanvas) {
        ticketCanvas.style.position = 'fixed';
        ticketCanvas.style.top = '-10000px';
        ticketCanvas.style.left = '-10000px';
        ticketCanvas.style.zIndex = '-1';
        ticketCanvas.style.visibility = 'visible';
    }

    if(typeof firebase !== 'undefined' && typeof db !== 'undefined' && db) {
        db.collection('tickets').limit(1).get().then(() => {
            isFirebaseConnected = true;
            const dot = document.querySelector('.status-dot');
            const txt = document.querySelector('.status-text');
            if (dot) dot.style.background = '#00ff88';
            if (txt) txt.textContent = 'Online';
            startRealTimeSync();
        }).catch(() => console.warn('Offline'));
    }

    const byId = id => document.getElementById(id);

    if (byId('generateBtn')) byId('generateBtn').addEventListener('click', generateTickets);
    if (byId('clearDbBtn')) byId('clearDbBtn').addEventListener('click', clearDatabase);
    if (byId('downloadPdfBtn')) byId('downloadPdfBtn').addEventListener('click', downloadDoubleSidedPdf);
    if (byId('downloadZipBtn')) byId('downloadZipBtn').addEventListener('click', downloadZip);
    if (byId('exportBtn')) byId('exportBtn').addEventListener('click', exportCSV);
    if (byId('resetDownloadBtn')) byId('resetDownloadBtn').addEventListener('click', resetDownloadProgress);

    // Filters
    if (byId('searchTicket')) byId('searchTicket').addEventListener('keyup', () => { currentPage=1; renderTable(); });
    if (byId('filterStatus')) byId('filterStatus').addEventListener('change', () => { currentPage=1; renderTable(); });
    if (byId('refreshBtn')) byId('refreshBtn').addEventListener('click', () => { renderTable(); });

    // Modal
    if (byId('closeModalBtn')) byId('closeModalBtn').addEventListener('click', () => {
        const m = document.getElementById('ticketPreviewModal');
        if (m) m.classList.remove('active');
    });

    const local = localStorage.getItem('ekt_data');
    if(local) {
        allTickets = JSON.parse(local);
        initChartsIfNeeded();
        updateDashboard();
        renderTable();
    } else {
        initChartsIfNeeded();
    }

    // Start countdown (update ~every 60ms for ms display)
    updateCountdown();
    setInterval(updateCountdown, 60);
});

function startRealTimeSync() {
    db.collection('tickets').orderBy('createdAt', 'desc').onSnapshot(snap => {
        allTickets = [];
        snap.forEach(doc => {
            let d = doc.data();
            d.ticketId = doc.id;
            allTickets.push(d);
        });
        localStorage.setItem('ekt_data', JSON.stringify(allTickets));
        updateDashboard();
        renderTable();
    });
}

// ================================================
// 6. GENERATION LOGIC
// ================================================
async function generateTickets() {
    if(!isFirebaseConnected) return alert("Connect to internet.");
    const count = parseInt(document.getElementById('ticketCount').value) || 500;
    if(allTickets.length > 0 && !confirm("Overwrite database?")) return;

    const btn = document.getElementById('generateBtn');
    const bar = document.getElementById('progressFill');
    const txt = document.getElementById('progressText');
    btn.disabled = true;
    if (document.getElementById('progressContainer')) {
        document.getElementById('progressContainer').style.display='block';
    }

    try {
        let temp = [];
        for(let i=1; i<=count; i++) {
            const tid = generateSecureTicketId(i);
            const code = encryptTicketCode(tid);
            temp.push({
                ticketId: tid,
                status: 'GENERATED',
                price: CONFIG.ticketPrice,
                encryptedCode: code,
                createdAt: firebase.firestore.FieldValue.serverTimestamp()
            });
            if(i%50===0 && bar && txt) {
                bar.style.width=`${(i/count)*50}%`;
                txt.textContent=`Minting ${i}...`;
                await sleep(1);
            }
        }

        const batches = [];
        while(temp.length) batches.push(temp.splice(0, 200));

        for(let i=0; i<batches.length; i++) {
            const batch = db.batch();
            batches[i].forEach(t => { batch.set(db.collection('tickets').doc(t.ticketId), t); batch.set(db.collection('qr').doc(t.encryptedCode), { ticketId: t.ticketId, used: false }); });
            if (txt) txt.textContent = `Saving Batch ${i+1}/${batches.length}...`;
            await batch.commit();
            if (bar) bar.style.width = `${50 + ((i+1)/batches.length*50)}%`;
        }
        if (txt) txt.textContent = 'Done!';

        // Reset download tracking when regenerating tickets
        setExportedCount(0);
        setLastDownloadRange(0, 0);
        prevStats = { gen: 0, sold: 0, used: 0, rev: 0, downloaded: 0, remaining: 0 };

        logEvent(`Generated ${count} tickets.`, 'success');
        showNotification(`Created ${count} tickets.`);
    } catch(e) {
        console.error(e);
        alert(e.message);
    } finally {
        btn.disabled = false;
        if (document.getElementById('progressContainer')) {
            setTimeout(() => document.getElementById('progressContainer').style.display='none', 2000);
        }
    }
}

async function clearDatabase() {
    if(!confirm("Delete all tickets?")) return;
    localStorage.removeItem('ekt_data');
    allTickets = [];

    // Reset download tracking
    localStorage.removeItem('ekt_exported_count');
    localStorage.removeItem('ekt_last_download_range');
    prevStats = { gen: 0, sold: 0, used: 0, rev: 0, downloaded: 0, remaining: 0 };

    for (const col of ['tickets', 'qr']) {
        const q = await db.collection(col).get();
        for (let k = 0; k < q.docs.length; k += 400) {
            const batch = db.batch();
            q.docs.slice(k, k + 400).forEach(d => batch.delete(d.ref));
            await batch.commit();
        }
    }
    updateDashboard();
    renderTable();
    logEvent('Database reset and all tickets removed.', 'warning');
    showNotification('Database reset.', 'warning');
}

function resetDownloadProgress() {
    if (!confirm('Reset download progress? This will allow downloading all tickets again.')) return;
    setExportedCount(0);
    setLastDownloadRange(0, 0);
    prevStats.downloaded = 0;
    prevStats.remaining = allTickets.length;
    updateDashboard();
    logEvent('Download progress reset.', 'info');
    showNotification('Download progress reset.');
}

// ================================================
// 7. DESIGN (Red + Watermarks) with QR constrained
// ================================================
const watermarkSVG = `data:image/svg+xml;utf8,%3Csvg width='100' height='100' viewBox='0 0 100 100' xmlns='http://www.w3.org/2000/svg'%3E%3Cg transform='translate(50,50) rotate(-45)'%3E%3Ctext text-anchor='middle' font-family='Arial' font-size='10' fill='rgba(255,255,255,0.08)' font-weight='bold'%3EOFFICIAL ORIGINAL%3C/text%3E%3C/g%3E%3C/svg%3E`;

const guilloche = `data:image/svg+xml,%3Csvg width='40' height='40' viewBox='0 0 40 40' xmlns='http://www.w3.org/2000/svg'%3E%3Cpath d='M0 20 Q 10 0 20 20 T 40 20' fill='none' stroke='rgba(255,215,0,0.1)' stroke-width='0.5'/%3E%3C/svg%3E`;

function createTicketFront(t) {
    const qrSize = getQrSizeForTicket();
    return `
    <div style="width:${CONFIG.ticketWidth}px; height:${CONFIG.ticketHeight}px; 
        background: #0a0a0a; 
        border-radius: 16px; display: flex; overflow: hidden; position: relative; 
        font-family: 'Segoe UI', sans-serif; border: 1px solid #333;">
        
        <div style="position:absolute; inset:0; background-image: url('${guilloche}'); opacity:1;"></div>
        <div style="position:absolute; inset:0; background-image: url('${watermarkSVG}');"></div>
        
        <div style="width: 72%; padding: 15px 20px; position: relative; border-right: 2px dashed rgba(212,175,55,0.5);
            display: flex; flex-direction: column; justify-content: space-between; z-index: 5;">
            
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <div style="font-size:9px; color:#d4af37; letter-spacing:2px; font-weight:bold; border:1px solid #d4af37; padding:2px 6px; border-radius:4px;">OFFICIAL PASS</div>
                <div style="font-size:10px; color:#888; font-family:monospace;">ID: ${t.ticketId}</div>
            </div>

            <div style="margin-top:5px;">
                <div style="font-size:46px; font-weight:900; line-height:0.85; letter-spacing:-1px;
                    background: linear-gradient(to bottom, #ff4d4d 0%, #cc0000 100%); 
                    -webkit-background-clip: text; -webkit-text-fill-color: transparent;
                    filter: drop-shadow(0px 2px 0px rgba(0,0,0,0.5));">
                    EKINTABULI
                </div>
                <div style="font-family: cursive; font-size:22px; color:#fff; margin-left:5px; opacity:0.9;">
                    Kya Christmas 2025
                </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; margin-top:10px;">
                <div style="background:rgba(255,255,255,0.05); padding:5px; border-radius:6px;">
                    <div style="font-size:8px; color:#aaa;">DATE</div>
                    <div style="font-size:12px; color:#fff; font-weight:bold;">25 DEC</div>
                </div>
                <div style="background:rgba(255,255,255,0.05); padding:5px; border-radius:6px;">
                    <div style="font-size:8px; color:#aaa;">TIME</div>
                    <div style="font-size:12px; color:#fff; font-weight:bold;">6:00 PM</div>
                </div>
                <div style="background:rgba(255,255,255,0.05); padding:5px; border-radius:6px; border:1px solid #d4af37;">
                    <div style="font-size:8px; color:#d4af37;">PRICE</div>
                    <div style="font-size:12px; color:#d4af37; font-weight:bold;">10K UGX</div>
                </div>
            </div>
        </div>

        <div style="width: 28%; background: #151515; position: relative; display:flex; flex-direction:column; 
            align-items:center; justify-content:center; z-index: 6; padding:10px;">
            <div style="background:white; padding:8px; border-radius:8px; z-index:8; display:flex; align-items:center; justify-content:center;">
                <div id="qr-${t.ticketId}" style="width:${qrSize}px; height:${qrSize}px; display:block;"></div>
            </div>
            <div style="font-family:monospace; font-size:10px; color:#666; font-weight:bold; margin-top:8px; z-index:9;">${t.ticketId}</div>
        </div>
    </div>`;
}

function createTicketBack(t) {
    return `
    <div style="width:${CONFIG.ticketWidth}px; height:${CONFIG.ticketHeight}px; 
        background: #0a0a0a; border-radius: 16px; overflow: hidden; position: relative;
        display: flex; align-items: center; justify-content: center; text-align: center;
        font-family: 'Segoe UI', sans-serif; color: #ccc; border: 1px solid #333;">
        
        <div style="position:absolute; inset:0; background-image: url('${watermarkSVG}'); opacity:0.15;"></div>

        <div style="z-index:2; width:85%;">
            <div style="color:#d4af37; font-weight:bold; font-size:12px; margin-bottom:10px; letter-spacing:2px; border-bottom:1px solid #333; padding-bottom:5px; display:inline-block;">TERMS & CONDITIONS</div>
            <div style="font-size:9px; line-height:1.8; text-align:left; color:#aaa;">
                1. Valid for one person only on 25th Dec 2025.<br>
                2. The QR code is unique security token. Scanning invalidates it.<br>
                3. Duplication is a criminal offense.<br>
                4. No refunds or exchanges allowed.<br>
            </div>
            <div style="margin-top:15px; font-size:9px; font-family:monospace; color:#444;">
                SECURE HASH: ${t.encryptedCode.substring(t.encryptedCode.length-12)}
            </div>
        </div>
    </div>`;
}

// ================================================
// 8. DOWNLOADS (ZIP + PDF)
// ================================================
async function downloadZip() {
    if (!allTickets.length) return;

    const btn = document.getElementById('downloadZipBtn');
    const canvasWrapper = document.getElementById('ticketCanvas');
    if (!canvasWrapper) {
        alert('ticketCanvas container not found.');
        return;
    }

    btn.disabled = true;
    btn.innerHTML = 'Creating Zip...';

    try {
        const totalTickets = allTickets.length;
        const alreadyExported = getExportedCount();
        const BATCH_SIZE = 100;

        if (alreadyExported >= totalTickets) {
            showNotification('All tickets have already been exported.', 'warning');
            btn.disabled = false;
            btn.innerHTML = '📦 ZIP';
            return;
        }

        const startIndex = alreadyExported;
        const endIndex = Math.min(startIndex + BATCH_SIZE, totalTickets);
        const batchTickets = allTickets.slice(startIndex, endIndex);
        const batchNumber = Math.floor(startIndex / BATCH_SIZE) + 1;

        const zip = new JSZip();
        const folderName = `Tickets_Front_Batch_${batchNumber}`;
        const folder = zip.folder(folderName);

        btn.innerHTML = `Batch ${batchNumber}: preparing...`;

        for (let i = 0; i < batchTickets.length; i++) {
            const t = batchTickets[i];

            canvasWrapper.innerHTML = createTicketFront(t);
            const qrContainerFront = document.getElementById('qr-' + t.ticketId);
            const qrSize = getQrSizeForTicket();
            new QRCode(qrContainerFront, {
                text: getTicketLink(t),
                width: qrSize,
                height: qrSize,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            await waitForQRCodeRendered(qrContainerFront);

            const elFront = canvasWrapper.firstElementChild;
            const cvsFront = await html2canvas(elFront, {
                scale: CONFIG.captureScale,
                useCORS: true,
                allowTaint: false
            });

            folder.file(
                `${t.ticketId}_FRONT.png`,
                cvsFront.toDataURL('image/png').split(',')[1],
                { base64: true }
            );

            if (i % 10 === 0) {
                btn.innerHTML = `Batch ${batchNumber}: ${i + 1}/${batchTickets.length}...`;
            }
        }

        const content = await zip.generateAsync({ type: "blob" });
        saveAs(content, `EKINTABULI_Tickets_Front_Batch_${batchNumber}.zip`);

        const newExportedCount = endIndex;
        setExportedCount(newExportedCount);
        setLastDownloadRange(startIndex, endIndex);

        updateDashboard();

        logEvent(`Downloaded batch ${batchNumber} (${batchTickets.length} tickets).`, 'success');
        showNotification(`Downloaded batch ${batchNumber} (${batchTickets.length} tickets).`);
    } catch (e) {
        console.error(e);
        alert("Zip Error");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '📦 ZIP';
        if (canvasWrapper) canvasWrapper.innerHTML = '';
    }
}

async function downloadDoubleSidedPdf() {
    if(!allTickets.length) return;
    const btn = document.getElementById('downloadPdfBtn');
    const canvasWrapper = document.getElementById('ticketCanvas');
    if (!canvasWrapper) {
        alert('ticketCanvas container not found.');
        return;
    }

    btn.disabled = true;
    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF('p', 'mm', 'a4');

        const tW = 60, tH = 24, cols = 3, rows = 11, perPage = cols * rows;

        const chunks = [];
        for(let i=0; i<allTickets.length; i+=perPage) {
            chunks.push(allTickets.slice(i, i+perPage));
        }

        for(let p=0; p<chunks.length; p++) {
            const data = chunks[p];

            if(p>0) doc.addPage();
            btn.innerHTML = `Page ${p+1} Front...`;
            let x=10, y=10, c=0;
            for(let t of data) {
                canvasWrapper.innerHTML = createTicketFront(t);
                const qrContainer = document.getElementById('qr-'+t.ticketId);
                const qrSize = getQrSizeForTicket();
                new QRCode(qrContainer, {
                    text: getTicketLink(t),
                    width: qrSize,
                    height: qrSize,
                    colorDark: "#000000",
                    colorLight: "#ffffff",
                    correctLevel: QRCode.CorrectLevel.H
                });
                await waitForQRCodeRendered(qrContainer);
                const el = canvasWrapper.firstElementChild;
                const imgCanvas = await html2canvas(el, { scale: CONFIG.captureScale, useCORS: true, allowTaint: false });
                doc.addImage(imgCanvas.toDataURL('image/png'), 'PNG', x, y, tW, tH);
                x += tW + 2;
                c++;
                if(c % cols === 0) { x = 10; y += tH + 2; }
            }

            doc.addPage();
            btn.innerHTML = `Page ${p+1} Back...`;
            x=10; y=10; c=0;
            for(let t of data) {
                canvasWrapper.innerHTML = createTicketBack(t);
                const el = canvasWrapper.firstElementChild;
                const imgCanvas = await html2canvas(el, { scale: CONFIG.captureScale, useCORS: true, allowTaint: false });
                doc.addImage(imgCanvas.toDataURL('image/png'), 'PNG', x, y, tW, tH);
                x += tW + 2;
                c++;
                if(c % cols === 0) { x = 10; y += tH + 2; }
            }
        }

        doc.save('Tickets.pdf');
        showNotification("PDF Ready");
        logEvent('Downloaded PDF of tickets.', 'info');
    } catch(e) {
        console.error(e);
        alert('PDF Error');
    } finally {
        btn.disabled = false;
        btn.innerHTML = '📄 PDF (A4)';
        if (canvasWrapper) canvasWrapper.innerHTML='';
    }
}

// ================================================
// 9. CSV, TABLE & PREVIEW
// ================================================
function exportCSV() {
    const rows = [["Ticket ID", "Status", "Price", "Created At"]];
    allTickets.forEach(t => rows.push([
        t.ticketId,
        t.status,
        t.price,
        t.createdAt?.seconds ? new Date(t.createdAt.seconds*1000).toISOString() : ''
    ]));
    const csvContent = "data:text/csv;charset=utf-8," + rows.map(e => e.join(",")).join("\n");
    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "ticket_report.csv";
    link.click();
    logEvent('Exported ticket report CSV.', 'info');
}

function renderTable() {
    const tbody = document.getElementById('ticketTableBody');
    const searchInput = document.getElementById('searchTicket');
    const filterSelect = document.getElementById('filterStatus');
    const pagination = document.getElementById('pagination');

    if (!tbody) return;

    const searchVal = (searchInput?.value || '').toUpperCase();
    const filterVal = filterSelect?.value || 'ALL';

    filteredTickets = allTickets.filter(t => {
        const matchesSearch = t.ticketId.toUpperCase().includes(searchVal);
        const matchesStatus = filterVal === "ALL" || t.status === filterVal;
        return matchesSearch && matchesStatus;
    });

    const totalPages = Math.max(1, Math.ceil(filteredTickets.length / 20));
    if (currentPage > totalPages) currentPage = totalPages;

    const start = (currentPage-1) * 20;
    const pageData = filteredTickets.slice(start, start+20);

    if(!pageData.length) {
        tbody.innerHTML = '<tr><td colspan="4" style="text-align:center; padding:20px;">No tickets match your search.</td></tr>';
        if (pagination) pagination.innerHTML = '';
        return;
    }

    tbody.innerHTML = pageData.map(t => `
        <tr>
            <td><code>${t.ticketId}</code></td>
            <td><span class="badge" 
                style="padding:4px 8px; border-radius:12px; font-size:10px; 
                background:${t.status==='SOLD'?'#15803d':t.status==='USED'?'#4b5563':'rgba(234,179,8,0.15)'}; 
                color:${t.status==='SOLD'?'#ecfdf3':t.status==='USED'?'#e5e7eb':'#facc15'};">
                ${t.status}</span></td>
            <td>${formatCurrency(t.price)}</td>
            <td><button class="btn-secondary" onclick="showPreview('${t.ticketId}')">View</button></td>
        </tr>
    `).join('');

    if (pagination) {
        let pagHTML = '';
        if(currentPage > 1) pagHTML += `<button onclick="changePage(-1)">Prev</button>`;
        pagHTML += `<span>Page ${currentPage} of ${totalPages}</span>`;
        if(currentPage < totalPages) pagHTML += `<button onclick="changePage(1)">Next</button>`;
        pagination.innerHTML = pagHTML;
    }
}

function changePage(dir) {
    currentPage += dir;
    renderTable();
}

function showPreview(tid) {
    if(typeof tid !== 'string') return;
    const t = allTickets.find(x => x.ticketId === tid);
    if (!t) return;

    const modal = document.getElementById('ticketPreviewModal');
    const frontDiv = document.getElementById('ticketFrontPreview');
    const backDiv = document.getElementById('ticketBackPreview');

    if (frontDiv) frontDiv.innerHTML = createTicketFront(t);
    if (backDiv) backDiv.innerHTML = createTicketBack(t);
    if (modal) modal.classList.add('active');

    setTimeout(async () => {
        const qrContainer = document.getElementById('qr-'+t.ticketId);
        if (qrContainer) {
            const qrSize = getQrSizeForTicket();
            new QRCode(qrContainer, {
                text: getTicketLink(t),
                width: qrSize,
                height: qrSize,
                colorDark: "#000000",
                colorLight: "#ffffff",
                correctLevel: QRCode.CorrectLevel.H
            });
            await waitForQRCodeRendered(qrContainer);
        }
    }, 100);
}
