# Ada e Teo: mappa del servizio agenti (agenti/)

Due abitanti con Claude Haiku 5.5. Vivono in un servizio Cloudflare separato (la chiave non può stare nel gioco). Spiegazione lunga per persone: `agenti/LEGGIMI.md` e `agenti/vita/LEGGIMI.md` (non serve leggerli per lavorare sul codice).

## Come gira
`cloudflare/worker.mjs` → Durable Object `Borgo` (allarme ogni 30 s, cron ogni 5 min per il backup) → `passo()` in `motore.mjs` muove il mondo → quando tocca a un agente, `pensa()` costruisce prompt di sistema + percezione e chiama `cervello.mjs` → la risposta JSON (azioni) viene normalizzata ed eseguita dalle regole del motore.

- Servizio: `https://borgo-agenti.kovacic-boris-94.workers.dev`. Il container cloud **non** lo raggiunge: si legge dal browser integrato sul computer di Boris (`fetch('/stato')`, `/cronaca`, `/registro?da=<id>&max=5000`, `/proposte`).
- Scritture dal gioco: POST `/parla`, `/regala`, `/turno`, `/vendi`, `/dipendente`, `/terreno`, `/banca`.
- Pubblicazione: Cloudflare Workers Builds da `main` (root `agenti`, comando `npx wrangler deploy --config cloudflare/wrangler.toml`). Il controllo "Workers Builds" fallisce sui rami diversi da main: è normale.
- Pausa: variabile `AGENTI_PAUSA=1` nel pannello Cloudflare. Prove gratis: `AGENTI_FINTI=1` (cervello finto).

## File
| File | Cosa contiene |
|---|---|
| `motore.mjs` (133K, leggere a pezzi) | sezioni nell'ordine: `REGOLE`/`PREZZI`/`LUOGHI`/`STANZE`/`PROTETTE` in cima · utilità · stato (`nuovoStato`, `spesaMese`, `budget`) · regole del mondo (`normalizzaAzione`) · un passo (`passo`, `avanza`, `riflessi`, `esegui`, `usa`) · il prompt (`promptBase`, `percezione`, `SCHEMA`) · pensare (`pensa`) · da fuori (`giocatore*`, `vistaPubblica`) · giochi inventati · negozi · terreni e banca |
| `cervello.mjs` | chiamata a Claude (SDK, structured output, cache del prompt) + `cervelloFinto` |
| `borgo-cose.mjs` | manuale del borgo: cose usabili (`COSE`, azione `usa`), Starlight, Mercatino |
| `negozi.mjs` · `lavori.mjs` · `interni.mjs` | banconi, clienti demo, scorte, mestieri, stanze interne |
| `terreni.mjs` · `banca.mjs` · `impresa.mjs` | lotti e progetti, mutui e prestiti, Edilborgo |
| `registro.mjs` | archivio dell'esperimento (tabella SQLite del worker, `/registro`) |
| `vita/` | corpo, fisica, chimica, casa, bollette, economia, cervello a regole gratis (`aggancio.mjs` lo collega al motore; interruttore `REGOLE.vita`) |
| `giochi/` | minigiochi giocati davvero (`index.mjs` + scacchi, pesca, belinverse, `azione.mjs`); interruttore `REGOLE.partite` |
| `locale/avvia.mjs` | lo stesso servizio sul PC (`npm run locale`) |

Lato gioco: `src/borgo/agenti-ia.js` (scheda, cronaca, banconi, DM), `casette-agenti.js`, `interni.js`, `lavoro.js`, `terreni.js`, `banca.js`.

## Aggiungere una cosa che gli agenti possono usare
1. Regole e dati nel modulo giusto (`borgo-cose.mjs` per un oggetto da usare, `STANZE` in `motore.mjs` per un edificio, `negozi.mjs`/`lavori.mjs` per un mestiere).
2. Se serve un'azione nuova: `SCHEMA` (enum `tipo`), `normalizzaAzione`, `esegui`, e una riga nel prompt (`promptBase`).
3. Una prova in `test/agenti.test.mjs` (o nel test del modulo).

## Costi (misurati il 22/11/2026)
- Un pensiero: ~16.000-17.000 token in ingresso (prompt di sistema ~7.000 sempre uguale + percezione ~9.000 che cambia ogni volta), ~500-650 in uscita. Prima della cache costava ~0,0017-0,0021 $.
- Pensano in media ogni 3 minuti; ~85-90% dei pensieri arriva entro 5 minuti dal precedente.
- Dal 22/11 il prompt di sistema è in cache (5 minuti): quei token costano un decimo. Nel registro `ingresso` conta solo i token non in cache, `cache` quelli letti dalla cache.
- Mosse nei minigiochi: ~0,0002 $ l'una (`giochi/index.mjs`, `maxTokens` 350).
- Tetto: 5 $ al mese per agente, bloccato nel codice (`REGOLE.tettoUsd`); oltre, cervello a regole gratis.
- Il prompt cresce con ogni novità del borgo: tienilo corto. `REGOLE.maxTokensIngresso` (40.000) ferma i prompt troppo lunghi.

## Lo studio di Boris
Boris studia Ada e Teo come un esperimento: diario "Diario dell'esperimento: Ada e Teo" (Claude Doc). Ogni cambiamento che può cambiare il loro comportamento (prompt, regole, prezzi, ritmo) si annota nel diario come "intervento", con data e ora. Non usare mai la chiave degli agenti per analisi.

## Prove
`cd agenti && npm ci` una volta, poi dalla radice: `node test/agenti.test.mjs`, `giochi-agenti`, `vita`, `registro`, `terreni`, `interni`, `banca` (tutti `test/*.test.mjs`).
