// @ts-nocheck
import { useState, useRef, useEffect } from "react";

const GOLD = "#e8c96d";
const GOLDDIM = "#a07820";
const WHITE = "#d4c9a8";
const DIM = "#4a4030";
const BG = "#000000";

const H1 = { fontFamily: "'Cinzel',serif", color: GOLD, letterSpacing: 5, textTransform: "uppercase" as const, margin: 0 };

interface PageProps { onNavigate: (page: number) => void; }

const lc: Record<string, string> = { Beginner: "#22c55e", Intermediate: "#f59e0b", Advanced: "#ef4444" };

const lessonRenderers: Record<string, (ctx: CanvasRenderingContext2D, t: number, w: number, h: number) => void> = {
  "01": (ctx, t, w, h) => {
    const g = ctx.createLinearGradient(0,0,0,h); g.addColorStop(0,"rgb(2,4,15)"); g.addColorStop(1,"rgb(6,16,40)");
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);
    for(let i=0;i<120;i++){const x=((i*137.5+t*0.04)%1)*w,y=((i*97.3)%1)*h,a=0.25+0.55*Math.sin(t*0.8+i);ctx.fillStyle=`rgba(232,201,109,${a})`;ctx.fillRect(x,y,1,1);}
    const cx=w/2,cy=h/2-20;
    ctx.strokeStyle="#e8c96d33";ctx.lineWidth=1;ctx.strokeRect(cx-200,cy-90,400,170);ctx.fillStyle="#e8c96d08";ctx.fillRect(cx-200,cy-90,400,170);
    for(let i=0;i<23;i++){const bx=cx-185+(i%8)*48,by=cy-72+Math.floor(i/8)*42,active=i===Math.floor(t*1.2)%23;ctx.fillStyle=active?GOLD:"#e8c96d1a";ctx.fillRect(bx,by,36,26);ctx.fillStyle=active?"#000":"#e8c96d55";ctx.font=`bold 9px Rajdhani`;ctx.textAlign="center";ctx.fillText(`P${i+1}`,bx+18,by+17);}
    ctx.fillStyle=GOLD;ctx.font=`bold ${Math.floor(w*0.026)}px Cinzel`;ctx.textAlign="center";ctx.fillText("GETTING STARTED — PLATFORM OVERVIEW",cx,h-68);
    ctx.font=`${Math.floor(w*0.014)}px Rajdhani`;ctx.fillStyle=WHITE;ctx.fillText("Navigate all 23 pages · Save & restore · Quick Access menu",cx,h-46);
    ctx.fillStyle="#e8c96d33";ctx.font=`bold 10px Rajdhani`;ctx.fillText("LESSON 01 · BEGINNER · 12:00",cx,h-26);
  },
  "02": (ctx, t, w, h) => {
    ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);
    const cx=w/2,lines=["INT. CITY STREET — NIGHT","A lone figure crosses the rain-slicked road.","Her coat catches the wind. She doesn't look back.","","EXT. ROOFTOP — CONTINUOUS","The skyline burns gold against the dark.","She opens the letter. Reads once. Twice.","","VOICE (V.O.)","Every story begins with a single decision."];
    const scroll=(t*16)%(lines.length*32+h);
    ctx.fillStyle="#e8c96d07";ctx.fillRect(cx-270,0,540,h);
    lines.forEach((line,i)=>{const y=h-scroll+i*32;if(y<-40||y>h+40)return;const a=Math.max(0,Math.min(1,Math.min(y/80,(h-y)/80)));ctx.fillStyle=line.startsWith("INT")||line.startsWith("EXT")?`rgba(232,201,109,${a*0.9})`:`rgba(212,201,168,${a*0.7})`;ctx.font=`${line.startsWith("INT")||line.startsWith("EXT")?"bold":"normal"} 13px Courier New`;ctx.textAlign="left";ctx.fillText(line,cx-250,y);});
    const blink=0.7+0.3*Math.sin(t*3);ctx.fillStyle=`rgba(232,201,109,${blink*0.2})`;ctx.fillRect(cx-90,h-128,180,40);ctx.strokeStyle=`rgba(232,201,109,${blink})`;ctx.lineWidth=2;ctx.strokeRect(cx-90,h-128,180,40);ctx.fillStyle=`rgba(0,0,0,${blink})`;ctx.font="bold 12px Rajdhani";ctx.textAlign="center";ctx.fillText("AI CREATE",cx,h-103);
    ctx.fillStyle=GOLD;ctx.font=`bold ${Math.floor(w*0.024)}px Cinzel`;ctx.textAlign="center";ctx.fillText("WRITING TOOLS — SCRIPT TO SCREEN",cx,h-55);
    ctx.font=`${Math.floor(w*0.013)}px Rajdhani`;ctx.fillStyle=WHITE;ctx.fillText("50+ AI formats · Loglines · Features · Episodes · Character bibles",cx,h-34);
  },
  "03": (ctx, t, w, h) => {
    ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);const cx=w/2;
    ctx.strokeStyle="#e8c96d";ctx.lineWidth=2;ctx.beginPath();
    for(let x=0;x<w;x++){const amp=35+18*Math.sin(x*0.03+t*2),y=h/2-70+Math.sin(x*0.05+t*3)*amp*Math.sin(t*0.5+x*0.01);x===0?ctx.moveTo(x,y):ctx.lineTo(x,y);}ctx.stroke();
    const voices=["James · Documentary","Elena · News Anchor","Marcus · Action","Sofia · Drama","Chen · Narrator","Amara · Character"];
    voices.forEach((v,i)=>{const col=i%3,row=Math.floor(i/3),bx=cx-205+col*142,by=55+row*62,active=Math.floor(t*0.7)%voices.length===i;ctx.fillStyle=active?"#e8c96d22":"#0a0a0a";ctx.fillRect(bx,by,128,46);ctx.strokeStyle=active?GOLD:"#a0782033";ctx.lineWidth=active?2:1;ctx.strokeRect(bx,by,128,46);ctx.fillStyle=active?GOLD:WHITE;ctx.font=`${active?"bold":"normal"} 11px Rajdhani`;ctx.textAlign="center";ctx.fillText(v,bx+64,by+27);});
    ctx.fillStyle=GOLD;ctx.font=`bold ${Math.floor(w*0.024)}px Cinzel`;ctx.textAlign="center";ctx.fillText("VOICE ENGINE — 54 CHARACTERS",cx,h-55);
    ctx.font=`${Math.floor(w*0.013)}px Rajdhani`;ctx.fillStyle=WHITE;ctx.fillText("PITCH · RATE · PAUSE · MOOD · TEST · PREPARE & SPEAK",cx,h-34);
  },
  "04": (ctx, t, w, h) => {
    ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);const cx=w/2;
    for(let i=0;i<32;i++){const bh=18+75*Math.abs(Math.sin(i*0.4+t*4))*(0.5+0.5*Math.sin(t*2+i*0.2)),x=cx-155+i*10;const g=ctx.createLinearGradient(0,h/2-20,0,h/2-20-bh);g.addColorStop(0,GOLDDIM);g.addColorStop(1,GOLD);ctx.fillStyle=g;ctx.fillRect(x,h/2-20-bh,6,bh);}
    const steps=["SONG SETUP","VISUAL STYLE","SCENE DESC","GENERATE"],cs=Math.floor(t*0.5)%4;
    steps.forEach((s,i)=>{const x=cx-185+i*124,active=i<=cs;ctx.fillStyle=active?"#e8c96d1a":"#0a0a0a";ctx.fillRect(x,h-155,105,34);ctx.strokeStyle=active?GOLD:"#a0782033";ctx.lineWidth=active?2:1;ctx.strokeRect(x,h-155,105,34);ctx.fillStyle=active?GOLD:DIM;ctx.font=`bold 9px Rajdhani`;ctx.textAlign="center";ctx.fillText(`STEP ${i+1}`,x+52,h-145);ctx.font=`8px Rajdhani`;ctx.fillText(s,x+52,h-132);});
    ctx.fillStyle=GOLD;ctx.font=`bold ${Math.floor(w*0.024)}px Cinzel`;ctx.textAlign="center";ctx.fillText("MUSIC VIDEO STUDIO",cx,h-85);
    ctx.font=`${Math.floor(w*0.013)}px Rajdhani`;ctx.fillStyle=WHITE;ctx.fillText("Upload track · Set visual style · Describe scene · Generate & share",cx,h-64);
  },
  "05": (ctx, t, w, h) => {
    ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);const cx=w/2,cy=h/2-20,fw=400,fh=230;
    ctx.fillStyle="#0d0d0d";ctx.fillRect(cx-fw/2,cy-fh/2,fw,fh);
    const sky=ctx.createLinearGradient(0,cy-fh/2,0,cy+fh/2);sky.addColorStop(0,"#080816");sky.addColorStop(1,"#1a0800");ctx.fillStyle=sky;ctx.fillRect(cx-fw/2+3,cy-fh/2+3,fw-6,fh-6);
    for(let i=0;i<14;i++){const bw=16+(i*17)%28,bh=28+(i*23)%88,bx=cx-fw/2+8+i*27,by=cy+fh/2-3-bh;ctx.fillStyle="#040404";ctx.fillRect(bx,by,bw,bh);for(let r=0;r<4;r++)for(let c=0;c<2;c++)if(Math.sin(t*0.3+i*2+r+c)>0.3){ctx.fillStyle="rgba(232,201,109,0.55)";ctx.fillRect(bx+3+c*7,by+5+r*11,3,5);}}
    const ray=(Math.sin(t*0.4)+1)/2,g=ctx.createRadialGradient(cx-90+ray*180,cy-40,0,cx-90+ray*180,cy-40,150);g.addColorStop(0,"rgba(232,201,109,0.14)");g.addColorStop(1,"transparent");ctx.fillStyle=g;ctx.fillRect(cx-fw/2,cy-fh/2,fw,fh);
    ctx.strokeStyle=GOLDDIM;ctx.lineWidth=2;ctx.strokeRect(cx-fw/2,cy-fh/2,fw,fh);
    ctx.fillStyle=GOLD;ctx.font=`bold ${Math.floor(w*0.024)}px Cinzel`;ctx.textAlign="center";ctx.fillText("VIDEO GENERATOR — CINEMATIC SCENES",cx,h-55);
    ctx.font=`${Math.floor(w*0.013)}px Rajdhani`;ctx.fillStyle=WHITE;ctx.fillText("Describe any scene · Upload reference image · AI builds the visual",cx,h-34);
  },
  "06": (ctx, t, w, h) => {
    ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);const cx=w/2;
    const prog=(t*10)%110,pct=Math.min(100,Math.floor(prog));
    ctx.fillStyle="#0d0d0d";ctx.fillRect(cx-230,h/2-55,460,18);ctx.fillStyle="#e8c96d28";ctx.fillRect(cx-230,h/2-55,Math.min(460,pct*4.6),18);ctx.strokeStyle=GOLDDIM;ctx.lineWidth=1;ctx.strokeRect(cx-230,h/2-55,460,18);
    ctx.fillStyle=pct>=100?GOLD:WHITE;ctx.font="bold 10px Rajdhani";ctx.textAlign="center";ctx.fillText(pct>=100?"✓ SAVED TO LIBRARY":`UPLOADING... ${pct}%`,cx,h/2-42);
    const types=[["VIDEO","MP4 · MOV · WebM","#e8c96d"],["AUDIO","MP3 · WAV","#22c55e"],["IMAGE","JPG · PNG · WebP","#f59e0b"]];
    types.forEach(([label,ext,col],i)=>{const x=cx-170+i*114;ctx.fillStyle="#0a0a0a";ctx.fillRect(x,h/2-138,96,58);ctx.strokeStyle=col;ctx.lineWidth=1;ctx.strokeRect(x,h/2-138,96,58);ctx.fillStyle=col;ctx.font="bold 12px Rajdhani";ctx.textAlign="center";ctx.fillText(label,x+48,h/2-111);ctx.fillStyle=WHITE+"77";ctx.font="9px Rajdhani";ctx.fillText(ext,x+48,h/2-95);});
    ctx.fillStyle=GOLD;ctx.font=`bold ${Math.floor(w*0.024)}px Cinzel`;ctx.textAlign="center";ctx.fillText("UPLOAD MEDIA — YOUR OWN FILES",cx,h-55);
    ctx.font=`${Math.floor(w*0.013)}px Rajdhani`;ctx.fillStyle=WHITE;ctx.fillText("Page 13 UPLOAD MEDIA · Saved to Supabase · Persists across sessions",cx,h-34);
  },
  "07": (ctx, t, w, h) => {
    ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);const cx=w/2,cy=h/2-20;
    const tracks=["VIDEO","VOICE","MUSIC","EFFECTS"],segW=[125,95,155,85];
    tracks.forEach((track,ti)=>{const ty=cy-65+ti*36;ctx.fillStyle="#0a0a0a";ctx.fillRect(cx-195,ty,390,26);ctx.strokeStyle="#e8c96d1a";ctx.lineWidth=1;ctx.strokeRect(cx-195,ty,390,26);ctx.fillStyle=DIM;ctx.font="bold 9px Rajdhani";ctx.textAlign="left";ctx.fillText(track,cx-190,ty+17);const clipX=cx-195+55+(Math.sin(t*0.3+ti)+1)*18;ctx.fillStyle=ti===0?"#e8c96d2a":ti===1?"#22c55e1a":ti===2?"#f59e0b1a":"#ef44441a";ctx.fillRect(clipX,ty+3,segW[ti],20);ctx.strokeStyle=ti===0?GOLD:ti===1?"#22c55e":ti===2?"#f59e0b":"#ef4444";ctx.lineWidth=1;ctx.strokeRect(clipX,ty+3,segW[ti],20);});
    const phX=cx-195+55+((t*18)%390);ctx.strokeStyle=GOLD;ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(phX,cy-65);ctx.lineTo(phX,cy-65+tracks.length*36);ctx.stroke();
    ctx.fillStyle=GOLD;ctx.font=`bold ${Math.floor(w*0.024)}px Cinzel`;ctx.textAlign="center";ctx.fillText("TIMELINE EDITOR",cx,h-55);
    ctx.font=`${Math.floor(w*0.013)}px Rajdhani`;ctx.fillStyle=WHITE;ctx.fillText("4 tracks · Drag clips · SYNC ALL TRACKS · Set duration · RENDER",cx,h-34);
  },
  "08": (ctx, t, w, h) => {
    ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);const cx=w/2;
    const faders=[{l:"VOICE",v:0.85,c:GOLD},{l:"MUSIC",v:0.40,c:"#e8c96d"},{l:"EFX",v:0.50,c:"#a07820"},{l:"MASTER",v:0.85,c:GOLD}];
    faders.forEach((f,i)=>{const x=cx-175+i*95,th=175,fy=h/2-15;ctx.fillStyle="#0e0e0e";ctx.fillRect(x+22,fy-th/2,7,th);ctx.fillStyle=f.c+"33";ctx.fillRect(x+22,fy-th/2+th*(1-f.v),7,th*f.v);const ky=fy-th/2+th*(1-f.v);ctx.fillStyle=f.c;ctx.fillRect(x+14,ky-4,23,9);ctx.fillStyle=WHITE;ctx.font="bold 10px Rajdhani";ctx.textAlign="center";ctx.fillText(f.l,x+25,fy+18);ctx.fillStyle=f.c;ctx.font="bold 12px Rajdhani";ctx.fillText(Math.round(f.v*100),x+25,fy+34);});
    ctx.fillStyle=GOLD;ctx.font=`bold ${Math.floor(w*0.024)}px Cinzel`;ctx.textAlign="center";ctx.fillText("AUDIO MIXER — PROFESSIONAL SOUND",cx,h-55);
    ctx.font=`${Math.floor(w*0.013)}px Rajdhani`;ctx.fillStyle=WHITE;ctx.fillText("Documentary: VOICE 85 · MUSIC 40 · EFX 50 · MASTER 85",cx,h-34);
  },
  "09": (ctx, t, w, h) => {
    ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);const cx=w/2,cy=h/2-20;
    const pct=Math.min(100,Math.floor((t*5.5)%105));
    for(let i=0;i<8;i++){const fx=cx-285+i*72,lit=i<=pct/12.5;ctx.fillStyle=lit?"#e8c96d0e":"#0a0a0a";ctx.fillRect(fx,cy-55,62,78);ctx.strokeStyle=lit?GOLD:"#a0782022";ctx.lineWidth=lit?2:1;ctx.strokeRect(fx,cy-55,62,78);if(lit){const g=ctx.createRadialGradient(fx+31,cy-16,0,fx+31,cy-16,32);g.addColorStop(0,"#e8c96d2a");g.addColorStop(1,"transparent");ctx.fillStyle=g;ctx.fillRect(fx,cy-55,62,78);}}
    ctx.fillStyle="#0e0e0e";ctx.fillRect(cx-200,cy+44,400,14);ctx.fillStyle=pct>=100?GOLD:"#e8c96d77";ctx.fillRect(cx-200,cy+44,pct*4,14);ctx.strokeStyle=GOLDDIM;ctx.lineWidth=1;ctx.strokeRect(cx-200,cy+44,400,14);ctx.fillStyle=pct>=100?"#000":WHITE;ctx.font="bold 9px Rajdhani";ctx.textAlign="center";ctx.fillText(pct>=100?"RENDER COMPLETE":`RENDERING... ${pct}%`,cx,cy+55);
    ctx.fillStyle=GOLD;ctx.font=`bold ${Math.floor(w*0.024)}px Cinzel`;ctx.textAlign="center";ctx.fillText("RENDER ENGINE",cx,h-55);
    ctx.font=`${Math.floor(w*0.013)}px Rajdhani`;ctx.fillStyle=WHITE;ctx.fillText("1080p · 4K · 8K Cinema · VP9 Codec · Up to 180 minutes",cx,h-34);
  },
  "10": (ctx, t, w, h) => {
    ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);const cx=w/2;
    const platforms=["YOUTUBE","TIKTOK","INSTAGRAM","FACEBOOK","LINKEDIN","VIMEO","WHATSAPP"];
    const cols=["#ff0000","#ffffff","#e1306c","#1877f2","#0a66c2","#1ab7ea","#25d366"];
    platforms.forEach((p,i)=>{const col2=i%4,row2=Math.floor(i/4),x=cx-195+col2*102,y=h/2-95+row2*52,sent=Math.floor(t*0.6)>i;ctx.fillStyle=sent?cols[i]+"22":"#0a0a0a";ctx.fillRect(x,y,82,34);ctx.strokeStyle=sent?cols[i]:"#a0782022";ctx.lineWidth=sent?2:1;ctx.strokeRect(x,y,82,34);ctx.fillStyle=sent?cols[i]:DIM;ctx.font=`bold 9px Rajdhani`;ctx.textAlign="center";ctx.fillText(p,x+41,y+21);});
    ctx.fillStyle=GOLD;ctx.font=`bold ${Math.floor(w*0.024)}px Cinzel`;ctx.textAlign="center";ctx.fillText("EXPORT & DISTRIBUTE",cx,h-55);
    ctx.font=`${Math.floor(w*0.013)}px Rajdhani`;ctx.fillStyle=WHITE;ctx.fillText("One-click to 7 platforms · Download to device · Cloud backup",cx,h-34);
  },
  "11": (ctx, t, w, h) => {
    ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);const cx=w/2,cy=h/2-25;
    const chapters=["CONCEPT","SCRIPT","VOICE","SCENES","TIMELINE","MIX","RENDER","EXPORT"];
    chapters.forEach((c,i)=>{const x=cx-325+i*84,done=i<=Math.floor(t*0.5)%(chapters.length+1);ctx.fillStyle=done?"#e8c96d1a":"#0a0a0a";ctx.fillRect(x,cy-22,70,44);ctx.strokeStyle=done?GOLD:"#a0782022";ctx.lineWidth=done?2:1;ctx.strokeRect(x,cy-22,70,44);ctx.fillStyle=done?GOLD:DIM;ctx.font=`bold 9px Rajdhani`;ctx.textAlign="center";ctx.fillText(c,x+35,cy+6);if(i<chapters.length-1){ctx.strokeStyle=done?GOLD+"66":"#a0782016";ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x+70,cy);ctx.lineTo(x+84,cy);ctx.stroke();}});
    ctx.fillStyle=GOLD;ctx.font=`bold ${Math.floor(w*0.024)}px Cinzel`;ctx.textAlign="center";ctx.fillText("DOCUMENTARY FULL CASE STUDY",cx,h-55);
    ctx.font=`${Math.floor(w*0.013)}px Rajdhani`;ctx.fillStyle=WHITE;ctx.fillText("Page 5 → Page 6 (James) → Page 8 → Page 13 → Page 15 → Page 16 → Page 18",cx,h-34);
  },
  "12": (ctx, t, w, h) => {
    ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);const cx=w/2,cy=h/2-20;
    const pulse=0.55+0.45*Math.sin(t*2);
    ctx.beginPath();ctx.arc(cx,cy-28,58,0,Math.PI*2);ctx.strokeStyle=`rgba(232,201,109,${pulse*0.28})`;ctx.lineWidth=22;ctx.stroke();
    ctx.beginPath();ctx.arc(cx,cy-28,36,0,Math.PI*2);ctx.strokeStyle=`rgba(232,201,109,${pulse*0.5})`;ctx.lineWidth=10;ctx.stroke();
    ctx.fillStyle=`rgba(232,201,109,${pulse})`;ctx.font="bold 34px Rajdhani";ctx.textAlign="center";ctx.fillText("☁",cx,cy-12);
    const states=["SAVING PROJECT...","PROJECT SAVED ✓","RESTORING...","RESTORED ✓"],st=states[Math.floor(t*0.5)%states.length];
    ctx.fillStyle=st.includes("✓")?GOLD:WHITE;ctx.font=`bold 14px Rajdhani`;ctx.fillText(st,cx,cy+32);
    ctx.fillStyle=GOLD;ctx.font=`bold ${Math.floor(w*0.024)}px Cinzel`;ctx.textAlign="center";ctx.fillText("SAVING, LOADING & PROJECT HISTORY",cx,h-55);
    ctx.font=`${Math.floor(w*0.013)}px Rajdhani`;ctx.fillStyle=WHITE;ctx.fillText("SAVE PROJECT · MY PROJECTS · Cloud via Supabase",cx,h-34);
  },
  "13": (ctx, t, w, h) => {
    ctx.fillStyle="#000";ctx.fillRect(0,0,w,h);const cx=w/2,cy=h/2-20;
    ctx.fillStyle="#040300";ctx.fillRect(cx-225,cy-95,450,155);ctx.strokeStyle=GOLD;ctx.lineWidth=2;ctx.strokeRect(cx-225,cy-95,450,155);
    const ga=ctx.createLinearGradient(cx-205,cy-78,cx-157,cy-32);ga.addColorStop(0,GOLDDIM);ga.addColorStop(1,GOLD);ctx.fillStyle=ga;ctx.fillRect(cx-205,cy-78,46,46);ctx.fillStyle="#000";ctx.font="bold 24px Cinzel";ctx.textAlign="center";ctx.fillText("G",cx-182,cy-49);
    ctx.beginPath();ctx.arc(cx-163,cy-40,5,0,Math.PI*2);ctx.fillStyle="#22c55e";ctx.fill();
    const typing=Math.floor(t*1.5)%42,full="How can I help your production today?",shown=full.slice(0,typing);
    ctx.fillStyle=WHITE;ctx.font="13px Rajdhani";ctx.textAlign="left";ctx.fillText(shown+(typing<full.length?"▌":""),cx-148,cy-56);
    ctx.fillStyle=GOLD;ctx.font=`bold ${Math.floor(w*0.024)}px Cinzel`;ctx.textAlign="center";ctx.fillText("AGENT GROK — 24/7 AI ASSISTANT",cx,h-55);
    ctx.font=`${Math.floor(w*0.013)}px Rajdhani`;ctx.fillStyle=WHITE;ctx.fillText("Full knowledge of all 23 pages · Available on every page · Ask anything",cx,h-34);
  },
};

const tuts = [
  { n: "01", t: "Getting Started — Platform Overview & Navigation", d: "Full walkthrough of all 23 pages, the Quick Access menu, footer controls, and how to navigate the studio. Learn how every page connects and what order gives you the fastest path from idea to finished film.", dur: "12:00", l: "Beginner", tips: ["Use the Quick Access menu (top left) to jump to any of the 23 pages instantly","Hit SAVE PROJECT in the footer at any time — your work restores exactly where you left off","Page 23 has the complete How-To-Use Guide covering every page in detail","Guest users can explore the full platform without signing in"] },
  { n: "02", t: "Writing Tools — Script to Screen in Minutes (Page 5)", d: "How to use the 50+ professional writing tools on Page 5. From logline to full feature screenplay, episode arc, character bible, and documentary script — all generated in seconds with AI CREATE.", dur: "9:30", l: "Beginner", tips: ["Click any tool card to open it in a full modal with prompt fields","Use AI CREATE to generate any script format instantly","Copy your finished script straight into the Voice Engine on Page 6","50+ formats: loglines, treatments, feature scripts, episode arcs, character bibles, dialogue rewrites"] },
  { n: "03", t: "Voice Engine — 54 Characters, Real Narration (Page 6)", d: "Complete guide to Page 6. Choosing from 54 professional voice characters, setting pitch, rate, pause and mood, using the TEST button before committing, and using PREPARE & SPEAK for the best AI-formatted delivery.", dur: "14:20", l: "Beginner", tips: ["APPLY JAMES SETTINGS sets the perfect documentary narration: pitch 0.86, rate 0.62, pause 1600ms","Filter voices by gender, age, and origin to find your character instantly","Hit TEST on any voice card to hear it before selecting","Always use PREPARE & SPEAK — it AI-formats your script for the best spoken result","Adjust the MOOD slider across 14 emotional registers for the right tone"] },
  { n: "04", t: "Music Video Studio — Full Production Walkthrough (Page 6)", d: "Step-by-step guide to the Music Video Studio inside Page 6. Song setup, choosing visual style and colour grade, writing your scene description, generating your music video, and exporting to social platforms.", dur: "18:45", l: "Intermediate", tips: ["Access from the MUSIC VIDEO STUDIO button on Page 6","Upload your own audio track on Step 1 — the visuals sync to your beat automatically","The more detailed your Step 3 scene description, the better the generated result","Step 2 colour grade choices: Cinematic, Noir, Golden Hour, Arctic Blue, and more","Download directly from Step 4 or share to YouTube, TikTok, and Instagram in one click"] },
  { n: "05", t: "Video Generator — Cinematic Scene Generation (Page 8)", d: "How to describe any scene and have the MandaStrong Cinema Engine build it as a visual clip. Using reference images to match a style, setting duration, and saving clips to your Media Library for the Timeline.", dur: "16:00", l: "Intermediate", tips: ["Describe lighting, mood, camera angle, time of day, characters, and setting for the best result","Upload a reference image to match a specific visual style or colour palette","Every generated clip saves automatically to your Media Library on Page 11","Use NEXT SCENE to build your full film clip by clip in sequence","You can bypass this and upload your own video files using UPLOAD MEDIA on Page 13"] },
  { n: "06", t: "Upload Media — Bring Your Own Files (Page 13)", d: "How to upload your own video, audio, and image files directly into the Timeline Editor without using the AI Video Generator. Files are saved to your Supabase Media Library and available across every tool.", dur: "5:00", l: "Beginner", tips: ["Hit UPLOAD MEDIA at the top of the MEDIA BOX in the Timeline Editor on Page 13","Accepts video (MP4, MOV, WebM), audio (MP3, WAV), and images (JPG, PNG, WebP)","Uploaded files are saved to Supabase Storage and persist across sessions","Guest users get a local session-only upload — sign in to save files permanently","A progress bar shows upload percentage in real time"] },
  { n: "07", t: "Timeline Editor — Building Your Film (Page 13)", d: "Dragging clips to video, voice, music, and effects tracks. Syncing all tracks from your Media Library with one click. Adjusting film duration from 1 to 180 minutes, and locking your timeline before render.", dur: "11:30", l: "Intermediate", tips: ["Hit SYNC ALL TRACKS to auto-populate all four tracks from your Media Library","Four tracks: VIDEO · VOICE · MUSIC · EFFECTS — drag any asset to any track","Set film duration: 60, 90, or 180 minutes","Use UPLOAD MEDIA to bring in your own files without using the AI generator","Hit RENDER when your timeline is locked and ready"] },
  { n: "08", t: "Audio Mixer — Professional Sound Design (Page 15)", d: "Setting the perfect mix for documentary, narrative film, or music video. Recommended levels for each format, the equaliser, audio ducking, noise reduction, and saving your mix as a preset.", dur: "7:15", l: "Beginner", tips: ["Documentary mix: VOICE 85 · MUSIC 40 · EFX 50 · MASTER 85","Music video mix: MUSIC 75 · VOICE 60 · EFX 40 · MASTER 85","Enable AUDIO DUCKING to automatically lower music when voice plays","Use the 3-band EQ (Bass / Mid / Treble) to shape your final sound","Hit SAVE PRESET to store your favourite mix for future projects"] },
  { n: "09", t: "Render Engine — Producing Your Film (Page 16)", d: "Choosing quality settings (1080p, 4K, 8K), understanding VP9 codec advantages, starting the render, and what happens when clips need regenerating before the final output.", dur: "10:45", l: "Intermediate", tips: ["Creator plan: 1080p HD · Pro plan: 4K · Studio plan: 8K cinema quality","VP9 codec delivers better quality at the same file size compared to H.264","The engine automatically detects and re-generates any missing clips before rendering","Lock your timeline and approve your audio mix before hitting START RENDER","Studio plan supports films up to 3 hours (180 minutes)"] },
  { n: "10", t: "Export & Distribute — Getting Your Film Out (Page 18)", d: "Downloading your completed film and sharing one-click to YouTube, TikTok, Instagram, Facebook, LinkedIn, Vimeo, and WhatsApp directly from inside the platform.", dur: "6:00", l: "Beginner", tips: ["Hit DOWNLOAD to save the film file to your device first as a backup","One-click share buttons open each platform's upload page with your file ready","Your rendered film is saved to your project history for re-download at any time","Add your MandaStrong Studio credit and a link in your post description"] },
  { n: "11", t: "AI For Humanity Documentary — Full Case Study", d: "Complete production case study: how a full-length AI For Humanity documentary was built inside MandaStrong Studio from concept to render — covering script, narration, scene generation, timeline assembly, and export.", dur: "25:00", l: "Advanced", tips: ["Full workflow: Page 5 → Page 6 (James) → Page 8 → Page 13 → Page 15 → Page 16 → Page 18","James narration: pitch 0.86, rate 0.62, pause 1600ms","13 scenes generated on Page 8 and synced on the timeline — total runtime 90 minutes","Each chapter of the documentary gets its own dedicated generated scene","Own footage added via UPLOAD MEDIA on Page 13 alongside AI-generated clips"] },
  { n: "12", t: "Saving, Loading & Project History", d: "How to save your full session, restore from project history, and ensure your media library assets persist across devices and sessions via Supabase cloud storage.", dur: "5:30", l: "Beginner", tips: ["Hit SAVE PROJECT in the footer at any time from any page","MY PROJECTS restores your work exactly where you left off — timeline, media, settings","Uploaded files via UPLOAD MEDIA are stored in Supabase and survive browser restarts","Always download your rendered film before closing the browser","Sign in to enable permanent cloud saves — guest sessions are local only"] },
  { n: "13", t: "Agent Grok — Your 24/7 AI Studio Assistant", d: "How to use Agent Grok for instant answers on any tool, workflow, voice settings, pricing, or export question. Grok has full knowledge of all 23 pages and every feature in the platform.", dur: "4:00", l: "Beginner", tips: ["Click the gold G button fixed to the bottom-left of every page to open Agent Grok","Use the Quick Start suggestion buttons to get answers immediately without typing","Follow-up suggestion buttons appear after each answer for deeper exploration","Ask about any page, tool, workflow, pricing plan, voice settings, or export options","Agent Grok covers all 23 pages with detailed, accurate answers — available 24/7"] },
];

function LessonCanvas({ lessonId }: { lessonId: string }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number>(0);
  const startRef = useRef<number>(0);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const renderer = lessonRenderers[lessonId];
    if (!renderer) return;

    const resize = () => {
      const parent = canvas.parentElement;
      if (!parent) return;
      canvas.width = parent.clientWidth;
      canvas.height = Math.round(parent.clientWidth * 9 / 16);
    };
    resize();
    window.addEventListener("resize", resize);

    const draw = (ts: number) => {
      if (!startRef.current) startRef.current = ts;
      const t = (ts - startRef.current) / 1000;
      renderer(ctx, t, canvas.width, canvas.height);
      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(rafRef.current);
    };
  }, [lessonId]);

  return <canvas ref={canvasRef} style={{ width: "100%", display: "block", background: "#000" }} />;
}

export default function Page19({ onNavigate }: PageProps) {
  const [activeVid, setActiveVid] = useState<number | null>(null);
  const [playing, setPlaying] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => setActiveVid(v => v === idx ? null : idx);

  const generate = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setPlaying(p => { const n = new Set(p); n.add(idx); return n; });
    setActiveVid(idx);
  };

  const stop = (e: React.MouseEvent, idx: number) => {
    e.stopPropagation();
    setPlaying(p => { const n = new Set(p); n.delete(idx); return n; });
  };

  return (
    <div style={{ minHeight: "100vh", background: BG, color: WHITE, fontFamily: "'Rajdhani',sans-serif", paddingBottom: 160 }}>
      <style>{`
        @keyframes p19pulse{0%,100%{opacity:.4}50%{opacity:1}}
        @keyframes p19glow{0%,100%{box-shadow:0 0 18px #e8c96d22}50%{box-shadow:0 0 36px #e8c96d55}}
        .p19-row{transition:border-color .15s,background .15s;}
        .p19-row:hover{border-color:${GOLD} !important;background:#050400 !important;}
        .p19-gen{transition:filter .15s,transform .15s;}
        .p19-gen:hover{filter:brightness(1.18) !important;transform:scale(1.02) !important;}
        .p19-play{cursor:pointer;}
        .p19-play:hover .p19-play-icon{transform:scale(1.08);}
        .p19-play-icon{transition:transform .15s;}
      `}</style>

      {/* Header */}
      <div style={{ background: "linear-gradient(180deg,#060400,#000)", borderBottom: `1px solid ${GOLD}44`, padding: "28px 32px 22px" }}>
        <div style={{ maxWidth: 920, margin: "0 auto" }}>
          <div style={{ fontSize: 9, color: GOLDDIM, letterSpacing: 5, fontWeight: 900, marginBottom: 6 }}>PRODUCTION ENGINE — LEARNING CENTER</div>
          <div style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap", marginBottom: 8 }}>
            <h1 style={{ ...H1, fontSize: "clamp(20px,3vw,30px)" }}>TUTORIALS</h1>
            <div style={{
              background: "#030200", border: `1px solid ${GOLD}`,
              padding: "5px 16px", display: "flex", alignItems: "center", gap: 8,
              animation: "p19glow 3s ease-in-out infinite",
            }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 8px #22c55e", animation: "p19pulse 1.5s ease-in-out infinite" }} />
              <span style={{ color: GOLD, fontSize: 10, fontWeight: 900, letterSpacing: 3 }}>13 LESSONS READY TO WATCH</span>
            </div>
          </div>
          <p style={{ color: WHITE, fontSize: 13, lineHeight: 1.8, margin: 0, opacity: .8 }}>
            Step-by-step video guides for every part of MandaStrong Studio. Hit GENERATE TO WATCH on any lesson — each plays an animated tutorial built for that exact topic.
          </p>
        </div>
      </div>

      {/* Lessons */}
      <div style={{ maxWidth: 920, margin: "0 auto", padding: "24px 32px" }}>
        {tuts.map((tut, idx) => {
          const isActive = activeVid === idx;
          const isPlaying = playing.has(idx);

          return (
            <div key={tut.n} style={{ marginBottom: 12 }}>
              {/* Row header */}
              <div
                className="p19-row"
                onClick={() => toggle(idx)}
                style={{
                  background: isActive ? "#060400" : "#030200",
                  border: `1px solid ${isActive ? GOLD : GOLDDIM + "66"}`,
                  borderBottom: isActive ? "none" : undefined,
                  padding: "0",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "stretch",
                }}
              >
                {/* Lesson number sidebar */}
                <div style={{
                  width: 56, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center",
                  background: isActive ? `linear-gradient(180deg,${GOLDDIM}33,${GOLD}11)` : "#0a0800",
                  borderRight: `1px solid ${isActive ? GOLD + "66" : GOLDDIM + "33"}`,
                }}>
                  <span style={{ fontFamily: "'Cinzel',serif", color: isActive ? GOLD : GOLDDIM, fontSize: 14, fontWeight: 900 }}>{tut.n}</span>
                </div>

                {/* Main content */}
                <div style={{ flex: 1, padding: "14px 16px", minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap", marginBottom: 4 }}>
                    <span style={{ color: WHITE, fontWeight: 900, fontSize: 14, lineHeight: 1.3 }}>{tut.t}</span>
                    <span style={{
                      background: lc[tut.l] + "1a",
                      border: `1px solid ${lc[tut.l]}`,
                      color: lc[tut.l],
                      padding: "1px 8px", fontSize: 9, fontWeight: 900, letterSpacing: 2, flexShrink: 0,
                    }}>{tut.l.toUpperCase()}</span>
                  </div>
                  <div style={{ color: DIM, fontSize: 10, letterSpacing: 1 }}>
                    {tut.dur} · {tut.tips.length} PRO TIPS · {isActive ? "CLICK TO COLLAPSE" : "CLICK TO EXPAND"}
                  </div>
                </div>

                {/* Actions */}
                <div style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 16px", flexShrink: 0 }}>
                  {isPlaying ? (
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#22c55e", boxShadow: "0 0 6px #22c55e", animation: "p19pulse 1s ease-in-out infinite" }} />
                      <span style={{ color: "#22c55e", fontSize: 10, fontWeight: 900, letterSpacing: 2 }}>PLAYING</span>
                    </div>
                  ) : (
                    <button
                      className="p19-gen"
                      onClick={e => generate(e, idx)}
                      style={{
                        background: `linear-gradient(135deg,${GOLDDIM},${GOLD})`,
                        border: "none", color: "#000",
                        padding: "7px 18px",
                        cursor: "pointer", fontSize: 10, fontWeight: 900, letterSpacing: 2,
                        fontFamily: "'Rajdhani',sans-serif",
                        whiteSpace: "nowrap",
                      }}
                    >
                      ▶ GENERATE TO WATCH
                    </button>
                  )}
                  <span style={{ color: isActive ? GOLD : GOLDDIM, fontSize: 14, fontWeight: 900 }}>{isActive ? "▲" : "▼"}</span>
                </div>
              </div>

              {/* Expanded panel */}
              {isActive && (
                <div style={{ background: "#040300", border: `1px solid ${GOLD}`, borderTop: "none" }}>
                  {/* Video area */}
                  {isPlaying ? (
                    <LessonCanvas lessonId={tut.n} />
                  ) : (
                    <div
                      className="p19-play"
                      onClick={e => generate(e, idx)}
                      style={{
                        aspectRatio: "16/9", background: "linear-gradient(135deg,#050400,#020100)",
                        display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 20,
                        borderBottom: `1px solid ${GOLD}22`,
                        position: "relative", overflow: "hidden",
                      }}
                    >
                      {/* Subtle grid */}
                      <div style={{ position: "absolute", inset: 0, backgroundImage: `linear-gradient(${GOLD}06 1px,transparent 1px),linear-gradient(90deg,${GOLD}06 1px,transparent 1px)`, backgroundSize: "60px 60px", pointerEvents: "none" }} />

                      <div
                        className="p19-play-icon"
                        style={{
                          width: 80, height: 80,
                          background: `linear-gradient(135deg,${GOLDDIM},${GOLD})`,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: `0 0 50px ${GOLD}55`,
                        }}
                      >
                        <span style={{ color: "#000", fontSize: 30, fontWeight: 900, marginLeft: 4 }}>▶</span>
                      </div>

                      <div style={{ textAlign: "center", zIndex: 1 }}>
                        <div style={{ color: GOLD, fontWeight: 900, fontSize: 15, letterSpacing: 4, marginBottom: 6 }}>GENERATE TO WATCH</div>
                        <div style={{ color: GOLDDIM, fontSize: 10, letterSpacing: 2 }}>LESSON {tut.n} · {tut.dur} · {tut.l.toUpperCase()}</div>
                      </div>
                    </div>
                  )}

                  {/* Description & tips */}
                  <div style={{ padding: "22px 26px" }}>
                    <p style={{ color: WHITE, fontSize: 14, lineHeight: 1.95, marginBottom: 20 }}>{tut.d}</p>

                    <div style={{ color: GOLD, fontSize: 10, fontWeight: 900, letterSpacing: 3, marginBottom: 12 }}>PRO TIPS</div>
                    {tut.tips.map((tip, i) => (
                      <div key={i} style={{ display: "flex", gap: 12, marginBottom: 10, alignItems: "flex-start" }}>
                        <span style={{ color: GOLD, fontWeight: 900, flexShrink: 0, marginTop: 1 }}>✦</span>
                        <span style={{ color: WHITE, fontSize: 13, lineHeight: 1.75 }}>{tip}</span>
                      </div>
                    ))}

                    {/* Bottom buttons */}
                    <div style={{ marginTop: 20, display: "flex", gap: 10, flexWrap: "wrap" }}>
                      {isPlaying ? (
                        <button
                          onClick={e => stop(e, idx)}
                          style={{
                            background: "transparent", border: `1px solid ${GOLD}`, color: GOLD,
                            padding: "11px 24px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 2,
                            fontFamily: "'Rajdhani',sans-serif",
                          }}
                        >
                          ■ STOP
                        </button>
                      ) : (
                        <button
                          className="p19-gen"
                          onClick={e => generate(e, idx)}
                          style={{
                            background: `linear-gradient(135deg,${GOLDDIM},${GOLD})`,
                            border: "none", color: "#000",
                            padding: "11px 28px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 2,
                            fontFamily: "'Rajdhani',sans-serif",
                          }}
                        >
                          ▶ GENERATE TO WATCH
                        </button>
                      )}
                      {idx > 0 && (
                        <button onClick={() => setActiveVid(idx - 1)} style={{ background: "transparent", border: `1px solid ${GOLDDIM}66`, color: WHITE, padding: "11px 18px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 2, fontFamily: "'Rajdhani',sans-serif" }}>
                          ← PREV
                        </button>
                      )}
                      {idx < tuts.length - 1 && (
                        <button onClick={() => setActiveVid(idx + 1)} style={{ background: "transparent", border: `1px solid ${GOLDDIM}66`, color: WHITE, padding: "11px 18px", cursor: "pointer", fontSize: 11, fontWeight: 900, letterSpacing: 2, fontFamily: "'Rajdhani',sans-serif" }}>
                          NEXT →
                        </button>
                      )}
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
