// Prove degli interni e dei mestieri (agenti/interni.mjs, agenti/lavori.mjs e il motore): si entra nei negozi,
// i banconi stanno dentro, le scorte finiscono e si rifanno lavorando, l'ambulatorio cura, le persone vere fanno turni.
//   node test/interni.test.mjs
import assert from 'node:assert/strict';
import { nuovoStato, passo, percezione, vistaPubblica, normalizzaAzione, giocatoreDipendente, giocatoreTerreno, giocatoreTurno, giocatoreVende, sincronizzaTerreni, STANZE } from '../agenti/motore.mjs';
import { INTERNI } from '../agenti/interni.mjs';
import { NEGOZI } from '../agenti/negozi.mjs';
import { scorteDi, consegnaMattino, effettoMestiere, disponibile, ambulatorioAperto, visitaMedica, passoBorgo } from '../agenti/lavori.mjs';
import { MESTIERI } from '../agenti/vita/mestieri.mjs';
import { ammala } from '../agenti/vita/corpo.mjs';
import { PROGETTI } from '../agenti/terreni.mjs';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const ROMA = (g, h, mi = 0) => Date.UTC(2026, 10, g, h - 1, mi);   // novembre 2026: Roma = UTC+1 (20 = venerdi', 22 = domenica)
const muto = async () => ({ testo: JSON.stringify({ pensiero: '', azioni: [], ricorda: '', prossimo_pensiero_minuti: 720, sforzo_prossimo: 'basso', memoria_nuova: '' }), usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: 'end_turn' });
async function scorri(s, da, minuti, passoS = 30) { let t = da; for (let i = 0; i < minuti * 60 / passoS; i++) { t += passoS * 1000; await passo(s, t, muto); } return t; }
async function nuovo(t) { const s = nuovoStato(t); await passo(s, t, muto); return s; }
const fermi = (s, t) => Object.values(s.agenti).forEach(a => { a.prossimoPensiero = t + 30 * 864e5; a.coda = []; a.tx = a.x; a.tz = a.z; });

// 1) gli interni esistono per gli agenti, con la porta in piazza
{
  for (const id of ['caffetteria', 'forno', 'fioraio', 'arredamenti', 'banca', 'ambulatorio']) ok(STANZE.some(q => q.id === id), 'stanza ' + id);
  ok(INTERNI.every(q => q.porta && q.ritorno && q.arrivo && q.uscita && q.rect), 'ogni interno ha porta, arrivo, uscita, ritorno');
  ok(normalizzaAzione({ tipo: 'entra', luogo: 'Caffetteria' }).stanza === 'caffetteria', 'la Caffetteria si trova per nome');
  ok(normalizzaAzione({ tipo: 'entra', luogo: 'Ambulatorio' }).stanza === 'ambulatorio', 'anche l\'Ambulatorio');
  ok(['forno', 'caffetteria', 'fioraio'].every(id => NEGOZI.find(q => q.id === id).stanza === id), 'i banconi stanno dentro i negozi');
}

// 2) Ada entra davvero nella Caffetteria (prima provava 9 volte senza riuscirci)
{
  const t0 = ROMA(20, 10), s = await nuovo(t0), ada = s.agenti.ada; fermi(s, t0);
  ada.x = ada.tx = 18; ada.z = ada.tz = 6; ada.stanza = null;
  ada.coda = [normalizzaAzione({ tipo: 'entra', luogo: 'Caffetteria' })];
  const t = await scorri(s, t0, 1.5);
  ok(ada.stanza === 'caffetteria', 'Ada e\' dentro ' + JSON.stringify(ada.esiti));
  ok(/IN QUESTO NEGOZIO/.test(percezione(s, ada, t)), 'dentro vede il negozio, le scorte e chi lavora');
}

// 3) lavorare al bancone: l'agente entra nel negozio, il bancone e' dentro
{
  const t0 = ROMA(20, 10), s = await nuovo(t0), ada = s.agenti.ada; fermi(s, t0);
  ada.x = ada.tx = 40; ada.z = ada.tz = 5; ada.stanza = null;
  ada.coda = [normalizzaAzione({ tipo: 'lavora', nome: 'Forno', minuti: 60 })];
  const t = await scorri(s, t0, 1.5);
  ok(s.turni.ada && s.turni.ada.negozio === 'forno' && ada.stanza === 'forno', 'Ada lavora dentro il Forno ' + JSON.stringify(ada.esiti));
  const v = vistaPubblica(s, t);
  ok(v.negozi.find(q => q.id === 'forno').stanza === 'forno' && v.negozi.find(q => q.id === 'forno').scorte, 'il gioco vede bancone e scorte nella stanza');
  ok(v.lavori && v.lavori.mestieri.pasticcere && v.lavori.mestieri.muratore, 'il gioco vede i mestieri');
}

// 4) le scorte: finiscono, il caffe' si fa solo se c'e' qualcuno, al mattino arriva la consegna
{
  const t0 = ROMA(20, 10), s = await nuovo(t0), bar = NEGOZI.find(q => q.id === 'caffetteria');
  const cornetto = bar.prodotti.find(p => p[0] === 'Cornetto'), caffe = bar.prodotti.find(p => p[0] === 'Caffe\'');
  ok(cornetto && caffe, 'listino della Caffetteria');
  s.turni = {}; s.vita.corpi && Object.values(s.vita.corpi).forEach(c => { c.lavoro = null; }); s.dipendenti = {};
  ok(disponibile(s, bar, caffe), 'senza nessuno dietro il banco niente caffe\'');
  giocatoreTurno(s, 'Boris', 'caffetteria', true, t0);
  ok(!disponibile(s, bar, caffe), 'con Boris al bancone il caffe\' si fa');
  scorteDi(s, 'caffetteria').Cornetto = 0;
  ok(/finito/.test(disponibile(s, bar, cornetto)), 'cornetti finiti');
  s.consegna = null; scorteDi(s, 'caffetteria').Cornetto = 7;
  ok(consegnaMattino(s, ROMA(21, 6, 5)) && scorteDi(s, 'caffetteria').Cornetto === 4, 'al mattino i cornetti vecchi vanno via e arriva la consegna');
  ok(!consegnaMattino(s, ROMA(21, 9)), 'una consegna al giorno');
}

// 5) i mestieri producono davvero
{
  const t0 = ROMA(20, 10), s = await nuovo(t0);
  const pane = scorteDi(s, 'forno').Pane || 0;
  ok(/Pane/.test(effettoMestiere(s, 'fornaio', 1, t0)) && scorteDi(s, 'forno').Pane === pane + 16, 'un\'ora di fornaio = 16 pani sugli scaffali');
  const corn = scorteDi(s, 'caffetteria').Cornetto || 0;
  effettoMestiere(s, 'pasticcere', 0.5, t0);
  ok(scorteDi(s, 'caffetteria').Cornetto === corn + 5, 'mezz\'ora di pasticcere = 5 cornetti');
  s.borgo = { sporcizia: 80 };
  ok(/sporcizia da 80 a 20/.test(effettoMestiere(s, 'spazzino', 2, t0)) && s.borgo.sporcizia === 20, 'lo spazzino pulisce');
  passoBorgo(s, ROMA(20, 12), 3600);
  ok(Math.abs(s.borgo.sporcizia - 22.2) < 0.01, 'di giorno la piazza si risporca');
  if (s.vita.aiuole && s.vita.aiuole.length) { s.vita.aiuole.forEach(a => { a.acqua = 5; a.morta = false; }); ok(/annaffiato/.test(effettoMestiere(s, 'giardiniere', 1, t0)) && s.vita.aiuole.some(a => a.acqua === 60), 'il giardiniere annaffia'); }
  if (s.vita.mercato) { const k = Object.keys(s.vita.mercato.scorte)[0]; s.vita.mercato.scorte[k] = 0; ok(/Dispensa/.test(effettoMestiere(s, 'facchino', 2, t0)), 'il facchino riempie la dispensa'); }
}

// 6) il muratore lavora nel cantiere aperto e lo fa finire
{
  const t0 = ROMA(23, 9), s = await nuovo(t0);
  ok(!giocatoreDipendente(s, 'Luca', { mestiere: 'muratore' }, t0).ok, 'senza cantieri niente muratore');
  ok(giocatoreTerreno(s, 'Boris', { azione: 'compra', lotto: 'lotto2', soldi: 50000 }, t0).ok, 'Boris compra');
  ok(giocatoreTerreno(s, 'Boris', { azione: 'costruisci', tipo: 'negozio', genere: 'dolci', nome: 'Dolci di Boris', soldi: 99999 }, t0).ok, 'e costruisce');
  passoBorgo(s, t0, 30);
  ok(MESTIERI.muratore.lotto === 'lotto2', 'il muratore sa dov\'e\' il cantiere');
  const prima = s.terreni.lotto2.progetto.fatte;
  ok(/cantiere/.test(effettoMestiere(s, 'muratore', 3, t0, { lotto: 'lotto2' })) && s.terreni.lotto2.progetto.fatte >= prima + 3 - 1e-9, 'tre ore di muratore nel cantiere');
  s.terreni.lotto2.progetto.fatte = PROGETTI.negozio.ore - 0.5;
  effettoMestiere(s, 'muratore', 1, t0, { lotto: 'lotto2' });
  ok(s.terreni.lotto2.progetto.finito, 'il muratore finisce il cantiere');
  // 7) il negozio finito ha il suo interno, con il bancone dentro
  sincronizzaTerreni(s);
  const neg = NEGOZI.find(q => q.id === 'lotto2');
  ok(neg && neg.stanza === 'bottega_lotto2', 'il negozio sul lotto ha la sua stanza');
  ok(STANZE.some(q => q.id === 'bottega_lotto2' && q.porta), 'e una porta in piazza');
  const v = vistaPubblica(s, t0).negozi.find(q => q.id === 'lotto2');
  ok(v && v.stanza === 'bottega_lotto2' && v.interno, 'il gioco sa come costruire l\'interno');
  passoBorgo(s, t0 + 60000, 30);
  ok(MESTIERI.muratore.lotto === null, 'niente piu\' cantieri aperti');
}

// 8) l'Ambulatorio: orari, visita che cura, ticket
{
  ok(!ambulatorioAperto(ROMA(20, 13, 30)) && ambulatorioAperto(ROMA(20, 15, 30)) && !ambulatorioAperto(ROMA(22, 10)), 'aperto 8-13 e 15-19, chiuso la domenica');
  const t0 = ROMA(20, 15, 30), s = await nuovo(t0), c = s.vita.corpi.ada;
  ammala(c, 'parassiti', t0);
  const fino = c.malattie[0].fino;
  ok(/curato/.test(visitaMedica(s, 'ada', t0)) && c.malattie[0].fino < fino, 'la visita accorcia la malattia');
  const ada = s.agenti.ada; fermi(s, t0);
  ada.stanza = null; ada.x = ada.tx = 31; ada.z = ada.tz = 2; ada.starlight = 100;
  ada.coda = [normalizzaAzione({ tipo: 'usa', nome: 'Visita medica' })];
  const t = await scorri(s, t0, 60);
  ok(ada.stanza === 'ambulatorio' || ada.esiti.some(e => /Dottoressa/.test(e)), 'Ada va dalla dottoressa ' + JSON.stringify(ada.esiti.slice(-3)));
  ok(ada.starlight === 80, 'paga il ticket di 20 ' + ada.starlight);
  ok(t > t0, 'tempo passato');
}

// 9) una persona vera fa il turno da fornaio: un posto, la paga, il pane
{
  const t0 = ROMA(20, 7), s = await nuovo(t0);
  Object.values(s.vita.corpi).forEach(c => { c.lavoro = null; });
  ok(!giocatoreDipendente(s, 'Boris', { mestiere: 'fornaio' }, ROMA(20, 15)).ok, 'fuori orario no');
  const r = giocatoreDipendente(s, 'Boris', { mestiere: 'fornaio' }, t0);
  ok(r.ok && s.dipendenti['g:Boris'], 'Boris inizia il turno da fornaio');
  ok(!giocatoreDipendente(s, 'Luca', { mestiere: 'fornaio' }, t0).ok, 'un solo posto da fornaio');
  ok(vistaPubblica(s, t0).lavori.mestieri.fornaio.occupati === 1, 'il gioco vede il posto occupato');
  const pane = scorteDi(s, 'forno').Pane || 0;
  giocatoreDipendente(s, 'Boris', { mestiere: 'fornaio' }, t0 + 10 * 60000);
  const f = giocatoreDipendente(s, 'Boris', { mestiere: 'fornaio', fine: true }, t0 + 20 * 60000);
  ok(f.ok && f.paga === 80 && f.minuti === 20, 'paga di 20 minuti ' + JSON.stringify(f));
  ok(scorteDi(s, 'forno').Pane > pane, 'il pane fatto da Boris e\' sugli scaffali');
  ok(!s.dipendenti['g:Boris'], 'turno chiuso');
  giocatoreDipendente(s, 'Boris', { mestiere: 'spazzino' }, ROMA(20, 9));
  await passo(s, ROMA(20, 9, 10), muto);
  ok(!s.dipendenti['g:Boris'], 'senza conferme il turno finisce da solo');
}

// 10) la banca: le operazioni si fanno dentro, allo sportello
{
  ok(STANZE.find(q => q.id === 'banca').porta.z > 40, 'la porta della banca e\' in piazza');
  const t0 = ROMA(20, 10), s = await nuovo(t0), ada = s.agenti.ada; fermi(s, t0);
  ada.stanza = null; ada.x = ada.tx = 30; ada.z = ada.tz = 38;
  ada.coda = [normalizzaAzione({ tipo: 'usa', nome: 'Sportello della banca' })];
  await scorri(s, t0, 2);
  ok(ada.stanza === 'banca', 'Ada entra in banca ' + JSON.stringify(ada.esiti.slice(-2)));
}

console.log(`interni e mestieri: ${n} controlli passati`);
