// =====================================================================
//  VITA - COSA SENTE E VEDE UN ABITANTE
//  Dallo stato vero del mondo si ricava solo quello che una persona in
//  quel punto saprebbe: come si sente (a parole, senza numeri del corpo),
//  che tempo fa, cosa ha con se', cosa c'e' intorno a lei. Il resto non
//  lo sa. Testo corto, per spendere pochi token.
// =====================================================================
import { sensazioni } from './corpo.mjs';
import { tempoAdesso, descriviTempo, statoPianta } from './natura.mjs';
import { MATERIALI, OGGETTI, nomeDi } from './materiali.mjs';
import { POSTI, REGOLE_VITA } from './mondo.mjs';
import { pesoZaino } from './azioni.mjs';

const dist = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const ora = ms => new Date(ms).toLocaleTimeString('it-IT', { timeZone: 'Europe/Rome', hour: '2-digit', minute: '2-digit' });
const VISTA = 20;

function descriviCosa(q) {
  const O = OGGETTI[q.cosa], M = MATERIALI[q.cosa];
  let s = O ? nomeDi(q.cosa) : `${q.kg < 1 ? Math.round(q.kg * 1000) + ' g' : q.kg.toFixed(1) + ' kg'} di ${nomeDi(q.cosa)}`;
  const note = [];
  if (q.rotta) note.push('spaccata');
  if (q.bruciato) note.push('bruciato');
  if (q.umid != null) note.push(q.umid > 0.35 ? 'bagnati' : q.umid > 0.2 ? 'un po\' umidi' : 'asciutti');
  if (q.secca != null && O && O.materiale === 'argilla') note.push(q.secca >= 0.9 ? 'asciutta, pronta per il fuoco' : q.secca > 0.4 ? 'si sta asciugando' : 'ancora umida');
  if (M && M.dura20 && (q.guasto || 0) >= 1) note.push('va a male, puzza');
  else if (M && M.dura20 && (q.guasto || 0) > 0.7) note.push('non piu\' freschissimo');
  if (q.T != null && q.T > 45) note.push(`caldo, circa ${Math.round(q.T)} gradi`);
  if (q.contenuto && q.contenuto.length) note.push('dentro: ' + q.contenuto.filter(w => w.kg > 0.01).map(w => `${w.kg.toFixed(2)} ${w.cosa === 'acqua' ? 'litri d\'acqua' + (w.bollita ? ' bollita' : w.lago ? ' del laghetto' : '') : 'kg di ' + nomeDi(w.cosa)}`).join(', '));
  return s + (note.length ? ' (' + note.join(', ') + ')' : '');
}

export function percezioneVita(mondo, id, adesso) {
  const c = mondo.corpi[id]; if (!c) return '';
  const tempo = tempoAdesso(mondo, adesso), righe = [];
  const s = tempo.sole;
  righe.push(`IL TUO CORPO: ${sensazioni(c, c.ambiente || { tAria: tempo.tAria, vento: tempo.vento }, adesso).join('; ')}.` + (c.lavoro ? ` Stai ${c.lavoro.tipo === 'dormi' ? 'dormendo' : 'facendo: ' + c.lavoro.tipo} (fino alle ${ora(c.lavoro.fine)}).` : '') + (c.bagnato > 0.3 ? ' Sei bagnato.' : ''));
  righe.push(`IL TEMPO: ${c.stanza ? 'sei al chiuso, al caldo. Fuori: ' : ''}${descriviTempo(tempo)}. ${s.giorno ? `Il sole tramonta alle ${ora(s.tramonto)}` : `E' buio; il sole sorge alle ${ora(s.alba + (adesso > s.alba ? 86400000 : 0))}`}.`);
  righe.push(`CON TE (${pesoZaino(c).toFixed(1)} kg su ${REGOLE_VITA.caricoMax}): ` + (c.zaino.length ? c.zaino.map(descriviCosa).join('; ') : 'niente') + '.');
  // intorno: fuochi, dispensa, alberi con legna o frutti, aiuole, acqua
  const intorno = [];
  if (!c.stanza) {
    for (const f of mondo.fuochi) if (dist(f, c) <= VISTA && (f.acceso || f.fisso || f.sopra.length)) {
      const kg = f.legna.reduce((q, l) => q + l.kg, 0);
      intorno.push(`- ${f.fisso ? f.nome : 'un fuoco'} a ${Math.round(dist(f, c))} m: ${f.acceso ? `acceso${f.T > 600 ? ', fiamma alta' : f.T > 300 ? '' : ', debole'}, ${kg < 0.5 ? 'quasi senza legna' : 'con ' + kg.toFixed(1) + ' kg di legna'}` : f.T - tempo.tAria > 40 ? 'spento, braci calde' : 'spento'}` + (f.sopra.length ? '; sopra: ' + f.sopra.map(descriviCosa).join(', ') : ''));
    }
    if (dist(POSTI.dispensa, c) <= VISTA) {
      const roba = mondo.cose.filter(q => q.dove === 'dispensa');
      const somma = {}; roba.forEach(q => { somma[q.cosa] = (somma[q.cosa] || 0) + (OGGETTI[q.cosa] ? 1 : q.kg); });
      intorno.push(`- la Dispensa del Mercatino (di tutti) a ${Math.round(dist(POSTI.dispensa, c))} m: ` + (Object.keys(somma).length ? Object.entries(somma).map(([k, v]) => OGGETTI[k] ? `${v} ${nomeDi(k)}` : `${v < 1 ? Math.round(v * 1000) + ' g' : v.toFixed(1) + ' kg'} di ${nomeDi(k)}`).join(', ') : 'vuota'));
    }
    const terra = mondo.cose.filter(q => q.dove === 'terra' && !q.stanza && dist(q, c) <= VISTA).slice(0, 8);
    terra.forEach(q => intorno.push(`- a terra a ${Math.round(dist(q, c))} m: ${descriviCosa(q)}`));
    const alberi = mondo.alberi.filter(a => dist(a, c) <= VISTA);
    if (alberi.length) {
      const rami = alberi.reduce((q, a) => q + a.rami, 0), cil = alberi.reduce((q, a) => q + (a.ciliegie || 0), 0);
      intorno.push(`- ${alberi.length} alberi qui intorno: sotto ci sono ${rami < 1 ? 'pochissimi' : 'circa ' + Math.round(rami) + ' kg di'} rami secchi` + (cil > 0.5 ? `, sui ciliegi ${Math.round(cil)} kg di ciliegie mature` : ''));
    }
    const aiuole = mondo.aiuole.filter(a => dist(a, c) <= 12).sort((p, q) => dist(p, c) - dist(q, c)).slice(0, 4);
    aiuole.forEach(a => intorno.push(`- aiuola di ${a.m2} m2 a ${Math.round(dist(a, c))} m: ${statoPianta(a)}`));
    if (dist(POSTI.fontana, c) <= VISTA) intorno.push('- la Fontana: acqua potabile');
    if (dist(POSTI.laghetto, c) <= VISTA + 10) intorno.push(`- il Laghetto: acqua non potabile, ${mondo.laghetto.pesci > 30 ? 'si vedono pesci' : mondo.laghetto.pesci > 10 ? 'qualche pesce' : 'pochissimi pesci'}, argilla sulla riva` + (mondo.erbaLaghetto > 0.1 ? ', erba secca' : ''));
  }
  for (const [altroId, o] of Object.entries(mondo.corpi)) if (altroId !== id && (o.stanza || null) === (c.stanza || null) && dist(o, c) <= VISTA) {
    const visibile = o.morto ? 'e\' a terra immobile, non respira' : o.svenuto ? 'e\' svenuto' : o.addormentato ? 'dorme' : o.lavoro ? 'sta ' + ({ pesca: 'pescando', raccogli: 'raccogliendo', accendi: 'accendendo un fuoco', modella: 'modellando l\'argilla', impasta: 'impastando', semina: 'seminando', mangiare: 'mangiando' }[o.lavoro.tipo] || 'lavorando') : null;
    if (visibile) intorno.push(`- ${o.id}: ${visibile}` + (o.malattie.length && !o.morto ? ', ha una brutta cera' : ''));
  }
  if (intorno.length) righe.push('INTORNO A TE (per vivere):\n' + intorno.join('\n'));
  if (c.esiti && c.esiti.length) { righe.push('COM\'E\' ANDATA (corpo e lavori):\n' + c.esiti.map(e => '- ' + e).join('\n')); }
  return righe.join('\n');
}
// Da chiamare dopo che l'agente ha pensato: gli esiti letti non si ripetono
export function esitiLetti(mondo, id) { const c = mondo.corpi[id]; if (c) c.esiti = []; }
