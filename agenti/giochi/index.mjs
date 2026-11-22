// =====================================================================
//  I MINIGIOCHI GIOCATI DAVVERO DAGLI ABITANTI
//  Quando un abitante si siede a un gioco del borgo comincia una partita
//  vera: il gioco va avanti qui, nel codice, e a ogni momento di scelta
//  chiede all'abitante cosa fare con una domanda corta, fatta solo della
//  partita (costa molto meno di un pensiero normale). Si vince e si perde
//  per le scelte fatte, per l'esperienza e un po' per la fortuna.
//
//  Giochi a turni (Scacchi, Belinverse 2): le regole vere del gioco, ogni
//  mossa la sceglie l'abitante. Giochi d'azione (Go-Kart, Paintball,
//  Fronte, Nascondino, Cripta, Borg Bubble) e Pesca: l'abitante decide la
//  strategia nei momenti chiave e il codice simula l'azione.
//
//  Ogni gioco (un modulo qui accanto) ha:
//    nome, nuova(ctx) -> st (solo dati, si salva com'e'),
//    tocca(st) -> indice del giocatore che deve scegliere (-1 = nessuno),
//    domanda(st, i) -> { testo, opzioni: [..] }, applica(st, i, mossa) -> { ok, errore, attesa (secondi) },
//    auto(st, i) -> mossa (il computer, o l'istinto di chi non puo' pensare),
//    fine(st) -> null | { esiti: ['vinto'|'perso'|'patta'], testi: [..], premi: [..] }, vista(st) -> testo breve
// =====================================================================
import scacchi from './scacchi.mjs';
import belinverse from './belinverse.mjs';
import pesca from './pesca.mjs';
import { kart, paintball, nascondino, fronte, cripta, bubble } from './azione.mjs';

export const GIOCHI = { scacchi, belinverse, pesca, kart, paintball, nascondino, fronte, cripta, bubble };

export const REGOLE_GIOCHI = {
  mosseAlPasso: 6,         // quante mosse pensate in tutto in un passo del borgo (30 s): il resto al passo dopo
  mossePartitaPasso: 3,    // ...e per una sola partita
  maxMinuti: 75,           // una partita non dura di piu': chi e' ancora li' abbandona
  attesaAvversarioMin: 10, // chi aspetta un avversario al tavolo, poi gioca contro il computer
  maxTokens: 350,          // la risposta a una mossa e' corta
  errori: 2,               // dopo 2 risposte sbagliate di fila la mossa la fa l'istinto
  storico: 30              // partite finite tenute per il gioco (la scheda dell'abitante)
};

const testo = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f]+/g, ' ').trim().slice(0, max);
export const giocoDi = id => GIOCHI[id] || null;

// statistiche di un abitante a un gioco (partite, vinte, perse, patte, e quello che il gioco vuole tenere: elo, record...)
export function statDi(ag, gioco) {
  const t = ag.giochi || (ag.giochi = {});
  return t[gioco] || (t[gioco] = { g: 0, v: 0, p: 0, x: 0 });
}
// l'esperienza conta: da 0 (mai giocato) verso 1 (centinaia di partite), cresce in fretta all'inizio
export const esperienza = s => 1 - Math.exp(-(s ? s.g : 0) / 18);

// la riga per la percezione dell'abitante (gratis: solo numeri)
export function rigaGiochi(ag) {
  const t = ag.giochi || {}, l = Object.entries(t).filter(([, s]) => s.g).map(([id, s]) => `${(GIOCHI[id] || { nome: id }).nome} ${s.g} (vinte ${s.v}${s.x ? ', patte ' + s.x : ''}${s.elo ? ', Elo ' + s.elo : ''}${s.record ? ', record ' + s.record : ''})`);
  return l.length ? 'LE TUE PARTITE: ' + l.join('; ') + '.' : '';
}

/* ------------------------------------------------------------------ */
/*  cominciare                                                         */
/* ------------------------------------------------------------------ */
// ag si siede a un gioco. a = { richiesta } (il "testo" dell'azione: es. "aspetto un avversario", "contro Teo", "pista Canyon").
// aiuto = { nomeDi, evento, esito, annota } dal motore. Ritorna il testo dell'esito.
export function avviaPartita(stato, ag, giocoId, richiesta, adesso, aiuto) {
  const G = GIOCHI[giocoId]; if (!G) return null;
  const partite = stato.partite || (stato.partite = {});
  const r = String(richiesta || '').toLowerCase();
  // c'e' gia' qualcuno al tavolo che aspetta un avversario? (giochi a due: scacchi, carte)
  if (G.aDue) {
    const att = Object.values(partite).find(p => p.gioco === giocoId && p.attesaFino && p.g[1] === null && p.g[0] !== ag.id && (stato.agenti[p.g[0]] || {}).stanza === ag.stanza);
    if (att) {
      att.g[1] = ag.id; att.nomi[1] = ag.nome; att.attesaFino = null;
      att.st = G.nuova(contesto(stato, att, att.richiesta, adesso));
      ag.partita = att.id; ag.lavoro = lavoroDi(G, giocoId, att, adesso);
      log(att, adesso, `${ag.nome} si siede contro ${att.nomi[0]}.`);
      const lui = stato.agenti[att.g[0]]; if (lui) aiuto.esito(lui, `${G.nome}: ${ag.nome} si e' seduto a giocare con te`);
      return `${G.nome}: ti sei seduto contro ${att.nomi[0]}, la partita comincia.`;
    }
  }
  const id = 'p' + (stato.prossimaPartita = (stato.prossimaPartita || 0) + 1);
  const aspetta = G.aDue && /aspett|avversari|sfid|qualcuno/.test(r);
  const p = { id, gioco: giocoId, nome: G.nome, g: G.aDue ? [ag.id, aspetta ? null : 'computer'] : [ag.id], nomi: G.aDue ? [ag.nome, aspetta ? null : 'il computer'] : [ag.nome], richiesta: testo(richiesta, 60),
    inizio: adesso, prossima: adesso, mosse: 0, log: [], pensieri: {}, errori: {}, istinto: {}, costo: {}, st: null };
  if (aspetta) p.attesaFino = adesso + REGOLE_GIOCHI.attesaAvversarioMin * 60000;
  else p.st = G.nuova(contesto(stato, p, richiesta, adesso));
  partite[id] = p;
  ag.partita = id; ag.lavoro = lavoroDi(G, giocoId, p, adesso);
  if (aspetta) { log(p, adesso, `${ag.nome} aspetta un avversario.`); return `${G.nome}: ti sei seduto e aspetti un avversario (al massimo ${REGOLE_GIOCHI.attesaAvversarioMin} minuti, poi giochi contro il computer).`; }
  log(p, adesso, `${ag.nome} comincia: ${G.vista(p.st, 0)}`);
  return `${G.nome}: partita cominciata. ${G.vista(p.st, 0)}`;
}
const lavoroDi = (G, id, p, adesso) => ({ tipo: 'usa', id, nome: G.nome, icona: G.icona, partita: p.id, inizio: adesso, fine: adesso + REGOLE_GIOCHI.maxMinuti * 60000 });

function contesto(stato, p, richiesta, adesso) {
  const giocatori = p.g.map((id, i) => {
    const ag = stato.agenti[id];
    if (!ag) return { id, nome: p.nomi[i] || 'il computer', computer: true };
    const s = statDi(ag, p.gioco);
    return { id, nome: ag.nome, esperienza: esperienza(s), stat: Object.assign({}, s) };
  });
  const h = +new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/Rome', hour: '2-digit', hour12: false }).format(new Date(adesso)) % 24;
  return { giocatori, richiesta: String(richiesta || ''), momento: h < 6 ? 'notte' : h < 12 ? 'mattina' : h < 18 ? 'pomeriggio' : h < 22 ? 'sera' : 'notte', seme: (adesso ^ (stato.prossimaPartita * 2654435761)) >>> 0 };
}
function log(p, t, s) { p.log.push({ t, s: testo(s, 240) }); if (p.log.length > 14) p.log.shift(); }

/* ------------------------------------------------------------------ */
/*  giocare: un passo del borgo                                        */
/* ------------------------------------------------------------------ */
// aiuto = { pensaMossa(ag, richiesta) -> Promise<{pensiero, mossa} | null>, nomeDi, evento, esito, annota, guadagna, puoGiocare(ag) }
export async function passoPartite(stato, adesso, aiuto) {
  const partite = stato.partite || {};
  const conto = { n: 0 };
  for (const p of Object.values(partite)) {
    try { await avanzaPartita(stato, p, adesso, aiuto, conto); }
    catch (e) { log(p, adesso, 'Errore del gioco: ' + testo(e && e.message, 120)); chiudi(stato, p, adesso, aiuto, null, 'il gioco si e\' bloccato'); }
  }
}

async function avanzaPartita(stato, p, adesso, aiuto, conto) {
  const G = GIOCHI[p.gioco];
  // chi e' seduto e' ancora li'? (si e' alzato, e' svenuto, e' morto, ha finito il tempo)
  for (let i = 0; i < p.g.length; i++) {
    const id = p.g[i]; if (!id || id === 'computer') continue;
    const ag = stato.agenti[id];
    if (!ag || ag.morto || ag.partita !== p.id || !aiuto.puoGiocare(ag)) return chiudi(stato, p, adesso, aiuto, i, ag && ag.morto ? 'e\' morto' : 'si e\' alzato dal tavolo');
  }
  if (p.attesaFino) {
    if (adesso < p.attesaFino) return;
    p.attesaFino = null; p.g[1] = 'computer'; p.nomi[1] = 'il computer';
    p.st = G.nuova(contesto(stato, p, p.richiesta, adesso));
    log(p, adesso, `Non e' arrivato nessuno: ${p.nomi[0]} gioca contro il computer. ${G.vista(p.st, 0)}`);
  }
  let pensate = 0;
  for (let giro = 0; giro < 400; giro++) {
    const f = G.fine(p.st);
    if (f) return chiudi(stato, p, adesso, aiuto, null, null, f);
    if (p.prossima > adesso) return;
    const i = G.tocca(p.st);
    if (i < 0) return;
    const id = p.g[i], ag = stato.agenti[id];
    let mossa, pensiero = '', daIstinto = false;
    if (!ag) mossa = G.auto(p.st, i);
    else {
      if (conto.n >= REGOLE_GIOCHI.mosseAlPasso || pensate >= REGOLE_GIOCHI.mossePartitaPasso) return;   // si continua al prossimo passo
      const d = G.domanda(p.st, i);
      let r = null;
      if ((p.errori[id] || 0) < REGOLE_GIOCHI.errori) { conto.n++; pensate++; r = await aiuto.pensaMossa(ag, p, d, G); }
      if (r && r.mossa != null && String(r.mossa).trim() !== '') { mossa = r.mossa; pensiero = testo(r.pensiero, 300); }
      else { mossa = G.auto(p.st, i); daIstinto = true; }
    }
    const prima = G.vista(p.st, i);
    let ris = G.applica(p.st, i, mossa);
    if (!ris.ok && ag && !daIstinto) {
      p.errori[id] = (p.errori[id] || 0) + 1;
      p.ultimoErrore = { chi: id, testo: testo(ris.errore, 200) };
      if (p.errori[id] < REGOLE_GIOCHI.errori) continue;          // la prossima domanda dice cosa non andava
      mossa = G.auto(p.st, i); daIstinto = true; ris = G.applica(p.st, i, mossa);
    }
    if (!ris.ok) { mossa = G.auto(p.st, i); daIstinto = true; ris = G.applica(p.st, i, mossa); }
    if (!ris.ok) throw new Error('nessuna mossa valida (' + testo(ris.errore, 80) + ')');
    if (ag) { p.errori[id] = 0; p.ultimoErrore = null; if (daIstinto) p.istinto[id] = (p.istinto[id] || 0) + 1; }
    p.mosse++;
    if (pensiero) p.pensieri[id] = pensiero;
    const riga = ris.testo || '';
    if (riga) log(p, adesso, (ag ? ag.nome : 'Il computer') + ': ' + riga + (pensiero ? ` ("${testo(pensiero, 90)}")` : daIstinto && ag ? ' (d\'istinto)' : ''));
    // per l'archivio dell'esperimento: ogni mossa pensata, con il pensiero e cosa c'era da scegliere
    if (ag) mossaInArchivio(stato, { t: adesso, chi: id, partita: p.id, gioco: p.gioco, mossa: testo(mossa, 80), pensiero, istinto: daIstinto, prima: testo(prima, 300), esito: testo(riga, 200) });
    // il tempo della partita: ogni scelta porta avanti l'orologio del gioco (che puo' restare indietro di un passo del borgo)
    if (ris.attesa) p.prossima = Math.max(p.prossima, adesso - 30000) + ris.attesa * 1000;
  }
}
function mossaInArchivio(stato, m) { const l = stato.mosse || (stato.mosse = []); l.push(m); if (l.length > 300) l.splice(0, l.length - 300); }

// fine della partita: f = esito del gioco, oppure chi abbandona (indice) e perche'
function chiudi(stato, p, adesso, aiuto, abbandona, perche, f) {
  const G = GIOCHI[p.gioco];
  if (!f) {
    // chi abbandona perde (se la partita era cominciata); gli altri vincono a tavolino
    f = { esiti: p.g.map((_, i) => (i === abbandona ? 'perso' : p.st ? 'vinto' : 'patta')), testi: p.g.map((_, i) => (i === abbandona ? `hai lasciato la partita (${perche}): persa.` : p.st ? `${p.nomi[abbandona] || 'l\'avversario'} ${perche}: vinci a tavolino.` : `${p.nomi[abbandona]} ${perche}.`)), premi: p.g.map(() => 0) };
    if (!p.st) f.esiti = p.g.map(() => 'patta');
  }
  delete stato.partite[p.id];
  p.fine = adesso;
  for (let i = 0; i < p.g.length; i++) {
    const ag = stato.agenti[p.g[i]]; if (!ag) continue;
    const s = statDi(ag, p.gioco), e = f.esiti[i] || 'patta';
    if (p.st) { s.g++; if (e === 'vinto') s.v++; else if (e === 'perso') s.p++; else s.x++; }
    if (f.stat && f.stat[i]) Object.assign(s, f.stat[i]);
    const premio = f.premi ? f.premi[i] || 0 : 0;
    const contro = p.g.length > 1 ? (p.nomi[1 - i] ? ` contro ${p.nomi[1 - i]}` : '') : '';
    const r = `${G.nome}${contro}: ${f.testi[i] || e}` + (G.dopo && p.st ? G.dopo(p.st, i, ag) : '') + aiuto.guadagna(ag, premio) + (p.istinto[ag.id] ? ` (${p.istinto[ag.id]} mosse le hai fatte d'istinto, senza pensarci)` : '');
    if (ag.partita === p.id) {
      ag.partita = null;
      if (ag.lavoro && ag.lavoro.partita === p.id) ag.lavoro = null;
      ag.prossimoPensiero = Math.min(ag.prossimoPensiero, adesso + 20000);   // finita la partita ci si ripensa
    }
    aiuto.esito(ag, r); aiuto.annota(ag, adesso, r + (p.pensieri[ag.id] ? ` Ultimo pensiero in partita: "${testo(p.pensieri[ag.id], 160)}"` : ''));
    aiuto.evento(stato, { chi: ag.id, tipo: 'usato', testo: testo(r, 160), x: ag.x, z: ag.z });
  }
  log(p, adesso, 'Fine: ' + p.g.map((_, i) => `${p.nomi[i] || '-'} ${f.esiti[i]}`).join(', '));
  const st = stato.partiteFinite || (stato.partiteFinite = []);
  st.push(vistaPartita(stato, p, adesso, f));
  if (st.length > REGOLE_GIOCHI.storico) st.splice(0, st.length - REGOLE_GIOCHI.storico);
}

/* ------------------------------------------------------------------ */
/*  la domanda all'abitante                                            */
/* ------------------------------------------------------------------ */
export const SCHEMA_MOSSA = {
  type: 'object', additionalProperties: false, required: ['pensiero', 'mossa'],
  properties: { pensiero: { type: 'string' }, mossa: { type: 'string' } }
};
// il prompt della mossa: corto, solo la partita (chi sei, il gioco, la situazione, le scelte possibili)
export function promptMossa(ag, p, d, G) {
  const s = statDi(ag, p.gioco);
  const system = `Sei ${ag.nome}, un abitante del borgo di The Borg. Stai giocando davvero a ${G.nome}: le scelte sono tue e puoi vincere o perdere. ${G.regole || ''}
Rispondi solo con JSON: {"pensiero":"cosa pensi, breve","mossa":"la tua scelta"}.`;
  const err = p.ultimoErrore && p.ultimoErrore.chi === ag.id ? `\nATTENZIONE: la tua mossa di prima non andava bene: ${p.ultimoErrore.testo}. Scegline un'altra.` : '';
  const messaggio = `${d.testo}${d.opzioni && d.opzioni.length ? '\nSCELTE POSSIBILI:\n' + d.opzioni.join('\n') : ''}${d.formato ? '\nCOME RISPONDERE: ' + d.formato : ''}
Le tue partite a ${G.nome}: ${s.g} (vinte ${s.v}, perse ${s.p}${s.x ? ', patte ' + s.x : ''}).${err}`;
  return { system, messaggio };
}

/* ------------------------------------------------------------------ */
/*  per il gioco (la scheda dell'abitante) e per la percezione          */
/* ------------------------------------------------------------------ */
export function vistaPartita(stato, p, adesso, f) {
  const G = GIOCHI[p.gioco];
  return { id: p.id, gioco: p.gioco, nome: p.nome, icona: G.icona, g: p.g.slice(), nomi: p.nomi.slice(), inizio: p.inizio, fine: p.fine || null, mosse: p.mosse,
    attesa: !!p.attesaFino, stato: p.st ? testo(G.vista(p.st, 0), 300) : 'aspetta un avversario', tavola: p.st && G.tavola ? G.tavola(p.st) : null,
    log: p.log.slice(-8), pensieri: Object.assign({}, p.pensieri), esiti: f ? f.esiti : null };
}
export function vistaPartite(stato, adesso) {
  return { inCorso: Object.values(stato.partite || {}).map(p => vistaPartita(stato, p, adesso)), finite: (stato.partiteFinite || []).slice(-10) };
}
// cosa vede chi passa vicino a un tavolo: "Ada gioca a Scacchi contro il computer (mossa 12)"
export function descriviPartita(stato, ag) {
  const p = ag.partita && (stato.partite || {})[ag.partita]; if (!p) return '';
  if (p.attesaFino) return `aspetta un avversario a ${p.nome}`;
  const i = p.g.indexOf(ag.id), altro = p.nomi[1 - i];
  return `gioca a ${p.nome}${p.g.length > 1 && altro ? ' contro ' + altro : ''}`;
}
