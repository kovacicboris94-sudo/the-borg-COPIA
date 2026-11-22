// =====================================================================
//  IL BORGO DEGLI AGENTI sul tuo computer
//    cd agenti
//    npm install            (solo la prima volta)
//    npm run locale
//  La chiave si legge dal file agenti/.env (riga ANTHROPIC_API_KEY=...) o
//  dalla variabile d'ambiente: non va mai nel gioco ne' su GitHub.
//  Lo stato del borgo si salva in agenti/locale/stato.json.
//  Poi apri nel browser http://localhost:8787/?agenti=http://localhost:8787
//  (il gioco servito dal tuo PC, con gli agenti dentro).
//  AGENTI_PAUSA=1 li mette in pausa (fermi, niente spese).
//  AGENTI_FINTI=1 usa un cervello finto (gratis) per le prove.
// =====================================================================
import http from 'node:http';
import { readFileSync, writeFileSync, existsSync, renameSync, statSync } from 'node:fs';
import { join, normalize, extname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { nuovoStato, passo, vistaPubblica, giocatoreParla, giocatoreRegala, giocatoreTurno, giocatoreVende, giocatoreTerreno, giocatoreDipendente, giocatoreSponsor, logoDi, cronaca, proposte } from '../motore.mjs';
import { cervelloClaude, cervelloFinto } from '../cervello.mjs';

const qui = p => fileURLToPath(new URL(p, import.meta.url));
const FILE = process.env.AGENTI_FILE || qui('./stato.json');
const PORTA = +(process.env.PORT || 8787);
const PASSO_MS = +(process.env.AGENTI_PASSO_MS || 30000);
const RADICE = qui('../../');
const TIPI = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.glb': 'model/gltf-binary', '.json': 'application/json', '.webmanifest': 'application/manifest+json', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg' };

function leggiEnv() {
  const f = qui('../.env');
  if (!existsSync(f)) return;
  for (const riga of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/.exec(riga);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
leggiEnv();

const cervello = process.env.AGENTI_FINTI === '1' ? cervelloFinto(7) : cervelloClaude(process.env.ANTHROPIC_API_KEY);
let stato = existsSync(FILE) ? JSON.parse(readFileSync(FILE, 'utf8')) : nuovoStato(Date.now());
const salva = () => { writeFileSync(FILE + '.tmp', JSON.stringify(stato)); renameSync(FILE + '.tmp', FILE); };

let occupato = false;
async function giro() {
  if (occupato) return; occupato = true;
  try {
    const fatti = await passo(stato, Date.now(), cervello, { pausa: process.env.AGENTI_PAUSA === '1' });
    fatti.forEach(f => console.log(new Date().toLocaleTimeString('it-IT'), f.agente, f.pensato ? `ha pensato (${(f.costo || 0).toFixed(5)} $)` : `non ha pensato: ${f.motivo}${f.errore ? ' - ' + f.errore : ''}`));
    salva();
  } catch (e) { console.error('errore nel passo:', e); }
  finally { occupato = false; }
}

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Methods': 'GET, POST, OPTIONS', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Allow-Private-Network': 'true' };
const voci = new Map();
const server = http.createServer((req, res) => {
  const manda = (v, c = 200) => { res.writeHead(c, Object.assign({ 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' }, CORS)); res.end(JSON.stringify(v)); };
  const url = new URL(req.url, 'http://x');
  if (req.method === 'OPTIONS') { res.writeHead(204, CORS); return res.end(); }
  if (url.pathname === '/stato') return manda(vistaPubblica(stato, Date.now()));
  if (url.pathname === '/cronaca') return manda({ ora: Date.now(), voci: cronaca(stato, +url.searchParams.get('da') || 0) });
  if (url.pathname === '/proposte') return manda({ ora: Date.now(), proposte: proposte(stato) });
  if (url.pathname === '/parla' && req.method === 'POST') {
    const chi = req.socket.remoteAddress || 'x', ora = Date.now();
    if (ora - (voci.get(chi) || 0) < 8000) return manda({ ok: false, motivo: 'piano' }, 429);
    voci.set(chi, ora);
    let corpo = ''; req.on('data', c => { corpo += c; if (corpo.length > 4000) req.destroy(); });
    req.on('end', () => { let d = {}; try { d = JSON.parse(corpo); } catch (e) { /* vuoto */ } const ok = giocatoreParla(stato, d.nick, d.testo, d.x, d.z, ora, { stanza: d.stanza, a: d.a }); if (ok) salva(); manda({ ok }); });
    return;
  }
  if (url.pathname === '/regala' && req.method === 'POST') {
    const chi = 'r' + (req.socket.remoteAddress || 'x'), ora = Date.now();
    if (ora - (voci.get(chi) || 0) < 20000) return manda({ ok: false, motivo: 'Aspetta qualche secondo prima di un altro regalo.' }, 429);
    voci.set(chi, ora);
    let corpo = ''; req.on('data', c => { corpo += c; if (corpo.length > 4000) req.destroy(); });
    req.on('end', () => { let d = {}; try { d = JSON.parse(corpo); } catch (e) { /* vuoto */ } const r = giocatoreRegala(stato, d.nick, d, ora); if (r.ok) salva(); manda(r); });
    return;
  }
  if ((url.pathname === '/turno' || url.pathname === '/vendi') && req.method === 'POST') {
    let corpo = ''; req.on('data', c => { corpo += c; if (corpo.length > 4000) req.destroy(); });
    req.on('end', () => { let d = {}; try { d = JSON.parse(corpo); } catch (e) { /* vuoto */ } const ora = Date.now(); const r = url.pathname === '/turno' ? giocatoreTurno(stato, d.nick, d.negozio, d.on !== false, ora) : giocatoreVende(stato, d.nick, d, ora); if (r.ok) salva(); manda(r); });
    return;
  }
  if (url.pathname === '/dipendente' && req.method === 'POST') {
    let corpo = ''; req.on('data', c => { corpo += c; if (corpo.length > 4000) req.destroy(); });
    req.on('end', () => { let d = {}; try { d = JSON.parse(corpo); } catch (e) { /* vuoto */ } const r = giocatoreDipendente(stato, d.nick, d, Date.now()); if (r.ok) salva(); manda(r); });
    return;
  }
  if ((url.pathname === '/terreno' || url.pathname === '/banca') && req.method === 'POST') {
    let corpo = ''; req.on('data', c => { corpo += c; if (corpo.length > 4000) req.destroy(); });
    req.on('end', () => { let d = {}; try { d = JSON.parse(corpo); } catch (e) { /* vuoto */ } const r = giocatoreTerreno(stato, d.nick, d, Date.now()); if (r.ok) salva(); manda(r); });
    return;
  }
  if (url.pathname === '/sponsor' && req.method === 'POST') {
    let corpo = ''; req.on('data', c => { corpo += c; if (corpo.length > 80000) req.destroy(); });
    req.on('end', () => { let d = {}; try { d = JSON.parse(corpo); } catch (e) { /* vuoto */ } const r = giocatoreSponsor(stato, d.nick, d, Date.now(), process.env.MODERATORI || ''); if (r.ok) salva(); manda(r); });
    return;
  }
  if (url.pathname === '/logo') {
    const m = /^data:(image\/(?:png|jpeg|webp));base64,(.+)$/.exec(logoDi(stato, url.searchParams.get('lotto') || ''));
    if (!m) { res.writeHead(404, CORS); return res.end(); }
    res.writeHead(200, Object.assign({ 'Content-Type': m[1], 'Cache-Control': 'public, max-age=86400', 'X-Content-Type-Options': 'nosniff' }, CORS)); return res.end(Buffer.from(m[2], 'base64'));
  }
  if (url.pathname === '/info') return manda({ ok: true, borgo: 'Il Borgo degli Agenti', chiave: !!cervello, agenti: Object.keys(stato.agenti) });
  // il gioco stesso, servito dalla cartella del progetto: http://localhost:8787/ apre il borgo con gli agenti
  const rel = normalize(decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)).replace(/^([/\\])+/, '');
  const file = join(RADICE, rel);
  if (req.method !== 'GET' || rel.startsWith('..') || rel.startsWith('agenti') || rel.startsWith('.') || !existsSync(file) || !statSync(file).isFile()) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { 'Content-Type': TIPI[extname(file)] || 'application/octet-stream' });
  res.end(readFileSync(file));
});
server.listen(PORTA, () => {
  console.log(`Borgo degli agenti acceso. Apri: http://localhost:${PORTA}/?agenti=http://localhost:${PORTA}`);
  console.log(cervello ? (process.env.AGENTI_FINTI === '1' ? 'Cervello FINTO (prove, gratis).' : 'Cervello: Claude Haiku 5.5.') : 'ATTENZIONE: manca ANTHROPIC_API_KEY, gli agenti vivono in automatico.');
  giro(); setInterval(giro, PASSO_MS);
});
