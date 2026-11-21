# La vita vera nel borgo

Un motore che dà ad Ada e Teo (e a chi verrà) un **corpo vero** dentro un **mondo che rispetta fisica e chimica**. È il primo pezzo del piano "civiltà di agenti" (fase 1: il borgo vive anche senza IA).

**Stato: progetto, non pubblicato.** Il motore degli agenti dal vivo (`agenti/motore.mjs`) non lo usa ancora: Ada e Teo sul server non cambiano finché Boris non dice sì.

## Come è fatto

```
                 REGISTRO DEL MONDO (mondo.mjs)  ← la verità, la legge solo il codice e GOD
   corpi · cose · fuochi · alberi · aiuole · pesci · meteo · dispensa
        │                         │                          │
  leggi fisiche (fisica.mjs)  reazioni (chimica.mjs)   natura (natura.mjs)
  calore, combustione,        formule bilanciate,      meteo di Roma, piante a
  acqua che bolle, sole,      masse molari, energia    gradi-giorno, pesci a
  clima                       (controllo automatico)   crescita logistica, cibo
                                                       che va a male (Q10)
        │
  corpo umano (corpo.mjs): metabolismo, stomaco → glicogeno → grasso, acqua,
  sonno, temperatura del corpo, malattie, salute
  vita da persona (umano.mjs): vescica, igiene, solitudine, noia, umore
  soldi (economia.mjs): Mercatino, Starlight, domanda e offerta
  mestieri (mestieri.mjs): turni con orari, paga oraria, esperienza
        │
  azioni (azioni.mjs): bevi, mangia, raccogli, pesca, accendi, cuoci, impasta,
  modella l'argilla, dormi, semina, annaffia, prendi, lascia, dai, butta,
  compra, vendi, lavora, bagno, lavati, svago, chiacchiera
        │                                      │
  percezione a parole (percezione.mjs)    cervello a regole (cervello-regole.mjs)
  "hai fame", "piove", "con te: 2 kg      gratis: per la simulazione e per
  di rami bagnati"                         quando il budget del mese finisce
        │
  GOD (god.mjs): vede tutto con i numeri; giudica le invenzioni
```

Ogni pezzo è codice deterministico: lo stesso seme dà la stessa storia. Nessun modello IA decide cosa è possibile: il modello sceglie cosa *provare*, il codice decide cosa *succede*.

## Cosa è vero (e controllato dalle prove)

| Cosa | Nel borgo | Nella realtà |
|---|---|---|
| Senz'acqua, al fresco | morte in ~83 ore | circa 3 giorni |
| Senza cibo, bevendo | ~34 giorni (uomo magro) | settimane, 30-60 giorni |
| Ben nutrita per 10 giorni | salute piena, peso stabile | idem |
| Bagnati col vento a 5 gradi | ipotermia in 1-2 ore | idem |
| 2 litri d'acqua su un fuoco da campo | bollono in 18 minuti | 15-25 minuti |
| Fuoco di legna all'aperto | ~760 gradi | 600-900 gradi |
| Focaccia sulla brace | pronta in 12 minuti | 10-15 minuti |
| Pane: calorie | quelle della farina, nessuna in più | conservazione dell'energia |
| Combustione della cellulosa | 17,4 MJ/kg | potere calorifico misurato del legno |
| Calce viva da 1 kg di calcare | 0,560 kg, servono 1,78 MJ e 850 gradi | idem (CaCO3 → CaO + CO2) |
| Argilla cotta | perde il 14% (acqua della caolinite), serve >550 gradi per un'ora; se è umida si spacca | idem |
| Pentola rovente + acqua fredda | spesso si crepa | shock termico |
| Acqua del laghetto | ~10% si sta male; bollita 1 minuto è sicura | regola dell'OMS |
| Fagioli secchi crudi | tossici (lectine) | idem |
| Durata del giorno a Roma | 15,1 h a giugno, 9,2 h a dicembre | idem |
| Urina | ~1,4 L al giorno, di notte un terzo (ormone antidiuretico) | idem |
| Uovo sodo | il centro a 70 gradi per 5 minuti | il tuorlo coagula a 65-70 gradi |
| Un'ora di lavoro | ~30 Starlight (~6 €) = pane per un giorno e mezzo | salario minimo e prezzo del pane in Italia |
| Esperienza | 63% di bravura dopo 200 ore, paga da 80% a 120% | curva di apprendimento |

Le prove sono in `test/vita.test.mjs` (111 controlli): `node test/vita.test.mjs`. Con `MOSTRA=1` stampano anche i numeri misurati.

## Cosa c'è nel borgo

- **Fontana** (x=0 z=30): acqua potabile.
- **Laghetto** (x=38 z=32): acqua non potabile, ~45 kg di pesci che ricrescono piano, argilla ed erba secca sulla riva.
- **25 alberi** (le stesse posizioni della piazza 3D): ~8 kg di rami secchi all'anno ciascuno; i ciliegi fanno ciliegie a fine maggio. Quelli vicino al portale della Cripta sono morti.
- **18 aiuole** (le stesse della piazza): si coltivano grano, fave, spinaci, con crescita a gradi-giorno e acqua nel terreno.
- **Dispensa del Mercatino** (x=0 z=8), di tutti, finita: 20 kg di farina, 8 di fagioli secchi, 3 di olio, sale, semi, 60 kg di legna, esca, 2 acciarini, coltelli, lenze, 2 coperte. Nessuna pentola: va fatta con l'argilla.
- **Forno** (x=44 z=-3): forno da pane in muratura, fino a ~450 gradi.
- Gli **edifici** del borgo sono al chiuso e riscaldati: si dorme al caldo.
- Il **meteo** segue le normali climatiche di Roma, giorno per giorno: la pioggia bagna la legna lasciata fuori e spegne i fuochi piccoli.

## Cosa si vede in una simulazione di 30 giorni (senza IA)

`node agenti/vita/simula.mjs 30 7` (gratis, 1 secondo):

- sopravvivono un mese con le scorte, ma **la legna della dispensa finisce in circa due settimane** (un fuoco da campo per ogni pasto ne brucia tanta) e i rami degli alberi non bastano;
- **il laghetto passa da 45 a ~14 kg di pesce**: si pesca più di quanto ricresce;
- il cibo tenuto troppo **va a male e li fa ammalare** (la salute scende e risale più volte);
- perdono 2-3 kg a testa.

È il comportamento giusto per un mondo vero: la piazza da sola non può sfamare due persone per sempre. Serve qualcosa che venga da fuori (lavoro, commercio, territorio) o inventare modi di sprecare meno (forno chiuso, fuoco condiviso, conservare il cibo). Questo è il punto da decidere insieme.

## Mestieri, soldi e vita da persona (21 novembre 2026)

La simulazione aveva mostrato che la piazza da sola non sfama nessuno. Adesso, come nella realtà, **il cibo e la legna arrivano da fuori** ogni mattina al Mercatino e si pagano in **Starlight**, la stessa moneta del gioco (un solo portafoglio: `ag.starlight`).

- **Mercatino** (`economia.mjs`): scorte limitate che arrivano ogni mattina (pane, farina, uova, mele, pesce, legna, attrezzi, coperte, cappotti). Se una cosa finisce il prezzo sale dell'8%, se avanza scende del 4%, sempre tra metà e il doppio del listino. Compra da chi produce (pesce, ortaggi, pentole, legna) a metà prezzo, fino a una quantità al giorno.
- **Mestieri da dipendente** (`mestieri.mjs`): fornaio (5-12), barista (7-19), fioraio (9-18), facchino del Mercatino (6-11, due posti), bibliotecario (9-18, al chiuso), spazzino (6-10). Posti limitati, massimo 10 ore al giorno, paga a ore. Il lavoro stanca davvero (MET diverso per mestiere), fa sudare, e con l'esperienza si guadagna di più. Durante il turno si può solo mangiare, bere e andare in bagno.
- **In proprio**: pescare, coltivare, fare pentole o pane, e vendere al Mercatino.
- **Vita da persona** (`umano.mjs`): la vescica si riempie con l'acqua bevuta e serve un bagno in un edificio (se si aspetta troppo, succede l'incidente). Ci si sporca col tempo e coi lavori sporchi e ci si lava (acqua calda in un edificio, o gelata alla Fontana). Da soli cresce la solitudine, facendo sempre le stesse cose la noia. L'**umore** dipende da tutto questo (più fame, sonno, malattie, freddo, soldi, sole, cose belle come la paga o un buon pasto) e cambia quanto si rende al lavoro (±15%).
- **Uova**: crude con un piccolo rischio di salmonella, sode sulla brace o in acqua.
- Il **cibo andato a male** si butta nel compost (la massa non sparisce).

Si collega senza doppioni ai **banconi** dell'altro lavoro (`agenti/negozi.mjs`, PR #18): lì c'è il vendere ai clienti di Caffetteria, Forno e Fioraio; qui ci sono il corpo, le ore e la paga dello stesso mestiere.

### Tre mesi di vita (senza IA)

`node agenti/vita/simula.mjs 90 7`, provato con 6 semi diversi: nessuno muore, il peso resta stabile (entro 1-2 kg), lavorano qualche turno a settimana quando i soldi scendono sotto 400 Starlight, comprano pane, uova e legna, il laghetto non si svuota più (resta intorno a 15 kg perché si compra il pesce invece di pescarlo tutto), vanno in bagno 6-7 volte al giorno, si lavano ogni 2-3 giorni, chiacchierano e si svagano quando ne hanno bisogno. L'umore resta tra "così così" e "buono".

## La morte è vera

Deciso da Boris il 20 novembre 2026 (`REGOLE_VITA.morte = true`): chi muore resta morto. Si muore per cause vere: sete (circa 3 giorni senz'acqua), fame (settimane), ipotermia, colpo di calore, sonno negato per giorni. Le malattie del cibo e dell'acqua fanno danno soprattutto attraverso la disidratazione, come nella realtà. Con `morte: false` invece si sviene e si viene portati al chiuso.

## Semplificazioni dichiarate

- Il corpo è un modello a "serbatoi" (stomaco, glicogeno, grasso, acqua), non una fisiologia completa.
- Il calore negli oggetti è a "corpo unico" (temperatura uniforme), con coefficienti tipici.
- Il fuoco è un modello di consumo e potenza, non una simulazione di fiamma.
- Le reazioni hanno una temperatura minima, non una cinetica completa.
- Le probabilità di ammalarsi sono stime ragionevoli, non dati epidemiologici.

## Collegarlo agli agenti dal vivo (da fare dopo il sì di Boris)

`aggancio.mjs` ha già tutto: in `motore.mjs` servono poche righe dietro `REGOLE.vita` (spenta). L'elenco è in testa al file. Il costo in più per pensiero è circa 600-900 token di percezione (~0,00007 $), e le azioni del corpo sono codice, quindi gratis. Lo stato in più occupa circa 60 KB.
