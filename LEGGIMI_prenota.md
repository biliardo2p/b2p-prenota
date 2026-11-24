# Prenota 2P · LEGGIMI

App web per prenotare i biliardi dell'**ASD Biliardo Seconda Passione**.
Indirizzo: **https://biliardo2p.github.io/b2p-prenota/** — repository `biliardo2p/b2p-prenota` — copia sul PC in `OneDrive\Biliardo\Prenota\`.

È un applicativo **separato** dal Tabellone Live e dal Gestionale ASD: progetto Firebase, repository e cartella propri.
Ha in comune con loro solo lo stack (sito statico, JavaScript classico, Firebase via REST).

## Firebase

| Voce | Valore |
|---|---|
| Progetto | `b2p-prenota` (piano gratuito Spark, account privato di Enrico, trasferibile al circolo) |
| Database | Realtime Database `https://b2p-prenota-default-rtdb.europe-west1.firebasedatabase.app` |
| Accesso | Authentication email/password, registrazione aperta **con approvazione**; provider **Anonimo** per gli ospiti |
| Domini autorizzati | `biliardo2p.github.io` |
| Regole | `regole_database.json`: si incollano e si pubblicano **a mano** nella console (Realtime Database → Regole), dopo averne salvata una copia `.bak` |

## File

```
index.html               pagina unica dell'app
manuale.html             istruzioni per i soci
statistiche.html         solo rimando ai vecchi collegamenti: apre la scheda Statistiche dell'app (./#statistiche)
privacy.html             informativa privacy (artt. 13-14 GDPR); le parti evidenziate «da-completare» le compila il direttivo
manifest.webmanifest     app installabile "Prenota 2P" (scope /b2p-prenota/)
css/prenota.css          colori e caratteri (come il Tabellone Live)
css/statistiche.css      stile della scheda Statistiche
js/config.js             Firebase e impostazioni della sala (biliardi, orari, durata, scadenze)
js/util.js               utilità, stato condiviso, orari nel fuso di Roma
js/dati.js               login, lettura/scrittura e ascolto in tempo reale via REST
js/griglia.js            griglia (oggi/domani), selezione, trascinamento
js/prenotazione.js       nuova prenotazione, modifica, dettaglio, "Gioco io", annulla, scadenze, prenotazioni degli ospiti
js/bacheca.js            chi cerca un avversario
js/soci.js               profilo e gestione soci (admin)
js/avvio.js              accesso, registrazione, schede, avvio
js/statistiche.js        scheda Statistiche: calcolo e grafici, esportazione CSV (apriStatistiche() all'apertura della scheda)
regole_database.json     regole di sicurezza del database
img/                     logo e icone del circolo
```

Gli script sono classici (non moduli) e si caricano in ordine; ogni link a js/css ha `?v=AAAAMMGGNN`,
da aumentare a ogni modifica. Le chiavi salvate nel browser hanno prefisso `b2pp_` (il dominio è lo stesso del Tabellone).
Nel browser resta solo la sessione (gettone e gettone di rinnovo), **mai la password**.

Connessioni: il Realtime Database via REST usa connessioni HTTP/1.1 e il browser ne permette circa 6 contemporanee verso
lo stesso indirizzo, sommando tutte le schede e finestre. Per questo ogni scheda tiene aperto **un solo ascolto**:
le prenotazioni (per gli ospiti le caselle `slot`) delle ultime due giornate, con la query
`orderBy="$key"&limitToLast=2` (le regole permettono la lettura di `prenotazioni` e `slot` solo con questa query, oltre
all'amministratore). I soci cambiano di rado: si rileggono ogni 30 secondi e subito dopo ogni scrittura.
Una scheda non in primo piano chiude tutto e riapre quando torna visibile; ogni richiesta ha un tempo massimo
(20 s per le scritture, 40 s per le letture) oltre il quale l'app mostra un messaggio invece di restare bloccata, chiude
la finestra e ricarica la situazione. Un ascolto muto per più di 70 secondi viene riaperto da solo.
Se l'ascolto in tempo reale non riceve nulla entro 12 secondi (connessioni occupate da altre schede o finestre dello
stesso browser), la scheda passa a rileggere le prenotazioni ogni 15 secondi (`ascoltaORileggi` in `js/dati.js`).

## Struttura dei dati

| Nodo | Contenuto |
|---|---|
| `soci/<uid>` | `nome`, `livello` (principiante, intermedio, esperto), `stato` (attesa, attivo, sospeso), `ruolo` (socio, admin), `nuovoFinoAl` (AAAA-MM-GG, badge "nuovo socio"), `padrino` (vero/falso), `creato` |
| `privati/<uid>` | `email` (la vedono solo il socio e gli amministratori) |
| `prenotazioni/<AAAA-MM-GG>/<id>` | `tavolo`, `min` (minuti dalla mezzanotte), `durata` (minuti), `inizio`/`fine`/`apertura` (ms), `titolare`, `titolareNome`, `avversario` (uid, se socio), `avversarioNome` (anche scritto a mano), `ospite` (vero se l'avversario non è socio), `daOspite` (vero se prenotata da un'utenza ospite), `stato` (aperta, confermata, da_confermare, annullata, scaduta), `livello`, `nota`, `scade` (ms), `partita`, `creata` |
| `slot/<AAAA-MM-GG>/<tavolo>/<HHMM>` | id della prenotazione che occupa quella mezz'ora: le regole permettono di scriverlo solo se è vuoto, così due prenotazioni non possono sovrapporsi |

## Regole di funzionamento

- Inizio dalle **8:00** alle **22:00**, a passi di 30 minuti; fine entro le **24:00**.
- Aperture (ora di Roma): partite che iniziano **prima delle 13** dalle **21 della sera prima**; partite **dalle 13 alle 22** dalle **9 del giorno stesso**.
  Valgono anche per chi gioca da solo. La griglia mostra oggi e domani.
- Si può prenotare anche un orario **già passato di oggi** (partita iniziata o giocata senza prenotare): le caselle sono
  più scure con un filo verde. Le regole accettano una prenotazione fino a 16 ore dopo il suo inizio (`now < inizio + 16 h`).
- Durata: un tocco propone **2 ore** (o meno, se prima della prenotazione successiva c'è meno spazio); si può allungare,
  accorciare e spostare (anche su un altro biliardo) trascinando il riquadro o con i pulsanti, da **30 minuti a 4 ore**.
  Il titolare può modificare la prenotazione finché non è iniziata.
- Modalità: con un'altra persona (nome scritto a mano, con suggerimenti dai soci; se coincide con un socio si collega
  alla sua scheda), da solo, **Cerco avversario**.
- **Ospiti**: "Entra come ospite" crea un'utenza anonima che resta sul dispositivo (tablet della sala o telefono).
  L'ospite vede i biliardi occupati senza nomi (per invogliare a registrarsi), prenota scrivendo i due nomi; la prenotazione occupa il biliardo
  ma resta **da confermare** finché un amministratore non la conferma (scheda Admin). Per spegnere gli accessi da ospite
  basta disattivare il provider Anonimo nella console.
- "Cerco avversario": max una richiesta aperta per socio; **scade 3 ore prima** dell'inizio e il biliardo si libera.
  Senza server, la richiesta scaduta la libera il primo socio che ha l'app aperta (le regole lo permettono solo dopo la scadenza).
- I padrini vedono un avviso quando un nuovo socio cerca un avversario.
- Niente partite programmate per i giorni successivi (tolte il 24/11/2026 per semplicità): si usa solo «Cerco un avversario».
- Le regole del database controllano: socio abilitato oppure ospite, aperture (21/9), orario (fino a 16 ore dopo l'inizio), durata e fine,
  scadenza, nomi coerenti con la scheda socio, chi può fare cosa (titolare, altro socio, ospite, amministratore).
- **Statistiche** (scheda dell'app `tab-stat`, per tutti i soci abilitati, non per gli ospiti; si ricarica a ogni apertura):
  settimana, mese o anno con frecce per scorrere i periodi; due viste:
  - **Circolo** — nessun nome: ore prenotate e occupazione (biliardi × 16 ore di apertura × giorni fino a domani),
    prenotazioni, giocatori diversi (solo il numero), annullate; andamento; ore per biliardo; tipo di partita;
    mappa giorni × ore; CSV senza nomi.
  - **Le mie** — solo le partite del socio collegato (titolare o avversario): ore, partite,
    biliardi, quando gioca, avversari (soci per scheda, non soci per nome), sue richieste «Cerco avversario»; CSV con i nomi.
  I soci leggono il nodo `prenotazioni` per intervallo di date (`orderBy="$key"`): regola `.read: A` (prima potevano
  già leggere una giornata alla volta).
- **Conservazione dei dati** (scheda Admin, in fondo):
  - «Togli i nomi dalle prenotazioni vecchie» (12/24/36 mesi; proposta `SALA.conservaMesi` = 24): titolare e avversario
    diventano `anonimo` / `Anonimo`, la nota sparisce; biliardo, orari, stato e tipo restano per le statistiche (che
    escludono `anonimo` da giocatori e soci più attivi).
  - «Cancella» nella scheda di un socio: prenotazioni future annullate (caselle liberate), nome tolto da tutte le sue
    prenotazioni (come titolare o avversario), poi `soci/<uid>` e `privati/<uid>`
    eliminati. L'utenza di accesso resta in Firebase Authentication: **va eliminata a mano dalla console** (l'app lo ricorda).
  - Regole: l'admin può solo sostituire nomi con `anonimo`/`Anonimo`, togliere la nota e annullare, senza toccare
    biliardo e orari; può cancellare `privati/<uid>`.
- Controllati solo dall'app (non dalle regole): una sola richiesta aperta per socio, niente due partite dello stesso socio
  nello stesso orario.

## Prima messa in funzione

1. Pubblica `regole_database.json` nella console (Realtime Database → Regole).
   Per gli ospiti: Authentication → Metodo di accesso → aggiungi **Anonimo** e abilitalo.
2. Apri l'app e accedi con l'utenza creata nella console: compare "Completa la registrazione"; scrivi nome e cognome.
3. Nella console, Realtime Database → Dati → `soci` → il tuo UID: cambia `stato` in `attivo` e `ruolo` in `admin`.
4. Ricarica l'app: compare la scheda **Soci**, da cui approvi gli altri.

## Prove

Sempre con **dati finti**: lo script Playwright intercetta tutte le chiamate a Firebase (login, lettura, ascolto,
scritture), quindi non tocca mai il database vero. Le regole non si possono provare senza l'emulatore di Firebase.

## Limiti noti

- Le date sono chiavi testuali: le regole non possono verificare che la data della prenotazione coincida con l'orario,
  né che le mezz'ore occupate in `slot` corrispondano esattamente alla prenotazione (lo garantisce l'app).
- Gli ospiti sono anonimi: chiunque abbia il link può prenotare (da confermare). Gli abusi si gestiscono annullando
  dalla scheda Admin o disattivando il provider Anonimo.
- Nei giorni del cambio d'ora le aperture possono slittare di un'ora.
- Un socio che ha detto "Gioco io" non può ritirarsi da solo: annulla il titolare o un amministratore.
- Niente notifiche: i soci vedono le novità aprendo l'app.

## Storia delle versioni

- **2026-11-24 (6)** — Statistiche come scheda dell'app («Statistiche», tra Avversari e Profilo); `statistiche.html` ora
  rimanda alla scheda. Barra delle schede più compatta sui telefoni. Regole invariate.
- **2026-11-24 (5)** — **Tolte le partite programmate** (scheda Partite, `js/partite.js`, ascolto e regole del nodo
  `partite`). **Regole cambiate**: il nodo `partite` non è più leggibile né scrivibile; i dati rimasti si possono cancellare
  dalla console. Resta il campo `partita` nelle prenotazioni vecchie (ignorato).
- **2026-11-24 (4)** — Partite programmate: richieste aperte nascoste agli altri quando l'orario è prenotabile,
  "Prenota e cerca avversario" per il proponente, avviso di prenotazione già presente, orari passati nascosti. Regole invariate.
- **2026-11-24 (3)** — Statistiche per tutti i soci: vista «Circolo» senza nomi (tolti «Soci più attivi» e «Cerco
  avversario» complessivo) e vista personale «Le mie». **Regole cambiate** (`prenotazioni/.read` = socio abilitato).
- **2026-11-24 (2)** — Scheda Admin: «Togli i nomi» dalle prenotazioni vecchie e «Cancella» socio. **Regole cambiate**
  (anonimizzazione da parte dell'admin, cancellazione di `privati` e `partite`).
- **2026-11-24** — Informativa privacy (`privacy.html`, linkata dall'accesso, dall'ospite e dal Profilo). Prenotazione
  di orari già passati di oggi, evidenziati a parte. Nuova icona dell'app (logo con calendario; file `img/icona-*`,
  richiamati con `?v=2` per forzare l'aggiornamento). **Regole cambiate** (`inizio > now` → `now < inizio + 16 h`).
- **2026-11-23 (5)** — Lettura immediata delle prenotazioni all'apertura, in parallelo all'ascolto: la griglia compare
  subito anche quando l'ascolto tarda a partire.
- **2026-11-23 (4)** — Alla riapertura degli ascolti (finestra di nuovo in vista) la griglia mantiene i dati già mostrati
  invece di svuotarsi. Nota: Chrome su Windows considera «nascosta» anche una finestra coperta da altre.
- **2026-11-23 (3)** — Riserva: se la connessione in tempo reale non parte entro 12 s, le prenotazioni si rileggono ogni
  15 s (prima la griglia restava vuota). Regole invariate.
- **2026-11-23 (2)** — Un solo ascolto in tempo reale per scheda (prima 4): con due schede o finestre aperte le connessioni
  finivano e le prenotazioni non partivano. Soci e partite si rileggono ogni 30 s. **Regole cambiate** (lettura di
  `prenotazioni` e `slot` con `limitToLast=2`).
- **2026-11-23** — Corretto il blocco delle prenotazioni con l'app aperta in più schede (pulsante «Prenota» che restava
  disattivato e griglia non aggiornata): ascolti chiusi nelle schede in secondo piano, tempo massimo sulle richieste
  con ricaricamento della situazione, riapertura automatica degli ascolti muti.
- **2026-11-21 (4)** — Pagina **statistiche** per gli admin (settimana/mese/anno, grafici, CSV). Nuovo campo `daOspite`;
  gli admin possono leggere tutte le prenotazioni. Regole da ripubblicare.
- **2026-11-21 (3)** — Corretta la regola del campo `ospite` ("Non è socio"), che rifiutava le prenotazioni con la spunta.
  Gli ospiti continuano a vedere i biliardi occupati senza nomi.
- **2026-11-21 (2)** — Tolta la specialità di gioco da "Cerco avversario" (il campo `specialita` resta ammesso dalle regole per i dati già salvati).
- **2026-11-21** — Repository rinominato in `biliardo2p/b2p-prenota`: nuovo indirizzo `biliardo2p.github.io/b2p-prenota/`.
- **2026-11-19 (2)** — Orari 8–22 con aperture alle 21 della sera prima (mattino) e alle 9 (pomeriggio); vista oggi/domani;
  durata variabile 30 min – 4 h con trascinamento e pulsanti; modifica dal titolare; avversario a testo libero;
  accesso da ospite con prenotazioni da confermare.
- **2026-11-19** — Prima versione: griglia di oggi, prenotazione con socio/ospite/da solo/Cerco avversario, bacheca,
  partite programmate, registrazione con approvazione, gestione soci, regole del database.
