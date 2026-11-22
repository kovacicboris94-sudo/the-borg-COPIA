// Prove della banca (agenti/banca.mjs), delle ville e degli appartamenti nella Torre.
//   node test/banca.test.mjs
import assert from 'node:assert/strict';
import { nuovoStato, passo, percezione, normalizzaAzione, giocatoreTerreno, promptDiSistema, SCHEMA, STANZE, sincronizzaTerreni, vistaPubblica } from '../agenti/motore.mjs';
import { rataFrancese, pianoMutuo, passoBanca, maturaGiocatore, chiediMutuo, chiediPrestito, rimborsa, vistaConto, REGOLE_BANCA as RB, BANCA } from '../agenti/banca.mjs';
import { LOTTI, costoProgetto, geometria, APPARTAMENTI, immobileDi, passoCantieri, PROGETTI } from '../agenti/terreni.mjs';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const ROMA = (g, h, mi = 0) => Date.UTC(2026, 10, g, h - 1, mi);
const muto = async () => ({ testo: JSON.stringify({ pensiero: '', azioni: [], ricorda: '', prossimo_pensiero_minuti: 720, sforzo_prossimo: 'basso', memoria_nuova: '' }), usage: { input_tokens: 10, output_tokens: 10 }, stop_reason: 'end_turn' });
async function scorri(s, da, minuti, passoS = 30) { let t = da; for (let i = 0; i < minuti * 60 / passoS; i++) { t += passoS * 1000; await passo(s, t, muto); } return t; }
const quasi = (a, b, e = 0.05) => Math.abs(a - b) <= e;

// 1) i conti della rata alla francese
{
  ok(quasi(rataFrancese(25000, 0.04, 240), 151.50), 'mutuo 25.000 al 4% in 240 rate: 151,50');
  ok(quasi(rataFrancese(1200, 0, 12), 100), 'senza interessi: capitale / rate');
  const p = pianoMutuo(3000, 0.09, 24); ok(p.interessi > 280 && p.interessi < 300, 'prestito 3.000 al 9% in 24 rate: circa 290 di interessi');
}

// 2) una persona vera: mutuo per terreno + villa; anticipo minimo; una proprieta' sola; la rata scade solo quando gioca
{
  const s = nuovoStato(ROMA(23, 9)), t0 = ROMA(23, 9);
  const valore = LOTTI[2].prezzo + costoProgetto('villa'), minimo = Math.ceil(valore * 0.2);
  ok(costoProgetto('villa') > costoProgetto('casa') * 2, 'la villa costa molto piu\' della casa');
  let r = giocatoreTerreno(s, 'Boris', { azione: 'mutuo', bene: 'lotto3', tipo: 'villa', soldi: minimo - 1, chiave: 'k-boris' }, t0);
  ok(!r.ok && /anticipo/.test(r.motivo), 'senza l\'anticipo del 20% niente mutuo');
  ok(!giocatoreTerreno(s, 'Boris', { azione: 'mutuo', bene: 'lotto3', tipo: 'villa', soldi: 1e6, chiave: 'altra' }, t0).ok, 'un altro con lo stesso nome non puo\'');
  r = giocatoreTerreno(s, 'Boris', { azione: 'mutuo', bene: 'lotto3', tipo: 'villa', nome: 'Villa Boris', soldi: minimo + 5, durata: 240, chiave: 'k-boris' }, t0);
  ok(r.ok && r.spesa === minimo && r.capitale === valore - minimo, 'mutuo approvato: paga l\'anticipo, la banca il resto');
  ok(s.terreni.lotto3.chi === 'g:Boris' && s.terreni.lotto3.progetto.tipo === 'villa', 'terreno comprato e cantiere della villa aperto');
  ok(geometria(LOTTI[2], 'villa').edificio.w > geometria(LOTTI[2], 'casa').edificio.w, 'la villa e\' piu\' grande');
  ok(!giocatoreTerreno(s, 'Boris', { azione: 'appartamento', piano: 3, soldi: 1e6, chiave: 'k-boris' }, t0).ok, 'una sola proprieta\'');
  ok(!giocatoreTerreno(s, 'Boris', { azione: 'mutuo', bene: 'piano 2', soldi: 1e6, chiave: 'k-boris' }, t0).ok, 'un solo mutuo');
  // sta via 5 giorni: le rate scadono lo stesso (Boris: cosi' la gente e' invogliata a giocare)
  let b = giocatoreTerreno(s, 'Boris', { azione: 'banca', chiave: 'k-boris' }, t0 + 5 * 864e5 + 1000);
  const L = b.conto.prestiti[0];
  ok(b.ok && L.pagate === 5 && L.insolute === 5, 'dopo 5 giorni via: 5 rate da pagare');
  b = giocatoreTerreno(s, 'Boris', { azione: 'banca', chiave: 'k-boris' }, t0 + 5 * 864e5 + 3600e3);
  ok(b.conto.prestiti[0].pagate === 5, 'nello stesso giorno non ne scade un\'altra');
  // chi non entra proprio: il borgo fa scadere le rate lo stesso e dopo 10 pignora
  { const s2 = nuovoStato(t0); giocatoreTerreno(s2, 'Ugo', { azione: 'appartamento', piano: 1, soldi: 0 }, t0);
    giocatoreTerreno(s2, 'Ugo', { azione: 'mutuo', bene: 'piano 2', soldi: 1e6 }, t0);
    for (let i = 1; i <= 11; i++) passoBanca(s2, t0 + i * 864e5 + 1000, () => null);
    ok(!s2.appartamenti.torre2 && s2.aste.torre2, 'giocatore assente 11 giorni: casa pignorata'); }
  r = giocatoreTerreno(s, 'Boris', { azione: 'paga', importo: 99999, soldi: 99999, chiave: 'k-boris' }, t0 + 5 * 864e5 + 3700e3);
  ok(r.ok && quasi(r.spesa, L.scaduto, 0.05), '"paga" paga solo le rate scadute');
  const prima = vistaConto(s, 'g:Boris').prestiti[0];
  r = giocatoreTerreno(s, 'Boris', { azione: 'rimborsa', importo: 10000, soldi: 10000, chiave: 'k-boris' }, t0 + 5 * 864e5 + 3800e3);
  const dopo = vistaConto(s, 'g:Boris').prestiti[0];
  ok(r.ok && r.spesa === 10000 && quasi(dopo.residuo, prima.residuo - 10000, 0.02) && dopo.rata < prima.rata, 'restituire in anticipo abbassa debito e rata');
  const v = vistaPubblica(s, t0);
  ok(v.banca && v.banca.edificio.nome === BANCA.nome && !v.banca.abitanti.some(a => a.id === 'g:Boris'), 'i debiti delle persone vere non si vedono in piazza');
  ok(v.appartamenti.length === 15 && v.appartamenti[14].prezzo > v.appartamenti[0].prezzo, 'appartamenti: piu\' in alto costano di piu\'');
}

// 3) prestito personale di una persona vera: arrivano i soldi; dopo 10 rate non pagate deve tutto ed e' segnalata
{
  const s = nuovoStato(ROMA(23, 9)); let t = ROMA(23, 9);
  let r = giocatoreTerreno(s, 'Lia', { azione: 'prestito', importo: 2000, durata: 24, chiave: 'x' }, t);
  ok(r.ok && r.accredito === 2000 && r.spesa === 0, 'prestito: 2000 Starlight subito');
  ok(!giocatoreTerreno(s, 'Lia', { azione: 'prestito', importo: 500, chiave: 'x' }, t).ok, 'uno alla volta');
  for (let i = 0; i < 10; i++) { t += 864e5; maturaGiocatore(s, 'g:Lia', t); }
  const c = vistaConto(s, 'g:Lia');
  ok(c.segnalato && c.prestiti[0].decaduto && c.prestiti[0].residuo === 0 && c.prestiti[0].scaduto > 2000, 'dopo 10 rate non pagate: deve tutto subito, segnalata');
  ok(c.storia.some(q => /Lettera della banca/.test(q.s)), 'prima e\' arrivata la lettera');
  ok(!giocatoreTerreno(s, 'Lia', { azione: 'mutuo', bene: 'piano 3', soldi: 1e6, chiave: 'x' }, t).ok, 'segnalata: niente mutuo');
  r = giocatoreTerreno(s, 'Lia', { azione: 'paga', importo: 1e6, soldi: 1e6, chiave: 'x' }, t + 1000);
  ok(r.ok && !vistaConto(s, 'g:Lia').segnalato && !vistaConto(s, 'g:Lia').prestiti.length, 'pagato tutto: non e\' piu\' segnalata');
}

// 4) un abitante IA: va in banca, mutuo per un appartamento, ci abita (entra dalla Torre), la banca prende le rate
{
  const s = nuovoStato(ROMA(23, 9)), ada = s.agenti.ada;
  Object.values(s.agenti).forEach(a => { a.prossimoPensiero = ROMA(30, 9); });
  ok(['appartamento', 'mutuo', 'prestito', 'rimborsa'].every(k => SCHEMA.properties.azioni.items.properties.tipo.enum.includes(k)), 'azioni della banca nello schema');
  ok(/"tipo":"mutuo"/.test(promptDiSistema(ada)) && /cattivo pagatore/.test(promptDiSistema(ada)), 'la banca e\' spiegata agli agenti');
  ok(/BANCA \(Banca del Borgo/.test(percezione(s, ada, ROMA(23, 9))) && /Appartamenti nella Torre/.test(percezione(s, ada, ROMA(23, 9))), 'l\'agente vede banca e appartamenti');
  const m = normalizzaAzione({ tipo: 'mutuo', nome: 'piano 7', prezzo: 4000, minuti: 120 });
  ok(m.bene === 'piano 7' && m.anticipo === 4000 && m.durata === 120, 'mutuo normalizzato');
  ada.starlight = 1000;
  ada.coda = [m];
  let t = await scorri(s, ROMA(23, 9), 6);
  ok(ada.esiti.some(e => /in cammino verso la Banca del Borgo/.test(e)), 'e\' andata in banca');
  ok(ada.esiti.some(e => /mutuo: rifiutato.*anticipo/.test(e)), 'con 1000 Starlight niente mutuo');
  const prezzo = APPARTAMENTI[6].prezzo;
  ada.starlight = 5000; ada.coda = [normalizzaAzione({ tipo: 'mutuo', nome: 'piano 7', prezzo: 4000, minuti: 120 })];
  for (let i = 0; i < 40 && !(s.appartamenti && s.appartamenti.torre7); i++) t = await scorri(s, t, 0.5);
  ok(s.appartamenti && s.appartamenti.torre7 && s.appartamenti.torre7.chi === 'ada', 'Ada ha l\'appartamento al 7° piano');
  ok(Math.round(ada.starlight) === 5000 - Math.ceil(prezzo * 0.2), 'ha pagato l\'anticipo minimo (piu\' dei 4000 che offriva): ' + ada.starlight);
  const st = STANZE.find(q => q.id === 'casa_ada');
  ok(st.da === 'torre7' && s.vita.case.ada.porta.x === -39, 'casa sua ora e\' nella Torre (e la vita lo sa)');
  ok(immobileDi(s, 'ada').valore === prezzo, 'valore per la banca = prezzo dell\'appartamento');
  ada.coda = [normalizzaAzione({ tipo: 'entra', luogo: 'Casa di Ada' })];
  t = await scorri(s, t, 4);
  ok(ada.stanza === 'casa_ada', 'entra in casa passando dalla Torre e dall\'ascensore');
  // un giorno dopo: la banca prende la rata dal conto
  const L0 = vistaConto(s, 'ada').prestiti[0], soldi0 = ada.starlight;
  t = await scorri(s, t, 24 * 60 + 5, 600);
  const L1 = vistaConto(s, 'ada').prestiti[0];
  ok(L1.pagate >= 1 && L1.scaduto === 0 && ada.starlight < soldi0, 'rata presa dal conto: ' + (soldi0 - ada.starlight));
  // poi resta senza soldi: lettera dopo 3 rate, pignoramento dopo 10 (si fa direttamente con la banca)
  let w = { starlight: 0 }, giorno = s.banca.conti.ada.prestiti[0].prossima, fatti = [];
  for (let i = 0; i < 12 && s.appartamenti.torre7; i++) { fatti.push(...passoBanca(s, giorno, () => w)); giorno += 864e5; }
  ok(fatti.some(f => f.tipo === 'sollecito') && fatti.some(f => f.tipo === 'pignoramento'), 'lettera e poi pignoramento');
  ok(!s.appartamenti.torre7 && s.aste.torre7 && s.aste.torre7.prezzo === Math.round(prezzo * RB.astaQuota), 'l\'appartamento e\' all\'asta al 70%');
  sincronizzaTerreni(s);
  ok(!STANZE.find(q => q.id === 'casa_ada').da, 'Ada torna nella casetta del borgo');
  ok(vistaConto(s, 'ada').segnalato, 'il ricavato non bastava: deve ancora il resto ed e\' segnalata');
  // un altro lo compra all'asta
  const r = giocatoreTerreno(s, 'Teo2', { azione: 'appartamento', piano: 7, soldi: 1e6 }, giorno);
  ok(r.ok && r.spesa === Math.round(prezzo * RB.astaQuota) && !s.aste.torre7, 'comprato all\'asta a prezzo scontato');
  sincronizzaTerreni(nuovoStato(t));
}

// 5) pignoramento di un terreno con la casa sopra: torna in vendita con la casa, e chi lo compra se la ritrova
{
  const s = nuovoStato(ROMA(23, 9)), t0 = ROMA(23, 9);
  const r = chiediMutuo(s, 'teo', 'Teo', { bene: 'lotto1', progetto: 'casa', durata: 60 }, 1e6, t0);
  ok(r.ok && r.durata === 60 && s.terreni.lotto1.progetto.tipo === 'casa', 'mutuo per terreno e casa');
  let t = t0; while (!s.terreni.lotto1.progetto.finito) { t += 1800e3; passoCantieri(s, t, 1800); }
  let w = { starlight: 0 }, g = t0 + 864e5;
  for (let i = 0; i < 12 && s.terreni.lotto1; i++) { passoBanca(s, g, () => w); g += 864e5; }
  ok(!s.terreni.lotto1 && s.aste.lotto1 && s.aste.lotto1.progetto.finito, 'pignorato: all\'asta con la casa sopra');
  const v = vistaPubblica(s, g).terreni.find(q => q.id === 'lotto1');
  ok(v.asta && v.prezzo === s.aste.lotto1.prezzo && v.progetto.fase === 'finito', 'il gioco lo mostra all\'asta con la casa');
  const k = giocatoreTerreno(s, 'Mia', { azione: 'compra', lotto: 'lotto1', soldi: 1e6 }, g);
  ok(k.ok && s.terreni.lotto1.chi === 'g:Mia' && s.terreni.lotto1.progetto.finito, 'Mia compra all\'asta e ha gia\' la casa');
  // prestito di un agente e restituzione anticipata
  const p = chiediPrestito(s, 'ada', 'Ada', 1000, 12, g);
  ok(p.ok && p.accredito === 1000, 'prestito ad Ada');
  const q = rimborsa(s, 'ada', 5000, 5000, g + 1000, false);
  ok(q.ok && q.spesa === 1000 && !vistaConto(s, 'ada').prestiti.length, 'restituito tutto in anticipo, senza penali');
  ok(PROGETTI.villa.ore > PROGETTI.casa.ore, 'la villa richiede piu\' lavoro');
}
console.log(`banca: ${n} controlli passati`);
