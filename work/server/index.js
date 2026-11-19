"use strict";

const crypto = require("node:crypto");
const fs = require("node:fs");
const http = require("node:http");
const path = require("node:path");
const { URL } = require("node:url");
const dotenv = require("dotenv");
const {
  DEFAULT_GEMINI_MODEL,
  MAX_AUDIO_BYTES,
  decodeAudioPayload,
  generateGeminiReply,
  getLocalGreetingReply,
  transcribeGeminiAudio,
} = require("./gemini");
const { createTwilioCall, getPublicBaseUrl } = require("./twilio");

const envPath = path.resolve(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const { error, parsed = {} } = dotenv.config({ path: envPath, quiet: true });
  if (error) throw error;

  if (/^<[^>]+>$/.test((process.env.GEMINI_API_KEY || "").trim())) {
    if (parsed.GEMINI_API_KEY) {
      process.env.GEMINI_API_KEY = parsed.GEMINI_API_KEY;
    } else {
      delete process.env.GEMINI_API_KEY;
    }
  }
}

const SESSION_COOKIE = "aura_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const SESSION_DURATION_SECONDS = SESSION_DURATION_MS / 1000;
const MAX_BODY_BYTES = 8 * 1024;
const MAX_CHAT_BODY_BYTES = 32 * 1024;
const MAX_AUDIO_BODY_BYTES = Math.ceil(MAX_AUDIO_BYTES / 3) * 4 + 4096;
const MAX_CHAT_MESSAGES = 20;
const MAX_CHAT_MESSAGE_LENGTH = 4000;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;
const MAX_LOGIN_ATTEMPTS = 5;

function sendJson(response, statusCode, data, headers = {}) {
  response.writeHead(statusCode, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end(JSON.stringify(data));
}

function sendNoContent(response, headers = {}) {
  response.writeHead(204, {
    "Cache-Control": "no-store",
    "X-Content-Type-Options": "nosniff",
    ...headers,
  });
  response.end();
}

function readJsonBody(request, maxBodyBytes = MAX_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    let body = "";
    let size = 0;
    let tooLarge = false;
    request.setEncoding("utf8");
    request.on("data", (chunk) => {
      if (tooLarge) return;
      size += Buffer.byteLength(chunk);
      if (size > maxBodyBytes) {
        tooLarge = true;
        body = "";
        return;
      }
      body += chunk;
    });
    request.on("end", () => {
      if (tooLarge) {
        reject(Object.assign(new Error("Request body is too large"), { statusCode: 413 }));
        return;
      }
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON"), { statusCode: 400 }));
      }
    });
    request.on("error", reject);
  });
}

function readFormBody(request) {
  return new Promise((resolve, reject) => {
    let body = "";
    request.setEncoding("utf8");
    request.on("data", (chunk) => { body += chunk; });
    request.on("end", () => {
      const data = {};
      for (const [key, value] of new URLSearchParams(body)) data[key] = value;
      resolve(data);
    });
    request.on("error", reject);
  });
}

function getCookie(request, name) {
  const cookieHeader = request.headers.cookie || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return cookie ? cookie.slice(name.length + 1) : "";
}

function createAuthServer({
  password,
  secureCookies = false,
  apiKey = process.env.GEMINI_API_KEY,
  model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
  fetchImpl = globalThis.fetch,
  twilioEnv = process.env,
} = {}) {
  if (typeof password !== "string" || password.length < 4) {
    throw new Error("A server-side password of at least 4 characters is required.");
  }

  const passwordSalt = crypto.createHash("sha256").update("auraAI:Sanidhya:v1").digest();
  const expectedPasswordHash = crypto.scryptSync(password, passwordSalt, 64);
  const sessions = new Map();
  const loginAttempts = new Map();
  const secureAttribute = secureCookies ? "; Secure" : "";

  const createSessionCookie = (sessionId) =>
    `${SESSION_COOKIE}=${encodeURIComponent(sessionId)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${SESSION_DURATION_SECONDS}${secureAttribute}`;
  const clearSessionCookie = () =>
    `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secureAttribute}`;

  const server = http.createServer(async (request, response) => {
    const requestUrl = new URL(request.url, "http://localhost");
    const route = (requestUrl.pathname || "/").replace(/\/+$/, "") || "/";
    const allowedRoutes = new Set([
      "/api/auth/login",
      "/api/auth/logout",
      "/api/auth/session",
      "/api/chat",
      "/api/call/start",
      "/api/voice/transcribe",
      "/api/voice/answer",
      "/api/voice/turn",
      "/api/voice/status",
    ]);

    if (!allowedRoutes.has(route)) {
      sendJson(response, 404, { error: "Not found" });
      return;
    }

    if (route === "/api/auth/session") {
      if (request.method !== "GET") {
        sendJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" });
        return;
      }

      const sessionId = getCookie(request, SESSION_COOKIE);
      const session = sessions.get(sessionId);
      if (!session || session.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        sendJson(response, 401, { error: "Not authenticated" });
        return;
      }

      sendJson(response, 200, { user: { name: "Sanidhya" } });
      return;
    }

    if (request.method !== "POST") {
      sendJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" });
      return;
    }

    if (route === "/api/auth/logout") {
      sessions.delete(getCookie(request, SESSION_COOKIE));
      sendNoContent(response, { "Set-Cookie": clearSessionCookie() });
      return;
    }

    if (route === "/api/call/start") {
      const sessionId = getCookie(request, SESSION_COOKIE);
      const session = sessions.get(sessionId);
      if (!session || session.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        sendJson(response, 401, { error: "Please sign in again before starting a phone call." });
        return;
      }

      try {
        const body = await readJsonBody(request, MAX_BODY_BYTES);
        const call = await createTwilioCall(body?.to, { env: twilioEnv, fetchImpl });
        sendJson(response, 200, call);
      } catch (error) {
        sendJson(response, error.statusCode || 502, { error: error.message || "Could not start the phone call." });
      }
      return;
    }

    if (route === "/api/voice/transcribe") {
      const sessionId = getCookie(request, SESSION_COOKIE);
      const session = sessions.get(sessionId);
      if (!session || session.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        sendJson(response, 401, { error: "Please sign in again before using voice chat." });
        return;
      }

      if (!(request.headers["content-type"] || "").toLowerCase().startsWith("application/json")) {
        sendJson(response, 415, { error: "Content-Type must be application/json." });
        return;
      }

      try {
        const body = await readJsonBody(request, MAX_AUDIO_BODY_BYTES);
        const { audio, mimeType } = decodeAudioPayload(body);
        if (!apiKey) {
          sendJson(response, 503, { error: "AI is not configured. Add GEMINI_API_KEY to the server environment." });
          return;
        }

        const transcript = await transcribeGeminiAudio({ apiKey, model, audio, mimeType, fetchImpl });
        sendJson(response, 200, { transcript });
      } catch (error) {
        if (error.providerStatus) console.error("Gemini transcription failed with status:", error.providerStatus);
        sendJson(response, error.statusCode || 502, {
          error: error.publicMessage || error.message || "Could not transcribe the audio. Please try again.",
        });
      }
      return;
    }

    if (route === "/api/voice/status") {
      sendNoContent(response);
      return;
    }

    if (route === "/api/voice/answer") {
      const baseUrl = getPublicBaseUrl(twilioEnv);
      response.writeHead(200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" });
      response.end(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi" language="hi-IN">Namaste. Main auraAI hoon. Aap kya baat karna chahenge?</Say><Gather input="speech" language="hi-IN" speechTimeout="auto" action="${baseUrl}/api/voice/turn" method="POST"/><Say voice="Polly.Aditi" language="hi-IN">Aapki awaaz sunai nahi di. Alvida.</Say></Response>`);
      return;
    }

    if (route === "/api/voice/turn") {
      try {
        const body = await readFormBody(request);
        const speech = typeof body?.SpeechResult === "string" ? body.SpeechResult.trim() : "";
        const baseUrl = getPublicBaseUrl(twilioEnv);
        if (!speech) {
          response.writeHead(200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" });
          response.end(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi" language="hi-IN">Aapki baat saaf sunai nahi di. Kripya phir se boliye.</Say><Gather input="speech" language="hi-IN" speechTimeout="auto" action="${baseUrl}/api/voice/turn" method="POST"/></Response>`);
          return;
        }

        if (!apiKey) throw new Error("AI is not configured.");
        const reply = await generateGeminiReply({ apiKey, model, messages: [{ role: "user", content: speech }], fetchImpl });
        const safeReply = reply.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        response.writeHead(200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" });
        response.end(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi" language="hi-IN">${safeReply}</Say><Gather input="speech" language="hi-IN" speechTimeout="auto" action="${baseUrl}/api/voice/turn" method="POST"/></Response>`);
      } catch (error) {
        console.error("Twilio voice turn failed:", error.message);
        response.writeHead(200, { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "no-store" });
        response.end(`<?xml version="1.0" encoding="UTF-8"?><Response><Say voice="Polly.Aditi" language="hi-IN">Maaf kijiye, main abhi jawab nahi de pa raha hoon. Kripya baad mein phir koshish kijiye.</Say></Response>`);
      }
      return;
    }

    if (route === "/api/chat") {
      const sessionId = getCookie(request, SESSION_COOKIE);
      const session = sessions.get(sessionId);
      if (!session || session.expiresAt <= Date.now()) {
        sessions.delete(sessionId);
        sendJson(response, 401, { error: "Please sign in again to continue chatting." });
        return;
      }

      try {
        const contentType = request.headers["content-type"] || "";
        if (!contentType.toLowerCase().startsWith("application/json")) {
          sendJson(response, 415, { error: "Content-Type must be application/json" });
          return;
        }

        const body = await readJsonBody(request, MAX_CHAT_BODY_BYTES);
        if (
          !body ||
          !Array.isArray(body.messages) ||
          body.messages.length === 0 ||
          body.messages.length > MAX_CHAT_MESSAGES ||
          body.messages.some(
            (message) =>
              !message ||
              !["user", "assistant"].includes(message.role) ||
              typeof message.content !== "string" ||
              !message.content.trim() ||
              message.content.length > MAX_CHAT_MESSAGE_LENGTH,
          ) ||
          body.messages[body.messages.length - 1].role !== "user"
        ) {
          sendJson(response, 400, { error: "Send a valid message to continue the conversation." });
          return;
        }

        const greetingReply = getLocalGreetingReply(body.messages);
        if (greetingReply) {
          sendJson(response, 200, { reply: greetingReply });
          return;
        }

        if (!apiKey) {
          sendJson(response, 503, { error: "AI is not configured. Add GEMINI_API_KEY to the server environment." });
          return;
        }

        const reply = await generateGeminiReply({
          apiKey,
          model,
          messages: body.messages,
          fetchImpl,
        });
        sendJson(response, 200, { reply });
      } catch (error) {
        if (error.statusCode) {
          if (error.providerStatus) {
            console.error("Gemini request failed with status:", error.providerStatus);
          }
          sendJson(response, error.statusCode, { error: error.publicMessage || error.message });
          return;
        }
        console.error("AI chat request failed:", error);
        if (!response.headersSent) {
          sendJson(response, 502, { error: "Could not reach the AI service. Please try again." });
        }
      }
      return;
    }

    const ip = request.socket.remoteAddress || "unknown";
    const requestNow = Date.now();
    for (const [address, attempt] of loginAttempts) {
      if (attempt.expiresAt <= requestNow) loginAttempts.delete(address);
    }
    const attempts = loginAttempts.get(ip);
    if (attempts && attempts.count >= MAX_LOGIN_ATTEMPTS) {
      sendJson(response, 429, { error: "Too many login attempts. Please try again later." });
      return;
    }

    try {
      const contentType = request.headers["content-type"] || "";
      if (!contentType.toLowerCase().startsWith("application/json")) {
        sendJson(response, 415, { error: "Content-Type must be application/json" });
        return;
      }

      const body = await readJsonBody(request);
      const submittedPassword = body && body.password;
      if (typeof submittedPassword !== "string" || submittedPassword.length > 1024) {
        sendJson(response, 400, { error: "Enter a valid password." });
        return;
      }

      const submittedHash = crypto.scryptSync(submittedPassword, passwordSalt, 64);
      if (!crypto.timingSafeEqual(expectedPasswordHash, submittedHash)) {
        const nextAttempts =
          attempts && attempts.expiresAt > requestNow
            ? { count: attempts.count + 1, expiresAt: attempts.expiresAt }
            : { count: 1, expiresAt: requestNow + LOGIN_WINDOW_MS };
        loginAttempts.set(ip, nextAttempts);
        sendJson(response, 401, { error: "Incorrect password. Please try again." });
        return;
      }

      loginAttempts.delete(ip);
      const now = Date.now();
      for (const [id, session] of sessions) {
        if (session.expiresAt <= now) sessions.delete(id);
      }
      const sessionId = crypto.randomBytes(32).toString("base64url");
      sessions.set(sessionId, { expiresAt: now + SESSION_DURATION_MS });
      sendJson(
        response,
        200,
        { user: { name: "Sanidhya" } },
        { "Set-Cookie": createSessionCookie(sessionId) },
      );
    } catch (error) {
      if (error.statusCode) {
        sendJson(response, error.statusCode, { error: error.message });
        return;
      }
      console.error("Authentication request failed:", error);
      if (!response.headersSent) {
        sendJson(response, 500, { error: "Authentication service is unavailable." });
      }
    }
  });

  return server;
}

if (require.main === module) {
  const password = process.env.SANIDHYA_PASSWORD;
  if (!password) {
    console.error("Set SANIDHYA_PASSWORD in the server environment before starting the API.");
    process.exitCode = 1;
  } else {
    const port = Number(process.env.PORT) || 5001;
    const server = createAuthServer({
      password,
      secureCookies: process.env.NODE_ENV === "production",
    });
    server.on("error", (error) => {
      if (error.code === "EADDRINUSE") {
        console.error(`Port ${port} is already in use. Stop the existing server using this port, then run npm run server again.`);
        process.exitCode = 1;
        return;
      }
      throw error;
    });
    server.listen(port, () => {
      console.log(`auraAI authentication API listening on port ${port}`);
    });
  }
}

module.exports = { createAuthServer };
