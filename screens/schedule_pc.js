/* ============================================================================
   予約表（PC） ページスクリプト
   ----------------------------------------------------------------------------
   仕様と設計意図は schedule_pc.html 冒頭のコメントに書いてある。

   状態:
     pageView   'all' | pageId       表示するページ。1枚に絞るとHPB側から見た状態になる
     compact    短縮表示
     showEquip  設備行を出すか
     onlyConf   重複している行だけに絞る
     blocks     ページ間ブロックの記録。「今すぐ反映」で pending → done に変わる
   ========================================================================== */
'use strict';

(function () {

  const D = window.HpbData;

  /* ---- 定数 ---- */
  const DAY_START = 600;    // 10:00
  const DAY_END   = 1200;   // 20:00
  const NOW       = 713;    // 11:53（現行スクショと同じ位置に現在線を出す）
  const PX15_N    = 22;
  const PX15_C    = 13;

  /* ---- 状態 ---- */
  let role      = 'system';
  let pageView  = 'all';
  let compact   = false;
  let showEquip = true;
  let onlyConf  = false;
  let twoPages  = true;                       // モック専用：2ページ運用のON/OFF
  let blocks    = D.blocks();
  const RES     = D.reservations();

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const px15 = () => (compact ? PX15_C : PX15_N);
  const xOf  = m => (m - DAY_START) / 15 * px15();
  const wOf  = (a, b) => Math.max(px15() - 2, (b - a) / 15 * px15() - 3);
  const trackW = () => (DAY_END - DAY_START) / 15 * px15();
  const rowH = () => (compact ? 40 : 64);

  let tt;
  function toast(m){
    const t = $('toast');
    t.textContent = m; t.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 3200);
  }

  /* ---- 表示対象のデータ ---- */

  /** 2ページ運用をOFFにしたら、サブページ由来のものは存在しなかったことにする */
  const liveRes = () => twoPages ? RES : RES.filter(r => r.page !== 'pg_sub');
  const liveBlocks = () => twoPages ? blocks : [];
  const livePages = () => twoPages ? D.PAGES.filter(p => p.id === 'pg_main' || p.id === 'pg_sub')
                                   : D.PAGES.filter(p => p.id === 'pg_main');

  /** 予約の見た目の種類 */
  function kindOf(r){
    if (r.state === 'break') return 'break';
    if (r.page === 'pg_main') return 'main';
    if (r.page === 'pg_sub')  return 'sub';
    if (r.src === 'minimo')   return 'mini';
    return 'dir';
  }
  const SRC_BADGE = { hpb:'H', minimo:'ミ', form:'フ', direct:'直' };

  /* ---- 重複の検出 ---- */

  function conflicts(){
    const list = liveRes();
    const byStaff = D.findConflicts(list, 'lane');
    const byEquip = D.findConflicts(list, 'equip')
      // スタッフ側ですでに拾っている組は重ねて出さない
      .filter(([a, b]) => !byStaff.some(([x, y]) => x.id === a.id && y.id === b.id));
    return byStaff.map(p => ({ pair:p, on:'staff' }))
      .concat(byEquip.map(p => ({ pair:p, on:'equip' })));
  }

  /**
    その重複がなぜ起きたか。
    a の予約は b のページを閉じるはずだったので、その記録の状態が原因になる。
  */
  function causeOf(a, b){
    const bk = liveBlocks().find(x => x.from === a.id && x.page === b.page) ||
               liveBlocks().find(x => x.from === b.id && x.page === a.page);
    if (!bk) return { key:'none', t:'原因不明' };
    if (bk.state === 'unmapped') return { key:'unmapped', t:'紐付け未設定' };
    if (bk.state === 'pending')  return { key:'pending',  t:'同期ラグ' };
    return { key:'other', t:'要確認' };
  }

  const conflictIds = () => {
    const s = new Set();
    conflicts().forEach(c => { s.add(c.pair[0].id); s.add(c.pair[1].id); });
    return s;
  };

  /* ==================================================================
     描画
     ================================================================== */

  function render(){
    const page = Shell.render({ active:'schedule', role });

    page.innerHTML =
      '<div class="ph2">' +
        '<span class="ic"><svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/>' +
        '<path d="M3.5 9h17M8 2.5v4M16 2.5v4"/></svg></span>' +
        '<h1>予約管理</h1>' +
        '<label class="sw"><input type="checkbox" id="cpt"' + (compact ? ' checked' : '') +
          '><i></i><span>短縮表示</span></label>' +
      '</div>' +

      '<div class="bar">' +
        '<div class="nav">' +
          '<button>&#x2039;</button><button>今日</button><button>&#x203A;</button>' +
          '<span class="d">' + D.DATE_LABEL + '</span>' +
        '</div>' +
        '<span class="sp"></span>' +
        '<span class="lastsync">最終同期 9/21 11:52</span>' +
        '<button class="tbtn"><svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 3.5V8h-4.5"/></svg>更新</button>' +
        '<button class="tbtn" id="syncBtn"><svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 0 1 13.6-5.7M20 12a8 8 0 0 1-13.6 5.7"/><path d="M17.5 3v3.5H14M6.5 21v-3.5H10"/></svg>外部データ同期</button>' +
        '<div class="seg"><button class="on">日</button><button>週</button><button>月</button></div>' +
        '<button class="tbtn solid"><svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>予約作成</button>' +
      '</div>' +

      '<div id="pgbar"></div>' +
      '<div id="confbar"></div>' +
      '<div class="tlwrap" id="tlwrap"></div>' +
      '<div id="legend"></div>';

    $('cpt').addEventListener('change', e => { compact = e.target.checked; renderAll(); });
    $('syncBtn').addEventListener('click', doSync);

    renderAll();
  }

  function renderAll(){
    renderPgBar();
    renderConfBar();
    renderTimeline();
    renderLegend();
  }

  /* ---- ページ切替＋ブロック状況 ---- */

  function renderPgBar(){
    const ps = livePages();
    if (ps.length < 2){
      $('pgbar').innerHTML = '';
      return;
    }
    const bl = liveBlocks();
    const nDone = bl.filter(b => b.state === 'done').length;
    const nPend = bl.filter(b => b.state === 'pending').length;
    const nNg   = bl.filter(b => b.state === 'unmapped').length;

    $('pgbar').innerHTML =
      '<div class="pgbar">' +
        '<span class="lb">表示するページ</span>' +
        '<div class="pgseg">' +
          '<button data-pv="all" class="' + (pageView === 'all' ? 'on' : '') + '">すべて</button>' +
          ps.map(p => '<button data-pv="' + p.id + '" class="' + (pageView === p.id ? 'on' : '') + '">' +
            '<span class="pgbadge ' + (p.role === 'sub' ? 'sub' : 'main') + '">' + esc(p.abbr) + '</span>' +
            esc(p.name) + '</button>').join('') +
        '</div>' +
        '<div class="blockstat">' +
          '<span class="shield"><svg viewBox="0 0 24 24"><path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6z"/>' +
            '<path d="M9 12l2.2 2.2L15.5 10"/></svg>ページ間ブロック</span>' +
          '<span class="always">常時有効</span>' +
          '<span class="cnt"><span class="dot done"></span>反映済み <b>' + nDone + '</b></span>' +
          '<span class="cnt"><span class="dot pend"></span>未反映 <b>' + nPend + '</b></span>' +
          (nNg ? '<span class="cnt"><span class="dot ng"></span>ブロック不可 <b>' + nNg + '</b></span>' : '') +
          (nPend ? '<button class="tbtn" id="nowBtn" style="height:30px">今すぐ反映</button>' : '') +
        '</div>' +
      '</div>';

    $('pgbar').querySelectorAll('[data-pv]').forEach(b =>
      b.addEventListener('click', () => { pageView = b.dataset.pv; renderAll(); }));
    const nb = $('nowBtn');
    if (nb) nb.addEventListener('click', doSync);
  }

  function doSync(){
    const n = liveBlocks().filter(b => b.state === 'pending').length;
    if (!n){ toast('未反映のブロックはありません'); return; }
    blocks.forEach(b => { if (b.state === 'pending') b.state = 'done'; });
    const c = conflicts().length;
    renderAll();
    toast(c
      ? '未反映 ' + n + '件を相手ページに反映しました。すでに成立している重複 ' + c + '件は、どちらかをキャンセルしてください'
      : '未反映 ' + n + '件を相手ページに反映しました');
  }

  /* ---- 重複アラート ---- */

  function renderConfBar(){
    const cs = conflicts();
    if (!cs.length){ $('confbar').innerHTML = ''; onlyConf = false; return; }

    const items = cs.map(c => {
      const [a, b] = c.pair;
      const pa = D.pageOf(a.page), pb = D.pageOf(b.page);
      const lane = c.on === 'staff'
        ? (D.LANES.staff.find(l => l.id === a.lane) || {}).name
        : (D.LANES.equip.find(l => l.id === a.equip) || {}).name;
      const cz = causeOf(a, b);
      return '<li><b>' + esc(lane) + '</b>　' + D.hm(Math.max(a.start, b.start)) + '–' + D.hm(Math.min(a.end, b.end)) +
        '　' + esc(pa.abbr) + ' ' + esc(a.name) + ' × ' + esc(pb.abbr) + ' ' + esc(b.name) +
        '<span class="cause">' + cz.t + '</span>' +
        (cz.key === 'unmapped'
          ? '　<a href="hpb_link.html">紐付けを設定する</a>'
          : '　<span style="color:#8C2F28">次の同期で相手ページは閉じますが、この2件は残ります</span>') +
        '</li>';
    }).join('');

    $('confbar').innerHTML =
      '<div class="conflict">' +
        '<span class="hd"><svg viewBox="0 0 24 24"><path d="M12 3.5l9 16H3z"/><path d="M12 9.5v4.5M12 17h.01"/></svg>' +
          '予約の重複 ' + cs.length + '件</span>' +
        '<ul>' + items + '</ul>' +
        '<button class="jump" id="confOnly">' + (onlyConf ? 'すべて表示' : '該当だけ表示') + '</button>' +
      '</div>';

    $('confOnly').addEventListener('click', () => { onlyConf = !onlyConf; renderAll(); });
  }

  /* ---- タイムライン ---- */

  /** 行に置くアイテムを組み立てる。ページを1枚に絞ったときは閉じた枠も混ぜる */
  function itemsFor(lane, group){
    const key = group === 'equip' ? 'equip' : 'lane';
    const res = liveRes().filter(r => r[key] === lane.id);

    if (pageView === 'all'){
      return res.map(r => ({ type:'res', r, start:r.start, end:r.end }));
    }

    const out = [];
    res.forEach(r => {
      if (r.page === pageView || r.state === 'break'){
        out.push({ type:'res', r, start:r.start, end:r.end });
        return;
      }
      // このページ以外から入った予約。相手ページを閉じた記録があればその状態で描く
      const bk = liveBlocks().find(b => b.from === r.id && b.page === pageView);
      // skip = この担当者をそのページに載せていない。閉じる枠が無いので何も描かない
      if (bk && bk.state === 'skip') return;
      out.push({
        type:'block', from:r, start:r.start, end:r.end,
        state: bk ? bk.state : 'done',
      });
    });
    return out;
  }

  /** 重なるアイテムを段に振り分ける（貪欲法）。重ねて描くと重複が見えなくなる */
  function pack(items){
    const sorted = items.slice().sort((a, b) => a.start - b.start || a.end - b.end);
    const ends = [];
    sorted.forEach(it => {
      let i = ends.findIndex(e => e <= it.start);
      if (i === -1){ i = ends.length; ends.push(it.end); } else { ends[i] = it.end; }
      it.row = i;
    });
    return { items:sorted, rows:Math.max(1, ends.length) };
  }

  function gridHtml(){
    let g = '<div class="grid" style="width:' + trackW() + 'px">';
    for (let m = DAY_START; m <= DAY_END; m += 15){
      g += '<i class="' + (m % 60 === 0 ? '' : 'q') + '" style="left:' + xOf(m) + 'px"></i>';
    }
    g += '</div>';
    if (NOW >= DAY_START && NOW <= DAY_END){
      g += '<div class="nowline" style="left:' + xOf(NOW) + 'px"></div>';
    }
    return g;
  }

  function blockHtml(it, confSet){
    const r = it.r;
    const k = kindOf(r);
    const conf = confSet.has(r.id);
    const pg = r.page ? D.pageOf(r.page) : null;
    const hidden = onlyConf && !conf && r.state !== 'break';

    const badges =
      (pg ? '<span class="pg">' + esc(pg.abbr) + '</span>' : '') +
      (r.src && r.src !== 'direct' ? '<span class="pg">' + SRC_BADGE[r.src] + '</span>' : '') +
      (r.tags.indexOf('指名') >= 0 ? '<span class="pg">指</span>' : '');

    // 重複はタグ行の先頭に置く。バッジ列に入れると幅の狭いブロックで名前を押し出す。
    // 短縮表示ではタグ行が消えるが、赤い枠と上部のアラートで気づける
    const tags = (conf ? '<span class="cf">重複</span>' : '') +
      r.tags.filter(t => t !== '指名').map(t => '<span>' + esc(t) + '</span>').join('');

    return '<div class="blk p-' + k + (compact ? ' compact' : '') + (conf ? ' conf' : '') +
        (hidden ? ' hidden' : '') + '" data-res="' + r.id + '" tabindex="0" role="button"' +
        ' style="left:' + xOf(it.start) + 'px; width:' + wOf(it.start, it.end) + 'px;' +
        ' top:' + (it.row * rowH() + 4) + 'px; height:' + (rowH() - 8) + 'px">' +
      '<span class="rail"></span>' +
      '<div class="top"><span class="nm">' + esc(r.name) + '</span>' +
        (r.state === 'break' ? '' : '<span class="bdg">' + badges + '</span>') + '</div>' +
      (r.menu ? '<div class="mn">' + esc(r.menu) + '</div>' : '') +
      '<div class="tg">' + tags + (r.code ? '<span class="code">' + esc(r.code) + '</span>' : '') + '</div>' +
    '</div>';
  }

  const BLOCK_LABEL = {
    done:     'ブロック済み',
    pending:  'ブロック未反映（次の同期で閉じます）',
    unmapped: 'ブロックできません（紐付け未設定）',
  };
  /** 何が原因でこの枠を閉じたのか。HPBの別ページか、minimo等の別経路か */
  const blockWhy = from => from.page ? '他ページ予約により' : '他経路の予約により';

  function blockbarHtml(it){
    const hidden = onlyConf ? ' hidden' : '';
    const label = it.state === 'done'
      ? blockWhy(it.from) + BLOCK_LABEL.done
      : (BLOCK_LABEL[it.state] || BLOCK_LABEL.done);
    const w = wOf(it.start, it.end);
    return '<div class="blockbar ' + it.state + hidden + '" data-res="' + it.from.id + '" ' +
      'title="' + esc(label + '　' + D.hm(it.start) + '–' + D.hm(it.end)) + '"' +
      ' style="left:' + xOf(it.start) + 'px; width:' + w + 'px;' +
      ' top:' + (it.row * rowH() + 4) + 'px; height:' + (rowH() - 8) + 'px">' +
      (it.state === 'unmapped' ? '<span>&#9888;</span>' : '') +
      (w > 96 ? '<span class="t">' + esc(label) + '</span>' : '') +
    '</div>';
  }

  function laneHeadHtml(lane, group, warn){
    const pgs = group === 'staff' || group === 'equip'
      ? pagesOfLane(lane.id, group).map(p =>
          '<span class="pgbadge ' + (p.role === 'sub' ? 'sub' : 'main') + '">' + esc(p.abbr) + '</span>').join('')
      : '';
    return '<div class="lane-h">' +
      '<span class="av">' + esc(lane.avatar) + '</span>' +
      '<div><div class="nm">' + esc(lane.name) + '</div>' +
        '<div class="sh">' + esc(lane.shift) + '</div>' +
        (pgs ? '<div class="pgs">' + pgs + '</div>' : '') +
        (warn ? '<span class="warn">紐付け未設定</span>' : '') +
      '</div></div>';
  }

  /** その行が載っているページ（紐付け済みのページ） */
  function pagesOfLane(laneId, group){
    if (!twoPages) return D.PAGES.filter(p => p.id === 'pg_main');
    const kind = group === 'equip' ? 'equip' : 'staff';
    const link = D.initialLink()[kind][laneId] || {};
    return livePages().filter(p => D.cellState(link[p.id]) === 'linked');
  }
  function laneHasUnset(laneId, group){
    if (!twoPages) return false;
    const kind = group === 'equip' ? 'equip' : 'staff';
    const link = D.initialLink()[kind][laneId] || {};
    return livePages().some(p => D.cellState(link[p.id]) === 'unset');
  }

  function renderTimeline(){
    const confSet = conflictIds();
    let h = '<div class="tl">';

    /* 目盛り */
    h += '<div class="tlhead"><div class="lane-h">時間</div><div class="track" style="width:' + trackW() + 'px">';
    for (let m = DAY_START; m <= DAY_END - 60; m += 60){
      h += '<div class="hourlab" style="left:' + xOf(m) + 'px; width:' + (60 / 15 * px15()) + 'px">' + D.hm(m) + '</div>';
    }
    h += '</div></div>';

    const groups = [{ g:'staff', lanes:D.LANES.staff, hd:null }];
    if (showEquip) groups.push({ g:'equip', lanes:D.LANES.equip, hd:'設備' });

    groups.forEach(({ g, lanes, hd }) => {
      if (hd){
        h += '<div class="grouphd">' + hd +
             '<span class="note">2ページで共用する設備は、スタッフと同じように重複します</span>' +
             '<button data-eq="0">隠す</button></div>';
      }
      lanes.forEach(lane => {
        const onPage = pageView === 'all' ||
                       pagesOfLane(lane.id, g).some(p => p.id === pageView);
        // 1ページに絞ったとき、そのページに載せていない行は空にせず理由を書く。
        // 空欄のままだと「予約が無い」と読めてしまう
        if (!onPage){
          h += '<div class="tlrow notonpage">' +
            laneHeadHtml(lane, g, false) +
            '<div class="track" style="width:' + trackW() + 'px; height:' + (rowH() + 8) + 'px">' +
              gridHtml() +
              '<div class="offpage">このページには出していません</div>' +
            '</div>' +
          '</div>';
          return;
        }
        const { items, rows } = pack(itemsFor(lane, g));
        const hgt = rows * rowH() + 8;
        h += '<div class="tlrow">' +
          laneHeadHtml(lane, g, laneHasUnset(lane.id, g)) +
          '<div class="track" style="width:' + trackW() + 'px; height:' + hgt + 'px">' +
            gridHtml() +
            items.map(it => it.type === 'res' ? blockHtml(it, confSet) : blockbarHtml(it)).join('') +
          '</div>' +
        '</div>';
      });
    });

    if (!showEquip){
      h += '<div class="grouphd">設備<span class="note">非表示</span><button data-eq="1">表示する</button></div>';
    }
    h += '</div>';

    $('tlwrap').innerHTML = h;

    $('tlwrap').querySelectorAll('[data-eq]').forEach(b =>
      b.addEventListener('click', () => { showEquip = b.dataset.eq === '1'; renderTimeline(); }));
    $('tlwrap').querySelectorAll('[data-res]').forEach(el => {
      el.addEventListener('click', () => openDetail(el.dataset.res));
      el.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' '){ e.preventDefault(); openDetail(el.dataset.res); } });
    });
  }

  /* ---- 凡例 ---- */

  function renderLegend(){
    const sw = (cls, rail) =>
      '<span class="sw2" style="border-color:' + cls + '"><i style="background:' + rail + '"></i></span>';
    const hatch = 'repeating-linear-gradient(135deg,#4A3AA7 0 3px,#fff 3px 6px)';

    $('legend').innerHTML =
      '<div class="legend">' +
        '<div class="grp"><span class="t">予約の色 ＝ どこから入ったか</span>' +
          '<span class="k">' + sw('#9CCFB2', '#2E8B5F') + '本ページ（HPB）</span>' +
          (twoPages ? '<span class="k">' + sw('#C9C1EE', hatch) + 'サブページ（HPB）<b style="color:#4A3AA7">／左端が斜線</b></span>' : '') +
          '<span class="k">' + sw('#E0C288', '#B4740B') + 'minimo</span>' +
          '<span class="k">' + sw('#A8C6C0', '#106258') + '直接入力・強制リンク</span>' +
          '<span class="k">' + sw('#D8D8D0', '#B9B9AE') + '休憩</span>' +
        '</div>' +
        (twoPages ? '<div class="grp"><span class="t">閉じた枠（1ページに絞ったとき）</span>' +
          '<span class="k"><span class="sw2" style="border:1.5px dashed #C9C9BE;background:repeating-linear-gradient(135deg,#EDEDE6 0 4px,#F7F7F2 4px 8px)"></span>ブロック済み</span>' +
          '<span class="k"><span class="sw2" style="border:1.5px dashed #D9B267;background:repeating-linear-gradient(135deg,#FBF0DC 0 4px,#FEF9EE 4px 8px)"></span>未反映</span>' +
          '<span class="k"><span class="sw2" style="border:1.5px dashed rgba(196,52,43,.55);background:repeating-linear-gradient(135deg,#FBEBEA 0 4px,#FEF6F5 4px 8px)"></span>ブロック不可</span>' +
        '</div>' : '') +
        '<div class="grp"><span class="t">バッジ</span>' +
          '<span class="k">本 / ネ … ページ</span>' +
          '<span class="k">H … HPB　ミ … minimo　フ … 強制リンク　指 … 指名</span>' +
        '</div>' +
        (twoPages
          ? '<div class="note"><b>色を見分けにくい場合は、左端のレールとバッジの文字で判断できます。</b>' +
            'サブページの予約だけ左端が斜線になっています。<br>' +
            '「表示するページ」を1枚に絞ると、そのページのカレンダー（HPB側から見た状態）になり、' +
            'もう一方の予約で閉じた枠が斜線のバーで出ます。</div>'
          : '<div class="note">右下の「モック設定」で<b>2ページ運用</b>をONにすると、サブページの予約と重複防止の表示が入ります。</div>') +
      '</div>';
  }

  /* ---- 予約詳細 ---- */

  function openDetail(id){
    const r = liveRes().find(x => x.id === id);
    if (!r) return;
    const pg = r.page ? D.pageOf(r.page) : null;
    const lane = D.LANES.staff.find(l => l.id === r.lane);
    const eq   = D.LANES.equip.find(l => l.id === r.equip);

    $('dTitle').textContent = r.state === 'break' ? '休憩' : r.name + ' 様';
    $('dSub').textContent = D.DATE_LABEL + '　' + D.hm(r.start) + '–' + D.hm(r.end);

    const row = (k, v) => '<div class="row"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';

    let box = '';
    if (r.page && twoPages){
      const other = livePages().find(p => p.id !== r.page);
      const bk = liveBlocks().find(b => b.from === r.id && b.page === (other || {}).id);
      const conf = conflictIds().has(r.id);
      if (conf){
        box = '<div class="warnbox"><b>この予約は別ページの予約と重なっています。</b><br>' +
              'どちらかをキャンセルして、お客様に連絡してください。' +
              (bk && bk.state === 'unmapped'
                ? '<br>原因は<b>紐付け未設定</b>です。<a href="hpb_link.html">HPB連携の紐付け設定</a>で直せば、以後この組み合わせでは起きません。'
                : '<br>原因は<b>同期ラグ</b>です。両ページにほぼ同時に予約が入ると、閉じるまでの間に発生します。') +
              '</div>';
      } else if (bk && bk.state === 'done'){
        box = '<div class="okbox">この予約を受けたとき、<b>' + esc(other.name) + '</b> の ' +
              D.hm(bk.start) + '–' + D.hm(bk.end) + ' を自動で閉じました。二重予約は入りません。</div>';
      } else if (bk && bk.state === 'pending'){
        box = '<div class="warnbox"><b>' + esc(other.name) + '</b> の ' + D.hm(bk.start) + '–' + D.hm(bk.end) +
              ' はまだ閉じていません（次の同期で反映）。それまでは、もう一方のページから予約が入る可能性があります。</div>';
      } else if (bk && bk.state === 'unmapped'){
        box = '<div class="warnbox"><b>' + esc(other.name) + '</b> の枠を閉じられません。' +
              'この担当者がそのページで<b>紐付け未設定</b>のためです。' +
              '<a href="hpb_link.html">紐付けを設定する</a></div>';
      } else if (bk && bk.state === 'skip'){
        box = '<div class="okbox">この担当者は <b>' + esc(other.name) + '</b> に載せていないため、閉じる枠はありません。</div>';
      }
    }

    $('dBody').innerHTML =
      (r.code ? row('予約番号', '<span class="mono">' + esc(r.code) + '</span>') : '') +
      (r.menu ? row('メニュー', esc(r.menu)) : '') +
      row('担当', esc((lane || {}).name || '—')) +
      row('設備', esc((eq || {}).name || '—')) +
      row('流入元', pg
        ? '<span class="pgbadge ' + (pg.role === 'sub' ? 'sub' : 'main') + '">' + esc(pg.abbr) + '</span> ' +
          esc(pg.name) + '（HPB）'
        : (r.src === 'minimo' ? 'minimo' : r.src === 'form' ? '強制リンク（特別予約フォーム）' : 'SalonOne 直接入力')) +
      (r.tags.length ? row('区分', r.tags.map(esc).join('・')) : '') +
      box;

    $('mask').classList.add('show');
  }

  /* ==================================================================
     初期化
     ================================================================== */

  function boot(){
    render();

    $('dClose').addEventListener('click', () => $('mask').classList.remove('show'));
    $('mask').addEventListener('click', e => { if (e.target === $('mask')) $('mask').classList.remove('show'); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') $('mask').classList.remove('show');
    });

    MockBar.init({
      role,
      onRole: r => { role = r; render(); },
      toggles: [
        { key:'two', label:'HPB 2ページ運用', value:twoPages,
          note:'OFFにすると、サブページの予約と重複防止の表示が消えます。現行（1ページ）との比較用です。',
          onChange: v => { twoPages = v; if (!v) pageView = 'all'; renderAll(); } },
        { key:'eq', label:'設備行を表示', value:showEquip,
          onChange: v => { showEquip = v; renderTimeline(); } },
      ],
    });
  }

  boot();
})();
