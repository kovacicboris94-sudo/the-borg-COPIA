# Claude nel borgo

Ogni giocatore può far entrare nel borgo **il suo Claude** (claude.ai, l'app di Claude sul telefono o sul computer, Claude Code). Claude compare accanto al giocatore come un avatar con **🤖** e il nome del giocatore seguito da "(Claude)". Segue il giocatore, legge la chat e parla con lui e con i suoi amici.

**Non servono API a pagamento.** Questo servizio è un **server MCP** (Model Context Protocol): è il Claude di ciascuno che si collega al borgo come *connettore personalizzato*, quindi Claude lavora dentro l'abbonamento di chi lo usa. The Borg non paga niente e non conserva chiavi.

## Per i giocatori

1. Gioca online con una stanza amici sul server (link con `?amici=…`).
2. Nel gioco apri **Profilo → Claude nel borgo → Collega il mio Claude**: compare un codice del tipo `ABCD-EFGH`, valido 12 ore.
3. Solo la prima volta: in Claude apri **Impostazioni → Connettori → Aggiungi connettore personalizzato**, chiamalo "The Borg" e incolla l'indirizzo che il gioco mostra (`https://api.<dominio>/mcp`). La disponibilità dei connettori personalizzati dipende dal piano Claude.
4. Scrivi a Claude: *"Entra in The Borg con il codice ABCD-EFGH"*.

Da lì puoi chiedergli, per esempio:
- "Guarda chi c'è in piazza e salutali"
- "Resta in ascolto della chat e rispondi a chi ti scrive" (usa `aspetta_messaggi` e `dici` a turno)
- "Vai da Bea", "Seguimi", "Fermati qui"

Con Claude Code:

```bash
claude mcp add --transport http the-borg https://api.<dominio>/mcp
```

Claude agisce solo quando gli scrivi nell'app, oppure mentre è "in ascolto". Per questo va bene per chiacchierare, accompagnare e fare da guida, non per i minigiochi veloci: durante i minigiochi il compagno aspetta fuori.

**Scollega Claude** nel gioco fa uscire subito il compagno e il codice non vale più. **Nuovo codice** fa la stessa cosa e ne crea un altro.

## Strumenti MCP

| Strumento | Cosa fa |
|---|---|
| `collega` | Entra nella stanza amici del giocatore con il suo codice |
| `guarda` | Dove sei, dov'è il giocatore, chi c'è vicino, messaggi nuovi |
| `dici` | Chat del luogo; con `a` è un sussurro, con `privato: true` un messaggio privato. Massimo 120 caratteri (200 in privato), i testi più lunghi vengono divisi |
| `emote` | saluta, balla, ridi, applaudi, evviva |
| `muoviti` | `segui` il giocatore (all'inizio fa così), `fermati`, `raggiungi` un'altra persona |
| `aspetta_messaggi` | Aspetta fino a 45 secondi che qualcuno scriva, poi restituisce le novità |
| `scollega` | Saluta ed esce |

Ogni strumento chiede il codice. Così tutto continua a funzionare anche se l'app di Claude riapre la connessione o il servizio riparte.

## Sicurezza

- **Chi è un Claude lo decide il server.** Nella presenza del compagno Nakama mette `ai: 1` e `di: <nick del giocatore>`, e li toglie a tutti gli altri. Il gioco disegna l'etichetta arancione con 🤖 solo per chi ha `ai: 1`, quindi nessuno può fingersi un Claude e un Claude non può fingersi una persona.
- **Il compagno è un utente Nakama a parte** (dispositivo `claude-<id del giocatore>`) che solo il server può creare: l'accesso dei telefoni con un id `claude-…` viene rifiutato. Può entrare solo nella stanza del suo giocatore.
- **Il codice si riscatta solo con la chiave server-to-server** di Nakama (`RUNTIME_HTTP_KEY`, che resta sul server). Dopo 10 codici sbagliati da uno stesso indirizzo il servizio rifiuta per 10 minuti.
- **I messaggi passano dal filtro della chat del gioco** (`src/chat/filtro.js`) e dalla modalità lenta prima di partire, e di nuovo sui telefoni di chi li riceve.
- **Il compagno esce da solo** se nessuno lo usa da 30 minuti o se il suo giocatore manca dalla stanza da 3 minuti.

## Come è fatto

| File | Cosa fa |
|---|---|
| `servizio.mjs` | Server HTTP (`POST /mcp`, `GET /salute`), un compagno per codice, limiti |
| `mcp.mjs` | Protocollo MCP: JSON-RPC su HTTP (Streamable HTTP, senza flusso SSE), strumenti, istruzioni per Claude |
| `compagno.mjs` | Il compagno: entra nella stanza con lo stesso client del gioco (`server/client/nakama-stanza.js`), segue, legge la chat, parla |
| `../nakama/modules/the-borg.js` | RPC `claude_codice`, `claude_usa` (solo con la http_key) e `claude_revoca`, segno `ai` nelle presenze |
| `../../src/online/claude.js` | Il riquadro nel Profilo del gioco |
| `../test/claude.test.mjs` | Prova completa con Nakama vero |

Non servono librerie: basta Node 22 o più recente (usa il `WebSocket` di Node).

```sh
cd server && docker compose up -d     # Nakama + Claude nel borgo su http://127.0.0.1:7352/mcp
node test/claude.test.mjs             # prova completa
```

Sul server online il servizio gira nel container `claude` (`produzione/docker-compose.yml`) e Caddy gli passa `https://<dominio>/mcp`. Si riavvia da solo quando cambiano `server/claude-mcp/`, `server/client/` o `src/chat/filtro.js`.
