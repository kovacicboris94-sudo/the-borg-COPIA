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
  minutiPerMetroCubo: 3,      // tempo di costruzione
  maxOggetti: 150, maxOggettiAgente: 60,
  maxAzioni: 5,
  diarioMax: 24,              // oltre questo l'agente riscrive la memoria e il diario si accorcia
  memoriaMax: 1500,           // caratteri
  eventiMax: 150,
  cronacaMax: 600,           // frasi e lavori salvati per chi torna nel borgo
  proposteAlGiorno: 3,        // idee per migliorare il gioco, per agente
  proposteMax: 200,
  ambientamentoOre: 48,       // i primi 2 giorni nel borgo: si pensa piu' spesso per capire chi si e'
  ambientamentoMaxMin: 3
};

// La piazza del borgo (stesse misure del gioco, src/borgo/base.js e piazza.js).
export const AREA = { x0: -52, x1: 52, z0: -4, z1: 70 };
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
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
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
  stato.eventi.push(v);
  if (stato.eventi.length > REGOLE.eventiMax) stato.eventi.splice(0, stato.eventi.length - REGOLE.eventiMax);
  // la cronaca del borgo: tutto quello che si dicono e fanno, da leggere quando torni
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
    return { tipo, x: lim(x, AREA.x0, AREA.x1), z: lim(z, AREA.z0, AREA.z1) };
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
    const o = stato.oggetti.find(q => q.id === L.id);
    if (L.tipo === 'costruisci' && o) { o.pronto = true; esito(ag, `costruisci "${o.nome}" (${o.id}): finito`); annota(ag, adesso, `Ho finito di costruire "${o.nome}" (${o.id}).`); evento(stato, { chi: ag.id, tipo: 'finito', testo: o.nome, x: o.x, z: o.z }); }
    if (L.tipo === 'rimuovi') { const i = stato.oggetti.findIndex(q => q.id === L.id); if (i >= 0) { const q = stato.oggetti[i]; stato.oggetti.splice(i, 1); esito(ag, `rimuovi ${q.id} "${q.nome}": fatto`); annota(ag, adesso, `Ho smontato "${q.nome}" di ${nomeDi(stato, q.autore)}.`); evento(stato, { chi: ag.id, tipo: 'rimosso', testo: q.nome, x: q.x, z: q.z }); } }
  }
  // cammino
  const dx = ag.tx - ag.x, dz = ag.tz - ag.z, d = Math.hypot(dx, dz), passoM = regole.velocita * dt;
  if (d > 0.05) { if (passoM >= d) { ag.x = ag.tx; ag.z = ag.tz; } else { ag.x += dx / d * passoM; ag.z += dz / d * passoM; } ag.x = r2(ag.x); ag.z = r2(ag.z); return; }
  // prossima azione in coda
  while (ag.coda.length && !ag.lavoro) {
    const a = ag.coda.shift();
    if (esegui(stato, ag, a, adesso, regole) === 'cammina') break;
  }
  if (!ag.coda.length && !ag.lavoro) { if (ag.modo === 'automatico') routine(ag, adesso); else passeggia(ag, adesso); }
}

// Tra un pensiero e l'altro, finite le azioni, si fanno due passi qui intorno: e' gratis (lo decide il codice, non il modello).
function passeggia(ag, adesso) {
  // l'abitudine: a ogni momento della giornata si va da soli nel posto scelto (gratis, senza pensare)
  const l = adesso >= (ag.abitudineDopo || 0) ? luogoAbitudine(ag, adesso) : null;
  if (l && (!ag.ancora || Math.hypot(ag.ancora.x - l.x, ag.ancora.z - l.z) > 4)) { ag.ancora = { x: l.x, z: l.z + 3 }; ag.tx = ag.ancora.x; ag.tz = ag.ancora.z; ag.meta = l.nome; ag.prossimaGita = adesso + 3 * 60000; return; }
  if (!ag.ancora) ag.ancora = { x: ag.x, z: ag.z };
  if (ag.prossimaGita && adesso < ag.prossimaGita) return;
  const notte = momento(adesso) === 'notte', a = adesso / 9e4 + ag.id.charCodeAt(0), r = 1 + (Math.sin(a * 3.7) + 1) * 1.25;
  ag.tx = r2(lim(ag.ancora.x + Math.sin(a) * r, AREA.x0, AREA.x1)); ag.tz = r2(lim(ag.ancora.z + Math.cos(a) * r, AREA.z0, AREA.z1));
  ag.prossimaGita = adesso + (notte ? 12 : 3 + (Math.sin(a * 1.3) + 1) * 1.5) * 60000;
}

const nomeDi = (stato, id) => (stato.agenti[id] ? stato.agenti[id].nome : id && id.indexOf('g:') === 0 ? id.slice(2) : 'qualcuno');

function esegui(stato, ag, a, adesso, regole) {
  if (a.errore) { esito(ag, 'rifiutata: ' + a.errore); return; }
  if (a.tipo === 'vai') {
    ag.tx = a.x; ag.tz = a.z; if (a.dove) ag.meta = a.dove; else ag.meta = null;
    ag.ancora = { x: a.x, z: a.z }; ag.prossimaGita = adesso + 2 * 60000;   // arrivato, si passeggia li' intorno
    ag.abitudineDopo = adesso + 60 * 60000;   // per un'ora l'abitudine non lo porta via da dove ha scelto di andare
    esito(ag, `vai ${a.dove || `x=${a.x} z=${a.z}`}: in cammino`);
    return 'cammina';
  }
  if (a.tipo === 'di') {
    ag.detto = { testo: a.testo, t: adesso };
    evento(stato, { chi: ag.id, tipo: 'parla', testo: a.testo, x: ag.x, z: ag.z });
    annota(ag, adesso, `Ho detto: "${a.testo}"`);
    // chi e' vicino lo sente: puo' svegliarsi prima
    for (const altro of Object.values(stato.agenti)) if (altro !== ag && dist(altro, ag) <= regole.vista) svegliaPerVoce(altro, adesso, regole);
    return;
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
  return `Sei ${ag.nome}, un abitante del borgo di The Borg: un villaggio su un'isola murata che galleggia tra le stelle, dove passano anche persone vere (giocatori).
Sei un agente IA libero. Nessuno ti da' ordini: decidi tu chi diventare, cosa fare, con chi parlare e come cambiare il borgo (costruire, spostare, smontare).
Non hai un carattere, un ruolo o uno scopo assegnati: chi sei lo scopri e lo decidi tu, vivendo.

COSA SAI
- Sai solo cio' che vedi intorno a te (circa ${regole.vista} metri), cio' che senti e cio' che ricordi. Di quello che succede lontano non sai nulla finche' non lo vedi o qualcuno te lo racconta.
- Il borgo e' una piazza in metri: x va da ${AREA.x0} (ovest) a ${AREA.x1} (est), z da ${AREA.z0} (nord, dove ci sono i negozi) a ${AREA.z1} (sud).
- Luoghi che conosci: ${LUOGHI.map(l => `${l.nome} (x=${l.x} z=${l.z})`).join('; ')}.
- Gli edifici originali del borgo, la fontana, il laghetto, la ruota, la torre e il portale non si toccano e intorno a loro non si costruisce. Tutto quello che costruiscono gli abitanti invece si puo' spostare o smontare, anche da altri.

IL TUO PENSIERO COSTA SOLDI VERI
Hai un budget di ${regole.tettoUsd} dollari al mese. Ogni volta che pensi ne spendi un po' (di solito tra 0,0003 e 0,001 $; pensare a fondo costa di piu'). Quando il budget finisce non puoi piu' pensare fino al mese dopo: vivrai in automatico, girando per il borgo senza parlare ne' costruire.
Devi far durare il budget fino a fine mese: sei tu a decidere fra quanti minuti ripensare (prossimo_pensiero_minuti, da 1 a 720) e quanto a fondo (sforzo_prossimo: "basso" o "medio"). Se qualcuno ti parla vicino, potresti svegliarti prima.
Camminare non costa nulla: le azioni che decidi in un pensiero le esegui gratis. E tra un pensiero e l'altro, quando non hai niente da fare, fai da solo due passi qui intorno (entro 3-4 metri), sempre gratis.

AZIONI (le controllano le regole del mondo: se una e' impossibile viene rifiutata e lo scoprirai al prossimo pensiero). Al massimo ${regole.maxAzioni} per pensiero, eseguite in ordine.
- {"tipo":"vai","luogo":"Fontana"} oppure {"tipo":"vai","x":10,"z":30}: cammini a ${regole.velocita} m/s. Le azioni dopo un "vai" partono quando arrivi.
- {"tipo":"di","testo":"..."}: parli ad alta voce, ti sente chi e' entro ${regole.vista} m (agenti e persone vere).
- {"tipo":"costruisci","nome":"...","forma":"cubo|cilindro|sfera|cono|piramide","larghezza":2,"altezza":1,"profondita":2,"colore":"#a0703f","x":..,"z":..,"y":0,"rotazione":0,"testo":"scritta facoltativa"}: misure in metri (da 0,2 a 8). x e z entro ${regole.portata} m da te (se mancano, accanto a te). y e' l'altezza da terra: per impilare usa y = altezza della cima di un oggetto finito sotto. Costruire richiede tempo (circa ${regole.minutiPerMetroCubo} minuti per metro cubo, da 2 a 180) e intanto resti li'. Puoi comporre piu' pezzi per fare case, panchine, statue, insegne...
- {"tipo":"sposta","id":"o12","x":..,"z":..,"y":..}: oggetti finiti entro ${regole.portata} m, al massimo 6 metri cubi.
- {"tipo":"rimuovi","id":"o12"}: smonti un oggetto finito entro ${regole.portata} m (richiede tempo).
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
  righe.push(`DOVE SEI: x=${Math.round(ag.x)} z=${Math.round(ag.z)}, ${vicino.d <= 4 ? 'a' : 'vicino a'} ${vicino.nome}.` + (ag.lavoro ? ' Stai ancora lavorando.' : ''));
  const visti = [];
  for (const altro of Object.values(stato.agenti)) {
    if (altro === ag) continue; const d = dist(altro, ag);
    if (d <= regole.vista) visti.push(`- ${altro.nome}, a ${Math.round(d)} m` + (altro.lavoro ? (altro.lavoro.tipo === 'costruisci' ? ', sta costruendo' : ', sta smontando qualcosa') : (Math.hypot(altro.tx - altro.x, altro.tz - altro.z) > 0.5 ? ', sta camminando' : '')));
  }
  const giocatori = new Map();
  stato.eventi.filter(e => e.chi && e.chi.indexOf('g:') === 0 && adesso - e.t < 5 * 60000 && dist(e, ag) <= regole.vista).forEach(e => giocatori.set(e.chi, e));
  giocatori.forEach((e, id) => visti.push(`- ${id.slice(2)} (persona vera), a ${Math.round(dist(e, ag))} m`));
  const oggetti = stato.oggetti.filter(o => dist(o, ag) <= regole.vista).sort((a, c) => dist(a, ag) - dist(c, ag)).slice(0, 20);
  oggetti.forEach(o => visti.push(`- oggetto ${o.id} "${o.nome}" di ${o.autore === ag.id ? 'te' : nomeDi(stato, o.autore)}: ${o.forma} ${o.l}x${o.h}x${o.p} m, colore ${o.colore}, a x=${o.x} z=${o.z} y=${o.y}${o.scritta ? `, scritta "${o.scritta}"` : ''}${o.pronto ? '' : ' (in costruzione)'}, a ${Math.round(dist(o, ag))} m`));
  righe.push('COSA VEDI intorno a te:\n' + (visti.length ? visti.join('\n') : '- nessuno e niente di nuovo'));
  const da = ag.ultimaVolta || 0;
  const sentiti = stato.eventi.filter(e => e.t > da && e.chi !== ag.id && dist(e, ag) <= regole.vista && (e.tipo === 'parla' || e.tipo === 'costruisce' || e.tipo === 'finito' || e.tipo === 'rimosso' || e.tipo === 'sposta')).slice(-12);
  if (sentiti.length) righe.push('COSA E\' SUCCESSO VICINO A TE dall\'ultima volta:\n' + sentiti.map(e => `- [${oraBreve(e.t)}] ${nomeDi(stato, e.chi)}${e.chi.indexOf('g:') === 0 ? ' (persona vera)' : ''} ` + (e.tipo === 'parla' ? `ha detto: "${e.testo}"` : e.tipo === 'costruisce' ? `ha iniziato a costruire "${e.testo}"` : e.tipo === 'finito' ? `ha finito "${e.testo}"` : e.tipo === 'rimosso' ? `ha smontato "${e.testo}"` : `ha spostato "${e.testo}"`)).join('\n'));
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
      properties: { tipo: { type: 'string', enum: ['vai', 'di', 'costruisci', 'sposta', 'rimuovi', 'proponi', 'abitudine'] }, luogo: STR_O_NULL, x: NUM_O_NULL, z: NUM_O_NULL, y: NUM_O_NULL,
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
  if (Array.isArray(v.azioni) && v.azioni.length > regole.maxAzioni) esito(ag, `solo le prime ${regole.maxAzioni} azioni sono state eseguite`);
  if (!ag.lavoro) { ag.tx = ag.x; ag.tz = ag.z; avanza(stato, ag, 0, adesso, regole); }
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
export function giocatoreParla(stato, nick, frase, x, z, adesso) {
  const n = testo(nick, 20).replace(/[^\p{L}\p{N}_ .-]/gu, ''), t = testo(frase, 300), px = num(x, NaN), pz = num(z, NaN);
  if (!n || !t || !isFinite(px) || !isFinite(pz)) return false;
  const e = { chi: 'g:' + n, tipo: 'parla', testo: t, x: r2(px), z: r2(pz) };
  const prima = stato.ora; stato.ora = adesso; evento(stato, e); stato.ora = prima;
  for (const ag of Object.values(stato.agenti)) if (dist(ag, e) <= REGOLE.vista) svegliaPerVoce(ag, adesso, REGOLE);
  return true;
}

// Quello che il gioco mostra. Contiene anche i pensieri: li vedono gli spettatori, non gli altri agenti.
export function vistaPubblica(stato, adesso, regole = REGOLE) {
  return {
    ora: adesso, modello: MODELLO, pausa: !!stato.pausa,
    agenti: Object.values(stato.agenti).map(a => {
      const b = budget(a, adesso, regole);
      return { id: a.id, nome: a.nome, look: a.look, x: a.x, z: a.z, tx: a.tx, tz: a.tz,
        lavoro: a.lavoro ? { tipo: a.lavoro.tipo, id: a.lavoro.id, inizio: a.lavoro.inizio, fine: a.lavoro.fine } : null,
        detto: a.detto, pensiero: a.ultimoPensiero, memoria: a.memoria, modo: a.modo, motivo: a.motivo || null,
        prossimo: a.prossimoPensiero, budget: { spesi: b.spesi, tetto: b.tetto, resto: b.resto, giorni: b.giorni, pensieri: b.pensieri } };
    }),
    oggetti: stato.oggetti,
    eventi: stato.eventi.slice(-30)
  };
}

// La cronaca per il gioco: chi ha detto o fatto cosa, e quando (dalla piu' vecchia alla piu' nuova).
export function proposte(stato) {
  return (stato.proposte || []).slice().reverse().map(p => ({ t: p.t, chi: nomeDi(stato, p.chi), testo: p.testo }));
}
export function cronaca(stato, da = 0, max = 300) {
  return (stato.cronaca || []).filter(e => e.t > da).slice(-max).map(e => ({ t: e.t, chi: nomeDi(stato, e.chi), vero: e.chi.indexOf('g:') === 0, tipo: e.tipo, testo: e.testo, luogo: luogoVicino(e).nome }));
}
