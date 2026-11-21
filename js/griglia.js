/* Prenota 2P · griglia.js — Situazione dei biliardi (oggi o domani): righe = mezz'ore, colonne = biliardi.
   Un tocco su uno spazio libero propone 2 ore (o meno, se dopo c'è un'altra prenotazione);
   la selezione si allunga, accorcia e sposta trascinandola oppure con i pulsanti della barra. */

const STEP = () => SALA.passo;
const PRIMO = () => minuti(SALA.primoInizio);
const ULTIMO = () => minuti(SALA.ultimoInizio);
const CHIUDE = () => minuti(SALA.chiusura);
const TAVOLI = () => Array.from({length: SALA.tavoli}, (_, i) => i + 1);
const scaduta = p => p.stato === "aperta" && p.scade && p.scade <= Date.now();
/* si può prenotare adesso una partita che inizia alle "min" del giorno "data"? */
const prenotabile = (data, min) => Date.now() >= apreAlle(data, min) && msRoma(data, min) > Date.now() && min >= PRIMO() && min <= ULTIMO();

/* prenotazioni che occupano i biliardi in un giorno (le richieste scadute non contano più) */
function prenDi(data){
  return Object.entries(S.pren[data] || {}).map(([id, p]) => ({id, ...p})).filter(p => ATTIVE.includes(p.stato) && !scaduta(p));
}
function occupato(lista, tavolo, da, a, escludi){
  return lista.some(p => p.id !== escludi && p.tavolo === tavolo && p.min < a && da < p.min + durataDi(p));
}
function giocaGia(lista, uid, da, a, escludi){
  return lista.some(p => p.id !== escludi && (p.titolare === uid || p.avversario === uid) && p.min < a && da < p.min + durataDi(p));
}

/* ================= disegno ================= */
let trascina = null, daRidisegnare = false;

function disegnaGriglia(){
  if(!S.giorno) return;
  if(trascina){ daRidisegnare = true; return; }
  const data = S.giorno, lista = prenDi(data), ora = Date.now();
  $$(".scegli-giorno button").forEach(b => b.classList.toggle("attivo", b.dataset.giorno === data));
  $("#giorno-oggi").textContent = "Oggi · " + dataBreve(S.oggi);
  $("#giorno-domani").textContent = "Domani · " + dataBreve(S.domani);

  /* avviso per i padrini: nuovi soci che cercano un avversario */
  const nuovi = S.ospite ? [] : [S.oggi, S.domani].flatMap(d => prenDi(d).map(p => ({...p, d})))
    .filter(p => p.stato === "aperta" && nuovoSocio(p.titolare) && p.titolare !== S.uid);
  $("#avviso-padrini").hidden = !(S.io && S.io.padrino && nuovi.length);
  $("#avviso-padrini").innerHTML = nuovi.length === 1
    ? `<b>${esc(nuovi[0].titolareNome)}</b>, nuovo socio, cerca un avversario ${nomeGiorno(nuovi[0].d)} alle ${hhmm(nuovi[0].min)}.`
    : `${nuovi.length} nuovi soci cercano un avversario: guarda «Avversari».`;

  const righe = [];
  for(let m = PRIMO(); m < CHIUDE(); m += STEP()) righe.push(m);
  const g = $("#griglia");
  g.style.gridTemplateColumns = `3.4rem repeat(${SALA.tavoli}, 1fr)`;
  g.style.gridTemplateRows = `auto repeat(${righe.length}, var(--riga))`;
  const riga = m => (m - PRIMO()) / STEP() + 2;

  let h = `<div class="intest"></div>` + TAVOLI().map(t => `<div class="intest">Biliardo ${t}</div>`).join("");
  righe.forEach(m => {
    h += `<div class="ora" style="grid-row:${riga(m)}">${m % 60 === 0 ? hhmm(m) : ""}</div>`;
    TAVOLI().forEach(t => {
      if(occupato(lista, t, m, m + STEP())) return;
      const ok = prenotabile(data, m), passato = msRoma(data, m) <= ora;
      h += ok
        ? `<button class="cella libera" style="grid-row:${riga(m)};grid-column:${t + 1}" data-t="${t}" data-m="${m}" aria-label="Biliardo ${t} alle ${hhmm(m)}"></button>`
        : `<div class="cella ${passato || m > ULTIMO() ? "no" : "presto"}" style="grid-row:${riga(m)};grid-column:${t + 1}"></div>`;
    });
  });
  lista.forEach(p => {
    if(S.sel && S.sel.id === p.id) return;   /* in modifica: la mostra la selezione */
    const mia = p.titolare === S.uid || p.avversario === S.uid, d = durataDi(p);
    let chi;
    if(p.stato === "aperta") chi = `<b>${esc(p.titolareNome)}</b><br>cerca avversario`;
    else chi = `<b>${esc(p.titolareNome)}</b><br>${esc(p.avversarioNome || "da solo")}${p.stato === "da_confermare" ? '<br><i>da confermare</i>' : ""}`;
    h += `<button class="pren ${p.stato}${mia ? " mia" : ""}" data-id="${p.id}"
      style="grid-row:${riga(p.min)} / span ${d / STEP()};grid-column:${p.tavolo + 1}">
      <span class="fascia">${fascia(p.min, d)}</span>${chi}</button>`;
  });
  if(S.sel && S.sel.data === data){
    h += `<div class="selezione${erroreSel(S.sel) ? " errata" : ""}" style="grid-row:${riga(S.sel.min)} / span ${S.sel.durata / STEP()};grid-column:${S.sel.tavolo + 1}">
      <span class="maniglia su" aria-hidden="true"></span><span class="sel-testo"></span><span class="maniglia giu" aria-hidden="true"></span></div>`;
  }
  g.innerHTML = h;
  aggiornaSel();
}

$("#griglia").addEventListener("click", e => {
  if(e.target.closest(".selezione")) return;
  const c = e.target.closest(".cella.libera");
  if(c) return nuovaSelezione(+c.dataset.t, +c.dataset.m);
  const p = e.target.closest(".pren");
  if(p) apriDettaglio(S.giorno, p.dataset.id);
});
$$(".scegli-giorno button").forEach(b => b.addEventListener("click", () => {
  S.giorno = b.dataset.giorno;
  if(S.sel && S.sel.data !== S.giorno) S.sel = null;
  disegnaGriglia();
}));

/* ================= selezione ================= */
function erroreSel(s){
  const lista = prenDi(s.data);
  if(s.min < PRIMO()) return `Si può iniziare dalle ${SALA.primoInizio}`;
  if(s.min > ULTIMO()) return `L'ultimo inizio è alle ${SALA.ultimoInizio}`;
  if(s.durata < SALA.durataMin) return `Durata minima ${testoDurata(SALA.durataMin)}`;
  if(s.durata > SALA.durataMax) return `Durata massima ${testoDurata(SALA.durataMax)}`;
  if(s.min + s.durata > CHIUDE()) return `Si deve finire entro le ${SALA.chiusura}`;
  if(s.tavolo < 1 || s.tavolo > SALA.tavoli) return "Biliardo non valido";
  if(msRoma(s.data, s.min) <= Date.now()) return "Quest'orario è già passato";
  if(Date.now() < apreAlle(s.data, s.min))
    return s.min < minuti(SALA.mattinoFinoA) ? `Il mattino si prenota dalle ${SALA.aperturaMattino} della sera prima`
                                             : `Si prenota dalle ${SALA.aperturaPomeriggio} del giorno stesso`;
  if(occupato(lista, s.tavolo, s.min, s.min + s.durata, s.id)) return "Si sovrappone a un'altra prenotazione";
  return "";
}
function nuovaSelezione(tavolo, min){
  const lista = prenDi(S.giorno);
  let d = STEP();
  while(d < SALA.durata && min + d + STEP() <= CHIUDE() && !occupato(lista, tavolo, min, min + d + STEP())) d += STEP();
  S.sel = {data: S.giorno, tavolo, min, durata: d, id: null};
  disegnaGriglia();
}
function modificaSelezione(n){ if(!erroreSel(n)){ S.sel = n; disegnaGriglia(); } else toast(erroreSel(n)); }
function aggiornaSel(){
  const b = $("#barra-sel");
  b.hidden = !S.sel || S.sel.data !== S.giorno;
  document.body.classList.toggle("con-barra", !b.hidden);
  if(b.hidden) return;
  const s = S.sel, err = erroreSel(s);
  $("#sel-titolo").textContent = `${s.id ? "Modifica · " : ""}Biliardo ${s.tavolo} · ${fascia(s.min, s.durata)}`;
  $("#sel-durata").textContent = testoDurata(s.durata);
  $("#sel-errore").textContent = err;
  $("#sel-avanti").disabled = !!err;
  $("#sel-avanti").textContent = s.id ? "Salva la modifica" : "Avanti";
  const el = $("#griglia .selezione");
  if(el){
    el.style.gridRow = `${(s.min - PRIMO()) / STEP() + 2} / span ${s.durata / STEP()}`;
    el.style.gridColumn = String(s.tavolo + 1);
    el.classList.toggle("errata", !!err);
    el.querySelector(".sel-testo").textContent = fascia(s.min, s.durata);
  }
}
$("#barra-sel").addEventListener("click", e => {
  const az = e.target.closest("[data-sel]") && e.target.closest("[data-sel]").dataset.sel;
  if(!az || !S.sel) return;
  const s = {...S.sel}, p = STEP();
  if(az === "prima") s.min -= p;
  if(az === "dopo") s.min += p;
  if(az === "meno") s.durata -= p;
  if(az === "piu") s.durata += p;
  if(az === "annulla"){ S.sel = null; disegnaGriglia(); return; }
  if(az === "avanti") return S.sel.id ? salvaModifica() : apriPrenota();
  modificaSelezione(s);
});

/* ================= trascinamento (mouse e dito) ================= */
function rigaDa(y){
  const r = trascina.righe;
  let i = r.findIndex(b => y < b.bottom);
  if(i < 0) i = r.length - 1;
  if(y < r[0].top) i = 0;
  return i;
}
function colonnaDa(x){
  const c = trascina.colonne.findIndex(b => x >= b.left && x < b.right);
  return c < 0 ? null : c + 1;
}
$("#griglia").addEventListener("pointerdown", e => {
  const el = e.target.closest(".selezione");
  if(!el || !S.sel) return;
  e.preventDefault();
  const tipo = e.target.closest(".maniglia.su") ? "su" : e.target.closest(".maniglia.giu") ? "giu" : "sposta";
  trascina = {
    tipo, el, partenza: {...S.sel},
    righe: $$("#griglia .ora").map(o => o.getBoundingClientRect()),
    colonne: $$("#griglia .intest").slice(1).map(o => o.getBoundingClientRect())
  };
  trascina.r0 = rigaDa(e.clientY);
  el.setPointerCapture(e.pointerId);
  el.classList.add("trascinata");
});
$("#griglia").addEventListener("pointermove", e => {
  if(!trascina) return;
  const d = (rigaDa(e.clientY) - trascina.r0) * STEP(), s0 = trascina.partenza, n = {...s0};
  if(trascina.tipo === "sposta"){ n.min = s0.min + d; const c = colonnaDa(e.clientX); if(c) n.tavolo = c; }
  if(trascina.tipo === "su"){ n.min = s0.min + d; n.durata = s0.durata - d; }
  if(trascina.tipo === "giu") n.durata = s0.durata + d;
  if(!erroreSel(n)){ S.sel = n; aggiornaSel(); }
});
function fineTrascina(){
  if(!trascina) return;
  trascina.el.classList.remove("trascinata");
  trascina = null;
  disegnaGriglia();
  daRidisegnare = false;
}
$("#griglia").addEventListener("pointerup", fineTrascina);
$("#griglia").addEventListener("pointercancel", fineTrascina);
