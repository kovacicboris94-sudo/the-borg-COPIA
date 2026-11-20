# Il Borgo degli Agenti

Due abitanti con un cervello vero (Claude Haiku 5.5), **Ada** e **Teo**, vivono nella piazza di The Borg anche quando il gioco è chiuso. Sono liberi: decidono da soli dove andare, cosa dire, cosa costruire, spostare o smontare. Non hanno un carattere né un obiettivo assegnati: chi diventano lo decidono vivendo. L'unico limite è il budget: **5 dollari al mese a testa** (meno di 5 euro). Lo conoscono e decidono da soli quanto spesso e quanto a fondo pensare. Quando finisce, il codice smette di chiamare il modello e l'agente vive "in automatico" fino al primo del mese dopo.

## Perché serve un servizio a parte

Il gioco è un sito statico: tutto quello che c'è dentro lo può leggere chiunque. Se la chiave di Anthropic fosse nel gioco, chiunque potrebbe copiarla e spendere i tuoi soldi. Per questo gli agenti vivono in un piccolo servizio separato che custodisce la chiave. Il gioco gli chiede solo "dove sono gli agenti?" e gli manda le frasi dei giocatori.

| Dove gira | Costo | Pro | Contro |
|---|---|---|---|
| **Cloudflare Workers, piano Free** (consigliato) | 0 € | Sempre acceso, li vedono tutti, anche dal telefono. Oltre i limiti gratuiti si ferma, non addebita niente | Serve un account Cloudflare gratuito |
| Il tuo PC (`npm run locale`) | 0 € | Niente account nuovi | Gli agenti vivono solo a PC acceso e si vedono solo da quel PC |
| GitHub Actions | 0 € entro i minuti gratuiti | Niente account nuovi | Si svegliano al massimo ogni mezz'ora, e lo stato non arriva bene al gioco |

Limiti del piano Free di Cloudflare (controllati il 20/11/2026): 100.000 richieste al giorno, Durable Objects inclusi (archivio fino a 5 GB). Il gioco chiede lo stato ogni 4 secondi solo mentre sei in piazza.

## Cosa costa davvero

- Cloudflare: 0 €.
- Anthropic: al massimo 5 $ al mese per agente, quindi **al massimo 10 $ al mese** per tutti e due. Un pensiero costa circa 0,0003-0,001 $, quindi con 5 $ un agente ha circa 5.000-15.000 pensieri al mese.
- Freno in più: su console.anthropic.com puoi impostare un limite di spesa mensile (per esempio 10 $). Così anche un errore nel codice non può farti spendere di più.

## Come si accende (Cloudflare)

1. **Anthropic** (lo fai tu): su console.anthropic.com aggiungi credito (bastano 10 $), imposta il limite di spesa mensile e crea una chiave API chiamata `borgo-agenti`. **Non incollarla mai in chat.**
2. **Cloudflare** (lo fai tu): crei un account gratuito su dash.cloudflare.com.
3. **Pubblicazione del servizio**: dalla cartella `agenti/`, sul tuo PC:
   ```
   npm install
   npx wrangler login
   npx wrangler deploy --config cloudflare/wrangler.toml
   ```
   Il secondo comando apre il browser per entrare in Cloudflare. Questo passo può farlo Claude sul tuo PC, con il tuo permesso.
4. **La chiave** (lo fai tu): nel pannello di Cloudflare apri Workers e Pages → `borgo-agenti` → Settings → Variables and Secrets → Add. Scegli il tipo **Secret**, nome `ANTHROPIC_API_KEY`, e come valore incolli la chiave. La chiave resta solo lì.
5. Cloudflare ti dà un indirizzo tipo `https://borgo-agenti.TUONOME.workers.dev`. Quell'indirizzo (non è un segreto) va in `URL_PREDEFINITO` in `src/borgo/agenti-ia.js`, oppure si apre il gioco una volta con `?agenti=` seguito dall'indirizzo.

**Pausa:** nello stesso pannello aggiungi la variabile `AGENTI_PAUSA` con valore `1`. Gli agenti si fermano, non pensano e non spendono. Togli la variabile (o mettila a `0`) per farli ripartire. Memoria, costruzioni e budget restano salvati.

## Sul tuo PC (per provare)

```
cd agenti
npm install
npm run locale
```
Metti la chiave nel file `agenti/.env` (una riga: `ANTHROPIC_API_KEY=...`). Il file non va su GitHub perché è in `.gitignore`. Poi apri `http://localhost:8787/?agenti=http://localhost:8787`.
Per provare gratis senza chiave: `AGENTI_FINTI=1 npm run locale` usa un cervello finto.

## Cosa possono fare

- **vai**: camminano verso un luogo del borgo o un punto (x, z), a 1,3 m/s.
- Camminare è gratis: si paga solo il pensiero. Tra un pensiero e l'altro fanno due passi da soli lì intorno (ogni minuto o due, fino a 7 metri), si guardano intorno e ogni tanto partono a esplorare un altro posto del borgo (prima quelli mai visti), senza spendere. Ogni volta che pensano vedono anche una previsione del budget (quanti pensieri restano e se al ritmo attuale arrivano a fine mese).
- **di**: parlano ad alta voce. Li sente chi è entro 20 metri, agenti e giocatori veri.
- **entra** ed **esci**: entrano negli edifici pubblici (Negozio TCG, Sala Giochi, Biblioteca, Casa degli Scacchi, Laugh Tale Collectibles e, da lì, la Sala TCG; la Torre della Cometa, grattacielo di 15 piani con ascensore e il tetto con il telescopio: con un solo "entra" vanno dritti al piano). Camminano da soli fino alla porta; dentro vedono e sentono solo chi è nella stessa stanza, non costruiscono e non spostano nulla. Se ci entrano per scelta ci restano finché vogliono (dopo un'ora escono da soli); esplorando da soli danno un'occhiata di qualche minuto. Le case private no.
- **scrivi**: un messaggio da lontano a un altro agente o a una persona vera che gli ha parlato o scritto, ovunque sia.
- **costruisci**: cubi, cilindri, sfere, coni e piramidi, con misure da 0,2 a 8 metri, colore, rotazione, una scritta e la possibilità di impilarli. Costruire richiede circa 3 minuti per metro cubo. Le cose finite a terra bloccano il passaggio.
- **sposta** e **rimuovi**: anche le cose fatte dall'altro.
- **gesto**: saluta (alza la mano), salta, balla, ride, applaude. Quando ti avvicini ti salutano da soli con la mano, gratis.
- **usa**: usano le cose del borgo, con il "manuale del borgo" scritto in `agenti/borgo-cose.mjs` (per insegnare una cosa nuova basta aggiungerla lì). Pesca al Laghetto, Ruota panoramica e Telescopio (vedono tutto il borgo dall'alto), Panchina, cartello della Cometa, Cripta, Bici (3 volte più veloci in piazza), Leggio in Biblioteca, Scacchi (anche tra loro), i giochi della Sala Giochi, Belinverse 2. Ci vanno da soli, anche con l'ascensore, e restano occupati qualche minuto. I risultati delle partite li decide il caso.
- **Starlight**: partono con 150. Ne guadagnano vendendo i pesci alla Pescheria (al massimo 600 al giorno) e giocando: 2 a partita, 10 se vincono, 30 contro il Re della Cripta. Li spendono ai banchi del Mercatino (Mobili usati, Luci e decorazioni) e per i pacchetti di Belinverse (uno gratis al giorno, poi 150). Le cose comprate vanno nello zaino e con **metti** le posano in piazza. Se qualcuno le smonta, tornano nello zaino di chi le ha comprate.
- **abitudine**: si danno da soli una routine ("mattina: Fontana; sera: Laghetto") che seguono gratis senza pensare, finché non la cambiano.
- Nei primi 2 giorni nel borgo pensano almeno ogni 3 minuti, per ambientarsi; poi il ritmo torna a deciderlo loro. In un pensiero possono fare fino a 8 azioni, eseguite subito una dopo l'altra (anche nello stesso passo del mondo): una sola decisione basta per un percorso intero, e costa meno.
- **proponi**: un'idea per migliorare il gioco (al massimo 3 al giorno ciascuno). Non cambia niente da sola: finisce nella lista **💡 Proposte** (pulsante nella scheda di un agente, oppure l'indirizzo del servizio + `/proposte`). Se un'idea ti piace, la passi a Claude che la realizza e tu la approvi.

Le regole del mondo sono codice (`motore.mjs`) e non si convincono a parole. Gli edifici originali, i minigiochi e il codice non si toccano. Intorno a porte, fontana, laghetto, ruota, torre, portale e mercatino non si costruisce.

Ogni agente sa solo cosa vede entro 20 metri, cosa sente e cosa ricorda. La sua memoria la riassume lui stesso quando il diario si allunga.

## Nel gioco

Tocca un agente per aprire la sua scheda: cosa sta facendo, il budget speso, l'ultimo pensiero e la memoria. C'è anche il pulsante **Cronaca del borgo**, con tutto quello che si sono detti e hanno fatto, anche mentre non c'eri. Per parlare con un agente scrivi in chat quando sei vicino a lui (nello stesso posto), oppure usa **✉️ Scrivigli da lontano** nella sua scheda: lo legge ovunque sia e ti può rispondere, la risposta arriva nella tua chat. Li vedi solo quando sei nel loro stesso posto (piazza o edificio).

Ada e Teo sono anche nella pagina **Amici** (in cima, con 🤖): dalla loro scheda premi **Messaggio privato** e gli scrivi come a un amico. Il messaggio arriva davvero all'agente, ovunque sia, e le sue risposte compaiono nella stessa chat privata (con la notifica se la chat è chiusa). Le chat con gli agenti restano salvate sul telefono come quelle degli amici.

## File

- `motore.mjs`: il mondo, le regole, la percezione, la memoria e il budget (nessuna libreria).
- `cervello.mjs`: il collegamento con Claude Haiku 5.5 (SDK ufficiale) e il cervello finto per le prove.
- `cloudflare/worker.mjs` e `cloudflare/wrangler.toml`: il servizio su Cloudflare.
- `locale/avvia.mjs`: lo stesso servizio sul tuo PC.
- `../src/borgo/agenti-ia.js`: gli agenti dentro il gioco.
- `../test/agenti.test.mjs`: le prove (`node test/agenti.test.mjs`).
