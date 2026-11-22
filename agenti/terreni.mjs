// =====================================================================
//  TERRENI DEL BORGO: comprare un lotto e costruirci una casa o un negozio
//  Chiesto da Boris il 21/11/2026: "la possibilita' di comprare un terreno e
//  costruire una casa o negozio". Vale per tutti: le persone vere (dal gioco)
//  e gli abitanti IA (Ada, Teo e chi verra'), con le stesse regole.
//
//  - Il borgo mette in vendita pochi lotti recintati, in posti liberi della
//    piazza (lato sud vicino alle casette, e due file a nord-ovest e nord-est).
//  - Una sola proprieta' a testa (un terreno o un appartamento nella Torre). Si paga in
//    Starlight, tutto subito oppure con il mutuo della Banca del Borgo (agenti/banca.mjs).
//  - Sul lotto si puo' costruire anche una villa, piu' grande e cara (22/11/2026).
//  - Sul proprio lotto si costruisce UNA cosa: una casa o un negozio.
//    La costruisce un'impresa del borgo: si paga prima (materiali + operai) e
//    il cantiere va avanti solo nelle ore di lavoro (dal lunedi' al sabato,
//    dalle 8 alle 17, ora di Roma), come un cantiere vero.
//  - Casa finita: per un abitante IA diventa la sua casa (ci si trasferisce:
//    la casetta del borgo resta vuota); per una persona vera e' l'ingresso
//    in piazza della sua casa del gioco, col suo nome sopra.
//  - Negozio finito: ha un bancone davanti, come Caffetteria, Forno e Fioraio.
//    Ci lavora solo chi ne e' proprietario: i clienti (gli abitanti demo)
//    arrivano e si convincono come negli altri negozi, ma il proprietario
//    tiene l'80% del prezzo (il resto e' la merce che ha comprato).
//  Tutti i numeri stanno qui: si cambiano in un posto solo.
//  Prezzi (Boris 22/11/2026: "la gente normale guadagna 1600 euro e una casa o un negozio costa
//  almeno 100.000"): un terreno con la casa o il negozio costa circa 60 stipendi. Nel borgo uno
//  "stipendio" e' quello che chi gioca guadagna in una giornata di gioco (~500 Starlight), quindi
//  100.000 euro = ~31.000 Starlight. Gli operai sono pagati come nel resto del borgo (30 S l'ora).
// =====================================================================

// x, z = centro del lotto; il lotto e' largo 8 m (x) e profondo 10 m (z).
// La casa o il negozio sta nella meta' dietro (verso sud), con la porta che guarda a nord;
// davanti resta il cortile con il bancone (per un negozio).
export const LOTTI = [
  { id: 'lotto1', nome: 'Lotto 1, accanto alla Porta del Borgo (ovest)', x: -10, z: 62, prezzo: 11000 },
  { id: 'lotto2', nome: 'Lotto 2, accanto alla Porta del Borgo (est)', x: 10, z: 62, prezzo: 11000 },
  { id: 'lotto3', nome: 'Lotto 3, lato sud verso il Fioraio', x: 35, z: 62, prezzo: 10000 },
  { id: 'lotto4', nome: 'Lotto 4, nord-ovest verso la Torre', x: -32, z: 13, prezzo: 9000 },
  { id: 'lotto5', nome: 'Lotto 5, nord-ovest dietro il Mercatino', x: -22, z: 13, prezzo: 10000 },
  { id: 'lotto6', nome: 'Lotto 6, nord-est verso la Ruota', x: 20, z: 13, prezzo: 10000 }
];
export const LOTTO = { w: 8, d: 10, edW: 5.6, edD: 5 };
// la villa e' piu' grande: occupa quasi tutto il fondo del lotto (e davanti c'e' la piscinetta)
export const EDIFICIO = { casa: { w: 5.6, d: 5 }, negozio: { w: 5.6, d: 5 }, villa: { w: 7.2, d: 6 } };

// Cosa si puo' costruire. costo = materiali + operai (paga del borgo); ore = ore di cantiere (dalle 8 alle 17, lun-sab).
export const PROGETTI = {
  casa: { nome: 'Casa', ore: 72, operai: 2, materiali: 18000, pagaOra: 30, descr: 'casetta in muratura di 28 m2 con il tetto di tegole' },
  villa: { nome: 'Villa', ore: 120, operai: 3, materiali: 40000, pagaOra: 30, descr: 'villa di 43 m2 su due piani, rifinita bene, con la piscinetta in giardino' },
  negozio: { nome: 'Negozio', ore: 54, operai: 2, materiali: 19100, pagaOra: 30, descr: 'bottega di 28 m2 con vetrine, insegna e un bancone davanti' }
};
export const costoProgetto = t => { const p = PROGETTI[t]; return p ? p.materiali + p.ore * p.operai * p.pagaOra : 0; };

// Che cosa vende un negozio nuovo: lo sceglie chi lo costruisce. Stesso formato di negozi.mjs: [nome, prezzo, gusti].
export const GENERI = {
  bar: { nome: 'Bar', icona: '☕', prodotti: [['Caffe\'', 6, 'caffe'], ['Cappuccino', 9, 'caffe dolci'], ['Cornetto', 8, 'dolci'], ['Spremuta', 9, 'sano fresco'], ['Panino', 12, 'salato'], ['Tramezzino', 10, 'salato']] },
  forno: { nome: 'Panetteria', icona: '🥖', prodotti: [['Pane', 5, 'pane'], ['Focaccia', 9, 'pane salato'], ['Pizza al taglio', 14, 'salato'], ['Biscotti', 12, 'dolci'], ['Pane integrale', 7, 'pane sano'], ['Ciambella', 10, 'dolci']] },
  fiori: { nome: 'Fiori e piante', icona: '💐', prodotti: [['Rosa', 8, 'fiori regalo'], ['Tulipano', 9, 'fiori'], ['Mazzo di fiori', 35, 'fiori regalo'], ['Pianta grassa', 20, 'piante'], ['Basilico', 6, 'piante sano fresco'], ['Orchidea', 45, 'fiori regalo piante']] },
  dolci: { nome: 'Pasticceria', icona: '🧁', prodotti: [['Pasticcino', 4, 'dolci'], ['Cannolo', 9, 'dolci'], ['Tiramisu\'', 14, 'dolci'], ['Gelato', 8, 'dolci fresco'], ['Torta intera', 40, 'dolci regalo'], ['Cioccolatino', 3, 'dolci regalo']] },
  alimentari: { nome: 'Alimentari', icona: '🧺', prodotti: [['Frutta di stagione', 7, 'sano fresco'], ['Formaggio', 15, 'salato'], ['Prosciutto', 18, 'salato'], ['Uova', 6, 'fresco'], ['Olio buono', 25, 'sano regalo'], ['Marmellata', 11, 'dolci regalo']] },
  bottega: { nome: 'Bottega artigiana', icona: '🏺', prodotti: [['Vaso di argilla', 25, 'regalo'], ['Candela', 10, 'regalo'], ['Sciarpa di lana', 30, 'regalo caldo'], ['Cartolina del borgo', 3, 'regalo'], ['Lanterna', 35, 'regalo'], ['Statuina', 45, 'regalo']] }
};
// Come lo vuoi (Boris 22/11/2026: "non puoi scegliere la tua insegna... come sara' strutturato, i prezzi"):
// i colori della facciata (6 tavolozze, le disegna src/borgo/terreni.js), lo stile dell'insegna, l'arredo dentro
// e il listino: i prezzi li decide il proprietario, tra la meta' e il triplo del prezzo normale del borgo.
export const INSEGNE = { legno: 'Legno e oro', neon: 'Neon', lavagna: 'Lavagna', pastello: 'Pastello', nera: 'Nera elegante' };
export const ARREDI = { rustico: 'Rustico (legno e cotto)', moderno: 'Moderno (bianco e piastrelle)', elegante: 'Elegante (marmo e ottone)' };
export const PREZZO_MIN = 0.5, PREZZO_MAX = 3;
export function listinoDi(genere, prezzi) {
  const g = GENERI[genere] || GENERI.bottega;
  return g.prodotti.map(q => { const v = prezzi && +prezzi[q[0]]; return [q[0], v > 0 ? Math.max(1, Math.round(Math.min(q[1] * PREZZO_MAX, Math.max(q[1] * PREZZO_MIN, v)))) : q[1], q[2], q[1]]; });   // [nome, prezzo del proprietario, gusti, prezzo normale del borgo]
}
const scelta = (v, lista, def) => Object.prototype.hasOwnProperty.call(lista, v) ? v : def;
export const UN = { casa: 'una casa', villa: 'una villa', negozio: 'un negozio' };
export const tipoDi = n => { const s = String(n || '').toLowerCase(); return s.includes('vill') ? 'villa' : s.includes('neg') || s.includes('bottega') ? 'negozio' : s.includes('cas') ? 'casa' : null; };
export const abitazione = tipo => tipo === 'casa' || tipo === 'villa';
export const genereDi = n => { const s = String(n || '').toLowerCase().trim(); return GENERI[s] ? s : Object.keys(GENERI).find(k => s && (GENERI[k].nome.toLowerCase().includes(s) || s.includes(k) || s.includes(GENERI[k].nome.toLowerCase()))) || null; };

export const REGOLE_TERRENI = {
  lottiAPersona: 1,
  quotaProprietario: 0.8,     // al proprietario che vende nel suo negozio
  oreLavoro: [8, 17],         // il cantiere lavora dalle 8 alle 17, ora di Roma
  giorniLavoro: [1, 2, 3, 4, 5, 6],   // lunedi'..sabato (0 = domenica)
  scadenzaCantiereGiorni: 0   // 0 = nessuna scadenza
};

export const lottoDi = nome => {
  const n = String(nome || '').toLowerCase().trim(); if (!n) return null;
  const k = n.match(/(\d+)/);
  return LOTTI.find(l => l.id === n) || (k ? LOTTI.find(l => l.id === 'lotto' + k[1]) : null) || LOTTI.find(l => l.nome.toLowerCase() === n) || null;
};

// Le parti del lotto, calcolate: dove sta l'edificio, la porta, il bancone, chi vende e il cliente.
export function geometria(l, tipo) {
  const E = EDIFICIO[tipo] || EDIFICIO.casa;
  const bz = l.z + LOTTO.d / 2 - E.d / 2 - 0.2;   // centro dell'edificio, contro il fondo del lotto
  const facciata = bz - E.d / 2;
  return {
    edificio: { x: l.x, z: bz, w: E.w, d: E.d },
    porta: { x: l.x, z: Math.round((facciata - 0.9) * 100) / 100 },
    ritorno: { x: l.x, z: Math.round((facciata - 1.9) * 100) / 100 },   // dove ci si trova uscendo
    cartello: { x: l.x - LOTTO.w / 2 + 0.6, z: l.z - LOTTO.d / 2 + 0.4 },
    bancone: { x: l.x + 2.2, z: Math.round((facciata - 2.6) * 100) / 100, rot: 180 },
    venditore: { x: l.x + 2.2, z: Math.round((facciata - 1.5) * 100) / 100 },
    cliente: { x: l.x + 2.2, z: Math.round((facciata - 3.8) * 100) / 100 },
    rect: { x0: l.x - LOTTO.w / 2, x1: l.x + LOTTO.w / 2, z0: l.z - LOTTO.d / 2, z1: l.z + LOTTO.d / 2 }
  };
}

// Ora di Roma, per sapere se il cantiere lavora
const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
const GIORNI = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
function oraRoma(ms) { const p = Object.fromEntries(FMT.formatToParts(new Date(ms)).map(x => [x.type, x.value])); return { g: GIORNI[p.weekday], h: +p.hour + (+p.minute) / 60 }; }
export function cantiereAperto(ms, R = REGOLE_TERRENI) { const o = oraRoma(ms); return R.giorniLavoro.includes(o.g) && o.h >= R.oreLavoro[0] && o.h < R.oreLavoro[1]; }

// Quando finira' (simulando ora per ora le ore di lavoro che restano)
export function finePrevista(oreRestanti, da, R = REGOLE_TERRENI) {
  let t = da, resta = oreRestanti * 3600000; const passo = 15 * 60000;
  for (let i = 0; i < 24 * 4 * 60 && resta > 0; i++) { if (cantiereAperto(t, R)) resta -= passo; t += passo; }
  return t;
}

export const nuoviTerreni = () => ({});
// stato.terreni = { lotto1: { chi:'ada' | 'g:Nick', nomeChi, comprato, pagato, progetto: { tipo, nome, genere, costo, ore, fatte, inizio, finito } } }
export const terrenoDi = (stato, chi) => Object.entries(stato.terreni || {}).find(([, t]) => t.chi === chi) || null;

const pulito = (s, n) => String(s == null ? '' : s).replace(/[\u0000-\u001f<>]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, n);

// Comprare un lotto. soldi = quanti Starlight ha chi compra (per gli agenti); per le persone vere li toglie il gioco.
// Un lotto pignorato dalla banca si ricompra all'asta, con quello che c'e' sopra (prezzo in stato.aste).
export function compraLotto(stato, chi, nomeChi, lottoNome, soldi, adesso) {
  const l = lottoDi(lottoNome);
  if (!l) return { ok: false, motivo: 'Lotto sconosciuto. In vendita: ' + LOTTI.map(q => q.id).join(', ') + '.' };
  const T = stato.terreni || (stato.terreni = {});
  if (T[l.id]) return { ok: false, motivo: `${l.nome} e' gia' di ${T[l.id].nomeChi}.` };
  const gia = immobileDi(stato, chi); if (gia) return { ok: false, motivo: `Hai gia' ${gia.nome}: si puo' avere una sola proprieta' (terreno o appartamento).` };
  const asta = (stato.aste || {})[l.id], prezzo = prezzoLotto(stato, l.id);
  if (soldi != null && soldi < prezzo) return { ok: false, motivo: `Costa ${prezzo} Starlight e ne hai ${soldi}.` };
  T[l.id] = { chi, nomeChi: pulito(nomeChi, 20), comprato: adesso, pagato: prezzo, progetto: asta && asta.progetto ? asta.progetto : null };
  if (asta) delete stato.aste[l.id];
  return { ok: true, lotto: l.id, nome: l.nome, prezzo, asta: !!asta };
}
export const prezzoLotto = (stato, id) => { const a = (stato.aste || {})[id], l = lottoDi(id); return a ? a.prezzo : l ? l.prezzo : 0; };

/* ---------- appartamenti nella Torre della Cometa ----------
   15 piani, un appartamento per piano (di quelli senza negozio). Piu' sei in alto, piu' e' bello (luce, vista)
   e piu' costa: come in citta'. Si compra in banca, in contanti o col mutuo. Chi ci abita entra dall'ascensore. */
export const APPARTAMENTI = Array.from({ length: 15 }, (_, i) => { const p = i + 1; return { id: 'torre' + p, piano: p, nome: `Appartamento al ${p}° piano della Torre`, m2: 45 + (p > 10 ? 15 : p > 5 ? 8 : 0), prezzo: 15000 + 800 * p }; });
export const appartamentoDato = n => { const s = String(n || '').toLowerCase(), k = s.match(/(\d+)/); return k ? APPARTAMENTI.find(a => a.piano === +k[1]) || null : null; };
export const appartamentoDi = (stato, chi) => Object.entries(stato.appartamenti || {}).find(([, a]) => a.chi === chi) || null;
export const prezzoAppartamento = (stato, id) => { const a = (stato.aste || {})[id], q = APPARTAMENTI.find(x => x.id === id); return a ? a.prezzo : q ? q.prezzo : 0; };
export function compraAppartamento(stato, chi, nomeChi, nome, soldi, adesso) {
  const q = appartamentoDato(nome);
  if (!q) return { ok: false, motivo: 'Quale piano? Gli appartamenti sono dal 1° al 15° piano della Torre.' };
  const A = stato.appartamenti || (stato.appartamenti = {});
  if (A[q.id]) return { ok: false, motivo: `${q.nome} e' gia' di ${A[q.id].nomeChi}.` };
  const gia = immobileDi(stato, chi); if (gia) return { ok: false, motivo: `Hai gia' ${gia.nome}: si puo' avere una sola proprieta' (terreno o appartamento).` };
  const prezzo = prezzoAppartamento(stato, q.id);
  if (soldi != null && soldi < prezzo) return { ok: false, motivo: `Costa ${prezzo} Starlight e ne hai ${soldi}.` };
  A[q.id] = { chi, nomeChi: pulito(nomeChi, 20), comprato: adesso, pagato: prezzo };
  if ((stato.aste || {})[q.id]) delete stato.aste[q.id];
  return { ok: true, appartamento: q.id, piano: q.piano, nome: q.nome, prezzo };
}

// La proprieta' di qualcuno (una sola): { id, tipo: 'lotto'|'appartamento', nome, valore }
export function immobileDi(stato, chi) {
  const t = terrenoDi(stato, chi);
  if (t) { const l = lottoDi(t[0]), p = t[1].progetto; return { id: t[0], tipo: 'lotto', nome: p ? `${p.nome} (${l.nome})` : l.nome, valore: valoreImmobile(stato, t[0]) }; }
  const a = appartamentoDi(stato, chi);
  if (a) { const q = APPARTAMENTI.find(x => x.id === a[0]); return { id: a[0], tipo: 'appartamento', nome: q.nome, piano: q.piano, valore: valoreImmobile(stato, a[0]) }; }
  return null;
}
// quanto vale (per la banca): terreno + costruzione, o il prezzo dell'appartamento
export function valoreImmobile(stato, id) {
  const l = lottoDi(id);
  if (l && /^lotto/.test(id)) { const t = (stato.terreni || {})[id], p = t && t.progetto; return l.prezzo + (p ? p.costo : 0); }
  const q = APPARTAMENTI.find(x => x.id === id); return q ? q.prezzo : 0;
}
// Pignoramento: la banca toglie la proprieta' e la rimette in vendita all'asta (con la costruzione sopra)
export function mettiAllAsta(stato, id, prezzo, adesso) {
  const A = stato.aste || (stato.aste = {});
  if (/^lotto/.test(id)) { const t = (stato.terreni || {})[id]; if (!t) return false; A[id] = { prezzo, progetto: t.progetto, da: adesso, era: t.nomeChi }; delete stato.terreni[id]; return true; }
  const a = (stato.appartamenti || {})[id]; if (!a) return false; A[id] = { prezzo, da: adesso, era: a.nomeChi }; delete stato.appartamenti[id]; return true;
}

// Avviare il cantiere sul proprio lotto: tipo 'casa' o 'negozio'; nome e genere (cosa vende) per il negozio.
export function avviaCantiere(stato, chi, d, soldi, adesso) {
  const e = terrenoDi(stato, chi);
  if (!e) return { ok: false, motivo: 'Prima devi comprare un terreno.' };
  const [id, t] = e, tipo = tipoDi(d.tipo);
  if (!tipo) return { ok: false, motivo: 'Puoi costruire una casa, una villa oppure un negozio.' };
  if (t.progetto) return { ok: false, motivo: t.progetto.finito ? `Sul tuo terreno c'e' gia' ${t.progetto.nome}.` : `Sul tuo terreno c'e' gia' il cantiere di ${t.progetto.nome}.` };
  const genere = tipo === 'negozio' ? genereDi(d.genere) : null;
  if (tipo === 'negozio' && !genere) return { ok: false, motivo: 'Che cosa vende il negozio? Scegli tra: ' + Object.entries(GENERI).map(([k, g]) => `${k} (${g.nome})`).join(', ') + '.' };
  const costo = costoProgetto(tipo);
  if (soldi != null && soldi < costo) return { ok: false, motivo: `Costruire ${UN[tipo]} costa ${costo} Starlight e ne hai ${soldi}.` };
  const nome = pulito(d.nome, 28) || (tipo === 'negozio' ? GENERI[genere].nome + ' di ' + t.nomeChi : PROGETTI[tipo].nome + ' di ' + t.nomeChi);
  const colore = Number.isInteger(+d.colore) && +d.colore >= 0 && +d.colore < 6 && d.colore !== null && d.colore !== '' ? +d.colore : Math.abs(hash(id + chi + adesso)) % 6;
  t.progetto = { tipo, nome, genere, costo, ore: PROGETTI[tipo].ore, fatte: 0, inizio: adesso, finito: null, colore,
    insegna: scelta(d.insegna, INSEGNE, 'legno'), arredo: scelta(d.arredo, ARREDI, 'rustico') };
  if (genere) t.progetto.prezzi = Object.fromEntries(listinoDi(genere, d.prezzi).map(q => [q[0], q[1]]));
  return { ok: true, lotto: id, tipo, nome, costo, ore: PROGETTI[tipo].ore, fine: finePrevista(PROGETTI[tipo].ore, adesso) };
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

// Un passo del tempo: i cantieri aperti avanzano nelle ore di lavoro. Restituisce i lotti appena finiti.
// ritmo(id): quanto lavora la squadra del cantiere (1 = squadra completa; agenti/impresa.mjs). Senza, si va al ritmo normale.
export function passoCantieri(stato, adesso, dtS, ritmo) {
  const finiti = [];
  if (!dtS || !cantiereAperto(adesso)) return finiti;
  for (const [id, t] of Object.entries(stato.terreni || {})) {
    const p = t.progetto; if (!p || p.finito) continue;
    const k = ritmo ? ritmo(id) : 1; if (!(k > 0)) continue;
    p.fatte = Math.min(p.ore, Math.round((p.fatte + k * dtS / 3600) * 1000) / 1000);
    if (p.fatte >= p.ore) { p.finito = adesso; finiti.push(id); }
  }
  return finiti;
}

export const faseDi = p => !p ? null : p.finito ? 'finito' : p.fatte < p.ore * 0.15 ? 'fondamenta' : p.fatte < p.ore * 0.55 ? 'muri' : p.fatte < p.ore * 0.8 ? 'tetto' : 'finiture';

// I negozi costruiti sui lotti, nello stesso formato di NEGOZI (negozi.mjs)
export function negoziDeiLotti(stato) {
  return Object.entries(stato.terreni || {}).filter(([, t]) => t.progetto && t.progetto.finito && t.progetto.tipo === 'negozio').map(([id, t]) => {
    const l = lottoDi(id), g = geometria(l, 'negozio'), gen = GENERI[t.progetto.genere] || GENERI.bottega;
    return { id, nome: t.progetto.nome, bancone: g.bancone, venditore: g.venditore, cliente: g.cliente, prodotti: listinoDi(t.progetto.genere, t.progetto.prezzi), proprietario: t.chi, genere: t.progetto.genere, icona: gen.icona, lotto: true };
  });
}

// Per il gioco
export function vistaTerreni(stato, adesso) {
  return LOTTI.map(l => {
    const t = (stato.terreni || {})[l.id], asta = (stato.aste || {})[l.id], p = t ? t.progetto : asta && asta.progetto;
    return { id: l.id, nome: l.nome, x: l.x, z: l.z, w: LOTTO.w, d: LOTTO.d, prezzo: prezzoLotto(stato, l.id), asta: asta ? { era: asta.era } : null, geo: geometria(l, p && p.tipo),
      chi: t ? { id: t.chi, nome: t.nomeChi, vero: t.chi.indexOf('g:') === 0 } : null,
      progetto: p ? { tipo: p.tipo, nome: p.nome, genere: p.genere, icona: p.genere ? GENERI[p.genere].icona : p.tipo === 'villa' ? '🏡' : '🏠', costo: p.costo, ore: p.ore, fatte: Math.round(p.fatte * 10) / 10, fase: faseDi(p), finito: p.finito, colore: p.colore || 0, insegna: p.insegna || 'legno', arredo: p.arredo || 'rustico', listino: p.genere ? listinoDi(p.genere, p.prezzi).map(q => [q[0], q[1]]) : null, inizio: p.inizio,
        fine: p.finito || finePrevista(p.ore - p.fatte, adesso) } : null };
  });
}
export function vistaAppartamenti(stato) {
  return APPARTAMENTI.map(q => { const a = (stato.appartamenti || {})[q.id], asta = (stato.aste || {})[q.id];
    return { id: q.id, piano: q.piano, nome: q.nome, m2: q.m2, prezzo: prezzoAppartamento(stato, q.id), asta: !!asta, chi: a ? { id: a.chi, nome: a.nomeChi, vero: a.chi.indexOf('g:') === 0 } : null }; });
}
export const listinoTerreni = () => ({ progetti: Object.fromEntries(Object.entries(PROGETTI).map(([k, p]) => [k, { nome: p.nome, ore: p.ore, operai: p.operai, materiali: p.materiali, costo: costoProgetto(k), descr: p.descr }])), generi: Object.fromEntries(Object.entries(GENERI).map(([k, g]) => [k, { nome: g.nome, icona: g.icona, prodotti: g.prodotti.map(q => [q[0], q[1]]) }])), insegne: INSEGNE, arredi: ARREDI, prezzoMin: PREZZO_MIN, prezzoMax: PREZZO_MAX, orari: { giorni: REGOLE_TERRENI.giorniLavoro, ore: REGOLE_TERRENI.oreLavoro } });
// Il proprietario cambia i prezzi del suo negozio (anche quando e' gia' aperto)
export function cambiaListino(stato, chi, prezzi) {
  const e = terrenoDi(stato, chi), p = e && e[1].progetto;
  if (!p || p.tipo !== 'negozio') return { ok: false, motivo: 'Non hai un negozio.' };
  p.prezzi = Object.fromEntries(listinoDi(p.genere, Object.assign({}, p.prezzi, prezzi)).map(q => [q[0], q[1]]));
  return { ok: true, lotto: e[0], listino: listinoDi(p.genere, p.prezzi).map(q => [q[0], q[1]]) };
}
