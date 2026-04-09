// ========== INIT ==========
window.addEventListener('DOMContentLoaded',()=>{
  loadWatchlist(); renderSidebar(); renderMainContent();
  fetchIndexData(); updateClock();
  setInterval(updateClock,1000); setInterval(fetchIndexData,30000);
  setupSearch(); startAutoRefresh();
});
function loadWatchlist(){try{const s=localStorage.getItem('sw');watchlist=s?JSON.parse(s):[...DEFAULT_WATCHLIST]}catch{watchlist=[...DEFAULT_WATCHLIST]}}
function saveWatchlist(){localStorage.setItem('sw',JSON.stringify(watchlist))}

// ========== CLOCK ==========
function updateClock(){
  const now=new Date();document.getElementById('clockTime').textContent=now.toLocaleTimeString('zh-CN');
  const dot=document.getElementById('statusDot'),txt=document.getElementById('statusText');
  const h=now.getHours(),m=now.getMinutes(),day=now.getDay(),t=h*60+m;
  const wd=day>=1&&day<=5;
  const aT=wd&&((t>=570&&t<=690)||(t>=780&&t<=900));
  const hkT=wd&&((t>=570&&t<=720)||(t>=780&&t<=960));
  if(aT||hkT){dot.className='status-dot open';txt.textContent=aT&&hkT?'A股+港股 交易中':aT?'A股 交易中':'港股 交易中'}
  else{dot.className='status-dot';txt.textContent='休市'}
}

// ========== TABS ==========
function switchTab(tab,btn){
  currentTab=tab;
  document.querySelectorAll('.tab-btn').forEach(b=>b.classList.remove('active'));
  btn.classList.add('active');
  renderSidebar(); renderMainContent();
}

// ========== JSONP & API ==========
function jsonp(url){
  return new Promise((resolve,reject)=>{
    const cb='jQuery'+Math.floor(Math.random()*9e16)+'_'+Date.now();
    const s=document.createElement('script');
    const t=setTimeout(()=>{cleanup();reject(new Error('Timeout'))},15000);
    function cleanup(){clearTimeout(t);delete window[cb];if(s.parentNode)s.parentNode.removeChild(s)}
    window[cb]=(d)=>{cleanup();resolve(d)};
    s.src=url+(url.includes('?')?'&':'?')+'cb='+cb+'&_='+Date.now();
    s.onerror=()=>{cleanup();reject(new Error('JSONP error'))};
    document.head.appendChild(s);
  });
}
async function smartFetch(url){
  for(let retry=0;retry<3;retry++){
    try{return await jsonp(url)}catch(e1){
      try{const r=await fetch(url);return await r.json()}catch(e2){}
    }
    if(retry<2) await new Promise(r=>setTimeout(r,500*(retry+1)));
  }
  return null;
}
function getSecid(code,market){
  if(market==='HK')return '116.'+code;
  if(code.startsWith('6')||code.startsWith('9')||code.startsWith('11')||code.startsWith('5'))return '1.'+code;
  return '0.'+code;
}

// ========== 东方财富API（单股详情、指数、搜索仍可用） ==========
// 腾讯API获取单股详情（替代东方财富stock/get）
async function fetchQuoteQQ(secid){
  const parts=secid.split('.');
  let symbol='';
  if(parts[0]==='1') symbol='sh'+parts[1];
  else if(parts[0]==='0') symbol='sz'+parts[1];
  else if(parts[0]==='116'||parts[0]==='128'||parts[0]==='100') symbol='hk'+parts[1];
  else symbol='sh'+parts[1];
  try{
    const r=await fetch('https://web.sqt.gtimg.cn/q='+symbol);
    const buf=await r.arrayBuffer();
    const text=new TextDecoder('gbk').decode(buf);
    const m=text.match(/v_[^=]+="([^"]*)"/);
    if(!m)return null;
    const f=m[1].split('~');
    if(f.length<50||!f[1])return null;
    // 映射为东方财富fetchQuote的字段格式，保持detail.js和ui.js兼容
    return {
      f43: parseFloat(f[3])||0,    // 最新价
      f44: parseFloat(f[33])||0,   // 最高
      f45: parseFloat(f[34])||0,   // 最低
      f46: parseFloat(f[5])||0,    // 今开
      f47: parseInt(f[6])||0,      // 成交量(手)
      f48: parseFloat(f[37])*10000||0, // 成交额
      f49: 0,
      f50: parseFloat(f[49])||0,   // 量比
      f51: 0, f52: 0, f55: 0,
      f57: f[2],                    // 代码
      f58: f[1],                    // 名称
      f60: parseFloat(f[4])||0,    // 昨收
      f116: parseFloat(f[44])*1e8||0, // 总市值
      f117: parseFloat(f[45])*1e8||0, // 流通市值
      f162: parseFloat(f[39])||0,  // PE
      f168: parseFloat(f[38])||0,  // 换手率
      f169: parseFloat(f[31])||0,  // 涨跌额
      f170: parseFloat(f[32])||0,  // 涨跌幅
      f171: parseFloat(f[43])||0,  // 振幅
      f292: 0, f13: 0
    };
  }catch(e){
    console.error('腾讯单股API失败:',e);
    return null;
  }
}

async function fetchQuote(secid){
  // 优先使用腾讯API
  const qqData=await fetchQuoteQQ(secid);
  if(qqData&&qqData.f43)return qqData;
  // 回退东方财富
  const url=`https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f49,f50,f51,f52,f55,f57,f58,f60,f116,f117,f162,f168,f169,f170,f171,f292,f13&ut=fa5fd1943c7b386f172d6893dbbd1d0c&fltt=2`;
  const d=await smartFetch(url);return d?.data||null;
}

// 腾讯分时线API（替代东方财富trends2/get）
async function fetchMinuteQQ(secid){
  const parts=secid.split('.');
  let symbol='';
  if(parts[0]==='1') symbol='sh'+parts[1];
  else if(parts[0]==='0') symbol='sz'+parts[1];
  else if(parts[0]==='116'||parts[0]==='128'||parts[0]==='100') symbol='hk'+parts[1];
  else symbol='sh'+parts[1];
  try{
    const r=await fetch(`https://web.ifzq.gtimg.cn/appstock/app/minute/query?_var=min_data&code=${symbol}`);
    const text=await r.text();
    // 腾讯分时返回格式: min_data={...}
    const jsonStr=text.replace(/^[^{]*/,'').replace(/;?\s*$/,'');
    const d=JSON.parse(jsonStr);
    const key=Object.keys(d.data||{})[0];
    if(!key||!d.data[key])return null;
    const info=d.data[key].qt||{};
    const qtArr=info[key]||[];
    const preClose=parseFloat(qtArr[4])||0;
    const minuteData=d.data[key].data?.data||d.data[key].data?.today||[];
    if(!minuteData.length)return null;
    // 腾讯分时格式: "时间 价格 累计成交量(手) 累计成交额"
    // 需要转换为: "时间,价格,均价,当分钟成交量"
    let prevCumVol=0;
    const trends=minuteData.map(line=>{
      const parts2=line.split(' ');
      const time=parts2[0];
      const price=parseFloat(parts2[1])||0;
      const cumVol=parseInt(parts2[2])||0;
      const cumAmount=parseFloat(parts2[3])||0;
      const minVol=cumVol-prevCumVol; // 当分钟成交量
      prevCumVol=cumVol;
      const avg=cumVol>0?(cumAmount/(cumVol*100)).toFixed(2):price.toFixed(2); // 成交额/(累计量*100)=均价
      return `${time.substring(0,2)}:${time.substring(2,4)},${price},${avg},${minVol}`;
    });
    return {trends:trends, prePrice:preClose};
  }catch(e){
    console.error('腾讯分时API失败:',e);
    return null;
  }
}

async function fetchMinute(secid){
  // 优先使用腾讯API
  const qqData=await fetchMinuteQQ(secid);
  if(qqData&&qqData.trends&&qqData.trends.length>0)return qqData;
  // 回退东方财富
  const url=`https://push2his.eastmoney.com/api/qt/stock/trends2/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ut=fa5fd1943c7b386f172d6893dbbd1d0c&iscr=0&ndays=1`;
  const d=await smartFetch(url);return d?.data||null;
}

// 腾讯指数行情API（替代东方财富ulist.np/get）
async function fetchIndexDataQQ(){
  const codes='sh000001,sz399001,sz399006,hkHSI,hkHSTECH';
  const nameMap={'000001':'上证指数','399001':'深证成指','399006':'创业板指','HSI':'恒生指数','HSTECH':'恒生科技'};
  try{
    const r=await fetch('https://web.sqt.gtimg.cn/q='+codes);
    const buf=await r.arrayBuffer();
    const text=new TextDecoder('gbk').decode(buf);
    const results=[];
    const lines=text.split('\n');
    for(const line of lines){
      const m2=line.match(/v_([^=]+)="([^"]*)"/);
      if(!m2)continue;
      const f=m2[1].split('~');
      const fields=m2[2].split('~');
      if(fields.length<35)continue;
      const code=fields[2]||m2[1].replace(/^(sh|sz|hk)/,'');
      results.push({
        f14: fields[1]||nameMap[code]||code,
        f2: parseFloat(fields[3])||0,
        f3: parseFloat(fields[32])||0
      });
    }
    return results;
  }catch(e){return null}
}

async function fetchIndexData(){
  // 先尝试腾讯API
  try{
    const qqResults=await fetchIndexDataQQ();
    if(qqResults&&qqResults.length>0){
      const bar=document.getElementById('indexBar');
      bar.innerHTML=qqResults.map(i=>{const c=i.f3>0?'up':i.f3<0?'down':'flat';return `<div class="index-item"><span class="index-name">${i.f14}</span><span class="index-val ${c}">${fmtN(i.f2)}</span><span class="index-val ${c}">${i.f3>0?'+':''}${i.f3?.toFixed(2)||'--'}%</span></div>`}).join('');
      return;
    }
  }catch(e){}
  // 回退东方财富
  const ids='1.000001,0.399001,0.399006,100.HSI,100.HSTECH';
  const url=`https://push2.eastmoney.com/api/qt/ulist.np/get?secids=${ids}&fields=f2,f3,f4,f12,f14&ut=fa5fd1943c7b386f172d6893dbbd1d0c&fltt=2`;
  try{const d=await smartFetch(url);const bar=document.getElementById('indexBar');
    if(d?.data?.diff){bar.innerHTML=d.data.diff.map(i=>{const c=i.f3>0?'up':i.f3<0?'down':'flat';return `<div class="index-item"><span class="index-name">${i.f14}</span><span class="index-val ${c}">${fmtN(i.f2)}</span><span class="index-val ${c}">${i.f3>0?'+':''}${i.f3?.toFixed(2)||'--'}%</span></div>`}).join('')}
  }catch{}
}
async function searchStock(kw){
  if(!kw||kw.length<1)return[];
  const url=`https://searchapi.eastmoney.com/api/suggest/get?input=${encodeURIComponent(kw)}&type=14&token=D43BF722C8E33BDC906FB84D85E326E8&count=10`;
  try{const d=await smartFetch(url);if(d?.QuotationCodeTable?.Data)return d.QuotationCodeTable.Data.filter(x=>['0','1','116','128','100'].includes(x.MktNum)).map(x=>({code:x.Code,name:x.Name,market:['116','128','100'].includes(x.MktNum)?'HK':'A',secid:x.MktNum+'.'+x.Code}))}catch{}
  return[];
}

// ========== 腾讯行情API（支持CORS，全市场数据） ==========
// 生成A股全部可能的代码列表
function generateAllAStockCodes(){
  const codes=[];
  // 上海主板 600000-601999
  for(let i=600000;i<=601999;i++) codes.push('sh'+i);
  // 上海主板 603000-603999
  for(let i=603000;i<=603999;i++) codes.push('sh'+i);
  // 上海主板 605000-605499
  for(let i=605000;i<=605499;i++) codes.push('sh'+i);
  // 上海科创板 688000-688999
  for(let i=688000;i<=688999;i++) codes.push('sh'+i);
  // 深圳主板 000001-002999
  for(let i=1;i<=2999;i++) codes.push('sz'+String(i).padStart(6,'0'));
  // 深圳创业板 300000-301999
  for(let i=300000;i<=301999;i++) codes.push('sz'+i);
  return codes;
}

// 批量获取腾讯行情数据（支持CORS）
async function fetchBatchQQ(codeList){
  const query=codeList.join(',');
  try{
    const r=await fetch('https://web.sqt.gtimg.cn/q='+query);
    // 腾讯API返回GBK编码，需要用TextDecoder解码
    const buf=await r.arrayBuffer();
    const text=new TextDecoder('gbk').decode(buf);
    const results=[];
    const lines=text.split('\n');
    for(const line of lines){
      const m=line.match(/v_([^=]+)="([^"]*)"/);
      if(!m)continue;
      const sym=m[1]; // sh600519
      const fields=m[2].split('~');
      if(fields.length<50||!fields[1]||fields[3]==='0.000'||fields[3]==='0.00'||fields[3]==='')continue;
      results.push({
        symbol:sym,
        code:fields[2],
        name:fields[1],
        close:parseFloat(fields[3])||0,
        preClose:parseFloat(fields[4])||0,
        open:parseFloat(fields[5])||0,
        vol:parseInt(fields[6])||0,        // 成交量(手)
        chg:parseFloat(fields[31])||0,      // 涨跌额
        pctChg:parseFloat(fields[32])||0,   // 涨跌幅%
        high:parseFloat(fields[33])||0,
        low:parseFloat(fields[34])||0,
        amount:parseFloat(fields[37])*10000||0, // 成交额(万转元)
        turnover:parseFloat(fields[38])||0, // 换手率%
        pe:parseFloat(fields[39])||0,       // PE
        amp:parseFloat(fields[43])||0,      // 振幅%
        totalMv:parseFloat(fields[44])*1e8||0, // 总市值(亿转元)
        circMv:parseFloat(fields[45])*1e8||0,  // 流通市值(亿转元)
        pb:parseFloat(fields[46])||0,       // PB
        volRatio:parseFloat(fields[49])||0  // 量比
      });
    }
    return results;
  }catch(e){
    console.error('腾讯行情API失败:',e);
    return [];
  }
}

// ========== 腾讯K线API（支持CORS） ==========
async function fetchKlineQQ(symbol,count){
  count=count||65;
  const url=`https://web.ifzq.gtimg.cn/appstock/app/fqkline/get?param=${symbol},day,,,${count},qfq`;
  try{
    const r=await fetch(url);
    const d=await r.json();
    const key=Object.keys(d.data||{})[0];
    if(!key)return null;
    const dayData=d.data[key].qfqday||d.data[key].day;
    if(!dayData)return null;
    return dayData.map(bar=>({
      date:bar[0],open:parseFloat(bar[1]),close:parseFloat(bar[2]),
      high:parseFloat(bar[3]),low:parseFloat(bar[4]),vol:parseFloat(bar[5])*100
    }));
  }catch(e){return null}
}

// 兼容旧代码 - fetchKline使用腾讯API优先
async function fetchKline(secid,period,count){
  count=count||120;
  const parts=secid.split('.');
  let symbol='';
  if(parts[0]==='1') symbol='sh'+parts[1];
  else if(parts[0]==='0') symbol='sz'+parts[1];
  else if(parts[0]==='116') symbol='hk'+parts[1];
  else symbol='sh'+parts[1];
  const qqData=await fetchKlineQQ(symbol,count);
  if(qqData&&qqData.length>0){
    return {code:parts[1],klines:qqData.map(b=>`${b.date},${b.open},${b.close},${b.high},${b.low},${b.vol},0,0,0,0,0`)};
  }
  // 回退东方财富
  const url=`https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=${period}&fqt=1&end=20500101&lmt=${count}&ut=fa5fd1943c7b386f172d6893dbbd1d0c`;
  const d=await smartFetch(url);return d?.data||null;
}

// 保留旧接口兼容
async function fetchMarketStocks(market,page,size){
  let fs;
  if(market==='A') fs='m:0+t:6,m:0+t:80,m:1+t:2,m:1+t:23';
  else fs='m:128+t:3,m:128+t:4,m:128+t:1,m:128+t:2';
  const fields='f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13,f14,f15,f16,f17,f18,f20,f21,f23,f24,f25,f62,f115,f128,f140,f141,f136';
  const url=`https://push2.eastmoney.com/api/qt/clist/get?pn=${page}&pz=${size}&po=1&np=1&fltt=2&invt=2&fs=${fs}&fields=${fields}&ut=fa5fd1943c7b386f172d6893dbbd1d0c`;
  try{const d=await smartFetch(url);return d?.data||null}catch{return null}
}

// ========== FORMAT ==========
function fmtN(v,d){if(v==null||v==='-')return'--';const n=parseFloat(v);if(isNaN(n))return'--';return n.toFixed(d!==undefined?d:2)}
function fmtVol(v){if(!v||v==='-')return'--';const n=parseFloat(v);if(n>=1e12)return(n/1e12).toFixed(2)+'万亿';if(n>=1e8)return(n/1e8).toFixed(2)+'亿';if(n>=1e4)return(n/1e4).toFixed(2)+'万';return n.toFixed(0)}
function fmtMv(v){if(!v)return'--';if(v>=1e12)return(v/1e12).toFixed(1)+'万亿';if(v>=1e8)return(v/1e8).toFixed(1)+'亿';if(v>=1e4)return(v/1e4).toFixed(1)+'万';return v.toFixed(0)}
function maLast(arr,p){if(arr.length<p)return null;let s=0;for(let i=arr.length-p;i<arr.length;i++)s+=arr[i];return s/p}
function emaCalc(data,period){const k=2/(period+1);const r=[data[0]];for(let i=1;i<data.length;i++)r.push(data[i]*k+r[i-1]*(1-k));return r}
function calcMa(arr,p){return arr.map((_,i)=>{if(i<p-1)return null;let s=0;for(let j=0;j<p;j++)s+=arr[i-j];return s/p})}
