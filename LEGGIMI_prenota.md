# Prenota 2P · LEGGIMI

App web per prenotare i biliardi dell'**ASD Biliardo Seconda Passione**.
Indirizzo: **https://biliardo2p.github.io/prenota/** — repository `biliardo2p/prenota` — copia sul PC in `OneDrive\Biliardo\Prenota\`.

È un applicativo **separato** dal Tabellone Live e dal Gestionale ASD: progetto Firebase, repository e cartella propri.
Ha in comune con loro solo lo stack (sito statico, JavaScript classico, Firebase via REST).

## Firebase

| Voce | Valore |
|---|---|
| Progetto | `b2p-prenota` (piano gratuito Spark, account privato di Enrico, trasferibile al circolo) |
| Database | Realtime Database `https://b2p-prenota-default-rtdb.europe-west1.firebasedatabase.app` |
| Accesso | Authentication email/password, registrazione aperta **con approvazione** |
| Domini autorizzati | `biliardo2p.github.io` |
| Regole | `regole_database.json`: si incollano e si pubblicano **a mano** nella console (Realtime Database → Regole), dopo averne salvata una copia `.bak` |

## File

```
index.html               pagina unica dell'app
manuale.html             istruzioni per i soci
manifest.webmanifest     app installabile "Prenota 2P" (scope /prenota/)
css/prenota.css          colori e caratteri (come il Tabellone Live)
js/config.js             Firebase e impostazioni della sala (biliardi, orari, durata, scadenze)
js/util.js               utilità, stato condiviso, orari nel fuso di Roma
js/dati.js               login, lettura/scrittura e ascolto in tempo reale via REST
js/griglia.js            griglia di oggi
js/prenotazione.js       nuova prenotazione, dettaglio, "Gioco io", annulla, scadenze
js/bacheca.js            chi cerca un avversario
js/partite.js            partite programmate
js/soci.js               profilo e gestione soci (admin)
js/avvio.js              accesso, registrazione, schede, avvio
regole_database.json     regole di sicurezza del database
img/                     logo e icone del circolo
```

Gli script sono classici (non moduli) e si caricano in ordine; ogni link a js/css ha `?v=AAAAMMGGNN`,
da aumentare a ogni modifica. Le chiavi salvate nel browser hanno prefisso `b2pp_` (il dominio è lo stesso del Tabellone).
Nel browser resta solo la sessione (gettone e gettone di rinnovo), **mai la password**.

## Struttura dei dati

| Nodo | Contenuto |
|---|---|
| `soci/<uid>` | `nome`, `livello` (principiante, intermedio, esperto), `stato` (attesa, attivo, sospeso), `ruolo` (socio, admin), `nuovoFinoAl` (AAAA-MM-GG, badge "nuovo socio"), `padrino` (vero/falso), `creato` |
| `privati/<uid>` | `email` (la vedono solo il socio e gli amministratori) |
| `prenotazioni/<AAAA-MM-GG>/<id>` | `tavolo`, `min` (minuti dalla mezzanotte), `inizio`/`fine`/`apertura` (ms), `titolare`, `titolareNome`, `avversario`, `avversarioNome`, `ospite`, `stato` (aperta, confermata, annullata, scaduta), `specialita`, `livello`, `nota`, `scade` (ms), `partita`, `creata` |
| `slot/<AAAA-MM-GG>/<tavolo>/<HHMM>` | id della prenotazione che occupa quella mezz'ora: le regole permettono di scriverlo solo se è vuoto, così due prenotazioni non possono sovrapporsi |
| `partite/<id>` | `giorno`, `min`, `proponente`, `proponenteNome`, `avversario`, `avversarioNome`, `stato` (aperta, proposta, accettata, rifiutata, prenotata, annullata), `nota`, `prenotazione`, `creata` |

## Regole di funzionamento

- Prenotazioni **solo per oggi**, dalle **9:00** (ora di Roma); durata **2 ore**, inizio ogni **30 minuti**, entro l'orario della sala.
- Modalità: con un socio, con un ospite, da solo, **Cerco avversario**.
- "Cerco avversario": max una richiesta aperta per socio; **scade 3 ore prima** dell'inizio e il biliardo si libera.
  Senza server, la richiesta scaduta la libera il primo socio che ha l'app aperta (le regole lo permettono solo dopo la scadenza).
- I padrini vedono un avviso quando un nuovo socio cerca un avversario.
- Partite programmate: per i giorni successivi, non bloccano biliardi; il giorno stesso, dalle 9, "Prenota il biliardo".
- Le regole del database controllano: utente abilitato, apertura delle 9, orario futuro, durata, scadenza, nomi coerenti
  con la scheda socio, chi può fare cosa (titolare, altro socio, amministratore).
- Controllati solo dall'app (non dalle regole): una sola richiesta aperta per socio, niente due partite dello stesso socio
  nello stesso orario.

## Prima messa in funzione

1. Pubblica `regole_database.json` nella console (Realtime Database → Regole).
2. Apri l'app e accedi con l'utenza creata nella console: compare "Completa la registrazione"; scrivi nome e cognome.
3. Nella console, Realtime Database → Dati → `soci` → il tuo UID: cambia `stato` in `attivo` e `ruolo` in `admin`.
4. Ricarica l'app: compare la scheda **Soci**, da cui approvi gli altri.

## Prove

Sempre con **dati finti**: lo script Playwright intercetta tutte le chiamate a Firebase (login, lettura, ascolto,
scritture), quindi non tocca mai il database vero. Le regole non si possono provare senza l'emulatore di Firebase.

## Limiti noti

- Le date sono chiavi testuali: le regole non possono verificare che la data della prenotazione coincida con l'orario.
- Un socio che ha detto "Gioco io" non può ritirarsi da solo: annulla il titolare o un amministratore.
- Niente notifiche: i soci vedono le novità aprendo l'app.

## Storia delle versioni

- **2026-11-19** — Prima versione: griglia di oggi, prenotazione con socio/ospite/da solo/Cerco avversario, bacheca,
  partite programmate, registrazione con approvazione, gestione soci, regole del database.
