// Controllo di tutte le azioni di Ada e Teo: ognuna deve riuscire quando si puo', e quando non si puo'
// deve dire un motivo chiaro che il freno dei tentativi a vuoto riconosce come fallimento.
// Nato dal 22/11/2026: Teo ha provato 114 volte a dare la cioccolata ad Ada (il gioco non poteva farlo).
//   node test/azioni.test.mjs
import assert from 'node:assert/strict';
import { nuovoStato, passo, esitoFallito, firmaAzione, FRENO } from '../agenti/motore.mjs';

const T0 = Date.UTC(2026, 10, 22, 9, 0, 0);
let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const pensiero = azioni => ({ pensiero: 'prova', azioni, ricorda: '', prossimo_pensiero_minuti: 120, sforzo_prossimo: 'basso', memoria_nuova: '' });

// Teo pensa una volta sola (le azioni date), Ada sta ferma accanto a lui se vicina=true
async function prova(azioni, { prepara, vicina = false, passi = 20 } = {}) {
  const s = nuovoStato(T0), t = s.agenti.teo, a = s.agenti.ada;
  t.stanza = a.stanza = null;
  for (const g of [t, a]) { g.tx = g.x; g.tz = g.z; g.prossimaGita = g.prossimaEsplorazione = g.abitudineDopo = T0 + 864e5; }   // niente passeggiate: si guarda solo l'azione
  const ax = t.x + 1, az = t.z;
  if (prepara) prepara(s, t, a);
  let primo = true;
  const cervello = async q => ({ testo: JSON.stringify(q.agente === 'teo' && !q.mossa && primo ? (primo = false, pensiero(azioni)) : pensiero([])), usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: 'end_turn' });
  const esiti = []; let tt = T0;
  for (let i = 0; i < passi; i++) {
    tt += 30000;
    if (vicina) { a.x = a.tx = ax; a.z = a.tz = az; a.stanza = null; a.coda = []; }
    await passo(s, tt, cervello);
    for (const e of t.esiti) if (!esiti.includes(e)) esiti.push(e);
  }
  const di = tipo => esiti.filter(e => e.toLowerCase().startsWith(tipo.toLowerCase()) || e.startsWith('rifiutata: ' + tipo));
  return { s, t, a, esiti, di, tt };
}
const riuscita = (r, tipo, cosa) => { const e = r.di(tipo); ok(e.length && !e.some(esitoFallito), `${tipo} riesce: ${JSON.stringify(e)}`); if (cosa) ok(e.some(x => cosa.test(x)), `${tipo}: ${cosa} in ${JSON.stringify(e)}`); };
const rifiutata = (r, tipo, motivo) => { const e = r.di(tipo); ok(e.length && e.every(esitoFallito), `${tipo} rifiutata e riconosciuta come fallita: ${JSON.stringify(e)}`); ok(e.some(x => motivo.test(x)), `${tipo}: motivo chiaro ${motivo} in ${JSON.stringify(e)}`); };

// ---- DAI ----
{ const r = await prova([{ tipo: 'dai', nome: 'Pane', id: 'ada' }], { vicina: true, prepara: (s, t) => { t.zaino = { Pane: 1 }; } });
  riuscita(r, 'dai', /ora ce l'ha Ada/); ok(r.a.zaino.Pane === 1 && !r.t.zaino.Pane, 'il pane del Forno passa ad Ada'); }
{ const r = await prova([{ tipo: 'dai', nome: 'Rosa', id: 'Ada' }], { vicina: true, prepara: (s, t) => { t.zaino = { Rosa: 2 }; } });
  ok(r.a.zaino.Rosa === 1 && r.t.zaino.Rosa === 1, 'anche un fiore si regala (id con la maiuscola)'); }
{ const r = await prova([{ tipo: 'dai', nome: 'Cornetto', id: 'luca' }], { prepara: (s, t) => { t.zaino = { Cornetto: 1 }; } });
  rifiutata(r, 'dai', /a chi\?/); ok(r.t.zaino.Cornetto === 1, 'resta a Teo'); }
{ const r = await prova([{ tipo: 'dai', nome: 'Cornetto', id: 'ada' }], { vicina: true, prepara: (s, t, a) => { t.zaino = { Cornetto: 1 }; } , passi: 3 });
  ok(r.a.zaino && r.a.zaino.Cornetto === 1, 'dato a chi e\' vicino'); }

// ---- MANGIA / BEVI le cose comprate ----
{ const r = await prova([{ tipo: 'mangia', nome: 'Cornetto' }], { prepara: (s, t) => { t.zaino = { Cornetto: 1 }; } });
  riuscita(r, 'mangia', /mangiato: Cornetto/); ok(!r.t.zaino.Cornetto, 'il cornetto non c\'e\' piu\''); }
{ let prima; const r = await prova([{ tipo: 'bevi', nome: 'Cioccolata calda' }], { prepara: (s, t) => { t.zaino = { 'Cioccolata calda': 2 }; } });
  riuscita(r, 'bevi', /bevuto: Cioccolata calda/); ok(r.t.zaino['Cioccolata calda'] === 1, 'ne resta una'); ok(r.s.vita.corpi.teo.bevutoOggi > 0, 'il corpo l\'ha bevuta'); }
{ const r = await prova([{ tipo: 'mangia', nome: "caffe'" }], { prepara: (s, t) => { t.zaino = { "Caffe'": 1 }; } });
  riuscita(r, 'mangia', /bevuto/); ok(!r.t.zaino["Caffe'"], 'una bevanda chiesta con "mangia" si beve lo stesso'); }
{ const r = await prova([{ tipo: 'mangia', nome: 'Rosa' }], { prepara: (s, t) => { t.zaino = { Rosa: 1 }; } });
  rifiutata(r, 'mangia', /Rosa non si mangia/); ok(r.t.zaino.Rosa === 1, 'la rosa resta'); }
{ const r = await prova([{ tipo: 'bevi', nome: 'Cornetto' }], { prepara: (s, t) => { t.zaino = { Cornetto: 1 }; } });
  rifiutata(r, 'bevi', /non si beve/); }
{ const r = await prova([{ tipo: 'mangia', nome: 'Torta intera' }, { tipo: 'mangia', nome: 'Torta intera' }], { prepara: (s, t) => { t.zaino = { 'Torta intera': 2 }; } });
  riuscita(r, 'mangia', /una parte/); ok(r.t.zaino['Torta intera'] === 1 && r.t.avanzi['Torta intera'] > 0, 'una torta intera non si mangia tutta: il resto resta'); }
{ const r = await prova([{ tipo: 'mangia', nome: 'pane', x: 0.2 }]);
  rifiutata(r, 'mangia', /non hai pane/); }

// ---- le altre azioni del corpo con una cosa comprata: motivo chiaro, non "cosa lasci?" ----
for (const tipo of ['lascia', 'vendi_al_mercatino', 'butta']) {
  const r = await prova([{ tipo, nome: 'Cornetto' }], { prepara: (s, t) => { t.zaino = { Cornetto: 1 }; } });
  rifiutata(r, tipo, /si mangiano o si bevono/); ok(r.t.zaino.Cornetto === 1, tipo + ': il cornetto resta');
}

// ---- COMPRA (Mercatino) e USA (banconi, mobili, minigiochi) ----
{ const r = await prova([{ tipo: 'compra', nome: 'Cornetto' }]); rifiutata(r, 'compra', /non vendono Cornetto. Vendono:/); }
{ const r = await prova([{ tipo: 'usa', nome: 'Caffetteria', testo: 'Cornetto' }]); riuscita(r, 'usa', /Hai comprato Cornetto/); ok(r.t.zaino.Cornetto === 1, 'comprato al bancone'); }
{ const r = await prova([{ tipo: 'usa', nome: 'o1' }]); rifiutata(r, 'usa', /non c'e'/); }
{ const r = await prova([{ tipo: 'usa', nome: 'Scacchi' }], { passi: 40 }); ok(r.t.diario.some(d => /Scacchi contro .*: hai (vinto|perso)|Scacchi contro .*patta/.test(d.s)), 'una partita a Scacchi finisce con un risultato: ' + r.t.diario.slice(-2).map(d => d.s).join(' | ')); }
{ const r = await prova([{ tipo: 'metti', nome: 'Rosa' }], { prepara: (s, t) => { t.zaino = { Rosa: 1 }; } }); ok(r.esiti.some(e => /metti: cosa sconosciuta/.test(e) && esitoFallito(e)), 'metti una rosa: motivo chiaro'); }

// ---- LAVORO ----
{ const r = await prova([{ tipo: 'lavora', nome: 'Caffetteria', minuti: 30 }]); riuscita(r, 'lavora', /sei al bancone/); }
{ const r = await prova([{ tipo: 'turno', nome: 'barista', x: 1 }]); riuscita(r, 'turno', /iniziato/); }

// ---- TERRENI E BANCA (Teo ha 150 Starlight: troppo pochi) ----
{ const r = await prova([{ tipo: 'terreno', nome: 'lotto1' }]); rifiutata(r.di ? { di: t => r.di(t).filter(e => !/in cammino/.test(e)) } : r, 'terreno', /Costa .* Starlight/); }
{ const r = await prova([{ tipo: 'edifica', nome: 'casa' }]); rifiutata(r, 'edifica', /prima devi comprare un terreno/); }
{ const r = await prova([{ tipo: 'appartamento', nome: 'piano 3' }]); rifiutata({ di: t => r.di(t).filter(e => !/in cammino/.test(e)) }, 'appartamento', /Costa/); }
{ const r = await prova([{ tipo: 'mutuo', nome: 'piano 3', prezzo: 50 }]); rifiutata({ di: t => r.di(t).filter(e => !/in cammino/.test(e)) }, 'mutuo', /anticipo/); }
{ const r = await prova([{ tipo: 'prestito', prezzo: 50 }]); rifiutata({ di: t => r.di(t).filter(e => !/in cammino/.test(e)) }, 'prestito', /da 200 a 5000/); }
{ const r = await prova([{ tipo: 'rimborsa', prezzo: 10 }]); rifiutata({ di: t => r.di(t).filter(e => !/in cammino/.test(e)) }, 'rimborsa', /Non hai debiti/); }

// ---- COSTRUIRE, PARLARE, GESTI, CORPO ----
{ const r = await prova([{ tipo: 'costruisci', nome: 'Panca', forma: 'cubo', x: 9, z: 37 }]); riuscita(r, 'costruisci', /iniziato|finito/); }
{ const r = await prova([{ tipo: 'rimuovi', id: 'o999' }]); rifiutata(r, 'rimuovi', /non esiste/); }
{ const r = await prova([{ tipo: 'scrivi', nome: 'Ada', testo: 'ciao' }]); riuscita(r, 'scrivi', /consegnato/); }
{ const r = await prova([{ tipo: 'gesto', testo: 'saluta' }]); riuscita(r, 'gesto', /fatto/); }
{ const r = await prova([{ tipo: 'chiacchiera', id: 'ada' }], { vicina: true }); riuscita(r, 'chiacchiera', /iniziato/); }
{ const r = await prova([{ tipo: 'svago', luogo: 'Biblioteca' }]); riuscita(r, 'svago', /iniziato/); }
{ const r = await prova([{ tipo: 'entra', luogo: 'Caffetteria' }]); riuscita(r, 'entra', /sei dentro/); }
{ const r = await prova([{ tipo: 'entra', luogo: 'Castello' }]); ok(r.esiti.some(e => /edificio sconosciuto/.test(e) && esitoFallito(e)), 'entra in un posto che non c\'e\': motivo chiaro'); }

// ---- IL FRENO: 3 fallimenti di fila uguali -> bloccata per un'ora ----
{ const az = { tipo: 'lascia', nome: 'Cornetto' };
  const r = await prova([az, az, az, az], { prepara: (s, t) => { t.zaino = { Cornetto: 1 }; } });
  ok(r.esiti.some(e => /fallita 3 volte di fila/.test(e)), 'alla terza volta arriva l\'avviso');
  ok(r.esiti.some(e => /bloccata fino alle/.test(e)), 'la quarta non viene nemmeno provata');
  ok(r.t.diario.some(d => /Smetto di riprovarla/.test(d.s)), 'resta scritto nel diario (lo rilegge nei pensieri dopo)');
  const f = r.t.falliti[firmaAzione({ tipo: 'lascia', nome: 'Cornetto' })];
  ok(f && f.fino - r.tt <= FRENO.bloccoMin * 60000 && f.fino > r.tt, 'il blocco dura al massimo un\'ora'); }
{ const g = { tipo: 'gesto', testo: 'saluta' };
  const r = await prova([g, g, g, g]); ok(!r.esiti.some(e => /bloccata/.test(e)), 'le azioni che riescono non si bloccano mai'); }
{ const az = { tipo: 'dai', nome: 'Cornetto', id: 'luca' };
  const r = await prova([az, az, { tipo: 'dai', nome: 'Cornetto', id: 'ada' }], { vicina: true, prepara: (s, t) => { t.zaino = { Cornetto: 1 }; } });
  ok(r.a.zaino && r.a.zaino.Cornetto === 1, 'un\'azione diversa (altra persona) non e\' bloccata');
  ok(!r.esiti.some(e => /bloccata/.test(e)), 'due fallimenti non bastano per il blocco'); }
{ const az = { tipo: 'entra', luogo: 'Castello' };
  const r = await prova([az, az, az, az]); ok(r.esiti.some(e => /fallita 3 volte di fila/.test(e)), 'anche un\'azione scritta male si blocca dopo 3 volte'); }

// ---- il riconoscimento dei fallimenti ----
for (const s of ['rifiutata: x', 'dai: cosa dai?', "chiacchiera: ada e' troppo lontano per chiacchierare", 'mangia: non hai pane con te (prendilo prima)', 'mangia: sei troppo pieno per mangiare', "usa Caffetteria: e' chiusa"])
  ok(esitoFallito(s), 'fallito: ' + s);
for (const s of ['dai Pane: fatto, ora ce l\'ha Ada', 'mangia: mangiato: Cornetto', 'usa Caffetteria: finito. Hai comprato Cornetto', 'svago: svago: iniziato', 'lavora Caffetteria: sei al bancone fino alle 10:32'])
  ok(!esitoFallito(s), 'riuscito: ' + s);

console.log(`azioni: ${n} controlli passati`);
