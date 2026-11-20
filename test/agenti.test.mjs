// Prove del motore degli agenti (agenti/motore.mjs), senza chiave e senza spendere niente.
//   node test/agenti.test.mjs
import assert from 'node:assert/strict';
import { nuovoStato, passo, budget, percezione, giocatoreParla, vistaPubblica, normalizzaAzione, leggiRisposta, costoDi, meseDi, REGOLE, SCHEMA, proposte, giocatoreArriva } from '../agenti/motore.mjs';

const T0 = Date.UTC(2026, 10, 20, 12, 0, 0);   // 20 novembre 2026, 13:00 a Roma
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };

// cervello finto che risponde con le azioni scelte dalla prova e "costa" come un pensiero vero
function finto(risposte, uso = { input_tokens: 2500, output_tokens: 400 }) {
  const chiamate = [];
  const f = async req => { chiamate.push(req); const r = typeof risposte === 'function' ? risposte(req, chiamate.length) : risposte; return { testo: JSON.stringify(r), usage: uso, stop_reason: 'end_turn' }; };
  f.chiamate = chiamate; return f;
}
const risp = (azioni, extra) => Object.assign({ pensiero: 'ok', azioni, ricorda: '', prossimo_pensiero_minuti: 10, sforzo_prossimo: 'basso', memoria_nuova: '' }, extra || {});
async function scorri(s, da, minuti, cervello, passoS = 30) { let t = da; for (let i = 0; i < minuti * 60 / passoS; i++) { t += passoS * 1000; await passo(s, t, cervello); } return t; }

// 1) due agenti, pensano sfalsati, il costo viene contato
{
  const s = nuovoStato(T0), c = finto(risp([{ tipo: 'di', testo: 'Ciao borgo!' }]));
  ok(Object.keys(s.agenti).length === 2, 'due agenti');
  await passo(s, T0 + 20000, c);
  ok(c.chiamate.length === 1 && c.chiamate[0].agente === 'ada', 'pensa prima Ada');
  await passo(s, T0 + 70000, c);
  ok(c.chiamate.length === 2 && c.chiamate[1].agente === 'teo', 'poi Teo, sfalsato');
  const atteso = costoDi({ input_tokens: 2500, output_tokens: 400 });
  ok(Math.abs(budget(s.agenti.ada, T0 + 70000).spesi - atteso) < 1e-12, 'spesa registrata');
  ok(s.agenti.ada.detto && s.agenti.ada.detto.testo === 'Ciao borgo!', 'ha parlato');
  ok(c.chiamate[0].sforzo === 'low' && c.chiamate[0].maxTokens === REGOLE.maxTokens, 'sforzo basso di partenza');
  ok(/BUDGET: questo mese hai speso/.test(c.chiamate[0].messaggio) && /5 dollari al mese/.test(c.chiamate[0].system), 'l\'agente conosce il budget');
}

// 2) il tetto: con il budget quasi finito il modello non viene chiamato, si vive in automatico
{
  const s = nuovoStato(T0), c = finto(risp([]));
  s.agenti.ada.spesa[meseDi(T0)] = { usd: REGOLE.tettoUsd - 0.0001, pensieri: 9999, ingresso: 0, uscita: 0 };
  await passo(s, T0 + 20000, c);
  ok(c.chiamate.length === 0, 'nessuna chiamata oltre il tetto');
  ok(s.agenti.ada.modo === 'automatico' && s.agenti.ada.motivo === 'budget-finito', 'vive in automatico');
  ok(meseDi(s.agenti.ada.prossimoPensiero) === '2026-12', 'riprova il mese dopo');
  // passa a dicembre: budget nuovo, torna a pensare
  const dic = Date.UTC(2026, 11, 1, 0, 30);
  s.agenti.teo.prossimoPensiero = dic + 1e9;
  await passo(s, dic, c);
  ok(c.chiamate.length === 1 && s.agenti.ada.modo === 'attivo', 'a dicembre ricomincia');
  ok(budget(s.agenti.ada, dic).spesi < 0.01, 'spesa di dicembre ripartita da zero');
}

// 3) un mese intero con un agente che vuole pensare il piu' spesso possibile: mai oltre 5 $
{
  const s = nuovoStato(T0), c = finto(risp([{ tipo: 'di', testo: 'penso' }], { prossimo_pensiero_minuti: 1, sforzo_prossimo: 'medio' }), { input_tokens: 6000, output_tokens: 1600 });
  const inizio = Date.UTC(2026, 10, 1, 0, 0);
  s.ora = inizio; Object.values(s.agenti).forEach(a => { a.prossimoPensiero = inizio; });
  await scorri(s, inizio, 29 * 24 * 60, c, 300);
  const b = budget(s.agenti.ada, inizio + 29 * 864e5);
  ok(b.spesi <= REGOLE.tettoUsd && b.spesi > REGOLE.tettoUsd - 0.01, `tetto rispettato (${b.spesi.toFixed(4)} $)`);
  ok(s.agenti.ada.modo === 'automatico', 'finiti i soldi si ferma');
  const per = c.chiamate.filter(q => q.agente === 'ada').length;
  ok(per === b.pensieri, 'ogni chiamata e\' contata');
}

// 4) costruire: tempo vero, zone protette, portata, impilare solo su qualcosa
{
  const s = nuovoStato(T0); const ada = s.agenti.ada; ada.x = ada.tx = 20; ada.z = ada.tz = 50;
  let turno = 0;
  const c = finto(() => {
    turno++;
    if (turno === 1) return risp([{ tipo: 'costruisci', nome: 'muretto', forma: 'cubo', larghezza: 2, altezza: 1, profondita: 1, colore: 'pietra', x: 22, z: 50 }], { prossimo_pensiero_minuti: 15 });
    if (turno === 2) return risp([{ tipo: 'costruisci', nome: 'vaso', forma: 'cilindro', larghezza: 0.6, altezza: 0.8, profondita: 0.6, x: 22, z: 50, y: 1 },
      { tipo: 'costruisci', nome: 'nuvola', forma: 'sfera', larghezza: 1, altezza: 1, profondita: 1, x: 18, z: 50, y: 3 },
      { tipo: 'costruisci', nome: 'lontano', forma: 'cubo', x: 40, z: 60 }], { prossimo_pensiero_minuti: 30 });
    return risp([]);
  });
  Object.values(s.agenti).forEach(a => { a.nato = T0 - 5 * 864e5; });   // gia' ambientati
  s.agenti.teo.prossimoPensiero = T0 + 1e12;
  ada.prossimoPensiero = T0;
  await passo(s, T0 + 1000, c);
  const m = s.oggetti.find(o => o.nome === 'muretto');
  ok(m && !m.pronto && ada.lavoro, 'cantiere aperto');
  ok(m.colore === '#b9b0a2', 'colore per nome');
  await scorri(s, T0 + 1000, 7, c);
  ok(m.pronto && !ada.lavoro, 'muretto finito dopo 6 minuti (2 m3 x 3)');
  await scorri(s, T0 + 1000 + 7 * 60000, 12, c);
  const vaso = s.oggetti.find(o => o.nome === 'vaso');
  ok(vaso && vaso.y === 1, 'vaso appoggiato sul muretto');
  ok(!s.oggetti.find(o => o.nome === 'nuvola'), 'niente oggetti sospesi nel vuoto');
  ok(ada.esiti.some(e => /niente sotto/.test(e)) || ada.diario.length, 'esito del rifiuto registrato');
  await scorri(s, T0 + 1000 + 19 * 60000, 10, c);
  ok(!s.oggetti.find(o => o.nome === 'lontano'), 'non si costruisce lontano');
  // zona protetta: la fontana
  const z = { tipo: 'costruisci', forma: 'cubo', x: 1, z: 31 };
  const s2 = nuovoStato(T0); s2.agenti.ada.x = s2.agenti.ada.tx = 3; s2.agenti.ada.z = s2.agenti.ada.tz = 35; s2.agenti.teo.prossimoPensiero = T0 + 1e12;
  await passo(s2, T0 + 20000, finto(risp([z])));
  ok(s2.oggetti.length === 0 && s2.agenti.ada.esiti.some(e => /Fontana/.test(e)), 'vicino alla fontana non si costruisce');
}

// 5) percezione: solo quello che e' vicino
{
  const s = nuovoStato(T0);
  s.agenti.ada.x = -40; s.agenti.ada.z = 60; s.agenti.teo.x = 40; s.agenti.teo.z = 10;
  s.oggetti.push({ id: 'o99', autore: 'teo', nome: 'segreto', forma: 'cubo', l: 1, h: 1, p: 1, y: 0, rot: 0, colore: '#000000', x: 40, z: 12, pronto: true });
  let p = percezione(s, s.agenti.ada, T0);
  ok(!/Teo/.test(p) && !/segreto/.test(p), 'Ada non vede Teo ne\' il suo oggetto lontano');
  p = percezione(s, s.agenti.teo, T0);
  ok(/segreto/.test(p) && !/Ada,/.test(p), 'Teo vede il suo oggetto, non Ada');
  // una persona vera parla vicino a Teo: Teo la sente e si sveglia prima
  s.agenti.teo.prossimoPensiero = T0 + 3600e3; s.agenti.teo.ultimaVolta = T0 - 600e3;
  ok(giocatoreParla(s, 'Boris', 'Ciao Teo, costruisci una panchina?', 41, 11, T0), 'messaggio accettato');
  ok(s.agenti.teo.prossimoPensiero < T0 + 60e3, 'Teo si sveglia');
  ok(s.agenti.ada.prossimoPensiero !== T0 + 8000, 'Ada no');
  p = percezione(s, s.agenti.teo, T0 + 10e3);
  ok(/Boris \(persona vera\) ha detto: "Ciao Teo/.test(p), 'Teo ha sentito Boris');
  ok(!/Boris/.test(percezione(s, s.agenti.ada, T0 + 10e3)), 'Ada no');
}

// 6) memoria: quando il diario e' lungo l'agente la riscrive e il diario si accorcia
{
  const s = nuovoStato(T0); const ada = s.agenti.ada; s.agenti.teo.prossimoPensiero = T0 + 1e12;
  for (let i = 0; i < REGOLE.diarioMax + 3; i++) ada.diario.push({ t: T0 - i * 1000, s: 'fatto ' + i });
  const c = finto(risp([], { memoria_nuova: 'Sono Ada. Ho fatto tante cose nel borgo e voglio costruire un orto vicino al belvedere.' }));
  await passo(s, T0 + 20000, c);
  ok(/scrivi "memoria_nuova"/.test(c.chiamate[0].messaggio), 'chiesto il riassunto');
  ok(ada.memoria.startsWith('Sono Ada') && ada.diario.length <= 6, 'memoria riscritta, diario corto ' + JSON.stringify(ada.diario.slice(-3)) + ada.memoria.slice(0, 40));
}

// 7) errori del modello: niente costo, si riprova piu' tardi; risposte rotte non bloccano
{
  const s = nuovoStato(T0); s.agenti.teo.prossimoPensiero = T0 + 1e12;
  const rotto = async () => { throw new Error('rete giu\''); };
  const r = await passo(s, T0 + 20000, rotto);
  ok(r[0].motivo === 'errore' && budget(s.agenti.ada, T0).spesi === 0 && s.agenti.ada.prossimoPensiero > T0 + 60000, 'errore: riprova dopo');
  const s3 = nuovoStato(T0); s3.agenti.teo.prossimoPensiero = T0 + 1e12;
  await passo(s3, T0 + 20000, async () => ({ testo: 'non so', usage: { input_tokens: 10, output_tokens: 5 }, stop_reason: 'end_turn' }));
  ok(s3.agenti.ada.ultimoPensiero && budget(s3.agenti.ada, T0).pensieri === 1, 'risposta non JSON: contata ma innocua');
  // senza chiave: automatico
  const s4 = nuovoStato(T0);
  await passo(s4, T0 + 20000, null);
  ok(s4.agenti.ada.modo === 'automatico' && s4.agenti.ada.motivo === 'senza-chiave', 'senza chiave vive in automatico');
}

// 8) pausa: fermi, nessuna chiamata, i tempi slittano
{
  const s = nuovoStato(T0), c = finto(risp([]));
  const prima = s.agenti.ada.prossimoPensiero;
  for (let i = 1; i <= 120; i++) await passo(s, T0 + i * 60000, c, { pausa: true });
  ok(c.chiamate.length === 0 && s.pausa && vistaPubblica(s, T0).pausa, 'in pausa non pensa');
  ok(s.agenti.ada.prossimoPensiero === prima + 120 * 60000, 'il pensiero slitta');
  await passo(s, T0 + 121 * 60000, c);
  ok(!s.pausa, 'ripartito');
}

// 10) tra un pensiero e l'altro si passeggia gratis lì intorno, e si vede la previsione del budget
{
  const s = nuovoStato(T0), c = finto(risp([{ tipo: 'vai', x: 0, z: 40 }], { prossimo_pensiero_minuti: 600 }));
  Object.values(s.agenti).forEach(a => { a.nato = T0 - 5 * 864e5; });   // gia' ambientati
  let t = await scorri(s, T0, 3, c);
  const ada = s.agenti.ada, chiamate = c.chiamate.length;
  t = await scorri(s, t, 5, c);
  ok(c.chiamate.length === chiamate, 'passeggiare non chiama il modello');
  const posti = new Set(); let lontano = 0;
  for (let i = 0; i < 40; i++) { t = await scorri(s, t, 1, c); posti.add(ada.x + ',' + ada.z); lontano = Math.max(lontano, Math.hypot(ada.x - 0, ada.z - 40)); }
  ok(posti.size > 3 && lontano <= 7.5, 'passeggia vicino a dove era andata (' + posti.size + ' posti, max ' + lontano.toFixed(1) + ' m)');
  t = await scorri(s, t, 40, c);
  ok((ada.visti || []).length >= 1 && ada.diario.some(d => /Facendo un giro sono arrivato/.test(d.s)), 'poi va a esplorare altri posti (' + (ada.visti || []).join(', ') + ')');
  const m = percezione(s, s.agenti.teo, t);
  ok(/te ne restano circa \d+/.test(m), 'previsione del budget nella percezione');
}

// 11) proposte per chi crea il gioco: finiscono in una lista, al massimo 3 al giorno per agente
{
  const s = nuovoStato(T0), c = finto(risp([{ tipo: 'proponi', testo: 'Un mercato coperto' }, { tipo: 'proponi', testo: 'Una biblioteca' }], { prossimo_pensiero_minuti: 1 }));
  await scorri(s, T0, 6, c);
  const l = proposte(s), di = l.filter(p => p.chi === 'Ada');
  ok(di.length === 3, 'al massimo 3 proposte al giorno (' + di.length + ')');
  ok(l[0].testo && s.cronaca.some(e => e.tipo === 'proposta'), 'nella lista e nella cronaca');
  ok(normalizzaAzione({ tipo: 'proponi', testo: '' }).errore, 'proposta vuota rifiutata');
}

// 12) abitudine: una routine che si segue da soli, gratis; e i primi 2 giorni si pensa almeno ogni 10 minuti
{
  const s = nuovoStato(T0), c = finto(risp([{ tipo: 'abitudine', testo: 'mattina: Fontana; pomeriggio: Laghetto; sera: Torre della Cometa; notte: Fontana' }], { prossimo_pensiero_minuti: 600 }));
  let t = await scorri(s, T0, 2, c);
  const ada = s.agenti.ada;
  ok(ada.abitudine && ada.abitudine.pomeriggio === 'Laghetto', 'abitudine salvata');
  ok(ada.prossimoPensiero - ada.ultimaVolta <= 3 * 60000, 'nei primi giorni ripensa entro 3 minuti');
  ok(/SEI NEL BORGO DA POCO/.test(percezione(s, ada, t)) && /LA TUA ABITUDINE/.test(percezione(s, ada, t)), 'lo sa');
  Object.values(s.agenti).forEach(a => { a.nato = T0 - 5 * 864e5; a.prossimoPensiero = t + 864e5; });
  const chiamate = c.chiamate.length;
  t = await scorri(s, t, 50, c);   // pomeriggio a Roma: va da sola al Laghetto (x=38 z=32)
  ok(Math.hypot(ada.x - 38, ada.z - 35) < 4.5 && c.chiamate.length === chiamate, 'segue l\'abitudine senza pensare (' + ada.x + ',' + ada.z + ')');
  ok(normalizzaAzione({ tipo: 'abitudine', testo: 'mattina: Luna' }).errore && normalizzaAzione({ tipo: 'abitudine', testo: 'nessuna' }).abitudine === null, 'luoghi controllati, si puo\' togliere');
}

// 13) gesti: saluta, salta... visibili nel gioco, sentiti da chi e' vicino, non nella cronaca
{
  const s = nuovoStato(T0), c = finto(risp([{ tipo: 'gesto', testo: 'salta' }, { tipo: 'gesto', testo: 'vola' }]));
  await passo(s, T0 + 20000, c); await passo(s, T0 + 50000, c);
  ok(s.agenti.ada.gesto && s.agenti.ada.gesto.tipo === 'salta' && vistaPubblica(s, T0 + 50000).agenti[0].gesto.tipo === 'salta', 'gesto fatto e visibile');
  ok(!s.cronaca.some(e => e.tipo === 'gesto') && s.agenti.ada.esiti.some(x => /gesto: usa uno di/.test(x)), 'non in cronaca; gesto sconosciuto rifiutato');
}

// 14) giochi inventati dagli agenti: quiz, tesoro, gara; il codice fa da arbitro
{
  const giochiPrima = REGOLE.giochi; REGOLE.giochi = true;
  const s = nuovoStato(T0); Object.values(s.agenti).forEach(a => { a.nato = T0 - 5 * 864e5; });
  const ada = s.agenti.ada, teo = s.agenti.teo; teo.prossimoPensiero = T0 + 1e12;
  const c = finto((req, n) => n === 1 ? risp([{ tipo: 'gioco', forma: 'quiz', testo: 'Di che colore e\' il cielo di notte?', nome: 'Nero' }], { prossimo_pensiero_minuti: 600 }) : risp([], { prossimo_pensiero_minuti: 600 }));
  await passo(s, T0 + 20000, c);
  ok(s.giochi.length === 1 && /QUIZ!/.test(ada.detto.testo) && !JSON.stringify(vistaPubblica(s, T0 + 20000)).includes('Nero'), 'quiz lanciato, risposta segreta');
  giocatoreParla(s, 'Boris', 'forse blu?', ada.x, ada.z, T0 + 30000);
  ok(!s.giochi[0].finito, 'risposta sbagliata');
  giocatoreParla(s, 'Boris', 'è NERO!', ada.x, ada.z, T0 + 40000);
  ok(s.giochi[0].vincitore === 'Boris' && s.punti.Boris === 1 && /Ha vinto Boris/.test(ada.detto.testo), 'vince chi risponde giusto');
  // tesoro: nascosto vicino, lo trova un giocatore
  ada.coda = [normalizzaAzione({ tipo: 'gioco', forma: 'tesoro', testo: 'Vicino a me!', x: ada.x + 3, z: ada.z })];
  await passo(s, T0 + 50000, c);
  const g = s.giochi[1];
  ok(g && g.forma === 'tesoro' && s.oggetti.some(o => o.gioco === g.id), 'tesoro nascosto (sfera d\'oro)');
  ok(!giocatoreArriva(s, 'Rosa', g.x + 6, g.z, T0 + 60000) && giocatoreArriva(s, 'Rosa', g.x + 1, g.z, T0 + 61000), 'trovato solo da vicino');
  ok(g.vincitore === 'Rosa' && !s.oggetti.some(o => o.gioco === g.id), 'tesoro tolto, Rosa vince');
  // gara: vince l'altro agente se arriva per primo; e un gioco scade
  ada.coda = [normalizzaAzione({ tipo: 'gioco', forma: 'gara', testo: 'Al Belvedere!', luogo: 'Belvedere' })];
  await passo(s, T0 + 70000, c);
  teo.coda = [normalizzaAzione({ tipo: 'vai', luogo: 'Belvedere' })];
  await scorri(s, T0 + 70000, 2, c);
  ok(s.giochi[2] && s.giochi[2].vincitore === 'Teo' && s.punti.Teo === 1, 'gara vinta da Teo ' + JSON.stringify([s.giochi[2], ada.esiti, teo.x, teo.z, teo.esiti]));
  ada.coda = [normalizzaAzione({ tipo: 'gioco', forma: 'quiz', testo: 'Quanto fa 2+2?', nome: '4' })];
  let t = T0 + 70000 + 2 * 60000; await passo(s, t + 1000, c); t = await scorri(s, t + 1000, 11, c);
  ok(s.giochi[3].finito && !s.giochi[3].vincitore && /Tempo scaduto/.test(ada.detto.testo), 'scade dopo 10 minuti');
  ok(normalizzaAzione({ tipo: 'gioco', forma: 'quiz', testo: 'x' }).errore && normalizzaAzione({ tipo: 'gioco', forma: 'scacchi', testo: 'x' }).errore, 'giochi controllati');
  REGOLE.giochi = giochiPrima;
}

// 9) pezzi piccoli
ok(normalizzaAzione({ tipo: 'vai', luogo: 'fontana' }).x === 0, 'luogo per nome');
ok(normalizzaAzione({ tipo: 'vola' }).errore, 'azione sconosciuta');
ok(normalizzaAzione({ tipo: 'costruisci', larghezza: 99 }).l === 8, 'misure limitate');
ok(leggiRisposta('ecco: {"a":1} fine').a === 1 && leggiRisposta('{rotto') === null, 'lettura JSON tollerante');
ok(meseDi(Date.UTC(2026, 10, 30, 23, 30)) === '2026-12', 'il mese cambia a mezzanotte di Roma');
ok(SCHEMA.properties.azioni.items.required.length === Object.keys(SCHEMA.properties.azioni.items.properties).length, 'schema coerente');
const v = vistaPubblica(nuovoStato(T0), T0);
ok(v.agenti.length === 2 && v.agenti[0].budget.tetto === 5 && !JSON.stringify(v).includes('spesa'), 'vista pubblica');

console.log(`ok  agenti: ${n} controlli`);
