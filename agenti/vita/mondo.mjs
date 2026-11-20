// =====================================================================
//  VITA - IL REGISTRO DEL MONDO
//  La verita' su tutto quello che esiste: corpi, cose, fuochi, alberi,
//  aiuole, pesci, meteo. Lo legge per intero solo il codice (e l'agente
//  GOD); ogni abitante ne vede solo il pezzo che ha intorno.
//  passoMondo() fa scorrere il tempo con passi piccoli (max 60 s) cosi'
//  il calore, la combustione e il corpo restano fisicamente corretti.
// =====================================================================
import { TEMPERATURA_MAX, RENDIMENTO, consumoFuoco, pciLegno, scaldaAcqua, versoAria, UMIDITA_MAX_FUOCO, ACQUA } from './fisica.mjs';
import { reagisci } from './chimica.mjs';
import { MATERIALI, OGGETTI } from './materiali.mjs';
import { nuovoCorpo, viviCorpo } from './corpo.mjs';
import { tempoAdesso, crescePianta, crescePesci, cresconoAlberi, invecchia, casuale } from './natura.mjs';
import { completaLavoro } from './azioni.mjs';

// Dove stanno le cose vere del borgo (stesse coordinate della piazza 3D: src/borgo/piazza.js, motore.mjs LUOGHI).
export const POSTI = {
  fontana: { nome: 'Fontana', x: 0, z: 30, raggio: 5, acqua: 'potabile' },
  laghetto: { nome: 'Laghetto', x: 38, z: 32, raggio: 13, acqua: 'lago', argilla: true, erba: true },
  dispensa: { nome: 'Dispensa del Mercatino', x: 0, z: 8, raggio: 5, coperto: true },
  forno: { nome: 'Forno', x: 44, z: -3, raggio: 5 }
};
const DZ = 26.8, PORTALE = { x: -35, z: 58 };
function alberiDelBorgo() {
  const l = [];
  const add = (x, z, tipo) => l.push({ id: 'albero' + (l.length + 1), x, z, tipo: Math.hypot(x - PORTALE.x, z - PORTALE.z) < 13 ? 'morto' : tipo, rami: 3, ciliegie: 0 });
  [[-25, 2.5], [-25, 20], [25, 9], [25, 24], [-11, 27.6], [11, 27.6], [-19.5, -3]].forEach(c => add(c[0], c[1] + DZ, 'ciliegio'));
  [-50, -40, 40, 50].forEach((x, i) => [16, 32, 48, 66].forEach((z, j) => { if (!(x === 40 && z === 32) && !(x === -50 && z === 32)) add(x, z, (i + j) % 3 === 1 ? 'ciliegio' : 'verde'); }));
  [-30, -15, 15, 30].forEach((x, i) => add(x, 67, i % 2 ? 'ciliegio' : 'verde'));
  return l;
}
function aiuoleDelBorgo() {
  const d = [[-10.5, 7.2, 2.2, 1.2], [10.0, 8.4, 2.4, 1.2], [8.4, 1.4, 1.6, 1.6], [-8.0, 1.0, 1.8, 1.4], [-16.2, 6.4, 2.2, 1.2], [16.4, 6.8, 2.2, 1.2], [-24, 5.4, 2.4, 1.4], [23, 7.2, 2.4, 1.4],
    [-8, 15.2, 3.0, 1.4], [8, 15.2, 3.0, 1.4], [-19, 20, 2.6, 1.4], [19, 19.5, 2.6, 1.4], [-6, 26, 2.2, 1.2], [6, 26, 2.2, 1.2], [-24, 12.5, 1.6, 2.4], [24, 16.5, 1.6, 2.4], [-13, 16.5, 2.2, 1.2], [13, 16.5, 2.2, 1.2]];
  return d.map((a, i) => ({ id: 'aiuola' + (i + 1), x: a[0], z: a[1] + DZ, m2: Math.round(a[2] * a[3] * 100) / 100, coltura: null, gdd: 0, acqua: 60 }));
}

// Le scorte iniziali della dispensa (finite: quando finiscono, finiscono).
export const SCORTE_INIZIALI = [
  ['farina', 20], ['fagioli_secchi', 8], ['olio', 3], ['sale', 1],
  ['semi_grano', 1], ['semi_fave', 0.5], ['semi_spinaci', 0.05],
  ['legna', 60], ['erba_secca', 0.5],
  ['acciarino', 2], ['coltello', 2], ['lenza', 2], ['coperta', 2]
];

export const CORPI_ABITANTI = {
  ada: { sesso: 'f', eta: 29, altezza: 165, peso: 62 },
  teo: { sesso: 'm', eta: 31, altezza: 178, peso: 75 }
};

export const REGOLE_VITA = {
  morte: false,            // da decidere con Boris: se false, a salute zero si sviene e ci si riprende
  portataMani: 6,          // metri: per prendere, raccogliere, usare un fuoco
  caricoMax: 25,           // kg che una persona porta con se'
  passoMaxS: 60
};

const nuovoId = (mondo, p) => p + (mondo.prossimoId++);
export function nuovaCosa(mondo, cosa, kg, extra = {}) {
  const M = MATERIALI[cosa];
  const c = { id: nuovoId(mondo, 'c'), cosa, kg: Math.round(kg * 1000) / 1000, ...extra };
  if (M && M.tipo === 'combustibile' && c.umid == null) c.umid = M.acqua;
  if (M && M.dura20 && c.guasto == null) c.guasto = 0;
  return c;
}

export function nuovoMondo({ adesso, seme = 12345, abitanti = ['ada', 'teo'], posizioni = {} } = {}) {
  const mondo = {
    versione: 1, t: adesso, rng: seme >>> 0, prossimoId: 1, meteo: null,
    alberi: alberiDelBorgo(), aiuole: aiuoleDelBorgo(),
    laghetto: { pesci: 45 }, erbaLaghetto: 2,
    cose: [], fuochi: [], corpi: {}, registro: [], statistiche: { giorni: [] }
  };
  for (const [cosa, kg] of SCORTE_INIZIALI) {
    if (OGGETTI[cosa]) for (let i = 0; i < kg; i++) mondo.cose.push(nuovaCosa(mondo, cosa, OGGETTI[cosa].kg, { dove: 'dispensa' }));
    else mondo.cose.push(nuovaCosa(mondo, cosa, kg, { dove: 'dispensa' }));
  }
  // il forno del borgo: un forno da pane in muratura, spento. Chiunque puo' accenderlo se porta la legna.
  mondo.fuochi.push({ id: 'forno', nome: 'forno del Forno', fisso: true, struttura: 'forno_pane', x: POSTI.forno.x, z: POSTI.forno.z, legna: [], T: null, sopra: [] });
  for (const id of abitanti) {
    const p = posizioni[id] || { x: 0, z: 34 };
    mondo.corpi[id] = Object.assign(nuovoCorpo(CORPI_ABITANTI[id] || {}), { id, x: p.x, z: p.z, stanza: null, zaino: [], lavoro: null, abilita: { pesca: 0, fuoco: 0, argilla: 0, cucina: 0 } });
  }
  return mondo;
}

export const TMAX_STRUTTURA = { aperto: TEMPERATURA_MAX.aperto, forno_pane: 450, fornace: TEMPERATURA_MAX.pietra };
const REND = { aperto: RENDIMENTO.aperto, forno_pane: RENDIMENTO.pietra, fornace: RENDIMENTO.pietra };

export function registra(mondo, e) {
  mondo.registro.push(Object.assign({ t: mondo.t }, e));
  if (mondo.registro.length > 300) mondo.registro.splice(0, mondo.registro.length - 300);   // corto: lo stato si salva in un solo valore
}

/* ------------------------------------------------------------------ */
/*  fuoco                                                              */
/* ------------------------------------------------------------------ */
export function legnaNelFuoco(f) { return f.legna.reduce((s, l) => s + l.kg, 0); }
function potenzaFuoco(f) {
  const kg = legnaNelFuoco(f); if (!kg || !f.acceso) return { W: 0, kgOra: 0 };
  const umid = f.legna.reduce((s, l) => s + l.kg * l.umid, 0) / kg;
  const kgOra = consumoFuoco(kg, umid);
  return { W: kgOra * pciLegno(umid) / 3600, kgOra, umid };
}
// Un passo di dt secondi per un fuoco e per quello che c'e' sopra o dentro.
function viviFuoco(mondo, f, dt, tempo) {
  const tAria = tempo.tAria;
  if (f.T == null) f.T = tAria;
  const p = potenzaFuoco(f);
  if (f.acceso) {
    // legna troppo bagnata o finita: il fuoco muore
    if (!legnaNelFuoco(f) || p.umid > UMIDITA_MAX_FUOCO) { f.acceso = false; registra(mondo, { tipo: 'fuoco_spento', fuoco: f.id, motivo: !legnaNelFuoco(f) ? 'legna finita' : 'legna bagnata' }); }
    // la pioggia spegne un fuoco all'aperto piccolo
    else if (f.struttura === 'aperto' && tempo.piove && tempo.intensita > 2 && legnaNelFuoco(f) < 3) { f.acceso = false; registra(mondo, { tipo: 'fuoco_spento', fuoco: f.id, motivo: 'pioggia' }); }
  }
  if (f.acceso) {
    // brucia la legna: la massa diventa CO2, acqua (gas) e circa l'1% di cenere
    let daBruciare = p.kgOra * dt / 3600;
    for (const l of f.legna) { const b = Math.min(l.kg, daBruciare * l.kg / legnaNelFuoco(f) * 1.0001); l.kg -= b; f.cenere = (f.cenere || 0) + b * 0.01; f.bruciati = (f.bruciati || 0) + b; }
    f.legna = f.legna.filter(l => l.kg > 0.005);
    const Tmax = TMAX_STRUTTURA[f.struttura] || 800, Tobiettivo = tAria + (Tmax - tAria) * Math.min(1, Math.pow(p.W / 5000, 0.25));
    f.T += (Tobiettivo - f.T) * (1 - Math.exp(-dt / 300));   // il fuoco va a regime in qualche minuto
    // la legna che aspetta nel fuoco si asciuga
    for (const l of f.legna) l.umid = Math.max(0.02, l.umid - dt / 3600 * 0.05);
  } else {
    f.T = tAria + (f.T - tAria) * Math.exp(-dt / (f.struttura === 'aperto' ? 1800 : 7200));   // braci e forni si raffreddano piano
  }
  // cio' che c'e' sul fuoco
  for (const s of f.sopra) scaldaSulFuoco(mondo, f, s, p.W, dt, tAria);
}

// Il calore passa dal fuoco alle cose, e le trasformazioni avvengono solo se fisica e chimica lo permettono.
function scaldaSulFuoco(mondo, f, s, W, dt, tAria) {
  if (s.T == null) s.T = tAria;
  if (s.cosa === 'pentola') {
    const acqua = (s.contenuto || []).find(c => c.cosa === 'acqua');
    // acceso: arriva alla pentola una parte della potenza del fuoco; spento: solo il calore delle braci (~0,5 W per grado di differenza)
    const P = f.acceso ? (REND[f.struttura] || 0.15) * W : Math.max(0, f.T - s.T) * 0.5;
    if (acqua && acqua.kg > 0.01) {
      const solidi = s.contenuto.filter(c => c !== acqua), kgSolidi = solidi.reduce((q, c) => q + c.kg, 0);
      const r = scaldaAcqua({ kg: acqua.kg + kgSolidi * 0.8, T: s.T, kgRecipiente: s.kg }, P, dt, tAria);
      const evap = Math.min(acqua.kg, r.evaporata); acqua.kg -= evap; s.T = r.T; acqua.T = s.T;
      if (s.T >= ACQUA.ebollizione - 0.01) acqua.minBollore = (acqua.minBollore || 0) + dt / 60;
      if (acqua.minBollore >= 1) acqua.bollita = true;   // OMS: un minuto di bollore rende l'acqua sicura
      for (const c of solidi) { c.T = s.T; cuociInAcqua(mondo, s, c, acqua, dt); }
    } else {
      // pentola senza acqua: si scalda fino a rompersi o a bruciare quello che c'e' dentro
      s.T += P * dt / (s.kg * 850 + 1);
      for (const c of s.contenuto || []) { c.T = s.T; if (c.T > 250 && MATERIALI[c.cosa] && MATERIALI[c.cosa].tipo === 'cibo') c.bruciato = true; }
    }
    return;
  }
  // brace (sopra il fuoco), forno (aria calda), fiamme (dentro il fuoco, per la terracotta)
  const M = MATERIALI[s.cosa] || {}, O = OGGETTI[s.cosa] || {};
  const c = M.c || O.c || 1000;
  // sulla brace la superficie che cuoce sta sui 200 gradi; a fuoco spento le braci si raffreddano con il fuoco
  const env = s.modo === 'fiamme' || s.modo === 'forno' ? f.T : Math.min(f.T, 200);
  const h = s.modo === 'fiamme' ? 40 : s.modo === 'forno' ? 15 : 25;
  s.T = versoAria(s.T, env, s.kg, c, dt, h);
  // finche' un cibo contiene acqua il suo interno non supera i 100 gradi: il calore in piu' la fa evaporare
  if (M.acqua > 0.3 && s.modo !== 'fiamme') s.T = Math.min(s.T, 100);
  trasforma(mondo, f, s, dt);
}

// Ammollo e bollitura in pentola
function cuociInAcqua(mondo, pentola, c, acqua, dt) {
  const minuti = dt / 60;
  if ((c.cosa === 'fagioli_secchi' || c.cosa === 'fagioli_ammollati') && c.T >= 95) c.minCaldo = (c.minCaldo || 0) + minuti;
  if (c.cosa === 'fagioli_secchi' && c.T < 60) c.minAmmollo = (c.minAmmollo || 0) + minuti;
  // ammollo: 8 ore in acqua fredda, ogni kg di fagioli secchi beve 1,2 kg di acqua
  if (c.cosa === 'fagioli_secchi' && c.minAmmollo >= 8 * 60 && acqua.kg >= c.kg * 1.2) {
    acqua.kg -= c.kg * 1.2; c.kg = c.kg * 2.2; c.cosa = 'fagioli_ammollati'; c.minCaldo = 0; registra(mondo, { tipo: 'trasformazione', da: 'fagioli_secchi', a: 'fagioli_ammollati', kg: c.kg });
  }
  // bollitura: ammollati 60 min (assorbono ancora 0,19 kg/kg), secchi 180 min (1,62 kg/kg). Le lectine si distruggono a 100 gradi.
  const serve = c.cosa === 'fagioli_ammollati' ? 60 : 180, beve = c.cosa === 'fagioli_ammollati' ? 0.19 : 1.62;
  if ((c.cosa === 'fagioli_secchi' || c.cosa === 'fagioli_ammollati') && c.minCaldo >= serve) {
    const kgAcqua = Math.min(acqua.kg, c.kg * beve); acqua.kg -= kgAcqua; c.kg += kgAcqua; const da = c.cosa; c.cosa = 'fagioli_cotti'; c.guasto = 0;
    registra(mondo, { tipo: 'trasformazione', da, a: 'fagioli_cotti', kg: c.kg });
  }
  if (c.cosa === 'pesce' && c.T >= 63) { c.kg *= 0.8; c.cosa = 'pesce_cotto'; c.guasto = 0; registra(mondo, { tipo: 'trasformazione', da: 'pesce', a: 'pesce_cotto', kg: c.kg }); }
}

// Trasformazioni sulla brace, nel forno e nelle fiamme
function trasforma(mondo, f, s, dt) {
  const minuti = dt / 60;
  if (s.cosa === 'pesce' && s.T >= 63) { s.kg *= 0.8; s.cosa = 'pesce_cotto'; s.guasto = 0; s.minFatto = 0; registra(mondo, { tipo: 'trasformazione', da: 'pesce', a: 'pesce_cotto', kg: s.kg }); return; }
  if (s.cosa === 'impasto' && s.T >= 95) { s.kg *= 0.82; s.cosa = 'pane'; s.guasto = 0; s.minFatto = 0; registra(mondo, { tipo: 'trasformazione', da: 'impasto', a: 'pane', kg: s.kg }); return; }
  // cibo cotto lasciato troppo sul fuoco: si brucia (perde meta' delle calorie, diventa carbone)
  if ((s.cosa === 'pesce_cotto' || s.cosa === 'pane') && s.modo !== 'fiamme') { s.minFatto = (s.minFatto || 0) + minuti; if (s.minFatto > 25 && !s.bruciato) s.bruciato = true; }
  if (MATERIALI[s.cosa] && MATERIALI[s.cosa].tipo === 'cibo' && s.modo === 'fiamme' && s.T > 300) s.bruciato = true;
  // argilla cruda nelle fiamme: se e' ancora umida il vapore la spacca; se e' secca, sopra 550 gradi per un'ora diventa terracotta
  const O = OGGETTI[s.cosa];
  if (O && O.materiale === 'argilla') {
    if (s.T > 120 && (s.secca ?? 0) < 0.9 && !s.rotta) {
      if (casuale(mondo) < 0.8) { s.rotta = true; registra(mondo, { tipo: 'rotta', cosa: s.cosa, motivo: 'era ancora umida: il vapore l\'ha spaccata' }); }
      else s.secca = 1;
    }
    if (!s.rotta && s.T >= 550) s.minCottura = (s.minCottura || 0) + minuti;
    if (!s.rotta && s.minCottura >= 60) {
      // chimica: la caolinite perde il 14% del peso come acqua; prima era gia' evaporata l'acqua libera
      const secca = s.kg * (1 - (MATERIALI.argilla.acqua || 0)), r = reagisci('cottura_argilla', secca);
      const fatto = s.cosa.replace('_cruda', '').replace('_crudo', '');
      s.cosa = fatto; s.kg = Math.round(r.prodotti.Al2Si2O7 * 1000) / 1000; s.cotta = true;
      registra(mondo, { tipo: 'trasformazione', da: 'argilla cruda', a: fatto, kg: s.kg, energiaJ: r.energiaJ });
    }
  }
}

/* ------------------------------------------------------------------ */
/*  il passo del mondo                                                 */
/* ------------------------------------------------------------------ */
// Fa scorrere il tempo fino ad "adesso". posizioni: { id: {x, z, stanza} } dal motore degli agenti (facoltativo).
export function passoMondo(mondo, adesso, regole = REGOLE_VITA, posizioni = null) {
  const eventi = [];
  if (posizioni) for (const [id, p] of Object.entries(posizioni)) { const c = mondo.corpi[id]; if (c) { c.x = p.x; c.z = p.z; c.stanza = p.stanza || null; } }
  let resto = Math.max(0, Math.min(6 * 3600 * 1000, adesso - mondo.t)) / 1000;
  while (resto > 0.001) {
    const dt = Math.min(regole.passoMaxS || 60, resto);
    passoBreve(mondo, dt, regole, eventi);
    resto -= dt;
  }
  mondo.t = adesso;
  return eventi;
}

function passoBreve(mondo, dt, regole, eventi) {
  const t = mondo.t + dt * 1000, ore = dt / 3600, tempo = tempoAdesso(mondo, t);
  const giornoPrima = Math.floor(mondo.t / 86400000), giornoOra = Math.floor(t / 86400000);
  mondo.t = t;
  const pioggiaMm = tempo.piove ? tempo.intensita * ore : 0;
  // natura
  for (const a of mondo.aiuole) { const e = crescePianta(a, ore, mondo, t, tempo.tAria, pioggiaMm); if (e) { registra(mondo, e); eventi.push(e); } }
  crescePesci(mondo.laghetto, ore);
  cresconoAlberi(mondo.alberi, ore, t);
  mondo.erbaLaghetto = Math.min(2, mondo.erbaLaghetto + 0.2 / 24 * ore);
  // fuochi
  for (const f of mondo.fuochi) viviFuoco(mondo, f, dt, tempo);
  mondo.fuochi = mondo.fuochi.filter(f => f.fisso || f.acceso || f.sopra.length || (f.T - tempo.tAria) > 5);
  // le cose invecchiano (a terra sotto la pioggia si bagnano; in dispensa e nello zaino no)
  const vicinoFuoco = c => mondo.fuochi.some(f => f.acceso && Math.hypot(f.x - c.x, f.z - c.z) < 2);
  for (const c of mondo.cose) { invecchia(c, ore, tempo.tAria, c.dove === 'terra' && tempo.piove && !c.stanza, c.dove === 'terra' && vicinoFuoco(c), c.stanza ? 50 : tempo.umidita); if (c.T != null) c.T = versoAria(c.T, tempo.tAria, c.kg, (MATERIALI[c.cosa] || {}).c || 1000, dt); }
  for (const f of mondo.fuochi) for (const s of f.sopra) { invecchia(s, ore, s.T ?? tempo.tAria, false, true); for (const q of s.contenuto || []) invecchia(q, ore, q.T ?? tempo.tAria, false, false); }
  // i corpi
  for (const c of Object.values(mondo.corpi)) {
    for (const q of c.zaino) { invecchia(q, ore, q.T ?? tempo.tAria, tempo.piove && !c.stanza ? 0.3 : 0, false, c.stanza ? 50 : tempo.umidita); if (q.T != null) q.T = versoAria(q.T, tempo.tAria, q.kg, (MATERIALI[q.cosa] || {}).c || 1000, dt); for (const w of q.contenuto || []) { invecchia(w, ore, w.T ?? tempo.tAria, false, false); if (w.T != null) w.T = q.T; } }
    const fuoco = mondo.fuochi.filter(f => f.acceso && !c.stanza).map(f => ({ f, d: Math.hypot(f.x - c.x, f.z - c.z) })).filter(o => o.d < 4).sort((a, b) => a.d - b.d)[0];
    const amb = {
      tAria: tempo.tAria, vento: c.stanza ? 0.1 : tempo.vento, riparo: !!c.stanza,
      bagnato: c.stanza ? 0 : (tempo.piove ? Math.min(1, (c.bagnato || 0) + ore * 2) : Math.max(0, (c.bagnato || 0) - ore / 2)),
      fuoco: fuoco ? potenzaFuoco(fuoco.f).W / (4 * Math.PI * Math.max(1, fuoco.d) ** 2) * 0.5 : 0,
      coperta: c.zaino.some(q => q.cosa === 'coperta') ? OGGETTI.coperta.clo : 0
    };
    c.bagnato = amb.bagnato; c.ambiente = amb;
    finisciLavoro(mondo, c, t, eventi);
    for (const e of viviCorpo(c, dt, amb, t, regole)) { const ev = Object.assign({ chi: c.id }, e); registra(mondo, ev); eventi.push(ev); }
  }
  // statistiche di fine giornata (per GOD e per capire se l'esperimento funziona)
  if (giornoOra !== giornoPrima) chiudiGiornata(mondo, giornoPrima);
}

function chiudiGiornata(mondo, giorno) {
  const g = { giorno: new Date(giorno * 86400000).toISOString().slice(0, 10), corpi: {} };
  for (const c of Object.values(mondo.corpi)) {
    g.corpi[c.id] = { salute: Math.round(c.salute), peso: Math.round(c.peso * 10) / 10, mangiato: Math.round(c.mangiatoOggi), consumato: Math.round(c.consumoOggi), bevuto: Math.round(c.bevutoOggi * 10) / 10, disidratazione: Math.round((c.acquaNormale - c.acqua) / c.peso * 1000) / 10 };
    c.mangiatoOggi = 0; c.consumoOggi = 0; c.bevutoOggi = 0; c.acquaPersaOggi = 0;
  }
  g.kcalDispensa = Math.round(mondo.cose.filter(c => c.dove === 'dispensa' && MATERIALI[c.cosa] && MATERIALI[c.cosa].tipo === 'cibo').reduce((s, c) => s + c.kg * MATERIALI[c.cosa].kcal, 0));
  g.pesciLaghetto = Math.round(mondo.laghetto.pesci * 10) / 10;
  g.legnaDispensa = Math.round(mondo.cose.filter(c => c.dove === 'dispensa' && c.cosa === 'legna').reduce((s, c) => s + c.kg, 0) * 10) / 10;
  g.pioggiaMm = mondo.meteo ? Math.round(mondo.meteo.pioggiaMm * 10) / 10 : 0;
  mondo.statistiche.giorni.push(g);
  if (mondo.statistiche.giorni.length > 400) mondo.statistiche.giorni.shift();
}

/* ------------------------------------------------------------------ */
/*  lavori in corso (le azioni che richiedono tempo)                    */
/* ------------------------------------------------------------------ */
function finisciLavoro(mondo, c, t, eventi) {
  if (!c.lavoro) { if (!c.addormentato && !c.svenuto) c.attivita = 'riposare'; return; }
  c.attivita = c.lavoro.attivita || 'riposare';
  if (c.lavoro.tipo === 'dormi') {
    // ci si sveglia quando si e' riposati (o finito il tempo, o se si sta molto male)
    if (t >= c.lavoro.fine || (c.sonno <= 0.02 && t - c.lavoro.inizio > 4 * 3600000) || c.malattie.length && c.salute < 20) { c.addormentato = false; c.lavoro = null; c.attivita = 'riposare'; eventi.push({ chi: c.id, tipo: 'sveglio' }); }
    return;
  }
  if (t >= c.lavoro.fine) {
    const L = c.lavoro; c.lavoro = null; c.attivita = 'riposare';
    const esito = completaLavoro(mondo, c, L, t);
    if (esito) { const e = { chi: c.id, tipo: 'lavoro_finito', lavoro: L.tipo, esito }; registra(mondo, e); eventi.push(e); (c.esiti || (c.esiti = [])).push(esito); if (c.esiti.length > 8) c.esiti.shift(); }
  }
}
