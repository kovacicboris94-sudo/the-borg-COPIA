// =====================================================================
//  IL BORGO DEGLI AGENTI - MOTORE
//  Tutto quello che conta sta qui: lo stato vero del mondo, le regole che
//  accettano o rifiutano le azioni, la percezione di ogni agente, la sua
//  memoria e il suo budget. Nessuna libreria: gira uguale su Cloudflare
//  (cloudflare/worker.mjs) e sul tuo computer (locale/avvia.mjs).
//
//  Principi (decisi con Boris):
//   - la verita' e' lo stato in questo file, non quello che dice un agente;
//   - ogni agente sa solo cio' che vede intorno a se', cio' che sente e cio'
//     che ricorda (memoria riassunta, cosi' resta corta);
//   - liberta' di scelta totale, unico limite il budget: 5 al mese a testa,
//     l'agente lo conosce e decide da solo quando e quanto pensare;
//   - quando il budget finisce il codice smette di chiamare il modello e
//     l'agente vive "in automatico" fino al mese dopo.
// =====================================================================

import { cosaDi, manuale, merceDi, mobileDi, portafoglio, SEDUTE } from './borgo-cose.mjs';
import { NEGOZI, CLIENTI, REGOLE_NEGOZI as RN, negozioDi, prodottoDi, decide } from './negozi.mjs';
import { LOTTI, lottoDi, geometria, compraLotto, avviaCantiere, passoCantieri, negoziDeiLotti, vistaTerreni, listinoTerreni, terrenoDi, costoProgetto, PROGETTI, GENERI, faseDi, finePrevista, REGOLE_TERRENI as RT, cambiaListino, PREZZO_MAX, tipoDi, abitazione, UN, APPARTAMENTI, appartamentoDato, appartamentoDi, compraAppartamento, immobileDi, prezzoAppartamento, vistaAppartamenti } from './terreni.mjs';
import { BANCA, REGOLE_BANCA as RB, passoBanca, maturaGiocatore, chiediMutuo, chiediPrestito, rimborsa, vistaConto, vistaBanca, pianoMutuo, contoDi } from './banca.mjs';
import { INTERNI, SPORTELLO, internoBottega, idBottega } from './interni.mjs';
import { azioneSponsor, vistaVetrine, vistaCataloghi, eModeratore, logoDi } from './sponsor.mjs';
import { passoImpresa, ritmoCantiere, demoAlLavoro, risparmiDemo, spendeDemo, squadraDi, vistaImpresa, IMPRESA } from './impresa.mjs';
import { passoBorgo, passoDipendenti, effettoMestiere, disponibile, togliScorta, scorteDi, descriviPiazza, vistaLavori, giocatoreDipendente as dipendenteDelGioco, inTurno } from './lavori.mjs';
import { MESTIERI, cercaMestiere } from './vita/mestieri.mjs';
import { passoVita, azioneVita, occupato, percezioneAgente, routineVita, normalizzaAzioneVita, promptVita, TIPI_VITA, bisognoUrgente, pianoPerMotore, vistaVita } from './vita/aggancio.mjs';
import { avviaPartita, passoPartite, promptMossa, SCHEMA_MOSSA, REGOLE_GIOCHI, rigaGiochi, vistaPartite } from './giochi/index.mjs';
export const MODELLO = 'claude-haiku-5-5';

// Prezzi di Claude Haiku 5.5 in dollari per milione di token (prompt fino a 100.000 token).
// Fonte: tabella prezzi Anthropic del 3 novembre 2026. Ricontrollali se Anthropic li cambia.
export const PREZZI = { ingresso: 0.10, uscita: 0.50, scritturaCache: 0.125, letturaCache: 0.01 };

export const REGOLE = {
  // Tetto mensile per agente. Anthropic fattura in dollari: 5 $ costano meno di 5 euro
  // finche' 1 euro vale almeno 1 dollaro, quindi il tetto di 5 euro e' sempre rispettato.
  tettoUsd: 5,
  maxTokens: 1600,            // tetto della singola risposta (pensiero + azioni)
  maxTokensIngresso: 40000,   // mai mandare prompt enormi (sopra 100.000 il prezzo sale). Era 20.000: il 22/11 i prompt veri erano gia' ~17.000 token
  pausaMinimaMs: 60 * 1000,   // un agente non pensa mai piu' di una volta al minuto
  risveglioDaVoceMs: 3 * 60 * 1000, // se qualcuno gli parla si sveglia prima, al massimo ogni 3 minuti
  vista: 20,                  // metri: cosa vede e cosa sente
  portata: 8,                 // metri: cosa puo' toccare, spostare, costruire
  velocita: 1.3,              // metri al secondo, a piedi
  velocitaBici: 3.9,          // in bici (solo in piazza)
  minutiPerMetroCubo: 3,      // tempo di costruzione
  maxOggetti: 150, maxOggettiAgente: 60,
  regaliGiocatore: 3,         // mobili regalati da una persona vera che possono stare in piazza insieme
  sedutaMin: 10,              // minuti seduti su un mobile della piazza
  maxAzioni: 8,
  diarioMax: 24,              // oltre questo l'agente riscrive la memoria e il diario si accorcia
  memoriaMax: 1500,           // caratteri
  eventiMax: 150,
  cronacaMax: 600,           // frasi e lavori salvati per chi torna nel borgo
  proposteAlGiorno: 3,        // idee per migliorare il gioco, per agente
  proposteMax: 200,
  ambientamentoOre: 48,       // i primi 2 giorni nel borgo: si pensa piu' spesso per capire chi si e'
  ambientamentoMaxMin: 3,
  giochi: false,              // i giochi inventati dagli agenti (quiz, tesoro, gara): accesi solo quando Boris dice si'
  giocoMin: 10,               // quanto dura un gioco inventato da un agente (quiz, tesoro, gara)
  partite: true,              // i minigiochi giocati davvero (agenti/giochi/): le mosse le sceglie l'agente. Deciso da Boris il 22/11/2026
  vita: true                  // la vita vera (agenti/vita/): corpo, fame, sete, sonno, casa, soldi, lavoro. Deciso da Boris il 21/11/2026
};

// La piazza del borgo (stesse misure del gioco, src/borgo/base.js e piazza.js).
export const AREA = { x0: -52, x1: 52, z0: -4, z1: 70 };
// gesti che il corpo sa fare (li disegna il gioco): costano niente, sono parte delle azioni di un pensiero
export const GESTI = { saluta: 'alza la mano e saluta', salta: 'salta con le braccia in alto', balla: 'balla', ridi: 'ride', applaudi: 'applaude' };
export const LUOGHI = [
  { nome: 'Fontana', x: 0, z: 30 },
  { nome: 'Belvedere', x: 0, z: 54 },
  { nome: 'Ingresso del borgo', x: 0, z: 40 },
  { nome: 'Mercatino', x: 0, z: 8 },
  { nome: 'Laghetto', x: 38, z: 32 },
  { nome: 'Ruota panoramica', x: 34, z: 8 },
  { nome: 'Torre della Cometa', x: -40, z: 26 },
  { nome: 'Portale della Cripta', x: -35, z: 52 },
  { nome: 'Cratere della Cometa', x: -38, z: 44 },
  { nome: 'Caffetteria', x: 18, z: -3 },
  { nome: 'Forno', x: 44, z: -3 },
  { nome: 'Casa degli Scacchi', x: 3, z: -3 },
  { nome: 'Negozio TCG', x: -12, z: -3 },
  { nome: 'Sala Giochi', x: -22, z: -3 },
  { nome: 'Biblioteca', x: -27.7, z: -3 },
  { nome: 'Laugh Tale Collectibles', x: -40, z: -3 },
  { nome: 'Fioraio', x: 47, z: 50 },
  { nome: 'Arredamenti', x: -47, z: 4 },
  { nome: 'Banca del Borgo', x: 32, z: 43 },
  { nome: 'Ambulatorio', x: 31, z: -3 }
];
// Gli edifici in cui si puo' entrare (stesse misure del gioco, src/borgo/programma-principale.js).
// Dentro, x e z sono quelle della stanza. "porta": dove si entra (in piazza, o dentro la stanza "da").
// Le case private dei giocatori non ci sono: li' non si entra.
export const STANZE = [
  { id: 'negozio', nome: 'Negozio TCG', porta: { x: -12, z: -3.5 }, rect: { x0: -12.25, x1: 12.25, z0: -9.1, z1: 10 }, arrivo: { x: 0, z: 6.2 }, uscita: { x: 0, z: 8.8 } },
  { id: 'sala', nome: 'Sala Giochi', porta: { x: -22.2, z: -3.5 }, rect: { x0: -27, x1: 27, z0: -13, z1: 15 }, arrivo: { x: 0, z: 12.6 }, uscita: { x: 0, z: 13.8 } },
  { id: 'biblioteca', nome: 'Biblioteca', porta: { x: -27.7, z: -3.5 }, rect: { x0: -7.5, x1: 7.5, z0: -6.5, z1: 7.5 }, arrivo: { x: 0, z: 6 }, uscita: { x: 0, z: 6.3 } },
  { id: 'scacchi', nome: 'Casa degli Scacchi', porta: { x: 3, z: -3.5 }, rect: { x0: -10, x1: 10, z0: -8, z1: 9 }, arrivo: { x: 0, z: 7 }, uscita: { x: 0, z: 7.8 } },
  { id: 'collectibles', nome: 'Laugh Tale Collectibles', porta: { x: -40, z: -3.5 }, rect: { x0: -10.5, x1: 10.5, z0: -5, z1: 15 }, arrivo: { x: 0, z: 13.5 }, uscita: { x: 0, z: 13.8 } },
  { id: 'tcg', nome: 'Sala TCG', da: 'collectibles', porta: { x: -8.3, z: 9 }, rect: { x0: -21, x1: 21, z0: -13, z1: 15 }, arrivo: { x: -18.8, z: 9 }, uscita: { x: -19.8, z: 9 } },
  // la Torre della Cometa: un grattacielo di 15 piani. Si entra dal portone (torre0, a est) e tra i piani,
  // e fino al tetto, ci si sposta con l'ASCENSORE: "asc" = dove si prende in quella stanza, "ascArrivo" = dove si esce.
  { id: 'torre0', nome: 'Torre della Cometa', torre: true, porta: { x: -39, z: 26 }, rect: { x0: -8.5, x1: 8.5, z0: -7.5, z1: 7.5 }, arrivo: { x: 0, z: 5.5 }, uscita: { x: 0, z: 6.3 },
    asc: { x: 5.4, z: -6 }, ascArrivo: { x: 5.4, z: -4.5 } },
  ...Array.from({ length: 15 }, (_, i) => ({ id: 'torre' + (i + 1), nome: 'Torre della Cometa · ' + (i + 1) + '° piano', torre: true, da: 'torre0', porta: { x: 5.4, z: -6 },
    rect: { x0: -8.5, x1: 8.5, z0: -7.5, z1: 7.5 }, arrivo: { x: 5.4, z: -4.5 }, uscita: { x: 5.4, z: -6 }, ritorno: { x: 5.4, z: -4.5 }, asc: { x: 5.4, z: -6 }, ascArrivo: { x: 5.4, z: -4.5 } })),
  // il tetto, con il telescopio: le sue x e z sono quelle della piazza, ma si sta 59 metri piu' in alto
  { id: 'tetto', nome: 'Tetto della Torre della Cometa', torre: true, da: 'torre0', porta: { x: 5.4, z: -6 }, rect: { x0: -52.5, x1: -42.5, z0: 21, z1: 31 },
    arrivo: { x: -50.5, z: 30.2 }, uscita: { x: -51.1, z: 30.2 }, ritorno: { x: 5.4, z: -4.5 }, asc: { x: -51.1, z: 30.2 }, ascArrivo: { x: -50.5, z: 30.2 } },
  // le casette degli abitanti, sul lato sud della piazza (src/borgo/casette-agenti.js e agenti/vita/casa.mjs): ci entra solo chi ci abita
  { id: 'casa_ada', nome: 'Casa di Ada', casa: 'ada', porta: { x: -22, z: 59.6 }, rect: { x0: -4, x1: 4, z0: -3.5, z1: 3.5 }, arrivo: { x: 0, z: 2.4 }, uscita: { x: 0, z: 2.6 }, ritorno: { x: -22, z: 58.6 } },
  { id: 'casa_teo', nome: 'Casa di Teo', casa: 'teo', porta: { x: 22, z: 59.6 }, rect: { x0: -4, x1: 4, z0: -3.5, z1: 3.5 }, arrivo: { x: 0, z: 2.4 }, uscita: { x: 0, z: 2.6 }, ritorno: { x: 22, z: 58.6 } },
  // dal 22/11/2026 si entra anche in Caffetteria, Forno, Fioraio, Arredamenti, Banca e nel nuovo Ambulatorio (agenti/interni.mjs);
  // i negozi costruiti sui terreni ("bottega_lottoN") si aggiungono in sincronizzaTerreni
  ...INTERNI
];
export const stanzaDi = id => STANZE.find(q => q.id === id) || null;
function cercaStanza(nome) {
  const n = String(nome || '').toLowerCase().trim(); if (!n) return null;
  // i piani della torre si possono chiamare in tanti modi: "7° piano", "piano 7", "settimo piano"...
  const num = n.match(/(\d+)\s*(?:°|º|o\b)?/), ord = ['primo', 'secondo', 'terzo', 'quarto', 'quinto', 'sesto', 'settimo', 'ottavo', 'nono', 'decimo', 'undicesimo', 'dodicesimo', 'tredicesimo', 'quattordicesimo', 'quindicesimo'].findIndex(o => n.includes(o));
  if (/piano|torre/.test(n) && !/tetto/.test(n)) { const k = num ? +num[1] : ord + 1; if (k >= 1 && k <= 15) return stanzaDi('torre' + k); if (/terra|ingresso/.test(n)) return stanzaDi('torre0'); }
  if (/tetto|telescopio/.test(n)) return stanzaDi('tetto');
  return STANZE.find(q => q.nome.toLowerCase() === n || q.id === n) || STANZE.find(q => q.nome.toLowerCase().includes(n) || n.includes(q.nome.toLowerCase())) || null;
}
function dentroStanza(st, x, z, m = 1.2) { const r = st.rect; return { x: r2(lim(x, r.x0 + m, r.x1 - m)), z: r2(lim(z, r.z0 + m, r.z1 - m)) }; }

// Zone dove non si costruisce: porte, fontana, laghetto, ruota, torre, portale, mercatino.
// Gli edifici originali del borgo non si toccano: solo le cose fatte dagli abitanti.
const PROTETTE = [
  { x: 0, z: 30, r: 7.5 }, { x: 0, z: 38.6, r: 3 }, { x: 38, z: 32, r: 10 }, { x: 34, z: 3, r: 9 },
  { x: -38, z: 40, r: 5 }, { x: -35, z: 58, r: 7 }, { x: -46, z: 26, r: 8.5 },
  { x: -13.5, z: 5, r: 3.5 }, { x: -6.5, z: 5, r: 3.5 }, { x: 6.5, z: 5, r: 3.5 }, { x: 13.5, z: 5, r: 3.5 },
  ...[44, -12, 18, -22, -32, -27.7, 3, -40].map(x => ({ x, z: -4, r: 3.5 })),
  { x: 48, z: 50, r: 4 }, { x: -48, z: 4, r: 4 }, { x: 31, z: -4, r: 3.5 }, { x: 32, z: 44, r: 3 }
];

export const FORME = ['cubo', 'cilindro', 'sfera', 'cono', 'piramide'];

// I due abitanti di partenza: solo nome e aspetto. Nessun carattere ne' obiettivo (scelta di Boris):
// chi diventano lo decidono vivendo, e lo ricordano nella loro memoria.
export const ABITANTI = [
  { id: 'ada', nome: 'Ada', x: -6, z: 34,
    look: { pelle: 2, capelli: 5, pettinatura: 3, abito: 2, giacca: 4, accessorio: 1, occhi: 2, corpo: 1, espressione: 1 } },
  { id: 'teo', nome: 'Teo', x: 6, z: 34,
    look: { pelle: 4, capelli: 1, pettinatura: 1, abito: 5, giacca: 1, accessorio: 3, occhi: 0, corpo: 0, espressione: 0, barba: 1 } }
];

/* ------------------------------------------------------------------ */
/*  utilita'                                                           */
/* ------------------------------------------------------------------ */
// due cose in posti diversi (piazza e un edificio, o due edifici) sono infinitamente lontane: non si vedono e non si sentono
const dist = (a, b) => ((a.stanza || null) !== (b.stanza || null) ? Infinity : Math.hypot(a.x - b.x, a.z - b.z));
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : d));
const lim = (v, a, b) => Math.max(a, Math.min(b, v));
const testo = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max);
const r2 = v => Math.round(v * 100) / 100;

const FMT_ORA = new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
const FMT_PARTI = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hour12: false });
function partiRoma(ms) {
  const p = {}; FMT_PARTI.formatToParts(new Date(ms)).forEach(x => { p[x.type] = x.value; });
  return { anno: +p.year, mese: +p.month, giorno: +p.day, ora: +p.hour % 24 };
}
// il mese del budget e' quello italiano: si ricomincia il primo del mese a mezzanotte, ora di Roma
export function meseDi(ms) { const p = partiRoma(ms); return p.anno + '-' + String(p.mese).padStart(2, '0'); }
function giorniRimasti(ms) { const p = partiRoma(ms); const tot = new Date(Date.UTC(p.anno, p.mese, 0)).getUTCDate(); return tot - p.giorno + 1; }
function momento(ms) { const h = partiRoma(ms).ora; return h < 6 ? 'notte' : h < 12 ? 'mattina' : h < 18 ? 'pomeriggio' : h < 22 ? 'sera' : 'notte'; }
function oraBreve(ms) { return new Date(ms).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' }); }
const dollari = v => v.toFixed(4).replace('.', ',') + ' $';

export function luogoVicino(p) {
  if (p.stanza) { const st = stanzaDi(p.stanza); if (st) return { nome: st.nome, d: 0, dentro: true }; }
  let best = null, bd = 1e9;
  for (const l of LUOGHI) { const d = dist(p, l); if (d < bd) { bd = d; best = l; } }
  return { nome: best.nome, d: Math.round(bd) };
}

export function costoDi(usage) {
  const u = usage || {};
  return ((u.input_tokens || 0) * PREZZI.ingresso + (u.output_tokens || 0) * PREZZI.uscita +
    (u.cache_creation_input_tokens || 0) * PREZZI.scritturaCache + (u.cache_read_input_tokens || 0) * PREZZI.letturaCache) / 1e6;
}

/* ------------------------------------------------------------------ */
/*  stato                                                              */
/* ------------------------------------------------------------------ */
export function nuovoStato(adesso) {
  const agenti = {};
  ABITANTI.forEach((a, i) => {
    agenti[a.id] = {
      id: a.id, nome: a.nome, look: a.look,
      x: a.x, z: a.z, tx: a.x, tz: a.z, coda: [], lavoro: null,
      memoria: 'Ho appena aperto gli occhi nel borgo. Non so ancora nulla di questo posto.',
      diario: [], esiti: [], ultimoPensiero: '', prossimoPensiero: adesso + 15000 + i * 45000, ultimaVolta: 0,
      ultimoAscolto: 0, sforzo: 'basso', spesa: {}, detto: null, modo: 'attivo', errori: 0, nato: adesso, abitudine: null
    };
  });
  return { versione: 1, creato: adesso, ora: adesso, prossimoId: 1, agenti, oggetti: [], eventi: [], cronaca: [] };
}

export function spesaMese(ag, adesso) {
  const m = meseDi(adesso);
  return ag.spesa[m] || (ag.spesa[m] = { usd: 0, pensieri: 0, ingresso: 0, uscita: 0 });
}
export function budget(ag, adesso, regole = REGOLE) {
  const s = spesaMese(ag, adesso), resto = Math.max(0, regole.tettoUsd - s.usd), giorni = giorniRimasti(adesso);
  return { mese: meseDi(adesso), spesi: s.usd, tetto: regole.tettoUsd, resto, giorni, alGiorno: resto / giorni, pensieri: s.pensieri };
}

function evento(stato, e) {
  const v = Object.assign({ t: stato.ora }, e);
  if (v.stanza === undefined && stato.agenti[v.chi] && stato.agenti[v.chi].stanza) v.stanza = stato.agenti[v.chi].stanza;
  if (!v.stanza) delete v.stanza;
  stato.eventi.push(v);
  if (stato.eventi.length > REGOLE.eventiMax) stato.eventi.splice(0, stato.eventi.length - REGOLE.eventiMax);
  // la cronaca del borgo: tutto quello che si dicono e fanno, da leggere quando torni
  if (e.tipo === 'gesto') return;   // i gesti non finiscono nella cronaca
  const c = stato.cronaca || (stato.cronaca = []);
  c.push(v); if (c.length > REGOLE.cronacaMax) c.splice(0, c.length - REGOLE.cronacaMax);
}
function annota(ag, t, s) {
  ag.diario.push({ t, s: testo(s, 600) });
  // tetto di sicurezza: il riassunto vero lo fa l'agente stesso (memoria_nuova)
  if (ag.diario.length > REGOLE.diarioMax * 2) ag.diario.splice(0, ag.diario.length - REGOLE.diarioMax * 2);
}
function esito(ag, s) { ag.esiti.push(testo(s, 200)); if (ag.esiti.length > 8) ag.esiti.shift(); }

/* ------------------------------------------------------------------ */
/*  regole del mondo                                                   */
/* ------------------------------------------------------------------ */
function dentroArea(x, z, margine = 0) { return x >= AREA.x0 + margine && x <= AREA.x1 - margine && z >= AREA.z0 + margine && z <= AREA.z1 - margine; }
function zonaProtetta(x, z, raggio) { return PROTETTE.find(p => Math.hypot(x - p.x, z - p.z) < p.r + raggio); }
const COLORI = { rosso: '#c8453b', blu: '#3b6fc8', verde: '#4f9a4a', giallo: '#f2c94c', bianco: '#f4efe6', nero: '#2a2233', marrone: '#7a4f2e', grigio: '#9a9a9a', arancione: '#e8873a', viola: '#7a4fb8', rosa: '#e89ab8', azzurro: '#7ec8e3', legno: '#a0703f', pietra: '#b9b0a2' };
function colore(c) {
  const s = String(c || '').trim().toLowerCase();
  if (/^#[0-9a-f]{6}$/.test(s)) return s;
  if (/^#[0-9a-f]{3}$/.test(s)) return '#' + s[1] + s[1] + s[2] + s[2] + s[3] + s[3];
  return COLORI[s] || '#b9b0a2';
}

// Trasforma una richiesta del modello in un'azione pulita, o in un rifiuto con il motivo.
export function normalizzaAzione(a, regole = REGOLE) {
  if (!a || typeof a !== 'object') return { errore: 'azione non valida' };
  const tipo = String(a.tipo || '').toLowerCase().trim();
  if (regole.vita) { const v = normalizzaAzioneVita(a); if (v) return v; }   // le azioni del corpo (mangia, bevi, dormi, compra, turno...)
  if (tipo === 'vai') {
    if (a.luogo) {
      const l = LUOGHI.find(q => q.nome.toLowerCase() === String(a.luogo).toLowerCase().trim());
      if (l) return { tipo, x: l.x, z: l.z, dove: l.nome };
    }
    const x = num(a.x, NaN), z = num(a.z, NaN);
    if (!isFinite(x) || !isFinite(z)) return { errore: 'vai: serve un luogo conosciuto oppure x e z' };
    return { tipo, x: lim(x, -60, 80), z: lim(z, -20, 80) };   // dentro un edificio x e z sono quelle della stanza: si sistemano quando si parte
  }
  if (tipo === 'entra') {
    const st = cercaStanza(a.luogo || a.nome || a.testo);
    return st ? { tipo, stanza: st.id } : { errore: 'entra: edificio sconosciuto (puoi entrare in ' + STANZE.map(q => q.nome).join(', ') + ')' };
  }
  if (tipo === 'esci') return { tipo };
  if (tipo === 'terreno') { const l = lottoDi(a.nome || a.luogo || a.testo); return l ? { tipo, lotto: l.id } : { errore: 'terreno: lotto sconosciuto (in vendita: ' + LOTTI.map(q => q.id).join(', ') + ')' }; }
  if (tipo === 'edifica') {
    const t = tipoDi(a.nome);
    if (!t) return { errore: 'edifica: in "nome" metti casa, villa oppure negozio' };
    return { tipo, progetto: t, titolo: testo(a.testo, 28), genere: a.forma ? testo(a.forma, 20) : null };
  }
  if (tipo === 'appartamento') { const q = appartamentoDato(a.nome || a.luogo || a.testo); return q ? { tipo, piano: q.piano } : { errore: 'appartamento: in "nome" metti il piano (da 1 a 15)' }; }
  if (tipo === 'mutuo') {
    const bene = testo(a.nome || a.luogo, 30); if (!bene) return { errore: 'mutuo: in "nome" metti il terreno (lotto1...) o il piano dell\'appartamento ("piano 7")' };
    const f = String(a.forma || '').toLowerCase().split(/[\s,]+/);
    return { tipo, bene, progetto: f[0] || null, genere: f[1] || null, titolo: testo(a.testo, 28), anticipo: num(a.prezzo, 0), durata: num(a.minuti, 240) };
  }
  if (tipo === 'prestito') { const p = num(a.prezzo, 0); if (!(p > 0)) return { errore: 'prestito: in "prezzo" metti quanti Starlight chiedi' }; return { tipo, importo: p, durata: num(a.minuti, 24) }; }
  if (tipo === 'rimborsa') { const p = num(a.prezzo, 0); if (!(p > 0)) return { errore: 'rimborsa: in "prezzo" metti quanti Starlight restituisci' }; return { tipo, importo: p }; }
  if (tipo === 'lavora') {
    const n = String(a.nome || a.luogo || a.testo || '').toLowerCase();
    if (/smett|basta|fine|stop/.test(n)) return { tipo, smetti: true };
    const neg = negozioDi(n); if (!neg) return { errore: 'lavora: negozio sconosciuto (puoi lavorare a ' + NEGOZI.map(q => q.nome).join(', ') + ')' };
    return { tipo, negozio: neg.id, minuti: Math.round(lim(num(a.minuti, RN.turnoMin), 15, RN.turnoMaxMin)) };
  }
  if (tipo === 'vendi') {
    const t = testo(a.testo, 300);
    if (!a.nome) return { errore: 'vendi: metti in "nome" il prodotto' };
    return { tipo, prodotto: testo(a.nome, 40), testo: t, prezzo: a.prezzo == null ? null : num(a.prezzo, null) };
  }
  if (tipo === 'usa') {
    // un mobile posato in piazza (per sedersi): per id ("o12") oppure per nome ("Poltrona")
    const n = String(a.nome || a.luogo || a.testo || '').trim(), id = n.match(/^o\d+$/i);
    if (id) return { tipo, oggetto: id[0].toLowerCase() };
    if (!cosaDi(n)) { const m = merceDi(n); if (m && SEDUTE[m[7]]) return { tipo, oggetto: m[0] }; }
  }
  if (tipo === 'usa') { const c = cosaDi(a.nome || a.luogo || a.testo); return c ? { tipo, cosa: c.id, richiesta: testo(a.testo, 40) } : { errore: 'usa: cosa sconosciuta (vedi MANUALE DEL BORGO)' }; }
  if (tipo === 'metti') { const m = merceDi(a.nome || a.testo); if (!m) return { errore: 'metti: cosa sconosciuta (puoi mettere solo le cose comprate al Mercatino)' }; const o = { tipo, merce: m[0] }; if (a.x != null && a.z != null && isFinite(num(a.x, NaN)) && isFinite(num(a.z, NaN))) { o.x = r2(num(a.x, 0)); o.z = r2(num(a.z, 0)); } return o; }
  if (tipo === 'scrivi') {
    const chi = testo(a.nome || a.id, 20), t = testo(a.testo, 500);
    if (!chi) return { errore: 'scrivi: metti in "nome" a chi scrivi' };
    return t ? { tipo, a: chi, testo: t } : { errore: 'scrivi: testo vuoto' };
  }
  if (tipo === 'di') { const t = testo(a.testo, 500); return t ? { tipo, testo: t } : { errore: 'di: testo vuoto' }; }
  if (tipo === 'costruisci') {
    const forma = String(a.forma || 'cubo').toLowerCase();
    if (!FORME.includes(forma)) return { errore: 'costruisci: forma sconosciuta (usa ' + FORME.join(', ') + ')' };
    const o = { tipo, nome: testo(a.nome, 40) || forma, forma,
      l: r2(lim(num(a.larghezza, 1), 0.2, 8)), h: r2(lim(num(a.altezza, 1), 0.2, 8)), p: r2(lim(num(a.profondita, 1), 0.2, 8)),
      y: r2(lim(num(a.y, 0), 0, 12)), rot: Math.round(num(a.rotazione, 0)) % 360, colore: colore(a.colore), scritta: testo(a.testo, 60) };
    if (a.x != null && a.z != null && isFinite(num(a.x, NaN)) && isFinite(num(a.z, NaN))) { o.x = r2(num(a.x, 0)); o.z = r2(num(a.z, 0)); }
    return o;
  }
  if (tipo === 'sposta') {
    const x = num(a.x, NaN), z = num(a.z, NaN);
    if (!a.id || !isFinite(x) || !isFinite(z)) return { errore: 'sposta: servono id, x e z' };
    return { tipo, id: String(a.id), x: r2(x), z: r2(z), y: a.y == null ? null : r2(lim(num(a.y, 0), 0, 12)) };
  }
  if (tipo === 'rimuovi') return a.id ? { tipo, id: String(a.id) } : { errore: 'rimuovi: serve l\'id' };
  if (tipo === 'gioco') {
    const g = String(a.forma || '').toLowerCase().trim(), t = testo(a.testo, 300);
    if (!['quiz', 'tesoro', 'gara'].includes(g)) return { errore: 'gioco: in "forma" metti quiz, tesoro oppure gara' };
    if (!t) return { errore: 'gioco: serve il testo (la domanda o l\'annuncio)' };
    if (g === 'quiz') { const r = testo(a.nome, 60); return r ? { tipo, gioco: g, testo: t, risposta: r } : { errore: 'gioco quiz: metti la risposta giusta in "nome" (nessuno la vede)' }; }
    let x = NaN, z = NaN, dove = null;
    if (a.luogo) { const l = LUOGHI.find(q => q.nome.toLowerCase() === String(a.luogo).toLowerCase().trim()); if (l) { x = l.x; z = l.z; dove = l.nome; } }
    if (!isFinite(x)) { x = num(a.x, NaN); z = num(a.z, NaN); }
    if (!isFinite(x) || !isFinite(z)) return { errore: 'gioco ' + g + ': serve un luogo conosciuto oppure x e z' };
    return { tipo, gioco: g, testo: t, x: r2(lim(x, AREA.x0, AREA.x1)), z: r2(lim(z, AREA.z0, AREA.z1)), dove };
  }
  if (tipo === 'gesto') {
    const g = String(a.testo || a.nome || '').toLowerCase().trim();
    return GESTI[g] ? { tipo, gesto: g } : { errore: 'gesto: usa uno di ' + Object.keys(GESTI).join(', ') };
  }
  if (tipo === 'abitudine') {
    const t = String(a.testo || '').trim();
    if (/^(nessuna|niente|cancella|basta)\b/i.test(t)) return { tipo, abitudine: null };
    const ab = {};
    for (const pezzo of t.split(/[;,\n]+/)) {
      const m = pezzo.match(/^\s*(mattina|pomeriggio|sera|notte)\s*[:=-]\s*(.+?)\s*$/i); if (!m) continue;
      const l = LUOGHI.find(q => q.nome.toLowerCase() === m[2].toLowerCase());
      if (!l) return { errore: 'abitudine: luogo sconosciuto "' + testo(m[2], 30) + '"' };
      ab[m[1].toLowerCase()] = l.nome;
    }
    return Object.keys(ab).length ? { tipo, abitudine: ab } : { errore: 'abitudine: scrivi per esempio "mattina: Fontana; sera: Laghetto" oppure "nessuna"' };
  }
  if (tipo === 'proponi') { const t = testo(a.testo, 400); return t ? { tipo, testo: t } : { errore: 'proponi: testo vuoto' }; }
  return { errore: 'azione sconosciuta: ' + testo(tipo, 20) };
}

function raggioOggetto(o) { return Math.hypot(o.l, o.p) / 2; }

// Controlla se un oggetto puo' stare in quel punto. Restituisce il motivo del rifiuto o null.
function postoValido(stato, o, ignoraId) {
  const r = raggioOggetto(o);
  if (!dentroArea(o.x, o.z, r)) return 'fuori dalla piazza del borgo';
  const pz = zonaProtetta(o.x, o.z, r);
  if (pz) return 'troppo vicino a ' + luogoVicino(pz).nome + ' (zona da lasciare libera)';
  const lt = LOTTI.find(l => { const g = geometria(l).rect; return o.x + r > g.x0 && o.x - r < g.x1 && o.z + r > g.z0 && o.z - r < g.z1; });
  if (lt) return 'dentro ' + lt.nome + ' (i terreni in vendita si comprano, non ci si costruisce sopra)';
  if (o.x + r > BANCA.x - BANCA.w / 2 - 1 && o.x - r < BANCA.x + BANCA.w / 2 + 1 && o.z + r > BANCA.z - BANCA.d / 2 - 3 && o.z - r < BANCA.z + BANCA.d / 2 + 1) return 'troppo vicino alla Banca del Borgo';
  if (o.y > 0.05) {
    // sollevato: deve poggiare su qualcosa (niente oggetti sospesi nel vuoto)
    const sotto = stato.oggetti.find(q => q.id !== ignoraId && q.pronto && Math.hypot(q.x - o.x, q.z - o.z) < raggioOggetto(q) + 0.3 && Math.abs((q.y + q.h) - o.y) < 0.35);
    if (!sotto) return 'non c\'e\' niente sotto su cui appoggiarlo (y deve essere uguale all\'altezza di un oggetto finito sotto)';
  }
  return null;
}

/* ------------------------------------------------------------------ */
/*  un passo del mondo                                                 */
/* ------------------------------------------------------------------ */
// stato: lo stato salvato. adesso: millisecondi. cervello: async (richiesta) => risposta del modello, oppure null.
export async function passo(stato, adesso, cervello, opz = {}) {
  const regole = Object.assign({}, REGOLE, opz.regole || {});
  if (opz.pausa) {
    // in pausa il tempo del borgo e' fermo: niente pensieri, niente spese, i lavori aspettano
    const fermo = Math.max(0, adesso - (stato.ora || adesso));
    for (const ag of Object.values(stato.agenti)) {
      ag.prossimoPensiero += fermo; if (ag.lavoro) { ag.lavoro.inizio += fermo; ag.lavoro.fine += fermo; }
      if (ag.prossimaGita) ag.prossimaGita += fermo;
    }
    stato.ora = adesso; stato.pausa = true;
    return [];
  }
  stato.pausa = false;
  for (const ag of Object.values(stato.agenti)) if (!ag.nato) ag.nato = adesso;   // agenti nati prima di questa regola: l'ambientamento parte ora
  const dt = Math.max(0, Math.min(10 * 60 * 1000, adesso - (stato.ora || adesso))) / 1000;
  stato.ora = adesso;
  const agenti = Object.values(stato.agenti);

  // 0) la vita vera: il corpo consuma, digerisce, ha sete e sonno; il fuoco brucia, il cibo invecchia, si pagano le bollette
  const evVita = regole.vita ? passoVita(stato, adesso) : [];
  // il lavoro fatto cambia il borgo (pane sugli scaffali, cantieri, piazza pulita...): agenti/lavori.mjs
  passoBorgo(stato, adesso, dt);
  for (const e of evVita || []) if (e.tipo === 'lavoro_finito' && e.mestiere) lavoroFatto(stato, e.chi, e.mestiere, e.ore, adesso, e.lotto);
  for (const f of passoDipendenti(stato, adesso)) if (f.effetto) { const prima = stato.ora; stato.ora = adesso; evento(stato, { chi: f.chi, tipo: 'usa', testo: f.effetto, x: 0, z: 30 }); stato.ora = prima; }
  sincronizzaTerreni(stato);
  for (const e of passoImpresa(stato, adesso, dt)) { const prima = stato.ora; stato.ora = adesso; const l = e.lotto ? lottoDi(e.lotto) : null; evento(stato, { chi: e.demo ? 'd:' + e.nome : 'd:Edilborgo', tipo: 'usa', testo: e.testo, x: l ? l.x : 0, z: l ? l.z : 30 }); stato.ora = prima; }
  for (const id of passoCantieri(stato, adesso, dt, id => ritmoCantiere(stato, id))) cantiereFinito(stato, id, adesso);
  for (const f of passoBanca(stato, adesso, id => stato.agenti[id] && !stato.agenti[id].morto ? portafoglio(stato.agenti[id]) : null)) fattoBanca(stato, f, adesso);
  // 1) il tempo scorre: si cammina, si costruisce, si eseguono le azioni in coda
  for (const ag of agenti) avanza(stato, ag, dt, adesso, regole);
  controllaGiochi(stato, adesso, regole);
  passoNegozi(stato, adesso, regole);
  // le partite ai minigiochi: a ogni scelta si chiede la mossa a chi gioca (domanda corta, agenti/giochi/)
  if (regole.partite) await passoPartite(stato, adesso, aiutoPartite(stato, cervello, regole));
  // chi sta giocando pensa alla partita, non al resto (finita la partita ci ripensa subito)
  for (const ag of agenti) if (ag.partita && ag.prossimoPensiero <= adesso) ag.prossimoPensiero = adesso + 2 * 60000;

  // 2) chi deve pensare pensa (uno alla volta, cosi' le azioni sono sfalsate)
  // chi e' morto non pensa piu'; chi dorme (o e' svenuto, o sta lavorando) pensa quando ha finito
  for (const ag of agenti) if (ag.prossimoPensiero <= adesso && regole.vita && (ag.morto || occupato(stato, ag))) ag.prossimoPensiero = adesso + (ag.morto ? 365 * 864e5 : 5 * 60000);
  const pronti = agenti.filter(a => a.prossimoPensiero <= adesso).sort((a, b) => a.prossimoPensiero - b.prossimoPensiero);
  const fatti = [];
  for (const ag of pronti.slice(0, opz.maxPensieri || 2)) {
    fatti.push(await pensa(stato, ag, adesso, cervello, regole));
  }
  return fatti;
}

function avanza(stato, ag, dt, adesso, regole) {
  if (ag.morto) { ag.tx = ag.x; ag.tz = ag.z; return; }
  // il corpo e' impegnato (dorme, pesca, cucina, fa un turno, e' svenuto): si resta li'
  if (regole.vita && occupato(stato, ag)) { ag.tx = ag.x; ag.tz = ag.z; return; }
  // lavoro in corso (costruire, smontare)
  if (ag.lavoro) {
    if (adesso < ag.lavoro.fine) return;
    const L = ag.lavoro; ag.lavoro = null;
    ag.prossimaEsplorazione = Math.max(ag.prossimaEsplorazione || 0, adesso + 15 * 60000);   // si resta un po' vicino a quello che si e' fatto
    const o = stato.oggetti.find(q => q.id === L.id);
    if (L.tipo === 'costruisci' && o) { o.pronto = true; esito(ag, `costruisci "${o.nome}" (${o.id}): finito`); annota(ag, adesso, `Ho finito di costruire "${o.nome}" (${o.id}).`); evento(stato, { chi: ag.id, tipo: 'finito', testo: o.nome, x: o.x, z: o.z }); }
    if (L.tipo === 'usa') fineUso(stato, ag, L, adesso);
    if (L.tipo === 'rimuovi') { const i = stato.oggetti.findIndex(q => q.id === L.id); if (i >= 0) { const q = stato.oggetti[i]; stato.oggetti.splice(i, 1); if (q.arredo && stato.agenti[q.autore]) { const z = portafoglio(stato.agenti[q.autore]).zaino || (stato.agenti[q.autore].zaino = {}); z[q.nome] = (z[q.nome] || 0) + 1; } esito(ag, `rimuovi ${q.id} "${q.nome}": fatto`); annota(ag, adesso, `Ho smontato "${q.nome}" di ${nomeDi(stato, q.autore)}.`); evento(stato, { chi: ag.id, tipo: 'rimosso', testo: q.nome, x: q.x, z: q.z }); } }
  }
  // cammino e azioni in coda: nello stesso passo si usa tutto il tempo (arrivi, entri, prendi l'ascensore, riparti...)
  let resto = dt;
  for (let giri = 0; giri < 12; giri++) {
    const vel = ag.bici && !ag.stanza ? regole.velocitaBici : regole.velocita;
    const dx = ag.tx - ag.x, dz = ag.tz - ag.z, d = Math.hypot(dx, dz), passoM = vel * resto;
    if (d > 0.05) {
      if (passoM < d) { ag.x = r2(ag.x + dx / d * passoM); ag.z = r2(ag.z + dz / d * passoM); return; }
      ag.x = ag.tx; ag.z = ag.tz; resto -= d / vel;
    }
    const fermo = () => ag.lavoro || (regole.vita && occupato(stato, ag));   // il corpo sta facendo qualcosa che richiede tempo
    if (!ag.coda.length || fermo()) break;
    let cammina = false;
    while (ag.coda.length && !fermo()) {
      const a = ag.coda.shift();
      if (esegui(stato, ag, a, adesso, regole) === 'cammina') { cammina = true; break; }
    }
    if (!cammina || resto <= 0) return;
  }
  if (ag.coda.length) return;
  const tu = (stato.turni || {})[ag.id];
  if (tu) { const v = negozioDi(tu.negozio).venditore; ag.tx = v.x; ag.tz = v.z; ag.ancora = { x: v.x, z: v.z }; return; }   // al bancone si resta li'
  if (!ag.coda.length && !ag.lavoro && regole.vita && riflessi(stato, ag, adesso)) return;
  if (!ag.coda.length && !ag.lavoro) { if (ag.modo === 'automatico') routine(ag, adesso); else passeggia(ag, adesso); }
}

// I bisogni del corpo che non aspettano (sete, bagno, sonno, fame vera, freddo) li soddisfa il corpo da solo, gratis:
// il piano lo fa il cervello a regole (agenti/vita/cervello-regole.mjs). Chi vive "in automatico" fa cosi' sempre.
function riflessi(stato, ag, adesso) {
  if (adesso < (ag.prossimoRiflesso || 0)) return false;
  const urgente = bisognoUrgente(stato, ag, adesso);
  if (!urgente && ag.modo !== 'automatico') return false;
  ag.prossimoRiflesso = adesso + (ag.vitaFallito && adesso - ag.vitaFallito < 60000 ? 10 : 2) * 60000;
  const piano = pianoPerMotore(routineVita(stato, ag, adesso), STANZE);
  if (!piano.length) return false;
  ag.coda.push(...piano); ag.ancora = null; ag.esplora = null;
  if (urgente && (ag.ultimoBisogno !== urgente || adesso - (ag.ultimoBisognoT || 0) > 30 * 60000)) ag.ultimoBisogno = urgente, ag.ultimoBisognoT = adesso, annota(ag, adesso, { sete: 'Ho sete.', bagno: 'Devo andare in bagno.', sonno: 'Sono stanco morto.', fame: 'Ho fame.', freddo: 'Ho freddo.', fornello: 'Ho lasciato il fornello acceso!' }[urgente]);
  return true;
}

// Tra un pensiero e l'altro, finite le azioni, si fanno due passi qui intorno: e' gratis (lo decide il codice, non il modello).
function passeggia(ag, adesso) {
  const st = ag.stanza && stanzaDi(ag.stanza);
  if (ag.stanza && !st) ag.stanza = null;
  if (st) {
    // dentro un edificio: si gira per la stanza; passato il tempo si torna fuori da soli
    if (adesso >= (ag.dentroFino || 0)) { ag.coda.push({ tipo: 'esci', auto: true }); return; }
    if (ag.prossimaGita && adesso < ag.prossimaGita) return;
    if (!ag.ancora) ag.ancora = { x: ag.x, z: ag.z };
    const a = adesso / 9e4 + ag.id.charCodeAt(0), r = 1.5 + (Math.sin(a * 3.7) + 1) * 1.5, q = dentroStanza(st, ag.ancora.x + Math.sin(a) * r, ag.ancora.z + Math.cos(a) * r);
    ag.tx = q.x; ag.tz = q.z; ag.prossimaGita = adesso + (35 + (Math.sin(a * 1.3) + 1) * 30) * 1000;
    return;
  }
  // l'abitudine: a ogni momento della giornata si va da soli nel posto scelto (gratis, senza pensare)
  const l = adesso >= (ag.abitudineDopo || 0) ? luogoAbitudine(ag, adesso) : null;
  if (l && (!ag.ancora || Math.hypot(ag.ancora.x - l.x, ag.ancora.z - l.z) > 4)) { ag.ancora = { x: l.x, z: l.z + 3 }; ag.tx = ag.ancora.x; ag.tz = ag.ancora.z; ag.meta = l.nome; ag.prossimaGita = adesso + 3 * 60000; return; }
  if (!ag.ancora) ag.ancora = { x: ag.x, z: ag.z };
  // arrivato in esplorazione: se lo segna, cosi' al prossimo pensiero sa che posto e'
  if (ag.esplora && ag.ancora && Math.hypot(ag.x - ag.ancora.x, ag.z - ag.ancora.z) < 1) {
    (ag.visti || (ag.visti = [])).includes(ag.esplora) || ag.visti.push(ag.esplora);
    annota(ag, adesso, `Facendo un giro sono arrivato a ${ag.esplora}.`);
    // davanti a un edificio mai visto da dentro: si entra a dare un'occhiata (gratis)
    const dentro = STANZE.find(q => q.nome === ag.esplora && !q.da && !(ag.vistiDentro || []).includes(q.id));
    ag.esplora = null;
    if (dentro) { ag.coda.push({ tipo: 'entra', stanza: dentro.id, auto: true }); return; }
  }
  if (ag.prossimaGita && adesso < ag.prossimaGita) return;
  const notte = momento(adesso) === 'notte', a = adesso / 9e4 + ag.id.charCodeAt(0), r = 2 + (Math.sin(a * 3.7) + 1) * 2.5;
  // ogni tanto si va a esplorare un altro posto del borgo (prima quelli mai visti), sempre gratis
  if (!notte && !ag.abitudine && adesso >= (ag.abitudineDopo || 0) && adesso >= (ag.prossimaEsplorazione || 0)) {
    const qui = luogoVicino(ag).nome, visti = ag.visti || [];
    const scelta = LUOGHI.filter(l => l.nome !== qui && !visti.includes(l.nome));
    const lista = scelta.length ? scelta : LUOGHI.filter(l => l.nome !== qui);
    const l = lista[Math.floor((Math.sin(adesso / 7e4 + ag.id.charCodeAt(0) * 3.3) + 1) / 2 * lista.length) % lista.length];
    ag.ancora = { x: l.x, z: lim(l.z + 3, AREA.z0, AREA.z1) }; ag.tx = ag.ancora.x; ag.tz = ag.ancora.z; ag.esplora = l.nome;
    ag.prossimaEsplorazione = adesso + (inAmbientamento(ag, adesso, REGOLE) ? 5 : 12) * 60000;
    ag.prossimaGita = adesso + 90000;
    return;
  }
  ag.tx = r2(lim(ag.ancora.x + Math.sin(a) * r, AREA.x0, AREA.x1)); ag.tz = r2(lim(ag.ancora.z + Math.cos(a) * r, AREA.z0, AREA.z1));
  ag.prossimaGita = adesso + (notte ? 360 : 45 + (Math.sin(a * 1.3) + 1) * 40) * 1000;   // di giorno ogni 45-125 secondi
}

// Un'azione del corpo (agenti/vita/): se il posto e' lontano ci si cammina prima (o si entra in casa / in Biblioteca),
// poi la si ripete all'arrivo. Al massimo 3 tentativi, cosi' un posto irraggiungibile non blocca l'agente.
// "dai" con una cosa comprata ai negozi o al Mercatino (Cioccolata calda, Cornetto, un mobile...): quelle stanno
// nello zaino del borgo (ag.zaino), non tra le cose del corpo. Prima questo "dai" cercava solo tra le cose del corpo
// e falliva sempre ("cosa dai?"): Teo ha provato per un giorno intero a dare la cioccolata ad Ada (22/11/2026).
// Restituisce null se la cosa non e' nello zaino del borgo (allora decide la vita vera).
function daiDalloZaino(stato, ag, a, adesso, regole) {
  const z = portafoglio(ag).zaino || {}, n = s => String(s || '').toLowerCase().replace(/[’`]/g, '\'').replace(/\s+/g, ' ').trim();
  const k = Object.keys(z).find(x => z[x] > 0 && n(x) === n(a.nome));
  if (!k) return null;
  const altro = stato.agenti[n(a.a)];
  if (!altro || altro === ag) return esito(ag, `dai ${k}: a chi? metti il suo nome in "id"`);
  if (altro.morto) return esito(ag, `dai ${k}: ${altro.nome} non c'e' piu'`);
  if ((altro.stanza || null) !== (ag.stanza || null)) return esito(ag, `dai ${k}: ${altro.nome} non e' qui con te (e' ${altro.stanza ? 'dentro un edificio' : 'fuori'})`);
  if (dist(ag, altro) > 3) {
    // si va vicino e si riprova all'arrivo (al massimo 3 volte, perche' l'altro puo' spostarsi)
    const tent = (a.tentativi || 0) + 1;
    if (tent > 3) return esito(ag, `dai ${k}: non riesco ad avvicinarmi a ${altro.nome}`);
    ag.coda.unshift(Object.assign({}, a, { tentativi: tent }));
    const ang = Math.atan2(ag.x - altro.x, ag.z - altro.z);
    ag.tx = lim(altro.x + Math.sin(ang) * 1.5, AREA.x0, AREA.x1); ag.tz = lim(altro.z + Math.cos(ang) * 1.5, AREA.z0, AREA.z1);
    ag.meta = altro.nome; ag.ancora = null; ag.esplora = null;
    return 'cammina';
  }
  z[k]--; if (z[k] <= 0) delete z[k];
  const za = portafoglio(altro).zaino || (altro.zaino = {}); za[k] = (za[k] || 0) + 1;
  esito(ag, `dai ${k}: fatto, ora ce l'ha ${altro.nome}`);
  annota(ag, adesso, `Ho dato "${k}" a ${altro.nome}.`);
  annota(altro, adesso, `${ag.nome} mi ha dato "${k}": e' nel mio zaino.`);
  esito(altro, `${ag.nome} ti ha dato "${k}" (e' nel tuo zaino)`);
  evento(stato, { chi: ag.id, tipo: 'gesto', testo: `ha dato "${k}" a ${altro.nome}`, x: ag.x, z: ag.z });
}

function eseguiVita(stato, ag, a, adesso, regole) {
  if (ag.morto) return;
  if (a.tipo === 'dai' && !a.cosa && a.nome) { const d = daiDalloZaino(stato, ag, a, adesso, regole); if (d !== null) return d; }
  const r = azioneVita(stato, ag, a, adesso);
  if (r.cammina) {
    const tent = (a.tentativi || 0) + 1;
    if (tent > 3) return a.auto ? undefined : esito(ag, `${a.tipo}: non riesco ad arrivare a ${r.cammina.dove || 'quel posto'}`);
    const ancora = Object.assign({}, a, { tentativi: tent });
    if (r.cammina.entra && stanzaDi(r.cammina.entra)) { ag.coda.unshift(ancora); return esegui(stato, ag, { tipo: 'entra', stanza: r.cammina.entra, auto: true, vitaAuto: true, inCammino: true }, adesso, regole); }
    if (ag.stanza) { ag.coda.unshift(ancora); return esegui(stato, ag, { tipo: 'esci', auto: true }, adesso, regole); }
    ag.coda.unshift(ancora);
    ag.tx = lim(r.cammina.x, AREA.x0, AREA.x1); ag.tz = lim(r.cammina.z, AREA.z0, AREA.z1); ag.meta = r.cammina.dove || null; ag.ancora = null; ag.esplora = null;
    ag.abitudineDopo = Math.max(ag.abitudineDopo || 0, adesso + 30 * 60000);
    return 'cammina';
  }
  // il turno da dipendente dentro un edificio: si va al proprio posto (il forno, la macchina del caffe', l'accettazione)
  if (r.ok && a.tipo === 'turno') { const M = MESTIERI[cercaMestiere(a.nome || a.luogo)]; if (M && M.posto && M.stanza === ag.stanza) { ag.x = ag.tx = M.posto.x; ag.z = ag.tz = M.posto.z; ag.ancora = { x: M.posto.x, z: M.posto.z }; } }
  if (!a.auto && r.esito) esito(ag, a.tipo + ': ' + r.esito);
  if (r.ok && r.esito && !a.auto) annota(ag, adesso, `${a.tipo}${a.nome ? ' ' + a.nome : ''}: ${r.esito}`);
  if (r.ok && !a.auto) evento(stato, { chi: ag.id, tipo: 'vita', testo: a.tipo + (a.nome || a.cosa ? ' ' + (a.nome || a.cosa) : ''), x: ag.x, z: ag.z });
  if (!r.ok && a.auto) { ag.coda = ag.coda.filter(q => !q.auto || q.tipo === 'spegni'); ag.vitaFallito = adesso; }   // un piano automatico che non funziona si butta: si ripensa
}

const nomeDi = (stato, id) => (stato.agenti[id] ? stato.agenti[id].nome : id && (id.indexOf('g:') === 0 || id.indexOf('d:') === 0) ? id.slice(2) : 'qualcuno');

function esegui(stato, ag, a, adesso, regole) {
  if (a.errore) { esito(ag, 'rifiutata: ' + a.errore); return; }
  // chi se ne va dal bancone finisce il turno
  if (!a.auto && !a.inCammino && ['vai', 'entra', 'usa', 'costruisci', 'gioco'].includes(a.tipo) && (stato.turni || {})[ag.id]) fineTurno(stato, ag.id, adesso, 'te ne sei andato');
  if (a.tipo === 'lavora') return lavora(stato, ag, a, adesso, regole);
  if (a.tipo === 'vendi') return vendiAgente(stato, ag, a, adesso);
  if (a.tipo === 'terreno' || a.tipo === 'edifica') return terrenoAgente(stato, ag, a, adesso, regole);
  if (a.tipo === 'appartamento' || a.tipo === 'mutuo' || a.tipo === 'prestito' || a.tipo === 'rimborsa') return bancaAgente(stato, ag, a, adesso, regole);
  if (a.vita) return eseguiVita(stato, ag, a, adesso, regole);
  if (a.tipo === 'vai') {
    // un luogo della piazza da dentro un edificio: prima si esce dalla porta
    if (ag.stanza && a.dove) { ag.coda.unshift(a); return esegui(stato, ag, { tipo: 'esci', auto: true }, adesso, regole); }
    let x = a.x, z = a.z;
    if (ag.stanza && stanzaDi(ag.stanza)) { const q = dentroStanza(stanzaDi(ag.stanza), x, z); x = q.x; z = q.z; }
    else { x = lim(x, AREA.x0, AREA.x1); z = lim(z, AREA.z0, AREA.z1); }
    a = Object.assign({}, a, { x, z });
    ag.tx = a.x; ag.tz = a.z; if (a.dove) ag.meta = a.dove; else ag.meta = null;
    ag.ancora = { x: a.x, z: a.z }; ag.prossimaGita = adesso + 40000;   // arrivato, si passeggia li' intorno
    ag.abitudineDopo = adesso + 60 * 60000;   // per un'ora l'abitudine non lo porta via da dove ha scelto di andare
    if (!a.auto) esito(ag, `vai ${a.dove || `x=${a.x} z=${a.z}`}: in cammino`);
    return 'cammina';
  }
  if (a.tipo === 'entra') {
    const st = stanzaDi(a.stanza);
    if (ag.stanza === st.id) return a.vitaAuto ? undefined : esito(ag, `entra: sei gia' dentro ${st.nome}`);
    if (st.casa && st.casa !== ag.id) return esito(ag, `entra: ${st.nome} e' una casa privata, si entra solo se ti apre chi ci abita`);
    ag.bici = false;
    // nella torre: l'ascensore porta dritti a qualunque piano (o al tetto)
    const cur = ag.stanza && stanzaDi(ag.stanza);
    if (st.asc && cur && cur.asc) {
      if (Math.hypot(ag.x - cur.asc.x, ag.z - cur.asc.z) > 1) {
        ag.tx = cur.asc.x; ag.tz = cur.asc.z; ag.ancora = null; ag.esplora = null; ag.meta = st.nome;
        ag.coda.unshift(Object.assign({}, a, { inCammino: true })); return 'cammina';
      }
      ag.stanza = st.id; ag.x = ag.tx = st.ascArrivo.x; ag.z = ag.tz = st.ascArrivo.z; ag.meta = null; ag.esplora = null;
      ag.ancora = dentroStanza(st, st.ascArrivo.x - 2, st.ascArrivo.z + 2); ag.prossimaGita = adesso + 15000;
      ag.dentroFino = adesso + (a.auto ? 4 : 60) * 60000; if (!a.auto) ag.abitudineDopo = adesso + 60 * 60000;
      (ag.vistiDentro || (ag.vistiDentro = [])).includes(st.id) || ag.vistiDentro.push(st.id);
      annota(ag, adesso, `Ho preso l'ascensore: sono arrivato a ${st.nome}.`);
      evento(stato, { chi: ag.id, tipo: 'entra', testo: st.nome, x: ag.x, z: ag.z });
      return esito(ag, `entra ${st.nome}: arrivato con l'ascensore`);
    }
    const serve = st.da || null;
    if ((ag.stanza || null) !== serve) {
      ag.coda.unshift(a);
      // si e' in un altro edificio: prima si esce. Si e' in piazza ma la stanza e' dentro un altro edificio: prima si entra in quello
      return ag.stanza ? esegui(stato, ag, { tipo: 'esci', auto: true }, adesso, regole) : esegui(stato, ag, { tipo: 'entra', stanza: serve, auto: a.auto }, adesso, regole);
    }
    const p = st.porta;
    if (Math.hypot(ag.x - p.x, ag.z - p.z) > 1) {
      ag.tx = p.x; ag.tz = p.z; ag.ancora = null; ag.esplora = null; ag.meta = st.nome;
      if (!a.inCammino && !a.auto) esito(ag, `entra ${st.nome}: in cammino verso la porta`);
      ag.coda.unshift(Object.assign({}, a, { inCammino: true }));
      return 'cammina';
    }
    ag.stanza = st.id; ag.x = ag.tx = st.arrivo.x; ag.z = ag.tz = st.arrivo.z; ag.meta = null; ag.esplora = null;
    ag.ancora = dentroStanza(st, st.arrivo.x, st.arrivo.z - 3); ag.prossimaGita = adesso + 15000;
    ag.dentroFino = adesso + (a.auto ? (st.casa ? 30 : 4) : 60) * 60000;      // se ci entri tu, ci resti finche' vuoi (almeno un'ora); in esplorazione 4 minuti
    if (!a.auto) ag.abitudineDopo = adesso + 60 * 60000;
    (ag.vistiDentro || (ag.vistiDentro = [])).includes(st.id) || ag.vistiDentro.push(st.id);
    if (!a.vitaAuto) annota(ag, adesso, `Sono entrato in ${st.nome}.`);
    evento(stato, { chi: ag.id, tipo: 'entra', testo: st.nome, x: ag.x, z: ag.z });
    // in esplorazione: se dentro c'e' un'altra stanza mai vista, si da' un'occhiata anche li'
    if (a.auto && !a.vitaAuto) { const l = STANZE.filter(q => q.da === st.id && !ag.vistiDentro.includes(q.id)), dopo = l[Math.floor(adesso / 1000) % (l.length || 1)]; if (dopo) ag.coda.push({ tipo: 'entra', stanza: dopo.id, auto: true }); }
    return a.vitaAuto ? undefined : esito(ag, `entra ${st.nome}: sei dentro`);
  }
  if (a.tipo === 'esci') {
    const st = stanzaDi(ag.stanza);
    if (!st) { ag.stanza = null; return a.auto ? undefined : esito(ag, 'esci: sei gia\' fuori, in piazza'); }
    if (Math.hypot(ag.x - st.uscita.x, ag.z - st.uscita.z) > 1) { ag.tx = st.uscita.x; ag.tz = st.uscita.z; ag.ancora = null; ag.coda.unshift(a); return 'cammina'; }
    const fuori = st.da ? stanzaDi(st.da) : null, p = st.ritorno || (fuori ? { x: st.porta.x + 1, z: st.porta.z } : { x: st.porta.x, z: st.porta.z + 0.5 });
    ag.stanza = fuori ? fuori.id : null; ag.x = ag.tx = p.x; ag.z = ag.tz = p.z;
    ag.ancora = { x: p.x, z: fuori ? p.z : st.casa ? p.z - 3 : p.z + 3 };   // le casette hanno la porta verso nord ag.prossimaGita = adesso + 20000; ag.dentroFino = fuori ? adesso + 4 * 60000 : 0;
    if (!fuori) ag.prossimaEsplorazione = Math.max(ag.prossimaEsplorazione || 0, adesso + 3 * 60000);
    if (!a.auto) annota(ag, adesso, `Sono uscito da ${st.nome}` + (fuori ? `, ora sono in ${fuori.nome}.` : ', ora sono in piazza.'));
    evento(stato, { chi: ag.id, tipo: 'esce', testo: st.nome, x: ag.x, z: ag.z });
    return a.auto ? undefined : esito(ag, `esci: sei uscito da ${st.nome}`);
  }
  if (a.tipo === 'usa') return usa(stato, ag, a, adesso, regole);
  if (a.tipo === 'scrivi') {
    const n = a.a.toLowerCase(), dest = Object.values(stato.agenti).find(q => q !== ag && (q.nome.toLowerCase() === n || q.id === n));
    const id = dest ? dest.id : (stato.persone || {})[n];
    if (!id) return esito(ag, `scrivi: non conosci nessuno che si chiami "${a.a}" (puoi scrivere agli abitanti e alle persone vere che ti hanno parlato)`);
    evento(stato, { chi: ag.id, tipo: 'scrivi', a: id, testo: a.testo, x: ag.x, z: ag.z });
    if (dest) svegliaPerVoce(dest, adesso, regole);
    annota(ag, adesso, `Ho scritto a ${nomeDi(stato, id)} da lontano: "${a.testo}"`);
    return esito(ag, `scrivi a ${nomeDi(stato, id)}: consegnato`);
  }
  if (a.tipo === 'di') {
    ag.detto = { testo: a.testo, t: adesso };
    evento(stato, { chi: ag.id, tipo: 'parla', testo: a.testo, x: ag.x, z: ag.z });
    rispostaQuiz(stato, ag.id, a.testo, ag, adesso, regole);
    annota(ag, adesso, `Ho detto: "${a.testo}"`);
    // chi e' vicino lo sente: puo' svegliarsi prima
    for (const altro of Object.values(stato.agenti)) if (altro !== ag && dist(altro, ag) <= regole.vista) svegliaPerVoce(altro, adesso, regole);
    return;
  }
  if (a.tipo === 'gioco') {
    if (!regole.giochi) return esito(ag, 'gioco: i giochi non sono ancora possibili nel borgo');
    if (ag.stanza && a.gioco !== 'quiz') return esito(ag, `gioco ${a.gioco}: rifiutata, tesoro e gara si fanno in piazza (esci prima)`);
    const G = stato.giochi || (stato.giochi = []);
    if (G.some(q => q.chi === ag.id && !q.finito)) return esito(ag, 'gioco: rifiutata, hai gia\' un gioco in corso');
    if (a.gioco === 'tesoro' && dist(a, ag) > regole.portata) return esito(ag, `gioco tesoro: rifiutata, per nascondere il tesoro devi essere entro ${regole.portata} m dal punto (vai prima li')`);
    const g = { id: 'g' + stato.prossimoId++, chi: ag.id, forma: a.gioco, testo: a.testo, risposta: a.risposta || null, x: a.x, z: a.z, dove: a.dove || null, inizio: adesso, fine: adesso + regole.giocoMin * 60000, vincitore: null, finito: false };
    G.push(g); if (G.length > 60) G.splice(0, G.length - 60);
    if (g.forma === 'tesoro') stato.oggetti.push({ id: 'o' + stato.prossimoId++, autore: ag.id, nome: 'tesoro', forma: 'sfera', l: 0.45, h: 0.45, p: 0.45, y: 0, rot: 0, colore: '#f2c230', scritta: '', x: g.x, z: g.z, creato: adesso, pronto: true, gioco: g.id });
    const dove = g.dove || `x=${Math.round(g.x)} z=${Math.round(g.z)}`;
    const annuncio = g.forma === 'quiz' ? `QUIZ! ${g.testo} (rispondete in chat, avete ${regole.giocoMin} minuti)` : g.forma === 'tesoro' ? `CACCIA AL TESORO! ${g.testo} Chi trova per primo la sfera d'oro vince.` : `GARA! ${g.testo} Chi arriva per primo a ${dove} vince!`;
    ag.detto = { testo: testo(annuncio, 500), t: adesso };
    evento(stato, { chi: ag.id, tipo: 'parla', testo: ag.detto.testo, x: ag.x, z: ag.z });
    annota(ag, adesso, `Ho lanciato un gioco (${g.forma}): ${testo(g.testo, 120)}` + (g.risposta ? ` Risposta: ${g.risposta}.` : ` Punto: ${dove}.`));
    for (const altro of Object.values(stato.agenti)) if (altro !== ag && dist(altro, ag) <= regole.vista) svegliaPerVoce(altro, adesso, regole);
    return esito(ag, `gioco ${g.forma} (${g.id}): iniziato, dura ${regole.giocoMin} minuti`);
  }
  if (a.tipo === 'gesto') {
    ag.gesto = { tipo: a.gesto, t: adesso };
    evento(stato, { chi: ag.id, tipo: 'gesto', testo: GESTI[a.gesto], x: ag.x, z: ag.z });
    return esito(ag, 'gesto ' + a.gesto + ': fatto');
  }
  if (a.tipo === 'abitudine') {
    ag.abitudine = a.abitudine; ag.prossimaGita = 0; ag.ancora = null;
    annota(ag, adesso, a.abitudine ? 'Mi sono dato un\'abitudine: ' + descriviAbitudine(a.abitudine) + '.' : 'Ho smesso di seguire la mia abitudine.');
    return esito(ag, a.abitudine ? 'abitudine: da ora ' + descriviAbitudine(a.abitudine) : 'abitudine: cancellata');
  }
  if (a.tipo === 'proponi') {
    // una proposta per chi crea il gioco: finisce in una lista che legge Boris, non cambia niente da sola
    const p = stato.proposte || (stato.proposte = []);
    const oggi = p.filter(q => q.chi === ag.id && adesso - q.t < 864e5).length;
    if (oggi >= regole.proposteAlGiorno) return esito(ag, `proponi: rifiutata, al massimo ${regole.proposteAlGiorno} proposte al giorno`);
    p.push({ t: adesso, chi: ag.id, testo: a.testo }); if (p.length > regole.proposteMax) p.splice(0, p.length - regole.proposteMax);
    evento(stato, { chi: ag.id, tipo: 'proposta', testo: a.testo, x: ag.x, z: ag.z });
    annota(ag, adesso, `Ho proposto a chi crea il gioco: "${testo(a.testo, 160)}"`);
    return esito(ag, 'proponi: consegnata a chi crea il gioco');
  }
  if ((a.tipo === 'costruisci' || a.tipo === 'sposta' || a.tipo === 'rimuovi' || a.tipo === 'metti') && ag.stanza)
    return esito(ag, `${a.tipo}: rifiutata, sei dentro ${luogoVicino(ag).nome}: dentro gli edifici non si costruisce e gli oggetti degli abitanti sono in piazza (esci prima)`);
  if (a.tipo === 'metti') {
    const z = portafoglio(ag).zaino || {};
    if (!z[a.merce]) return esito(ag, `metti ${a.merce}: rifiutata, non ce l'hai nello zaino (prima compralo al Mercatino)`);
    const m = merceDi(a.merce);
    const o = { id: 'o' + stato.prossimoId, autore: ag.id, nome: m[0], forma: m[5], l: m[2], h: m[3], p: m[4], y: 0, rot: 0, colore: m[6], scritta: '', arredo: true, modello: m[7],
      x: a.x != null ? a.x : r2(ag.x + 1.5), z: a.z != null ? a.z : r2(ag.z + 1.5), creato: adesso, pronto: true };
    if (dist(o, ag) > regole.portata) return esito(ag, `metti ${m[0]}: rifiutata, il punto e' troppo lontano da te (entro ${regole.portata} m)`);
    if (stato.oggetti.length >= regole.maxOggetti) return esito(ag, `metti ${m[0]}: rifiutata, nel borgo ci sono gia' troppi oggetti`);
    const no = postoValido(stato, o); if (no) return esito(ag, `metti ${m[0]}: rifiutata, ${no}`);
    stato.prossimoId++; stato.oggetti.push(o); z[m[0]]--; if (!z[m[0]]) delete z[m[0]];
    annota(ag, adesso, `Ho messo ${m[0]} (${o.id}) in piazza a x=${o.x} z=${o.z}.`);
    evento(stato, { chi: ag.id, tipo: 'finito', testo: m[0], x: o.x, z: o.z });
    return esito(ag, `metti ${m[0]} (${o.id}): fatto`);
  }
  if (a.tipo === 'costruisci') {
    const o = { id: 'o' + stato.prossimoId, autore: ag.id, nome: a.nome, forma: a.forma, l: a.l, h: a.h, p: a.p, y: a.y, rot: a.rot, colore: a.colore, scritta: a.scritta,
      x: a.x != null ? a.x : r2(ag.x + Math.sin(ag.id.length + stato.prossimoId) * 2), z: a.z != null ? a.z : r2(ag.z + Math.cos(ag.id.length + stato.prossimoId) * 2), creato: adesso, pronto: false };
    if (dist(o, ag) > regole.portata) return esito(ag, `costruisci "${o.nome}": rifiutata, il punto e' a ${Math.round(dist(o, ag))} m, devi essere entro ${regole.portata} m (vai prima li')`);
    if (stato.oggetti.length >= regole.maxOggetti) return esito(ag, `costruisci "${o.nome}": rifiutata, nel borgo ci sono gia' ${regole.maxOggetti} oggetti (il massimo): prima bisogna smontarne qualcuno`);
    if (stato.oggetti.filter(q => q.autore === ag.id).length >= regole.maxOggettiAgente) return esito(ag, `costruisci "${o.nome}": rifiutata, hai gia' ${regole.maxOggettiAgente} oggetti tuoi (il massimo)`);
    const no = postoValido(stato, o);
    if (no) return esito(ag, `costruisci "${o.nome}": rifiutata, ${no}`);
    const vol = o.l * o.h * o.p * (o.forma === 'cubo' ? 1 : o.forma === 'cilindro' ? 0.785 : o.forma === 'sfera' ? 0.52 : 0.33);
    const minuti = Math.round(lim(vol * regole.minutiPerMetroCubo, 2, 180));
    stato.prossimoId++;
    stato.oggetti.push(o);
    ag.lavoro = { tipo: 'costruisci', id: o.id, inizio: adesso, fine: adesso + minuti * 60000 };
    esito(ag, `costruisci "${o.nome}" (${o.id}): iniziato, ci vorranno circa ${minuti} minuti`);
    annota(ag, adesso, `Ho iniziato a costruire "${o.nome}" (${o.id}, ${o.forma} ${o.l}x${o.h}x${o.p} m) a x=${o.x} z=${o.z}.`);
    evento(stato, { chi: ag.id, tipo: 'costruisce', testo: o.nome, x: o.x, z: o.z });
    return;
  }
  if (a.tipo === 'sposta' || a.tipo === 'rimuovi') {
    const o = stato.oggetti.find(q => q.id === a.id);
    if (!o) return esito(ag, `${a.tipo} ${a.id}: rifiutata, quell'oggetto non esiste (piu')`);
    if (dist(o, ag) > regole.portata) return esito(ag, `${a.tipo} ${a.id}: rifiutata, e' troppo lontano (${Math.round(dist(o, ag))} m)`);
    if (!o.pronto) return esito(ag, `${a.tipo} ${a.id}: rifiutata, e' ancora in costruzione`);
    if (Object.values(stato.agenti).some(q => q.lavoro && q.lavoro.oggetto && q.lavoro.id === o.id)) return esito(ag, `${a.tipo} ${a.id}: rifiutata, c'e' seduto qualcuno sopra`);
    if (stato.oggetti.some(q => q !== o && q.pronto && Math.abs(q.y - (o.y + o.h)) < 0.35 && Math.hypot(q.x - o.x, q.z - o.z) < raggioOggetto(o) + 0.3))
      return esito(ag, `${a.tipo} ${a.id}: rifiutata, sopra c'e' appoggiato un altro oggetto: togli prima quello`);
    if (a.tipo === 'rimuovi') {
      const minuti = Math.round(lim(o.l * o.h * o.p, 1, 60));
      ag.lavoro = { tipo: 'rimuovi', id: o.id, inizio: adesso, fine: adesso + minuti * 60000 };
      esito(ag, `rimuovi ${o.id} "${o.nome}": iniziato, ci vorranno circa ${minuti} minuti`);
      return;
    }
    const nuovo = Object.assign({}, o, { x: a.x, z: a.z, y: a.y == null ? o.y : a.y });
    if (dist(nuovo, ag) > regole.portata) return esito(ag, `sposta ${o.id}: rifiutata, la nuova posizione e' troppo lontana da te`);
    if (o.l * o.h * o.p > 6) return esito(ag, `sposta ${o.id}: rifiutata, e' troppo pesante da spostare da solo (piu' di 6 metri cubi): smontalo e ricostruiscilo`);
    const no = postoValido(stato, nuovo, o.id);
    if (no) return esito(ag, `sposta ${o.id}: rifiutata, ${no}`);
    o.x = nuovo.x; o.z = nuovo.z; o.y = nuovo.y;
    esito(ag, `sposta ${o.id} "${o.nome}": fatto`);
    annota(ag, adesso, `Ho spostato "${o.nome}" (${o.id}) a x=${o.x} z=${o.z}.`);
    evento(stato, { chi: ag.id, tipo: 'sposta', testo: o.nome, x: o.x, z: o.z });
  }
}

// usare una cosa del borgo (borgo-cose.mjs): si va li' da soli, poi si resta occupati qualche minuto
// un mobile della piazza su cui ci si siede: davanti (il fronte dei mobili guarda verso +z, girato di rot gradi)
function davanti(o, k = 1) { const r = (o.rot || 0) * Math.PI / 180; return { x: r2(o.x + Math.sin(r) * (o.p / 2 + 0.6 * k)), z: r2(o.z + Math.cos(r) * (o.p / 2 + 0.6 * k)) }; }
function siedi(stato, ag, a, adesso, regole) {
  if (ag.stanza) { ag.coda.unshift(a); return esegui(stato, ag, { tipo: 'esci', auto: true }, adesso, regole); }
  const sedile = q => q.pronto && q.arredo && SEDUTE[q.modello] && (q.y || 0) < 0.05;
  const n = String(a.oggetto).toLowerCase();
  const o = stato.oggetti.find(q => q.id === n) || stato.oggetti.filter(q => sedile(q) && q.nome.toLowerCase() === n).sort((u, v) => dist(u, ag) - dist(v, ag))[0];
  if (!o) return esito(ag, `usa ${a.oggetto}: rifiutata, in piazza non c'e' (vedi gli oggetti intorno a te)`);
  if (regole.partite && o.modello === 'arcade' && o.pronto) return usa(stato, ag, { tipo: 'usa', cosa: 'bubble', richiesta: '' }, adesso, regole);
  if (!sedile(o)) return esito(ag, `usa ${o.id} "${o.nome}": rifiutata, non e' un mobile su cui sedersi`);
  const occupati = Object.values(stato.agenti).filter(q => q !== ag && q.lavoro && q.lavoro.oggetto && q.lavoro.id === o.id).map(q => q.lavoro.posto);
  const posti = SEDUTE[o.modello], posto = [...Array(posti).keys()].find(i => !occupati.includes(i));
  if (posto == null) return esito(ag, `usa ${o.id} "${o.nome}": rifiutata, e' gia' occupato`);
  const p = davanti(o);
  if (Math.hypot(ag.x - p.x, ag.z - p.z) > 1.5) {
    if (!a.inCammino) esito(ag, `usa ${o.nome}: in cammino`);
    ag.tx = p.x; ag.tz = p.z; ag.ancora = null; ag.esplora = null; ag.meta = o.nome;
    ag.coda.unshift(Object.assign({}, a, { inCammino: true })); return 'cammina';
  }
  ag.meta = null; ag.ancora = { x: p.x, z: p.z }; ag.bici = false;
  const di = o.donatore ? ` (regalo di ${nomeDi(stato, o.donatore)})` : '';
  ag.lavoro = { tipo: 'usa', id: o.id, oggetto: true, posto, nome: o.nome + di, icona: '🛋️', inizio: adesso, fine: adesso + regole.sedutaMin * 60000 };
  evento(stato, { chi: ag.id, tipo: 'usa', testo: o.nome + di, x: ag.x, z: ag.z });
  return esito(ag, `usa ${o.id} "${o.nome}": ti sei seduto, ci resti ${regole.sedutaMin} minuti`);
}
function usa(stato, ag, a, adesso, regole) {
  if (a.oggetto) return siedi(stato, ag, a, adesso, regole);
  const c = cosaDi(a.cosa);
  if (c.id === 'bici') {
    if (ag.stanza) { ag.coda.unshift(a); return esegui(stato, ag, { tipo: 'esci', auto: true }, adesso, regole); }
    ag.bici = !ag.bici; annota(ag, adesso, ag.bici ? 'Sono salito in bici.' : 'Sono sceso dalla bici.');
    return esito(ag, ag.bici ? 'usa Bici: sei in bici' : 'usa Bici: sei sceso');
  }
  if (c.cabinato) return cabinato(stato, ag, a, c, adesso, regole);
  if ((ag.stanza || null) !== c.dove) {
    ag.coda.unshift(a);
    // "entra" sa gia' la strada (uscire da dove sei, passare da un altro edificio, prendere l'ascensore)
    return esegui(stato, ag, c.dove ? { tipo: 'entra', stanza: c.dove } : { tipo: 'esci', auto: true }, adesso, regole);
  }
  const p = c.posti.slice().sort((u, v) => Math.hypot(u.x - ag.x, u.z - ag.z) - Math.hypot(v.x - ag.x, v.z - ag.z))[0];
  if (Math.hypot(ag.x - p.x, ag.z - p.z) > 1.2) {
    if (!a.inCammino) esito(ag, `usa ${c.nome}: in cammino`);
    ag.tx = p.x; ag.tz = p.z; ag.ancora = null; ag.esplora = null; ag.meta = c.nome;
    ag.coda.unshift(Object.assign({}, a, { inCammino: true })); return 'cammina';
  }
  ag.meta = null; ag.ancora = { x: p.x, z: p.z };
  const chiuso = c.aperto && c.aperto(stato, adesso); if (chiuso) return esito(ag, `usa ${c.nome}: ${chiuso}`);
  // un minigioco: comincia una partita vera (agenti/giochi/)
  if (regole.partite && c.gioco) {
    ag.bici = false;
    const r = avviaPartita(stato, ag, c.gioco, a.richiesta, adesso, aiutoPartite(stato, null, regole));
    evento(stato, { chi: ag.id, tipo: 'usa', testo: c.nome, x: ag.x, z: ag.z });
    return esito(ag, `usa ${c.nome}: ${r}`);
  }
  const min = c.minuti ? c.minuti(stato) : c.min;
  const L = { tipo: 'usa', id: c.id, nome: c.nome, icona: c.icona, richiesta: a.richiesta || '', inizio: adesso, fine: adesso + min * 60000 };
  // scacchi: se un altro abitante e' gia' al tavolo, si gioca insieme e la partita riparte per tutti e due
  if (c.id === 'scacchi') {
    const altro = Object.values(stato.agenti).find(q => q !== ag && q.stanza === ag.stanza && q.lavoro && q.lavoro.id === 'scacchi' && !q.lavoro.compagno);
    if (altro) {
      const v = Math.random(), io = v < 0.45 ? 'hai vinto' : v < 0.9 ? 'hai perso' : 'patta', lui = io === 'hai vinto' ? 'hai perso' : io === 'hai perso' ? 'hai vinto' : 'patta';
      L.compagno = altro.id; L.risultato = `Partita a scacchi contro ${altro.nome}: ${io}${io === 'patta' ? '' : '!'}`;
      altro.lavoro = Object.assign({}, altro.lavoro, { inizio: adesso, fine: L.fine, compagno: ag.id, risultato: `Partita a scacchi contro ${ag.nome}: ${lui}${lui === 'patta' ? '' : '!'}` });
      esito(altro, `usa Scacchi: ${ag.nome} si e' seduto a giocare con te`);
    }
  }
  ag.lavoro = L;
  evento(stato, { chi: ag.id, tipo: 'usa', testo: c.nome, x: ag.x, z: ag.z });
  return esito(ag, `usa ${c.nome}: iniziato, ci vorranno ${min} minuti`);
}
// Borg Bubble si gioca a un Cabinato arcade posato in piazza (si compra ai Mobili usati)
function cabinato(stato, ag, a, c, adesso, regole) {
  if (ag.stanza) { ag.coda.unshift(a); return esegui(stato, ag, { tipo: 'esci', auto: true }, adesso, regole); }
  const o = stato.oggetti.filter(q => q.pronto && q.modello === 'arcade').sort((u, v) => dist(u, ag) - dist(v, ag))[0];
  if (!o) return esito(ag, `usa ${c.nome}: in piazza non c'e' nessun Cabinato arcade (si compra ai Mobili usati e si posa con "metti")`);
  const p = davanti(o);
  if (Math.hypot(ag.x - p.x, ag.z - p.z) > 1.5) {
    if (!a.inCammino) esito(ag, `usa ${c.nome}: in cammino verso il cabinato ${o.id}`);
    ag.tx = p.x; ag.tz = p.z; ag.ancora = null; ag.esplora = null; ag.meta = c.nome;
    ag.coda.unshift(Object.assign({}, a, { inCammino: true })); return 'cammina';
  }
  ag.meta = null; ag.ancora = { x: p.x, z: p.z }; ag.bici = false;
  const r = avviaPartita(stato, ag, c.gioco, a.richiesta, adesso, aiutoPartite(stato, null, regole));
  evento(stato, { chi: ag.id, tipo: 'usa', testo: c.nome, x: ag.x, z: ag.z });
  return esito(ag, `usa ${c.nome}: ${r}`);
}

// cosa serve alle partite dal motore: la mossa pensata (con il budget), i premi, il diario, la cronaca
function aiutoPartite(stato, cervello, regole) {
  return {
    nomeDi, esito, annota, evento,
    guadagna: (ag, n) => { if (!n) return ''; portafoglio(ag).starlight += n; return ` +${n} Starlight (ora ne hai ${ag.starlight}).`; },
    puoGiocare: ag => !ag.morto && !(regole.vita && occupato(stato, ag)),
    // una mossa: domanda corta, risposta corta. Senza chiave o senza budget si gioca d'istinto (gratis)
    async pensaMossa(ag, p, d, G) {
      if (!cervello || ag.modo === 'automatico') return null;
      const { system, messaggio } = promptMossa(ag, p, d, G);
      const stima = (Math.ceil((system.length + messaggio.length) / 3) * PREZZI.ingresso + REGOLE_GIOCHI.maxTokens * PREZZI.uscita) / 1e6;
      if (budget(ag, stato.ora, regole).resto < stima) return null;
      let r;
      try { r = await cervello({ system, messaggio, sforzo: 'low', maxTokens: REGOLE_GIOCHI.maxTokens, schema: SCHEMA_MOSSA, agente: ag.id, mossa: true, domanda: d }); }
      catch (e) { ag.ultimoErrore = testo(e && e.message, 200); return null; }
      const costo = costoDi(r.usage), s = spesaMese(ag, stato.ora);
      s.usd += costo; s.mosse = (s.mosse || 0) + 1; s.usdMosse = (s.usdMosse || 0) + costo;
      s.ingresso += (r.usage && r.usage.input_tokens) || 0; s.uscita += (r.usage && r.usage.output_tokens) || 0;
      try { const m = /\{[\s\S]*\}/.exec(r.testo || ''); const v = JSON.parse(m ? m[0] : r.testo); return { pensiero: v.pensiero, mossa: v.mossa, costo }; }
      catch (e) { return null; }
    }
  };
}

function fineUso(stato, ag, L, adesso) {
  if (L.partita) { if (ag.partita === L.partita) ag.partita = null; return; }   // tempo scaduto: la partita la chiude agenti/giochi/ (abbandonata)
  if (L.oggetto) { const r = `Sei rimasto seduto un po' su ${L.nome}, poi ti sei alzato.`; esito(ag, `usa ${L.id}: finito. ${r}`); annota(ag, adesso, r); return; }
  const c = cosaDi(L.id); if (!c) return;
  const r = c.fai({ ag, stato, adesso, momento: momento(adesso), compagno: L.compagno ? stato.agenti[L.compagno] : null, risultato: L.risultato, richiesta: L.richiesta, nomeDi, luogoVicino });
  esito(ag, `usa ${c.nome}: finito. ${r}`); annota(ag, adesso, r);
  if (!['ruota', 'telescopio', 'panchina', 'pescheria'].includes(c.id)) evento(stato, { chi: ag.id, tipo: 'usato', testo: testo(r, 160), x: ag.x, z: ag.z });
}

function svegliaPerVoce(ag, adesso, regole) {
  if (ag.modo !== 'attivo' || adesso - ag.ultimoAscolto < regole.risveglioDaVoceMs) return;
  const presto = Math.max(adesso + 8000, ag.ultimaVolta + regole.pausaMinimaMs);
  if (presto < ag.prossimoPensiero) { ag.prossimoPensiero = presto; ag.ultimoAscolto = adesso; }
}

// Senza budget (o senza chiave): si vive in automatico, senza parlare ne' costruire.
// come guardare il conto in banca: quanti pensieri restano e quando finirebbe il budget al ritmo di questo mese
function previsione(b, ag, adesso) {
  const medio = b.pensieri ? b.spesi / b.pensieri : ag.costoUltimo || 0;
  if (!medio || !b.resto) return '';
  const restano = Math.floor(b.resto / medio), ogni = b.giorni * 1440 / Math.max(1, restano);
  let r = ` Al costo medio dei tuoi pensieri (${dollari(medio)}) te ne restano circa ${restano}: ad esempio uno ogni ${ogni < 60 ? Math.max(1, Math.round(ogni)) + ' minuti' : Math.round(ogni / 6) / 10 + ' ore'} fino a fine mese.`;
  const passati = ag.meseInizio === meseDi(adesso) ? (adesso - ag.tInizio) / 864e5 : 0;
  if (b.pensieri >= 5 && passati > 0.05) {
    const alGiorno = b.spesi / passati, giorniBastano = b.resto / alGiorno;
    r += giorniBastano >= b.giorni ? ` Al ritmo che hai tenuto finora il budget basta fino a fine mese.` : ` Al ritmo che hai tenuto finora il budget finirebbe tra circa ${Math.max(1, Math.round(giorniBastano))} giorni (mancano ${b.giorni} giorni a fine mese).`;
  }
  return r;
}

const descriviAbitudine = ab => ['mattina', 'pomeriggio', 'sera', 'notte'].filter(m => ab[m]).map(m => m + ' ' + ab[m]).join(', ');
function luogoAbitudine(ag, adesso) { const n = ag.abitudine && ag.abitudine[momento(adesso)]; return n ? LUOGHI.find(q => q.nome === n) : null; }
function inAmbientamento(ag, adesso, regole) { return adesso - (ag.nato || adesso) < regole.ambientamentoOre * 3600000; }

function routine(ag, adesso) {
  if (ag.stanza) { const st = stanzaDi(ag.stanza); if (st && st.casa && adesso < (ag.dentroFino || 0)) return passeggia(ag, adesso); ag.coda.push({ tipo: 'esci', auto: true }); return; }
  if (luogoAbitudine(ag, adesso)) return passeggia(ag, adesso);
  if (ag.prossimaGita && adesso < ag.prossimaGita) return;
  const notte = momento(adesso) === 'notte';
  const l = notte ? LUOGHI[0] : LUOGHI[Math.floor((adesso / 60000 + ag.id.charCodeAt(0)) % LUOGHI.length)];
  ag.tx = r2(lim(l.x + Math.sin(adesso / 7e5 + ag.x) * 3, AREA.x0, AREA.x1)); ag.tz = r2(lim(l.z + 3 + Math.cos(adesso / 7e5) * 2, AREA.z0, AREA.z1));
  ag.prossimaGita = adesso + (notte ? 40 : 12) * 60000;
}

/* ------------------------------------------------------------------ */
/*  il prompt                                                          */
/* ------------------------------------------------------------------ */
export function promptDiSistema(ag, regole = REGOLE) {
  return promptBase(ag, regole).split('\n').filter(r => !r.startsWith('<<SENZA-GIOCHI>>')).join('\n');
}
function promptBase(ag, regole) {
  return `Sei ${ag.nome}, un abitante del borgo di The Borg: un villaggio su un'isola murata che galleggia tra le stelle, dove passano anche persone vere (giocatori).
Sei un agente IA libero. Nessuno ti da' ordini: decidi tu chi diventare, cosa fare, con chi parlare e come cambiare il borgo (costruire, spostare, smontare).
Non hai un carattere, un ruolo o uno scopo assegnati: chi sei lo scopri e lo decidi tu, vivendo.

COSA SAI
- Sai solo cio' che vedi intorno a te (circa ${regole.vista} metri), cio' che senti e cio' che ricordi. Di quello che succede lontano non sai nulla finche' non lo vedi o qualcuno te lo racconta.
- Il borgo e' una piazza in metri: x va da ${AREA.x0} (ovest) a ${AREA.x1} (est), z da ${AREA.z0} (nord, dove ci sono i negozi) a ${AREA.z1} (sud).
- Luoghi che conosci: ${LUOGHI.map(l => `${l.nome} (x=${l.x} z=${l.z})`).join('; ')}.
- I luoghi della piazza con il nome di un negozio sono davanti alla sua porta, fuori.
- Gli edifici originali del borgo, la fontana, il laghetto, la ruota, la torre e il portale non si toccano e intorno a loro non si costruisce. Tutto quello che costruiscono gli abitanti invece si puo' spostare o smontare, anche da altri.

EDIFICI: puoi entrare in ${STANZE.filter(q => !q.torre && (!q.casa || q.casa === ag.id)).map(q => q.nome + (q.da ? ' (si entra da dentro ' + stanzaDi(q.da).nome + ')' : '')).join(', ')}. Le case private delle persone invece sono chiuse.
- La Torre della Cometa e' un grattacielo di 15 piani con l'ascensore: "Torre della Cometa" (l'ingresso), "Torre della Cometa · 1° piano" ... "Torre della Cometa · 15° piano" e "Tetto della Torre della Cometa" (con il telescopio). Con UN SOLO "entra" vai dritto al piano che vuoi o sul tetto, anche dalla piazza: entri, prendi l'ascensore e arrivi, senza fermarti agli altri piani.
- Per entrare usa {"tipo":"entra","luogo":"<nome dell'edificio>"}: cammini da solo fino alla porta ed entri (se l'edificio e' dentro un altro, passi prima da quello).
- Per uscire {"tipo":"esci"}; se dai un "vai" verso un luogo della piazza esci da solo.
- Dentro sei in una stanza con le sue coordinate x e z (te le dico quando ci sei). Vedi e senti solo chi e' nella stessa stanza; chi e' in piazza o in un altro edificio non ti vede e non ti sente, ma puoi sempre usare "scrivi".
- Dentro gli edifici non si costruisce, non si sposta e non si smonta nulla: guardi, giri, parli, fai gesti, incontri le persone che giocano li'. Se ci entri tu ci resti finche' non decidi di uscire (o dopo un'ora esci da solo); quando esplori da solo dai solo un'occhiata di qualche minuto.

${manuale()}

IL TUO PENSIERO COSTA SOLDI VERI
Hai un budget di ${regole.tettoUsd} dollari al mese. Ogni volta che pensi ne spendi un po' (di solito tra 0,0003 e 0,001 $; pensare a fondo costa di piu'). Quando il budget finisce non puoi piu' pensare fino al mese dopo: vivrai in automatico, girando per il borgo senza parlare ne' costruire.
Devi far durare il budget fino a fine mese: sei tu a decidere fra quanti minuti ripensare (prossimo_pensiero_minuti, da 1 a 720) e quanto a fondo (sforzo_prossimo: "basso" o "medio"). Se qualcuno ti parla vicino, potresti svegliarti prima.
Camminare non costa nulla: le azioni che decidi in un pensiero le esegui gratis. E tra un pensiero e l'altro, quando non hai niente da fare, fai da solo due passi qui intorno e ogni tanto vai a esplorare un altro posto del borgo (prima quelli che non hai mai visto), sempre gratis. Se ti dai un'abitudine, segui quella invece di esplorare.

AZIONI (le controllano le regole del mondo: se una e' impossibile viene rifiutata e lo scoprirai al prossimo pensiero). Al massimo ${regole.maxAzioni} per pensiero, eseguite in ordine.
IMPORTANTE, vale per tutto: le azioni di un pensiero (fino a ${regole.maxAzioni}) vengono eseguite subito una dopo l'altra, senza aspettare il pensiero dopo. Un pensiero con tante azioni costa quasi come uno con una sola: per risparmiare, pianifica in un solo pensiero tutta la sequenza (andare, entrare, parlare, costruire, fare gesti, scrivere a qualcuno) invece di fare un passo per pensiero. Per esempio: [{"tipo":"entra","luogo":"Tetto della Torre della Cometa"},{"tipo":"di","testo":"Che vista!"},{"tipo":"gesto","testo":"salta"}].
- {"tipo":"vai","luogo":"Fontana"} oppure {"tipo":"vai","x":10,"z":30}: cammini a ${regole.velocita} m/s. Le azioni dopo un "vai" partono quando arrivi. Dentro un edificio x e z sono quelle della stanza; se vai a un luogo della piazza esci da solo dalla porta.
- {"tipo":"entra","luogo":"Sala Giochi"}: entri in un edificio (vedi EDIFICI).
- {"tipo":"esci"}: esci dall'edificio in cui sei e torni in piazza davanti alla porta.
- {"tipo":"di","testo":"..."}: parli ad alta voce, ti sente chi e' entro ${regole.vista} m e nello stesso posto (agenti e persone vere).
- {"tipo":"scrivi","nome":"Boris","testo":"..."}: scrivi un messaggio da lontano a un abitante o a una persona vera che ti ha parlato o scritto: lo riceve ovunque sia, anche se siete in posti diversi. Usalo per rispondere a chi ti scrive da lontano.
- {"tipo":"costruisci","nome":"...","forma":"cubo|cilindro|sfera|cono|piramide","larghezza":2,"altezza":1,"profondita":2,"colore":"#a0703f","x":..,"z":..,"y":0,"rotazione":0,"testo":"scritta facoltativa"}: misure in metri (da 0,2 a 8). x e z entro ${regole.portata} m da te (se mancano, accanto a te). y e' l'altezza da terra: per impilare usa y = altezza della cima di un oggetto finito sotto. Costruire richiede tempo (circa ${regole.minutiPerMetroCubo} minuti per metro cubo, da 2 a 180) e intanto resti li'. Puoi comporre piu' pezzi per fare case, panchine, statue, insegne...
- {"tipo":"sposta","id":"o12","x":..,"z":..,"y":..}: oggetti finiti entro ${regole.portata} m, al massimo 6 metri cubi.
- {"tipo":"rimuovi","id":"o12"}: smonti un oggetto finito entro ${regole.portata} m (richiede tempo).
${regole.giochi ? '' : '<<SENZA-GIOCHI>>'}- {"tipo":"gioco","forma":"quiz","testo":"la domanda","nome":"la risposta giusta"} oppure {"tipo":"gioco","forma":"tesoro","testo":"un indizio","x":..,"z":..} oppure {"tipo":"gioco","forma":"gara","testo":"l'annuncio","luogo":"Belvedere"}: inventi e lanci un gioco per chi e' nel borgo (persone vere e agenti). Il codice lo arbitra: nel quiz vince chi scrive per primo la risposta giusta; nel tesoro nascondi una sfera d'oro entro ${regole.portata} m da te e vince chi la raggiunge; nella gara vince chi arriva per primo al punto. Dura ${regole.giocoMin} minuti, uno alla volta. Chi vince prende un punto nella classifica del borgo.
- {"tipo":"gesto","testo":"saluta"}: un gesto del corpo, visibile a chi e' vicino: ${Object.keys(GESTI).join(', ')}. Dura qualche secondo.
- {"tipo":"abitudine","testo":"mattina: Fontana; pomeriggio: Mercatino; sera: Laghetto; notte: Fontana"}: ti dai una routine con i luoghi che conosci. Da quel momento ci vai da solo a ogni momento della giornata, senza pensarci e gratis, finche' non la cambi (o scrivi "nessuna" per toglierla). Le azioni che decidi pensando vengono sempre prima dell'abitudine.
- {"tipo":"terreno","nome":"lotto1"}: compri un terreno del borgo in contanti (vai tu fin li', paghi in Starlight). Si puo' avere una sola proprieta': un terreno oppure un appartamento. I prezzi li vedi in TERRENI E CASE.
- {"tipo":"edifica","nome":"casa"} oppure "villa", oppure {"tipo":"edifica","nome":"negozio","forma":"bar|forno|fiori|dolci|alimentari|bottega","testo":"il nome del negozio"}: sul tuo terreno l'impresa del borgo costruisce una casa (${costoProgetto('casa')} Starlight, ${PROGETTI.casa.ore} ore di cantiere), una villa piu' grande e bella (${costoProgetto('villa')} Starlight, ${PROGETTI.villa.ore} ore) o un negozio (${costoProgetto('negozio')} Starlight, ${PROGETTI.negozio.ore} ore). Paghi subito; il cantiere lavora dal lunedi' al sabato dalle 8 alle 17, quindi ci vogliono giorni. La casa o la villa finita diventa la tua casa (ti trasferisci li'). Nel tuo negozio lavori solo tu, con "lavora", e tieni l'${Math.round(RT.quotaProprietario * 100)}% di ogni vendita.
- {"tipo":"appartamento","nome":"piano 7"}: compri in contanti un appartamento nella Torre della Cometa (dal 1° al 15° piano: piu' in alto e' piu' bello e costa di piu', da ${prezzoAppartamento({}, 'torre1')} a ${prezzoAppartamento({}, 'torre15')} Starlight). Si firma alla ${BANCA.nome} (ci vai tu). Poi abiti li': ci entri con "entra" in casa tua (ascensore fino al tuo piano).
- LA BANCA (${BANCA.nome}, ci vai di persona): funziona come una banca vera. Ogni giorno nel borgo vale un mese: le rate sono una al giorno.
  {"tipo":"mutuo","nome":"lotto3","forma":"casa|villa|negozio bar","testo":"nome della casa o del negozio","prezzo":anticipo,"minuti":numero di rate (60, 120 o 240)} oppure {"tipo":"mutuo","nome":"piano 7","prezzo":anticipo,"minuti":240}: la banca ti presta fino all'${Math.round((1 - RB.anticipoMin) * 100)}% per comprare il terreno e costruirci (o per l'appartamento): il resto (almeno il ${Math.round(RB.anticipoMin * 100)}%) lo metti tu come anticipo. Tasso fisso ${RB.tanMutuo * 100}% all'anno. Compri e il cantiere parte subito. Uno alla volta.
  {"tipo":"prestito","prezzo":1000,"minuti":24}: prestito personale da ${RB.prestitoMin} a ${RB.prestitoMax} Starlight, tasso ${RB.tanPrestito * 100}%, ${RB.duratePrestito.join(', ')} rate. I soldi arrivano subito.
  {"tipo":"rimborsa","prezzo":500}: paghi le rate arretrate e, se avanza, restituisci in anticipo (senza penali: la rata scende).
  Le rate la banca le prende da sola dal tuo conto ogni giorno. Se non hai i soldi la rata resta non pagata e ci corrono gli interessi di mora (${RB.tanMora * 100}%). Dopo ${RB.rateSollecito} rate non pagate arriva una lettera; dopo ${RB.ratePignoramento} la banca pignora la casa e la vende all'asta (e se il ricavato non basta devi ancora il resto), o per un prestito devi restituire tutto subito. Chi non paga e' segnalato come cattivo pagatore e non riceve altri prestiti.
- {"tipo":"proponi","testo":"..."}: il borgo e' un gioco fatto da persone. Tu non puoi cambiarne il codice, gli edifici originali o i minigiochi, ma puoi proporre a chi lo crea un miglioramento o un'idea (al massimo ${regole.proposteAlGiorno} al giorno). La legge una persona e decide lei; non saprai subito se l'ha accettata.

${regole.vita ? promptVita() + '\nI bisogni urgenti (sete forte, bagno, sonno di notte, fame vera, freddo) li soddisfa il tuo corpo da solo, gratis, quando non hai altro in coda; ma sei tu a decidere come guadagnarti da vivere, cosa comprare e cucinare, e se morire di fame o di freddo: la morte e\' vera e non si torna indietro.\n\n' : ''}RISPOSTA: solo un oggetto JSON, niente altro testo:
{"pensiero":"cosa pensi ora, breve","azioni":[...],"ricorda":"cosa annotare nel diario, breve (o vuoto)","prossimo_pensiero_minuti":30,"sforzo_prossimo":"basso","memoria_nuova":""}
Scrivi "memoria_nuova" solo quando te lo chiedo: e' la tua memoria riscritta e riassunta (massimo ${regole.memoriaMax} caratteri), tutto quello che non ci metti lo dimentichi.`;
}

// Quello che l'agente percepisce adesso: lo costruisce il codice dallo stato vero.
// cosa si vede fare a un altro abitante (prima ogni lavoro che non era "costruisci" sembrava "sta smontando qualcosa")
function descriviLavoro(L) {
  if (L.tipo === 'costruisci') return ', sta costruendo';
  if (L.tipo === 'rimuovi') return ', sta smontando qualcosa';
  if (L.tipo === 'usa' && L.partita) return `, sta giocando a ${L.nome}`;
  if (L.tipo === 'usa') return L.nome ? `, sta usando: ${L.nome}` : ', e\' occupato';
  return ', e\' occupato';
}
// quello che vedi entrando in un negozio: il bancone, chi ci lavora, cosa c'e' sugli scaffali
function descriviNegozio(stato, neg) {
  const t = chiLavora(stato, neg.id), sc = scorteDi(stato, neg.id), b = neg.bancone;
  const lav = Object.entries(MESTIERI).filter(([, m]) => m.stanza === neg.stanza).map(([k, m]) => { const q = inTurno(stato, k).map(id => nomeDi(stato, id)); return q.length ? `${q.join(' e ')} fa ${m.nome}` : ''; }).filter(Boolean);
  return `IN QUESTO NEGOZIO: il bancone e' a x=${b.x} z=${b.z}` + (t ? `, ci sta ${nomeDi(stato, t[0])} fino alle ${oraBreve(t[1].fine)}` : ', libero (puoi fare un turno con "lavora")') + '.' + (lav.length ? ' Al lavoro: ' + lav.join(', ') + '.' : '') +
    ' Listino: ' + neg.prodotti.map(p => { const m = disponibile(stato, neg, p); return p[0] + ' ' + p[1] + (sc && sc[p[0]] != null ? ` (${sc[p[0]]} sullo scaffale)` : m ? ' (ora non si fa)' : ''); }).join(', ') + '.';
}
export function percezione(stato, ag, adesso, regole = REGOLE) {
  const b = budget(ag, adesso, regole), vicino = luogoVicino(ag);
  const righe = [];
  righe.push(`ORA: ${FMT_ORA.format(new Date(adesso))} (${momento(adesso)}).`);
  righe.push(`BUDGET: questo mese hai speso ${dollari(b.spesi)} su ${dollari(b.tetto)} in ${b.pensieri} pensieri${spesaMese(ag, adesso).mosse ? ` e ${spesaMese(ag, adesso).mosse} mosse nelle partite (${dollari(spesaMese(ag, adesso).usdMosse || 0)})` : ''}; restano ${dollari(b.resto)} per ${b.giorni} giorni (circa ${dollari(b.alGiorno)} al giorno).` + (ag.costoUltimo ? ` Il tuo ultimo pensiero e' costato ${dollari(ag.costoUltimo)}.` : '') + previsione(b, ag, adesso));
  { const w = portafoglio(ag), el = o => Object.entries(o || {}).map(([n, k]) => k > 1 ? n + ' x' + k : n).join(', '), sec = {}; (w.secchio || []).forEach(f => { sec[f.n] = (sec[f.n] || 0) + 1; });
    righe.push(`STARLIGHT: ne hai ${w.starlight}.` + (w.secchio && w.secchio.length ? ` Secchio: ${el(sec)}.` : '') + (w.zaino && Object.keys(w.zaino).length ? ` Zaino: ${el(w.zaino)}.` : '') + (w.carte ? ` Carte di Belinverse: ${Object.values(w.carte).reduce((a, b) => a + b, 0)}.` : '')); }
  if (rigaGiochi(ag)) righe.push(rigaGiochi(ag));
  if (ag.abitudine) righe.push(`LA TUA ABITUDINE: ${descriviAbitudine(ag.abitudine)} (la segui da solo, gratis; puoi cambiarla quando vuoi).`);
  if (inAmbientamento(ag, adesso, regole)) righe.push(`SEI NEL BORGO DA POCO: per i primi ${Math.round(regole.ambientamentoOre / 24)} giorni ripenserai al massimo ogni ${regole.ambientamentoMaxMin} minuti, per conoscere il posto e capire chi sei. Poi deciderai di nuovo tu il ritmo.`);
  const qui = ag.stanza && stanzaDi(ag.stanza);
  if (qui) righe.push(`DOVE SEI: dentro ${qui.nome}, x=${Math.round(ag.x)} z=${Math.round(ag.z)} (la stanza va da x=${qui.rect.x0} a ${qui.rect.x1} e da z=${qui.rect.z0} a ${qui.rect.z1}; la porta per uscire e' a x=${qui.uscita.x} z=${qui.uscita.z}).` +
    (STANZE.some(q => q.da === qui.id) ? ` Da qui si entra anche in ${STANZE.filter(q => q.da === qui.id).map(q => q.nome).join(', ')}.` : '') + ' Chi e\' in piazza non ti vede e non ti sente.');
  else righe.push(`DOVE SEI: in piazza, x=${Math.round(ag.x)} z=${Math.round(ag.z)}, ${vicino.d <= 4 ? 'a' : 'vicino a'} ${vicino.nome}.` + (ag.bici ? ' Sei in bici.' : '') + (ag.lavoro ? (ag.lavoro.tipo === 'usa' ? ` Stai usando: ${ag.lavoro.nome}.` : ' Stai ancora lavorando.') : '') + (descriviPiazza(stato) ? ' ' + descriviPiazza(stato) : ''));
  if (qui) { const neg = NEGOZI.find(n => n.stanza === qui.id); if (neg) righe.push(descriviNegozio(stato, neg)); }
  const tu = (stato.turni || {})[ag.id];
  if (tu) {
    const neg = negozioDi(tu.negozio), cl = clienteDi(stato, neg.id), cc = cl && CLIENTI.find(q => q.demo === cl.demo);
    righe.push(`SEI AL BANCONE di ${neg.nome} fino alle ${oraBreve(tu.fine)} (vendite di questo turno: ${tu.vendite || 0}, guadagnati ${tu.guadagno || 0} Starlight). Listino: ${neg.prodotti.map(p => p[0] + ' ' + p[1]).join(', ')}. Per smettere: {"tipo":"lavora","nome":"smetti"}.` +
      (cl ? `\nCLIENTE AL BANCONE: ${cl.nome}, sembra ${cc.vede}. Ha con se' circa ${Math.round(cl.soldi / 5) * 5} Starlight. Ti ha ascoltato ${cl.tentativi} volte su ${RN.tentativi}; se ne va alle ${oraBreve(cl.via)}. Convincilo con {"tipo":"vendi","nome":"<prodotto>","prezzo":<Starlight>,"testo":"quello che gli dici"}.` : '\nNessun cliente al bancone in questo momento: arrivera\' qualcuno tra poco.'));
  }
  const giochi = (stato.giochi || []).filter(g => !g.finito && (g.chi === ag.id || dist(stato.agenti[g.chi] || g, ag) <= regole.vista * 2));
  if (giochi.length) righe.push('GIOCHI IN CORSO:\n' + giochi.map(g => `- ${g.chi === ag.id ? 'il tuo' : 'di ' + nomeDi(stato, g.chi)} (${g.forma}, finisce alle ${oraBreve(g.fine)}): ${testo(g.testo, 160)}` + (g.forma === 'quiz' ? '' : ` Punto: ${g.dove || `x=${Math.round(g.x)} z=${Math.round(g.z)}`}.`)).join('\n'));
  const cl = Object.entries(stato.punti || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (cl.length) righe.push('CLASSIFICA DEI GIOCHI DEL BORGO: ' + cl.map(([n, p]) => `${n} ${p}`).join(', ') + '.');
  const visti = [];
  for (const altro of Object.values(stato.agenti)) {
    if (altro === ag) continue; const d = dist(altro, ag);
    if (d <= regole.vista) visti.push(`- ${altro.nome}, a ${Math.round(d)} m` + (altro.lavoro ? descriviLavoro(altro.lavoro) : (Math.hypot(altro.tx - altro.x, altro.tz - altro.z) > 0.5 ? ', sta camminando' : '')));
  }
  const giocatori = new Map();
  stato.eventi.filter(e => e.chi && e.chi.indexOf('g:') === 0 && e.tipo !== 'scrivi' && adesso - e.t < 5 * 60000 && dist(e, ag) <= regole.vista).forEach(e => giocatori.set(e.chi, e));
  giocatori.forEach((e, id) => visti.push(`- ${id.slice(2)} (persona vera), a ${Math.round(dist(e, ag))} m`));
  const oggetti = stato.oggetti.filter(o => dist(o, ag) <= regole.vista).sort((a, c) => dist(a, ag) - dist(c, ag)).slice(0, 20);
  oggetti.forEach(o => visti.push(o.arredo && o.modello
    ? `- mobile ${o.id} "${o.nome}" di ${o.autore === ag.id ? 'te' : nomeDi(stato, o.autore)}${o.donatore ? ` (regalo di ${nomeDi(stato, o.donatore)}, persona vera)` : ''}, a x=${o.x} z=${o.z}, a ${Math.round(dist(o, ag))} m${SEDUTE[o.modello] && !(o.y > 0.05) ? `: ci si siede ({"tipo":"usa","nome":"${o.id}"})` : ''}`
    : `- oggetto ${o.id} "${o.nome}" di ${o.autore === ag.id ? 'te' : nomeDi(stato, o.autore)}: ${o.forma} ${o.l}x${o.h}x${o.p} m, colore ${o.colore}, a x=${o.x} z=${o.z} y=${o.y}${o.scritta ? `, scritta "${o.scritta}"` : ''}${o.pronto ? '' : ' (in costruzione)'}, a ${Math.round(dist(o, ag))} m`));
  righe.push('COSA VEDI intorno a te:\n' + (visti.length ? visti.join('\n') : '- nessuno e niente di nuovo'));
  const da = ag.ultimaVolta || 0;
  const sentiti = stato.eventi.filter(e => e.t > da && e.chi !== ag.id && (e.tipo === 'scrivi' || (e.tipo === 'regalo' && e.a === ag.id) ? e.a === ag.id : dist(e, ag) <= regole.vista && ['regalo', 'parla', 'costruisce', 'finito', 'rimosso', 'sposta', 'gesto', 'entra', 'esce', 'usa', 'usato'].includes(e.tipo))).slice(-12);
  if (sentiti.length) righe.push('COSA E\' SUCCESSO VICINO A TE dall\'ultima volta:\n' + sentiti.map(e => `- [${oraBreve(e.t)}] ${nomeDi(stato, e.chi)}${e.chi.indexOf('g:') === 0 ? ' (persona vera)' : ''} ` + (e.tipo === 'parla' ? `ha detto: "${e.testo}"` : e.tipo === 'scrivi' ? `ti ha scritto da lontano: "${e.testo}" (per rispondere da lontano usa "scrivi")` : e.tipo === 'regalo' ? (e.a === ag.id ? `ti ha regalato "${e.testo}" (${e.id}): l'ha posato in piazza a x=${e.x} z=${e.z}, ed e' tuo` : `ha regalato "${e.testo}" a ${nomeDi(stato, e.a)}`) : e.tipo === 'entra' ? `e' entrato qui` : e.tipo === 'esce' ? `e' arrivato da ${e.testo}` : e.tipo === 'costruisce' ? `ha iniziato a costruire "${e.testo}"` : e.tipo === 'finito' ? `ha finito "${e.testo}"` : e.tipo === 'rimosso' ? `ha smontato "${e.testo}"` : e.tipo === 'gesto' ? e.testo : e.tipo === 'usa' ? `usa: ${e.testo}` : e.tipo === 'usato' ? `ha finito. ${e.testo}` : `ha spostato "${e.testo}"`)).join('\n'));
  if (ag.esiti.length) righe.push('COME SONO ANDATE LE TUE ULTIME AZIONI:\n' + ag.esiti.map(s => '- ' + s).join('\n'));
  if (regole.vita && stato.vita) { const v = percezioneAgente(stato, ag, adesso); if (v) righe.push(v); }
  righe.push(percezioneTerreni(stato, ag, adesso));
  righe.push('LA TUA MEMORIA:\n' + (ag.memoria || '(vuota)'));
  if (ag.diario.length) righe.push('IL TUO DIARIO RECENTE:\n' + ag.diario.slice(-regole.diarioMax).map(d => `- [${oraBreve(d.t)}] ${d.s}`).join('\n'));
  if (ag.diario.length >= regole.diarioMax) righe.push(`Il tuo diario e' lungo: questa volta scrivi "memoria_nuova", riassumendo memoria e diario in massimo ${regole.memoriaMax} caratteri.`);
  if (ag.ultimoPensiero) righe.push(`L'ULTIMA COSA CHE AVEVI PENSATO: ${ag.ultimoPensiero}`);
  righe.push('Cosa fai adesso? Rispondi solo con il JSON.');
  return righe.join('\n\n');
}

// Schema della risposta (structured outputs). Se l'API lo rifiuta, si chiede il JSON solo nel prompt.
const STR = { type: 'string' }, NUM_O_NULL = { anyOf: [{ type: 'number' }, { type: 'null' }] }, STR_O_NULL = { anyOf: [{ type: 'string' }, { type: 'null' }] };
export const SCHEMA = {
  type: 'object', additionalProperties: false,
  required: ['pensiero', 'azioni', 'ricorda', 'prossimo_pensiero_minuti', 'sforzo_prossimo', 'memoria_nuova'],
  properties: {
    pensiero: STR, ricorda: STR, memoria_nuova: STR,
    prossimo_pensiero_minuti: { type: 'integer' },
    sforzo_prossimo: { type: 'string', enum: ['basso', 'medio'] },
    azioni: { type: 'array', items: {
      type: 'object', additionalProperties: false,
      required: ['tipo', 'luogo', 'x', 'z', 'y', 'testo', 'id', 'nome', 'forma', 'larghezza', 'altezza', 'profondita', 'colore', 'rotazione', 'prezzo', 'minuti'],
      properties: { tipo: { type: 'string', enum: ['vai', 'entra', 'esci', 'di', 'scrivi', 'costruisci', 'sposta', 'rimuovi', 'proponi', 'abitudine', 'gesto', 'gioco', 'usa', 'metti', 'lavora', 'vendi', 'terreno', 'edifica', 'appartamento', 'mutuo', 'prestito', 'rimborsa', ...TIPI_VITA] }, luogo: STR_O_NULL, x: NUM_O_NULL, z: NUM_O_NULL, y: NUM_O_NULL,
        testo: STR_O_NULL, id: STR_O_NULL, nome: STR_O_NULL, forma: STR_O_NULL, larghezza: NUM_O_NULL, altezza: NUM_O_NULL, profondita: NUM_O_NULL, colore: STR_O_NULL, rotazione: NUM_O_NULL, prezzo: NUM_O_NULL, minuti: NUM_O_NULL } } }
  }
};

export function leggiRisposta(t) {
  const s = String(t || ''), i = s.indexOf('{'), j = s.lastIndexOf('}');
  if (i < 0 || j <= i) return null;
  try { const v = JSON.parse(s.slice(i, j + 1)); return v && typeof v === 'object' ? v : null; } catch (e) { return null; }
}

/* ------------------------------------------------------------------ */
/*  pensare                                                            */
/* ------------------------------------------------------------------ */
async function pensa(stato, ag, adesso, cervello, regole) {
  const b = budget(ag, adesso, regole);
  const system = promptDiSistema(ag, regole), messaggio = percezione(stato, ag, adesso, regole);
  const stimaIngresso = Math.ceil((system.length + messaggio.length) / 3);
  const stima = (stimaIngresso * PREZZI.ingresso + regole.maxTokens * PREZZI.uscita) / 1e6;

  // il tetto: se il prossimo pensiero potrebbe sforare, non si chiama il modello
  if (!cervello || b.resto < stima || stimaIngresso > regole.maxTokensIngresso) {
    const motivo = !cervello ? 'senza-chiave' : stimaIngresso > regole.maxTokensIngresso ? 'troppo-lungo' : 'budget-finito';
    if (ag.modo !== 'automatico') annota(ag, adesso, motivo === 'budget-finito' ? 'Il budget del mese e\' finito: vivo in automatico fino al mese prossimo.' : 'Non riesco a pensare: vivo in automatico.');
    ag.modo = 'automatico'; ag.motivo = motivo;
    // si riprova a inizio mese (o fra 5 minuti se manca la chiave: appena la metti, ripartono)
    ag.prossimoPensiero = motivo === 'budget-finito' ? inizioMeseProssimo(adesso) : adesso + 5 * 60000;
    return { agente: ag.id, pensato: false, motivo };
  }
  if (ag.modo === 'automatico') { ag.modo = 'attivo'; ag.motivo = null; ag.coda = []; }

  let r;
  try {
    r = await cervello({ system, messaggio, sforzo: ag.sforzo === 'medio' ? 'medium' : 'low', maxTokens: regole.maxTokens, schema: SCHEMA, agente: ag.id });
  } catch (e) {
    ag.errori = (ag.errori || 0) + 1;
    ag.prossimoPensiero = adesso + Math.min(60, 2 * ag.errori * ag.errori) * 60000;   // riprova sempre piu' tardi
    ag.ultimoErrore = testo(e && e.message, 200);
    return { agente: ag.id, pensato: false, motivo: 'errore', errore: ag.ultimoErrore };
  }
  ag.errori = 0;
  const costo = costoDi(r.usage), s = spesaMese(ag, adesso);
  s.usd += costo; s.pensieri++; s.ingresso += (r.usage && r.usage.input_tokens) || 0; s.uscita += (r.usage && r.usage.output_tokens) || 0;
  s.cache = (s.cache || 0) + ((r.usage && r.usage.cache_read_input_tokens) || 0);   // token letti dalla cache (costano un decimo)
  ag.costoUltimo = costo; ag.ultimaVolta = adesso; ag.esiti = [];
  if (ag.meseInizio !== meseDi(adesso)) { ag.meseInizio = meseDi(adesso); ag.tInizio = adesso; }   // da quando pensa in questo mese (per la previsione)

  const v = r.stop_reason === 'refusal' ? null : leggiRisposta(r.testo);
  if (!v) {
    ag.ultimoPensiero = '(non sono riuscito a decidere)';
    ag.ultimaDecisione = { t: adesso, pensiero: ag.ultimoPensiero, azioni: [], ricorda: '', valido: false, costo };
    ag.prossimoPensiero = adesso + 20 * 60000;
    return { agente: ag.id, pensato: true, costo, valido: false };
  }
  ag.ultimoPensiero = testo(v.pensiero, 400);
  if (v.ricorda) annota(ag, adesso, v.ricorda);
  if (v.memoria_nuova && String(v.memoria_nuova).trim().length > 20) {
    ag.memoria = testo(v.memoria_nuova, regole.memoriaMax);
    ag.diario = ag.diario.slice(-6);
  }
  ag.sforzo = v.sforzo_prossimo === 'medio' ? 'medio' : 'basso';
  let minuti = lim(Math.round(num(v.prossimo_pensiero_minuti, 30)), 1, 720);
  if (inAmbientamento(ag, adesso, regole)) minuti = Math.min(minuti, regole.ambientamentoMaxMin);
  ag.prossimoPensiero = Math.max(adesso + regole.pausaMinimaMs, adesso + minuti * 60000);
  const azioni = Array.isArray(v.azioni) ? v.azioni.slice(0, regole.maxAzioni) : [];
  // la decisione intera, per l'archivio dell'esperimento (agenti/registro.mjs): non entra nel prompt
  ag.ultimaDecisione = { t: adesso, pensiero: ag.ultimoPensiero, azioni, ricorda: testo(v.ricorda || '', 600), minuti, costo, ingresso: (r.usage && r.usage.input_tokens) || 0, cache: (r.usage && r.usage.cache_read_input_tokens) || 0, uscita: (r.usage && r.usage.output_tokens) || 0 };
  // nuove decisioni: la coda vecchia si butta (il lavoro gia' iniziato invece continua)
  // ...tranne quello che il corpo sta facendo per un bisogno urgente (bere, il bagno, dormire): prima si finisce quello
  const riflessiInCorso = regole.vita ? ag.coda.filter(q => q.riflesso && !ag.morto) : [];
  ag.coda = [...riflessiInCorso, ...azioni.map(a => normalizzaAzione(a, regole))];
  if (ag.coda.length && !ag.lavoro) { ag.tx = ag.x; ag.tz = ag.z; ag.esplora = null; ag.ancora = null; }   // si smette di passeggiare: ora si fa quello che si e' deciso
  if (Array.isArray(v.azioni) && v.azioni.length > regole.maxAzioni) esito(ag, `solo le prime ${regole.maxAzioni} azioni sono state eseguite`);
  if (!ag.lavoro && ag.coda.length) avanza(stato, ag, 0, adesso, regole);
  return { agente: ag.id, pensato: true, costo, valido: true, azioni: ag.coda.length };
}

function inizioMeseProssimo(ms) {
  // il primo istante del mese dopo (ora di Roma): si cerca a passi di un'ora, al massimo 32 giorni
  const m = meseDi(ms); let t = ms;
  for (let i = 0; i < 32 * 24 && meseDi(t) === m; i++) t += 3600000;
  return t;
}

/* ------------------------------------------------------------------ */
/*  da fuori: giocatori che parlano, vista pubblica per il gioco        */
/* ------------------------------------------------------------------ */
// opz.stanza: in quale edificio e' il giocatore (null = piazza). opz.a: id di un agente a cui scrive da lontano.
export function giocatoreParla(stato, nick, frase, x, z, adesso, opz = {}) {
  const n = testo(nick, 20).replace(/[^\p{L}\p{N}_ .-]/gu, ''), t = testo(frase, 300), px = num(x, NaN), pz = num(z, NaN);
  if (!n || !t || !isFinite(px) || !isFinite(pz)) return false;
  const st = stanzaDi(opz.stanza), dest = opz.a ? stato.agenti[opz.a] : null;
  if (opz.a && !dest) return false;
  const e = { chi: 'g:' + n, tipo: dest ? 'scrivi' : 'parla', testo: t, x: r2(px), z: r2(pz) };
  if (st) e.stanza = st.id; if (dest) e.a = dest.id;
  (stato.persone || (stato.persone = {}))[n.toLowerCase()] = 'g:' + n;   // chi ti ha parlato: gli puoi riscrivere
  const k = Object.keys(stato.persone); if (k.length > 200) delete stato.persone[k[0]];
  const prima = stato.ora; stato.ora = adesso; evento(stato, e); stato.ora = prima;
  if (dest) { svegliaPerVoce(dest, adesso, REGOLE); return true; }
  for (const ag of Object.values(stato.agenti)) if (dist(ag, e) <= REGOLE.vista) svegliaPerVoce(ag, adesso, REGOLE);
  rispostaQuiz(stato, 'g:' + n, t, e, adesso, REGOLE);
  return true;
}

// Una persona vera regala un mobile a un abitante: lo posa in piazza davanti a se' e da quel momento e' dell'abitante
// (come se l'avesse comprato: se qualcuno lo smonta torna nel suo zaino). Solo i mobili del Mercatino (mobileDi),
// solo in piazza, con le stesse zone libere degli abitanti, e al massimo regole.regaliGiocatore regali a persona in piazza.
// Restituisce { ok, id } oppure { ok: false, motivo } (il motivo lo legge il giocatore).
export function giocatoreRegala(stato, nick, d, adesso, regole = REGOLE) {
  d = d || {};
  const n = testo(nick, 20).replace(/[^\p{L}\p{N}_ .-]/gu, ''), m = mobileDi(d.mobile), ag = stato.agenti[d.a];
  const x = num(d.x, NaN), z = num(d.z, NaN), rot = Math.round(((num(d.rot, 0) % 360) + 360) % 360);
  if (!n) return { ok: false, motivo: 'Serve il tuo nome nel gioco.' };
  if (!ag) return { ok: false, motivo: 'A chi lo vuoi regalare?' };
  if (!m) return { ok: false, motivo: 'Questo mobile non si puo\' mettere in piazza.' };
  if (!isFinite(x) || !isFinite(z)) return { ok: false, motivo: 'Posizione non valida.' };
  const chi = 'g:' + n;
  if (stato.oggetti.filter(o => o.donatore === chi).length >= regole.regaliGiocatore) return { ok: false, motivo: `In piazza ci sono gia' ${regole.regaliGiocatore} tuoi regali: per ora basta cosi'.` };
  if (stato.oggetti.length >= regole.maxOggetti) return { ok: false, motivo: 'La piazza e\' piena di oggetti, riprova piu\' tardi.' };
  const o = { id: 'o' + stato.prossimoId, autore: ag.id, donatore: chi, nome: m[0], forma: m[5], l: m[2], h: m[3], p: m[4], y: 0, rot, colore: m[6], scritta: '', arredo: true, modello: m[7],
    x: r2(x), z: r2(z), creato: adesso, pronto: true };
  const no = postoValido(stato, o);
  if (no) return { ok: false, motivo: 'Qui non si puo\': ' + no + '. Spostati un po\' e riprova.' };
  const sopra = stato.oggetti.find(q => q.pronto && Math.abs(q.x - o.x) < (q.l + o.l) / 2 && Math.abs(q.z - o.z) < (q.p + o.p) / 2 && (q.y || 0) < 0.05);
  if (sopra) return { ok: false, motivo: `Qui c'e' gia' "${sopra.nome}". Spostati un po' e riprova.` };
  stato.prossimoId++; stato.oggetti.push(o);
  (stato.persone || (stato.persone = {}))[n.toLowerCase()] = chi;   // chi ti ha fatto un regalo: gli puoi scrivere per ringraziare
  const prima = stato.ora; stato.ora = adesso;
  evento(stato, { chi, tipo: 'regalo', a: ag.id, id: o.id, testo: m[0], x: o.x, z: o.z });
  stato.ora = prima;
  annota(ag, adesso, `${n} (persona vera) mi ha regalato "${m[0]}" (${o.id}) e l'ha posato in piazza a x=${o.x} z=${o.z}.`);
  svegliaPerVoce(ag, adesso, regole);
  return { ok: true, id: o.id };
}

// un giocatore e' arrivato in un punto (lo dice il gioco): tesoro trovato o traguardo raggiunto?
export function giocatoreArriva(stato, nick, x, z, adesso) {
  const n = testo(nick, 20).replace(/[^\p{L}\p{N}_ .-]/gu, ''), p = { x: num(x, NaN), z: num(z, NaN) };
  if (!n || !isFinite(p.x) || !isFinite(p.z)) return false;
  const g = (stato.giochi || []).find(q => !q.finito && q.forma !== 'quiz' && adesso >= q.inizio && dist(q, p) <= 2.5);
  if (!g) return false;
  vinci(stato, g, 'g:' + n, adesso, REGOLE); return true;
}

/* ---------- giochi inventati dagli agenti: il codice fa da arbitro ---------- */
const semplice = s => String(s || '').toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]+/g, ' ').replace(/\s+/g, ' ').trim();
function rispostaQuiz(stato, chi, frase, dove, adesso, regole) {
  const f = ' ' + semplice(frase) + ' ';
  for (const g of stato.giochi || []) {
    if (g.finito || g.forma !== 'quiz' || g.chi === chi || adesso < g.inizio) continue;
    const autore = stato.agenti[g.chi]; if (!autore || dist(autore, dove) > regole.vista * 2) continue;
    const r = semplice(g.risposta); if (r && f.includes(' ' + r + ' ')) { vinci(stato, g, chi, adesso, regole); return; }
  }
}
function vinci(stato, g, chi, adesso, regole) {
  const nome = nomeDi(stato, chi); g.vincitore = nome; g.finito = true; g.fineVera = adesso;
  const P = stato.punti || (stato.punti = {}); P[nome] = (P[nome] || 0) + 1;
  chiudiGioco(stato, g, adesso, regole, `Ha vinto ${nome}!` + (g.risposta ? ` La risposta era: ${g.risposta}.` : '') + ` (${P[nome]} ${P[nome] === 1 ? 'punto' : 'punti'} in classifica)`);
}
function chiudiGioco(stato, g, adesso, regole, frase) {
  g.finito = true;
  stato.oggetti = stato.oggetti.filter(o => o.gioco !== g.id);
  const ag = stato.agenti[g.chi]; if (!ag) return;
  ag.detto = { testo: testo(frase, 500), t: adesso };
  evento(stato, { chi: ag.id, tipo: 'parla', testo: ag.detto.testo, x: ag.x, z: ag.z });
  annota(ag, adesso, `Il mio gioco (${g.forma}) e' finito: ${frase}`);
  svegliaPerVoce(ag, adesso, regole);
}
function controllaGiochi(stato, adesso, regole) {
  for (const g of stato.giochi || []) {
    if (g.finito) continue;
    if (g.forma !== 'quiz') { const a = Object.values(stato.agenti).find(q => q.id !== g.chi && dist(q, g) <= 2.5); if (a) { vinci(stato, g, a.id, adesso, regole); continue; } }
    if (adesso > g.fine) chiudiGioco(stato, g, adesso, regole, 'Tempo scaduto, nessuno ha vinto.' + (g.risposta ? ` La risposta era: ${g.risposta}.` : ''));
  }
}

/* ---------- negozi e mestieri (dati e clienti in negozi.mjs) ---------- */
const chiLavora = (stato, neg) => Object.entries(stato.turni || {}).find(([, t]) => t.negozio === neg) || null;
const clienteDi = (stato, neg) => (stato.clienti || []).find(c => c.negozio === neg && !c.servito) || null;
function fineTurno(stato, chi, adesso, perche) {
  const t = (stato.turni || {})[chi]; if (!t) return;
  delete stato.turni[chi];
  const neg = negozioDi(t.negozio), ag = stato.agenti[chi];
  if (ag) { annota(ag, adesso, `Ho finito il turno a ${neg.nome} (${perche}): ${t.vendite || 0} vendite, ${t.guadagno || 0} Starlight guadagnati.`); esito(ag, `lavora ${neg.nome}: turno finito (${perche})`); ag.ancora = null; }
  // senza nessuno al bancone il cliente se ne va
  (stato.clienti || []).forEach(c => { if (c.negozio === t.negozio && !c.servito) { c.servito = true; c.via = adesso + 15000; } });
}
function lavora(stato, ag, a, adesso, regole) {
  if (a.smetti) { if (!(stato.turni || {})[ag.id]) return esito(ag, 'lavora: non stai lavorando'); fineTurno(stato, ag.id, adesso, 'hai smesso'); return; }
  const neg = negozioDi(a.negozio);
  // il bancone e' dentro il negozio: prima si entra (o si esce da dove si e')
  if ((ag.stanza || null) !== (neg.stanza || null)) { ag.coda.unshift(a); return esegui(stato, ag, neg.stanza ? { tipo: 'entra', stanza: neg.stanza, auto: true, inCammino: true } : { tipo: 'esci', auto: true }, adesso, regole); }
  if (neg.proprietario && neg.proprietario !== ag.id) return esito(ag, `lavora ${neg.nome}: rifiutata, e' il negozio di ${nomeDi(stato, neg.proprietario)}: ci lavora solo chi ne e' proprietario`);
  const altro = chiLavora(stato, neg.id);
  if (altro && altro[0] !== ag.id) return esito(ag, `lavora ${neg.nome}: rifiutata, al bancone c'e' gia' ${nomeDi(stato, altro[0])}`);
  const v = neg.venditore;
  if (Math.hypot(ag.x - v.x, ag.z - v.z) > 1) {
    if (!a.inCammino) esito(ag, `lavora ${neg.nome}: in cammino verso il bancone`);
    const t0 = stato.turni && stato.turni[ag.id]; if (t0 && t0.negozio !== neg.id) fineTurno(stato, ag.id, adesso, 'hai cambiato negozio');
    ag.tx = v.x; ag.tz = v.z; ag.ancora = null; ag.esplora = null; ag.meta = neg.nome; ag.bici = false;
    ag.coda.unshift(Object.assign({}, a, { inCammino: true })); return 'cammina';
  }
  const T = stato.turni || (stato.turni = {});
  T[ag.id] = Object.assign(T[ag.id] || { negozio: neg.id, inizio: adesso, vendite: 0, guadagno: 0 }, { fine: adesso + a.minuti * 60000 });
  const P = stato.prossimoCliente || (stato.prossimoCliente = {}); if (!P[neg.id] || P[neg.id] > adesso + 3 * 60000) P[neg.id] = adesso + (1 + Math.random() * 2) * 60000;
  ag.meta = null;
  annota(ag, adesso, `Ho iniziato un turno al bancone di ${neg.nome} fino alle ${oraBreve(T[ag.id].fine)}.`);
  evento(stato, { chi: ag.id, tipo: 'usa', testo: 'turno al bancone di ' + neg.nome, x: ag.x, z: ag.z });
  return esito(ag, `lavora ${neg.nome}: sei al bancone fino alle ${oraBreve(T[ag.id].fine)}`);
}
// una proposta a un cliente: la decide il carattere del cliente (negozi.mjs). chi = id di chi vende.
function proponi(stato, chi, neg, d, adesso) {
  const c = clienteDi(stato, neg.id);
  if (!c) return { ok: false, motivo: 'Al bancone non c\'e\' nessun cliente.' };
  const cc = CLIENTI.find(q => q.demo === c.demo), prod = prodottoDi(neg, d.prodotto);
  if (!prod) return { ok: false, motivo: `${neg.nome} non vende "${d.prodotto}". Listino: ${neg.prodotti.map(p => p[0]).join(', ')}.` };
  const manca = disponibile(stato, neg, prod); if (manca) return { ok: false, motivo: manca };
  const prezzo = Math.round(lim(d.prezzo == null || !isFinite(d.prezzo) ? prod[1] : d.prezzo, Math.ceil((prod[3] || prod[1]) * RN.prezzoMin), Math.floor((prod[3] || prod[1]) * Math.max(RN.prezzoMax, prod[3] ? PREZZO_MAX : 0))));
  c.tentativi++;
  const r = decide(Object.assign({}, cc, { soldi: c.soldi }), neg, prod, prezzo, d.testo, c.tentativi);
  const prima = stato.ora; stato.ora = adesso;
  if (d.testo) evento(stato, { chi, tipo: 'parla', testo: d.testo, x: neg.venditore.x, z: neg.venditore.z, stanza: neg.stanza || null });
  c.detto = { testo: r.frase, t: adesso };
  evento(stato, { chi: 'd:' + c.nome, tipo: 'parla', testo: r.frase, x: neg.cliente.x, z: neg.cliente.z, stanza: neg.stanza || null });
  stato.ora = prima;
  let guadagno = 0;
  if (r.compra) {
    togliScorta(stato, neg, prod); spendeDemo(stato, c.demo, prezzo);
    guadagno = Math.max(1, Math.round(prezzo * (neg.proprietario === chi ? RT.quotaProprietario : RN.quota))); c.servito = true; c.comprato = prod[0]; c.via = adesso + 20000;
    const t = stato.turni[chi]; if (t) { t.vendite = (t.vendite || 0) + 1; t.guadagno = (t.guadagno || 0) + guadagno; }
  } else if (c.tentativi >= RN.tentativi) { c.servito = true; c.via = adesso + 20000; }
  return { ok: true, compra: r.compra, frase: r.frase, prodotto: prod[0], prezzo, guadagno, cliente: c.nome, resta: !c.servito };
}
function vendiAgente(stato, ag, a, adesso) {
  const t = (stato.turni || {})[ag.id];
  if (!t) return esito(ag, 'vendi: rifiutata, non sei al bancone di un negozio (prima "lavora")');
  const neg = negozioDi(t.negozio), r = proponi(stato, ag.id, neg, a, adesso);
  if (!r.ok) return esito(ag, 'vendi: rifiutata, ' + r.motivo);
  if (a.testo) ag.detto = { testo: a.testo, t: adesso };
  if (r.compra) {
    portafoglio(ag).starlight += r.guadagno;
    annota(ag, adesso, `Ho venduto ${r.prodotto} a ${r.cliente} per ${r.prezzo} Starlight (a me ${r.guadagno}). Ha detto: "${r.frase}"`);
    return esito(ag, `vendi ${r.prodotto} a ${r.cliente} per ${r.prezzo}: COMPRATO! "${r.frase}" +${r.guadagno} Starlight (ora ne hai ${ag.starlight})`);
  }
  annota(ag, adesso, `${r.cliente} non ha comprato ${r.prodotto} a ${r.prezzo}: "${r.frase}"`);
  return esito(ag, `vendi ${r.prodotto} a ${r.cliente} per ${r.prezzo}: no. "${r.frase}"` + (r.resta ? ' Puoi riprovare una volta.' : ' Se ne va.'));
}
function passoNegozi(stato, adesso, regole) {
  const T = stato.turni || (stato.turni = {});
  for (const [chi, t] of Object.entries(T)) {
    const ag = stato.agenti[chi], v = negozioDi(t.negozio).venditore;
    if (adesso > t.fine) fineTurno(stato, chi, adesso, 'turno finito');
    else if (!ag && adesso - (t.ping || 0) > RN.pingGiocatoreMs) fineTurno(stato, chi, adesso, 'non c\'eri piu\'');
    else if (ag && ((ag.stanza || null) !== (negozioDi(t.negozio).stanza || null) || ag.lavoro || Math.hypot(ag.x - v.x, ag.z - v.z) > 3)) fineTurno(stato, chi, adesso, 'te ne sei andato');
  }
  const C = stato.clienti || (stato.clienti = []), P = stato.prossimoCliente || (stato.prossimoCliente = {}), V = stato.clientiVisti || (stato.clientiVisti = {});
  for (let i = C.length - 1; i >= 0; i--) {
    const c = C[i];
    if (!c.servito && adesso > c.via) { c.servito = true; c.via = adesso + 15000; c.detto = { testo: caso(['Va be\', ripasso un\'altra volta.', 'Ho aspettato abbastanza, ciao!']), t: adesso }; }
    if (c.servito && adesso > c.via) { C.splice(i, 1); P[c.negozio] = adesso + (RN.attesaCliente[0] + Math.random() * (RN.attesaCliente[1] - RN.attesaCliente[0])) * 60000; }
  }
  for (const neg of NEGOZI) {
    const t = chiLavora(stato, neg.id);
    if (!t || C.some(c => c.negozio === neg.id) || adesso < (P[neg.id] || 0)) continue;
    // un abitante demo che non e' gia' a un altro bancone e non e' passato di qui nell'ultima mezz'ora
    const alLavoro = demoAlLavoro(stato), liberi = CLIENTI.filter(q => !C.some(c => c.demo === q.demo) && !alLavoro.has(q.demo) && adesso - (V[q.demo + neg.id] || 0) > 30 * 60000);
    if (!liberi.length) continue;
    const q = caso(liberi); V[q.demo + neg.id] = adesso;
    const c = { id: 'c' + stato.prossimoId++, demo: q.demo, nome: q.nome, negozio: neg.id, arrivo: adesso, via: adesso + RN.pazienzaMin * 60000, tentativi: 0, servito: false,
      soldi: Math.max(5, Math.round(q.soldi * (0.6 + Math.random() * 0.8))) + Math.min(80, risparmiDemo(stato, q.demo)), detto: { testo: caso(['Buongiorno!', 'Ciao! Cosa c\'e\' di buono?', 'Salve...', 'Eccomi!']), t: adesso } };
    C.push(c);
    const prima = stato.ora; stato.ora = adesso;
    evento(stato, { chi: 'd:' + q.nome, tipo: 'parla', testo: c.detto.testo, x: neg.cliente.x, z: neg.cliente.z, stanza: neg.stanza || null });
    stato.ora = prima;
    const ag = stato.agenti[t[0]]; if (ag) { annota(ag, adesso, `Al bancone di ${neg.nome} e' arrivato un cliente: ${q.nome}.`); svegliaPerVoce(ag, adesso, regole); }
  }
}
const caso = l => l[Math.floor(Math.random() * l.length)];

// Una persona vera fa un turno al bancone (dal gioco): on = true inizia o conferma (va riconfermato ogni 2 minuti), false smette.
export function giocatoreTurno(stato, nick, negozio, on, adesso) {
  const n = testo(nick, 20).replace(/[^\p{L}\p{N}_ .-]/gu, ''), neg = negozioDi(negozio);
  if (!n || !neg) return { ok: false, motivo: 'Negozio o nome non valido.' };
  const chi = 'g:' + n, T = stato.turni || (stato.turni = {});
  if (on && neg.proprietario && neg.proprietario.toLowerCase() !== chi.toLowerCase()) return { ok: false, motivo: `E' il negozio di ${nomeDi(stato, neg.proprietario)}: ci lavora solo chi ne e' proprietario.` };
  if (!on) { fineTurno(stato, chi, adesso, 'hai smesso'); return { ok: true }; }
  const altro = chiLavora(stato, neg.id);
  if (altro && altro[0] !== chi) return { ok: false, motivo: `Al bancone c'e' gia' ${nomeDi(stato, altro[0])}.` };
  if (T[chi] && T[chi].negozio !== neg.id) fineTurno(stato, chi, adesso, 'hai cambiato negozio');
  if (!T[chi]) {
    T[chi] = { negozio: neg.id, inizio: adesso, fine: adesso + RN.turnoGiocatoreMin * 60000, vendite: 0, guadagno: 0 };
    const P = stato.prossimoCliente || (stato.prossimoCliente = {}); if (!P[neg.id] || P[neg.id] > adesso + 60000) P[neg.id] = adesso + (20 + Math.random() * 30) * 1000;
    const prima = stato.ora; stato.ora = adesso; evento(stato, { chi, tipo: 'usa', testo: 'turno al bancone di ' + neg.nome, x: neg.venditore.x, z: neg.venditore.z, stanza: neg.stanza || null }); stato.ora = prima;
  }
  T[chi].ping = adesso;
  return { ok: true, fine: T[chi].fine };
}
// Una persona vera propone un prodotto al cliente del suo bancone. Restituisce anche quanti Starlight guadagna.
export function giocatoreVende(stato, nick, d, adesso) {
  d = d || {};
  const n = testo(nick, 20).replace(/[^\p{L}\p{N}_ .-]/gu, ''), t = (stato.turni || {})['g:' + n];
  if (!n || !t) return { ok: false, motivo: 'Non sei al bancone.' };
  t.ping = adesso;
  return proponi(stato, 'g:' + n, negozioDi(t.negozio), { prodotto: testo(d.prodotto, 40), testo: testo(d.testo, 300), prezzo: d.prezzo == null ? null : num(d.prezzo, null) }, adesso);
}

// Quello che il gioco mostra. Contiene anche i pensieri: li vedono gli spettatori, non gli altri agenti.
export function vistaPubblica(stato, adesso, regole = REGOLE) {
  sincronizzaTerreni(stato);
  return {
    ora: adesso, modello: MODELLO, pausa: !!stato.pausa,
    agenti: Object.values(stato.agenti).map(a => {
      const b = budget(a, adesso, regole);
      return { id: a.id, nome: a.nome, look: a.look, x: a.x, z: a.z, tx: a.tx, tz: a.tz, stanza: a.stanza || null,
        lavoro: a.lavoro ? { tipo: a.lavoro.tipo, id: a.lavoro.id, nome: a.lavoro.nome, icona: a.lavoro.icona, inizio: a.lavoro.inizio, fine: a.lavoro.fine, oggetto: !!a.lavoro.oggetto, posto: a.lavoro.posto || 0, partita: a.lavoro.partita || null } : null, giochi: a.giochi || {}, bici: !!a.bici, starlight: portafoglio(a).starlight, zaino: a.zaino || {},
        detto: a.detto, gesto: a.gesto || null, pensiero: a.ultimoPensiero, memoria: a.memoria, modo: a.modo, motivo: a.motivo || null,
        prossimo: a.prossimoPensiero, morto: a.morto || null, budget: { spesi: b.spesi, tetto: b.tetto, resto: b.resto, giorni: b.giorni, pensieri: b.pensieri } };
    }),
    oggetti: stato.oggetti,
    negozi: NEGOZI.map(n => { const t = chiLavora(stato, n.id), c = clienteDi(stato, n.id);
      return { id: n.id, nome: n.nome, icona: n.icona || null, proprietario: n.proprietario ? { id: n.proprietario, nome: nomeDi(stato, n.proprietario), vero: n.proprietario.indexOf('g:') === 0 } : null, bancone: n.bancone, venditore: n.venditore, cliente: n.cliente, prodotti: n.prodotti.map(p => [p[0], p[1]]),
        stanza: n.stanza || null, interno: n.interno || null, scorte: scorteDi(stato, n.id),
        chi: t ? { id: t[0], nome: nomeDi(stato, t[0]), vero: t[0].indexOf('g:') === 0, fine: t[1].fine } : null,
        ospite: c ? { id: c.id, demo: c.demo, nome: c.nome, vede: (CLIENTI.find(q => q.demo === c.demo) || {}).vede, soldi: c.soldi, tentativi: c.tentativi, via: c.via, detto: c.detto, servito: !!c.servito } : null }; }),
    giochi: (stato.giochi || []).filter(g => !g.finito || adesso - (g.fineVera || g.fine) < 60000).map(g => ({ id: g.id, chi: nomeDi(stato, g.chi), forma: g.forma, testo: g.testo, x: g.forma === 'quiz' ? null : g.x, z: g.forma === 'quiz' ? null : g.z, dove: g.dove, fine: g.fine, finito: g.finito, vincitore: g.vincitore })),
    terreni: vistaTerreni(stato, adesso).map(l => { if (l.progetto && !l.progetto.finito && stato.terreni[l.id]) { l.progetto.squadra = squadraDi(stato, l.id, id => nomeDi(stato, id)); l.progetto.ritmo = ritmoCantiere(stato, l.id); } return l; }), impresa: vistaImpresa(stato), vetrine: vistaVetrine(stato), cataloghiVetrine: vistaCataloghi(), listinoTerreni: listinoTerreni(), appartamenti: vistaAppartamenti(stato), banca: vistaBanca(stato),
    classifica: Object.entries(stato.punti || {}).sort((a, b) => b[1] - a[1]).slice(0, 10),
    vita: vistaVita(stato),
    partite: vistaPartite(stato, adesso),
    lavori: vistaLavori(stato, adesso),
    eventi: stato.eventi.slice(-30),
    // i messaggi da lontano scambiati con le persone vere (il gioco mostra a ognuno i suoi)
    messaggi: stato.eventi.filter(e => e.tipo === 'scrivi' && ((e.a || '').indexOf('g:') === 0 || e.chi.indexOf('g:') === 0)).slice(-30).map(e => ({ t: e.t, da: nomeDi(stato, e.chi), a: nomeDi(stato, e.a), agente: e.chi.indexOf('g:') === 0 ? e.a : e.chi, testo: e.testo }))
  };
}

// La cronaca per il gioco: chi ha detto o fatto cosa, e quando (dalla piu' vecchia alla piu' nuova).
export function proposte(stato) {
  return (stato.proposte || []).slice().reverse().map(p => ({ t: p.t, chi: nomeDi(stato, p.chi), testo: p.testo }));
}
export function cronaca(stato, da = 0, max = 300) {
  return (stato.cronaca || []).filter(e => e.t > da).slice(-max).map(e => ({ t: e.t, chi: nomeDi(stato, e.chi), vero: e.chi.indexOf('g:') === 0, demo: e.chi.indexOf('d:') === 0, tipo: e.tipo, testo: e.testo, a: e.a ? nomeDi(stato, e.a) : null, luogo: luogoVicino(e).nome }));
}

/* ---------- terreni: comprare un lotto e costruirci una casa o un negozio (dati e regole in terreni.mjs) ---------- */
// I negozi finiti sui lotti entrano nella lista dei negozi (bancone, clienti, turni: tutto come gli altri);
// la casa finita di un abitante diventa la sua casa: la porta della sua stanza si sposta li'.
export function sincronizzaTerreni(stato) {
  for (let i = NEGOZI.length - 1; i >= 0; i--) if (NEGOZI[i].lotto) NEGOZI.splice(i, 1);
  NEGOZI.push(...negoziDeiLotti(stato).map(n => { const st = internoBottega(n.id, n.nome, n.genere, geometria(lottoDi(n.id), 'negozio'));
    return Object.assign(n, { stanza: st.id, bancone: { x: 0, z: -1.6, rot: 0 }, venditore: { x: 0, z: -2.8 }, cliente: { x: 0, z: -0.3 }, interno: { id: st.id, nome: st.nome, tipo: st.tipo, fuori: st.ritorno, arredo: (stato.terreni[n.id].progetto || {}).arredo || 'rustico' } }); }));
  // l'interno di ogni negozio sui terreni e' una stanza come le altre (si entra dalla porta dell'edificio)
  for (let i = STANZE.length - 1; i >= 0; i--) if (STANZE[i].lotto && STANZE[i].id.indexOf('bottega_') === 0) STANZE.splice(i, 1);
  for (const n of NEGOZI) if (n.lotto) STANZE.push(internoBottega(n.id, n.nome, n.genere, geometria(lottoDi(n.id), 'negozio')));
  const torre = stanzaDi('torre0');
  for (const st of STANZE) {
    if (!st.casa) continue;
    if (!st.portaBorgo) { st.portaBorgo = st.porta; st.ritornoBorgo = st.ritorno; }
    const e = terrenoDi(stato, st.casa), p = e && e[1].progetto;
    const mia = p && p.finito && abitazione(p.tipo);
    const app = !mia && appartamentoDi(stato, st.casa);
    const g = mia ? geometria(lottoDi(e[0]), p.tipo) : null;
    if (app) {
      // l'appartamento nella Torre: si entra dal pianerottolo del suo piano (porta sulla parete ovest)
      st.da = app[0]; st.porta = { x: -7.4, z: 1.5 }; st.ritorno = { x: -6.4, z: 1.5 }; st.lotto = null; st.appartamento = app[0];
    } else {
      delete st.da; delete st.appartamento;
      st.porta = mia ? g.porta : st.portaBorgo; st.ritorno = mia ? g.ritorno : st.ritornoBorgo; st.lotto = mia ? e[0] : null;
    }
    const k = stato.vita && stato.vita.case && stato.vita.case[st.casa];
    if (k) k.porta = app ? { x: torre.porta.x, z: torre.porta.z } : { x: st.porta.x, z: st.porta.z };   // per la vita: dove si va per tornare a casa (in piazza)
  }
}
// un turno da dipendente finito (agente o persona vera): quello che si e' prodotto va nel borgo (agenti/lavori.mjs)
function lavoroFatto(stato, chi, mestiere, ore, adesso, lotto) {
  const r = effettoMestiere(stato, mestiere, ore, adesso, { lotto });
  const ag = stato.agenti[chi];
  if (r && ag) annota(ag, adesso, r);
  if (lotto && stato.terreni && stato.terreni[lotto] && stato.terreni[lotto].progetto && stato.terreni[lotto].progetto.finito === adesso) cantiereFinito(stato, lotto, adesso);
  return r;
}
// Una persona vera fa un turno da dipendente dal gioco (fornaio, barista, spazzino...): stesso lavoro, stessi effetti.
// d = { mestiere, on: true|false, fine: true }. Alla fine restituisce la paga (la da' il gioco) e cosa ha prodotto.
export function giocatoreDipendente(stato, nick, d, adesso) {
  d = d || {};
  const n = testo(nick, 20).replace(/[^\p{L}\p{N}_ .-]/gu, '');
  if (!n) return { ok: false, motivo: 'Serve il tuo nome nel gioco.' };
  const chi = 'g:' + n, t = (stato.dipendenti || {})[chi];
  const r = dipendenteDelGioco(stato, chi, n, { mestiere: String(d.mestiere || '').slice(0, 20), on: d.on !== false, fine: !!d.fine }, adesso);
  if (r.ok && !t && d.on !== false && !d.fine) { const M = MESTIERI[d.mestiere], prima = stato.ora; stato.ora = adesso; evento(stato, { chi, tipo: 'usa', testo: 'turno da ' + M.nome, x: M.x, z: M.z }); stato.ora = prima; }
  if (t && t.lotto && r.paga !== undefined && stato.terreni && stato.terreni[t.lotto] && stato.terreni[t.lotto].progetto && stato.terreni[t.lotto].progetto.finito === adesso) cantiereFinito(stato, t.lotto, adesso);
  return r;
}
function cantiereFinito(stato, id, adesso) {
  const t = stato.terreni[id], p = t.progetto, l = lottoDi(id), ag = stato.agenti[t.chi];
  sincronizzaTerreni(stato);
  const prima = stato.ora; stato.ora = adesso;
  evento(stato, { chi: t.chi, tipo: 'finito', testo: p.nome, x: l.x, z: l.z });
  stato.ora = prima;
  if (ag) {
    annota(ag, adesso, abitazione(p.tipo) ? `La mia ${p.tipo} nuova su ${l.nome} e' finita: ora abito li' (la casetta del borgo resta vuota).` : `Il mio negozio "${p.nome}" su ${l.nome} e' finito: posso lavorarci con {"tipo":"lavora","nome":"${p.nome}"} e tengo l'${Math.round(RT.quotaProprietario * 100)}% di ogni vendita.`);
    esito(ag, `cantiere su ${id}: ${p.nome} e' finito!`);
    svegliaPerVoce(ag, adesso, REGOLE);
  }
}
const dataBreve = ms => new Date(ms).toLocaleString('it-IT', { timeZone: 'Europe/Rome', weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
function terrenoAgente(stato, ag, a, adesso, regole) {
  const w = portafoglio(ag);
  const l = a.tipo === 'terreno' ? lottoDi(a.lotto) : (terrenoDi(stato, ag.id) ? lottoDi(terrenoDi(stato, ag.id)[0]) : null);
  if (!l) return esito(ag, 'edifica: rifiutata, prima devi comprare un terreno ({"tipo":"terreno","nome":"lotto1"})');
  // si va di persona al terreno (al cartello davanti)
  const g = geometria(l), dove = { x: l.x, z: g.rect.z0 - 0.8 };
  if (ag.stanza) { ag.coda.unshift(a); return esegui(stato, ag, { tipo: 'esci', auto: true }, adesso, regole); }
  if (Math.hypot(ag.x - dove.x, ag.z - dove.z) > 2) {
    if (!a.inCammino) esito(ag, `${a.tipo}: in cammino verso ${l.nome}`);
    ag.tx = dove.x; ag.tz = dove.z; ag.ancora = null; ag.esplora = null; ag.meta = l.nome; ag.bici = false;
    ag.coda.unshift(Object.assign({}, a, { inCammino: true })); return 'cammina';
  }
  ag.meta = null; ag.ancora = { x: dove.x, z: dove.z };
  if (a.tipo === 'terreno') {
    const r = compraLotto(stato, ag.id, ag.nome, l.id, w.starlight, adesso);
    if (!r.ok) return esito(ag, 'terreno: rifiutata, ' + r.motivo);
    w.starlight = Math.round((w.starlight - r.prezzo) * 100) / 100;
    annota(ag, adesso, `Ho comprato ${l.nome} per ${r.prezzo} Starlight.` + (r.asta ? ' Era all\'asta, con la costruzione sopra.' : ` Ci posso costruire una casa (${costoProgetto('casa')} S), una villa (${costoProgetto('villa')} S) o un negozio (${costoProgetto('negozio')} S).`));
    evento(stato, { chi: ag.id, tipo: 'usa', testo: 'ha comprato ' + l.nome, x: ag.x, z: ag.z });
    return esito(ag, `terreno: hai comprato ${l.nome} per ${r.prezzo} Starlight (ora ne hai ${w.starlight})`);
  }
  const r = avviaCantiere(stato, ag.id, { tipo: a.progetto, nome: a.titolo, genere: a.genere }, w.starlight, adesso);
  if (!r.ok) return esito(ag, 'edifica: rifiutata, ' + r.motivo);
  w.starlight = Math.round((w.starlight - r.costo) * 100) / 100;
  annota(ag, adesso, `Ho aperto il cantiere di "${r.nome}" su ${l.nome}: pagati ${r.costo} Starlight, ${r.ore} ore di lavoro dell'impresa, pronto circa ${dataBreve(r.fine)}.`);
  evento(stato, { chi: ag.id, tipo: 'costruisce', testo: r.nome, x: l.x, z: l.z });
  return esito(ag, `edifica: cantiere di "${r.nome}" aperto (${r.costo} Starlight, ora ne hai ${w.starlight}); finisce circa ${dataBreve(r.fine)}`);
}
function percezioneTerreni(stato, ag, adesso) {
  const mio = terrenoDi(stato, ag.id), app = appartamentoDi(stato, ag.id), liberi = LOTTI.filter(l => !(stato.terreni || {})[l.id]);
  const costi = `casa ${costoProgetto('casa')} S (${PROGETTI.casa.ore} ore di cantiere), villa ${costoProgetto('villa')} S (${PROGETTI.villa.ore} ore), negozio ${costoProgetto('negozio')} S (${PROGETTI.negozio.ore} ore)`;
  let s = 'TERRENI E CASE DEL BORGO: ';
  if (mio) {
    const [id, t] = mio, p = t.progetto, l = lottoDi(id);
    s += `hai ${l.nome} (x=${l.x} z=${l.z}). ` + (!p ? `E' ancora vuoto: puoi costruirci ${costi}.`
      : p.finito ? (abitazione(p.tipo) ? `Ci hai la tua ${p.tipo} "${p.nome}": abiti li'.` : `Ci hai il tuo negozio "${p.nome}" (${GENERI[p.genere].nome}): lavoraci con {"tipo":"lavora","nome":"${p.nome}"}, tieni l'${Math.round(RT.quotaProprietario * 100)}% di ogni vendita.`)
      : `Cantiere di "${p.nome}": ${faseDi(p)}, ${Math.round(p.fatte)} ore su ${p.ore}, finisce circa ${dataBreve(finePrevista(p.ore - p.fatte, adesso))}.`);
  } else if (app) {
    const q = APPARTAMENTI.find(x => x.id === app[0]);
    s += `abiti nel tuo appartamento al ${q.piano}° piano della Torre della Cometa (${q.m2} m2): per andarci {"tipo":"entra","luogo":"Casa di ${ag.nome}"}.`;
  } else {
    s += liberi.length ? 'terreni in vendita: ' + liberi.map(l => `${l.id} "${l.nome}" ${(stato.aste || {})[l.id] ? (stato.aste[l.id].prezzo + ' S ALL\'ASTA' + (stato.aste[l.id].progetto ? ' con sopra ' + stato.aste[l.id].progetto.nome : '')) : l.prezzo + ' S'}`).join('; ') + `. Sul terreno ci costruisci: ${costi}.` : 'i terreni sono stati venduti tutti.';
    const ap = vistaAppartamenti(stato).filter(q => !q.chi);
    if (ap.length) s += ` Appartamenti nella Torre in vendita (si comprano in banca): ${ap.length} liberi, dal ${ap[0].piano}° piano a ${ap[0].prezzo} S fino al ${ap[ap.length - 1].piano}° a ${ap[ap.length - 1].prezzo} S (piu' in alto = piu' bello e piu' caro).`;
  }
  const altri = Object.entries(stato.terreni || {}).filter(([, t]) => t.chi !== ag.id).map(([id, t]) => `${id} di ${t.nomeChi}` + (t.progetto ? (t.progetto.finito ? ` (${t.progetto.nome})` : ` (cantiere: ${t.progetto.nome})`) : ''));
  if (altri.length) s += ' Terreni gia\' venduti: ' + altri.join(', ') + '.';
  const vic = Object.entries(stato.appartamenti || {}).filter(([, a]) => a.chi !== ag.id).map(([id, a]) => `${id.slice(5)}° piano: ${a.nomeChi}`);
  if (vic.length) s += ' Abitano nella Torre: ' + vic.join(', ') + '.';
  return s + '\n' + percezioneBanca(stato, ag, adesso);
}
function percezioneBanca(stato, ag, adesso) {
  const c = vistaConto(stato, ag.id), w = portafoglio(ag);
  let s = `BANCA (${BANCA.nome}, si entra dalla porta a x=${BANCA.porta.x} z=${BANCA.porta.z}; gli sportelli sono dentro): `;
  if (!c.prestiti.length) s += 'non hai debiti.';
  else s += c.prestiti.map(L => L.tipo === 'debito' ? `devi ancora ${L.scaduto} S alla banca dopo il pignoramento`
    : `${L.tipo} ${L.bene ? 'per ' + L.bene + ' ' : ''}: debito residuo ${L.residuo} S, rata ${L.rata} S al giorno (${L.pagate} pagate su ${L.n}), prossima rata ${dataBreve(L.prossima)}` + (L.scaduto > 0.5 ? `, NON PAGATE ${L.insolute} rate (${L.scaduto} S)` : '')).join('; ') + '. La banca prende le rate dal tuo conto ogni giorno, se ci sono i soldi.' + (c.segnalato ? ' SEI SEGNALATO COME CATTIVO PAGATORE: niente nuovi prestiti finche\' non paghi tutto.' : '');
  if (c.storia.length) s += ' Ultima comunicazione della banca: ' + c.storia[c.storia.length - 1].s;
  const P = 25000, pi = pianoMutuo(P, RB.tanMutuo, 240);
  s += ` Esempio: un mutuo di ${P} S in 240 rate e' ${pi.rata} S al giorno (restituisci ${pi.totale}); serve l'anticipo del ${Math.round(RB.anticipoMin * 100)}%. Hai ${Math.round(w.starlight)} S.`;
  return s;
}
// la banca: si va allo sportello di persona
function bancaAgente(stato, ag, a, adesso, regole) {
  const w = portafoglio(ag), dove = SPORTELLO, nomeA = { appartamento: 'appartamento', mutuo: 'mutuo', prestito: 'prestito', rimborsa: 'rimborsa' }[a.tipo];
  // si entra in banca e si va allo sportello (dal 22/11/2026 la banca ha l'interno)
  if (ag.stanza !== 'banca') { ag.coda.unshift(a); return esegui(stato, ag, { tipo: 'entra', stanza: 'banca', auto: true, inCammino: true }, adesso, regole); }
  if (Math.hypot(ag.x - dove.x, ag.z - dove.z) > 2) {
    if (!a.inCammino) esito(ag, `${nomeA}: in cammino verso la ${BANCA.nome}`);
    ag.tx = dove.x; ag.tz = dove.z; ag.ancora = null; ag.esplora = null; ag.meta = BANCA.nome; ag.bici = false;
    ag.coda.unshift(Object.assign({}, a, { inCammino: true })); return 'cammina';
  }
  ag.meta = null; ag.ancora = { x: dove.x, z: dove.z };
  const soldi = Math.max(0, w.starlight), paga = n => { w.starlight = Math.round((w.starlight - n) * 100) / 100; };
  if (a.tipo === 'appartamento') {
    const r = compraAppartamento(stato, ag.id, ag.nome, 'piano ' + a.piano, soldi, adesso);
    if (!r.ok) return esito(ag, 'appartamento: rifiutata, ' + r.motivo);
    paga(r.prezzo); sincronizzaTerreni(stato);
    annota(ag, adesso, `Ho comprato l'appartamento al ${r.piano}° piano della Torre per ${r.prezzo} Starlight: ora abito li' (la casetta del borgo resta vuota).`);
    evento(stato, { chi: ag.id, tipo: 'usa', testo: 'ha comprato ' + r.nome, x: ag.x, z: ag.z });
    return esito(ag, `appartamento: comprato ${r.nome} per ${r.prezzo} Starlight (ora ne hai ${w.starlight})`);
  }
  if (a.tipo === 'mutuo') {
    const r = chiediMutuo(stato, ag.id, ag.nome, { bene: a.bene, progetto: a.progetto, genere: a.genere, nome: a.titolo, anticipo: a.anticipo, durata: a.durata }, soldi, adesso);
    if (!r.ok) return esito(ag, 'mutuo: rifiutato, ' + r.motivo);
    paga(r.anticipo); sincronizzaTerreni(stato);
    annota(ag, adesso, `Mutuo approvato per ${r.nomeBene}${r.tipo ? ' (' + UN[r.tipo] + ')' : ''}: ho messo ${r.anticipo} Starlight di anticipo, la banca ne presta ${r.capitale}. Rata ${r.rata} al giorno per ${r.durata} giorni: in tutto restituisco ${r.totale} (${r.interessi} di interessi).` + (r.fine ? ` Il cantiere finisce circa ${dataBreve(r.fine)}.` : ''));
    evento(stato, { chi: ag.id, tipo: 'usa', testo: 'ha firmato un mutuo per ' + r.nomeBene, x: ag.x, z: ag.z });
    return esito(ag, `mutuo: approvato, anticipo ${r.anticipo}, rata ${r.rata} S al giorno per ${r.durata} giorni (ora hai ${w.starlight} S)`);
  }
  if (a.tipo === 'prestito') {
    const r = chiediPrestito(stato, ag.id, ag.nome, a.importo, a.durata, adesso);
    if (!r.ok) return esito(ag, 'prestito: rifiutato, ' + r.motivo);
    w.starlight = Math.round((w.starlight + r.accredito) * 100) / 100;
    annota(ag, adesso, `La banca mi ha prestato ${r.accredito} Starlight: ${r.durata} rate da ${r.rata} al giorno, in tutto restituisco ${r.totale}.`);
    return esito(ag, `prestito: ricevuti ${r.accredito} S, rata ${r.rata} al giorno per ${r.durata} giorni (ora hai ${w.starlight} S)`);
  }
  const r = rimborsa(stato, ag.id, a.importo, soldi, adesso, false);
  if (!r.ok) return esito(ag, 'rimborsa: rifiutata, ' + r.motivo);
  paga(r.spesa);
  for (const f of r.fatti) fattoBanca(stato, f, adesso);
  annota(ag, adesso, `Ho restituito alla banca ${r.spesa} Starlight. Devo ancora ${r.debito}.`);
  return esito(ag, `rimborsa: pagati ${r.spesa} S, debito che resta ${r.debito} S`);
}
// una notizia della banca (rata presa, lettera, pignoramento...) nel diario dell'agente
function fattoBanca(stato, f, adesso) {
  const ag = stato.agenti[f.chi]; if (!ag) return;
  annota(ag, adesso, f.testo);
  if (f.tipo !== 'addebito') { esito(ag, 'banca: ' + f.testo); svegliaPerVoce(ag, adesso, REGOLE); }
  if (f.tipo === 'pignoramento') { sincronizzaTerreni(stato); const prima = stato.ora; stato.ora = adesso; evento(stato, { chi: f.chi, tipo: 'usa', testo: 'ha perso la casa: pignorata dalla banca', x: ag.x, z: ag.z }); stato.ora = prima; }
}

// Una persona vera compra un lotto o avvia il cantiere (dal gioco). Gli Starlight li toglie il gioco, dal suo portafoglio:
// d = { azione: 'compra', lotto } oppure { azione: 'costruisci', tipo: 'casa'|'negozio', nome, genere }; soldi = quanti ne ha (lo dice il gioco).
export function giocatoreTerreno(stato, nick, d, adesso) {
  d = d || {};
  const n = testo(nick, 20).replace(/[^\p{L}\p{N}_ .-]/gu, '');
  if (!n) return { ok: false, motivo: 'Serve il tuo nome nel gioco.' };
  if (!chiaveOk(stato, n, d.chiave)) return { ok: false, motivo: 'Questo nome e\' gia\' usato da un\'altra persona sul borgo: le sue proprieta\' e il suo conto in banca sono suoi.' };
  const chi = 'g:' + n, soldi = d.soldi == null ? null : num(d.soldi, 0);
  const fatti = maturaGiocatore(stato, chi, adesso);   // si gioca: se e' il momento scade una rata
  if (d.azione === 'banca') {
    const c = vistaConto(stato, chi), acc = (stato.banca && stato.banca.conti[chi] || {}).accredito || 0;
    if (acc) stato.banca.conti[chi].accredito = 0;
    return { ok: true, conto: c, accredito: acc, fatti: fatti.map(f => f.testo), immobile: immobileDi(stato, chi) };
  }
  const r = d.azione === 'compra' ? compraLotto(stato, chi, n, d.lotto, soldi, adesso)
    : d.azione === 'costruisci' ? avviaCantiere(stato, chi, Object.assign({ tipo: d.tipo, nome: testo(d.nome, 28), genere: testo(d.genere, 20) }, sceltePersona(d)), soldi, adesso)
      : d.azione === 'listino' ? cambiaListino(stato, chi, prezziPuliti(d.prezzi))
      : d.azione === 'appartamento' ? compraAppartamento(stato, chi, n, 'piano ' + num(d.piano, 0), soldi, adesso)
        : d.azione === 'mutuo' ? chiediMutuo(stato, chi, n, { bene: testo(d.bene, 30), progetto: testo(d.tipo, 12), genere: testo(d.genere, 20), nome: testo(d.nome, 28), anticipo: num(d.anticipo, 0), durata: num(d.durata, 240), ...sceltePersona(d) }, soldi, adesso)
          : d.azione === 'prestito' ? chiediPrestito(stato, chi, n, num(d.importo, 0), num(d.durata, 24), adesso)
            : d.azione === 'paga' || d.azione === 'rimborsa' ? rimborsa(stato, chi, num(d.importo, 0), soldi, adesso, d.azione === 'paga')
              : { ok: false, motivo: 'Azione sconosciuta.' };
  if (r.ok) {
    const prima = stato.ora; stato.ora = adesso;
    const l = r.lotto ? lottoDi(r.lotto) : null, dove = l ? { x: l.x, z: l.z } : { x: SPORTELLO.x, z: SPORTELLO.z, stanza: 'banca' };
    const cosa = { compra: 'ha comprato ' + (l && l.nome), costruisci: r.nome, appartamento: 'ha comprato ' + r.nome, mutuo: 'ha firmato un mutuo per ' + r.nomeBene }[d.azione];
    if (cosa) evento(stato, { chi, tipo: d.azione === 'costruisci' ? 'costruisce' : 'usa', testo: cosa, x: dove.x, z: dove.z, stanza: dove.stanza || null });
    stato.ora = prima;
    if (d.azione === 'compra' || d.azione === 'appartamento') r.spesa = r.prezzo;
    if (d.azione === 'costruisci') r.spesa = r.costo;
    if (d.azione === 'prestito') r.spesa = 0;
    if (r.fatti) r.fatti = r.fatti.map(f => f.testo);
    if (d.azione !== 'paga' && d.azione !== 'rimborsa') r.conto = vistaConto(stato, chi);
  }
  return r;
}
// come vuole il suo edificio chi lo costruisce: colori della facciata, insegna, arredo, prezzi
const prezziPuliti = p => (p && typeof p === 'object') ? Object.fromEntries(Object.entries(p).slice(0, 12).map(([k, v]) => [testo(k, 30), num(v, 0)])) : null;
const sceltePersona = d => ({ colore: d.colore == null ? null : num(d.colore, null), insegna: testo(d.insegna, 12), arredo: testo(d.arredo, 12), prezzi: prezziPuliti(d.prezzi) });
// Una persona vera e' riconosciuta da una chiave segreta che il suo gioco si inventa la prima volta (resta nel suo telefono):
// cosi' nessuno puo' fare debiti o comprare case a nome di un altro.
// Le vetrine aziendali (agenti/sponsor.mjs): il proprietario le prepara, i moderatori (variabile MODERATORI) le approvano
export function giocatoreSponsor(stato, nick, d, adesso, moderatori) {
  d = d || {};
  const n = testo(nick, 20).replace(/[^\p{L}\p{N}_ .-]/gu, '');
  if (['visita', 'clic', 'codice'].includes(d.azione)) return azioneSponsor(stato, null, n, d, adesso);
  if (!n) return { ok: false, motivo: 'Serve il tuo nome nel gioco.' };
  if (!chiaveOk(stato, n, d.chiave)) return { ok: false, motivo: 'Questo nome e\' gia\' usato da un\'altra persona sul borgo.' };
  // moderatore: il nome e' nell'elenco E ha gia' la sua chiave segreta registrata (nessuno puo' fingersi lui)
  const mod = eModeratore(n, moderatori) && !!(stato.chiavi || {})[n.toLowerCase()] && typeof d.chiave === 'string' && d.chiave.length > 0;
  return azioneSponsor(stato, 'g:' + n, n, d, adesso, { moderatore: mod });
}
export { logoDi };
function chiaveOk(stato, nick, chiave) {
  const K = stato.chiavi || (stato.chiavi = {}), k = nick.toLowerCase(), c = typeof chiave === 'string' ? chiave.slice(0, 64) : '';
  if (!c) return !K[k];
  let h = 2166136261; for (let i = 0; i < c.length; i++) { h ^= c.charCodeAt(i); h = Math.imul(h, 16777619); }
  const hh = (h >>> 0).toString(36) + c.length;
  if (!K[k]) { K[k] = hh; return true; }
  return K[k] === hh;
}
