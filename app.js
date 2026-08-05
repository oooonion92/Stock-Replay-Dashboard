(()=>{
  const D=window.REPLAY_DATA,$=id=>document.getElementById(id);
  const sheet=document.createElement("link");sheet.rel="stylesheet";sheet.href="overrides.css";document.head.appendChild(sheet);
  const groupSheet=document.createElement("link");groupSheet.rel="stylesheet";groupSheet.href="expert-groups.css";document.head.appendChild(groupSheet);
  const C=["#2b638f","#18865f","#b7791f","#7655d8","#c53b32"];
  const L={pending:"待后验",supported:"支持",mixed:"部分支持",falsified:"未证实"};
  const cls=v=>v>=65?"score-good":v>=35?"score-neutral":"score-risk";
  const finite=v=>v!==null&&v!==""&&Number.isFinite(Number(v));
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let projectionTimeframe="30m";
  let projectionCheckpoint="close";
  let projectionEvidenceOpen=false;
  let expandedShortTheme=null;
  let expandedCapitalDirection=null;
  let activeCapitalObservation=null;
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
  function chart(series,dates,{labels=false,score=false,includeZero=false,metric="score",aria="趋势图",strokeWidth=3,dotRadius=3.6,bridgeMissing=false}={}){
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
      const bridges=bridgeMissing?segments.slice(1).map((g,k)=>{const from=segments[k].at(-1),to=g[0];return `<polyline data-series="${s.id||j}" points="${x(from.i)},${y(from.v)} ${x(to.i)},${y(to.v)}" fill="none" stroke="${color}" stroke-width="${width}" opacity="${opacity*.65}" stroke-dasharray="4 4" stroke-linecap="round"/>`;}).join(""):"";
      const dots=s.values.map((v,i)=>finite(v)?`<circle data-series="${s.id||j}" cx="${x(i)}" cy="${y(Number(v))}" r="${s.emphasis?Math.max(dotRadius,2.8):dotRadius}" fill="${color}" opacity="${opacity}" stroke="#fff" stroke-width="1"><title>${dates[i]} ${s.name||""} ${metricFormat(v,metric)}</title></circle>`:"").join("");
      const last=[...s.values].map((v,i)=>({v,i})).filter(q=>finite(q.v)).at(-1);
      const tag=labels&&last?`<text x="${Math.min(x(last.i)+7,w-55)}" y="${y(Number(last.v))-7}" font-size="10" font-weight="700" fill="${color}">${fmt(Number(last.v))}</text>`:"";
      return lines+bridges+dots+tag;
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
    const changeColor="#7655D8",line=segments.map(g=>`<polyline points="${g.map(q=>`${x(q.i)},${yRight(q.v)}`).join(" ")}" fill="none" stroke="${changeColor}" stroke-width="2" stroke-dasharray="5 3" stroke-linecap="round" stroke-linejoin="round"/>`).join(""),bridges=segments.slice(1).map((g,k)=>{const from=segments[k].at(-1),to=g[0];return `<polyline points="${x(from.i)},${yRight(from.v)} ${x(to.i)},${yRight(to.v)}" fill="none" stroke="${changeColor}" stroke-width="2" opacity=".5" stroke-dasharray="2 5" stroke-linecap="round"/>`;}).join("");
    const dots=changes.map((v,i)=>finite(v)?`<circle cx="${x(i)}" cy="${yRight(Number(v))}" r="2.6" fill="${changeColor}" stroke="#fff" stroke-width="1"><title>${dates[i]} 较前日变化 ${metricFormat(v,"mainNet")}</title></circle>`:"").join("");
    const step=Math.max(1,Math.ceil(dates.length/8)),dateLabels=dates.map((d,i)=>(i%step===0||i===dates.length-1)?`<text x="${x(i)}" y="${h-7}" text-anchor="middle" font-size="10" fill="#667085">${d.slice(5)}</text>`:"").join("");
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="${series.name}主力净额及较前日变化"><g font-size="10"><text x="${p.l}" y="12" fill="#667085">左轴·当日净额</text><text x="${w-p.r}" y="12" text-anchor="end" fill="${changeColor}">右轴·较前日变化</text><rect x="${p.l}" y="19" width="12" height="8" rx="2" fill="#C94A43" opacity=".62"/><text x="${p.l+17}" y="27" fill="#667085">净流入</text><rect x="${p.l+58}" y="19" width="12" height="8" rx="2" fill="#2F7D68" opacity=".62"/><text x="${p.l+75}" y="27" fill="#667085">净流出</text><line x1="${p.l+118}" y1="23" x2="${p.l+134}" y2="23" stroke="${changeColor}" stroke-width="2" stroke-dasharray="5 3"/><text x="${p.l+140}" y="27" fill="#667085">较前日变化</text></g>${grid}<line x1="${p.l}" y1="${zeroY}" x2="${w-p.r}" y2="${zeroY}" stroke="#667085" stroke-width="1.5"/>${bars}${line}${bridges}${dots}${dateLabels}</svg>`;
  }
  function sectorHeatmap(groups,dates,metric,expandedId=null){
    const rows=groups.flatMap(g=>[{g,parent:g.id,child:false},...(g.id===expandedId?(g.subgroups||[]).map(s=>({g:s,parent:g.id,child:true})):[])]),values=rows.flatMap(row=>dates.map(date=>D.sectorFlow?.[date]?.[row.g.id]?.[metric])).filter(finite).map(Number);
    if(!values.length)return `<div class="chart-empty">该日之前没有可用的板块资金数据</div>`;
    const signed=metric==="mainNet",max=Math.max(...values.map(v=>Math.abs(v)),1),w=760,rh=20,h=31+31+rows.length*rh,p={l:116,r:18,t:31,b:31},iw=w-p.l-p.r,cw=iw/Math.max(dates.length,1),dateStep=Math.max(1,Math.ceil(dates.length/8));
    const cells=rows.map((row,rowIndex)=>{const {g,child,parent}=row,y=p.t+rowIndex*rh,selected=expandedId===parent,clickable=!child?` data-heatmap-direction="${parent}" role="button" tabindex="0" aria-expanded="${selected}"`:"",rowClass=child?"sector-heatmap-child":"sector-heatmap-parent",fade=expandedId&&!selected?" opacity=\".26\"":"",isActive=activeCapitalObservation?.groupId===g.id,backdrop=selected?`<rect x="${p.l-104}" y="${y}" width="${iw+104}" height="${rh}" rx="3" fill="${child?"#f3f8fc":"#eaf3fb"}"/>`:"";return `<g class="${rowClass}${selected?" is-selected":""}"${clickable}${fade}>${backdrop}${dates.map((date,col)=>{
      const raw=D.sectorFlow?.[date]?.[g.id]?.[metric],activeCell=isActive&&activeCapitalObservation?.date===date?` stroke="#275d85" stroke-width="2"`:"";if(!finite(raw))return `<rect data-heatmap-observation data-heatmap-group="${g.id}" data-heatmap-date="${date}" x="${p.l+col*cw+1}" y="${y+1}" width="${Math.max(cw-2,1)}" height="${Math.max(rh-2,1)}" rx="2" fill="#f2f4f7"${activeCell}><title>${date} ${g.name} 数据缺失</title></rect>`;
      const v=Number(raw),strength=.16+.78*Math.sqrt(Math.abs(v)/max),fill=signed?(v>=0?"#C94A43":"#2F7D68"):"#2F77A8";
      return `<rect data-heatmap-observation data-heatmap-group="${g.id}" data-heatmap-date="${date}" x="${p.l+col*cw+1}" y="${y+1}" width="${Math.max(cw-2,1)}" height="${Math.max(rh-2,1)}" rx="2" fill="${fill}" opacity="${strength}"${activeCell}><title>${date} ${g.name} ${metricFormat(v,metric)}</title></rect>`;
    }).join("")}<text x="${p.l-7}" y="${y+rh/2+3}" text-anchor="end" font-size="${child?9:10}" font-weight="${child?400:700}" fill="${child?"#667085":"#475467"}">${child?`↳ ${g.name}`:g.name}</text></g>`;}).join("");
    const labels=dates.map((date,i)=>(i%dateStep===0||i===dates.length-1)?`<text x="${p.l+i*cw+cw/2}" y="${h-7}" text-anchor="middle" font-size="10" fill="#667085">${date.slice(5)}</text>`:"").join("");
    const legend=signed?`<text x="${p.l}" y="14" font-size="10" fill="#087443">净流出</text><rect x="${p.l+35}" y="7" width="42" height="7" rx="3" fill="#2F7D68" opacity=".68"/><text x="${p.l+84}" y="14" font-size="10" fill="#667085">绝对值越深，资金强度越高</text><rect x="${p.l+220}" y="7" width="42" height="7" rx="3" fill="#C94A43" opacity=".68"/><text x="${p.l+269}" y="14" font-size="10" fill="#b42318">净流入</text>`:`<text x="${p.l}" y="14" font-size="10" fill="#667085">颜色越深，数值越高</text>`;
    return `<svg viewBox="0 0 ${w} ${h}" role="img" aria-label="九大方向资金轮动热力图，点击方向行可展开细分">${legend}${cells}${labels}</svg>`;
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
    const metric=$("sectorMetricSelect").value||cfg.defaultMetric,dates=D.dates.filter(x=>x<=d),current=cfg.groups.map(g=>({g,v:D.sectorFlow?.[d]?.[g.id]?.[metric]})).sort((a,b)=>(finite(b.v)?Number(b.v):-Infinity)-(finite(a.v)?Number(a.v):-Infinity));
    $("sectorTrend").innerHTML=sectorHeatmap(cfg.groups,dates,metric,expandedCapitalDirection);
    $("sectorSummary").innerHTML="";
    const directionSnapshot=cfg.groups.map(g=>{
      const values=dates.map(date=>D.sectorFlow?.[date]?.[g.id]?.mainNet??null),valid=values.filter(finite).map(Number),today=D.sectorFlow?.[d]?.[g.id]?.mainNet??null,recent=valid.slice(-3),sum3=recent.length===3?recent.reduce((a,v)=>a+v,0):null;
      const state=!finite(today)||!finite(sum3)?"数据不足":Number(today)>0&&Number(sum3)>0?"持续回流":Number(today)>0?"单日回流":Number(today)<0&&Number(sum3)<0?"持续流出":"分歧";
      const tone=state==="持续回流"?"inflow":state==="单日回流"?"pulse":state==="持续流出"?"outflow":"mixed";
      return {g,v:today,sum3,state,tone};
    });
    const totalDirectionFlow=directionSnapshot.filter(item=>finite(item.v)).sort((a,b)=>Number(b.v)-Number(a.v));
    const ongoing=directionSnapshot.filter(item=>item.state==="持续回流"),positive=directionSnapshot.filter(item=>finite(item.v)&&Number(item.v)>0),strongest=totalDirectionFlow[0],expanded=cfg.groups.find(g=>g.id===expandedCapitalDirection);
    const branchText=expanded?(expanded.subgroups||[]).map(g=>{const values=dates.map(date=>D.sectorFlow?.[date]?.[g.id]?.mainNet??null),valid=values.filter(finite).map(Number),today=D.sectorFlow?.[d]?.[g.id]?.mainNet??null,recent=valid.slice(-3),sum3=recent.length===3?recent.reduce((a,v)=>a+v,0):null;return {g,today,sum3};}).sort((a,b)=>(finite(b.today)?Number(b.today):-Infinity)-(finite(a.today)?Number(a.today):-Infinity)):[];
    const observation=activeCapitalObservation&&expanded?.subgroups?.some(g=>g.id===activeCapitalObservation.groupId)?activeCapitalObservation:null,observedGroup=observation?expanded.subgroups.find(g=>g.id===observation.groupId):null,observedValue=observation&&observedGroup?D.sectorFlow?.[observation.date]?.[observedGroup.id]?.mainNet:null;
    $("capitalDecision").innerHTML=totalDirectionFlow.length?`<div class="capital-summary"><div><span>当日流入</span><b>${positive.length}/${cfg.groups.length} 个</b></div><div><span>持续回流</span><b>${ongoing.length} 个</b></div><div><span>当日最强</span><b>${esc(strongest?.g.name||"—")}</b></div></div>${expanded?`<div class="capital-branch-text"><div class="capital-branch-text-head"><b>${esc(expanded.name)} · 细分明细</b><span>点击热力格查看具体日期</span></div>${observedGroup?`<div class="capital-observation"><span>${esc(observation.date)} · ${esc(observedGroup.name)}</span><b>${esc(metricFormat(observedValue,"mainNet"))}</b></div>`:""}<div class="capital-branch-list">${branchText.map(item=>`<button type="button" data-capital-branch="${item.g.id}"><i style="background:${item.g.color}"></i><span>${esc(item.g.name)}</span><b>${esc(metricFormat(item.today,"mainNet"))}</b><small>近3日 ${esc(metricFormat(item.sum3,"mainNet"))}</small></button>`).join("")}</div></div>`:""}`:"<span class=\"sector-insight-empty\">该日主力净额字段不可用</span>";
    $("sectorMatrix").innerHTML=directionSnapshot.map(item=>`<button type="button" class="sector-matrix-item ${item.tone} ${expandedCapitalDirection===item.g.id?"is-active":""}" data-direction="${item.g.id}" aria-expanded="${expandedCapitalDirection===item.g.id}"><i style="background:${item.g.color}"></i><span>${esc(item.g.name)}</span><b>${esc(metricFormat(item.v,"mainNet"))}</b><small>近3日 ${esc(metricFormat(item.sum3,"mainNet"))}</small><em>${esc(item.state)}</em></button>`).join("");
    $("sectorLegend").innerHTML="";
    const meta=cfg.metrics.find(x=>x.id===metric),missingDates=dates.filter(date=>!cfg.groups.some(g=>finite(D.sectorFlow?.[date]?.[g.id]?.[metric]))).map(date=>date.slice(5));
    $("sectorNote").textContent=`${meta.name} · ${meta.unit}；区间与市场评分日期一致。${metric==="mainNet"?"主力净额沿用全A数据源口径。":""}点击热力图中的方向行，可在该行下方展开细分方向热力图；再次点击收起。${missingDates.length?` ${missingDates.join("、")} 源数据缺失。`:""}`;
  }
  const pct=v=>finite(v)?`${Number(v).toFixed(2).replace(/\.00$/,"")}%`:"—";
  const signedPct=v=>finite(v)?`${Number(v)>0?"+":""}${Number(v).toFixed(2).replace(/\.00$/,"")}%`:"—";
  const shortMetric=(label,value,kind="normal")=>`<div class="short-term-metric ${kind}"><span>${esc(label)}</span><b>${esc(value)}</b></div>`;
  function shortEmotionScore(item){
    const e=item?.emotion||{},p=item?.promotion||{},f=item?.feedback||{},q=f.quality||{},sealed=q.sealedAgain||{},broken=q.brokenUnsealed||{},sealQ=item?.sealQuality||{};
    const sample=Number(f.sample)||0,median=Number(f.median)||0,positive=Number(f.positiveRate)||0,sealedRate=sample?(Number(sealed.count)||0)/sample*100:0,brokenRate=sample?(Number(broken.count)||0)/sample*100:0,lowReturn=Number(q.lowReturnRate)||0,reclosed=Number(q.reclosedAfterBreakRate)||0;
    let prior=0;
    if(median>0&&positive>=50){
      prior=(median>=4?2:median>=2?1:0)+(positive>=70?4:positive>=60?3:2)+(sealedRate>=30?5:sealedRate>=20?3:sealedRate>=15?2:sealedRate>=10?1:0)+(lowReturn<=30?4:lowReturn<=45?2:0)+(brokenRate<=5&&reclosed<=35?3:brokenRate<=10&&reclosed<=50?1:0)+(Number(p.oneToTwo)>=30?3:Number(p.oneToTwo)>=20?2:Number(p.oneToTwo)>=10?1:0);
    }
    const sealRate=Number(e.sealRate)||0,sealBreakRate=Number(sealQ.sealedWithBreakRate)||0,avgBreaks=Number(sealQ.averageBreaksOnSealed)||0,oneToTwo=Number(p.oneToTwo)||0,dt=Number(e.dt)||0;
    const sealing=(sealRate>=80?10:sealRate>=70?8:sealRate>=60?6:sealRate>=50?3:0)+(sealBreakRate<=20?5:sealBreakRate<=35?3:sealBreakRate<=45?1:0)+(avgBreaks<=.5?5:avgBreaks<=1.2?3:avgBreaks<=2?1:0)+(oneToTwo>=30?3:oneToTwo>=20?2:oneToTwo>=10?1:0)+(dt===0?2:dt<=10?1:0);
    return {prior:Math.min(25,prior),sealing:Math.min(25,sealing),total:Math.min(50,prior)+Math.min(25,sealing),detail:{sample,median,positive,sealedRate,brokenRate,lowReturn,reclosed,sealRate,sealBreakRate,avgBreaks,oneToTwo,dt}};
  }
  function scoreDisplay(market,item){
    if(!item?.feedback?.quality||!item?.sealQuality)return {...market,shortTerm:false};
    const shortScore=shortEmotionScore(item),technical=Number(market.technical)||0;
    const total=shortScore.total+technical;
    const status=total>=60?"可试错环境":total>=40?"震荡观察":"防守环境";
    return {...market,total,sentiment:shortScore.total,status,shortTerm:true,shortTermDetail:shortScore};
  }
  function shortTermState(item){
    const {emotion:e,promotion:p,feedback:f}=item;
    if(Number(e.dt)>Number(e.zt)||Number(f.median)<=-1)return {tone:"risk",title:"短线风险释放",detail:"跌停或昨日强势股亏钱效应占主导，先看风险出清，不以盘中反抽替代接力修复。"};
    if(Number(e.breakRate)>=50||Number(p.oneToTwo)<20){
      const sealText=Number(e.sealRate)>=60?`封板率${pct(e.sealRate)}已稳定，但`:`封板稳定性不足，且`;
      return {tone:"caution",title:"热度高 · 接力偏弱",detail:`${sealText}1进2仅${pct(p.oneToTwo)}；高度与首板数量未形成中低位梯队接力，优先观察核心承接，不追扩散首板。`};
    }
    if(Number(f.median)>0&&Number(p.oneToTwo)>=20&&Number(e.sealRate)>=60)return {tone:"positive",title:"接力生态改善",detail:"封板、晋级与昨日强势股反馈同步转强，可把指数修复中的核心方向纳入进攻观察。"};
    return {tone:"neutral",title:"短线生态观察",detail:"热度、接力和反馈尚未形成一致方向，按个股承接与梯队完整度筛选。"};
  }
  function renderShortTerm(d){
    const item=D.shortTerm?.[d],content=$("shortTermContent"),empty=$("shortTermUnavailable"),source=$("shortTermSource");
    if(!item||item.state!=="complete"){
      content.hidden=true;empty.hidden=false;source.textContent="收盘池数据未接入";
      empty.textContent="该历史日期尚未采集短线收盘池，不使用全市场阈值数据倒推。";
      return;
    }
    content.hidden=false;empty.hidden=true;source.textContent=D.themeRelay?.[d]?.source||item.source||"收盘快照";
    const {emotion:e,promotion:p,feedback:f,ladder=[]}=item,state=shortTermState(item);
    $("shortTermVerdict").className=`short-term-verdict ${state.tone}`;
    $("shortTermVerdict").innerHTML=`<b>${esc(state.title)}</b><span>${esc(state.detail)}</span>`;
    $("shortTermEmotion").innerHTML=[
      shortMetric("涨停",e.zt,"up"),shortMetric("炸板",e.zb,"down"),shortMetric("跌停",e.dt,"down"),
      shortMetric("封板率",pct(e.sealRate),Number(e.sealRate)>=60?"up":"down"),shortMetric("炸板率",pct(e.breakRate),Number(e.breakRate)>=50?"down":"normal"),shortMetric("首板",e.firstBoard,"normal")
    ].join("");
    const relayCards=[
      ["最高板",`${e.maxBoards} 板`],["连板",`${e.lianban} 只`],["1进2",`${pct(p.oneToTwo)} (${p.oneToTwoNumerator}/${p.oneToTwoDenominator})`],["2进3",pct(p.twoToThree)],["3板以上",pct(p.threePlus)]
    ];
    $("shortTermRelay").innerHTML=relayCards.map(([label,value])=>`<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join("");
    $("shortTermLadder").innerHTML=ladder.map(row=>`<div class="ladder-chip"><b>${esc(row.level)}板</b><span>${esc(row.names?.length?row.names.join("、"):`${row.count}只`)}</span><em>${esc(row.count)}只</em></div>`).join("")||"<span class=\"short-term-empty\">暂无连板梯队</span>";
    const themeSnapshot=D.themeRelay?.[d],themes=themeSnapshot?.themes||[];
    if(!themes.some(row=>row.name===expandedShortTheme))expandedShortTheme=null;
    const detailMarkup=row=>{
      const stocks=row.stocks||[];
      const sealAmount=stock=>finite(stock.sealAmount)?`${(Number(stock.sealAmount)/1e8).toFixed(2)}亿`:"—";
      const high=stocks.filter(stock=>Number(stock.boards)>=2).map(stock=>`${stock.boards}板 ${stock.name}`).join(" · ")||"暂无连板";
      const rows=stocks.map(stock=>`<tr><td><span class="short-term-stock-kind limit-up">涨停</span></td><td><b>${esc(stock.name)}</b><small>${esc(stock.code)} · ${esc(stock.subtype||"其他")}</small></td><td>${esc(stock.boards?`${stock.boards}板`:"首板")}</td><td>${esc(stock.firstSeal||"—")}</td><td>${esc(stock.lastSeal||"—")}</td><td>${sealAmount(stock)}</td><td>${esc(stock.breaks)}次</td><td class="short-term-theme-reason">${esc(stock.reason||"—")}</td></tr>`).join("");
      const mobileRows=stocks.map(stock=>`<div class="short-term-mobile-stock"><div class="short-term-mobile-stock-head"><span class="short-term-stock-kind limit-up">涨停</span><span class="short-term-mobile-stock-name"><b>${esc(stock.name)}</b><small>${esc(stock.code)} · ${esc(stock.subtype||"其他")}</small></span><em>${esc(stock.boards?`${stock.boards}板`:"首板")}</em></div><div class="short-term-mobile-stock-meta"><span>首封 <b>${esc(stock.firstSeal||"—")}</b></span><span>末封 <b>${esc(stock.lastSeal||"—")}</b></span><span>封单 <b>${sealAmount(stock)}</b></span><span>开板 <b>${esc(stock.breaks)}次</b></span></div><p class="short-term-mobile-reason">${esc(stock.reason||"—")}</p></div>`).join("");
      const hidden=Math.max(0,Number(row.limitUps)-stocks.length);
      return `<div class="short-term-industry-detail short-term-theme-detail"><div class="short-term-detail-head"><b>${esc(row.name)} · 高标：${esc(high)}</b><button type="button" data-short-theme-close>收起</button></div><div class="short-term-theme-detail-note">AI按当日涨停池、连板梯队、封板节奏及可核对的标的属性归并；主线内收盘涨停股日内开板 ${esc(row.opened)} 只 / ${esc(row.openTimes)} 次。</div><div class="short-term-detail-scroll"><table><thead><tr><th>状态</th><th>标的 / 子方向</th><th>梯队</th><th>首封</th><th>末封</th><th>封单</th><th>开板</th><th>AI归类依据</th></tr></thead><tbody>${rows||'<tr><td colspan="8">该主线暂无逐股明细</td></tr>'}</tbody></table></div><div class="short-term-detail-mobile">${mobileRows||'<span class="short-term-empty">该主线暂无逐股明细</span>'}</div>${hidden?`<p class="short-term-theme-more">其余 ${hidden} 只首板已纳入统计，当前明细优先展示高标、连板与较早封板股。</p>`:""}</div>`;
    };
    $("shortTermThemeRelay").innerHTML=themes.length?`${themes.map(row=>`<button type="button" class="short-term-industry-row short-term-theme-row ${row.name===expandedShortTheme?"is-active":""}" data-short-theme="${esc(row.name)}" aria-expanded="${row.name===expandedShortTheme}"><b>${esc(row.name)}</b><span>涨停 ${esc(row.limitUps)} · 首板 ${esc(row.firstBoards)} · 最高 ${esc(row.maxBoards)}板</span><em>开板 ${esc(row.opened)}只/${esc(row.openTimes)}次</em></button>${row.name===expandedShortTheme?detailMarkup(row):""}`).join("")}<p class="short-term-theme-note">其余 ${esc(themeSnapshot.unclustered)} 只涨停分散于消费、资源、医药等方向，未强行归为主线。题材统计不计入市场评分。</p>`:"<span class=\"short-term-empty\">该日期尚未完成 AI 主线归类；不会以行业分类替代主线归因。</span>";
    $("shortTermFeedback").innerHTML=[
      ["样本",`${f.sample}只`],["中位收益",signedPct(f.median)],["平均收益",signedPct(f.average)],["翻红率",pct(f.positiveRate)],["再涨停",pct(f.limitUpAgainRate)],["跌超5%",`${f.deepLoss5}只`],["最差",signedPct(f.worst)]
    ].map(([label,value])=>`<div><span>${esc(label)}</span><b>${esc(value)}</b></div>`).join("");
  }
  const projectionPathTable=rows=>{
    if(!rows?.length)return `<div class="path-table-empty">该周期暂无可用路径条件</div>`;
    const body=rows.map(row=>`<tr class="path-stage-${esc(row.tone||"neutral")}"><th scope="row">${esc(row.stage||"—")}</th><td><span>可观察条件</span>${esc(row.condition||"—")}</td><td><span>判断</span>${esc(row.judgment||"—")}</td></tr>`).join("");
    return `<div class="dashboard-path-table-wrap"><table class="dashboard-path-table"><thead><tr><th>路径阶段</th><th>可观察条件</th><th>判断</th></tr></thead><tbody>${body}</tbody></table></div>`;
  };
  const projectionScenarioTable=rows=>{
    if(!rows?.length)return `<div class="path-table-empty">该周期暂无可用路径条件</div>`;
    return `<div class="dashboard-scenario-grid">${rows.map(row=>`<article class="dashboard-scenario-card ${esc(row.tone||"neutral")}"><header><b>${esc(row.label||"—")}</b><span>${esc(row.priceCondition||"—")}</span></header><p><small>结构</small><span>${esc(row.strokeCondition||"—")}</span></p><p><small>执行</small><span>${esc(row.decision||"—")}</span></p><details><summary>MACD 证据</summary><span>${esc(row.macdCondition||"—")}</span></details></article>`).join("")}</div>`;
  };
  function renderProjection(d){
    const projection=D.reports[d]?.market?.pathProjection;
    const content=$("projectionContent"),empty=$("projectionUnavailable");
    if(!projection||!["multi-timeframe-path-v1","multi-timeframe-path-v2","multi-timeframe-native-chan-v3"].includes(projection.schemaVersion)){
      content.hidden=true;empty.hidden=false;
      empty.textContent="该历史日期尚未生成多周期路径快照；不使用后来的数据倒填。";
      $("projectionVolume").textContent="历史数据未纳入";
      return;
    }
    content.hidden=false;empty.hidden=true;
    const volume=projection.volume||{},review=projection.previousReview||{},paths=projection.nextSessionPaths||{},timeframes=projection.timeframes||{};
    if(!timeframes[projectionTimeframe])projectionTimeframe=Object.keys(timeframes)[0]||"30m";
    const item=timeframes[projectionTimeframe]||{},current=item.current||{};
    $("projectionVolume").textContent=`基于${projection.date||d}收盘 · ${volume.label||"量能未知"} · 近20期量比 ${finite(volume.ratio20)?Math.round(Number(volume.ratio20)*100)+"%":"—"}`;
    $("projectionReview").className=`dashboard-projection-review ${esc(review.status||"first")}`;
    $("projectionReview").innerHTML=`<details><summary><b>${review.available?`昨日路径复盘：${esc(review.primary||"待复核")}`:"首个路径快照"}</b><span>${review.available?"查看实际触发与收盘结果":""}</span></summary><p>${esc(review.summary||"暂无上一交易日路径可供复核。")}</p></details>`;
    $("projectionTabs").innerHTML=Object.entries(timeframes).map(([key,timeframe])=>`<button type="button" class="${key===projectionTimeframe?"is-active":""}" data-projection-timeframe="${key}" aria-selected="${key===projectionTimeframe}">${esc(timeframe.label||key)}</button>`).join("");
    if(["multi-timeframe-path-v2","multi-timeframe-native-chan-v3"].includes(projection.schemaVersion)){
      const assessment=item.phaseAssessment||{},checkpoint=item.checkpoints?.[projectionCheckpoint]||item.checkpoints?.close||{};
      const progression=(projection.progression||[]).map(step=>`<li class="${esc(step.status||"")}"><span>${esc(step.label||"—")}</span><b>${esc(step.role||"—")}</b><small>${esc(step.phase||"—")}</small></li>`).join("");
      const levelPaths=item.paths||paths,structure=item.chanStructure||{},lastStroke=structure.lastStroke||{},activeCenter=structure.activeCenter||{};
      const levelBranches=[["up","修复",levelPaths.up?.label],["range","震荡",levelPaths.range?.label],["down","破坏",levelPaths.down?.label]];
      const centerText=finite(activeCenter.zd)&&finite(activeCenter.zg)?` · 中枢 ${Number(activeCenter.zd).toFixed(0)}—${Number(activeCenter.zg).toFixed(0)}`:"";
      const structurePanel=projection.schemaVersion==="multi-timeframe-native-chan-v3"?`
        <div class="dashboard-chan-summary"><b>${esc(item.label||projectionTimeframe)}结构</b><span>${lastStroke.direction?`最近${lastStroke.direction==="up"?"上行":"下行"}笔${lastStroke.is_sure?"已确认":"未确认"}${esc(centerText)}`:"暂无足够确认笔"}</span></div>`:"";
      $("projectionSummary").innerHTML=`<div class="dashboard-projection-current dashboard-projection-current-v2"><div><span>${esc(assessment.role||"当前交易状态")}</span><b>${esc(assessment.label||current.phase||"—")}</b><p>${esc(assessment.summary||"")}</p></div><button type="button" class="projection-evidence-toggle" data-projection-evidence>查看 ${esc(item.label||projectionTimeframe)} 指标证据</button></div>`;
      $("projectionBranches").innerHTML=levelBranches.map(([tone,title,label])=>`<div class="dashboard-projection-branch ${tone}"><b>${title}路径</b><span>${esc(label||"—")}</span></div>`).join("");
      $("projectionDetail").innerHTML=`
        <div class="dashboard-scenario-head"><b>下一交易日观察条件</b><div class="dashboard-checkpoint-tabs" role="tablist"><button type="button" data-projection-checkpoint="noon" class="${projectionCheckpoint==="noon"?"is-active":""}">明日午间</button><button type="button" data-projection-checkpoint="close" class="${projectionCheckpoint==="close"?"is-active":""}">明日收盘</button></div></div>
        <p class="dashboard-checkpoint-note">${esc(checkpoint.note||"")}</p>
        ${projectionScenarioTable(checkpoint.scenarios)}
        <details class="dashboard-projection-evidence" ${projectionEvidenceOpen?"open":""}><summary>多周期结构与指标证据</summary>${structurePanel}<ol class="dashboard-projection-progression">${progression}</ol><dl><div><dt>DIF</dt><dd>${finite(current.dif)?Number(current.dif).toFixed(2):"—"}</dd></div><div><dt>DEA</dt><dd>${finite(current.dea)?Number(current.dea).toFixed(2):"—"}</dd></div><div><dt>柱</dt><dd>${finite(current.histogram)?Number(current.histogram).toFixed(2):"—"}</dd></div></dl></details>
        <details class="dashboard-projection-math"><summary>MACD 数学推演说明</summary><p>量能只约束路径持续性，不进入 MACD 公式；MACD 转好只代表反抽准备，必须由价格结构确认。</p></details>`;
      return;
    }
    $("projectionSummary").innerHTML="";
    const branchMeta=[["up","修复路径",paths.up?.label],["range","震荡路径",paths.range?.label],["down","破坏路径",paths.down?.label]];
    $("projectionBranches").innerHTML=branchMeta.map(([tone,title,label])=>`<div class="dashboard-projection-branch ${tone}"><b>${title}</b><span>${esc(label||"—")}</span></div>`).join("");
    $("projectionDetail").innerHTML=`
      <div class="dashboard-projection-current">
        <div><span>当前状态</span><b>${esc(current.phase||"—")}</b></div>
        <dl><div><dt>DIF</dt><dd>${finite(current.dif)?Number(current.dif).toFixed(2):"—"}</dd></div><div><dt>DEA</dt><dd>${finite(current.dea)?Number(current.dea).toFixed(2):"—"}</dd></div><div><dt>柱</dt><dd>${finite(current.histogram)?Number(current.histogram).toFixed(2):"—"}</dd></div></dl>
      </div>
      ${projectionPathTable(item.pathStages)}`;
  }
  function render(d){
    const R=D.reports[d],M=scoreDisplay(R.market,D.shortTerm?.[d]),A=D.dates.filter(x=>x<=d),recent=[d];
    const hasMarketScore=Number.isFinite(M.total),scored=A.filter(x=>Number.isFinite(scoreDisplay(D.reports[x].market,D.shortTerm?.[x]).total));
    $("marketTotal").textContent=hasMarketScore?M.total:"—";$("marketStatus").textContent=M.status||"未纳入评分";$("marketSummary").textContent=M.summary||"该日已收录完整复盘 HTML，但当时尚未生成入口看板所需的市场评分字段。";
    $("sentimentScore").textContent=Number.isFinite(M.sentiment)?M.sentiment:"—";$("technicalScore").textContent=Number.isFinite(M.technical)?M.technical:"—";$("fullReportLink").href=R.fullReport;
    const sentimentCaption=document.querySelector(".split-scores > div:first-child em");if(sentimentCaption)sentimentCaption.textContent=M.shortTerm?"强势股次日溢价、封板与接力质量":"宽度、量能、主线扩散";
    $("historyCount").textContent=`${scored.length} 个交易日有评分`;
    $("marketTrend").innerHTML=chart([{values:scored.map(x=>scoreDisplay(D.reports[x].market,D.shortTerm?.[x]).total)}],scored,{labels:true,score:true,metric:"score",aria:"市场评分趋势"});
    $("trendNote").textContent=scored.length===A.length?"纵轴按当前可比区间自动缩放；总分越高代表环境越有利，但总闸与结构约束仍优先。":"早期复盘仍可在日期选择中查看；评分趋势仅展示有评分的交易日。";
    renderShortTerm(d);
    renderProjection(d);
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
    const matrixHint=document.querySelector(".capital-matrix-card .sector-insight-head span");if(matrixHint)matrixHint.textContent="点击热力图行展开；近3日按有效观测累计";
    D.sectorFlowConfig.metrics.forEach(m=>{const o=document.createElement("option");o.value=m.id;o.textContent=m.name;$("sectorMetricSelect").appendChild(o)});$("sectorMetricSelect").value=D.sectorFlowConfig.defaultMetric;
    $("sectorMetricSelect").addEventListener("change",()=>renderSector($("dateSelect").value));
    $("sectorTrend").addEventListener("click",e=>{const row=e.target.closest("[data-heatmap-direction]"),cell=e.target.closest("[data-heatmap-observation]");if(row){expandedCapitalDirection=expandedCapitalDirection===row.dataset.heatmapDirection?null:row.dataset.heatmapDirection;activeCapitalObservation=null;renderSector($("dateSelect").value);return;}if(cell){activeCapitalObservation={groupId:cell.dataset.heatmapGroup,date:cell.dataset.heatmapDate};renderSector($("dateSelect").value)}});
    $("sectorTrend").addEventListener("keydown",e=>{if(e.key!=="Enter"&&e.key!==" ")return;const row=e.target.closest("[data-heatmap-direction]");if(!row)return;e.preventDefault();expandedCapitalDirection=expandedCapitalDirection===row.dataset.heatmapDirection?null:row.dataset.heatmapDirection;renderSector($("dateSelect").value)});
    $("capitalDecision").addEventListener("click",e=>{const button=e.target.closest("[data-capital-branch]");if(!button)return;activeCapitalObservation={groupId:button.dataset.capitalBranch,date:$("dateSelect").value};renderSector($("dateSelect").value)});
  }
  $("projectionTabs").addEventListener("click",event=>{const button=event.target.closest("[data-projection-timeframe]");if(!button)return;projectionTimeframe=button.dataset.projectionTimeframe;renderProjection($("dateSelect").value)});
  $("projectionDetail").addEventListener("click",event=>{const button=event.target.closest("[data-projection-checkpoint]");if(!button)return;projectionCheckpoint=button.dataset.projectionCheckpoint;renderProjection($("dateSelect").value)});
  $("projectionSummary").addEventListener("click",event=>{if(!event.target.closest("[data-projection-evidence]"))return;projectionEvidenceOpen=!projectionEvidenceOpen;renderProjection($("dateSelect").value)});
  $("shortTermThemeRelay").addEventListener("click",event=>{if(event.target.closest("[data-short-theme-close]")){expandedShortTheme=null;renderShortTerm($("dateSelect").value);return;}const button=event.target.closest("[data-short-theme]");if(!button)return;expandedShortTheme=expandedShortTheme===button.dataset.shortTheme?null:button.dataset.shortTheme;renderShortTerm($("dateSelect").value)});
  $("dateSelect").addEventListener("change",e=>render(e.target.value));render(D.dates[D.dates.length-1]);
})();
