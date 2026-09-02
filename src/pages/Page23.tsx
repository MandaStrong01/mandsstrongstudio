// @ts-nocheck
import { useState } from "react";

const GOLD = "#e8c96d";
const GOLDDIM = "#a07820";
const GOLDFAINT = "#e8c96d12";
const GOLDBORDER = "#e8c96d30";
const WHITE = "#d4c9a8";
const DIM = "#5a5040";
const BG = "#000000";
const BG2 = "#030200";
const BG3 = "#060400";

const HOW_TO = [
  { t: "GETTING STARTED", c: "Use the navigation menu (☰) or footer arrows to move between all 23 pages. Hit SAVE PROJECT in the footer at any time — MY PROJECTS restores exactly where you left off, including your timeline and all uploaded files." },
  { t: "PAGE 1 — HOME", c: "Your starting point. Hit START CREATING or LOGIN / REGISTER to begin. Download as a desktop app using the DOWNLOAD AS APP button." },
  { t: "PAGE 2 — PLATFORM OVERVIEW", c: "Full overview of MandaStrong Studio — 600+ AI tools, 8K export, 3-hour films, 1TB cloud storage. Hit START CREATING to go straight to the workspace." },
  { t: "PAGE 3 — SHOWCASE", c: "Upload your proof-of-concept films. Three slots — type the film title in the input field and click UPLOAD VIDEO to add your file. Click play to watch." },
  { t: "PAGE 4 — LOGIN & PRICING", c: "Creator $20/mo (1080p) · Pro $30/mo (4K) · Studio $50/mo (8K, up to 3 hours) — 7-day free trial on Studio. Sign in, create account, or browse as guest." },
  { t: "PAGE 5 — WRITING TOOLS", c: "50+ AI writing tools. Loglines, treatments, feature scripts, episode arcs, character bibles, dialogue, scene rewrites, and documentary narration. Hit AI CREATE to generate any format instantly." },
  { t: "PAGE 6 — VOICE ENGINE", c: "54 professional voice characters. Filter by gender, age, and origin. Hit TEST to preview any voice. Set PITCH, RATE, PAUSE, and VOLUME. Use MOOD across 14 emotional registers. Hit APPLY JAMES SETTINGS for documentary narration (pitch 0.86, rate 0.62, pause 1600ms). Always use PREPARE & SPEAK for best results." },
  { t: "PAGE 6 — MUSIC VIDEO STUDIO", c: "4-step wizard inside Page 6. Step 1: title, artist, genre, mood, tempo, upload audio. Step 2: video style, colour grade, effects. Step 3: describe your scene. Step 4: generate, download, share to YouTube, TikTok, and Instagram." },
  { t: "PAGE 7 — IMAGE TOOLS", c: "AI image generation, style transfer, upscaling, and background removal. Generate reference images or visual assets for titles and thumbnails." },
  { t: "PAGE 8 — VIDEO GENERATOR", c: "Describe any scene in natural language — lighting, mood, camera angle, time of day, characters. Claude writes a custom canvas renderer for each unique prompt. Every generated clip auto-saves to your Media Library." },
  { t: "PAGE 9 — VFX TOOLS", c: "Motion graphics, transitions, titles, and colour grading effects. Add professional visual effects to any scene." },
  { t: "PAGE 10 — ENHANCEMENT", c: "Upscale, sharpen, denoise, and stabilise any footage or image. Runs on your uploaded or generated files." },
  { t: "PAGE 11 — ASSET MANAGER", c: "Your central media library. All uploaded files and generated clips in one place. Preview, delete, and organise. Drag files or click to upload." },
  { t: "PAGE 12 — EDITOR SUITE", c: "Hub for all post-production tools — Media Library, Timeline Editor, Enhancement, Audio Mixer, Render Engine, and Preview Player." },
  { t: "PAGE 13 — TIMELINE EDITOR", c: "Drag clips to VIDEO, AUDIO, and TEXT tracks. Hit SYNC ALL TRACKS to auto-populate. Set film duration (1–180 minutes, any value). Hit RENDER when ready." },
  { t: "PAGE 14 — COLOUR GRADE", c: "Apply LUT presets (Cinematic, Noir, Golden Hour, Arctic Blue), adjust tone, contrast, and colour temperature. Apply to the whole timeline or individual clips." },
  { t: "PAGE 15 — AUDIO MIXER", c: "Documentary mix: VOICE 85, MUSIC 40, EFX 50, MASTER 85. Music video: MUSIC 75, VOICE 60, EFX 40, MASTER 85. 3-band EQ, Audio Ducking, Noise Reduction, Compressor." },
  { t: "PAGE 16 — RENDER ENGINE", c: "Choose 1080p (Creator), 4K (Pro), or 8K (Studio). VP9 codec. Auto-detects missing clips before rendering. Hit START RENDER when your timeline and mix are locked." },
  { t: "PAGE 17 — PREVIEW", c: "Full film preview before final export. Review chapters, check audio sync, approve your cut." },
  { t: "PAGE 18 — EXPORT & DISTRIBUTE", c: "Download your completed film. One-click share to YouTube, TikTok, Instagram, Facebook, LinkedIn, Vimeo, and WhatsApp." },
  { t: "PAGE 19 — TUTORIALS", c: "Step-by-step video lessons covering every part of the platform. Click any tutorial to expand and watch inline with expert pro tips." },
  { t: "PAGE 20 — ABOUT & LEGAL", c: "Who built this platform, why it exists, terms of service, and legal disclaimer." },
  { t: "PAGE 21 — AGENT GROK", c: "Your AI studio assistant. Available 24/7 — ask anything about tools, workflow, pricing, voice settings, upload, export, or production. Full knowledge of all 23 pages." },
  { t: "PAGE 22 — SETTINGS", c: "Platform configuration and preferences." },
  { t: "PAGE 23 — THAT'S ALL FOLKS", c: "This page — Amanda's letter, the platform mission, the three causes, the complete how-to guide, and the link to the Etsy store. Every purchase is donated to Veterans Mental Health Services and anti-bullying programmes." },
  { t: "WORKFLOW — DOCUMENTARY", c: "Page 5 (script) → Page 6 (James voice, pitch 0.86, rate 0.62) → Page 8 (generate scenes) or Page 13 UPLOAD MEDIA → Page 13 (timeline) → Page 15 (mix) → Page 16 (render) → Page 18 (export)" },
  { t: "WORKFLOW — SHORT FILM", c: "Page 5 (script) → Page 8 (scenes) or upload → Page 6 (voice) → Page 13 (timeline) → Page 16 (render) → Page 18 (export)" },
  { t: "WORKFLOW — MUSIC VIDEO", c: "Page 6 → MUSIC VIDEO STUDIO → Step 1 (upload track) → Step 2 (visual style) → Step 3 (scene) → Step 4 (generate) → download and share" },
  { t: "WORKFLOW — OWN FOOTAGE", c: "Page 13 → drag & drop your video, audio, image files → arrange on tracks → Page 15 (mix) → Page 14 (colour grade) → Page 16 (render) → Page 18 (export). No AI generation required." },
];

interface PageProps {
  onNavigate: (page: number) => void;
}

export default function Page23({ onNavigate }: PageProps) {
  const [guideOpen, setGuideOpen] = useState(false);

  return (
    <div style={{ minHeight: "100vh", background: BG, color: WHITE, fontFamily: "'Rajdhani',sans-serif", paddingBottom: 60, width: "100%", overflowX: "hidden" as const }}>
      <style>{`
        @keyframes shimmer { 0%,100%{opacity:.55} 50%{opacity:1} }
        @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:translateY(0)} }
        .p23-etsy:hover { filter:brightness(1.18); transform:scale(1.02); }
        .p23-exit:hover { border-color:${GOLD} !important; color:${GOLD} !important; }
        .p23-row:hover { background:${GOLDFAINT} !important; }
        .p23-guide:hover { background:#080600 !important; }
      `}</style>

      {/* ── TOP ACCENT ── */}
      <div style={{ height: 3, background: `linear-gradient(90deg,transparent,${GOLDDIM},${GOLD},${GOLDDIM},transparent)` }} />

      {/* ── HERO VIDEO ── */}
      <div style={{ position: "relative", background: "#000", maxHeight: "65vh", overflow: "hidden" }}>
        <video autoPlay loop playsInline preload="auto" muted
          style={{ width: "100%", display: "block", maxHeight: "65vh", objectFit: "cover" }}
          onError={e => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}>
          <source src="/background.mp4" type="video/mp4" />
          <source src="background.mp4" type="video/mp4" />
        </video>
        <div style={{ position: "absolute", inset: 0, background: "linear-gradient(to bottom, transparent 40%, #000 100%)", pointerEvents: "none" }} />

        {/* Centred title over video */}
        <div style={{ position: "absolute", bottom: 0, left: 0, right: 0, textAlign: "center", padding: "0 24px 48px", animation: "fadeUp .8s ease-out both" }}>
          <div style={{ fontSize: 9, color: GOLDDIM, letterSpacing: 7, fontWeight: 900, marginBottom: 14, animation: "shimmer 3s ease-in-out infinite" }}>
            MANDASTRONG STUDIO · CINEMA INTELLIGENCE PLATFORM · 2026
          </div>
          <h1 style={{ fontFamily: "'Cinzel',serif", color: GOLD, fontSize: "clamp(28px,5vw,52px)", fontWeight: 900, letterSpacing: 8, margin: "0 0 18px", textShadow: `0 0 60px ${GOLD}77` }}>
            THAT'S ALL FOLKS
          </h1>
          <div style={{ width: 120, height: 1, background: `linear-gradient(90deg,transparent,${GOLD},transparent)`, margin: "0 auto" }} />
        </div>
      </div>

      <div style={{ maxWidth: 880, margin: "0 auto", padding: "0 24px" }}>

        {/* ── LETTER ── */}
        <div style={{ margin: "40px 0 20px", background: "#040400", border: `2px solid ${GOLD}`, padding: "36px 40px", position: "relative", overflow: "hidden" }}>
          {/* Corner marks */}
          {[["top:0,left:0,borderRight,borderBottom"],["top:0,right:0,borderLeft,borderBottom"],["bottom:0,left:0,borderRight,borderTop"],["bottom:0,right:0,borderLeft,borderTop"]].map((_, i) => {
            const positions = [[{top:0,left:0},{borderRight:`1px solid ${GOLDDIM}`,borderBottom:`1px solid ${GOLDDIM}`}],[{top:0,right:0},{borderLeft:`1px solid ${GOLDDIM}`,borderBottom:`1px solid ${GOLDDIM}`}],[{bottom:0,left:0},{borderRight:`1px solid ${GOLDDIM}`,borderTop:`1px solid ${GOLDDIM}`}],[{bottom:0,right:0},{borderLeft:`1px solid ${GOLDDIM}`,borderTop:`1px solid ${GOLDDIM}`}]];
            return <div key={i} style={{ position:"absolute", width:36, height:36, ...positions[i][0], ...positions[i][1] }} />;
          })}
          <div style={{ color: GOLDDIM, fontSize: 9, letterSpacing: 6, fontWeight: 900, marginBottom: 20, textAlign: "center" }}>
            A LETTER TO THE CREATORS OF TODAY AND FOR THE FUTURE
          </div>
          <p style={{ color: WHITE, fontSize: 15, lineHeight: 2.1, margin: "0 0 16px" }}>
            To every creator who has ever had a story burning inside them and not known how to get it out — this platform is for you. Whether you are a first-time filmmaker, a veteran with decades of lived experience, a teacher trying to reach a classroom, or someone who simply wants to leave something behind — your story matters. You matter.
          </p>
          <p style={{ color: WHITE, fontSize: 15, lineHeight: 2.1, margin: "0 0 24px" }}>
            MandaStrong Studio was built with one belief: <strong style={{ color: GOLD }}>that every person deserves the tools to tell their story.</strong> Not just the wealthy. Not just the technically gifted. Everyone. To the creators of today — thank you. To the creators of the future — welcome.
          </p>
          <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${GOLDDIM},transparent)`, marginBottom: 20 }} />
          <p style={{ color: GOLD, fontWeight: 900, fontSize: 12, letterSpacing: 4, margin: 0, textAlign: "center" }}>
            — AMANDA WOOLLEY · FOUNDER · MANDASTRONG STUDIO
          </p>
        </div>

        {/* ── MISSION ── */}
        <div style={{ background: BG3, border: `1px solid ${GOLDDIM}`, padding: "32px 36px", marginBottom: 20 }}>
          <div style={{ color: GOLD, fontWeight: 900, fontSize: 12, letterSpacing: 5, marginBottom: 20, textAlign: "center" }}>OUR MISSION</div>
          <p style={{ color: WHITE, fontSize: 14, lineHeight: 2, margin: "0 0 14px" }}>
            I am Amanda Woolley — author, creative producer, and founder of MandaStrong Studio. I built this platform because I believe <strong style={{ color: GOLD }}>technology should serve humanity</strong>, and art should serve truth. We exist to give every person — regardless of background, budget, or technical skill — the power to tell their story and make it count.
          </p>
          <p style={{ color: WHITE, fontSize: 14, lineHeight: 2, margin: "0 0 24px" }}>
            MandaStrong Studio stands for three causes at the heart of a kinder world:
          </p>

          {/* Three causes */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 24 }}>
            {[
              { label: "HUMANITY FIRST", text: "We believe in the fundamental dignity of every human being. Technology, creativity, and storytelling are tools for connection — not division. MandaStrong Studio is built on compassion." },
              { label: "ADVOCATE AGAINST BULLYING", text: "Bullying destroys confidence, silences voices, and steals futures. We actively advocate against bullying in all its forms — online, in schools, and in communities. No child should be made to feel less than." },
              { label: "SOCIAL SKILLS IN CHILDREN", text: "Healthy social development is foundational. We champion programmes that help children communicate, empathise, and build meaningful relationships — skills that last a lifetime." },
            ].map(({ label, text }) => (
              <div key={label} style={{ background: BG2, border: `1px solid ${GOLDBORDER}`, padding: "16px 20px", display: "flex", gap: 16, alignItems: "flex-start" }}>
                <div style={{ width: 2, background: GOLDDIM, alignSelf: "stretch", flexShrink: 0, minHeight: 44, marginTop: 2 }} />
                <div>
                  <div style={{ color: GOLD, fontWeight: 900, fontSize: 11, letterSpacing: 3, marginBottom: 7 }}>◈ {label}</div>
                  <p style={{ color: WHITE, fontSize: 14, lineHeight: 1.85, margin: 0 }}>{text}</p>
                </div>
              </div>
            ))}
          </div>

          {/* Etsy block */}
          <div style={{ background: "#040300", border: `1px solid ${GOLDDIM}`, padding: "20px 24px" }}>
            <div style={{ color: GOLD, fontWeight: 900, fontSize: 10, letterSpacing: 4, marginBottom: 10 }}>ALL PROCEEDS FROM MANDA'S ETSY STORE</div>
            <p style={{ color: WHITE, fontSize: 14, lineHeight: 2, margin: "0 0 18px" }}>
              <strong style={{ color: GOLD }}>Every single purchase</strong> from{" "}
              <a href="https://MandaStrong1.Etsy.com" target="_blank" rel="noopener noreferrer"
                style={{ color: GOLD, fontWeight: 900, textDecoration: "underline", textUnderlineOffset: 3 }}>
                MandaStrong1.Etsy.com
              </a>{" "}
              is donated directly to causes that support humanity, advocate against bullying, and build social skills in children. When you buy from Manda's store, you are not just buying a product — you are funding a better world.
            </p>
            <button className="p23-etsy"
              onClick={() => window.open("https://MandaStrong1.Etsy.com", "_blank")}
              style={{
                display: "block", width: "100%", padding: "16px",
                background: `linear-gradient(135deg,${GOLDDIM},${GOLD})`,
                border: "none", color: "#000",
                fontFamily: "'Cinzel',serif", fontWeight: 900, fontSize: 14, letterSpacing: 4,
                cursor: "pointer", textTransform: "uppercase" as const,
                transition: "all .2s",
              }}>
              VISIT MANDA'S ETSY STORE
            </button>
          </div>
        </div>

        {/* ── HOW-TO GUIDE (collapsible) ── */}
        <div style={{ marginBottom: 20 }}>
          <button className="p23-guide"
            onClick={() => setGuideOpen(g => !g)}
            style={{
              display: "flex", justifyContent: "space-between", alignItems: "center",
              width: "100%", padding: "18px 24px",
              background: "#040300", border: `2px solid ${GOLD}`,
              color: GOLD, fontFamily: "'Rajdhani',sans-serif", fontWeight: 900,
              fontSize: 13, letterSpacing: 3, cursor: "pointer",
              textAlign: "left" as const, transition: "background .15s",
            }}>
            <span>COMPLETE HOW-TO-USE GUIDE — ALL 23 PAGES</span>
            <span style={{ fontSize: 15, marginLeft: 16 }}>{guideOpen ? "▲" : "▼"}</span>
          </button>

          {guideOpen && (
            <div style={{ background: "#040300", border: `2px solid ${GOLD}`, borderTop: "none", padding: "8px 24px 24px" }}>
              {HOW_TO.map(({ t, c }, idx) => (
                <div key={t} className="p23-row" style={{
                  borderBottom: idx < HOW_TO.length - 1 ? `1px solid ${GOLDDIM}18` : "none",
                  padding: "13px 8px", transition: "background .12s",
                }}>
                  <div style={{ color: GOLD, fontWeight: 900, fontSize: 11, letterSpacing: 2, marginBottom: 5 }}>▸ {t}</div>
                  <div style={{ color: WHITE, fontSize: 13, lineHeight: 1.85, paddingLeft: 14 }}>{c}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ── NAV BUTTONS ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12, marginBottom: 48 }}>
          <button className="p23-exit"
            onClick={() => onNavigate(1)}
            style={{
              background: "transparent", border: `1px solid ${GOLDDIM}`, color: WHITE,
              padding: "12px 32px", fontFamily: "'Rajdhani',sans-serif", fontWeight: 900,
              fontSize: 12, letterSpacing: 3, cursor: "pointer",
              textTransform: "uppercase" as const, transition: "border-color .15s, color .15s",
            }}>
            ← BACK TO HOME
          </button>
          <div style={{ color: DIM, fontSize: 10, letterSpacing: 3, fontWeight: 700, textAlign: "center" as const }}>
            MANDASTRONG STUDIO © 2026 · BUILT BY AMANDA WOOLLEY
          </div>
        </div>

        {/* ── CLOSING VIDEO ── */}
        <div style={{ border: `1px solid ${GOLDDIM}`, overflow: "hidden", marginBottom: 0 }}>
          <div style={{ background: BG3, padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: `1px solid ${GOLDDIM}33` }}>
            <div style={{ width: 7, height: 7, background: GOLD, borderRadius: "50%", boxShadow: `0 0 6px ${GOLD}88` }} />
            <span style={{ color: GOLDDIM, fontSize: 9, fontWeight: 900, letterSpacing: 4 }}>MANDASTRONG STUDIO · SHOWREEL</span>
          </div>
          <video autoPlay loop playsInline preload="auto" muted
            style={{ width: "100%", aspectRatio: "16/9", display: "block" }}
            onError={e => { (e.currentTarget as HTMLVideoElement).style.display = "none"; }}>
            <source src="/thatsallfolks.mp4" type="video/mp4" />
            <source src="thatsallfolks.mp4" type="video/mp4" />
          </video>
        </div>
        <div style={{ height: 1, background: `linear-gradient(90deg,transparent,${GOLD},transparent)`, marginBottom: 0 }} />

      </div>
    </div>
  );
}
