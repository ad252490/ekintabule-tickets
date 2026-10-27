// Shared-PIN gate scanner. The PIN is the password of ONE Firebase staff account (see README),
// so Firestore itself enforces access – the PIN cannot be bypassed by editing this file.
const GATE_EMAIL = 'gate@ekintabule.app';
const IDLE_MS = 5 * 60 * 1000;           // auto-lock after 5 min without a scan
const $ = id => document.getElementById(id);
const auth = firebase.auth();
let scanner = null, busy = false, admitted = 0, idleTimer = null, fails = 0, lockedUntil = 0;

// ---------- PIN lock ----------
auth.onAuthStateChanged(u => {
  const ok = u && u.email === GATE_EMAIL;
  $('lock').style.display = ok ? 'none' : 'block';
  $('app').style.display = ok ? 'block' : 'none';
  if (ok) bumpIdle(); else { stopScanner(); $('pin').value = ''; }
});
$('unlock').onclick = async () => {
  if (Date.now() < lockedUntil) { $('err').textContent = 'Too many attempts. Wait ' + Math.ceil((lockedUntil - Date.now()) / 1000) + 's'; return; }
  try {
    await auth.setPersistence(firebase.auth.Auth.Persistence.SESSION);
    await auth.signInWithEmailAndPassword(GATE_EMAIL, $('pin').value.trim());
    fails = 0; $('err').textContent = '';
  } catch (e) {
    fails++; $('pin').value = '';
    if (fails >= 5) { lockedUntil = Date.now() + 30000; fails = 0; }
    $('err').textContent = e.code === 'auth/network-request-failed' ? 'No connection' : 'Wrong PIN';
  }
};
$('pin').addEventListener('keydown', e => { if (e.key === 'Enter') $('unlock').click(); });
$('lockBtn').onclick = () => auth.signOut();
function bumpIdle() { clearTimeout(idleTimer); idleTimer = setTimeout(() => auth.signOut(), IDLE_MS); }

// ---------- Scanner ----------
$('startBtn').onclick = async () => {
  try {
    scanner = new Html5Qrcode('reader');
    await scanner.start({ facingMode: 'environment' }, { fps: 10, qrbox: 250 }, onScan, () => {});
    $('startBtn').style.display = 'none';
  } catch (e) { $('err').textContent = 'Camera error: ' + (e.message || e); }
};
function stopScanner() { if (scanner) { scanner.stop().catch(() => {}); scanner = null; $('startBtn').style.display = 'block'; } }
function resume() { busy = false; try { scanner && scanner.resume(); } catch (e) {} }

function tokenFrom(text) {                        // QR holds a link like .../verify/?t=<token>
  try { return new URL(text).searchParams.get('t') || ''; } catch (e) { return ''; }
}
async function onScan(text) {
  if (busy) return; busy = true; bumpIdle();
  try { scanner.pause(true); } catch (e) {}
  const token = tokenFrom(text);
  if (!/^[a-f0-9]{32}$/.test(token)) return show('bad', '❌ NOT A VALID TICKET', 'Not an EKINTABULE QR code', 'invalid');
  try {
    const res = await db.runTransaction(async tx => {            // atomic: two gates can't both admit
      const qRef = db.collection('qr').doc(token), q = await tx.get(qRef);
      if (!q.exists) return { r: 'INVALID' };
      const tRef = db.collection('tickets').doc(q.data().ticketId), t = await tx.get(tRef);
      if (!t.exists) return { r: 'INVALID' };
      if (t.data().status === 'USED' || t.data().used) {
        const at = t.data().scannedAt; return { r: 'DUPLICATE', id: tRef.id, at: at && at.toDate ? at.toDate() : null };
      }
      tx.update(tRef, { status: 'USED', scanned: true, used: true, scannedBy: 'gate',
                        scannedAt: firebase.firestore.FieldValue.serverTimestamp() });
      tx.update(qRef, { used: true, usedAt: firebase.firestore.FieldValue.serverTimestamp() });
      return { r: 'VALID', id: tRef.id };
    });
    if (res.r === 'VALID') { admitted++; $('count').textContent = admitted; show('ok', '✅ VALID', 'Entry approved', 'ok', res.id); }
    else if (res.r === 'DUPLICATE') show('warn', '⚠️ ALREADY USED', 'Scanned at ' + (res.at ? res.at.toLocaleTimeString() : 'unknown time'), 'dup', res.id);
    else show('bad', '❌ INVALID', 'Ticket not found', 'invalid');
    log(res.r, res.id || null);
  } catch (e) {
    show('wait', '📡 CAN’T CHECK', 'No connection or permission error. Do not admit – retry.', 'err');
  }
}
function log(result, ticketId) {
  db.collection('scanLogs').add({ ticketId, result, scannedAt: firebase.firestore.FieldValue.serverTimestamp(),
    device: navigator.userAgent.substring(0, 100) }).catch(() => {});
}
function show(cls, title, msg, tone, id) {
  if (cls === 'bad') log('INVALID', null);
  const r = $('result'); r.className = cls; r.style.display = 'flex'; r.textContent = '';
  const h = document.createElement('h2'); h.textContent = title; r.appendChild(h);   // textContent: no HTML injection
  const p = document.createElement('p'); p.textContent = msg; r.appendChild(p);
  if (id) { const i = document.createElement('p'); i.textContent = '🎫 ' + id; r.appendChild(i); }
  const s = document.createElement('small'); s.textContent = 'Tap to scan next'; r.appendChild(s);
  beep(tone); if (navigator.vibrate) navigator.vibrate(tone === 'ok' ? 80 : [200, 100, 200]);
  if (tone === 'ok') setTimeout(() => { if (r.style.display === 'flex') { r.style.display = 'none'; resume(); } }, 1500);
}
function beep(tone) {
  try { const c = new (window.AudioContext || window.webkitAudioContext)(), o = c.createOscillator(), g = c.createGain();
    o.connect(g); g.connect(c.destination); o.frequency.value = tone === 'ok' ? 880 : 220; o.type = tone === 'ok' ? 'sine' : 'sawtooth';
    g.gain.value = .3; o.start(); o.stop(c.currentTime + (tone === 'ok' ? .15 : .4)); } catch (e) {}
}
window.addEventListener('offline', () => $('off').style.display = 'block');
window.addEventListener('online', () => $('off').style.display = 'none');
