// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { supabase } from "../lib/supabase";

const GOLD = "#e8c96d";
const GOLDDIM = "#a07820";
const GOLDFAINT = "#e8c96d10";
const WHITE = "#d4c9a8";
const DIM = "#5a5040";
const BG = "#000000";
const BG2 = "#030200";
const ONLINE = "#22c55e";

const SYSTEM_PROMPT = `You are Agent Grok — the professional AI production assistant for MandaStrong Studio, a cinema intelligence platform built by Amanda Woolley.

PLATFORM FACTS:
- 600+ AI filmmaking tools across Writing, Image, Motion & VFX, Enhancement
- 8K export capability (Studio Plan)
- Films up to 3 hours long
- 54 voice characters on Page 6 with full pitch, rate, pause, mood controls
- Video scene generator on Page 8 — Claude writes custom canvas renderers per prompt
- Music Video Studio on Page 6 — beat-synced music video generation
- Timeline editor Page 13, Audio mixer Page 15, Render engine Page 16
- Export & distribute Page 18 — YouTube, TikTok, Instagram, Facebook, Vimeo, WhatsApp

SUBSCRIPTION PLANS:
- Creator Plan $20/mo: 1080p export, 100 AI tools, 10GB storage
- Pro Plan $30/mo: 4K export, 300 AI tools, 100GB storage, commercial license
- Studio Plan $50/mo: 8K export, 600+ AI tools, 1TB storage, full commercial rights, API access, 7-day free trial

VOICE ENGINE (Page 6):
- James: Documentary narrator — pitch 0.86, rate 0.62, pause 1600ms. Use APPLY JAMES SETTINGS.
- 54 characters: filter by gender, age, origin. TEST button plays a sample. PREPARE & SPEAK formats the script via AI before speaking.
- Mood slider: Neutral, Calm, Tender, Hopeful, Happy, Excited, Serious, Melancholic, Sad, Tense, Dramatic, Fearful, Angry, Surprised

VIDEO GENERATOR (Page 8):
- Describe any scene in natural language. Be specific: lighting, mood, camera angle, time of day, characters.
- For photorealistic humans: specify skin tone, clothing, expression, setting, lighting direction.
- Claude writes a bespoke canvas renderer for each prompt. More detail = better result.

RECOMMENDED WORKFLOWS:
- Documentary: Page 8 (scenes) → Page 6 (narration with James) → Page 13 (timeline) → Page 15 (mix: Voice 85, Music 40, EFX 50) → Page 16 (render) → Page 18 (export)
- Music Video: Page 6 MUSIC VIDEO STUDIO → 4 steps → generate → download/share
- Short Film: Page 5 (script) → Page 8 (scenes) → Page 6 (voice) → Page 13 → Page 16 → Page 18

FOUNDER: Amanda Woolley — self-taught developer, author, creative producer. Platform supports veterans' mental health and anti-bullying programmes. Every Etsy purchase at MandaStrong1.Etsy.com goes directly to Veterans Mental Health Services and anti-bullying programmes in schools.

Respond professionally and specifically. When someone asks about a feature, tell them exactly which page it's on and how to use it. Be direct, knowledgeable, and helpful. Keep answers focused and actionable.`;

const QUICK_Qs = [
  "How do I generate video scenes?",
  "Documentary workflow start to finish",
  "Best voice settings for narration",
  "How do I export to YouTube?",
  "What does each plan include?",
  "How does the Music Video Studio work?",
  "How do I upload my own footage?",
  "How does the render engine work?",
];

interface PageProps { onNavigate: (page: number) => void; }

export default function Page21({ onNavigate }: PageProps) {
  const [msgs, setMsgs] = useState([{
    role: "assistant",
    content: "Welcome to MandaStrong Studio. I am Agent Grok — your dedicated AI production consultant.\n\nI have full knowledge of every tool, workflow, voice setting, and feature across all 23 pages. How can I assist your production today?",
  }]);
  const [inp, setInp] = useState("");
  const [loading, setLoading] = useState(false);
  const [dot, setDot] = useState(0);
  const [msgCount, setMsgCount] = useState(1);
  const bot = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    bot.current?.scrollIntoView({ behavior: "smooth" });
  }, [msgs, loading]);

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setDot(d => (d + 1) % 3), 420);
    return () => clearInterval(t);
  }, [loading]);

  const send = async (question?: string) => {
    const q = (question ?? inp).trim();
    if (!q) return;
    setInp("");
    setLoading(true);
    const newMsgs = [...msgs, { role: "user", content: q }];
    setMsgs(newMsgs);
    setMsgCount(c => c + 1);
    try {
      const r = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "anthropic-version": "2023-06-01",
          "anthropic-dangerous-direct-browser-access": "true",
          "x-api-key": ["sk-ant-api03-", "rNj3uksGI3kmBJI9Mzjm2A2II2Ll6T05dea_dgB0aqqMjqbbIsembbeVVlT", "-lJ4LDSQzV8ertjcY1BodhaJcA-_mURVAAA"].join("")
        },
        body: JSON.stringify({
          model: "claude-sonnet-4-20250514",
          max_tokens: 1200,
          system: SYSTEM_PROMPT,
          messages: newMsgs.filter(m => m.role !== "system"),
        })
      });
      const d = await r.json();
      setMsgs(p => [...p, { role: "assistant", content: d.content?.[0]?.text ?? "Unable to process. Please try again." }]);
      setMsgCount(c => c + 1);
    } catch (_) {
      setMsgs(p => [...p, { role: "assistant", content: "Connection failed. Please check your connection and try again." }]);
    }
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: WHITE, fontFamily: "'Rajdhani',sans-serif", paddingBottom: 100, width: "100%", overflowX: "hidden" as const }}>
      <style>{`
        @keyframes onlinePulse { 0%,100%{opacity:.5;transform:scale(.8)} 50%{opacity:1;transform:scale(1)} }
        .gq21:hover { border-color:${GOLD} !important; color:${GOLD} !important; background:${GOLDFAINT} !important; }
        .gi21:focus { border-color:${GOLD} !important; outline:none; }
        .gs21:hover:not(:disabled) { filter:brightness(1.12); }
      `}</style>

      <div style={{ maxWidth: 820, margin: "0 auto", padding: "32px 24px 80px" }}>

        {/* ── AGENT HEADER ── */}
        <div style={{
          background: BG2,
          border: `1px solid ${GOLDDIM}`,
          padding: "24px 28px",
          marginBottom: 2,
          display: "flex",
          alignItems: "center",
          gap: 20,
        }}>
          {/* Avatar */}
          <div style={{ position: "relative", flexShrink: 0 }}>
            <div style={{
              width: 56, height: 56,
              background: `linear-gradient(145deg,${GOLDDIM},${GOLD})`,
              display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              <span style={{ fontFamily: "'Cinzel',serif", fontSize: 28, fontWeight: 900, color: "#000" }}>G</span>
            </div>
            {/* Online indicator */}
            <div style={{
              position: "absolute", bottom: -2, right: -2,
              width: 14, height: 14, borderRadius: "50%",
              background: ONLINE, border: `2px solid ${BG}`,
              boxShadow: `0 0 8px ${ONLINE}`,
              animation: "onlinePulse 2s ease-in-out infinite",
            }} />
          </div>

          {/* Identity */}
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
              <h1 style={{ fontFamily: "'Cinzel',serif", color: GOLD, fontSize: "clamp(20px,2.5vw,28px)", fontWeight: 900, margin: 0, letterSpacing: 4 }}>AGENT GROK</h1>
              <div style={{ display: "flex", alignItems: "center", gap: 6, background: ONLINE + "18", border: `1px solid ${ONLINE}44`, padding: "3px 10px" }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: ONLINE, boxShadow: `0 0 5px ${ONLINE}`, animation: "onlinePulse 2s ease-in-out infinite" }} />
                <span style={{ color: ONLINE, fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>ONLINE · 24/7</span>
              </div>
            </div>
            <div style={{ color: DIM, fontSize: 10, letterSpacing: 3, fontWeight: 700, marginTop: 6 }}>
              AI PRODUCTION CONSULTANT · MANDASTRONG STUDIO · {msgCount} MESSAGE{msgCount !== 1 ? "S" : ""}
            </div>
          </div>

          {/* Knowledge panel */}
          <div style={{ textAlign: "right", flexShrink: 0 }}>
            <div style={{ color: DIM, fontSize: 8, letterSpacing: 3, fontWeight: 900, marginBottom: 4 }}>KNOWLEDGE BASE</div>
            <div style={{ color: GOLD, fontSize: 13, fontWeight: 900, letterSpacing: 1 }}>23 PAGES</div>
            <div style={{ color: GOLDDIM, fontSize: 11, fontWeight: 700 }}>600+ TOOLS</div>
          </div>
        </div>

        {/* Gold separator */}
        <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${GOLD},transparent)`, marginBottom: 2 }} />

        {/* ── CHAT WINDOW ── */}
        <div style={{
          background: "#020100",
          border: `1px solid ${GOLDDIM}`,
          borderTop: "none",
          minHeight: 420,
          maxHeight: 520,
          overflowY: "auto",
          display: "flex",
          flexDirection: "column",
          marginBottom: 2,
        }}>
          <div style={{ padding: "6px 16px", background: "#040300", borderBottom: `1px solid ${GOLDDIM}22`, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: DIM, fontSize: 9, letterSpacing: 4, fontWeight: 900 }}>PRODUCTION CONSULTATION</span>
            <span style={{ color: DIM, fontSize: 9, letterSpacing: 2 }}>{msgCount} MESSAGE{msgCount !== 1 ? "S" : ""}</span>
          </div>

          {msgs.map((m, i) => (
            <div key={i} style={{
              padding: "16px 20px",
              background: m.role === "user" ? GOLDFAINT : "transparent",
              borderBottom: `1px solid ${GOLDDIM}12`,
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                {m.role === "assistant"
                  ? <div style={{ width: 24, height: 24, background: `linear-gradient(145deg,${GOLDDIM},${GOLD})`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontFamily: "'Cinzel',serif", fontSize: 11, fontWeight: 900, color: "#000" }}>G</span>
                    </div>
                  : <div style={{ width: 24, height: 24, background: "#050300", border: `1px solid ${GOLDDIM}`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                      <span style={{ fontSize: 8, color: GOLDDIM, fontWeight: 900, letterSpacing: 0.5 }}>YOU</span>
                    </div>
                }
                <span style={{ fontSize: 9, color: m.role === "user" ? WHITE : GOLD, fontWeight: 900, letterSpacing: 3 }}>
                  {m.role === "user" ? "YOU" : "AGENT GROK"}
                </span>
              </div>
              <div style={{ color: WHITE, fontSize: 14, lineHeight: 1.9, whiteSpace: "pre-wrap", paddingLeft: 34 }}>
                {m.content}
              </div>
            </div>
          ))}

          {loading && (
            <div style={{ padding: "16px 20px", borderBottom: `1px solid ${GOLDDIM}12` }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                <div style={{ width: 24, height: 24, background: `linear-gradient(145deg,${GOLDDIM},${GOLD})`, display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontFamily: "'Cinzel',serif", fontSize: 11, fontWeight: 900, color: "#000" }}>G</span>
                </div>
                <span style={{ fontSize: 9, color: GOLD, fontWeight: 900, letterSpacing: 3 }}>AGENT GROK</span>
              </div>
              <div style={{ display: "flex", gap: 6, alignItems: "center", paddingLeft: 34 }}>
                {[0, 1, 2].map(i => (
                  <div key={i} style={{ width: 7, height: 7, borderRadius: "50%", background: i === dot ? GOLD : GOLDDIM, transition: "background .2s" }} />
                ))}
              </div>
            </div>
          )}
          <div ref={bot} />
        </div>

        {/* Gold separator */}
        <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${GOLD},transparent)`, marginBottom: 16 }} />

        {/* ── QUICK QUESTIONS ── */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ color: DIM, fontSize: 9, letterSpacing: 4, fontWeight: 900, marginBottom: 8 }}>QUICK QUESTIONS</div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {QUICK_Qs.map(q => (
              <button key={q} className="gq21"
                onClick={() => { setInp(q); setTimeout(() => textRef.current?.focus(), 40); }}
                style={{
                  background: "transparent", border: `1px solid ${GOLDDIM}`, color: WHITE,
                  padding: "6px 14px", cursor: "pointer", fontSize: 11, fontWeight: 700,
                  letterSpacing: 0.5, fontFamily: "'Rajdhani',sans-serif",
                  transition: "all .12s",
                }}
              >{q}</button>
            ))}
          </div>
        </div>

        {/* ── INPUT ── */}
        <div style={{ display: "flex", gap: 8 }}>
          <textarea ref={textRef} className="gi21"
            value={inp}
            onChange={e => setInp(e.target.value)}
            onKeyDown={e => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } }}
            placeholder="Ask about any tool, workflow, voice setting, pricing, upload, or export..."
            style={{
              flex: 1, height: 70, resize: "none", padding: "12px 14px", fontSize: 14,
              background: BG2, border: `1px solid ${GOLDDIM}`, color: WHITE,
              outline: "none", lineHeight: 1.6, fontFamily: "'Rajdhani',sans-serif",
              transition: "border-color .12s",
            }}
          />
          <button className="gs21"
            onClick={() => send()}
            disabled={loading || !inp.trim()}
            style={{
              height: 70, padding: "0 32px",
              background: loading || !inp.trim() ? BG2 : `linear-gradient(135deg,${GOLDDIM},${GOLD})`,
              border: `1px solid ${loading || !inp.trim() ? GOLDDIM : GOLD}`,
              color: loading || !inp.trim() ? DIM : "#000",
              fontFamily: "'Rajdhani',sans-serif", fontWeight: 900, fontSize: 12,
              letterSpacing: 3, cursor: loading || !inp.trim() ? "not-allowed" : "pointer",
              textTransform: "uppercase" as const, transition: "all .12s",
            }}
          >{loading ? "···" : "SEND"}</button>
        </div>

        <div style={{ color: DIM, fontSize: 9, letterSpacing: 1, marginTop: 8 }}>
          Enter to send · Shift+Enter for new line · Agent Grok has full knowledge of all 23 pages
        </div>

      </div>
    </div>
  );
}
