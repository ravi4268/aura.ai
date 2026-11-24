import React, { useState, useEffect, useRef } from "react";

function Calling() {
  const [phoneNumber, setPhoneNumber] = useState("+91 92163 93256");
  const [promptText, setPromptText] = useState("");
  const [isCalling, setIsCalling] = useState(false);
  const [callStatus, setCallStatus] = useState("Ready when you are.");
  const [aiTranscript, setAiTranscript] = useState("");
  const [userTranscript, setUserTranscript] = useState("");
  const [callSeconds, setCallSeconds] = useState(0);

  const recognitionRef = useRef(null);
  const isCallingRef = useRef(false);

  // Call Timer
  useEffect(() => {
    let timer;
    if (isCalling) {
      timer = setInterval(() => {
        setCallSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      setCallSeconds(0);
    }
    return () => clearInterval(timer);
  }, [isCalling]);

  // Format timer (00:00)
  const formatTime = (secs) => {
    const mins = Math.floor(secs / 60)
      .toString()
      .padStart(2, "0");
    const remSecs = (secs % 60).toString().padStart(2, "0");
    return `${mins}:${remSecs}`;
  };

  // Aura.ai Voice Output (Text-to-Speech)
  const speakAsAura = (text, onComplete) => {
    if (!("speechSynthesis" in window)) return;
    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = "en-IN";
    utterance.rate = 1.0;
    utterance.pitch = 1.05;

    setAiTranscript(text);
    setCallStatus("Aura.ai is speaking...");

    utterance.onend = () => {
      if (isCallingRef.current && onComplete) {
        onComplete();
      }
    };

    window.speechSynthesis.speak(utterance);
  };

  // Aura.ai Smart Reply Logic
  const generateAuraReply = (userSpeech) => {
    const msg = userSpeech.toLowerCase();
    if (msg.includes("hello") || msg.includes("hi") || msg.includes("namaste")) {
      return "Hello! Main Aura AI bol rahi hoon. Bataiye aaj main aapki kya madad kar sakti hoon?";
    } else if (msg.includes("number") || msg.includes("call")) {
      return `Aapka registered number ${phoneNumber} connected hai. Aap mujhse kuch bhi pooch sakte hain.`;
    } else if (msg.includes("plan") || msg.includes("trip")) {
      return "Bilkul, hum ek badhiya plan bana sakte hain. Aap kahan jaane ya kya karne ka soch rahe hain?";
    } else if (msg.includes("bye") || msg.includes("band") || msg.includes("cut")) {
      return "Theek hai, call karne ke liye dhanyavaad. Aapka din shubh rahe!";
    }
    return `Maine suna aapne kaha: ${userSpeech}. Main is par aapki poori madad karne ke liye taiyar hoon, aage bataiye.`;
  };

  // Start Listening via Microphone
  const startListening = () => {
    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setCallStatus("Browser voice support unavailable. Type below to chat.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "en-IN";
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => {
      setCallStatus("Listening to you...");
    };

    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      setUserTranscript(spokenText);

      const reply = generateAuraReply(spokenText);
      if (
        spokenText.toLowerCase().includes("bye") ||
        spokenText.toLowerCase().includes("cut")
      ) {
        speakAsAura(reply, () => endCall());
      } else {
        speakAsAura(reply, () => {
          if (isCallingRef.current) startListening();
        });
      }
    };

    recognition.onerror = () => {
      if (isCallingRef.current) {
        setCallStatus("Aapki awaaz clear nahi aayi, dobara boliye...");
        setTimeout(() => {
          if (isCallingRef.current) startListening();
        }, 1200);
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  // Start Call Handler
  const startCall = (customTopic = "") => {
    setIsCalling(true);
    isCallingRef.current = true;
    setUserTranscript("");
    setCallStatus(`Connecting call to ${phoneNumber}...`);

    // NOTE: Real SIM phone call bhejne ke liye yahan apna Twilio/Vapi backend API call karein:
    // fetch("https://your-backend.com/api/make-call", {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ to: "9216393256", agent: "Aura.ai" })
    // });

    setTimeout(() => {
      if (!isCallingRef.current) return;
      const greeting = customTopic
        ? `Namaste! Main Aura AI hoon. Aapne ${customTopic} select kiya hai. Bataiye kaise shuru karein?`
        : `Namaste! Main Aura AI baat kar rahi hoon. Aapka number ${phoneNumber} connect ho gaya hai. Boliye, main aapki kya help kar sakti hoon?`;

      speakAsAura(greeting, () => {
        if (isCallingRef.current) startListening();
      });
    }, 1500);
  };

  // End Call Handler
  const endCall = () => {
    setIsCalling(false);
    isCallingRef.current = false;
    window.speechSynthesis.cancel();
    if (recognitionRef.current) {
      recognitionRef.current.stop();
    }
    setCallStatus("Call ended. Ready when you are.");
  };

  // Handle Text Submit inside Box
  const handleTextSubmit = (e) => {
    e.preventDefault();
    if (!promptText.trim()) return;
    if (!isCalling) {
      startCall(promptText);
    } else {
      setUserTranscript(promptText);
      const reply = generateAuraReply(promptText);
      speakAsAura(reply, () => {
        if (isCallingRef.current) startListening();
      });
    }
    setPromptText("");
  };

  return (
    <div style={styles.page}>
      {/* Google Font Import for Serif Heading */}
      <style>
        {`
          @import url('https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@400;500;600&display=swap');
          
          @keyframes pulseRing {
            0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(168, 130, 255, 0.6); }
            70% { transform: scale(1); box-shadow: 0 0 0 12px rgba(168, 130, 255, 0); }
            100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(168, 130, 255, 0); }
          }
          .aura-pulse {
            animation: pulseRing 1.8s infinite;
          }
          .card-hover:hover {
            border-color: #3f3f46 !important;
            background-color: #1c1c1f !important;
          }
        `}
      </style>

      <div style={styles.container}>
        {/* Top Hero Heading matching Screenshot */}
        <h1 style={styles.heroTitle}>
          A little help can <br />
          go a <span style={styles.italicPurple}>long way.</span>
        </h1>

        <p style={styles.subtitle}>
          Think it through, make something new, or just get unstuck.
          <br />
          Start wherever you are — talk directly with <strong>Aura.ai</strong>.
        </p>

        {/* Active Calling Banner (Visible when call starts) */}
        {isCalling && (
          <div style={styles.activeCallCard}>
            <div style={styles.callHeader}>
              <div style={styles.callerInfo}>
                <div className="aura-pulse" style={styles.avatarCircle}>
                  ✦
                </div>
                <div>
                  <div style={styles.callerName}>Aura.ai Voice Assistant</div>
                  <div style={styles.callerNumber}>
                    Connected: {phoneNumber} • {formatTime(callSeconds)}
                  </div>
                </div>
              </div>
              <button onClick={endCall} style={styles.endCallBtn}>
                End Call
              </button>
            </div>

            {aiTranscript && (
              <div style={styles.transcriptBox}>
                <span style={{ color: "#b794f4", fontWeight: 600 }}>
                  Aura.ai:{" "}
                </span>
                {aiTranscript}
              </div>
            )}
            {userTranscript && (
              <div style={{ ...styles.transcriptBox, marginTop: "6px" }}>
                <span style={{ color: "#4ade80", fontWeight: 600 }}>You: </span>
                {userTranscript}
              </div>
            )}
          </div>
        )}

        {/* Main Input & Call Box matching Screenshot */}
        <form onSubmit={handleTextSubmit} style={styles.inputCard}>
          {/* Phone Number Bar inside top of box */}
          <div style={styles.numberBar}>
            <span style={styles.numberLabel}>Calling Number:</span>
            <input
              type="tel"
              value={phoneNumber}
              onChange={(e) => setPhoneNumber(e.target.value)}
              style={styles.numberInput}
              placeholder="9216393256"
            />
          </div>

          <textarea
            rows={2}
            value={promptText}
            onChange={(e) => setPromptText(e.target.value)}
            placeholder="Ask me anything or click Call Aura.ai to talk..."
            style={styles.textarea}
          />

          <div style={styles.divider} />

          <div style={styles.inputFooter}>
            <div style={styles.statusRow}>
              <span
                style={{
                  ...styles.greenDot,
                  backgroundColor: isCalling ? "#a855f7" : "#4ade80",
                }}
              />
              <span style={styles.statusText}>
                {isCalling
                  ? callStatus
                  : "Curious by nature. Ready when you are."}
              </span>
            </div>

            <div style={styles.actionButtons}>
              {/* Call / Mic Button */}
              {!isCalling ? (
                <button
                  type="button"
                  onClick={() => startCall()}
                  style={styles.callBtn}
                  title="Start Voice Call with Aura.ai"
                >
                  📞 Call Aura.ai
                </button>
              ) : (
                <button
                  type="button"
                  onClick={endCall}
                  style={styles.iconBtnActive}
                  title="Disconnect Call"
                >
                  🎙️ Live
                </button>
              )}

              {/* Submit Arrow Button */}
              <button type="submit" style={styles.arrowBtn} title="Send">
                ↑
              </button>
            </div>
          </div>
        </form>

        {/* Bottom Section: Not sure where to start? */}
        <div style={styles.sectionHeader}>
          <span>Not sure where to start?</span>
          <span style={{ color: "#b794f4" }}>✳</span>
        </div>

        <div style={styles.grid}>
          {/* Card 1 */}
          <div
            className="card-hover"
            style={styles.card}
            onClick={() => startCall("Plan something")}
          >
            <div style={styles.cardLeft}>
              <div style={{ ...styles.iconBox, backgroundColor: "#262033", color: "#b794f4" }}>
                📅
              </div>
              <div>
                <div style={styles.cardTitle}>Plan something</div>
                <div style={styles.cardDesc}>Make a day worth remembering</div>
              </div>
            </div>
            <span style={styles.cardArrow}>↗</span>
          </div>

          {/* Card 2 */}
          <div
            className="card-hover"
            style={styles.card}
            onClick={() => startCall("Find inspiration")}
          >
            <div style={styles.cardLeft}>
              <div style={{ ...styles.iconBox, backgroundColor: "#2e221d", color: "#f6ad55" }}>
                💡
              </div>
              <div>
                <div style={styles.cardTitle}>Find inspiration</div>
                <div style={styles.cardDesc}>Fresh ideas for whatever's next</div>
              </div>
            </div>
            <span style={styles.cardArrow}>↗</span>
          </div>

          {/* Card 3 */}
          <div
            className="card-hover"
            style={styles.card}
            onClick={() => startCall("Learn something")}
          >
            <div style={styles.cardLeft}>
              <div style={{ ...styles.iconBox, backgroundColor: "#1b2b24", color: "#68d391" }}>
                📖
              </div>
              <div>
                <div style={styles.cardTitle}>Learn something</div>
                <div style={styles.cardDesc}>Curiosity looks good on you</div>
              </div>
            </div>
            <span style={styles.cardArrow}>↗</span>
          </div>

          {/* Card 4 */}
          <div
            className="card-hover"
            style={styles.card}
            onClick={() => startCall("Write it out")}
          >
            <div style={styles.cardLeft}>
              <div style={{ ...styles.iconBox, backgroundColor: "#1e2633", color: "#63b3ed" }}>
                ✍️
              </div>
              <div>
                <div style={styles.cardTitle}>Write it out</div>
                <div style={styles.cardDesc}>Find just the right words</div>
              </div>
            </div>
            <span style={styles.cardArrow}>↗</span>
          </div>
        </div>

        {/* Footer */}
        <div style={styles.footer}>
          Made for the moments in between. <span style={{ color: "#b794f4" }}>✳</span>
        </div>
      </div>
    </div>
  );
}

const styles = {
  page: {
    minHeight: "100vh",
    backgroundColor: "#0e0e10",
    color: "#f4f4f5",
    fontFamily: "'Inter', sans-serif",
    padding: "40px 20px",
    display: "flex",
    justifyContent: "center",
  },
  container: {
    width: "100%",
    maxWidth: "880px",
  },
  heroTitle: {
    fontFamily: "'Instrument Serif', Georgia, serif",
    fontSize: "clamp(3rem, 6vw, 4.8rem)",
    fontWeight: 400,
    lineHeight: 1.02,
    margin: "0 0 18px 0",
    letterSpacing: "-0.02em",
    color: "#ffffff",
  },
  italicPurple: {
    fontStyle: "italic",
    color: "#b794f4",
  },
  subtitle: {
    color: "#a1a1aa",
    fontSize: "15px",
    lineHeight: 1.6,
    marginBottom: "32px",
  },
  activeCallCard: {
    backgroundColor: "#181522",
    border: "1px solid #6b46c1",
    borderRadius: "14px",
    padding: "16px 20px",
    marginBottom: "20px",
  },
  callHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: "10px",
  },
  callerInfo: {
    display: "flex",
    alignItems: "center",
    gap: "12px",
  },
  avatarCircle: {
    width: "40px",
    height: "40px",
    borderRadius: "50%",
    backgroundColor: "#7c3aed",
    color: "#fff",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "18px",
  },
  callerName: {
    fontWeight: 600,
    fontSize: "15px",
    color: "#fff",
  },
  callerNumber: {
    fontSize: "12px",
    color: "#c4b5fd",
  },
  endCallBtn: {
    backgroundColor: "#dc2626",
    color: "#fff",
    border: "none",
    borderRadius: "8px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
  },
  transcriptBox: {
    fontSize: "13.5px",
    color: "#e4e4e7",
    backgroundColor: "#111114",
    padding: "10px 12px",
    borderRadius: "8px",
  },
  inputCard: {
    backgroundColor: "#161618",
    border: "1px solid #27272a",
    borderRadius: "16px",
    padding: "16px 20px",
    marginBottom: "36px",
  },
  numberBar: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
    marginBottom: "10px",
    paddingBottom: "8px",
    borderBottom: "1px dashed #27272a",
  },
  numberLabel: {
    fontSize: "12px",
    color: "#a1a1aa",
  },
  numberInput: {
    backgroundColor: "#202024",
    border: "1px solid #3f3f46",
    borderRadius: "6px",
    color: "#b794f4",
    padding: "4px 10px",
    fontSize: "13px",
    fontWeight: 600,
    outline: "none",
    width: "155px",
  },
  textarea: {
    width: "100%",
    backgroundColor: "transparent",
    border: "none",
    color: "#f4f4f5",
    fontSize: "15px",
    resize: "none",
    outline: "none",
    fontFamily: "inherit",
  },
  divider: {
    height: "1px",
    backgroundColor: "#27272a",
    margin: "12px 0",
  },
  inputFooter: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    flexWrap: "wrap",
    gap: "10px",
  },
  statusRow: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  greenDot: {
    width: "7px",
    height: "7px",
    borderRadius: "50%",
    display: "inline-block",
  },
  statusText: {
    fontSize: "13px",
    color: "#a1a1aa",
  },
  actionButtons: {
    display: "flex",
    alignItems: "center",
    gap: "8px",
  },
  callBtn: {
    backgroundColor: "#7c3aed",
    color: "#ffffff",
    border: "none",
    borderRadius: "8px",
    padding: "8px 14px",
    fontSize: "13px",
    fontWeight: 600,
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    gap: "6px",
  },
  iconBtnActive: {
    backgroundColor: "#2e1065",
    color: "#d8b4fe",
    border: "1px solid #7c3aed",
    borderRadius: "8px",
    padding: "8px 12px",
    fontSize: "13px",
    cursor: "pointer",
  },
  arrowBtn: {
    backgroundColor: "#27272a",
    color: "#a1a1aa",
    border: "none",
    borderRadius: "8px",
    width: "34px",
    height: "34px",
    fontSize: "16px",
    cursor: "pointer",
  },
  sectionHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    fontSize: "13px",
    color: "#a1a1aa",
    marginBottom: "14px",
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))",
    gap: "12px",
  },
  card: {
    backgroundColor: "#141416",
    border: "1px solid #27272a",
    borderRadius: "12px",
    padding: "16px",
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    cursor: "pointer",
    transition: "all 0.2s ease",
  },
  cardLeft: {
    display: "flex",
    alignItems: "center",
    gap: "14px",
  },
  iconBox: {
    width: "38px",
    height: "38px",
    borderRadius: "8px",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontSize: "16px",
  },
  cardTitle: {
    fontSize: "14px",
    fontWeight: 600,
    color: "#f4f4f5",
    marginBottom: "2px",
  },
  cardDesc: {
    fontSize: "12.5px",
    color: "#71717a",
  },
  cardArrow: {
    color: "#71717a",
    fontSize: "14px",
  },
  footer: {
    textAlign: "center",
    marginTop: "42px",
    fontSize: "13px",
    color: "#71717a",
  },
};

export default Calling;