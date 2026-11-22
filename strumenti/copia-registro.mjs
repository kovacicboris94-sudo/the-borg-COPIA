// Copia l'archivio dell'esperimento (pagina /registro del servizio degli agenti) in file di testo.
// Una riga JSON per ogni cosa detta, pensata o fatta, divisa per giorno (ora italiana):
//   <cartella>/AAAA-MM/AAAA-MM-GG.jsonl   +   <cartella>/cursore.json (fin dove si e' copiato)
// Uso:  node strumenti/copia-registro.mjs <url del servizio> <cartella>
// Lo fa da solo, due volte al giorno, .github/workflows/registro-agenti.yml.
import fs from 'node:fs';
import path from 'node:path';

const URL_SERVIZIO = (process.argv[2] || 'https://borgo-agenti.kovacic-boris-94.workers.dev').replace(/\/$/, '');
const CARTELLA = process.argv[3] || 'registro';

const giornoRoma = t => new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Rome', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date(t));

export async function copia(url = URL_SERVIZIO, cartella = CARTELLA, prendi = fetch) {
  fs.mkdirSync(cartella, { recursive: true });
  const fileCursore = path.join(cartella, 'cursore.json');
  const cursore = fs.existsSync(fileCursore) ? JSON.parse(fs.readFileSync(fileCursore, 'utf8')) : { ultimo: 0 };
  let copiate = 0;
  for (let giri = 0; giri < 200; giri++) {
    const r = await prendi(`${url}/registro?da=${cursore.ultimo}&max=2000`);
    if (!r.ok) throw new Error('il servizio ha risposto ' + r.status);
    const d = await r.json();
    if (!d.righe || !d.righe.length) break;
    const perGiorno = new Map();
    for (const riga of d.righe) {
      const g = giornoRoma(riga.t);
      if (!perGiorno.has(g)) perGiorno.set(g, []);
      perGiorno.get(g).push(JSON.stringify(riga));
    }
    for (const [g, righe] of perGiorno) {
      const dir = path.join(cartella, g.slice(0, 7));
      fs.mkdirSync(dir, { recursive: true });
      fs.appendFileSync(path.join(dir, g + '.jsonl'), righe.join('\n') + '\n');
    }
    cursore.ultimo = d.righe[d.righe.length - 1].id;
    copiate += d.righe.length;
    cursore.copiato = new Date().toISOString();
    fs.writeFileSync(fileCursore, JSON.stringify(cursore, null, 2) + '\n');   // dopo ogni pagina: se si interrompe, non ci sono doppioni
  }
  return copiate;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const n = await copia();
  console.log(`registro: copiate ${n} righe in ${CARTELLA}`);
}
