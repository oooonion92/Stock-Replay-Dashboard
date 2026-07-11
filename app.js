(()=>{
  const D=window.REPLAY_DATA,$=id=>document.getElementById(id);
  const sheet=document.createElement("link");sheet.rel="stylesheet";sheet.href="overrides.css";document.head.appendChild(sheet);
  const C=["#2b638f","#18865f","#b7791f","#7655d8","#c53b32"];
  const L={pending:"待后验",supported:"支持",mixed:"部分支持",falsified:"未证实"};
  const cls=v=>v>=65?"score-good":v>=35?"score-neutral":"score-risk";
  const domain=series=>{
    const values=series.flatMap(s=>s.values).filter(Number.isFinite);
    const lo=Math.min(...values),hi=Math.max(...values),span=Math.max(hi-lo,10);
    const unit=span<=25?5:10,low=Math.max(0,Math.floor((lo-span*.16)/unit)*unit),high=Math.min(100,Math.ceil((hi+span*.16)/unit)*unit);
    return low===high?[Math.max(0,low-unit),Math.min(100,high+unit)]:[low,high];
  };
  function chart(series,dates,{labels=false}={}){
    const w=700,h=210,p={l:43,r:22,t:22,b:30},iw=w-p.l-p.r,ih=h-p.t-p.b,n=Math.max(dates.length,1),[low,high]=domain(series);
    const x=i=>n===1?w/2:p.l+i*iw/(n-1),y=v=>p.t+(high-v)*ih/(high-low);
    const grid=Array.from({length:5},(_,i)=>low+(high-low)*i/4).map(v=>`<g><line x1="${p.l}" y1="${y(v)}" x2="${w-p.r}" y2="${y(v)}" stroke="#e5eaf0"/><text x="4" y="${y(v)+4}" font-size="11" fill="#98a2b3">${Number.isInteger(v)?v:v.toFixed(1)}</text></g>`).join("");
    const paths=series.map((s,j)=>{
      const color=s.color||C[j],segments=[];let points=[];
      s.values.forEach((v,i)=>{if(Number.isFinite(v))points.push({v,i});else if(points.length){segments.push(points);points=[]}});
      if(points.length)segments.push(points);
      const lines=segments.map(g=>`<polyline points="${g.map(q=>`${x(q.i)},${y(q.v)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>`).join("");
      const dots=s.values.map((v,i)=>Number.isFinite(v)?`<circle cx="${x(i)}" cy="${y(v)}" r="3.6" fill="${color}" stroke="#fff" stroke-width="1.5"/>`:"").join("");
      const last=[...s.values].map((v,i)=>({v,i})).filter(q=>Number.isFinite(q.v)).at(-1);
      const tag=labels&&last?`<text x="${x(last.i)+7}" y="${y(last.v)-7-(j%3)*11}" font-size="10" font-weight="700" fill="${color}">${last.v}</text>`:"";
      return lines+dots+tag;
    }).join("");
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="历史评分趋势">${grid}${paths}${dates.map((d,i)=>`<text x="${x(i)}" y="${h-6}" text-anchor="middle" font-size="10" fill="#667085">${d.slice(5)}</text>`).join("")}</svg>`;
  }
  function render(d){
    const R=D.reports[d],M=R.market,A=D.dates.filter(x=>x<=d),recent=A.slice(-3).reverse();
    $("marketTotal").textContent=M.total;$("marketStatus").textContent=M.status;$("marketSummary").textContent=M.summary;
    $("sentimentScore").textContent=M.sentiment;$("technicalScore").textContent=M.technical;$("fullReportLink").href=R.fullReport;
    $("pathCards").innerHTML=M.paths.map(p=>`<div class="path-card path-${p.tone}"><b>${p.title}</b><span>${p.text}</span></div>`).join("");
    $("historyCount").textContent=`${A.length} 个可比交易日`;
    $("marketTrend").innerHTML=chart([{values:A.map(x=>D.reports[x].market.total)}],A,{labels:true});
    $("trendNote").textContent="纵轴按当前可比区间自动缩放；总分越高代表环境越有利，但总闸与结构约束仍优先。";
    $("stockTrend").innerHTML=chart(R.stocks.map((s,i)=>({color:C[i],values:A.map(x=>D.reports[x].stocks.find(q=>q.symbol===s.symbol)?.total??null)})),A,{labels:true});
    const prev=A.length>1?D.reports[A[A.length-2]]:null;
    $("stockRows").innerHTML=R.stocks.map(s=>{
      const q=prev?.stocks.find(x=>x.symbol===s.symbol),delta=q?s.total-q.total:null;
      return `<tr><td data-label="标的"><span class="name-cell"><b>${s.name}</b><small>${s.symbol}</small></span></td><td data-label="总分"><span class="score-badge ${cls(s.total)}">${s.total}</span></td><td data-label="较前日" class="delta-flat">${delta===null?"数据缺口":`${delta>0?"+":""}${delta}`}</td><td data-label="结构">${s.structure}</td><td data-label="承接">${s.support}</td><td data-label="相对强弱">${s.relative}</td><td data-label="风险安全">${s.risk}</td><td data-label="状态">${s.status}</td></tr>`;
    }).join("");
    const claims=recent.flatMap(date=>D.reports[date].experts.map(q=>({...q,date})),),N=claims.reduce((a,q)=>(a[q.result]=(a[q.result]||0)+1,a),{});
    $("validationStats").innerHTML=Object.entries(L).map(([k,v])=>`<span>${v} ${N[k]||0}</span>`).join("");
    $("expertCards").innerHTML=claims.map(q=>{
      const detail=q.result==="pending"?`验证条件：${q.test||"等待后续交易日数据。"}`:`后验结果：${q.evidence||"未记录可核验依据。"}`;
      return `<article class="expert-card"><div class="expert-meta"><b>${q.tag}</b><span>${q.date} · ${q.source}</span></div><blockquote>“${q.quote}”</blockquote><p><b>交易含义：</b>${q.meaning}</p><div class="validation-box"><strong>${L[q.result]||"待标注"}</strong><span>${detail}</span></div>${q.url?`<a href="${q.url}" target="_blank" rel="noopener noreferrer">查看原帖</a>`:""}</article>`;
    }).join("");
  }
  D.dates.slice().reverse().forEach(d=>{const o=document.createElement("option");o.value=d;o.textContent=d;$("dateSelect").appendChild(o)});
  $("dateSelect").addEventListener("change",e=>render(e.target.value));render(D.dates[D.dates.length-1]);
})();
