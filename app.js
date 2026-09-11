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

  // Deterministic PRNG for reproducible Monte-Carlo runs.
  // The same input/settings produce the same scenarios, which makes regression testing possible.
  let rngState=(Date.now()>>>0)||0x9e3779b9;
  let activeRunSeed=rngState;
  function setRunSeed(seed){
    const s=(Number(seed)>>>0)||0x9e3779b9;
    activeRunSeed=s;
    rngState=s;
    return s;
  }
  function rand(){
    let t=rngState+=0x6D2B79F5;
    t=Math.imul(t^(t>>>15),t|1);
    t^=t+Math.imul(t^(t>>>7),t|61);
    return ((t^(t>>>14))>>>0)/4294967296;
  }
  function mixSeed(base,index){
    let x=((base>>>0) ^ Math.imul((index+1)>>>0,0x9E3779B1))>>>0;
    x^=x>>>16; x=Math.imul(x,0x85EBCA6B); x^=x>>>13; x=Math.imul(x,0xC2B2AE35); x^=x>>>16;
    return (x>>>0)||0xA341316C;
  }
  function hashStringToSeed(value){
    const s=String(value??'');
    let h=2166136261>>>0;
    for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,16777619); }
    return h>>>0;
  }
  function buildAnalysisSeed(recog,profile,simulations,horizon){
    const signature=(recog?.displayCandles||[]).slice(-40).map(c=>[c.o,c.h,c.l,c.c].map(v=>finite(v,0).toFixed(5)).join(',')).join('|');
    const tfSignature=(recog?.extracted||[]).map(e=>`${e.tf}:${e.path?.length||0}:${finite(e.confidence,0).toFixed(3)}`).sort().join('|');
    return hashStringToSeed(`${profile}|${simulations}|${horizon}|${signature}|${tfSignature}`);
  }
  function gauss(){ let u=0,v=0; while(u===0) u=rand(); while(v===0) v=rand(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
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
    // Match longer/less ambiguous tokens first. Bare "5m" must never match inside "15m".
    const has=(re)=>re.test(s);
    if(has(/(?:^|[^a-z0-9])(?:15\s*m|m15|15мин(?:ут)?)(?=$|[^a-z0-9])/i)) return "m15";
    if(has(/(?:^|[^a-z0-9])(?:5\s*m|m5|5мин(?:ут)?)(?=$|[^a-z0-9])/i)) return "m5";
    if(has(/(?:^|[^a-z0-9])(?:1\s*h|h1|1ч|1час)(?=$|[^a-z0-9])/i)) return "h1";
    if(has(/(?:^|[^a-z0-9])(?:4\s*h|h4|4ч|4часа?)(?=$|[^a-z0-9])/i)) return "h4";
    if(has(/(?:^|[^a-z0-9])(?:1\s*d|d1|1д|1день)(?=$|[^a-z0-9])/i)) return "d1";
    return "auto";
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

  function makeColorClassifier(dataObj,bg){
    const {w,data}=dataObj;
    return (x,y)=>{
      if(x<0 || y<0 || x>=dataObj.w || y>=dataObj.h) return 0;
      const i=(Math.floor(y)*w+Math.floor(x))*4;
      const r=data[i],g=data[i+1],b=data[i+2];
      const lum=(r+g+b)/3;
      const dr=r-bg[0], dg=g-bg[1];
      // Exchange themes differ, so use channel dominance plus distance from the local background.
      const green=g>r+15 && g>b+6 && dg>20 && lum>34;
      const red=r>g+15 && r>b+6 && dr>20 && lum>34;
      return green?1:(red?-1:0);
    };
  }

  function detectChartColorBounds(dataObj,bg){
    const {w,h}=dataObj;
    const classify=makeColorClassifier(dataObj,bg);
    const factor=4;
    const cw=Math.ceil(w/factor), ch=Math.ceil(h/factor);
    const active=new Uint8Array(cw*ch);
    const broadX0=Math.max(0,Math.floor(w*.008)), broadX1=Math.min(w-1,Math.ceil(w*.985));
    const broadY0=Math.max(0,Math.floor(h*.055)), broadY1=Math.min(h-1,Math.ceil(h*.90));

    for(let y=broadY0;y<=broadY1;y++){
      const gy=Math.floor(y/factor);
      for(let x=broadX0;x<=broadX1;x++){
        if(classify(x,y)) active[gy*cw+Math.floor(x/factor)]=1;
      }
    }

    // Connect neighbouring candle bodies/wicks, but not distant UI blocks.
    const dilated=new Uint8Array(active.length);
    for(let gy=0;gy<ch;gy++){
      for(let gx=0;gx<cw;gx++){
        if(!active[gy*cw+gx]) continue;
        for(let dy=-1;dy<=1;dy++){
          const yy=gy+dy; if(yy<0||yy>=ch) continue;
          for(let dx=-2;dx<=2;dx++){
            const xx=gx+dx; if(xx<0||xx>=cw) continue;
            dilated[yy*cw+xx]=1;
          }
        }
      }
    }

    const visited=new Uint8Array(dilated.length);
    const stack=new Int32Array(dilated.length);
    const components=[];
    for(let idx=0;idx<dilated.length;idx++){
      if(!dilated[idx] || visited[idx]) continue;
      let sp=0; stack[sp++]=idx; visited[idx]=1;
      let minX=cw,maxX=0,minY=ch,maxY=0,count=0;
      while(sp){
        const cur=stack[--sp], y=Math.floor(cur/cw), x=cur-y*cw;
        minX=Math.min(minX,x); maxX=Math.max(maxX,x); minY=Math.min(minY,y); maxY=Math.max(maxY,y); count++;
        for(let dy=-1;dy<=1;dy++){
          const yy=y+dy; if(yy<0||yy>=ch) continue;
          for(let dx=-1;dx<=1;dx++){
            if(!dx&&!dy) continue;
            const xx=x+dx; if(xx<0||xx>=cw) continue;
            const ni=yy*cw+xx;
            if(dilated[ni]&&!visited[ni]){ visited[ni]=1; stack[sp++]=ni; }
          }
        }
      }
      const bw=(maxX-minX+1)*factor, bh=(maxY-minY+1)*factor;
      const px=minX*factor, py=minY*factor;
      const wf=bw/w, hf=bh/h, cy=(py+bh*.5)/h;
      if(wf<.20 || hf<.10 || cy>.90) continue;
      const centerBonus=1-clamp(Math.abs(cy-.56)/.56,0,1);
      let score=wf*2.55 + hf*2.05 + centerBonus*.42 + Math.min(1,count/Math.max(1,cw*ch*.035))*.82;
      if(wf<.34) score-=.55;
      if(hf<.15) score-=.75;
      if(py>h*.80) score-=1.1;
      components.push({x:px,y:py,w:bw,h:bh,count,score});
    }
    if(!components.length) return null;
    components.sort((a,b)=>b.score-a.score);
    const best=components[0];
    const padX=Math.max(5,Math.round(w*.012)), padY=Math.max(8,Math.round(h*.018));
    return {
      x0:clamp(best.x-padX,0,w-24),
      x1:clamp(best.x+best.w+padX,24,w-1),
      y0:clamp(best.y-padY,0,h-40),
      y1:clamp(best.y+best.h+padY,40,h-1),
      componentScore:best.score
    };
  }

  function estimateBounds(dataObj){
    const {w,h,data}=dataObj;
    const broad={x0:Math.round(w*.01),x1:Math.round(w*.985),y0:Math.round(h*.045),y1:Math.round(h*.92)};
    const rs=[],gs=[],bs=[];
    for(let y=broad.y0;y<broad.y1;y+=Math.max(4,Math.floor(h/90))){
      for(let x=broad.x0;x<broad.x1;x+=Math.max(4,Math.floor(w/130))){
        const i=(y*w+x)*4; rs.push(data[i]); gs.push(data[i+1]); bs.push(data[i+2]);
      }
    }
    const med=arr=>{ const a=[...arr].sort((a,b)=>a-b); return a[Math.floor(a.length/2)]||0; };
    const bg=[med(rs),med(gs),med(bs)];
    const contrastAt=(x,y)=>{
      const i=(Math.floor(y)*w+Math.floor(x))*4;
      const dr=data[i]-bg[0], dg=data[i+1]-bg[1], db=data[i+2]-bg[2];
      const chroma=Math.max(data[i],data[i+1],data[i+2])-Math.min(data[i],data[i+1],data[i+2]);
      return Math.sqrt(dr*dr+dg*dg+db*db)+chroma*.35;
    };
    const classify=makeColorClassifier(dataObj,bg);
    const component=detectChartColorBounds(dataObj,bg);

    let x0,x1,y0,y1,boundsSource;
    if(component){
      ({x0,x1,y0,y1}=component); boundsSource='candle-component';
    } else {
      // Conservative fallback: use coloured pixels but keep the search in the chart-like middle of the screen.
      const xs=[],ys=[];
      const fy0=Math.floor(h*.10), fy1=Math.floor(h*.86);
      for(let y=fy0;y<fy1;y+=2){
        for(let x=broad.x0;x<broad.x1;x+=2){
          if(classify(x,y)){ xs.push(x); ys.push(y); }
        }
      }
      if(xs.length>=30){
        x0=clamp(Math.floor(quantile(xs,.015)-w*.015),0,w-24);
        x1=clamp(Math.ceil(quantile(xs,.985)+w*.015),x0+24,w-1);
        y0=clamp(Math.floor(quantile(ys,.02)-h*.025),0,h-40);
        y1=clamp(Math.ceil(quantile(ys,.96)+h*.025),y0+40,h-1);
      } else {
        x0=Math.floor(w*.035); x1=Math.floor(w*.93); y0=Math.floor(h*.18); y1=Math.floor(h*.80);
      }
      boundsSource='fallback';
    }

    // Do not allow a thin control/text strip to masquerade as a chart.
    if(y1-y0<h*.16){ y0=Math.max(0,Math.floor(h*.18)); y1=Math.min(h-1,Math.floor(h*.82)); boundsSource+='-expanded'; }
    const colActivity=[];
    for(let x=Math.floor(x0);x<=Math.floor(x1);x+=2){
      let active=0;
      for(let y=Math.floor(y0);y<y1;y+=3) if(classify(x,y)) active++;
      colActivity.push({x,active});
    }
    return {w,h,data,bg,contrastAt,classify,x0,x1,y0,y1,colActivity,boundsSource};
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

  function estimateCandleSpacing(bounds){
    const {x0,x1,y0,y1,classify}=bounds;
    const width=Math.max(1,Math.floor(x1-x0+1));
    const counts=new Float64Array(width);
    for(let ix=0;ix<width;ix++){
      const x=Math.floor(x0)+ix;
      let n=0;
      for(let y=Math.floor(y0);y<=Math.floor(y1);y++) if(classify(x,y)) n++;
      counts[ix]=n;
    }
    const meanCount=mean([...counts]);
    let variance=0;
    for(const v of counts) variance+=(v-meanCount)*(v-meanCount);
    variance/=Math.max(1,counts.length);
    const maxLag=Math.max(5,Math.min(24,Math.floor(width/10)));
    const candidates=[];
    if(variance>1e-8){
      for(let lag=4;lag<=maxLag;lag++){
        let s=0,n=0;
        for(let i=0;i<width-lag;i++){ s+=(counts[i]-meanCount)*(counts[i+lag]-meanCount); n++; }
        candidates.push({lag,score:n?s/n/variance:0});
      }
    }
    let step=clamp(Math.round(width/95),4,12);
    if(candidates.length){
      const maxScore=Math.max(...candidates.map(c=>c.score));
      const good=candidates.filter(c=>c.score>=Math.max(.10,maxScore*.84));
      if(good.length) step=Math.min(...good.map(c=>c.lag));
      else step=candidates.sort((a,b)=>b.score-a.score)[0].lag;
    }
    step=clamp(Math.round(step),4,18);

    let bestOffset=0,bestScore=-Infinity;
    for(let off=0;off<step;off++){
      let score=0,n=0;
      for(let pos=off;pos<width;pos+=step){
        let local=counts[pos]||0;
        if(pos>0) local=Math.max(local,counts[pos-1]||0);
        if(pos+1<width) local=Math.max(local,counts[pos+1]||0);
        score+=local; n++;
      }
      score/=Math.max(1,n);
      if(score>bestScore){bestScore=score;bestOffset=off;}
    }
    return {step,offset:bestOffset,counts};
  }

  function extractColorCenterPath(bounds, spacing){
    const {x0,x1,y0,y1,classify}=bounds;
    const bucket=Math.max(3,spacing?.step||Math.round((x1-x0)/90));
    const ys=[];
    for(let bx=Math.floor(x0);bx<=Math.floor(x1);bx+=bucket){
      const local=[];
      for(let x=bx;x<Math.min(x1+1,bx+bucket);x++){
        for(let y=Math.floor(y0);y<=Math.floor(y1);y++) if(classify(x,y)) local.push(y);
      }
      if(local.length>=4) ys.push(quantile(local,.50));
    }
    if(ys.length<8) return [];
    const raw=ys.map(y=>-(y-y0)/Math.max(1,y1-y0));
    return normalizePath(smooth(raw,1));
  }

  function extractColoredCandles(bounds){
    const {x0,x1,y0,y1,classify}=bounds;
    const spacing=estimateCandleSpacing(bounds);
    const step=spacing.step, offset=spacing.offset;
    const candles=[];
    const half=Math.max(1,Math.floor(step*.44));
    const roiH=Math.max(1,y1-y0);

    for(let cx=Math.floor(x0)+offset;cx<=Math.floor(x1);cx+=step){
      const xa=Math.max(Math.floor(x0),cx-half), xb=Math.min(Math.floor(x1),cx+half);
      const width=Math.max(1,xb-xa+1);
      const greenPts=[],redPts=[];
      const greenRows=new Map(),redRows=new Map();
      for(let x=xa;x<=xb;x++){
        for(let y=Math.floor(y0);y<=Math.floor(y1);y++){
          const side=classify(x,y);
          if(side>0){ greenPts.push(y); greenRows.set(y,(greenRows.get(y)||0)+1); }
          else if(side<0){ redPts.push(y); redRows.set(y,(redRows.get(y)||0)+1); }
        }
      }
      const own=greenPts.length>=redPts.length?greenPts:redPts;
      const rows=greenPts.length>=redPts.length?greenRows:redRows;
      const dominant=greenPts.length>=redPts.length?1:-1;
      if(own.length<5) continue;

      let bodyRows=[...rows.entries()].filter(([,count])=>count>=Math.max(2,Math.ceil(width*.34))).map(([y])=>y);
      if(!bodyRows.length) bodyRows=[...rows.entries()].filter(([,count])=>count>=2).map(([y])=>y);
      if(!bodyRows.length) continue;

      const highY=Math.min(...own), lowY=Math.max(...own), topBody=Math.min(...bodyRows), bottomBody=Math.max(...bodyRows);
      const high=-(highY-y0)/roiH, low=-(lowY-y0)/roiH;
      const isUp=dominant>0;
      const open=-((isUp?bottomBody:topBody)-y0)/roiH;
      const close=-((isUp?topBody:bottomBody)-y0)/roiH;
      const bodyPx=Math.abs(bottomBody-topBody)+1;
      const wickPx=Math.abs(lowY-highY)+1;
      if(wickPx<2 || bodyPx<1) continue;
      candles.push({
        o:open,
        h:Math.max(high,open,close),
        l:Math.min(low,open,close),
        c:close,
        _x:cx,
        _rawDirection:dominant,
        _quality:clamp(own.length/Math.max(5,width*Math.max(3,wickPx)),0,1)
      });
    }

    if(candles.length<10) return {candles:[],confidence:0,visualPath:[],spacing};
    // Trim sparse false positives before/after the real candle chain.
    const diffs=candles.slice(1).map((c,i)=>c._x-candles[i]._x).filter(Number.isFinite);
    const spacingReg=diffs.length?clamp(1-std(diffs)/Math.max(1,mean(diffs))*.8,0,1):.4;
    const expected=Math.max(1,Math.round((candles[candles.length-1]._x-candles[0]._x)/step)+1);
    const coverage=clamp(candles.length/expected,0,1);
    const quality=mean(candles.map(c=>c._quality||0));
    const confidence=clamp(.38 + Math.min(candles.length,80)/130 + spacingReg*.20 + coverage*.12 + quality*.10,0,.97);
    const visualPath=extractColorCenterPath(bounds,spacing);
    return {candles,confidence,visualPath,spacing,spacingReg,coverage};
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
    let segments=mergeSegments(raw,2).filter(s => (s.end-s.start+1)>=1 && (s.end-s.start+1)<=Math.max(36,Math.min(140,Math.round((x1-x0)*.24))));
    const rawWidths=segments.map(s=>s.end-s.start+1).filter(w=>w<=14);
    const rawTypical=Math.max(2,rawWidths.length?quantile(rawWidths,.50):5);
    const splitRaw=[];
    for(const s of segments){
      const width=s.end-s.start+1;
      if(width<=rawTypical*2.7){ splitRaw.push(s); continue; }
      const n=clamp(Math.round(width/Math.max(2,rawTypical+1)),2,12);
      for(let k=0;k<n;k++){
        const a=Math.round(s.start+k*width/n),b=Math.round(s.start+(k+1)*width/n)-1;
        if(b>=a) splitRaw.push({start:a,end:b});
      }
    }
    segments=splitRaw.filter(s => {
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

  function directionAgreementScore(a,b){
    if(!a?.length || !b?.length) return .5;
    const aa=resample(normalizePath(a),32), bb=resample(normalizePath(b),32);
    const da=aa[aa.length-1]-aa[0], db=bb[bb.length-1]-bb[0];
    if(Math.abs(da)<.08 || Math.abs(db)<.08) return .65;
    return Math.sign(da)===Math.sign(db)?1:0;
  }

  function evaluateRecognitionCandidate(cand,referencePath){
    const historyCandles=cand?.candles?.length?normalizeCandles(cand.candles):[];
    const candlePath=historyCandles.length?normalizePath(historyCandles.map(c=>c.c)):[];
    const agreement=pathAgreementScore(candlePath,referencePath);
    const dirAgreement=directionAgreementScore(candlePath,referencePath);
    const countQuality=clamp(historyCandles.length/34,0,1);
    const score=clamp((cand?.confidence||0)*.48 + agreement*.28 + dirAgreement*.14 + countQuality*.10,0,1);
    return {historyCandles,candlePath,agreement,dirAgreement,countQuality,score};
  }

  async function analyzeImage(item){
    const img=await fileToImage(item.file);
    const dataObj=getImageData(img);
    const bounds=estimateBounds(dataObj);
    const line=extractPath(bounds);
    const rawCand=extractCandles(bounds);
    const colorCand=extractColoredCandles(bounds);
    const colorRef=colorCand.visualPath?.length?colorCand.visualPath:line.path;
    const colorEval=evaluateRecognitionCandidate(colorCand,colorRef);
    const rawEval=evaluateRecognitionCandidate(rawCand,line.path);

    let useColor=colorCand.candles.length>=10 && (colorCand.confidence>=rawCand.confidence*.64 || bounds.boundsSource==='candle-component');
    // If colour reconstruction and the independent path disagree badly, automatically try the
    // contrast segmentation instead of confidently rendering a contradictory history.
    if(useColor && (colorEval.agreement<.30 || colorEval.dirAgreement===0) && rawEval.score>colorEval.score+.07) useColor=false;
    if(!useColor && colorEval.score>rawEval.score+.10 && colorCand.candles.length>=10) useColor=true;

    const cand=useColor?colorCand:rawCand;
    const evaluated=useColor?colorEval:rawEval;
    const tf=item.tf==='auto'?inferTimeframe(item.file.name):item.tf;
    const rawContinuity=rawContinuityScore(cand.candles);
    const historyCandles=evaluated.historyCandles;
    const candlePath=evaluated.candlePath;
    const visualReference=useColor?colorRef:line.path;
    const path=candlePath.length?candlePath:visualReference;
    const agreement=evaluated.agreement;
    const dirAgreement=evaluated.dirAgreement;
    const countQuality=evaluated.countQuality;
    const spacingQuality=useColor?clamp((colorCand.spacingReg||0)*.65+(colorCand.coverage||0)*.35,0,1):.45;
    const candleConfidence=clamp(cand.confidence*.60 + agreement*.16 + dirAgreement*.10 + countQuality*.08 + spacingQuality*.06,0,.96);
    let confidence=clamp(candleConfidence*.62 + agreement*.16 + dirAgreement*.10 + line.confidence*.06 + rawContinuity*.06,0,.96);
    if(historyCandles.length<12) confidence=Math.min(confidence,.68);
    if(agreement<.34 || dirAgreement===0) confidence=Math.min(confidence,.56);
    return {
      name:item.file.name,
      tf,
      tfLabel:TF_META[tf]?.label || tf,
      path,
      lineConfidence:line.confidence,
      candleConfidence,
      rawContinuity,
      pathAgreement:agreement,
      directionAgreement:dirAgreement,
      confidence,
      candles:historyCandles,
      sourceWidth:dataObj.w,
      sourceHeight:dataObj.h,
      boundsSource:bounds.boundsSource,
      candleStep:colorCand.spacing?.step||null,
      recognitionMethod:useColor?'regular-color':'contrast-fallback'
    };
  }

  function reconstructContinuousCandles(candles){
    const clean=(candles||[]).filter(c=>c && [c.o,c.h,c.l,c.c].every(Number.isFinite));
    if(!clean.length) return [];
    const out=[];
    let prevClose=null;
    for(const raw of clean){
      // Preserve the absolute pixel-derived close/high/low. Only the next open is constrained
      // to the previous close. Translating the whole candle would accumulate body sizes and
      // invent trends that were never present in the screenshot.
      const c=raw.c;
      const o=prevClose===null?raw.o:prevClose;
      const h=Math.max(raw.h,o,c);
      const l=Math.min(raw.l,o,c);
      out.push({o,h,l,c});
      prevClose=c;
    }
    return out;
  }

  function rawContinuityScore(candles){
    const clean=(candles||[]).filter(c=>c && [c.o,c.h,c.l,c.c].every(Number.isFinite));
    if(clean.length<2) return .35;
    const hi=Math.max(...clean.map(c=>c.h)), lo=Math.min(...clean.map(c=>c.l)), range=Math.max(1e-6,hi-lo);
    const gaps=[];
    for(let i=1;i<clean.length;i++) gaps.push(Math.abs(clean[i].o-clean[i-1].c)/range);
    return clamp(1-quantile(gaps,.75)*10,0,1);
  }

  function pathAgreementScore(a,b){
    if(!a?.length || !b?.length) return .25;
    const n=48, aa=resample(normalizePath(a),n), bb=resample(normalizePath(b),n);
    const mae=mean(aa.map((v,i)=>Math.abs(v-bb[i])));
    return clamp(1-mae*2.4,0,1);
  }

  function normalizeCandles(candles){
    const continuous=reconstructContinuousCandles(candles);
    if(!continuous.length) return [];
    const lastClose=continuous[continuous.length-1].c;
    const highs=continuous.map(c=>c.h), lows=continuous.map(c=>c.l);
    const range=Math.max(1e-6, Math.max(...highs)-Math.min(...lows));
    return continuous.map(c=>({
      o:(c.o-lastClose)/range,
      h:(c.h-lastClose)/range,
      l:(c.l-lastClose)/range,
      c:(c.c-lastClose)/range
    }));
  }

  function deriveHistoryVolatility(candles){
    const clean=(candles||[]).filter(c=>c && [c.o,c.h,c.l,c.c].every(Number.isFinite));
    if(clean.length<2){
      return {
        medianRange:.16,
        p75Range:.24,
        p90Range:.34,
        medianBody:.08,
        jumpSigma:.08,
        burstRate:.18,
        reversalRate:.34,
        avgStreak:2.3,
        volatilityScale:1.0,
        burstScale:1.0,
        reversionScale:1.0
      };
    }

    const ranges=[];
    const bodies=[];
    const jumps=[];
    const absJumps=[];
    const streaks=[];
    let flips=0;
    let prevSign=0;
    let currentStreak=0;

    for(let i=0;i<clean.length;i++){
      const c=clean[i];
      const candleRange=Math.max(1e-6, c.h-c.l);
      const body=Math.abs(c.c-c.o);
      const delta=i===0 ? (c.c-c.o) : (c.c-clean[i-1].c);
      const sign=Math.sign(delta);
      ranges.push(candleRange);
      bodies.push(body);
      jumps.push(delta);
      absJumps.push(Math.abs(delta));
      if(sign){
        if(prevSign && sign!==prevSign) flips++;
        if(sign===prevSign) currentStreak+=1;
        else {
          if(currentStreak) streaks.push(currentStreak);
          currentStreak=1;
          prevSign=sign;
        }
      }
    }
    if(currentStreak) streaks.push(currentStreak);

    const burstThreshold=Math.max(quantile(ranges,.82), quantile(absJumps,.84));
    const burstCount=clean.filter((c,i)=>Math.max(ranges[i],absJumps[i])>=burstThreshold).length;
    const medianRange=quantile(ranges,.50);
    const p75Range=quantile(ranges,.75);
    const p90Range=quantile(ranges,.90);
    const medianBody=quantile(bodies,.50);
    const jumpSigma=std(jumps);
    const burstRate=burstCount/Math.max(1,clean.length);
    const reversalRate=flips/Math.max(1,clean.length-1);
    const avgStreak=mean(streaks)||1;
    const volatilityScale=clamp(.78 + medianRange*1.9 + p90Range*1.4 + burstRate*.85 + jumpSigma*1.25, .76, 2.65);
    const burstScale=clamp(.72 + p90Range*2.0 + burstRate*1.8 + jumpSigma*1.45, .70, 3.4);
    const reversionScale=clamp(.80 + reversalRate*.90 + Math.max(0,2.6-avgStreak)*.10, .72, 1.9);

    return {medianRange,p75Range,p90Range,medianBody,jumpSigma,burstRate,reversalRate,avgStreak,volatilityScale,burstScale,reversionScale};
  }

  function extractAdaptivePivots(series){
    const clean=(series||[]).map(Number).filter(Number.isFinite);
    if(clean.length<3) return clean.map((value,index)=>({index,value}));
    const range=Math.max(1e-9,Math.max(...clean)-Math.min(...clean));
    const deltas=clean.slice(1).map((v,i)=>v-clean[i]);
    const absD=deltas.map(Math.abs);
    const threshold=Math.max(range*.028,quantile(absD,.55)*1.20,quantile(absD,.78)*.72,1e-9);
    const pivots=[{index:0,value:clean[0]}];
    let direction=0;
    let extremeIndex=0,extremeValue=clean[0];

    for(let i=1;i<clean.length;i++){
      const v=clean[i];
      if(direction===0){
        if(v>extremeValue){extremeValue=v;extremeIndex=i;}
        else if(v<extremeValue){extremeValue=v;extremeIndex=i;}
        const fromStart=v-clean[0];
        if(Math.abs(fromStart)>=threshold){
          direction=Math.sign(fromStart);
          extremeIndex=i; extremeValue=v;
        }
        continue;
      }
      if(direction>0){
        if(v>=extremeValue){ extremeValue=v; extremeIndex=i; }
        else if(extremeValue-v>=threshold){
          const last=pivots[pivots.length-1];
          if(extremeIndex!==last.index) pivots.push({index:extremeIndex,value:extremeValue});
          direction=-1; extremeIndex=i; extremeValue=v;
        }
      } else {
        if(v<=extremeValue){ extremeValue=v; extremeIndex=i; }
        else if(v-extremeValue>=threshold){
          const last=pivots[pivots.length-1];
          if(extremeIndex!==last.index) pivots.push({index:extremeIndex,value:extremeValue});
          direction=1; extremeIndex=i; extremeValue=v;
        }
      }
    }
    const lastIndex=clean.length-1;
    const last=pivots[pivots.length-1];
    if(extremeIndex!==last.index && Math.abs(extremeValue-last.value)>=threshold*.55) pivots.push({index:extremeIndex,value:extremeValue});
    if(pivots[pivots.length-1].index!==lastIndex) pivots.push({index:lastIndex,value:clean[lastIndex]});
    return pivots;
  }

  function structureStatsFromSeries(series){
    const clean=(series||[]).filter(Number.isFinite);
    if(clean.length<3){
      return {directionalEfficiency:.58,roughness:.42,swingCount:2,avgSwingLength:3,medianSwingAmplitude:.18,medianRetracement:.30,maxRetracement:.45,turnRate:.22,medianPrimaryLength:3,medianCounterLength:3};
    }
    const pivots=extractAdaptivePivots(clean);
    const range=Math.max(1e-9,Math.max(...clean)-Math.min(...clean));
    const segments=[];
    for(let i=1;i<pivots.length;i++){
      const a=pivots[i-1],b=pivots[i];
      const move=b.value-a.value;
      if(Math.abs(move)<range*.004) continue;
      segments.push({dir:Math.sign(move)||1,move,length:Math.max(1,b.index-a.index),start:a.index,end:b.index});
    }
    if(!segments.length){
      const net=clean[clean.length-1]-clean[0];
      segments.push({dir:Math.sign(net)||1,move:net,length:clean.length-1,start:0,end:clean.length-1});
    }
    const net=clean[clean.length-1]-clean[0];
    const globalDir=Math.sign(net)||segments[0].dir||1;
    const totalTravel=Math.max(1e-9,segments.reduce((s,x)=>s+Math.abs(x.move),0));
    const primary=segments.filter(s=>s.dir===globalDir);
    const counter=segments.filter(s=>s.dir!==globalDir);
    const amplitudes=segments.map(s=>Math.abs(s.move)/range);
    const primaryAmps=primary.map(s=>Math.abs(s.move)/range);
    const counterAmps=counter.map(s=>Math.abs(s.move)/range);
    const retr=[];
    let lastPrimaryMove=null;
    for(const s of segments){
      if(s.dir===globalDir) lastPrimaryMove=Math.max(Math.abs(s.move),range*.004);
      else if(lastPrimaryMove) retr.push(Math.abs(s.move)/lastPrimaryMove);
    }
    const directionalEfficiency=clamp(Math.abs(net)/totalTravel,0,1);
    const swingCount=Math.max(1,segments.length);
    const avgSwingLength=mean(segments.map(s=>s.length))||2;
    const medianSwingAmplitude=quantile(amplitudes,.50)||.12;
    const medianRetracement=clamp(retr.length?quantile(retr,.50):(counterAmps.length&&primaryAmps.length?quantile(counterAmps,.50)/Math.max(.02,quantile(primaryAmps,.50)):.30),.05,1.35);
    const maxRetracement=clamp(retr.length?Math.max(...retr):.45,.08,1.8);
    const turnRate=clamp((swingCount-1)/Math.max(1,clean.length-2),0,1);
    return {
      directionalEfficiency,
      roughness:clamp(1-directionalEfficiency,0,1),
      swingCount,
      avgSwingLength:clamp(avgSwingLength,1,16),
      medianSwingAmplitude:clamp(medianSwingAmplitude,.02,1.2),
      medianRetracement,
      maxRetracement,
      turnRate,
      medianPrimaryLength:clamp(primary.length?quantile(primary.map(s=>s.length),.50):avgSwingLength,1,16),
      medianCounterLength:clamp(counter.length?quantile(counter.map(s=>s.length),.50):avgSwingLength*.75,1,14),
      medianPrimaryAmplitude:clamp(primaryAmps.length?quantile(primaryAmps,.50):medianSwingAmplitude,.02,1.2),
      medianCounterAmplitude:clamp(counterAmps.length?quantile(counterAmps,.50):medianSwingAmplitude*.45,.01,1.0),
      pivotCount:pivots.length
    };
  }

  function deriveHistoryPathStructure(candles){
    const closes=(candles||[]).filter(c=>c&&Number.isFinite(c.c)).map(c=>c.c);
    const stats=structureStatsFromSeries(closes);
    return {
      ...stats,
      targetEfficiency:clamp(stats.directionalEfficiency,.20,.74),
      targetSwingLength:clamp(stats.medianPrimaryLength||stats.avgSwingLength,2,9),
      targetCounterLength:clamp(stats.medianCounterLength||stats.avgSwingLength*.75,2,8),
      targetRetracement:clamp(stats.medianRetracement,.16,.88),
      waveStrength:clamp(.78 + stats.roughness*.82 + stats.turnRate*.55 + Math.min(.35,(stats.swingCount/Math.max(4,closes.length))*.6),.78,1.78)
    };
  }

  function pathVolatilityStats(path){
    const clean=(path||[]).map((v,i)=>finitePositive(v,i?finitePositive(path[i-1],1):1));
    const rets=clean.slice(1).map((v,i)=>Math.log(finitePositive(v,clean[i])/finitePositive(clean[i],1))).filter(Number.isFinite);
    if(!rets.length){
      return {realizedVol:0,p90Abs:0,maxAbs:0,burstRate:0,signFlipRate:0,avgStreak:1};
    }
    const absRets=rets.map(v=>Math.abs(v));
    const threshold=Math.max(quantile(absRets,.84), mean(absRets)+std(absRets)*.45);
    let flips=0, prevSign=0, currentStreak=0;
    const streaks=[];
    for(const r of rets){
      const sign=Math.sign(r);
      if(sign){
        if(prevSign && sign!==prevSign) flips++;
        if(sign===prevSign) currentStreak+=1;
        else {
          if(currentStreak) streaks.push(currentStreak);
          currentStreak=1;
          prevSign=sign;
        }
      }
    }
    if(currentStreak) streaks.push(currentStreak);
    const structure=structureStatsFromSeries(clean.map(v=>Math.log(v/clean[0])));
    return {
      realizedVol:std(rets),
      p90Abs:quantile(absRets,.90),
      maxAbs:Math.max(...absRets),
      burstRate:absRets.filter(v=>v>=threshold).length/Math.max(1,absRets.length),
      signFlipRate:flips/Math.max(1,rets.length-1),
      avgStreak:mean(streaks)||1,
      directionalEfficiency:structure.directionalEfficiency,
      swingCount:structure.swingCount,
      avgSwingLength:structure.avgSwingLength,
      medianSwingAmplitude:structure.medianSwingAmplitude,
      medianRetracement:structure.medianRetracement,
      maxRetracement:structure.maxRetracement
    };
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
    let r=rand();
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
      const isOutside=p.name==='outsideCapital';

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
    if(step<3 || rand()>.085) return;
    const v=m.visual;
    const r=m.regime;

    if(r==='fomo_chase' && (ret<-.006 || (v.distributionRisk>.62 && rand()<.55))){
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
    return '5 000–6 000 — более устойчивое усреднение, но расчёт заметно дольше. Выше 6 000 мобильная версия намеренно не запускает.';
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
    if(els.priceModeLabel) els.priceModeLabel.textContent = price ? `якорь ${formatPrice(price)} · ось модельная` : 'модельная шкала';
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


  function averageVisualStates(entries){
    const rows=(entries||[]).filter(Boolean);
    if(!rows.length) return null;
    const keys=['momentum','vol','accel','drawdown','persistence','compression','pressureBias','crowdStress','reflexivity','capitulationRisk','absorption','liquidityBufferFragility','distributionRisk','continuityTrace'];
    const weights=rows.map(r=>Math.max(.05,finite(r.weight,1)));
    const z=weights.reduce((s,v)=>s+v,0)||1;
    const out={};
    for(const key of keys) out[key]=rows.reduce((s,r,i)=>s+finite(r.state?.[key],0)*weights[i],0)/z;
    out.momentum=clamp(out.momentum,-1,1); out.accel=clamp(out.accel,-1,1); out.pressureBias=clamp(out.pressureBias,-1,1); out.continuityTrace=clamp(out.continuityTrace,-1,1);
    out.vol=clamp(out.vol,0,1.5);
    for(const key of ['drawdown','persistence','compression','crowdStress','reflexivity','capitulationRisk','absorption','liquidityBufferFragility','distributionRisk']) out[key]=clamp(out[key],0,1);
    return out;
  }

  function stateForTimeframe(extracted,tf){
    const entries=(extracted||[])
      .filter(e=>e.tf===tf && e.path?.length)
      .map(e=>({state:deriveVisualState(e.path),weight:.35+.65*clamp(e.confidence,0,1)}));
    return averageVisualStates(entries);
  }

  function combineTwoStates(a,b,wa=.7,wb=.3){
    if(a&&b) return averageVisualStates([{state:a,weight:wa},{state:b,weight:wb}]);
    return a||b||null;
  }

  function aggregateCandles(candles,factor){
    const clean=(candles||[]).filter(c=>c && [c.o,c.h,c.l,c.c].every(Number.isFinite));
    const n=Math.max(1,Math.floor(factor||1));
    if(n<=1) return reconstructContinuousCandles(clean);
    const out=[];
    // Align groups from the right so the latest M5 close remains the latest 15m close.
    // An incomplete oldest group is discarded instead of pretending that 5m/10m is a full 15m candle.
    const remainder=clean.length%n;
    for(let i=remainder;i<clean.length;i+=n){
      const seg=clean.slice(i,i+n);
      if(seg.length!==n) continue;
      out.push({o:seg[0].o,h:Math.max(...seg.map(c=>c.h)),l:Math.min(...seg.map(c=>c.l)),c:seg[seg.length-1].c});
    }
    return reconstructContinuousCandles(out);
  }


  async function recognizeAll(fileItems){
    const extracted=[];
    for(const item of fileItems){
      const r=await analyzeImage(item);
      if(r.path.length) extracted.push(r);
    }
    if(!extracted.length) throw new Error("Не удалось выделить график ни на одном изображении.");

    const unresolved=extracted.filter(e=>e.tf==='auto');
    if(unresolved.length){
      const names=unresolved.slice(0,3).map(e=>e.name).join(', ');
      throw new Error(`Не удалось определить таймфрейм: ${names}${unresolved.length>3?'…':''}. Укажите ТФ вручную для каждого такого скриншота.`);
    }

    const byTf={m5:[],m15:[],h1:[],h4:[],d1:[]};
    for(const e of extracted) if(byTf[e.tf]) byTf[e.tf].push(e);
    const bestOf=arr=>[...(arr||[])].sort((a,b)=>b.confidence-a.confidence)[0]||null;

    // Every uploaded timeframe contributes. Multiple screenshots of the same TF are averaged by recognition confidence.
    const sM5=stateForTimeframe(extracted,'m5');
    const sM15=stateForTimeframe(extracted,'m15');
    const sH1=stateForTimeframe(extracted,'h1');
    const sH4=stateForTimeframe(extracted,'h4');
    const sD1=stateForTimeframe(extracted,'d1');
    const shortState=combineTwoStates(sM15,sM5,.72,.28);
    const midState=sH1;
    const longState=combineTwoStates(sH4,sD1,.64,.36);
    const fallbackState=shortState||midState||longState||deriveVisualState(extracted[0].path);
    const visual=mergeStates(shortState||fallbackState,midState||shortState||fallbackState,longState||midState||shortState||fallbackState) || fallbackState;

    // A 15m forecast must have 15m or 5m history. Higher TFs are context only.
    const m15Best=bestOf(byTf.m15);
    const m5Best=bestOf(byTf.m5);
    const displayBase=m15Best||m5Best;
    if(!displayBase){
      throw new Error('Для построения 15m-прогноза нужен хотя бы один скриншот M15 или M5. H1/H4/D1 используются только как контекст.');
    }

    const historyTarget=56;
    let displayCandles=(displayBase.candles||[]).slice(-(displayBase.tf==='m5'?historyTarget*3:historyTarget));
    if(!displayCandles.length){
      const displayPath=resample(displayBase.path,displayBase.tf==='m5'?historyTarget*3:historyTarget);
      displayCandles=pathToCandles(displayPath.map(v=>1+v*.3),displayBase.tf==='m5'?historyTarget*3:historyTarget,.72).map(c=>({o:c.o-1,h:c.h-1,l:c.l-1,c:c.c-1}));
    }
    if(displayBase.tf==='m5') displayCandles=aggregateCandles(displayCandles,3);
    displayCandles=reconstructContinuousCandles(displayCandles).slice(-historyTarget);
    visual.historyVolatility=deriveHistoryVolatility(displayCandles);
    visual.historyStructure=deriveHistoryPathStructure(displayCandles);

    const used=[];
    for(const tf of ['m5','m15','h1','h4','d1']) if(byTf[tf].length) used.push(`${TF_META[tf].label}×${byTf[tf].length}`);
    const tfSummary=`отрисовка:15m${displayBase.tf==='m5'?' (из M5)':''} · использовано: ${used.join(' / ')}`;
    const weightedConfidence=mean(extracted.map(e=>e.confidence));
    const confidence=clamp(weightedConfidence,0,.94);
    const candleScore=clamp(mean(extracted.map(e=>e.candleConfidence)),0,.94);
    const regimes=inferBehaviorRegimes(visual);

    return {extracted,visual,regimes,confidence,candleScore,displayBase,displayCandles,tfSummary};
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
    let primaryBias=clamp(reserves.balance*.50 + (v.pressureBias||0)*.31 + ((v.globalContext?.pressureBias)||0)*.19,-1,1);
    if(Math.abs(primaryBias)<.055){
      const regimeDir={accumulation:.25,fomo_chase:.55,distribution:-.48,panic_exit:-.62,absorption:.10,liquidity_vacuum:0,balance:0}[m.regime]||0;
      primaryBias=clamp(primaryBias+regimeDir*.34+gauss()*.035,-1,1);
    }
    return {
      primaryDir:primaryBias>=0?1:-1,
      primaryBias,
      baseStrength:clamp(.34 + Math.abs(primaryBias)*.34 + (v.crowdStress||0)*.12 + (v.reflexivity||0)*.10,.28,.82),
      horizon
    };
  }

  function swingDuration(m, mode){
    const hs=m.visual?.historyStructure || deriveHistoryPathStructure([]);
    let base=hs.targetSwingLength||4;
    if(mode==='counterflow') base=hs.targetCounterLength||Math.max(3,base*.72);
    else if(mode==='absorption') base=2.4;
    else if(mode==='balance') base=Math.max(2,base*.56);
    else if(mode==='release') base=Math.max(3,base*.82);
    const jitter=.78+rand()*.48;
    const max=mode==='impulse'?10:mode==='counterflow'?9:mode==='release'?9:6;
    return clamp(Math.round(base*jitter),2,max);
  }

  function createSwingState(m, horizon){
    const q=m.intradaySequence || createIntradaySequence(m,horizon);
    const hs=m.visual?.historyStructure || deriveHistoryPathStructure([]);
    const counterStartProb=clamp(.05 + hs.roughness*.14 + (m.visual?.absorption||0)*.08,.04,.24);
    const mode=rand()<counterStartProb?'counterflow':'impulse';
    const direction=mode==='counterflow'?-q.primaryDir:q.primaryDir;
    const targetDuration=swingDuration(m,mode);
    return {
      mode,
      direction,
      previousImpulseDir:q.primaryDir,
      age:0,
      targetDuration,
      minDuration:mode==='counterflow'?Math.max(3,Math.round(targetDuration*.55)):Math.max(2,Math.round(targetDuration*.42)),
      strength:clamp(q.baseStrength*(mode==='counterflow'?(.94+hs.roughness*.42):1),.28,.98),
      accumulatedMove:0,
      referenceMove:Math.max(.003,(m.volatilityState?.baseSigma||.002)*3.4),
      counterTarget:clamp((hs.targetRetracement||.30)*(.82+rand()*.38),.16,.92),
      localBias:(rand()-.5)*.12,
      transitions:0,
      lastTransitionStep:-1,
      currentEfficiency:1,
      flowFailureStreak:0,
      flowSupportStreak:0,
      localMomentum:0
    };
  }

  function transitionSwing(m, mode, direction, step, referenceMove=null){
    const s=m.swingState || (m.swingState=createSwingState(m,48));
    const q=m.intradaySequence || createIntradaySequence(m,48);
    const hs=m.visual?.historyStructure || deriveHistoryPathStructure([]);
    const oldMove=Math.abs(s.accumulatedMove||0);
    s.mode=mode;
    s.direction=direction||q.primaryDir;
    s.age=0;
    s.targetDuration=swingDuration(m,mode);
    s.minDuration=mode==='counterflow'?Math.max(3,Math.round(s.targetDuration*.55)):Math.max(2,Math.round(s.targetDuration*.42));
    s.accumulatedMove=0;
    s.referenceMove=Math.max(referenceMove||oldMove||s.referenceMove||.003,(m.volatilityState?.baseSigma||.002)*2.5);
    s.counterTarget=clamp((hs.targetRetracement||.30)*(.80+rand()*.42),.14,.94);
    s.localBias=clamp((rand()-.5)*(.14+hs.roughness*.14),-.22,.22);
    const modeScale=mode==='counterflow'?(.94+hs.roughness*.44):mode==='absorption'?.34:mode==='balance'?.28:mode==='release'?.92:1;
    s.strength=clamp(q.baseStrength*modeScale,.18,.96);
    if(mode==='impulse'||mode==='release') s.previousImpulseDir=s.direction;
    s.flowFailureStreak=0;
    s.flowSupportStreak=0;
    s.localMomentum=0;
    s.transitions=(s.transitions||0)+1;
    s.lastTransitionStep=step;
    return s;
  }

  function livePrimaryBias(m){
    const q=m.intradaySequence || createIntradaySequence(m,48);
    const reserves=pressureReserveSnapshot(m);
    const memory=m.memory||{};
    // Macro bias changes slowly and selects the next major release. It no longer dictates
    // the sign of every candle inside a local counter-wave.
    return clamp(
      q.primaryBias*.38 +
      reserves.balance*.38 +
      ((memory.buyPersistence||0)-(memory.sellPersistence||0))*.14 -
      (memory.failedDemand||0)*.06 +
      (m.visual?.pressureBias||0)*.06,
      -1,1
    );
  }

  function intradayPhaseState(m, step, horizon){
    const s=m.swingState || (m.swingState=createSwingState(m,horizon));
    const macroBias=livePrimaryBias(m);
    const macroDir=Math.abs(macroBias)>.055?Math.sign(macroBias):(m.intradaySequence?.primaryDir||1);
    let phase='реализация основного дисбаланса',pulse=0,holdBoost=.08,returnScale=.88;
    if(s.mode==='impulse'){
      phase='реализация основного дисбаланса';
      pulse=s.direction*s.strength;
      holdBoost=.05; returnScale=.92;
    } else if(s.mode==='release'){
      phase='реализация основного дисбаланса';
      pulse=s.direction*s.strength*.96;
      holdBoost=.07; returnScale=.90;
    } else if(s.mode==='absorption'){
      phase='локальное удержание';
      pulse=-s.direction*(.08+s.strength*.20)+s.localBias*.28;
      holdBoost=.42; returnScale=.46;
    } else if(s.mode==='counterflow'){
      phase='встречная реакция';
      // A counter-wave is a real local regime lasting several candles, not a one-bar correction.
      pulse=s.direction*s.strength*1.08;
      holdBoost=.06; returnScale=.96;
    } else {
      phase='временный баланс';
      pulse=s.localBias*.72;
      holdBoost=.50; returnScale=.42;
    }
    return {phase,pulse,holdBoost,returnScale,swingMode:s.mode,swingDirection:s.direction,macroBias,macroDir};
  }

  function updateSwingState(m, step, ctx){
    const s=m.swingState || (m.swingState=createSwingState(m,ctx.horizon||48));
    const hs=m.visual?.historyStructure || deriveHistoryPathStructure([]);
    const q=m.intradaySequence || createIntradaySequence(m,ctx.horizon||48);
    const memory=m.memory||{};
    s.age+=1;
    s.accumulatedMove+=finite(ctx.ret,0);
    s.localMomentum=s.localMomentum*.56+finite(ctx.ret,0)*.44;
    m.pathTravel=(m.pathTravel||0)+Math.abs(finite(ctx.ret,0));
    const logNet=Math.abs(Math.log(finitePositive(m.price,1)/finitePositive(m.startPrice,1)));
    s.currentEfficiency=clamp(logNet/Math.max(1e-8,m.pathTravel||0),0,1);

    const dir=s.direction||q.primaryDir;
    const reserveAfter=ctx.reserveAfter||pressureReserveSnapshot(m);
    const driverExhaustion=dir<0?reserveAfter.supplyExhaustion:reserveAfter.demandExhaustion;
    const receiverResource=dir<0?reserveAfter.demandShare:reserveAfter.supplyShare;
    const flowDir=Math.sign(ctx.net||0);
    const sameFlow=flowDir===dir;
    if(sameFlow && (ctx.imbalance||0)>.09){ s.flowSupportStreak=Math.min(6,(s.flowSupportStreak||0)+1); s.flowFailureStreak=Math.max(0,(s.flowFailureStreak||0)-1); }
    else if(flowDir && flowDir!==dir && (ctx.imbalance||0)>.14){ s.flowFailureStreak=Math.min(6,(s.flowFailureStreak||0)+1); s.flowSupportStreak=Math.max(0,(s.flowSupportStreak||0)-1); }
    else { s.flowFailureStreak=Math.max(0,(s.flowFailureStreak||0)-1); }

    const expected=Math.max((ctx.sigma||.001)*.72,(ctx.impactMagnitude||0)*.46,.00055);
    const weakResponse=sameFlow && (ctx.imbalance||0)>.14 && Math.abs(ctx.ret||0)<expected;
    const absorptionScore=clamp(
      (m.visual?.absorption||0)*.22 +
      (memory.absorptionConfidence||0)*.30 +
      driverExhaustion*.25 +
      receiverResource*.13 +
      (weakResponse?.22:0) +
      Math.max(0,s.currentEfficiency-(hs.targetEfficiency||.56))*.52,
      0,1.4
    );
    const roughnessPressure=clamp((s.currentEfficiency-(hs.targetEfficiency||.56))*1.45,0,.78);
    const ageReady=s.age>=s.minDuration;
    const maxed=s.age>=s.targetDuration;

    if(s.mode==='impulse' || s.mode==='release'){
      const move=Math.abs(s.accumulatedMove);
      const moveUnits=move/Math.max(ctx.sigma||.001,.0007);
      const shouldAbsorb=ageReady && (
        absorptionScore>.54 ||
        driverExhaustion>.46 ||
        moveUnits>Math.max(2.6,(hs.targetSwingLength||4)*.90) ||
        (roughnessPressure>.14 && rand()<roughnessPressure*.86) ||
        maxed
      );
      if(shouldAbsorb) transitionSwing(m,'absorption',dir,step,move);
      return;
    }

    if(s.mode==='absorption'){
      const receiverExhaustion=dir<0?reserveAfter.demandExhaustion:reserveAfter.supplyExhaustion;
      const directCapacity=clamp(receiverResource*(1-receiverExhaustion),0,1);
      // A bounce can also be produced by exhaustion/profit-taking of the driving side; it does
      // not require a huge pool of fresh opposite capital.
      const exhaustionCapacity=clamp(driverExhaustion*.48 + (memory.absorptionConfidence||0)*.18 + (memory.capitalDepletion||0)*.10,0,.72);
      const counterCapacity=Math.max(directCapacity,exhaustionCapacity);
      const structuralNeed=roughnessPressure>.15;
      const counterProb=clamp(.28 + absorptionScore*.33 + hs.roughness*.34 + counterCapacity*.26 + roughnessPressure*.34 + (structuralNeed?.10:0),.18,.94);
      if(ageReady && (absorptionScore>.38 || maxed || structuralNeed)){
        if(counterCapacity>.07 && rand()<counterProb) transitionSwing(m,'counterflow',-dir,step,s.referenceMove);
        else {
          const macro=livePrimaryBias(m), nextDir=Math.abs(macro)>.05?Math.sign(macro):q.primaryDir;
          transitionSwing(m,'release',nextDir,step,s.referenceMove);
        }
      }
      return;
    }

    if(s.mode==='counterflow'){
      const move=Math.abs(s.accumulatedMove);
      const retraceProgress=move/Math.max(.001,s.referenceMove||.003);
      const counterExhaustion=s.direction>0?reserveAfter.demandExhaustion:reserveAfter.supplyExhaustion;
      const targetReached=retraceProgress>=s.counterTarget;
      const failed=s.flowFailureStreak>=2;
      // Macro bias is deliberately NOT an exit trigger. A local counter-wave can persist
      // against the global scenario until its own flow/resource actually fails.
      if(ageReady && (targetReached || counterExhaustion>.58 || failed || maxed)){
        const goBalance=hs.roughness>.30 && rand()<clamp(.22+hs.turnRate*.85,.16,.64);
        if(goBalance) transitionSwing(m,'balance',s.direction,step,s.referenceMove);
        else {
          const macro=livePrimaryBias(m), nextDir=Math.abs(macro)>.05?Math.sign(macro):q.primaryDir;
          transitionSwing(m,'release',nextDir,step,s.referenceMove);
        }
      }
      return;
    }

    if(s.mode==='balance'){
      const macro=livePrimaryBias(m);
      const decisive=Math.abs(macro)>.13 || (ctx.imbalance||0)>.27;
      if((ageReady && decisive) || maxed){
        let nextDir=Math.abs(macro)>.05?Math.sign(macro):q.primaryDir;
        if((ctx.imbalance||0)>.32 && flowDir) nextDir=flowDir;
        transitionSwing(m,'release',nextDir,step,s.referenceMove);
      }
    }
  }

  function createVolatilityState(profileName, visual, horizon){
    const hv=visual?.historyVolatility || deriveHistoryVolatility([]);
    const localVol=clamp(visual?.vol||0,0,1.4);
    const stepCap=profileName==='microcap' ? .040 : profileName==='midcap' ? .018 : .030;
    const rawBase=
      .00115 +
      localVol*.00155 +
      clamp(visual?.crowdStress||0,0,1)*.00095 +
      clamp(visual?.liquidityBufferFragility||0,0,1)*.00075;
    // History contributes only a dimensionless activity scale. It is not treated as real historical % volatility.
    const baseSigma=clamp(rawBase*hv.volatilityScale,.0010,stepCap*.28);
    const shockScale=clamp(
      baseSigma*(1.45 + hv.burstScale*.58 + clamp(visual?.liquidityBufferFragility||0,0,1)*.34),
      baseSigma*1.20,
      stepCap*.72
    );
    return {
      baseSigma,
      currentSigma:clamp(baseSigma*(.96 + hv.medianRange*.12),baseSigma*.82,stepCap*.42),
      clustering:clamp(.28 + localVol*.16 + hv.burstRate*.24 + hv.p90Range*.10,.18,.82),
      shockProbability:clamp(.025 + hv.burstRate*.055 + clamp(visual?.reflexivity||0,0,1)*.032 + clamp(visual?.liquidityBufferFragility||0,0,1)*.036,.02,.12),
      shockScale,
      meanReversion:clamp(.09 + hv.reversionScale*.055 + hv.reversalRate*.11 + clamp(visual?.absorption||0,0,1)*.06,.08,.29),
      bodyMultiplier:clamp(.96 + hv.medianBody*.42 + hv.medianRange*.16 + hv.jumpSigma*.24,.92,1.55),
      wickMultiplier:clamp(1.00 + hv.p75Range*.22 + hv.burstRate*.24 + hv.jumpSigma*.18,.96,1.55),
      recentShock:0,
      eventCooldown:0
    };
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
      profileName,
      startPrice:1,
      directionStreak:0,
      pathTravel:0,
      volatilityState:createVolatilityState(profileName, visual, horizon),
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
          const inventory=clamp(sliceCapital*load*(1.70 + rand()*.18),.001,1);
          const cash=clamp(sliceCapital*(1-load)*(1.70 + rand()*.18),.001,1);
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
          regimeSensitivity:.78 + rand()*.44
        };
      }),
      visual
    };
    // Базовый запас нужен только как точка отсчёта для истощения в этой симуляции.
    market.initialReserves=pressureReserveSnapshot(market);
    market.intradaySequence=createIntradaySequence(market,horizon||48);
    market.swingState=createSwingState(market,horizon||48);
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
    const sigma=Math.max(.0007,context.sigma||0);
    const eventAbs=Math.abs(context.eventShock||0);
    const balanceBoost=phase==='временный баланс' ? 1.10 : phase==='встречная реакция' ? 1.04 : phase==='локальное удержание' ? 1.02 : 1.0;
    const bodyMultiplier=clamp(context.bodyMultiplier||1, .85, 2.0);
    const wickMultiplier=clamp(context.wickMultiplier||1, .88, 2.35);
    const baseExcursion=clamp((.00042 + absRet*.14 + sigma*.44 + imbalance*.00095 + stress*.00078 + flowIntensity*.00082 + eventAbs*.20)*balanceBoost*bodyMultiplier,.00040,.0115);
    const seed=Math.abs((o*100003+c*37013+(context.net||0)*911));
    const n1=.56+seededNoise(seed+1.7)*.84;
    const n2=.56+seededNoise(seed+3.9)*.84;
    const asymmetry=eventAbs>.003 ? (1 + eventAbs*12) : 1;
    const counterSide=baseExcursion*(.62 + (1-imbalance)*.24 + sigma*12*.05)*n1*wickMultiplier;
    const continuationSide=baseExcursion*(.50 + imbalance*.30 + eventAbs*16*.07)*n2*asymmetry*wickMultiplier;
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
          .62*Math.max(0,phase.pulse) -
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
          .62*Math.max(0,-phase.pulse) -
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
        const r=rand();
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
    const regimeDirection={accumulation:.18,fomo_chase:.62,distribution:-.50,panic_exit:-.76,absorption:.16,liquidity_vacuum:0,balance:0}[m.regime] || 0;

    const previousPrice=finitePositive(m.price,1);
    const startPrice=finitePositive(m.startPrice,1);
    const budget=Math.max(.08,finite(m.rangeBudget,.22));
    const logFromStart=Math.log(previousPrice/startPrice);
    const streak=Math.max(0,m.directionStreak||0);
    const recentSign=Math.sign(recentRet);
    const volState=m.volatilityState || (m.volatilityState=createVolatilityState(m.profileName||'default', v, horizon));
    const phaseVolMultiplier=phase.swingMode==='balance' ? .82 : phase.swingMode==='counterflow' ? 1.08 : phase.swingMode==='absorption' ? .88 : 1.12;
    const recentCarry=clamp(Math.abs(recentRet)/Math.max(.001,m.stepReturnCap||.030),0,1)*volState.baseSigma*.72;
    const sigmaTarget=clamp(
      volState.baseSigma*(1 + stress*.68 + imbalance*.34 + m.cascadeIntensity*.28 + m.liquidityRetreat*.20 + volState.recentShock*.24)*phaseVolMultiplier + recentCarry,
      volState.baseSigma*.72,
      (m.stepReturnCap||.030)*.50
    );
    // Convex blend: weights always sum to 1, so volatility does not drift upward by construction.
    const sigmaPersistence=clamp(.58 + volState.clustering*.26,.60,.82);
    volState.currentSigma=clamp(
      volState.currentSigma*sigmaPersistence + sigmaTarget*(1-sigmaPersistence),
      volState.baseSigma*.74,
      (m.stepReturnCap||.030)*.52
    );
    const sigma=volState.currentSigma;

    const cascadeDirection=clamp(m.freshDemandStress - m.lossReactionStress - m.profitReleaseStress*.72,-1,1);
    // Three direction layers are deliberately separated:
    // macro context selects the broad scenario, local swing controls the multi-bar wave,
    // and micro noise only perturbs individual candles.
    const flowRet=Math.sign(net||phase.swingDirection||1)*impactMagnitude;
    const macroContextRet=
      .0010*v.pressureBias*(.35+.65*m.attention) +
      .00085*regimeDirection*(.4+.6*m.attention) +
      .00062*Math.sign(crowdShock||1)*v.reflexivity*(1-fatigue) +
      .00092*cascadeDirection*m.cascadeIntensity +
      .00065*(memory.buyPersistence-memory.sellPersistence) -
      .00050*memory.failedDemand;
    const macroGate=phase.swingMode==='counterflow'?.20:phase.swingMode==='absorption'?.30:phase.swingMode==='balance'?.26:phase.swingMode==='release'?.66:.72;
    const localScale=phase.swingMode==='counterflow'?1.92:phase.swingMode==='impulse'?1.24:phase.swingMode==='release'?1.16:phase.swingMode==='absorption'?.24:.10;
    const waveStrength=m.visual?.historyStructure?.waveStrength||1;
    const momentumCarry=(m.swingState?.localMomentum||0)*(phase.swingMode==='counterflow'?.30:phase.swingMode==='impulse'?.22:phase.swingMode==='release'?.20:.08);
    const swingDrift=phase.pulse*sigma*(localScale + waveStrength*.24) + momentumCarry;
    const drift=(flowRet + macroContextRet*macroGate)*phase.returnScale + swingDrift;
    const localShock=gauss()*sigma;
    const revertMode=phase.swingMode==='balance'?1.34:phase.swingMode==='absorption'?1.18:phase.swingMode==='counterflow'?.22:phase.swingMode==='impulse'?.26:.32;
    const meanRevert=-recentRet*volState.meanReversion*revertMode*clamp(1+streak*.035,1,1.34);
    const activeWave=phase.swingMode==='counterflow'||phase.swingMode==='impulse'||phase.swingMode==='release';
    const counterChance=clamp((activeWave?.025:.10) + Math.max(0,streak-4)*.022 + (phase.swingMode==='balance'?.12:0) + (phase.swingMode==='absorption'?.10:0) + stress*.035,.02,.30);
    const counterKick=(recentSign && rand()<counterChance)
      ? -recentSign*clamp((.30 + Math.abs(gauss())*.62)*sigma*(1+streak*.05), sigma*.18, sigma*1.28)
      : 0;

    if(volState.eventCooldown>0) volState.eventCooldown--;
    const rawEventProbability=clamp(
      volState.shockProbability +
      stress*.035 +
      imbalance*.025 +
      Math.max(0,m.cascadeIntensity-.55)*.075 +
      Math.max(0,m.liquidityRetreat-.45)*.055 +
      Math.max(0,receivingSideExhaustion-.45)*.070,
      .015,.22
    );
    const eventProbability=volState.eventCooldown>0 ? 0 : rawEventProbability;
    let eventShock=0;
    if(rand()<eventProbability){
      const localDirectional=(phase.swingMode==='impulse'||phase.swingMode==='counterflow'||phase.swingMode==='release')?phase.swingDirection:0;
      const directionalBias=Math.sign(net)||Math.sign(drift)||Math.sign(phase.pulse)||1;
      let shockSign=(localDirectional && rand()<.74)?localDirectional:directionalBias;
      const budgetUsage=clamp(Math.abs(logFromStart)/Math.max(.0001,budget),0,1.4);
      const counterEventProb=clamp(.10 + Math.max(0,streak-4)*.03 + Math.max(0,budgetUsage-.58)*.22 + (phase.swingMode==='balance'?.06:0),.07,.38);
      if(recentSign && rand()<counterEventProb) shockSign=-recentSign;
      const eventScale=1 + stress*.44 + imbalance*.38 + m.cascadeIntensity*.30 + volState.recentShock*.16;
      const shockAbs=clamp((.62 + Math.abs(gauss())*.72)*volState.shockScale*eventScale,sigma*.92,(m.stepReturnCap||.030)*.82);
      eventShock=shockSign*shockAbs;
      // Displacements are bursts, not ordinary bars: enforce a short refractory period.
      volState.eventCooldown=2+Math.floor(rand()*3);
    }

    const budgetUsage=clamp(Math.abs(logFromStart)/Math.max(.0001,budget),0,1.35);
    const boundaryPressure=Math.sign(logFromStart||drift)*-1*Math.max(0,budgetUsage-.56)*sigma*(.85 + volState.meanReversion*1.8);
    const boundaryWhipsaw=(budgetUsage>.62 && rand()<clamp(.10 + (budgetUsage-.62)*.42,.08,.46))
      ? -Math.sign(logFromStart||recentRet||drift||1)*clamp((.26 + Math.abs(gauss())*.54)*sigma*(1+budgetUsage*.22), sigma*.18, sigma*1.35)
      : 0;
    const behaviorRet=drift + localShock + meanRevert + counterKick + eventShock + boundaryPressure + boundaryWhipsaw;

    // 5% только для визуальной непрерывности последних свечей; не создаёт сценарий сама по себе.
    const continuityFade=Math.exp(-step/Math.max(3,horizon*.10));
    const continuityRet=.034*v.continuityTrace*continuityFade;

    let ret=ENGINE_BEHAVIOR_WEIGHT*behaviorRet + ENGINE_CONTINUITY_WEIGHT*continuityRet;
    let projected=logFromStart+ret;
    if(Math.abs(projected)>budget){
      const overflow=Math.abs(projected)-budget;
      ret-=Math.sign(projected)*overflow*.78;
      projected=logFromStart+ret;
      if(Math.abs(projected)>budget*1.02){
        ret=Math.sign(projected)*budget*1.02-logFromStart;
      }
    }
    ret=clamp(finite(ret,0),-(m.stepReturnCap||.030),(m.stepReturnCap||.030));

    const realizedAbs=Math.abs(ret);
    volState.recentShock=clamp(volState.recentShock*.72 + Math.max(0,realizedAbs-sigma)*18 + Math.abs(eventShock)/(Math.max(.001,m.stepReturnCap||.030))*0.18,0,1.8);
    volState.currentSigma=clamp(volState.currentSigma*.78 + sigmaTarget*.12 + realizedAbs*(eventShock?0.24:0.16), volState.baseSigma*.72, (m.stepReturnCap||.030)*.66);

    const retSign=Math.sign(ret);
    if(retSign && retSign===Math.sign(recentRet)) m.directionStreak=Math.min(12,(m.directionStreak||0)+1);
    else if(retSign) m.directionStreak=1;
    else m.directionStreak=Math.max(0,(m.directionStreak||0)-1);

    const nextPrice=previousPrice*Math.exp(ret);
    m.price=finitePositive(nextPrice,previousPrice);
    const causalCandle=buildCausalCandle(previousPrice,m.price,{
      net,total,imbalance,stress,liquidity:m.liquidityBuffer,phase:phase.phase,
      sigma:(m.volatilityState?.currentSigma||0),
      eventShock,
      bodyMultiplier:(m.volatilityState?.bodyMultiplier||1),
      wickMultiplier:(m.volatilityState?.wickMultiplier||1)
    });
    m.lastReturn=finite(ret,0);
    updateSwingState(m,step,{ret,net,total,imbalance,stress,sigma,impactMagnitude,reserveBefore,reserveAfter,horizon});
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
      swingMode:phase.swingMode,
      swingDirection:phase.swingDirection,
      pathEfficiency:m.swingState?.currentEfficiency ?? null,
      volatilitySigma:m.volatilityState?.currentSigma || 0,
      eventShock,
      reserves:{
        before:reserveBefore,
        after:reserveAfter,
        supplyRunway:sellConsumption>.0008 ? clamp(reserveAfter.supplyStock/sellConsumption,0,50) : null,
        demandRunway:buyConsumption>.0008 ? clamp(reserveAfter.demandStock/buyConsumption,0,50) : null
      },
      regime:m.regime
    };
  }

  function accumulateFinalCohorts(aggregate,m){
    for(const c of cohortStateSnapshot(m)){
      const key=`${c.stateId}:${c.cohortId}`;
      const a=aggregate[key] ||= {pnl:0,inventoryRatio:0,cashRatio:0,soldFraction:0,n:0,stateLabel:c.stateLabel,cohortLabel:c.cohortLabel};
      a.pnl+=c.pnl; a.inventoryRatio+=c.inventoryRatio; a.cashRatio+=c.cashRatio; a.soldFraction+=c.soldFraction; a.n++;
    }
  }

  function replaySimulation(seed,visual,regimes,marketStateBuckets,profile,horizon){
    setRunSeed(seed);
    const m=initMarket(profile,visual,regimes,marketStateBuckets,horizon);
    const path=[1],candles=[],intradayPhases=[];
    for(let t=0;t<horizon;t++){
      const beforeState=systemStateSnapshot(m);
      const stepResult=stepMarket(m,t,horizon);
      if(!Number.isFinite(stepResult.price)||stepResult.price<=0){
        stepResult.price=finitePositive(path[path.length-1],1); stepResult.ret=0; m.price=stepResult.price; m.lastReturn=0;
      }
      const afterState=systemStateSnapshot(m);
      const transition=buildTransitionRecord(beforeState,afterState,stepResult,t);
      updateMarketMemory(m,beforeState,afterState,stepResult,transition);
      path.push(stepResult.price);
      intradayPhases.push(stepResult.intradayPhase||'реакция');
      if(stepResult.candle && [stepResult.candle.o,stepResult.candle.h,stepResult.candle.l,stepResult.candle.c].every(Number.isFinite)) candles.push(stepResult.candle);
    }
    return {path,candles,intradayPhases};
  }

  async function runSimulations(visual, regimes, marketStateBuckets, profile, simulations, horizon, seedBase=activeRunSeed){
    const paths=[];
    const flowSummary={};
    const cohortFlowSummary={};
    const interactionSummary={};
    const regimeOccupancy={};
    const simMeta=[];
    const finalCohortAggregate={};
    let invalidStepCount=0;
    const batch=100;
    const metaStride=Math.max(1,Math.ceil(simulations/2500));

    for(let s=0;s<simulations;s++){
      const simSeed=mixSeed(seedBase,s+1);
      setRunSeed(simSeed);
      const m=initMarket(profile,visual,regimes,marketStateBuckets,horizon);
      const path=[1];
      const localFlows={};
      const localCohortFlows={};
      const localInteractions={};
      const localRegimes={};
      let cascadeSum=0,retreatSum=0,informedSum=0,panicSum=0,chaseSum=0,cascadeMax=0,keyTransition=null;
      let reserveInitial=null,reserveFinal=null,reserveSupplySum=0,reserveDemandSum=0,reserveBalanceSum=0;
      let reserveSupplyExhaustMax=0,reserveDemandExhaustMax=0,supplyRunwaySum=0,demandRunwaySum=0,supplyRunwayN=0,demandRunwayN=0;

      for(let t=0;t<horizon;t++){
        regimeOccupancy[m.regime]=(regimeOccupancy[m.regime]||0)+1;
        localRegimes[m.regime]=(localRegimes[m.regime]||0)+1;
        const beforeState=systemStateSnapshot(m);
        const stepResult=stepMarket(m,t,horizon);
        if(!Number.isFinite(stepResult.price)||stepResult.price<=0){
          invalidStepCount++;
          const fallback=finitePositive(path[path.length-1],1);
          stepResult.price=fallback; stepResult.ret=0; m.price=fallback; m.lastReturn=0;
        }
        const afterState=systemStateSnapshot(m);
        const transition=buildTransitionRecord(beforeState,afterState,stepResult,t);
        updateMarketMemory(m,beforeState,afterState,stepResult,transition);
        if(!keyTransition||transition.score>keyTransition.score) keyTransition=transition;
        path.push(stepResult.price);
        for(const [name,value] of Object.entries(stepResult.groupFlows)){ flowSummary[name]=(flowSummary[name]||0)+value; localFlows[name]=(localFlows[name]||0)+value; }
        for(const [key,value] of Object.entries(stepResult.cohortFlows||{})){ cohortFlowSummary[key]=(cohortFlowSummary[key]||0)+value; localCohortFlows[key]=(localCohortFlows[key]||0)+value; }
        for(const [key,value] of Object.entries(stepResult.interactions||{})){ interactionSummary[key]=(interactionSummary[key]||0)+value; localInteractions[key]=(localInteractions[key]||0)+value; }
        cascadeSum+=stepResult.cascadeIntensity||0; retreatSum+=stepResult.liquidityRetreat||0; informedSum+=stepResult.profitReleaseStress||0;
        panicSum+=stepResult.lossReactionStress||0; chaseSum+=stepResult.freshDemandStress||0; cascadeMax=Math.max(cascadeMax,stepResult.cascadeIntensity||0);
        if(stepResult.reserves){
          reserveInitial ||= stepResult.reserves.before; reserveFinal=stepResult.reserves.after;
          reserveSupplySum+=stepResult.reserves.after.supplyShare||0; reserveDemandSum+=stepResult.reserves.after.demandShare||0; reserveBalanceSum+=stepResult.reserves.after.balance||0;
          reserveSupplyExhaustMax=Math.max(reserveSupplyExhaustMax,stepResult.reserves.after.supplyExhaustion||0); reserveDemandExhaustMax=Math.max(reserveDemandExhaustMax,stepResult.reserves.after.demandExhaustion||0);
          if(Number.isFinite(stepResult.reserves.supplyRunway)){ supplyRunwaySum+=stepResult.reserves.supplyRunway; supplyRunwayN++; }
          if(Number.isFinite(stepResult.reserves.demandRunway)){ demandRunwaySum+=stepResult.reserves.demandRunway; demandRunwayN++; }
        }
      }

      paths.push(path);
      accumulateFinalCohorts(finalCohortAggregate,m);
      // Keep only summaries for all simulations. Full candles/phases are replayed only for selected medoids.
      const keepFullMeta=(s%metaStride===0);
      simMeta.push(keepFullMeta ? {
        seed:simSeed,
        flows:localFlows,
        cohortFlows:localCohortFlows,
        interactions:localInteractions,
        regimes:localRegimes,
        cascadeAvg:cascadeSum/Math.max(1,horizon),cascadeMax,
        liquidityRetreatAvg:retreatSum/Math.max(1,horizon),informedSellAvg:informedSum/Math.max(1,horizon),
        lossReactionStressAvg:panicSum/Math.max(1,horizon),chaseAvg:chaseSum/Math.max(1,horizon),keyTransition,
        reserve:{
          initial:reserveInitial,final:reserveFinal,
          supplyShareAvg:reserveSupplySum/Math.max(1,horizon),demandShareAvg:reserveDemandSum/Math.max(1,horizon),balanceAvg:reserveBalanceSum/Math.max(1,horizon),
          supplyExhaustionMax:reserveSupplyExhaustMax,demandExhaustionMax:reserveDemandExhaustMax,
          supplyRunwayAvg:supplyRunwayN?supplyRunwaySum/supplyRunwayN:null,demandRunwayAvg:demandRunwayN?demandRunwaySum/demandRunwayN:null
        },
        memory:marketMemorySnapshot(m.memory)
      } : {seed:simSeed});

      if((s+1)%batch===0 && s+1<simulations){
        const simProgress=(s+1)/simulations;
        if(els.status) els.status.textContent=`симуляция ${Math.round(simProgress*100)}%`;
        setAnalysisProgress(20+simProgress*68,'Моделирование рынка',`${(s+1).toLocaleString('ru-RU')} из ${simulations.toLocaleString('ru-RU')} симуляций`);
        await new Promise(resolve=>requestAnimationFrame(resolve));
      }
    }

    return {paths,flowSummary,cohortFlowSummary,interactionSummary,regimeOccupancy,simMeta,finalCohortAggregate,invalidStepCount,seedBase,metaStride};
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
    const absRets=rets.map(v=>Math.abs(v));
    const signature=resample(clean.map(v=>Math.log(v/start)),10);
    const maxIndex=clean.indexOf(max)/Math.max(1,clean.length-1);
    const minIndex=clean.indexOf(min)/Math.max(1,clean.length-1);
    let turns=0, prevSign=0, currentStreak=0;
    const streaks=[];
    for(let i=0;i<rets.length;i++){
      const sign=Math.sign(rets[i]);
      if(sign){
        if(prevSign && sign!==prevSign) turns++;
        if(sign===prevSign) currentStreak+=1;
        else {
          if(currentStreak) streaks.push(currentStreak);
          currentStreak=1;
          prevSign=sign;
        }
      }
    }
    if(currentStreak) streaks.push(currentStreak);
    const burstRate=absRets.length ? absRets.filter(v=>v>=Math.max(quantile(absRets,.84),mean(absRets)+std(absRets)*.45)).length/absRets.length : 0;
    const avgStreak=mean(streaks)||1;
    const structure=structureStatsFromSeries(clean.map(v=>Math.log(v/start)));
    return [
      Math.log(end/start)*1.12,
      Math.log(max/start),
      Math.log(min/start),
      std(rets)*4.4,
      quantile(absRets,.90)*3.8,
      (Math.max(...absRets,0))*3.1,
      clamp(burstRate,0,1)*.38,
      structure.directionalEfficiency*.46,
      clamp(structure.swingCount/Math.max(3,clean.length*.24),0,1)*.34,
      structure.medianSwingAmplitude*.34,
      clamp(structure.medianRetracement,0,1.2)*.30,
      maxIndex*.22,
      minIndex*.22,
      clamp(turns/Math.max(1,rets.length-1),0,1)*.26,
      clamp(avgStreak/Math.max(1,clean.length*.16),0,1)*.20,
      ...signature.map(v=>v*.66)
    ].map(v=>finite(v,0));
  }
  function distance(a,b){ let s=0; for(let i=0;i<a.length;i++){ const d=a[i]-b[i]; s+=d*d; } return Math.sqrt(s); }
  function representativeMedoid(indices, centroid, feats, paths){
    if(!indices.length) return 0;
    const stats=indices.map(i=>({i,...pathVolatilityStats(paths[i])}));
    const targetVol=quantile(stats.map(s=>s.realizedVol),.50);
    const targetP90=quantile(stats.map(s=>s.p90Abs),.50);
    const targetBurst=quantile(stats.map(s=>s.burstRate),.50);
    const targetFlip=quantile(stats.map(s=>s.signFlipRate),.50);
    const targetStreak=quantile(stats.map(s=>s.avgStreak),.50);
    const targetEfficiency=quantile(stats.map(s=>s.directionalEfficiency),.50);
    const targetSwingCount=quantile(stats.map(s=>s.swingCount),.50);
    const targetSwingAmp=quantile(stats.map(s=>s.medianSwingAmplitude),.50);
    const targetRetrace=quantile(stats.map(s=>s.medianRetracement),.50);
    let best=indices[0], bestScore=Infinity;
    for(const s of stats){
      const dFeat=distance(feats[s.i],centroid);
      const volPenalty=
        Math.abs(s.realizedVol-targetVol)/Math.max(.0006,targetVol||.0006) +
        Math.abs(s.p90Abs-targetP90)/Math.max(.0008,targetP90||.0008) +
        Math.abs(s.burstRate-targetBurst)*1.55 +
        Math.abs(s.signFlipRate-targetFlip)*.90 +
        Math.abs(s.avgStreak-targetStreak)/Math.max(1,targetStreak||1) +
        Math.abs(s.directionalEfficiency-targetEfficiency)*1.45 +
        Math.abs(s.swingCount-targetSwingCount)/Math.max(2,targetSwingCount||2)*.85 +
        Math.abs(s.medianSwingAmplitude-targetSwingAmp)/Math.max(.04,targetSwingAmp||.04)*.65 +
        Math.abs(s.medianRetracement-targetRetrace)/Math.max(.12,targetRetrace||.12)*.70;
      const score=dFeat + volPenalty*.24;
      if(score<bestScore){ bestScore=score; best=s.i; }
    }
    return best;
  }
  function clusterTwo(paths){
    paths=(paths||[]).map(path=>{
      let prev=1;
      return (path||[]).map(v=>{ prev=finitePositive(v,prev); return prev; });
    });
    if(!paths.length) paths=[[1,1]];
    const feats=paths.map(pathFeatures);
    const allIds=paths.map((_,i)=>i);
    const centroidOf=indices=>Array.from({length:feats[0].length},(_,j)=>mean(indices.map(i=>feats[i][j])));
    const allCentroid=centroidOf(allIds);

    if(paths.length<4){
      const medoid=representativeMedoid(allIds,allCentroid,feats,paths);
      const primary={ids:allIds,centroid:allCentroid,medoid,path:paths[medoid],prob:1,isDistinct:true};
      const secondary={ids:[],centroid:allCentroid,medoid,path:paths[medoid],prob:0,isDistinct:false};
      return [primary,secondary];
    }

    const terminal=feats.map((f,i)=>({i,v:f[0]})).sort((a,b)=>a.v-b.v);
    let c0=[...feats[terminal[Math.floor(terminal.length*.2)].i]],c1=[...feats[terminal[Math.floor(terminal.length*.8)].i]],labels=new Array(paths.length).fill(0);
    for(let iter=0;iter<12;iter++){
      const groups=[[],[]];
      for(let i=0;i<feats.length;i++){
        const d0=distance(feats[i],c0),d1=distance(feats[i],c1);
        labels[i]=d0<=d1?0:1; groups[labels[i]].push(i);
      }
      if(!groups[0].length||!groups[1].length) break;
      c0=centroidOf(groups[0]); c1=centroidOf(groups[1]);
    }

    const ids=[[],[]]; labels.forEach((l,i)=>ids[l].push(i));
    if(!ids[0].length||!ids[1].length){
      const medoid=representativeMedoid(allIds,allCentroid,feats,paths);
      return [
        {ids:allIds,centroid:allCentroid,medoid,path:paths[medoid],prob:1,isDistinct:true},
        {ids:[],centroid:allCentroid,medoid,path:paths[medoid],prob:0,isDistinct:false}
      ];
    }

    c0=centroidOf(ids[0]); c1=centroidOf(ids[1]);
    const between=distance(c0,c1);
    const within0=mean(ids[0].map(i=>distance(feats[i],c0)));
    const within1=mean(ids[1].map(i=>distance(feats[i],c1)));
    const within=(within0*ids[0].length+within1*ids[1].length)/Math.max(1,paths.length);
    const separation=between/Math.max(.0001,within);
    const endReturns=paths.map(p=>Math.log(finitePositive(p[p.length-1],1)/finitePositive(p[0],1)));
    const endStd=std(endReturns);
    const end0=quantile(ids[0].map(i=>endReturns[i]),.50),end1=quantile(ids[1].map(i=>endReturns[i]),.50);
    const terminalGap=Math.abs(end0-end1);
    const minShare=Math.min(ids[0].length,ids[1].length)/Math.max(1,paths.length);
    const distinct=(separation>=1.10 && between>=.028 && minShare>=.08) || (separation>=.95 && terminalGap>=Math.max(.008,endStd*.58) && minShare>=.10);

    if(!distinct){
      const medoid=representativeMedoid(allIds,allCentroid,feats,paths);
      return [
        {ids:allIds,centroid:allCentroid,medoid,path:paths[medoid],prob:1,isDistinct:true,separation,terminalGap},
        {ids:[],centroid:allCentroid,medoid,path:paths[medoid],prob:0,isDistinct:false,separation,terminalGap}
      ];
    }

    const medoid0=representativeMedoid(ids[0],c0,feats,paths),medoid1=representativeMedoid(ids[1],c1,feats,paths);
    const clusters=[
      {ids:ids[0],centroid:c0,medoid:medoid0,path:paths[medoid0],prob:ids[0].length/paths.length,isDistinct:true,separation,terminalGap},
      {ids:ids[1],centroid:c1,medoid:medoid1,path:paths[medoid1],prob:ids[1].length/paths.length,isDistinct:true,separation,terminalGap}
    ].sort((a,b)=>b.ids.length-a.ids.length);
    return clusters;
  }

  function summarizeClusterDriver(cluster, simMeta){
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

  function formatDynamicCohortRead(simMeta,finalCohortAggregate){
    const flows={};
    for(const meta of simMeta||[]){
      for(const [key,v] of Object.entries(meta.cohortFlows||{})) flows[key]=(flows[key]||0)+v;
    }
    const finals=finalCohortAggregate||{};
    const ordered=Object.entries(flows).sort((a,b)=>Math.abs(b[1])-Math.abs(a[1]));
    const seller=ordered.filter(([,v])=>v<0)[0];
    const buyer=ordered.filter(([,v])=>v>0)[0];

    const avgFinal=Object.entries(finals).map(([key,a])=>({
      key,stateLabel:a.stateLabel,cohortLabel:a.cohortLabel,
      pnl:a.pnl/Math.max(1,a.n),inventoryRatio:a.inventoryRatio/Math.max(1,a.n),cashRatio:a.cashRatio/Math.max(1,a.n),soldFraction:a.soldFraction/Math.max(1,a.n)
    }));
    const trapped=[...avgFinal].sort((a,b)=>(b.inventoryRatio*Math.max(0,-b.pnl))-(a.inventoryRatio*Math.max(0,-a.pnl)))[0];

    const fmtKey=key=>{
      if(!key) return '—';
      const [stateId,cohortId]=key.split(':');
      return `${MARKET_STATE_LABELS[stateId]||stateId} / ${COHORT_BEHAVIOR[cohortId]?.label||cohortId}`;
    };
    const parts=[];
    if(seller) parts.push(`главная разгрузка: ${fmtKey(seller[0])}`);
    if(buyer) parts.push(`главная поддержка: ${fmtKey(buyer[0])}`);
    if(trapped && trapped.pnl<-.02) parts.push(`наибольший остаточный стресс: ${trapped.stateLabel} / ${trapped.cohortLabel}`);
    return parts.length?`${parts.join('; ')}.`:'динамика когорт близка к балансу.';
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
      const modelPct=(normalized-1)*100;
      const label=`${modelPct>=0?'+':''}${modelPct.toFixed(1)}%`;
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

    pill('ИСТОРИЯ · 15m · реконструкция',left,10,'left');
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
    const secondAvailable=!!(lastResult?.clusters?.[1]?.isDistinct && lastResult.clusters[1].prob>0);
    selectedModel=(index===1 && secondAvailable) ? 1 : 0;
    if(els.showModelB) els.showModelB.disabled=!secondAvailable;
    if(els.focusB) els.focusB.disabled=!secondAvailable;
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
      const simulations=clamp(Number(els.simulations.value),500,6000), horizon=Number(els.horizon.value), profile=els.marketProfile.value;
      const runSeed=buildAnalysisSeed(recog,profile,simulations,horizon);
      setRunSeed(runSeed);
      const baseParticipantStates=buildMarketStateBuckets(profile,recog.visual,recog.regimes);
      const cohortStates=buildStateCohorts(baseParticipantStates, recog.regimes, recog.visual);
      const marketStateBuckets=mergeStateCohorts(baseParticipantStates, cohortStates);
      renderMarketStateMap(marketStateBuckets);
      setAnalysisProgress(20,'Моделирование рынка',`0 из ${simulations.toLocaleString('ru-RU')} симуляций`);
      const simResult=await runSimulations(recog.visual, recog.regimes, marketStateBuckets, profile, simulations, horizon, runSeed);
      const paths=simResult.paths;
      setAnalysisProgress(91,'Сбор сценариев','Проверяем, образуют ли симуляции один устойчивый сценарий или два действительно разных кластера');
      const clusters=clusterTwo(paths);
      // Recreate full OHLC/phases only for representatives. This keeps 10k simulations memory-safe.
      const replayed=new Set();
      for(const cluster of clusters){
        if(!cluster || replayed.has(cluster.medoid)) continue;
        const meta=simResult.simMeta?.[cluster.medoid];
        if(!meta?.seed) continue;
        const replay=replaySimulation(meta.seed,recog.visual,recog.regimes,marketStateBuckets,profile,horizon);
        meta.candles=replay.candles; meta.intradayPhases=replay.intradayPhases;
        cluster.path=replay.path; paths[cluster.medoid]=replay.path;
        replayed.add(cluster.medoid);
      }
      setAnalysisProgress(96,'Построение результата','Собираем объяснение, память рынка и свечное продолжение');
      const driverA=summarizeClusterDriver(clusters[0],simResult.simMeta);
      const driverB=summarizeClusterDriver(clusters[1],simResult.simMeta);
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
      const tfCount=new Set(recog.extracted.map(e=>e.tf)).size;
      const contextBonus=clamp((tfCount-1)*.025,0,.075);
      const dataConfidence=clamp(recog.confidence*.70+recog.candleScore*.25+contextBonus,0,.94);
      lastResult={...recog,...simResult,marketStateBuckets,cohortStates,paths,clusters,drivers:[driverA,driverB],cascades:[cascadeA,cascadeB],transitions:[transitionA,transitionB],transitionAll,memorySummaries:[memoryA,memoryB],memoryAll,reserveSummaries:[reserveA,reserveB],reserveAll,confidence:dataConfidence,runSeed};
      els.probA.textContent=(clusters[0].prob*100).toFixed(1)+"%";
      els.probB.textContent=clusters[1].isDistinct ? (clusters[1].prob*100).toFixed(1)+"%" : "—";
      els.descA.textContent=describeScenario(clusters[0].path);
      els.descB.textContent=clusters[1].isDistinct ? describeScenario(clusters[1].path) : 'Отдельный второй сценарий не сформирован: симуляции образуют один устойчивый кластер.';
      renderScenarioMap(els.scenarioMapA,clusters[0].path,simResult.simMeta?.[clusters[0].medoid]);
      if(clusters[1].isDistinct) renderScenarioMap(els.scenarioMapB,clusters[1].path,simResult.simMeta?.[clusters[1].medoid]);
      else if(els.scenarioMapB) els.scenarioMapB.innerHTML='';
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
      if(!clusters[1].isDistinct){
        if(els.driverB) els.driverB.textContent='Основной механизм: отдельный второй кластер не подтверждён';
        if(els.cascadeB) els.cascadeB.textContent='Реакция рынка: —';
        if(els.transitionB) els.transitionB.textContent='Переход состояния: —';
        if(els.memoryB) els.memoryB.textContent='Память сценария: —';
        if(els.reserveB) els.reserveB.textContent='Запасы давления: —';
      }
      renderTransitionStrip(els.transitionGlobal,transitionAll);
      if(els.regimeRead) els.regimeRead.innerHTML=`<b>Режим реакции:</b> ${formatRegimeRead(recog.regimes)}`;
      if(els.marketStateRead) els.marketStateRead.innerHTML=`<b>Состояние капитала:</b> ${formatMarketStateRead(simResult.flowSummary)}`;
      if(els.cohortRead) els.cohortRead.innerHTML=`<b>Динамика состояний:</b> ${formatDynamicCohortRead(simResult.simMeta,simResult.finalCohortAggregate)}`;
      if(els.interactionRead) els.interactionRead.innerHTML=`<b>Реакция рынка:</b> ${formatOverallInteractionRead(simResult.simMeta)}`;
      els.confidence.textContent=`уверенность ${(dataConfidence*100).toFixed(0)}%`;
      els.status.textContent=`готово · ${simulations.toLocaleString('ru-RU')} симуляций · seed ${runSeed.toString(16).padStart(8,'0')}`;
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
      files.push({ id: crypto.randomUUID?.() || rand().toString(36).slice(2), file, tf: inferTimeframe(file.name) });
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
