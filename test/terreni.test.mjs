// Prove dei terreni (agenti/terreni.mjs e il motore): comprare un lotto, aprire il cantiere, casa e negozio finiti.
//   node test/terreni.test.mjs
import assert from 'node:assert/strict';
import { nuovoStato, passo, percezione, vistaPubblica, normalizzaAzione, giocatoreTerreno, giocatoreTurno, giocatoreVende, promptDiSistema, SCHEMA, STANZE, sincronizzaTerreni } from '../agenti/motore.mjs';
import { LOTTI, LOTTO, geometria, costoProgetto, cantiereAperto, finePrevista, passoCantieri, PROGETTI, REGOLE_TERRENI, listinoDi, negoziDeiLotti, vistaTerreni, PREZZO_MAX } from '../agenti/terreni.mjs';
import { CLIENTI, persuasione } from '../agenti/negozi.mjs';
import { NEGOZI } from '../agenti/negozi.mjs';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const ROMA = (g, h, mi = 0) => Date.UTC(2026, 10, g, h - 1, mi);   // novembre 2026: Roma = UTC+1
const muto = async () => ({ testo: JSON.stringify({ pensiero: '', azioni: [], ricorda: '', prossimo_pensiero_minuti: 720, sforzo_prossimo: 'basso', memoria_nuova: '' }), usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: 'end_turn' });
async function scorri(s, da, minuti, passoS = 30) { let t = da; for (let i = 0; i < minuti * 60 / passoS; i++) { t += passoS * 1000; await passo(s, t, muto); } return t; }

// 1) i lotti stanno nella piazza, non si sovrappongono tra loro ne' alle casette di Ada e Teo
{
  const R = LOTTI.map(l => geometria(l).rect);
  ok(R.every(r => r.x0 >= -52 && r.x1 <= 52 && r.z0 >= -4 && r.z1 <= 70), 'lotti dentro la piazza');
  for (let i = 0; i < R.length; i++) for (let j = i + 1; j < R.length; j++) ok(R[i].x1 <= R[j].x0 || R[j].x1 <= R[i].x0 || R[i].z1 <= R[j].z0 || R[j].z1 <= R[i].z0, 'lotti separati ' + i + ' ' + j);
  ok(R.every(r => ![[-22, 63], [22, 63]].some(([x, z]) => x + 2.5 > r.x0 && x - 2.5 < r.x1 && z + 2.5 > r.z0 && z - 2.5 < r.z1)), 'lontani dalle casette');
  ok(Math.abs(Math.min(...R.map(r => Math.abs((r.x0 + r.x1) / 2)))) >= 6, 'la Porta del Borgo resta libera');
}

// 2) orari del cantiere: lun-sab 8-17, ora di Roma
{
  ok(cantiereAperto(ROMA(23, 10)) && !cantiereAperto(ROMA(23, 7)) && !cantiereAperto(ROMA(23, 18)), 'lunedi\' 10 si lavora, 7 e 18 no');
  ok(!cantiereAperto(ROMA(22, 12)), 'domenica no');
  const f = finePrevista(9, ROMA(23, 8));   // un giorno pieno di lavoro
  ok(Math.abs(f - ROMA(23, 17)) <= 15 * 60000, '9 ore da lunedi\' alle 8 = lunedi\' alle 17');
  const f2 = finePrevista(PROGETTI.casa.ore, ROMA(23, 8));
  ok(f2 > ROMA(23, 8) + 7 * 864e5 && f2 < ROMA(23, 8) + 10 * 864e5, 'una casa: circa 8 giorni di lavoro (piu\' di una settimana)');
}

// 3) una persona vera compra e costruisce un negozio; il negozio funziona con i clienti; solo lui ci lavora
{
  const s = nuovoStato(ROMA(23, 9));
  let r = giocatoreTerreno(s, 'Boris', { azione: 'compra', lotto: 'lotto2', soldi: 100 }, ROMA(23, 9));
  ok(!r.ok && /Costa/.test(r.motivo), 'senza soldi non si compra');
  r = giocatoreTerreno(s, 'Boris', { azione: 'compra', lotto: 'lotto2', soldi: 50000 }, ROMA(23, 9));
  ok(r.ok && r.spesa === LOTTI[1].prezzo, 'comprato, il gioco toglie il prezzo');
  ok(!giocatoreTerreno(s, 'Boris', { azione: 'compra', lotto: 'lotto3', soldi: 50000 }, ROMA(23, 9)).ok, 'uno a testa');
  ok(!giocatoreTerreno(s, 'Luca', { azione: 'compra', lotto: 'lotto2', soldi: 50000 }, ROMA(23, 9)).ok, 'un lotto venduto non si ricompra');
  ok(!giocatoreTerreno(s, 'Boris', { azione: 'costruisci', tipo: 'negozio', soldi: 99999 }, ROMA(23, 9)).ok, 'il negozio deve dire cosa vende');
  r = giocatoreTerreno(s, 'Boris', { azione: 'costruisci', tipo: 'negozio', genere: 'dolci', nome: 'Dolci di Boris', soldi: 99999 }, ROMA(23, 9));
  ok(r.ok && r.spesa === costoProgetto('negozio') && r.nome === 'Dolci di Boris', 'cantiere aperto');
  ok(!giocatoreTerreno(s, 'Boris', { azione: 'costruisci', tipo: 'casa', soldi: 99999 }, ROMA(23, 9)).ok, 'una sola costruzione per lotto');
  // a cantiere aperto il negozio non c'e' ancora
  sincronizzaTerreni(s); ok(!NEGOZI.some(q => q.id === 'lotto2'), 'niente negozio finche\' il cantiere non finisce');
  // il tempo: si fa finire saltando i giorni (passoCantieri direttamente, poi il motore)
  let t = ROMA(23, 9); while (!s.terreni.lotto2.progetto.finito && t < ROMA(30, 23)) { t += 30 * 60000; passoCantieri(s, t, 1800); }
  ok(s.terreni.lotto2.progetto.finito && s.terreni.lotto2.progetto.finito > ROMA(28, 0), 'finito dopo quasi una settimana di lavoro');
  sincronizzaTerreni(s);
  const neg = NEGOZI.find(q => q.id === 'lotto2');
  ok(neg && neg.proprietario === 'g:Boris' && neg.prodotti.some(p => p[0] === 'Cannolo'), 'negozio con il suo listino');
  const v = vistaPubblica(s, t);
  ok(v.negozi.some(q => q.id === 'lotto2' && q.proprietario && q.proprietario.nome === 'Boris'), 'il gioco vede il bancone');
  ok(v.terreni.find(q => q.id === 'lotto2').progetto.fase === 'finito', 'il gioco vede il negozio finito');
  ok(!giocatoreTurno(s, 'Luca', 'lotto2', true, t).ok, 'nel negozio di Boris non lavora un altro');
  ok(giocatoreTurno(s, 'Boris', 'lotto2', true, t).ok, 'Boris lavora nel suo negozio');
  // arriva un cliente (in meno di un minuto per i giocatori) e Boris tiene l'80%
  t = await scorri(s, t, 1.5);
  giocatoreTurno(s, 'Boris', 'lotto2', true, t);
  const c = s.clienti.find(q => q.negozio === 'lotto2');
  ok(c, 'arriva un cliente');
  let venduto = null;
  for (let i = 0; i < 40 && !venduto; i++) {
    s.clienti.forEach(q => { if (q.negozio === 'lotto2') { q.servito = false; q.tentativi = 0; q.soldi = 200; q.via = t + 600000; } });
    const r2 = giocatoreVende(s, 'Boris', { prodotto: 'Torta intera', prezzo: 40, testo: 'Una torta speciale, buonissima, artigianale, regalo perfetto!' }, t);
    if (r2.compra) venduto = r2;
  }
  ok(venduto && venduto.guadagno === Math.round(40 * REGOLE_TERRENI.quotaProprietario), 'il proprietario tiene l\'80%');
}

// 4) un abitante IA: compra camminando fino al lotto, costruisce casa, si trasferisce
{
  const s = nuovoStato(ROMA(23, 9)), ada = s.agenti.ada;
  Object.values(s.agenti).forEach(a => { a.prossimoPensiero = ROMA(30, 9); });   // nessun pensiero durante la prova: solo le azioni date
  ok(SCHEMA.properties.azioni.items.properties.tipo.enum.includes('terreno') && SCHEMA.properties.azioni.items.properties.tipo.enum.includes('edifica'), 'azioni nello schema');
  ok(/"tipo":"terreno"/.test(promptDiSistema(ada)) && /"tipo":"edifica"/.test(promptDiSistema(ada)), 'le azioni sono spiegate agli agenti');
  ok(/TERRENI E CASE DEL BORGO: terreni in vendita: lotto1/.test(percezione(s, ada, ROMA(23, 9))), 'l\'agente vede i lotti in vendita');
  ok(normalizzaAzione({ tipo: 'terreno', nome: 'Lotto 1' }).lotto === 'lotto1' && normalizzaAzione({ tipo: 'edifica', nome: 'casa' }).progetto === 'casa', 'azioni normalizzate');
  ada.starlight = 200;
  ada.coda = [normalizzaAzione({ tipo: 'terreno', nome: 'lotto1' })];
  let t = await scorri(s, ROMA(23, 9), 2);
  ok(!s.terreni.lotto1 && ada.esiti.some(e => new RegExp('Costa ' + LOTTI[0].prezzo).test(e)), 'senza soldi: rifiutato (dopo esserci andata)');
  ada.starlight = 80000; ada.coda = [normalizzaAzione({ tipo: 'terreno', nome: 'lotto1' }), normalizzaAzione({ tipo: 'edifica', nome: 'casa' })];
  t = await scorri(s, t, 2);
  ok(s.terreni.lotto1 && s.terreni.lotto1.chi === 'ada', 'Ada ha comprato il lotto 1');
  ok(s.terreni.lotto1.progetto && s.terreni.lotto1.progetto.tipo === 'casa', 'e aperto il cantiere della casa');
  ok(Math.round(ada.starlight) === 80000 - LOTTI[0].prezzo - costoProgetto('casa'), 'ha pagato terreno e casa: ' + ada.starlight);
  ok(/Cantiere di "Casa di Ada"/.test(percezione(s, ada, t)), 'vede il suo cantiere');
  // non si costruiscono oggetti sopra un lotto
  ada.x = ada.tx = -10; ada.z = ada.tz = 55; ada.stanza = null;
  ada.coda = [normalizzaAzione({ tipo: 'costruisci', forma: 'cubo', x: -10, z: 60 })]; await passo(s, t + 1000, muto);
  ok(ada.esiti.some(e => /terreni in vendita/.test(e)), 'sui lotti non si costruiscono pezzi');
  s.terreni.lotto1.progetto.fatte = PROGETTI.casa.ore - 0.01;
  t = await scorri(s, ROMA(24, 10), 1);
  ok(s.terreni.lotto1.progetto.finito, 'casa finita');
  const st = STANZE.find(q => q.id === 'casa_ada'), g = geometria(LOTTI[0]);
  ok(st.porta.x === g.porta.x && st.porta.z === g.porta.z && st.lotto === 'lotto1', 'la porta di casa di Ada e\' ora quella nuova');
  ok(s.vita.case.ada.porta.x === g.porta.x, 'anche per la vita (dormire, cucinare...)');
  ok(ada.diario.some(d => /casa nuova/.test(d.s)), 'Ada lo sa');
  // va a casa: entra dalla porta nuova
  ada.coda = [normalizzaAzione({ tipo: 'entra', luogo: 'Casa di Ada' })];
  t = await scorri(s, t, 3);
  ok(ada.stanza === 'casa_ada', 'entra nella casa nuova');
  ada.coda = [{ tipo: 'esci' }]; t = await scorri(s, t, 1);
  ok(!ada.stanza && Math.abs(ada.x - g.ritorno.x) < 4 && Math.abs(ada.z - g.ritorno.z) < 4, 'esce davanti alla casa nuova');
  // stato vuoto: le porte tornano quelle delle casette del borgo
  sincronizzaTerreni(nuovoStato(t)); ok(STANZE.find(q => q.id === 'casa_ada').porta.z === 59.6, 'senza terreno la porta e\' quella della casetta');
}

// Il negozio come lo vuole il proprietario: colori, insegna, arredo e listino
{
  const s = nuovoStato(ROMA(23, 9));
  ok(giocatoreTerreno(s, 'Mara', { azione: 'compra', lotto: 'lotto1', soldi: 50000 }, ROMA(23, 9)).ok, 'compra il lotto');
  const r = giocatoreTerreno(s, 'Mara', { azione: 'costruisci', tipo: 'negozio', genere: 'bar', nome: 'Bar Mara', colore: 3, insegna: 'neon', arredo: 'elegante', prezzi: { 'Caffe\'': 9, 'Cappuccino': 999 }, soldi: 99999 }, ROMA(23, 9));
  ok(r.ok, 'apre il cantiere del bar: ' + r.motivo);
  const p = s.terreni.lotto1.progetto;
  ok(p.colore === 3 && p.insegna === 'neon' && p.arredo === 'elegante', 'colori, insegna e arredo scelti');
  ok(p.prezzi['Caffe\''] === 9 && p.prezzi['Cappuccino'] === 27, 'il prezzo esagerato si ferma al triplo del normale');
  const v = vistaTerreni(s, ROMA(23, 9)).find(l => l.id === 'lotto1').progetto;
  ok(v.insegna === 'neon' && v.arredo === 'elegante' && v.listino[0][1] === 9 && v.inizio, 'il gioco vede le scelte e il listino');
  // scelte sbagliate: si torna ai valori normali
  const s2 = nuovoStato(ROMA(23, 9)); giocatoreTerreno(s2, 'Lia', { azione: 'compra', lotto: 'lotto1', soldi: 50000 }, ROMA(23, 9));
  giocatoreTerreno(s2, 'Lia', { azione: 'costruisci', tipo: 'casa', colore: 'blu', insegna: '<script>', arredo: 'oro', soldi: 99999 }, ROMA(23, 9));
  const q = s2.terreni.lotto1.progetto; ok(q.insegna === 'legno' && q.arredo === 'rustico' && q.colore >= 0 && q.colore < 6 && !q.prezzi, 'valori strani: insegna di legno, arredo rustico');
  // finito il negozio, il listino si cambia e i clienti lo vedono
  p.fatte = p.ore; p.finito = ROMA(30, 12);
  let c = giocatoreTerreno(s, 'Mara', { azione: 'listino', prezzi: { 'Cornetto': 4 } }, ROMA(30, 13));
  ok(c.ok && c.listino.find(x => x[0] === 'Cornetto')[1] === 4 && c.listino.find(x => x[0] === 'Caffe\'')[1] === 9, 'cambia un prezzo, gli altri restano');
  ok(!giocatoreTerreno(s2, 'Lia', { azione: 'listino', prezzi: { 'Pane': 3 } }, ROMA(30, 13)).ok, 'chi ha una casa non ha un listino');
  const neg = negoziDeiLotti(s).find(n => n.id === 'lotto1'), caffe = neg.prodotti.find(x => x[0] === 'Caffe\'');
  ok(caffe[1] === 9 && caffe[3] === 6, 'al bancone si vende al prezzo del proprietario, il normale resta noto');
  // piu' caro del normale = i clienti si convincono meno
  const dante = CLIENTI.find(x => x.nome === 'Dante') || CLIENTI[0], frase = 'Ciao, caffe buonissimo, un vero affare per te!';
  ok(persuasione(dante, neg, caffe, 9, frase).p < persuasione(dante, neg, [caffe[0], 6, caffe[2], 6], 6, frase).p, 'il prezzo alto convince meno');
  ok(listinoDi('bar', { Panino: 1 }).find(x => x[0] === 'Panino')[1] === 6 && PREZZO_MAX === 3, 'non meno della meta\' del normale');
}
console.log(`terreni: ${n} controlli passati`);
