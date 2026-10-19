// Speak Easy worker template.
// Build placeholders __APP_HTML__, __APP_JS__, __APP_CSS__, __PHRASES_JSON__
// are replaced by scripts/build.js with JSON-stringified file contents.
// Runtime bindings: env.AI (Workers AI), env.APP_PASSWORD (secret).

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
  const prompt =
    SYSTEM_PROMPT + "\n\nInput (" + (source === "es" ? "Spanish" : "English") + "): " + text;
  let aiText;
  try {
    const ai = await env.AI.run("@cf/meta/llama-3.1-8b-instruct", {
      prompt,
      max_tokens: 300,
      temperature: 0.3,
    });
    aiText = ai && typeof ai.response === "string" ? ai.response : "";
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
