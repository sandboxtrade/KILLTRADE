(() => {
  "use strict";

  const $ = (id) => document.getElementById(id);
  const els = {
    files: $("files"),
    dropzone: $("dropzone"),
    thumbs: $("thumbs"),
    fileCount: $("fileCount"),
    simulations: $("simulations"),
    simValue: $("simValue"),
    horizon: $("horizon"),
    horizonValue: $("horizonValue"),
    marketProfile: $("marketProfile"),
    analyzeBtn: $("analyzeBtn"),
    resetBtn: $("resetBtn"),
    canvas: $("chartCanvas"),
    empty: $("empty"),
    status: $("status"),
    recognition: $("recognition"),
    timeframeState: $("timeframeState"),
    confidence: $("confidence"),
    mMomentum: $("mMomentum"),
    mVol: $("mVol"),
    mAccel: $("mAccel"),
    mDraw: $("mDraw"),
    probA: $("probA"),
    probB: $("probB"),
    descA: $("descA"),
    descB: $("descB"),
    showModelA: $("showModelA"),
    showModelB: $("showModelB"),
    focusA: $("focusA"),
    focusB: $("focusB"),
    scenarioA: $("scenarioA"),
    scenarioB: $("scenarioB"),
    regimeRead: $("regimeRead"),
    participantRead: $("participantRead"),
    participantMap: $("participantMap"),
    driverA: $("driverA"),
    driverB: $("driverB")
  };

  const ctx = els.canvas.getContext("2d");
  let files = [];
  let lastResult = null;
  let selectedModel = 0;

  // Hard architectural split: chart continuity can never dominate the model.
  // It is used only to make the first projected candles connect naturally to history.
  const ENGINE_BEHAVIOR_WEIGHT = 0.95;
  const ENGINE_CONTINUITY_WEIGHT = 0.05;

  const TIMEFRAMES = [
    { id: "auto", label: "Auto", rank: 0 },
    { id: "m5", label: "5m", rank: 1 },
    { id: "m15", label: "15m", rank: 2 },
    { id: "h1", label: "1h", rank: 3 },
    { id: "h4", label: "4h", rank: 4 },
    { id: "d1", label: "1d", rank: 5 }
  ];
  const TF_META = Object.fromEntries(TIMEFRAMES.map(t => [t.id, t]));

  const PARTICIPANT_PROFILES = {
    microcap: [
      {name:"retail",       capital:.28, flow:.17, fomo:.92, panic:.93, profit:.48, aggression:.60},
      {name:"activeRetail", capital:.16, flow:.24, fomo:.70, panic:.38, profit:.92, aggression:.92},
      {name:"whales",       capital:.12, flow:.09, fomo:.12, panic:.12, profit:.74, aggression:.85},
      {name:"insiders",     capital:.25, flow:.12, fomo:.04, panic:.03, profit:.90, aggression:.80},
      {name:"snipers",      capital:.07, flow:.12, fomo:.45, panic:.18, profit:.98, aggression:1.00},
      {name:"bots",         capital:.03, flow:.12, fomo:.15, panic:.10, profit:.58, aggression:1.00},
      {name:"liquidity",    capital:.08, flow:.13, fomo:.02, panic:.02, profit:.10, aggression:.95},
      {name:"pro",          capital:.01, flow:.01, fomo:.08, panic:.06, profit:.78, aggression:.70}
    ],
    lowcap: [
      {name:"retail",       capital:.30, flow:.17, fomo:.90, panic:.90, profit:.45, aggression:.50},
      {name:"activeRetail", capital:.19, flow:.27, fomo:.65, panic:.30, profit:.95, aggression:.90},
      {name:"whales",       capital:.13, flow:.10, fomo:.15, panic:.10, profit:.70, aggression:.80},
      {name:"insiders",     capital:.20, flow:.09, fomo:.05, panic:.05, profit:.85, aggression:.70},
      {name:"snipers",      capital:.05, flow:.10, fomo:.40, panic:.20, profit:.98, aggression:1.00},
      {name:"bots",         capital:.04, flow:.12, fomo:.12, panic:.08, profit:.55, aggression:1.00},
      {name:"liquidity",    capital:.07, flow:.13, fomo:.02, panic:.02, profit:.08, aggression:.95},
      {name:"pro",          capital:.02, flow:.02, fomo:.08, panic:.06, profit:.75, aggression:.72}
    ],
    midcap: [
      {name:"retail",       capital:.34, flow:.20, fomo:.82, panic:.78, profit:.42, aggression:.45},
      {name:"activeRetail", capital:.20, flow:.26, fomo:.60, panic:.28, profit:.90, aggression:.85},
      {name:"whales",       capital:.15, flow:.12, fomo:.12, panic:.08, profit:.68, aggression:.74},
      {name:"insiders",     capital:.12, flow:.07, fomo:.04, panic:.04, profit:.82, aggression:.60},
      {name:"snipers",      capital:.03, flow:.06, fomo:.35, panic:.16, profit:.96, aggression:.95},
      {name:"bots",         capital:.05, flow:.12, fomo:.10, panic:.06, profit:.52, aggression:.98},
      {name:"liquidity",    capital:.08, flow:.14, fomo:.02, panic:.02, profit:.08, aggression:.90},
      {name:"pro",          capital:.03, flow:.03, fomo:.07, panic:.05, profit:.72, aggression:.70}
    ]
  };


  const BEHAVIOR_REGIMES = {
    accumulation: {
      label: "Скрытое накопление",
      buy: { whales:.55, pro:.48, insiders:.18, activeRetail:.12, liquidity:.22 },
      sell: { retail:-.08, whales:-.10, pro:-.12 },
      liquidity: 1.06,
      attention: -0.02
    },
    fomo_chase: {
      label: "FOMO-погоня",
      buy: { retail:.78, activeRetail:.58, snipers:.48, bots:.34, pro:.10 },
      sell: { whales:.20, insiders:.34, pro:.16 },
      liquidity: .94,
      attention: .08
    },
    distribution: {
      label: "Разгрузка в спрос",
      buy: { retail:.42, activeRetail:.20, bots:.10 },
      sell: { insiders:.82, whales:.68, pro:.34, snipers:.20 },
      liquidity: .91,
      attention: .03
    },
    panic_exit: {
      label: "Панический выход",
      buy: { liquidity:.26, pro:.12 },
      sell: { retail:.92, activeRetail:.64, snipers:.44, whales:.30, bots:.28 },
      liquidity: .78,
      attention: .10
    },
    absorption: {
      label: "Поглощение предложения",
      buy: { liquidity:.72, whales:.36, pro:.42, activeRetail:.18 },
      sell: { retail:.18, insiders:.16 },
      liquidity: 1.12,
      attention: -.03
    },
    liquidity_vacuum: {
      label: "Дефицит ликвидности",
      buy: { activeRetail:.34, snipers:.42, bots:.48 },
      sell: { activeRetail:.34, snipers:.42, bots:.48 },
      liquidity: .66,
      attention: .12
    },
    balance: {
      label: "Баланс потоков",
      buy: { liquidity:.10, pro:.06 },
      sell: { liquidity:.10, pro:.06 },
      liquidity: 1.02,
      attention: -.04
    }
  };

  const PARTICIPANT_LABELS = {
    retail: "retail",
    activeRetail: "active retail",
    whales: "whales",
    insiders: "insiders",
    snipers: "snipers",
    bots: "bots",
    liquidity: "liquidity providers",
    pro: "pro capital"
  };

  const ROLE_STATE_PRIORS = {
    retail:       {load:.58, pnl:.01},
    activeRetail: {load:.52, pnl:.03},
    whales:       {load:.62, pnl:.14},
    insiders:     {load:.72, pnl:.34},
    snipers:      {load:.44, pnl:.07},
    bots:         {load:.36, pnl:.02},
    liquidity:    {load:.50, pnl:.00},
    pro:          {load:.56, pnl:.10}
  };

  const COLORS = {
    bg: "#05070a",
    grid: "#11151c",
    marker: "#2a313b",
    up: "#9fbea9",
    down: "#bc959c",
    histUp: "rgba(238,241,246,.96)",
    histDown: "rgba(134,143,158,.92)",
    ghostUp: "rgba(159,190,169,.18)",
    ghostDown: "rgba(188,149,156,.18)",
    text: "#768091",
    current: "#f4f6fb"
  };

  function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function mean(a){ return a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0; }
  function std(a){ if (!a.length) return 0; const m=mean(a); return Math.sqrt(mean(a.map(v=>(v-m)*(v-m)))); }
  function quantile(arr, q){
    if(!arr.length) return 0;
    const a=[...arr].sort((x,y)=>x-y);
    const pos=(a.length-1)*q, lo=Math.floor(pos), hi=Math.ceil(pos);
    return lo===hi ? a[lo] : lerp(a[lo], a[hi], pos-lo);
  }
  function gauss(){ let u=0,v=0; while(u===0) u=Math.random(); while(v===0) v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
  function sigmoid(x){ return 1/(1+Math.exp(-x)); }
  function softmax3(buy,hold,sell){ const m=Math.max(buy,hold,sell), eb=Math.exp(buy-m), eh=Math.exp(hold-m), es=Math.exp(sell-m), z=eb+eh+es; return [eb/z,eh/z,es/z]; }
  function smooth(values,radius=3){
    if(!values.length) return [];
    const out=new Array(values.length);
    for(let i=0;i<values.length;i++){
      let s=0,n=0;
      for(let j=Math.max(0,i-radius); j<=Math.min(values.length-1,i+radius); j++){ s+=values[j]; n++; }
      out[i]=s/n;
    }
    return out;
  }
  function normalizePath(path){
    if(!path.length) return [];
    const p0=path[0], range=Math.max(1e-6, Math.max(...path)-Math.min(...path));
    return path.map(v => (v-p0)/range);
  }
  function resample(arr,n){
    if(!arr.length) return [];
    if(arr.length===1) return Array(n).fill(arr[0]);
    const out=[];
    for(let i=0;i<n;i++){
      const t=i/(n-1)*(arr.length-1), a=Math.floor(t), b=Math.min(arr.length-1,a+1);
      out.push(lerp(arr[a], arr[b], t-a));
    }
    return out;
  }

  function inferTimeframe(name){
    const s=(name||"").toLowerCase();
    if(/(^|[^\d])5\s*m|5мин|m5|5m/.test(s)) return "m5";
    if(/(^|[^\d])15\s*m|15мин|m15|15m/.test(s)) return "m15";
    if(/1\s*h|1ч|h1|1h/.test(s)) return "h1";
    if(/4\s*h|4ч|h4|4h/.test(s)) return "h4";
    if(/1\s*d|1д|d1|1d/.test(s)) return "d1";
    return "h1";
  }

  async function fileToImage(file){
    const url=URL.createObjectURL(file);
    try {
      const img=new Image();
      img.decoding="async";
      await new Promise((resolve,reject)=>{ img.onload=resolve; img.onerror=reject; img.src=url; });
      return img;
    } finally { setTimeout(()=>URL.revokeObjectURL(url),1000); }
  }

  function getImageData(img){
    const maxW=900;
    const scale=Math.min(1, maxW/img.naturalWidth);
    const w=Math.max(320, Math.round(img.naturalWidth*scale));
    const h=Math.max(180, Math.round(img.naturalHeight*scale));
    const c=document.createElement('canvas');
    c.width=w; c.height=h;
    const cctx=c.getContext('2d',{willReadFrequently:true});
    cctx.drawImage(img,0,0,w,h);
    return { w,h,data:cctx.getImageData(0,0,w,h).data };
  }

  function estimateBounds(dataObj){
    const {w,h,data}=dataObj;
    const x0=Math.round(w*0.07), x1=Math.round(w*0.88);
    const y0=Math.round(h*0.10), y1=Math.round(h*0.78); // ignore volume panel at bottom for crypto app screenshots

    const rs=[],gs=[],bs=[];
    for(let y=y0;y<y1;y+=Math.max(4,Math.floor(h/80))){
      for(let x=x0;x<x1;x+=Math.max(4,Math.floor(w/120))){
        const i=(y*w+x)*4; rs.push(data[i]); gs.push(data[i+1]); bs.push(data[i+2]);
      }
    }
    const med = arr => { const a=[...arr].sort((a,b)=>a-b); return a[Math.floor(a.length/2)]||0; };
    const bg=[med(rs),med(gs),med(bs)];
    const contrastAt=(x,y)=>{
      const i=(y*w+x)*4;
      const dr=data[i]-bg[0], dg=data[i+1]-bg[1], db=data[i+2]-bg[2];
      const chroma=Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]);
      const lum=Math.sqrt(dr*dr+dg*dg+db*db);
      return lum + chroma*0.35;
    };

    const colActivity=[];
    for(let x=x0;x<x1;x+=2){
      let active=0;
      for(let y=y0;y<y1;y+=3) if(contrastAt(x,y)>36) active++;
      colActivity.push({x,active});
    }
    const actVals=colActivity.map(d=>d.active);
    const threshold=Math.max(2, quantile(actVals,.62));
    const activeCols=colActivity.filter(d=>d.active>=threshold).map(d=>d.x);
    const ax0=activeCols.length ? Math.max(x0, quantile(activeCols,.02)) : x0;
    const ax1=activeCols.length ? Math.min(x1, quantile(activeCols,.98)) : x1;
    return {w,h,data,bg,contrastAt,x0:ax0,x1:ax1,y0,y1,colActivity};
  }

  function extractPath(bounds){
    const {x0,x1,y0,y1,contrastAt,colActivity}=bounds;
    const bucket=Math.max(2, Math.floor((x1-x0)/260));
    const ys=[];
    let prevY=null;
    let qualityAccum=0;
    for(let bx=Math.floor(x0); bx<x1; bx+=bucket){
      const candidates=[];
      for(let x=bx; x<Math.min(x1,bx+bucket); x++){
        for(let y=y0; y<y1; y+=2){
          const score=contrastAt(x,y);
          if(score>46){
            let continuity=1;
            if(prevY!==null){ const d=Math.abs(y-prevY)/(y1-y0); continuity=Math.exp(-d*7); }
            const centerPenalty=1 - 0.10*Math.abs((y-(y0+y1)/2)/(y1-y0));
            candidates.push({y,score:score*continuity*centerPenalty});
          }
        }
      }
      if(!candidates.length){ if(prevY!==null) ys.push(prevY); continue; }
      candidates.sort((a,b)=>b.score-a.score);
      const top=candidates.slice(0, Math.min(22,candidates.length));
      const sw=top.reduce((s,c)=>s+c.score,0);
      const y=top.reduce((s,c)=>s+c.y*c.score,0)/(sw||1);
      prevY = prevY===null ? y : lerp(prevY,y,.72);
      ys.push(prevY);
      qualityAccum += clamp(top.length/12,0,1);
    }
    if(ys.length<24) return { path:[], confidence:0 };
    let path=ys.map(y => -(y-y0)/(y1-y0));
    path=smooth(path,2);
    const diffs=path.slice(1).map((v,i)=>Math.abs(v-path[i]));
    const jumpCap=Math.max(.008, quantile(diffs,.88)*2.8);
    for(let i=1;i<path.length;i++){
      const d=path[i]-path[i-1];
      if(Math.abs(d)>jumpCap) path[i]=path[i-1]+Math.sign(d)*jumpCap;
    }
    path=smooth(path,2);
    const activeCols=colActivity.filter(d=>d.active>=Math.max(2, quantile(colActivity.map(v=>v.active), .62))).map(d=>d.x);
    const activityScore=clamp(activeCols.length / Math.max(1,colActivity.length) * 1.6, 0, 1);
    const continuityScore=clamp(1 - std(path.slice(1).map((v,i)=>v-path[i]))*18, 0, 1);
    const coverageScore=clamp(path.length/180,0,1);
    const candidateScore=clamp(qualityAccum/Math.max(1,path.length),0,1);
    const confidence=clamp(.30*activityScore + .25*continuityScore + .25*coverageScore + .20*candidateScore,0,1);
    return { path: normalizePath(path), confidence };
  }

  function mergeSegments(segments, maxGap=2){
    if(!segments.length) return [];
    const out=[segments[0]];
    for(let i=1;i<segments.length;i++){
      const cur=segments[i], prev=out[out.length-1];
      if(cur.start - prev.end <= maxGap){ prev.end=cur.end; }
      else out.push(cur);
    }
    return out;
  }

  function extractCandles(bounds){
    const {x0,x1,y0,y1,contrastAt}=bounds;
    const counts=[];
    for(let x=Math.floor(x0); x<=Math.floor(x1); x++){
      let count=0;
      for(let y=y0; y<y1; y++) if(contrastAt(x,y)>48) count++;
      counts.push(count);
    }
    const nonZero=counts.filter(v=>v>0);
    if(nonZero.length<20) return {candles:[], confidence:0};
    const baseTh=Math.max(2, Math.floor(quantile(nonZero,.35)*0.45));
    const raw=[];
    let run=null;
    for(let i=0;i<counts.length;i++){
      if(counts[i]>=baseTh){ if(!run) run={start:i,end:i}; else run.end=i; }
      else if(run){ raw.push(run); run=null; }
    }
    if(run) raw.push(run);
    let segments=mergeSegments(raw,2).filter(s => (s.end-s.start+1)>=1 && (s.end-s.start+1)<=24);
    segments=segments.filter(s => {
      const mid=(s.start+s.end)/2;
      const px=x0+mid;
      let verticalSpread=[];
      for(let x=Math.floor(x0+s.start); x<=Math.floor(x0+s.end); x++){
        for(let y=y0; y<y1; y++) if(contrastAt(x,y)>48) verticalSpread.push(y);
      }
      if(verticalSpread.length<3) return false;
      const spread=Math.max(...verticalSpread)-Math.min(...verticalSpread);
      return spread>6 && px > x0+4 && px < x1-4;
    });

    const candles=[];
    for(const s of segments){
      const xs=[];
      for(let x=Math.floor(x0+s.start); x<=Math.floor(x0+s.end); x++) xs.push(x);
      const ysAll=[];
      const ysLeft=[];
      const ysRight=[];
      const leftCut=Math.floor(xs.length*0.35);
      const rightCut=Math.floor(xs.length*0.65);
      xs.forEach((x,ix)=>{
        for(let y=y0; y<y1; y++){
          if(contrastAt(x,y)>48){
            ysAll.push(y);
            if(ix<=leftCut) ysLeft.push(y);
            if(ix>=rightCut) ysRight.push(y);
          }
        }
      });
      if(ysAll.length<4) continue;
      const high=-(Math.min(...ysAll)-y0)/(y1-y0);
      const low=-(Math.max(...ysAll)-y0)/(y1-y0);
      const open=-(quantile(ysLeft.length?ysLeft:ysAll,.50)-y0)/(y1-y0);
      const close=-(quantile(ysRight.length?ysRight:ysAll,.50)-y0)/(y1-y0);
      candles.push({o:open,h:Math.max(high,open,close),l:Math.min(low,open,close),c:close});
    }

    if(candles.length<8) return {candles:[], confidence:0};
    const widths=segments.map(s=>s.end-s.start+1);
    const regularity=1-clamp(std(widths)/Math.max(1,mean(widths))*0.5,0,1);
    const confidence=clamp(0.45 + Math.min(candles.length,40)/70 + regularity*0.25,0,1);
    return { candles, confidence };
  }

  async function analyzeImage(item){
    const img=await fileToImage(item.file);
    const dataObj=getImageData(img);
    const bounds=estimateBounds(dataObj);
    const line=extractPath(bounds);
    const cand=extractCandles(bounds);
    const tf = item.tf === 'auto' ? inferTimeframe(item.file.name) : item.tf;
    const historyCandles = cand.candles.length ? normalizeCandles(cand.candles) : [];
    const path = historyCandles.length ? normalizePath(historyCandles.map(c=>c.c)) : line.path;
    const confidence = Math.max(line.confidence*0.7, cand.confidence*0.95);
    return {
      name:item.file.name,
      tf,
      tfLabel:TF_META[tf]?.label || tf,
      path,
      lineConfidence:line.confidence,
      candleConfidence:cand.confidence,
      confidence,
      candles:historyCandles,
      sourceWidth:dataObj.w,
      sourceHeight:dataObj.h
    };
  }

  function normalizeCandles(candles){
    if(!candles.length) return [];
    const lastClose=candles[candles.length-1].c;
    const highs=candles.map(c=>c.h), lows=candles.map(c=>c.l);
    const range=Math.max(1e-6, Math.max(...highs)-Math.min(...lows));
    return candles.map(c=>({
      o:(c.o-lastClose)/range,
      h:(c.h-lastClose)/range,
      l:(c.l-lastClose)/range,
      c:(c.c-lastClose)/range
    }));
  }

  function deriveVisualState(path){
    const returns=path.slice(1).map((v,i)=>v-path[i]);
    const n=returns.length;
    const fast=returns.slice(Math.max(0,n-18));
    const mid=returns.slice(Math.max(0,n-55));
    const slow=returns.slice(Math.max(0,n-120));
    const rawMomentum=mean(fast)*8 + mean(mid)*3 + mean(slow);
    const rawVol=std(fast)*.65 + std(mid)*.35;
    const rawAccel=mean(fast)-mean(mid);
    const peak=Math.max(...path), current=path[path.length-1], range=Math.max(1e-6,Math.max(...path)-Math.min(...path));
    const drawdown=(peak-current)/range;
    let same=0;
    for(let i=1;i<returns.length;i++) if(Math.sign(returns[i])===Math.sign(returns[i-1])) same++;
    const persistence=same/Math.max(1,returns.length-1);
    const recentRange=Math.max(...path.slice(-40))-Math.min(...path.slice(-40));
    const compression=clamp(1 - recentRange/(range||1),0,1);

    // These are not TA signals. They are latent behavioural clues inferred from
    // the market's visible consequence: displacement, stress, continuity and exhaustion.
    const momentum=clamp(rawMomentum*3,-1,1);
    const vol=clamp(rawVol*14,0,1.5);
    const accel=clamp(rawAccel*18,-1,1);
    const pressureBias=clamp(momentum*.48 + accel*.20 + (persistence-.5)*.48 - drawdown*.14, -1, 1);
    const crowdStress=clamp(vol*.62 + Math.abs(accel)*.24 + drawdown*.28, 0, 1);
    const reflexivity=clamp(Math.abs(momentum)*.28 + Math.abs(accel)*.22 + vol*.18 + persistence*.22, 0, 1);
    const capitulationRisk=clamp(drawdown*.46 + Math.max(0,-momentum)*.24 + Math.max(0,-accel)*.16 + vol*.18, 0, 1);
    const absorption=clamp((1-clamp(vol,0,1))*.16 + persistence*.28 + compression*.28 + Math.max(0,pressureBias)*.12, 0, 1);
    const liquidityFragility=clamp(crowdStress*.34 + reflexivity*.28 + (1-absorption)*.24 + (1-compression)*.14, 0, 1);
    const distributionRisk=clamp(Math.max(0,momentum)*.18 + Math.max(0,-accel)*.24 + crowdStress*.20 + drawdown*.18 + reflexivity*.20, 0, 1);

    // The only 5% "technical" component: short-lived directional continuity.
    // It knows nothing about levels, patterns or indicators.
    const continuityTrace=clamp(mean(fast)*16 + rawAccel*6, -1, 1);

    return {
      momentum,
      vol,
      accel,
      drawdown:clamp(drawdown,0,1),
      persistence:clamp(persistence,0,1),
      compression,
      pressureBias,
      crowdStress,
      reflexivity,
      capitulationRisk,
      absorption,
      liquidityFragility,
      distributionRisk,
      continuityTrace
    };
  }

  function mergeStates(shortS, midS, longS){
    const s=shortS||midS||longS, m=midS||shortS||longS, l=longS||midS||shortS;
    if(!s && !m && !l) return null;
    const visual={
      momentum: clamp((s.momentum*.50)+(m.momentum*.30)+(l.momentum*.20), -1, 1),
      vol: clamp((s.vol*.55)+(m.vol*.30)+(l.vol*.15), 0, 1.5),
      accel: clamp((s.accel*.55)+(m.accel*.30)+(l.accel*.15), -1, 1),
      drawdown: clamp((s.drawdown*.25)+(m.drawdown*.35)+(l.drawdown*.40), 0, 1),
      persistence: clamp((s.persistence*.50)+(m.persistence*.30)+(l.persistence*.20), 0, 1),
      compression: clamp((s.compression*.40)+(m.compression*.30)+(l.compression*.30), 0, 1),
      pressureBias: clamp((s.pressureBias*.50)+(m.pressureBias*.30)+(l.pressureBias*.20), -1, 1),
      crowdStress: clamp((s.crowdStress*.55)+(m.crowdStress*.30)+(l.crowdStress*.15), 0, 1),
      reflexivity: clamp((s.reflexivity*.50)+(m.reflexivity*.30)+(l.reflexivity*.20), 0, 1),
      capitulationRisk: clamp((s.capitulationRisk*.25)+(m.capitulationRisk*.35)+(l.capitulationRisk*.40), 0, 1),
      absorption: clamp((s.absorption*.45)+(m.absorption*.30)+(l.absorption*.25), 0, 1),
      liquidityFragility: clamp((s.liquidityFragility*.45)+(m.liquidityFragility*.30)+(l.liquidityFragility*.25), 0, 1),
      distributionRisk: clamp((s.distributionRisk*.30)+(m.distributionRisk*.35)+(l.distributionRisk*.35), 0, 1),
      continuityTrace: clamp((s.continuityTrace*.70)+(m.continuityTrace*.22)+(l.continuityTrace*.08), -1, 1)
    };
    return visual;
  }


  function inferBehaviorRegimes(v){
    const nearBalance=1-Math.abs(v.pressureBias);
    const scores={
      accumulation:
        .25 +
        1.18*v.absorption +
        .62*(1-v.crowdStress) +
        .42*Math.max(0,v.pressureBias) +
        .34*v.compression -
        .48*v.capitulationRisk,
      fomo_chase:
        .18 +
        1.16*Math.max(0,v.pressureBias) +
        .92*v.reflexivity +
        .68*v.crowdStress +
        .28*(1-v.compression),
      distribution:
        .20 +
        1.12*v.distributionRisk +
        .54*v.crowdStress +
        .42*Math.max(0,v.momentum) +
        .52*Math.max(0,-v.accel),
      panic_exit:
        .16 +
        1.24*Math.max(0,-v.pressureBias) +
        .92*v.crowdStress +
        .92*v.capitulationRisk +
        .26*v.liquidityFragility,
      absorption:
        .20 +
        1.18*v.absorption +
        .52*v.crowdStress +
        .48*nearBalance +
        .22*v.drawdown,
      liquidity_vacuum:
        .12 +
        1.18*v.liquidityFragility +
        .70*v.crowdStress +
        .42*Math.abs(v.pressureBias) +
        .30*(1-v.absorption),
      balance:
        .28 +
        .92*nearBalance +
        .62*(1-v.crowdStress) +
        .42*v.compression +
        .28*(1-v.reflexivity)
    };

    const entries=Object.entries(scores);
    const maxScore=Math.max(...entries.map(([,s])=>s));
    const exps=entries.map(([id,s])=>[id,Math.exp((s-maxScore)*1.55)]);
    const total=exps.reduce((sum,[,v])=>sum+v,0) || 1;
    return exps
      .map(([id,e])=>({id,label:BEHAVIOR_REGIMES[id].label,prob:e/total,score:scores[id]}))
      .sort((a,b)=>b.prob-a.prob);
  }

  function sampleRegime(regimes){
    let r=Math.random();
    for(const item of regimes){
      r-=item.prob;
      if(r<=0) return item.id;
    }
    return regimes[regimes.length-1]?.id || 'balance';
  }

  function regimeSideBoost(regimeId, participantName, side){
    const regime=BEHAVIOR_REGIMES[regimeId] || BEHAVIOR_REGIMES.balance;
    const table=side==='buy' ? regime.buy : regime.sell;
    return table[participantName] || 0;
  }

  function weightedRegimeBoost(regimes, participantName, side){
    return (regimes||[]).reduce((sum,r)=>sum + r.prob*regimeSideBoost(r.id,participantName,side),0);
  }

  function regimeProbMap(regimes){
    const out={};
    for(const r of regimes||[]) out[r.id]=r.prob;
    return out;
  }

  function buildParticipantStates(profileName, visual, regimes){
    const profile=PARTICIPANT_PROFILES[profileName] || PARTICIPANT_PROFILES.lowcap;
    const rp=regimeProbMap(regimes);
    const fomo=rp.fomo_chase||0, dist=rp.distribution||0, panic=rp.panic_exit||0;
    const accum=rp.accumulation||0, absorb=rp.absorption||0, vacuum=rp.liquidity_vacuum||0;

    return profile.map(p=>{
      const prior=ROLE_STATE_PRIORS[p.name] || {load:.5,pnl:0};
      const isRetail=p.name==='retail', isActive=p.name==='activeRetail', isWhale=p.name==='whales';
      const isInsider=p.name==='insiders', isSniper=p.name==='snipers', isBot=p.name==='bots';
      const isLP=p.name==='liquidity', isPro=p.name==='pro';

      let load=prior.load;
      load += fomo*((isRetail?.18:0)+(isActive?.14:0)+(isSniper?.10:0));
      load += dist*((isInsider?.14:0)+(isWhale?.10:0)+(isPro?.05:0));
      load += accum*((isWhale?.08:0)+(isPro?.07:0)+(isInsider?.03:0));
      load += panic*((isRetail?.06:0)+(isActive?.04:0));
      load -= absorb*((isRetail?.05:0)+(isSniper?.04:0));
      load=clamp(load,.12,.92);

      let pnl=prior.pnl;
      pnl += fomo*((isInsider?.26:0)+(isWhale?.17:0)+(isPro?.12:0)+(isRetail?.03:0));
      pnl += dist*((isInsider?.34:0)+(isWhale?.22:0)+(isPro?.14:0)+(isRetail?.02:0));
      pnl += accum*((isWhale?.08:0)+(isPro?.07:0)+(isInsider?.06:0));
      pnl -= panic*((isRetail?.24:0)+(isActive?.17:0)+(isSniper?.10:0)+(isBot?.05:0));
      pnl -= vacuum*((isRetail?.08:0)+(isActive?.06:0));
      pnl += visual.pressureBias*((isRetail?.04:0)+(isActive?.05:0)+(isWhale?.03:0));
      pnl=clamp(pnl,-.45,1.60);

      const buyReg=weightedRegimeBoost(regimes,p.name,'buy');
      const sellReg=weightedRegimeBoost(regimes,p.name,'sell');
      const cashCapacity=1-load;

      const buyUrgency=clamp(sigmoid(
        -1.05 +
        p.fomo*(.70+visual.reflexivity*.45) +
        Math.max(0,visual.pressureBias)*.72 +
        visual.absorption*.26 +
        buyReg*.95 +
        cashCapacity*.65 -
        Math.max(0,pnl)*p.profit*.38
      ),0,1);

      const sellUrgency=clamp(sigmoid(
        -1.08 +
        p.profit*Math.max(0,pnl)*1.18 +
        p.panic*visual.crowdStress*.92 +
        visual.distributionRisk*.48 +
        visual.capitulationRisk*.42 +
        sellReg*.95 +
        load*.42
      ),0,1);

      const buyCapacity=p.capital*cashCapacity*buyUrgency;
      const sellCapacity=p.capital*load*sellUrgency;
      const buyWave=buyCapacity*(.55+p.flow*3.0)*(1+visual.reflexivity*.20);
      const sellWave=sellCapacity*(.55+p.flow*3.0)*(1+visual.crowdStress*.20);
      const waveSide=buyWave>=sellWave?'BUY':'SELL';
      const wavePotential=Math.max(buyWave,sellWave);

      return {
        name:p.name,
        label:PARTICIPANT_LABELS[p.name]||p.name,
        capitalShare:p.capital,
        flowShare:p.flow,
        positionLoad:load,
        cashRatio:1-load,
        pnl,
        buyUrgency,
        sellUrgency,
        buyCapacity,
        sellCapacity,
        waveSide,
        wavePotential
      };
    }).sort((a,b)=>b.wavePotential-a.wavePotential);
  }

  function formatSignedPct(x){
    const n=x*100;
    return `${n>0?'+':''}${n.toFixed(0)}%`;
  }

  function renderParticipantMap(states){
    if(!els.participantMap) return;
    if(!states?.length){ els.participantMap.innerHTML=''; return; }
    els.participantMap.innerHTML=states.map(s=>{
      const waveClass=s.waveSide==='BUY'?'buy':'sell';
      return `<div class="p-row">
        <div class="p-name">${s.label}</div>
        <div class="p-cell p-capital"><small>capital</small>${(s.capitalShare*100).toFixed(0)}%</div>
        <div class="p-cell"><small>loaded</small>${(s.positionLoad*100).toFixed(0)}%</div>
        <div class="p-cell"><small>uPnL</small>${formatSignedPct(s.pnl)}</div>
        <div class="p-cell p-wave ${waveClass}"><small>next wave</small>${s.waveSide} ${(s.wavePotential*100).toFixed(1)}</div>
      </div>`;
    }).join('');
  }

  function maybeTransitionRegime(m, ret, imbalance, step){
    if(step<3 || Math.random()>.085) return;
    const v=m.visual;
    const r=m.regime;

    if(r==='fomo_chase' && (ret<-.006 || (v.distributionRisk>.62 && Math.random()<.55))){
      m.regime='distribution'; return;
    }
    if(r==='distribution' && ret<-.007 && (v.crowdStress>.50 || imbalance>.48)){
      m.regime='panic_exit'; return;
    }
    if(r==='panic_exit' && ret>.006 && v.absorption>.45){
      m.regime='absorption'; return;
    }
    if(r==='absorption' && ret>.006 && v.pressureBias>.08){
      m.regime='accumulation'; return;
    }
    if(r==='accumulation' && ret>.008 && m.attention>.62){
      m.regime='fomo_chase'; return;
    }
    if(r==='liquidity_vacuum'){
      if(ret<-.008){ m.regime='panic_exit'; return; }
      if(ret>.008){ m.regime='fomo_chase'; return; }
      if(Math.abs(ret)<.002){ m.regime='balance'; return; }
    }
    if(r==='balance'){
      if(v.pressureBias>.25 && m.attention>.58){ m.regime='fomo_chase'; return; }
      if(v.pressureBias<-.25 && v.crowdStress>.52){ m.regime='panic_exit'; return; }
    }
  }

  function formatRegimeRead(regimes){
    const top=regimes.slice(0,3);
    return top.map(r=>`${r.label} ${(r.prob*100).toFixed(0)}%`).join(' · ');
  }

  function formatParticipantRead(flowSummary){
    const entries=Object.entries(flowSummary||{});
    if(!entries.length) return '—';
    entries.sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    const buyers=entries.filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,2);
    const sellers=entries.filter(([,v])=>v<0).sort((a,b)=>a[1]-b[1]).slice(0,2);
    const buyText=buyers.length ? buyers.map(([k])=>PARTICIPANT_LABELS[k]||k).join(', ') : 'нет явного лидера';
    const sellText=sellers.length ? sellers.map(([k])=>PARTICIPANT_LABELS[k]||k).join(', ') : 'нет явного лидера';
    return `спрос: ${buyText}; предложение: ${sellText}`;
  }

  async function recognizeAll(fileItems){
    const extracted=[];
    for(const item of fileItems){
      const r=await analyzeImage(item);
      if(r.path.length) extracted.push(r);
    }
    if(!extracted.length) throw new Error("Не удалось выделить график ни на одном изображении.");

    const groups = {
      short: extracted.filter(e => e.tf === 'm5' || e.tf === 'm15'),
      mid: extracted.filter(e => e.tf === 'h1'),
      long: extracted.filter(e => e.tf === 'h4' || e.tf === 'd1')
    };
    const bestOf = arr => arr.sort((a,b)=>b.confidence-a.confidence)[0] || null;
    const shortBest=bestOf([...groups.short]);
    const midBest=bestOf([...groups.mid]);
    const longBest=bestOf([...groups.long]);

    const shortState=shortBest ? deriveVisualState(shortBest.path) : null;
    const midState=midBest ? deriveVisualState(midBest.path) : null;
    const longState=longBest ? deriveVisualState(longBest.path) : null;
    const visual=mergeStates(shortState, midState, longState) || deriveVisualState(bestOf([...extracted]).path);

    const displayBase = bestOf([...(groups.short.length?groups.short:[]), ...(groups.mid.length?groups.mid:[]), ...(groups.long.length?groups.long:[])]) || extracted[0];
    let displayCandles = displayBase.candles;
    if(!displayCandles.length){
      const displayPath = resample(displayBase.path, 44);
      displayCandles = pathToCandles(displayPath.map(v=>1+v*0.3), 42, 0.9).map(c=>( { o:c.o-1, h:c.h-1, l:c.l-1, c:c.c-1 }));
    }

    const tfSummary = [shortBest && `short:${shortBest.tfLabel}`, midBest && `mid:${midBest.tfLabel}`, longBest && `long:${longBest.tfLabel}`].filter(Boolean).join(' · ');
    const confidence = mean(extracted.map(e=>e.confidence));
    const candleScore = mean(extracted.map(e=>e.candleConfidence));
    const regimes = inferBehaviorRegimes(visual);

    return { extracted, visual, regimes, confidence, candleScore, displayBase, displayCandles, tfSummary };
  }

  function initMarket(profileName, visual, regimes, participantStates){
    const base=PARTICIPANT_PROFILES[profileName].map(p=>({...p}));
    const stateBy=Object.fromEntries((participantStates||[]).map(s=>[s.name,s]));
    const regime=sampleRegime(regimes);
    const regimeDef=BEHAVIOR_REGIMES[regime] || BEHAVIOR_REGIMES.balance;
    const attention=clamp(
      .34 + .24*visual.crowdStress + .18*visual.reflexivity + .10*Math.abs(visual.pressureBias) + .08*(1-visual.compression) + regimeDef.attention,
      .05,.98
    );
    const baseLiquidity=profileName==="microcap" ? .55 : profileName==="midcap" ? 1.35 : 1.0;
    return {
      price:1,
      attention,
      liquidity:clamp(baseLiquidity*regimeDef.liquidity,.24,1.8),
      regime,
      participants:base.map(p=>{
        const st=stateBy[p.name] || {positionLoad:.5,pnl:0,buyUrgency:.5,sellUrgency:.5};
        const load=clamp(st.positionLoad + gauss()*.035,.10,.94);
        const pnl=clamp(st.pnl + gauss()*.035,-.55,1.8);
        return {
          ...p,
          stateBuyUrgency:clamp(st.buyUrgency + gauss()*.035,0,1),
          stateSellUrgency:clamp(st.sellUrgency + gauss()*.035,0,1),
          cash:clamp(p.capital*(1-load)*(1.65 + Math.random()*.30),.01,1),
          inventory:clamp(p.capital*load*(1.55 + Math.random()*.35),.01,1),
          avgEntry:clamp(1/Math.max(.20,1+pnl),.20,2.2),
          coordinated:p.name==="insiders" ? Math.random()*.5 : 0,
          regimeSensitivity:.75 + Math.random()*.5
        };
      }),
      visual
    };
  }

  function stepMarket(m, step, horizon){
    let buyFlow=0,sellFlow=0;
    const groupFlows={};
    const v=m.visual;
    const recentRet=m.lastReturn||0;
    const crowdShock=clamp(recentRet*15,-1,1);
    const fatigue=step/horizon;
    const regimeDef=BEHAVIOR_REGIMES[m.regime] || BEHAVIOR_REGIMES.balance;

    for(const p of m.participants){
      const pnl=(m.price-p.avgEntry)/Math.max(.05,p.avgEntry);
      const availableCash=clamp(p.cash,0,2), inventory=clamp(p.inventory,0,2);
      const rb=regimeSideBoost(m.regime,p.name,'buy')*p.regimeSensitivity;
      const rs=regimeSideBoost(m.regime,p.name,'sell')*p.regimeSensitivity;

      // 95%: behavioural state and participant incentives.
      let buyScore=
        -0.18 +
        .84*p.fomo*m.attention +
        .54*p.aggression*Math.max(0,v.pressureBias) +
        .24*p.aggression*Math.max(0,crowdShock) +
        .30*v.absorption +
        .22*availableCash +
        .38*(p.stateBuyUrgency||0) -
        .12*(p.stateSellUrgency||0) +
        rb -
        .28*Math.max(0,pnl) +
        gauss()*.34;

      let sellScore=
        -0.16 +
        .86*p.profit*Math.max(0,pnl) +
        .66*p.panic*v.crowdStress +
        .46*p.panic*Math.max(0,-v.pressureBias) +
        .42*p.panic*Math.max(0,-crowdShock) +
        .42*v.capitulationRisk +
        .28*v.distributionRisk +
        .16*fatigue*p.profit +
        .20*inventory +
        .38*(p.stateSellUrgency||0) -
        .10*(p.stateBuyUrgency||0) +
        rs +
        gauss()*.34;

      if(p.name==="insiders"){
        p.coordinated=clamp(p.coordinated + gauss()*.05 + Math.max(0,pnl)*.02 + v.reflexivity*.018,0,1);
        sellScore += p.coordinated*.72;
      }
      if(p.name==="liquidity"){
        buyScore += Math.max(0,-crowdShock)*.74 + v.absorption*.30;
        sellScore += Math.max(0,crowdShock)*.74 + v.crowdStress*.12;
      }

      const holdScore=.50 + (1-p.aggression)*.40 + (1-v.reflexivity)*.10 + gauss()*.12;
      const [pb,ph]=softmax3(buyScore,holdScore,sellScore);
      const r=Math.random();
      const side=r<pb ? 1 : (r<pb+ph ? 0 : -1);
      if(side===0) continue;

      const sizeBase=Math.exp(-2.42 + gauss()*.75) * (.42 + p.aggression + v.reflexivity*.12);
      if(side>0){
        const q=Math.min(availableCash,sizeBase*(.68+p.flow*2.15));
        buyFlow+=q;
        groupFlows[p.name]=(groupFlows[p.name]||0)+q;
        p.cash-=q*.10; p.inventory+=q*.10;
        p.avgEntry=lerp(p.avgEntry,m.price,clamp(q*.08,0,.25));
      } else {
        const q=Math.min(inventory,sizeBase*(.68+p.flow*2.15));
        sellFlow+=q;
        groupFlows[p.name]=(groupFlows[p.name]||0)-q;
        p.inventory-=q*.10; p.cash+=q*.10;
      }
    }

    const net=buyFlow-sellFlow, total=buyFlow+sellFlow;
    const imbalance=total>0 ? Math.abs(net)/total : 0;
    const regimeLiquidityTarget=clamp((m.regime==='liquidity_vacuum'?.62:1.0)*regimeDef.liquidity,.24,1.8);
    const stress=clamp(imbalance*(.52 + Math.abs(crowdShock)) + v.crowdStress*.18 + v.liquidityFragility*.16,0,1);
    m.liquidity=clamp(
      m.liquidity + .020*(regimeLiquidityTarget-m.liquidity) + .016*(1-m.liquidity) - .032*stress + gauss()*.006 + v.absorption*.004,
      .24,1.8
    );

    const impactMagnitude=.020 * Math.pow(Math.abs(net)/Math.max(.10,m.liquidity),.58);
    const microNoise=gauss()*(.0021 + .0048*v.crowdStress + .0028*v.liquidityFragility);

    const regimeDirection={
      accumulation:.18,
      fomo_chase:.62,
      distribution:-.50,
      panic_exit:-.76,
      absorption:.16,
      liquidity_vacuum:0,
      balance:0
    }[m.regime] || 0;

    const behaviorRet=
      Math.sign(net||1)*impactMagnitude +
      microNoise +
      .0012*v.pressureBias*(.35+.65*m.attention) +
      .0010*regimeDirection*(.4+.6*m.attention) +
      .0007*Math.sign(crowdShock||1)*v.reflexivity*(1-fatigue);

    // 5% only: local visual continuity. It decays rapidly and cannot create a scenario by itself.
    const continuityFade=Math.exp(-step/Math.max(3,horizon*.10));
    const continuityRet=.034*v.continuityTrace*continuityFade;

    let ret=ENGINE_BEHAVIOR_WEIGHT*behaviorRet + ENGINE_CONTINUITY_WEIGHT*continuityRet;
    ret=clamp(ret,-.11,.11);

    m.price*=Math.exp(ret);
    m.lastReturn=ret;
    m.attention=clamp(
      m.attention + .15*Math.abs(ret) + .035*v.reflexivity + regimeDef.attention*.08 - .014*(m.attention-.45) + gauss()*.006,
      .05,.99
    );

    maybeTransitionRegime(m,ret,imbalance,step);
    return {price:m.price,ret,groupFlows,regime:m.regime};
  }

  function runSimulations(visual, regimes, participantStates, profile, simulations, horizon){
    const paths=[];
    const flowSummary={};
    const regimeOccupancy={};
    const simMeta=[];

    for(let s=0;s<simulations;s++){
      const m=initMarket(profile,visual,regimes,participantStates);
      const path=[1];
      const localFlows={};
      const localRegimes={};
      for(let t=0;t<horizon;t++){
        regimeOccupancy[m.regime]=(regimeOccupancy[m.regime]||0)+1;
        localRegimes[m.regime]=(localRegimes[m.regime]||0)+1;
        const stepResult=stepMarket(m,t,horizon);
        path.push(stepResult.price);
        for(const [name,value] of Object.entries(stepResult.groupFlows)){
          flowSummary[name]=(flowSummary[name]||0)+value;
          localFlows[name]=(localFlows[name]||0)+value;
        }
      }
      paths.push(path);
      simMeta.push({flows:localFlows,regimes:localRegimes});
    }

    return {paths,flowSummary,regimeOccupancy,simMeta};
  }

  function pathFeatures(path){
    const start=path[0], end=path[path.length-1], max=Math.max(...path), min=Math.min(...path), mid=path[Math.floor(path.length*.5)], q1=path[Math.floor(path.length*.25)], q3=path[Math.floor(path.length*.75)];
    const rets=path.slice(1).map((v,i)=>Math.log(v/path[i]));
    return [Math.log(end/start), Math.log(max/start), Math.log(min/start), Math.log(mid/start), Math.log(q1/start), Math.log(q3/start), std(rets)*6];
  }
  function distance(a,b){ let s=0; for(let i=0;i<a.length;i++){ const d=a[i]-b[i]; s+=d*d; } return Math.sqrt(s); }
  function clusterTwo(paths){
    const feats=paths.map(pathFeatures);
    const terminal=feats.map((f,i)=>({i,v:f[0]})).sort((a,b)=>a.v-b.v);
    let c0=[...feats[terminal[Math.floor(terminal.length*.2)].i]], c1=[...feats[terminal[Math.floor(terminal.length*.8)].i]], labels=new Array(paths.length).fill(0);
    for(let iter=0;iter<12;iter++){
      const groups=[[],[]];
      for(let i=0;i<feats.length;i++){ const d0=distance(feats[i],c0), d1=distance(feats[i],c1); labels[i]=d0<=d1?0:1; groups[labels[i]].push(feats[i]); }
      [c0,c1]=[0,1].map(k=>groups[k].length ? Array.from({length:feats[0].length},(_,j)=>mean(groups[k].map(f=>f[j]))) : (k===0?c0:c1));
    }
    let ids=[[],[]]; labels.forEach((l,i)=>ids[l].push(i));
    if(!ids[0].length || !ids[1].length){
      ids=[[],[]]; const order=feats.map((f,i)=>({i,v:f[0]})).sort((a,b)=>a.v-b.v); const cut=Math.max(1,Math.floor(order.length/2));
      order.forEach((d,rank)=>ids[rank<cut?0:1].push(d.i));
      const centroidOf=indices=>Array.from({length:feats[0].length},(_,j)=>mean(indices.map(i=>feats[i][j])));
      c0=centroidOf(ids[0]); c1=centroidOf(ids[1]);
    }
    function medoid(indices, centroid){ let best=indices[0], bestD=Infinity; for(const i of indices){ const d=distance(feats[i],centroid); if(d<bestD){ bestD=d; best=i; } } return best; }
    const clusters=[
      {ids:ids[0], centroid:c0, medoid:medoid(ids[0],c0), path:paths[medoid(ids[0],c0)]},
      {ids:ids[1], centroid:c1, medoid:medoid(ids[1],c1), path:paths[medoid(ids[1],c1)]}
    ].sort((a,b)=>b.ids.length-a.ids.length);
    for(const c of clusters){
      const members=c.ids.map(i=>paths[i]);
      c.low=Array.from({length:paths[0].length},(_,t)=>quantile(members.map(p=>p[t]),.10));
      c.high=Array.from({length:paths[0].length},(_,t)=>quantile(members.map(p=>p[t]),.90));
      c.prob=c.ids.length/paths.length;
    }
    return clusters;
  }

  function summarizeClusterDriver(cluster, simMeta){
    const flows={};
    const regimes={};
    for(const id of cluster.ids||[]){
      const meta=simMeta?.[id];
      if(!meta) continue;
      for(const [name,v] of Object.entries(meta.flows||{})) flows[name]=(flows[name]||0)+v;
      for(const [name,v] of Object.entries(meta.regimes||{})) regimes[name]=(regimes[name]||0)+v;
    }
    const entries=Object.entries(flows).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    const top=entries[0] || null;
    const topReg=Object.entries(regimes).sort((a,b)=>b[1]-a[1])[0] || null;
    if(!top) return {text:'нет явного источника потока', participant:null, side:null, regime:null};
    const side=top[1]>=0?'BUY':'SELL';
    const participant=PARTICIPANT_LABELS[top[0]]||top[0];
    const regime=topReg ? (BEHAVIOR_REGIMES[topReg[0]]?.label||topReg[0]) : null;
    return {
      participant:top[0],
      side,
      regime:topReg?.[0]||null,
      text:`${participant} · ${side}${regime?` · ${regime}`:''}`
    };
  }

  function pathToCandles(path, desiredCount, wickBoost=1){
    if(!path || path.length<2) return [];
    const count=clamp(Math.round(desiredCount || path.length/4), 12, 80);
    const source=smooth(path,1);
    const globalMoves=source.slice(1).map((v,i)=>v-source[i]);
    const globalVol=std(globalMoves) || 0.0025;
    const candles=[];
    for(let i=0;i<count;i++){
      const a=Math.floor(i/count*(source.length-1));
      const b=Math.max(a+1, Math.floor((i+1)/count*(source.length-1)));
      const segment=source.slice(a,b+1);
      if(segment.length<2) continue;
      const prevClose=candles.length ? candles[candles.length-1].c : segment[0];
      const o=prevClose, c=segment[segment.length-1], rawHigh=Math.max(...segment,o,c), rawLow=Math.min(...segment,o,c);
      const localMoves=segment.slice(1).map((v,j)=>v-segment[j]);
      const localVol=std(localMoves) || globalVol;
      const body=Math.abs(c-o), noise=0.55 + 0.45*Math.abs(Math.sin(i*1.71 + 0.38));
      const wick=Math.max(0.0025, (body*0.40 + localVol*1.35 + globalVol*0.50) * wickBoost * noise);
      candles.push({o,h:Math.max(rawHigh,Math.max(o,c)+wick),l:Math.min(rawLow,Math.min(o,c)-wick),c});
    }
    return candles;
  }

  function describeScenario(path){
    const end=path[path.length-1]-1;
    const max=Math.max(...path)-1;
    const min=Math.min(...path)-1;
    const tMax=path.indexOf(Math.max(...path))/path.length;
    const tMin=path.indexOf(Math.min(...path))/path.length;
    const endTxt=`финал ${end>=0?"+":""}${(end*100).toFixed(1)}%`;

    if(max>.06 && min<-.06){
      return tMax<tMin
        ? `Сначала втягивание толпы в спрос, затем разгрузка и возврат ликвидности; ${endTxt}.`
        : `Сначала продавливание цены и выбивание слабых, затем реактивный откуп; ${endTxt}.`;
    }
    if(end>.06){
      return tMin>.15 && tMin<.7
        ? `Краткий сброс предложения, после которого спрос снова перехватывает поток; ${endTxt}.`
        : `Покупательский поток удерживает инициативу и толкает цену выше; ${endTxt}.`;
    }
    if(end<-.06){
      return tMax>.15 && tMax<.7
        ? `Спрос не удерживает импульс, начинается разгрузка и смещение к продавцу; ${endTxt}.`
        : `Предложение доминирует, растёт стресс участников и давление вниз; ${endTxt}.`;
    }
    return `Потоки близки к балансу, рынок остаётся в широкой зоне неопределённости; ${endTxt}.`;
  }

  function resizeCanvas(){
    const rect=els.canvas.parentElement.getBoundingClientRect();
    const dpr=Math.min(2,window.devicePixelRatio||1);
    const cssW=Math.max(320,rect.width), cssH=Math.max(330,Math.min(620,cssW*.56));
    els.canvas.style.height=cssH+"px";
    els.canvas.width=Math.round(cssW*dpr); els.canvas.height=Math.round(cssH*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0); return {w:cssW,h:cssH};
  }

  function scaleHistoryCandles(candles, futureSpan){
    if(!candles.length) return [];
    const all=[...candles.map(c=>c.h), ...candles.map(c=>c.l)], histRange=Math.max(1e-6, Math.max(...all)-Math.min(...all));
    const amp=clamp(futureSpan*0.85, 0.18, 0.52);
    return candles.map(c=>({o:1+c.o/histRange*amp, h:1+c.h/histRange*amp, l:1+c.l/histRange*amp, c:1+c.c/histRange*amp}));
  }

  function drawCandles(candles,x0,x1,palette,yMap){
    if(!candles.length) return;
    const step=(x1-x0)/candles.length, bodyW=clamp(step*0.66,4,13);
    for(let i=0;i<candles.length;i++){
      const c=candles[i], cx=x0+step*i+step*.5, up=c.c>=c.o;
      const color=up?palette.up:palette.down, wickColor=up?(palette.wickUp||palette.up):(palette.wickDown||palette.down);
      const yo=yMap(c.o), yc=yMap(c.c), yh=yMap(c.h), yl=yMap(c.l);
      const top=Math.min(yo,yc), bottom=Math.max(yo,yc), bodyH=Math.max(2,bottom-top);
      ctx.strokeStyle=wickColor; ctx.lineWidth=1.15; ctx.beginPath(); ctx.moveTo(cx,yh); ctx.lineTo(cx,yl); ctx.stroke();
      ctx.fillStyle=color; ctx.fillRect(cx-bodyW/2, top, bodyW, bodyH);
    }
  }

  function getScenarioVisuals(){
    const clusterA=lastResult.clusters[0], clusterB=lastResult.clusters[1], active=lastResult.clusters[selectedModel], ghost=lastResult.clusters[selectedModel===0?1:0];
    const futureSpan=Math.max(Math.max(...clusterA.high)-Math.min(...clusterA.low), Math.max(...clusterB.high)-Math.min(...clusterB.low));
    const historyCandles=scaleHistoryCandles(lastResult.displayCandles, futureSpan);
    const activeCandles=pathToCandles(active.path, 26, 1.0);
    const ghostCandles=pathToCandles(ghost.path, 26, 0.9);
    return {historyCandles, activeCandles, ghostCandles, active};
  }

  function draw(){
    const {w,h}=resizeCanvas();
    ctx.clearRect(0,0,w,h); ctx.fillStyle=COLORS.bg; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle=COLORS.grid; ctx.lineWidth=1;
    for(let i=1;i<6;i++){ const y=(h/6)*i; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
    for(let i=1;i<10;i++){ const x=(w/10)*i; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
    if(!lastResult) return;
    const {historyCandles, activeCandles, ghostCandles, active}=getScenarioVisuals();
    const left=24, right=w-24, historyRatio=0.58, splitX=left+(right-left)*historyRatio;
    const lows=[...historyCandles.map(c=>c.l), ...activeCandles.map(c=>c.l)], highs=[...historyCandles.map(c=>c.h), ...activeCandles.map(c=>c.h)];
    let lo=Math.min(...lows), hi=Math.max(...highs); const pad=(hi-lo)*0.12 || 0.08; lo-=pad; hi+=pad;
    const yMap=p=>h-24-(p-lo)/(hi-lo)*(h-48);
    ctx.save(); ctx.strokeStyle=COLORS.marker; ctx.setLineDash([5,6]); ctx.beginPath(); ctx.moveTo(splitX,18); ctx.lineTo(splitX,h-18); ctx.stroke(); ctx.restore();
    drawCandles(historyCandles,left,splitX,{up:COLORS.histUp,down:COLORS.histDown,wickUp:COLORS.histUp,wickDown:COLORS.histDown},yMap);
    drawCandles(ghostCandles,splitX,right,{up:COLORS.ghostUp,down:COLORS.ghostDown,wickUp:COLORS.ghostUp,wickDown:COLORS.ghostDown},yMap);
    drawCandles(activeCandles,splitX,right,{up:COLORS.up,down:COLORS.down,wickUp:COLORS.up,wickDown:COLORS.down},yMap);
    const anchorY=activeCandles.length ? yMap(activeCandles[0].o) : yMap(1);
    ctx.fillStyle=COLORS.current; ctx.beginPath(); ctx.arc(splitX,anchorY,4,0,Math.PI*2); ctx.fill();
    ctx.fillStyle=COLORS.text; ctx.font="11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText(`HISTORY · ${lastResult.displayBase.tfLabel}`,24,18);
    ctx.fillText("PROJECTED CANDLES",splitX+12,18);
    ctx.fillText(`ACTIVE: ${selectedModel===0?'A':'B'} ${(active.prob*100).toFixed(1)}%`, right-145,18);
  }

  function updateMetrics(visual, confidence){
    const pct=x=>(x*100).toFixed(1)+"%";
    const bias=visual.pressureBias;
    els.mMomentum.textContent=bias>.10 ? `BUY ${pct(bias)}` : bias<-.10 ? `SELL ${pct(Math.abs(bias))}` : 'BALANCED';
    els.mVol.textContent=pct(clamp(visual.crowdStress,0,1));
    els.mAccel.textContent=pct(clamp(visual.liquidityFragility,0,1));
    els.mDraw.textContent=pct(clamp(visual.distributionRisk,0,1));
    els.confidence.textContent=`confidence ${(confidence*100).toFixed(0)}%`;
  }

  function setSelectedModel(index){
    selectedModel=index===1 ? 1 : 0;
    els.showModelA.classList.toggle("active",selectedModel===0); els.showModelA.classList.toggle("a",selectedModel===0);
    els.showModelB.classList.toggle("active",selectedModel===1); els.showModelB.classList.toggle("b",selectedModel===1);
    els.focusA.classList.toggle("active",selectedModel===0); els.focusA.classList.toggle("a",selectedModel===0);
    els.focusB.classList.toggle("active",selectedModel===1); els.focusB.classList.toggle("b",selectedModel===1);
    els.scenarioA.classList.toggle("active",selectedModel===0); els.scenarioB.classList.toggle("active",selectedModel===1);
    if(lastResult) draw();
  }

  async function analyze(){
    if(!files.length) return;
    els.analyzeBtn.disabled=true; els.status.textContent="распознавание"; els.empty.classList.add("hidden");
    try{
      const recog=await recognizeAll(files);
      els.recognition.textContent=`распознавание ${(recog.confidence*100).toFixed(0)}% · candles ${(recog.candleScore*100).toFixed(0)}%`;
      els.timeframeState.textContent=`TF ${recog.tfSummary || recog.displayBase.tfLabel}`;
      updateMetrics(recog.visual, recog.confidence);
      els.status.textContent="симуляция";
      await new Promise(r=>requestAnimationFrame(r));
      const simulations=Number(els.simulations.value), horizon=Number(els.horizon.value), profile=els.marketProfile.value;
      const participantStates=buildParticipantStates(profile,recog.visual,recog.regimes);
      renderParticipantMap(participantStates);
      const simResult=runSimulations(recog.visual, recog.regimes, participantStates, profile, simulations, horizon);
      const paths=simResult.paths;
      const clusters=clusterTwo(paths);
      const driverA=summarizeClusterDriver(clusters[0],simResult.simMeta);
      const driverB=summarizeClusterDriver(clusters[1],simResult.simMeta);
      const dataConfidence=clamp((recog.confidence*0.44)+(recog.candleScore*0.14),0,.59);
      lastResult={...recog, ...simResult, participantStates, paths, clusters, drivers:[driverA,driverB], confidence:dataConfidence};
      els.probA.textContent=(clusters[0].prob*100).toFixed(1)+"%";
      els.probB.textContent=(clusters[1].prob*100).toFixed(1)+"%";
      els.descA.textContent=describeScenario(clusters[0].path);
      els.descB.textContent=describeScenario(clusters[1].path);
      if(els.driverA) els.driverA.textContent=`Источник следующей волны: ${driverA.text}`;
      if(els.driverB) els.driverB.textContent=`Источник следующей волны: ${driverB.text}`;
      if(els.regimeRead) els.regimeRead.innerHTML=`<b>Поведенческий режим:</b> ${formatRegimeRead(recog.regimes)}`;
      if(els.participantRead) els.participantRead.innerHTML=`<b>Участники:</b> ${formatParticipantRead(simResult.flowSummary)}`;
      els.confidence.textContent=`confidence ${(dataConfidence*100).toFixed(0)}%`;
      els.status.textContent=`готово · ${simulations.toLocaleString('ru-RU')} sims`;
      setSelectedModel(0); draw();
    } catch(err){
      console.error(err);
      els.status.textContent="ошибка"; els.recognition.textContent="распознавание не удалось"; els.timeframeState.textContent="TF —";
      els.empty.classList.remove("hidden"); els.empty.textContent=err.message || "Ошибка анализа изображения.";
    } finally { els.analyzeBtn.disabled=!files.length; }
  }

  function tfSelectOptions(current){
    return TIMEFRAMES.map(tf => `<option value="${tf.id}" ${tf.id===current?'selected':''}>${tf.label}</option>`).join('');
  }

  function addFiles(list){
    const incoming=[...list].filter(f=>f.type.startsWith('image/'));
    for(const file of incoming){
      if(files.length>=6) break;
      files.push({ id: crypto.randomUUID?.() || Math.random().toString(36).slice(2), file, tf: inferTimeframe(file.name) });
    }
    renderThumbs();
  }

  function renderThumbs(){
    els.thumbs.innerHTML="";
    for(const item of files){
      const url=URL.createObjectURL(item.file);
      const row=document.createElement('div'); row.className='thumb';
      row.innerHTML=`
        <img alt="">
        <div class="meta">
          <div class="name"></div>
          <div class="sub"></div>
          <div class="controls"><select>${tfSelectOptions(item.tf)}</select></div>
        </div>
        <button title="Удалить">×</button>`;
      row.querySelector('img').src=url;
      row.querySelector('img').onload=()=>URL.revokeObjectURL(url);
      row.querySelector('.name').textContent=item.file.name;
      row.querySelector('.sub').textContent=`${(item.file.size/1024/1024).toFixed(2)} MB`;
      row.querySelector('select').addEventListener('change',e=>{ item.tf=e.target.value; });
      row.querySelector('button').onclick=()=>{ files=files.filter(f=>f.id!==item.id); renderThumbs(); };
      els.thumbs.appendChild(row);
    }
    els.fileCount.textContent=`${files.length} файл${files.length===1?"":files.length<5?"а":"ов"}`;
    els.analyzeBtn.disabled=!files.length; els.resetBtn.disabled=!files.length && !lastResult;
  }

  function reset(){
    files=[]; lastResult=null; els.files.value=""; els.empty.classList.remove('hidden'); els.empty.textContent='Загрузите хотя бы один скриншот графика.';
    els.status.textContent='ожидание'; els.recognition.textContent='распознавание —'; els.timeframeState.textContent='TF —'; els.confidence.textContent='confidence —';
    ['mMomentum','mVol','mAccel','mDraw','probA','probB'].forEach(id=>$(id).textContent='—'); els.descA.textContent='—'; els.descB.textContent='—';
    if(els.regimeRead) els.regimeRead.innerHTML='<b>Поведенческий режим:</b> —';
    if(els.participantRead) els.participantRead.innerHTML='<b>Участники:</b> —';
    if(els.participantMap) els.participantMap.innerHTML='';
    if(els.driverA) els.driverA.textContent='Источник следующей волны: —';
    if(els.driverB) els.driverB.textContent='Источник следующей волны: —';
    setSelectedModel(0); renderThumbs(); draw();
  }

  els.files.addEventListener('change',e=>addFiles(e.target.files));
  ['dragenter','dragover'].forEach(ev=>els.dropzone.addEventListener(ev,e=>{ e.preventDefault(); els.dropzone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev=>els.dropzone.addEventListener(ev,e=>{ e.preventDefault(); els.dropzone.classList.remove('drag'); }));
  els.dropzone.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
  els.analyzeBtn.addEventListener('click',analyze); els.resetBtn.addEventListener('click',reset);
  els.simulations.addEventListener('input',()=>els.simValue.textContent=els.simulations.value);
  els.horizon.addEventListener('input',()=>els.horizonValue.textContent=els.horizon.value);
  els.showModelA.addEventListener('click',()=>setSelectedModel(0)); els.showModelB.addEventListener('click',()=>setSelectedModel(1));
  els.focusA.addEventListener('click',()=>setSelectedModel(0)); els.focusB.addEventListener('click',()=>setSelectedModel(1));
  window.addEventListener('resize',()=>requestAnimationFrame(draw));
  draw();
})();
