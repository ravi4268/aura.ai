# auraAI

A responsive AI workspace with a dark dashboard and a Node.js login API.

## Deploy to Vercel

This app is ready for Vercel deployment. In the Vercel Project Settings > Environment Variables, add:

```env
SANIDHYA_PASSWORD=choose_a_private_password_at_least_8_characters
GEMINI_API_KEY=your_google_ai_studio_api_key
GEMINI_MODEL=gemini-3.8-flash
```

Set the Vercel project Root Directory to `work` (the folder containing this `package.json`), then redeploy. Vercel detects the `api/` serverless functions automatically; `vercel.json` only provides the client-side route fallback.

The application expects the password to be set in the deployment environment for login to work. The frontend is served from the `build` folder and the `/api/*` routes are handled by the files in the `api/` folder.

## Run locally

Use Node.js 18 or newer. Put your Google AI Studio API key in the ignored `.env` file in the project directory:

```env
GEMINI_API_KEY=your_google_ai_studio_api_key
```

The backend loads this file automatically. Do not commit it or put the key in React code. Start the API and React app in separate terminals from the project directory.

Sending `hi`, `hello`, or `hey` gets a quick greeting without using Gemini quota. Other messages are sent to Gemini and need an active `GEMINI_API_KEY`.

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

The API requires a password of at least eight characters. Sessions use an HttpOnly, SameSite=Strict cookie and are held in memory; restarting the server signs users out. Production deployments must use HTTPS. Use a shared persistent session store before running multiple API instances.

## Authentication API

- `GET /api/auth/session` — returns the signed-in user or `401`.
- `POST /api/auth/login` — accepts JSON `{ "password": "..." }`.
- `POST /api/auth/logout` — invalidates the current session.
- `POST /api/chat` — accepts the signed-in conversation as `{ "messages": [{ "role": "user" | "assistant", "content": "..." }] }` and returns `{ "reply": "..." }`.

Run the API tests with `npm run test:server`. Run the frontend tests with `npm test -- --watchAll=false`.
