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
export const prezzoAcquisto = (m, cosa) => Math.round(m.prezzi[cosa] * RICARICO * 100) / 100;
export const perPezzo = cosa => !!OGGETTI[cosa];
export const eCommerciabile = cosa => !!LISTINO[cosa] && (MATERIALI[cosa] || OGGETTI[cosa]);
