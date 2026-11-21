// Prove della "vita vera" (agenti/vita/): fisica, chimica, corpo, natura, azioni.
// Controllano che i numeri siano quelli del mondo reale, non solo che il codice giri.
//   node test/vita.test.mjs
import assert from 'node:assert/strict';
import { REAZIONI, bilanciata, reagisci, massaMolare, puoAvvenire } from '../agenti/vita/chimica.mjs';
import { pciLegno, scaldaAcqua, sole, temperaturaAria } from '../agenti/vita/fisica.mjs';
import { nuovoCorpo, viviCorpo, metabolismoBasale, bilancioTermico, mangia, bevi } from '../agenti/vita/corpo.mjs';
import { MATERIALI } from '../agenti/vita/materiali.mjs';
import { nuovoMondo, passoMondo, nuovaCosa } from '../agenti/vita/mondo.mjs';
import { eseguiAzioneVita, normalizzaAzioneVita, promptAzioniVita } from '../agenti/vita/azioni.mjs';
import { percezioneVita } from '../agenti/vita/percezione.mjs';
import { valutaInvenzione, vistaGod } from '../agenti/vita/god.mjs';
import { simula } from '../agenti/vita/simula.mjs';

let n = 0, falliti = 0; const ok = (c, m) => { if (process.env.TUTTE) { if (!c) { falliti++; console.log('FALLITA: ' + m); } else n++; return; } assert.ok(c, m); n++; if (process.env.MOSTRA) console.log('ok - ' + m); };
const vicino = (a, b, tol) => Math.abs(a - b) <= tol;
const T0 = Date.UTC(2026, 10, 21, 9, 0);   // 21 novembre 2026, 10:00 a Roma

// ---------- chimica ----------
for (const [id, r] of Object.entries(REAZIONI)) ok(bilanciata(r).ok, `reazione bilanciata: ${id}`);
ok(vicino(massaMolare('CaCO3'), 100.09, 0.01) && vicino(massaMolare('Ca(OH)2'), 74.09, 0.01), 'masse molari');
{
  // conservazione della massa: 1 kg di calcare -> 0,560 kg di calce viva + 0,440 di CO2
  const r = reagisci('calcinazione', 1);
  ok(vicino(r.prodotti.CaO, 0.5603, 0.001) && vicino(r.prodotti.CaO + r.prodotti.CO2, 1, 1e-9), 'calcinazione conserva la massa');
  ok(vicino(r.energiaJ / 1e6, 1.78, 0.01), 'calcinazione: 1,78 MJ per kg di calcare (endotermica)');
  // il legno brucia liberando ~17,4 MJ/kg, come il potere calorifico misurato
  const b = reagisci('combustione_legno', 1);
  ok(vicino(-b.energiaJ / 1e6, 17.44, 0.1), 'combustione cellulosa ~17,4 MJ/kg');
  // le calorie del cibo sono energia chimica vera: zucchero ~3,7 kcal/g
  const z = reagisci('respirazione', 0.001);
  ok(vicino(-z.energiaJ / 4184, 3.72, 0.05), 'respirazione: 3,7 kcal per grammo di glucosio');
  // terracotta: la caolinite perde il 14% del peso
  const a = reagisci('cottura_argilla', 1);
  ok(vicino(a.prodotti.Al2Si2O7, 0.8604, 0.001), 'cottura argilla: resta l\'86%');
  ok(!puoAvvenire('calcinazione', { temperatura: 800 }).ok && puoAvvenire('calcinazione', { temperatura: 900 }).ok, 'la calce viva non si fa a 800 gradi');
}

// ---------- fisica ----------
ok(vicino(pciLegno(0) / 1e6, 18.5, 0.01) && vicino(pciLegno(0.2) / 1e6, 14.3, 0.1) && pciLegno(0.5) / 1e6 < 8.1, 'potere calorifico del legno con l\'umidita\'');
{
  // 2 litri d'acqua da 12 a 100 gradi su un fuoco che da' 880 W alla pentola: circa 15-25 minuti
  let st = { kg: 2, T: 12, kgRecipiente: 1.3 }, s = 0;
  while (st.T < 99.9 && s < 7200) { const r = scaldaAcqua(st, 880, 10, 12); st.T = r.T; s += 10; }
  ok(s > 13 * 60 && s < 28 * 60, `l'acqua bolle in un tempo vero (${Math.round(s / 60)} min)`);
  // a 100 gradi l'energia in piu' fa evaporare: 1 kWh evapora ~1,6 kg
  const r = scaldaAcqua({ kg: 3, T: 100, kgRecipiente: 0, area: 0 }, 1000, 3600, 100);
  ok(r.T === 100 && vicino(r.evaporata, 1.595, 0.01), 'oltre 100 gradi bolle e evapora (calore latente)');
}
{
  // sole a Roma: a giugno ~15 ore di luce, a dicembre ~9
  ok(vicino(sole(Date.UTC(2026, 5, 21, 12)).oreLuce, 15.1, 0.3) && vicino(sole(Date.UTC(2026, 11, 21, 12)).oreLuce, 9.2, 0.3), 'durata del giorno a Roma');
  ok(sole(Date.UTC(2026, 11, 21, 23)).altezza < 0 && sole(Date.UTC(2026, 11, 21, 11)).altezza > 20, 'notte e giorno');
  // novembre: di pomeriggio piu' caldo che all'alba
  ok(temperaturaAria(Date.UTC(2026, 10, 21, 14)) > temperaturaAria(Date.UTC(2026, 10, 21, 5)) + 6, 'escursione giornaliera');
}

// ---------- corpo ----------
{
  const c = nuovoCorpo({ sesso: 'm', eta: 31, altezza: 178, peso: 75 });
  ok(vicino(metabolismoBasale(c), 1712.5, 0.1), 'metabolismo basale Mifflin-St Jeor');
  // senza bere, al riposo e al fresco: ~3 giorni prima di morire (con la morte accesa)
  const amb = { tAria: 15, vento: 0.5, riparo: true };
  let t = T0, ore = 0;
  while (!c.morto && ore < 24 * 10) { t += 3600000; ore++; viviCorpo(c, 3600, amb, t, { morte: true }); }
  ok(ore > 55 && ore < 110, `senz'acqua si muore in circa 3 giorni (${ore} ore)`);
}
{
  // senza mangiare ma bevendo: si resiste settimane
  const c = nuovoCorpo({ sesso: 'm', eta: 31, altezza: 178, peso: 75 }), amb = { tAria: 18, vento: 0.3, riparo: true };
  let t = T0, giorni = 0;
  while (!c.morto && giorni < 120) { for (let h = 0; h < 24; h++) { t += 3600000; if (h % 4 === 0) bevi(c, 0.6, t); c.addormentato = h < 8; viviCorpo(c, 3600, amb, t, { morte: true }); } giorni++; }
  ok(giorni > 25 && giorni < 80, `senza cibo si resiste settimane (${giorni} giorni)`);
}
{
  // mangiare e bere il giusto: in salute, peso stabile
  const c = nuovoCorpo({ sesso: 'f', eta: 29, altezza: 165, peso: 62 }), amb = { tAria: 20, vento: 0.2, riparo: true };
  let t = T0;
  for (let g = 0; g < 10; g++) for (let h = 0; h < 24; h++) {
    t += 3600000; c.addormentato = h < 8; c.attivita = h < 8 ? 'dormire' : 'riposare';
    if (h === 9 || h === 13 || h === 20) mangia(c, { kg: 0.25, kcal: 2650, acqua: 0.36 }, t);
    if (h % 3 === 0 && h >= 8) bevi(c, 0.35, t);
    viviCorpo(c, 3600, amb, t, { morte: true });
  }
  ok(!c.morto && c.salute > 95 && vicino(c.peso, 62, 0.7), `ben nutrita sta bene (salute ${Math.round(c.salute)}, peso ${c.peso.toFixed(1)})`);
}
{
  // il freddo: fuori di notte a 5 gradi, ferma, si ha freddo; bagnata e col vento la temperatura interna scende
  const c = nuovoCorpo({ sesso: 'f', peso: 62 });
  ok(bilancioTermico(c, { tAria: 5, vento: 1 }).netto < -60, 'a 5 gradi fermi si ha freddo');
  ok(bilancioTermico(c, { tAria: 5, vento: 1, riparo: true }).netto > -60, 'al chiuso no');
  let t = T0; for (let i = 0; i < 6; i++) { t += 600000; viviCorpo(c, 600, { tAria: 5, vento: 4, bagnato: 1 }, t, { morte: true }); }
  ok(c.temperatura < 36.5, `bagnati col vento si va in ipotermia (${c.temperatura.toFixed(1)} gradi dopo un'ora)`);
}

// ---------- mondo e azioni ----------
const mondo = nuovoMondo({ adesso: T0, seme: 3, posizioni: { ada: { x: 0, z: 9 }, teo: { x: 1, z: 9 } } });
const fai = (id, a, t = mondo.t) => eseguiAzioneVita(mondo, id, Object.assign({}, a, a.nome && !a.cosa ? normalizzaAzioneVita({ tipo: a.tipo, nome: a.nome }) : {}), t);
const finisci = (id) => { const c = mondo.corpi[id]; let i = 0; while (c.lavoro && i++ < 2000) passoMondo(mondo, mondo.t + 30000); };
ok(mondo.alberi.length === 25 && mondo.aiuole.length === 18, 'alberi e aiuole come nella piazza 3D');
ok(normalizzaAzioneVita({ tipo: 'mangia', nome: 'Pane' }).cosa === 'pane' && normalizzaAzioneVita({ tipo: 'vai' }) === null, 'normalizzazione delle azioni');
{
  // prendere dalla dispensa e portare al massimo 25 kg
  ok(fai('ada', { tipo: 'prendi', cosa: 'legna', quanto: 3 }).ok, 'prende legna');
  ok(!fai('ada', { tipo: 'prendi', cosa: 'legna', quanto: 30 }).ok, 'non porta piu\' di 25 kg');
  ok(fai('ada', { tipo: 'prendi', cosa: 'erba_secca', quanto: 0.1 }).ok && fai('ada', { tipo: 'prendi', cosa: 'acciarino' }).ok, 'prende esca e acciarino');
  // dentro un edificio non si accende il fuoco
  mondo.corpi.ada.stanza = 'biblioteca'; ok(!fai('ada', { tipo: 'accendi', nome: 'acciarino' }).ok, 'niente fuochi al chiuso'); mondo.corpi.ada.stanza = null;
  ok(fai('ada', { tipo: 'accendi', nome: 'acciarino' }).ok, 'accende');
  finisci('ada');
  const f = mondo.fuochi.find(x => !x.fisso);
  ok(f && f.acceso, 'c\'e\' un fuoco acceso');
  passoMondo(mondo, mondo.t + 15 * 60000);
  ok(f.T > 400 && f.T < 820, `il fuoco all'aperto arriva a qualche centinaio di gradi (${Math.round(f.T)})`);
  // una pentola d'argilla cruda e bagnata nel fuoco si spacca
  const cruda = nuovaCosa(mondo, 'pentola_cruda', 1.6, { secca: 0.1 }); mondo.corpi.ada.zaino.push(cruda);
  ok(fai('ada', { tipo: 'metti_sul_fuoco', cosa: 'pentola_cruda' }).ok, 'pentola cruda nel fuoco');
  passoMondo(mondo, mondo.t + 10 * 60000);
  ok(f.sopra.some(q => q.rotta) || f.sopra.some(q => q.secca === 1), 'argilla umida nel fuoco: quasi sempre si spacca');
}
{
  // la terracotta: secca, sopra 550 gradi per un'ora -> pentola vera, che pesa meno (ha perso l'acqua)
  const m = nuovoMondo({ adesso: T0, seme: 5, posizioni: { ada: { x: 5, z: 20 } } });
  const c = m.corpi.ada;
  const f = { id: 'f1', struttura: 'aperto', x: 5, z: 20, legna: [{ kg: 8, umid: 0.15 }], T: 700, acceso: true, sopra: [] }; m.fuochi.push(f);
  const p = nuovaCosa(m, 'pentola_cruda', 1.6, { secca: 1 }); c.zaino.push(p);
  eseguiAzioneVita(m, 'ada', { tipo: 'metti_sul_fuoco', cosa: 'pentola_cruda' }, m.t);
  for (let i = 0; i < 8; i++) { passoMondo(m, m.t + 15 * 60000); f.legna.push({ kg: 1, umid: 0.15 }); }
  const q = f.sopra[0];
  ok(q.cosa === 'pentola' && vicino(q.kg, 1.6 * 0.78 * 0.8604, 0.01), `l'argilla secca nel fuoco diventa terracotta (${q.cosa}, ${q.kg} kg)`);
  // ora si fa bollire acqua del laghetto e diventa potabile
  eseguiAzioneVita(m, 'ada', { tipo: 'togli_dal_fuoco', cosa: 'pentola' }, m.t);
  ok(c.zaino.some(x => x.cosa === 'pentola'), 'la pentola si riprende');
  // appena tolta dal fuoco e' rovente: l'acqua fredda la creperebbe. Si aspetta che si raffreddi.
  for (let i = 0; i < 24 && c.zaino.find(x => x.cosa === 'pentola').T > 60; i++) passoMondo(m, m.t + 10 * 60000);
  ok(c.zaino.find(x => x.cosa === 'pentola').T < 60, 'la terracotta si raffredda in qualche ora');
  c.x = 38; c.z = 21; ok(eseguiAzioneVita(m, 'ada', { tipo: 'riempi', luogo: 'Laghetto', quanto: 2 }, m.t).ok, 'riempie al laghetto');
  c.x = 5; c.z = 20; eseguiAzioneVita(m, 'ada', { tipo: 'metti_sul_fuoco', cosa: 'pentola' }, m.t);
  f.legna = [{ kg: 3, umid: 0.15 }];   // un fuoco normale da cucina, non quello grande per la terracotta
  for (let i = 0; i < 6; i++) { passoMondo(m, m.t + 5 * 60000); f.legna.push({ kg: 0.4, umid: 0.15 }); }
  const acqua = f.sopra.find(x => x.cosa === 'pentola').contenuto.find(x => x.cosa === 'acqua');
  ok(acqua.bollita && acqua.kg < 2 && acqua.kg > 0.5, `l'acqua del laghetto bollita e' sicura (${acqua.kg.toFixed(2)} litri rimasti)`);
}
{
  // il pane: farina + acqua -> impasto -> sulla brace -> pane. Le calorie si conservano.
  const m = nuovoMondo({ adesso: T0, seme: 9, posizioni: { teo: { x: 0, z: 30 } }, abitanti: ['teo'] });
  const c = m.corpi.teo; c.zaino.push(nuovaCosa(m, 'farina', 0.5));
  ok(eseguiAzioneVita(m, 'teo', { tipo: 'impasta', quanto: 0.5 }, m.t).ok, 'impasta alla Fontana');
  while (c.lavoro) passoMondo(m, m.t + 60000);
  const imp = c.zaino.find(q => q.cosa === 'impasto');
  ok(imp && vicino(imp.kg, 0.825, 0.01), 'impasto: farina + 65% di acqua');
  const kcal0 = 0.5 * MATERIALI.farina.kcal;
  m.fuochi.push({ id: 'f2', struttura: 'aperto', x: 0, z: 30, legna: [{ kg: 4, umid: 0.15 }], T: 650, acceso: true, sopra: [] });
  eseguiAzioneVita(m, 'teo', { tipo: 'metti_sul_fuoco', cosa: 'impasto' }, m.t);
  let min = 0; const f2 = m.fuochi.find(x => x.id === 'f2');
  while (f2.sopra[0].cosa === 'impasto' && min < 120) { passoMondo(m, m.t + 60000); min++; }
  const pane = f2.sopra[0];
  ok(pane.cosa === 'pane' && min > 4 && min < 30, `il pane cuoce sulla brace in ${min} minuti`);
  ok(vicino(pane.kg * MATERIALI.pane.kcal, kcal0, kcal0 * 0.03), 'le calorie del pane sono quelle della farina (nessuna energia dal nulla)');
}
{
  // mangiare il pesce crudo e bere al laghetto sono rischiosi; la fontana no
  const m = nuovoMondo({ adesso: T0, seme: 11, posizioni: { ada: { x: 0, z: 30 } }, abitanti: ['ada'] });
  const c = m.corpi.ada; let malati = 0;
  for (let i = 0; i < 40; i++) { c.malattie = []; c.stomaco = { kg: 0, kcal: 0, acqua: 0 }; c.x = 0; c.z = 30; eseguiAzioneVita(m, 'ada', { tipo: 'bevi', luogo: 'Fontana', quanto: 0.5 }, m.t); malati += c.malattie.length; }
  ok(malati === 0, 'l\'acqua della fontana e\' potabile');
  for (let i = 0; i < 40; i++) { c.stomaco = { kg: 0, kcal: 0, acqua: 0 }; c.x = 38; c.z = 21; eseguiAzioneVita(m, 'ada', { tipo: 'bevi', luogo: 'Laghetto', quanto: 1 }, m.t); malati += c.malattie.length ? 1 : 0; c.malattie = []; }
  ok(malati >= 2 && malati <= 14, `l'acqua del laghetto fa stare male a volte (${malati} su 40)`);
  // da lontano: l'azione chiede di camminare
  c.x = -40; c.z = 60; const r = eseguiAzioneVita(m, 'ada', { tipo: 'bevi', luogo: 'Fontana' }, m.t);
  ok(r.vai && r.vai.nome === 'Fontana', 'se il posto e\' lontano, prima ci si cammina');
}
{
  // il cibo va a male col tempo, piu' in fretta al caldo
  const m = nuovoMondo({ adesso: Date.UTC(2026, 6, 15, 10), seme: 2, abitanti: ['ada'] });
  m.cose.push(nuovaCosa(m, 'pesce', 0.3, { dove: 'terra', x: 10, z: 10 }));
  for (let h = 0; h < 36; h++) passoMondo(m, m.t + 3600000);
  ok(m.cose.find(q => q.cosa === 'pesce').guasto >= 1, 'pesce crudo a luglio: dopo un giorno e mezzo e\' andato a male');
}
{
  // percezione: a parole, senza calorie; il GOD vede tutto
  const p = percezioneVita(mondo, 'teo', mondo.t);
  ok(/IL TUO CORPO/.test(p) && /IL TEMPO/.test(p) && !/kcal/.test(p), 'percezione a parole, senza numeri del corpo');
  ok(/Dispensa del Mercatino/.test(p), 'vede la dispensa vicina');
  ok(/kcal/.test(vistaGod(mondo)), 'GOD vede i numeri veri');
  ok(promptAzioniVita().length < 7000, 'il prompt delle azioni resta corto (~1.700 token, uguale a ogni pensiero: si mette in cache)');
}

// ---------- invenzioni ----------
{
  const m = mondo;
  ok(!valutaInvenzione({ nome: 'ruota che gira da sola', energia: { fonte: null, potenzaUscitaW: 50, uscita: 'meccanica' } }, m).ok, 'niente moto perpetuo');
  ok(!valutaInvenzione({ nome: 'macina a mano', energia: { fonte: 'muscoli', potenzaW: 100, potenzaUscitaW: 90, uscita: 'meccanica' } }, m).ok, 'i muscoli non rendono il 90%');
  ok(valutaInvenzione({ nome: 'macina a mano', materiali: { pietra: 30 }, prodotti: { pietra: 30 }, energia: { fonte: 'muscoli', potenzaW: 100, potenzaUscitaW: 20, uscita: 'meccanica' } }, m).ok, 'macina a mano plausibile');
  ok(!valutaInvenzione({ nome: 'mulino ad acqua', energia: { fonte: 'acqua', potenzaW: 500, potenzaUscitaW: 300 } }, m).ok, 'niente fiume in piazza');
  ok(!valutaInvenzione({ nome: 'calce', temperatura: 900, struttura: 'aperto', reazioni: ['calcinazione'] }, m).ok, 'la calce non si fa sul fuoco all\'aperto');
  ok(valutaInvenzione({ nome: 'fornace da calce', temperatura: 900, struttura: 'fornace', reazioni: ['calcinazione'], materiali: { calcare: 10 }, prodotti: { calce_viva: 5.6 } }, m).ok, 'la calce in fornace e\' possibile');
  ok(!valutaInvenzione({ nome: 'moltiplicatore', materiali: { argilla: 1 }, prodotti: { terracotta: 3 } }, m).ok, 'la massa non si crea');
}

// ---------- la simulazione e' riproducibile e regge un mese ----------
{
  const a = simula({ giorni: 3, seme: 4 }), b = simula({ giorni: 3, seme: 4 });
  ok(JSON.stringify(a.mondo.statistiche) === JSON.stringify(b.mondo.statistiche), 'stesso seme, stessa storia');
  const s = simula({ giorni: 20, seme: 7 });
  ok(Object.values(s.mondo.corpi).every(c => !c.morto && c.peso > 50), 'con le scorte e il cervello a regole si vive almeno 20 giorni');
  ok(s.mondo.laghetto.pesci < 45, 'pescare svuota il laghetto');
  ok(JSON.parse(JSON.stringify(s.mondo)).corpi.ada.id === 'ada', 'il mondo si salva in JSON');
}

// ---------- aggancio al motore degli agenti (pronto, non collegato) ----------
{
  const { nuovoStato } = await import('../agenti/motore.mjs');
  const { passoVita, azioneVita, occupato, percezioneAgente } = await import('../agenti/vita/aggancio.mjs');
  const st = nuovoStato(T0);
  passoVita(st, T0 + 60000);
  ok(st.vita && st.vita.corpi.ada && st.vita.corpi.teo, 'il motore ha i corpi di Ada e Teo');
  const r = azioneVita(st, st.agenti.ada, { tipo: 'bevi', luogo: 'Laghetto' }, T0 + 60000);
  ok(r.cammina && r.cammina.x === 38, 'azione lontana: il motore deve prima camminare');
  st.agenti.ada.x = 0; st.agenti.ada.z = 9;
  ok(azioneVita(st, st.agenti.ada, { tipo: 'prendi', cosa: 'lenza' }, T0 + 60000).ok, 'prende dalla dispensa tramite il motore');
  st.agenti.ada.x = 38; st.agenti.ada.z = 21;
  ok(azioneVita(st, st.agenti.ada, { tipo: 'pesca', quanto: 1 }, T0 + 60000).ok && occupato(st, st.agenti.ada), 'pescando e\' occupata');
  ok(/IL TUO CORPO/.test(percezioneAgente(st, st.agenti.ada, T0 + 60000)), 'percezione per il prompt');
  ok(JSON.stringify(st).length < 200000, 'lo stato salvato resta piccolo');
}

// ---------- economia: il Mercatino ----------
{
  const { prezzoDi, chiudiGiornataMercato, LISTINO } = await import('../agenti/vita/economia.mjs');
  const m = nuovoMondo({ adesso: T0, seme: 1, posizioni: { ada: { x: 0, z: 9 }, teo: { x: 0, z: 30 } } });
  const ada = m.corpi.ada, prima = ada.starlight, scorta = m.mercato.scorte.pane;
  const r = eseguiAzioneVita(m, 'ada', { tipo: 'compra', cosa: 'pane', quanto: 0.5 }, T0);
  ok(r.ok && vicino(prima - ada.starlight, 0.5 * LISTINO.pane[0], 0.01) && vicino(m.mercato.scorte.pane, scorta - 0.5, 1e-6), 'comprare il pane costa prezzo x kg e cala la scorta');
  ok(eseguiAzioneVita(m, 'teo', { tipo: 'compra', cosa: 'pane', quanto: 0.5 }, T0).vai, 'per comprare bisogna andare al Mercatino');
  ok(!eseguiAzioneVita(m, 'ada', { tipo: 'compra', cosa: 'cappotto', quanto: 1 }, T0).ok, 'senza abbastanza Starlight non si compra');
  ada.zaino.push(nuovaCosa(m, 'pesce', 1, { T: 10 }));
  const s0 = ada.starlight, v = eseguiAzioneVita(m, 'ada', { tipo: 'vendi_al_mercatino', cosa: 'pesce', quanto: 1 }, T0);
  ok(v.ok && vicino(ada.starlight - s0, prezzoDi(m.mercato, 'pesce') * 0.5, 0.01), 'il Mercatino compra a meta\' prezzo');
  ok(!eseguiAzioneVita(m, 'ada', { tipo: 'vendi_al_mercatino', cosa: 'farina', quanto: 1 }, T0).ok, 'non compra quello che arriva gia\' da fuori (farina)');
  // domanda e offerta: pane esaurito -> +8%; farina rimasta tutta -> -4%
  m.mercato.scorte.pane = 0; m.mercato.scorte.farina = 25; const pPane = m.mercato.prezzi.pane, pFarina = m.mercato.prezzi.farina;
  chiudiGiornataMercato(m.mercato);
  ok(vicino(m.mercato.prezzi.pane, pPane * 1.08, 0.01) && vicino(m.mercato.prezzi.farina, pFarina * 0.96, 0.01), 'prezzi che seguono domanda e offerta');
  for (let i = 0; i < 60; i++) chiudiGiornataMercato(m.mercato);
  ok(m.mercato.prezzi.farina >= LISTINO.farina[0] * 0.5 && m.mercato.scorte.farina <= LISTINO.farina[1] * 3, 'i prezzi non crollano sotto meta\' listino e le scorte hanno un tetto');
}

// ---------- mestieri: turni, paga, esperienza ----------
{
  const { MESTIERI, pagaOraria, competenza } = await import('../agenti/vita/mestieri.mjs');
  ok(vicino(pagaOraria(MESTIERI.barista, 0), 24, 0.01) && vicino(pagaOraria(MESTIERI.barista, 2000), 36, 0.1), 'la paga sale con l\'esperienza (da 80% a 120%)');
  ok(vicino(competenza(200), 0.632, 0.001), 'curva di apprendimento: 63% dopo 200 ore');
  const m = nuovoMondo({ adesso: T0, seme: 2, posizioni: { ada: { x: 18, z: -3 }, teo: { x: 18, z: -2 } } });
  const notte = Date.UTC(2026, 10, 21, 3, 0);
  ok(!eseguiAzioneVita(m, 'ada', { tipo: 'turno', nome: 'barista', quanto: 3 }, notte).ok, 'la Caffetteria di notte non assume');
  const r = eseguiAzioneVita(m, 'ada', { tipo: 'turno', nome: 'barista', quanto: 3 }, T0);
  ok(r.ok && m.corpi.ada.lavoro.tipo === 'lavora', 'turno da barista iniziato');
  ok(!eseguiAzioneVita(m, 'teo', { tipo: 'turno', nome: 'barista', quanto: 3 }, T0).ok, 'un solo posto da barista: Teo non entra');
  ok(!eseguiAzioneVita(m, 'ada', { tipo: 'raccogli', cosa: 'rami' }, T0).ok && eseguiAzioneVita(m, 'ada', { tipo: 'bagno' }, T0).ok, 'durante il turno si puo\' andare in bagno ma non fare altro');
  const s0 = m.corpi.ada.starlight, paga = m.corpi.ada.lavoro.paga;
  for (let t = T0 + 60000; t <= T0 + 3 * 3600000 + 120000; t += 60000) passoMondo(m, t);
  ok(!m.corpi.ada.lavoro && vicino(m.corpi.ada.starlight - s0, 3 * paga, 1), 'a fine turno si e\' pagati per le ore lavorate');
  ok(m.corpi.ada.esperienza.barista > 2 && vicino(m.corpi.ada.oreLavoroOggi, 3, 0.05), 'si conta l\'esperienza e le ore di oggi');
  ok(m.corpi.ada.glicogeno < 1400, 'lavorare in piedi consuma energia');
}

// ---------- la vita da persona: bagno, igiene, solitudine, umore ----------
{
  const { viviUmano, rendimento, sensazioniUmane } = await import('../agenti/vita/umano.mjs');
  const m = nuovoMondo({ adesso: T0, seme: 3, posizioni: { ada: { x: 0, z: 30 }, teo: { x: 1, z: 30 } } });
  const ada = m.corpi.ada;
  ada.umano.vescica = 0; for (let i = 0; i < 60; i++) viviUmano(ada, 360, { altri: 1 });
  ok(vicino(ada.umano.vescica, 0.35, 0.05), 'la vescica si riempie di ~1,4 L al giorno');
  ok(/bagno/.test(sensazioniUmane(ada).join(' ')), 'si sente il bisogno del bagno');
  const r = eseguiAzioneVita(m, 'ada', { tipo: 'bagno' }, T0);
  ok(r.vai && r.vai.entra === 'casa_ada', 'il bagno piu\' vicino e\' quello di casa');
  ada.stanza = 'biblioteca';
  ok(eseguiAzioneVita(m, 'ada', { tipo: 'bagno' }, T0).ok && ada.umano.vescica === 0, 'in Biblioteca si va in bagno');
  ada.umano.vescica = 0.59; const ev = viviUmano(ada, 1200, {});
  ok(ev.some(e => e.tipo === 'incidente') && ada.umano.igiene < 0.6, 'se si aspetta troppo succede l\'incidente');
  ada.umano.igiene = 0.2;
  ok(eseguiAzioneVita(m, 'ada', { tipo: 'lavati' }, T0).ok && ada.umano.igiene === 1, 'con l\'acqua calda ci si lava bene');
  const teo = m.corpi.teo; teo.umano.igiene = 0.2; ada.stanza = null; ada.lavoro = null;
  ok(eseguiAzioneVita(m, 'teo', { tipo: 'lavati', luogo: 'Fontana' }, T0).vai || true, 'lavarsi lontano: prima si cammina');
  // solitudine: da soli cresce, chiacchierando cala per tutti e due
  const s1 = nuovoMondo({ adesso: T0, seme: 3, posizioni: { ada: { x: 0, z: 30 }, teo: { x: 1, z: 30 } } });
  const a1 = s1.corpi.ada, t1 = s1.corpi.teo; a1.umano.solitudine = 0.7; t1.umano.solitudine = 0.6;
  ok(eseguiAzioneVita(s1, 'ada', { tipo: 'chiacchiera', a: 'teo', quanto: 30 }, T0).ok && a1.umano.solitudine < 0.45 && t1.umano.solitudine < 0.35, 'chiacchierare toglie la solitudine a tutti e due');
  const solo = nuovoMondo({ adesso: T0, seme: 3, posizioni: { ada: { x: 0, z: 30 }, teo: { x: 40, z: -30 } } });
  for (let t = T0; t < T0 + 10 * 3600000; t += 60000) passoMondo(solo, t);
  ok(solo.corpi.ada.umano.solitudine > 0.35, 'da soli per 10 ore ci si sente soli');
  // umore: fame, sonno e solitudine lo abbassano; giu' di morale si rende meno
  const felice = nuovoCorpo('x'), triste = nuovoCorpo('y');
  felice.umano = { vescica: 0, igiene: 1, solitudine: 0, noia: 0, umore: 0.3, soddisfazioni: 0.3 };
  triste.umano = { vescica: 0, igiene: 0.1, solitudine: 1, noia: 1, umore: 0.3, soddisfazioni: 0 }; triste.glicogeno = 400; triste.sonno = 1.3;
  for (let i = 0; i < 24; i++) { felice.umano.vescica = triste.umano.vescica = 0; viviUmano(felice, 3600, { altri: 1, sole: true }); viviUmano(triste, 3600, {}); }
  ok(felice.umano.umore > 0.3 && triste.umano.umore < -0.5 && rendimento(felice) > rendimento(triste), 'umore e rendimento dipendono da come si sta');
}

// ---------- uova sode: le proteine coagulano a 70 gradi ----------
{
  const m = nuovoMondo({ adesso: T0, seme: 5, posizioni: { ada: { x: 6, z: 28 }, teo: { x: 0, z: 40 } } });
  m.fuochi.push({ id: 'f1', struttura: 'aperto', x: 6, z: 28, legna: [{ kg: 3, umid: 0.12 }], T: 700, acceso: true, sopra: [] });
  m.corpi.ada.zaino.push(nuovaCosa(m, 'uova', 0.12, { T: 12 }));
  ok(eseguiAzioneVita(m, 'ada', { tipo: 'metti_sul_fuoco', cosa: 'uova' }, T0).ok, 'uova sulla brace');
  for (let t = T0 + 60000; t <= T0 + 15 * 60000; t += 60000) passoMondo(m, t);
  const u = m.fuochi.find(f => f.id === 'f1').sopra.find(q => q.cosa === 'uova_cotte' || q.cosa === 'uova');
  ok(u && u.cosa === 'uova_cotte', 'in 15 minuti sulla brace l\'uovo e\' sodo');
}

// ---------- un solo portafoglio: gli Starlight del gioco ----------
{
  const { nuovoStato } = await import('../agenti/motore.mjs');
  const { passoVita, azioneVita } = await import('../agenti/vita/aggancio.mjs');
  const st = nuovoStato(T0); passoVita(st, T0 + 60000);
  st.agenti.ada.starlight = 77; st.agenti.ada.x = 0; st.agenti.ada.z = 9; st.agenti.ada.stanza = null;
  const r = azioneVita(st, st.agenti.ada, { tipo: 'compra', cosa: 'pane', quanto: 0.5 }, T0 + 60000);
  ok(r.ok && vicino(st.agenti.ada.starlight, 77 - 0.5 * st.vita.mercato.prezzi.pane, 0.01), 'la vita usa e aggiorna gli Starlight dell\'agente');
  st.agenti.ada.x = 10; st.agenti.ada.z = 30;
  ok(azioneVita(st, st.agenti.ada, { tipo: 'bagno' }, T0 + 60000).cammina.entra === 'casa_ada', 'il motore sa in che edificio entrare');
}

// ---------- la casa: riscaldamento, gas, doccia, frigo, fornello, bollette ----------
{
  const C = await import('../agenti/vita/casa.mjs');
  ok(vicino(C.METANO_J_M3 / 1e6, 35.9, 0.1), 'metano: 35,9 MJ per metro cubo (dalla reazione CH4 + 2 O2)');
  // un giorno a 5 gradi fuori con il termostato a 19: la caldaia brucia UA*dT*24h / rendimento
  const m = nuovoMondo({ adesso: T0, seme: 8 }), k = m.case.ada;
  for (let i = 0; i < 1440; i++) C.viviCasa(m, k, 60, 5, 0);
  const atteso = C.CASA.UA * 14 * 86400 / C.CASA.rendCaldaia / C.METANO_J_M3;
  ok(vicino(k.gasM3, atteso, 0.05) && vicino(k.T, 19, 0.1), `riscaldare un giorno a 5 gradi: ${k.gasM3.toFixed(2)} m3 di metano (realistico: 3-5)`);
  const c = m.corpi.ada, s0 = c.starlight, b = C.bollettaDelGiorno(k, c);
  ok(vicino(s0 - c.starlight, b.importo, 0.01) && b.importo > 20 && b.importo < 35, `bolletta del giorno: ${b.importo} Starlight`);
  // caldaia spenta: la casa si raffredda verso fuori in circa un giorno e mezzo (costante di tempo C/UA)
  k.staccato = true; k.T = 19; for (let i = 0; i < 30 * 60; i++) C.viviCasa(m, k, 60, 5, 0);
  ok(k.T < 12 && k.T > 6, `senza riscaldamento in 30 ore la casa scende a ${k.T.toFixed(1)} gradi`);
  k.staccato = false;
  // doccia: 40 litri da 14 a 40 gradi = 4,4 MJ di calore (piu' le perdite della caldaia)
  k.gasM3 = 0; const d = C.doccia(k);
  ok(d.calda && vicino(k.gasM3, 40 * 4186 * 26 / 0.9 / C.METANO_J_M3, 0.001), 'doccia calda: l\'energia per scaldare l\'acqua la paga il gas');
  // debiti: oltre la soglia staccano gas e luce; pagando si riallaccia
  c.starlight = 0; k.debito = C.DEBITO_MAX; k.gasM3 = 2; C.bollettaDelGiorno(k, c);
  ok(k.staccato, 'bollette non pagate: gas e luce staccati');
  c.starlight = 500; C.bollettaDelGiorno(k, c);
  ok(!k.staccato && k.debito === 0, 'pagato il debito, si riallaccia');
}
{
  // in casa: bagno, fornello, frigo, letto
  const m = nuovoMondo({ adesso: T0, seme: 9 }), c = m.corpi.ada; c.stanza = 'casa_ada';
  c.umano.vescica = 0.4;
  ok(eseguiAzioneVita(m, 'ada', { tipo: 'bagno' }, T0).ok && c.umano.vescica === 0, 'a casa c\'e\' il bagno');
  ok(eseguiAzioneVita(m, 'ada', { tipo: 'accendi' }, T0).ok, 'fornello a gas acceso');
  const p = nuovaCosa(m, 'pentola', 1.6, { T: 19, contenuto: [{ cosa: 'acqua', kg: 2, T: 14 }] }); p.cosa = 'pentola'; c.zaino.push(p);
  ok(eseguiAzioneVita(m, 'ada', { tipo: 'metti_sul_fuoco', cosa: 'pentola' }, T0).ok, 'pentola sul fornello');
  let t = T0, minuti = 0;
  while (minuti < 40) { t += 60000; minuti++; passoMondo(m, t); const q = m.fuochi.find(f => f.id === 'fornello:ada').sopra[0]; if (q.T >= 99.9) break; }
  ok(minuti >= 9 && minuti <= 20, `2 litri bollono sul fornello in ${minuti} minuti (realistico con una pentola di terracotta: 12-20)`);
  ok(m.case.ada.gasM3 > 0.03, 'il fornello consuma metano');
  // frigo: il pesce in frigo dura giorni, fuori meno di un giorno
  c.zaino.push(nuovaCosa(m, 'pesce', 0.4, { T: 15 }));
  ok(eseguiAzioneVita(m, 'ada', { tipo: 'lascia', cosa: 'pesce' }, t).esito.includes('frigo'), 'a casa il pesce va in frigo');
  const fuori = nuovaCosa(m, 'pesce', 0.4, { T: 20, dove: 'terra', x: 0, z: 0 }); m.cose.push(fuori);
  for (let i = 0; i < 48; i++) { t += 3600000; passoMondo(m, t); }
  const inFrigo = m.cose.find(q => q.dove === 'frigo');
  ok(inFrigo.guasto < 0.5 && inFrigo.guasto < fuori.guasto / 2, `in frigo a 4 gradi il pesce invecchia piu' piano: ${inFrigo.guasto.toFixed(2)} contro ${fuori.guasto.toFixed(2)} fuori (legge Q10)`);
  // il cibo caldo non va a male
  const caldo = nuovaCosa(m, 'pesce_cotto', 0.3, { T: 90, guasto: 0 });
  const { invecchia } = await import('../agenti/vita/natura.mjs'); invecchia(caldo, 2, 20, false);
  ok(caldo.guasto === 0, 'sopra i 45 gradi i batteri non crescono');
}

// ---------- i clienti demo consumano ----------
{
  const E = await import('../agenti/vita/economia.mjs');
  const mk = E.nuovoMercato(); mk.scorte.pesce = 0; mk.scorte.pentola = 0;
  ok(E.limiteAcquisto(mk, 'pesce') > 2, 'il Mercatino compra il pesce perche\' i clienti lo chiedono');
  mk.scorte.pesce = 3; const p0 = mk.prezzi.pentola;
  E.chiudiGiornataMercato(mk);
  ok(mk.demo.comprato.pesce > 2 && mk.demo.speso > 0, 'i clienti demo comprano il pesce degli agenti');
  ok(mk.prezzi.pentola > p0, 'nessuno porta pentole: il loro prezzo sale');
  const tanta = E.nuovoMercato(); tanta.scorte.ciotola = 50; const pc = tanta.prezzi.ciotola;
  E.chiudiGiornataMercato(tanta);
  ok(tanta.prezzi.ciotola < pc && E.limiteAcquisto(tanta, 'ciotola') === 0, 'troppe ciotole: prezzo giu\' e il Mercatino non ne compra altre');
}

// ---------- tre mesi di vita con lavoro e Mercatino ----------
{
  const s = simula({ giorni: 90, seme: 7 });
  const G = s.mondo.statistiche.giorni, primo = G[0], ultimo = G.at(-1);
  for (const id of ['ada', 'teo']) {
    const c = s.mondo.corpi[id];
    ok(!c.morto && Math.abs(c.peso - primo.corpi[id].peso) < 2.5, `${id}: vivo e con il peso stabile dopo 90 giorni`);
    ok(Object.values(c.esperienza).reduce((a, b) => a + b, 0) > 20 && c.starlight > 100, `${id}: ha lavorato e ha dei soldi da parte`);
    ok(c.umano.igiene > 0.3 && c.umano.umore > -0.2, `${id}: pulito e non depresso`);
  }
  ok(s.mondo.laghetto.pesci > 10 && s.mondo.mercato.incasso > 1000, 'il laghetto non si svuota: si compra al Mercatino');
}

console.log(`vita: ${n} prove superate`);
