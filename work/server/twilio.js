"use strict";

function getPublicBaseUrl(env = process.env) {
  const configuredUrl = env.PUBLIC_BASE_URL || (env.VERCEL_URL ? `https://${env.VERCEL_URL}` : "");
  return configuredUrl.replace(/\/+$/, "");
}

function normalizeE164Number(value) {
  if (typeof value !== "string") return null;
  const number = value.replace(/[\s().-]/g, "");
  return /^\+[1-9]\d{7,14}$/.test(number) ? number : null;
}

async function createTwilioCall(to, { env = process.env, fetchImpl = globalThis.fetch } = {}) {
  const accountSid = typeof env.TWILIO_ACCOUNT_SID === "string" ? env.TWILIO_ACCOUNT_SID.trim() : "";
  const authToken = typeof env.TWILIO_AUTH_TOKEN === "string" ? env.TWILIO_AUTH_TOKEN.trim() : "";
  const fromNumber = env.TWILIO_FROM_NUMBER;
  const publicBaseUrl = getPublicBaseUrl(env);
  const missing = [];
  if (!accountSid) missing.push("TWILIO_ACCOUNT_SID");
  if (!authToken) missing.push("TWILIO_AUTH_TOKEN");
  if (!fromNumber) missing.push("TWILIO_FROM_NUMBER");
  if (!publicBaseUrl) missing.push("PUBLIC_BASE_URL");

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
  if (normalizedTo.startsWith("+92") && !/^\+923\d{9}$/.test(normalizedTo)) {
    throw Object.assign(
      new Error("Enter a complete Pakistan mobile number: +92 followed by all 10 mobile digits (for example +923001234567)."),
      { statusCode: 400 },
    );
  }
  const normalizedFrom = normalizeE164Number(fromNumber);
  if (!normalizedFrom) {
    throw Object.assign(
      new Error(
        "Set TWILIO_FROM_NUMBER to a voice-enabled number from your Twilio account in E.164 format (for example +14155552671). This is the Twilio caller ID, not the phone you want to call.",
      ),
      { statusCode: 503 },
    );
  }

  let baseUrl;
  try {
    baseUrl = new URL(publicBaseUrl);
  } catch {
    throw Object.assign(new Error("PUBLIC_BASE_URL must be a valid public HTTPS URL."), { statusCode: 503 });
  }
  if (baseUrl.protocol !== "https:") {
    throw Object.assign(new Error("PUBLIC_BASE_URL must use HTTPS and be reachable by Twilio."), { statusCode: 503 });
  }

  const params = new URLSearchParams({
    To: normalizedTo,
    From: normalizedFrom,
    Url: `${publicBaseUrl}/api/voice/answer`,
    StatusCallback: `${publicBaseUrl}/api/voice/status`,
    StatusCallbackEvent: "initiated ringing answered completed",
    StatusCallbackMethod: "POST",
    Record: "false",
  });

  let upstream;
  try {
    upstream = await fetchImpl(
      `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(accountSid)}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params,
        signal: AbortSignal.timeout(30000),
      },
    );
  } catch {
    throw Object.assign(new Error("Could not reach Twilio. Check the server connection and try again."), {
      statusCode: 502,
    });
  }

  let data;
  try {
    data = await upstream.json();
  } catch {
    throw Object.assign(new Error("Twilio returned an invalid response."), { statusCode: 502 });
  }

  if (!upstream.ok) {
    if (Number(data.code) === 20003) {
      throw Object.assign(
        new Error(
          "Twilio rejected the credentials (error 20003). TWILIO_ACCOUNT_SID and TWILIO_AUTH_TOKEN must be the matching pair from the same Twilio account. Copy or regenerate the Auth Token for this Account SID in Twilio Console, update both server environment variables, then restart or redeploy. Never share the Auth Token.",
        ),
        { statusCode: 502 },
      );
    }
    throw Object.assign(new Error(data.message || "Twilio could not start the phone call."), { statusCode: 502 });
  }

  return { callSid: data.sid, status: data.status, to: normalizedTo };
}

module.exports = { createTwilioCall, getPublicBaseUrl };
