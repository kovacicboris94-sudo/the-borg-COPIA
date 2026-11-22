// =====================================================================
//  GLI INTERNI DEI NEGOZI E DEGLI EDIFICI (22/11/2026, Boris: "rendi tutto
//  esplorabile e metti piu' mestieri: ogni casa e mestiere deve funzionare")
//  Prima Caffetteria, Forno, Fioraio, Banca e i negozi sui terreni avevano
//  solo la facciata: il bancone stava fuori, in piazza. Ora si entra, e il
//  bancone, gli sportelli, il forno a legna e la dottoressa sono dentro.
//  Le misure sono le stesse del gioco (src/borgo/interni.js): stanza di
//  12 x 10 m (la banca 14 x 10), porta a sud, bancone in mezzo.
//  Stesso formato di STANZE in motore.mjs: porta = dove si entra in piazza,
//  arrivo = dove ci si trova dentro, uscita = la porta da dentro,
//  ritorno = dove ci si trova in piazza uscendo.
// =====================================================================

const RECT = { x0: -6, x1: 6, z0: -5, z1: 5 };
const DENTRO = { arrivo: { x: 0, z: 3.6 }, uscita: { x: 0, z: 4.2 } };
// il bancone di ogni negozio, nelle coordinate della stanza: chi vende sta dietro (verso il fondo), il cliente davanti
export const BANCONE = { bancone: { x: 0, z: -1.6, rot: 0 }, venditore: { x: 0, z: -2.8 }, cliente: { x: 0, z: -0.3 } };

export const INTERNI = [
  { id: 'caffetteria', nome: 'Caffetteria', tipo: 'bar', porta: { x: 18.3, z: -3.5 }, ritorno: { x: 18.3, z: -3 }, rect: RECT, ...DENTRO },
  { id: 'forno', nome: 'Forno', tipo: 'forno', porta: { x: 44, z: -3.5 }, ritorno: { x: 44, z: -3 }, rect: RECT, ...DENTRO },
  { id: 'fioraio', nome: 'Fioraio', tipo: 'fiori', porta: { x: 47.4, z: 50 }, ritorno: { x: 46.6, z: 50 }, rect: RECT, ...DENTRO },
  { id: 'arredamenti', nome: 'Arredamenti', tipo: 'arredi', porta: { x: -47.4, z: 4 }, ritorno: { x: -46.6, z: 4 }, rect: RECT, ...DENTRO },
  { id: 'banca', nome: 'Banca del Borgo', tipo: 'banca', porta: { x: 32, z: 44.1 }, ritorno: { x: 32, z: 43.2 }, rect: { x0: -7, x1: 7, z0: -5, z1: 5 }, ...DENTRO },
  { id: 'ambulatorio', nome: 'Ambulatorio del Borgo', tipo: 'ambulatorio', porta: { x: 31, z: -3.5 }, ritorno: { x: 31, z: -3 }, rect: RECT, ...DENTRO }
];
// dentro la banca: dove si sta allo sportello (davanti al vetro)
export const SPORTELLO = { x: -2.5, z: -1.2 };
// dentro l'ambulatorio: la sedia davanti alla scrivania della dottoressa
export const VISITA = { x: 3.4, z: -0.4 };

// L'interno di un negozio costruito su un terreno: si chiama "bottega_<lotto>" e la porta e' quella dell'edificio sul lotto.
export const idBottega = lotto => 'bottega_' + lotto;
export function internoBottega(lotto, nome, genere, geo) {
  return { id: idBottega(lotto), nome, tipo: genere || 'bottega', lotto, porta: { x: geo.porta.x, z: geo.porta.z }, ritorno: { x: geo.ritorno.x, z: geo.ritorno.z }, rect: RECT, ...DENTRO };
}
