// =====================================================================
//  COSA PRODUCE IL LAVORO (22/11/2026, Boris: "metti piu' mestieri, ogni
//  casa e mestiere deve funzionare")
//  I turni da dipendente (agenti/vita/mestieri.mjs) pagano a ore; qui c'e'
//  quello che il lavoro cambia davvero nel borgo, per gli agenti e per le
//  persone vere che fanno un turno dal gioco:
//   - fornaio e pasticcere: pane e dolci sugli scaffali di Forno e Caffetteria
//     (scorte vere: quando finiscono, finiscono; ogni mattina alle 6 arriva
//     solo una piccola consegna da fuori);
//   - fioraio: mazzi e rose al Fioraio;
//   - barista: finche' e' in turno la Caffetteria serve caffe' e spremute;
//   - muratore: ogni sua ora e' un'ora in piu' sul cantiere di un terreno;
//   - spazzino: la piazza si sporca da sola (cartacce, foglie), lui la pulisce;
//   - giardiniere: annaffia le aiuole (senz'acqua le piante seccano davvero);
//   - facchino: piu' merce nella Dispensa del Mercatino;
//   - bibliotecario: chi legge in Biblioteca mentre c'e' lui si annoia meno;
//   - segretario dell'Ambulatorio: le visite durano 15 minuti invece di 45.
//  Tutto qui e' codice deterministico: nessun modello decide cosa succede.
// =====================================================================
import { NEGOZI, SCORTE, PRODUZIONE, SCORTE_MAX } from './negozi.mjs';
import { MESTIERI } from './vita/mestieri.mjs';
import { LISTINO } from './vita/economia.mjs';
import { lottoDi, geometria } from './terreni.mjs';

const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', hourCycle: 'h23' });
export function oraRomaParti(ms) { const p = Object.fromEntries(FMT.formatToParts(new Date(ms)).map(x => [x.type, x.value])); return { giorno: `${p.year}-${p.month}-${p.day}`, h: +p.hour }; }

export const REGOLE_LAVORI = {
  sporciziaOra: 2.2,          // quanto si sporca la piazza ogni ora di giorno (0..100)
  pulisceOra: 30,             // quanto pulisce uno spazzino in un'ora
  pagaGiocatoreMin: 4,        // Starlight al minuto per una persona vera in turno (un turno di 20 minuti = 80: il gioco paga ~500 al giorno)
  turnoGiocatoreMin: 20,
  pingGiocatoreMs: 3 * 60000,
  visitaMin: 45, visitaConSegretarioMin: 15, prezzoVisita: 20,
  orariAmbulatorio: [[8, 13], [15, 19]], giorniAmbulatorio: [1, 2, 3, 4, 5, 6]
};

/* ---------- le scorte dei negozi ---------- */
export function scorteDi(stato, id) {
  if (!SCORTE[id]) return null;
  const S = stato.scorte || (stato.scorte = {});
  if (!S[id]) S[id] = Object.assign({}, SCORTE[id].consegna);
  return S[id];
}
// c'e' qualcuno che prepara il caffe'? (chi e' al bancone, o un barista in turno: agente o persona vera)
export function maniAlBanco(stato, negozio) {
  if (Object.values(stato.turni || {}).some(t => t.negozio === negozio)) return true;
  if (negozio !== 'caffetteria') return false;
  return inTurno(stato, 'barista').length > 0;
}
// null se il prodotto si puo' vendere adesso, altrimenti il motivo
export function disponibile(stato, neg, prod) {
  const cfg = SCORTE[neg.id]; if (!cfg) return null;
  if ((cfg.alMomento || []).includes(prod[0])) return maniAlBanco(stato, neg.id) ? null : `${prod[0]}: non c'e' nessuno dietro il banco a prepararlo (serve chi e' al bancone o il barista in turno)`;
  return (scorteDi(stato, neg.id)[prod[0]] || 0) >= 1 ? null : `${prod[0]} e' finito: sugli scaffali non ce n'e' piu' (lo rifanno fornaio, pasticcere o fioraio in turno; al mattino arriva una piccola consegna)`;
}
export function togliScorta(stato, neg, prod) {
  const cfg = SCORTE[neg.id]; if (!cfg || (cfg.alMomento || []).includes(prod[0])) return;
  const S = scorteDi(stato, neg.id); S[prod[0]] = Math.max(0, (S[prod[0]] || 0) - 1);
}
function aggiungiScorte(stato, negozio, cose, fattore) {
  const S = scorteDi(stato, negozio), cfg = SCORTE[negozio], fatto = [];
  if (!S) return fatto;
  for (const [nome, n] of Object.entries(cose)) {
    const q = Math.floor(n * fattore + 1e-6); if (q < 1) continue;
    const max = Math.max(6, ((cfg.consegna || {})[nome] || 2) * SCORTE_MAX * 4);
    const prima = S[nome] || 0; S[nome] = Math.min(max, prima + q);
    if (S[nome] > prima) fatto.push(`${S[nome] - prima} ${nome}`);
  }
  return fatto;
}
// ogni mattina alle 6: il pane e i cornetti di ieri non si vendono piu', arriva la piccola consegna da fuori
export function consegnaMattino(stato, adesso) {
  const o = oraRomaParti(adesso);
  if (o.h < 6 || stato.consegna === o.giorno) return false;
  stato.consegna = o.giorno;
  for (const [id, cfg] of Object.entries(SCORTE)) {
    const S = scorteDi(stato, id);
    for (const f of cfg.freschi || []) S[f] = 0;
    for (const [nome, n] of Object.entries(cfg.consegna)) S[nome] = Math.min(n * SCORTE_MAX, (S[nome] || 0) + n);
  }
  return true;
}

/* ---------- la piazza che si sporca ---------- */
export function passoBorgo(stato, adesso, dtS) {
  const b = stato.borgo || (stato.borgo = { sporcizia: 20 });
  const o = oraRomaParti(adesso);
  if (o.h >= 7 && o.h < 23) b.sporcizia = Math.min(100, b.sporcizia + REGOLE_LAVORI.sporciziaOra * dtS / 3600);
  consegnaMattino(stato, adesso);
  // il muratore lavora nel cantiere aperto: il primo che c'e' (in ordine di lotto)
  const M = MESTIERI.muratore, aperto = Object.entries(stato.terreni || {}).find(([, t]) => t.progetto && !t.progetto.finito);
  if (aperto) { const l = lottoDi(aperto[0]), g = geometria(l, aperto[1].progetto.tipo); M.lotto = l.id; M.x = l.x; M.z = g.rect.z0 - 0.8; M.luogo = 'Cantiere di ' + aperto[1].progetto.nome + ' (' + l.id + ')'; }
  else { M.lotto = null; M.luogo = 'Cantiere'; }
}
export function descriviPiazza(stato) {
  const s = (stato.borgo || {}).sporcizia || 0;
  return s >= 75 ? 'La piazza e\' molto sporca: cartacce e foglie dappertutto (nessuno la pulisce da un po\').' : s >= 45 ? 'La piazza e\' un po\' sporca: qua e la\' ci sono cartacce.' : '';
}

/* ---------- chi e' in turno da dipendente adesso ---------- */
export function inTurno(stato, mestiere) {
  const l = [];
  for (const [id, c] of Object.entries((stato.vita && stato.vita.corpi) || {})) if (c.lavoro && c.lavoro.tipo === 'lavora' && c.lavoro.mestiere === mestiere && !c.morto) l.push(id);
  for (const [chi, d] of Object.entries(stato.dipendenti || {})) if (d.mestiere === mestiere) l.push(chi);
  return l;
}

/* ---------- l'effetto di un turno finito (ore di lavoro vero) ---------- */
// Restituisce la frase per il diario di chi ha lavorato (o '' se non ha prodotto niente).
export function effettoMestiere(stato, mestiere, ore, adesso, dati = {}) {
  if (!(ore > 0)) return '';
  if (PRODUZIONE[mestiere]) {
    const righe = [];
    for (const [neg, cose] of Object.entries(PRODUZIONE[mestiere])) {
      const f = aggiungiScorte(stato, neg, cose, ore);
      if (f.length) righe.push(`${f.join(', ')} per ${(NEGOZI.find(n => n.id === neg) || {}).nome || neg}`);
    }
    return righe.length ? 'Sugli scaffali hai messo: ' + righe.join('; ') + '.' : '';
  }
  if (mestiere === 'spazzino') {
    const b = stato.borgo || (stato.borgo = { sporcizia: 20 }), prima = b.sporcizia;
    b.sporcizia = Math.max(0, b.sporcizia - REGOLE_LAVORI.pulisceOra * ore);
    return `Hai pulito la piazza: sporcizia da ${Math.round(prima)} a ${Math.round(b.sporcizia)} su 100.`;
  }
  if (mestiere === 'giardiniere') {
    const a = (stato.vita && stato.vita.aiuole) || []; let n = 0;
    const quante = Math.min(a.length, Math.ceil(ore * 4));   // ~4 aiuole all'ora, cominciando da quelle piu' asciutte
    a.slice().sort((p, q) => (p.acqua || 0) - (q.acqua || 0)).slice(0, quante).forEach(q => { if (!q.morta) { q.acqua = Math.max(q.acqua || 0, 60); q.secco = 0; n++; } });
    return n ? `Hai annaffiato ${n} aiuole del borgo.` : '';
  }
  if (mestiere === 'facchino') {
    const m = stato.vita && stato.vita.mercato; if (!m) return '';
    const f = [];
    for (const [k, [, arriva]] of Object.entries(LISTINO)) if (arriva > 0) { const q = Math.round(arriva * 0.12 * ore * 100) / 100; if (q > 0) { m.scorte[k] = Math.min(arriva * 4, (m.scorte[k] || 0) + q); f.push(k); } }
    return f.length ? `Hai scaricato le casse: piu' ${f.slice(0, 4).join(', ')} nella Dispensa del Mercatino.` : '';
  }
  if (mestiere === 'muratore') {
    const t = dati.lotto && (stato.terreni || {})[dati.lotto], p = t && t.progetto;
    if (!p || p.finito) return '';
    const prima = p.fatte; p.fatte = Math.min(p.ore, Math.round((p.fatte + ore) * 1000) / 1000);
    if (p.fatte >= p.ore) p.finito = adesso;
    return `Nel cantiere di "${p.nome}" hai fatto ${Math.round((p.fatte - prima) * 10) / 10} ore di lavoro: ${Math.round(p.fatte)} su ${p.ore}.` + (p.finito ? ' Il cantiere e\' FINITO!' : '');
  }
  return '';
}

/* ---------- l'Ambulatorio ---------- */
export function ambulatorioAperto(adesso) {
  const R = REGOLE_LAVORI, o = oraRomaParti(adesso), g = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 })[new Date(adesso).toLocaleString('en-GB', { timeZone: 'Europe/Rome', weekday: 'short' })];
  return R.giorniAmbulatorio.includes(g) && R.orariAmbulatorio.some(([a, b]) => o.h >= a && o.h < b);
}
export const durataVisita = stato => (inTurno(stato, 'segretario').length ? REGOLE_LAVORI.visitaConSegretarioMin : REGOLE_LAVORI.visitaMin);
// la visita della Dottoressa Ferri: le malattie guariscono molto prima (la cura giusta), il dolore passa
export function visitaMedica(stato, chi, adesso) {
  const c = stato.vita && stato.vita.corpi[chi];
  if (!c) return 'La Dottoressa Ferri ti visita: stai bene.';
  if (!(c.malattie || []).length) return `La Dottoressa Ferri ti visita: non hai niente. Salute ${Math.round(c.salute)} su 100, temperatura ${c.temperatura.toFixed(1)} gradi.` + (c.salute < 80 ? ' Ti dice di mangiare, bere e dormire bene.' : '');
  const cure = { parassiti: 'un antiparassitario', gastroenterite: 'sali minerali e riposo', fitoemoagglutinina: 'un antiemetico e tanta acqua', cibo_guasto: 'fermenti e tanta acqua' };
  const fatte = c.malattie.map(m => { const resta = Math.max(0, m.fino - adesso); m.fino = adesso + Math.min(resta, Math.max(2 * 3600000, resta / 4)); m.gravita = (m.gravita || 1) / 2; return `${m.tipo.replace('_', ' ')}: ${cure[m.tipo] || 'una cura'}`; });
  return `La Dottoressa Ferri ti ha visitato e curato (${fatte.join('; ')}): guarirai molto prima. Salute ${Math.round(c.salute)} su 100.`;
}

/* ---------- una persona vera fa un turno da dipendente dal gioco ---------- */
// on = true inizia o conferma (ping ogni 90 s), false smette. Il turno dura 20 minuti; si paga il tempo davvero lavorato.
export function giocatoreDipendente(stato, chi, nome, d, adesso) {
  const R = REGOLE_LAVORI, D = stato.dipendenti || (stato.dipendenti = {});
  const M = MESTIERI[d.mestiere];
  if (d.on === false || d.fine) return fineDipendente(stato, chi, adesso, d.fine ? 'turno finito' : 'hai smesso');
  if (!M) return { ok: false, motivo: 'Mestiere sconosciuto.' };
  if (D[chi] && D[chi].mestiere !== d.mestiere) fineDipendente(stato, chi, adesso, 'hai cambiato lavoro');
  if (!D[chi]) {
    const o = oraRomaParti(adesso);
    if (o.h < M.dalle || o.h >= M.alle) return { ok: false, motivo: `${M.luogo} cerca un ${M.nome} solo dalle ${M.dalle} alle ${M.alle} (ora di Roma).` };
    if (d.mestiere === 'muratore' && !M.lotto) return { ok: false, motivo: 'Nel borgo non c\'e\' nessun cantiere aperto.' };
    if (M.giorni) { const g = ({ Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 })[new Date(adesso).toLocaleString('en-GB', { timeZone: 'Europe/Rome', weekday: 'short' })]; if (!M.giorni.includes(g)) return { ok: false, motivo: 'Si lavora solo dal lunedi\' al sabato.' }; }
    if (inTurno(stato, d.mestiere).length >= M.posti) return { ok: false, motivo: `Il posto di ${M.nome} e' gia' occupato.` };
    D[chi] = { mestiere: d.mestiere, nome, inizio: adesso, fine: adesso + R.turnoGiocatoreMin * 60000, lotto: M.lotto || null };
  }
  D[chi].ping = adesso;
  return { ok: true, fine: D[chi].fine, mestiere: d.mestiere };
}
export function fineDipendente(stato, chi, adesso, perche) {
  const D = stato.dipendenti || {}, t = D[chi];
  if (!t) return { ok: true, paga: 0 };
  delete D[chi];
  const min = Math.max(0, Math.min(adesso, t.fine) - t.inizio) / 60000;
  const effetto = effettoMestiere(stato, t.mestiere, min / 60, adesso, { lotto: t.lotto });
  return { ok: true, paga: Math.round(min * REGOLE_LAVORI.pagaGiocatoreMin), minuti: Math.round(min), effetto, perche };
}
// i turni delle persone vere che non rispondono piu' (telefono chiuso) finiscono da soli; quelli scaduti anche
export function passoDipendenti(stato, adesso) {
  const fatti = [];
  for (const [chi, t] of Object.entries(stato.dipendenti || {})) {
    if (adesso > t.fine + 5 * 60000 || adesso - (t.ping || t.inizio) > REGOLE_LAVORI.pingGiocatoreMs) fatti.push(Object.assign({ chi }, fineDipendente(stato, chi, Math.min(adesso, t.ping || adesso), 'non c\'eri piu\'')));
  }
  return fatti;
}
export function vistaLavori(stato, adesso) {
  return {
    sporcizia: Math.round((stato.borgo || {}).sporcizia || 0),
    scorte: stato.scorte || {},
    ambulatorio: { aperto: ambulatorioAperto(adesso), visitaMin: durataVisita(stato), prezzo: REGOLE_LAVORI.prezzoVisita },
    mestieri: Object.fromEntries(Object.entries(MESTIERI).map(([k, m]) => [k, { nome: m.nome, luogo: m.luogo, stanza: m.stanza || null, dalle: m.dalle, alle: m.alle, giorni: m.giorni || null, paga: m.paga, posti: m.posti,
      descrizione: m.descrizione, occupati: inTurno(stato, k).length, aperto: k !== 'muratore' || !!m.lotto }])),
    pagaGiocatoreMin: REGOLE_LAVORI.pagaGiocatoreMin, turnoGiocatoreMin: REGOLE_LAVORI.turnoGiocatoreMin
  };
}
