// =====================================================================
//  LE VETRINE AZIENDALI (negozi sponsor) - 22/11/2026, Boris: "immaginati
//  di essere il proprietario di un negozio che vuole sponsorizzare il suo
//  sito sul gioco: cosa vorresti poter fare? Scegliere insegna, sito,
//  mobili vari ecc, sbizzarrisciti".
//  Chi ha un negozio finito su un terreno lo puo' trasformare nella vetrina
//  della sua azienda vera: marchio e logo, colori, insegna, slogan, chi
//  siamo, orari, link al sito, prodotti in vetrina, codice sconto per il sito
//  vero, arredo dell'interno, cartellone in piazza, statistiche.
//  MODERAZIONE (scelta di Boris): tutto quello che si legge o si clicca
//  (testi, link, logo) resta nascosto finche' un moderatore non lo approva
//  dal pannello nel gioco. Finche' una modifica aspetta, resta in vista la
//  versione approvata prima. Colori, arredo e cartellone sono scelte da un
//  elenco fisso: valgono subito (il cartellone mostra solo roba approvata).
//  I moderatori sono i nomi nella variabile MODERATORI del servizio, e
//  devono avere la loro chiave segreta del gioco (come per la banca).
// =====================================================================

export const REGOLE_SPONSOR = {
  prodottiMax: 6,
  logoMaxByte: 40000,            // il logo caricato: un'immagine piccola (il gioco la riduce a 128 x 128)
  sitoMax: 120,
  codaMax: 40
};
// le icone per il logo disegnato (senza caricare immagini) e le forme
export const ICONE_LOGO = ['⭐', '☕', '🍕', '🥐', '🍰', '🍦', '🌸', '🌿', '👟', '👕', '👜', '💎', '🎮', '🎧', '📚', '✂️', '🔧', '🚲', '🏠', '💡', '🎨', '📷', '🐾', '🍷', '🧁', '🛒', '💻', '⚽', '🎁', '🌍'];
export const FORME_LOGO = ['cerchio', 'quadrato', 'scudo', 'esagono'];
export const FONT_LOGO = ['moderno', 'classico', 'corsivo', 'tondo'];
// i mobili dell'interno della vetrina: 8 posti fissi nella stanza, in ognuno uno di questi (o niente)
export const MOBILI_SPONSOR = {
  espositore: 'Espositore con i prodotti', scaffale: 'Scaffale alto', tavolino: 'Tavolino con sedie', divano: 'Divanetto', pianta: 'Pianta grande',
  totem: 'Totem con il logo', tv: 'Schermo con lo slogan', poster: 'Poster del marchio', lampada: 'Lampada di design', tappeto: 'Tappeto con il logo',
  manichino: 'Manichino', bancone: 'Bancone informazioni'
};
export const POSTI_MOBILI = 8;

const HEX = /^#[0-9a-f]{6}$/i;
const pulito = (v, max) => String(v == null ? '' : v).replace(/[\u0000-\u001f<>]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
// un link accettabile: https, un dominio vero (niente indirizzi IP, niente utente:password, niente porte strane)
export function sitoOk(v) {
  const s = String(v || '').trim(); if (!s) return '';
  if (s.length > REGOLE_SPONSOR.sitoMax) return null;
  let u; try { u = new URL(/^https?:\/\//i.test(s) ? s : 'https://' + s); } catch (e) { return null; }
  if (u.protocol !== 'https:' || u.username || u.password || u.port) return null;
  const h = u.hostname.toLowerCase();
  if (!/^[a-z0-9-]+(\.[a-z0-9-]+)+$/.test(h) || /^\d+(\.\d+)+$/.test(h) || h.endsWith('.local') || h === 'localhost') return null;
  return u.origin + (u.pathname === '/' ? '' : u.pathname) + u.search;
}
export const dominio = s => { try { return new URL(s).hostname.replace(/^www\./, ''); } catch (e) { return ''; } };
export function logoOk(v) {
  if (v == null || v === '') return '';
  const s = String(v);
  if (s.length > REGOLE_SPONSOR.logoMaxByte || !/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+/=]+$/.test(s)) return null;
  return s;
}

// il profilo inviato dal gioco, ripulito: testi corti, link controllato, scelte solo dagli elenchi
export function profiloPulito(d, vecchio) {
  d = d || {}; const v = vecchio || {};
  const sito = d.sito === undefined ? (v.sito || '') : sitoOk(d.sito);
  if (sito === null) return { errore: 'Il sito deve essere un indirizzo https:// vero (per esempio https://www.miazienda.it).' };
  const lg = d.logo || {};
  const prodotti = (Array.isArray(d.prodotti) ? d.prodotti : v.prodotti || []).slice(0, REGOLE_SPONSOR.prodottiMax).map(p => ({
    nome: pulito(p && p.nome, 30), descr: pulito(p && p.descr, 90), icona: ICONE_LOGO.includes(p && p.icona) ? p.icona : '🎁', prezzo: pulito(p && p.prezzo, 16),
    link: (p && p.link && sitoOk(p.link) && sito && dominio(sitoOk(p.link)) === dominio(sito)) ? sitoOk(p.link) : ''
  })).filter(p => p.nome);
  return {
    azienda: pulito(d.azienda !== undefined ? d.azienda : v.azienda, 32),
    slogan: pulito(d.slogan !== undefined ? d.slogan : v.slogan, 60),
    descrizione: pulito(d.descrizione !== undefined ? d.descrizione : v.descrizione, 300),
    orari: pulito(d.orari !== undefined ? d.orari : v.orari, 60),
    sito,
    codice: { testo: pulito((d.codice || v.codice || {}).testo, 20).toUpperCase().replace(/[^A-Z0-9-]/g, ''), sconto: pulito((d.codice || v.codice || {}).sconto, 40) },
    logo: { tipo: lg.tipo === 'immagine' ? 'immagine' : 'disegnato', icona: ICONE_LOGO.includes(lg.icona) ? lg.icona : '⭐', iniziali: pulito(lg.iniziali, 3).toUpperCase(),
      forma: FORME_LOGO.includes(lg.forma) ? lg.forma : 'cerchio', font: FONT_LOGO.includes(lg.font) ? lg.font : 'moderno' },
    prodotti
  };
}
const scelte = (d, v) => {
  v = v || {};
  const colori = Array.isArray(d.colori) && d.colori.length === 2 && d.colori.every(c => HEX.test(c)) ? d.colori.map(c => c.toLowerCase()) : (v.colori || ['#1f3a8a', '#f2c21c']);
  const mobili = Array.isArray(d.mobili) ? Array.from({ length: POSTI_MOBILI }, (_, i) => MOBILI_SPONSOR[d.mobili[i]] ? d.mobili[i] : null) : (v.mobili || ['bancone', 'espositore', 'espositore', 'pianta', 'totem', 'tv', 'divano', 'pianta']);
  return { colori, mobili, cartellone: d.cartellone === undefined ? v.cartellone !== false : !!d.cartellone };
};

function vetrinaDi(stato, lotto) {
  const V = stato.vetrine || (stato.vetrine = {});
  return V[lotto] || (V[lotto] = { approvato: null, bozza: null, scelte: null, stat: { visite: 0, clic: 0, codici: 0, giorni: {} }, storia: [] });
}
const negozioMio = (stato, chi) => {
  const e = Object.entries(stato.terreni || {}).find(([, t]) => t.chi === chi && t.progetto && t.progetto.tipo === 'negozio');
  return e && e[1].progetto.finito ? e : null;
};
export const eModeratore = (nick, moderatori) => !!nick && String(moderatori || '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean).includes(String(nick).toLowerCase());

// Le azioni del proprietario, dei visitatori e dei moderatori (la chiave del gioco e' gia' stata controllata dal motore)
export function azioneSponsor(stato, chi, nick, d, adesso, o = {}) {
  d = d || {};
  const mod = !!o.moderatore;
  // --- chiunque: le statistiche (visita all'interno, clic sul sito, codice sconto copiato)
  if (d.azione === 'visita' || d.azione === 'clic' || d.azione === 'codice') {
    const V = (stato.vetrine || {})[d.lotto]; if (!V || !V.approvato) return { ok: false, motivo: 'Vetrina sconosciuta.' };
    const k = d.azione === 'visita' ? 'visite' : d.azione === 'clic' ? 'clic' : 'codici', g = new Date(adesso).toISOString().slice(0, 10);
    V.stat[k] = (V.stat[k] || 0) + 1; const G = V.stat.giorni[g] || (V.stat.giorni[g] = { visite: 0, clic: 0, codici: 0 }); G[k]++;
    const giorni = Object.keys(V.stat.giorni).sort(); while (giorni.length > 30) delete V.stat.giorni[giorni.shift()];
    return { ok: true };
  }
  // --- chiunque: segnalare ai moderatori una vetrina che non va (resta in vista finche' un moderatore non decide)
  if (d.azione === 'segnala') {
    const V = (stato.vetrine || {})[d.lotto]; if (!V || !V.approvato) return { ok: false, motivo: 'Vetrina sconosciuta.' };
    const S = V.segnalazioni || (V.segnalazioni = []);
    if (nick && S.some(q => q.nick === nick)) return { ok: true, gia: true };
    S.push({ nick: nick || '?', motivo: pulito(d.motivo, 140) || 'senza motivo', t: adesso }); if (S.length > 20) S.shift();
    return { ok: true };
  }
  // --- i moderatori
  if (d.azione === 'moderatore') return { ok: true, moderatore: mod, attesa: mod ? Object.values(stato.vetrine || {}).filter(V => (V.bozza && V.bozza.stato === 'attesa') || (V.segnalazioni || []).length).length : 0 };
  if (['coda', 'approva', 'rifiuta', 'togli'].includes(d.azione)) {
    if (!mod) return { ok: false, motivo: 'Solo i moderatori del borgo possono farlo.' };
    if (d.azione === 'coda') return { ok: true, coda: Object.entries(stato.vetrine || {}).filter(([, V]) => V.bozza && V.bozza.stato === 'attesa').slice(0, REGOLE_SPONSOR.codaMax).map(([lotto, V]) => ({ lotto, chi: V.bozza.nick, inviata: V.bozza.inviata, profilo: V.bozza.profilo, logo: V.bozza.logoImg || '', prima: V.approvato ? V.approvato.profilo : null, dominio: dominio(V.bozza.profilo.sito) })),
      approvati: Object.entries(stato.vetrine || {}).filter(([, V]) => V.approvato).map(([lotto, V]) => ({ lotto, azienda: V.approvato.profilo.azienda, sito: V.approvato.profilo.sito, da: V.approvato.da, quando: V.approvato.quando, segnalazioni: V.segnalazioni || [] })) };
    if (d.azione === 'togli' && d.solo === 'segnalazioni') { const V = (stato.vetrine || {})[d.lotto]; if (V) V.segnalazioni = []; return { ok: true }; }
    const V = (stato.vetrine || {})[d.lotto]; if (!V) return { ok: false, motivo: 'Vetrina sconosciuta.' };
    if (d.azione === 'togli') { if (!V.approvato) return { ok: false, motivo: 'Non c\'e\' niente in vista.' }; V.storia.push({ t: adesso, cosa: 'tolta', da: nick, motivo: pulito(d.motivo, 120) }); V.approvato = null; V.segnalazioni = []; V.tolta = { motivo: pulito(d.motivo, 120), t: adesso }; return { ok: true }; }
    if (!V.bozza || V.bozza.stato !== 'attesa') return { ok: false, motivo: 'Non c\'e\' niente da controllare.' };
    if (d.azione === 'rifiuta') { V.bozza.stato = 'rifiutata'; V.bozza.motivo = pulito(d.motivo, 160) || 'Non va bene cosi\'.'; V.storia.push({ t: adesso, cosa: 'rifiutata', da: nick, motivo: V.bozza.motivo }); return { ok: true }; }
    const img = V.bozza.profilo.logo.tipo === 'immagine' ? (V.bozza.logoImg || (V.approvato && V.approvato.logoImg) || '') : '';
    V.approvato = { profilo: V.bozza.profilo, logoImg: img, logoV: img ? adesso.toString(36) : '', quando: adesso, da: nick };
    V.storia.push({ t: adesso, cosa: 'approvata', da: nick }); if (V.storia.length > 30) V.storia.shift();
    V.bozza = null;
    return { ok: true };
  }
  // --- il proprietario del negozio
  const e = negozioMio(stato, chi);
  if (!e) return { ok: false, motivo: 'Serve un negozio finito su un tuo terreno.' };
  const [lotto] = e, V = vetrinaDi(stato, lotto);
  if (d.azione === 'mia') return { ok: true, lotto, ...vistaMia(V) };
  if (d.azione === 'scelte') { V.scelte = scelte(d, V.scelte); return { ok: true, lotto, ...vistaMia(V) }; }
  if (d.azione === 'invia') {
    const base = (V.bozza && V.bozza.profilo) || (V.approvato && V.approvato.profilo);
    const p = profiloPulito(d.profilo, base); if (p.errore) return { ok: false, motivo: p.errore };
    if (!p.azienda) return { ok: false, motivo: 'Scrivi il nome della tua azienda.' };
    let img = '';
    if (p.logo.tipo === 'immagine') {
      img = d.logoImg === undefined ? ((V.bozza && V.bozza.logoImg) || (V.approvato && V.approvato.logoImg) || '') : logoOk(d.logoImg);
      if (img === null) return { ok: false, motivo: 'Il logo deve essere un\'immagine PNG, JPG o WEBP piccola (il gioco la riduce da solo).' };
      if (!img) return { ok: false, motivo: 'Carica l\'immagine del logo, oppure disegnalo con icona e iniziali.' };
    }
    V.scelte = scelte(d, V.scelte);
    V.bozza = { profilo: p, logoImg: img, nick, inviata: adesso, stato: 'attesa' };
    return { ok: true, lotto, ...vistaMia(V) };
  }
  if (d.azione === 'ritira') { if (V.bozza) V.bozza = null; return { ok: true, lotto, ...vistaMia(V) }; }
  return { ok: false, motivo: 'Azione sconosciuta.' };
}
function vistaMia(V) {
  return { tolta: V.approvato ? null : V.tolta || null, approvato: V.approvato ? { profilo: V.approvato.profilo, quando: V.approvato.quando, logoV: V.approvato.logoV, logoImg: V.approvato.logoImg } : null,
    bozza: V.bozza ? { profilo: V.bozza.profilo, stato: V.bozza.stato, motivo: V.bozza.motivo || '', inviata: V.bozza.inviata, logoImg: V.bozza.logoImg } : null,
    scelte: V.scelte || scelte({}, null), stat: { visite: V.stat.visite, clic: V.stat.clic, codici: V.stat.codici, giorni: V.stat.giorni } };
}

// Per tutti: solo quello che un moderatore ha approvato (il logo caricato si scarica a parte, da /logo)
export function vistaVetrine(stato) {
  const out = {};
  for (const [lotto, V] of Object.entries(stato.vetrine || {})) {
    const t = (stato.terreni || {})[lotto];
    if (!V.scelte && !V.approvato) continue;
    if (!t || !t.progetto || !t.progetto.finito || t.progetto.tipo !== 'negozio') continue;
    const s = V.scelte || scelte({}, null);
    out[lotto] = { colori: s.colori, mobili: s.mobili, cartellone: s.cartellone && !!V.approvato,
      profilo: V.approvato ? Object.assign({}, V.approvato.profilo, { dominio: dominio(V.approvato.profilo.sito) }) : null, logoV: V.approvato ? V.approvato.logoV : '',
      visite: V.stat.visite };
  }
  return out;
}
export const logoDi = (stato, lotto) => { const V = (stato.vetrine || {})[lotto]; return V && V.approvato && V.approvato.logoImg ? V.approvato.logoImg : ''; };
export const vistaCataloghi = () => ({ icone: ICONE_LOGO, forme: FORME_LOGO, font: FONT_LOGO, mobili: MOBILI_SPONSOR, posti: POSTI_MOBILI, prodottiMax: REGOLE_SPONSOR.prodottiMax });
