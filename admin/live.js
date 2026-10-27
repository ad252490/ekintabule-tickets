// Admin login + live gate panel. Needs Firebase Auth admin account (admin@ekintabule.app).
(function () {
  const ADMIN_EMAIL = 'admin@ekintabule.app';
  const el = document.getElementById('livePanel');
  const css = document.createElement('style');
  css.textContent = `.lp{background:#1b1212;border:1px solid #FFD700;border-radius:14px;padding:16px;margin:0 0 16px;color:#fff;font-family:system-ui,sans-serif}
  .lp h3{margin:0 0 10px;color:#FFD700}.lpg{display:grid;grid-template-columns:repeat(auto-fit,minmax(120px,1fr));gap:10px}
  .lpk{background:#2a1a1a;border-radius:10px;padding:10px;text-align:center}.lpk b{display:block;font-size:26px}.lpk span{font-size:12px;opacity:.7}
  .lpf{max-height:220px;overflow:auto;margin-top:12px;font-size:13px}.lpf div{padding:5px 0;border-bottom:1px solid #3a2525}
  .lpl{position:fixed;inset:0;background:#1a0a0a;z-index:99;display:grid;place-items:center}.lpl form{width:300px;display:grid;gap:10px}
  .lpl input,.lpl button{padding:14px;border-radius:10px;border:0;font-size:16px}.lpl button{background:#FFD700;font-weight:700}`;
  document.head.appendChild(css);

  firebase.auth().onAuthStateChanged(u => {
    const ok = u && u.email === ADMIN_EMAIL;
    document.querySelectorAll('.lpl').forEach(n => n.remove());
    if (!ok) return loginScreen();
    if (!window.__livePanelStarted) { window.__livePanelStarted = true; startPanel(); }
  });

  function loginScreen() {
    const d = document.createElement('div'); d.className = 'lpl';
    d.innerHTML = '<form><h2 style="color:#FFD700;margin:0">Admin login</h2><input type="email" placeholder="Email" value="' + ADMIN_EMAIL + '" required><input type="password" placeholder="Password" required><button>Sign in</button><small id="lpe" style="color:#f77"></small></form>';
    d.querySelector('form').onsubmit = async e => {
      e.preventDefault(); const [em, pw] = d.querySelectorAll('input');
      try { await firebase.auth().signInWithEmailAndPassword(em.value, pw.value); location.reload(); }   // reload so the dashboard starts signed in
      catch (x) { d.querySelector('#lpe').textContent = 'Sign-in failed'; }
    };
    document.body.appendChild(d);
  }

  function startPanel() {
    el.innerHTML = '<div class="lp"><h3>🚪 Live Gate Monitor</h3><div class="lpg" id="lpk"></div><canvas id="lpc" height="90" style="margin-top:12px"></canvas><div class="lpf" id="lpf"></div> <button id="lpo" style="margin-top:8px">Sign out</button></div>';
    document.getElementById('lpo').onclick = () => firebase.auth().signOut();
    let chart;
    db.collection('scanLogs').orderBy('scannedAt', 'desc').limit(500).onSnapshot(snap => {
      const logs = snap.docs.map(d => d.data()).filter(l => l.scannedAt);
      const tk = (typeof allTickets !== 'undefined') ? allTickets : [];
      const sold = tk.filter(t => ['SOLD', 'USED'].includes(t.status)).length, used = tk.filter(t => t.status === 'USED').length;
      const dup = logs.filter(l => l.result === 'DUPLICATE').length, bad = logs.filter(l => l.result === 'INVALID').length;
      const last10 = logs.filter(l => l.result === 'VALID' && Date.now() - l.scannedAt.toDate() < 600000).length;
      const k = (n, l, c) => `<div class="lpk"><b style="color:${c || '#fff'}">${n}</b><span>${l}</span></div>`;
      document.getElementById('lpk').innerHTML = k(used, 'Admitted', '#4ade80') + k(Math.max(sold - used, 0), 'Sold, not yet in') + k(sold, 'Sold') + k(dup, 'Duplicate attempts', '#fbbf24') + k(bad, 'Invalid scans', '#f87171') + k(last10, 'Entries / last 10 min');
      const buckets = {}; logs.filter(l => l.result === 'VALID').forEach(l => { const d = l.scannedAt.toDate(); const key = d.getHours() + ':' + String(Math.floor(d.getMinutes() / 15) * 15).padStart(2, '0'); buckets[key] = (buckets[key] || 0) + 1; });
      const labels = Object.keys(buckets).reverse(), data = labels.map(x => buckets[x]);
      if (typeof Chart !== 'undefined') { if (chart) chart.destroy(); chart = new Chart(document.getElementById('lpc'), { type: 'bar', data: { labels, datasets: [{ label: 'Entries per 15 min', data, backgroundColor: '#FF6B35' }] }, options: { plugins: { legend: { labels: { color: '#fff' } } }, scales: { x: { ticks: { color: '#ccc' } }, y: { ticks: { color: '#ccc' }, beginAtZero: true } } } }); }
      const f = document.getElementById('lpf'); f.textContent = '';
      logs.slice(0, 25).forEach(l => { const r = document.createElement('div'); const ic = { VALID: '✅', DUPLICATE: '⚠️', INVALID: '❌' }[l.result] || '•';
        r.textContent = `${ic} ${l.scannedAt.toDate().toLocaleTimeString()}  ${l.result}  ${l.ticketId || ''}`; f.appendChild(r); });
    });
  }
})();
