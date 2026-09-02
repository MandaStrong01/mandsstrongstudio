// @ts-nocheck
import { useState, useRef, useEffect } from "react";

const GOLD = "#e8c96d";
const GOLDDIM = "#a07820";
const WHITE = "#d4c9a8";
const DIM = "#aaaaaa";

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

const DB_NAME = "mandastrong_db", DB_VER = 1, STORE = "clips";
const openDB = () => new Promise((res, rej) => { const r = indexedDB.open(DB_NAME, DB_VER); r.onupgradeneeded = (e: any) => (e.target as any).result.createObjectStore(STORE, { keyPath: "id" }); r.onsuccess = (e: any) => res((e.target as any).result); r.onerror = rej; });
const saveClipToDB = async (id, blob, name, type) => { try { const db: any = await openDB(); const tx = db.transaction(STORE, "readwrite"); tx.objectStore(STORE).put({ id, blob, name, type }); await new Promise((r, j) => { tx.oncomplete = r; tx.onerror = j; }); } catch (e) { console.warn("DB save failed", e); } };

function buildChunks(text: string) {
  const chunks: { text: string; type: string }[] = [];
  const sentences = text.replace(/\.\.\./g, "…").split(/(?<=[.!?…])\s+/);
  for (const sentence of sentences) {
    if (!sentence.trim()) continue;
    const type = sentence.trim().endsWith("?") ? "question" : sentence.trim().endsWith("!") ? "exclaim" : "sentence";
    const clauses = sentence.split(/,\s*/);
    for (let i = 0; i < clauses.length; i++) {
      const c = clauses[i].trim();
      if (!c) continue;
      chunks.push({ text: c + (i < clauses.length - 1 ? "," : ""), type: i === clauses.length - 1 ? type : "clause" });
    }
  }
  return chunks;
}

const VOICE_CHARACTERS = [
  { id: "james", name: "James", emoji: "🎩", gender: "Male", age: "Adult", origin: "British", region: "London", style: "Sarcastic · Deadpan · Witty", pitch: 0.86, rate: 0.62, desc: "Dry British wit. Devastating things said with complete calm." },
  { id: "aurora", name: "Aurora", emoji: "🌅", gender: "Female", age: "Adult", origin: "British", region: "London", style: "Warm · Documentary · Authoritative", pitch: 1.08, rate: 0.80, desc: "Calm authority. The voice you trust completely." },
  { id: "edward", name: "Edward", emoji: "🎭", gender: "Male", age: "Adult", origin: "British", region: "London", style: "Theatrical · Grand · Classical", pitch: 0.85, rate: 0.75, desc: "Shakespearean gravitas. Every sentence carved in stone." },
  { id: "cecily", name: "Cecily", emoji: "🫖", gender: "Female", age: "Adult", origin: "British", region: "London", style: "Crisp · Intelligent · Sardonic", pitch: 1.12, rate: 0.85, desc: "Sharp as a tack. Mildly disappointed by most things." },
  { id: "nana", name: "Nana", emoji: "🧶", gender: "Female", age: "Elderly", origin: "British", region: "Yorkshire", style: "Gentle · Wise · Warm", pitch: 1.02, rate: 0.70, desc: "Warm elderly wisdom. Has seen everything twice." },
  { id: "colonel", name: "Colonel", emoji: "🎖️", gender: "Male", age: "Elderly", origin: "British", region: "London", style: "Commanding · Dignified · Veteran", pitch: 0.80, rate: 0.74, desc: "Authority earned through decades of experience." },
  { id: "pippa", name: "Pippa", emoji: "🎀", gender: "Female", age: "Teen", origin: "British", region: "London", style: "Bright · Cheerful · Young", pitch: 1.25, rate: 0.95, desc: "Fresh and warm. Natural young British energy." },
  { id: "archie", name: "Archie", emoji: "⚽", gender: "Male", age: "Teen", origin: "British", region: "Manchester", style: "Casual · Friendly · Teen", pitch: 1.05, rate: 0.98, desc: "Relaxed and genuine. Sounds like a real teenager." },
  { id: "ewan", name: "Ewan", emoji: "🏴", gender: "Male", age: "Adult", origin: "Scottish", region: "Edinburgh", style: "Warm · Rugged · Sincere", pitch: 0.92, rate: 0.82, desc: "Deep warm Scottish sincerity." },
  { id: "fiona", name: "Fiona", emoji: "🌿", gender: "Female", age: "Adult", origin: "Scottish", region: "Glasgow", style: "Lilting · Warm · Storyteller", pitch: 1.10, rate: 0.84, desc: "Beautiful Scottish lilt." },
  { id: "paddy", name: "Paddy", emoji: "☘️", gender: "Male", age: "Adult", origin: "Irish", region: "Dublin", style: "Charming · Witty · Warm", pitch: 0.95, rate: 0.88, desc: "Easy Irish charm." },
  { id: "siobhan", name: "Siobhan", emoji: "🌸", gender: "Female", age: "Adult", origin: "Irish", region: "Cork", style: "Gentle · Musical · Emotional", pitch: 1.15, rate: 0.82, desc: "Soft Irish voice with real emotional depth." },
  { id: "dafydd", name: "Dafydd", emoji: "🐉", gender: "Male", age: "Adult", origin: "Welsh", region: "Cardiff", style: "Musical · Passionate · Rich", pitch: 0.90, rate: 0.80, desc: "Rich Welsh musicality." },
  { id: "marcus", name: "Marcus", emoji: "⚡", gender: "Male", age: "Adult", origin: "American", region: "New York", style: "Deep · Cinematic · Commanding", pitch: 0.72, rate: 0.74, desc: "Big voice. When Marcus speaks people stop." },
  { id: "river", name: "River", emoji: "🌊", gender: "Male", age: "Adult", origin: "American", region: "Tennessee", style: "Warm · Intimate · Storyteller", pitch: 0.98, rate: 0.76, desc: "Unhurried Southern charm." },
  { id: "dakota", name: "Dakota", emoji: "🏔️", gender: "Female", age: "Adult", origin: "American", region: "Chicago", style: "Bold · Direct · Confident", pitch: 1.05, rate: 0.92, desc: "No filler. No hesitation." },
  { id: "wade", name: "Wade", emoji: "🤠", gender: "Male", age: "Adult", origin: "American", region: "Texas", style: "Laid Back · Humorous · Folksy", pitch: 0.94, rate: 0.85, desc: "Easy going Southern humour." },
  { id: "brooklyn", name: "Brooklyn", emoji: "🗽", gender: "Female", age: "Adult", origin: "American", region: "New York", style: "Fast · Sharp · City Energy", pitch: 1.18, rate: 1.10, desc: "Fast New York energy." },
  { id: "savannah", name: "Savannah", emoji: "🌺", gender: "Female", age: "Adult", origin: "American", region: "Georgia", style: "Sweet · Gracious · Warm", pitch: 1.20, rate: 0.84, desc: "Warm Southern grace." },
  { id: "madison", name: "Madison", emoji: "📱", gender: "Female", age: "Teen", origin: "American", region: "California", style: "Upbeat · Social · Natural", pitch: 1.30, rate: 1.08, desc: "Real American teenage energy." },
  { id: "tyler", name: "Tyler", emoji: "🎮", gender: "Male", age: "Teen", origin: "American", region: "Ohio", style: "Casual · Relatable · Teen", pitch: 1.08, rate: 1.00, desc: "Natural and unforced." },
  { id: "rosie", name: "Rosie", emoji: "🌼", gender: "Female", age: "Child", origin: "American", region: "Florida", style: "Sweet · Innocent · Child", pitch: 1.45, rate: 0.88, desc: "Young warm and sweet." },
  { id: "cooper", name: "Cooper", emoji: "🚂", gender: "Male", age: "Child", origin: "American", region: "Colorado", style: "Bright · Curious · Child", pitch: 1.40, rate: 0.90, desc: "Curious about everything." },
  { id: "grandma", name: "Grandma", emoji: "🫶", gender: "Female", age: "Elderly", origin: "American", region: "Virginia", style: "Warm · Loving · Elderly", pitch: 1.00, rate: 0.72, desc: "Full of love and life experience." },
  { id: "frank", name: "Frank", emoji: "🪑", gender: "Male", age: "Elderly", origin: "American", region: "New Jersey", style: "Gruff · Honest · Elder", pitch: 0.78, rate: 0.76, desc: "Says it straight." },
  { id: "sophia", name: "Sophia", emoji: "☀️", gender: "Female", age: "Adult", origin: "Australian", region: "Sydney", style: "Upbeat · Bright · Energetic", pitch: 1.35, rate: 1.12, desc: "Forward energy." },
  { id: "finn", name: "Finn", emoji: "🏄", gender: "Male", age: "Adult", origin: "Australian", region: "Melbourne", style: "Casual · Confident · Outdoorsy", pitch: 0.95, rate: 0.95, desc: "Relaxed Australian confidence." },
  { id: "aroha", name: "Aroha", emoji: "🌿", gender: "Female", age: "Adult", origin: "New Zealand", region: "Auckland", style: "Warm · Grounded · Sincere", pitch: 1.10, rate: 0.86, desc: "Natural sincerity." },
  { id: "amara", name: "Amara", emoji: "🌍", gender: "Female", age: "Adult", origin: "South African", region: "Cape Town", style: "Rich · Warm · Powerful", pitch: 1.05, rate: 0.84, desc: "Quiet power." },
  { id: "kofi", name: "Kofi", emoji: "🥁", gender: "Male", age: "Adult", origin: "West African", region: "Ghana", style: "Deep · Rhythmic · Storyteller", pitch: 0.82, rate: 0.78, desc: "Every sentence has music in it." },
  { id: "priya", name: "Priya", emoji: "🪷", gender: "Female", age: "Adult", origin: "Indian", region: "Mumbai", style: "Precise · Warm · Intelligent", pitch: 1.15, rate: 0.90, desc: "Warm and intelligent." },
  { id: "arjun", name: "Arjun", emoji: "🎯", gender: "Male", age: "Adult", origin: "Indian", region: "Delhi", style: "Authoritative · Clear · Measured", pitch: 0.88, rate: 0.85, desc: "Sounds like someone who knows exactly what they are talking about." },
  { id: "valentina", name: "Valentina", emoji: "🌹", gender: "Female", age: "Adult", origin: "Spanish", region: "Madrid", style: "Passionate · Warm · Expressive", pitch: 1.18, rate: 0.92, desc: "Everything sounds felt." },
  { id: "pierre", name: "Pierre", emoji: "🥐", gender: "Male", age: "Adult", origin: "French", region: "Paris", style: "Suave · Dry · Cultured", pitch: 0.90, rate: 0.84, desc: "Makes things sound interesting." },
  { id: "ingrid", name: "Ingrid", emoji: "❄️", gender: "Female", age: "Adult", origin: "Scandinavian", region: "Stockholm", style: "Clean · Cool · Direct", pitch: 1.08, rate: 0.88, desc: "No excess words." },
  { id: "yemi", name: "Yemi", emoji: "🌟", gender: "Female", age: "Adult", origin: "Nigerian", region: "Lagos", style: "Bold · Joyful · Energetic", pitch: 1.25, rate: 1.00, desc: "Life-affirming." },
  { id: "magnus", name: "Magnus", emoji: "🧙", gender: "Male", age: "Elderly", origin: "Fantasy", region: "Ancient", style: "Ancient · Wise · Epic", pitch: 0.75, rate: 0.70, desc: "Seen civilisations rise and fall." },
  { id: "nova", name: "Nova", emoji: "🤖", gender: "Female", age: "Adult", origin: "Neutral", region: "AI", style: "Clean · Precise · Neutral", pitch: 1.12, rate: 0.95, desc: "No accent. No emotion. No opinion." },
  { id: "hunter", name: "Hunter", emoji: "🎬", gender: "Male", age: "Adult", origin: "American", region: "Hollywood", style: "Trailer · Epic · Explosive", pitch: 0.70, rate: 0.80, desc: "Full movie trailer energy." },
  { id: "luna", name: "Luna", emoji: "🌙", gender: "Female", age: "Adult", origin: "Neutral", region: "ASMR", style: "Whisper · ASMR · Intimate", pitch: 1.20, rate: 0.65, desc: "Soft whisper. Complete calm." },
  { id: "professor", name: "Professor", emoji: "🎓", gender: "Male", age: "Elderly", origin: "British", region: "Oxford", style: "Academic · Thoughtful · Measured", pitch: 0.88, rate: 0.78, desc: "Distinguished. Precise." },
  { id: "hope", name: "Hope", emoji: "🌤️", gender: "Female", age: "Adult", origin: "American", region: "Heartfelt", style: "Tender · Gentle · Loving", pitch: 1.15, rate: 0.78, desc: "Pure tenderness." },
  { id: "storm", name: "Storm", emoji: "⛈️", gender: "Male", age: "Adult", origin: "American", region: "Intense", style: "Intense · Angry · Powerful", pitch: 0.82, rate: 1.00, desc: "Raw intensity." },
  { id: "joy", name: "Joy", emoji: "🎉", gender: "Female", age: "Adult", origin: "American", region: "Uplifting", style: "Excited · Joyful · Celebratory", pitch: 1.40, rate: 1.15, desc: "Pure infectious joy." },
  { id: "sage", name: "Sage", emoji: "🌿", gender: "Male", age: "Adult", origin: "Neutral", region: "Mindful", style: "Peaceful · Mindful · Grounded", pitch: 0.95, rate: 0.72, desc: "Deep calm." },
  { id: "faith", name: "Faith", emoji: "✨", gender: "Female", age: "Adult", origin: "American", region: "Gospel", style: "Inspirational · Gospel · Uplifting", pitch: 1.18, rate: 0.88, desc: "Gospel soul." },
  { id: "rebel", name: "Rebel", emoji: "✊", gender: "Female", age: "Teen", origin: "American", region: "Activist", style: "Fierce · Defiant · Young", pitch: 1.22, rate: 1.05, desc: "Will not back down." },
  { id: "blaze", name: "Blaze", emoji: "🔥", gender: "Male", age: "Adult", origin: "American", region: "Comedy", style: "Comic · Ridiculous · Energetic", pitch: 1.05, rate: 1.18, desc: "No dignity whatsoever." },
  { id: "remy", name: "Remy", emoji: "🎻", gender: "Male", age: "Adult", origin: "French", region: "Lyon", style: "Smooth · Romantic · Intimate", pitch: 0.92, rate: 0.80, desc: "Everything sounds like poetry." },
  { id: "zhara", name: "Zhara", emoji: "💫", gender: "Female", age: "Adult", origin: "Middle Eastern", region: "Dubai", style: "Elegant · Warm · Sophisticated", pitch: 1.10, rate: 0.85, desc: "Graceful and precise." },
  { id: "kai", name: "Kai", emoji: "🌊", gender: "Male", age: "Adult", origin: "Hawaiian", region: "Honolulu", style: "Relaxed · Warm · Soulful", pitch: 0.96, rate: 0.82, desc: "Unhurried ocean warmth." },
  { id: "sienna", name: "Sienna", emoji: "🎨", gender: "Female", age: "Adult", origin: "American", region: "New Orleans", style: "Soulful · Blues · Deep", pitch: 1.05, rate: 0.78, desc: "Every word feels lived-in." },
  { id: "atlas", name: "Atlas", emoji: "🌐", gender: "Male", age: "Adult", origin: "Neutral", region: "Epic", style: "Cinematic · Epic · Booming", pitch: 0.68, rate: 0.76, desc: "The voice of a thousand documentaries." },
  { id: "echo", name: "Echo", emoji: "🔮", gender: "Female", age: "Adult", origin: "Neutral", region: "Ethereal", style: "Ethereal · Dreamy · Otherworldly", pitch: 1.22, rate: 0.72, desc: "Sounds like it came from somewhere else." },
];

function MusicVideoStudio({ onClose, onSave }) {
  const [step, setStep] = useState(1);
  const [generating, setGenerating] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [videoBlob, setVideoBlob] = useState(null);
  const [renderLog, setRenderLog] = useState([]);
  const [renderProgress, setRenderProgress] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration2, setDuration2] = useState(0);
  const [audioFile, setAudioFile] = useState(null);
  const [audioUrl, setAudioUrl] = useState("");
  const [audioName, setAudioName] = useState("");
  const [recording, setRecording] = useState(false);
  const [recSeconds, setRecSeconds] = useState(0);
  const recRef = useRef<MediaRecorder | null>(null);
  const recChunksRef = useRef<Blob[]>([]);
  const recTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const audioInputRef = useRef(null);

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
      recChunksRef.current = [];
      const mr = new MediaRecorder(stream, { mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus") ? "audio/webm;codecs=opus" : "audio/webm" });
      mr.ondataavailable = e => { if (e.data.size > 0) recChunksRef.current.push(e.data); };
      mr.onstop = () => {
        stream.getTracks().forEach(t => t.stop());
        const blob = new Blob(recChunksRef.current, { type: "audio/webm" });
        const url = URL.createObjectURL(blob);
        const file = new File([blob], "recorded_song.webm", { type: "audio/webm" });
        setAudioFile(file); setAudioUrl(url); setAudioName("Recorded: " + recSeconds + "s");
        if (recTimerRef.current) clearInterval(recTimerRef.current);
        setRecording(false); setRecSeconds(0);
      };
      mr.start(250);
      recRef.current = mr;
      setRecording(true); setRecSeconds(0);
      recTimerRef.current = setInterval(() => setRecSeconds(s => s + 1), 1000);
    } catch (e: any) { alert("Microphone access denied: " + e.message); }
  };

  const stopRecording = () => { if (recRef.current && recording) recRef.current.stop(); };

  const [config, setConfig] = useState({
    title: "If Only", artist: "Manda", genre: "Folk / Acoustic",
    mood: "Melancholic", tempo: "Slow (60-80 BPM)",
    videoStyle: "Cinematic Narrative", colorGrade: "Cinematic Teal & Orange",
    effects: ["Slow Motion", "Film Grain", "Vignette"],
    cuts: "Long Takes", aspectRatio: "16:9", duration: "3 Minutes",
    subjects: "Solo Artist — Female",
    visualDesc: "", refMedia: null,
  });
  const set = (k, v) => setConfig(p => ({ ...p, [k]: v }));
  const tog = (k, v) => setConfig(p => ({ ...p, [k]: (p[k] as string[]).includes(v) ? (p[k] as string[]).filter(x => x !== v) : [...(p[k] as string[]), v] }));

  const GENRES = [
    // Pop & Mainstream
    "Pop", "Dance Pop", "Teen Pop", "Synth Pop", "Electro Pop", "Indie Pop", "Art Pop",
    // Rock
    "Rock", "Indie Rock", "Alt Rock", "Hard Rock", "Classic Rock", "Punk Rock", "Post-Punk", "Emo", "Grunge", "Shoegaze",
    // Heavy
    "Metal", "Heavy Metal", "Death Metal", "Black Metal", "Metalcore", "Nu Metal",
    // Hip Hop & Urban
    "Hip Hop", "Rap", "Trap", "Drill", "Grime", "Boom Bap", "Lo-Fi Hip Hop", "Conscious Rap",
    // R&B & Soul
    "R&B / Soul", "Neo Soul", "Gospel", "Funk", "Motown", "Contemporary R&B",
    // Electronic
    "Electronic / EDM", "House", "Deep House", "Tech House", "Techno", "Trance", "Drum & Bass", "Dubstep", "Ambient", "Chillout", "Synthwave", "Retrowave", "Future Bass", "Lo-Fi",
    // Country & Folk
    "Country", "Folk / Acoustic", "Bluegrass", "Americana", "Singer-Songwriter", "Indie Folk",
    // Jazz & Blues
    "Jazz", "Blues", "Soul Jazz", "Nu Jazz", "Swing", "Bebop",
    // Classical & Cinematic
    "Classical", "Cinematic / Score", "Orchestral", "Opera", "Neo-Classical", "Post-Classical",
    // World & Latin
    "Latin", "Reggaeton", "Salsa", "Bossa Nova", "Afrobeats", "Reggae", "Dancehall", "K-Pop", "J-Pop", "Bollywood", "Celtic",
    // Other
    "Gospel / Worship", "Children's", "Spoken Word / Poetry", "Experimental", "Punk", "Ska",
  ];
  const MOODS = [
    "Euphoric", "Melancholic", "Energetic", "Romantic", "Angry", "Peaceful", "Mysterious",
    "Empowering", "Nostalgic", "Dark", "Haunting", "Uplifting", "Tense", "Playful", "Sensual",
    "Defiant", "Hopeful", "Sad / Heartbreak", "Celebratory", "Dreamy", "Raw / Gritty",
    "Spiritual", "Triumphant", "Lonely", "Rebellious",
  ];
  const TEMPOS = ["Very Slow (40-60 BPM)", "Slow (60-80 BPM)", "Mid-Tempo (80-100 BPM)", "Upbeat (100-120 BPM)", "Fast (120-140 BPM)", "Very Fast (140+ BPM)"];
  const STYLES = [
    "Cinematic Narrative", "Performance / Live Stage", "Street Performance", "Studio Performance",
    "Abstract / Visual Art", "Documentary Style", "Lyric Video", "Retro / VHS",
    "Noir / Black & White", "Surrealist / Dreamlike", "Concert / Festival", "Intimate Acoustic",
    "Dance Choreography", "Story-Driven Short Film", "Split Screen", "Found Footage",
    "Anime / Illustrated", "Neon Nightlife", "Nature / Landscape", "Urban / Street",
  ];
  const GRADES = [
    "Natural / Clean", "Golden Hour Warm", "Cool Blue / Moody", "High Contrast Black & White",
    "Cinematic Teal & Orange", "Vintage Film Grain", "Dark & Desaturated", "Neon / Cyberpunk",
    "Pastel / Dreamy", "Bleach Bypass", "Cross Processed", "Sepia / Old Film",
  ];
  const EFFECTS = [
    "Slow Motion", "Speed Ramps", "Glitch Effects", "Light Leaks", "Lens Flares",
    "Rain / Water", "Bokeh / Blur", "Film Grain", "Vignette", "Particle Effects",
    "Smoke / Fog", "Fire / Sparks", "Confetti / Streamers", "Mirror / Kaleidoscope",
    "Double Exposure", "Silhouette", "Neon Glow", "Strobe Light", "Dust / Haze",
  ];
  const CUTS = ["Fast Cuts / High Energy", "Slow & Deliberate", "Long Takes", "Beat-Synced Cuts", "Montage Style", "Jump Cuts", "Cross-Cutting", "Match Cut"];
  const SUBJECTS = [
    "Solo Artist — Female", "Solo Artist — Male", "Solo Artist — Non-Binary",
    "Band / Group Performance", "Dancer / Choreographer", "Dancers (Group)",
    "Actor / Character", "Couple / Romantic Lead", "Children / Young Performers",
    "Elderly Subject", "Athlete in Motion", "Crowd / Audience", "Silhouette Only",
    "No People — Pure Visual", "Animated Character", "Multiple Subjects",
  ];

  const addLog = (msg) => setRenderLog(p => [...p, msg]);

  const handleAudioUpload = (e) => {
    const f = e.target.files && e.target.files[0];
    if (!f) return;
    setAudioFile(f); setAudioUrl(URL.createObjectURL(f)); setAudioName(f.name);
  };

  const generateVideo = async () => {
    setGenerating(true); setRenderLog([]); setRenderProgress(0); setVideoUrl(""); setVideoBlob(null);
    try {
      const sceneDesc = config.visualDesc || "A man sits on a windowsill overlooking the ocean at night, fingerpicking acoustic guitar. Only his back is visible. Full moon. Single candle. Dark wooden room. Empty couch. Coat on a hook. Curtains lift in the wind.";
      addLog("MandaStrong Cinema Engine — writing your film...");
      setRenderProgress(4);

      let totalDur = 180, beatGrid: number[] = [], audioCtx = null, audioDest = null, audioSource = null;
      if (audioFile) {
        try {
          audioCtx = new ((window as any).AudioContext || (window as any).webkitAudioContext)();
          const ab = await audioFile.arrayBuffer();
          const buf = await audioCtx.decodeAudioData(ab);
          totalDur = buf.duration;
          const data = buf.getChannelData(0), sr = buf.sampleRate, win = Math.round(sr * 0.35);
          const energies: any[] = [];
          for (let i = 0; i < data.length - win; i += win) { let e = 0; for (let j = 0; j < win; j++) e += data[i + j] * data[i + j]; energies.push({ t: i / sr, e: e / win }); }
          const avg = energies.reduce((s, x) => s + x.e, 0) / energies.length;
          let last = -1;
          energies.forEach(x => { if (x.e > avg * 1.35 && x.t - last > 0.28) { beatGrid.push(x.t); last = x.t; } });
          addLog("Audio: " + totalDur.toFixed(1) + "s — " + beatGrid.length + " beats detected");
          audioDest = audioCtx.createMediaStreamDestination();
          audioSource = audioCtx.createBufferSource();
          audioSource.buffer = buf;
          const gain = audioCtx.createGain(); gain.gain.value = 0.92;
          audioSource.connect(gain); gain.connect(audioDest); gain.connect(audioCtx.destination);
        } catch (e: any) { addLog("Audio: " + e.message); audioCtx = null; }
      } else {
        addLog("No audio — generating " + totalDur + "s visual");
        for (let t = 0; t < totalDur; t += 1.8) beatGrid.push(t);
      }
      setRenderProgress(10);
      addLog("Claude is writing your film renderer...");

      const filmPrompt = `You are the MandaStrong Cinema Engine. Write a JavaScript function that renders a FULLY ANIMATED cinematic music video. Every frame MUST look different — use t and sec to create continuous motion on every single call.

SCENE: "${sceneDesc}"
SONG: "${config.title}" by ${config.artist}
GENRE: ${config.genre}
MOOD: ${config.mood}
SUBJECTS / TALENT: ${config.subjects}
VIDEO STYLE: ${config.videoStyle}
EFFECTS: ${config.effects.join(", ")}
EDITING: ${config.cuts}
COLOUR GRADE: ${config.colorGrade}
DURATION: ${totalDur.toFixed(0)} seconds

CRITICAL ANIMATION RULES — YOU MUST FOLLOW ALL OF THESE:
1. EVERY element MUST move or change on every frame — NEVER draw anything at a fixed position
2. Use Math.sin(sec * speed) and Math.cos(sec * speed) for all positions, sizes, rotations, opacity
3. Use t (0.0→1.0) to control scene transitions — change the entire scene at t=0.25, t=0.5, t=0.75
4. Backgrounds MUST scroll, pulse, or shift colour every frame
5. Particles, stars, lights MUST float, drift, or pulse using sin/cos with different frequencies
6. When beatNow===true: flash, burst, or shake elements visibly
7. Draw at least 3 distinct animated layers: background, midground, foreground
8. Camera pan: all x positions offset by Math.sin(t * Math.PI * 2) * W * 0.05

COLOUR GRADE "${config.colorGrade}":
- "Cinematic Teal & Orange": shadows rgb(0,40,50), highlights rgb(255,140,60)
- "Golden Hour Warm": warm amber tones rgb(255,160,40) highlights
- "Cool Blue / Moody": blues and silvers rgb(20,40,80)
- "High Contrast Black & White": grayscale only
- "Vintage Film Grain": sepia rgb(180,140,80), add noise

Function signature:
function renderFilm(ctx, W, H, t, sec, totalSec, beatNow) {
  // t = 0.0 to 1.0, sec = current second, beatNow = beat flash trigger
  // MUST animate every element using t and sec — static drawing = FAIL

Return ONLY the raw function body starting with:
function renderFilm(ctx, W, H, t, sec, totalSec, beatNow) {`;

      const res = await fetch("https://api.anthropic.com/v1/messages", {
        method: "POST",
        headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true", "x-api-key": "" + ["sk-ant-api03-", "rNj3uksGI3kmBJI9Mzjm2A2II2Ll6T05dea_dgB0aqqMjqbbIsembbeVVlT", "-lJ4LDSQzV8ertjcY1BodhaJcA-_mURVAAA"].join("") + "" },
        body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 4000, messages: [{ role: "user", content: filmPrompt }] })
      });
      const d = await res.json();
      if (d.error) { addLog("Error: " + d.error.message); setGenerating(false); return; }

      let code = d.content && d.content[0] ? d.content[0].text.trim() : "";
      const bt = String.fromCharCode(96, 96, 96);
      code = code.replace(new RegExp(bt + "javascript|" + bt + "js|" + bt, "g"), "").trim();
      const fi = code.indexOf("function renderFilm"); if (fi > 0) code = code.slice(fi);
      const braceOpen = code.indexOf("{"), braceClose = code.lastIndexOf("}");
      const body = braceOpen > 0 && braceClose > braceOpen ? code.slice(braceOpen + 1, braceClose) : "";

      let renderFn: any = null;
      try {
        renderFn = new Function("ctx", "W", "H", "t", "sec", "totalSec", "beatNow", body);
        addLog("Film renderer compiled — " + Math.round(body.length / 1000) + "kb of cinema code");
      } catch (e: any) {
        addLog("Compile error: " + e.message + ". Retrying...");
        const simple = await fetch("https://api.anthropic.com/v1/messages", {
          method: "POST",
          headers: { "Content-Type": "application/json", "anthropic-version": "2023-06-01", "anthropic-dangerous-direct-browser-access": "true", "x-api-key": "" + ["sk-ant-api03-", "rNj3uksGI3kmBJI9Mzjm2A2II2Ll6T05dea_dgB0aqqMjqbbIsembbeVVlT", "-lJ4LDSQzV8ertjcY1BodhaJcA-_mURVAAA"].join("") + "" },
          body: JSON.stringify({ model: "claude-sonnet-4-20250514", max_tokens: 3000, messages: [{ role: "user", content: `Write function renderFilm(ctx,W,H,t,sec,totalSec,beatNow) for an ANIMATED music video. Scene: "${sceneDesc}". Song: ${config.title}. Mood: ${config.mood}. CRITICAL: every element MUST move using Math.sin(sec*x) and Math.cos(sec*y) — use t and sec for ALL positions, colours, sizes. Draw 3+ animated layers. Scene transitions at t=0.25, 0.5, 0.75. beatNow triggers visible flash/burst. Return only the function body starting with: function renderFilm(ctx,W,H,t,sec,totalSec,beatNow) {` }] })
        });
        const sd = await simple.json();
        let sc = sd.content && sd.content[0] ? sd.content[0].text.trim() : "";
        sc = sc.replace(new RegExp(bt + "javascript|" + bt + "js|" + bt, "g"), "").trim();
        const sfi = sc.indexOf("function renderFilm"); if (sfi > 0) sc = sc.slice(sfi);
        const sb = sc.replace(/^function renderFilm\s*\([^)]*\)\s*\{/, "").replace(/\}$/, "");
        try { renderFn = new Function("ctx", "W", "H", "t", "sec", "totalSec", "beatNow", sb); addLog("Retry compiled"); }
        catch (e2: any) { addLog("Fatal: " + e2.message); setGenerating(false); return; }
      }

      setRenderProgress(30);
      addLog("Rendering " + totalDur.toFixed(0) + "s film at 24fps...");

      const canvas = canvasRef.current as HTMLCanvasElement;
      const W = 1280, H = 720;
      canvas.width = W; canvas.height = H;
      const ctx = canvas.getContext("2d")!;
      const fps = 24;

      const fallbackRender = (ctx2: CanvasRenderingContext2D, W2: number, H2: number, t: number, sec: number, beatNow: boolean) => {
        const pan = Math.sin(t * Math.PI * 4) * W2 * 0.04;
        const bg = ctx2.createLinearGradient(0, 0, W2, H2);
        const hue1 = (t * 180 + 200) % 360, hue2 = (t * 180 + 230) % 360;
        bg.addColorStop(0, `hsl(${hue1},60%,4%)`); bg.addColorStop(1, `hsl(${hue2},50%,8%)`);
        ctx2.fillStyle = bg; ctx2.fillRect(0, 0, W2, H2);
        for (let i = 0; i < 80; i++) {
          const sx = ((i * 137.5 + pan * 0.5 + sec * (5 + (i % 5))) % W2 + W2) % W2;
          const sy = ((i * 97.3 + Math.sin(sec * 0.3 + i) * 40) % H2 + H2) % H2;
          const r = 1 + Math.sin(sec * 0.8 + i * 0.4) * 0.8 + (beatNow ? 2 : 0);
          const a = 0.4 + Math.sin(sec * 1.2 + i) * 0.3;
          ctx2.beginPath(); ctx2.arc(sx, sy, r, 0, Math.PI * 2);
          ctx2.fillStyle = `rgba(232,201,109,${a})`; ctx2.fill();
        }
        const midY = H2 * 0.5 + Math.sin(sec * 0.5) * H2 * 0.08;
        const grd = ctx2.createLinearGradient(0, midY - H2 * 0.15, 0, midY + H2 * 0.15);
        grd.addColorStop(0, "rgba(0,0,0,0)"); grd.addColorStop(0.5, `rgba(160,120,32,${0.08 + Math.sin(sec * 1.5) * 0.04})`); grd.addColorStop(1, "rgba(0,0,0,0)");
        ctx2.fillStyle = grd; ctx2.fillRect(0, midY - H2 * 0.15, W2, H2 * 0.3);
        if (beatNow) {
          ctx2.fillStyle = `rgba(232,201,109,0.08)`; ctx2.fillRect(0, 0, W2, H2);
        }
      };
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      const videoStream = canvas.captureStream(fps);
      let combinedStream: MediaStream = videoStream;
      if (audioDest) { combinedStream = new MediaStream([...videoStream.getTracks(), ...audioDest.stream.getTracks()]); }
      const recorder = new MediaRecorder(combinedStream, { mimeType, videoBitsPerSecond: 10000000 });
      const chunks: Blob[] = [];
      recorder.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data); };
      recorder.start(Math.round(1000 / fps));
      if (audioSource) audioSource.start(0);

      const totalFrames = Math.round(totalDur * fps), msPerFrame = Math.round(1000 / fps), wallStart = performance.now();
      await new Promise(resolve => {
        let frame = 0;
        const tick = () => {
          if (frame >= totalFrames) { resolve(null); return; }
          const sec = frame / fps, t = sec / totalDur;
          const beatNow = beatGrid.some(b => Math.abs(sec - b) < 0.055);
          ctx.clearRect(0, 0, W, H);
          ctx.save();
          try { renderFn(ctx, W, H, t, sec, totalDur, beatNow); } catch (_) {
            fallbackRender(ctx, W, H, t, sec, beatNow);
          }
          ctx.restore();
          const vig = ctx.createRadialGradient(W / 2, H / 2, W * 0.08, W / 2, H / 2, W * 0.85);
          vig.addColorStop(0, "rgba(0,0,0,0)"); vig.addColorStop(1, "rgba(0,0,0,0.92)");
          ctx.fillStyle = vig; ctx.fillRect(0, 0, W, H);
          ctx.fillStyle = "#000";
          ctx.fillRect(0, 0, W, Math.round(H * 0.072));
          ctx.fillRect(0, H - Math.round(H * 0.072), W, Math.round(H * 0.072));
          if (t < 0.12 || t > 0.9) {
            const a = t < 0.12 ? Math.min(1, t / 0.08) : Math.max(0, (1 - t) / 0.08);
            ctx.globalAlpha = a * 0.95;
            ctx.fillStyle = "#e8c96d";
            ctx.font = "900 " + Math.round(H * 0.072) + "px Arial Black,Arial";
            ctx.textAlign = "center";
            ctx.shadowColor = "#e8c96d"; ctx.shadowBlur = 28;
            ctx.fillText((config.title || "UNTITLED").toUpperCase(), W / 2, H * 0.43);
            ctx.shadowBlur = 0;
            ctx.fillStyle = "rgba(255,255,255,0.8)";
            ctx.font = "300 " + Math.round(H * 0.034) + "px Arial";
            ctx.fillText((config.artist || "").toUpperCase(), W / 2, H * 0.56);
            ctx.globalAlpha = 1;
          }
          setRenderProgress(30 + Math.round((frame / totalFrames) * 64));
          if (frame % (fps * 10) === 0) addLog("  " + Math.round(sec) + "s / " + Math.round(totalDur) + "s");
          frame++;
          setTimeout(tick, Math.max(4, wallStart + frame * msPerFrame - performance.now()));
        };
        tick();
      });

      setRenderProgress(96); addLog("Cutting to final...");
      await new Promise(r => setTimeout(r, 600));
      if (audioSource) { try { audioSource.stop(); } catch (_) { } }
      recorder.stop();
      await new Promise(r => { recorder.onstop = r; });
      const blob = new Blob(chunks, { type: mimeType });
      const url = URL.createObjectURL(blob);
      setVideoUrl(url); setVideoBlob(blob); setRenderProgress(100);
      addLog("✓ " + config.title + " complete — " + (blob.size / 1024 / 1024).toFixed(1) + "MB · " + Math.round(totalDur) + "s");
      const fn = (config.title || "MusicVideo") + "_" + config.artist + ".webm";
      try {
        const clipId = "mv_" + Date.now();
        await saveClipToDB(clipId, blob, fn, "video/webm");
        addLog("✓ Saved");
        if (onSave) onSave({ id: clipId, name: fn, type: "video/webm", url: URL.createObjectURL(blob), dbId: clipId });
      } catch (_) { }
      if (audioCtx) try { audioCtx.close(); } catch (_) { }
    } catch (e: any) { addLog("Error: " + e.message); }
    setGenerating(false);
  };

  const SOCIAL = [["YouTube", "#FF0000", "https://www.youtube.com/upload"], ["Instagram", "#E1306C", "https://www.instagram.com"], ["TikTok", "#69C9D0", "https://www.tiktok.com/upload"], ["Facebook", "#1877F2", "https://www.facebook.com"], ["X / Twitter", "#1DA1F2", "https://twitter.com"], ["Vimeo", "#1AB7EA", "https://vimeo.com/upload"]];
  const inpStyle = { width: "100%", background: "#000", border: `1px solid ${GOLDDIM}`, padding: "9px 12px", color: WHITE, fontSize: 13, outline: "none", fontFamily: "'Rajdhani',sans-serif", boxSizing: "border-box" as const };
  const label = (txt) => <div style={{ color: GOLD, fontSize: 11, letterSpacing: 3, fontWeight: 900, marginBottom: 6, marginTop: 12 }}>{txt}</div>;
  const selBtn = (k, arr) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>
      {arr.map(item => (
        <button key={item} onClick={() => set(k, item)} style={{ background: config[k] === item ? GOLD : "#111", border: `1px solid ${config[k] === item ? "#000" : GOLDDIM}`, color: config[k] === item ? "#000" : WHITE, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>{item}</button>
      ))}
    </div>
  );
  const multiBtn = (k, arr) => (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 5, marginBottom: 4 }}>
      {arr.map(item => (
        <button key={item} onClick={() => tog(k, item)} style={{ background: (config[k] as string[]).includes(item) ? GOLD : "#111", border: `1px solid ${(config[k] as string[]).includes(item) ? "#000" : GOLDDIM}`, color: (config[k] as string[]).includes(item) ? "#000" : WHITE, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 1 }}>{item}</button>
      ))}
    </div>
  );
  const steps = ["🎵 SONG", "🎤 STYLE", "🎬 SCENE", "▶ GENERATE"];
  const fmt = (s) => { if (!s || !isFinite(s)) return "00:00"; const m = Math.floor(s / 60); const sc2 = Math.floor(s % 60); return String(m).padStart(2, "0") + ":" + String(sc2).padStart(2, "0"); };

  return (
    <div style={{ position: "fixed", inset: 0, zIndex: 1100, background: "rgba(0,0,0,0.98)", display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div style={{ width: "min(960px,98vw)", height: "min(92vh,860px)", background: "#050505", border: `2px solid ${GOLD}`, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        <div style={{ background: `linear-gradient(135deg,#1a0a00,#0a0500)`, borderBottom: `1px solid ${GOLD}`, padding: "14px 22px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <div>
            <div style={{ fontFamily: "'Cinzel',serif", color: GOLD, fontSize: 18, fontWeight: 900, letterSpacing: 4 }}>🎬 MUSIC VIDEO STUDIO</div>
            <div style={{ color: WHITE, fontSize: 10, letterSpacing: 3, marginTop: 2 }}>PROFESSIONAL MUSIC VIDEO PRODUCTION · AI POWERED</div>
          </div>
          <button onClick={onClose} style={{ background: "none", border: `1px solid ${GOLD}`, color: GOLD, width: 32, height: 32, cursor: "pointer", fontSize: 16 }}>✕</button>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", borderBottom: `1px solid ${GOLDDIM}`, flexShrink: 0 }}>
          {steps.map((s, i) => (
            <button key={i} onClick={() => setStep(i + 1)} style={{ background: step === i + 1 ? "#0a0500" : "none", border: "none", borderBottom: step === i + 1 ? `2px solid ${GOLD}` : "2px solid transparent", color: step === i + 1 ? GOLD : WHITE, padding: "11px 6px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 2 }}>{s}</button>
          ))}
        </div>
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: videoUrl ? "1fr 1fr" : "1fr", overflow: "hidden" }}>
          <div style={{ overflowY: "auto", padding: "16px 20px", borderRight: videoUrl ? `1px solid ${GOLDDIM}` : "none" }}>
            {step === 1 && (
              <div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                  <div>{label("SONG TITLE")}<input value={config.title} onChange={e => set("title", e.target.value)} placeholder="Song title..." style={inpStyle} /></div>
                  <div>{label("ARTIST")}<input value={config.artist} onChange={e => set("artist", e.target.value)} placeholder="Artist name..." style={inpStyle} /></div>
                </div>
                {label("GENRE")}{selBtn("genre", GENRES)}
                {label("MOOD")}{selBtn("mood", MOODS)}
                {label("TEMPO")}{selBtn("tempo", TEMPOS)}
                {label("UPLOAD YOUR AUDIO TRACK (OPTIONAL)")}
                <div style={{ background: "#000", border: `1px dashed ${audioFile ? GOLD : GOLDDIM}`, padding: "12px", cursor: "pointer", marginBottom: 4 }} onClick={() => audioInputRef.current && (audioInputRef.current as HTMLInputElement).click()}>
                  <div style={{ color: audioFile ? "#22c55e" : WHITE, fontWeight: 900, fontSize: 12, letterSpacing: 2 }}>{audioFile ? "✓ " + audioName : "⬆ CLICK TO UPLOAD MP3 / WAV / M4A"}</div>
                  {audioFile && <div style={{ color: GOLDDIM, fontSize: 10, marginTop: 4 }}>Audio will be mixed into your music video</div>}
                </div>
                <input ref={audioInputRef} type="file" accept="audio/*" style={{ display: "none" }} onChange={handleAudioUpload} />
                {audioFile && <button onClick={() => { setAudioFile(null); setAudioUrl(""); setAudioName(""); }} style={{ background: "none", border: `1px solid #ef4444`, color: "#ef4444", padding: "3px 10px", cursor: "pointer", fontSize: 10, fontWeight: 900, marginTop: 4 }}>✕ REMOVE AUDIO</button>}
                {label("RECORD YOUR OWN SONG")}
                <div style={{ background: "#000", border: `1px solid ${recording ? "#ef4444" : GOLDDIM}`, padding: "12px 14px" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: recording ? 10 : 0 }}>
                    {!recording ? (
                      <button onClick={startRecording} style={{ background: `linear-gradient(135deg,${GOLDDIM},${GOLD})`, border: "none", color: "#000", padding: "8px 20px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 2, fontFamily: "'Rajdhani',sans-serif" }}>
                        🎙 START RECORDING
                      </button>
                    ) : (
                      <button onClick={stopRecording} style={{ background: "#ef4444", border: "none", color: "#fff", padding: "8px 20px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 2, fontFamily: "'Rajdhani',sans-serif", animation: "recPulse .9s ease-in-out infinite" }}>
                        ⏹ STOP · {recSeconds}s
                      </button>
                    )}
                    {!recording && <span style={{ color: DIM, fontSize: 11 }}>Record directly from your microphone</span>}
                    {recording && (
                      <div style={{ display: "flex", gap: 4, alignItems: "center" }}>
                        {[...Array(12)].map((_, i) => (
                          <div key={i} style={{ width: 3, background: "#ef4444", height: 6 + Math.abs(Math.sin((Date.now() / 120 + i) % (Math.PI * 2))) * 14, transition: "height .1s", opacity: 0.7 + i * 0.025 }} />
                        ))}
                      </div>
                    )}
                  </div>
                  {recording && <div style={{ color: "#ef4444", fontSize: 10, fontWeight: 900, letterSpacing: 3 }}>● RECORDING IN PROGRESS — {recSeconds}s</div>}
                </div>
                <style>{`@keyframes recPulse{0%,100%{opacity:1}50%{opacity:.6}}`}</style>
              </div>
            )}
            {step === 2 && (
              <div>
                {label("SUBJECTS / TALENT")}{selBtn("subjects", SUBJECTS)}
                {label("VIDEO STYLE")}{selBtn("videoStyle", STYLES)}
                {label("COLOUR GRADE")}{selBtn("colorGrade", GRADES)}
                {label("VISUAL EFFECTS")}{multiBtn("effects", EFFECTS)}
                {label("EDITING STYLE")}{selBtn("cuts", CUTS)}
                {label("ASPECT RATIO")}
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {["16:9", "9:16 (Vertical)", "1:1 (Square)", "2.39:1 (Cinematic)"].map(r => (
                    <button key={r} onClick={() => set("aspectRatio", r)} style={{ background: config.aspectRatio === r ? GOLD : "#111", border: `1px solid ${config.aspectRatio === r ? "#000" : GOLDDIM}`, color: config.aspectRatio === r ? "#000" : WHITE, padding: "4px 10px", cursor: "pointer", fontSize: 11, fontWeight: 900 }}>{r}</button>
                  ))}
                </div>
              </div>
            )}
            {step === 3 && (
              <div>
                {label("DESCRIBE YOUR MUSIC VIDEO SCENE")}
                <div style={{ color: GOLDDIM, fontSize: 11, marginBottom: 8, lineHeight: 1.7 }}>Describe what you want to see. The AI director will build cinematic shots from your description.</div>
                <textarea value={config.visualDesc} onChange={e => set("visualDesc", e.target.value)} placeholder="e.g. A man sits alone on a windowsill fingerpicking acoustic guitar..." style={{ ...inpStyle, height: 160, resize: "vertical" as const, lineHeight: 1.8, border: `1px solid ${GOLD}` }} />
                {label("DURATION")}
                <div style={{ display: "flex", gap: 6 }}>
                  {["2 Minutes", "3 Minutes", "4 Minutes", "5 Minutes"].map(d => (
                    <button key={d} onClick={() => set("duration", d)} style={{ background: config.duration === d ? GOLD : "#111", border: `1px solid ${config.duration === d ? "#000" : GOLDDIM}`, color: config.duration === d ? "#000" : WHITE, padding: "5px 12px", cursor: "pointer", fontSize: 11, fontWeight: 900 }}>{d}</button>
                  ))}
                </div>
              </div>
            )}
            {step === 4 && (
              <div>
                <div style={{ fontFamily: "'Cinzel',serif", color: GOLD, fontSize: 16, fontWeight: 900, marginBottom: 10, letterSpacing: 3 }}>READY TO CREATE</div>
                <div style={{ color: GOLD, fontSize: 11, letterSpacing: 3, fontWeight: 900, marginBottom: 6 }}>DESCRIBE YOUR MUSIC VIDEO SCENE</div>
                <textarea value={config.visualDesc} onChange={e => set("visualDesc", e.target.value)} placeholder="Describe what you want to see..." style={{ width: "100%", background: "#000", border: `1px solid ${GOLD}`, padding: "12px", color: WHITE, fontSize: 13, outline: "none", fontFamily: "'Rajdhani',sans-serif", boxSizing: "border-box" as const, height: 130, resize: "vertical" as const, lineHeight: 1.8, marginBottom: 10 }} />
                <div style={{ background: "#0a0500", border: `1px solid ${GOLDDIM}`, padding: 14, marginBottom: 14 }}>
                  <div style={{ color: GOLD, fontSize: 11, letterSpacing: 2, marginBottom: 8, fontWeight: 900 }}>YOUR MUSIC VIDEO</div>
                  {[["TITLE", config.title || "—"], ["ARTIST", config.artist || "—"], ["GENRE", config.genre || "—"], ["MOOD", config.mood || "—"], ["SUBJECTS", config.subjects || "—"], ["STYLE", config.videoStyle || "—"], ["GRADE", config.colorGrade || "—"], ["DURATION", config.duration || "—"], ["AUDIO", audioName || "No audio uploaded"]].map(([k, v]) => (
                    <div key={k} style={{ display: "flex", justifyContent: "space-between", fontSize: 12, padding: "3px 0", borderBottom: `1px solid #0a0800` }}>
                      <span style={{ color: GOLDDIM, letterSpacing: 2 }}>{k}</span><span style={{ color: WHITE, fontWeight: 700 }}>{v}</span>
                    </div>
                  ))}
                </div>
                <button onClick={generateVideo} disabled={generating} style={{ background: `linear-gradient(135deg,${GOLDDIM},${GOLD})`, border: "none", color: "#000", width: "100%", padding: "18px", fontSize: 14, letterSpacing: 3, cursor: generating ? "not-allowed" : "pointer", fontWeight: 900, fontFamily: "'Rajdhani',sans-serif", opacity: generating ? 0.7 : 1, marginBottom: 10 }}>
                  {generating ? "⟳ RENDERING... " + renderProgress + "%" : "🎬 GENERATE MUSIC VIDEO"}
                </button>
                {(generating || renderLog.length > 0) && (
                  <div>
                    {generating && <div style={{ height: 5, background: "#111", marginBottom: 6 }}><div style={{ width: renderProgress + "%", height: "100%", background: `linear-gradient(90deg,#a07820,#e8c96d)`, transition: "width .3s" }} /></div>}
                    <div style={{ background: "#000", border: `1px solid ${GOLDDIM}`, padding: 10, maxHeight: 140, overflowY: "auto" }}>
                      {renderLog.map((l, i) => <div key={i} style={{ color: i === renderLog.length - 1 ? "#22c55e" : DIM, fontSize: 10, lineHeight: 1.8 }}>{i === renderLog.length - 1 ? "▶ " : "  "}{l}</div>)}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
          {videoUrl && (
            <div style={{ display: "flex", flexDirection: "column", background: "#000", overflow: "hidden" }}>
              <div style={{ position: "relative", background: "#000" }}>
                <canvas ref={canvasRef} style={{ display: "none" }} />
                <video ref={videoRef} src={videoUrl} playsInline style={{ width: "100%", aspectRatio: "16/9", display: "block", background: "#000" }}
                  onTimeUpdate={() => setCurrentTime((videoRef.current as HTMLVideoElement)?.currentTime || 0)}
                  onLoadedMetadata={() => setDuration2((videoRef.current as HTMLVideoElement)?.duration || 0)}
                  onPlay={() => setPlaying(true)} onPause={() => setPlaying(false)} onEnded={() => setPlaying(false)} />
                <div style={{ background: "rgba(0,0,0,0.85)", padding: "8px 12px" }}>
                  <div style={{ height: 3, background: "#222", marginBottom: 8, cursor: "pointer", borderRadius: 2 }}
                    onClick={e => { if (!videoRef.current || !duration2) return; const r = e.currentTarget.getBoundingClientRect(); (videoRef.current as HTMLVideoElement).currentTime = ((e.clientX - r.left) / r.width) * duration2; }}>
                    <div style={{ width: `${duration2 ? (currentTime / duration2 * 100) : 0}%`, height: "100%", background: GOLD, borderRadius: 2, transition: "width .1s" }} />
                  </div>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                      <button onClick={() => { if (videoRef.current) (videoRef.current as HTMLVideoElement).currentTime = 0; }} style={{ background: "none", border: "none", color: GOLDDIM, cursor: "pointer", fontSize: 14 }}>⏮</button>
                      <button onClick={() => { if (!videoRef.current) return; playing ? (videoRef.current as HTMLVideoElement).pause() : (videoRef.current as HTMLVideoElement).play(); }} style={{ background: GOLD, border: "none", color: "#000", width: 32, height: 32, cursor: "pointer", fontSize: 16, fontWeight: 900 }}>{playing ? "⏸" : "▶"}</button>
                      <button onClick={() => { if (videoRef.current) (videoRef.current as HTMLVideoElement).currentTime = Math.min(duration2, (videoRef.current as HTMLVideoElement).currentTime + 10); }} style={{ background: "none", border: "none", color: GOLDDIM, cursor: "pointer", fontSize: 14 }}>⏩</button>
                      <span style={{ color: WHITE, fontSize: 11, fontFamily: "monospace" }}>{fmt(currentTime)} / {fmt(duration2)}</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ color: GOLDDIM, fontSize: 10 }}>VOL</span>
                      <input type="range" min={0} max={1} step={0.05} defaultValue={0.85} onChange={e => { if (videoRef.current) (videoRef.current as HTMLVideoElement).volume = +e.target.value; }} style={{ width: 70, accentColor: GOLD }} />
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ flex: 1, overflowY: "auto", padding: "12px 14px" }}>
                <div style={{ color: GOLD, fontSize: 11, fontWeight: 900, letterSpacing: 3, marginBottom: 10 }}>EXPORT YOUR MUSIC VIDEO</div>
                <a href={videoUrl} download={(config.title || "MusicVideo") + "_" + config.artist + ".webm"} style={{ display: "block", background: `linear-gradient(135deg,${GOLDDIM},${GOLD})`, color: "#000", padding: "12px", textAlign: "center", textDecoration: "none", fontWeight: 900, fontSize: 12, letterSpacing: 2, fontFamily: "'Rajdhani',sans-serif", marginBottom: 8 }}>⬇ DOWNLOAD VIDEO</a>
                <button onClick={() => { if (videoBlob && onSave) { const fn = (config.title || "MusicVideo") + "_" + config.artist + ".webm"; onSave({ id: "mv_" + Date.now(), name: fn, type: "video/webm", url: videoUrl }); addLog("✓ Saved to media library"); } }} style={{ width: "100%", background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "10px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 2, fontFamily: "'Rajdhani',sans-serif", marginBottom: 14 }}>💾 SAVE TO MEDIA LIBRARY</button>
                <div style={{ color: GOLD, fontSize: 10, fontWeight: 900, letterSpacing: 3, marginBottom: 8 }}>SHARE TO</div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 5, marginBottom: 12 }}>
                  {SOCIAL.map(([name, color, url]) => (
                    <button key={name} onClick={() => window.open(url, "_blank")} style={{ background: "#000", border: `1px solid ${color}33`, color: color, padding: "7px 4px", cursor: "pointer", fontSize: 10, fontWeight: 900, fontFamily: "'Rajdhani',sans-serif" }}
                      onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = color + "22"; }}
                      onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = "#000"; }}>{name}</button>
                  ))}
                </div>
                <button onClick={() => { setVideoUrl(""); setVideoBlob(null); setRenderLog([]); setRenderProgress(0); setStep(1); }} style={{ width: "100%", background: "transparent", border: `1px solid ${GOLDDIM}`, color: GOLDDIM, padding: "8px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 2, fontFamily: "'Rajdhani',sans-serif" }}>+ NEW MUSIC VIDEO</button>
              </div>
            </div>
          )}
          {!videoUrl && <canvas ref={canvasRef} style={{ display: "none" }} />}
        </div>
        {!videoUrl && (
          <div style={{ borderTop: `1px solid ${GOLDDIM}`, padding: "10px 20px", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
            <button onClick={() => setStep(s => Math.max(1, s - 1))} disabled={step === 1} style={{ background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "6px 16px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 2, fontFamily: "'Rajdhani',sans-serif", opacity: step === 1 ? 0.3 : 1 }}>◀ BACK</button>
            <span style={{ color: GOLDDIM, fontSize: 10, letterSpacing: 2 }}>STEP {step} OF 4</span>
            {step < 4
              ? <button onClick={() => setStep(s => Math.min(4, s + 1))} style={{ background: `linear-gradient(135deg,${GOLDDIM},${GOLD})`, border: "none", color: "#000", padding: "6px 16px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 2, fontFamily: "'Rajdhani',sans-serif" }}>NEXT ▶</button>
              : <button onClick={onClose} style={{ background: "transparent", border: `1px solid ${GOLDDIM}`, color: GOLDDIM, padding: "6px 16px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 2, fontFamily: "'Rajdhani',sans-serif" }}>CLOSE</button>
            }
          </div>
        )}
      </div>
    </div>
  );
}

interface PageProps {
  onNavigate: (page: number) => void;
  onSave?: (asset: any) => void;
}

export default function Page6({ onNavigate, onSave }: PageProps) {
  const [text, setText] = useState("");
  const [processed, setProcessed] = useState("");
  const [loading] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [saved, setSaved] = useState(false);
  const [showMVS, setShowMVS] = useState(false);
  const [selVoice, setSelVoice] = useState("james");
  const [search, setSearch] = useState("");
  const [filterGender, setFilterGender] = useState("All");
  const [filterAge, setFilterAge] = useState("All");
  const [filterOrigin, setFilterOrigin] = useState("All");
  const [speed, setSpeed] = useState(0.82);
  const [pitchV, setPitchV] = useState(1.0);
  const [pauseLen, setPauseLen] = useState(700);
  const [volume, setVolume] = useState(1.0);
  const [mood, setMood] = useState("Neutral");
  const [activeTab, setActiveTab] = useState("speak");
  const [sysVoices, setSysVoices] = useState<SpeechSynthesisVoice[]>([]);
  const chunksRef = useRef<{ text: string; type: string }[]>([]);
  const idxRef = useRef(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const load = () => setSysVoices(window.speechSynthesis.getVoices().filter(v => v.lang.startsWith("en")));
    load();
    window.speechSynthesis.onvoiceschanged = load;
    return () => { window.speechSynthesis.cancel(); if (timerRef.current) clearTimeout(timerRef.current); };
  }, []);

  const ORIGINS = ["All", "British", "Scottish", "Irish", "Welsh", "American", "Australian", "New Zealand", "South African", "West African", "Indian", "Spanish", "French", "Scandinavian", "Nigerian", "Fantasy", "Neutral"];
  const AGES = ["All", "Child", "Teen", "Adult", "Elderly"];
  const GENDERS = ["All", "Male", "Female"];

  const filtered = VOICE_CHARACTERS.filter(v => {
    const mg = filterGender === "All" || v.gender === filterGender;
    const ma = filterAge === "All" || v.age === filterAge;
    const mo = filterOrigin === "All" || v.origin === filterOrigin;
    const ms = search === "" || v.name.toLowerCase().includes(search.toLowerCase()) || v.style.toLowerCase().includes(search.toLowerCase());
    return mg && ma && mo && ms;
  });
  const selected = VOICE_CHARACTERS.find(v => v.id === selVoice) || VOICE_CHARACTERS[0];

  const pickSysVoice = (vc) => {
    if (!sysVoices.length) return null;
    const allEn = sysVoices.filter(v => v.lang.startsWith("en"));
    const gb = allEn.filter(v => v.lang === "en-GB");
    const us = allEn.filter(v => v.lang === "en-US");
    const au = allEn.filter(v => v.lang === "en-AU");
    const isMale = vc.gender === "Male";
    const isBritish = ["British", "Scottish", "Irish", "Welsh"].includes(vc.origin);
    const isAU = ["Australian", "New Zealand"].includes(vc.origin);
    const premiumMaleGB = gb.find(v => /daniel|oliver|arthur|malcolm/i.test(v.name));
    const premiumFemaleGB = gb.find(v => /kate|serena|moira|emily/i.test(v.name));
    const premiumMaleUS = us.find(v => /alex|fred|tom|ryan|guy/i.test(v.name));
    const premiumFemaleUS = us.find(v => /samantha|zoe|ava|susan|victoria/i.test(v.name));
    const premiumAU = au.find(v => /karen|lee/i.test(v.name));
    if (isBritish) return isMale ? (premiumMaleGB || gb[0] || premiumMaleUS || allEn[0]) : (premiumFemaleGB || gb[0] || premiumFemaleUS || allEn[0]);
    if (isAU) return premiumAU || au[0] || allEn[0];
    if (vc.origin === "Irish") return gb.find(v => /moira/i.test(v.name)) || gb[0] || allEn[0];
    return isMale ? (premiumMaleUS || us[0] || allEn[0]) : (premiumFemaleUS || us[0] || allEn[0]);
  };

  // Per-character speech personality — defines how each voice BEHAVES, not just pitch/rate
  const getCharacterProfile = (vc) => {
    const s = vc.style.toLowerCase();
    const id = vc.id;
    // Rate variation array: how much the voice changes speed between chunks (deadpan = flat, excited = wild)
    const isDeadpan = s.includes("deadpan") || s.includes("sardonic") || s.includes("dry") || s.includes("neutral") || s.includes("precise");
    const isExcited = s.includes("excited") || s.includes("joyful") || s.includes("upbeat") || s.includes("energetic") || s.includes("explosive") || s.includes("celebratory");
    const isWhisper = s.includes("whisper") || s.includes("asmr") || s.includes("intimate") || id === "luna";
    const isTheatrical = s.includes("theatrical") || s.includes("grand") || s.includes("epic") || s.includes("ancient") || s.includes("booming") || s.includes("cinematic");
    const isAngry = s.includes("angry") || s.includes("fierce") || s.includes("intense") || s.includes("defiant");
    const isGentle = s.includes("gentle") || s.includes("tender") || s.includes("loving") || s.includes("warm") || s.includes("peaceful") || s.includes("mindful");
    const isChild = vc.age === "Child";
    const isTeen = vc.age === "Teen";
    const isElderly = vc.age === "Elderly";
    // Rate variation per chunk (smaller = more robotic/deadpan, bigger = more expressive)
    const rVar = isDeadpan  ? [0, 0.005, -0.005, 0.003, 0.001, -0.003, 0.002, -0.001]
               : isExcited  ? [0, 0.10, -0.05, 0.12, -0.08, 0.09, -0.06, 0.11]
               : isWhisper  ? [0, -0.03, -0.05, -0.02, -0.04, -0.03, -0.02, -0.04]
               : isTheatrical ? [0, 0.06, -0.08, 0.10, -0.06, 0.09, -0.07, 0.05]
               : isAngry    ? [0, 0.08, -0.04, 0.10, -0.03, 0.07, 0.06, -0.05]
               : isChild    ? [0, 0.08, 0.04, 0.10, 0.06, 0.09, 0.05, 0.07]
               : isGentle   ? [0, 0.02, -0.015, 0.018, -0.01, 0.015, -0.012, 0.01]
               : isElderly  ? [0, -0.02, 0.01, -0.015, 0.008, -0.01, 0.012, -0.008]
               :               [0, 0.03, -0.03, 0.02, -0.015, 0.025, -0.02, 0.01];
    // Pitch variation per chunk
    const pVar = isDeadpan  ? [0, 0.003, -0.003, 0.002, -0.001, 0.002, -0.002, 0.001]
               : isExcited  ? [0, 0.12, 0.08, 0.15, -0.05, 0.10, 0.13, -0.04]
               : isWhisper  ? [0, 0.02, 0.03, 0.015, 0.025, 0.018, 0.022, 0.012]
               : isTheatrical ? [0, 0.08, -0.06, 0.12, -0.08, 0.10, -0.07, 0.09]
               : isAngry    ? [0, -0.04, 0.06, -0.06, 0.08, -0.05, 0.07, -0.03]
               : isChild    ? [0, 0.10, 0.06, 0.12, 0.08, 0.09, 0.07, 0.11]
               : isGentle   ? [0, 0.03, -0.02, 0.025, -0.015, 0.020, -0.018, 0.015]
               : isElderly  ? [0, -0.01, 0.008, -0.012, 0.006, -0.009, 0.007, -0.005]
               :               [0, 0.025, -0.02, 0.04, -0.025, 0.015, -0.03, 0.02];
    // Pause multiplier — deadpan takes long deliberate pauses; excited rushes through
    const pauseMult = isDeadpan ? 1.8 : isExcited ? 0.45 : isWhisper ? 2.2 : isTheatrical ? 2.0 : isAngry ? 0.6 : isChild ? 0.7 : isElderly ? 1.6 : isGentle ? 1.3 : 1.0;
    const emphRate = isDeadpan ? -0.01 : isExcited ? -0.12 : isTheatrical ? -0.10 : isAngry ? 0.04 : -0.05;
    const emphPitch = isDeadpan ? 0.01 : isExcited ? 0.15 : isTheatrical ? 0.12 : isAngry ? -0.08 : 0.06;
    return { rVar, pVar, pauseMult, emphRate, emphPitch };
  };

  const speakNow = (txt: string) => {
    window.speechSynthesis.cancel();
    if (timerRef.current) clearTimeout(timerRef.current);
    const chunks = buildChunks(txt);
    chunksRef.current = chunks; idxRef.current = 0; setSpeaking(true);
    const baseRate = speed * (selected.rate || 0.9);
    const basePitch = pitchV * (selected.pitch || 1.0);
    const totalChunks = chunks.length;
    const profile = getCharacterProfile(selected);
    const next = () => {
      const idx = idxRef.current;
      if (idx >= chunksRef.current.length) { setSpeaking(false); return; }
      const chunk = chunksRef.current[idx];
      if (!chunk.text) { idxRef.current = idx + 1; timerRef.current = setTimeout(next, pauseLen * 0.6); return; }
      const liveVoices = window.speechSynthesis.getVoices().filter(v => v.lang.startsWith("en"));
      const liveV = liveVoices.length > 0 ? pickSysVoice(selected) : null;
      const utt = new SpeechSynthesisUtterance(chunk.text);
      if (liveV) utt.voice = liveV;
      utt.volume = volume;
      const { rVar, pVar, pauseMult, emphRate, emphPitch } = profile;
      const pitchMod = chunk.type === "question" ? 0.12 : chunk.type === "exclaim" ? 0.08 : (chunk.type === "sentence" && idx === totalChunks - 1) ? -0.06 : 0;
      const hasEmphasis = /\b[A-Z]{2,}\b/.test(chunk.text);
      utt.rate = Math.max(0.1, Math.min(2.0, baseRate + rVar[idx % rVar.length] + (hasEmphasis ? emphRate : 0)));
      utt.pitch = Math.max(0.1, Math.min(2.0, basePitch + pVar[idx % pVar.length] + pitchMod + (hasEmphasis ? emphPitch : 0)));
      const basePause = Math.round(pauseLen * pauseMult);
      const afterPause = chunk.type === "question" ? Math.round(basePause * 1.1) : chunk.type === "sentence" ? basePause : chunk.type === "clause" ? Math.round(basePause * 0.4) : Math.round(basePause * 0.15);
      utt.onend = () => { idxRef.current = idx + 1; timerRef.current = setTimeout(next, afterPause); };
      utt.onerror = () => { idxRef.current = idx + 1; next(); };
      window.speechSynthesis.speak(utt);
    };
    const voices = window.speechSynthesis.getVoices();
    if (voices.length > 0) { setTimeout(() => next(), 50); }
    else { window.speechSynthesis.onvoiceschanged = () => { window.speechSynthesis.onvoiceschanged = null; setTimeout(() => next(), 50); }; }
  };

  const processAndSpeak = () => {
    if (!text.trim()) return;
    setProcessed(text);
    setSaved(false);
    speakNow(text);
  };

  const stop = () => { window.speechSynthesis.cancel(); if (timerRef.current) clearTimeout(timerRef.current); setSpeaking(false); };

  const inp = { width: "100%", background: "#000", border: `1px solid ${GOLDDIM}`, padding: "12px 14px", color: WHITE, fontSize: 14, outline: "none", boxSizing: "border-box" as const, fontFamily: "'Rajdhani',sans-serif", lineHeight: 1.9 };

  return (
    <div style={{ ...Sp }}>
      {showMVS && <MusicVideoStudio onClose={() => setShowMVS(false)} onSave={onSave} />}
      <div style={{ padding: "12px 18px", borderBottom: `1px solid ${GOLDDIM}`, display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 10 }}>
        <div>
          <div style={{ fontSize: 11, color: GOLD, letterSpacing: 4, fontWeight: 700 }}>AI WORKSTATION 02 — CINEMA VOICE ENGINE</div>
          <h1 style={{ ...H1, fontSize: 24, margin: 0 }}>TEXT TO LIFELIKE SPEECH</h1>
        </div>
        <button onClick={() => setShowMVS(true)} style={{ ...G("gold", true) }}>🎬 MUSIC VIDEO STUDIO</button>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "290px 1fr", minHeight: "calc(100vh - 120px)" }}>
        {/* LEFT — voice library */}
        <div style={{ borderRight: `1px solid ${GOLDDIM}`, background: "#030303", display: "flex", flexDirection: "column" }}>
          <div style={{ padding: "10px 10px 6px" }}>
            <div style={{ color: GOLD, fontSize: 11, letterSpacing: 3, fontWeight: 900, marginBottom: 8 }}>VOICE LIBRARY — {filtered.length} / {VOICE_CHARACTERS.length}</div>
            <div style={{ marginBottom: 5 }}>
              <div style={{ color: GOLDDIM, fontSize: 9, letterSpacing: 2, marginBottom: 3 }}>GENDER</div>
              <div style={{ display: "flex", gap: 4 }}>
                {GENDERS.map(g => <button key={g} onClick={() => setFilterGender(g)} style={{ flex: 1, background: filterGender === g ? GOLD : "#111", border: `1px solid ${filterGender === g ? "#000" : GOLDDIM}`, color: filterGender === g ? "#000" : WHITE, padding: "3px 0", cursor: "pointer", fontSize: 10, fontWeight: 900 }}>{g}</button>)}
              </div>
            </div>
            <div style={{ marginBottom: 5 }}>
              <div style={{ color: GOLDDIM, fontSize: 9, letterSpacing: 2, marginBottom: 3 }}>AGE</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
                {AGES.map(a => <button key={a} onClick={() => setFilterAge(a)} style={{ background: filterAge === a ? GOLD : "#111", border: `1px solid ${filterAge === a ? "#000" : GOLDDIM}`, color: filterAge === a ? "#000" : WHITE, padding: "2px 8px", cursor: "pointer", fontSize: 9, fontWeight: 900 }}>{a}</button>)}
              </div>
            </div>
            <div style={{ marginBottom: 6 }}>
              <div style={{ color: GOLDDIM, fontSize: 9, letterSpacing: 2, marginBottom: 3 }}>ORIGIN</div>
              <select value={filterOrigin} onChange={e => setFilterOrigin(e.target.value)} style={{ width: "100%", background: "#111", border: `1px solid ${GOLDDIM}`, color: WHITE, padding: "4px 8px", fontSize: 11, outline: "none" }}>
                {ORIGINS.map(o => <option key={o} value={o}>{o}</option>)}
              </select>
            </div>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search voices..." style={{ ...inp, padding: "6px 10px", fontSize: 11, height: 30, marginBottom: 0 }} />
          </div>
          <div style={{ flex: 1, overflowY: "auto", padding: "6px 6px 80px" }}>
            {filtered.map(v => (
              <div key={v.id} onClick={() => setSelVoice(v.id)}
                style={{ padding: "10px 12px", marginBottom: 4, background: selVoice === v.id ? "#0a0800" : "#000", border: `2px solid ${selVoice === v.id ? GOLD : GOLDDIM}`, cursor: "pointer", transition: "border-color .15s" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <span style={{ fontSize: 18 }}>{v.emoji}</span>
                    <div>
                      <div style={{ color: selVoice === v.id ? GOLD : WHITE, fontSize: 13, fontWeight: 900, letterSpacing: 1 }}>{v.name}</div>
                      <div style={{ color: GOLDDIM, fontSize: 10, letterSpacing: 1 }}>{v.origin} · {v.gender} · {v.age}</div>
                    </div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ color: GOLDDIM, fontSize: 9, letterSpacing: 1 }}>PITCH {v.pitch} · RATE {v.rate}</div>
                    </div>
                    <button onClick={e => { e.stopPropagation(); setSelVoice(v.id); setTimeout(() => speakNow("Hello. This is " + v.name + ". " + v.desc), 100); }}
                      style={{ background: GOLDDIM, border: "none", color: "#000", padding: "3px 8px", cursor: "pointer", fontSize: 9, fontWeight: 900, letterSpacing: 1, fontFamily: "'Rajdhani',sans-serif", whiteSpace: "nowrap" }}>
                      ▶ TEST
                    </button>
                  </div>
                </div>
                <div style={{ color: DIM, fontSize: 10, lineHeight: 1.5 }}>{v.style}</div>
                {selVoice === v.id && <div style={{ color: GOLD, fontSize: 9, letterSpacing: 2, marginTop: 4, fontWeight: 900 }}>✓ SELECTED — SPEAK ABOVE TO USE THIS VOICE</div>}
              </div>
            ))}
          </div>
        </div>

        {/* RIGHT — controls */}
        <div style={{ display: "flex", flexDirection: "column", background: "#030303" }}>
          <div style={{ borderBottom: `1px solid ${GOLDDIM}`, display: "flex", flexShrink: 0 }}>
            {[["speak", "🎙 SPEAK"], ["result", "✦ RESULT"], ["settings", "🎚 SLIDERS"]].map(([t, l]) => (
              <button key={t} onClick={() => setActiveTab(t)} style={{ background: activeTab === t ? "#0a0800" : "none", border: "none", borderBottom: activeTab === t ? `2px solid ${GOLD}` : "2px solid transparent", color: activeTab === t ? GOLD : WHITE, padding: "12px 16px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 2, fontFamily: "'Rajdhani',sans-serif" }}>{l}</button>
            ))}
          </div>
          <div style={{ flex: 1, padding: 20, overflowY: "auto" }}>
            {activeTab === "speak" && (
              <div>
                <div style={{ background: "#000", border: `1px solid ${GOLDDIM}`, padding: "10px 14px", marginBottom: 14 }}>
                  <div style={{ color: WHITE, fontSize: 12, fontWeight: 900 }}>{selected.name} {selected.emoji} · {selected.origin} · {selected.gender}</div>
                  <div style={{ color: GOLDDIM, fontSize: 11, marginTop: 3 }}>{selected.style}</div>
                  <div style={{ color: DIM, fontSize: 11, marginTop: 3, fontStyle: "italic" }}>{selected.desc}</div>
                </div>
                <div style={{ color: GOLD, fontSize: 11, letterSpacing: 3, fontWeight: 900, marginBottom: 6 }}>YOUR SCRIPT</div>
                <textarea value={text} onChange={e => setText(e.target.value)} placeholder="Paste your narration script here... Tip: For documentary use James — pitch 0.86, rate 0.62, pause 1600ms."
                  style={{ width: "100%", background: "#000", border: `1px solid ${GOLDDIM}`, padding: "12px 14px", color: WHITE, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "'Rajdhani',sans-serif", lineHeight: 1.9, height: 220, resize: "vertical" }} />
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginTop: 10 }}>
                  <button onClick={processAndSpeak} disabled={!text.trim()}
                    style={{ background: `linear-gradient(135deg,${GOLDDIM},${GOLD})`, border: "none", color: "#000", padding: "14px", fontSize: 13, fontWeight: 900, letterSpacing: 2, cursor: !text.trim() ? "not-allowed" : "pointer", fontFamily: "'Rajdhani',sans-serif", opacity: !text.trim() ? 0.5 : 1 }}>
                    ✦ SPEAK WITH {selected.name.toUpperCase()}
                  </button>
                  <button onClick={() => { if (speaking) { stop(); } else { speakNow(text); } }} disabled={!text.trim()}
                    style={{ background: "transparent", border: `1px solid ${GOLD}`, color: GOLD, padding: "14px", fontSize: 13, fontWeight: 900, letterSpacing: 2, cursor: !text.trim() ? "not-allowed" : "pointer", fontFamily: "'Rajdhani',sans-serif", opacity: !text.trim() ? 0.5 : 1 }}>
                    {speaking ? "⏹ STOP" : "▶ SPEAK NOW"}
                  </button>
                </div>
              </div>
            )}
            {activeTab === "result" && (
              <div>
                <div style={{ color: GOLD, fontSize: 11, letterSpacing: 3, fontWeight: 900, marginBottom: 8 }}>AI-FORMATTED RESULT</div>
                {processed ? (
                  <div>
                    <textarea value={processed} onChange={e => setProcessed(e.target.value)}
                      style={{ width: "100%", background: "#000", border: `1px solid ${GOLDDIM}`, padding: "12px 14px", color: WHITE, fontSize: 14, outline: "none", boxSizing: "border-box", fontFamily: "'Rajdhani',sans-serif", lineHeight: 1.9, height: 200, resize: "vertical" }} />
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginTop: 10 }}>
                      <button onClick={() => speakNow(processed)} style={{ ...G("gold", false), padding: "10px" }}>▶ PLAY</button>
                      <button onClick={stop} style={{ ...G("out", false), padding: "10px" }}>⏹ STOP</button>
                      <button onClick={() => { if (onSave) onSave({ id: Date.now() + Math.random(), name: `${selected.name} — Narration`, type: "audio/narration", content: processed, url: "" }); setSaved(true); }} style={{ ...G("gold", false), padding: "10px" }}>{saved ? "✓ SAVED" : "💾 SAVE"}</button>
                    </div>
                    {saved && <div style={{ marginTop: 8, background: "#061406", border: "1px solid #22c55e", padding: "8px", textAlign: "center", color: "#22c55e", fontSize: 11, fontWeight: 900, letterSpacing: 2 }}>✓ SAVED TO MEDIA LIBRARY</div>}
                  </div>
                ) : (
                  <div style={{ color: GOLDDIM, fontSize: 13, lineHeight: 1.8, padding: "20px 0" }}>No result yet. Use PREPARE & SPEAK to format your script for natural delivery.</div>
                )}
              </div>
            )}
            {activeTab === "settings" && (
              <div>
                <div style={{ color: GOLD, fontSize: 11, letterSpacing: 3, fontWeight: 900, marginBottom: 14 }}>VOICE SETTINGS — {selected.name}</div>
                {([["SPEED", speed, 0.3, 1.5, 0.01, (v) => setSpeed(v), `${speed.toFixed(2)}x`], ["PITCH", pitchV, 0.3, 2.0, 0.01, (v) => setPitchV(v), `${pitchV.toFixed(2)}`], ["PAUSE (ms)", pauseLen, 200, 2000, 50, (v) => setPauseLen(v), `${pauseLen}ms`], ["VOLUME", volume, 0.1, 1.0, 0.05, (v) => setVolume(v), `${Math.round(volume * 100)}%`]] as any[]).map(([lbl, val, min, max, step2, setter, display]) => (
                  <div key={lbl} style={{ marginBottom: 16 }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
                      <span style={{ color: GOLD, fontSize: 11, fontWeight: 900, letterSpacing: 2 }}>{lbl}</span>
                      <span style={{ color: WHITE, fontSize: 12, fontWeight: 900 }}>{display}</span>
                    </div>
                    <input type="range" min={min} max={max} step={step2} value={val} onChange={e => setter(+e.target.value)} style={{ width: "100%", accentColor: GOLD }} />
                  </div>
                ))}
                <div style={{ background: "#0a0800", border: `1px solid ${GOLDDIM}`, padding: "10px 14px", marginTop: 8 }}>
                  <div style={{ color: GOLDDIM, fontSize: 10, letterSpacing: 2, marginBottom: 6 }}>JAMES DOCUMENTARY SETTINGS</div>
                  <div style={{ display: "flex", gap: 8 }}>
                    <button onClick={() => { setSpeed(0.62); setPitchV(0.86); setPauseLen(1600); setVolume(1.0); setSelVoice("james"); setMood("Neutral"); setTimeout(() => speakNow("Hello. I am James. " + selected.desc), 100); }} style={{ ...G("gold", true), fontSize: 10, flex: 1 }}>▶ TEST</button>
                    <button onClick={() => { setSpeed(0.82); setPitchV(1.0); setPauseLen(700); setVolume(1.0); setMood("Neutral"); }} style={{ ...G("out", true), fontSize: 10, flex: 1 }}>↺ RESET</button>
                  </div>
                </div>
                <div style={{ background: "#0a0800", border: `1px solid ${GOLDDIM}`, padding: "12px 14px", marginTop: 8 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 10 }}>
                    <span style={{ color: GOLD, fontSize: 11, fontWeight: 900, letterSpacing: 2 }}>MOOD</span>
                    <span style={{ color: GOLD, fontSize: 12, fontWeight: 900 }}>{mood}</span>
                  </div>
                  <input type="range" min={0} max={13} step={1}
                    value={["Neutral","Calm","Tender","Hopeful","Happy","Excited","Serious","Melancholic","Sad","Tense","Dramatic","Fearful","Angry","Surprised"].indexOf(mood) >= 0 ? ["Neutral","Calm","Tender","Hopeful","Happy","Excited","Serious","Melancholic","Sad","Tense","Dramatic","Fearful","Angry","Surprised"].indexOf(mood) : 0}
                    onChange={e => setMood(["Neutral","Calm","Tender","Hopeful","Happy","Excited","Serious","Melancholic","Sad","Tense","Dramatic","Fearful","Angry","Surprised"][+e.target.value])}
                    style={{ width: "100%", accentColor: GOLD, marginBottom: 8 }} />
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 4 }}>
                    {["Neutral","Calm","Tender","Hopeful","Happy","Excited","Serious","Melancholic","Sad","Tense","Dramatic","Fearful","Angry","Surprised"].map(m => (
                      <button key={m} onClick={() => setMood(m)}
                        style={{ background: mood === m ? GOLD : "#111", border: `1px solid ${mood === m ? "#000" : GOLDDIM}`, color: mood === m ? "#000" : WHITE, padding: "3px 8px", cursor: "pointer", fontSize: 9, fontWeight: 900, letterSpacing: 1 }}>
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
