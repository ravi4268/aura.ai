import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import Login from "./components/Login";
import Topbar from "./components/Topbar";

const recentChats = [
  "Ideas for a weekend trip",
  "A better morning routine",
  "Quick pasta recipes",
];

const aiTools = [
  { title: "Writing assistant", description: "Draft, rewrite, and polish your words.", prompt: "Help me write something great", icon: "Aa" },
  { title: "Idea generator", description: "Find a fresh angle for your next big idea.", prompt: "Give me some fresh ideas", icon: "✳" },
  { title: "Learning coach", description: "Break down a topic and learn at your pace.", prompt: "Help me learn something new", icon: "↗" },
  { title: "Trip planner", description: "Build a trip plan around your interests.", prompt: "Help me plan a perfect weekend", icon: "⌖" },
];

const initialProjects = [
  { title: "Weekend getaway planner", description: "A little inspiration for your next escape.", prompt: "Help me plan a perfect weekend" },
  { title: "Brand launch ideas", description: "Campaign starters and creative directions.", prompt: "Give me fresh ideas for a small brand launch" },
  { title: "Learning roadmap", description: "A simple plan for learning something new.", prompt: "Help me create a learning roadmap" },
];

const plans = [
  { name: "Free", price: "$0", description: "For exploring your ideas", features: ["Everyday AI chat", "Core AI tools", "Personal library"] },
  { name: "Basic", price: "$8", description: "For a little more room to create", features: ["More monthly messages", "All core AI tools", "Save more projects"] },
  { name: "Pro", price: "$18", description: "For your ambitious projects", features: ["Higher usage limits", "Advanced AI tools", "Priority workspace"] },
  { name: "Premium", price: "$30", description: "For your biggest ideas", features: ["Maximum usage limits", "All premium tools", "Top priority access"] },
];

const suggestions = [
  {
    title: "Plan something",
    detail: "Make a day worth remembering",
    prompt: "Help me plan a perfect weekend",
    color: "lilac",
    icon: <><path d="M4 7h16M7 4v6M17 4v6M5 11h14v9H5z" /><path d="m9 16 2 2 4-4" /></>,
  },
  {
    title: "Find inspiration",
    detail: "Fresh ideas for whatever’s next",
    prompt: "Give me some fresh ideas",
    color: "peach",
    icon: <><path d="M9 18h6M10 22h4M8.2 14.5A7 7 0 1 1 15.8 14.5c-1.1.8-1.4 1.6-1.6 2.5H9.8c-.2-.9-.5-1.7-1.6-2.5Z" /><path d="M12 2v2" /></>,
  },
  {
    title: "Learn something",
    detail: "Curiosity looks good on you",
    prompt: "Help me learn something new",
    color: "green",
    icon: <path d="M3 5.5C6 4 9 4.5 12 6v14c-3-1.5-6-2-9-.5v-14ZM21 5.5c-3-1.5-6-1-9 .5v14c3-1.5 6-2 9-.5v-14Z" />,
  },
  {
    title: "Write it out",
    detail: "Find just the right words",
    prompt: "Help me write something great",
    color: "blue",
    icon: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" />,
  },
];

function SparkleMark({ className = "" }) {
  return (
    <span className={`brand-mark ${className}`} aria-hidden="true">
      <svg viewBox="0 0 32 32">
        <path d="M16 3.5 18.9 13l9.6 3-9.6 3L16 28.5 13.1 19l-9.6-3 9.6-3L16 3.5Z" />
      </svg>
    </span>
  );
}

function App() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState([]);
  const [isSending, setIsSending] = useState(false);
  const [chatError, setChatError] = useState("");
  const chatRequestId = useRef(0);
  const [activeChat, setActiveChat] = useState("New chat");
  const [activeSection, setActiveSection] = useState("Chats");
  const [currentPlan, setCurrentPlan] = useState("Free");
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [phoneNumber, setPhoneNumber] = useState("");
  const [otp, setOtp] = useState("");
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [subscriptionError, setSubscriptionError] = useState("");
  const [subscriptionSuccess, setSubscriptionSuccess] = useState("");
  const [projects, setProjects] = useState(initialProjects);
  const [user, setUser] = useState(null);
  const [authStatus, setAuthStatus] = useState("checking");
  const [authError, setAuthError] = useState("");
  const [logoutError, setLogoutError] = useState("");
  const isLandingScreen = activeSection === "Chats" && messages.length === 0;

  useEffect(() => {
    let active = true;

    fetch("/api/auth/session", { credentials: "same-origin" })
      .then(async (response) => {
        if (response.status === 401) return null;
        if (!response.ok) throw new Error("Could not check your login session.");
        const data = await response.json();
        if (!data.user || data.user.name !== "Sanidhya") {
          throw new Error("The server returned an invalid session.");
        }
        return data.user;
      })
      .then((sessionUser) => {
        if (!active) return;
        setUser(sessionUser);
        setAuthStatus("ready");
        if (!sessionUser) setAuthError("");
      })
      .catch(() => {
        if (!active) return;
        setUser(null);
        setAuthStatus("ready");
        setAuthError("Could not reach the login server. Start the backend and try again.");
      });

    return () => {
      active = false;
    };
  }, []);

  const handleLogin = async (password) => {
    setAuthStatus("signing-in");
    setAuthError("");

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("The login server returned an invalid response.");
      }
      if (!response.ok) {
        throw new Error(data.error || "Sign in failed. Please try again.");
      }
      if (!data.user || data.user.name !== "Sanidhya") {
        throw new Error("The login server returned an invalid session.");
      }
      setUser(data.user);
      setAuthStatus("ready");
      setAuthError("");
    } catch (error) {
      setAuthStatus("ready");
      setAuthError(error.message || "Sign in failed. Please try again.");
    }
  };

  const handleLogout = async () => {
    setLogoutError("");
    try {
      const response = await fetch("/api/auth/logout", {
        method: "POST",
        credentials: "same-origin",
      });
      if (!response.ok) {
        throw new Error("Sign out failed. Please try again.");
      }
      setUser(null);
      setMessages([]);
      setActiveChat("New chat");
      setActiveSection("Chats");
      chatRequestId.current += 1;
      setIsSending(false);
      setChatError("");
      setAuthError("");
    } catch (error) {
      setLogoutError(error.message || "Sign out failed. Please try again.");
    }
  };

  const startNewChat = () => {
    chatRequestId.current += 1;
    setIsSending(false);
    setChatError("");
    setActiveChat("New chat");
    setActiveSection("Chats");
    setMessages([]);
    setPrompt("");
    setSidebarOpen(false);
  };

  const requestAssistantResponse = async (conversationMessages, requestId) => {
    setChatError("");
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversationMessages }),
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("The AI service returned an invalid response.");
      }
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error("The chat API is outdated. Restart the auraAI backend, then try again.");
        }
        throw new Error(data.error || "The AI could not answer right now. Please try again.");
      }
      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("The AI service returned an empty answer. Please try again.");
      }
      if (chatRequestId.current === requestId) {
        setMessages((currentMessages) => [...currentMessages, { role: "assistant", content: data.reply.trim() }]);
      }
    } catch (error) {
      if (chatRequestId.current === requestId) {
        setChatError(error.message || "Could not reach the AI service. Please try again.");
      }
    } finally {
      if (chatRequestId.current === requestId) setIsSending(false);
    }
  };

  const openChat = (title) => {
    chatRequestId.current += 1;
    setIsSending(false);
    setChatError("");
    setActiveChat(title);
    setActiveSection("Chats");
    setMessages([]);
    setSidebarOpen(false);
  };

  const openProject = (project) => {
    const requestId = chatRequestId.current + 1;
    chatRequestId.current = requestId;
    setIsSending(false);
    setChatError("");
    setActiveChat(project.title);
    const conversationMessages = [{ role: "user", content: project.prompt }];
    setMessages(conversationMessages);
    setPrompt("");
    setActiveSection("Chats");
    setSidebarOpen(false);
    requestAssistantResponse(conversationMessages, requestId);
  };

  const selectSection = (section) => {
    setActiveSection(section);
    setSidebarOpen(false);
  };

  const openPlanDialog = (plan) => {
    setSelectedPlan(plan);
    setPhoneNumber("");
    setOtp("");
    setGeneratedOtp("");
    setSubscriptionError("");
    setSubscriptionSuccess("");
  };

  const handlePhoneNumberChange = (event) => {
    const number = event.target.value.replace(/\D/g, "").slice(0, 10);
    setPhoneNumber(number);
    setOtp("");
    setGeneratedOtp("");
    setSubscriptionError("");

    if (number.length === 10) {
      const newOtp = String(Math.floor(100000 + Math.random() * 900000));
      setGeneratedOtp(newOtp);
      window.alert(`Your demo OTP is ${newOtp}. No SMS was sent.`);
    }
  };

  const confirmSubscription = (event) => {
    event.preventDefault();
    if (!selectedPlan) return;
    if (!/^\d{10}$/.test(phoneNumber)) {
      setSubscriptionError("Enter a valid 10-digit mobile number.");
      return;
    }
    if (!generatedOtp) {
      setSubscriptionError("Enter your mobile number to generate a demo OTP.");
      return;
    }
    if (otp !== generatedOtp) {
      setSubscriptionError("That OTP does not match. Check the alert and try again.");
      return;
    }
    setCurrentPlan(selectedPlan.name);
    setSubscriptionSuccess(`${selectedPlan.name} plan selected for +91 ${phoneNumber}. Demo mode: no payment or SMS was processed.`);
    setSelectedPlan(null);
    setActiveSection("Chats");
  };

  const saveCurrentProject = () => {
    if (!messages.length) return;
    const firstUserMessage = messages.find((message) => message.role === "user");
    if (!firstUserMessage) return;
    const title = activeChat === "New chat" ? firstUserMessage.content.slice(0, 40) : activeChat;
    setProjects((currentProjects) => {
      if (currentProjects.some((project) => project.title === title)) return currentProjects;
      return [{ title, description: "Saved from your recent AI chat.", prompt: firstUserMessage.content }, ...currentProjects];
    });
    setSubscriptionSuccess(`“${title}” was saved to your library.`);
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || isSending) return;
    const requestId = chatRequestId.current + 1;
    chatRequestId.current = requestId;
    const userMessage = { role: "user", content: text };
    const conversationMessages = [...messages, userMessage].slice(-20);
    setMessages(conversationMessages);
    setPrompt("");
    if (activeChat === "New chat") setActiveChat(text.slice(0, 40));
    await requestAssistantResponse(conversationMessages, requestId);
  };

  const handlePromptKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage(event);
    }
  };

  const renderPromptBox = (isConversation = false) => (
    <form
      className={`prompt-box${isConversation ? " conversation-prompt" : ""}`}
      onSubmit={sendMessage}
    >
      <label className="sr-only" htmlFor={isConversation ? "conversation-prompt" : "prompt-input"}>
        Message AI
      </label>
      <textarea
        id={isConversation ? "conversation-prompt" : "prompt-input"}
        placeholder={isConversation ? "Ask a follow-up..." : "Ask me anything..."}
        value={prompt}
        onChange={(event) => setPrompt(event.target.value)}
        onKeyDown={handlePromptKeyDown}
        rows={2}
      />
      <div className="prompt-toolbar">
        <span className="prompt-hint">
          {!isConversation && <span className="prompt-hint-dot" />}
          {isConversation ? "Press Enter to send" : "Curious by nature. Ready when you are."}
        </span>
        <button className="send-button" type="submit" aria-label="Send message" disabled={!prompt.trim() || isSending}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5m-6 6 6-6 6 6" />
          </svg>
        </button>
      </div>
    </form>
  );

  if (authStatus === "checking") {
    return (
      <main className="auth-loading" aria-label="Checking login session">
        <span className="login-brand-mark" aria-hidden="true">✳</span>
        <span>Getting your workspace ready...</span>
      </main>
    );
  }

  if (!user) {
    return (
      <Login
        onLogin={handleLogin}
        error={authError}
        isSubmitting={authStatus === "signing-in"}
      />
    );
  }

  return (
    <div className={`app-shell${isLandingScreen ? " app-shell-landing" : ""}`}>
      {sidebarOpen && (
        <button
          className="sidebar-backdrop"
          type="button"
          aria-label="Close sidebar"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside className={`sidebar${sidebarOpen ? " sidebar-open" : ""}`}>
        <div className="sidebar-brand">
          <SparkleMark />
          <span className="brand-name">aura<span>AI</span></span>
          <button className="icon-button sidebar-close-button" type="button" aria-label="Close sidebar" onClick={() => setSidebarOpen(false)}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18" /></svg>
          </button>
        </div>

        <button className="new-chat-button" type="button" onClick={startNewChat}>
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 5v14M5 12h14" /></svg>
          <span>New chat</span>
          <span className="shortcut">⌘ K</span>
        </button>

        <nav className="sidebar-nav" aria-label="Main navigation">
          <span className="sidebar-label">WORKSPACE</span>
          <button className={`nav-item${activeSection === "Chats" ? " nav-item-active" : ""}`} type="button" onClick={() => selectSection("Chats")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H8l-4 3V5Z" /><path d="M8 9h8M8 12h5" /></svg>
            <span>Chats</span><span className="nav-count">3</span>
          </button>
          <button className={`nav-item${activeSection === "Explore AI" ? " nav-item-active" : ""}`} type="button" onClick={() => selectSection("Explore AI")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m12 3 2.3 5.7L20 11l-5.7 2.3L12 19l-2.3-5.7L4 11l5.7-2.3L12 3Z" /><path d="m19 15 .9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15Z" /></svg>
            <span>Explore AI</span>
          </button>
          <button className={`nav-item${activeSection === "Library" ? " nav-item-active" : ""}`} type="button" onClick={() => selectSection("Library")}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 4h14v16H5zM8 8h8M8 12h8M8 16h5" /></svg>
            <span>Library</span>
          </button>
        </nav>

        <div className="recent-section">
          <div className="recent-heading">
            <span className="sidebar-label">RECENT</span>
            <button className="subtle-icon-button" type="button" aria-label="More recent chats">
              <svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
            </button>
          </div>
          {recentChats.map((chat, index) => (
            <button
              className={`recent-chat${activeChat === chat ? " recent-chat-active" : ""}`}
              type="button"
              onClick={() => openChat(chat)}
              key={chat}
            >
              <span className={`recent-chat-dot recent-chat-dot-${["violet", "peach", "green"][index]}`} />
              <span>{chat}</span>
            </button>
          ))}
        </div>

        <div className="sidebar-bottom">
          <button className="plan-card" type="button" onClick={() => selectSection("Plans")}>
            <span className="plan-card-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24"><path d="m12 3 2.5 5.5L20 11l-5.5 2.5L12 19l-2.5-5.5L4 11l5.5-2.5L12 3Z" /></svg>
            </span>
            <div><strong>Make more with AI</strong><p>Explore what’s possible.</p></div>
            <svg className="plan-arrow" viewBox="0 0 24 24" aria-hidden="true"><path d="m9 18 6-6-6-6" /></svg>
          </button>
          <button className="profile-button" type="button">
            <span className="avatar">S</span>
            <span className="profile-copy"><strong>{user.name}</strong><span>{currentPlan} plan</span></span>
            <svg className="profile-menu-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></svg>
          </button>
        </div>
      </aside>

      <main className="main-panel">
        <Topbar
          onMenuClick={() => setSidebarOpen(true)}
          onLogout={handleLogout}
          logoutError={logoutError}
          title={activeSection === "Chats" ? activeChat : activeSection}
          userName={user.name}
        />
        <section className={`chat-area${activeSection !== "Chats" || messages.length ? " chat-area-active" : ""}`}>
          {activeSection === "Explore AI" ? (
            <div className="workspace-page">
              <div className="page-eyebrow">YOUR CREATIVE TOOLKIT</div>
              <h1>Explore AI</h1>
              <p className="page-description">Pick a tool to start a focused conversation in your workspace.</p>
              <div className="tool-grid">
                {aiTools.map((tool) => (
                  <button className="tool-card" type="button" key={tool.title} onClick={() => {
                    setPrompt(tool.prompt);
                    setActiveChat(tool.title);
                    setActiveSection("Chats");
                    setSidebarOpen(false);
                  }}>
                    <span className="tool-card-icon">{tool.icon}</span>
                    <strong>{tool.title}</strong>
                    <span>{tool.description}</span>
                    <span className="tool-card-action">Open tool <span aria-hidden="true">↗</span></span>
                  </button>
                ))}
              </div>
            </div>
          ) : activeSection === "Library" ? (
            <div className="workspace-page">
              <div className="page-eyebrow">YOUR PERSONAL LIBRARY</div>
              <h1>Projects</h1>
              <p className="page-description">Pick up where you left off, or save a conversation as a project.</p>
              <div className="project-grid">
                {projects.map((project) => (
                  <article className="project-card" key={project.title}>
                    <span className="project-card-icon" aria-hidden="true">▤</span>
                    <h2>{project.title}</h2>
                    <p>{project.description}</p>
                    <button type="button" onClick={() => openProject(project)}>Open project <span aria-hidden="true">↗</span></button>
                  </article>
                ))}
              </div>
            </div>
          ) : activeSection === "Plans" ? (
            <div className="workspace-page plans-page">
              <div className="page-eyebrow">SIMPLE, FLEXIBLE PLANS</div>
              <h1>Choose your plan</h1>
              <p className="page-description">Start free, and pick a plan that fits the way you create.</p>
              {subscriptionSuccess && <p className="subscription-success" role="status">{subscriptionSuccess}</p>}
              <div className="plan-grid">
                {plans.map((plan) => (
                  <article className={`subscription-card${plan.name === "Pro" ? " subscription-card-featured" : ""}`} key={plan.name}>
                    {plan.name === "Pro" && <span className="popular-badge">POPULAR</span>}
                    <h2>{plan.name}</h2>
                    <p className="subscription-description">{plan.description}</p>
                    <p className="plan-price">{plan.price}<span>/ month</span></p>
                    <ul>{plan.features.map((feature) => <li key={feature}>{feature}</li>)}</ul>
                    <button type="button" onClick={() => openPlanDialog(plan)}>{currentPlan === plan.name ? "Current plan" : `Choose ${plan.name}`}</button>
                  </article>
                ))}
              </div>
              <p className="demo-disclaimer">Demo subscriptions only. No payment or SMS is processed.</p>
            </div>
          ) : messages.length === 0 ? (
            <div className="welcome-content">
              <div className="welcome-eyebrow"><span className="eyebrow-sparkle">✳</span> YOUR AI, YOUR WAY</div>
              <h1>A little help can<br />go a <span>long way.</span></h1>
              <p className="welcome-description">
                Think it through, make something new, or just get unstuck.
                <br className="desktop-break" /> Start wherever you are.
              </p>
              {subscriptionSuccess && <p className="subscription-success" role="status">{subscriptionSuccess}</p>}
              {renderPromptBox()}

              <div className="suggestions">
                <div className="suggestions-heading">
                  <span>Not sure where to start?</span><span className="suggestions-sparkle">✳</span>
                </div>
                <div className="suggestion-grid">
                  {suggestions.map((suggestion) => (
                    <button className="suggestion-card" type="button" key={suggestion.title} onClick={() => setPrompt(suggestion.prompt)}>
                      <span className={`suggestion-icon suggestion-icon-${suggestion.color}`}>
                        <svg viewBox="0 0 24 24" aria-hidden="true">{suggestion.icon}</svg>
                      </span>
                      <span><strong>{suggestion.title}</strong><small>{suggestion.detail}</small></span>
                      <span className="suggestion-arrow">↗</span>
                    </button>
                  ))}
                </div>
              </div>
              <div className="welcome-footer"><span>Made for the moments in between.</span><span className="footer-sparkle">✳</span></div>
            </div>
          ) : (
            <div className="conversation">
              <div className="conversation-title"><span className="conversation-icon">✳</span><h1>{activeChat === "New chat" ? "Your conversation" : activeChat}</h1></div>
              <div className="conversation-messages" aria-live="polite">
                {messages.map((message, index) => (
                  <div className={`message-row message-row-${message.role}`} key={`${index}-${message.role}-${message.content.slice(0, 24)}`}>
                    {message.role === "user" ? (
                      <span className="avatar message-avatar">S</span>
                    ) : (
                      <SparkleMark className="assistant-note-mark message-avatar assistant-avatar" />
                    )}
                    <p>{message.content}</p>
                  </div>
                ))}
              </div>
              {isSending && (
                <div className="assistant-note" role="status">
                  <SparkleMark className="assistant-note-mark" />
                  <p>Thinking through your message...</p>
                </div>
              )}
              {chatError && <p className="chat-error" role="alert">{chatError}</p>}
              {subscriptionSuccess && <p className="subscription-success" role="status">{subscriptionSuccess}</p>}
              <button className="save-project-button" type="button" onClick={saveCurrentProject}>Save chat to Library</button>
              {renderPromptBox(true)}
            </div>
          )}
        </section>
      </main>
      {selectedPlan && (
        <div className="dialog-backdrop" role="presentation" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSelectedPlan(null);
        }}>
          <section className="subscription-dialog" role="dialog" aria-modal="true" aria-labelledby="subscription-title">
            <button className="dialog-close" type="button" aria-label="Close dialog" onClick={() => setSelectedPlan(null)}>×</button>
            <div className="page-eyebrow">SUBSCRIPTION</div>
            <h2 id="subscription-title">Choose {selectedPlan.name}</h2>
            <p className="page-description">{selectedPlan.price} / month · Confirm your mobile number</p>
            <form onSubmit={confirmSubscription}>
              <label htmlFor="subscription-phone">Mobile number</label>
              <div className="phone-input">
                <span>+91</span>
                <input id="subscription-phone" type="tel" inputMode="numeric" autoComplete="tel-national" maxLength={10} placeholder="10-digit number" value={phoneNumber} onChange={handlePhoneNumberChange} required />
              </div>
              <label htmlFor="subscription-otp">6-digit OTP</label>
              <input id="subscription-otp" className="dialog-input" type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="Enter the OTP shown in the alert" value={otp} onChange={(event) => setOtp(event.target.value.replace(/\D/g, "").slice(0, 6))} required />
              {generatedOtp && <p className="otp-demo-note" role="status">Demo OTP: <strong>{generatedOtp}</strong> · No SMS was sent.</p>}
              {subscriptionError && <p className="dialog-error" role="alert">{subscriptionError}</p>}
              <button className="dialog-submit" type="submit">Continue with {selectedPlan.name}</button>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

export default App;
