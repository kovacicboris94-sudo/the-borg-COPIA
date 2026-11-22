// =====================================================================
//  LA BANCA DEL BORGO: mutui per la casa e prestiti, come in una banca vera
//  Chiesto da Boris il 22/11/2026 ("metti una banca dove puoi chiedere prestiti",
//  "dev'essere come nella realta'"). Vale uguale per le persone vere e per gli
//  abitanti IA (Ada, Teo...).
//
//  Il tempo del borgo: UNA RATA AL GIORNO, e ogni rata vale un mese. Chi gioca
//  guadagna in una giornata di gioco circa uno stipendio (vedi terreni.mjs),
//  quindi un mutuo di 240 rate e' un mutuo "di 20 anni" e gli interessi si
//  contano al mese (tasso annuo / 12 per ogni rata).
//
//  - MUTUO: per comprare un terreno e costruirci (casa, villa o negozio) o per
//    un appartamento nella Torre. La banca presta al massimo l'80%: il 20% (o
//    di piu') lo metti tu, l'anticipo. Tasso fisso 4% all'anno, rate tutte
//    uguali (ammortamento "alla francese": all'inizio paghi piu' interessi,
//    poi piu' capitale). Durata 60, 120 o 240 rate.
//  - PRESTITO PERSONALE: da 200 a 5.000 Starlight, senza ipoteca, tasso 9%,
//    12, 24 o 36 rate. Uno alla volta.
//  - LE RATE: per gli abitanti IA la banca le prende da sola dal conto ogni
//    giorno (addebito automatico). Per le persone vere le rate scadono ogni giorno
//    anche quando non giocano (Boris: "cosi' la gente e' invogliata a giocare"):
//    appena entrano il gioco paga da solo quelle scadute, se hanno gli Starlight.
//    Chi sta via 10 giorni senza pagare perde la casa.
//  - SE NON PAGHI: sulla rata scaduta corrono gli interessi di mora (8% annuo).
//    Dopo 3 rate non pagate arriva la lettera di sollecito. Dopo 10 rate non
//    pagate: per il mutuo la banca PIGNORA la casa e la mette all'asta al 70%
//    del valore; con il ricavato chiude il debito, se avanza qualcosa te lo da',
//    se non basta il resto lo devi ancora e sei segnalato come cattivo pagatore.
//    Per il prestito: devi tutto subito e sei segnalato. Chi e' segnalato non
//    riceve altri prestiti finche' non ha pagato tutto.
//  - ESTINZIONE ANTICIPATA: puoi restituire prima quando vuoi, senza penali; la
//    rata si ricalcola sul debito che resta.
// =====================================================================
import { lottoDi, compraLotto, avviaCantiere, costoProgetto, terrenoDi, tipoDi, genereDi, GENERI, UN, appartamentoDato, compraAppartamento, immobileDi, valoreImmobile, mettiAllAsta, prezzoLotto, prezzoAppartamento } from './terreni.mjs';

export const REGOLE_BANCA = {
  anticipoMin: 0.2,              // la banca presta al massimo l'80% del valore
  tanMutuo: 0.04,                // tasso annuo fisso del mutuo
  durateMutuo: [60, 120, 240],   // rate (una al giorno, ognuna vale un mese: 5, 10, 20 "anni")
  tanPrestito: 0.09,
  prestitoMin: 200, prestitoMax: 5000,
  duratePrestito: [12, 24, 36],
  tanMora: 0.08,                 // interessi di mora sulle rate non pagate
  rateSollecito: 3,              // dopo 3 rate non pagate: lettera
  ratePignoramento: 10,          // dopo 10: pignoramento (mutuo) o decadenza (prestito)
  astaQuota: 0.7,                // all'asta la casa si vende al 70% del valore
  periodoMs: 864e5               // una rata ogni 24 ore, per tutti (anche per chi non gioca: Boris, 22/11/2026)
};
const R = REGOLE_BANCA;
// l'edificio della banca, in piazza a sud del laghetto: la porta guarda a nord; chi ci va si ferma allo sportello davanti
export const BANCA = { nome: 'Banca del Borgo', x: 32, z: 48, w: 8, d: 6, porta: { x: 32, z: 44.1 }, sportello: { x: 32, z: 43.2 } };
const tondo = n => Math.round(n * 100) / 100;

// rata costante (alla francese): P * i / (1 - (1 + i)^-n), con i = tasso mensile
export function rataFrancese(P, tan, n) { const i = tan / 12; return n <= 0 ? P : i ? P * i / (1 - Math.pow(1 + i, -n)) : P / n; }
// il piano completo, per spiegarlo: totale da restituire e interessi
export function pianoMutuo(P, tan, n) { const r = tondo(rataFrancese(P, tan, n)); return { rata: r, totale: tondo(r * n), interessi: tondo(r * n - P) }; }
const durataVicina = (d, lista) => lista.reduce((a, b) => Math.abs(b - d) < Math.abs(a - d) ? b : a, lista[lista.length - 1]);

const conti = stato => (stato.banca || (stato.banca = { conti: {} })).conti;
export function contoDi(stato, chi, nome) {
  const C = conti(stato);
  return C[chi] || (C[chi] = { nome: String(nome || chi).slice(0, 20), vero: chi.indexOf('g:') === 0, prestiti: [], segnalato: false, accredito: 0, storia: [] });
}
const nota = (c, t, s) => { c.storia.push({ t, s }); if (c.storia.length > 12) c.storia.shift(); };
export const mutuoDi = (stato, chi) => { const c = conti(stato)[chi]; return c ? c.prestiti.find(p => p.tipo === 'mutuo') || null : null; };
const rateInsolute = L => L.scaduto > 0.5 ? Math.max(1, Math.round(L.scaduto / L.rata)) : 0;

function nuovoPrestito(tipo, capitale, tan, n, adesso, periodo, extra) {
  return Object.assign({ id: tipo[0] + adesso.toString(36), tipo, capitale: tondo(capitale), residuo: tondo(capitale), tan, n, pagate: 0, rata: tondo(rataFrancese(capitale, tan, n)), inizio: adesso, prossima: adesso + periodo, scaduto: 0, sollecito: false, decaduto: false }, extra || {});
}

// scade una rata: gli interessi del mese sul debito che resta, il resto riduce il capitale
function maturaRata(L) {
  if (L.scaduto > 0.5) L.scaduto = tondo(L.scaduto * (1 + R.tanMora / 12));   // mora sulle rate vecchie non pagate
  if (L.decaduto || L.residuo <= 0) return;
  const interessi = L.residuo * L.tan / 12, ultima = L.pagate + 1 >= L.n;
  const capitale = ultima ? L.residuo : Math.min(L.residuo, L.rata - interessi);
  L.residuo = tondo(L.residuo - capitale); L.pagate++;
  L.scaduto = tondo(L.scaduto + capitale + interessi);
}

// paga le rate scadute (prima le piu' vecchie); restituisce quanto ha usato
function pagaScaduto(c, soldi) {
  let usati = 0;
  for (const L of c.prestiti) { if (soldi - usati < 0.01) break; const p = Math.min(L.scaduto, soldi - usati); L.scaduto = tondo(L.scaduto - p); usati += p; }
  return tondo(usati);
}

// dopo i pagamenti: lettere, pignoramenti, prestiti chiusi. Restituisce cosa e' successo (per il diario degli agenti)
function controlla(stato, chi, c, adesso) {
  const fatti = [];
  for (const L of c.prestiti.slice()) {
    const k = rateInsolute(L);
    if (k === 0) L.sollecito = false;
    if (k >= R.rateSollecito && !L.sollecito && !L.decaduto) {
      L.sollecito = true;
      const s = `Lettera della banca: hai ${k} rate non pagate del ${L.tipo === 'mutuo' ? 'mutuo' : 'prestito'} (${tondo(L.scaduto)} Starlight). Se arrivi a ${R.ratePignoramento} rate non pagate ` + (L.tipo === 'mutuo' ? 'la banca pignora la casa e la mette all\'asta.' : 'dovrai restituire tutto subito e sarai segnalato come cattivo pagatore.');
      nota(c, adesso, s); fatti.push({ chi, tipo: 'sollecito', testo: s });
    }
    if (k >= R.ratePignoramento && L.tipo === 'mutuo') {
      const valore = valoreImmobile(stato, L.bene), asta = Math.round(valore * R.astaQuota), debito = tondo(L.residuo + L.scaduto);
      const im = immobileDi(stato, chi), nomeBene = im ? im.nome : L.bene;
      mettiAllAsta(stato, L.bene, asta, adesso);
      c.prestiti.splice(c.prestiti.indexOf(L), 1);
      const avanza = Math.max(0, tondo(asta - debito)), manca = Math.max(0, tondo(debito - asta));
      if (manca > 0) { c.prestiti.push(Object.assign(nuovoPrestito('debito', 0, 0, 1, adesso, R.periodoMs), { residuo: 0, scaduto: manca, decaduto: true, rata: manca })); c.segnalato = true; }
      const s = `PIGNORAMENTO: dopo ${k} rate non pagate la banca si e' presa ${nomeBene} e l'ha messa all'asta a ${asta} Starlight (il 70% del valore). Il mutuo e' chiuso (dovevi ${debito}).` + (avanza ? ` Ti restituisce quello che avanza: ${avanza} Starlight.` : '') + (manca ? ` Non basta: devi ancora ${manca} Starlight e sei segnalato come cattivo pagatore.` : '');
      nota(c, adesso, s); fatti.push({ chi, tipo: 'pignoramento', testo: s, accredito: avanza, bene: L.bene });
      if (avanza) c.accredito = tondo(c.accredito + avanza);
      continue;
    }
    if (k >= R.ratePignoramento && L.tipo === 'prestito' && !L.decaduto) {
      L.scaduto = tondo(L.scaduto + L.residuo); L.residuo = 0; L.decaduto = true; c.segnalato = true;
      const s = `La banca ha chiuso il prestito per ${k} rate non pagate: devi restituire subito tutto (${L.scaduto} Starlight) e sei segnalato come cattivo pagatore.`;
      nota(c, adesso, s); fatti.push({ chi, tipo: 'decaduto', testo: s });
    }
    if (L.residuo < 0.01 && L.scaduto < 0.01) {
      c.prestiti.splice(c.prestiti.indexOf(L), 1);
      const s = L.tipo === 'mutuo' ? 'Mutuo finito di pagare: la casa e\' tutta tua!' : L.tipo === 'prestito' ? 'Prestito restituito tutto.' : 'Debito con la banca pagato.';
      nota(c, adesso, s); fatti.push({ chi, tipo: 'estinto', testo: s });
    }
  }
  if (c.segnalato && !c.prestiti.some(L => L.decaduto)) c.segnalato = false;
  return fatti;
}

// Ogni passo del borgo: per gli abitanti IA scadono le rate e la banca le prende dal conto.
// soldiDi(chi) -> l'oggetto con .starlight (il portafoglio dell'agente). Restituisce i fatti da raccontare.
export function passoBanca(stato, adesso, soldiDi) {
  const fatti = [];
  for (const [chi, c] of Object.entries(conti(stato))) {
    if (!c.prestiti.length) continue;
    // le persone vere: le rate scadono anche quando non giocano (le paga il gioco appena entrano, se hanno gli Starlight)
    const w = c.vero ? null : soldiDi(chi); if (!c.vero && !w) continue;
    let nuove = 0;
    for (const L of c.prestiti) while (L.prossima <= adesso && nuove < 50) { maturaRata(L); L.prossima += R.periodoMs; nuove++; }
    const dovuto = c.prestiti.reduce((a, L) => a + L.scaduto, 0);
    if (w && dovuto > 0.005 && w.starlight > 0.005) {
      // come un addebito vero: si prendono solo rate intere (o tutto il dovuto), cosi' non si resta a zero per un pezzetto di rata
      const intere = c.prestiti.reduce((a, L) => a + (L.scaduto > 0 ? Math.min(L.scaduto, Math.floor(w.starlight / Math.max(1, L.rata)) * L.rata) : 0), 0);
      const usati = pagaScaduto(c, w.starlight >= dovuto ? dovuto : Math.min(w.starlight, intere));
      if (usati > 0) { w.starlight = tondo(w.starlight - usati); if (nuove) fatti.push({ chi, tipo: 'addebito', testo: `La banca ha preso dal tuo conto ${usati} Starlight per le rate.` }); }
    }
    if (nuove || dovuto > 0) for (const f of controlla(stato, chi, c, adesso)) {
      if (f.accredito && w) { w.starlight = tondo(w.starlight + f.accredito); c.accredito = 0; }
      fatti.push(f);
    }
  }
  return fatti;
}

// Per le persone vere, quando entrano: scadono tutte le rate arretrate (di solito le ha gia' fatte scadere passoBanca)
export function maturaGiocatore(stato, chi, adesso) {
  const c = conti(stato)[chi]; if (!c) return [];
  let nuove = 0;
  for (const L of c.prestiti) while (L.prossima <= adesso && nuove < 400) { maturaRata(L); L.prossima += R.periodoMs; nuove++; }
  return nuove ? controlla(stato, chi, c, adesso) : [];
}

/* ---------- chiedere un mutuo ----------
   d = { bene: 'lotto3' | 'piano 7', progetto: 'casa'|'villa'|'negozio' (per un terreno), genere, nome, anticipo, durata }
   soldi = quanti Starlight ha chi lo chiede. Se va bene: compra e (per un terreno) apre il cantiere; spesa = l'anticipo pagato. */
export function chiediMutuo(stato, chi, nomeChi, d, soldi, adesso) {
  const c = contoDi(stato, chi, nomeChi);
  if (c.segnalato) return { ok: false, motivo: 'La banca dice di no: sei segnalato come cattivo pagatore finche\' non restituisci quello che devi.' };
  if (mutuoDi(stato, chi)) return { ok: false, motivo: 'Hai gia\' un mutuo: se ne puo\' avere uno solo.' };
  const app = /piano|appart|torre/i.test(String(d.bene || '')) ? appartamentoDato(d.bene) : null;
  const l = app ? null : lottoDi(d.bene);
  if (!app && !l) return { ok: false, motivo: 'Per cosa chiedi il mutuo? Un terreno (lotto1...lotto6) con quello che ci costruisci, o un appartamento della Torre (piano 1...15).' };
  let valore, tipo = null, genere = null, mioLotto = false, asta = null;
  if (app) {
    if ((stato.appartamenti || {})[app.id]) return { ok: false, motivo: `${app.nome} e' gia' venduto.` };
    if (immobileDi(stato, chi)) return { ok: false, motivo: 'Hai gia\' una proprieta\': se ne puo\' avere una sola.' };
    valore = prezzoAppartamento(stato, app.id);
  } else {
    const mio = terrenoDi(stato, chi);
    mioLotto = !!(mio && mio[0] === l.id);
    asta = (stato.aste || {})[l.id];
    if (!mioLotto && (stato.terreni || {})[l.id]) return { ok: false, motivo: `${l.nome} e' gia' venduto.` };
    if (!mioLotto && immobileDi(stato, chi)) return { ok: false, motivo: 'Hai gia\' una proprieta\': se ne puo\' avere una sola.' };
    if (mioLotto && mio[1].progetto) return { ok: false, motivo: 'Sul tuo terreno c\'e\' gia\' una costruzione: il mutuo si chiede per comprare o per costruire.' };
    const conCasa = asta && asta.progetto;
    if (!conCasa) {
      tipo = tipoDi(d.progetto);
      if (!tipo) return { ok: false, motivo: 'La banca presta per il terreno insieme a cosa ci costruisci: casa, villa o negozio.' };
      if (tipo === 'negozio') { genere = genereDi(d.genere); if (!genere) return { ok: false, motivo: 'Che cosa vendera\' il negozio? ' + Object.keys(GENERI).join(', ') + '.' }; }
    }
    valore = (mioLotto ? 0 : prezzoLotto(stato, l.id)) + (tipo ? costoProgetto(tipo) : 0);
  }
  const minimo = Math.ceil(valore * R.anticipoMin);
  const anticipo = Math.min(valore, Math.max(minimo, Math.round(+d.anticipo || 0)));
  if (soldi != null && soldi < anticipo) return { ok: false, motivo: `Serve un anticipo di almeno ${minimo} Starlight (il 20% di ${valore}): ne hai ${Math.floor(soldi)}. La banca presta al massimo l'80%.` };
  const capitale = valore - anticipo;
  if (capitale < 100) return { ok: false, motivo: 'Paghi quasi tutto tu: non ti serve un mutuo, compra in contanti.' };
  const n = durataVicina(+d.durata || 240, R.durateMutuo);
  // tutto a posto: si compra, la banca paga il venditore e l'impresa
  let r, nomeBene;
  if (app) { r = compraAppartamento(stato, chi, nomeChi, app.id, null, adesso); nomeBene = app.nome; }
  else {
    if (!mioLotto) { r = compraLotto(stato, chi, nomeChi, l.id, null, adesso); if (!r.ok) return r; }
    if (tipo) { r = avviaCantiere(stato, chi, { tipo, nome: d.nome, genere }, null, adesso); }
    nomeBene = l.nome;
  }
  if (!r || !r.ok) return r || { ok: false, motivo: 'Non si puo\'.' };
  const L = nuovoPrestito('mutuo', capitale, R.tanMutuo, n, adesso, R.periodoMs, { bene: app ? app.id : l.id, valore });
  c.prestiti.push(L);
  const pi = pianoMutuo(capitale, R.tanMutuo, n);
  nota(c, adesso, `Mutuo di ${capitale} Starlight per ${nomeBene}${tipo ? ' (' + UN[tipo] + ')' : ''}: anticipo ${anticipo}, ${n} rate da ${L.rata}, in tutto restituisci ${pi.totale} (${pi.interessi} di interessi).`);
  return { ok: true, spesa: anticipo, anticipo, capitale, valore, rata: L.rata, durata: n, totale: pi.totale, interessi: pi.interessi, bene: L.bene, nomeBene, tipo, nome: r.nome, fine: r.fine, lotto: l ? l.id : null, appartamento: app ? app.id : null };
}

// Prestito personale: i soldi arrivano subito (accredito)
export function chiediPrestito(stato, chi, nomeChi, importo, durata, adesso) {
  const c = contoDi(stato, chi, nomeChi);
  if (c.segnalato) return { ok: false, motivo: 'La banca dice di no: sei segnalato come cattivo pagatore finche\' non restituisci quello che devi.' };
  if (c.prestiti.some(L => L.tipo === 'prestito')) return { ok: false, motivo: 'Hai gia\' un prestito in corso: prima finisci di pagarlo.' };
  const P = Math.round(+importo || 0);
  if (!(P >= R.prestitoMin && P <= R.prestitoMax)) return { ok: false, motivo: `Un prestito va da ${R.prestitoMin} a ${R.prestitoMax} Starlight.` };
  const n = durataVicina(+durata || 24, R.duratePrestito);
  const L = nuovoPrestito('prestito', P, R.tanPrestito, n, adesso, R.periodoMs);
  c.prestiti.push(L);
  const pi = pianoMutuo(P, R.tanPrestito, n);
  nota(c, adesso, `Prestito di ${P} Starlight: ${n} rate da ${L.rata}, in tutto restituisci ${pi.totale}.`);
  return { ok: true, accredito: P, rata: L.rata, durata: n, totale: pi.totale, interessi: pi.interessi };
}

// Pagare: prima le rate scadute, poi (se avanza e soloScaduto e' falso) si restituisce in anticipo, prima il prestito (costa di piu').
export function rimborsa(stato, chi, importo, soldi, adesso, soloScaduto) {
  const c = conti(stato)[chi];
  if (!c || !c.prestiti.length) return { ok: false, motivo: 'Non hai debiti con la banca.' };
  let resto = Math.min(+importo || 0, soldi == null ? Infinity : soldi);
  if (!(resto > 0)) return { ok: false, motivo: 'Quanto vuoi restituire?' };
  const prima = resto;
  resto = tondo(resto - pagaScaduto(c, resto));
  if (!soloScaduto) for (const L of c.prestiti.slice().sort((a, b) => b.tan - a.tan)) {
    if (resto < 0.01 || L.residuo <= 0) continue;
    const p = Math.min(L.residuo, resto); L.residuo = tondo(L.residuo - p); resto = tondo(resto - p);
    const restano = L.n - L.pagate; if (L.residuo > 0 && restano > 0) L.rata = tondo(rataFrancese(L.residuo, L.tan, restano));
  }
  const spesa = tondo(prima - resto);
  if (spesa <= 0) return { ok: false, motivo: 'Non c\'e\' niente da pagare adesso: la prossima rata non e\' ancora scaduta.' };
  const fatti = controlla(stato, chi, c, adesso);
  return { ok: true, spesa, fatti, debito: debitoDi(stato, chi) };
}
export const debitoDi = (stato, chi) => { const c = conti(stato)[chi]; return c ? tondo(c.prestiti.reduce((a, L) => a + L.residuo + L.scaduto, 0)) : 0; };

// quello che si vede del conto (per il gioco e per l'agente stesso)
export function vistaConto(stato, chi) {
  const c = conti(stato)[chi];
  if (!c) return { prestiti: [], segnalato: false, debito: 0, storia: [] };
  return { nome: c.nome, segnalato: c.segnalato, debito: debitoDi(stato, chi), storia: c.storia.slice(-6),
    prestiti: c.prestiti.map(L => ({ tipo: L.tipo, bene: L.bene || null, capitale: L.capitale, residuo: L.residuo, rata: L.rata, n: L.n, pagate: L.pagate, tan: L.tan, scaduto: L.scaduto, insolute: rateInsolute(L), prossima: L.prossima, decaduto: L.decaduto })) };
}
// per gli spettatori: i conti degli abitanti IA (le persone vere vedono solo il proprio)
export function vistaBanca(stato) {
  return { edificio: BANCA, regole: { anticipoMin: R.anticipoMin, tanMutuo: R.tanMutuo, durateMutuo: R.durateMutuo, tanPrestito: R.tanPrestito, prestitoMin: R.prestitoMin, prestitoMax: R.prestitoMax, duratePrestito: R.duratePrestito, tanMora: R.tanMora, rateSollecito: R.rateSollecito, ratePignoramento: R.ratePignoramento, astaQuota: R.astaQuota },
    abitanti: Object.entries(conti(stato)).filter(([, c]) => !c.vero && (c.prestiti.length || c.storia.length)).map(([chi, c]) => Object.assign({ id: chi }, vistaConto(stato, chi))) };
}
