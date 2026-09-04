const RESPONSES_URL = "https://api.openai.com/v1/responses";
const INPUT_TYPES = new Set(["text", "barcode", "url", "photo", "voice"]);
const MAX_BODY_BYTES = 4_000_000;

const RESULT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    status: { enum: ["matched", "no_match"] },
    product: {
      type: "object",
      additionalProperties: false,
      properties: {
        name: { type: "string" },
        brand: { type: "string" },
        variant: { type: "string" },
        quantity_value: { type: ["number", "null"] },
        quantity_unit: { type: "string" },
        gtin: { type: "string" },
      },
      required: ["name", "brand", "variant", "quantity_value", "quantity_unit", "gtin"],
    },
    offers: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          retailer: { type: "string" },
          price: { type: ["number", "null"] },
          currency: { type: "string" },
          package_quantity: { type: "string" },
          unit_price: { type: ["number", "null"] },
          shipping: { type: "string" },
          coupon: { type: "string" },
          availability: { type: "string" },
          source_url: { type: "string" },
          observed_at: { type: "string" },
          confidence: { enum: ["high", "medium", "low"] },
        },
        required: [
          "retailer", "price", "currency", "package_quantity", "unit_price", "shipping",
          "coupon", "availability", "source_url", "observed_at", "confidence",
        ],
      },
    },
    recommended_buy_price: { type: ["number", "null"] },
    guidance: { enum: ["BUY", "WAIT", "WATCH"] },
    reason: { type: "string" },
    back_in_stock_supported: { type: "boolean" },
    limitations: { type: "array", items: { type: "string" } },
  },
  required: [
    "status", "product", "offers", "recommended_buy_price", "guidance", "reason",
    "back_in_stock_supported", "limitations",
  ],
};

function json(data, status = 200, origin = "") {
  const headers = {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
    "x-content-type-options": "nosniff",
    "referrer-policy": "no-referrer",
  };
  if (origin) {
    headers["access-control-allow-origin"] = origin;
    headers.vary = "origin";
  }
  return new Response(JSON.stringify(data), { status, headers });
}

function allowedOrigin(request, env) {
  const origin = request.headers.get("origin") || "";
  const configured = String(env.BUYPOINT_ALLOWED_ORIGIN || "").replace(/\/$/, "");
  if (!origin || !configured || origin !== configured) return "";
  return origin;
}

function inputPrompt(input) {
  const value = typeof input.value === "string" ? input.value.trim().slice(0, 2000) : "";
  return [
    "Resolve this shopping item and current offers for a consumer decision tool.",
    `Input type: ${input.type}.`,
    value ? `User-supplied clue: ${value}` : "No text clue was supplied.",
    "Match exact brand, product, variant, model, size, count, and quantity before comparing prices.",
    "Search current public retailer and price-history sources. Use only evidence tied to the exact item.",
    "Normalize package size and unit price. State shipping, coupons, stock, and back-in-stock support only when evidenced.",
    "Set status to no_match when exact identity or current offer evidence is insufficient. Never invent a price, stock status, coupon, source, or target.",
    "Recommend a buy price from cited current/history evidence and explain BUY, WAIT, or WATCH concisely.",
  ].join("\n");
}

function responseInput(input) {
  const content = [{ type: "input_text", text: inputPrompt(input) }];
  if (input.type === "photo") {
    const image = typeof input.image_data_url === "string" ? input.image_data_url : "";
    if (!/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$/.test(image)) {
      throw new Error("PHOTO_REQUIRED");
    }
    content.push({ type: "input_image", image_url: image, detail: "auto" });
  }
  return [{ role: "user", content }];
}

function outputText(response) {
  for (const item of response.output || []) {
    if (item.type !== "message") continue;
    for (const part of item.content || []) if (part.type === "output_text" && part.text) return part.text;
  }
  return "";
}

function sourceUrls(response) {
  const urls = new Set();
  for (const item of response.output || []) {
    if (item.type !== "web_search_call") continue;
    for (const source of item.action?.sources || []) if (typeof source.url === "string") urls.add(source.url);
  }
  return [...urls];
}

function sameSource(candidate, sources) {
  try {
    const url = new URL(candidate);
    return sources.some((source) => {
      try {
        const cited = new URL(source);
        return cited.hostname === url.hostname;
      } catch {
        return false;
      }
    });
  } catch {
    return false;
  }
}

async function resolveProduct(request, env, fetchImpl = fetch) {
  const origin = allowedOrigin(request, env);
  if (!origin) return json({ error: "origin_not_allowed" }, 403);
  if (!env.BUYPOINT_OPENAI_API_KEY) return json({ error: "provider_not_configured" }, 503, origin);
  const length = Number(request.headers.get("content-length") || 0);
  if (length > MAX_BODY_BYTES) return json({ error: "request_too_large" }, 413, origin);
  const body = await request.json().catch(() => null);
  const input = body?.input;
  if (!input || !INPUT_TYPES.has(input.type)) return json({ error: "invalid_input" }, 400, origin);
  if (input.type !== "photo" && (!input.value || typeof input.value !== "string")) {
    return json({ error: "input_value_required" }, 400, origin);
  }

  let modelInput;
  try {
    modelInput = responseInput(input);
  } catch (error) {
    return json({ error: error.message === "PHOTO_REQUIRED" ? "photo_required" : "invalid_input" }, 400, origin);
  }

  const upstream = await fetchImpl(RESPONSES_URL, {
    method: "POST",
    headers: {
      authorization: `Bearer ${env.BUYPOINT_OPENAI_API_KEY}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: env.BUYPOINT_MODEL || "gpt-6-astra",
      reasoning: { effort: "low" },
      tools: [{ type: "web_search" }],
      tool_choice: "auto",
      include: ["web_search_call.action.sources"],
      input: modelInput,
      text: { format: { type: "json_schema", name: "buypoint_resolution", strict: true, schema: RESULT_SCHEMA } },
      max_output_tokens: 3000,
    }),
  });
  if (!upstream.ok) return json({ error: "provider_request_failed", status: upstream.status }, 502, origin);
  const response = await upstream.json();
  const text = outputText(response);
  let result;
  try {
    result = JSON.parse(text);
  } catch {
    return json({ error: "provider_output_invalid" }, 502, origin);
  }
  const sources = sourceUrls(response);
  if (result.status === "matched") {
    const supported = (result.offers || []).filter((offer) => sameSource(offer.source_url, sources));
    if (!supported.length) return json({ error: "no_supported_offer_sources" }, 422, origin);
    result.offers = supported;
  }
  return json({ release: "BUYPOINT-PROVIDER-RC1", result, sources }, 200, origin);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const origin = allowedOrigin(request, env);
    if (request.method === "OPTIONS") {
      if (!origin) return json({ error: "origin_not_allowed" }, 403);
      return new Response(null, {
        status: 204,
        headers: {
          "access-control-allow-origin": origin,
          "access-control-allow-methods": "POST, OPTIONS",
          "access-control-allow-headers": "content-type",
          vary: "origin",
        },
      });
    }
    if (request.method === "GET" && url.pathname === "/health") {
      return json({ ok: true, service: "buypoint-provider", release: "BUYPOINT-PROVIDER-RC1", configured: Boolean(env.BUYPOINT_OPENAI_API_KEY) });
    }
    if (request.method === "POST" && url.pathname === "/api/buypoint/resolve") return resolveProduct(request, env);
    return json({ error: "not_found" }, 404);
  },
};

export { RESULT_SCHEMA, resolveProduct };
