// ========== SCAN ENGINE ==========
function parseQQStock(s){
  const code=s.code||''; const name=s.name||'';
  if(!code||!name)return null;
  const isST=name.includes('ST')||name.includes('*ST')||name.includes('退');
  const sym=s.symbol||'';
  const isSH=sym.startsWith('sh');
  const isGEM=code.startsWith('3');
  const secid=isSH?'1.'+code:'0.'+code;
  return {
    code,name,secid,isHK:false,isST,isGEM,
    market:isSH?'SH':'SZ',
    sinaSymbol:sym,
    close:s.close, open:s.open, high:s.high, low:s.low,
    preClose:s.preClose, pctChg:s.pctChg, chg:s.chg,
    vol:s.vol, amount:s.amount, volRatio:s.volRatio,
    turnover:s.turnover, pe:s.pe, pb:s.pb,
    totalMv:s.totalMv, circMv:s.circMv, amp:s.amp,
    ma5:null,ma10:null,ma20:null,ma30:null,ma60:null,
    dif:null,dea:null,macdHist:null,
    d1Close:null,d1Vol:null,d1PctChg:null,d2Close:null,d2Open:null,d2Vol:null
  };
}

// 保留东方财富格式兼容
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

function enrichWithKline(stock,bars){
  if(!bars||bars.length<5)return;
  const closes=bars.map(b=>b.close); const vols=bars.map(b=>b.vol); const n=closes.length;
  stock.ma5=maLast(closes,5); stock.ma10=maLast(closes,10); stock.ma20=maLast(closes,20);
  stock.ma30=maLast(closes,30); stock.ma60=maLast(closes,60);
  const ema12=emaCalc(closes,12),ema26=emaCalc(closes,26);
  const dif=ema12.map((v,i)=>v-ema26[i]); const dea=emaCalc(dif,9);
  stock.dif=dif[n-1]; stock.dea=dea[n-1]; stock.macdHist=(dif[n-1]-dea[n-1])*2;
  if(n>=6){
    const avg5Vol=(vols[n-6]+vols[n-5]+vols[n-4]+vols[n-3]+vols[n-2])/5;
    if(avg5Vol>0) stock.volRatio=vols[n-1]/avg5Vol;
  }
  if(n>=3){
    stock.d1Close=bars[n-3].close; stock.d1Vol=bars[n-3].vol;
    if(n>=4) stock.d1PctChg=(bars[n-3].close-bars[n-4].close)/bars[n-4].close*100;
    stock.d2Close=bars[n-2].close; stock.d2Open=bars[n-2].open; stock.d2Vol=bars[n-2].vol;
    stock.vol=bars[n-1].vol||stock.vol;
  }
}

function enrichWithKlineStrings(stock,klines){
  if(!klines||klines.length<5)return;
  const bars=klines.map(k=>{const p=k.split(',');return{open:+p[1],close:+p[2],high:+p[3],low:+p[4],vol:+p[5]};});
  enrichWithKline(stock,bars);
}

function updateScanStatus(text,pct){
  const el=document.getElementById('scanStatus'); const bar=document.getElementById('scanProgress');
  if(el)el.textContent=text; if(bar)bar.style.width=pct+'%';
}

async function runScan(strategy){
  if(isScanning)return; isScanning=true; scanResults=[]; scanPage=1;
  updateScanStatus('正在生成A股代码列表...',3);

  // ===== 第一步：生成全部可能的A股代码并批量获取实时数据 =====
  const allCodes=generateAllAStockCodes();
  const BATCH=50; // 每批50个代码
  const totalBatches=Math.ceil(allCodes.length/BATCH);
  let allStocks=[];
  let failCount=0;

  for(let b=0;b<totalBatches;b++){
    const batch=allCodes.slice(b*BATCH,(b+1)*BATCH);
    try{
      const results=await fetchBatchQQ(batch);
      if(results&&results.length>0){
        allStocks=allStocks.concat(results);
        failCount=0;
      }
    }catch(e){
      failCount++;
      if(failCount>=5){
        console.error('连续请求失败5次，停止');
        break;
      }
    }
    // 每10批更新一次进度
    if(b%10===0||b===totalBatches-1){
      const pct=Math.min(50,3+Math.round(b/totalBatches*47));
      updateScanStatus(`扫描A股市场... ${allStocks.length}只 (${Math.round(b/totalBatches*100)}%)`,pct);
    }
  }

  if(allStocks.length===0){
    isScanning=false;
    updateScanStatus('❌ 获取市场数据失败，请稍后重试',100);
    renderScanResults(); return;
  }

  updateScanStatus(`共获取 ${allStocks.length} 只A股，正在筛选...`,55);

  // ===== 第二步：转换为标准格式并过滤 =====
  const candidates=[];
  for(const s of allStocks){
    if(!s.close||s.close===0)continue;
    const item=parseQQStock(s);
    if(item)candidates.push(item);
  }
  updateScanStatus(`有效 ${candidates.length} 只，应用「${strategy.name}」...`,58);

  // ===== 第三步：根据策略类型进行筛选 =====
  const needKline=['denggao_wangyuan'];
  let results;

  if(strategy.id==='quant'){
    const filtered=candidates.filter(QUANT_STRATEGY.check);
    results=QUANT_STRATEGY.rank(filtered);
  } else if(needKline.includes(strategy.id)){
    const pre=candidates.filter(s=>s.pctChg>=3);
    updateScanStatus(`预筛选 ${pre.length} 只候选，获取K线...`,62);
    const toCheck=pre.slice(0,200); let checked=0; results=[];
    for(const s of toCheck){
      try{
        const klineBars=await fetchKlineQQ(s.sinaSymbol,10);
        if(klineBars&&klineBars.length>=3){
          enrichWithKline(s,klineBars);
          if(strategy.check(s))results.push(s);
        }
      }catch{}
      checked++;
      if(checked%20===0){
        updateScanStatus(`K线验证 ${checked}/${toCheck.length}...`,62+Math.round(checked/toCheck.length*33));
      }
    }
  } else {
    // 其他战法：先用行情数据预筛选，再获取K线做技术分析
    const qf=candidates.filter(s=>{
      if(strategy.id==='junxian_qinlong')return s.pctChg>0;
      if(strategy.id==='shuangyang_chuguan')return s.pctChg>3;
      if(strategy.id==='hongxing_chuqiang')return s.pctChg>0;
      if(strategy.id==='shimian_maifu')return s.pctChg<0;
      if(strategy.id==='gongji_poxian')return s.pctChg>=9.5;
      if(strategy.id==='shangxia_xipan')return true;
      if(strategy.id==='yiye_maimai')return s.turnover>=5&&s.turnover<=10;
      return true;
    });
    updateScanStatus(`预筛选 ${qf.length} 只，获取K线数据...`,62);
    const toEnrich=qf.slice(0,500); results=[]; let cnt=0;
    for(let i=0;i<toEnrich.length;i+=10){
      const batch=toEnrich.slice(i,i+10);
      await Promise.all(batch.map(async s=>{
        try{
          const klineBars=await fetchKlineQQ(s.sinaSymbol,65);
          if(klineBars&&klineBars.length>=5){
            enrichWithKline(s,klineBars);
            if(strategy.check(s))results.push(s);
          }
        }catch{}
      }));
      cnt+=batch.length;
      if(cnt%50===0){
        updateScanStatus(`技术分析 ${cnt}/${toEnrich.length}...`,62+Math.round(cnt/toEnrich.length*33));
      }
    }
  }

  scanResults=results; isScanning=false;
  updateScanStatus(`✅ 完成！找到 ${results.length} 只符合「${strategy.name}」的股票`,100);
  renderScanResults();
  try{localStorage.setItem('lastScan_'+strategy.id,JSON.stringify({time:Date.now(),count:results.length}))}catch{}
}
