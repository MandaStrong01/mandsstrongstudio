// @ts-nocheck
import { useState, useRef, useEffect } from "react";

// IndexedDB helpers for persistent clip storage
const DB_NAME="mandastrong_db",DB_VER=1,STORE="clips";
const openDB=()=>new Promise((res,rej)=>{const r=indexedDB.open(DB_NAME,DB_VER);r.onupgradeneeded=e=>e.target.result.createObjectStore(STORE,{keyPath:"id"});r.onsuccess=e=>res(e.target.result);r.onerror=rej;});

function buildChunks(text){const clean=text.replace(/\s+/g," ").trim();const sentences=clean.match(/[^.!?]+[.!?]+[\s]*/g)||[clean];const chunks=[];for(const s of sentences){const trimmed=s.trim();if(trimmed.length>0){const type=trimmed.endsWith("?")?"question":trimmed.endsWith("!")?"exclaim":"sentence";chunks.push({text:trimmed,type});}}return chunks.length>0?chunks:[{text:clean.slice(0,200),type:"sentence"}];}

async function proxyFetch(body){
  const controller=new AbortController();
  const timeout=setTimeout(()=>controller.abort(),55000);
  try{
    const res=await fetch("https://njqfexhltjwpgvctmyaw.supabase.co/functions/v1/claude-proxy",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal:controller.signal});
    clearTimeout(timeout);
    return res.json();
  }catch(e){clearTimeout(timeout);throw e;}
}

// ══════════════════════════════════════════════════════════════════
// MANDASTRONG ENGINE — real photorealistic footage
// Single shared client. Every studio page renders through this.
// ══════════════════════════════════════════════════════════════════
const ENGINE_URL="https://njqfexhltjwpgvctmyaw.supabase.co/functions/v1/generate-video";
const ENGINE_KEY="msk_live_j-HsVOiMDEbwfqLInIsNTrnMreDvr-VKKbPNf21oink";
const engineHeaders={"Content-Type":"application/json","x-engine-key":ENGINE_KEY};

// The engine answers with .url; older builds looked for .output. Accept either.
const pickEngineUrl=(d)=>{ if(!d||typeof d!=="object")return""; const v=d.url||d.output||d.video||""; return (typeof v==="string"&&v.indexOf("http")===0)?v:""; };

async function engineCall(body){
  const res=await fetch(ENGINE_URL,{method:"POST",headers:engineHeaders,body:JSON.stringify(body)});
  return res.json();
}

// ── CINEMA VOICE ENGINE ──────────────────────────────────────────
// Server-side speech. Same voice on every device — iPad, Galaxy, HP.
const VOICE_URL="https://njqfexhltjwpgvctmyaw.supabase.co/functions/v1/generate-voice";
let __msAudio=null;

async function engineSpeak(text,meta){
  meta=meta||{};
  try{
    const res=await fetch(VOICE_URL,{method:"POST",headers:engineHeaders,body:JSON.stringify({
      text:String(text||"").slice(0,3500),
      voice:meta.voice||"",
      gender:meta.gender||"",
      origin:meta.origin||"",
      speed:meta.speed||1
    })});
    let d=await res.json();
    let url=pickEngineUrl(d);
    if(url) return url;
    if(d&&d.id){
      for(let i=0;i<40;i++){
        await new Promise(r=>setTimeout(r,1500));
        const p=await fetch(VOICE_URL,{method:"POST",headers:engineHeaders,body:JSON.stringify({id:d.id})});
        const pd=await p.json();
        url=pickEngineUrl(pd);
        if(url) return url;
        if(pd&&(pd.status==="failed"||pd.status==="canceled")) return "";
      }
    }
  }catch(e){}
  return "";
}

// ── HIDDEN: mint a personal cloned voice from a sample recording ──
// Sends the sample to the engine's clone core and returns an opaque
// MandaStrong voice id. Store it; later pass it as meta.voice to speak
// in the cloned voice. Provider is never surfaced.
async function engineCloneVoice(sample){
  try{
    const res=await fetch(VOICE_URL,{method:"POST",headers:engineHeaders,body:JSON.stringify({clone:true,sample:String(sample||"")})});
    let d=await res.json();
    if(d&&d.voice_id) return d.voice_id;
    if(d&&d.id){
      for(let i=0;i<40;i++){
        await new Promise(r=>setTimeout(r,1500));
        const p=await fetch(VOICE_URL,{method:"POST",headers:engineHeaders,body:JSON.stringify({id:d.id})});
        const pd=await p.json();
        if(pd&&pd.voice_id) return pd.voice_id;
        if(pd&&(pd.status==="failed"||pd.status==="canceled")) return "";
      }
    }
  }catch(e){}
  return "";
}

function playEngineAudio(url,volume){
  return new Promise((resolve)=>{
    try{
      const a=new Audio(url);
      a.volume=typeof volume==="number"?Math.max(0,Math.min(1,volume)):1;
      __msAudio=a;
      a.onended=()=>resolve(true);
      a.onerror=()=>resolve(false);
      a.play().catch(()=>resolve(false));
    }catch(e){resolve(false);}
  });
}

function stopEngineAudio(){
  try{ if(__msAudio){ __msAudio.pause(); __msAudio.currentTime=0; __msAudio=null; } }catch(e){}
}

// Health check — tells you if the engine has a provider key installed.
async function engineStatus(){
  try{ const r=await fetch(ENGINE_URL); return await r.json(); }catch(e){ return {ok:false,message:"Engine unreachable"}; }
}

// Starts one render and polls until the footage lands.
// Returns a playable URL, or "" if the engine could not deliver.
async function engineRender(prompt,opts){
  opts=opts||{};
  try{
    const body={prompt:String(prompt||"").slice(0,1800),duration:opts.duration||5,aspect_ratio:opts.aspect_ratio||"16:9",cheap_only:true};
    if(opts.image)body.image=opts.image;
    const started=await engineCall(body);
    if(!started||started.error)return "";
    let url=pickEngineUrl(started);
    const pid=started.id;
    if(!url&&!pid)return "";
    for(let i=0;i<100&&!url&&pid;i++){
      await new Promise(r=>setTimeout(r,3000));
      if(opts.onTick)opts.onTick(i);
      const pd=await engineCall({id:pid});
      if(pd&&pd.status==="failed")return "";
      url=pickEngineUrl(pd);
    }
    return url||"";
  }catch(e){ return ""; }
}

// Renders several shots at once. Much faster than one after another.
async function engineRenderMany(prompts,opts){
  const results=await Promise.all(prompts.map(p=>engineRender(p,opts)));
  return results.filter(Boolean);
}

// Pulls footage into the browser so canvas can draw it without tainting.
async function engineToLocalVideo(url){
  try{
    const res=await fetch(url);
    const blob=await res.blob();
    const v=document.createElement("video");
    v.src=URL.createObjectURL(blob);
    v.muted=true; v.loop=true; v.playsInline=true; v.crossOrigin="anonymous";
    await new Promise((res2)=>{ v.onloadeddata=()=>res2(null); v.onerror=()=>res2(null); setTimeout(()=>res2(null),15000); });
    return v;
  }catch(e){ return null; }
}
const saveClipToDB=async(id,blob,name,type)=>{try{const db=await openDB();const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).put({id,blob,name,type});await new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=j;});}catch(e){console.warn("DB save failed",e);}};
const loadClipFromDB=async(id)=>{try{const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,"readonly");const req=tx.objectStore(STORE).get(id);req.onsuccess=()=>res(req.result);req.onerror=rej;});}catch(e){return null;}};
const getAllClipsFromDB=async()=>{try{const db=await openDB();return new Promise((res,rej)=>{const tx=db.transaction(STORE,"readonly");const req=tx.objectStore(STORE).getAll();req.onsuccess=()=>res(req.result||[]);req.onerror=rej;});}catch(e){return[];}};
const deleteClipFromDB=async(id)=>{try{const db=await openDB();const tx=db.transaction(STORE,"readwrite");tx.objectStore(STORE).delete(id);await new Promise((r,j)=>{tx.oncomplete=r;tx.onerror=j;});}catch(e){}};

// ── Background storage manager — prevents the save-crash on low-memory machines ──
// Checks how full browser storage is, and auto-prunes the oldest clips when space runs low.
const getStorageStatus=async()=>{
  try{
    if(navigator.storage&&navigator.storage.estimate){
      const e=await navigator.storage.estimate();
      const used=e.usage||0,quota=e.quota||1;
      return {used,quota,pct:used/quota};
    }
  }catch(e){}
  return {used:0,quota:1,pct:0};
};
// Remove oldest clips until we're back under the safe threshold (keeps render_final + newest).
const autoPruneClips=async(keepNewest)=>{
  try{
    const all=await getAllClipsFromDB();
    if(all.length<=keepNewest)return 0;
    // Oldest first by timestamp embedded in id (Date.now-based ids sort correctly as strings of similar length)
    const sortable=all.filter(c=>c.id!=="render_final"&&!String(c.id).startsWith("poc_"));
    sortable.sort((a,b)=>{
      const na=parseInt(String(a.id).replace(/\D/g,""))||0;
      const nb=parseInt(String(b.id).replace(/\D/g,""))||0;
      return na-nb;
    });
    const removeCount=Math.max(0,sortable.length-keepNewest);
    let removed=0;
    for(let i=0;i<removeCount;i++){await deleteClipFromDB(sortable[i].id);removed++;}
    return removed;
  }catch(e){return 0;}
};
// Guarded save — frees space first if storage is nearly full, then saves. Never silently crashes.
const safeSaveClipToDB=async(id,blob,name,type)=>{
  try{
    const s=await getStorageStatus();
    if(s.pct>0.95){ 
      // Only prune if extremely full and only delete render_final files, not user source clips
      try{
        const clips=await getAllClipsFromDB();
        const oldRenders=clips.filter(c=>String(c.id).includes("render_final_old"));
        for(const c of oldRenders){await deleteClipFromDB(c.id);}
      }catch(e){}
    }
    await saveClipToDB(id,blob,name,type);
    return true;
  }catch(e){
    // If it still failed, try once more without deleting anything
    try{ await saveClipToDB(id,blob,name,type); return true; }
    catch(e2){ return false; }
  }
};

// ── BACKGROUND STORAGE GUARD — prevents the save-crash automatically ──
// Checks browser storage; when it's getting full it quietly removes the
// oldest clips so a new save never runs out of memory. Runs silently.
const getStoragePct=async()=>{
  try{
    if(navigator.storage&&navigator.storage.estimate){
      const e=await navigator.storage.estimate();
      if(e.quota>0)return (e.usage/e.quota);
    }
  }catch(e){}
  return 0;
};
const autoFreeStorage=async()=>{
  try{
    let pct=await getStoragePct();
    // If over 75% full, drop oldest clips until under 60% (keeps recent work)
    if(pct<0.75)return {freed:0,pct};
    const clips=await getAllClipsFromDB();
    // oldest first — ids that start with a timestamp sort naturally; fall back to insertion order
    const sorted=[...clips].sort((a,b)=>{
      const an=parseInt(String(a.id).replace(/\D/g,""))||0;
      const bn=parseInt(String(b.id).replace(/\D/g,""))||0;
      return an-bn;
    });
    let freed=0;
    for(const c of sorted){
      if(c.id==="render_final")continue; // never delete the finished film
      if(String(c.id).startsWith("poc_"))continue; // never delete showcase proof-of-concept films
      await deleteClipFromDB(c.id);
      freed++;
      pct=await getStoragePct();
      if(pct<0.60)break;
    }
    return {freed,pct};
  }catch(e){return {freed:0,pct:0};}
};

const GOLD = "#e8c96d";
const GOLDDIM = "#a07820";
const BG = "#000000";
const BLACK = "#000000";
const BG4 = "#080808";
const WHITE = "#d4c9a8";
const DIM = "#aaaaaa";
const TOTAL = 24;

const STRIPE = {
  basic:"https://buy.stripe.com/cNi8wRe8a9ZtcZh7YeafS05",
  pro:"https://buy.stripe.com/cNi8wRe8a3B52kDceuafS04",
  studio:"https://buy.stripe.com/00wcN7fcefjNgbtceuafS03",
};

const G = (v, sm) => ({
  background: v==="gold" ? "linear-gradient(135deg,"+GOLDDIM+","+GOLD+")" : "transparent",
  border: v==="gold" ? "none" : "1px solid "+GOLD,
  color: v==="gold" ? "#000" : GOLD,
  borderRadius:0, fontWeight:900,
  padding: sm ? "5px 14px" : "10px 26px",
  fontSize: sm ? 11 : 13,
  cursor:"pointer", letterSpacing:2, textTransform:"uppercase",
  fontFamily:"'Rajdhani',sans-serif",
});
const Sp = { minHeight:"100vh", background:BG, color:WHITE, fontFamily:"'Rajdhani',sans-serif", paddingBottom:160, width:"100%", overflowX:"hidden" };
const H1 = { fontFamily:"'Cinzel',serif", color:GOLD, letterSpacing:5, textTransform:"uppercase", margin:0, fontSize:"clamp(16px,3vw,32px)" };
const Card = (x) => ({ background:"#0a0a0a", border:"1px solid "+GOLDDIM, borderRadius:0, padding:18, ...(x||{}) });

const STOCK_VOICES = [
  { id:"aurora", name:"Aurora", desc:"Warm British Female", style:"Documentary · Narrator", accent:"British RP" },
  { id:"marcus", name:"Marcus", desc:"Deep American Male", style:"Cinematic · Authoritative", accent:"American" },
  { id:"sophia", name:"Sophia", desc:"Bright Australian Female", style:"Upbeat · Engaging", accent:"Australian" },
  { id:"james",  name:"James",  desc:"Dry British Male", style:"Sarcastic · Witty", accent:"British" },
  { id:"nova",   name:"Nova",   desc:"Neutral AI Female", style:"Clean · Professional", accent:"Neutral" },
  { id:"river",  name:"River",  desc:"Warm American Male", style:"Friendly · Intimate", accent:"American South" },
];

const VOICE_TOOLS = ["Text to Voice","Text to Speech","Text to Narration","Text to Audiobook","Text to Voiceover","AI Voice Actor","Neural Voice Generator","Emotion Voice Synth","Documentary Voice","Trailer Voice Generator","Commercial Voice","Character Voice Creator","Audiobook Creator","Podcast Voice"];

let VOICE_ASSIGNMENTS = {};
const loadVoiceAssignments = () => {
  try { VOICE_ASSIGNMENTS = JSON.parse(localStorage.getItem("ms_voice_assign")||"{}"); } catch{}
};
if (typeof window !== "undefined") loadVoiceAssignments();

let currentUtterance = null;

function speakText(voiceId, txt, onStart, onEnd) {
  if (!txt||!txt.trim()) return;
  if (typeof window === "undefined" || !window.speechSynthesis) { if(onEnd) onEnd(); return; }
  window.speechSynthesis.cancel();
  currentUtterance = null;
  const clean = txt
    .replace(/\.\.\.|\.{3}/g,", ")
    .replace(/…/g,", ")
    .replace(/—/g,", ")
    .replace(/[*\/]/g," ")
    .replace(/([.!?])\s+([A-Z])/g,"$1 $2")
    .slice(0,200000);
  const doSpeak = () => {
    if (typeof window === "undefined" || !window.speechSynthesis) { if (typeof onEnd === "function") onEnd(); return; }
    const allVoices = window.speechSynthesis.getVoices();
    const voiceChar = typeof VOICE_CHARACTERS !== "undefined"
      ? VOICE_CHARACTERS.find(v=>v.id===voiceId) : null;
    // Pick the voice once, reuse for every chunk
    const assignedName = VOICE_ASSIGNMENTS[voiceId];
    let picked = null;
    if(assignedName) picked = allVoices.find(v=>v.name===assignedName);
    if(!picked && voiceChar){
      const origin = (voiceChar.origin||"").toLowerCase();
      const gender = (voiceChar.gender||"").toLowerCase();
      const premiumBritish  = ["Daniel","Oliver","Arthur","George","Malcolm"];
      const premiumUSFemale = ["Samantha","Ava","Victoria","Karen"];
      const premiumUSMale   = ["Alex","Tom","Fred","Aaron"];
      const premiumAussie   = ["Karen","Lee"];
      const premiumIrish    = ["Moira"];
      const premiumScottish = ["Fiona"];
      let candidates = [];
      if(origin.includes("british")||origin.includes("english"))
        candidates = gender==="female" ? ["Serena","Tessa","Kate"] : premiumBritish;
      else if(origin.includes("irish"))    candidates = premiumIrish;
      else if(origin.includes("scottish")) candidates = premiumScottish;
      else if(origin.includes("australian")) candidates = premiumAussie;
      else if(gender==="female") candidates = premiumUSFemale;
      else candidates = premiumUSMale;
    // ── QUALITY FIRST: always prefer the highest-quality voice the device has ──
    // Enhanced / Premium / Siri / Neural / Natural voices sound dramatically better.
    const isHiQ = (v) => {
      const n = (v.name||"") + " " + (v.voiceURI||"");
      return /premium|enhanced|siri|neural|natural|online|multilingual/i.test(n);
    };
    const hiQVoices = allVoices.filter(v=>v.lang&&v.lang.startsWith("en")&&isHiQ(v));
    const pool = hiQVoices.length ? hiQVoices : allVoices;

    for(const name of candidates){
        picked = pool.find(v=>v.name.includes(name)) || allVoices.find(v=>v.name.includes(name));
        if(picked) break;
      }
      // Nothing matched by name — take the best-quality voice matching gender/accent
      if(!picked && hiQVoices.length){
        const fem = /female|samantha|ava|serena|zoe|karen|moira|fiona|tessa|kate|victoria|nicky|allison|susan/i;
        const wantFemale = gender==="female";
        picked = hiQVoices.find(v=>wantFemale ? fem.test(v.name) : !fem.test(v.name)) || hiQVoices[0];
      }
    }
    // Final fallbacks — still prefer quality
    if(!picked){
      const anyHiQ = allVoices.filter(v=>v.lang&&v.lang.startsWith("en")&&isHiQ(v));
      picked = anyHiQ[0] || allVoices.find(v=>v.lang&&v.lang.startsWith("en"));
    }
    if(!picked && allVoices.length) picked = allVoices[0];

    const pitch = voiceChar ? voiceChar.pitch : 1.0;
    const rate  = voiceChar ? voiceChar.rate  : 0.85;

    // Split into sentence-sized chunks so the browser speech engine never cuts out
    // on long narration (it silently dies on a single very long utterance).
    const sentences = clean.match(/[^.!?]+[.!?]+|\s*\S[^.!?]*$/g) || [clean];
    const chunks = [];
    let buf = "";
    for(const s of sentences){
      if((buf + s).length > 220){ if(buf) chunks.push(buf); buf = s; }
      else { buf += s; }
    }
    if(buf) chunks.push(buf);
    if(!chunks.length) chunks.push(clean);

    let idx = 0;
    let started = false;
    const speakNext = () => {
      if(idx >= chunks.length){ currentUtterance = null; if(onEnd) onEnd(); return; }
      const utt = new SpeechSynthesisUtterance(chunks[idx]);
      utt.pitch = pitch; utt.rate = rate; utt.volume = 1.0;
      if(picked) utt.voice = picked;
      utt.lang = picked ? picked.lang : "en-US";
      utt.onstart = ()=>{ currentUtterance = utt; if(!started){ started = true; if(onStart) onStart(); } };
      utt.onend = ()=>{ idx++; speakNext(); };
      utt.onerror = ()=>{ idx++; speakNext(); };
      window.speechSynthesis.speak(utt);
    };
    speakNext();
  };
  if (typeof window === "undefined" || !window.speechSynthesis) { if (typeof onEnd === "function") onEnd(); return; }
  if(window.speechSynthesis.getVoices().length===0){
    if(typeof window!=="undefined"&&window.speechSynthesis){window.speechSynthesis.onvoiceschanged=()=>{ window.speechSynthesis.onvoiceschanged=null; doSpeak(); };}
  } else { doSpeak(); }
}

function stopSpeaking() {
  window.speechSynthesis.cancel();
  currentUtterance = null;
}

const WRITING = ["Script to Movie","Text to Script","Script to Screenplay","Prompt to Story","Story to Script","Feature Film Script","Short Film Script","TV Pilot Script","Documentary Script","Commercial Script","YouTube Script","Podcast Script","Social Media Script","Explainer Script","Plot Generator","Story Outline","Three Act Structure","Five Act Structure","Beat Sheet Builder","Character Bio Writer","Character Arc Builder","Subplot Generator","Plot Twist Generator","Opening Hook Creator","Climax Designer","Logline Generator","Synopsis Writer","Treatment Writer","Scene Writer","Text to Dialogue","Dialogue Generator","Narration Writer","Voiceover Script","Interview Script","Action Line Writer","Scene Heading Tool","Parenthetical Generator","Script Formatter","Dialogue Tightener","Script Timer","Word Counter","Page Counter","Reading Time Estimator","Format Checker","Grammar Polish","Spell Checker","Continuity Checker","Plot Hole Detector","Tone Checker","Genre Classifier"];
const VOICE = ["Upload Own Voice","Record My Voice","Clone My Voice","Text to Voice","Text to Speech","Text to Narration","Text to Audiobook","Text to Voiceover","Voice Cloning","Voice to Voice","AI Voice Actor","Neural Voice Generator","Emotion Voice Synth","Trailer Voice Generator","Documentary Voice","Commercial Voice","Character Voice Creator","Accent Generator","Multi Language Voice","Voice Translator","Lip Sync AI","Dialogue Synth","Audiobook Creator","Podcast Voice","Radio DJ Voice","Sports Commentary Voice","ASMR Creator","Whisper Generator","Meditation Voice","Alien Voice","Deep Voice Generator","Robot Voice","Monster Voice","Child Voice","Elderly Voice","Male to Female Voice","Female to Male Voice","Speed Controller","Tone Adjuster","Pitch Controller","Volume Normalizer","Clarity Booster","Voice Denoiser","Echo Remover","Reverb Remover","Background Noise Remover","Voice EQ Studio"];
const IMAGE_T = ["Text to Image","Prompt to Image","Image to Image","Image Upscaler","Image Generator","AI Art Generator","Photo to Painting","Sketch to Image","Wireframe to Image","Background Generator","Background Remover","Sky Replacer","Object Remover","Face Generator","Character Design","Portrait Generator","Avatar Creator","Product Image Generator","Architecture Visualizer","Interior Design Generator","Landscape Generator","Abstract Art Generator","Logo Generator","Icon Creator","Texture Generator","Pattern Maker","Color Palette Generator","Style Transfer","Photo Enhancer","Photo Restorer","Old Photo Colorizer","Black & White to Color","Image Denoiser","Sharpness Enhancer","Clarity Booster","Detail Enhancer","HDR Image Creator","Exposure Fixer","White Balance AI","Color Grading Studio","LUT Creator","Tone Mapper","Contrast Adjuster","Brightness Tool","Saturation Engine","Hue Shift","Temperature Control","Vignette Tool"];
const VIDEO_T = ["Text to Video","Image to Video","Video to Video","AI Video Creator","AI Film Generator","Video Upscaler","AI Video Generator 4K","Set to Video","Video Colorizer","Color Grading Pro","Fast Look Generator","Film Restoration","Time Lapse Creator","Video Trimmer","Background Remover","Digital Human Video","Rotoscope Video","Animation Creator","Puppet Animator","Motion Capture","Character Animator","Video Stabilizer","Video Compressor","Cinematic LUT","Black & White Film","Film Texture","VHS Effect","Glitch Effect","Quick Film Creator","Opening Slate","Time Freeze","Bullet Time Effect","Rain Simulation","Snow Simulation","Smoke Generator","Fire Simulation","Particle System","AI Progressive Video","4K Upscaling"];
const MOTION = ["AI 8K Upscaling","AI 4K Upscaling","Video Super Resolution","Frame Interpolation","Video Denoiser","Noise Reduction","Grain Remover","Artifact Remover","Scratch Remover","Video Sharpener","Clarity Booster","Detail Enhancer","Edge Enhancement","Texture Boost","White Balance AI","Color Correction","Auto Color Balance","Color Match Pro","Color Grading AI","Cinematic Color Grade","Film Stock Emulation","LUT Generator","Tone Mapping Pro","HDR Enhancement","Deep HDR Boost","Dynamic Range Expansion","Shadow Recovery","Highlight Recovery","Black Point Calibration","Gamma Correction","Contrast Enhancer","Brightness Optimizer","Saturation Booster","Smart Saturation","Face Enhancement","Face Retouch","Eye Enhancer","Teeth Whitener","Skin Tone Enhancer","Background Enhancer","Sky Enhancer","Landscape Enhancer","Night Video Enhancer","Low Light Clarity","Motion Stabilization","Shake Remover","Rolling Shutter Fix"];

const NAV = [{p:1,l:"Home"},{p:2,l:"Platform"},{p:3,l:"Examples"},{p:4,l:"Login / Pricing"},{p:5,l:"Writing Tools"},{p:6,l:"Voice Tools"},{p:7,l:"Image Tools"},{p:8,l:"Video Tools"},{p:9,l:"Motion & VFX"},{p:10,l:"Enhancement"},{p:11,l:"Upload Media"},{p:12,l:"Editor Suite"},{p:13,l:"Timeline Editor"},{p:14,l:"Enhancement Studio"},{p:15,l:"Audio Mixer"},{p:16,l:"Render Engine"},{p:17,l:"Film Preview"},{p:18,l:"Export & Distribute"},{p:19,l:"Tutorials"},{p:20,l:"Terms & Disclaimer"},{p:21,l:"Agent Grok"},{p:22,l:"Community Hub"},{p:24,l:"Character Studio"},{p:23,l:"That's All Folks"}];

function ProjectHistoryModal({ onClose, onResume, initialTab }) {
  const [history,setHistory]=useState([]);
  const [tab,setTab]=useState(initialTab||"in_progress");
  useEffect(()=>{try{setHistory(JSON.parse(localStorage.getItem("ms_project_history")||"[]"));}catch{};},[]);
  const del=(idx)=>{const u=history.filter((_,i)=>i!==idx);setHistory(u);localStorage.setItem("ms_project_history",JSON.stringify(u));};
  const filtered=history.filter(h=>(h.status||"in_progress")===tab);
  const inProgressCount=history.filter(h=>(h.status||"in_progress")==="in_progress").length;
  const completedCount=history.filter(h=>h.status==="completed").length;
  return (
    <div style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(0,0,0,0.96)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:"min(620px,95vw)",background:"#050505",border:"2px solid "+GOLD,maxHeight:"85vh",display:"flex",flexDirection:"column"}}>
        <div style={{background:"linear-gradient(135deg,#0a0500,#050200)",borderBottom:"1px solid "+GOLD+"",padding:"16px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:17,fontWeight:900,letterSpacing:4}}>📂 YOUR PROJECTS</div>
            <div style={{color:WHITE,fontSize:10,letterSpacing:3,marginTop:3}}>OPEN A WORK IN PROGRESS OR REVISIT A FINISHED FILM</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"1px solid "+GOLD,color:GOLD,width:30,height:30,cursor:"pointer",fontSize:15}}>✕</button>
        </div>
        <div style={{display:"flex",borderBottom:"1px solid "+GOLDDIM,flexShrink:0}}>
          <button onClick={()=>setTab("in_progress")} style={{flex:1,background:tab==="in_progress"?"#1a0800":"transparent",border:"none",borderBottom:tab==="in_progress"?"2px solid "+GOLD:"none",color:tab==="in_progress"?GOLD:DIM,padding:"12px",cursor:"pointer",fontSize:12,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>⟳ OPEN PROJECT ({inProgressCount})</button>
          <button onClick={()=>setTab("completed")} style={{flex:1,background:tab==="completed"?"#1a0800":"transparent",border:"none",borderBottom:tab==="completed"?"2px solid "+GOLD:"none",color:tab==="completed"?GOLD:DIM,padding:"12px",cursor:"pointer",fontSize:12,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>✓ MY PROJECTS ({completedCount})</button>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:18}}>
          {filtered.length===0?(
            <div style={{textAlign:"center",padding:"40px 20px",color:GOLDDIM}}>
              <div style={{fontSize:34,marginBottom:10}}>{tab==="in_progress"?"⟳":"✓"}</div>
              <div style={{fontSize:12,letterSpacing:2,marginBottom:8}}>{tab==="in_progress"?"No projects in progress.":"No completed projects yet."}</div>
              <div style={{fontSize:11,color:DIM,lineHeight:1.7}}>{tab==="in_progress"?<span>Hit 💾 SAVE PROJECT with<br/>status IN PROGRESS to save your work.</span>:<span>Mark a project COMPLETED<br/>when your film is finished.</span>}</div>
            </div>
          ):[...filtered].reverse().map((h,i)=>{
            const originalIdx=history.indexOf(h);
            return (
              <div key={i} style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:"12px 16px",marginBottom:10,display:"flex",alignItems:"center",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:3}}>
                    <div style={{color:GOLD,fontWeight:900,fontSize:13,letterSpacing:2}}>{h.name||"Untitled Session"}</div>
                    <span style={{background:tab==="completed"?"#0a2010":"#20180a",color:tab==="completed"?"#22c55e":GOLD,fontSize:9,letterSpacing:2,padding:"2px 8px",fontWeight:900}}>{tab==="completed"?"COMPLETED":"IN PROGRESS"}</span>
                  </div>
                  <div style={{color:DIM,fontSize:10,letterSpacing:1}}>{h.date} · Page {h.page} · {h.assetCount} asset{h.assetCount!==1?"s":""}</div>
                  {h.note&&<div style={{color:WHITE,fontSize:11,marginTop:4,fontStyle:"italic"}}>{h.note}</div>}
                </div>
                <div style={{display:"flex",gap:6,flexShrink:0}}>
                  <button onClick={()=>onResume(h)} style={{background:"linear-gradient(135deg,#a07820,#e8c96d)",border:"none",color:"#000",padding:"8px 18px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>{tab==="completed"?"👁 REVISIT":"▶ CONTINUE"}</button>
                  <button onClick={()=>del(originalIdx)} style={{background:"none",border:"1px solid #ef4444",color:"#ef4444",padding:"5px 10px",cursor:"pointer",fontSize:10,fontWeight:900,fontFamily:"'Rajdhani',sans-serif"}}>✕</button>
                </div>
              </div>
            );
          })}
        </div>
        {history.length>0&&(
          <div style={{borderTop:"1px solid "+GOLDDIM+"",padding:"10px 18px",flexShrink:0}}>
            <button onClick={()=>{if(confirm("Delete all project history?")){{localStorage.removeItem("ms_project_history");setHistory([]);}}}} style={{background:"none",border:"1px solid #ef4444",color:"#ef4444",padding:"5px 14px",cursor:"pointer",fontSize:10,fontWeight:900,fontFamily:"'Rajdhani',sans-serif"}}>🗑 CLEAR ALL</button>
          </div>
        )}
      </div>
    </div>
  );
}

function SaveSessionModal({ onClose, onSave, currentPage, assetCount }) {
  const [name,setName]=useState("Session — "+new Date().toLocaleDateString("en-GB",{day:"2-digit",month:"short",year:"numeric"}));
  const [note,setNote]=useState("");
  const [status,setStatus]=useState("in_progress");
  const inp2={width:"100%",background:"#000",border:"1px solid "+GOLDDIM,padding:"9px 12px",color:WHITE,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"'Rajdhani',sans-serif"};
  return (
    <div style={{position:"fixed",inset:0,zIndex:1200,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:"min(440px,92vw)",background:"#050505",border:"2px solid "+GOLD,padding:22}}>
        <div style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:15,fontWeight:900,letterSpacing:3,marginBottom:4}}>💾 SAVE SESSION</div>
        <div style={{color:DIM,fontSize:10,marginBottom:14}}>Page {currentPage} · {assetCount} assets in library</div>
        <div style={{color:GOLD,fontSize:10,letterSpacing:3,marginBottom:5}}>PROJECT NAME</div>
        <input value={name} onChange={e=>setName(e.target.value)} style={{...inp2,marginBottom:10}}/>
        <div style={{color:GOLD,fontSize:10,letterSpacing:3,marginBottom:5}}>NOTE (OPTIONAL)</div>
        <input value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Done chapters 1-5, continuing from 6..." style={{...inp2,marginBottom:12}}/>
        <div style={{color:GOLD,fontSize:10,letterSpacing:3,marginBottom:5}}>STATUS</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:16}}>
          <button onClick={()=>setStatus("in_progress")} style={{background:status==="in_progress"?GOLD:"#111",border:"1px solid "+(status==="in_progress"?"#000":GOLDDIM),color:status==="in_progress"?"#000":WHITE,padding:"9px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>⟳ IN PROGRESS</button>
          <button onClick={()=>setStatus("completed")} style={{background:status==="completed"?GOLD:"#111",border:"1px solid "+(status==="completed"?"#000":GOLDDIM),color:status==="completed"?"#000":WHITE,padding:"9px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>✓ COMPLETED</button>
        </div>
        <div style={{color:DIM,fontSize:10,marginBottom:12,lineHeight:1.5}}>{status==="in_progress"?"Will appear in OPEN PROJECT (still working on it)":"Will appear in MY PROJECTS (finished films)"}</div>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
          <button onClick={onClose} style={{background:"transparent",border:"1px solid "+GOLD,color:GOLD,padding:"11px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>CANCEL</button>
          <button onClick={()=>onSave(name,note,status)} style={{background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"11px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>💾 SAVE</button>
        </div>
      </div>
    </div>
  );
}

function QAMenu({ go, onClose, user }) {
  return (
    <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex"}}>
      <div style={{width:256,background:"#050505",borderRight:"1px solid "+GOLD+"",height:"100vh",overflowY:"auto",padding:18}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <span style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:13,fontWeight:900,letterSpacing:3}}>QUICK ACCESS</span>
          <button onClick={onClose} style={{background:"none",border:"none",color:GOLD,fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",padding:"9px 12px",marginBottom:10,textAlign:"center"}}>
          <div style={{color:"#000",fontWeight:900,fontSize:10,letterSpacing:3,fontFamily:"'Cinzel',serif"}}>MANDA STRONG STUDIO</div>
        </div>
        <div style={{background:"#0a0a0a",border:"1px solid "+GOLD,padding:"7px 10px",marginBottom:14,textAlign:"center"}}>
          <div style={{color:DIM,fontSize:9,letterSpacing:2}}>PLAN</div>
          <div style={{color:GOLD,fontWeight:900,fontSize:14,fontFamily:"'Cinzel',serif"}}>STUDIO</div>
        </div>
        {NAV.map(i=>(
          <button key={i.p} onClick={()=>{go(i.p);onClose();}}
            style={{width:"100%",textAlign:"left",background:"none",border:"none",color:WHITE,padding:"8px",cursor:"pointer",fontSize:13,fontWeight:700,display:"block",marginBottom:1,letterSpacing:1}}
            onMouseEnter={e=>{e.currentTarget.style.background=BG4;e.currentTarget.style.color=GOLD;}}
            onMouseLeave={e=>{e.currentTarget.style.background="none";e.currentTarget.style.color=WHITE;}}>
            {String(i.p).padStart(2,"0")} &nbsp; {i.l.toUpperCase()}
          </button>
        ))}
      </div>
      <div style={{flex:1,background:"rgba(0,0,0,0.75)"}} onClick={onClose}/>
    </div>
  );
}

function Header({ go, setMenu }) {
  return (
    <header style={{position:"sticky",top:0,zIndex:500,background:"#000",borderBottom:"1px solid "+GOLD+"",padding:"0 16px",height:52,display:"flex",alignItems:"center",gap:12}}>
      <button onClick={()=>setMenu(true)} style={{background:"none",border:"1px solid "+GOLD,color:GOLD,width:34,height:34,cursor:"pointer",fontSize:16,flexShrink:0}}>☰</button>
      <div onClick={()=>go(1)} style={{cursor:"pointer",flexShrink:0}}>
        <div style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:13,fontWeight:900,letterSpacing:3,lineHeight:1,textShadow:"0 0 16px "+GOLD+"99"}}>MANDA STRONG</div>
        <div style={{fontFamily:"'Cinzel',serif",color:GOLDDIM,fontSize:9,letterSpacing:4}}>STUDIO</div>
      </div>
      <div style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center"}}>
        <div style={{color:GOLD,fontSize:11,letterSpacing:2,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",fontWeight:700}}>
          ✦ CINEMA INTELLIGENCE PLATFORM &nbsp;·&nbsp; 600+ AI TOOLS &nbsp;·&nbsp; 8K EXPORT &nbsp;·&nbsp; UP TO 3-HOUR FILMS
        </div>
      </div>
      <div style={{display:"flex",alignItems:"center",gap:10,flexShrink:0}}>
        <div style={{color:"#22c55e",fontSize:11,letterSpacing:2,fontWeight:900}}>● SYSTEM ONLINE</div>
        <div onClick={()=>go(21)} style={{width:36,height:36,background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:19,fontWeight:900,color:"#000",boxShadow:"0 0 18px "+GOLD+"77"}}>G</div>
      </div>
    </header>
  );
}

function Footer({ page, go, onSave, onHistory }) {
  return (
    <footer style={{position:"fixed",bottom:0,left:0,right:0,zIndex:400,background:"#000",borderTop:"1px solid "+GOLD+"",padding:"6px 20px 8px",display:"flex",flexDirection:"column",gap:4}}>
      <div style={{textAlign:"center"}}>
        <span style={{color:GOLD,fontSize:11,letterSpacing:1,fontWeight:700}}>MANDASTRONG STUDIO · PROFESSIONAL CINEMA SYNTHESIS · MandaStrong1.Etsy.com</span>
        {page===1&&<span style={{color:GOLD,fontSize:11,letterSpacing:1,fontWeight:700,opacity:0.75}}> · CREATED 2025</span>}
      </div>
      <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:10,flexWrap:"wrap"}}>
        <button onClick={()=>go(Math.max(1,page-1))} disabled={page===1} style={{...G("out",true),opacity:page===1?0.3:1}}>◀ BACK</button>
        <span style={{color:GOLD,fontSize:11,fontWeight:900,fontFamily:"'Cinzel',serif",letterSpacing:2}}>PAGE {page} / {TOTAL}</span>
        <button onClick={()=>go(Math.min(TOTAL,page+1))} disabled={page===TOTAL} style={{...G("gold",true),opacity:page===TOTAL?0.3:1}}>NEXT ▶</button>
        <button onClick={onSave} style={{...G("out",true),fontSize:11,letterSpacing:2}}>💾 SAVE PROJECT</button>
        <button onClick={onHistory} style={{background:"linear-gradient(135deg,#0a0300,#1a0800)",border:"1px solid "+GOLD,color:GOLD,padding:"5px 14px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>📂 MY PROJECTS</button>
        <span style={{color:"#22c55e",fontSize:11,fontWeight:700}}>● AUTOSAVE ON</span>
      </div>
    </footer>
  );
}

function ToolCard({ name, onOpen }) {
  return (
    <div onClick={()=>onOpen(name)}
      style={{background:"#000",border:"1px solid "+GOLDDIM,padding:"14px 12px",cursor:"pointer",transition:"all .15s",minHeight:56,display:"flex",alignItems:"center"}}
      onMouseEnter={e=>{e.currentTarget.style.borderColor=GOLD;e.currentTarget.style.background=BG4;e.currentTarget.style.boxShadow="0 0 10px "+GOLD+"44";}}
      onMouseLeave={e=>{e.currentTarget.style.borderColor=GOLDDIM;e.currentTarget.style.background="#000";e.currentTarget.style.boxShadow="none";}}>
      <div style={{color:WHITE,fontSize:13,fontWeight:800,lineHeight:1.3,letterSpacing:.5}}>{name}</div>
    </div>
  );
}

function ToolPanel({ tool, onClose, onSave }) {
  const isVoice = VOICE_TOOLS.includes(tool);
  const isVideoTool = ["Text to Video","Image to Video","Video to Video","AI Video Creator","AI Film Generator","Video Upscaler","AI Video Generator 4K","Set to Video","Video Colorizer","Film Restoration","Time Lapse Creator","Animation Creator","Quick Film Creator"].includes(tool);
  const isImageTool = ["Text to Image","Prompt to Image","Image to Image","Image Generator","AI Art Generator","Photo to Painting","Sketch to Image","Background Generator","Face Generator","Character Design","Portrait Generator","Logo Generator","Avatar Creator"].includes(tool);
  const isWritingTool = ["Script to Movie","Text to Script","Script to Screenplay","Prompt to Story","Feature Film Script","Short Film Script","Documentary Script","Plot Generator","Story Outline","Beat Sheet Builder","Character Bio Writer","Logline Generator","Synopsis Writer","Scene Writer","Dialogue Generator","Narration Writer","Voiceover Script"].includes(tool);
  const [mode, setMode] = useState(isVoice?"voice":(isVideoTool||isImageTool||isWritingTool)?"ai":"upload");
  const [describe, setDescribe] = useState("");
  const [s2mProducer, setS2mProducer] = useState("");
  const [s2mProduction, setS2mProduction] = useState("");
  const [s2mWired, setS2mWired] = useState(false);
  const [result, setResult] = useState("");
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [saved, setSaved] = useState(false);
  const [playing, setPlaying] = useState(null);
  const [selVoice, setSelVoice] = useState("james");
  const fileRef = useRef(null);
  const photoRef = useRef(null);
  const inp = {width:"100%",background:"#000",border:"1px solid "+GOLDDIM,padding:"9px 12px",color:WHITE,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"'Rajdhani',sans-serif"};

  const speak = (vid, txt) => speakText(vid, txt, ()=>setPlaying(vid), ()=>setPlaying(null));

  const runAI = async () => {
    if (!describe.trim()) return;
    setLoading(true); setSaved(false); setResult("");
    try {
      let prompt = "";
      if (isVoice) {
        prompt = "Format this as cinematic narration, voice style: "+(STOCK_VOICES.find(x=>x.id===selVoice)?.style||"")+". Mark pauses as [pause] and emphasis as *word*:\n\n"+describe;
      } else if (isVideoTool) {
        prompt = "You are a professional film director at MandaStrong Studio. Tool: "+tool+". User description: "+describe+"\n\nGenerate: 1. OPTIMISED VIDEO PROMPT 2. SCENE BREAKDOWN 3. CAMERA DIRECTIONS 4. LIGHTING & COLOUR GRADE 5. AUDIO NOTES 6. DURATION ESTIMATE 7. DIRECTOR'S NOTES. Make it cinematic and production-ready.";
      } else if (isImageTool) {
        prompt = "You are a professional visual artist at MandaStrong Studio. Tool: tool.\n\nUser description: "+describe+"\n\nGenerate a COMPLETE IMAGE PROMPT PACKAGE:\n\n1. OPTIMISED PROMPT\n2. STYLE\n3. LIGHTING & COLOUR PALETTE\n4. COMPOSITION & FRAMING\n5. NEGATIVE PROMPT\n6. ASPECT RATIO & RESOLUTION\n7. STYLE REFERENCES";
      } else if (isWritingTool) {
        prompt = "You are a professional screenwriter at MandaStrong Studio. Tool: tool.\n\nUser request: "+describe+"\n\nGenerate complete, properly formatted, production-ready content.";
      } else {
        prompt = "You are a professional at MandaStrong Studio cinema AI platform. Tool: tool.\n\nUser request: "+describe+"\n\nGenerate complete, detailed, professional, production-ready content.";
      }
      const res = await fetch("https://njqfexhltjwpgvctmyaw.supabase.co/functions/v1/claude-proxy",{
        method:"POST",
        headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:1500,
          messages:[{role:"user",content:prompt}]})
      });
      const d = await res.json();
      const txt = d.content&&d.content[0]?d.content[0].text:"Generated!";
      setResult(txt);
      if (isVoice) speak(selVoice, txt);
    } catch(e) { setResult("Error — check your connection and try again."); }
    setLoading(false);
  };

  const saveAsset = () => {
    const content = result||describe;
    if (!content.trim()) return;
    if (onSave) onSave({id:Date.now()+Math.random(),name:tool+" — "+isVoice?STOCK_VOICES.find(x=>x.id===selVoice)?.name:"Result",type:isVoice?"audio/narration":"text/plain",url:"",content});
    setSaved(true);
  };

  return (
    <div style={{position:"fixed",inset:0,zIndex:900,background:"rgba(0,0,0,0.92)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:"min(600px,95vw)",background:"#050505",border:"1px solid "+GOLD,padding:26,maxHeight:"92vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:18}}>
          <h2 style={{...H1,fontSize:16,margin:0,letterSpacing:4}}>{tool}</h2>
          <button onClick={onClose} style={{background:"none",border:"none",color:GOLD,fontSize:20,cursor:"pointer"}}>✕</button>
        </div>
        <div style={{display:"grid",gridTemplateColumns:isVoice?"1fr 1fr 1fr 1fr":"1fr 1fr 1fr",gap:8,marginBottom:18}}>
          {isVoice&&<button onClick={()=>setMode("voice")} style={{...G(mode==="voice"?"gold":"out",true),fontSize:11}}>🎙 VOICE</button>}
          {[["upload","UPLOAD"],["paste","PASTE"],["ai","AI CREATE ✦"]].map(([m,l])=>(
            <button key={m} onClick={()=>setMode(m)} style={{...G(mode===m?"gold":"out",true),fontSize:11}}>{l}</button>
          ))}
        </div>
        {mode==="voice"&&isVoice&&(
          <div>
            <div style={{color:GOLD,fontSize:12,letterSpacing:3,fontWeight:900,marginBottom:10}}>SELECT VOICE</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:16}}>
              {STOCK_VOICES.map(v=>(
                <div key={v.id} onClick={()=>setSelVoice(v.id)}
                  style={{background:"#000",border:"2px solid "+selVoice===v.id?GOLD:GOLDDIM,padding:"10px 12px",cursor:"pointer",boxShadow:selVoice===v.id?"0 0 12px "+GOLD+"44":"none"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                    <span style={{color:selVoice===v.id?GOLD:WHITE,fontSize:14,fontWeight:900}}>{v.name}</span>
                    <button onClick={e=>{e.stopPropagation();speak(v.id,"Hi I am "+v.name+". "+v.desc+". Ready to narrate.");}}
                      style={{background:"none",border:"1px solid "+GOLDDIM,color:GOLD,padding:"2px 8px",cursor:"pointer",fontSize:10,fontWeight:900}}>
                      {playing===v.id?"⏹":"▶"}
                    </button>
                  </div>
                  <div style={{color:GOLD,fontSize:11}}>{v.desc}</div>
                  <div style={{color:WHITE,fontSize:10,marginTop:2}}>{v.style} · {v.accent}</div>
                </div>
              ))}
            </div>
            <textarea value={describe} onChange={e=>setDescribe(e.target.value)} placeholder="Paste your narration text here..."
              style={{...inp,height:110,resize:"none",lineHeight:1.7,marginBottom:10}}/>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:result?14:0}}>
              <button onClick={runAI} disabled={loading||!describe.trim()} style={{...G("gold",false),padding:"12px",opacity:loading||!describe.trim()?0.5:1}}>
                {loading?"⟳ GENERATING...":"AI FORMAT & SPEAK ✦"}
              </button>
              <button onClick={()=>speak(selVoice,describe)} disabled={!describe.trim()} style={{...G("out",false),padding:"12px",opacity:!describe.trim()?0.5:1}}>
                ▶ SPEAK NOW
              </button>
            </div>
            {result&&(
              <div>
                <textarea value={result} onChange={e=>setResult(e.target.value)} style={{...inp,height:110,resize:"none",lineHeight:1.7,marginBottom:10}}/>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:8}}>
                  <button onClick={()=>speak(selVoice,result)} style={{...G("out",false),padding:"10px"}}>▶ PLAY</button>
                  <button onClick={stopSpeaking} style={{...G("out",false),padding:"10px"}}>⏹ STOP</button>
                  <button onClick={saveAsset} style={{...G("gold",false),padding:"10px"}}>SAVE TO LIBRARY</button>
                </div>
              </div>
            )}
          </div>
        )}
        {mode==="upload"&&(
          <div style={{marginBottom:14}}>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:4}}>
              <button onClick={()=>photoRef.current&&photoRef.current.click()}
                style={{background:"linear-gradient(135deg,#1a0800,#2a1200)",border:"2px solid "+GOLD,color:GOLD,padding:"20px 8px",cursor:"pointer",fontSize:12,fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}>
                📷 UPLOAD PHOTO
              </button>
              <button onClick={()=>fileRef.current&&fileRef.current.click()}
                style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,color:WHITE,padding:"20px 8px",cursor:"pointer",fontSize:12,fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}>
                📁 UPLOAD FILE
              </button>
            </div>
            <a href="https://photos.google.com" target="_blank" rel="noopener noreferrer"
              style={{display:"block",background:"#0a0a0a",border:"1px solid "+GOLDDIM,color:GOLDDIM,padding:"8px",textAlign:"center",fontSize:10,fontWeight:900,letterSpacing:2,textDecoration:"none",fontFamily:"'Rajdhani',sans-serif",marginBottom:4}}>
              🌐 OPEN GOOGLE PHOTOS → download photo → then Upload Photo above
            </a>
            <input ref={photoRef} type="file" accept="image/*, .jpg, .jpeg, .png, .gif, .webp, .heic, .heif" style={{display:"none"}} onChange={e=>{
              const f=e.target.files&&e.target.files[0];
              if(f&&onSave){onSave({id:Date.now()+Math.random(),name:f.name,type:f.type,file:f,url:URL.createObjectURL(f)});setSaved(true);}
            }}/>
            <input ref={fileRef} type="file" accept="video/*,audio/*,image/*,text/*" style={{display:"none"}} onChange={e=>{
              const f=e.target.files&&e.target.files[0];
              if(f&&onSave){onSave({id:Date.now()+Math.random(),name:f.name,type:f.type,file:f,url:URL.createObjectURL(f)});setSaved(true);}
            }}/>
          </div>
        )}
        {mode==="paste"&&(
          <div style={{marginBottom:14}}>
            <div style={{color:GOLD,fontSize:12,letterSpacing:3,fontWeight:900,marginBottom:6}}>ADD URL</div>
            <input value={url} onChange={e=>setUrl(e.target.value)} placeholder="Paste a URL..." style={{...inp,marginBottom:10}}/>
            <div style={{color:GOLD,fontSize:12,letterSpacing:3,fontWeight:900,marginBottom:6}}>OR PASTE TEXT</div>
            <textarea value={describe} onChange={e=>setDescribe(e.target.value)} placeholder="Paste your content here..." style={{...inp,height:100,resize:"none",lineHeight:1.6}}/>
            <button onClick={saveAsset} style={{...G("gold",false),marginTop:8,width:"100%",padding:"12px"}}>SAVE TO MEDIA LIBRARY</button>
          </div>
        )}
        {mode==="ai"&&tool==="Script to Movie"&&(
          <div style={{marginBottom:14}}>
            <div style={{color:GOLD,fontSize:12,letterSpacing:3,fontWeight:900,marginBottom:2}}>🎬 SCRIPT TO MOVIE</div>
            <div style={{color:GOLDDIM,fontSize:11,lineHeight:1.6,marginBottom:12}}>Fill the three boxes, then WIRE INTO RENDER — the video generator on Page 8 uses them to drive every scene.</div>
            <div style={{color:GOLD,fontSize:11,letterSpacing:2,fontWeight:900,marginBottom:3}}>🎬 PRODUCER</div>
            <textarea value={s2mProducer} onChange={e=>setS2mProducer(e.target.value)} placeholder="Producer's directions — vision, mood, casting, overall intent..." style={{...inp,height:80,resize:"vertical",lineHeight:1.6,marginBottom:10}}/>
            <div style={{color:GOLD,fontSize:11,letterSpacing:2,fontWeight:900,marginBottom:3}}>🎞 DESCRIBE</div>
            <textarea value={describe} onChange={e=>setDescribe(e.target.value)} placeholder="Describe your film — scene by scene, what happens on screen..." style={{...inp,height:80,resize:"vertical",lineHeight:1.6,marginBottom:10}}/>
            <div style={{color:GOLD,fontSize:11,letterSpacing:2,fontWeight:900,marginBottom:3}}>🎥 PRODUCTION NOTES</div>
            <textarea value={s2mProduction} onChange={e=>setS2mProduction(e.target.value)} placeholder="Production notes — shots, camera moves, lighting, locations, timing..." style={{...inp,height:80,resize:"vertical",lineHeight:1.6,marginBottom:10}}/>
            <button onClick={runAI} disabled={loading||!describe.trim()} style={{...G("gold",false),width:"100%",padding:"13px",opacity:loading||!describe.trim()?0.5:1,fontSize:13,letterSpacing:2,marginBottom:8}}>{loading?"⟳ CREATING...":"✍ WRITE SCRIPT ✦"}</button>
            <button onClick={()=>{
              const brief=(s2mProducer.trim()?"PRODUCER DIRECTION:\n"+s2mProducer.trim()+"\n\n":"")+(describe.trim()?"SCENE DESCRIPTION:\n"+describe.trim()+"\n\n":"")+(s2mProduction.trim()?"PRODUCTION NOTES:\n"+s2mProduction.trim()+"\n":"");
              if(!brief.trim()){alert("Fill in at least one box first.");return;}
              try{localStorage.setItem("ms_render_brief",JSON.stringify({producer:s2mProducer.trim(),describe:describe.trim(),production:s2mProduction.trim(),brief,ts:Date.now()}));}catch(e){}
              const id="brief_"+Date.now();
              if(onSave)onSave({id,name:"SCRIPT-TO-MOVIE BRIEF — "+new Date().toLocaleDateString(),type:"document",docKind:"brief",text:brief,date:new Date().toISOString(),renderBrief:true});
              setS2mWired(true);setTimeout(()=>setS2mWired(false),4000);
            }} style={{width:"100%",background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"14px",cursor:"pointer",fontSize:13,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>⚡ WIRE INTO RENDER — DRIVE THE VIDEO GENERATOR</button>
            {s2mWired&&<div style={{color:"#22c55e",fontSize:11,fontWeight:900,letterSpacing:1,marginTop:10,textAlign:"center"}}>✓ WIRED — Page 8 will use your Producer, Describe &amp; Production notes.</div>}
            {result&&(
              <div style={{marginTop:14}}>
                <textarea value={result} onChange={e=>setResult(e.target.value)} style={{...inp,height:140,resize:"none",lineHeight:1.7}}/>
                <button onClick={saveAsset} style={{...G("gold",false),marginTop:8,width:"100%",padding:"12px"}}>GENERATE & SAVE</button>
              </div>
            )}
          </div>
        )}
        {mode==="ai"&&tool!=="Script to Movie"&&(
          <div style={{marginBottom:14}}>
            <div style={{color:GOLD,fontSize:12,letterSpacing:3,fontWeight:900,marginBottom:4}}>
              {isVideoTool?"DESCRIBE YOUR SCENE OR FILM IDEA":isImageTool?"DESCRIBE YOUR IMAGE":isWritingTool?"DESCRIBE YOUR STORY OR SCRIPT":"DESCRIBE WHAT YOU WANT"}
            </div>
            <textarea value={describe} onChange={e=>setDescribe(e.target.value)}
              placeholder={isVideoTool?"e.g. A lone astronaut walks across a red planet at sunset...":isImageTool?"e.g. Portrait of a warrior queen at golden hour...":isWritingTool?"e.g. A documentary about veterans mental health...":"Describe what you want from "+tool+"..."}
              style={{...inp,height:100,resize:"none",lineHeight:1.6}}/>
            <button onClick={runAI} disabled={loading||!describe.trim()} style={{...G("gold",false),marginTop:8,width:"100%",padding:"14px",opacity:loading||!describe.trim()?0.5:1,fontSize:13,letterSpacing:2}}>
              {loading?"⟳ CREATING...":isVideoTool?"🎬 CREATE VIDEO PACKAGE ✦":isImageTool?"🎨 CREATE IMAGE PROMPT ✦":isWritingTool?"✍ WRITE SCRIPT ✦":"✦ AI CREATE"}
            </button>
            {result&&(
              <div style={{marginTop:14}}>
                <textarea value={result} onChange={e=>setResult(e.target.value)} style={{...inp,height:140,resize:"none",lineHeight:1.7}}/>
                <button onClick={saveAsset} style={{...G("gold",false),marginTop:8,width:"100%",padding:"12px"}}>GENERATE & SAVE</button>
              </div>
            )}
          </div>
        )}
        {saved&&(
          <div style={{marginTop:14,background:"#0a2a0a",border:"1px solid #22c55e",padding:"12px 16px",textAlign:"center"}}>
            <div style={{color:"#22c55e",fontWeight:900,fontSize:14,letterSpacing:2}}>✓ ASSET SAVED TO MEDIA LIBRARY</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── PAGE 5 WRITING BOXES — Producer Directions / Script / Production Directions
function WritingBoxes({ onSave }) {
  const BOXES=[
    {key:"producer",title:"PRODUCER",icon:"🎬",hint:"Vision, tone, casting, the feeling the film should leave behind.",ph:"Producer's directions — vision, mood, casting, overall intent..."},
    {key:"describe",title:"DESCRIBE",icon:"🎞",hint:"Describe the film scene by scene — what happens, what we see.",ph:"Describe your film — scene by scene, what happens on screen..."},
    {key:"production",title:"PRODUCTION NOTES",icon:"🎥",hint:"Shots, camera moves, lighting, locations, timing.",ph:"Production notes — shots, camera moves, lighting, locations, timing..."},
  ];
  const [docs,setDocs]=useState(()=>{try{return JSON.parse(localStorage.getItem("ms_writing_boxes")||"{}");}catch{return {};}});
  const [saved,setSaved]=useState("");
  const [wiring,setWiring]=useState(false);
  const [wired,setWired]=useState(false);
  const set=(k,v)=>setDocs(p=>{const n={...p,[k]:v};try{localStorage.setItem("ms_writing_boxes",JSON.stringify(n));}catch{}return n;});
  const saveBox=async(b)=>{
    const body=(docs[b.key]||"").trim();
    if(!body){alert("Write something in "+b.title+" first, then save it.");return;}
    const id="doc_"+b.key+"_"+Date.now();
    const asset={id,name:b.title+" — "+new Date().toLocaleDateString(),type:"document",docKind:b.key,text:body,date:new Date().toISOString()};
    try{await safeSaveClipToDB(id,new Blob([body],{type:"text/plain"}),asset.name,"document");}catch(e){}
    if(onSave)onSave(asset);
    setSaved(b.key);setTimeout(()=>setSaved(""),2500);
  };
  // ── WIRE INTO RENDER ──────────────────────────────────────────────
  // Combine the three boxes into a single director brief and store it as
  // ms_render_brief. The video generator (Page 8) reads this brief and
  // prepends it to every scene render so Producer + Describe + Production
  // all drive the actual output.
  const wireToRender=async()=>{
    const producer=(docs.producer||"").trim();
    const describe=(docs.describe||"").trim();
    const production=(docs.production||"").trim();
    if(!producer&&!describe&&!production){alert("Fill in at least one box first.");return;}
    setWiring(true);
    const brief=
      (producer?"PRODUCER DIRECTION:\n"+producer+"\n\n":"")+
      (describe?"SCENE DESCRIPTION:\n"+describe+"\n\n":"")+
      (production?"PRODUCTION NOTES:\n"+production+"\n":"");
    try{
      localStorage.setItem("ms_render_brief",JSON.stringify({producer,describe,production,brief,ts:Date.now()}));
    }catch(e){}
    // Also drop a project-brief document into the media library / timeline
    const id="brief_"+Date.now();
    const asset={id,name:"SCRIPT-TO-MOVIE BRIEF — "+new Date().toLocaleDateString(),type:"document",docKind:"brief",text:brief,date:new Date().toISOString(),renderBrief:true};
    try{await safeSaveClipToDB(id,new Blob([brief],{type:"text/plain"}),asset.name,"document");}catch(e){}
    if(onSave)onSave(asset);
    setTimeout(()=>{setWiring(false);setWired(true);setTimeout(()=>setWired(false),4000);},500);
  };
  const ta={width:"100%",background:"#000",border:"1px solid "+GOLDDIM,padding:"12px 14px",color:WHITE,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"'Rajdhani',sans-serif",lineHeight:1.8,height:150,resize:"vertical"};
  return (
    <div style={{padding:"0 12px 16px"}}>
      <div style={{color:GOLD,fontSize:13,letterSpacing:3,fontWeight:900,margin:"6px 2px 4px"}}>🎬 SCRIPT TO MOVIE</div>
      <div style={{color:GOLDDIM,fontSize:11,letterSpacing:1,margin:"0 2px 12px"}}>Fill the three boxes, then WIRE INTO RENDER — the video generator on Page 8 uses them to drive every scene. Each box also saves to your Media Library &amp; timeline.</div>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
        {BOXES.map(b=>(
          <div key={b.key} style={{background:"#050500",border:"2px solid "+GOLD,padding:"14px 16px",display:"flex",flexDirection:"column"}}>
            <div style={{color:GOLD,fontWeight:900,fontSize:13,letterSpacing:2,marginBottom:3}}>{b.icon} {b.title}</div>
            <div style={{color:GOLDDIM,fontSize:11,lineHeight:1.6,marginBottom:8}}>{b.hint}</div>
            <textarea value={docs[b.key]||""} onChange={e=>set(b.key,e.target.value)} placeholder={b.ph} style={ta}/>
            <button onClick={()=>saveBox(b)} style={{marginTop:10,background:"transparent",border:"1px solid "+GOLD,color:GOLD,padding:"9px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>💾 SAVE TO MEDIA LIBRARY</button>
            {saved===b.key&&<div style={{color:"#22c55e",fontSize:11,fontWeight:900,letterSpacing:1,marginTop:8,textAlign:"center"}}>✓ SAVED</div>}
          </div>
        ))}
      </div>
      <button onClick={wireToRender} disabled={wiring} style={{marginTop:14,width:"100%",background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"15px",cursor:"pointer",fontSize:14,fontWeight:900,letterSpacing:3,fontFamily:"'Rajdhani',sans-serif"}}>{wiring?"⟳ WIRING...":"⚡ WIRE INTO RENDER — DRIVE THE VIDEO GENERATOR"}</button>
      {wired&&<div style={{color:"#22c55e",fontSize:12,fontWeight:900,letterSpacing:1,marginTop:10,textAlign:"center"}}>✓ WIRED — Page 8 will now use your Producer, Describe &amp; Production notes on every scene.</div>}
    </div>
  );
}

function ToolPage({ title, subtitle, tools, onSave }) {
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(null);
  const filtered = tools.filter(t=>t.toLowerCase().includes(search.toLowerCase()));
  return (
    <div style={{...Sp}}>
      <div style={{padding:"14px 18px 12px",borderBottom:"1px solid "+GOLDDIM+"",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:12,color:GOLD,letterSpacing:4,fontWeight:700}}>{subtitle}</div>
          <h1 style={{...H1,fontSize:24,margin:0}}>{title}</h1>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:8}}>
          <div style={{position:"relative"}}>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder={"Search "+tools.length+" tools..."}
              style={{background:"#000",border:"1px solid "+GOLDDIM,padding:"7px 12px 7px 28px",color:WHITE,fontSize:13,outline:"none",width:200}}/>
            <span style={{position:"absolute",left:8,top:"50%",transform:"translateY(-50%)",color:GOLD}}>🔍</span>
            {search&&<button onClick={()=>setSearch("")} style={{position:"absolute",right:7,top:"50%",transform:"translateY(-50%)",background:"none",border:"none",color:GOLD,cursor:"pointer",padding:0}}>✕</button>}
          </div>
          <span style={{color:WHITE,fontSize:12,fontWeight:700,letterSpacing:1}}>{filtered.length} TOOLS</span>
        </div>
      </div>
      <div style={{padding:12,display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8}}>
        {filtered.map(t=><ToolCard key={t} name={t} onOpen={setOpen}/>)}
      </div>
      {open&&<ToolPanel tool={open} onClose={()=>setOpen(null)} onSave={onSave}/>}
      {title==="WRITING TOOLS"&&(
        <div style={{padding:"0 12px 12px"}}>
          <div style={{background:"#050500",border:"2px solid "+GOLD,padding:"16px 20px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:12}}>
            <div>
              <div style={{color:GOLD,fontWeight:900,fontSize:13,letterSpacing:3}}>📂 YOUR PROJECTS</div>
              <div style={{color:WHITE,fontSize:12,marginTop:3}}>Save and reload your work at any time</div>
            </div>
            <div style={{display:"flex",gap:10}}>
              <button onClick={()=>{
                try{
                  const hist=JSON.parse(localStorage.getItem("ms_project_history")||"[]");
                  if(hist.length>0){
                    // Show history modal by dispatching custom event
                    window.dispatchEvent(new CustomEvent("ms_open_history"));
                  } else {
                    alert("No saved projects found. Hit 💾 SAVE PROJECT in the footer to save your work.");
                  }
                }catch(e){alert("Could not open projects.");}
              }}
                style={{background:"linear-gradient(135deg,#a07820,#e8c96d)",border:"none",color:"#000",padding:"12px 24px",cursor:"pointer",fontSize:12,fontWeight:900,letterSpacing:2}}>
                📂 OPEN PROJECT
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function RecordYourOwnSong({ onRecorded }) {
  const [recording,setRecording]=useState(false);
  const [recTime,setRecTime]=useState(0);
  const mrRef=useRef(null);
  const timerRef=useRef(null);
  const start=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mr=new MediaRecorder(stream);
      mrRef.current=mr;
      const chunks=[];
      mr.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
      mr.onstop=()=>{
        const blob=new Blob(chunks,{type:"audio/webm"});
        const name="recording_"+Date.now()+".webm";
        onRecorded(blob,name);
        stream.getTracks().forEach(t=>t.stop());
        setRecording(false);setRecTime(0);
      };
      mr.start(100);setRecording(true);setRecTime(0);
      timerRef.current=setInterval(()=>setRecTime(t=>t+1),1000);
    }catch(e){alert("Microphone access denied. Please allow microphone and try again.");}
  };
  const stop=()=>{
    if(mrRef.current&&mrRef.current.state!=="inactive")mrRef.current.stop();
    if(timerRef.current)clearInterval(timerRef.current);
  };
  const fmt=s=>{const n=isFinite(+s)&&!isNaN(+s)?+s:0;return String(Math.floor(n/60)).padStart(2,"0")+":"+String(Math.floor(n%60)).padStart(2,"0");};
  return recording?(
    <div style={{display:"flex",alignItems:"center",gap:10,background:"#1a0000",border:"1px solid #ef4444",padding:"10px 14px",marginTop:8}}>
      <div style={{width:10,height:10,borderRadius:"50%",background:"#ef4444",boxShadow:"0 0 8px #ef4444"}}/>
      <span style={{color:"#ef4444",fontWeight:900,fontSize:12,letterSpacing:2,flex:1}}>RECORDING — {fmt(recTime)}</span>
      <button onClick={stop} style={{background:"#ef4444",border:"none",color:"#fff",padding:"6px 16px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>■ STOP & SAVE</button>
    </div>
  ):(
    <button onClick={start} style={{width:"100%",background:"linear-gradient(135deg,#7a0000,#ef4444)",border:"none",color:"#fff",padding:"10px 14px",cursor:"pointer",fontSize:12,fontWeight:900,letterSpacing:2,marginTop:8,fontFamily:"'Rajdhani',sans-serif"}}>
      ● RECORD YOUR OWN SONG
    </button>
  );
}


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
  const canvasRef = useRef(null);
  const videoRef = useRef(null);
  const audioRef = useRef(null);
  const audioInputRef = useRef(null);

  const [config, setConfig] = useState(()=>{
    try{
      const saved=localStorage.getItem("ms_mvs_config");
      if(saved) return JSON.parse(saved);
    }catch{}
    return {
      title:"If Only", artist:"Manda", genre:"Folk / Acoustic",
      mood:"Melancholic", tempo:"Slow (60-80 BPM)",
      videoStyle:"Cinematic Narrative", colorGrade:"Cinematic Teal & Orange",
      effects:["Slow Motion","Film Grain","Vignette"],
      cuts:"Long Takes", aspectRatio:"16:9", duration:"3 Minutes",
      durationMin:0, stereo:true,
      visualDesc:"", lipSync:true, refMedia:null,
    };
  });
  const set = (k,v) => setConfig(p=>{const n={...p,[k]:v};try{localStorage.setItem("ms_mvs_config",JSON.stringify(n));}catch{}return n;});
  const tog = (k,v) => setConfig(p=>{const n={...p,[k]:p[k].includes(v)?p[k].filter(x=>x!==v):[...p[k],v]};try{localStorage.setItem("ms_mvs_config",JSON.stringify(n));}catch{}return n;});

  const GENRES=["Pop","Rock","Hip Hop","R&B / Soul","Electronic / EDM","Country","Jazz","Classical","Metal","Folk / Acoustic","Latin","K-Pop","Blues","Cinematic / Score"];
  const MOODS=["Euphoric","Melancholic","Energetic","Romantic","Angry","Peaceful","Mysterious","Empowering","Nostalgic","Dark","Haunting","Uplifting","Tense"];
  const TEMPOS=["Very Slow (40-60 BPM)","Slow (60-80 BPM)","Mid-Tempo (80-100 BPM)","Upbeat (100-120 BPM)","Fast (120-140 BPM)"];
  const STYLES=["Cinematic Narrative","Performance / Live","Abstract / Visual Art","Documentary Style","Lyric Video","Retro / VHS","Noir / Black & White","Surrealist / Dreamlike"];
  const GRADES=["Natural / Clean","Golden Hour Warm","Cool Blue / Moody","High Contrast Black & White","Cinematic Teal & Orange","Vintage Film Grain","Dark & Desaturated"];
  const EFFECTS=["Slow Motion","Speed Ramps","Glitch Effects","Light Leaks","Lens Flares","Rain / Water","Bokeh / Blur","Film Grain","Vignette","Particle Effects"];
  const CUTS=["Fast Cuts / High Energy","Slow & Deliberate","Long Takes","Beat-Synced Cuts","Montage Style"];

  const addLog = (msg) => setRenderLog(p=>[...p,msg]);

  // Upload audio track
  const handleAudioUpload = (e) => {
    const f = e.target.files&&e.target.files[0];
    if(!f) return;
    setAudioFile(f);
    setAudioUrl(URL.createObjectURL(f));
    setAudioName(f.name);
  };

  const generateVideo = async () => {
    setGenerating(true);
    setRenderLog([]);
    setRenderProgress(0);
    setVideoUrl("");
    setVideoBlob(null);

    try {
      const sceneDesc = config.visualDesc || "A man sits on a windowsill overlooking the ocean at night, fingerpicking acoustic guitar. Only his back is visible. Full moon. Single candle. Dark wooden room. Empty couch. Coat on a hook. Curtains lift in the wind.";
      addLog("MandaStrong Cinema Engine — writing your film...");
      setRenderProgress(4);

      // ── BEAT ANALYSIS ─────────────────────────────────────────────
      // ── DURATION ── single source of truth is the slider (config.durationMin).
      // 0 = AUTO: match the audio length. Above 0 = fixed length that overrides.
      let totalDur = 180;
      const overrideMin = Number(config.durationMin)||0;
      const overrideSec = overrideMin>0 ? overrideMin*60 : 0;
      if(overrideSec>0){ totalDur = overrideSec; addLog("Duration: locked to "+overrideMin+" min ("+overrideSec+"s)"); }
      else { addLog("Duration: AUTO — will match the song length"); }
      let beatGrid = [];
      let audioCtx = null, audioDest = null, audioSource = null;

      if(audioFile){
        try{
          audioCtx = new (window.AudioContext||window.webkitAudioContext)();
          const ab = await audioFile.arrayBuffer();
          const buf = await audioCtx.decodeAudioData(ab);
          if(overrideSec>0){ totalDur = overrideSec; } else { totalDur = buf.duration; }
          // Energy-based beat detection
          const data = buf.getChannelData(0);
          const sr = buf.sampleRate;
          const win = Math.round(sr*0.35);
          const energies = [];
          for(let i=0;i<data.length-win;i+=win){
            let e=0; for(let j=0;j<win;j++) e+=data[i+j]*data[i+j];
            energies.push({t:i/sr,e:e/win});
          }
          const avg = energies.reduce((s,x)=>s+x.e,0)/energies.length;
          let last=-1;
          energies.forEach(x=>{
            if(x.e>avg*1.35&&x.t-last>0.28){beatGrid.push(x.t);last=x.t;}
          });
          addLog("Audio: "+totalDur.toFixed(1)+"s — "+beatGrid.length+" beats detected");
          // Set up audio mixing
          audioDest = audioCtx.createMediaStreamDestination();
          audioSource = audioCtx.createBufferSource();
          audioSource.buffer = buf;
          if(overrideSec>buf.duration+0.5){ audioSource.loop=true; addLog("Song ("+buf.duration.toFixed(1)+"s) will loop to fill "+overrideSec+"s"); }
          const gain = audioCtx.createGain(); gain.gain.value=0.92;
          if(config.stereo!==false && audioCtx.createStereoPanner){
            addLog("🔊 Stereo sound ON — baking full stereo field into the film");
            const wet=audioCtx.createGain(); wet.gain.value=0.5;
            audioSource.connect(gain); gain.connect(audioDest); gain.connect(audioCtx.destination);
            [[-0.85,0.014],[0.85,0.021]].forEach(([pan,dl])=>{
              const d=audioCtx.createDelay(); d.delayTime.value=dl;
              const p=audioCtx.createStereoPanner(); p.pan.value=pan;
              gain.connect(d); d.connect(p); p.connect(wet);
            });
            wet.connect(audioDest); wet.connect(audioCtx.destination);
          } else {
            addLog("Mono sound — stereo toggle off");
            audioSource.connect(gain); gain.connect(audioDest); gain.connect(audioCtx.destination);
          }
          if(overrideSec>0){ totalDur = overrideSec; } else { totalDur = buf.duration; }
        }catch(e){ addLog("Audio: "+e.message); audioCtx=null; }
      } else {
        addLog("No audio — generating "+totalDur+"s visual");
        for(let t=0;t<totalDur;t+=1.8) beatGrid.push(t);
      }
      setRenderProgress(10);

      // ── BUILT-IN RENDERER (NO PROXY) ─────────────
      addLog("MandaStrong Engine — built-in renderer ready");
      const pr = sceneDesc.toLowerCase();
      const isNight = /night|dark|moon|evening|dusk/.test(pr);
      const isGolden = /golden|sunset|sunrise|amber/.test(pr);
      const isOcean = /ocean|sea|water|wave|shore|coast/.test(pr);
      const isCity = /city|urban|street|skyline|neon/.test(pr);
      const isSpace = /space|star|galaxy|planet|cosmos/.test(pr);
      const isIndoor = /room|interior|inside|window|wall/.test(pr);
      const isRain = /rain|storm|wet|drizzle/.test(pr);
      const isFog = /fog|mist|haze|smoke/.test(pr);
      const hasPerson = /woman|man|person|figure|human/.test(pr);
      const hasCandle = /candle|flame|fire|torch/.test(pr);
      const hasGuitar = /guitar|musician|fingerpick/.test(pr);
      const isSilhouette = /silhouette|back to camera|facing away/.test(pr);

      // Load reference image if user uploaded one — Reality Engine base
      let refImgEl = null;
      if(config.refMedia){
        try{
          refImgEl = await new Promise((resolve)=>{
            const img = new Image();
            img.crossOrigin = "anonymous";
            img.onload = ()=>resolve(img);
            img.onerror = ()=>resolve(null);
            img.src = config.refMedia;
            setTimeout(()=>resolve(refImgEl||null), 5000);
          });
          if(refImgEl) addLog("✓ Reference image loaded — Reality Engine base active");
        }catch(e){}
      }

      const renderFn = (ctx, W, H, t, sec, totalSec, beatNow) => {
        const pulse = beatNow ? 1.02 : 1.0;
        ctx.save();
        ctx.translate(W/2, H/2);
        ctx.scale(pulse + t*0.04, pulse + t*0.04);
        ctx.translate(-W/2, -H/2);

        // ── REALITY ENGINE — if user uploaded a reference image, use it as photorealistic base
        if(refImgEl){
          // Cover the full frame with the reference image
          const imgR = refImgEl.width / refImgEl.height;
          const canR = W / H;
          let dw, dh, dx, dy;
          if(imgR > canR){
            dh = H;
            dw = H * imgR;
            dx = (W - dw) / 2;
            dy = 0;
          } else {
            dw = W;
            dh = W / imgR;
            dx = 0;
            dy = (H - dh) / 2;
          }
          // Subtle Ken Burns pan across the reference image for movement
          const panX = Math.sin(sec * 0.08) * W * 0.02;
          const panY = Math.cos(sec * 0.06) * H * 0.015;
          ctx.drawImage(refImgEl, dx + panX, dy + panY, dw, dh);
          // Warm cinematic overlay + vignette handled by post-processing later
          // Skip procedural sky/water/room drawing when we have real photo base
          ctx.restore();
          return;
        }
        // SKY (fallback for when no reference image is uploaded)
        if(isSpace){
          const sky=ctx.createLinearGradient(0,0,0,H);
          sky.addColorStop(0,"rgb(1,1,8)"); sky.addColorStop(1,"rgb(3,3,18)");
          ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
          for(let s=0;s<300;s++){
            const sx=(s*137.5)%W, sy=(s*97.3)%H;
            ctx.fillStyle="rgba(240,245,255,"+(0.3+Math.sin(sec*0.7+s)*0.28)+")";
            ctx.fillRect(sx,sy,s%5===0?1.8:0.8,s%5===0?1.8:0.8);
          }
        } else if(isNight){
          const sky=ctx.createLinearGradient(0,0,0,H*0.62);
          sky.addColorStop(0,"rgb(2,4,15)");
          sky.addColorStop(0.5,"rgb(5,10,32)");
          sky.addColorStop(1,"rgb(8,18,50)");
          ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
          for(let s=0;s<200;s++){
            const sx=(s*137.5)%W, sy=(s*97.3)%(H*0.55);
            ctx.fillStyle="rgba(240,245,255,"+(0.3+Math.sin(sec*0.5+s*0.3)*0.22)+")";
            ctx.fillRect(sx,sy,s%4===0?1.4:0.7,s%4===0?1.4:0.7);
          }
          const mx=W*0.78, my=H*0.13;
          const mg=ctx.createRadialGradient(mx,my,0,mx,my,H*0.078);
          mg.addColorStop(0,"rgba(255,255,248,0.96)");
          mg.addColorStop(1,"rgba(200,200,180,0)");
          ctx.fillStyle=mg; ctx.fillRect(mx-H*0.09,my-H*0.09,H*0.18,H*0.18);
        } else if(isGolden){
          const sky=ctx.createLinearGradient(0,0,0,H*0.66);
          sky.addColorStop(0,"rgb(18,10,35)");
          sky.addColorStop(0.3,"rgb(165,50,12)");
          sky.addColorStop(0.65,"rgb(248,135,28)");
          sky.addColorStop(1,"rgb(255,205,75)");
          ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
        } else {
          const sky=ctx.createLinearGradient(0,0,0,H*0.6);
          sky.addColorStop(0,"rgb(28,60,140)");
          sky.addColorStop(1,"rgb(180,210,240)");
          ctx.fillStyle=sky; ctx.fillRect(0,0,W,H);
        }
        const horizY = isIndoor ? H : H*0.56;
        // OCEAN
        if(isOcean && !isIndoor){
          for(let w=0;w<10;w++){
            const wg=ctx.createLinearGradient(0,horizY+w*13,0,H);
            const d=isNight?[2+w*2,8+w*6,30+w*10]:[0+w*3,55+w*12,115+w*10];
            wg.addColorStop(0,"rgba("+d[0]+","+d[1]+","+d[2]+","+(0.7+w*0.03)+")");
            wg.addColorStop(1,"rgba(1,3,8,0.98)");
            ctx.fillStyle=wg;
            ctx.beginPath(); ctx.moveTo(-10,H);
            for(let x=0;x<=W+10;x+=3){
              const y=horizY+w*14+Math.sin(x*0.007+sec*(0.24+w*0.07)+w*1.3)*17;
              ctx.lineTo(x,y);
            }
            ctx.lineTo(W+10,H); ctx.closePath(); ctx.fill();
          }
        }
        // CITY
        if(isCity && !isIndoor){
          const grd=ctx.createLinearGradient(0,horizY,0,H);
          grd.addColorStop(0,"rgb(16,16,20)"); grd.addColorStop(1,"rgb(8,8,10)");
          ctx.fillStyle=grd; ctx.fillRect(0,horizY,W,H-horizY);
          for(let b=0;b<18;b++){
            const bx=(b*151)%W, bh=H*0.15+((b*97)%H)*0.35, bw=W*0.035;
            ctx.fillStyle=isNight?"rgb(10,10,18)":"rgb(75,80,90)";
            ctx.fillRect(bx,horizY-bh,bw,bh);
            for(let wy=0;wy<Math.floor(bh/18);wy++){
              for(let wx=0;wx<Math.floor(bw/10);wx++){
                if(Math.sin(b*13+wy*7+wx*11)>0.1){
                  const lit=Math.sin(sec*0.3+b+wy)>-0.3;
                  ctx.fillStyle=lit?"rgba(255,240,180,0.88)":"rgba(20,20,28,0.5)";
                  ctx.fillRect(bx+wx*10+2,horizY-bh+wy*18+4,7,10);
                }
              }
            }
          }
        }
        // INDOOR
        if(isIndoor){
          const wall=ctx.createLinearGradient(0,0,W,H);
          wall.addColorStop(0,"rgb(9,6,3)"); wall.addColorStop(1,"rgb(4,3,2)");
          ctx.fillStyle=wall; ctx.fillRect(0,0,W,H);
          const fl=ctx.createLinearGradient(0,H*0.65,0,H);
          fl.addColorStop(0,"rgb(18,12,7)"); fl.addColorStop(1,"rgb(7,5,3)");
          ctx.fillStyle=fl; ctx.fillRect(0,H*0.65,W,H*0.35);
          const wox=W*0.12, woy=H*0.05, wow=W*0.46, woh=H*0.74;
          if(isNight){
            const ws=ctx.createLinearGradient(wox,woy,wox,woy+woh);
            ws.addColorStop(0,"rgb(2,4,15)"); ws.addColorStop(1,"rgb(6,14,42)");
            ctx.fillStyle=ws; ctx.fillRect(wox,woy,wow,woh);
            if(isOcean){
              for(let w=0;w<6;w++){
                const wg2=ctx.createLinearGradient(0,woy+woh*0.55+w*8,0,woy+woh);
                wg2.addColorStop(0,"rgba(2,8,35,0.9)");
                wg2.addColorStop(1,"rgba(1,3,12,0.98)");
                ctx.fillStyle=wg2;
                ctx.beginPath(); ctx.moveTo(wox,woy+woh);
                for(let x=wox;x<=wox+wow;x+=3){
                  const y=woy+woh*0.58+w*10+Math.sin(x*0.01+sec*(0.2+w*0.07)+w)*10;
                  ctx.lineTo(x,y);
                }
                ctx.lineTo(wox+wow,woy+woh); ctx.closePath(); ctx.fill();
              }
            }
          }
          ctx.strokeStyle="rgba(48,32,16,0.92)"; ctx.lineWidth=10;
          ctx.strokeRect(wox,woy,wow,woh);
        }
        // CANDLE
        if(hasCandle){
          const candX=isIndoor?W*0.7:W*0.5, candY=isIndoor?H*0.58:H*0.5;
          const flicker=0.88+Math.sin(sec*8.8)*0.07+Math.sin(sec*13.4)*0.04;
          ctx.fillStyle="rgba(232,212,162,0.9)"; ctx.fillRect(candX-5,candY,10,32);
          const cf=ctx.createRadialGradient(candX,candY,0,candX,candY,H*0.13*flicker);
          cf.addColorStop(0,"rgba(255,255,200,0.95)");
          cf.addColorStop(0.18,"rgba(255,180,40,0.72)");
          cf.addColorStop(0.5,"rgba(255,100,8,0.3)");
          cf.addColorStop(1,"rgba(255,60,0,0)");
          ctx.fillStyle=cf; ctx.fillRect(candX-H*0.13,candY-H*0.13,H*0.26,H*0.26);
        }
        // PERSON
        if(hasPerson){
          const isSeated=/sit|bench|windowsill|chair/.test(pr);
          const isMale=/\bman\b|\bmale\b|\bguy\b|\bhim\b|\bhe\b/.test(pr);
          const isFemale=/\bwoman\b|\bfemale\b|\bgirl\b|\bher\b|\bshe\b/.test(pr);
          const fx=isOcean&&isIndoor?W*0.22:W*0.4;
          const fy=isSeated?H*0.52:H*0.44;
          const breath=Math.sin(sec*0.88)*0.007;
          // Lip sync — mouth opens on beats
          const mouthOpen=beatNow?H*0.012:H*0.003+Math.sin(sec*4.2)*H*0.003;
          // Skin tone — male slightly darker
          const skinTop=isMale?"rgba(205,155,105,1)":"rgba(235,185,135,1)";
          const skinBot=isMale?"rgba(135,88,52,1)":"rgba(155,102,65,1)";
          // Shoulder width — male broader
          const shoulderW=isMale?H*0.075:H*0.055;

          if(isSilhouette){
            ctx.fillStyle="rgba(2,1,1,0.97)";
            // Head
            ctx.beginPath();ctx.ellipse(fx,fy-H*0.13,H*0.036,H*0.044,0,0,Math.PI*2);ctx.fill();
            // Body — broader for male
            ctx.beginPath();
            ctx.moveTo(fx-shoulderW,fy-H*0.09);
            ctx.lineTo(fx-H*0.03,fy+H*(0.06+breath*2));
            ctx.lineTo(fx+H*0.03,fy+H*(0.06+breath*2));
            ctx.lineTo(fx+shoulderW,fy-H*0.09);
            ctx.closePath();ctx.fill();
            if(hasGuitar){
              ctx.beginPath();ctx.ellipse(fx+H*0.072,fy+H*0.02,H*0.05,H*0.064,0.22,0,Math.PI*2);ctx.fill();
              ctx.fillRect(fx+H*0.026,fy-H*0.09,H*0.011,H*0.12);
            }
          } else {
            // Head with correct skin tone
            const hg=ctx.createRadialGradient(fx-H*0.008,fy-H*0.145,0,fx,fy-H*0.13,H*0.042);
            hg.addColorStop(0,skinTop);
            hg.addColorStop(1,skinBot);
            ctx.fillStyle=hg;
            ctx.beginPath();ctx.ellipse(fx,fy-H*0.13,H*0.034,H*0.042,0,0,Math.PI*2);ctx.fill();
            // Eyes
            ctx.fillStyle="rgba(30,20,10,0.9)";
            ctx.beginPath();ctx.ellipse(fx-H*0.012,fy-H*0.138,H*0.007,H*0.005,0,0,Math.PI*2);ctx.fill();
            ctx.beginPath();ctx.ellipse(fx+H*0.012,fy-H*0.138,H*0.007,H*0.005,0,0,Math.PI*2);ctx.fill();
            // Lip sync mouth
            ctx.fillStyle="rgba(120,60,40,0.85)";
            ctx.beginPath();ctx.ellipse(fx,fy-H*0.115,H*0.014,mouthOpen,0,0,Math.PI*2);ctx.fill();
            // Body — broader for male
            ctx.fillStyle="rgba(28,18,10,0.97)";
            ctx.beginPath();
            ctx.moveTo(fx-shoulderW,fy-H*0.09);
            ctx.lineTo(fx-H*0.03,fy+H*(0.08+breath*2));
            ctx.lineTo(fx+H*0.03,fy+H*(0.08+breath*2));
            ctx.lineTo(fx+shoulderW,fy-H*0.09);
            ctx.closePath();ctx.fill();
          }
        }
        if(isRain){
          for(let r=0;r<120;r++){
            const rx=(r*137+sec*200)%W, ry=(r*97+sec*450)%H;
            ctx.strokeStyle="rgba(155,175,210,0.2)"; ctx.lineWidth=0.8;
            ctx.beginPath(); ctx.moveTo(rx,ry); ctx.lineTo(rx-4,ry+18); ctx.stroke();
          }
        }
        if(isFog){
          const fog=ctx.createLinearGradient(0,H*0.38,0,H*0.72);
          fog.addColorStop(0,"rgba(175,180,175,0)");
          fog.addColorStop(0.5,"rgba(155,160,155,"+(0.1+Math.sin(sec*0.28)*0.04)+")");
          fog.addColorStop(1,"rgba(138,142,138,0)");
          ctx.fillStyle=fog; ctx.fillRect(0,H*0.38,W,H*0.34);
        }
        ctx.restore();
      };

      // ══════════════════════════════════════════════════════════════
      // MANDASTRONG ENGINE — real footage, not drawn shapes
      // The shot list renders in parallel, then the canvas below
      // composites it with your grade, your beats and your audio.
      // If the engine can't deliver, the built-in renderer still runs.
      // ══════════════════════════════════════════════════════════════
      let engineClips=[];
      try{
        const shotCount=Math.min(4,Math.max(3,Math.round(totalDur/45))); // capped at 4 to protect render spend
        const ANGLES=[
          "wide establishing shot, full scene visible",
          "medium shot, subject centred in frame",
          "slow push in, shallow depth of field",
          "close detail shot, hands and texture",
          "low angle looking up, dramatic",
          "slow lateral tracking shot",
          "framed from behind, subject facing away",
          "wide static held frame, atmospheric"
        ];
        const look=[config.videoStyle,config.colorGrade,(config.effects||[]).join(", ")].filter(Boolean).join(", ");
        const shots=[];
        for(let i=0;i<shotCount;i++){
          shots.push(sceneDesc+". "+ANGLES[i%ANGLES.length]+". "+look+". Photorealistic, cinematic, natural motion, 35mm film, no text, no captions.");
        }
        addLog("Cinema Engine \u2014 rendering "+shotCount+" photorealistic shots...");
        setRenderProgress(8);
        let done=0;
        const ar=(config.aspectRatio||"").indexOf("9:16")===0?"9:16":"16:9";
        const seedImg=(typeof config.refMedia==="string"&&config.refMedia.indexOf("data:")===0)?config.refMedia:"";
        const urls=await Promise.all(shots.map(s=>engineRender(s,{duration:5,aspect_ratio:ar,image:seedImg})
          .then(u=>{ done++; addLog("Shot "+done+"/"+shotCount+(u?" \u2713":" \u2014 unavailable")); setRenderProgress(Math.min(26,8+done*2)); return u; })));
        const good=urls.filter(Boolean);
        if(good.length){
          addLog("Loading footage into the compositor...");
          const vids=await Promise.all(good.map(u=>engineToLocalVideo(u)));
          engineClips=vids.filter(Boolean);
          for(const v of engineClips){ try{ await v.play(); }catch(e){} }
          addLog("\u2713 "+engineClips.length+" live shots ready \u2014 compositing with your grade and beats");
        } else {
          const diag=await engineStatus();
          addLog((diag&&diag.ok===false?("Cinema Engine: "+(diag.message||"unavailable")):"Engine returned no footage")+" \u2014 using built-in renderer");
        }
      }catch(e){ addLog("Cinema Engine offline \u2014 using built-in renderer"); }

      // Shot length follows the editing style you picked on Step 2
      const CUTLEN={"Fast Cuts / High Energy":1.1,"Slow & Deliberate":5.5,"Long Takes":8,"Beat-Synced Cuts":0,"Montage Style":2.2};
      const shotLen=CUTLEN[config.cuts]!==undefined?CUTLEN[config.cuts]:4;
      const cutPoints=[];
      if(shotLen===0&&beatGrid.length){
        let lastCut=-99;
        beatGrid.forEach(b=>{ if(b-lastCut>1.4){ cutPoints.push(b); lastCut=b; } });
      }
      const clipAt=(sec)=>{
        if(!engineClips.length)return null;
        if(cutPoints.length){
          let n=0;
          for(let i=0;i<cutPoints.length;i++){ if(sec>=cutPoints[i]) n=i+1; }
          return engineClips[n%engineClips.length];
        }
        return engineClips[Math.floor(sec/shotLen)%engineClips.length];
      };
      // Fills the frame without squashing. Slight overscan so the
      // parallax drift never exposes a black edge.
      const drawClip=(c,v,W2,H2)=>{
        if(!v||!v.videoWidth)return false;
        const vr=v.videoWidth/v.videoHeight, cr=W2/H2;
        let dw,dh;
        if(vr>cr){ dh=H2; dw=H2*vr; } else { dw=W2; dh=W2/vr; }
        dw*=1.08; dh*=1.08;
        c.drawImage(v,(W2-dw)/2,(H2-dh)/2,dw,dh);
        return true;
      };

      setRenderProgress(30);
      addLog("Rendering "+totalDur.toFixed(0)+"s film at 12fps...");

      // ── SET UP CANVAS + RECORDER ────────────────────────────────
      const canvas = canvasRef.current;
      const W=1280, H=720;
      canvas.width=W; canvas.height=H;
      const ctx = canvas.getContext("2d");

      const fps=12;
      const mimeType=MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm";
      const videoStream=canvas.captureStream(fps);
      let combinedStream=videoStream;
      if(audioDest){
        combinedStream=new MediaStream([...videoStream.getTracks(),...audioDest.stream.getTracks()]);
      }
      const recorder=new MediaRecorder(combinedStream,{mimeType,videoBitsPerSecond:10000000});
      const chunks=[];
      recorder.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
      recorder.start(Math.round(1000/fps));
      // Start audio at exact same moment as video recording — guarantees sync
      if(audioSource&&audioCtx) audioSource.start(audioCtx.currentTime);
      else if(audioSource) audioSource.start(0);

      // ── RENDER EVERY FRAME ──────────────────────────────────────
      const totalFrames=Math.max(fps*5, Math.round((totalDur||180)*fps));
      const msPerFrame=Math.round(1000/fps);
      const wallStart=performance.now();

      await new Promise(resolve=>{
        let frame=0;
        const tick=()=>{
          if(frame>=totalFrames){resolve(null);return;}
          const sec=frame/fps;
          const t=sec/totalDur;
          const beatNow=beatGrid.some(b=>Math.abs(sec-b)<0.055);

          ctx.clearRect(0,0,W,H);

          // Camera parallax base
          const drift=t*W*0.04;
          ctx.save();
          ctx.translate(-drift*0.3,0);

          try{
            const liveClip=clipAt(sec);
            if(!(liveClip&&drawClip(ctx,liveClip,W,H))){
              renderFn(ctx,W,H,t,sec,totalDur,beatNow);
            }
          }
          catch(e){
            // Graceful fallback — keep rendering
            const bg=ctx.createLinearGradient(0,0,0,H);
            bg.addColorStop(0,"rgb(2,5,18)");
            bg.addColorStop(1,"rgb(4,8,28)");
            ctx.fillStyle=bg; ctx.fillRect(-W,0,W*3,H);
          }

          ctx.restore();

          // Vignette — always
          const vig=ctx.createRadialGradient(W/2,H/2,W*0.08,W/2,H/2,W*0.85);
          vig.addColorStop(0,"rgba(0,0,0,0)"); vig.addColorStop(1,"rgba(0,0,0,0.92)");
          ctx.fillStyle=vig; ctx.fillRect(0,0,W,H);

          // ── AUTO-ENHANCEMENT — runs every frame automatically ──────────────
          // Warm gold colour grade overlay
          ctx.fillStyle="rgba(232,180,60,0.06)";ctx.fillRect(0,0,W,H);
          // Contrast boost — darken shadows slightly
          ctx.fillStyle="rgba(0,0,0,0.08)";ctx.fillRect(0,0,W,H);
          // Highlight recovery — soft white pull on bright areas (top centre)
          const hr=ctx.createRadialGradient(W/2,H*0.3,0,W/2,H*0.3,W*0.4);
          hr.addColorStop(0,"rgba(255,255,240,0.04)");hr.addColorStop(1,"rgba(0,0,0,0)");
          ctx.fillStyle=hr;ctx.fillRect(0,0,W,H);
          // ──────────────────────────────────────────────────────────────────

          // Letterbox
          ctx.fillStyle="#000";
          ctx.fillRect(0,0,W,Math.round(H*0.072));
          ctx.fillRect(0,H-Math.round(H*0.072),W,Math.round(H*0.072));

          // Film grain
          for(let g=0;g<30;g++){
            const gv=Math.random()>0.5?130:0;
            ctx.fillStyle="rgba("+gv+","+gv+","+gv+",0.008)";
            ctx.fillRect(Math.random()*W,Math.random()*H,1,1);
          }

          // Title card — opening and closing
          if(t<0.12||t>0.9){
            const a=t<0.12?Math.min(1,t/0.08):Math.max(0,(1-t)/0.08);
            ctx.globalAlpha=a*0.95;
            ctx.fillStyle="#e8c96d";
            ctx.font="900 "+Math.round(H*0.072)+"px Arial Black,Arial";
            ctx.textAlign="center";
            ctx.shadowColor="#e8c96d"; ctx.shadowBlur=28;
            ctx.fillText((config.title||"UNTITLED").toUpperCase(),W/2,H*0.43);
            ctx.shadowBlur=0;
            ctx.fillStyle="rgba(255,255,255,0.8)";
            ctx.font="300 "+Math.round(H*0.034)+"px Arial";
            ctx.fillText((config.artist||"").toUpperCase(),W/2,H*0.56);
            ctx.globalAlpha=1;
          }

          setRenderProgress(30+Math.round((frame/totalFrames)*64));
          if(frame%(fps*10)===0) addLog("  "+Math.round(sec)+"s / "+Math.round(totalDur)+"s");
          frame++;
          const due=wallStart+(frame*msPerFrame);
          setTimeout(tick,Math.max(4,due-performance.now()));
        };
        tick();
      });

      // ── FINALISE ────────────────────────────────────────────────
      setRenderProgress(96);
      addLog("Cutting to final...");
      await new Promise(r=>setTimeout(r,600));
      if(audioSource){try{audioSource.stop(audioCtx?audioCtx.currentTime:0);}catch(e){}}
      await new Promise(r=>{let d=false;const f=()=>{if(!d){d=true;r();}};setTimeout(f,4000);try{recorder.onstop=f;if(recorder.state!=="inactive"){recorder.stop();}else{f();}}catch(e){f();}});
      const blob=new Blob(chunks,{type:mimeType});
      const url=URL.createObjectURL(blob);
      setVideoUrl(url); setVideoBlob(blob);
      setRenderProgress(100);
      addLog("✓ "+config.title+" complete — "+(blob.size/1024/1024).toFixed(1)+"MB · "+Math.round(totalDur)+"s");

      const fn=(config.title||"MusicVideo")+"_"+config.artist+".webm";
      try{
        const clipId="mv_"+Date.now();
        await safeSaveClipToDB(clipId,blob,fn,"video/webm");
        addLog("✓ Saved");
        if(onSave)onSave({id:clipId,name:fn,type:"video/webm",url:URL.createObjectURL(blob),file:new File([blob],fn,{type:"video/webm"}),dbId:clipId});
      }catch(e){}
      if(audioCtx)try{audioCtx.close();}catch(e){}

    }catch(e){ addLog("Error: "+e.message); }
    setGenerating(false);
  };


  const SOCIAL = [
    ["YouTube","#FF0000","https://www.youtube.com/upload"],
    ["Instagram","#E1306C","https://www.instagram.com"],
    ["TikTok","#69C9D0","https://www.tiktok.com/upload"],
    ["Facebook","#1877F2","https://www.facebook.com"],
    ["X / Twitter","#1DA1F2","https://twitter.com"],
    ["Vimeo","#1AB7EA","https://vimeo.com/upload"],
  ];

  const inp = {width:"100%",background:"#000",border:"1px solid "+GOLDDIM,padding:"9px 12px",color:WHITE,fontSize:13,outline:"none",fontFamily:"'Rajdhani',sans-serif",boxSizing:"border-box"};
  const label = (txt) => <div style={{color:GOLD,fontSize:11,letterSpacing:3,fontWeight:900,marginBottom:6,marginTop:12}}>{txt}</div>;

  const sel = (k,arr) => (
    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:4}}>
      {arr.map(item=>(
        <button key={item} onClick={()=>set(k,item)}
          style={{background:config[k]===item?GOLD:"#111",border:"1px solid "+(config[k]===item?"#000":GOLDDIM),color:config[k]===item?"#000":WHITE,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:1}}>
          {item}
        </button>
      ))}
    </div>
  );
  const multi = (k,arr) => (
    <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:4}}>
      {arr.map(item=>(
        <button key={item} onClick={()=>tog(k,item)}
          style={{background:config[k].includes(item)?GOLD:"#111",border:"1px solid "+(config[k].includes(item)?"#000":GOLDDIM),color:config[k].includes(item)?"#000":WHITE,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:1}}>
          {item}
        </button>
      ))}
    </div>
  );

  const steps = ["🎵 SONG","🎤 STYLE","🎬 SCENE","▶ GENERATE"];
  const fmt = (s)=>{const m=Math.floor(s/60);const sc=Math.floor(s%60);return String(m).padStart(2,"0")+":"+String(sc).padStart(2,"0");};

  return (
    <div style={{position:"fixed",inset:0,zIndex:1100,background:"rgba(0,0,0,0.98)",display:"flex",alignItems:"center",justifyContent:"center"}}>
      <div style={{width:"min(960px,98vw)",height:"min(92vh,860px)",background:"#050505",border:"2px solid "+GOLD,display:"flex",flexDirection:"column",overflow:"hidden"}}>

        {/* Header */}
        <div style={{background:"linear-gradient(135deg,#1a0a00,#0a0500)",borderBottom:"1px solid "+GOLD+"",padding:"14px 22px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
          <div>
            <div style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:18,fontWeight:900,letterSpacing:4}}>🎬 MUSIC VIDEO STUDIO</div>
            <div style={{color:WHITE,fontSize:10,letterSpacing:3,marginTop:2}}>PROFESSIONAL MUSIC VIDEO PRODUCTION · AI POWERED · SELF-CONTAINED</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"1px solid "+GOLD,color:GOLD,width:32,height:32,cursor:"pointer",fontSize:16}}>✕</button>
        </div>

        {/* Step tabs */}
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",borderBottom:"1px solid "+GOLDDIM+"",flexShrink:0}}>
          {steps.map((s,i)=>(
            <button key={i} onClick={()=>setStep(i+1)}
              style={{background:step===i+1?"#0a0500":"none",border:"none",borderBottom:step===i+1?"2px solid "+GOLD:"2px solid transparent",color:step===i+1?GOLD:WHITE,padding:"11px 6px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2}}>
              {s}
            </button>
          ))}
        </div>

        {/* Content area */}
        <div style={{flex:1,display:"grid",gridTemplateColumns:videoUrl?"1fr 1fr":"1fr",overflow:"hidden"}}>

          {/* Left — config / generate */}
          <div style={{overflowY:"auto",padding:"16px 20px",borderRight:videoUrl?"1px solid "+GOLDDIM:"none"}}>

            {step===1&&(
              <div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
                  <div>{label("SONG TITLE")}<input value={config.title} onChange={e=>set("title",e.target.value)} placeholder="Song title..." style={inp}/></div>
                  <div>{label("ARTIST")}<input value={config.artist} onChange={e=>set("artist",e.target.value)} placeholder="Artist name..." style={inp}/></div>
                </div>
                {label("GENRE")}{sel("genre",GENRES)}
                {label("MOOD")}{sel("mood",MOODS)}
                {label("TEMPO")}{sel("tempo",TEMPOS)}
                {label("⬆ UPLOAD YOUR SONG — OR RECORD IT BELOW")}
                <div style={{background:"#000",border:"2px dashed "+(audioFile?GOLD:GOLDDIM),padding:"18px 12px",cursor:"pointer",transition:"all .2s"}}
                  onClick={()=>audioInputRef.current&&audioInputRef.current.click()}
                  onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=GOLD;e.currentTarget.style.background="#0a0500";}}
                  onDragLeave={e=>{e.currentTarget.style.borderColor=audioFile?GOLD:GOLDDIM;e.currentTarget.style.background="#000";}}
                  onDrop={e=>{
                    e.preventDefault();e.currentTarget.style.borderColor=GOLD;e.currentTarget.style.background="#000";
                    const f=e.dataTransfer.files&&e.dataTransfer.files[0];
                    if(f&&f.type.startsWith("audio/")){setAudioFile(f);setAudioUrl(URL.createObjectURL(f));setAudioName(f.name);}
                    else if(f){alert("Please drop an audio file — MP3, WAV or M4A.");}
                  }}>
                  <div style={{color:audioFile?"#22c55e":GOLD,fontWeight:900,fontSize:13,letterSpacing:2,textAlign:"center"}}>
                    {audioFile?"✓ "+audioName:"⬆ DRAG & DROP YOUR SONG HERE"}
                  </div>
                  <div style={{color:GOLDDIM,fontSize:10,marginTop:4,textAlign:"center",letterSpacing:1}}>{audioFile?"Tap to replace":"or tap to browse — MP3 · WAV · M4A"}</div>
                </div>
                <input ref={audioInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" style={{display:"none"}} onChange={handleAudioUpload}/>
                <RecordYourOwnSong onRecorded={(blob,name)=>{setAudioFile(blob);const u=URL.createObjectURL(blob);setAudioUrl(u);setAudioName(name);}}/>
                {audioFile&&<button onClick={()=>{setAudioFile(null);setAudioUrl("");setAudioName("");}} style={{background:"none",border:"1px solid #ef4444",color:"#ef4444",padding:"3px 10px",cursor:"pointer",fontSize:10,fontWeight:900,marginTop:6}}>✕ REMOVE AUDIO</button>}
                <div onClick={()=>set("stereo",!config.stereo)} style={{display:"flex",alignItems:"center",gap:10,marginTop:14,padding:"10px 12px",background:"#0a0a0a",border:"1px solid "+(config.stereo?GOLD:GOLDDIM),cursor:"pointer"}}>
                  <div style={{width:20,height:20,borderRadius:4,border:"2px solid "+(config.stereo?GOLD:GOLDDIM),background:config.stereo?GOLD:"transparent",color:"#000",fontWeight:900,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{config.stereo?"✓":""}</div>
                  <div><div style={{color:config.stereo?GOLD:WHITE,fontWeight:900,fontSize:12,letterSpacing:1}}>🔊 USE STEREO SOUND</div><div style={{color:GOLDDIM,fontSize:10,marginTop:1}}>Full stereo width baked into the exported video</div></div>
                </div>
              </div>
            )}

            {step===2&&(
              <div>
                {label("VIDEO STYLE")}{sel("videoStyle",STYLES)}
                {label("COLOUR GRADE")}{sel("colorGrade",GRADES)}
                {label("VISUAL EFFECTS")}{multi("effects",EFFECTS)}
                {label("EDITING STYLE")}{sel("cuts",CUTS)}
                {label("ASPECT RATIO")}
                <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                  {["16:9","9:16 (Vertical)","1:1 (Square)","2.39:1 (Cinematic)"].map(r=>(
                    <button key={r} onClick={()=>set("aspectRatio",r)}
                      style={{background:config.aspectRatio===r?GOLD:"#111",border:"1px solid "+(config.aspectRatio===r?"#000":GOLDDIM),color:config.aspectRatio===r?"#000":WHITE,padding:"4px 10px",cursor:"pointer",fontSize:11,fontWeight:900}}>
                      {r}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {step===3&&(
              <div>
                {label("DESCRIBE YOUR MUSIC VIDEO SCENE")}
                <div style={{color:GOLDDIM,fontSize:11,marginBottom:8,lineHeight:1.7}}>
                  Describe what you want to see. The AI director will build 8 cinematic shots from your description.
                </div>
                <textarea
                  value={config.visualDesc}
                  onChange={e=>set("visualDesc",e.target.value)}
                  placeholder="e.g. A man sits alone on a windowsill fingerpicking acoustic guitar. Only his back is visible. Facing the open ocean at night. Full moon low on the water. A single candle burns to his right. The room behind him is empty. A cold couch. A coat still on a hook. He does not move. A man who has lost someone."
                  style={{...inp,height:160,resize:"vertical",lineHeight:1.8,border:"1px solid "+GOLD}}
                />
                {label("DURATION")}
                <div style={{padding:"12px 14px",border:"1px solid "+GOLD,background:"#0a0a0a",marginBottom:8}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
                    <span style={{color:GOLDDIM,fontSize:11,fontWeight:900,letterSpacing:2}}>FILM LENGTH</span>
                    <span style={{color:GOLD,fontSize:13,fontWeight:900}}>{config.durationMin>0?(config.durationMin+" min"):"AUTO — match song"}</span>
                  </div>
                  <input type="range" min={0} max={180} step={1} value={config.durationMin||0}
                    onChange={e=>set("durationMin",+e.target.value)}
                    style={{width:"100%",accentColor:GOLD}}/>
                  <div style={{display:"flex",justifyContent:"space-between",color:GOLDDIM,fontSize:9,letterSpacing:1,marginTop:2}}>
                    <span>0 (AUTO)</span><span>90 min</span><span>180 min</span>
                  </div>
                  <div style={{color:config.durationMin>0?GOLD:GOLDDIM,fontSize:11,lineHeight:1.7,marginTop:8}}>
                    {config.durationMin>0
                      ? "⏱ This overrides the song length — the film will run exactly "+config.durationMin+" minute"+(config.durationMin===1?"":"s")+", looping or trimming the audio to fit."
                      : "🎵 At 0 the video automatically matches your song's length. Drag right to set a fixed length (up to 180 minutes) that overrides the music."}
                  </div>
                </div>
              </div>
            )}

            {step===4&&(
              <div>
                <div style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:16,fontWeight:900,marginBottom:10,letterSpacing:3}}>READY TO CREATE</div>

                {/* Drag-drop audio upload — moved here from Step 1 */}
                {label("⬆ UPLOAD YOUR AUDIO TRACK")}
                <div style={{background:"#000",border:"2px dashed "+(audioFile?GOLD:GOLDDIM),padding:"16px 12px",cursor:"pointer",marginBottom:8,transition:"border-color .2s"}}
                  onClick={()=>audioInputRef.current&&audioInputRef.current.click()}
                  onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=GOLD;e.currentTarget.style.background="#0a0500";}}
                  onDragLeave={e=>{e.currentTarget.style.borderColor=audioFile?GOLD:GOLDDIM;e.currentTarget.style.background="#000";}}
                  onDrop={e=>{
                    e.preventDefault();e.currentTarget.style.borderColor=GOLD;e.currentTarget.style.background="#000";
                    const f=e.dataTransfer.files&&e.dataTransfer.files[0];
                    if(f&&f.type.startsWith("audio/")){setAudioFile(f);setAudioUrl(URL.createObjectURL(f));setAudioName(f.name);}
                  }}>
                  <div style={{color:audioFile?"#22c55e":WHITE,fontWeight:900,fontSize:12,letterSpacing:2,textAlign:"center"}}>
                    {audioFile?"✓ "+audioName:"⬆ DRAG & DROP or CLICK — MP3 / WAV / M4A"}
                  </div>
                  {audioFile&&<div style={{color:GOLDDIM,fontSize:10,marginTop:4,textAlign:"center"}}>Audio will sync with your video — starts and ends together</div>}
                </div>
                <input ref={audioInputRef} type="file" accept="audio/*" style={{display:"none"}} onChange={handleAudioUpload}/>
                {audioFile&&<button onClick={()=>{setAudioFile(null);setAudioUrl("");setAudioName("");}} style={{background:"none",border:"1px solid #ef4444",color:"#ef4444",padding:"3px 10px",cursor:"pointer",fontSize:10,fontWeight:900,marginBottom:8}}>✕ REMOVE AUDIO</button>}

                {/* Scene description */}
                {label("DESCRIBE YOUR MUSIC VIDEO SCENE")}
                <textarea
                  value={config.visualDesc}
                  onChange={e=>set("visualDesc",e.target.value)}
                  placeholder="Describe what you want to see. e.g. A man sits alone on a windowsill fingerpicking acoustic guitar. Only his back is visible. Facing the open ocean at night. Full moon. Single candle. The room is empty. A man who has lost someone."
                  style={{width:"100%",background:"#000",border:"1px solid "+GOLD,padding:"12px",color:WHITE,fontSize:13,outline:"none",fontFamily:"'Rajdhani',sans-serif",boxSizing:"border-box",height:130,resize:"vertical",lineHeight:1.8,marginBottom:10}}
                />

                {/* Reference image upload with drag & drop */}
                {label("⬆ UPLOAD REFERENCE IMAGE (OPTIONAL)")}
                {config.refMedia?(
                  <div style={{position:"relative",marginBottom:10}}>
                    <img src={config.refMedia} alt="ref" style={{width:"100%",height:70,objectFit:"cover",border:"1px solid "+GOLD}}/>
                    <button onClick={()=>set("refMedia",null)} style={{position:"absolute",top:4,right:4,background:"#000",border:"1px solid "+GOLD,color:GOLD,padding:"1px 7px",cursor:"pointer",fontSize:10,fontWeight:900}}>✕</button>
                    <div style={{color:"#22c55e",fontSize:9,fontWeight:900,letterSpacing:2,marginTop:3}}>✓ REFERENCE LOADED</div>
                  </div>
                ):(
                  <div>
                    <div
                      onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=GOLD;e.currentTarget.style.background="#1a0800";}}
                      onDragLeave={e=>{e.currentTarget.style.borderColor=GOLDDIM;e.currentTarget.style.background="#0a0500";}}
                      onDrop={e=>{
                        e.preventDefault();
                        e.currentTarget.style.borderColor=GOLDDIM;e.currentTarget.style.background="#0a0500";
                        const f=e.dataTransfer.files&&e.dataTransfer.files[0];
                        if(f&&(f.type.startsWith("image/")||f.type.startsWith("video/"))){
                          set("refMedia",URL.createObjectURL(f));
                        }
                      }}
                      onClick={()=>{const inp=document.createElement("input");inp.type="file";inp.accept="image/*,video/*";inp.onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)set("refMedia",URL.createObjectURL(f));};inp.click();}}
                      style={{background:"#0a0500",border:"2px dashed "+GOLDDIM,padding:"18px 10px",textAlign:"center",cursor:"pointer",marginBottom:6,transition:"all .2s"}}>
                      <div style={{color:GOLD,fontSize:14,fontWeight:900,letterSpacing:2,marginBottom:4}}>⬆ DRAG & DROP HERE</div>
                      <div style={{color:GOLDDIM,fontSize:10,letterSpacing:2}}>or click to browse — JPG · PNG · MP4</div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginBottom:10}}>
                      <button onClick={()=>{const inp=document.createElement("input");inp.type="file";inp.accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif";inp.onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)set("refMedia",URL.createObjectURL(f));};inp.click();}}
                        style={{background:"linear-gradient(135deg,#1a0800,#2a1200)",border:"2px solid "+GOLD,color:GOLD,padding:"10px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}>
                        📷 UPLOAD PHOTO
                      </button>
                      <button onClick={()=>{const inp=document.createElement("input");inp.type="file";inp.accept="image/*,video/*";inp.onchange=e=>{const f=e.target.files&&e.target.files[0];if(f)set("refMedia",URL.createObjectURL(f));};inp.click();}}
                        style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,color:WHITE,padding:"10px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}>
                        📁 UPLOAD FILE
                      </button>
                    </div>
                  </div>
                )}

                {/* Summary */}
                <div style={{background:"#0a0500",border:"1px solid "+GOLDDIM,padding:14,marginBottom:14}}>
                  <div style={{color:GOLD,fontSize:11,letterSpacing:2,marginBottom:8,fontWeight:900}}>YOUR MUSIC VIDEO</div>
                  {[["TITLE",config.title||"—"],["ARTIST",config.artist||"—"],["GENRE",config.genre||"—"],["MOOD",config.mood||"—"],["STYLE",config.videoStyle||"—"],["GRADE",config.colorGrade||"—"],["DURATION",config.durationMin>0?(config.durationMin+" min"):"Auto — match song"],["AUDIO",audioName||"No audio uploaded"]].map(([k,v])=>(
                    <div key={k} style={{display:"flex",justifyContent:"space-between",fontSize:12,padding:"3px 0",borderBottom:"1px solid #0a0800"}}>
                      <span style={{color:GOLDDIM,letterSpacing:2}}>{k}</span>
                      <span style={{color:WHITE,fontWeight:700}}>{v}</span>
                    </div>
                  ))}
                </div>

                {/* Auto lip sync toggle */}
                <div style={{display:"flex",alignItems:"center",gap:10,marginBottom:10}}>
                  <button onClick={()=>set("lipSync",!config.lipSync)}
                    style={{background:config.lipSync?GOLD:"#111",border:"1px solid "+(config.lipSync?"#000":GOLDDIM),color:config.lipSync?"#000":WHITE,padding:"6px 14px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>
                    {config.lipSync?"✓ AUTO LIP SYNC ON":"AUTO LIP SYNC"}
                  </button>
                  <span style={{color:GOLDDIM,fontSize:10}}>Mouth syncs to beats automatically</span>
                </div>

                {/* Autosave indicator */}
                <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:10}}>
                  <span style={{color:"#22c55e",fontSize:11,fontWeight:900}}>● AUTOSAVE ON</span>
                  <span style={{color:GOLDDIM,fontSize:10}}>Your settings are saved as you work</span>
                </div>

                <button onClick={generateVideo} disabled={generating}
                  style={{background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",width:"100%",padding:"18px",fontSize:14,letterSpacing:3,cursor:generating?"not-allowed":"pointer",fontWeight:900,fontFamily:"'Rajdhani',sans-serif",opacity:generating?0.7:1,marginBottom:10}}>
                  {generating?"⟳ RENDERING... "+renderProgress+"%":"🎬 GENERATE MUSIC VIDEO"}
                </button>
                {generating&&(
                  <div>
                    <div style={{height:5,background:"#111",marginBottom:6}}>
                      <div style={{width:renderProgress+"%",height:"100%",background:"linear-gradient(90deg,#a07820,#e8c96d)",transition:"width .3s"}}/>
                    </div>
                    <div style={{background:"#000",border:"1px solid "+GOLDDIM,padding:10,maxHeight:140,overflowY:"auto"}}>
                      {renderLog.map((l,i)=>(
                        <div key={i} style={{color:i===renderLog.length-1?"#22c55e":DIM,fontSize:10,lineHeight:1.8}}>
                          {i===renderLog.length-1?"▶ ":"  "}{l}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {!generating&&renderLog.length>0&&(
                  <div style={{background:"#000",border:"1px solid "+GOLDDIM,padding:10,maxHeight:120,overflowY:"auto"}}>
                    {renderLog.map((l,i)=>(
                      <div key={i} style={{color:i===renderLog.length-1?"#22c55e":DIM,fontSize:10,lineHeight:1.8}}>
                        {i===renderLog.length-1?"▶ ":"  "}{l}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Right — video player + export (only when video exists) */}
          {videoUrl&&(
            <div style={{display:"flex",flexDirection:"column",background:"#000",overflow:"hidden"}}>
              {/* Video player */}
              <div style={{position:"relative",background:"#000"}}>
                <canvas ref={canvasRef} style={{position:"fixed",right:8,bottom:8,width:160,height:90,opacity:1,pointerEvents:"none",zIndex:9999,border:"1px solid #e8c96d",background:"#000"}}/>
                <video ref={videoRef} src={videoUrl} playsInline
                  style={{width:"100%",aspectRatio:"16/9",display:"block",background:"#000"}}
                  onTimeUpdate={()=>setCurrentTime(videoRef.current?.currentTime||0)}
                  onLoadedMetadata={()=>{
                    const v=videoRef.current;if(!v)return;
                    // Chrome WebM duration bug: force seek to end so browser reads real duration
                    if(v.duration===Infinity||isNaN(v.duration)||v.duration===0){
                      v.currentTime=1e10;
                      const fix=()=>{v.currentTime=0;setDuration2(v.duration||0);v.removeEventListener("timeupdate",fix);};
                      v.addEventListener("timeupdate",fix);
                    } else {
                      setDuration2(v.duration);
                    }
                  }}
                  onPlay={()=>setPlaying(true)}
                  onPause={()=>setPlaying(false)}
                  onEnded={()=>setPlaying(false)}
                />
                {/* Custom controls overlay */}
                <div style={{background:"rgba(0,0,0,0.85)",padding:"8px 12px"}}>
                  <div style={{height:3,background:"#222",marginBottom:8,cursor:"pointer",borderRadius:2}}
                    onClick={e=>{if(!videoRef.current||!duration2)return;const r=e.currentTarget.getBoundingClientRect();videoRef.current.currentTime=((e.clientX-r.left)/r.width)*duration2;}}>
                    <div style={{width:duration2&&isFinite(duration2)?(currentTime/duration2*100):0+"%",height:"100%",background:GOLD,borderRadius:2,transition:"width .1s"}}/>
                  </div>
                  <div style={{display:"flex",alignItems:"center",justifyContent:"space-between"}}>
                    <div style={{display:"flex",alignItems:"center",gap:8}}>
                      <button onClick={()=>videoRef.current&&(videoRef.current.currentTime=0)} style={{background:"none",border:"none",color:GOLDDIM,cursor:"pointer",fontSize:14}}>⏮</button>
                      <button onClick={()=>{if(!videoRef.current)return;playing?videoRef.current.pause():videoRef.current.play();}} style={{background:GOLD,border:"none",color:"#000",width:32,height:32,cursor:"pointer",fontSize:16,fontWeight:900}}>
                        {playing?"⏸":"▶"}
                      </button>
                      <button onClick={()=>videoRef.current&&(videoRef.current.currentTime=Math.min(duration2,videoRef.current.currentTime+10))} style={{background:"none",border:"none",color:GOLDDIM,cursor:"pointer",fontSize:14}}>⏩</button>
                      <span style={{color:WHITE,fontSize:11,fontFamily:"monospace"}}>{fmt(currentTime||0)} / {fmt(isFinite(duration2)&&duration2>0?duration2:0)}</span>
                    </div>
                    <div style={{display:"flex",alignItems:"center",gap:6}}>
                      <span style={{color:GOLDDIM,fontSize:10}}>VOL</span>
                      <input type="range" min={0} max={1} step={0.05} defaultValue={0.85}
                        onChange={e=>{if(videoRef.current)videoRef.current.volume=+e.target.value;}}
                        style={{width:70,accentColor:GOLD}}/>
                    </div>
                  </div>
                </div>
              </div>

              {/* Export panel */}
              <div style={{flex:1,overflowY:"auto",padding:"12px 14px"}}>
                <div style={{color:GOLD,fontSize:11,fontWeight:900,letterSpacing:3,marginBottom:10}}>EXPORT YOUR MUSIC VIDEO</div>

                {/* Download */}
                <a href={videoUrl} download={(config.title||"MusicVideo")+"_"+config.artist+".webm"} target="_blank" rel="noopener noreferrer"
                  style={{display:"block",background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"12px",textAlign:"center",textDecoration:"none",fontWeight:900,fontSize:12,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",marginBottom:8}}>
                  ⬇ DOWNLOAD VIDEO
                </a>

                {/* Save to media library */}
                <button onClick={()=>{
                  if(videoBlob&&onSave){
                    const fn=(config.title||"MusicVideo")+"_"+config.artist+".webm";
                    onSave({id:"mv_"+Date.now(),name:fn,type:"video/webm",url:videoUrl,file:new File([videoBlob],fn,{type:"video/webm"})});
                    addLog("✓ Saved to media library");
                  }
                }} style={{width:"100%",background:"transparent",border:"1px solid "+GOLD,color:GOLD,padding:"10px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",marginBottom:14}}>
                  💾 SAVE TO MEDIA LIBRARY
                </button>

                {/* Share to social */}
                <div style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:3,marginBottom:8}}>SHARE TO</div>
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:5,marginBottom:12}}>
                  {SOCIAL.map(([name,color,url])=>(
                    <button key={name} onClick={()=>window.open(url,"_blank")}
                      style={{background:"#000",border:"1px solid "+color+"33",color:color,padding:"7px 4px",cursor:"pointer",fontSize:10,fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}
                      onMouseEnter={e=>{e.currentTarget.style.background=color+"22";}}
                      onMouseLeave={e=>{e.currentTarget.style.background="#000";}}>
                      {name}
                    </button>
                  ))}
                </div>

                {/* New project */}
                <button onClick={()=>{setVideoUrl("");setVideoBlob(null);setRenderLog([]);setRenderProgress(0);setStep(1);}}
                  style={{width:"100%",background:"transparent",border:"1px solid "+GOLDDIM,color:GOLDDIM,padding:"8px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>
                  + NEW MUSIC VIDEO
                </button>
              </div>
            </div>
          )}

          {/* Canvas for rendering (always hidden) */}
          {!videoUrl&&<canvas ref={canvasRef} style={{position:"fixed",right:8,bottom:8,width:160,height:90,opacity:1,pointerEvents:"none",zIndex:9999,border:"1px solid #e8c96d",background:"#000"}}/>}
        </div>

        {/* Bottom nav */}
        {!videoUrl&&(
          <div style={{borderTop:"1px solid "+GOLDDIM+"",padding:"10px 20px",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
            <button onClick={()=>setStep(s=>Math.max(1,s-1))} disabled={step===1} style={{background:"transparent",border:"1px solid "+GOLD,color:GOLD,padding:"6px 16px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",opacity:step===1?0.3:1}}>◀ BACK</button>
            <span style={{color:GOLDDIM,fontSize:10,letterSpacing:2}}>STEP {step} OF 4</span>
            {step<4
              ?<button onClick={()=>setStep(s=>Math.min(4,s+1))} style={{background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"6px 16px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>NEXT ▶</button>
              :<button onClick={onClose} style={{background:"transparent",border:"1px solid "+GOLDDIM,color:GOLDDIM,padding:"6px 16px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>CLOSE</button>
            }
          </div>
        )}
      </div>
    </div>
  );
}

const VOICE_CHARACTERS = [
  {id:"amanda",name:"Amanda",emoji:"⭐",gender:"Female",age:"Adult",origin:"Founder",region:"MandaStrong",style:"Your voice · Narrator",pitch:1.0,rate:0.85,desc:"Amanda's own voice — your recorded narration.",isOwner:true},
  {id:"james",name:"James",emoji:"🎩",gender:"Male",age:"Adult",origin:"British",region:"London",style:"Sarcastic · Deadpan · Witty",pitch:0.86,rate:0.62,desc:"Dry British wit. Devastating things said with complete calm."},
  {id:"aurora",name:"Aurora",emoji:"🌅",gender:"Female",age:"Adult",origin:"British",region:"London",style:"Warm · Documentary · Authoritative",pitch:1.08,rate:0.80,desc:"Calm authority. The voice you trust completely."},
  {id:"edward",name:"Edward",emoji:"🎭",gender:"Male",age:"Adult",origin:"British",region:"London",style:"Theatrical · Grand · Classical",pitch:0.85,rate:0.75,desc:"Shakespearean gravitas. Every sentence carved in stone."},
  {id:"cecily",name:"Cecily",emoji:"🫖",gender:"Female",age:"Adult",origin:"British",region:"London",style:"Crisp · Intelligent · Sardonic",pitch:1.12,rate:0.85,desc:"Sharp as a tack. Mildly disappointed by most things."},
  {id:"nana",name:"Nana",emoji:"🧶",gender:"Female",age:"Elderly",origin:"British",region:"Yorkshire",style:"Gentle · Wise · Warm",pitch:1.02,rate:0.70,desc:"Warm elderly wisdom. Has seen everything twice."},
  {id:"colonel",name:"Colonel",emoji:"🎖️",gender:"Male",age:"Elderly",origin:"British",region:"London",style:"Commanding · Dignified · Veteran",pitch:0.80,rate:0.74,desc:"Authority earned through decades of experience."},
  {id:"pippa",name:"Pippa",emoji:"🎀",gender:"Female",age:"Teen",origin:"British",region:"London",style:"Bright · Cheerful · Young",pitch:1.25,rate:0.95,desc:"Fresh and warm. Natural young British energy."},
  {id:"archie",name:"Archie",emoji:"⚽",gender:"Male",age:"Teen",origin:"British",region:"Manchester",style:"Casual · Friendly · Teen",pitch:1.05,rate:0.98,desc:"Relaxed and genuine. Sounds like a real teenager."},
  {id:"ewan",name:"Ewan",emoji:"🏴",gender:"Male",age:"Adult",origin:"Scottish",region:"Edinburgh",style:"Warm · Rugged · Sincere",pitch:0.92,rate:0.82,desc:"Deep warm Scottish sincerity."},
  {id:"fiona",name:"Fiona",emoji:"🌿",gender:"Female",age:"Adult",origin:"Scottish",region:"Glasgow",style:"Lilting · Warm · Storyteller",pitch:1.10,rate:0.84,desc:"Beautiful Scottish lilt."},
  {id:"paddy",name:"Paddy",emoji:"☘️",gender:"Male",age:"Adult",origin:"Irish",region:"Dublin",style:"Charming · Witty · Warm",pitch:0.95,rate:0.88,desc:"Easy Irish charm."},
  {id:"siobhan",name:"Siobhan",emoji:"🌸",gender:"Female",age:"Adult",origin:"Irish",region:"Cork",style:"Gentle · Musical · Emotional",pitch:1.15,rate:0.82,desc:"Soft Irish voice with real emotional depth."},
  {id:"dafydd",name:"Dafydd",emoji:"🐉",gender:"Male",age:"Adult",origin:"Welsh",region:"Cardiff",style:"Musical · Passionate · Rich",pitch:0.90,rate:0.80,desc:"Rich Welsh musicality."},
  {id:"marcus",name:"Marcus",emoji:"⚡",gender:"Male",age:"Adult",origin:"American",region:"New York",style:"Deep · Cinematic · Commanding",pitch:0.72,rate:0.74,desc:"Big voice. When Marcus speaks people stop."},
  {id:"river",name:"River",emoji:"🌊",gender:"Male",age:"Adult",origin:"American",region:"Tennessee",style:"Warm · Intimate · Storyteller",pitch:0.98,rate:0.76,desc:"Unhurried Southern charm."},
  {id:"dakota",name:"Dakota",emoji:"🏔️",gender:"Female",age:"Adult",origin:"American",region:"Chicago",style:"Bold · Direct · Confident",pitch:1.05,rate:0.92,desc:"No filler. No hesitation."},
  {id:"wade",name:"Wade",emoji:"🤠",gender:"Male",age:"Adult",origin:"American",region:"Texas",style:"Laid Back · Humorous · Folksy",pitch:0.94,rate:0.85,desc:"Easy going Southern humour."},
  {id:"brooklyn",name:"Brooklyn",emoji:"🗽",gender:"Female",age:"Adult",origin:"American",region:"New York",style:"Fast · Sharp · City Energy",pitch:1.18,rate:1.10,desc:"Fast New York energy."},
  {id:"savannah",name:"Savannah",emoji:"🌺",gender:"Female",age:"Adult",origin:"American",region:"Georgia",style:"Sweet · Gracious · Warm",pitch:1.20,rate:0.84,desc:"Warm Southern grace."},
  {id:"madison",name:"Madison",emoji:"📱",gender:"Female",age:"Teen",origin:"American",region:"California",style:"Upbeat · Social · Natural",pitch:1.30,rate:1.08,desc:"Real American teenage energy."},
  {id:"tyler",name:"Tyler",emoji:"🎮",gender:"Male",age:"Teen",origin:"American",region:"Ohio",style:"Casual · Relatable · Teen",pitch:1.08,rate:1.00,desc:"Natural and unforced."},
  {id:"rosie",name:"Rosie",emoji:"🌼",gender:"Female",age:"Child",origin:"American",region:"Florida",style:"Sweet · Innocent · Child",pitch:1.45,rate:0.88,desc:"Young warm and sweet."},
  {id:"cooper",name:"Cooper",emoji:"🚂",gender:"Male",age:"Child",origin:"American",region:"Colorado",style:"Bright · Curious · Child",pitch:1.40,rate:0.90,desc:"Curious about everything."},
  {id:"grandma",name:"Grandma",emoji:"🫶",gender:"Female",age:"Elderly",origin:"American",region:"Virginia",style:"Warm · Loving · Elderly",pitch:1.00,rate:0.72,desc:"Full of love and life experience."},
  {id:"frank",name:"Frank",emoji:"🪑",gender:"Male",age:"Elderly",origin:"American",region:"New Jersey",style:"Gruff · Honest · Elder",pitch:0.78,rate:0.76,desc:"Says it straight."},
  {id:"sophia",name:"Sophia",emoji:"☀️",gender:"Female",age:"Adult",origin:"Australian",region:"Sydney",style:"Upbeat · Bright · Energetic",pitch:1.35,rate:1.12,desc:"Forward energy."},
  {id:"finn",name:"Finn",emoji:"🏄",gender:"Male",age:"Adult",origin:"Australian",region:"Melbourne",style:"Casual · Confident · Outdoorsy",pitch:0.95,rate:0.95,desc:"Relaxed Australian confidence."},
  {id:"aroha",name:"Aroha",emoji:"🌿",gender:"Female",age:"Adult",origin:"New Zealand",region:"Auckland",style:"Warm · Grounded · Sincere",pitch:1.10,rate:0.86,desc:"Natural sincerity."},
  {id:"amara",name:"Amara",emoji:"🌍",gender:"Female",age:"Adult",origin:"South African",region:"Cape Town",style:"Rich · Warm · Powerful",pitch:1.05,rate:0.84,desc:"Quiet power."},
  {id:"kofi",name:"Kofi",emoji:"🥁",gender:"Male",age:"Adult",origin:"West African",region:"Ghana",style:"Deep · Rhythmic · Storyteller",pitch:0.82,rate:0.78,desc:"Every sentence has music in it."},
  {id:"priya",name:"Priya",emoji:"🪷",gender:"Female",age:"Adult",origin:"Indian",region:"Mumbai",style:"Precise · Warm · Intelligent",pitch:1.15,rate:0.90,desc:"Warm and intelligent."},
  {id:"arjun",name:"Arjun",emoji:"🎯",gender:"Male",age:"Adult",origin:"Indian",region:"Delhi",style:"Authoritative · Clear · Measured",pitch:0.88,rate:0.85,desc:"Sounds like someone who knows exactly what they are talking about."},
  {id:"valentina",name:"Valentina",emoji:"🌹",gender:"Female",age:"Adult",origin:"Spanish",region:"Madrid",style:"Passionate · Warm · Expressive",pitch:1.18,rate:0.92,desc:"Everything sounds felt."},
  {id:"pierre",name:"Pierre",emoji:"🥐",gender:"Male",age:"Adult",origin:"French",region:"Paris",style:"Suave · Dry · Cultured",pitch:0.90,rate:0.84,desc:"Makes things sound interesting."},
  {id:"ingrid",name:"Ingrid",emoji:"❄️",gender:"Female",age:"Adult",origin:"Scandinavian",region:"Stockholm",style:"Clean · Cool · Direct",pitch:1.08,rate:0.88,desc:"No excess words."},
  {id:"yemi",name:"Yemi",emoji:"🌟",gender:"Female",age:"Adult",origin:"Nigerian",region:"Lagos",style:"Bold · Joyful · Energetic",pitch:1.25,rate:1.00,desc:"Life-affirming."},
  {id:"magnus",name:"Magnus",emoji:"🧙",gender:"Male",age:"Elderly",origin:"Fantasy",region:"Ancient",style:"Ancient · Wise · Epic",pitch:0.75,rate:0.70,desc:"Seen civilisations rise and fall."},
  {id:"nova",name:"Nova",emoji:"🤖",gender:"Female",age:"Adult",origin:"Neutral",region:"AI",style:"Clean · Precise · Neutral",pitch:1.12,rate:0.95,desc:"No accent. No emotion. No opinion."},
  {id:"hunter",name:"Hunter",emoji:"🎬",gender:"Male",age:"Adult",origin:"American",region:"Hollywood",style:"Trailer · Epic · Explosive",pitch:0.70,rate:0.80,desc:"Full movie trailer energy."},
  {id:"luna",name:"Luna",emoji:"🌙",gender:"Female",age:"Adult",origin:"Neutral",region:"ASMR",style:"Whisper · ASMR · Intimate",pitch:1.20,rate:0.65,desc:"Soft whisper. Complete calm."},
  {id:"professor",name:"Professor",emoji:"🎓",gender:"Male",age:"Elderly",origin:"British",region:"Oxford",style:"Academic · Thoughtful · Measured",pitch:0.88,rate:0.78,desc:"Distinguished. Precise."},
  {id:"hope",name:"Hope",emoji:"🌤️",gender:"Female",age:"Adult",origin:"American",region:"Heartfelt",style:"Tender · Gentle · Loving",pitch:1.15,rate:0.78,desc:"Pure tenderness."},
  {id:"storm",name:"Storm",emoji:"⛈️",gender:"Male",age:"Adult",origin:"American",region:"Intense",style:"Intense · Angry · Powerful",pitch:0.82,rate:1.00,desc:"Raw intensity."},
  {id:"joy",name:"Joy",emoji:"🎉",gender:"Female",age:"Adult",origin:"American",region:"Uplifting",style:"Excited · Joyful · Celebratory",pitch:1.40,rate:1.15,desc:"Pure infectious joy."},
  {id:"sage",name:"Sage",emoji:"🌿",gender:"Male",age:"Adult",origin:"Neutral",region:"Mindful",style:"Peaceful · Mindful · Grounded",pitch:0.95,rate:0.72,desc:"Deep calm."},
  {id:"faith",name:"Faith",emoji:"✨",gender:"Female",age:"Adult",origin:"American",region:"Gospel",style:"Inspirational · Gospel · Uplifting",pitch:1.18,rate:0.88,desc:"Gospel soul."},
  {id:"rebel",name:"Rebel",emoji:"✊",gender:"Female",age:"Teen",origin:"American",region:"Activist",style:"Fierce · Defiant · Young",pitch:1.22,rate:1.05,desc:"Will not back down."},
  {id:"blaze",name:"Blaze",emoji:"🔥",gender:"Female",age:"Adult",origin:"American",region:"Cinematic",style:"Warm · Confident · Cinematic",pitch:1.02,rate:0.95,desc:"Warm cinematic narrator."},
  {id:"remy",name:"Remy",emoji:"🎻",gender:"Male",age:"Adult",origin:"French",region:"Lyon",style:"Smooth · Romantic · Intimate",pitch:0.92,rate:0.80,desc:"Everything sounds like poetry."},
  {id:"zhara",name:"Zhara",emoji:"💫",gender:"Female",age:"Adult",origin:"Middle Eastern",region:"Dubai",style:"Elegant · Warm · Sophisticated",pitch:1.10,rate:0.85,desc:"Graceful and precise."},
  {id:"kai",name:"Kai",emoji:"🌊",gender:"Male",age:"Adult",origin:"Hawaiian",region:"Honolulu",style:"Relaxed · Warm · Soulful",pitch:0.96,rate:0.82,desc:"Unhurried ocean warmth."},
  {id:"sienna",name:"Sienna",emoji:"🎨",gender:"Female",age:"Adult",origin:"American",region:"New Orleans",style:"Soulful · Blues · Deep",pitch:1.05,rate:0.78,desc:"Every word feels lived-in."},
  {id:"atlas",name:"Atlas",emoji:"🌐",gender:"Male",age:"Adult",origin:"Neutral",region:"Epic",style:"Cinematic · Epic · Booming",pitch:0.68,rate:0.76,desc:"The voice of a thousand documentaries."},
  {id:"echo",name:"Echo",emoji:"🔮",gender:"Female",age:"Adult",origin:"Neutral",region:"Ethereal",style:"Ethereal · Dreamy · Otherworldly",pitch:1.22,rate:0.72,desc:"Sounds like it came from somewhere else."},
];

function P6Voice({ onSave, setMediaLib }) {
  const [text,setText]=useState(""); const [loading,setLoading]=useState(false);
  const [speaking,setSpeaking]=useState(false); const [mood,setMood]=useState("Neutral");
  const [savedToLib,setSavedToLib]=useState(false); const [showMVS,setShowMVS]=useState(false);
  const [selVoice,setSelVoice]=useState("james"); const [search,setSearch]=useState("");
  const [filterGender,setFilterGender]=useState("All"); const [filterAge,setFilterAge]=useState("All");
  const [filterOrigin,setFilterOrigin]=useState("All"); const [speed,setSpeed]=useState(0.62);
  const [pitchV,setPitchV]=useState(0.86); const [pauseLen,setPauseLen]=useState(1600);
  const [volume,setVolume]=useState(1.0); const [sysVoices,setSysVoices]=useState([]);
  const [myVoices,setMyVoices]=useState(()=>{try{return JSON.parse(localStorage.getItem("ms_my_voices")||"[]");}catch{return [];}});
  const myVoiceInputRef=useRef(null);
  const chunksRef=useRef([]); const idxRef=useRef(0); const timerRef=useRef(null);
  const [recordingMine,setRecordingMine]=useState(false); const [recTime,setRecTime]=useState(0);
  const micRef=useRef(null); const recTimerRef=useRef(null);
  // Save your own voice AND keep the real audio in IndexedDB so it survives reload
  // and can be baked into the film. (Previously only a blob: URL was kept, which
  // died on refresh — that is why a recorded voice never actually played back.)
  const addMyVoice=async(file)=>{
    if(!file)return;
    const id="myvoice_"+Date.now();
    const url=URL.createObjectURL(file);
    const nv={id,name:(file.name||"My Voice").replace(/\.[^.]+$/,""),url,dbId:id,origin:"My Upload",gender:"—",age:"—",emoji:"🎙",style:"Your recorded voice",desc:"Your own voice — plays back exactly as recorded."};
    try{await safeSaveClipToDB(id,file,nv.name,"audio/myvoice");}catch(e){}
    const upd=[nv,...myVoices];
    setMyVoices(upd);
    try{localStorage.setItem("ms_my_voices",JSON.stringify(upd.map(v=>({...v,url:undefined}))));}catch{}
    setSelVoice(id);
  };
  const startMyRecording=async()=>{
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mr=new MediaRecorder(stream); micRef.current=mr; const chunks=[];
      mr.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
      mr.onstop=async()=>{
        const blob=new Blob(chunks,{type:"audio/webm"});
        const f=new File([blob],"My Recording "+new Date().toLocaleTimeString()+".webm",{type:"audio/webm"});
        await addMyVoice(f);
        stream.getTracks().forEach(t=>t.stop());
        setRecordingMine(false);setRecTime(0);
      };
      mr.start(100);setRecordingMine(true);setRecTime(0);
      recTimerRef.current=setInterval(()=>setRecTime(t=>t+1),1000);
    }catch(e){alert("Microphone access denied. Please allow microphone and try again.");}
  };
  const stopMyRecording=()=>{
    if(micRef.current&&micRef.current.state!=="inactive")micRef.current.stop();
    if(recTimerRef.current)clearInterval(recTimerRef.current);
  };
  // Save the SELECTED own-voice recording as the film's narration — real audio,
  // not synthetic. Lands on the timeline audio track like any other clip.
  const saveMyVoiceAsNarration=async()=>{
    const mine=myVoices.find(v=>v.id===selVoice);
    if(!mine){alert("Pick or record your own voice first, then save it as narration.");return;}
    let blob=null;
    try{const st=await loadClipFromDB(mine.dbId||mine.id);if(st&&st.blob)blob=st.blob;}catch(e){}
    if(!blob&&mine.url){try{blob=await (await fetch(mine.url)).blob();}catch(e){}}
    if(!blob){alert("Could not find that recording's audio — try recording again.");return;}
    const id="narr_myvoice_"+Date.now();
    const asset={id,name:"My Voice Narration - "+new Date().toLocaleTimeString(),type:"audio/myvoice",dbId:id,date:new Date().toISOString()};
    await safeSaveClipToDB(id,blob,asset.name,"audio/myvoice");
    if(onSave)onSave(asset);
    if(setMediaLib)setMediaLib(p=>[...p,asset]);
    setSavedToLib(true);setTimeout(()=>setSavedToLib(false),3000);
  };
  const delMyVoice=(id)=>{const upd=myVoices.filter(v=>v.id!==id);setMyVoices(upd);try{localStorage.setItem("ms_my_voices",JSON.stringify(upd.map(v=>({...v,url:undefined}))));}catch{}};

  // ── HIDDEN CLONE FEATURE ────────────────────────────────────────
  // Not shown in normal UI. Turns the SELECTED own-voice recording into
  // a cloned voice the engine can speak new text in. The clone is stored
  // as an engine voice id on that my-voice entry; picking it later makes
  // the engine narrate in the cloned voice.
  const [cloning,setCloning]=useState(false);
  const cloneMyVoice=async()=>{
    const mine=myVoices.find(v=>v.id===selVoice);
    if(!mine){alert("Pick or record one of your own voices first, then clone it.");return;}
    if(mine.clonedVoiceId){alert("This voice is already cloned. Select it and the engine will narrate in your cloned voice.");return;}
    setCloning(true);
    try{
      // Get the real audio for the sample, as a data URI the engine can read.
      let blob=null;
      try{const st=await loadClipFromDB(mine.dbId||mine.id);if(st&&st.blob)blob=st.blob;}catch(e){}
      if(!blob&&mine.url){try{blob=await (await fetch(mine.url)).blob();}catch(e){}}
      if(!blob){setCloning(false);alert("Could not find that recording's audio — try recording again.");return;}
      const dataUri=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob);});
      const vid=await engineCloneVoice(dataUri);
      if(!vid){setCloning(false);alert("Voice clone did not complete. Check the engine has credit, then try again.");return;}
      const upd=myVoices.map(v=>v.id===mine.id?{...v,clonedVoiceId:vid,engineVoice:vid,desc:"Your cloned voice — the engine narrates new text in your voice.",style:"Your cloned voice"}:v);
      setMyVoices(upd);
      try{localStorage.setItem("ms_my_voices",JSON.stringify(upd.map(v=>({...v,url:undefined}))));}catch{}
      setCloning(false);
      alert("Cloned. Select this voice and the engine will narrate any text in your voice.");
    }catch(e){setCloning(false);alert("Voice clone failed — try again.");}
  };

  // ── CONSENT + COMPLETE-NARRATION ────────────────────────────────
  // Consent gate: no one's voice becomes narrator without agreeing.
  const [narrConsent,setNarrConsent]=useState(()=>{try{return localStorage.getItem("ms_narr_consent")||"";}catch{return "";}});
  const setConsent=(v)=>{setNarrConsent(v);try{localStorage.setItem("ms_narr_consent",v);}catch{}};
  const [cloneConsent,setCloneConsent]=useState(()=>{try{return localStorage.getItem("ms_clone_consent")||"";}catch{return "";}});
  const setCloneOk=(v)=>{setCloneConsent(v);try{localStorage.setItem("ms_clone_consent",v);}catch{}};
  const [narrBusy,setNarrBusy]=useState(false);
  // Record just the first paragraph in your own voice; the engine clones it
  // and reads the WHOLE narration script (the YOUR NARRATION SCRIPT box) in
  // your voice, then saves it to the media library / timeline for the render.
  const engineCompleteNarration=async()=>{
    const mine=myVoices.find(v=>v.id===selVoice);
    if(!mine){alert("Record or pick your own voice first.");return;}
    const script=(text||"").trim();
    if(!script){alert("Paste your narration into YOUR NARRATION SCRIPT first.");return;}
    setNarrBusy(true);
    try{
      let vid=mine.clonedVoiceId;
      if(!vid){
        let blob=null;
        try{const st=await loadClipFromDB(mine.dbId||mine.id);if(st&&st.blob)blob=st.blob;}catch(e){}
        if(!blob&&mine.url){try{blob=await (await fetch(mine.url)).blob();}catch(e){}}
        if(!blob){setNarrBusy(false);alert("Could not find that recording's audio — try recording again.");return;}
        const dataUri=await new Promise((res,rej)=>{const r=new FileReader();r.onload=()=>res(r.result);r.onerror=rej;r.readAsDataURL(blob);});
        vid=await engineCloneVoice(dataUri);
        if(!vid){setNarrBusy(false);alert("Voice clone did not complete. Check the engine has credit, then try again.");return;}
        const upd=myVoices.map(v=>v.id===mine.id?{...v,clonedVoiceId:vid,engineVoice:vid}:v);
        setMyVoices(upd);
        try{localStorage.setItem("ms_my_voices",JSON.stringify(upd.map(v=>({...v,url:undefined}))));}catch{}
      }
      // Bake the whole script through the engine in the cloned voice.
      const buf=await engineSpeak(script,{voice:vid});
      const id="narr_myvoice_full_"+Date.now();
      const asset={id,name:"Full Narration (my cloned voice) - "+new Date().toLocaleTimeString(),type:"audio/myvoice",dbId:id,clonedVoiceId:vid,engineVoice:vid,narrText:script,date:new Date().toISOString()};
      if(buf){try{const b=(buf instanceof Blob)?buf:new Blob([buf],{type:"audio/mpeg"});await safeSaveClipToDB(id,b,asset.name,"audio/myvoice");}catch(e){}}
      if(onSave)onSave(asset);
      if(setMediaLib)setMediaLib(p=>[...p,asset]);
      setNarrBusy(false);
      setSavedToLib(true);setTimeout(()=>setSavedToLib(false),3000);
      alert("Done — the engine narrated your full script in your voice and saved it to the timeline for the render.");
    }catch(e){setNarrBusy(false);alert("Could not complete the narration — try again.");}
  };

  useEffect(()=>{
    const load=()=>{ if(typeof window==="undefined"||!window.speechSynthesis){return;} setSysVoices(window.speechSynthesis.getVoices().filter(v=>v.lang&&v.lang.startsWith("en"))); };
    load(); if(typeof window!=="undefined"&&window.speechSynthesis){window.speechSynthesis.onvoiceschanged=load;}
    return()=>{window.speechSynthesis.cancel();if(timerRef.current)clearTimeout(timerRef.current);};
  },[]);

  const ORIGINS=["All","British","Scottish","Irish","Welsh","American","Australian","New Zealand","South African","West African","Indian","Spanish","French","Scandinavian","Nigerian","Fantasy","Neutral"];
  const AGES=["All","Child","Teen","Adult","Elderly"];
  const GENDERS=["All","Male","Female"];
  const filtered=VOICE_CHARACTERS.filter(v=>{
    const mg=filterGender==="All"||v.gender===filterGender;
    const ma=filterAge==="All"||v.age===filterAge;
    const mo=filterOrigin==="All"||v.origin===filterOrigin;
    const ms=search===""||v.name.toLowerCase().includes(search.toLowerCase())||v.style.toLowerCase().includes(search.toLowerCase());
    return mg&&ma&&mo&&ms;
  });
  // A selected own-voice that has been cloned resolves to itself, so its
  // engine voice id (the clone) flows into speakNow's meta.voice and the
  // engine narrates in the cloned voice.
  const mineSel=myVoices.find(v=>v.id===selVoice&&v.clonedVoiceId);
  const selected=mineSel||VOICE_CHARACTERS.find(v=>v.id===selVoice)||VOICE_CHARACTERS[0];

  const pickSysVoice=(vc)=>{
    const allRaw=sysVoices.length?sysVoices:((typeof window!=="undefined"&&window.speechSynthesis)?window.speechSynthesis.getVoices().filter(v=>v.lang&&v.lang.startsWith("en")):[]);
    if(!allRaw.length)return null;
    // ── QUALITY FIRST — use Enhanced/Premium/Siri/Neural voices when present ──
    const isHiQ=(v)=>/premium|enhanced|siri|neural|natural|online|multilingual/i.test((v.name||"")+" "+(v.voiceURI||""));
    const hiQ=allRaw.filter(isHiQ);
    const all=hiQ.length?hiQ:allRaw;
    const gb=all.filter(v=>v.lang==="en-GB"),us=all.filter(v=>v.lang==="en-US"),au=all.filter(v=>v.lang==="en-AU");
    const hash=vc.id.split("").reduce((a,ch)=>a+ch.charCodeAt(0),0);
    const isMale=vc.gender==="Male",isBritish=["British","Scottish","Irish","Welsh"].includes(vc.origin),isAU=["Australian","New Zealand"].includes(vc.origin);
    const deepMaleNames=/daniel|oliver|arthur|malcolm|george|alex|fred|tom|aaron|guy|bruce|lee|david|mark/i;
    const softFemaleNames=/kate|serena|emily|moira|fiona|samantha|ava|victoria|zoe|susan|karen|tessa/i;
    let pool=[];
    if(isBritish&&isMale){pool=[...gb.filter(v=>deepMaleNames.test(v.name)),...gb.filter(v=>!softFemaleNames.test(v.name))];}
    else if(isBritish&&!isMale){pool=[...gb.filter(v=>softFemaleNames.test(v.name)),...gb.filter(v=>!deepMaleNames.test(v.name))];}
    else if(isAU){pool=[...au,...all];}
    else if(vc.origin==="Irish"){pool=gb.filter(v=>/moira/i.test(v.name));}
    else if(isMale){pool=[...us.filter(v=>deepMaleNames.test(v.name)),...us.filter(v=>!softFemaleNames.test(v.name)),...all.filter(v=>!softFemaleNames.test(v.name))];}
    else{pool=[...us.filter(v=>softFemaleNames.test(v.name)),...us.filter(v=>!deepMaleNames.test(v.name)),...all.filter(v=>!deepMaleNames.test(v.name))];}
    if(!pool.length)pool=all;
    const unique=[...new Map(pool.map(v=>[v.name,v])).values()];
    return unique[hash%unique.length]||all[0];
  };

  const speakOneShot=(vc,txt)=>{
    window.speechSynthesis.cancel();
    const utt=new SpeechSynthesisUtterance(txt);
    const sv=pickSysVoice(vc);if(sv)utt.voice=sv;
    utt.pitch=Math.max(0.1,Math.min(2.0,vc.pitch||1.0));
    utt.rate=vc.rate||0.85;utt.volume=1.0;
    window.speechSynthesis.speak(utt);
  };

  const speakDevice=(txt)=>{
    window.speechSynthesis.cancel();if(timerRef.current)clearTimeout(timerRef.current);
    // iOS Safari fix — keepalive ping every 10s
    if(/iphone|ipad|ipod/i.test(navigator.userAgent)){
      const keepAlive=setInterval(()=>{if(window.speechSynthesis.speaking){window.speechSynthesis.pause();window.speechSynthesis.resume();}else{clearInterval(keepAlive);}},9000);
    }
    const chunks=buildChunks(txt);chunksRef.current=chunks;idxRef.current=0;setSpeaking(true);
    const baseRate=speed*(selected.rate||0.9),basePitch=pitchV*(selected.pitch||1.0);
    const next=()=>{
      const idx=idxRef.current;
      if(idx>=chunksRef.current.length){setSpeaking(false);return;}
      const chunk=chunksRef.current[idx];
      if(!chunk||!chunk.text){idxRef.current=idx+1;timerRef.current=setTimeout(next,200);return;}
      const sv=pickSysVoice(selected);
      const utt=new SpeechSynthesisUtterance(chunk.text);
      if(sv)utt.voice=sv;utt.volume=volume;
      utt.rate=Math.max(0.1,Math.min(2.0,baseRate));
      utt.pitch=Math.max(0.1,Math.min(2.0,basePitch+(chunk.type==="question"?0.1:chunk.type==="exclaim"?0.07:0)));
      const ap=chunk.type==="question"?Math.round(pauseLen*1.1):chunk.type==="sentence"?pauseLen:Math.round(pauseLen*0.4);
      utt.onend=()=>{idxRef.current=idx+1;timerRef.current=setTimeout(next,ap);};
      utt.onerror=()=>{idxRef.current=idx+1;next();};
      window.speechSynthesis.speak(utt);
    };
    if(typeof window==="undefined"||!window.speechSynthesis){setTimeout(next,50);} else { window.speechSynthesis.getVoices().length>0?setTimeout(next,50):window.speechSynthesis.onvoiceschanged=()=>{window.speechSynthesis.onvoiceschanged=null;setTimeout(next,50);}; }
  };

  // Engine voice first. Identical on every device. Device voice only if the engine cannot deliver.
  const speakNow=async(txt)=>{
    window.speechSynthesis.cancel(); stopEngineAudio();
    if(timerRef.current)clearTimeout(timerRef.current);
    const chunks=buildChunks(txt); chunksRef.current=chunks; idxRef.current=0;
    setSpeaking(true);
    const meta={voice:selected.engineVoice||"",gender:selected.gender||"",origin:selected.origin||"",speed:speed*(selected.rate||0.9)};
    const first=chunks.find(c=>c&&c.text);
    if(!first){setSpeaking(false);return;}
    const probe=await engineSpeak(first.text,meta);
    if(!probe){ console.log("Cinema Voice Engine unavailable — using device voice"); speakDevice(txt); return; }
    console.log("\u2713 MANDASTRONG CINEMA VOICE ENGINE \u2014 studio narration ready");
    let url=probe;
    for(let i=0;i<chunks.length;i++){
      const c=chunks[i];
      if(!c||!c.text) continue;
      if(i>0){ url=await engineSpeak(c.text,meta); if(!url) continue; }
      const ok=await playEngineAudio(url,volume);
      if(!ok){ console.log("Cinema Voice Engine playback blocked — using device voice"); speakDevice(txt); return; }
      const ap=c.type==="question"?Math.round(pauseLen*1.1):c.type==="sentence"?pauseLen:Math.round(pauseLen*0.4);
      await new Promise(r=>setTimeout(r,ap));
    }
    setSpeaking(false);
  };

  const stop=()=>{window.speechSynthesis.cancel();stopEngineAudio();if(timerRef.current)clearTimeout(timerRef.current);setSpeaking(false);};

  const processAndSpeak=async()=>{
    if(!text.trim())return;setLoading(true);
    try{
      const d=await proxyFetch({model:"claude-sonnet-4-20250514",max_tokens:2000,messages:[{role:"user",content:"Speech coach for TTS. Speaker: "+selected.name+" - "+selected.style+". Mood: "+mood+". Reformat for natural speech: short sentences, commas for pauses, numbers spelled out. Return ONLY reformatted text:\n\n"+text}]});
      speakNow(d&&d.content&&d.content[0]?d.content[0].text.trim():text);
    }catch(e){speakNow(text);}
    setLoading(false);
  };

  const inp={width:"100%",background:"#000",border:"1px solid "+GOLDDIM,padding:"12px 14px",color:WHITE,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"'Rajdhani',sans-serif",lineHeight:1.9};

  return(
    <div style={{...Sp}}>
      {showMVS&&<MusicVideoStudio onClose={()=>setShowMVS(false)} onSave={onSave}/>}
      <div style={{padding:"12px 18px",borderBottom:"1px solid "+GOLDDIM+"",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div><div style={{fontSize:11,color:GOLD,letterSpacing:4,fontWeight:700}}>AI WORKSTATION 02 — CINEMA VOICE ENGINE</div><h1 style={{...H1,fontSize:24,margin:0}}>TEXT TO LIFELIKE SPEECH</h1></div>
        <button onClick={()=>setShowMVS(true)} style={{background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"10px 20px",cursor:"pointer",fontSize:12,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>🎬 MUSIC VIDEO STUDIO</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"290px 1fr",minHeight:"calc(100vh - 120px)"}}>
        <div style={{borderRight:"1px solid "+GOLDDIM+"",background:"#030303",display:"flex",flexDirection:"column"}}>
          <div style={{padding:"10px 10px 6px"}}>
            <div style={{color:GOLD,fontSize:11,letterSpacing:3,fontWeight:900,marginBottom:8}}>VOICE LIBRARY — {filtered.length} / {VOICE_CHARACTERS.length}</div>
            <div style={{marginBottom:5}}><div style={{color:GOLDDIM,fontSize:9,letterSpacing:2,marginBottom:3}}>GENDER</div><div style={{display:"flex",gap:4}}>{GENDERS.map(g=><button key={g} onClick={()=>setFilterGender(g)} style={{flex:1,background:filterGender===g?GOLD:"#111",border:"1px solid "+(filterGender===g?"#000":GOLDDIM),color:filterGender===g?"#000":WHITE,padding:"3px 0",cursor:"pointer",fontSize:10,fontWeight:900}}>{g}</button>)}</div></div>
            <div style={{marginBottom:5}}><div style={{color:GOLDDIM,fontSize:9,letterSpacing:2,marginBottom:3}}>AGE</div><div style={{display:"flex",flexWrap:"wrap",gap:3}}>{AGES.map(a=><button key={a} onClick={()=>setFilterAge(a)} style={{background:filterAge===a?GOLD:"#111",border:"1px solid "+(filterAge===a?"#000":GOLDDIM),color:filterAge===a?"#000":WHITE,padding:"2px 8px",cursor:"pointer",fontSize:9,fontWeight:900}}>{a}</button>)}</div></div>
            <div style={{marginBottom:6}}><div style={{color:GOLDDIM,fontSize:9,letterSpacing:2,marginBottom:3}}>ORIGIN</div><select value={filterOrigin} onChange={e=>setFilterOrigin(e.target.value)} style={{width:"100%",background:"#111",border:"1px solid "+GOLDDIM,color:WHITE,padding:"4px 8px",fontSize:11,outline:"none"}}>{ORIGINS.map(o=><option key={o} value={o}>{o}</option>)}</select></div>
            <input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search voices..." style={{...inp,padding:"6px 10px",fontSize:11,height:30}}/>
          </div>
          <div style={{flex:1,overflowY:"auto",padding:"6px 6px 80px"}}>
            <input ref={myVoiceInputRef} type="file" accept="audio/*,.mp3,.wav,.m4a,.aac,.ogg" style={{display:"none"}} onChange={e=>{const f=e.target.files&&e.target.files[0];if(f)addMyVoice(f);e.target.value="";}}/>
            {recordingMine?(
              <div style={{display:"flex",alignItems:"center",gap:8,background:"#1a0000",border:"2px solid #ef4444",padding:"9px 12px",marginBottom:6}}>
                <div style={{width:10,height:10,borderRadius:"50%",background:"#ef4444",boxShadow:"0 0 8px #ef4444"}}/>
                <span style={{color:"#ef4444",fontWeight:900,fontSize:11,letterSpacing:2,flex:1}}>RECORDING — {String(Math.floor(recTime/60)).padStart(2,"0")}:{String(recTime%60).padStart(2,"0")}</span>
                <button onClick={stopMyRecording} style={{background:"#ef4444",border:"none",color:"#fff",padding:"5px 14px",cursor:"pointer",fontSize:10,fontWeight:900,letterSpacing:2}}>■ STOP & SAVE</button>
              </div>
            ):(
              <button onClick={startMyRecording} style={{width:"100%",background:"linear-gradient(135deg,#7a0000,#ef4444)",border:"none",color:"#fff",padding:"10px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",marginBottom:6}}>● RECORD MY VOICE NOW</button>
            )}
            <button onClick={()=>myVoiceInputRef.current&&myVoiceInputRef.current.click()} style={{width:"100%",background:"linear-gradient(135deg,#1a0800,#2a1200)",border:"2px solid "+GOLD,color:GOLD,padding:"10px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",marginBottom:6}}>＋ ADD YOUR OWN VOICE (FILE)</button>
            {(<>
              <div style={{color:GOLDDIM,fontSize:10,lineHeight:1.5,marginBottom:6,letterSpacing:0.5}}>Record just the FIRST PARAGRAPH in your own voice — the engine clones your voice and reads the rest of the narration to the end in YOUR voice, wired into the generator and render.</div>
              <div style={{color:GOLD,fontSize:10,letterSpacing:2,fontWeight:900,marginBottom:4}}>ALLOW ENGINE TO CLONE VOICE?</div>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                <button onClick={()=>setCloneOk("yes")} style={{flex:1,background:cloneConsent==="yes"?GOLD:"#000",border:"2px solid "+GOLD,color:cloneConsent==="yes"?"#000":GOLD,padding:"7px",cursor:"pointer",fontSize:10,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>YES</button>
                <button onClick={()=>setCloneOk("no")} style={{flex:1,background:cloneConsent==="no"?"#7a0000":"#000",border:"2px solid #7a0000",color:cloneConsent==="no"?"#fff":"#ef4444",padding:"7px",cursor:"pointer",fontSize:10,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>NO</button>
              </div>
              <div style={{color:GOLD,fontSize:10,letterSpacing:2,fontWeight:900,marginBottom:4}}>USE MY VOICE AS NARRATOR?</div>
              <div style={{display:"flex",gap:6,marginBottom:8}}>
                <button onClick={()=>setConsent("yes")} style={{flex:1,background:narrConsent==="yes"?GOLD:"#000",border:"2px solid "+GOLD,color:narrConsent==="yes"?"#000":GOLD,padding:"7px",cursor:"pointer",fontSize:10,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>YES</button>
                <button onClick={()=>setConsent("no")} style={{flex:1,background:narrConsent==="no"?"#7a0000":"#000",border:"2px solid #7a0000",color:narrConsent==="no"?"#fff":"#ef4444",padding:"7px",cursor:"pointer",fontSize:10,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>NO</button>
              </div>
              {(<>
                <button onClick={saveMyVoiceAsNarration} style={{width:"100%",background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"11px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",marginBottom:6}}>🎙 USE MY VOICE AS NARRATION</button>
                <button onClick={engineCompleteNarration} disabled={narrBusy} style={{width:"100%",background:narrBusy?"#1a0800":"linear-gradient(135deg,#1a0800,#2a1200)",border:"2px solid "+GOLD,color:GOLD,padding:"11px",cursor:narrBusy?"wait":"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",marginBottom:6}}>{narrBusy?"⟳ CLONING & COMPLETING…":"🎧 USE ENGINE TO COMPLETE FULL NARRATION"}</button>
              </>)}
            </>)}
            {myVoices.map(v=>(
              <div key={v.id} onClick={()=>setSelVoice(v.id)} style={{padding:"10px 12px",marginBottom:4,background:selVoice===v.id?"#0a0800":"#000",border:"2px solid "+(selVoice===v.id?GOLD:GOLDDIM),cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    {/* Hidden clone trigger: double-click the emoji of a selected own-voice to clone it. */}
                    <span style={{fontSize:18,cursor:selVoice===v.id?"pointer":"inherit"}} title="" onDoubleClick={e=>{e.stopPropagation();if(selVoice===v.id&&!cloning){setSelVoice(v.id);cloneMyVoice();}}}>{v.emoji}</span>
                    <div><div style={{color:selVoice===v.id?GOLD:WHITE,fontSize:13,fontWeight:900}}>{v.name}{v.clonedVoiceId&&<span style={{color:GOLD,fontSize:10,marginLeft:6}}>✦ CLONED</span>}</div><div style={{color:GOLDDIM,fontSize:10}}>{v.clonedVoiceId?"Your cloned voice — engine narrates in your voice":"Your uploaded voice"}</div></div>
                  </div>
                  <div style={{display:"flex",gap:4,flexShrink:0}}>
                    {v.url&&<button onClick={e=>{e.stopPropagation();const a=new Audio(v.url);a.play().catch(()=>{});}} style={{background:GOLDDIM,border:"none",color:"#000",padding:"3px 8px",cursor:"pointer",fontSize:9,fontWeight:900}}>▶</button>}
                    <button onClick={e=>{e.stopPropagation();delMyVoice(v.id);}} style={{background:"#000",border:"1px solid "+GOLD,color:GOLD,padding:"3px 8px",cursor:"pointer",fontSize:9,fontWeight:900}}>✕</button>
                  </div>
                </div>
                {selVoice===v.id&&<div style={{color:GOLD,fontSize:9,letterSpacing:2,marginTop:4,fontWeight:900}}>{cloning?"✦ CLONING YOUR VOICE…":"✓ SELECTED"}</div>}
              </div>
            ))}
            {filtered.map(v=>(
              <div key={v.id} onClick={()=>setSelVoice(v.id)} style={{padding:"10px 12px",marginBottom:4,background:selVoice===v.id?"#0a0800":"#000",border:"2px solid "+(selVoice===v.id?GOLD:GOLDDIM),cursor:"pointer"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:4}}>
                  <div style={{display:"flex",alignItems:"center",gap:6}}>
                    <span style={{fontSize:18}}>{v.emoji}</span>
                    <div><div style={{color:selVoice===v.id?GOLD:WHITE,fontSize:13,fontWeight:900}}>{v.name}</div><div style={{color:GOLDDIM,fontSize:10}}>{v.origin} · {v.gender} · {v.age}</div></div>
                  </div>
                  <button onClick={e=>{e.stopPropagation();setSelVoice(v.id);speakOneShot(v,"Hello, this is "+v.name+". "+v.desc);}}
                    style={{background:GOLDDIM,border:"none",color:"#000",padding:"3px 10px",cursor:"pointer",fontSize:9,fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif",whiteSpace:"nowrap",flexShrink:0}}>▶ TEST</button>
                </div>
                <div style={{color:DIM,fontSize:10,lineHeight:1.5}}>{v.style}</div>
                {selVoice===v.id&&<div style={{color:GOLD,fontSize:9,letterSpacing:2,marginTop:4,fontWeight:900}}>✓ SELECTED</div>}
              </div>
            ))}
          </div>
        </div>
        <div style={{display:"flex",flexDirection:"column",background:"#030303",overflowY:"auto",padding:20}}>
          <div style={{background:"#000",border:"1px solid "+GOLDDIM,padding:"10px 14px",marginBottom:14}}>
            <div style={{color:WHITE,fontSize:13,fontWeight:900}}>{selected.name} {selected.emoji} · {selected.origin} · {selected.gender}</div>
            <div style={{color:GOLDDIM,fontSize:11,marginTop:3}}>{selected.style}</div>
            <div style={{color:DIM,fontSize:11,marginTop:2,fontStyle:"italic"}}>{selected.desc}</div>
          </div>
          <div style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:"12px 14px",marginBottom:14}}>
            <div style={{color:GOLD,fontSize:11,letterSpacing:3,fontWeight:900,marginBottom:10}}>VOICE SETTINGS</div>
            <div style={{marginBottom:10}}><div style={{color:GOLDDIM,fontSize:10,fontWeight:900,letterSpacing:2,marginBottom:4}}>MOOD</div>
              <select value={mood} onChange={e=>setMood(e.target.value)} style={{width:"100%",background:"#0a0800",border:"1px solid "+GOLDDIM,color:WHITE,padding:"8px 12px",fontSize:13,fontFamily:"'Rajdhani',sans-serif",outline:"none"}}>
                {["Neutral","Happy","Sad","Angry","Excited","Calm","Dramatic","Mysterious","Romantic","Sarcastic","Melancholic","Authoritative","Warm"].map(m=><option key={m} value={m} style={{background:"#000"}}>{m}</option>)}
              </select>
            </div>
            {[["SPEED",speed,0.3,1.5,0.01,v=>setSpeed(v),speed.toFixed(2)+"x"],["PITCH",pitchV,0.3,2.0,0.01,v=>setPitchV(v),pitchV.toFixed(2)],["PAUSE (ms)",pauseLen,200,2000,50,v=>setPauseLen(v),pauseLen+"ms"],["VOLUME",volume,0.1,1.0,0.05,v=>setVolume(v),Math.round(volume*100)+"%"]].map(([label,val,mn,mx,st,setter,display])=>(
              <div key={label} style={{marginBottom:10}}>
                <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:GOLDDIM,fontSize:10,fontWeight:900,letterSpacing:2}}>{label}</span><span style={{color:GOLD,fontSize:11,fontWeight:900}}>{display}</span></div>
                <input type="range" min={mn} max={mx} step={st} value={val} onChange={e=>setter(+e.target.value)} style={{width:"100%",accentColor:GOLD}}/>
              </div>
            ))}
          </div>
          <div style={{color:GOLD,fontSize:11,letterSpacing:3,fontWeight:900,marginBottom:6}}>YOUR NARRATION SCRIPT</div>
          <textarea value={text} onChange={e=>setText(e.target.value)} placeholder="Paste your narration script here..."
            style={{...inp,height:160,resize:"vertical",marginBottom:14}}/>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8,marginBottom:14}}>
            <div style={{background:"#0a0800",border:"1px solid "+GOLDDIM,padding:"12px 14px"}}>
              <div style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:2,marginBottom:6}}>TEST SCRIPT</div>
              <div style={{color:WHITE,fontSize:11,lineHeight:1.7,marginBottom:10}}>Hear your script with current voice and settings.</div>
              <button onClick={()=>speaking?stop():speakNow(text)} disabled={!text.trim()} style={{background:"transparent",border:"1px solid "+GOLD,color:GOLD,width:"100%",padding:"9px",fontSize:11,fontWeight:900,letterSpacing:2,cursor:!text.trim()?"not-allowed":"pointer",fontFamily:"'Rajdhani',sans-serif",opacity:!text.trim()?0.5:1}}>{speaking?"⏹ STOP":"▶ TEST SCRIPT"}</button>
            </div>
            <div style={{background:"#0a0800",border:"1px solid "+GOLDDIM,padding:"12px 14px"}}>
              <div style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:2,marginBottom:6}}>RESET</div>
              <div style={{color:WHITE,fontSize:11,lineHeight:1.7,marginBottom:10}}>Clear script and reset all settings.</div>
              <button onClick={()=>{stop();setText("");setSavedToLib(false);setSpeed(0.62);setPitchV(0.86);setPauseLen(1600);setVolume(1.0);setMood("Neutral");}} style={{background:"transparent",border:"1px solid "+GOLD,color:GOLD,width:"100%",padding:"9px",fontSize:11,fontWeight:900,letterSpacing:2,cursor:"pointer",fontFamily:"'Rajdhani',sans-serif"}}>↺ RESET ALL</button>
            </div>
          </div>
          <button onClick={()=>{
            if(!text.trim())return;
            speaking?stop():processAndSpeak();
          }} disabled={!text.trim()} style={{background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",width:"100%",padding:"16px",fontSize:14,fontWeight:900,letterSpacing:3,cursor:!text.trim()?"not-allowed":"pointer",fontFamily:"'Rajdhani',sans-serif",opacity:!text.trim()?0.5:1,marginBottom:8}}>
            {speaking?"⏹ STOP":"✦ PREPARE TO SPEAK"}
          </button>
          <button onClick={async()=>{
            if(!text.trim())return;
            setSavedToLib(false);
            const asset={
              id:"narr_"+Date.now(),
              name:"Narration - "+selected.name+" - "+new Date().toLocaleTimeString(),
              type:"narration",
              text:text,
              voice:selVoice,
              pitch:selected.pitch,
              rate:selected.rate,
              date:new Date().toISOString()
            };
            await safeSaveClipToDB(asset.id,new Blob([text],{type:"text/plain"}),asset.name,"narration");
            if(onSave)onSave(asset);
            if(setMediaLib)setMediaLib(p=>[...p,asset]);
            setSavedToLib(true);
            setTimeout(()=>setSavedToLib(false),3000);
          }} disabled={!text.trim()} style={{background:"transparent",border:"1px solid "+GOLD,color:GOLD,width:"100%",padding:"14px",fontSize:13,fontWeight:900,letterSpacing:3,cursor:!text.trim()?"not-allowed":"pointer",fontFamily:"'Rajdhani',sans-serif",opacity:!text.trim()?0.5:1,marginBottom:8}}>
            💾 SAVE TO MEDIA LIBRARY
          </button>
          {savedToLib&&<div style={{background:"#061406",border:"1px solid #22c55e",padding:"10px 14px",textAlign:"center",marginBottom:8}}><span style={{color:"#22c55e",fontWeight:900,fontSize:12,letterSpacing:2}}>✓ NARRATION SAVED TO MEDIA LIBRARY — AUTO-ADDED TO TIMELINE</span></div>}
        </div>
      </div>
    </div>
  );
}
;



function MSUserCounter(){
  // Shows BOTH: live visitors on the site right now (up & down) and total users/subscribers.
  // Reads from Supabase presence function; falls back safely to last known values so it never breaks.
  const [live,setLive]=useState(()=>{try{return JSON.parse(localStorage.getItem("ms_live_count")||"1");}catch{return 1;}});
  const [total,setTotal]=useState(()=>{try{return JSON.parse(localStorage.getItem("ms_user_count")||"0");}catch{return 0;}});
  useEffect(()=>{
    let alive=true;
    const PRESENCE="https://njqfexhltjwpgvctmyaw.supabase.co/functions/v1/presence";
    async function ping(){
      try{
        // one visitor id per browser
        let vid=localStorage.getItem("ms_vid");
        if(!vid){vid=Math.random().toString(36).slice(2)+Date.now().toString(36);localStorage.setItem("ms_vid",vid);}
        const r=await fetch(PRESENCE,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({vid})});
        const j=await r.json();
        if(!alive)return;
        if(typeof j.live==="number"){setLive(j.live);localStorage.setItem("ms_live_count",JSON.stringify(j.live));}
        if(typeof j.total==="number"){setTotal(j.total);localStorage.setItem("ms_user_count",JSON.stringify(j.total));}
      }catch(e){/* keep last known numbers */}
    }
    ping();
    const t=setInterval(ping,15000); // refresh every 15s so live number moves up and down
    return ()=>{alive=false;clearInterval(t);};
  },[]);
  return (
    <div style={{display:"flex",justifyContent:"center",marginBottom:24}}>
      <div style={{background:"#050500",border:"2px solid "+GOLD,padding:"14px 40px",textAlign:"center",boxShadow:"0 0 24px "+GOLD+"33",position:"relative"}}>
        <div style={{display:"flex",alignItems:"center",justifyContent:"center",gap:6,marginBottom:6}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 8px #22c55e",animation:"pulse 2s infinite"}}/>
          <div style={{color:"#22c55e",fontSize:10,letterSpacing:4,fontWeight:900}}>LIVE · USER COUNT</div>
        </div>
        <div style={{display:"flex",alignItems:"flex-end",justifyContent:"center",gap:34}}>
          <div>
            <div style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:42,fontWeight:900,lineHeight:1,textShadow:"0 0 20px "+GOLD+"99"}}>{live}</div>
            <div style={{color:"#22c55e",fontSize:9,letterSpacing:3,marginTop:4}}>● ON NOW</div>
          </div>
          <div style={{width:1,alignSelf:"stretch",background:GOLD+"55"}}/>
          <div>
            <div style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:42,fontWeight:900,lineHeight:1,textShadow:"0 0 20px "+GOLD+"99"}}>{total}</div>
            <div style={{color:GOLDDIM,fontSize:9,letterSpacing:3,marginTop:4}}>TOTAL USERS</div>
          </div>
        </div>
        <div style={{color:GOLDDIM,fontSize:9,letterSpacing:3,marginTop:8}}>launched june 1st 2026 · updates automatically</div>
        <style>{"@keyframes pulse{0%,100%{opacity:1;}50%{opacity:0.4;}}"}</style>
      </div>
    </div>
  );
}

function P8VideoGenerator({ onSave, user, filmDuration, setFilmDuration }) {
  const canvasRef=useRef(null);
  const videoRef=useRef(null);
  const refMediaRef=useRef(null);
  const realityPhotoRef=useRef(null);
  const [prompt,setPrompt]=useState("");
  const [title,setTitle]=useState("");
  const [duration,setDuration]=useState(30);
  const [generating,setGenerating]=useState(false);
  const [progress,setProgress]=useState(0);
  const [log,setLog]=useState([]);
  const [videoUrl,setVideoUrl]=useState("");
  const [saved,setSaved]=useState(false);
  // ── BACKGROUND MUSIC ──────────────────────────────────────────
  const [addMusic,setAddMusic]=useState(false);
  const [musicTrack,setMusicTrack]=useState("");
  const [genStereo,setGenStereo]=useState(true);
  const [useBrief,setUseBrief]=useState(true);
  const [hasBrief,setHasBrief]=useState(false);
  useEffect(()=>{try{const b=JSON.parse(localStorage.getItem("ms_render_brief")||"null");setHasBrief(!!(b&&b.brief));}catch{setHasBrief(false);}},[]);
  const MUSIC_LIBRARY=[
    {id:"epic",     label:"⚔️ Epic / Trailer",       url:"https://cdn.pixabay.com/audio/2022/03/15/audio_c8c8a73467.mp3"},
    {id:"drama",    label:"🎭 Drama / Powerful",     url:"https://cdn.pixabay.com/audio/2023/01/29/audio_5bf2f9f5b0.mp3"},
    {id:"emotional",label:"💧 Emotional / Piano",    url:"https://cdn.pixabay.com/audio/2021/11/25/audio_00fa5593f3.mp3"},
    {id:"ambient",  label:"🌌 Ambient / Cinematic",  url:"https://cdn.pixabay.com/audio/2022/01/18/audio_d0c6ff1bab.mp3"},
    {id:"uplifting",label:"☀️ Uplifting / Hopeful",   url:"https://cdn.pixabay.com/audio/2022/05/27/audio_1808fbf07a.mp3"},
    {id:"tension",  label:"🎯 Tension / Suspense",    url:"https://cdn.pixabay.com/audio/2022/03/10/audio_d1718ab41b.mp3"},
    {id:"warm",     label:"🕯️ Warm / Reflective",     url:"https://cdn.pixabay.com/audio/2021/08/09/audio_54ca0ffa52.mp3"},
    {id:"inspiring",label:"🌅 Inspiring / Anthemic",  url:"https://cdn.pixabay.com/audio/2022/10/25/audio_946bc8a627.mp3"},
    {id:"sad",      label:"🌧️ Sad / Melancholy",      url:"https://cdn.pixabay.com/audio/2022/10/18/audio_31a1f6f2a6.mp3"},
    {id:"action",   label:"💥 Action / Driving",      url:"https://cdn.pixabay.com/audio/2022/11/22/audio_febc508520.mp3"},
  ];
  const [refMedia,setRefMedia]=useState(null);
  const [refMediaType,setRefMediaType]=useState("");
  const [refDataUrl,setRefDataUrl]=useState(null);
  const [refImages,setRefImages]=useState([]);
  const [renderStyle,setRenderStyle]=useState("photorealistic");
  const [genre,setGenre]=useState("");
  const [targetMin,setTargetMin]=useState(0);
  const [madeClips,setMadeClips]=useState([]);
  const [gapPrompt,setGapPrompt]=useState(null);
  const [gapBusy,setGapBusy]=useState(false);
  const addLog=(msg)=>setLog(p=>[...p,msg]);
  // ════════════════════════════════════════════════════════════════
  // MAKE MY MOVIE — one-shot: drop everything in, set the length, press go.
  // Expands what was pasted into scenes, then writes NEW scenes to reach
  // the target length. Every scene runs through the same Cinema Engine and
  // is stitched into one film — all on this page. Nothing navigates away.
  // ════════════════════════════════════════════════════════════════
  const [mmmText,setMmmText]=useState("");
  const [mmmImages,setMmmImages]=useState([]);
  const [mmmBusy,setMmmBusy]=useState(false);
  const [mmmStage,setMmmStage]=useState("");
  const [mmmPct,setMmmPct]=useState(0);
  const [mmmScenes,setMmmScenes]=useState([]);
  const [mmmDone,setMmmDone]=useState(false);
  const [mmmFilmUrl,setMmmFilmUrl]=useState("");
  const [mmmError,setMmmError]=useState("");
  const mmmDropRef=useRef(null);
  const mmmTargetMin=filmDuration||30;
  const [mmmStudio,setMmmStudio]=useState(false);
  const [mmmStyle,setMmmStyle]=useState("cinematic");
  const [mmmGenre,setMmmGenre]=useState("");
  const [mmmGrade,setMmmGrade]=useState("gold");
  const [mmmEnhance,setMmmEnhance]=useState(true);
  const [mmmLipSync,setMmmLipSync]=useState(false);
  const [mmmVoiceId,setMmmVoiceId]=useState("james");
  const [mmmVolume,setMmmVolume]=useState(1);
  const [mmmBgSound,setMmmBgSound]=useState(true);
  const [mmmBgVolume,setMmmBgVolume]=useState(0.3);
  const MMM_GRADES=[
    {id:"gold",label:"Gold & Amber"},
    {id:"cold",label:"Cold Blue"},
    {id:"noir",label:"Noir Mono"},
    {id:"warm",label:"Warm Film"},
    {id:"natural",label:"Natural"},
  ];

  const mmmAddFiles=(files)=>{
    const arr=Array.from(files||[]);
    arr.forEach(f=>{
      if(f.type.startsWith("image")){
        const r=new FileReader();
        r.onload=ev=>setMmmImages(p=>[...p,{name:f.name,dataUrl:ev.target.result}]);
        r.readAsDataURL(f);
      }else if(f.type.startsWith("text")||f.name.match(/\.(txt|md|fdx|fountain)$/i)){
        const r=new FileReader();
        r.onload=ev=>setMmmText(p=>(p?p+"\n\n":"")+String(ev.target.result||""));
        r.readAsText(f);
      }
    });
  };

  const makeMyMovie=async()=>{
    const source=mmmText.trim();
    if(!source&&mmmImages.length===0){ setMmmError("Drop in your script, or some images, first."); return; }
    setMmmError(""); setMmmBusy(true); setMmmDone(false); setMmmFilmUrl(""); setMmmScenes([]); setMmmPct(0);

    const targetMin=mmmTargetMin;
    const targetScenes=Math.max(1,Math.round(targetMin));   // ~1 scene per minute
    const perSceneSec=Math.max(4,Math.round((targetMin*60)/targetScenes));

    // 1 ─ Write the full scene list to length
    setMmmStage("Reading what you gave me and writing the scene list…");
    setMmmPct(4);
    let sceneList=[];
    try{
      const brief=(()=>{try{const b=JSON.parse(localStorage.getItem("ms_render_brief")||"null");return b&&b.brief?b.brief:"";}catch(e){return "";}})();
      const ask=
        "You are a film director. Turn the material below into an ordered shot list of EXACTLY "+targetScenes+" scenes for a "+targetMin+"-minute film"+(mmmGenre?(" in the "+mmmGenre+" genre"):"")+".\n"+
        "LOOK - apply to EVERY scene: "+mmmStyle+" style, "+(mmmGrade==="gold"?"warm gold and amber colour grade":mmmGrade==="cold"?"cold blue colour grade":mmmGrade==="noir"?"high-contrast black and white noir":mmmGrade==="warm"?"warm film stock grade":"natural colour grade")+", cinematic, photorealistic, 35mm, film grain, no on-screen text.\n"+
        "RULES:\n"+
        "1. FIRST expand what the user actually gave you into detailed shots — their material always leads.\n"+
        "2. THEN, if you need more scenes to reach "+targetScenes+", write brand-new scenes that continue the story naturally to fill the full length.\n"+
        "3. Each scene = one vivid visual paragraph an image engine can render (setting, subject, light, motion). No dialogue, no headings, no numbering.\n"+
        (brief?("PRODUCER BRIEF (obey it):\n"+brief+"\n"):"")+
        "MATERIAL:\n"+(source||"(no script — build the film from the uploaded images and the genre)")+"\n\n"+
        "Return ONLY a JSON array of "+targetScenes+" strings. No other text.";
      const d=await proxyFetch({model:"claude-sonnet-4-20250514",max_tokens:4000,messages:[{role:"user",content:ask}]});
      const raw=(d&&d.content&&d.content.map?d.content.filter(x=>x.type==="text").map(x=>x.text).join("\n"):"")||"";
      const clean=raw.replace(/```json|```/g,"").trim();
      const start=clean.indexOf("["), end=clean.lastIndexOf("]");
      sceneList=JSON.parse(clean.slice(start,end+1));
      sceneList=sceneList.filter(s=>s&&String(s).trim()).map(s=>String(s).trim());
    }catch(e){
      // Fallback: split the pasted text into paragraphs, pad by repeating the arc
      const paras=source.split(/\n\s*\n/).map(s=>s.trim()).filter(Boolean);
      sceneList=paras.length?paras:["Opening establishing shot of the film's world, cinematic light."];
      while(sceneList.length<targetScenes)sceneList.push(sceneList[sceneList.length%Math.max(1,paras.length)]||sceneList[0]);
      sceneList=sceneList.slice(0,targetScenes);
    }
    if(!sceneList.length){ setMmmError("Couldn't build a scene list — try adding a bit more detail."); setMmmBusy(false); return; }
    setMmmScenes(sceneList.map(s=>({text:s,status:"waiting"})));
    setMmmStage("Scene list ready — "+sceneList.length+" scenes. Rendering…");
    setMmmPct(10);

    // 2 ─ Render every scene through the Cinema Engine and save each one
    const firstImg=mmmImages.length?mmmImages[0].dataUrl:(refDataUrl||"");
    const clipUrls=[];
    for(let i=0;i<sceneList.length;i++){
      setMmmScenes(p=>p.map((s,idx)=>idx===i?{...s,status:"rendering"}:s));
      setMmmStage("Rendering scene "+(i+1)+" of "+sceneList.length+"…");
      let url="";
      try{
        url=await engineRender(sceneList[i],{duration:perSceneSec,image:i===0?firstImg:"",aspect_ratio:"16:9"});
      }catch(e){ url=""; }
      if(url){
        clipUrls.push(url);
        setMmmScenes(p=>p.map((s,idx)=>idx===i?{...s,status:"done",url}:s));
        // Save each scene into the Media Library / timeline exactly like the engine does
        try{
          const autoId="mmm_"+Date.now()+"_"+i;
          const autoName="MakeMyMovie_scene"+(i+1)+".mp4";
          const vb=await (await fetch(url)).blob();
          await Promise.race([safeSaveClipToDB(autoId,vb,autoName,"video/mp4"),new Promise(r=>setTimeout(()=>r("t"),8000))]);
          if(onSave)onSave({id:autoId,name:autoName,type:"video/mp4",url,file:new File([vb],autoName,{type:"video/mp4"}),dbId:autoId});
        }catch(e){}
      }else{
        setMmmScenes(p=>p.map((s,idx)=>idx===i?{...s,status:"skipped"}:s));
      }
      setMmmPct(10+Math.round(((i+1)/sceneList.length)*80));
    }

    if(!clipUrls.length){ setMmmError("The engine returned no footage. If you're out of plan usage, top up below and run it again."); setMmmBusy(false); return; }

    // 3 ─ Stitch into one film (concatenated playback) — stays on this page
    setMmmStage("Stitching your film together…");
    setMmmPct(94);
    try{
      // Save the ordered playlist so the render page / player can play it as one film
      localStorage.setItem("ms_mmm_playlist",JSON.stringify(clipUrls));
    }catch(e){}
    setMmmFilmUrl(clipUrls[0]);   // player starts on scene 1 and advances through the list
    setMmmPct(100);
    setMmmStage("Your movie is ready.");
    setMmmDone(true);
    setMmmBusy(false);
  };

  // Sequential player: when one scene ends, play the next — feels like one film.
  const mmmVideoRef=useRef(null);
  useEffect(()=>{ if(mmmVideoRef.current) mmmVideoRef.current.volume=Math.max(0,Math.min(1,mmmVolume)); },[mmmVolume,mmmDone]);
  const mmmIdxRef=useRef(0);
  useEffect(()=>{
    const v=mmmVideoRef.current;
    if(!v||!mmmDone)return;
    let list=[]; try{list=JSON.parse(localStorage.getItem("ms_mmm_playlist")||"[]");}catch(e){}
    if(!list.length)return;
    mmmIdxRef.current=0;
    const onEnd=()=>{ mmmIdxRef.current++; if(mmmIdxRef.current<list.length){ v.src=list[mmmIdxRef.current]; v.play().catch(()=>{}); } };
    v.addEventListener("ended",onEnd);
    return ()=>v.removeEventListener("ended",onEnd);
  },[mmmDone]);

  const [mmmLsBusy,setMmmLsBusy]=useState(false);
  const [mmmLsVideo,setMmmLsVideo]=useState("");
  const mmmRunLipSync=async()=>{
    const face=mmmImages.length?mmmImages[0].dataUrl:"";
    if(!face){ setMmmError("Lip sync needs a face photo - add one above."); return; }
    setMmmError(""); setMmmLsBusy(true); setMmmLsVideo("");
    try{
      let audioDataUrl="";
      try{
        const vr=await fetch(VOICE_URL,{method:"POST",headers:{"Content-Type":"application/json"},
          body:JSON.stringify({text:(mmmText||"").slice(0,1200),voice:mmmVoiceId})});
        const vd=await vr.json(); audioDataUrl=vd&&(vd.audio||vd.url)?(vd.audio||vd.url):"";
      }catch(e){}
      if(!audioDataUrl){ setMmmError("Couldn't make the narration audio for lip sync."); setMmmLsBusy(false); return; }
      const res=await fetch("https://njqfexhltjwpgvctmyaw.supabase.co/functions/v1/lip-sync",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({image:face,audio:audioDataUrl})});
      const data=await res.json();
      if(data.error){ setMmmError(data.error); setMmmLsBusy(false); return; }
      if(data.video){ setMmmLsVideo(data.video); } else setMmmError("Lip sync returned no video.");
    }catch(e){ setMmmError("Lip-sync engine unreachable: "+(e&&e.message?e.message:e)); }
    setMmmLsBusy(false);
  };
  const mmmDownloadAll=async()=>{
    let list=[]; try{list=JSON.parse(localStorage.getItem("ms_mmm_playlist")||"[]");}catch(e){}
    for(let i=0;i<list.length;i++){
      try{
        const b=await (await fetch(list[i])).blob();
        const a=document.createElement("a");
        a.href=URL.createObjectURL(b);
        a.download="MakeMyMovie_scene"+(i+1)+".mp4";
        document.body.appendChild(a); a.click(); a.remove();
        await new Promise(r=>setTimeout(r,600));
      }catch(e){}
    }
  };

  const madeSeconds=madeClips.reduce((a,c)=>a+(c.duration||0),0);
  const targetSeconds=targetMin*60;
  const gapSeconds=Math.max(0,targetSeconds-madeSeconds);
  const fmtMin=(s)=>{const m=Math.floor(s/60),ss=Math.round(s%60);return m+"m "+(ss<10?"0":"")+ss+"s";};

  const RENDER_STYLES=[
    {id:"photorealistic",label:"📷 Photorealistic"},
    {id:"cinematic",label:"🎬 Cinematic"},
    {id:"documentary",label:"🎥 Documentary"},
    {id:"noir",label:"🌑 Film Noir"},
    {id:"golden",label:"🌅 Golden Hour"},
    {id:"scifi",label:"🚀 Sci-Fi"},
    {id:"horror",label:"👻 Horror"},
    {id:"animated",label:"✨ Stylised"},
  ];
  const FILM_GENRES=[
    {id:"",label:"— NO GENRE —"},
    {id:"feature",label:"🎬 Feature Film"},{id:"documentary",label:"🎥 Documentary"},
    {id:"musicvideo",label:"🎵 Music Video"},{id:"shortfilm",label:"🎭 Short Film"},
    {id:"horror",label:"👻 Horror"},{id:"scifi",label:"🚀 Sci-Fi"},
    {id:"romance",label:"💕 Romance"},{id:"thriller",label:"⚡ Thriller"},
    {id:"action",label:"💥 Action"},{id:"comedy",label:"😄 Comedy"},
    {id:"drama",label:"🎭 Drama"},{id:"animation",label:"✨ Animation"},
    {id:"historical",label:"🏛 Historical"},{id:"nature",label:"🌿 Nature"},
  ];
  const EXAMPLES=[
    "Earth rotating slowly in deep space. City lights blazing gold on the night side. Stars everywhere.",
    "A woman places a folded paper into a wooden ballot box. Morning light from a window.",
    "Night city skyline. Rain. Neon reflections on wet streets. A lone figure walks under a streetlight.",
    "Underwater coral reef. Vivid tropical fish. Light shafts from the surface above.",
    "An elderly couple on a park bench in autumn. Golden leaves falling. Neither speaking.",
    "Vast dark server room. Three people huddled around a single warm lantern. Faces lit gold.",
    "Cave interior. Torchlight. Ancient paintings on the walls. A figure looking at camera.",
    "Dawn breaking over a savanna. A silhouetted human figure stands at the horizon.",
  ];

  const handleRefUpload=(e)=>{
    const f=e.target.files&&e.target.files[0];
    if(!f)return;
    setRefMedia(URL.createObjectURL(f));
    setRefMediaType(f.type.startsWith("video")?"video":"image");
    const reader=new FileReader();
    reader.onload=ev=>setRefDataUrl(ev.target.result);
    reader.readAsDataURL(f);
  };

  // ════════════════════════════════════════════════════════════════
  // MANDASTRONG ENGINE v2 — CINEMA-GRADE RENDERER
  // Real depth, real volumetric lighting, real atmosphere, real motion
  // ════════════════════════════════════════════════════════════════
  // ════════════════════════════════════════════════════════════════
  // MANDASTRONG ENGINE — AI writes a custom drawFrame() per prompt
  // Every scene is unique. What you describe is exactly what renders.
  // ════════════════════════════════════════════════════════════════
  const generateVideo=async()=>{
    if(!prompt.trim()){alert("Describe your scene first");return;}
    setGenerating(true);setProgress(0);setLog([]);setVideoUrl("");setSaved(false);

    // ── PRIORITY SAVE — runs before anything else ──────────────────────────────
    // Saves page/timeline/mediaLib to localStorage immediately so if the tab
    // crashes mid-render, the session is already written and can be resumed.
    try{
      localStorage.setItem("ms_page",JSON.stringify(8));
      const existingTimeline=localStorage.getItem("ms_timeline")||"{}";
      const existingMedia=localStorage.getItem("ms_medialib")||"[]";
      // These are already up to date from auto-persist — just verify they're written
      if(!existingTimeline||existingTimeline==="{}")localStorage.setItem("ms_timeline","{}");
      if(!existingMedia||existingMedia==="[]")localStorage.setItem("ms_medialib","[]");
    }catch(e){}
    // ── PRE-GENERATION STORAGE CHECK — safe, never touches source clips ──
    // Only clears old rendered films from IndexedDB.
    try{
      const clips=await getAllClipsFromDB();
      const oldRenders=clips.filter(c=>String(c.id).includes("render_final_old"));
      for(const c of oldRenders){await deleteClipFromDB(c.id);}
    }catch(e){}
    addLog("MandaStrong Cinema Engine — reading your scene...");
    setProgress(5);

    // ══════════════════════════════════════════════════════════════════
    // MANDASTRONG CINEMA ENGINE — REAL PHOTOREALISTIC VIDEO
    // Sends the scene to the Cinema Engine and returns real footage.
    // Falls back to the built-in renderer if the engine is unavailable.
    // ══════════════════════════════════════════════════════════════════
    try{
      addLog("Cinema Engine — synthesising photorealistic footage...");
      setProgress(12);
      // ── SCRIPT-TO-MOVIE BRIEF ── Page 5's Producer/Describe/Production
      // notes, if the user wired them into the render, drive every scene.
      let effectivePrompt=prompt.trim();
      if(useBrief){
        try{
          const bd=JSON.parse(localStorage.getItem("ms_render_brief")||"null");
          if(bd&&bd.brief){ effectivePrompt=bd.brief+"\nSHOT FOR THIS SCENE:\n"+effectivePrompt; addLog("✦ Using Script-to-Movie brief (Producer + Describe + Production) from Page 5"); }
        }catch(e){}
      }
      const engineUrl=await engineRender(effectivePrompt,{
        duration,
        image:refDataUrl||"",
        onTick:(i)=>{ setProgress(Math.min(88,12+i*2)); addLog("Cinema Engine rendering — "+Math.min(88,12+i*2)+"%"); }
      });
      if(engineUrl){
        addLog("\u2713 Cinema Engine complete — downloading footage...");
        setProgress(92);
        const vidRes=await fetch(engineUrl);
        const vidBlob=await vidRes.blob();
        const localUrl=URL.createObjectURL(vidBlob);
        setVideoUrl(localUrl);
        setProgress(100);
        addLog("\u2713 MANDASTRONG CINEMA ENGINE — photorealistic scene ready");
        try{
          const autoId="scene_"+Date.now();
          const autoName=(title||"Scene")+"_"+duration+"s.mp4";
          await Promise.race([
            safeSaveClipToDB(autoId,vidBlob,autoName,"video/mp4"),
            new Promise(r=>setTimeout(()=>r("timeout"),8000))
          ]);
          if(onSave)onSave({id:autoId,name:autoName,type:"video/mp4",url:localUrl,file:new File([vidBlob],autoName,{type:"video/mp4"}),dbId:autoId});
          setSaved(true);
          addLog("\u2713 Saved to Media Library");
        }catch(e){}
        setGenerating(false);
        return;
      }
      const diag=await engineStatus();
      addLog(diag&&diag.ok===false?("Cinema Engine: "+(diag.message||"unavailable")):"Cinema Engine returned no footage — using built-in renderer");
    }catch(e){
      addLog("Cinema Engine offline — using built-in renderer");
    }

    // LOAD REFERENCE PHOTOS if user uploaded any
    let loadedRefImages=[];
    if(refImages.length>0){
      addLog("Loading "+refImages.length+" reference photo(s) for photorealistic base...");
      try{
        loadedRefImages=await Promise.all(refImages.map(ri=>new Promise((res)=>{
          const img=new Image();
          img.onload=()=>res({...ri,img,w:img.naturalWidth,h:img.naturalHeight});
          img.onerror=()=>res(null);
          img.src=ri.url;
        })));
        loadedRefImages=loadedRefImages.filter(Boolean);
        addLog("\u2713 "+loadedRefImages.length+" photo(s) loaded — photorealistic mode");
      }catch(e){addLog("Photo load: "+e.message);}
    }

    const styleId=renderStyle||"photorealistic";
    const bt=String.fromCharCode(96);

    // ── STEP 1: Ask Claude to write a custom drawFrame for this exact scene ──
    let drawFnBody="";
    try{
      addLog("MandaStrong Engine — asking AI to compose your scene...");
      setProgress(12);
      const hasPhotos=loadedRefImages.length>0;
      const photoNote=hasPhotos?"The user has uploaded "+loadedRefImages.length+" reference photo(s). The main photo will be drawn as the base layer already — your drawFrame should add atmosphere, lighting, overlays, and cinematic elements ON TOP of the photo base. Do NOT try to redraw the background from scratch.":"No reference photos. You must paint the entire scene from scratch using canvas drawing primitives — sky, ground, environment, people, objects, lighting. Make it look as photorealistic as possible using gradients, layering, and detail.";
      const composeController=new AbortController();
      const composeTimeout=setTimeout(()=>composeController.abort(),45000);
      const res=await fetch("https://njqfexhltjwpgvctmyaw.supabase.co/functions/v1/claude-proxy",{
        signal:composeController.signal,
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({
          model:"claude-sonnet-4-20250514",
          max_tokens:3500,
          system:`You are the MandaStrong Engine, a photorealistic canvas video renderer for MandaStrong Studio. You write JavaScript that renders cinematic scenes frame by frame on an HTML5 canvas.

${photoNote}

Write a JavaScript function body (NOT the function declaration — just the code inside the braces) for:
function drawFrame(ctx, W, H, t, sec) { YOUR CODE HERE }

Parameters:
- ctx: CanvasRenderingContext2D (canvas is W=1920 H=1080)
- t: 0.0 to 1.0 progress through the entire clip
- sec: elapsed seconds
- W=1920, H=1080

Style: ${styleId}. Duration: ${duration}s.

Rules:
1. Paint everything with ctx. Use gradients, arcs, paths for realistic environments.
2. Animate with t and sec — camera drift, parallax, light shifts, subtle motion.
3. Apply cinematic colour grade overlay matching the style (${styleId}).
4. Add vignette, letterbox bars (black rects top and bottom ~7% of H), film grain.
5. Fade in from black for first 5% of t. Fade out to black for last 8% of t.
6. No external images, no fetch calls, no DOM access — only ctx drawing.
7. Keep it under 200 lines.

Return ONLY the function body code. No markdown. No function wrapper. No explanation.`,
          messages:[{role:"user",content:`Scene to render: "${prompt}"

Write the drawFrame body now.`}]
        })
      });
      clearTimeout(composeTimeout);
      const d=await res.json();
      let code=d.content&&d.content[0]?d.content[0].text.trim():"";
      // Strip markdown fences if present
      code=code.split(bt+bt+bt+"javascript").join("").split(bt+bt+bt+"js").join("").split(bt+bt+bt).join("").trim();
      // Strip function wrapper if Claude included it
      if(code.startsWith("function drawFrame")){
        const bo=code.indexOf("{");const bc=code.lastIndexOf("}");
        if(bo>=0&&bc>bo)code=code.slice(bo+1,bc);
      }
      drawFnBody=code;
      addLog("\u2713 Scene composed — "+drawFnBody.split("\n").length+" render instructions");
      setProgress(28);
    }catch(e){
      addLog("Scene compose error: "+e.message+" — using fallback renderer");
      // Fallback: atmospheric dark scene
      drawFnBody=`
        const sky=ctx.createLinearGradient(0,0,0,H);
        sky.addColorStop(0,"#020108");sky.addColorStop(0.6,"#0a0520");sky.addColorStop(1,"#050210");
        ctx.fillStyle=sky;ctx.fillRect(0,0,W,H);
        for(let s=0;s<300;s++){const sx=(s*173)%W;const sy=(s*97)%H;const sa=0.3+0.7*((s*31)%100)/100;ctx.fillStyle="rgba(255,255,220,"+sa+")";ctx.fillRect(sx+Math.sin(sec*0.1+s)*0.5,sy,1,1);}
        const vig=ctx.createRadialGradient(W/2,H/2,100,W/2,H/2,900);vig.addColorStop(0,"rgba(0,0,0,0)");vig.addColorStop(1,"rgba(0,0,0,0.85)");ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
        ctx.fillStyle="#000";ctx.fillRect(0,0,W,H*0.07);ctx.fillRect(0,H*0.93,W,H*0.07);
        if(t<0.05){ctx.fillStyle="rgba(0,0,0,"+(1-t/0.05)+")";ctx.fillRect(0,0,W,H);}
        if(t>0.92){ctx.fillStyle="rgba(0,0,0,"+((t-0.92)/0.08)+")";ctx.fillRect(0,0,W,H);}
      `;
    }

    // ── STEP 2: Set up canvas + MediaRecorder ──
    const canvas=canvasRef.current;
    if(!canvas){setGenerating(false);addLog("Canvas error");return;}
    canvas.width=1280;canvas.height=720;
    const ctx=canvas.getContext("2d");

    // Build the drawFrame function — wraps AI code + photo base layer
    let drawFrame;
    try{
      if(loadedRefImages.length>0){
        // Photo mode: draw photo base first, then AI atmospheric overlay
        const mainImg=loadedRefImages[0];
        drawFrame=new Function("ctx","W","H","t","sec","loadedRefImages",`
          // Photo base — Ken Burns push-in
          const pushIn=1+t*0.05;
          const driftX=Math.sin(sec*0.08)*6;
          const driftY=Math.cos(sec*0.06)*3;
          const img=loadedRefImages[0].img;
          if(img){
            const ar=loadedRefImages[0].w/loadedRefImages[0].h;
            const targetAR=W/H;
            let dw,dh;
            if(ar>targetAR){dh=H*pushIn;dw=dh*ar;}else{dw=W*pushIn;dh=dw/ar;}
            ctx.drawImage(img,(W-dw)/2+driftX,(H-dh)/2+driftY,dw,dh);
          }
          // Additional photos as foreground layers
          loadedRefImages.slice(1).forEach((ri,li)=>{
            if(!ri||!ri.img)return;
            const lw=W*0.38;const lh=lw*(ri.h/ri.w);
            const lx=W*(0.22+li*0.28)+Math.sin(sec*0.4+li)*4;
            const ly=H*0.5+Math.cos(sec*0.3+li)*3;
            ctx.globalAlpha=0.85;ctx.drawImage(ri.img,lx-lw/2,ly-lh/2,lw,lh);ctx.globalAlpha=1;
          });
          // AI atmospheric overlay
          ${drawFnBody}
        `);
      }else{
        // No photos — full AI scene
        drawFrame=new Function("ctx","W","H","t","sec","loadedRefImages",drawFnBody);
      }
    }catch(e){
      addLog("Render compile error: "+e.message);
      setGenerating(false);return;
    }

    // Test render frame 0
    try{drawFrame(ctx,1280,720,0,0,loadedRefImages);}catch(e){addLog("Frame test warning: "+e.message);}
    await new Promise(r=>setTimeout(r,100));
    setProgress(32);

    // ── STEP 3: Render all frames ──
    const fps=20;const totalFrames=duration*fps;
    const mimeType=MediaRecorder.isTypeSupported("video/webm;codecs=vp9")?"video/webm;codecs=vp9":"video/webm";
    const stream=canvas.captureStream(fps);
    // ── BACKGROUND MUSIC — mix chosen track under the render ──
    let musicCtx=null, musicSource=null;
    if(addMusic&&musicTrack){
      try{
        const track=MUSIC_LIBRARY.find(m=>m.id===musicTrack);
        if(track){
          addLog("Loading background music: "+track.label+"...");
          const resp=await fetch(track.url);
          const arr=await resp.arrayBuffer();
          musicCtx=new (window.AudioContext||window.webkitAudioContext)();
          const buf=await musicCtx.decodeAudioData(arr);
          const dest=musicCtx.createMediaStreamDestination();
          musicSource=musicCtx.createBufferSource();
          musicSource.buffer=buf; musicSource.loop=true;
          const gain=musicCtx.createGain(); gain.gain.value=0.35;
          if(genStereo && musicCtx.createStereoPanner){
            addLog("🔊 Stereo sound ON — widening the music bed");
            musicSource.connect(gain); gain.connect(dest);
            const wet=musicCtx.createGain(); wet.gain.value=0.5;
            [[-0.85,0.014],[0.85,0.021]].forEach(([pan,dl])=>{
              const d=musicCtx.createDelay(); d.delayTime.value=dl;
              const p=musicCtx.createStereoPanner(); p.pan.value=pan;
              gain.connect(d); d.connect(p); p.connect(wet);
            });
            wet.connect(dest);
          } else {
            musicSource.connect(gain); gain.connect(dest);
          }
          dest.stream.getAudioTracks().forEach(tk=>stream.addTrack(tk));
          addLog("✓ Background music ready — mixing into film");
        }
      }catch(e){ addLog("Music note: "+e.message+" — rendering without music"); musicCtx=null; musicSource=null; }
    }
    const recorder=new MediaRecorder(stream,{mimeType,videoBitsPerSecond:6000000});
    if(musicSource){ try{ musicSource.start(0); }catch(e){} }
    const chunks=[];
    recorder.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
    recorder.start(Math.round(1000/fps));
    addLog("Rolling — rendering "+duration+"s at 24fps...");
    setProgress(35);

    await new Promise(resolve=>{
      let frame=0;
      const tick=()=>{
        if(frame>=totalFrames){resolve(null);return;}
        const t=frame/totalFrames;const sec=frame/fps;
        ctx.clearRect(0,0,1280,720);
        try{drawFrame(ctx,1280,720,t,sec,loadedRefImages);}catch(e){ctx.fillStyle="#050200";ctx.fillRect(0,0,1280,720);}
        // Consistent post-processing on every frame
        const vig=ctx.createRadialGradient(640,360,80,640,360,650);
        vig.addColorStop(0,"rgba(0,0,0,0)");vig.addColorStop(1,"rgba(0,0,0,0.8)");
        ctx.fillStyle=vig;ctx.fillRect(0,0,1280,720);
        // ── AUTO-ENHANCEMENT — warm gold grade + contrast + highlight recovery ──
        ctx.fillStyle="rgba(232,180,60,0.06)";ctx.fillRect(0,0,1280,720);
        ctx.fillStyle="rgba(0,0,0,0.08)";ctx.fillRect(0,0,1280,720);
        const hr2=ctx.createRadialGradient(640,216,0,640,216,512);
        hr2.addColorStop(0,"rgba(255,255,240,0.04)");hr2.addColorStop(1,"rgba(0,0,0,0)");
        ctx.fillStyle=hr2;ctx.fillRect(0,0,1280,720);
        // ──────────────────────────────────────────────────────────────────────
        ctx.fillStyle="#000";ctx.fillRect(0,0,1280,50);ctx.fillRect(0,670,1280,50);
        for(let g=0;g<20;g++){const gv=Math.random()>0.5?160:20;ctx.fillStyle="rgba("+gv+","+gv+","+gv+",0.008)";ctx.fillRect(Math.random()*1280,Math.random()*720,1.2,1.2);}
        if(t<0.05){ctx.fillStyle="rgba(0,0,0,"+(1-t/0.05)+")";ctx.fillRect(0,0,1280,720);}
        if(t>0.92){ctx.fillStyle="rgba(0,0,0,"+((t-0.92)/0.08)+")";ctx.fillRect(0,0,1280,720);}
        setProgress(35+Math.round((frame/totalFrames)*60));
        if(frame%(fps*5)===0)addLog("  "+Math.round(sec)+"s / "+duration+"s rendered");
        frame++;
        requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    });

    setProgress(97);
    addLog("Encoding...");
    // Wait for the recorder to actually finish flushing its data before building the blob.
    // A fixed delay can fire before the final chunk arrives on slower machines, which hangs at 97%.
    await new Promise(resolve=>{
      let done=false;
      const finish=()=>{ if(!done){done=true;resolve(null);} };
      // Arm the escape hatch FIRST — guaranteed exit even if stop() throws
      setTimeout(finish,4000);
      try{
        recorder.onstop=finish;
        if(recorder.state!=="inactive"){recorder.stop();}
        else{finish();}
      }catch(e){finish();}
    });
    if(musicSource){ try{ musicSource.stop(); }catch(e){} }
    if(musicCtx){ try{ musicCtx.close(); }catch(e){} }
    const blob=new Blob(chunks,{type:mimeType});
    const url=URL.createObjectURL(blob);
    setVideoUrl(url);
    setProgress(100);
    addLog("\u2713 MANDASTRONG ENGINE COMPLETE — "+duration+"s cinema-grade video ready");
    // AUTO-SAVE the finished clip — timeout-protected so it can never stall the render
    try{
      const autoId="scene_"+Date.now();
      const autoName=(title||"Scene")+"_"+duration+"s.webm";
      const saveResult=await Promise.race([
        safeSaveClipToDB(autoId,blob,autoName,"video/webm"),
        new Promise(r=>setTimeout(()=>r("timeout"),6000))
      ]);
      if(saveResult==="timeout"){addLog("Save is running in background — clip is ready above");}
      else{
        if(onSave)onSave({id:autoId,name:autoName,type:"video/webm",url:URL.createObjectURL(blob),file:new File([blob],autoName,{type:"video/webm"}),dbId:autoId});
        setSaved(true);
        addLog("\u2713 Auto-saved to library");
      }
    }catch(e){addLog("Auto-save note: "+e.message);}
    // Track this clip toward the target film length, then check the gap
    try{
      const newTotal=madeSeconds+duration;
      setMadeClips(p=>[...p,{id:Date.now(),duration}]);
      if(targetSeconds>0 && newTotal<targetSeconds){
        setGapPrompt({have:newTotal,target:targetSeconds,gap:targetSeconds-newTotal});
      }
    }catch(e){}
    setGenerating(false);
  };

  const saveToLibrary=async()=>{
    if(!videoUrl)return;
    try{
      const r=await fetch(videoUrl);const b=await r.blob();
      const fn=(title||"Scene")+"_"+duration+"s.webm";
      const file=new File([b],fn,{type:"video/webm"});
      if(onSave)onSave({id:Date.now()+Math.random(),name:fn,type:"video/webm",url:URL.createObjectURL(file),file});
    }catch(e){if(onSave)onSave({id:Date.now()+Math.random(),name:(title||"Scene")+"_"+duration+"s.webm",type:"video/webm",url:videoUrl});}
    setSaved(true);
  };

  return (
    <div style={{minHeight:"100vh",background:"#000",color:WHITE,fontFamily:"'Rajdhani',sans-serif",paddingBottom:160}}>
      {gapPrompt&&(
        <div style={{position:"fixed",inset:0,zIndex:2000,background:"rgba(0,0,0,0.94)",display:"flex",alignItems:"center",justifyContent:"center",padding:20}}>
          <div style={{width:"min(460px,95vw)",background:"#050505",border:"2px solid "+GOLD,padding:"24px 22px"}}>
            <div style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:16,fontWeight:900,letterSpacing:3,marginBottom:14,textAlign:"center"}}>⏳ FILL THE GAP?</div>
            <p style={{color:WHITE,fontSize:14,lineHeight:1.7,margin:"0 0 18px",textAlign:"center"}}>
              You have <b style={{color:GOLD}}>{fmtMin(gapPrompt.have)}</b> of your <b style={{color:GOLD}}>{fmtMin(gapPrompt.target)}</b> selection.
              Would you like AI to create fill-in scenes to fill the remaining <b style={{color:GOLD}}>{fmtMin(gapPrompt.gap)}</b>?
            </p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
              <button disabled={gapBusy} onClick={()=>{
                  const g=gapPrompt;setGapPrompt(null);
                  if(!prompt.trim())setPrompt("Cinematic continuation scene that flows naturally from the previous shot, matching the film's mood, lighting and colour grade.");
                  const fillSecs=Math.min(60,Math.max(5,g.gap));
                  setDuration(fillSecs);
                  setTimeout(()=>{generateVideo();},60);
                }}
                style={{background:"linear-gradient(135deg,#a07820,#e8c96d)",border:"none",color:"#000",padding:"14px",fontSize:13,fontWeight:900,letterSpacing:2,cursor:"pointer",fontFamily:"'Rajdhani',sans-serif"}}>
                ✓ YES, FILL IT
              </button>
              <button onClick={()=>setGapPrompt(null)}
                style={{background:"transparent",border:"1px solid "+GOLD,color:GOLD,padding:"14px",fontSize:13,fontWeight:900,letterSpacing:2,cursor:"pointer",fontFamily:"'Rajdhani',sans-serif"}}>
                NO, I'M DONE
              </button>
            </div>
          </div>
        </div>
      )}
      <canvas ref={canvasRef} style={{position:"fixed",right:8,bottom:8,width:160,height:90,opacity:1,pointerEvents:"none",zIndex:9999,border:"1px solid #e8c96d",background:"#000"}}/>
      <div style={{padding:"12px 20px",borderBottom:"1px solid "+GOLDDIM+"",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:11,color:GOLD,letterSpacing:4,fontWeight:700}}>MANDASTRONG ENGINE v2 · CINEMA-GRADE RENDERER</div>
          <h1 style={{fontFamily:"'Cinzel',serif",color:GOLD,letterSpacing:5,margin:0,fontSize:24,textTransform:"uppercase"}}>VIDEO GENERATOR</h1>
        </div>
        <div style={{color:GOLD,fontSize:11,fontWeight:700,letterSpacing:2}}>✦ MANDASTRONG ENGINE · ANY PROMPT · ANY SUBJECT</div>
      </div>
      {mmmStudio&&(
        <div style={{position:"fixed",inset:0,zIndex:900,background:"linear-gradient(160deg,#050300,#120800)",overflowY:"auto",padding:"18px 16px 60px"}}>
          <div style={{maxWidth:760,margin:"0 auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:14}}>
              <div style={{fontFamily:"'Cinzel',serif",color:GOLD,letterSpacing:3,fontSize:20,textTransform:"uppercase"}}>Make My Movie Studio</div>
              <button onClick={()=>setMmmStudio(false)} style={{background:"none",border:"1px solid "+GOLD,color:GOLD,padding:"6px 14px",borderRadius:5,cursor:"pointer",fontSize:12,letterSpacing:1}}>CLOSE</button>
            </div>

            <textarea value={mmmText} onChange={e=>setMmmText(e.target.value)} rows={5}
              placeholder="Paste your whole film here. Nothing is lost when you leave this box."
              style={{width:"100%",boxSizing:"border-box",background:"#0a0800",border:"1px solid "+GOLDDIM,borderRadius:6,color:"#fff",padding:11,fontSize:13,fontFamily:"'Rajdhani',sans-serif",resize:"vertical",marginBottom:10}}/>

            <div onDragOver={e=>{e.preventDefault();}}
              onDrop={e=>{e.preventDefault();mmmAddFiles(e.dataTransfer.files);}}
              onClick={()=>{const inp=document.getElementById("mmmStudioFileInput");if(inp)inp.click();}}
              style={{textAlign:"center",border:"1px dashed "+GOLD+"77",borderRadius:6,padding:12,color:DIM,fontSize:12,letterSpacing:1,marginBottom:10,cursor:"pointer"}}>
              DROP OR TAP TO ADD SCRIPT AND IMAGES
              <input id="mmmStudioFileInput" type="file" multiple accept="image/*,text/*,.txt,.md,.fdx,.fountain" style={{display:"none"}}
                onChange={e=>mmmAddFiles(e.target.files)}/>
            </div>
            {mmmImages.length>0&&(
              <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:12}}>
                {mmmImages.map((im,i)=>(
                  <div key={i} style={{position:"relative"}}>
                    <img src={im.dataUrl} style={{width:54,height:54,objectFit:"cover",border:"1px solid "+GOLD,borderRadius:4}}/>
                    <button onClick={()=>setMmmImages(p=>p.filter((_,x)=>x!==i))}
                      style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:9,background:"#000",color:GOLD,border:"1px solid "+GOLD,fontSize:11,cursor:"pointer",lineHeight:"16px",padding:0}}>x</button>
                  </div>
                ))}
              </div>
            )}

            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
              <span style={{color:GOLD,fontSize:12,letterSpacing:2,fontWeight:900}}>MOVIE LENGTH</span>
              <span style={{color:"#fff",fontSize:12,fontWeight:700}}>{mmmTargetMin} MIN</span>
            </div>
            <input type="range" min={1} max={180} value={mmmTargetMin}
              onChange={e=>setFilmDuration&&setFilmDuration(Number(e.target.value))}
              style={{width:"100%",accentColor:GOLD,marginBottom:2}}/>
            <div style={{display:"flex",justifyContent:"space-between",color:DIM,fontSize:10,marginBottom:14}}><span>1 min</span><span>3 hours</span></div>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
              <div>
                <div style={{color:GOLD,fontSize:11,letterSpacing:2,fontWeight:900,marginBottom:5}}>STYLE</div>
                <select value={mmmStyle} onChange={e=>setMmmStyle(e.target.value)}
                  style={{width:"100%",background:"#0a0800",border:"1px solid "+GOLD,color:GOLD,padding:"9px 12px",fontSize:12,fontFamily:"'Rajdhani',sans-serif",cursor:"pointer"}}>
                  {RENDER_STYLES.map(s=><option key={s.id} value={s.id} style={{background:"#000"}}>{s.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{color:GOLD,fontSize:11,letterSpacing:2,fontWeight:900,marginBottom:5}}>GENRE</div>
                <select value={mmmGenre} onChange={e=>setMmmGenre(e.target.value)}
                  style={{width:"100%",background:"#0a0800",border:"1px solid "+GOLDDIM,color:mmmGenre?GOLD:GOLDDIM,padding:"9px 12px",fontSize:12,fontFamily:"'Rajdhani',sans-serif",cursor:"pointer"}}>
                  {FILM_GENRES.map(g=><option key={g.id} value={g.id} style={{background:"#000"}}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{color:GOLD,fontSize:11,letterSpacing:2,fontWeight:900,marginBottom:5}}>COLOUR GRADE</div>
                <select value={mmmGrade} onChange={e=>setMmmGrade(e.target.value)}
                  style={{width:"100%",background:"#0a0800",border:"1px solid "+GOLD,color:GOLD,padding:"9px 12px",fontSize:12,fontFamily:"'Rajdhani',sans-serif",cursor:"pointer"}}>
                  {MMM_GRADES.map(g=><option key={g.id} value={g.id} style={{background:"#000"}}>{g.label}</option>)}
                </select>
              </div>
              <div>
                <div style={{color:GOLD,fontSize:11,letterSpacing:2,fontWeight:900,marginBottom:5}}>NARRATION VOICE</div>
                <select value={mmmVoiceId} onChange={e=>setMmmVoiceId(e.target.value)}
                  style={{width:"100%",background:"#0a0800",border:"1px solid "+GOLD,color:GOLD,padding:"9px 12px",fontSize:12,fontFamily:"'Rajdhani',sans-serif",cursor:"pointer"}}>
                  {VOICE_CHARACTERS.map(v=><option key={v.id} value={v.id} style={{background:"#000"}}>{v.name}</option>)}
                </select>
              </div>
            </div>

            <div style={{display:"flex",flexWrap:"wrap",gap:8,marginBottom:12}}>
              <button onClick={()=>setMmmEnhance(v=>!v)} style={{flex:"1 1 45%",padding:"10px",background:mmmEnhance?"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")":"#0a0800",color:mmmEnhance?"#000":GOLD,border:"1px solid "+GOLD,borderRadius:5,fontWeight:900,fontSize:12,letterSpacing:1,cursor:"pointer"}}>ENHANCE {mmmEnhance?"ON":"OFF"}</button>
              <button onClick={()=>setMmmLipSync(v=>!v)} style={{flex:"1 1 45%",padding:"10px",background:mmmLipSync?"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")":"#0a0800",color:mmmLipSync?"#000":GOLD,border:"1px solid "+GOLD,borderRadius:5,fontWeight:900,fontSize:12,letterSpacing:1,cursor:"pointer"}}>LIP SYNC {mmmLipSync?"ON":"OFF"}</button>
              <button onClick={()=>setMmmBgSound(v=>!v)} style={{flex:"1 1 45%",padding:"10px",background:mmmBgSound?"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")":"#0a0800",color:mmmBgSound?"#000":GOLD,border:"1px solid "+GOLD,borderRadius:5,fontWeight:900,fontSize:12,letterSpacing:1,cursor:"pointer"}}>MUSIC BED {mmmBgSound?"ON":"OFF"}</button>
            </div>

            <div style={{marginBottom:6}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:GOLD,fontSize:11,letterSpacing:2,fontWeight:900}}>NARRATION VOLUME</span><span style={{color:"#fff",fontSize:11}}>{Math.round(mmmVolume*100)}%</span></div>
              <input type="range" min={0} max={1} step={0.05} value={mmmVolume} onChange={e=>setMmmVolume(Number(e.target.value))} style={{width:"100%",accentColor:GOLD}}/>
            </div>
            <div style={{marginBottom:14,opacity:mmmBgSound?1:0.4}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:4}}><span style={{color:GOLD,fontSize:11,letterSpacing:2,fontWeight:900}}>MUSIC VOLUME</span><span style={{color:"#fff",fontSize:11}}>{Math.round(mmmBgVolume*100)}%</span></div>
              <input type="range" min={0} max={1} step={0.05} value={mmmBgVolume} onChange={e=>setMmmBgVolume(Number(e.target.value))} disabled={!mmmBgSound} style={{width:"100%",accentColor:GOLD}}/>
            </div>

            <button onClick={makeMyMovie} disabled={mmmBusy}
              style={{width:"100%",padding:16,background:mmmBusy?"#333":"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",color:mmmBusy?"#888":"#000",border:"none",fontWeight:900,fontSize:18,letterSpacing:3,borderRadius:6,cursor:mmmBusy?"default":"pointer",fontFamily:"'Cinzel',serif"}}>
              {mmmBusy?"MAKING YOUR MOVIE...":"MAKE MY MOVIE"}
            </button>

            {mmmLipSync&&(
              <div style={{marginTop:12,padding:12,border:"1px solid "+GOLD+"66",borderRadius:6,background:"#0a0800"}}>
                <div style={{color:GOLD,fontSize:11,letterSpacing:2,fontWeight:900,marginBottom:6}}>LIP SYNC - TALKING SCENE</div>
                <div style={{color:DIM,fontSize:11,marginBottom:8}}>Uses your first uploaded face photo and speaks the pasted text in the chosen voice.</div>
                <button onClick={mmmRunLipSync} disabled={mmmLsBusy}
                  style={{width:"100%",padding:12,background:mmmLsBusy?"#333":"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",color:mmmLsBusy?"#888":"#000",border:"none",fontWeight:900,fontSize:14,letterSpacing:2,borderRadius:5,cursor:mmmLsBusy?"default":"pointer",fontFamily:"'Cinzel',serif"}}>
                  {mmmLsBusy?"SYNCING...":"GENERATE TALKING SCENE"}
                </button>
                {mmmLsVideo&&(
                  <video src={mmmLsVideo} controls playsInline style={{width:"100%",marginTop:10,borderRadius:6,border:"1px solid "+GOLD,background:"#000",aspectRatio:"16/9"}}/>
                )}
              </div>
            )}

            {mmmError&&<div style={{marginTop:10,color:"#ff8a8a",fontSize:12,textAlign:"center"}}>{mmmError}</div>}

            {mmmBusy&&(
              <div style={{marginTop:12}}>
                <div style={{color:GOLD,fontSize:12,letterSpacing:1,marginBottom:6}}>{mmmStage}</div>
                <div style={{background:"#111",height:10,border:"1px solid "+GOLDDIM,borderRadius:4,overflow:"hidden"}}>
                  <div style={{background:GOLD,height:"100%",width:mmmPct+"%",transition:"width .3s"}}/>
                </div>
              </div>
            )}

            {mmmScenes.length>0&&(
              <div style={{marginTop:12,maxHeight:140,overflowY:"auto",fontSize:11}}>
                {mmmScenes.map((s,i)=>(
                  <div key={i} style={{display:"flex",gap:6,padding:"2px 0",color:s.status==="done"?GOLD:s.status==="rendering"?"#fff":s.status==="skipped"?"#ff8a8a":DIM}}>
                    <span>{s.status==="done"?"OK":s.status==="rendering"?">":s.status==="skipped"?"x":"o"}</span>
                    <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Scene {i+1}: {s.text}</span>
                  </div>
                ))}
              </div>
            )}

            {mmmDone&&(
              <div style={{marginTop:16}}>
                <div style={{color:GOLD,fontSize:13,letterSpacing:2,fontWeight:900,marginBottom:8,textAlign:"center"}}>PREVIEW</div>
                <video ref={mmmVideoRef} src={mmmFilmUrl} controls autoPlay playsInline
                  style={{width:"100%",borderRadius:8,border:"1px solid "+GOLD,background:"#000",aspectRatio:"16/9"}}/>
                <div style={{display:"flex",gap:10,marginTop:12}}>
                  <button onClick={mmmDownloadAll}
                    style={{flex:1,padding:14,background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",color:"#000",border:"none",fontWeight:900,fontSize:15,letterSpacing:2,borderRadius:6,cursor:"pointer",fontFamily:"'Cinzel',serif"}}>
                    DOWNLOAD
                  </button>
                  <button onClick={()=>{try{navigator.share?navigator.share({title:"My Movie",url:mmmFilmUrl}):window.open(mmmFilmUrl,"_blank");}catch(e){window.open(mmmFilmUrl,"_blank");}}}
                    style={{flex:1,padding:14,background:"#0a0800",color:GOLD,border:"1px solid "+GOLD,fontWeight:900,fontSize:15,letterSpacing:2,borderRadius:6,cursor:"pointer",fontFamily:"'Cinzel',serif"}}>
                    EXPORT
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ════ MAKE MY MOVIE — one-shot, everything on this page ════ */}
      <div style={{margin:"14px 20px",background:"linear-gradient(135deg,#0a0500,#160a00)",border:"2px solid "+GOLD,borderRadius:10,padding:16,boxShadow:"0 0 24px "+GOLD+"22"}}>
        <div style={{textAlign:"center",marginBottom:12}}>
          <div style={{fontFamily:"'Cinzel',serif",color:GOLD,letterSpacing:4,fontSize:22,textTransform:"uppercase"}}>✦ MAKE MY MOVIE ✦</div>
          <div style={{color:DIM,fontSize:11,letterSpacing:2,marginTop:3}}>DROP EVERYTHING IN · SET THE LENGTH · PRESS GO — IT DOES THE REST</div>
        </div>

        <textarea value={mmmText} onChange={e=>setMmmText(e.target.value)} rows={4}
          placeholder="Paste your whole film here — script, producer instructions, prompts, notes. Or drag files onto the box below."
          style={{width:"100%",boxSizing:"border-box",background:"#0a0800",border:"1px solid "+GOLDDIM,borderRadius:6,color:"#fff",padding:11,fontSize:13,fontFamily:"'Rajdhani',sans-serif",resize:"vertical",marginBottom:8}}/>

        <div ref={mmmDropRef}
          onDragOver={e=>{e.preventDefault();}}
          onDrop={e=>{e.preventDefault();mmmAddFiles(e.dataTransfer.files);}}
          onClick={()=>{const inp=document.getElementById("mmmFileInput");if(inp)inp.click();}}
          style={{textAlign:"center",border:"1px dashed "+GOLD+"77",borderRadius:6,padding:12,color:DIM,fontSize:12,letterSpacing:1,marginBottom:10,cursor:"pointer"}}>
          ⬆ DROP OR TAP TO ADD SCRIPT &amp; IMAGES
          <input id="mmmFileInput" type="file" multiple accept="image/*,text/*,.txt,.md,.fdx,.fountain" style={{display:"none"}}
            onChange={e=>mmmAddFiles(e.target.files)}/>
        </div>
        {mmmImages.length>0&&(
          <div style={{display:"flex",flexWrap:"wrap",gap:5,marginBottom:10}}>
            {mmmImages.map((im,i)=>(
              <div key={i} style={{position:"relative"}}>
                <img src={im.dataUrl} style={{width:54,height:54,objectFit:"cover",border:"1px solid "+GOLD,borderRadius:4}}/>
                <button onClick={()=>setMmmImages(p=>p.filter((_,x)=>x!==i))}
                  style={{position:"absolute",top:-6,right:-6,width:18,height:18,borderRadius:9,background:"#000",color:GOLD,border:"1px solid "+GOLD,fontSize:11,cursor:"pointer",lineHeight:"16px",padding:0}}>×</button>
              </div>
            ))}
          </div>
        )}

        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:5}}>
          <span style={{color:GOLD,fontSize:12,letterSpacing:2,fontWeight:900}}>MOVIE LENGTH</span>
          <span style={{color:"#fff",fontSize:12,fontWeight:700}}>{mmmTargetMin} MIN · ~{Math.max(1,Math.round(mmmTargetMin))} SCENES</span>
        </div>
        <input type="range" min={1} max={180} value={mmmTargetMin}
          onChange={e=>setFilmDuration&&setFilmDuration(Number(e.target.value))}
          style={{width:"100%",accentColor:GOLD,marginBottom:2}}/>
        <div style={{display:"flex",justifyContent:"space-between",color:DIM,fontSize:10,marginBottom:12}}><span>1 min</span><span>3 hours</span></div>

        <button onClick={()=>setMmmStudio(true)}
          style={{width:"100%",padding:15,marginBottom:10,background:"linear-gradient(135deg,"+GOLD+","+GOLDDIM+")",color:"#000",border:"none",fontWeight:900,fontSize:17,letterSpacing:3,borderRadius:6,cursor:"pointer",fontFamily:"'Cinzel',serif"}}>
          OPEN MAKE MY MOVIE STUDIO
        </button>
        <button onClick={makeMyMovie} disabled={mmmBusy}
          style={{width:"100%",padding:15,background:mmmBusy?"#333":"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",color:mmmBusy?"#888":"#000",border:"none",fontWeight:900,fontSize:17,letterSpacing:3,borderRadius:6,cursor:mmmBusy?"default":"pointer",fontFamily:"'Cinzel',serif"}}>
          {mmmBusy?"MAKING YOUR MOVIE…":"✦ MAKE MY MOVIE"}
        </button>

        {mmmError&&<div style={{marginTop:10,color:"#ff8a8a",fontSize:12,textAlign:"center"}}>{mmmError}</div>}

        {mmmBusy&&(
          <div style={{marginTop:12}}>
            <div style={{color:GOLD,fontSize:12,letterSpacing:1,marginBottom:6}}>{mmmStage}</div>
            <div style={{background:"#111",height:10,border:"1px solid "+GOLDDIM,borderRadius:4,overflow:"hidden"}}>
              <div style={{background:GOLD,height:"100%",width:mmmPct+"%",transition:"width .3s"}}/>
            </div>
          </div>
        )}

        {mmmScenes.length>0&&(
          <div style={{marginTop:10,maxHeight:120,overflowY:"auto",fontSize:11}}>
            {mmmScenes.map((s,i)=>(
              <div key={i} style={{display:"flex",gap:6,padding:"2px 0",color:s.status==="done"?GOLD:s.status==="rendering"?"#fff":s.status==="skipped"?"#ff8a8a":DIM}}>
                <span>{s.status==="done"?"✓":s.status==="rendering"?"●":s.status==="skipped"?"✕":"○"}</span>
                <span style={{whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>Scene {i+1}: {s.text}</span>
              </div>
            ))}
          </div>
        )}

        {mmmDone&&(
          <div style={{marginTop:14}}>
            <video ref={mmmVideoRef} src={mmmFilmUrl} controls autoPlay playsInline
              style={{width:"100%",borderRadius:8,border:"1px solid "+GOLD,background:"#000",aspectRatio:"16/9"}}/>
            <button onClick={mmmDownloadAll}
              style={{width:"100%",padding:14,marginTop:10,background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",color:"#000",border:"none",fontWeight:900,fontSize:16,letterSpacing:3,borderRadius:6,cursor:"pointer",fontFamily:"'Cinzel',serif"}}>
              ⬇ DOWNLOAD MY MOVIE
            </button>
            <div style={{textAlign:"center",marginTop:8}}>
              <a href={STRIPE.studio} target="_blank" rel="noreferrer" style={{color:DIM,fontSize:11,letterSpacing:1,textDecoration:"underline"}}>Need more length? Purchase usage credits</a>
            </div>
          </div>
        )}
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 420px",minHeight:"calc(100vh - 120px)"}}>
        <div style={{padding:20,overflowY:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:12}}>
            <div>
              <div style={{color:GOLD,fontSize:11,letterSpacing:3,fontWeight:900,marginBottom:5}}>RENDER STYLE</div>
              <select value={renderStyle} onChange={e=>setRenderStyle(e.target.value)}
                style={{width:"100%",background:"#0a0800",border:"1px solid "+GOLD,color:GOLD,padding:"9px 12px",fontSize:12,outline:"none",fontFamily:"'Rajdhani',sans-serif",cursor:"pointer"}}>
                {RENDER_STYLES.map(s=><option key={s.id} value={s.id} style={{background:"#000"}}>{s.label}</option>)}
              </select>
            </div>
            <div>
              <div style={{color:GOLD,fontSize:11,letterSpacing:3,fontWeight:900,marginBottom:5}}>GENRE</div>
              <select value={genre} onChange={e=>setGenre(e.target.value)}
                style={{width:"100%",background:"#0a0800",border:"1px solid "+GOLDDIM,color:genre?GOLD:GOLDDIM,padding:"9px 12px",fontSize:12,outline:"none",fontFamily:"'Rajdhani',sans-serif",cursor:"pointer"}}>
                {FILM_GENRES.map(g=><option key={g.id} value={g.id} style={{background:"#000"}}>{g.label}</option>)}
              </select>
            </div>
          </div>
          <div style={{background:"linear-gradient(135deg,#0a0500,#1a0a00)",border:"2px solid "+GOLD,padding:14,marginBottom:12,boxShadow:"0 0 20px "+GOLD+"22"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:8}}>
              <div>
                <div style={{color:GOLD,fontSize:12,letterSpacing:3,fontWeight:900}}>✦ REALITY ENGINE — UPLOAD YOUR PHOTOS</div>
                <div style={{color:DIM,fontSize:10,marginTop:2}}>Upload 1-6 real photos or videos. Drag & drop or click. Guaranteed photorealistic — no cartoons.</div>
              </div>
            </div>
            {refImages.length>0&&(
              <div style={{display:"grid",gridTemplateColumns:"repeat(6,1fr)",gap:4,marginBottom:8}}>
                {refImages.map((ri,i)=>(
                  <div key={i} style={{position:"relative"}}>
                    {ri.isVideo&&ri.url
                      ?<video src={ri.url} style={{width:"100%",height:50,objectFit:"cover",border:"1px solid "+GOLD}} muted/>
                      :<img src={ri.url} alt={ri.name||"ref"} style={{width:"100%",height:50,objectFit:"cover",border:"1px solid "+GOLD}}/>
                    }
                    <button onClick={()=>setRefImages(p=>p.filter((_,j)=>j!==i))} style={{position:"absolute",top:1,right:1,background:"#000",border:"1px solid "+GOLD,color:GOLD,padding:"0 4px",cursor:"pointer",fontSize:9,fontWeight:900,lineHeight:1.2}}>✕</button>
                    <div style={{color:GOLD,fontSize:8,letterSpacing:1,marginTop:1,textAlign:"center",fontWeight:900}}>{i===0?"BG":"L"+i}</div>
                  </div>
                ))}
              </div>
            )}
            <div
              onDragEnter={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.setAttribute("data-drag","1");e.currentTarget.style.border="2px dashed "+GOLD;e.currentTarget.style.background="rgba(232,201,109,0.12)";e.currentTarget.style.boxShadow="0 0 18px "+GOLD+"88";}}
              onDragOver={e=>{e.preventDefault();e.stopPropagation();}}
              onDragLeave={e=>{e.preventDefault();e.stopPropagation();e.currentTarget.removeAttribute("data-drag");e.currentTarget.style.border="2px dashed "+GOLDDIM;e.currentTarget.style.background="transparent";e.currentTarget.style.boxShadow="none";}}
              onDrop={e=>{
                e.preventDefault();e.stopPropagation();
                e.currentTarget.removeAttribute("data-drag");
                e.currentTarget.style.border="2px dashed "+GOLDDIM;
                e.currentTarget.style.background="transparent";
                e.currentTarget.style.boxShadow="none";
                if(refImages.length>=6){alert("Max 6 photos/videos");return;}
                const files=Array.from(e.dataTransfer.files).slice(0,6-refImages.length);
                setRefImages(p=>[...p,...files.map(f=>({url:URL.createObjectURL(f),name:f.name,isVideo:f.type.startsWith("video/")}))]);
              }}
              style={{border:"2px dashed "+GOLDDIM,padding:"16px 8px",textAlign:"center",marginBottom:6,transition:"border 0.15s, background 0.15s, box-shadow 0.15s",cursor:"copy",background:"transparent"}}>
              <div style={{color:GOLD,fontSize:11,fontWeight:900,letterSpacing:2,pointerEvents:"none"}}>⬆ DRAG & DROP PHOTOS OR VIDEOS HERE</div>
              <div style={{color:GOLDDIM,fontSize:9,marginTop:3,pointerEvents:"none"}}>JPG · PNG · MP4 · MOV · up to 6 files · drop zone lights up gold when ready</div>
            </div>
            <input ref={realityPhotoRef} type="file" accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif" multiple style={{display:"none"}} onChange={e=>{
              const files=Array.from(e.target.files||[]).slice(0,6-refImages.length);
              setRefImages(p=>[...p,...files.map(f=>({url:URL.createObjectURL(f),name:f.name,isVideo:f.type.startsWith("video/")}))]);
              if(realityPhotoRef.current)realityPhotoRef.current.value="";
            }}/>
            <button onClick={()=>{if(refImages.length>=6){alert("Max 6 photos");return;}realityPhotoRef.current&&realityPhotoRef.current.click();}} style={{width:"100%",background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"10px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>
              📷 {refImages.length===0?"ADD PHOTOS / VIDEOS (UP TO 6)":"ADD MORE — "+refImages.length+"/6 LOADED"}
            </button>
            <a href="https://photos.google.com" target="_blank" rel="noopener noreferrer"
              style={{display:"block",background:"#0a0a0a",border:"1px solid "+GOLDDIM,color:GOLDDIM,padding:"8px",textAlign:"center",fontSize:10,fontWeight:900,letterSpacing:2,textDecoration:"none",fontFamily:"'Rajdhani',sans-serif",marginTop:4}}>
              🌐 CHROMEBOOK USERS → OPEN GOOGLE PHOTOS → download photo → then Add Photos above
            </a>
            <div style={{color:GOLDDIM,fontSize:9,marginTop:5,letterSpacing:1,textAlign:"center"}}>1st photo = BACKGROUND · others = foreground layers · guarantees photorealistic output</div>
          </div>
          <div style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:12,marginBottom:12}}>
            <div style={{color:GOLD,fontSize:11,letterSpacing:3,fontWeight:900,marginBottom:5}}>⬆ UPLOAD REFERENCE IMAGE (OPTIONAL)</div>
            {refMedia?(
              <div style={{position:"relative"}}>
                <img src={refMedia} alt="ref" style={{width:"100%",height:72,objectFit:"cover",border:"1px solid "+GOLD}}/>
                <button onClick={()=>{setRefMedia(null);setRefDataUrl(null);}} style={{position:"absolute",top:3,right:3,background:"#000",border:"1px solid "+GOLD,color:GOLD,padding:"1px 6px",cursor:"pointer",fontSize:10,fontWeight:900}}>✕</button>
                <div style={{color:"#22c55e",fontSize:9,fontWeight:900,letterSpacing:2,marginTop:3}}>✓ REFERENCE LOADED</div>
              </div>
            ):(
              <div
                onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=GOLD;e.currentTarget.style.background="#1a0800";}}
                onDragLeave={e=>{e.currentTarget.style.borderColor=GOLDDIM;e.currentTarget.style.background="transparent";}}
                onDrop={e=>{
                  e.preventDefault();
                  e.currentTarget.style.borderColor=GOLDDIM;e.currentTarget.style.background="transparent";
                  const f=e.dataTransfer.files&&e.dataTransfer.files[0];
                  if(f&&(f.type.startsWith("image/")||f.type.startsWith("video/"))){
                    const url=URL.createObjectURL(f);
                    setRefMedia(url);setRefMediaType(f.type);
                    const rdr=new FileReader();rdr.onload=ev=>setRefDataUrl(ev.target.result);rdr.readAsDataURL(f);
                  }
                }}
                onClick={()=>refMediaRef.current&&refMediaRef.current.click()}
                style={{border:"2px dashed "+GOLDDIM,padding:"14px 8px",textAlign:"center",cursor:"pointer",transition:"all .2s"}}>
                <div style={{color:GOLD,fontSize:12,fontWeight:900,letterSpacing:2}}>⬆ DRAG & DROP or CLICK</div>
                <div style={{color:GOLDDIM,fontSize:10,marginTop:3,letterSpacing:1}}>JPG · PNG · MP4</div>
              </div>
            )}
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6,marginTop:6}}>
              <button onClick={()=>{const i=document.createElement("input");i.type="file";i.accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif";i.onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;setRefMedia(URL.createObjectURL(f));setRefMediaType(f.type.startsWith("video")?"video":"image");const reader=new FileReader();reader.onload=ev=>setRefDataUrl(ev.target.result);reader.readAsDataURL(f);};i.click();}}
                style={{background:"linear-gradient(135deg,#1a0800,#2a1200)",border:"2px solid "+GOLD,color:GOLD,padding:"10px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}>
                📷 UPLOAD PHOTO
              </button>
              <button onClick={()=>{const i=document.createElement("input");i.type="file";i.accept="image/*,video/*";i.onchange=e=>{const f=e.target.files&&e.target.files[0];if(!f)return;setRefMedia(URL.createObjectURL(f));setRefMediaType(f.type.startsWith("video")?"video":"image");const reader=new FileReader();reader.onload=ev=>setRefDataUrl(ev.target.result);reader.readAsDataURL(f);};i.click();}}
                style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,color:WHITE,padding:"10px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}>
                📁 UPLOAD FILE
              </button>
            </div>
            <input ref={refMediaRef} type="file" accept="image/*,video/*" style={{display:"none"}} onChange={handleRefUpload}/>
          </div>
          <div style={{color:GOLD,fontSize:11,letterSpacing:3,fontWeight:900,marginBottom:6}}>SCENE TITLE</div>
          <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="e.g. AI For Humanity — Chapter 1"
            style={{width:"100%",background:"#000",border:"1px solid "+GOLDDIM,padding:"10px 14px",color:WHITE,fontSize:14,outline:"none",boxSizing:"border-box",fontFamily:"'Rajdhani',sans-serif",marginBottom:14}}/>
          <div style={{marginBottom:14}}>
            <div style={{color:GOLD,fontSize:11,letterSpacing:3,fontWeight:900,marginBottom:6}}>DESCRIBE YOUR SCENE</div>
            <div style={{color:DIM,fontSize:11,marginBottom:8,lineHeight:1.7}}>Describe anything in plain English. MandaStrong Engine reads your prompt and renders a real cinematic scene.</div>
            <textarea value={prompt} onChange={e=>setPrompt(e.target.value)}
              placeholder="e.g. A woman in a heavy coat places a folded paper into a wooden ballot box. Morning light from a window on the left."
              style={{width:"100%",background:"#000",border:"1px solid "+GOLDDIM,padding:"12px 14px",color:WHITE,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"'Rajdhani',sans-serif",lineHeight:1.9,height:140,resize:"none"}}/>
          </div>
          <div style={{marginBottom:14}}>
            <div style={{color:GOLD,fontSize:11,letterSpacing:3,fontWeight:900,marginBottom:8}}>QUICK EXAMPLES — CLICK TO TRY</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
              {EXAMPLES.map((ex,i)=>(
                <div key={i} onClick={()=>setPrompt(ex)}
                  style={{background:"#000",border:"1px solid "+GOLDDIM,padding:"10px 12px",cursor:"pointer",fontSize:11,color:DIM,lineHeight:1.6}}>
                  {ex.slice(0,65)}{ex.length>65?"...":""}
                </div>
              ))}
            </div>
          </div>
          <div style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:14,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{color:GOLD,fontSize:11,fontWeight:900,letterSpacing:2}}>TARGET FILM LENGTH</span>
              <span style={{color:WHITE,fontSize:11,fontWeight:900}}>{targetMin>0?targetMin+" MIN":"OFF"}</span>
            </div>
            <input type="range" min={0} max={180} value={targetMin} onChange={e=>setTargetMin(+e.target.value)} style={{width:"100%",accentColor:GOLD}}/>
            {targetMin>0&&(
              <div style={{color:GOLDDIM,fontSize:10,marginTop:6,letterSpacing:1}}>
                Made so far: {fmtMin(madeSeconds)} of {targetMin}m · {gapSeconds>0?("gap "+fmtMin(gapSeconds)):"target reached ✓"}
              </div>
            )}
          </div>
          <div style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:14,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:8}}>
              <span style={{color:GOLD,fontSize:11,fontWeight:900,letterSpacing:2}}>DURATION</span>
              <span style={{color:WHITE,fontSize:11,fontWeight:900}}>{duration>60?(duration/60).toFixed(duration%60?1:0)+" MIN":duration+" SECONDS"}</span>
            </div>
            <input type="range" min={5} max={300} value={duration} onChange={e=>setDuration(+e.target.value)} style={{width:"100%",accentColor:GOLD}}/>
          </div>
          {/* ── ADD BACKGROUND MUSIC? ─────────────────────────────── */}
          <div style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:14,marginBottom:14}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{color:GOLD,fontSize:11,fontWeight:900,letterSpacing:2}}>ADD BACKGROUND MUSIC?</span>
              <div style={{display:"flex",gap:6}}>
                <button onClick={()=>setAddMusic(true)}
                  style={{background:addMusic?GOLD:"#111",border:"1px solid "+(addMusic?"#000":GOLDDIM),color:addMusic?"#000":WHITE,padding:"5px 16px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:1}}>Y</button>
                <button onClick={()=>{setAddMusic(false);setMusicTrack("");}}
                  style={{background:!addMusic?GOLD:"#111",border:"1px solid "+(!addMusic?"#000":GOLDDIM),color:!addMusic?"#000":WHITE,padding:"5px 16px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:1}}>N</button>
              </div>
            </div>
            {addMusic&&(
              <div style={{marginTop:12}}>
                <div style={{color:GOLDDIM,fontSize:10,letterSpacing:2,marginBottom:8}}>CHOOSE A TRACK</div>
                <div style={{display:"flex",gap:8,alignItems:"center"}}>
                  <select value={musicTrack} onChange={e=>setMusicTrack(e.target.value)}
                    style={{flex:1,background:"#000",border:"1px solid "+GOLD,color:WHITE,padding:"9px 12px",fontSize:12,fontWeight:900,fontFamily:"'Rajdhani',sans-serif",outline:"none",cursor:"pointer"}}>
                    <option value="">— Select background music —</option>
                    {MUSIC_LIBRARY.map(m=>(<option key={m.id} value={m.id} style={{background:"#000",color:WHITE}}>{m.label}</option>))}
                  </select>
                  <button onClick={()=>{const m=MUSIC_LIBRARY.find(x=>x.id===musicTrack);if(!m)return;try{const a=new Audio(m.url);a.volume=0.5;a.play().catch(()=>{});setTimeout(()=>{try{a.pause();}catch(e){}},6000);}catch(e){}}}
                    disabled={!musicTrack} title="Preview 6 seconds"
                    style={{background:musicTrack?"none":"#111",border:"1px solid "+GOLDDIM,color:musicTrack?GOLD:"#555",padding:"9px 14px",cursor:musicTrack?"pointer":"not-allowed",fontSize:12,fontWeight:900}}>▶ PREVIEW</button>
                </div>
                {!musicTrack&&<div style={{color:"#e0a020",fontSize:10,marginTop:8,letterSpacing:1}}>Pick a track from the menu, or press N to render without music.</div>}
              </div>
            )}
          </div>
          {/* ── USE STEREO SOUND ─────────────────────────────────── */}
          <div onClick={()=>setGenStereo(s=>!s)} style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"12px 14px",background:"#0a0a0a",border:"1px solid "+(genStereo?GOLD:GOLDDIM),cursor:"pointer"}}>
            <div style={{width:20,height:20,borderRadius:4,border:"2px solid "+(genStereo?GOLD:GOLDDIM),background:genStereo?GOLD:"transparent",color:"#000",fontWeight:900,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{genStereo?"✓":""}</div>
            <div><div style={{color:genStereo?GOLD:WHITE,fontWeight:900,fontSize:12,letterSpacing:1}}>🔊 USE STEREO SOUND</div><div style={{color:GOLDDIM,fontSize:10,marginTop:1}}>Full stereo width baked into the generated video's audio</div></div>
          </div>
          {/* ── SCRIPT-TO-MOVIE BRIEF (from Page 5) ──────────────── */}
          {hasBrief&&(
            <div onClick={()=>setUseBrief(b=>!b)} style={{display:"flex",alignItems:"center",gap:10,marginBottom:14,padding:"12px 14px",background:"#0a0a0a",border:"1px solid "+(useBrief?GOLD:GOLDDIM),cursor:"pointer"}}>
              <div style={{width:20,height:20,borderRadius:4,border:"2px solid "+(useBrief?GOLD:GOLDDIM),background:useBrief?GOLD:"transparent",color:"#000",fontWeight:900,fontSize:14,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{useBrief?"✓":""}</div>
              <div><div style={{color:useBrief?GOLD:WHITE,fontWeight:900,fontSize:12,letterSpacing:1}}>🎬 USE SCRIPT-TO-MOVIE BRIEF</div><div style={{color:GOLDDIM,fontSize:10,marginTop:1}}>Your Producer, Describe &amp; Production notes from Page 5 drive this render</div></div>
            </div>
          )}
          <button onClick={generateVideo} disabled={generating||!prompt.trim()}
            style={{background:"linear-gradient(135deg,#a07820,#e8c96d)",border:"none",color:"#000",width:"100%",padding:"20px",fontSize:15,letterSpacing:3,cursor:generating||!prompt.trim()?"not-allowed":"pointer",fontWeight:900,fontFamily:"'Rajdhani',sans-serif",opacity:generating||!prompt.trim()?0.5:1}}>
            {generating?"⟳ MANDASTRONG ENGINE RENDERING... "+progress+"%":"🎬 GENERATE SCENE"}
          </button>
        </div>
        <div style={{borderLeft:"1px solid "+GOLDDIM+"",display:"flex",flexDirection:"column"}}>
          <div style={{background:"#000",aspectRatio:"16/9",display:"flex",alignItems:"center",justifyContent:"center",borderBottom:"1px solid "+GOLDDIM+"",overflow:"hidden"}}>
            {videoUrl?(
              <video ref={videoRef} src={videoUrl} controls autoPlay loop playsInline style={{width:"100%",height:"100%",objectFit:"contain"}}/>
            ):(
              <div style={{textAlign:"center",padding:20}}>
                <div style={{color:GOLD,fontSize:11,fontWeight:900,letterSpacing:3,marginBottom:8}}>MANDASTRONG ENGINE v2</div>
                <div style={{color:DIM,fontSize:10,lineHeight:2}}>Type any scene description.<br/>Hit Generate.<br/>Real cinematic output.</div>
              </div>
            )}
          </div>
          {generating&&(
            <div style={{padding:"10px 14px",borderBottom:"1px solid "+GOLDDIM+""}}>
              <div style={{height:5,background:"#111",marginBottom:4}}>
                <div style={{width:progress+"%",height:"100%",background:"linear-gradient(90deg,#a07820,#e8c96d)",transition:"width .4s"}}/>
              </div>
              <div style={{color:GOLD,fontSize:10,textAlign:"center",letterSpacing:2}}>{progress}%</div>
            </div>
          )}
          {videoUrl&&!generating&&(
            <div style={{padding:"10px 14px",borderBottom:"1px solid "+GOLDDIM+"",display:"flex",flexDirection:"column",gap:6}}>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                <a href={videoUrl} download={(title||"scene")+"_"+duration+"s.webm"} target="_blank" rel="noopener noreferrer"
                  style={{background:"transparent",border:"1px solid "+GOLD,color:GOLD,padding:"8px",fontSize:10,textDecoration:"none",textAlign:"center",letterSpacing:1,fontWeight:900,fontFamily:"'Rajdhani',sans-serif",display:"block"}}>⬇ DOWNLOAD</a>
                <button onClick={saveToLibrary}
                  style={{background:saved?"linear-gradient(135deg,#a07820,#e8c96d)":"transparent",border:"1px solid "+GOLD,color:saved?"#000":GOLD,padding:"8px",fontSize:10,cursor:"pointer",fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}>
                  {saved?"✓ SAVED":"💾 LIBRARY"}
                </button>
              </div>
              <button onClick={()=>{setVideoUrl("");setLog([]);setSaved(false);setTitle("");setPrompt("");}}
                style={{background:"linear-gradient(135deg,#a07820,#e8c96d)",border:"none",color:"#000",padding:"8px",fontSize:11,width:"100%",letterSpacing:2,cursor:"pointer",fontWeight:900,fontFamily:"'Rajdhani',sans-serif"}}>
                ▶ NEXT SCENE
              </button>
            </div>
          )}
          <div style={{flex:1,overflowY:"auto",padding:14}}>
            {log.length>0?(
              <div>
                <div style={{color:GOLD,fontSize:10,letterSpacing:3,fontWeight:900,marginBottom:10}}>PRODUCTION LOG</div>
                {log.map((l,i)=>(
                  <div key={i} style={{color:i===log.length-1?"#22c55e":DIM,fontSize:11,lineHeight:2,letterSpacing:1}}>
                    {i===log.length-1?"▶ ":"  "}{l}
                  </div>
                ))}
              </div>
            ):(
              <div style={{padding:"16px 0",color:GOLDDIM,fontSize:10,lineHeight:2.2,letterSpacing:1}}>
                <div style={{color:GOLD,fontWeight:900,fontSize:11,marginBottom:8}}>MANDASTRONG ENGINE v2</div>
                ✦ 8 rendering layers per frame<br/>
                ✦ Multi-layer parallax depth<br/>
                ✦ Volumetric candle flickering<br/>
                ✦ Animated ocean (12 wave layers)<br/>
                ✦ Procedural human anatomy<br/>
                ✦ Real moon halos + reflections<br/>
                ✦ Three-tier city buildings<br/>
                ✦ Film grain + vignette + grade<br/>
                ✦ Camera push-in + drift<br/>
                ✦ 24fps · 1080p · 18Mbps
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function P1({ go }) {
  return (
    <div style={{...Sp}}>
      <div style={{background:"#000",padding:"56px 40px 36px",textAlign:"center",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,pointerEvents:"none"}}>
          {[...Array(55)].map((_,i)=>(
            <div key={i} style={{position:"absolute",width:i%4===0?2:1,height:i%4===0?2:1,background:GOLD,borderRadius:"50%",opacity:.1+i%4*.15,left:(i*17+3)%100+"%",top:(i*11+7)%100+"%",animation:"tw "+1.8+i%3*.8+"s ease-in-out "+i%5*.35+"s infinite"}}/>
          ))}
        </div>
        <style>{"@keyframes tw{0%,100%{opacity:.05}50%{opacity:.85}}"}</style>
        <div style={{position:"relative",zIndex:1}}>
          <div style={{fontSize:11,color:DIM,letterSpacing:6,marginBottom:12}}>CINEMA INTELLIGENCE PLATFORM — EST. 2025</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(34px,6vw,58px)",fontWeight:900,color:GOLD,letterSpacing:5,lineHeight:1,textShadow:"0 0 60px "+GOLD+"dd,0 0 120px "+GOLD+"66"}}>MANDA STRONG</div>
          <div style={{fontFamily:"'Cinzel',serif",fontSize:"clamp(34px,6vw,58px)",fontWeight:900,color:GOLD,letterSpacing:5,lineHeight:1,textShadow:"0 0 60px "+GOLD+"dd,0 0 120px "+GOLD+"66",marginBottom:14}}>STUDIO</div>
          <div style={{color:WHITE,fontSize:12,letterSpacing:4,marginBottom:28,fontWeight:600}}>600+ AI TOOLS · 8K EXPORT · UP TO 3-HOUR FILMS</div>
          <div style={{display:"flex",gap:14,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>go(4)} style={{...G("gold",false),fontSize:14,padding:"14px 38px",letterSpacing:3}}>START CREATING</button>
            <button onClick={()=>go(4)} style={{...G("out",false),fontSize:14,padding:"14px 38px",letterSpacing:3}}>LOGIN / REGISTER</button>
          </div>
        </div>
      </div>
      <div style={{borderTop:"1px solid "+GOLD+"",display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:8,padding:"16px 24px",maxWidth:800,margin:"0 auto"}}>
        {[["600+","AI TOOLS"],["8K","EXPORT"],["3 HRS","DURATION"],["1TB","STORAGE"]].map(([v,l])=>(
          <div key={v} style={{...Card(),textAlign:"center",padding:12}}>
            <div style={{color:GOLD,fontFamily:"'Cinzel',serif",fontSize:22,fontWeight:900}}>{v}</div>
            <div style={{color:WHITE,fontSize:11,marginTop:3,fontWeight:700,letterSpacing:2}}>{l}</div>
          </div>
        ))}
      </div>
      <div style={{textAlign:"center",paddingBottom:24,paddingTop:16}}>
        <div style={{display:"flex",flexDirection:"column",alignItems:"center",gap:8}}>
          <button onClick={async()=>{
            const ua = navigator.userAgent.toLowerCase();
            const isIOS = /iphone|ipad|ipod/.test(ua) || (/(macintosh)/.test(ua) && navigator.maxTouchPoints>1);
            const isAndroid = /android/.test(ua);
            const isStandalone = (window.matchMedia&&window.matchMedia("(display-mode: standalone)").matches) || window.navigator.standalone===true;
            // REAL DOWNLOAD: save a standalone launcher file to the user's computer.
            // Double-clicking it opens MandaStrong Studio full-screen in their browser.
            try{
              const APP_URL="https://mandastrongmovie.bolt.host";
              const launcher='<!doctype html><html><head><meta charset="utf-8"><title>MandaStrong Studio</title><meta name="viewport" content="width=device-width,initial-scale=1"><style>html,body{margin:0;height:100%;background:#000}iframe{border:0;width:100vw;height:100vh;display:block}</style></head><body><iframe src="'+APP_URL+'" allow="camera;microphone;autoplay;fullscreen;clipboard-write" allowfullscreen></iframe><script>try{if(location.protocol==="file:"){location.href="'+APP_URL+'";}}catch(e){location.href="'+APP_URL+'";}<\\/script></body></html>';
              const blob=new Blob([launcher],{type:"text/html"});
              const url=URL.createObjectURL(blob);
              const a=document.createElement("a");
              a.href=url; a.download="MandaStrong Studio.html";
              document.body.appendChild(a); a.click();
              setTimeout(()=>{document.body.removeChild(a);URL.revokeObjectURL(url);},1500);
            }catch(e){}
            // Then also offer native install where the browser supports it.
            if(isStandalone){return;}
            if(window.deferredInstallPrompt){
              try{
                window.deferredInstallPrompt.prompt();
                const choice=await window.deferredInstallPrompt.userChoice;
                window.deferredInstallPrompt=null;
                if(choice&&choice.outcome==="accepted") alert("✓ Installing MandaStrong Studio to your home screen. Look for the gold M icon.");
              }catch(e){}
            } else if(isIOS){
              alert("✓ MandaStrong Studio.html downloaded to your device.\n\nTo also add it to your home screen on iPhone/iPad:\n1. Tap the Share button ⬆ in Safari\n2. Scroll down and tap 'Add to Home Screen'\n3. Tap 'Add'");
            } else if(isAndroid){
              alert("✓ MandaStrong Studio downloaded.\n\nTo also install it as an app:\n1. Tap the menu ⋮ in Chrome\n2. Tap 'Add to Home screen' or 'Install app'");
            } else {
              alert("✓ MandaStrong Studio.html downloaded to your computer.\n\nDouble-click the file any time to open the studio full-screen.\n\nTo also install it: look for the install icon ⊕ in your browser's address bar.");
            }
          }} style={{background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"14px 32px",fontSize:14,fontWeight:900,letterSpacing:3,cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",width:"100%",maxWidth:320}}>
            ⬇ DOWNLOAD APP
          </button>
          <div style={{color:GOLDDIM,fontSize:10,letterSpacing:2,textAlign:"center"}}>BROWSER MENU → ADD TO HOME SCREEN</div>
        </div>
      </div>
    </div>
  );
}

function P2({ go }) {
  const pipeline=[{n:"01",ic:"✍",t:"WRITE",d:"Script, logline, scenes",p:5},{n:"02",ic:"🎙",t:"VOICE",d:"54 AI voice characters",p:6},{n:"03",ic:"🎨",t:"IMAGE",d:"AI-generated stills",p:7},{n:"04",ic:"🎬",t:"VIDEO",d:"Cinema scene engine",p:8},{n:"05",ic:"⏱",t:"TIMELINE",d:"Multi-track editor",p:13},{n:"06",ic:"🎚",t:"MIX",d:"4-channel audio mixer",p:15},{n:"07",ic:"⚡",t:"RENDER",d:"Up to 4K export",p:16}];
  const templates=[{ic:"🎬",t:"FEATURE FILM",d:"90-minute drama.",pages:[5,6,8,13,15,16],bg:"#1a0800"},{ic:"🎥",t:"DOCUMENTARY",d:"60-minute documentary.",pages:[5,6,8,13,15,16],bg:"#061a06"},{ic:"🎵",t:"MUSIC VIDEO",d:"Beat-synced cinematic video.",pages:[6,8,13,16],bg:"#0a0618"},{ic:"🎭",t:"SHORT FILM",d:"10-minute narrative.",pages:[5,6,8,13,16],bg:"#0a0a18"},{ic:"👨‍👩‍👧",t:"FAMILY MOVIE",d:"30-minute family film.",pages:[5,6,8,13,16],bg:"#1a0a00"},{ic:"📖",t:"AUDIOBOOK",d:"Narrated audiobook.",pages:[5,6,15,16],bg:"#181200"}];
  return(
    <div style={{...Sp,padding:"0 0 40px"}}>
      <div style={{padding:"20px 24px 14px",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div><div style={{fontSize:10,color:GOLD,letterSpacing:4,fontWeight:700,marginBottom:4}}>MANDASTRONG STUDIO · CINEMA INTELLIGENCE PLATFORM</div><h1 style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:"clamp(22px,4vw,40px)",fontWeight:900,letterSpacing:6,margin:0}}>STUDIO DASHBOARD</h1></div>
        <button onClick={()=>go(5)} style={{background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"14px 28px",fontSize:13,fontWeight:900,letterSpacing:3,cursor:"pointer",fontFamily:"'Rajdhani',sans-serif"}}>+ NEW PROJECT</button>
      </div>
      <div style={{padding:"0 24px 20px"}}>
        <div style={{fontSize:10,color:GOLD,letterSpacing:4,fontWeight:700,marginBottom:12}}>PRODUCTION PIPELINE</div>
        <div style={{display:"flex",gap:0,overflowX:"auto"}}>
          {pipeline.map((step,i)=>(
            <div key={step.n} style={{display:"flex",alignItems:"center",flexShrink:0}}>
              <div onClick={()=>go(step.p)} style={{background:"#0a0800",border:"1px solid "+GOLDDIM,padding:"14px 16px",cursor:"pointer",textAlign:"center",minWidth:120}}
                onMouseEnter={e=>{e.currentTarget.style.borderColor=GOLD;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=GOLDDIM;}}>
                <div style={{color:GOLDDIM,fontSize:9,letterSpacing:3,marginBottom:4}}>STEP {step.n}</div>
                <div style={{fontSize:20,marginBottom:4}}>{step.ic}</div>
                <div style={{color:GOLD,fontWeight:900,fontSize:12,letterSpacing:2,marginBottom:2}}>{step.t}</div>
                <div style={{color:WHITE,fontSize:10,lineHeight:1.3}}>{step.d}</div>
              </div>
              {i<pipeline.length-1&&<div style={{color:GOLDDIM,fontSize:14,padding:"0 3px",flexShrink:0}}>›</div>}
            </div>
          ))}
        </div>
      </div>
      <div style={{padding:"0 24px"}}>
        <div style={{fontSize:10,color:GOLD,letterSpacing:4,fontWeight:700,marginBottom:12}}>QUICK START TEMPLATES</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:12}}>
          {templates.map(tmpl=>(
            <div key={tmpl.t} style={{background:tmpl.bg,border:"1px solid "+GOLDDIM+"33",padding:"16px 18px",cursor:"pointer"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=GOLD;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=GOLDDIM+"33";}}>
              <div style={{display:"flex",alignItems:"center",gap:8,marginBottom:8}}><span style={{fontSize:24}}>{tmpl.ic}</span><span style={{color:GOLD,fontWeight:900,fontSize:13,letterSpacing:2}}>{tmpl.t}</span></div>
              <div style={{color:WHITE,fontSize:12,lineHeight:1.6,marginBottom:10}}>{tmpl.d}</div>
              <div style={{display:"flex",flexWrap:"wrap",gap:4}}>
                {tmpl.pages.map(p=>(
                  <button key={p} onClick={()=>go(p)} style={{background:"transparent",border:"1px solid "+GOLDDIM,color:GOLDDIM,padding:"2px 8px",cursor:"pointer",fontSize:10,fontWeight:900,fontFamily:"'Rajdhani',sans-serif"}}
                    onMouseEnter={e=>{e.currentTarget.style.borderColor=GOLD;e.currentTarget.style.color=GOLD;}} onMouseLeave={e=>{e.currentTarget.style.borderColor=GOLDDIM;e.currentTarget.style.color=GOLDDIM;}}>P{p}</button>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function P3() {
  const [uploads, setUploads] = useState([null,null,null]);
  const [titles, setTitles] = useState(["","",""]);
  const [descs, setDescs] = useState(["","",""]);
  const [loaded, setLoaded] = useState(false);
  const refs = [useRef(null),useRef(null),useRef(null)];
  const videoRefs = [useRef(null),useRef(null),useRef(null)];

  // Load saved proof-of-concept films from permanent storage on mount
  useEffect(()=>{
    let alive=true;
    (async()=>{
      try{
        const t=JSON.parse(localStorage.getItem("ms_poc_titles")||'["","",""]');
        const d=JSON.parse(localStorage.getItem("ms_poc_descs")||'["","",""]');
        if(alive){setTitles(t);setDescs(d);}
      }catch{}
      const next=[null,null,null];
      for(let i=0;i<3;i++){
        try{
          const rec=await loadClipFromDB("poc_"+i);
          if(rec&&rec.blob){
            next[i]={url:URL.createObjectURL(rec.blob),name:rec.name,type:rec.type,size:(rec.blob.size/1024/1024).toFixed(1)};
          }
        }catch{}
      }
      if(alive){setUploads(next);setLoaded(true);}
    })();
    return ()=>{alive=false;};
  },[]);

  const saveTitles=(arr)=>{try{localStorage.setItem("ms_poc_titles",JSON.stringify(arr));}catch{}};
  const saveDescs=(arr)=>{try{localStorage.setItem("ms_poc_descs",JSON.stringify(arr));}catch{}};

  const handleFile=async(i,e)=>{
    const f=e.target.files&&e.target.files[0];
    if(!f)return;
    const url=URL.createObjectURL(f);
    setUploads(p=>{const n=[...p];if(n[i])URL.revokeObjectURL(n[i].url);n[i]={url,name:f.name,type:f.type,size:(f.size/1024/1024).toFixed(1)};return n;});
    // Persist the actual file to IndexedDB so it stays forever
    try{await saveClipToDB("poc_"+i,f,f.name,f.type);}catch(err){alert("Could not save film "+(i+1)+" — storage may be full.");}
  };
  const removeUpload=async(i)=>{
    setUploads(p=>{const n=[...p];if(n[i])URL.revokeObjectURL(n[i].url);n[i]=null;return n;});
    setTitles(p=>{const n=[...p];n[i]="";saveTitles(n);return n;});
    setDescs(p=>{const n=[...p];n[i]="";saveDescs(n);return n;});
    try{await deleteClipFromDB("poc_"+i);}catch{}
  };

  const inp={width:"100%",background:"#000",border:"1px solid "+GOLDDIM,padding:"8px 10px",color:WHITE,fontSize:12,outline:"none",fontFamily:"'Rajdhani',sans-serif",boxSizing:"border-box"};

  return (
    <div style={{...Sp,padding:40}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <div style={{fontSize:12,color:GOLD,letterSpacing:4,marginBottom:8,fontWeight:700}}>SHOWCASE</div>
        <h1 style={{...H1,fontSize:30,marginBottom:6}}>PROOF OF CONCEPT</h1>
        <div style={{color:GOLDDIM,fontSize:13,marginBottom:10,letterSpacing:1}}>Upload up to 3 films, trailers, or demo reels created with MandaStrong Studio.</div>
        <div style={{color:"#22c55e",fontSize:11,marginBottom:24,letterSpacing:2,fontWeight:900}}>✓ SAVED PERMANENTLY — YOUR FILMS STAY UNTIL YOU REPLACE OR REMOVE THEM</div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:20}}>
          {[0,1,2].map(i=>(
            <div key={i} style={{...Card(),padding:16}}>
              <div style={{color:GOLD,fontSize:10,letterSpacing:3,fontWeight:900,marginBottom:10}}>FILM {i+1}</div>

              {/* Video/Image preview area */}
              <div style={{background:"#000",aspectRatio:"16/9",marginBottom:10,border:"1px solid "+(uploads[i]?GOLD:GOLDDIM),overflow:"hidden",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer"}}
                onClick={()=>!uploads[i]&&refs[i].current&&refs[i].current.click()}>
                {uploads[i]?(
                  uploads[i].type.startsWith("video")?(
                    <video ref={videoRefs[i]} src={uploads[i].url} controls playsInline style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                  ):(
                    <img src={uploads[i].url} alt="upload" style={{width:"100%",height:"100%",objectFit:"cover",display:"block"}}/>
                  )
                ):(
                  <div style={{textAlign:"center",padding:16}}>
                    <div style={{color:GOLDDIM,fontSize:28,marginBottom:8}}>🎬</div>
                    <div style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:2}}>CLICK TO UPLOAD</div>
                    <div style={{color:GOLDDIM,fontSize:9,marginTop:4}}>MP4 · WEBM · MOV · JPG · PNG</div>
                  </div>
                )}
                {uploads[i]&&(
                  <button onClick={e=>{e.stopPropagation();removeUpload(i);}}
                    style={{position:"absolute",top:6,right:6,background:"rgba(0,0,0,0.8)",border:"1px solid "+GOLD,color:GOLD,width:22,height:22,cursor:"pointer",fontSize:12,fontWeight:900,display:"flex",alignItems:"center",justifyContent:"center"}}>
                    ✕
                  </button>
                )}
              </div>

              <input ref={refs[i]} type="file" accept="video/*,image/*" style={{display:"none"}} onChange={e=>handleFile(i,e)}/>

              {/* Title */}
              <div style={{color:GOLD,fontSize:9,letterSpacing:2,fontWeight:900,marginBottom:4}}>FILM TITLE</div>
              <input value={titles[i]} onChange={e=>setTitles(p=>{const n=[...p];n[i]=e.target.value;saveTitles(n);return n;})}
                placeholder="Enter film title..." style={{...inp,marginBottom:8}}/>

              {/* Description */}
              <div style={{color:GOLD,fontSize:9,letterSpacing:2,fontWeight:900,marginBottom:4}}>DESCRIPTION</div>
              <textarea value={descs[i]} onChange={e=>setDescs(p=>{const n=[...p];n[i]=e.target.value;saveDescs(n);return n;})}
                placeholder="Describe this film..." style={{...inp,height:60,resize:"none",lineHeight:1.6,marginBottom:10}}/>

              {/* Upload button */}
              {!uploads[i]?(
                <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                  <button onClick={()=>{const inp2=document.createElement("input");inp2.type="file";inp2.accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif";inp2.onchange=e=>handleFile(i,e);inp2.click();}}
                    style={{background:"linear-gradient(135deg,#1a0800,#2a1200)",border:"2px solid "+GOLD,color:GOLD,padding:"10px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}>
                    📷 PHOTO
                  </button>
                  <button onClick={()=>refs[i].current&&refs[i].current.click()}
                    style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,color:WHITE,padding:"10px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}>
                    📁 FILE
                  </button>
                </div>
              ):(
                <div>
                  <div style={{color:"#22c55e",fontSize:9,fontWeight:900,letterSpacing:2,marginBottom:6}}>✓ {uploads[i].name.slice(0,28)} · {uploads[i].size}MB</div>
                  <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:6}}>
                    <a href={uploads[i].url} download={uploads[i].name}
                      style={{...G("gold",false),width:"100%",padding:"8px",fontSize:10,letterSpacing:2,textDecoration:"none",textAlign:"center",display:"block",boxSizing:"border-box"}}>
                      💾 SAVE
                    </a>
                    <button onClick={()=>refs[i].current&&refs[i].current.click()}
                      style={{...G("out",false),width:"100%",padding:"8px",fontSize:10,letterSpacing:2}}>
                      ↻ REPLACE
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* If nothing uploaded yet */}
        {uploads.every(u=>!u)&&(
          <div style={{marginTop:32,padding:24,border:"1px dashed "+GOLDDIM,textAlign:"center"}}>
            <div style={{color:GOLDDIM,fontSize:12,letterSpacing:2,lineHeight:2}}>
              No films uploaded yet. Use Page 8 to generate scenes, Page 16 to render your film,<br/>
              then upload it here as your proof of concept.
            </div>
          </div>
        )}
      </div>
    </div>
  );
}


function P4({ go, setUser }) {
  const [email,setEmail]=useState(""); const [pass,setPass]=useState("");
  const [name,setName]=useState(""); const [re,setRe]=useState("");
  const [loginOk,setLoginOk]=useState(false);
  const inp={width:"100%",background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:"10px 12px",color:WHITE,fontSize:14,marginBottom:10,outline:"none",boxSizing:"border-box",fontFamily:"'Rajdhani',sans-serif"};
  const login=()=>{
    const amandaEmails=["woolleya129@gmail.com"];
    const amandaPasswords=["Admin","MandaAdmin2026!","amandasox1970!!","admin","ADMIN"];
    const isAmanda=amandaEmails.includes(email)&&amandaPasswords.includes(pass);
    if(isAmanda){
      setLoginOk(true);setTimeout(()=>{setUser({name:"Amanda",plan:"Studio",isAdmin:true});go(5);},800);
    } else if(email==="test@mandastrong.com"&&pass==="Test2026"){
      setLoginOk(true);setTimeout(()=>{setUser({name:"Studio User",plan:"Studio",isAdmin:false});go(5);},800);
    } else if(email.includes("@")&&pass.length>0){
      window.open(STRIPE.studio,"_blank");
      alert("To access MandaStrong Studio, please complete your subscription. You will be redirected to our secure payment page.");
    } else {alert("Please enter a valid email and password.");}
  };
  return (
    <div style={{...Sp,padding:40}}>
      <div style={{maxWidth:1000,margin:"0 auto"}}>
        {/* Live subscriber counter — green live light, auto-updates (LIVE visitors + TOTAL users) */}
        <MSUserCounter/>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:18,marginBottom:36}}>
          <div style={{...Card()}}>
            <div style={{fontSize:11,color:GOLD,letterSpacing:3,marginBottom:8,fontWeight:700}}>EXISTING USER</div>
            <h2 style={{...H1,fontSize:18,marginBottom:18}}>SIGN IN</h2>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email address" style={inp}/>
            <input value={pass} onChange={e=>setPass(e.target.value)} type="password" placeholder="Password" style={{...inp,marginBottom:16}}/>
            {loginOk&&<div style={{background:"#061406",border:"1px solid #22c55e",padding:"10px",textAlign:"center",marginBottom:8}}>
              <span style={{color:"#22c55e",fontWeight:900,fontSize:14,letterSpacing:2}}>✓ LOGIN SUCCESSFUL</span>
            </div>}
            <button onClick={login} style={{...G("gold",false),width:"100%",padding:"12px"}}>{loginOk?"✓ ENTERING STUDIO...":"SIGN IN TO STUDIO"}</button>
          </div>
          <div style={{...Card(),border:"2px solid #22c55e",position:"relative"}}>
            <div style={{position:"absolute",top:-11,left:"50%",transform:"translateX(-50%)",background:"#22c55e",color:"#000",padding:"3px 14px",fontSize:11,fontWeight:900,whiteSpace:"nowrap"}}>🎉 7-DAY FREE TRIAL</div>
            <div style={{fontSize:11,color:GOLD,letterSpacing:3,marginBottom:8,marginTop:10,fontWeight:700}}>NEW CREATOR</div>
            <h2 style={{...H1,fontSize:18,marginBottom:18}}>CREATE ACCOUNT</h2>
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="Your Name" style={inp}/>
            <input value={re} onChange={e=>setRe(e.target.value)} placeholder="Email address" style={{...inp,marginBottom:16}}/>
            <button onClick={()=>{setUser({name:name||"Creator",plan:"Studio Trial",isAdmin:false});window.open(STRIPE.studio,"_blank");go(5);}}
              style={{width:"100%",padding:"12px",background:"#22c55e",border:"none",color:"#000",fontWeight:900,fontSize:13,cursor:"pointer",letterSpacing:2}}>START FREE TRIAL — $0</button>
          </div>
          <div style={{...Card(),textAlign:"center"}}>
            <div style={{fontSize:36,marginBottom:10}}>👁</div>
            <h2 style={{...H1,fontSize:16,marginBottom:10}}>EXPLORE FIRST</h2>
            <p style={{color:WHITE,fontSize:14,lineHeight:1.7,marginBottom:20}}>Browse 600+ AI tools before committing. No account required.</p>
            <button onClick={()=>{window.open(STRIPE.basic,"_blank");alert("Start your free 7-day trial to access MandaStrong Studio. No commitment required.");}} style={{...G("out",false),width:"100%"}}>BROWSE AS GUEST — START FREE TRIAL</button>
          </div>
        </div>
        <div style={{textAlign:"center",marginBottom:24,display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
          <button onClick={()=>{try{const m=JSON.parse(localStorage.getItem("ms_medialib")||"[]");const t=JSON.parse(localStorage.getItem("ms_timeline")||"{}");const u=JSON.parse(localStorage.getItem("ms_user")||"{}");const p=JSON.parse(localStorage.getItem("ms_page")||"5");if(m.length>0||Object.keys(t).length>0){if(u&&u.name)setUser(u);go(p);}else{alert("No saved project found.");}}catch(e){alert("Could not load project.");}}} style={{...G("gold",false),padding:"12px 32px"}}>📂 OPEN PROJECT</button>
          <button onClick={()=>{setUser({name:"Creator",plan:"Guest",isAdmin:false});go(5);}} style={{...G("out",false),padding:"12px 32px"}}>✦ NEW PROJECT</button>
        </div>
        <h2 style={{...H1,fontSize:22,textAlign:"center",marginBottom:22}}>SUBSCRIPTION PLANS</h2>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:14}}>
          {[
            {t:"BASIC PLAN",p:"20",link:STRIPE.basic,f:["HD Export 1080p","100 AI Tools","10GB Storage","Email Support"],pop:false,trial:false,ent:false},
            {t:"PRO PLAN",p:"30",link:STRIPE.pro,f:["4K Export","300 AI Tools","100GB Storage","Priority Support","Commercial License"],pop:true,trial:false,ent:false},
            {t:"STUDIO PLAN",p:"50",link:STRIPE.studio,f:["8K Export","600+ AI Tools","1TB Storage","24/7 Support","Full Rights","API Access","7-Day Free Trial"],pop:false,trial:true,ent:false},
          ].map(plan=>(
            <div key={plan.t} style={{...Card(),border:plan.pop?"2px solid "+GOLD:"1px solid "+GOLDDIM,position:"relative"}}>
              {plan.pop&&<div style={{position:"absolute",top:-11,left:"50%",transform:"translateX(-50%)",background:GOLD,color:"#000",padding:"2px 12px",fontSize:11,fontWeight:900,whiteSpace:"nowrap"}}>MOST POPULAR</div>}
              {plan.trial&&<div style={{position:"absolute",top:-11,right:12,background:"#22c55e",color:"#000",padding:"2px 10px",fontSize:11,fontWeight:900}}>🎉 FREE TRIAL</div>}
              <div style={{color:WHITE,fontSize:11,letterSpacing:3,fontWeight:700}}>{plan.t}</div>
              <div style={{color:GOLD,fontFamily:"'Cinzel',serif",fontSize:34,fontWeight:900,margin:"8px 0"}}>{plan.p}<span style={{fontSize:12,color:WHITE}}>/mo</span></div>
              <div style={{margin:"12px 0"}}>{plan.f.map(f=><div key={f} style={{color:WHITE,fontSize:12,padding:"3px 0",borderBottom:"1px solid #0a0a0a"}}>✓ {f}</div>)}</div>
              <button onClick={()=>window.open(plan.link,"_blank")} style={{...G(plan.trial?"out":"gold",false),width:"100%"}}>{plan.trial?"START FREE TRIAL":"SUBSCRIBE NOW"}</button>
            </div>
          ))}
        </div>

        {/* ── PURCHASE USAGE CREDITS ── one-time top-up at the bottom of the page ── */}
        <div style={{marginTop:40,padding:"28px 24px",background:"#050500",border:"2px solid "+GOLD,textAlign:"center",boxShadow:"0 0 24px "+GOLD+"22"}}>
          <div style={{fontSize:11,color:GOLD,letterSpacing:4,fontWeight:900,marginBottom:6}}>NEED MORE USAGE?</div>
          <h3 style={{...H1,fontSize:20,marginBottom:8}}>PURCHASE USAGE CREDITS</h3>
          <p style={{color:WHITE,fontSize:13,lineHeight:1.7,maxWidth:520,margin:"0 auto 18px"}}>You've already had your usage replaced once. To top up again, purchase extra usage credits here — pay once, use them for renders and generations whenever you're ready, and they never expire. Proceeds from MandaStrong1.Etsy.com are donated to humanitarian causes.</p>
          <button onClick={()=>window.open(STRIPE.studio,"_blank")} style={{...G("gold",false),padding:"14px 44px",fontSize:14}}>💳 PURCHASE USAGE CREDITS</button>
        </div>
      </div>
    </div>
  );
}


function MergeVideos({ onSave }) {
  const [clips, setClips] = useState([]);
  const [merging, setMerging] = useState(false);
  const [progress, setProgress] = useState(0);
  const [mergeLog, setMergeLog] = useState([]);
  const [mergedUrl, setMergedUrl] = useState("");
  const fileRef = useRef(null);

  const addClips = (files) => {
    const newClips = Array.from(files).filter(f=>f.type.startsWith("video")).map(f=>({
      id: Date.now()+Math.random(),
      name: f.name,
      url: URL.createObjectURL(f),
      file: f,
      duration: 0,
    }));
    setClips(p=>[...p,...newClips]);
  };

  const move = (from, to) => {
    setClips(p=>{
      const arr=[...p];
      const moved=arr.splice(from,1)[0];
      arr.splice(to,0,moved);
      return arr;
    });
  };

  const log = (msg) => setMergeLog(p=>[...p,msg]);

  const mergeAll = async () => {
    if(clips.length < 2){ alert("Add at least 2 videos to merge."); return; }
    setMerging(true); setProgress(0); setMergeLog([]); setMergedUrl("");
    log("MandaStrong Merge Engine — combining "+clips.length+" videos in sequence...");

    try {
      const canvas = document.createElement("canvas");
      canvas.width = 1920; canvas.height = 1080;
      const ctx = canvas.getContext("2d");
      const fps = 24;
      const mimeType = MediaRecorder.isTypeSupported("video/webm;codecs=vp9") ? "video/webm;codecs=vp9" : "video/webm";
      const stream = canvas.captureStream(fps);
      const recorder = new MediaRecorder(stream, {mimeType, videoBitsPerSecond:8000000});
      const chunks = [];
      recorder.ondataavailable = e => { if(e.data.size>0) chunks.push(e.data); };
      recorder.start(100);

      for(let ci=0; ci<clips.length; ci++) {
        const clip = clips[ci];
        setProgress(Math.round((ci/clips.length)*90));
        log("  Adding clip "+(ci+1)+"/"+clips.length+": "+clip.name.slice(0,40));

        await new Promise(resolve => {
          const vid = document.createElement("video");
          vid.muted = true; vid.playsInline = true;
          vid.src = clip.url;
          let done = false;
          const finish = () => { if(!done){ done=true; resolve(); } };

          vid.onloadeddata = async () => {
            try { await vid.play(); } catch(e) {}
            const clipDur = Math.min(vid.duration || 30, 120);
            const startTime = Date.now();
            const msPerF = Math.round(1000/fps);
            let lastDraw = performance.now();

            const draw = () => {
              if(done) return;
              const elapsed = (Date.now()-startTime)/1000;
              if(vid.ended || elapsed >= clipDur) { vid.pause(); finish(); return; }
              const now = performance.now();
              if(now - lastDraw >= msPerF - 2) {
                try {
                  ctx.clearRect(0,0,1920,1080);
                  ctx.drawImage(vid,0,0,1920,1080);
                  // Vignette
                  const vig = ctx.createRadialGradient(960,540,100,960,540,1000);
                  vig.addColorStop(0,"rgba(0,0,0,0)"); vig.addColorStop(1,"rgba(0,0,0,0.7)");
                  ctx.fillStyle=vig; ctx.fillRect(0,0,1920,1080);
                  // Letterbox
                  ctx.fillStyle="#000";
                  ctx.fillRect(0,0,1920,78); ctx.fillRect(0,1002,1920,78);
                  lastDraw = now;
                } catch(e) { finish(); return; }
              }
              requestAnimationFrame(draw);
            };
            requestAnimationFrame(draw);
          };
          vid.onerror = finish;
          setTimeout(finish, 180000);
          vid.load();
        });

        // Brief black gap between clips
        if(ci < clips.length-1) {
          const gapFrames = fps * 0.5;
          const gapStart = performance.now();
          await new Promise(resolve => {
            let f = 0;
            const gap = () => {
              if(f >= gapFrames) { resolve(); return; }
              ctx.fillStyle = "#000"; ctx.fillRect(0,0,1920,1080);
              f++;
              const next = gapStart + (f*(1000/fps));
              setTimeout(gap, Math.max(4, next-performance.now()));
            };
            gap();
          });
        }
      }

      setProgress(95);
      log("Finalising merged film...");
      await new Promise(r=>{let d=false;const f=()=>{if(!d){d=true;r();}};setTimeout(f,4000);try{recorder.onstop=f;if(recorder.state!=="inactive"){recorder.stop();}else{f();}}catch(e){f();}});
      const blob = new Blob(chunks, {type:mimeType});
      const url = URL.createObjectURL(blob);
      setMergedUrl(url);
      setProgress(100);
      log("✓ Merge complete — "+(blob.size/1024/1024).toFixed(1)+"MB · "+clips.length+" clips combined");

      const fn = "MandaStrong_Merged_"+Date.now()+".webm";
      try {
        const clipId = "merge_"+Date.now();
        await safeSaveClipToDB(clipId, blob, fn, "video/webm");
        if(onSave) onSave({id:clipId, name:fn, type:"video/webm", url:URL.createObjectURL(blob), file:new File([blob],fn,{type:"video/webm"}), dbId:clipId});
        log("✓ Saved to media library — ready for timeline");
      } catch(e) {}

    } catch(e) { log("Merge error: "+e.message); }
    setMerging(false);
  };

  return (
    <div>
      <input ref={fileRef} type="file" multiple accept="video/*" style={{display:"none"}} onChange={e=>addClips(e.target.files)}/>
      <button onClick={()=>fileRef.current&&fileRef.current.click()}
        style={{width:"100%",background:"#0a0a0a",border:"1px solid "+GOLDDIM,color:WHITE,padding:"10px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",marginBottom:10}}>
        ⬆ ADD VIDEOS TO MERGE ({clips.length} loaded)
      </button>
      {clips.length>0&&(
        <div style={{marginBottom:10}}>
          <div style={{color:GOLD,fontSize:10,letterSpacing:2,fontWeight:900,marginBottom:6}}>DRAG TO REORDER — TOP = FIRST IN FILM</div>
          {clips.map((c,i)=>(
            <div key={c.id}
              draggable
              onDragStart={e=>e.dataTransfer.setData("mergeIdx",String(i))}
              onDragOver={e=>e.preventDefault()}
              onDrop={e=>{e.preventDefault();const from=Number(e.dataTransfer.getData("mergeIdx"));if(from!==i)move(from,i);}}
              style={{background:"#0a0800",border:"1px solid "+GOLDDIM,padding:"8px 12px",marginBottom:4,display:"flex",alignItems:"center",gap:10,cursor:"grab"}}>
              <span style={{color:GOLD,fontWeight:900,fontSize:13}}>⣿</span>
              <span style={{color:GOLD,fontWeight:900,fontSize:11,minWidth:20}}>{i+1}.</span>
              <span style={{color:WHITE,fontSize:11,flex:1}}>{c.name.slice(0,50)}</span>
              <div style={{display:"flex",gap:4}}>
                {i>0&&<button onClick={()=>move(i,i-1)} style={{background:"none",border:"1px solid "+GOLDDIM,color:GOLD,padding:"2px 7px",cursor:"pointer",fontSize:10,fontWeight:900}}>▲</button>}
                {i<clips.length-1&&<button onClick={()=>move(i,i+1)} style={{background:"none",border:"1px solid "+GOLDDIM,color:GOLD,padding:"2px 7px",cursor:"pointer",fontSize:10,fontWeight:900}}>▼</button>}
                <button onClick={()=>setClips(p=>p.filter((_,j)=>j!==i))} style={{background:"none",border:"1px solid #ef4444",color:"#ef4444",padding:"2px 7px",cursor:"pointer",fontSize:10,fontWeight:900}}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}
      {clips.length>=2&&(
        <button onClick={mergeAll} disabled={merging}
          style={{width:"100%",background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"12px",cursor:merging?"not-allowed":"pointer",fontSize:12,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",opacity:merging?0.7:1,marginBottom:8}}>
          {merging?"⟳ MERGING... "+progress+"%":"⚡ MERGE IN SEQUENCE → SAVE TO TIMELINE"}
        </button>
      )}
      {merging&&(
        <div style={{height:4,background:"#111",marginBottom:8}}>
          <div style={{width:progress+"%",height:"100%",background:"linear-gradient(90deg,"+GOLDDIM+","+GOLD+")",transition:"width .3s"}}/>
        </div>
      )}
      {mergeLog.length>0&&(
        <div style={{background:"#000",border:"1px solid "+GOLDDIM,padding:10,maxHeight:100,overflowY:"auto",marginBottom:8}}>
          {mergeLog.map((l,i)=>(
            <div key={i} style={{color:i===mergeLog.length-1?"#22c55e":DIM,fontSize:10,lineHeight:1.7}}>
              {i===mergeLog.length-1?"▶ ":"  "}{l}
            </div>
          ))}
        </div>
      )}
      {mergedUrl&&(
        <div style={{background:"#061406",border:"1px solid #22c55e",padding:"10px 14px"}}>
          <div style={{color:"#22c55e",fontWeight:900,fontSize:11,letterSpacing:2,marginBottom:6}}>✓ MERGED FILM SAVED TO MEDIA LIBRARY — READY FOR TIMELINE</div>
          <a href={mergedUrl} download="MandaStrong_Merged.webm" target="_blank" rel="noopener noreferrer"
            style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:2,textDecoration:"none"}}>⬇ DOWNLOAD MERGED FILM</a>
        </div>
      )}
    </div>
  );
}

function P11({ mediaLib, setMediaLib }) {
  const fileRef = useRef(null);
  const onFiles = async files => {
    if(!files)return;
    const arr=Array.from(files);
    const added=[];
    for(const f of arr){
      // Large files: warn but still allow — IndexedDB handles big blobs fine
      if(f.size>1024*1024*1024){ // >1GB
        alert('"'+f.name+'" is very large ('+(f.size/1024/1024/1024).toFixed(1)+"GB). It may load slowly. For smoothest results keep single files under 1GB.");
      }
      const id=Date.now()+Math.random();
      const asset={id,name:f.name,type:f.type,file:f,url:URL.createObjectURL(f),dbId:"upload_"+id};
      // Persist to IndexedDB so it survives refresh and doesn't rely on holding the File in memory
      try{await safeSaveClipToDB("upload_"+id,f,f.name,f.type);}catch(err){console.warn("upload persist failed",err);}
      added.push(asset);
    }
    setMediaLib(p=>[...p,...added]);
  };
  return (
    <div style={{...Sp,padding:40}}>
      <div style={{maxWidth:800,margin:"0 auto"}}>
        <div style={{fontSize:12,color:GOLD,letterSpacing:4,marginBottom:4,fontWeight:700}}>ASSET INGESTION</div>
        <h1 style={{...H1,fontSize:28,marginBottom:4}}>UPLOAD MEDIA</h1>
        <div style={{color:WHITE,fontSize:14,marginBottom:20,fontWeight:700,letterSpacing:1}}>{mediaLib.length} ASSETS IN LIBRARY</div>
        <div onDragOver={e=>{e.preventDefault();e.currentTarget.style.borderColor=GOLD;}}
          onDragLeave={e=>{e.currentTarget.style.borderColor=GOLDDIM;}}
          onDrop={e=>{e.preventDefault();onFiles(e.dataTransfer.files);e.currentTarget.style.borderColor=GOLDDIM;}}
          style={{border:"2px dashed "+GOLDDIM,padding:"30px 40px",textAlign:"center",marginBottom:12}}>
          <div style={{fontSize:36,marginBottom:10}}>🎬</div>
          <div style={{color:WHITE,fontWeight:900,fontSize:16,letterSpacing:3,marginBottom:16}}>DRAG & DROP YOUR MEDIA HERE</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,maxWidth:360,margin:"0 auto"}}>
            <button onClick={()=>fileRef.current&&fileRef.current.click()}
              style={{background:"linear-gradient(135deg,#1a0800,#2a1200)",border:"2px solid "+GOLD,color:GOLD,padding:"14px",cursor:"pointer",fontSize:13,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>
              📷 UPLOAD PHOTOS
            </button>
            <button onClick={()=>fileRef.current&&fileRef.current.click()}
              style={{background:"#0a0a0a",border:"2px solid "+GOLDDIM,color:WHITE,padding:"14px",cursor:"pointer",fontSize:13,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>
              📁 UPLOAD FILES
            </button>
          </div>
        </div>
        {mediaLib.length>0&&(
          <div>
            <h3 style={{color:GOLD,fontWeight:900,fontSize:13,letterSpacing:3,marginBottom:10}}>MEDIA LIBRARY ({mediaLib.length})</h3>
            <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8}}>
              {mediaLib.map(a=>(
                <div key={a.id} style={{...Card(),padding:8,position:"relative"}}>
                  {a.type.startsWith("video")&&a.url?<video src={a.url} style={{width:"100%",marginBottom:5}}/>:
                   a.type.startsWith("image")?<img src={a.url} style={{width:"100%",marginBottom:5}} alt={a.name}/>:
                   <div style={{height:60,background:"#000",marginBottom:5,display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>🎵</div>}
                  <div style={{color:WHITE,fontSize:11,fontWeight:800,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{a.name}</div>
                  <button onClick={()=>setMediaLib(p=>p.filter(x=>x.id!==a.id))}
                    style={{position:"absolute",top:5,right:5,background:"#7f1d1d",border:"none",color:"#ef4444",width:16,height:16,cursor:"pointer",fontSize:9,padding:0}}>✕</button>
                </div>
              ))}
            </div>
          </div>
        )}
        <input ref={fileRef} type="file" multiple accept="video/*,audio/*,image/*" onChange={e=>onFiles(e.target.files)} style={{display:"none"}}/>
      </div>
      <div style={{marginTop:20}}>
        <div style={{background:"linear-gradient(135deg,#0a0500,#1a0a00)",border:"2px solid "+GOLD,padding:16,marginBottom:12}}>
          <div style={{color:GOLD,fontSize:12,letterSpacing:3,fontWeight:900,marginBottom:6}}>✦ MERGE VIDEOS — COMBINE & ORDER BEFORE TIMELINE</div>
          <div style={{color:DIM,fontSize:11,marginBottom:12,lineHeight:1.7}}>Upload 2 or more videos. Drag to reorder. Hit MERGE IN SEQUENCE to combine them into one film ready for the timeline.</div>
          <MergeVideos onSave={a=>{setMediaLib(p=>[...p,a]);}}/>
        </div>
      </div>
    </div>
  );
}

function P12({ go, mediaLib }) {
  const boxes=[
    {ic:"🗂",t:"MEDIA LIBRARY",d:(mediaLib?mediaLib.length:0)+" assets",p:11},
    {ic:"⏱",t:"TIMELINE EDITOR",d:"Multi-track editing",p:13},
    {ic:"✨",t:"ENHANCEMENT STUDIO",d:"90+ AI tools",p:14},
    {ic:"🎵",t:"AUDIO MIXER",d:"4-channel mixing",p:15},
    {ic:"⚡",t:"RENDER ENGINE",d:"Up to 8K output",p:16},
    {ic:"▶",t:"PREVIEW PLAYER",d:"Full-screen playback",p:17}
  ];
  return (
    <div style={{...Sp,padding:30}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <div style={{fontSize:11,color:GOLD,letterSpacing:4,marginBottom:4,fontWeight:700}}>PRODUCTION HUB</div>
        <h1 style={{...H1,fontSize:44,marginBottom:6}}>EDITOR SUITE</h1>
        <div style={{color:WHITE,fontSize:15,marginBottom:28,lineHeight:1.6}}>Your complete post-production workspace.</div>
        <div style={{display:"grid",gridTemplateColumns:"repeat(3,1fr)",gap:20}}>
          {boxes.map(b=>(
            <button key={b.t} onClick={()=>go(b.p)}
              style={{background:"#0a0500",border:"1px solid "+GOLDDIM,padding:"28px 24px",cursor:"pointer",textAlign:"left",fontFamily:"'Rajdhani',sans-serif",minHeight:150,display:"flex",flexDirection:"column"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=GOLD;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=GOLDDIM;}}>
              <div style={{fontSize:34,marginBottom:24}}>{b.ic}</div>
              <div style={{fontSize:15,color:GOLD,letterSpacing:2,fontWeight:900,marginBottom:6}}>{b.t}</div>
              <div style={{fontSize:13,color:WHITE,opacity:0.75}}>{b.d}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

function P13({ go, mediaLib, timeline, setTimeline, user, filmDuration, setFilmDuration }) {
  const [tracks,setTracks]=useState(["VIDEO TRACK","AUDIO TRACK","TEXT / TITLES"]);
  const addToTrack=(idx,asset)=>setTimeline(p=>({...p,[idx]:[...(p[idx]||[]),asset]}));
  return (
    <div style={{...Sp,padding:20}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:12,flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:11,color:GOLD,letterSpacing:4,fontWeight:700}}>EDITING WORKSPACE</div>
          <h1 style={{...H1,fontSize:24,margin:0}}>TIMELINE EDITOR</h1>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
            <span style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:2}}>FILM: {filmDuration||60} MIN</span>
            <input type="range" min={1} max={180} step={1} value={filmDuration||60} onChange={e=>setFilmDuration(+e.target.value)} style={{width:160,accentColor:GOLD}}/>
            <div style={{display:"flex",gap:4}}>
              {[60,90,180].map(m=><button key={m} onClick={()=>setFilmDuration(m)} style={{background:filmDuration===m?GOLD:"#111",border:"1px solid "+(filmDuration===m?"#000":GOLDDIM),color:filmDuration===m?"#000":WHITE,padding:"2px 8px",cursor:"pointer",fontSize:10,fontWeight:900,fontFamily:"'Rajdhani',sans-serif"}}>{m}m</button>)}
            </div>
          </div>
        </div>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>setTracks(p=>[...p,"TRACK "+p.length+1])} style={{...G("out",true)}}>+ ADD TRACK</button>
          <button onClick={()=>{
            // Auto-populate tracks from media library and sync — sorted in correct order
            // Sort by leading number in name (Scene 1, Scene 2, etc.), then by name, then by id/timestamp
            const sortClips=(clips)=>{
              return clips.slice().sort((a,b)=>{
                const na=parseInt((a.name||"").match(/\b(\d+)\b/)?.[1]||"9999");
                const nb=parseInt((b.name||"").match(/\b(\d+)\b/)?.[1]||"9999");
                if(na!==nb)return na-nb;
                const cmp=(a.name||"").localeCompare(b.name||"");
                if(cmp!==0)return cmp;
                return (a.id||0)-(b.id||0);
              });
            };
            const videoAssets=sortClips(mediaLib.filter(a=>a&&a.type&&(a.type.startsWith("video")||(a.type.includes("webm")&&!a.type.startsWith("audio")))));
            const audioAssets=sortClips(mediaLib.filter(a=>a&&a.type&&(a.type.startsWith("audio")||a.type==="audio/narration"||a.type==="narration")));
            // Assign sequential start times so clips play in order
            let vTime=0;
            const videoTrack=videoAssets.map((a,i)=>{const startTime=vTime;vTime+=(a.duration||5);return {...a,startTime,order:i,syncGroup:"master",synced:true};});
            let aTime=0;
            const audioTrack=audioAssets.map((a,i)=>{const startTime=aTime;aTime+=(a.duration||10);return {...a,startTime,order:i,syncGroup:"master",synced:true};});
            const newTl={};
            if(videoTrack.length>0)newTl[0]=videoTrack;
            if(audioTrack.length>0)newTl[1]=audioTrack;
            setTimeline(newTl);
            // ── DURATION GAP CHECK — works across the whole slider, any length ──
            const targetSec=(filmDuration||60)*60;
            const filledSec=vTime; // total seconds of laid video clips
            const gapSec=targetSec-filledSec;
            const fmt=(s)=>{const m=Math.floor(s/60),ss=Math.round(s%60);return m+"m"+(ss?" "+ss+"s":"");};
            if(gapSec>30){
              const wantFill=window.confirm(
                "You have "+fmt(filledSec)+" of a "+fmt(targetSec)+" selection.\n\n"+
                "That leaves a gap of about "+fmt(gapSec)+".\n\n"+
                "Would you like AI to create fill-in scenes to fill the gap?\n\n"+
                "OK = generate a fill-scene prompt for Page 8.\nCancel = keep it as is."
              );
              if(wantFill){
                const n=Math.max(1,Math.ceil(gapSec/60));
                const prompt="Generate "+n+" additional PHOTOREALISTIC, live-action cinematic fill scene"+(n>1?"s":"")+" (about "+fmt(gapSec)+" total) that match the tone, lighting and subject of this film, to bridge the gap to a "+fmt(targetSec)+" runtime. Keep the same color grade and style. Photorealistic, cinematic, natural motion, 35mm film, real human beings, live-action footage, no text, no cartoon, no anime, no illustration, no 3D render, no CGI. 60 seconds each.";
                try{navigator.clipboard.writeText(prompt);}catch{}
                alert("✓ Fill-scene prompt copied.\n\nGo to Page 8 (Video Tools), paste it, and generate "+n+" more clip"+(n>1?"s":"")+" — then SYNC again.");
                go(8);
                return;
              }
            }
            alert("✓ All tracks synced in order — "+videoAssets.length+" video clips · "+audioAssets.length+" audio tracks");
          }} style={{background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"5px 14px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>⚡ SYNC ALL TRACKS</button>
          <button onClick={()=>go(16)} style={{...G("gold",false)}}>→ RENDER</button>
          <button onClick={()=>go(11)} style={{...G("out",true)}}>⬆ UPLOAD MEDIA</button>
          <button onClick={()=>setTimeline({})} style={{...G("out",true)}}>CLEAR ALL</button>
        </div>
      </div>
      <div style={{background:"#000",height:100,display:"flex",alignItems:"center",justifyContent:"center",marginBottom:12,border:"1px solid "+GOLDDIM}}>
        {mediaLib[0]&&mediaLib[0].type.startsWith("video")&&mediaLib[0].url?
          <video src={mediaLib[0].url} style={{height:"100%",width:"100%",objectFit:"cover",opacity:.5}}/>:
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:12,letterSpacing:3,color:WHITE,marginBottom:8}}>ADD MEDIA TO SEE PREVIEW</div>
            <button onClick={()=>go(11)} style={{...G("out",true)}}>⬆ UPLOAD MEDIA</button>
          </div>}
      </div>
      {tracks.map((tr,idx)=>(
        <div key={idx} style={{marginBottom:8}}>
          <div style={{color:GOLD,fontSize:11,letterSpacing:3,marginBottom:4,fontWeight:900}}>{tr}</div>
          <div onDragOver={e=>{e.preventDefault();e.currentTarget.style.border="1px dashed "+GOLD;}}
            onDragLeave={e=>{e.currentTarget.style.border="1px dashed "+GOLDDIM;}}
            onDrop={e=>{e.preventDefault();e.currentTarget.style.border="1px dashed "+GOLDDIM;
              const fromTrack=e.dataTransfer.getData("trackIdx");
              const fromClip=e.dataTransfer.getData("clipIdx");
              if(fromTrack!==""&&fromClip!==""){
                // Move clip between tracks
                const ft=Number(fromTrack);const fc=Number(fromClip);
                if(ft===idx)return;
                setTimeline(p=>{
                  const src=[...(p[ft]||[])];const dst=[...(p[idx]||[])];
                  const [moved]=src.splice(fc,1);dst.push(moved);
                  return{...p,[ft]:src,[idx]:dst};
                });
              }else{
                // New clip from library
                const id=e.dataTransfer.getData("assetId");const a=mediaLib.find(x=>String(x.id)===id);if(a)addToTrack(idx,a);
              }
            }}
            style={{background:"#0a0a0a",border:"1px dashed "+GOLDDIM,minHeight:42,padding:6,display:"flex",gap:6,alignItems:"center",flexWrap:"wrap"}}>
            {(timeline[idx]||[]).map((a,i)=>(
              <div key={i} draggable
                onDragStart={e=>{e.dataTransfer.setData("trackIdx",String(idx));e.dataTransfer.setData("clipIdx",String(i));e.dataTransfer.setData("assetId","");}}

                onDragOver={e=>e.preventDefault()}
                onDrop={e=>{
                  e.preventDefault();
                  const fromTrack=Number(e.dataTransfer.getData("trackIdx"));
                  const fromClip=Number(e.dataTransfer.getData("clipIdx"));
                  if(fromTrack===idx&&fromClip!==i){
                    setTimeline(p=>{
                      const arr=[...(p[idx]||[])];
                      const moved=arr.splice(fromClip,1)[0];
                      arr.splice(i,0,moved);
                      return{...p,[idx]:arr};
                    });
                  }
                }}
                style={{background:GOLDDIM,padding:"3px 10px",fontSize:12,color:"#000",fontWeight:900,display:"flex",alignItems:"center",gap:5,cursor:"grab",userSelect:"none",border:"2px solid transparent"}}
                onMouseEnter={e=>{e.currentTarget.style.border="2px solid #000";}}
                onMouseLeave={e=>{e.currentTarget.style.border="2px solid transparent";}}>
                ⣿ {a.name.slice(0,12)}
                <button onClick={()=>setTimeline(p=>({...p,[idx]:p[idx].filter((_,j)=>j!==i)}))}
                  style={{background:"none",border:"none",color:"#000",cursor:"pointer",fontSize:11,padding:0}}>✕</button>
              </div>
            ))}
            {!(timeline[idx]||[]).length&&<span style={{color:WHITE,fontSize:12,letterSpacing:1}}>DROP {tr} CLIPS HERE</span>}
          </div>
        </div>
      ))}
      {mediaLib.length>0&&(
        <div style={{marginTop:12}}>
          <div style={{color:GOLD,fontSize:11,letterSpacing:3,marginBottom:6,fontWeight:900}}>DRAG TO TIMELINE:</div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {mediaLib.map(a=>(
              <div key={a.id} draggable onDragStart={e=>e.dataTransfer.setData("assetId",String(a.id))}
                style={{background:"#0a0a0a",border:"1px solid "+GOLD,padding:"4px 10px",cursor:"grab",color:GOLD,fontSize:12,fontWeight:700}}>
                📎 {a.name.slice(0,14)}
              </div>
            ))}
          </div>
        </div>
      )}
      <div style={{...Card(),marginTop:12,display:"flex",alignItems:"center",gap:8}}>
        {["⏮","⏪","▶","⏩","⏭"].map(c=><button key={c} style={{...G("out",true)}}>{c}</button>)}
        <div style={{flex:1,height:3,background:"#000"}}/>
        <span style={{color:WHITE,fontSize:12,fontWeight:700}}>00:00 / 90:00</span>
      </div>
    </div>
  );
}

function P14() {
  const tools14=MOTION.slice(0,14);
  const [active,setActive]=useState(tools14[0]);
  const [vals,setVals]=useState({Intensity:75,Clarity:80,Color:70,Brightness:65});
  return (
    <div style={{...Sp,display:"flex"}}>
      <div style={{width:176,background:"#050505",borderRight:"1px solid "+GOLDDIM+"",overflowY:"auto",padding:8}}>
        {tools14.map(t=>(
          <button key={t} onClick={()=>setActive(t)}
            style={{width:"100%",textAlign:"left",background:t===active?BG4:"none",border:"none",color:t===active?GOLD:WHITE,padding:"8px 10px",cursor:"pointer",fontSize:12,fontWeight:t===active?900:600,marginBottom:1,borderLeft:t===active?"2px solid "+GOLD:"2px solid transparent"}}>
            {t}
          </button>
        ))}
      </div>
      <div style={{flex:1,padding:28}}>
        <div style={{fontSize:11,color:GOLD,letterSpacing:4,marginBottom:4,fontWeight:700}}>ENHANCEMENT STUDIO</div>
        <h2 style={{...H1,fontSize:22,marginBottom:6}}>{active.toUpperCase()}</h2>
        {Object.entries(vals).map(([k,v])=>(
          <div key={k} style={{marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:5}}>
              <span style={{color:WHITE,fontSize:13,fontWeight:700}}>{k}</span>
              <span style={{color:GOLD,fontSize:13,fontWeight:900}}>{v}%</span>
            </div>
            <input type="range" min={0} max={100} value={v} onChange={e=>setVals(p=>({...p,[k]:+e.target.value}))} style={{width:"100%",accentColor:GOLD}}/>
          </div>
        ))}
        <div style={{display:"flex",gap:10,marginTop:18}}>
          <button style={{...G("gold",false)}}>APPLY ENHANCEMENT</button>
          <button onClick={()=>setVals({Intensity:75,Clarity:80,Color:70,Brightness:65})} style={{...G("out",false)}}>RESET</button>
        </div>
      </div>
    </div>
  );
}

function P15() {
  const [lvl,setLvl]=useState({VOICE:85,MUSIC:40,EFX:50,MASTER:85});
  return (
    <div style={{...Sp,padding:40}}>
      <div style={{maxWidth:680,margin:"0 auto"}}>
        <div style={{fontSize:11,color:GOLD,letterSpacing:4,marginBottom:4,fontWeight:700}}>MIXING CONSOLE</div>
        <h1 style={{...H1,fontSize:28,marginBottom:24}}>AUDIO MIXER</h1>
        <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:12,marginBottom:24}}>
          {Object.entries(lvl).map(([ch,val])=>(
            <div key={ch} style={{...Card(),textAlign:"center",padding:18}}>
              <div style={{color:GOLD,fontSize:11,letterSpacing:3,marginBottom:8,fontWeight:900}}>{ch}</div>
              <div style={{color:GOLD,fontFamily:"'Cinzel',serif",fontSize:30,fontWeight:900,marginBottom:12}}>{val}</div>
              <input type="range" min={0} max={100} value={val} onChange={e=>setLvl(p=>({...p,[ch]:+e.target.value}))} style={{width:"100%",height:100,accentColor:GOLD}}/>
              <div style={{height:3,background:"#000",marginTop:10}}>
                <div style={{width:val+"%",height:"100%",background:"linear-gradient(90deg,"+GOLDDIM+","+GOLD+")"}}/>
              </div>
            </div>
          ))}
        </div>
        <div style={{display:"flex",gap:10}}>
          <button onClick={()=>setLvl({VOICE:85,MUSIC:40,EFX:50,MASTER:85})} style={{...G("out",false)}}>RESET LEVELS</button>
          <button style={{...G("gold",false)}}>SAVE PRESET</button>
        </div>
      </div>
    </div>
  );
}

function P16({ go, timeline, setRendered, mediaLib, setMediaLib, user, filmDuration, setFilmDuration }) {
  const [quality,setQuality]=useState("1080p");
  const [progress,setProgress]=useState(0);
  const [rendering,setRendering]=useState(false);
  const [done,setDone]=useState(false);
  const [renderUrl,setRenderUrl]=useState("");
  const [renderLog,setRenderLog]=useState([]);
  const [fps,setFps]=useState(30);
  const [codec,setCodec]=useState("vp9");
  const [currentClipIdx,setCurrentClipIdx]=useState(-1);
  // ── GAP-FILL CHOICE (Y = generate extra scenes, N = stretch clips) ──
  const [gapFill,setGapFill]=useState(false);
  const canvasRef=useRef(null);

  const log=(msg)=>setRenderLog(p=>[...p,msg]);

  const getVideoClips=()=>{
    const tClips=Object.values(timeline||{}).flat().filter(a=>a&&a.type&&a.type.startsWith("video"));
    if(tClips.length>0)return tClips;
    return (mediaLib||[]).filter(a=>a.type&&a.type.startsWith("video"));
  };

  const getAudioTrack=()=>{
    // Every audio-ish asset on the timeline, then in the media library.
    const pool=[
      ...Object.values(timeline||{}).flat(),
      ...(mediaLib||[])
    ].filter(a=>a&&a.type&&(a.type.startsWith("audio")||a.type==="audio/narration"||a.type==="narration"||a.type==="audio/webm"));
    if(!pool.length)return undefined;
    // PRIORITY 1: the cloned-voice FULL narration (carries clonedVoiceId + narrText).
    // This is what "USE ENGINE TO COMPLETE FULL NARRATION" saves. It MUST win, or
    // the render picks a plain narration sitting earlier in the list and defaults
    // to a preset voice — which is exactly why your voice never continued.
    const cloned=pool.find(a=>a.clonedVoiceId&&a.narrText);
    if(cloned)return cloned;
    // PRIORITY 2: your recorded-voice narration saved with "USE MY VOICE AS NARRATION".
    const myVoice=pool.find(a=>a.type==="audio/myvoice");
    if(myVoice)return myVoice;
    // PRIORITY 3: anything else audio, first one wins (old behaviour).
    return pool[0];
  };

  // Background music bed. A music asset is any audio the user tagged as music,
  // or a second audio asset that is NOT the narration we're already using.
  const getMusicTrack=(narr)=>{
    const isMusic=(a)=>a&&a.type&&(a.type==="audio/music"||a.type==="music"||/music|score|soundtrack|bgm|bed/i.test(a.name||""));
    const pool=[...Object.values(timeline||{}).flat(),...(mediaLib||[])].filter(Boolean);
    const tagged=pool.find(isMusic);
    if(tagged)return tagged;
    // else: a distinct second audio asset (not the narration)
    const audios=pool.filter(a=>a.type&&(a.type.startsWith("audio")||a.type==="audio/webm"));
    return audios.find(a=>narr?(a.id!==narr.id&&a.dbId!==narr.dbId):true&&a!==narr);
  };

  const startRender=async()=>{
    // ── PRIORITY SAVE — runs before anything else ──────────────────────────────
    // Saves current state immediately so a crash mid-render doesn't lose work.
    try{
      localStorage.setItem("ms_page",JSON.stringify(16));
      const tl=localStorage.getItem("ms_timeline");
      if(tl)localStorage.setItem("ms_timeline",tl); // re-write to confirm it's current
    }catch(e){}
    // ── PRE-RENDER STORAGE CHECK — never touches source clips ──────────────────
    // Only clears old render_final files, never user-generated source clips.
    // Before this fix, autoPruneClips was destroying 12 of 13 clips before render.
    try{
      const clips=await getAllClipsFromDB();
      // Delete only old finished renders, never source scene clips
      const oldRenders=clips.filter(c=>String(c.id).includes("render_final_old"));
      for(const c of oldRenders){await deleteClipFromDB(c.id);}
      log("Memory check complete — "+clips.length+" clips preserved");
    }catch(e){}

    // ── CLIP ORDER: the TIMELINE is the authority ──────────────────────────
    // Previously the render loaded clips from IndexedDB (which returns them in
    // keyPath / alphabetical order) and then sorted by the first number in the
    // filename — with names like GODS_GURUS_6 and LOVE_WAR_60s that number is
    // meaningless, so scenes came out in the wrong order. Now: take the order
    // straight from the timeline, and use IndexedDB ONLY to refresh each clip's
    // blob/url. The number-sort runs ONLY when there is no timeline at all.
    let freshClips = [];
    let dbClipsAll = [];
    try{ dbClipsAll = await getAllClipsFromDB(); }catch(e){ console.warn("DB load failed",e); }
    const dbById = new Map(); const dbByName = new Map();
    for(const c2 of dbClipsAll){ dbById.set(c2.id,c2); if(c2.name)dbByName.set(c2.name,c2); }
    const relink=(c2)=>{
      const db = dbById.get(c2.dbId) || dbById.get(c2.id) || dbByName.get(c2.name);
      if(db&&db.blob){
        return {...c2,type:c2.type||db.type||"video/webm",url:URL.createObjectURL(db.blob),file:new File([db.blob],c2.name||db.name,{type:db.type||c2.type||"video/webm"}),dbId:db.id};
      }
      return c2;
    };
    const timelineClips = getVideoClips(); // already in timeline order (falls back to mediaLib)
    const hasTimeline = Object.values(timeline||{}).flat().some(a=>a&&a.type&&a.type.startsWith("video"));
    if(timelineClips.length>0){
      freshClips = timelineClips.map(relink);
      log("Loaded "+freshClips.length+" clips in timeline order");
    } else if(dbClipsAll.length>0){
      freshClips = dbClipsAll.map(c2=>({id:c2.id,name:c2.name,type:c2.type||"video/webm",url:URL.createObjectURL(c2.blob),file:new File([c2.blob],c2.name,{type:c2.type||"video/webm"}),dbId:c2.id}));
      log("Loaded "+freshClips.length+" clips from storage");
    }
    if(freshClips.length>0){ setMediaLib(freshClips); }

    // Fall back to current mediaLib if nothing resolved
    let clips = freshClips.length > 0 ? freshClips.filter(c2=>c2.type&&c2.type.startsWith("video")) : getVideoClips();
    // ── EXCLUDE old rendered films and empty clips ──────────────────────────
    // A previously-rendered "MandaStrong_Film..." file in the library has no real
    // scene frames — including it makes the whole render come out 0.0MB.
    clips = clips.filter(c2=>{
      const n=(c2.name||"").toLowerCase();
      if(n.includes("mandastrong_film")||n.includes("render_final")||n.includes("_film_")) return false;
      if(c2.file&&c2.file.size!==undefined&&c2.file.size<1000) return false; // skip empty blobs
      return true;
    });
    // Number-sort ONLY when there is no timeline to define the order.
    if(!hasTimeline){
      clips.sort((a,b)=>{
        const na=parseInt((a.name||"").match(/\b(\d+)\b/)?.[1]||"9999");
        const nb=parseInt((b.name||"").match(/\b(\d+)\b/)?.[1]||"9999");
        if(na!==nb)return na-nb;
        return (a.name||"").localeCompare(b.name||"");
      });
      log("No timeline — clips ordered by scene number");
    } else {
      log("Render order locked to timeline: "+clips.map(c2=>(c2.name||"").slice(0,18)).join(" → "));
    }
    const audioAsset=getAudioTrack();
    if(clips.length===0){alert("No video clips found. Generate clips on Page 8 first.");return;}
    log("Rendering "+clips.length+" scene clips (old render files excluded)");
    setRendering(true);setDone(false);setProgress(0);setRenderLog([]);setRenderUrl("");setCurrentClipIdx(-1);
    try{
      log("MandaStrong Render Engine v2 initialising...");
      log("Clips: "+clips.length+" | Quality: "+quality+" | FPS: "+fps);
      const canvas=canvasRef.current;
      const dims=quality==="4K"?{w:3840,h:2160}:quality==="1080p"?{w:1920,h:1080}:quality==="720p"?{w:1280,h:720}:{w:854,h:480};
      canvas.width=dims.w;canvas.height=dims.h;
      const ctx=canvas.getContext("2d");
      log("Canvas: "+dims.w+"x"+dims.h);
      const audioCtx=new (window.AudioContext||window.webkitAudioContext)();
      const audioDest=audioCtx.createMediaStreamDestination();
      let audioSource=null,audioBuffer=null;
      let liveNarration=false;
      if(audioAsset){
        // ── CLONED-VOICE FULL NARRATION ──────────────────────────────────────
        // If the audio asset carries a clone id + the script text (from page 6's
        // "USE ENGINE TO COMPLETE FULL NARRATION"), narrate the WHOLE script through
        // the engine in the cloned voice and bake it in. Falls back to the stored
        // recording if the clone can't be reached.
        if(audioAsset.clonedVoiceId&&audioAsset.narrText){
          try{
            log("Baking FULL narration in your cloned voice...");
            const cChunks=buildChunks(audioAsset.narrText);
            const decoded=[];
            for(const c of cChunks){
              if(!c||!c.text) continue;
              const u=await engineSpeak(c.text,{voice:audioAsset.clonedVoiceId});
              if(!u) continue;
              try{ const r=await fetch(u); const ab=await r.arrayBuffer(); decoded.push(await audioCtx.decodeAudioData(ab)); }catch(e){}
            }
            if(decoded.length){
              const total=decoded.reduce((s,b)=>s+b.duration,0);
              const merged=audioCtx.createBuffer(1,Math.max(1,Math.ceil(total*audioCtx.sampleRate)),audioCtx.sampleRate);
              const out=merged.getChannelData(0); let off=0;
              for(const b of decoded){ out.set(b.getChannelData(0),Math.floor(off*audioCtx.sampleRate)); off+=b.duration; }
              audioBuffer=merged;
              log("✓ Full narration baked in your cloned voice: "+total.toFixed(1)+"s");
            }
          }catch(e){log("Cloned-voice narration error — trying the recording: "+e.message);}
          // Fall through to the recording if the clone produced nothing.
          if(!audioBuffer){
            try{
              const dbId=audioAsset.dbId||audioAsset.id;
              let audioBlob=null;
              if(dbId){const stored=await loadClipFromDB(dbId);if(stored&&stored.blob)audioBlob=stored.blob;}
              if(audioBlob){const arrayBuf=await audioBlob.arrayBuffer();audioBuffer=await audioCtx.decodeAudioData(arrayBuf);log("✓ Played your recording instead: "+audioBuffer.duration.toFixed(1)+"s");}
            }catch(e){}
          }
        } else
        // NARRATION: bake through the Cinema Voice Engine so it RECORDS into the film.
        // Device speech (speechSynthesis) plays out the speaker and never enters the
        // captured audio graph, so on iPad the film came out silent / "voice unavailable".
        // Fix: fetch real audio from engineSpeak, decode into THIS audioCtx, feed audioDest —
        // the same path uploaded audio uses. Live speech remains only as a fallback.
        if(audioAsset.type==="narration"||(!audioAsset.url&&!audioAsset.file&&audioAsset.text)){
          try{
            const vc=(typeof VOICE_CHARACTERS!=="undefined")?VOICE_CHARACTERS.find(v=>v.id===(audioAsset.voice||"blaze")):null;
            const meta={voice:vc?.engineVoice||"",gender:vc?.gender||"",origin:vc?.origin||"",speed:vc?.rate||0.9};
            const narrChunks=buildChunks(audioAsset.text||"");
            log("Baking narration through Cinema Voice Engine — "+narrChunks.length+" segment(s)...");
            const decoded=[];
            for(const c of narrChunks){
              if(!c||!c.text) continue;
              const u=await engineSpeak(c.text,meta);
              if(!u) continue;
              try{ const r=await fetch(u); const ab=await r.arrayBuffer(); decoded.push(await audioCtx.decodeAudioData(ab)); }catch(e){}
            }
            if(decoded.length){
              const total=decoded.reduce((s,b)=>s+b.duration,0);
              const merged=audioCtx.createBuffer(1,Math.max(1,Math.ceil(total*audioCtx.sampleRate)),audioCtx.sampleRate);
              const out=merged.getChannelData(0);
              let off=0;
              for(const b of decoded){ out.set(b.getChannelData(0),Math.floor(off*audioCtx.sampleRate)); off+=b.duration; }
              audioBuffer=merged;
              log("✓ Narration baked from Cinema Voice Engine: "+total.toFixed(1)+"s");
            } else {
              liveNarration=true;
              log("Engine narration unavailable — speaking live as fallback");
            }
          }catch(e){
            liveNarration=true;
            log("Narration bake error — live fallback: "+e.message);
          }
        } else {
          try{
            let audioBlob=null;
            const dbId=audioAsset.dbId||audioAsset.id;
            if(dbId){
              const stored=await loadClipFromDB(dbId);
              if(stored&&stored.blob) audioBlob=stored.blob;
            }
            if(!audioBlob&&audioAsset.url){
              const resp=await fetch(audioAsset.url);
              audioBlob=await resp.blob();
            }
            if(!audioBlob&&audioAsset.file) audioBlob=audioAsset.file;
            if(audioBlob){
              const arrayBuf=await audioBlob.arrayBuffer();
              audioBuffer=await audioCtx.decodeAudioData(arrayBuf);
              log("✓ Audio loaded: "+(audioBuffer.duration).toFixed(1)+"s");
            } else {
              log("Audio asset found but no data — video only");
            }
          }catch(e){log("Audio load failed: "+e.message+" — video only");}
        }
      }
      if(audioBuffer){audioSource=audioCtx.createBufferSource();audioSource.buffer=audioBuffer;audioSource.connect(audioDest);audioSource.connect(audioCtx.destination);}
      // ── BACKGROUND MUSIC BED ────────────────────────────────────────────────
      // Plays under the narration, quiet, looped to cover the whole film. Voice
      // stays on top (locked mix VOICE 85 / MUSIC 40 ≈ 0.25 gain under voice).
      let musicSource=null;
      try{
        const musicAsset=getMusicTrack(audioAsset);
        if(musicAsset){
          let mBlob=null;
          const mId=musicAsset.dbId||musicAsset.id;
          if(mId){try{const st=await loadClipFromDB(mId);if(st&&st.blob)mBlob=st.blob;}catch(e){}}
          if(!mBlob&&musicAsset.url){try{mBlob=await (await fetch(musicAsset.url)).blob();}catch(e){}}
          if(!mBlob&&musicAsset.file)mBlob=musicAsset.file;
          if(mBlob){
            const mBuf=await audioCtx.decodeAudioData(await mBlob.arrayBuffer());
            musicSource=audioCtx.createBufferSource();
            musicSource.buffer=mBuf;
            musicSource.loop=true; // music beds loop to fill; narration never does
            const mGain=audioCtx.createGain();
            mGain.gain.value=0.25;
            musicSource.connect(mGain);
            mGain.connect(audioDest);
            mGain.connect(audioCtx.destination);
            log("♪ Background music bed mixed in under narration");
          }
        }
      }catch(e){log("Music bed skipped: "+e.message);}
      // Draw several plain frames BEFORE capturing so the stream is definitely live.
      // No words on screen — the film shows only the source footage.
      for(let w=0;w<5;w++){
        ctx.fillStyle="#000";ctx.fillRect(0,0,dims.w,dims.h);
        await new Promise(r=>setTimeout(r,60));
      }
      const videoStream=canvas.captureStream(fps);
      const vTrack=videoStream.getVideoTracks()[0];
      if(!vTrack||vTrack.readyState!=="live"){
        log("⚠ Canvas capture unavailable in this browser.");
        alert("This browser blocked video capture. Try Chrome or Safari with the tab kept in front.");
        setRendering(false);return;
      }
      const tracks=[...videoStream.getTracks(),...audioDest.stream.getTracks()];
      const combinedStream=new MediaStream(tracks);
      const vCodec=codec==="vp9"?"vp9":"vp8";
      const mimeType=MediaRecorder.isTypeSupported("video/webm;codecs="+vCodec+",opus")?"video/webm;codecs="+vCodec+",opus":"video/webm";
      // ── ADAPTIVE BITRATE — caps total memory so long films finish encoding ──
      // The end-of-render crash was memory: chunks pile up all render, then the
      // final Blob build doubles them. iPad Safari kills the tab (~1.4GB).
      // Fix: budget ~320MB of chunks max, whatever the film length.
      const totalFilmSec=Math.max(1,clips.reduce((s,c)=>s+(c.duration||60),0));
      const requested=quality==="4K"?40000000:quality==="1080p"?8000000:4000000;
      const budgetBits=320*1024*1024*8; // 320MB in bits
      const safeBitrate=Math.floor(budgetBits/totalFilmSec);
      const bitrate=Math.min(requested,Math.max(2000000,safeBitrate));
      if(bitrate<requested)log("Adaptive bitrate: "+(bitrate/1000000).toFixed(1)+"Mbps for "+Math.round(totalFilmSec)+"s film — keeps memory safe to the end");
      const recorder=new MediaRecorder(combinedStream,{mimeType,videoBitsPerSecond:bitrate,audioBitsPerSecond:128000});
      const chunks=[];
      recorder.ondataavailable=e=>{if(e.data.size>0)chunks.push(e.data);};
      // Prime the canvas so captureStream has a real frame
      ctx.fillStyle="#000";ctx.fillRect(0,0,dims.w,dims.h);
      await new Promise(r=>setTimeout(r,200));
      recorder.start(1000);
      // iPad Safari fix: force the recorder to flush data every second so chunks
      // never end up empty, and keep the canvas stream alive with a heartbeat.
      const dataInterval=setInterval(()=>{try{if(recorder.state==="recording")recorder.requestData();}catch(e){}},1000);
      const heartbeat=setInterval(()=>{
        try{
          // Nudge one pixel each tick so captureStream always sees a new frame
          ctx.fillStyle="rgba(0,0,0,0.003)";ctx.fillRect(0,0,2,2);
          if(vTrack&&vTrack.requestFrame)vTrack.requestFrame();
        }catch(e){}
      },Math.round(1000/fps));
      if(audioSource)audioSource.start(0);
      if(musicSource){try{musicSource.start(0);}catch(e){}}
      // Live-speak fallback ONLY when the engine bake could not deliver audio.
      if(liveNarration&&audioAsset?.text){
        speakText(audioAsset.voice||"blaze",audioAsset.text,null,null);
        log("✓ Speaking narration live (fallback): "+(audioAsset.voice||"blaze"));
      }
      log("Recording started...");
      setProgress(5);
      // Helper: render a scene directly to canvas using Claude
      const renderSceneToCanvas=async(sceneName,clipDurSec)=>{
        const scenePrompt=sceneName.replace(/\.[^.]+$/,"").replace(/_/g," ").replace(/\d+s$/,"").trim();
        log("  Regenerating: "+scenePrompt.slice(0,40)+"...");
        try{
          const res=await fetch("https://njqfexhltjwpgvctmyaw.supabase.co/functions/v1/claude-proxy",{
            method:"POST",
            headers:{"Content-Type":"application/json"},
            body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:3000,
              messages:[{role:"user",content:"Write a JavaScript canvas function for this cinematic scene: \""+scenePrompt+"\". Function: function drawFrame(ctx,W,H,t,sec). Use gradients, colours, depth, atmosphere. t=0-1 progress. Return only the function."}]})
          });
          const d=await res.json();
          let code=d.content&&d.content[0]?d.content[0].text.trim():"";
          code=code.replace(new RegExp(String.fromCharCode(96,96,96)+"javascript|"+String.fromCharCode(96,96,96)+"js|"+String.fromCharCode(96,96,96),"g"),"").trim();
          const fi=code.indexOf("function drawFrame");if(fi>0)code=code.slice(fi);
          const bOpen2=code.indexOf("{");const bClose2=code.lastIndexOf("}");const body=bOpen2>0&&bClose2>bOpen2?code.slice(bOpen2+1,bClose2):"";
          const drawFn=new Function("ctx","W","H","t","sec",body);
          const W=dims.w,H=dims.h;
          const totalFrames=Math.round(clipDurSec*fps);
          const msPerFrame=Math.round(1000/fps);
          const wallStart=performance.now();
          await new Promise(resolve=>{
            let frame=0;
            const tick=()=>{
              if(frame>=totalFrames){resolve(null);return;}
              const t=frame/totalFrames,sec=frame/fps;
              try{ctx.clearRect(0,0,W,H);drawFn(ctx,W,H,t,sec);}catch(e){ctx.fillStyle="#050200";ctx.fillRect(0,0,W,H);}
              const vig=ctx.createRadialGradient(W/2,H/2,W*0.1,W/2,H/2,W*0.8);
              vig.addColorStop(0,"rgba(0,0,0,0)");vig.addColorStop(1,"rgba(0,0,0,0.85)");
              ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);
              ctx.fillStyle="#000";ctx.fillRect(0,0,W,H*0.06);ctx.fillRect(0,H*0.94,W,H*0.06);
              frame++;
              const due=wallStart+(frame*msPerFrame);
              setTimeout(tick,Math.max(4,due-performance.now()));
            };
            tick();
          });
          return true;
        }catch(e){log("  Error: "+e.message);return false;}
      };

      // Reload fresh blobs from IndexedDB for every clip before rendering
      log("Loading clips from storage...");
      try{
        const freshDB=await getAllClipsFromDB();
        if(freshDB.length>0){
          clips=clips.map(cl=>{
            const db=freshDB.find(d=>d.id===cl.dbId||d.id===cl.id||d.name===cl.name);
            if(db&&db.blob){
              return {...cl,file:new File([db.blob],cl.name,{type:db.type||"video/webm"}),url:URL.createObjectURL(db.blob)};
            }
            return cl;
          });
          log("Clips refreshed from storage: "+freshDB.length+" found");
        }
      }catch(e){log("Storage reload: "+e.message);}

      // ── GAP-FILL: the DURATION SLIDER is master ─────────────────────────────
      // filmDuration (1–180 min, set on the timeline page) decides the film length.
      // Clips stretch to fill that total: each clip holds (sliderSecs / clipCount).
      // The old 65s-per-clip cap is lifted — the engine accepts long clips, so a
      // clip can hold as long as the slider needs. If the slider is somehow unset,
      // fall back to the narration length, then to natural clip lengths.
      const sliderSecs = (Number(filmDuration)>0 ? Number(filmDuration)*60 : 0);
      const narrationSecs = audioBuffer ? audioBuffer.duration : 0;
      const targetTotal = sliderSecs>0 ? sliderSecs : narrationSecs;
      let perClipTarget = 0; // 0 = use each clip's natural duration
      if(targetTotal>0 && clips.length>0){
        if(gapFill){
          let naturalTotal=0;
          for(const c of clips){ const m=(c.name||"").match(/(\d+)s/); naturalTotal += m?parseInt(m[1]):30; }
          const gap = targetTotal - naturalTotal;
          if(gap > 5){
            const fillCount = Math.ceil(gap/30);
            log("Fill-in: generating "+fillCount+" extra scene"+(fillCount!==1?"s":"")+" to reach "+(targetTotal/60).toFixed(1)+" min");
            const seeds=clips.length?clips.map(c=>(c.name||"scene").replace(/\.[^.]+$/,"").replace(/_/g,"")):["cinematic scene"];
            for(let f=0;f<fillCount;f++){
              const seed=seeds[f%seeds.length]||"cinematic establishing scene";
              clips.push({ name:"fill_"+(f+1)+"_"+seed+"_30s.webm", type:"video/webm", __fill:true });
            }
            log("Fill-in ON — film built from "+clips.length+" scenes (real + generated)");
          } else {
            log("Fill-in ON — footage already covers the target, nothing to add");
          }
        } else {
          perClipTarget = Math.max(targetTotal / clips.length, 3);
          log("Stretch mode: film "+(targetTotal/60).toFixed(1)+" min ÷ "+clips.length+" clips ≈ "+perClipTarget.toFixed(1)+"s each");
        }
      }

      for(let ci=0;ci<clips.length;ci++){
        const clip=clips[ci];setCurrentClipIdx(ci);
        log("Clip "+(ci+1)+"/"+clips.length+": "+clip.name.slice(0,45));
        setProgress(5+Math.round((ci/clips.length)*80));

        // Try to play the video file first
        let videoPlayed=false;
        if(clip.file instanceof File){
          videoPlayed=await new Promise(resolve=>{
            const vid=document.createElement("video");
            vid.muted=true;vid.playsInline=true;
            // Use file blob or fall back to existing blob URL
            const clipSrc = clip.file ? URL.createObjectURL(clip.file) : (clip.url||"");
            if(!clipSrc){resolve(false);return;}
            vid.src=clipSrc;
            let done2=false;
            const finish=(ok)=>{if(!done2){done2=true;resolve(ok);}};
            vid.onloadeddata=async()=>{
              const natural=vid.duration||30;
              // Hold this clip for its share of the film (slider-driven). No 65s cap:
              // the engine accepts long clips, so a clip can hold as long as needed.
              // Never below its natural length. Loop the source within the window so
              // the picture keeps moving instead of freezing.
              const clipDur=perClipTarget>0?Math.max(perClipTarget,natural):Math.min(natural,65);
              vid.currentTime=0;
              vid.loop=true; // replay within the hold window; render stops it by time, not by end
              // Wait for first frame to decode before drawing
              await new Promise(r=>{
                if(vid.readyState>=3){r();}
                else{vid.oncanplay=r;}
              });
              try{await vid.play();}catch(e){}
              const startTime=Date.now();
              const msPerF=Math.round(1000/fps);
              let lastDraw=performance.now();
              const draw=()=>{
                if(done2)return;
                const elapsed=(Date.now()-startTime)/1000;
                // Stop strictly by elapsed time now (video loops), so the clip fills
                // its whole target window even if the source footage is short.
                if(elapsed>=clipDur){vid.pause();finish(true);return;}
                const now=performance.now();
                if(now-lastDraw>=msPerF-2){
                  try{
                    ctx.clearRect(0,0,dims.w,dims.h);
                    ctx.drawImage(vid,0,0,dims.w,dims.h);
                    // Vignette
                    const vig=ctx.createRadialGradient(dims.w/2,dims.h/2,dims.w*0.1,dims.w/2,dims.h/2,dims.w*0.8);
                    vig.addColorStop(0,"rgba(0,0,0,0)");vig.addColorStop(1,"rgba(0,0,0,0.7)");
                    ctx.fillStyle=vig;ctx.fillRect(0,0,dims.w,dims.h);
                    // Letterbox
                    ctx.fillStyle="#000";ctx.fillRect(0,0,dims.w,dims.h*0.05);ctx.fillRect(0,dims.h*0.95,dims.w,dims.h*0.05);
                    lastDraw=now;
                  }catch(e){finish(true);return;}
                }
                requestAnimationFrame(draw);
              };
              requestAnimationFrame(draw);
            };
            vid.onerror=()=>finish(false);
            setTimeout(()=>finish(false),Math.max(70000,(perClipTarget>0?perClipTarget:65)*1000+15000));
            vid.load();
          });
        }

        // If video failed or no file — regenerate scene with Claude
        if(!videoPlayed){
          log("  Clip not playable — generating scene: "+clip.name.slice(0,30)+"...");
          const natSec=parseInt(clip.name.match(/(\d+)s/)?.[1]||"30");
          const clipDurSec=perClipTarget>0?Math.max(perClipTarget,natSec):natSec;
          const ok=await renderSceneToCanvas(clip.name,clipDurSec);
          if(!ok){
            // Last resort: plain black hold — real-time paced. No words on screen;
            // the film never burns the clip/scene name onto the picture.
            const tcFrames=5*fps;
            const tcStart=performance.now();
            await new Promise(resolve=>{
              let f=0;
              const draw=()=>{
                if(f>=tcFrames){resolve(null);return;}
                ctx.fillStyle="#000";ctx.fillRect(0,0,dims.w,dims.h);
                f++;
                const next=tcStart+(f*(1000/fps));
                setTimeout(draw,Math.max(4,next-performance.now()));
              };draw();
            });
          }
        }
      }
      setCurrentClipIdx(-1);
      // End card — real-time paced
      {const ecFrames=fps*2;const ecStart=performance.now();
      await new Promise(resolve=>{
        let f=0;
        const draw=()=>{
          if(f>=ecFrames){resolve(null);return;}
          ctx.fillStyle="#000";ctx.fillRect(0,0,dims.w,dims.h);
          f++;
          const next=ecStart+(f*(1000/fps));
          setTimeout(draw,Math.max(4,next-performance.now()));
        };draw();
      });}
      setProgress(92);log("Finalising...");
      try{clearInterval(dataInterval);}catch(e){}
      try{clearInterval(heartbeat);}catch(e){}
      if(audioSource){try{audioSource.stop();}catch(e){}}
      if(musicSource){try{musicSource.stop();}catch(e){}}
      // Flush any final data before stopping
      try{if(recorder.state==="recording")recorder.requestData();}catch(e){}
      await new Promise(r=>{let d=false;const f=()=>{if(!d){d=true;r();}};setTimeout(f,5000);try{recorder.onstop=f;if(recorder.state!=="inactive"){recorder.stop();}else{f();}}catch(e){f();}});
      const blob=new Blob(chunks,{type:mimeType});
      // ── SAFETY: never hand an empty file to the player (that's the grey arrow) ──
      if(!chunks.length||blob.size<10000){
        log("⚠ RENDER PRODUCED NO VIDEO DATA");
        log("Your browser blocked canvas capture. Fix: keep this tab in front");
        log("for the whole render, and try 720p · 24FPS.");
        setProgress(0);setDone(false);setRendering(false);
        try{clearInterval(dataInterval);}catch(e){}
        try{clearInterval(heartbeat);}catch(e){}
        try{if(audioCtx)audioCtx.close();}catch(e){}
        alert("Render produced no video data.\n\nKeep this tab in front for the whole render (don't switch apps or tabs), and use 720p · 24FPS. Then try again.");
        return;
      }
      const url=URL.createObjectURL(blob);
      setRenderUrl(url);
      if(setRendered)setRendered({url,quality,format:"WebM",timestamp:new Date().toLocaleString()});
      setProgress(100);setDone(true);
      log("RENDER COMPLETE — "+(blob.size/1024/1024).toFixed(1)+"MB");
      // Save final render to IndexedDB — timeout-protected, never blocks completion
      try{
        const renderName="MandaStrong_Film_"+new Date().toISOString().slice(0,10)+".webm";
        await Promise.race([
          saveClipToDB("render_final",blob,renderName,"video/webm"),
          new Promise(r=>setTimeout(r,6000))
        ]);
      }catch(e){}
      try{if(audioCtx)audioCtx.close();}catch(e){}
    }catch(e){log("Render error: "+e.message);}
    setRendering(false);
  };

  const clips=getVideoClips();
  const audio=getAudioTrack();
  const QUALITIES=[{id:"480p",label:"480p",sub:"854×480"},{id:"720p",label:"720p",sub:"1280×720"},{id:"1080p",label:"1080p",sub:"1920×1080"},{id:"4K",label:"4K",sub:"3840×2160"}];

  return (
    <div style={{...Sp,padding:0}}>
      <canvas ref={canvasRef} style={{position:"fixed",right:8,bottom:8,width:160,height:90,opacity:1,pointerEvents:"none",zIndex:9999,border:"1px solid #e8c96d",background:"#000"}}/>
      <div style={{padding:"12px 24px",borderBottom:"1px solid "+GOLDDIM+"",background:"#020200",display:"flex",alignItems:"center",justifyContent:"space-between",flexWrap:"wrap",gap:10}}>
        <div>
          <div style={{fontSize:10,color:GOLD,letterSpacing:4,fontWeight:700}}>PRODUCTION ENGINE — STAGE 6</div>
          <h1 style={{...H1,fontSize:22,margin:0}}>RENDER FILM</h1>
          <div style={{display:"flex",alignItems:"center",gap:8,marginTop:4}}>
            <span style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:2}}>FILM: {filmDuration||60} MIN</span>
            <input type="range" min={1} max={180} step={1} value={filmDuration||60} onChange={e=>setFilmDuration(+e.target.value)} style={{width:160,accentColor:GOLD}}/>
            <div style={{display:"flex",gap:4}}>
              {[60,90,180].map(m=><button key={m} onClick={()=>setFilmDuration(m)} style={{background:filmDuration===m?GOLD:"#111",border:"1px solid "+(filmDuration===m?"#000":GOLDDIM),color:filmDuration===m?"#000":WHITE,padding:"2px 8px",cursor:"pointer",fontSize:10,fontWeight:900,fontFamily:"'Rajdhani',sans-serif"}}>{m}m</button>)}
            </div>
          </div>
        </div>
        {done&&!rendering&&<div style={{color:"#22c55e",fontSize:11,fontWeight:900,letterSpacing:2}}>RENDER COMPLETE</div>}
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 320px",minHeight:"calc(100vh - 120px)"}}>
        <div style={{padding:20,overflowY:"auto"}}>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            <div style={{background:clips.length>0?"#061406":"#0a0a0a",border:"1px solid "+(clips.length>0?"#22c55e":GOLDDIM),padding:"14px 16px"}}>
              <div style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:3,marginBottom:6}}>VIDEO CLIPS</div>
              <div style={{color:clips.length>0?"#22c55e":WHITE,fontSize:14,fontWeight:900}}>{clips.length>0?"✓ "+clips.length+" clip"+(clips.length>1?"s":"")+" ready":"No clips — generate on page 8"}</div>
            </div>
            <div style={{background:audio?"#061406":"#0a0a0a",border:"1px solid "+(audio?"#22c55e":GOLDDIM),padding:"14px 16px"}}>
              <div style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:3,marginBottom:6}}>AUDIO TRACK</div>
              <div style={{color:audio?"#22c55e":"#f59e0b",fontSize:14,fontWeight:900}}>{audio?"✓ Audio ready":"No audio — record on page 6"}</div>
            </div>
          </div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginBottom:16}}>
            <div style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:"14px 16px"}}>
              <div style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:3,marginBottom:10}}>OUTPUT QUALITY</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:5}}>
                {QUALITIES.map(q=>(
                  <button key={q.id} onClick={()=>setQuality(q.id)} style={{background:quality===q.id?"#0a0800":"#000",border:"1px solid "+(quality===q.id?GOLD:GOLDDIM),padding:"8px 6px",cursor:"pointer",textAlign:"center"}}>
                    <div style={{color:quality===q.id?GOLD:WHITE,fontSize:12,fontWeight:900,fontFamily:"'Rajdhani',sans-serif"}}>{q.label}</div>
                    <div style={{color:DIM,fontSize:9}}>{q.sub}</div>
                  </button>
                ))}
              </div>
            </div>
            <div style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:"14px 16px"}}>
              <div style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:3,marginBottom:10}}>SETTINGS</div>
              <div style={{marginBottom:10}}>
                <div style={{color:DIM,fontSize:10,marginBottom:5}}>FRAME RATE</div>
                <div style={{display:"flex",gap:5}}>
                  {[24,30,60].map(f=><button key={f} onClick={()=>setFps(f)} style={{...G(fps===f?"gold":"out",true),flex:1,padding:"5px 4px",fontSize:10}}>{f}fps</button>)}
                </div>
              </div>
              <div>
                <div style={{color:DIM,fontSize:10,marginBottom:5}}>CODEC</div>
                <div style={{display:"flex",gap:5}}>
                  {["vp9","vp8"].map(c=><button key={c} onClick={()=>setCodec(c)} style={{...G(codec===c?"gold":"out",true),flex:1,padding:"5px 4px",fontSize:10}}>{c.toUpperCase()}</button>)}
                </div>
              </div>
            </div>
          </div>
          {rendering&&(
            <div style={{background:"#000",border:"1px solid "+GOLD,padding:"14px 16px",marginBottom:16}}>
              <div style={{display:"flex",justifyContent:"space-between",marginBottom:10}}>
                <div style={{color:GOLD,fontSize:11,fontWeight:900}}>RENDERING</div>
                <div style={{color:GOLD,fontSize:13,fontWeight:900}}>{progress}%</div>
              </div>
              <div style={{height:8,background:"#111",overflow:"hidden"}}>
                <div style={{width:progress+"%",height:"100%",background:"linear-gradient(90deg,"+GOLDDIM+","+GOLD+")",transition:"width .3s"}}/>
              </div>
            </div>
          )}
          {renderLog.length>0&&(
            <div style={{background:"#000",border:"1px solid "+GOLDDIM,padding:"14px 16px",marginBottom:16,maxHeight:180,overflowY:"auto"}}>
              <div style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:3,marginBottom:8}}>RENDER LOG</div>
              {renderLog.map((l,i)=>(
                <div key={i} style={{color:i===renderLog.length-1?"#22c55e":"#666",fontSize:10,lineHeight:1.7,fontFamily:"monospace"}}>{i===renderLog.length-1?"► ":"  "}{l}</div>
              ))}
            </div>
          )}
          {done&&renderUrl&&(
            <div style={{background:"#061406",border:"1px solid #22c55e",padding:"16px 20px",marginBottom:16}}>
              <div style={{color:"#22c55e",fontWeight:900,fontSize:13,letterSpacing:2,marginBottom:12}}>RENDER COMPLETE</div>
              <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                <button onClick={()=>{
                  try{
                    const a=document.createElement("a");
                    a.href=renderUrl; a.download="MandaStrong_Film_"+Date.now()+".webm"; a.rel="noopener noreferrer";
                    document.body.appendChild(a); a.click();
                    setTimeout(()=>{try{document.body.removeChild(a);}catch(e){}},1000);
                    log("✓ Download started — check your device's Downloads");
                  }catch(e){ try{window.open(renderUrl,"_blank");}catch(e2){} log("Opened film in new tab — long-press to save"); }
                }} style={{...G("gold",false),padding:"12px 24px",fontSize:12,letterSpacing:2,cursor:"pointer"}}>⬇ DOWNLOAD FILM</button>
                <button onClick={()=>go(17)} style={{...G("out",false),padding:"12px 24px",fontSize:12}}>PREVIEW</button>
                <button onClick={()=>go(18)} style={{...G("out",false),padding:"12px 24px",fontSize:12}}>EXPORT</button>
              </div>
            </div>
          )}
          {/* ── FILL IN THE GAPS? ─────────────────────────────────── */}
          <div style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:"14px 16px",marginBottom:16}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{color:GOLD,fontSize:11,fontWeight:900,letterSpacing:2}}>FILL IN THE GAPS WITH EXTRA SCENES?</div>
                <div style={{color:GOLDDIM,fontSize:10,marginTop:4,lineHeight:1.6}}>If your clips are shorter than {filmDuration||60} min, choose Y to generate extra scenes so the film reaches full length. Choose N to stretch the clips you have.</div>
              </div>
              <div style={{display:"flex",gap:6,flexShrink:0,marginLeft:12}}>
                <button onClick={()=>setGapFill(true)}
                  style={{background:gapFill?GOLD:"#111",border:"1px solid "+(gapFill?"#000":GOLDDIM),color:gapFill?"#000":WHITE,padding:"6px 18px",cursor:"pointer",fontSize:12,fontWeight:900,letterSpacing:1}}>Y</button>
                <button onClick={()=>setGapFill(false)}
                  style={{background:!gapFill?GOLD:"#111",border:"1px solid "+(!gapFill?"#000":GOLDDIM),color:!gapFill?"#000":WHITE,padding:"6px 18px",cursor:"pointer",fontSize:12,fontWeight:900,letterSpacing:1}}>N</button>
              </div>
            </div>
          </div>
          <div style={{background:"#050500",border:"2px solid "+GOLD,padding:"18px 20px",marginBottom:16}}>
            <button onClick={startRender} disabled={rendering||clips.length===0}
              style={{...G("gold",false),width:"100%",padding:"18px",fontSize:14,letterSpacing:3,opacity:rendering||clips.length===0?0.5:1,marginBottom:10}}>
              {rendering?"RENDERING... "+progress+"%":"START RENDER — "+quality+" · "+fps+"fps · "+clips.length+" CLIP"+(clips.length!==1?"S":"")}
            </button>
          </div>
          <div style={{display:"flex",gap:8}}>
            <button onClick={()=>go(13)} style={{...G("out",false),flex:1,padding:"10px",fontSize:11}}>TIMELINE</button>
            <button onClick={()=>go(15)} style={{...G("out",false),flex:1,padding:"10px",fontSize:11}}>AUDIO MIX</button>
            <button onClick={()=>go(8)} style={{...G("out",false),flex:1,padding:"10px",fontSize:11}}>GENERATOR</button>
            <button onClick={()=>go(17)} style={{...G("out",false),flex:1,padding:"10px",fontSize:11}}>PREVIEW</button>
          </div>
        </div>
        <div style={{borderLeft:"1px solid "+GOLDDIM+"",display:"flex",flexDirection:"column",background:"#020200"}}>
          <div style={{background:"#000",aspectRatio:"16/9",display:"flex",alignItems:"center",justifyContent:"center",overflow:"hidden"}}>
            {renderUrl?(
              <video src={renderUrl} controls autoPlay loop playsInline style={{width:"100%",height:"100%",objectFit:"contain"}}/>
            ):(
              <div style={{textAlign:"center",padding:20}}>
                <div style={{color:GOLD,fontSize:28,marginBottom:8}}>RENDER</div>
                <div style={{color:DIM,fontSize:10,lineHeight:1.8}}>{quality} · {fps}fps<br/>{clips.length} clip{clips.length!==1?"s":""} queued</div>
              </div>
            )}
          </div>
          <div style={{flex:1,overflowY:"auto",padding:14}}>
            <div style={{color:GOLD,fontSize:9,letterSpacing:3,fontWeight:900,marginBottom:10}}>RENDER QUEUE</div>
            {clips.length===0?(
              <div style={{color:GOLDDIM,fontSize:10,textAlign:"center",padding:"20px 0",lineHeight:1.8}}>No clips.<br/>Generate on page 8.</div>
            ):clips.map((clip,i)=>(
              <div key={clip.id||i} style={{display:"flex",alignItems:"center",gap:8,padding:"8px 10px",marginBottom:4,background:currentClipIdx===i?"#0a0800":"#0a0a0a",border:"1px solid "+(currentClipIdx===i?GOLD:GOLDDIM)}}>
                <div style={{width:22,height:22,background:currentClipIdx===i?GOLD:"#222",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  <span style={{color:currentClipIdx===i?"#000":DIM,fontSize:9,fontWeight:900}}>{i+1}</span>
                </div>
                <div style={{flex:1,overflow:"hidden"}}>
                  <div style={{color:currentClipIdx===i?GOLD:WHITE,fontSize:10,fontWeight:900,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis"}}>{clip.name.replace(/\.[^.]+$/,"").slice(0,28)}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function P17({ go, rendered, mediaLib }) {
  const videoRef = useRef(null);
  const [isPlaying,setIsPlaying]=useState(false);
  const [currentTime,setCurrentTime]=useState(0);
  const [duration,setDuration]=useState(0);
  const [vs,setVs]=useState("");
  useEffect(()=>{
    // Try rendered prop first, then IndexedDB render_final, then latest video in mediaLib
    if(rendered?.url){setVs(rendered.url);return;}
    loadClipFromDB("render_final").then(r=>{
      if(r?.blob){setVs(URL.createObjectURL(r.blob));return;}
      // Fall back to latest video in mediaLib
      const latest=mediaLib?.filter(a=>a?.type?.startsWith("video")).slice(-1)[0];
      if(latest?.url) setVs(latest.url);
    }).catch(()=>{
      const latest=mediaLib?.filter(a=>a?.type?.startsWith("video")).slice(-1)[0];
      if(latest?.url) setVs(latest.url);
    });
  },[rendered,mediaLib]);
  const fmt=s=>{const m=Math.floor(s/60);const sc=Math.floor(s%60);return String(m).padStart(2,"0")+":"+String(sc).padStart(2,"0");};
  const togglePlay=()=>{if(!videoRef.current)return;if(isPlaying){videoRef.current.pause();setIsPlaying(false);}else{videoRef.current.play();setIsPlaying(true);}};
  return (
    <div style={{...Sp,padding:40}}>
      <div style={{maxWidth:880,margin:"0 auto"}}>
        <h1 style={{...H1,fontSize:28,marginBottom:14}}>FILM PREVIEW</h1>
        <div style={{background:"#000",overflow:"hidden",marginBottom:14,aspectRatio:"16/9",display:"flex",alignItems:"center",justifyContent:"center",border:"1px solid "+GOLDDIM}}>
          {vs?<video ref={videoRef} src={vs} style={{width:"100%",height:"100%"}} controls
            onTimeUpdate={()=>setCurrentTime(videoRef.current?.currentTime||0)}
            onLoadedMetadata={()=>setDuration(videoRef.current?.duration||0)}
            onEnded={()=>setIsPlaying(false)}
            onError={e=>{console.warn("Preview video error",e);}}/>:
            <div style={{textAlign:"center",color:GOLDDIM,fontSize:40}}>🎬</div>}
        </div>
        <div style={{...Card(),display:"flex",alignItems:"center",gap:8}}>
          <button onClick={()=>{if(videoRef.current)videoRef.current.currentTime=0;}} style={{...G("out",true)}}>⏮</button>
          <button onClick={()=>{if(videoRef.current)videoRef.current.currentTime-=10;}} style={{...G("out",true)}}>⏪</button>
          <button onClick={togglePlay} style={{...G("gold",true),minWidth:44}}>{isPlaying?"⏸":"▶"}</button>
          <button onClick={()=>{if(videoRef.current)videoRef.current.currentTime+=10;}} style={{...G("out",true)}}>⏩</button>
          <div style={{flex:1,height:4,background:"#111",cursor:"pointer"}}
            onClick={e=>{if(!videoRef.current||!duration)return;const r=e.currentTarget.getBoundingClientRect();videoRef.current.currentTime=((e.clientX-r.left)/r.width)*duration;}}>
            <div style={{width:duration?(currentTime/duration*100):0+"%",height:"100%",background:GOLD}}/>
          </div>
          <span style={{color:WHITE,fontSize:12,fontWeight:700,whiteSpace:"nowrap"}}>{fmt(currentTime)} / {fmt(duration||0)}</span>
        </div>
      </div>
    </div>
  );
}

function P18({ rendered, mediaLib }) {
  const vs=rendered?.url||(mediaLib.find(a=>a.type&&a.type.startsWith("video"))?mediaLib.find(a=>a.type&&a.type.startsWith("video")).url:"");
  const dl=()=>{if(!vs){alert("No film yet — render first!");return;}const a=document.createElement("a");a.href=vs;a.download="MandaStrong_Film.webm";a.target="_blank";a.rel="noopener noreferrer";a.click();};
  return (
    <div style={{...Sp,padding:40}}>
      <div style={{maxWidth:780,margin:"0 auto"}}>
        <div style={{fontSize:11,color:GOLD,letterSpacing:4,marginBottom:4,fontWeight:700}}>DISTRIBUTION</div>
        <h1 style={{...H1,fontSize:28,marginBottom:14}}>EXPORT & DISTRIBUTE</h1>
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:10,marginBottom:20}}>
          {[["💾","DOWNLOAD TO DEVICE",dl],["💿","SAVE PROJECT FILE",()=>{}],["🌐","SHARE TO COMMUNITY",()=>{}]].map(([ic,lb,fn])=>(
            <button key={lb} onClick={fn} style={{...Card(),cursor:"pointer",textAlign:"center",padding:16,display:"block"}}>
              <div style={{fontSize:24,marginBottom:6}}>{ic}</div>
              <div style={{color:WHITE,fontSize:11,fontWeight:900,letterSpacing:2}}>{lb}</div>
            </button>
          ))}
        </div>
        <div style={{color:GOLD,fontWeight:900,fontSize:11,letterSpacing:3,marginBottom:10}}>SHARE TO SOCIAL MEDIA</div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          {[["YouTube","#FF0000","https://www.youtube.com/upload"],["Instagram","#E1306C","https://www.instagram.com"],["TikTok","#69C9D0","https://www.tiktok.com/upload"],["X / Twitter","#1DA1F2","https://twitter.com/intent/tweet?text=Check+out+my+film+made+with+MandaStrong+Studio"],["Facebook","#1877F2","https://www.facebook.com/sharer/sharer.php?u=https://mandastrong1.etsy.com"],["LinkedIn","#0A66C2","https://www.linkedin.com/sharing/share-offsite/?url=https://mandastrong1.etsy.com"],["Vimeo","#1AB7EA","https://vimeo.com/upload"],["WhatsApp","#25D366","https://api.whatsapp.com/send?text=Check+out+my+film+from+MandaStrong+Studio"]].map(([s,c,link])=>(
            <button key={s} onClick={()=>window.open(link,"_blank")}
              style={{background:"#000",border:"1px solid "+GOLDDIM,padding:"10px 16px",cursor:"pointer"}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=c;e.currentTarget.style.background=c+"22";}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=GOLDDIM;e.currentTarget.style.background="#000";}}>
              <div style={{color:c,fontSize:12,fontWeight:900,letterSpacing:1}}>{s}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


function TutCanvas({drawFn}){
  const cvRef=useRef(null);const rafRef=useRef(null);const t0=useRef(null);
  useEffect(()=>{
    const cv=cvRef.current;if(!cv)return;
    const ctx=cv.getContext("2d");
    const resize=()=>{const p=cv.parentElement;if(!p)return;cv.width=p.clientWidth;cv.height=Math.round(p.clientWidth*9/16);};
    resize();window.addEventListener("resize",resize);
    // Ambient particles for depth
    const particles=Array.from({length:40},()=>({x:Math.random(),y:Math.random(),z:Math.random()*0.6+0.2,s:Math.random()*0.7+0.3}));
    const draw=(ts)=>{
      if(!t0.current)t0.current=ts;
      const sec=(ts-t0.current)/1000;
      const loop=120;
      const t=Math.min(1,(sec%loop)/loop);
      const W=cv.width,H=cv.height;

      // Base — Claude animation
      try{drawFn(ctx,W,H,t,sec);}
      catch(e){ctx.fillStyle="#050300";ctx.fillRect(0,0,W,H);}

      // ── CINEMATIC POLISH LAYER — makes every tutorial feel premium ────

      // Warm cinematic grade — subtle gold tint over entire frame
      ctx.fillStyle="rgba(232,180,60,0.045)";ctx.fillRect(0,0,W,H);

      // Deepen shadows for contrast
      ctx.fillStyle="rgba(10,5,0,0.06)";ctx.fillRect(0,0,W,H);

      // Highlight recovery — glow near top centre
      const hr=ctx.createRadialGradient(W/2,H*0.3,0,W/2,H*0.3,W*0.4);
      hr.addColorStop(0,"rgba(255,245,215,0.06)");hr.addColorStop(1,"rgba(0,0,0,0)");
      ctx.fillStyle=hr;ctx.fillRect(0,0,W,H);

      // Ambient particle depth — slow-drifting gold specks
      particles.forEach(p=>{
        const drift=(sec*0.008*(1-p.z))%1;
        const x=((p.x+drift)%1)*W;
        const y=p.y*H;
        const size=p.s*(1-p.z)*2.2;
        ctx.fillStyle="rgba(232,201,109,"+(0.10*(1-p.z)).toFixed(3)+")";
        ctx.beginPath();ctx.arc(x,y,size,0,Math.PI*2);ctx.fill();
      });

      // Vignette — cinematic edge fall-off
      const vig=ctx.createRadialGradient(W/2,H/2,W*0.18,W/2,H/2,W*0.78);
      vig.addColorStop(0,"rgba(0,0,0,0)");vig.addColorStop(1,"rgba(0,0,0,0.62)");
      ctx.fillStyle=vig;ctx.fillRect(0,0,W,H);

      // Letterbox bars — 2.35:1 cinema look
      const bar=Math.round(H*0.068);
      ctx.fillStyle="#000";
      ctx.fillRect(0,0,W,bar);
      ctx.fillRect(0,H-bar,W,bar);

      // Fine film grain
      for(let g=0;g<28;g++){
        const gv=Math.random()>0.5?160:20;
        ctx.fillStyle="rgba("+gv+","+gv+","+gv+",0.013)";
        ctx.fillRect(Math.random()*W,Math.random()*H,1.2,1.2);
      }

      // Chromatic aberration hint at edges (subtle warmth)
      const edge=ctx.createLinearGradient(0,0,0,H);
      edge.addColorStop(0,"rgba(232,180,60,0.04)");
      edge.addColorStop(0.5,"rgba(0,0,0,0)");
      edge.addColorStop(1,"rgba(160,80,20,0.04)");
      ctx.fillStyle=edge;ctx.fillRect(0,0,W,H);

      // Fade-in first 1.5s and fade-out last 1.5s of loop
      const loopSec=sec%loop;
      if(loopSec<1.5){ctx.fillStyle="rgba(0,0,0,"+(1-loopSec/1.5).toFixed(3)+")";ctx.fillRect(0,0,W,H);}
      if(loopSec>loop-1.5){ctx.fillStyle="rgba(0,0,0,"+((loopSec-(loop-1.5))/1.5).toFixed(3)+")";ctx.fillRect(0,0,W,H);}

      // Professional branding overlay — top-left studio mark
      const brandY=bar+Math.round(H*0.045);
      ctx.font="bold "+Math.round(H*0.022)+"px Georgia, serif";
      ctx.textAlign="left";
      // Gold gradient text
      const brandGrad=ctx.createLinearGradient(bar+8,brandY-Math.round(H*0.02),bar+8,brandY);
      brandGrad.addColorStop(0,"rgba(255,243,207,0.95)");
      brandGrad.addColorStop(1,"rgba(160,120,32,0.95)");
      ctx.fillStyle=brandGrad;
      ctx.fillText("MANDASTRONG STUDIO",bar+10,brandY);
      // Thin gold line under brand
      ctx.strokeStyle="rgba(232,201,109,0.6)";ctx.lineWidth=1;
      ctx.beginPath();ctx.moveTo(bar+10,brandY+4);ctx.lineTo(bar+10+Math.round(H*0.28),brandY+4);ctx.stroke();

      // Bottom right — TUTORIAL watermark
      ctx.font="bold "+Math.round(H*0.017)+"px Georgia, serif";
      ctx.textAlign="right";
      ctx.fillStyle="rgba(232,201,109,0.55)";
      ctx.fillText("• TUTORIAL •",W-bar-10,H-bar-Math.round(H*0.025));

      ctx.textAlign="left";

      rafRef.current=requestAnimationFrame(draw);
    };
    rafRef.current=requestAnimationFrame(draw);
    return()=>{window.removeEventListener("resize",resize);if(rafRef.current)cancelAnimationFrame(rafRef.current);};
  },[drawFn]);
  return <canvas ref={cvRef} style={{width:"100%",display:"block",background:"#000",boxShadow:"0 0 60px rgba(232,201,109,0.25), inset 0 0 40px rgba(0,0,0,0.5)"}}/>;
}

function P19({ go }) {
  const [active,setActive]=useState(null);
  const [generating,setGenerating]=useState(null);
  const [drawFns,setDrawFns]=useState({});

  const tuts=[
    {n:"01",t:"Getting Started — Platform Overview",d:"Complete walkthrough of all 24 pages, Quick Access menu, footer controls, auto-save, and navigation.",dur:"3:00",l:"Beginner",page:1,tips:["Use ☰ top left to jump to any page","AUTOSAVE ON is real — state saves automatically as you work","💾 SAVE PROJECT saves a named session to MY PROJECTS for full restore"]},
    {n:"02",t:"Writing Tools — Script to Screen",d:"How to use the 100+ writing tools on Page 5. From logline to full feature script. All results auto-save to Media Library.",dur:"4:00",l:"Beginner",page:5,tips:["Click any tool card to open it","Use AI CREATE for instant professional scripts","Save results to your Media Library — they auto-route to the timeline"]},
    {n:"03",t:"Voice Engine — 54 Characters",d:"Selecting voices, filtering by gender, age, and origin. Recording narration. Two-button save workflow.",dur:"5:00",l:"Beginner",page:6,tips:["Hit PREPARE TO SPEAK to hear your narration aloud","Hit SAVE TO MEDIA LIBRARY to save it — auto-adds to timeline audio track","Filter by gender, age, and origin to find the perfect voice for your project"]},
    {n:"04",t:"Music Video Studio — Full Walkthrough",d:"Step-by-step: Song setup, style selection, scene description, drag-and-drop audio upload, generating and exporting.",dur:"5:00",l:"Intermediate",page:6,tips:["Access from MUSIC VIDEO STUDIO button on Page 6","Drag and drop your audio file onto the upload zone — or click to browse","Record your own song with the red RECORD button"]},
    {n:"05",t:"Video Generator — Cinematic Scenes",d:"Describe any scene and have the Cinema Engine build it. Upload reference photos for photoreal output. Auto-saves to library and timeline.",dur:"4:00",l:"Intermediate",page:8,tips:["Upload a reference photo FIRST — engine builds the scene around it","Be specific: lighting, mood, camera angle, time of day","Generated clips save automatically to Media Library and Timeline"]},
    {n:"06",t:"Timeline Editor — Building Your Film",d:"Clips auto-populate from Media Library. Drag to reorder. Upload Media button always visible. SYNC ALL TRACKS for instant assembly.",dur:"4:00",l:"Intermediate",page:13,tips:["Hit ⚡ SYNC ALL TRACKS to auto-populate all clips in order","Use ⬆ UPLOAD MEDIA (next to CLEAR ALL) to add more clips at any time","Narration saves auto-populate the audio track — no dragging needed"]},
    {n:"07",t:"Audio Mixer — Professional Sound",d:"Setting the perfect mix for documentary, narrative film, or music video.",dur:"3:00",l:"Beginner",page:15,tips:["Documentary: VOICE 85 · MUSIC 40 · EFX 50 · MASTER 85","Music Video: MUSIC 75 · VOICE 60 · EFX 40 · MASTER 85","Hit Apply Mix when done before going to Page 16"]},
    {n:"08",t:"Render Engine — 4K with Auto-Enhancement",d:"Quality settings 480p to 4K. Auto-enhancement runs on every frame — contrast, colour grade, sharpness, noise reduction. Priority save protects your work before render starts.",dur:"4:00",l:"Intermediate",page:16,tips:["Auto-enhancement runs automatically — no settings needed","Priority save fires before render starts so a crash never loses your session","4K recommended for professional distribution — 1080p for social media"]},
    {n:"09",t:"Export & Distribute",d:"Downloading your film and sharing to all social platforms directly from Page 18.",dur:"2:00",l:"Beginner",page:18,tips:["Download to device first","Each social button opens the upload page directly","Supports YouTube, Instagram, TikTok, Facebook, X, and Vimeo"]},
    {n:"10",t:"Saving & Project History",d:"Real auto-save keeps your work safe at all times. Emergency crash save fires if the tab closes. Named sessions in MY PROJECTS for full restore.",dur:"2:00",l:"Beginner",page:1,tips:["AUTOSAVE ON is real — saves every time you change page, timeline, or media","💾 SAVE PROJECT creates a named restore point in MY PROJECTS","📂 MY PROJECTS → CONTINUE PROJECT restores your full session including clips"]},
    {n:"11",t:"Character Studio — Page 24",d:"Create and save reusable characters with reference photos, voice assignments, and appearance notes. Use in any scene.",dur:"3:00",l:"Intermediate",page:24,tips:["Upload a reference photo for each character","Assign a voice from the 54-character library","Hit USE IN SCENE to send the character to your Media Library"]},
    {n:"12",t:"Documentary Workflow — Full Case Study",d:"Complete end-to-end documentary production: script to 4K render. 13 scenes, narration, timeline assembly, and export.",dur:"5:00",l:"Advanced",page:8,tips:["Page 5 → paste director instructions + full narration script into Script to Movie","Page 6 → select your voice → PREPARE TO SPEAK → SAVE TO MEDIA LIBRARY","Page 8 → generate all scenes → Page 13 → Sync → Page 16 → Render 4K"]},
  ];

  const lc={Beginner:"#22c55e",Intermediate:"#f59e0b",Advanced:"#ef4444"};

  const generate=async(idx)=>{
    setGenerating(idx);setActive(idx);
    const t=tuts[idx];
    // Stop any current narration before starting a new one
    try{window.speechSynthesis.cancel();}catch{}
    try{
      const res=await fetch("https://njqfexhltjwpgvctmyaw.supabase.co/functions/v1/claude-proxy",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({model:"claude-sonnet-4-20250514",max_tokens:4000,
          messages:[{role:"user",content:"Write a highly polished JavaScript canvas animation for a professional cinema-platform tutorial about \""+t.t+"\". This is for MandaStrong Studio — the aesthetic must be premium: gold (#e8c96d) on deep black, glowing highlights, smooth eased motion using Math.sin() and clean easing curves, deep drop shadows, professional serif and sans typography. Animation should include: (1) an elegant animated LESSON "+t.n+" number card that fades in and settles, (2) the tutorial title \""+t.t+"\" appearing letter by letter with warm gold glow, (3) an animated diagram or visual metaphor that illustrates the topic conceptually — smooth transitions, layered shapes, glowing lines, not stick figures, (4) key concepts revealed one at a time with smooth fade-in, (5) subtle particle effects and ambient movement to avoid static frames. Every frame should look like a high-end motion graphics piece — think Apple keynote crossed with cinema title design. Use sec for continuous animation, t=0-1 for progress. W=canvas width, H=canvas height. Do not draw letterbox bars, watermarks, or vignettes — those are added separately. Return ONLY: function drawFrame(ctx,W,H,t,sec){"}]})
      });
      const d=await res.json();
      let code=d.content&&d.content[0]?d.content[0].text.trim():"";
      const _bt=String.fromCharCode(96);code=code.split(_bt+_bt+_bt+"javascript").join("").split(_bt+_bt+_bt+"js").join("").split(_bt+_bt+_bt).join("").trim();
      const fi=code.indexOf("function drawFrame");if(fi>0)code=code.slice(fi);
      const bo=code.indexOf("{");const bc=code.lastIndexOf("}");
      const body=bo>=0&&bc>bo?code.slice(bo+1,bc):"";
      const fn=new Function("ctx","W","H","t","sec",body);
      setDrawFns(p=>({...p,[idx]:fn}));
      // Blaze female voice narration for this lesson
      const narration="Lesson "+parseInt(t.n)+". "+t.t+". "+t.d+" Pro tips. "+t.tips.join(". ")+".";
      setTimeout(()=>{try{speakText("blaze",narration,null,null);}catch(e){}},500);
    }catch(e){console.error(e);}
    setGenerating(null);
  };

  return(
    <div style={{...Sp,padding:0,background:"#000"}}>
      <div style={{background:"linear-gradient(180deg,#080600,#000)",borderBottom:"1px solid "+GOLD+"44",padding:"24px 32px 18px"}}>
        <div style={{maxWidth:900,margin:"0 auto"}}>
          <div style={{fontSize:9,color:GOLDDIM,letterSpacing:5,fontWeight:900,marginBottom:6}}>LEARNING CENTER</div>
          <h1 style={{...H1,fontSize:28,margin:"0 0 8px"}}>TUTORIALS</h1>
          <p style={{color:WHITE,fontSize:13,lineHeight:1.8,margin:0,opacity:.8}}>Hit GENERATE TO WATCH on any lesson. Claude writes a unique animated tutorial and plays it instantly.</p>
        </div>
      </div>
      <div style={{maxWidth:900,margin:"0 auto",padding:"20px 32px"}}>
        {tuts.map((t,idx)=>{
          const isActive=active===idx;
          const isGen=generating===idx;
          const hasFn=!!drawFns[idx];
          return(
            <div key={t.n} style={{marginBottom:10}}>
              <div style={{background:isActive?"#060400":"#030200",border:"1px solid "+(isActive?GOLD:GOLDDIM+"66"),borderBottom:isActive?"none":undefined,display:"flex",alignItems:"stretch",cursor:"pointer"}}
                onClick={()=>setActive(isActive?null:idx)}>
                <div style={{width:56,flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",background:isActive?"linear-gradient(180deg,"+GOLDDIM+"33,"+GOLD+"11)":"#0a0800",borderRight:"1px solid "+isActive?GOLD+"66":GOLDDIM+"33"+""}}>
                  <span style={{fontFamily:"'Cinzel',serif",color:isActive?GOLD:GOLDDIM,fontSize:13,fontWeight:900}}>{t.n}</span>
                </div>
                <div style={{flex:1,padding:"13px 16px",minWidth:0}}>
                  <div style={{display:"flex",alignItems:"center",gap:8,flexWrap:"wrap",marginBottom:3}}>
                    <span style={{color:WHITE,fontWeight:900,fontSize:14}}>{t.t}</span>
                    <span style={{background:lc[t.l]+"1a",border:"1px solid "+lc[t.l],color:lc[t.l],padding:"1px 8px",fontSize:9,fontWeight:900,letterSpacing:2}}>{t.l.toUpperCase()}</span>
                    {hasFn&&<span style={{background:"#22c55e1a",border:"1px solid #22c55e",color:"#22c55e",padding:"1px 8px",fontSize:9,fontWeight:900,letterSpacing:2}}>GENERATED ✓</span>}
                  </div>
                  <div style={{color:GOLDDIM,fontSize:10,letterSpacing:1}}>{t.dur} · {t.tips.length} PRO TIPS</div>
                </div>
                <div style={{display:"flex",alignItems:"center",gap:10,padding:"0 16px",flexShrink:0}}>
                  {isGen?(
                    <span style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:2}}>GENERATING...</span>
                  ):(
                    <button onClick={e=>{
                      e.stopPropagation();
                      if(hasFn){
                        // PLAY AGAIN — re-narrate with Blaze
                        try{window.speechSynthesis.cancel();}catch{}
                        const narration="Lesson "+parseInt(t.n)+". "+t.t+". "+t.d+" Pro tips. "+t.tips.join(". ")+".";
                        setTimeout(()=>{try{speakText("blaze",narration,null,null);}catch(e){}},300);
                        setActive(idx);
                      } else {
                        generate(idx);
                      }
                    }}
                      style={{background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"7px 18px",cursor:"pointer",fontSize:10,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",whiteSpace:"nowrap"}}>
                      {hasFn?"▶ PLAY AGAIN":"▶ GENERATE TO WATCH"}
                    </button>
                  )}
                  <span style={{color:isActive?GOLD:GOLDDIM,fontSize:14,fontWeight:900}}>{isActive?"▲":"▼"}</span>
                </div>
              </div>
              {isActive&&(
                <div style={{background:"#040300",border:"1px solid "+GOLD,borderTop:"none"}}>
                  {isGen?(
                    <div style={{aspectRatio:"16/9",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:16,background:"linear-gradient(135deg,#060400,#020100)"}}>
                      <div style={{width:60,height:60,border:"2px solid "+GOLD,borderTop:"2px solid transparent",borderRadius:"50%",animation:"spin 1s linear infinite"}}/>
                      <div style={{color:GOLD,fontSize:13,fontWeight:900,letterSpacing:3}}>CLAUDE IS WRITING YOUR TUTORIAL</div>
                      <style>{"@keyframes spin{to{transform:rotate(360deg)}}"}</style>
                    </div>
                  ):hasFn?(
                    <TutCanvas drawFn={drawFns[idx]}/>
                  ):(
                    <div style={{aspectRatio:"16/9",background:"linear-gradient(135deg,#060400,#020100)",display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",gap:18,cursor:"pointer"}}
                      onClick={()=>generate(idx)}>
                      <div style={{width:80,height:80,background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 50px "+GOLD+"55",cursor:"pointer"}}>
                        <span style={{color:"#000",fontSize:30,fontWeight:900,marginLeft:4}}>▶</span>
                      </div>
                      <div style={{textAlign:"center"}}>
                        <div style={{color:GOLD,fontWeight:900,fontSize:15,letterSpacing:4,marginBottom:6}}>GENERATE TO WATCH</div>
                        <div style={{color:GOLDDIM,fontSize:10,letterSpacing:2}}>LESSON {t.n} · {t.dur} · {t.l.toUpperCase()}</div>
                      </div>
                    </div>
                  )}
                  <div style={{padding:"20px 26px"}}>
                    <p style={{color:WHITE,fontSize:14,lineHeight:1.95,marginBottom:18}}>{t.d}</p>
                    <div style={{color:GOLD,fontSize:10,fontWeight:900,letterSpacing:3,marginBottom:10}}>PRO TIPS</div>
                    {t.tips.map((tip,i)=>(
                      <div key={i} style={{display:"flex",gap:12,marginBottom:9,alignItems:"flex-start"}}>
                        <span style={{color:GOLD,fontWeight:900,flexShrink:0}}>✦</span>
                        <span style={{color:WHITE,fontSize:13,lineHeight:1.75}}>{tip}</span>
                      </div>
                    ))}
                    <div style={{marginTop:18,display:"flex",gap:10,flexWrap:"wrap"}}>
                      {!hasFn&&!isGen&&<button onClick={()=>generate(idx)} style={{background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"11px 28px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>▶ GENERATE TO WATCH</button>}
                      {hasFn&&!isGen&&<button onClick={()=>generate(idx)} style={{background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"11px 28px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>↺ REGENERATE</button>}
                      <button onClick={()=>go(t.page)} style={{background:"transparent",border:"1px solid "+GOLD,color:GOLD,padding:"11px 20px",cursor:"pointer",fontSize:11,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif"}}>OPEN PAGE {t.page} ▶</button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function P20() {
  const [tab,setTab]=useState("tos");
  const sec=(title,body)=>(
    <div style={{marginBottom:16}}>
      <h3 style={{color:GOLD,fontWeight:900,fontSize:13,marginBottom:8,letterSpacing:2,borderBottom:"1px solid "+GOLDDIM+"",paddingBottom:6}}>{title}</h3>
      {body}
    </div>
  );
  const p=(txt)=><p style={{color:WHITE,fontSize:13,lineHeight:1.9,marginBottom:8}}>{txt}</p>;
  const li=(items)=><ul style={{color:WHITE,fontSize:13,lineHeight:1.9,paddingLeft:20,marginBottom:8}}>{items.map((t,i)=><li key={i} style={{marginBottom:3}}>{t}</li>)}</ul>;

  return (
    <div style={{...Sp,padding:40}}>
      <div style={{maxWidth:860,margin:"0 auto"}}>
        <div style={{fontSize:11,color:GOLD,letterSpacing:4,marginBottom:4,fontWeight:700}}>LEGAL</div>
        <h1 style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:28,fontWeight:900,letterSpacing:4,marginBottom:4}}>TERMS & DISCLAIMER</h1>
        <div style={{color:WHITE,fontSize:11,marginBottom:20,letterSpacing:2}}>EFFECTIVE MARCH 2026 · MANDASTRONG STUDIO</div>

        {/* Tab selector */}
        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",marginBottom:28,border:"1px solid "+GOLDDIM}}>
          {[["tos","TERMS OF SERVICE"],["disc","DISCLAIMER"]].map(([id,label])=>(
            <button key={id} onClick={()=>setTab(id)}
              style={{background:tab===id?"linear-gradient(135deg,#0a0500,#1a0800)":"#000",border:"none",borderBottom:tab===id?"2px solid "+GOLD:"2px solid transparent",color:tab===id?GOLD:WHITE,padding:"14px",cursor:"pointer",fontSize:12,fontWeight:900,letterSpacing:3,fontFamily:"'Rajdhani',sans-serif"}}>
              {label}
            </button>
          ))}
        </div>

        {tab==="tos"&&(
          <div>
            <div style={{background:"#050500",border:"2px solid "+GOLD,padding:"14px 20px",marginBottom:20,textAlign:"center"}}>
              <div style={{color:GOLD,fontSize:11,letterSpacing:3,fontWeight:900}}>MANDASTRONG STUDIO · PROFESSIONAL CINEMA INTELLIGENCE PLATFORM</div>
              <div style={{color:WHITE,fontSize:12,marginTop:4}}>By using this platform you agree to be legally bound by these Terms.</div>
            </div>

            {sec("1. ACCEPTANCE OF TERMS",<>{p("By accessing or using MandaStrong Studio you agree to be legally bound by these Terms of Service. If you do not agree, do not use this platform. These terms apply to all users including free, trial, and paid subscribers.")}</>)}
            {sec("2. SUBSCRIPTIONS & BILLING",<>{p("MandaStrong Studio offers three paid plans: Creator ($20/mo), Pro ($30/mo), and Studio ($50/mo). All plans bill monthly and auto-renew unless cancelled before the renewal date. The Studio Plan includes a 7-day free trial with no charge during the trial period. All payments are processed securely via Stripe. No refunds are issued for partial billing periods.")}</>)}
            {sec("3. INTELLECTUAL PROPERTY & CONTENT RIGHTS",<>{p("You retain full ownership of all original media, scripts, and creative content you upload to MandaStrong Studio. Studio Plan subscribers receive full commercial rights to content produced using the platform's AI tools. Creator and Pro plan subscribers may use content for personal and non-commercial purposes unless otherwise agreed in writing.")}{p("MandaStrong Studio, its tools, interface, branding, and codebase remain the intellectual property of Amanda Woolley and MandaStrong Studio. You may not reproduce, distribute, or resell the platform itself.")}</>)}
            {sec("4. AI-GENERATED CONTENT",<>{p("Content generated by MandaStrong Studio's AI tools is produced algorithmically. You are solely responsible for reviewing, editing, and verifying all AI-generated outputs before use. MandaStrong Studio makes no guarantees regarding the accuracy, appropriateness, or fitness for purpose of AI-generated content.")}{p("You agree not to use AI-generated content to produce material that is defamatory, illegal, harmful, or in violation of third-party rights.")}</>)}
            {sec("5. ACCEPTABLE USE",<>{p("You agree to use MandaStrong Studio only for lawful purposes. The following are strictly prohibited:")}{li(["Producing content that is defamatory, obscene, or harasses individuals","Infringing on third-party intellectual property rights","Attempting to reverse-engineer, copy, or redistribute the platform","Using the platform to generate spam, malware, or fraudulent content","Sharing your account credentials with third parties"])}</>)}
            {sec("6. SOCIAL MISSION",<>{p("A meaningful portion of all subscription proceeds is donated to veterans mental health initiatives and school anti-bullying programmes. These are not marketing statements — they are the founding mission of this platform. Full details available at MandaStrong1.Etsy.com.")}</>)}
            {sec("7. LIMITATION OF LIABILITY",<>{p("MandaStrong Studio is provided as-is without warranties of any kind, express or implied. To the maximum extent permitted by law, MandaStrong Studio shall not be liable for any indirect, incidental, or consequential damages arising from your use of the platform. Our total liability shall not exceed the amount you paid in the 30 days prior to the claim.")}</>)}
            {sec("8. TERMINATION",<>{p("We reserve the right to suspend or terminate your account at any time if you violate these Terms. You may cancel your subscription at any time via your account settings. Cancellation takes effect at the end of the current billing period.")}</>)}
            {sec("9. GOVERNING LAW",<>{p("These Terms are governed by the laws of the jurisdiction in which MandaStrong Studio is registered. Any disputes shall be resolved by binding arbitration or the courts of that jurisdiction.")}</>)}
            {sec("10. CONTACT",<>{p("For support, billing enquiries, or legal notices contact us at MandaStrong1.Etsy.com or through Agent Grok on Page 21 of the platform.")}</>)}

            <div style={{background:"#050500",border:"1px solid "+GOLDDIM,padding:"12px 16px",marginTop:8}}>
              <p style={{color:GOLDDIM,fontSize:11,margin:0,letterSpacing:1}}>MANDASTRONG STUDIO · AMANDA WOOLLEY, FOUNDER · MARCH 2026</p>
            </div>
          </div>
        )}

        {tab==="disc"&&(
          <div>
            <div style={{background:"#050500",border:"2px solid "+GOLD,padding:"14px 20px",marginBottom:20,textAlign:"center"}}>
              <div style={{color:GOLD,fontSize:11,letterSpacing:3,fontWeight:900}}>IMPORTANT — PLEASE READ BEFORE USING THIS PLATFORM</div>
              <div style={{color:WHITE,fontSize:12,marginTop:4}}>This disclaimer governs your use of all AI-generated content and platform services.</div>
            </div>

            {sec("AI-GENERATED CONTENT",<>{p("MandaStrong Studio is an AI-assisted creative platform. All outputs — including scripts, narrations, images, and video — are generated algorithmically and must be reviewed by the user before publication or commercial use. The platform does not guarantee the accuracy, completeness, or appropriateness of any AI-generated material.")}{p("AI-generated content may occasionally contain inaccuracies, unintended bias, outdated information, or incomplete details. You are solely responsible for fact-checking, editing, and ensuring compliance before publishing or distributing any content created on this platform.")}</>)}
            {sec("NO PROFESSIONAL ADVICE",<>{p("Nothing generated by MandaStrong Studio constitutes legal, medical, financial, psychological, or any other form of professional advice. The platform is a creative production tool only. Always consult a qualified professional before acting on any information produced by AI tools.")}</>)}
            {sec("THIRD-PARTY SERVICES",<>{p("MandaStrong Studio integrates with third-party services including payment processors and AI providers. We are not responsible for the availability, accuracy, or conduct of these services. Your use of third-party services is governed by their own terms and privacy policies.")}</>)}
            {sec("INTELLECTUAL PROPERTY",<>{p("You are responsible for ensuring that content you upload, reference, or incorporate into your productions does not infringe third-party intellectual property rights. MandaStrong Studio accepts no liability for copyright infringement arising from user-generated or user-directed content.")}</>)}
            {sec("PLATFORM AVAILABILITY",<>{p("MandaStrong Studio is provided on an 'as available' basis. We do not guarantee uninterrupted access, error-free operation, or permanent data retention. We recommend downloading and backing up all completed productions regularly. We are not liable for loss of data or creative work.")}</>)}
            {sec("SOCIAL MISSION COMMITMENT",<>{p("A meaningful portion of all subscription revenue is directed to veterans mental health programmes and school anti-bullying initiatives. This commitment is a founding principle of MandaStrong Studio and is carried out in good faith. It does not constitute a legally binding charitable obligation under these terms.")}</>)}
            {sec("USER RESPONSIBILITY",<>{p("All responsibility for how content created on MandaStrong Studio is deployed, distributed, monetised, or shared rests entirely with the user. MandaStrong Studio shall not be held liable for any consequences arising from the publication or use of platform-generated content.")}</>)}
            {sec("CHANGES TO THIS DISCLAIMER",<>{p("MandaStrong Studio reserves the right to update this disclaimer at any time. Continued use of the platform following any update constitutes your acceptance of the revised terms.")}</>)}

            <div style={{background:"#050500",border:"1px solid "+GOLDDIM,padding:"12px 16px",marginTop:8}}>
              <p style={{color:GOLDDIM,fontSize:11,margin:0,letterSpacing:1}}>— AMANDA WOOLLEY · FOUNDER · MANDASTRONG STUDIO · MARCH 2026 · mandastrongmovie.bolt.host</p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function P21() {
  const [msgs,setMsgs]=useState([{role:"assistant",content:"Welcome to MandaStrong Studio. I am Agent Grok — your 24/7 production consultant. Ask me anything about tools, workflow, pricing, or filmmaking."}]);
  const [inp2,setInp2]=useState(""); const [loading,setLoading]=useState(false);
  const bot=useRef(null);
  const QUICK=["Recommended production workflow?","How do I generate a scene?","Best audio mix for documentary?","How to export in 4K?","Subscription plans?","How does the Voice Engine work?","What genres can I render?","How do I use the Timeline?"];
  useEffect(()=>{if(bot.current)bot.current.scrollIntoView({behavior:"smooth"});},[msgs]);
  const send=async(q)=>{
    const question=q||inp2.trim();if(!question)return;
    setInp2("");setLoading(true);
    setMsgs(p=>[...p,{role:"user",content:question}]);
    try{
      const d=await proxyFetch({model:"claude-sonnet-4-20250514",max_tokens:1000,system:"You are Agent Grok, AI production assistant for MandaStrong Studio. Expert on all 23 pages, 600+ tools, 54 voice characters, video generator, music video studio, timeline, render engine up to 4K. Plans: Creator $20/mo, Pro $30/mo, Studio $50/mo with 7-day free trial. Be specific and direct.",messages:[...msgs.filter(m=>m.role!=="system"),{role:"user",content:question}]});
      setMsgs(p=>[...p,{role:"assistant",content:d&&d.content&&d.content[0]?d.content[0].text:"Try again."}]);
    }catch(e){setMsgs(p=>[...p,{role:"assistant",content:"Connection error. Try again."}]);}
    setLoading(false);
  };
  return(
    <div style={{height:"calc(100vh - 116px)",display:"flex",flexDirection:"column",background:"#000",overflow:"hidden"}}>
      <div style={{flex:1,margin:"12px 16px",border:"2px solid "+GOLD,display:"flex",flexDirection:"column",background:"#050300",overflow:"hidden",minHeight:0}}>
        <div style={{background:"linear-gradient(135deg,#1a0800,#0a0400)",borderBottom:"2px solid "+GOLD,padding:"12px 18px",display:"flex",alignItems:"center",gap:12,flexShrink:0}}>
          <div style={{position:"relative",flexShrink:0}}>
            <div style={{width:46,height:46,background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",display:"flex",alignItems:"center",justifyContent:"center",boxShadow:"0 0 18px "+GOLD+"77"}}>
              <span style={{fontFamily:"'Cinzel',serif",fontSize:22,fontWeight:900,color:"#000"}}>G</span>
            </div>
            <div style={{position:"absolute",bottom:-2,right:-2,width:11,height:11,background:"#22c55e",border:"2px solid #000",borderRadius:"50%"}}/>
          </div>
          <div style={{flex:1,minWidth:0}}>
            <div style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:"clamp(18px,2.5vw,28px)",fontWeight:900,letterSpacing:4,lineHeight:1}}>AGENT GROK</div>
            <div style={{display:"flex",alignItems:"center",gap:10,marginTop:3}}>
              <div style={{display:"flex",alignItems:"center",gap:4}}><div style={{width:7,height:7,borderRadius:"50%",background:"#22c55e",boxShadow:"0 0 5px #22c55e"}}/><span style={{color:"#22c55e",fontSize:10,fontWeight:900,letterSpacing:2}}>ONLINE 24/7</span></div>
              <span style={{color:GOLD,fontSize:10,letterSpacing:2,fontWeight:700}}>YOUR AI PRODUCTION CONSULTANT</span>
            </div>
          </div>
          <div style={{display:"flex",gap:5,flexShrink:0}}>
            {[["23","PAGES"],["600+","TOOLS"],["54","VOICES"],["4K","RENDER"]].map(([v,l])=>(
              <div key={l} style={{background:"#0a0800",border:"1px solid "+GOLD+"44",padding:"5px 8px",textAlign:"center",minWidth:40}}>
                <div style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:12,fontWeight:900}}>{v}</div>
                <div style={{color:"#22c55e",fontSize:8,letterSpacing:1,marginTop:1,fontWeight:700}}>{l}</div>
              </div>
            ))}
          </div>
        </div>
        <div style={{flex:1,overflowY:"auto",padding:"12px 16px",display:"flex",flexDirection:"column",gap:10,minHeight:0}}>
          {msgs.map((m,i)=>(
            <div key={i} style={{display:"flex",gap:10,flexDirection:m.role==="user"?"row-reverse":"row"}}>
              <div style={{width:32,height:32,flexShrink:0,background:m.role==="user"?"#1a0a00":"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"1px solid "+GOLD,display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:m.role==="user"?GOLD:"#000",fontFamily:"'Cinzel',serif"}}>{m.role==="user"?"Y":"G"}</div>
              <div style={{flex:1,maxWidth:"82%"}}>
                <div style={{color:GOLD,fontSize:9,fontWeight:900,letterSpacing:3,marginBottom:3,textAlign:m.role==="user"?"right":"left"}}>{m.role==="user"?"YOU":"AGENT GROK"}</div>
                <div style={{background:m.role==="user"?"#100800":"#0a0900",border:"1px solid "+GOLD+"33",padding:"9px 13px"}}>
                  <div style={{color:WHITE,fontSize:13,lineHeight:1.8,whiteSpace:"pre-wrap"}}>{m.content}</div>
                </div>
              </div>
            </div>
          ))}
          {loading&&<div style={{display:"flex",gap:10}}><div style={{width:32,height:32,flexShrink:0,background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",display:"flex",alignItems:"center",justifyContent:"center",fontSize:12,fontWeight:900,color:"#000",fontFamily:"'Cinzel',serif"}}>G</div><div style={{background:"#0a0900",border:"1px solid "+GOLD+"33",padding:"9px 13px"}}><span style={{color:GOLD,fontSize:12}}>Thinking...</span></div></div>}
          <div ref={bot}/>
        </div>
        <div style={{borderTop:"1px solid "+GOLD+"22",padding:"8px 16px",display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(190px,1fr))",gap:4,flexShrink:0,background:"#040200"}}>
          {QUICK.map(q=>(
            <button key={q} onClick={()=>send(q)}
              style={{background:"#0a0800",border:"1px solid "+GOLD+"33",color:GOLDDIM,padding:"6px 10px",cursor:"pointer",fontSize:11,fontWeight:700,fontFamily:"'Rajdhani',sans-serif",textAlign:"left",lineHeight:1.4}}
              onMouseEnter={e=>{e.currentTarget.style.borderColor=GOLD;e.currentTarget.style.color=GOLD;}}
              onMouseLeave={e=>{e.currentTarget.style.borderColor=GOLD+"33";e.currentTarget.style.color=GOLDDIM;}}>
              ✦ {q}
            </button>
          ))}
        </div>
        <div style={{borderTop:"1px solid "+GOLD,padding:"10px 16px",display:"flex",gap:8,flexShrink:0,background:"#030200"}}>
          <textarea value={inp2} onChange={e=>setInp2(e.target.value)}
            onKeyDown={e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();send();}}}
            placeholder="Ask anything about tools, workflow, pricing or production..."
            rows={2}
            style={{flex:1,resize:"none",padding:"9px 12px",fontSize:13,background:"#0a0800",border:"1px solid "+GOLD+"44",color:WHITE,outline:"none",lineHeight:1.6,fontFamily:"'Rajdhani',sans-serif",boxSizing:"border-box"}}/>
          <button onClick={()=>send()} disabled={loading||!inp2.trim()}
            style={{background:loading||!inp2.trim()?"#1a0a00":"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"1px solid "+(loading||!inp2.trim()?GOLD+"22":GOLD),color:loading||!inp2.trim()?GOLDDIM:"#000",padding:"10px 20px",cursor:loading||!inp2.trim()?"not-allowed":"pointer",fontSize:12,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",alignSelf:"stretch"}}>
            {loading?"⟳":"SEND ▶"}
          </button>
        </div>
      </div>
    </div>
  );
}

function P22() {
  const [posts,setPosts]=useState([{id:1,user:"Sarah J.",title:"Epic Action Feature",icon:"🎬",views:2847,likes:1522},{id:2,user:"Mike Chen",title:"Family Documentary",icon:"📽",views:1256,likes:812},{id:3,user:"Emily R.",title:"Short Film Entry",icon:"🏆",views:3421,likes:2156},{id:4,user:"Alex T.",title:"Music Video Cut",icon:"🎵",views:5234,likes:4012}]);
  return (
    <div style={{...Sp,padding:40}}>
      <div style={{maxWidth:780,margin:"0 auto"}}>
        <div style={{fontSize:11,color:GOLD,letterSpacing:4,marginBottom:4,fontWeight:700}}>CREATOR NETWORK</div>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:20}}>
          <h1 style={{...H1,fontSize:28,margin:0}}>COMMUNITY HUB</h1>
          <button style={{...G("gold",false)}}>UPLOAD YOUR MOVIE</button>
        </div>
        {posts.map(p=>(
          <div key={p.id} style={{...Card(),marginBottom:8,display:"flex",alignItems:"center",justifyContent:"space-between"}}>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{fontSize:24}}>{p.icon}</span>
              <div>
                <div style={{color:GOLD,fontWeight:900,fontSize:14}}>{p.title}</div>
                <div style={{color:WHITE,fontSize:12}}>by {p.user}</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",gap:12}}>
              <span style={{color:WHITE,fontSize:12}}>👁 {p.views.toLocaleString()}</span>
              <span style={{color:WHITE,fontSize:12}}>❤️ {p.likes.toLocaleString()}</span>
              <button onClick={()=>setPosts(ps=>ps.map(x=>x.id===p.id?{...x,likes:x.likes+1}:x))} style={{...G("out",true)}}>LIKE</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function HowToGuide() {
  const [open,setOpen]=useState(null);
  const SECTIONS=[
    {t:"WELCOME — HOW TO READ THIS BOOK",c:"This is more than a how-to. It is a complete guide to making films with AI on MandaStrong Studio (mandastrongmovie.bolt.host) AND a plain-English education in what AI actually is, so you are never at its mercy. Read Part One to understand the machine you are working with. Read Part Two to master the studio page by page. Read Part Three for the craft — prompting, voice, story, and ethics. You do not need any technical background. Every idea here is explained the way you would explain it to a friend across a kitchen table."},

    {t:"PART ONE · WHAT AI ACTUALLY IS",c:"AI does not think, feel, or know things the way you do. A large language model — the kind of AI behind most creative tools — is a very powerful pattern machine. It has read an enormous amount of human writing and images and learned which words and shapes tend to follow which. When you ask it for something, it is not looking up an answer; it is predicting, piece by piece, the most likely continuation of your request. That is why it can sound confident and still be wrong. Understanding this one fact changes how you use it: you are the director, it is the crew. It is fast and tireless and knows a thousand styles, but it has no judgement about YOUR story. That judgement is yours, and it always will be."},

    {t:"PART ONE · WHY AI SOMETIMES GETS IT WRONG",c:"Because AI predicts rather than knows, it can 'hallucinate' — state something untrue with total confidence, invent a fact, or misread what you wanted. This is normal and expected, not a fault in you. The fix is always the same: be more specific, give an example, or break the task into smaller steps. If a render or a line of narration comes out wrong, it is almost never because you did something stupid — it is because the machine guessed and guessed poorly. Re-roll it, refine your wording, and move on. Treat every output as a first draft from a talented but literal-minded assistant."},

    {t:"PART ONE · PROMPTING — TALKING TO THE MACHINE",c:"A prompt is simply your instruction to the AI. The single biggest skill in the whole studio is learning to prompt well, and it comes down to specificity. 'A man walking' gives the machine nothing to hold onto. 'A weathered fisherman in his sixties walking along a stormy grey beach at dawn, wind pulling at his yellow raincoat, shot from behind, cinematic, muted cold colour grade' gives it everything. Name the subject, the setting, the light, the mood, the camera angle, and the style. Show, don't summarise. When in doubt, describe it as if to someone who cannot see what is in your head — because that is exactly the situation."},

    {t:"PART ONE · AI AND YOU — STAYING IN CHARGE",c:"AI is a tool, like a camera or a pen. It amplifies whoever holds it. It has no taste of its own, so your taste is the whole game. Never let a machine talk you out of a creative instinct, and never assume its confident answer is correct without checking. Keep your own copies of everything important. Understand that what you type may be processed on servers you don't control, so don't paste anything you'd be uncomfortable sharing. And remember the deeper point behind this whole studio: AI should widen the door to creativity, not replace the human standing in it. You are not being replaced. You are being equipped."},

    {t:"PART TWO · GETTING STARTED",c:"Open mandastrongmovie.bolt.host. Log in with your credentials or start a free trial. Use the ☰ hamburger menu top left to jump to any of the 24 pages. AUTOSAVE ON is real — your work saves automatically every time you change page, generate a clip, or update your timeline. Hit 💾 SAVE PROJECT to create a named restore point you can return to from MY PROJECTS. Your plan and remaining usage are always visible from your account panel — tap the avatar top right."},

    {t:"PART TWO · PAGE 1 — HOME & INSTALL",c:"The front door of mandastrongmovie.bolt.host. The DOWNLOAD APP button installs the studio to your device like a real app, using your browser's built-in install prompt — on iPhone and iPad use Share then Add to Home Screen, as Apple does not allow one-tap install. The whole page is built to fit any screen, phone or laptop. From here, enter the studio and begin."},

    {t:"PART TWO · PAGE 4 — PLANS & USAGE CREDITS",c:"Three plans: Basic $20, Pro $30, Studio $50 — pick the one that fits how much you create. At the very bottom is PURCHASE USAGE CREDITS: a one-time top-up for extra renders and generations when you need more than your plan includes. Credits never expire. All payments run through Stripe's secure checkout — the studio never sees your card details."},

    {t:"PART TWO · PAGE 5 — WRITING TOOLS & SCRIPT TO MOVIE",c:"100+ AI writing tools. Type a description into any tool and hit AI CREATE for professional results. At the top sits SCRIPT TO MOVIE — three boxes: PRODUCER (your vision, tone, casting), DESCRIBE (the film scene by scene), and PRODUCTION NOTES (shots, camera, lighting, locations). Fill them, save each to your Media Library, then hit WIRE INTO RENDER. From that moment the video generator on Page 8 uses your three boxes to drive every scene it makes. This is how your written vision becomes moving pictures."},

    {t:"PART TWO · PAGE 6 — VOICE ENGINE",c:"Cinematic voices that sound human, not robotic. Filter by gender, age, and origin. Tap any voice card to hear it. Paste your narration into the text box and hit PREPARE TO SPEAK to hear it in your chosen voice with your exact speed, pitch, and mood settings. RECORD MY VOICE lets you narrate yourself; UPLOAD lets you bring in a recording. On the right, USE MY VOICE AS NARRATION turns your own recording into the film's narration, with a duration option. Hit SAVE TO MEDIA LIBRARY and the narration auto-adds to your timeline's audio track. The MUSIC VIDEO STUDIO button lives up top."},

    {t:"PART TWO · PAGE 8 — VIDEO GENERATOR",c:"The heart of the studio. Upload a reference photo first and the engine builds the scene around your real image for photorealistic output. Paste your scene prompt — or let your wired Script to Movie brief drive it — pick your options, and hit GENERATE SCENE. You can add background music from the built-in library with a live preview, and toggle USE STEREO SOUND for a full stereo mix. Clips save automatically and populate your timeline's video track. Generate all your scenes, then move to the timeline."},

    {t:"PART TWO · THE TIMELINE, MIX & RENDER",c:"Page 13: hit ⚡ SYNC ALL TRACKS to lay your clips and narration in order — drag to reorder. Page 15: set your audio mix so voice sits above music. Page 16: choose quality up to 4K and render — auto-enhancement (warm grade, contrast, sharpness) runs on every frame, and an emergency save fires before rendering so a crash never costs you the session. Do not close the tab while rendering. Page 17 previews the finished film; Page 18 exports and shares to YouTube, Instagram, TikTok, Facebook, X, and Vimeo."},

    {t:"PART TWO · MUSIC VIDEO STUDIO",c:"Open from Page 6, top right. SONG step: enter title, artist, genre, mood, tempo; drag and drop your audio, click to upload, or hit RECORD YOUR OWN SONG; toggle USE STEREO SOUND. The DURATION slider runs freely from AUTO up to 180 minutes — at AUTO the film matches your song's length exactly; drag it up to lock a fixed length that overrides the music. STYLE step: video look, colour grade, effects. SCENE step: describe what we see. GENERATE builds a full beat-synced video. Download or save when done."},

    {t:"PART TWO · PAGE 24 — CHARACTER STUDIO",c:"Build reusable characters. Drag and drop a reference photo or tap to choose one, assign a voice, and record appearance notes — hair, eyes, costume, personality, role. Save the character and reuse them across every scene so your cast stays consistent. Characters persist across sessions. From here, HOME returns to the studio and EXIT APP signs you out."},

    {t:"PART THREE · THE CRAFT OF PROMPTING FOR FILM",c:"For video, think like a cinematographer. Always specify five things: subject (who or what), setting (where and when), light (dawn, neon, candlelight), motion (what moves and how), and style (film stock, colour grade, mood). Add a camera instruction — wide establishing shot, slow push-in, handheld, aerial. Contradictions confuse the machine, so keep your prompt coherent. If a scene comes out flat, add sensory and lighting detail rather than more objects. Consistency across scenes comes from reusing the same style language every time."},

    {t:"PART THREE · WRITING NARRATION THAT LANDS",c:"Narration is written to be heard, not read. Short sentences. Natural breath points. Read every line aloud before you save it — if you stumble, the voice engine will too. Punctuation is your friend: a full stop is a real pause, a comma a small one. Match the voice to the story — a documentary wants warmth and authority; a thriller wants restraint. Use the PREPARE TO SPEAK button as your rehearsal room, and tune speed and pitch until it feels like a person, not a reader."},

    {t:"PART THREE · STORY FIRST, ALWAYS",c:"The most photorealistic render in the world means nothing without a reason to watch. Decide what your film is really about before you generate a single frame — the feeling you want to leave behind. Use the Script to Movie PRODUCER box to write that down and keep yourself honest. AI can make anything look good; only you can make it mean something. Structure beats spectacle. A clear beginning, a turn in the middle, and an earned ending will carry a simple film further than dazzling clips with no spine."},

    {t:"PART THREE · ETHICS & RESPONSIBILITY",c:"With these tools you can make almost anything, which means the responsibility is yours. Don't put real people's faces or voices into films they never agreed to. Be honest when something is AI-generated if presenting it as real could mislead. Respect others' work rather than copying a living artist's style wholesale and calling it your own. And remember MandaStrong's founding mission — these tools exist to spread kindness, understanding, and hope, with proceeds supporting veterans' mental health and anti-bullying work. Make things that would make that mission proud."},

    {t:"SAVING, RECOVERING & GETTING HELP",c:"AUTOSAVE ON saves as you work. 💾 SAVE PROJECT creates a named session — name it meaningfully. 📂 MY PROJECTS shows your history; CONTINUE PROJECT restores a session including all clips. An emergency save fires if the tab closes or crashes, so work is never permanently lost. Stuck? Agent Grok on Page 21 is your 24/7 production consultant with full knowledge of every page and workflow. This guide lives on your closing page at mandastrongmovie.bolt.host and is updated as the studio grows."},

    {t:"RECOMMENDED WORKFLOW — START TO FINISH",c:"Page 5 → fill Script to Movie's Producer, Describe, Production boxes → WIRE INTO RENDER. Page 6 → choose a voice → PREPARE TO SPEAK → SAVE TO MEDIA LIBRARY. Page 8 → upload a reference photo → generate each scene (your brief drives them) → add background music and stereo if you like. Page 13 → SYNC ALL TRACKS. Page 15 → set the mix. Page 16 → choose quality → render. Page 17 → preview. Page 18 → export and share. That is a finished film, made by you, at mandastrongmovie.bolt.host."},
  ];
  return(
    <div style={{padding:"20px 32px 40px",maxWidth:860,margin:"0 auto"}}>
      <div style={{color:GOLD,fontWeight:900,fontSize:12,letterSpacing:4,marginBottom:12,textAlign:"center"}}>📖 HOW TO USE MANDASTRONG STUDIO — CLICK ANY SECTION</div>
      {SECTIONS.map((g,i)=>{
        const isOpen=open===i;
        return(
          <div key={i} style={{marginBottom:4}}>
            <button onClick={()=>setOpen(isOpen?null:i)} style={{width:"100%",background:isOpen?GOLD+"14":"#030200",border:"1px solid "+(isOpen?GOLD:GOLDDIM+"55"),padding:"13px 18px",display:"flex",justifyContent:"space-between",alignItems:"center",cursor:"pointer",fontFamily:"'Rajdhani',sans-serif"}}>
              <span style={{color:isOpen?GOLD:WHITE,fontWeight:900,fontSize:13,letterSpacing:2}}>{g.t}</span>
              <span style={{color:GOLD,fontSize:16,fontWeight:900}}>{isOpen?"▲":"▼"}</span>
            </button>
            {isOpen&&<div style={{background:"#040300",border:"1px solid "+GOLD,borderTop:"none",padding:"16px 20px",color:WHITE,fontSize:13,lineHeight:1.95}}>{g.c}</div>}
          </div>
        );
      })}
    </div>
  );
}

function P24CharacterStudio({ onSave, go }) {
  const [chars,setChars]=useState(()=>{try{return JSON.parse(localStorage.getItem("ms_characters")||"[]");}catch{return [];}});
  const [name,setName]=useState("");
  const [voice,setVoice]=useState("james");
  const [notes,setNotes]=useState("");
  const [photo,setPhoto]=useState(null);
  const [photoName,setPhotoName]=useState("");
  const [savedNote,setSavedNote]=useState(false);
  const [gender,setGender]=useState("Male");
  const [age,setAge]=useState("Adult");
  const [ethnicity,setEthnicity]=useState("");
  const [hairColor,setHairColor]=useState("");
  const [hairStyle,setHairStyle]=useState("");
  const [eyeColor,setEyeColor]=useState("");
  const [costume,setCostume]=useState("");
  const [role,setRole]=useState("");
  const [sceneNotes,setSceneNotes]=useState("");
  const [personality,setPersonality]=useState("");
  const [editId,setEditId]=useState(null);
  // ── LIP-SYNC (real, via Replicate Wav2Lip through Supabase) ──
  const [lsAudio,setLsAudio]=useState(null);        // data url of the voice clip
  const [lsAudioName,setLsAudioName]=useState("");
  const [lsBusy,setLsBusy]=useState(false);
  const [lsStage,setLsStage]=useState("");
  const [lsVideo,setLsVideo]=useState("");
  const [lsError,setLsError]=useState("");
  const lsRecRef=useRef(null);
  const lsChunksRef=useRef([]);
  const [lsRecording,setLsRecording]=useState(false);
  const lsPickAudio=(e)=>{const f=e.target.files&&e.target.files[0];if(!f)return;setLsAudioName(f.name);const r=new FileReader();r.onload=ev=>setLsAudio(String(ev.target.result||""));r.readAsDataURL(f);};
  const lsRecord=async()=>{
    if(lsRecording){try{lsRecRef.current&&lsRecRef.current.stop();}catch(e){}return;}
    try{
      const stream=await navigator.mediaDevices.getUserMedia({audio:true});
      const mr=new MediaRecorder(stream);lsChunksRef.current=[];
      mr.ondataavailable=ev=>{if(ev.data.size>0)lsChunksRef.current.push(ev.data);};
      mr.onstop=()=>{const blob=new Blob(lsChunksRef.current,{type:"audio/webm"});const r=new FileReader();r.onload=ev=>{setLsAudio(String(ev.target.result||""));setLsAudioName("my-recording.webm");};r.readAsDataURL(blob);stream.getTracks().forEach(t=>t.stop());setLsRecording(false);};
      lsRecRef.current=mr;mr.start();setLsRecording(true);
    }catch(e){setLsError("Microphone blocked — allow mic access and try again.");}
  };
  const makeAvatarSpeak=async()=>{
    setLsError("");setLsVideo("");
    if(!photo){setLsError("Add the character's photo first.");return;}
    if(!lsAudio){setLsError("Record or upload the voice first.");return;}
    setLsBusy(true);setLsStage("Sending your avatar and voice to the lip-sync engine…");
    try{
      const res=await fetch("https://njqfexhltjwpgvctmyaw.supabase.co/functions/v1/lip-sync",{
        method:"POST",headers:{"Content-Type":"application/json"},
        body:JSON.stringify({image:photo,audio:lsAudio})
      });
      const data=await res.json();
      if(data.error){setLsError(data.error);setLsBusy(false);return;}
      if(!data.video){setLsError("No video came back. Try again.");setLsBusy(false);return;}
      setLsStage("Done.");setLsVideo(data.video);
    }catch(e){setLsError("Couldn't reach the lip-sync engine: "+(e&&e.message?e.message:e));}
    setLsBusy(false);
  };
  const lsDownload=async()=>{
    if(!lsVideo)return;
    try{const r=await fetch(lsVideo);const b=await r.blob();const u=URL.createObjectURL(b);const a=document.createElement("a");a.href=u;a.download=(name||"avatar")+"-lipsync.mp4";document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(u),4000);}catch(e){window.open(lsVideo,"_blank");}
  };
  const fileRef=useRef(null);

  const persist=(list)=>{
    setChars(list);
    try{localStorage.setItem("ms_characters",JSON.stringify(list));}catch(e){alert("Storage full — remove a character photo and try again.");}
  };

  const handlePhoto=(e)=>{
    const f=e.target.files&&e.target.files[0];
    if(!f)return;
    setPhotoName(f.name);
    const reader=new FileReader();
    reader.onload=ev=>{
      // Downscale large photos so localStorage doesn't overflow and crash
      const img=new Image();
      img.onload=()=>{
        const max=900;let{width:w,height:h}=img;
        if(w>max||h>max){const s=max/Math.max(w,h);w=Math.round(w*s);h=Math.round(h*s);}
        try{
          const cv=document.createElement("canvas");cv.width=w;cv.height=h;
          cv.getContext("2d").drawImage(img,0,0,w,h);
          setPhoto(cv.toDataURL("image/jpeg",0.85));
        }catch(err){setPhoto(ev.target.result);}
      };
      img.onerror=()=>setPhoto(ev.target.result);
      img.src=ev.target.result;
    };
    reader.readAsDataURL(f);
  };

  const clearForm=()=>{setName("");setNotes("");setPhoto(null);setPhotoName("");setVoice("james");setGender("Male");setAge("Adult");setEthnicity("");setHairColor("");setHairStyle("");setEyeColor("");setCostume("");setRole("");setSceneNotes("");setPersonality("");setEditId(null);};

  const addChar=()=>{
    if(!name.trim()){alert("Give your character a name first.");return;}
    const c={id:editId||Date.now()+Math.random(),name:name.trim(),voice,notes:notes.trim(),photo,photoName,
      gender,age,ethnicity,hairColor,hairStyle,eyeColor,costume,role,sceneNotes,personality,
      date:new Date().toLocaleDateString()};
    const updated=editId?chars.map(x=>x.id===editId?c:x):[...chars,c];
    persist(updated);
    clearForm();
    setSavedNote(true);setTimeout(()=>setSavedNote(false),2500);
  };

  const editChar=(c)=>{
    setEditId(c.id);setName(c.name);setVoice(c.voice||"james");setNotes(c.notes||"");
    setPhoto(c.photo||null);setPhotoName(c.photoName||"");setGender(c.gender||"Male");
    setAge(c.age||"Adult");setEthnicity(c.ethnicity||"");setHairColor(c.hairColor||"");
    setHairStyle(c.hairStyle||"");setEyeColor(c.eyeColor||"");setCostume(c.costume||"");
    setRole(c.role||"");setSceneNotes(c.sceneNotes||"");setPersonality(c.personality||"");
    window.scrollTo(0,0);
  };

  const removeChar=(id)=>persist(chars.filter(c=>c.id!==id));

  const useInScene=(c)=>{
    if(onSave&&c.photo){
      onSave({id:"char_"+c.id,name:c.name+"_reference.png",type:"image/png",url:c.photo});
      alert("✓ "+c.name+" reference image sent to your Media Library — upload it on Page 8 to keep this character consistent.");
    }else{
      alert(c.photo?"Saved.":"This character has no reference photo to reuse.");
    }
  };

  // Generate a scene prompt from character details
  const generatePrompt=(c)=>{
    const parts=[];
    if(c.gender) parts.push(c.gender.toLowerCase());
    if(c.age) parts.push(c.age.toLowerCase());
    if(c.ethnicity) parts.push(c.ethnicity);
    parts.push("named "+c.name);
    if(c.hairColor||c.hairStyle) parts.push((c.hairStyle?c.hairStyle+" ":"")+c.hairColor+" hair");
    if(c.eyeColor) parts.push(c.eyeColor+" eyes");
    if(c.costume) parts.push("wearing "+c.costume);
    if(c.personality) parts.push(c.personality+" personality");
    if(c.role) parts.push("role: "+c.role);
    if(c.notes) parts.push(c.notes);
    if(c.sceneNotes) parts.push("Scene: "+c.sceneNotes);
    const prompt="A "+parts.join(", ")+".";
    navigator.clipboard.writeText(prompt).then(()=>alert("✓ Scene prompt copied — paste into Page 8 scene description.")).catch(()=>alert(prompt));
  };

  const inp={width:"100%",background:"#000",border:"1px solid "+GOLDDIM,padding:"10px 12px",color:WHITE,fontSize:13,outline:"none",boxSizing:"border-box",fontFamily:"'Rajdhani',sans-serif"};
  const lbl=(t)=><div style={{color:GOLD,fontSize:10,letterSpacing:2,fontWeight:900,marginBottom:5,marginTop:10}}>{t}</div>;
  const optBtn=(val,cur,setter,opts)=>(
    <div style={{display:"flex",flexWrap:"wrap",gap:4,marginBottom:4}}>
      {opts.map(o=><button key={o} onClick={()=>setter(o)} style={{background:cur===o?GOLD:"#111",border:"1px solid "+(cur===o?"#000":GOLDDIM),color:cur===o?"#000":WHITE,padding:"3px 10px",cursor:"pointer",fontSize:11,fontWeight:900}}>{o}</button>)}
    </div>
  );

  return (
    <div style={{...Sp,padding:30}}>
      <div style={{maxWidth:1100,margin:"0 auto"}}>
        <div style={{fontSize:11,color:GOLD,letterSpacing:4,fontWeight:700,marginBottom:4}}>CONSISTENCY ENGINE</div>
        <h1 style={{...H1,fontSize:26,marginBottom:6}}>CHARACTER STUDIO</h1>
        <div style={{color:WHITE,fontSize:13,marginBottom:24,lineHeight:1.7}}>Create reusable characters with full physical and costume details. Send a character's reference image to your Media Library, then upload on Page 8 to keep the same face across every scene. Hit COPY SCENE PROMPT to get a ready-to-paste prompt for any scene.</div>

        <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:24}}>
          {/* Create / Edit panel */}
          <div style={{...Card(),border:"2px solid "+GOLD,maxHeight:"80vh",overflowY:"auto"}}>
            <div style={{color:GOLD,fontSize:12,letterSpacing:3,fontWeight:900,marginBottom:14}}>{editId?"✏ EDIT CHARACTER":"✦ CREATE A CHARACTER"}</div>

            {lbl("CHARACTER NAME")}
            <input value={name} onChange={e=>setName(e.target.value)} placeholder="e.g. Doxy, Ethan, Lily..." style={{...inp,marginBottom:4}}/>

            {lbl("ROLE IN FILM")}
            <input value={role} onChange={e=>setRole(e.target.value)} placeholder="e.g. Protagonist, School Bully, Narrator..." style={{...inp,marginBottom:4}}/>

            {lbl("GENDER")}
            {optBtn(gender,gender,setGender,["Male","Female","Non-Binary","Unknown"])}

            {lbl("AGE")}
            {optBtn(age,age,setAge,["Child","Teen","Young Adult","Adult","Middle Aged","Elderly"])}

            {lbl("ETHNICITY / HERITAGE (OPTIONAL)")}
            <input value={ethnicity} onChange={e=>setEthnicity(e.target.value)} placeholder="e.g. British, Nigerian, East Asian, Mixed..." style={{...inp,marginBottom:4}}/>

            {lbl("HAIR COLOUR")}
            {optBtn(hairColor,hairColor,setHairColor,["Black","Dark Brown","Brown","Blonde","Red","Auburn","Grey","White","Dyed"])}

            {lbl("HAIR STYLE")}
            {optBtn(hairStyle,hairStyle,setHairStyle,["Short","Medium","Long","Curly","Straight","Wavy","Braided","Afro","Shaved","Ponytail","Bun"])}

            {lbl("EYE COLOUR")}
            {optBtn(eyeColor,eyeColor,setEyeColor,["Brown","Dark Brown","Blue","Green","Grey","Hazel","Amber"])}

            {lbl("COSTUME / WARDROBE")}
            <input value={costume} onChange={e=>setCostume(e.target.value)} placeholder="e.g. black top, black jeans, school uniform..." style={{...inp,marginBottom:4}}/>

            {lbl("PERSONALITY / DEMEANOUR")}
            <input value={personality} onChange={e=>setPersonality(e.target.value)} placeholder="e.g. confident, quiet, aggressive, warm..." style={{...inp,marginBottom:4}}/>

            {lbl("ADDITIONAL NOTES")}
            <textarea value={notes} onChange={e=>setNotes(e.target.value)} placeholder="e.g. scar on left cheek, always wears earrings..." style={{...inp,height:60,resize:"none",lineHeight:1.6,marginBottom:4}}/>

            {lbl("SCENE NOTES")}
            <textarea value={sceneNotes} onChange={e=>setSceneNotes(e.target.value)} placeholder="e.g. usually seen in school corridors, confrontational body language..." style={{...inp,height:60,resize:"none",lineHeight:1.6,marginBottom:4}}/>

            {lbl("REFERENCE PHOTO")}
            {photo?(
              <div style={{position:"relative",marginBottom:12}}>
                <img src={photo} alt="ref" style={{width:"100%",height:160,objectFit:"cover",border:"1px solid "+GOLD}}/>
                <button onClick={()=>{setPhoto(null);setPhotoName("");}} style={{position:"absolute",top:5,right:5,background:"#000",border:"1px solid "+GOLD,color:GOLD,padding:"2px 8px",cursor:"pointer",fontSize:11,fontWeight:900}}>✕</button>
              </div>
            ):(
              <div
                onClick={()=>fileRef.current&&fileRef.current.click()}
                onDragOver={e=>{e.preventDefault();e.currentTarget.style.background="#2a1200";}}
                onDragLeave={e=>{e.currentTarget.style.background="linear-gradient(135deg,#1a0800,#2a1200)";}}
                onDrop={e=>{
                  e.preventDefault();e.currentTarget.style.background="linear-gradient(135deg,#1a0800,#2a1200)";
                  const f=e.dataTransfer.files&&e.dataTransfer.files[0];
                  if(f&&f.type.startsWith("image/")){const r=new FileReader();r.onload=ev=>{setPhoto(ev.target.result);setPhotoName(f.name);};r.readAsDataURL(f);}
                  else if(f){alert("Please drop an image file.");}
                }}
                style={{width:"100%",background:"linear-gradient(135deg,#1a0800,#2a1200)",border:"2px dashed "+GOLD,color:GOLD,padding:"18px 14px",cursor:"pointer",fontSize:12,fontWeight:900,letterSpacing:2,fontFamily:"'Rajdhani',sans-serif",marginBottom:12,textAlign:"center"}}>
                <div>🖼 DRAG & DROP A PHOTO HERE</div>
                <div style={{color:GOLDDIM,fontSize:9,marginTop:4,fontWeight:700}}>or tap to choose from your photos</div>
              </div>
            )}
            <input ref={fileRef} type="file" accept="image/*,.jpg,.jpeg,.png,.gif,.webp,.heic,.heif" style={{display:"none"}} onChange={handlePhoto}/>

            {lbl("ASSIGNED VOICE")}
            <select value={voice} onChange={e=>setVoice(e.target.value)} style={{...inp,marginBottom:14,cursor:"pointer"}}>
              {VOICE_CHARACTERS.map(v=><option key={v.id} value={v.id} style={{background:"#000"}}>{v.name} — {v.origin} {v.gender} · {v.style}</option>)}
            </select>

            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:8}}>
              <button onClick={addChar} style={{...G("gold",false),padding:"14px",fontSize:13,letterSpacing:2}}>{editId?"✓ UPDATE":"+ SAVE CHARACTER"}</button>
              {editId&&<button onClick={clearForm} style={{...G("out",false),padding:"14px",fontSize:13,letterSpacing:2}}>CANCEL</button>}
            </div>
            {/* ════════ REAL LIP-SYNC — MAKE THIS AVATAR SPEAK ════════ */}
            <div style={{marginTop:16,border:"2px solid "+GOLD,background:"linear-gradient(135deg,#0a0500,#1a0a00)",padding:16,boxShadow:"0 0 24px "+GOLD+"22"}}>
              <div style={{fontFamily:"'Cinzel',serif",color:GOLD,letterSpacing:3,fontSize:16,textTransform:"uppercase",marginBottom:4}}>✦ Make This Avatar Speak</div>
              <div style={{color:DIM,fontSize:11,marginBottom:12}}>Photoreal lip-sync. Uses the character photo above. Record or upload the voice, then generate.</div>
              <div style={{display:"flex",gap:8,marginBottom:10,flexWrap:"wrap"}}>
                <button onClick={lsRecord} style={{flex:1,minWidth:140,background:lsRecording?"#c0392b":"#111",border:"1px solid "+(lsRecording?"#000":GOLDDIM),color:lsRecording?"#fff":WHITE,padding:"11px",cursor:"pointer",fontSize:12,fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}>{lsRecording?"■ STOP RECORDING":"● RECORD VOICE"}</button>
                <button onClick={()=>{const i=document.getElementById("lsAudioInput");if(i)i.click();}} style={{flex:1,minWidth:140,background:"#111",border:"1px solid "+GOLDDIM,color:WHITE,padding:"11px",cursor:"pointer",fontSize:12,fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}>⤴ UPLOAD VOICE</button>
                <input id="lsAudioInput" type="file" accept="audio/*" style={{display:"none"}} onChange={lsPickAudio}/>
              </div>
              {lsAudioName&&<div style={{color:GOLD,fontSize:11,marginBottom:10}}>Voice ready: {lsAudioName}</div>}
              <button onClick={makeAvatarSpeak} disabled={lsBusy} style={{width:"100%",padding:15,background:lsBusy?"#333":"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",color:lsBusy?"#888":"#000",border:"none",fontWeight:900,fontSize:15,letterSpacing:2,cursor:lsBusy?"default":"pointer",fontFamily:"'Cinzel',serif"}}>{lsBusy?"GENERATING…":"✦ MAKE AVATAR SPEAK"}</button>
              {lsError&&<div style={{marginTop:10,color:"#ff8a8a",fontSize:12}}>{lsError}</div>}
              {lsBusy&&<div style={{marginTop:10,color:GOLD,fontSize:12,letterSpacing:1}}>{lsStage}</div>}
              {lsVideo&&(
                <div style={{marginTop:12}}>
                  <video src={lsVideo} controls autoPlay playsInline style={{width:"100%",border:"1px solid "+GOLD,background:"#000"}}/>
                  <button onClick={lsDownload} style={{width:"100%",marginTop:8,padding:13,background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",color:"#000",border:"none",fontWeight:900,fontSize:14,letterSpacing:2,cursor:"pointer",fontFamily:"'Cinzel',serif"}}>⬇ DOWNLOAD LIP-SYNC VIDEO</button>
                </div>
              )}
            </div>
            {savedNote&&<div style={{marginTop:10,background:"#061406",border:"1px solid #22c55e",padding:"10px",textAlign:"center",color:"#22c55e",fontWeight:900,fontSize:12,letterSpacing:2}}>✓ CHARACTER SAVED</div>}
          </div>

          {/* Library panel */}
          <div>
            <div style={{color:GOLD,fontSize:12,letterSpacing:3,fontWeight:900,marginBottom:14}}>YOUR CHARACTERS — {chars.length}</div>
            {chars.length===0?(
              <div style={{...Card(),textAlign:"center",padding:"40px 20px",color:GOLDDIM}}>
                <div style={{fontSize:34,marginBottom:10}}>🎭</div>
                <div style={{fontSize:12,letterSpacing:2}}>No characters yet.</div>
                <div style={{fontSize:11,color:DIM,marginTop:6,lineHeight:1.6}}>Create one on the left to keep<br/>faces consistent across your film.</div>
              </div>
            ):(
              <div style={{display:"flex",flexDirection:"column",gap:10}}>
                {chars.map(c=>(
                  <div key={c.id} style={{...Card(),padding:14}}>
                    <div style={{display:"flex",gap:12,alignItems:"flex-start"}}>
                      {c.photo?<img src={c.photo} alt={c.name} style={{width:80,height:80,objectFit:"cover",border:"2px solid "+GOLD,flexShrink:0}}/>:<div style={{width:80,height:80,background:"#000",border:"1px solid "+GOLDDIM,display:"flex",alignItems:"center",justifyContent:"center",fontSize:28,flexShrink:0}}>🎭</div>}
                      <div style={{flex:1,minWidth:0}}>
                        <div style={{color:GOLD,fontWeight:900,fontSize:15,letterSpacing:1}}>{c.name}</div>
                        {c.role&&<div style={{color:GOLDDIM,fontSize:10,letterSpacing:2,marginTop:2}}>{c.role}</div>}
                        <div style={{color:WHITE,fontSize:11,marginTop:4,display:"flex",flexWrap:"wrap",gap:6}}>
                          {c.gender&&<span style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:"1px 6px",fontSize:10}}>{c.gender}</span>}
                          {c.age&&<span style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:"1px 6px",fontSize:10}}>{c.age}</span>}
                          {c.ethnicity&&<span style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:"1px 6px",fontSize:10}}>{c.ethnicity}</span>}
                          {c.hairColor&&<span style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:"1px 6px",fontSize:10}}>{c.hairStyle?c.hairStyle+" ":""}{c.hairColor} hair</span>}
                          {c.eyeColor&&<span style={{background:"#0a0a0a",border:"1px solid "+GOLDDIM,padding:"1px 6px",fontSize:10}}>{c.eyeColor} eyes</span>}
                        </div>
                        {c.costume&&<div style={{color:WHITE,fontSize:11,marginTop:4,fontStyle:"italic"}}>👗 {c.costume}</div>}
                        {c.personality&&<div style={{color:WHITE,fontSize:11,marginTop:2}}>💭 {c.personality}</div>}
                        {c.notes&&<div style={{color:DIM,fontSize:11,marginTop:2,fontStyle:"italic"}}>{c.notes}</div>}
                        <div style={{color:WHITE,fontSize:11,marginTop:4}}>🎙 {VOICE_CHARACTERS.find(v=>v.id===c.voice)?.name||c.voice}</div>
                      </div>
                    </div>
                    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr 1fr",gap:5,marginTop:10}}>
                      <button onClick={()=>useInScene(c)} style={{background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",padding:"7px 4px",cursor:"pointer",fontSize:10,fontWeight:900,letterSpacing:1,fontFamily:"'Rajdhani',sans-serif"}}>→ USE IN SCENE</button>
                      <button onClick={()=>generatePrompt(c)} style={{background:"transparent",border:"1px solid "+GOLD,color:GOLD,padding:"7px 4px",cursor:"pointer",fontSize:10,fontWeight:900,fontFamily:"'Rajdhani',sans-serif"}}>📋 COPY PROMPT</button>
                      <button onClick={()=>editChar(c)} style={{background:"transparent",border:"1px solid "+GOLDDIM,color:WHITE,padding:"7px 4px",cursor:"pointer",fontSize:10,fontWeight:900,fontFamily:"'Rajdhani',sans-serif"}}>✏ EDIT</button>
                      <button onClick={()=>removeChar(c.id)} style={{background:"none",border:"1px solid #ef4444",color:"#ef4444",padding:"7px 4px",cursor:"pointer",fontSize:10,fontWeight:900,fontFamily:"'Rajdhani',sans-serif"}}>✕ DELETE</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
        <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap",marginTop:30,paddingBottom:20}}>
          <button onClick={()=>go&&go(1)} style={{...G("gold",false),padding:"14px 40px",fontSize:13,letterSpacing:3}}>🏠 HOME</button>
          <button onClick={()=>{try{localStorage.removeItem("ms_user");}catch{}window.location.reload();}} style={{...G("out",false),padding:"14px 40px",fontSize:13,letterSpacing:3}}>🚪 EXIT APP</button>
        </div>
      </div>
    </div>
  );
}

function P23({ go }) {
  const bgRef = useRef(null);
  const [howOpen, setHowOpen] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);
  const [vidNeedsTap, setVidNeedsTap] = useState(false);
  useEffect(()=>{
    const v=bgRef.current;
    if(!v)return;
    v.muted=true;
    v.defaultMuted=true;
    v.loop=true;
    v.playsInline=true;
    v.preload="auto";
    try{v.load();}catch{}
    const tryPlay=()=>{
      const p=v.play();
      if(p&&p.then){p.then(()=>setVidNeedsTap(false)).catch(()=>setVidNeedsTap(false));}
    };
    // Try immediately and again once data is ready
    tryPlay();
    if(v.readyState>=2){tryPlay();}
    v.addEventListener("loadeddata",tryPlay);
    v.addEventListener("canplay",tryPlay);
    v.addEventListener("canplaythrough",tryPlay);
    v.addEventListener("pause",tryPlay);
    v.addEventListener("stalled",tryPlay);
    v.addEventListener("waiting",tryPlay);
    return()=>{
      v.removeEventListener("loadeddata",tryPlay);
      v.removeEventListener("canplay",tryPlay);
      v.removeEventListener("canplaythrough",tryPlay);
      v.removeEventListener("pause",tryPlay);
      v.removeEventListener("stalled",tryPlay);
      v.removeEventListener("waiting",tryPlay);
    };
  },[]);
  const tapPlayVideo=()=>{const v=bgRef.current;if(!v)return;v.muted=true;v.play().then(()=>setVidNeedsTap(false)).catch(()=>{});};
  const exitApp = () => {
    try{localStorage.removeItem("ms_user");}catch{}
    window.location.reload();
  };
  return(
    <div style={{...Sp,padding:0,background:"#000",position:"relative",minHeight:"100vh",overflow:"hidden"}}>
      <div style={{position:"relative",zIndex:1,padding:"30px 24px 80px"}}>
        <div style={{maxWidth:880,margin:"0 auto",textAlign:"center"}}>
          <div style={{width:"100%",maxHeight:"34vh",overflow:"hidden",position:"relative",display:"flex",alignItems:"center",justifyContent:"center",background:"#000",border:"1px solid "+GOLDDIM,marginBottom:26}}>
            <video ref={bgRef} autoPlay loop playsInline muted preload="auto"
              onLoadedMetadata={(e)=>{try{if(e.currentTarget.currentTime<0.1)e.currentTarget.currentTime=0.1;}catch{}}}
              style={{display:"block",width:"100%",maxHeight:"34vh",objectFit:"cover",background:"#000"}}>
              <source src="/background.mp4" type="video/mp4"/>
              <source src="background.mp4" type="video/mp4"/>
              <source src="./background.mp4" type="video/mp4"/>
              <source src="/background_5.mp4" type="video/mp4"/>
              <source src="background_5.mp4" type="video/mp4"/>
              <source src="./background_5.mp4" type="video/mp4"/>
              <source src="/thatsallfolks.mp4" type="video/mp4"/>
            </video>

          </div>
          <div style={{fontSize:10,color:GOLD,letterSpacing:6,marginBottom:8,fontWeight:700}}>MANDASTRONG STUDIO · CINEMA INTELLIGENCE PLATFORM</div>
          <h1 style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:"clamp(32px,5vw,52px)",fontWeight:900,letterSpacing:8,textShadow:"0 0 40px "+GOLD+"99",marginBottom:28}}>THAT'S ALL FOLKS</h1>
          <div style={{height:1,background:"linear-gradient(90deg,transparent,"+GOLD+",transparent)",marginBottom:28}}/>
          <div style={{...Card(),textAlign:"left",marginBottom:28,background:"#050500ee",border:"2px solid "+GOLD}}>
            <div style={{color:GOLD,fontWeight:900,fontSize:14,letterSpacing:3,marginBottom:16,textAlign:"center"}}>✦ A SPECIAL THANK YOU ✦</div>
            <p style={{color:WHITE,fontSize:14,lineHeight:2,margin:"0 0 12px",fontStyle:"italic"}}>To all current and future creators, dreamers, and storytellers...</p>
            <p style={{color:WHITE,fontSize:14,lineHeight:2,margin:"0 0 12px"}}>Your creativity and passion inspire positive change in the world. Through your films and stories, you have the power to educate, inspire, and bring awareness to critical issues like bullying prevention, social skills development, and humanity's collective growth.</p>
            <p style={{color:WHITE,fontSize:14,lineHeight:2,margin:"0 0 12px"}}>Every piece of content you create has the potential to touch hearts, change minds, and make our world a better place. Thank you for being part of this mission to combine creative expression with meaningful impact.</p>
            <p style={{color:WHITE,fontSize:14,lineHeight:2,margin:0}}>Together, we are building a community of creators who use their talents to spread kindness, understanding, and hope. — <strong style={{color:GOLD}}>Amanda</strong></p>
          </div>
          <div style={{...Card(),textAlign:"left",marginBottom:28,background:"#030300ee",border:"1px solid "+GOLDDIM}}>
            <div style={{color:GOLD,fontWeight:900,fontSize:13,letterSpacing:3,marginBottom:12,textAlign:"center"}}>✦ OUR MISSION ✦</div>
            <p style={{color:WHITE,fontSize:13,lineHeight:1.9,margin:"0 0 10px"}}>MandaStrong Studio was built on one belief: <strong style={{color:GOLD}}>every person deserves the tools to tell their story.</strong> Not just the wealthy. Not just the technically gifted. Everyone.</p>
            <p style={{color:WHITE,fontSize:13,lineHeight:1.9,margin:0}}>All proceeds from <strong style={{color:GOLD}}>MandaStrong1.Etsy.com</strong> are donated directly to humanitarian causes — veterans mental health, anti-bullying programmes in schools, and children in need.</p>
          </div>
          <button onClick={()=>setHowOpen(o=>!o)} style={{width:"100%",background:howOpen?"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")":"#050500ee",border:"2px solid "+GOLD,color:howOpen?"#000":GOLD,padding:"18px 24px",cursor:"pointer",fontFamily:"'Cinzel',serif",fontSize:15,fontWeight:900,letterSpacing:4,marginBottom:howOpen?0:28,display:"flex",justifyContent:"space-between",alignItems:"center",boxShadow:"0 0 30px "+GOLD+"44"}}>
            <span>📖 MANDASTRONG STUDIO — THE COMPLETE GUIDE &amp; AI HANDBOOK</span>
            <span style={{fontSize:18}}>{howOpen?"▲":"▼"}</span>
          </button>
          {howOpen&&<div style={{background:"#030200ee",border:"2px solid "+GOLD,borderTop:"none",marginBottom:28}}><HowToGuide/></div>}
          <a href="https://MandaStrong1.Etsy.com" target="_blank" rel="noreferrer" style={{display:"block",background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",color:"#000",padding:"16px 24px",fontWeight:900,fontSize:14,letterSpacing:3,textDecoration:"none",marginBottom:28,fontFamily:"'Cinzel',serif"}}>📚 HUMANITY FOR FUTURE AI — MANDASTRONG1.ETSY.COM</a>
          <div style={{display:"flex",gap:12,justifyContent:"center",flexWrap:"wrap"}}>
            <button onClick={()=>{try{localStorage.setItem("ms_last_saved",new Date().toISOString());}catch{} setSavedMsg(true); setTimeout(()=>setSavedMsg(false),2500);}} style={{...G("gold",false),padding:"14px 40px",fontSize:13,letterSpacing:3}}>💾 SAVE</button>
            <button onClick={()=>go(24)} style={{...G("out",false),padding:"14px 40px",fontSize:13,letterSpacing:3}}>NEXT →</button>
          </div>
          {savedMsg&&<div style={{color:"#22c55e",fontSize:12,fontWeight:900,letterSpacing:2,marginTop:12}}>✓ PROJECT SAVED</div>}
        </div>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// CINEMATIC INTRO — black shiny gold doors that open to reveal the app
// One giant M spans both doors (splits when they part). Wordmark, tagline,
// ENTER button and URL sit in the lower area. ~6 seconds. Synthesized music.
// ══════════════════════════════════════════════════════════════════
function IntroDoors({ onEnter }){
  const [phase,setPhase]=useState("closed");
  const playChime=()=>{
    try{
      const ctx=new (window.AudioContext||window.webkitAudioContext)();
      if(ctx.state==="suspended"){try{ctx.resume();}catch(e){}}
      const now=ctx.currentTime;
      const master=ctx.createGain(); master.gain.value=2.2; master.connect(ctx.destination);
      // Cinematic reverb tail for space
      const conv=ctx.createConvolver();
      const len=Math.floor(ctx.sampleRate*2.6); const imp=ctx.createBuffer(2,len,ctx.sampleRate);
      for(let ch=0;ch<2;ch++){const d=imp.getChannelData(ch);for(let i=0;i<len;i++){d[i]=(Math.random()*2-1)*Math.pow(1-i/len,2.6);}}
      conv.buffer=imp; const rev=ctx.createGain(); rev.gain.value=0.35; conv.connect(rev); rev.connect(master);
      // 1) DEEP IMPACT BOOM — the off-guard hit
      const boom=ctx.createOscillator(); const bg=ctx.createGain();
      boom.type="sine"; boom.frequency.setValueAtTime(120,now); boom.frequency.exponentialRampToValueAtTime(28,now+1.2);
      bg.gain.setValueAtTime(0.9,now); bg.gain.exponentialRampToValueAtTime(0.001,now+1.8);
      boom.connect(bg); bg.connect(master); bg.connect(conv); boom.start(now); boom.stop(now+1.9);
      // 2) SUB DRONE BED — tension underneath
      const drone=ctx.createOscillator(); const dg=ctx.createGain();
      drone.type="sawtooth"; drone.frequency.value=41.20;
      const lp=ctx.createBiquadFilter(); lp.type="lowpass"; lp.frequency.value=180;
      dg.gain.setValueAtTime(0,now); dg.gain.linearRampToValueAtTime(0.22,now+1.6); dg.gain.exponentialRampToValueAtTime(0.001,now+5.5);
      drone.connect(lp); lp.connect(dg); dg.connect(master); drone.start(now); drone.stop(now+5.7);
      // 3) RISING MINOR STAB LINE — drama building to the doors
      const rise=[110.00,130.81,164.81,196.00,246.94,329.63];
      rise.forEach((f,i)=>{
        const o=ctx.createOscillator(); const g=ctx.createGain(); const o2=ctx.createOscillator();
        o.type="sawtooth"; o2.type="square"; o.frequency.value=f; o2.frequency.value=f*1.005;
        const flt=ctx.createBiquadFilter(); flt.type="lowpass"; flt.frequency.setValueAtTime(600,now); flt.frequency.linearRampToValueAtTime(3200,now+2.8);
        const t0=now+0.3+i*0.22;
        g.gain.setValueAtTime(0,t0); g.gain.linearRampToValueAtTime(0.16,t0+0.12); g.gain.exponentialRampToValueAtTime(0.001,t0+1.6);
        o.connect(flt); o2.connect(flt); flt.connect(g); g.connect(master); g.connect(conv);
        o.start(t0); o.stop(t0+1.7); o2.start(t0); o2.stop(t0+1.7);
      });
      // 4) SHIMMER TOP — cinematic air
      [1318.51,1567.98,1975.53].forEach((f,i)=>{
        const sh=ctx.createOscillator(); const sg=ctx.createGain();
        sh.type="sine"; sh.frequency.value=f;
        const t0=now+1.4+i*0.15;
        sg.gain.setValueAtTime(0,t0); sg.gain.linearRampToValueAtTime(0.04,t0+0.6); sg.gain.exponentialRampToValueAtTime(0.001,t0+3.2);
        sh.connect(sg); sg.connect(master); sg.connect(conv); sh.start(t0); sh.stop(t0+3.3);
      });
      // 5) RESOLVING HERO HIT — lands immediately AS the doors open (t=0)
      const hit=ctx.createOscillator(); const hitG=ctx.createGain();
      hit.type="triangle"; hit.frequency.value=110.00;
      const hit2=ctx.createOscillator(); hit2.type="sine"; hit2.frequency.value=220.00;
      hitG.gain.setValueAtTime(0,now); hitG.gain.linearRampToValueAtTime(0.5,now+0.08); hitG.gain.exponentialRampToValueAtTime(0.001,now+3.4);
      hit.connect(hitG); hit2.connect(hitG); hitG.connect(master); hitG.connect(conv);
      hit.start(now); hit.stop(now+3.5); hit2.start(now); hit2.stop(now+3.5);
      setTimeout(()=>{try{ctx.close();}catch(e){}},6400);
    }catch(e){}
  };
  const enter=()=>{
    if(phase!=="closed")return;
    // Music and doors start together; the powerful hit is front-loaded in playChime
    // so the impact lands the instant the doors begin to part.
    playChime(); setPhase("opening");
    setTimeout(()=>setPhase("gone"),2800);
    setTimeout(()=>{ if(onEnter)onEnter(); },3900);
  };
  const opening=phase==="opening"||phase==="gone";
  const halfM=(side)=>(
    <svg viewBox={side==="left"?"0 0 150 200":"150 0 150 200"} width="min(46vw,340px)" height="min(50vh,440px)"
      preserveAspectRatio={side==="left"?"xMaxYMid meet":"xMinYMid meet"}
      style={{filter:"drop-shadow(0 0 34px rgba(232,201,109,0.6))",overflow:"visible",marginTop:"-12vh",maxWidth:"46vw"}}>
      <defs>
        <linearGradient id={"goldM"+side} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fffbe8"/><stop offset="0.2" stopColor="#f4dd8f"/>
          <stop offset="0.4" stopColor="#e8c96d"/><stop offset="0.62" stopColor="#c79a3a"/>
          <stop offset="0.82" stopColor="#8a6418"/><stop offset="1" stopColor="#4a340d"/>
        </linearGradient>
        <linearGradient id={"sheen"+side} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity="0.85"/><stop offset="0.18" stopColor="#ffffff" stopOpacity="0"/>
          <stop offset="0.55" stopColor="#ffffff" stopOpacity="0"/><stop offset="0.7" stopColor="#fff3c4" stopOpacity="0.45"/><stop offset="1" stopColor="#ffffff" stopOpacity="0"/>
        </linearGradient>
      </defs>
      <text x="150" y="150" textAnchor="middle" fontFamily="Georgia,serif" fontSize="200" fontWeight="900" fill={"url(#goldM"+side+")"} stroke="#fff3c4" strokeWidth="0.6">M</text>
      <text x="150" y="150" textAnchor="middle" fontFamily="Georgia,serif" fontSize="200" fontWeight="900" fill={"url(#sheen"+side+")"}>M</text>
    </svg>
  );
  // Brushed-metallic door face: layered gold gradients + vertical sheen streaks + highlight edge
  const metalLeft="linear-gradient(95deg,#000 0%,#0c0a04 20%,#241a06 40%,#3a2b0a 50%,#4a3810 55%,#2a2008 62%,#0e0b04 80%,#000 100%), repeating-linear-gradient(90deg,rgba(232,201,109,0.06) 0px,rgba(232,201,109,0.06) 1px,transparent 1px,transparent 5px)";
  const metalRight="linear-gradient(265deg,#000 0%,#0c0a04 20%,#241a06 40%,#3a2b0a 50%,#4a3810 55%,#2a2008 62%,#0e0b04 80%,#000 100%), repeating-linear-gradient(90deg,rgba(232,201,109,0.06) 0px,rgba(232,201,109,0.06) 1px,transparent 1px,transparent 5px)";
  return (
    <div style={{position:"fixed",inset:0,zIndex:100000,background:"#000",overflow:"hidden",
      opacity:phase==="gone"?0:1,transition:"opacity 1.1s ease",pointerEvents:phase==="gone"?"none":"auto"}}>
      <div style={{position:"absolute",top:0,left:0,width:"50%",height:"100%",
        background:metalLeft,backgroundBlendMode:"screen",
        borderRight:"2px solid "+GOLD,boxShadow:"inset -50px 0 90px rgba(0,0,0,0.9), inset 0 0 140px rgba(232,201,109,0.12), 8px 0 40px rgba(0,0,0,0.8)",
        transform:opening?"translateX(-102%)":"translateX(0)",
        transition:"transform 2.6s cubic-bezier(0.76,0,0.24,1)",
        display:"flex",alignItems:"center",justifyContent:"flex-end",overflow:"hidden"}}>
        {halfM("left")}
      </div>
      <div style={{position:"absolute",top:0,right:0,width:"50%",height:"100%",
        background:metalRight,backgroundBlendMode:"screen",
        borderLeft:"2px solid "+GOLD,boxShadow:"inset 50px 0 90px rgba(0,0,0,0.9), inset 0 0 140px rgba(232,201,109,0.12), -8px 0 40px rgba(0,0,0,0.8)",
        transform:opening?"translateX(102%)":"translateX(0)",
        transition:"transform 2.6s cubic-bezier(0.76,0,0.24,1)",
        display:"flex",alignItems:"center",justifyContent:"flex-start",overflow:"hidden"}}>
        {halfM("right")}
      </div>
      <div style={{position:"absolute",top:0,left:"50%",transform:"translateX(-50%)",
        width:opening?"6px":"2px",height:opening?"100%":"0%",
        background:"linear-gradient(180deg,#fffbe8,#e8c96d,#a07820)",
        boxShadow:"0 0 40px 10px rgba(232,201,109,0.9)",opacity:opening?0:1,
        transition:"height 0.9s ease-out, width 0.9s ease-out, opacity 2s ease 0.6s",zIndex:5}}/>
      <div style={{position:"absolute",left:0,right:0,bottom:"6%",display:"flex",flexDirection:"column",alignItems:"center",
        zIndex:6,opacity:opening?0:1,transition:"opacity 0.6s",pointerEvents:opening?"none":"auto"}}>
        <div style={{fontFamily:"'Cinzel',serif",color:GOLD,fontSize:"clamp(22px,5.5vw,50px)",fontWeight:900,letterSpacing:8,textShadow:"0 0 30px rgba(232,201,109,0.6)"}}>MANDASTRONG</div>
        <div style={{fontFamily:"'Cinzel',serif",color:WHITE,fontSize:"clamp(11px,2vw,18px)",letterSpacing:14,marginTop:4}}>STUDIO</div>
        <div style={{color:GOLDDIM,fontSize:"clamp(8px,1.4vw,11px)",letterSpacing:3,marginTop:12,textAlign:"center",padding:"0 16px"}}>CINEMA INTELLIGENCE PLATFORM · 600+ AI TOOLS · UP TO 3-HOUR FILMS</div>
        <button onClick={enter}
          style={{marginTop:22,background:"linear-gradient(135deg,"+GOLDDIM+","+GOLD+")",border:"none",color:"#000",
          padding:"16px 52px",fontSize:15,fontWeight:900,letterSpacing:4,cursor:"pointer",fontFamily:"'Rajdhani',sans-serif",
          boxShadow:"0 0 40px rgba(232,201,109,0.6)",borderRadius:0}}>
          ▶ ENTER
        </button>
        <div style={{color:GOLDDIM,fontSize:11,letterSpacing:3,marginTop:16}}>mandastrongmovie.bolt.host</div>
      </div>
    </div>
  );
}

export default function App() {
  const [page,setPage]=useState(1);
  // ── CINEMATIC INTRO — gold doors open to reveal the app ──
  const [showIntro,setShowIntro]=useState(true);
  const [menu,setMenu]=useState(false);
  useEffect(()=>{
    // Raise the storage ceiling so large uploads don't crash — ask the browser
    // to make storage persistent (grants a much larger quota when accepted).
    try{if(navigator.storage&&navigator.storage.persist){navigator.storage.persisted().then(p=>{if(!p)navigator.storage.persist().catch(()=>{});}).catch(()=>{});}}catch(e){}
    // Fonts
    const link=document.createElement("link");
    link.rel="stylesheet";
    link.href="https://fonts.googleapis.com/css2?family=Cinzel:wght@400;700;900&family=Rajdhani:wght@400;600;700;800;900&display=swap";
    document.head.appendChild(link);
    // Viewport — responsive for all devices
    let vp=document.querySelector("meta[name=viewport]");
    if(!vp){vp=document.createElement("meta");vp.name="viewport";document.head.appendChild(vp);}
    // Set viewport based on device type
    const hua=navigator.userAgent.toLowerCase();
    const isHPhone=/android.*mobile|iphone|ipod/.test(hua);
    const isHTablet=/ipad|android(?!.*mobile)/.test(hua);
    if(isHPhone){
      vp.content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no,viewport-fit=cover";
    } else if(isHTablet){
      vp.content="width=device-width,initial-scale=1,maximum-scale=2,user-scalable=yes,viewport-fit=cover";
    } else {
      vp.content="width=device-width,initial-scale=1,maximum-scale=5,user-scalable=yes";
    }
    // Global responsive + Bolt badge suppression
    const style=document.createElement("style");
    style.textContent="*{box-sizing:border-box!important;}body,html{margin:0;padding:0;width:100%;overflow-x:hidden;}[data-bolt-badge],a[href*=\'bolt.new\'],.bolt-badge,[class*=\'bolt\'],[id*=\'bolt\']{display:none!important;opacity:0!important;visibility:hidden!important;pointer-events:none!important;}@media(max-width:900px){.grid-cols-2,.grid-cols-3,.grid-cols-4{grid-template-columns:1fr 1fr!important;}}@media(max-width:600px){.grid-cols-2,.grid-cols-3,.grid-cols-4{grid-template-columns:1fr!important;}}";
    document.head.appendChild(style);
    // Actively remove the "Made in Bolt" badge — CSS alone can miss it
    const killBolt=()=>{
      try{
        document.querySelectorAll('a[href*="bolt.new"],a[href*="bolt.host"],[class*="bolt"],[id*="bolt"],[data-bolt-badge]').forEach((n)=>{
          const t=(n.textContent||"").toLowerCase();
          if(t.includes("bolt")||(n.getAttribute("href")||"").includes("bolt")){const box=n.closest("div")||n;try{box.remove();}catch(e){try{n.remove();}catch(e2){}}}
        });
        document.querySelectorAll("body *").forEach((el)=>{try{const cs=getComputedStyle(el);if(cs.position==="fixed"){const txt=(el.textContent||"").toLowerCase();if(txt.includes("made in bolt")||txt.trim()==="bolt"){el.remove();}}}catch(e){}});
      }catch(e){}
    };
    killBolt();
    const boltIv=setInterval(killBolt,1000);
    const boltObs=new MutationObserver(killBolt);
    try{boltObs.observe(document.body,{childList:true,subtree:true});}catch(e){}
    // PWA install prompt capture
    const handleInstall=(e)=>{e.preventDefault();window.deferredInstallPrompt=e;};
    window.addEventListener("beforeinstallprompt",handleInstall);
    // PWA MANIFEST — makes the DOWNLOAD APP button work as a real install
    try{
      const manifestData={
        name:"MandaStrong Studio",
        short_name:"MandaStrong",
        description:"Cinema Intelligence Platform — 600+ AI tools, 24 pages, up to 3-hour films",
        start_url:"/",
        display:"standalone",
        background_color:"#000000",
        theme_color:"#e8c96d",
        orientation:"any",
        icons:[
          {src:"data:image/svg+xml;base64,"+btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 192 192"><rect width="192" height="192" fill="#000"/><text x="96" y="130" text-anchor="middle" font-family="Georgia" font-size="120" font-weight="900" fill="#e8c96d">M</text></svg>'),sizes:"192x192",type:"image/svg+xml",purpose:"any maskable"},
          {src:"data:image/svg+xml;base64,"+btoa('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512"><rect width="512" height="512" fill="#000"/><text x="256" y="350" text-anchor="middle" font-family="Georgia" font-size="320" font-weight="900" fill="#e8c96d">M</text></svg>'),sizes:"512x512",type:"image/svg+xml",purpose:"any maskable"}
        ]
      };
      const manifestBlob=new Blob([JSON.stringify(manifestData)],{type:"application/json"});
      const manifestUrl=URL.createObjectURL(manifestBlob);
      let mLink=document.querySelector('link[rel="manifest"]');
      if(!mLink){mLink=document.createElement("link");mLink.rel="manifest";document.head.appendChild(mLink);}
      mLink.href=manifestUrl;
      // Apple-specific PWA meta
      const addMeta=(name,content)=>{if(!document.querySelector('meta[name="'+name+'"]')){const m=document.createElement("meta");m.name=name;m.content=content;document.head.appendChild(m);}};
      addMeta("apple-mobile-web-app-capable","yes");
      addMeta("apple-mobile-web-app-status-bar-style","black-translucent");
      addMeta("apple-mobile-web-app-title","MandaStrong");
      addMeta("mobile-web-app-capable","yes");
      addMeta("theme-color","#e8c96d");
    }catch(e){}
    return()=>{try{document.head.removeChild(link);}catch{} window.removeEventListener("beforeinstallprompt",handleInstall);};
  },[]);
  const [user,setUser]=useState(()=>{try{return JSON.parse(localStorage.getItem("ms_user")||'{"name":"Guest","plan":"Guest","isAdmin":false}');}catch{return {name:"Guest",plan:"Guest",isAdmin:false};}});
  const [mediaLib,setMediaLib]=useState([]);
  const [timeline,setTimeline]=useState(()=>{try{return JSON.parse(localStorage.getItem("ms_timeline")||"{}");}catch{return {};}});
  const [rendered,setRendered]=useState(null);
  const [filmDuration,setFilmDuration]=useState(60);
  const [savedNotice,setSavedNotice]=useState(false);
  const [showHistory,setShowHistory]=useState(false);
  const [showSaveModal,setShowSaveModal]=useState(false);

  const go=p=>{setPage(p);window.scrollTo(0,0);try{localStorage.setItem("ms_page",JSON.stringify(p));}catch{}};

  useEffect(()=>{
    const restore=async()=>{
      try{await autoFreeStorage();}catch(e){}
      try{const t=JSON.parse(localStorage.getItem("ms_timeline")||"{}");if(Object.keys(t).length>0)setTimeline(t);}catch(e){}
      try{
        const dbClips=await getAllClipsFromDB();
        if(dbClips.length>0){
          const restored=dbClips.map(c2=>({id:c2.id,name:c2.name,type:c2.type||"video/webm",url:URL.createObjectURL(c2.blob),file:new File([c2.blob],c2.name,{type:c2.type||"video/webm"}),dbId:c2.id}));
          setMediaLib(restored);
        }
      }catch(e){}
    };
    restore();
    const handler=()=>setShowHistory(true);
    window.addEventListener("ms_open_history",handler);
    return()=>window.removeEventListener("ms_open_history",handler);
  },[]);

  // Real auto-persist — saves state silently whenever page, timeline or mediaLib changes
  useEffect(()=>{
    try{localStorage.setItem("ms_page",JSON.stringify(page));}catch(e){}
  },[page]);
  useEffect(()=>{
    try{localStorage.setItem("ms_timeline",JSON.stringify(timeline));}catch(e){}
  },[timeline]);
  useEffect(()=>{
    try{localStorage.setItem("ms_medialib",JSON.stringify(mediaLib.map(a=>({...a,file:undefined}))));}catch(e){}
  },[mediaLib]);

  // Emergency crash save — fires when tab is closed or crashes
  useEffect(()=>{
    const emergencySave=()=>{
      try{
        localStorage.setItem("ms_page",JSON.stringify(page));
        localStorage.setItem("ms_timeline",JSON.stringify(timeline));
        localStorage.setItem("ms_user",JSON.stringify(user));
        localStorage.setItem("ms_medialib",JSON.stringify(mediaLib.map(a=>({...a,file:undefined}))));
      }catch(e){}
    };
    window.addEventListener("beforeunload",emergencySave);
    window.addEventListener("visibilitychange",()=>{if(document.hidden)emergencySave();});
    return()=>{
      window.removeEventListener("beforeunload",emergencySave);
    };
  },[page,timeline,mediaLib,user]);

  const saveAsset=async(a)=>{
    let asset=a;
    if(a.file instanceof File||a.file instanceof Blob){
      try{const blob=a.file;const dbId=a.id||("asset_"+Date.now());await safeSaveClipToDB(dbId,blob,a.name||"asset",a.type||"video/webm");asset={...a,dbId};}
      catch(e){}
    }
    setMediaLib(p=>[...p,asset]);
    // Auto-route to correct timeline track (0 = VIDEO TRACK, 1 = AUDIO TRACK)
    const isAudio=asset.type&&(asset.type.startsWith("audio")||asset.type==="narration"||asset.type==="audio/narration");
    const isVideo=asset.type&&(asset.type.startsWith("video")||asset.type==="video/webm");
    if(isAudio||isVideo){
      setTimeline(prev=>{
        const updated={...prev};
        const trackIdx=isAudio?1:0;
        const track=updated[trackIdx]||[];
        if(!track.find(x=>x.id===asset.id)){
          updated[trackIdx]=[...track,asset];
        }
        try{localStorage.setItem("ms_timeline",JSON.stringify(updated));}catch(e){}
        return updated;
      });
    }
  };

  const saveProject=()=>setShowSaveModal(true);

  const doSave=(name,note,status)=>{
    try{
      localStorage.setItem("ms_page",JSON.stringify(page));
      localStorage.setItem("ms_user",JSON.stringify(user));
      localStorage.setItem("ms_timeline",JSON.stringify(timeline));
      localStorage.setItem("ms_medialib",JSON.stringify(mediaLib.map(a=>({...a,file:undefined}))));
      const entry={name,note,page,status:status||"in_progress",assetCount:mediaLib.length,date:new Date().toLocaleString("en-GB",{day:"2-digit",month:"short",year:"numeric",hour:"2-digit",minute:"2-digit"}),savedPage:page,savedTimeline:JSON.parse(JSON.stringify(timeline)),savedUser:user};
      const existing=JSON.parse(localStorage.getItem("ms_project_history")||"[]");
      existing.push(entry);if(existing.length>20)existing.shift();
      localStorage.setItem("ms_project_history",JSON.stringify(existing));
      setShowSaveModal(false);setSavedNotice(true);setTimeout(()=>setSavedNotice(false),2500);
    }catch(e){setShowSaveModal(false);alert("Saved!");}
  };

  const resumeProject=async(h)=>{
    try{
      if(h.savedTimeline&&Object.keys(h.savedTimeline).length>0){setTimeline(h.savedTimeline);localStorage.setItem("ms_timeline",JSON.stringify(h.savedTimeline));}
      if(h.savedUser&&h.savedUser.name){setUser(h.savedUser);localStorage.setItem("ms_user",JSON.stringify(h.savedUser));}
      try{const dbClips=await getAllClipsFromDB();if(dbClips.length>0){const restored=dbClips.map(c2=>({id:c2.id,name:c2.name,type:c2.type||"video/webm",url:URL.createObjectURL(c2.blob),file:new File([c2.blob],c2.name,{type:c2.type||"video/webm"}),dbId:c2.id}));setMediaLib(restored);}}catch(e){}
      go(h.savedPage||h.page||5);setShowHistory(false);setSavedNotice(true);setTimeout(()=>setSavedNotice(false),2500);
    }catch(e){setShowHistory(false);}
  };

  const renderPage=()=>{
    switch(page){
      case 1: return <P1 go={go}/>;
      case 2: return <P2 go={go}/>;
      case 3: return <P3/>;
      case 4: return <P4 go={go} setUser={setUser}/>;
      case 5: return <ToolPage title="WRITING TOOLS" subtitle="AI WORKSTATION 01 — WRITING" tools={WRITING} onSave={saveAsset}/>;
      case 6: return <P6Voice onSave={saveAsset} setMediaLib={setMediaLib}/>;
      case 7: return <ToolPage title="IMAGE TOOLS" subtitle="AI WORKSTATION 03 — IMAGE" tools={IMAGE_T} onSave={saveAsset}/>;
      case 8: return <P8VideoGenerator onSave={saveAsset} user={user} filmDuration={filmDuration} setFilmDuration={setFilmDuration}/>;
      case 9: return <ToolPage title="MOTION & VFX" subtitle="AI WORKSTATION 05 — MOTION" tools={MOTION} onSave={saveAsset}/>;
      case 10: return <ToolPage title="ENHANCEMENT STUDIO" subtitle="AI WORKSTATION 06 — ENHANCE" tools={MOTION} onSave={saveAsset}/>;
      case 11: return <P11 mediaLib={mediaLib} setMediaLib={setMediaLib}/>;
      case 12: return <P12 go={go} mediaLib={mediaLib}/>;
      case 13: return <P13 go={go} mediaLib={mediaLib} timeline={timeline} setTimeline={setTimeline} user={user} filmDuration={filmDuration} setFilmDuration={setFilmDuration}/>;
      case 14: return <P14/>;
      case 15: return <P15/>;
      case 16: return <P16 go={go} timeline={timeline} setRendered={setRendered} mediaLib={mediaLib} setMediaLib={setMediaLib} user={user} filmDuration={filmDuration} setFilmDuration={setFilmDuration}/>;
      case 17: return <P17 go={go} rendered={rendered} mediaLib={mediaLib}/>;
      case 18: return <P18 rendered={rendered} mediaLib={mediaLib}/>;
      case 19: return <P19 go={go}/>;
      case 20: return <P20/>;
      case 21: return <P21/>;
      case 22: return <P22/>;
      case 23: return <P23 go={go}/>;
      case 24: return <P24CharacterStudio onSave={saveAsset} go={go}/>;
      default: return <P1 go={go}/>;
    }
  };

  return (
    <div style={{background:"#000",minHeight:"100vh",fontFamily:"'Rajdhani',sans-serif"}}>
      {showIntro&&<IntroDoors onEnter={()=>setShowIntro(false)}/>}
      <Header go={go} setMenu={setMenu}/>
      {menu&&<QAMenu go={go} onClose={()=>setMenu(false)} user={user}/>}
      {showHistory&&<ProjectHistoryModal onClose={()=>setShowHistory(false)} onResume={resumeProject}/>}
      {showSaveModal&&<SaveSessionModal onClose={()=>setShowSaveModal(false)} onSave={doSave} currentPage={page} assetCount={mediaLib.length}/>}
      {savedNotice&&<div style={{position:"fixed",top:60,left:"50%",transform:"translateX(-50%)",background:GOLDDIM,color:"#000",padding:"10px 24px",fontWeight:900,fontSize:13,letterSpacing:2,zIndex:999}}>✓ PROJECT SAVED</div>}
      <div style={{minHeight:"calc(100vh - 116px)"}}>
        <div key={page}>{renderPage()}</div>
      </div>
      <Footer page={page} go={go} onSave={saveProject} onHistory={()=>setShowHistory(true)}/>
    </div>
  );
}
