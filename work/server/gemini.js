"use strict";

const DEFAULT_GEMINI_MODEL = "gemini-3.8-flash";
const MAX_AUDIO_BYTES = 2 * 1024 * 1024;
const MAX_AUDIO_DURATION_MS = 20_000;
const SUPPORTED_AUDIO_TYPES = new Set([
  "audio/aac",
  "audio/mp4",
  "audio/mpeg",
  "audio/ogg",
  "audio/wav",
  "audio/webm",
]);
const SYSTEM_INSTRUCTION =
  "You are auraAI, a helpful, friendly voice assistant. Answer the user's actual question directly and helpfully; do not dodge, deflect, or give generic filler. For benign requests, provide a useful answer. If you are unsure or need essential context, say so plainly and ask only a focused clarifying question. Never invent facts. If a request cannot be fulfilled safely, briefly explain why and offer a safe alternative. Answer clearly and naturally for spoken conversation. Keep replies concise and conversational. Reply in the language the user uses. Do not use Markdown tables or heavy formatting.";

function getLocalGreetingReply(messages) {
  const lastMessage = messages[messages.length - 1];
  if (/^(hi|hello|hey|हाय|हेलो|नमस्ते|नमस्कार)[!.?।]*$/i.test(lastMessage.content.trim())) {
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

function decodeAudioPayload({ audioBase64, mimeType, durationMs } = {}) {
  const normalizedMimeType = typeof mimeType === "string" ? mimeType.split(";")[0].trim().toLowerCase() : "";
  if (!SUPPORTED_AUDIO_TYPES.has(normalizedMimeType)) {
    throw Object.assign(new Error("Use a supported audio recording format."), { statusCode: 415 });
  }
  if (!Number.isInteger(durationMs) || durationMs <= 0 || durationMs > MAX_AUDIO_DURATION_MS) {
    throw Object.assign(new Error("Audio must be between 1 ms and 20 seconds long."), { statusCode: 400 });
  }
  if (
    typeof audioBase64 !== "string" ||
    !audioBase64 ||
    audioBase64.length > Math.ceil(MAX_AUDIO_BYTES / 3) * 4 ||
    !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(audioBase64)
  ) {
    throw Object.assign(new Error("Send a valid audio recording."), { statusCode: 400 });
  }

  const audio = Buffer.from(audioBase64, "base64");
  if (!audio.length || audio.length > MAX_AUDIO_BYTES) {
    throw Object.assign(new Error("Audio recording is empty or too large."), { statusCode: audio.length ? 413 : 400 });
  }

  return { audio, mimeType: normalizedMimeType, durationMs };
}

async function transcribeGeminiAudio({
  apiKey,
  model = DEFAULT_GEMINI_MODEL,
  audio,
  mimeType,
  fetchImpl = globalThis.fetch,
}) {
  if (typeof fetchImpl !== "function") {
    throw new Error("This server requires Node.js 18 or newer for AI transcription.");
  }
  if (!apiKey) {
    throw Object.assign(new Error("AI is not configured. Add GEMINI_API_KEY to the server environment."), {
      statusCode: 503,
    });
  }

  const url = new URL(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`,
  );
  let upstreamResponse;
  try {
    upstreamResponse = await fetchImpl(url.toString(), {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body: JSON.stringify({
        contents: [{
          role: "user",
          parts: [
            { text: "Transcribe the audio exactly as spoken. Return only the spoken words, without labels, commentary, or translation." },
            { inlineData: { mimeType, data: audio.toString("base64") } },
          ],
        }],
      }),
      signal: AbortSignal.timeout(60000),
    });
  } catch {
    throw Object.assign(new Error("Could not reach Gemini for audio transcription. Please try again."), {
      statusCode: 502,
    });
  }

  let responseData;
  try {
    responseData = await upstreamResponse.json();
  } catch {
    throw Object.assign(new Error("Gemini returned an invalid transcription response."), { statusCode: 502 });
  }
  if (!upstreamResponse.ok) {
    const error = new Error("The Gemini audio transcription request failed.");
    error.providerStatus = upstreamResponse.status;
    if (upstreamResponse.status === 429) {
      error.statusCode = 429;
      error.publicMessage = "The Gemini API quota or rate limit was reached. Try again shortly.";
    } else if (upstreamResponse.status === 400 || upstreamResponse.status === 404) {
      error.statusCode = 502;
      error.publicMessage = "Gemini could not process this audio or model. Check GEMINI_MODEL and audio support, then try again.";
    } else if (upstreamResponse.status === 401 || upstreamResponse.status === 403) {
      error.statusCode = 502;
      error.publicMessage = "Gemini rejected the server API key. Check GEMINI_API_KEY.";
    } else {
      error.statusCode = 502;
      error.publicMessage = "Gemini could not transcribe the audio right now. Please try again.";
    }
    throw error;
  }

  const transcript = responseData?.candidates?.[0]?.content?.parts
    ?.filter((part) => typeof part.text === "string" && !part.thought)
    .map((part) => part.text)
    .join("")
    .trim();
  if (!transcript) {
    throw Object.assign(new Error("No speech was detected. Please try speaking again."), { statusCode: 422 });
  }
  return transcript;
}

module.exports = {
  DEFAULT_GEMINI_MODEL,
  MAX_AUDIO_BYTES,
  MAX_AUDIO_DURATION_MS,
  decodeAudioPayload,
  generateGeminiReply,
  getLocalGreetingReply,
  transcribeGeminiAudio,
};
