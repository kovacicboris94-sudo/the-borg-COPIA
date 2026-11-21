// =====================================================================
//  VITA - CHIMICA
//  Reazioni vere, scritte con le formule. Il codice controlla da solo che
//  ogni reazione conservi gli atomi (e quindi la massa) e calcola dalle
//  masse molari quanti kg escono e quanta energia si libera o serve.
//  Le entalpie sono a 25 gradi e 1 atm (tabelle NIST/CRC), in kJ per mole
//  di reazione come e' scritta. Negativo = libera calore.
// =====================================================================

// Masse atomiche standard (IUPAC, g/mol)
export const MASSE_ATOMICHE = {
  H: 1.008, C: 12.011, N: 14.007, O: 15.999, Na: 22.990, Mg: 24.305, Al: 26.982, Si: 28.085,
  P: 30.974, S: 32.06, Cl: 35.45, K: 39.098, Ca: 40.078, Fe: 55.845, Cu: 63.546, Zn: 65.38, Sn: 118.71, Pb: 207.2
};

// "Ca(OH)2" -> { Ca:1, O:2, H:2 }. Gestisce parentesi annidate.
export function atomi(formula) {
  let i = 0;
  function gruppo() {
    const conta = {};
    while (i < formula.length && formula[i] !== ')') {
      let parte;
      if (formula[i] === '(') { i++; parte = gruppo(); i++; }
      else {
        const m = /^[A-Z][a-z]?/.exec(formula.slice(i));
        if (!m) throw new Error('formula non valida: ' + formula);
        if (!(m[0] in MASSE_ATOMICHE)) throw new Error('elemento sconosciuto: ' + m[0]);
        parte = { [m[0]]: 1 }; i += m[0].length;
      }
      const n = /^\d+/.exec(formula.slice(i)); const k = n ? +n[0] : 1; if (n) i += n[0].length;
      for (const [el, q] of Object.entries(parte)) conta[el] = (conta[el] || 0) + q * k;
    }
    return conta;
  }
  return gruppo();
}
export function massaMolare(formula) {
  return Object.entries(atomi(formula)).reduce((s, [el, n]) => s + MASSE_ATOMICHE[el] * n, 0);
}

// Le reazioni del borgo. "aria": serve ossigeno libero (true), non deve esserci (false), indifferente (null).
// "tMin": temperatura sotto la quale non avviene (o e' trascurabile). "ore": durata tipica a regime.
export const REAZIONI = {
  combustione_legno: {
    nome: 'combustione del legno', reagenti: { C6H10O5: 1, O2: 6 }, prodotti: { CO2: 6, H2O: 5 }, dH: -2828, tMin: 300, aria: true,
    nota: 'Il legno secco e\' per lo piu\' cellulosa (C6H10O5)n: 2828 kJ/mol sono 17,4 MJ/kg, come il potere calorifico misurato.'
  },
  carbonizzazione: {
    nome: 'carbonizzazione (carbone di legna)', reagenti: { C6H10O5: 1 }, prodotti: { C: 4, CO2: 1, CH4: 1, H2O: 3 }, dH: -150, tMin: 400, aria: false, ore: 24,
    nota: 'Scaldando il legno senza aria resta circa il 30% della massa come carbone. Entalpia stimata (la pirolisi reale e\' poco esotermica).'
  },
  combustione_carbone: {
    nome: 'combustione del carbone', reagenti: { C: 1, O2: 1 }, prodotti: { CO2: 1 }, dH: -393.5, tMin: 400, aria: true
  },
  // metano del gas di casa (fornello, caldaia). dH col vapore acqueo (potere calorifico inferiore): 50 MJ/kg
  combustione_metano: {
    nome: 'combustione del metano', reagenti: { CH4: 1, O2: 2 }, prodotti: { CO2: 1, H2O: 2 }, dH: -802.3, tMin: 580, aria: true
  },
  calcinazione: {
    nome: 'cottura del calcare (calce viva)', reagenti: { CaCO3: 1 }, prodotti: { CaO: 1, CO2: 1 }, dH: 178.3, tMin: 850, aria: null, ore: 24,
    nota: 'Serve una fornace chiusa: un fuoco all\'aperto non arriva a 850 gradi.'
  },
  spegnimento_calce: {
    nome: 'spegnimento della calce', reagenti: { CaO: 1, H2O: 1 }, prodotti: { 'Ca(OH)2': 1 }, dH: -65.2, tMin: 0, aria: null, ore: 1,
    nota: 'Scalda moltissimo: la calce viva a contatto con l\'acqua bolle.'
  },
  presa_malta: {
    nome: 'presa della malta di calce', reagenti: { 'Ca(OH)2': 1, CO2: 1 }, prodotti: { CaCO3: 1, H2O: 1 }, dH: -113.8, tMin: 2, aria: true, ore: 24 * 28,
    nota: 'La malta indurisce assorbendo CO2 dall\'aria: settimane, non minuti.'
  },
  cottura_argilla: {
    nome: 'cottura dell\'argilla (terracotta)', reagenti: { 'Al2Si2O5(OH)4': 1 }, prodotti: { Al2Si2O7: 1, H2O: 2 }, dH: 140, tMin: 550, aria: null, ore: 2,
    nota: 'La caolinite perde l\'acqua chimica sopra 550 gradi e diventa ceramica: non torna piu\' argilla.'
  },
  fermentazione: {
    nome: 'fermentazione alcolica', reagenti: { C6H12O6: 1 }, prodotti: { C2H5OH: 2, CO2: 2 }, dH: -67, tMin: 10, tMax: 35, aria: false, ore: 24 * 5,
    nota: 'La fanno i lieviti: sotto 10 gradi quasi si ferma, sopra 35 muoiono.'
  },
  respirazione: {
    nome: 'respirazione (il corpo che brucia zucchero)', reagenti: { C6H12O6: 1, O2: 6 }, prodotti: { CO2: 6, H2O: 6 }, dH: -2803, tMin: 0, aria: true,
    nota: '2803 kJ/mol sono 3,7 kcal per grammo di zucchero: le calorie del cibo sono energia chimica vera.'
  }
};

// Controlla che ogni elemento compaia in uguale numero a sinistra e a destra.
export function bilanciata(r) {
  const somma = lato => { const t = {}; for (const [f, n] of Object.entries(lato)) for (const [el, q] of Object.entries(atomi(f))) t[el] = (t[el] || 0) + q * n; return t; };
  const a = somma(r.reagenti), b = somma(r.prodotti), el = new Set([...Object.keys(a), ...Object.keys(b)]);
  for (const e of el) if (Math.abs((a[e] || 0) - (b[e] || 0)) > 1e-9) return { ok: false, elemento: e, sinistra: a[e] || 0, destra: b[e] || 0 };
  return { ok: true };
}

// Fa avvenire una reazione partendo da kg di un reagente (il primo, se non detto).
// Restituisce i kg consumati e prodotti (stessa massa totale) e l'energia in J (negativa = liberata).
export function reagisci(idReazione, kg, reagente = null) {
  const r = REAZIONI[idReazione]; if (!r) throw new Error('reazione sconosciuta: ' + idReazione);
  const chiave = reagente || Object.keys(r.reagenti)[0];
  const moliReazione = (kg * 1000 / massaMolare(chiave)) / r.reagenti[chiave];
  const kgDi = lato => Object.fromEntries(Object.entries(lato).map(([f, n]) => [f, moliReazione * n * massaMolare(f) / 1000]));
  return { consumati: kgDi(r.reagenti), prodotti: kgDi(r.prodotti), energiaJ: moliReazione * r.dH * 1000, moli: moliReazione };
}

// Per l'agente GOD e per il controllo delle invenzioni: la reazione puo' avvenire in queste condizioni?
export function puoAvvenire(idReazione, { temperatura, aria }) {
  const r = REAZIONI[idReazione]; if (!r) return { ok: false, motivo: 'reazione sconosciuta' };
  if (temperatura < r.tMin) return { ok: false, motivo: `serve almeno ${r.tMin} gradi (ce ne sono ${Math.round(temperatura)})` };
  if (r.tMax != null && temperatura > r.tMax) return { ok: false, motivo: `sopra ${r.tMax} gradi non avviene` };
  if (r.aria === true && aria === false) return { ok: false, motivo: 'serve aria (ossigeno)' };
  if (r.aria === false && aria === true) return { ok: false, motivo: 'deve avvenire senza aria' };
  return { ok: true };
}
