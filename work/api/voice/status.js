module.exports = async function handler(request, response) {
  response.statusCode = 204;
  response.setHeader("Cache-Control", "no-store");
  response.end();
};
