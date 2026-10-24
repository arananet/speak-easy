// Speak Easy worker template.
// Build placeholders __APP_HTML__, __APP_JS__, __APP_CSS__, __PHRASES_JSON__
// are replaced by scripts/build.js with JSON-stringified file contents.
// Runtime bindings: env.AI (Workers AI), env.BLANQUITA_PASSWORD and
// env.EDUARDO_PASSWORD (per-user login secrets), env.APP_PASSWORD
// (legacy shared password, temporary login fallback only, see below).

const APP_HTML = __APP_HTML__;
const APP_JS = __APP_JS__;
const APP_CSS = __APP_CSS__;
const PHRASES_JSON = __PHRASES_JSON__;

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
  '<p>Escribe tu usuario y tu contraseña para entrar.</p>',
  '<p class="err" id="e"></p>',
  '<input type="text" id="u" placeholder="Usuario" autocomplete="username" autocapitalize="none" spellcheck="false">',
  '<input type="password" id="p" placeholder="Contraseña" autocomplete="current-password">',
  '<button id="b">Entrar</button></div>',
  '<script>',
  'const go=async()=>{',
  'const u=document.getElementById("u").value.trim();',
  'const pw=document.getElementById("p").value;',
  'const r=await fetch("/api/login",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({username:u,password:pw})});',
  'if(r.ok){location.reload()}else{document.getElementById("e").textContent="Usuario o contraseña incorrectos."}};',
  'document.getElementById("b").onclick=go;',
  'for(const id of ["u","p"])document.getElementById(id).addEventListener("keydown",e=>{if(e.key==="Enter")go()});',
  '</scr' + 'ipt></body></html>',
].join("");

const SESSION_COOKIE = "se_sess";
const SESSION_TTL_MS = 30 * 24 * 3600 * 1000;

// Named user logins. Each user's password lives ONLY in the secret
// binding listed here; no password value ever appears in this repo.
const USER_SECRET_BINDINGS = {
  blanquita: "BLANQUITA_PASSWORD",
  eduardo: "EDUARDO_PASSWORD",
};

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

function userSecret(env, username) {
  const binding = USER_SECRET_BINDINGS[username];
  if (!binding) return null;
  const value = env[binding];
  return typeof value === "string" && value.length > 0 ? value : null;
}

function allUserSecretsSet(env) {
  return Object.keys(USER_SECRET_BINDINGS).every((u) => userSecret(env, u) !== null);
}

function anyPasswordConfigured(env) {
  if (typeof env.APP_PASSWORD === "string" && env.APP_PASSWORD.length > 0) return true;
  return Object.keys(USER_SECRET_BINDINGS).some((u) => userSecret(env, u) !== null);
}

// Transition fallback (temporary): until BOTH per-user secrets exist,
// the legacy shared APP_PASSWORD is still accepted for either user, so
// nobody gets locked out while the new secrets are being set. As soon
// as BLANQUITA_PASSWORD and EDUARDO_PASSWORD are both set, APP_PASSWORD
// stops being accepted and Edu can delete that binding in the dashboard.
function passwordAccepted(env, username, password) {
  const own = userSecret(env, username);
  if (own !== null && timingSafeEqual(password, own)) return true;
  if (!allUserSecretsSet(env) &&
      typeof env.APP_PASSWORD === "string" && env.APP_PASSWORD.length > 0 &&
      timingSafeEqual(password, env.APP_PASSWORD)) {
    return true;
  }
  return false;
}

// Sessions are signed with the current password configuration itself,
// so setting or rotating any password invalidates sessions issued
// before the change and the user simply logs in again.
function sessionSigningKey(env) {
  return [env.BLANQUITA_PASSWORD, env.EDUARDO_PASSWORD, env.APP_PASSWORD]
    .filter((v) => typeof v === "string" && v.length > 0)
    .join("|");
}

// Session cookie value: "<expiry>.<username>.<HMAC hex>". Embedding the
// username in the signed payload is what identifies who logged in.
async function makeSession(env, username) {
  const exp = String(Date.now() + SESSION_TTL_MS);
  const sig = await hmacHex(sessionSigningKey(env), "speak-easy|" + username + "|" + exp);
  return exp + "." + username + "." + sig;
}

// Returns the username that owns the session, or null when the request
// carries no valid session.
async function sessionUser(request, env) {
  const key = sessionSigningKey(env);
  if (!key) return null;
  const cookie = getCookie(request, SESSION_COOKIE);
  if (!cookie) return null;
  const parts = cookie.split(".");
  if (parts.length !== 3) return null;
  const exp = parts[0], username = parts[1], sig = parts[2];
  if (!/^\d+$/.test(exp) || Number(exp) < Date.now()) return null;
  if (!Object.prototype.hasOwnProperty.call(USER_SECRET_BINDINGS, username)) return null;
  const expected = await hmacHex(key, "speak-easy|" + username + "|" + exp);
  return timingSafeEqual(sig, expected) ? username : null;
}

function jsonResponse(obj, status = 200, headers = {}) {
  return new Response(JSON.stringify(obj), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8", ...headers },
  });
}

// Inference is split into two calls (bugfix spec
// phonetic-generated-from-source-bug): first translate or correct,
// then respell ONLY the English phrase phonetically. A single call
// doing both made the small model respell the Spanish source instead
// ("Me gusta mi escuela" came back as "Ai gis ta mai eskoola").
const AI_MODEL = "@cf/mistralai/mistral-small-3.1-24b-instruct";
const AI_GATEWAY = {
  gateway: { id: "arananet-ai-gateway", metadata: { app: "speak-easy", env: "prod" } },
};

const TRANSLATE_SYSTEM =
  "You are a translator. Translate the user's Spanish phrase into natural, everyday US English. " +
  "Reply with ONLY the English translation: no quotes, no explanations, no extra text.";

const CORRECT_SYSTEM =
  "You correct English phrases written by a learner. Fix only clear spelling or grammar mistakes and keep the meaning and wording otherwise. " +
  "Reply with ONLY the corrected phrase: no quotes, no explanations, no extra text.";

const PHONETIC_SYSTEM =
  "You rewrite English phrases so a native Spanish speaker can read them aloud and sound close to native English, using Spanish spelling habits. " +
  "One output word for each English word. Keep proper names unchanged. Keep punctuation. Reply with ONLY the rewritten phrase, nothing else. " +
  "Key sounds: 'th' at the start of thank/think becomes 'z'; 'th' in the/this/that becomes 'd'; word-start 'h' becomes 'j'; " +
  "'school' sounds 'skul'; 'like' sounds 'laik'; 'my' sounds 'mai'.";

// Few-shot pairs in the same style as the curated phrase packs.
const PHONETIC_EXAMPLES = [
  ["My name is Blanca", "Mai neim is Blanca"],
  ["I need help", "Ai nid jelp"],
  ["Thank you very much", "Zank iu veri mach"],
  ["Where is the bathroom?", "Juer is de bazrum?"],
  ["I like my school", "Ai laik mai skul"],
  ["I am here to help you", "Ai am jir tu jelp iu"],
  ["Can you speak more slowly, please?", "Can iu spik mor slouli, plis?"],
  ["Do you need anything?", "Du iu nid enizing?"],
];

function phoneticMessages(english) {
  const messages = [{ role: "system", content: PHONETIC_SYSTEM }];
  for (const [en, ph] of PHONETIC_EXAMPLES) {
    messages.push({ role: "user", content: en });
    messages.push({ role: "assistant", content: ph });
  }
  messages.push({ role: "user", content: english });
  return messages;
}

// Model replies should be one bare phrase; strip fences, wrapping
// quotes and stray leading labels just in case.
function cleanLine(text) {
  let t = (text || "").trim();
  t = t.replace(/^```[a-z]*\s*/i, "").replace(/\s*```$/, "");
  const lines = t.split("\n").map((l) => l.trim()).filter(Boolean);
  t = lines.length ? lines[lines.length - 1] : "";
  if (t.length >= 2 && ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'")))) {
    t = t.slice(1, -1).trim();
  }
  return t;
}

function wordCount(s) {
  return s.split(/\s+/).filter(Boolean).length;
}

// Sanity check that the phonetic really tracks the English phrase and
// is not a respelling of the Spanish input: comparable word counts, no
// inverted Spanish punctuation, and no accented vowels that the
// English itself does not carry (proper names keep their accents).
function phoneticPlausible(phonetic, english) {
  if (!phonetic || !english) return false;
  if (/[¿¡]/.test(phonetic)) return false;
  if (/[áéíóúñ]/i.test(phonetic) && !/[áéíóúñ]/i.test(english)) return false;
  const ratio = wordCount(phonetic) / Math.max(1, wordCount(english));
  return ratio >= 0.6 && ratio <= 1.6;
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

async function aiRun(env, messages) {
  const ai = await env.AI.run(AI_MODEL, {
    messages,
    max_tokens: 300,
    temperature: 0.2,
  }, AI_GATEWAY);
  return aiResponseText(ai);
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
  // Step 1: get the English phrase (translate from Spanish, or
  // lightly correct English input). Plain text out.
  let english;
  try {
    english = cleanLine(await aiRun(env, [
      { role: "system", content: source === "es" ? TRANSLATE_SYSTEM : CORRECT_SYSTEM },
      { role: "user", content: text },
    ]));
  } catch (e) {
    return jsonResponse({ error: "El servicio de traducción no responde. Inténtalo de nuevo." }, 502);
  }
  if (!english || english.length > 600) {
    return jsonResponse({ error: "Respuesta incompleta. Inténtalo de nuevo." }, 502);
  }
  // Step 2: respell ONLY the English phrase phonetically. One retry
  // if the sanity check smells the Spanish source leaking back in.
  let phonetic = "";
  try {
    for (let attempt = 0; attempt < 2 && !phoneticPlausible(phonetic, english); attempt++) {
      phonetic = cleanLine(await aiRun(env, phoneticMessages(english)));
    }
  } catch (e) {
    return jsonResponse({ error: "El servicio de traducción no responde. Inténtalo de nuevo." }, 502);
  }
  if (!phoneticPlausible(phonetic, english)) {
    return jsonResponse({ error: "No se pudo interpretar la respuesta. Inténtalo de nuevo." }, 502);
  }
  return jsonResponse({ english, phonetic });
}

async function handleLogin(request, env) {
  if (!anyPasswordConfigured(env)) {
    return jsonResponse({ error: "Login no configurado en el servidor." }, 500);
  }
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Petición inválida." }, 400);
  }
  const username = typeof body.username === "string" ? body.username.trim().toLowerCase() : "";
  const password = typeof body.password === "string" ? body.password : "";
  const knownUser = Object.prototype.hasOwnProperty.call(USER_SECRET_BINDINGS, username);
  if (!knownUser || !passwordAccepted(env, username, password)) {
    return jsonResponse({ error: "Usuario o contraseña incorrectos." }, 401);
  }
  const session = await makeSession(env, username);
  const headers = {
    "Set-Cookie":
      SESSION_COOKIE + "=" + session +
      "; Path=/; Max-Age=" + Math.floor(SESSION_TTL_MS / 1000) +
      "; HttpOnly; Secure; SameSite=Lax",
  };
  return jsonResponse({ ok: true, user: username }, 200, headers);
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

    const authedUser = await sessionUser(request, env);
    if (!authedUser) {
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
