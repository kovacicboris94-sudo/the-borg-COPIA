// =====================================================================
//  VITA - LE AZIONI DEL CORPO
//  Quello che un abitante puo' fare per vivere. Ogni azione e' controllata
//  dal codice (non dal modello): servono le cose giuste, bisogna essere nel
//  posto giusto e ci vuole il tempo vero. Se manca qualcosa l'azione viene
//  rifiutata con il motivo, e l'agente lo scopre al pensiero dopo.
//  Se il posto e' lontano, l'azione chiede di andarci prima (campo "vai"):
//  il motore ce lo porta camminando e poi la riprova.
// =====================================================================
import { MATERIALI, OGGETTI, nomeDi, cercaCosa } from './materiali.mjs';
import { mangia as mangiaCorpo, bevi as beviCorpo, ammala, MET } from './corpo.mjs';
import { COLTURE, pesca as pescaNelLago, casuale, tempoAdesso } from './natura.mjs';
import { UMIDITA_MAX_ESCA, UMIDITA_MAX_FUOCO } from './fisica.mjs';
import { POSTI, REGOLE_VITA, nuovaCosa, registra, legnaNelFuoco } from './mondo.mjs';
import { LISTINO, prezzoDi, prezzoAcquisto, limiteAcquisto } from './economia.mjs';
import { MESTIERI, cercaMestiere, pagaOraria, ORE_MAX_GIORNO, descriviMestieri, competenza } from './mestieri.mjs';
import { BAGNI, rendimento, soddisfa } from './umano.mjs';
import { casaDi, aCasa, fornelloDi, doccia, CASA } from './casa.mjs';

const r3 = v => Math.round(v * 1000) / 1000;
const num = (v, d) => (typeof v === 'number' && isFinite(v) ? v : (typeof v === 'string' && v.trim() !== '' && isFinite(+v) ? +v : d));
const lim = (v, a, b) => Math.max(a, Math.min(b, v));
const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const oraRoma = ms => +new Date(ms).toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }) % 24;

// ---- descrizione per il prompt degli agenti ----
export const TIPI_VITA = ['bevi', 'mangia', 'raccogli', 'pesca', 'accendi', 'alimenta', 'metti_sul_fuoco', 'togli_dal_fuoco', 'riempi', 'aggiungi', 'impasta', 'modella', 'dormi', 'riposa', 'semina', 'annaffia', 'prendi', 'lascia', 'dai',
  'compra', 'vendi_al_mercatino', 'turno', 'lavati', 'bagno', 'svago', 'chiacchiera', 'butta', 'casa', 'spegni', 'termostato'];
// durante un turno di lavoro si puo' fare una pausa per queste (senza lasciare il turno)
const IN_PAUSA = ['mangia', 'bevi', 'bagno'];
export function promptAzioniVita() {
  return `IL TUO CORPO E' VERO (come una persona): hai fame, sete, sonno, caldo e freddo; mangiare, bere e dormire sono azioni. Il mondo segue le leggi della fisica e della chimica: il fuoco ha bisogno di legna asciutta e aria, l'acqua bolle a 100 gradi, la terracotta si cuoce sopra 550 gradi, il cibo crudo o vecchio puo' farti stare male, il cibo che c'e' finisce. Nessuno ti regala niente: le scorte della Dispensa del Mercatino (x=0 z=8) sono di tutti e non si ricaricano da sole.
Il nome delle cose: farina, fagioli secchi, olio, sale, legna, rami, erba secca, pesce, pane, impasto, ciliegie, argilla, pentola, ciotola, mattone, acciarino, lenza, coperta, semi di grano, semi di fava, semi di spinaci...
AZIONI DEL CORPO (vanno nella stessa lista delle altre; se il posto e' lontano ci cammini da solo prima):
- {"tipo":"bevi","luogo":"Fontana","x":0.5}: bevi (x = litri, max 1). La Fontana e' potabile. L'acqua del Laghetto no, a meno di bollirla in pentola: poi bevi con {"tipo":"bevi","nome":"pentola"}.
- {"tipo":"mangia","nome":"pane","x":0.3}: mangi x kg di una cosa che hai con te.
- {"tipo":"raccogli","nome":"rami","x":3}: raccogli x kg: rami (sotto gli alberi), ciliegie (solo a fine primavera), argilla ed erba secca (alla riva del Laghetto), o il raccolto di un'aiuola matura (nome = grano, fave, spinaci). Porti al massimo ${REGOLE_VITA.caricoMax} kg.
- {"tipo":"pesca","x":2}: peschi x ore al Laghetto (serve la lenza). I pesci sono pochi e ricrescono piano.
- {"tipo":"accendi","nome":"acciarino"}: accendi un fuoco dove sei, all'aperto (serve erba secca asciutta come esca e almeno mezzo kg di rami o legna asciutti con te). Senza acciarino puoi provare a sfregare due legni ("nome":"frizione"): faticoso e riesce di rado. Con {"tipo":"accendi","luogo":"Forno"} accendi il forno del Forno (fino a ~450 gradi, per il pane).
- {"tipo":"alimenta","nome":"legna","x":2}: metti x kg di legna o rami nel fuoco vicino. Il fuoco consuma 1-3 kg di legna all'ora; con la legna bagnata non tiene.
- {"tipo":"metti_sul_fuoco","nome":"pentola"} (o pesce, impasto, pentola cruda...): metti una cosa sul fuoco vicino o nel forno. La pentola si scalda con dentro quello che c'e'; il pesce si cuoce sulla brace; l'impasto diventa pane; l'argilla cruda va nelle fiamme ma solo se e' asciutta (giorni all'aria) o si spacca.
- {"tipo":"togli_dal_fuoco","nome":"pentola"}: la riprendi (lascialo troppo e brucia).
- {"tipo":"riempi","luogo":"Fontana","x":2}: riempi la pentola con x litri (max 3) alla Fontana o al Laghetto.
- {"tipo":"aggiungi","nome":"fagioli secchi","x":0.5}: metti x kg di cibo nella pentola (i fagioli secchi vanno lasciati in acqua 8 ore e poi bolliti un'ora, oppure bolliti 3 ore: crudi sono tossici).
- {"tipo":"impasta","x":1}: impasti x kg di farina con acqua (0,65 litri per kg: dalla pentola o stando alla Fontana) e un pizzico di sale.
- {"tipo":"modella","nome":"pentola"}: modelli con l'argilla che hai una pentola (1,6 kg), una ciotola (0,5 kg) o un mattone (3,2 kg). Poi deve asciugare all'aria (circa 5 giorni, lasciala a terra o in dispensa) e cuocere nel fuoco.
- {"tipo":"dormi","x":8}: dormi fino a x ore (ti svegli prima se sei riposato). Dentro un edificio si sta al caldo; fuori di notte fa freddo e con una coperta dormi molto meglio.
- {"tipo":"riposa","x":20}: ti riposi x minuti.
- {"tipo":"semina","nome":"grano"}: semini un'aiuola libera vicino a te (grano, fave o spinaci; servono i semi). Cresce col caldo e con l'acqua; il grano seminato ora si raccoglie a giugno.
- {"tipo":"annaffia","x":2}: versi x litri della pentola sull'aiuola vicina.
- {"tipo":"prendi","nome":"farina","x":1}: prendi x kg (o pezzi, per gli attrezzi) dalla Dispensa o da terra vicino a te. {"tipo":"lascia","nome":"...","x":..} li lasci (in Dispensa se ci sei, se no a terra). {"tipo":"butta","nome":"pesce"}: butti nel compost il cibo andato a male (non si lascia per terra).
- {"tipo":"dai","nome":"pane","id":"teo","x":0.5}: dai x kg a chi ti sta vicino (id = il suo nome).
SOLDI E LAVORO: il cibo, la legna e gli attrezzi arrivano da fuori ogni mattina al Mercatino (x=0 z=8) e si pagano in Starlight. Le scorte sono limitate: se finiscono, il prezzo sale.
- {"tipo":"compra","nome":"pane","x":0.5}: compri x kg (o pezzi per gli attrezzi) al Mercatino. {"tipo":"vendi_al_mercatino","nome":"pesce","x":1}: vendi al Mercatino quello che hai prodotto (te lo paga meta' del suo prezzo, e ne compra quanto chiedono i suoi clienti).
- {"tipo":"turno","nome":"facchino","x":4}: fai un turno da dipendente di x ore, pagato a ore (diverso dal bancone, dove vendi tu ai clienti e prendi meta' dell'incasso) (massimo ${ORE_MAX_GIORNO} al giorno, solo negli orari della bottega, posti limitati). Mestieri: ${descriviMestieri()}. Con l'esperienza la paga sale fino al 40% in piu'. Durante il turno puoi solo mangiare, bere e andare in bagno. Oppure lavori in proprio: pesca, coltiva, fai pentole o pane e vendi.
CASA: hai una casetta tua in piazza. {"tipo":"casa"} ci torni. Dentro: fornello a gas ({"tipo":"accendi"}, poi metti_sul_fuoco / togli_dal_fuoco, poi {"tipo":"spegni"}), frigo a 4 gradi (il cibo che lasci a casa va in frigo e dura molto di piu'; {"tipo":"prendi"} per riprenderlo), bagno con doccia calda, letto con il piumone, riscaldamento ({"tipo":"termostato","x":19}). Gas, luce e acqua si pagano a fine giornata in Starlight: se non paghi per troppo tempo staccano gas e luce.
CORPO E TESTA: {"tipo":"bagno"} (a casa o in un edificio: Biblioteca, Sala Giochi, Casa degli Scacchi, Negozio TCG, Laugh Tale, Torre); {"tipo":"lavati"} (in un edificio con acqua calda, o alla Fontana con acqua gelata); {"tipo":"svago","luogo":"Belvedere","x":1} (x ore di riposo e divertimento: passa la noia); {"tipo":"chiacchiera","id":"teo","x":20} (x minuti con chi ti sta vicino: passa la solitudine a tutti e due).`;
}

// ---- zaino ----
export const pesoZaino = c => c.zaino.reduce((s, q) => s + q.kg + (q.contenuto || []).reduce((t, w) => t + w.kg, 0), 0);
const cercaIn = (lista, cosa) => lista.find(q => q.cosa === cosa && !q.rotta) || null;
// Toglie kg di una cosa da una lista di pile; restituisce un pezzo nuovo (o l'oggetto intero, per gli attrezzi)
function preleva(mondo, lista, cosa, kg) {
  if (OGGETTI[cosa]) { const i = lista.findIndex(q => q.cosa === cosa && !q.rotta); if (i < 0) return null; return lista.splice(i, 1)[0]; }
  const pile = lista.filter(q => q.cosa === cosa).sort((a, b) => (b.guasto || 0) - (a.guasto || 0));   // prima le cose piu' vecchie
  let resta = kg, preso = null;
  for (const p of pile) {
    const k = Math.min(p.kg, resta); if (k <= 0) break;
    if (!preso) preso = nuovaCosa(mondo, cosa, 0, { T: p.T, umid: p.umid, guasto: p.guasto, bollita: p.bollita, bruciato: p.bruciato });
    // medie pesate per massa (temperatura, umidita', freschezza)
    for (const campo of ['T', 'umid', 'guasto']) if (p[campo] != null) preso[campo] = ((preso[campo] ?? p[campo]) * preso.kg + p[campo] * k) / (preso.kg + k || 1);
    preso.kg = r3(preso.kg + k); p.kg = r3(p.kg - k); resta -= k;
  }
  for (let i = lista.length - 1; i >= 0; i--) if (!OGGETTI[lista[i].cosa] && lista[i].kg <= 0.0005 && !lista[i].contenuto) lista.splice(i, 1);
  return preso && preso.kg > 0 ? preso : null;
}
// Mette una cosa in una lista, unendola a una pila uguale se c'e'
function deponi(lista, q) {
  if (OGGETTI[q.cosa] || q.contenuto || q.bruciato) { lista.push(q); return; }
  const p = lista.find(x => x.cosa === q.cosa && !x.bruciato && !!x.bollita === !!q.bollita);
  if (!p) { lista.push(q); return; }
  for (const campo of ['T', 'umid', 'guasto']) if (q[campo] != null || p[campo] != null) p[campo] = ((p[campo] ?? q[campo]) * p.kg + (q[campo] ?? p[campo]) * q.kg) / (p.kg + q.kg);
  p.kg = r3(p.kg + q.kg);
}
const quanto = (lista, cosa) => r3(lista.filter(q => q.cosa === cosa && !q.rotta).reduce((s, q) => s + (OGGETTI[cosa] ? 1 : q.kg), 0));

// ---- posti ----
const nelPosto = (c, posto) => !c.stanza && dist(c, posto) <= posto.raggio;
const vaiA = (posto, motivo) => ({ vai: { x: posto.x, z: posto.z + (posto === POSTI.laghetto ? -11 : 0), nome: posto.nome }, esito: motivo });
function postoDa(nome) {
  const n = String(nome || '').toLowerCase();
  if (/fontan/.test(n)) return POSTI.fontana;
  if (/lag|lago|riva/.test(n)) return POSTI.laghetto;
  if (/dispens|mercat/.test(n)) return POSTI.dispensa;
  if (/forno/.test(n)) return POSTI.forno;
  return null;
}
// il fuoco piu' vicino entro r metri (prima quelli accesi)
const fuocoVicino = (mondo, c, r = 3) => mondo.fuochi.filter(f => (f.stanza ? f.stanza === c.stanza : !c.stanza && dist(f, c) <= r)).sort((a, b) => (b.acceso ? 1 : 0) - (a.acceso ? 1 : 0) || dist(a, c) - dist(b, c))[0] || null;
const pentolaDi = (mondo, c) => c.zaino.find(q => q.cosa === 'pentola') || (fuocoVicino(mondo, c) || { sopra: [] }).sopra.find(q => q.cosa === 'pentola') || null;
const dispensaQui = c => nelPosto(c, POSTI.dispensa);
const coseVicine = (mondo, c) => mondo.cose.filter(q => (q.dove === 'frigo' && aCasa(mondo, c) && q.casa === c.id) || (q.dove === 'dispensa' && dispensaQui(c)) || (q.dove === 'terra' && (q.stanza || null) === (c.stanza || null) && dist(q, c) <= REGOLE_VITA.portataMani));

// ---- normalizzazione (da quello che scrive il modello a un'azione pulita) ----
export function normalizzaAzioneVita(a) {
  const tipo = String(a && a.tipo || '').toLowerCase().trim();
  if (!TIPI_VITA.includes(tipo)) return null;
  const nome = a.nome != null ? String(a.nome) : null, x = num(a.x, null);
  const cosa = nome ? cercaCosa(nome) : null;
  return { tipo, vita: true, nome, cosa, quanto: x, luogo: a.luogo || null, a: a.id || null };
}

// ---- esecuzione ----
// Restituisce { ok, esito } oppure { vai, esito } se prima bisogna camminare fin la'.
export function eseguiAzioneVita(mondo, id, a, t) {
  const c = mondo.corpi[id];
  if (!c) return { ok: false, esito: 'non hai un corpo' };
  if (c.morto) return { ok: false, esito: 'sei morto' };
  if (c.svenuto) return { ok: false, esito: 'sei svenuto' };
  if (c.lavoro && a.tipo !== 'dormi' && !(c.lavoro.tipo === 'lavora' && IN_PAUSA.includes(a.tipo))) return { ok: false, esito: `${a.tipo}: stai ancora facendo ${c.lavoro.tipo}` };
  const f = AZIONI[a.tipo];
  if (!f) return { ok: false, esito: 'azione sconosciuta' };
  const r = f(mondo, c, a, t) || { ok: true };
  if (r.esito && !r.vai) { (c.esiti || (c.esiti = [])).push(a.tipo + ': ' + r.esito); if (c.esiti.length > 8) c.esiti.shift(); }
  if (r.ok && !r.vai) registra(mondo, { tipo: 'azione', chi: id, azione: a.tipo, cosa: a.cosa || a.nome || null, esito: r.esito });
  return r;
}
const no = esito => ({ ok: false, esito });
// la strada di casa: si va alla porta della casetta e si entra
const vaiACasa = (mondo, c, motivo) => { const k = casaDi(mondo, c); return k ? { vai: { x: k.porta.x, z: k.porta.z, nome: k.nome, entra: k.stanza }, esito: motivo } : null; };
// il bagno piu' vicino: a casa o in un edificio pubblico
const bagnoQui = (mondo, c) => (c.stanza && BAGNI.includes(c.stanza)) || aCasa(mondo, c);
function versoUnBagno(mondo, c, motivo) {
  const k = casaDi(mondo, c), bib = { x: -27.7, z: -3.5 };
  if (k && (Math.hypot(k.porta.x - c.x, k.porta.z - c.z) <= Math.hypot(bib.x - c.x, bib.z - c.z) + 10 || c.stanza)) return vaiACasa(mondo, c, motivo + ' a casa');
  return { vai: { x: bib.x, z: bib.z, nome: 'Biblioteca', entra: 'biblioteca' }, esito: motivo + ' in Biblioteca' };
}
const lavoro = (c, t, tipo, minuti, attivita, dati = {}) => { c.lavoro = Object.assign({ tipo, inizio: t, fine: t + minuti * 60000, attivita }, dati); c.attivita = attivita; return { ok: true, esito: `${tipo}: iniziato, ci vorranno circa ${Math.round(minuti)} minuti`, minuti }; };

const AZIONI = {
  bevi(mondo, c, a, t) {
    const litri = lim(a.quanto ?? 0.4, 0.05, 1);
    if (a.cosa === 'pentola' || /pentola|ciotola/.test(a.nome || '')) {
      const p = pentolaDi(mondo, c); const acqua = p && (p.contenuto || []).find(q => q.cosa === 'acqua');
      if (!acqua || acqua.kg < 0.05) return no('la pentola non ha acqua');
      if (acqua.T > 60) return no(`l'acqua e' ancora troppo calda (circa ${Math.round(acqua.T)} gradi): aspetta che si raffreddi`);
      const b = beviCorpo(c, Math.min(litri, acqua.kg), t); acqua.kg = r3(acqua.kg - b);
      if (!acqua.bollita && acqua.lago && casuale(mondo) < 1 - Math.pow(0.85, b)) ammala(c, 'gastroenterite', t);
      return { ok: true, esito: `bevuti ${b.toFixed(2)} litri dalla pentola` + (acqua.bollita ? ' (acqua bollita, sicura)' : '') };
    }
    // al lavoro (o in un edificio con il bagno) c'e' l'acqua del rubinetto
    if ((c.lavoro && c.lavoro.tipo === 'lavora') || (c.stanza && BAGNI.includes(c.stanza))) {
      const b = beviCorpo(c, litri, t); if (b <= 0) return no('non riesci a bere altro, hai lo stomaco pieno');
      return { ok: true, esito: `bevuti ${b.toFixed(2)} litri d'acqua del rubinetto` };
    }
    const posto = postoDa(a.luogo) || (nelPosto(c, POSTI.laghetto) ? POSTI.laghetto : POSTI.fontana);
    if (!posto.acqua) return no('li\' non c\'e\' acqua');
    if (!nelPosto(c, posto)) return vaiA(posto, 'vado a bere a ' + posto.nome);
    const b = beviCorpo(c, litri, t);
    if (b <= 0) return no('non riesci a bere altro, hai lo stomaco pieno');
    // l'acqua del laghetto non trattata puo' avere batteri: ~15% di rischio per litro
    if (posto.acqua === 'lago' && casuale(mondo) < 1 - Math.pow(0.85, b)) ammala(c, 'gastroenterite', t);
    return { ok: true, esito: `bevuti ${b.toFixed(2)} litri a ${posto.nome}` };
  },

  mangia(mondo, c, a, t) {
    if (!a.cosa) return no('cosa mangi? scrivi il nome in "nome"');
    const M = MATERIALI[a.cosa];
    if (!M || (M.tipo !== 'cibo' && M.tipo !== 'seme')) return no(`${nomeDi(a.cosa)} non si mangia`);
    let lista = c.zaino; const p = pentolaDi(mondo, c);
    if (!quanto(lista, a.cosa) && p && quanto(p.contenuto || [], a.cosa)) lista = p.contenuto;
    if (!quanto(lista, a.cosa)) return no(`non hai ${nomeDi(a.cosa)} con te (prendilo prima)`);
    const pezzo = preleva(mondo, lista, a.cosa, lim(a.quanto ?? 0.3, 0.02, 1.5));
    if (pezzo.T > 70) { deponi(lista, pezzo); return no(`scotta (circa ${Math.round(pezzo.T)} gradi): aspetta un po'`); }
    const crudo = M.crudo || {}, digeribile = (crudo.digeribile ?? 1) * (pezzo.bruciato ? 0.5 : 1);
    const presi = mangiaCorpo(c, { kg: pezzo.kg, kcal: M.kcal, acqua: M.acqua, digeribile }, t);
    if (presi < pezzo.kg) { pezzo.kg = r3(pezzo.kg - presi); deponi(lista, pezzo); }
    if (presi <= 0) return no('sei troppo pieno per mangiare');
    // rischi veri: cibo crudo pericoloso, cibo andato a male
    let nota = '';
    if (crudo.rischio && casuale(mondo) < crudo.rischio) { ammala(c, crudo.malattia || 'gastroenterite', t); }
    if ((pezzo.guasto || 0) >= 1 && casuale(mondo) < 0.6) ammala(c, 'cibo_guasto', t);
    else if ((pezzo.guasto || 0) > 0.75 && casuale(mondo) < 0.12) ammala(c, 'cibo_guasto', t);
    if ((pezzo.guasto || 0) >= 1) nota = ' (aveva un odore strano)';
    if (pezzo.bruciato) nota += ' (era bruciato)';
    if ((c.umano || {}).igiene < 0.3 && casuale(mondo) < 0.04) ammala(c, 'gastroenterite', t);   // mani sporche
    if (!c.lavoro) lavoro(c, t, 'mangiare', Math.max(3, presi * 20), 'mangiare');
    if (!pezzo.bruciato && (pezzo.guasto || 0) < 0.7 && presi > 0.15) soddisfa(c, 0.05);
    return { ok: true, esito: `mangiati ${presi.toFixed(2)} kg di ${nomeDi(a.cosa)}${nota}` };
  },

  raccogli(mondo, c, a, t) {
    if (!a.cosa) return no('cosa raccogli? rami, ciliegie, argilla, erba secca, o il raccolto di un\'aiuola');
    const kg = lim(a.quanto ?? 2, 0.1, 20);
    if (pesoZaino(c) + kg > REGOLE_VITA.caricoMax) return no(`porti gia' ${pesoZaino(c).toFixed(1)} kg: al massimo ${REGOLE_VITA.caricoMax}`);
    if (a.cosa === 'rami' || a.cosa === 'legna' || a.cosa === 'ciliegie') {
      const campo = a.cosa === 'ciliegie' ? 'ciliegie' : 'rami';
      const alberi = mondo.alberi.filter(x => x[campo] > 0.2 && !c.stanza).sort((p, q) => dist(p, c) - dist(q, c));
      if (!alberi.length) return no(a.cosa === 'ciliegie' ? 'non ci sono ciliegie sugli alberi (maturano a fine maggio)' : 'sotto gli alberi non e\' rimasto legno secco: ricresce piano');
      const al = alberi[0];
      if (dist(al, c) > REGOLE_VITA.portataMani) return { vai: { x: al.x + 1.2, z: al.z + 1.2, nome: 'un albero' }, esito: 'vado verso l\'albero piu\' vicino' };
      const preso = Math.min(kg, al[campo]);
      return lavoro(c, t, 'raccogli', preso * (campo === 'rami' ? 5 : 6), 'raccogliere', { campo, albero: al.id, kg: preso });
    }
    if (a.cosa === 'argilla' || a.cosa === 'erba_secca') {
      if (!nelPosto(c, POSTI.laghetto)) return vaiA(POSTI.laghetto, 'vado alla riva del laghetto');
      if (a.cosa === 'erba_secca' && mondo.erbaLaghetto < 0.05) return no('l\'erba secca qui e\' finita, ricresce piano');
      const preso = a.cosa === 'erba_secca' ? Math.min(kg, mondo.erbaLaghetto, 1) : kg;
      return lavoro(c, t, 'raccogli', a.cosa === 'argilla' ? preso * 3 : preso * 30, 'raccogliere', { campo: a.cosa, kg: preso });
    }
    const coltura = Object.keys(COLTURE).find(k => COLTURE[k].prodotto === a.cosa || k === a.cosa);
    if (coltura) {
      const aiu = mondo.aiuole.filter(x => x.coltura === coltura && x.pronta).sort((p, q) => dist(p, c) - dist(q, c))[0];
      if (!aiu) return no(`non c'e' ${COLTURE[coltura].nome} maturo da raccogliere`);
      if (dist(aiu, c) > REGOLE_VITA.portataMani) return { vai: { x: aiu.x, z: aiu.z + 1.5, nome: 'l\'aiuola' }, esito: 'vado all\'aiuola' };
      return lavoro(c, t, 'raccogli', aiu.m2 * 15, 'raccogliere', { campo: 'aiuola', aiuola: aiu.id });
    }
    return no(`${nomeDi(a.cosa)} non si raccoglie qui`);
  },

  pesca(mondo, c, a, t) {
    if (!quanto(c.zaino, 'lenza')) return no('serve una lenza (in Dispensa ce ne sono)');
    if (!nelPosto(c, POSTI.laghetto)) return vaiA(POSTI.laghetto, 'vado al laghetto a pescare');
    const ore = lim(a.quanto ?? 1, 0.25, 6);
    return lavoro(c, t, 'pesca', ore * 60, 'pescare', { ore });
  },

  accendi(mondo, c, a, t) {
    if (aCasa(mondo, c)) {
      const k = casaDi(mondo, c), f = fornelloDi(mondo, k);
      if (k.staccato) return no('il gas e\' staccato: ci sono bollette da pagare');
      if (f.acceso) return { ok: true, esito: 'il fornello e\' gia\' acceso' };
      f.acceso = true; return { ok: true, esito: 'fornello a gas acceso (ricordati di spegnerlo: il gas si paga)' };
    }
    if (c.stanza) return no('dentro gli edifici non si accendono fuochi');
    const forno = /forno/i.test(a.luogo || a.nome || '');
    if (forno && !nelPosto(c, POSTI.forno)) return vaiA(POSTI.forno, 'vado al Forno');
    const fuocoForno = forno ? mondo.fuochi.find(f => f.id === 'forno') : null;
    if (fuocoForno && fuocoForno.acceso) return no('il forno e\' gia\' acceso');
    const esca = c.zaino.filter(q => q.cosa === 'erba_secca' && q.kg >= 0.03).sort((p, q) => p.umid - q.umid)[0];
    if (!esca) return no('serve un po\' di erba secca come esca');
    if (esca.umid > UMIDITA_MAX_ESCA) return no(`l'esca e' umida (${Math.round(esca.umid * 100)}% d'acqua): una scintilla non la accende. Asciugala o cercane di piu' asciutta`);
    const legni = c.zaino.filter(q => (q.cosa === 'rami' || q.cosa === 'legna') && q.umid <= UMIDITA_MAX_FUOCO);
    const kgLegno = legni.reduce((s, q) => s + q.kg, 0);
    if (kgLegno < 0.5) return no(`servono almeno 0,5 kg di rami o legna asciutti (sotto il ${Math.round(UMIDITA_MAX_FUOCO * 100)}% d'acqua)`);
    const frizione = /frizion|sfreg|trapano/i.test(a.nome || '') || !quanto(c.zaino, 'acciarino');
    if (frizione && legni.every(q => q.umid > 0.12)) return no('per accendere a frizione il legno deve essere secchissimo (sotto il 12%)');
    return lavoro(c, t, 'accendi', frizione ? 20 : 3, frizione ? 'frizione' : 'accendere', { frizione, forno: !!fuocoForno });
  },

  alimenta(mondo, c, a, t) {
    const f = fuocoVicino(mondo, c); if (!f) return no('non c\'e\' un fuoco vicino a te');
    const cosa = a.cosa === 'rami' ? 'rami' : 'legna';
    const presa = preleva(mondo, c.zaino, quanto(c.zaino, cosa) ? cosa : (cosa === 'legna' ? 'rami' : 'legna'), lim(a.quanto ?? 1.5, 0.1, 15));
    if (!presa) return no('non hai legna ne\' rami con te');
    f.legna.push({ kg: presa.kg, umid: presa.umid ?? 0.2 });
    return { ok: true, esito: `messi ${presa.kg.toFixed(1)} kg di ${nomeDi(presa.cosa)} nel fuoco (${f.acceso ? 'brucia' : 'e\' spento: va acceso'})` };
  },

  metti_sul_fuoco(mondo, c, a, t) {
    const f = fuocoVicino(mondo, c) || (nelPosto(c, POSTI.forno) ? mondo.fuochi.find(x => x.id === 'forno') : null);
    if (!f) return no('non c\'e\' un fuoco vicino a te');
    if (!a.cosa) return no('cosa ci metti?');
    const pezzo = preleva(mondo, c.zaino, a.cosa, lim(a.quanto ?? 99, 0.05, 99));
    if (!pezzo) return no(`non hai ${nomeDi(a.cosa)} con te`);
    const argilla = OGGETTI[a.cosa] && OGGETTI[a.cosa].materiale === 'argilla';
    if (argilla && f.gas) { deponi(c.zaino, pezzo); return no('sul fornello di casa l\'argilla non cuoce: servono 550 gradi per un\'ora, ci vuole un fuoco vero o una fornace'); }
    pezzo.modo = a.cosa === 'pentola' ? 'pentola' : argilla ? 'fiamme' : f.struttura === 'forno_pane' ? 'forno' : 'brace';   // sul fornello 'brace' = in padella
    pezzo.T = pezzo.T ?? (c.ambiente ? c.ambiente.tAria : 15);
    f.sopra.push(pezzo);
    return { ok: true, esito: `${nomeDi(a.cosa)} ${pezzo.modo === 'fiamme' ? 'nelle fiamme' : pezzo.modo === 'forno' ? 'nel forno' : f.gas ? (a.cosa === 'pentola' ? 'sul fornello' : 'in padella sul fornello') : 'sul fuoco'}` + (f.acceso ? '' : ' (il fuoco pero\' e\' spento)') };
  },

  togli_dal_fuoco(mondo, c, a, t) {
    const f = fuocoVicino(mondo, c) || (nelPosto(c, POSTI.forno) ? mondo.fuochi.find(x => x.id === 'forno') : null);
    if (!f) return no('non c\'e\' un fuoco vicino a te');
    const nomi = [a.cosa, a.cosa && a.cosa.replace(/_crud[ao]$/, ''), a.cosa === 'pesce' ? 'pesce_cotto' : null, a.cosa === 'impasto' ? 'pane' : null, a.cosa === 'uova' ? 'uova_cotte' : null].filter(Boolean);
    const i = f.sopra.findIndex(q => nomi.includes(q.cosa)); if (i < 0) return no(`sul fuoco non c'e' ${nomeDi(a.cosa)}`);
    const q = f.sopra.splice(i, 1)[0]; delete q.modo;
    if (pesoZaino(c) + q.kg > REGOLE_VITA.caricoMax + 5) { mondo.cose.push(Object.assign(q, { dove: 'terra', x: c.x, z: c.z })); return { ok: true, esito: `${nomeDi(q.cosa)} tolto dal fuoco e posato a terra (porti troppo)` }; }
    c.zaino.push(q);
    const descr = q.rotta ? ' ma e\' spaccato' : q.bruciato ? ', ma e\' bruciato' : '';
    return { ok: true, esito: `tolto dal fuoco: ${nomeDi(q.cosa)} (${Math.round(q.T)} gradi${q.contenuto ? ', dentro: ' + q.contenuto.map(w => `${w.kg.toFixed(2)} kg di ${nomeDi(w.cosa)}${w.bollita ? ' bollita' : ''}`).join(', ') : ''})${descr}` };
  },

  riempi(mondo, c, a, t) {
    const p = pentolaDi(mondo, c); if (!p) return no('ti serve una pentola');
    // al lavoro (o in un edificio con il bagno) c'e' l'acqua del rubinetto
    if ((c.lavoro && c.lavoro.tipo === 'lavora') || (c.stanza && BAGNI.includes(c.stanza))) {
      const b = beviCorpo(c, litri, t); if (b <= 0) return no('non riesci a bere altro, hai lo stomaco pieno');
      return { ok: true, esito: `bevuti ${b.toFixed(2)} litri d'acqua del rubinetto` };
    }
    const posto = postoDa(a.luogo) || (nelPosto(c, POSTI.laghetto) ? POSTI.laghetto : POSTI.fontana);
    if (!posto.acqua) return no('li\' non c\'e\' acqua');
    if (!c.zaino.includes(p)) return no('prima togli la pentola dal fuoco');
    if (!nelPosto(c, posto)) return vaiA(posto, 'vado a prendere acqua a ' + posto.nome);
    p.contenuto = p.contenuto || [];
    const occupato = p.contenuto.reduce((s, q) => s + q.kg / ((MATERIALI[q.cosa] || {}).densita || 1000) * 1000, 0);
    const litri = Math.min(lim(a.quanto ?? 2, 0.1, 3), OGGETTI.pentola.capacita - occupato);
    if (litri <= 0.01) return no('la pentola e\' piena');
    // acqua fredda in una pentola rovente: shock termico (la terracotta si crepa) e l'acqua in parte evapora subito
    const tAcqua = c.ambiente ? c.ambiente.tAria : 14, tPentola = p.T ?? tAcqua;
    if (tPentola - tAcqua > 250 && casuale(mondo) < 0.6) { p.rotta = true; return no('la pentola era ancora rovente: con l\'acqua fredda si e\' crepata (shock termico)'); }
    const acqua = p.contenuto.find(q => q.cosa === 'acqua');
    if (tPentola > tAcqua + 1) {
      // bilancio di energia tra pentola e acqua; sopra 100 gradi l'eccesso fa evaporare
      const Cp = p.kg * 850, Cw = litri * 4186, Tm = (Cp * tPentola + Cw * tAcqua) / (Cp + Cw);
      const evap = Tm > 100 ? Math.min(litri, (Tm - 100) * (Cp + Cw) / 2.257e6) : 0;
      p.T = Math.min(100, Tm);
      const restano = litri - evap;
      if (acqua) { acqua.kg = r3(acqua.kg + restano); acqua.T = p.T; } else p.contenuto.push(nuovaCosa(mondo, 'acqua', restano, { T: p.T, lago: posto.acqua === 'lago' }));
      const w = p.contenuto.find(q => q.cosa === 'acqua'); if (posto.acqua === 'lago') { w.lago = true; w.bollita = false; w.minBollore = 0; }
      return { ok: true, esito: `pentola riempita con ${litri.toFixed(1)} litri a ${posto.nome}` + (evap > 0.01 ? ` (era caldissima: ${evap.toFixed(2)} litri sono evaporati sfrigolando)` : '') };
    }
    if (acqua) { acqua.T = (acqua.T * acqua.kg + (c.ambiente ? c.ambiente.tAria : 14) * litri) / (acqua.kg + litri); acqua.kg = r3(acqua.kg + litri); if (posto.acqua === 'lago') { acqua.lago = true; acqua.bollita = false; acqua.minBollore = 0; } }
    else p.contenuto.push(nuovaCosa(mondo, 'acqua', litri, { T: c.ambiente ? c.ambiente.tAria : 14, lago: posto.acqua === 'lago' }));
    return { ok: true, esito: `pentola riempita con ${litri.toFixed(1)} litri a ${posto.nome}` };
  },

  aggiungi(mondo, c, a, t) {
    const p = pentolaDi(mondo, c); if (!p) return no('ti serve una pentola');
    if (!a.cosa || !MATERIALI[a.cosa]) return no('cosa metti nella pentola?');
    const pezzo = preleva(mondo, c.zaino, a.cosa, lim(a.quanto ?? 0.5, 0.02, 2.5));
    if (!pezzo) return no(`non hai ${nomeDi(a.cosa)} con te`);
    p.contenuto = p.contenuto || []; pezzo.T = (p.contenuto.find(q => q.cosa === 'acqua') || {}).T ?? pezzo.T; deponi(p.contenuto, pezzo);
    return { ok: true, esito: `${pezzo.kg.toFixed(2)} kg di ${nomeDi(a.cosa)} nella pentola` };
  },

  impasta(mondo, c, a, t) {
    const kg = Math.min(lim(a.quanto ?? 0.5, 0.1, 3), quanto(c.zaino, 'farina'));
    if (kg < 0.1) return no('serve farina');
    const serveAcqua = kg * 0.65, p = pentolaDi(mondo, c), acqua = p && (p.contenuto || []).find(q => q.cosa === 'acqua' && q.T < 50);
    const daFontana = nelPosto(c, POSTI.fontana);
    if (!daFontana && (!acqua || acqua.kg < serveAcqua)) return (acqua || p) ? no(`servono ${serveAcqua.toFixed(2)} litri d'acqua tiepida nella pentola`) : vaiA(POSTI.fontana, 'vado alla Fontana per l\'acqua dell\'impasto');
    if (!daFontana) acqua.kg = r3(acqua.kg - serveAcqua);
    const farina = preleva(mondo, c.zaino, 'farina', kg); const sale = preleva(mondo, c.zaino, 'sale', kg * 0.02);
    return lavoro(c, t, 'impasta', 10 + kg * 8, 'cucinare', { kg: farina.kg + serveAcqua + (sale ? sale.kg : 0), guasto: farina.guasto });
  },

  modella(mondo, c, a, t) {
    const ogg = { pentola: 'pentola_cruda', ciotola: 'ciotola_cruda', mattone: 'mattone_crudo' }[String(a.nome || '').toLowerCase().replace(/ .*/, '')];
    if (!ogg) return no('puoi modellare una pentola, una ciotola o un mattone');
    const serve = OGGETTI[ogg].kg;
    if (quanto(c.zaino, 'argilla') < serve) return no(`servono ${serve} kg di argilla (la trovi alla riva del Laghetto)`);
    preleva(mondo, c.zaino, 'argilla', serve);
    return lavoro(c, t, 'modella', { pentola_cruda: 40, ciotola_cruda: 15, mattone_crudo: 8 }[ogg], 'modellare', { ogg });
  },

  dormi(mondo, c, a, t) {
    if (c.lavoro && c.lavoro.tipo !== 'dormi') return no('stai facendo altro');
    if (c.sonno < 0.25 && !c.svenuto) return no('non hai sonno');
    const ore = lim(a.quanto ?? 8, 0.3, 12);
    c.addormentato = true;
    lavoro(c, t, 'dormi', ore * 60, 'dormire');
    return { ok: true, esito: `ti addormenti${aCasa(mondo, c) ? ' nel tuo letto' : c.stanza ? ' al chiuso' : ' all\'aperto'}` };
  },

  riposa(mondo, c, a, t) { return lavoro(c, t, 'riposa', lim(a.quanto ?? 20, 5, 240), 'riposare'); },

  semina(mondo, c, a, t) {
    const coltura = Object.keys(COLTURE).find(k => (a.nome || '').toLowerCase().includes(k.slice(0, 4)) || (a.cosa && a.cosa.includes(k)));
    if (!coltura) return no('cosa semini? grano, fave o spinaci');
    const C = COLTURE[coltura];
    const aiu = mondo.aiuole.filter(x => !x.coltura || x.morta).sort((p, q) => dist(p, c) - dist(q, c))[0];
    if (!aiu) return no('non ci sono aiuole libere');
    if (dist(aiu, c) > REGOLE_VITA.portataMani) return { vai: { x: aiu.x, z: aiu.z + 1.5, nome: 'un\'aiuola libera' }, esito: 'vado a un\'aiuola libera' };
    const serve = C.semi * aiu.m2;
    if (quanto(c.zaino, C.seme) < serve) return no(`servono ${(serve * 1000).toFixed(0)} g di ${nomeDi(C.seme)} per quest'aiuola di ${aiu.m2} m2`);
    preleva(mondo, c.zaino, C.seme, serve);
    return lavoro(c, t, 'semina', 10 + aiu.m2 * 8, 'seminare', { aiuola: aiu.id, coltura });
  },

  annaffia(mondo, c, a, t) {
    const aiu = mondo.aiuole.filter(x => dist(x, c) <= REGOLE_VITA.portataMani).sort((p, q) => dist(p, c) - dist(q, c))[0];
    if (!aiu) return no('non c\'e\' un\'aiuola vicino a te');
    const p = c.zaino.find(q => q.cosa === 'pentola'), acqua = p && (p.contenuto || []).find(q => q.cosa === 'acqua');
    if (!acqua || acqua.kg < 0.1) return no('ti serve una pentola con acqua');
    const l = Math.min(acqua.kg, lim(a.quanto ?? 2, 0.1, 3)); acqua.kg = r3(acqua.kg - l);
    aiu.acqua = Math.min(90, aiu.acqua + l / aiu.m2);
    return { ok: true, esito: `versati ${l.toFixed(1)} litri sull'aiuola (${aiu.m2} m2)` };
  },

  prendi(mondo, c, a, t) {
    if (!a.cosa) return no('cosa prendi?');
    const vicine = coseVicine(mondo, c).filter(q => q.cosa === a.cosa);
    if (!vicine.length) return dispensaQui(c) || !mondo.cose.some(q => q.dove === 'dispensa' && q.cosa === a.cosa) ? no(`qui non c'e' ${nomeDi(a.cosa)}`) : vaiA(POSTI.dispensa, 'vado alla Dispensa del Mercatino');
    const pezzi = OGGETTI[a.cosa] ? Math.max(1, Math.round(a.quanto ?? 1)) : 1;
    const presi = [];
    for (let i = 0; i < pezzi; i++) {
      const kg = OGGETTI[a.cosa] ? OGGETTI[a.cosa].kg : lim(a.quanto ?? 1, 0.01, REGOLE_VITA.caricoMax);
      if (pesoZaino(c) + kg > REGOLE_VITA.caricoMax) break;
      const sorgente = mondo.cose.filter(q => vicine.includes(q));
      const p = preleva(mondo, sorgente, a.cosa, kg); if (!p) break;
      // togli dal mondo i pezzi finiti o presi interi
      mondo.cose = mondo.cose.filter(q => !(vicine.includes(q) && (q === p || (!OGGETTI[q.cosa] && q.kg <= 0.0005))));
      delete p.dove; delete p.x; delete p.z; delete p.stanza;
      deponi(c.zaino, p); presi.push(p);
    }
    if (!presi.length) return no(`porti gia' ${pesoZaino(c).toFixed(1)} kg: troppo`);
    return { ok: true, esito: `presi ${OGGETTI[a.cosa] ? presi.length + ' ' + nomeDi(a.cosa) : presi.reduce((s, q) => s + q.kg, 0).toFixed(2) + ' kg di ' + nomeDi(a.cosa)}` };
  },

  lascia(mondo, c, a, t) {
    if (!a.cosa) return no('cosa lasci?');
    const p = preleva(mondo, c.zaino, a.cosa, OGGETTI[a.cosa] ? 1 : lim(a.quanto ?? 99, 0.01, 99));
    if (!p) return no(`non hai ${nomeDi(a.cosa)}`);
    if (aCasa(mondo, c) && (/frigo/i.test(a.luogo || '') || (MATERIALI[a.cosa] && MATERIALI[a.cosa].dura20))) { p.dove = 'frigo'; p.casa = c.id; }
    else if (dispensaQui(c)) { p.dove = 'dispensa'; } else { p.dove = 'terra'; p.x = c.x; p.z = c.z; if (c.stanza) p.stanza = c.stanza; }
    mondo.cose.push(p);
    return { ok: true, esito: `lasciato ${OGGETTI[a.cosa] ? '' : p.kg.toFixed(2) + ' kg di '}${nomeDi(a.cosa)} ${p.dove === 'frigo' ? 'in frigo' : p.dove === 'dispensa' ? 'in Dispensa' : aCasa(mondo, c) ? 'in casa' : 'a terra'}` };
  },

  casa(mondo, c, a, t) {
    if (aCasa(mondo, c)) return { ok: true, esito: 'sei gia\' a casa' };
    return vaiACasa(mondo, c, 'torno a casa') || no('non hai una casa');
  },

  spegni(mondo, c, a, t) {
    const f = aCasa(mondo, c) ? fornelloDi(mondo, casaDi(mondo, c)) : fuocoVicino(mondo, c);
    if (!f || !f.acceso) return no('non c\'e\' niente di acceso qui');
    if (!f.gas) { f.legna = []; f.acceso = false; return { ok: true, esito: 'hai spento il fuoco (la legna rimasta e\' bruciacchiata, non serve piu\')' }; }
    f.acceso = false; return { ok: true, esito: 'fornello spento' };
  },

  termostato(mondo, c, a, t) {
    if (!aCasa(mondo, c)) return no('il termostato e\' a casa tua');
    const k = casaDi(mondo, c); k.termostato = lim(a.quanto ?? 19, 10, 24);
    return { ok: true, esito: `termostato a ${k.termostato} gradi (adesso in casa ce ne sono ${k.T.toFixed(0)}). Ogni grado in piu' costa circa il 7% di gas in piu'` };
  },

  butta(mondo, c, a, t) {
    if (!a.cosa) return no('cosa butti?');
    const p = preleva(mondo, c.zaino, a.cosa, OGGETTI[a.cosa] ? 1 : lim(a.quanto ?? 99, 0.01, 99));
    if (!p) return no(`non hai ${nomeDi(a.cosa)}`);
    mondo.compost = Math.round(((mondo.compost || 0) + p.kg) * 1000) / 1000;   // la massa non sparisce: diventa compost
    return { ok: true, esito: `buttato nel compost: ${OGGETTI[a.cosa] ? nomeDi(a.cosa) : p.kg.toFixed(2) + ' kg di ' + nomeDi(a.cosa)}` };
  },

  compra(mondo, c, a, t) {
    const m = mondo.mercato; if (!m) return no('non c\'e\' un mercato');
    if (!a.cosa || !LISTINO[a.cosa]) return no(`al Mercatino non vendono ${a.nome || 'questo'}. Vendono: ${Object.keys(LISTINO).filter(k => m.scorte[k] > 0).map(nomeDi).join(', ')}`);
    if (!nelPosto(c, POSTI.dispensa)) return vaiA(POSTI.dispensa, 'vado al Mercatino');
    const pezzi = !!OGGETTI[a.cosa], q = pezzi ? Math.max(1, Math.round(a.quanto ?? 1)) : lim(a.quanto ?? 0.5, 0.05, 20);
    const disp = m.scorte[a.cosa] || 0;
    if (disp <= 0.001) return no(`${nomeDi(a.cosa)} oggi e' finito: ne arriva altro domattina`);
    const quanti = Math.min(q, disp), costo = Math.round(quanti * prezzoDi(m, a.cosa) * 100) / 100;
    if ((c.starlight ?? 0) < costo) return no(`costa ${costo} Starlight (${prezzoDi(m, a.cosa)} ${pezzi ? 'al pezzo' : 'al kg'}) e ne hai ${Math.floor(c.starlight ?? 0)}`);
    const kg = pezzi ? OGGETTI[a.cosa].kg * quanti : quanti;
    if (pesoZaino(c) + kg > REGOLE_VITA.caricoMax) return no('non riesci a portare tutto');
    c.starlight = Math.round((c.starlight - costo) * 100) / 100; m.scorte[a.cosa] = Math.round((disp - quanti) * 1000) / 1000; m.incasso += costo;
    m.compratoOggi[a.cosa] = (m.compratoOggi[a.cosa] || 0) + quanti;
    const tempo = tempoAdesso(mondo, t);
    if (pezzi) for (let i = 0; i < quanti; i++) c.zaino.push(nuovaCosa(mondo, a.cosa, OGGETTI[a.cosa].kg));
    else deponi(c.zaino, nuovaCosa(mondo, a.cosa, quanti, { T: tempo.tAria, guasto: a.cosa === 'pesce' ? 0.15 : a.cosa === 'pane' ? 0.1 : undefined }));
    return { ok: true, esito: `comprati ${pezzi ? quanti + ' ' + nomeDi(a.cosa) : quanti.toFixed(2) + ' kg di ' + nomeDi(a.cosa)} per ${costo} Starlight (ne restano ${Math.floor(c.starlight)})` };
  },

  vendi_al_mercatino(mondo, c, a, t) {
    const m = mondo.mercato; if (!m) return no('non c\'e\' un mercato');
    if (!a.cosa) return no('cosa vendi?');
    if (!((LISTINO[a.cosa] || [])[2])) return no(`il Mercatino non compra ${nomeDi(a.cosa)}`);
    const limite = limiteAcquisto(mondo.mercato, a.cosa) + (m.vendutoOggi[a.cosa] || 0);
    if (!nelPosto(c, POSTI.dispensa)) return vaiA(POSTI.dispensa, 'vado al Mercatino a vendere');
    const resta = limite - (m.vendutoOggi[a.cosa] || 0);
    if (resta <= 0.001) return no(`oggi il Mercatino ha gia' abbastanza ${nomeDi(a.cosa)} per i suoi clienti: torna domani`);
    const pezzi = !!OGGETTI[a.cosa];
    const p = preleva(mondo, c.zaino, a.cosa, pezzi ? 1 : Math.min(resta, lim(a.quanto ?? 99, 0.05, 99)));
    if (!p) return no(`non hai ${nomeDi(a.cosa)}`);
    if (p.rotta || p.bruciato || (p.guasto || 0) >= 0.8) { deponi(c.zaino, p); return no('cosi\' rovinato non lo compra nessuno'); }
    const quanti = pezzi ? 1 : p.kg, ricavo = Math.round(quanti * prezzoAcquisto(m, a.cosa) * (p.guasto > 0.5 ? 0.6 : 1) * 100) / 100;
    c.starlight = Math.round(((c.starlight ?? 0) + ricavo) * 100) / 100; m.pagato += ricavo;
    m.vendutoOggi[a.cosa] = (m.vendutoOggi[a.cosa] || 0) + quanti; m.scorte[a.cosa] = (m.scorte[a.cosa] || 0) + quanti;
    soddisfa(c, 0.08);
    return { ok: true, esito: `venduti ${pezzi ? '1 ' + nomeDi(a.cosa) : quanti.toFixed(2) + ' kg di ' + nomeDi(a.cosa)} per ${ricavo} Starlight (ora ne hai ${Math.floor(c.starlight)})` };
  },

  turno(mondo, c, a, t) {
    const id = cercaMestiere(a.nome || a.luogo); if (!id) return no('che mestiere? ' + Object.keys(MESTIERI).join(', '));
    const M = MESTIERI[id];
    const posto = { nome: M.luogo, x: M.x, z: M.z, raggio: 5 };
    if (!(M.alChiuso && c.stanza === 'biblioteca') && (c.stanza || Math.hypot(c.x - M.x, c.z - M.z) > 5)) return vaiA(posto, 'vado al lavoro: ' + M.luogo);
    const h = oraRoma(t), oreMax = Math.min(lim(a.quanto ?? 4, 0.5, 10), M.alle - h - (new Date(t).getUTCMinutes() / 60), ORE_MAX_GIORNO - (c.oreLavoroOggi || 0));
    if (h < M.dalle || h >= M.alle) return no(`${M.luogo} cerca un ${M.nome} solo dalle ${M.dalle} alle ${M.alle}`);
    if (oreMax < 0.25) return no((c.oreLavoroOggi || 0) >= ORE_MAX_GIORNO ? `oggi hai gia' lavorato ${ORE_MAX_GIORNO} ore` : 'il turno sta finendo, non ha senso cominciare ora');
    const occupati = Object.values(mondo.corpi).filter(o => o !== c && o.lavoro && o.lavoro.tipo === 'lavora' && o.lavoro.mestiere === id).length;
    if (occupati >= M.posti) return no(`il posto di ${M.nome} e' gia' occupato`);
    if (c.sonno > 1.4 || c.salute < 30) return no('non ce la fai a lavorare in queste condizioni');
    if (M.alChiuso) c.stanza = 'biblioteca';
    const r = lavoro(c, t, 'lavora', oreMax * 60, 'lavorare', { mestiere: id, met: M.met, paga: pagaOraria(M, (c.esperienza || {})[id]) });
    return { ok: true, esito: `turno da ${M.nome} iniziato: ${oreMax.toFixed(1)} ore a ${r && c.lavoro.paga} Starlight l'ora`, minuti: oreMax * 60 };
  },

  bagno(mondo, c, a, t) {
    // al lavoro c'e' il bagno del personale
    if (c.lavoro && c.lavoro.tipo === 'lavora') { c.umano.vescica = 0; return { ok: true, esito: 'pausa: sei andato nel bagno del personale' }; }
    if (!bagnoQui(mondo, c)) return versoUnBagno(mondo, c, 'vado in bagno');
    c.umano.vescica = 0;
    if (aCasa(mondo, c)) casaDi(mondo, c).acquaL += 6;   // lo sciacquone: ~6 litri
    return { ok: true, esito: 'sei andato in bagno' };
  },

  lavati(mondo, c, a, t) {
    if (aCasa(mondo, c)) {
      const d = doccia(casaDi(mondo, c));
      c.umano.igiene = d.calda ? 1 : 0.9; lavoro(c, t, 'lavati', 15, 'lavarsi');
      return { ok: true, esito: d.calda ? `doccia calda a casa (${d.litri} litri d'acqua a ${CASA.docciaT} gradi): sei pulito` : 'il gas e\' staccato: doccia gelata. Pulito, ma che freddo' };
    }
    if (c.stanza && BAGNI.includes(c.stanza)) { c.umano.igiene = 1; return lavoro(c, t, 'lavati', 15, 'lavarsi'), { ok: true, esito: 'ti lavi con l\'acqua calda: sei pulito' }; }
    if (!nelPosto(c, POSTI.fontana)) return versoUnBagno(mondo, c, 'vado a lavarmi');
    // alla fontana: acqua fredda, ci si bagna (e d'inverno si gela)
    c.umano.igiene = Math.max(c.umano.igiene, 0.8); c.bagnato = Math.max(c.bagnato || 0, 0.5);
    lavoro(c, t, 'lavati', 6, 'lavarsi');
    return { ok: true, esito: 'ti sei lavato alla fontana: pulito, ma bagnato e con l\'acqua gelata' };
  },

  svago(mondo, c, a, t) {
    const ore = lim(a.quanto ?? 1, 0.25, 4);
    return lavoro(c, t, 'svago', ore * 60, 'svago', { dove: a.luogo || null });
  },

  chiacchiera(mondo, c, a, t) {
    const altro = mondo.corpi[String(a.a || '').toLowerCase()] || Object.values(mondo.corpi).find(o => o !== c && !o.morto && (o.stanza || null) === (c.stanza || null) && dist(o, c) <= 4);
    if (!altro || altro === c || altro.morto) return no('non c\'e\' nessuno con cui parlare qui vicino');
    if ((altro.stanza || null) !== (c.stanza || null) || dist(altro, c) > 4) return no(`${altro.id} e' troppo lontano per chiacchierare`);
    if (altro.addormentato || altro.svenuto) return no(`${altro.id} dorme`);
    const min = lim(a.quanto ?? 20, 5, 120);
    for (const o of [c, altro]) { o.umano.solitudine = Math.max(0, o.umano.solitudine - min / 60 * 0.6); soddisfa(o, 0.05); }
    if ((c.umano.igiene ?? 1) < 0.25) altro.umano.solitudine += 0.1;   // chi puzza si sta meno volentieri vicino
    if (!altro.lavoro) lavoro(altro, t, 'chiacchiera', min, 'riposare');
    return lavoro(c, t, 'chiacchiera', min, 'riposare', { con: altro.id });
  },

  dai(mondo, c, a, t) {
    const altro = mondo.corpi[String(a.a || '').toLowerCase()];
    if (!altro || altro === c) return no('a chi? metti il suo nome in "id"');
    if ((altro.stanza || null) !== (c.stanza || null) || dist(altro, c) > 3) return no(`${altro.id} non e' abbastanza vicino (serve stare entro 3 metri)`);
    if (!a.cosa) return no('cosa dai?');
    const p = preleva(mondo, c.zaino, a.cosa, OGGETTI[a.cosa] ? 1 : lim(a.quanto ?? 0.5, 0.01, 99));
    if (!p) return no(`non hai ${nomeDi(a.cosa)}`);
    deponi(altro.zaino, p);
    (altro.esiti || (altro.esiti = [])).push(`${c.id} ti ha dato ${OGGETTI[a.cosa] ? '' : p.kg.toFixed(2) + ' kg di '}${nomeDi(a.cosa)}`);
    return { ok: true, esito: `dato ${nomeDi(a.cosa)} a ${altro.id}` };
  }
};

// ---- fine di un lavoro: qui avviene davvero quello che si e' fatto ----
export function completaLavoro(mondo, c, L, t) {
  const sale = n => (c.abilita[n] = Math.min(1, (c.abilita[n] || 0) + (1 - (c.abilita[n] || 0)) * 0.06));
  const tempo = tempoAdesso(mondo, t);
  if (L.tipo === 'raccogli') {
    if (L.campo === 'rami' || L.campo === 'ciliegie') {
      const al = mondo.alberi.find(x => x.id === L.albero); const kg = Math.min(L.kg, al ? al[L.campo] : 0);
      if (al) { al[L.campo] -= kg; if (L.campo === 'ciliegie' && al.ciliegie < 0.2) al.raccoltoAnno = true; }
      if (kg <= 0) return 'non c\'era piu\' niente da raccogliere';
      deponi(c.zaino, nuovaCosa(mondo, L.campo, kg, { T: tempo.tAria, umid: L.campo === 'rami' ? (tempo.piove ? 0.4 : (mondo.meteo && mondo.meteo.pioggiaMm > 0 ? 0.3 : 0.22)) : undefined }));
      return `raccolti ${kg.toFixed(1)} kg di ${nomeDi(L.campo)}` + (L.campo === 'rami' && tempo.piove ? ' (bagnati dalla pioggia)' : '');
    }
    if (L.campo === 'argilla') { deponi(c.zaino, nuovaCosa(mondo, 'argilla', L.kg, { T: tempo.tAria })); return `raccolti ${L.kg.toFixed(1)} kg di argilla bagnata`; }
    if (L.campo === 'erba_secca') {
      const kg = Math.min(L.kg, mondo.erbaLaghetto); mondo.erbaLaghetto -= kg;
      const umid = tempo.piove ? 0.5 : (mondo.meteo && mondo.meteo.pioggiaMm > 0 ? 0.3 : 0.12);
      deponi(c.zaino, nuovaCosa(mondo, 'erba_secca', kg, { umid }));
      return `raccolti ${kg.toFixed(2)} kg di erba secca` + (umid > UMIDITA_MAX_ESCA ? ' (e\' umida: va fatta asciugare)' : '');
    }
    if (L.campo === 'aiuola') {
      const aiu = mondo.aiuole.find(x => x.id === L.aiuola); if (!aiu || !aiu.pronta) return 'il raccolto non c\'era piu\'';
      const C = COLTURE[aiu.coltura];
      const d = new Date(aiu.seminato || t), primavera = C === COLTURE.grano && d.getUTCMonth() >= 2 && d.getUTCMonth() <= 8 ? 0.2 : 1;
      const kg = C.resa * aiu.m2 * primavera * (aiu.caldo > 24 * 5 ? 0.3 : 1);
      deponi(c.zaino, nuovaCosa(mondo, C.prodotto, kg, { T: tempo.tAria }));
      Object.assign(aiu, { coltura: null, gdd: 0, pronta: false, morta: false, caldo: 0, seminato: null });
      return `raccolti ${kg.toFixed(2)} kg di ${C.nome}`;
    }
  }
  if (L.tipo === 'pesca') {
    const presi = pescaNelLago(mondo, mondo.laghetto, L.ore, c.abilita.pesca || 0); sale('pesca');
    for (const kg of presi) deponi(c.zaino, nuovaCosa(mondo, 'pesce', kg, { T: tempo.tAria }));
    return presi.length ? `pescati ${presi.length} pesci (${presi.reduce((s, k) => s + k, 0).toFixed(2)} kg)` : `in ${L.ore} ore non hai preso niente`;
  }
  if (L.tipo === 'accendi') {
    const p = L.frizione ? 0.12 + 0.5 * (c.abilita.fuoco || 0) : 0.97;
    sale('fuoco');
    if (casuale(mondo) > p) return L.frizione ? 'hai sfregato a lungo ma il fuoco non e\' partito (e sei sudato)' : 'le scintille non hanno preso';
    const esca = preleva(mondo, c.zaino, 'erba_secca', 0.05);
    // si usa la legna asciutta che si ha con se': fino a 3 kg
    const legna = [];
    for (const nome of ['rami', 'legna']) { const disp = quanto(c.zaino, nome); if (disp > 0 && legna.reduce((s, l) => s + l.kg, 0) < 3) { const p2 = preleva(mondo, c.zaino, nome, Math.min(disp, 3 - legna.reduce((s, l) => s + l.kg, 0))); if (p2) legna.push({ kg: p2.kg, umid: p2.umid ?? 0.2 }); } }
    legna.push({ kg: esca ? esca.kg : 0.05, umid: esca ? esca.umid : 0.1 });
    // si riaccende il fuoco spento che c'e' gia' li' (o il forno), altrimenti se ne fa uno nuovo
    let f = L.forno ? mondo.fuochi.find(x => x.id === 'forno') : mondo.fuochi.find(x => !x.fisso && !x.acceso && dist(x, c) <= 2);
    if (f) { f.legna.push(...legna); f.acceso = true; }
    else { f = { id: 'fuoco' + (mondo.prossimoId++), struttura: 'aperto', x: c.x, z: c.z, legna, T: tempo.tAria, acceso: true, sopra: [], acceso_da: c.id }; mondo.fuochi.push(f); }
    registra(mondo, { tipo: 'fuoco_acceso', chi: c.id, fuoco: f.id, x: f.x, z: f.z });
    return `fuoco acceso${L.forno ? ' nel forno' : ''} con ${legnaNelFuoco(f).toFixed(1)} kg di legna`;
  }
  if (L.tipo === 'impasta') { deponi(c.zaino, nuovaCosa(mondo, 'impasto', L.kg, { T: tempo.tAria, guasto: 0 })); sale('cucina'); return `pronti ${L.kg.toFixed(2)} kg di impasto (va cotto: brace o forno)`; }
  if (L.tipo === 'modella') {
    sale('argilla');
    const q = nuovaCosa(mondo, L.ogg, OGGETTI[L.ogg].kg, { secca: 0 });
    // una mano inesperta sbaglia spesso le pareti: il pezzo viene male e si sbriciola
    if (casuale(mondo) > 0.55 + 0.45 * (c.abilita.argilla || 0)) return `la ${nomeDi(L.ogg)} e' venuta storta e si e' afflosciata: l'argilla torna nel mucchio` + (deponi(c.zaino, nuovaCosa(mondo, 'argilla', OGGETTI[L.ogg].kg)) || '');
    c.zaino.push(q);
    return `modellata: ${nomeDi(L.ogg)} (ora deve asciugare qualche giorno all'aria prima di andare nel fuoco)`;
  }
  if (L.tipo === 'semina') {
    const aiu = mondo.aiuole.find(x => x.id === L.aiuola);
    Object.assign(aiu, { coltura: L.coltura, gdd: 0, pronta: false, morta: false, seminato: t, secco: 0, caldo: 0 });
    return `seminato ${COLTURE[L.coltura].nome} (${aiu.m2} m2)`;
  }
  if (L.tipo === 'lavora') {
    // si paga il tempo davvero lavorato; l'umore cambia quanto si rende (e quanto si impara)
    const ore = (Math.min(t, L.fine) - L.inizio) / 3600000, M = MESTIERI[L.mestiere];
    const paga = Math.round(ore * L.paga * 100) / 100;
    c.starlight = Math.round(((c.starlight ?? 0) + paga) * 100) / 100;
    c.esperienza = c.esperienza || {}; c.esperienza[L.mestiere] = (c.esperienza[L.mestiere] || 0) + ore * rendimento(c);
    c.oreLavoroOggi = (c.oreLavoroOggi || 0) + ore;
    if (M.alChiuso && c.stanza === 'biblioteca') c.stanza = null;
    for (const [cosa, kg] of Object.entries(M.extra || {})) deponi(c.zaino, nuovaCosa(mondo, cosa, kg, { T: tempo.tAria, guasto: 0.1 }));
    soddisfa(c, 0.12);
    return `turno da ${M.nome} finito: ${ore.toFixed(1)} ore, pagati ${paga} Starlight (ora ne hai ${Math.floor(c.starlight)}). Esperienza da ${M.nome}: ${Math.round(competenza(c.esperienza[L.mestiere]) * 100)}%` + (M.extra ? ', e ti hanno dato il pane avanzato' : '');
  }
  if (L.tipo === 'svago') { c.umano.noia = Math.max(0, c.umano.noia - 0.3 * (L.fine - L.inizio) / 3600000); soddisfa(c, 0.1); return 'ti sei svagato, la testa e\' piu\' leggera'; }
  if (L.tipo === 'mangiare' || L.tipo === 'riposa' || L.tipo === 'lavati' || L.tipo === 'chiacchiera') return null;
  return null;
}
