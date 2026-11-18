const { handleAuthentication } = require("../_auth");

module.exports = async function handler(request, response) {
  await handleAuthentication(request, response, "/api/auth/logout");
};
