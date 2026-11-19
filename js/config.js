/* Prenota 2P · config.js — Collegamento a Firebase e impostazioni del circolo
   I file js/ si caricano in ordine da index.html e condividono le stesse variabili (script classici, non moduli).
   L'ordine conta: config, util, dati, griglia, prenotazione, bacheca, partite, soci, avvio. */

/* ================= Firebase (progetto dedicato b2p-prenota) ================= */
const FIREBASE = {
  apiKey: "AIzaSyA71deNYIychc_P8tPWLQnHl4V-h-_H7Ds",
  authDomain: "b2p-prenota.firebaseapp.com",
  databaseURL: "https://b2p-prenota-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "b2p-prenota",
  storageBucket: "b2p-prenota.firebasestorage.app",
  messagingSenderId: "139847805500",
  appId: "1:139847805500:web:246b398e3d590d59e0f139"
};

/* ================= circolo e sala =================
   ATTENZIONE: durata (120 min), anticipo della scadenza (3 h) e apertura (9:00)
   sono scritti anche in regole_database.json: se cambiano, vanno aggiornati in entrambi. */
const CLUB = {name: "Biliardo Seconda Passione", short: "Seconda Passione"};
const SALA = {
  tavoli: 4,               /* numero di biliardi (al massimo 8) */
  apertura: "14:00",       /* primo orario di inizio possibile */
  chiusura: "24:00",       /* la partita deve finire entro quest'ora */
  durata: 120,             /* minuti di una prenotazione */
  passo: 30,               /* orari di inizio ogni 30 minuti */
  apronoAlle: "09:00",     /* le prenotazioni del giorno si aprono a quest'ora */
  scadenzaOre: 3,          /* "Cerco avversario" scade 3 ore prima dell'inizio */
  giorniNuovo: 60          /* badge "nuovo socio" per 60 giorni dall'approvazione */
};
const SPECIALITA = ["Qualsiasi", "5 Birilli", "Italiana", "Goriziana"];
const LIVELLI = ["principiante", "intermedio", "esperto"];

/* prefisso delle chiavi salvate nel browser: il dominio è lo stesso del Tabellone Live */
const KEY = "b2pp_";
