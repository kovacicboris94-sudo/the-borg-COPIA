// I giochi d'azione del borgo giocati dagli abitanti: Go-Kart, Paintball, Nascondino, Fronte della Cometa,
// la Cripta del Re senza Luce e Borg Bubble. Un abitante non puo' muovere il joystick 60 volte al secondo:
// decide la STRATEGIA nei momenti chiave (assetto e sorpassi, tattica di ogni round, dove e in cosa nascondersi,
// come affrontare ogni sala) e il codice simula l'azione. Contano la scelta giusta per la situazione
// (gli indizi sono nella domanda), l'esperienza (si migliora giocando) e un po' di fortuna.
// Nomi, piste, mappe, classi, armi, sale e oggetti sono quelli veri dei giochi (src/minigiochi/).

const caso = l => l[Math.floor(Math.random() * l.length)];
const rnd = (a, b) => a + Math.random() * (b - a);
const gauss = () => { let s = 0; for (let i = 0; i < 4; i++) s += Math.random(); return (s - 2) / 0.58; };
const sig = x => 1 / (1 + Math.exp(-x));
const lower = v => String(v || '').toLowerCase();
// trova l'opzione scritta nella risposta (per chiave o per nome)
function scelta(mossa, opzioni) {
  const m = lower(mossa);
  return opzioni.find(o => m === o.id) || opzioni.find(o => m.includes(o.id)) || opzioni.find(o => m.includes(lower(o.nome))) || null;
}
const elenco = l => l.map(o => `"${o.id}": ${o.nome}${o.desc ? ' (' + o.desc + ')' : ''}`);
const fmt = l => l.map(o => '"' + o.id + '"').join(', ');

/* =====================================================================
   GO-KART: 6 piloti, 2 o 3 giri. Assetto per la pista, poi a ogni giro una situazione di gara.
   ===================================================================== */
const PISTE = [
  { nome: 'Prato Lume', desc: 'classica, scorrevole', giri: 2, ideale: 'equilibrato' },
  { nome: 'Canyon', desc: 'tecnica, tante curve', giri: 2, ideale: 'curve' },
  { nome: 'Ghiaccio', desc: 'veloce, curvoni larghi', giri: 2, ideale: 'velocita' },
  { nome: 'Autodromo', desc: 'lungo, tornanti, 3 giri', giri: 3, ideale: 'equilibrato' }
];
const ASSETTI = [{ id: 'velocita', nome: 'velocita\' massima', desc: 'piu\' veloce sui rettilinei, scivola in curva' }, { id: 'curve', nome: 'tenuta in curva', desc: 'piu\' lento in rettilineo' }, { id: 'equilibrato', nome: 'equilibrato' }];
const PILOTI = ['Lampo', 'Ruggine', 'Biscotto', 'Saetta', 'Pistone'];
const SIT_KART = {
  curva: { t: x => `Sei dietro a ${x} all'ingresso di una curva stretta.`, op: [{ id: 'interno', nome: 'sorpasso all\'interno' }, { id: 'aspetta', nome: 'resta in scia e aspetta il rettilineo' }, { id: 'turbo', nome: 'usa il turbo (uno solo a gara)' }] },
  rettilineo: { t: x => `Lungo rettilineo: ${x} e' davanti a te di un soffio.`, op: [{ id: 'turbo', nome: 'usa il turbo (uno solo a gara)' }, { id: 'scia', nome: 'mettiti in scia e prova a passare' }, { id: 'calma', nome: 'tieni la tua linea' }] },
  difesa: { t: x => `${x} ti sta attaccando da dietro.`, op: [{ id: 'chiudi', nome: 'chiudi la traiettoria' }, { id: 'turbo', nome: 'usa il turbo e scappa (uno solo a gara)' }, { id: 'lascia', nome: 'lascialo passare e resta pulito' }] }
};
export const kart = {
  nome: 'Go-Kart', icona: '🏎️',
  regole: 'Corsa di Go-Kart contro 5 piloti del borgo. Tu decidi assetto e manovre, la guida la fa il codice.',
  nuova(ctx) {
    const r = lower(ctx.richiesta), pista = PISTE.find(p => r.includes(lower(p.nome))) || caso(PISTE), esp = ctx.giocatori[0].esperienza || 0;
    return { pista, esp, fase: 'assetto', giro: 0, turbo: true, assetto: null, t: [0, ...PILOTI.map(() => 0)], passo: [1, ...PILOTI.map(() => rnd(0.965, 1.035))], fine: false, eventi: [] };
  },
  tocca: st => (st.fine ? -1 : 0),
  _pos(st) { return st.t.map((t, i) => [t, i]).sort((a, b) => a[0] - b[0]).map(x => x[1]); },
  domanda(st) {
    if (st.fase === 'assetto') return { testo: `Go-Kart, pista ${st.pista.nome} (${st.pista.desc}), ${st.pista.giri} giri, 6 piloti. Prima della partenza scegli l'assetto del kart.`, opzioni: elenco(ASSETTI), formato: fmt(ASSETTI) };
    const pos = this._pos(st).indexOf(0) + 1, s = SIT_KART[st.sit];
    return { testo: `Giro ${st.giro} di ${st.pista.giri}, sei ${pos}° su 6 (assetto ${st.assetto}${st.turbo ? ', turbo ancora da usare' : ', turbo gia\' usato'}). ${s.t(st.rivale)}`, opzioni: elenco(s.op), formato: fmt(s.op) };
  },
  _giro(st) {
    // tempo di un giro: passo del pilota, assetto giusto per la pista, esperienza, un po' di caso
    const fit = st.assetto === st.pista.ideale ? 0.015 : st.assetto === 'equilibrato' ? 0.005 : -0.012;
    st.t = st.t.map((t, i) => t + 60 / (i === 0 ? 0.965 + st.esp * 0.07 + fit : st.passo[i]) * (1 + gauss() * 0.012));
  },
  _prepara(st) {
    st.giro++;
    if (st.giro > st.pista.giri) { st.fine = true; return; }
    const pos = this._pos(st), k = pos.indexOf(0);
    st.sit = k === 0 ? 'difesa' : k === 5 ? caso(['curva', 'rettilineo']) : caso(['curva', 'rettilineo', 'difesa']);
    st.rivale = PILOTI[(st.sit === 'difesa' ? pos[k + 1] : pos[k - 1]) - 1];
  },
  applica(st, i, mossa) {
    if (st.fase === 'assetto') {
      const a = scelta(mossa, ASSETTI); if (!a) return { ok: false, errore: 'scegli uno tra ' + fmt(ASSETTI) };
      st.assetto = a.id; st.fase = 'gara'; this._giro(st); this._prepara(st);
      return { ok: true, testo: `assetto ${a.nome}, si parte!`, attesa: 50 };
    }
    const s = SIT_KART[st.sit], o = scelta(mossa, s.op); if (!o) return { ok: false, errore: 'scegli uno tra ' + fmt(s.op) };
    let d = 0, t = o.nome;   // secondi guadagnati (positivo) o persi
    const bravo = st.esp, curve = st.assetto === 'curve', veloce = st.assetto === 'velocita';
    if (o.id === 'turbo') {
      if (!st.turbo) { d = -0.3; t += ': il turbo era gia\' finito!'; }
      else { st.turbo = false; d = st.sit === 'curva' ? (Math.random() < 0.4 ? -1.5 : 0.2) : st.sit === 'rettilineo' ? 2.2 : 1.6; t += st.sit === 'curva' && d < 0 ? ': in curva il turbo ti porta lungo, perdi tempo' : ': bel colpo di turbo'; }
    } else if (o.id === 'interno') { if (Math.random() < 0.35 + bravo * 0.35 + (curve ? 0.15 : 0) - (veloce ? 0.1 : 0)) { d = 1.8; t += ': riuscito!'; } else { d = -2.5; t += ': testacoda!'; } }
    else if (o.id === 'aspetta') d = 0.5;
    else if (o.id === 'scia') { d = Math.random() < 0.5 + bravo * 0.3 + (veloce ? 0.1 : 0) ? 1.2 : 0.2; t += d > 1 ? ': passato in scia' : ': non basta'; }
    else if (o.id === 'calma') d = 0.2;
    else if (o.id === 'chiudi') { if (Math.random() < 0.65 + bravo * 0.2) { d = 0.8; t += ': resta dietro'; } else { d = -1.2; t += ': contatto, perdi velocita\''; } }
    else if (o.id === 'lascia') d = -0.6;
    st.t[0] -= d; this._giro(st); this._prepara(st);
    return { ok: true, testo: t, attesa: st.fine ? 10 : 55 };
  },
  auto(st) { if (st.fase === 'assetto') return caso(ASSETTI).id; return st.sit === 'rettilineo' ? (st.turbo ? 'turbo' : 'scia') : st.sit === 'curva' ? 'aspetta' : 'chiudi'; },
  fine(st) {
    if (!st.fine) return null;
    const k = this._pos(st).indexOf(0) + 1;
    return { esiti: [k === 1 ? 'vinto' : 'perso'], testi: [`pista ${st.pista.nome}: sei arrivato ${k}° su 6.`], premi: [k === 1 ? 10 : k <= 3 ? 5 : 2] };
  },
  vista(st) { return `Go-Kart a ${st.pista.nome}` + (st.giro ? `, giro ${Math.min(st.giro, st.pista.giri)}, ${this._pos(st).indexOf(0) + 1}°` : ''); }
};

/* =====================================================================
   PAINTBALL: squadre, al meglio dei 3 round. Ogni round scegli la tattica (gli avversari hanno le loro
   abitudini: chi le osserva le sfrutta), poi a meta' round una decisione.
   ===================================================================== */
const TATTICHE = [{ id: 'centro', nome: 'attacco al centro' }, { id: 'sinistra', nome: 'aggiramento a sinistra' }, { id: 'destra', nome: 'aggiramento a destra' }, { id: 'difesa', nome: 'difesa della base' }];
const VANTAGGIO = (mia, loro) => {
  if (mia === 'difesa') return loro === 'centro' ? 0.9 : loro === 'difesa' ? 0 : -0.3;
  if (mia === 'centro') return loro === 'difesa' ? -0.8 : loro === 'centro' ? 0 : 0.5;
  // aggiramento: se loro vanno dall'altra parte o in difesa debole, si passa; se vengono dallo stesso lato e' scontro alla pari
  return loro === mia ? 0 : loro === 'difesa' ? 0.3 : loro === 'centro' ? -0.2 : 0.7;
};
const META = [{ id: 'attacca', nome: 'attacca ora' }, { id: 'aspetta', nome: 'resta al riparo e aspetta' }, { id: 'granata', nome: 'lancia la granata di vernice (una a partita)' }];
export const paintball = {
  nome: 'Paintball', icona: '🎯',
  regole: 'Paintball a squadre (tu e due bot contro tre bot), al meglio dei 3 round. 3 vite a testa. Tu decidi le tattiche.',
  nuova(ctx) { return { esp: ctx.giocatori[0].esperienza || 0, round: 1, punti: [0, 0], fase: 'tattica', abitudine: caso(TATTICHE).id, visti: [], granata: true, fine: false }; },
  tocca: st => (st.fine ? -1 : 0),
  domanda(st) {
    if (st.fase === 'tattica') return { testo: `Paintball, round ${st.round} (Blu ${st.punti[0]} - ${st.punti[1]} Rossi). Tu sei con i Blu.${st.visti.length ? ' Nei round prima i Rossi hanno fatto: ' + st.visti.join(', ') + '.' : ' Non sai ancora come giocano i Rossi.'} Che tattica dai alla squadra?`, opzioni: elenco(TATTICHE), formato: fmt(TATTICHE) };
    return { testo: `Round ${st.round}: ${st.situa}. Ti restano ${st.vite} vite${st.granata ? ' e la granata' : ''}.`, opzioni: elenco(META), formato: fmt(META) };
  },
  applica(st, i, mossa) {
    if (st.fase === 'tattica') {
      const t = scelta(mossa, TATTICHE); if (!t) return { ok: false, errore: 'scegli uno tra ' + fmt(TATTICHE) };
      st.loro = Math.random() < 0.6 ? st.abitudine : caso(TATTICHE).id;   // i Rossi tendono a rifare la stessa cosa
      st.mia = t.id; st.adv = VANTAGGIO(t.id, st.loro) - 0.3 + (st.esp - 0.3) * 0.8 + gauss() * 0.35;
      st.vite = st.adv > 0.4 ? 3 : st.adv > -0.2 ? 2 : 1;
      st.situa = st.adv > 0.3 ? 'state vincendo, restano due Rossi nascosti dietro i barili' : st.adv > -0.3 ? 'due contro due, si spara da dietro i ripari' : 'siete in difficolta\', i Rossi avanzano';
      st.fase = 'meta';
      return { ok: true, testo: t.nome, attesa: 45 };
    }
    const m = scelta(mossa, META); if (!m) return { ok: false, errore: 'scegli uno tra ' + fmt(META) };
    let d = 0, t = m.nome;
    if (m.id === 'granata') { if (st.granata) { st.granata = false; d = 0.6; } else { d = -0.2; t += ' (ma era gia\' usata)'; } }
    else if (m.id === 'attacca') d = st.adv > 0 ? 0.4 : -0.3 + st.esp * 0.4;
    else d = st.adv > 0 ? -0.1 : 0.3;
    const vinto = Math.random() < sig((st.adv + d) * 2.2);
    st.punti[vinto ? 0 : 1]++; st.visti.push(TATTICHE.find(x => x.id === st.loro).nome);
    t += vinto ? `: round vinto (i Rossi avevano scelto ${TATTICHE.find(x => x.id === st.loro).nome})` : `: round perso (i Rossi avevano scelto ${TATTICHE.find(x => x.id === st.loro).nome})`;
    if (st.punti[0] >= 2 || st.punti[1] >= 2) st.fine = true; else { st.round++; st.fase = 'tattica'; }
    return { ok: true, testo: t, attesa: 40 };
  },
  auto(st) { return st.fase === 'tattica' ? caso(TATTICHE).id : st.granata ? 'granata' : 'aspetta'; },
  fine(st) { if (!st.fine) return null; const v = st.punti[0] > st.punti[1]; return { esiti: [v ? 'vinto' : 'perso'], testi: [`${v ? 'la tua squadra ha vinto' : 'la tua squadra ha perso'} ${st.punti[0]} a ${st.punti[1]}.`], premi: [v ? 10 : 2] }; },
  vista(st) { return `Paintball, round ${st.round}, Blu ${st.punti[0]} - ${st.punti[1]} Rossi`; }
};

/* =====================================================================
   NASCONDINO TRASFORMISTA: il cortile vero (src/minigiochi/nascondino/regole.js). Se ti nascondi scegli
   in cosa trasformarti e dove; se cerchi scegli dove guardare. Tre giri di ricerca da 50 secondi.
   ===================================================================== */
const FORME = [
  { id: 'vaso', nome: 'Vaso di fiori', alto: 0.9 }, { id: 'cassa', nome: 'Cassa', alto: 0.9 }, { id: 'barile', nome: 'Barile', alto: 1.05 }, { id: 'panchina', nome: 'Panchina', alto: 0.85 },
  { id: 'lampione', nome: 'Lampione', alto: 3.1 }, { id: 'cespuglio', nome: 'Cespuglio', alto: 1 }, { id: 'zucca', nome: 'Zucca', alto: 0.6 }, { id: 'secchio', nome: 'Secchio', alto: 0.5 }, { id: 'sacco', nome: 'Sacco di grano', alto: 0.75 }
];
// dove ogni oggetto passa inosservato (vicino a cose simili)
const ZONE = [
  { id: 'case', nome: 'vicino alle case agli angoli', ok: ['barile', 'vaso', 'cassa', 'lampione'] },
  { id: 'bancarelle', nome: 'tra le bancarelle', ok: ['cassa', 'vaso', 'sacco', 'zucca'] },
  { id: 'fontana', nome: 'intorno alla fontana', ok: ['panchina', 'vaso', 'lampione'] },
  { id: 'alberi', nome: 'sotto gli alberi', ok: ['cespuglio', 'zucca'] },
  { id: 'pozzo', nome: 'vicino al pozzo', ok: ['secchio', 'barile'] },
  { id: 'carro', nome: 'dietro il carro', ok: ['sacco', 'barile', 'cassa'] },
  { id: 'muretto', nome: 'lungo il muretto', ok: ['vaso', 'zucca', 'panchina'] }
];
const AMICI_NASC = ['Pippo', 'Gemma', 'Olmo', 'Rita'];
export const nascondino = {
  nome: 'Nascondino', icona: '🙈',
  regole: 'Nascondino trasformista nel cortile della Sala Giochi: chi si nasconde si trasforma in un oggetto del borgo; un oggetto fuori posto si nota subito.',
  nuova(ctx) {
    const r = lower(ctx.richiesta), ruolo = /cerc/.test(r) ? 'cerca' : /nascond/.test(r) ? 'nascondi' : (Math.random() < 0.6 ? 'nascondi' : 'cerca');
    const st = { esp: ctx.giocatori[0].esperienza || 0, ruolo, giro: 0, fase: ruolo === 'nascondi' ? 'forma' : 'cerca', fine: false, trovati: [] };
    if (ruolo === 'cerca') st.nascosti = AMICI_NASC.map(n => { const z = caso(ZONE), f = Math.random() < 0.7 ? caso(z.ok) : caso(FORME).id; return { n, z: z.id, f, preso: false }; });
    return st;
  },
  tocca: st => (st.fine ? -1 : 0),
  domanda(st) {
    if (st.fase === 'forma') return { testo: 'Nascondino: ti nascondi tu! Hai 30 secondi. Scegli in cosa trasformarti e dove metterti, scritto cosi\': "forma, zona" (es. "barile, pozzo"). Due cercatori faranno 3 giri del cortile.', opzioni: ['FORME: ' + FORME.map(f => `"${f.id}" (${f.nome}, alto ${f.alto} m)`).join(', '), 'ZONE: ' + ZONE.map(z => `"${z.id}" (${z.nome})`).join(', ')], formato: '"forma, zona"' };
    if (st.fase === 'resta') return { testo: `Sei un ${FORME.find(f => f.id === st.forma).nome} ${ZONE.find(z => z.id === st.zona).nome}. Giro ${st.giro} di 3: ${st.notizia}`, opzioni: ['"resta": resti immobile', '"sposta <zona>": ti sposti in un\'altra zona (muoversi si vede!)'], formato: '"resta" oppure "sposta zona"' };
    return { testo: `Nascondino: cerchi tu! Si sono nascosti in 4 (${AMICI_NASC.join(', ')}), trasformati in oggetti. Giro ${st.giro + 1} di 3, ne hai trovati ${st.trovati.length}. ${st.indizio || ''} Scegli 3 zone dove guardare.`, opzioni: ['ZONE: ' + ZONE.map(z => `"${z.id}" (${z.nome}: ci stanno bene ${z.ok.join(', ')})`).join('; ')], formato: 'tre zone separate da virgole, es. "pozzo, carro, alberi"' };
  },
  _indizio(st) { const v = st.nascosti.filter(h => !h.preso); if (!v.length) return ''; const h = caso(v), z = Math.random() < 0.6 ? h.z : caso(ZONE).id; return `Senti un rumore ${ZONE.find(q => q.id === z).nome}.`; },
  applica(st, i, mossa) {
    const m = lower(mossa);
    if (st.fase === 'forma') {
      const f = FORME.find(x => m.includes(x.id)), z = ZONE.find(x => m.includes(x.id));
      if (!f || !z) return { ok: false, errore: 'scrivi una forma e una zona dell\'elenco, es. "barile, pozzo"' };
      st.forma = f.id; st.zona = z.id; st.fase = 'resta'; st.giro = 1; st.notizia = this._giro(st);
      return { ok: true, testo: `si trasforma in ${f.nome} ${z.nome}`, attesa: 50 };
    }
    if (st.fase === 'resta') {
      if (/spost/.test(m)) {
        const z = ZONE.find(x => m.includes(x.id) && x.id !== st.zona); if (!z) return { ok: false, errore: 'scrivi "sposta" e una zona diversa da quella dove sei' };
        if (Math.random() < 0.3 - st.esp * 0.15) { st.fine = true; st.preso = st.giro; return { ok: true, testo: `si sposta verso ${z.nome} ma lo vedono muoversi: trovato!` }; }
        st.zona = z.id; st.mosso = true;
      } else if (!/rest|ferm|immobil/.test(m)) return { ok: false, errore: 'scrivi "resta" oppure "sposta <zona>"' };
      st.giro++;
      if (st.giro > 3) { st.fine = true; return { ok: true, testo: 'resiste fino alla fine' }; }
      st.notizia = this._giro(st);
      if (st.fine) return { ok: true, testo: 'trovato al giro ' + st.preso };
      return { ok: true, testo: /spost/.test(m) ? 'si sposta senza farsi vedere' : 'resta immobile', attesa: 50 };
    }
    // cercatore: tre zone per giro
    const zone = ZONE.filter(z => m.includes(z.id)).slice(0, 3);
    if (!zone.length) return { ok: false, errore: 'scrivi fino a 3 zone dell\'elenco, separate da virgole' };
    const presi = [];
    for (const h of st.nascosti) if (!h.preso && zone.some(z => z.id === h.z)) {
      const adatto = ZONE.find(z => z.id === h.z).ok.includes(h.f);
      if (Math.random() < (adatto ? 0.4 : 0.75) + st.esp * 0.2) { h.preso = true; presi.push(`${h.n} (era ${FORME.find(f => f.id === h.f).nome})`); st.trovati.push(h.n); }
    }
    // chi non e' stato trovato a volte cambia posto
    st.nascosti.forEach(h => { if (!h.preso && Math.random() < 0.25) h.z = caso(ZONE).id; });
    st.giro++; st.indizio = this._indizio(st);
    if (st.giro >= 3 || st.trovati.length === 4) st.fine = true;
    return { ok: true, testo: `guarda ${zone.map(z => z.id).join(', ')}: ${presi.length ? 'trova ' + presi.join(', ') : 'non trova nessuno'}`, attesa: 50 };
  },
  // un giro dei cercatori: guardano dove ci sono piu' cose; un oggetto fuori posto o troppo alto si nota
  _giro(st) {
    const guardate = []; while (guardate.length < 3) { const z = caso(ZONE).id; if (!guardate.includes(z)) guardate.push(z); }
    if (guardate.includes(st.zona)) {
      const adatto = ZONE.find(z => z.id === st.zona).ok.includes(st.forma), f = FORME.find(x => x.id === st.forma);
      const p = (adatto ? 0.18 : 0.55) + (f.alto > 2 ? 0.15 : f.alto < 0.7 ? -0.06 : 0) - st.esp * 0.08;
      if (Math.random() < p) { st.fine = true; st.preso = st.giro; return 'i cercatori ti toccano: trovato!'; }
      return `i cercatori sono passati proprio ${ZONE.find(z => z.id === st.zona).nome}, ti hanno guardato ma non ti hanno riconosciuto!`;
    }
    return `i cercatori hanno guardato ${guardate.map(z => ZONE.find(q => q.id === z).nome).join(', ')}.`;
  },
  auto(st) {
    if (st.fase === 'forma') { const z = caso(ZONE); return caso(z.ok) + ', ' + z.id; }
    if (st.fase === 'resta') return 'resta';
    return ZONE.slice().sort(() => Math.random() - 0.5).slice(0, 3).map(z => z.id).join(', ');
  },
  fine(st) {
    if (!st.fine) return null;
    if (st.ruolo === 'nascondi') { const v = !st.preso; return { esiti: [v ? 'vinto' : 'perso'], testi: [v ? 'nessuno ti ha trovato, hai vinto!' : `ti hanno trovato al giro ${st.preso}.`], premi: [v ? 10 : 2] }; }
    const n = st.trovati.length, v = n >= 3;
    return { esiti: [v ? 'vinto' : 'perso'], testi: [`da cercatore ne hai trovati ${n} su 4${n ? ' (' + st.trovati.join(', ') + ')' : ''}${v ? ': hai vinto!' : '.'}`], premi: [v ? 10 : 2] };
  },
  vista(st) { return st.ruolo === 'nascondi' ? `Nascondino, si nasconde${st.forma ? ' (e\' un ' + FORME.find(f => f.id === st.forma).nome + ')' : ''}, giro ${st.giro}` : `Nascondino, cerca: trovati ${st.trovati.length} su 4`; }
};

/* =====================================================================
   FRONTE DELLA COMETA: Milizia della Cometa contro Predoni del Cratere, 4 contro 4 (regole.js vero).
   Scegli la classe, poi in tre fasi in zone diverse della mappa scegli cosa fa la tua squadra.
   ===================================================================== */
const CLASSI = [
  { id: 'assalto', nome: 'Assaltatore', desc: 'fucile d\'assalto Falco, va bene a ogni distanza', buone: ['piazza', 'spiazzo', 'vicoli', 'gallerie', 'campanile', 'cresta'], k: 0.15 },
  { id: 'incursore', nome: 'Incursore', desc: 'mitraglietta Vespa e passo svelto, da vicino', buone: ['vicoli', 'gallerie'], k: 0.45 },
  { id: 'guastatore', nome: 'Guastatore', desc: 'fucile a pompa Bufera, nei vicoli e dietro gli angoli', buone: ['vicoli', 'gallerie'], k: 0.55 },
  { id: 'tiratore', nome: 'Tiratore', desc: 'fucile di precisione Aquila, un colpo un avversario', buone: ['campanile', 'cresta'], k: 0.6 },
  { id: 'mitragliere', nome: 'Mitragliere', desc: 'mitragliatrice Tuono, caricatore enorme, passo pesante', buone: ['piazza', 'spiazzo'], k: 0.45 },
  { id: 'raffica', nome: 'Pattugliatore', desc: 'fucile a raffica Saetta, preciso da lontano', buone: ['piazza', 'spiazzo', 'campanile', 'cresta'], k: 0.3 }
];
const MAPPE_F = [
  { nome: 'Borgo Vecchio', desc: 'vicoli, case di pietra e un campanile', zone: [['vicoli', 'i vicoli stretti tra le case di pietra'], ['piazza', 'la piazzetta aperta'], ['campanile', 'il campanile e i tetti, si vede lontano']] },
  { nome: 'La Cava', desc: 'gallerie, uno spiazzo e una cresta di roccia', zone: [['gallerie', 'le gallerie buie della cava'], ['spiazzo', 'lo spiazzo aperto'], ['cresta', 'la cresta di roccia, si vede lontano']] }
];
const NEMICO = [
  { t: 'i Predoni avanzano in massa', giusta: 'tieni' }, { t: 'i Predoni sono trincerati e non si muovono', giusta: 'aggira' },
  { t: 'i Predoni sono sparpagliati', giusta: 'avanza' }, { t: 'i Predoni stanno aggirando un vostro compagno', giusta: 'copri' }
];
const AZIONI_F = [{ id: 'avanza', nome: 'avanza e spingi' }, { id: 'aggira', nome: 'aggira dal lato' }, { id: 'tieni', nome: 'tieni la posizione' }, { id: 'copri', nome: 'copri i compagni' }];
export const fronte = {
  nome: 'Fronte della Cometa', icona: '🪖',
  regole: 'Sparatutto a squadre 4 contro 4 (Scontro a squadre): tu sei nella Milizia della Cometa. Tu scegli classe e azioni, la mira la simula il codice.',
  nuova(ctx) { return { esp: ctx.giocatori[0].esperienza || 0, mappa: caso(MAPPE_F), fase: 'classe', zona: -1, punti: [0, 0], uccisioni: 0, morti: 0, fine: false }; },
  tocca: st => (st.fine ? -1 : 0),
  domanda(st) {
    if (st.fase === 'classe') return { testo: `Fronte della Cometa, mappa ${st.mappa.nome} (${st.mappa.desc}). Si combattera' in tre zone: ${st.mappa.zone.map(z => z[1]).join(', ')}. Scegli la tua classe.`, opzioni: elenco(CLASSI), formato: fmt(CLASSI) };
    const z = st.mappa.zone[st.zona];
    return { testo: `Fase ${st.zona + 1} di 3, nella zona: ${z[1]}. Punti: Milizia ${st.punti[0]} - ${st.punti[1]} Predoni. Sei ${st.classe.nome}. ${st.nemico.t}. Cosa fai?`, opzioni: elenco(AZIONI_F), formato: fmt(AZIONI_F) };
  },
  _fase(st) { st.zona++; st.nemico = caso(NEMICO); },
  applica(st, i, mossa) {
    if (st.fase === 'classe') { const c = scelta(mossa, CLASSI); if (!c) return { ok: false, errore: 'scegli uno tra ' + fmt(CLASSI) }; st.classe = c; st.fase = 'gioco'; this._fase(st); return { ok: true, testo: 'sceglie ' + c.nome, attesa: 30 }; }
    const a = scelta(mossa, AZIONI_F); if (!a) return { ok: false, errore: 'scegli uno tra ' + fmt(AZIONI_F) };
    const z = st.mappa.zone[st.zona][0], adatta = st.classe.buone.includes(z);
    const adv = (a.id === st.nemico.giusta ? 0.7 : -0.25) + (adatta ? st.classe.k : -st.classe.k) + (st.esp - 0.3) * 0.7 + gauss() * 0.4;
    const mie = Math.max(0, Math.round(4 + adv * 3 + gauss())), loro = Math.max(0, Math.round(4 - adv * 3 + gauss()));
    st.punti[0] += mie; st.punti[1] += loro;
    const mio = Math.max(0, Math.round(mie * rnd(0.15, 0.4) + (adatta ? 1 : 0) * Math.random())); st.uccisioni += mio; st.morti += Math.round(loro * rnd(0.1, 0.35));
    const t = `${a.nome} (${st.nemico.t}): la squadra fa ${mie} eliminazioni e ne subisce ${loro}; tu ne fai ${mio}`;
    if (st.zona >= 2) st.fine = true; else this._fase(st);
    return { ok: true, testo: t, attesa: 60 };
  },
  auto(st) { return st.fase === 'classe' ? 'assalto' : caso(AZIONI_F).id; },
  fine(st) {
    if (!st.fine) return null;
    const e = st.punti[0] > st.punti[1] ? 'vinto' : st.punti[0] < st.punti[1] ? 'perso' : 'patta';
    return { esiti: [e], testi: [`${e === 'vinto' ? 'la Milizia ha conquistato il fronte' : e === 'perso' ? 'hanno vinto i Predoni' : 'pareggio'} ${st.punti[0]} a ${st.punti[1]}; tu da ${st.classe ? st.classe.nome : 'soldato'}: ${st.uccisioni} eliminazioni, ${st.morti} volte a terra.`], premi: [e === 'vinto' ? 10 : 2] };
  },
  vista(st) { return `Fronte della Cometa a ${st.mappa.nome}, Milizia ${st.punti[0]} - ${st.punti[1]} Predoni`; }
};

/* =====================================================================
   LA CRIPTA DEL RE SENZA LUCE: sei sale vere della Cripta, con i loro nemici e i loro trucchi.
   Si sceglie l'arma, poi in ogni sala come affrontarla. 100 punti vita, 3 pozioni.
   ===================================================================== */
const ARMI_C = [
  { id: 'tridente', nome: 'Tridente', desc: 'fucile a raffica da 3 colpi, preciso a media distanza' },
  { id: 'rondine', nome: 'Rondine', desc: 'automatico, facile, buono contro gli Striscianti' },
  { id: 'martello', nome: 'Martello', desc: 'cannone a mano: pochi colpi fortissimi' },
  { id: 'tuono', nome: 'Tuono', desc: 'fucile a pompa: devastante da vicino, inutile da lontano' },
  { id: 'ago', nome: 'Ago di Stella', desc: 'cecchino: fa malissimo ai boss' },
  { id: 'drago', nome: 'Drago', desc: 'lanciarazzi: per i nemici grossi e i boss, lento' }
];
const SALE = [
  { nome: 'La Soglia delle Lanterne', t: 'un\'ondata di Striscianti veloci esce dal buio dell\'Atrio delle Anime; dietro, i Veli d\'Ombra proteggono le lanterne', danno: 22, giusta: 'prudenza', armi: ['rondine', 'tuono', 'tridente'] },
  { nome: 'Il Portale Sigillato', t: 'la Cantrice del Lutto vola sopra la Sala dei Sigilli e canta: quando il canto finisce colpisce tutti', danno: 30, giusta: 'attacca', armi: ['ago', 'drago', 'tridente'] },
  { nome: 'Il Gran Officiante', t: 'un gigante con lo SCUDO nel Santuario dei Glifi: e\' VULNERABILE solo per pochi secondi, quando i glifi si spengono', danno: 30, giusta: 'aspetta', armi: ['martello', 'ago', 'drago'] },
  { nome: 'Bruthak l\'Insaziabile', t: 'un bestione nella Fossa: carica a testa bassa e schiaccia chi gli sta davanti', danno: 34, giusta: 'prudenza', armi: ['drago', 'martello', 'ago'] },
  { nome: 'La Bestia del Lago', t: 'dal Lago Nero emergono tentacoli; la testa della Bestia si mostra solo ogni tanto', danno: 30, giusta: 'aspetta', armi: ['ago', 'martello', 'tridente'] },
  { nome: 'Il Re senza Luce', t: 'sul Trono di Luce Rubata il Re ti aspetta: evoca servitori e poi si scaglia su di te', danno: 40, giusta: 'attacca', armi: ['drago', 'ago', 'tuono', 'martello'] }
];
const MODI_C = [{ id: 'attacca', nome: 'attacca a tutta forza' }, { id: 'prudenza', nome: 'combatti con prudenza, da dietro i ripari' }, { id: 'aspetta', nome: 'aspetta il momento giusto e colpisci' }];
export const cripta = {
  nome: 'Cripta del Re senza Luce', icona: '⚔️',
  regole: 'Raid nella Cripta, sala dopo sala fino al Re senza Luce. Se i punti vita arrivano a zero sei sconfitto. Tu scegli arma e tattica, la mira la simula il codice.',
  nuova(ctx) { return { esp: ctx.giocatori[0].esperienza || 0, sala: -1, vita: 100, pozioni: 3, fase: 'arma', fine: false, vinto: false }; },
  tocca: st => (st.fine ? -1 : 0),
  domanda(st) {
    if (st.fase === 'arma') return { testo: 'Scendi dal Portale nella Cripta del Re senza Luce: sei sale, l\'ultima e\' il Re. Hai la pistola Lucciola e 3 pozioni. Scegli l\'arma principale che porti giu\'.', opzioni: elenco(ARMI_C), formato: fmt(ARMI_C) };
    const s = SALE[st.sala];
    return { testo: `Sala ${st.sala + 1} di 6: ${s.nome}. ${s.t}. Hai ${st.vita} punti vita, ${st.pozioni} pozioni, arma ${st.arma.nome}.`, opzioni: [...elenco(MODI_C), '(puoi aggiungere "pozione" per bere una pozione prima: +45 punti vita, es. "pozione, prudenza")'], formato: fmt(MODI_C) + ', anche con "pozione"' };
  },
  applica(st, i, mossa) {
    if (st.fase === 'arma') { const a = scelta(mossa, ARMI_C); if (!a) return { ok: false, errore: 'scegli uno tra ' + fmt(ARMI_C) }; st.arma = a; st.fase = 'sale'; st.sala = 0; return { ok: true, testo: 'scende con ' + a.nome, attesa: 30 }; }
    const m = scelta(String(mossa).replace(/pozion\w*/i, ''), MODI_C); if (!m) return { ok: false, errore: 'scegli uno tra ' + fmt(MODI_C) };
    let t = '';
    if (/pozion/i.test(mossa)) { if (st.pozioni > 0) { st.pozioni--; st.vita = Math.min(100, st.vita + 45); t = 'beve una pozione, poi '; } else t = '(niente pozioni) '; }
    const s = SALE[st.sala], giusta = m.id === s.giusta, arma = s.armi.includes(st.arma.id);
    const danno = Math.round(s.danno * (giusta ? 0.65 : 1.45) * (arma ? 0.8 : 1.2) * (1 - st.esp * 0.35) * rnd(0.7, 1.3));
    st.vita -= danno; t += `${m.nome} contro ${s.nome}: perde ${danno} punti vita`;
    if (st.vita <= 0 && st.pozioni > 0 && Math.random() < 0.5) { st.pozioni--; st.vita = 30; t += ', ma beve una pozione all\'ultimo'; }
    if (st.vita <= 0) { st.vita = 0; st.fine = true; return { ok: true, testo: t + ': sconfitto!' }; }
    t += ` (ne restano ${st.vita}): sala superata`;
    if (st.sala === 5) { st.fine = true; st.vinto = true; return { ok: true, testo: t + '. Il Re senza Luce e\' battuto!' }; }
    st.sala++;
    return { ok: true, testo: t, attesa: 70 };
  },
  auto(st) { if (st.fase === 'arma') return 'rondine'; return (st.vita < 45 && st.pozioni ? 'pozione, ' : '') + caso(MODI_C).id; },
  fine(st) {
    if (!st.fine) return null;
    const v = st.vinto;
    return { esiti: [v ? 'vinto' : 'perso'], testi: [v ? 'hai attraversato le sale e sconfitto il Re senza Luce!' : st.sala === 5 ? 'sei arrivato fino al trono ma il Re senza Luce ti ha battuto.' : `sei caduto nella sala ${st.sala + 1}, ${SALE[st.sala].nome}.`], premi: [v ? 30 : 2], stat: [{ salaMax: st.sala + 1 }] };
  },
  vista(st) { return st.sala < 0 ? 'Cripta: sceglie l\'arma' : `Cripta, sala ${st.sala + 1} (${SALE[st.sala].nome}), ${st.vita} punti vita`; }
};

/* =====================================================================
   BORG BUBBLE (il cabinato arcade): livelli con nemici da intrappolare nelle bolle. 3 vite, 6 livelli.
   Per ogni livello la strategia; poi, finito il livello, se raccogliere il cibo (punti) rischiando lo Spettro.
   ===================================================================== */
const LIV = [
  { t: 'nemici lenti che camminano sulle piattaforme in basso', giusta: 'basso' },
  { t: 'nemici che saltano da una piattaforma all\'altra', giusta: 'aspetta' },
  { t: 'nemici veloci che girano sulle piattaforme alte', giusta: 'alto' },
  { t: 'piattaforme strette e nemici che vengono verso di te', giusta: 'aspetta' },
  { t: 'tanti nemici sparsi in alto e in basso', giusta: 'raffica' },
  { t: 'nemici che volano in cerchio al centro dello schermo', giusta: 'raffica' }
];
const STRAT_B = [{ id: 'alto', nome: 'sali in alto e intrappolali da sopra' }, { id: 'basso', nome: 'resta in basso e soffia bolle in orizzontale' }, { id: 'aspetta', nome: 'aspetta che si avvicinino e colpisci' }, { id: 'raffica', nome: 'soffia bolle a raffica dappertutto' }];
const CIBO = [{ id: 'raccogli', nome: 'raccogli tutto il cibo (punti in piu\', ma se tardi arriva lo Spettro)' }, { id: 'avanti', nome: 'passa subito al livello dopo' }];
export const bubble = {
  nome: 'Borg Bubble', icona: '🫧',
  regole: 'Il gioco del cabinato arcade: soffi bolle che intrappolano i nemici, le scoppi e diventano cibo. Dopo un po\' arriva lo Spettro, che costa una vita. 3 vite.',
  nuova(ctx) { return { esp: ctx.giocatori[0].esperienza || 0, record: (ctx.giocatori[0].stat || {}).record || 0, liv: 0, vite: 3, punti: 0, fase: 'strategia', fine: false, ordine: LIV.slice().sort(() => Math.random() - 0.5) }; },
  tocca: st => (st.fine ? -1 : 0),
  domanda(st) {
    if (st.fase === 'strategia') return { testo: `Borg Bubble, livello ${st.liv + 1} di 6: ${st.ordine[st.liv].t}. Vite ${st.vite}, punti ${st.punti} (il tuo record: ${st.record}).`, opzioni: elenco(STRAT_B), formato: fmt(STRAT_B) };
    return { testo: `Livello ${st.liv + 1} finito! Sullo schermo c'e' tanto cibo. Vite ${st.vite}, punti ${st.punti}.`, opzioni: elenco(CIBO), formato: fmt(CIBO) };
  },
  applica(st, i, mossa) {
    if (st.fase === 'strategia') {
      const s = scelta(mossa, STRAT_B); if (!s) return { ok: false, errore: 'scegli uno tra ' + fmt(STRAT_B) };
      const giusta = s.id === st.ordine[st.liv].giusta, p = (giusta ? 0.85 : 0.55) + st.esp * 0.15 - st.liv * 0.03;
      let t = s.nome;
      if (Math.random() < p) { const pt = Math.round((giusta ? 1500 : 900) * (1 + st.liv * 0.4) * rnd(0.8, 1.2)); st.punti += pt; st.fase = 'cibo'; t += `: livello pulito (+${pt})`; }
      else { st.vite--; t += ': un nemico ti prende, perdi una vita'; if (!st.vite) st.fine = true; }
      return { ok: true, testo: t, attesa: 40 };
    }
    const c = scelta(mossa, CIBO); if (!c) return { ok: false, errore: 'scegli uno tra ' + fmt(CIBO) };
    let t = c.nome.split(' (')[0];
    if (c.id === 'raccogli') {
      if (Math.random() < 0.25 - st.esp * 0.1) { st.vite--; t += ': arriva lo Spettro, perdi una vita'; }
      else { const pt = Math.round(rnd(600, 2500) * (1 + st.liv * 0.3)); st.punti += pt; t += ` (+${pt})`; }
    }
    st.liv++; st.fase = 'strategia';
    if (!st.vite || st.liv >= 6) st.fine = true;
    return { ok: true, testo: t, attesa: 20 };
  },
  auto(st) { return st.fase === 'strategia' ? caso(STRAT_B).id : 'avanti'; },
  fine(st) {
    if (!st.fine) return null;
    const tutti = st.liv >= 6 && st.vite > 0, record = st.punti > st.record;
    return { esiti: [tutti ? 'vinto' : 'perso'], testi: [`${tutti ? 'hai finito tutti e 6 i livelli' : `game over al livello ${st.liv + 1}`} con ${st.punti} punti${record ? ': nuovo record!' : '.'}`], premi: [tutti ? 10 : 2], stat: [record ? { record: st.punti } : null] };
  },
  vista(st) { return `Borg Bubble, livello ${st.liv + 1}, ${st.punti} punti, ${st.vite} vite`; }
};
