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
    headers: cors({ "content-type": "application/json; charset=utf-8" }),
  });
}

function bearer(request) {
  const value = request.headers.get("authorization") || "";
  return value.startsWith("Bearer ") ? value.slice(7) : "";
}

async function safeEqual(a, b) {
  const [aHash, bHash] = await Promise.all([
    crypto.subtle.digest("SHA-256", encoder.encode(a || "")),
    crypto.subtle.digest("SHA-256", encoder.encode(b || "")),
  ]);
  return crypto.subtle.timingSafeEqual(aHash, bHash);
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

async function realtime(request, env) {
  if (!env.OPENAI_API_KEY || !env.SFC_RELAY_TOKEN) {
    return json({ error: "SFC relay is awaiting secure provisioning" }, 503);
  }

  if (!(await safeEqual(bearer(request), env.SFC_RELAY_TOKEN))) {
    return json({ error: "Unauthorized" }, 401);
  }

  const sdp = await request.text();
  if (!sdp || !sdp.includes("v=0")) {
    return json({ error: "Expected WebRTC SDP offer" }, 400);
  }

  const form = new FormData();
  form.set("sdp", sdp);
  form.set("session", JSON.stringify(sessionConfig(env)));

  const upstream = await fetch(OPENAI_REALTIME_CALLS, {
    method: "POST",
    headers: { authorization: `Bearer ${env.OPENAI_API_KEY}` },
    body: form,
  });

  return new Response(upstream.body, {
    status: upstream.status,
    headers: cors({
      "content-type": upstream.headers.get("content-type") || "application/sdp",
      "cache-control": "no-store",
    }),
  });
}

async function handleSfc(request, env) {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: cors() });
  }

  const url = new URL(request.url);
  if (request.method === "GET" && url.pathname === "/api/sfc/health") {
    return json({
      ok: true,
      service: "sfc-relay",
      model: env.SFC_MODEL || "gpt-realtime",
      sageforge: SAGEFORGE_VERSION,
      provisioned: Boolean(env.OPENAI_API_KEY && env.SFC_RELAY_TOKEN),
    });
  }

  if (request.method === "GET" && url.pathname === "/api/sfc/profile") {
    return json({ version: SAGEFORGE_VERSION });
  }

  if (request.method === "POST" && url.pathname === "/api/sfc/realtime") {
    return realtime(request, env);
  }

  return json({ error: "Not found" }, 404);
}

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      if (url.pathname.startsWith("/api/sfc/")) {
        return await handleSfc(request, env);
      }
      return env.ASSETS.fetch(request);
    } catch (error) {
      console.error(JSON.stringify({
        event: "worker_error",
        message: error instanceof Error ? error.message : String(error),
      }));
      return json({ error: "Internal error" }, 500);
    }
  },
};
