(function (g) {
'use strict';
const O = t => (t === 'A' ? 'B' : 'A'), R = ['I', 'II', 'III', 'IV', 'V', 'VI'], BACK = [1, 5, 6];
const DEF = { bestOf: 3, setTo: 25, decTo: 15, winBy: 2, subLimit: null, timeouts: 2 }; // changeSides has NO default: it must be chosen explicitly
const fail = m => { throw new Error(m); };
const hhmm = () => new Date().toTimeString().slice(0, 5); // S1.4: HH:MM, 24-hour
const pos = (t, i) => ((i - t.p1 + 6) % 6) + 1;
const mk = (lu, lib, first) => {
  const home = {}; lu.forEach((p, i) => (home[p] = i));
  return { slot: [...lu], start: [...lu], p1: 0, score: 0, pts: [], rounds: [first ? { slot: 0 } : { slot: 0, x: 1 }],
    to: [], subs: [], lib, libOn: null, libFor: null, libServe: null, lastLib: -1, home, bar: [] };
};
const setPoint = (M, S) => ['A', 'B'].filter(t => { const x = S.t[t].score + 1; return x >= S.target && x - S.t[O(t)].score >= M.cfg.winBy; });

function apply(M, e) {
  const S = M.cur, nm = t => M.names[t], ent = { time: e.time, t: e.t, text: '', write: [], warn: [] };
  const W = s => ent.write.push(s);
  if (e.t === 'setup') {
    if (typeof M.cfg.changeSides !== 'boolean') fail('Choose whether teams change sides in the deciding set (match settings).');
    if (M.over) fail('The match is over.');
    if (S && !S.over) fail('Finish the current set first.');
    for (const t of ['A', 'B']) {
      const l = e.lineup[t], all = [...l, ...e.lib[t]];
      if (l.length !== 6) fail(`${nm(t)}: enter exactly 6 starting numbers.`);
      const both = e.lib[t].find(n => l.includes(n));
      if (both != null) fail(`${nm(t)}: #${both} is entered as both a starter and a Libero. A Libero is never one of the six starters: list the 6 players who start the set, and enter the Libero only in the Libero box (they replace a back-row player later).`);
      if (all.some(x => !Number.isInteger(x) || x < 0 || x > 99)) fail(`${nm(t)}: use whole numbers from 0 to 99.`);
      if (new Set(all).size !== all.length) fail(`${nm(t)}: a number appears twice.`);
      if (e.cap && e.cap[t] != null && (!Number.isInteger(e.cap[t]) || e.cap[t] < 0 || e.cap[t] > 99)) fail(`${nm(t)}: captain must be a whole number 0 to 99, or blank.`);
      const ct = e.capTeam && e.capTeam[t]; if (ct != null && ct !== 'X' && !(Number.isInteger(ct) && ct >= 0 && ct <= 99)) fail(`${nm(t)}: team captain must be a number 0 to 99, an X, or blank.`);
      const ca = (e.capAlt && e.capAlt[t]) || []; if (ca.length > 6 || ca.some(x => !Number.isInteger(x) || x < 0 || x > 99)) fail(`${nm(t)}: alternate captains: up to 6 whole numbers.`);
      if (e.lib[t].length > 2) fail(`${nm(t)}: at most 2 Liberos.`);
    }
    const n = M.sets.length + 1, dec = n === M.cfg.bestOf;
    const S2 = { n, dec, target: dec ? M.cfg.decTo : M.cfg.setTo, left: e.left, srv: e.serve, over: null, rallyN: 0, changed: false, sanc: [], sx: [], rem: [], start: e.time, cap: e.cap || {}, capTeam: e.capTeam || {}, capAlt: e.capAlt || {},
      t: { A: mk(e.lineup.A, e.lib.A, e.serve === 'A'), B: mk(e.lineup.B, e.lib.B, e.serve === 'B') } };
    M.sets.push(S2); M.cur = S2; ent.text = `Set ${n} setup`;
    const rc = O(e.serve);
    W(`Set box: ${n}${dec ? (M.cfg.changeSides ? ' (teams change courts: use the DECIDING-set sheet with LEFT / MIDDLE / RIGHT sections)' : ' (no court change: use a regular sheet, or only the two right-hand panels of a deciding sheet)') : ''}`);
    W(`Team info: ${nm(e.left)} on the LEFT court, ${nm(O(e.left))} on the RIGHT`);
    W(`X through the S circle for ${nm(e.serve)} (serves first). X through the R circle for ${nm(rc)}.`);
    W(`X in Service Round box 1 for ${nm(rc)}'s Service Order I player (#${e.lineup[rc][0]})`);
    for (const t of ['A', 'B']) W(`${nm(t)} Service Order I to VI: ${e.lineup[t].join(', ')}${e.lib[t].length ? ` · Libero: ${e.lib[t].join(', ')}` : ' · X in empty Libero boxes'}`);
    if (n > 1 && M.notes.length) W('Copy onto this sheet: ' + M.notes.join('; '));
    W(`Start time ${e.time} (write it when the 1st referee whistles the first serve)`);
    return M.log.push(ent);
  }
  if (e.t === 'forfeit') {
    if (M.over) fail('The match is over.');
    if (S && !S.over) fail('A set is in progress. A forfeit can only be recorded before a set starts. Use a Remark for anything else.');
    const f = e.team, w = O(f), more = e.scope === 'match';
    ent.text = `${nm(f)} forfeits ${more ? 'the match' : 'the set'}`;
    do {
      const k = M.sets.length + 1, dec = k === M.cfg.bestOf, target = dec ? M.cfg.decTo : M.cfg.setTo, emp = () => { const q = mk(['', '', '', '', '', ''], [], false); q.rounds = []; return q; };
      const F = { n: k, dec, target, left: dec || k % 2 ? 'A' : 'B', srv: w, over: w, rallyN: 0, changed: false, sanc: [], sx: [], start: '', end: '', cap: {}, capTeam: {}, capAlt: {},
        forfeit: { team: f }, t: { A: emp(), B: emp() }, rem: [`SET ${k} FORFEITED BY ${nm(f)}${e.reason ? ': ' + e.reason : ''}`] };
      M.sets.push(F); M.cur = F; M.won[w]++;
      W(`Set ${k}: fill in the heading, officials, and the line-up of any team that is present. Write FORFEIT across the scoring section.`);
      W(`Set Results: winning team ${nm(w)} score ${target}; losing team ${nm(f)} score 0.`);
      W(`Remarks: ${F.rem[0]} (add comments about the circumstances).`);
      if (M.won[w] >= Math.ceil(M.cfg.bestOf / 2)) { M.over = w; W(`MATCH OVER: ${nm(w)} wins ${M.won[w]}-${M.won[f]}. Write the winner and sets won/lost; the 1st referee signs.`); }
    } while (more && !M.over);
    return M.log.push(ent);
  }
  if (!S || S.over) fail('Start a set first.');
  const T = e.team && S.t[e.team];
  const pt = (t, o) => { const x = S.t[t]; x.pts.push({ pen: !!o.pen, lib: !!o.lib }); x.score++; };
  const finish = t => {
    S.over = t; M.won[t]++; S.end = e.time;
    const w = S.t[t], l = S.t[O(t)], rd = w.rounds[w.rounds.length - 1]; rd.exit = w.score;
    W(`Slash final point ${w.score} for ${nm(t)}${w.pts[w.score - 1].pen ? ' and circle it (penalty point)' : ' (do not circle it)'}. Cross forearms to signal end of set.`);
    W(`Final exit score ${w.score} in ${nm(t)}'s next Service Round box${rd.chk ? '' : ' (no check mark)'}; circle each team's final exit score`);
    W(`End time ${e.time}. T-bar: line under the last point and a line through all unused numbers (both teams).`);
    W(`Set Results: winner ${nm(t)} ${w.score}, loser ${nm(O(t))} ${l.score}. Review the sheet: start/end times, sub counts, scores all agree.`);
    if (M.won[t] >= Math.ceil(M.cfg.bestOf / 2)) { M.over = t; W(`MATCH OVER: ${nm(t)} won ${M.won[t]}-${M.won[O(t)]}. Write the winner and sets won/lost on every sheet; the 1st referee signs.`); }
  };
  const rally = (w, o = {}) => {
    const s = S.srv, r = O(s), a = S.t[s], b = S.t[r], rd = a.rounds[a.rounds.length - 1];
    const num = a.slot[a.p1], isL = a.lib.includes(num), served = !o.fault && !o.pen, circ = o.pen ? ' and circle it (penalty point)' : '';
    for (const t of [a, b]) if (t.libOn != null && !BACK.includes(pos(t, t.libOn))) ent.warn.push('A Libero is in the front row. Tell the 2nd referee now.');
    if (served && !rd.chk) { rd.chk = 1; W(`Small check mark in ${nm(s)}'s Service Round box for #${num} (${R[a.p1]})`); }
    if (served && isL) {
      if (a.libServe == null) { a.libServe = a.p1; W(`Draw a triangle around Roman numeral ${R[a.p1]} in ${nm(s)}'s Service Order (Libero's first serve)`); }
      else if (a.libServe !== a.p1) ent.warn.push(`Libero #${num} already served from position ${R[a.libServe]}. A Libero may serve from one position only per set; tell the 2nd referee.`);
    }
    let last;
    if (w === s) { pt(s, { pen: o.pen, lib: served && isL }); W(`Slash ${nm(s)} point ${a.score} in the Points column${served && isL ? ', then draw a triangle around it' : ''}${circ}`); last = s; }
    else {
      if (o.fault === 'wrong' && o.removed) {
        const k = o.removed; if (k < 0 || k > a.score) fail(`${nm(s)} only has ${a.score} points.`);
        const from = a.score - k + 1; a.pts.splice(a.pts.length - k, k); a.score -= k;
        W(`Cross out ${nm(s)} points ${from} to ${from + k - 1} with an X (incorrect info). Add a Remark. If any removed point was a penalty point, it must be restored.`);
      }
      rd.exit = a.score; W(`Write exit score ${a.score} in ${nm(s)}'s Service Round box for #${a.start[rd.slot]}`);
      S.srv = r; b.p1 = (b.p1 + 1) % 6; b.rounds.push({ slot: b.p1 });
      pt(r, { pen: o.pen }); W(`Slash ${nm(r)} point ${b.score} in the Points column${circ}`); last = r;
    }
    S.rallyN++;
    if (S.dec && M.cfg.changeSides && !S.changed && Math.max(a.score, b.score) >= Math.floor(S.target / 2) + 1) {
      S.changed = true; const x = S.t[S.left], ex = [...x.rounds].reverse().find(q => q.exit != null);
      S.chg = { score: x.score, k: x.rounds.length, anchor: ex ? ex.exit : 'X', subsN: x.subs.length, toN: x.to.length };
      ent.warn.push('COURT CHANGE POINT: tell the 2nd referee. Teams switch sides and scoreboards switch.');
      W(`Deciding sheet: for ${nm(S.left)} (started left) write ${x.score} in the "Points at Chg" circle on the RIGHT section; anchor point = ${ex ? ex.exit : 'X'} (last exit score, or X if they haven't served). No check mark. The LEFT section is no longer used.`);
    }
    const x = S.t[last]; if (x.score >= S.target && x.score - S.t[O(last)].score >= M.cfg.winBy) finish(last);
  };
  const sc = () => T ? `${T.score}:${S.t[O(e.team)].score}` : '';
  if (e.t === 'rally') { rally(e.w); ent.text = `${nm(e.w)} won the rally`; }
  else if (e.t === 'fault') { rally(O(S.srv), { fault: e.kind, removed: e.removed }); ent.text = `${nm(O(S.srv))} got service after a ${e.kind === 'time' ? 'time violation' : 'wrong server'} fault`; }
  else if (e.t === 'to') {
    if (T.to.length >= M.cfg.timeouts) fail(`${nm(e.team)} already used ${M.cfg.timeouts} time-outs this set.`);
    const s = sc(); T.to.push(s); ent.text = `${nm(e.team)} time-out`;
    W(`Write ${s} in ${nm(e.team)}'s Time-out box ${T.to.length} (${T.to.length === 1 ? 'top' : 'lower'}). Score is written with the calling team first.`);
    W('Show the 2nd referee how many time-outs each team has used.');
  } else if (e.t === 'sub') {
    const i = T.slot.indexOf(e.out), n = e.in;
    if (i < 0) fail(`#${e.out} is not on the court for ${nm(e.team)}. (A Libero may have replaced them.)`);
    if (T.lib.includes(e.out)) fail('That Libero is on the court. Use Libero swap instead.');
    if (T.lib.includes(n)) fail('A Libero is not a substitute. Use Libero swap.');
    if (T.slot.includes(n)) fail(`#${n} is already on the court.`);
    if (T.bar.includes(n) || M.out[e.team].includes(n)) fail(`#${n} cannot play (expelled this set, disqualified, or replaced by an exceptional substitute).`);
    if (T.home[n] != null && T.home[n] !== i) fail(`#${n} can only enter in position ${R[T.home[n]]} (the spot they played before).`);
    const used = T.subs.filter(q => !q.exc).length;
    if (!e.exc && M.cfg.subLimit != null && used >= M.cfg.subLimit) fail(`Substitution limit reached (${M.cfg.subLimit} per set).`);
    const s = sc(); T.home[n] = i; T.slot[i] = n; T.subs.push({ slot: i, out: e.out, in: n, sc: s, exc: !!e.exc });
    if (e.exc) {
      M.out[e.team].push(e.out); const note = `EX SUB #${n} for #${e.out}, ${nm(e.team)}, set ${S.n}, ${s}`; M.notes.push(note); S.rem.push(note);
      ent.text = `${nm(e.team)} exceptional sub`;
      W(`Circle #${e.out} in Service Order or Score at Substitution. Write ${n} in the next sub box. NO score, do NOT slash the Substitutions row.`);
      W(`Remarks: ${note}. Copy it onto later sheets and circle #${e.out} in later Legal Substitutes.`);
    } else {
      ent.text = `${nm(e.team)} sub #${n} for #${e.out}`;
      W(`Under #${e.out} (${R[i]}) in Score at Substitution: ${n} in the left box, ${s} in the right box`);
      W(`Slash substitution number ${used + 1} in ${nm(e.team)}'s Substitutions row. Then show the READY signal to the 2nd referee.`);
    }
  } else if (e.t === 'lib') {
    if (S.rallyN <= T.lastLib) fail('A rally must be completed between Libero replacements.');
    if (e.dir === 'in') {
      const l = e.lib, i = T.slot.indexOf(e.other);
      if (!T.lib.includes(l)) fail(`#${l} is not a designated Libero.`);
      if (T.libOn != null) fail('A Libero is already on the court. Use "Libero comes out" first.');
      if (i < 0 || T.lib.includes(e.other)) fail(`#${e.other} is not a regular player on the court.`);
      if (!BACK.includes(pos(T, i))) fail(`#${e.other} is in the front row. A Libero may only replace a back-row player (positions I, VI, V).`);
      T.libOn = i; T.libFor = e.other; T.slot[i] = l; ent.text = `${nm(e.team)} Libero #${l} in for #${e.other}`;
    } else {
      if (T.libOn == null) fail('No Libero is on the court.');
      const i = T.libOn, l = T.slot[i], o = e.other, second = T.lib.find(x => x !== l);
      if (o !== T.libFor && o !== second) fail(`The Libero can only be replaced by #${T.libFor} (the player they replaced) or the second Libero.`);
      T.slot[i] = o; if (o === T.libFor) { T.libOn = null; T.libFor = null; }
      ent.text = `${nm(e.team)} Libero #${l} out, #${o} in`;
    }
    T.lastLib = S.rallyN; W('Nothing to write on the main sheet: Libero replacements go only on the Libero Control Sheet.');
  } else if (e.t === 'sanc') {
    const K = { delayWarn: ['Delay warning', 'W', 'D'], miscWarn: ['Misconduct warning', 'W'], delayPen: ['Delay penalty', 'P', 'D'], miscPen: ['Misconduct penalty', 'P'], expel: ['Expulsion', 'E'], dq: ['Disqualification', 'D'] };
    const [kn, col, fixed] = K[e.kind], who = String(e.who || '').trim().toUpperCase(), label = fixed || who, s = sc();
    if (!fixed && !who) fail('Enter the player number or bench code.');
    if (e.kind.endsWith('Warn')) { if (M.warn[e.team].includes(e.kind)) fail(`${nm(e.team)} already has a ${kn.toLowerCase()} this match. Only one is allowed.`); M.warn[e.team].push(e.kind); }
    const line = `${kn} ${label}, ${nm(e.team)}, set ${S.n}, ${s}`; S.sanc.push(line); S.sx.push({ col, label, t: e.team, n: S.n, sc: s }); M.notes.push(line); ent.text = line;
    W(`Sanctions box, ${col} column: ${label}; team ${nm(e.team)}; set ${S.n}; score ${s}. Copy onto later sheets.`);
    if (col === 'P') { if (S.srv === e.team) W('Penalty is against the serving team, so its exit score is recorded too.'); rally(O(e.team), { pen: 1 }); }
    if (e.kind === 'expel' || e.kind === 'dq') {
      const n = Number(who);
      if (Number.isInteger(n)) { if (e.kind === 'dq') M.out[e.team].push(n); else T.bar.push(n); W(`Circle #${n} in Service Order / Score at Substitution.`); if (T.lib.includes(n)) W('Also circle the Libero number next to the team name.'); }
      ent.warn.push('No point or loss of service. If that player is on the court, enter a substitution now (Exceptional if no legal sub).');
    }
  } else if (e.t === 'imp') { M.imp[e.team] = 1; const n = `Improper request ${nm(e.team)}`; M.notes.push(n); ent.text = n; W(`X over the ${e.team} in the Improper Request box. Copy onto later sheets.`); }
  else if (e.t === 'rem') { const n = `${e.text} (set ${S.n}, ${S.t.A.score}:${S.t.B.score})`; S.rem.push(n); ent.text = 'Remark'; W(`Remarks: ${n}`); }
  else fail('Unknown action.');
  M.log.push(ent);
}

function replay(m) {
  const M = { cfg: m.cfg, names: m.names, sets: [], cur: null, won: { A: 0, B: 0 }, log: [], out: { A: [], B: [] }, warn: { A: [], B: [] }, imp: {}, notes: [], over: null };
  for (const e of m.events) apply(M, e);
  return M;
}

// Everything the paper sheet shows, as plain data (the UI only draws this). L = team on the left court this set.
// For a deciding set with a court change, .dec has the three sections: left (LEFT), mid (MIDDLE), right (RIGHT).
function sheetModel(M, S) {
  const rt = r => (r.x ? 'X' : '') + (r.chk ? '\u2713' : '') + (r.exit != null ? r.exit : '');
  const side = (t, mode = 'full') => {
    const x = S.t[t], chg = mode === 'full' ? null : S.chg;
    const exs = x.rounds.filter(r => r.exit != null), lastEx = S.over && !S.forfeit && exs.length ? exs[exs.length - 1] : null;
    const lim = mode === 'left' && chg ? chg.subsN : Infinity;
    const subs = x.subs.map((u, j) => ({ ...u, j })).filter(u => u.j < lim);
    const toL = mode === 'left' && chg ? x.to.slice(0, chg.toN) : x.to;
    const order = x.start.map((n, i) => ({ roman: R[i], tri: x.libServe === i, start: n, circ: M.out[t].includes(n) || x.bar.includes(n) }));
    const subRows = [...Array(8)].map((_, r) => order.map((_, i) => {
      const sb = subs.filter(u => u.slot === i);
      if (r < 7) { const u = sb[r]; return u ? { in: u.in, sc: u.exc ? '' : u.sc, circ: subs.some(w => w.exc && w.slot === i && w.out === u.in && w.j > u.j) } : { in: '', sc: '', circ: false }; }
      const rest = sb.slice(7); return rest.length <= 1 ? (rest[0] ? { in: rest[0].in, sc: rest[0].exc ? '' : rest[0].sc, circ: false } : { in: '', sc: '', circ: false }) : { in: rest.map(w => w.in).join('/'), sc: rest.map(w => (w.exc ? '' : w.sc)).join(' '), circ: false };
    }));
    const items = i => {
      const rd = x.rounds.map((r, g) => ({ r, g })).filter(o => o.r.slot === i);
      if (mode === 'full' || (mode === 'left' && !chg)) return rd.map(o => ({ txt: rt(o.r), raw: o.r }));
      if (mode === 'left') return rd.filter(o => o.g < chg.k).map(o => ({ txt: o.g === chg.k - 1 ? rt({ ...o.r, exit: null }) : rt(o.r), raw: o.r }));
      if (!chg) return [];
      const s2 = x.rounds[chg.k - 1], L = [];
      if (s2.slot === i) L.push({ txt: String(chg.anchor) }, { txt: s2.exit != null ? String(s2.exit) : '', raw: s2 });
      return L.concat(rd.filter(o => o.g >= chg.k).map(o => ({ txt: rt(o.r), raw: o.r })));
    };
    const roundRows = [0, 1, 2].map(row => order.map((_, i) => { const it = items(i); return [0, 1].map(col => { const k = col * 3 + row, list = k === 5 ? it.slice(5) : it[k] ? [it[k]] : [];
      return { n: k + 1, txt: list.map(o => o.txt).join(' '), circ: lastEx != null && list.some(o => o.raw === lastEx) }; }); }));
    const vis = n => mode === 'full' || (mode === 'left' ? (chg ? n <= chg.score : true) : !!chg && n > chg.score);
    const pts = [...Array(Math.max(36, x.score))].map((_, k) => { const n = k + 1, p = x.pts[k]; let cls = '';
      if (!vis(n)) cls = mode === 'right' && !chg ? '' : 'gone';
      else if (p) cls = ['sl', p.pen && 'pn', p.lib && 'li'].filter(Boolean).join(' ');
      else if (S.over && !S.forfeit && mode !== 'left') cls = 'un';
      return { n, cls, tbar: !!S.over && !S.forfeit && mode !== 'left' && n === x.score }; });
    const alt = ((S.capAlt && S.capAlt[t]) || []).map(String); while (alt.length < 6) alt.push('');
    return { t, cap: S.cap && S.cap[t] != null ? String(S.cap[t]) : '', capSq: S.capTeam && S.capTeam[t] != null ? String(S.capTeam[t]) : '', capAlt: alt,
      libs: S.forfeit ? '' : x.lib.length ? x.lib.join(', ') : 'X', sX: !S.forfeit && !x.rounds[0].x, rX: !S.forfeit && !!x.rounds[0].x,
      order, subRows, roundRows, pts, to: [toL[0] || '', toL[1] || ''], used: subs.filter(u => !u.exc).length };
  };
  const W = S.over, wm = M.over;
  const res = !W ? null : S.forfeit ? { win: W, ws: S.target, lose: O(W), ls: 0, forfeit: true } : { win: W, ws: S.t[W].score, lose: O(W), ls: S.t[O(W)].score };
  return { n: S.n, L: side(S.left), R: side(O(S.left)), start: S.start || '', end: S.end || '', sx: S.sx, rem: S.rem, imp: { A: !!M.imp.A, B: !!M.imp.B },
    setScore: S.forfeit ? { A: W === 'A' ? S.target : 0, B: W === 'B' ? S.target : 0 } : { A: S.t.A.score, B: S.t.B.score }, result: res, forfeit: S.forfeit ? S.forfeit.team : null,
    dec: S.dec && M.cfg.changeSides && !S.forfeit ? { left: side(S.left, 'left'), mid: side(O(S.left), 'full'), right: side(S.left, 'right'), chg: S.chg ? S.chg.score : '' } : null,
    match: wm ? { team: wm, w: M.won[wm], l: M.won[O(wm)] } : null };
}
const api = { sheetModel, DEF, O, R, pos, setPoint, replay, hhmm };
if (typeof module !== 'undefined') module.exports = api; else g.E = api;
})(this);
