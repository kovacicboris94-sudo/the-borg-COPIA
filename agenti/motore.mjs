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

import { cosaDi, manuale } from './borgo-cose.mjs';
export const MODELLO = 'claude-haiku-5-5';

// Prezzi di Claude Haiku 5.5 in dollari per milione di token (prompt fino a 100.000 token).
// Fonte: tabella prezzi Anthropic del 3 novembre 2026. Ricontrollali se Anthropic li cambia.
export const PREZZI = { ingresso: 0.10, uscita: 0.50, scritturaCache: 0.125, letturaCache: 0.01 };

export const REGOLE = {
  // Tetto mensile per agente. Anthropic fattura in dollari: 5 $ costano meno di 5 euro
  // finche' 1 euro vale almeno 1 dollaro, quindi il tetto di 5 euro e' sempre rispettato.
  tettoUsd: 5,
  maxTokens: 1600,            // tetto della singola risposta (pensiero + azioni)
  maxTokensIngresso: 20000,   // mai mandare prompt enormi (sopra 100.000 il prezzo sale)
  pausaMinimaMs: 60 * 1000,   // un agente non pensa mai piu' di una volta al minuto
  risveglioDaVoceMs: 3 * 60 * 1000, // se qualcuno gli parla si sveglia prima, al massimo ogni 3 minuti
  vista: 20,                  // metri: cosa vede e cosa sente
  portata: 8,                 // metri: cosa puo' toccare, spostare, costruire
  velocita: 1.3,              // metri al secondo, a piedi
  velocitaBici: 3.9,          // in bici (solo in piazza)
  minutiPerMetroCubo: 3,      // tempo di costruzione
  maxOggetti: 150, maxOggettiAgente: 60,
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
  giocoMin: 10                // quanto dura un gioco inventato da un agente (quiz, tesoro, gara)
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
  { nome: 'Arredamenti', x: -47, z: 4 }
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
    arrivo: { x: -50.5, z: 30.2 }, uscita: { x: -51.1, z: 30.2 }, ritorno: { x: 5.4, z: -4.5 }, asc: { x: -51.1, z: 30.2 }, ascArrivo: { x: -50.5, z: 30.2 } }
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
  { x: 48, z: 50, r: 4 }, { x: -48, z: 4, r: 4 }
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
export function normalizzaAzione(a) {
  if (!a || typeof a !== 'object') return { errore: 'azione non valida' };
  const tipo = String(a.tipo || '').toLowerCase().trim();
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
  if (tipo === 'usa') { const c = cosaDi(a.nome || a.luogo || a.testo); return c ? { tipo, cosa: c.id } : { errore: 'usa: cosa sconosciuta (vedi MANUALE DEL BORGO)' }; }
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

  // 1) il tempo scorre: si cammina, si costruisce, si eseguono le azioni in coda
  for (const ag of agenti) avanza(stato, ag, dt, adesso, regole);
  controllaGiochi(stato, adesso, regole);

  // 2) chi deve pensare pensa (uno alla volta, cosi' le azioni sono sfalsate)
  const pronti = agenti.filter(a => a.prossimoPensiero <= adesso).sort((a, b) => a.prossimoPensiero - b.prossimoPensiero);
  const fatti = [];
  for (const ag of pronti.slice(0, opz.maxPensieri || 2)) {
    fatti.push(await pensa(stato, ag, adesso, cervello, regole));
  }
  return fatti;
}

function avanza(stato, ag, dt, adesso, regole) {
  // lavoro in corso (costruire, smontare)
  if (ag.lavoro) {
    if (adesso < ag.lavoro.fine) return;
    const L = ag.lavoro; ag.lavoro = null;
    ag.prossimaEsplorazione = Math.max(ag.prossimaEsplorazione || 0, adesso + 15 * 60000);   // si resta un po' vicino a quello che si e' fatto
    const o = stato.oggetti.find(q => q.id === L.id);
    if (L.tipo === 'costruisci' && o) { o.pronto = true; esito(ag, `costruisci "${o.nome}" (${o.id}): finito`); annota(ag, adesso, `Ho finito di costruire "${o.nome}" (${o.id}).`); evento(stato, { chi: ag.id, tipo: 'finito', testo: o.nome, x: o.x, z: o.z }); }
    if (L.tipo === 'usa') fineUso(stato, ag, L, adesso);
    if (L.tipo === 'rimuovi') { const i = stato.oggetti.findIndex(q => q.id === L.id); if (i >= 0) { const q = stato.oggetti[i]; stato.oggetti.splice(i, 1); esito(ag, `rimuovi ${q.id} "${q.nome}": fatto`); annota(ag, adesso, `Ho smontato "${q.nome}" di ${nomeDi(stato, q.autore)}.`); evento(stato, { chi: ag.id, tipo: 'rimosso', testo: q.nome, x: q.x, z: q.z }); } }
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
    if (!ag.coda.length || ag.lavoro) break;
    let cammina = false;
    while (ag.coda.length && !ag.lavoro) {
      const a = ag.coda.shift();
      if (esegui(stato, ag, a, adesso, regole) === 'cammina') { cammina = true; break; }
    }
    if (!cammina || resto <= 0) return;
  }
  if (ag.coda.length) return;
  if (!ag.coda.length && !ag.lavoro) { if (ag.modo === 'automatico') routine(ag, adesso); else passeggia(ag, adesso); }
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

const nomeDi = (stato, id) => (stato.agenti[id] ? stato.agenti[id].nome : id && id.indexOf('g:') === 0 ? id.slice(2) : 'qualcuno');

function esegui(stato, ag, a, adesso, regole) {
  if (a.errore) { esito(ag, 'rifiutata: ' + a.errore); return; }
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
    esito(ag, `vai ${a.dove || `x=${a.x} z=${a.z}`}: in cammino`);
    return 'cammina';
  }
  if (a.tipo === 'entra') {
    const st = stanzaDi(a.stanza);
    if (ag.stanza === st.id) return esito(ag, `entra: sei gia' dentro ${st.nome}`);
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
    ag.dentroFino = adesso + (a.auto ? 4 : 60) * 60000;      // se ci entri tu, ci resti finche' vuoi (almeno un'ora); in esplorazione 4 minuti
    if (!a.auto) ag.abitudineDopo = adesso + 60 * 60000;
    (ag.vistiDentro || (ag.vistiDentro = [])).includes(st.id) || ag.vistiDentro.push(st.id);
    annota(ag, adesso, `Sono entrato in ${st.nome}.`);
    evento(stato, { chi: ag.id, tipo: 'entra', testo: st.nome, x: ag.x, z: ag.z });
    // in esplorazione: se dentro c'e' un'altra stanza mai vista, si da' un'occhiata anche li'
    if (a.auto) { const l = STANZE.filter(q => q.da === st.id && !ag.vistiDentro.includes(q.id)), dopo = l[Math.floor(adesso / 1000) % (l.length || 1)]; if (dopo) ag.coda.push({ tipo: 'entra', stanza: dopo.id, auto: true }); }
    return esito(ag, `entra ${st.nome}: sei dentro`);
  }
  if (a.tipo === 'esci') {
    const st = stanzaDi(ag.stanza);
    if (!st) { ag.stanza = null; return a.auto ? undefined : esito(ag, 'esci: sei gia\' fuori, in piazza'); }
    if (Math.hypot(ag.x - st.uscita.x, ag.z - st.uscita.z) > 1) { ag.tx = st.uscita.x; ag.tz = st.uscita.z; ag.ancora = null; ag.coda.unshift(a); return 'cammina'; }
    const fuori = st.da ? stanzaDi(st.da) : null, p = st.ritorno || (fuori ? { x: st.porta.x + 1, z: st.porta.z } : { x: st.porta.x, z: st.porta.z + 0.5 });
    ag.stanza = fuori ? fuori.id : null; ag.x = ag.tx = p.x; ag.z = ag.tz = p.z;
    ag.ancora = { x: p.x, z: fuori ? p.z : p.z + 3 }; ag.prossimaGita = adesso + 20000; ag.dentroFino = fuori ? adesso + 4 * 60000 : 0;
    if (!fuori) ag.prossimaEsplorazione = Math.max(ag.prossimaEsplorazione || 0, adesso + 3 * 60000);
    annota(ag, adesso, `Sono uscito da ${st.nome}` + (fuori ? `, ora sono in ${fuori.nome}.` : ', ora sono in piazza.'));
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
  if ((a.tipo === 'costruisci' || a.tipo === 'sposta' || a.tipo === 'rimuovi') && ag.stanza)
    return esito(ag, `${a.tipo}: rifiutata, sei dentro ${luogoVicino(ag).nome}: dentro gli edifici non si costruisce e gli oggetti degli abitanti sono in piazza (esci prima)`);
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
function usa(stato, ag, a, adesso, regole) {
  const c = cosaDi(a.cosa);
  if (c.id === 'bici') {
    if (ag.stanza) { ag.coda.unshift(a); return esegui(stato, ag, { tipo: 'esci', auto: true }, adesso, regole); }
    ag.bici = !ag.bici; annota(ag, adesso, ag.bici ? 'Sono salito in bici.' : 'Sono sceso dalla bici.');
    return esito(ag, ag.bici ? 'usa Bici: sei in bici' : 'usa Bici: sei sceso');
  }
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
  const L = { tipo: 'usa', id: c.id, nome: c.nome, icona: c.icona, inizio: adesso, fine: adesso + c.min * 60000 };
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
  return esito(ag, `usa ${c.nome}: iniziato, ci vorranno ${c.min} minuti`);
}
function fineUso(stato, ag, L, adesso) {
  const c = cosaDi(L.id); if (!c) return;
  const r = c.fai({ ag, stato, adesso, momento: momento(adesso), compagno: L.compagno ? stato.agenti[L.compagno] : null, risultato: L.risultato, nomeDi, luogoVicino });
  esito(ag, `usa ${c.nome}: finito. ${r}`); annota(ag, adesso, r);
  if (c.id !== 'ruota' && c.id !== 'telescopio' && c.id !== 'panchina') evento(stato, { chi: ag.id, tipo: 'usato', testo: testo(r, 160), x: ag.x, z: ag.z });
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
  if (ag.stanza) { ag.coda.push({ tipo: 'esci', auto: true }); return; }
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

EDIFICI: puoi entrare in ${STANZE.filter(q => !q.torre).map(q => q.nome + (q.da ? ' (si entra da dentro ' + stanzaDi(q.da).nome + ')' : '')).join(', ')}. Le case private delle persone invece sono chiuse.
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
- {"tipo":"proponi","testo":"..."}: il borgo e' un gioco fatto da persone. Tu non puoi cambiarne il codice, gli edifici originali o i minigiochi, ma puoi proporre a chi lo crea un miglioramento o un'idea (al massimo ${regole.proposteAlGiorno} al giorno). La legge una persona e decide lei; non saprai subito se l'ha accettata.

RISPOSTA: solo un oggetto JSON, niente altro testo:
{"pensiero":"cosa pensi ora, breve","azioni":[...],"ricorda":"cosa annotare nel diario, breve (o vuoto)","prossimo_pensiero_minuti":30,"sforzo_prossimo":"basso","memoria_nuova":""}
Scrivi "memoria_nuova" solo quando te lo chiedo: e' la tua memoria riscritta e riassunta (massimo ${regole.memoriaMax} caratteri), tutto quello che non ci metti lo dimentichi.`;
}

// Quello che l'agente percepisce adesso: lo costruisce il codice dallo stato vero.
export function percezione(stato, ag, adesso, regole = REGOLE) {
  const b = budget(ag, adesso, regole), vicino = luogoVicino(ag);
  const righe = [];
  righe.push(`ORA: ${FMT_ORA.format(new Date(adesso))} (${momento(adesso)}).`);
  righe.push(`BUDGET: questo mese hai speso ${dollari(b.spesi)} su ${dollari(b.tetto)} in ${b.pensieri} pensieri; restano ${dollari(b.resto)} per ${b.giorni} giorni (circa ${dollari(b.alGiorno)} al giorno).` + (ag.costoUltimo ? ` Il tuo ultimo pensiero e' costato ${dollari(ag.costoUltimo)}.` : '') + previsione(b, ag, adesso));
  if (ag.abitudine) righe.push(`LA TUA ABITUDINE: ${descriviAbitudine(ag.abitudine)} (la segui da solo, gratis; puoi cambiarla quando vuoi).`);
  if (inAmbientamento(ag, adesso, regole)) righe.push(`SEI NEL BORGO DA POCO: per i primi ${Math.round(regole.ambientamentoOre / 24)} giorni ripenserai al massimo ogni ${regole.ambientamentoMaxMin} minuti, per conoscere il posto e capire chi sei. Poi deciderai di nuovo tu il ritmo.`);
  const qui = ag.stanza && stanzaDi(ag.stanza);
  if (qui) righe.push(`DOVE SEI: dentro ${qui.nome}, x=${Math.round(ag.x)} z=${Math.round(ag.z)} (la stanza va da x=${qui.rect.x0} a ${qui.rect.x1} e da z=${qui.rect.z0} a ${qui.rect.z1}; la porta per uscire e' a x=${qui.uscita.x} z=${qui.uscita.z}).` +
    (STANZE.some(q => q.da === qui.id) ? ` Da qui si entra anche in ${STANZE.filter(q => q.da === qui.id).map(q => q.nome).join(', ')}.` : '') + ' Chi e\' in piazza non ti vede e non ti sente.');
  else righe.push(`DOVE SEI: in piazza, x=${Math.round(ag.x)} z=${Math.round(ag.z)}, ${vicino.d <= 4 ? 'a' : 'vicino a'} ${vicino.nome}.` + (ag.bici ? ' Sei in bici.' : '') + (ag.lavoro ? (ag.lavoro.tipo === 'usa' ? ` Stai usando: ${ag.lavoro.nome}.` : ' Stai ancora lavorando.') : ''));
  const giochi = (stato.giochi || []).filter(g => !g.finito && (g.chi === ag.id || dist(stato.agenti[g.chi] || g, ag) <= regole.vista * 2));
  if (giochi.length) righe.push('GIOCHI IN CORSO:\n' + giochi.map(g => `- ${g.chi === ag.id ? 'il tuo' : 'di ' + nomeDi(stato, g.chi)} (${g.forma}, finisce alle ${oraBreve(g.fine)}): ${testo(g.testo, 160)}` + (g.forma === 'quiz' ? '' : ` Punto: ${g.dove || `x=${Math.round(g.x)} z=${Math.round(g.z)}`}.`)).join('\n'));
  const cl = Object.entries(stato.punti || {}).sort((a, b) => b[1] - a[1]).slice(0, 5);
  if (cl.length) righe.push('CLASSIFICA DEI GIOCHI DEL BORGO: ' + cl.map(([n, p]) => `${n} ${p}`).join(', ') + '.');
  const visti = [];
  for (const altro of Object.values(stato.agenti)) {
    if (altro === ag) continue; const d = dist(altro, ag);
    if (d <= regole.vista) visti.push(`- ${altro.nome}, a ${Math.round(d)} m` + (altro.lavoro ? (altro.lavoro.tipo === 'costruisci' ? ', sta costruendo' : ', sta smontando qualcosa') : (Math.hypot(altro.tx - altro.x, altro.tz - altro.z) > 0.5 ? ', sta camminando' : '')));
  }
  const giocatori = new Map();
  stato.eventi.filter(e => e.chi && e.chi.indexOf('g:') === 0 && e.tipo !== 'scrivi' && adesso - e.t < 5 * 60000 && dist(e, ag) <= regole.vista).forEach(e => giocatori.set(e.chi, e));
  giocatori.forEach((e, id) => visti.push(`- ${id.slice(2)} (persona vera), a ${Math.round(dist(e, ag))} m`));
  const oggetti = stato.oggetti.filter(o => dist(o, ag) <= regole.vista).sort((a, c) => dist(a, ag) - dist(c, ag)).slice(0, 20);
  oggetti.forEach(o => visti.push(`- oggetto ${o.id} "${o.nome}" di ${o.autore === ag.id ? 'te' : nomeDi(stato, o.autore)}: ${o.forma} ${o.l}x${o.h}x${o.p} m, colore ${o.colore}, a x=${o.x} z=${o.z} y=${o.y}${o.scritta ? `, scritta "${o.scritta}"` : ''}${o.pronto ? '' : ' (in costruzione)'}, a ${Math.round(dist(o, ag))} m`));
  righe.push('COSA VEDI intorno a te:\n' + (visti.length ? visti.join('\n') : '- nessuno e niente di nuovo'));
  const da = ag.ultimaVolta || 0;
  const sentiti = stato.eventi.filter(e => e.t > da && e.chi !== ag.id && (e.tipo === 'scrivi' ? e.a === ag.id : dist(e, ag) <= regole.vista && ['parla', 'costruisce', 'finito', 'rimosso', 'sposta', 'gesto', 'entra', 'esce', 'usa', 'usato'].includes(e.tipo))).slice(-12);
  if (sentiti.length) righe.push('COSA E\' SUCCESSO VICINO A TE dall\'ultima volta:\n' + sentiti.map(e => `- [${oraBreve(e.t)}] ${nomeDi(stato, e.chi)}${e.chi.indexOf('g:') === 0 ? ' (persona vera)' : ''} ` + (e.tipo === 'parla' ? `ha detto: "${e.testo}"` : e.tipo === 'scrivi' ? `ti ha scritto da lontano: "${e.testo}" (per rispondere da lontano usa "scrivi")` : e.tipo === 'entra' ? `e' entrato qui` : e.tipo === 'esce' ? `e' arrivato da ${e.testo}` : e.tipo === 'costruisce' ? `ha iniziato a costruire "${e.testo}"` : e.tipo === 'finito' ? `ha finito "${e.testo}"` : e.tipo === 'rimosso' ? `ha smontato "${e.testo}"` : e.tipo === 'gesto' ? e.testo : e.tipo === 'usa' ? `usa: ${e.testo}` : e.tipo === 'usato' ? `ha finito. ${e.testo}` : `ha spostato "${e.testo}"`)).join('\n'));
  if (ag.esiti.length) righe.push('COME SONO ANDATE LE TUE ULTIME AZIONI:\n' + ag.esiti.map(s => '- ' + s).join('\n'));
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
      required: ['tipo', 'luogo', 'x', 'z', 'y', 'testo', 'id', 'nome', 'forma', 'larghezza', 'altezza', 'profondita', 'colore', 'rotazione'],
      properties: { tipo: { type: 'string', enum: ['vai', 'entra', 'esci', 'di', 'scrivi', 'costruisci', 'sposta', 'rimuovi', 'proponi', 'abitudine', 'gesto', 'gioco', 'usa'] }, luogo: STR_O_NULL, x: NUM_O_NULL, z: NUM_O_NULL, y: NUM_O_NULL,
        testo: STR_O_NULL, id: STR_O_NULL, nome: STR_O_NULL, forma: STR_O_NULL, larghezza: NUM_O_NULL, altezza: NUM_O_NULL, profondita: NUM_O_NULL, colore: STR_O_NULL, rotazione: NUM_O_NULL } } }
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
  ag.costoUltimo = costo; ag.ultimaVolta = adesso; ag.esiti = [];
  if (ag.meseInizio !== meseDi(adesso)) { ag.meseInizio = meseDi(adesso); ag.tInizio = adesso; }   // da quando pensa in questo mese (per la previsione)

  const v = r.stop_reason === 'refusal' ? null : leggiRisposta(r.testo);
  if (!v) {
    ag.ultimoPensiero = '(non sono riuscito a decidere)';
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
  // nuove decisioni: la coda vecchia si butta (il lavoro gia' iniziato invece continua)
  ag.coda = azioni.map(normalizzaAzione);
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

// Quello che il gioco mostra. Contiene anche i pensieri: li vedono gli spettatori, non gli altri agenti.
export function vistaPubblica(stato, adesso, regole = REGOLE) {
  return {
    ora: adesso, modello: MODELLO, pausa: !!stato.pausa,
    agenti: Object.values(stato.agenti).map(a => {
      const b = budget(a, adesso, regole);
      return { id: a.id, nome: a.nome, look: a.look, x: a.x, z: a.z, tx: a.tx, tz: a.tz, stanza: a.stanza || null,
        lavoro: a.lavoro ? { tipo: a.lavoro.tipo, id: a.lavoro.id, nome: a.lavoro.nome, icona: a.lavoro.icona, inizio: a.lavoro.inizio, fine: a.lavoro.fine } : null, bici: !!a.bici,
        detto: a.detto, gesto: a.gesto || null, pensiero: a.ultimoPensiero, memoria: a.memoria, modo: a.modo, motivo: a.motivo || null,
        prossimo: a.prossimoPensiero, budget: { spesi: b.spesi, tetto: b.tetto, resto: b.resto, giorni: b.giorni, pensieri: b.pensieri } };
    }),
    oggetti: stato.oggetti,
    giochi: (stato.giochi || []).filter(g => !g.finito || adesso - (g.fineVera || g.fine) < 60000).map(g => ({ id: g.id, chi: nomeDi(stato, g.chi), forma: g.forma, testo: g.testo, x: g.forma === 'quiz' ? null : g.x, z: g.forma === 'quiz' ? null : g.z, dove: g.dove, fine: g.fine, finito: g.finito, vincitore: g.vincitore })),
    classifica: Object.entries(stato.punti || {}).sort((a, b) => b[1] - a[1]).slice(0, 10),
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
  return (stato.cronaca || []).filter(e => e.t > da).slice(-max).map(e => ({ t: e.t, chi: nomeDi(stato, e.chi), vero: e.chi.indexOf('g:') === 0, tipo: e.tipo, testo: e.testo, a: e.a ? nomeDi(stato, e.a) : null, luogo: luogoVicino(e).nome }));
}
