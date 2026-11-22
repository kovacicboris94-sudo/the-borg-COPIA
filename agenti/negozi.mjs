// =====================================================================
//  NEGOZI E MESTIERI DEL BORGO
//  Tre negozi della piazza hanno un bancone: Caffetteria, Forno, Fioraio (dentro, dal 22/11/2026).
//  Chi fa un turno al bancone (un agente con "lavora", o una persona vera dal gioco)
//  vede arrivare i clienti: gli abitanti demo della piazza, ognuno con il suo carattere.
//  I clienti non comprano in automatico: decidono loro, secondo il carattere,
//  il prezzo, i gusti e le parole che usi per convincerli (regole + un po' di caso,
//  niente intelligenza artificiale: non costa nulla).
//  Chi vende prende meta' del prezzo in Starlight; l'altra meta' resta al negozio.
//  I prodotti sono cibo e fiori: per ora finiscono nello zaino (il motore della
//  "vita vera" potra' usarli piu' avanti come cibo, senza cambiare niente qui).
// =====================================================================
import { BANCONE } from './interni.mjs';

// Dal 22/11/2026 il bancone e' DENTRO il negozio (agenti/interni.mjs): stanza = l'interno, coordinate della stanza.
export const NEGOZI = [
  { id: 'caffetteria', nome: 'Caffetteria', stanza: 'caffetteria', ...BANCONE,
    prodotti: [['Caffe\'', 6, 'caffe'], ['Cappuccino', 9, 'caffe dolci'], ['Cornetto', 8, 'dolci'], ['Cioccolata calda', 10, 'dolci caldo'], ['Fetta di torta', 18, 'dolci'], ['Spremuta', 9, 'sano fresco']] },
  { id: 'forno', nome: 'Forno', stanza: 'forno', ...BANCONE,
    prodotti: [['Pane', 5, 'pane'], ['Focaccia', 9, 'pane salato'], ['Pizza al taglio', 14, 'salato'], ['Biscotti', 12, 'dolci'], ['Pane integrale', 7, 'pane sano'], ['Crostata', 22, 'dolci']] },
  { id: 'fioraio', nome: 'Fioraio', stanza: 'fioraio', ...BANCONE,
    prodotti: [['Rosa', 8, 'fiori regalo'], ['Girasole', 12, 'fiori'], ['Mazzo di fiori', 35, 'fiori regalo'], ['Pianta grassa', 20, 'piante'], ['Bonsai', 60, 'piante'], ['Lavanda', 10, 'fiori profumo']] }
];

// LE SCORTE: quello che c'e' davvero sugli scaffali (solo i tre negozi del borgo; nei negozi sui terreni
// la merce la prepara il proprietario). Ogni mattina alle 6 arriva una piccola consegna da fuori;
// il grosso lo fa chi ci lavora: il fornaio sforna il pane, il pasticcere i dolci, il fioraio compone i mazzi.
// Il caffe' e le bevande si fanno al momento: servono le mani di qualcuno (chi e' al bancone o il barista in turno).
// Il pane del giorno prima non si vende: al mattino quello avanzato va via (diventa pane secco per chi lo vuole).
export const SCORTE = {
  caffetteria: { alMomento: ['Caffe\'', 'Cappuccino', 'Cioccolata calda', 'Spremuta'], consegna: { Cornetto: 4, 'Fetta di torta': 2 }, freschi: ['Cornetto'] },
  forno: { consegna: { Pane: 6, Focaccia: 2, 'Pizza al taglio': 2, Biscotti: 3, 'Pane integrale': 2, Crostata: 1 }, freschi: ['Pane', 'Focaccia', 'Pizza al taglio', 'Pane integrale'] },
  fioraio: { consegna: { Rosa: 10, Girasole: 4, 'Mazzo di fiori': 1, 'Pianta grassa': 2, Bonsai: 1, Lavanda: 5 }, freschi: [] }
};
// cosa produce chi lavora, per ogni ora di turno (pezzi): stessi nomi dei prodotti
export const PRODUZIONE = {
  fornaio: { forno: { Pane: 16, Focaccia: 4, 'Pizza al taglio': 3, 'Pane integrale': 4 } },
  pasticcere: { caffetteria: { Cornetto: 10, 'Fetta di torta': 3 }, forno: { Biscotti: 4, Crostata: 1 } },
  fioraio: { fioraio: { 'Mazzo di fiori': 2, Rosa: 4 } }
};
export const SCORTE_MAX = 3;   // al massimo tre volte la consegna del giorno (non si accumula all'infinito)

export const negozioDi = nome => { const n = String(nome || '').toLowerCase().trim(); return NEGOZI.find(q => q.id === n || q.nome.toLowerCase() === n) || NEGOZI.find(q => n && (n.includes(q.id) || q.nome.toLowerCase().includes(n))) || null; };
export const prodottoDi = (neg, nome) => { const n = String(nome || '').toLowerCase().replace(/'/g, '').trim(); const l = neg.prodotti; return l.find(p => p[0].toLowerCase().replace(/'/g, '') === n) || l.find(p => n && (p[0].toLowerCase().replace(/'/g, '').includes(n) || n.includes(p[0].toLowerCase().replace(/'/g, '')))) || null; };

// I clienti: gli abitanti demo del gioco (stessi id e nomi di src/borgo/configurazione.js), con un carattere.
// vede = come appare a chi vende (indizi, non i numeri); ama = gusti dei prodotti; parole = cosa lo convince;
// odia = parole che lo fanno scappare; tirchio 0..1 = quanto conta il prezzo; voglia = quanto ha voglia di comprare;
// soldi = quanti Starlight ha in tasca; si/no = come risponde.
export const CLIENTI = [
  { demo: 'u1', nome: 'Luna', vede: 'sognatrice e romantica, guarda sempre le lanterne', ama: ['fiori', 'dolci', 'regalo'], parole: ['bello', 'bella', 'stelle', 'lanterne', 'sera', 'magico', 'speciale', 'regalo', 'profumo', 'romantico'], odia: ['sbrigati', 'veloce'], tirchio: 0.3, voglia: 0.35, soldi: 45,
    si: ['Che pensiero dolce, lo prendo!', 'Mi hai fatto sognare, va bene.'], no: ['Mmh, non mi ha fatto battere il cuore.', 'Forse un\'altra sera.'] },
  { demo: 'u2', nome: 'Tobia', vede: 'collezionista curioso, ama le storie strane', ama: ['dolci', 'piante'], parole: ['raro', 'unico', 'storia', 'collezione', 'nuovo', 'segreto', 'strano', 'antico', 'speciale'], odia: [], tirchio: 0.4, voglia: 0.3, soldi: 60,
    si: ['Una cosa rara? Allora e\' mia!', 'Bella storia, lo compro.'], no: ['Niente di speciale, mi spiace.', 'Ne ho gia\' visti mille cosi\'.'] },
  { demo: 'u3', nome: 'Mirtilla', vede: 'giardiniera del borgo, ama le piante e le cose sane', ama: ['fiori', 'piante', 'sano', 'fresco', 'pane'], parole: ['fresco', 'naturale', 'sano', 'pianta', 'fiori', 'terra', 'sole', 'giardino', 'integrale', 'biologico'], odia: ['industriale'], tirchio: 0.3, voglia: 0.4, soldi: 50,
    si: ['Fresco e naturale? Perfetto!', 'Questa la curo io, la prendo.'], no: ['Non mi sembra abbastanza fresco.', 'Preferisco qualcosa di piu\' naturale.'] },
  { demo: 'u4', nome: 'Ciro_88', vede: 'competitivo e sempre di corsa verso una partita', ama: ['salato', 'caffe'], parole: ['veloce', 'subito', 'energia', 'campione', 'vincere', 'forza', 'carica', 'partita', 'pronto'], odia: ['aspetta', 'lento', 'romantico'], tirchio: 0.5, voglia: 0.35, soldi: 35,
    si: ['Energia per la prossima partita, dammelo!', 'Vai, veloce, lo prendo!'], no: ['Non ho tempo, scusa.', 'Troppe chiacchiere, vado.'] },
  { demo: 'u5', nome: 'Nuvola', vede: 'distratta e allegra, si perde sempre', ama: ['dolci', 'caldo', 'fiori'], parole: ['divertente', 'allegro', 'colorato', 'sorpresa', 'buffo', 'ridere', 'coccola', 'caldo'], odia: [], tirchio: 0.2, voglia: 0.45, soldi: 30,
    si: ['Ahah, che bello, lo voglio!', 'Mi hai fatto ridere, va bene!'], no: ['Ehm... di cosa parlavamo?', 'Mi sono distratta, scusa, passo.'] },
  { demo: 'u7', nome: 'Kiri', vede: 'artista, guarda colori e forme', ama: ['fiori', 'piante', 'dolci'], parole: ['colore', 'colori', 'bello', 'arte', 'forma', 'disegno', 'elegante', 'luce', 'ispirazione'], odia: ['banale'], tirchio: 0.35, voglia: 0.35, soldi: 40,
    si: ['Che colori, mi ispira. Lo prendo.', 'Bello da disegnare, affare fatto.'], no: ['Non mi ispira, scusa.', 'Troppo banale per me.'] },
  { demo: 'u8', nome: 'Dario', vede: 'abitudinario, prende sempre le stesse cose alla Caffetteria', ama: ['caffe', 'pane'], parole: ['solito', 'classico', 'come sempre', 'tradizione', 'buono', 'forte', 'caffe'], odia: ['nuovo', 'strano', 'esperimento'], tirchio: 0.45, voglia: 0.45, soldi: 35,
    si: ['Il solito, grazie.', 'Classico, va bene cosi\'.'], no: ['Io prendo sempre la mia solita cosa.', 'Niente esperimenti, grazie.'] },
  { demo: 'u11', nome: 'Alba', vede: 'mattiniera e gentile', ama: ['caffe', 'pane', 'fresco'], parole: ['buongiorno', 'mattina', 'fresco', 'appena fatto', 'caldo', 'grazie', 'gentile'], odia: [], tirchio: 0.4, voglia: 0.4, soldi: 30,
    si: ['Che gentile, lo prendo volentieri.', 'Appena fatto? Allora si\'!'], no: ['Grazie lo stesso, sei gentile.', 'Oggi no, ma grazie.'] },
  { demo: 'u12', nome: 'Brio', vede: 'chiacchierone, vuole sentirsi ascoltato', ama: ['dolci', 'salato'], parole: ['amico', 'racconta', 'chiacchierare', 'insieme', 'compagnia', 'simpatico', 'storia'], odia: [], tirchio: 0.3, voglia: 0.35, soldi: 40,
    si: ['Mi piaci, dai, lo prendo!', 'Bella chiacchierata, affare fatto.'], no: ['Mmh, mi sembri un po\' freddo.', 'Ci penso mentre faccio un giro.'] },
  { demo: 'u13', nome: 'Cleo', vede: 'elegante e un po\' snob', ama: ['fiori', 'dolci', 'regalo'], parole: ['elegante', 'raffinato', 'qualita', 'migliore', 'esclusivo', 'pregiato', 'artigianale', 'lusso'], odia: ['economico', 'sconto', 'offerta'], tirchio: 0.05, voglia: 0.3, soldi: 120,
    si: ['Finalmente qualcosa di raffinato.', 'Qualita\'? Allora lo prendo.'], no: ['Troppo ordinario per me.', 'Non e\' all\'altezza.'] },
  { demo: 'u14', nome: 'Dante', vede: 'tirchio e brontolone, conta ogni Starlight', ama: ['pane'], parole: ['sconto', 'offerta', 'conviene', 'risparmi', 'economico', 'affare', 'regalo', 'prezzo'], odia: ['lusso', 'esclusivo'], tirchio: 0.95, voglia: 0.25, soldi: 25,
    si: ['Un affare? Va bene, va bene...', 'A questo prezzo si puo\' fare.'], no: ['Troppo caro! Ladri!', 'Con quei soldi mangio una settimana.'] },
  { demo: 'u15', nome: 'Elia', vede: 'sportivo, attento alla salute', ama: ['sano', 'fresco', 'pane'], parole: ['sano', 'leggero', 'energia', 'integrale', 'fresco', 'sport', 'naturale', 'vitamine'], odia: ['zucchero', 'pesante', 'fritto'], tirchio: 0.4, voglia: 0.35, soldi: 40,
    si: ['Sano e leggero, perfetto.', 'Buono per l\'allenamento, lo prendo.'], no: ['Troppo pesante per me.', 'Non fa per un atleta.'] },
  { demo: 'u16', nome: 'Fiamma', vede: 'golosa e impulsiva', ama: ['dolci', 'caldo'], parole: ['goloso', 'cioccolato', 'dolce', 'buonissimo', 'crema', 'zucchero', 'irresistibile', 'caldo'], odia: ['dieta', 'leggero'], tirchio: 0.25, voglia: 0.5, soldi: 35,
    si: ['Non resisto, dammelo!', 'Goloso? Allora si\'!'], no: ['Mmh, non mi fa venire l\'acquolina.', 'Oggi resisto. Forse.'] },
  { demo: 'u17', nome: 'Gigi', vede: 'timido, parla poco', ama: ['dolci', 'fiori'], parole: ['tranquillo', 'piano', 'piccolo', 'per te', 'senza fretta', 'calma'], odia: ['subito', 'compra', 'adesso', '!!'], tirchio: 0.4, voglia: 0.3, soldi: 30,
    si: ['...va bene, grazie.', 'Ok... lo prendo.'], no: ['...no, grazie.', 'Ehm... scusa, vado.'] },
  { demo: 'u18', nome: 'Ilaria', vede: 'premurosa, compra spesso regali per gli altri', ama: ['regalo', 'fiori', 'dolci'], parole: ['regalo', 'amica', 'mamma', 'pensiero', 'sorpresa', 'fare felice', 'per qualcuno', 'speciale'], odia: [], tirchio: 0.35, voglia: 0.4, soldi: 55,
    si: ['Perfetto come regalo, lo prendo!', 'Qualcuno sara\' felice, grazie.'], no: ['Non e\' il regalo giusto.', 'Cerco qualcosa di piu\' speciale.'] }
];

export const REGOLE_NEGOZI = {
  turnoMin: 60, turnoMaxMin: 240, turnoGiocatoreMin: 20, pingGiocatoreMs: 3 * 60000,
  attesaCliente: [2, 6],        // minuti tra un cliente e il prossimo
  pazienzaMin: 6,               // quanto aspetta un cliente al bancone
  tentativi: 2,                 // quante proposte ascolta prima di andarsene
  quota: 0.5,                   // la parte del prezzo che va a chi vende
  prezzoMin: 0.5, prezzoMax: 2.5 // il prezzo si sceglie tra la meta' e due volte e mezzo quello di listino
};

const caso = l => l[Math.floor(Math.random() * l.length)];
const norm = s => ' ' + String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9! ]+/g, ' ').replace(/\s+/g, ' ') + ' ';
const ha = (t, w) => t.includes(' ' + norm(w).trim() + ' ') || (w.length > 4 && t.includes(' ' + norm(w).trim()));

// Quanto e' probabile che il cliente compri. Restituisce { p, motivo } (motivo: perche' direbbe di no).
export function persuasione(cl, neg, prod, prezzo, testo, tentativo = 1) {
  const t = norm(testo), tag = prod[2].split(' ');
  let p = cl.voglia, motivo = 'gusti';
  if (tag.some(x => cl.ama.includes(x))) p += 0.25; else p -= 0.1;
  const buone = cl.parole.filter(w => ha(t, w)).length; p += Math.min(3, buone) * 0.12;
  const cattive = cl.odia.filter(w => w === '!!' ? /!!/.test(testo) : ha(t, w)).length; p -= cattive * 0.25;
  if (/ (ciao|buongiorno|buonasera|salve) /.test(t)) p += 0.05;
  if (ha(t, cl.nome.replace(/_.*/, ''))) p += 0.08;
  if (/ (grazie|per favore|prego) /.test(t)) p += 0.04;
  if (String(testo || '').trim().length < 12) p -= 0.15;          // una proposta di due parole non convince nessuno
  if (tentativo > 1 && !buone) p -= 0.08;                          // insistere senza argomenti stanca
  const r = prezzo / prod[1];
  if (r > 1) { p -= (r - 1) * (0.25 + cl.tirchio); if (r > 1.3) motivo = 'prezzo'; } else p += (1 - r) * cl.tirchio * 0.6;
  if (cattive) motivo = 'parole';
  return { p: Math.max(0.03, Math.min(0.95, p)), motivo };
}

// La risposta del cliente: compra o no, e cosa dice.
export function decide(cl, neg, prod, prezzo, testo, tentativo, rnd = Math.random) {
  if (prezzo > cl.soldi) return { compra: false, frase: `Non ho ${prezzo} Starlight, ne ho solo ${cl.soldi}.` };
  const { p, motivo } = persuasione(cl, neg, prod, prezzo, testo, tentativo);
  if (rnd() < p) return { compra: true, frase: caso(cl.si), p };
  const frase = motivo === 'prezzo' ? caso(['Troppo caro per me.', `${prezzo} Starlight? No, grazie.`]) : motivo === 'parole' ? caso(['Cosi\' non mi convinci proprio.', 'Mmh, non mi piace come me lo dici.']) : caso(cl.no);
  return { compra: false, frase, p };
}
