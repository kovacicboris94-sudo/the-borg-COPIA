// Scacchi giocati davvero: le regole e il computer sono quelli della Casa degli Scacchi del gioco
// (copiati in scacchi-motore.mjs). Ogni mossa dell'abitante la sceglie l'abitante.
import { Scacchi as S } from './scacchi-motore.mjs';

// punti Elo come nel gioco (src/minigiochi/scacchi/motore.js, B3.ScacchiElo)
export const ELO = {
  iniziale: 800,
  k: (partite, elo) => (partite < 20 ? 40 : elo >= 2000 ? 16 : 24),
  atteso: (a, b) => 1 / (1 + Math.pow(10, (b - a) / 400)),
  variazione(mio, avv, ris, partite) { const d = Math.round(ELO.k(partite, mio) * (ris - ELO.atteso(mio, avv))); return Math.max(100 - mio, d); }
};
// nel worker il computer non puo' pensare a lungo (il tempo della CPU e' poco): al massimo 2 mosse avanti
const LIVELLO_MAX = 3;
const MAX_SEMIMOSSE = 180;   // oltre, patta (succede solo se nessuno riesce a chiudere)
const PEZZI = { 1: 'P', 2: 'N', 3: 'B', 4: 'R', 5: 'Q', 6: 'K' };
const NOMI = { P: 'pedone', N: 'cavallo', B: 'alfiere', R: 'torre', Q: 'donna', K: 're' };
const VAL = [0, 1, 3, 3, 5, 9, 0];

function posizione(st) { const p = new S.Posizione(); st.mosse.forEach(u => p.giocaUci(u)); return p; }
const colore = (st, i) => (i === st.bianco ? 1 : -1);
function botPer(elo) {
  let best = 0;
  S.BOT.forEach((b, i) => { if (i <= LIVELLO_MAX && Math.abs(b.elo - elo) < Math.abs(S.BOT[best].elo - elo)) best = i; });
  return best;
}

// la scacchiera vista da chi gioca (le sue pedine in basso): maiuscole bianche, minuscole nere
function disegna(pos, lato) {
  const righe = [];
  for (let rr = 0; rr < 8; rr++) {
    const r = lato === 1 ? 7 - rr : rr; let s = (r + 1) + ' ';
    for (let ff = 0; ff < 8; ff++) {
      const f = lato === 1 ? ff : 7 - ff, v = pos.b[r * 16 + f];
      s += v ? (v > 0 ? PEZZI[v] : PEZZI[-v].toLowerCase()) : '.';
      if (ff < 7) s += ' ';
    }
    righe.push(s);
  }
  righe.push('  ' + (lato === 1 ? 'a b c d e f g h' : 'h g f e d c b a'));
  return righe.join('\n');
}
function materiale(pos) { let b = 0, n = 0; for (let s = 0; s < 128; s++) { if (s & 0x88) continue; const v = pos.b[s]; if (v > 0) b += VAL[v]; else if (v < 0) n += VAL[-v]; } return [b, n]; }

export default {
  nome: 'Scacchi', icona: '♞', aDue: true,
  regole: 'Regole normali degli scacchi. Scrivi la mossa in notazione algebrica italiana o inglese come nell\'elenco (es. "e4", "Cf3" o "Nf3", "exd5", "O-O"), scegliendo SOLO tra le mosse possibili. Puoi anche scrivere "abbandono".',
  nuova(ctx) {
    const [a, b] = ctx.giocatori, contro = b.computer;
    const elo = ctx.giocatori.map(g => (g.computer ? 0 : (g.stat && g.stat.elo) || ELO.iniziale));
    const st = { mosse: [], san: [], bianco: Math.random() < 0.5 ? 0 : 1, seme: ctx.seme, fine: null, elo, partiteElo: ctx.giocatori.map(g => (g.stat ? g.stat.g : 0)) };
    if (contro) { st.bot = botPer(elo[0]); st.elo[1] = S.BOT[st.bot].elo; st.nomeBot = S.BOT[st.bot].nome; }
    return st;
  },
  tocca(st) { if (st.fine) return -1; const p = posizione(st); return p.turno === 1 ? st.bianco : 1 - st.bianco; },
  domanda(st, i) {
    const p = posizione(st), lato = colore(st, i), l = p.mosse().map(m => p.san(m));
    const [mb, mn] = materiale(p), mio = lato === 1 ? mb : mn, suo = lato === 1 ? mn : mb;
    const ultime = st.san.slice(-8).map((s, k, arr) => { const n = st.san.length - arr.length + k; return (n % 2 ? '' : (n / 2 + 1) + '. ') + s; }).join(' ');
    return {
      testo: `Giochi con il ${lato === 1 ? 'BIANCO (lettere maiuscole, in basso)' : 'NERO (lettere minuscole, in basso)'}${st.nomeBot ? ` contro ${st.nomeBot} (computer, Elo ${st.elo[1]})` : ''}. Mossa numero ${Math.floor(st.mosse.length / 2) + 1}.
SCACCHIERA (P pedone, N cavallo, B alfiere, R torre, Q donna, K re):
${disegna(p, lato)}
Ultime mosse: ${ultime || 'nessuna, si comincia'}.${p.inScacco() ? '\nSEI SOTTO SCACCO!' : ''}
Materiale: tu ${mio}, l'avversario ${suo}.`,
      opzioni: [l.join(' ')],
      formato: '"mossa": una delle mosse possibili, scritta uguale (es. "' + l[0] + '"), oppure "abbandono"'
    };
  },
  applica(st, i, mossa) {
    const p = posizione(st), t = String(mossa || '').trim();
    if (/^(abbandon|mi arrendo|resign)/i.test(t)) { st.fine = { vince: 1 - i, motivo: 'abbandono' }; return { ok: true, testo: 'abbandona la partita' }; }
    // si accettano anche le lettere italiane dei pezzi (C cavallo, A alfiere, T torre, D donna, R re)
    const pulita = t.replace(/^[\d.\s]+/, '').split(/[\s,]/)[0];
    const it = pulita.replace(/^C/, 'N').replace(/^A/, 'B').replace(/^T/, 'R').replace(/^D/, 'Q').replace(/^R(?=[a-h1-8x])/, 'K');
    let m = p.trovaSan(pulita) || p.trovaSan(it) || p.trovaUci(pulita.toLowerCase());
    if (!m && /^[a-h][1-8][a-h][1-8]/.test(pulita)) m = p.trovaUci(pulita.slice(0, 4).toLowerCase() + 'q');
    if (!m) return { ok: false, errore: `"${t}" non e' una mossa possibile adesso` };
    const san = p.san(m), u = S.uci(m);
    p.fai(m); st.mosse.push(u); st.san.push(san);
    const s = p.stato();
    if (s.fine) st.fine = { vince: s.vince === 0 ? -1 : (s.vince === 1 ? st.bianco : 1 - st.bianco), motivo: s.motivo };
    else if (st.mosse.length >= MAX_SEMIMOSSE) st.fine = { vince: -1, motivo: 'troppe mosse' };
    return { ok: true, testo: san + (s.fine ? ' (' + ({ matto: 'scacco matto', stallo: 'stallo', materiale: 'materiale insufficiente', cinquanta: 'regola delle 50 mosse', ripetizione: 'ripetizione' }[s.motivo] || s.motivo) + ')' : s.scacco ? ' (scacco)' : '') };
  },
  auto(st, i) {
    // il computer gioca al suo livello; chi non riesce a pensare muove d'istinto (come un principiante)
    const livello = st.bot != null && i === 1 ? st.bot : 0;
    const u = S.mossaBot(S.INIZIO, st.mosse, livello, (st.seme + st.mosse.length * 7919) >>> 0);
    return u || 'abbandono';
  },
  fine(st) {
    if (!st.fine) return null;
    const v = st.fine.vince, motivo = { matto: 'scacco matto', stallo: 'stallo', materiale: 'materiale insufficiente', cinquanta: 'regola delle 50 mosse', ripetizione: 'tre volte la stessa posizione', abbandono: 'abbandono', 'troppe mosse': 'troppe mosse' }[st.fine.motivo] || st.fine.motivo;
    const esiti = [0, 1].map(i => (v === -1 ? 'patta' : v === i ? 'vinto' : 'perso'));
    const n = Math.ceil(st.mosse.length / 2);
    const stat = [0, 1].map(i => {
      if (st.bot != null && i === 1) return null;
      const avv = st.elo[1 - i] || ELO.iniziale, ris = esiti[i] === 'vinto' ? 1 : esiti[i] === 'patta' ? 0.5 : 0;
      return { elo: st.elo[i] + ELO.variazione(st.elo[i], avv, ris, st.partiteElo[i] || 0) };
    });
    return {
      esiti,
      testi: esiti.map((e, i) => `${e === 'vinto' ? 'hai vinto' : e === 'perso' ? 'hai perso' : 'patta'} (${motivo}) in ${n} mosse, con il ${colore(st, i) === 1 ? 'bianco' : 'nero'}.` + (stat[i] ? ` Il tuo Elo: ${stat[i].elo}.` : '')),
      premi: esiti.map(e => (e === 'vinto' ? 10 : 2)),
      stat
    };
  },
  vista(st) { return `Scacchi${st.nomeBot ? ' contro ' + st.nomeBot : ''}, mossa ${Math.floor(st.mosse.length / 2) + 1}` + (st.san.length ? ', ultima ' + st.san[st.san.length - 1] : ''); },
  tavola(st) { return { fen: posizione(st).fen(), bianco: st.bianco }; }
};
