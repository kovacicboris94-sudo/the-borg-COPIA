// =====================================================================
//  VITA - AGGANCIO AL MOTORE DEGLI AGENTI (agenti/motore.mjs)
//  COLLEGATO dal 21/11/2026 (Boris: "Carica tutto vai"), dietro REGOLE.vita in motore.mjs:
//   passo():        passoVita(stato, adesso) prima di avanza; chi e' morto o occupato non pensa
//   esegui():       le azioni con a.vita passano da azioneVita (se serve camminare: si cammina, si entra, si ripete)
//   avanza():       se il corpo e' occupato (dorme, pesca, turno...) si resta fermi;
//                   da fermi, i bisogni urgenti (bisognoUrgente) li soddisfa il cervello a regole, gratis
//   normalizzaAzione(), promptBase(), percezione(), SCHEMA: le azioni e la percezione del corpo
//   vistaPubblica(): vistaVita (corpo e casette per il gioco)
//  I soldi sono uno solo: gli Starlight del gioco (ag.starlight). La vita li
//  legge prima di ogni passo e li riscrive dopo (paghe, acquisti, vendite).
// =====================================================================
import { nuovoMondo, passoMondo, REGOLE_VITA } from './mondo.mjs';
import { eseguiAzioneVita, normalizzaAzioneVita, promptAzioniVita, TIPI_VITA } from './azioni.mjs';
import { percezioneVita, esitiLetti } from './percezione.mjs';
import { decidiARegole } from './cervello-regole.mjs';
import { porzioneDi, consumaPorzione, chiavePorzione } from './porzioni.mjs';

export { normalizzaAzioneVita, TIPI_VITA };
export const promptVita = promptAzioniVita;

// Il mondo della vita vive dentro lo stato salvato del borgo (stato.vita), cosi' si salva con tutto il resto.
export function assicuraVita(stato, adesso) {
  if (!stato.vita) {
    const posizioni = Object.fromEntries(Object.values(stato.agenti).map(a => [a.id, { x: a.x, z: a.z, stanza: a.stanza || null }]));
    stato.vita = nuovoMondo({ adesso, seme: (adesso % 2147483647) >>> 0, abitanti: Object.keys(stato.agenti), posizioni });
  }
  return stato.vita;
}

// Un passo: le posizioni vengono dal motore (che fa camminare gli agenti), il resto lo calcola la vita.
export function passoVita(stato, adesso, regole = REGOLE_VITA) {
  const mondo = assicuraVita(stato, adesso);
  const posizioni = Object.fromEntries(Object.values(stato.agenti).map(a => [a.id, { x: a.x, z: a.z, stanza: a.stanza || null, attivita: attivitaMotore(stato, a) }]));
  portafogli(stato, mondo, 'dentro');
  const eventi = passoMondo(mondo, adesso, regole, posizioni);
  portafogli(stato, mondo, 'fuori');
  for (const e of eventi) {
    const ag = stato.agenti[e.chi]; if (!ag) continue;
    // svenuto senza morte: viene portato al chiuso (in Biblioteca). Il motore lo sposta davvero.
    if (e.tipo === 'svenuto' && e.portatoIn) { ag.stanza = e.portatoIn; ag.x = 0; ag.z = 6; ag.tx = 0; ag.tz = 6; ag.coda = []; }
    if (e.tipo === 'morte') { ag.morto = { t: adesso, causa: e.causa }; ag.coda = []; ag.tx = ag.x; ag.tz = ag.z; }
    if (['svenuto', 'morte', 'lavoro_finito', 'crollo_sonno', 'rinviene'].includes(e.tipo)) ag.diario && ag.diario.push({ t: adesso, s: testoEvento(e) });
  }
  return eventi;
}
// Un solo portafoglio: quello del gioco. 'dentro' copia ag.starlight nel corpo, 'fuori' lo riporta indietro.
function portafogli(stato, mondo, verso) {
  for (const ag of Object.values(stato.agenti)) {
    const c = mondo.corpi[ag.id]; if (!c) continue;
    if (verso === 'dentro') { if (typeof ag.starlight === 'number') c.starlight = ag.starlight; }
    else if (typeof c.starlight === 'number') ag.starlight = c.starlight;
  }
}
function testoEvento(e) {
  return { svenuto: `Sono svenuto (${e.causa}). Mi sono risvegliato al chiuso.`, morte: `(morto per ${e.causa})`, crollo_sonno: 'Sono crollato dal sonno.', rinviene: 'Mi sono ripreso.', lavoro_finito: e.esito }[e.tipo] || e.tipo;
}

// Il motore chiede di eseguire un'azione del corpo. Se serve camminare prima, restituisce { cammina: {x, z} }:
// il motore mette un "vai" in testa alla coda e ripete l'azione all'arrivo.
export function azioneVita(stato, ag, a, adesso) {
  const mondo = assicuraVita(stato, adesso);
  // le posizioni di TUTTI vengono dal motore adesso, non dall'inizio del passo: prima "dai" e "chiacchiera"
  // vedevano l'altro dov'era fino a 30 secondi fa ("troppo lontano" anche a un metro, 22/11/2026)
  for (const o of Object.values(stato.agenti)) { const k = mondo.corpi[o.id]; if (k && !k.morto) { k.x = o.x; k.z = o.z; k.stanza = o.stanza || null; } }
  const c = mondo.corpi[ag.id]; if (c && typeof ag.starlight === 'number') c.starlight = ag.starlight;
  const r = eseguiAzioneVita(mondo, ag.id, a, adesso);
  if (c && typeof c.starlight === 'number') ag.starlight = c.starlight;
  if (r.vai) return { cammina: { x: r.vai.x, z: r.vai.z, dove: r.vai.nome, entra: r.vai.entra || null }, esito: r.esito };
  return r;
}

// "mangia"/"bevi" una cosa comprata ai negozi (nello zaino del borgo, ag.zaino): passa dal corpo come il cibo vero.
// Restituisce null se quella cosa non e' nello zaino del borgo (allora decide la vita vera, come prima).
export function mangiaDalloZaino(stato, ag, a, adesso) {
  const z = ag.zaino || {}, k = Object.keys(z).find(x => z[x] > 0 && chiavePorzione(x) === chiavePorzione(a.nome));
  if (!k) return null;
  const P = porzioneDi(k);
  if (!P) return { ok: false, esito: `${k} non si ${a.tipo === 'bevi' ? 'beve' : 'mangia'}` };
  const mondo = assicuraVita(stato, adesso), c = mondo.corpi[ag.id];
  if (!c || c.morto) return { ok: false, esito: 'sei morto' };
  if (c.svenuto || c.addormentato) return { ok: false, esito: 'stai dormendo' };
  const av = ag.avanzi || (ag.avanzi = {});
  const r = consumaPorzione(c, k, P, av[k], adesso, a.tipo);
  if (!r.ok) return r;
  if (r.finita) { z[k]--; if (z[k] <= 0) delete z[k]; delete av[k]; } else av[k] = r.resta;
  return r;
}

// Il corpo sta facendo qualcosa che richiede tempo (pescare, dormire, cucinare...): il motore aspetta.
export const occupato = (stato, ag) => !!(stato.vita && stato.vita.corpi[ag.id] && (stato.vita.corpi[ag.id].lavoro || stato.vita.corpi[ag.id].svenuto || stato.vita.corpi[ag.id].morto));

export function percezioneAgente(stato, ag, adesso) {
  if (!stato.vita) return '';
  const p = percezioneVita(stato.vita, ag.id, adesso);
  esitiLetti(stato.vita, ag.id);
  return p;
}

// Quando il budget e' finito l'agente vive "in automatico": il cervello a regole lo tiene in vita gratis.
export const routineVita = (stato, ag, adesso) => (stato.vita ? decidiARegole(stato.vita, ag.id, adesso) : []);

// Quello che fa il corpo per il motore: camminare, costruire, stare al bancone (pesa sul metabolismo).
function attivitaMotore(stato, ag) {
  if (ag.lavoro) return ag.lavoro.tipo === 'usa' ? 'svago' : 'costruire';
  if ((stato.turni || {})[ag.id]) return 'lavorare';
  if (Math.hypot((ag.tx ?? ag.x) - ag.x, (ag.tz ?? ag.z) - ag.z) > 0.5) return 'camminare';
  return null;
}

// Un bisogno che non aspetta (sete, bagno, sonno di notte, fame vera): il corpo ci pensa da solo, gratis,
// anche se l'agente "pensante" non se ne occupa. Restituisce il motivo, o null.
export function bisognoUrgente(stato, ag, adesso) {
  const c = stato.vita && stato.vita.corpi[ag.id];
  if (!c || c.morto || c.svenuto || c.lavoro) return null;
  const dis = (c.acquaNormale - c.acqua) / c.peso, h = +new Intl.DateTimeFormat('it-IT', { timeZone: 'Europe/Rome', hour: 'numeric', hourCycle: 'h23' }).format(new Date(adesso));
  if (dis > 0.015) return 'sete';
  const k = stato.vita.case && stato.vita.case[ag.id], fo = k && stato.vita.fuochi.find(q => q.id === 'fornello:' + k.id);
  if (fo && fo.acceso && !(fo.sopra || []).length) return 'fornello';
  if (c.umano && c.umano.vescica > 0.4) return 'bagno';
  if (c.sonno > 1.25 || ((h >= 23 || h < 6) && c.sonno > 0.6)) return 'sonno';
  if (c.glicogeno < 1000 && c.stomaco.kcal < 250) return 'fame';
  if (c.temperatura < 36) return 'freddo';
  return null;
}

// Il piano del cervello a regole tradotto nelle azioni del motore (che sa camminare ed entrare negli edifici).
export function pianoPerMotore(piano, stanze) {
  const fuori = [];
  for (const a of piano) {
    if (a.tipo === 'entra_biblioteca') fuori.push({ tipo: 'entra', stanza: 'biblioteca', auto: true, vitaAuto: true, riflesso: true });
    else if (a.tipo === 'vai') {
      if (a.entra && stanze.some(q => q.id === a.entra)) fuori.push({ tipo: 'entra', stanza: a.entra, auto: true, vitaAuto: true, riflesso: true });
      else fuori.push({ tipo: 'esci', auto: true, riflesso: true }, { tipo: 'vai', x: a.x, z: a.z, auto: true, riflesso: true });
    } else if (TIPI_VITA.includes(a.tipo)) fuori.push(Object.assign({}, a, { vita: true, auto: true, riflesso: true }));
  }
  return fuori;
}

// Per il gioco (scheda dell'agente e casette): come sta il corpo, in poche cifre.
export function vistaVita(stato) {
  const m = stato.vita; if (!m) return null;
  const corpi = {};
  for (const [id, c] of Object.entries(m.corpi)) {
    const dis = (c.acquaNormale - c.acqua) / c.peso;
    corpi[id] = { salute: Math.round(c.salute), fame: +Math.max(0, Math.min(1, 1 - c.glicogeno / 1800)).toFixed(2), sete: +Math.max(0, Math.min(1, dis / 0.04)).toFixed(2),
      sonno: +Math.max(0, Math.min(1, c.sonno / 1.4)).toFixed(2), temperatura: +c.temperatura.toFixed(1), peso: +c.peso.toFixed(1),
      fa: c.morto ? 'morto' : c.svenuto ? 'svenuto' : c.addormentato ? 'dorme' : c.lavoro ? c.lavoro.tipo : null,
      malato: (c.malattie || []).map(q => q.tipo), umore: c.umano ? +c.umano.umore.toFixed(2) : null };
  }
  const case_ = {};
  for (const k of Object.values(m.case || {})) {
    const f = (m.fuochi || []).find(q => q.id === 'fornello:' + k.id);
    case_[k.stanza] = { T: +k.T.toFixed(1), fornello: !!(f && f.acceso), staccato: !!k.staccato, debito: k.debito, bolletta: k.bollette.length ? k.bollette[k.bollette.length - 1].importo : null };
  }
  return { corpi, case: case_, prezzi: m.mercato ? m.mercato.prezzi : null };
}
