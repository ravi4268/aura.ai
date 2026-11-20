const { safeJson } = require("../_auth");

module.exports = function handler(request, response) {
  if (request.method !== "POST") {
    safeJson(response, 405, { error: "Method not allowed" }, { Allow: "POST" });
    return;
  }

  safeJson(response, 204, {});
};
