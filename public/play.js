/* FENCE: the phone controller */
(() => {
  const $ = (q) => document.querySelector(q);
  const esc = F.esc; const inr = F.inr; const inrS = F.inrShort;
  const socket = io();
  const main = $('#main'); const hud = $('#hud'); const sheetEl = $('#sheet'); const sheetWrap = $('#sheetWrap');
  const codeIn = $('#jcode'); const nameIn = $('#jname');
  const params = new URLSearchParams(location.search);
  codeIn.value = (params.get('room') || localStorage.getItem('fence:code') || '').toUpperCase();
  nameIn.value = localStorage.getItem('fence:name') || '';
  const buzz = (p) => { try { navigator.vibrate?.(p); } catch (e) { /* not supported */ } };

  let S = null; let P = null; let joined = null;
  let sheet = null; let offerDraft = null; let crewSel = new Set(); let splitDraft = null; let hackBuf = '';
  let dialVal = 50; let lastNote = 0; let lastSig = null; let lastLights = false;

  // ---------------------------------------------------------------- joining
  let wake = null;
  async function keepAwake() { try { if ('wakeLock' in navigator && !wake && document.visibilityState === 'visible') { wake = await navigator.wakeLock.request('screen'); wake.addEventListener('release', () => { wake = null; }); } } catch (e) { wake = null; } }
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible' && joined) { keepAwake(); if (!socket.connected) socket.connect(); } });
  function showApp() { $('#join').hidden = true; $('#app').hidden = false; keepAwake(); }
  function showJoin() { $('#join').hidden = false; $('#app').hidden = true; }
  function tryJoin(code, name, token) {
    socket.emit('player:join', { code, name, token }, (r) => {
      if (r.error) {
        if (token) { localStorage.removeItem(`fence:token:${code}`); joined = null; }
        if (!token || name) $('#jerr').textContent = r.error;
        showJoin(); return;
      }
      joined = { code: r.code, token: r.token };
      localStorage.setItem(`fence:token:${r.code}`, r.token);
      localStorage.setItem('fence:code', r.code);
      if (name) localStorage.setItem('fence:name', name);
      showApp();
    });
  }
  socket.on('connect', () => {
    if (joined) return tryJoin(joined.code, '', joined.token);
    const code = codeIn.value.trim().toUpperCase();
    const tok = code && localStorage.getItem(`fence:token:${code}`);
    if (tok) tryJoin(code, '', tok);
  });
  $('#jform').onsubmit = (e) => {
    e.preventDefault(); F.ac();
    $('#jerr').textContent = '';
    const code = codeIn.value.trim().toUpperCase();
    tryJoin(code, nameIn.value.trim(), localStorage.getItem(`fence:token:${code}`) || null);
  };
  socket.on('kicked', () => { joined = null; showJoin(); $('#jerr').textContent = 'You were removed from the room.'; });
  socket.on('state', (s) => {
    F.syncClock(s.now); P = S; S = s; window.__S = s;
    if (P && P.phase !== S.phase) onPhase();
    render(); notes(); effects();
  });

  function send(type, data = {}) {
    socket.emit('act', { type, ...data }, (r) => { if (r && r.error) toast(r.error, 'bad'); });
  }

  // ---------------------------------------------------------------- toasts
  function toast(text, kind = 'info') {
    const t = document.createElement('div');
    t.className = `toast ${kind}`; t.textContent = text;
    $('#toasts').appendChild(t);
    setTimeout(() => t.remove(), 4200);
    if (kind === 'bad') buzz([60, 40, 60]); else if (kind === 'good') buzz(30);
  }
  function notes() {
    const ns = S.me?.notes || [];
    if (!lastNote && P == null) { lastNote = ns.length ? ns[ns.length - 1].id : 0; return; }
    ns.filter((n) => n.id > lastNote).forEach((n) => { toast(n.text, n.kind); if (n.kind === 'good') F.sfx.cash(); });
    if (ns.length) lastNote = Math.max(lastNote, ns[ns.length - 1].id);
  }

  // ---------------------------------------------------------------- helpers
  const T = () => (S.endsAt ? `data-ends="${S.endsAt}"` : '');
  const chip = (p) => (p ? `<span class="chip" style="--c:${p.color}"><span class="em">${p.emoji}</span>${esc(p.name)}</span>` : '');
  const vipName = () => S.players.find((p) => p.id === S.vipId)?.name || 'the first player';
  const skipBtn = () => (S.me.vip ? '<button class="btn ghost sm" data-a="skip">Skip ahead</button>' : '');
  const tv = (title, sub = '', icon = '📺') => `<div class="tv"><div class="big">${icon}</div><h2 class="t1">${title}</h2>${sub ? `<p class="lead">${sub}</p>` : ''}${skipBtn()}</div>`;
  const evCard = (ev) => (ev ? `<div class="card amb"><b>${esc(ev.title)}</b><p class="lead" style="color:inherit;margin-top:.3rem">${esc(ev.text)}</p></div>` : '');
  const RN = { lookout: 'Lookout', safecracker: 'Safecracker', hacker: 'Hacker', driver: 'Driver' };

  function itemCard(it, mode, x = {}) {
    const cls = [it.kind !== 'item' ? it.kind : '', it.hot ? 'hot' : '', it.fake ? 'fake' : '', it.gem ? 'gem' : ''].join(' ');
    const tags = [];
    tags.push(`<span class="tag">${esc(it.kind === 'clue' ? 'Heist plans' : it.kind === 'evidence' ? 'Evidence' : it.catLabel)}</span>`);
    if (it.hot) tags.push('<span class="tag hot">Hot</span>');
    if (it.appraised) tags.push(it.fake ? '<span class="tag bad">Appraised: fake</span>' : it.gem ? '<span class="tag ok">Hidden gem!</span>' : '<span class="tag ok">Appraised: genuine</span>');
    if (it.set) tags.push('<span class="tag">Part of a set</span>');
    const val = it.kind === 'item' ? `<div class="v">${it.appraised ? '' : 'Est. '}${inr(it.est)}</div>` : '';
    let acts = '';
    if (mode === 'market') {
      const offered = (x.outgoing || []).some((o) => o.uid === it.uid);
      const b = [];
      if (it.kind === 'item' && !it.hot) b.push(`<button class="btn sm primary" data-a="sell" data-uid="${it.uid}" ${x.dealersOpen ? '' : 'disabled'}>Sell ${inr(it.dealer)}${it.bonus ? ' (bonus)' : ''}</button>`);
      if (it.hot) b.push(`<button class="btn sm danger" data-a="chacko" data-uid="${it.uid}" ${x.dealersOpen ? '' : 'disabled'}>Chacko pays ${inr(it.chacko)}</button>`);
      if (it.kind === 'item' && !it.appraised) b.push(`<button class="btn sm" data-a="appraise" data-uid="${it.uid}">Appraise ₹25,000</button>`);
      b.push(`<button class="btn sm" data-a="offerOpen" data-uid="${it.uid}" ${offered ? 'disabled' : ''}>${offered ? 'Offered' : 'Sell to a player'}</button>`);
      acts = `<div class="acts">${b.join('')}</div>`;
    }
    if (mode === 'opening') acts = `<div class="acts"><button class="btn sm ${it.shown ? '' : 'primary'}" data-a="reveal" data-uid="${it.uid}" ${it.shown ? 'disabled' : ''}>${it.shown ? 'Shown on TV' : 'Show the room'}</button></div>`;
    return `<div class="it ${cls}"><div class="top"><div class="nm">${esc(it.name)}</div>${val}</div><div class="meta">${tags.join('')}</div>${it.note || it.text ? `<div class="note">${esc(it.note || it.text)}</div>` : ''}${acts}</div>`;
  }

  // ---------------------------------------------------------------- HUD
  function hudHtml() {
    const m = S.me;
    const heat = m.showHeat ? `<div class="heat"><span>Heat ${m.heat}</span><div class="bar"><i style="width:${m.heat}%;transform:none"></i></div></div>` : '<div></div>';
    return `<div class="who"><span class="em" style="--c:${m.color}">${m.emoji}</span><span>${esc(m.name)}</span></div>${heat}<div class="cash">${inr(m.cash)}${S.endsAt ? `<div class="t">⏱ <span ${T()}></span>s</div>` : ''}</div>`;
  }

  // ---------------------------------------------------------------- screens
  const R = {
    LOBBY() {
      const list = S.players.map((p) => `<button disabled><span class="em">${p.emoji}</span>${esc(p.name)}${p.id === S.me.id ? '<span class="right">You</span>' : ''}</button>`).join('');
      return `<h2 class="t1">You're in, ${esc(S.me.name)}.</h2>
        <p class="lead">Keep this page open all night. Your phone is your controller, and it will show you things nobody else sees.</p>
        <div class="pick">${list}</div>
        ${S.me.vip ? `<button class="btn primary big" data-a="start" ${S.players.length < 2 ? 'disabled' : ''}>Start the game</button><p class="lead small">Wait until everyone has joined. 4 or more players is best.</p>` : `<p class="lead">Waiting for ${esc(vipName())} to start the game.</p>`}`;
    },
    NARRATION() { return tv('Eyes on the TV.', S.x.kind === 'act' ? `${esc(S.x.actLabel)}: ${esc(S.x.title)}` : 'The story is starting.'); },
    VIEWING() {
      const g = S.x.godown;
      return `<div class="peek"><div class="lab">Your private peek inside Godown ${g.no}</div><div class="txt">${esc(S.x.peek || 'Too dark to see anything.')}</div></div>
        <p class="lead">Only you saw this. Everyone else saw something different. Bidding opens in a moment.</p>${evCard(S.x.event)}`;
    },
    AUCTION() {
      const x = S.x; const a = x.auction;
      const st = x.isHigh ? 'You have the top bid' : a.bidder ? `${esc(a.bidder.name)} has the top bid` : 'Nobody has bid yet';
      const bids = x.incs.map((i) => `<button class="btn" data-a="bid" data-inc="${i.inc}" ${i.ok ? '' : 'disabled'}><b>+${inrS(i.inc)}</b><span>bid ${inr(i.total)}</span></button>`).join('');
      const rum = S.act >= 2 ? (x.canRumour ? '<button class="btn" data-a="sheet" data-s="rumour">Whisper an anonymous rumour</button>' : '<p class="lead small">Your rumour is out there.</p>') : '';
      return `<div class="card"><span class="muted small">You saw:</span> <span class="typed">${esc(x.peek || 'nothing')}</span></div>
        <div class="card bidnow ${x.isHigh ? 'mine' : ''}"><div class="amt">${a.high ? inr(a.high) : '₹0'}</div><div class="st">${st}</div></div>
        <div class="bids">${bids}</div>${rum}
        <p class="lead small">Every bid resets the clock, a little shorter each time. If you win, you pay your bid.</p>`;
    },
    OPENING() {
      const x = S.x;
      if (!x.found) return tv(`${esc(x.winner.name)} is looking inside Godown ${x.godown.no}.`, 'Only they can see what is in there. Watch the TV for anything they decide to show.', '🔦');
      return `<h2 class="t1">Godown ${x.godown.no} is yours.</h2><p class="lead">You paid ${inr(x.price)}. Show the room as much or as little as you like. The TV shows what things look like, not whether they are real.</p>
        <div class="items">${x.found.map((it) => itemCard(it, 'opening')).join('')}</div>
        <button class="btn primary big" data-a="openDone">Close the shutter</button>`;
    },
    UNSOLD() { return tv('Nobody bid.', 'The scrap man takes it.', '🗑️'); },
    MARKET() {
      const x = S.x; const m = S.me;
      const req = m.request ? `<div class="card amb req"><span class="ic">📞</span><div>A collector will pay <b>${m.request.mult}×</b> for any <b>${esc(m.request.label)}</b> item this round. Only you got this call.</div></div>` : '';
      const inc = (x.incoming || []).map((o) => `<div class="card amb"><div><b>${esc(o.from.name)}</b> offers you:</div><div class="it" style="margin:.6rem 0"><div class="top"><div class="nm">${esc(o.item.name)}</div>${o.item.kind === 'item' ? `<div class="v">Est. ${inr(o.item.est)}</div>` : ''}</div><div class="note">${esc(o.item.note || '')}</div></div><div class="row2"><button class="btn green" data-a="respond" data-id="${o.id}" data-ok="1">Pay ${inr(o.price)}</button><button class="btn" data-a="respond" data-id="${o.id}" data-ok="0">No thanks</button></div></div>`).join('');
      const out = (x.outgoing || []).map((o) => { const it = S.inv.find((i) => i.uid === o.uid); return `<div class="card"><div class="small muted">Waiting for ${esc(o.to.name)}</div><b>${esc(it ? it.name : 'item')}</b> for ${inr(o.price)} <button class="btn sm ghost" data-a="respond" data-id="${o.id}" data-ok="0">Cancel</button></div>`; }).join('');
      const sets = (S.sets || []).map((st) => `<button class="btn primary big" data-a="sellSet" data-key="${st.key}" ${x.dealersOpen ? '' : 'disabled'}>Sell the full set: ${esc(st.name)} (double value)</button>`).join('');
      const junkN = S.inv.filter((i) => i.kind === 'item' && !i.hot && !i.set && i.est < 5000).length;
      const junkBtn = junkN > 1 ? `<button class="btn" data-a="sellJunk" ${x.dealersOpen ? '' : 'disabled'}>Sell all ${junkN} cheap items (under ₹5,000) in one go</button>` : '';
      const items = S.inv.length ? `${junkBtn}<div class="items">${S.inv.map((it) => itemCard(it, 'market', x)).join('')}</div>` : '<div class="card"><p class="lead">Your bag is empty. Win a godown, or buy something from a friend.</p></div>';
      const bribe = x.canBribe ? `<div class="card"><b>Heat ${m.heat} of 100.</b> <span class="muted">High heat means a likely police raid.</span><div style="margin-top:.6rem"><button class="btn sm" data-a="bribe" ${m.heat > 0 && m.cash >= x.bribeCost ? '' : 'disabled'}>Pay a constable ${inr(x.bribeCost)} (heat -25)</button></div></div>` : '';
      return `<h2 class="t1">The market</h2>${evCard(x.event)}${req}${inc}${sets}${items}${out}${bribe}
        <button class="btn ${x.done ? '' : 'primary'} big" data-a="done" ${x.done ? 'disabled' : ''}>${x.done ? 'Waiting for the others' : "I'm done trading"}</button>
        <p class="lead small">Anything you keep counts at its true value at the end of the night.</p>`;
    },
    HEIST_PLAN() {
      const x = S.x; const h = x.heist;
      if (!x.isPlanner) return tv(`${esc(h.planner.name)} is planning ${esc(h.name)}.`, 'They are choosing a crew. Make your case out loud.', '🗺️');
      const cand = x.candidates.map((p) => `<button data-a="crewToggle" data-id="${p.id}" class="${crewSel.has(p.id) ? 'on' : ''}"><span class="em">${p.emoji}</span>${esc(p.name)}<span class="right">${crewSel.has(p.id) ? 'On the crew' : ''}</span></button>`).join('');
      const n = crewSel.size;
      return `<h2 class="t1">You're planning ${esc(h.name)}, ${esc(h.place)}.</h2>
        <p class="lead">${esc(h.pitch)}</p>
        <p class="lead">Pick 1 to ${x.maxCrew} people. A bigger crew makes the job easier, but means more people to share with, and more people who might grab.</p>
        <div class="pick">${cand}</div>
        <button class="btn primary big" data-a="crew" ${n >= 1 && n <= x.maxCrew ? '' : 'disabled'}>Lock in my crew (${n + 1} people)</button>`;
    },
    HEIST_TIPS() {
      const x = S.x;
      if (x.inCrew) return tv("You're on the crew.", 'Everyone left out is deciding whether to call the police. Smile at them.', '🤞');
      if (x.tipped !== null && x.tipped !== undefined) return tv(x.tipped ? 'You called the police.' : 'You stayed quiet.', 'Nobody will ever know. Unless you tell them.', '🤫');
      return `<h2 class="t1">You're not on this job.</h2><p class="lead">You can secretly tip off the police. That makes the alarm start higher for the crew.</p>
        <div class="card">If the crew gets busted, the police pay you <b class="amber">₹3 lakh</b>. If they get away, the police get curious about you: <b class="red">heat +12</b>.</div>
        <div class="row2"><button class="btn danger big" data-a="tip" data-yes="1">Tip off</button><button class="btn big" data-a="tip" data-yes="0">Stay quiet</button></div>`;
    },
    HEIST_BRIEF() {
      const x = S.x;
      if (!x.role) return tv('Not your job.', 'Watch the TV. Enjoy the screaming.');
      return `<div class="card rolecard"><div class="ri">${x.roleInfo.icon}</div><h2>${esc(x.roleInfo.name)}</h2><p>${esc(x.roleInfo.how)}</p></div><p class="lead center">Talk to each other out loud. It starts in a few seconds.</p>`;
    },
    HEIST_LIVE() {
      const x = S.x; const l = x.live;
      if (!x.role) return tv('The job is on.', 'Watch the alarm on the TV.', '🚨');
      const alarm = `<div class="alarmline"><span>Alarm</span><div class="bar"><i id="pa" style="width:${l.alarm}%;transform:none;background:${l.alarm >= 70 ? 'var(--laterite)' : l.alarm >= 40 ? 'var(--amber)' : 'var(--good)'}"></i></div><span id="pan">${l.alarm}</span></div>`;
      const pips = (n) => `<div class="pips">${[0, 1, 2].map((i) => `<i class="${i < n ? 'on' : ''}"></i>`).join('')}</div>`;
      let body = '';
      if (x.role === 'lookout') {
        const st = l.guard.state;
        const txt = st === 'away' ? 'He is looking away. Tell them GO.' : st === 'turning' ? 'He is turning round! STOP!' : 'He is watching. Nobody moves.';
        body = `<div class="corridor ${st}"><div class="guard">💂</div></div><div class="gstate ${st === 'away' ? 'green' : 'red'}">${txt}</div>
          <div class="sigbtns"><button class="btn danger" data-a="signal" data-sig="stop">STOP</button><button class="btn green" data-a="signal" data-sig="go">GO</button></div>
          <p class="lead small center">These buttons flash on the crew's phones. Shouting works too.</p>`;
      }
      if (x.role === 'hacker') {
        if (l.hack >= 3) body = `${pips(3)}<div class="tv"><div class="big">📹</div><h2 class="t1">Cameras looped.</h2><p class="lead">Help the others. Listen to the lookout.</p></div>`;
        else {
          const vis = !!l.code && F.left(l.shownUntil) > 0;
          const code = vis ? [...l.code].map((g) => `<span>${g}</span>`).join('') : '<span>?</span><span>?</span><span>?</span><span>?</span>';
          body = `${pips(l.hack)}<p class="lead center">${vis ? 'Memorise this code!' : 'Tap the code in. Only when the lookout says GO.'}</p><div class="code ${vis ? '' : 'hidden'}" id="code" data-until="${l.shownUntil}">${code}</div>
            <div class="entered" id="entered"></div><div class="keys">${l.glyphs.map((g) => `<button class="btn" data-a="glyph" data-g="${g}">${g}</button>`).join('')}</div>
            <div class="row2"><button class="btn" data-a="clearHack">Clear</button><button class="btn" data-a="hackPeek">Show code again (+3)</button></div>`;
        }
      }
      if (x.role === 'safecracker') {
        body = `${pips(l.safe)}<div class="dialwrap"><div class="dial" id="dial"><div class="ticks"></div><div class="knob" id="knob"></div><div class="val" id="dialVal">${dialVal}</div></div>
          <div class="listen"><i id="listen"></i><span>Listening to the lock</span></div>
          <div class="fine"><button class="btn" data-a="dial" data-d="-1">−1</button><button class="btn" data-a="dial" data-d="1">+1</button><button class="btn primary" data-a="safe">SET</button></div></div>
          <p class="lead small center">Drag the dial. The bar fills and your phone buzzes as you get close. Only SET when the lookout says GO.</p>`;
      }
      if (x.role === 'driver') {
        const on = l.car?.lights;
        body = `<div class="car ${on ? 'lights' : ''}">🚗</div>${on ? '<button class="btn danger big hide" data-a="hide">HIDE</button>' : '<p class="gstate">Engine idling in the lane. Watch for headlights.</p>'}`;
      }
      return alarm + body;
    },
    ESCAPE() {
      const x = S.x; const e = x.escape;
      if (!x.inCrew) return tv('Getaway!', 'The crew is choosing an escape route.', '🚗');
      if (x.isDriver) return `<h2 class="t1">You're driving. Pick a road.</h2><p class="lead">The rest of the crew can hear the police scanner. Listen to them.</p><div class="pick">${e.routes.map((r, i) => `<button data-a="route" data-i="${i}">🛣️ ${esc(r)}</button>`).join('')}</div>`;
      const word = { clear: 'Clear', traffic: 'Heavy traffic', roadblock: 'Police roadblock' };
      return `<h2 class="t1">Police scanner</h2><p class="lead">Only the crew can hear this. Tell ${esc(e.driver.name)} which road to take!</p><div class="scan">${(e.scanner || []).map((r) => `<div><span>${esc(r.name)}</span><span class="${r.status}">${word[r.status]}</span></div>`).join('')}</div>`;
    },
    HEIST_RESULT() {
      const r = S.x.result;
      const t = { clean: ['Clean job.', 'In and out, not a sound.'], messy: ['Messy, but you got out.', 'Everyone on the crew gains heat.'], busted: ['Busted.', S.x.inCrew ? 'You paid a fine and gained heat.' : 'The crew got caught.'] }[r.outcome];
      return tv(t[0], `${t[1]}${r.loot ? ` The haul: ${inr(r.loot)}.` : ''}`, r.outcome === 'busted' ? '🚓' : '💰');
    },
    SPLIT_PROPOSE() {
      const x = S.x; const sp = x.split;
      if (!x.isPlanner) return tv(`${esc(x.heist.planner.name)} is splitting ${inr(sp.pot)}.`, x.inCrew ? 'You will vote on it next.' : 'Watch the crew.', '💸');
      if (!splitDraft) { splitDraft = {}; sp.shares.forEach((p) => { splitDraft[p.id] = p.pct; }); }
      const sum = Object.values(splitDraft).reduce((a, b) => a + b, 0);
      const rows = sp.shares.map((p) => `<div class="sharerow"><span>${p.emoji} ${esc(p.name)}${p.id === S.me.id ? ' (you)' : ''}</span><button class="btn sm" data-a="share" data-id="${p.id}" data-d="-5">−5</button><b>${splitDraft[p.id]}%</b><button class="btn sm" data-a="share" data-id="${p.id}" data-d="5">+5</button></div><div class="small muted" style="text-align:right;margin-top:-.4rem">${inr((sp.pot * splitDraft[p.id]) / 100)}</div>`).join('');
      return `<h2 class="t1">Split ${inr(sp.pot)}</h2><p class="lead">The crew votes on your plan. If they reject it, everyone gets an equal share. Greedy plans make people grab.</p>
        <div class="card" style="display:grid;gap:.7rem">${rows}<div class="sum ${sum === 100 ? 'green' : 'red'}">Total ${sum}%</div></div>
        <button class="btn primary big" data-a="propose" ${sum === 100 ? '' : 'disabled'}>Propose this split</button>`;
    },
    SPLIT_VOTE() {
      const x = S.x; const sp = x.split;
      const rows = sp.shares.map((p) => `<div class="kv"><span>${p.emoji} ${esc(p.name)}</span><b>${p.pct}%</b></div>`).join('');
      if (!x.canVote) return `${tv('The crew is voting.', '', '🗳️')}<div class="card">${rows}</div>`;
      if (x.voted) return tv('Vote cast.', 'Waiting for the rest of the crew.', '🗳️');
      return `<h2 class="t1">Accept this split?</h2><div class="card" style="display:grid;gap:.5rem">${rows}</div><p class="lead">If the majority says no, everyone gets an equal share.</p>
        <div class="row2"><button class="btn green big" data-a="vote" data-yes="1">Accept</button><button class="btn danger big" data-a="vote" data-yes="0">Reject</button></div>`;
    },
    SPLIT_CHOICE() {
      const x = S.x;
      if (!x.inCrew) return tv('Honour or grab?', 'The crew is deciding in secret.', '🤝');
      if (x.choice) return tv(x.choice === 'grab' ? 'You chose to grab.' : 'You chose honour.', 'Keep a straight face.', x.choice === 'grab' ? '😈' : '🤝');
      const mine = x.split.shares.find((p) => p.id === S.me.id);
      return `<h2 class="t1">Honour or grab?</h2><p class="lead">Your agreed share is ${mine.pct}% (${inr((x.split.pot * mine.pct) / 100)}).</p>
        <div class="choicebtns"><button class="btn green" data-a="choice" data-grab="0"><b>Honour</b><span>Take your agreed share.</span></button>
        <button class="btn danger" data-a="choice" data-grab="1"><b>Grab</b><span>If you are the only one, you take double. If anyone else grabs too, a fight breaks out and 40% is lost.</span></button></div>`;
    },
    SPLIT_RESULT() { return tv('The reveal.', 'Look at the TV.', '🎴'); },
    PAPER() { return tv('The morning paper is out.', 'Read it on the TV.', '📰'); },
    RAIDS() { return tv('Police raids.', 'Check the TV, and your cash.', '🚓'); },
    RAT_VOTE() {
      const x = S.x;
      const opts = [...x.options.map((p) => ({ id: p.id, label: `${p.emoji} ${esc(p.name)}` })), { id: 'none', label: '🧀 There is no Rat' }];
      return `<h2 class="t1">Who is the Rat?</h2><p class="lead">A right guess pays ₹3 lakh. A wrong one costs ₹2 lakh. Catch a Rat and they lose half their cash.</p>
        ${S.me.isRat ? '<div class="ratbox"><b>You are a Rat.</b> Vote like an innocent person would.</div>' : ''}
        <div class="pick">${opts.map((o) => `<button data-a="ratVote" data-id="${o.id}" class="${x.myVote === o.id ? 'on' : ''}">${o.label}</button>`).join('')}</div>${x.myVote ? '<p class="lead small center">Vote saved. You can change it until time runs out.</p>' : ''}`;
    },
    GUESS() {
      const x = S.x;
      const ev = {}; (x.myEvidence || []).forEach((id) => { ev[id] = (ev[id] || 0) + 1; });
      const hints = S.hints || [];
      const list = S.suspects.map((s) => {
        const sub = [s.title, ev[s.id] ? `You hold ${ev[s.id]} piece${ev[s.id] > 1 ? 's' : ''} of evidence` : '', s.cleared ? 'Has an alibi' : '', hints.includes(s.id) ? 'You found proof he is innocent' : ''].filter(Boolean).join('. ');
        return `<button data-a="guess" data-id="${s.id}" class="${x.myGuess === s.id ? 'on' : ''}"><span class="em">${s.emoji}</span><span>${esc(s.name)}<span class="sub">${esc(sub)}</span></span></button>`;
      }).join('');
      return `<h2 class="t1">Who is the Godfather?</h2><p class="lead">The real Godfather left the most evidence behind. Others may have heard what you found. Or been lied to. A right guess pays ₹15 lakh.</p><div class="pick">${list}</div>`;
    },
    REVEAL_RAT() { return tv('The Rat is revealed.', 'Look at the TV.', '🐀'); },
    REVEAL_GODFATHER() { return tv('The Godfather speaks.', 'Look at the TV.', '🎩'); },
    REVEAL_MISSIONS() { return tv('Secret missions.', 'Look at the TV.', '📜'); },
    FINAL() {
      const me = S.x.rows.find((r) => r.id === S.me.id);
      if (!me) return tv('Game over.');
      return `<div class="card center"><div class="muted">You finished</div><div class="rank">#${me.rank}</div><div class="muted">of ${S.x.rows.length}</div></div>
        <div class="card kv"><span>Cash</span><b>${inr(me.cash)}</b><span>Items you kept</span><b>${inr(me.items)}</b>${me.seized ? `<span>Hot goods seized</span><b class="red">${inr(me.seized)}</b>` : ''}<span>Total</span><b>${inr(me.total)}</b></div>
        ${me.best ? `<p class="lead">Best item you kept: ${esc(me.best)}</p>` : ''}
        ${S.me.vip ? '<button class="btn primary big" data-a="again">Play again</button>' : `<p class="lead center">${esc(vipName())} can start another game.</p>`}`;
    },
  };

  // ---------------------------------------------------------------- sheets
  function sheetHtml() {
    if (sheet === 'bag') {
      const items = S.inv.length ? S.inv.map((it) => itemCard(it, 'bag')).join('') : '<p class="lead">Empty. For now.</p>';
      return `<div class="hd"><h3>Your bag</h3><button class="btn sm" data-a="close">Close</button></div><p class="lead small">Estimates are what things look like. Appraise during the market to learn the truth.</p><div class="items">${items}</div>`;
    }
    if (sheet === 'secret') {
      const m = S.me;
      const rat = m.isRat ? `<div class="ratbox"><b>You are a Rat.</b> You secretly work for the police. Every time a player is raided or a crew is busted, your handler pays you ₹3 lakh. At the end, if the others catch you, you lose half your cash.${m.ratPartners?.length ? ` The other Rat is ${esc(m.ratPartners.join(', '))}.` : ''}</div>` : '<div class="card">You are not a Rat. But someone might be.</div>';
      const sus = (S.suspects || []).map((s) => `<div class="kv"><span>${s.emoji} ${esc(s.name)}</span><span class="muted">${s.cleared ? 'Alibi' : (S.hints || []).includes(s.id) ? 'Innocent (your proof)' : ''}</span></div>`).join('');
      return `<div class="hd"><h3>Only for you</h3><button class="btn sm" data-a="close">Close</button></div>
        <div class="card amb"><b>Secret mission (₹5 lakh)</b><p class="lead" style="color:inherit;margin-top:.3rem">${esc(m.mission || 'You get a mission when the game starts.')}</p></div>${S.phase !== 'LOBBY' ? rat : ''}
        ${sus ? `<div class="card"><b>The suspects</b><p class="lead small">One of them is the Godfather. Evidence in the godowns points to him.</p><div style="display:grid;gap:.4rem;margin-top:.6rem">${sus}</div></div>` : ''}`;
    }
    if (sheet === 'offer') {
      const it = S.inv.find((i) => i.uid === offerDraft?.uid);
      if (!it || S.phase !== 'MARKET') { sheet = null; return ''; }
      const others = S.players.filter((p) => p.id !== S.me.id && p.connected);
      const chips = [10000, 50000, 100000, 300000, 500000, 1000000].map((v) => `<button class="btn sm" data-a="price" data-v="${v}">${inrS(v)}</button>`).join('');
      return `<div class="hd"><h3>Sell to a player</h3><button class="btn sm" data-a="close">Close</button></div>
        <div class="it"><div class="top"><div class="nm">${esc(it.name)}</div>${it.kind === 'item' ? `<div class="v">Est. ${inr(it.est)}</div>` : ''}</div></div>
        <p class="lead small">They only see the name and the estimate. Whether it is real is your little secret.</p>
        <div class="pick">${others.map((p) => `<button data-a="offerTo" data-id="${p.id}" class="${offerDraft.to === p.id ? 'on' : ''}"><span class="em">${p.emoji}</span>${esc(p.name)}</button>`).join('')}</div>
        <label>Price in rupees<input id="offerPrice" inputmode="numeric" value="${offerDraft.price || ''}" placeholder="50000"></label>
        <div class="pricechips">${chips}</div>
        <button class="btn primary big" data-a="offerSend">Send offer</button>`;
    }
    if (sheet === 'rumour') {
      return `<div class="hd"><h3>Whisper a rumour</h3><button class="btn sm" data-a="close">Close</button></div><p class="lead small">It shows on the TV with no name. One per auction. True or false is up to you.</p>
        <div class="pick">${(S.x.rumourList || []).map((r, i) => `<button data-a="rumour" data-i="${i}">${esc(r)}</button>`).join('')}</div>`;
    }
    return '';
  }
  function openSheet(name) { sheet = name; renderSheet(); }
  function renderSheet() {
    if (sheet === 'offer') { const keep = document.getElementById('offerPrice'); if (keep && offerDraft) offerDraft.price = keep.value; }
    const html = sheet ? sheetHtml() : '';
    if (!sheet) { sheetWrap.hidden = true; sheetEl.__html = ''; return; }
    sheetWrap.hidden = false;
    mount(sheetEl, html);
  }
  sheetWrap.querySelector('.scrim').onclick = () => { sheet = null; renderSheet(); };

  // ---------------------------------------------------------------- render
  function render() {
    if (!S.me) return;
    mount(hud, hudHtml());
    const fn = R[S.phase];
    const changed = mount(main, fn ? fn() : tv(S.phase));
    $('#bagN').textContent = S.inv.length ? `(${S.inv.length})` : '';
    if (sheet && sheet !== 'offer') renderSheet();
    if (sheet === 'offer' && (S.phase !== 'MARKET' || !S.inv.some((i) => i.uid === offerDraft?.uid))) { sheet = null; renderSheet(); }
    if (sheet === 'rumour' && (S.phase !== 'AUCTION' || !S.x.canRumour)) { sheet = null; renderSheet(); }
    if (S.phase === 'HEIST_LIVE') liveAfter(changed);
  }

  function onPhase() {
    crewSel = new Set(); splitDraft = null; hackBuf = '';
    if (S.phase === 'HEIST_LIVE') dialVal = Math.floor(Math.random() * 100);
    buzz(25);
    window.scrollTo(0, 0);
  }

  function effects() {
    if (!P || !S.x || !P.x) return;
    if (S.phase === 'AUCTION' && P.phase === 'AUCTION' && P.x.isHigh && !S.x.isHigh) { toast(`Outbid by ${S.x.auction.bidder?.name || 'someone'}!`, 'bad'); }
    if (S.phase === 'HEIST_LIVE' && S.x.live) {
      const l = S.x.live;
      if (l.signal && l.signal.id !== lastSig) {
        const first = lastSig === null && P.phase !== 'HEIST_LIVE';
        lastSig = l.signal.id;
        if (!first && S.x.role && S.x.role !== 'lookout') {
          const f = $('#sigflash'); f.textContent = l.signal.sig === 'stop' ? 'STOP' : 'GO'; f.style.background = l.signal.sig === 'stop' ? 'rgba(194,73,47,.85)' : 'rgba(47,125,99,.85)';
          f.classList.remove('show'); void f.offsetWidth; f.classList.add('show');
          buzz(l.signal.sig === 'stop' ? [200] : [40]);
        }
      }
      const lights = !!l.car?.lights;
      if (lights && !lastLights) { buzz([300, 100, 300]); F.sfx.alarm(); }
      lastLights = lights;
      if (l.flash && (!P.x.live || !P.x.live.flash || P.x.live.flash.id !== l.flash.id) && S.x.role) { if (l.flash.good) F.sfx.good(); else { F.sfx.bad(); buzz([80, 40, 80]); } }
    }
  }

  // ---------------------------------------------------------------- heist interactivity
  let dialBound = null;
  function liveAfter() {
    const l = S.x.live;
    const pa = document.getElementById('pa'); const pan = document.getElementById('pan');
    if (pa) { pa.style.width = `${l.alarm}%`; pa.style.background = l.alarm >= 70 ? 'var(--laterite)' : l.alarm >= 40 ? 'var(--amber)' : 'var(--good)'; }
    if (pan) pan.textContent = l.alarm;
    const ent = document.getElementById('entered'); if (ent) ent.textContent = hackBuf;
    const dial = document.getElementById('dial');
    if (dial && dialBound !== dial) { dialBound = dial; bindDial(dial); }
    setDial(dialVal, true);
  }
  function setDial(v, quiet) {
    dialVal = ((Math.round(v) % 100) + 100) % 100;
    const knob = document.getElementById('knob'); const val = document.getElementById('dialVal'); const lis = document.getElementById('listen');
    if (knob) knob.style.transform = `rotate(${dialVal * 3.6}deg)`;
    if (val) val.textContent = dialVal;
    const target = S?.x?.live?.target;
    if (lis && typeof target === 'number') {
      const d = Math.min(Math.abs(dialVal - target), 100 - Math.abs(dialVal - target));
      const close = Math.max(0, 1 - d / 16);
      lis.style.width = `${Math.round(close * 100)}%`;
      if (!quiet) {
        if (d <= 2) { buzz(45); F.sfx.click(0.25); } else if (d <= 7) { buzz(12); F.sfx.click(0.1); } else F.sfx.click(0.03);
      }
    }
  }
  function bindDial(dial) {
    let last = null;
    const ang = (e) => { const r = dial.getBoundingClientRect(); const x = e.clientX - (r.left + r.width / 2); const y = e.clientY - (r.top + r.height / 2); let a = (Math.atan2(y, x) * 180) / Math.PI + 90; if (a < 0) a += 360; return a; };
    dial.addEventListener('pointerdown', (e) => { dial.setPointerCapture(e.pointerId); last = ang(e); e.preventDefault(); });
    dial.addEventListener('pointermove', (e) => {
      if (last === null) return;
      const a = ang(e); let delta = a - last; if (delta > 180) delta -= 360; if (delta < -180) delta += 360;
      const steps = Math.trunc(delta / 3.6);
      if (steps !== 0) { last += steps * 3.6; setDial(dialVal + steps); }
    });
    const up = () => { last = null; };
    dial.addEventListener('pointerup', up); dial.addEventListener('pointercancel', up);
  }
  // hide the hacker's code once its time is up
  setInterval(() => {
    const c = document.getElementById('code');
    if (c && !c.classList.contains('hidden') && F.left(Number(c.dataset.until)) <= 0) { c.classList.add('hidden'); c.innerHTML = '<span>?</span><span>?</span><span>?</span><span>?</span>'; }
  }, 100);

  // ---------------------------------------------------------------- clicks
  $('#tBag').onclick = () => openSheet('bag');
  $('#tSecret').onclick = () => openSheet('secret');
  document.addEventListener('click', (e) => {
    const b = e.target.closest('[data-a]'); if (!b || b.disabled) return;
    const d = b.dataset; F.ac();
    switch (d.a) {
      case 'start': send('start'); break;
      case 'skip': send('skip'); break;
      case 'again': send('again'); break;
      case 'bid': send('bid', { inc: Number(d.inc) }); F.sfx.bid(); buzz(20); break;
      case 'sheet': openSheet(d.s); break;
      case 'close': sheet = null; renderSheet(); break;
      case 'rumour': send('rumour', { idx: Number(d.i) }); sheet = null; renderSheet(); toast('Rumour whispered.', 'good'); break;
      case 'reveal': send('reveal', { uid: d.uid }); break;
      case 'openDone': send('openDone'); break;
      case 'sell': send('sell', { uid: d.uid }); break;
      case 'chacko': send('chacko', { uid: d.uid }); break;
      case 'appraise': send('appraise', { uid: d.uid }); break;
      case 'sellSet': send('sellSet', { key: d.key }); break;
      case 'sellJunk': send('sellJunk'); break;
      case 'bribe': send('bribe'); break;
      case 'done': send('done'); break;
      case 'respond': send('respond', { id: d.id, accept: d.ok === '1' }); break;
      case 'offerOpen': offerDraft = { uid: d.uid, to: null, price: '' }; openSheet('offer'); break;
      case 'offerTo': offerDraft.price = document.getElementById('offerPrice')?.value || ''; offerDraft.to = d.id; renderSheet(); break;
      case 'price': { const i = document.getElementById('offerPrice'); if (i) i.value = d.v; offerDraft.price = d.v; break; }
      case 'offerSend': {
        const price = Number((document.getElementById('offerPrice')?.value || '').replace(/[^0-9]/g, ''));
        if (!offerDraft.to) { toast('Pick who to sell to.', 'bad'); break; }
        if (!(price >= 0) || document.getElementById('offerPrice').value === '') { toast('Enter a price.', 'bad'); break; }
        send('offer', { uid: offerDraft.uid, to: offerDraft.to, price }); sheet = null; renderSheet(); toast('Offer sent.', 'good'); break;
      }
      case 'crewToggle': { if (crewSel.has(d.id)) crewSel.delete(d.id); else if (crewSel.size < S.x.maxCrew) crewSel.add(d.id); else toast(`You can take ${S.x.maxCrew} at most.`, 'bad'); render(); break; }
      case 'crew': send('crew', { ids: [...crewSel] }); break;
      case 'tip': send('tip', { yes: d.yes === '1' }); break;
      case 'signal': send('signal', { sig: d.sig }); buzz(30); break;
      case 'glyph': { hackBuf += d.g; F.sfx.click(0.12); if (hackBuf.length >= 4) { send('hack', { code: hackBuf }); hackBuf = ''; } const ent = document.getElementById('entered'); if (ent) ent.textContent = hackBuf; break; }
      case 'clearHack': hackBuf = ''; { const ent = document.getElementById('entered'); if (ent) ent.textContent = ''; } break;
      case 'hackPeek': send('hackPeek'); break;
      case 'dial': setDial(dialVal + Number(d.d)); break;
      case 'safe': send('safe', { val: dialVal }); break;
      case 'hide': send('hide'); break;
      case 'route': send('route', { i: Number(d.i) }); break;
      case 'share': { splitDraft[d.id] = Math.max(0, Math.min(100, (splitDraft[d.id] || 0) + Number(d.d))); render(); break; }
      case 'propose': send('propose', { shares: splitDraft }); break;
      case 'vote': send('vote', { yes: d.yes === '1' }); break;
      case 'choice': send('choice', { grab: d.grab === '1' }); break;
      case 'ratVote': send('ratVote', { target: d.id }); break;
      case 'guess': send('guess', { sid: d.id }); break;
      default:
    }
  });
})();
