# The Borg: istruzioni per Claude

Gioco social 3D per telefono (Three.js, interfaccia in italiano) + due abitanti IA, Ada e Teo, che vivono su Cloudflare.
Leggi solo quello che serve: le mappe in `docs/` dicono dove sta ogni cosa, non esplorare il repo a mano.

| Cosa devi fare | Leggi |
|---|---|
| Toccare il gioco (piazza, case, negozi, minigiochi, online) | `docs/MAPPA-GIOCO.md` |
| Toccare Ada e Teo (motore, prompt, vita, banca, lavori, giochi) | `docs/AGENTI.md` |
| Costruire, provare, pubblicare, aprire la PR | `docs/LAVORARE.md` |

## Regole fisse

- **Build**: il gioco pubblicato è `index.html`, generato. Non si legge e non si modifica a mano: modifica `src/`, poi `node strumenti/costruisci.mjs`, e fai il commit di `src/` **e** `index.html`. La CI fallisce se non coincidono.
- **File da non leggere** (pesanti, generati o di terzi): `index.html` (3,7 MB), `src/librerie/` (three.js, gltf-loader, peerjs), `src/dati/` (immagini in base64), `img/`, `modelli/*.glb`, `agenti/package-lock.json`. Sono esclusi dalle ricerche con `.ignore`; se ti servono davvero usa `rg --no-ignore`.
- **File grandi**: `agenti/motore.mjs` (133 KB) e `src/minigiochi/cripta/gioco.js` (362 KB) non si leggono interi: cerca la funzione con Grep e leggi solo quelle righe.
- **Repo**: si lavora solo su `kovacicboris94-sudo/the-borg-copia`. Mai su `laughbot/the-borg` (vecchio). La cartella `/mnt/project-files/the-borg/progetto/` e `The-Borg-gioca.html` sono ferme a ottobre: mai costruire da lì.
- **Altri thread** lavorano su `main` insieme a te: prima di toccare `agenti/motore.mjs` o `src/borgo/agenti-ia.js` fai `git fetch origin main` e unisci main nel tuo ramo.

## Regole di Boris (il proprietario)

- Parla con lui in italiano semplice, senza gergo tecnico.
- Quando una PR è provata, il thread la unisce da solo su `main` (GitHub Pages si aggiorna) e poi gli dice in parole semplici cosa è cambiato. Eccezione: quello che cambia il comportamento di Ada e Teo si discute prima con lui e si annota nel diario dello studio (vedi `docs/AGENTI.md`).
- Niente spese (server, domini, abbonamenti, store) senza aver confrontato le opzioni e avuto il suo "vai".
- Progetto serio, destinato agli store. Stile 3D (niente pixel art 2D).
- Minigiochi: li sceglie lui. Puoi proporre idee, non crearne di nuovi senza richiesta.
- Sparatutto: meccaniche come COD Mobile ma nessun nome, arma o mappa di COD; nessun nome di Destiny nella Cripta.
- Tutto quello che si aggiunge al borgo deve poterlo usare anche Ada e Teo (motore + prompt).
- Ada e Teo: nessun carattere o scopo assegnato, non cambiano il codice, non chiedono soldi ai giocatori, la morte è vera. Un pensiero produce una sequenza intera di azioni (risparmia token).
- Sponsor: loghi e link restano nascosti finché Boris non li approva nel pannello di moderazione.
- La chiave Anthropic sta solo nei Secret di Cloudflare: mai in chat, nel repo o nei log.
