/* Prenota 2P · partite.js — Partite programmate per i giorni successivi (non bloccano biliardi) */

const STATO_PARTITA = {aperta: "cerca avversario", proposta: "in attesa di risposta", accettata: "confermata",
  rifiutata: "rifiutata", prenotata: "biliardo prenotato", annullata: "annullata"};

/* "dalle 21 di oggi", "dalle 9 di domani"... */
function quandoApre(data, min){
  const p = partiRoma(apreAlle(data, min));
  const g = p.y + "-" + String(p.m).padStart(2, "0") + "-" + String(p.d).padStart(2, "0");
  return "dalle " + p.h + (p.min ? ":" + String(p.min).padStart(2, "0") : "") + " " + (g === S.oggi ? "di oggi" : g === S.domani ? "di domani" : "di " + dataLunga(g));
}

function preparaFormPartita(){
  const f = $("#form-partita");
  f.giorno.min = piuGiorni(S.oggi, 1);
  if(!f.giorno.value || f.giorno.value <= S.oggi) f.giorno.value = piuGiorni(S.oggi, 1);
  if(!f.ora.options.length){
    let o = "";
    for(let m = PRIMO(); m <= ULTIMO(); m += SALA.passo) o += `<option value="${m}" ${m === 20 * 60 ? "selected" : ""}>${hhmm(m)}</option>`;
    f.ora.innerHTML = o;
  }
  const scelto = f.avversario.value;
  f.avversario.innerHTML = `<option value="">Chiunque (cerco avversario)</option>` + Object.entries(S.soci)
    .filter(([id, s]) => id !== S.uid && s.stato === "attivo")
    .sort((a, b) => a[1].nome.localeCompare(b[1].nome, "it"))
    .map(([id, s]) => `<option value="${id}">${esc(s.nome)}</option>`).join("");
  f.avversario.value = scelto;
}

$("#form-partita").addEventListener("submit", async e => {
  e.preventDefault();
  const f = e.target, avv = f.avversario.value;
  if(f.giorno.value <= S.oggi) return toast("Per oggi prenota direttamente dalla griglia");
  const m = {giorno: f.giorno.value, min: +f.ora.value, proponente: S.uid, proponenteNome: S.io.nome,
    stato: avv ? "proposta" : "aperta", creata: ORA_SERVER};
  if(avv){ m.avversario = avv; m.avversarioNome = nomeDi(avv); }
  if(f.nota.value.trim()) m.nota = f.nota.value.trim().slice(0, 120);
  try{
    await dbWrite({["partite/" + nuovoId()]: m});
    f.nota.value = "";
    toast(avv ? `Proposta inviata a ${nomeDi(avv)}` : "Proposta pubblicata per tutti i soci");
  }catch(err){ toast(msgErrore(err)); }
});

/* chi tra i due giocatori ha già una prenotazione attiva che si sovrappone alla partita (solo oggi e domani) */
function giaPrenotato(m){
  const lista = prenDi(m.giorno);
  return [m.proponente, m.avversario].filter(Boolean)
    .map(uid => ({uid, p: lista.find(p => p.partita !== m.id && (p.titolare === uid || p.avversario === uid) && p.min < m.min + SALA.durata && m.min < p.min + durataDi(p))}))
    .find(x => x.p);
}

function disegnaPartite(){
  preparaFormPartita();
  const ora = Date.now();
  const lista = Object.entries(S.partite).map(([id, m]) => ({id, ...m}))
    .filter(m => m.giorno >= S.oggi && m.stato !== "annullata" && m.stato !== "rifiutata"
      /* un orario già iniziato non interessa più (le partite col biliardo prenotato restano fino all'inizio) */
      && msRoma(m.giorno, m.min) > ora
      && (m.proponente === S.uid || m.avversario === S.uid
        /* una richiesta aperta la vedono gli altri solo finché l'orario non si prenota: poi si usa «Cerco un avversario» nella griglia */
        || (m.stato === "aperta" && !prenotabile(m.giorno, m.min))))
    .sort((a, b) => (a.giorno + hhmm(a.min)).localeCompare(b.giorno + hhmm(b.min)));
  const daRispondere = lista.filter(m => m.stato === "proposta" && m.avversario === S.uid).length;
  $("#conta-partite").textContent = daRispondere || "";
  $("#conta-partite").hidden = !daRispondere;
  $("#partite").innerHTML = lista.length ? lista.map(m => {
    const io = m.proponente === S.uid, apre = prenotabile(m.giorno, m.min), gia = giaPrenotato(m);
    const contro = io ? (m.avversarioNome ? esc(m.avversarioNome) : "chiunque") : (m.avversario === S.uid ? "te" : "?");
    let b = "", info = "";
    if(m.stato === "proposta" && m.avversario === S.uid) b += `<button class="btn primario" data-az="accetta">Accetto</button><button class="btn" data-az="rifiuta">Non posso</button>`;
    if(m.stato === "aperta" && !io && !apre) b += `<button class="btn primario" data-az="prendo">Gioco io</button>`;
    if(m.stato === "aperta" && io && apre){
      info = "Ora quest'orario si prenota: prenota il biliardo con «Cerco un avversario», così la richiesta compare nella scheda Avversari.";
      if(!gia) b += `<button class="btn primario" data-az="prenota-cerca">Prenota e cerca avversario</button>`;
    }
    if(m.stato === "accettata")
      b += !apre ? `<span class="meta">Potrai prenotare il biliardo ${quandoApre(m.giorno, m.min)}</span>`
        : gia ? "" : `<button class="btn primario" data-az="prenota">Prenota il biliardo</button>`;
    if(gia && (m.stato === "accettata" || (m.stato === "aperta" && io && apre)))
      info = `${gia.uid === S.uid ? "Hai" : esc(nomeDi(gia.uid)) + " ha"} già il biliardo ${gia.p.tavolo} ${fascia(gia.p.min, durataDi(gia.p))}` +
        (gia.p.stato === "aperta" ? " (cerca avversario)" : gia.p.avversarioNome ? " con " + esc(gia.p.avversarioNome) : " da solo") +
        (io ? ": accordatevi direttamente o annulla questa partita." : ": accordatevi direttamente.");
    if(io && ["aperta", "proposta", "accettata"].includes(m.stato)) b += `<button class="btn pericolo" data-az="annulla">Annulla</button>`;
    return `<li class="scheda" data-id="${m.id}">
      <div class="grande"><b>${m.giorno === S.oggi ? "Oggi" : m.giorno === S.domani ? "Domani" : dataLunga(m.giorno)}</b> alle <b>${hhmm(m.min)}</b></div>
      <div>${m.stato === "aperta" ? (io ? "Cerchi un avversario" : `<b>${esc(m.proponenteNome)}</b>${badgeNuovo(m.proponente)} cerca un avversario`)
        : `${io ? "Tu" : esc(m.proponenteNome)} contro ${contro}`}</div>
      <div class="meta">${STATO_PARTITA[m.stato] || m.stato}</div>
      ${m.nota ? `<div class="nota">«${esc(m.nota)}»</div>` : ""}
      ${info ? `<div class="meta">${info}</div>` : ""}
      ${b ? `<div class="riga">${b}</div>` : ""}</li>`;
  }).join("") : `<li class="vuoto">Nessuna partita programmata.</li>`;
}

$("#partite").addEventListener("click", async e => {
  const az = e.target.closest("[data-az]") && e.target.closest("[data-az]").dataset.az;
  if(!az) return;
  const id = e.target.closest("li").dataset.id, m = S.partite[id], k = "partite/" + id + "/";
  try{
    if(az === "accetta") await dbWrite({[k + "stato"]: "accettata"});
    if(az === "rifiuta") await dbWrite({[k + "stato"]: "rifiutata"});
    if(az === "prendo") await dbWrite({[k + "stato"]: "accettata", [k + "avversario"]: S.uid, [k + "avversarioNome"]: S.io.nome});
    if(az === "annulla" && await chiedi("Annullare la partita programmata?", "Sì, annulla", "No")) await dbWrite({[k + "stato"]: "annullata"});
    if(az === "prenota" || az === "prenota-cerca"){
      const lista = prenDi(m.giorno);
      const libero = TAVOLI().find(t => !occupato(lista, t, m.min, m.min + SALA.durata)) || TAVOLI().find(t => !occupato(lista, t, m.min, m.min + SALA.passo));
      if(!libero) return toast(`Alle ${hhmm(m.min)} non c'è un biliardo libero: scegli un altro orario dalla griglia`);
      S.giorno = m.giorno;
      nuovaSelezione(libero, m.min);
      if(az === "prenota") Object.assign(S.sel, {partita: id, avversario: m.proponente === S.uid ? m.avversario : m.proponente});
      else Object.assign(S.sel, {chiudiPartita: id, modo: "cerca", nota: m.nota || ""});
      $("nav button[data-tab=tab-oggi]").click();
      const el = $("#griglia .selezione");
      if(el) el.scrollIntoView({block: "center"});
      toast("Controlla biliardo e orario, poi tocca «Avanti»");
    }
  }catch(err){ toast(msgErrore(err)); }
});
