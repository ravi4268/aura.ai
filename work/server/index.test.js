"use strict";

const assert = require("node:assert/strict");
const { afterEach, test } = require("node:test");
const { createAuthServer } = require("./index");

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
  assert.equal(providerUrl.pathname, "/v1beta/models/gemini-2.5-flash:generateContent");
  assert.equal(providerUrl.searchParams.has("key"), false);
  assert.equal(upstreamRequest.options.headers["x-goog-api-key"], "server-only-test-key");
  assert.equal(upstreamRequest.options.headers.Authorization, undefined);
  const requestBody = JSON.parse(upstreamRequest.options.body);
  assert.match(requestBody.systemInstruction.parts[0].text, /reply in the language the user uses/i);
  assert.deepEqual(requestBody.contents, [
    { role: "user", parts: [{ text: "Hi" }] },
    { role: "model", parts: [{ text: "Hello!" }] },
    { role: "user", parts: [{ text: "Can you help me plan my day?" }] },
  ]);
});

test("chat rejects anonymous requests and reports missing Gemini configuration", async () => {
  const baseUrl = await startServer({ apiKey: "", fetchImpl: async () => { throw new Error("Should not be called"); } });

  const anonymousResponse = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }),
  });
  assert.equal(anonymousResponse.status, 401);

  const cookie = await signIn(baseUrl);
  const unconfiguredResponse = await fetch(`${baseUrl}/api/chat`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: cookie },
    body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }),
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
    body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }),
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
      body: JSON.stringify({ messages: [{ role: "user", content: "Hi" }] }),
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
