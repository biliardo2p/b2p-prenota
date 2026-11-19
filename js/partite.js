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

function disegnaPartite(){
  preparaFormPartita();
  const lista = Object.entries(S.partite).map(([id, m]) => ({id, ...m}))
    .filter(m => m.giorno >= S.oggi && m.stato !== "annullata" && m.stato !== "rifiutata"
      && (m.proponente === S.uid || m.avversario === S.uid || m.stato === "aperta"))
    .sort((a, b) => (a.giorno + hhmm(a.min)).localeCompare(b.giorno + hhmm(b.min)));
  const daRispondere = lista.filter(m => m.stato === "proposta" && m.avversario === S.uid).length;
  $("#conta-partite").textContent = daRispondere || "";
  $("#conta-partite").hidden = !daRispondere;
  $("#partite").innerHTML = lista.length ? lista.map(m => {
    const io = m.proponente === S.uid;
    const contro = io ? (m.avversarioNome ? esc(m.avversarioNome) : "chiunque") : (m.avversario === S.uid ? "te" : "?");
    let b = "";
    if(m.stato === "proposta" && m.avversario === S.uid) b += `<button class="btn primario" data-az="accetta">Accetto</button><button class="btn" data-az="rifiuta">Non posso</button>`;
    if(m.stato === "aperta" && !io) b += `<button class="btn primario" data-az="prendo">Gioco io</button>`;
    if(m.stato === "accettata" && msRoma(m.giorno, m.min) > Date.now())
      b += prenotabile(m.giorno, m.min) ? `<button class="btn primario" data-az="prenota">Prenota il biliardo</button>`
        : `<span class="meta">Potrai prenotare il biliardo ${quandoApre(m.giorno, m.min)}</span>`;
    if(io && ["aperta", "proposta", "accettata"].includes(m.stato)) b += `<button class="btn pericolo" data-az="annulla">Annulla</button>`;
    return `<li class="scheda" data-id="${m.id}">
      <div class="grande"><b>${m.giorno === S.oggi ? "Oggi" : m.giorno === S.domani ? "Domani" : dataLunga(m.giorno)}</b> alle <b>${hhmm(m.min)}</b></div>
      <div>${m.stato === "aperta" ? (io ? "Cerchi un avversario" : `<b>${esc(m.proponenteNome)}</b>${badgeNuovo(m.proponente)} cerca un avversario`)
        : `${io ? "Tu" : esc(m.proponenteNome)} contro ${contro}`}</div>
      <div class="meta">${STATO_PARTITA[m.stato] || m.stato}</div>
      ${m.nota ? `<div class="nota">«${esc(m.nota)}»</div>` : ""}
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
    if(az === "prenota"){
      const lista = prenDi(m.giorno);
      const libero = TAVOLI().find(t => !occupato(lista, t, m.min, m.min + SALA.durata)) || TAVOLI().find(t => !occupato(lista, t, m.min, m.min + SALA.passo));
      if(!libero) return toast(`Alle ${hhmm(m.min)} non c'è un biliardo libero: scegli un altro orario dalla griglia`);
      S.giorno = m.giorno;
      nuovaSelezione(libero, m.min);
      Object.assign(S.sel, {partita: id, avversario: m.proponente === S.uid ? m.avversario : m.proponente});
      $("nav button[data-tab=tab-oggi]").click();
      const el = $("#griglia .selezione");
      if(el) el.scrollIntoView({block: "center"});
      toast("Controlla biliardo e orario, poi tocca «Avanti»");
    }
  }catch(err){ toast(msgErrore(err)); }
});
