"use strict";

const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const SYSTEM_INSTRUCTION =
  "You are auraAI, a helpful, friendly assistant. Answer clearly and naturally. Reply in the language the user uses.";

function getLocalGreetingReply(messages) {
  const lastMessage = messages[messages.length - 1];
  if (/^(hi|hello|hey)[!.?]*$/i.test(lastMessage.content.trim())) {
    return "Hi! How can I help?";
  }
  return null;
}

async function generateGeminiReply({ apiKey, model = DEFAULT_GEMINI_MODEL, messages, fetchImpl = globalThis.fetch }) {
  if (typeof fetchImpl !== "function") {
    throw new Error("This server requires Node.js 18 or newer for AI chat.");
  }

  const contents = messages.map(({ role, content }) => ({
    role: role === "assistant" ? "model" : "user",
    parts: [{ text: content.trim() }],
  }));
  while (contents[0]?.role === "model") contents.shift();

  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
  );

  const upstreamResponse = await fetchImpl(url.toString(), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": apiKey,
    },
    body: JSON.stringify({
      systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
      contents,
    }),
    signal: AbortSignal.timeout(60000),
  });

  let responseData;
  try {
    responseData = await upstreamResponse.json();
  } catch {
    throw new Error("The AI provider returned an invalid response.");
  }

  if (!upstreamResponse.ok) {
    const error = new Error("The Gemini API request failed.");
    error.providerStatus = upstreamResponse.status;
    const providerErrorStatus = responseData?.error?.status;

    if (
      upstreamResponse.status === 401 ||
      upstreamResponse.status === 403 ||
      providerErrorStatus === "API_KEY_INVALID"
    ) {
      error.statusCode = 502;
      error.publicMessage =
        "Gemini rejected the API key. Check that GEMINI_API_KEY is active and correct, then restart the backend.";
    } else if (upstreamResponse.status === 429) {
      error.statusCode = 429;
      error.publicMessage =
        "The Gemini API quota or rate limit was reached. Check your Google AI Studio project quota and billing, then try again.";
    } else if (upstreamResponse.status === 400 || upstreamResponse.status === 404) {
      error.statusCode = 502;
      error.publicMessage = "Gemini could not use this model. Check GEMINI_MODEL and your API access, then try again.";
    } else {
      error.statusCode = 502;
      error.publicMessage = "The AI could not answer right now. Please try again.";
    }

    throw error;
  }

  const reply = responseData?.candidates?.[0]?.content?.parts
    ?.filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text)
    .join("")
    .trim();

  if (!reply) {
    throw new Error("The AI provider returned an empty answer.");
  }

  return reply;
}

module.exports = { DEFAULT_GEMINI_MODEL, generateGeminiReply, getLocalGreetingReply };
