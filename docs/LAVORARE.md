# Lavorare sul progetto: build, prove, pubblicazione

## Ciclo normale
1. Ramo del thread, aggiornato con `git fetch origin main && git merge origin/main`.
2. Modifica `src/` (gioco) o `agenti/` (servizio). Mai `index.html` a mano.
3. `node strumenti/costruisci.mjs` (scrive `index.html`). Controllo: `node strumenti/costruisci.mjs --controlla`.
4. Prove: solo quelle della parte toccata (elenco sotto). Se una fallisce, ripeti solo quella.
5. Commit di `src/` + `index.html` insieme, push, PR su `main`, merge quando la CI è verde (regole in `CLAUDE.md`).

## Prove (`test/`, Node 18+, nessuna dipendenza tranne `agenti/`)
| Parte | Prova |
|---|---|
| chat | `filtro.test.mjs` |
| minigiochi | `cripta`, `nascondino`, `fronte`, `scacchi`, `musica` |
| messa online | `sito.test.mjs` |
| agenti (prima `cd agenti && npm ci`) | `agenti`, `giochi-agenti`, `vita`, `registro`, `terreni`, `interni`, `banca` |
| server Nakama | `server/test/stanza.test.mjs`, `bash server/test/produzione.test.sh` |

La CI (`.github/workflows/controlla.yml`) esegue `--controlla` e quasi tutte queste prove a ogni push.

## Provare il gioco nel browser (Playwright)
- `python3 -m http.server` nella radice, poi Chromium headless su `http://localhost:8000/`. In headless il gioco va a 2-10 fps: avanza i timer a mano o stubba `B3.app.renderer.render`.
- Dopo il login togli `#tut` e chiama `B3.app.entraStanza('piazza')` (si nasce in casa). I nick demo (Bea, Dario, Luna...) sono rifiutati: usa per esempio `Prova_A`.
- Agenti in locale: `AGENTI_FINTI=1 AGENTI_FILE=<cartella temporanea>/stato.json node agenti/locale/avvia.mjs`, poi il gioco con `?agenti=http://localhost:8787`.
- Online fra due giocatori: PeerServer locale (`require('peer').PeerServer({port:9000,path:'/',host:'127.0.0.1'})`) e `?amici=X&peerserver=127.0.0.1:9000`.
- Screenshot da mostrare a Boris: nella cartella del progetto `/mnt/project-files/the-borg/...`, non nel repo.

## Pubblicazione
- **Gioco**: GitHub Pages da `main` (radice) di `the-borg-copia`. Il container non raggiunge github.io: Boris verifica dal telefono.
- **Agenti**: Cloudflare Workers Builds da `main` quando cambia `agenti/` (vedi `docs/AGENTI.md`).
- `MESSA-ONLINE.md` e `server/` (Nakama, dominio, VPS) sono piani **sospesi**: niente spese senza il via di Boris.

## Se arriva un index.html fatto fuori
`node strumenti/scomponi.mjs file.html /tmp/x` e poi `diff -r src /tmp/x/src`. Mai sovrascrivere `index.html` con quello esterno.
