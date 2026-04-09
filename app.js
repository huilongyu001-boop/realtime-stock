// ========== GLOBAL STATE ==========
let currentTab = 'screen';
let currentStrategy = null;
let watchlist = [];
let currentStock = null;
let currentMarketFilter = 'all';
let scanResults = [];
let scanPage = 1;
const SCAN_PAGE_SIZE = 50;
let scanSort = {field:'pctChg',dir:'desc'};
let isScanning = false;

// ========== STRATEGIES ==========
const STRATEGIES = [
  { id:'junxian_qinlong', name:'均线擒龙', icon:'🐉', color:'#f59e0b',
    desc:'10/30日线穿60日线+阳线放量+站上MA5',
    conditions:['MA10>MA60','MA30>MA60','阳线','放量(量比>1)','MA5≥MA10'],
    check:(b)=>{ if(!b.ma5||!b.ma10||!b.ma30||!b.ma60) return false; return b.ma10>b.ma60 && b.ma30>b.ma60 && b.close>b.open && b.volRatio>1 && b.ma5>=b.ma10; }
  },
  { id:'shuangyang_chuguan', name:'双阳出关', icon:'☀️', color:'#ef4444',
    desc:'大阳线穿均线+放量+站上MA5和MA20',
    conditions:['涨幅>3%','阳线','放量(量比>1.2)','站上MA5','突破MA20'],
    check:(b)=>{ if(!b.ma5||!b.ma20) return false; return b.pctChg>3 && b.close>b.open && b.volRatio>1.2 && b.close>b.ma5 && b.close>b.ma20; }
  },
  { id:'hongxing_chuqiang', name:'红杏出墙', icon:'🌸', color:'#ec4899',
    desc:'5日线上穿10/20日线+回踩MA5+收阳',
    conditions:['MA5>MA10','MA5>MA20','回踩MA5(±2%)','阳线'],
    check:(b)=>{ if(!b.ma5||!b.ma10||!b.ma20) return false; const near=Math.abs(b.low-b.ma5)/b.ma5<0.02; return b.ma5>b.ma10 && b.ma5>b.ma20 && b.close>b.open && near; }
  },
  { id:'shimian_maifu', name:'十面埋伏', icon:'⚔️', color:'#8b5cf6',
    desc:'缩量回调+MACD底背离+接近MA60支撑',
    conditions:['缩量(量比<0.8)','低于MA20','MACD柱翻红','DIF<0','接近MA60(±3%)'],
    check:(b)=>{ if(!b.ma20||!b.ma60||!b.dif) return false; const near=b.ma60>0&&Math.abs(b.close-b.ma60)/b.ma60<0.03; return b.volRatio<0.8 && b.close<b.ma20 && b.macdHist>0 && b.dif<0 && near; }
  },
  { id:'denggao_wangyuan', name:'登高望远', icon:'🏔️', color:'#06b6d4',
    desc:'前日涨停→跳空高开涨5-6%→今日缩量收阳不破涨停价',
    conditions:['3日前涨停','2日前涨5-6%跳空','量<涨停量70%','今日缩量收阳'],
    check:(b)=>{ if(!b.d1Close||!b.d2Close||!b.d2Open) return false; return b.d1PctChg>=9.5 && b.d2Open>b.d1Close && ((b.d2Close-b.d1Close)/b.d1Close*100)>=5 && ((b.d2Close-b.d1Close)/b.d1Close*100)<=6 && b.d2Vol<b.d1Vol*0.7 && b.vol<b.d2Vol && b.close>b.open && b.low>=b.d1Close && b.low>=b.d2Open; }
  },
  { id:'gongji_poxian', name:'攻击迫线', icon:'⚡', color:'#f97316',
    desc:'涨停+跳空高开+不回补缺口+放量',
    conditions:['涨停(≥9.5%)','跳空高开','最低>昨收','放量(量比>1.5)'],
    check:(b)=>{ const limit=b.pctChg>=9.5||(b.isGEM&&b.pctChg>=19); return limit && b.open>b.preClose && b.low>b.preClose && b.volRatio>1.5; }
  },
  { id:'shangxia_xipan', name:'上下洗盘', icon:'🌀', color:'#14b8a6',
    desc:'长上影线+回踩MA10/MA20+前期上涨趋势',
    conditions:['长上影线(>实体2倍)','回踩MA10或MA20','MA5>MA20'],
    check:(b)=>{ if(!b.ma5||!b.ma10||!b.ma20) return false; const body=Math.abs(b.close-b.open); const upper=b.high-Math.max(b.close,b.open); const near=Math.abs(b.low-b.ma10)/b.ma10<0.02||Math.abs(b.low-b.ma20)/b.ma20<0.02; return upper>body*2 && near && b.ma5>b.ma20; }
  },
  { id:'yiye_maimai', name:'一夜买卖', icon:'🌙', color:'#a855f7',
    desc:'量比>1+换手5-10%+中盘股+站上MA5/MA10',
    conditions:['量比>1','换手率5-10%','流通市值50-200亿','站上MA5+MA10'],
    check:(b)=>{ if(!b.ma5||!b.ma10) return false; return b.volRatio>1 && b.turnover>=5 && b.turnover<=10 && b.circMv>=50e8 && b.circMv<=200e8 && b.close>b.ma5 && b.close>b.ma10; }
  }
];

const QUANT_STRATEGY = {
  id:'quant', name:'量化多因子选股', icon:'🤖', color:'#fbbf24',
  desc:'低PE+低PB+小市值 多因子排序前20',
  conditions:['PE(TTM) 0~30','PB 0~5','涨跌幅>-5%','非ST/退市','多因子排序取TOP20'],
  check:(b)=>b.pe>0&&b.pe<30&&b.pb>0&&b.pb<5&&b.pctChg>-5&&!b.isST,
  rank:(list)=>list.map(s=>{let sc=0;if(s.totalMv>0)sc+=(1/(s.totalMv/1e8))*40;if(s.pe>0)sc+=(1/s.pe)*30;if(s.pb>0)sc+=(1/s.pb)*30;return{...s,quantScore:sc}}).sort((a,b)=>b.quantScore-a.quantScore).slice(0,20)
};

const DEFAULT_WATCHLIST = [
  {code:'000001',market:'A',name:'上证指数',isIndex:true,secid:'1.000001'},
  {code:'399001',market:'A',name:'深证成指',isIndex:true,secid:'0.399001'},
  {code:'399006',market:'A',name:'创业板指',isIndex:true,secid:'0.399006'},
  {code:'600519',market:'A',name:'贵州茅台',secid:'1.600519'},
  {code:'000858',market:'A',name:'五粮液',secid:'0.000858'},
  {code:'300750',market:'A',name:'宁德时代',secid:'0.300750'},
  {code:'00700',market:'HK',name:'腾讯控股',secid:'116.00700'},
  {code:'09988',market:'HK',name:'阿里巴巴-W',secid:'116.09988'},
  {code:'09888',market:'HK',name:'百度集团-SW',secid:'116.09888'},
];
