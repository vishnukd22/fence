'use strict';
const path = require('path');
const http = require('http');
const express = require('express');
const { Server } = require('socket.io');
const QRCode = require('qrcode');
const { Game } = require('./game');

const PORT = process.env.PORT || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');

const app = express();
const server = http.createServer(app);
const io = new Server(server, { pingInterval: 10000, pingTimeout: 25000 });

app.get('/health', (_req, res) => res.send('ok'));
app.get('/tv', (_req, res) => res.sendFile(path.join(PUBLIC, 'host.html')));
app.get('/', (_req, res) => res.sendFile(path.join(PUBLIC, 'play.html')));
const NM = path.join(__dirname, '..', 'node_modules');
app.use('/fonts/archivo', express.static(path.join(NM, '@fontsource-variable', 'archivo'), { maxAge: '30d' }));
app.use('/fonts/bungee', express.static(path.join(NM, '@fontsource', 'bungee'), { maxAge: '30d' }));
app.use('/fonts/elite', express.static(path.join(NM, '@fontsource', 'special-elite'), { maxAge: '30d' }));
app.use('/fonts/fraktur', express.static(path.join(NM, '@fontsource', 'unifrakturmaguntia'), { maxAge: '30d' }));
app.use(express.static(PUBLIC));

const rooms = new Map();
const LETTERS = 'ABCDEFGHJKLMNPQRSTUVWXYZ';
function newCode() {
  let c;
  do { c = Array.from({ length: 4 }, () => LETTERS[Math.floor(Math.random() * LETTERS.length)]).join(''); } while (rooms.has(c));
  return c;
}

function originOf(socket) {
  if (process.env.PUBLIC_URL) return process.env.PUBLIC_URL.replace(/\/$/, '');
  const h = socket.handshake.headers;
  const proto = (h['x-forwarded-proto'] || '').split(',')[0] || (socket.handshake.secure ? 'https' : 'http');
  return `${proto}://${h['x-forwarded-host'] || h.host}`;
}

async function createRoom(socket) {
  const code = newCode();
  const game = new Game(code, {
    toHost: (s) => io.to(`host:${code}`).emit('state', s),
    toPlayer: (pid, s) => io.to(`p:${pid}`).emit('state', s),
    kicked: (pid) => io.to(`p:${pid}`).emit('kicked'),
  });
  const origin = originOf(socket);
  game.joinUrl = `${origin}/?room=${code}`;
  game.displayUrl = origin.replace(/^https?:\/\//, '');
  game.qr = await QRCode.toDataURL(game.joinUrl, { margin: 1, width: 360, color: { dark: '#10181a', light: '#f3ead7' } });
  rooms.set(code, game);
  return game;
}

const ACTIONS = {
  start: (g, pid) => g.start(pid),
  skip: (g, pid) => g.skip(pid),
  kick: (g, pid, a) => g.kick(pid, a.target),
  bid: (g, pid, a) => g.bid(pid, Number(a.inc)),
  rumour: (g, pid, a) => g.rumour(pid, Number(a.idx)),
  reveal: (g, pid, a) => g.openingReveal(pid, a.uid),
  openDone: (g, pid) => g.openingDone(pid),
  sell: (g, pid, a) => g.sell(pid, a.uid),
  sellSet: (g, pid, a) => g.sellSet(pid, a.key),
  sellJunk: (g, pid) => g.sellJunk(pid),
  chacko: (g, pid, a) => g.chacko(pid, a.uid),
  appraise: (g, pid, a) => g.appraise(pid, a.uid),
  offer: (g, pid, a) => g.offer(pid, a.uid, a.to, a.price),
  respond: (g, pid, a) => g.respond(pid, a.id, !!a.accept),
  bribe: (g, pid) => g.bribe(pid),
  done: (g, pid) => g.marketDone(pid),
  crew: (g, pid, a) => g.lockCrew(pid, Array.isArray(a.ids) ? a.ids : []),
  tip: (g, pid, a) => g.tip(pid, !!a.yes),
  hack: (g, pid, a) => g.hackInput(pid, a.code),
  hackPeek: (g, pid) => g.hackPeek(pid),
  safe: (g, pid, a) => g.safeSet(pid, a.val),
  hide: (g, pid) => g.driverHide(pid),
  signal: (g, pid, a) => g.signal(pid, a.sig),
  route: (g, pid, a) => g.chooseRoute(pid, Number(a.i)),
  propose: (g, pid, a) => g.proposeSplit(pid, a.shares),
  vote: (g, pid, a) => g.splitVote(pid, !!a.yes),
  choice: (g, pid, a) => g.splitChoice(pid, !!a.grab),
  ratVote: (g, pid, a) => g.castRatVote(pid, a.target),
  guess: (g, pid, a) => g.guess(pid, a.sid),
  again: (g, pid) => g.playAgain(pid),
};

io.on('connection', (socket) => {
  const ack = (fn, v) => { if (typeof fn === 'function') fn(v); };

  socket.on('host:create', async (_a, fn) => {
    const g = await createRoom(socket);
    socket.join(`host:${g.code}`);
    socket.data = { code: g.code, host: true };
    ack(fn, { code: g.code });
    g.sync();
  });

  socket.on('host:attach', (a, fn) => {
    const g = rooms.get(String(a?.code || '').toUpperCase());
    if (!g) return ack(fn, { error: 'Room not found' });
    socket.join(`host:${g.code}`);
    socket.data = { code: g.code, host: true };
    ack(fn, { code: g.code });
    g.sync();
  });

  socket.on('host:act', (a, fn) => {
    const g = rooms.get(socket.data?.code);
    if (!g || !socket.data.host) return;
    if (a?.type === 'skip') g.skip(null);
    if (a?.type === 'start') ack(fn, g.start(null) || {});
  });

  socket.on('player:join', (a, fn) => {
    const g = rooms.get(String(a?.code || '').trim().toUpperCase());
    if (!g) return ack(fn, { error: 'No game with that code. Check the TV.' });
    const r = g.join(a.name, a.token);
    if (r.error) return ack(fn, { error: r.error });
    const p = r.player;
    socket.join(`p:${p.id}`);
    socket.data = { code: g.code, pid: p.id };
    g.setConnected(p.id, true);
    ack(fn, { ok: true, token: p.token, pid: p.id, code: g.code });
  });

  socket.on('act', (a, fn) => {
    const g = rooms.get(socket.data?.code);
    const pid = socket.data?.pid;
    if (!g || !pid || !a || !ACTIONS[a.type]) return ack(fn, { error: 'Not in a game' });
    g.lastActive = Date.now();
    try { ack(fn, ACTIONS[a.type](g, pid, a) || {}); } catch (e) { console.error(e); ack(fn, { error: 'Something went wrong' }); }
  });

  socket.on('disconnect', async () => {
    const { code, pid } = socket.data || {};
    const g = rooms.get(code);
    if (!g || !pid) return;
    const still = await io.in(`p:${pid}`).fetchSockets();
    if (!still.length) g.setConnected(pid, false);
  });
});

setInterval(() => {
  for (const [code, g] of rooms) {
    if (Date.now() - g.lastActive > 6 * 3600 * 1000) { g.destroy(); rooms.delete(code); }
  }
}, 10 * 60 * 1000);

server.listen(PORT, () => console.log(`FENCE running on http://localhost:${PORT}  (TV: /tv)`));
