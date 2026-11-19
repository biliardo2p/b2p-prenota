/* Prenota 2P · bacheca.js — Chi cerca un avversario oggi */

function disegnaBacheca(){
  const lista = attive().filter(p => p.stato === "aperta").sort((a, b) => a.min - b.min);
  $("#conta-bacheca").textContent = lista.length ? lista.length : "";
  $("#conta-bacheca").hidden = !lista.length;
  $("#bacheca").innerHTML = lista.length ? lista.map(p => `
    <li class="scheda">
      <div class="grande"><b>${hhmm(p.min)}</b> · Biliardo ${p.tavolo}</div>
      <div><b>${esc(p.titolareNome)}</b>${badgeNuovo(p.titolare)}</div>
      <div class="meta">${esc(p.specialita)} · livello ${esc(p.livello)}</div>
      ${p.nota ? `<div class="nota">«${esc(p.nota)}»</div>` : ""}
      ${p.titolare === S.uid
        ? `<button class="btn" data-id="${p.id}">È la tua richiesta</button>`
        : `<button class="btn primario" data-id="${p.id}">Gioco io</button>`}
    </li>`).join("")
    : `<li class="vuoto">Per ora nessuno cerca un avversario.<br>Puoi farlo tu: tocca uno spazio libero in «Oggi» e scegli «Cerco avversario».</li>`;
}
$("#bacheca").addEventListener("click", e => {
  const b = e.target.closest("button[data-id]");
  if(b) apriDettaglio(b.dataset.id);
});
