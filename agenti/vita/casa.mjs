// =====================================================================
//  VITA - LA CASA
//  Ogni abitante ha una casetta sua in piazza (deciso da Boris il 21/11/2026),
//  sul lato sud, verso la Porta del Borgo. Dentro (8 x 7 m) c'e' quello che
//  serve per vivere, e funziona con la fisica vera:
//  Dentro c'e' quello che serve per vivere, e funziona con la fisica vera:
//   - CUCINA: fornello a metano (2 kW, ~45% del calore va nella pentola);
//   - BAGNO: water e doccia con l'acqua scaldata dalla caldaia;
//   - LETTO con piumone: si dorme al caldo anche a riscaldamento spento;
//   - FRIGO a 4 gradi: il cibo dura di piu' (legge Q10, come in natura.mjs);
//   - RISCALDAMENTO: la casa perde calore verso fuori (U*A per la
//     differenza di temperatura) e la caldaia lo rimette, bruciando metano.
//  Si paga quello che si consuma: gas, luce e acqua, a fine giornata, in
//  Starlight. Chi non paga per troppo tempo resta senza gas e senza luce.
//  L'affitto per ora e' zero: la casa gliela da' il borgo.
// =====================================================================
import { reagisci } from './chimica.mjs';
import { versoAria } from './fisica.mjs';

// Dove abitano: casetta in piazza (x, z del centro; la porta guarda a nord, verso la fontana).
// Stesse coordinate di src/borgo/casette-agenti.js. Dentro, la stanza va da x -4 a 4 e da z -3,5 a 3,5.
export const CASETTE = {
  ada: { stanza: 'casa_ada', nome: 'Casa di Ada', x: -22, z: 63, porta: { x: -22, z: 59.6 } },
  teo: { stanza: 'casa_teo', nome: 'Casa di Teo', x: 22, z: 63, porta: { x: 22, z: 59.6 } }
};
// per abitanti in piu': altre casette lungo il lato sud
const casettaNuova = (id, i) => { const x = (i % 2 ? 1 : -1) * (8 + 6 * Math.floor(i / 2)); return { stanza: 'casa_' + id, nome: 'Casa di ' + id[0].toUpperCase() + id.slice(1), x, z: 63, porta: { x, z: 59.6 } }; };
export const casettaDi = (id, i = 0) => CASETTE[id] || casettaNuova(id, i);

export const CASA = {
  m2: 55,
  UA: 110,                 // W/K: dispersione di un appartamento di 55 m2 in un palazzo anni '70 un po' isolato
  capacita: 1.2e7,         // J/K: muri, pavimenti, mobili (si raffredda in circa un giorno a caldaia spenta)
  termostato: 19,          // gradi, come chiede la legge italiana d'inverno
  caldaiaW: 24000, rendCaldaia: 0.9,
  fornelloW: 2000,         // un fuoco medio del piano cottura
  frigoT: 4, frigoKWhGiorno: 0.8, luciKWhGiorno: 0.5,
  docciaLitri: 40, docciaT: 40, acquaRete: 14,
  piumoneClo: 2.5
};
// Tariffe (1 Starlight = 0,20 euro): metano 1,10 euro/m3, luce 0,30 euro/kWh, acqua 2 euro/m3
export const TARIFFE = { gasM3: 5.5, kWh: 1.5, acquaM3: 10, affittoGiorno: 0 };
export const METANO_J_M3 = (() => { const r = reagisci('combustione_metano', 0.717); return -r.energiaJ; })();   // 1 m3 di metano pesa 0,717 kg
export const DEBITO_MAX = 150;   // Starlight di bollette non pagate prima che stacchino gas e luce

export function nuoveCase(abitanti) {
  const case_ = {};
  abitanti.forEach((id, i) => {
    const k = casettaDi(id, i);
    case_[id] = { id, stanza: k.stanza, nome: k.nome, porta: k.porta, T: CASA.termostato, termostato: CASA.termostato, gasM3: 0, kWh: 0, acquaL: 0, debito: 0, staccato: false, bollette: [] };
  });
  return case_;
}
export const casaDi = (mondo, c) => (mondo.case || {})[c.id] || null;
export const aCasa = (mondo, c) => { const k = casaDi(mondo, c); return !!(k && c.stanza === k.stanza); };
export const fornelloDi = (mondo, k) => mondo.fuochi.find(f => f.id === 'fornello:' + k.id);
export const fornelloNuovo = k => ({ id: 'fornello:' + k.id, nome: 'fornello di casa', fisso: true, gas: true, struttura: 'fornello', stanza: k.stanza, casa: k.id, x: 0, z: 0, legna: [], T: null, sopra: [], acceso: false });

// Un passo di dt secondi per una casa: temperatura, caldaia, frigo, consumi.
export function viviCasa(mondo, k, dt, tFuori, dentro) {
  const ore = dt / 3600;
  // calore che entra: caldaia (fino al termostato), fornello acceso, persone dentro (~100 W l'una)
  const fornello = fornelloDi(mondo, k);
  const Pcucina = fornello && fornello.acceso ? CASA.fornelloW * 0.55 : 0;   // quello che non va nella pentola scalda la cucina
  const Ppersone = dentro * 100;
  const perdita = CASA.UA * (k.T - tFuori);
  let Pcaldaia = 0;
  if (!k.staccato && k.T < k.termostato + 0.01) {
    const serve = CASA.UA * (k.termostato - tFuori) - Pcucina - Ppersone + (k.termostato - k.T) * CASA.capacita / Math.max(dt, 600);
    Pcaldaia = Math.max(0, Math.min(CASA.caldaiaW, serve));
  }
  k.T += (Pcaldaia + Pcucina + Ppersone - perdita) * dt / CASA.capacita;
  if (!k.staccato && k.T > k.termostato && Pcaldaia > 0) k.T = k.termostato;
  // consumi: gas della caldaia (col suo rendimento) e del fornello
  k.gasM3 += (Pcaldaia / CASA.rendCaldaia + (fornello && fornello.acceso ? CASA.fornelloW : 0)) * dt / METANO_J_M3;
  if (!k.staccato) k.kWh += (CASA.frigoKWhGiorno + CASA.luciKWhGiorno) / 24 * ore;
  return { Pcaldaia };
}

// Doccia calda: l'energia per scaldare l'acqua (m*c*dT) la mette la caldaia, a metano.
export function doccia(k) {
  const litri = CASA.docciaLitri;
  k.acquaL += litri;
  if (k.staccato) return { calda: false, litri };
  const J = litri * 4186 * (CASA.docciaT - CASA.acquaRete) / CASA.rendCaldaia;
  k.gasM3 += J / METANO_J_M3;
  return { calda: true, litri, MJ: J / 1e6 };
}

// Fine giornata: arriva la bolletta. Si paga se si puo'; altrimenti cresce il debito e prima o poi staccano gas e luce.
export function bollettaDelGiorno(k, c) {
  const importo = Math.round((k.gasM3 * TARIFFE.gasM3 + k.kWh * TARIFFE.kWh + k.acquaL / 1000 * TARIFFE.acquaM3 + TARIFFE.affittoGiorno) * 100) / 100;
  k.bollette.push({ gasM3: +k.gasM3.toFixed(3), kWh: +k.kWh.toFixed(2), acquaL: Math.round(k.acquaL), importo });
  if (k.bollette.length > 7) k.bollette.shift();
  k.gasM3 = 0; k.kWh = 0; k.acquaL = 0;
  const daPagare = importo + k.debito, paga = Math.max(0, Math.min(c.starlight ?? 0, daPagare));
  c.starlight = Math.round(((c.starlight ?? 0) - paga) * 100) / 100;
  k.debito = Math.round((daPagare - paga) * 100) / 100;
  const prima = k.staccato;
  k.staccato = k.debito > DEBITO_MAX ? true : k.debito <= 0 ? false : k.staccato;
  return { importo, pagato: paga, debito: k.debito, staccato: k.staccato, cambiato: prima !== k.staccato };
}

// Temperatura del frigo (se c'e' la luce) o della casa
export const temperaturaFrigo = k => (k.staccato ? k.T : CASA.frigoT);
export const raffreddaInFrigo = (q, k, dt) => { if (q.T != null) q.T = versoAria(q.T, temperaturaFrigo(k), q.kg, 3500, dt, 5); };
