/* ============================================================================
   売上ダッシュボード
   ----------------------------------------------------------------------------
   表示項目の定義（ITEMS）を1か所に集約し、パネル・KPI・表・CSVがすべて
   同じ定義を見るようにしている。項目を足すときはITEMSに1行足すだけで、
   パネルにも表にも反映される。
   ========================================================================== */
'use strict';

const S = window.SalesData;
const $ = id => document.getElementById(id);

const yen  = n => '¥' + Math.round(n).toLocaleString('ja-JP');
const num  = n => Math.round(n).toLocaleString('ja-JP');
const hm   = m => Math.floor(m / 60) + 'h' + (Math.round(m % 60) ? String(Math.round(m % 60)).padStart(2,'0') + 'm' : '');
const DOW  = ['日','月','火','水','木','金','土'];
const mdw  = d => { const t = new Date(d + 'T00:00:00');
  return (t.getMonth()+1) + '/' + t.getDate() + '(' + DOW[t.getDay()] + ')'; };

/* ================= 表示項目の定義 =================
   locked:true は非表示にできない項目（これを消すと画面の意味が無くなるもの）   */
const ITEMS = {
  kpi: [
    { key:'total',    label:'総売上',      locked:true,
      tip:'期間内に実際に入金された金額。新規＋継続＋物販から返金を差し引いた額です。' },
    { key:'mix',      label:'総売上の内訳バー',
      tip:'総売上を新規・継続・物販の構成比で表示します。' },
    { key:'forecast', label:'予測売上',
      tip:'期間内に見込まれる売上。実績との比較で達成率を出します。※算出根拠は要確認' },
    { key:'shouka',   label:'消化売上',
      tip:'サービスを提供した分の金額。入金とは別の数え方で、回数券やサブスクの利用分を含みます。' },
    { key:'kaishu',   label:'回収分',
      tip:'消化売上のうち、回数券・サブスクを使った分。この期間の入金は発生しません。' },
    { key:'visits',   label:'来店・キャンセル・無断',
      tip:'期間内の来店人数と、キャンセル・無断キャンセルの件数。' },
  ],
  chart: [
    { key:'chart', label:'日次推移グラフ',
      tip:'日ごとの売上を新規・継続・物販の積み上げで表示します。' },
  ],
  staff: [
    { key:'name',     label:'スタッフ', locked:true },
    { key:'forecast', label:'予測売上' },
    { key:'total',    label:'総売上',   locked:true },
    { key:'shinki',   label:'新規売上' },
    { key:'keizoku',  label:'継続売上' },
    { key:'buppan',   label:'物販' },
    { key:'shouka',   label:'消化売上' },
    { key:'kaishu',   label:'回収分' },
    { key:'refund',   label:'返金' },
    { key:'count',    label:'件数' },
    { key:'unit',     label:'客単価' },
    { key:'openMin',  label:'予約開放時間' },
    { key:'workMin',  label:'稼働時間' },
    { key:'rate',     label:'稼働率' },
    { key:'shinkiCount', label:'新規数' },
    { key:'buyCount', label:'購入数' },
    { key:'buyRate',  label:'購入率' },
    { key:'gReview',  label:'Google口コミ' },
    { key:'hReview',  label:'HPB口コミ' },
  ],
  daily: [
    { key:'date',    label:'日付', locked:true },
    { key:'total',   label:'合計売上', locked:true },
    { key:'shinki',  label:'新規売上' },
    { key:'keizoku', label:'継続売上' },
    { key:'buppan',  label:'物販' },
    { key:'refund',  label:'返金' },
    { key:'shouka',  label:'消化売上' },
    { key:'kaishu',  label:'回収分' },
    { key:'visits',  label:'来店' },
    { key:'cancel',  label:'キャンセル' },
    { key:'rate',    label:'稼働率' },
    { key:'pay',     label:'決済内訳' },
    { key:'media',   label:'媒体別 新規' },
  ],
  feature: [
    { key:'newBasis', label:'新規売上の集計対象',
      tip:'初回に複数日通うコースを扱う店舗向け。何日目の売上として計上するかを切り替えます。※定義は要確認' },
  ],
};

/* 標準で表示する項目。物販・回収分・口コミなど、店舗によって使わないものは
   標準ではオフにしておき、使う店舗だけオンにしてもらう想定 */
const PRESETS = {
  simple: { name:'シンプル',
    kpi:['total','mix','visits'], chart:['chart'],
    staff:['name','total','count','unit','rate','shinkiCount'],
    daily:['date','total','shinki','keizoku','visits','rate'], feature:[] },
  standard:{ name:'標準',
    kpi:['total','mix','forecast','shouka','visits'], chart:['chart'],
    staff:['name','total','shinki','keizoku','shouka','count','unit','openMin','workMin','rate','shinkiCount'],
    daily:['date','total','shinki','keizoku','refund','shouka','visits','cancel','rate','pay','media'],
    feature:[] },
  all:     { name:'すべて',
    kpi:null, chart:null, staff:null, daily:null, feature:null },   // null = 全部
};

let vis = {};             // { kpi:Set, chart:Set, staff:Set, daily:Set, feature:Set }
let basis = 'all';        // 新規売上の集計対象
let quick = null;         // クイック期間の選択

function applyPreset(p){
  const def = PRESETS[p];
  vis = {};
  Object.keys(ITEMS).forEach(g => {
    const allow = def[g];
    vis[g] = new Set(allow === null
      ? ITEMS[g].map(i => i.key)
      : ITEMS[g].filter(i => i.locked || allow.indexOf(i.key) > -1).map(i => i.key));
  });
}
const on = (g, k) => vis[g].has(k);

/* ================= ページ ================= */
const SVG_UP = '<svg viewBox="0 0 24 24"><path d="M4 17l5-5 3.5 3.5L20 8M20 8h-4.5M20 8v4.5"/></svg>';

function pageHtml(){
  return '' +
  '<div class="pagehead"><span class="ic">' + SVG_UP + '</span>' +
    '<div><h1>売上ダッシュボード</h1>' +
    '<div class="subtle" id="phRange"></div></div>' +
    '<span class="right">' +
      '<button class="btn ghost" id="btnCols">表示項目</button>' +
      '<button class="btn ghost" id="btnXls">Excel</button>' +
      '<button class="btn ghost" id="btnCsv">CSV</button>' +
    '</span>' +
  '</div>' +

  '<div class="card"><div class="filters">' +
    '<div class="fg"><label for="fFrom">開始</label><input type="date" id="fFrom"></div>' +
    '<div class="fg"><label for="fTo">終了</label><input type="date" id="fTo"></div>' +
    '<div class="fg"><label for="fStaff">スタッフ</label><select id="fStaff"></select></div>' +
    '<div class="fg"><label>&nbsp;</label><button class="btn solid" id="btnApply">適用</button></div>' +
  '</div>' +
  '<div class="quick" id="quick"><span class="l">クイック</span></div></div>' +

  '<div id="kpis"></div>' +
  '<div id="chartArea"></div>' +
  '<div id="staffArea"></div>' +
  '<div id="dailyArea"></div>';
}

/* ---------------- KPI ---------------- */
function totals(){
  const d = S.DAYS;
  const t = k => d.reduce((a, x) => a + x[k], 0);
  return { total:t('total'), shinki:t('shinki'), keizoku:t('keizoku'), buppan:t('buppan'),
           refund:t('refund'), shouka:t('shouka'), kaishu:t('kaishu'),
           visits:t('visits'), cancel:t('cancel'), noshow:t('noshow'),
           count:d.reduce((a,x)=>a+x.visits,0),
           forecast: 2050000 };
}

const tip = t => '<span class="info" tabindex="0" data-tip="' + t.replace(/"/g,'&quot;') + '">i</span>';
const lbl = (g, k) => { const i = ITEMS[g].find(x => x.key === k);
  return i.label + (i.tip ? ' ' + tip(i.tip) : ''); };

function renderKpis(){
  const t = totals();
  const el = $('kpis');
  let h = '';

  /* --- 入金ベース --- */
  const mixParts = [
    { k:'新規', v:t.shinki,  c:'var(--s-shinki)' },
    { k:'継続', v:t.keizoku, c:'var(--s-keizoku)' },
    { k:'物販', v:t.buppan,  c:'var(--s-buppan)' },
  ];
  let totalCard =
    '<div class="card2"><div class="lab">' + lbl('kpi','total') + '</div>' +
    '<div class="big">' + yen(t.total) + '</div>' +
    '<div class="sub">' + num(t.count) + '件完了' +
    (t.refund ? ' ／ <span class="neg">返金 -' + yen(t.refund) + '</span>' : '') + '</div>';
  if(on('kpi','mix')){
    totalCard += '<div class="mix">' +
      mixParts.map(p => '<i style="width:' + (p.v / t.total * 100) + '%; background:' + p.c + '"></i>').join('') +
      '</div><div class="mixleg">' +
      mixParts.map(p => '<span><i style="background:' + p.c + '"></i>' + p.k +
        ' <b>' + yen(p.v) + '</b> <em>' + Math.round(p.v / t.total * 100) + '%</em></span>').join('') +
      '</div>';
  }
  totalCard += '</div>';

  let right = '';
  if(on('kpi','forecast')){
    const pct = Math.round(t.total / t.forecast * 100);
    right = '<div class="card2"><div class="lab">' + lbl('kpi','forecast') + '</div>' +
      '<div class="mid">' + yen(t.forecast) + '</div>' +
      '<div class="goal"><div class="sub" style="margin-bottom:5px">実績 ' + yen(t.total) +
      '（<b>' + pct + '%</b>）</div>' +
      '<div class="goalbar"><i style="width:' + Math.min(100, pct) + '%"></i></div></div></div>';
  }
  h += '<div class="grp"><div class="grp-h"><span class="t">入金ベース</span>' +
       '<span class="d">実際にお金が入った額</span></div>' +
       '<div class="kpirow' + (right ? '' : ' three') + '">' + totalCard + right + '</div></div>';

  /* --- 消化ベース --- */
  const cards = [];
  if(on('kpi','shouka')) cards.push(
    '<div class="card2"><div class="lab">' + lbl('kpi','shouka') + '</div>' +
    '<div class="mid">' + yen(t.shouka) + '</div>' +
    '<div class="sub">' + num(S.DAYS.length) + '日分</div></div>');
  if(on('kpi','kaishu')) cards.push(
    '<div class="card2"><div class="lab">' + lbl('kpi','kaishu') + '</div>' +
    '<div class="mid">' + yen(t.kaishu) + '</div>' +
    '<div class="sub">回数券・サブスクの利用分</div></div>');
  if(on('kpi','visits')) cards.push(
    '<div class="card2"><div class="lab">' + lbl('kpi','visits') + '</div>' +
    '<div class="mid">' + num(t.visits) + '<span style="font-size:13px;color:var(--mut)">名</span></div>' +
    '<div class="sub">キャンセル <b>' + t.cancel + '名</b> ／ 無断 <b>' + t.noshow + '名</b></div></div>');
  if(cards.length){
    h += '<div class="grp"><div class="grp-h"><span class="t">消化ベース・来店</span>' +
         '<span class="d">サービスを提供した額と来店の実績</span></div>' +
         '<div class="kpirow three">' + cards.join('') + '</div></div>';
  }
  el.innerHTML = h;
}

/* ---------------- 日次推移グラフ ---------------- */
function renderChart(){
  const area = $('chartArea');
  if(!on('chart','chart')){ area.innerHTML = ''; return; }
  area.innerHTML =
    '<div class="chartcard"><div class="chart-h"><h3>日次推移</h3>' +
      '<span class="subtle">積み上げ＝その日の総売上</span>' +
      '<span class="legend">' +
        '<span><i style="background:var(--s-shinki)"></i>新規</span>' +
        '<span><i style="background:var(--s-keizoku)"></i>継続</span>' +
        '<span><i style="background:var(--s-buppan)"></i>物販</span>' +
      '</span></div>' +
    '<div class="chartwrap" id="cw"><div class="tip" id="ctip"></div></div></div>';
  drawChart();
}

function drawChart(){
  const wrap = $('cw');
  if(!wrap) return;
  const W = Math.max(320, wrap.clientWidth);
  const ML = 62, MR = 10, MT = 16, PLOT = 200, XBAND = 30;   /* 軸のぶんも高さに含める */
  const H = MT + PLOT + XBAND;
  const d = S.DAYS;
  const max = Math.max(...d.map(x => x.total));

  /* 目盛りはキリのよい値へ */
  const step = Math.pow(10, String(Math.round(max / 4)).length - 1);
  const tickStep = Math.ceil(max / 4 / step) * step;
  const top = tickStep * 4;
  const y = v => MT + PLOT - (v / top) * PLOT;

  const band = (W - ML - MR) / d.length;
  const bw = Math.max(6, band - 7);      /* 棒の間はサーフェスで空ける（枠線は引かない） */

  let g = '';
  for(let i = 0; i <= 4; i++){
    const v = tickStep * i, yy = y(v);
    g += '<line x1="' + ML + '" y1="' + yy + '" x2="' + (W - MR) + '" y2="' + yy +
         '" stroke="var(--chart-grid)" stroke-width="1"/>' +
         '<text x="' + (ML - 8) + '" y="' + (yy + 4) + '" text-anchor="end" font-size="10.5" ' +
         'fill="var(--chart-axis)" style="font-variant-numeric:tabular-nums">' +
         (v ? '¥' + (v / 10000) + '万' : '0') + '</text>';
  }

  const maxDay = d.reduce((a, x) => x.total > a.total ? x : a, d[0]);
  let bars = '', hit = '';
  d.forEach((x, i) => {
    const cx = ML + band * i + band / 2;
    const bx = cx - bw / 2;
    const segs = [
      { v:x.shinki,  c:'var(--s-shinki)' },
      { v:x.keizoku, c:'var(--s-keizoku)' },
      { v:x.buppan,  c:'var(--s-buppan)' },
    ].filter(s => s.v > 0);
    let acc = 0;
    segs.forEach((s, si) => {
      const y0 = y(acc), y1 = y(acc + s.v);
      let hgt = y0 - y1;
      if(si < segs.length - 1) hgt = Math.max(1, hgt - 2);       /* 塗り同士の2px隙間 */
      const isTop = si === segs.length - 1;
      bars += '<rect x="' + bx + '" y="' + (y0 - hgt) + '" width="' + bw + '" height="' + hgt +
              '" fill="' + s.c + '"' + (isTop ? ' rx="4" ry="4"' : '') + '/>';
      if(isTop && hgt > 6){   /* 角丸が下端まで及ばないよう、下側を四角で埋める */
        bars += '<rect x="' + bx + '" y="' + (y0 - hgt + 4) + '" width="' + bw +
                '" height="' + (hgt - 4) + '" fill="' + s.c + '"/>';
      }
      acc += s.v;
    });
    /* 直接ラベルは最大の日だけ（全点に数字を置かない） */
    if(x === maxDay){
      bars += '<text x="' + cx + '" y="' + (y(x.total) - 7) + '" text-anchor="middle" font-size="10.5" ' +
              'font-weight="700" fill="var(--ink)" style="font-variant-numeric:tabular-nums">' +
              yen(x.total) + '</text>';
    }
    const t = new Date(x.date + 'T00:00:00');
    const we = (x.dow === 0 || x.dow === 6);
    bars += '<text x="' + cx + '" y="' + (MT + PLOT + 15) + '" text-anchor="middle" font-size="10" fill="' +
            (we ? (x.dow === 0 ? 'var(--danger)' : 'var(--info)') : 'var(--chart-axis)') + '">' +
            t.getDate() + '</text>' +
            '<text x="' + cx + '" y="' + (MT + PLOT + 26) + '" text-anchor="middle" font-size="8.5" fill="var(--chart-axis)">' +
            DOW[x.dow] + '</text>';
    /* 当たり判定は帯いっぱい（棒より広く取る） */
    hit += '<rect class="hit" data-i="' + i + '" x="' + (ML + band * i) + '" y="' + MT +
           '" width="' + band + '" height="' + PLOT + '" fill="transparent"/>';
  });

  wrap.querySelector('svg') && wrap.querySelector('svg').remove();
  const svg = '<svg viewBox="0 0 ' + W + ' ' + H + '" width="' + W + '" height="' + H +
    '" role="img" aria-label="日次の売上推移">' + g + bars + hit + '</svg>';
  wrap.insertAdjacentHTML('afterbegin', svg);

  const tp = $('ctip');
  wrap.querySelectorAll('.hit').forEach(r => {
    const show = () => {
      const x = d[+r.dataset.i];
      tp.innerHTML = '<div class="d">' + mdw(x.date) + '</div>' +
        '<div class="r"><i style="background:var(--s-shinki)"></i>新規<span class="v">' + yen(x.shinki) + '</span></div>' +
        '<div class="r"><i style="background:var(--s-keizoku)"></i>継続<span class="v">' + yen(x.keizoku) + '</span></div>' +
        '<div class="r"><i style="background:var(--s-buppan)"></i>物販<span class="v">' + yen(x.buppan) + '</span></div>' +
        '<div class="tot">合計<span class="v">' + yen(x.total) + '</span></div>';
      tp.classList.add('on');
      const bx = +r.getAttribute('x') + (+r.getAttribute('width')) / 2;
      const scale = wrap.clientWidth / W;
      tp.style.left = Math.max(4, Math.min(wrap.clientWidth - 170, bx * scale - 80)) + 'px';
      tp.style.top = '6px';
    };
    r.addEventListener('mouseenter', show);
    r.addEventListener('mouseleave', () => tp.classList.remove('on'));
  });
}

/* ---------------- スタッフ別 ---------------- */
function rateCls(r){ return r < 50 ? 'low' : r < 70 ? 'mid' : 'high'; }
function rateCell(r){
  return '<span class="rate ' + rateCls(r) + '"><span class="v">' + r.toFixed(1) + '%</span>' +
         '<span class="ratebar"><i style="width:' + Math.min(100, r) + '%"></i></span></span>';
}

function staffCell(k, r){
  switch(k){
    case 'name':    return '<td class="l stick">' + r.name + '</td>';
    case 'forecast':return '<td>' + yen(r.forecast) + '</td>';
    case 'total':   return '<td><b>' + yen(r.total) + '</b></td>';
    case 'shinki':  return '<td>' + yen(r.shinki) + '</td>';
    case 'keizoku': return '<td>' + yen(r.keizoku) + '</td>';
    case 'buppan':  return '<td>' + (r.buppan ? yen(r.buppan) : '<span class="zero">¥0</span>') + '</td>';
    case 'shouka':  return '<td>' + yen(r.shouka) + '</td>';
    case 'kaishu':  return '<td>' + (r.kaishu ? yen(r.kaishu) : '<span class="zero">¥0</span>') + '</td>';
    case 'refund':  return '<td>' + (r.refund ? '<span class="negv">-' + yen(r.refund) + '</span>' : '<span class="zero">—</span>') + '</td>';
    case 'count':   return '<td>' + num(r.count) + '</td>';
    case 'unit':    return '<td>' + yen(r.unit) + '</td>';
    case 'openMin': return '<td>' + hm(r.openMin) + '</td>';
    case 'workMin': return '<td>' + hm(r.workMin) + '</td>';
    case 'rate':    return '<td>' + rateCell(r.rate) + '</td>';
    case 'shinkiCount': return '<td>' + num(r.shinkiCount) + '</td>';
    case 'buyCount':return '<td>' + num(r.buyCount) + '</td>';
    case 'buyRate': return '<td>' + r.buyRate.toFixed(1) + '%</td>';
    case 'gReview': return '<td>' + (r.gReview || '<span class="zero">0</span>') + '</td>';
    case 'hReview': return '<td>' + (r.hReview || '<span class="zero">0</span>') + '</td>';
  }
  return '<td></td>';
}

function renderStaff(){
  /* 集計対象の操作を隠したときは「全体」に戻す。
     操作が画面から消えているのに絞り込みだけ効いていると、
     KPIの新規売上と表の新規売上が食い違い、理由が分からなくなる */
  if(!on('feature','newBasis')) basis = 'all';

  const rows = S.byStaff(S.DAYS);
  const ratio = S.NEW_SALES_BASIS.find(b => b.id === basis).ratio;
  rows.forEach(r => { r.shinki = Math.round(r.shinki * ratio / 100) * 100; });

  const sum = rows.reduce((a, r) => {
    Object.keys(r).forEach(k => {
      if(typeof r[k] === 'number') a[k] = (a[k] || 0) + r[k];
    });
    return a;
  }, { name:'合計' });
  sum.unit = Math.round(sum.total / sum.count);
  sum.rate = Math.round(sum.workMin / sum.openMin * 1000) / 10;
  sum.buyRate = Math.round(sum.buyCount / sum.count * 1000) / 10;
  sum.forecast = rows.reduce((a, r) => a + r.forecast, 0);

  const cols = ITEMS.staff.filter(c => on('staff', c.key));
  const th = cols.map(c => '<th class="' + (c.key === 'name' ? 'l stick' : '') + '">' + c.label + '</th>').join('');
  const tr = r => '<tr' + (r.name === '合計' ? ' class="sum"' : '') + '>' +
    cols.map(c => staffCell(c.key, r)).join('') + '</tr>';

  $('staffArea').innerHTML =
    '<div class="tcard"><div class="tcard-h"><h3>スタッフ別売上</h3>' +
      (on('feature','newBasis')
        ? '<span class="seg2" style="margin-left:auto"><span class="l">新規売上の集計対象 ' +
          tip(ITEMS.feature[0].tip) + '</span><span class="box" id="basisBox">' +
          S.NEW_SALES_BASIS.map(b => '<button data-b="' + b.id + '"' +
            (b.id === basis ? ' class="on"' : '') + '>' + b.label + '</button>').join('') +
          '</span></span>'
        : '') +
    '</div>' +
    (basis !== 'all'
      ? '<div style="padding:9px 16px; background:var(--info-soft); color:var(--info); font-size:12px; border-bottom:1px solid var(--line)">' +
        '新規売上は「' + S.NEW_SALES_BASIS.find(b => b.id === basis).label +
        '」で集計しています。上の売上カード（全体）とは金額が異なります。</div>'
      : '') +
    '<div class="tscroll"><table class="dt"><thead><tr>' + th + '</tr></thead><tbody>' +
      tr(sum) + rows.map(tr).join('') +
    '</tbody></table></div></div>';

  const bb = $('basisBox');
  if(bb) bb.querySelectorAll('button').forEach(b => b.addEventListener('click', () => {
    basis = b.dataset.b; renderStaff();
  }));
}

/* ---------------- 日報 ---------------- */
function dailyCell(k, d){
  switch(k){
    case 'date':    return '<td class="l stick">' + (d.date === '合計' ? '<b>期間合計</b>' : mdw(d.date)) + '</td>';
    case 'total':   return '<td><b>' + yen(d.total) + '</b></td>';
    case 'shinki':  return '<td>' + yen(d.shinki) + '</td>';
    case 'keizoku': return '<td>' + yen(d.keizoku) + '</td>';
    case 'buppan':  return '<td>' + (d.buppan ? yen(d.buppan) : '<span class="zero">¥0</span>') + '</td>';
    case 'refund':  return '<td>' + (d.refund ? '<span class="negv">-' + yen(d.refund) + '</span>' : '<span class="zero">—</span>') + '</td>';
    case 'shouka':  return '<td>' + yen(d.shouka) + '</td>';
    case 'kaishu':  return '<td>' + (d.kaishu ? yen(d.kaishu) : '<span class="zero">¥0</span>') + '</td>';
    case 'visits':  return '<td>' + num(d.visits) + '</td>';
    case 'cancel':  return '<td>' + (d.cancel ? '<span class="negv">' + d.cancel + '</span>' : '<span class="zero">0</span>') + '</td>';
    case 'rate':    return '<td>' + rateCell(d.rate) + '</td>';
    case 'pay':     return '<td><span class="chips">' + Object.keys(d.pay).filter(k2 => d.pay[k2] > 0)
                      .map(k2 => '<span class="chipv">' + k2 + ' ' + yen(d.pay[k2]) + '</span>').join('') + '</span></td>';
    case 'media':   return '<td><span class="chips">' + Object.keys(d.media).filter(k2 => d.media[k2] > 0)
                      .map(k2 => '<span class="chipv">' + k2 + ' ' + d.media[k2] + '</span>').join('') + '</span></td>';
  }
  return '<td></td>';
}

function renderDaily(){
  const cols = ITEMS.daily.filter(c => on('daily', c.key));
  const t = totals();
  const sum = { date:'合計', total:t.total, shinki:t.shinki, keizoku:t.keizoku, buppan:t.buppan,
    refund:t.refund, shouka:t.shouka, kaishu:t.kaishu, visits:t.visits, cancel:t.cancel,
    rate: Math.round(S.DAYS.reduce((a,d)=>a+d.rate,0) / S.DAYS.length * 10) / 10,
    pay:{}, media:{} };
  S.DAYS.forEach(d => {
    Object.keys(d.pay).forEach(k => sum.pay[k] = (sum.pay[k] || 0) + d.pay[k]);
    Object.keys(d.media).forEach(k => sum.media[k] = (sum.media[k] || 0) + d.media[k]);
  });

  const th = cols.map(c => '<th class="' + (c.key === 'date' ? 'l stick' : '') + '">' + c.label + '</th>').join('');
  const tr = d => '<tr' + (d.date === '合計' ? ' class="sum"' : '') + '>' +
    cols.map(c => dailyCell(c.key, d)).join('') + '</tr>';

  $('dailyArea').innerHTML =
    '<div class="tcard"><div class="tcard-h"><h3>日報（デイリー売上）</h3>' +
    '<span class="subtle" style="margin-left:auto">' + S.DAYS.length + '日分</span></div>' +
    '<div class="tscroll"><table class="dt"><thead><tr>' + th + '</tr></thead><tbody>' +
      tr(sum) + S.DAYS.map(tr).join('') +
    '</tbody></table></div></div>';
}

/* ---------------- 表示項目パネル ---------------- */
const GROUP_LABEL = { kpi:'売上カード', chart:'グラフ', staff:'スタッフ別売上の列',
                      daily:'日報の列', feature:'オプション機能' };

function renderDrawer(){
  let h = '<p class="dnote">店舗によって使わない項目は、ここでオフにできます。' +
          '設定は店舗ごとに保存される想定です。<br>鍵のかかった項目は、外すと画面の意味が変わるため常に表示します。</p>' +
          '<div class="presets">' +
          Object.keys(PRESETS).map(p => '<button data-p="' + p + '">' + PRESETS[p].name + '</button>').join('') +
          '</div>';
  Object.keys(ITEMS).forEach(g => {
    h += '<div class="dsec"><h4>' + GROUP_LABEL[g] + '</h4>' +
      ITEMS[g].map(i =>
        '<label class="opt' + (i.locked ? ' locked' : '') + '">' +
        '<input type="checkbox" data-g="' + g + '" data-k="' + i.key + '"' +
        (on(g, i.key) ? ' checked' : '') + (i.locked ? ' disabled' : '') + '>' +
        '<span class="sw"></span><span class="tx">' + i.label +
        (i.tip ? '<small>' + i.tip + '</small>' : '') + '</span></label>').join('') +
      '</div>';
  });
  $('drawerBody').innerHTML = h;

  $('drawerBody').querySelectorAll('[data-p]').forEach(b => b.addEventListener('click', () => {
    applyPreset(b.dataset.p); renderAll(); renderDrawer();
    toast(PRESETS[b.dataset.p].name + 'の表示に切り替えました');
  }));
  $('drawerBody').querySelectorAll('input[data-g]').forEach(c => c.addEventListener('change', () => {
    const g = c.dataset.g, k = c.dataset.k;
    c.checked ? vis[g].add(k) : vis[g].delete(k);
    renderAll();
  }));
}

/* ---------------- トースト ---------------- */
let toastT;
function toast(m){
  const t = $('toast'); t.textContent = m; t.classList.add('show');
  clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2400);
}

/* ---------------- 起動 ---------------- */
const QUICK = [
  { id:'m',   label:'今月' }, { id:'lm', label:'先月' },
  { id:'d7',  label:'直近7日' }, { id:'d30', label:'直近30日' },
];

function renderAll(){ renderKpis(); renderChart(); renderStaff(); renderDaily(); }

function mount(role){
  const page = Shell.render({ active:'sales', role: role });
  page.innerHTML = pageHtml();

  $('phRange').textContent = S.PERIOD.from + ' 〜 ' + S.PERIOD.to + '　' + S.SHOP.name;
  $('fFrom').value = S.PERIOD.from;
  $('fTo').value   = S.PERIOD.to;
  const fs = $('fStaff');
  fs.innerHTML = '<option value="all">全スタッフ</option>' +
    S.STAFF.map(s => '<option value="' + s.id + '">' + s.name + '</option>').join('');

  $('quick').insertAdjacentHTML('beforeend',
    QUICK.map(q => '<button class="qbtn" data-q="' + q.id + '">' + q.label + '</button>').join(''));
  $('quick').querySelectorAll('[data-q]').forEach(b => b.addEventListener('click', () => {
    quick = b.dataset.q;
    $('quick').querySelectorAll('[data-q]').forEach(x => x.classList.toggle('on', x === b));
    toast(b.textContent + 'の期間に切り替えました（モックでは同じデータを表示します）');
  }));

  $('btnApply').addEventListener('click', () => toast('期間を適用しました（モックでは同じデータを表示します）'));
  $('btnCols').addEventListener('click', () => { renderDrawer(); $('drawer').classList.add('show'); });
  $('btnCsv').addEventListener('click', () => toast('表示中の項目でCSVを出力します（モックの対象外）'));
  $('btnXls').addEventListener('click', () => toast('表示中の項目でExcelを出力します（モックの対象外）'));

  renderAll();
}

$('drawerX').addEventListener('click',  () => $('drawer').classList.remove('show'));
$('drawerSc').addEventListener('click', () => $('drawer').classList.remove('show'));
$('drawerDone').addEventListener('click', () => $('drawer').classList.remove('show'));
$('drawerReset').addEventListener('click', () => {
  applyPreset('standard'); renderAll(); renderDrawer(); toast('標準に戻しました');
});
document.addEventListener('keydown', e => {
  if(e.key === 'Escape') $('drawer').classList.remove('show');
});
let rt;
window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(drawChart, 120); });

applyPreset('standard');
mount('system');
MockBar.init({ role:'system', onRole: r => mount(r) });
