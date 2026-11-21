// =====================================================================
//  VITA - LO SGUARDO DI GOD E IL GIUDICE DELLE INVENZIONI
//  vistaGod(): il registro intero riassunto, l'unica vista completa del
//  mondo (per l'agente GOD, per Boris e per le statistiche).
//  valutaInvenzione(): un agente propone un'idea come scheda tecnica; il
//  codice la accetta solo se rispetta conservazione dell'energia e della
//  massa, il secondo principio della termodinamica, le temperature che si
//  possono davvero raggiungere e i materiali che esistono nel borgo.
//  Nessuna spiegazione convincente puo' far passare il moto perpetuo.
// =====================================================================
import { MATERIALI, OGGETTI, nomeDi } from './materiali.mjs';
import { REAZIONI, bilanciata, puoAvvenire } from './chimica.mjs';
import { KELVIN } from './fisica.mjs';
import { tempoAdesso, descriviTempo, statoPianta } from './natura.mjs';
import { TMAX_STRUTTURA } from './mondo.mjs';

export function vistaGod(mondo) {
  const t = tempoAdesso(mondo, mondo.t), righe = [];
  righe.push(`ORA ${new Date(mondo.t).toISOString()} - ${descriviTempo(t)}; pioggia oggi ${mondo.meteo ? mondo.meteo.pioggiaMm.toFixed(1) : 0} mm.`);
  for (const c of Object.values(mondo.corpi)) {
    const dis = (c.acquaNormale - c.acqua) / c.peso * 100;
    righe.push(`${c.id}: salute ${Math.round(c.salute)}, peso ${c.peso.toFixed(1)} kg, glicogeno ${Math.round(c.glicogeno)} kcal, grasso ${Math.round(c.grasso / 7700 * 10) / 10} kg, disidratazione ${dis.toFixed(1)}%, sonno ${c.sonno.toFixed(2)}, temp ${c.temperatura.toFixed(1)}, ` +
      `Starlight ${Math.round(c.starlight ?? 0)}, ` + (c.umano ? `umore ${c.umano.umore.toFixed(2)}, vescica ${c.umano.vescica.toFixed(2)} L, igiene ${c.umano.igiene.toFixed(2)}, solitudine ${c.umano.solitudine.toFixed(2)}, noia ${c.umano.noia.toFixed(2)}, ` : '') +
      `${c.morto ? 'MORTO' : c.svenuto ? 'svenuto' : c.addormentato ? 'dorme' : c.lavoro ? c.lavoro.tipo : 'libero'}${c.malattie.length ? ', malato: ' + c.malattie.map(m => m.tipo).join(',') : ''}; zaino ${c.zaino.map(q => nomeDi(q.cosa) + (OGGETTI[q.cosa] ? '' : ' ' + q.kg.toFixed(2))).join(', ') || 'vuoto'}`);
  }
  const disp = {}; mondo.cose.filter(q => q.dove === 'dispensa').forEach(q => { disp[q.cosa] = (disp[q.cosa] || 0) + (OGGETTI[q.cosa] ? 1 : q.kg); });
  righe.push('DISPENSA: ' + Object.entries(disp).map(([k, v]) => `${k} ${Math.round(v * 100) / 100}`).join(', '));
  const kcal = Object.entries(disp).reduce((s, [k, v]) => s + (MATERIALI[k] && MATERIALI[k].tipo === 'cibo' ? v * MATERIALI[k].kcal : 0), 0);
  righe.push(`CIBO IN DISPENSA: ${Math.round(kcal)} kcal (~${(kcal / 2100 / Math.max(1, Object.keys(mondo.corpi).length)).toFixed(1)} giorni per abitante)`);
  righe.push(`LAGHETTO: ${mondo.laghetto.pesci.toFixed(1)} kg di pesce su 45. RAMI SOTTO GLI ALBERI: ${mondo.alberi.reduce((s, a) => s + a.rami, 0).toFixed(0)} kg.`);
  righe.push('AIUOLE: ' + (mondo.aiuole.filter(a => a.coltura).map(a => `${a.id} ${statoPianta(a)}`).join('; ') || 'nessuna coltivata'));
  if (mondo.mercato) {
    const m = mondo.mercato;
    righe.push(`MERCATINO: incassato ${Math.round(m.incasso)} S, pagato a chi vende ${Math.round(m.pagato)} S. Prezzi: ` + ['pane', 'farina', 'pesce', 'uova', 'mele', 'legna'].map(k => `${k} ${m.prezzi[k]} (${(m.scorte[k] || 0).toFixed(1)})`).join(', ') + `. Compost: ${(mondo.compost || 0).toFixed(1)} kg.`);
  }
  righe.push('FUOCHI: ' + (mondo.fuochi.filter(f => f.acceso).map(f => `${f.id} ${Math.round(f.T)} gradi, ${f.legna.reduce((s, l) => s + l.kg, 0).toFixed(1)} kg`).join('; ') || 'nessuno acceso'));
  return righe.join('\n');
}

// ---- il giudice delle invenzioni ----
// Rendimenti massimi realistici per tipo di conversione (oltre questi la fisica dice no).
const RENDIMENTO_MAX = {
  'muscoli>meccanica': 0.25,   // il corpo umano converte ~25% dell'energia chimica in lavoro
  'meccanica>meccanica': 0.95, // leve, ruote, carrucole: un po' si perde sempre in attrito
  'calore>meccanica': null,    // limitato da Carnot
  'calore>calore': 0.9,
  'acqua>meccanica': 0.8,      // ruota idraulica ben fatta
  'vento>meccanica': 0.45,     // sotto il limite di Betz (59%)
  'sole>calore': 0.7
};
const POTENZA_MAX_FONTE = { muscoli: 100, acqua: 0, vento: 300, sole: 1000, fuoco: 20000 };   // W disponibili nel borgo (niente corsi d'acqua in piazza)

// scheda: { nome, materiali: {cosa: kg}, prodotti: {cosa: kg}, energia: { fonte: 'muscoli'|'fuoco'|'vento'|'sole'|'acqua'|null, potenzaW, uscita: 'meccanica'|'calore', potenzaUscitaW },
//           temperatura, struttura: 'aperto'|'forno_pane'|'fornace', reazioni: [id], vantaggioMeccanico, conoscenze: [] }
export function valutaInvenzione(scheda, mondo, conosciute = new Set()) {
  const motivi = [], s = scheda || {};
  // 1) materiali che esistono
  for (const k of Object.keys(s.materiali || {})) if (!MATERIALI[k] && !OGGETTI[k]) motivi.push(`il materiale "${k}" nel borgo non esiste`);
  // 2) conservazione della massa: non esce piu' materia di quella che entra
  const kgIn = Object.values(s.materiali || {}).reduce((a, b) => a + (+b || 0), 0), kgOut = Object.values(s.prodotti || {}).reduce((a, b) => a + (+b || 0), 0);
  if (kgOut > kgIn * 1.001 + 1e-9) motivi.push(`escono ${kgOut} kg ma ne entrano ${kgIn}: la massa non si crea`);
  // 3) energia: niente energia dal nulla, rendimenti entro i limiti fisici
  const e = s.energia;
  if (e && e.potenzaUscitaW > 0) {
    if (!e.fonte) motivi.push('produce energia senza una fonte: e\' un moto perpetuo, impossibile (primo principio della termodinamica)');
    else {
      const max = POTENZA_MAX_FONTE[e.fonte];
      if (max === undefined) motivi.push(`fonte di energia sconosciuta: ${e.fonte}`);
      else if (max === 0) motivi.push(`nel borgo non c'e' ${e.fonte === 'acqua' ? 'un corso d\'acqua che scorre' : e.fonte} da sfruttare`);
      else if ((e.potenzaW || 0) > max) motivi.push(`la fonte "${e.fonte}" da' al massimo circa ${max} W, non ${e.potenzaW}`);
      const chiave = (e.fonte === 'fuoco' ? 'calore' : e.fonte) + '>' + (e.uscita || 'meccanica');
      let eta = RENDIMENTO_MAX[chiave];
      if (eta === null || (e.fonte === 'fuoco' && e.uscita === 'meccanica')) {
        // secondo principio: una macchina termica non supera il rendimento di Carnot (e una reale ne fa meta')
        const Th = (s.temperatura || 300) + KELVIN, Tc = 15 + KELVIN;
        eta = 0.5 * (1 - Tc / Th);
        if (!(conosciute.has('cilindro_pistone') || conosciute.has('caldaia'))) motivi.push('per trasformare il calore in movimento serve prima saper fare una caldaia e un pistone a tenuta');
      }
      if (eta == null) eta = 0.9;
      const pIn = Math.min(e.potenzaW || 0, max || 0);
      if (e.potenzaUscitaW > pIn * eta + 1e-9) motivi.push(`con ${pIn} W in ingresso si ottengono al massimo ${Math.round(pIn * eta)} W (rendimento massimo ${Math.round(eta * 100)}%), non ${e.potenzaUscitaW}`);
    }
  }
  // 4) vantaggio meccanico: una leva moltiplica la forza ma divide lo spostamento (il lavoro si conserva)
  if (s.vantaggioMeccanico && s.riduceLavoro) motivi.push('una macchina semplice moltiplica la forza ma non riduce il lavoro totale: si fa meno forza per piu\' strada');
  // 5) temperature raggiungibili
  if (s.temperatura) {
    const st = s.struttura || 'aperto', Tmax = TMAX_STRUTTURA[st];
    if (Tmax == null) motivi.push(`struttura sconosciuta: ${st}`);
    else if (s.temperatura > Tmax) motivi.push(`${st === 'aperto' ? 'un fuoco all\'aperto' : 'questa struttura'} arriva a circa ${Tmax} gradi, non a ${s.temperatura}` + (st === 'aperto' ? ': serve una fornace chiusa' : ''));
  }
  // 6) reazioni chimiche vere e possibili in quelle condizioni
  for (const id of s.reazioni || []) {
    if (!REAZIONI[id]) { motivi.push(`la reazione "${id}" non esiste`); continue; }
    if (!bilanciata(REAZIONI[id]).ok) motivi.push(`la reazione "${id}" non e' bilanciata`);
    const ok = puoAvvenire(id, { temperatura: s.temperatura ?? 20, aria: s.aria ?? true });
    if (!ok.ok) motivi.push(`${REAZIONI[id].nome}: ${ok.motivo}`);
  }
  // 7) conoscenze richieste
  for (const k of s.conoscenze || []) if (!conosciute.has(k)) motivi.push(`nel borgo nessuno sa ancora "${k}"`);
  return { ok: motivi.length === 0, motivi };
}
