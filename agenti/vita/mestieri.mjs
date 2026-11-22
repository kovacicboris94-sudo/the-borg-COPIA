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
//  corpo e del tempo: quante ore, quanta fatica, quanta paga. Cosa produce
//  il lavoro (pane sugli scaffali, cantieri piu' veloci, piazza pulita...)
//  lo applica agenti/lavori.mjs, che vede tutto il borgo.
// =====================================================================

// x, z: dove si va in piazza (la porta, per chi lavora dentro). stanza: l'interno dove si lavora (agenti/interni.mjs),
// posto: dove si sta dentro (coordinate della stanza). dalle/alle: ore di Roma. paga: Starlight all'ora.
// effetto: cosa cambia davvero nel borgo il lavoro fatto (lo applica agenti/lavori.mjs a fine turno).
// Dal 22/11/2026 (Boris: "metti piu' mestieri, ogni mestiere deve funzionare") ogni mestiere produce o fa qualcosa di vero.
export const MESTIERI = {
  fornaio: { nome: 'fornaio', luogo: 'Forno', stanza: 'forno', posto: { x: -3.4, z: -1.6 }, x: 44, z: -3.5, dalle: 5, alle: 12, paga: 34, met: 3.0, posti: 1, extra: { pane: 0.25 },
    descrizione: 'sforni il pane del Forno: ~16 pani, 4 focacce, 3 pizze e 4 integrali all\'ora' },
  pasticcere: { nome: 'pasticcere', luogo: 'Caffetteria', stanza: 'caffetteria', posto: { x: 2.4, z: -3.6 }, x: 18.3, z: -3.5, dalle: 4, alle: 11, paga: 32, met: 2.5, posti: 1,
    descrizione: 'cornetti e torte per la Caffetteria, biscotti e crostate per il Forno' },
  barista: { nome: 'barista', luogo: 'Caffetteria', stanza: 'caffetteria', posto: { x: -1.6, z: -3.6 }, x: 18.3, z: -3.5, dalle: 7, alle: 19, paga: 30, met: 2.5, posti: 1,
    descrizione: 'caffe\' e spremute: senza nessuno dietro il banco la Caffetteria non li serve' },
  fioraio: { nome: 'fioraio', luogo: 'Fioraio', stanza: 'fioraio', posto: { x: -1.5, z: -3.6 }, x: 47.4, z: 50, dalle: 9, alle: 18, paga: 28, met: 2.5, posti: 1,
    descrizione: 'componi mazzi e prepari rose' },
  facchino: { nome: 'facchino del Mercatino', luogo: 'Mercatino', x: 0, z: 8, dalle: 6, alle: 11, paga: 36, met: 4.5, posti: 2,
    descrizione: 'scarichi le casse: piu\' merce nella Dispensa. Pesante' },
  bibliotecario: { nome: 'bibliotecario', luogo: 'Biblioteca', stanza: 'biblioteca', x: -27.7, z: -3.5, dalle: 9, alle: 18, paga: 28, met: 1.8, posti: 1,
    descrizione: 'consigli chi legge (si annoia molto meno); al caldo' },
  spazzino: { nome: 'spazzino', luogo: 'Fontana', x: 0, z: 34, dalle: 6, alle: 10, paga: 30, met: 3.5, posti: 1,
    descrizione: 'pulisci la piazza dalle cartacce, con ogni tempo' },
  giardiniere: { nome: 'giardiniere', luogo: 'Aiuole della piazza', x: -8, z: 42, dalle: 7, alle: 13, paga: 30, met: 3.5, posti: 1,
    descrizione: 'annaffi le 18 aiuole: senz\'acqua le piante seccano' },
  muratore: { nome: 'muratore', luogo: 'Cantiere', x: 0, z: 40, dalle: 8, alle: 17, giorni: [1, 2, 3, 4, 5, 6], paga: 32, met: 5.0, posti: 3, chiuso: 'nel borgo non c\'e\' nessun cantiere aperto',
    descrizione: 'per Edilborgo, l\'impresa edile del borgo, nel cantiere aperto sui terreni: ogni tua ora e\' un\'ora di lavoro in piu\'' },
  segretario: { nome: 'segretario dell\'Ambulatorio', luogo: 'Ambulatorio', stanza: 'ambulatorio', posto: { x: -2.8, z: -1.8 }, x: 31, z: -3.5, dalle: 8, alle: 19, giorni: [1, 2, 3, 4, 5, 6], paga: 28, met: 1.6, posti: 1,
    descrizione: 'all\'accettazione: visite in 15 minuti invece di 45' }
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
  return Object.keys(MESTIERI).find(k => n.includes(k) || k.includes(n) || MESTIERI[k].nome.includes(n)) || Object.keys(MESTIERI).find(k => MESTIERI[k].luogo.toLowerCase() === n) || null;
}

export function descriviMestieri() {
  return Object.entries(MESTIERI).map(([k, m]) => `${k} (${m.luogo}, ${m.dalle}-${m.alle}${m.giorni ? ' lun-sab' : ''}, ${m.paga} S/ora${m.posti > 1 ? ', ' + m.posti + ' posti' : ''}: ${m.descrizione})`).join('; ');
}
