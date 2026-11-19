# auraAI

A responsive AI workspace with a dark dashboard and a Node.js login API.

## Deploy to Vercel

This app is ready for Vercel deployment. In the Vercel Project Settings > Environment Variables, add:

```env
SANIDHYA_PASSWORD=1234
GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-3.8-flash
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
PUBLIC_BASE_URL=https://your-public-domain.example
```

Set the Vercel project Root Directory to `work` (the folder containing this `package.json`), then redeploy. Add the Twilio values and `GEMINI_API_KEY` in Vercel Project Settings > Environment Variables for each environment you deploy (Production, Preview, or Development). A local `.env` file is ignored by Git and is not copied to Vercel. Redeploy after changing environment variables. `TWILIO_FROM_NUMBER` must be a voice-enabled Twilio number in E.164 format (for example `+14155552671`). `PUBLIC_BASE_URL` should be your deployed HTTPS domain; if omitted, the app uses Vercel's `VERCEL_URL`. Vercel detects the `api/` serverless functions automatically; `vercel.json` only provides the client-side route fallback.

The application expects the password to be set in the deployment environment for login to work. The frontend is served from the `build` folder and the `/api/*` routes are handled by the files in the `api/` folder.

## Run locally

Use Node.js 18 or newer. Put your Google AI Studio API key in the ignored `.env` file in the project directory:

```env
GEMINI_API_KEY=your_google_ai_studio_api_key
TWILIO_ACCOUNT_SID=your_twilio_account_sid
TWILIO_AUTH_TOKEN=your_twilio_auth_token
TWILIO_FROM_NUMBER=+1xxxxxxxxxx
PUBLIC_BASE_URL=https://your-public-tunnel.example
```

The backend loads this file automatically. Keep real credentials only in the ignored `.env` file or hosting-provider secret settings; never put them in React code or commit them. For local phone calls, run a public HTTPS tunnel such as `ngrok http 5001`, then set `PUBLIC_BASE_URL` to the HTTPS URL it prints. The tunnel must forward to the local backend (port 5001); `localhost` is not reachable by Twilio.

Sending `hi`, `hello`, or `hey` gets a quick greeting without using Gemini quota. Other messages are sent to Gemini and need an active `GEMINI_API_KEY`.

Click the microphone button beside the message box to start a live browser voice conversation with auraAI. Allow microphone access; short audio recordings (up to 20 seconds and 2 MB per utterance) are sent to the signed-in server endpoint and transcribed by Gemini. The browser speaks the AI replies in Hindi. This uses the browser microphone and speaker but not browser-native speech recognition or Twilio, and does not make a phone call. Microphone access requires localhost or an HTTPS deployment. Muting or ending the call stops capture and cancels any pending transcription upload.

Click the phone button beside the message box and enter a full international number (for example `+919876543210`) to have Twilio call that phone. Answer the call to talk with auraAI in Hindi. This separate phone-call feature requires valid matching Twilio credentials; the browser voice conversation still works without them. Twilio trial accounts can call only verified destination numbers; calls may incur charges.

In the Twilio Console, copy the Account SID and its matching Auth Token into the server environment and use a voice-enabled Twilio phone number for `TWILIO_FROM_NUMBER`. This is the Twilio caller ID, not the personal destination number entered in the call dialog. If Twilio returns error 20003, verify that `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN` are from the same account; copy or regenerate that account's Auth Token, replace the server environment value, then restart the local server or redeploy. Do not share or commit the Auth Token. Enter the destination in full international format; Indian mobile numbers use `+91` followed by all 10 mobile digits (for example `+919876543210`). Outbound calls use the app's voice webhook automatically. To also receive calls on your Twilio number, open that number's Voice Configuration and set "A call comes in" to `https://your-public-domain.example/api/voice/answer` with HTTP POST. Make sure `GEMINI_API_KEY` is also configured in the server environment so auraAI can generate spoken replies.

In PowerShell terminal 1, set the account password and start the API:

```powershell
$env:SANIDHYA_PASSWORD = '<your private password>'
# Optional: choose another Gemini model
$env:GEMINI_MODEL = 'gemini-3.8-flash'
npm run server
```

In PowerShell terminal 2:

```powershell
npm start
```

Open the URL printed by `npm start` (usually [http://localhost:3000](http://localhost:3000)). If that port is already in use, Create React App starts on the next available port, such as `http://localhost:3001`; make sure the browser is showing **auraAI**, not another app already using port 3000. The React development server proxies `/api` requests to the local API on port 5001. The password and Gemini API key are read only by the backend; do not put them in React code or commit them to the repository. Without `GEMINI_API_KEY`, chat displays a clear configuration error. If Gemini rejects the key, replace it in `.env` with a valid active key and restart the backend.

After updating the backend code, stop any older `npm run server` process with `Ctrl+C` and start it again with the environment variables above. An older server process does not load the new `/api/chat` route until it is restarted.

If another message reports that the Gemini API quota or rate limit was reached, check your Google AI Studio project quota and billing settings. For a temporary rate limit, wait briefly before sending it again. Messages already sent remain in the conversation, and you can continue chatting when the provider is available.

The API requires a password of at least four characters. Sessions use an HttpOnly, SameSite=Strict cookie and are held in memory; restarting the server signs users out. Production deployments must use HTTPS. Use a shared persistent session store before running multiple API instances.

## Authentication API

- `GET /api/auth/session` — returns the signed-in user or `401`.
- `POST /api/auth/login` — accepts JSON `{ "password": "..." }`.
- `POST /api/auth/logout` — invalidates the current session.
- `POST /api/chat` — accepts the signed-in conversation as `{ "messages": [{ "role": "user" | "assistant", "content": "..." }] }` and returns `{ "reply": "..." }`.
- `POST /api/voice/transcribe` — accepts signed-in audio as `{ "audioBase64": "...", "mimeType": "audio/webm", "durationMs": 1200 }` and returns `{ "transcript": "..." }`. Audio is limited to 2 MB and 20 seconds; the Gemini API key remains server-side.

Run the API tests with `npm run test:server`. Run the frontend tests with `npm test -- --watchAll=false`.
