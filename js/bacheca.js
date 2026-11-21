/* Prenota 2P · bacheca.js — Chi cerca un avversario oggi e domani */

function disegnaBacheca(){
  if(S.ospite) return;
  const lista = [S.oggi, S.domani].flatMap(d => prenDi(d).map(p => ({...p, data: d})))
    .filter(p => p.stato === "aperta").sort((a, b) => (a.data + hhmm(a.min)).localeCompare(b.data + hhmm(b.min)));
  $("#conta-bacheca").textContent = lista.length || "";
  $("#conta-bacheca").hidden = !lista.length;
  $("#bacheca").innerHTML = lista.length ? lista.map(p => `
    <li class="scheda">
      <div class="grande"><b>${nomeGiorno(p.data) === "oggi" ? "Oggi" : "Domani"} ${fascia(p.min, durataDi(p))}</b> · Biliardo ${p.tavolo}</div>
      <div><b>${esc(p.titolareNome)}</b>${badgeNuovo(p.titolare)}</div>
      <div class="meta">livello ${esc(p.livello)}</div>
      ${p.nota ? `<div class="nota">«${esc(p.nota)}»</div>` : ""}
      ${p.titolare === S.uid
        ? `<button class="btn" data-id="${p.id}" data-data="${p.data}">È la tua richiesta</button>`
        : `<button class="btn primario" data-id="${p.id}" data-data="${p.data}">Gioco io</button>`}
    </li>`).join("")
    : `<li class="vuoto">Per ora nessuno cerca un avversario.<br>Puoi farlo tu: tocca uno spazio libero in «Prenota» e scegli «Cerco un avversario».</li>`;
}
$("#bacheca").addEventListener("click", e => {
  const b = e.target.closest("button[data-id]");
  if(b) apriDettaglio(b.dataset.data, b.dataset.id);
});
