"use strict";

const $ = (id) => document.getElementById(id);
const inputText = $("inputText"), inputLabel = $("inputLabel");
const modeEs = $("modeEs"), modeEn = $("modeEn");
const goBtn = $("goBtn"), errorMsg = $("errorMsg");
const resultCard = $("resultCard"), resultEnglish = $("resultEnglish");
const resultPhonetic = $("resultPhonetic"), listenBtn = $("listenBtn");
const packsEl = $("packs"), historyEl = $("history");

let mode = "es";
let lastEnglish = "";

function setMode(next) {
  mode = next;
  const esActive = next === "es";
  modeEs.classList.toggle("active", esActive);
  modeEn.classList.toggle("active", !esActive);
  modeEs.setAttribute("aria-selected", String(esActive));
  modeEn.setAttribute("aria-selected", String(!esActive));
  inputLabel.textContent = esActive ? "Escribe en español:" : "Write in English:";
  inputText.placeholder = esActive
    ? "Ej. Necesito ayuda, por favor"
    : "E.g. I need help, please";
}
modeEs.addEventListener("click", () => setMode("es"));
modeEn.addEventListener("click", () => setMode("en"));

function showError(msg) {
  errorMsg.textContent = msg;
  errorMsg.hidden = !msg;
}

function renderResult(english, phonetic) {
  lastEnglish = english;
  resultEnglish.textContent = english;
  resultPhonetic.textContent = phonetic;
  resultCard.hidden = false;
  resultCard.scrollIntoView({ behavior: "smooth", block: "nearest" });
}

function speak(text) {
  if (!("speechSynthesis" in window)) {
    showError("Este navegador no tiene voz incorporada.");
    return;
  }
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = "en-US";
  u.rate = 0.9;
  const voices = window.speechSynthesis.getVoices();
  const us = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en-us"))
    || voices.find((v) => v.lang && v.lang.toLowerCase().startsWith("en"));
  if (us) u.voice = us;
  window.speechSynthesis.speak(u);
}
listenBtn.addEventListener("click", () => speak(lastEnglish));
if ("speechSynthesis" in window) window.speechSynthesis.getVoices();

async function translate() {
  const text = inputText.value.trim();
  if (!text) { showError("Escribe una frase primero."); return; }
  showError("");
  goBtn.disabled = true;
  goBtn.textContent = "Traduciendo…";
  try {
    const res = await fetch("/api/translate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text, source: mode }),
    });
    if (res.status === 401) { window.location.reload(); return; }
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Error del servidor");
    renderResult(data.english, data.phonetic);
    pushHistory({ english: data.english, phonetic: data.phonetic, source: text });
  } catch (e) {
    showError(e.message || "No se pudo traducir. Inténtalo de nuevo.");
  } finally {
    goBtn.disabled = false;
    goBtn.textContent = "Traducir";
  }
}
goBtn.addEventListener("click", translate);

function getHistory() {
  try { return JSON.parse(localStorage.getItem("se_history") || "[]"); }
  catch { return []; }
}
function pushHistory(item) {
  const h = [item, ...getHistory()].slice(0, 20);
  try { localStorage.setItem("se_history", JSON.stringify(h)); } catch {}
  renderHistory();
}
function renderHistory() {
  const h = getHistory();
  historyEl.innerHTML = "";
  if (!h.length) {
    historyEl.innerHTML = '<p class="empty">Tus últimas traducciones aparecerán aquí.</p>';
    return;
  }
  for (const item of h) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "hist-item";
    b.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = item.english;
    const small = document.createElement("small");
    small.textContent = item.phonetic;
    b.appendChild(strong); b.appendChild(small);
    b.addEventListener("click", () => renderResult(item.english, item.phonetic));
    historyEl.appendChild(b);
  }
}

async function loadPacks() {
  try {
    const res = await fetch("/api/phrases");
    if (!res.ok) throw new Error("phrases");
    const data = await res.json();
    packsEl.innerHTML = "";
    for (const pack of data.packs) {
      const div = document.createElement("div");
      div.className = "pack";
      const h = document.createElement("h3");
      h.textContent = pack.title;
      div.appendChild(h);
      for (const p of pack.phrases) {
        const b = document.createElement("button");
        b.type = "button";
        b.className = "phrase";
        b.textContent = p.es;
        b.addEventListener("click", () => {
          renderResult(p.en, p.phonetic);
          pushHistory({ english: p.en, phonetic: p.phonetic, source: p.es });
        });
        div.appendChild(b);
      }
      packsEl.appendChild(div);
    }
  } catch {
    packsEl.innerHTML = '<p class="empty">No se pudieron cargar las frases.</p>';
  }
}

$("logoutBtn").addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  window.location.reload();
});

renderHistory();
loadPacks();
