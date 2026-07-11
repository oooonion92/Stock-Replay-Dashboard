(()=>{
  const D=window.REPLAY_DATA,$=id=>document.getElementById(id);
  const C=["#275d85","#16865a","#b7791f","#8b5cf6","#c53b32"];
  const L={pending:"待后验",supported:"支持",mixed:"部分支持",falsified:"未证实"};
  const cls=v=>v>=65?"score-good":v>=35?"score-neutral":"score-risk";
  function chart(series,dates){
    const w=700,h=210,p=42,iw=w-p*2,ih=h-p*2,n=Math.max(dates.length,1);
    const x=i=>n===1?w/2:p+i*iw/(n-1),y=v=>24+(100-v)*ih/100;
    const grid=[0,25,50,75,100].map(v=>`<g><line x1="${p}" y1="${y(v)}" x2="${w-p}" y2="${y(v)}" stroke="#e5eaf0"/><text x="8" y="${y(v)+4}" font-size="11" fill="#98a2b3">${v}</text></g>`).join("");
    const paths=series.map((s,j)=>{
      const color=s.color||C[j],segments=[];let points=[];
      s.values.forEach((v,i)=>{if(Number.isFinite(v))points.push({v,i});else if(points.length){segments.push(points);points=[]}});
      if(points.length)segments.push(points);
      const lines=segments.map(group=>`<polyline points="${group.map(q=>`${x(q.i)},${y(q.v)}`).join(" ")}" fill="none" stroke="${color}" stroke-width="3"/>`).join("");
      const dots=s.values.map((v,i)=>Number.isFinite(v)?`<circle cx="${x(i)}" cy="${y(v)}" r="4" fill="${color}"/><text x="${x(i)}" y="${y(v)-9}" text-anchor="middle" font-size="10" fill="${color}">${v}</text>`:"").join("");
      return lines+dots;
    }).join("");
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="历史评分趋势">${grid}${paths}${dates.map((d,i)=>`<text x="${x(i)}" y="${h-5}" text-anchor="middle" font-size="10" fill="#667085">${d.slice(5)}</text>`).join("")}</svg>`;
  }
  function render(d){
    const R=D.reports[d],M=R.market,A=D.dates.filter(x=>x<=d);
    $("marketTotal").textContent=M.total;$("marketStatus").textContent=M.status;$("marketSummary").textContent=M.summary;
    $("sentimentScore").textContent=M.sentiment;$("technicalScore").textContent=M.technical;$("fullReportLink").href=R.fullReport;
    $("pathCards").innerHTML=M.paths.map(p=>`<div class="path-card path-${p.tone}"><b>${p.title}</b><span>${p.text}</span></div>`).join("");
    $("historyCount").textContent=`${A.length} 个可比交易日`;
    $("marketTrend").innerHTML=chart([{values:A.map(x=>D.reports[x].market.total)}],A);
    $("trendNote").textContent="总分越高代表环境越有利，但总闸与结构约束仍优先。标的曲线断开表示该日未纳入观察池，非 0 分。";
    $("stockTrend").innerHTML=chart(R.stocks.map((s,i)=>({color:C[i],values:A.map(x=>{const q=D.reports[x].stocks.find(q=>q.symbol===s.symbol);return q?.total??null})})),A);
    const prev=A.length>1?D.reports[A[A.length-2]]:null;
    $("stockRows").innerHTML=R.stocks.map(s=>{
      const q=prev?.stocks.find(x=>x.symbol===s.symbol),delta=q?s.total-q.total:null;
      return `<tr><td data-label="标的"><span class="name-cell"><b>${s.name}</b><small>${s.symbol}</small></span></td><td data-label="总分"><span class="score-badge ${cls(s.total)}">${s.total}</span></td><td data-label="较前日" class="delta-flat">${delta===null?"数据缺口":`${delta>0?"+":""}${delta}`}</td><td data-label="结构">${s.structure}</td><td data-label="承接">${s.support}</td><td data-label="相对强弱">${s.relative}</td><td data-label="风险安全">${s.risk}</td><td data-label="状态">${s.status}</td></tr>`;
    }).join("");
    const N=R.experts.reduce((a,q)=>(a[q.result]=(a[q.result]||0)+1,a),{});
    $("validationStats").innerHTML=Object.entries(L).map(([k,v])=>`<span>${v} ${N[k]||0}</span>`).join("");
    $("expertCards").innerHTML=R.experts.map(q=>{
      const detail=q.result==="pending"?`验证条件：${q.test||"等待后续交易日数据。"}`:`后验结果：${q.evidence||"未记录可核验依据。"}`;
      return `<article class="expert-card"><div class="expert-meta"><b>${q.tag}</b><span>${q.source}</span></div><blockquote>“${q.quote}”</blockquote><p><b>交易含义：</b>${q.meaning}</p><div class="validation-box"><strong>${L[q.result]||"待标注"}</strong><span>${detail}</span></div>${q.url?`<a href="${q.url}" target="_blank" rel="noopener noreferrer">查看原帖</a>`:""}</article>`;
    }).join("");
  }
  D.dates.slice().reverse().forEach(d=>{const o=document.createElement("option");o.value=d;o.textContent=d;$("dateSelect").appendChild(o)});
  $("dateSelect").addEventListener("change",e=>render(e.target.value));render(D.dates[D.dates.length-1]);
})();
