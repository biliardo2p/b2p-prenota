/* Prenota 2P · soci.js — Profilo del socio e gestione soci (solo amministratori) */

/* ================= profilo ================= */
function disegnaProfilo(){
  $("#profilo-ospite").hidden = !S.ospite;
  $("#form-profilo").hidden = S.ospite;
  $("#cambia-pw").hidden = S.ospite;
  if(S.ospite) return;
  const f = $("#form-profilo");
  f.nome.value = S.io.nome;
  f.email.value = session.email || "";
  f.livello.innerHTML = LIVELLI.map(l => `<option ${l === S.io.livello ? "selected" : ""}>${l}</option>`).join("");
  $("#tab-soci-btn").hidden = !isAdmin();
}
$("#form-profilo").addEventListener("submit", async e => {
  e.preventDefault();
  try{ await dbWrite({["soci/" + S.uid + "/livello"]: e.target.livello.value}); toast("Salvato"); }
  catch(err){ toast(msgErrore(err)); }
});
$("#cambia-pw").addEventListener("click", async () => {
  try{ await inviaReset(session.email); toast("Ti abbiamo mandato un'email per scegliere una nuova password"); }
  catch(err){ toast(msgErrore(err)); }
});
$("#esci").addEventListener("click", esci);

/* ================= gestione soci (admin) ================= */
let emails = {};
async function caricaEmail(){ try{ emails = (await dbGet("privati")) || {}; }catch(e){ emails = {}; } disegnaSoci(); sistemaNomi(); }

/* quando un admin apre la scheda Admin, i nomi dei soci scritti in modo diverso vengono uniformati (Mario Rossi) */
async function sistemaNomi(){
  const w = {};
  Object.entries(S.soci).forEach(([id, s]) => { const n = nomeProprio(s.nome); if(s.nome && n !== s.nome && n.length >= 3) w["soci/" + id + "/nome"] = n; });
  if(Object.keys(w).length) try{ await dbWrite(w); }catch(e){}
}

function disegnaSoci(){
  if(!isAdmin()) return;
  const tutti = Object.entries(S.soci).map(([id, s]) => ({id, ...s})).sort((a, b) => a.nome.localeCompare(b.nome, "it"));
  const attesa = tutti.filter(s => s.stato === "attesa");
  const daConf = [S.oggi, S.domani].flatMap(d => prenDi(d).map(p => ({...p, data: d}))).filter(p => p.stato === "da_confermare")
    .sort((a, b) => (a.data + hhmm(a.min)).localeCompare(b.data + hhmm(b.min)));
  $("#conta-soci").textContent = (attesa.length + daConf.length) || "";
  $("#conta-soci").hidden = !(attesa.length + daConf.length);
  $("#da-confermare").innerHTML = daConf.length ? daConf.map(p => `
    <li class="scheda">
      <div class="grande"><b>${nomeGiorno(p.data) === "oggi" ? "Oggi" : "Domani"} ${fascia(p.min, durataDi(p))}</b> · Biliardo ${p.tavolo}</div>
      <div><b>${esc(p.titolareNome)}</b> ${p.avversarioNome ? "con <b>" + esc(p.avversarioNome) + "</b>" : "da solo"}</div>
      <button class="btn" data-pren="${p.id}" data-data="${p.data}">Apri</button>
    </li>`).join("") : `<li class="vuoto">Nessuna prenotazione da confermare.</li>`;
  const mail = id => esc((emails[id] && emails[id].email) || "");
  $("#soci-attesa").innerHTML = attesa.length ? attesa.map(s => `
    <li class="scheda" data-id="${s.id}">
      <div class="grande"><b>${esc(s.nome)}</b></div><div class="meta">${mail(s.id)}</div>
      <div class="riga"><button class="btn primario" data-az="approva">Approva</button><button class="btn pericolo" data-az="sospendi">Rifiuta</button></div>
    </li>`).join("") : `<li class="vuoto">Nessuna richiesta in attesa.</li>`;
  $("#soci-elenco").innerHTML = tutti.filter(s => s.stato !== "attesa").map(s => `
    <li class="scheda${s.stato === "sospeso" ? " spento" : ""}" data-id="${s.id}">
      <div class="grande"><b>${esc(s.nome)}</b>${s.stato === "sospeso" ? " · sospeso" : ""}</div>
      <div class="meta">${[mail(s.id), esc(s.livello || "")].filter(Boolean).join(" · ")}</div>
      <label class="spunta"><input type="checkbox" data-campo="padrino" ${s.padrino ? "checked" : ""}> Padrino dei nuovi soci</label>
      <label class="spunta"><input type="checkbox" data-campo="admin" ${s.ruolo === "admin" ? "checked" : ""} ${s.id === S.uid ? "disabled" : ""}> Amministratore</label>
      <label class="in-riga">Badge «nuovo socio» fino al <input type="date" data-campo="nuovoFinoAl" value="${esc(s.nuovoFinoAl || "")}"></label>
      ${s.id === S.uid ? "" : s.stato === "sospeso"
        ? `<button class="btn" data-az="riattiva">Riattiva</button>`
        : `<button class="btn pericolo" data-az="sospendi">Sospendi</button>`}
      ${s.id === S.uid ? "" : `<button class="btn pericolo" data-az="cancella">Cancella</button>`}
    </li>`).join("");
}

$("#tab-soci").addEventListener("click", async e => {
  const pr = e.target.closest("[data-pren]");
  if(pr) return apriDettaglio(pr.dataset.data, pr.dataset.pren);
  const az = e.target.closest("[data-az]") && e.target.closest("[data-az]").dataset.az;
  if(!az) return;
  const id = e.target.closest("[data-id]").dataset.id, k = "soci/" + id + "/";
  try{
    if(az === "approva") await dbWrite({[k + "stato"]: "attivo", [k + "nuovoFinoAl"]: piuGiorni(S.oggi, SALA.giorniNuovo)});
    if(az === "riattiva") await dbWrite({[k + "stato"]: "attivo"});
    if(az === "cancella") return cancellaSocio(id);
    if(az === "sospendi" && await chiedi(`Sospendere ${nomeDi(id)}? Non potrà più prenotare.`, "Sì, sospendi", "No"))
      await dbWrite({[k + "stato"]: "sospeso"});
    toast("Salvato");
  }catch(err){ toast(msgErrore(err)); }
});
$("#tab-soci").addEventListener("change", async e => {
  const c = e.target.dataset.campo;
  if(!c) return;
  const k = "soci/" + e.target.closest("[data-id]").dataset.id + "/";
  const w = c === "admin" ? {[k + "ruolo"]: e.target.checked ? "admin" : "socio"}
          : c === "padrino" ? {[k + "padrino"]: e.target.checked}
          : {[k + "nuovoFinoAl"]: e.target.value || null};
  try{ await dbWrite(w); toast("Salvato"); }catch(err){ toast(msgErrore(err)); }
});

/* ================= conservazione dei dati (admin) =================
   «Togli i nomi»: le prenotazioni restano (biliardo, giorno, orario, tipo) per le statistiche, ma titolare e avversario
   diventano "anonimo" e la nota sparisce. «Cancella socio»: scheda ed email eliminate, prenotazioni future annullate,
   nomi tolti da tutte le sue prenotazioni. Le regole permettono solo questi cambiamenti. */
const ANONIMO = "anonimo", ANONIMO_NOME = "Anonimo";

/* scrive a blocchi, per non mandare richieste enormi */
async function scriviABlocchi(w, blocco = 400){
  const chiavi = Object.keys(w);
  for(let i = 0; i < chiavi.length; i += blocco)
    await dbWrite(Object.fromEntries(chiavi.slice(i, i + blocco).map(k => [k, w[k]])));
}
/* campi da cambiare per togliere i nomi; soloUid: solo dove compare quel socio */
function togliNomi(w, data, id, p, soloUid){
  const k = percorso(data, id) + "/";
  if(!soloUid || p.titolare === soloUid){
    if(p.titolare !== ANONIMO) w[k + "titolare"] = ANONIMO;
    if(p.titolareNome !== ANONIMO_NOME) w[k + "titolareNome"] = ANONIMO_NOME;
    if(p.nota) w[k + "nota"] = null;
  }
  if(p.avversario && p.avversario !== ANONIMO && (!soloUid || p.avversario === soloUid)) w[k + "avversario"] = ANONIMO;
  if(p.avversarioNome && p.avversarioNome !== ANONIMO_NOME && (!soloUid ? true : p.avversario === soloUid)) w[k + "avversarioNome"] = ANONIMO_NOME;
}
const dataIt = d => d.split("-").reverse().join("/");
const quante = w => new Set(Object.keys(w).filter(k => k.startsWith("prenotazioni/")).map(k => k.split("/").slice(0, 3).join("/"))).size;

$("#anonimizza").addEventListener("click", async e => {
  const mesi = +$("#anon-mesi").value || SALA.conservaMesi;
  const [y, m, d] = S.oggi.split("-").map(Number);
  const limite = new Date(Date.UTC(y, m - 1 - mesi, d)).toISOString().slice(0, 10);   // giorni prima di questa data
  const ultimo = piuGiorni(limite, -1);
  e.target.disabled = true;
  try{
    const pren = (await dbGet("prenotazioni", `&orderBy="$key"&endAt="${ultimo}"`)) || {};
    const w = {};
    Object.entries(pren).forEach(([data, g]) => Object.entries(g || {}).forEach(([id, p]) => togliNomi(w, data, id, p)));
    const nPren = quante(w);
    if(!nPren){ toast(`Niente da fare: nessun nome nelle prenotazioni fino al ${dataIt(ultimo)}`); return; }
    if(!(await chiedi(`Togliere i nomi da ${nPren} prenotazioni fino al ${dataIt(ultimo)}? Non si può tornare indietro.`, "Sì, togli i nomi", "No"))) return;
    await scriviABlocchi(w);
    toast(`Fatto: nomi tolti da ${nPren} prenotazioni`);
  }catch(err){ toast(msgErrore(err)); }
  finally{ e.target.disabled = false; }
});

async function cancellaSocio(uid){
  const nome = nomeDi(uid), email = (emails[uid] && emails[uid].email) || "";
  if(!(await chiedi(`Cancellare ${nome}${email ? " (" + email + ")" : ""}? Le sue prenotazioni future vengono annullate e il suo nome ` +
      "viene tolto da tutte le prenotazioni. Non si può tornare indietro.", "Sì, cancella", "No"))) return;
  try{
    const pren = (await dbGet("prenotazioni")) || {};
    const w = {}, ora = Date.now();
    Object.entries(pren).forEach(([data, g]) => Object.entries(g || {}).forEach(([id, p]) => {
      if(p.titolare !== uid && p.avversario !== uid) return;
      if(p.titolare === uid && ATTIVE.includes(p.stato) && p.inizio > ora){
        w[percorso(data, id) + "/stato"] = "annullata";
        slotDi(data, p.tavolo, p.min, durataDi(p)).forEach(k => w[k] = null);
      }
      togliNomi(w, data, id, p, uid);
    }));
    await scriviABlocchi(w);
    await dbWrite({["privati/" + uid]: null, ["soci/" + uid]: null});
    delete emails[uid];
    toast(`${nome} cancellato. Elimina anche la sua utenza nella console Firebase → Authentication` + (email ? ` (${email})` : ""));
  }catch(err){ toast(msgErrore(err)); }
}
