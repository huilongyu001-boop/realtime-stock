// ========== SIDEBAR ==========
function renderSidebar(){
  const sb=document.getElementById('sidebarContainer');
  if(currentTab==='screen'){
    sb.innerHTML=`<div class="section-title">八大选股战法</div>
      ${STRATEGIES.map(s=>`<div class="strat-card ${currentStrategy&&currentStrategy.id===s.id?'active':''}" onclick="selectStrategy('${s.id}')">
        <div class="strat-icon" style="background:${s.color}22;color:${s.color}">${s.icon}</div>
        <div class="strat-info"><div class="strat-name">${s.name}</div><div class="strat-desc">${s.desc}</div></div>
      </div>`).join('')}
      <div class="section-title" style="margin-top:8px">量化策略</div>
      <div class="strat-card ${currentStrategy&&currentStrategy.id==='quant'?'active':''}" onclick="selectStrategy('quant')">
        <div class="strat-icon" style="background:#fbbf2422;color:#fbbf24">🤖</div>
        <div class="strat-info"><div class="strat-name">量化多因子选股</div><div class="strat-desc">低PE+低PB+小市值+动量</div></div>
      </div>`;
  }else{
    sb.innerHTML=`<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px">
        <span class="section-title" style="padding:0">📋 自选股</span>
        <button onclick="showAddModal()" style="padding:3px 8px;border:1px solid var(--border);border-radius:5px;background:transparent;color:var(--accent);cursor:pointer;font-size:11px">+ 添加</button>
      </div>
      <div class="mkt-pills">
        <button class="mkt-pill ${currentMarketFilter==='all'?'active':''}" onclick="setMktFilter('all',this)">全部</button>
        <button class="mkt-pill ${currentMarketFilter==='A'?'active':''}" onclick="setMktFilter('A',this)">A股</button>
        <button class="mkt-pill ${currentMarketFilter==='HK'?'active':''}" onclick="setMktFilter('HK',this)">港股</button>
      </div><div id="watchlistItems"></div>`;
    setTimeout(renderWatchlistItems,0);
  }
}

function renderWatchlistItems(){
  const c=document.getElementById('watchlistItems');if(!c)return;
  const filtered=watchlist.filter(s=>currentMarketFilter==='all'||s.market===currentMarketFilter);
  if(!filtered.length){c.innerHTML='<div style="padding:20px;text-align:center;color:var(--text-muted)">暂无自选股</div>';return}
  c.innerHTML=filtered.map(s=>`<div class="wl-item ${currentStock&&currentStock.code===s.code?'active':''}" onclick="selectWatchStock('${s.code}','${s.market}','${s.name}','${s.secid||''}',${s.isIndex||false})" id="wl_${s.code}">
    <div><div class="wl-name">${s.name}</div><div class="wl-code">${s.market==='HK'?'HK':'A'} · ${s.code}</div></div>
    <div class="wl-price"><div class="pr" id="wp_${s.code}">--</div><div class="ch" id="wc_${s.code}">--</div></div></div>`).join('');
  refreshWatchPrices();
}

async function refreshWatchPrices(){
  const filtered=watchlist.filter(s=>currentMarketFilter==='all'||s.market===currentMarketFilter);
  for(const s of filtered){
    const secid=s.secid||getSecid(s.code,s.market);
    fetchQuote(secid).then(q=>{
      if(!q)return;const pe=document.getElementById('wp_'+s.code),ce=document.getElementById('wc_'+s.code);if(!pe)return;
      const p=q.f43,pct=q.f170,cls=pct>0?'up':pct<0?'down':'flat',dec=s.market==='HK'?3:2;
      pe.className='pr '+cls;pe.textContent=typeof p==='number'?p.toFixed(dec):'--';
      ce.className='ch '+cls;ce.textContent=`${pct>0?'+':''}${fmtN(pct)}%`;
    });
  }
}

function setMktFilter(m,btn){currentMarketFilter=m;document.querySelectorAll('.mkt-pill').forEach(b=>b.classList.remove('active'));btn.classList.add('active');renderWatchlistItems()}

// ========== MAIN CONTENT ==========
function renderMainContent(){
  const c=document.getElementById('mainContent');
  if(currentTab==='screen'){
    if(!currentStrategy) c.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted)"><div style="font-size:48px;margin-bottom:16px">🎯</div><div style="font-size:16px;margin-bottom:8px">从左侧选择一个选股战法</div><div style="font-size:12px">系统将自动扫描A股+港股全市场，找出符合条件的股票</div></div>`;
  }else{
    if(!currentStock) c.innerHTML=`<div style="display:flex;flex-direction:column;align-items:center;justify-content:center;height:100%;color:var(--text-muted)"><div style="font-size:48px;margin-bottom:16px">📈</div><div style="font-size:16px;margin-bottom:8px">从左侧选择一只股票查看详情</div><div style="font-size:12px">支持A股和港股实时行情、K线图、技术指标</div></div>`;
  }
}

function selectStrategy(id){
  const s=id==='quant'?QUANT_STRATEGY:STRATEGIES.find(x=>x.id===id);
  if(!s)return; currentStrategy=s; renderSidebar(); renderScanPanel();
}

function renderScanPanel(){
  const s=currentStrategy;
  document.getElementById('mainContent').innerHTML=`<div class="screen-panel" style="position:relative">
    <div class="screen-header"><div><h2>${s.icon} ${s.name}</h2><div class="desc">${s.desc}</div></div>
      <div class="screen-actions"><button class="scan-btn primary" id="scanBtn" onclick="startScan()"><span id="scanBtnIcon">🔍</span> <span id="scanBtnText">开始扫描全市场</span></button></div>
    </div>
    <div class="condition-tags">${s.conditions.map(c=>`<div class="cond-tag info">✓ ${c}</div>`).join('')}</div>
    <div style="padding:10px 16px"><div id="scanStatus" style="font-size:12px;color:var(--text-secondary)">点击「开始扫描」，系统将获取全A股+港股数据并筛选</div><div class="progress-bar"><div class="progress-fill" id="scanProgress"></div></div></div>
    <div class="table-wrap" id="scanTableWrap"><div style="padding:40px;text-align:center;color:var(--text-muted)">${getLastScanInfo(s.id)}</div></div>
    <div class="pagination" id="scanPagination"></div>
    <div class="loading-cover" id="scanLoading"><div class="spinner"></div><div style="color:var(--text-secondary);font-size:13px">扫描中...</div></div>
  </div>`;
}

function getLastScanInfo(id){
  try{const d=JSON.parse(localStorage.getItem('lastScan_'+id));
    if(d){const ago=Math.round((Date.now()-d.time)/60000);return `上次扫描：${ago}分钟前，找到 ${d.count} 只<br><span style="font-size:11px">点击「开始扫描」获取最新结果</span>`}}catch{}
  return '尚未扫描，点击上方按钮开始';
}

async function startScan(){
  if(isScanning||!currentStrategy)return;
  const btn=document.getElementById('scanBtn');btn.disabled=true;
  document.getElementById('scanBtnIcon').innerHTML='<span class="spin">⏳</span>';
  document.getElementById('scanBtnText').textContent='扫描中...';
  await runScan(currentStrategy);
  btn.disabled=false;document.getElementById('scanBtnIcon').textContent='🔍';document.getElementById('scanBtnText').textContent='重新扫描';
}

// ========== SCAN RESULTS TABLE ==========
function renderScanResults(){
  if(!scanResults.length){document.getElementById('scanTableWrap').innerHTML='<div style="padding:40px;text-align:center;color:var(--text-muted)">未找到符合条件的股票</div>';document.getElementById('scanPagination').innerHTML='';return}
  scanResults.sort((a,b)=>{let va=a[scanSort.field]??-9e9,vb=b[scanSort.field]??-9e9;return scanSort.dir==='asc'?va-vb:vb-va});
  const total=scanResults.length,totalPages=Math.ceil(total/SCAN_PAGE_SIZE);
  const start=(scanPage-1)*SCAN_PAGE_SIZE,pg=scanResults.slice(start,start+SCAN_PAGE_SIZE);
  const cols=[{k:'name',l:'代码/名称',w:'130px'},{k:'close',l:'最新价',w:'70px'},{k:'pctChg',l:'涨跌幅',w:'75px'}];
  if(currentStrategy.id==='quant')cols.push({k:'quantScore',l:'量化评分',w:'75px'});
  cols.push({k:'volRatio',l:'量比',w:'55px'},{k:'turnover',l:'换手%',w:'60px'},{k:'pe',l:'PE',w:'55px'},{k:'totalMv',l:'市值',w:'75px'},{k:'market',l:'市场',w:'45px'});
  
  let thead='<tr>'+cols.map(c=>{const sorted=scanSort.field===c.k;return `<th style="width:${c.w}" class="${sorted?'sorted':''}" onclick="sortScan('${c.k}')">${c.l}${sorted?(scanSort.dir==='asc'?' ↑':' ↓'):''}</th>`}).join('')+'</tr>';
  let tbody=pg.map(s=>{const cls=s.pctChg>0?'up':s.pctChg<0?'down':'flat';
    return `<tr onclick="showStockDetail('${s.secid}','${s.name}','${s.isHK?'HK':'A'}')" style="cursor:pointer">
      <td><span class="s-name">${s.name}</span><br><span class="s-code">${s.code} ${s.isHK?'🇭🇰':''}</span></td>
      <td style="font-weight:600;font-family:monospace" class="${cls}">${fmtN(s.close)}</td>
      <td><span class="pct ${cls}">${s.pctChg>0?'+':''}${fmtN(s.pctChg)}%</span></td>
      ${currentStrategy.id==='quant'?`<td style="font-weight:700;color:var(--yellow)">${fmtN(s.quantScore,1)}</td>`:''}
      <td>${fmtN(s.volRatio)}</td><td>${fmtN(s.turnover)}</td><td>${fmtN(s.pe)}</td>
      <td>${fmtMv(s.totalMv)}</td><td style="font-size:10px">${s.isHK?'港股':s.market}</td></tr>`}).join('');
  document.getElementById('scanTableWrap').innerHTML=`<table><thead>${thead}</thead><tbody>${tbody}</tbody></table>`;
  
  let pgHtml=`<span>共 ${total} 只 | 第 ${scanPage}/${totalPages} 页</span><div class="page-btns">`;
  pgHtml+=`<button class="pg-btn" onclick="goScanPage(1)" ${scanPage===1?'disabled':''}>首</button>`;
  pgHtml+=`<button class="pg-btn" onclick="goScanPage(${scanPage-1})" ${scanPage===1?'disabled':''}>‹</button>`;
  for(let i=Math.max(1,scanPage-2);i<=Math.min(totalPages,scanPage+2);i++)pgHtml+=`<button class="pg-btn ${i===scanPage?'active':''}" onclick="goScanPage(${i})">${i}</button>`;
  pgHtml+=`<button class="pg-btn" onclick="goScanPage(${scanPage+1})" ${scanPage>=totalPages?'disabled':''}>›</button>`;
  pgHtml+=`<button class="pg-btn" onclick="goScanPage(${totalPages})" ${scanPage>=totalPages?'disabled':''}>末</button></div>`;
  document.getElementById('scanPagination').innerHTML=pgHtml;
}

function sortScan(field){if(scanSort.field===field)scanSort.dir=scanSort.dir==='asc'?'desc':'asc';else scanSort={field,dir:'desc'};renderScanResults()}
function goScanPage(p){const tp=Math.ceil(scanResults.length/SCAN_PAGE_SIZE);if(p<1||p>tp)return;scanPage=p;renderScanResults();document.getElementById('scanTableWrap').scrollTop=0}
