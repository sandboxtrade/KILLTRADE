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
    scenarioMapA: $("scenarioMapA"),
    scenarioMapB: $("scenarioMapB"),
    showModelA: $("showModelA"),
    showModelB: $("showModelB"),
    focusA: $("focusA"),
    focusB: $("focusB"),
    scenarioA: $("scenarioA"),
    scenarioB: $("scenarioB"),
    regimeRead: $("regimeRead"),
    marketStateRead: $("marketStateRead"),
    marketStateMap: $("marketStateMap"),
    driverA: $("driverA"),
    driverB: $("driverB"),
    simExplain: $("simExplain"),
    cohortRead: $("cohortRead"),
    interactionRead: $("interactionRead"),
    cascadeA: $("cascadeA"),
    cascadeB: $("cascadeB"),
    currentPrice: $("currentPrice"),
    priceModeLabel: $("priceModeLabel"),
    transitionGlobal: $("transitionGlobal"),
    transitionA: $("transitionA"),
    transitionB: $("transitionB"),
    memoryRead: $("memoryRead"),
    memoryA: $("memoryA"),
    memoryB: $("memoryB"),
    reserveRead: $("reserveRead"),
    supplyReserveValue: $("supplyReserveValue"),
    demandReserveValue: $("demandReserveValue"),
    supplyReserveBar: $("supplyReserveBar"),
    demandReserveBar: $("demandReserveBar"),
    reserveDetail: $("reserveDetail"),
    reserveA: $("reserveA"),
    reserveB: $("reserveB"),
    analysisOverlay: $("analysisOverlay"),
    analysisProgress: $("analysisProgress"),
    analysisPercent: $("analysisPercent"),
    analysisStage: $("analysisStage"),
    analysisDetail: $("analysisDetail")
  };

  const ctx = els.canvas.getContext("2d");
  let files = [];
  let lastResult = null;
  let selectedModel = 0;

  // Hard architectural split: chart continuity can never dominate the model.
  // It is used only to make the first projected candles connect naturally to history.
  const ENGINE_BEHAVIOR_WEIGHT = 0.95;
  const ENGINE_CONTINUITY_WEIGHT = 0.05;
  const INTRABAR_MICRO_STEPS = 4;

  const TIMEFRAMES = [
    { id: "auto", label: "авто", rank: 0 },
    { id: "m5", label: "5m", rank: 1 },
    { id: "m15", label: "15m", rank: 2 },
    { id: "h1", label: "1h", rank: 3 },
    { id: "h4", label: "4h", rank: 4 },
    { id: "d1", label: "1d", rank: 5 }
  ];
  const TF_META = Object.fromEntries(TIMEFRAMES.map(t => [t.id, t]));

  const MARKET_STATE_PROFILES = {
    microcap: [
      {name:"freshPositions",       capital:.28, flow:.17, fomo:.92, panic:.93, profit:.48, aggression:.60},
      {name:"lossPositions", capital:.16, flow:.24, fomo:.70, panic:.38, profit:.92, aggression:.92},
      {name:"profitablePositions",       capital:.12, flow:.09, fomo:.12, panic:.12, profit:.74, aggression:.85},
      {name:"earlyProfitPositions",     capital:.25, flow:.12, fomo:.04, panic:.03, profit:.90, aggression:.80},
      {name:"fastFlow",      capital:.07, flow:.12, fomo:.45, panic:.18, profit:.98, aggression:1.00},
      {name:"mechanicalFlow",         capital:.03, flow:.12, fomo:.15, panic:.10, profit:.58, aggression:1.00},
      {name:"liquidityBuffer",    capital:.08, flow:.13, fomo:.02, panic:.02, profit:.10, aggression:.95},
      {name:"outsideCapital",          capital:.01, flow:.01, fomo:.08, panic:.06, profit:.78, aggression:.70}
    ],
    lowcap: [
      {name:"freshPositions",       capital:.30, flow:.17, fomo:.90, panic:.90, profit:.45, aggression:.50},
      {name:"lossPositions", capital:.19, flow:.27, fomo:.65, panic:.30, profit:.95, aggression:.90},
      {name:"profitablePositions",       capital:.13, flow:.10, fomo:.15, panic:.10, profit:.70, aggression:.80},
      {name:"earlyProfitPositions",     capital:.20, flow:.09, fomo:.05, panic:.05, profit:.85, aggression:.70},
      {name:"fastFlow",      capital:.05, flow:.10, fomo:.40, panic:.20, profit:.98, aggression:1.00},
      {name:"mechanicalFlow",         capital:.04, flow:.12, fomo:.12, panic:.08, profit:.55, aggression:1.00},
      {name:"liquidityBuffer",    capital:.07, flow:.13, fomo:.02, panic:.02, profit:.08, aggression:.95},
      {name:"outsideCapital",          capital:.02, flow:.02, fomo:.08, panic:.06, profit:.75, aggression:.72}
    ],
    midcap: [
      {name:"freshPositions",       capital:.34, flow:.20, fomo:.82, panic:.78, profit:.42, aggression:.45},
      {name:"lossPositions", capital:.20, flow:.26, fomo:.60, panic:.28, profit:.90, aggression:.85},
      {name:"profitablePositions",       capital:.15, flow:.12, fomo:.12, panic:.08, profit:.68, aggression:.74},
      {name:"earlyProfitPositions",     capital:.12, flow:.07, fomo:.04, panic:.04, profit:.82, aggression:.60},
      {name:"fastFlow",      capital:.03, flow:.06, fomo:.35, panic:.16, profit:.96, aggression:.95},
      {name:"mechanicalFlow",         capital:.05, flow:.12, fomo:.10, panic:.06, profit:.52, aggression:.98},
      {name:"liquidityBuffer",    capital:.08, flow:.14, fomo:.02, panic:.02, profit:.08, aggression:.90},
      {name:"outsideCapital",          capital:.03, flow:.03, fomo:.07, panic:.05, profit:.72, aggression:.70}
    ]
  };


  const BEHAVIOR_REGIMES = {
    accumulation: {
      label: "Преобладание поглощения",
      buy: { profitablePositions:.55, outsideCapital:.48, earlyProfitPositions:.18, lossPositions:.12, liquidityBuffer:.22 },
      sell: { freshPositions:-.08, profitablePositions:-.10, outsideCapital:-.12 },
      liquidityBuffer: 1.06,
      attention: -0.02
    },
    fomo_chase: {
      label: "Реактивное усиление спроса",
      buy: { freshPositions:.78, lossPositions:.58, fastFlow:.48, mechanicalFlow:.34, outsideCapital:.10 },
      sell: { profitablePositions:.20, earlyProfitPositions:.34, outsideCapital:.16 },
      liquidityBuffer: .94,
      attention: .08
    },
    distribution: {
      label: "Фиксация прибыльных позиций",
      buy: { freshPositions:.42, lossPositions:.20, mechanicalFlow:.10 },
      sell: { earlyProfitPositions:.82, profitablePositions:.68, outsideCapital:.34, fastFlow:.20 },
      liquidityBuffer: .91,
      attention: .03
    },
    panic_exit: {
      label: "Ускорение выхода",
      buy: { liquidityBuffer:.26, outsideCapital:.12 },
      sell: { freshPositions:.92, lossPositions:.64, fastFlow:.44, profitablePositions:.30, mechanicalFlow:.28 },
      liquidityBuffer: .78,
      attention: .10
    },
    absorption: {
      label: "Поглощение предложения",
      buy: { liquidityBuffer:.72, profitablePositions:.36, outsideCapital:.42, lossPositions:.18 },
      sell: { freshPositions:.18, earlyProfitPositions:.16 },
      liquidityBuffer: 1.12,
      attention: -.03
    },
    liquidity_vacuum: {
      label: "Дефицит ликвидности",
      buy: { lossPositions:.34, fastFlow:.42, mechanicalFlow:.48 },
      sell: { lossPositions:.34, fastFlow:.42, mechanicalFlow:.48 },
      liquidityBuffer: .66,
      attention: .12
    },
    balance: {
      label: "Баланс реакций",
      buy: { liquidityBuffer:.10, outsideCapital:.06 },
      sell: { liquidityBuffer:.10, outsideCapital:.06 },
      liquidityBuffer: 1.02,
      attention: -.04
    }
  };

  const MARKET_STATE_LABELS = {
    freshPositions: "свежие позиции",
    lossPositions: "убыточные позиции",
    profitablePositions: "прибыльные позиции",
    earlyProfitPositions: "ранние прибыльные позиции",
    fastFlow: "быстрый реактивный поток",
    mechanicalFlow: "механический поток",
    liquidityBuffer: "запас ликвидности",
    outsideCapital: "свободный капитал"
  };

  const MARKET_STATE_PRIORS = {
    freshPositions:       {load:.56, pnl:.01},
    lossPositions:        {load:.66, pnl:-.12},
    profitablePositions:  {load:.68, pnl:.18},
    earlyProfitPositions: {load:.78, pnl:.46},
    fastFlow:             {load:.38, pnl:.04},
    mechanicalFlow:       {load:.34, pnl:.00},
    liquidityBuffer:      {load:.32, pnl:.00},
    outsideCapital:       {load:.18, pnl:.02}
  };

  // Когорты — не технические паттерны. Это слои капитала с разным временем входа и разной чувствительностью к прибыли/убытку.
  // Они по-разному реагируют на прибыль, убыток, истощение капитала и смену режима рынка.
  const COHORT_BEHAVIOR = {
    early: {label:'ранние входы', takeProfit:1.10, panic:.34, chase:.18, patience:.82, reentry:.28},
    core:  {label:'базовый слой', takeProfit:.72, panic:.56, chase:.42, patience:.58, reentry:.42},
    late:  {label:'поздние входы', takeProfit:.38, panic:1.08, chase:.88, patience:.26, reentry:.56}
  };



  // Взаимодействие состояний рынка. Это причинная модель того, как один поток меняет реакцию другого состояния капитала,
  // а не технический анализ графика. Коэффициенты — априорные и позже будут калиброваться на истории и внешних данных.
  const INTERACTION_RULES = [
    {source:'earlyProfitPositions', target:'lossPositions', buy:.22, sell:.62},
    {source:'earlyProfitPositions', target:'freshPositions',       buy:.16, sell:.44},
    {source:'earlyProfitPositions', target:'mechanicalFlow',         buy:.18, sell:.38},
    {source:'earlyProfitPositions', target:'fastFlow',      buy:.10, sell:.28},

    {source:'profitablePositions', target:'lossPositions',   buy:.30, sell:.42},
    {source:'profitablePositions', target:'freshPositions',         buy:.24, sell:.34},
    {source:'profitablePositions', target:'mechanicalFlow',           buy:.25, sell:.32},
    {source:'profitablePositions', target:'fastFlow',        buy:.18, sell:.30},

    {source:'lossPositions', target:'freshPositions',   buy:.36, sell:.40},
    {source:'lossPositions', target:'mechanicalFlow',     buy:.32, sell:.36},
    {source:'lossPositions', target:'fastFlow',  buy:.28, sell:.38},

    {source:'freshPositions', target:'lossPositions',   buy:.10, sell:.18},
    {source:'freshPositions', target:'mechanicalFlow',           buy:.14, sell:.20},
    // Сильный розничный спрос может становиться ликвидностью для фиксации ранних держателей.
    {source:'freshPositions', target:'earlyProfitPositions',       buy:-.22, sell:-.04},
    {source:'freshPositions', target:'profitablePositions',         buy:-.12, sell:-.03},
    {source:'lossPositions', target:'earlyProfitPositions', buy:-.18, sell:-.02},

    {source:'mechanicalFlow', target:'freshPositions',           buy:.08, sell:.12},
    {source:'mechanicalFlow', target:'lossPositions',     buy:.12, sell:.14},

    {source:'outsideCapital', target:'profitablePositions',            buy:.22, sell:.22},
    {source:'outsideCapital', target:'lossPositions',      buy:.18, sell:.20},

    // Поставщики ликвидности чаще контрят поток, но при сильном стрессе не обязаны его поглощать.
    {source:'freshPositions', target:'liquidityBuffer',      buy:-.06, sell:-.10},
    {source:'lossPositions', target:'liquidityBuffer',buy:-.08, sell:-.14}
  ];

  const STATE_REACTION_SENSITIVITY = {
    freshPositions:1.00,
    lossPositions:.88,
    profitablePositions:.48,
    earlyProfitPositions:.28,
    fastFlow:.96,
    mechanicalFlow:1.02,
    liquidityBuffer:.58,
    outsideCapital:.46
  };

  const COLORS = {
    bg: "#05070a",
    grid: "#111823",
    marker: "#2a313b",
    up: "#2ee681",
    down: "#ff5a6c",
    histUp: "#39e38b",
    histDown: "#ff5f70",
    ghostUp: "rgba(57,227,139,.24)",
    ghostDown: "rgba(255,95,112,.24)",
    text: "#8c97aa",
    current: "#f4f6fb"
  };

  function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
  function finite(x, fallback=0){ return Number.isFinite(x) ? x : fallback; }
  function finitePositive(x, fallback=1){ return Number.isFinite(x) && x>0 ? x : fallback; }
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

  function setAnalysisProgress(progress, stage, detail=''){
    const p=clamp(finite(progress,0),0,100);
    if(els.analysisProgress) els.analysisProgress.style.width=`${p.toFixed(1)}%`;
    if(els.analysisPercent) els.analysisPercent.textContent=`${Math.round(p)}%`;
    if(els.analysisStage && stage) els.analysisStage.textContent=stage;
    if(els.analysisDetail) els.analysisDetail.textContent=detail || '';
  }

  function showAnalysisOverlay(stage='Подготовка анализа'){
    if(!els.analysisOverlay) return;
    els.analysisOverlay.classList.add('visible');
    document.body.classList.add('analysis-lock');
    setAnalysisProgress(2,stage,'Подготавливаем входные данные');
  }

  function hideAnalysisOverlay(){
    if(!els.analysisOverlay) return;
    els.analysisOverlay.classList.remove('visible');
    document.body.classList.remove('analysis-lock');
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
    // Временный canvas существует только для распознавания пикселей и никогда не попадает в renderer.
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

  function extractColoredCandles(bounds){
    const {w,data,bg,x0,x1,y0,y1}=bounds;
    const classify=(x,y)=>{
      const i=(y*w+x)*4;
      const r=data[i], g=data[i+1], b=data[i+2];
      const lum=(r+g+b)/3;
      const dr=r-bg[0], dg=g-bg[1], db=b-bg[2];
      const green = g > r + 18 && g > b + 8 && dg > 26 && lum > 42;
      const red = r > g + 18 && r > b + 8 && dr > 26 && lum > 42;
      return green ? 1 : (red ? -1 : 0);
    };

    const counts=[];
    for(let x=Math.floor(x0); x<=Math.floor(x1); x++){
      let count=0;
      for(let y=y0; y<y1; y++) if(classify(x,y)!==0) count++;
      counts.push(count);
    }
    const nonZero=counts.filter(v=>v>0);
    if(nonZero.length<18) return {candles:[], confidence:0};

    const baseTh=Math.max(2, Math.floor(quantile(nonZero,.32)*0.45));
    const raw=[];
    let run=null;
    for(let i=0;i<counts.length;i++){
      if(counts[i] >= baseTh){ if(!run) run={start:i,end:i}; else run.end=i; }
      else if(run){ raw.push(run); run=null; }
    }
    if(run) raw.push(run);

    let segments=raw.filter(s => (s.end-s.start+1)>=1 && (s.end-s.start+1)<=42);
    const narrowWidths=segments.map(s=>s.end-s.start+1).filter(w=>w<=16);
    const typicalWidth=Math.max(2, narrowWidths.length ? quantile(narrowWidths,.50) : 5);
    const splitSegments=[];
    for(const s of segments){
      const width=s.end-s.start+1;
      if(width <= typicalWidth*2.80){ splitSegments.push(s); continue; }
      const n=clamp(Math.round(width/Math.max(2,typicalWidth+1)),2,2);
      for(let k=0;k<n;k++){
        const a=Math.round(s.start + k*width/n);
        const b=Math.round(s.start + (k+1)*width/n)-1;
        if(b>=a) splitSegments.push({start:a,end:b});
      }
    }
    segments=splitSegments;
    const candles=[];
    for(const s of segments){
      const startX=Math.floor(x0+s.start), endX=Math.floor(x0+s.end);
      const width=Math.max(1,endX-startX+1);
      const points=[];
      let signScore=0;
      for(let x=startX; x<=endX; x++){
        for(let y=y0; y<y1; y++){
          const side=classify(x,y);
          if(!side) continue;
          points.push({x,y,side});
          signScore += side;
        }
      }
      if(points.length<6) continue;
      const dominant=signScore>=0 ? 1 : -1;
      const own=points.filter(p=>p.side===dominant);
      if(own.length<5) continue;
      const ys=own.map(p=>p.y);
      const rowCounts={};
      for(const pt of own) rowCounts[pt.y]=(rowCounts[pt.y]||0)+1;
      let bodyRows=Object.entries(rowCounts).filter(([,count])=>count>=Math.max(2,Math.ceil(width*0.55))).map(([y])=>Number(y));
      if(bodyRows.length<2) bodyRows=Object.entries(rowCounts).filter(([,count])=>count>=Math.max(2,Math.ceil(width*0.35))).map(([y])=>Number(y));
      if(bodyRows.length<1) continue;
      const highY=Math.min(...ys), lowY=Math.max(...ys), topBody=Math.min(...bodyRows), bottomBody=Math.max(...bodyRows);
      const high=-(highY-y0)/(y1-y0);
      const low=-(lowY-y0)/(y1-y0);
      const isUp=dominant>0;
      const open=-( (isUp ? bottomBody : topBody) - y0)/(y1-y0);
      const close=-( (isUp ? topBody : bottomBody) - y0)/(y1-y0);
      candles.push({
        o:open,
        h:Math.max(high,open,close),
        l:Math.min(low,open,close),
        c:close
      });
    }

    if(candles.length<10) return {candles:[], confidence:0};
    const widths=segments.map(s=>s.end-s.start+1);
    const regularity=1-clamp(std(widths)/Math.max(1,mean(widths))*0.45,0,1);
    const confidence=clamp(0.56 + Math.min(candles.length,52)/88 + regularity*0.18,0,1);
    return {candles, confidence};
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
    const rawCand=extractCandles(bounds);
    const colorCand=extractColoredCandles(bounds);
    const cand=(colorCand.candles.length && colorCand.confidence >= rawCand.confidence*0.80) ? colorCand : rawCand;
    const tf = item.tf === 'auto' ? inferTimeframe(item.file.name) : item.tf;
    const historyCandles = cand.candles.length ? normalizeCandles(cand.candles) : [];
    const path = historyCandles.length ? normalizePath(historyCandles.map(c=>c.c)) : line.path;
    const confidence = Math.max(line.confidence*0.66, cand.confidence*0.98);
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
    const liquidityBufferFragility=clamp(crowdStress*.34 + reflexivity*.28 + (1-absorption)*.24 + (1-compression)*.14, 0, 1);
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
      liquidityBufferFragility,
      distributionRisk,
      continuityTrace
    };
  }

  function mergeStates(shortS, midS, longS){
    const s=shortS||midS||longS, m=midS||shortS||longS, l=longS||midS||shortS;
    if(!s && !m && !l) return null;
    const visual={
      momentum: clamp((s.momentum*.50)+(m.momentum*.30)+(l.momentum*.20), -1, 1),
      vol: clamp((s.vol*.50)+(m.vol*.30)+(l.vol*.20), 0, 1.5),
      accel: clamp((s.accel*.54)+(m.accel*.28)+(l.accel*.18), -1, 1),
      drawdown: clamp((s.drawdown*.42)+(m.drawdown*.33)+(l.drawdown*.25), 0, 1),
      persistence: clamp((s.persistence*.50)+(m.persistence*.30)+(l.persistence*.20), 0, 1),
      compression: clamp((s.compression*.46)+(m.compression*.31)+(l.compression*.23), 0, 1),
      pressureBias: clamp((s.pressureBias*.50)+(m.pressureBias*.30)+(l.pressureBias*.20), -1, 1),
      crowdStress: clamp((s.crowdStress*.48)+(m.crowdStress*.31)+(l.crowdStress*.21), 0, 1),
      reflexivity: clamp((s.reflexivity*.48)+(m.reflexivity*.31)+(l.reflexivity*.21), 0, 1),
      capitulationRisk: clamp((s.capitulationRisk*.42)+(m.capitulationRisk*.33)+(l.capitulationRisk*.25), 0, 1),
      absorption: clamp((s.absorption*.46)+(m.absorption*.31)+(l.absorption*.23), 0, 1),
      liquidityBufferFragility: clamp((s.liquidityBufferFragility*.44)+(m.liquidityBufferFragility*.32)+(l.liquidityBufferFragility*.24), 0, 1),
      distributionRisk: clamp((s.distributionRisk*.44)+(m.distributionRisk*.32)+(l.distributionRisk*.24), 0, 1),
      // only continuity stays mostly local because it exists solely to join the last visible candles smoothly.
      continuityTrace: clamp((s.continuityTrace*.76)+(m.continuityTrace*.16)+(l.continuityTrace*.08), -1, 1),
      localContext:s,
      higherContext:m,
      globalContext:l
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
        .26*v.liquidityBufferFragility,
      absorption:
        .20 +
        1.18*v.absorption +
        .52*v.crowdStress +
        .48*nearBalance +
        .22*v.drawdown,
      liquidity_vacuum:
        .12 +
        1.18*v.liquidityBufferFragility +
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

  function regimeSideBoost(regimeId, stateName, side){
    const regime=BEHAVIOR_REGIMES[regimeId] || BEHAVIOR_REGIMES.balance;
    const table=side==='buy' ? regime.buy : regime.sell;
    return table[stateName] || 0;
  }

  function weightedRegimeBoost(regimes, stateName, side){
    return (regimes||[]).reduce((sum,r)=>sum + r.prob*regimeSideBoost(r.id,stateName,side),0);
  }

  function regimeProbMap(regimes){
    const out={};
    for(const r of regimes||[]) out[r.id]=r.prob;
    return out;
  }

  function buildMarketStateBuckets(profileName, visual, regimes){
    const profile=MARKET_STATE_PROFILES[profileName] || MARKET_STATE_PROFILES.lowcap;
    const rp=regimeProbMap(regimes);
    const fomo=rp.fomo_chase||0, dist=rp.distribution||0, panic=rp.panic_exit||0;
    const accum=rp.accumulation||0, absorb=rp.absorption||0, vacuum=rp.liquidity_vacuum||0;

    return profile.map(p=>{
      const prior=MARKET_STATE_PRIORS[p.name] || {load:.5,pnl:0};
      const isFresh=p.name==='freshPositions', isLoss=p.name==='lossPositions', isProfitable=p.name==='profitablePositions';
      const isEarlyProfit=p.name==='earlyProfitPositions', isFast=p.name==='fastFlow', isMechanical=p.name==='mechanicalFlow';
      const isLiquidity=p.name==='liquidityBuffer', isOutside=p.name==='outsideCapital';

      let load=prior.load;
      load += fomo*((isFresh?.18:0)+(isLoss?.14:0)+(isFast?.10:0));
      load += dist*((isEarlyProfit?.14:0)+(isProfitable?.10:0)+(isOutside?.05:0));
      load += accum*((isProfitable?.08:0)+(isOutside?.07:0)+(isEarlyProfit?.03:0));
      load += panic*((isFresh?.06:0)+(isLoss?.04:0));
      load -= absorb*((isFresh?.05:0)+(isFast?.04:0));
      load=clamp(load,.12,.92);

      let pnl=prior.pnl;
      pnl += fomo*((isEarlyProfit?.26:0)+(isProfitable?.17:0)+(isOutside?.12:0)+(isFresh?.03:0));
      pnl += dist*((isEarlyProfit?.34:0)+(isProfitable?.22:0)+(isOutside?.14:0)+(isFresh?.02:0));
      pnl += accum*((isProfitable?.08:0)+(isOutside?.07:0)+(isEarlyProfit?.06:0));
      pnl -= panic*((isFresh?.24:0)+(isLoss?.17:0)+(isFast?.10:0)+(isMechanical?.05:0));
      pnl -= vacuum*((isFresh?.08:0)+(isLoss?.06:0));
      pnl += visual.pressureBias*((isFresh?.04:0)+(isLoss?.05:0)+(isProfitable?.03:0));
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
        label:MARKET_STATE_LABELS[p.name]||p.name,
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

  function renderMarketStateMap(states){
    if(!els.marketStateMap) return;
    if(!states?.length){ els.marketStateMap.innerHTML=''; return; }
    els.marketStateMap.innerHTML=states.map(s=>{
      const waveClass=s.waveSide==='BUY'?'buy':'sell';
      return `<div class="p-row">
        <div class="p-name">${s.label}</div>
        <div class="p-cell p-capital"><small>капитал</small>${(s.capitalShare*100).toFixed(0)}%</div>
        <div class="p-cell"><small>загрузка</small>${(s.positionLoad*100).toFixed(0)}%</div>
        <div class="p-cell"><small>результат</small>${formatSignedPct(s.pnl)}</div>
        <div class="p-cell p-wave ${waveClass}"><small>след. волна</small>${s.waveSide==='BUY'?'ПОКУПКА':'ПРОДАЖА'} ${(s.wavePotential*100).toFixed(1)}</div>
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

  function formatMarketStateRead(flowSummary){
    const entries=Object.entries(flowSummary||{});
    if(!entries.length) return '—';
    entries.sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    const buyers=entries.filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).slice(0,2);
    const sellers=entries.filter(([,v])=>v<0).sort((a,b)=>a[1]-b[1]).slice(0,2);
    const buyText=buyers.length ? buyers.map(([k])=>MARKET_STATE_LABELS[k]||k).join(', ') : 'нет явного лидера';
    const sellText=sellers.length ? sellers.map(([k])=>MARKET_STATE_LABELS[k]||k).join(', ') : 'нет явного лидера';
    return `спрос: ${buyText}; предложение: ${sellText}`;
  }

  function explainSimulationCount(value){
    if(value <= 1500) return 'Меньше симуляций: быстрее расчёт, но вероятности грубее и сценарии шумнее.';
    if(value <= 4000) return '3 000 — хороший баланс между скоростью и стабильностью результата.';
    if(value <= 7000) return 'Больше симуляций: вероятности стабильнее, но расчёт заметно дольше.';
    return '10 000 — максимально устойчивое усреднение для этой версии, но анализ будет самым медленным.';
  }

  function updateSimulationHint(){
    if(els.simExplain) els.simExplain.textContent = explainSimulationCount(Number(els.simulations.value || 3000));
  }

  function getCurrentPrice(){
    const v=Number(els.currentPrice?.value);
    return Number.isFinite(v) && v>0 ? v : null;
  }

  function updatePriceMode(){
    const price=getCurrentPrice();
    if(els.priceModeLabel) els.priceModeLabel.textContent = price ? `реальная шкала · ${formatPrice(price)}` : 'относительная шкала';
    if(lastResult) draw();
  }

  function formatPrice(value){
    const v=Math.abs(value);
    if(v>=1000) return value.toLocaleString('ru-RU',{maximumFractionDigits:2});
    if(v>=100) return value.toFixed(2);
    if(v>=1) return value.toFixed(3).replace(/0+$/,'').replace(/\.$/,'');
    if(v>=0.01) return value.toFixed(4).replace(/0+$/,'').replace(/\.$/,'');
    return value.toPrecision(5);
  }

  function buildStateCohorts(states, regimes, visual){
    const rp=regimeProbMap(regimes);
    const defs=[
      {id:'early', label:'ранние входы', weight:.28, pnlShift:.24, loadShift:.08},
      {id:'core', label:'базовый слой', weight:.44, pnlShift:.03, loadShift:0},
      {id:'late', label:'поздние входы', weight:.28, pnlShift:-.18, loadShift:-.06}
    ];
    const out=[];
    for(const s of states||[]){
      for(const d of defs){
        let load=clamp(s.positionLoad + d.loadShift + (d.id==='late' ? (rp.fomo_chase||0)*.08 : 0) - (d.id==='early' ? (rp.distribution||0)*.03 : 0), .06, .96);
        let pnl=s.pnl + d.pnlShift;
        pnl += (d.id==='early' ? (rp.distribution||0)*.18 + (rp.fomo_chase||0)*.08 : 0);
        pnl += (d.id==='late' ? -(rp.panic_exit||0)*.18 - (rp.liquidity_vacuum||0)*.08 : 0);
        pnl += (d.id==='core' ? (visual.pressureBias*.06) : 0);
        pnl=clamp(pnl,-.65,1.95);

        const buyPressure=clamp(sigmoid(-1.08 + (1-load)*1.05 + Math.max(0,visual.pressureBias)*.58 + visual.absorption*.24 - Math.max(0,pnl)*.25),0,1);
        const sellPressure=clamp(sigmoid(-1.02 + load*.68 + Math.max(0,pnl)*1.05 + visual.distributionRisk*.42 + visual.crowdStress*.22 + (d.id==='late' && pnl<0 ? .20 : 0)),0,1);
        const side=buyPressure>=sellPressure ? 'BUY' : 'SELL';
        const potential=Math.max(buyPressure,sellPressure) * d.weight * s.capitalShare;
        out.push({
          stateId:s.name,
          stateLabel:s.label,
          cohortId:d.id,
          cohortLabel:d.label,
          weight:d.weight,
          load,
          pnl,
          buyPressure,
          sellPressure,
          side,
          potential
        });
      }
    }
    return out.sort((a,b)=>b.potential-a.potential);
  }

  function mergeStateCohorts(states, cohorts){
    const by={};
    for(const c of cohorts||[]){
      (by[c.stateId] ||= []).push(c);
    }
    return (states||[]).map(s=>{
      const arr=by[s.name] || [];
      if(!arr.length) return s;
      const w=Math.max(1e-6, arr.reduce((sum,c)=>sum+c.weight,0));
      const buy=arr.reduce((sum,c)=>sum+c.buyPressure*c.weight,0)/w;
      const sell=arr.reduce((sum,c)=>sum+c.sellPressure*c.weight,0)/w;
      const pnl=arr.reduce((sum,c)=>sum+c.pnl*c.weight,0)/w;
      const load=arr.reduce((sum,c)=>sum+c.load*c.weight,0)/w;
      const buyUrgency=clamp(s.buyUrgency*.72 + buy*.28,0,1);
      const sellUrgency=clamp(s.sellUrgency*.72 + sell*.28,0,1);
      const buyWave=s.capitalShare*(1-load)*buyUrgency;
      const sellWave=s.capitalShare*load*sellUrgency;
      return {
        ...s,
        pnl,
        positionLoad:load,
        cashRatio:1-load,
        buyUrgency,
        sellUrgency,
        waveSide: buyWave>=sellWave ? 'BUY' : 'SELL',
        wavePotential: Math.max(buyWave,sellWave),
        cohorts: arr
      };
    }).sort((a,b)=>b.wavePotential-a.wavePotential);
  }

  function formatCohortRead(cohorts){
    if(!cohorts?.length) return '—';
    const buyers=cohorts.filter(c=>c.side==='BUY').sort((a,b)=>b.potential-a.potential);
    const sellers=cohorts.filter(c=>c.side==='SELL').sort((a,b)=>b.potential-a.potential);
    const trapped=[...cohorts].sort((a,b)=>(b.load*Math.max(0,-b.pnl))-(a.load*Math.max(0,-a.pnl)))[0];
    const parts=[];
    if(sellers[0]) parts.push(`${sellers[0].stateLabel}: ${sellers[0].cohortLabel} чаще даёт разгрузку`);
    if(buyers[0]) parts.push(`${buyers[0].stateLabel}: ${buyers[0].cohortLabel} чаще поддерживает спрос`);
    if(trapped && trapped.pnl < -0.03) parts.push(`наибольший риск паники у ${trapped.stateLabel}: ${trapped.cohortLabel} ${formatSignedPct(trapped.pnl)}`);
    return parts.join('; ') + '.';
  }

  async function recognizeAll(fileItems){
    const extracted=[];
    for(const item of fileItems){
      const r=await analyzeImage(item);
      if(r.path.length) extracted.push(r);
    }
    if(!extracted.length) throw new Error("Не удалось выделить график ни на одном изображении.");

    const groups = {
      m15: extracted.filter(e => e.tf === 'm15'),
      short: extracted.filter(e => e.tf === 'm5' || e.tf === 'm15'),
      mid: extracted.filter(e => e.tf === 'h1'),
      long: extracted.filter(e => e.tf === 'h4' || e.tf === 'd1')
    };
    const bestOf = arr => arr.sort((a,b)=>b.confidence-a.confidence)[0] || null;
    const m15Best=bestOf([...groups.m15]);
    const shortBest=m15Best || bestOf([...groups.short]);
    const midBest=bestOf([...groups.mid]);
    const longBest=bestOf([...groups.long]);

    const shortState=shortBest ? deriveVisualState(shortBest.path) : null;
    const midState=midBest ? deriveVisualState(midBest.path) : null;
    const longState=longBest ? deriveVisualState(longBest.path) : null;
    const visual=mergeStates(shortState, midState, longState) || deriveVisualState((m15Best || bestOf([...extracted])).path);

    const displayBase = m15Best || shortBest || midBest || longBest || extracted[0];
    let displayCandles = (displayBase.candles || []).slice(-40);
    if(!displayCandles.length){
      const displayPath = resample(displayBase.path, 48);
      displayCandles = pathToCandles(displayPath.map(v=>1+v*0.3), 44, 0.72).map(c=>( { o:c.o-1, h:c.h-1, l:c.l-1, c:c.c-1 }));
    }

    const tfSummary = [displayBase && `отрисовка:${displayBase.tfLabel}`, midBest && `контекст:${midBest.tfLabel}`, longBest && `глобально:${longBest.tfLabel}`].filter(Boolean).join(' · ');
    const confidence = mean(extracted.map(e=>e.confidence));
    const candleScore = mean(extracted.map(e=>e.candleConfidence));
    const regimes = inferBehaviorRegimes(visual);

    return { extracted, visual, regimes, confidence, candleScore, displayBase, displayCandles, tfSummary };
  }

  function createMarketMemory(){
    return {
      absorptionConfidence:0,
      absorptionFatigue:0,
      sellPersistence:0,
      buyPersistence:0,
      failedDemand:0,
      capitalDepletion:0,
      liquidityFatigue:0,
      stressMemory:0,
      consecutiveSell:0,
      consecutiveBuy:0,
      absorptionCount:0,
      failedAbsorptionCount:0,
      demandFailureCount:0,
      eventCounts:{},
      recentEvents:[]
    };
  }

  function decayMarketMemory(memory){
    memory.absorptionConfidence*=.965;
    memory.absorptionFatigue*=.978;
    memory.sellPersistence*=.958;
    memory.buyPersistence*=.958;
    memory.failedDemand*=.972;
    memory.capitalDepletion*=.985;
    memory.liquidityFatigue*=.978;
    memory.stressMemory*=.970;
  }

  function updateMarketMemory(m,before,after,stepResult,transition){
    const memory=m.memory || (m.memory=createMarketMemory());
    decayMarketMemory(memory);

    const net=stepResult.netFlow||0;
    const gross=Math.max(1e-6,stepResult.grossFlow||0);
    const ret=stepResult.ret||0;
    const imbalance=Math.abs(net)/gross;
    const event=transition?.event || 'neutral_shift';
    memory.eventCounts[event]=(memory.eventCounts[event]||0)+1;
    memory.recentEvents.push(event);
    if(memory.recentEvents.length>8) memory.recentEvents.shift();

    if(net<0){
      memory.consecutiveSell+=1;
      memory.consecutiveBuy=0;
      if(ret<-.005){
        memory.sellPersistence=clamp(memory.sellPersistence+.10+.04*Math.min(3,memory.consecutiveSell),0,1);
        memory.stressMemory=clamp(memory.stressMemory+.07,0,1);
      } else if(imbalance>.28 && Math.abs(ret)<.0038){
        memory.absorptionConfidence=clamp(memory.absorptionConfidence+.13,0,1);
        memory.absorptionCount+=1;
      }
    } else if(net>0){
      memory.consecutiveBuy+=1;
      memory.consecutiveSell=0;
      if(ret>.005){
        memory.buyPersistence=clamp(memory.buyPersistence+.10+.04*Math.min(3,memory.consecutiveBuy),0,1);
      } else if(imbalance>.28 && Math.abs(ret)<.0038){
        memory.failedDemand=clamp(memory.failedDemand+.12,0,1);
        memory.demandFailureCount+=1;
      }
    } else {
      memory.consecutiveBuy=Math.max(0,memory.consecutiveBuy-1);
      memory.consecutiveSell=Math.max(0,memory.consecutiveSell-1);
    }

    if(event==='absorption'){
      memory.absorptionConfidence=clamp(memory.absorptionConfidence+.16,0,1);
      memory.absorptionCount+=1;
    }
    if(event==='liquidity_depletion'){
      memory.liquidityFatigue=clamp(memory.liquidityFatigue+.17,0,1);
      if(memory.absorptionConfidence>.25){
        memory.absorptionFatigue=clamp(memory.absorptionFatigue+.12,0,1);
        memory.failedAbsorptionCount+=1;
      }
    }
    if(event==='loss_activation') memory.stressMemory=clamp(memory.stressMemory+.14,0,1);
    if(event==='demand_reserve_depletion'){ memory.capitalDepletion=clamp(memory.capitalDepletion+.12,0,1); memory.liquidityFatigue=clamp(memory.liquidityFatigue+.045,0,1); }
    if(event==='supply_reserve_depletion'){ memory.sellPersistence=clamp(memory.sellPersistence-.045,0,1); memory.buyPersistence=clamp(memory.buyPersistence+.035,0,1); }
    if(event==='profit_release') memory.sellPersistence=clamp(memory.sellPersistence+.10,0,1);
    if(event==='capital_activation'){
      const spent=Math.max(0,(before?.cashShare||0)-(after?.cashShare||0));
      memory.capitalDepletion=clamp(memory.capitalDepletion+.08+spent*.95,0,1);
    }

    const cashDrop=Math.max(0,(before?.cashShare||0)-(after?.cashShare||0));
    if(cashDrop>.012) memory.capitalDepletion=clamp(memory.capitalDepletion+cashDrop*.55,0,1);
    else if((after?.cashShare||0)>(before?.cashShare||0)+.012) memory.capitalDepletion=clamp(memory.capitalDepletion-.025,0,1);

    if((after?.liquidity||0)<(before?.liquidity||0)-.025){
      memory.liquidityFatigue=clamp(memory.liquidityFatigue+.06,0,1);
    }

    // Повторное успешное поглощение расходует ресурс. Поэтому память о поглощении
    // одновременно снижает страх реакции, но при истощении капитала делает следующий поток опаснее.
    if(memory.absorptionCount>=2 && memory.capitalDepletion>.28){
      memory.absorptionFatigue=clamp(memory.absorptionFatigue+.035,0,1);
    }
    if(memory.absorptionConfidence>.45 && memory.capitalDepletion<.30 && event!=='liquidity_depletion'){
      memory.stressMemory=clamp(memory.stressMemory-.018,0,1);
    }
  }

  function marketMemorySnapshot(memory){
    const m=memory||createMarketMemory();
    return {
      absorptionConfidence:clamp(m.absorptionConfidence||0,0,1),
      absorptionFatigue:clamp(m.absorptionFatigue||0,0,1),
      sellPersistence:clamp(m.sellPersistence||0,0,1),
      buyPersistence:clamp(m.buyPersistence||0,0,1),
      failedDemand:clamp(m.failedDemand||0,0,1),
      capitalDepletion:clamp(m.capitalDepletion||0,0,1),
      liquidityFatigue:clamp(m.liquidityFatigue||0,0,1),
      stressMemory:clamp(m.stressMemory||0,0,1),
      absorptionCount:m.absorptionCount||0,
      failedAbsorptionCount:m.failedAbsorptionCount||0,
      demandFailureCount:m.demandFailureCount||0,
      eventCounts:{...(m.eventCounts||{})},
      recentEvents:[...(m.recentEvents||[])]
    };
  }

  function summarizeMarketMemory(ids,simMeta){
    const rows=(ids||[]).map(id=>simMeta?.[id]?.memory).filter(Boolean);
    if(!rows.length) return {text:'нет накопленной памяти состояния',detail:'—'};
    const avg=key=>mean(rows.map(r=>Number(r[key])||0));
    const absorption=avg('absorptionConfidence');
    const fatigue=avg('absorptionFatigue');
    const sell=avg('sellPersistence');
    const buy=avg('buyPersistence');
    const failed=avg('failedDemand');
    const depletion=avg('capitalDepletion');
    const liqFatigue=avg('liquidityFatigue');
    const stress=avg('stressMemory');
    const absorptionCount=avg('absorptionCount');

    const candidates=[
      {score:fatigue*.72+depletion*.55+liqFatigue*.45, text:'повторное поглощение уже расходовало ресурс; следующий сопоставимый поток может пройти через рынок сильнее'},
      {score:sell*.72+stress*.48+liqFatigue*.38, text:'несколько переходов подряд усиливали выход; чувствительность рынка к новому предложению выросла'},
      {score:absorption*.78+(1-depletion)*.28, text:'предыдущий поток неоднократно поглощался; рынок пока сохраняет память об устойчивом поглощении'},
      {score:failed*.72+depletion*.34, text:'повторный спрос не давал сопоставимого сдвига; способность спроса продолжать движение ослабла'},
      {score:buy*.72+(1-stress)*.18, text:'последовательные переходы поддерживали спрос; положительная реакция сохраняет инерцию'},
      {score:.25, text:'память рынка пока нейтральна: прошлые переходы не создали устойчивого перекоса'}
    ].sort((a,b)=>b.score-a.score);

    return {
      text:candidates[0].text,
      detail:`поглощение ${Math.round(absorption*100)}% · истощение капитала ${Math.round(depletion*100)}% · усталость ликвидности ${Math.round(liqFatigue*100)}% · стресс памяти ${Math.round(stress*100)}% · среднее число поглощений ${absorptionCount.toFixed(1)}`,
      values:{absorption,fatigue,sell,buy,failed,depletion,liqFatigue,stress,absorptionCount}
    };
  }

  function createIntradaySequence(m, horizon){
    const reserves=m.initialReserves || pressureReserveSnapshot(m);
    const v=m.visual || {};
    // Основное направление — только медленный поведенческий bias. Оно не должно красить каждую свечу в один цвет.
    let primaryBias=clamp(reserves.balance*.52 + (v.pressureBias||0)*.30 + ((v.globalContext?.pressureBias)||0)*.18,-1,1);
    if(Math.abs(primaryBias)<.06){
      const regimeDir={accumulation:.25,fomo_chase:.55,distribution:-.48,panic_exit:-.62,absorption:.10,liquidity_vacuum:0,balance:0}[m.regime]||0;
      primaryBias=clamp(primaryBias+regimeDir*.38+gauss()*.05,-1,1);
    }
    const primaryDir=primaryBias>=0 ? 1 : -1;
    const stress=clamp((v.crowdStress||0)*.36 + (v.reflexivity||0)*.28 + (v.liquidityBufferFragility||0)*.22 + Math.abs(primaryBias)*.14,0,1);
    const receivingResource=primaryDir<0 ? reserves.demandShare : reserves.supplyShare;
    const counterProbability=clamp(.24 + stress*.28 + receivingResource*.22 + (v.absorption||0)*.16, .16, .82);
    const hasCounter=Math.random()<counterProbability;
    const counterDuration=hasCounter ? clamp(Math.round(2 + Math.random()*5),2,7) : 0;
    const balanceDuration=clamp(Math.round(3 + (v.compression||0)*4 + Math.random()*4),3,9);
    const counterStrength=clamp(.26 + stress*.25 + receivingResource*.18 + Math.random()*.16,.22,.74);
    const releaseStrength=clamp(.26 + Math.abs(primaryBias)*.30 + stress*.15 + Math.random()*.10,.24,.68);
    const balanceDamping=clamp(.40 + (v.absorption||0)*.20 + Math.random()*.14,.36,.68);
    const minimumAfterBalance=counterDuration+balanceDuration+5;
    const pauseStart=clamp(Math.round(horizon*(.48 + Math.random()*.22)), minimumAfterBalance, Math.max(minimumAfterBalance,horizon-6));
    const pauseDuration=horizon>=28 ? clamp(Math.round(2 + Math.random()*5),2,6) : 0;
    const pauseStrength=clamp(.10 + (v.absorption||0)*.16 + Math.random()*.10,.08,.30);
    return {
      primaryDir,
      primaryBias,
      hasCounter,
      counterDuration,
      balanceDuration,
      counterStrength,
      releaseStrength,
      balanceDamping,
      pauseStart,
      pauseDuration,
      pauseStrength,
      phaseOffset:Math.random()*Math.PI*2,
      microOffset:Math.random()*Math.PI*2,
      horizon
    };
  }

  function intradayPhaseState(m, step, horizon){
    const q=m.intradaySequence || createIntradaySequence(m,horizon);
    const counterEnd=q.counterDuration;
    const balanceEnd=counterEnd+q.balanceDuration;
    const pauseEnd=(q.pauseStart||0)+(q.pauseDuration||0);
    if(q.hasCounter && step<counterEnd){
      const t=(step+1)/Math.max(1,counterEnd);
      const wave=Math.sin(Math.PI*t);
      const micro=Math.sin((step+1)*2.15+q.microOffset)*.13;
      return {phase:'встречная реакция',pulse:-q.primaryDir*q.counterStrength*wave+micro,holdBoost:.05,returnScale:.80};
    }
    if(step<balanceEnd){
      const oscillation=Math.sin((step-counterEnd+1)*1.72+q.phaseOffset)*.18 + Math.sin((step+1)*2.63+q.microOffset)*.08;
      return {phase:'временный баланс',pulse:oscillation,holdBoost:.42,returnScale:q.balanceDamping};
    }
    if(q.pauseDuration && step>=q.pauseStart && step<pauseEnd){
      const local=(step-q.pauseStart+1)/Math.max(1,q.pauseDuration);
      const oscillation=Math.sin(local*Math.PI*2.25+q.phaseOffset)*q.pauseStrength;
      const mildCounter=-q.primaryDir*q.pauseStrength*.30*Math.sin(Math.PI*local);
      return {phase:'локальное удержание',pulse:oscillation+mildCounter,holdBoost:.32,returnScale:.52};
    }
    const progress=Math.max(0,step-balanceEnd+1)/Math.max(1,horizon-balanceEnd);
    const ramp=.28+.72*(1-Math.exp(-progress*2.25));
    const modulation=.70 + .30*Math.sin((step-balanceEnd)*.61+q.phaseOffset*.35);
    // Высокочастотная встречная компонента создаёт нормальные локальные откаты внутри общего bias.
    const pullback=Math.sin((step-balanceEnd)*1.19+q.phaseOffset)*.30*(1-progress*.28);
    const microWave=Math.sin((step-balanceEnd)*2.47+q.microOffset)*(.16+.08*(1-progress));
    const pulse=q.primaryDir*q.releaseStrength*ramp*modulation + pullback + microWave;
    return {phase:'реализация основного дисбаланса',pulse,holdBoost:.10,returnScale:.72+.18*progress};
  }

  function initMarket(profileName, visual, regimes, marketStateBuckets, horizon){
    const base=MARKET_STATE_PROFILES[profileName].map(p=>({...p}));
    const stateBy=Object.fromEntries((marketStateBuckets||[]).map(s=>[s.name,s]));
    const regime=sampleRegime(regimes);
    const regimeDef=BEHAVIOR_REGIMES[regime] || BEHAVIOR_REGIMES.balance;
    const attention=clamp(
      .34 + .24*visual.crowdStress + .18*visual.reflexivity + .10*Math.abs(visual.pressureBias) + .08*(1-visual.compression) + regimeDef.attention,
      .05,.98
    );
    const baseLiquidity=profileName==="microcap" ? .55 : profileName==="midcap" ? 1.35 : 1.0;

    const market={
      price:1,
      attention,
      liquidityBuffer:clamp(baseLiquidity*finite(regimeDef.liquidityBuffer,1),.24,1.8),
      regime,
      reactionState:{},
      profitReleaseStress:0,
      lossReactionStress:0,
      freshDemandStress:0,
      liquidityRetreat:0,
      cascadeIntensity:0,
      maxCascadeIntensity:0,
      memory:createMarketMemory(),
      stepReturnCap:profileName==="microcap" ? .040 : profileName==="midcap" ? .018 : .030,
      startPrice:1,
      rangeBudget:clamp(
        (profileName==="microcap" ? .30 : profileName==="midcap" ? .14 : .22) *
        Math.sqrt(Math.max(16,horizon||48)/48) *
        (.82 + clamp((visual.crowdStress||0)*.32 + (visual.reflexivity||0)*.24 + (visual.liquidityBufferFragility||0)*.18,0,.55)),
        profileName==="microcap" ? .18 : profileName==="midcap" ? .09 : .13,
        profileName==="microcap" ? .42 : profileName==="midcap" ? .22 : .32
      ),
      states:base.map(p=>{
        const st=stateBy[p.name] || {positionLoad:.5,pnl:0,buyUrgency:.5,sellUrgency:.5,cohorts:[]};
        const sourceCohorts=st.cohorts?.length ? st.cohorts : [
          {cohortId:'early',weight:.28,load:clamp(st.positionLoad+.08,.06,.96),pnl:st.pnl+.24,buyPressure:st.buyUrgency,sellPressure:st.sellUrgency},
          {cohortId:'core',weight:.44,load:st.positionLoad,pnl:st.pnl+.03,buyPressure:st.buyUrgency,sellPressure:st.sellUrgency},
          {cohortId:'late',weight:.28,load:clamp(st.positionLoad-.06,.06,.96),pnl:st.pnl-.18,buyPressure:st.buyUrgency,sellPressure:st.sellUrgency}
        ];

        const cohorts=sourceCohorts.map(c=>{
          const cfg=COHORT_BEHAVIOR[c.cohortId] || COHORT_BEHAVIOR.core;
          const weight=clamp(c.weight||.33,.05,.90);
          const load=clamp((c.load ?? st.positionLoad) + gauss()*.025,.04,.97);
          const pnl=clamp((c.pnl ?? st.pnl) + gauss()*.025,-.70,2.2);
          const sliceCapital=Math.max(.002,p.capital*weight);
          const inventory=clamp(sliceCapital*load*(1.70 + Math.random()*.18),.001,1);
          const cash=clamp(sliceCapital*(1-load)*(1.70 + Math.random()*.18),.001,1);
          return {
            id:c.cohortId,
            label:c.cohortLabel || cfg.label,
            weight,
            cash,
            inventory,
            initialCash:cash,
            initialInventory:inventory,
            avgEntry:clamp(1/Math.max(.16,1+pnl),.16,3.2),
            age:clamp((c.cohortId==='early'?.84:c.cohortId==='late'?.18:.50)+gauss()*.04,0,1),
            buyBias:clamp(c.buyPressure ?? st.buyUrgency,0,1),
            sellBias:clamp(c.sellPressure ?? st.sellUrgency,0,1),
            realizedPnl:0,
            buyVolume:0,
            sellVolume:0,
            cfg
          };
        });

        return {
          ...p,
          cohorts,
          profitReleaseBias:p.name==="earlyProfitPositions" ? clamp(.28 + (st.pnl||0)*.22 + gauss()*.05,0,1) : 0,
          regimeSensitivity:.78 + Math.random()*.44
        };
      }),
      visual
    };
    // Базовый запас нужен только как точка отсчёта для истощения в этой симуляции.
    market.initialReserves=pressureReserveSnapshot(market);
    market.intradaySequence=createIntradaySequence(market,horizon||48);
    return market;
  }

  function cohortStateSnapshot(m){
    const out=[];
    for(const p of m.states){
      for(const c of p.cohorts){
        const pnl=(m.price-c.avgEntry)/Math.max(.05,c.avgEntry);
        const total=Math.max(1e-6,c.cash+c.inventory);
        out.push({
          stateId:p.name,
          stateLabel:MARKET_STATE_LABELS[p.name]||p.name,
          cohortId:c.id,
          cohortLabel:c.label,
          pnl,
          cashRatio:c.cash/total,
          inventoryRatio:c.inventory/total,
          realizedPnl:c.realizedPnl,
          soldFraction:clamp(1-c.inventory/Math.max(1e-6,c.initialInventory),-1,1),
          boughtFraction:clamp(1-c.cash/Math.max(1e-6,c.initialCash),-1,1),
          age:c.age
        });
      }
    }
    return out;
  }

  function pressureReserveSnapshot(m){
    let potentialSupply=0, potentialDemand=0, totalInventory=0, totalCash=0;
    const memory=m.memory || {};
    for(const state of m.states||[]){
      for(const c of state.cohorts||[]){
        const inventory=Math.max(0,c.inventory||0);
        const cash=Math.max(0,c.cash||0);
        const pnl=(m.price-c.avgEntry)/Math.max(.05,c.avgEntry);
        totalInventory+=inventory;
        totalCash+=cash;

        // Это не прогноз по фигуре. Это оценка того, какая часть уже существующего
        // запаса позиции/кэша вообще способна превратиться в следующий поток.
        const sellActivation=clamp(sigmoid(
          -1.15 +
          Math.max(0,pnl)*.95 +
          Math.max(0,-pnl)*.62 +
          (c.sellBias||0)*.72 +
          (c.age||0)*.18 +
          (m.profitReleaseStress||0)*.34 +
          (m.lossReactionStress||0)*.38 +
          (memory.sellPersistence||0)*.22 +
          (memory.stressMemory||0)*.18
        ),0,1);

        const buyActivation=clamp(sigmoid(
          -1.16 +
          (c.buyBias||0)*.74 +
          Math.max(0,-pnl)*.12 +
          (m.freshDemandStress||0)*.34 +
          (memory.absorptionConfidence||0)*(1-(memory.capitalDepletion||0))*.30 +
          (memory.buyPersistence||0)*.18 -
          (memory.failedDemand||0)*.18
        ),0,1);

        potentialSupply += inventory*sellActivation;
        potentialDemand += cash*buyActivation;
      }
    }

    const liquidityCapacity=clamp((m.liquidityBuffer||1)/1.25,.20,1.35) * clamp(1-(m.liquidityRetreat||0)*.42,.45,1);
    const effectiveDemand=potentialDemand*liquidityCapacity;
    const totalEffective=Math.max(1e-6,potentialSupply+effectiveDemand);
    const initial=m.initialReserves || null;
    const supplyExhaustion=initial ? clamp(1-potentialSupply/Math.max(1e-6,initial.supplyStock),0,1) : 0;
    const demandExhaustion=initial ? clamp(1-effectiveDemand/Math.max(1e-6,initial.demandStock),0,1) : 0;

    return {
      supplyStock:potentialSupply,
      demandStock:effectiveDemand,
      rawDemandStock:potentialDemand,
      supplyShare:clamp(potentialSupply/totalEffective,0,1),
      demandShare:clamp(effectiveDemand/totalEffective,0,1),
      balance:clamp((effectiveDemand-potentialSupply)/totalEffective,-1,1),
      supplyExhaustion,
      demandExhaustion,
      inventoryBase:totalInventory,
      cashBase:totalCash,
      liquidityCapacity
    };
  }

  function systemStateSnapshot(m){
    let inventory=0, cash=0, profitInventory=0, lossInventory=0, profitIntensity=0, lossIntensity=0;
    for(const state of m.states||[]){
      for(const c of state.cohorts||[]){
        const inv=Math.max(0,c.inventory||0);
        const available=Math.max(0,c.cash||0);
        const pnl=(m.price-c.avgEntry)/Math.max(.05,c.avgEntry);
        inventory+=inv;
        cash+=available;
        if(pnl>=0){
          profitInventory+=inv;
          profitIntensity+=inv*Math.min(1.5,pnl);
        } else {
          lossInventory+=inv;
          lossIntensity+=inv*Math.min(1.0,-pnl);
        }
      }
    }
    const totalCapital=Math.max(1e-6,inventory+cash);
    const totalInventory=Math.max(1e-6,inventory);
    const reserves=pressureReserveSnapshot(m);
    return {
      price:m.price,
      cashShare:clamp(cash/totalCapital,0,1),
      inventoryShare:clamp(inventory/totalCapital,0,1),
      profitShare:clamp(profitInventory/totalInventory,0,1),
      lossShare:clamp(lossInventory/totalInventory,0,1),
      profitIntensity:clamp(profitIntensity/totalInventory,0,1.5),
      lossIntensity:clamp(lossIntensity/totalInventory,0,1),
      liquidity:clamp((m.liquidityBuffer||0)/1.25,0,1),
      profitRelease:clamp(m.profitReleaseStress||0,0,1),
      lossStress:clamp(m.lossReactionStress||0,0,1),
      demandActivation:clamp(m.freshDemandStress||0,0,1),
      liquidityRetreat:clamp(m.liquidityRetreat||0,0,1),
      cascade:clamp(m.cascadeIntensity||0,0,1),
      attention:clamp(m.attention||0,0,1),
      supplyReserve:reserves.supplyShare,
      demandReserve:reserves.demandShare,
      reserveBalance:reserves.balance,
      supplyExhaustion:reserves.supplyExhaustion,
      demandExhaustion:reserves.demandExhaustion
    };
  }

  const TRANSITION_EVENT_LABELS = {
    profit_release:'фиксация накопленной прибыли усиливает предложение',
    loss_activation:'часть позиций переходит в состояние убытка и повышает готовность к выходу',
    capital_activation:'свободный капитал начинает поглощать предложение',
    liquidity_depletion:'способность рынка поглощать поток снижается',
    demand_reserve_depletion:'принимающий капитал истощается быстрее потенциального предложения',
    supply_reserve_depletion:'потенциальное предложение истощается быстрее принимающего капитала',
    absorption:'входящий поток поглощается без сопоставимого сдвига цены',
    inventory_rebalance:'капитал перераспределяется между позицией и свободными средствами',
    neutral_shift:'состояние постепенно смещается без одного доминирующего события'
  };

  function classifyTransitionEvent(before, after, stepResult){
    const dRelease=after.profitRelease-before.profitRelease;
    const dLoss=after.lossStress-before.lossStress;
    const dDemand=after.demandActivation-before.demandActivation;
    const dLiquidity=after.liquidity-before.liquidity;
    const dCash=after.cashShare-before.cashShare;
    const dDemandExhaust=after.demandExhaustion-before.demandExhaustion;
    const dSupplyExhaust=after.supplyExhaustion-before.supplyExhaustion;
    const net=stepResult.netFlow||0;
    const gross=Math.max(1e-6,stepResult.grossFlow||0);
    const imbalance=Math.abs(net)/gross;
    const ret=Math.abs(stepResult.ret||0);

    if(dDemandExhaust>.045 && after.demandExhaustion>.24) return 'demand_reserve_depletion';
    if(dSupplyExhaust>.045 && after.supplyExhaustion>.24) return 'supply_reserve_depletion';
    if(dLiquidity<-.045 || after.liquidityRetreat-before.liquidityRetreat>.055) return 'liquidity_depletion';
    if(dRelease>.055 && net<0) return 'profit_release';
    if(dLoss>.055 || (stepResult.ret<-.004 && after.lossIntensity>before.lossIntensity+.02)) return 'loss_activation';
    if(dDemand>.055 && net>0) return 'capital_activation';
    if(gross>.035 && imbalance>.34 && ret<.0045) return 'absorption';
    if(Math.abs(dCash)>.035) return 'inventory_rebalance';
    return 'neutral_shift';
  }

  function transitionImportance(before, after, stepResult){
    return (
      Math.abs(stepResult.ret||0)*3.0 +
      Math.abs(after.profitRelease-before.profitRelease)*1.4 +
      Math.abs(after.lossStress-before.lossStress)*1.4 +
      Math.abs(after.demandActivation-before.demandActivation)*1.1 +
      Math.abs(after.liquidity-before.liquidity)*1.5 +
      Math.abs(after.cashShare-before.cashShare)*.8 +
      Math.abs(after.demandExhaustion-before.demandExhaustion)*1.25 +
      Math.abs(after.supplyExhaustion-before.supplyExhaustion)*1.25 +
      Math.abs(after.cascade-before.cascade)*1.0
    );
  }

  function buildTransitionRecord(before, after, stepResult, step){
    const event=classifyTransitionEvent(before,after,stepResult);
    return {
      step,
      event,
      score:transitionImportance(before,after,stepResult),
      before,
      after,
      ret:stepResult.ret||0,
      netFlow:stepResult.netFlow||0,
      grossFlow:stepResult.grossFlow||0
    };
  }

  function averageSnapshots(list,key){
    const rows=list.map(x=>x?.[key]).filter(Boolean);
    if(!rows.length) return null;
    const keys=Object.keys(rows[0]);
    const out={};
    for(const k of keys){
      const vals=rows.map(r=>r[k]).filter(Number.isFinite);
      if(vals.length) out[k]=mean(vals);
    }
    return out;
  }

  function snapshotLabel(s){
    if(!s) return 'нет данных';
    const scores=[
      ['много позиций в прибыли', s.profitShare*.55 + Math.min(1,s.profitIntensity)*.45],
      ['много позиций под давлением', s.lossShare*.55 + s.lossIntensity*.45],
      ['значительная доля свободного капитала', s.cashShare],
      ['ограниченная способность поглощать поток', 1-s.liquidity],
      ['усиливается готовность к фиксации', s.profitRelease],
      ['усиливается стресс убыточных позиций', s.lossStress],
      ['свободный капитал активируется', s.demandActivation],
      ['принимающий капитал близок к истощению', s.demandExhaustion],
      ['потенциальное предложение близко к истощению', s.supplyExhaustion]
    ].sort((a,b)=>b[1]-a[1]);
    return scores[0][0];
  }

  function snapshotDetail(s){
    if(!s) return '—';
    return `в прибыли ${(s.profitShare*100).toFixed(0)}% · в убытке ${(s.lossShare*100).toFixed(0)}% · свободный капитал ${(s.cashShare*100).toFixed(0)}% · предложение ${(s.supplyReserve*100).toFixed(0)}% · принимающий капитал ${(s.demandReserve*100).toFixed(0)}%`;
  }

  function summarizeTransitions(ids,simMeta){
    const records=[];
    for(const id of ids||[]){
      const rec=simMeta?.[id]?.keyTransition;
      if(rec) records.push(rec);
    }
    if(!records.length) return {before:'нет данных',beforeDetail:'—',event:'нет выраженного события',eventDetail:'—',after:'нет данных',afterDetail:'—',text:'нет выраженного перехода'};

    const weighted={};
    for(const r of records) weighted[r.event]=(weighted[r.event]||0)+Math.max(.01,r.score);
    const dominant=Object.entries(weighted).sort((a,b)=>b[1]-a[1])[0]?.[0] || 'neutral_shift';
    const selected=records.filter(r=>r.event===dominant);
    const before=averageSnapshots(selected,'before') || averageSnapshots(records,'before');
    const after=averageSnapshots(selected,'after') || averageSnapshots(records,'after');
    const avgRet=mean(selected.map(r=>r.ret||0));
    const avgNet=mean(selected.map(r=>r.netFlow||0));
    const eventLabel=TRANSITION_EVENT_LABELS[dominant] || TRANSITION_EVENT_LABELS.neutral_shift;
    const eventDetail=`средний сдвиг цены ${(avgRet*100).toFixed(2)}% · чистый поток ${avgNet>=0?'+':''}${avgNet.toFixed(3)}`;
    const beforeLabel=snapshotLabel(before);
    const afterLabel=snapshotLabel(after);
    return {
      eventId:dominant,
      before:beforeLabel,
      beforeDetail:snapshotDetail(before),
      event:eventLabel,
      eventDetail,
      after:afterLabel,
      afterDetail:snapshotDetail(after),
      text:`${beforeLabel} → ${eventLabel} → ${afterLabel}`
    };
  }

  function renderTransitionStrip(el,t){
    if(!el) return;
    el.innerHTML=`
      <div class="transition-card"><small>До</small><b>${t.before}</b><span>${t.beforeDetail}</span></div>
      <div class="transition-arrow">→</div>
      <div class="transition-card"><small>Событие</small><b>${t.event}</b><span>${t.eventDetail}</span></div>
      <div class="transition-arrow">→</div>
      <div class="transition-card"><small>После</small><b>${t.after}</b><span>${t.afterDetail}</span></div>`;
  }

  function updateMarketInteractions(m, groupFlows){
    const entries=Object.entries(groupFlows||{});
    const total=entries.reduce((sum,[,v])=>sum+Math.abs(v),0) || 1;
    const normalized={};
    for(const [name,v] of entries) normalized[name]=v/total;

    const rawSignals={};
    const edges={};
    for(const rule of INTERACTION_RULES){
      const sourceFlow=normalized[rule.source] || 0;
      if(Math.abs(sourceFlow)<.015) continue;
      const coeff=sourceFlow>=0 ? rule.buy : rule.sell;
      const contribution=sourceFlow*coeff;
      rawSignals[rule.target]=(rawSignals[rule.target]||0)+contribution;
      const side=contribution>=0?'buy':'sell';
      const key=`${rule.source}>${rule.target}:${side}`;
      edges[key]=(edges[key]||0)+Math.abs(contribution);
    }

    for(const name of Object.keys(MARKET_STATE_LABELS)){
      const prev=m.reactionState?.[name] || 0;
      const fresh=rawSignals[name] || 0;
      m.reactionState[name]=clamp(prev*.58 + fresh*1.20,-1,1);
    }

    const neg=name=>Math.max(0,-(normalized[name]||0));
    const pos=name=>Math.max(0, normalized[name]||0);
    const informedNow=clamp(neg('earlyProfitPositions')*.85 + neg('profitablePositions')*.70 + neg('outsideCapital')*.45,0,1);
    const crowdNow=clamp(neg('lossPositions')*.68 + neg('freshPositions')*.55 + neg('fastFlow')*.22,0,1);
    const chaseNow=clamp(pos('lossPositions')*.55 + pos('freshPositions')*.48 + pos('fastFlow')*.30 + pos('mechanicalFlow')*.22,0,1);

    m.profitReleaseStress=clamp(m.profitReleaseStress*.64 + informedNow*.82,0,1);
    m.lossReactionStress=clamp(m.lossReactionStress*.60 + crowdNow*.82 + m.profitReleaseStress*.10,0,1);
    m.freshDemandStress=clamp(m.freshDemandStress*.61 + chaseNow*.82,0,1);
    m.liquidityRetreat=clamp(
      m.liquidityRetreat*.68 +
      m.profitReleaseStress*.28 +
      m.lossReactionStress*.22 +
      Math.max(0,m.cascadeIntensity-.55)*.10,
      0,1
    );

    const maxReaction=Math.max(0,...Object.values(m.reactionState).map(v=>Math.abs(v)));
    m.cascadeIntensity=clamp(
      maxReaction*.40 +
      m.profitReleaseStress*.30 +
      m.lossReactionStress*.28 +
      m.freshDemandStress*.18 +
      m.liquidityRetreat*.28,
      0,1
    );
    m.maxCascadeIntensity=Math.max(m.maxCascadeIntensity||0,m.cascadeIntensity);

    return {edges,normalized};
  }

  function buildCausalCandle(openPrice, closePrice, context){
    const o=finitePositive(openPrice,1), c=finitePositive(closePrice,o);
    const ret=Math.log(c/o);
    const dir=Math.sign(ret) || Math.sign(context.net||0) || 1;
    const imbalance=clamp(context.imbalance||0,0,1);
    const stress=clamp(context.stress||0,0,1);
    const liquidity=Math.max(.10,context.liquidity||1);
    const phase=context.phase || 'реакция';
    const flowIntensity=clamp(Math.abs(context.net||0)/liquidity,0,2);
    const absRet=Math.abs(ret);
    const balanceBoost=phase==='временный баланс' ? 1.30 : phase==='встречная реакция' ? 1.12 : 1.0;
    const baseExcursion=clamp((.00055 + absRet*.24 + imbalance*.0017 + stress*.0014 + flowIntensity*.0013)*balanceBoost,.00055,.014);
    const seed=Math.abs((o*100003+c*37013+(context.net||0)*911));
    const n1=.58+seededNoise(seed+1.7)*.78;
    const n2=.58+seededNoise(seed+3.9)*.78;
    const counterSide=baseExcursion*(.72 + (1-imbalance)*.34)*n1;
    const continuationSide=baseExcursion*(.58 + imbalance*.42)*n2;
    let high=Math.max(o,c), low=Math.min(o,c);
    if(dir>0){
      high=Math.max(high,Math.max(o,c)*Math.exp(continuationSide));
      low=Math.min(low,Math.min(o,c)*Math.exp(-counterSide));
    } else {
      high=Math.max(high,Math.max(o,c)*Math.exp(counterSide));
      low=Math.min(low,Math.min(o,c)*Math.exp(-continuationSide));
    }
    return {o,h:high,l:low,c};
  }

  function stepMarket(m, step, horizon){
    let buyFlow=0,sellFlow=0,buyConsumption=0,sellConsumption=0;
    const groupFlows={};
    const cohortFlows={};
    const v=m.visual;
    const recentRet=m.lastReturn||0;
    const crowdShock=clamp(recentRet*15,-1,1);
    const fatigue=step/horizon;
    const regimeDef=BEHAVIOR_REGIMES[m.regime] || BEHAVIOR_REGIMES.balance;
    const memory=m.memory || (m.memory=createMarketMemory());
    const phase=intradayPhaseState(m,step,horizon);
    const memoryBuySupport=clamp(memory.absorptionConfidence*(1-memory.capitalDepletion)*.70 + memory.buyPersistence*.34 - memory.failedDemand*.28, -.4, .8);
    const memorySellPressure=clamp(memory.sellPersistence*.46 + memory.stressMemory*.38 + memory.liquidityFatigue*.30 + memory.absorptionFatigue*.28, 0, 1.2);
    const reserveBefore=pressureReserveSnapshot(m);
    const reserveDemandSupport=Math.max(0,reserveBefore.balance);
    const reserveSupplyPressure=Math.max(0,-reserveBefore.balance);

    for(const p of m.states){
      const rb=regimeSideBoost(m.regime,p.name,'buy')*p.regimeSensitivity;
      const rs=regimeSideBoost(m.regime,p.name,'sell')*p.regimeSensitivity;

      if(p.name==="earlyProfitPositions"){
        const avgPnl=mean(p.cohorts.map(c=>(m.price-c.avgEntry)/Math.max(.05,c.avgEntry)));
        p.profitReleaseBias=clamp(p.profitReleaseBias*.985 + Math.max(0,avgPnl)*.020 + v.distributionRisk*.010 + gauss()*.018,0,1);
      }

      for(const c of p.cohorts){
        const cfg=c.cfg || COHORT_BEHAVIOR.core;
        const pnl=(m.price-c.avgEntry)/Math.max(.05,c.avgEntry);
        const availableCash=clamp(c.cash,0,2);
        const inventory=clamp(c.inventory,0,2);
        const initialInventory=Math.max(.001,c.initialInventory);
        const initialCash=Math.max(.001,c.initialCash);
        const inventoryRemaining=clamp(inventory/initialInventory,0,1.6);
        const cashRemaining=clamp(availableCash/initialCash,0,1.6);
        const profitPressure=Math.max(0,pnl)*cfg.takeProfit;
        const lossPain=Math.max(0,-pnl)*cfg.panic;
        const chasePressure=Math.max(0,crowdShock)*cfg.chase + Math.max(0,v.pressureBias)*cfg.chase*.55;
        const agePressure=c.age*cfg.takeProfit*.16;
        const exhaustedSeller=clamp(1-inventoryRemaining,0,1);
        const exhaustedBuyer=clamp(1-cashRemaining,0,1);
        const cohortReactionScale=c.id==='late'?1.20:(c.id==='early'?.72:1.0);
        const reaction=(m.reactionState?.[p.name]||0)*(STATE_REACTION_SENSITIVITY[p.name]||.5)*cohortReactionScale;
        const reactiveBuy=Math.max(0,reaction);
        const reactiveSell=Math.max(0,-reaction);

        // 95%: состояние капитала и вероятная реакция рынка на уже произошедшее движение.
        let buyScore=
          -0.22 +
          .54*p.fomo*m.attention +
          .42*p.aggression*Math.max(0,v.pressureBias) +
          .20*p.aggression*Math.max(0,crowdShock) +
          .28*v.absorption +
          .36*c.buyBias +
          .72*reactiveBuy +
          .46*cfg.chase*m.attention +
          .34*chasePressure +
          .24*cashRemaining +
          .14*cfg.reentry*Math.max(0,-pnl) +
          rb -
          .24*Math.max(0,pnl) -
          .28*exhaustedBuyer +
          .24*memoryBuySupport -
          .14*memory.capitalDepletion -
          .16*memory.failedDemand +
          .20*reserveDemandSupport +
          .34*Math.max(0,phase.pulse) -
          .12*reserveSupplyPressure -
          .30*reserveBefore.demandExhaustion +
          .10*reserveBefore.supplyExhaustion +
          gauss()*.30;

        let sellScore=
          -0.20 +
          .50*p.profit*profitPressure +
          .58*p.panic*v.crowdStress +
          .36*p.panic*Math.max(0,-v.pressureBias) +
          .34*p.panic*Math.max(0,-crowdShock) +
          .40*v.capitulationRisk +
          .28*v.distributionRisk +
          .38*c.sellBias +
          .76*reactiveSell +
          .56*lossPain +
          .42*profitPressure +
          agePressure +
          .12*fatigue*p.profit +
          rs -
          .34*exhaustedSeller +
          .22*memorySellPressure +
          .12*memory.failedDemand +
          .20*reserveSupplyPressure +
          .34*Math.max(0,-phase.pulse) -
          .10*reserveDemandSupport -
          .28*reserveBefore.supplyExhaustion +
          .12*reserveBefore.demandExhaustion +
          gauss()*.30;

        // Причинные реакции между состояниями капитала: фиксация прибыли, убыток, свежий спрос и доступная ликвидность.
        if(p.name==='lossPositions') sellScore += m.profitReleaseStress*.46 + m.lossReactionStress*.18;
        if(p.name==='freshPositions') sellScore += m.profitReleaseStress*.28 + m.lossReactionStress*(c.id==='late'?.52:.30);
        if(p.name==='fastFlow') sellScore += m.profitReleaseStress*.34 + m.lossReactionStress*.24;
        if(p.name==='mechanicalFlow') sellScore += m.profitReleaseStress*.30 + m.lossReactionStress*.20;
        if((p.name==='earlyProfitPositions'||p.name==='profitablePositions') && c.id==='early') sellScore += m.freshDemandStress*.34;
        if((p.name==='profitablePositions'||p.name==='outsideCapital') && v.absorption>.45) buyScore += m.lossReactionStress*.14*v.absorption;

        // Память рынка: реакция зависит от того, что уже происходило в этой симуляции.
        if(p.name==='lossPositions' || p.name==='freshPositions'){
          sellScore += memory.stressMemory*.34 + memory.sellPersistence*.28;
          buyScore -= memory.liquidityFatigue*.10;
        }
        if(p.name==='outsideCapital' || p.name==='liquidityBuffer'){
          buyScore += memory.absorptionConfidence*(1-memory.capitalDepletion)*.28;
          buyScore -= memory.capitalDepletion*.26 + memory.absorptionFatigue*.18;
        }
        if(p.name==='profitablePositions' || p.name==='earlyProfitPositions'){
          sellScore += memory.failedDemand*.24 + memory.sellPersistence*.18;
        }
        if(p.name==='fastFlow' || p.name==='mechanicalFlow'){
          buyScore += memory.buyPersistence*.20;
          sellScore += memory.sellPersistence*.20;
        }

        // Ранние входы чаще фиксируют прибыль; поздние сильнее паникуют в убытке.
        if(c.id==='early') sellScore += Math.max(0,pnl)*.38 + (m.regime==='distribution'?.30:0);
        if(c.id==='late'){
          buyScore += Math.max(0,crowdShock)*.18 + (m.regime==='fomo_chase'?.28:0);
          sellScore += Math.max(0,-pnl)*.55 + (m.regime==='panic_exit'?.32:0);
        }
        if(c.id==='core') sellScore += Math.max(0,pnl)*.10;

        if(p.name==="earlyProfitPositions") sellScore += p.profitReleaseBias*.58*(c.id==='early'?1.12:.92);
        if(p.name==="liquidityBuffer"){
          buyScore += Math.max(0,-crowdShock)*.62 + v.absorption*.26;
          sellScore += Math.max(0,crowdShock)*.62 + v.crowdStress*.10;
        }

        const holdScore=.54 + cfg.patience*.34 + (1-p.aggression)*.20 + (1-v.reflexivity)*.08 + phase.holdBoost + gauss()*.10;
        const [pb,ph]=softmax3(buyScore,holdScore,sellScore);
        const r=Math.random();
        const side=r<pb ? 1 : (r<pb+ph ? 0 : -1);

        c.age=clamp(c.age + .18/Math.max(12,horizon),0,1.35);
        // Давления тоже живые: прибыль/убыток постепенно сдвигают поведение когорты.
        c.buyBias=clamp(c.buyBias*.985 + pb*.015,0,1);
        c.sellBias=clamp(c.sellBias*.985 + (1-pb-ph)*.015,0,1);
        if(side===0) continue;

        const cohortScale=.52 + c.weight*1.15;
        const sizeBase=Math.exp(-2.55 + gauss()*.66) * (.38 + p.aggression + v.reflexivity*.10) * cohortScale;
        const key=`${p.name}:${c.id}`;

        if(side>0){
          const q=Math.min(availableCash,sizeBase*(.62+p.flow*1.95));
          if(q<=0) continue;
          buyFlow+=q;
          groupFlows[p.name]=(groupFlows[p.name]||0)+q;
          cohortFlows[key]=(cohortFlows[key]||0)+q;
          c.buyVolume+=q;
          buyConsumption+=q*.11;
          c.cash=clamp(c.cash-q*.11,0,2);
          c.inventory=clamp(c.inventory+q*.11,0,2);
          c.avgEntry=lerp(c.avgEntry,m.price,clamp(q*.10/Math.max(.01,c.inventory),0,.30));
        } else {
          const q=Math.min(inventory,sizeBase*(.62+p.flow*1.95));
          if(q<=0) continue;
          sellFlow+=q;
          groupFlows[p.name]=(groupFlows[p.name]||0)-q;
          cohortFlows[key]=(cohortFlows[key]||0)-q;
          c.sellVolume+=q;
          c.realizedPnl += q*((m.price-c.avgEntry)/Math.max(.05,c.avgEntry));
          sellConsumption+=q*.11;
          c.inventory=clamp(c.inventory-q*.11,0,2);
          c.cash=clamp(c.cash+q*.11,0,2);
        }
      }
    }

    const net=buyFlow-sellFlow, total=buyFlow+sellFlow;
    const imbalance=total>0 ? Math.abs(net)/total : 0;

    // Текущий поток меняет состояние остальных слоёв капитала и доступность ликвидности на следующих шагах.
    const interactionUpdate=updateMarketInteractions(m,groupFlows);
    const retreatMultiplier=clamp(1-m.liquidityRetreat*.46,.46,1.02);
    const memoryLiquidityMultiplier=clamp(
      1 - memory.liquidityFatigue*.34 - memory.absorptionFatigue*.22 - memory.capitalDepletion*.16 + memory.absorptionConfidence*(1-memory.capitalDepletion)*.10,
      .48,1.10
    );
    const regimeLiquidityTarget=clamp((m.regime==='liquidity_vacuum'?.62:1.0)*finite(regimeDef.liquidityBuffer,1)*retreatMultiplier*memoryLiquidityMultiplier,.20,1.8);
    const stress=clamp(
      imbalance*(.52 + Math.abs(crowdShock)) +
      v.crowdStress*.16 +
      v.liquidityBufferFragility*.14 +
      m.profitReleaseStress*.22 +
      m.lossReactionStress*.20 +
      m.cascadeIntensity*.16 +
      memory.stressMemory*.12 +
      memory.liquidityFatigue*.12,
      0,1
    );
    m.liquidityBuffer=clamp(
      m.liquidityBuffer + .022*(regimeLiquidityTarget-m.liquidityBuffer) + .014*(1-m.liquidityBuffer) - .034*stress + gauss()*.006 + v.absorption*.004,
      .20,1.8
    );

    const reserveAfter=pressureReserveSnapshot(m);
    const receivingSideExhaustion=net<0 ? reserveAfter.demandExhaustion : reserveAfter.supplyExhaustion;
    const reserveImpactMultiplier=1 + receivingSideExhaustion*.34 + Math.abs(reserveAfter.balance)*.08;
    const impactMagnitude=.0062 * Math.pow(Math.abs(net)/Math.max(.10,m.liquidityBuffer),.58) * (1 + memory.liquidityFatigue*.18 + memory.absorptionFatigue*.12) * reserveImpactMultiplier;
    const microNoise=gauss()*(.0015 + .0028*v.crowdStress + .0018*v.liquidityBufferFragility);
    const regimeDirection={accumulation:.18,fomo_chase:.62,distribution:-.50,panic_exit:-.76,absorption:.16,liquidity_vacuum:0,balance:0}[m.regime] || 0;

    const cascadeDirection=clamp(m.freshDemandStress - m.lossReactionStress - m.profitReleaseStress*.72,-1,1);
    const baseBehaviorRet=
      Math.sign(net||1)*impactMagnitude +
      microNoise +
      .0012*v.pressureBias*(.35+.65*m.attention) +
      .0010*regimeDirection*(.4+.6*m.attention) +
      .0007*Math.sign(crowdShock||1)*v.reflexivity*(1-fatigue) +
      .0011*cascadeDirection*m.cascadeIntensity +
      .0008*(memory.buyPersistence-memory.sellPersistence) -
      .0006*memory.failedDemand;
    const streak=Math.max(0,m.directionStreak||0);
    const recentSign=Math.sign(recentRet);
    const localShockScale=.00065 + .00115*clamp(v.vol||0,0,1) + .00085*stress + .00055*clamp(v.reflexivity||0,0,1);
    const phaseBias=.00215*phase.pulse;
    const meanRevert=-recentRet*(phase.phase==='временный баланс'?.24:phase.phase==='локальное удержание'?.18:.09)*clamp(1+streak*.07,1,1.65);
    const counterChance=clamp(.10 + Math.max(0,streak-2)*.055 + (phase.phase==='временный баланс'?.18:0) + (phase.phase==='локальное удержание'?.12:0) + stress*.06,.08,.46);
    const counterKick=(recentSign && Math.random()<counterChance)
      ? -recentSign*(.00035 + Math.abs(gauss())*localShockScale*.72)
      : 0;
    const localShock=gauss()*localShockScale;
    const behaviorRet=baseBehaviorRet*phase.returnScale + phaseBias + meanRevert + counterKick + localShock;


    // 5% только для визуальной непрерывности последних свечей; не создаёт сценарий сама по себе.
    const continuityFade=Math.exp(-step/Math.max(3,horizon*.10));
    const continuityRet=.034*v.continuityTrace*continuityFade;

    let ret=ENGINE_BEHAVIOR_WEIGHT*behaviorRet + ENGINE_CONTINUITY_WEIGHT*continuityRet;
    ret=clamp(finite(ret,0),-(m.stepReturnCap||.030),(m.stepReturnCap||.030));

    const previousPrice=finitePositive(m.price,1);
    const startPrice=finitePositive(m.startPrice,1);
    const budget=Math.max(.08,finite(m.rangeBudget,.22));
    const logFromStart=Math.log(previousPrice/startPrice);
    const sameDirection=Math.sign(ret)!==0 && Math.sign(ret)===Math.sign(logFromStart);
    if(sameDirection){
      const usage=clamp(Math.abs(logFromStart)/budget,0,1.2);
      ret*=clamp(1-usage*.72,.18,1);
    }
    const projected=logFromStart+ret;
    if(Math.abs(projected)>budget){
      ret=Math.sign(projected)*budget-logFromStart;
    }

    const retSign=Math.sign(ret);
    if(retSign && retSign===Math.sign(recentRet)) m.directionStreak=Math.min(12,(m.directionStreak||0)+1);
    else if(retSign) m.directionStreak=1;
    else m.directionStreak=Math.max(0,(m.directionStreak||0)-1);

    const nextPrice=previousPrice*Math.exp(ret);
    m.price=finitePositive(nextPrice,previousPrice);
    const causalCandle=buildCausalCandle(previousPrice,m.price,{
      net,total,imbalance,stress,liquidity:m.liquidityBuffer,phase:phase.phase
    });
    m.lastReturn=finite(ret,0);
    m.attention=clamp(
      m.attention + .15*Math.abs(ret) + .035*v.reflexivity + regimeDef.attention*.08 - .014*(m.attention-.45) + gauss()*.006,
      .05,.99
    );

    maybeTransitionRegime(m,ret,imbalance,step);
    return {
      price:m.price,
      ret,
      candle:causalCandle,
      groupFlows,
      cohortFlows,
      interactions:interactionUpdate.edges,
      cascadeIntensity:m.cascadeIntensity,
      liquidityRetreat:m.liquidityRetreat,
      profitReleaseStress:m.profitReleaseStress,
      lossReactionStress:m.lossReactionStress,
      freshDemandStress:m.freshDemandStress,
      netFlow:net,
      grossFlow:total,
      buyFlow,
      sellFlow,
      intradayPhase:phase.phase,
      intradayPulse:phase.pulse,
      reserves:{
        before:reserveBefore,
        after:reserveAfter,
        supplyRunway:sellConsumption>.0008 ? clamp(reserveAfter.supplyStock/sellConsumption,0,50) : null,
        demandRunway:buyConsumption>.0008 ? clamp(reserveAfter.demandStock/buyConsumption,0,50) : null
      },
      regime:m.regime
    };
  }

  async function runSimulations(visual, regimes, marketStateBuckets, profile, simulations, horizon){
    const paths=[];
    const flowSummary={};
    const cohortFlowSummary={};
    const interactionSummary={};
    const regimeOccupancy={};
    const simMeta=[];
    let invalidStepCount=0;
    const batch=100;

    for(let s=0;s<simulations;s++){
      const m=initMarket(profile,visual,regimes,marketStateBuckets,horizon);
      const path=[1];
      const localFlows={};
      const localCohortFlows={};
      const localInteractions={};
      const localRegimes={};
      const localIntradayPhases=[];
      const localCandles=[];
      let cascadeSum=0;
      let retreatSum=0;
      let informedSum=0;
      let panicSum=0;
      let chaseSum=0;
      let cascadeMax=0;
      let keyTransition=null;
      let reserveInitial=null,reserveFinal=null,reserveSupplySum=0,reserveDemandSum=0,reserveBalanceSum=0;
      let reserveSupplyExhaustMax=0,reserveDemandExhaustMax=0,supplyRunwaySum=0,demandRunwaySum=0,supplyRunwayN=0,demandRunwayN=0;

      for(let t=0;t<horizon;t++){
        regimeOccupancy[m.regime]=(regimeOccupancy[m.regime]||0)+1;
        localRegimes[m.regime]=(localRegimes[m.regime]||0)+1;
        const beforeState=systemStateSnapshot(m);
        const stepResult=stepMarket(m,t,horizon);
        localIntradayPhases.push(stepResult.intradayPhase || 'реакция');
        if(stepResult.candle && [stepResult.candle.o,stepResult.candle.h,stepResult.candle.l,stepResult.candle.c].every(Number.isFinite)) localCandles.push(stepResult.candle);
        if(!Number.isFinite(stepResult.price) || stepResult.price<=0){
          invalidStepCount++;
          const fallback=finitePositive(path[path.length-1],1);
          stepResult.price=fallback;
          stepResult.ret=0;
          m.price=fallback;
          m.lastReturn=0;
        }
        const afterState=systemStateSnapshot(m);
        const transition=buildTransitionRecord(beforeState,afterState,stepResult,t);
        updateMarketMemory(m,beforeState,afterState,stepResult,transition);
        if(!keyTransition || transition.score>keyTransition.score) keyTransition=transition;
        path.push(stepResult.price);
        for(const [name,value] of Object.entries(stepResult.groupFlows)){
          flowSummary[name]=(flowSummary[name]||0)+value;
          localFlows[name]=(localFlows[name]||0)+value;
        }
        for(const [key,value] of Object.entries(stepResult.cohortFlows||{})){
          cohortFlowSummary[key]=(cohortFlowSummary[key]||0)+value;
          localCohortFlows[key]=(localCohortFlows[key]||0)+value;
        }
        for(const [key,value] of Object.entries(stepResult.interactions||{})){
          interactionSummary[key]=(interactionSummary[key]||0)+value;
          localInteractions[key]=(localInteractions[key]||0)+value;
        }
        cascadeSum += stepResult.cascadeIntensity||0;
        retreatSum += stepResult.liquidityRetreat||0;
        informedSum += stepResult.profitReleaseStress||0;
        panicSum += stepResult.lossReactionStress||0;
        chaseSum += stepResult.freshDemandStress||0;
        cascadeMax = Math.max(cascadeMax, stepResult.cascadeIntensity||0);
        if(stepResult.reserves){
          reserveInitial ||= stepResult.reserves.before;
          reserveFinal = stepResult.reserves.after;
          reserveSupplySum += stepResult.reserves.after.supplyShare||0;
          reserveDemandSum += stepResult.reserves.after.demandShare||0;
          reserveBalanceSum += stepResult.reserves.after.balance||0;
          reserveSupplyExhaustMax=Math.max(reserveSupplyExhaustMax,stepResult.reserves.after.supplyExhaustion||0);
          reserveDemandExhaustMax=Math.max(reserveDemandExhaustMax,stepResult.reserves.after.demandExhaustion||0);
          if(Number.isFinite(stepResult.reserves.supplyRunway)){ supplyRunwaySum+=stepResult.reserves.supplyRunway; supplyRunwayN++; }
          if(Number.isFinite(stepResult.reserves.demandRunway)){ demandRunwaySum+=stepResult.reserves.demandRunway; demandRunwayN++; }
        }
      }

      paths.push(path);
      simMeta.push({
        flows:localFlows,
        cohortFlows:localCohortFlows,
        interactions:localInteractions,
        regimes:localRegimes,
        intradayPhases:localIntradayPhases,
        candles:localCandles,
        intradaySequence:{...(m.intradaySequence||{})},
        cascadeAvg:cascadeSum/Math.max(1,horizon),
        cascadeMax,
        liquidityRetreatAvg:retreatSum/Math.max(1,horizon),
        informedSellAvg:informedSum/Math.max(1,horizon),
        lossReactionStressAvg:panicSum/Math.max(1,horizon),
        chaseAvg:chaseSum/Math.max(1,horizon),
        keyTransition,
        reserve:{
          initial:reserveInitial,
          final:reserveFinal,
          supplyShareAvg:reserveSupplySum/Math.max(1,horizon),
          demandShareAvg:reserveDemandSum/Math.max(1,horizon),
          balanceAvg:reserveBalanceSum/Math.max(1,horizon),
          supplyExhaustionMax:reserveSupplyExhaustMax,
          demandExhaustionMax:reserveDemandExhaustMax,
          supplyRunwayAvg:supplyRunwayN?supplyRunwaySum/supplyRunwayN:null,
          demandRunwayAvg:demandRunwayN?demandRunwaySum/demandRunwayN:null
        },
        memory:marketMemorySnapshot(m.memory),
        finalCohorts:cohortStateSnapshot(m)
      });

      if((s+1)%batch===0 && s+1<simulations){
        const simProgress=(s+1)/simulations;
        if(els.status) els.status.textContent=`симуляция ${Math.round(simProgress*100)}%`;
        setAnalysisProgress(20+simProgress*68,'Моделирование рынка',`${(s+1).toLocaleString('ru-RU')} из ${simulations.toLocaleString('ru-RU')} симуляций`);
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
    }

    return {paths,flowSummary,cohortFlowSummary,interactionSummary,regimeOccupancy,simMeta,invalidStepCount};
  }

  function summarizePressureReserves(ids,simMeta){
    const rows=(ids||[]).map(id=>simMeta?.[id]?.reserve).filter(Boolean);
    if(!rows.length) return {supply:.5,demand:.5,text:'нет данных о запасах давления',detail:'—'};
    const avg=k=>mean(rows.map(r=>r?.[k]).filter(Number.isFinite));
    const supply=clamp(avg('supplyShareAvg'),0,1);
    const demand=clamp(avg('demandShareAvg'),0,1);
    const balance=clamp(avg('balanceAvg'),-1,1);
    const supplyEx=clamp(avg('supplyExhaustionMax'),0,1);
    const demandEx=clamp(avg('demandExhaustionMax'),0,1);
    const supplyRun=avg('supplyRunwayAvg');
    const demandRun=avg('demandRunwayAvg');

    let text='запасы давления близки к балансу';
    if(demandEx>supplyEx+.12) text='принимающий капитал истощается раньше потенциального предложения';
    else if(supplyEx>demandEx+.12) text='потенциальное предложение истощается раньше принимающего капитала';
    else if(supply>demand+.12) text='запас потенциального предложения сейчас больше принимающего капитала';
    else if(demand>supply+.12) text='принимающий капитал сейчас превосходит потенциальное предложение';

    const runway=[];
    if(Number.isFinite(supplyRun)) runway.push(`ресурс предложения ≈ ${supplyRun.toFixed(1)} шага текущего расхода`);
    if(Number.isFinite(demandRun)) runway.push(`ресурс приёма ≈ ${demandRun.toFixed(1)} шага текущего расхода`);
    return {
      supply,demand,balance,supplyEx,demandEx,supplyRun,demandRun,text,
      detail:`предложение ${(supply*100).toFixed(0)}% · принимающий капитал ${(demand*100).toFixed(0)}% · истощение предложения ${(supplyEx*100).toFixed(0)}% · истощение принимающего капитала ${(demandEx*100).toFixed(0)}%${runway.length?` · ${runway.join(' · ')}`:''}`
    };
  }

  function renderPressureReserves(summary){
    if(!summary) return;
    if(els.supplyReserveValue) els.supplyReserveValue.textContent=`${(summary.supply*100).toFixed(0)}%`;
    if(els.demandReserveValue) els.demandReserveValue.textContent=`${(summary.demand*100).toFixed(0)}%`;
    if(els.supplyReserveBar) els.supplyReserveBar.style.width=`${clamp(summary.supply,0,1)*100}%`;
    if(els.demandReserveBar) els.demandReserveBar.style.width=`${clamp(summary.demand,0,1)*100}%`;
    if(els.reserveDetail) els.reserveDetail.textContent=`${summary.text}. ${summary.detail}`;
  }

  function pathFeatures(path){
    const clean=(path||[]).map((v,i)=>finitePositive(v,i?finitePositive(path[i-1],1):1));
    const start=finitePositive(clean[0],1), end=finitePositive(clean[clean.length-1],start), max=Math.max(...clean), min=Math.min(...clean);
    const rets=clean.slice(1).map((v,i)=>Math.log(finitePositive(v,clean[i])/finitePositive(clean[i],1))).filter(Number.isFinite);
    const signature=resample(clean.map(v=>Math.log(v/start)),10);
    const maxIndex=clean.indexOf(max)/Math.max(1,clean.length-1);
    const minIndex=clean.indexOf(min)/Math.max(1,clean.length-1);
    let turns=0;
    for(let i=2;i<clean.length;i++){
      const a=Math.sign(clean[i-1]-clean[i-2]), b=Math.sign(clean[i]-clean[i-1]);
      if(a && b && a!==b) turns++;
    }
    return [
      Math.log(end/start)*1.25,
      Math.log(max/start),
      Math.log(min/start),
      std(rets)*5,
      maxIndex*.28,
      minIndex*.28,
      clamp(turns/Math.max(1,clean.length-2),0,1)*.35,
      ...signature.map(v=>v*.72)
    ].map(v=>finite(v,0));
  }
  function distance(a,b){ let s=0; for(let i=0;i<a.length;i++){ const d=a[i]-b[i]; s+=d*d; } return Math.sqrt(s); }
  function clusterTwo(paths){
    // Последний барьер: один испорченный числовой шаг не должен ломать все сценарии.
    paths=(paths||[]).map(path=>{
      let prev=1;
      return (path||[]).map(v=>{ prev=finitePositive(v,prev); return prev; });
    });
    if(!paths.length) paths=[[1,1],[1,1]];
    if(paths.length===1) paths=[paths[0], [...paths[0]]];
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

  function summarizeClusterDriver(cluster, simMeta, cohortStates){
    const flows={};
    const cohortFlows={};
    const regimes={};
    for(const id of cluster.ids||[]){
      const meta=simMeta?.[id];
      if(!meta) continue;
      for(const [name,v] of Object.entries(meta.flows||{})) flows[name]=(flows[name]||0)+v;
      for(const [key,v] of Object.entries(meta.cohortFlows||{})) cohortFlows[key]=(cohortFlows[key]||0)+v;
      for(const [name,v] of Object.entries(meta.regimes||{})) regimes[name]=(regimes[name]||0)+v;
    }

    const cohortEntries=Object.entries(cohortFlows).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    const topCohort=cohortEntries[0] || null;
    const topReg=Object.entries(regimes).sort((a,b)=>b[1]-a[1])[0] || null;

    if(topCohort){
      const [stateId,cohortId]=topCohort[0].split(':');
      const side=topCohort[1]>=0?'BUY':'SELL';
      const stateLabelText=MARKET_STATE_LABELS[stateId]||stateId;
      const cohortLabel=COHORT_BEHAVIOR[cohortId]?.label || cohortId;
      const regime=topReg ? (BEHAVIOR_REGIMES[topReg[0]]?.label||topReg[0]) : null;
      return {
        stateId:stateId,
        side,
        regime:topReg?.[0]||null,
        cohort:cohortId,
        text:`${stateLabelText} · ${cohortLabel} · ${side==='BUY'?'покупка':'продажа'}${regime?` · ${regime}`:''}`
      };
    }

    const entries=Object.entries(flows).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    const top=entries[0] || null;
    if(!top) return {text:'нет одного доминирующего механизма', stateId:null, side:null, regime:null, cohort:null};
    const side=top[1]>=0?'BUY':'SELL';
    const stateLabelText=MARKET_STATE_LABELS[top[0]]||top[0];
    const regime=topReg ? (BEHAVIOR_REGIMES[topReg[0]]?.label||topReg[0]) : null;
    return {stateId:top[0],side,regime:topReg?.[0]||null,cohort:null,text:`${stateLabelText} · ${side==='BUY'?'покупка':'продажа'}${regime?` · ${regime}`:''}`};
  }

  function parseInteractionKey(key){
    const [edge,side='sell']=String(key||'').split(':');
    const [source,target]=edge.split('>');
    return {source,target,side};
  }

  function summarizeInteractionChain(cluster, simMeta){
    const interactions={};
    let cascadeAvg=0, cascadeMax=0, retreatAvg=0, informedAvg=0, panicAvg=0, chaseAvg=0, n=0;
    for(const id of cluster?.ids||[]){
      const meta=simMeta?.[id];
      if(!meta) continue;
      n++;
      for(const [key,v] of Object.entries(meta.interactions||{})) interactions[key]=(interactions[key]||0)+v;
      cascadeAvg += meta.cascadeAvg||0;
      cascadeMax = Math.max(cascadeMax,meta.cascadeMax||0);
      retreatAvg += meta.liquidityRetreatAvg||0;
      informedAvg += meta.informedSellAvg||0;
      panicAvg += meta.lossReactionStressAvg||0;
      chaseAvg += meta.chaseAvg||0;
    }
    n=Math.max(1,n);
    cascadeAvg/=n; retreatAvg/=n; informedAvg/=n; panicAvg/=n; chaseAvg/=n;

    const ordered=Object.entries(interactions).sort((a,b)=>b[1]-a[1]);
    if(!ordered.length){
      return {text:'выраженной цепочки реакции нет',cascadeAvg,cascadeMax,retreatAvg};
    }

    const first=parseInteractionKey(ordered[0][0]);
    let chain=[first.source,first.target];
    let side=first.side;

    const next=ordered
      .map(([key,value])=>({...parseInteractionKey(key),value}))
      .find(e=>e.source===first.target && e.side===side && !chain.includes(e.target));
    if(next) chain.push(next.target);

    const third=next ? ordered
      .map(([key,value])=>({...parseInteractionKey(key),value}))
      .find(e=>e.source===next.target && e.side===side && !chain.includes(e.target)) : null;
    if(third) chain.push(third.target);

    const labels=chain.map(id=>MARKET_STATE_LABELS[id]||id);
    const action=side==='buy'?'покупка':'продажа';
    let text=`${action}: ${labels.join(' → ')}`;
    if(retreatAvg>.20) text+=' → ликвидность истончается';
    if(cascadeAvg>.42) text+=` · каскад ${(cascadeAvg*100).toFixed(0)}%`;

    const driver = informedAvg>panicAvg && informedAvg>chaseAvg
      ? 'ведёт высвобождение прибыльных позиций'
      : panicAvg>chaseAvg
        ? 'ведёт реакция убыточных и свежих позиций'
        : chaseAvg>.20
          ? 'ведёт реактивное подключение нового спроса'
          : 'каскад слабый';

    return {text,driver,cascadeAvg,cascadeMax,retreatAvg,informedAvg,panicAvg,chaseAvg};
  }

  function formatOverallInteractionRead(simMeta){
    const ids=Array.from({length:simMeta?.length||0},(_,i)=>i);
    const summary=summarizeInteractionChain({ids},simMeta||[]);
    return `${summary.text}. ${summary.driver}.`;
  }

  function formatDynamicCohortRead(simMeta){
    const flows={};
    const finals={};
    let finalCount=0;
    for(const meta of simMeta||[]){
      for(const [key,v] of Object.entries(meta.cohortFlows||{})) flows[key]=(flows[key]||0)+v;
      for(const c of meta.finalCohorts||[]){
        const key=`${c.stateId}:${c.cohortId}`;
        const acc=finals[key] ||= {pnl:0,inventoryRatio:0,cashRatio:0,soldFraction:0,n:0,stateLabel:c.stateLabel,cohortLabel:c.cohortLabel};
        acc.pnl+=c.pnl; acc.inventoryRatio+=c.inventoryRatio; acc.cashRatio+=c.cashRatio; acc.soldFraction+=c.soldFraction; acc.n++;
        finalCount++;
      }
    }
    const ordered=Object.entries(flows).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    const seller=ordered.filter(([,v])=>v<0)[0];
    const buyer=ordered.filter(([,v])=>v>0)[0];

    const avgFinal=Object.entries(finals).map(([key,a])=>({
      key,
      stateLabel:a.stateLabel,
      cohortLabel:a.cohortLabel,
      pnl:a.pnl/Math.max(1,a.n),
      inventoryRatio:a.inventoryRatio/Math.max(1,a.n),
      cashRatio:a.cashRatio/Math.max(1,a.n),
      soldFraction:a.soldFraction/Math.max(1,a.n)
    }));
    const trapped=avgFinal.sort((a,b)=>(b.inventoryRatio*Math.max(0,-b.pnl))-(a.inventoryRatio*Math.max(0,-a.pnl)))[0];

    const fmtKey=key=>{
      const [p,c]=key.split(':');
      return `${MARKET_STATE_LABELS[p]||p} · ${COHORT_BEHAVIOR[c]?.label||c}`;
    };
    const parts=[];
    if(seller) parts.push(`главную разгрузку чаще создают ${fmtKey(seller[0])}`);
    if(buyer) parts.push(`спрос чаще поддерживают ${fmtKey(buyer[0])}`);
    if(trapped && trapped.pnl<-.025) parts.push(`сильнее всего зажаты в убытке ${trapped.stateLabel} · ${trapped.cohortLabel} (${formatSignedPct(trapped.pnl)})`);
    return parts.length ? parts.join('; ')+'.' : 'выраженного лидера среди когорт нет.';
  }

  function seededNoise(seed){
    const x=Math.sin(seed*12.9898 + 78.233) * 43758.5453123;
    return x - Math.floor(x);
  }
  function signedNoise(seed){ return seededNoise(seed)*2 - 1; }

  function phaseForStep(phases, stepIndex, totalSteps){
    if(!phases?.length) return 'реакция';
    if(phases.length===totalSteps) return phases[clamp(stepIndex,0,phases.length-1)] || 'реакция';
    const idx=Math.round(stepIndex/Math.max(1,totalSteps-1) * Math.max(0,phases.length-1));
    return phases[clamp(idx,0,phases.length-1)] || 'реакция';
  }

  function intrabarCandlesFromPath(path, phases, visual, wickBoost=1){
    const clean=(path||[]).map((v,i)=>finitePositive(v,i?path[i-1]:1));
    if(clean.length<2) return [];
    const total=clean.length-1;
    const overallDir=Math.sign(clean[clean.length-1]-clean[0]) || 1;
    const volBias=(visual?.vol||0), reflex=(visual?.reflexivity||0), stress=(visual?.crowdStress||0);
    const candles=[];

    for(let i=0;i<total;i++){
      const o=finitePositive(clean[i], i?clean[i-1]:1);
      const c=finitePositive(clean[i+1], o);
      const prev=i>0 ? finitePositive(clean[i-1],o) : o;
      const next=i<total-1 ? finitePositive(clean[i+2],c) : c;
      const phase=phaseForStep(phases,i,total);
      const bodyRet=(c/o)-1;
      const dir=Math.sign(bodyRet) || Math.sign(next-prev) || overallDir;
      const absRet=Math.abs(bodyRet);
      const seed=(i+1)*17.13 + o*31.7 + c*11.9;
      const baseSwing=0.0016 + absRet*0.48 + volBias*0.0034 + reflex*0.0018;
      const chop=phase==='временный баланс' ? (0.95 + stress*0.35) : (0.38 + reflex*0.22);
      const fakeout=baseSwing * (phase==='встречная реакция' ? 1.18 : phase==='временный баланс' ? 0.92 : 0.68);
      const continuation=baseSwing * (phase==='реализация основного дисбаланса' ? 0.86 : phase==='встречная реакция' ? 0.54 : 0.42);
      const midpoint=(o+c)/2;

      let points=[o];
      if(phase==='временный баланс'){
        const sideA=signedNoise(seed)*baseSwing*chop;
        const sideB=signedNoise(seed+1.3)*baseSwing*chop*0.85;
        const sideC=signedNoise(seed+2.6)*baseSwing*chop*0.72;
        points.push(finitePositive(o*(1+sideA),o));
        points.push(finitePositive(midpoint*(1+sideB), midpoint));
        points.push(finitePositive(c*(1+sideC), c));
      } else {
        // сначала небольшой снос против закрытия, затем движение в сторону тела, затем локальная доработка
        const p1=finitePositive(o*(1-dir*fakeout*(0.75 + seededNoise(seed+0.7)*0.35)),o);
        const p2=finitePositive(midpoint*(1+dir*(absRet*0.55 + continuation)*(0.75 + seededNoise(seed+1.4)*0.35)), midpoint);
        const p3=finitePositive(c*(1-dir*continuation*(0.24 + seededNoise(seed+2.1)*0.24)), c);
        points.push(p1,p2,p3);
      }
      points.push(c);

      // микрошаги внутри 15m свечи для более живого high/low
      const expanded=[points[0]];
      for(let m=1;m<points.length;m++){
        const a=expanded[expanded.length-1], b=points[m];
        for(let k=1;k<=INTRABAR_MICRO_STEPS;k++){
          const t=k/INTRABAR_MICRO_STEPS;
          const curve=(phase==='временный баланс')
            ? (t + Math.sin(t*Math.PI)*signedNoise(seed+m+k)*0.06)
            : (t + Math.sin(t*Math.PI)*0.045*dir*signedNoise(seed+m+k));
          const value=finitePositive(a + (b-a)*curve, a);
          expanded.push(value);
        }
      }

      const localVol=std(expanded.slice(1).map((v,j)=>v-expanded[j])) || baseSwing;
      const high=Math.max(...expanded, o, c);
      const low=Math.min(...expanded, o, c);
      const wick=Math.max(0.0012, (absRet*0.22 + localVol*0.62 + baseSwing*0.26) * wickBoost);
      candles.push({
        o,
        h:Math.max(high, Math.max(o,c) + wick*(0.65 + seededNoise(seed+4.1)*0.45)),
        l:Math.min(low, Math.min(o,c) - wick*(0.65 + seededNoise(seed+5.2)*0.45)),
        c
      });
    }
    return candles;
  }

  function pathToCandles(path, desiredCount, wickBoost=1){
    if(!path || path.length<2) return [];
    const sourceRaw=path.map((v,i)=>finitePositive(v,i?finitePositive(path[i-1],1):1));
    const source=sourceRaw.map((v,i)=>finitePositive(v,i?sourceRaw[i-1]:1));
    const count=clamp(Math.round(desiredCount || Math.min(source.length-1, 48)), 12, 96);
    const globalMoves=source.slice(1).map((v,i)=>v-source[i]);
    const globalVol=std(globalMoves) || 0.0022;
    const candles=[];
    for(let i=0;i<count;i++){
      const a=Math.floor(i/count*(source.length-1));
      const b=Math.max(a+1, Math.floor((i+1)/count*(source.length-1)));
      const segment=source.slice(a,b+1);
      if(segment.length<2) continue;
      const prevClose=candles.length ? candles[candles.length-1].c : segment[0];
      const first=segment[0], last=segment[segment.length-1];
      const rawHigh=Math.max(...segment, prevClose, first, last), rawLow=Math.min(...segment, prevClose, first, last);
      const o=prevClose, c=last;
      const localMoves=segment.slice(1).map((v,j)=>v-segment[j]);
      const localVol=std(localMoves) || globalVol;
      const body=Math.abs(c-o);
      const wick=Math.max(0.0014, (body*0.26 + localVol*0.88 + globalVol*0.26) * wickBoost);
      candles.push({o,h:Math.max(rawHigh,Math.max(o,c)+wick),l:Math.min(rawLow,Math.min(o,c)-wick),c});
    }
    return candles;
  }

  function describeScenario(path){
    const clean=(path||[]).map((v,i)=>finitePositive(v,i?path[i-1]:1));
    if(clean.length<2) return '—';
    const currentPrice=getCurrentPrice();
    const rel=(v)=> currentPrice ? formatPrice(currentPrice*v) : `${v>=1?'+':''}${((v-1)*100).toFixed(1)}%`;
    const pct=(v)=> `${v>=0?'+':''}${(v*100).toFixed(1)}%`;
    const end=clean[clean.length-1]-1;
    const maxVal=Math.max(...clean), minVal=Math.min(...clean);
    const tMax=clean.indexOf(maxVal)/clean.length;
    const tMin=clean.indexOf(minVal)/clean.length;
    const endTxt=currentPrice ? `финал около ${rel(clean[clean.length-1])}` : `финал ${pct(end)}`;
    const earlyEnd=Math.max(3,Math.floor(clean.length*.30));
    const midStart=earlyEnd;
    const midEnd=Math.max(midStart+2,Math.floor(clean.length*.58));
    const early=clean.slice(0,earlyEnd);
    const middle=clean.slice(midStart,midEnd);
    const earlyMax=Math.max(...early), earlyMin=Math.min(...early);
    const midRange=middle.length ? (Math.max(...middle)-Math.min(...middle))/Math.max(1e-6,mean(middle)) : 1;
    const hasBalance=midRange < Math.max(.018,Math.abs(end)*.42);

    if(end < -0.025 && earlyMax > clean[0]*1.006){
      return hasBalance
        ? `Сценарий: вынос вверх к ${rel(earlyMax)} (${pct(earlyMax-1)}) → несколько свечей баланса → затем постепенное усиление предложения; ${endTxt}.`
        : `Перед основным снижением возможен вынос вверх к ${rel(earlyMax)} (${pct(earlyMax-1)}), после чего предложение усиливается; ${endTxt}.`;
    }
    if(end > 0.025 && earlyMin < clean[0]*0.994){
      return hasBalance
        ? `Сценарий: сброс вниз к ${rel(earlyMin)} (${pct(earlyMin-1)}) → несколько свечей баланса → затем постепенное восстановление спроса; ${endTxt}.`
        : `Перед продолжением роста возможен сброс вниз к ${rel(earlyMin)} (${pct(earlyMin-1)}), после чего спрос снова перехватывает поток; ${endTxt}.`;
    }
    if(maxVal>1.03 && minVal<0.97){
      return tMax<tMin
        ? `Сначала рынок даёт вынос вверх, затем давление смещается к продаже; ${endTxt}.`
        : `Сначала идёт продавливание вниз, затем поток частично поглощается и рынок восстанавливается; ${endTxt}.`;
    }
    if(end>.03){
      return `Спрос удерживает инициативу; внутридневная структура допускает продолжение роста к ${currentPrice ? rel(clean[clean.length-1]) : pct(end)}.`;
    }
    if(end<-.03){
      return `Предложение остаётся сильнее; внутридневная структура допускает продолжение снижения к ${currentPrice ? rel(clean[clean.length-1]) : pct(end)}.`;
    }
    return `Рынок остаётся в смешанном внутридневном состоянии; возможна пилообразная отработка без явного преимущества сторон, ${endTxt}.`;
  }

  function scenarioStageMap(path, meta){
    const clean=(path||[]).map((v,i)=>finitePositive(v,i?path[i-1]:1));
    if(clean.length<4) return [];
    const phases=phaseSegments(meta?.intradayPhases);
    const currentPrice=getCurrentPrice();
    const formatLevel=v=>currentPrice ? formatPrice(currentPrice*v) : `${v>=1?'+':''}${((v-1)*100).toFixed(1)}%`;
    const result=[];
    for(const seg of phases.slice(0,4)){
      const a=clamp(seg.start,0,clean.length-1), b=clamp(seg.end,1,clean.length-1);
      const slice=clean.slice(a,Math.max(a+1,b+1));
      const high=Math.max(...slice), low=Math.min(...slice), end=slice[slice.length-1];
      let detail='';
      if(seg.name==='встречная реакция') detail=`диапазон ${formatLevel(low)} – ${formatLevel(high)}`;
      else if(seg.name==='временный баланс') detail=`удержание около ${formatLevel(mean(slice))}`;
      else if(seg.name==='локальное удержание') detail=`локальная пауза ${formatLevel(low)} – ${formatLevel(high)}`;
      else detail=`смещение к ${formatLevel(end)}`;
      result.push({title:shortPhaseLabel(seg.name),level:formatLevel(end),detail});
    }
    while(result.length<4){
      const i=result.length, idx=Math.floor((i+1)/4*(clean.length-1));
      result.push({title:i===0?'первая реакция':i===1?'баланс':i===2?'локальная пауза':'дальнейшее движение',level:formatLevel(clean[idx]),detail:'модельная фаза'});
    }
    return result.slice(0,4);
  }

  function renderScenarioMap(el, path, meta){
    if(!el) return;
    const stages=scenarioStageMap(path,meta);
    el.innerHTML=stages.map((s,i)=>`<div class="scenario-step"><small>этап ${i+1}</small><b>${s.title}</b><span>${s.level} · ${s.detail}</span></div>`).join('');
  }

  function resizeCanvas(){
    const rect=els.canvas.parentElement.getBoundingClientRect();
    const dpr=Math.min(2,window.devicePixelRatio||1);
    const cssW=Math.max(320,rect.width), cssH=Math.max(330,Math.min(620,cssW*.56));
    els.canvas.style.height=cssH+"px";
    els.canvas.width=Math.round(cssW*dpr); els.canvas.height=Math.round(cssH*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0); return {w:cssW,h:cssH};
  }

  function anchorHistoryCandles(candles){
    const clean=(candles||[]).filter(c=>c && [c.o,c.h,c.l,c.c].every(Number.isFinite));
    if(!clean.length) return [];
    const tail=clean.slice(-40);
    const lastClose=tail[tail.length-1].c;
    const hi=Math.max(...tail.map(c=>c.h));
    const lo=Math.min(...tail.map(c=>c.l));
    const sourceRange=Math.max(1e-6,hi-lo);
    // История имеет собственный стабильный масштаб и никогда не подгоняется под будущий сценарий.
    const historySpan=clamp(.22 + clamp(lastResult?.visual?.vol||0,0,1)*.055,.22,.285);
    return tail.map(c=>({
      o:1+((c.o-lastClose)/sourceRange)*historySpan,
      h:1+((c.h-lastClose)/sourceRange)*historySpan,
      l:1+((c.l-lastClose)/sourceRange)*historySpan,
      c:1+((c.c-lastClose)/sourceRange)*historySpan
    })).map(c=>({
      o:finitePositive(c.o,1),
      h:Math.max(finitePositive(c.h,1),finitePositive(c.o,1),finitePositive(c.c,1)),
      l:Math.min(finitePositive(c.l,1),finitePositive(c.o,1),finitePositive(c.c,1)),
      c:finitePositive(c.c,1)
    }));
  }

  function stitchForecastCandles(candles, anchor=1){
    const out=[];
    let prev=finitePositive(anchor,1);
    for(const raw of candles||[]){
      if(!raw || ![raw.o,raw.h,raw.l,raw.c].every(Number.isFinite)) continue;
      const ro=finitePositive(raw.o,prev), rc=finitePositive(raw.c,ro);
      const bodyRatio=clamp(rc/ro,.86,1.16);
      const upperRatio=Math.max(1, finitePositive(raw.h,Math.max(ro,rc))/Math.max(ro,rc));
      const lowerRatio=Math.min(1, finitePositive(raw.l,Math.min(ro,rc))/Math.min(ro,rc));
      const o=prev;
      const c=finitePositive(o*bodyRatio,o);
      const h=Math.max(o,c)*upperRatio;
      const l=Math.min(o,c)*lowerRatio;
      out.push({o,h:Math.max(h,o,c),l:Math.min(l,o,c),c});
      prev=c;
    }
    return out;
  }

  function validateCandleSeries(candles,label){
    let ok=Array.isArray(candles) && candles.length>0;
    for(let i=0;i<(candles||[]).length;i++){
      const c=candles[i];
      const valid=!!c && [c.o,c.h,c.l,c.c].every(Number.isFinite) && c.h>=Math.max(c.o,c.c) && c.l<=Math.min(c.o,c.c);
      if(!valid){ ok=false; console.warn(`[chart] invalid ${label} candle`,i,c); break; }
      if(i>0 && Math.abs(c.o-candles[i-1].c)>1e-8){ ok=false; console.warn(`[chart] broken ${label} continuity`,i,c.o,candles[i-1].c); break; }
    }
    return ok;
  }

  function drawCandles(candles,startIndex,totalCount,x0,x1,palette,yMap){
    if(!candles.length || totalCount<=0) return;
    const step=(x1-x0)/totalCount;
    const gap=clamp(step*.28,.55,2.2);
    const bodyW=Math.max(.85,Math.min(step-gap,step*.70));
    const wickW=clamp(step*.18,.75,1.25);
    for(let i=0;i<candles.length;i++){
      const c=candles[i];
      if(!c || ![c.o,c.h,c.l,c.c].every(Number.isFinite)) continue;
      const cx=x0+step*(startIndex+i+.5), up=c.c>=c.o;
      const color=up?palette.up:palette.down, wickColor=up?(palette.wickUp||palette.up):(palette.wickDown||palette.down);
      const yo=yMap(c.o), yc=yMap(c.c), yh=yMap(c.h), yl=yMap(c.l);
      const top=Math.min(yo,yc), bottom=Math.max(yo,yc), bodyH=Math.max(1,bottom-top);
      ctx.strokeStyle=wickColor; ctx.lineWidth=wickW; ctx.beginPath(); ctx.moveTo(cx,yh); ctx.lineTo(cx,yl); ctx.stroke();
      ctx.fillStyle=color; ctx.fillRect(cx-bodyW/2, top, bodyW, bodyH);
    }
  }

  function getScenarioVisuals(){
    const active=lastResult.clusters[selectedModel], ghost=lastResult.clusters[selectedModel===0?1:0];
    const historyCandles=anchorHistoryCandles(lastResult.displayCandles);
    const activePath=active.path;
    const ghostPath=ghost.path;
    const activeMeta=lastResult.simMeta?.[active.medoid];
    const ghostMeta=lastResult.simMeta?.[ghost.medoid];
    const rawActive=(activeMeta?.candles?.length===activePath.length-1)
      ? activeMeta.candles
      : intrabarCandlesFromPath(activePath, activeMeta?.intradayPhases, lastResult.visual, 0.82);
    const rawGhost=(ghostMeta?.candles?.length===ghostPath.length-1)
      ? ghostMeta.candles
      : intrabarCandlesFromPath(ghostPath, ghostMeta?.intradayPhases, lastResult.visual, 0.76);
    const anchor=historyCandles.length ? historyCandles[historyCandles.length-1].c : 1;
    const activeCandles=stitchForecastCandles(rawActive,anchor);
    const ghostCandles=stitchForecastCandles(rawGhost,anchor);
    validateCandleSeries(historyCandles,'history');
    validateCandleSeries(activeCandles,'forecast');
    if(historyCandles.length && activeCandles.length && Math.abs(historyCandles[historyCandles.length-1].c-activeCandles[0].o)>1e-8){
      console.warn('[chart] history/forecast seam is not continuous');
    }
    return {historyCandles, activeCandles, ghostCandles, active, ghost, activePath, ghostPath, activeMeta, ghostMeta};
  }

  function phaseSegments(phases){
    const arr=phases||[];
    if(!arr.length) return [];
    const out=[];
    let start=0, current=arr[0];
    for(let i=1;i<=arr.length;i++){
      if(i===arr.length || arr[i]!==current){
        out.push({name:current,start,end:i});
        start=i; current=arr[i];
      }
    }
    return out;
  }

  function shortPhaseLabel(name){
    if(name==='встречная реакция') return 'встречная реакция';
    if(name==='временный баланс') return 'баланс';
    if(name==='локальное удержание') return 'локальная пауза';
    if(name==='реализация основного дисбаланса') return 'основной поток';
    return name||'реакция';
  }

  function draw(){
    const {w,h}=resizeCanvas();
    ctx.clearRect(0,0,w,h); ctx.fillStyle=COLORS.bg; ctx.fillRect(0,0,w,h);
    if(!lastResult){
      ctx.strokeStyle=COLORS.grid; ctx.lineWidth=1;
      for(let i=1;i<6;i++){ const y=(h/6)*i; ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(w,y); ctx.stroke(); }
      for(let i=1;i<10;i++){ const x=(w/10)*i; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,h); ctx.stroke(); }
      return;
    }

    const {historyCandles, activeCandles, ghostCandles, active, activeMeta}=getScenarioVisuals();
    if(!historyCandles.length || !activeCandles.length) return;

    const left=18, axisW=Math.max(64, Math.min(92, w*.11)), right=w-axisW;
    const topPad=78, bottomPad=24, plotBottom=h-bottomPad;
    const totalCount=historyCandles.length+activeCandles.length;
    const plotW=Math.max(1,right-left);
    const step=plotW/Math.max(1,totalCount);
    const splitX=left+step*historyCandles.length;

    // Одна стабильная Y-шкала для истории и обеих моделей: переключение A/B не дёргает историю.
    const scaleCandles=[...historyCandles,...activeCandles,...ghostCandles];
    let yLo=Math.min(...scaleCandles.map(c=>c.l).filter(Number.isFinite));
    let yHi=Math.max(...scaleCandles.map(c=>c.h).filter(Number.isFinite));
    if(!Number.isFinite(yLo)||!Number.isFinite(yHi)||yHi<=yLo){ yLo=.9; yHi=1.1; }
    const baseRange=Math.max(.018,yHi-yLo);
    const pad=baseRange*.085;
    yLo-=pad; yHi+=pad;
    const yMap=p=>topPad+(yHi-finite(p,1))/(yHi-yLo)*(plotBottom-topPad);
    const invY=y=>finite(yHi-(y-topPad)/(plotBottom-topPad)*(yHi-yLo),1);
    const currentValue=historyCandles[historyCandles.length-1].c;
    const currentY=clamp(yMap(currentValue),topPad,plotBottom);

    // Grid рисуется один раз на весь единый график.
    ctx.strokeStyle=COLORS.grid; ctx.lineWidth=1;
    for(let i=0;i<=5;i++){
      const y=topPad+((plotBottom-topPad)/5)*i;
      ctx.beginPath(); ctx.moveTo(left,y); ctx.lineTo(right,y); ctx.stroke();
    }
    const verticalEvery=Math.max(6,Math.round(totalCount/9));
    for(let i=verticalEvery;i<totalCount;i+=verticalEvery){
      const x=left+step*i;
      ctx.beginPath(); ctx.moveTo(x,topPad); ctx.lineTo(x,plotBottom); ctx.stroke();
    }

    // Один и тот же candle renderer, один X-step и один yMap для истории и прогноза.
    drawCandles(historyCandles,0,totalCount,left,right,{up:COLORS.histUp,down:COLORS.histDown,wickUp:COLORS.histUp,wickDown:COLORS.histDown},yMap);
    drawCandles(activeCandles,historyCandles.length,totalCount,left,right,{up:COLORS.up,down:COLORS.down,wickUp:COLORS.up,wickDown:COLORS.down},yMap);

    ctx.save();
    ctx.strokeStyle='rgba(129,140,158,.52)'; ctx.lineWidth=1; ctx.setLineDash([4,5]);
    ctx.beginPath(); ctx.moveTo(splitX,topPad-8); ctx.lineTo(splitX,plotBottom); ctx.stroke();
    ctx.restore();

    const phases=phaseSegments(activeMeta?.intradayPhases);
    if(phases.length){
      ctx.save();
      ctx.font="9px ui-monospace, SFMono-Regular, Menlo, monospace";
      ctx.textBaseline='top';
      for(const seg of phases){
        const sx=splitX+step*seg.start;
        const ex=splitX+step*seg.end;
        if(seg.start>0){
          ctx.strokeStyle='rgba(108,120,139,.22)';
          ctx.setLineDash([2,4]);
          ctx.beginPath(); ctx.moveTo(sx,topPad); ctx.lineTo(sx,plotBottom); ctx.stroke();
        }
        if(ex-sx>48){
          ctx.setLineDash([]);
          ctx.fillStyle='rgba(158,168,185,.76)';
          ctx.textAlign='center';
          ctx.fillText(shortPhaseLabel(seg.name),(sx+ex)/2,topPad-16);
        }
      }
      ctx.restore();
    }

    ctx.fillStyle=COLORS.current; ctx.beginPath(); ctx.arc(splitX,currentY,3.6,0,Math.PI*2); ctx.fill();

    const currentPrice=getCurrentPrice();
    ctx.save();
    ctx.strokeStyle='rgba(220,226,236,.34)';
    ctx.setLineDash([4,5]);
    ctx.beginPath(); ctx.moveTo(left,currentY); ctx.lineTo(right,currentY); ctx.stroke();
    ctx.restore();

    ctx.font="11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.textBaseline='middle';
    for(let i=0;i<=5;i++){
      const y=topPad+((plotBottom-topPad)/5)*i;
      const normalized=invY(y);
      const label=currentPrice
        ? formatPrice(currentPrice*normalized)
        : `${((normalized-1)*100)>=0?'+':''}${((normalized-1)*100).toFixed(1)}%`;
      ctx.strokeStyle=COLORS.marker; ctx.lineWidth=1; ctx.beginPath(); ctx.moveTo(right+4,y); ctx.lineTo(right+10,y); ctx.stroke();
      ctx.fillStyle=COLORS.text; ctx.textAlign='left'; ctx.fillText(label,right+14,y);
    }

    const currentLabel=currentPrice ? formatPrice(currentPrice) : '0.0%';
    const currentBoxW=Math.max(48,ctx.measureText(currentLabel).width+14);
    ctx.fillStyle='rgba(238,241,246,.96)';
    ctx.fillRect(right+5,currentY-11,currentBoxW,22);
    ctx.fillStyle='#090b0f';
    ctx.textAlign='center';
    ctx.fillText(currentLabel,right+5+currentBoxW/2,currentY+0.5);

    function pill(text,x,y,align='left'){
      ctx.font="11px ui-monospace, SFMono-Regular, Menlo, monospace";
      const padX=8, boxH=22, tw=ctx.measureText(text).width, boxW=tw+padX*2;
      const bx=align==='right'?x-boxW:x;
      ctx.fillStyle='rgba(8,10,14,.90)';
      ctx.strokeStyle=COLORS.marker; ctx.lineWidth=1;
      ctx.fillRect(bx,y,boxW,boxH); ctx.strokeRect(bx,y,boxW,boxH);
      ctx.fillStyle=COLORS.text; ctx.textAlign='left'; ctx.textBaseline='middle'; ctx.fillText(text,bx+padX,y+boxH/2+0.5);
    }

    pill(`ИСТОРИЯ · ${lastResult.displayBase.tfLabel} · реконструкция`,left,10,'left');
    pill('ПРОГНОЗ · 15m · выбранная модель',right-6,10,'right');
    pill(`АКТИВНАЯ МОДЕЛЬ: ${selectedModel===0?'A':'B'} · ${(active.prob*100).toFixed(1)}%`,right-6,36,'right');
  }

  function updateMetrics(visual, confidence){
    const pct=x=>(x*100).toFixed(1)+"%";
    const bias=visual.pressureBias;
    els.mMomentum.textContent=bias>.10 ? `покупатель ${pct(bias)}` : bias<-.10 ? `продавец ${pct(Math.abs(bias))}` : 'баланс';
    els.mVol.textContent=pct(clamp(visual.crowdStress,0,1));
    els.mAccel.textContent=pct(clamp(visual.liquidityBufferFragility,0,1));
    els.mDraw.textContent=pct(clamp(visual.distributionRisk,0,1));
    els.confidence.textContent=`уверенность ${(confidence*100).toFixed(0)}%`;
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
    showAnalysisOverlay('Распознавание графика');
    setAnalysisProgress(6,'Распознавание графика','Читаем загруженные изображения');
    try{
      const recog=await recognizeAll(files);
      setAnalysisProgress(18,'Подготовка состояния рынка','Собираем входное состояние и поведенческие режимы');
      els.recognition.textContent=`распознавание ${(recog.confidence*100).toFixed(0)}% · свечи ${(recog.candleScore*100).toFixed(0)}%`;
      els.timeframeState.textContent=`ТФ ${recog.tfSummary || recog.displayBase.tfLabel}`;
      updateMetrics(recog.visual, recog.confidence);
      els.status.textContent="симуляция";
      await new Promise(r=>requestAnimationFrame(r));
      const simulations=Number(els.simulations.value), horizon=Number(els.horizon.value), profile=els.marketProfile.value;
      const baseParticipantStates=buildMarketStateBuckets(profile,recog.visual,recog.regimes);
      const cohortStates=buildStateCohorts(baseParticipantStates, recog.regimes, recog.visual);
      const marketStateBuckets=mergeStateCohorts(baseParticipantStates, cohortStates);
      renderMarketStateMap(marketStateBuckets);
      setAnalysisProgress(20,'Моделирование рынка',`0 из ${simulations.toLocaleString('ru-RU')} симуляций`);
      const simResult=await runSimulations(recog.visual, recog.regimes, marketStateBuckets, profile, simulations, horizon);
      const paths=simResult.paths;
      setAnalysisProgress(91,'Сбор сценариев','Группируем симуляции в два наиболее характерных будущих состояния');
      const clusters=clusterTwo(paths);
      setAnalysisProgress(96,'Построение результата','Собираем объяснение, память рынка и свечное продолжение');
      const driverA=summarizeClusterDriver(clusters[0],simResult.simMeta,cohortStates);
      const driverB=summarizeClusterDriver(clusters[1],simResult.simMeta,cohortStates);
      const cascadeA=summarizeInteractionChain(clusters[0],simResult.simMeta);
      const cascadeB=summarizeInteractionChain(clusters[1],simResult.simMeta);
      const transitionAll=summarizeTransitions(simResult.simMeta.map((_,i)=>i),simResult.simMeta);
      const transitionA=summarizeTransitions(clusters[0].ids,simResult.simMeta);
      const transitionB=summarizeTransitions(clusters[1].ids,simResult.simMeta);
      const memoryAll=summarizeMarketMemory(simResult.simMeta.map((_,i)=>i),simResult.simMeta);
      const memoryA=summarizeMarketMemory(clusters[0].ids,simResult.simMeta);
      const memoryB=summarizeMarketMemory(clusters[1].ids,simResult.simMeta);
      const reserveAll=summarizePressureReserves(simResult.simMeta.map((_,i)=>i),simResult.simMeta);
      const reserveA=summarizePressureReserves(clusters[0].ids,simResult.simMeta);
      const reserveB=summarizePressureReserves(clusters[1].ids,simResult.simMeta);
      const dataConfidence=clamp((recog.confidence*0.44)+(recog.candleScore*0.14),0,.59);
      lastResult={...recog, ...simResult, marketStateBuckets, cohortStates, paths, clusters, drivers:[driverA,driverB], cascades:[cascadeA,cascadeB], transitions:[transitionA,transitionB], transitionAll, memorySummaries:[memoryA,memoryB], memoryAll, reserveSummaries:[reserveA,reserveB], reserveAll, confidence:dataConfidence, anchorPrice:getCurrentPrice()};
      els.probA.textContent=(clusters[0].prob*100).toFixed(1)+"%";
      els.probB.textContent=(clusters[1].prob*100).toFixed(1)+"%";
      els.descA.textContent=describeScenario(clusters[0].path);
      els.descB.textContent=describeScenario(clusters[1].path);
      renderScenarioMap(els.scenarioMapA,clusters[0].path,simResult.simMeta?.[clusters[0].medoid]);
      renderScenarioMap(els.scenarioMapB,clusters[1].path,simResult.simMeta?.[clusters[1].medoid]);
      if(els.driverA) els.driverA.textContent=`Основной механизм: ${driverA.text}`;
      if(els.driverB) els.driverB.textContent=`Основной механизм: ${driverB.text}`;
      if(els.cascadeA) els.cascadeA.textContent=`Реакция рынка: ${cascadeA.text}`;
      if(els.cascadeB) els.cascadeB.textContent=`Реакция рынка: ${cascadeB.text}`;
      if(els.transitionA) els.transitionA.textContent=`Переход состояния: ${transitionA.text}`;
      if(els.transitionB) els.transitionB.textContent=`Переход состояния: ${transitionB.text}`;
      if(els.memoryA) els.memoryA.textContent=`Память сценария: ${memoryA.text}`;
      if(els.memoryB) els.memoryB.textContent=`Память сценария: ${memoryB.text}`;
      if(els.memoryRead) els.memoryRead.innerHTML=`<b>Память рынка:</b> ${memoryAll.text}<br><span>${memoryAll.detail}</span>`;
      renderPressureReserves(reserveAll);
      if(els.reserveA) els.reserveA.textContent=`Запасы давления: ${reserveA.text}. ${reserveA.detail}`;
      if(els.reserveB) els.reserveB.textContent=`Запасы давления: ${reserveB.text}. ${reserveB.detail}`;
      renderTransitionStrip(els.transitionGlobal,transitionAll);
      if(els.regimeRead) els.regimeRead.innerHTML=`<b>Режим реакции:</b> ${formatRegimeRead(recog.regimes)}`;
      if(els.marketStateRead) els.marketStateRead.innerHTML=`<b>Состояние капитала:</b> ${formatMarketStateRead(simResult.flowSummary)}`;
      if(els.cohortRead) els.cohortRead.innerHTML=`<b>Динамика состояний:</b> ${formatDynamicCohortRead(simResult.simMeta)}`;
      if(els.interactionRead) els.interactionRead.innerHTML=`<b>Реакция рынка:</b> ${formatOverallInteractionRead(simResult.simMeta)}`;
      els.confidence.textContent=`уверенность ${(dataConfidence*100).toFixed(0)}%`;
      els.status.textContent=`готово · ${simulations.toLocaleString('ru-RU')} симуляций`;
      setSelectedModel(0); draw();
      setAnalysisProgress(100,'Анализ завершён',simResult.invalidStepCount ? `Восстановлено некорректных шагов: ${simResult.invalidStepCount}` : 'Результат готов');
      await new Promise(r=>setTimeout(r,180));
      hideAnalysisOverlay();
    } catch(err){
      console.error(err);
      els.status.textContent="ошибка"; els.recognition.textContent="распознавание не удалось"; els.timeframeState.textContent="ТФ —";
      els.empty.classList.remove("hidden"); els.empty.textContent=err.message || "Ошибка анализа изображения.";
      setAnalysisProgress(100,'Ошибка анализа',err.message || 'Не удалось завершить расчёт');
      await new Promise(r=>setTimeout(r,900));
      hideAnalysisOverlay();
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
    files=[]; lastResult=null; els.files.value=""; if(els.currentPrice) els.currentPrice.value=''; updatePriceMode(); els.empty.classList.remove('hidden'); els.empty.textContent='Загрузите хотя бы один скриншот графика.';
    els.status.textContent='ожидание'; els.recognition.textContent='распознавание —'; els.timeframeState.textContent='ТФ —'; els.confidence.textContent='уверенность —';
    ['mMomentum','mVol','mAccel','mDraw','probA','probB'].forEach(id=>$(id).textContent='—'); els.descA.textContent='—'; els.descB.textContent='—'; if(els.scenarioMapA) els.scenarioMapA.innerHTML=''; if(els.scenarioMapB) els.scenarioMapB.innerHTML='';
    if(els.regimeRead) els.regimeRead.innerHTML='<b>Режим реакции:</b> —';
    if(els.marketStateRead) els.marketStateRead.innerHTML='<b>Состояние капитала:</b> —';
    if(els.cohortRead) els.cohortRead.innerHTML='<b>Динамика состояний:</b> —';
    if(els.interactionRead) els.interactionRead.innerHTML='<b>Реакция рынка:</b> —';
    if(els.marketStateMap) els.marketStateMap.innerHTML='';
    if(els.driverA) els.driverA.textContent='Основной механизм: —';
    if(els.driverB) els.driverB.textContent='Основной механизм: —';
    if(els.cascadeA) els.cascadeA.textContent='Реакция рынка: —';
    if(els.cascadeB) els.cascadeB.textContent='Реакция рынка: —';
    if(els.transitionA) els.transitionA.textContent='Переход состояния: —';
    if(els.transitionB) els.transitionB.textContent='Переход состояния: —';
    if(els.memoryRead) els.memoryRead.innerHTML='<b>Память рынка:</b> —';
    if(els.memoryA) els.memoryA.textContent='Память сценария: —';
    if(els.memoryB) els.memoryB.textContent='Память сценария: —';
    if(els.reserveA) els.reserveA.textContent='Запасы давления: —';
    if(els.reserveB) els.reserveB.textContent='Запасы давления: —';
    if(els.supplyReserveValue) els.supplyReserveValue.textContent='—';
    if(els.demandReserveValue) els.demandReserveValue.textContent='—';
    if(els.supplyReserveBar) els.supplyReserveBar.style.width='0%';
    if(els.demandReserveBar) els.demandReserveBar.style.width='0%';
    if(els.reserveDetail) els.reserveDetail.textContent='—';
    if(els.transitionGlobal) renderTransitionStrip(els.transitionGlobal,{before:'—',beforeDetail:'—',event:'—',eventDetail:'—',after:'—',afterDetail:'—'});
    setSelectedModel(0); renderThumbs(); draw();
  }

  els.files.addEventListener('change',e=>addFiles(e.target.files));
  ['dragenter','dragover'].forEach(ev=>els.dropzone.addEventListener(ev,e=>{ e.preventDefault(); els.dropzone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev=>els.dropzone.addEventListener(ev,e=>{ e.preventDefault(); els.dropzone.classList.remove('drag'); }));
  els.dropzone.addEventListener('drop',e=>addFiles(e.dataTransfer.files));
  els.analyzeBtn.addEventListener('click',analyze); els.resetBtn.addEventListener('click',reset);
  els.simulations.addEventListener('input',()=>{ els.simValue.textContent=els.simulations.value; updateSimulationHint(); });
  const updateHorizonLabel=()=>{ const n=Number(els.horizon.value); const hours=n/4; els.horizonValue.textContent=`${n} свечей · ${Number.isInteger(hours)?hours:hours.toFixed(1)}ч`; };
  els.horizon.addEventListener('input',updateHorizonLabel);
  if(els.currentPrice) els.currentPrice.addEventListener('input',updatePriceMode);
  els.showModelA.addEventListener('click',()=>setSelectedModel(0)); els.showModelB.addEventListener('click',()=>setSelectedModel(1));
  els.focusA.addEventListener('click',()=>setSelectedModel(0)); els.focusB.addEventListener('click',()=>setSelectedModel(1));
  window.addEventListener('resize',()=>requestAnimationFrame(draw));
  updateSimulationHint();
  updateHorizonLabel();
  updatePriceMode();
  draw();
})();
