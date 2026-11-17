import { fireEvent, render, screen } from "@testing-library/react";
import App from "./App";

let loggedIn;

beforeEach(() => {
  loggedIn = false;
  jest.spyOn(window, "alert").mockImplementation(() => {});
  global.fetch = jest.fn((url, options = {}) => {
    if (url === "/api/auth/session") {
      return Promise.resolve({
        ok: loggedIn,
        status: loggedIn ? 200 : 401,
        json: () => Promise.resolve({ user: { name: "Sanidhya" } }),
      });
    }

    if (url === "/api/auth/login") {
      const { password } = JSON.parse(options.body);
      if (password !== "test-password") {
        return Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ error: "Incorrect password. Please try again." }),
        });
      }
      loggedIn = true;
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ user: { name: "Sanidhya" } }),
      });
    }

    if (url === "/api/auth/logout") {
      loggedIn = false;
      return Promise.resolve({ ok: true, status: 204 });
    }

    if (url === "/api/chat") {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: () => Promise.resolve({ reply: "Hello! How can I help?" }),
      });
    }

    return Promise.reject(new Error(`Unexpected request: ${url}`));
  });
});

async function signIn() {
  fireEvent.change(await screen.findByLabelText("Password"), {
    target: { value: "test-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
  await screen.findByText(/a little help can/i);
}

test("shows the named login screen and signs in to the responsive AI dashboard", async () => {
  render(<App />);

  expect(await screen.findByRole("heading", { name: /welcome back, sanidhya/i })).toBeInTheDocument();
  await signIn();
  expect(screen.getByRole("button", { name: /log out/i })).toBeInTheDocument();
  expect(screen.getByRole("button", { name: /open sidebar/i })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/auth/login",
    expect.objectContaining({ method: "POST", credentials: "same-origin" }),
  );
});

test("shows backend login errors without opening the dashboard", async () => {
  render(<App />);

  fireEvent.change(await screen.findByLabelText("Password"), {
    target: { value: "wrong-password" },
  });
  fireEvent.click(screen.getByRole("button", { name: "Sign in" }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/incorrect password/i);
  expect(screen.queryByText(/a little help can/i)).not.toBeInTheDocument();
});

test("login password can be shown and hidden without changing its value", async () => {
  render(<App />);
  const password = await screen.findByLabelText("Password");

  expect(password).toHaveAttribute("type", "password");
  fireEvent.change(password, { target: { value: "sanidhya2005" } });
  fireEvent.click(screen.getByRole("button", { name: "Show password" }));

  expect(password).toHaveAttribute("type", "text");
  expect(password).toHaveValue("sanidhya2005");
  fireEvent.click(screen.getByRole("button", { name: "Hide password" }));
  expect(password).toHaveAttribute("type", "password");
  expect(password).toHaveValue("sanidhya2005");
});

test("suggestions fill the prompt and the AI replies to submitted messages", async () => {
  render(<App />);
  await signIn();

  fireEvent.click(screen.getByRole("button", { name: /plan something/i }));
  const prompt = screen.getByRole("textbox", { name: /message ai/i });
  expect(prompt).toHaveValue("Help me plan a perfect weekend");

  fireEvent.click(screen.getByRole("button", { name: /send message/i }));
  expect(screen.getByText("Help me plan a perfect weekend", { selector: ".message-row-user p" })).toBeInTheDocument();
  expect(await screen.findByText("Hello! How can I help?")).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/chat",
    expect.objectContaining({
      method: "POST",
      credentials: "same-origin",
      body: JSON.stringify({
        messages: [{ role: "user", content: "Help me plan a perfect weekend" }],
      }),
    }),
  );
});

test("AI request errors are shown in the conversation", async () => {
  render(<App />);
  await signIn();
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status: 503,
    json: () => Promise.resolve({ error: "AI is not configured. Add OPENAI_API_KEY to the server environment." }),
  });

  fireEvent.change(screen.getByRole("textbox", { name: /message ai/i }), {
    target: { value: "Hi" },
  });
  fireEvent.click(screen.getByRole("button", { name: /send message/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/add openai_api_key/i);
});

test("outdated backend shows a clear restart message instead of Not found", async () => {
  render(<App />);
  await signIn();
  global.fetch.mockResolvedValueOnce({
    ok: false,
    status: 404,
    json: () => Promise.resolve({ error: "Not found" }),
  });

  fireEvent.change(screen.getByRole("textbox", { name: /message ai/i }), {
    target: { value: "hi" },
  });
  fireEvent.click(screen.getByRole("button", { name: /send message/i }));

  expect(await screen.findByRole("alert")).toHaveTextContent(/restart the auraai backend/i);
  expect(screen.queryByText("Not found")).not.toBeInTheDocument();
});

test("logging out ends the session and returns to the login screen", async () => {
  render(<App />);
  await signIn();

  fireEvent.click(screen.getByRole("button", { name: /log out/i }));
  expect(await screen.findByRole("heading", { name: /welcome back, sanidhya/i })).toBeInTheDocument();
  expect(global.fetch).toHaveBeenCalledWith(
    "/api/auth/logout",
    expect.objectContaining({ method: "POST" }),
  );
});

test("Explore AI tools and Library projects open the corresponding chat", async () => {
  render(<App />);
  await signIn();

  fireEvent.click(screen.getByRole("button", { name: /explore ai/i }));
  expect(screen.getByRole("heading", { name: "Explore AI" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: /writing assistant/i }));
  expect(screen.getByRole("textbox", { name: /message ai/i })).toHaveValue("Help me write something great");

  fireEvent.click(screen.getByRole("button", { name: /library/i }));
  expect(screen.getByRole("heading", { name: "Projects" })).toBeInTheDocument();
  fireEvent.click(screen.getAllByRole("button", { name: /open project/i })[0]);
  expect(screen.getByText("Help me plan a perfect weekend")).toBeInTheDocument();
  expect(await screen.findByText("Hello! How can I help?")).toBeInTheDocument();
});

test("selecting a plan accepts a demo OTP without sending SMS", async () => {
  render(<App />);
  await signIn();

  fireEvent.click(screen.getByRole("button", { name: /make more with ai/i }));
  expect(screen.getByRole("heading", { name: "Choose your plan" })).toBeInTheDocument();
  fireEvent.click(screen.getByRole("button", { name: "Choose Pro" }));
  fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "9876543210" } });
  expect(window.alert).toHaveBeenCalledWith(expect.stringMatching(/your demo otp is \d{6}\. no sms was sent/i));
  const generatedOtp = window.alert.mock.calls[0][0].match(/\d{6}/)[0];
  fireEvent.change(screen.getByLabelText("6-digit OTP"), { target: { value: generatedOtp } });
  fireEvent.click(screen.getByRole("button", { name: "Continue with Pro" }));

  expect(await screen.findByRole("status")).toHaveTextContent(/no payment or sms was processed/i);
  expect(screen.getByText("Pro plan")).toBeInTheDocument();
});

test("rejects an OTP that does not match the generated demo code", async () => {
  render(<App />);
  await signIn();

  fireEvent.click(screen.getByRole("button", { name: /make more with ai/i }));
  fireEvent.click(screen.getByRole("button", { name: "Choose Basic" }));
  fireEvent.change(screen.getByLabelText("Mobile number"), { target: { value: "9876543210" } });
  fireEvent.change(screen.getByLabelText("6-digit OTP"), { target: { value: "000000" } });
  fireEvent.click(screen.getByRole("button", { name: "Continue with Basic" }));

  expect(screen.getByRole("alert")).toHaveTextContent(/otp does not match/i);
});
