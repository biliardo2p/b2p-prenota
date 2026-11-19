/* Prenota 2P · griglia.js — Situazione di oggi: righe = mezz'ore, colonne = biliardi */

const APRE = () => minuti(SALA.apertura);
const CHIUDE = () => minuti(SALA.chiusura);
const TAVOLI = () => Array.from({length: SALA.tavoli}, (_, i) => i + 1);
const prenotazioniAperte = () => adesso().min >= minuti(SALA.apronoAlle);
const scaduta = p => p.stato === "aperta" && p.scade && p.scade <= Date.now();

/* prenotazioni che occupano un tavolo (le richieste scadute non contano più) */
function attive(){ return Object.entries(S.pren).map(([id, p]) => ({id, ...p})).filter(p => ATTIVE.includes(p.stato) && !scaduta(p)); }
function occupato(tavolo, da, a, lista = attive()){ return lista.some(p => p.tavolo === tavolo && p.min < a && da < p.min + SALA.durata); }
function giocaGia(uid, da, lista = attive()){ return lista.some(p => (p.titolare === uid || p.avversario === uid) && p.min < da + SALA.durata && da < p.min + SALA.durata); }

function disegnaGriglia(){
  const g = $("#griglia"), ora = adesso(), aperte = prenotazioniAperte(), lista = attive();
  $("#avviso").innerHTML = aperte
    ? `Tocca uno spazio <b>libero</b> per prenotare <b>${SALA.durata / 60} ore</b>.`
    : `Le prenotazioni di oggi si aprono alle <b>${SALA.apronoAlle}</b>.`;
  $("#avviso").classList.toggle("chiuso", !aperte);

  /* avviso per i padrini: nuovi soci che cercano un avversario */
  const nuovi = lista.filter(p => p.stato === "aperta" && nuovoSocio(p.titolare) && p.titolare !== S.uid);
  $("#avviso-padrini").hidden = !(S.io && S.io.padrino && nuovi.length);
  $("#avviso-padrini").innerHTML = nuovi.length === 1
    ? `<b>${esc(nuovi[0].titolareNome)}</b>, nuovo socio, cerca un avversario alle ${hhmm(nuovi[0].min)}.`
    : `${nuovi.length} nuovi soci cercano un avversario: guarda «Cerco avversario».`;

  const righe = [];
  for(let m = APRE(); m < CHIUDE(); m += SALA.passo) righe.push(m);
  g.style.gridTemplateColumns = `3.4rem repeat(${SALA.tavoli}, 1fr)`;
  g.style.gridTemplateRows = `auto repeat(${righe.length}, var(--riga))`;

  let h = `<div class="intest"></div>` + TAVOLI().map(t => `<div class="intest">Biliardo ${t}</div>`).join("");
  righe.forEach((m, i) => {
    const r = i + 2;
    h += `<div class="ora" style="grid-row:${r}">${m % 60 === 0 ? hhmm(m) : ""}</div>`;
    TAVOLI().forEach(t => {
      if(occupato(t, m, m + SALA.passo, lista)) return;
      const ok = aperte && m > ora.min && m + SALA.durata <= CHIUDE() && !occupato(t, m, m + SALA.durata, lista);
      h += ok
        ? `<button class="cella libera" style="grid-row:${r};grid-column:${t + 1}" data-t="${t}" data-m="${m}" aria-label="Biliardo ${t} alle ${hhmm(m)}"></button>`
        : `<div class="cella no" style="grid-row:${r};grid-column:${t + 1}"></div>`;
    });
  });
  lista.forEach(p => {
    const r = (p.min - APRE()) / SALA.passo + 2, mia = p.titolare === S.uid || p.avversario === S.uid;
    const chi = p.stato === "aperta"
      ? `<b>${esc(p.titolareNome)}</b><br>cerca avversario`
      : `<b>${esc(p.titolareNome)}</b><br>${esc(p.avversarioNome || (p.ospite ? p.ospite + " (ospite)" : "da solo"))}`;
    h += `<button class="pren ${p.stato}${mia ? " mia" : ""}" data-id="${p.id}"
      style="grid-row:${r} / span ${SALA.durata / SALA.passo};grid-column:${p.tavolo + 1}">
      <span class="fascia">${fascia(p.min)}</span>${chi}</button>`;
  });
  g.innerHTML = h;
}

$("#griglia").addEventListener("click", e => {
  const c = e.target.closest(".cella.libera");
  if(c) return apriPrenota(+c.dataset.t, +c.dataset.m);
  const p = e.target.closest(".pren");
  if(p) apriDettaglio(p.dataset.id);
});
