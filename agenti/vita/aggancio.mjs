// =====================================================================
//  VITA - AGGANCIO AL MOTORE DEGLI AGENTI (agenti/motore.mjs)
//  Pronto ma NON ancora collegato: motore.mjs non lo importa, quindi Ada
//  e Teo dal vivo non cambiano. Quando Boris dice si', il collegamento
//  sono poche righe in motore.mjs, tutte dietro REGOLE.vita (spenta):
//
//   passo():        if (regole.vita) passoVita(stato, adesso)          (prima di avanza)
//   esegui():       if (a.vita) return azioneVita(stato, ag, a, adesso) (per i tipi di TIPI_VITA)
//   avanza():       if (regole.vita && occupato(stato, ag)) return     (aspetta che finisca il lavoro)
//   normalizzaAzione(): const v = normalizzaAzioneVita(a); if (v) return v;
//   promptBase():   + promptVita()
//   percezione():   + percezioneAgente(stato, ag, adesso)
//   SCHEMA:         aggiungere i TIPI_VITA all'enum di "tipo"
// =====================================================================
import { nuovoMondo, passoMondo, REGOLE_VITA } from './mondo.mjs';
import { eseguiAzioneVita, normalizzaAzioneVita, promptAzioniVita, TIPI_VITA } from './azioni.mjs';
import { percezioneVita, esitiLetti } from './percezione.mjs';
import { decidiARegole } from './cervello-regole.mjs';

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
  const posizioni = Object.fromEntries(Object.values(stato.agenti).map(a => [a.id, { x: a.x, z: a.z, stanza: a.stanza || null }]));
  const eventi = passoMondo(mondo, adesso, regole, posizioni);
  for (const e of eventi) {
    const ag = stato.agenti[e.chi]; if (!ag) continue;
    // svenuto senza morte: viene portato al chiuso (in Biblioteca). Il motore lo sposta davvero.
    if (e.tipo === 'svenuto' && e.portatoIn) { ag.stanza = e.portatoIn; ag.x = 0; ag.z = 6; ag.tx = 0; ag.tz = 6; ag.coda = []; }
    if (['svenuto', 'morte', 'lavoro_finito', 'crollo_sonno', 'rinviene'].includes(e.tipo)) ag.diario && ag.diario.push({ t: adesso, s: testoEvento(e) });
  }
  return eventi;
}
function testoEvento(e) {
  return { svenuto: `Sono svenuto (${e.causa}). Mi sono risvegliato al chiuso.`, morte: `(morto per ${e.causa})`, crollo_sonno: 'Sono crollato dal sonno.', rinviene: 'Mi sono ripreso.', lavoro_finito: e.esito }[e.tipo] || e.tipo;
}

// Il motore chiede di eseguire un'azione del corpo. Se serve camminare prima, restituisce { cammina: {x, z} }:
// il motore mette un "vai" in testa alla coda e ripete l'azione all'arrivo.
export function azioneVita(stato, ag, a, adesso) {
  const mondo = assicuraVita(stato, adesso);
  const c = mondo.corpi[ag.id]; if (c) { c.x = ag.x; c.z = ag.z; c.stanza = ag.stanza || null; }
  const r = eseguiAzioneVita(mondo, ag.id, a, adesso);
  if (r.vai) return { cammina: { x: r.vai.x, z: r.vai.z, dove: r.vai.nome }, esito: r.esito };
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
