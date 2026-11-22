// Prove delle vetrine aziendali (agenti/sponsor.mjs): profilo, link, logo, moderazione, statistiche.
//   node test/sponsor.test.mjs
import assert from 'node:assert/strict';
import { nuovoStato, giocatoreTerreno, giocatoreSponsor, vistaPubblica, logoDi } from '../agenti/motore.mjs';
import { sitoOk, logoOk, profiloPulito } from '../agenti/sponsor.mjs';

let n = 0; const ok = (c, m) => { assert.ok(c, m); n++; };
const T = Date.UTC(2026, 10, 23, 9);
const MOD = 'Boris, Altro';
const png = 'data:image/png;base64,' + Buffer.from('finto png').toString('base64');

// 1) i link: solo https veri, niente IP, porte, utente:password
ok(sitoOk('www.miazienda.it') === 'https://www.miazienda.it' && sitoOk('https://shop.esempio.com/scarpe?x=1') === 'https://shop.esempio.com/scarpe?x=1', 'link buoni');
ok(sitoOk('http://miazienda.it') === null && sitoOk('https://1.2.3.4') === null && sitoOk('https://a:b@x.it') === null && sitoOk('https://x.it:8080') === null && sitoOk('javascript:alert(1)') === null && sitoOk('localhost') === null, 'link cattivi rifiutati');
ok(logoOk(png) === png && logoOk('data:image/svg+xml;base64,AAAA') === null && logoOk('https://x.it/a.png') === null && logoOk('data:image/png;base64,' + 'A'.repeat(50000)) === null, 'logo: solo immagini piccole png/jpg/webp');
const p = profiloPulito({ azienda: '<b>Acme</b>', prodotti: [{ nome: 'Scarpa', link: 'https://altro.it/x' }, { nome: 'Borsa', link: 'https://acme.it/borsa' }], sito: 'acme.it', codice: { testo: 'borgo 10!' } });
ok(p.azienda === 'b Acme /b'.replace(/ /g, ' ') || !/[<>]/.test(p.azienda), 'niente tag nei testi');
ok(p.prodotti[0].link === '' && p.prodotti[1].link === 'https://acme.it/borsa' && p.codice.testo === 'BORGO10', 'i link dei prodotti solo sul sito approvato; codice pulito');

// 2) serve un negozio finito
const s = nuovoStato(T);
ok(!giocatoreSponsor(s, 'Mara', { chiave: 'k-mara', azione: 'mia' }, T, MOD).ok, 'senza negozio niente vetrina');
giocatoreTerreno(s, 'Mara', { chiave: 'k-mara', azione: 'compra', lotto: 'lotto2', soldi: 99999 }, T);
giocatoreTerreno(s, 'Mara', { chiave: 'k-mara', azione: 'costruisci', tipo: 'negozio', genere: 'bar', soldi: 99999 }, T);
ok(!giocatoreSponsor(s, 'Mara', { chiave: 'k-mara', azione: 'mia' }, T, MOD).ok, 'col cantiere ancora aperto no');
s.terreni.lotto2.progetto.fatte = 54; s.terreni.lotto2.progetto.finito = T;

// 3) il proprietario invia: resta tutto nascosto finche' non approva un moderatore
let r = giocatoreSponsor(s, 'Mara', { chiave: 'k-mara', azione: 'invia', profilo: { azienda: 'Caffe\' Mara', slogan: 'Il caffe\' del borgo', sito: 'https://caffemara.it', codice: { testo: 'BORGO10', sconto: '10% sul primo ordine' }, logo: { tipo: 'immagine' }, prodotti: [{ nome: 'Miscela oro', icona: '☕', prezzo: '12 €', link: 'https://caffemara.it/oro' }] }, logoImg: png, colori: ['#112233', '#ffcc00'], mobili: ['bancone', 'tv', null, 'pianta'] }, T, MOD);
ok(r.ok && r.bozza.stato === 'attesa' && !r.approvato, 'inviata, in attesa');
ok(!giocatoreSponsor(s, 'Mara', { chiave: 'k-mara', azione: 'invia', profilo: { azienda: 'X', sito: 'http://x.it' } }, T, MOD).ok, 'link non https: no');
let v = vistaPubblica(s, T).vetrine.lotto2;
ok(v && !v.profilo && !v.cartellone && v.colori[0] === '#112233' && v.mobili[1] === 'tv' && logoDi(s, 'lotto2') === '', 'prima dell\'approvazione: solo colori e arredo, niente testi, link o logo');

// 4) moderazione: solo i nomi in MODERATORI, con la loro chiave
ok(!giocatoreSponsor(s, 'Mara', { chiave: 'k-mara', azione: 'coda' }, T, MOD).ok, 'Mara non e\' moderatrice');
ok(!giocatoreSponsor(s, 'Boris', { azione: 'coda' }, T, MOD).ok, 'senza chiave nessuno e\' moderatore');
giocatoreTerreno(s, 'Boris', { chiave: 'k-boris', azione: 'banca' }, T);   // Boris ha gia' la sua chiave nel gioco
ok(!giocatoreSponsor(s, 'Boris', { chiave: 'falsa', azione: 'coda' }, T, MOD).ok, 'chiave sbagliata: no');
ok(giocatoreSponsor(s, 'Boris', { chiave: 'k-boris', azione: 'moderatore' }, T, MOD).moderatore === true, 'Boris e\' moderatore');
const c = giocatoreSponsor(s, 'boris', { chiave: 'k-boris', azione: 'coda' }, T, MOD);
ok(c.ok && c.coda.length === 1 && c.coda[0].logo === png && c.coda[0].dominio === 'caffemara.it', 'la coda mostra profilo, dominio e logo');
ok(giocatoreSponsor(s, 'Boris', { chiave: 'k-boris', azione: 'approva', lotto: 'lotto2' }, T + 1000, MOD).ok, 'approvata');
v = vistaPubblica(s, T + 2000).vetrine.lotto2;
ok(v.profilo.azienda === 'Caffe\' Mara' && v.profilo.dominio === 'caffemara.it' && v.logoV && v.cartellone && logoDi(s, 'lotto2') === png, 'dopo: in vista per tutti, col logo');

// 5) una modifica aspetta, la versione approvata resta; il rifiuto ha il motivo
giocatoreSponsor(s, 'Mara', { chiave: 'k-mara', azione: 'invia', profilo: { azienda: 'Caffe\' Mara', slogan: 'Slogan nuovo', sito: 'https://caffemara.it' } }, T + 3000, MOD);
ok(vistaPubblica(s, T + 3000).vetrine.lotto2.profilo.slogan === 'Il caffe\' del borgo', 'la modifica in attesa non si vede');
giocatoreSponsor(s, 'Boris', { chiave: 'k-boris', azione: 'rifiuta', lotto: 'lotto2', motivo: 'Slogan troppo vago' }, T + 4000, MOD);
r = giocatoreSponsor(s, 'Mara', { chiave: 'k-mara', azione: 'mia' }, T + 5000, MOD);
ok(r.bozza.stato === 'rifiutata' && r.bozza.motivo === 'Slogan troppo vago' && r.approvato.profilo.slogan === 'Il caffe\' del borgo', 'rifiutata con il motivo, resta la vecchia');

// 6) statistiche: visite, clic sul sito, codici copiati (anche da chi non ha la chiave)
['visita', 'visita', 'clic', 'codice'].forEach(a => giocatoreSponsor(s, '', { azione: a, lotto: 'lotto2' }, T + 6000, MOD));
r = giocatoreSponsor(s, 'Mara', { chiave: 'k-mara', azione: 'mia' }, T + 7000, MOD);
ok(r.stat.visite === 2 && r.stat.clic === 1 && r.stat.codici === 1 && r.stat.giorni['2026-11-23'].visite === 2, 'statistiche contate per giorno');
ok(!giocatoreSponsor(s, '', { azione: 'clic', lotto: 'lotto4' }, T, MOD).ok, 'niente statistiche per vetrine inesistenti');

// segnalazioni: una a testa, il moderatore le vede
ok(giocatoreSponsor(s, 'Lia', { chiave: 'k-lia', azione: 'segnala', lotto: 'lotto2', motivo: 'link strano' }, T + 6500, MOD).ok && giocatoreSponsor(s, 'Lia', { chiave: 'k-lia', azione: 'segnala', lotto: 'lotto2' }, T + 6600, MOD).gia, 'una segnalazione a testa');
ok(giocatoreSponsor(s, 'Boris', { chiave: 'k-boris', azione: 'moderatore' }, T + 6700, MOD).attesa === 1 && giocatoreSponsor(s, 'Boris', { chiave: 'k-boris', azione: 'coda' }, T + 6700, MOD).approvati[0].segnalazioni[0].motivo === 'link strano', 'il moderatore vede la segnalazione');
// 7) il moderatore puo' togliere una vetrina in vista
ok(giocatoreSponsor(s, 'Boris', { chiave: 'k-boris', azione: 'togli', lotto: 'lotto2', motivo: 'segnalazione' }, T + 8000, MOD).ok && !vistaPubblica(s, T + 8000).vetrine.lotto2.profilo && logoDi(s, 'lotto2') === '', 'tolta: sparisce tutto');
console.log(`sponsor: ${n} controlli passati`);
