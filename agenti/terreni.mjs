// =====================================================================
//  TERRENI DEL BORGO: comprare un lotto e costruirci una casa o un negozio
//  Chiesto da Boris il 21/11/2026: "la possibilita' di comprare un terreno e
//  costruire una casa o negozio". Vale per tutti: le persone vere (dal gioco)
//  e gli abitanti IA (Ada, Teo e chi verra'), con le stesse regole.
//
//  - Il borgo mette in vendita pochi lotti recintati, in posti liberi della
//    piazza (lato sud vicino alle casette, e due file a nord-ovest e nord-est).
//  - Un lotto a testa. Si paga in Starlight, tutto subito.
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
//  Prezzi (Boris 22/11/2026: "falli in modo razionale"): un abitante che lavora ~4 ore al giorno
//  (~30 Starlight l'ora, meno le bollette) mette da parte ~100 S al giorno: il terreno in circa una
//  settimana, il negozio in altre due (poi il negozio lo ripaga). Chi gioca (~500 S al giorno) in 3-5 giorni.
// =====================================================================

// x, z = centro del lotto; il lotto e' largo 8 m (x) e profondo 10 m (z).
// La casa o il negozio sta nella meta' dietro (verso sud), con la porta che guarda a nord;
// davanti resta il cortile con il bancone (per un negozio).
export const LOTTI = [
  { id: 'lotto1', nome: 'Lotto 1, accanto alla Porta del Borgo (ovest)', x: -10, z: 62, prezzo: 700 },
  { id: 'lotto2', nome: 'Lotto 2, accanto alla Porta del Borgo (est)', x: 10, z: 62, prezzo: 700 },
  { id: 'lotto3', nome: 'Lotto 3, lato sud verso il Fioraio', x: 35, z: 62, prezzo: 600 },
  { id: 'lotto4', nome: 'Lotto 4, nord-ovest verso la Torre', x: -32, z: 13, prezzo: 500 },
  { id: 'lotto5', nome: 'Lotto 5, nord-ovest dietro il Mercatino', x: -22, z: 13, prezzo: 600 },
  { id: 'lotto6', nome: 'Lotto 6, nord-est verso la Ruota', x: 20, z: 13, prezzo: 600 }
];
export const LOTTO = { w: 8, d: 10, edW: 5.6, edD: 5 };

// Cosa si puo' costruire. costo = materiali + operai (paga del borgo); ore = ore di cantiere (dalle 8 alle 17, lun-sab).
export const PROGETTI = {
  casa: { nome: 'Casa', ore: 72, operai: 2, materiali: 1200, pagaOra: 4, descr: 'casetta in muratura di 28 m2 con il tetto di tegole' },
  negozio: { nome: 'Negozio', ore: 54, operai: 2, materiali: 800, pagaOra: 4, descr: 'bottega di 28 m2 con vetrine, insegna e un bancone davanti' }
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
export function geometria(l) {
  const bz = l.z + LOTTO.d / 2 - LOTTO.edD / 2 - 0.2;   // centro dell'edificio, contro il fondo del lotto
  const facciata = bz - LOTTO.edD / 2;
  return {
    edificio: { x: l.x, z: bz, w: LOTTO.edW, d: LOTTO.edD },
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
export function compraLotto(stato, chi, nomeChi, lottoNome, soldi, adesso, R = REGOLE_TERRENI) {
  const l = lottoDi(lottoNome);
  if (!l) return { ok: false, motivo: 'Lotto sconosciuto. In vendita: ' + LOTTI.map(q => q.id).join(', ') + '.' };
  const T = stato.terreni || (stato.terreni = {});
  if (T[l.id]) return { ok: false, motivo: `${l.nome} e' gia' di ${T[l.id].nomeChi}.` };
  if (Object.values(T).filter(t => t.chi === chi).length >= R.lottiAPersona) return { ok: false, motivo: 'Hai gia\' un terreno: se ne puo\' avere uno solo.' };
  if (soldi != null && soldi < l.prezzo) return { ok: false, motivo: `Costa ${l.prezzo} Starlight e ne hai ${soldi}.` };
  T[l.id] = { chi, nomeChi: pulito(nomeChi, 20), comprato: adesso, pagato: l.prezzo, progetto: null };
  return { ok: true, lotto: l.id, nome: l.nome, prezzo: l.prezzo };
}

// Avviare il cantiere sul proprio lotto: tipo 'casa' o 'negozio'; nome e genere (cosa vende) per il negozio.
export function avviaCantiere(stato, chi, d, soldi, adesso) {
  const e = terrenoDi(stato, chi);
  if (!e) return { ok: false, motivo: 'Prima devi comprare un terreno.' };
  const [id, t] = e, tipo = String(d.tipo || '').toLowerCase().includes('neg') ? 'negozio' : String(d.tipo || '').toLowerCase().includes('cas') ? 'casa' : null;
  if (!tipo) return { ok: false, motivo: 'Puoi costruire una casa oppure un negozio.' };
  if (t.progetto) return { ok: false, motivo: t.progetto.finito ? `Sul tuo terreno c'e' gia' ${t.progetto.nome}.` : `Sul tuo terreno c'e' gia' il cantiere di ${t.progetto.nome}.` };
  const genere = tipo === 'negozio' ? genereDi(d.genere) : null;
  if (tipo === 'negozio' && !genere) return { ok: false, motivo: 'Che cosa vende il negozio? Scegli tra: ' + Object.entries(GENERI).map(([k, g]) => `${k} (${g.nome})`).join(', ') + '.' };
  const costo = costoProgetto(tipo);
  if (soldi != null && soldi < costo) return { ok: false, motivo: `Costruire ${tipo === 'casa' ? 'una casa' : 'un negozio'} costa ${costo} Starlight e ne hai ${soldi}.` };
  const nome = pulito(d.nome, 28) || (tipo === 'casa' ? 'Casa di ' + t.nomeChi : GENERI[genere].nome + ' di ' + t.nomeChi);
  t.progetto = { tipo, nome, genere, costo, ore: PROGETTI[tipo].ore, fatte: 0, inizio: adesso, finito: null, colore: Math.abs(hash(id + chi + adesso)) % 6 };
  return { ok: true, lotto: id, tipo, nome, costo, ore: PROGETTI[tipo].ore, fine: finePrevista(PROGETTI[tipo].ore, adesso) };
}
function hash(s) { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0; return h; }

// Un passo del tempo: i cantieri aperti avanzano nelle ore di lavoro. Restituisce i lotti appena finiti.
export function passoCantieri(stato, adesso, dtS) {
  const finiti = [];
  if (!dtS || !cantiereAperto(adesso)) return finiti;
  for (const [id, t] of Object.entries(stato.terreni || {})) {
    const p = t.progetto; if (!p || p.finito) continue;
    p.fatte = Math.min(p.ore, Math.round((p.fatte + dtS / 3600) * 1000) / 1000);
    if (p.fatte >= p.ore) { p.finito = adesso; finiti.push(id); }
  }
  return finiti;
}

export const faseDi = p => !p ? null : p.finito ? 'finito' : p.fatte < p.ore * 0.15 ? 'fondamenta' : p.fatte < p.ore * 0.55 ? 'muri' : p.fatte < p.ore * 0.8 ? 'tetto' : 'finiture';

// I negozi costruiti sui lotti, nello stesso formato di NEGOZI (negozi.mjs)
export function negoziDeiLotti(stato) {
  return Object.entries(stato.terreni || {}).filter(([, t]) => t.progetto && t.progetto.finito && t.progetto.tipo === 'negozio').map(([id, t]) => {
    const l = lottoDi(id), g = geometria(l), gen = GENERI[t.progetto.genere] || GENERI.bottega;
    return { id, nome: t.progetto.nome, bancone: g.bancone, venditore: g.venditore, cliente: g.cliente, prodotti: gen.prodotti, proprietario: t.chi, genere: t.progetto.genere, icona: gen.icona, lotto: true };
  });
}

// Per il gioco
export function vistaTerreni(stato, adesso) {
  return LOTTI.map(l => {
    const t = (stato.terreni || {})[l.id], p = t && t.progetto;
    return { id: l.id, nome: l.nome, x: l.x, z: l.z, w: LOTTO.w, d: LOTTO.d, prezzo: l.prezzo, geo: geometria(l),
      chi: t ? { id: t.chi, nome: t.nomeChi, vero: t.chi.indexOf('g:') === 0 } : null,
      progetto: p ? { tipo: p.tipo, nome: p.nome, genere: p.genere, icona: p.genere ? GENERI[p.genere].icona : '🏠', costo: p.costo, ore: p.ore, fatte: Math.round(p.fatte * 10) / 10, fase: faseDi(p), finito: p.finito, colore: p.colore || 0,
        fine: p.finito || finePrevista(p.ore - p.fatte, adesso) } : null };
  });
}
export const listinoTerreni = () => ({ progetti: Object.fromEntries(Object.entries(PROGETTI).map(([k, p]) => [k, { nome: p.nome, ore: p.ore, operai: p.operai, materiali: p.materiali, costo: costoProgetto(k), descr: p.descr }])), generi: Object.fromEntries(Object.entries(GENERI).map(([k, g]) => [k, { nome: g.nome, icona: g.icona, prodotti: g.prodotti.map(q => [q[0], q[1]]) }])) });
