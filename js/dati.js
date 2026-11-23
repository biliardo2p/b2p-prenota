/* Prenota 2P · dati.js — Accesso (Firebase Auth via REST) e database (Realtime Database via REST)
   Niente SDK: login, scritture e ascolto in tempo reale passano dalle API web di Firebase,
   come nel Tabellone Live. La password non viene mai salvata: nel browser resta solo la sessione. */

/* ================= sessione ================= */
const AKEY = KEY + "sessione";
let session = null;
try{ session = JSON.parse(localStorage.getItem(AKEY) || "null"); }catch(e){}
function salvaSessione(){ try{ session ? localStorage.setItem(AKEY, JSON.stringify(session)) : localStorage.removeItem(AKEY); }catch(e){} }

const ERRORI = {
  EMAIL_NOT_FOUND: "Email o password non corrette",
  INVALID_PASSWORD: "Email o password non corrette",
  INVALID_LOGIN_CREDENTIALS: "Email o password non corrette",
  INVALID_EMAIL: "L'indirizzo email non è valido",
  EMAIL_EXISTS: "Con questa email c'è già un'utenza: usa «Accedi»",
  WEAK_PASSWORD: "Password troppo corta: almeno 6 caratteri",
  USER_DISABLED: "Utenza disattivata: contatta il direttivo",
  TOO_MANY_ATTEMPTS_TRY_LATER: "Troppi tentativi: riprova tra qualche minuto",
  PERMISSION_DENIED: "Operazione non permessa",
  rete: "Connessione assente: riprova",
  lento: "Il server non risponde: controlla la connessione e riprova (se hai l'app aperta in più schede, chiudi le altre)"
};
const msgErrore = e => { const c = String((e && e.code) || e || ""); return ERRORI[c.split(" ")[0].replace(/:$/, "")] || ("Errore: " + c); };

/* fetch con tempo massimo: una richiesta che non risponde non blocca più l'app */
async function chiama(url, opz = {}, ms = 20000){
  const c = new AbortController(), t = setTimeout(() => c.abort(), ms);
  try{ return await fetch(url, {...opz, signal: c.signal}); }
  catch(e){ throw {code: e && e.name === "AbortError" ? "lento" : "rete"}; }
  finally{ clearTimeout(t); }
}

async function chiamaAuth(metodo, corpo){
  let r, j;
  r = await chiama("https://identitytoolkit.googleapis.com/v1/accounts:" + metodo + "?key=" + FIREBASE.apiKey,
    {method: "POST", headers: {"Content-Type": "application/json"}, body: JSON.stringify(corpo)});
  try{ j = await r.json(); }catch(e){ throw {code: "rete"}; }
  if(!r.ok) throw {code: (j && j.error && j.error.message) || ("http " + r.status)};
  return j;
}
function apriSessione(j){
  session = {uid: j.localId, email: j.email, idToken: j.idToken, refreshToken: j.refreshToken, exp: Date.now() + (+j.expiresIn - 120) * 1000};
  salvaSessione();
}
async function accedi(email, pw){ apriSessione(await chiamaAuth("signInWithPassword", {email, password: pw, returnSecureToken: true})); }
async function registrati(email, pw){ apriSessione(await chiamaAuth("signUp", {email, password: pw, returnSecureToken: true})); }
/* ospite: utenza anonima di Firebase, resta memorizzata sul dispositivo */
async function entraOspite(){ apriSessione(await chiamaAuth("signUp", {returnSecureToken: true})); session.ospite = true; salvaSessione(); }
async function inviaReset(email){ await chiamaAuth("sendOobCode", {requestType: "PASSWORD_RESET", email}); }
function esci(){ chiudiAscolti(); session = null; salvaSessione(); location.reload(); }

async function idToken(){
  if(!session) throw {code: "PERMISSION_DENIED"};
  if(Date.now() < session.exp) return session.idToken;
  let r, j;
  r = await chiama("https://securetoken.googleapis.com/v1/token?key=" + FIREBASE.apiKey,
    {method: "POST", headers: {"Content-Type": "application/x-www-form-urlencoded"},
     body: "grant_type=refresh_token&refresh_token=" + encodeURIComponent(session.refreshToken)});
  try{ j = await r.json(); }catch(e){ throw {code: "rete"}; }
  if(!r.ok){ session = null; salvaSessione(); throw {code: "sessione scaduta: rientra"}; }
  session.idToken = j.id_token; session.refreshToken = j.refresh_token;
  session.exp = Date.now() + (+j.expires_in - 120) * 1000; salvaSessione();
  return session.idToken;
}

/* ================= lettura e scrittura ================= */
const ORA_SERVER = {".sv": "timestamp"};
function urlDb(path, token, extra = ""){ return FIREBASE.databaseURL + "/" + path + ".json?auth=" + encodeURIComponent(token) + extra; }

async function dbGet(path, filtro = ""){
  const t = await idToken();
  let r;
  r = await chiama(urlDb(path, t, filtro), {}, 40000);
  if(r.status === 401 || r.status === 403) throw {code: "PERMISSION_DENIED"};
  if(!r.ok) throw {code: "http " + r.status};
  return r.json();
}
/* scrittura atomica di più percorsi: o passano tutti o nessuno */
async function dbWrite(obj){
  const t = await idToken();
  let r;
  r = await chiama(urlDb("", t), {method: "PATCH", body: JSON.stringify(obj)});
  if(r.status === 401 || r.status === 403) throw {code: "PERMISSION_DENIED"};
  if(!r.ok) throw {code: "http " + r.status};
  /* dopo ogni scrittura riuscita si rileggono subito i dati letti a intervalli */
  ascolti.forEach(st => { if(st.subito) st.subito(); });
}
function nuovoId(){
  const a = new Uint8Array(6); crypto.getRandomValues(a);
  return Date.now().toString(36) + [...a].map(b => b.toString(36).padStart(2, "0")).join("").slice(0, 8);
}

/* ================= ascolto in tempo reale (streaming REST) ================= */
const ascolti = new Map();
function impostaIn(albero, percorso, valore){
  const parti = percorso.split("/").filter(Boolean);
  if(!parti.length) return valore;
  const radice = albero && typeof albero === "object" ? albero : {};
  let n = radice;
  parti.slice(0, -1).forEach(p => { if(!n[p] || typeof n[p] !== "object") n[p] = {}; n = n[p]; });
  const ultima = parti[parti.length - 1];
  if(valore === null) delete n[ultima]; else n[ultima] = valore;
  return radice;
}
/* ascolta(nome, percorso, filtro, cb): cb(valore) a ogni cambiamento; filtro es. '&orderBy="giorno"&startAt="2026-11-19"' */
function ascolta(nome, percorso, filtro, cb){
  smettiAscolto(nome);
  const st = {es: null, valore: null, chiuso: false, ultimo: Date.now(), apri: null};
  ascolti.set(nome, st);
  const apri = async () => {
    if(st.chiuso) return;
    let t;
    try{ t = await idToken(); }catch(e){ return; }
    if(st.chiuso) return;
    if(st.es) st.es.close();
    const es = new EventSource(urlDb(percorso, t, filtro || ""));
    st.es = es;
    st.ultimo = Date.now();
    es.addEventListener("keep-alive", () => { st.ultimo = Date.now(); });
    const applica = (ev, unisci) => {
      st.ultimo = Date.now();
      let d; try{ d = JSON.parse(ev.data); }catch(e){ return; }
      if(!d) return;
      if(unisci) Object.entries(d.data || {}).forEach(([k, v]) => { st.valore = impostaIn(st.valore, d.path + "/" + k, v); });
      else st.valore = impostaIn(st.valore, d.path, d.data);
      cb(st.valore);
    };
    es.addEventListener("put", ev => applica(ev, false));
    es.addEventListener("patch", ev => applica(ev, true));
    /* il gettone dura un'ora: quando scade si riapre con uno nuovo */
    es.addEventListener("auth_revoked", () => { es.close(); setTimeout(apri, 500); });
    es.addEventListener("cancel", () => { es.close(); });
  };
  st.apri = apri;
  apri();
}
/* il server manda un segnale almeno ogni 30 secondi: un ascolto muto da più di 70 secondi si riapre */
setInterval(() => {
  ascolti.forEach(st => { if(!st.chiuso && st.apri && Date.now() - st.ultimo > 70000){ st.ultimo = Date.now(); st.apri(); } });
}, 20000);
/* rileggi(nome, percorso, filtro, cb, ms): dati che cambiano di rado, letti all'avvio e poi ogni ms
   (non tengono occupata una connessione come gli ascolti) */
function rileggi(nome, percorso, filtro, cb, ms){
  smettiAscolto(nome);
  const st = {es: null, chiuso: false, ultimo: Date.now(), apri: null, timer: null, inCorso: false};
  ascolti.set(nome, st);
  const leggi = async () => {
    if(st.chiuso || st.inCorso) return;
    st.inCorso = true;
    try{ const v = await dbGet(percorso, filtro || ""); if(!st.chiuso) cb(v); }catch(e){}
    st.inCorso = false;
  };
  st.subito = leggi;
  st.timer = setInterval(leggi, ms);
  leggi();
}
function smettiAscolto(nome){ const st = ascolti.get(nome); if(st){ st.chiuso = true; if(st.es) st.es.close(); if(st.timer) clearInterval(st.timer); ascolti.delete(nome); } }
function chiudiAscolti(){ [...ascolti.keys()].forEach(smettiAscolto); }
