// @ts-nocheck
import { useState } from "react";

const GOLD = "#e8c96d";
const GOLDDIM = "#a07820";
const WHITE = "#d4c9a8";
const DIM = "#aaaaaa";

const Sp = { minHeight: "100vh", background: "#000000", color: WHITE, fontFamily: "'Rajdhani',sans-serif", paddingBottom: 160, width: "100%", overflowX: "hidden" as const };
const Card = (x?) => ({ background: "#0a0a0a", border: `1px solid ${GOLDDIM}`, borderRadius: 0, padding: 20, ...(x || {}) });

interface PageProps {
  onNavigate: (page: number) => void;
}

export default function Page20({ onNavigate }: PageProps) {
  const [tab, setTab] = useState("about");

  const sec = (title: string, body: React.ReactNode) => (
    <div style={{ marginBottom: 20 }}>
      <div style={{ color: GOLD, fontWeight: 900, fontSize: 12, letterSpacing: 2, marginBottom: 8, borderBottom: `1px solid ${GOLDDIM}44`, paddingBottom: 6 }}>{title}</div>
      {body}
    </div>
  );
  const p = (txt: string) => <p style={{ color: WHITE, fontSize: 14, lineHeight: 1.9, marginBottom: 10 }}>{txt}</p>;

  return (
    <div style={{ ...Sp, padding: "30px 40px 80px" }}>
      <div style={{ maxWidth: 860, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: GOLD, letterSpacing: 4, marginBottom: 4, fontWeight: 700 }}>MANDASTRONG STUDIO</div>
        <h1 style={{ fontFamily: "'Cinzel',serif", color: GOLD, fontSize: 28, fontWeight: 900, letterSpacing: 4, marginBottom: 4 }}>ABOUT & LEGAL</h1>
        <div style={{ color: DIM, fontSize: 11, marginBottom: 24, letterSpacing: 2 }}>AMANDA WOOLLEY · FOUNDER · MARCH 2026</div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", marginBottom: 28, border: `1px solid ${GOLDDIM}` }}>
          {([["about", "ABOUT"], ["terms", "TERMS"], ["disc", "DISCLAIMER"]] as [string, string][]).map(([id, label]) => (
            <button key={id} onClick={() => setTab(id)}
              style={{ background: tab === id ? `linear-gradient(135deg,#0a0500,#1a0800)` : "#000", border: "none", borderBottom: tab === id ? `2px solid ${GOLD}` : "2px solid transparent", color: tab === id ? GOLD : WHITE, padding: "14px", cursor: "pointer", fontSize: 12, fontWeight: 900, letterSpacing: 3, fontFamily: "'Rajdhani',sans-serif" }}>
              {label}
            </button>
          ))}
        </div>

        {tab === "about" && (
          <div>
            <div style={{ background: "#050500", border: `2px solid ${GOLD}`, padding: "20px 24px", marginBottom: 20, textAlign: "center" }}>
              <div style={{ fontFamily: "'Cinzel',serif", color: GOLD, fontSize: 18, fontWeight: 900, letterSpacing: 4, marginBottom: 8 }}>MANDASTRONG STUDIO</div>
              <div style={{ color: WHITE, fontSize: 13, lineHeight: 1.9 }}>Professional Cinema Intelligence Platform · Built by a creator, for creators.</div>
            </div>

            {sec("WHO BUILT THIS", <>
              {p("My name is Amanda Woolley. I am not a tech company. I am not a corporation with a legal team and a PR department. I am a writer, a creative producer, and a self-taught developer who spent years learning to code this platform from scratch.")}
              {p("I built MandaStrong Studio because I was frustrated. I had stories to tell and no tools I could afford. Every professional filmmaking tool was either out of reach financially or required a team of specialists. That felt wrong to me — and still does.")}
              {p("So I built the tools I needed. And then I kept building. What started as a personal project became a full production platform with 600+ AI filmmaking tools, a complete production pipeline from script to screen, and the ability to produce films up to three hours long — on any device, by any person.")}
            </>)}

            {sec("WHY THIS EXISTS", <>
              {p("MandaStrong Studio exists for one reason: every person deserves the tools to tell their story. Not just the wealthy. Not just the technically skilled. Everyone.")}
              {p("Two causes sit at the heart of this project. A meaningful portion of every subscription goes to veterans' mental health programmes and school anti-bullying initiatives. These are not marketing statements. They are the reason I kept going on the days when this felt impossible.")}
            </>)}

            {sec("WHAT THIS PLATFORM IS", <>
              {p("MandaStrong Studio is a browser-based AI filmmaking platform. It uses Claude (Anthropic's AI) to generate scripts, format narration, render cinematic scenes, and power the Agent Grok assistant. It uses the Web Speech API for text-to-speech. It uses your browser's canvas and MediaRecorder for video rendering.")}
              {p("Everything runs in your browser. Nothing is stored on a server by default. Your projects are saved locally using your browser's storage. The platform works on desktop, tablet, and mobile.")}
            </>)}

            {sec("SUBSCRIPTIONS", <>
              {p("Creator Plan — $20/month. Pro Plan — $30/month. Studio Plan — $50/month with a 7-day free trial. All payments are processed by Stripe. I do not store your card details.")}
              {p("Subscriptions auto-renew monthly. You can cancel at any time. I do not issue refunds for partial billing periods — if you cancel mid-month, your access continues until the end of that period.")}
            </>)}

            <div style={{ background: "#050500", border: `1px solid ${GOLDDIM}`, padding: "14px 18px", marginTop: 8 }}>
              <p style={{ color: GOLDDIM, fontSize: 11, margin: 0, letterSpacing: 1 }}>Questions? Use Agent Grok on Page 21 or visit MandaStrong1.Etsy.com</p>
            </div>
          </div>
        )}

        {tab === "terms" && (
          <div>
            <div style={{ background: "#050500", border: `2px solid ${GOLD}`, padding: "14px 20px", marginBottom: 20, textAlign: "center" }}>
              <div style={{ color: GOLD, fontSize: 11, letterSpacing: 3, fontWeight: 900 }}>TERMS OF SERVICE · MANDASTRONG STUDIO LLC · MARCH 2026</div>
              <div style={{ color: WHITE, fontSize: 12, marginTop: 4 }}>Using this platform means you agree to these terms.</div>
            </div>

            {sec("1. ACCEPTANCE", <>{p("By using MandaStrong Studio you agree to be bound by these terms. If you disagree, do not use the platform.")}</>)}
            {sec("2. SUBSCRIPTIONS & BILLING", <>{p("Three plans: Creator $20/mo, Pro $30/mo, Studio $50/mo. All auto-renew monthly. Studio includes a 7-day free trial — no charge during that period. Payments via Stripe. No refunds for partial billing periods. Cancel any time.")}</>)}
            {sec("3. YOUR CONTENT", <>{p("You own everything you create. Your scripts, your uploads, your productions. Studio Plan subscribers have full commercial rights to content produced using the platform's AI tools. Creator and Pro plan subscribers may use content for personal and non-commercial purposes unless otherwise agreed.")}</>)}
            {sec("4. THE PLATFORM", <>{p("MandaStrong Studio, its code, tools, interface, and branding are the intellectual property of Amanda Woolley and MandaStrong Studio LLC. You may not copy, redistribute, or reverse-engineer the platform.")}</>)}
            {sec("5. ACCEPTABLE USE", <>{p("Use this platform lawfully. Do not use it to produce content that is defamatory, obscene, or designed to harass individuals. Do not infringe third-party IP. Do not share your account credentials.")}</>)}
            {sec("6. AI-GENERATED CONTENT", <>{p("All AI outputs are generated algorithmically. You are responsible for reviewing everything before publishing or distributing. The platform does not guarantee accuracy, completeness, or appropriateness of any AI-generated material.")}</>)}
            {sec("7. LIABILITY", <>{p("This platform is provided as-is. To the maximum extent permitted by law, MandaStrong Studio LLC is not liable for indirect or consequential damages. Total liability is capped at amounts paid in the prior 30 days.")}</>)}
            {sec("8. TERMINATION", <>{p("I reserve the right to suspend accounts that violate these terms. You can cancel any time. Cancellation takes effect at the end of the current billing period.")}</>)}
            {sec("9. CONTACT", <>{p("Questions, billing issues, or legal notices: MandaStrong1.Etsy.com or Agent Grok on Page 21.")}</>)}

            <div style={{ background: "#050500", border: `1px solid ${GOLDDIM}`, padding: "12px 16px", marginTop: 8 }}>
              <p style={{ color: GOLDDIM, fontSize: 11, margin: 0, letterSpacing: 1 }}>MANDASTRONG STUDIO LLC · AMANDA WOOLLEY · MARCH 2026</p>
            </div>
          </div>
        )}

        {tab === "disc" && (
          <div>
            <div style={{ background: "#050500", border: `2px solid ${GOLD}`, padding: "14px 20px", marginBottom: 20, textAlign: "center" }}>
              <div style={{ color: GOLD, fontSize: 11, letterSpacing: 3, fontWeight: 900 }}>PLEASE READ — THIS IS IMPORTANT</div>
              <div style={{ color: WHITE, fontSize: 12, marginTop: 4 }}>Honest information about what this platform is and is not.</div>
            </div>

            {sec("WHAT THE AI ACTUALLY DOES", <>
              {p("MandaStrong Studio uses Claude (by Anthropic) to generate scripts, format text for narration, write video rendering code, and answer your questions through Agent Grok. It uses your browser's built-in speech synthesis for text-to-speech. It uses HTML5 canvas and MediaRecorder for video rendering.")}
              {p("The AI generates content based on your prompts. It can produce photorealistic-style video scenes, professional scripts, and lifelike narration. However, all outputs are algorithmic. I cannot guarantee that every generation will be perfect. Review everything before you publish or distribute.")}
            </>)}

            {sec("WHAT SUBSCRIBERS GET", <>
              {p("Studio Plan subscribers ($50/mo) get access to the full prompt engine. When you prompt for photorealistic video — real humans, cinematic lighting, specific scenes — the Claude-powered renderer writes custom WebGL/Canvas rendering code for your exact prompt and executes it in your browser. The quality and realism depends on the specificity of your prompt and the capabilities of your device.")}
              {p("Pro Plan subscribers ($30/mo) get 300 AI tools and 4K export. Creator Plan subscribers ($20/mo) get 100 AI tools and 1080p export. If you need a specific feature, check which plan includes it before subscribing.")}
            </>)}

            {sec("WHAT THIS PLATFORM IS NOT", <>
              {p("This is not a legal service, a medical service, a financial service, or any kind of professional advisory service. Nothing generated by MandaStrong Studio constitutes advice of any kind. If you need professional advice, consult a qualified professional.")}
              {p("This is not a cloud storage service. Your projects are saved in your browser's local storage and IndexedDB. Always download your completed productions. Do not rely on the platform to store your work permanently.")}
            </>)}

            {sec("YOUR RESPONSIBILITY", <>
              {p("You are responsible for everything you publish or distribute using content created on this platform. Ensure you have the rights to any media you upload. Ensure AI-generated content is accurate before publishing it as fact. MandaStrong Studio is not liable for how you use what you create here.")}
            </>)}

            {sec("IP & THIRD-PARTY CONTENT", <>
              {p("If you upload media that belongs to someone else, that is your responsibility. I cannot monitor what you upload. Do not use this platform to infringe copyright, and do not generate content designed to misrepresent real people.")}
            </>)}

            <div style={{ background: "#050500", border: `1px solid ${GOLDDIM}`, padding: "12px 16px", marginTop: 8 }}>
              <p style={{ color: GOLDDIM, fontSize: 11, margin: 0, letterSpacing: 1 }}>— AMANDA WOOLLEY · MANDASTRONG STUDIO LLC · MARCH 2026</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
