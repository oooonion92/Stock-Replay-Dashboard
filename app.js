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
  const niceStep=raw=>{
    if(!finite(raw)||Number(raw)<=0)return 1;
    const power=10**Math.floor(Math.log10(Number(raw))),fraction=Number(raw)/power;
    const nice=fraction<=1?1:fraction<=2?2:fraction<=2.5?2.5:fraction<=5?5:10;
    return nice*power;
  };
  const niceScale=(series,{includeZero=false,score=false}={})=>{
    if(score){
      const [low,high]=domain(series,{score,includeZero});
      return {low,high,ticks:Array.from({length:5},(_,i)=>low+(high-low)*i/4)};
    }
    const values=series.flatMap(s=>s.values).filter(finite).map(Number);
    if(!values.length)return {low:-1,high:1,ticks:[-1,-.5,0,.5,1]};
    let lo=Math.min(...values),hi=Math.max(...values);
    if(includeZero){lo=Math.min(lo,0);hi=Math.max(hi,0)}
    const padding=Math.max((hi-lo)*.1,Math.max(Math.abs(lo),Math.abs(hi))*.04,1);
    const step=niceStep((hi-lo+padding*2)/4);
    const low=Math.floor((lo-padding)/step)*step,high=Math.ceil((hi+padding)/step)*step;
    const ticks=[];for(let v=low;v<=high+step*.01;v+=step)ticks.push(Math.abs(v)<step*.001?0:v);
    return {low,high,ticks};
  };
  const symmetricScale=values=>{
    const nums=values.filter(finite).map(v=>Math.abs(Number(v))),max=Math.max(...nums,1);
    const step=niceStep(max/2),extent=Math.ceil(max/step)*step;
    return {low:-extent,high:extent,ticks:[-extent,-extent/2,0,extent/2,extent]};
  };
  function chart(series,dates,{labels=false,score=false,includeZero=false,metric="score",aria="趋势图",strokeWidth=3,dotRadius=3.6}={}){
    const hasValues=series.some(s=>s.values.some(finite));
    if(!hasValues)return `<div class="chart-empty">该日之前没有可用的板块资金数据</div>`;
    const w=760,h=240,p={l:58,r:24,t:22,b:34},iw=w-p.l-p.r,ih=h-p.t-p.b,n=Math.max(dates.length,1),scale=niceScale(series,{score,includeZero}),{low,high}=scale;
    const x=i=>n===1?w/2:p.l+i*iw/(n-1),y=v=>p.t+(high-v)*ih/(high-low);
    const fmt=v=>metric==="score"?(Number.isInteger(v)?v:v.toFixed(1)):metricFormat(v,metric,true);
    const grid=scale.ticks.map(v=>`<g><line x1="${p.l}" y1="${y(v)}" x2="${w-p.r}" y2="${y(v)}" stroke="#e5eaf0"/><text x="4" y="${y(v)+4}" font-size="11" fill="#98a2b3">${fmt(v)}</text></g>`).join("");
    const zero=includeZero&&low<0&&high>0?`<line x1="${p.l}" y1="${y(0)}" x2="${w-p.r}" y2="${y(0)}" stroke="#98a2b3" stroke-width="1.5"/>`:"";
    const paths=series.map((s,j)=>{
      const color=s.color||C[j%C.length],segments=[];let points=[];
      s.values.forEach((v,i)=>{if(finite(v))points.push({v:Number(v),i});else if(points.length){segments.push(points);points=[]}});if(points.length)segments.push(points);
      const opacity=s.muted?.2:1,width=s.emphasis?Math.max(strokeWidth,2.2):strokeWidth,dash=s.dash?` stroke-dasharray="${s.dash}"`:"";
      const lines=segments.map(g=>`<polyline data-series="${s.id||j}" points="${g.map(q=>`${x(q.i)},${y(q.v)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity}"${dash} stroke-linecap="round" stroke-linejoin="round"/>`).join("");
      const dots=s.values.map((v,i)=>finite(v)?`<circle data-series="${s.id||j}" cx="${x(i)}" cy="${y(Number(v))}" r="${s.emphasis?Math.max(dotRadius,2.8):dotRadius}" fill="${color}" opacity="${opacity}" stroke="#fff" stroke-width="1"><title>${dates[i]} ${s.name||""} ${metricFormat(v,metric)}</title></circle>`:"").join("");
      const last=[...s.values].map((v,i)=>({v,i})).filter(q=>finite(q.v)).at(-1);
      const tag=labels&&last?`<text x="${Math.min(x(last.i)+7,w-55)}" y="${y(Number(last.v))-7}" font-size="10" font-weight="700" fill="${color}">${fmt(Number(last.v))}</text>`:"";
      return lines+dots+tag;
    }).join("");
    const step=Math.max(1,Math.ceil(dates.length/8));
    const dateLabels=dates.map((d,i)=>(i%step===0||i===dates.length-1)?`<text x="${x(i)}" y="${h-7}" text-anchor="middle" font-size="10" fill="#667085">${d.slice(5)}</text>`:"").join("");
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${aria}">${grid}${zero}${paths}${dateLabels}</svg>`;
  }
  function flowComboChart(series,dates){
    const values=series.values.map(v=>finite(v)?Number(v):null),changes=values.map((v,i)=>v===null||i===0||values[i-1]===null?null:v-values[i-1]);
    if(!values.some(finite))return `<div class="chart-empty">该日之前没有可用的板块资金数据</div>`;
    const w=760,h=240,p={l:58,r:58,t:34,b:34},iw=w-p.l-p.r,ih=h-p.t-p.b,n=Math.max(dates.length,1),left=symmetricScale(values),right=symmetricScale(changes);
    const x=i=>n===1?w/2:p.l+i*iw/(n-1),yLeft=v=>p.t+(left.high-v)*ih/(left.high-left.low),yRight=v=>p.t+(right.high-v)*ih/(right.high-right.low),zeroY=yLeft(0),barWidth=Math.max(7,Math.min(22,iw/Math.max(n,1)*.48));
    const grid=left.ticks.map((v,i)=>`<g><line x1="${p.l}" y1="${yLeft(v)}" x2="${w-p.r}" y2="${yLeft(v)}" stroke="#e5eaf0"/><text x="4" y="${yLeft(v)+4}" font-size="10" fill="#98a2b3">${metricFormat(v,"mainNet",true)}</text><text x="${w-4}" y="${yLeft(v)+4}" text-anchor="end" font-size="10" fill="#7655D8">${metricFormat(right.ticks[i],"mainNet",true)}</text></g>`).join("");
    const bars=values.map((v,i)=>{if(v===null)return "";const top=Math.min(yLeft(v),zeroY),height=Math.max(1,Math.abs(yLeft(v)-zeroY)),fill=v>=0?"#C94A43":"#2F7D68";return `<rect x="${x(i)-barWidth/2}" y="${top}" width="${barWidth}" height="${height}" rx="2" fill="${fill}" opacity=".62"><title>${dates[i]} 当日主力净额 ${metricFormat(v,"mainNet")}；较前日变化 ${metricFormat(changes[i],"mainNet")}</title></rect>`}).join("");
    const segments=[];let points=[];changes.forEach((v,i)=>{if(finite(v))points.push({v:Number(v),i});else if(points.length){segments.push(points);points=[]}});if(points.length)segments.push(points);
    const changeColor="#7655D8",line=segments.map(g=>`<polyline points="${g.map(q=>`${x(q.i)},${yRight(q.v)}`).join(" ")}" fill="none" stroke="${changeColor}" stroke-width="2" stroke-dasharray="5 3" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
    const dots=changes.map((v,i)=>finite(v)?`<circle cx="${x(i)}" cy="${yRight(Number(v))}" r="2.6" fill="${changeColor}" stroke="#fff" stroke-width="1"><title>${dates[i]} 较前日变化 ${metricFormat(v,"mainNet")}</title></circle>`:"").join("");
    const step=Math.max(1,Math.ceil(dates.length/8)),dateLabels=dates.map((d,i)=>(i%step===0||i===dates.length-1)?`<text x="${x(i)}" y="${h-7}" text-anchor="middle" font-size="10" fill="#667085">${d.slice(5)}</text>`:"").join("");
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${series.name}主力净额及较前日变化"><g font-size="10"><text x="${p.l}" y="12" fill="#667085">左轴·当日净额</text><text x="${w-p.r}" y="12" text-anchor="end" fill="${changeColor}">右轴·较前日变化</text><rect x="${p.l}" y="19" width="12" height="8" rx="2" fill="#C94A43" opacity=".62"/><text x="${p.l+17}" y="27" fill="#667085">净流入</text><rect x="${p.l+58}" y="19" width="12" height="8" rx="2" fill="#2F7D68" opacity=".62"/><text x="${p.l+75}" y="27" fill="#667085">净流出</text><line x1="${p.l+118}" y1="23" x2="${p.l+134}" y2="23" stroke="${changeColor}" stroke-width="2" stroke-dasharray="5 3"/><text x="${p.l+140}" y="27" fill="#667085">较前日变化</text></g>${grid}<line x1="${p.l}" y1="${zeroY}" x2="${w-p.r}" y2="${zeroY}" stroke="#667085" stroke-width="1.5"/>${bars}${line}${dots}${dateLabels}</svg>`;
  }
  function sectorSummary(metric,selected,parent,chosen,dates,current){
    const target=$("sectorSummary");if(!target)return;
    if(chosen.length===1){
      const g=chosen[0],values=dates.map(date=>D.sectorFlow?.[date]?.[g.id]?.[metric]??null),valid=values.filter(finite).map(Number),today=valid.at(-1),prev=valid.length>1?valid.at(-2):null,delta=finite(today)&&finite(prev)?today-prev:null,last5=valid.slice(-5);
      const cards=[
        ["当日",metricFormat(today,metric)],
        ["较前日",finite(delta)?metricFormat(delta,metric):"—"],
        [metric==="mainNet"?"近5日累计":"近5日均值",last5.length?metricFormat(metric==="mainNet"?last5.reduce((a,v)=>a+v,0):last5.reduce((a,v)=>a+v,0)/last5.length,metric):"—"],
        [metric==="mainNet"?"近5日流入":"有效天数",metric==="mainNet"?`${last5.filter(v=>v>0).length}/${last5.length} 日`:`${last5.length} 日`]
      ];
      target.innerHTML=cards.map(([label,value])=>`<div><span>${label}</span><b>${value}</b></div>`).join("");
      return;
    }
    const finiteCurrent=current.filter(x=>finite(x.v));
    const strongest=finiteCurrent[0],weakest=finiteCurrent.at(-1);
    target.innerHTML=strongest&&weakest?`<div class="sector-summary-wide"><span>当日最强</span><b>${strongest.g.name} ${metricFormat(strongest.v,metric)}</b></div><div class="sector-summary-wide"><span>当日最弱</span><b>${weakest.g.name} ${metricFormat(weakest.v,metric)}</b></div>`:"";
  }
  function renderSector(d){
    const cfg=D.sectorFlowConfig;if(!cfg)return;
    const metric=$("sectorMetricSelect").value||cfg.defaultMetric,selected=$("sectorSelect").value||"all",dates=D.dates.filter(x=>x<=d);
    const parent=cfg.groups.find(g=>g.id===selected||g.subgroups?.some(s=>s.id===selected));
    const chosen=selected==="all"?cfg.groups:selected===parent?.id?(parent.subgroups||[parent]):parent?.subgroups?.filter(s=>s.id===selected)||[];
    const currentUnsorted=chosen.map(g=>({g,v:D.sectorFlow?.[d]?.[g.id]?.[metric]})),ranked=currentUnsorted.filter(x=>finite(x.v)).sort((a,b)=>Number(b.v)-Number(a.v));
    const highlightIds=new Set(selected==="all"?[...ranked.slice(0,3),...ranked.slice(-3)].map(x=>x.g.id):chosen.map(g=>g.id));
    const dashes=["","7 3","2 3","10 3 2 3","4 3"];
    const series=chosen.map((g,i)=>({id:g.id,name:g.name,color:g.color,values:dates.map(date=>D.sectorFlow?.[date]?.[g.id]?.[metric]??null),emphasis:highlightIds.has(g.id),muted:selected==="all"&&!highlightIds.has(g.id),dash:selected!=="all"&&chosen.length>1?dashes[i%dashes.length]:""}));
    $("sectorTrend").innerHTML=metric==="mainNet"&&chosen.length===1?flowComboChart(series[0],dates):chart(series,dates,{metric,includeZero:metric==="mainNet",labels:chosen.length===1,strokeWidth:1.4,dotRadius:2.2,aria:`板块${cfg.metrics.find(x=>x.id===metric)?.name||"资金"}趋势`});
    const legendItems=selected==="all"?cfg.groups:selected===parent?.id?(parent.subgroups||[parent]):chosen;
    const current=legendItems.map(g=>({g,v:D.sectorFlow?.[d]?.[g.id]?.[metric]})).sort((a,b)=>(finite(b.v)?Number(b.v):-Infinity)-(finite(a.v)?Number(a.v):-Infinity));
    sectorSummary(metric,selected,parent,chosen,dates,current);
    $("sectorLegend").innerHTML=current.map(({g,v})=>`<button type="button" data-sector="${g.id}" class="sector-key ${selected===g.id?"is-active":""}"><i style="background:${g.color}"></i><span>${g.name}</span><b>${metricFormat(v,metric)}</b></button>`).join("");
    const meta=cfg.metrics.find(x=>x.id===metric),missing=current.filter(x=>!finite(x.v)).length;
    const scope=selected==="all"?"默认突出当日净流入前三与净流出前三；点击任一总方向可下钻细分。":selected===parent?.id?`${parent.name}已按细分方向拆解，并用线型辅助区分。`:`当前查看 ${chosen[0]?.name||"细分方向"}。${metric==="mainNet"?"柱体为当日净额，虚线为较前一交易日变化，分别使用左右纵轴。":""}`;
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
