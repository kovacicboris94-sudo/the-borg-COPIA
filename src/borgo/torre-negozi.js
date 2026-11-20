/* =====================================================================
   THE BORG - I NEGOZI DELLA TORRE DELLA COMETA
   Un negozio per piano (da 1 = primo piano a 15 = quindicesimo). Un piano senza
   negozio usa il gruppo condiviso dei piani vuoti; con il negozio ha il suo.
   null = "spazio libero": il piano resta vuoto, con il cartello e il gesso
   sul pavimento dove andranno bancone, scaffali e tavoli.

   Per aprire un negozio basta scrivere qui un oggetto con:
     nome       nome del negozio (bacheca fuori dalla torre, bacheca dell'ingresso,
                scala, titolo della stanza, pulsante al bancone)
     insegna    testo dell'insegna sopra il bancone (facoltativo: se no, il nome in maiuscolo)
     colore     colore di fondo dell'insegna e delle tovaglie (es. '#2f2342')
     accento    colore del bordo dell'insegna, del piano del bancone e degli scaffali
     testo      colore delle lettere dell'insegna (facoltativo)
     azione     testo del pulsante al bancone (facoltativo, es. 'Guarda la merce')
     apri()     cosa succede al bancone: di solito apre il pannello del negozio
     arredo(kit)  facoltativo: mette la merce. kit contiene:
                  kit.scaffali  12 posti (4 scaffali x 3 ripiani): { x, y, z, rot, larg }
                  kit.tavoli    2 tavoli da vetrina: { x, y, z, larg, prof }
                  kit.bancone   { x, y, z, larg }
                  kit.gruppo    dove aggiungere le mesh (coordinate della stanza)
                  kit.T, kit.M, kit.mesh, kit.B   three.js e gli aiuti del borgo
                  kit.anim      lista di funzioni (t, dt) chiamate a ogni fotogramma
                  kit.ostacoli  collisioni ({ t: 'c', x, z, r } oppure { t: 'b', x0, x1, z0, z1 })
   Bancone, scaffali e tavoli li costruisce torre.js: stanno sempre negli stessi
   posti, cosi' ogni negozio ha la stessa struttura.

   Esempio:
     1: {
       nome: 'Bottega delle Stelle', insegna: 'BOTTEGA DELLE STELLE',
       colore: '#2f2342', accento: '#f2c76e', azione: 'Guarda la merce',
       apri: () => window.Gioco.emetti('toast', 'Benvenuto alla Bottega delle Stelle!'),
       arredo: kit => kit.scaffali.forEach(s => {
         const m = kit.mesh(new kit.T.BoxGeometry(0.3, 0.4, 0.3), kit.M('#7fe3ff'), { x: s.x, y: s.y + 0.2, z: s.z, l: 0.01 });
         kit.gruppo.add(m);
       })
     },
   ===================================================================== */
(function () {
  'use strict';
  const B = window.B3;
  B.TORRE_NEGOZI = {
    // 1: { nome: ..., ... }   (vedi sopra; i piani non scritti qui sono spazi liberi)
  };
})();
