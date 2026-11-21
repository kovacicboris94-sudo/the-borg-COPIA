// =====================================================================
//  VITA - LA PARTE UMANA
//  Oltre a mangiare, bere e dormire una persona vera:
//   - deve andare in bagno (la vescica si riempie con l'acqua bevuta);
//   - si sporca e suda, e deve lavarsi;
//   - si sente sola se non parla con nessuno;
//   - si annoia se fa sempre la stessa cosa;
//   - si preoccupa se non ha soldi;
//   - ha un umore che dipende da tutto questo, e l'umore cambia quanto
//     rende al lavoro.
//  Tutto e' codice: il modello sente solo come si sente, a parole.
// =====================================================================
import { metDi } from './corpo.mjs';

export const BAGNI = ['biblioteca', 'sala', 'scacchi', 'negozio', 'collectibles', 'torre0'];   // edifici con un bagno (e acqua calda)

export function nuovoUmano() {
  return { vescica: 0.1, igiene: 0.9, solitudine: 0.2, noia: 0.2, umore: 0.3, soddisfazioni: 0 };
}
const lim = (v, a, b) => Math.max(a, Math.min(b, v));

// Un passo di dt secondi. altri: quanti abitanti ci sono entro 10 metri (svegli).
export function viviUmano(c, dt, { altri = 0, sole = false, svago = false } = {}) {
  const u = c.umano || (c.umano = nuovoUmano()), ore = dt / 3600, ev = [];
  if (c.morto) return ev;
  const sveglio = !c.addormentato && !c.svenuto;
  // vescica: i reni producono ~1,4 L di urina al giorno, di piu' se si e' bevuto tanto, meno se si e' disidratati
  const idratazione = (c.acqua - c.acquaNormale) / c.peso;
  // di notte, dormendo, l'ormone antidiuretico fa produrre circa un terzo dell'urina
  u.vescica += (0.058 * (idratazione > 0 ? 1.5 : idratazione < -0.02 ? 0.4 : 1) * (c.addormentato ? 0.35 : 1)) * ore;
  if (u.vescica > 0.6) { u.vescica = 0; u.igiene = Math.max(0, u.igiene - 0.5); u.umore -= 0.4; ev.push({ tipo: 'incidente' }); }
  // igiene: ci si sporca col tempo, col sudore e con i lavori sporchi (terra, argilla, pesce)
  const sporco = { raccogliere: 0.03, modellare: 0.06, seminare: 0.05, pescare: 0.02, spaccare: 0.04 }[c.attivita] || 0;
  u.igiene = Math.max(0, u.igiene - (0.035 / 24 + Math.max(0, (metDi(c) - 3)) * 0.01 + sporco) * ore);
  // solitudine e noia (solo da svegli)
  if (sveglio) {
    u.solitudine = lim(u.solitudine + (altri > 0 ? -0.05 : 0.03) * ore, 0, 1);
    u.noia = lim(u.noia + (svago ? -0.3 : c.lavoro && c.lavoro.tipo === 'lavora' ? 0.025 : 0.015) * ore, 0, 1);
  }
  // umore: tende a un valore che dipende da corpo, compagnia, soldi, pulizia, luce del sole
  const dis = (c.acquaNormale - c.acqua) / c.peso;
  let bersaglio = 0.35;
  bersaglio -= c.glicogeno < 600 ? 0.3 : c.glicogeno < 1100 ? 0.1 : 0;
  bersaglio -= dis > 0.03 ? 0.3 : dis > 0.015 ? 0.1 : 0;
  bersaglio -= c.sonno > 1.2 ? 0.3 : c.sonno > 0.9 ? 0.1 : 0;
  bersaglio -= c.malattie.length ? 0.35 : 0;
  bersaglio -= (c.ambiente && c.ambiente.freddo) ? 0.2 : 0;
  bersaglio -= u.solitudine * 0.35 + u.noia * 0.25;
  bersaglio -= u.igiene < 0.3 ? 0.15 : 0;
  bersaglio -= (c.starlight ?? 100) < 30 ? 0.25 : (c.starlight ?? 100) < 80 ? 0.08 : 0;
  bersaglio += sole && sveglio ? 0.08 : 0;
  bersaglio += Math.min(0.3, u.soddisfazioni);
  u.soddisfazioni = Math.max(0, u.soddisfazioni - 0.1 * ore);   // le cose belle si sentono per qualche ora
  u.umore = lim(u.umore + (bersaglio - u.umore) * (1 - Math.exp(-ore / 3)), -1, 1);
  return ev;
}

// L'umore cambia quanto si rende: giu' di morale si lavora peggio
export const rendimento = c => 1 + 0.15 * lim((c.umano || {}).umore ?? 0.3, -1, 1);
// Una bella cosa (paga, buon pasto, chiacchierata) alza un po' l'umore per qualche ora
export const soddisfa = (c, quanto) => { const u = c.umano || (c.umano = nuovoUmano()); u.soddisfazioni = Math.min(0.6, u.soddisfazioni + quanto); };

export function sensazioniUmane(c) {
  const u = c.umano; if (!u || c.morto || c.svenuto) return [];
  const s = [];
  if (u.vescica > 0.45) s.push('ti scappa molto, devi trovare un bagno subito');
  else if (u.vescica > 0.3) s.push('devi andare in bagno');
  if (u.igiene < 0.25) s.push('sei sporco e sudato, si sente');
  else if (u.igiene < 0.5) s.push('avresti bisogno di lavarti');
  if (u.solitudine > 0.7) s.push('ti senti molto solo');
  else if (u.solitudine > 0.45) s.push('hai voglia di parlare con qualcuno');
  if (u.noia > 0.65) s.push('ti annoi tantissimo');
  else if (u.noia > 0.45) s.push('ti annoi un po\'');
  if ((c.starlight ?? 100) < 30) s.push('sei preoccupato: quasi non hai piu\' soldi');
  s.push(u.umore > 0.55 ? 'sei di ottimo umore' : u.umore > 0.2 ? 'sei di buon umore' : u.umore > -0.2 ? 'umore cosi\' cosi\'' : u.umore > -0.55 ? 'sei giu\' di morale' : 'sei molto triste');
  return s;
}
