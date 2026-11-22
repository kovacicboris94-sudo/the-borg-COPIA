// Il manuale del borgo: le cose che gli abitanti sanno usare, con le stesse posizioni del gioco.
// Ogni cosa: dove (null = piazza, altrimenti l'id della stanza in motore.mjs), posti (x, z dove ci si mette),
// minuti che ci vuole, icona per il fumetto, una riga per il manuale e fai(c) = cosa succede alla fine.
// c = { ag, stato, adesso, momento, compagno, nomeDi, luogoVicino }.
// Per insegnare una cosa nuova agli agenti basta aggiungerla qui.

import { NEGOZI, prodottoDi, REGOLE_NEGOZI } from './negozi.mjs';
import { disponibile, togliScorta, inTurno, ambulatorioAperto, durataVisita, visitaMedica, REGOLE_LAVORI } from './lavori.mjs';
import { VISITA, SPORTELLO } from './interni.mjs';

const caso = l => l[Math.floor(Math.random() * l.length)];

/* ---------- gli Starlight (la moneta del borgo) ---------- */
export const STARLIGHT_INIZIALI = 150;   // la dotazione di partenza; poi si guadagnano (pesca, giochi)
export const portafoglio = ag => { if (ag.starlight == null) ag.starlight = STARLIGHT_INIZIALI; return ag; };
const guadagna = (ag, n) => { portafoglio(ag).starlight += n; return n ? ` +${n} Starlight (ora ne hai ${ag.starlight}).` : ''; };
const oggi = ms => new Date(ms + 3600000).toISOString().slice(0, 10);   // il giorno (circa ora di Roma)
// i banchi del mercatino (prezzi dei mobili del gioco, src/borgo/coins-arredi.js, scontati come al mercatino)
// [nome, prezzo, larghezza, altezza, profondita, forma, colore, modello]: modello = id del mobile vero del gioco (B.ARREDI), il gioco lo disegna uguale a quello di casa; comprati finiscono nello zaino, con "metti" li posi in piazza
export const MERCE = {
  usato: [['Sedia', 28, 0.7, 1, 0.7, 'cubo', '#a0703f', 'sedia'], ['Pouf', 25, 0.8, 0.45, 0.8, 'cilindro', '#e89ab8', 'pouf'], ['Tavolino', 40, 1.2, 0.5, 1.2, 'cilindro', '#a0703f', 'tavolino'],
    ['Cassapanca', 65, 1.7, 0.6, 0.7, 'cubo', '#7a4f2e', 'cassapanca'], ['Tavolo da pranzo', 75, 2, 0.8, 1.1, 'cubo', '#a0703f', 'tavolo'], ['Poltrona', 85, 1.3, 1, 1.3, 'cubo', '#c8453b', 'poltrona'],
    ['Libreria', 105, 1.7, 2, 0.6, 'cubo', '#7a4f2e', 'libreria'], ['Acquario', 155, 1.4, 1.2, 0.7, 'cubo', '#7ec8e3', 'acquario'], ['Divano', 175, 2.5, 0.9, 1.1, 'cubo', '#3b6fc8', 'divano'], ['Cabinato arcade', 210, 1, 1.9, 0.9, 'cubo', '#7a4fb8', 'arcade']],
  luci: [['Vaso con fiori', 20, 0.6, 0.8, 0.6, 'cilindro', '#e89ab8', 'vaso'], ['Pianta grande', 35, 0.9, 1.6, 0.9, 'cono', '#4f9a4a', 'pianta'], ['Lampada da terra', 60, 0.6, 1.8, 0.6, 'cilindro', '#f2c94c', 'lampada'],
    ['Tappeto tondo', 70, 2.2, 0.2, 2.2, 'cilindro', '#e8873a', 'tappeto'], ['Fontana', 300, 2.4, 1.2, 2.4, 'cilindro', '#b9b0a2', 'fontana']]
};
// un mobile del gioco (id di B.ARREDI) -> la sua riga qui (i giocatori possono regalare solo questi)
export const mobileDi = id => [...MERCE.usato, ...MERCE.luci].find(m => m[7] === String(id || '')) || null;
// i mobili su cui ci si siede, e quanti posti hanno (come le "sedute" dei mobili di casa nel gioco)
export const SEDUTE = { poltrona: 1, divano: 2, sedia: 1, pouf: 1, cassapanca: 2 };
export const merceDi = nome => { const n = String(nome || '').toLowerCase().trim(); return [...MERCE.usato, ...MERCE.luci].find(m => m[0].toLowerCase() === n) || [...MERCE.usato, ...MERCE.luci].find(m => n && (m[0].toLowerCase().includes(n) || n.includes(m[0].toLowerCase()))) || null; };
function compra(banco) {
  return c => {
    const m = MERCE[banco].find(q => q === merceDi(c.richiesta));
    const elenco = MERCE[banco].map(q => q[0] + ' ' + q[1]).join(', ');
    if (!m) return `Al banco non hai detto cosa comprare (scrivilo in "testo"). In vendita: ${elenco}.`;
    const ag = portafoglio(c.ag);
    if (ag.starlight < m[1]) return `${m[0]} costa ${m[1]} Starlight ma ne hai solo ${ag.starlight}: guadagnane altri pescando o giocando.`;
    ag.starlight -= m[1]; const z = ag.zaino || (ag.zaino = {}); z[m[0]] = (z[m[0]] || 0) + 1;
    return `Hai comprato ${m[0]} per ${m[1]} Starlight (te ne restano ${ag.starlight}). E' nello zaino: con "metti" lo posi in piazza.`;
  };
}
function pescheria(c) {
  const ag = portafoglio(c.ag), sec = ag.secchio || [];
  if (!sec.length) return 'Il secchio e\' vuoto: prima vai a pescare.';
  const v = ag.venduto && ag.venduto.g === oggi(c.adesso) ? ag.venduto : (ag.venduto = { g: oggi(c.adesso), n: 0 });
  let tot = 0; const venduti = [];
  while (sec.length && v.n < 600) { const f = sec.shift(), pr = Math.max(1, Math.round(f.p * (0.85 + Math.random() * 0.3))); tot += pr; v.n += pr; venduti.push(f.n); }
  return `Hai venduto ${venduti.length} pesci alla Pescheria:` + guadagna(ag, tot) + (sec.length ? ' Per oggi la Pescheria non compra altro (massimo 600 Starlight al giorno).' : '');
}
const CARTE = {"C": ["Zati Zata", "Rennino Borsaiolo", "Melisso Satta", "Il Vigile della Fontana", "La Bancarellara", "Il Bimbo del Go-Kart", "La Pettegola della Panchina", "Il Custode delle Lanterne", "Luna delle Lanterne", "Super Marco Bros", "Il Rissoso del Paintball", "La Nonna del Forno", "Il Topo di Biblioteca", "Il Robivecchi del Mercatino", "Renna Aipizza", "Bimbo_Z l'Avventuriero", "Il Pigrone della Poltrona", "Il Burattinaio del Borgo", "La Pantera del Paintball", "La Banda della Fontana", "La Vipera del Mercatino", "Il Guastafeste della Sala Giochi", "La Mamma Apprensiva", "Il Fabbro del Borgo", "Il Re della Ruota Panoramica", "La Campionessa di Kart", "Il Collezionista di Laugh Tale", "La Signora dell'Arredo", "La Tigre del Paintball", "Il Rompiscatole della Chat", "Il Cavaliere della Cripta", "Il Bibliotecario del Borgo", "La Campionessa di Pesca", "Il Signore della Piazza", "La Capobanda del Borgo", "La Duchessa del Disordine", "La Contessa della Ruota", "Il Capitano del Laghetto", "Il Ladro di Carte", "Il Gigante del Borgo", "Il Branco della Piazza", "Il Colosso del Borgo", "Il Sasso del Laghetto", "Il Mattarello della Nonna", "Gli Occhiali da Sole del Borgo", "Lo Zaino del Viandante", "La Bici del Borgo", "Il Joystick dell'Arcade", "Lo Scudo del Paintball", "Il Telefonino del Borgo", "La Cesta del Mercatino", "La Canna da Pesca", "Le Scarpe da Corsa", "La Poltrona di Casa", "Il Palloncino di Vernice", "Il Portone della Cripta", "MA SEI SERIO?", "TOGLITI DI MEZZO", "ASPETTA UN ATTIMO", "VAI IN BORMIDA", "ME LA RIPRENDO, GRAZIE", "TI SEI DIMENTICATO QUALCOSA", "FATEVI DA PARTE", "NON MI SERVIVA", "PULIZIE DI PRIMAVERA", "TUTTI DIETRO!", "CAMBIO PROGRAMMA", "NON MI PRENDI!"], "R": ["Tobia il Collezionista", "Il Razzo del Go-Kart", "Il Guardiano del Belvedere", "Il Santo Patrono del Borgo", "Il Giocoliere della Fiera", "Il Cercatore di Tesori", "La Regina del Tavolo TCG", "Il Duca della Cripta", "Lo Sfasciacabinati", "Il Fulmine in Bici", "Er Poldo", "La Fortezza del Borgo", "L'Elmo del Cinereo", "Il Trofeo di Pesca", "Il Gettone della Sala Giochi", "Il Casco da Kart", "UN ATTIMO DI RESPIRO", "COL CAZZO!", "ERA MIA!", "SVUOTATE LE TASCHE"], "SR": ["Il Pescatore Tranquillo", "La Strega della Cripta", "Boris the Manager", "Il Veterano della Cripta", "Il Domatore di Cinerei", "Il Re Senza Luce", "L'Armatura del Re", "Il Go-Kart Corazzato", "UNA FIGURACCIA PLANETARIA"]};
function pacchetto(c) {
  const ag = portafoglio(c.ag), gratis = ag.pacchettoGratis !== oggi(c.adesso);
  if (!gratis && ag.starlight < 150) return `Il pacchetto gratis di oggi l'hai gia' preso e un altro costa 150 Starlight: ne hai ${ag.starlight}.`;
  if (gratis) ag.pacchettoGratis = oggi(c.adesso); else ag.starlight -= 150;
  const l = [caso(CARTE.C), caso(CARTE.C), caso(CARTE.C), caso(CARTE.C), caso(CARTE.R), Math.random() < 0.3 ? caso(CARTE.SR) : caso(CARTE.R)];
  const k = ag.carte || (ag.carte = {}); l.forEach(n => { k[n] = (k[n] || 0) + 1; });
  return `Hai aperto un pacchetto di Belinverse ${gratis ? 'gratis (uno al giorno)' : 'per 150 Starlight'}: ${l.join(', ')}. Ora hai ${Object.values(k).reduce((a, b) => a + b, 0)} carte.`;
}

// i pesci del Laghetto (src/borgo/attivita-piazza.js): peso = quanto e' facile, quando = solo in quel momento
export const PESCI = [
  ['Carpa dorata', 'comune', 52, 20, 45, 6], ['Pesce gatto', 'comune', 52, 25, 60, 7], ['Persico sole', 'comune', 52, 10, 22, 5], ['Alborella', 'comune', 52, 8, 15, 4],
  ['Trota arcobaleno', 'non comune', 24, 25, 55, 15], ['Luccio', 'non comune', 24, 40, 90, 18], ['Koi bianca e rossa', 'non comune', 24, 30, 60, 20],
  ['Koi drago', 'raro', 11, 40, 70, 40], ['Pesce lanterna', 'raro', 11, 10, 20, 45, 'notte'], ['Anguilla di luna', 'raro', 11, 50, 110, 40, 'sera'],
  ['Pesce petalo', 'epico', 4, 15, 30, 90, 'giorno'], ['Re del Laghetto', 'leggendario', 1.2, 90, 150, 260], ['Vecchio stivale', 'curiosita', 5, 28, 34, 1]
];
function pesca(c) {
  if (Math.random() < 0.2) return 'Hai pescato a lungo ma non ha abboccato niente.';
  const giorno = c.momento === 'mattina' || c.momento === 'pomeriggio';
  const ok = PESCI.filter(p => !p[6] || p[6] === c.momento || (p[6] === 'giorno' && giorno));
  let r = Math.random() * ok.reduce((s, p) => s + p[2], 0), p = ok[0];
  for (const q of ok) { r -= q[2]; if (r <= 0) { p = q; break; } }
  const cm = Math.round(p[3] + Math.random() * (p[4] - p[3]));
  const sec = c.ag.pescati || (c.ag.pescati = {}); sec[p[0]] = (sec[p[0]] || 0) + 1;
  const b = c.ag.secchio || (c.ag.secchio = []);
  if (b.length >= 20) return `Hai pescato: ${p[0]} (${p[1]}, ${cm} cm), ma il secchio e' pieno (20 pesci) e l'hai ributtato in acqua: vendili alla Pescheria.`;
  b.push({ n: p[0], p: p[5] }); 
  return `Hai pescato: ${p[0]} (${p[1]}, ${cm} cm). Nel secchio hai ${b.length} pesci: vendili alla Pescheria del Mercatino.`;
}

// dall'alto (ruota, telescopio) si vede tutta la piazza: chi c'e' e dove, e dove si e' costruito
function panorama(c) {
  const { stato, ag, adesso, nomeDi, luogoVicino } = c, chi = [];
  for (const a of Object.values(stato.agenti)) if (a !== ag && !a.stanza) chi.push(`${a.nome} vicino a ${luogoVicino(a).nome}`);
  const visti = new Map();
  stato.eventi.filter(e => e.chi && e.chi.indexOf('g:') === 0 && !e.stanza && e.tipo !== 'scrivi' && adesso - e.t < 15 * 60000).forEach(e => visti.set(e.chi, e));
  visti.forEach((e, id) => chi.push(`${nomeDi(stato, id)} (persona vera) vicino a ${luogoVicino(e).nome}`));
  const zone = {};
  stato.oggetti.forEach(o => { const n = luogoVicino(o).nome; zone[n] = (zone[n] || 0) + 1; });
  const z = Object.entries(zone).sort((a, b) => b[1] - a[1]).slice(0, 4).map(([n, k]) => `${k} vicino a ${n}`);
  return 'Dall\'alto vedi tutto il borgo. In piazza: ' + (chi.length ? chi.join('; ') : 'nessuno') + '. Cose costruite dagli abitanti: ' + (z.length ? z.join(', ') : 'nessuna') + '.';
}

// una partita a un minigioco: il risultato lo decide il caso (gli abitanti non hanno mani sul joystick)
// la cometa libera Starlight a chi gioca: 2 per partita, di piu' a chi vince (la prima frase e' la vittoria)
const partita = (nome, frasi, premio = 10) => c => { const i = Math.floor(Math.random() * frasi.length); return `${nome}: ${frasi[i]}` + guadagna(c.ag, i === 0 ? premio : 2); };

const LETTURE = [
  'L\'infinito di Giacomo Leopardi: "Sempre caro mi fu quest\'ermo colle, e questa siepe, che da tanta parte dell\'ultimo orizzonte il guardo esclude..."',
  'il Canto I dell\'Inferno di Dante: "Nel mezzo del cammin di nostra vita mi ritrovai per una selva oscura, che\' la diritta via era smarrita..."'
];

export const COSE = [
  { id: 'pesca', gioco: 'pesca', nome: 'Pesca', dove: null, luogo: 'Laghetto', min: 6, icona: '🎣', posti: [{ x: 28.1, z: 32 }, { x: 41.1, z: 24.5 }, { x: 47.8, z: 33.6 }],
    riga: 'sugli sgabelli del Laghetto peschi (di sera e di notte escono pesci rari)', fai: pesca },
  { id: 'ruota', nome: 'Ruota panoramica', dove: null, min: 4, icona: '🎡', posti: [{ x: 34, z: 5.9 }],
    riga: 'un giro in cabina: vedi dall\'alto tutto il borgo e chi c\'e\'', fai: panorama },
  { id: 'telescopio', nome: 'Telescopio', dove: 'tetto', min: 3, icona: '🔭', posti: [{ x: -47, z: 25.5 }],
    riga: 'sul tetto della Torre della Cometa: come la ruota', fai: panorama },
  { id: 'panchina', nome: 'Panchina', dove: null, min: 10, icona: '🪑', posti: [{ x: -2.4, z: 35.2 }, { x: 7.4, z: 35 }, { x: -6, z: 25.6 }, { x: 6, z: 25.6 }, { x: -4.5, z: 45.2 }, { x: 4.5, z: 45.2 }, { x: -12, z: 39 }, { x: 12, z: 39 }],
    riga: 'ti siedi a riposare intorno alla Fontana', fai: () => 'Ti sei seduto un po\' in panchina a riposare e a guardare chi passa.' },
  { id: 'cometa', nome: 'Storia della Cometa', dove: null, min: 2, icona: '📜', posti: [{ x: -33, z: 40 }],
    riga: 'il cartello del Cratere racconta come e\' nato il borgo',
    fai: () => 'Il cartello racconta: una notte una cometa si schianto\' qui e scavo\' il cratere. La sua roccia e\' piena di cristalli che brillano sempre, gli Starlight: diventarono la moneta del borgo. Non si staccano con le mani: la cometa ne libera uno quando qualcuno gioca, vince una sfida o aiuta il borgo.' },
  { id: 'cripta', gioco: 'cripta', nome: 'Cripta', dove: null, min: 15, icona: '⚔️', posti: [{ x: -35, z: 52 }],
    riga: 'dal Portale scendi a combattere il Re senza Luce, che ha rubato gli Starlight',
    fai: partita('Cripta del Re senza Luce', ['hai attraversato le sale e sconfitto il Re senza Luce!', 'sei arrivato fino al trono ma il Re senza Luce ti ha battuto.', 'i suoi servitori ti hanno respinto alla seconda sala.'], 30) },
  { id: 'bici', nome: 'Bici', dove: null, min: 0, icona: '🚲', posti: [],
    riga: 'in piazza sali o scendi dalla bici: vai 3 volte piu\' veloce (entrando in un edificio scendi)' },
  { id: 'leggio', nome: 'Leggio', dove: 'biblioteca', min: 5, icona: '📖', posti: [{ x: 0, z: 4.9 }],
    riga: 'nella Biblioteca leggi una poesia', fai: c => 'Hai letto ' + LETTURE[(c.ag.letture = ((c.ag.letture || 0) + 1)) % LETTURE.length] + bibliotecario(c) },
  { id: 'scacchi', gioco: 'scacchi', nome: 'Scacchi', dove: 'scacchi', min: 15, icona: '♞', posti: [{ x: -6.4, z: 1.8 }, { x: 6.4, z: 1.8 }],
    riga: 'nella Casa degli Scacchi: contro il computer, o contro un abitante che e\' gia\' al tavolo',
    fai: c => c.compagno ? c.risultato + guadagna(c.ag, /vinto/.test(c.risultato) ? 10 : 2) : partita('Partita a scacchi contro il computer', ['hai vinto!', 'hai perso.', 'patta.'])(c) },
  { id: 'paintball', gioco: 'paintball', nome: 'Paintball', dove: 'sala', min: 8, icona: '🎯', posti: [{ x: -23.6, z: 1 }], riga: 'nella Sala Giochi, a squadre',
    fai: partita('Paintball', ['la tua squadra ha vinto!', 'la tua squadra ha perso per un soffio.', 'sei stato il migliore della tua squadra, ma avete perso.']) },
  { id: 'kart', gioco: 'kart', nome: 'Go-Kart', dove: 'sala', min: 8, icona: '🏎️', posti: [{ x: 23.8, z: 1 }], riga: 'nella Sala Giochi, corsa sulla pista',
    fai: c => { const k = 1 + Math.floor(Math.random() * 6); return `Go-Kart: sei arrivato ${k}° su 6.` + guadagna(c.ag, k === 1 ? 10 : k <= 3 ? 5 : 2); } },
  { id: 'nascondino', gioco: 'nascondino', nome: 'Nascondino', dove: 'sala', min: 8, icona: '🙈', posti: [{ x: -9.5, z: -9.4 }], riga: 'nella Sala Giochi, ti trasformi in un oggetto per nasconderti',
    fai: partita('Nascondino', ['nessuno ti ha trovato, hai vinto!', 'ti hanno trovato subito.', 'ti hanno scoperto proprio alla fine.']) },
  { id: 'fronte', gioco: 'fronte', nome: 'Fronte della Cometa', dove: 'sala', min: 8, icona: '🪖', posti: [{ x: 9.5, z: -9.4 }], riga: 'nella Sala Giochi, battaglia a squadre',
    fai: partita('Fronte della Cometa', ['la tua squadra ha conquistato il fronte!', 'la tua squadra ha perso.', 'pareggio, nessuno ha ceduto.']) },
  { id: 'belinverse', gioco: 'belinverse', nome: 'Belinverse 2', dove: 'tcg', min: 10, icona: '🃏', posti: [{ x: 0, z: 10.6 }], riga: 'nella Sala TCG, gioco di carte contro il computer',
    fai: partita('Belinverse 2', ['hai vinto la partita a carte!', 'hai perso la partita a carte.']) },
  { id: 'bubble', gioco: 'bubble', cabinato: true, nome: 'Borg Bubble', dove: null, min: 0, icona: '🫧', posti: [], riga: 'il gioco del Cabinato arcade: si gioca a un cabinato posato in piazza (vai da solo al piu\' vicino)', fai: partita('Borg Bubble', ['hai finito tutti i livelli!', 'game over.']) },
  { id: 'pescheria', nome: 'Pescheria', dove: null, min: 1, icona: '🐟', posti: [{ x: -13.5, z: 6.9 }], riga: 'banco del Mercatino: vendi tutti i pesci del secchio (max 600 Starlight al giorno)', fai: pescheria },
  { id: 'usato', nome: 'Mobili usati', dove: null, min: 2, icona: '🛒', posti: [{ x: -6.5, z: 6.9 }], riga: 'banco del Mercatino, compri un mobile: metti il nome in "testo"', fai: compra('usato') },
  { id: 'luci', nome: 'Luci e decorazioni', dove: null, min: 2, icona: '💡', posti: [{ x: 6.5, z: 6.9 }], riga: 'banco del Mercatino, compri una decorazione: nome in "testo"', fai: compra('luci') },
  { id: 'pacchetto', nome: 'Pacchetto Belinverse', dove: 'tcg', min: 2, icona: '🎁', posti: [{ x: 8, z: 11 }], riga: 'dal venditore della Sala TCG: 6 carte, uno al giorno gratis, poi 150 Starlight', fai: pacchetto }
];

// in Biblioteca, se c'e' il bibliotecario in turno: ti consiglia la lettura giusta e ti annoi molto meno (corpo vero, agenti/vita)
function bibliotecario(c) {
  const chi = inTurno(c.stato, 'bibliotecario').filter(id => id !== c.ag.id)[0]; if (!chi) return '';
  const corpo = c.stato.vita && c.stato.vita.corpi[c.ag.id]; if (corpo && corpo.umano) corpo.umano.noia = Math.max(0, corpo.umano.noia - 0.25);
  return ` Te l'ha consigliata ${c.nomeDi(c.stato, chi)}, il bibliotecario: ti e' piaciuta molto.`;
}
// la visita dall'Ambulatorio: paga il ticket, la Dottoressa Ferri cura le malattie (agenti/lavori.mjs)
function visita(c) {
  const ag = portafoglio(c.ag), P = REGOLE_LAVORI.prezzoVisita;
  if (ag.starlight < P) return `La visita costa ${P} Starlight e ne hai solo ${ag.starlight}: la Dottoressa ti ha dato solo un consiglio.`;
  ag.starlight -= P;
  return visitaMedica(c.stato, c.ag.id, c.adesso) + ` Hai pagato il ticket di ${P} Starlight.`;
}
COSE.push({ id: 'visita', nome: 'Visita medica', dove: 'ambulatorio', min: REGOLE_LAVORI.visitaMin, minuti: durataVisita, icona: '🩺', posti: [VISITA],
  aperto: (stato, adesso) => (ambulatorioAperto(adesso) ? null : 'l\'Ambulatorio e\' chiuso: la Dottoressa Ferri riceve dal lunedi\' al sabato, 8-13 e 15-19'),
  riga: `nell'Ambulatorio la Dottoressa Ferri ti visita e ti cura (${REGOLE_LAVORI.prezzoVisita} Starlight; lun-sab 8-13 e 15-19; ${REGOLE_LAVORI.visitaMin} minuti, ${REGOLE_LAVORI.visitaConSegretarioMin} se c'e' il segretario)`, fai: visita });
COSE.push({ id: 'sportello', nome: 'Sportello della banca', dove: 'banca', min: 2, icona: '🏦', posti: [SPORTELLO], riga: 'dentro la Banca del Borgo: per mutui, prestiti e appartamenti usa le azioni "mutuo", "prestito", "appartamento" (ci vai da solo)',
  fai: c => `L'impiegata ti ha mostrato il conto: hai ${portafoglio(c.ag).starlight} Starlight.` });

// comprare al bancone dei negozi (Caffetteria, Forno, Fioraio): prezzo di listino, va nello zaino.
// Se al bancone c'e' qualcuno al lavoro, a lui va la sua parte, come per una vendita.
function compraAlBancone(id) {
  return c => {
    const neg = NEGOZI.find(q => q.id === id), p = prodottoDi(neg, c.richiesta), ag = portafoglio(c.ag);
    if (!p) return `Al bancone non hai detto cosa comprare (scrivilo in "testo"). Listino: ${neg.prodotti.map(q => q[0] + ' ' + q[1]).join(', ')}.`;
    const manca = disponibile(c.stato, neg, p); if (manca) return `Niente da fare: ${manca}.`;
    if (ag.starlight < p[1]) return `${p[0]} costa ${p[1]} Starlight ma ne hai solo ${ag.starlight}.`;
    ag.starlight -= p[1]; togliScorta(c.stato, neg, p); const z = ag.zaino || (ag.zaino = {}); z[p[0]] = (z[p[0]] || 0) + 1;
    const t = Object.entries(c.stato.turni || {}).find(([, q]) => q.negozio === id), v = t && c.stato.agenti[t[0]];
    if (v && v !== ag) { const g = Math.max(1, Math.round(p[1] * REGOLE_NEGOZI.quota)); portafoglio(v).starlight += g; t[1].vendite = (t[1].vendite || 0) + 1; t[1].guadagno = (t[1].guadagno || 0) + g; }
    return `Hai comprato ${p[0]} per ${p[1]} Starlight (te ne restano ${ag.starlight}). E' nello zaino.`;
  };
}
NEGOZI.forEach(n => COSE.push({ id: n.id, nome: n.nome, dove: n.stanza || null, min: 1, icona: n.id === 'fioraio' ? '💐' : n.id === 'forno' ? '🥖' : '☕', posti: [n.cliente],
  riga: `bancone (dentro il negozio), compri: ${n.prodotti.map(p => p[0] + ' ' + p[1]).join(', ')} (nome in "testo")`, fai: compraAlBancone(n.id) }));

export const cosaDi = nome => {
  const n = String(nome || '').toLowerCase().trim(); if (!n) return null;
  return COSE.find(c => c.nome.toLowerCase() === n || c.id === n) || COSE.find(c => n.includes(c.id) || n.includes(c.nome.toLowerCase()) || c.nome.toLowerCase().includes(n)) || null;
};

// le righe del manuale nel prompt (corte: ogni parola costa a ogni pensiero)
export const manuale = (nomeStanza) => `MANUALE DEL BORGO
- {"tipo":"usa","nome":"<cosa>"}: usi una cosa del borgo. Ci vai da solo (entrando o uscendo dagli edifici, anche con l'ascensore) e resti occupato qualche minuto; com'e' andata lo scopri al pensiero dopo. Mettila in fila alle altre azioni. Cose:
${COSE.map(c => `  ${c.nome}${c.min ? ` (${c.min} min)` : ''}: ${c.riga}`).join('\n')}
- I MINIGIOCHI (Pesca, Scacchi, Belinverse 2, Go-Kart, Paintball, Nascondino, Fronte, Cripta, Borg Bubble) li giochi DAVVERO: seduto al gioco, ti chiedo le scelte una alla volta con domande corte (costano poco, circa un decimo di un pensiero) finche' la partita finisce; vinci o perdi per come giochi, e con l'esperienza migliori. Mentre giochi non pensi ad altro. In "testo" puoi dire: a Scacchi e Belinverse "aspetto un avversario" (un altro abitante puo' sedersi contro di te, se no giochi contro il computer); al Go-Kart la pista (Prato Lume, Canyon, Ghiaccio, Autodromo); al Nascondino "mi nascondo" o "cerco".
- STARLIGHT: la moneta del borgo. Ne parti con ${STARLIGHT_INIZIALI}, poi te li guadagni: vendendo i pesci alla Pescheria e giocando (2 a partita, 10 se vinci, 30 se batti il Re della Cripta). Li spendi al Mercatino e per i pacchetti di Belinverse. Quanti ne hai, cosa hai nel secchio e nello zaino te lo dico ogni volta.
- Si compra cosi': {"tipo":"usa","nome":"Mobili usati","testo":"Poltrona"}. In vendita (Starlight):
  Mobili usati: ${MERCE.usato.map(m => m[0] + ' ' + m[1]).join(', ')}
  Luci e decorazioni: ${MERCE.luci.map(m => m[0] + ' ' + m[1]).join(', ')}
- {"tipo":"metti","nome":"Poltrona","x":..,"z":..}: posi in piazza, entro 8 m da te, una cosa comprata (subito, senza costruire). Diventa un oggetto come gli altri: chi la smonta la rimette nello zaino di chi l'aveva comprata.
- MESTIERI: ai banconi di ${NEGOZI.map(n => n.nome).join(', ')} puoi fare un turno da venditore: {"tipo":"lavora","nome":"Forno","minuti":60} (da 15 a ${REGOLE_NEGOZI.turnoMaxMin}; ci vai da solo e resti al bancone; "nome":"smetti" per finire prima, e finisce anche se te ne vai). Un bancone, un venditore. Mentre lavori arrivano i clienti: abitanti del borgo, ognuno con il suo carattere, i suoi gusti e pochi soldi in tasca. Non comprano da soli: li devi convincere con {"tipo":"vendi","nome":"<prodotto>","prezzo":<Starlight>,"testo":"quello che gli dici"}. Conta cosa proponi, il prezzo (puoi alzarlo o scontarlo) e come glielo dici, secondo il carattere; ti ascoltano al massimo ${REGOLE_NEGOZI.tentativi} volte, poi se ne vanno. A te va meta' del prezzo. Capire chi compra cosa sta a te: ricordatelo.
- SEDERSI: sui mobili posati in piazza da cui ci si siede (Poltrona, Divano, Sedia, Pouf, Cassapanca) ti siedi con {"tipo":"usa","nome":"<id dell'oggetto>"} (es. "o12"): ci vai da solo e resti seduto 10 minuti.
- REGALI: le persone vere possono regalarti un mobile: lo posano in piazza ed e' tuo, come se l'avessi comprato (se qualcuno lo smonta torna nel tuo zaino).
- Le persone vere (giocatori) per ora sono poche: compra, arreda e gioca anche per conto tuo. I 15 piani della Torre sono ancora vuoti, in attesa di negozi.
- Le persone vere ti parlano con la chat: rispondi con "di" se sono vicine, con "scrivi" se sono lontane.`;
