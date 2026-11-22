// =====================================================================
//  L'ARCHIVIO DELL'ESPERIMENTO
//  Dopo ogni passo del borgo si guarda cosa e' cambiato e lo si scrive
//  in righe che non si cancellano mai (sul server: tabella SQLite).
//  Niente modello, niente chiave: costo zero sul budget degli agenti.
//
//  Tipi di riga:
//    cronaca   ogni frase, messaggio, azione e lavoro (anche delle persone vere)
//    pensiero  ogni pensiero con le azioni decise, cosa annotare e quanto e' costato
//    diario    ogni riga che l'agente annota nel suo diario (anche i bisogni del corpo)
//    memoria   ogni volta che l'agente riscrive la sua memoria (il testo intero)
//    foto      ogni ora: dove sono, soldi, zaino, corpo, casa, budget
// =====================================================================
import { budget, REGOLE } from './motore.mjs';
import { vistaVita } from './vita/aggancio.mjs';

export const FOTO_OGNI_MS = 60 * 60000;

// prende solo le voci nuove di una lista ordinata per tempo, ricordando l'ultima ora vista
// e quante voci con quell'ora erano gia' state prese (piu' voci possono avere la stessa ora)
function nuove(lista, segno) {
  const t0 = segno ? segno.t : -1, visti = segno ? segno.n : 0;
  let allaStessaOra = 0; const fuori = [];
  for (const v of lista || []) {
    if (v.t < t0) continue;
    if (v.t === t0) { allaStessaOra++; if (allaStessaOra <= visti) continue; }
    fuori.push(v);
  }
  if (!fuori.length) return { fuori, segno: segno || null };
  const tU = fuori[fuori.length - 1].t;
  const n = (lista || []).filter(v => v.t === tU).length;
  return { fuori, segno: { t: tU, n } };
}

/**
 * Confronta lo stato con quello che si era gia' archiviato.
 * @returns {{ righe: Array<{t:number,tipo:string,chi:string|null,dati:object}>, memo: object }}
 */
export function osserva(stato, memo, adesso, regole = REGOLE) {
  const m = memo ? JSON.parse(JSON.stringify(memo)) : { cronaca: null, agenti: {}, foto: 0 };
  const righe = [];

  const c = nuove(stato.cronaca, m.cronaca); m.cronaca = c.segno;
  for (const e of c.fuori) {
    const d = Object.assign({}, e); delete d.t; delete d.chi;
    righe.push({ t: e.t, tipo: 'cronaca', chi: e.chi || null, dati: d });
  }

  for (const ag of Object.values(stato.agenti || {})) {
    const a = m.agenti[ag.id] || (m.agenti[ag.id] = { diario: null, memoria: null, decisione: 0 });
    const dec = ag.ultimaDecisione;
    if (dec && dec.t > a.decisione) { a.decisione = dec.t; righe.push({ t: dec.t, tipo: 'pensiero', chi: ag.id, dati: Object.assign({}, dec, { t: undefined }) }); }
    const dia = nuove(ag.diario, a.diario); a.diario = dia.segno;
    for (const d of dia.fuori) righe.push({ t: d.t, tipo: 'diario', chi: ag.id, dati: { testo: d.s } });
    if (ag.memoria !== a.memoria) { righe.push({ t: adesso, tipo: 'memoria', chi: ag.id, dati: { testo: ag.memoria } }); a.memoria = ag.memoria; }
  }

  if (adesso - (m.foto || 0) >= FOTO_OGNI_MS) {
    m.foto = adesso;
    const vita = vistaVita(stato);
    const agenti = Object.values(stato.agenti || {}).map(ag => {
      const b = budget(ag, adesso, regole);
      return { id: ag.id, nome: ag.nome, x: Math.round(ag.x * 10) / 10, z: Math.round(ag.z * 10) / 10, stanza: ag.stanza || null, modo: ag.modo, motivo: ag.motivo || null,
        morto: ag.morto || null, starlight: ag.starlight != null ? Math.round(ag.starlight * 100) / 100 : null, zaino: ag.zaino || {},
        lavoro: ag.lavoro ? { tipo: ag.lavoro.tipo, nome: ag.lavoro.nome || null } : null,
        budget: { spesi: b.spesi, resto: b.resto, pensieri: b.pensieri } };
    });
    righe.push({ t: adesso, tipo: 'foto', chi: null, dati: { agenti, corpi: vita ? vita.corpi : null, case: vita ? vita.case : null, oggetti: (stato.oggetti || []).length } });
  }

  righe.sort((x, y) => x.t - y.t);
  return { righe, memo: m };
}
