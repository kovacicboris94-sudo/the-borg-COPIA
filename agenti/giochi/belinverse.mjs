// Belinverse 2 giocato davvero dagli abitanti, con le regole del tavolo della Sala TCG.
// Il motore e' quello del gioco (src/minigiochi/belinverse/gioco.js) senza grafica e senza attese,
// trasformato in "rigiocabile": la partita e' un seme + le decisioni prese finora. Ogni volta si
// rigioca da capo (costa pochissimo) fino alla prossima scelta che tocca a un abitante.
// Le carte sono copiate in belinverse-carte.mjs.
import { CARTE, LEADER, PER_ID } from './belinverse-carte.mjs';

const MAX_TURNI = 60;
const NOMI_TIPO = { C: 'Character', E: 'Equipaggiamento', V: 'Evento', L: 'Belinone' };
let S = null, uidN = 1, R = Math.random, Q = null;
const rnd = n => Math.floor(R() * n);
const mescola = a => { for (let i = a.length - 1; i > 0; i--) { const j = rnd(i + 1); [a[i], a[j]] = [a[j], a[i]]; } return a; };
function seme(s) { let a = (s >>> 0) || 1; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
class Serve { constructor(i, req) { this.i = i; this.req = req; } }

// mazzo casuale ma giocabile (come il "mazzo in prestito" del gioco): ~24 Character con una curva di costi, 8 Equipaggiamenti, 8 Eventi
function mazzoCasuale() {
  const cont = {}, out = [];
  const prendi = (pool, n, peso) => {
    let guard = 0;
    while (n > 0 && guard++ < 2000) {
      pool = pool.filter(c => (cont[c.id] || 0) < 3); if (!pool.length) return;
      const tot = pool.reduce((s, c) => s + peso(c), 0); let r = R() * tot, c = pool[0];
      for (const x of pool) { r -= peso(x); if (r <= 0) { c = x; break; } }
      if ((cont[c.id] || 0) >= 2 && R() < 0.7) continue;
      cont[c.id] = (cont[c.id] || 0) + 1; out.push(c.id); n--;
    }
  };
  const PC = { 1: 6, 2: 8, 3: 8, 4: 6, 5: 4, 6: 2.2, 7: 1, 8: 0.8 };
  prendi(CARTE.filter(c => c.t === 'C'), 24, c => PC[c.c] || 1);
  prendi(CARTE.filter(c => c.t === 'E'), 8, () => 1);
  prendi(CARTE.filter(c => c.t === 'V'), 8, () => 1);
  return out;
}

/* ===================== IL MOTORE DEL GIOCO (copiato e reso sincrono) ===================== */
class Fine extends Error { }
const V = (p, tu, lui) => String(lui).replace(/dell'avversario/g, 'di ' + p.nome).replace(/L'avversario|l'avversario/g, p.nome).replace(' (avversario)', ' (' + p.nome + ')');

const nuovaIst = c => ({ uid: uidN++, c });
const avv = p => S.g[1 - p.i];
const pronte = p => p.tire - p.tireGirate;

function log(t) { S.log.push(t); if (S.log.length > 300) S.log.shift(); }

function potenza(p, ch) {
  let v = ch.c.p + ch.bonusT - ch.malusT + ch.comb;
  ch.eq.forEach(e => { v += e.c.bonus || 0; });
  const st = ch.c.stat;
  if (st && ((st.min && p.campo.length >= st.min) || (st.eq && ch.eq.length))) v += st.v;
  if (p.leader.c.passivo === 'costo1' && ch.c.c === 1) v += 500;
  return Math.max(0, v);
}
const ha = (ch, k) => !!((ch.c.kw && ch.c.kw[k]) || ch.eq.some(e => e.c.kw && e.c.kw[k]));
const puoAttaccare = (p, ch) => S.fase === 'attacchi' && S.att === p.i && p.nTurni > 1 && !ch.girato && (ch.entrato < S.turno || ha(ch, 'rush'));
const leaderPuoAttaccare = p => S.fase === 'attacchi' && S.att === p.i && p.nTurni > 1 && !p.leader.girato;
const leaderAbilUsabile = p => !!(p.leader.c.abil && p.leader.usato !== S.turno && pronte(p) >= p.leader.c.abil.costo);

function pesca(p, n) {
  let k = 0;
  for (let i = 0; i < n && p.mazzo.length; i++) { p.mano.push(p.mazzo.shift()); k++; }
  return k;
}
function perde(p, motivo) {
  S.fine = { vince: avv(p).i, motivo };
  log(p.nome + ' ha perso: ' + motivo);
  throw new Fine();
}
function perdiBelinata(p) {
  if (!p.belinate.length) perde(p, V(p, 'ti hanno colpito senza più Belinate', 'colpito senza più Belinate'));
  const c = p.belinate.shift(); p.mano.push(c);
  log(V(p, 'Perdi', 'L\'avversario perde') + ' una Belinata' + V(p, ': ' + c.c.n + ' va in mano', '') + ' (ne restano ' + p.belinate.length + ')');
}
function paga(p, n) { if (pronte(p) < n) return false; p.tireGirate += n; return true; }

// un Character lascia il campo (Bormida o mano): i suoi Equipaggiamenti vanno in Bormida
function lascia(p, ch, dove) {
  const i = p.campo.indexOf(ch); if (i < 0) return;
  p.campo.splice(i, 1);
  ch.eq.forEach(e => p.bormida.push(e)); ch.eq = [];
  const ist = { uid: ch.uid, c: ch.c };
  if (dove === 'mano') p.mano.push(ist); else p.bormida.push(ist);
}
// eliminazione (combattimento o effetto): Tasto Reset, effetti "quando viene eliminato", Belinone KingParis
function elimina(p, ch, causa) {
  if (p.campo.indexOf(ch) < 0) return false;
  if (causa === 'effetto' && ch.eq.some(e => e.c.noElimina)) return false;
  const reset = ch.eq.find(e => e.c.reset);
  if (reset) { ch.eq.splice(ch.eq.indexOf(reset), 1); p.bormida.push(reset); log(ch.c.n + ' resta in gioco grazie a ' + reset.c.n); return false; }
  const eqMorte = ch.eq.filter(e => e.c.morte);
  lascia(p, ch, 'bormida');
  log(ch.c.n + V(p, '', ' (avversario)') + ' è eliminato');
  if (ch.c.morte) esegui(p, ch.c.morte, ch);
  for (const e of eqMorte) esegui(p, e.c.morte, ch);
  if (p.leader.c.passivo === 'pescaMorte' && p.leader.morteUsata !== S.turno) { p.leader.morteUsata = S.turno; if (pesca(p, 1)) log(p.leader.c.n + ': ' + V(p, 'peschi', 'l\'avversario pesca') + ' 1 carta'); }
  return true;
}
// girare con un effetto: Occhiali (immune), Casco (torna pronto la prima volta per turno)
function giraEffetto(p, ch) {
  if (ch.eq.some(e => e.c.noGira)) return;
  if (ch.eq.some(e => e.c.casco) && ch.cascoUsato !== S.turno) { ch.cascoUsato = S.turno; log(ch.c.n + ': il Casco lo rimette pronto'); return; }
  ch.girato = true;
}

/* ---------- effetti ---------- */
function scegli(p, req) {
  if (!req.cand.length && !req.vuotoOk) return [];
  const r = p.ia ? IA.scegli(p, req) : scegliUmano(p, req);
  return r || [];
}
function scartaDa(p, n, titolo) {
  n = Math.min(n, p.mano.length); if (!n) return;
  const sc = scegli(p, { scopo: 'scarta', titolo: titolo || ('Scarta ' + n + ' carta' + (n > 1 ? 'e' : '')), cand: p.mano.slice(), min: n, max: n, tipo: 'mano' });
  sc.forEach(c => { const i = p.mano.indexOf(c); if (i >= 0) { p.mano.splice(i, 1); p.bormida.push(c); } });
  if (sc.length) log(V(p, 'Scarti ', 'L\'avversario scarta ') + sc.map(c => c.c.n).join(', '));
}
function esegui(p, fx, fonte) {
  const o = avv(p), nomeF = fonte ? fonte.c.n : '';
  for (const f of fx) {
    if (S.fine) return;
    switch (f.op) {
      case 'pesca': { const k = pesca(p, f.n); log(nomeF + ': ' + V(p, 'peschi ', 'l\'avversario pesca ') + k + ' carta' + (k === 1 ? '' : 'e')); break; }
      case 'scarta': scartaDa(p, f.n, nomeF + ': scarta 1 carta'); break;
      case 'avvScarta': scartaDa(o, 1, nomeF + ': devi scartare 1 carta'); break;
      case 'ogniAvvScarta': scartaDa(o, 1, nomeF + ': devi scartare 1 carta'); break;
      case 'avvBelinata': log(nomeF + ': ' + V(o, 'perdi', 'l\'avversario perde') + ' 1 Belinata'); perdiBelinata(o); break;
      case 'tire': { const k = Math.min(f.n, p.tireGirate); p.tireGirate -= k; log(nomeF + ': ' + k + ' Tir' + (k === 1 ? 'a torna pronta' : 'e tornano pronte')); break; }
      case 'gira': {
        const cand = o.campo.filter(ch => !ch.girato && ch.c.c <= f.max && !ch.eq.some(e => e.c.noGira));
        const k = Math.min(f.k, cand.length);
        const sel = scegli(p, { scopo: 'gira', titolo: nomeF + ': gira ' + (f.k > 1 ? 'fino a ' + f.k + ' Character' : 'un Character') + ' avversari' + (f.k > 1 ? '' : 'o') + (f.max < 99 ? ' (costo ' + f.max + ' o meno)' : ''), cand, min: f.k > 1 ? 0 : k, max: k, tipo: 'campo', di: o });
        sel.forEach(ch => giraEffetto(o, ch));
        if (sel.length) log(nomeF + ': gira ' + sel.map(c => c.c.n).join(', '));
        break;
      }
      case 'elimina': {
        const cand = o.campo.filter(ch => ch.c.c <= f.max && (!f.girato || ch.girato) && !ch.eq.some(e => e.c.noElimina));
        const k = Math.min(f.k, cand.length);
        const sel = scegli(p, { scopo: 'elimina', titolo: nomeF + ': elimina ' + (f.k > 1 ? 'fino a ' + f.k + ' Character' : 'un Character') + ' avversari' + (f.k > 1 ? '' : 'o') + (f.girato ? (f.k > 1 ? ' girati' : ' girato') : '') + ' (costo ' + f.max + ' o meno)', cand, min: f.k > 1 ? 0 : k, max: k, tipo: 'campo', di: o });
        for (const ch of sel) elimina(o, ch, 'effetto');
        break;
      }
      case 'eliminaTutti': {
        for (const q of [p, o]) for (const ch of q.campo.filter(ch => ch.girato && ch.c.c <= f.max)) elimina(q, ch, 'effetto');
        break;
      }
      case 'malus': {
        const sel = scegli(p, { scopo: 'malus', titolo: nomeF + ': un Character avversario perde ' + f.v + ' Potenza', cand: o.campo.slice(), min: 1, max: 1, tipo: 'campo', di: o });
        sel.forEach(ch => { ch.malusT += f.v; log(ch.c.n + ' perde ' + f.v + ' Potenza fino alla fine del turno'); });
        break;
      }
      case 'bonus': {
        const sel = scegli(p, { scopo: 'bonus', titolo: nomeF + ': un tuo Character guadagna +' + f.v + ' Potenza', cand: p.campo.slice(), min: 1, max: 1, tipo: 'campo', di: p, v: f.v });
        sel.forEach(ch => { ch.bonusT += f.v; log(ch.c.n + ' guadagna +' + f.v + ' Potenza fino alla fine del turno'); });
        break;
      }
      case 'bonusTutti': p.campo.forEach(ch => { ch.bonusT += f.v; }); log(nomeF + ': i Character ' + V(p, 'tuoi', 'avversari') + ' guadagnano +' + f.v); break;
      case 'riprendiC': case 'riprendiE': case 'riprendi': {
        const cand = p.bormida.filter(c => f.op === 'riprendi' || (f.op === 'riprendiE' ? c.c.t === 'E' : c.c.t === 'C' && c.c.c <= f.max));
        const sel = scegli(p, { scopo: 'riprendi', titolo: nomeF + ': riprendi dalla Bormida ' + (f.op === 'riprendiE' ? '1 Equipaggiamento' : f.op === 'riprendi' ? '1 carta' : 'un Character (costo ' + f.max + ' o meno)'), cand, min: cand.length ? 1 : 0, max: 1, tipo: 'carte' });
        sel.forEach(c => { p.bormida.splice(p.bormida.indexOf(c), 1); p.mano.push(c); log(nomeF + ': ' + V(p, 'riprendi ', 'l\'avversario riprende ') + c.c.n); });
        break;
      }
      case 'cerca': {
        const top = p.mazzo.splice(0, 5), cand = top.filter(c => c.c.t === f.tipo);
        const sel = scegli(p, { scopo: 'cerca', titolo: nomeF + ': prime 5 carte, prendi 1 ' + NOMI_TIPO[f.tipo], cand, min: cand.length ? 1 : 0, max: 1, tipo: 'carte', mostra: top });
        sel.forEach(c => { top.splice(top.indexOf(c), 1); p.mano.push(c); log(nomeF + ': ' + V(p, 'aggiungi ', 'l\'avversario aggiunge ') + c.c.n + ' alla mano'); });
        p.mazzo.push(...mescola(top));
        if (!sel.length) log(nomeF + ': nessun ' + NOMI_TIPO[f.tipo] + ' tra le prime 5');
        break;
      }
      case 'equipBormida': {
        const cand = p.bormida.filter(c => c.c.t === 'E' && c.c.c <= f.max), dest = p.campo.filter(ch => ch.eq.length < 2);
        if (!dest.length) break;
        const sel = scegli(p, { scopo: 'equipB', titolo: nomeF + ': scegli un Equipaggiamento dalla Bormida', cand, min: cand.length ? 1 : 0, max: 1, tipo: 'carte' });
        if (!sel.length) break;
        const ch = (scegli(p, { scopo: 'equipa', titolo: 'A chi assegni ' + sel[0].c.n + '?', cand: dest, min: 1, max: 1, tipo: 'campo', di: p, eq: sel[0].c }))[0];
        if (ch) { p.bormida.splice(p.bormida.indexOf(sel[0]), 1); ch.eq.push(sel[0]); log(sel[0].c.n + ' assegnato a ' + ch.c.n); }
        break;
      }
      case 'inMano': {
        const sel = scegli(p, { scopo: 'inMano', titolo: nomeF + ': rimetti in mano un tuo Character', cand: p.campo.slice(), min: 1, max: 1, tipo: 'campo', di: p });
        sel.forEach(ch => { lascia(p, ch, 'mano'); log(ch.c.n + ' torna in mano'); });
        break;
      }
    }
  }
}

/* ---------- giocare le carte ---------- */
function giocabile(p, c) {
  if (S.fine || S.att !== p.i || S.fase !== 'main') return false;
  if (pronte(p) < c.c.c) return false;
  if (c.c.t === 'E') return p.campo.some(ch => ch.eq.length < 2);
  if (c.c.t === 'V') return !c.c.reaz;
  return true;
}
function gioca(p, c, opz) {
  opz = opz || {};
  if (!giocabile(p, c)) return false;
  const card = c.c;
  if (card.t === 'C' && p.campo.length >= 5) {
    const via = opz.via || (scegli(p, { scopo: 'sacrifica', titolo: 'Hai già 5 Character: quale mandi in Bormida per fare spazio?', cand: p.campo.slice(), min: 0, max: 1, tipo: 'campo', di: p }))[0];
    if (!via) return false;
    lascia(p, via, 'bormida'); log(via.c.n + ' va in Bormida per fare spazio');
  }
  let dest = null;
  if (card.t === 'E') {
    dest = opz.su || (scegli(p, { scopo: 'equipa', titolo: 'A chi assegni ' + card.n + '?', cand: p.campo.filter(ch => ch.eq.length < 2), min: 0, max: 1, tipo: 'campo', di: p, eq: card }))[0];
    if (!dest) return false;
  }
  paga(p, card.c); p.mano.splice(p.mano.indexOf(c), 1);
  if (card.t === 'C') {
    const ch = { uid: c.uid, c: card, girato: false, entrato: S.turno, eq: [], bonusT: 0, malusT: 0, comb: 0, telUsato: -1, cascoUsato: -1 };
    p.campo.push(ch); log(V(p, 'Giochi ', 'L\'avversario gioca ') + card.n);
    if (card.etb) { esegui(p, card.etb, ch); }
  } else if (card.t === 'E') {
    dest.eq.push(c); log(V(p, 'Assegni ', 'L\'avversario assegna ') + card.n + ' a ' + dest.c.n);
  } else {
    log(V(p, 'Giochi ', 'L\'avversario gioca ') + card.n);
    esegui(p, card.fx, c); p.bormida.push(c);
  } return true;
}
function usaLeader(p) {
  if (!leaderAbilUsabile(p)) return false;
  paga(p, p.leader.c.abil.costo); p.leader.usato = S.turno;
  log(V(p, 'Usi ', 'L\'avversario usa ') + p.leader.c.n + ' (' + p.leader.c.abil.costo + ' Tir' + (p.leader.c.abil.costo === 1 ? 'a' : 'e') + ')');
  esegui(p, p.leader.c.abil.fx, p.leader); return true;
}

/* ---------- attacco e blocco ---------- */
function attacca(p, ch) {          // ch = Character, oppure null per il Belinone
  const d = avv(p), nomeA = ch ? ch.c.n : p.leader.c.n;
  if (ch) {
    if (!puoAttaccare(p, ch)) return false;
    ch.girato = true; ch.comb = (ch.c.att || 0) + ch.eq.reduce((s, e) => s + (e.c.att || 0), 0);
  } else { if (!leaderPuoAttaccare(p)) return false; p.leader.girato = true; }
  log(V(p, 'Attacchi con ', 'L\'avversario attacca con ') + nomeA + (ch ? ' (' + potenza(p, ch) + ')' : ' (3000)'));
  try {
    if (ch) { const tel = ch.eq.find(e => e.c.tele); if (tel && ch.telUsato !== S.turno) { ch.telUsato = S.turno; esegui(p, [{ op: 'gira', max: tel.c.tele, k: 1 }], tel); } }
    // REAZIONE del difensore (prima dei blocchi)
    let blocco = null, libero = false;
    const reazioni = d.mano.filter(c => c.c.reaz && pronte(d) >= c.c.c && (c.c.fx[0].op !== 'bloccoLibero' || d.campo.some(x => !x.girato)));
    if (reazioni.length) {
      const r = (scegli(d, { scopo: 'reazione', titolo: nomeA + ' ti attacca! Vuoi giocare una REAZIONE?', cand: reazioni, min: 0, max: 1, tipo: 'mano', att: ch, attP: ch ? potenza(p, ch) : 3000, attL: !ch }))[0];
      if (r) {
        paga(d, r.c.c); d.mano.splice(d.mano.indexOf(r), 1); d.bormida.push(r);
        log(V(d, 'Rispondi con ', 'L\'avversario risponde con ') + r.c.n);
        if (r.c.fx[0].op === 'annulla') { log('Attacco annullato'); return true; }
        blocco = (scegli(d, { scopo: 'blocco', titolo: r.c.n + ': quale Character blocca senza girarsi (+2000)?', cand: d.campo.filter(x => !x.girato), min: 1, max: 1, tipo: 'campo', di: d, att: ch, attP: ch ? potenza(p, ch) : 3000, attL: !ch, libero: true }))[0] || null;
        if (blocco) { libero = true; blocco.comb += r.c.fx[0].v; }
      }
    }
    if (!blocco) {
      const cand = d.campo.filter(x => !x.girato);
      if (cand.length) blocco = (scegli(d, { scopo: 'blocco', titolo: nomeA + ' (' + (ch ? potenza(p, ch) : 3000) + ') ti attacca: blocchi?', cand, min: 0, max: 1, tipo: 'campo', di: d, att: ch, attP: ch ? potenza(p, ch) : 3000, attL: !ch }))[0] || null;
    }
    if (!blocco) {
      log(nomeA + ' non viene bloccato');
      perdiBelinata(d);
      if (ch) {
        if (ch.c.nonb) esegui(p, ch.c.nonb, ch);
        for (const e of ch.eq.filter(e => e.c.nonb)) esegui(p, e.c.nonb, e);
      }
      return true;
    }
    if (!libero && !ha(blocco, 'guardia')) blocco.girato = true;
    blocco.comb += blocco.eq.reduce((s, e) => s + (e.c.blocco || 0), 0);
    log(V(d, 'Blocchi con ', 'L\'avversario blocca con ') + blocco.c.n + ' (' + potenza(d, blocco) + ')');
    // effetto del Belinone del difensore dopo il blocco
    if (leaderAbilUsabile(d) && d.leader.c.abil.fx[0].op === 'bonus') {
      const usa = d.ia ? IA.leaderInDifesa(d, p, ch, blocco) : menu(d, { scopo: 'sino', titolo: 'Usi l\'effetto di ' + d.leader.c.n + ' (' + d.leader.c.abil.costo + ' Tire, +' + d.leader.c.abil.fx[0].v + ' Potenza) prima del combattimento?', opzioni: ['si', 'no'] }) === 0;
      if (usa) usaLeader(d);
    }
    // combattimento
    const aP = ch ? potenza(p, ch) : 3000, bP = potenza(d, blocco);
    log('Combattimento: ' + nomeA + ' ' + aP + ' contro ' + blocco.c.n + ' ' + bP);
    if (!ch) { if (bP < 3000) elimina(d, blocco, 'combattimento'); else log(blocco.c.n + ' resiste al Belinone'); }
    else if (aP > bP) { if (elimina(d, blocco, 'combattimento') && ch.c.uccide && p.campo.includes(ch)) esegui(p, ch.c.uccide, ch); }
    else if (bP > aP) { if (elimina(p, ch, 'combattimento') && blocco.c.uccide && d.campo.includes(blocco)) esegui(d, blocco.c.uccide, blocco); }
    else { elimina(d, blocco, 'combattimento'); elimina(p, ch, 'combattimento'); }
    return true;
  } finally {
    if (ch) ch.comb = 0;
    S.g.forEach(q => q.campo.forEach(x => { x.comb = 0; }));
  }
}

/* ---------- turni ---------- */
function fineTurnoPulizia() {
  S.g.forEach(q => q.campo.forEach(ch => {
    ch.bonusT = 0; ch.malusT = 0; ch.comb = 0;
    const tmp = ch.eq.filter(e => e.c.temp); tmp.forEach(e => { ch.eq.splice(ch.eq.indexOf(e), 1); q.bormida.push(e); });
  }));
}
function partita() {
  try {
    const [a, b] = [S.g[S.primo], S.g[1 - S.primo]];
    pesca(a, 5); pesca(b, 6);
    log(a.nome + ' comincia (5 carte), ' + b.nome + ' parte con 6 carte');
    for (const p of [a, b]) {                      // mulligan, una volta sola
      const via = p.ia ? IA.mulligan(p) : scegliUmano(p, { scopo: 'mulligan', titolo: 'Mulligan: quali carte rimetti nel mazzo per pescarne altrettante? (una volta sola)', cand: p.mano.slice(), min: 0, max: p.mano.length, tipo: 'mano' });
      if (via && via.length) {
        via.forEach(c => p.mano.splice(p.mano.indexOf(c), 1)); p.mazzo.push(...via); mescola(p.mazzo); pesca(p, via.length);
        log(V(p, 'Cambi ', 'L\'avversario cambia ') + via.length + ' carte');
      }
    }
    S.g.forEach(p => { p.belinate = p.mazzo.splice(0, 5); });
    for (; ;) {
      S.turno++; const p = S.g[S.att]; p.nTurni++;
      S.fase = 'ready';
      p.campo.forEach(ch => { ch.girato = false; }); p.leader.girato = false; p.tireGirate = 0;
      p.tire = Math.min(10, p.tire + (p.nTurni === 1 ? (S.att === S.primo ? 1 : 2) : 2));
      if (!(p.nTurni === 1 && S.att === S.primo)) {
        if (!p.mazzo.length) perde(p, V(p, 'devi pescare ma il mazzo è vuoto', 'deve pescare con il mazzo vuoto'));
        pesca(p, 1);
      }
      S.fase = 'main';
      log(V(p, '— Il tuo turno' + (p.nTurni === 1 ? ' (nel primo turno non si attacca)' : '') + ' —', '— Turno dell\'avversario —'));
      if (p.ia) IA.turno(p); else turnoUmano(p);
      if (S.fine) throw new Fine();
      if (S.turno >= MAX_TURNI) { S.fine = { vince: -1, motivo: 'troppi turni, nessuno ha vinto' }; throw new Fine(); }
      S.fase = 'fine';
      fineTurnoPulizia();
      if (p.mano.length > 10) scartaDa(p, p.mano.length - 10, 'Fine turno: scarta fino a 10 carte');
      S.att = 1 - S.att;
    }
  } catch (e) {
    if (!(e instanceof Fine)) throw e;
  }
}
/* =====================================================================
   IA (avversario): semplice e prudente, sceglie la mossa che rende di piu'
   ===================================================================== */
const IA = {
  valoreMano(c, p) { const k = c.c; return k.t === 'C' ? k.p / 1000 + (k.etb ? 1 : 0) - Math.max(0, k.c - p.tire - 2) : k.t === 'E' ? 1.5 + (k.bonus || 0) / 1500 : 2 - (k.c > p.tire + 2 ? 1 : 0); },
  scegli(p, req) {
    const o = avv(p), c = req.cand.slice();
    const pw = ch => potenza(S.g.find(q => q.campo.includes(ch)) || p, ch);
    const ordina = f => c.sort((a, b) => f(b) - f(a));
    switch (req.scopo) {
      case 'gira': case 'elimina': case 'malus': ordina(ch => pw(ch) + ch.c.c * 300 + (ch.girato ? -2000 : 0)); return c.slice(0, req.max);
      case 'bonus': ordina(ch => (puoAttaccare(p, ch) || (S.att !== p.i && !ch.girato) ? 5000 : 0) + pw(ch)); return c.slice(0, 1);
      case 'equipa': ordina(ch => (ha(ch, 'guardia') ? 800 : 0) + pw(ch) + (ch.girato ? -1500 : 0) + (req.eq && req.eq.kw && req.eq.kw.rush && ch.entrato === S.turno ? 6000 : 0)); return c.slice(0, 1);
      case 'scarta': c.sort((a, b) => IA.valoreMano(a, p) - IA.valoreMano(b, p)); return c.slice(0, req.max);
      case 'riprendi': case 'cerca': case 'equipB': ordina(x => (x.c.p || 0) / 1000 + x.c.c + (x.c.bonus || 0) / 1000 - Math.max(0, x.c.c - p.tire - 2) * 2); return c.slice(0, req.max);
      case 'sacrifica': case 'inMano': c.sort((a, b) => pw(a) - pw(b)); return c.slice(0, 1);
      case 'blocco': return IA.blocco(p, req);
      case 'reazione': return IA.reazione(p, req);
    }
    return c.slice(0, req.min);
  },
  blocco(d, req) {
    const aP = req.attP, cand = req.cand.slice(), pw = ch => potenza(d, ch) + (req.libero ? 0 : ch.eq.reduce((s, e) => s + (e.c.blocco || 0), 0));
    if (req.libero) { cand.sort((a, b) => pw(b) - pw(a)); return [cand[0]]; }
    if (req.attL) { const ok = cand.filter(ch => pw(ch) >= 3000).sort((a, b) => (ha(b, 'guardia') - ha(a, 'guardia')) || pw(a) - pw(b)); if (ok.length) return [ok[0]]; if (d.belinate.length <= 1 && cand.length) return [cand.sort((a, b) => a.c.c - b.c.c)[0]]; return []; }
    const vince = cand.filter(ch => pw(ch) > aP).sort((a, b) => (ha(b, 'guardia') - ha(a, 'guardia')) || a.c.c - b.c.c);
    if (vince.length) return [vince[0]];
    const pari = cand.filter(ch => pw(ch) === aP && req.att && ch.c.c <= req.att.c.c);
    if (pari.length) return [pari[0]];
    if (d.belinate.length <= 1 && cand.length) return [cand.sort((a, b) => a.c.c - b.c.c)[0]];
    return [];
  },
  reazione(d, req) {
    const pw = ch => potenza(d, ch);
    const pronti = d.campo.filter(ch => !ch.girato), vince = pronti.some(ch => pw(ch) > req.attP);
    const ann = req.cand.find(c => c.c.fx[0].op === 'annulla'), lib = req.cand.find(c => c.c.fx[0].op === 'bloccoLibero');
    if (lib && !vince && pronti.some(ch => pw(ch) + 2000 > req.attP)) return [lib];
    if (ann && !vince && (d.belinate.length <= 2 || req.attP >= 5000)) return [ann];
    return [];
  },
  leaderInDifesa(d, p, ch, blocco) {
    const ab = d.leader.c.abil.fx[0];
    if (ab.op !== 'bonus') return false;
    const aP = ch ? potenza(p, ch) : 3000, bP = potenza(d, blocco);
    return ch ? bP <= aP && bP + ab.v > aP : bP < 3000 && bP + ab.v >= 3000;
  },
  mulligan(p) { const cheap = p.mano.filter(c => c.c.c <= 2 && c.c.t === 'C').length; return cheap >= 2 ? p.mano.filter(c => c.c.c >= 6) : p.mano.filter(c => c.c.c >= 4); },
  // valore di giocare una carta adesso (0 = non conviene)
  valore(p, c) {
    const k = c.c, o = avv(p), riserva = p.mano.some(x => x.c.reaz && x !== c) ? Math.min(...p.mano.filter(x => x.c.reaz && x !== c).map(x => x.c.c)) : 0;
    if (!giocabile(p, c) || pronte(p) - k.c < (k.t === 'C' && k.c >= 3 ? 0 : riserva)) return 0;
    const pw = ch => potenza(p, ch), opw = ch => potenza(o, ch), attaccanti = p.nTurni > 1;
    const valFx = fx => (fx || []).reduce((s, f) => {
      switch (f.op) {
        case 'pesca': return s + f.n * 1.2;
        case 'scarta': return s - 0.6;
        case 'avvScarta': case 'ogniAvvScarta': return s + (o.mano.length ? 1 : 0);
        case 'avvBelinata': return s + 3;
        case 'tire': return s + (p.tireGirate + k.c > 0 ? 0.8 : 0);
        case 'gira': { const n = o.campo.filter(ch => !ch.girato && ch.c.c <= f.max && !ch.eq.some(e => e.c.noGira)).length; return s + Math.min(n, f.k) * (attaccanti ? 1.6 : 0.6); }
        case 'elimina': { const t = o.campo.filter(ch => ch.c.c <= f.max && (!f.girato || ch.girato) && !ch.eq.some(e => e.c.noElimina)); return s + t.slice(0, f.k).reduce((x, ch) => x + 1 + ch.c.c * 0.8, 0); }
        case 'eliminaTutti': { const v = q => q.campo.filter(ch => ch.girato && ch.c.c <= f.max).reduce((x, ch) => x + 1 + ch.c.c, 0); return s + v(o) - v(p) - 2; }
        case 'malus': return s + (o.campo.length ? (attaccanti ? 1 : 0.3) : 0);
        case 'bonus': return s + (p.campo.some(ch => !ch.girato) && attaccanti ? 1 : 0.1);
        case 'bonusTutti': return s + (attaccanti ? p.campo.filter(ch => !ch.girato && ch.entrato < S.turno).length * 0.9 - 0.5 : 0);
        case 'riprendiC': case 'riprendiE': case 'riprendi': return s + (p.bormida.some(x => f.op === 'riprendi' || (f.op === 'riprendiE' ? x.c.t === 'E' : x.c.t === 'C' && x.c.c <= f.max)) ? 1.2 : 0);
        case 'cerca': return s + 1;
        case 'equipBormida': return s + (p.bormida.some(x => x.c.t === 'E' && x.c.c <= f.max) && p.campo.some(ch => ch.eq.length < 2) ? 2 : 0);
      }
      return s;
    }, 0);
    if (k.t === 'C') {
      let v = 2 + k.p / 1000 + valFx(k.etb) + (k.kw && k.kw.rush && attaccanti ? 1 : 0) + (k.kw && k.kw.guardia ? 0.5 : 0);
      if (p.campo.length >= 5) { const peggiore = Math.min(...p.campo.map(pw)); if (k.p < peggiore + 1500) return 0; v -= peggiore / 1000 + 1; }
      return v;
    }
    if (k.t === 'E') {
      if (k.temp && !(attaccanti && p.campo.some(ch => puoAttaccareDopo(p, ch)))) return 0;
      return 1 + (k.bonus || 0) / 1000 + (k.kw && k.kw.guardia ? 0.8 : 0) + (k.kw && k.kw.rush ? (p.campo.some(ch => ch.entrato === S.turno) && attaccanti ? 1.5 : 0.2) : 0) + (k.reset || k.noElimina || k.noGira || k.casco ? 1 : 0) + (k.att || k.blocco ? 1.2 : 0) + (k.tele ? 1 : 0) + (k.morte || k.nonb ? 0.4 : 0);
    }
    if (k.reaz || k.fx[0].op === 'inMano') return 0;
    const v = valFx(k.fx); return v > 0.9 ? v + 0.2 : 0;
  },
  turno(p) {
    const o = avv(p);
    for (let g = 0; g < 25 && !S.fine; g++) {
      let best = null, bv = 0;
      for (const c of p.mano) { const v = IA.valore(p, c) / Math.max(1, c.c.c * 0.55); if (v > bv) { bv = v; best = c; } }
      if (!best) break;
      const k = best.c;
      let opz = {};
      if (k.t === 'C' && p.campo.length >= 5) opz.via = p.campo.slice().sort((a, b) => potenza(p, a) - potenza(p, b))[0];
      if (k.t === 'E') opz.su = IA.scegli(p, { scopo: 'equipa', cand: p.campo.filter(ch => ch.eq.length < 2), eq: k, max: 1 })[0];
      if (!(gioca(p, best, opz))) break;
    }
    // effetto del Belinone nel proprio turno
    const ab = p.leader.c.abil;
    if (ab && leaderAbilUsabile(p)) {
      const f = ab.fx[0];
      if (f.op === 'gira' && p.nTurni > 1 && o.campo.some(ch => !ch.girato && ch.c.c <= f.max && !ch.eq.some(e => e.c.noGira))) { usaLeader(p); }
      if (f.op === 'riprendiC' && p.bormida.some(x => x.c.t === 'C' && x.c.c <= f.max) && pronte(p) >= ab.costo) { usaLeader(p); }
    }
    if (S.fine) return;
    S.fase = 'attacchi';
    if (p.nTurni <= 1) return;
    const pwO = ch => potenza(o, ch);
    const bloccanti = () => o.campo.filter(ch => !ch.girato);
    const letale = () => o.belinate.length === 0;
    // prima il Belinone (non viene mai eliminato), poi i Character dal piu' forte
    if (leaderPuoAttaccare(p)) { attacca(p, null); }
    for (let g = 0; g < 6 && !S.fine; g++) {
      const pronti = p.campo.filter(ch => puoAttaccare(p, ch)).sort((a, b) => potenza(p, b) - potenza(p, a));
      let scelto = null;
      for (const ch of pronti) {
        const aP = potenza(p, ch) + (ch.c.att || 0) + ch.eq.reduce((s, e) => s + (e.c.att || 0), 0);
        const forti = bloccanti().filter(b => pwO(b) + b.eq.reduce((s, e) => s + (e.c.blocco || 0), 0) >= aP);
        const tengo = p.belinate.length <= 1 && p.campo.filter(x => !x.girato).length <= 1 && !ha(ch, 'guardia');
        if (letale() || (!forti.length && !tengo)) { scelto = ch; break; }
      }
      if (!scelto) {
        // Vambrael: un bonus puo' far passare un attacco
        if (ab && ab.fx[0].op === 'bonus' && leaderAbilUsabile(p) && pronti.length) {
          const ch = pronti[0], aP = potenza(p, ch) + ab.fx[0].v + (ch.c.att || 0);
          if (!bloccanti().some(b => pwO(b) >= aP)) { p.leader.usato = S.turno; paga(p, ab.costo); ch.bonusT += ab.fx[0].v; log(p.nome + ' usa ' + p.leader.c.n + ': ' + ch.c.n + ' +' + ab.fx[0].v); continue; }
        }
        break;
      }
      attacca(p, scelto);
    }
  }
};
function puoAttaccareDopo(p, ch) { return !ch.girato && (ch.entrato < S.turno || ha(ch, 'rush')); }


/* ===================== LE SCELTE DEGLI ABITANTI ===================== */
// una scelta dell'abitante: si prende dalla lista delle decisioni gia' prese, altrimenti si chiede
function decisione(p, req) { if (Q[p.i].length) return Q[p.i].shift(); throw new Serve(p.i, req); }
// un menu: ritorna l'indice dell'opzione
function menu(p, req) { return decisione(p, req); }
// scegliere tra carte (bersagli, blocchi, scarti...): ritorna le carte scelte
function scegliUmano(p, req) {
  const v = decisione(p, req);
  return (Array.isArray(v) ? v : []).map(k => req.cand[k]).filter(Boolean);
}
// il turno di un abitante: un'azione alla volta, finche' non dice "fine"
function turnoUmano(p) {
  for (let g = 0; g < 40 && !S.fine; g++) {
    const op = opzioniTurno(p);
    const k = menu(p, { scopo: 'turno', titolo: S.fase === 'main' ? 'E\' il tuo turno (fase principale): cosa fai?' : 'Fase attacchi: cosa fai?', opzioni: op.map(o => o.t), op });
    const o = op[k];
    if (!o || o.a === 'fine') return;
    if (o.a === 'attacchi') S.fase = 'attacchi';
    else if (o.a === 'gioca') gioca(p, o.c);
    else if (o.a === 'leader') usaLeader(p);
    else if (o.a === 'attacca') attacca(p, o.ch);
  }
}
function opzioniTurno(p) {
  const op = [];
  if (S.fase === 'main') {
    p.mano.forEach(c => { if (giocabile(p, c)) op.push({ a: 'gioca', c, t: 'gioca ' + descrivi(c.c) }); });
    if (leaderAbilUsabile(p)) op.push({ a: 'leader', t: 'usa l\'effetto del tuo Belinone ' + p.leader.c.n + ' (' + p.leader.c.desc + ')' });
    if (p.nTurni > 1) op.push({ a: 'attacchi', t: 'passa alla fase attacchi (poi non puoi piu\' giocare carte in questo turno)' });
  } else {
    p.campo.forEach(ch => { if (puoAttaccare(p, ch)) op.push({ a: 'attacca', ch, t: 'attacca con ' + ch.c.n + ' (' + potenza(p, ch) + (ch.c.att || ch.eq.some(e => e.c.att) ? ' +' + ((ch.c.att || 0) + ch.eq.reduce((s, e) => s + (e.c.att || 0), 0)) + ' in attacco' : '') + ')' }); });
    if (leaderPuoAttaccare(p)) op.push({ a: 'attacca', ch: null, t: 'attacca con il Belinone ' + p.leader.c.n + ' (3000)' });
    if (leaderAbilUsabile(p) && p.leader.c.abil.fx[0].op === 'bonus') op.push({ a: 'leader', t: 'usa l\'effetto del Belinone (' + p.leader.c.desc + ')' });
  }
  op.push({ a: 'fine', t: 'fine del turno' });
  return op;
}

/* ===================== DESCRIVERE LE CARTE ===================== */
const FX = f => {
  switch (f.op) {
    case 'pesca': return 'peschi ' + f.n;
    case 'scarta': return 'scarti ' + f.n;
    case 'avvScarta': case 'ogniAvvScarta': return 'l\'avversario scarta 1';
    case 'avvBelinata': return 'l\'avversario perde 1 Belinata';
    case 'tire': return f.n + ' Tire tornano pronte';
    case 'gira': return 'gira ' + (f.k > 1 ? 'fino a ' + f.k + ' Character' : 'un Character') + ' avversari' + (f.max < 99 ? ' di costo ' + f.max + ' o meno' : '');
    case 'elimina': return 'elimina ' + (f.k > 1 ? f.k + ' Character' : 'un Character') + ' avversario' + (f.girato ? ' girato' : '') + ' di costo ' + f.max + ' o meno';
    case 'eliminaTutti': return 'elimina tutti i Character girati di costo ' + f.max + ' o meno';
    case 'malus': return 'un Character avversario -' + f.v + ' per il turno';
    case 'bonus': return 'un tuo Character +' + f.v + ' per il turno';
    case 'bonusTutti': return 'i tuoi Character +' + f.v + ' per il turno';
    case 'riprendiC': return 'riprendi in mano dalla Bormida un Character di costo ' + f.max + ' o meno';
    case 'riprendiE': return 'riprendi dalla Bormida un Equipaggiamento';
    case 'riprendi': return 'riprendi una carta dalla Bormida';
    case 'cerca': return 'guardi le prime 5 carte e prendi un ' + NOMI_TIPO[f.tipo];
    case 'equipBormida': return 'assegna un Equipaggiamento dalla Bormida';
    case 'inMano': return 'rimetti in mano un tuo Character';
    case 'annulla': return 'REAZIONE: annulla un attacco';
    case 'bloccoLibero': return 'REAZIONE: un tuo Character blocca senza girarsi, +' + f.v;
  }
  return f.op;
};
const lista = fx => (fx || []).map(FX).join(', ');
function descrivi(c) {
  const x = [];
  if (c.t === 'C') x.push('Character, costo ' + c.c + ', Potenza ' + c.p);
  if (c.t === 'E') x.push('Equipaggiamento, costo ' + c.c + (c.bonus ? ', +' + c.bonus + (c.temp ? ' solo per questo turno' : '') : ''));
  if (c.t === 'V') x.push('Evento, costo ' + c.c);
  if (c.kw && c.kw.guardia) x.push('Guardia (blocca senza girarsi)');
  if (c.kw && c.kw.rush) x.push('Rush (attacca subito)');
  if (c.etb) x.push('quando entra: ' + lista(c.etb));
  if (c.att) x.push('+' + c.att + ' quando attacca');
  if (c.blocco) x.push('+' + c.blocco + ' quando blocca');
  if (c.stat) x.push(c.stat.min ? '+' + c.stat.v + ' se hai ' + c.stat.min + ' Character' : '+' + c.stat.v + ' se ha un Equipaggiamento');
  if (c.morte) x.push('quando e\' eliminato: ' + lista(c.morte));
  if (c.nonb) x.push('se il suo attacco non e\' bloccato: ' + lista(c.nonb));
  if (c.uccide) x.push('se elimina in combattimento: ' + lista(c.uccide));
  if (c.noGira) x.push('non puo\' essere girato dagli effetti');
  if (c.noElimina) x.push('non puo\' essere eliminato dagli effetti');
  if (c.reset) x.push('salva una volta il suo Character dall\'eliminazione');
  if (c.casco) x.push('torna pronto la prima volta che lo girano');
  if (c.tele) x.push('quando attacca gira un Character avversario di costo ' + c.tele + ' o meno');
  if (c.fx) x.push(lista(c.fx));
  return c.n + ' (' + x.join('; ') + ')';
}
const chDi = (p, ch) => ch.c.n + ' ' + potenza(p, ch) + (ch.girato ? ' girato' : ' pronto') + (ch.eq.length ? ' [' + ch.eq.map(e => e.c.n).join(', ') + ']' : '') + (ha(ch, 'guardia') ? ' Guardia' : '');

/* ===================== LA PARTITA RIGIOCATA ===================== */
// rigioca dal seme con le decisioni prese: si ferma alla prossima scelta di un abitante (o alla fine)
const cache = new WeakMap();
function simula(st) {
  const firma = st.dec.map(d => d.length).join(',');
  const c = cache.get(st); if (c && c.firma === firma) return c.ris;
  R = seme(st.seme); uidN = 1; Q = st.dec.map(d => d.slice());
  const crea = (i) => ({ i, nome: st.nomi[i], ia: !st.umano[i], leader: { c: PER_ID[st.leader[i]], girato: false, usato: -1, morteUsata: -1 },
    mazzo: mescola(st.mazzi[i].map(id => nuovaIst(PER_ID[id]))), mano: [], belinate: [], bormida: [], campo: [], tire: 0, tireGirate: 0, nTurni: 0 });
  S = { g: [crea(0), crea(1)], turno: 0, att: 0, primo: st.primo, fase: 'inizio', fine: null, log: [] };
  S.att = S.primo;
  let attesa = null;
  try { partita(); } catch (e) { if (e instanceof Serve) attesa = { i: e.i, req: e.req }; else throw e; }
  const ris = { S, attesa };
  cache.set(st, { firma, ris });
  return ris;
}
// la risposta dell'abitante -> la decisione (indice o lista di indici), oppure un errore
function leggi(req, mossa) {
  const t = String(mossa == null ? '' : mossa).toLowerCase();
  const num = (t.match(/\d+/g) || []).map(n => +n);
  if (req.opzioni) {
    if (req.scopo === 'sino' && !num.length) return /^\s*s[iì]/.test(t) ? 0 : /^\s*no/.test(t) ? 1 : null;
    const k = num.length ? num[0] - 1 : req.opzioni.findIndex(o => t && o.toLowerCase().startsWith(t.trim()));
    return k >= 0 && k < req.opzioni.length ? k : null;
  }
  if (!num.length && !/nessun|niente|nulla|tengo|^\s*no\b/.test(t)) return null;
  if (!num.length || num.every(n => n === 0)) return req.min ? null : [];
  const idx = [...new Set(num.map(n => n - 1))];
  if (idx.some(k => k < 0 || k >= req.cand.length) || idx.length < Math.min(req.min, req.cand.length) || idx.length > req.max) return null;
  return idx;
}

export default {
  nome: 'Belinverse 2', icona: '🃏', aDue: true,
  regole: 'Gioco di carte del borgo: vince chi toglie all\'avversario tutte le 5 Belinate e lo colpisce ancora (o se l\'avversario deve pescare col mazzo vuoto). Ogni turno ricevi Tire (energia) per giocare carte; i Character attaccano dal secondo turno; chi non blocca un attacco perde una Belinata. Rispondi con il NUMERO della scelta.',
  nuova(ctx) {
    const r0 = seme(ctx.seme ^ 0x51ed); R = r0;
    const base = LEADER.filter(l => !l.alt).map(l => l.id);
    return { seme: ctx.seme, primo: Math.floor(r0() * 2), nomi: ctx.giocatori.map(g => g.nome || 'il computer'), umano: ctx.giocatori.map(g => !g.computer),
      leader: [base[Math.floor(r0() * 5)], base[Math.floor(r0() * 5)]], mazzi: [mazzoCasuale(), mazzoCasuale()], dec: [[], []] };
  },
  tocca(st) { const s = simula(st); return s.S.fine || !s.attesa ? -1 : s.attesa.i; },
  domanda(st, i) {
    const { S: X, attesa } = simula(st), p = X.g[i], o = X.g[1 - i], req = attesa.req;
    S = X;
    const io = `TU (${p.nome}): Belinone ${p.leader.c.n} (${p.leader.c.desc}). Belinate ${p.belinate.length}, Tire pronte ${pronte(p)} su ${p.tire}, mazzo ${p.mazzo.length} carte, Bormida ${p.bormida.length}.
In campo: ${p.campo.length ? p.campo.map(ch => chDi(p, ch)).join('; ') : 'nessuno'}.
In mano: ${p.mano.map(c => descrivi(c.c)).join('; ') || 'niente'}.`;
    const lui = `AVVERSARIO (${o.nome}): Belinone ${o.leader.c.n}. Belinate ${o.belinate.length}, Tire ${o.tire}, ${o.mano.length} carte in mano, mazzo ${o.mazzo.length}.
In campo: ${o.campo.length ? o.campo.map(ch => chDi(o, ch)).join('; ') : 'nessuno'}.`;
    const opz = req.opzioni ? req.opzioni.map((t, k) => (k + 1) + ') ' + t) : req.cand.map((c, k) => (k + 1) + ') ' + (c.eq ? chDi(X.g.find(q => q.campo.includes(c)) || p, c) : descrivi(c.c)));
    const quanti = req.opzioni ? 'il numero di una scelta' : req.max > 1 ? `da ${req.min} a ${req.max} numeri separati da virgole${req.min ? '' : ' (oppure "0" per nessuna)'}` : req.min ? 'un numero' : 'un numero, oppure "0" per nessuno';
    return { testo: `Belinverse 2, turno ${X.turno}.\n${io}\n${lui}\nULTIME COSE SUCCESSE: ${X.log.slice(-6).join(' | ')}\nDOMANDA: ${req.titolo}`, opzioni: opz, formato: quanti };
  },
  applica(st, i, mossa) {
    const { attesa } = simula(st);
    if (!attesa || attesa.i !== i) return { ok: false, errore: 'non tocca a te' };
    const v = leggi(attesa.req, mossa);
    if (v == null) return { ok: false, errore: `"${mossa}" non e' una scelta valida (${attesa.req.opzioni ? 'scrivi il numero di una scelta' : 'controlla quanti numeri servono'})` };
    const n0 = simula(st).S.log.length;
    st.dec[i].push(v);
    let dopo;
    try { dopo = simula(st); } catch (e) { st.dec[i].pop(); return { ok: false, errore: 'mossa non riuscita: ' + (e && e.message) }; }
    const sel = attesa.req.opzioni ? attesa.req.opzioni[v] : (v.length ? v.map(k => attesa.req.cand[k].c.n).join(', ') : 'nessuno');
    const nuove = dopo.S.log.slice(Math.max(0, Math.min(n0, dopo.S.log.length - 4))).slice(-4);
    return { ok: true, testo: `${sel.split(' (')[0]}` + (nuove.length ? ' → ' + nuove.join(' | ') : ''), attesa: 8 };
  },
  // l'istinto: come gioca il computer del tavolo
  auto(st, i) {
    const { S: X, attesa } = simula(st); S = X; R = seme(st.seme + st.dec[i].length);
    const req = attesa.req, p = X.g[i];
    if (req.scopo === 'sino') return '2';
    if (req.scopo === 'turno') {
      const op = req.op; let best = -1, bv = 0;
      op.forEach((o, k) => { if (o.a === 'gioca') { const v = IA.valore(p, o.c) / Math.max(1, o.c.c.c * 0.55); if (v > bv) { bv = v; best = k; } } });
      if (best >= 0) return String(best + 1);
      const at = op.findIndex(o => o.a === 'attacchi'); if (at >= 0) return String(at + 1);
      const o = avv(p), bl = o.campo.filter(ch => !ch.girato);
      const k = op.findIndex(x => x.a === 'attacca' && (o.belinate.length === 0 || !bl.some(b => potenza(o, b) >= (x.ch ? potenza(p, x.ch) : 3000))));
      return String((k >= 0 ? k : op.length - 1) + 1);
    }
    const sel = req.scopo === 'mulligan' ? IA.mulligan(p) : IA.scegli(p, req);
    const idx = sel.map(c => req.cand.indexOf(c)).filter(k => k >= 0);
    return idx.length ? idx.map(k => k + 1).join(',') : '0';
  },
  fine(st) {
    const { S: X } = simula(st); if (!X.fine) return null;
    const v = X.fine.vince, esiti = [0, 1].map(i => (v === -1 || v == null ? 'patta' : v === i ? 'vinto' : 'perso'));
    return { esiti, testi: esiti.map((e, i) => `${e === 'vinto' ? 'hai vinto la partita a carte' : e === 'perso' ? 'hai perso la partita a carte' : 'nessuno ha vinto'} (${X.fine.motivo}), turno ${X.turno}, col Belinone ${PER_ID[st.leader[i]].n}.`), premi: esiti.map(e => (e === 'vinto' ? 10 : 2)) };
  },
  vista(st) { const { S: X } = simula(st); return `Belinverse 2, turno ${X.turno}: Belinate ${X.g[0].nome} ${X.g[0].belinate.length}, ${X.g[1].nome} ${X.g[1].belinate.length}`; }
};
