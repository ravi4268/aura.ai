const { handleAudioTranscription } = require("../_auth");

module.exports = async function handler(request, response) {
  await handleAudioTranscription(request, response);
};

module.exports.config = {
  api: {
    bodyParser: {
      sizeLimit: "3mb",
    },
  },
};
