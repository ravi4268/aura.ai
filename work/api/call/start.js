const { validateSignedInUser, parseBody, safeJson } = require("../_auth");
const { createTelnyxCall } = require("../../server/telnyx");

module.exports = async function handler(request, response) {
  if (request.method !== "POST") {
    safeJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" });
    return;
  }
  if (!validateSignedInUser(request)) {
    safeJson(response, 401, { error: "Please sign in again before starting a phone call." });
    return;
  }

  let body;
  try { body = await parseBody(request); } catch (error) {
    safeJson(response, 400, { error: error.message });
    return;
  }

  try {
    const call = await createTelnyxCall(body?.to);
    safeJson(response, 200, call);
  } catch (error) {
    safeJson(response, error.statusCode || 502, { error: error.message || "Could not start the phone call." });
  }
};
