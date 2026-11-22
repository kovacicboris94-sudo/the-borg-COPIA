# Mappa del gioco (src/)

`src/pagina.html` è il modello della pagina: ogni `@@include(percorso)@@` incolla un file. **L'ordine degli include è l'ordine di caricamento**: un modulo usa solo quello che è caricato prima. Tutti i moduli si appendono a un solo oggetto globale, `window.B3` (nei file si chiama `B`). L'app vera nasce in `programma-principale.js` (`B.app` = renderer, scena, stanze, `entraStanza`, `muovi`, `libero`, `gP`, `piazza`...).

Dimensioni tra parentesi: file grandi da leggere a pezzi (Grep + offset).

## avvio/ (primi script)
- `schermata-home.js` codice `?amici=` salvato per l'app sulla Home · `aggiorna.js` avvisa quando c'è una versione nuova · `errori-telefono.js` mostra gli errori sul telefono · `secondo-piano.js` app chiusa o in background · `orientamento.js` verticale/orizzontale.

## borgo/ (il mondo)
| File | Cosa contiene |
|---|---|
| `configurazione.js` | dati, testi, utenti demo (id u1..u18) |
| `base.js` | materiali, texture disegnate da codice |
| `avatar.js` (54K) · `foto-avatar.js` | avatar chibi 3D e le sue anteprime |
| `ottimizza.js` | unisce i pezzi fermi in poche mesh (prestazioni) |
| `modelli-glb.js` | carica i .glb di `modelli/` |
| `piazza-modelli.js` · `piazza.js` (48K) | la piazza: edifici, fontana, alberi, lampioni |
| `mura-cosmo.js` | mura e cielo stellato |
| `torre.js` (46K) · `torre-negozi.js` | Torre della Cometa: 15 piani, ascensore (`B.TORRE`, `B.Ascensore`) |
| `casa.js` | la casa del giocatore |
| `biblioteca.js` · `biblioteca-letture.js` | Biblioteca e leggio |
| `casette-agenti.js` | case di Ada e Teo (x ±22, z 63) |
| `interni.js` | interni esplorabili di negozi, banca, ambulatorio (`B.INTERNI`) |
| `sala-giochi.js` · `casa-scacchi.js` | Sala Giochi (cabinati) e Casa degli Scacchi |
| `suoni.js` | musica ed effetti |
| `logica.js` | logica locale simulata (bot, chat demo) |
| `coins-arredi.js` (50K) | monete (`B.Eco`), negozio di arredi, arredare casa |
| `mobili-interattivi.js` | mobili che fanno qualcosa (`B3.MobInt`) |
| `missioni.js` | missioni e serie giornaliera |
| `attivita-piazza.js` (92K) | pesca al Laghetto, ruota panoramica, Mercatino (`B.ATTIVITA_CFG`) |
| `portale-cripta.js` | portale della Cripta in piazza |
| `programma-principale.js` (41K) | avvio dell'app, stanze, movimento, collisioni, `B.app` |
| `interfaccia.js` (48K) | schermata iniziale, barra, chat, messaggi privati, profilo |
| `tutorial.js` · `zaino.js` | primo accesso · pagina Zaino |
| `agenti-ia.js` (57K) | Ada e Teo nel gioco: scheda, cronaca, banconi, regali, DM (`URL_PREDEFINITO` = servizio Cloudflare) |
| `terreni.js` (49K) | lotti, case, ville, cantieri, insegne dei negozi |
| `banca.js` | Banca del Borgo: conto, mutui, prestiti, appartamenti |
| `lavoro.js` | turni da dipendente per i giocatori |
| `impresa.js` | Edilborgo, l'impresa edile |

## Altre cartelle
- `chat/filtro.js` filtro della chat (parolacce, dati personali). Prova: `test/filtro.test.mjs`.
- `negozi/` Laugh Tale Collectibles (insegna + interno) e negozio TCG.
- `online/amici.js` gioco con gli amici (PeerJS, oppure Nakama con `?server=`). Client Nakama: `server/client/nakama-stanza.js` (incluso da lì).
- `minigiochi/` uno per cartella, di solito `gioco.js` + regole/modelli: `go-kart`, `paintball`, `nascondino`, `fronte` (Fronte della Cometa), `cripta` (raid, `gioco.js` 362K), `belinverse` (carte + tavolo), `borg-bubble`, `scacchi` (`motore.js` = regole). `comandi-fps.js` = comandi condivisi degli sparatutto.
- `stile.css` stile dell'interfaccia.
- `librerie/` e `dati/`: codice di terzi e immagini in base64, **non si leggono**.

## Collegamenti con gli agenti
Le copie in `agenti/giochi/` di `scacchi/motore.js` e `belinverse/carte.js` devono restare uguali agli originali (`test/giochi-agenti.test.mjs` lo controlla): se cambi gli originali, ricopiali. Posizioni di luoghi, banconi e stanze sono duplicate in `agenti/motore.mjs` (`LUOGHI`, `STANZE`), `agenti/interni.mjs` e `agenti/borgo-cose.mjs`: se sposti qualcosa nel gioco, aggiornale.
