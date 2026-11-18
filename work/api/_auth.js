const crypto = require("node:crypto");
const { DEFAULT_GEMINI_MODEL, generateGeminiReply, getLocalGreetingReply } = require("../server/gemini");

const SESSION_COOKIE = "aura_session";
const SESSION_DURATION_MS = 8 * 60 * 60 * 1000;
const MAX_CHAT_MESSAGES = 20;
const MAX_CHAT_MESSAGE_LENGTH = 4000;

function getPasswordHash(password) {
  const salt = crypto.createHash("sha256").update("auraAI:Sanidhya:v1").digest();
  return crypto.scryptSync(password, salt, 64);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    if (req.body && typeof req.body === "object") {
      resolve(req.body);
      return;
    }

    let rawBody = "";
    req.on("data", (chunk) => {
      rawBody += chunk;
    });
    req.on("end", () => {
      try {
        resolve(rawBody ? JSON.parse(rawBody) : {});
      } catch {
        reject(Object.assign(new Error("Request body must be valid JSON"), { statusCode: 400 }));
      }
    });
    req.on("error", reject);
  });
}

function getCookieValue(request, name) {
  const cookieHeader = request.headers.cookie || "";
  const cookie = cookieHeader
    .split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`));

  return cookie ? decodeURIComponent(cookie.slice(name.length + 1)) : "";
}

function createSignedSession(payload) {
  const secret = process.env.SANIDHYA_PASSWORD || "";
  const body = Buffer.from(JSON.stringify({ ...payload, exp: Date.now() + SESSION_DURATION_MS })).toString("base64url");
  const signature = crypto.createHmac("sha256", secret).update(body).digest("base64url");
  return `${body}.${signature}`;
}

function verifySignedSession(token) {
  if (!token || typeof token !== "string") return null;

  const [body, signature] = token.split(".");
  if (!body || !signature) return null;

  const secret = process.env.SANIDHYA_PASSWORD || "";
  const expectedSignature = crypto.createHmac("sha256", secret).update(body).digest("base64url");

  try {
    if (!crypto.timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature))) return null;
    const parsed = JSON.parse(Buffer.from(body, "base64url").toString("utf8"));
    if (!parsed || typeof parsed.name !== "string" || parsed.exp <= Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

function setSessionCookie(sessionToken) {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=${encodeURIComponent(sessionToken)}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${Math.floor(SESSION_DURATION_MS / 1000)}${secure}`;
}

function clearSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `${SESSION_COOKIE}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0${secure}`;
}

function safeJson(response, statusCode, payload, headers = {}) {
  response.statusCode = statusCode;
  if (statusCode === 204) {
    response.setHeader("Cache-Control", "no-store");
    response.setHeader("X-Content-Type-Options", "nosniff");
    Object.entries(headers).forEach(([key, value]) => response.setHeader(key, value));
    response.end();
    return;
  }

  response.setHeader("Content-Type", "application/json; charset=utf-8");
  response.setHeader("Cache-Control", "no-store");
  response.setHeader("X-Content-Type-Options", "nosniff");
  Object.entries(headers).forEach(([key, value]) => response.setHeader(key, value));
  response.end(JSON.stringify(payload));
}

function validateSignedInUser(request) {
  const token = getCookieValue(request, SESSION_COOKIE);
  const session = verifySignedSession(token);
  if (!session || session.name !== "Sanidhya") return null;
  return session;
}

async function handleAuthentication(request, response, routePath) {
  const url = new URL(request.url || "/", "https://example.com");
  const { method } = request;
  const pathname = (routePath || url.pathname || "/").replace(/\/+$/, "") || "/";
  const allowedRoutes = new Set(["/api/auth/login", "/api/auth/logout", "/api/auth/session"]);

  if (!allowedRoutes.has(pathname)) {
    safeJson(response, 404, { error: "Not found" });
    return;
  }

  if (pathname === "/api/auth/session") {
    if (method !== "GET") {
      safeJson(response, 405, { error: "Method not allowed" }, { Allow: "GET" });
      return;
    }

    const session = validateSignedInUser(request);
    if (!session) {
      safeJson(response, 401, { error: "Not authenticated" });
      return;
    }

    safeJson(response, 200, { user: { name: "Sanidhya" } });
    return;
  }

  if (pathname === "/api/auth/logout") {
    if (method !== "POST") {
      safeJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" });
      return;
    }

    safeJson(response, 204, null, { "Set-Cookie": clearSessionCookie() });
    return;
  }

  if (pathname === "/api/auth/login") {
    if (method !== "POST") {
      safeJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" });
      return;
    }
  } else {
    safeJson(response, 404, { error: "Not found" });
    return;
  }

  let body;
  try {
    body = await parseBody(request);
  } catch (error) {
    safeJson(response, error.statusCode || 400, { error: error.message });
    return;
  }

  const submittedPassword = body && body.password;
  if (typeof submittedPassword !== "string" || submittedPassword.length > 1024) {
    safeJson(response, 400, { error: "Enter a valid password." });
    return;
  }

  const password = process.env.SANIDHYA_PASSWORD;
  if (!password) {
    safeJson(response, 500, { error: "Authentication is not configured on this deployment." });
    return;
  }

  const expectedHash = getPasswordHash(password);
  const submittedHash = crypto.scryptSync(submittedPassword, crypto.createHash("sha256").update("auraAI:Sanidhya:v1").digest(), 64);

  if (!crypto.timingSafeEqual(expectedHash, submittedHash)) {
    safeJson(response, 401, { error: "Incorrect password. Please try again." });
    return;
  }

  const sessionToken = createSignedSession({ name: "Sanidhya" });
  safeJson(response, 200, { user: { name: "Sanidhya" } }, { "Set-Cookie": setSessionCookie(sessionToken) });
}

async function handleChat(request, response) {
  if (request.method !== "POST") {
    safeJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" });
    return;
  }

  const session = validateSignedInUser(request);
  if (!session) {
    safeJson(response, 401, { error: "Please sign in again to continue chatting." });
    return;
  }

  let body;
  try {
    body = await parseBody(request);
  } catch (error) {
    safeJson(response, error.statusCode || 400, { error: error.message });
    return;
  }

  if (!body || !Array.isArray(body.messages) || body.messages.length === 0 || body.messages.length > MAX_CHAT_MESSAGES) {
    safeJson(response, 400, { error: "Send a valid message to continue the conversation." });
    return;
  }

  const lastMessage = body.messages[body.messages.length - 1];
  if (!lastMessage || lastMessage.role !== "user" || typeof lastMessage.content !== "string" || !lastMessage.content.trim() || lastMessage.content.length > MAX_CHAT_MESSAGE_LENGTH) {
    safeJson(response, 400, { error: "Send a valid message to continue the conversation." });
    return;
  }

  const isValidConversation = body.messages.every((message) => message && ["user", "assistant"].includes(message.role) && typeof message.content === "string" && message.content.trim() && message.content.length <= MAX_CHAT_MESSAGE_LENGTH);
  if (!isValidConversation) {
    safeJson(response, 400, { error: "Send a valid message to continue the conversation." });
    return;
  }

  const greetingReply = getLocalGreetingReply(body.messages);
  if (greetingReply) {
    safeJson(response, 200, { reply: greetingReply });
    return;
  }

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    safeJson(response, 503, { error: "AI is not configured. Add GEMINI_API_KEY to the server environment." });
    return;
  }

  try {
    const reply = await generateGeminiReply({
      apiKey,
      model: process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL,
      messages: body.messages,
    });

    safeJson(response, 200, { reply });
  } catch (error) {
    if (error.statusCode) {
      if (error.providerStatus) {
        console.error("Gemini request failed with status:", error.providerStatus);
      }
      safeJson(response, error.statusCode, { error: error.publicMessage || error.message });
      return;
    }
    console.error("AI chat request failed:", error);
    safeJson(response, 502, { error: "Could not reach the AI service. Please try again." });
  }
}

module.exports = {
  SESSION_COOKIE,
  getPasswordHash,
  parseBody,
  getCookieValue,
  createSignedSession,
  verifySignedSession,
  setSessionCookie,
  clearSessionCookie,
  safeJson,
  handleAuthentication,
  handleChat,
};
