// =====================================================================
//  VITA - NATURA
//  Meteo (dalle normali climatiche, con persistenza giorno per giorno),
//  piante che crescono con la temperatura (gradi-giorno, come in
//  agronomia), acqua nel terreno, pesci del laghetto (crescita logistica),
//  legna secca che cade dagli alberi, cibo che va a male (regola Q10),
//  legna che si bagna e si asciuga.
//  Tutto deterministico: lo stesso seme da' sempre la stessa storia.
// =====================================================================
import { CLIMA, climaDelGiorno, temperaturaAria, evapotraspirazione, sole } from './fisica.mjs';
import { MATERIALI } from './materiali.mjs';

// ---- numeri casuali riproducibili (mulberry32) ----
export function casuale(mondo) {
  let t = (mondo.rng = (mondo.rng + 0x6D2B79F5) >>> 0);
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}
export function gauss(mondo) {
  const u = Math.max(1e-9, casuale(mondo)), v = casuale(mondo);
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
}
const giornoDi = ms => Math.floor(ms / 86400000);

// ---- meteo ----
// Ogni giorno si decide (con il seme) se piove, quanto, il vento e lo scarto di temperatura.
export function meteoDelGiorno(mondo, ms) {
  const g = giornoDi(ms);
  if (mondo.meteo && mondo.meteo.giorno === g) return mondo.meteo;
  const prima = mondo.meteo;
  const m = new Date(ms).getUTCMonth(), giorniMese = new Date(Date.UTC(new Date(ms).getUTCFullYear(), m + 1, 0)).getUTCDate();
  const pMedia = CLIMA.giorniPioggia[m] / giorniMese;
  // la pioggia tende a durare piu' giorni (catena di Markov): dopo un giorno di pioggia e' piu' probabile
  const pioveIeri = prima && prima.giorno === g - 1 && prima.pioggiaMm > 0;
  const p = pioveIeri ? Math.min(0.85, pMedia * 2.2) : pMedia * 0.8;
  const piove = casuale(mondo) < p;
  const mmMedi = CLIMA.pioggiaMm[m] / Math.max(1, CLIMA.giorniPioggia[m]);
  const mm = piove ? Math.max(0.5, -Math.log(Math.max(1e-6, casuale(mondo))) * mmMedi) : 0;   // distribuzione esponenziale
  const scarto = (prima && prima.giorno === g - 1 ? prima.scarto * 0.7 : 0) + gauss(mondo) * 1.8;   // anomalie che durano qualche giorno
  const inizio = Math.floor(casuale(mondo) * 20), durata = piove ? Math.min(24 - inizio, Math.max(1, Math.round(mm / 2.5))) : 0;
  return (mondo.meteo = {
    giorno: g, pioggiaMm: mm, oraInizio: inizio, ore: durata, scarto,
    nuvole: piove ? 0.9 : Math.min(0.8, casuale(mondo) * 0.7),
    vento: Math.max(0.3, climaDelGiorno(ms, 'vento') * Math.exp(gauss(mondo) * 0.45)),
    umidita: Math.min(98, climaDelGiorno(ms, 'umidita') + (piove ? 15 : 0))
  });
}
// Il tempo che fa in questo istante
export function tempoAdesso(mondo, ms) {
  const mt = meteoDelGiorno(mondo, ms), h = new Date(ms).getUTCHours() + 1;   // ora di Roma circa (basta per la pioggia)
  const piove = mt.ore > 0 && h >= mt.oraInizio && h < mt.oraInizio + mt.ore;
  const intensita = piove ? mt.pioggiaMm / mt.ore : 0;                         // mm/h
  const nuvole = piove ? 1 : mt.nuvole;
  return { tAria: temperaturaAria(ms, mt.scarto, nuvole), piove, intensita, nuvole, vento: mt.vento, umidita: mt.umidita, sole: sole(ms) };
}
export function descriviTempo(t) {
  const T = Math.round(t.tAria), parole = T < 0 ? 'gelo' : T < 8 ? 'freddo' : T < 14 ? 'fresco' : T < 22 ? 'mite' : T < 29 ? 'caldo' : 'molto caldo';
  const cielo = t.piove ? (t.intensita > 4 ? 'piove forte' : 'piove') : t.nuvole > 0.6 ? 'nuvoloso' : t.nuvole > 0.3 ? 'qualche nuvola' : (t.sole.giorno ? 'sereno' : 'cielo stellato');
  const vento = t.vento > 6 ? ', vento forte' : t.vento > 3.5 ? ', ventilato' : '';
  return `${parole} (circa ${T} gradi), ${cielo}${vento}`;
}

// ---- colture ----
// base: temperatura sotto la quale non cresce; gdd: gradi-giorno per arrivare al raccolto;
// resa: kg di raccolto per m2; semi: kg di seme per m2. Valori agronomici tipici del centro Italia.
export const COLTURE = {
  grano: { nome: 'grano', base: 0, gdd: 2100, resa: 0.4, prodotto: 'grano', semi: 0.02, seme: 'semi_grano', nota: 'si semina in autunno: seminato in primavera fa poco (gli manca il freddo dell\'inverno)' },
  fave: { nome: 'fave', base: 3, gdd: 1300, resa: 0.45, prodotto: 'fave', semi: 0.015, seme: 'semi_fave' },
  spinaci: { nome: 'spinaci', base: 2, gdd: 650, resa: 1.5, prodotto: 'spinaci', semi: 0.002, seme: 'semi_spinaci', tMax: 26, nota: 'sopra 26 gradi va in seme e non si raccoglie' }
};
export const SUOLO_MAX_MM = 90;   // acqua che un'aiuola trattiene (capacita' di campo, mm)

export function crescePianta(aiuola, dtOre, mondo, ms, tAria, pioggiaMm) {
  aiuola.acqua = Math.min(SUOLO_MAX_MM, (aiuola.acqua ?? 60) + pioggiaMm);
  const et = evapotraspirazione(ms) / 24 * dtOre * (aiuola.coltura ? 1 : 0.4);
  aiuola.acqua = Math.max(0, aiuola.acqua - et);
  if (!aiuola.coltura || aiuola.morta || aiuola.pronta) return null;
  const C = COLTURE[aiuola.coltura];
  const stress = aiuola.acqua > 30 ? 1 : aiuola.acqua / 30;
  aiuola.gdd += Math.max(0, tAria - C.base) * dtOre / 24 * stress;
  if (aiuola.acqua <= 0.5) aiuola.secco = (aiuola.secco || 0) + dtOre; else aiuola.secco = 0;
  if (aiuola.secco > 24 * 6) { aiuola.morta = true; return { tipo: 'pianta_morta', aiuola: aiuola.id, motivo: 'senz\'acqua' }; }
  if (C.tMax && tAria > C.tMax) aiuola.caldo = (aiuola.caldo || 0) + dtOre;
  if (aiuola.gdd >= C.gdd) { aiuola.pronta = true; return { tipo: 'raccolto_pronto', aiuola: aiuola.id }; }
  return null;
}
export function statoPianta(a) {
  if (!a.coltura) return 'terra vuota' + (a.acqua < 15 ? ' e secca' : '');
  const C = COLTURE[a.coltura];
  if (a.morta) return `${C.nome} secco, morto`;
  if (a.pronta) return `${C.nome} pronto da raccogliere`;
  const f = a.gdd / C.gdd;
  return `${C.nome} ${f < 0.1 ? 'appena seminato' : f < 0.35 ? 'germogliato' : f < 0.7 ? 'cresce' : 'quasi maturo'}` + (a.acqua < 20 ? ', la terra e\' secca' : '');
}

// ---- laghetto: pesci con crescita logistica ----
// Un laghetto di ~300 m2 regge ~45 kg di pesce; si riproducono a un tasso r ~ 1 all'anno.
// Se si pesca piu' di quanto ricresce, il laghetto si svuota (come nella realta').
export const LAGHETTO = { capacita: 45, r: 1.0, catturabilita: 0.009, pesoMedio: 0.25 };
export function crescePesci(lago, dtOre) {
  const B = lago.pesci, K = LAGHETTO.capacita;
  lago.pesci = Math.max(0, B + LAGHETTO.r * B * (1 - B / K) * dtOre / (24 * 365));
}
// Pesca per "ore": restituisce i pesci presi (kg ciascuno). Processo di Poisson.
export function pesca(mondo, lago, ore, abilita = 0) {
  const presi = [];
  let t = 0;
  const tasso = LAGHETTO.catturabilita * lago.pesci / LAGHETTO.pesoMedio * (0.6 + 0.6 * abilita);   // pesci all'ora
  if (tasso <= 0) return presi;
  while (true) {
    t += -Math.log(Math.max(1e-9, casuale(mondo))) / tasso;
    if (t > ore) break;
    const kg = Math.min(lago.pesci, Math.max(0.08, LAGHETTO.pesoMedio * Math.exp(gauss(mondo) * 0.4)));
    if (kg <= 0.05) break;
    lago.pesci -= kg; presi.push(Math.round(kg * 1000) / 1000);
  }
  return presi;
}

// ---- alberi: rami secchi e ciliegie ----
// Un piccolo albero da giardino lascia cadere (o da' con la potatura) ~8 kg di rami all'anno.
// I ciliegi fanno frutti solo tra fine maggio e fine giugno.
export function cresconoAlberi(alberi, dtOre, ms) {
  const d = new Date(ms), m = d.getUTCMonth(), g = d.getUTCDate();
  const stagione = (m === 4 && g >= 25) || (m === 5 && g <= 28);
  for (const a of alberi) {
    a.rami = Math.min(6, a.rami + 8 / (24 * 365) * dtOre);
    if (a.tipo === 'ciliegio') {
      if (stagione && !a.raccoltoAnno) a.ciliegie = Math.min(8, (a.ciliegie || 0) + 8 / (24 * 20) * dtOre);
      else if (!stagione && a.ciliegie > 0) a.ciliegie = Math.max(0, a.ciliegie - 0.5 * dtOre / 24);   // cadono e marciscono
      if (m === 0) a.raccoltoAnno = false;
    }
  }
}

// ---- cose che cambiano col tempo: cibo che va a male, legna che si bagna o si asciuga ----
// bagnato: 0..1 (o true) quanto la cosa e' esposta alla pioggia; umiditaAria: % relativa
export function invecchia(cosa, dtOre, tAria, bagnato, vicinoFuoco = false, umiditaAria = 75) {
  const M = MATERIALI[cosa.cosa];
  if (!M) return;
  const T = cosa.T ?? tAria;
  if (M.dura20) {
    const velocita = Math.pow(M.q10 || 2, (Math.max(-5, T) - 20) / 10);
    cosa.guasto = (cosa.guasto || 0) + dtOre / M.dura20 * velocita;
  }
  if (cosa.umid != null) {
    // umidita' di equilibrio del legno con l'aria (~15% al 70% di umidita', ~20% oltre l'85%); sotto la pioggia si inzuppa
    // umidita' di equilibrio con l'aria (curva di assorbimento del legno, circa): 9% a 50% di umidita', 14% a 77%, 19% a 95%
    const emc = 0.05 + 0.15 * Math.pow(Math.min(100, umiditaAria) / 100, 1.5);
    const b = bagnato === true ? 1 : +bagnato || 0;
    const equilibrio = vicinoFuoco ? 0.05 : emc + (0.45 - emc) * b;
    const tau = { erba_secca: 3, rami: 72, legna: 24 * 40, carbone: 48 }[cosa.cosa] || 48;   // ore
    const k = vicinoFuoco ? 8 : 1 + 5 * b;   // bagnarsi e' piu' veloce che asciugarsi
    cosa.umid = equilibrio + (cosa.umid - equilibrio) * Math.exp(-dtOre * k / tau);
  }
  if (cosa.secca != null) {
    // l'argilla modellata asciuga all'aria in qualche giorno (meno se piove o fa freddo)
    if (!bagnato) cosa.secca = Math.min(1, cosa.secca + dtOre / (24 * 5) * Math.max(0.2, (tAria + 5) / 25));
  }
}
