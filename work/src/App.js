import React, { useEffect, useRef, useState } from "react";
import "./App.css";
import Login from "./components/Login";
import Topbar from "./components/Topbar";

const recentChats = [
  "Ideas for a weekend trip",
  "A better morning routine",
  "Quick pasta recipes",
];

const LIVE_VOICE_LANGUAGE = "hi-IN";
const MAX_CHAT_CONTEXT_MESSAGES = 20;

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
  const messagesRef = useRef([]);
  const messagesEndRef = useRef(null);
  const isSendingRef = useRef(false);
  const wakeLockRef = useRef(null);
  const [installPrompt, setInstallPrompt] = useState(null);
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
  const [isLiveCall, setIsLiveCall] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [liveTranscript, setLiveTranscript] = useState("");
  const [liveError, setLiveError] = useState("");
  const mediaStreamRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioAnalyserRef = useRef(null);
  const audioMonitorRef = useRef(null);
  const audioUploadControllerRef = useRef(null);
  const recordingStartRef = useRef(0);
  const silenceStartedRef = useRef(0);
  const isTranscribingRef = useRef(false);
  const liveCallRef = useRef(false);
  const mutedRef = useRef(false);
  const isSpeakingRef = useRef(false);
  const isLandingScreen = activeSection === "Chats" && messages.length === 0;

  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView?.({ behavior: "smooth", block: "end" });
  }, [messages]);

  useEffect(() => {
    const handleInstallPrompt = (event) => {
      event.preventDefault();
      setInstallPrompt(event);
    };
    window.addEventListener("beforeinstallprompt", handleInstallPrompt);
    return () => window.removeEventListener("beforeinstallprompt", handleInstallPrompt);
  }, []);

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

  useEffect(() => () => {
    liveCallRef.current = false;
    isSpeakingRef.current = false;
    if (audioMonitorRef.current) window.clearInterval(audioMonitorRef.current);
    if (audioUploadControllerRef.current) audioUploadControllerRef.current.abort();
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.onresult = null;
      speechRecognitionRef.current.onend = null;
      speechRecognitionRef.current.onerror = null;
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.discardAudio = true;
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) mediaStreamRef.current.getTracks().forEach((track) => track.stop());
    if (audioContextRef.current) audioContextRef.current.close().catch(() => {});
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
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
      endLiveCall();
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

  const startListening = () => {
    if (
      !liveCallRef.current ||
      mutedRef.current ||
      isSpeakingRef.current ||
      isSendingRef.current ||
      isTranscribingRef.current
    ) return;
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.start();
        setIsListening(true);
      } catch (error) {
        if (error.name !== "InvalidStateError") {
          setLiveError("Could not start speech recognition. Check your microphone permission and try again.");
        }
      }
      return;
    }
    if (!mediaStreamRef.current) return;
    mediaStreamRef.current.getAudioTracks().forEach((track) => { track.enabled = true; });
    setIsListening(true);
  };

  const stopCurrentRecording = (discard = true) => {
    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === "inactive") return;
    recorder.discardAudio = discard;
    recorder.stop();
  };

  const uploadAudioForTranscription = async (blob, durationMs, mimeType) => {
    if (!liveCallRef.current || mutedRef.current || !blob.size) return;
    isTranscribingRef.current = true;
    setIsListening(false);
    setLiveTranscript("Transcribing...");
    const controller = new AbortController();
    audioUploadControllerRef.current = controller;

    try {
      const binary = Array.from(new Uint8Array(await blob.arrayBuffer()), (byte) => String.fromCharCode(byte)).join("");
      const response = await fetch("/api/voice/transcribe", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ audioBase64: window.btoa(binary), mimeType, durationMs }),
        signal: controller.signal,
      });
      let data;
      try {
        data = await response.json();
      } catch {
        throw new Error("The transcription service returned an invalid response.");
      }
      if (!response.ok) throw new Error(data.error || "Could not transcribe the audio. Please try again.");
      if (controller.signal.aborted || !liveCallRef.current || mutedRef.current) return;
      if (typeof data.transcript !== "string" || !data.transcript.trim()) {
        throw new Error("No speech was detected. Please try speaking again.");
      }
      setLiveError("");
      await sendVoiceMessage(data.transcript);
    } catch (error) {
      if (!controller.signal.aborted && liveCallRef.current && !mutedRef.current) {
        setLiveError(error.message || "Could not transcribe the audio. Please try again.");
      }
    } finally {
      if (audioUploadControllerRef.current === controller) audioUploadControllerRef.current = null;
      isTranscribingRef.current = false;
      if (liveCallRef.current && !mutedRef.current && !isSpeakingRef.current) startListening();
    }
  };

  const beginRecording = () => {
    if (mediaRecorderRef.current || !mediaStreamRef.current || mutedRef.current || isSpeakingRef.current) return;
    const Recorder = window.MediaRecorder;
    if (typeof Recorder !== "function") {
      setLiveError("Audio recording is not supported in this browser. Try a current version of Chrome or Edge.");
      return;
    }
    const requestedType = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
      "audio/aac",
    ]
      .find((type) => !Recorder.isTypeSupported || Recorder.isTypeSupported(type));
    if (!requestedType) {
      setLiveError("This browser does not support a compatible audio recording format.");
      return;
    }

    try {
      const recorder = new Recorder(mediaStreamRef.current, { mimeType: requestedType });
      const chunks = [];
      recorder.discardAudio = false;
      recorder.ondataavailable = (event) => {
        if (event.data?.size) chunks.push(event.data);
      };
      recorder.onstop = () => {
        if (mediaRecorderRef.current === recorder) mediaRecorderRef.current = null;
        if (recorder.discardAudio || !liveCallRef.current || mutedRef.current) return;
        const blob = new Blob(chunks, { type: recorder.mimeType || requestedType });
        const durationMs = Math.min(Math.max(1, Date.now() - recordingStartRef.current), 20_000);
        const mimeType = (recorder.mimeType || requestedType).split(";")[0].toLowerCase();
        uploadAudioForTranscription(blob, durationMs, mimeType);
      };
      recorder.start();
      mediaRecorderRef.current = recorder;
      recordingStartRef.current = Date.now();
      silenceStartedRef.current = 0;
    } catch (error) {
      setLiveError(error.message || "Could not record microphone audio.");
    }
  };

  const monitorMicrophone = () => {
    if (audioMonitorRef.current) window.clearInterval(audioMonitorRef.current);
    audioMonitorRef.current = window.setInterval(() => {
      if (!liveCallRef.current || mutedRef.current || isSpeakingRef.current || isSendingRef.current || isTranscribingRef.current) return;
      const analyser = audioAnalyserRef.current;
      if (!analyser) return;
      const samples = new Uint8Array(analyser.fftSize);
      analyser.getByteTimeDomainData(samples);
      let energy = 0;
      for (let index = 0; index < samples.length; index += 1) {
        const value = (samples[index] - 128) / 128;
        energy += value * value;
      }
      const hasSpeech = Math.sqrt(energy / samples.length) > 0.018;
      if (hasSpeech) {
        if (!mediaRecorderRef.current) beginRecording();
        silenceStartedRef.current = 0;
      } else if (mediaRecorderRef.current) {
        if (!silenceStartedRef.current) silenceStartedRef.current = Date.now();
        if (Date.now() - silenceStartedRef.current >= 1000) stopCurrentRecording(false);
      }
      if (mediaRecorderRef.current && Date.now() - recordingStartRef.current >= 19_000) {
        stopCurrentRecording(false);
      }
    }, 100);
  };

  const speakLiveReply = (text) => {
    if (!liveCallRef.current || !("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();
    isSpeakingRef.current = true;
    setIsSpeaking(true);
    setIsListening(false);
    setLiveTranscript(`AI: ${text}`);
    if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
    if (mediaStreamRef.current) mediaStreamRef.current.getAudioTracks().forEach((track) => { track.enabled = false; });
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = LIVE_VOICE_LANGUAGE;
    utterance.rate = 1;
    utterance.pitch = 1;
    utterance.onend = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      startListening();
    };
    utterance.onerror = () => {
      isSpeakingRef.current = false;
      setIsSpeaking(false);
      startListening();
    };
    window.speechSynthesis.speak(utterance);
  };

  const requestAssistantResponse = async (conversationMessages, requestId) => {
    setChatError("");
    isSendingRef.current = true;
    setIsSending(true);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: conversationMessages.slice(-MAX_CHAT_CONTEXT_MESSAGES) }),
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
        const reply = data.reply.trim();
        setMessages((currentMessages) => [...currentMessages, { role: "assistant", content: reply }]);
        if (liveCallRef.current) {
          setLiveError("");
          speakLiveReply(reply);
        }
      }
    } catch (error) {
      if (chatRequestId.current === requestId) {
        setChatError(error.message || "Could not reach the AI service. Please try again.");
        if (liveCallRef.current) {
          setLiveError(error.message || "Could not reach the AI service. Please try again.");
        }
      }
    } finally {
      if (chatRequestId.current === requestId) {
        isSendingRef.current = false;
        setIsSending(false);
        if (liveCallRef.current && !isSpeakingRef.current) startListening();
      }
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

  const sendVoiceMessage = async (text) => {
    const cleanText = text.trim();
    if (!cleanText || isSendingRef.current) return;
    const requestId = chatRequestId.current + 1;
    chatRequestId.current = requestId;
    const userMessage = { role: "user", content: cleanText };
    const conversationMessages = [...messagesRef.current, userMessage];
    messagesRef.current = conversationMessages;
    setMessages(conversationMessages);
    setLiveTranscript(`You: ${cleanText}`);
    if (activeChat === "New chat") setActiveChat(cleanText.slice(0, 40));
    await requestAssistantResponse(conversationMessages, requestId);
  };

  const endLiveCall = () => {
    liveCallRef.current = false;
    mutedRef.current = false;
    setIsMuted(false);
    setIsListening(false);
    setIsSpeaking(false);
    isTranscribingRef.current = false;
    if (audioUploadControllerRef.current) {
      audioUploadControllerRef.current.abort();
      audioUploadControllerRef.current = null;
    }
    stopCurrentRecording(true);
    mediaRecorderRef.current = null;
    if (audioMonitorRef.current) {
      window.clearInterval(audioMonitorRef.current);
      audioMonitorRef.current = null;
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    audioAnalyserRef.current = null;
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if ("speechSynthesis" in window) window.speechSynthesis.cancel();
    isSpeakingRef.current = false;
    if (wakeLockRef.current) {
      wakeLockRef.current.release().catch(() => {});
      wakeLockRef.current = null;
    }
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.onresult = null;
      speechRecognitionRef.current.onend = null;
      speechRecognitionRef.current.onerror = null;
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    setIsLiveCall(false);
  };

  const startLiveCall = async () => {
    if (!("speechSynthesis" in window) || typeof window.SpeechSynthesisUtterance !== "function") {
      setLiveError("Spoken AI replies are not supported in this browser. Try Chrome or Edge.");
      setIsLiveCall(true);
      return;
    }
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (
      typeof SpeechRecognition !== "function" &&
      (!navigator.mediaDevices?.getUserMedia || typeof window.MediaRecorder !== "function")
    ) {
      setLiveError("Microphone recording is not supported in this browser. Try a current version of Chrome or Edge.");
      setIsLiveCall(true);
      return;
    }

    setLiveError("");
    setLiveTranscript("Listening...");
    liveCallRef.current = true;
    setIsLiveCall(true);
    if ("wakeLock" in navigator) {
      navigator.wakeLock.request("screen").then((lock) => { wakeLockRef.current = lock; }).catch(() => {});
    }

    if (typeof SpeechRecognition === "function") {
      try {
        const recognition = new SpeechRecognition();
        recognition.lang = LIVE_VOICE_LANGUAGE;
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.onresult = (event) => {
          const finalTranscript = Array.from(event.results)
            .slice(event.resultIndex)
            .filter((result) => result.isFinal)
            .map((result) => result[0]?.transcript || "")
            .join(" ")
            .trim();
          const interimTranscript = Array.from(event.results)
            .slice(event.resultIndex)
            .filter((result) => !result.isFinal)
            .map((result) => result[0]?.transcript || "")
            .join(" ")
            .trim();
          if (interimTranscript) setLiveTranscript(`You: ${interimTranscript}`);
          if (!finalTranscript) return;
          setLiveTranscript(`You: ${finalTranscript}`);
          setIsListening(false);
          recognition.stop();
          sendVoiceMessage(finalTranscript);
        };
        recognition.onerror = (event) => {
          if (liveCallRef.current && !mutedRef.current && event.error !== "no-speech" && event.error !== "aborted") {
            setLiveError(event.error === "not-allowed"
              ? "Microphone access was blocked. Allow microphone access in your browser and try again."
              : "Speech recognition failed. Check your microphone permission and try again.");
          }
          setIsListening(false);
        };
        recognition.onend = () => {
          if (liveCallRef.current && !mutedRef.current && !isSpeakingRef.current && !isSendingRef.current) {
            startListening();
          }
        };
        speechRecognitionRef.current = recognition;
        startListening();
        return;
      } catch (error) {
        setLiveError(error.message || "Could not start speech recognition. Check your microphone permission and try again.");
        setIsListening(false);
        return;
      }
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!liveCallRef.current || mutedRef.current) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      mediaStreamRef.current = stream;
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (AudioContext) {
        const context = new AudioContext();
        const analyser = context.createAnalyser();
        analyser.fftSize = 2048;
        context.createMediaStreamSource(stream).connect(analyser);
        audioContextRef.current = context;
        audioAnalyserRef.current = analyser;
      } else {
        stream.getTracks().forEach((track) => track.stop());
        mediaStreamRef.current = null;
        setLiveError("Microphone audio monitoring is not supported in this browser.");
        return;
      }
      startListening();
      monitorMicrophone();
    } catch (error) {
      if (!liveCallRef.current) return;
      const denied = error.name === "NotAllowedError" || error.name === "PermissionDeniedError";
      setLiveError(denied
        ? "Microphone access was blocked. Allow microphone access in your browser and try again."
        : error.message || "Could not access the microphone. Check your device and try again.");
      setIsListening(false);
    }
  };

  const toggleMute = () => {
    const nextMuted = !mutedRef.current;
    mutedRef.current = nextMuted;
    setIsMuted(nextMuted);
    if (nextMuted) {
      stopCurrentRecording(true);
      if (speechRecognitionRef.current) speechRecognitionRef.current.stop();
      if (audioUploadControllerRef.current) {
        audioUploadControllerRef.current.abort();
        audioUploadControllerRef.current = null;
      }
      isTranscribingRef.current = false;
      if (mediaStreamRef.current) mediaStreamRef.current.getAudioTracks().forEach((track) => { track.enabled = false; });
      setIsListening(false);
    } else {
      setLiveError("");
      startListening();
    }
  };

  const sendMessage = async (event) => {
    event.preventDefault();
    const text = prompt.trim();
    if (!text || isSending) return;
    const requestId = chatRequestId.current + 1;
    chatRequestId.current = requestId;
    const userMessage = { role: "user", content: text };
    const conversationMessages = [...messagesRef.current, userMessage];
    messagesRef.current = conversationMessages;
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
        <span className="prompt-actions">
          <button className="live-call-button" type="button" aria-label="Start browser voice call with AI" onClick={startLiveCall}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4Z" /><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8" /></svg>
          </button>
          <button className="send-button" type="submit" aria-label="Send message" disabled={!prompt.trim() || isSending}>
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M12 19V5m-6 6 6-6 6 6" />
          </svg>
          </button>
        </span>
      </div>
    </form>
  );

  const installApp = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    await installPrompt.userChoice;
    setInstallPrompt(null);
  };

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
      {installPrompt && (
        <button className="android-install-banner" type="button" onClick={installApp}>
          <span className="android-install-icon">a</span>
          <span><strong>Install auraAI</strong><small>Add it to your Android home screen</small></span>
          <span className="android-install-action">Install</span>
        </button>
      )}
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
                <div ref={messagesEndRef} />
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
      {isLiveCall && (
        <div className="live-call-backdrop" role="dialog" aria-modal="true" aria-label="Live voice conversation">
          <section className="live-call-card">
            <div className="live-call-header">
              <span className="live-status-dot" />
              <span>{isMuted ? "Muted" : isSpeaking ? "AI speaking" : isListening ? "Listening" : "Connecting"}</span>
            </div>
            <div className={`live-orb${isListening || isSpeaking ? " live-orb-active" : ""}`}>
              <SparkleMark />
            </div>
            <h2>Talk with auraAI</h2>
            {liveError ? <p className="live-call-error" role="alert">{liveError}</p> : <p className="live-transcript" aria-live="polite">{liveTranscript}</p>}
            <div className="live-call-controls">
              <button className={`live-control${isMuted ? " live-control-active" : ""}`} type="button" aria-label={isMuted ? "Unmute microphone" : "Mute microphone"} onClick={toggleMute}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a4 4 0 0 0-4 4v5a4 4 0 0 0 8 0V7a4 4 0 0 0-4-4Z" /><path d="M5 11v1a7 7 0 0 0 14 0v-1M12 19v3M8 22h8" /></svg>
              </button>
              <button className="live-control live-control-end" type="button" aria-label="End live call" onClick={endLiveCall}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 15.5c4.5-3.4 9.5-3.4 14 0l-2 3-3-1.5-.8-2.5c-1.5-.3-3-.3-4.4 0L8 17l-3 1.5Z" /></svg>
              </button>
            </div>
          </section>
        </div>
      )}
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
