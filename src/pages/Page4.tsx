// @ts-nocheck
import { useState } from "react";
import { supabase } from "../lib/supabase";

const GOLD = "#e8c96d";
const GOLDDIM = "#a07820";
const WHITE = "#d4c9a8";

const G = (v, sm?) => ({
  background: v === "gold" ? `linear-gradient(135deg,${GOLDDIM},${GOLD})` : "transparent",
  border: v === "gold" ? "none" : `1px solid ${GOLD}`,
  color: v === "gold" ? "#000" : GOLD,
  borderRadius: 0, fontWeight: 900,
  padding: sm ? "5px 14px" : "10px 26px",
  fontSize: sm ? 11 : 13,
  cursor: "pointer", letterSpacing: 2, textTransform: "uppercase" as const,
  fontFamily: "'Rajdhani',sans-serif",
});

const Sp = { minHeight: "100vh", background: "#000000", color: WHITE, fontFamily: "'Rajdhani',sans-serif", paddingBottom: 160, width: "100%", overflowX: "hidden" as const };
const H1 = { fontFamily: "'Cinzel',serif", color: GOLD, letterSpacing: 5, textTransform: "uppercase" as const, margin: 0, fontSize: "clamp(16px,3vw,32px)" };
const Card = (x?) => ({ background: "#0a0a0a", border: `1px solid ${GOLDDIM}`, borderRadius: 0, padding: 18, ...(x || {}) });

const STRIPE = {
  basic: "https://buy.stripe.com/00wcN7fcefjNgbtceuafS03",
  pro: "https://buy.stripe.com/cNi8wRe8a3B52kDceuafS04",
  studio: "https://buy.stripe.com/cNi8wRe8a9ZtcZh7YeafS05",
};

interface PageProps {
  onNavigate: (page: number) => void;
}

export default function Page4({ onNavigate }: PageProps) {
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPass, setLoginPass] = useState("");
  const [loginOk, setLoginOk] = useState(false);
  const [loginErr, setLoginErr] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);

  const [regName, setRegName] = useState("");
  const [regEmail, setRegEmail] = useState("");
  const [regPass, setRegPass] = useState("");
  const [regOk, setRegOk] = useState(false);
  const [regErr, setRegErr] = useState("");
  const [regLoading, setRegLoading] = useState(false);

  const [resetEmail, setResetEmail] = useState("");
  const [resetSent, setResetSent] = useState(false);
  const [showReset, setShowReset] = useState(false);

  const inp = {
    width: "100%", background: "#0a0a0a", border: `1px solid ${GOLDDIM}`,
    padding: "10px 12px", color: WHITE, fontSize: 14, marginBottom: 10,
    outline: "none", boxSizing: "border-box" as const, fontFamily: "'Rajdhani',sans-serif",
  };

  const login = async () => {
    if (!loginEmail.includes("@") || !loginPass) {
      setLoginErr("Please enter your email and password."); return;
    }
    setLoginLoading(true); setLoginErr("");
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPass });
      if (error) { setLoginErr(error.message); setLoginLoading(false); return; }
      setLoginOk(true);
      setTimeout(() => onNavigate(5), 800);
    } catch (e: any) {
      setLoginErr(e.message || "Sign in failed.");
    }
    setLoginLoading(false);
  };

  const register = async () => {
    if (!regEmail.includes("@") || regPass.length < 6) {
      setRegErr("Valid email and password (min 6 chars) required."); return;
    }
    setRegLoading(true); setRegErr("");
    try {
      const { error } = await supabase.auth.signUp({
        email: regEmail,
        password: regPass,
        options: { data: { full_name: regName } },
      });
      if (error) { setRegErr(error.message); setRegLoading(false); return; }
      setRegOk(true);
      window.open(STRIPE.studio, "_blank");
      setTimeout(() => onNavigate(5), 1200);
    } catch (e: any) {
      setRegErr(e.message || "Registration failed.");
    }
    setRegLoading(false);
  };

  const sendReset = async () => {
    if (!resetEmail.includes("@")) return;
    await supabase.auth.resetPasswordForEmail(resetEmail);
    setResetSent(true);
  };

  const openProject = () => {
    try {
      const p = JSON.parse(localStorage.getItem("ms_page") || "5");
      onNavigate(p || 5);
    } catch (e) { onNavigate(5); }
  };

  return (
    <div style={{ ...Sp, padding: 40 }}>
      <div style={{ maxWidth: 1000, margin: "0 auto" }}>
        <div style={{ textAlign: "center", marginBottom: 28 }}>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: 6, fontWeight: 700, marginBottom: 4 }}>MANDASTRONG STUDIO · CINEMA INTELLIGENCE PLATFORM</div>
          <h1 style={{ ...H1, fontSize: 28 }}>SIGN IN OR JOIN</h1>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 18, marginBottom: 20 }}>
          {/* Sign In */}
          <div style={{ ...Card() }}>
            <div style={{ fontSize: 11, color: GOLD, letterSpacing: 3, marginBottom: 8, fontWeight: 700 }}>EXISTING USER</div>
            <h2 style={{ ...H1, fontSize: 18, marginBottom: 18 }}>SIGN IN</h2>
            {!showReset ? (
              <>
                <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} placeholder="Email address" style={inp} onKeyDown={e => e.key === "Enter" && login()} />
                <input value={loginPass} onChange={e => setLoginPass(e.target.value)} type="password" placeholder="Password" style={{ ...inp, marginBottom: 8 }} onKeyDown={e => e.key === "Enter" && login()} />
                <button onClick={() => setShowReset(true)} style={{ background: "none", border: "none", color: GOLDDIM, fontSize: 10, cursor: "pointer", letterSpacing: 1, marginBottom: 12, padding: 0, fontFamily: "'Rajdhani',sans-serif" }}>
                  Forgot password?
                </button>
                {loginErr && <div style={{ color: "#ef4444", fontSize: 11, marginBottom: 8, padding: "6px 8px", background: "#1a0000", border: "1px solid #ef444444" }}>{loginErr}</div>}
                {loginOk && (
                  <div style={{ background: "#061406", border: "1px solid #22c55e", padding: "10px", textAlign: "center", marginBottom: 8 }}>
                    <span style={{ color: "#22c55e", fontWeight: 900, fontSize: 14, letterSpacing: 2 }}>✓ LOGIN SUCCESSFUL</span>
                  </div>
                )}
                <button onClick={login} disabled={loginLoading} style={{ ...G("gold", false), width: "100%", padding: "12px", opacity: loginLoading ? 0.6 : 1 }}>
                  {loginLoading ? "⟳ SIGNING IN..." : loginOk ? "✓ ENTERING STUDIO..." : "SIGN IN TO STUDIO"}
                </button>
              </>
            ) : (
              <>
                <div style={{ color: WHITE, fontSize: 12, marginBottom: 10 }}>Enter your email to receive a reset link.</div>
                <input value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="Email address" style={inp} />
                {resetSent
                  ? <div style={{ color: "#22c55e", fontSize: 12, marginBottom: 10 }}>✓ Reset link sent — check your inbox.</div>
                  : <button onClick={sendReset} style={{ ...G("gold", false), width: "100%", padding: "10px", marginBottom: 8 }}>SEND RESET LINK</button>
                }
                <button onClick={() => { setShowReset(false); setResetSent(false); }} style={{ background: "none", border: "none", color: GOLDDIM, fontSize: 10, cursor: "pointer", letterSpacing: 1, padding: 0, fontFamily: "'Rajdhani',sans-serif" }}>
                  Back to Sign In
                </button>
              </>
            )}
          </div>

          {/* Create Account */}
          <div style={{ ...Card(), border: "2px solid #22c55e", position: "relative" }}>
            <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: "#22c55e", color: "#000", padding: "3px 14px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>
              7-DAY FREE TRIAL
            </div>
            <div style={{ fontSize: 11, color: GOLD, letterSpacing: 3, marginBottom: 8, marginTop: 10, fontWeight: 700 }}>NEW CREATOR</div>
            <h2 style={{ ...H1, fontSize: 18, marginBottom: 18 }}>CREATE ACCOUNT</h2>
            <input value={regName} onChange={e => setRegName(e.target.value)} placeholder="Your Name" style={inp} />
            <input value={regEmail} onChange={e => setRegEmail(e.target.value)} placeholder="Email address" style={inp} />
            <input value={regPass} onChange={e => setRegPass(e.target.value)} type="password" placeholder="Password (min 6 chars)" style={{ ...inp, marginBottom: 8 }} onKeyDown={e => e.key === "Enter" && register()} />
            {regErr && <div style={{ color: "#ef4444", fontSize: 11, marginBottom: 8, padding: "6px 8px", background: "#1a0000", border: "1px solid #ef444444" }}>{regErr}</div>}
            {regOk && (
              <div style={{ background: "#061406", border: "1px solid #22c55e", padding: "8px", textAlign: "center", marginBottom: 8 }}>
                <span style={{ color: "#22c55e", fontWeight: 900, fontSize: 12, letterSpacing: 1 }}>✓ ACCOUNT CREATED — OPENING PAYMENT...</span>
              </div>
            )}
            <button onClick={register} disabled={regLoading} style={{ width: "100%", padding: "12px", background: regOk ? "#16a34a" : "#22c55e", border: "none", color: "#000", fontWeight: 900, fontSize: 13, cursor: regLoading ? "not-allowed" : "pointer", letterSpacing: 2, fontFamily: "'Rajdhani',sans-serif", opacity: regLoading ? 0.6 : 1 }}>
              {regLoading ? "⟳ CREATING ACCOUNT..." : regOk ? "✓ ENTERING STUDIO..." : "START FREE TRIAL — $0"}
            </button>
          </div>

          {/* Explore First */}
          <div style={{ ...Card(), textAlign: "center" }}>
            <div style={{ fontSize: 36, marginBottom: 10 }}>👁</div>
            <h2 style={{ ...H1, fontSize: 16, marginBottom: 10 }}>EXPLORE FIRST</h2>
            <p style={{ color: WHITE, fontSize: 14, lineHeight: 1.7, marginBottom: 16 }}>Browse 600+ AI tools before committing. No account required.</p>
            <button onClick={() => onNavigate(5)} style={{ ...G("out", false), width: "100%", marginBottom: 10 }}>
              BROWSE AS GUEST
            </button>
            <div style={{ height: 1, background: `${GOLDDIM}44`, marginBottom: 10 }} />
            <button onClick={openProject}
              style={{ width: "100%", padding: "10px", background: `linear-gradient(135deg,#0a2a0a,#0f3d0f)`, border: `1px solid #22c55e`, color: "#22c55e", fontWeight: 900, fontSize: 12, cursor: "pointer", letterSpacing: 2, fontFamily: "'Rajdhani',sans-serif" }}>
              OPEN MY PROJECT
            </button>
          </div>
        </div>

        {/* Subscription Plans */}
        <h2 style={{ ...H1, fontSize: 22, textAlign: "center", marginBottom: 22 }}>SUBSCRIPTION PLANS</h2>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 16 }}>
          {[
            { t: "CREATOR PLAN", p: "20", link: STRIPE.basic, f: ["HD Export 1080p", "100 AI Tools", "10GB Storage", "Email Support"], pop: false, trial: false },
            { t: "PRO PLAN", p: "30", link: STRIPE.pro, f: ["4K Export", "300 AI Tools", "100GB Storage", "Priority Support", "Commercial License"], pop: true, trial: false },
            { t: "STUDIO PLAN", p: "50", link: STRIPE.studio, f: ["8K Export", "600+ AI Tools", "1TB Storage", "24/7 Support", "Full Rights", "API Access", "7-Day Free Trial"], pop: false, trial: true },
          ].map(plan => (
            <div key={plan.t} style={{ ...Card(), border: plan.pop ? `2px solid ${GOLD}` : `1px solid ${GOLDDIM}`, position: "relative" }}>
              {plan.pop && (
                <div style={{ position: "absolute", top: -11, left: "50%", transform: "translateX(-50%)", background: GOLD, color: "#000", padding: "2px 12px", fontSize: 11, fontWeight: 900, whiteSpace: "nowrap" }}>
                  MOST POPULAR
                </div>
              )}
              {plan.trial && (
                <div style={{ position: "absolute", top: -11, right: 12, background: "#22c55e", color: "#000", padding: "2px 10px", fontSize: 11, fontWeight: 900 }}>
                  FREE TRIAL
                </div>
              )}
              <div style={{ color: WHITE, fontSize: 11, letterSpacing: 3, fontWeight: 700 }}>{plan.t}</div>
              <div style={{ color: GOLD, fontFamily: "'Cinzel',serif", fontSize: 34, fontWeight: 900, margin: "8px 0" }}>
                ${plan.p}<span style={{ fontSize: 12, color: WHITE }}>/mo</span>
              </div>
              <div style={{ margin: "12px 0" }}>
                {plan.f.map(f => (
                  <div key={f} style={{ color: WHITE, fontSize: 13, padding: "3px 0", borderBottom: "1px solid #0a0a0a" }}>✓ {f}</div>
                ))}
              </div>
              <button onClick={() => window.open(plan.link, "_blank")} style={{ ...G(plan.trial ? "out" : "gold", false), width: "100%" }}>
                {plan.trial ? "START FREE TRIAL" : "SUBSCRIBE NOW"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
