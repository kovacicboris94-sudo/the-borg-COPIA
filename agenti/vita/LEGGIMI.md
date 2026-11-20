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
        │
  azioni (azioni.mjs): bevi, mangia, raccogli, pesca, accendi, cuoci, impasta,
  modella l'argilla, dormi, semina, annaffia, prendi, lascia, dai
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

Le prove sono in `test/vita.test.mjs` (74 controlli): `node test/vita.test.mjs`. Con `MOSTRA=1` stampano anche i numeri misurati.

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

## Semplificazioni dichiarate

- Il corpo è un modello a "serbatoi" (stomaco, glicogeno, grasso, acqua), non una fisiologia completa.
- Il calore negli oggetti è a "corpo unico" (temperatura uniforme), con coefficienti tipici.
- Il fuoco è un modello di consumo e potenza, non una simulazione di fiamma.
- Le reazioni hanno una temperatura minima, non una cinetica completa.
- Le probabilità di ammalarsi sono stime ragionevoli, non dati epidemiologici.

## Collegarlo agli agenti dal vivo (da fare dopo il sì di Boris)

`aggancio.mjs` ha già tutto: in `motore.mjs` servono poche righe dietro `REGOLE.vita` (spenta). L'elenco è in testa al file. Il costo in più per pensiero è circa 400-700 token di percezione (~0,00007 $), e le azioni del corpo sono codice, quindi gratis. Lo stato in più occupa circa 60 KB.
