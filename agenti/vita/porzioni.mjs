// =====================================================================
//  PORZIONI: il cibo e le bevande comprati ai negozi (Caffetteria, Forno, negozi sui terreni)
//  Quello che si compra al bancone finisce nello zaino del borgo (ag.zaino, a pezzi: {"Cornetto": 2}).
//  Fino al 22/11/2026 non si poteva ne' mangiare ne' bere: restava nello zaino per sempre.
//  Qui ogni prodotto ha la sua porzione vera: peso, calorie, acqua. Mangiarla passa dal corpo
//  (stomaco, calorie, acqua, soddisfazione) come il cibo della vita vera.
//  Quello che non e' cibo (fiori, piante, oggetti, olio, uova crude) qui non c'e': "non si mangia".
// =====================================================================
import { mangia as mangiaCorpo, bevi as beviCorpo } from './corpo.mjs';
import { soddisfa } from './umano.mjs';

// kg = peso della porzione, kcal = calorie della porzione intera, acqua = litri d'acqua dentro, bevanda = si beve
export const PORZIONI = {
  "caffe'": { kg: 0.05, kcal: 2, acqua: 0.05, bevanda: true },
  'cappuccino': { kg: 0.15, kcal: 90, acqua: 0.13, bevanda: true },
  'cioccolata calda': { kg: 0.2, kcal: 220, acqua: 0.16, bevanda: true },
  'spremuta': { kg: 0.2, kcal: 90, acqua: 0.18, bevanda: true },
  'cornetto': { kg: 0.07, kcal: 280, acqua: 0.01 },
  'fetta di torta': { kg: 0.12, kcal: 400, acqua: 0.03 },
  'pane': { kg: 0.25, kcal: 660, acqua: 0.09 },
  'pane integrale': { kg: 0.25, kcal: 600, acqua: 0.09 },
  'focaccia': { kg: 0.15, kcal: 450, acqua: 0.04 },
  'pizza al taglio': { kg: 0.2, kcal: 520, acqua: 0.08 },
  'biscotti': { kg: 0.1, kcal: 480, acqua: 0.005 },
  'crostata': { kg: 0.5, kcal: 1900, acqua: 0.08 },
  'panino': { kg: 0.2, kcal: 500, acqua: 0.07 },
  'tramezzino': { kg: 0.12, kcal: 300, acqua: 0.05 },
  'ciambella': { kg: 0.08, kcal: 320, acqua: 0.02 },
  'pasticcino': { kg: 0.04, kcal: 160, acqua: 0.01 },
  'cannolo': { kg: 0.1, kcal: 380, acqua: 0.03 },
  "tiramisu'": { kg: 0.12, kcal: 360, acqua: 0.05 },
  'gelato': { kg: 0.1, kcal: 200, acqua: 0.06 },
  'torta intera': { kg: 1, kcal: 3500, acqua: 0.25 },
  'cioccolatino': { kg: 0.01, kcal: 55, acqua: 0 },
  'frutta di stagione': { kg: 0.3, kcal: 150, acqua: 0.25 },
  'formaggio': { kg: 0.2, kcal: 750, acqua: 0.07 },
  'prosciutto': { kg: 0.1, kcal: 270, acqua: 0.06 },
  'marmellata': { kg: 0.3, kcal: 750, acqua: 0.09 }
};
export const chiavePorzione = n => String(n || '').toLowerCase().replace(/[’`]/g, '\'').replace(/\s+/g, ' ').trim();
export const porzioneDi = n => PORZIONI[chiavePorzione(n)] || null;

// Mangia o beve UNA porzione. Le porzioni grandi (crostata, torta intera) si mangiano a pezzi:
// quello che resta torna nello zaino come "mezza" porzione (si tiene il conto in kg nascosto: ag.avanzi).
// Restituisce { ok, esito, finita } — finita = la porzione e' consumata tutta (togliere il pezzo dallo zaino).
export function consumaPorzione(c, nome, P, avanzoKg, adesso, tipo) {
  if (!c) return { ok: false, esito: 'non hai un corpo' };
  if (P.bevanda && tipo === 'mangia') tipo = 'bevi';
  if (!P.bevanda && tipo === 'bevi') return { ok: false, esito: `${nome} non si beve: si mangia ({"tipo":"mangia","nome":"${nome}"})` };
  const kg = avanzoKg > 0 ? Math.min(avanzoKg, P.kg) : P.kg, quota = kg / P.kg;
  let presi;
  if (P.bevanda) {
    presi = beviCorpo(c, P.acqua * quota, adesso);
    if (presi <= 0) return { ok: false, esito: 'sei troppo pieno per bere' };
    const k = P.kcal * quota; c.stomaco.kcal += k; c.mangiatoOggi = (c.mangiatoOggi || 0) + k;   // lo zucchero e il latte nutrono
    presi = kg;
  } else {
    presi = mangiaCorpo(c, { kg, kcal: P.kcal / P.kg, acqua: P.acqua / P.kg }, adesso);
    if (presi <= 0) return { ok: false, esito: 'sei troppo pieno per mangiare' };
  }
  soddisfa(c, 0.05);
  const resta = Math.round((kg - presi) * 1000) / 1000;
  return { ok: true, finita: resta <= 0.005, resta, esito: resta > 0.005 ? `ne hai ${tipo === 'bevi' ? 'bevuto' : 'mangiato'} una parte (${presi.toFixed(2)} kg); il resto e' ancora nello zaino` : `${tipo === 'bevi' ? 'bevuto' : 'mangiato'}: ${nome}` };
}
