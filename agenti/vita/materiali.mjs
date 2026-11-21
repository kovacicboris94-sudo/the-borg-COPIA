// =====================================================================
//  VITA - MATERIALI
//  Ogni cosa che esiste nel borgo e' un materiale con proprieta' vere:
//  densita', calore specifico, energia alimentare, acqua contenuta,
//  quanto dura prima di andare a male. Valori da tabelle standard
//  (USDA FoodData Central per i cibi, manuali tecnici per il resto),
//  arrotondati.
//
//  kcal: energia metabolizzabile per kg (come sulle etichette).
//  acqua: frazione di acqua sul peso.
//  dura20: ore prima di andare a male a 20 gradi; Q10: quante volte
//  piu' veloce si guasta ogni 10 gradi in piu' (regola biologica).
// =====================================================================

export const MATERIALI = {
  // ---- acqua ----
  acqua: { nome: 'acqua', tipo: 'liquido', densita: 1000, c: 4186, kcal: 0, acqua: 1, unita: 'L' },

  // ---- cibi ----
  farina: { nome: 'farina di frumento', tipo: 'cibo', densita: 590, c: 1700, kcal: 3640, acqua: 0.12, dura20: 24 * 240, q10: 2,
    crudo: { digeribile: 0.7, rischio: 0.01, nota: 'la farina cruda si digerisce male' } },
  fagioli_secchi: { nome: 'fagioli secchi', tipo: 'cibo', densita: 780, c: 1600, kcal: 3330, acqua: 0.11, dura20: 24 * 365, q10: 2,
    crudo: { digeribile: 0.3, rischio: 0.9, malattia: 'fitoemoagglutinina', nota: 'crudi o poco cotti sono tossici (lectine): vanno bolliti almeno 10 minuti' } },
  fagioli_ammollati: { nome: 'fagioli ammollati', tipo: 'cibo', densita: 900, c: 3000, kcal: 1510, acqua: 0.6, dura20: 36, q10: 2.5,
    crudo: { digeribile: 0.3, rischio: 0.9, malattia: 'fitoemoagglutinina', nota: 'ancora tossici: vanno bolliti' } },
  fagioli_cotti: { nome: 'fagioli cotti', tipo: 'cibo', densita: 1000, c: 3300, kcal: 1270, acqua: 0.66, dura20: 30, q10: 2.5 },
  olio: { nome: 'olio d\'oliva', tipo: 'cibo', densita: 910, c: 1970, kcal: 8840, acqua: 0, dura20: 24 * 540, q10: 2 },
  sale: { nome: 'sale', tipo: 'minerale', formula: 'NaCl', densita: 2160, c: 880, kcal: 0, acqua: 0 },
  ciliegie: { nome: 'ciliegie', tipo: 'cibo', densita: 650, c: 3600, kcal: 630, acqua: 0.82, dura20: 72, q10: 2.5 },
  pesce: { nome: 'pesce crudo', tipo: 'cibo', densita: 1050, c: 3600, kcal: 1300, acqua: 0.75, dura20: 20, q10: 3,
    crudo: { digeribile: 1, rischio: 0.25, malattia: 'parassiti', nota: 'il pesce d\'acqua dolce crudo puo\' avere parassiti' } },
  pesce_cotto: { nome: 'pesce cotto', tipo: 'cibo', densita: 1000, c: 3200, kcal: 1620, acqua: 0.69, dura20: 60, q10: 2.5 },
  impasto: { nome: 'impasto di pane', tipo: 'cibo', densita: 1100, c: 2800, kcal: 2180, acqua: 0.47, dura20: 18, q10: 2.5,
    crudo: { digeribile: 0.6, rischio: 0.02 } },
  pane: { nome: 'pane', tipo: 'cibo', densita: 250, c: 2700, kcal: 2650, acqua: 0.36, dura20: 24 * 4, q10: 2 },
  uova: { nome: 'uova', tipo: 'cibo', densita: 1030, c: 3200, kcal: 1430, acqua: 0.76, dura20: 24 * 21, q10: 2,
    crudo: { digeribile: 0.9, rischio: 0.01, malattia: 'gastroenterite', nota: 'crude c\'e\' un piccolo rischio di salmonella' } },
  uova_cotte: { nome: 'uova sode', tipo: 'cibo', densita: 1030, c: 3200, kcal: 1430, acqua: 0.76, dura20: 24 * 5, q10: 2 },
  mele: { nome: 'mele', tipo: 'cibo', densita: 800, c: 3600, kcal: 520, acqua: 0.86, dura20: 24 * 20, q10: 2 },
  spinaci: { nome: 'spinaci', tipo: 'cibo', densita: 300, c: 3900, kcal: 230, acqua: 0.91, dura20: 72, q10: 2.5 },
  fave: { nome: 'fave fresche', tipo: 'cibo', densita: 700, c: 3500, kcal: 880, acqua: 0.72, dura20: 96, q10: 2.5 },
  grano: { nome: 'chicchi di grano', tipo: 'cibo', densita: 780, c: 1600, kcal: 3390, acqua: 0.12, dura20: 24 * 365, q10: 2,
    crudo: { digeribile: 0.4, rischio: 0, nota: 'il grano va macinato: crudo intero quasi non si digerisce' } },

  // ---- semi (si piantano; contano poco come cibo) ----
  semi_grano: { nome: 'semi di grano', tipo: 'seme', pianta: 'grano', densita: 780, c: 1600, kcal: 3390, acqua: 0.12 },
  semi_fave: { nome: 'semi di fava', tipo: 'seme', pianta: 'fave', densita: 800, c: 1600, kcal: 3410, acqua: 0.11 },
  semi_spinaci: { nome: 'semi di spinaci', tipo: 'seme', pianta: 'spinaci', densita: 600, c: 1600, kcal: 0, acqua: 0.1 },

  // ---- legno e fuoco ----
  rami: { nome: 'rami e legnetti', tipo: 'combustibile', formula: 'C6H10O5', densita: 450, c: 1700, acqua: 0.25, kcal: 0 },
  legna: { nome: 'legna da ardere', tipo: 'combustibile', formula: 'C6H10O5', densita: 650, c: 1700, acqua: 0.18, kcal: 0 },
  erba_secca: { nome: 'erba secca (esca)', tipo: 'combustibile', formula: 'C6H10O5', densita: 60, c: 1500, acqua: 0.1, kcal: 0 },
  carbone: { nome: 'carbone di legna', tipo: 'combustibile', formula: 'C', densita: 250, c: 1000, acqua: 0.03, kcal: 0, pci: 29.6e6 },
  cenere: { nome: 'cenere', tipo: 'minerale', densita: 600, c: 800, acqua: 0, kcal: 0 },

  // ---- minerali ----
  argilla: { nome: 'argilla', tipo: 'minerale', formula: 'Al2Si2O5(OH)4', densita: 1800, c: 920, acqua: 0.22, kcal: 0,
    nota: 'bagnata si modella; deve asciugare (giorni) prima di andare nel fuoco, altrimenti l\'acqua dentro diventa vapore e la spacca' },
  pietra: { nome: 'pietra', tipo: 'minerale', densita: 2600, c: 840, acqua: 0, kcal: 0 },
  calcare: { nome: 'pietra calcarea', tipo: 'minerale', formula: 'CaCO3', densita: 2700, c: 840, acqua: 0, kcal: 0 },
  calce_viva: { nome: 'calce viva', tipo: 'minerale', formula: 'CaO', densita: 3340, c: 750, acqua: 0, kcal: 0, pericolo: 'brucia la pelle, reagisce con l\'acqua scaldandosi' },
  calce_spenta: { nome: 'calce spenta', tipo: 'minerale', formula: 'Ca(OH)2', densita: 2210, c: 1180, acqua: 0, kcal: 0 },
  terracotta: { nome: 'terracotta', tipo: 'minerale', formula: 'Al2Si2O7', densita: 2000, c: 850, acqua: 0, kcal: 0 }
};

// Attrezzi e oggetti fatti: non si mangiano, si usano. kg = peso di un pezzo.
export const OGGETTI = {
  acciarino: { nome: 'acciarino e pietra focaia', kg: 0.15, usi: 2000, nota: 'acciaio battuto sulla selce: fa scintille a ~800 gradi che accendono un\'esca asciutta' },
  coltello: { nome: 'coltello', kg: 0.12 },
  lenza: { nome: 'lenza con amo', kg: 0.05, nota: 'per pescare nel laghetto' },
  pentola_cruda: { nome: 'pentola d\'argilla cruda', materiale: 'argilla', kg: 1.6, capacita: 3, fragile: true, nota: 'deve asciugare e poi cuocere sopra 550 gradi' },
  pentola: { nome: 'pentola di terracotta', materiale: 'terracotta', kg: 1.3, capacita: 3, c: 850, nota: 'tiene 3 litri; si mette sul fuoco' },
  ciotola_cruda: { nome: 'ciotola d\'argilla cruda', materiale: 'argilla', kg: 0.5, capacita: 0.6, fragile: true },
  ciotola: { nome: 'ciotola di terracotta', materiale: 'terracotta', kg: 0.4, capacita: 0.6, c: 850 },
  mattone_crudo: { nome: 'mattone crudo', materiale: 'argilla', kg: 3.2, nota: 'si usa anche crudo (si secca al sole), ma la pioggia lo scioglie' },
  mattone: { nome: 'mattone cotto', materiale: 'terracotta', kg: 2.7 },
  cappotto: { nome: 'cappotto di lana', kg: 1.8, clo: 0.8, nota: 'si porta addosso: d\'inverno fuori fa la differenza' },
  coperta: { nome: 'coperta di lana', kg: 1.5, clo: 1.5, nota: 'isola: dormire al freddo con una coperta e\' un\'altra cosa' }
};

export const nomeDi = id => (MATERIALI[id] || OGGETTI[id] || { nome: id }).nome;
export const eCibo = id => MATERIALI[id] && (MATERIALI[id].tipo === 'cibo' || MATERIALI[id].tipo === 'seme');

// Trova un materiale o un oggetto da come lo chiama un agente ("legna", "Pentola di terracotta", "pane"...).
export function cercaCosa(nome) {
  const n = String(nome || '').toLowerCase().trim().replace(/\s+/g, ' ');
  if (!n) return null;
  if (MATERIALI[n] || OGGETTI[n]) return n;
  const chiave = n.replace(/ /g, '_');
  if (MATERIALI[chiave] || OGGETTI[chiave]) return chiave;
  const tutti = [...Object.entries(MATERIALI), ...Object.entries(OGGETTI)];
  const esatto = tutti.find(([, v]) => v.nome.toLowerCase() === n); if (esatto) return esatto[0];
  const parz = tutti.find(([k, v]) => v.nome.toLowerCase().startsWith(n) || n.startsWith(k.replace(/_/g, ' ')));
  return parz ? parz[0] : null;
}
