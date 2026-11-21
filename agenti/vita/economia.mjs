// =====================================================================
//  VITA - L'ECONOMIA DEL BORGO
//  La piazza da sola non sfama nessuno (lo mostra la simulazione): il cibo,
//  la legna e gli attrezzi arrivano da fuori, ogni mattina, al Mercatino.
//  Si pagano in Starlight, la moneta del gioco. I soldi si guadagnano
//  lavorando (mestieri.mjs) o vendendo al Mercatino quello che si produce.
//
//  Prezzi: 1 Starlight vale circa 20 centesimi di euro, cosi' i prezzi
//  stanno nel rapporto vero tra loro (pane ~4 euro/kg = 20 Starlight/kg,
//  come il pane del Forno a 5 Starlight il pezzo da 250 g) e un'ora di
//  lavoro basta a mangiare per un giorno, come nella realta'.
//  Rifornimento limitato: se si compra tutto, il prezzo sale; se resta
//  invenduto, scende (domanda e offerta, entro limiti).
// =====================================================================
import { OGGETTI, MATERIALI } from './materiali.mjs';

export const STARLIGHT_INIZIALI = 150;   // come gli agenti del gioco (agenti/borgo-cose.mjs)

// cosa: [prezzo al kg (o al pezzo per gli attrezzi), quanto arriva ogni mattina, quanto ne compra il Mercatino da chi vende al giorno]
export const LISTINO = {
  pane: [20, 6, 4], farina: [6, 10, 0], fagioli_secchi: [15, 3, 0], olio: [45, 1, 0], sale: [5, 1, 0],
  pesce: [60, 2, 3], uova: [30, 1.5, 0], mele: [12, 5, 0], spinaci: [15, 2, 3], fave: [22, 0, 3], grano: [5, 0, 10], ciliegie: [25, 0, 5],
  legna: [1.5, 30, 20], erba_secca: [10, 0.3, 0.5],
  pentola: [60, 0, 3], ciotola: [20, 0, 4], mattone: [4, 0, 50],
  acciarino: [40, 0, 0], lenza: [25, 0, 0], coltello: [30, 0, 0], coperta: [150, 0, 0], cappotto: [400, 0, 0]
};
// attrezzi in vendita fin dall'inizio (pezzi), non si riforniscono ogni giorno
const ATTREZZI_INIZIALI = { pentola: 2, acciarino: 2, lenza: 3, coltello: 2, coperta: 3, cappotto: 3 };
export const RICARICO = 0.5;   // il Mercatino compra a meta' del prezzo a cui vende

// I CLIENTI DEMO: i 15 abitanti demo del borgo (gli stessi dei banconi, agenti/negozi.mjs) fanno la spesa
// ogni giorno al Mercatino. Comprano anche quello che producono gli agenti (pesce, ortaggi, pentole...):
// e' la loro domanda che da' valore al lavoro in proprio. Quanto comprano dipende dal prezzo
// (domanda elastica: piu' caro = meno), e i loro soldi arrivano da fuori (lavorano fuori dal borgo).
export const CLIENTI_DEMO = 15;
// kg (o pezzi) al giorno che comprerebbero tutti insieme al prezzo di listino
export const DOMANDA_DEMO = { pesce: 2.5, spinaci: 2, fave: 2, ciliegie: 3, grano: 6, pentola: 0.3, ciotola: 0.6, mattone: 20, legna: 15, erba_secca: 0.3, pane: 3 };
const ELASTICITA = 0.8;
export const domandaOggi = (m, k) => (DOMANDA_DEMO[k] || 0) * Math.pow(LISTINO[k][0] / m.prezzi[k], ELASTICITA);

export function nuovoMercato() {
  const m = { scorte: {}, prezzi: {}, compratoOggi: {}, vendutoOggi: {}, incasso: 0, pagato: 0 };
  for (const [k, [p]] of Object.entries(LISTINO)) { m.prezzi[k] = p; m.scorte[k] = 0; }
  Object.assign(m.scorte, ATTREZZI_INIZIALI);
  rifornisci(m);
  return m;
}

// Ogni mattina arriva la merce da fuori (non si accumula all'infinito: il Mercatino ne tiene al massimo 3 giorni)
export function rifornisci(m) {
  for (const [k, [, arriva]] of Object.entries(LISTINO)) if (arriva > 0) m.scorte[k] = Math.min(arriva * 3, (m.scorte[k] || 0) + arriva);
}

// Fine giornata: domanda e offerta. Se e' finito, +8%; se ne e' rimasto piu' di meta', -4%. Mai oltre il doppio o sotto la meta' del listino.
export function chiudiGiornataMercato(m) {
  // la spesa dei clienti demo
  m.demo = { comprato: {}, speso: 0 };
  for (const k of Object.keys(DOMANDA_DEMO)) {
    const vuole = domandaOggi(m, k), q = Math.min(m.scorte[k] || 0, vuole);
    if (q <= 0) { m.demo.comprato[k] = 0; continue; }
    m.scorte[k] = Math.round((m.scorte[k] - q) * 1000) / 1000; m.demo.comprato[k] = Math.round(q * 1000) / 1000;
    m.demo.speso += q * m.prezzi[k];
    // prodotti degli agenti: se la domanda non e' stata soddisfatta il prezzo sale, se ne avanza tanto scende
    if (!LISTINO[k][1]) m.prezzi[k] = Math.round(Math.max(LISTINO[k][0] * 0.5, Math.min(LISTINO[k][0] * 2, m.prezzi[k] * (q < vuole * 0.9 ? 1.08 : (m.scorte[k] || 0) > vuole ? 0.96 : 1))) * 100) / 100;
  }
  for (const k of Object.keys(DOMANDA_DEMO)) if (!LISTINO[k][1] && !(m.demo.comprato[k] > 0)) m.prezzi[k] = Math.round(Math.min(LISTINO[k][0] * 2, m.prezzi[k] * 1.08) * 100) / 100;   // nessuno ne porta: chi lo vuole lo paga di piu'
  m.demo.speso = Math.round(m.demo.speso);
  m.incassoDemo = (m.incassoDemo || 0) + m.demo.speso;
  for (const [k, [base, arriva]] of Object.entries(LISTINO)) {
    if (arriva > 0) {
      const finito = (m.scorte[k] || 0) < arriva * 0.1, avanza = (m.scorte[k] || 0) > arriva * 1.5;
      const p = m.prezzi[k] * (finito ? 1.08 : avanza ? 0.96 : 1);
      m.prezzi[k] = Math.round(Math.max(base * 0.5, Math.min(base * 2, p)) * 100) / 100;
    }
  }
  m.compratoOggi = {}; m.vendutoOggi = {};
  rifornisci(m);
}

export const prezzoDi = (m, cosa) => m.prezzi[cosa];
// Quanto il Mercatino compra oggi da chi produce: quello che pensa di rivendere ai clienti (domanda di un giorno e mezzo meno quello che ha gia')
export const limiteAcquisto = (m, cosa) => DOMANDA_DEMO[cosa] ? Math.max(0, domandaOggi(m, cosa) * 1.5 - (m.scorte[cosa] || 0)) : (LISTINO[cosa] || [])[2] || 0;
export const prezzoAcquisto = (m, cosa) => Math.round(m.prezzi[cosa] * RICARICO * 100) / 100;
export const perPezzo = cosa => !!OGGETTI[cosa];
export const eCommerciabile = cosa => !!LISTINO[cosa] && (MATERIALI[cosa] || OGGETTI[cosa]);
