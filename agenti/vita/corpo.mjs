// =====================================================================
//  VITA - IL CORPO
//  Un corpo umano semplificato ma fedele alla fisiologia:
//   - energia: metabolismo basale (Mifflin-St Jeor) x attivita' (MET),
//     stomaco -> glicogeno -> grasso, come nelle persone;
//   - acqua: ~60% del peso, perdite di base + sudore con caldo e fatica;
//   - sonno: pressione del sonno che sale da svegli e scende dormendo;
//   - temperatura: bilancio termico (metabolismo contro dispersione con
//     vestiti, vento, pioggia, vicinanza al fuoco);
//   - salute: scende solo per cause vere (sete, fame, freddo, malattie).
//  Le soglie sono quelle della medicina: a 2% di disidratazione hai sete,
//  oltre il 10% sei in pericolo; senza mangiare si resiste settimane.
// =====================================================================
import { KCAL } from './fisica.mjs';

// Quanto "costa" ogni attivita' rispetto al riposo (MET, Compendium of Physical Activities).
export const MET = {
  dormire: 0.95, riposare: 1.3, parlare: 1.5, mangiare: 1.5, cucinare: 2.0, camminare: 3.5,
  pescare: 2.5, raccogliere: 3.0, svago: 1.6, lavarsi: 2.0, lavorare: 2.5, accendere: 3.0, frizione: 6.0, modellare: 2.5, seminare: 4.0, costruire: 4.5, spaccare: 6.0
};

// MET di quello che si sta facendo (un turno di lavoro ha il suo)
export const metDi = c => (c.attivita === 'lavorare' && c.lavoro && c.lavoro.met) || MET[c.attivita] || 1.3;

export const SOGLIE = {
  glicogenoMax: 1800,       // kcal tra fegato e muscoli
  stomacoMaxKg: 1.6,        // oltre si sta male
  assorbimento: 280,        // kcal/h che lo stomaco passa al sangue
  grassoMinimo: 0.03,       // frazione del peso: il grasso essenziale, sotto si muore di fame
  acquaFrazione: 0.6,       // acqua corporea sul peso
  sonnoSale: 1 / 16,        // pressione del sonno all'ora da sveglio (16 ore svegli -> 1)
  sonnoScende: 1 / 8,       // all'ora dormendo (8 ore -> da 1 a 0)
  pelle: 33.5,              // gradi della pelle in condizioni normali
  areaCorpo: 1.8,           // m^2
  capacitaTermica: 3500     // J/(kg K) del corpo umano
};

// Un corpo nuovo. Sesso, eta', altezza e peso servono al metabolismo; il grasso iniziale e' tipico per sesso.
// clo 1,3 = vestiti invernali normali (pantaloni, maglia, giacca)
export function nuovoCorpo({ sesso = 'f', eta = 30, altezza = 170, peso = 68, clo = 1.3 } = {}) {
  const grassoFraz = sesso === 'f' ? 0.25 : 0.16;
  return {
    sesso, eta, altezza, peso, clo,
    stomaco: { kg: 0, kcal: 0, acqua: 0 },
    glicogeno: 1400,                         // kcal
    grasso: peso * grassoFraz * 7700,        // kcal (1 kg di grasso corporeo ~ 7700 kcal)
    acqua: peso * SOGLIE.acquaFrazione,      // litri
    acquaNormale: peso * SOGLIE.acquaFrazione,
    sonno: 0.2,                              // pressione del sonno 0 = riposato
    temperatura: 37,                         // gradi, temperatura interna
    salute: 100,
    malattie: [],                            // { tipo, fino, gravita }
    attivita: 'riposare', addormentato: false,
    ultimoPasto: null, ultimaBevuta: null, oreSveglio: 0,
    svenuto: null, morto: null,
    consumoOggi: 0, mangiatoOggi: 0, bevutoOggi: 0
  };
}

// Metabolismo basale in kcal/giorno (Mifflin-St Jeor, 1990).
export function metabolismoBasale(c) {
  return 10 * c.peso + 6.25 * c.altezza - 5 * c.eta + (c.sesso === 'f' ? -161 : 5);
}

// Calore che il corpo perde verso l'ambiente (W) e capacita' di compensare.
// amb: { tAria, vento (m/s), bagnato (0..1), fuoco (W/m^2 di calore radiante ricevuto), riparo (bool), coperta (clo in piu') }
export function bilancioTermico(c, amb) {
  const metW = metabolismoBasale(c) / 24 * metDi(c) * KCAL / 3600;   // W prodotti
  const clo = (c.clo + (c.addormentato ? (amb.coperta || 0) : 0)) * (1 - 0.6 * (amb.bagnato || 0));   // i vestiti bagnati isolano molto meno
  const Icl = 0.155 * clo;                                 // m^2 K / W
  const Ia = 1 / (3.1 + 8.3 * Math.sqrt(Math.max(0.1, amb.vento || 0.2)) + 4.7);   // aria ferma ~0,1; col vento meno
  const tAria = amb.riparo ? (amb.tInterno ?? Math.max(amb.tAria, 20)) : amb.tAria;  // al chiuso: negli edifici pubblici (riscaldati) 20 gradi, a casa quello che dice il termostato
  // al freddo i vasi della pelle si stringono e la pelle si raffredda (fino a ~28 gradi): si disperde meno
  const pelle = tAria < 20 ? Math.max(28, SOGLIE.pelle - (20 - tAria) * 0.35) : SOGLIE.pelle;
  const perdita = (pelle - tAria) / (Icl + Ia) * SOGLIE.areaCorpo + 0.1 * metW;  // + respirazione ~10%
  const guadagnoFuoco = (amb.fuoco || 0) * SOGLIE.areaCorpo * 0.4;                    // il fuoco scalda un lato del corpo
  const netto = metW + guadagnoFuoco - perdita;            // W: positivo = troppo caldo, negativo = freddo
  return { metW, perdita, netto, clo };
}

// Fa vivere il corpo per dt secondi. Restituisce gli eventi importanti (svenimenti, malattie finite...).
export function viviCorpo(c, dt, amb, adesso, regole = {}) {
  const ev = [];
  if (c.morto) return ev;
  const ore = dt / 3600;
  if (c.svenuto && adesso >= c.svenuto) { c.svenuto = null; c.salute = Math.max(c.salute, 15); c.attivita = 'riposare'; ev.push({ tipo: 'rinviene' }); }
  if (c.svenuto) c.attivita = 'dormire';

  // --- energia ---
  const bmrOra = metabolismoBasale(c) / 24;
  const malato = c.malattie.length > 0;
  let consumo = bmrOra * metDi(c) * ore;
  // tremare per il freddo brucia energia (fino a 3-4 volte il basale)
  const term = bilancioTermico(c, amb);
  const brividi = term.netto < -60 ? Math.min(bmrOra * 3 * ore, (-term.netto - 60) * dt / KCAL) : 0;
  consumo += brividi;
  c.consumoOggi += consumo;
  // digestione: lo stomaco passa calorie e acqua al sangue
  const assorbite = Math.min(c.stomaco.kcal, SOGLIE.assorbimento * ore * (malato ? 0.5 : 1));
  const frazione = c.stomaco.kcal > 0 ? assorbite / c.stomaco.kcal : 1;
  c.stomaco.kcal -= assorbite;
  const acquaAssorbita = c.stomaco.acqua * Math.min(1, frazione + ore * 2);   // l'acqua passa in fretta (mezz'ora)
  c.stomaco.acqua -= acquaAssorbita; c.acqua += acquaAssorbita;
  c.stomaco.kg = Math.max(0, c.stomaco.kg - (c.stomaco.kg * Math.min(1, ore / 3)));  // svuotamento gastrico ~3 ore
  if (c.stomaco.kcal < 1) { c.stomaco.kcal = 0; }
  let entrate = assorbite;
  // il glicogeno fa da cuscinetto; l'eccesso va in grasso (con perdita del 10%), il deficit si prende dal grasso
  let bilancio = entrate - consumo;
  if (bilancio >= 0) {
    const spazio = SOGLIE.glicogenoMax - c.glicogeno, inGlicogeno = Math.min(spazio, bilancio);
    c.glicogeno += inGlicogeno; c.grasso += (bilancio - inGlicogeno) * 0.9;
  } else {
    // quando il glicogeno e' basso il corpo usa soprattutto i grassi
    const quotaGrasso = c.glicogeno > 600 ? 0.5 : 0.85, deficit = -bilancio;
    const daGlicogeno = Math.min(c.glicogeno, deficit * (1 - quotaGrasso));
    c.glicogeno -= daGlicogeno; c.grasso -= deficit - daGlicogeno;
  }
  // il peso segue il grasso (1 kg ogni 7700 kcal)
  c.peso = Math.max(30, c.peso + (c.grasso - (c._grassoPrima ?? c.grasso)) / 7700);
  c._grassoPrima = c.grasso;

  // --- acqua ---
  // perdite di base (urina, respiro, pelle) ~2,2 L/giorno; sudore con caldo e fatica; diarrea se malati
  const caldo = Math.max(0, term.netto) / 2426000 * 3600;            // L/h di sudore per smaltire il calore in piu' (2,43 MJ per litro evaporato)
  const sforzo = Math.max(0, metDi(c) - 2) * 0.08;   // L/h
  const diarrea = c.malattie.some(m => m.tipo === 'gastroenterite' || m.tipo === 'fitoemoagglutinina') ? 0.08 : 0;
  const perse = (2.2 / 24 + Math.min(1.5, caldo + sforzo) + diarrea) * ore;
  c.acqua -= perse;
  c.acquaPersaOggi = (c.acquaPersaOggi || 0) + perse;

  // --- sonno ---
  if (c.addormentato || c.svenuto) {
    const qualita = term.netto < -110 ? 0.4 : term.netto < -60 ? 0.7 : 1;   // al freddo si dorme male
    c.sonno = Math.max(0, c.sonno - SOGLIE.sonnoScende * ore * qualita);
    c.oreSveglio = 0;
  } else {
    c.sonno += SOGLIE.sonnoSale * ore; c.oreSveglio += ore;
  }

  // --- temperatura interna ---
  // entro certi limiti il corpo compensa (vasi sanguigni, sudore fino a ~600 W, brividi fino a ~150 W in piu')
  let squilibrio = 0;
  if (term.netto > 600) squilibrio = term.netto - 600;
  else if (term.netto < -60) squilibrio = Math.min(0, term.netto + 60 + 150);
  const C = c.peso * SOGLIE.capacitaTermica;
  c.temperatura += squilibrio * dt / C;
  if (squilibrio === 0) c.temperatura += (37 - c.temperatura) * Math.min(1, ore * 2);   // torna a 37 in mezz'ora
  if (c.malattie.length) c.temperatura = Math.max(c.temperatura, 37 + Math.max(...c.malattie.map(m => m.febbre || 0)) * 1);

  // --- malattie ---
  c.malattie = c.malattie.filter(m => { if (adesso >= m.fino) { ev.push({ tipo: 'guarito', malattia: m.tipo }); return false; } return true; });

  // --- salute: scende per cause vere, risale piano se tutto va bene ---
  const disidratazione = (c.acquaNormale - c.acqua) / c.peso;   // frazione del peso persa in acqua
  const grassoFraz = c.grasso / 7700 / c.peso;
  let danno = 0;
  if (disidratazione > 0.08) danno += (disidratazione - 0.08) * 300 * ore;      // oltre 8% grave; verso il 12-15% si muore (circa 3 giorni senz'acqua)
  if (grassoFraz < SOGLIE.grassoMinimo + 0.02) danno += 1.2 * ore;               // fame vera: settimane
  if (c.glicogeno < 50 && c.stomaco.kcal < 10) danno += 0.05 * ore;
  if (c.temperatura < 35) danno += (35 - c.temperatura) * 8 * ore;               // ipotermia
  if (c.temperatura > 40) danno += (c.temperatura - 40) * 10 * ore;              // colpo di calore
  if (c.oreSveglio > 48) danno += 0.6 * ore;
  // le malattie del borgo raramente uccidono da sole un adulto sano: fanno danno soprattutto con la disidratazione (diarrea, gia' contata sopra)
  for (const m of c.malattie) danno += (m.gravita || 1) * 0.25 * ore;
  if (danno > 0) c.salute -= danno;
  else if (disidratazione < 0.03 && c.glicogeno > 300 && c.sonno < 1.2 && Math.abs(c.temperatura - 37) < 0.8) c.salute = Math.min(100, c.salute + 2 * ore);

  if (c.salute <= 0) {
    if (regole.morte) { c.morto = adesso; c.salute = 0; ev.push({ tipo: 'morte', causa: causaPrincipale(c) }); }
    else if (!c.svenuto) {
      // senza morte (scelta di Boris da decidere): si sviene, si recupera un po' e ci si risveglia
      c.svenuto = adesso + 6 * 3600000; c.salute = 1; c.addormentato = true;
      // senza morte qualcuno ti soccorre: ti porta al chiuso (in Biblioteca), ti scalda e ti da' da bere. E' l'unico aiuto che il mondo da'.
      const causa = causaPrincipale(c);
      c.acqua = Math.max(c.acqua, c.acquaNormale - c.peso * 0.05); c.temperatura = Math.max(c.temperatura, 36); c.stanza = 'biblioteca'; c.soccorso = adesso;
      ev.push({ tipo: 'svenuto', causa, portatoIn: 'biblioteca' });
    } else c.salute = 1;
  }
  // il sonno arriva da solo se si resta svegli troppo (oltre ~40 ore)
  if (!c.addormentato && c.sonno > 2.5) { c.addormentato = true; c.attivita = 'dormire'; ev.push({ tipo: 'crollo_sonno' }); }
  return ev;
}

export function causaPrincipale(c) {
  const dis = (c.acquaNormale - c.acqua) / c.peso;
  if (dis > 0.08) return 'sete';
  if (c.temperatura < 35) return 'freddo';
  if (c.temperatura > 40) return 'caldo';
  if (c.grasso / 7700 / c.peso < SOGLIE.grassoMinimo + 0.02) return 'fame';
  if (c.malattie.length) return c.malattie[0].tipo;
  if (c.oreSveglio > 48) return 'sonno';
  return 'sfinimento';
}

// Mangiare: kg di un cibo con kcal/kg, acqua e digeribilita'. Lo stomaco ha un limite.
export function mangia(c, { kg, kcal, acqua = 0, digeribile = 1 }, adesso) {
  const spazio = Math.max(0, SOGLIE.stomacoMaxKg - c.stomaco.kg), presi = Math.min(kg, spazio);
  if (presi <= 0) return 0;
  c.stomaco.kg += presi; c.stomaco.kcal += presi * kcal * digeribile; c.stomaco.acqua += presi * acqua;
  c.ultimoPasto = adesso; c.mangiatoOggi += presi * kcal * digeribile;
  return presi;
}
export function bevi(c, litri, adesso) {
  const spazio = Math.max(0, SOGLIE.stomacoMaxKg + 0.4 - c.stomaco.kg), presi = Math.min(litri, spazio, 1.2);
  c.stomaco.kg += presi; c.stomaco.acqua += presi; c.ultimaBevuta = adesso; c.bevutoOggi += presi;
  return presi;
}
export function ammala(c, tipo, adesso) {
  const M = {
    gastroenterite: { ore: 48, gravita: 1.5, febbre: 1.2 },
    parassiti: { ore: 24 * 5, gravita: 0.6, febbre: 0.5 },
    fitoemoagglutinina: { ore: 5, gravita: 2, febbre: 0 },
    cibo_guasto: { ore: 30, gravita: 1.5, febbre: 0.8 }
  }[tipo] || { ore: 24, gravita: 1, febbre: 0.5 };
  if (c.malattie.some(m => m.tipo === tipo)) return false;
  c.malattie.push({ tipo, fino: adesso + M.ore * 3600000, gravita: M.gravita, febbre: M.febbre });
  return true;
}

// Come si sente: a parole, come una persona (nessun numero di calorie).
export function sensazioni(c, amb, adesso) {
  const s = [];
  if (c.morto) return ['sei morto'];
  if (c.svenuto) return ['sei svenuto'];
  const oreDaPasto = c.ultimoPasto ? (adesso - c.ultimoPasto) / 3600000 : null;
  const fame = c.stomaco.kcal > 400 ? 0 : c.glicogeno < 400 ? 3 : c.glicogeno < 900 ? 2 : c.glicogeno < 1300 ? 1 : 0;
  if (c.stomaco.kg > SOGLIE.stomacoMaxKg * 0.85) s.push('sei pieno');
  else if (fame) s.push(['', 'hai un po\' di fame', 'hai fame', 'hai una fame che ti fa girare la testa'][fame] + (oreDaPasto != null ? ` (ultimo pasto ${oreDaPasto < 1 ? 'meno di un\'ora' : Math.round(oreDaPasto) + ' ore'} fa)` : ' (non hai ancora mangiato da quando sei qui)'));
  const dis = (c.acquaNormale - c.acqua) / c.peso;
  if (dis > 0.06) s.push('hai una sete terribile, la bocca e\' secca e ti gira la testa');
  else if (dis > 0.03) s.push('hai molta sete');
  else if (dis > 0.015) s.push('hai sete');
  if (c.sonno > 1.6) s.push('sei esausto, gli occhi si chiudono da soli');
  else if (c.sonno > 1.1) s.push('sei molto stanco e hai sonno');
  else if (c.sonno > 0.8) s.push('cominci a essere stanco');
  const t = bilancioTermico(c, amb);
  if (c.temperatura < 35.5) s.push('stai congelando, tremi forte e pensi a fatica');
  else if (t.netto < -150) s.push('hai molto freddo e tremi');
  else if (t.netto < -60) s.push('hai freddo');
  else if (t.netto > 300) s.push('hai molto caldo e sudi');
  for (const m of c.malattie) s.push({ gastroenterite: 'hai mal di pancia e diarrea', parassiti: 'hai dolori alla pancia', fitoemoagglutinina: 'hai nausea e vomiti', cibo_guasto: 'hai nausea e crampi' }[m.tipo] || 'non stai bene');
  if (c.salute < 30) s.push('ti senti molto debole');
  else if (c.salute < 60) s.push('non ti senti in forma');
  return s.length ? s : ['stai bene'];
}
