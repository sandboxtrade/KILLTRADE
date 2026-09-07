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
    confidence: $("confidence"),
    mMomentum: $("mMomentum"),
    mVol: $("mVol"),
    mAccel: $("mAccel"),
    mDraw: $("mDraw"),
    probA: $("probA"),
    probB: $("probB"),
    descA: $("descA"),
    descB: $("descB")
  };

  const ctx = els.canvas.getContext("2d");
  let files = [];
  let lastResult = null;

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

  function clamp(x, a, b){ return Math.max(a, Math.min(b, x)); }
  function lerp(a,b,t){ return a + (b-a)*t; }
  function mean(a){ return a.length ? a.reduce((s,v)=>s+v,0)/a.length : 0; }
  function std(a){
    if (!a.length) return 0;
    const m = mean(a);
    return Math.sqrt(mean(a.map(v => (v-m)*(v-m))));
  }
  function quantile(arr, q){
    if (!arr.length) return 0;
    const a = [...arr].sort((x,y)=>x-y);
    const pos = (a.length - 1) * q;
    const lo = Math.floor(pos), hi = Math.ceil(pos);
    if (lo === hi) return a[lo];
    return lerp(a[lo], a[hi], pos-lo);
  }

  function gauss(){
    let u=0,v=0;
    while(u===0) u=Math.random();
    while(v===0) v=Math.random();
    return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v);
  }

  function softmax3(buy, hold, sell){
    const m = Math.max(buy,hold,sell);
    const eb = Math.exp(buy-m), eh = Math.exp(hold-m), es = Math.exp(sell-m);
    const z = eb+eh+es;
    return [eb/z, eh/z, es/z];
  }

  function sigmoid(x){ return 1/(1+Math.exp(-x)); }

  function smooth(values, radius=3){
    if (!values.length) return [];
    const out = new Array(values.length);
    for(let i=0;i<values.length;i++){
      let s=0,n=0;
      for(let j=Math.max(0,i-radius);j<=Math.min(values.length-1,i+radius);j++){
        s+=values[j]; n++;
      }
      out[i]=s/n;
    }
    return out;
  }

  function normalizePath(path){
    if (!path.length) return [];
    const p0 = path[0];
    const range = Math.max(1e-6, Math.max(...path)-Math.min(...path));
    return path.map(v => (v-p0)/range);
  }

  async function fileToImage(file){
    const url = URL.createObjectURL(file);
    try{
      const img = new Image();
      img.decoding = "async";
      await new Promise((resolve,reject)=>{
        img.onload=resolve;
        img.onerror=reject;
        img.src=url;
      });
      return img;
    } finally {
      setTimeout(()=>URL.revokeObjectURL(url),1000);
    }
  }

  // ---------- Visual chart recognition ----------
  //
  // v0.1 deliberately does NOT attempt OCR or indicator recognition.
  // It estimates the plotted path by comparing each pixel column with the
  // dominant background colour and looking for coherent high-contrast strokes.
  // This works best on screenshots where the chart occupies most of the image.
  //
  async function extractPathFromImage(img){
    const maxW = 900;
    const scale = Math.min(1, maxW / img.naturalWidth);
    const w = Math.max(320, Math.round(img.naturalWidth * scale));
    const h = Math.max(180, Math.round(img.naturalHeight * scale));

    const c = document.createElement("canvas");
    c.width=w; c.height=h;
    const cctx = c.getContext("2d", {willReadFrequently:true});
    cctx.drawImage(img,0,0,w,h);
    const data = cctx.getImageData(0,0,w,h).data;

    // Avoid borders, price axis, title/toolbars.
    const x0 = Math.round(w*0.07), x1 = Math.round(w*0.88);
    const y0 = Math.round(h*0.12), y1 = Math.round(h*0.90);

    // Estimate dominant background using sparse samples and median channels.
    const rs=[], gs=[], bs=[];
    for(let y=y0;y<y1;y+=Math.max(4,Math.floor(h/80))){
      for(let x=x0;x<x1;x+=Math.max(4,Math.floor(w/120))){
        const i=(y*w+x)*4;
        rs.push(data[i]); gs.push(data[i+1]); bs.push(data[i+2]);
      }
    }
    const med = arr => {
      const a=[...arr].sort((a,b)=>a-b);
      return a[Math.floor(a.length/2)]||0;
    };
    const bg=[med(rs),med(gs),med(bs)];

    function contrastAt(x,y){
      const i=(y*w+x)*4;
      const dr=data[i]-bg[0], dg=data[i+1]-bg[1], db=data[i+2]-bg[2];
      const chroma = Math.max(data[i],data[i+1],data[i+2]) - Math.min(data[i],data[i+1],data[i+2]);
      const lum = Math.sqrt(dr*dr+dg*dg+db*db);
      return lum + chroma*0.35;
    }

    // Detect plot content bounds by activity.
    const colActivity=[];
    for(let x=x0;x<x1;x+=2){
      let active=0;
      for(let y=y0;y<y1;y+=3){
        if(contrastAt(x,y)>36) active++;
      }
      colActivity.push({x,active});
    }
    const actVals = colActivity.map(d=>d.active);
    const threshold = Math.max(2, quantile(actVals,.62));
    const activeCols = colActivity.filter(d=>d.active>=threshold).map(d=>d.x);
    const ax0 = activeCols.length ? Math.max(x0, quantile(activeCols,.02)) : x0;
    const ax1 = activeCols.length ? Math.min(x1, quantile(activeCols,.98)) : x1;

    // For each horizontal bucket, find the most plausible plotted y.
    // We use a weighted median-ish centre of contrast points, preferring continuity.
    const bucket = Math.max(2, Math.floor((ax1-ax0)/260));
    const ys=[];
    let prevY=null;
    let qualityAccum=0;

    for(let bx=Math.floor(ax0); bx<ax1; bx+=bucket){
      const candidates=[];
      for(let x=bx;x<Math.min(ax1,bx+bucket);x++){
        for(let y=y0;y<y1;y+=2){
          const score=contrastAt(x,y);
          if(score>46){
            let continuity=1;
            if(prevY!==null){
              const d=Math.abs(y-prevY)/(y1-y0);
              continuity=Math.exp(-d*7);
            }
            const centerPenalty = 1 - 0.10*Math.abs((y-(y0+y1)/2)/(y1-y0));
            candidates.push({y, score:score*continuity*centerPenalty});
          }
        }
      }
      if(!candidates.length){
        if(prevY!==null) ys.push(prevY);
        continue;
      }

      candidates.sort((a,b)=>b.score-a.score);
      const top=candidates.slice(0,Math.min(22,candidates.length));
      const sw=top.reduce((s,c)=>s+c.score,0);
      const y=top.reduce((s,c)=>s+c.y*c.score,0)/(sw||1);
      prevY = prevY===null ? y : lerp(prevY,y,.72);
      ys.push(prevY);
      qualityAccum += clamp(top.length/12,0,1);
    }

    if(ys.length < 24){
      return { path:[], confidence:0, bounds:{x0:ax0,x1:ax1,y0,y1}, bg };
    }

    // Screen y is inverted: lower pixel = lower price.
    let path = ys.map(y => -(y - y0)/(y1-y0));
    path = smooth(path,2);

    // Remove isolated impossible jumps caused by text/grid lines.
    const diffs=path.slice(1).map((v,i)=>Math.abs(v-path[i]));
    const jumpCap=Math.max(.008, quantile(diffs,.88)*2.8);
    for(let i=1;i<path.length;i++){
      const d=path[i]-path[i-1];
      if(Math.abs(d)>jumpCap) path[i]=path[i-1]+Math.sign(d)*jumpCap;
    }
    path=smooth(path,2);

    const activityScore = clamp(activeCols.length / Math.max(1,colActivity.length) * 1.6, 0, 1);
    const continuityScore = clamp(1 - std(path.slice(1).map((v,i)=>v-path[i]))*18, 0, 1);
    const coverageScore = clamp(path.length/180,0,1);
    const candidateScore = clamp(qualityAccum/Math.max(1,path.length),0,1);
    const confidence = clamp(
      .30*activityScore + .25*continuityScore + .25*coverageScore + .20*candidateScore,
      0, 1
    );

    return { path: normalizePath(path), confidence, bounds:{x0:ax0,x1:ax1,y0,y1}, bg };
  }

  async function recognizeAll(files){
    const extracted=[];
    for(const item of files){
      const img=await fileToImage(item.file);
      const r=await extractPathFromImage(img);
      if(r.path.length) extracted.push({ ...r, name:item.file.name });
    }
    if(!extracted.length) throw new Error("Не удалось выделить график ни на одном изображении.");

    // Higher-confidence screenshots get more weight.
    // Longer timeframes are unknown in v0.1, so each screenshot is resampled equally.
    const target=220;
    const resampled=extracted.map(e=>({
      ...e,
      path:resample(e.path,target)
    }));
    const totalW=resampled.reduce((s,e)=>s+Math.max(.05,e.confidence),0);
    const combined=Array.from({length:target},(_,i)=>
      resampled.reduce((s,e)=>s+e.path[i]*Math.max(.05,e.confidence),0)/totalW
    );

    return {
      path:smooth(combined,2),
      confidence:mean(extracted.map(e=>e.confidence)),
      sources:extracted
    };
  }

  function resample(arr,n){
    if(!arr.length) return [];
    if(arr.length===1) return Array(n).fill(arr[0]);
    const out=[];
    for(let i=0;i<n;i++){
      const t=i/(n-1)*(arr.length-1);
      const a=Math.floor(t), b=Math.min(arr.length-1,a+1);
      out.push(lerp(arr[a],arr[b],t-a));
    }
    return out;
  }

  function deriveVisualState(path){
    const returns=path.slice(1).map((v,i)=>v-path[i]);
    const n=returns.length;
    const fast=returns.slice(Math.max(0,n-18));
    const mid=returns.slice(Math.max(0,n-55));
    const slow=returns.slice(Math.max(0,n-120));

    const momentum = mean(fast)*8 + mean(mid)*3 + mean(slow);
    const vol = std(fast)*.65 + std(mid)*.35;
    const accel = mean(fast) - mean(mid);
    const peak=Math.max(...path);
    const current=path[path.length-1];
    const range=Math.max(1e-6,Math.max(...path)-Math.min(...path));
    const drawdown=(peak-current)/range;

    // Movement persistence, not "trend indicator".
    let same=0;
    for(let i=1;i<returns.length;i++){
      if(Math.sign(returns[i])===Math.sign(returns[i-1])) same++;
    }
    const persistence=same/Math.max(1,returns.length-1);

    const recentRange = Math.max(...path.slice(-40))-Math.min(...path.slice(-40));
    const fullRange = range;
    const compression = clamp(1 - recentRange/(fullRange||1),0,1);

    return {
      momentum:clamp(momentum*3,-1,1),
      vol:clamp(vol*14,0,1.5),
      accel:clamp(accel*18,-1,1),
      drawdown:clamp(drawdown,0,1),
      persistence:clamp(persistence,0,1),
      compression
    };
  }

  // ---------- Participant engine ----------
  function initMarket(profileName, visual){
    const base = PARTICIPANT_PROFILES[profileName].map(p=>({...p}));

    const attention = clamp(
      .42 +
      .24*Math.abs(visual.momentum) +
      .18*visual.vol +
      .16*(1-visual.compression),
      .05, .98
    );

    return {
      price: 1,
      attention,
      liquidity: profileName==="microcap" ? .55 : profileName==="midcap" ? 1.35 : 1.0,
      participants: base.map(p=>({
        ...p,
        cash: clamp(p.capital*(.55 + Math.random()*.55), .02, 1),
        inventory: clamp(p.capital*(.55 + Math.random()*.70), .02, 1),
        avgEntry: 1 - visual.momentum*.10 + gauss()*.06,
        holdingAge: Math.random(),
        coordinated: p.name==="insiders" ? Math.random()*.5 : 0
      })),
      visual
    };
  }

  function stepMarket(m, step, horizon){
    let buyFlow=0, sellFlow=0;
    const v=m.visual;

    const recentRet=m.lastReturn||0;
    const crowdShock=clamp(recentRet*15,-1,1);
    const fatigue=step/horizon;

    for(const p of m.participants){
      const pnl=(m.price-p.avgEntry)/Math.max(.05,p.avgEntry);
      const availableCash=clamp(p.cash,0,2);
      const inventory=clamp(p.inventory,0,2);

      let buyScore =
        -0.15
        + 1.15*p.fomo*m.attention
        + 0.55*p.aggression*Math.max(0,v.momentum)
        + 0.45*p.aggression*Math.max(0,crowdShock)
        + 0.28*availableCash
        - 0.35*Math.max(0,pnl)
        + gauss()*.34;

      let sellScore =
        -0.18
        + 1.20*p.profit*Math.max(0,pnl)
        + 1.05*p.panic*Math.max(0,-crowdShock)
        + 0.55*p.panic*Math.max(0,v.drawdown-.25)
        + 0.28*fatigue*p.profit
        + 0.20*inventory
        + gauss()*.34;

      // Insiders behave more coherently than independent retail.
      if(p.name==="insiders"){
        p.coordinated = clamp(p.coordinated + gauss()*.05 + Math.max(0,pnl)*.02,0,1);
        sellScore += p.coordinated*.9;
      }

      // Liquidity operators mostly counteract short-term flow.
      if(p.name==="liquidity"){
        buyScore  += Math.max(0,-crowdShock)*.9;
        sellScore += Math.max(0, crowdShock)*.9;
      }

      const holdScore = .45 + (1-p.aggression)*.45 + gauss()*.12;
      const [pb,ph,ps]=softmax3(buyScore,holdScore,sellScore);
      const r=Math.random();
      const side = r<pb ? 1 : (r<pb+ph ? 0 : -1);

      if(side===0) continue;

      const sizeBase = Math.exp(-2.4 + gauss()*.75) * (.45 + p.aggression);
      if(side>0){
        const q=Math.min(availableCash, sizeBase*(.7+p.flow*2.2));
        buyFlow += q;
        p.cash -= q*.10;
        p.inventory += q*.10;
        p.avgEntry = lerp(p.avgEntry,m.price,clamp(q*.08,0,.25));
      } else {
        const q=Math.min(inventory, sizeBase*(.7+p.flow*2.2));
        sellFlow += q;
        p.inventory -= q*.10;
        p.cash += q*.10;
      }
    }

    const net=buyFlow-sellFlow;
    const total=buyFlow+sellFlow;

    // Liquidity becomes thinner during one-sided stress and slowly replenishes.
    const imbalance = total>0 ? Math.abs(net)/total : 0;
    const stress = clamp(imbalance*(.6 + Math.abs(crowdShock)),0,1);
    m.liquidity = clamp(
      m.liquidity + .018*(1-m.liquidity) - .035*stress + gauss()*.006,
      .24, 1.8
    );

    // Non-linear market impact. This is a generic prior in v0.1.
    const impactMagnitude = .020 * Math.pow(Math.abs(net)/Math.max(.10,m.liquidity), .58);
    const microNoise = gauss() * (.0025 + .0055*v.vol);
    const persistenceDrift =
      .0015*v.momentum*(.35+.65*m.attention) +
      .0010*v.accel*(1-fatigue);

    let ret = Math.sign(net||1)*impactMagnitude + microNoise + persistenceDrift;
    ret = clamp(ret,-.11,.11);

    m.price *= Math.exp(ret);
    m.lastReturn=ret;

    // Attention reacts to large moves but mean-reverts.
    m.attention=clamp(
      m.attention + .18*Math.abs(ret) - .012*(m.attention-.45) + gauss()*.006,
      .05,.99
    );

    return {price:m.price, ret, net, liquidity:m.liquidity};
  }

  function runSimulations(visual, profile, simulations, horizon){
    const paths=[];
    for(let s=0;s<simulations;s++){
      const m=initMarket(profile,visual);
      const path=[1];
      for(let t=0;t<horizon;t++){
        path.push(stepMarket(m,t,horizon).price);
      }
      paths.push(path);
    }
    return paths;
  }

  // ---------- Two-path clustering ----------
  function pathFeatures(path){
    const start=path[0], end=path[path.length-1];
    const max=Math.max(...path), min=Math.min(...path);
    const mid=path[Math.floor(path.length*.5)];
    const q1=path[Math.floor(path.length*.25)];
    const q3=path[Math.floor(path.length*.75)];
    const rets=path.slice(1).map((v,i)=>Math.log(v/path[i]));
    return [
      Math.log(end/start),
      Math.log(max/start),
      Math.log(min/start),
      Math.log(mid/start),
      Math.log(q1/start),
      Math.log(q3/start),
      std(rets)*6
    ];
  }

  function distance(a,b){
    let s=0;
    for(let i=0;i<a.length;i++){ const d=a[i]-b[i]; s+=d*d; }
    return Math.sqrt(s);
  }

  function clusterTwo(paths){
    const feats=paths.map(pathFeatures);

    // Seed centroids using return extremes, then iterate k-means.
    const terminal=feats.map((f,i)=>({i,v:f[0]})).sort((a,b)=>a.v-b.v);
    let c0=[...feats[terminal[Math.floor(terminal.length*.2)].i]];
    let c1=[...feats[terminal[Math.floor(terminal.length*.8)].i]];
    let labels=new Array(paths.length).fill(0);

    for(let iter=0;iter<12;iter++){
      const groups=[[],[]];
      for(let i=0;i<feats.length;i++){
        const d0=distance(feats[i],c0), d1=distance(feats[i],c1);
        labels[i]=d0<=d1?0:1;
        groups[labels[i]].push(feats[i]);
      }
      [c0,c1]=[0,1].map(k=>{
        if(!groups[k].length) return k===0?c0:c1;
        return Array.from({length:feats[0].length},(_,j)=>mean(groups[k].map(f=>f[j])));
      });
    }

    const ids=[[],[]];
    labels.forEach((l,i)=>ids[l].push(i));

    // Degenerate safety: if k-means collapses into one cluster, split by terminal return.
    if(!ids[0].length || !ids[1].length){
      ids[0]=[]; ids[1]=[];
      const order=feats.map((f,i)=>({i,v:f[0]})).sort((a,b)=>a.v-b.v);
      const cut=Math.max(1,Math.floor(order.length/2));
      order.forEach((d,rank)=>ids[rank<cut?0:1].push(d.i));
      const centroidOf=(indices)=>Array.from({length:feats[0].length},(_,j)=>mean(indices.map(i=>feats[i][j])));
      c0=centroidOf(ids[0]);
      c1=centroidOf(ids[1]);
    }

    function medoid(indices, centroid){
      let best=indices[0], bestD=Infinity;
      // Exact centroid-nearest member is sufficient and much cheaper than all-pairs medoid.
      for(const i of indices){
        const d=distance(feats[i],centroid);
        if(d<bestD){ bestD=d; best=i; }
      }
      return best;
    }

    let m0=medoid(ids[0],c0), m1=medoid(ids[1],c1);
    let clusters=[
      {ids:ids[0], centroid:c0, medoid:m0, path:paths[m0]},
      {ids:ids[1], centroid:c1, medoid:m1, path:paths[m1]}
    ];

    clusters.sort((a,b)=>b.ids.length-a.ids.length);

    for(const c of clusters){
      const members=c.ids.map(i=>paths[i]);
      c.low=Array.from({length:paths[0].length},(_,t)=>quantile(members.map(p=>p[t]),.10));
      c.high=Array.from({length:paths[0].length},(_,t)=>quantile(members.map(p=>p[t]),.90));
      c.prob=c.ids.length/paths.length;
    }

    return clusters;
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
        ? `Сначала расширение вверх, затем сильная разгрузка; ${endTxt}.`
        : `Сначала провал ликвидности, затем восстановление; ${endTxt}.`;
    }
    if(end>.06){
      return tMin>.15 && tMin<.7
        ? `Откат/сбор ликвидности с последующим продолжением роста; ${endTxt}.`
        : `Преобладание покупочного потока и расширение вверх; ${endTxt}.`;
    }
    if(end<-.06){
      return tMax>.15 && tMax<.7
        ? `Попытка продолжения роста с переходом в распределение; ${endTxt}.`
        : `Доминирование предложения и ускорение вниз; ${endTxt}.`;
    }
    return `Баланс потоков, широкая зона неопределённости; ${endTxt}.`;
  }

  // ---------- Rendering ----------
  function resizeCanvas(){
    const rect=els.canvas.parentElement.getBoundingClientRect();
    const dpr=Math.min(2,window.devicePixelRatio||1);
    const cssW=Math.max(320,rect.width);
    const cssH=Math.max(330,Math.min(620,cssW*.56));
    els.canvas.style.height=cssH+"px";
    els.canvas.width=Math.round(cssW*dpr);
    els.canvas.height=Math.round(cssH*dpr);
    ctx.setTransform(dpr,0,0,dpr,0,0);
    return {w:cssW,h:cssH};
  }

  function draw(){
    const {w,h}=resizeCanvas();
    ctx.clearRect(0,0,w,h);
    ctx.fillStyle="#05070a";
    ctx.fillRect(0,0,w,h);

    // grid
    ctx.strokeStyle="#111722";
    ctx.lineWidth=1;
    for(let i=1;i<6;i++){
      const y=(h/6)*i;
      ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(w,y);ctx.stroke();
    }
    for(let i=1;i<10;i++){
      const x=(w/10)*i;
      ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,h);ctx.stroke();
    }

    if(!lastResult) return;

    const history=lastResult.history;
    const A=lastResult.clusters[0];
    const B=lastResult.clusters[1];

    const historyShare=.56;
    const hx0=24, hx1=w*historyShare;
    const fx0=hx1, fx1=w-24;

    const histMapped=history.map(v=>1+v*.14);
    const allValues=[
      ...histMapped,
      ...A.low,...A.high,...B.low,...B.high
    ];
    let lo=Math.min(...allValues), hi=Math.max(...allValues);
    const pad=(hi-lo)*.14 || .1;
    lo-=pad; hi+=pad;

    const yMap=p=> h-24 - (p-lo)/(hi-lo)*(h-48);
    const xPath=(i,n,x0,x1)=> x0+(i/(n-1))*(x1-x0);

    // separator
    ctx.save();
    ctx.strokeStyle="#273044";
    ctx.setLineDash([5,6]);
    ctx.beginPath();ctx.moveTo(hx1,18);ctx.lineTo(hx1,h-18);ctx.stroke();
    ctx.restore();

    function area(low,high,color){
      ctx.beginPath();
      low.forEach((p,i)=>{
        const x=xPath(i,low.length,fx0,fx1), y=yMap(p);
        if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      for(let i=high.length-1;i>=0;i--){
        ctx.lineTo(xPath(i,high.length,fx0,fx1),yMap(high[i]));
      }
      ctx.closePath();
      ctx.fillStyle=color;
      ctx.fill();
    }

    area(A.low,A.high,"rgba(231,177,74,.10)");
    area(B.low,B.high,"rgba(141,150,255,.08)");

    function line(path,color,width,x0,x1){
      ctx.beginPath();
      path.forEach((p,i)=>{
        const x=xPath(i,path.length,x0,x1), y=yMap(p);
        if(i===0)ctx.moveTo(x,y); else ctx.lineTo(x,y);
      });
      ctx.strokeStyle=color;
      ctx.lineWidth=width;
      ctx.lineJoin="round";
      ctx.lineCap="round";
      ctx.stroke();
    }

    line(histMapped,"#dde2eb",1.7,hx0,hx1);
    line(A.path,"#e7b14a",2.4,fx0,fx1);
    line(B.path,"#8d96ff",2.1,fx0,fx1);

    // current point
    const cy=yMap(1);
    ctx.fillStyle="#f4f6fb";
    ctx.beginPath();ctx.arc(fx0,cy,3.5,0,Math.PI*2);ctx.fill();

    ctx.fillStyle="#7f899b";
    ctx.font="11px ui-monospace, SFMono-Regular, Menlo, monospace";
    ctx.fillText("HISTORY",24,18);
    ctx.fillText("SIMULATED FUTURE",fx0+12,18);
    ctx.fillText(`A ${(A.prob*100).toFixed(1)}%`,fx1-95,38);
    ctx.fillText(`B ${(B.prob*100).toFixed(1)}%`,fx1-95,56);
  }

  function updateMetrics(visual, confidence){
    const pct=x=>(x*100).toFixed(1)+"%";
    els.mMomentum.textContent =
      visual.momentum>.12 ? "UP +" + pct(visual.momentum) :
      visual.momentum<-.12 ? "DOWN " + pct(visual.momentum) :
      "NEUTRAL";
    els.mVol.textContent=pct(clamp(visual.vol,0,1));
    els.mAccel.textContent=(visual.accel>=0?"+":"")+pct(visual.accel);
    els.mDraw.textContent=pct(visual.drawdown);
    els.confidence.textContent=`confidence ${(confidence*100).toFixed(0)}%`;
  }

  async function analyze(){
    if(!files.length) return;
    els.analyzeBtn.disabled=true;
    els.status.textContent="распознавание";
    els.empty.classList.add("hidden");

    try{
      const visualResult=await recognizeAll(files);
      els.recognition.textContent=`распознавание ${(visualResult.confidence*100).toFixed(0)}%`;

      const visual=deriveVisualState(visualResult.path);
      updateMetrics(visual,visualResult.confidence);

      els.status.textContent="симуляция";
      await new Promise(r=>requestAnimationFrame(r));

      const simulations=Number(els.simulations.value);
      const horizon=Number(els.horizon.value);
      const profile=els.marketProfile.value;

      const paths=runSimulations(visual,profile,simulations,horizon);
      const clusters=clusterTwo(paths);

      // Data confidence is intentionally capped in v0.1 because no live participant data is connected.
      const dataConfidence=clamp(visualResult.confidence*.62,0,.62);

      lastResult={
        history:visualResult.path,
        visual,
        paths,
        clusters,
        confidence:dataConfidence
      };

      els.probA.textContent=(clusters[0].prob*100).toFixed(1)+"%";
      els.probB.textContent=(clusters[1].prob*100).toFixed(1)+"%";
      els.descA.textContent=describeScenario(clusters[0].path);
      els.descB.textContent=describeScenario(clusters[1].path);
      els.confidence.textContent=`confidence ${(dataConfidence*100).toFixed(0)}%`;
      els.status.textContent=`готово · ${simulations.toLocaleString("ru-RU")} sims`;

      draw();
    }catch(err){
      console.error(err);
      els.status.textContent="ошибка";
      els.recognition.textContent="распознавание не удалось";
      els.empty.classList.remove("hidden");
      els.empty.textContent=err.message || "Ошибка анализа изображения.";
    }finally{
      els.analyzeBtn.disabled=!files.length;
    }
  }

  function addFiles(list){
    const incoming=[...list].filter(f=>f.type.startsWith("image/"));
    for(const file of incoming){
      if(files.length>=6) break;
      files.push({id:crypto.randomUUID?.() || Math.random().toString(36).slice(2),file});
    }
    renderThumbs();
  }

  function renderThumbs(){
    els.thumbs.innerHTML="";
    for(const item of files){
      const url=URL.createObjectURL(item.file);
      const row=document.createElement("div");
      row.className="thumb";
      row.innerHTML=`
        <img alt="">
        <div class="meta">
          <div class="name"></div>
          <div class="sub"></div>
        </div>
        <button title="Удалить">×</button>`;
      row.querySelector("img").src=url;
      row.querySelector("img").onload=()=>URL.revokeObjectURL(url);
      row.querySelector(".name").textContent=item.file.name;
      row.querySelector(".sub").textContent=(item.file.size/1024/1024).toFixed(2)+" MB";
      row.querySelector("button").onclick=()=>{
        files=files.filter(f=>f.id!==item.id);
        renderThumbs();
      };
      els.thumbs.appendChild(row);
    }
    els.fileCount.textContent=`${files.length} файл${files.length===1?"":files.length<5?"а":"ов"}`;
    els.analyzeBtn.disabled=!files.length;
    els.resetBtn.disabled=!files.length && !lastResult;
  }

  function reset(){
    files=[];
    lastResult=null;
    els.files.value="";
    els.empty.classList.remove("hidden");
    els.empty.textContent="Загрузите хотя бы один скриншот графика.";
    els.status.textContent="ожидание";
    els.recognition.textContent="распознавание —";
    els.confidence.textContent="confidence —";
    ["mMomentum","mVol","mAccel","mDraw","probA","probB"].forEach(id=>$(id).textContent="—");
    els.descA.textContent="—"; els.descB.textContent="—";
    renderThumbs();
    draw();
  }

  els.files.addEventListener("change",e=>addFiles(e.target.files));
  ["dragenter","dragover"].forEach(ev=>els.dropzone.addEventListener(ev,e=>{
    e.preventDefault(); els.dropzone.classList.add("drag");
  }));
  ["dragleave","drop"].forEach(ev=>els.dropzone.addEventListener(ev,e=>{
    e.preventDefault(); els.dropzone.classList.remove("drag");
  }));
  els.dropzone.addEventListener("drop",e=>addFiles(e.dataTransfer.files));
  els.analyzeBtn.addEventListener("click",analyze);
  els.resetBtn.addEventListener("click",reset);
  els.simulations.addEventListener("input",()=>els.simValue.textContent=els.simulations.value);
  els.horizon.addEventListener("input",()=>els.horizonValue.textContent=els.horizon.value);
  window.addEventListener("resize",()=>requestAnimationFrame(draw));

  draw();
})();
