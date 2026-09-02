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
                  <div style={{color:GOLDDIM,fontSize:10,marginTop:4,textAlign:"center",letterSpacing:1}}>{audi