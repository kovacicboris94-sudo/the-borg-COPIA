// Il manuale del borgo: le cose che gli abitanti sanno usare, con le stesse posizioni del gioco.
// Ogni cosa: dove (null = piazza, altrimenti l'id della stanza in motore.mjs), posti (x, z dove ci si mette),
// minuti che ci vuole, icona per il fumetto, una riga per il manuale e fai(c) = cosa succede alla fine.
// c = { ag, stato, adesso, momento, compagno, nomeDi, luogoVicino }.
// Per insegnare una cosa nuova agli agenti basta aggiungerla qui.

const caso = l => l[Math.floor(Math.random() * l.length)];

// i pesci del Laghetto (src/borgo/attivita-piazza.js): peso = quanto e' facile, quando = solo in quel momento
const PESCI = [
  ['Carpa dorata', 'comune', 52, 20, 45], ['Pesce gatto', 'comune', 52, 25, 60], ['Persico sole', 'comune', 52, 10, 22], ['Alborella', 'comune', 52, 8, 15],
  ['Trota arcobaleno', 'non comune', 24, 25, 55], ['Luccio', 'non comune', 24, 40, 90], ['Koi bianca e rossa', 'non comune', 24, 30, 60],
  ['Koi drago', 'raro', 11, 40, 70], ['Pesce lanterna', 'raro', 11, 10, 20, 'notte'], ['Anguilla di luna', 'raro', 11, 50, 110, 'sera'],
  ['Pesce petalo', 'epico', 4, 15, 30, 'giorno'], ['Re del Laghetto', 'leggendario', 1.2, 90, 150], ['Vecchio stivale', 'curiosita', 5, 28, 34]
];
function pesca(c) {
  if (Math.random() < 0.2) return 'Hai pescato a lungo ma non ha abboccato niente.';
  const giorno = c.momento === 'mattina' || c.momento === 'pomeriggio';
  const ok = PESCI.filter(p => !p[5] || p[5] === c.momento || (p[5] === 'giorno' && giorno));
  let r = Math.random() * ok.reduce((s, p) => s + p[2], 0), p = ok[0];
  for (const q of ok) { r -= q[2]; if (r <= 0) { p = q; break; } }
  const cm = Math.round(p[3] + Math.random() * (p[4] - p[3]));
  const sec = c.ag.pescati || (c.ag.pescati = {}); sec[p[0]] = (sec[p[0]] || 0) + 1;
  const tot = Object.values(sec).reduce((s, n) => s + n, 0);
  return `Hai pescato: ${p[0]} (${p[1]}, ${cm} cm). In tutto hai preso ${tot} pesci di ${Object.keys(sec).length} specie diverse.`;
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
const partita = (nome, frasi) => c => `${nome}: ${caso(frasi)}`;

const LETTURE = [
  'L\'infinito di Giacomo Leopardi: "Sempre caro mi fu quest\'ermo colle, e questa siepe, che da tanta parte dell\'ultimo orizzonte il guardo esclude..."',
  'il Canto I dell\'Inferno di Dante: "Nel mezzo del cammin di nostra vita mi ritrovai per una selva oscura, che\' la diritta via era smarrita..."'
];

export const COSE = [
  { id: 'pesca', nome: 'Pesca', dove: null, luogo: 'Laghetto', min: 6, icona: '🎣', posti: [{ x: 28.1, z: 32 }, { x: 41.1, z: 24.5 }, { x: 47.8, z: 33.6 }],
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
  { id: 'cripta', nome: 'Cripta', dove: null, min: 15, icona: '⚔️', posti: [{ x: -35, z: 52 }],
    riga: 'dal Portale scendi a combattere il Re senza Luce, che ha rubato gli Starlight',
    fai: partita('Cripta del Re senza Luce', ['hai attraversato le sale e sconfitto il Re senza Luce!', 'sei arrivato fino al trono ma il Re senza Luce ti ha battuto.', 'i suoi servitori ti hanno respinto alla seconda sala.']) },
  { id: 'bici', nome: 'Bici', dove: null, min: 0, icona: '🚲', posti: [],
    riga: 'in piazza sali o scendi dalla bici: vai 3 volte piu\' veloce (entrando in un edificio scendi)' },
  { id: 'leggio', nome: 'Leggio', dove: 'biblioteca', min: 5, icona: '📖', posti: [{ x: 0, z: 4.9 }],
    riga: 'nella Biblioteca leggi una poesia', fai: c => 'Hai letto ' + LETTURE[(c.ag.letture = ((c.ag.letture || 0) + 1)) % LETTURE.length] },
  { id: 'scacchi', nome: 'Scacchi', dove: 'scacchi', min: 15, icona: '♞', posti: [{ x: -6.4, z: 1.8 }, { x: 6.4, z: 1.8 }],
    riga: 'nella Casa degli Scacchi: contro il computer, o contro un abitante che e\' gia\' al tavolo',
    fai: c => c.compagno ? c.risultato : caso(['Partita a scacchi contro il computer: hai vinto!', 'Partita a scacchi contro il computer: hai perso.', 'Partita a scacchi contro il computer: patta.']) },
  { id: 'paintball', nome: 'Paintball', dove: 'sala', min: 8, icona: '🎯', posti: [{ x: -23.6, z: 1 }], riga: 'nella Sala Giochi, a squadre',
    fai: partita('Paintball', ['la tua squadra ha vinto!', 'la tua squadra ha perso per un soffio.', 'sei stato il migliore della tua squadra, ma avete perso.']) },
  { id: 'kart', nome: 'Go-Kart', dove: 'sala', min: 8, icona: '🏎️', posti: [{ x: 23.8, z: 1 }], riga: 'nella Sala Giochi, corsa sulla pista',
    fai: c => `Go-Kart: sei arrivato ${1 + Math.floor(Math.random() * 6)}° su 6.` },
  { id: 'nascondino', nome: 'Nascondino', dove: 'sala', min: 8, icona: '🙈', posti: [{ x: -9.5, z: -9.4 }], riga: 'nella Sala Giochi, ti trasformi in un oggetto per nasconderti',
    fai: partita('Nascondino', ['nessuno ti ha trovato, hai vinto!', 'ti hanno trovato subito.', 'ti hanno scoperto proprio alla fine.']) },
  { id: 'fronte', nome: 'Fronte della Cometa', dove: 'sala', min: 8, icona: '🪖', posti: [{ x: 9.5, z: -9.4 }], riga: 'nella Sala Giochi, battaglia a squadre',
    fai: partita('Fronte della Cometa', ['la tua squadra ha conquistato il fronte!', 'la tua squadra ha perso.', 'pareggio, nessuno ha ceduto.']) },
  { id: 'belinverse', nome: 'Belinverse 2', dove: 'tcg', min: 10, icona: '🃏', posti: [{ x: 0, z: 10.6 }], riga: 'nella Sala TCG, gioco di carte contro il computer',
    fai: partita('Belinverse 2', ['hai vinto la partita a carte!', 'hai perso la partita a carte.']) }
];

export const cosaDi = nome => {
  const n = String(nome || '').toLowerCase().trim(); if (!n) return null;
  return COSE.find(c => c.nome.toLowerCase() === n || c.id === n) || COSE.find(c => n.includes(c.id) || n.includes(c.nome.toLowerCase()) || c.nome.toLowerCase().includes(n)) || null;
};

// le righe del manuale nel prompt (corte: ogni parola costa a ogni pensiero)
export const manuale = (nomeStanza) => `MANUALE DEL BORGO
- {"tipo":"usa","nome":"<cosa>"}: usi una cosa del borgo. Ci vai da solo (entrando o uscendo dagli edifici, anche con l'ascensore) e resti occupato qualche minuto; com'e' andata lo scopri al pensiero dopo. Mettila in fila alle altre azioni. Cose:
${COSE.map(c => `  ${c.nome}${c.min ? ` (${c.min} min)` : ''}: ${c.riga}`).join('\n')}
- Mercatino e negozi vendono a chi ha Starlight (la moneta del borgo, si guadagna giocando): tu non ne hai, ma puoi guardare e parlare con chi c'e'. I 15 piani della Torre sono ancora vuoti, in attesa di negozi.
- Le persone vere ti parlano con la chat: rispondi con "di" se sono vicine, con "scrivi" se sono lontane.`;
