// ========== STOCK DETAIL (Modal from scan results) ==========
async function showStockDetail(secid,name,market){
  const q=await fetchQuote(secid);if(!q)return;
  const isHK=market==='HK',p=q.f43,pct=q.f170,chg=q.f169,cls=pct>0?'up':pct<0?'down':'flat',dec=isHK?3:2;
  document.getElementById('modalContent').innerHTML=`
    <button class="modal-close" onclick="closeModal()">&times;</button>
    <h2>${name} <span class="pct ${cls}" style="font-size:14px">${pct>0?'+':''}${fmtN(pct)}%</span></h2>
    <span style="color:var(--text-muted);font-size:12px">${q.f57||''} | ${isHK?'港股':'A股'}</span>
    <div class="info-grid" style="margin-top:12px">
      <div class="info-item"><div class="info-label">最新价</div><div class="info-value ${cls}">${fmtN(p,dec)}</div></div>
      <div class="info-item"><div class="info-label">今开</div><div class="info-value">${fmtN(q.f46,dec)}</div></div>
      <div class="info-item"><div class="info-label">最高</div><div class="info-value up">${fmtN(q.f44,dec)}</div></div>
      <div class="info-item"><div class="info-label">最低</div><div class="info-value down">${fmtN(q.f45,dec)}</div></div>
      <div class="info-item"><div class="info-label">昨收</div><div class="info-value">${fmtN(q.f60,dec)}</div></div>
      <div class="info-item"><div class="info-label">成交量</div><div class="info-value">${fmtVol(q.f47)}</div></div>
      <div class="info-item"><div class="info-label">成交额</div><div class="info-value">${fmtVol(q.f48)}</div></div>
      <div class="info-item"><div class="info-label">换手率</div><div class="info-value">${fmtN(q.f168)}%</div></div>
      <div class="info-item"><div class="info-label">PE</div><div class="info-value">${fmtN(q.f162)}</div></div>
      <div class="info-item"><div class="info-label">总市值</div><div class="info-value">${fmtVol(q.f116)}</div></div>
      <div class="info-item"><div class="info-label">流通市值</div><div class="info-value">${fmtVol(q.f117)}</div></div>
      <div class="info-item"><div class="info-label">量比</div><div class="info-value">${fmtN(q.f50)}</div></div>
    </div>
    <div class="card" style="margin-top:12px"><div class="card-title">📈 K线图</div>
      <div class="chart-toolbar" id="modalChartToolbar">
        <button class="chart-btn" onclick="loadModalChart('${secid}','5',this)">5分</button>
        <button class="chart-btn" onclick="loadModalChart('${secid}','15',this)">15分</button>
        <button class="chart-btn" onclick="loadModalChart('${secid}','60',this)">60分</button>
        <button class="chart-btn active" onclick="loadModalChart('${secid}','101',this)">日K</button>
        <button class="chart-btn" onclick="loadModalChart('${secid}','102',this)">周K</button>
      </div>
      <div class="chart-container" id="modalChartContainer" style="height:340px"><canvas id="modalChart"></canvas></div>
    </div>
    <div class="card"><div class="card-title">📊 技术指标</div><div class="indicator-grid" id="modalIndicators"><div style="padding:20px;text-align:center;color:var(--text-muted)">加载中...</div></div></div>`;
  document.getElementById('modalBg').classList.add('show');
  loadModalChart(secid,'101',document.querySelector('#modalChartToolbar .chart-btn.active'));
}

async function loadModalChart(secid,period,btn){
  document.querySelectorAll('#modalChartToolbar .chart-btn').forEach(b=>b.classList.remove('active'));
  if(btn)btn.classList.add('active');
  const count=period==='102'?60:period==='103'?48:120;
  const d=await fetchKline(secid,period,count);
  if(d&&d.klines){drawKChart('modalChart','modalChartContainer',d.klines);calcIndicatorsById(d.klines,'modalIndicators')}
}

function closeModal(){document.getElementById('modalBg').classList.remove('show')}

// ========== WATCHLIST DETAIL ==========
async function selectWatchStock(code,market,name,secid,isIndex){
  currentStock={code,market,name,secid:secid||getSecid(code,market),isIndex};
  renderWatchlistItems();
  const c=document.getElementById('mainContent');
  c.innerHTML='<div style="display:flex;align-items:center;justify-content:center;padding:40px;color:var(--text-muted)"><div class="spinner" style="width:24px;height:24px;border:3px solid var(--border);border-top-color:var(--accent);border-radius:50%;animation:spin .8s linear infinite"></div><span style="margin-left:8px">加载中...</span></div>';
  const q=await fetchQuote(currentStock.secid);
  if(!q){c.innerHTML='<div style="text-align:center;padding:40px;color:var(--text-muted)">数据加载失败</div>';return}
  const isHK=market==='HK',p=q.f43,pct=q.f170,chg=q.f169,cls=pct>0?'up':pct<0?'down':'flat',dec=isHK?3:2;
  c.innerHTML=`
    <div class="card"><div class="detail-header">
      <div><div class="detail-name">${name}</div><div class="detail-code">${isHK?'港股':'A股'} · ${code}</div></div>
      <div style="text-align:right"><div class="detail-price ${cls}">${p?.toFixed(dec)||'--'}</div><div class="detail-change ${cls}">${chg>0?'+':''}${chg?.toFixed(dec)||'--'} (${pct>0?'+':''}${fmtN(pct)}%)</div></div></div>
      <div class="info-grid">
        <div class="info-item"><div class="info-label">今开</div><div class="info-value">${fmtN(q.f46,dec)}</div></div>
        <div class="info-item"><div class="info-label">最高</div><div class="info-value up">${fmtN(q.f44,dec)}</div></div>
        <div class="info-item"><div class="info-label">最低</div><div class="info-value down">${fmtN(q.f45,dec)}</div></div>
        <div class="info-item"><div class="info-label">昨收</div><div class="info-value">${fmtN(q.f60,dec)}</div></div>
        <div class="info-item"><div class="info-label">成交量</div><div class="info-value">${fmtVol(q.f47)}</div></div>
        <div class="info-item"><div class="info-label">成交额</div><div class="info-value">${fmtVol(q.f48)}</div></div>
        <div class="info-item"><div class="info-label">换手率</div><div class="info-value">${fmtN(q.f168)}%</div></div>
        <div class="info-item"><div class="info-label">量比</div><div class="info-value">${fmtN(q.f50)}</div></div>
        <div class="info-item"><div class="info-label">PE</div><div class="info-value">${fmtN(q.f162)}</div></div>
        <div class="info-item"><div class="info-label">总市值</div><div class="info-value">${fmtVol(q.f116)}</div></div>
        <div class="info-item"><div class="info-label">流通市值</div><div class="info-value">${fmtVol(q.f117)}</div></div>
        <div class="info-item"><div class="info-label">振幅</div><div class="info-value">${fmtN(q.f171)}%</div></div>
      </div></div>
    <div class="card"><div class="card-title">📈 行情图表</div>
      <div class="chart-toolbar" id="watchChartToolbar">
        <button class="chart-btn active" onclick="switchWatchChart('minute',this)">分时</button>
        <button class="chart-btn" onclick="switchWatchChart('5',this)">5分</button>
        <button class="chart-btn" onclick="switchWatchChart('15',this)">15分</button>
        <button class="chart-btn" onclick="switchWatchChart('60',this)">60分</button>
        <button class="chart-btn" onclick="switchWatchChart('101',this)">日K</button>
        <button class="chart-btn" onclick="switchWatchChart('102',this)">周K</button>
        <button class="chart-btn" onclick="switchWatchChart('103',this)">月K</button>
      </div>
      <div class="chart-container" id="watchChartContainer" style="height:380px"><canvas id="watchChart"></canvas></div></div>
    <div class="card"><div class="card-title">📊 技术指标</div><div class="indicator-grid" id="watchIndicators"><div style="padding:20px;text-align:center;color:var(--text-muted)">加载中...</div></div></div>`;
  loadWatchMinuteChart();
}

async function loadWatchMinuteChart(){
  const d=await fetchMinute(currentStock.secid);
  if(d&&d.trends){drawMinChart('watchChart','watchChartContainer',d.trends,d.prePrice);
    const kd=await fetchKline(currentStock.secid,'101',120);
    if(kd&&kd.klines)calcIndicatorsById(kd.klines,'watchIndicators')}
}

async function switchWatchChart(period,btn){
  document.querySelectorAll('#watchChartToolbar .chart-btn').forEach(b=>b.classList.remove('active'));btn.classList.add('active');
  if(period==='minute'){loadWatchMinuteChart();return}
  const count=period==='102'?60:period==='103'?48:120;
  const d=await fetchKline(currentStock.secid,period,count);
  if(d&&d.klines){drawKChart('watchChart','watchChartContainer',d.klines);calcIndicatorsById(d.klines,'watchIndicators')}
}

// ========== CHART DRAWING ==========
const CC={bg:'#111827',grid:'#1e293b',text:'#64748b',up:'#ef4444',down:'#22c55e',line:'#3b82f6',ma5:'#f59e0b',ma10:'#a855f7',ma20:'#06b6d4',ma60:'#22c55e',vup:'rgba(239,68,68,.5)',vdn:'rgba(34,197,94,.5)',avg:'#f59e0b'};

function getCtx(cid,pid){
  const canvas=document.getElementById(cid);if(!canvas)return null;
  const con=document.getElementById(pid);const dpr=window.devicePixelRatio||1;
  canvas.width=con.clientWidth*dpr;canvas.height=con.clientHeight*dpr;
  canvas.style.width=con.clientWidth+'px';canvas.style.height=con.clientHeight+'px';
  const ctx=canvas.getContext('2d');ctx.scale(dpr,dpr);return{ctx,w:con.clientWidth,h:con.clientHeight};
}

function drawMinChart(cid,pid,data,preClose){
  const c=getCtx(cid,pid);if(!c||!data||!data.length)return;
  const{ctx,w,h}=c;const pL=55,pR=15,pT=18,pB=55,cW=w-pL-pR,pH=(h-pT-pB)*.7,vH=(h-pT-pB)*.25,vT=pT+pH+8;
  const pts=data.map(d=>{const p=d.split(',');return{t:p[0],p:+p[1],a:+p[2],v:+p[3]||0}});
  const all=[...pts.map(p=>p.p),...pts.map(p=>p.a),preClose].filter(v=>!isNaN(v));
  let mn=Math.min(...all),mx=Math.max(...all);const rng=mx-mn||1;mn-=rng*.05;mx+=rng*.05;
  const mxV=Math.max(...pts.map(p=>p.v))||1;
  ctx.fillStyle=CC.bg;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle=CC.grid;ctx.lineWidth=.5;
  for(let i=0;i<=4;i++){const y=pT+(pH/4)*i;ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(w-pR,y);ctx.stroke();ctx.fillStyle=CC.text;ctx.font='10px monospace';ctx.textAlign='right';ctx.fillText((mx-((mx-mn)/4)*i).toFixed(2),pL-4,y+3)}
  const preY=pT+((mx-preClose)/(mx-mn))*pH;ctx.strokeStyle='#475569';ctx.setLineDash([3,3]);ctx.beginPath();ctx.moveTo(pL,preY);ctx.lineTo(w-pR,preY);ctx.stroke();ctx.setLineDash([]);
  const xS=cW/((pts.length-1)||1);
  // Area
  ctx.beginPath();ctx.moveTo(pL,pT+((mx-pts[0].p)/(mx-mn))*pH);
  for(let i=1;i<pts.length;i++)ctx.lineTo(pL+i*xS,pT+((mx-pts[i].p)/(mx-mn))*pH);
  ctx.lineTo(pL+(pts.length-1)*xS,pT+pH);ctx.lineTo(pL,pT+pH);ctx.closePath();
  const gd=ctx.createLinearGradient(0,pT,0,pT+pH);gd.addColorStop(0,'rgba(59,130,246,.15)');gd.addColorStop(1,'rgba(59,130,246,0)');ctx.fillStyle=gd;ctx.fill();
  // Price line
  ctx.strokeStyle=CC.line;ctx.lineWidth=1.5;ctx.beginPath();
  for(let i=0;i<pts.length;i++){const x=pL+i*xS,y=pT+((mx-pts[i].p)/(mx-mn))*pH;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke();
  // Avg line
  ctx.strokeStyle=CC.avg;ctx.lineWidth=1;ctx.beginPath();
  for(let i=0;i<pts.length;i++){const x=pL+i*xS,y=pT+((mx-pts[i].a)/(mx-mn))*pH;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y)}ctx.stroke();
  // Volume
  for(let i=0;i<pts.length;i++){const x=pL+i*xS,bh=(pts[i].v/mxV)*vH;ctx.fillStyle=i===0?(pts[i].p>=preClose?CC.vup:CC.vdn):(pts[i].p>=pts[i-1].p?CC.vup:CC.vdn);ctx.fillRect(x-1,vT+vH-bh,2,bh)}
  ctx.fillStyle=CC.text;ctx.font='9px monospace';ctx.textAlign='center';
  const st=Math.floor(pts.length/4);for(let i=0;i<5;i++){const idx=Math.min(i*st,pts.length-1);const t=pts[idx].t.split(' ')[1]||pts[idx].t;ctx.fillText(t.substring(0,5),pL+idx*xS,vT+vH+12)}
  ctx.font='10px sans-serif';ctx.textAlign='left';ctx.fillStyle=CC.line;ctx.fillText('● 价格',pL+8,pT-4);ctx.fillStyle=CC.avg;ctx.fillText('● 均价',pL+60,pT-4);
}

function drawKChart(cid,pid,data){
  const c=getCtx(cid,pid);if(!c||!data||!data.length)return;
  const{ctx,w,h}=c;const pL=55,pR=15,pT=25,pB=55,cW=w-pL-pR,pH=(h-pT-pB)*.65,vH=(h-pT-pB)*.2,vT=pT+pH+15;
  const bars=data.map(d=>{const p=d.split(',');return{dt:p[0],o:+p[1],cl:+p[2],hi:+p[3],lo:+p[4],v:+p[5]}});
  const cls=bars.map(b=>b.cl);const ma5=calcMa(cls,5),ma10=calcMa(cls,10),ma20=calcMa(cls,20),ma60=calcMa(cls,60);
  const allP=bars.flatMap(b=>[b.hi,b.lo]);let mn=Math.min(...allP),mx=Math.max(...allP);const rng=mx-mn||1;mn-=rng*.02;mx+=rng*.02;
  const mxV=Math.max(...bars.map(b=>b.v))||1;
  ctx.fillStyle=CC.bg;ctx.fillRect(0,0,w,h);
  ctx.strokeStyle=CC.grid;ctx.lineWidth=.5;
  for(let i=0;i<=4;i++){const y=pT+(pH/4)*i;ctx.beginPath();ctx.moveTo(pL,y);ctx.lineTo(w-pR,y);ctx.stroke();ctx.fillStyle=CC.text;ctx.font='10px monospace';ctx.textAlign='right';ctx.fillText((mx-((mx-mn)/4)*i).toFixed(2),pL-4,y+3)}
  const bW=Math.max(1,(cW/bars.length)*.7),gap=cW/bars.length;
  bars.forEach((b,i)=>{
    const x=pL+i*gap+gap/2,oY=pT+((mx-b.o)/(mx-mn))*pH,cY=pT+((mx-b.cl)/(mx-mn))*pH,hY=pT+((mx-b.hi)/(mx-mn))*pH,lY=pT+((mx-b.lo)/(mx-mn))*pH;
    const up=b.cl>=b.o;const co=up?CC.up:CC.down;
    ctx.strokeStyle=co;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(x,hY);ctx.lineTo(x,lY);ctx.stroke();
    const bt=Math.min(oY,cY),bh=Math.max(Math.abs(cY-oY),1);
    if(up){ctx.strokeStyle=co;ctx.strokeRect(x-bW/2,bt,bW,bh)}else{ctx.fillStyle=co;ctx.fillRect(x-bW/2,bt,bW,bh)}
    const vh=(b.v/mxV)*vH;ctx.fillStyle=up?CC.vup:CC.vdn;ctx.fillRect(x-bW/2,vT+vH-vh,bW,vh);
  });
  function drawMaLine(ma,co){ctx.strokeStyle=co;ctx.lineWidth=1;ctx.beginPath();let s=false;ma.forEach((v,i)=>{if(v===null)return;const x=pL+i*gap+gap/2,y=pT+((mx-v)/(mx-mn))*pH;s?ctx.lineTo(x,y):(ctx.moveTo(x,y),s=true)});ctx.stroke()}
  drawMaLine(ma5,CC.ma5);drawMaLine(ma10,CC.ma10);drawMaLine(ma20,CC.ma20);if(bars.length>=60)drawMaLine(ma60,CC.ma60);
  ctx.font='10px sans-serif';ctx.textAlign='left';const lx=pL+8;
  ctx.fillStyle=CC.ma5;ctx.fillText('MA5',lx,pT-7);ctx.fillStyle=CC.ma10;ctx.fillText('MA10',lx+40,pT-7);ctx.fillStyle=CC.ma20;ctx.fillText('MA20',lx+90,pT-7);if(bars.length>=60){ctx.fillStyle=CC.ma60;ctx.fillText('MA60',lx+140,pT-7)}
  ctx.fillStyle=CC.text;ctx.font='9px monospace';ctx.textAlign='center';const ls=Math.max(1,Math.floor(bars.length/6));
  for(let i=0;i<bars.length;i+=ls){const x=pL+i*gap+gap/2;ctx.fillText(bars[i].dt.replace(/^\d{4}-?/,'').replace('-','/'),x,vT+vH+12)}
}

// ========== INDICATORS ==========
function calcIndicatorsById(klines,elId){
  const el=document.getElementById(elId);if(!el||!klines||klines.length<2)return;
  const bars=klines.map(d=>{const p=d.split(',');return{o:+p[1],cl:+p[2],hi:+p[3],lo:+p[4]}});
  const cls=bars.map(b=>b.cl),his=bars.map(b=>b.hi),los=bars.map(b=>b.lo),n=cls.length;
  const e12=emaCalc(cls,12),e26=emaCalc(cls,26);const dif=e12.map((v,i)=>v-e26[i]);const dea=emaCalc(dif,9);
  const ma5=calcMa(cls,5),ma10=calcMa(cls,10),ma20=calcMa(cls,20);
  let pK=50,pD=50;const kA=[],dA=[],jA=[];
  for(let i=0;i<n;i++){const st=Math.max(0,i-8);const hh=Math.max(...his.slice(st,i+1)),ll=Math.min(...los.slice(st,i+1));const rsv=hh===ll?50:((cls[i]-ll)/(hh-ll))*100;const cK=2/3*pK+1/3*rsv,cD=2/3*pD+1/3*cK;kA.push(cK);dA.push(cD);jA.push(3*cK-2*cD);pK=cK;pD=cD}
  let ag=0,al=0;const rsi=[];for(let i=0;i<n;i++){if(i===0){rsi.push(50);continue}const ch=cls[i]-cls[i-1],g=ch>0?ch:0,l=ch<0?-ch:0;if(i<=6){ag+=g/6;al+=l/6}else{ag=(ag*5+g)/6;al=(al*5+l)/6}rsi.push(al===0?100:100-100/(1+ag/al))}
  const lDif=dif[n-1],lDea=dea[n-1],lK=kA[n-1],lD=dA[n-1],lJ=jA[n-1],lRsi=rsi[n-1];
  const mSig=lDif>lDea?(lDif>0?'强势多头':'金叉'):(lDif<0?'弱势空头':'死叉');const mC=lDif>lDea?'sig-buy':'sig-sell';
  const kSig=lJ>80?'超买':lJ<20?'超卖':lK>lD?'看多':'看空';const kC=lJ>80?'sig-sell':lJ<20?'sig-buy':lK>lD?'sig-buy':'sig-sell';
  const rSig=lRsi>80?'超买':lRsi<20?'超卖':lRsi>50?'偏强':'偏弱';const rC=lRsi>70?'sig-sell':lRsi<30?'sig-buy':'sig-neutral';
  const maSig=(ma5[n-1]>ma10[n-1]&&ma10[n-1]>ma20[n-1])?'多头排列':(ma5[n-1]<ma10[n-1]&&ma10[n-1]<ma20[n-1])?'空头排列':'交叉';
  const maC=maSig==='多头排列'?'sig-buy':maSig==='空头排列'?'sig-sell':'sig-neutral';
  let score=50;if(lDif>lDea)score+=10;else score-=10;if(lDif>0)score+=5;else score-=5;if(lK>lD)score+=8;else score-=8;if(lJ>80)score-=5;if(lJ<20)score+=5;if(lRsi>70)score-=8;else if(lRsi<30)score+=8;if(ma5[n-1]>ma10[n-1]&&ma10[n-1]>ma20[n-1])score+=10;if(ma5[n-1]<ma10[n-1]&&ma10[n-1]<ma20[n-1])score-=10;score=Math.max(0,Math.min(100,Math.round(score)));
  const sL=score>=70?'🟢 偏多':score<=30?'🔴 偏空':'🟡 中性';
  el.innerHTML=`<div class="ind-card"><div class="ind-name">MACD</div><div class="ind-val">DIF: ${fmtN(lDif,3)}</div><div style="font-size:11px;color:var(--text-muted)">DEA: ${fmtN(lDea,3)}</div><div class="ind-sig ${mC}">${mSig}</div></div>
    <div class="ind-card"><div class="ind-name">KDJ</div><div class="ind-val">K: ${fmtN(lK,1)}</div><div style="font-size:11px;color:var(--text-muted)">D: ${fmtN(lD,1)} | J: ${fmtN(lJ,1)}</div><div class="ind-sig ${kC}">${kSig}</div></div>
    <div class="ind-card"><div class="ind-name">RSI</div><div class="ind-val">RSI6: ${fmtN(lRsi,1)}</div><div class="ind-sig ${rC}">${rSig}</div></div>
    <div class="ind-card"><div class="ind-name">均线</div><div class="ind-val">MA5: ${fmtN(ma5[n-1])}</div><div style="font-size:11px;color:var(--text-muted)">MA10: ${fmtN(ma10[n-1])}</div><div class="ind-sig ${maC}">${maSig}</div></div>
    <div class="ind-card"><div class="ind-name">综合评分</div><div class="ind-val" style="font-size:18px">${score}分 ${sL}</div></div>`;
}

// ========== SEARCH ==========
function setupSearch(){
  const input=document.getElementById('searchInput');let timer;
  input.addEventListener('input',()=>{clearTimeout(timer);timer=setTimeout(async()=>{
    const kw=input.value.trim();if(!kw)return;const results=await searchStock(kw);showSearchDD(results,input)},300)});
  input.addEventListener('blur',()=>{setTimeout(()=>{const dd=document.getElementById('searchDD');if(dd)dd.style.display='none'},200)});
}
function showSearchDD(results,input){
  let dd=document.getElementById('searchDD');
  if(!dd){dd=document.createElement('div');dd.id='searchDD';dd.style.cssText='position:absolute;top:100%;left:0;right:0;background:var(--bg-card);border:1px solid var(--border);border-radius:0 0 8px 8px;max-height:280px;overflow-y:auto;z-index:200';input.parentElement.appendChild(dd)}
  if(!results.length){dd.style.display='none';return}dd.style.display='block';
  dd.innerHTML=results.map(r=>`<div style="padding:8px 12px;cursor:pointer;display:flex;justify-content:space-between;border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--bg-card-hover)'" onmouseout="this.style.background=''" onmousedown="addToWL('${r.code}','${r.market}','${r.name}','${r.secid}')"><div><span style="font-weight:600">${r.name}</span><br><span style="font-size:10px;color:var(--text-muted)">${r.code}</span></div><div style="font-size:11px;color:var(--text-muted)">${r.market==='HK'?'港股':'A股'}</div></div>`).join('');
}
function addToWL(code,market,name,secid){
  if(!watchlist.find(s=>s.code===code)){watchlist.push({code,market,name,secid});saveWatchlist()}
  if(currentTab==='watch'){renderWatchlistItems();selectWatchStock(code,market,name,secid,false)}
  else showStockDetail(secid,name,market);
  document.getElementById('searchInput').value='';const dd=document.getElementById('searchDD');if(dd)dd.style.display='none';
}

// ========== ADD MODAL ==========
function showAddModal(){document.getElementById('addModal').classList.add('show');document.getElementById('addInput').value='';document.getElementById('addResults').innerHTML='';document.getElementById('addInput').focus();
  let t;document.getElementById('addInput').oninput=()=>{clearTimeout(t);t=setTimeout(async()=>{
    const kw=document.getElementById('addInput').value.trim();if(!kw)return;const r=await searchStock(kw);
    document.getElementById('addResults').innerHTML=r.map(x=>`<div style="padding:6px 10px;cursor:pointer;display:flex;justify-content:space-between;border-bottom:1px solid var(--border)" onmouseover="this.style.background='var(--bg-card-hover)'" onmouseout="this.style.background=''" onclick="addFromModal2('${x.code}','${x.market}','${x.name}','${x.secid}')"><div><span style="font-weight:600">${x.name}</span> <span style="font-size:10px;color:var(--text-muted)">${x.code}</span></div><div style="font-size:11px;color:var(--accent)">+ 添加</div></div>`).join('')},300)}
}
function closeAddModal(){document.getElementById('addModal').classList.remove('show')}
function addFromModal2(code,market,name,secid){if(!watchlist.find(s=>s.code===code)){watchlist.push({code,market,name,secid});saveWatchlist();renderWatchlistItems()}closeAddModal()}

// ========== AUTO REFRESH ==========
function startAutoRefresh(){setInterval(()=>{if(currentTab==='watch')refreshWatchPrices();if(currentStock&&currentTab==='watch'){fetchQuote(currentStock.secid).then(q=>{if(!q)return;const pe=document.querySelector('.detail-price'),ce=document.querySelector('.detail-change');if(!pe||!ce)return;const isHK=currentStock.market==='HK',p=q.f43,pct=q.f170,chg=q.f169,cls=pct>0?'up':pct<0?'down':'flat',dec=isHK?3:2;pe.className='detail-price '+cls;pe.textContent=p?.toFixed(dec)||'--';ce.className='detail-change '+cls;ce.textContent=`${chg>0?'+':''}${chg?.toFixed(dec)||'--'} (${pct>0?'+':''}${fmtN(pct)}%)`})}},10000)}

document.addEventListener('keydown',(e)=>{if(e.key==='Escape'){closeModal();closeAddModal()}if(e.key==='/'&&document.activeElement.tagName!=='INPUT'){e.preventDefault();document.getElementById('searchInput').focus()}});
