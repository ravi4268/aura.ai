const { DEFAULT_GEMINI_MODEL, generateGeminiReply } = require("../../server/gemini");
const { getPublicBaseUrl } = require("../../server/twilio");

function readForm(request) {
  return new Promise((resolve, reject) => {
    let raw = "";
    request.on("data", (chunk) => { raw += chunk; });
    request.on("end", () => resolve(Object.fromEntries(new URLSearchParams(raw))));
    request.on("error", reject);
  });
}

module.exports = async function handler(request, response) {
  const baseUrl = getPublicBaseUrl();
  response.setHeader("Content-Type", "application/xml; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");

  let speech = "";
  try {
    const body = request.body && typeof request.body === "object" ? request.body : await readForm(request);
    speech = typeof body.SpeechResult === "string" ? body.SpeechResult.trim() : "";
  } catch (error) {
    console.error("Could not read Twilio voice request:", error.message);
    response.statusCode = 400;
    response.end(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi" language="hi-IN">Maaf kijiye, call mein dikkat aayi. Kripya dobara koshish kijiye.</Say></Response>`);
    return;
  }

  if (!speech) {
    response.statusCode = 200;
    response.end(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi" language="hi-IN">Aapki baat saaf sunai nahi di. Kripya phir se boliye.</Say><Gather input="speech" language="hi-IN" speechTimeout="auto" action="${baseUrl}/api/voice/turn" method="POST"/></Response>`);
    return;
  }

  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) throw new Error("AI not configured");
    const reply = await generateGeminiReply({
      apiKey,
      model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
      messages: [{ role: "user", content: speech }],
    });
    const safeReply = reply.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    response.statusCode = 200;
    response.end(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi" language="hi-IN">${safeReply}</Say><Gather input="speech" language="hi-IN" speechTimeout="auto" action="${baseUrl}/api/voice/turn" method="POST"/></Response>`);
  } catch (error) {
    console.error("Twilio voice turn failed:", error.message);
    response.statusCode = 200;
    response.end(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi" language="hi-IN">Maaf kijiye, main abhi jawab nahi de pa raha hoon. Kripya baad mein phir koshish kijiye.</Say></Response>`);
  }
};
