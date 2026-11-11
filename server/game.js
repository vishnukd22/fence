'use strict';
// FENCE: the game engine. One Game per room.
const crypto = require('crypto');
const C = require('./content');
const { L, CR } = C;

const SPEED = Number(process.env.FENCE_SPEED || 1);
const sec = (s) => Math.max(40, Math.round(s * 1000 * SPEED));

const rand = (a, b) => a + Math.random() * (b - a);
const randi = (a, b) => Math.floor(rand(a, b + 1));
const pick = (a) => a[Math.floor(Math.random() * a.length)];
const shuffle = (arr) => { const a = [...arr]; for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const uid = () => crypto.randomBytes(6).toString('hex');
const nice = (v) => (v >= L ? Math.round(v / 10000) * 10000 : v >= 10000 ? Math.round(v / 1000) * 1000 : Math.max(100, Math.round(v / 100) * 100));
const money = (v) => {
  const n = Math.round(v);
  if (Math.abs(n) >= CR) return `₹${(n / CR).toFixed(2).replace(/\.?0+$/, '')} crore`;
  if (Math.abs(n) >= L) return `₹${(n / L).toFixed(1).replace(/\.0$/, '')} lakh`;
  return `₹${n.toLocaleString('en-IN')}`;
};

const COLORS = ['#F2A541', '#4FC1B0', '#E85D75', '#9B8CF2', '#5DADE2', '#F4D35E', '#A3D977', '#F08A5D'];
const EMOJIS = ['🐯', '🐘', '🦚', '🐊', '🦀', '🐍', '🦜', '🐟'];
const START_CASH = 10 * L;
const APPRAISE_COST = 25000;
const BRIBE_COST = 2 * L;
const BRIBE_HEAT = 25;
const CHACKO_HEAT = 15;
const FINE = 2 * L;
const RAT_PAY = 3 * L;
const TIP_PAY = 3 * L;
const TIP_HEAT = 12;
const MISSION_PAY = 5 * L;
const GUESS_PAY = 15 * L;
const BID_INCS = [10000, 50000, L, 5 * L];
const GLYPHS = ['▲', '●', '■', '◆', '★', '✚'];
const ROLE_ORDER = ['lookout', 'safecracker', 'hacker', 'driver'];
const ROLE_INFO = {
  lookout: { name: 'The Lookout', icon: '👀', how: 'Only YOU can see the guard. Shout STOP when he turns around, GO when he looks away.' },
  safecracker: { name: 'The Safecracker', icon: '🔐', how: 'Turn the dial slowly. Your phone buzzes and the needle jumps when you are close. Tap SET to lock each number. Only move when the lookout says GO.' },
  hacker: { name: 'The Hacker', icon: '💻', how: 'Memorise the code when it flashes, then tap it in. Three codes loop the cameras. Only type when the lookout says GO.' },
  driver: { name: 'The Driver', icon: '🚗', how: 'Keep the car hidden. Tap HIDE the moment headlights appear. Then you choose the escape route.' },
};

const SETS_PARTS = {};
for (const t of C.ITEMS) { const o = t[5] || {}; if (o.set) (SETS_PARTS[o.set] = SETS_PARTS[o.set] || []).push(t); }

function tierOf(v) { return v < 5000 ? 'junk' : v < L ? 'decent' : v < 40 * L ? 'big' : 'jackpot'; }

class Game {
  constructor(code, hooks) {
    this.code = code;
    this.hooks = hooks;
    this.players = [];
    this.phase = 'LOBBY';
    this.d = {};
    this.endsAt = null;
    this.timer = null;
    this.onEnd = null;
    this.intervals = [];
    this.act = 0;
    this.godownNo = 0;
    this.lastActive = Date.now();
    this.syncPending = false;
  }

  destroy() { clearTimeout(this.timer); this.intervals.forEach(clearInterval); this.intervals = []; }

  // ------------------------------------------------------------------ helpers
  P(id) { return this.players.find((p) => p.id === id); }
  connected() { return this.players.filter((p) => p.connected); }
  vip() { return this.connected()[0] || this.players[0]; }
  pub(p) { return p ? { id: p.id, name: p.name, color: p.color, emoji: p.emoji } : null; }
  note(p, text, kind = 'info') { if (!p) return; p.noteSeq = (p.noteSeq || 0) + 1; p.notes.push({ id: p.noteSeq, text, kind }); if (p.notes.length > 6) p.notes.shift(); }
  feed(text) { if (this.d.feed) { this.d.feed.push({ id: uid(), text }); if (this.d.feed.length > 8) this.d.feed.shift(); } }
  chron(act, text, weight = 1) { this.chronicle.push({ act, text, weight }); }

  setPhase(phase, d = {}, ms = null, onEnd = null) {
    clearTimeout(this.timer);
    this.timer = null;
    this.phase = phase;
    this.d = d;
    this.onEnd = onEnd;
    this.endsAt = ms ? Date.now() + ms : null;
    if (ms && onEnd) this.timer = setTimeout(() => this.fire(), ms);
    this.sync();
  }
  fire() { const f = this.onEnd; this.onEnd = null; clearTimeout(this.timer); this.timer = null; if (f) f(); }
  resetTimer(ms) { clearTimeout(this.timer); this.endsAt = Date.now() + ms; this.timer = setTimeout(() => this.fire(), ms); }

  sync() {
    if (this.syncPending) return;
    this.syncPending = true;
    setImmediate(() => {
      this.syncPending = false;
      try {
        this.hooks.toHost(this.stateFor(null));
        for (const p of this.players) if (p.connected) this.hooks.toPlayer(p.id, this.stateFor(p.id));
      } catch (e) { console.error('sync error', e); }
    });
  }

  // ------------------------------------------------------------------ lobby
  join(name, token) {
    this.lastActive = Date.now();
    if (token) {
      const p = this.players.find((x) => x.token === token);
      if (p) return { player: p };
    }
    name = String(name || '').replace(/\s+/g, ' ').trim().slice(0, 14);
    if (!name) return { error: 'Enter your name' };
    const same = this.players.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (same) {
      if (!same.connected) { same.token = uid(); return { player: same }; }
      return { error: 'That name is taken' };
    }
    if (this.phase !== 'LOBBY') return { error: 'This game has already started' };
    if (this.players.length >= 8) return { error: 'The room is full (8 players)' };
    const i = this.players.length;
    const used = new Set(this.players.map((x) => x.color));
    const ci = COLORS.findIndex((c) => !used.has(c));
    const p = { id: uid(), token: uid(), name, color: COLORS[ci], emoji: EMOJIS[ci], connected: true, notes: [], noteSeq: 0 };
    this.resetPlayer(p);
    this.players.push(p);
    this.sync();
    return { player: p, index: i };
  }

  resetPlayer(p) {
    Object.assign(p, {
      cash: START_CASH, heat: 0, inv: [], isRat: false, mission: null, missionTarget: null, request: null,
      stats: { godownsWon: 0, crews: 0, soloGrab: 0, raided: 0, chacko: 0, wonLast: false, plannedOk: 0, spent: 0, tipBust: 0, boughtFromPlayer: 0 },
      hints: [], final: null,
    });
  }

  setConnected(id, on) { const p = this.P(id); if (p) { p.connected = on; this.lastActive = Date.now(); this.sync(); } }

  kick(byId, targetId) {
    if (this.phase !== 'LOBBY' || this.vip()?.id !== byId) return;
    this.players = this.players.filter((p) => p.id !== targetId);
    this.hooks.kicked?.(targetId);
    this.sync();
  }

  // ------------------------------------------------------------------ setup
  start(byId) {
    if (byId && this.vip()?.id !== byId) return { error: 'Only the first player can start' };
    if (!['LOBBY', 'FINAL'].includes(this.phase)) return {};
    this.players = this.players.filter((p) => p.connected);
    if (this.players.length < 2) return { error: 'You need at least 2 players' };
    this.players.forEach((p) => this.resetPlayer(p));
    this.act = 1;
    this.godownNo = 0;
    this.chronicle = [];
    this.cleared = [];
    this.heistResults = [];
    this.lastEventId = null;
    this.event = null;

    const n = this.players.length;
    let rats = 0;
    if (n >= 4) { const r = Math.random(); rats = r < 0.2 ? 0 : (n >= 6 && r > 0.82 ? 2 : 1); }
    shuffle(this.players).slice(0, rats).forEach((p) => { p.isRat = true; });
    this.ratCount = rats;

    const missions = shuffle(C.MISSIONS);
    this.players.forEach((p, i) => {
      const m = missions[i % missions.length];
      p.mission = m;
      if (m.needsTarget) p.missionTarget = pick(this.players.filter((x) => x.id !== p.id)).id;
    });

    this.suspects = shuffle(C.SUSPECTS).slice(0, 4).map((s) => ({ ...s }));
    this.godfather = pick(this.suspects).id;
    this.heists = [pick(C.HEISTS.filter((h) => h.tier === 1)), pick(C.HEISTS.filter((h) => h.tier === 2)), C.FINAL_HEIST].map((h) => ({ ...h }));
    this.godowns = this.buildGodowns();

    this.narrate('intro', 'FENCE', C.STORY.intro, 48, () => this.beginAct(1));
    return {};
  }

  makeItem(t) {
    const [name, cat, v, peek, note, o = {}] = t;
    const val = o.set ? v : nice(v * rand(0.85, 1.15));
    const fake = o.fake ? Math.random() < o.fake : false;
    return { uid: uid(), kind: 'item', name, trueName: fake ? `Counterfeit ${name.replace(/^Vintage |^Pair of |^Original /, '')}` : name, cat, apparent: val, trueValue: fake ? nice(Math.max(1500, val * 0.01)) : val, fake, gem: false, hot: false, set: o.set || null, peek, note, appraised: false };
  }
  makeGem(g) { return { uid: uid(), kind: 'item', name: g.apparent, trueName: g.trueName, cat: g.cat, apparent: g.apparentValue, trueValue: g.trueValue, fake: false, gem: true, hot: false, set: null, peek: g.peek, note: g.note, appraised: false }; }
  makeHot(h) { const [name, v, peek, note] = h; const val = nice(v * rand(0.85, 1.15)); return { uid: uid(), kind: 'item', name, trueName: name, cat: 'gold', apparent: val, trueValue: val, fake: false, gem: false, hot: true, set: null, peek, note, appraised: false }; }
  makeClue(hi, i) {
    const h = this.heists[hi];
    if (hi === 2) return { uid: uid(), kind: 'clue', heist: 2, name: "Map to the Godfather's tharavad", peek: 'A hand-drawn map folded very small', text: 'Whoever holds this map plans the final heist on the Godfather\'s house.', cat: 'clue', apparent: 0, trueValue: 0 };
    const names = [`Blueprint of the ${h.short}`, `Guard rota for the ${h.short}`, `Spare key for the ${h.short}`];
    const peeks = ['A rolled-up blueprint', 'A folded sheet of handwritten times', 'A single key on a cardboard tag'];
    return { uid: uid(), kind: 'clue', heist: hi, name: names[i], peek: peeks[i], text: `One of 3 pieces for ${h.name}, ${h.place}. Whoever holds the most pieces plans that heist.`, cat: 'clue', apparent: 0, trueValue: 0 };
  }
  makeEvidence(s, text) { return { uid: uid(), kind: 'evidence', suspect: s.id, name: text, peek: "A box of someone's personal papers", text: `This points to ${s.name}, ${s.title}.`, cat: 'evidence', apparent: 0, trueValue: 0 }; }

  buildGodowns() {
    const usedNames = new Set();
    const tiers = { junk: [], decent: [], big: [], jackpot: [] };
    for (const t of C.ITEMS) { if (!(t[5] || {}).set) tiers[tierOf(t[2])].push(t); }
    const take = (tier) => {
      let pool = tiers[tier].filter((t) => !usedNames.has(t[0]));
      if (!pool.length) pool = tiers[tier];
      const t = pick(pool); usedNames.add(t[0]); return this.makeItem(t);
    };
    const facilities = shuffle(C.FACILITIES);
    const leases = shuffle(C.LEASE_NAMES);
    let gemsLeft = randi(1, 2);
    let jackpotsLeft = 2;
    const gems = shuffle(C.GEMS);
    const hots = shuffle(C.HOT);
    let hi = 0;
    const godowns = [];
    for (let n = 1; n <= 7; n++) {
      const act = n <= 3 ? 1 : n <= 6 ? 2 : 3;
      const g = { no: n, act, isLast: n === 7, facility: facilities[(n - 1) % facilities.length], lease: n === 7 ? 'K.S.B. (lease unpaid since the robbery)' : leases[n - 1], items: [] };
      const junk = randi(1, 2); for (let i = 0; i < junk; i++) g.items.push(take('junk'));
      const dec = randi(1, 2); for (let i = 0; i < dec; i++) g.items.push(take('decent'));
      if (Math.random() < (n === 7 ? 1 : 0.6)) g.items.push(take('big'));
      if (Math.random() < 0.15) g.items.push(take('big'));
      if (jackpotsLeft > 0 && Math.random() < (n === 7 ? 0.35 : 0.08)) { g.items.push(take('jackpot')); jackpotsLeft--; }
      if (gemsLeft > 0 && Math.random() < 0.16) { g.items.push(this.makeGem(gems.pop())); gemsLeft--; }
      if (act === 2 && Math.random() < 0.7) { const k = randi(1, 2); for (let i = 0; i < k; i++) g.items.push(this.makeHot(hots[hi++ % hots.length])); }
      if (n === 7) { for (let i = 0; i < 3; i++) g.items.push(this.makeHot(hots[hi++ % hots.length])); }
      godowns.push(g);
    }
    // sets: spread three parts across three different godowns
    for (const key of Object.keys(SETS_PARTS)) {
      if (Math.random() < 0.75) {
        const slots = shuffle([0, 1, 2, 3, 4, 5, 6]).slice(0, 3);
        SETS_PARTS[key].forEach((t, i) => godowns[slots[i]].items.push(this.makeItem(t)));
      }
    }
    // heist pieces
    [0, 1, 2].forEach((i) => godowns[i].items.push(this.makeClue(0, i)));
    [3, 4, 5].forEach((g, i) => godowns[g].items.push(this.makeClue(1, i)));
    godowns[6].items.push(this.makeClue(2, 0));
    // Godfather evidence: the guilty man gets 3 pieces, everyone else 1
    const evid = [];
    for (const s of this.suspects) {
      const texts = shuffle(s.evidence);
      const k = s.id === this.godfather ? 3 : 1;
      for (let i = 0; i < k; i++) evid.push({ s, text: texts[i] });
    }
    const sh = shuffle(evid);
    const guiltyIdx = sh.findIndex((e) => e.s.id === this.godfather);
    godowns[6].items.push(this.makeEvidence(sh[guiltyIdx].s, sh[guiltyIdx].text));
    sh.splice(guiltyIdx, 1);
    const spots = shuffle([0, 1, 2, 3, 4, 5]);
    sh.forEach((e, i) => godowns[spots[i % 6]].items.push(this.makeEvidence(e.s, e.text)));
    godowns.forEach((g) => { g.items = shuffle(g.items); });
    return godowns;
  }

  // ------------------------------------------------------------------ flow
  narrate(kind, title, lines, seconds, next, extra = {}) {
    this.setPhase('NARRATION', { kind, title, lines, ...extra }, sec(seconds), next);
  }

  skip(byId) {
    const skippable = ['NARRATION', 'PAPER', 'RAIDS', 'HEIST_RESULT', 'SPLIT_RESULT', 'REVEAL_RAT', 'REVEAL_GODFATHER', 'REVEAL_MISSIONS', 'UNSOLD', 'HEIST_BRIEF'];
    if (byId && this.vip()?.id !== byId) return;
    if (skippable.includes(this.phase)) this.fire();
  }

  beginAct(n) {
    this.act = n;
    const s = C.STORY[`act${n}`];
    this.narrate('act', s[1], s.slice(2), n === 1 ? 14 : 30, () => this.nextGodown(), { actLabel: s[0], act: n });
  }

  nextGodown() {
    this.godownNo++;
    const g = this.godowns[this.godownNo - 1];
    this.event = null;
    if (this.act >= 2 && Math.random() < 0.55) {
      const ev = pick(C.EVENTS.filter((e) => e.id !== this.lastEventId && !(g.isLast && e.id === 'flood')));
      this.event = ev;
      this.lastEventId = ev.id;
      if (ev.id === 'flood') g.items.forEach((it) => { if (it.kind === 'item' && !it.hot) { it.apparent = nice(it.apparent * 0.6); it.trueValue = nice(it.trueValue * 0.6); } });
      if (ev.id === 'customs') this.players.forEach((p) => { if (p.inv.some((it) => it.hot)) { p.heat = Math.min(100, p.heat + 20); this.note(p, 'Customs officers saw you with hot goods. Heat +20.', 'bad'); } });
      if (ev.id === 'taxman') this.players.forEach((p) => { const t = Math.round(p.cash * 0.05); p.cash -= t; this.note(p, `The taxman took ${money(t)}.`, 'bad'); });
    }
    const items = shuffle(g.items);
    const peeks = {};
    shuffle(this.connected()).forEach((p, i) => { peeks[p.id] = items[i % items.length].uid; });
    this.setPhase('VIEWING', { g, peeks }, sec(g.isLast ? 16 : 13), () => this.enterAuction());
  }

  enterAuction() {
    this.setPhase('AUCTION', { g: this.d.g, peeks: this.d.peeks, a: { high: 0, bidder: null, bids: 0, rumours: [], used: {} } }, sec(16), () => this.endAuction());
  }

  bid(pid, inc) {
    if (this.phase !== 'AUCTION') return;
    const a = this.d.a; const p = this.P(pid);
    if (!p || !BID_INCS.includes(inc) || a.bidder === pid) return;
    const amount = a.high + inc;
    if (amount > p.cash) return { error: 'Not enough cash' };
    a.high = amount; a.bidder = pid; a.bids++;
    this.resetTimer(sec(Math.max(4, 11 - a.bids * 0.7)));
    this.sync();
  }

  rumour(pid, idx) {
    if (this.phase !== 'AUCTION' || this.act < 2) return;
    const a = this.d.a;
    if (a.used[pid] || !C.RUMOURS[idx]) return;
    a.used[pid] = true;
    a.rumours.push({ id: uid(), text: C.RUMOURS[idx] });
    this.sync();
  }

  endAuction() {
    const { g, a } = this.d;
    const p = this.P(a.bidder);
    if (p) {
      p.cash -= a.high;
      p.stats.spent += a.high;
      p.stats.godownsWon++;
      if (g.isLast) p.stats.wonLast = true;
      g.items.forEach((it) => p.inv.push(it));
      g.winner = p.id; g.price = a.high;
      const best = g.items.filter((i) => i.kind === 'item').sort((x, y) => y.trueValue - x.trueValue)[0];
      if (best && best.trueValue >= 5 * L) this.chron(this.act, `${p.name} bought Godown ${g.no} for ${money(a.high)}. Word is something valuable was inside.`, best.trueValue / L);
      this.setPhase('OPENING', { g, winner: p.id, price: a.high, revealed: [] }, sec(16), () => this.enterMarket());
    } else {
      this.setPhase('UNSOLD', { g }, sec(5), () => this.enterMarket());
    }
  }

  openingReveal(pid, itemId) {
    if (this.phase !== 'OPENING' || this.d.winner !== pid) return;
    const it = this.d.g.items.find((i) => i.uid === itemId);
    if (!it || this.d.revealed.includes(itemId)) return;
    this.d.revealed.push(itemId);
    this.sync();
  }
  openingDone(pid) { if (this.phase === 'OPENING' && this.d.winner === pid) this.fire(); }

  enterMarket() {
    const cats = Object.keys(C.CATEGORIES).filter((c) => !['junk', 'gold'].includes(c));
    this.players.forEach((p) => { p.request = Math.random() < 0.6 ? { cat: pick(cats), mult: pick([2, 2, 3]) } : null; });
    this.setPhase('MARKET', { feed: [], offers: [], done: {}, ev: this.event }, sec(60), () => this.endMarket());
    if (this.event?.id === 'hartal') this.feed('Hartal today. Dealers and Chacko are shut.');
  }

  endMarket() {
    this.players.forEach((p) => { p.request = null; });
    const g = this.godowns[this.godownNo - 1];
    if (this.godownNo === 3) return this.startHeist(0);
    if (this.godownNo === 6) return this.startHeist(1);
    if (g.isLast) return this.startHeist(2);
    return this.nextGodown();
  }

  // ------------------------------------------------------------------ market
  own(p, itemId) { return p?.inv.find((i) => i.uid === itemId); }
  dealersOpen() { return !(this.event && this.event.id === 'hartal'); }
  priceFor(p, it) {
    let m = 1;
    const ev = this.event?.id;
    if (ev === 'onam' && ['kerala', 'home'].includes(it.cat)) m *= 1.5;
    if (ev === 'gulfbuyer' && ['watch', 'fashion', 'camera'].includes(it.cat)) m *= 1.5;
    if (p.request && p.request.cat === it.cat) m *= p.request.mult;
    const base = it.appraised ? it.trueValue : it.apparent;
    return { price: nice(base * m), m };
  }

  sell(pid, itemId) {
    const p = this.P(pid); const it = this.own(p, itemId);
    if (this.phase !== 'MARKET' || !it || it.kind !== 'item') return;
    if (it.hot) return { error: 'No legal dealer will touch hot goods. Try Chacko.' };
    if (!this.dealersOpen()) return { error: 'Hartal. The dealers are shut.' };
    p.inv = p.inv.filter((i) => i !== it);
    if (it.fake) {
      p.cash += it.trueValue;
      this.note(p, `FAKE! The dealer laughed at your ${it.name}. He gave you ${money(it.trueValue)} for the parts.`, 'bad');
      this.feed(`💥 FAKE! ${p.name} tried to sell a "${it.name}". The dealer laughed.`);
      this.chron(this.act, `${p.name} was caught trying to sell a fake ${it.name} in Mattancherry.`, 3);
      return;
    }
    const { price, m } = this.priceFor(p, it);
    p.cash += price;
    if (it.gem && !it.appraised) this.note(p, `Sold for ${money(price)}. The dealer could not stop smiling. Hmm.`, 'info');
    else this.note(p, `Sold ${it.appraised ? it.trueName : it.name} for ${money(price)}${m > 1 ? ' (bonus price!)' : ''}.`, 'good');
    this.feed(`${p.emoji} ${p.name} sold ${it.appraised ? it.trueName : it.name} to a dealer.`);
    if (price >= 10 * L) this.chron(this.act, `${p.name} sold ${it.appraised ? it.trueName : it.name} for ${money(price)}.`, price / L);
    this.sync();
  }

  sellJunk(pid) {
    const p = this.P(pid);
    if (this.phase !== 'MARKET' || !p) return;
    if (!this.dealersOpen()) return { error: 'Hartal. The dealers are shut.' };
    const junk = p.inv.filter((i) => i.kind === 'item' && !i.hot && !i.set && (i.appraised ? i.trueValue : i.apparent) < 5000);
    if (!junk.length) return { error: 'Nothing cheap to clear out' };
    let total = 0; let gem = false;
    for (const it of junk) { total += this.priceFor(p, it).price; if (it.gem && !it.appraised) gem = true; }
    p.inv = p.inv.filter((i) => !junk.includes(i));
    p.cash += total;
    this.note(p, `Cleared out ${junk.length} cheap item${junk.length > 1 ? 's' : ''} for ${money(total)}.${gem ? ' The dealer looked suspiciously happy.' : ''}`, 'good');
    this.feed(`${p.emoji} ${p.name} sold a pile of junk to the kabadi man.`);
    this.sync();
  }

  sellSet(pid, key) {
    const p = this.P(pid);
    if (this.phase !== 'MARKET' || !p || !SETS_PARTS[key]) return;
    if (!this.dealersOpen()) return { error: 'Hartal. The dealers are shut.' };
    const parts = this.setParts(p, key);
    if (!parts) return { error: 'You do not own the full set' };
    const price = nice(parts.reduce((s, i) => s + i.trueValue, 0) * 2);
    p.inv = p.inv.filter((i) => !parts.includes(i));
    p.cash += price;
    this.note(p, `Full set sold: ${C.SETS[key]} for ${money(price)}. Double value!`, 'good');
    this.feed(`✨ ${p.name} sold a complete set: ${C.SETS[key]}!`);
    this.chron(this.act, `${p.name} completed the ${C.SETS[key]} and sold it for ${money(price)}.`, 4);
    this.sync();
  }
  setParts(p, key) {
    const need = SETS_PARTS[key].map((t) => t[0]);
    const parts = need.map((n) => p.inv.find((i) => i.kind === 'item' && i.set === key && i.name === n));
    return parts.every(Boolean) ? parts : null;
  }

  chacko(pid, itemId) {
    const p = this.P(pid); const it = this.own(p, itemId);
    if (this.phase !== 'MARKET' || !it || !it.hot) return;
    if (!this.dealersOpen()) return { error: 'Hartal. Even Chacko is shut today.' };
    const mult = this.event?.id === 'goldspike' ? 2 : 1;
    const price = nice(it.trueValue * mult);
    p.inv = p.inv.filter((i) => i !== it);
    p.cash += price;
    p.heat = Math.min(100, p.heat + CHACKO_HEAT);
    p.stats.chacko++;
    this.note(p, `Chacko paid ${money(price)} cash. No questions. Heat +${CHACKO_HEAT}.`, 'good');
    this.feed('🚚 A truck was seen heading towards Aluva...');
    this.sync();
  }

  appraise(pid, itemId) {
    const p = this.P(pid); const it = this.own(p, itemId);
    if (this.phase !== 'MARKET' || !it || it.kind !== 'item' || it.appraised) return;
    if (p.cash < APPRAISE_COST) return { error: 'Not enough cash' };
    p.cash -= APPRAISE_COST;
    it.appraised = true;
    if (it.fake) this.note(p, `Appraiser: "${it.name}" is a FAKE. Worth ${money(it.trueValue)}.`, 'bad');
    else if (it.gem) this.note(p, `Appraiser went pale. That's a ${it.trueName}! Worth ${money(it.trueValue)}!`, 'good');
    else this.note(p, `Appraiser: genuine. Worth ${money(it.trueValue)}.`, 'info');
    this.sync();
  }

  offer(pid, itemId, toId, price) {
    const p = this.P(pid); const it = this.own(p, itemId); const to = this.P(toId);
    price = Math.round(Number(price));
    if (this.phase !== 'MARKET' || !it || !to || to.id === pid || !(price >= 0) || price > 50 * CR) return;
    if (this.d.offers.some((o) => o.uid === itemId && o.status === 'open')) return { error: 'You already offered that item' };
    this.d.offers.push({ id: uid(), from: pid, to: toId, uid: itemId, price, status: 'open' });
    this.note(to, `${p.name} is offering you something. Check your offers.`, 'info');
    this.sync();
  }

  respond(pid, offerId, accept) {
    if (this.phase !== 'MARKET') return;
    const o = this.d.offers.find((x) => x.id === offerId && x.status === 'open');
    if (!o) return;
    if (o.to !== pid && !(o.from === pid && !accept)) return;
    const seller = this.P(o.from); const buyer = this.P(o.to); const it = this.own(seller, o.uid);
    if (!accept || !it) { o.status = 'closed'; if (o.to === pid) this.note(seller, `${buyer.name} said no.`, 'info'); this.sync(); return; }
    if (buyer.cash < o.price) return { error: 'Not enough cash' };
    o.status = 'closed';
    seller.inv = seller.inv.filter((i) => i !== it);
    it.appraised = false;
    buyer.inv.push(it);
    buyer.cash -= o.price; seller.cash += o.price;
    buyer.stats.boughtFromPlayer++;
    this.note(seller, `${buyer.name} paid ${money(o.price)} for your ${it.appraised ? it.trueName : it.name}.`, 'good');
    this.note(buyer, `Deal done. ${it.name} is yours.`, 'good');
    this.feed(`🤝 ${seller.name} and ${buyer.name} made a deal.`);
    this.sync();
  }

  bribe(pid) {
    const p = this.P(pid);
    if (this.phase !== 'MARKET' || !p || this.act < 2) return;
    if (p.cash < BRIBE_COST) return { error: 'Not enough cash' };
    if (p.heat <= 0) return { error: 'Your heat is already zero' };
    p.cash -= BRIBE_COST; p.heat = Math.max(0, p.heat - BRIBE_HEAT);
    this.note(p, `A constable took ${money(BRIBE_COST)} and forgot your face. Heat -${BRIBE_HEAT}.`, 'good');
    this.sync();
  }

  marketDone(pid) {
    if (this.phase !== 'MARKET') return;
    this.d.done[pid] = true;
    if (this.connected().every((p) => this.d.done[p.id])) this.fire(); else this.sync();
  }

  // ------------------------------------------------------------------ heists
  startHeist(idx) {
    const H = this.heists[idx];
    const counts = this.players.map((p) => ({ p, n: p.inv.filter((i) => i.kind === 'clue' && i.heist === idx).length })).filter((x) => x.n > 0 && x.p.connected);
    let planner;
    let reason;
    if (counts.length) {
      const max = Math.max(...counts.map((c) => c.n));
      planner = pick(counts.filter((c) => c.n === max)).p;
      reason = idx === 2 ? `${planner.name} found the map to the Godfather's house.` : `${planner.name} holds ${max} of the 3 pieces.`;
    } else {
      planner = [...this.connected()].sort((a, b) => a.cash - b.cash)[0];
      reason = `Nobody found the plans. An anonymous tip went to the dealer with the least cash: ${planner.name}.`;
    }
    this.players.forEach((p) => { p.inv = p.inv.filter((i) => !(i.kind === 'clue' && i.heist === idx)); });
    const others = this.connected().filter((p) => p.id !== planner.id);
    this.hs = { idx, H, planner: planner.id, reason, crew: null, tips: {}, roles: {} };
    this.setPhase('HEIST_PLAN', { maxCrew: Math.min(3, others.length) }, sec(35), () => {
      this.lockCrew(planner.id, shuffle(others).slice(0, Math.min(2, others.length)).map((p) => p.id), true);
    });
  }

  lockCrew(pid, ids, auto) {
    if (this.phase !== 'HEIST_PLAN' || !this.hs || pid !== this.hs.planner) return;
    ids = [...new Set(ids)].filter((id) => id !== pid && this.P(id)?.connected);
    const max = this.d.maxCrew;
    if (ids.length < 1 || ids.length > max) { if (!auto) return { error: `Pick 1 to ${max} people` }; }
    this.hs.crew = [pid, ...ids.slice(0, max)];
    this.onEnd = null; clearTimeout(this.timer);
    const nonCrew = this.connected().filter((p) => !this.hs.crew.includes(p.id));
    if (!nonCrew.length) return this.heistBrief();
    this.setPhase('HEIST_TIPS', {}, sec(14), () => this.heistBrief());
  }

  tip(pid, yes) {
    if (this.phase !== 'HEIST_TIPS' || this.hs.crew.includes(pid)) return;
    this.hs.tips[pid] = !!yes;
    const nonCrew = this.connected().filter((p) => !this.hs.crew.includes(p.id));
    if (nonCrew.every((p) => p.id in this.hs.tips)) this.fire(); else this.sync();
  }

  heistBrief() {
    const crew = this.hs.crew;
    const roles = crew.length === 1 ? ['safecracker'] : ROLE_ORDER.slice(0, Math.min(4, crew.length));
    const assign = {};
    shuffle(crew).forEach((id, i) => { assign[id] = roles[i] || 'lookout'; });
    this.hs.roles = assign;
    crew.forEach((id) => { this.P(id).stats.crews++; });
    this.hs.tipCount = Object.values(this.hs.tips).filter(Boolean).length;
    this.setPhase('HEIST_BRIEF', {}, sec(14), () => this.heistLive());
  }

  roleOf(pid) { return this.hs?.roles?.[pid]; }
  holder(role) { return Object.keys(this.hs.roles).find((id) => this.hs.roles[id] === role); }

  newCode() { return Array.from({ length: 4 }, () => pick(GLYPHS)).join(''); }

  heistLive() {
    const now = Date.now();
    const has = (r) => Object.values(this.hs.roles).includes(r);
    this.h = {
      alarm: Math.min(60, this.hs.tipCount * TIP_HEAT),
      guard: { state: 'away', until: now + sec(rand(4, 6)) },
      hack: { done: 0, code: this.newCode(), shownUntil: now + sec(3) },
      safe: { targets: [randi(8, 92), randi(8, 92), randi(8, 92)], idx: 0 },
      car: { lights: false, until: now + sec(rand(6, 9)), deadline: 0 },
      hasHacker: has('hacker'), hasDriver: has('driver'),
      signal: null, flash: null, last: now,
    };
    this.setPhase('HEIST_LIVE', {}, sec(100), () => { this.h.alarm = 100; this.h.timeout = true; this.endLive(); });
    this.intervals.push(setInterval(() => this.heistTick(), 100));
    this.intervals.push(setInterval(() => this.sync(), 250));
  }

  penalty(n, reason) { const h = this.h; h.alarm = Math.min(100, h.alarm + n); h.flash = { id: uid(), reason, n }; if (h.alarm >= 100) this.endLive(); }

  heistTick() {
    const h = this.h; if (!h || this.phase !== 'HEIST_LIVE') return;
    const now = Date.now(); const dt = (now - h.last) / 1000 / SPEED; h.last = now;
    if (!h.hasHacker) h.alarm += 0.3 * dt; else if (h.hack.done < 3) h.alarm += 0.5 * dt;
    const g = h.guard;
    if (now >= g.until) {
      if (g.state === 'away') { g.state = 'turning'; g.until = now + sec(1.4); }
      else if (g.state === 'turning') { g.state = 'watching'; g.until = now + sec(rand(2.5, 4.5)); }
      else { g.state = 'away'; g.until = now + sec(rand(4, 7.5)); }
    }
    if (h.hasDriver) {
      const c = h.car;
      if (!c.lights && now >= c.until) { c.lights = true; c.deadline = now + sec(2.6); }
      else if (c.lights && now >= c.deadline) { c.lights = false; c.until = now + sec(rand(7, 12)); this.penalty(10, 'A police jeep spotted the getaway car!'); }
    }
    if (h.alarm >= 100) this.endLive();
  }

  watching() { return this.h.guard.state === 'watching'; }

  hackInput(pid, code) {
    if (this.phase !== 'HEIST_LIVE' || this.roleOf(pid) !== 'hacker' || this.h.hack.done >= 3) return;
    const h = this.h;
    if (this.watching()) { h.hack.code = this.newCode(); h.hack.shownUntil = Date.now() + sec(3); this.penalty(12, 'The guard saw the hacker typing!'); return this.sync(); }
    if (String(code) === h.hack.code) {
      h.hack.done++;
      if (h.hack.done < 3) { h.hack.code = this.newCode(); h.hack.shownUntil = Date.now() + sec(3); }
      h.flash = { id: uid(), reason: h.hack.done === 3 ? 'Cameras looped!' : `Code ${h.hack.done} of 3 accepted`, n: 0, good: true };
    } else {
      h.hack.code = this.newCode(); h.hack.shownUntil = Date.now() + sec(3);
      this.penalty(6, 'Wrong code. The system flinched.');
    }
    this.sync();
  }
  hackPeek(pid) {
    if (this.phase !== 'HEIST_LIVE' || this.roleOf(pid) !== 'hacker') return;
    this.h.hack.shownUntil = Date.now() + sec(2.5);
    this.penalty(3, 'The hacker looked at the code again.');
    this.sync();
  }

  safeSet(pid, val) {
    if (this.phase !== 'HEIST_LIVE' || this.roleOf(pid) !== 'safecracker') return;
    const h = this.h; const s = h.safe;
    val = Math.round(Number(val));
    if (this.watching()) { this.penalty(12, 'The guard heard the safe click!'); return this.sync(); }
    if (Math.abs(val - s.targets[s.idx]) <= 2) {
      s.idx++;
      h.flash = { id: uid(), reason: s.idx === 3 ? 'The safe is open!' : `Number ${s.idx} of 3 cracked`, n: 0, good: true };
      if (s.idx >= 3) return this.endLive();
    } else this.penalty(5, 'Wrong number. The safe rattled.');
    this.sync();
  }

  driverHide(pid) {
    if (this.phase !== 'HEIST_LIVE' || this.roleOf(pid) !== 'driver') return;
    const c = this.h.car;
    if (c.lights) { c.lights = false; c.until = Date.now() + sec(rand(7, 12)); this.h.flash = { id: uid(), reason: 'The driver ducked just in time.', n: 0, good: true }; this.sync(); }
  }

  signal(pid, sig) {
    if (this.phase !== 'HEIST_LIVE' || this.roleOf(pid) !== 'lookout' || !['stop', 'go'].includes(sig)) return;
    this.h.signal = { id: uid(), sig };
    this.sync();
  }

  endLive() {
    if (this.phase !== 'HEIST_LIVE') return;
    this.intervals.forEach(clearInterval); this.intervals = [];
    this.h.alarm = Math.round(Math.min(100, this.h.alarm));
    if (this.h.alarm >= 100) return this.resolveHeist(null);
    const routes = shuffle(C.ROUTES).slice(0, 3);
    const status = shuffle(['clear', 'traffic', 'roadblock']);
    const driver = this.holder('driver') || this.holder('safecracker');
    this.h.escape = { routes: routes.map((r, i) => ({ name: r, status: status[i] })), driver, chosen: null };
    this.setPhase('ESCAPE', {}, sec(16), () => this.chooseRoute(driver, randi(0, 2), true));
  }

  chooseRoute(pid, i, auto) {
    if (this.phase !== 'ESCAPE') return;
    const e = this.h.escape;
    if (!auto && pid !== e.driver) return;
    const r = e.routes[i]; if (!r) return;
    e.chosen = i;
    this.onEnd = null; clearTimeout(this.timer);
    if (r.status === 'traffic') this.h.alarm += 15;
    if (r.status === 'roadblock') this.h.alarm += 45;
    this.h.alarm = Math.min(100, Math.round(this.h.alarm));
    this.resolveHeist(r);
  }

  resolveHeist(route) {
    const { H, crew, planner, idx } = this.hs;
    const h = this.h;
    const outcome = h.alarm >= 100 ? 'busted' : h.alarm >= 40 ? 'messy' : 'clean';
    const loot = outcome === 'busted' ? 0 : nice(rand(H.loot[0], H.loot[1]));
    const tippers = Object.keys(this.hs.tips).filter((id) => this.hs.tips[id]).map((id) => this.P(id));
    const res = { outcome, loot, alarm: h.alarm, route, timeout: !!h.timeout, fines: [] };
    if (outcome === 'busted') {
      crew.forEach((id) => { const p = this.P(id); const f = Math.min(p.cash, FINE); p.cash -= f; p.heat = Math.min(100, p.heat + 35); res.fines.push({ id, fine: f }); this.note(p, `Busted. You paid a ${money(f)} fine. Heat +35.`, 'bad'); });
      tippers.forEach((p) => { p.cash += TIP_PAY; p.stats.tipBust++; this.note(p, `Your tip worked. The police paid you ${money(TIP_PAY)}.`, 'good'); });
      this.players.filter((p) => p.isRat).forEach((p) => { p.cash += RAT_PAY; this.note(p, `Your handler paid you ${money(RAT_PAY)} for the arrests.`, 'good'); });
      this.chron(this.act, `BUSTED: police caught ${crew.map((id) => this.P(id).name).join(', ')} at ${H.name}, ${H.place}.`, 10);
    } else {
      crew.forEach((id) => { const p = this.P(id); const add = outcome === 'messy' ? 20 : 5; p.heat = Math.min(100, p.heat + add); });
      tippers.forEach((p) => { p.heat = Math.min(100, p.heat + TIP_HEAT); this.note(p, `Your tip went nowhere. The police are now curious about YOU. Heat +${TIP_HEAT}.`, 'bad'); });
      this.P(planner).stats.plannedOk++;
      this.chron(this.act, outcome === 'clean' ? `${H.name} in ${H.place} was robbed overnight. Police have no leads.` : `${H.name} in ${H.place} was robbed in a chaotic night of alarms and a speeding getaway.`, 10);
      if (idx === 2) {
        const innocents = this.suspects.filter((s) => s.id !== this.godfather && !this.cleared.includes(s.id));
        const s = pick(innocents);
        if (s) crew.forEach((id) => { const p = this.P(id); p.hints.push(s.id); this.note(p, `Inside the tharavad you found a letter proving ${s.name} is innocent.`, 'info'); });
      }
    }
    this.heistResults.push({ idx, outcome, loot });
    this.hs.result = res;
    this.setPhase('HEIST_RESULT', {}, sec(10), () => (loot > 0 ? this.splitPropose() : this.afterHeist()));
  }

  splitPropose() {
    const crew = this.hs.crew;
    const base = Math.floor(100 / crew.length);
    const shares = {}; crew.forEach((id, i) => { shares[id] = base + (i === 0 ? 100 - base * crew.length : 0); });
    this.hs.split = { pot: this.hs.result.loot, shares, votes: {}, choices: {}, accepted: null };
    if (crew.length === 1) return this.resolveSplit();
    this.setPhase('SPLIT_PROPOSE', {}, sec(30), () => this.splitVoteStart());
  }

  proposeSplit(pid, shares) {
    if (this.phase !== 'SPLIT_PROPOSE' || pid !== this.hs.planner) return;
    const crew = this.hs.crew; const out = {}; let sum = 0;
    for (const id of crew) { const v = Math.round(Number(shares?.[id])); if (!(v >= 0 && v <= 100)) return { error: 'Shares must be 0 to 100' }; out[id] = v; sum += v; }
    if (sum !== 100) return { error: 'Shares must add up to 100%' };
    this.hs.split.shares = out;
    this.fire();
  }

  splitVoteStart() {
    this.hs.split.voters = this.hs.crew.filter((id) => id !== this.hs.planner && this.P(id).connected);
    if (!this.hs.split.voters.length) { this.hs.split.accepted = true; return this.splitChoiceStart(); }
    this.setPhase('SPLIT_VOTE', {}, sec(15), () => this.resolveVote());
  }
  splitVote(pid, yes) {
    if (this.phase !== 'SPLIT_VOTE' || !this.hs.split.voters.includes(pid)) return;
    this.hs.split.votes[pid] = !!yes;
    if (this.hs.split.voters.every((id) => id in this.hs.split.votes)) this.fire(); else this.sync();
  }
  resolveVote() {
    const s = this.hs.split;
    const yes = Object.values(s.votes).filter(Boolean).length;
    const no = Object.values(s.votes).filter((v) => !v).length;
    s.accepted = yes >= no;
    if (!s.accepted) { const crew = this.hs.crew; const base = Math.floor(100 / crew.length); crew.forEach((id, i) => { s.shares[id] = base + (i === 0 ? 100 - base * crew.length : 0); }); }
    this.splitChoiceStart();
  }
  splitChoiceStart() { this.setPhase('SPLIT_CHOICE', {}, sec(12), () => this.resolveSplit()); }
  splitChoice(pid, grab) {
    if (this.phase !== 'SPLIT_CHOICE' || !this.hs.crew.includes(pid)) return;
    this.hs.split.choices[pid] = grab ? 'grab' : 'honour';
    if (this.hs.crew.filter((id) => this.P(id).connected).every((id) => id in this.hs.split.choices)) this.fire(); else this.sync();
  }

  resolveSplit() {
    const s = this.hs.split; const crew = this.hs.crew; const pot = s.pot;
    crew.forEach((id) => { if (!(id in s.choices)) s.choices[id] = 'honour'; });
    const grabbers = crew.filter((id) => s.choices[id] === 'grab');
    const pay = {};
    const share = (id) => (pot * s.shares[id]) / 100;
    if (grabbers.length === 0) crew.forEach((id) => { pay[id] = share(id); });
    else if (grabbers.length === 1 || crew.length === 1) {
      const g = grabbers[0] || crew[0];
      const gAmt = Math.min(pot, Math.max(2 * share(g), pot / crew.length));
      pay[g] = gAmt;
      const others = crew.filter((id) => id !== g);
      const S = others.reduce((t, id) => t + share(id), 0);
      others.forEach((id) => { pay[id] = (pot - gAmt) * (S > 0 ? share(id) / S : 1 / others.length); });
      if (grabbers.length === 1) { this.P(g).stats.soloGrab++; this.chron(this.act, `Sources say one of the ${this.hs.H.short} thieves ran off with most of the loot.`, 6); }
    } else {
      const total = pot * 0.6;
      crew.forEach((id) => { pay[id] = total / crew.length; const p = this.P(id); p.heat = Math.min(100, p.heat + 10); });
      s.fight = true;
      this.chron(this.act, `Neighbours heard the ${this.hs.H.short} gang fighting over the loot. Some of it was lost in the chaos.`, 7);
    }
    crew.forEach((id) => { const p = this.P(id); const v = Math.round(pay[id] || 0); p.cash += v; pay[id] = v; this.note(p, `You walked away with ${money(v)}.`, v > 0 ? 'good' : 'bad'); });
    s.pay = pay;
    this.setPhase('SPLIT_RESULT', {}, sec(14), () => this.afterHeist());
  }

  afterHeist() {
    const idx = this.hs.idx;
    if (idx === 0) return this.showPaper(1, null, () => this.beginAct(2));
    if (idx === 1) { const raids = this.doRaids(); return this.showPaper(2, raids, () => this.beginAct(3)); }
    return this.finalRaids();
  }

  doRaids() {
    const out = [];
    for (const p of this.players) {
      const chance = Math.min(0.9, p.heat / 100);
      if (p.heat >= 15 && Math.random() < chance) {
        const lose = Math.round(p.cash * 0.3);
        const hot = p.inv.filter((i) => i.hot);
        p.cash -= lose; p.inv = p.inv.filter((i) => !i.hot); p.heat = 10; p.stats.raided++;
        this.note(p, `RAIDED! Police took ${money(lose)}${hot.length ? ` and ${hot.length} hot item${hot.length > 1 ? 's' : ''}` : ''}.`, 'bad');
        this.players.filter((r) => r.isRat && r.id !== p.id).forEach((r) => { r.cash += RAT_PAY; this.note(r, `Your handler paid you ${money(RAT_PAY)} for the raid on ${p.name}.`, 'good'); });
        out.push({ ...this.pub(p), lost: lose, hot: hot.length });
      }
    }
    if (!out.length) out.push(null);
    return out.filter(Boolean);
  }

  showPaper(n, raids, next) {
    const hr = this.heistResults[this.heistResults.length - 1];
    const H = this.heists[n - 1];
    let headline;
    if (!hr || hr.outcome === 'busted') headline = `GANG CAUGHT AT ${H.short.toUpperCase()}`;
    else if (hr.outcome === 'clean') headline = `DARING ROBBERY IN ${H.place.toUpperCase()}. POLICE BAFFLED.`;
    else headline = `CHAOS IN ${H.place.toUpperCase()}: ALARMS, SIRENS AND A FLEEING CAR`;
    const stories = this.chronicle.filter((c) => c.act === n).sort((a, b) => b.weight - a.weight).slice(0, 3).map((c) => c.text);
    let alibi = null;
    if (n === 2) {
      const s = pick(this.suspects.filter((x) => x.id !== this.godfather && !this.cleared.includes(x.id)));
      if (s) { this.cleared.push(s.id); alibi = { name: s.name, text: s.alibi }; }
    }
    const day = n === 1 ? 'Tuesday' : 'Friday';
    this.setPhase('PAPER', { paper: { n, day, headline, stories, raids, alibi, kicker: n === 1 ? 'Fifteen years later, the Kerala State Bank loot is turning up in Mattancherry godowns.' : 'Police raid godowns across Mattancherry. Who is the Godfather?' } }, sec(raids ? 28 : 22), next);
  }

  // ------------------------------------------------------------------ finale
  finalRaids() {
    const raids = this.doRaids();
    this.setPhase('RAIDS', { raids }, sec(raids.length ? 12 : 7), () => this.ratVote());
  }

  ratVote() { this.votes = {}; this.setPhase('RAT_VOTE', {}, sec(40), () => this.guessStart()); }
  castRatVote(pid, target) {
    if (this.phase !== 'RAT_VOTE' || !this.P(pid)) return;
    if (target !== 'none' && (!this.P(target) || target === pid)) return;
    this.votes[pid] = target;
    if (this.connected().every((p) => p.id in this.votes)) this.fire(); else this.sync();
  }

  guessStart() { this.guesses = {}; this.setPhase('GUESS', {}, sec(40), () => this.revealRat()); }
  guess(pid, sid) {
    if (this.phase !== 'GUESS' || !this.suspects.some((s) => s.id === sid)) return;
    this.guesses[pid] = sid;
    if (this.connected().every((p) => p.id in this.guesses)) this.fire(); else this.sync();
  }

  revealRat() {
    const n = this.players.length;
    const rats = this.players.filter((p) => p.isRat);
    const rows = [];
    const ratResults = rats.map((r) => {
      const votesFor = Object.entries(this.votes).filter(([v, t]) => v !== r.id && t === r.id).length;
      const caught = votesFor > 0 && votesFor >= Math.ceil((n - 1) / 2);
      if (caught) { const lose = Math.round(r.cash * 0.5); r.cash -= lose; this.note(r, `You were caught. The others took ${money(lose)} from you.`, 'bad'); return { ...this.pub(r), caught, delta: -lose, votesFor }; }
      r.cash += 10 * L; this.note(r, `Nobody caught you. Bonus ${money(10 * L)}.`, 'good');
      return { ...this.pub(r), caught, delta: 10 * L, votesFor };
    });
    for (const p of this.players) {
      const v = this.votes[p.id];
      if (!v) continue;
      let right;
      if (v === 'none') right = rats.length === 0; else right = !!this.P(v)?.isRat;
      const d = right ? 3 * L : -Math.min(Math.max(0, p.cash), 2 * L);
      p.cash += d;
      rows.push({ ...this.pub(p), vote: v === 'none' ? 'No Rat' : this.P(v)?.name, right, delta: d });
    }
    this.setPhase('REVEAL_RAT', { rats: ratResults, rows, none: rats.length === 0 }, sec(18), () => this.revealGodfather());
  }

  revealGodfather() {
    const s = this.suspects.find((x) => x.id === this.godfather);
    const right = [];
    for (const p of this.players) if (this.guesses[p.id] === s.id) { p.cash += GUESS_PAY; right.push(this.pub(p)); }
    const lines = [
      `My name is ${s.name}. ${s.title}.`,
      'Fifteen years ago, I paid five desperate people to empty the Kerala State Bank on the darkest night of the monsoon.',
      `You found my things in those godowns. ${s.evidence[0]}. ${s.evidence[1]}.`,
      'I should have burned everything. Instead I let the rent run out. Pride is an expensive habit.',
      'Enjoy the money. Kochi will forget this by Onam.',
    ];
    this.setPhase('REVEAL_GODFATHER', { suspect: { id: s.id, name: s.name, title: s.title, emoji: s.emoji }, lines, right }, sec(26), () => this.revealMissions());
  }

  missionDone(p) {
    const m = p.mission; const t = this.P(p.missionTarget);
    switch (m.id) {
      case 'win3': return p.stats.godownsWon >= 3;
      case 'crew2': return p.stats.crews >= 2;
      case 'solograb': return p.stats.soloGrab >= 1;
      case 'raidtarget': return !!t && t.stats.raided >= 1;
      case 'lowheat': return p.heat < 30;
      case 'chacko2': return p.stats.chacko >= 2;
      case 'lastgodown': return p.stats.wonLast;
      case 'set': return Object.keys(SETS_PARTS).some((k) => this.setParts(p, k));
      case 'bigitem': return p.inv.some((i) => i.kind === 'item' && !i.hot && i.trueValue >= 10 * L);
      case 'planner': return p.stats.plannedOk >= 1;
      case 'spender': return p.stats.spent > 20 * L;
      case 'tipper': return p.stats.tipBust >= 1;
      case 'buyer': return p.stats.boughtFromPlayer >= 1;
      case 'richer': return !!t && p.cash > t.cash;
      default: return false;
    }
  }
  missionText(p) { return p.mission ? p.mission.text.replace('{target}', this.P(p.missionTarget)?.name || 'someone') : ''; }

  revealMissions() {
    const rows = this.players.map((p) => {
      const ok = this.missionDone(p);
      return { ...this.pub(p), text: this.missionText(p), ok };
    });
    rows.forEach((r) => { if (r.ok) this.P(r.id).cash += MISSION_PAY; });
    this.setPhase('REVEAL_MISSIONS', { rows }, sec(18), () => this.finalScores());
  }

  finalScores() {
    const rows = this.players.map((p) => {
      let items = 0; let seized = 0;
      const setBonusParts = new Set();
      for (const k of Object.keys(SETS_PARTS)) { const parts = this.setParts(p, k); if (parts) parts.forEach((i) => setBonusParts.add(i)); }
      for (const i of p.inv) {
        if (i.kind !== 'item') continue;
        if (i.hot) { seized += i.trueValue; continue; }
        items += i.trueValue * (setBonusParts.has(i) ? 1.5 : 1);
      }
      items = Math.round(items);
      const best = p.inv.filter((i) => i.kind === 'item' && !i.hot).sort((a, b) => b.trueValue - a.trueValue)[0];
      const f = { ...this.pub(p), cash: p.cash, items, seized, total: p.cash + items, isRat: p.isRat, best: best ? `${best.trueName} (${money(best.trueValue)})` : null };
      p.final = f;
      return f;
    }).sort((a, b) => b.total - a.total);
    rows.forEach((r, i) => { r.rank = i + 1; });
    this.setPhase('FINAL', { rows });
  }

  playAgain(byId) {
    if (this.phase !== 'FINAL' || this.vip()?.id !== byId) return;
    this.players = this.players.filter((p) => p.connected);
    this.players.forEach((p) => this.resetPlayer(p));
    this.act = 0; this.godownNo = 0;
    this.setPhase('LOBBY', {});
  }

  // ------------------------------------------------------------------ views
  itemView(it, owner) {
    const show = it.appraised;
    const v = { uid: it.uid, kind: it.kind, name: show ? it.trueName : it.name, cat: it.cat, catLabel: C.CATEGORIES[it.cat] || '', note: it.note || '', text: it.text || '', hot: !!it.hot, appraised: !!it.appraised, set: it.set || null };
    if (it.kind === 'item') {
      v.est = show ? it.trueValue : it.apparent;
      v.fake = show && it.fake;
      v.gem = show && it.gem;
      if (owner && this.phase === 'MARKET' && !it.hot) { const { price, m } = this.priceFor(owner, it); v.dealer = price; v.bonus = m > 1; }
      if (owner && it.hot) v.chacko = nice(it.trueValue * (this.event?.id === 'goldspike' ? 2 : 1));
    }
    if (it.kind === 'evidence') v.suspect = it.suspect;
    if (it.kind === 'clue') v.heist = it.heist;
    return v;
  }
  publicItem(it) { return { name: it.name, est: it.apparent || 0, cat: it.cat, catLabel: C.CATEGORIES[it.cat] || (it.kind === 'clue' ? 'Heist plans' : it.kind === 'evidence' ? 'Evidence' : ''), kind: it.kind, hot: !!it.hot }; }
  godownPub(g) { return g ? { no: g.no, facility: g.facility, lease: g.lease, isLast: g.isLast, count: g.items.length, act: g.act } : null; }
  heistPub() {
    const hs = this.hs; if (!hs) return null;
    return {
      name: hs.H.name, place: hs.H.place, pitch: hs.H.pitch, loot: hs.H.loot, idx: hs.idx, reason: hs.reason,
      planner: this.pub(this.P(hs.planner)),
      crew: (hs.crew || []).map((id) => ({ ...this.pub(this.P(id)), role: hs.roles[id] || null })),
      tipCount: hs.tipCount || 0,
    };
  }

  stateFor(pid) {
    const me = pid ? this.P(pid) : null;
    const vip = this.vip();
    const s = {
      now: Date.now(), code: this.code, phase: this.phase, endsAt: this.endsAt, act: this.act, godownNo: this.godownNo,
      players: this.players.map((p) => ({ ...this.pub(p), connected: p.connected })), vipId: vip?.id || null,
      speed: SPEED,
    };
    if (!pid) { s.joinUrl = this.joinUrl; s.qr = this.qr; }
    if (me) {
      s.me = { id: me.id, name: me.name, color: me.color, emoji: me.emoji, cash: me.cash, heat: me.heat, showHeat: this.act >= 2, isRat: me.isRat, vip: vip?.id === me.id, mission: this.missionText(me), notes: me.notes, request: me.request ? { ...me.request, label: C.CATEGORIES[me.request.cat] } : null };
      if (me.isRat) s.me.ratPartners = this.players.filter((p) => p.isRat && p.id !== me.id).map((p) => p.name);
      s.inv = me.inv.map((i) => this.itemView(i, me));
      s.sets = Object.keys(SETS_PARTS).filter((k) => this.setParts(me, k)).map((k) => ({ key: k, name: C.SETS[k] }));
      s.hints = me.hints;
    }
    if (this.suspects && this.phase !== 'LOBBY') s.suspects = this.suspects.map((x) => ({ id: x.id, name: x.name, title: x.title, emoji: x.emoji, cleared: this.cleared.includes(x.id) }));
    const d = this.d; const ph = this.phase;
    const x = {};
    if (ph === 'NARRATION') Object.assign(x, d);
    if (['VIEWING', 'AUCTION', 'OPENING', 'UNSOLD'].includes(ph)) {
      x.godown = this.godownPub(d.g);
      x.event = this.event;
      if (me && d.peeks?.[me.id]) { const it = d.g.items.find((i) => i.uid === d.peeks[me.id]); x.peek = it ? it.peek : null; }
    }
    if (ph === 'AUCTION') {
      const a = d.a;
      x.auction = { high: a.high, bidder: this.pub(this.P(a.bidder)), bids: a.bids, rumours: a.rumours.slice(-3) };
      if (me) { x.incs = BID_INCS.map((inc) => ({ inc, total: a.high + inc, ok: a.high + inc <= me.cash && a.bidder !== me.id })); x.isHigh = a.bidder === me.id; x.canRumour = this.act >= 2 && !a.used[me.id]; x.rumourList = this.act >= 2 ? C.RUMOURS : []; }
    }
    if (ph === 'OPENING') {
      x.winner = this.pub(this.P(d.winner)); x.price = d.price;
      x.revealed = d.revealed.map((id) => this.publicItem(d.g.items.find((i) => i.uid === id)));
      if (me && me.id === d.winner) x.found = d.g.items.map((i) => ({ ...this.itemView(i, null), shown: d.revealed.includes(i.uid) }));
    }
    if (ph === 'MARKET') {
      x.feed = d.feed; x.event = d.ev; x.dealersOpen = this.dealersOpen(); x.doneCount = Object.keys(d.done).length;
      if (me) {
        x.done = !!d.done[me.id];
        x.incoming = d.offers.filter((o) => o.to === me.id && o.status === 'open').map((o) => { const it = this.P(o.from).inv.find((i) => i.uid === o.uid); return it ? { id: o.id, from: this.pub(this.P(o.from)), price: o.price, item: { name: it.name, est: it.apparent, catLabel: C.CATEGORIES[it.cat] || it.kind, kind: it.kind, hot: it.hot, note: it.note || it.text } } : null; }).filter(Boolean);
        x.outgoing = d.offers.filter((o) => o.from === me.id && o.status === 'open').map((o) => ({ id: o.id, to: this.pub(this.P(o.to)), price: o.price, uid: o.uid }));
        x.canBribe = this.act >= 2; x.bribeCost = BRIBE_COST; x.appraiseCost = APPRAISE_COST;
      }
    }
    const hs = this.hs;
    if (ph.startsWith('HEIST') || ph === 'ESCAPE' || ph.startsWith('SPLIT')) {
      x.heist = this.heistPub();
      if (me) { x.role = hs.roles?.[me.id] || null; x.inCrew = !!hs.crew?.includes(me.id); x.isPlanner = hs.planner === me.id; if (x.role) x.roleInfo = ROLE_INFO[x.role]; }
    }
    if (ph === 'HEIST_PLAN' && me && hs.planner === me.id) x.candidates = this.connected().filter((p) => p.id !== me.id).map((p) => this.pub(p)), x.maxCrew = d.maxCrew;
    if (ph === 'HEIST_TIPS') { x.tipsIn = Object.keys(hs.tips).length; if (me) x.tipped = me.id in hs.tips ? hs.tips[me.id] : null; }
    if (ph === 'HEIST_LIVE' && this.h) {
      const h = this.h;
      x.live = { alarm: Math.round(h.alarm), hack: h.hasHacker ? h.hack.done : null, safe: h.safe.idx, flash: h.flash, signal: h.signal, hasDriver: h.hasDriver, hasHacker: h.hasHacker };
      const r = me ? hs.roles[me.id] : null;
      if (r === 'lookout') x.live.guard = { state: h.guard.state, until: h.guard.until };
      if (r === 'hacker') { x.live.code = Date.now() < h.hack.shownUntil ? h.hack.code : null; x.live.shownUntil = h.hack.shownUntil; x.live.glyphs = GLYPHS; }
      if (r === 'safecracker') x.live.target = h.safe.targets[h.safe.idx];
      if (r === 'driver') x.live.car = { lights: h.car.lights, deadline: h.car.deadline };
    }
    if (ph === 'ESCAPE' && this.h?.escape) {
      const e = this.h.escape;
      x.escape = { routes: e.routes.map((r) => r.name), driver: this.pub(this.P(e.driver)), alarm: Math.round(this.h.alarm) };
      if (me && hs.crew.includes(me.id) && me.id !== e.driver) x.escape.scanner = e.routes.map((r) => ({ name: r.name, status: r.status }));
      if (me) x.isDriver = me.id === e.driver;
    }
    if (ph === 'HEIST_RESULT') { const r = hs.result; x.result = { outcome: r.outcome, loot: r.loot, alarm: r.alarm, route: r.route, timeout: r.timeout, fines: r.fines.map((f) => ({ ...this.pub(this.P(f.id)), fine: f.fine })) }; }
    if (ph.startsWith('SPLIT') && hs.split) {
      const sp = hs.split;
      x.split = { pot: sp.pot, shares: hs.crew.map((id) => ({ ...this.pub(this.P(id)), pct: sp.shares[id] })), accepted: sp.accepted };
      if (ph === 'SPLIT_VOTE') { x.split.votesIn = Object.keys(sp.votes).length; x.split.voters = sp.voters.length; if (me) { x.canVote = sp.voters.includes(me.id); x.voted = me.id in sp.votes; } }
      if (ph === 'SPLIT_CHOICE') { x.split.choicesIn = Object.keys(sp.choices).length; if (me) x.choice = sp.choices[me.id] || null; }
      if (ph === 'SPLIT_RESULT') { x.split.rows = hs.crew.map((id) => ({ ...this.pub(this.P(id)), choice: sp.choices[id], pay: sp.pay[id], pct: sp.shares[id] })); x.split.fight = !!sp.fight; }
    }
    if (ph === 'PAPER') x.paper = d.paper;
    if (ph === 'RAIDS') x.raids = d.raids;
    if (ph === 'RAT_VOTE') { x.votesIn = Object.keys(this.votes).length; if (me) { x.myVote = this.votes[me.id] || null; x.options = this.players.filter((p) => p.id !== me.id).map((p) => this.pub(p)); } }
    if (ph === 'GUESS') { x.votesIn = Object.keys(this.guesses).length; if (me) { x.myGuess = this.guesses[me.id] || null; x.myEvidence = me.inv.filter((i) => i.kind === 'evidence').map((i) => i.suspect); } }
    if (ph === 'REVEAL_RAT' || ph === 'REVEAL_GODFATHER' || ph === 'REVEAL_MISSIONS') Object.assign(x, d);
    if (ph === 'FINAL') { x.rows = d.rows; }
    s.x = x;
    return s;
  }
}

module.exports = { Game, money };
