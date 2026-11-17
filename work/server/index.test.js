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

test("authenticated chat forwards conversation history to the AI provider", async () => {
  let upstreamRequest;
  const baseUrl = await startServer({
    apiKey: "server-only-test-key",
    fetchImpl: async (url, options) => {
      upstreamRequest = { url, options };
      return {
        ok: true,
        json: async () => ({ choices: [{ message: { content: "Hello! How can I help?" } }] }),
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
  assert.equal(upstreamRequest.url, "https://api.openai.com/v1/chat/completions");
  assert.equal(upstreamRequest.options.headers.Authorization, "Bearer server-only-test-key");
  assert.deepEqual(JSON.parse(upstreamRequest.options.body).messages.slice(1), messages);
});

test("chat rejects anonymous requests and reports missing AI configuration", async () => {
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
  assert.match((await unconfiguredResponse.json()).error, /OPENAI_API_KEY/);
});

test("chat gives actionable guidance when the AI provider rejects the API key", async () => {
  const baseUrl = await startServer({
    apiKey: "server-only-test-key",
    fetchImpl: async () => ({
      ok: false,
      status: 401,
      json: async () => ({ error: { message: "Incorrect API key provided: server-only-test-key" } }),
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
  assert.match(data.error, /OPENAI_API_KEY in \.env/);
  assert.doesNotMatch(data.error, /server-only-test-key/);
});
