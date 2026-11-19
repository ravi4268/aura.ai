const { safeJson } = require("../_auth");
const { getPublicBaseUrl } = require("../../server/twilio");

module.exports = async function handler(request, response) {
  if (request.method !== "POST" && request.method !== "GET") {
    safeJson(response, 405, { error: "Method not allowed" });
    return;
  }
  const baseUrl = getPublicBaseUrl();
  response.statusCode = 200;
  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.end(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi" language="hi-IN">Namaste. Main auraAI hoon. Aap kya baat karna chahenge?</Say><Gather input="speech" language="hi-IN" speechTimeout="auto" action="${baseUrl}/api/voice/turn" method="POST"/><Say voice="Polly.Aditi" language="hi-IN">Aapki awaaz sunai nahi di. Alvida.</Say></Response>`);
};
