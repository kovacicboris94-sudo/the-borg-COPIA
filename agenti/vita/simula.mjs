// =====================================================================
//  VITA - SIMULAZIONE DI PROVA (gratis, sul computer, senza IA)
//  Fa vivere Ada e Teo per N giorni con il cervello a regole e stampa
//  un diario giorno per giorno: salute, peso, cibo rimasto, pesci, legna.
//  Non tocca il borgo vero, non chiama nessun modello, non costa nulla.
//
//    node agenti/vita/simula.mjs [giorni] [seme] [data-inizio]
//    es. node agenti/vita/simula.mjs 30 7 2026-11-21
// =====================================================================
import { nuovoMondo, passoMondo, REGOLE_VITA } from './mondo.mjs';
import { eseguiAzioneVita } from './azioni.mjs';
import { cercaCosa } from './materiali.mjs';
import { decidiARegole, decidiInPausa, BIBLIOTECA } from './cervello-regole.mjs';
import { vistaGod } from './god.mjs';

export function simula({ giorni = 7, seme = 7, inizio = Date.UTC(2026, 10, 21, 7, 0), passoS = 60, regole = REGOLE_VITA, log = null } = {}) {
  const mondo = nuovoMondo({ adesso: inizio, seme, posizioni: { ada: { x: -6, z: 34 }, teo: { x: 6, z: 34 } } });
  const piani = {}, cammino = {}, diario = [];
  const fine = inizio + giorni * 86400000;
  let t = inizio;
  while (t < fine) {
    t += passoS * 1000;
    const eventi = passoMondo(mondo, t, regole);
    for (const e of eventi) if (log && e.tipo === 'lavoro_finito') log(`[${new Date(t).toISOString().slice(5, 16)}] ${e.chi}: ${e.lavoro} finito -> ${e.esito}`);
    for (const e of eventi) if (e.tipo === 'svenuto') { piani[e.chi] = []; cammino[e.chi] = null; }
    for (const e of eventi) if (['svenuto', 'morte', 'crollo_sonno', 'pianta_morta', 'raccolto_pronto'].includes(e.tipo)) diario.push(`[${new Date(t).toISOString().slice(0, 16)}] ${e.chi || ''} ${e.tipo} ${e.causa || ''}`);
    for (const id of Object.keys(mondo.corpi)) {
      const c = mondo.corpi[id];
      if (c.morto || c.svenuto) continue;
      if (c.lavoro) {
        // durante un turno si puo' fare una pausa: bagno, o mangiare quello che si ha con se'
        const p = c.lavoro.tipo === 'lavora' && decidiInPausa(mondo, id, t);
        if (p) eseguiAzioneVita(mondo, id, p, t);
        continue;
      }
      // si cammina a 1,3 m/s verso la meta
      if (cammino[id]) {
        const m = cammino[id], d = Math.hypot(m.x - c.x, m.z - c.z), passo = 1.3 * passoS;
        if (d > passo) { c.x += (m.x - c.x) / d * passo; c.z += (m.z - c.z) / d * passo; c.attivita = 'camminare'; continue; }
        c.x = m.x; c.z = m.z; cammino[id] = null;
        if (m.entra) c.stanza = m.entra;
      }
      if (!piani[id] || !piani[id].length) {
        if (c.stanza) c.stanza = null;   // svegli: si esce
        piani[id] = decidiARegole(mondo, id, t);
      }
      const a = piani[id][0]; if (!a) continue;
      if (a.tipo === 'vai') { if (c.stanza !== (a.entra || null)) c.stanza = null; cammino[id] = { x: a.x, z: a.z, entra: a.entra || null }; piani[id].shift(); continue; }
      if (a.tipo === 'entra_biblioteca') {
        if (Math.hypot(BIBLIOTECA.x - c.x, BIBLIOTECA.z - c.z) > 1) { cammino[id] = { x: BIBLIOTECA.x, z: BIBLIOTECA.z }; continue; }
        c.stanza = BIBLIOTECA.stanza; piani[id].shift(); continue;
      }
      if (a.nome && !a.cosa) a.cosa = cercaCosa(a.nome);
      const r = eseguiAzioneVita(mondo, id, a, t);
      if (r.vai) { c.stanza = null; cammino[id] = { x: r.vai.x, z: r.vai.z, entra: r.vai.entra || null }; continue; }
      piani[id].shift();
      if (log && r.esito) log(`[${new Date(t).toISOString().slice(5, 16)}] ${id}: ${a.tipo} -> ${r.esito}`);
      if (!r.ok) { piani[id] = [{ tipo: 'riposa', quanto: 10 }]; c._fallito = t; }   // qualcosa non va: ci si ferma un attimo e si ripensa
    }
  }
  return { mondo, diario };
}

// uso da riga di comando
if (import.meta.url === `file://${process.argv[1]}`) {
  const giorni = +(process.argv[2] || 14), seme = +(process.argv[3] || 7);
  const inizio = process.argv[4] ? Date.parse(process.argv[4] + 'T07:00:00Z') : Date.UTC(2026, 10, 21, 7, 0);
  const verboso = process.env.VERBOSO === '1';
  const t0 = Date.now();
  const { mondo, diario } = simula({ giorni, seme, inizio, log: verboso ? console.log : null });
  console.log(`\nSimulati ${giorni} giorni in ${((Date.now() - t0) / 1000).toFixed(1)} s (seme ${seme}).\n`);
  console.log('giorno     | Ada: salute peso kcal mangiate/consumate, Starlight, ore lavorate, umore | Teo: idem | dispensa kcal | pesci kg | legna kg | pane S/kg | pioggia mm');
  for (const g of mondo.statistiche.giorni) {
    const f = c => `${String(c.salute).padStart(3)} ${c.peso.toFixed(1)}kg ${String(c.mangiato).padStart(5)}/${String(c.consumato).padStart(4)} ${String(c.starlight).padStart(4)}S ${String(c.lavorate).padStart(3)}h ${String(c.umore).padStart(5)}`;
    console.log(`${g.giorno} | ${f(g.corpi.ada)} | ${f(g.corpi.teo)} | ${String(g.kcalDispensa).padStart(6)} | ${String(g.pesciLaghetto).padStart(4)} | ${String(g.legnaDispensa).padStart(4)} | ${g.prezzoPane} | ${g.pioggiaMm}`);
  }
  if (diario.length) console.log('\nFatti importanti:\n' + diario.join('\n'));
  console.log('\nLo sguardo di GOD alla fine:\n' + vistaGod(mondo));
}
