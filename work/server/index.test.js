"use strict";

const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const { createAuthServer } = require("./index");
const { createSignedSession, handleAudioTranscription } = require("../api/_auth");
const loginHandler = require("../api/auth/login");
const callStartHandler = require("../api/call/start");

const servers = [];

async function startServer(options = {}) {
  const server = createAuthServer({ password: "correct-horse-battery", ...options });
  servers.push(server);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  return `http://127.0.0.1:${server.address().port}`;
}

async function signIn(baseUrl) {
  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "correct-horse-battery" }),
  });
  assert.equal(response.status, 200);
  return response.headers.get("set-cookie").split(";")[0];
}

afterEach(async () => {
  await Promise.all(
    servers.splice(0).map(
      (server) =>
        new Promise((resolve, reject) => {
          server.close((error) => (error ? reject(error) : resolve()));
        }),
    ),
  );
});

test("login creates a session and logout invalidates it", async () => {
  const baseUrl = await startServer();

  const anonymousResponse = await fetch(`${baseUrl}/api/auth/session`);
  assert.equal(anonymousResponse.status, 401);

  const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "correct-horse-battery" }),
  });
  assert.equal(loginResponse.status, 200);
  assert.match(loginResponse.headers.get("set-cookie"), /HttpOnly/);
  assert.match(loginResponse.headers.get("set-cookie"), /SameSite=Strict/);
  assert.equal((await loginResponse.json()).user.name, "Sanidhya");

  const cookie = loginResponse.headers.get("set-cookie").split(";")[0];
  const sessionResponse = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { Cookie: cookie },
  });
  assert.equal(sessionResponse.status, 200);

  const logoutResponse = await fetch(`${baseUrl}/api/auth/logout`, {
    method: "POST",
    headers: { Cookie: cookie },
  });
  assert.equal(logoutResponse.status, 204);
  assert.match(logoutResponse.headers.get("set-cookie"), /Max-Age=0/);

  const invalidatedResponse = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { Cookie: cookie },
  });
  assert.equal(invalidatedResponse.status, 401);
});

test("login accepts trailing slashes and rejects invalid methods with 405", async () => {
  const baseUrl = await startServer();

  const trailingSlashLoginResponse = await fetch(`${baseUrl}/api/auth/login/`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "correct-horse-battery" }),
  });
  assert.equal(trailingSlashLoginResponse.status, 200);

  const logoutMethodResponse = await fetch(`${baseUrl}/api/auth/logout`);
  assert.equal(logoutMethodResponse.status, 405);
  assert.match(logoutMethodResponse.headers.get("allow") || "", /POST/i);
});

test("Vercel login handler works when the runtime rewrites the request URL", async () => {
  const previousPassword = process.env.SANIDHYA_PASSWORD;
  process.env.SANIDHYA_PASSWORD = "correct-horse-battery";
  const responseHeaders = {};
  const response = {
    setHeader(name, value) {
      responseHeaders[name.toLowerCase()] = value;
    },
    end(body) {
      this.body = body;
    },
  };

  try {
    await loginHandler({ method: "POST", url: "/", body: { password: "correct-horse-battery" } }, response);
  } finally {
    if (previousPassword === undefined) delete process.env.SANIDHYA_PASSWORD;
    else process.env.SANIDHYA_PASSWORD = previousPassword;
  }

  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { user: { name: "Sanidhya" } });
  assert.match(responseHeaders["set-cookie"], /HttpOnly/);
});

test("login rejects an incorrect password", async () => {
  const baseUrl = await startServer();

  const response = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "not-the-password" }),
  });

  assert.equal(response.status, 401);
  assert.match((await response.json()).error, /incorrect password/i);
});

test("session lookup rejects malformed cookies without crashing", async () => {
  const baseUrl = await startServer();

  const response = await fetch(`${baseUrl}/api/auth/session`, {
    headers: { Cookie: "aura_session=%zz" },
  });

  assert.equal(response.status, 401);
});

test("login rate limits repeated incorrect passwords", async () => {
  const baseUrl = await startServer();

  for (let attempt = 0; attempt < 5; attempt += 1) {
    const response = await fetch(`${baseUrl}/api/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ password: "not-the-password" }),
    });
    assert.equal(response.status, 401);
  }

  const rateLimitedResponse = await fetch(`${baseUrl}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: "not-the-password" }),
  });
  assert.equal(rateLimitedResponse.status, 429);
});

test("phone calling reports missing Telnyx configuration", async () => {
  const baseUrl = await startServer({ telnyxEnv: {} });
  const cookie = await signIn(baseUrl);
  const response = await fetch(`${baseUrl}/api/call/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ to: "+919876543210" }),
  });

  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /TELNYX_API_KEY/);
});

test("phone calling explains how to fix an invalid Call Control App webhook", async () => {
  const baseUrl = await startServer({
    telnyxEnv: {
      TELNYX_API_KEY: "test-api-key",
      TELNYX_CONNECTION_ID: "connection-test",
      TELNYX_AI_ASSISTANT_ID: "assistant-test",
      TELNYX_FROM_NUMBER: "+15005550006",
    },
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        errors: [{
          detail: "The requested connection_id (Call Control App ID) is either invalid or does not exist. Only Call Control Apps with valid webhook URL are accepted.",
        }],
      }),
    }),
  });
  const cookie = await signIn(baseUrl);
  const response = await fetch(`${baseUrl}/api/call/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ to: "+919876543210" }),
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /correct Call Control App ID.*public HTTPS endpoint.*\/api\/telnyx\/webhook/i);
});

test("Telnyx webhook acknowledges provider events without requiring a session", async () => {
  const baseUrl = await startServer();
  const response = await fetch(`${baseUrl}/api/telnyx/webhook`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ data: { event_type: "call.initiated" } }),
  });

  assert.equal(response.status, 204);
  assert.equal(await response.text(), "");
});

test("phone calling requires a valid Telnyx caller ID", async () => {
  const baseUrl = await startServer({
    telnyxEnv: {
      TELNYX_API_KEY: "test-api-key",
      TELNYX_CONNECTION_ID: "connection-test",
      TELNYX_AI_ASSISTANT_ID: "assistant-test",
      TELNYX_FROM_NUMBER: "+92 1639",
    },
  });
  const cookie = await signIn(baseUrl);
  const response = await fetch(`${baseUrl}/api/call/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ to: "+923001234567" }),
  });

  assert.equal(response.status, 503);
  const data = await response.json();
  assert.match(data.error, /voice-enabled Telnyx phone number/i);
});

test("phone calling does not expose rejected Telnyx credentials", async () => {
  const baseUrl = await startServer({
    telnyxEnv: {
      TELNYX_API_KEY: "wrong-api-key",
      TELNYX_CONNECTION_ID: "connection-test",
      TELNYX_AI_ASSISTANT_ID: "assistant-test",
      TELNYX_FROM_NUMBER: "+15005550006",
    },
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ errors: [{ code: "Unauthorized", detail: "Authentication failed" }] }),
    }),
  });
  const cookie = await signIn(baseUrl);
  const response = await fetch(`${baseUrl}/api/call/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ to: "+919216393256" }),
  });

  assert.equal(response.status, 502);
  const data = await response.json();
  assert.match(data.error, /authentication failed/i);
  assert.doesNotMatch(data.error, /wrong-api-key/i);
});

test("phone calling rejects invalid international numbers before contacting Telnyx", async () => {
  let contactedTelnyx = false;
  const baseUrl = await startServer({
    telnyxEnv: {
      TELNYX_API_KEY: "test-api-key",
      TELNYX_CONNECTION_ID: "connection-test",
      TELNYX_AI_ASSISTANT_ID: "assistant-test",
      TELNYX_FROM_NUMBER: "+15005550006",
    },
    fetchImpl: async () => {
      contactedTelnyx = true;
      throw new Error("Unexpected Telnyx request");
    },
  });
  const cookie = await signIn(baseUrl);
  const response = await fetch(`${baseUrl}/api/call/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ to: "+123" }),
  });

  assert.equal(response.status, 400);
  assert.match((await response.json()).error, /valid phone number in international format/i);
  assert.equal(contactedTelnyx, false);
});

test("authenticated phone call starts a Telnyx AI Assistant on the configured connection", async () => {
  let upstreamRequest;
  const baseUrl = await startServer({
    telnyxEnv: {
      TELNYX_API_KEY: "test-api-key",
      TELNYX_CONNECTION_ID: "connection-test",
      TELNYX_AI_ASSISTANT_ID: "assistant-test",
      TELNYX_FROM_NUMBER: "+15005550006",
    },
    fetchImpl: async (url, options) => {
      upstreamRequest = { url, options };
      return {
        ok: true,
        json: async () => ({ data: { call_control_id: "call-control-test", call_leg_id: "call-leg-test" } }),
      };
    },
  });
  const cookie = await signIn(baseUrl);
  const response = await fetch(`${baseUrl}/api/call/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ to: "+91 (987) 654-3210" }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), {
    callId: "call-control-test",
    status: "initiated",
    to: "+919876543210",
  });
  assert.equal(upstreamRequest.url, "https://api.telnyx.com/v2/calls");
  assert.equal(upstreamRequest.options.headers.Authorization, `Bearer test-api-key`);
  assert.deepEqual(JSON.parse(upstreamRequest.options.body), {
    connection_id: "connection-test",
    from: "+15005550006",
    to: "+919876543210",
    assistant: { id: "assistant-test" },
  });
});

test("phone calling reports Telnyx connection, caller, or assistant configuration errors", async () => {
  let contactedTelnyx = false;
  const baseUrl = await startServer({
    telnyxEnv: {
      TELNYX_API_KEY: "test-api-key",
      TELNYX_FROM_NUMBER: "+15005550006",
    },
    fetchImpl: async () => {
      contactedTelnyx = true;
      throw new Error("Unexpected Telnyx request");
    },
  });
  const cookie = await signIn(baseUrl);
  const response = await fetch(`${baseUrl}/api/call/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ to: "+919876543210" }),
  });
  assert.equal(response.status, 503);
  assert.match((await response.json()).error, /TELNYX_CONNECTION_ID.*TELNYX_AI_ASSISTANT_ID/i);
  assert.equal(contactedTelnyx, false);
});

test("Vercel call handler starts the configured Telnyx AI Assistant", async () => {
  const previousPassword = process.env.SANIDHYA_PASSWORD;
  const previousApiKey = process.env.TELNYX_API_KEY;
  const previousConnectionId = process.env.TELNYX_CONNECTION_ID;
  const previousAssistantId = process.env.TELNYX_AI_ASSISTANT_ID;
  const previousFromNumber = process.env.TELNYX_FROM_NUMBER;
  const previousFetch = global.fetch;
  process.env.SANIDHYA_PASSWORD = "correct-horse-battery";
  process.env.TELNYX_API_KEY = "test-api-key";
  process.env.TELNYX_CONNECTION_ID = "connection-test";
  process.env.TELNYX_AI_ASSISTANT_ID = "assistant-test";
  process.env.TELNYX_FROM_NUMBER = "+15005550006";
  global.fetch = async (url, options) => {
    assert.equal(url, "https://api.telnyx.com/v2/calls");
    assert.equal(options.headers.Authorization, `Bearer test-api-key`);
    return { ok: true, json: async () => ({ data: { call_control_id: "call-vercel-test" } }) };
  };
  const createResponse = () => ({
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; },
  });

  try {
    const cookie = `aura_session=${encodeURIComponent(createSignedSession({ name: "Sanidhya" }))}`;
    const callResponse = createResponse();
    await callStartHandler({
      method: "POST",
      headers: { cookie },
      body: { to: "+919876543210" },
    }, callResponse);
    assert.equal(callResponse.statusCode, 200);
    assert.deepEqual(JSON.parse(callResponse.body), {
      callId: "call-vercel-test",
      status: "initiated",
      to: "+919876543210",
    });
  } finally {
    if (previousPassword === undefined) delete process.env.SANIDHYA_PASSWORD;
    else process.env.SANIDHYA_PASSWORD = previousPassword;
    if (previousApiKey === undefined) delete process.env.TELNYX_API_KEY;
    else process.env.TELNYX_API_KEY = previousApiKey;
    if (previousConnectionId === undefined) delete process.env.TELNYX_CONNECTION_ID;
    else process.env.TELNYX_CONNECTION_ID = previousConnectionId;
    if (previousAssistantId === undefined) delete process.env.TELNYX_AI_ASSISTANT_ID;
    else process.env.TELNYX_AI_ASSISTANT_ID = previousAssistantId;
    if (previousFromNumber === undefined) delete process.env.TELNYX_FROM_NUMBER;
    else process.env.TELNYX_FROM_NUMBER = previousFromNumber;
    global.fetch = previousFetch;
  }
});

test("authenticated chat forwards conversation history to Gemini", async () => {
  let upstreamRequest;
  const baseUrl = await startServer({
    apiKey: "server-only-test-key",
    fetchImpl: async (url, options) => {
      upstreamRequest = { url, options };
      return {
        ok: true,
        json: async () => ({
          candidates: [{ content: { parts: [{ text: "Hello! How can I help?" }] } }],
        }),
      };
    },
  });
  const cookie = await signIn(baseUrl);
  const messages = [
    { role: "user", content: "Hi" },
    { role: "assistant", content: "Hello!" },
    { role: "user", content: "Can you help me plan my day?" },
  ];

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ messages }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { reply: "Hello! How can I help?" });
  const providerUrl = new URL(upstreamRequest.url);
  assert.equal(providerUrl.origin, "https://generativelanguage.googleapis.com");
  assert.equal(providerUrl.pathname, "/v1beta/models/gemini-3.8-flash:generateContent");
  assert.equal(providerUrl.searchParams.has("key"), false);
  assert.equal(upstreamRequest.options.headers["x-goog-api-key"], "server-only-test-key");
  assert.equal(upstreamRequest.options.headers.Authorization, undefined);
  const requestBody = JSON.parse(upstreamRequest.options.body);
  assert.match(requestBody.systemInstruction.parts[0].text, /reply in the language the user uses/i);
  assert.match(requestBody.systemInstruction.parts[0].text, /answer the user's actual question directly/i);
  assert.match(requestBody.systemInstruction.parts[0].text, /never invent facts/i);
  assert.deepEqual(requestBody.contents, [
    { role: "user", parts: [{ text: "Hi" }] },
    { role: "model", parts: [{ text: "Hello!" }] },
    { role: "user", parts: [{ text: "Can you help me plan my day?" }] },
  ]);
});

test("greetings receive a reply without calling Gemini or requiring an API key", async () => {
  const baseUrl = await startServer({
    apiKey: "",
    fetchImpl: async () => {
      throw new Error("Gemini should not be called for a greeting");
    },
  });
  const cookie = await signIn(baseUrl);

  for (const greeting of ["hi", "हाय"]) {
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ messages: [{ role: "user", content: greeting }] }),
    });

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { reply: "Hi! How can I help?" });
  }
});

test("chat rejects anonymous requests and reports missing Gemini configuration", async () => {
  const baseUrl = await startServer({ apiKey: "", fetchImpl: async () => { throw new Error("Should not be called"); } });

  const anonymousResponse = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "Can you help me?" }] }),
  });
  assert.equal(anonymousResponse.status, 401);

  const cookie = await signIn(baseUrl);
  const unconfiguredResponse = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ messages: [{ role: "user", content: "Can you help me?" }] }),
  });
  assert.equal(unconfiguredResponse.status, 503);
  assert.match((await unconfiguredResponse.json()).error, /GEMINI_API_KEY/);
});

test("chat gives actionable guidance when Gemini rejects the API key", async () => {
  const baseUrl = await startServer({
    apiKey: "server-only-test-key",
    fetchImpl: async () => ({
      ok: false,
      status: 400,
      json: async () => ({
        error: {
          status: "API_KEY_INVALID",
          message: "API key not valid. Please pass a valid API key.",
        },
      }),
    }),
  });
  const cookie = await signIn(baseUrl);

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ messages: [{ role: "user", content: "Check my API key" }] }),
  });
  const data = await response.json();

  assert.equal(response.status, 502);
  assert.match(data.error, /GEMINI_API_KEY/);
  assert.doesNotMatch(data.error, /server-only-test-key/);
});

test("chat explains provider rate limits and exhausted API quota", async () => {
  const providerErrors = [
    {
      error: { error: { status: "RESOURCE_EXHAUSTED" } },
      expectedMessage: /quota or rate limit/i,
    },
  ];

  for (const providerError of providerErrors) {
    const baseUrl = await startServer({
      apiKey: "server-only-test-key",
      fetchImpl: async () => ({
        ok: false,
        status: 429,
        json: async () => providerError.error,
      }),
    });
    const cookie = await signIn(baseUrl);
    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Cookie: cookie },
      body: JSON.stringify({ messages: [{ role: "user", content: "Tell me a story" }] }),
    });
    const data = await response.json();

    assert.equal(response.status, 429);
    assert.match(data.error, providerError.expectedMessage);
  }
});

test("Gemini conversations can continue when the bounded history begins with an assistant turn", async () => {
  let requestBody;
  const baseUrl = await startServer({
    apiKey: "server-only-test-key",
    fetchImpl: async (_url, options) => {
      requestBody = JSON.parse(options.body);
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "Done." }] } }] }),
      };
    },
  });
  const cookie = await signIn(baseUrl);

  const response = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      messages: [
        { role: "assistant", content: "Earlier answer outside the current window." },
        { role: "user", content: "Continue from here." },
      ],
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(requestBody.contents, [
    { role: "user", parts: [{ text: "Continue from here." }] },
  ]);
});

test("authenticated browser audio is transcribed by Gemini without exposing the API key", async () => {
  let upstreamRequest;
  const baseUrl = await startServer({
    apiKey: "server-only-test-key",
    fetchImpl: async (url, options) => {
      upstreamRequest = { url, options };
      return {
        ok: true,
        json: async () => ({ candidates: [{ content: { parts: [{ text: "नमस्ते, कैसे हैं?" }] } }] }),
      };
    },
  });
  const cookie = await signIn(baseUrl);
  const response = await fetch(`${baseUrl}/api/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      audioBase64: Buffer.from("sample audio").toString("base64"),
      mimeType: "audio/webm;codecs=opus",
      durationMs: 1200,
    }),
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { transcript: "नमस्ते, कैसे हैं?" });
  const providerUrl = new URL(upstreamRequest.url);
  assert.equal(providerUrl.origin, "https://generativelanguage.googleapis.com");
  assert.equal(providerUrl.searchParams.has("key"), false);
  assert.equal(upstreamRequest.options.headers["x-goog-api-key"], "server-only-test-key");
  const providerBody = JSON.parse(upstreamRequest.options.body);
  assert.match(providerBody.contents[0].parts[0].text, /transcribe the audio exactly/i);
  assert.deepEqual(providerBody.contents[0].parts[1].inlineData, {
    mimeType: "audio/webm",
    data: Buffer.from("sample audio").toString("base64"),
  });
});

test("audio transcription rejects anonymous, unsupported, oversized, and over-duration requests", async () => {
  let providerCalled = false;
  const baseUrl = await startServer({
    apiKey: "server-only-test-key",
    fetchImpl: async () => {
      providerCalled = true;
      throw new Error("Invalid audio should not reach Gemini");
    },
  });
  const audio = Buffer.from("sample audio").toString("base64");
  const anonymousResponse = await fetch(`${baseUrl}/api/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ audioBase64: audio, mimeType: "audio/webm", durationMs: 1000 }),
  });
  assert.equal(anonymousResponse.status, 401);

  const cookie = await signIn(baseUrl);
  const contentTypeResponse = await fetch(`${baseUrl}/api/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "text/plain", Cookie: cookie },
    body: "not json",
  });
  assert.equal(contentTypeResponse.status, 415);

  const unsupportedResponse = await fetch(`${baseUrl}/api/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ audioBase64: audio, mimeType: "text/plain", durationMs: 1000 }),
  });
  assert.equal(unsupportedResponse.status, 415);
  assert.match((await unsupportedResponse.json()).error, /supported audio/i);

  const durationResponse = await fetch(`${baseUrl}/api/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ audioBase64: audio, mimeType: "audio/webm", durationMs: 20_001 }),
  });
  assert.equal(durationResponse.status, 400);
  assert.match((await durationResponse.json()).error, /20 seconds/i);

  const malformedResponse = await fetch(`${baseUrl}/api/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ audioBase64: "not base64!", mimeType: "audio/webm", durationMs: 1000 }),
  });
  assert.equal(malformedResponse.status, 400);

  const oversizedAudio = Buffer.alloc(2 * 1024 * 1024 + 1).toString("base64");
  const oversizedResponse = await fetch(`${baseUrl}/api/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ audioBase64: oversizedAudio, mimeType: "audio/webm", durationMs: 1000 }),
  });
  assert.equal(oversizedResponse.status, 413);
  assert.equal(providerCalled, false);
});

test("audio transcription returns explicit Gemini provider errors", async () => {
  const baseUrl = await startServer({
    apiKey: "server-only-test-key",
    fetchImpl: async () => ({
      ok: false,
      status: 429,
      json: async () => ({ error: { status: "RESOURCE_EXHAUSTED" } }),
    }),
  });
  const cookie = await signIn(baseUrl);
  const response = await fetch(`${baseUrl}/api/voice/transcribe`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({
      audioBase64: Buffer.from("sample audio").toString("base64"),
      mimeType: "audio/webm",
      durationMs: 1000,
    }),
  });
  assert.equal(response.status, 429);
  assert.match((await response.json()).error, /quota or rate limit/i);
});

test("Vercel audio transcription handler requires a signed-in session and returns its transcript", async () => {
  const previousPassword = process.env.SANIDHYA_PASSWORD;
  const previousKey = process.env.GEMINI_API_KEY;
  const previousFetch = global.fetch;
  process.env.SANIDHYA_PASSWORD = "correct-horse-battery";
  process.env.GEMINI_API_KEY = "server-only-test-key";
  global.fetch = async (_url, options) => {
    assert.equal(options.headers["x-goog-api-key"], "server-only-test-key");
    return {
      ok: true,
      json: async () => ({ candidates: [{ content: { parts: [{ text: "hello there" }] } }] }),
    };
  };
  const request = {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: {
      audioBase64: Buffer.from("sample audio").toString("base64"),
      mimeType: "audio/webm",
      durationMs: 1000,
    },
  };
  const response = {
    headers: {},
    setHeader(name, value) { this.headers[name.toLowerCase()] = value; },
    end(body) { this.body = body; },
  };

  try {
    await handleAudioTranscription(request, response);
    assert.equal(response.statusCode, 401);

    request.headers.cookie = `aura_session=${encodeURIComponent(createSignedSession({ name: "Sanidhya" }))}`;
    await handleAudioTranscription(request, response);
  } finally {
    if (previousPassword === undefined) delete process.env.SANIDHYA_PASSWORD;
    else process.env.SANIDHYA_PASSWORD = previousPassword;
    if (previousKey === undefined) delete process.env.GEMINI_API_KEY;
    else process.env.GEMINI_API_KEY = previousKey;
    global.fetch = previousFetch;
  }
  assert.equal(response.statusCode, 200);
  assert.deepEqual(JSON.parse(response.body), { transcript: "hello there" });
});
