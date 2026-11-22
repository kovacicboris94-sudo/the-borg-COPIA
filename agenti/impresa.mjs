// =====================================================================
//  EDILBORGO, L'IMPRESA EDILE DEL BORGO (22/11/2026, Boris: "persone che
//  lavorano al cantiere, anche le demo e gli utenti possono cercare lavoro
//  al cantiere, quindi metti una societa' edile")
//  Chi apre un cantiere su un terreno paga Edilborgo (materiali + operai).
//  Edilborgo ogni mattina di lavoro assume gli operai tra gli abitanti demo
//  che cercano lavoro e li manda nei cantieri aperti: la squadra di ogni
//  cantiere e' fatta di persone vere del borgo, con il loro nome.
//  - Il cantiere va avanti al ritmo della squadra: squadra completa = ritmo
//    normale, mezza squadra = meta'. Nessuno = fermo.
//  - Giocatori e agenti si candidano come muratori (mestiere "muratore",
//    agenti/lavori.mjs): ogni loro ora di lavoro e' un'ora in piu' sul cantiere.
//  - Gli operai demo prendono la paga (30 S l'ora): li spendono poi nei negozi.
//  Tutto qui e' codice deterministico: nessun modello decide cosa succede.
// =====================================================================
import { CLIENTI } from './negozi.mjs';
import { PROGETTI, cantiereAperto } from './terreni.mjs';
import { MESTIERI } from './vita/mestieri.mjs';

export const IMPRESA = {
  nome: 'Edilborgo',
  titolo: 'Edilborgo · Impresa edile del Borgo',
  titolare: 'Rocco Malta',
  pagaOra: 30,              // la paga di un operaio (uguale al resto del borgo)
  ritmoMax: 1.5             // con piu' gente della squadra normale si va al massimo una volta e mezza piu' veloci
};

const FMT = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' });
const giornoRoma = ms => FMT.format(new Date(ms));
function hash(s) { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
const ruoli = ['capocantiere', 'muratore', 'manovale', 'gruista', 'carpentiere', 'imbianchino'];

// gli abitanti demo che oggi cercano lavoro, nell'ordine in cui Edilborgo li chiama (cambia ogni giorno)
export function inCercaDiLavoro(giorno) {
  return CLIENTI.slice().sort((a, b) => hash(giorno + a.demo) - hash(giorno + b.demo) || (a.demo < b.demo ? -1 : 1));
}

function statoImpresa(stato) {
  const I = stato.impresa || (stato.impresa = {});
  I.squadre = I.squadre || {}; I.paghe = I.paghe || {}; I.ore = I.ore || {};
  return I;
}

// Ogni passo: la mattina si assume, la sera si va a casa; restituisce gli eventi per la cronaca
export function passoImpresa(stato, adesso, dtS) {
  const I = statoImpresa(stato), ev = [];
  const aperti = Object.entries(stato.terreni || {}).filter(([, t]) => t.progetto && !t.progetto.finito);
  if (!cantiereAperto(adesso)) {
    if (Object.keys(I.squadre).length) { I.squadre = {}; ev.push({ tipo: 'sera', testo: `Edilborgo: fine della giornata, gli operai tornano a casa.` }); }
    return ev;
  }
  const g = giornoRoma(adesso);
  if (I.giorno !== g) { I.giorno = g; I.squadre = {}; }
  // i cantieri finiti o abbandonati non hanno piu' la squadra
  for (const id of Object.keys(I.squadre)) if (!aperti.some(([k]) => k === id)) delete I.squadre[id];
  const occupati = new Set(Object.values(I.squadre).flat().map(o => o.demo));
  const coda = inCercaDiLavoro(g).filter(c => !occupati.has(c.demo));
  for (const [id, t] of aperti) {
    const S = I.squadre[id] || (I.squadre[id] = []), serve = (PROGETTI[t.progetto.tipo] || { operai: 2 }).operai;
    while (S.length < serve && coda.length) {
      const c = coda.shift();
      S.push({ demo: c.demo, nome: c.nome, ruolo: S.length ? ruoli[1 + (hash(c.demo + id) % (ruoli.length - 1))] : ruoli[0], da: adesso });
      ev.push({ tipo: 'assunto', lotto: id, demo: c.demo, nome: c.nome, testo: `${c.nome} e' stato assunto da Edilborgo: oggi lavora nel cantiere di "${t.progetto.nome}".` });
    }
  }
  // la paga: 30 S l'ora a ogni operaio che lavora
  if (dtS > 0) for (const S of Object.values(I.squadre)) for (const o of S) {
    I.paghe[o.demo] = Math.round(((I.paghe[o.demo] || 0) + IMPRESA.pagaOra * dtS / 3600) * 100) / 100;
    I.ore[o.demo] = Math.round(((I.ore[o.demo] || 0) + dtS / 3600) * 1000) / 1000;
  }
  return ev;
}

// a che ritmo va il cantiere: la squadra di Edilborgo presente rispetto a quella che serve
export function ritmoCantiere(stato, id) {
  const t = (stato.terreni || {})[id]; if (!t || !t.progetto) return 0;
  const S = ((stato.impresa || {}).squadre || {})[id] || [], serve = (PROGETTI[t.progetto.tipo] || { operai: 2 }).operai;
  return Math.min(IMPRESA.ritmoMax, S.length / serve);
}

// gli abitanti demo che stanno lavorando adesso (non vanno a fare la spesa)
export const demoAlLavoro = stato => new Set(Object.values(((stato.impresa || {}).squadre) || {}).flat().map(o => o.demo));
// quanto ha guadagnato un demo lavorando (lo spende nei negozi)
export const risparmiDemo = (stato, demo) => Math.floor(((stato.impresa || {}).paghe || {})[demo] || 0);
export function spendeDemo(stato, demo, n) { const P = statoImpresa(stato).paghe; if (P[demo]) P[demo] = Math.max(0, Math.round((P[demo] - n) * 100) / 100); }

// la squadra di un cantiere per il gioco: gli operai di Edilborgo piu' i muratori in turno (agenti e persone vere)
export function squadraDi(stato, id, nomeDi) {
  const S = (((stato.impresa || {}).squadre || {})[id] || []).map(o => ({ nome: o.nome, demo: o.demo, ruolo: o.ruolo, tipo: 'demo' }));
  const M = MESTIERI.muratore;
  for (const [chi, c] of Object.entries((stato.vita && stato.vita.corpi) || {}))
    if (c.lavoro && c.lavoro.tipo === 'lavora' && c.lavoro.mestiere === 'muratore' && !c.morto && (c.lavoro.lotto || M.lotto) === id) S.push({ nome: nomeDi ? nomeDi(chi) : chi, id: chi, ruolo: 'muratore', tipo: 'agente' });
  for (const [chi, d] of Object.entries(stato.dipendenti || {})) if (d.mestiere === 'muratore' && d.lotto === id) S.push({ nome: d.nome || chi, id: chi, ruolo: 'muratore', tipo: 'giocatore' });
  return S;
}

export function vistaImpresa(stato) {
  const I = stato.impresa || {};
  return { nome: IMPRESA.nome, titolo: IMPRESA.titolo, titolare: IMPRESA.titolare, pagaOra: IMPRESA.pagaOra,
    operai: Object.values(I.squadre || {}).reduce((n, S) => n + S.length, 0),
    cantieri: Object.keys(I.squadre || {}).length,
    paghe: Object.entries(I.paghe || {}).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([d, s]) => [(CLIENTI.find(c => c.demo === d) || {}).nome || d, Math.round(s), Math.round((I.ore || {})[d] || 0)]) };
}
