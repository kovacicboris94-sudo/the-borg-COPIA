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
  ok(promptAzioniVita().length < 6000, 'il prompt delle azioni resta corto');
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

console.log(`vita: ${n} prove superate`);
