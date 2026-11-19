/* Prenota 2P · avvio.js — Accesso, registrazione, schede e avvio dell'app */

function mostra(id){ ["accesso", "completa", "attesa", "app"].forEach(s => $("#" + s).hidden = s !== id); }

/* ================= accesso e registrazione ================= */
$$(".scegli-accesso button").forEach(b => b.addEventListener("click", () => {
  $$(".scegli-accesso button").forEach(x => x.classList.toggle("attivo", x === b));
  $("#form-accedi").hidden = b.dataset.vai !== "accedi";
  $("#form-registrati").hidden = b.dataset.vai !== "registrati";
}));

$("#form-accedi").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  try{ await accedi(f.email.value.trim(), f.pw.value); avvia(); }
  catch(err){ toast(msgErrore(err)); }
});
$("#pw-dimenticata").addEventListener("click", async () => {
  const email = $("#form-accedi").email.value.trim();
  if(!email) return toast("Scrivi prima la tua email, poi tocca di nuovo «Password dimenticata»");
  try{ await inviaReset(email); toast("Se l'email è registrata, ti arriva un messaggio per scegliere una nuova password"); }
  catch(err){ toast(msgErrore(err)); }
});

$("#form-registrati").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  if(f.pw.value !== f.pw2.value) return toast("Le due password non sono uguali");
  if(f.nome.value.trim().split(/\s+/).length < 2) return toast("Scrivi nome e cognome");
  try{
    await registrati(f.email.value.trim(), f.pw.value);
    await creaScheda(f.nome.value, f.livello.value);
  }catch(err){ toast(msgErrore(err)); }
});
/* utenza già esistente (es. creata dalla console) ma senza scheda socio */
$("#form-completa").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target;
  if(f.nome.value.trim().split(/\s+/).length < 2) return toast("Scrivi nome e cognome");
  try{ await creaScheda(f.nome.value, f.livello.value); }catch(err){ toast(msgErrore(err)); }
});
async function creaScheda(nome, livello){
  nome = nome.trim().replace(/\s+/g, " ").slice(0, 60);
  await dbWrite({
    ["soci/" + session.uid]: {nome, livello, stato: "attesa", ruolo: "socio", creato: ORA_SERVER},
    ["privati/" + session.uid]: {email: session.email}
  });
  avvia();
}
$$(".esci").forEach(b => b.addEventListener("click", esci));
$("#ricontrolla").addEventListener("click", () => avvia());

/* ================= schede dell'app ================= */
$$("nav button").forEach(b => b.addEventListener("click", () => {
  $$("nav button").forEach(x => x.classList.toggle("attivo", x === b));
  $$(".tab").forEach(t => t.hidden = t.id !== b.dataset.tab);
  if(b.dataset.tab === "tab-soci") caricaEmail();
  window.scrollTo(0, 0);
}));

function disegnaTutto(){
  if(!S.io) return;
  liberaScadute();
  disegnaGriglia();
  disegnaBacheca();
  disegnaPartite();
  disegnaSoci();
}

/* ================= avvio ================= */
async function avvia(){
  chiudiAscolti();
  $("#utente").textContent = "";
  if(!session){ mostra("accesso"); return; }
  let io;
  try{ io = await dbGet("soci/" + session.uid); }
  catch(err){
    if(err.code === "rete"){ toast(msgErrore(err)); mostra("accesso"); return; }
    session = null; salvaSessione(); mostra("accesso"); return;
  }
  if(!io){ $("#form-completa").livello.innerHTML = LIVELLI.map(l => `<option>${l}</option>`).join(""); mostra("completa"); return; }
  if(io.stato === "attesa"){ $("#attesa-nome").textContent = io.nome; mostra("attesa"); return; }
  if(io.stato !== "attivo"){ toast("Utenza sospesa: contatta il direttivo"); session = null; salvaSessione(); mostra("accesso"); return; }

  S.uid = session.uid; S.io = io;
  $("#utente").textContent = io.nome;
  mostra("app");
  disegnaProfilo();
  ascoltaTutto();
}

function ascoltaTutto(){
  S.oggi = adesso().data;
  $("#oggi").textContent = dataLunga(S.oggi);
  ascolta("soci", "soci", "", v => {
    S.soci = v || {};
    const io = S.soci[S.uid];
    if(!io || io.stato !== "attivo"){ esci(); return; }
    S.io = io; disegnaProfilo(); disegnaTutto();
  });
  ascolta("pren", "prenotazioni/" + S.oggi, "", v => { S.pren = v || {}; disegnaTutto(); });
  ascolta("partite", "partite", `&orderBy="giorno"&startAt="${S.oggi}"`, v => { S.partite = v || {}; disegnaTutto(); });
}

/* ogni 30 secondi: cambio di giorno, apertura delle 9, scadenze */
setInterval(() => {
  if(!S.io) return;
  if(adesso().data !== S.oggi){ S.pren = {}; ascoltaTutto(); }
  disegnaTutto();
}, 30000);

$("#form-registrati").livello.innerHTML = LIVELLI.map(l => `<option>${l}</option>`).join("");
avvia();
