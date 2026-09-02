// @ts-nocheck
import { useState } from "react";

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

interface PageProps {
  onNavigate: (page: number) => void;
}

const INITIAL_POSTS = [
  { id: 1, user: "Sarah J.", title: "Epic Action Feature", icon: "🎬", views: 2847, likes: 1522 },
  { id: 2, user: "Mike Chen", title: "Family Documentary", icon: "📽", views: 1256, likes: 812 },
  { id: 3, user: "Emily R.", title: "Short Film Entry", icon: "🏆", views: 3421, likes: 2156 },
  { id: 4, user: "Alex T.", title: "Music Video Cut", icon: "🎵", views: 5234, likes: 4012 },
];

export default function Page22({ onNavigate }: PageProps) {
  const [posts, setPosts] = useState(INITIAL_POSTS);

  return (
    <div style={{ ...Sp, padding: 40 }}>
      <div style={{ maxWidth: 780, margin: "0 auto" }}>
        <div style={{ fontSize: 11, color: GOLD, letterSpacing: 4, marginBottom: 4, fontWeight: 700 }}>CREATOR NETWORK</div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <h1 style={{ ...H1, fontSize: 28, margin: 0 }}>COMMUNITY HUB</h1>
          <button style={{ ...G("gold", false) }}>UPLOAD YOUR MOVIE</button>
        </div>
        {posts.map(p => (
          <div key={p.id} style={{ ...Card(), marginBottom: 8, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 24 }}>{p.icon}</span>
              <div>
                <div style={{ color: GOLD, fontWeight: 900, fontSize: 14 }}>{p.title}</div>
                <div style={{ color: WHITE, fontSize: 12 }}>by {p.user}</div>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ color: WHITE, fontSize: 12 }}>👁 {p.views.toLocaleString()}</span>
              <span style={{ color: WHITE, fontSize: 12 }}>❤️ {p.likes.toLocaleString()}</span>
              <button onClick={() => setPosts(ps => ps.map(x => x.id === p.id ? { ...x, likes: x.likes + 1 } : x))} style={{ ...G("out", true) }}>LIKE</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
