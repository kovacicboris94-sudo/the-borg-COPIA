// Prove dei minigiochi giocati davvero dagli agenti (agenti/giochi/).
//   node test/giochi-agenti.test.mjs
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
import { GIOCHI, avviaPartita, passoPartite, promptMossa, REGOLE_GIOCHI } from '../agenti/giochi/index.mjs';
import { nuovoStato, passo, normalizzaAzione, percezione, vistaPubblica, REGOLE } from '../agenti/motore.mjs';
import { CARTE, LEADER } from '../agenti/giochi/belinverse-carte.mjs';
import { osserva } from '../agenti/registro.mjs';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const T0 = Date.UTC(2026, 10, 22, 13, 0, 0);

// 1) le copie del gioco sono uguali agli originali (motore degli scacchi e carte di Belinverse)
{
  const src = readFileSync(new URL('../src/minigiochi/scacchi/motore.js', import.meta.url), 'utf8');
  const copia = readFileSync(new URL('../agenti/giochi/scacchi-motore.mjs', import.meta.url), 'utf8');
  const f = src.slice(src.indexOf('  function fabbricaScacchi() {'), src.indexOf('  /* ---------- punti Elo e livelli')).trimEnd().replace(/^ {2}/gm, '');
  ok(copia.includes(f), 'scacchi-motore.mjs e\' la copia esatta di fabbricaScacchi (se hai cambiato il gioco, ricopiala)');
  const ctx = { window: {} };
  vm.runInNewContext(readFileSync(new URL('../src/minigiochi/belinverse/carte.js', import.meta.url), 'utf8'), ctx);
  const B = ctx.window.B3.BELIN_CARTE;
  ok(JSON.stringify(B.CARTE) === JSON.stringify(CARTE) && JSON.stringify(B.LEADER) === JSON.stringify(LEADER), 'belinverse-carte.mjs e\' uguale alle carte del gioco (se le hai cambiate, ricopiale)');
}

// 2) ogni gioco si gioca fino alla fine, lo stato si salva in JSON, le risposte sbagliate sono rifiutate
for (const [id, G] of Object.entries(GIOCHI)) {
  for (let k = 0; k < (id === 'scacchi' ? 2 : 20); k++) {
    const gs = [{ id: 'ada', nome: 'Ada', esperienza: 0.1, stat: { g: 2, v: 1, p: 1, x: 0 } }]; if (G.aDue) gs.push({ id: 'computer', nome: 'il computer', computer: true });
    let st = G.nuova({ giocatori: gs, richiesta: '', momento: 'sera', seme: 77 + k });
    let g = 0;
    while (!G.fine(st) && g++ < 600) {
      const i = G.tocca(st); if (i < 0) break;
      const d = G.domanda(st, i);
      if (k === 0 && g === 1) { ok(d.testo.length > 20 && d.testo.length < 4000, id + ': la domanda e\' corta e chiara'); ok(!G.applica(st, i, 'banana volante').ok, id + ': una risposta senza senso e\' rifiutata'); }
      const r = G.applica(st, i, G.auto(st, i)); assert.ok(r.ok, id + ': la mossa d\'istinto e\' valida ' + JSON.stringify(r));
      st = JSON.parse(JSON.stringify(st));   // come nel Durable Object: lo stato si salva e si rilegge
    }
    const f = G.fine(st);
    ok(f && ['vinto', 'perso', 'patta'].includes(f.esiti[0]) && f.testi[0], id + ': la partita finisce con un esito ' + JSON.stringify(f && f.testi));
  }
}

// 3) Belinverse si rigioca uguale (stesso seme + stesse decisioni = stessa partita)
{
  const G = GIOCHI.belinverse, st = G.nuova({ giocatori: [{ nome: 'Ada' }, { nome: 'Teo' }], seme: 4242 });
  for (let k = 0; k < 30 && !G.fine(st); k++) { const i = G.tocca(st); G.applica(st, i, G.auto(st, i)); }
  const copia = JSON.parse(JSON.stringify(st));
  ok(G.vista(copia) === G.vista(st) && G.tocca(copia) === G.tocca(st), 'Belinverse: la partita rigiocata e\' identica');
  const d = G.domanda(st, G.tocca(st));
  ok(/TU \(/.test(d.testo) && /AVVERSARIO/.test(d.testo) && /^1\) /.test(d.opzioni[0]), 'Belinverse: la domanda mostra mano, campo e scelte numerate');
}

// 4) scacchi: notazione italiana e inglese, abbandono
{
  const G = GIOCHI.scacchi, st = G.nuova({ giocatori: [{ nome: 'Ada', stat: { g: 0 } }, { nome: 'il computer', computer: true }], seme: 1 });
  st.bianco = 0;
  ok(G.applica(st, 0, 'Cf3').ok && G.applica(st, 1, 'e5').ok && G.applica(st, 0, 'Nc3').ok, 'scacchi: Cf3 (italiano) e Nc3 (inglese)');
  ok(!G.applica(st, 1, 'Ke7xx9').ok, 'scacchi: mossa impossibile rifiutata');
  ok(G.applica(st, 1, 'abbandono').ok && G.fine(st).esiti[0] === 'vinto' && G.fine(st).stat[0].elo > 800, 'scacchi: chi abbandona perde, l\'Elo sale a chi vince');
  ok(/SCACCHIERA/.test(G.domanda(G.nuova({ giocatori: [{ nome: 'Ada' }, { nome: 'Teo' }], seme: 2 }), 0).testo), 'scacchi: la scacchiera e\' nel prompt');
}

// 5) la partita nel borgo: la mossa la pensa l'agente (domanda corta e costo contato), errori e istinto
{
  const s = nuovoStato(T0); Object.values(s.agenti).forEach(a => { a.nato = T0 - 5 * 864e5; a.prossimoPensiero = T0 + 1e12; });
  const ada = s.agenti.ada, chiamate = [];
  let sbaglia = 1;
  const cervello = async req => {
    chiamate.push(req);
    if (req.mossa) {
      const m = sbaglia-- > 0 ? 'mossa che non esiste' : (/"([^"]+)"/.exec(req.domanda.formato) || [])[1];
      return { testo: JSON.stringify({ pensiero: 'Penso alla mossa', mossa: m }), usage: { input_tokens: 600, output_tokens: 40 }, stop_reason: 'end_turn' };
    }
    return { testo: JSON.stringify({ pensiero: 'x', azioni: [], ricorda: '', prossimo_pensiero_minuti: 600, sforzo_prossimo: 'basso', memoria_nuova: '' }), usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: 'end_turn' };
  };
  ada.coda = [normalizzaAzione({ tipo: 'usa', nome: 'Scacchi' })]; ada.tx = ada.x; ada.tz = ada.z;
  let t = T0;
  for (let i = 0; i < 20 && !ada.partita; i++) { t += 30000; await passo(s, t, cervello); }
  ok(ada.partita && s.partite[ada.partita].gioco === 'scacchi' && ada.lavoro.partita === ada.partita, 'Ada si siede agli scacchi e la partita comincia');
  const mosse = chiamate.filter(c => c.mossa);
  ok(mosse.length && mosse.length <= REGOLE_GIOCHI.mossePartitaPasso * 20, 'le mosse si chiedono a lei');
  ok(mosse.every(c => c.maxTokens === REGOLE_GIOCHI.maxTokens && c.system.length < 1200 && c.messaggio.length < 3000), 'la domanda della mossa e\' corta (costa poco)');
  ok(mosse.some(c => /non andava bene/.test(c.messaggio)), 'dopo una mossa sbagliata le si dice cosa non andava');
  const sp = Object.values(ada.spesa)[0];
  ok(sp.mosse >= 1 && sp.usdMosse > 0 && sp.usd >= sp.usdMosse, 'il costo delle mosse e\' contato nel budget');
  ok(/Penso alla mossa/.test(JSON.stringify(vistaPubblica(s, t).partite.inCorso)), 'il gioco vede la partita e cosa pensa');
  ok(/Stai usando: Scacchi|sta giocando/.test(percezione(s, ada, t)) || ada.partita, 'percezione');
  for (let i = 0; i < 400 && ada.partita; i++) { t += 30000; await passo(s, t, cervello); }
  ok(!ada.partita && ada.giochi.scacchi.g === 1 && /Scacchi contro /.test(ada.diario.map(d => d.s).join()), 'la partita finisce, va nel diario e nelle statistiche ' + JSON.stringify(ada.esiti));
  ok(/LE TUE PARTITE: Scacchi 1/.test(percezione(s, ada, t)), 'le sue partite sono nella percezione');
  ok(vistaPubblica(s, t).partite.finite.length === 1, 'la partita finita resta visibile nel gioco');
  const { righe } = osserva(s, null, t);
  ok(righe.some(r => r.tipo === 'mossa' && r.dati.gioco === 'scacchi' && r.dati.pensiero === 'Penso alla mossa'), 'le mosse finiscono nell\'archivio dell\'esperimento');
}

// 6) senza chiave si gioca d'istinto (gratis); chi aspetta un avversario dopo 10 minuti gioca col computer; chi se ne va perde
{
  const s = nuovoStato(T0); Object.values(s.agenti).forEach(a => { a.nato = T0 - 5 * 864e5; a.prossimoPensiero = T0 + 1e12; });
  const ada = s.agenti.ada, teo = s.agenti.teo;
  const aiuto = { nomeDi: (st, id) => (st.agenti[id] || {}).nome || id, esito: (ag, x) => ag.esiti.push(x), annota: (ag, t, x) => ag.diario.push({ t, s: x }), evento: () => {}, guadagna: () => '', puoGiocare: () => true, pensaMossa: async () => null };
  avviaPartita(s, ada, 'belinverse', 'aspetto un avversario', T0, aiuto);
  const p = s.partite[ada.partita];
  ok(p.attesaFino && p.g[1] === null, 'Ada aspetta un avversario');
  await passoPartite(s, T0 + 11 * 60000, aiuto);
  ok(p.g[1] === 'computer' && p.st, 'dopo 10 minuti gioca contro il computer');
  ok(p.mosse > 0 && p.istinto.ada > 0, 'senza cervello le mosse si fanno d\'istinto');
  avviaPartita(s, teo, 'cripta', '', T0, aiuto);
  teo.partita = null;   // si e' alzato
  await passoPartite(s, T0 + 12 * 60000, aiuto);
  ok(/hai lasciato la partita/.test(teo.esiti.join()) && teo.giochi.cripta.p === 1, 'chi si alza dal tavolo perde');
}

// 7) Borg Bubble si gioca a un Cabinato arcade posato in piazza
{
  const s = nuovoStato(T0); Object.values(s.agenti).forEach(a => { a.nato = T0 - 5 * 864e5; a.prossimoPensiero = T0 + 1e12; });
  const ada = s.agenti.ada, c = async () => ({ testo: '{}', usage: {}, stop_reason: 'end_turn' });
  ada.coda = [normalizzaAzione({ tipo: 'usa', nome: 'Borg Bubble' })];
  await passo(s, T0 + 30000, c);
  ok(/nessun Cabinato arcade/.test(ada.esiti.join()), 'senza cabinato non si gioca');
  s.oggetti.push({ id: 'o1', nome: 'Cabinato arcade', forma: 'cubo', modello: 'arcade', arredo: true, x: ada.x + 3, z: ada.z, y: 0, larghezza: 1, altezza: 1.9, profondita: 0.9, rotazione: 0, pronto: true, autore: 'ada' });
  ada.coda = [normalizzaAzione({ tipo: 'usa', nome: 'Borg Bubble' })];
  let t = T0 + 30000;
  for (let i = 0; i < 6 && !ada.partita; i++) { t += 30000; await passo(s, t, c); }
  ok(ada.partita && s.partite[ada.partita].gioco === 'bubble', 'al cabinato comincia una partita a Borg Bubble');
  ok(REGOLE.partite === true, 'le partite vere sono accese');
}

console.log(`ok  giochi degli agenti: ${n} controlli`);
