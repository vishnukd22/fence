/* FENCE: the TV screen */
(() => {
  const $ = (q) => document.querySelector(q);
  const esc = F.esc; const inr = F.inr;
  const socket = io({ autoConnect: false });
  const stage = $('#stage'); const top = $('#top'); const dock = $('#dock');
  let S = null; let P = null; let code = null;
  let voiceOn = true;
  const totals = {};

  // ---------------------------------------------------------------- voice
  let voice = null;
  const hasTTS = 'speechSynthesis' in window;
  function pickVoice() {
    if (!hasTTS) return;
    const vs = speechSynthesis.getVoices();
    voice = vs.find((v) => /en[-_]IN/i.test(v.lang)) || vs.find((v) => /en[-_]GB/i.test(v.lang)) || vs.find((v) => /^en/i.test(v.lang)) || null;
  }
  if (hasTTS) { pickVoice(); speechSynthesis.onvoiceschanged = pickVoice; }
  function say(text, onstart, onend) {
    if (!voiceOn || !hasTTS) { if (onstart) onstart(); if (onend) setTimeout(onend, 600 + text.length * 55); return; }
    const u = new SpeechSynthesisUtterance(text);
    if (voice) u.voice = voice;
    u.rate = 1.0; u.pitch = 0.92;
    let started = false;
    u.onstart = () => { started = true; if (onstart) onstart(); };
    u.onend = () => { if (onend) onend(); };
    u.onerror = () => { if (!started && onstart) onstart(); if (onend) onend(); };
    speechSynthesis.speak(u);
  }
  function hush() { if (hasTTS) speechSynthesis.cancel(); }

  // ---------------------------------------------------------------- boot
  $('#bOpen').onclick = () => {
    F.ac(); F.sfx.shutter();
    if (hasTTS) { const u = new SpeechSynthesisUtterance(' '); u.volume = 0; speechSynthesis.speak(u); }
    $('#gate').classList.add('hide');
    try { document.documentElement.requestFullscreen?.(); } catch (e) { /* fine */ }
    socket.connect();
  };
  socket.on('connect', () => {
    const saved = sessionStorage.getItem('fenceHost');
    const create = () => socket.emit('host:create', {}, (r) => { code = r.code; sessionStorage.setItem('fenceHost', code); });
    if (saved) socket.emit('host:attach', { code: saved }, (r) => { if (r.error) create(); else code = r.code; });
    else create();
  });
  socket.on("state", (s) => { F.syncClock(s.now); P = S; S = s; window.__S = s; render(); effects(); });

  $('#bVoice').onclick = (e) => { voiceOn = !voiceOn; e.target.textContent = voiceOn ? 'Voice on' : 'Voice off'; if (!voiceOn) hush(); };
  $('#bSound').onclick = (e) => { F.setMuted(!F.isMuted()); e.target.textContent = F.isMuted() ? 'Sound off' : 'Sound on'; };
  $('#bSkip').onclick = () => socket.emit('host:act', { type: 'skip' });
  $('#bFull').onclick = () => { if (document.fullscreenElement) document.exitFullscreen(); else document.documentElement.requestFullscreen?.(); };
  document.addEventListener('keydown', (e) => { if (e.code === 'Space' && S && S.phase !== 'LOBBY') { e.preventDefault(); socket.emit('host:act', { type: 'skip' }); } });
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'); if (!b) return;
    if (b.dataset.act === 'start') socket.emit('host:act', { type: 'start' }, (r) => { if (r?.error) alert(r.error); });
  });

  // ---------------------------------------------------------------- helpers
  const T = (s) => { if (!s.endsAt) return ''; if (!totals[s.endsAt]) totals[s.endsAt] = Math.max(1, s.endsAt - F.now()); return `data-ends="${s.endsAt}" data-total="${totals[s.endsAt]}"`; };
  const timer = (s) => (s.endsAt ? `<div class="timer" ${T(s)}></div>` : '');
  const tbar = (s) => (s.endsAt ? `<div class="timerbar"><i data-kind="bar" ${T(s)}></i></div>` : '');
  const chip = (p, extra = '') => (p ? `<span class="chip" style="--c:${p.color}"><span class="em">${p.emoji}</span>${esc(p.name)}${extra}</span>` : '');
  const host = () => { try { const u = new URL(S.joinUrl); return u.host; } catch (e) { return location.host; } };

  function topbar(s) {
    if (s.phase === 'LOBBY') return '';
    const cur = currentStep(s);
    const steps = ['g1', 'g2', 'g3', 'h0', 'g4', 'g5', 'g6', 'h1', 'g7', 'h2'];
    const order = steps.indexOf(cur);
    const night = steps.map((k, i) => {
      const st = i < order ? 'done' : i === order ? 'now' : '';
      if (k[0] === 'g') return `<span class="g ${st}" title="Godown ${k.slice(1)}">${k.slice(1)}</span>`;
      return `<span class="h ${st}" title="Heist">🔦</span>`;
    }).join('');
    const actName = ['', 'Act one', 'Act two', 'Act three'][s.act] || '';
    return `<div class="logo">FENCE<small>${actName}</small></div><div class="night">${night}</div><div class="joinbox"><b>${esc(s.code)}</b><span>${esc(host())}</span></div>`;
  }
  function currentStep(s) {
    const heistPh = /^(HEIST|ESCAPE|SPLIT)/.test(s.phase);
    if (heistPh && s.x.heist) return `h${s.x.heist.idx}`;
    if (s.phase === 'PAPER') return `h${s.act === 1 ? 0 : 1}`;
    if (['RAIDS', 'RAT_VOTE', 'GUESS', 'REVEAL_RAT', 'REVEAL_GODFATHER', 'REVEAL_MISSIONS', 'FINAL'].includes(s.phase)) return 'end';
    return s.godownNo ? `g${s.godownNo}` : 'g0';
  }

  function dockbar(s) {
    if (s.phase === 'LOBBY') return '';
    return s.players.map((p) => `<span class="chip ${p.connected ? '' : 'off'}" style="--c:${p.color}"><span class="em">${p.emoji}</span>${esc(p.name)}</span>`).join('');
  }

  function yard(g, open) {
    const boxes = Array.from({ length: Math.min(g.count, 10) }, () => '<span class="box">?</span>').join('');
    return `<div class="yard">
      <div class="frame ${open ? 'open' : ''}">
        <div class="inside">${boxes}</div>
        <div class="shutter"><div class="num">${g.isLast ? '<small>The last</small>' : ''}${g.no}</div><div class="handle"></div><div class="lock"></div></div>
      </div>
      <div class="floor"></div>
      <div class="tag"><div class="fac">${esc(g.facility)}</div><div class="lease">Lease: ${esc(g.lease)}</div></div>
    </div>`;
  }
  const eventCard = (ev) => (ev ? `<div class="eventcard"><b>${esc(ev.title)}</b><span>${esc(ev.text)}</span></div>` : '');
  const poster = (h) => `<div class="poster"><div class="k">${h.idx === 2 ? 'The final job' : `Heist ${h.idx + 1} of 3`}</div><h2>${esc(h.name)}</h2><div class="pl">${esc(h.place)}</div><p>${esc(h.pitch)}</p><div class="haul">Possible haul: ${inr(h.loot[0])} to ${inr(h.loot[1])}</div></div>`;

  // ---------------------------------------------------------------- screens
  const R = {
    LOBBY(s) {
      const seats = Array.from({ length: 8 }, (_, i) => {
        const p = s.players[i];
        if (!p) return '<div class="seat"><span class="muted">Empty seat</span></div>';
        return `<div class="seat on" style="--c:${p.color}"><span class="em">${p.emoji}</span>${esc(p.name)}${p.id === s.vipId ? '<span class="vip">Starts the game</span>' : ''}</div>`;
      }).join('');
      return `<div class="screen lobby">
        <div>
          <div class="title">FENCE<small>Buy the godowns. Rob the city. Find the Godfather.</small></div>
          <div class="joincard">${s.qr ? `<img src="${s.qr}" alt="QR code to join">` : ''}
            <div><div class="hint">Scan the code, or go to</div><div class="url">${esc(host())}</div><div class="hint">and enter</div><div class="code">${esc(s.code)}</div></div>
          </div>
        </div>
        <div>
          <div class="roster">${seats}</div>
          <p class="hint">2 to 8 players, 4 or more is best. About an hour. The first person to join starts the game from their phone.</p>
          ${s.players.length >= 2 ? '<button class="startbtn" data-act="start">Start the game</button>' : ''}
        </div>
      </div>`;
    },
    NARRATION(s) {
      const x = s.x;
      const lines = x.lines.map((l, i) => `<p data-i="${i}">${esc(l)}</p>`).join('');
      if (x.kind === 'act') return `<div class="screen narr"><div><div class="actlabel">${esc(x.actLabel)}</div><div class="acttitle">${esc(x.title)}</div><div class="lines">${lines}</div></div></div>`;
      return `<div class="screen narr intro"><div class="lines">${lines}</div></div>`;
    },
    VIEWING(s) {
      const g = s.x.godown;
      return `<div class="screen godown">${yard(g, false)}
        <div>
          ${g.isLast ? '<div class="say amber">This is the one everyone has been waiting for.</div><br>' : ''}
          <div class="peekcall">Godown ${g.no} is up. Look at your phone.</div>
          <p>Each of you got a different private peek inside. Nobody saw the whole thing. Bidding opens in a moment.</p>
          ${eventCard(s.x.event)}
          <br>${tbar(s)}
        </div></div>`;
    },
    AUCTION(s) {
      const g = s.x.godown; const a = s.x.auction;
      const rum = a.rumours.map((r) => `<div class="rumour"><small>Someone whispers</small>${esc(r.text)}</div>`).join('');
      return `<div class="screen godown auction">${yard(g, false)}
        <div>
          <div class="high">${a.high ? inr(a.high) : 'No bids'}</div>
          <div class="who">${a.bidder ? `${chip(a.bidder)} has the top bid` : 'Bid from your phone'}</div>
          <div class="call" id="call"></div>
          <div class="meta"><span class="timer" ${T(s)}></span><span>${a.bids} bid${a.bids === 1 ? '' : 's'} so far</span></div>
          ${eventCard(s.x.event)}
          <div class="rumours">${rum}</div>
        </div></div>`;
    },
    OPENING(s) {
      const g = s.x.godown;
      const cards = s.x.revealed.map((it) => `<div class="icard ${it.hot ? 'hot' : ''} ${it.kind !== 'item' ? 'clue' : ''}"><div><div class="n">${esc(it.name)}</div><div class="c">${esc(it.catLabel)}</div></div><div class="v">${it.kind === 'item' ? inr(it.est) : ''}</div></div>`).join('');
      const hidden = g.count - s.x.revealed.length;
      return `<div class="screen godown">${yard(g, true)}
        <div>
          <div class="say">${chip(s.x.winner)} won Godown ${g.no} for ${inr(s.x.price)}</div>
          <p class="hint">Only they can see inside. Anything they choose to show you appears here. Estimates are what things look like, not what they are.</p>
          <div class="revealed">${cards}</div>
          ${hidden > 0 ? `<p class="hint">${hidden} thing${hidden === 1 ? '' : 's'} they are keeping to themselves.</p>` : ''}
        </div></div>`;
    },
    UNSOLD(s) {
      return `<div class="screen godown">${yard(s.x.godown, false)}<div><div class="say">Nobody bid.</div><p class="lede">The scrap man takes Godown ${s.x.godown.no}, contents unseen. Somebody will regret that.</p></div></div>`;
    },
    MARKET(s) {
      const x = s.x;
      const feed = x.feed.length ? x.feed.slice().reverse().map((f) => `<div class="f ${/FAKE/.test(f.text) ? 'fake' : ''}">${esc(f.text)}</div>`).join('') : '<div class="empty">Quiet so far. Somebody is sitting on something.</div>';
      const act2 = s.act >= 2;
      return `<div class="screen market">
        <div>
          <h2>The market is open</h2>
          ${eventCard(x.event)}
          <div class="howto">
            <div><span class="ic">💰</span><span>Sell to dealers for cash. Fakes get caught.</span></div>
            <div><span class="ic">🔍</span><span>Pay ₹25,000 to appraise. It reveals fakes and hidden gems.</span></div>
            <div><span class="ic">🤝</span><span>Sell to each other. Nobody checks what you are selling.</span></div>
            ${act2 ? '<div><span class="ic">🚚</span><span>Chacko buys hot gold. Every sale raises your heat.</span></div><div><span class="ic">👮</span><span>Pay a constable ₹2 lakh to lower your heat.</span></div>' : ''}
          </div>
          <br>${tbar(s)}
          <p class="hint">${x.doneCount} of ${s.players.filter((p) => p.connected).length} done. Keep anything you want. It counts at the end.</p>
        </div>
        <div class="feed">${feed}</div>
      </div>`;
    },
    HEIST_PLAN(s) {
      const h = s.x.heist;
      return `<div class="screen heist">${poster(h)}<div><div class="say">${chip(h.planner)} is planning this job.</div><p class="lede">${esc(h.reason)}</p><p class="lede">They are picking a crew right now. Look trustworthy.</p>${tbar(s)}</div></div>`;
    },
    HEIST_TIPS(s) {
      const h = s.x.heist;
      return `<div class="screen heist">${poster(h)}<div><div class="say">The crew</div><div class="crewgrid">${h.crew.map((c) => `<div class="role" style="--c:${c.color}"><div class="pn">${c.emoji} ${esc(c.name)}</div></div>`).join('')}</div><p class="lede">Everyone left out has a secret choice on their phone.</p>${tbar(s)}</div></div>`;
    },
    HEIST_BRIEF(s) {
      const h = s.x.heist;
      const RN = { lookout: ['👀', 'Lookout'], safecracker: ['🔐', 'Safecracker'], hacker: ['💻', 'Hacker'], driver: ['🚗', 'Driver'] };
      const crew = h.crew.map((c) => `<div class="role" style="--c:${c.color}"><div class="ri">${RN[c.role][0]}</div><div class="pn">${esc(c.name)}</div><div class="rn">${RN[c.role][1]}</div></div>`).join('');
      return `<div class="screen heist">${poster(h)}<div><div class="say">Read your phones.</div><div class="crewgrid">${crew}</div>
        <p class="lede">${h.tipCount ? `The police got <b class="red">${h.tipCount} anonymous tip${h.tipCount > 1 ? 's' : ''}</b> tonight. The alarm starts higher.` : 'No tips reached the police tonight. Probably.'}</p>
        <p class="hint">Talk out loud. The lookout is the only one who can see the guard.</p>${tbar(s)}</div></div>`;
    },
    HEIST_LIVE(s) {
      const l = s.x.live;
      const pips = (n) => [0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('');
      return `<div class="screen live">
        <div class="alarm"><div class="lab">Alarm</div><div class="num" id="alarmNum">0</div><div class="meter"><i id="alarmBar"></i></div><div class="zones"><span>Clean</span><span>Messy at 40</span><span>Busted at 100</span></div></div>
        <div>
          <div class="say">${esc(s.x.heist.name)}</div><br>
          <div class="tracks">
            ${l.hasHacker ? `<div class="track"><span class="ic">💻</span><span>Cameras</span><span class="pips">${pips(l.hack)}</span></div>` : ''}
            <div class="track"><span class="ic">🔐</span><span>Safe</span><span class="pips">${pips(l.safe)}</span></div>
            ${l.hasDriver ? '<div class="track"><span class="ic">🚗</span><span>Getaway car hidden</span><span></span></div>' : ''}
          </div>
          <div class="flash" id="flash"></div>
          <div class="meta"><span class="timer" ${T(s)}></span><span class="hint">seconds before the morning shift arrives</span></div>
        </div>
        <div class="sig" id="sig"></div>
      </div>`;
    },
    ESCAPE(s) {
      const e = s.x.escape;
      return `<div class="screen live"><div><div class="say">${chip(e.driver)} is driving. Which way?</div><br><div class="routes">${e.routes.map((r) => `<div class="route">${esc(r)}</div>`).join('')}</div><p class="lede">The rest of the crew has the police scanner. Tell the driver what you hear.</p></div>
        <div class="alarm"><div class="lab">Alarm</div><div class="num" style="color:${alarmColor(e.alarm)}">${e.alarm}</div><br><div class="timer" ${T(s)}></div></div></div>`;
    },
    HEIST_RESULT(s) {
      const r = s.x.result; const h = s.x.heist;
      const word = { clean: 'Clean', messy: 'Messy', busted: 'Busted' }[r.outcome];
      const line = r.outcome === 'busted' ? (r.timeout ? 'Out of time. The morning shift walked in.' : 'Sirens everywhere. The crew is caught.') : r.outcome === 'messy' ? 'They got out, but half of Kerala heard the alarm. Everyone on the crew gains heat.' : 'In and out. Not a sound.';
      const fines = r.fines.length ? `<p class="lede">Fines: ${r.fines.map((f) => `${esc(f.name)} ${inr(f.fine)}`).join(', ')}.</p>` : '';
      return `<div class="screen result"><div class="stamp ${r.outcome}">${word}</div><div class="say">${esc(line)}</div>${r.loot ? `<div class="loot">${inr(r.loot)} stolen</div>` : ''}${r.route ? `<p class="hint">Escape route: ${esc(r.route.name)} (${r.route.status === 'clear' ? 'clear road' : r.route.status === 'traffic' ? 'stuck in traffic' : 'police roadblock'}). Final alarm ${r.alarm}.</p>` : `<p class="hint">Alarm hit ${r.alarm}.</p>`}${fines}</div>`;
    },
    SPLIT_PROPOSE(s) {
      const h = s.x.heist;
      return `<div class="screen split"><div><div class="loot big-sign amber" style="font-size:5rem">${inr(s.x.split.pot)}</div><div class="say">${chip(h.planner)} is deciding who gets what.</div></div><div><p class="lede">The crew will vote on the split. Then each of them secretly chooses to honour the deal or grab more than their share.</p><p class="lede">If one person grabs, they take double. If two or more grab, a fight breaks out and some of the money is lost.</p>${tbar(s)}</div></div>`;
    },
    SPLIT_VOTE(s) {
      const sp = s.x.split;
      return `<div class="screen split"><div><div class="say">The proposed split</div><br>${sp.shares.map((p) => `<div class="share" style="--c:${p.color}"><span>${p.emoji} ${esc(p.name)}</span><div class="bar"><i style="width:${p.pct}%"></i></div><span>${p.pct}%</span></div>`).join('')}</div><div><div class="say">${sp.votesIn} of ${sp.voters} votes in</div><p class="lede">If the crew rejects it, everyone gets an equal share.</p>${tbar(s)}</div></div>`;
    },
    SPLIT_CHOICE(s) {
      const sp = s.x.split;
      return `<div class="screen center"><div class="big-sign" style="font-size:6rem">Honour or grab?</div><p class="lede">${sp.accepted === false ? 'The crew rejected the plan. Equal shares.' : 'The split was agreed.'} Now each of them decides, in secret.</p><div class="choices" style="width:min(60rem,100%)">${sp.shares.map((p) => `<div class="cc"><div class="in" style="--c:${p.color}"><div class="em">${p.emoji}</div><div class="nm">${esc(p.name)}</div><div class="ch muted">?</div></div></div>`).join('')}</div><br><div class="timer" ${T(s)}></div><p class="hint">${sp.choicesIn} decided</p></div>`;
    },
    SPLIT_RESULT(s) {
      const sp = s.x.split;
      return `<div class="screen center"><div class="big-sign" style="font-size:4.4rem">${sp.fight ? 'A fight broke out.' : sp.rows.some((r) => r.choice === 'grab') ? 'Someone grabbed.' : 'Honour among thieves.'}</div><div class="choices" style="width:min(64rem,100%);margin-top:2rem">${sp.rows.map((p, i) => `<div class="cc flip" style="animation-delay:${i * 0.8}s"><div class="in" style="--c:${p.color};animation-delay:${i * 0.8}s"><div class="em">${p.emoji}</div><div class="nm">${esc(p.name)}</div><div class="ch ${p.choice}">${p.choice === 'grab' ? 'Grab' : 'Honour'}</div><div class="pay">${inr(p.pay)}</div></div></div>`).join('')}</div>${sp.fight ? '<p class="lede">40% of the money vanished in the scuffle. Everyone gains heat.</p>' : ''}</div>`;
    },
    PAPER(s) {
      const p = s.x.paper;
      const raids = p.raids ? `<div class="box"><h4>Police raid godowns</h4>${p.raids.length ? p.raids.map((r) => `<p>${esc(r.name)} lost ${inr(r.lost)}${r.hot ? ` and ${r.hot} hot item${r.hot > 1 ? 's' : ''}` : ''}.</p>`).join('') : '<p>Nobody raided. Somebody bribed well.</p>'}</div><br>` : '';
      const alibi = p.alibi ? `<div class="box"><h4>Suspect cleared</h4><p>${esc(p.alibi.text)}</p></div>` : '';
      const stories = p.stories.length ? p.stories.map((t) => `<p class="st">${esc(t)}</p>`).join('') : '<p class="st">A quiet week in Mattancherry. Too quiet.</p>';
      return `<div class="screen paperwrap"><div class="paper"><div class="mast">The Kochi Chronicle</div><div class="dl"><span>${esc(p.day)} morning edition</span><span>Price ₹6</span></div><div class="hl">${esc(p.headline)}</div><div class="kick">${esc(p.kicker)}</div><div class="cols"><div>${stories}</div><div>${raids}${alibi}</div></div></div></div>`;
    },
    RAIDS(s) {
      const r = s.x.raids;
      return `<div class="screen center"><div class="big-sign red" style="font-size:6rem">Final raids</div>${r.length ? `<div class="rows">${r.map((x) => `<div class="row"><span class="r">${x.emoji} ${esc(x.name)}</span><span>lost ${inr(x.lost)}${x.hot ? ` and ${x.hot} hot item${x.hot > 1 ? 's' : ''}` : ''}</span><span class="d red">Raided</span></div>`).join('')}</div>` : '<p class="lede">The police knocked on every door and found nothing. Impressive.</p>'}</div>`;
    },
    RAT_VOTE(s) {
      return `<div class="screen center"><div class="big-sign" style="font-size:6.5rem">Who is the Rat?</div><p class="lede">Someone may have been working for the police all night, earning money every time one of you got raided or busted. There might be one. There might be two. There might be none.</p><p class="lede">Catch a Rat and they lose half their cash. A right guess pays you ₹3 lakh. A wrong one costs you ₹2 lakh.</p><div class="say">${s.x.votesIn} of ${s.players.filter((p) => p.connected).length} voted</div><br><div class="timer" ${T(s)}></div></div>`;
    },
    GUESS(s) {
      const sus = s.suspects.map((x) => `<div class="sus"><div class="em">${x.emoji}</div><div class="nm">${esc(x.name)}</div><div class="tt">${esc(x.title)}</div>${x.cleared ? '<div class="cleared">Alibi</div>' : ''}</div>`).join('');
      return `<div class="screen center"><div class="big-sign" style="font-size:6rem">Who is the Godfather?</div><p class="lede">The evidence you found in the godowns points to one of these four. A right guess pays ₹15 lakh.</p><div class="suspects">${sus}</div><br><div class="say">${s.x.votesIn} guessed</div><div class="timer" ${T(s)}></div></div>`;
    },
    REVEAL_RAT(s) {
      const x = s.x;
      const head = x.none ? 'There was no Rat.' : x.rats.map((r) => `${r.emoji} ${esc(r.name)}`).join(' and ') + (x.rats.length > 1 ? ' were the Rats.' : ' was the Rat.');
      const fate = x.rats.map((r) => `<p class="lede">${esc(r.name)} ${r.caught ? `was caught and lost ${inr(-r.delta)}.` : `got away with it. Bonus ${inr(r.delta)}.`}</p>`).join('');
      return `<div class="screen center"><div class="big-sign ${x.none ? 'green' : 'red'}" style="font-size:5rem">${head}</div>${fate}<div class="rows">${x.rows.map((r, i) => `<div class="row" style="animation-delay:${i * 0.25}s"><span class="r">${r.emoji} ${esc(r.name)}</span><span>voted ${esc(r.vote)}</span><span class="d ${r.right ? 'green' : 'red'}">${r.delta > 0 ? '+' : ''}${inr(r.delta)}</span></div>`).join('')}</div></div>`;
    },
    REVEAL_GODFATHER(s) {
      const x = s.x;
      return `<div class="screen center"><div class="hint">The Godfather was</div><div class="sus" style="width:22rem;margin-top:1rem"><div class="em">${x.suspect.emoji}</div><div class="nm">${esc(x.suspect.name)}</div><div class="tt">${esc(x.suspect.title)}</div></div><div class="confess">${x.lines.map((l, i) => `<p data-i="${i}">${esc(l)}</p>`).join('')}</div><p class="lede">${x.right.length ? `${x.right.map((p) => esc(p.name)).join(', ')} guessed right: +₹15 lakh each.` : 'Nobody guessed right.'}</p></div>`;
    },
    REVEAL_MISSIONS(s) {
      return `<div class="screen center"><div class="big-sign" style="font-size:5rem">Secret missions</div><div class="rows">${s.x.rows.map((r, i) => `<div class="row" style="animation-delay:${i * 0.5}s"><span class="r">${r.emoji} ${esc(r.name)}</span><span>${esc(r.text)}</span><span class="d ${r.ok ? 'green' : 'red'}">${r.ok ? '+₹5 lakh' : 'Failed'}</span></div>`).join('')}</div></div>`;
    },
    FINAL(s) {
      const rows = s.x.rows;
      const w = rows[0];
      return `<div class="screen center final"><div class="hint">Kingpin of Kochi</div><div class="winner">${w.emoji} ${esc(w.name)}</div>
        <div class="rows">${rows.map((r, i) => `<div class="row ${i === 0 ? 'first' : ''}" style="animation-delay:${(rows.length - i) * 0.35}s"><span class="rk">${r.rank}</span><span class="r">${r.emoji} ${esc(r.name)}${r.isRat ? ' <span class="red">(Rat)</span>' : ''}</span><span class="sub">Cash ${inr(r.cash)} + items ${inr(r.items)}${r.seized ? `, ${inr(r.seized)} seized` : ''}${r.best ? `<br>Best item: ${esc(r.best)}` : ''}</span><span class="tot">${inr(r.total)}</span></div>`).join('')}</div>
        <p class="hint">${esc(s.players.find((p) => p.id === s.vipId)?.name || 'The first player')} can start a new game from their phone.</p></div>`;
    },
  };

  function alarmColor(a) { return a >= 70 ? 'var(--laterite)' : a >= 40 ? 'var(--amber)' : 'var(--good)'; }

  // ---------------------------------------------------------------- render
  function render() {
    const s = S;
    mount(top, topbar(s));
    mount(dock, dockbar(s));
    const fn = R[s.phase];
    if (!P || P.phase !== s.phase) { stage.classList.remove('enter'); void stage.offsetWidth; stage.classList.add('enter'); }
    mount(stage, fn ? fn(s) : `<div class="screen center"><div class="say">${esc(s.phase)}</div></div>`);
    if (s.phase === 'HEIST_LIVE') liveAfter(s);
  }

  let lastFlash = null; let lastSig = null; let flashTimer = null; let sirenAt = 0;
  function liveAfter(s) {
    const l = s.x.live;
    const n = document.getElementById('alarmNum'); const b = document.getElementById('alarmBar');
    if (n) { n.textContent = l.alarm; n.style.color = alarmColor(l.alarm); }
    if (b) { b.style.width = `${l.alarm}%`; b.style.background = alarmColor(l.alarm); }
    document.body.classList.toggle('danger', l.alarm >= 70);
    if (l.alarm >= 70 && Date.now() - sirenAt > 6000) { sirenAt = Date.now(); F.sfx.alarm(); }
    if (l.flash && l.flash.id !== lastFlash) {
      lastFlash = l.flash.id;
      const f = document.getElementById('flash');
      if (f) { f.textContent = l.flash.n ? `${l.flash.reason} +${l.flash.n}` : l.flash.reason; f.className = `flash ${l.flash.good ? 'good' : 'bad'}`; clearTimeout(flashTimer); flashTimer = setTimeout(() => { f.textContent = ''; }, 2600); }
      if (l.flash.good) F.sfx.good(); else F.sfx.bad();
    }
    if (l.signal && l.signal.id !== lastSig) {
      lastSig = l.signal.id;
      const g = document.getElementById('sig');
      if (g) { g.textContent = l.signal.sig === 'stop' ? 'STOP' : 'GO'; g.style.color = l.signal.sig === 'stop' ? 'var(--laterite)' : 'var(--good)'; g.classList.remove('show'); void g.offsetWidth; g.classList.add('show'); }
    }
  }

  // ---------------------------------------------------------------- effects: sound, voice, narration
  let narrKey = null; let narrTimers = [];
  function clearNarr() { narrTimers.forEach(clearTimeout); narrTimers = []; }
  function playLines(sel, lines, totalMs) {
    clearNarr(); hush();
    const els = () => document.querySelectorAll(`${sel} p`);
    const show = (i) => { const ps = els(); ps.forEach((p, j) => { if (j < i) p.classList.add('on', 'dim'); if (j === i) { p.classList.add('on'); p.classList.remove('dim'); } }); };
    if (voiceOn && hasTTS) {
      const next = (i) => { if (i >= lines.length) return; say(lines[i], () => show(i), () => narrTimers.push(setTimeout(() => next(i + 1), 350))); };
      next(0);
      // fallback in case speech never starts
      narrTimers.push(setTimeout(() => { if (!document.querySelector(`${sel} p.on`)) lines.forEach((_, i) => narrTimers.push(setTimeout(() => show(i), i * (totalMs / (lines.length + 0.5))))); }, 2500));
    } else {
      lines.forEach((_, i) => narrTimers.push(setTimeout(() => show(i), 300 + i * (totalMs / (lines.length + 0.5)))));
    }
  }

  let tickSec = null;
  setInterval(() => {
    if (!S || S.phase !== 'AUCTION') return;
    const ms = F.left(S.endsAt); const sec = Math.ceil(ms / 1000);
    const call = document.getElementById('call');
    if (call) call.textContent = S.x.auction.bids === 0 ? '' : ms < 1500 ? 'Going twice...' : ms < 3200 ? 'Going once...' : '';
    if (sec <= 3 && sec > 0 && sec !== tickSec) { tickSec = sec; F.sfx.tick(); }
  }, 100);

  function effects() {
    const s = S; const p = P; const ph = s.phase; const was = p ? p.phase : null;
    const entered = ph !== was || (p && p.endsAt !== s.endsAt && ph === 'NARRATION');
    if (ph !== 'HEIST_LIVE') document.body.classList.remove('danger');
    if (ph === 'NARRATION') {
      const k = `${ph}:${s.x.title}:${s.x.lines.length}`;
      if (k !== narrKey) {
        narrKey = k;
        const total = Math.max(1000, s.endsAt - F.now());
        if (s.x.kind === 'act') { clearNarr(); hush(); say(`${s.x.actLabel}. ${s.x.title}.`, null, () => playLines('.narr .lines', s.x.lines, Math.max(1000, total - 3000))); }
        else playLines('.narr .lines', s.x.lines, total);
      }
      return;
    }
    if (entered) { clearNarr(); narrKey = null; }
    if (ph === 'REVEAL_GODFATHER' && entered) { F.sfx.drum(); setTimeout(() => playLines('.confess', s.x.lines, 22000), 1600); }
    if (!entered && ph === 'AUCTION' && p.x.auction && s.x.auction.bids > p.x.auction.bids) F.sfx.bid();
    if (!entered) {
      if (ph === 'MARKET' && p.x.feed) { const old = new Set(p.x.feed.map((f) => f.id)); s.x.feed.filter((f) => !old.has(f.id)).forEach((f) => (/FAKE/.test(f.text) ? F.sfx.fake() : /sold|set/.test(f.text) ? F.sfx.cash() : null)); }
      if (ph === 'OPENING' && s.x.revealed.length > p.x.revealed.length) F.sfx.good();
      return;
    }
    hush();
    switch (ph) {
      case 'VIEWING': F.sfx.whoosh(); say(s.x.godown.isLast ? 'The last godown. Check your phones.' : `Godown ${s.x.godown.no}. Check your phones.`); if (s.x.event) setTimeout(() => say(`${s.x.event.title}. ${s.x.event.text}`), 2600); break;
      case 'AUCTION': F.sfx.bid(); break;
      case 'OPENING': F.sfx.gavel(); setTimeout(() => F.sfx.shutter(), 350); say(`Sold, to ${s.x.winner.name}, for ${spoken(s.x.price)}.`); break;
      case 'UNSOLD': F.sfx.bad(); say('No bids. The scrap man takes it.'); break;
      case 'MARKET': F.sfx.cash(); break;
      case 'HEIST_PLAN': F.sfx.drum(); say(`${s.x.heist.planner.name} is planning ${s.x.heist.name}. Pick your crew.`); break;
      case 'HEIST_TIPS': say('Everyone left out: check your phone.'); break;
      case 'HEIST_BRIEF': say('Read your roles. The lookout is the only one who can see the guard.'); break;
      case 'HEIST_LIVE': F.sfx.alarm(); break;
      case 'ESCAPE': F.sfx.alarm(); say(`${s.x.escape.driver.name}, pick a road. Everyone else, check the scanner.`); break;
      case 'HEIST_RESULT': F.sfx.stamp(); if (s.x.result.outcome === 'busted') F.sfx.alarm(); say({ clean: 'Clean job.', messy: 'Messy. But they got out.', busted: 'Busted.' }[s.x.result.outcome]); break;
      case 'SPLIT_PROPOSE': F.sfx.cash(); break;
      case 'SPLIT_CHOICE': F.sfx.drum(); say('Honour, or grab?'); break;
      case 'SPLIT_RESULT': s.x.split.rows.forEach((_, i) => setTimeout(() => F.sfx.stamp(), i * 800 + 300)); break;
      case 'PAPER': F.sfx.whoosh(); setTimeout(() => say(`The Kochi Chronicle. ${s.x.paper.headline.toLowerCase()}.`), 900); break;
      case 'RAIDS': F.sfx.alarm(); break;
      case 'RAT_VOTE': F.sfx.drum(); say('Who is the Rat? Vote on your phone.'); break;
      case 'GUESS': say('Who is the Godfather? Choose on your phone.'); break;
      case 'REVEAL_RAT': F.sfx.drum(); setTimeout(() => F.sfx.stamp(), 1200); break;
      case 'REVEAL_MISSIONS': F.sfx.good(); break;
      case 'FINAL': F.sfx.drum(); setTimeout(() => { F.sfx.cash(); say(`${s.x.rows[0].name} is the Kingpin of Kochi.`); }, 1300); break;
      default:
    }
  }
  function spoken(v) { return F.inr(v).replace('₹', '') + ' rupees'; }

  // ---------------------------------------------------------------- rain
  const cv = document.getElementById('rain'); const cx = cv.getContext('2d');
  let drops = [];
  function size() { cv.width = innerWidth; cv.height = innerHeight; drops = Array.from({ length: Math.floor(innerWidth / 9) }, () => ({ x: Math.random() * cv.width, y: Math.random() * cv.height, l: 10 + Math.random() * 22, v: 6 + Math.random() * 8 })); }
  addEventListener('resize', size); size();
  const still = matchMedia('(prefers-reduced-motion: reduce)').matches;
  (function rain() {
    cx.clearRect(0, 0, cv.width, cv.height);
    cx.strokeStyle = 'rgba(157,176,187,.16)'; cx.lineWidth = 1;
    cx.beginPath();
    for (const d of drops) { cx.moveTo(d.x, d.y); cx.lineTo(d.x - d.l * 0.18, d.y + d.l); if (!still) { d.y += d.v; d.x -= d.v * 0.18; if (d.y > cv.height) { d.y = -d.l; d.x = Math.random() * (cv.width + 100); } } }
    cx.stroke();
    requestAnimationFrame(rain);
  })();
})();
