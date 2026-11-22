// Prove dell'archivio dell'esperimento (agenti/registro.mjs), senza chiave e senza spendere niente.
//   node test/registro.test.mjs
import assert from 'node:assert/strict';
import { nuovoStato, passo, giocatoreParla, percezione } from '../agenti/motore.mjs';
import { osserva, FOTO_OGNI_MS } from '../agenti/registro.mjs';
import { copia } from '../strumenti/copia-registro.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const risposta = { pensiero: 'Guardo la fontana.', azioni: [{ tipo: 'di', testo: 'Ciao borgo!' }], ricorda: 'Ho salutato il borgo.', prossimo_pensiero_minuti: 10, sforzo_prossimo: 'basso', memoria_nuova: '' };
const cervello = async () => ({ testo: JSON.stringify(risposta), usage: { input_tokens: 2500, output_tokens: 400 }, stop_reason: 'end_turn' });

const s = nuovoStato(T0);
let memo = null, tutte = [];
const giro = (t) => { const r = osserva(s, memo, t); memo = r.memo; tutte = tutte.concat(r.righe); return r.righe; };

// 1) la prima volta: memoria iniziale di entrambi e una foto
{
  const r = giro(T0);
  ok(r.filter(x => x.tipo === 'memoria').length === 2, 'memoria iniziale di Ada e Teo');
  ok(r.filter(x => x.tipo === 'foto').length === 1, 'una foto');
  const f = r.find(x => x.tipo === 'foto');
  ok(f.dati.agenti.length === 2 && f.dati.agenti[0].budget, 'la foto ha agenti e budget');
}

// 2) un pensiero: riga pensiero con azioni e costo, diario, cronaca della frase
{
  let t = T0;
  for (let i = 0; i < 4; i++) { t += 30000; await passo(s, t, cervello); giro(t); }
  const pensieri = tutte.filter(x => x.tipo === 'pensiero');
  ok(pensieri.length >= 2, 'pensieri archiviati: ' + pensieri.length);
  ok(pensieri[0].dati.pensiero === 'Guardo la fontana.' && pensieri[0].dati.azioni[0].testo === 'Ciao borgo!', 'pensiero con le azioni decise');
  ok(pensieri[0].dati.costo > 0 && pensieri[0].dati.ingresso === 2500, 'costo e token');
  ok(tutte.some(x => x.tipo === 'diario' && x.dati.testo === 'Ho salutato il borgo.'), 'riga del diario');
  ok(tutte.some(x => x.tipo === 'cronaca' && x.dati.tipo === 'parla' && x.dati.testo === 'Ciao borgo!'), 'la frase detta e\' in cronaca');
  // niente doppioni rileggendo lo stesso stato
  ok(giro(t).length === 0, 'nessun doppione');
  // una persona vera parla: entra una sola volta
  giocatoreParla(s, 'boris', 'Ciao Ada!', s.agenti.ada.x, s.agenti.ada.z, t + 1000);
  const r = giro(t + 1000);
  ok(r.length === 1 && r[0].chi === 'g:boris' && r[0].dati.testo === 'Ciao Ada!', 'frase del giocatore archiviata una volta');
}

// 3) piu' voci con la stessa ora non si perdono
{
  const t = T0 + 999999;
  s.cronaca.push({ t, chi: 'ada', tipo: 'parla', testo: 'uno' });
  giro(t);
  s.cronaca.push({ t, chi: 'teo', tipo: 'parla', testo: 'due' });
  const r = giro(t);
  ok(r.length === 1 && r[0].dati.testo === 'due', 'seconda voce con la stessa ora presa');
}

// 4) memoria riscritta e foto ogni ora
{
  s.agenti.teo.memoria = 'Sono Teo. Mai pesce crudo.';
  const r = giro(T0 + FOTO_OGNI_MS + 5000);
  ok(r.some(x => x.tipo === 'memoria' && x.chi === 'teo' && /pesce crudo/.test(x.dati.testo)), 'memoria nuova archiviata intera');
  ok(r.some(x => x.tipo === 'foto'), 'nuova foto dopo un\'ora');
  ok(!giro(T0 + FOTO_OGNI_MS + 60000).some(x => x.tipo === 'foto'), 'non piu\' di una foto all\'ora');
}

// 5) il memo e' piccolo e si puo' salvare (JSON)
ok(JSON.stringify(memo).length < 2000, 'memo piccolo');

// 6) la copia nei file: un file per giorno (ora italiana), nessun doppione alla seconda copia
{
  const righe = tutte.map((r, i) => Object.assign({ id: i + 1 }, r));
  righe.push({ id: righe.length + 1, t: Date.UTC(2026, 10, 21, 23, 30), tipo: 'cronaca', chi: 'ada', dati: { testo: 'dopo mezzanotte a Roma' } });
  const servizio = async u => { const da = +new URL(u).searchParams.get('da'); return { ok: true, json: async () => ({ righe: righe.filter(r => r.id > da).slice(0, 5) }) }; };
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'registro-'));
  const n1 = await copia('https://x', dir, servizio), n2 = await copia('https://x', dir, servizio);
  ok(n1 === righe.length && n2 === 0, 'copiate tutte, poi nessun doppione');
  ok(fs.existsSync(path.join(dir, '2026-11', '2026-11-22.jsonl')), 'le 23:30 UTC del 21 sono il 22 a Roma');
  const lette = fs.readdirSync(path.join(dir, '2026-11')).flatMap(f => fs.readFileSync(path.join(dir, '2026-11', f), 'utf8').trim().split('\n'));
  ok(lette.length === righe.length, 'tutte le righe nei file');
}

// 7) chi si siede non "sta smontando qualcosa" (la falsa accusa di Ada a Teo nasceva da qui)
{
  const s2 = nuovoStato(T0), a = s2.agenti.ada, t = s2.agenti.teo;
  t.x = a.x + 3; t.z = a.z; t.tx = t.x; t.tz = t.z;
  t.lavoro = { tipo: 'usa', id: 'o5', nome: 'Sedia', inizio: T0, fine: T0 + 600000 };
  const p = percezione(s2, a, T0 + 1000);
  ok(/Teo, a 3 m, sta usando: Sedia/.test(p) && !/smontando/.test(p), 'Teo seduto si vede seduto');
}

// 8) "dai" con una cosa comprata al negozio (nello zaino del borgo): Teo ha provato un giorno intero a dare la cioccolata ad Ada
{
  const s3 = nuovoStato(T0), a = s3.agenti.ada, t = s3.agenti.teo;
  t.zaino = { 'Cioccolata calda': 2 }; t.stanza = null; a.stanza = null;
  t.x = 0; t.z = 10; t.tx = 0; t.tz = 10; a.x = 12; a.z = 10; a.tx = 12; a.tz = 10;
  const dai = { pensiero: 'Le porto la cioccolata.', azioni: [{ tipo: 'dai', nome: 'cioccolata calda', id: 'Ada' }], ricorda: '', prossimo_pensiero_minuti: 30, sforzo_prossimo: 'basso', memoria_nuova: '' };
  const zitto = { pensiero: 'Aspetto.', azioni: [], ricorda: '', prossimo_pensiero_minuti: 60, sforzo_prossimo: 'basso', memoria_nuova: '' };
  let primo = true;
  const cerv = async (q) => { const v = (q.agente === 'teo' && !q.mossa && primo) ? (primo = false, dai) : zitto; return { testo: JSON.stringify(v), usage: { input_tokens: 100, output_tokens: 50 }, stop_reason: 'end_turn' }; };
  let tt = T0;
  for (let i = 0; i < 40 && !(a.zaino && a.zaino['Cioccolata calda']); i++) { tt += 30000; a.tx = a.x; a.tz = a.z; await passo(s3, tt, cerv); }
  ok(a.zaino && a.zaino['Cioccolata calda'] === 1, 'Ada ha ricevuto la cioccolata: ' + JSON.stringify(a.zaino) + ' esiti Teo: ' + JSON.stringify(t.esiti));
  ok(t.zaino['Cioccolata calda'] === 1, 'a Teo ne resta una');
  ok(a.diario.some(d => /Teo mi ha dato "Cioccolata calda"/.test(d.s)), 'Ada lo sa (diario)');
}

console.log(`registro: ${n} prove superate`);
