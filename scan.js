// ========== SCAN ENGINE ==========
function parseEMStock(s){
  const isHK=!!s._isHK; const code=s.f12||''; const name=s.f14||'';
  if(!code||!name)return null;
  const isST=name.includes('ST')||name.includes('*ST')||name.includes('退');
  const market=s.f13; const secid=isHK?'116.'+code:(market===1?'1.'+code:'0.'+code);
  const isGEM=code.startsWith('3');
  return { code,name,secid,isHK,isST,isGEM,
    market:isHK?'HK':(market===1?'SH':'SZ'),
    close:s.f2, open:s.f17, high:s.f15, low:s.f16, preClose:s.f18,
    pctChg:s.f3, chg:s.f4, vol:s.f5, amount:s.f6,
    volRatio:s.f10, turnover:s.f8, pe:s.f9, pb:s.f23,
    totalMv:s.f20, circMv:s.f21, amp:s.f7,
    ma5:null,ma10:null,ma20:null,ma30:null,ma60:null,
    dif:null,dea:null,macdHist:null,
    d1Close:null,d1Vol:null,d1PctChg:null,d2Close:null,d2Open:null,d2Vol:null
  };
}

function enrichWithKline(stock,klines){
  if(!klines||klines.length<5)return;
  const bars=klines.map(k=>{const p=k.split(',');return{open:+p[1],close:+p[2],high:+p[3],low:+p[4],vol:+p[5]};});
  const closes=bars.map(b=>b.close); const n=closes.length;
  stock.ma5=maLast(closes,5); stock.ma10=maLast(closes,10); stock.ma20=maLast(closes,20);
  stock.ma30=maLast(closes,30); stock.ma60=maLast(closes,60);
  const ema12=emaCalc(closes,12),ema26=emaCalc(closes,26);
  const dif=ema12.map((v,i)=>v-ema26[i]); const dea=emaCalc(dif,9);
  stock.dif=dif[n-1]; stock.dea=dea[n-1]; stock.macdHist=(dif[n-1]-dea[n-1])*2;
  if(n>=3){
    stock.d1Close=bars[n-3].close; stock.d1Vol=bars[n-3].vol;
    if(n>=4) stock.d1PctChg=(bars[n-3].close-bars[n-4].close)/bars[n-4].close*100;
    stock.d2Close=bars[n-2].close; stock.d2Open=bars[n-2].open; stock.d2Vol=bars[n-2].vol;
    stock.vol=bars[n-1].vol;
  }
}

function updateScanStatus(text,pct){
  const el=document.getElementById('scanStatus'); const bar=document.getElementById('scanProgress');
  if(el)el.textContent=text; if(bar)bar.style.width=pct+'%';
}

async function runScan(strategy){
  if(isScanning)return; isScanning=true; scanResults=[]; scanPage=1;
  updateScanStatus('正在获取A股市场数据...',10);
  let allStocks=[]; let page=1; let hasMore=true;
  while(hasMore){
    const data=await fetchMarketStocks('A',page,5000);
    if(data&&data.diff&&data.diff.length>0){
      allStocks=allStocks.concat(data.diff);
      const total=data.total||0;
      updateScanStatus(`已获取A股 ${allStocks.length}/${total} 只...`,Math.min(40,Math.round(allStocks.length/total*40)+10));
      if(allStocks.length>=total)hasMore=false; else page++;
    }else hasMore=false;
  }
  updateScanStatus('正在获取港股市场数据...',45);
  const hkData=await fetchMarketStocks('HK',1,5000);
  if(hkData&&hkData.diff) allStocks=allStocks.concat(hkData.diff.map(s=>({...s,_isHK:true})));
  updateScanStatus(`共${allStocks.length}只，应用${strategy.name}筛选...`,55);
  const candidates=[];
  for(const s of allStocks){if(!s.f2||s.f2==='-')continue;const item=parseEMStock(s);if(item)candidates.push(item)}
  updateScanStatus(`有效${candidates.length}只，正在筛选...`,65);
  
  const needKline=['denggao_wangyuan'];
  let results;
  if(strategy.id==='quant'){
    const filtered=candidates.filter(QUANT_STRATEGY.check);
    results=QUANT_STRATEGY.rank(filtered);
  } else if(needKline.includes(strategy.id)){
    const pre=candidates.filter(s=>s.pctChg>=3);
    updateScanStatus(`预筛选${pre.length}只候选，获取K线验证...`,70);
    const toCheck=pre.slice(0,200); let checked=0; results=[];
    for(const s of toCheck){
      try{
        const kd=await fetchKline(s.secid,'101',5);
        if(kd&&kd.klines&&kd.klines.length>=3){
          const bars=kd.klines.map(k=>{const p=k.split(',');return{open:+p[1],close:+p[2],high:+p[3],low:+p[4],vol:+p[5],pctChg:+p[8]}});
          const n=bars.length;
          s.d1Close=bars[n-3]?.close;s.d1Vol=bars[n-3]?.vol;s.d1PctChg=bars[n-3]?.pctChg;
          s.d2Close=bars[n-2]?.close;s.d2Open=bars[n-2]?.open;s.d2Vol=bars[n-2]?.vol;
          s.vol=bars[n-1]?.vol||s.vol;
          if(strategy.check(s))results.push(s);
        }
      }catch{}
      checked++;if(checked%20===0)updateScanStatus(`K线验证 ${checked}/${toCheck.length}...`,70+Math.round(checked/toCheck.length*25));
    }
  } else {
    const qf=candidates.filter(s=>{
      if(strategy.id==='junxian_qinlong')return s.pctChg>0&&s.volRatio>1;
      if(strategy.id==='shuangyang_chuguan')return s.pctChg>3&&s.volRatio>1.2;
      if(strategy.id==='hongxing_chuqiang')return s.pctChg>0;
      if(strategy.id==='shimian_maifu')return s.volRatio<0.8&&s.pctChg<0;
      if(strategy.id==='gongji_poxian')return s.pctChg>=9.5&&s.volRatio>1.5;
      if(strategy.id==='shangxia_xipan')return true;
      if(strategy.id==='yiye_maimai')return s.volRatio>1&&s.turnover>=5&&s.turnover<=10;
      return true;
    });
    updateScanStatus(`预筛选${qf.length}只，获取均线...`,70);
    const toEnrich=qf.slice(0,500); results=[]; let cnt=0;
    for(let i=0;i<toEnrich.length;i+=10){
      const batch=toEnrich.slice(i,i+10);
      await Promise.all(batch.map(async s=>{
        try{const kd=await fetchKline(s.secid,'101',65);
          if(kd&&kd.klines){enrichWithKline(s,kd.klines);if(strategy.check(s))results.push(s)}
        }catch{}
      }));
      cnt+=batch.length;if(cnt%50===0)updateScanStatus(`分析 ${cnt}/${toEnrich.length}...`,70+Math.round(cnt/toEnrich.length*25));
    }
  }
  scanResults=results; isScanning=false;
  updateScanStatus(`✅ 完成！找到 ${results.length} 只符合「${strategy.name}」的股票`,100);
  renderScanResults();
  try{localStorage.setItem('lastScan_'+strategy.id,JSON.stringify({time:Date.now(),count:results.length}))}catch{}
}
