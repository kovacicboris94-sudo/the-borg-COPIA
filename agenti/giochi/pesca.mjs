// La pesca al Laghetto giocata davvero, come nel gioco (src/borgo/attivita-piazza.js): si lancia, si guarda
// il galleggiante (che ogni tanto trema per finta), si tira quando abbocca davvero, poi si lotta col pesce.
// Le specie, i pesi e gli orari sono quelli del gioco (PESCI in borgo-cose.mjs). Tre lanci per volta.
import { PESCI } from '../borgo-cose.mjs';

const caso = l => l[Math.floor(Math.random() * l.length)];
const FINTE = ['il galleggiante trema appena', 'un cerchio piccolo intorno al galleggiante', 'il galleggiante fa un saltello e torna su', 'un tocco leggero sul filo'];
const VERE = ['il galleggiante va sotto di colpo!', 'il filo si tende e il galleggiante sparisce!', 'il galleggiante affonda e si sposta di lato!'];
const DUBBI = ['il galleggiante si muove', 'qualcosa tocca l\'esca', 'il galleggiante oscilla'];
// come si comporta il pesce attaccato: cosa conviene fare (gli altri due modi vanno peggio)
const LOTTA = [
  { t: 'il pesce tira forte verso il largo', giusta: 'molla' },
  { t: 'il pesce si ferma sul fondo', giusta: 'recupera' },
  { t: 'il pesce scatta verso la riva', giusta: 'recupera' },
  { t: 'il pesce scuote la testa a destra e a sinistra', giusta: 'tieni' }
];
const FORZA = { comune: 1, 'non comune': 1.4, raro: 1.8, epico: 2.2, leggendario: 3, curiosita: 0.6 };

function scegliPesce(momento, lontano) {
  const giorno = momento === 'mattina' || momento === 'pomeriggio';
  const ok = PESCI.filter(p => !p[6] || p[6] === momento || (p[6] === 'giorno' && giorno));
  // lontano dalla riva i pesci grossi e rari abboccano di piu'
  const peso = p => p[2] * (lontano ? (p[1] === 'comune' ? 0.6 : 1.6) : 1);
  let r = Math.random() * ok.reduce((s, p) => s + peso(p), 0);
  for (const q of ok) { r -= peso(q); if (r <= 0) return q; }
  return ok[0];
}

export default {
  nome: 'Pesca', icona: '🎣',
  regole: 'Al Laghetto: il galleggiante a volte trema per finta, se tiri troppo presto perdi l\'esca; se aspetti troppo il pesce se la mangia. Poi lotti: se il filo e\' troppo teso si spezza, se lo lasci andare troppo il pesce scappa.',
  nuova(ctx) { const g = ctx.giocatori[0]; return { lanci: 3, fase: 'lancio', momento: ctx.momento, esp: g.esperienza || 0, presi: [], fine: false, segnale: null, n: 0 }; },
  tocca(st) { return st.fine ? -1 : 0; },
  domanda(st) {
    const presi = st.presi.length ? ` Finora hai preso: ${st.presi.map(p => p.n + ' ' + p.cm + ' cm').join(', ')}.` : '';
    if (st.fase === 'lancio') return { testo: `Sei sullo sgabello del Laghetto, e' ${st.momento}. Ti restano ${st.lanci} lanci.${presi}`, opzioni: ['"vicino": lanci vicino alla riva (pesci comuni, abboccano prima)', '"lontano": lanci al largo (pesci piu\' grossi e rari, si aspetta di piu\')', '"smetto": basta cosi\''], formato: '"vicino", "lontano" o "smetto"' };
    if (st.fase === 'attesa') return { testo: `Hai lanciato ${st.lontano ? 'al largo' : 'vicino alla riva'}. Guardi il galleggiante: ${st.segnale}.${presi}`, opzioni: ['"tira": tiri su adesso', '"aspetta": aspetti ancora'], formato: '"tira" o "aspetta"' };
    return { testo: `Hai preso qualcosa e lotti! ${st.lotta.t}. Il filo e' teso al ${Math.round(st.tensione)}%, il pesce e' a ${st.dist} metri dalla riva.`, opzioni: ['"molla": lasci correre un po\' di filo (la tensione scende, il pesce si allontana)', '"tieni": tieni la canna ferma', '"recupera": giri il mulinello (il pesce si avvicina, la tensione sale)'], formato: '"molla", "tieni" o "recupera"' };
  },
  applica(st, i, mossa) {
    const m = String(mossa || '').toLowerCase();
    if (st.fase === 'lancio') {
      if (/smett|basta|stop/.test(m)) { st.fine = true; return { ok: true, testo: 'smette di pescare' }; }
      if (!/vicin|lontan|larg/.test(m)) return { ok: false, errore: 'scrivi "vicino", "lontano" o "smetto"' };
      st.lontano = /lontan|larg/.test(m); st.lanci--; st.fase = 'attesa'; st.finte = 0;
      st.preda = Math.random() < (st.lontano ? 0.12 : 0.06) ? null : scegliPesce(st.momento, st.lontano);   // a volte non abbocca nessuno
      return { ok: true, testo: 'lancia ' + (st.lontano ? 'al largo' : 'vicino alla riva'), attesa: this._segnale(st) };
    }
    if (st.fase === 'attesa') {
      if (!/tira|aspett/.test(m)) return { ok: false, errore: 'scrivi "tira" o "aspetta"' };
      const vero = st.vero;
      if (/tira/.test(m)) {
        if (!vero) { this._dopoLancio(st); return { ok: true, testo: 'tira troppo presto: l\'esca e\' persa', attesa: 15 }; }
        const pz = st.preda, cm = Math.round(pz[3] + Math.random() * (pz[4] - pz[3]));
        st.pesce = { n: pz[0], r: pz[1], cm, p: pz[5] }; st.fase = 'lotta'; st.tensione = 40; st.dist = Math.round(8 + FORZA[pz[1]] * 6); st.round = 0; st.lotta = caso(LOTTA);
        return { ok: true, testo: 'tira al momento giusto: ha abboccato!', attesa: 10 };
      }
      if (vero) { this._dopoLancio(st); return { ok: true, testo: 'aspetta troppo: il pesce si mangia l\'esca e scappa', attesa: 15 }; }
      if (++st.finte > 4 && !st.preda) { this._dopoLancio(st); return { ok: true, testo: 'aspetta a lungo ma non abbocca niente', attesa: 40 }; }
      return { ok: true, testo: 'aspetta', attesa: this._segnale(st) };
    }
    // la lotta: fare la cosa giusta per come si muove il pesce, senza spezzare il filo
    if (!/moll|tien|recuper/.test(m)) return { ok: false, errore: 'scrivi "molla", "tieni" o "recupera"' };
    const k = /moll/.test(m) ? 'molla' : /tien/.test(m) ? 'tieni' : 'recupera', f = FORZA[st.pesce.r] || 1, giusta = k === st.lotta.giusta;
    const bravura = 0.8 + st.esp * 0.5;
    if (k === 'molla') { st.tensione -= 22; st.dist += Math.round(2 * f); }
    if (k === 'tieni') { st.tensione += (st.lotta.giusta === 'molla' ? 18 : 6) * f; st.dist -= giusta ? 3 : 2; }
    if (k === 'recupera') { st.tensione += (st.lotta.giusta === 'molla' ? 30 : 12) * f / bravura; st.dist -= Math.round((giusta ? 4 : 2) * bravura); }
    if (giusta) st.tensione -= 8 * bravura;
    st.tensione = Math.max(0, st.tensione + (Math.random() - 0.5) * 10); st.dist = Math.max(0, st.dist); st.round++;
    let t = k;
    if (st.tensione >= 100) { t += ': il filo si spezza, il pesce scappa!'; this._dopoLancio(st); return { ok: true, testo: t, attesa: 20 }; }
    if (st.tensione <= 5 && st.lotta.giusta !== 'molla') { t += ': il filo e\' troppo lento, il pesce si slama e scappa'; this._dopoLancio(st); return { ok: true, testo: t, attesa: 20 }; }
    if (st.dist <= 0) { st.presi.push(st.pesce); t += `: preso! ${st.pesce.n} (${st.pesce.r}, ${st.pesce.cm} cm)`; this._dopoLancio(st); return { ok: true, testo: t, attesa: 20 }; }
    if (st.round >= 10) { t += ': dopo tanta lotta il pesce si libera'; this._dopoLancio(st); return { ok: true, testo: t, attesa: 20 }; }
    st.lotta = caso(LOTTA);
    return { ok: true, testo: t, attesa: 8 };
  },
  // il prossimo segnale del galleggiante: finta o abboccata vera; chi ha esperienza li distingue meglio
  _segnale(st) {
    const vero = !!st.preda && Math.random() < 0.3 + st.finte * 0.15;
    st.vero = vero;
    st.segnale = Math.random() < 0.3 * (1 - st.esp) ? caso(DUBBI) : vero ? caso(VERE) : caso(FINTE);
    return Math.round((st.lontano ? 25 : 12) + Math.random() * 25);
  },
  _dopoLancio(st) { st.fase = 'lancio'; st.pesce = null; if (st.lanci <= 0) st.fine = true; },
  auto(st) {
    if (st.fase === 'lancio') return st.lanci > 0 ? (Math.random() < 0.6 ? 'vicino' : 'lontano') : 'smetto';
    if (st.fase === 'attesa') return /!/.test(st.segnale) ? 'tira' : 'aspetta';
    return st.tensione > 70 ? 'molla' : Math.random() < 0.5 ? st.lotta.giusta : 'recupera';
  },
  fine(st) {
    if (!st.fine) return null;
    const n = st.presi.length;
    return { esiti: [n ? 'vinto' : 'perso'], testi: [n ? `hai preso ${st.presi.map(p => `${p.n} (${p.r}, ${p.cm} cm)`).join(', ')}.` : 'non hai preso niente questa volta.'], premi: [0], pesca: true };
  },
  // i pesci presi finiscono nel secchio (si vendono alla Pescheria), come prima
  dopo(st, i, ag) {
    const sec = ag.secchio || (ag.secchio = []), pescati = ag.pescati || (ag.pescati = {}); let fuori = 0;
    for (const p of st.presi) { pescati[p.n] = (pescati[p.n] || 0) + 1; if (sec.length >= 20) { fuori++; continue; } sec.push({ n: p.n, p: p.p }); }
    if (!st.presi.length) return '';
    return ` Nel secchio hai ${sec.length} pesci: vendili alla Pescheria del Mercatino.` + (fuori ? ` (${fuori} li hai ributtati: secchio pieno)` : '');
  },
  vista(st) { return `Pesca, ${st.lanci} lanci rimasti, presi ${st.presi.length}` + (st.fase === 'lotta' ? ', sta lottando con un pesce!' : ''); }
};
