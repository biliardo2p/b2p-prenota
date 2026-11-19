/* Prenota 2P · prenotazione.js — Nuova prenotazione, dettaglio, "Gioco io", annullamento, scadenze */

const slotDi = (data, tavolo, min) => {
  const k = [];
  for(let m = min; m < min + SALA.durata; m += SALA.passo) k.push("slot/" + data + "/" + tavolo + "/" + hhmm(m).replace(":", ""));
  return k;
};
const percorso = id => "prenotazioni/" + S.oggi + "/" + id;
let inCorso = null;   /* prenotazione che si sta compilando */

/* ================= nuova prenotazione ================= */
function apriPrenota(tavolo, min, preset = {}){
  inCorso = {tavolo, min, partita: preset.partita || null};
  const f = $("#form-prenota");
  f.reset();
  $("#prenota-titolo").textContent = `Biliardo ${tavolo} · ${fascia(min)}`;
  f.socio.innerHTML = `<option value="">— scegli —</option>` + Object.entries(S.soci)
    .filter(([id, s]) => id !== S.uid && s.stato === "attivo")
    .sort((a, b) => a[1].nome.localeCompare(b[1].nome, "it"))
    .map(([id, s]) => `<option value="${id}">${esc(s.nome)}</option>`).join("");
  f.specialita.innerHTML = SPECIALITA.map(s => `<option>${esc(s)}</option>`).join("");
  f.livello.innerHTML = LIVELLI.map(l => `<option ${l === S.io.livello ? "selected" : ""}>${l}</option>`).join("");
  if(preset.avversario){ f.modo.value = "socio"; f.socio.value = preset.avversario; }
  mostraCampi();
  $("#dlg-prenota").showModal();
}
function mostraCampi(){
  const modo = $("#form-prenota").modo.value;
  $$("#form-prenota [data-modo]").forEach(el => el.hidden = el.dataset.modo !== modo);
}
$("#form-prenota").addEventListener("change", mostraCampi);
$("#prenota-annulla").addEventListener("click", () => $("#dlg-prenota").close());

$("#form-prenota").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, modo = f.modo.value, {tavolo, min, partita} = inCorso, lista = attive();
  if(occupato(tavolo, min, min + SALA.durata, lista)) return toast("Nel frattempo il biliardo è stato prenotato");
  if(giocaGia(S.uid, min, lista)) return toast("Hai già una partita in quell'orario");
  if(modo === "socio" && !f.socio.value) return toast("Scegli il socio con cui giochi");
  if(modo === "socio" && giocaGia(f.socio.value, min, lista)) return toast(`${nomeDi(f.socio.value)} ha già una partita in quell'orario`);
  if(modo === "ospite" && !f.ospite.value.trim()) return toast("Scrivi il nome dell'ospite");
  if(modo === "cerca" && lista.some(p => p.titolare === S.uid && p.stato === "aperta")) return toast("Hai già una richiesta «Cerco avversario» aperta");

  const inizio = msRoma(S.oggi, min);
  const p = {
    tavolo, min, inizio, fine: inizio + SALA.durata * 60000,
    apertura: msRoma(S.oggi, minuti(SALA.apronoAlle)),
    titolare: S.uid, titolareNome: S.io.nome, stato: "confermata", creata: ORA_SERVER
  };
  if(modo === "socio"){ p.avversario = f.socio.value; p.avversarioNome = nomeDi(f.socio.value); }
  if(modo === "ospite") p.ospite = f.ospite.value.trim().slice(0, 60);
  if(modo === "cerca"){
    p.stato = "aperta"; p.specialita = f.specialita.value; p.livello = f.livello.value;
    if(f.nota.value.trim()) p.nota = f.nota.value.trim().slice(0, 120);
    p.scade = inizio - SALA.scadenzaOre * 3600000;
    if(p.scade <= Date.now()) return toast(`Troppo tardi per cercare un avversario: serve almeno ${SALA.scadenzaOre} ore di anticipo`);
  }
  if(partita) p.partita = partita;

  const id = nuovoId(), w = {[percorso(id)]: p};
  slotDi(S.oggi, tavolo, min).forEach(k => w[k] = id);
  if(partita){ w["partite/" + partita + "/stato"] = "prenotata"; w["partite/" + partita + "/prenotazione"] = id; }
  const btn = f.querySelector("[type=submit]"); btn.disabled = true;
  try{
    await dbWrite(w);
    $("#dlg-prenota").close();
    toast(modo === "cerca" ? "Richiesta pubblicata: compare in giallo" : "Prenotazione fatta!");
  }catch(err){
    toast(err.code === "PERMISSION_DENIED" ? "Non è stato possibile prenotare: lo spazio potrebbe essere già occupato" : msgErrore(err));
  }finally{ btn.disabled = false; }
});

/* ================= dettaglio ================= */
function apriDettaglio(id){
  const p = S.pren[id];
  if(!p) return;
  const mio = p.titolare === S.uid;
  let h = `<h3>Biliardo ${p.tavolo} · ${fascia(p.min)}</h3><p><b>${esc(p.titolareNome)}</b>${badgeNuovo(p.titolare)}`;
  if(p.stato === "aperta"){
    h += ` cerca un avversario.</p><p class="meta">${esc(p.specialita)} · livello ${esc(p.livello)}<br>
      Se nessuno si aggiunge, alle ${hhmm(p.min - SALA.scadenzaOre * 60)} il biliardo si libera.</p>`;
    if(p.nota) h += `<p class="nota">«${esc(p.nota)}»</p>`;
  }else{
    h += ` gioca ${p.avversarioNome ? "con <b>" + esc(p.avversarioNome) + "</b>" : p.ospite ? "con <b>" + esc(p.ospite) + "</b> (ospite)" : "da solo"}.</p>`;
  }
  let a = "";
  if(p.stato === "aperta" && !mio) a += `<button class="btn primario" data-az="gioco">Gioco io</button>`;
  if(p.stato === "aperta" && mio) a += `<button class="btn" data-az="solo">Gioco da solo</button>`;
  if(mio) a += `<button class="btn pericolo" data-az="annulla">Annulla la prenotazione</button>`;
  else if(isAdmin()) a += `<button class="btn pericolo" data-az="annulla">Annulla (amministratore)</button>`;
  a += `<button class="btn" data-az="chiudi">Chiudi</button>`;
  $("#dettaglio").innerHTML = h;
  $("#dettaglio-azioni").innerHTML = a;
  $("#dettaglio-azioni").dataset.id = id;
  $("#dlg-dettaglio").showModal();
}

$("#dettaglio-azioni").addEventListener("click", async e => {
  const az = e.target.closest("[data-az]") && e.target.closest("[data-az]").dataset.az;
  if(!az) return;
  const id = e.currentTarget.dataset.id, p = S.pren[id];
  if(az === "chiudi" || !p) return $("#dlg-dettaglio").close();
  try{
    if(az === "gioco"){
      if(giocaGia(S.uid, p.min)) return toast("Hai già una partita in quell'orario");
      await dbWrite({[percorso(id) + "/stato"]: "confermata", [percorso(id) + "/avversario"]: S.uid, [percorso(id) + "/avversarioNome"]: S.io.nome});
      toast(`Fatto! Giochi con ${p.titolareNome} alle ${hhmm(p.min)}, biliardo ${p.tavolo}`);
    }
    if(az === "solo"){
      await dbWrite({[percorso(id) + "/stato"]: "confermata", [percorso(id) + "/scade"]: null,
        [percorso(id) + "/specialita"]: null, [percorso(id) + "/livello"]: null, [percorso(id) + "/nota"]: null});
      toast("Confermato: il biliardo è tuo");
    }
    if(az === "annulla"){
      $("#dlg-dettaglio").close();
      if(!(await chiedi("Vuoi annullare la prenotazione e liberare il biliardo?", "Sì, annulla", "No"))) return;
      const w = {[percorso(id) + "/stato"]: "annullata"};
      slotDi(S.oggi, p.tavolo, p.min).forEach(k => w[k] = null);
      await dbWrite(w);
      toast("Prenotazione annullata");
    }
    $("#dlg-dettaglio").close();
  }catch(err){ toast(msgErrore(err)); }
});

/* Le richieste "Cerco avversario" scadute liberano il biliardo: lo fa il primo socio che ha l'app aperta. */
function liberaScadute(){
  Object.entries(S.pren).forEach(([id, p]) => {
    if(!scaduta(p) || S.scadendo.has(id)) return;
    S.scadendo.add(id);
    const w = {[percorso(id) + "/stato"]: "scaduta"};
    slotDi(S.oggi, p.tavolo, p.min).forEach(k => w[k] = null);
    dbWrite(w).catch(() => S.scadendo.delete(id));
  });
}
