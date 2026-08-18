import { SAGEFORGE_INSTRUCTIONS, SAGEFORGE_VERSION } from "./sfc-profile.js";

const OPENAI_REALTIME_CALLS = "https://api.openai.com/v1/realtime/calls";
const encoder = new TextEncoder();

function cors(extra = {}) {
  return {
    "access-control-allow-origin": "*",
    "access-control-allow-headers": "authorization, content-type",
    "access-control-allow-methods": "GET, POST, OPTIONS",
    ...extra,
  };
}

function json(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: cors({
      "content-type": "application/json; charset=utf-8",
      "cache-control": "no-store",
    }),
  });
}

function html(body, status = 200) {
  return new Response(body, {
    status,
    headers: {
      "content-type": "text/html; charset=utf-8",
      "cache-control": "no-store",
      "referrer-policy": "no-referrer",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; form-action 'self'; base-uri 'none'; frame-ancestors 'none'",
    },
  });
}

function bearer(request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7).trim() : "";
}

function bytesToBase64Url(bytes) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value) {
  const padded = value.replaceAll("-", "+").replaceAll("_", "/") + "===".slice((value.length + 3) % 4);
  const binary = atob(padded);
  return Uint8Array.from(binary, (char) => char.charCodeAt(0));
}

async function sha256Bytes(value) {
  return new Uint8Array(await crypto.subtle.digest("SHA-256", encoder.encode(value)));
}

async function deviceId(token) {
  return bytesToBase64Url(await sha256Bytes(`sfc-device-id-v1:${token}`));
}

async function deviceAesKey(token) {
  const raw = await crypto.subtle.digest("SHA-256", encoder.encode(`sfc-device-key-v1:${token}`));
  return crypto.subtle.importKey("raw", raw, { name: "AES-GCM" }, false, ["encrypt", "decrypt"]);
}

async function encryptApiKey(apiKey, token) {
  const key = await deviceAesKey(token);
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: "AES-GCM", iv }, key, encoder.encode(apiKey));
  return {
    version: 1,
    iv: bytesToBase64Url(iv),
    ciphertext: bytesToBase64Url(new Uint8Array(ciphertext)),
    sageforge_at_enrollment: SAGEFORGE_VERSION,
    created_at: new Date().toISOString(),
  };
}

async function decryptApiKey(record, token) {
  if (!record || record.version !== 1) throw new Error("Unsupported credential record");
  const key = await deviceAesKey(token);
  const clear = await crypto.subtle.decrypt(
    { name: "AES-GCM", iv: base64UrlToBytes(record.iv) },
    key,
    base64UrlToBytes(record.ciphertext),
  );
  return new TextDecoder().decode(clear);
}

function validDeviceToken(token) {
  return /^[A-Za-z0-9_-]{32,256}$/.test(token || "");
}

function activationCode() {
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("").toUpperCase();
}

function setupPage(code, message = "") {
  const cleanCode = /^[A-F0-9]{10}$/.test(code || "") ? code : "";
  const note = message ? `<p class="notice">${message}</p>` : "";
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>Activate SFC Glasses</title><style>
body{font-family:Arial,sans-serif;background:#f4f6f8;color:#111;margin:0}.wrap{max-width:680px;margin:0 auto;padding:28px}.card{background:#fff;border-radius:16px;padding:26px;box-shadow:0 2px 10px #0002}h1{font-size:30px;margin-top:0}p,li,label,input,button,a{font-size:19px;line-height:1.4}input{width:100%;box-sizing:border-box;padding:14px;margin:8px 0 18px;border:1px solid #888;border-radius:8px}button,.btn{display:inline-block;background:#0b5cab;color:#fff;border:0;border-radius:9px;padding:14px 20px;text-decoration:none;font-weight:bold;margin:5px 8px 8px 0}.notice{background:#fff4cc;padding:12px;border-radius:8px}.small{font-size:15px;color:#555}</style></head>
<body><div class="wrap"><div class="card"><h1>Activate SFC Glasses</h1>${note}
<p>This is the one-time OpenAI authorization step. ChatGPT Plus and OpenAI API billing are separate.</p>
<ol><li>If needed, open OpenAI API billing and add payment details.</li><li>Create a <strong>project API key</strong>. A restricted key is preferred; allow the Realtime endpoint needed by SFC.</li><li>Paste that key below. It is encrypted before storage and is not written into the SFC app or GitHub.</li></ol>
<p><a class="btn" href="https://platform.openai.com/settings/organization/billing/overview" target="_blank" rel="noreferrer">OPEN OPENAI BILLING</a><a class="btn" href="https://platform.openai.com/api-keys" target="_blank" rel="noreferrer">CREATE API KEY</a></p>
<form method="post" action="/api/sfc/setup" autocomplete="off"><input type="hidden" name="code" value="${cleanCode}"><label for="api_key"><strong>OpenAI project API key</strong></label><input id="api_key" name="api_key" type="password" required minlength="20" autocomplete="off" autocapitalize="off" spellcheck="false"><button type="submit">ACTIVATE SFC</button></form>
<p class="small">For security, do not paste the API key into chat, email, or a public document.</p></div></div></body></html>`;
}

function successPage() {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>SFC Activated</title><style>body{font-family:Arial,sans-serif;text-align:center;padding:40px;background:#f4f6f8}h1{font-size:34px}.btn{display:inline-block;background:#0b5cab;color:#fff;border-radius:10px;padding:16px 24px;text-decoration:none;font-size:22px;font-weight:bold}</style></head><body><h1>SFC Glasses Activated</h1><p>Your OpenAI credential has been encrypted for this device.</p><p><a class="btn" href="sfcglasses://activated">RETURN TO SFC GLASSES</a></p><script>setTimeout(()=>{location.href='sfcglasses://activated'},800)</script></body></html>`;
}

function sessionConfig(env) {
  return {
    type: "realtime",
    model: env.SFC_MODEL || "gpt-realtime",
    output_modalities: ["audio"],
    instructions: SAGEFORGE_INSTRUCTIONS,
    audio: {
      input: {
        transcription: {
          model: "gpt-4o-mini-transcribe",
          language: "en",
          prompt: "The speaker may begin commands with the letters S F C, pronounced individually. Transcribe that prefix as SFC.",
        },
        noise_reduction: { type: "near_field" },
        turn_detection: {
          type: "server_vad",
          threshold: 0.5,
          prefix_padding_ms: 300,
          silence_duration_ms: 600,
          create_response: false,
          interrupt_response: true,
        },
      },
      output: { voice: "marin" },
    },
  };
}

async function registerDevice(request, env) {
  const body = await request.json().catch(() => ({}));
  const token = typeof body.device_token === "string" ? body.device_token.trim() : "";
  if (!validDeviceToken(token)) return json({ error: "Invalid device credential" }, 400);

  const code = activationCode();
  await env.SFC_CREDENTIALS.put(`activation:${code}`, JSON.stringify({ device_token: token }), { expirationTtl: 600 });
  const origin = new URL(request.url).origin;
  return json({ code, setup_url: `${origin}/api/sfc/setup?code=${code}` });
}

async function deviceStatus(request, env) {
  const token = bearer(request);
  if (!validDeviceToken(token)) return json({ enrolled: false }, 401);
  const id = await deviceId(token);
  return json({ enrolled: Boolean(await env.SFC_CREDENTIALS.get(`device:${id}`)), sageforge: SAGEFORGE_VERSION });
}

async function saveSetup(request, env) {
  const form = await request.formData();
  const code = String(form.get("code") || "").trim().toUpperCase();
  const apiKey = String(form.get("api_key") || "").trim();
  if (!/^[A-F0-9]{10}$/.test(code) || !apiKey.startsWith("sk-") || apiKey.length < 20) {
    return html(setupPage(code, "The activation code or API key format was not accepted."), 400);
  }

  const activationRaw = await env.SFC_CREDENTIALS.get(`activation:${code}`);
  if (!activationRaw) return html(setupPage("", "That activation code expired. Return to the SFC Glasses app and press ACTIVATE again."), 410);

  const activation = JSON.parse(activationRaw);
  const token = activation.device_token;
  if (!validDeviceToken(token)) return html(setupPage("", "The device activation could not be verified."), 400);

  const id = await deviceId(token);
  const encrypted = await encryptApiKey(apiKey, token);
  await env.SFC_CREDENTIALS.put(`device:${id}`, JSON.stringify(encrypted));
  await env.SFC_CREDENTIALS.delete(`activation:${code}`);
  return html(successPage());
}

async function realtime(request, env) {
  const token = bearer(request);
  if (!validDeviceToken(token)) return json({ error: "Unauthorized" }, 401);
  const id = await deviceId(token);
  const recordRaw = await env.SFC_CREDENTIALS.get(`device:${id}`);
  if (!recordRaw) return json({ error: "SFC device is not activated" }, 401);

  let openaiApiKey;
  try {
    openaiApiKey = await decryptApiKey(JSON.parse(recordRaw), token);
  } catch {
    return json({ error: "SFC device credential could not be decrypted" }, 401);
  }

  const length = Number(request.headers.get("content-length") || 0);
  if (length > 131072) return json({ error: "SDP offer too large" }, 413);
  const sdp = await request.text();
  if (!sdp || !sdp.includes("v=0")) return json({ error: "Expected WebRTC SDP offer" }, 400);

  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(sessionConfig(env)));

  const upstream = await fetch(OPENAI_REALTIME_CALLS, {
    method: "POST",
    headers: { authorization: `Bearer ${openaiApiKey}` },
    body: form,
  });

  openaiApiKey = "";
  return new Response(upstream.body, {
    status: upstream.status,
    headers: cors({
      "content-type": upstream.headers.get("content-type") || "application/sdp",
      "cache-control": "no-store",
    }),
  });
}

async function handleSfc(request, env) {
  if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors() });

  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/sfc/health") {
    return json({ ok: true, service: "sfc-relay", model: env.SFC_MODEL || "gpt-realtime", sageforge: SAGEFORGE_VERSION, enrollment: "device-bound" });
  }
  if (request.method === "GET" && url.pathname === "/api/sfc/profile") return json({ version: SAGEFORGE_VERSION });
  if (request.method === "POST" && url.pathname === "/api/sfc/device/register") return registerDevice(request, env);
  if (request.method === "GET" && url.pathname === "/api/sfc/device/status") return deviceStatus(request, env);
  if (request.method === "GET" && url.pathname === "/api/sfc/setup") return html(setupPage(url.searchParams.get("code") || ""));
  if (request.method === "POST" && url.pathname === "/api/sfc/setup") return saveSetup(request, env);
  if (request.method === "POST" && url.pathname === "/api/sfc/realtime") return realtime(request, env);
  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/sfc/")) return await handleSfc(request, env);
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(JSON.stringify({ event: "worker_error", message: error instanceof Error ? error.message : String(error) }));
      return json({ error: "Internal error" }, 500);
    }
  },
};
