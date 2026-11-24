/* Prenota 2P · statistiche.js — Statistiche sull'uso dei biliardi, per tutti i soci abilitati.
   Due viste: «Circolo» (solo numeri complessivi, nessun nome) e «Le mie» (le partite del socio collegato, con i suoi avversari).
   Legge le prenotazioni del periodo con una sola richiesta (ordinate per data) e calcola tutto nel browser. */

const GIORNI_SETT = ["Lun", "Mar", "Mer", "Gio", "Ven", "Sab", "Dom"];
const MESI = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const ST = {tipo: "mese", vista: location.hash === "#mie" ? "mie" : "circolo", rif: null, righe: [], per: null};
const IO = () => session && session.uid;
const mia = x => x.titolare === IO() || x.avversario === IO();
const ORE_APERTURA = () => (minuti(SALA.chiusura) - minuti(SALA.primoInizio)) / 60;
const fmt1 = n => n.toLocaleString("it-IT", {maximumFractionDigits: 1});
const pct = (a, b) => b ? Math.round(a / b * 100) : 0;
const giornoSett = d => (new Date(d + "T12:00:00Z").getUTCDay() + 6) % 7;   /* 0 = lunedì */

/* ================= periodo ================= */
function periodo(){
  const r = ST.rif, [y, m] = r.split("-").map(Number);
  let da, a, etichetta;
  if(ST.tipo === "settimana"){
    da = piuGiorni(r, -giornoSett(r)); a = piuGiorni(da, 6);
    const [, m1, d1] = da.split("-").map(Number), [y2, m2, d2] = a.split("-").map(Number);
    etichetta = `${d1}${m1 !== m2 ? " " + MESI[m1 - 1].slice(0, 3) : ""}–${d2} ${MESI[m2 - 1].slice(0, 3)} ${y2}`;
  }else if(ST.tipo === "mese"){
    da = `${y}-${String(m).padStart(2, "0")}-01`;
    a = piuGiorni(m === 12 ? `${y + 1}-01-01` : `${y}-${String(m + 1).padStart(2, "0")}-01`, -1);
    etichetta = MESI[m - 1] + " " + y;
  }else{
    da = `${y}-01-01`; a = `${y}-12-31`; etichetta = String(y);
  }
  /* giorni che contano per l'occupazione: fino a domani (le prenotazioni di domani esistono già) */
  const limite = piuGiorni(adesso().data, 1), giorni = [];
  for(let d = da; d <= a && d <= limite; d = piuGiorni(d, 1)) giorni.push(d);
  return {da, a, etichetta, giorni};
}
function sposta(n){
  const [y, m, d] = ST.rif.split("-").map(Number);
  if(ST.tipo === "settimana") ST.rif = piuGiorni(ST.rif, 7 * n);
  else if(ST.tipo === "mese"){ const t = new Date(Date.UTC(y, m - 1 + n, 1)); ST.rif = t.toISOString().slice(0, 10); }
  else ST.rif = `${y + n}-${String(m).padStart(2, "0")}-01`;
  carica();
}

/* ================= dati ================= */
async function carica(){
  const p = periodo();
  ST.per = p;
  $("#periodo-etichetta").textContent = p.etichetta;
  $("#periodo-nome").textContent = (ST.vista === "mie" ? "Le mie · " : "") + p.etichetta;
  $("#carico").hidden = false;
  try{
    const filtro = `&orderBy=${encodeURIComponent('"$key"')}&startAt=${encodeURIComponent('"' + p.da + '"')}&endAt=${encodeURIComponent('"' + p.a + '"')}`;
    const dati = (await dbGet("prenotazioni", filtro)) || {};
    ST.righe = Object.entries(dati).flatMap(([data, ps]) => Object.entries(ps || {}).map(([id, x]) => ({id, data, ...x})))
      .sort((x, y) => (x.data + hhmm(x.min)).localeCompare(y.data + hhmm(y.min)) || x.tavolo - y.tavolo);
    disegna();
  }catch(err){ toast(msgErrore(err)); }
  $("#carico").hidden = true;
}

const valida = x => ATTIVE.includes(x.stato);
function tipoDi(x){
  if(x.daOspite) return "Da ospite (app)";
  if(x.livello && x.avversario) return "Cerco avversario → trovato";
  if(x.avversario) return "Con un socio";
  if(x.ospite) return "Con un non socio";
  if(x.avversarioNome) return "Avversario scritto a mano";
  return "Da solo";
}

/* ================= disegno ================= */
function barreVerticali(voci, unita){
  const max = Math.max(1, ...voci.map(v => v.valore));
  return `<div class="barre-area">${voci.map(v => `
    <div class="colonna" data-tip="${esc(v.tip)}">
      <div class="barra" style="height:${v.valore / max * 100}%"></div>
    </div>`).join("")}</div>
    <div class="barre-etichette">${voci.map(v => `<span>${esc(v.etichetta)}</span>`).join("")}</div>
    <div class="barre-max meta">massimo ${fmt1(max)} ${unita}</div>`;
}
function barreOrizzontali(voci){
  const max = Math.max(1, ...voci.map(v => v.valore));
  return `<div class="orizz">${voci.map(v => `
    <div class="orizz-riga" data-tip="${esc(v.tip)}">
      <span class="orizz-nome">${esc(v.nome)}</span>
      <span class="orizz-binario"><span class="orizz-barra" style="width:${v.valore / max * 100}%"></span></span>
      <span class="orizz-valore">${esc(v.testo)}</span>
    </div>`).join("")}</div>`;
}

function disegna(){
  const p = ST.per, mie = ST.vista === "mie", righe = mie ? ST.righe.filter(mia) : ST.righe, val = righe.filter(valida);
  const ore = val.reduce((s, x) => s + durataDi(x) / 60, 0);
  const oreDisp = SALA.tavoli * ORE_APERTURA() * p.giorni.length;
  const annullate = righe.filter(x => x.stato === "annullata").length;
  const giocatori = new Set(val.flatMap(x => [x.titolare, x.avversario]).filter(u => u && u !== "anonimo"));

  /* avversari della persona collegata: socio (per scheda) o nome scritto a mano */
  const avversari = {};
  if(mie) val.forEach(x => {
    const altro = x.titolare === IO() ? (x.avversario ? {k: x.avversario, nome: x.avversarioNome} : x.avversarioNome ? {k: "n:" + x.avversarioNome.toLowerCase(), nome: x.avversarioNome} : null)
                                      : {k: x.titolare, nome: x.titolareNome};
    if(!altro || altro.k === "anonimo") return;
    const a = avversari[altro.k] = avversari[altro.k] || {nome: altro.nome, ore: 0, n: 0};
    a.ore += durataDi(x) / 60; a.n++;
  });
  $("#tiles").innerHTML = (mie ? [
    ["Ore giocate", fmt1(ore), "nel periodo"],
    ["Partite", val.length, val.length ? `durata media ${testoDurata(Math.round(ore * 60 / val.length / 30) * 30) || "—"}` : "—"],
    ["Avversari diversi", Object.keys(avversari).length, "soci e non soci"],
    ["Da solo", val.filter(x => tipoDi(x) === "Da solo").length, "allenamenti"],
    ["Annullate", righe.filter(x => x.stato === "annullata").length, "non contate nelle ore"]
  ] : [
    ["Ore prenotate", fmt1(ore), `su ${fmt1(oreDisp)} disponibili`],
    ["Occupazione", pct(ore, oreDisp) + "%", "dei biliardi nell'orario di apertura"],
    ["Prenotazioni", val.length, val.length ? `durata media ${testoDurata(Math.round(ore * 60 / val.length / 30) * 30) || "—"}` : "—"],
    ["Giocatori diversi", giocatori.size, "soci e utenze ospite"],
    ["Annullate", annullate, "non contate nelle ore"]
  ]).map(([t, v, s]) => `<div class="tile"><div class="tile-titolo">${t}</div><div class="tile-valore">${v}</div><div class="meta">${s}</div></div>`).join("");

  /* andamento: per giorno (settimana, mese) o per mese (anno) */
  let voci;
  if(ST.tipo === "anno"){
    const y = p.da.slice(0, 4);
    voci = MESI.map((nome, i) => {
      const k = `${y}-${String(i + 1).padStart(2, "0")}`;
      const v = val.filter(x => x.data.startsWith(k)).reduce((s, x) => s + durataDi(x) / 60, 0);
      return {valore: v, etichetta: nome.slice(0, 3), tip: `${nome} ${y}: ${fmt1(v)} ore`};
    });
    $("#andamento-unita").textContent = "per mese";
  }else{
    voci = [];
    for(let d = p.da; d <= p.a; d = piuGiorni(d, 1)){
      const v = val.filter(x => x.data === d).reduce((s, x) => s + durataDi(x) / 60, 0);
      const g = +d.slice(8);
      voci.push({valore: v, etichetta: ST.tipo === "settimana" ? GIORNI_SETT[giornoSett(d)] + " " + g : (g === 1 || g % 5 === 0 ? String(g) : ""),
        tip: mie ? `${dataLunga(d)}: ${fmt1(v)} ore` : `${dataLunga(d)}: ${fmt1(v)} ore (${pct(v, SALA.tavoli * ORE_APERTURA())}% di occupazione)`});
    }
    $("#andamento-unita").textContent = "per giorno";
  }
  $("#titolo-andamento").textContent = mie ? "Ore giocate" : "Ore prenotate";
  $("#andamento").innerHTML = barreVerticali(voci, "ore");

  /* per biliardo */
  const oreTav = Array.from({length: SALA.tavoli}, (_, i) => val.filter(x => x.tavolo === i + 1).reduce((s, x) => s + durataDi(x) / 60, 0));
  const dispTav = ORE_APERTURA() * p.giorni.length;
  $("#titolo-biliardo").textContent = mie ? "Su quali biliardi" : "Per biliardo";
  $("#per-biliardo").innerHTML = barreOrizzontali(oreTav.map((v, i) => mie ? ({
    nome: "Biliardo " + (i + 1), valore: v, testo: `${fmt1(v)} h · ${pct(v, ore)}%`,
    tip: `Biliardo ${i + 1}: ${fmt1(v)} ore, ${pct(v, ore)}% delle tue ore`}) : ({
    nome: "Biliardo " + (i + 1), valore: v, testo: `${fmt1(v)} h · ${pct(v, dispTav)}%`,
    tip: `Biliardo ${i + 1}: ${fmt1(v)} ore prenotate, ${pct(v, dispTav)}% di occupazione`})));

  /* tipo di partita */
  const tipi = {};
  val.forEach(x => { const t = tipoDi(x); tipi[t] = (tipi[t] || 0) + 1; });
  const tipiOrd = Object.entries(tipi).sort((a, b) => b[1] - a[1]);
  $("#per-tipo").innerHTML = tipiOrd.length ? barreOrizzontali(tipiOrd.map(([t, n]) => ({
    nome: t, valore: n, testo: `${n} · ${pct(n, val.length)}%`, tip: `${t}: ${n} prenotazioni (${pct(n, val.length)}%)`}))) : `<p class="meta">Nessuna prenotazione nel periodo.</p>`;

  /* mappa giorni × ore */
  const oraDa = minuti(SALA.primoInizio) / 60, oraA = minuti(SALA.chiusura) / 60;
  const ore24 = Array.from({length: oraA - oraDa}, (_, i) => oraDa + i);
  const conta = Array.from({length: 7}, () => ore24.map(() => 0));
  const giorniPer = Array(7).fill(0);
  p.giorni.forEach(d => giorniPer[giornoSett(d)]++);
  val.forEach(x => {
    const gs = giornoSett(x.data);
    for(let m = x.min; m < x.min + durataDi(x); m += SALA.passo){
      const h = Math.floor(m / 60) - oraDa;
      if(h >= 0 && h < ore24.length) conta[gs][h] += SALA.passo / 60;
    }
  });
  /* circolo: occupazione media (ore / ore disponibili); le mie: ore giocate in quella fascia */
  const quota = (v, gs) => mie ? v : (SALA.tavoli * giorniPer[gs] ? v / (SALA.tavoli * giorniPer[gs]) : 0);
  const qMax = Math.max(mie ? 0.5 : 0.01, ...conta.flatMap((riga, gs) => riga.map(v => quota(v, gs))));
  $("#titolo-mappa").textContent = mie ? "Quando gioco" : "Quando si gioca";
  $("#nota-mappa").textContent = mie ? "Le tue ore per giorno della settimana e ora: più il colore è acceso, più ci giochi. Passa sopra una casella per il valore."
    : "Occupazione media dei biliardi per giorno della settimana e ora: più il colore è acceso, più i biliardi sono occupati. Passa sopra una casella per il valore.";
  let h = `<table class="mappa"><thead><tr><th></th>${ore24.map(o => `<th>${o}</th>`).join("")}</tr></thead><tbody>`;
  conta.forEach((riga, gs) => {
    h += `<tr><th>${GIORNI_SETT[gs]}</th>` + riga.map((v, i) => {
      const q = quota(v, gs);
      const tip = `${GIORNI_SETT[gs]} ${ore24[i]}–${ore24[i] + 1}: ` + (mie ? `${fmt1(v)} ore` : `${Math.round(q * 100)}% di occupazione`);
      return `<td data-tip="${tip}" style="--q:${(q / qMax).toFixed(3)}"></td>`;
    }).join("") + "</tr>";
  });
  $("#mappa").innerHTML = h + `</tbody></table>
    <div class="scala meta"><span>${mie ? "0" : "0%"}</span><span class="scala-barra"></span><span>${mie ? fmt1(qMax) + " ore" : Math.round(qMax * 100) + "%"} (il massimo del periodo)</span></div>`;

  $("#nota-fondo").textContent = mie
    ? "Contano le tue partite attive o confermate, da titolare o da avversario; le annullate sono indicate a parte. Questa vista la vedi solo tu."
    : "Si contano le prenotazioni attive o confermate (incluse quelle da ospite da confermare); le annullate sono indicate a parte. Le ore disponibili sono: biliardi × ore di apertura (8–24) × giorni del periodo fino a domani.";
  $("#solo-mie").hidden = !mie;
  if(!mie) return;

  /* le mie richieste «Cerco avversario» */
  const mieRich = righe.filter(x => x.titolare === IO() && x.livello && (x.stato === "scaduta" || x.stato === "aperta" || x.avversario));
  const mieTrov = mieRich.filter(x => x.avversario && x.stato === "confermata").length, mieScad = mieRich.filter(x => x.stato === "scaduta").length;
  $("#cerco").innerHTML = mieRich.length ? `
    <div class="tile piatto"><div class="tile-valore">${mieTrov} su ${mieRich.length}</div>
      <div class="meta">richieste che hanno trovato un avversario (${pct(mieTrov, mieRich.length)}%)</div></div>
    <p class="meta">Scadute senza avversario: ${mieScad}. Ancora aperte o diventate «gioco da solo»: ${mieRich.length - mieTrov - mieScad}.</p>`
    : `<p class="meta">Nessuna richiesta «Cerco avversario» nel periodo.</p>`;

  /* i miei avversari */
  const top = Object.values(avversari).sort((a, b) => b.n - a.n || b.ore - a.ore).slice(0, 15);
  $("#top").innerHTML = top.length ? barreOrizzontali(top.map(a => ({
    nome: a.nome, valore: a.n, testo: `${a.n} · ${fmt1(a.ore)} h`, tip: `${a.nome}: ${a.n} partite, ${fmt1(a.ore)} ore`})))
    : `<p class="meta">Nessun avversario nel periodo.</p>`;
}

/* ================= CSV per Excel ================= */
function scaricaCSV(){
  const c = v => { const s = String(v ?? ""); return /[;"\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s; };
  const mie = ST.vista === "mie";
  const intest = ["data", "giorno", "biliardo", "inizio", "fine", "durata_min", "stato", "tipo", ...(mie ? ["titolare", "avversario"] : [])];
  const righe = (mie ? ST.righe.filter(mia) : ST.righe).map(x => [x.data, GIORNI_SETT[giornoSett(x.data)], x.tavolo, hhmm(x.min), hhmm(x.min + durataDi(x)),
    durataDi(x), x.stato, tipoDi(x), ...(mie ? [x.titolareNome, x.avversarioNome || ""] : [])].map(c).join(";"));
  const blob = new Blob([String.fromCharCode(0xFEFF) + [intest.join(";"), ...righe].join("\r\n")], {type: "text/csv;charset=utf-8"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `${mie ? "mie_partite" : "prenotazioni"}_${ST.per.da}_${ST.per.a}.csv`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/* ================= suggerimenti al passaggio del mouse o al tocco ================= */
const tipEl = $("#suggerimento");
function mostraTip(e){
  const t = e.target.closest("[data-tip]");
  if(!t){ tipEl.hidden = true; return; }
  tipEl.textContent = t.dataset.tip;
  tipEl.hidden = false;
  const r = t.getBoundingClientRect(), w = tipEl.offsetWidth;
  tipEl.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + r.width / 2 - w / 2)) + "px";
  tipEl.style.top = Math.max(8, r.top - tipEl.offsetHeight - 8) + "px";
}
document.addEventListener("pointerover", mostraTip);
document.addEventListener("click", mostraTip);
addEventListener("scroll", () => tipEl.hidden = true, {passive: true});

/* ================= avvio ================= */
$$("#periodi button").forEach(b => b.addEventListener("click", () => {
  $$("#periodi button").forEach(x => x.classList.toggle("attivo", x === b));
  ST.tipo = b.dataset.tipo;
  carica();
}));
function scegliVista(v){
  ST.vista = v;
  $$("#vista button").forEach(x => x.classList.toggle("attivo", x.dataset.vista === v));
  history.replaceState(null, "", v === "mie" ? "#mie" : location.pathname + location.search);
  $(".titolo").textContent = v === "mie" ? "Le mie statistiche" : "Statistiche biliardi";
}
$$("#vista button").forEach(b => b.addEventListener("click", () => { scegliVista(b.dataset.vista); if(ST.per) disegna(); }));
$("#prec").addEventListener("click", () => sposta(-1));
$("#succ").addEventListener("click", () => sposta(1));
$("#csv").addEventListener("click", scaricaCSV);

(async () => {
  ST.rif = adesso().data;
  S.oggi = ST.rif;
  let io = null;
  try{ if(session && !session.ospite) io = await dbGet("soci/" + session.uid); }catch(e){}
  if(!io || io.stato !== "attivo"){ $("#negato").hidden = false; return; }
  scegliVista(ST.vista);
  $("#stat").hidden = false;
  carica();
})();
