/* Prenota 2P · util.js — Funzioni di servizio e orari nel fuso di Roma */

const $ = s => document.querySelector(s);
const $$ = s => [...document.querySelectorAll(s)];
const esc = t => String(t ?? "").replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));

/* ================= stato dell'app (condiviso dagli altri file) ================= */
const S = {
  uid: null, io: null,      /* utente collegato e sua scheda */
  ospite: false,            /* entrato come ospite (senza registrazione) */
  soci: {},                 /* uid → scheda socio */
  pren: {},                 /* data → {id → prenotazione} (oggi e domani) */
  partite: {},              /* partite programmate da oggi in poi */
  oggi: null, domani: null,
  giorno: null,             /* giorno mostrato nella griglia */
  sel: null,                /* selezione in corso: {data, tavolo, min, durata, id?} */
  scadendo: new Set()
};
const ATTIVE = ["aperta", "confermata", "da_confermare"];
const isAdmin = () => !!(S.io && S.io.ruolo === "admin" && S.io.stato === "attivo");
const nomeDi = uid => (S.soci[uid] && S.soci[uid].nome) || "Socio";
const nuovoSocio = uid => { const s = S.soci[uid]; return !!(s && s.nuovoFinoAl && s.nuovoFinoAl >= S.oggi); };
const badgeNuovo = uid => nuovoSocio(uid) ? ' <span class="badge">nuovo socio</span>' : "";

/* messaggio breve in basso */
let toastT = null;
function toast(msg){
  const t = $("#toast");
  /* con una finestra aperta il messaggio va dentro la finestra, altrimenti resterebbe nascosto dietro */
  const dlg = document.querySelector("dialog[open]");
  const dove = dlg || document.body;
  if(t.parentNode !== dove) dove.appendChild(t);
  t.textContent = msg; t.classList.add("show");
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove("show"), 4000);
}

/* finestra di conferma grande e leggibile (al posto di confirm) */
function chiedi(testo, si = "Sì", no = "No"){
  return new Promise(res => {
    const d = $("#dlg-chiedi");
    $("#chiedi-testo").textContent = testo;
    $("#chiedi-si").textContent = si; $("#chiedi-no").textContent = no;
    const fine = v => { d.close(); $("#chiedi-si").onclick = $("#chiedi-no").onclick = null; res(v); };
    $("#chiedi-si").onclick = () => fine(true);
    $("#chiedi-no").onclick = () => fine(false);
    d.showModal();
  });
}

/* ================= orari (sempre ora di Roma, qualunque sia il fuso del telefono) ================= */
const TZ = "Europe/Rome";
const FMT = new Intl.DateTimeFormat("en-GB", {timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hourCycle: "h23"});
function partiRoma(ms){
  const p = Object.fromEntries(FMT.formatToParts(new Date(ms)).map(x => [x.type, x.value]));
  return {y: +p.year, m: +p.month, d: +p.day, h: +p.hour, min: +p.minute};
}
const minuti = hhmm => { const [h, m] = hhmm.split(":").map(Number); return h * 60 + m; };
const hhmm = min => String(Math.floor(min / 60)).padStart(2, "0") + ":" + String(min % 60).padStart(2, "0");
/* data e minuti attuali a Roma */
function adesso(){
  const p = partiRoma(Date.now());
  return {data: p.y + "-" + String(p.m).padStart(2, "0") + "-" + String(p.d).padStart(2, "0"), min: p.h * 60 + p.min};
}
/* istante (ms) di una data "AAAA-MM-GG" a un certo minuto, ora di Roma (gestisce il cambio d'ora) */
function msRoma(data, min){
  const [y, m, d] = data.split("-").map(Number);
  const voluto = Date.UTC(y, m - 1, d, 0, min);
  let t = voluto;
  for(let i = 0; i < 2; i++){ const p = partiRoma(t); t += voluto - Date.UTC(p.y, p.m - 1, p.d, p.h, p.min); }
  return t;
}
function piuGiorni(data, n){
  const [y, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}
const dataLunga = d => new Date(d + "T12:00:00Z").toLocaleDateString("it-IT", {weekday: "long", day: "numeric", month: "long", timeZone: "UTC"});
const dataBreve = d => new Date(d + "T12:00:00Z").toLocaleDateString("it-IT", {weekday: "short", day: "numeric", month: "short", timeZone: "UTC"});
const durataDi = p => p.durata || SALA.durata;
const fascia = (min, durata = SALA.durata) => hhmm(min) + "–" + hhmm(min + durata);
const testoDurata = d => { const h = Math.floor(d / 60), m = d % 60;
  return (h ? (h === 1 ? "1 ora" : h + " ore") : "") + (h && m ? " e " : "") + (m ? m + " minuti" : ""); };
/* quando si apre la prenotazione di una partita che inizia alle "min" del giorno "data" */
function apreAlle(data, min){
  return min < minuti(SALA.mattinoFinoA)
    ? msRoma(piuGiorni(data, -1), minuti(SALA.aperturaMattino))
    : msRoma(data, minuti(SALA.aperturaPomeriggio));
}
const nomeGiorno = d => d === S.oggi ? "oggi" : d === S.domani ? "domani" : dataLunga(d);
