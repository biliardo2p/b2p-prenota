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
async function caricaEmail(){ try{ emails = (await dbGet("privati")) || {}; }catch(e){ emails = {}; } disegnaSoci(); }

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
