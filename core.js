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
async function smartFetch(url){try{return await jsonp(url)}catch{try{const r=await fetch(url);return await r.json()}catch{return null}}}
function getSecid(code,market){
  if(market==='HK')return '116.'+code;
  if(code.startsWith('6')||code.startsWith('9')||code.startsWith('11')||code.startsWith('5'))return '1.'+code;
  return '0.'+code;
}
async function fetchQuote(secid){
  const url=`https://push2.eastmoney.com/api/qt/stock/get?secid=${secid}&fields=f43,f44,f45,f46,f47,f48,f49,f50,f51,f52,f55,f57,f58,f60,f116,f117,f162,f168,f169,f170,f171,f292,f13&ut=fa5fd1943c7b386f172d6893dbbd1d0c&fltt=2`;
  const d=await smartFetch(url);return d?.data||null;
}
async function fetchMinute(secid){
  const url=`https://push2his.eastmoney.com/api/qt/stock/trends2/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58&ut=fa5fd1943c7b386f172d6893dbbd1d0c&iscr=0&ndays=1`;
  const d=await smartFetch(url);return d?.data||null;
}
async function fetchKline(secid,period,count){
  count=count||120;
  const url=`https://push2his.eastmoney.com/api/qt/stock/kline/get?secid=${secid}&fields1=f1,f2,f3,f4,f5,f6,f7,f8,f9,f10,f11,f12,f13&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61&klt=${period}&fqt=1&end=20500101&lmt=${count}&ut=fa5fd1943c7b386f172d6893dbbd1d0c`;
  const d=await smartFetch(url);return d?.data||null;
}
async function fetchIndexData(){
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
