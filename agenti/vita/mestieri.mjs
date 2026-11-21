// =====================================================================
//  VITA - I MESTIERI
//  Due modi di guadagnare, come nella realta':
//   1) DIPENDENTI: un turno in una bottega del borgo, con orari veri,
//      posti limitati e paga oraria. Il lavoro stanca (MET) e fa sudare;
//      con l'esperienza si diventa piu' bravi e si guadagna di piu'.
//   2) IN PROPRIO: pescatore, ortolano, vasaio, legnaiolo, cuoco... si
//      produce con le azioni del corpo e si vende al Mercatino.
//  Il bancone di Caffetteria, Forno e Fioraio (agenti/negozi.mjs, in un
//  altro lavoro) e' la parte "vendere ai clienti"; qui c'e' la parte del
//  corpo e del tempo: quante ore, quanta fatica, quanta paga.
// =====================================================================

// x, z: davanti alla porta (stesse coordinate di motore.mjs). dalle/alle: ore di Roma. paga: Starlight all'ora.
export const MESTIERI = {
  fornaio: { nome: 'fornaio', luogo: 'Forno', x: 44, z: -3, dalle: 5, alle: 12, paga: 34, met: 3.0, posti: 1, extra: { pane: 0.25 },
    descrizione: 'impasti e sforni il pane prima dell\'alba; a fine turno ti danno il pane avanzato' },
  barista: { nome: 'barista', luogo: 'Caffetteria', x: 18, z: -3, dalle: 7, alle: 19, paga: 30, met: 2.5, posti: 1, descrizione: 'caffe\', cornetti, sempre in piedi' },
  fioraio: { nome: 'fioraio', luogo: 'Fioraio', x: 47, z: 50, dalle: 9, alle: 18, paga: 28, met: 2.5, posti: 1, descrizione: 'composizioni, acqua ai fiori, clienti' },
  facchino: { nome: 'facchino del Mercatino', luogo: 'Mercatino', x: 0, z: 8, dalle: 6, alle: 11, paga: 36, met: 4.5, posti: 2, descrizione: 'scarichi le casse che arrivano da fuori: lavoro pesante' },
  bibliotecario: { nome: 'bibliotecario', luogo: 'Biblioteca', x: -27.7, z: -3.5, dalle: 9, alle: 18, paga: 28, met: 1.8, posti: 1, alChiuso: true, descrizione: 'ordini libri, aiuti chi legge; si sta al caldo' },
  spazzino: { nome: 'spazzino', luogo: 'Fontana', x: 0, z: 34, dalle: 6, alle: 10, paga: 30, met: 3.5, posti: 1, descrizione: 'pulisci la piazza, all\'aperto con ogni tempo' }
};
export const IN_PROPRIO = {
  pescatore: 'peschi al Laghetto e vendi il pesce al Mercatino',
  ortolano: 'coltivi le aiuole e vendi il raccolto',
  vasaio: 'modelli e cuoci l\'argilla: pentole, ciotole, mattoni',
  legnaiolo: 'raccogli rami e legna e li vendi',
  cuoco: 'cucini e vendi il pane che fai'
};
export const ORE_MAX_GIORNO = 10;

// Esperienza: con le ore si diventa piu' bravi (curva di apprendimento), fino a +40% di paga.
export const competenza = ore => 1 - Math.exp(-(ore || 0) / 200);
export const pagaOraria = (m, oreFatte) => Math.round(m.paga * (0.8 + 0.4 * competenza(oreFatte)) * 100) / 100;

export function cercaMestiere(nome) {
  const n = String(nome || '').toLowerCase().trim();
  if (!n) return null;
  if (MESTIERI[n]) return n;
  return Object.keys(MESTIERI).find(k => n.includes(k) || k.includes(n) || MESTIERI[k].nome.includes(n) || MESTIERI[k].luogo.toLowerCase() === n) || null;
}

export function descriviMestieri() {
  return Object.entries(MESTIERI).map(([k, m]) => `${k} (${m.luogo}, ${m.dalle}-${m.alle}, ${m.paga} Starlight/ora: ${m.descrizione})`).join('; ');
}
