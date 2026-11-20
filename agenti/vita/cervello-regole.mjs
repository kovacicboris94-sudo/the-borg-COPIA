// =====================================================================
//  VITA - IL CERVELLO A REGOLE (gratis, senza IA)
//  Le decisioni di sopravvivenza che una persona prende senza pensarci:
//  bere quando ha sete, mangiare quando ha fame, cucinare con quello che
//  c'e', dormire la notte al chiuso. Serve per:
//   - la simulazione di prova (giorni di vita senza spendere niente);
//   - gli agenti in "automatico" quando il budget del mese e' finito.
//  Restituisce una sequenza di azioni (le stesse che puo' usare il modello).
// =====================================================================
import { MATERIALI } from './materiali.mjs';
import { POSTI } from './mondo.mjs';
import { tempoAdesso } from './natura.mjs';

const ha = (c, cosa, kg = 0.01) => c.zaino.filter(q => q.cosa === cosa && !q.rotta).reduce((s, q) => s + (q.kg || 1), 0) >= kg;
const haAsciutto = (c, cosa, kg) => c.zaino.filter(q => q.cosa === cosa && (q.umid ?? 0) <= (cosa === 'erba_secca' ? 0.15 : 0.3)).reduce((s, q) => s + q.kg, 0) >= kg;
const inDispensa = (mondo, cosa, kg = 0.01) => mondo.cose.filter(q => q.dove === 'dispensa' && q.cosa === cosa).reduce((s, q) => s + q.kg, 0) >= kg;
const oraRoma = ms => +new Date(ms).toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }) % 24;

export const BIBLIOTECA = { x: -27.7, z: -3.5, stanza: 'biblioteca' };

export function decidiARegole(mondo, id, t) {
  const c = mondo.corpi[id]; if (!c || c.morto || c.svenuto || c.lavoro) return [];
  const piano = [];
  const dis = (c.acquaNormale - c.acqua) / c.peso, h = oraRoma(t), tempo = tempoAdesso(mondo, t);
  const fame = c.glicogeno < 1250 && c.stomaco.kcal < 250;
  // 1) sete
  if (dis > 0.012) return [{ tipo: 'bevi', luogo: 'Fontana', quanto: Math.min(1, dis * c.peso * 0.8 + 0.2) }];
  // 2) sonno: di notte si dorme al chiuso (in Biblioteca, al caldo)
  // se cucinare non e' riuscito da poco, si mangia quello che non ha bisogno del fuoco (olio, farina cruda)
  const fallito = c._fallito && t - c._fallito < 3 * 3600000;
  if ((h >= 22 || h < 6 || c.sonno > 1.1) && c.sonno > 0.5 && (!fame || fallito || c.sonno > 1.3)) return [{ tipo: 'entra_biblioteca' }, { tipo: 'dormi', quanto: 9 }];
  // legna bagnata nello zaino: si lascia ad asciugare al coperto, in dispensa
  const bagnati = c.zaino.find(q => (q.cosa === 'rami' || q.cosa === 'legna' || q.cosa === 'erba_secca') && q.umid > 0.3);
  if (bagnati && !fame) return [{ tipo: 'lascia', cosa: bagnati.cosa, quanto: bagnati.kg }];
  // 3) fame: prima il cibo pronto che si ha con se'
  if (fame) {
    for (const cosa of ['pane', 'pesce_cotto', 'fagioli_cotti', 'ciliegie', 'spinaci', 'fave']) if (ha(c, cosa, 0.05)) return [{ tipo: 'mangia', nome: cosa, cosa, quanto: Math.min(0.5, 700 / MATERIALI[cosa].kcal) }];
    if (fallito) {
      for (const cosa of ['olio', 'farina']) if (ha(c, cosa, 0.03)) return [{ tipo: 'mangia', cosa, quanto: cosa === 'olio' ? 0.05 : 0.2 }];
      if (inDispensa(mondo, 'olio', 0.05)) return [{ tipo: 'prendi', cosa: 'olio', quanto: 0.3 }, { tipo: 'mangia', cosa: 'olio', quanto: 0.05 }];
    }
    // pesce crudo: si cuoce sulla brace
    if (ha(c, 'pesce', 0.1)) return pianoFuoco(mondo, c, [{ tipo: 'metti_sul_fuoco', cosa: 'pesce' }, { tipo: 'riposa', quanto: 15 }, { tipo: 'togli_dal_fuoco', cosa: 'pesce' }, { tipo: 'riposa', quanto: 15 }, { tipo: 'mangia', cosa: 'pesce_cotto', quanto: 0.4 }]);
    // impasto gia' pronto: si cuoce
    if (ha(c, 'impasto', 0.2)) return pianoFuoco(mondo, c, [{ tipo: 'metti_sul_fuoco', cosa: 'impasto', quanto: 0.7 }, { tipo: 'riposa', quanto: 25 }, { tipo: 'togli_dal_fuoco', cosa: 'impasto' }, { tipo: 'riposa', quanto: 20 }, { tipo: 'mangia', cosa: 'pane', quanto: 0.3 }]);
    // pane: farina dalla dispensa, impasto, focaccia sulla brace
    if (ha(c, 'farina', 0.3) || inDispensa(mondo, 'farina', 0.3)) {
      if (!ha(c, 'farina', 0.3)) piano.push({ tipo: 'prendi', cosa: 'farina', quanto: 1.2 });
      if (!ha(c, 'sale', 0.01) && inDispensa(mondo, 'sale')) piano.push({ tipo: 'prendi', cosa: 'sale', quanto: 0.05 });
      if (!ha(c, 'olio', 0.02) && inDispensa(mondo, 'olio', 0.05)) piano.push({ tipo: 'prendi', cosa: 'olio', quanto: 0.2 });
      piano.push({ tipo: 'impasta', quanto: 0.4 });
      return pianoFuoco(mondo, c, [{ tipo: 'metti_sul_fuoco', cosa: 'impasto' }, { tipo: 'riposa', quanto: 25 }, { tipo: 'togli_dal_fuoco', cosa: 'impasto' }, { tipo: 'riposa', quanto: 20 }, { tipo: 'mangia', cosa: 'pane', quanto: 0.3 }, { tipo: 'mangia', cosa: 'olio', quanto: 0.02 }], piano);
    }
    if (ha(c, 'olio', 0.02)) return [{ tipo: 'mangia', cosa: 'olio', quanto: 0.05 }];
    if (inDispensa(mondo, 'olio', 0.05)) return [{ tipo: 'prendi', cosa: 'olio', quanto: 0.3 }, { tipo: 'mangia', cosa: 'olio', quanto: 0.05 }];
  }
  // 4) di giorno: procurarsi cibo e legna per dopo
  if (tempo.sole.giorno && c.sonno < 1) {
    if (mondo.laghetto.pesci > 15 && (ha(c, 'lenza') || inDispensa(mondo, 'lenza')) && !ha(c, 'pesce', 0.5)) {
      if (!ha(c, 'lenza')) piano.push({ tipo: 'prendi', cosa: 'lenza' });
      piano.push({ tipo: 'pesca', quanto: 2 });
      return piano;
    }
    if (!tempo.piove && !ha(c, 'rami', 2) && mondo.alberi.some(a => a.rami > 1)) return [{ tipo: 'raccogli', cosa: 'rami', quanto: 3 }];
  }
  return [{ tipo: 'riposa', quanto: 30 }];
}

// Prima di cuocere serve un fuoco: se non ce n'e' uno acceso vicino, si prendono legna ed esca e lo si accende.
function pianoFuoco(mondo, c, dopo, prima = []) {
  const acceso = mondo.fuochi.some(f => f.acceso && !f.fisso && Math.hypot(f.x - POSTI.fontana.x, f.z - POSTI.fontana.z) < 8 && f.legna.reduce((s, l) => s + l.kg, 0) > 0.8);
  const p = [...prima];
  if (!acceso) {
    if (!haAsciutto(c, 'legna', 2) && !haAsciutto(c, 'rami', 2)) p.push(inDispensa(mondo, 'legna', 2) ? { tipo: 'prendi', cosa: 'legna', quanto: 3 } : { tipo: 'raccogli', cosa: 'rami', quanto: 3 });
    if (!haAsciutto(c, 'erba_secca', 0.05)) p.push(inDispensa(mondo, 'erba_secca', 0.05) ? { tipo: 'prendi', cosa: 'erba_secca', quanto: 0.1 } : { tipo: 'raccogli', cosa: 'erba_secca', quanto: 0.3 });
    if (!ha(c, 'acciarino')) {
      if (inDispensa(mondo, 'acciarino', 0.1)) p.push({ tipo: 'prendi', cosa: 'acciarino' });
      else return [{ tipo: 'riposa', quanto: 30 }];   // senza acciarino e senza un fuoco acceso si aspetta (a frizione col legno umido non parte)
    }
    p.push({ tipo: 'vai', x: POSTI.fontana.x + 6, z: POSTI.fontana.z - 6 });
    p.push({ tipo: 'accendi', nome: 'acciarino' });
  } else p.push({ tipo: 'vai', x: POSTI.fontana.x + 6, z: POSTI.fontana.z - 7 });
  return [...p, ...dopo];
}
