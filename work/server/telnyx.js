"use strict";

function normalizeE164Number(value) {
  if (typeof value !== "string") return null;
  const number = value.replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(number) ? number : null;
}

async function createTelnyxCall(to, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const apiKey = typeof env.TELNYX_API_KEY === "string" ? env.TELNYX_API_KEY.trim() : "";
  const connectionId = typeof env.TELNYX_CONNECTION_ID === "string" ? env.TELNYX_CONNECTION_ID.trim() : "";
  const assistantId = typeof env.TELNYX_AI_ASSISTANT_ID === "string" ? env.TELNYX_AI_ASSISTANT_ID.trim() : "";
  const fromNumber = typeof env.TELNYX_FROM_NUMBER === "string" ? env.TELNYX_FROM_NUMBER.trim() : "";
  const missing = [];
  if (!apiKey) missing.push("TELNYX_API_KEY");
  if (!connectionId) missing.push("TELNYX_CONNECTION_ID");
  if (!assistantId) missing.push("TELNYX_AI_ASSISTANT_ID");
  if (!fromNumber) missing.push("TELNYX_FROM_NUMBER");

  if (missing.length) {
    throw Object.assign(
      new Error(`Phone calling is not configured. Set ${missing.join(", ")} in the server environment.`),
      { statusCode: 503 },
    );
  }

  const normalizedTo = normalizeE164Number(to);
  if (!normalizedTo) {
    throw Object.assign(new Error("Enter a valid phone number in international format, for example +919876543210."), {
      statusCode: 400,
    });
  }
  let normalizedFrom = normalizeE164Number(fromNumber);
  if (!normalizedFrom && /^\d{10}$/.test(fromNumber.replace(/[^\d]/g, ""))) {
    normalizedFrom = `+91${fromNumber.replace(/[^\d]/g, "")}`;
  }
  if (!normalizedFrom) {
    throw Object.assign(
      new Error("Set TELNYX_FROM_NUMBER to a voice-enabled Telnyx phone number in international format."),
      { statusCode: 503 },
    );
  }

  let upstream;
  try {
    upstream = await fetchImpl("https://api.telnyx.com/v2/calls", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        connection_id: connectionId,
        from: normalizedFrom,
        to: normalizedTo,
        assistant: { id: assistantId },
      }),
      signal: AbortSignal.timeout(30000),
    });
  } catch {
    throw Object.assign(new Error("Could not reach Telnyx. Check the server connection and try again."), {
      statusCode: 502,
    });
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    throw Object.assign(new Error("Telnyx returned an invalid response."), { statusCode: 502 });
  }

  if (!upstream.ok) {
    const messages = Array.isArray(data.errors)
      ? data.errors.map((error) => error.detail || error.title || error.code).filter(Boolean)
      : [];
    const providerMessage = messages.join(" ");
    const connectionWebhookError =
      /requested connection_id/i.test(providerMessage) &&
      /Call Control App/i.test(providerMessage) &&
      /valid webhook URL/i.test(providerMessage);
    throw Object.assign(
      new Error(
        connectionWebhookError
          ? "Telnyx rejected TELNYX_CONNECTION_ID. In Telnyx Mission Control, use the correct Call Control App ID and set its webhook URL to your deployed public HTTPS endpoint ending in /api/telnyx/webhook."
          : providerMessage || "Telnyx could not start the phone call. Check your API key, connection, assistant, and caller number.",
      ),
      { statusCode: upstream.status === 401 || upstream.status === 403 ? 502 : 400 },
    );
  }

  const callId = data.data?.call_control_id || data.data?.call_leg_id;
  if (typeof callId !== "string" || !callId) {
    throw Object.assign(new Error("Telnyx accepted the call without returning a call ID."), { statusCode: 502 });
  }

  return { callId, status: "initiated", to: normalizedTo };
}

module.exports = { createTelnyxCall, normalizeE164Number };
