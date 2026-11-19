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
   ATTENZIONE: orari di inizio (8–22), chiusura (24), durate (30 min – 4 h), aperture (21 della sera prima / 9)
   e anticipo della scadenza (3 h) sono scritti anche in regole_database.json: se cambiano, vanno aggiornati in entrambi. */
const CLUB = {name: "Biliardo Seconda Passione", short: "Seconda Passione"};
const SALA = {
  tavoli: 4,                    /* numero di biliardi (al massimo 8) */
  primoInizio: "08:00",         /* primo orario di inizio */
  ultimoInizio: "22:00",        /* ultimo orario di inizio */
  chiusura: "24:00",            /* la partita deve finire entro quest'ora */
  durata: 120,                  /* durata proposta con un tocco (minuti) */
  durataMin: 30,                /* durata minima */
  durataMax: 240,               /* durata massima */
  passo: 30,                    /* orari e durate a passi di 30 minuti */
  mattinoFinoA: "13:00",        /* le partite che iniziano prima di quest'ora sono "del mattino" */
  aperturaMattino: "21:00",     /* il mattino si prenota dalle 21 della sera prima */
  aperturaPomeriggio: "09:00",  /* pomeriggio e sera si prenotano dalle 9 del giorno stesso */
  scadenzaOre: 3,               /* "Cerco avversario" scade 3 ore prima dell'inizio */
  giorniNuovo: 60               /* badge "nuovo socio" per 60 giorni dall'approvazione */
};
const SPECIALITA = ["Qualsiasi", "5 Birilli", "Italiana", "Goriziana"];
const LIVELLI = ["principiante", "intermedio", "esperto"];

/* prefisso delle chiavi salvate nel browser: il dominio è lo stesso del Tabellone Live */
const KEY = "b2pp_";
