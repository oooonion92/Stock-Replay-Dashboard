(()=>{
  const D=window.REPLAY_DATA,$=id=>document.getElementById(id);
  const sheet=document.createElement("link");sheet.rel="stylesheet";sheet.href="overrides.css";document.head.appendChild(sheet);
  const groupSheet=document.createElement("link");groupSheet.rel="stylesheet";groupSheet.href="expert-groups.css";document.head.appendChild(groupSheet);
  const C=["#2b638f","#18865f","#b7791f","#7655d8","#c53b32"];
  const L={pending:"待后验",supported:"支持",mixed:"部分支持",falsified:"未证实"};
  const cls=v=>v>=65?"score-good":v>=35?"score-neutral":"score-risk";
  const finite=v=>v!==null&&v!==""&&Number.isFinite(Number(v));
  const metricFormat=(v,id,axis=false)=>{
    if(!finite(v))return "—";
    const n=Number(v),digits=id==="turnoverShare"?1:Math.abs(n)>=100?0:1;
    if(id==="turnoverShare")return `${n.toFixed(digits)}%`;
    const sign=id==="mainNet"&&n>0?"+":"";
    return `${sign}${n.toFixed(digits)}${axis?"":" 亿"}`;
  };
  const domain=(series,{score=false,includeZero=false}={})=>{
    const values=series.flatMap(s=>s.values).filter(finite).map(Number);
    if(!values.length)return score?[0,100]:[-1,1];
    let lo=Math.min(...values),hi=Math.max(...values);
    if(includeZero){lo=Math.min(lo,0);hi=Math.max(hi,0)}
    const span=Math.max(hi-lo,Math.max(Math.abs(lo),Math.abs(hi))*.12,1);
    let low=lo-span*.14,high=hi+span*.14;
    if(score){low=Math.max(0,low);high=Math.min(100,high)}
    return low===high?[low-1,high+1]:[low,high];
  };
  function chart(series,dates,{labels=false,score=false,includeZero=false,metric="score",aria="趋势图",strokeWidth=3,dotRadius=3.6}={}){
    const hasValues=series.some(s=>s.values.some(finite));
    if(!hasValues)return `<div class="chart-empty">该日之前没有可用的板块资金数据</div>`;
    const w=760,h=240,p={l:58,r:24,t:22,b:34},iw=w-p.l-p.r,ih=h-p.t-p.b,n=Math.max(dates.length,1),[low,high]=domain(series,{score,includeZero});
    const x=i=>n===1?w/2:p.l+i*iw/(n-1),y=v=>p.t+(high-v)*ih/(high-low);
    const fmt=v=>metric==="score"?(Number.isInteger(v)?v:v.toFixed(1)):metricFormat(v,metric,true);
    const grid=Array.from({length:5},(_,i)=>low+(high-low)*i/4).map(v=>`<g><line x1="${p.l}" y1="${y(v)}" x2="${w-p.r}" y2="${y(v)}" stroke="#e5eaf0"/><text x="4" y="${y(v)+4}" font-size="11" fill="#98a2b3">${fmt(v)}</text></g>`).join("");
    const zero=includeZero&&low<0&&high>0?`<line x1="${p.l}" y1="${y(0)}" x2="${w-p.r}" y2="${y(0)}" stroke="#98a2b3" stroke-width="1.5"/>`:"";
    const paths=series.map((s,j)=>{
      const color=s.color||C[j%C.length],segments=[];let points=[];
      s.values.forEach((v,i)=>{if(finite(v))points.push({v:Number(v),i});else if(points.length){segments.push(points);points=[]}});if(points.length)segments.push(points);
      const lines=segments.map(g=>`<polyline points="${g.map(q=>`${x(q.i)},${y(q.v)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="${strokeWidth}" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
      const dots=s.values.map((v,i)=>finite(v)?`<circle cx="${x(i)}" cy="${y(Number(v))}" r="${dotRadius}" fill="${color}" stroke="#fff" stroke-width="1"><title>${dates[i]} ${s.name||""} ${metricFormat(v,metric)}</title></circle>`:"").join("");
      const last=[...s.values].map((v,i)=>({v,i})).filter(q=>finite(q.v)).at(-1);
      const tag=labels&&last?`<text x="${Math.min(x(last.i)+7,w-55)}" y="${y(Number(last.v))-7}" font-size="10" font-weight="700" fill="${color}">${fmt(Number(last.v))}</text>`:"";
      return lines+dots+tag;
    }).join("");
    const step=Math.max(1,Math.ceil(dates.length/8));
    const dateLabels=dates.map((d,i)=>(i%step===0||i===dates.length-1)?`<text x="${x(i)}" y="${h-7}" text-anchor="middle" font-size="10" fill="#667085">${d.slice(5)}</text>`:"").join("");
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${aria}">${grid}${zero}${paths}${dateLabels}</svg>`;
  }
  function renderSector(d){
    const cfg=D.sectorFlowConfig;if(!cfg)return;
    const metric=$("sectorMetricSelect").value||cfg.defaultMetric,selected=$("sectorSelect").value||"all",dates=D.dates.filter(x=>x<=d);
    const parent=cfg.groups.find(g=>g.id===selected||g.subgroups?.some(s=>s.id===selected));
    const chosen=selected==="all"?cfg.groups:selected===parent?.id?(parent.subgroups||[parent]):parent?.subgroups?.filter(s=>s.id===selected)||[];
    const series=chosen.map(g=>({name:g.name,color:g.color,values:dates.map(date=>D.sectorFlow?.[date]?.[g.id]?.[metric]??null)}));
    $("sectorTrend").innerHTML=chart(series,dates,{metric,includeZero:metric==="mainNet",labels:chosen.length===1,strokeWidth:1.4,dotRadius:2.2,aria:`板块${cfg.metrics.find(x=>x.id===metric)?.name||"资金"}趋势`});
    const legendItems=selected==="all"?cfg.groups:selected===parent?.id?(parent.subgroups||[parent]):chosen;
    const current=legendItems.map(g=>({g,v:D.sectorFlow?.[d]?.[g.id]?.[metric]})).sort((a,b)=>(finite(b.v)?Number(b.v):-Infinity)-(finite(a.v)?Number(a.v):-Infinity));
    $("sectorLegend").innerHTML=current.map(({g,v})=>`<button type="button" data-sector="${g.id}" class="sector-key ${selected===g.id?"is-active":""}"><i style="background:${g.color}"></i><span>${g.name}</span><b>${metricFormat(v,metric)}</b></button>`).join("");
    const meta=cfg.metrics.find(x=>x.id===metric),missing=current.filter(x=>!finite(x.v)).length;
    const scope=selected==="all"?"点击任一总方向可下钻细分。":selected===parent?.id?`${parent.name}已按细分方向拆解。`:`当前查看 ${chosen[0]?.name||"细分方向"}。`;
    $("sectorNote").textContent=`${meta.name} · ${meta.unit}；区间与市场评分日期一致。${metric==="mainNet"?"主力净额沿用全A数据源口径。":""}${scope}${missing?` 所选日有 ${missing} 个方向缺少有效源数据。`:""}`;
  }
  function render(d){
    const R=D.reports[d],M=R.market,A=D.dates.filter(x=>x<=d),recent=[d];
    const hasMarketScore=Number.isFinite(M.total),scored=A.filter(x=>Number.isFinite(D.reports[x].market.total));
    $("marketTotal").textContent=hasMarketScore?M.total:"—";$("marketStatus").textContent=M.status||"未纳入评分";$("marketSummary").textContent=M.summary||"该日已收录完整复盘 HTML，但当时尚未生成入口看板所需的市场评分字段。";
    $("sentimentScore").textContent=Number.isFinite(M.sentiment)?M.sentiment:"—";$("technicalScore").textContent=Number.isFinite(M.technical)?M.technical:"—";$("fullReportLink").href=R.fullReport;
    $("pathCards").innerHTML=M.paths.map(p=>`<div class="path-card path-${p.tone}"><b>${p.title}</b><span>${p.text}</span></div>`).join("");
    $("historyCount").textContent=`${scored.length}/${A.length} 个交易日有评分`;
    $("marketTrend").innerHTML=chart([{values:A.map(x=>D.reports[x].market.total)}],A,{labels:true,score:true,metric:"score",aria:"市场评分趋势"});
    $("trendNote").textContent=scored.length===A.length?"纵轴按当前可比区间自动缩放；总分越高代表环境越有利，但总闸与结构约束仍优先。":"早期复盘已纳入日期轴，但当时未生成总分；曲线只连接有评分的交易日。";
    renderSector(d);
    const prev=A.length>1?D.reports[A[A.length-2]]:null;
    $("stockRows").innerHTML=R.stocks.map(s=>{
      const q=prev?.stocks.find(x=>x.symbol===s.symbol&&Number.isFinite(x.total)),delta=q?s.total-q.total:null;
      return `<tr><td data-label="标的"><span class="name-cell"><b>${s.name}</b><small>${s.symbol}</small></span></td><td data-label="总分"><span class="score-badge ${cls(s.total)}">${s.total}</span></td><td data-label="较前日" class="delta-flat">${delta===null?"—":`${delta>0?"+":""}${delta}`}</td><td data-label="结构">${s.structure}</td><td data-label="承接">${s.support}</td><td data-label="相对强弱">${s.relative}</td><td data-label="风险安全">${s.risk}</td><td data-label="状态">${s.status}</td></tr>`;
    }).join("");
    const claims=recent.flatMap(date=>D.reports[date].experts.map(q=>({...q,date}))),N=claims.reduce((a,q)=>(a[q.result]=(a[q.result]||0)+1,a),{});
    $("validationStats").innerHTML=Object.entries(L).map(([k,v])=>`<span>${v} ${N[k]||0}</span>`).join("");
    const expertCard=q=>{
      const detail=q.result==="pending"?`验证条件：${q.test||"等待后续交易日数据。"}`:`后验结果：${q.evidence||"未记录可核验依据。"}`;
      return `<article class="expert-card"><div class="expert-meta"><b>${q.tag}</b><span>${q.source}</span></div><blockquote>“${q.quote}”</blockquote><p><b>交易含义：</b>${q.meaning}</p><div class="validation-box"><strong>${L[q.result]||"待标注"}</strong><span>${detail}</span></div>${q.url?`<a href="${q.url}" target="_blank" rel="noopener noreferrer">查看原帖</a>`:""}</article>`;
    };
    $("expertCards").innerHTML=recent.map(date=>`<section class="expert-day-group ${date===d?"is-current":""}"><header class="expert-day-head"><h3>${date}</h3><span>所选日期 · ${D.reports[date].experts.length} 条</span></header><div class="expert-day-grid">${D.reports[date].experts.map(expertCard).join("")}</div></section>`).join("");
  }
  D.dates.slice().reverse().forEach(d=>{const o=document.createElement("option");o.value=d;o.textContent=d;$("dateSelect").appendChild(o)});
  if(D.sectorFlowConfig){
    D.sectorFlowConfig.metrics.forEach(m=>{const o=document.createElement("option");o.value=m.id;o.textContent=m.name;$("sectorMetricSelect").appendChild(o)});$("sectorMetricSelect").value=D.sectorFlowConfig.defaultMetric;
    const all=document.createElement("option");all.value="all";all.textContent="全部方向";$("sectorSelect").appendChild(all);
    D.sectorFlowConfig.groups.forEach(g=>{const o=document.createElement("option");o.value=g.id;o.textContent=g.name;$("sectorSelect").appendChild(o);(g.subgroups||[]).forEach(s=>{const sub=document.createElement("option");sub.value=s.id;sub.textContent=`　${s.name}`;$("sectorSelect").appendChild(sub)})});$("sectorSelect").value="all";
    $("sectorMetricSelect").addEventListener("change",()=>renderSector($("dateSelect").value));$("sectorSelect").addEventListener("change",()=>renderSector($("dateSelect").value));
    $("sectorLegend").addEventListener("click",e=>{const b=e.target.closest("[data-sector]");if(b){$("sectorSelect").value=b.dataset.sector;renderSector($("dateSelect").value)}});
  }
  $("dateSelect").addEventListener("change",e=>render(e.target.value));render(D.dates[D.dates.length-1]);
})();
