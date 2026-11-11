// Shared helpers for the TV and the phones.
window.F = (() => {
  const L = 100000, CR = 10000000;
  function inr(v) {
    v = Math.round(v || 0);
    const neg = v < 0; const a = Math.abs(v);
    let s;
    if (a >= CR) s = `₹${(a / CR).toFixed(2).replace(/\.?0+$/, '')} crore`;
    else if (a >= L) s = `₹${(a / L).toFixed(1).replace(/\.0$/, '')} lakh`;
    else s = `₹${a.toLocaleString('en-IN')}`;
    return neg ? `-${s}` : s;
  }
  function inrShort(v) {
    v = Math.round(v || 0); const a = Math.abs(v);
    if (a >= CR) return `₹${(v / CR).toFixed(2).replace(/\.?0+$/, '')}Cr`;
    if (a >= L) return `₹${(v / L).toFixed(1).replace(/\.0$/, '')}L`;
    if (a >= 1000) return `₹${Math.round(v / 1000)}k`;
    return `₹${v}`;
  }
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  let offset = 0;
  const syncClock = (serverNow) => { offset = serverNow - Date.now(); };
  const now = () => Date.now() + offset;
  const left = (endsAt) => (endsAt ? Math.max(0, endsAt - now()) : 0);

  // Tiny synthesised sound kit. No files needed.
  let ctx = null; let muted = false;
  function ac() { if (!ctx) { try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch (e) { ctx = null; } } if (ctx && ctx.state === 'suspended') ctx.resume(); return ctx; }
  function tone(freq, dur, type = 'sine', vol = 0.2, when = 0, slideTo = null) {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + when;
    const o = c.createOscillator(); const g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur + 0.02);
  }
  function noise(dur, vol = 0.3, when = 0, filter = 1200) {
    const c = ac(); if (!c || muted) return;
    const t = c.currentTime + when;
    const b = c.createBuffer(1, Math.floor(c.sampleRate * dur), c.sampleRate);
    const d = b.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / d.length);
    const s = c.createBufferSource(); s.buffer = b;
    const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = filter;
    const g = c.createGain(); g.gain.value = vol;
    s.connect(f).connect(g).connect(c.destination); s.start(t);
  }
  const sfx = {
    tick: () => tone(1200, 0.05, 'square', 0.06),
    bid: () => { tone(520, 0.08, 'triangle', 0.15); tone(780, 0.1, 'triangle', 0.12, 0.06); },
    gavel: () => { noise(0.12, 0.6, 0, 600); tone(110, 0.25, 'sine', 0.5); },
    cash: () => { tone(1320, 0.08, 'square', 0.08); tone(1760, 0.18, 'square', 0.08, 0.08); },
    fake: () => { tone(160, 0.45, 'sawtooth', 0.18, 0, 90); },
    shutter: () => { for (let i = 0; i < 12; i++) noise(0.05, 0.25, i * 0.06, 2500); },
    alarm: () => { for (let i = 0; i < 3; i++) tone(700, 0.25, 'sawtooth', 0.12, i * 0.5, 1100); },
    stamp: () => { noise(0.08, 0.7, 0, 400); tone(80, 0.3, 'sine', 0.6); },
    good: () => { tone(660, 0.1, 'sine', 0.15); tone(990, 0.2, 'sine', 0.15, 0.1); },
    bad: () => { tone(300, 0.15, 'square', 0.1); tone(200, 0.3, 'square', 0.1, 0.12); },
    click: (v = 0.08) => tone(2400, 0.015, 'square', v),
    drum: () => { for (let i = 0; i < 16; i++) noise(0.05, 0.15 + i * 0.02, i * 0.07, 300); },
    whoosh: () => noise(0.5, 0.25, 0, 1800),
  };
  const setMuted = (m) => { muted = m; };
  return { inr, inrShort, esc, syncClock, now, left, sfx, ac, setMuted, isMuted: () => muted };
})();

// Re-render helper: writes HTML only when it changed, then runs the "after" hook.
window.mount = (el, html) => { if (el.__html !== html) { el.innerHTML = html; el.__html = html; return true; } return false; };

// Global countdown updater: any element with data-ends gets its text or bar updated.
(function loop() {
  document.querySelectorAll('[data-ends]').forEach((el) => {
    const ends = Number(el.dataset.ends); const total = Number(el.dataset.total || 0);
    const ms = F.left(ends);
    if (el.dataset.kind === 'bar') { el.style.transform = `scaleX(${total ? Math.min(1, ms / total) : 0})`; }
    else el.textContent = Math.ceil(ms / 1000);
  });
  requestAnimationFrame(loop);
})();
