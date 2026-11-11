// Simulated full game: a host plus N bot players who act randomly.
const { io } = require('socket.io-client');
const URL = process.env.URL || 'http://localhost:3100';
const N = Number(process.env.N || 5);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const pick = (a) => a[Math.floor(Math.random() * a.length)];

const phases = [];
let errors = 0;
let finalRows = null;

(async () => {
  const host = io(URL);
  const code = await new Promise((res) => host.emit('host:create', {}, (r) => res(r.code)));
  host.on('state', (s) => {
    if (phases[phases.length - 1] !== s.phase) phases.push(s.phase);
    if (s.phase === 'FINAL') finalRows = s.x.rows;
  });
  const bots = [];
  for (let i = 0; i < N; i++) {
    const sock = io(URL);
    const name = ['Arun', 'Bindu', 'Chris', 'Divya', 'Eldho', 'Fathima', 'Gopu', 'Hari'][i];
    const r = await new Promise((res) => sock.emit('player:join', { code, name }, res));
    if (!r.ok) throw new Error(r.error);
    const bot = { sock, name, s: null, busy: false, token: r.token };
    const act = (type, a = {}) => new Promise((res) => sock.emit('act', { type, ...a }, (out) => { if (out && out.error && !/cash|already|shut|Hartal|zero|touch/i.test(out.error)) { errors++; console.log('ERR', name, type, out.error); } res(out); }));
    bot.act = act;
    sock.on('state', (s) => {
      bot.s = s;
      if (s.me && s.me.cash < 0) { errors++; console.log('NEGATIVE CASH', name, s.me.cash); }
      think(bot).catch((e) => { errors++; console.error(e); });
    });
    bots.push(bot);
  }
  if (process.env.TOKENS_OUT) {
    require('fs').writeFileSync(process.env.TOKENS_OUT, JSON.stringify({ code, players: bots.map((b) => ({ name: b.name, token: b.token })) }));
  }
  await sleep(Number(process.env.WAIT_START || 200));
  await bots[0].act('start');
  const t0 = Date.now();
  while (!finalRows && Date.now() - t0 < Number(process.env.MAXMS || 240000)) await sleep(200);
  console.log('PHASES:', phases.join(' > '));
  console.log('FINAL:', finalRows && finalRows.map((r) => `${r.rank}. ${r.name} total=${r.total} cash=${r.cash} items=${r.items} seized=${r.seized}${r.isRat ? ' (RAT)' : ''}`).join('\n  '));
  console.log('errors:', errors);
  process.exit(finalRows && errors === 0 ? 0 : 1);
})();

const seen = new WeakMap();
async function think(bot) {
  if (process.env.BOT_DELAY) await sleep(Number(process.env.BOT_DELAY) * (0.5 + Math.random()));
  const s = bot.s; const x = s.x; const key = `${s.phase}:${s.endsAt}`;
  const done = seen.get(bot) || new Set(); seen.set(bot, done);
  const once = (k) => { if (done.has(key + k)) return false; done.add(key + k); return true; };
  switch (s.phase) {
    case 'AUCTION':
      if (!x.isHigh && Math.random() < 0.35) { const ok = x.incs.filter((i) => i.ok && i.inc <= 100000); if (ok.length && x.auction.high < 1500000) { await sleep(20 + Math.random() * 60); await bot.act('bid', { inc: pick(ok).inc }); } }
      if (x.canRumour && Math.random() < 0.2 && once('rum')) await bot.act('rumour', { idx: 1 });
      break;
    case 'OPENING':
      if (x.found && once('open')) { await bot.act('reveal', { uid: x.found[0].uid }); await bot.act('openDone'); }
      break;
    case 'MARKET':
      if (!once('mkt')) break;
      for (const it of s.inv) {
        if (it.kind !== 'item') continue;
        const r = Math.random();
        if (it.hot) { if (r < 0.6) await bot.act('chacko', { uid: it.uid }); }
        else if (r < 0.25 && !it.appraised) await bot.act('appraise', { uid: it.uid });
        else if (r < 0.75) await bot.act('sell', { uid: it.uid });
      }
      for (const st of s.sets || []) await bot.act('sellSet', { key: st.key });
      if (Math.random() < 0.3) { const it = s.inv.find((i) => i.kind !== 'item'); const to = s.players.find((p) => p.id !== s.me.id); if (it && to) await bot.act('offer', { uid: it.uid, to: to.id, price: 50000 }); }
      if (x.incoming?.length) for (const o of x.incoming) await bot.act('respond', { id: o.id, accept: Math.random() < 0.6 });
      if (x.canBribe && s.me.heat > 40) await bot.act('bribe');
      await sleep(30);
      await bot.act('done');
      break;
    case 'HEIST_PLAN':
      if (x.candidates && once('crew')) await bot.act('crew', { ids: x.candidates.slice(0, Math.min(x.maxCrew, 3)).map((c) => c.id) });
      break;
    case 'HEIST_TIPS':
      if (!x.inCrew && once('tip')) await bot.act('tip', { yes: Math.random() < 0.3 });
      break;
    case 'HEIST_LIVE': {
      const l = x.live;
      if (x.role === 'hacker' && l.code && once('h' + l.hack + l.code)) { await sleep(30); await bot.act('hack', { code: l.code }); }
      if (x.role === 'safecracker' && once('s' + l.safe)) { await sleep(60); await bot.act('safe', { val: l.target }); }
      if (x.role === 'driver' && l.car?.lights && once('d' + l.car.deadline)) await bot.act('hide');
      if (x.role === 'lookout' && once('sig')) await bot.act('signal', { sig: 'go' });
      break;
    }
    case 'ESCAPE':
      if (x.isDriver && once('route')) { await sleep(30); await bot.act('route', { i: Math.floor(Math.random() * 3) }); }
      break;
    case 'SPLIT_PROPOSE':
      if (x.isPlanner && once('prop')) { const sh = {}; x.split.shares.forEach((p, i) => { sh[p.id] = i === 0 ? 100 - 20 * (x.split.shares.length - 1) : 20; }); await bot.act('propose', { shares: sh }); }
      break;
    case 'SPLIT_VOTE':
      if (x.canVote && !x.voted && once('v')) await bot.act('vote', { yes: Math.random() < 0.6 });
      break;
    case 'SPLIT_CHOICE':
      if (x.inCrew && !x.choice && once('c')) await bot.act('choice', { grab: Math.random() < 0.3 });
      break;
    case 'RAT_VOTE':
      if (!x.myVote && once('rv')) await bot.act('ratVote', { target: Math.random() < 0.2 ? 'none' : pick(x.options).id });
      break;
    case 'GUESS':
      if (!x.myGuess && once('g')) await bot.act('guess', { sid: pick(s.suspects).id });
      break;
    case 'NARRATION': case 'PAPER':
      break;
    default:
  }
}
