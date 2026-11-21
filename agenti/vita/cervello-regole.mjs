// =====================================================================
//  VITA - IL CERVELLO A REGOLE (gratis, senza IA)
//  Le decisioni di sopravvivenza che una persona prende senza pensarci:
//  bere quando ha sete, mangiare quando ha fame, cucinare con quello che
//  c'e', dormire la notte al chiuso. Serve per:
//   - la simulazione di prova (giorni di vita senza spendere niente);
//   - gli agenti in "automatico" quando il budget del mese e' finito.
//  Restituisce una sequenza di azioni (le stesse che puo' usare il modello).
//  Una giornata "normale": si lavora qualche ora per avere i soldi, si
//  compra da mangiare e la legna al Mercatino, si va in bagno, ci si lava,
//  si chiacchiera e ci si svaga quando la testa lo chiede.
// =====================================================================
import { MATERIALI } from './materiali.mjs';
import { POSTI } from './mondo.mjs';
import { tempoAdesso } from './natura.mjs';
import { MESTIERI, ORE_MAX_GIORNO } from './mestieri.mjs';
import { prezzoDi } from './economia.mjs';

// il cibo che puzza non si conta: una persona lo annusa e lo butta
const ha = (c, cosa, kg = 0.01) => c.zaino.filter(q => q.cosa === cosa && !q.rotta && (q.guasto || 0) < 0.9).reduce((s, q) => s + (q.kg || 1), 0) >= kg;
const haAsciutto = (c, cosa, kg) => c.zaino.filter(q => q.cosa === cosa && (q.umid ?? 0) <= (cosa === 'erba_secca' ? 0.15 : 0.3)).reduce((s, q) => s + q.kg, 0) >= kg;
const inDispensa = (mondo, cosa, kg = 0.01) => mondo.cose.filter(q => q.dove === 'dispensa' && q.cosa === cosa).reduce((s, q) => s + q.kg, 0) >= kg;
const oraRoma = ms => +new Date(ms).toLocaleString('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }) % 24;

export const BIBLIOTECA = { x: -27.7, z: -3.5, stanza: 'biblioteca' };

export function decidiARegole(mondo, id, t) {
  const c = mondo.corpi[id]; if (!c || c.morto || c.svenuto || c.lavoro) return [];
  const piano = [];
  const dis = (c.acquaNormale - c.acqua) / c.peso, h = oraRoma(t), tempo = tempoAdesso(mondo, t);
  // fame vera, oppure l'ora dei pasti (colazione, pranzo, cena) con lo stomaco vuoto
  const oraPasto = (h >= 7 && h < 9) || (h >= 12 && h < 14) || (h >= 19 && h < 21);
  const fame = (c.glicogeno < 1250 && c.stomaco.kcal < 250) || (oraPasto && c.glicogeno < 1780 && c.stomaco.kcal < 100);
  // cibo andato a male: si annusa e si butta
  const marcio = c.zaino.find(q => MATERIALI[q.cosa] && MATERIALI[q.cosa].tipo === 'cibo' && (q.guasto || 0) >= 0.75);
  if (marcio) return [{ tipo: 'butta', cosa: marcio.cosa, quanto: marcio.kg }];
  // 1) sete
  if (dis > 0.012) return [{ tipo: 'bevi', luogo: 'Fontana', quanto: Math.min(1, dis * c.peso * 0.8 + 0.2) }];
  // il bagno non aspetta
  if (c.umano && c.umano.vescica > 0.3) return [{ tipo: 'bagno' }];
  // 2) sonno: di notte si dorme al chiuso (in Biblioteca, al caldo)
  // se cucinare non e' riuscito da poco, si mangia quello che non ha bisogno del fuoco (olio, farina cruda)
  const fallito = c._fallito && t - c._fallito < 3 * 3600000;
  if ((h >= 22 || h < 6 || c.sonno > 1.1) && c.sonno > 0.5 && (!fame || fallito || c.sonno > 1.3)) return [{ tipo: 'entra_biblioteca' }, { tipo: 'dormi', quanto: 9 }];
  // legna bagnata nello zaino: si lascia ad asciugare al coperto, in dispensa
  const bagnati = c.zaino.find(q => (q.cosa === 'rami' || q.cosa === 'legna' || q.cosa === 'erba_secca') && q.umid > 0.3);
  if (bagnati && !fame) return [{ tipo: 'lascia', cosa: bagnati.cosa, quanto: bagnati.kg }];
  // 3) fame: prima il cibo pronto che si ha con se'
  if (fame) {
    // prima quello che sta per andare a male
    const pronti = c.zaino.filter(q => ['pane', 'pesce_cotto', 'fagioli_cotti', 'uova_cotte', 'mele', 'ciliegie', 'spinaci', 'fave'].includes(q.cosa) && q.kg >= 0.05 && (q.guasto || 0) < 0.75).sort((a, b) => (b.guasto || 0) - (a.guasto || 0));
    if (pronti.length) { const cosa = pronti[0].cosa; return [{ tipo: 'mangia', nome: cosa, cosa, quanto: Math.min(0.6, c.peso * 12 / MATERIALI[cosa].kcal) }]; }   // un pasto: circa 12 kcal per kg di peso
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
    // niente in dispensa: si compra al Mercatino (pane, uova, mele) se si hanno i soldi
    const m = mondo.mercato;
    if (m) for (const [cosa, kg, mangiaKg] of [['pane', 0.5, 0.3], ['uova', 0.3, 0.15], ['mele', 0.5, 0.3], ['fagioli_secchi', 0.3, 0]]) {
      if (mangiaKg && (m.scorte[cosa] || 0) >= kg && (c.starlight ?? 0) >= kg * prezzoDi(m, cosa)) {
        const piano2 = [{ tipo: 'compra', cosa, quanto: kg }];
        return cosa === 'uova' ? pianoFuoco(mondo, c, [{ tipo: 'metti_sul_fuoco', cosa: 'uova' }, { tipo: 'riposa', quanto: 12 }, { tipo: 'togli_dal_fuoco', cosa: 'uova' }, { tipo: 'riposa', quanto: 10 }, { tipo: 'mangia', cosa: 'uova_cotte', quanto: mangiaKg }], piano2)
          : [...piano2, { tipo: 'mangia', cosa, quanto: mangiaKg }];
      }
    }
    if (ha(c, 'olio', 0.02)) return [{ tipo: 'mangia', cosa: 'olio', quanto: 0.05 }];
    if (inDispensa(mondo, 'olio', 0.05)) return [{ tipo: 'prendi', cosa: 'olio', quanto: 0.3 }, { tipo: 'mangia', cosa: 'olio', quanto: 0.05 }];
  }
  // 4) la vita da persona: lavarsi, lavorare, stare con gli altri, svagarsi
  const u = c.umano || {};
  if (u.igiene < 0.6 && h >= 6 && h < 22) return [{ tipo: 'lavati' }];
  // pesce in piu': si vende al Mercatino
  const pesce = c.zaino.filter(q => q.cosa === 'pesce' && (q.guasto || 0) < 0.6).reduce((a, q) => a + q.kg, 0);
  if (pesce > 0.8 && mondo.mercato && (mondo.mercato.vendutoOggi.pesce || 0) < 2.5) return [{ tipo: 'vendi', cosa: 'pesce', quanto: pesce - 0.4 }];
  const turno = sceltaTurno(mondo, c, t);
  if (turno) return [...(u.vescica > 0.12 ? [{ tipo: 'bagno' }] : []), { tipo: 'lavora', nome: turno.id, quanto: turno.ore }];
  if (u.solitudine > 0.45 && h >= 8 && h < 22) {
    const altro = Object.values(mondo.corpi).find(o => o !== c && !o.morto && !o.svenuto && !o.addormentato && !(o.lavoro && o.lavoro.tipo !== 'svago' && o.lavoro.tipo !== 'riposa'));
    if (altro) return [{ tipo: 'vai', x: altro.x + 1, z: altro.z + 1, entra: altro.stanza || null }, { tipo: 'chiacchiera', a: altro.id, quanto: 30 }];
  }
  if (u.noia > 0.5 && h >= 8 && h < 22) return [{ tipo: 'svago', quanto: 1.5, luogo: 'Biblioteca' }];
  // legna per i giorni dopo: se in dispensa e' poca, si compra (costa poco) o si raccolgono rami
  if (!inDispensa(mondo, 'legna', 3) && mondo.mercato && (mondo.mercato.scorte.legna || 0) > 5 && (c.starlight ?? 0) > 60 && !haAsciutto(c, 'legna', 2)) return [{ tipo: 'compra', cosa: 'legna', quanto: 6 }, { tipo: 'lascia', cosa: 'legna', quanto: 6 }];
  // di giorno: procurarsi cibo e legna per dopo
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

// Un turno di lavoro, se serve: pochi soldi da parte, ore ancora libere oggi, un posto aperto adesso.
// Si preferisce il mestiere che si conosce gia' (si e' piu' bravi e si guadagna di piu').
const RISERVA = 400;   // Starlight: sopra questa cifra non si cerca lavoro (circa 2 settimane di pane)
function sceltaTurno(mondo, c, t) {
  if ((c.starlight ?? 0) >= RISERVA || c.sonno > 0.9 || c.salute < 50) return null;
  const h = oraRoma(t) + new Date(t).getUTCMinutes() / 60, libere = ORE_MAX_GIORNO - (c.oreLavoroOggi || 0);
  if (libere < 1 || (c.oreLavoroOggi || 0) >= 6) return null;
  const occupato = id => Object.values(mondo.corpi).filter(o => o !== c && o.lavoro && o.lavoro.mestiere === id).length >= MESTIERI[id].posti;
  const aperti = Object.entries(MESTIERI).filter(([id, M]) => h >= M.dalle && M.alle - h >= 1.5 && !occupato(id));
  if (!aperti.length) return null;
  aperti.sort(([a, A], [b, B]) => ((c.esperienza || {})[b] || 0) - ((c.esperienza || {})[a] || 0) || B.paga - A.paga);
  const [id, M] = aperti[0];
  return { id, ore: Math.max(1, Math.min(6 - (c.oreLavoroOggi || 0), libere, M.alle - h - 0.1)) };
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

// Durante un turno di lavoro: una pausa per il bagno o per mangiare quello che si ha in tasca.
export function decidiInPausa(mondo, id, t) {
  const c = mondo.corpi[id]; if (!c || !c.lavoro || c.lavoro.tipo !== 'lavora') return null;
  if (c.umano && c.umano.vescica > 0.35) return { tipo: 'bagno' };
  const dis = (c.acquaNormale - c.acqua) / c.peso;
  if (dis > 0.012) return { tipo: 'bevi', quanto: 0.4 };
  if (c.glicogeno < 1000 && c.stomaco.kcal < 150) for (const cosa of ['pane', 'uova_cotte', 'mele', 'pesce_cotto']) if (ha(c, cosa, 0.05)) return { tipo: 'mangia', cosa, quanto: 0.2 };
  return null;
}
