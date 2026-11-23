/* Prenota 2P · prenotazione.js — Nuova prenotazione, dettaglio, modifica, "Gioco io", annullamento, scadenze */

const slotDi = (data, tavolo, min, durata) => {
  const k = [];
  for(let m = min; m < min + durata; m += SALA.passo) k.push("slot/" + data + "/" + tavolo + "/" + hhmm(m).replace(":", ""));
  return k;
};
const percorso = (data, id) => "prenotazioni/" + data + "/" + id;
const prenotazione = (data, id) => S.ospite ? S.mie[id] : (S.pren[data] || {})[id];
/* orari di una prenotazione a partire da data, biliardo, inizio e durata */
function orari(s){
  const inizio = msRoma(s.data, s.min);
  return {tavolo: s.tavolo, min: s.min, durata: s.durata, inizio, fine: inizio + s.durata * 60000, apertura: apreAlle(s.data, s.min)};
}
/* uid del socio che ha esattamente quel nome (avversario scritto a mano) */
function uidDaNome(nome){
  const n = nome.trim().toLowerCase();
  const e = Object.entries(S.soci).find(([id, s]) => id !== S.uid && s.stato === "attivo" && s.nome.toLowerCase() === n);
  return e ? e[0] : null;
}

/* ================= nuova prenotazione ================= */
function apriPrenota(){
  const s = S.sel, f = $("#form-prenota");
  f.reset();
  $("#prenota-titolo").textContent = `Biliardo ${s.tavolo} · ${nomeGiorno(s.data)} ${fascia(s.min, s.durata)}`;
  $("#prenota-soci").hidden = S.ospite;
  $("#prenota-ospite").hidden = !S.ospite;
  if(!S.ospite){
    $("#elenco-soci").innerHTML = Object.entries(S.soci).filter(([id, x]) => id !== S.uid && x.stato === "attivo")
      .map(([, x]) => `<option value="${esc(x.nome)}">`).join("");
    f.livello.innerHTML = LIVELLI.map(l => `<option ${l === S.io.livello ? "selected" : ""}>${l}</option>`).join("");
    if(s.avversario) f.avversario.value = nomeDi(s.avversario);
  }
  mostraCampi();
  $("#dlg-prenota").showModal();
}
function mostraCampi(){
  const f = $("#form-prenota");
  $$("#form-prenota [data-modo]").forEach(el => el.hidden = el.dataset.modo !== f.modo.value);
  f.avversarioOspite.disabled = f.solo.checked;
}
$("#form-prenota").addEventListener("change", mostraCampi);
$("#prenota-annulla").addEventListener("click", () => $("#dlg-prenota").close());

$("#form-prenota").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, s = S.sel, lista = prenDi(s.data), err = erroreSel(s);
  if(err) return toast(err);
  const p = {...orari(s), creata: ORA_SERVER};

  if(S.ospite){
    const nome = f.nomeOspite.value.trim().replace(/\s+/g, " ");
    if(nome.length < 2) return toast("Scrivi il tuo nome");
    p.titolare = S.uid; p.titolareNome = nome.slice(0, 60); p.stato = "da_confermare"; p.daOspite = true;
    if(!f.solo.checked){
      const avv = f.avversarioOspite.value.trim().replace(/\s+/g, " ");
      if(avv.length < 2) return toast("Scrivi il nome dell'avversario, oppure spunta «Gioco da solo»");
      p.avversarioNome = avv.slice(0, 60);
    }
  }else{
    const modo = f.modo.value;
    if(giocaGia(lista, S.uid, s.min, s.min + s.durata)) return toast("Hai già una partita in quell'orario");
    p.titolare = S.uid; p.titolareNome = S.io.nome; p.stato = "confermata";
    if(modo === "persona"){
      const nome = f.avversario.value.trim().replace(/\s+/g, " ");
      if(nome.length < 2) return toast("Scrivi il nome dell'avversario");
      const uid = uidDaNome(nome);
      if(uid){
        if(giocaGia(lista, uid, s.min, s.min + s.durata)) return toast(`${nomeDi(uid)} ha già una partita in quell'orario`);
        p.avversario = uid; p.avversarioNome = nomeDi(uid);
      }else p.avversarioNome = nome.slice(0, 60);
      if(f.nonSocio.checked) p.ospite = true;
    }
    if(modo === "cerca"){
      if(lista.some(x => x.titolare === S.uid && x.stato === "aperta")) return toast("Hai già una richiesta «Cerco avversario» aperta");
      p.stato = "aperta"; p.livello = f.livello.value;
      if(f.nota.value.trim()) p.nota = f.nota.value.trim().slice(0, 120);
      p.scade = p.inizio - SALA.scadenzaOre * 3600000;
      if(p.scade <= Date.now()) return toast(`Troppo tardi per cercare un avversario: serve almeno ${SALA.scadenzaOre} ore di anticipo`);
    }
    if(s.partita) p.partita = s.partita;
  }

  const id = nuovoId(), w = {[percorso(s.data, id)]: p};
  slotDi(s.data, s.tavolo, s.min, s.durata).forEach(k => w[k] = id);
  if(s.partita){ w["partite/" + s.partita + "/stato"] = "prenotata"; w["partite/" + s.partita + "/prenotazione"] = id; }
  const btn = f.querySelector("[type=submit]"); btn.disabled = true;
  try{
    await dbWrite(w);
    $("#dlg-prenota").close();
    S.sel = null;
    if(S.ospite){ ricordaMia(s.data, id); await caricaMie(); }
    disegnaGriglia();
    toast(S.ospite ? "Prenotazione inviata: il direttivo la confermerà" : p.stato === "aperta" ? "Richiesta pubblicata: compare in giallo" : "Prenotazione fatta!");
  }catch(err){
    if(err.code === "lento"){
      /* la prenotazione potrebbe essere arrivata lo stesso: si ricarica la situazione e si controlla */
      $("#dlg-prenota").close(); S.sel = null; ricaricaSituazione();
      toast("Il server ha risposto in ritardo: ho ricaricato la situazione, controlla se la prenotazione risulta fatta");
    }else toast(err.code === "PERMISSION_DENIED" ? "Non è stato possibile prenotare: lo spazio potrebbe essere già occupato" : msgErrore(err));
  }finally{ btn.disabled = false; }
});

/* ================= modifica (spostare, allungare, accorciare) ================= */
function iniziaModifica(data, id){
  const p = prenotazione(data, id);
  S.giorno = data;
  S.sel = {data, tavolo: p.tavolo, min: p.min, durata: durataDi(p), id};
  disegnaGriglia();
  const el = $("#griglia .selezione");
  if(el) el.scrollIntoView({block: "center", behavior: "smooth"});
  toast("Trascina il riquadro o usa i pulsanti in basso, poi «Salva la modifica»");
}
async function salvaModifica(){
  const s = S.sel, p = prenotazione(s.data, s.id), err = erroreSel(s);
  if(err) return toast(err);
  if(!S.ospite && giocaGia(prenDi(s.data), S.uid, s.min, s.min + s.durata, s.id)) return toast("Hai già un'altra partita in quell'orario");
  const nuovo = orari(s), base = percorso(s.data, s.id) + "/", w = {};
  Object.entries(nuovo).forEach(([k, v]) => w[base + k] = v);
  if(p.stato === "aperta"){
    w[base + "scade"] = nuovo.inizio - SALA.scadenzaOre * 3600000;
    if(w[base + "scade"] <= Date.now()) return toast(`«Cerco avversario» richiede almeno ${SALA.scadenzaOre} ore di anticipo`);
  }
  const vecchi = new Set(slotDi(s.data, p.tavolo, p.min, durataDi(p))), nuovi = new Set(slotDi(s.data, s.tavolo, s.min, s.durata));
  vecchi.forEach(k => { if(!nuovi.has(k)) w[k] = null; });
  nuovi.forEach(k => { if(!vecchi.has(k)) w[k] = s.id; });
  try{
    await dbWrite(w);
    S.sel = null;
    if(S.ospite) await caricaMie();
    disegnaGriglia();
    toast("Prenotazione modificata");
  }catch(err){
    if(err.code === "lento"){ S.sel = null; ricaricaSituazione(); toast("Il server ha risposto in ritardo: ho ricaricato la situazione, controlla se la modifica risulta fatta"); }
    else toast(err.code === "PERMISSION_DENIED" ? "Modifica non riuscita: lo spazio potrebbe essere già occupato" : msgErrore(err));
  }
}

/* ================= dettaglio ================= */
function apriDettaglio(data, id){
  const p = prenotazione(data, id);
  if(!p) return;
  const mio = p.titolare === S.uid, d = durataDi(p), iniziata = p.inizio <= Date.now();
  let h = `<h3>Biliardo ${p.tavolo} · ${nomeGiorno(data)} ${fascia(p.min, d)}</h3><p><b>${esc(p.titolareNome)}</b>${S.ospite ? "" : badgeNuovo(p.titolare)}`;
  if(p.stato === "aperta"){
    h += ` cerca un avversario.</p><p class="meta">Livello ${esc(p.livello)}<br>
      Se nessuno si aggiunge, alle ${hhmm((p.min - SALA.scadenzaOre * 60 + 1440) % 1440)} il biliardo si libera.</p>`;
    if(p.nota) h += `<p class="nota">«${esc(p.nota)}»</p>`;
  }else{
    h += ` gioca ${p.avversarioNome ? "con <b>" + esc(p.avversarioNome) + "</b>" + (p.ospite ? " (non socio)" : "") : "da solo"}.</p>`;
    if(p.stato === "da_confermare") h += `<p class="meta">Prenotazione da ospite: <b>da confermare</b> dal direttivo.</p>`;
  }
  let a = "";
  if(p.stato === "aperta" && !mio && !S.ospite) a += `<button class="btn primario" data-az="gioco">Gioco io</button>`;
  if(p.stato === "da_confermare" && isAdmin()) a += `<button class="btn primario" data-az="conferma">Conferma</button>`;
  if(p.stato === "aperta" && mio) a += `<button class="btn" data-az="solo">Gioco da solo</button>`;
  if(mio && !iniziata) a += `<button class="btn" data-az="modifica">Sposta o cambia durata</button>`;
  if(mio) a += `<button class="btn pericolo" data-az="annulla">Annulla la prenotazione</button>`;
  else if(isAdmin()) a += `<button class="btn pericolo" data-az="annulla">Annulla (amministratore)</button>`;
  a += `<button class="btn" data-az="chiudi">Chiudi</button>`;
  $("#dettaglio").innerHTML = h;
  $("#dettaglio-azioni").innerHTML = a;
  $("#dettaglio-azioni").dataset.id = id;
  $("#dettaglio-azioni").dataset.data = data;
  $("#dlg-dettaglio").showModal();
}

$("#dettaglio-azioni").addEventListener("click", async e => {
  const az = e.target.closest("[data-az]") && e.target.closest("[data-az]").dataset.az;
  if(!az) return;
  const {id, data} = e.currentTarget.dataset, p = prenotazione(data, id), k = percorso(data, id) + "/";
  if(az === "chiudi" || !p) return $("#dlg-dettaglio").close();
  try{
    if(az === "gioco"){
      if(giocaGia(prenDi(data), S.uid, p.min, p.min + durataDi(p))) return toast("Hai già una partita in quell'orario");
      await dbWrite({[k + "stato"]: "confermata", [k + "avversario"]: S.uid, [k + "avversarioNome"]: S.io.nome});
      toast(`Fatto! Giochi con ${p.titolareNome} ${nomeGiorno(data)} alle ${hhmm(p.min)}, biliardo ${p.tavolo}`);
    }
    if(az === "conferma"){ await dbWrite({[k + "stato"]: "confermata"}); toast("Prenotazione confermata"); }
    if(az === "solo"){
      await dbWrite({[k + "stato"]: "confermata", [k + "scade"]: null, [k + "specialita"]: null, [k + "livello"]: null, [k + "nota"]: null});
      toast("Confermato: il biliardo è tuo");
    }
    if(az === "modifica"){ $("#dlg-dettaglio").close(); return iniziaModifica(data, id); }
    if(az === "annulla"){
      $("#dlg-dettaglio").close();
      if(!(await chiedi("Vuoi annullare la prenotazione e liberare il biliardo?", "Sì, annulla", "No"))) return;
      const w = {[k + "stato"]: "annullata"};
      slotDi(data, p.tavolo, p.min, durataDi(p)).forEach(x => w[x] = null);
      await dbWrite(w);
      if(S.ospite) await caricaMie();
      toast("Prenotazione annullata");
    }
    $("#dlg-dettaglio").close();
  }catch(err){
    if(err.code === "lento"){ $("#dlg-dettaglio").close(); ricaricaSituazione(); }
    toast(msgErrore(err));
  }
});
/* riapre gli ascolti in tempo reale (dopo una richiesta rimasta senza risposta) */
function ricaricaSituazione(){ chiudiAscolti(); ascoltaTutto(); }

/* Le richieste "Cerco avversario" scadute liberano il biliardo: lo fa il primo socio che ha l'app aperta. */
function liberaScadute(){
  if(S.ospite) return;
  Object.entries(S.pren).forEach(([data, tutte]) => Object.entries(tutte || {}).forEach(([id, p]) => {
    if(!scaduta(p) || S.scadendo.has(id)) return;
    S.scadendo.add(id);
    const w = {[percorso(data, id) + "/stato"]: "scaduta"};
    slotDi(data, p.tavolo, p.min, durataDi(p)).forEach(k => w[k] = null);
    dbWrite(w).catch(() => S.scadendo.delete(id));
  }));
}

/* ================= ospiti: le proprie prenotazioni ================= */
const MKEY = KEY + "mie";
function ricordaMia(data, id){
  let l = [];
  try{ l = JSON.parse(localStorage.getItem(MKEY) || "[]"); }catch(e){}
  l.push({data, id});
  try{ localStorage.setItem(MKEY, JSON.stringify(l.filter(x => x.data >= S.oggi))); }catch(e){}
}
async function caricaMie(){
  let l = [];
  try{ l = JSON.parse(localStorage.getItem(MKEY) || "[]").filter(x => x.data >= S.oggi); }catch(e){}
  const mie = {};
  await Promise.all(l.map(async x => {
    try{ const p = await dbGet(percorso(x.data, x.id)); if(p && ATTIVE.includes(p.stato)) mie[x.id] = p; }catch(e){}
  }));
  S.mie = mie;
  disegnaTutto();
}
