// Speak Easy worker template.
// Build placeholders "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Speak Easy</title>\n<link rel=\"stylesheet\" href=\"/styles.css\">\n</head>\n<body>\n<header class=\"topbar\">\n  <h1>Speak Easy</h1>\n  <button id=\"logoutBtn\" class=\"ghost\" type=\"button\">Salir</button>\n</header>\n\n<main>\n  <section class=\"card\">\n    <div class=\"modes\" role=\"tablist\" aria-label=\"Modo\">\n      <button id=\"modeEs\" class=\"mode active\" type=\"button\" role=\"tab\" aria-selected=\"true\">Español → English</button>\n      <button id=\"modeEn\" class=\"mode\" type=\"button\" role=\"tab\" aria-selected=\"false\">English → pronunciación</button>\n    </div>\n    <label id=\"inputLabel\" for=\"inputText\">Escribe en español:</label>\n    <textarea id=\"inputText\" rows=\"3\" maxlength=\"400\" placeholder=\"Ej. Necesito ayuda, por favor\"></textarea>\n    <button id=\"goBtn\" class=\"primary\" type=\"button\">Traducir</button>\n    <p id=\"errorMsg\" class=\"error\" hidden></p>\n  </section>\n\n  <section id=\"resultCard\" class=\"card result\" hidden>\n    <p class=\"kicker\">English</p>\n    <p class=\"english\"><span id=\"resultEnglish\"></span>\n      <button id=\"listenBtn\" class=\"listen\" type=\"button\" aria-label=\"Escuchar\">🔊</button>\n    </p>\n    <p class=\"kicker\">Se pronuncia</p>\n    <p id=\"resultPhonetic\" class=\"phonetic\"></p>\n  </section>\n\n  <section class=\"card\">\n    <h2>Frases para practicar</h2>\n    <div id=\"packs\"></div>\n  </section>\n\n  <section class=\"card\">\n    <h2>Recientes</h2>\n    <div id=\"history\" class=\"history\"></div>\n  </section>\n</main>\n\n<script src=\"/app.js\"></script>\n</body>\n</html>\n", "\"use strict\";\n\nconst $ = (id) => document.getElementById(id);\nconst inputText = $(\"inputText\"), inputLabel = $(\"inputLabel\");\nconst modeEs = $(\"modeEs\"), modeEn = $(\"modeEn\");\nconst goBtn = $(\"goBtn\"), errorMsg = $(\"errorMsg\");\nconst resultCard = $(\"resultCard\"), resultEnglish = $(\"resultEnglish\");\nconst resultPhonetic = $(\"resultPhonetic\"), listenBtn = $(\"listenBtn\");\nconst packsEl = $(\"packs\"), historyEl = $(\"history\");\n\nlet mode = \"es\";\nlet lastEnglish = \"\";\n\nfunction setMode(next) {\n  mode = next;\n  const esActive = next === \"es\";\n  modeEs.classList.toggle(\"active\", esActive);\n  modeEn.classList.toggle(\"active\", !esActive);\n  modeEs.setAttribute(\"aria-selected\", String(esActive));\n  modeEn.setAttribute(\"aria-selected\", String(!esActive));\n  inputLabel.textContent = esActive ? \"Escribe en español:\" : \"Write in English:\";\n  inputText.placeholder = esActive\n    ? \"Ej. Necesito ayuda, por favor\"\n    : \"E.g. I need help, please\";\n}\nmodeEs.addEventListener(\"click\", () => setMode(\"es\"));\nmodeEn.addEventListener(\"click\", () => setMode(\"en\"));\n\nfunction showError(msg) {\n  errorMsg.textContent = msg;\n  errorMsg.hidden = !msg;\n}\n\nfunction renderResult(english, phonetic) {\n  lastEnglish = english;\n  resultEnglish.textContent = english;\n  resultPhonetic.textContent = phonetic;\n  resultCard.hidden = false;\n  resultCard.scrollIntoView({ behavior: \"smooth\", block: \"nearest\" });\n}\n\nfunction speak(text) {\n  if (!(\"speechSynthesis\" in window)) {\n    showError(\"Este navegador no tiene voz incorporada.\");\n    return;\n  }\n  window.speechSynthesis.cancel();\n  const u = new SpeechSynthesisUtterance(text);\n  u.lang = \"en-US\";\n  u.rate = 0.9;\n  const voices = window.speechSynthesis.getVoices();\n  const us = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(\"en-us\"))\n    || voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(\"en\"));\n  if (us) u.voice = us;\n  window.speechSynthesis.speak(u);\n}\nlistenBtn.addEventListener(\"click\", () => speak(lastEnglish));\nif (\"speechSynthesis\" in window) window.speechSynthesis.getVoices();\n\nasync function translate() {\n  const text = inputText.value.trim();\n  if (!text) { showError(\"Escribe una frase primero.\"); return; }\n  showError(\"\");\n  goBtn.disabled = true;\n  goBtn.textContent = \"Traduciendo…\";\n  try {\n    const res = await fetch(\"/api/translate\", {\n      method: \"POST\",\n      headers: { \"Content-Type\": \"application/json\" },\n      body: JSON.stringify({ text, source: mode }),\n    });\n    if (res.status === 401) { window.location.reload(); return; }\n    const data = await res.json();\n    if (!res.ok) throw new Error(data.error || \"Error del servidor\");\n    renderResult(data.english, data.phonetic);\n    pushHistory({ english: data.english, phonetic: data.phonetic, source: text });\n  } catch (e) {\n    showError(e.message || \"No se pudo traducir. Inténtalo de nuevo.\");\n  } finally {\n    goBtn.disabled = false;\n    goBtn.textContent = \"Traducir\";\n  }\n}\ngoBtn.addEventListener(\"click\", translate);\n\nfunction getHistory() {\n  try { return JSON.parse(localStorage.getItem(\"se_history\") || \"[]\"); }\n  catch { return []; }\n}\nfunction pushHistory(item) {\n  const h = [item, ...getHistory()].slice(0, 20);\n  try { localStorage.setItem(\"se_history\", JSON.stringify(h)); } catch {}\n  renderHistory();\n}\nfunction renderHistory() {\n  const h = getHistory();\n  historyEl.innerHTML = \"\";\n  if (!h.length) {\n    historyEl.innerHTML = '<p class=\"empty\">Tus últimas traducciones aparecerán aquí.</p>';\n    return;\n  }\n  for (const item of h) {\n    const b = document.createElement(\"button\");\n    b.type = \"button\";\n    b.className = \"hist-item\";\n    b.innerHTML = \"\";\n    const strong = document.createElement(\"strong\");\n    strong.textContent = item.english;\n    const small = document.createElement(\"small\");\n    small.textContent = item.phonetic;\n    b.appendChild(strong); b.appendChild(small);\n    b.addEventListener(\"click\", () => renderResult(item.english, item.phonetic));\n    historyEl.appendChild(b);\n  }\n}\n\nasync function loadPacks() {\n  try {\n    const res = await fetch(\"/api/phrases\");\n    if (!res.ok) throw new Error(\"phrases\");\n    const data = await res.json();\n    packsEl.innerHTML = \"\";\n    for (const pack of data.packs) {\n      const div = document.createElement(\"div\");\n      div.className = \"pack\";\n      const h = document.createElement(\"h3\");\n      h.textContent = pack.title;\n      div.appendChild(h);\n      for (const p of pack.phrases) {\n        const b = document.createElement(\"button\");\n        b.type = \"button\";\n        b.className = \"phrase\";\n        b.textContent = p.es;\n        b.addEventListener(\"click\", () => {\n          renderResult(p.en, p.phonetic);\n          pushHistory({ english: p.en, phonetic: p.phonetic, source: p.es });\n        });\n        div.appendChild(b);\n      }\n      packsEl.appendChild(div);\n    }\n  } catch {\n    packsEl.innerHTML = '<p class=\"empty\">No se pudieron cargar las frases.</p>';\n  }\n}\n\n$(\"logoutBtn\").addEventListener(\"click\", async () => {\n  await fetch(\"/api/logout\", { method: \"POST\" });\n  window.location.reload();\n});\n\nrenderHistory();\nloadPacks();\n", ":root {\n  --bg: #f7f4ee;\n  --card: #ffffff;\n  --ink: #2b2620;\n  --muted: #7a7166;\n  --accent: #1d7a4f;\n  --accent-dark: #145c3b;\n  --line: #e7e0d3;\n}\n* { box-sizing: border-box; }\nbody {\n  margin: 0;\n  font-family: -apple-system, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif;\n  background: var(--bg);\n  color: var(--ink);\n  line-height: 1.5;\n}\n.topbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 0.9rem 1.1rem;\n  background: var(--accent);\n  color: #fff;\n  position: sticky;\n  top: 0;\n}\n.topbar h1 { margin: 0; font-size: 1.25rem; }\nmain { max-width: 640px; margin: 0 auto; padding: 1rem; }\n.card {\n  background: var(--card);\n  border: 1px solid var(--line);\n  border-radius: 14px;\n  padding: 1.1rem;\n  margin-bottom: 1rem;\n}\n.card h2 { margin: 0 0 0.6rem; font-size: 1.05rem; }\n.modes { display: flex; gap: 0.5rem; margin-bottom: 0.8rem; }\n.mode {\n  flex: 1;\n  padding: 0.65rem 0.4rem;\n  border: 2px solid var(--line);\n  border-radius: 10px;\n  background: #fff;\n  font-size: 0.95rem;\n  cursor: pointer;\n}\n.mode.active { border-color: var(--accent); color: var(--accent-dark); font-weight: 700; }\nlabel { display: block; margin-bottom: 0.4rem; font-weight: 600; }\ntextarea {\n  width: 100%;\n  font-size: 1.05rem;\n  padding: 0.7rem;\n  border: 2px solid var(--line);\n  border-radius: 10px;\n  resize: vertical;\n}\ntextarea:focus { outline: none; border-color: var(--accent); }\nbutton.primary {\n  margin-top: 0.7rem;\n  width: 100%;\n  padding: 0.85rem;\n  font-size: 1.05rem;\n  font-weight: 700;\n  color: #fff;\n  background: var(--accent);\n  border: none;\n  border-radius: 10px;\n  cursor: pointer;\n}\nbutton.primary:disabled { opacity: 0.55; cursor: wait; }\nbutton.ghost {\n  background: transparent;\n  border: 1px solid rgba(255,255,255,0.7);\n  color: #fff;\n  border-radius: 8px;\n  padding: 0.35rem 0.8rem;\n  cursor: pointer;\n}\n.error { color: #b3261e; font-weight: 600; }\n.result .kicker {\n  margin: 0.6rem 0 0.15rem;\n  text-transform: uppercase;\n  font-size: 0.75rem;\n  letter-spacing: 0.06em;\n  color: var(--muted);\n}\n.english { font-size: 1.25rem; font-weight: 600; margin: 0; }\n.listen {\n  font-size: 1.3rem;\n  background: #eef6f1;\n  border: 1px solid var(--line);\n  border-radius: 50%;\n  width: 2.6rem;\n  height: 2.6rem;\n  cursor: pointer;\n  vertical-align: middle;\n  margin-left: 0.4rem;\n}\n.phonetic {\n  font-size: 1.6rem;\n  font-weight: 700;\n  color: var(--accent-dark);\n  margin: 0;\n}\n.pack { margin-bottom: 0.8rem; }\n.pack > h3 { margin: 0.4rem 0; font-size: 0.95rem; color: var(--muted); }\n.phrase {\n  display: block;\n  width: 100%;\n  text-align: left;\n  background: #fbf9f5;\n  border: 1px solid var(--line);\n  border-radius: 10px;\n  padding: 0.6rem 0.7rem;\n  margin-bottom: 0.45rem;\n  font-size: 0.98rem;\n  cursor: pointer;\n}\n.phrase:active { background: #f1ece1; }\n.history { display: flex; flex-direction: column; gap: 0.45rem; }\n.hist-item {\n  border: 1px solid var(--line);\n  border-radius: 10px;\n  padding: 0.55rem 0.7rem;\n  background: #fbf9f5;\n  cursor: pointer;\n  font-size: 0.95rem;\n}\n.hist-item small { color: var(--muted); display: block; }\n.empty { color: var(--muted); font-size: 0.95rem; }\n", "{\"packs\":[{\"id\":\"caregiving\",\"phrases\":[{\"en\":\"I am here to help you.\",\"es\":\"Estoy aquí para ayudarte.\",\"phonetic\":\"Ai am jir tu jelp iu.\"},{\"en\":\"Are you feeling okay?\",\"es\":\"¿Te sientes bien?\",\"phonetic\":\"Ar iu filing oukei?\"},{\"en\":\"Do you need anything?\",\"es\":\"¿Necesitas algo?\",\"phonetic\":\"Du iu nid enizing?\"},{\"en\":\"Let me help you stand up.\",\"es\":\"Déjame ayudarte a levantarte.\",\"phonetic\":\"Let mi jelp iu stand ap.\"},{\"en\":\"It is time for your medicine.\",\"es\":\"Es hora de tu medicina.\",\"phonetic\":\"It is taim for ior medesin.\"},{\"en\":\"Can you hear me well?\",\"es\":\"¿Me escuchas bien?\",\"phonetic\":\"Can iu jir mi uel?\"},{\"en\":\"I will be right back.\",\"es\":\"Vuelvo enseguida.\",\"phonetic\":\"Ai uil bi rait bak.\"},{\"en\":\"Please call me if you need help.\",\"es\":\"Llámame si necesitas ayuda, por favor.\",\"phonetic\":\"Plis col mi if iu nid jelp.\"},{\"en\":\"Let's go for a short walk.\",\"es\":\"Vamos a dar un paseo corto.\",\"phonetic\":\"Lets go for a short uok.\"},{\"en\":\"Your family will visit soon.\",\"es\":\"Tu familia vendrá pronto.\",\"phonetic\":\"Ior femili uil visit sun.\"}],\"title\":\"Cuidado de personas\"},{\"id\":\"daily\",\"phrases\":[{\"en\":\"My name is Blanca.\",\"es\":\"Me llamo Blanca.\",\"phonetic\":\"Mai neim is Blanca.\"},{\"en\":\"I don't speak English very well.\",\"es\":\"No hablo muy bien inglés.\",\"phonetic\":\"Ai dont spik inglish veri uel.\"},{\"en\":\"Can you speak more slowly, please?\",\"es\":\"¿Puedes hablar más despacio, por favor?\",\"phonetic\":\"Can iu spik mor slouli, plis?\"},{\"en\":\"How much does it cost?\",\"es\":\"¿Cuánto cuesta?\",\"phonetic\":\"Jau mach das it cost?\"},{\"en\":\"Where is the bathroom?\",\"es\":\"¿Dónde está el baño?\",\"phonetic\":\"Juer is de bazrum?\"},{\"en\":\"Thank you very much.\",\"es\":\"Muchas gracias.\",\"phonetic\":\"Zank iu veri mach.\"},{\"en\":\"I need help, please.\",\"es\":\"Necesito ayuda, por favor.\",\"phonetic\":\"Ai nid jelp, plis.\"},{\"en\":\"See you tomorrow.\",\"es\":\"Nos vemos mañana.\",\"phonetic\":\"Si iu tumorou.\"}],\"title\":\"Todos los días\"},{\"id\":\"emergency\",\"phrases\":[{\"en\":\"Call 911, please!\",\"es\":\"¡Llama al 911, por favor!\",\"phonetic\":\"Col nain uan uan, plis!\"},{\"en\":\"I need a doctor.\",\"es\":\"Necesito un doctor.\",\"phonetic\":\"Ai nid a dactor.\"},{\"en\":\"This is an emergency.\",\"es\":\"Esto es una emergencia.\",\"phonetic\":\"Dis is an emerjensi.\"},{\"en\":\"Please help me.\",\"es\":\"Ayúdame, por favor.\",\"phonetic\":\"Plis jelp mi.\"}],\"title\":\"Emergencias\"}]}"
// are replaced by scripts/build.js with JSON-stringified file contents.
// Runtime bindings: env.AI (Workers AI), env.APP_PASSWORD (secret).

const APP_HTML = "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n<meta charset=\"utf-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1\">\n<title>Speak Easy</title>\n<link rel=\"stylesheet\" href=\"/styles.css\">\n</head>\n<body>\n<header class=\"topbar\">\n  <h1>Speak Easy</h1>\n  <button id=\"logoutBtn\" class=\"ghost\" type=\"button\">Salir</button>\n</header>\n\n<main>\n  <section class=\"card\">\n    <div class=\"modes\" role=\"tablist\" aria-label=\"Modo\">\n      <button id=\"modeEs\" class=\"mode active\" type=\"button\" role=\"tab\" aria-selected=\"true\">Español → English</button>\n      <button id=\"modeEn\" class=\"mode\" type=\"button\" role=\"tab\" aria-selected=\"false\">English → pronunciación</button>\n    </div>\n    <label id=\"inputLabel\" for=\"inputText\">Escribe en español:</label>\n    <textarea id=\"inputText\" rows=\"3\" maxlength=\"400\" placeholder=\"Ej. Necesito ayuda, por favor\"></textarea>\n    <button id=\"goBtn\" class=\"primary\" type=\"button\">Traducir</button>\n    <p id=\"errorMsg\" class=\"error\" hidden></p>\n  </section>\n\n  <section id=\"resultCard\" class=\"card result\" hidden>\n    <p class=\"kicker\">English</p>\n    <p class=\"english\"><span id=\"resultEnglish\"></span>\n      <button id=\"listenBtn\" class=\"listen\" type=\"button\" aria-label=\"Escuchar\">🔊</button>\n    </p>\n    <p class=\"kicker\">Se pronuncia</p>\n    <p id=\"resultPhonetic\" class=\"phonetic\"></p>\n  </section>\n\n  <section class=\"card\">\n    <h2>Frases para practicar</h2>\n    <div id=\"packs\"></div>\n  </section>\n\n  <section class=\"card\">\n    <h2>Recientes</h2>\n    <div id=\"history\" class=\"history\"></div>\n  </section>\n</main>\n\n<script src=\"/app.js\"></script>\n</body>\n</html>\n";
const APP_JS = "\"use strict\";\n\nconst $ = (id) => document.getElementById(id);\nconst inputText = $(\"inputText\"), inputLabel = $(\"inputLabel\");\nconst modeEs = $(\"modeEs\"), modeEn = $(\"modeEn\");\nconst goBtn = $(\"goBtn\"), errorMsg = $(\"errorMsg\");\nconst resultCard = $(\"resultCard\"), resultEnglish = $(\"resultEnglish\");\nconst resultPhonetic = $(\"resultPhonetic\"), listenBtn = $(\"listenBtn\");\nconst packsEl = $(\"packs\"), historyEl = $(\"history\");\n\nlet mode = \"es\";\nlet lastEnglish = \"\";\n\nfunction setMode(next) {\n  mode = next;\n  const esActive = next === \"es\";\n  modeEs.classList.toggle(\"active\", esActive);\n  modeEn.classList.toggle(\"active\", !esActive);\n  modeEs.setAttribute(\"aria-selected\", String(esActive));\n  modeEn.setAttribute(\"aria-selected\", String(!esActive));\n  inputLabel.textContent = esActive ? \"Escribe en español:\" : \"Write in English:\";\n  inputText.placeholder = esActive\n    ? \"Ej. Necesito ayuda, por favor\"\n    : \"E.g. I need help, please\";\n}\nmodeEs.addEventListener(\"click\", () => setMode(\"es\"));\nmodeEn.addEventListener(\"click\", () => setMode(\"en\"));\n\nfunction showError(msg) {\n  errorMsg.textContent = msg;\n  errorMsg.hidden = !msg;\n}\n\nfunction renderResult(english, phonetic) {\n  lastEnglish = english;\n  resultEnglish.textContent = english;\n  resultPhonetic.textContent = phonetic;\n  resultCard.hidden = false;\n  resultCard.scrollIntoView({ behavior: \"smooth\", block: \"nearest\" });\n}\n\nfunction speak(text) {\n  if (!(\"speechSynthesis\" in window)) {\n    showError(\"Este navegador no tiene voz incorporada.\");\n    return;\n  }\n  window.speechSynthesis.cancel();\n  const u = new SpeechSynthesisUtterance(text);\n  u.lang = \"en-US\";\n  u.rate = 0.9;\n  const voices = window.speechSynthesis.getVoices();\n  const us = voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(\"en-us\"))\n    || voices.find((v) => v.lang && v.lang.toLowerCase().startsWith(\"en\"));\n  if (us) u.voice = us;\n  window.speechSynthesis.speak(u);\n}\nlistenBtn.addEventListener(\"click\", () => speak(lastEnglish));\nif (\"speechSynthesis\" in window) window.speechSynthesis.getVoices();\n\nasync function translate() {\n  const text = inputText.value.trim();\n  if (!text) { showError(\"Escribe una frase primero.\"); return; }\n  showError(\"\");\n  goBtn.disabled = true;\n  goBtn.textContent = \"Traduciendo…\";\n  try {\n    const res = await fetch(\"/api/translate\", {\n      method: \"POST\",\n      headers: { \"Content-Type\": \"application/json\" },\n      body: JSON.stringify({ text, source: mode }),\n    });\n    if (res.status === 401) { window.location.reload(); return; }\n    const data = await res.json();\n    if (!res.ok) throw new Error(data.error || \"Error del servidor\");\n    renderResult(data.english, data.phonetic);\n    pushHistory({ english: data.english, phonetic: data.phonetic, source: text });\n  } catch (e) {\n    showError(e.message || \"No se pudo traducir. Inténtalo de nuevo.\");\n  } finally {\n    goBtn.disabled = false;\n    goBtn.textContent = \"Traducir\";\n  }\n}\ngoBtn.addEventListener(\"click\", translate);\n\nfunction getHistory() {\n  try { return JSON.parse(localStorage.getItem(\"se_history\") || \"[]\"); }\n  catch { return []; }\n}\nfunction pushHistory(item) {\n  const h = [item, ...getHistory()].slice(0, 20);\n  try { localStorage.setItem(\"se_history\", JSON.stringify(h)); } catch {}\n  renderHistory();\n}\nfunction renderHistory() {\n  const h = getHistory();\n  historyEl.innerHTML = \"\";\n  if (!h.length) {\n    historyEl.innerHTML = '<p class=\"empty\">Tus últimas traducciones aparecerán aquí.</p>';\n    return;\n  }\n  for (const item of h) {\n    const b = document.createElement(\"button\");\n    b.type = \"button\";\n    b.className = \"hist-item\";\n    b.innerHTML = \"\";\n    const strong = document.createElement(\"strong\");\n    strong.textContent = item.english;\n    const small = document.createElement(\"small\");\n    small.textContent = item.phonetic;\n    b.appendChild(strong); b.appendChild(small);\n    b.addEventListener(\"click\", () => renderResult(item.english, item.phonetic));\n    historyEl.appendChild(b);\n  }\n}\n\nasync function loadPacks() {\n  try {\n    const res = await fetch(\"/api/phrases\");\n    if (!res.ok) throw new Error(\"phrases\");\n    const data = await res.json();\n    packsEl.innerHTML = \"\";\n    for (const pack of data.packs) {\n      const div = document.createElement(\"div\");\n      div.className = \"pack\";\n      const h = document.createElement(\"h3\");\n      h.textContent = pack.title;\n      div.appendChild(h);\n      for (const p of pack.phrases) {\n        const b = document.createElement(\"button\");\n        b.type = \"button\";\n        b.className = \"phrase\";\n        b.textContent = p.es;\n        b.addEventListener(\"click\", () => {\n          renderResult(p.en, p.phonetic);\n          pushHistory({ english: p.en, phonetic: p.phonetic, source: p.es });\n        });\n        div.appendChild(b);\n      }\n      packsEl.appendChild(div);\n    }\n  } catch {\n    packsEl.innerHTML = '<p class=\"empty\">No se pudieron cargar las frases.</p>';\n  }\n}\n\n$(\"logoutBtn\").addEventListener(\"click\", async () => {\n  await fetch(\"/api/logout\", { method: \"POST\" });\n  window.location.reload();\n});\n\nrenderHistory();\nloadPacks();\n";
const APP_CSS = ":root {\n  --bg: #f7f4ee;\n  --card: #ffffff;\n  --ink: #2b2620;\n  --muted: #7a7166;\n  --accent: #1d7a4f;\n  --accent-dark: #145c3b;\n  --line: #e7e0d3;\n}\n* { box-sizing: border-box; }\nbody {\n  margin: 0;\n  font-family: -apple-system, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif;\n  background: var(--bg);\n  color: var(--ink);\n  line-height: 1.5;\n}\n.topbar {\n  display: flex;\n  align-items: center;\n  justify-content: space-between;\n  padding: 0.9rem 1.1rem;\n  background: var(--accent);\n  color: #fff;\n  position: sticky;\n  top: 0;\n}\n.topbar h1 { margin: 0; font-size: 1.25rem; }\nmain { max-width: 640px; margin: 0 auto; padding: 1rem; }\n.card {\n  background: var(--card);\n  border: 1px solid var(--line);\n  border-radius: 14px;\n  padding: 1.1rem;\n  margin-bottom: 1rem;\n}\n.card h2 { margin: 0 0 0.6rem; font-size: 1.05rem; }\n.modes { display: flex; gap: 0.5rem; margin-bottom: 0.8rem; }\n.mode {\n  flex: 1;\n  padding: 0.65rem 0.4rem;\n  border: 2px solid var(--line);\n  border-radius: 10px;\n  background: #fff;\n  font-size: 0.95rem;\n  cursor: pointer;\n}\n.mode.active { border-color: var(--accent); color: var(--accent-dark); font-weight: 700; }\nlabel { display: block; margin-bottom: 0.4rem; font-weight: 600; }\ntextarea {\n  width: 100%;\n  font-size: 1.05rem;\n  padding: 0.7rem;\n  border: 2px solid var(--line);\n  border-radius: 10px;\n  resize: vertical;\n}\ntextarea:focus { outline: none; border-color: var(--accent); }\nbutton.primary {\n  margin-top: 0.7rem;\n  width: 100%;\n  padding: 0.85rem;\n  font-size: 1.05rem;\n  font-weight: 700;\n  color: #fff;\n  background: var(--accent);\n  border: none;\n  border-radius: 10px;\n  cursor: pointer;\n}\nbutton.primary:disabled { opacity: 0.55; cursor: wait; }\nbutton.ghost {\n  background: transparent;\n  border: 1px solid rgba(255,255,255,0.7);\n  color: #fff;\n  border-radius: 8px;\n  padding: 0.35rem 0.8rem;\n  cursor: pointer;\n}\n.error { color: #b3261e; font-weight: 600; }\n.result .kicker {\n  margin: 0.6rem 0 0.15rem;\n  text-transform: uppercase;\n  font-size: 0.75rem;\n  letter-spacing: 0.06em;\n  color: var(--muted);\n}\n.english { font-size: 1.25rem; font-weight: 600; margin: 0; }\n.listen {\n  font-size: 1.3rem;\n  background: #eef6f1;\n  border: 1px solid var(--line);\n  border-radius: 50%;\n  width: 2.6rem;\n  height: 2.6rem;\n  cursor: pointer;\n  vertical-align: middle;\n  margin-left: 0.4rem;\n}\n.phonetic {\n  font-size: 1.6rem;\n  font-weight: 700;\n  color: var(--accent-dark);\n  margin: 0;\n}\n.pack { margin-bottom: 0.8rem; }\n.pack > h3 { margin: 0.4rem 0; font-size: 0.95rem; color: var(--muted); }\n.phrase {\n  display: block;\n  width: 100%;\n  text-align: left;\n  background: #fbf9f5;\n  border: 1px solid var(--line);\n  border-radius: 10px;\n  padding: 0.6rem 0.7rem;\n  margin-bottom: 0.45rem;\n  font-size: 0.98rem;\n  cursor: pointer;\n}\n.phrase:active { background: #f1ece1; }\n.history { display: flex; flex-direction: column; gap: 0.45rem; }\n.hist-item {\n  border: 1px solid var(--line);\n  border-radius: 10px;\n  padding: 0.55rem 0.7rem;\n  background: #fbf9f5;\n  cursor: pointer;\n  font-size: 0.95rem;\n}\n.hist-item small { color: var(--muted); display: block; }\n.empty { color: var(--muted); font-size: 0.95rem; }\n";
const PHRASES_JSON = "{\"packs\":[{\"id\":\"caregiving\",\"phrases\":[{\"en\":\"I am here to help you.\",\"es\":\"Estoy aquí para ayudarte.\",\"phonetic\":\"Ai am jir tu jelp iu.\"},{\"en\":\"Are you feeling okay?\",\"es\":\"¿Te sientes bien?\",\"phonetic\":\"Ar iu filing oukei?\"},{\"en\":\"Do you need anything?\",\"es\":\"¿Necesitas algo?\",\"phonetic\":\"Du iu nid enizing?\"},{\"en\":\"Let me help you stand up.\",\"es\":\"Déjame ayudarte a levantarte.\",\"phonetic\":\"Let mi jelp iu stand ap.\"},{\"en\":\"It is time for your medicine.\",\"es\":\"Es hora de tu medicina.\",\"phonetic\":\"It is taim for ior medesin.\"},{\"en\":\"Can you hear me well?\",\"es\":\"¿Me escuchas bien?\",\"phonetic\":\"Can iu jir mi uel?\"},{\"en\":\"I will be right back.\",\"es\":\"Vuelvo enseguida.\",\"phonetic\":\"Ai uil bi rait bak.\"},{\"en\":\"Please call me if you need help.\",\"es\":\"Llámame si necesitas ayuda, por favor.\",\"phonetic\":\"Plis col mi if iu nid jelp.\"},{\"en\":\"Let's go for a short walk.\",\"es\":\"Vamos a dar un paseo corto.\",\"phonetic\":\"Lets go for a short uok.\"},{\"en\":\"Your family will visit soon.\",\"es\":\"Tu familia vendrá pronto.\",\"phonetic\":\"Ior femili uil visit sun.\"}],\"title\":\"Cuidado de personas\"},{\"id\":\"daily\",\"phrases\":[{\"en\":\"My name is Blanca.\",\"es\":\"Me llamo Blanca.\",\"phonetic\":\"Mai neim is Blanca.\"},{\"en\":\"I don't speak English very well.\",\"es\":\"No hablo muy bien inglés.\",\"phonetic\":\"Ai dont spik inglish veri uel.\"},{\"en\":\"Can you speak more slowly, please?\",\"es\":\"¿Puedes hablar más despacio, por favor?\",\"phonetic\":\"Can iu spik mor slouli, plis?\"},{\"en\":\"How much does it cost?\",\"es\":\"¿Cuánto cuesta?\",\"phonetic\":\"Jau mach das it cost?\"},{\"en\":\"Where is the bathroom?\",\"es\":\"¿Dónde está el baño?\",\"phonetic\":\"Juer is de bazrum?\"},{\"en\":\"Thank you very much.\",\"es\":\"Muchas gracias.\",\"phonetic\":\"Zank iu veri mach.\"},{\"en\":\"I need help, please.\",\"es\":\"Necesito ayuda, por favor.\",\"phonetic\":\"Ai nid jelp, plis.\"},{\"en\":\"See you tomorrow.\",\"es\":\"Nos vemos mañana.\",\"phonetic\":\"Si iu tumorou.\"}],\"title\":\"Todos los días\"},{\"id\":\"emergency\",\"phrases\":[{\"en\":\"Call 911, please!\",\"es\":\"¡Llama al 911, por favor!\",\"phonetic\":\"Col nain uan uan, plis!\"},{\"en\":\"I need a doctor.\",\"es\":\"Necesito un doctor.\",\"phonetic\":\"Ai nid a dactor.\"},{\"en\":\"This is an emergency.\",\"es\":\"Esto es una emergencia.\",\"phonetic\":\"Dis is an emerjensi.\"},{\"en\":\"Please help me.\",\"es\":\"Ayúdame, por favor.\",\"phonetic\":\"Plis jelp mi.\"}],\"title\":\"Emergencias\"}]}";

const LOGIN_HTML = [
  '<!DOCTYPE html><html lang="es"><head><meta charset="utf-8">',
  '<meta name="viewport" content="width=device-width, initial-scale=1">',
  '<title>Speak Easy - Entrar</title>',
  '<style>body{font-family:-apple-system,"Segoe UI",Roboto,Arial,sans-serif;background:#f7f4ee;margin:0;display:flex;min-height:100vh;align-items:center;justify-content:center}',
  '.box{background:#fff;border:1px solid #e7e0d3;border-radius:14px;padding:2rem;width:min(92vw,380px);text-align:center}',
  'h1{color:#1d7a4f;margin:0 0 .4rem}p{color:#7a7166}',
  'input{width:100%;font-size:1.1rem;padding:.7rem;border:2px solid #e7e0d3;border-radius:10px;margin:.6rem 0}',
  'button{width:100%;padding:.85rem;font-size:1.05rem;font-weight:700;color:#fff;background:#1d7a4f;border:none;border-radius:10px;cursor:pointer}',
  '.err{color:#b3261e;font-weight:600;min-height:1.4em}</style></head>',
  '<body><div class="box"><h1>Speak Easy</h1>',
  '<p>Escribe la contraseña para entrar.</p>',
  '<p class="err" id="e"></p>',
  '<input type="password" id="p" placeholder="Contraseña" autocomplete="current-password">',
  '<button id="b">Entrar</button></div>',
  '<script>',
  'document.getElementById("b").onclick=async()=>{',
  'const pw=document.getElementById("p").value;',
  'const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({password:pw})});',
  'if(r.ok){location.reload()}else{document.getElementById("e").textContent="Contraseña incorrecta."}};',
  'document.getElementById("p").addEventListener("keydown",e=>{if(e.key==="Enter")document.getElementById("b").click()});',
  '</scr' + 'ipt></body></html>',
].join("");

const SESSION_COOKIE = "se_sess";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

function getCookie(request, name) {
  const header = request.headers.get("Cookie") || "";
  for (const part of header.split(";")) {
    const idx = part.indexOf("=");
    if (idx === -1) continue;
    if (part.slice(0, idx).trim() === name) return part.slice(idx + 1).trim();
  }
  return null;
}

async function hmacHex(key, message) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" }, false, ["sign"]
  );
  const sig = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(message));
  return [...new Uint8Array(sig)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

async function makeSession(password) {
  const exp = String(Date.now() + SESSION_TTL_MS);
  const sig = await hmacHex(password, "speak-easy|" + exp);
  return exp + "." + sig;
}

async function isAuthed(request, env) {
  if (!env.APP_PASSWORD) return false;
  const cookie = getCookie(request, SESSION_COOKIE);
  if (!cookie) return false;
  const dot = cookie.indexOf(".");
  if (dot === -1) return false;
  const exp = cookie.slice(0, dot), sig = cookie.slice(dot + 1);
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return false;
  const expected = await hmacHex(env.APP_PASSWORD, "speak-easy|" + exp);
  return timingSafeEqual(sig, expected);
}

function jsonResponse(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

const SYSTEM_PROMPT = [
  "You are a pronunciation coach helping a native Spanish speaker speak English.",
  "Reply with ONLY a JSON object, no other text:",
  '{"english": "<the phrase in natural US English>", "phonetic": "<how it sounds, spelled for a Spanish reader>"}',
  "Rules:",
  "- If the input is Spanish, translate it to natural US English for \"english\".",
  "- If the input is already English, fix only clear mistakes and keep it in \"english\".",
  "- \"phonetic\" rewrites the English so a Spanish speaker reading it aloud sounds close to native English. Use Spanish spelling habits:",
  '  "My name is Eduardo" -> "Mai neim is Eduardo"',
  '  "I need help" -> "Ai nid jelp"',
  '  "Thank you very much" -> "Zank iu veri mach"',
  '  "Where is the bathroom?" -> "Juer is de bazrum?"',
  '  "I don\'t speak English very well" -> "Ai dont spik inglish veri uel"',
  '  "Can you speak more slowly, please?" -> "Can iu spik mor slouli, plis?"',
  "- Write \"th\" as \"z\" at the start of words like thank, think (\"zank\", \"zink\"), as \"d\" in the, this, that (\"de\", \"dis\", \"dat\").",
  "- Keep proper names unchanged. Keep punctuation. Never add explanations.",
].join("\n");

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) throw new Error("no-json");
  return JSON.parse(text.slice(start, end + 1));
}

function aiResponseText(ai) {
  if (!ai) return "";
  if (typeof ai.response === "string" && ai.response.trim()) return ai.response;
  const choice = ai.choices && ai.choices[0];
  const content = choice && choice.message && choice.message.content;
  if (typeof content === "string" && content.trim()) return content;
  if (choice && typeof choice.text === "string") return choice.text;
  return "";
}

async function handleTranslate(request, env) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Petición inválida." }, 400);
  }
  const text = typeof body.text === "string" ? body.text.trim() : "";
  const source = body.source === "en" ? "en" : "es";
  if (!text || text.length > 400) {
    return jsonResponse({ error: "Escribe una frase de hasta 400 caracteres." }, 400);
  }
  let aiText;
  try {
    const ai = await env.AI.run("@cf/meta/infire-llama-3.1-8b-instruct", {
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: "Input (" + (source === "es" ? "Spanish" : "English") + "): " + text },
      ],
      max_tokens: 300,
      temperature: 0.3,
    });
    aiText = aiResponseText(ai);
  } catch (e) {
    return jsonResponse({ error: "El servicio de traducción no responde. Inténtalo de nuevo." }, 502);
  }
  let parsed;
  try {
    parsed = extractJson(aiText);
  } catch {
    return jsonResponse({ error: "No se pudo interpretar la respuesta. Inténtalo de nuevo." }, 502);
  }
  if (typeof parsed.english !== "string" || typeof parsed.phonetic !== "string" ||
      !parsed.english.trim() || !parsed.phonetic.trim()) {
    return jsonResponse({ error: "Respuesta incompleta. Inténtalo de nuevo." }, 502);
  }
  return jsonResponse({ english: parsed.english.trim(), phonetic: parsed.phonetic.trim() });
}

async function handleLogin(request, env) {
  if (!env.APP_PASSWORD) {
    return jsonResponse({ error: "Login no configurado en el servidor." }, 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Petición inválida." }, 400);
  }
  const password = typeof body.password === "string" ? body.password : "";
  if (!timingSafeEqual(password, env.APP_PASSWORD)) {
    return jsonResponse({ error: "Contraseña incorrecta." }, 401);
  }
  const session = await makeSession(env.APP_PASSWORD);
  const headers = {
    "Set-Cookie":
      SESSION_COOKIE + "=" + session +
      "; Path=/; Max-Age=" + Math.floor(SESSION_TTL_MS / 1000) +
      "; HttpOnly; Secure; SameSite=Lax",
  };
  return jsonResponse({ ok: true }, 200, headers);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/login" && request.method === "POST") {
      return handleLogin(request, env);
    }
    if (path === "/api/logout" && request.method === "POST") {
      return jsonResponse({ ok: true }, 200, {
        "Set-Cookie": SESSION_COOKIE + "=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax",
      });
    }

    const authed = await isAuthed(request, env);
    if (!authed) {
      if (path === "/" || path === "/index.html") {
        return new Response(LOGIN_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
      }
      return jsonResponse({ error: "No autorizado." }, 401);
    }

    if (path === "/" || path === "/index.html") {
      return new Response(APP_HTML, { headers: { "Content-Type": "text/html; charset=utf-8" } });
    }
    if (path === "/app.js") {
      return new Response(APP_JS, { headers: { "Content-Type": "application/javascript; charset=utf-8" } });
    }
    if (path === "/styles.css") {
      return new Response(APP_CSS, { headers: { "Content-Type": "text/css; charset=utf-8" } });
    }
    if (path === "/api/phrases") {
      return new Response(PHRASES_JSON, { headers: { "Content-Type": "application/json; charset=utf-8" } });
    }
    if (path === "/api/translate" && request.method === "POST") {
      return handleTranslate(request, env);
    }
    return new Response("Not found", { status: 404 });
  },
};
