// =====================================================================
//  VITA - FISICA
//  Costanti e leggi fisiche usate da tutto il resto: calore, passaggi di
//  stato dell'acqua, combustione, scambio termico, clima e sole.
//  Unita': SI (kg, m, s, J, W, gradi Celsius). Nessuna libreria.
//
//  I valori vengono da tabelle standard (CRC Handbook, manuali di
//  termotecnica, normali climatiche). Dove c'e' una semplificazione e'
//  scritto accanto, cosi' si sa sempre cosa e' vero e cosa e' stimato.
// =====================================================================

export const G = 9.81;                 // m/s^2, accelerazione di gravita'
export const SIGMA = 5.670e-8;         // W/(m^2 K^4), Stefan-Boltzmann
export const KELVIN = 273.15;
export const KCAL = 4184;              // J in una kilocaloria
export const PRESSIONE = 101325;       // Pa, al livello del mare (il borgo e' basso)

// ---- acqua ----
export const ACQUA = {
  c: 4186,                 // J/(kg K), calore specifico del liquido
  cGhiaccio: 2100,
  latenteEvap: 2.257e6,    // J/kg a 100 gradi
  latenteFus: 3.34e5,      // J/kg
  ebollizione: 100,        // gradi a 1 atm
  fusione: 0,
  densita: 1000            // kg/m^3
};

// Energia per portare m kg di una sostanza (calore specifico c) da t0 a t1, senza cambi di stato.
export const calore = (m, c, t0, t1) => m * c * (t1 - t0);

// Scambio termico per convezione (legge di Newton): potenza in W, positiva se il corpo cede calore.
export const perditaNewton = (h, area, tCorpo, tAria) => h * area * (tCorpo - tAria);

// Irraggiamento di un corpo grigio verso l'ambiente (W).
export const irraggiamento = (eps, area, tCorpo, tAmbiente) => eps * SIGMA * area * ((tCorpo + KELVIN) ** 4 - (tAmbiente + KELVIN) ** 4);

// ---- combustione del legno ----
// Potere calorifico inferiore del legno con umidita' w (frazione sul peso umido, 0..1).
// Legno secco ~18,5 MJ/kg; l'acqua contenuta va evaporata (2,44 MJ/kg a 25 gradi).
export const PCI_LEGNO_SECCO = 18.5e6;
export const pciLegno = w => Math.max(0, PCI_LEGNO_SECCO * (1 - w) - 2.44e6 * w);
// Sopra circa il 35% di umidita' un fuoco di legna non si mantiene da solo (il calore va tutto nell'evaporare).
export const UMIDITA_MAX_FUOCO = 0.35;
// Sotto il 15% l'esca prende da una scintilla; il legno stagionato all'aperto sta tra 15 e 25%.
export const UMIDITA_MAX_ESCA = 0.15;

// Temperature massime raggiungibili (gradi). Il limite non e' la chimica della fiamma
// (adiabatica ~1900) ma le perdite: all'aperto il calore scappa, in una camera chiusa no.
export const TEMPERATURA_MAX = {
  aperto: 800,        // fuoco da campo: 600-900
  pietra: 1000,       // forno o fornace chiusa in pietra/argilla
  mantice: 1250,      // con aria forzata (mantice): si fonde il rame (1085)
  carbone: 1300       // carbone di legna + mantice
};
// Quanta parte della potenza del fuoco arriva a una pentola appoggiata sopra.
export const RENDIMENTO = { aperto: 0.15, pietra: 0.35, mantice: 0.2 };

// Legna bruciata all'ora da un fuoco, in funzione della legna caricata (kg).
// Un fuoco da campo normale (3-5 kg di legna) ne brucia 1,5-3 kg/h. Fuoco piccolo, consumo piccolo.
export function consumoFuoco(kgCarico, umidita) {
  if (kgCarico <= 0) return 0;
  const base = 0.9 * Math.pow(kgCarico, 0.6);   // kg/h
  return base * (1 - Math.min(0.8, umidita));    // legna umida brucia piu' lenta
}

// ---- passaggi di stato dell'acqua in un recipiente ----
// Scalda un recipiente d'acqua con potenza P (W) per dt secondi, con perdite verso l'aria.
// Restituisce la nuova temperatura e quanta acqua e' evaporata (kg). Conserva l'energia.
export function scaldaAcqua({ kg, T, kgRecipiente = 0, cRecipiente = 800, area = 0.06 }, P, dt, tAria) {
  if (kg <= 0) return { T: tAria, evaporata: 0 };
  const C = kg * ACQUA.c + kgRecipiente * cRecipiente;   // capacita' termica J/K
  const perdite = perditaNewton(15, area * 3, T, tAria);  // pareti + coperchio aperto, h ~ 15 W/m^2K
  let E = (P - perdite) * dt;                              // energia netta J
  let T1 = T + E / C, evaporata = 0;
  if (T1 > ACQUA.ebollizione) {
    // oltre 100 gradi il calore in piu' fa bollire l'acqua: la temperatura resta 100
    const Ein = (T1 - ACQUA.ebollizione) * C;
    evaporata = Math.min(kg, Ein / ACQUA.latenteEvap);
    T1 = ACQUA.ebollizione;
  }
  return { T: T1, evaporata };
}

// Raffreddamento (o riscaldamento) passivo di un oggetto verso l'aria: esponenziale esatto.
// tau = m c / (h A). Restituisce la temperatura dopo dt secondi.
export function versoAria(T, tAria, kg, c, dt, h = 12, area = null) {
  const A = area || Math.max(0.005, 0.09 * Math.pow(Math.max(kg, 0.001), 2 / 3));   // superficie stimata (cibi e oggetti un po' piatti)
  const tau = (kg * c) / (h * A);
  return tAria + (T - tAria) * Math.exp(-dt / tau);
}

// ---- clima del borgo ----
// Il borgo sta (per il clima) alla latitudine di Roma. Normali climatiche indicative 1991-2020:
// temperatura media mensile (gradi), escursione giornaliera, pioggia mensile (mm) e giorni di pioggia.
export const LATITUDINE = 41.9, LONGITUDINE = 12.5;
export const CLIMA = {
  media: [8.0, 8.7, 11.1, 13.8, 18.0, 22.0, 24.9, 25.1, 21.4, 17.2, 12.2, 9.1],
  escursione: [10, 10, 11, 11, 12, 12, 13, 13, 12, 11, 9, 9],
  pioggiaMm: [67, 73, 58, 81, 53, 34, 19, 37, 73, 113, 115, 81],
  giorniPioggia: [8, 8, 8, 8, 6, 4, 2, 3, 6, 8, 10, 9],
  umidita: [75, 72, 70, 70, 68, 65, 62, 64, 68, 73, 77, 77],     // umidita' relativa media %
  vento: [2.6, 2.8, 2.9, 2.8, 2.6, 2.5, 2.6, 2.5, 2.3, 2.3, 2.4, 2.5]  // m/s medi
};

export function giornoDellAnno(ms) {
  const d = new Date(ms), inizio = Date.UTC(d.getUTCFullYear(), 0, 1);
  return Math.floor((ms - inizio) / 86400000) + 1;
}
// Ora solare locale (0-24): l'UTC spostato della longitudine. E' l'ora del sole, non quella dell'orologio.
export const oraSolare = ms => (((ms / 3600000) + LONGITUDINE / 15) % 24 + 24) % 24;

// Declinazione del sole, durata del giorno e altezza del sole (formule astronomiche standard, errore < 10 minuti).
export function sole(ms) {
  const n = giornoDellAnno(ms), fi = LATITUDINE * Math.PI / 180;
  const dec = 23.44 * Math.PI / 180 * Math.sin(2 * Math.PI * (284 + n) / 365);
  const cosW = -Math.tan(fi) * Math.tan(dec), w0 = Math.acos(Math.max(-1, Math.min(1, cosW)));
  const ore = 2 * w0 * 180 / Math.PI / 15;             // ore di luce
  const h = oraSolare(ms), angoloOra = (h - 12) * 15 * Math.PI / 180;
  const sinAlt = Math.sin(fi) * Math.sin(dec) + Math.cos(fi) * Math.cos(dec) * Math.cos(angoloOra);
  const altezza = Math.asin(sinAlt) * 180 / Math.PI;
  // alba e tramonto in ms (stesso giorno, ora solare -> UTC)
  const mezzanotteUtc = Math.floor(ms / 86400000) * 86400000;
  const alba = mezzanotteUtc + ((12 - ore / 2) - LONGITUDINE / 15) * 3600000;
  const tramonto = mezzanotteUtc + ((12 + ore / 2) - LONGITUDINE / 15) * 3600000;
  // irraggiamento al suolo con cielo sereno (W/m^2): costante solare attenuata dall'atmosfera
  const irr = altezza > 0 ? 1361 * Math.pow(0.7, Math.pow(1 / Math.max(0.05, sinAlt), 0.678)) * sinAlt : 0;
  return { altezza, oreLuce: ore, alba, tramonto, giorno: altezza > -0.83, irraggiamento: irr };
}

// Valore climatico interpolato tra i mesi (al giorno), cosi' non ci sono salti il primo del mese.
export function climaDelGiorno(ms, campo) {
  const d = new Date(ms), m = d.getUTCMonth(), g = d.getUTCDate();
  const giorniMese = new Date(Date.UTC(d.getUTCFullYear(), m + 1, 0)).getUTCDate();
  const f = (g - 0.5) / giorniMese - 0.5;               // -0.5..0.5 rispetto al centro del mese
  const a = CLIMA[campo][m], b = CLIMA[campo][(m + (f >= 0 ? 1 : 11)) % 12];
  return a + (b - a) * Math.abs(f);
}

// Temperatura dell'aria: media del giorno + scarto meteo, curva giornaliera con il minimo all'alba e il massimo verso le 15.
export function temperaturaAria(ms, scartoMeteo = 0, nuvole = 0) {
  const media = climaDelGiorno(ms, 'media') + scartoMeteo;
  const esc = climaDelGiorno(ms, 'escursione') * (1 - 0.6 * nuvole);   // con cielo coperto l'escursione si dimezza
  const h = oraSolare(ms);
  // curva: minimo alle 6, massimo alle 15 (seno asimmetrico)
  const fase = h >= 6 && h < 15 ? -Math.cos(Math.PI * (h - 6) / 9) : Math.cos(Math.PI * ((h - 15 + 24) % 24) / 15);
  return media + esc / 2 * fase;
}

// Pressione di vapore saturo (formula di Magnus, Pa) e temperatura di rugiada.
export const vaporeSaturo = T => 610.94 * Math.exp(17.625 * T / (T + 243.04));

// Evapotraspirazione di riferimento giornaliera (mm/giorno), formula di Hargreaves semplificata:
// serve a sapere quanta acqua perde il terreno delle aiuole.
export function evapotraspirazione(ms) {
  const T = climaDelGiorno(ms, 'media'), esc = climaDelGiorno(ms, 'escursione');
  const n = giornoDellAnno(ms);
  // radiazione extraterrestre a 42 gradi nord, in mm/giorno equivalenti: ~4,7 al solstizio d'inverno, ~17 a quello d'estate
  const ra = 4.7 + 12.3 * (1 - Math.cos(2 * Math.PI * (n + 10) / 365)) / 2;
  return Math.max(0.3, 0.0023 * ra * (T + 17.8) * Math.sqrt(esc));
}
