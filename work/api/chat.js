const { handleChat } = require("./_auth");

module.exports = async function handler(request, response) {
  await handleChat(request, response);
};
