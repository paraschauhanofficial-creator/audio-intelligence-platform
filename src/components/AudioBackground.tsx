"use client";

import { useEffect, useRef } from "react";

export default function AudioBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    let animId: number;

    const resize = () => {
      canvas.width  = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const W = () => canvas.width;
    const H = () => canvas.height;
    const hex2 = (v: number) => Math.round(Math.max(0,Math.min(1,v))*255).toString(16).padStart(2,"0");

    // ── Floating dots ─────────────────────────────────────────────────────
    const dots = Array.from({length:15},()=>({
      x:Math.random(), y:Math.random(),
      r:Math.random()*1.0+0.3,
      spd:Math.random()*0.00015+0.00005,
      op:Math.random()*0.12+0.03,
      col:Math.random()>0.5?"#00B7FF":"#14D8C4",
    }));

    // ── Channel data ──────────────────────────────────────────────────────
    const CHANNELS = 16;
    const channels = Array.from({length:CHANNELS},()=>({
      fader:    Math.random()*0.5+0.2,
      faderV:   (Math.random()-0.5)*0.0008,
      vu:       Math.random()*0.5+0.15,
      vuTarget: Math.random()*0.5+0.15,
      knob1:    Math.random()*Math.PI*2,
      knob2:    Math.random()*Math.PI*2,
      knob3:    Math.random()*Math.PI*2,
      btnColor: ["#14D8C4","#00B7FF","#A78BFA","#F0A500","#FF6B4A"][Math.floor(Math.random()*5)],
    }));

    // ── EQ screen points ──────────────────────────────────────────────────
    const eqPoints = Array.from({length:8},(_,i)=>({
      x: i/7,
      y: 0.5+Math.sin(i*0.8)*0.22,
      vy:(Math.random()-0.5)*0.0015,
    }));

    // ── Bottom compression meter ──────────────────────────────────────────
    const compMeter = { reduction: 0.3, target: 0.3 };

    // ── Bottom EQ bands ───────────────────────────────────────────────────
    const bottomEQ = Array.from({length:10},(_,i)=>({
      gain: (Math.random()-0.5)*0.6,
      target: (Math.random()-0.5)*0.6,
      spd: Math.random()*0.008+0.003,
      label: ["Sub","Bass","LM","Mid","HM","Pres","Air","8k","12k","16k"][i],
    }));

    let t = 0;

    // ── DRAW: digital EQ screen (top, left-aligned, smaller) ─────────────
    const drawDigitalScreen = (time: number) => {
      const w=W(), h=H();
      const screenW = w*0.52;
      const screenH = h*0.18;
      const screenY = h*0.04;

      // Screen background
      ctx.fillStyle = "rgba(0,18,18,0.38)";
      ctx.beginPath();
      (ctx as any).roundRect(0, screenY, screenW, screenH, 3);
      ctx.fill();
      ctx.strokeStyle = "#14D8C428";
      ctx.lineWidth = 0.5;
      ctx.beginPath();
      (ctx as any).roundRect(0, screenY, screenW, screenH, 3);
      ctx.stroke();

      // Grid
      ctx.strokeStyle = "#14D8C410";
      ctx.lineWidth = 0.5;
      for(let gy=screenY+screenH*0.25; gy<screenY+screenH; gy+=screenH*0.25){
        ctx.beginPath(); ctx.moveTo(8,gy); ctx.lineTo(screenW-8,gy); ctx.stroke();
      }

      // EQ curve
      eqPoints.forEach(p=>{
        p.y += p.vy + Math.sin(time*0.35+p.x*4)*0.0006;
        if(p.y<0.15||p.y>0.85) p.vy*=-1;
      });

      ctx.beginPath();
      ctx.moveTo(0, screenY+screenH);
      eqPoints.forEach((p,i)=>{
        const px = p.x*screenW;
        const py = screenY + p.y*screenH;
        if(i===0) ctx.lineTo(px,py);
        else {
          const prev = eqPoints[i-1];
          const cpx = (prev.x+(p.x-prev.x)*0.5)*screenW;
          ctx.bezierCurveTo(cpx, screenY+prev.y*screenH, cpx, py, px, py);
        }
      });
      ctx.lineTo(screenW, screenY+screenH);
      ctx.closePath();
      const ef = ctx.createLinearGradient(0,screenY,0,screenY+screenH);
      ef.addColorStop(0,"rgba(20,216,196,0.18)");
      ef.addColorStop(1,"rgba(20,216,196,0.02)");
      ctx.fillStyle = ef; ctx.fill();

      ctx.beginPath();
      eqPoints.forEach((p,i)=>{
        const px = p.x*screenW;
        const py = screenY + p.y*screenH;
        if(i===0) ctx.moveTo(px,py);
        else {
          const prev = eqPoints[i-1];
          const cpx = (prev.x+(p.x-prev.x)*0.5)*screenW;
          ctx.bezierCurveTo(cpx, screenY+prev.y*screenH, cpx, py, px, py);
        }
      });
      ctx.strokeStyle = "#14D8C4aa"; ctx.lineWidth = 1.2; ctx.stroke();

      // Control points only — no spectrum bars on right
      eqPoints.forEach((p,i)=>{
        if(i===0||i===eqPoints.length-1) return;
        ctx.beginPath();
        ctx.arc(p.x*screenW, screenY+p.y*screenH, 3, 0, Math.PI*2);
        ctx.fillStyle = ["#00B7FF","#14D8C4","#F0A500","#A78BFA","#FF6B4A","#14D8C4"][i%6];
        ctx.fill();
      });

      // 4 info panels — shifted right, very faded (10% opacity)
      const panels = [
        {x:w*0.04, label:"EQ",   val:"+2.4dB", col:"#14D8C4"},
        {x:w*0.13, label:"COMP", val:"-6.0dB", col:"#F0A500"},
        {x:w*0.22, label:"GATE", val:"OFF",    col:"#FF6B4A"},
        {x:w*0.31, label:"REV",  val:"24%",    col:"#A78BFA"},
      ];
      panels.forEach(panel=>{
        ctx.globalAlpha = 0.10;
        ctx.fillStyle = panel.col+"20";
        ctx.strokeStyle = panel.col+"40";
        ctx.lineWidth = 0.5;
        ctx.beginPath();
        (ctx as any).roundRect(panel.x, screenY+3, w*0.072, screenH*0.38, 2);
        ctx.fill(); ctx.stroke();
        ctx.fillStyle = panel.col;
        ctx.font = `bold ${Math.round(h*0.011)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(panel.label, panel.x+w*0.036, screenY+screenH*0.17);
        ctx.fillStyle = "#ffffff60";
        ctx.font = `${Math.round(h*0.009)}px monospace`;
        ctx.fillText(panel.val, panel.x+w*0.036, screenY+screenH*0.30);
        ctx.globalAlpha = 1;
      });
    };

    // ── DRAW: mixer panel (knobs row + fader/VU row) ──────────────────────
    const drawMixerPanel = (time: number) => {
      const w=W(), h=H();
      const leftStripW = w*0.065;
      const leftStartX = -w*0.01;
      const panelY     = h*0.25;
      const panelH     = h*0.68;

      for(let i=0;i<CHANNELS;i++){
        const ch  = channels[i];
        const pct = i/(CHANNELS-1);

        // Max alpha 0.18, fades with perspective
        const alpha = Math.max(0,(1-pct*1.22)*0.18);
        if(alpha<0.003) continue;
        ctx.globalAlpha = alpha;

        const scale = 1-pct*0.72;
        const sw    = leftStripW*scale;
        const sx    = leftStartX + pct*(w*0.80);

        const rowTopY = panelY + pct*panelH*0.12;
        const rowBotY = panelY + panelH - pct*panelH*0.18;
        const totalH  = rowBotY-rowTopY;

        // Divider
        ctx.strokeStyle = "#14D8C418";
        ctx.lineWidth = 0.5*scale;
        ctx.beginPath();
        ctx.moveTo(sx+sw, rowTopY);
        ctx.lineTo(sx+sw, rowBotY);
        ctx.stroke();

        // ── Knob row (top 36%) ───────────────────────────────────────────
        const row1H = totalH*0.36;
        const knobR = sw*0.20;
        ch.knob1+=0.004; ch.knob2+=0.003; ch.knob3+=0.005;
        const knobs  = [ch.knob1, ch.knob2, ch.knob3];
        const kColors= ["#14D8C4","#00B7FF","#F0A500"];
        [0.22,0.50,0.78].forEach((kpct,ki)=>{
          const kx = sx+sw*kpct;
          const ky = rowTopY+row1H*0.42;
          ctx.fillStyle = "#141a22";
          ctx.beginPath(); ctx.arc(kx,ky,knobR,0,Math.PI*2); ctx.fill();
          ctx.strokeStyle = kColors[ki]+"60";
          ctx.lineWidth = 1.2*scale;
          ctx.beginPath(); ctx.arc(kx,ky,knobR,Math.PI*0.75,Math.PI*2.25); ctx.stroke();
          ctx.strokeStyle = kColors[ki];
          ctx.lineWidth = 1.2*scale;
          ctx.beginPath();
          ctx.moveTo(kx,ky);
          ctx.lineTo(kx+Math.cos(knobs[ki])*knobR*0.65, ky+Math.sin(knobs[ki])*knobR*0.65);
          ctx.stroke();
          ctx.fillStyle = kColors[ki];
          ctx.beginPath(); ctx.arc(kx,ky,knobR*0.10,0,Math.PI*2); ctx.fill();
        });

        // LED buttons below knobs — 3 small dots
        const btnY = rowTopY+row1H*0.84;
        [0.22,0.50,0.78].forEach((_,bi)=>{
          const bx  = sx+sw*[0.22,0.50,0.78][bi];
          const on  = (i+bi)%3!==0;
          ctx.fillStyle = on ? ch.btnColor : "#1a2028";
          ctx.beginPath(); ctx.arc(bx,btnY,sw*0.07,0,Math.PI*2); ctx.fill();
        });

        // ── Fader + VU row (bottom 64%) ──────────────────────────────────
        const row2Y = rowTopY+row1H+3*scale;
        const row2H = rowBotY-row2Y;

        // VU segments
        const vuW  = sw*0.16;
        const vuH  = row2H*0.58;
        const vuX  = sx+sw*0.05;
        const vuY2 = row2Y+row2H*0.04;
        ch.vu += (ch.vuTarget-ch.vu)*0.05;
        if(Math.random()<0.01) ch.vuTarget=Math.random()*0.7+0.12;
        const lvl = ch.vu*(1+Math.sin(time*0.9+i*0.4)*0.07);
        const segs = 10;
        const sH   = (vuH/segs)*0.72;
        const sGap = (vuH/segs)*0.28;
        for(let s=0;s<segs;s++){
          const sy2 = vuY2+vuH-(s+1)*(sH+sGap);
          const lit = s/segs < lvl;
          const c   = s>8?"#FF6B4A":s>6?"#F0A500":"#14D8C4";
          ctx.fillStyle = lit ? c : c+"20";
          ctx.beginPath();
          (ctx as any).roundRect(vuX,sy2,vuW,sH,1); ctx.fill();
        }

        // Fader
        const fdrX    = sx+sw*0.38;
        const fdrW    = sw*0.15;
        const fdrTopY2= row2Y+row2H*0.03;
        const fdrBotY2= row2Y+row2H*0.90;
        const fdrH    = fdrBotY2-fdrTopY2;
        ctx.fillStyle = "#0d1117";
        ctx.beginPath();
        (ctx as any).roundRect(fdrX+(fdrW-fdrW*0.28)/2,fdrTopY2,fdrW*0.28,fdrH,2*scale);
        ctx.fill();
        ch.fader+=ch.faderV;
        if(ch.fader<0.08||ch.fader>0.92) ch.faderV*=-1;
        const capY  = fdrTopY2+ch.fader*fdrH;
        const capH2 = fdrH*0.075;
        ctx.fillStyle = "#2d3748";
        ctx.beginPath();
        (ctx as any).roundRect(fdrX,capY-capH2/2,fdrW,capH2,2*scale); ctx.fill();
        ctx.strokeStyle = "#4a5568";
        ctx.lineWidth = 0.4*scale;
        ctx.beginPath();
        ctx.moveTo(fdrX+2*scale,capY); ctx.lineTo(fdrX+fdrW-2*scale,capY); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    };

    // ── DRAW: bottom compression + EQ meters ─────────────────────────────
    const drawBottomMeters = (time: number) => {
      const w=W(), h=H();
      const baseY = h*0.88;
      const meterH = h*0.08;

      // Compression GR meter — left side
      compMeter.reduction += (compMeter.target - compMeter.reduction)*0.04;
      if(Math.random()<0.015) compMeter.target = Math.random()*0.5+0.1;
      const compW = w*0.18;
      const compX = w*0.02;

      ctx.globalAlpha = 0.22;
      ctx.fillStyle = "#0d1117";
      ctx.beginPath();
      (ctx as any).roundRect(compX, baseY, compW, meterH, 3);
      ctx.fill();

      // GR label
      ctx.fillStyle = "#F0A500";
      ctx.font = `bold ${Math.round(h*0.009)}px monospace`;
      ctx.textAlign = "left";
      ctx.fillText("GR", compX+6, baseY+meterH*0.35);

      // GR bar (inverted — reduction from right)
      const grBarW = (compW-30)*compMeter.reduction;
      ctx.fillStyle = "#F0A500";
      ctx.beginPath();
      (ctx as any).roundRect(compX+compW-8-grBarW, baseY+meterH*0.45, grBarW, meterH*0.35, 2);
      ctx.fill();

      // Tick marks
      ctx.strokeStyle = "#F0A50060";
      ctx.lineWidth = 0.5;
      [0.25,0.5,0.75].forEach(tp=>{
        const tx = compX+compW-8-tp*(compW-30);
        ctx.beginPath(); ctx.moveTo(tx,baseY+meterH*0.42); ctx.lineTo(tx,baseY+meterH*0.38); ctx.stroke();
      });

      // EQ band display — right of compression
      const eqStartX = compX+compW+w*0.02;
      const eqBandW  = w*0.30;
      const bandW    = eqBandW/bottomEQ.length;

      ctx.fillStyle = "#0d1117";
      ctx.beginPath();
      (ctx as any).roundRect(eqStartX, baseY, eqBandW, meterH, 3);
      ctx.fill();

      bottomEQ.forEach((band,i)=>{
        band.gain += (band.target-band.gain)*band.spd + Math.sin(time*0.3+i*0.6)*0.003;
        if(Math.abs(band.gain)>0.72) band.target=(Math.random()-0.5)*0.5;

        const bx  = eqStartX + i*bandW + bandW*0.15;
        const bww = bandW*0.6;
        const midY = baseY+meterH*0.5;
        const barH = Math.abs(band.gain)*meterH*0.42;
        const col  = band.gain>0?"#14D8C4":"#00B7FF";

        ctx.fillStyle = col;
        ctx.beginPath();
        if(band.gain>0){
          (ctx as any).roundRect(bx, midY-barH, bww, barH, 1);
        } else {
          (ctx as any).roundRect(bx, midY, bww, barH, 1);
        }
        ctx.fill();

        // Center line
        ctx.strokeStyle = "#ffffff15";
        ctx.lineWidth = 0.3;
        ctx.beginPath();
        ctx.moveTo(eqStartX+2, midY); ctx.lineTo(eqStartX+eqBandW-2, midY); ctx.stroke();

        // Label
        ctx.fillStyle = "#ffffff30";
        ctx.font = `${Math.round(h*0.007)}px monospace`;
        ctx.textAlign = "center";
        ctx.fillText(band.label, bx+bww/2, baseY+meterH*0.92);
      });

      ctx.globalAlpha = 1;
    };

    const drawDots = () => {
      const w=W(), h=H();
      dots.forEach(d=>{
        d.y-=d.spd;
        if(d.y<-0.02){d.y=1.02;d.x=Math.random();}
        ctx.beginPath();
        ctx.arc(d.x*w,d.y*h,d.r,0,Math.PI*2);
        ctx.fillStyle=d.col+hex2(d.op);
        ctx.fill();
      });
    };

    const drawVignette = () => {
      const w=W(), h=H();
      // Right fade
      const gr=ctx.createLinearGradient(w*0.45,0,w,0);
      gr.addColorStop(0,"rgba(10,10,10,0)");
      gr.addColorStop(1,"rgba(10,10,10,0.98)");
      ctx.fillStyle=gr; ctx.fillRect(0,0,w,h);
      // Top
      const gt=ctx.createLinearGradient(0,0,0,h*0.10);
      gt.addColorStop(0,"rgba(10,10,10,0.98)");
      gt.addColorStop(1,"rgba(10,10,10,0)");
      ctx.fillStyle=gt; ctx.fillRect(0,0,w,h*0.10);
      // Bottom
      const gb=ctx.createLinearGradient(0,h*0.84,0,h);
      gb.addColorStop(0,"rgba(10,10,10,0)");
      gb.addColorStop(1,"rgba(10,10,10,0.96)");
      ctx.fillStyle=gb; ctx.fillRect(0,0,w,h);
      // Centre darkness to keep text readable
      const gc=ctx.createRadialGradient(w*0.5,h*0.45,h*0.04,w*0.5,h*0.45,h*0.55);
      gc.addColorStop(0,"rgba(10,10,10,0.60)");
      gc.addColorStop(1,"rgba(10,10,10,0)");
      ctx.fillStyle=gc; ctx.fillRect(0,0,w,h);
    };

    const frame = () => {
      t+=0.012;
      const w=W(), h=H();
      ctx.clearRect(0,0,w,h);
      ctx.fillStyle="#0A0A0A";
      ctx.fillRect(0,0,w,h);

      drawMixerPanel(t);
      drawBottomMeters(t);
      drawDots();
      drawVignette();

      animId=requestAnimationFrame(frame);
    };

    frame();
    return ()=>{
      cancelAnimationFrame(animId);
      window.removeEventListener("resize",resize);
    };
  },[]);

  return (
    <canvas ref={canvasRef} style={{
      position:"fixed", top:0, left:0,
      width:"100vw", height:"100vh",
      zIndex:0, pointerEvents:"none",
    }}/>
  );
}