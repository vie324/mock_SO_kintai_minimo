/* ============================================================================
   HPB連携（サロンボード連携 認証情報）のページスクリプト
   ----------------------------------------------------------------------------
   画面仕様と設計意図は hpb_link.html 冒頭のコメントに書いてある。
   ここは描画と状態管理だけ。

   状態:
     pages   連携ページの配列（追加連携で増える）
     link    link[kind][rowId][pageId] = code | 'none' | null
             null = 未設定。ここが重複防止の成否を分けるので、
             'none'（意図的に出さない）と必ず区別して持つ。
   ========================================================================== */
'use strict';

(function () {

  const D = window.HpbData;

  /* ---- 状態 ---- */
  let role   = 'system';
  let pages  = D.PAGES.map(p => Object.assign({}, p));
  let links  = {};                       // shopId -> link
  D.SHOPS.forEach(s => { links[s.id] = D.linkFor(s.id); });

  let cur    = null;                     // 編集中の shopId
  let kind   = 'staff';
  let filter = 'all';
  let addSeq = 0;

  const KINDS = [
    { k:'staff', label:'スタッフ' },
    { k:'menu',  label:'メニュー' },
    { k:'equip', label:'設備' },
  ];

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  let tt;
  function toast(m){
    const t = $('toast');
    t.textContent = m; t.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---- 便利関数 ---- */

  const pagesOf = shopId => D.shopOf(shopId).pageIds
    .map(id => pages.find(p => p.id === id)).filter(Boolean);

  /**
    その店舗の「未設定」件数。
    ページが1枚しかない店舗はページ間ブロック自体が存在しないので 0 を返す。
    （1枚運用の店舗で未設定の警告を出すと、直しようのない警告になる）
  */
  const unsetCountKind = (shopId, k) => {
    const ps = pagesOf(shopId);
    if (ps.length < 2) return 0;   // 1ページ運用にページ間ブロックは無いので数えない
    const L = links[shopId];
    let n = 0;
    D.ROWS[k].forEach(r => {
      const row = (L[k] || {})[r.id] || {};
      ps.forEach(p => { if (D.cellState(row[p.id]) === 'unset') n++; });
    });
    return n;
  };
  const unsetCount = shopId => KINDS.reduce((a, { k }) => a + unsetCountKind(shopId, k), 0);

  const totalUnset = () => D.SHOPS.reduce((a, s) => a + unsetCount(s.id), 0);
  const multiShops = () => D.SHOPS.filter(s => pagesOf(s.id).length >= 2);

  const ICON = {
    ok:'<svg viewBox="0 0 24 24"><path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>',
    exp:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M12 7.5v5M12 16h.01"/></svg>',
    none:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.5"/><path d="M8.5 12h7"/></svg>',
  };
  const STATUS = {
    ok:   { cls:'ok',   t:'認証済' },
    expired:{ cls:'exp',t:'要再認証' },
    none: { cls:'none', t:'未認証' },
  };

  /* ==================================================================
     一覧ページ
     ================================================================== */

  function renderPage(){
    const page = Shell.render({ active:'hpb-link', role });

    page.innerHTML =
      '<div class="pagehead">' +
        '<span class="ic"><svg viewBox="0 0 24 24"><circle cx="8.5" cy="14" r="4"/>' +
        '<path d="M11.4 11.1L19 3.5M16.5 6l2.2 2.2M14.3 8.2l2.2 2.2"/></svg></span>' +
        '<h1>サロンボード連携 認証情報</h1>' +
      '</div>' +
      '<p class="lead">店舗ごとにサロンボードのログインIDとパスワードを登録します。登録後「認証する」ボタンで初回ログイン＋マスタ取得を行い、' +
        'その後「自動同期」を ON にすると10分ごとにマスタ＋予約が自動同期されます。<br>' +
        '<b>1つの店舗にHPBのページが複数ある場合</b>（ヘア／美容整体のページとネイル＆アイのページなど）は、' +
        '「HPB紐付け設定」から<b>追加連携</b>してください。ページごとにログインIDが別々に必要です。</p>' +
      '<div id="guard"></div>' +
      '<div class="tblwrap"><table class="list">' +
        '<thead><tr>' +
          '<th>店舗 / 連携ページ</th>' +
          '<th>ログインID</th>' +
          '<th>状態</th>' +
          '<th class="opt">最終同期</th>' +
          '<th class="opt">自動同期</th>' +
          '<th class="opt">自動会計</th>' +
          '<th style="text-align:right">操作</th>' +
        '</tr></thead>' +
        '<tbody id="listBody"></tbody>' +
      '</table></div>';

    renderGuard();
    renderList();
  }

  /** 重複防止のステータス帯。トグルではなく「常時有効」の表示にしている */
  function renderGuard(){
    const ms = multiShops();
    const n  = totalUnset();
    const el = $('guard');
    if(!el) return;

    if (ms.length === 0){
      el.innerHTML =
        '<div class="guard">' +
          '<span class="ttl"><svg viewBox="0 0 24 24"><path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>' +
            'ページ間の予約重複防止</span>' +
          '<span class="always">常時有効</span>' +
          '<span class="desc">2ページ以上を連携している店舗が対象です。現在は全店舗が1ページ運用のため、重複は発生しません。</span>' +
        '</div>';
      return;
    }

    if (n === 0){
      el.innerHTML =
        '<div class="guard">' +
          '<span class="ttl"><svg viewBox="0 0 24 24"><path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>' +
            'ページ間の予約重複防止</span>' +
          '<span class="always">常時有効</span>' +
          '<span class="desc">片方のページに予約が入ると、もう一方の同じスタッフ・同じ時間帯を自動で閉じます。' +
            '対象：' + ms.map(s => esc(s.name)).join('、') + '（2ページ運用）。紐付けはすべて設定済みです。</span>' +
        '</div>';
      return;
    }

    el.innerHTML =
      '<div class="guard bad">' +
        '<span class="ttl"><svg viewBox="0 0 24 24"><path d="M12 3.5l9 16H3z"/><path d="M12 9.5v4.5M12 17h.01"/></svg>' +
          '紐付け未設定 ' + n + '件</span>' +
        '<span class="always">重複防止が働きません</span>' +
        '<span class="desc">未設定のスタッフ・メニュー・設備は、予約が入ってももう一方のページの枠を閉じられません。' +
          'このまま運用すると二重予約が成立します。</span>' +
        '<a class="go" href="#" id="guardGo">' + esc(ms[0].name) + 'の紐付けを開く</a>' +
      '</div>';
    const go = $('guardGo');
    if (go) go.addEventListener('click', e => { e.preventDefault(); openModal(ms[0].id); });
  }

  function renderList(){
    const rows = [];

    D.SHOPS.forEach(shop => {
      const ps = pagesOf(shop.id);
      const nUnset = unsetCount(shop.id);

      ps.forEach((p, i) => {
        const st = STATUS[p.status] || STATUS.none;
        const isHead = i === 0;

        const nameCell = isHead
          ? '<div class="shopcell">' +
              '<span class="nm">' + esc(shop.name) + '</span>' +
              (ps.length > 1 ? '<span class="pgcount">' + ps.length + 'ページ</span>' : '') +
            '</div>' +
            (ps.length > 1
              ? '<div class="shopcell" style="margin-top:3px">' +
                  '<span class="pgbadge main">' + esc(p.abbr) + '</span>' +
                  '<span class="nm" style="font-weight:600">' + esc(p.name) + '</span>' +
                  '<span class="genre">' + esc(p.genre) + '</span>' +
                '</div>'
              : '')
          : '<span class="branch">' +
              '<span class="pgbadge ' + (p.role === 'sub' ? 'sub' : 'main') + '">' + esc(p.abbr) + '</span>' +
              '<span><span class="nm" style="font-weight:600">' + esc(p.name) + '</span>' +
              '<span class="genre" style="display:block">' + esc(p.genre) + '</span></span>' +
            '</span>';

        const acts = isHead
          ? '<button class="lnk" data-reauth="' + p.id + '">' +
              '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 3.5V8h-4.5"/></svg>再認証</button>' +
            '<button class="lnk key' + (nUnset ? ' hasWarn' : '') + '" data-link="' + shop.id + '">' +
              (nUnset ? '<span class="warndot"></span>' : '') +
              '<svg viewBox="0 0 24 24"><path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7l-1.3 1.3"/>' +
              '<path d="M13.5 10.5a4 4 0 0 0-5.7 0L5 13.3a4 4 0 1 0 5.7 5.7l1.3-1.3"/></svg>HPB紐付け設定</button>' +
            '<button class="lnk" data-edit="' + p.id + '">' +
              '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>編集</button>'
          : '<button class="lnk" data-reauth="' + p.id + '">' +
              '<svg viewBox="0 0 24 24"><path d="M20 12a8 8 0 1 1-2.4-5.7M20 3.5V8h-4.5"/></svg>再認証</button>' +
            '<button class="lnk" data-edit="' + p.id + '">' +
              '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg>編集</button>';

        rows.push(
          '<tr' + (isHead ? '' : ' class="sub"') + '>' +
            '<td>' + nameCell + '</td>' +
            '<td class="mono tnum">' + esc(p.loginId) + '</td>' +
            '<td><span class="stat ' + st.cls + '">' + ICON[st.cls] + st.t + '</span></td>' +
            '<td class="opt"><span class="sync tnum">' + esc(p.lastSync) + '</span></td>' +
            '<td class="opt">' + swHtml('sync_' + p.id, p.autoSync) + '</td>' +
            '<td class="opt">' + swHtml('acc_' + p.id, p.autoAccount) + '</td>' +
            '<td><div class="acts">' + acts + '</div></td>' +
          '</tr>');
      });
    });

    $('listBody').innerHTML = rows.join('');

    $('listBody').querySelectorAll('[data-link]').forEach(b =>
      b.addEventListener('click', () => openModal(b.dataset.link)));
    $('listBody').querySelectorAll('[data-reauth]').forEach(b =>
      b.addEventListener('click', () => {
        const p = pages.find(x => x.id === b.dataset.reauth);
        toast(p.name + ' を再認証しました（モック）');
      }));
    $('listBody').querySelectorAll('[data-edit]').forEach(b =>
      b.addEventListener('click', () => toast('ログインID・パスワードの編集（モックでは省略）')));
    $('listBody').querySelectorAll('.sw input').forEach(i =>
      i.addEventListener('change', e => {
        const [w, id] = e.target.dataset.sw.split('|');
        const p = pages.find(x => x.id === id);
        if (w === 'sync') p.autoSync = e.target.checked; else p.autoAccount = e.target.checked;
        toast(p.name + '：' + (w === 'sync' ? '自動同期' : '自動会計') + 'を ' + (e.target.checked ? 'ON' : 'OFF') + ' にしました');
      }));
  }

  function swHtml(key, on){
    const [w, id] = [key.split('_')[0], key.slice(key.indexOf('_') + 1)];
    return '<label class="sw"><input type="checkbox" data-sw="' + w + '|' + id + '"' + (on ? ' checked' : '') +
           '><i></i><span>' + (on ? 'ON' : 'OFF') + '</span></label>';
  }

  /* ==================================================================
     紐付けモーダル
     ================================================================== */

  function openModal(shopId){
    cur = shopId; kind = 'staff'; filter = 'all';
    $('bigSub').textContent = D.shopOf(shopId).name + ' の紐付けを編集します';
    $('addBox').classList.remove('show');
    $('mask').classList.add('show');
    renderModal();
  }
  function closeModal(){
    $('mask').classList.remove('show');
    hidePop();
    renderGuard(); renderList();
  }

  function renderModal(){
    renderPageCards();
    renderMxGuard();
    renderTabs();
    renderChips();
    renderMatrix();
    const n = unsetCount(cur);
    $('bfHint').textContent = n
      ? '未設定 ' + n + '件。保存はできますが、未設定の行は重複防止の対象外のままです。'
      : 'すべて設定済みです。';
  }

  function renderPageCards(){
    const ps = pagesOf(cur);
    $('pgN').textContent = ps.length + 'ページ' + (ps.length === 1 ? '（追加連携するとここに増えます）' : '');

    $('pgCards').innerHTML = ps.map(p => {
      const st = STATUS[p.status] || STATUS.none;
      return '<div class="pgcard' + (p.role === 'sub' ? ' isSub' : '') + '">' +
        '<div class="t">' +
          '<span class="pgbadge ' + (p.role === 'sub' ? 'sub' : 'main') + '">' + esc(p.abbr) + '</span>' +
          '<span class="nm">' + esc(p.name) + '</span>' +
        '</div>' +
        '<div class="meta">' +
          esc(p.genre) + '　/　' + (p.role === 'sub' ? 'サブページ' : '本ページ') + '<br>' +
          'ログインID <span class="mono">' + esc(p.loginId) + '</span><br>' +
          '<span class="stat ' + st.cls + '" style="font-size:11.5px">' + ICON[st.cls] + st.t + '</span>' +
          '　最終同期 <span class="tnum">' + esc(p.lastSync) + '</span>' +
        '</div>' +
        '<div class="foot">' +
          '<button class="lnk" data-pre="' + p.id + '">再認証</button>' +
          '<button class="lnk" data-ped="' + p.id + '">ID・パスワード編集</button>' +
          (p.role === 'sub' ? '<button class="lnk del" data-pdel="' + p.id + '">連携を解除</button>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    $('pgCards').querySelectorAll('[data-pre]').forEach(b =>
      b.addEventListener('click', () => toast('再認証しました（モック）')));
    $('pgCards').querySelectorAll('[data-ped]').forEach(b =>
      b.addEventListener('click', () => toast('ログインID・パスワードの編集（モックでは省略）')));
    $('pgCards').querySelectorAll('[data-pdel]').forEach(b =>
      b.addEventListener('click', () => removePage(b.dataset.pdel)));
  }

  function removePage(pageId){
    const p = pages.find(x => x.id === pageId);
    if (!window.confirm(p.name + ' の連携を解除します。\nこのページの紐付けは削除され、重複防止の対象外になります。よろしいですか？')) return;
    const shop = D.shopOf(cur);
    shop.pageIds = shop.pageIds.filter(id => id !== pageId);
    pages = pages.filter(x => x.id !== pageId);
    KINDS.forEach(({k}) => Object.keys(links[cur][k]).forEach(rid => { delete links[cur][k][rid][pageId]; }));
    toast(p.name + ' の連携を解除しました');
    renderModal();
  }

  /** モーダル上部の未設定警告 */
  function renderMxGuard(){
    const ps = pagesOf(cur), n = unsetCount(cur);
    const el = $('mxGuard');
    if (ps.length < 2){
      el.innerHTML =
        '<div class="guard" style="margin-top:16px">' +
          '<span class="ttl"><svg viewBox="0 0 24 24"><path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>' +
            'この店舗は1ページ運用です</span>' +
          '<span class="desc">連携ページが1枚のあいだは、ページ間の予約重複は起きません。' +
            '2枚目を足すと、以下の紐付けをもとに自動で相手ページの枠を閉じるようになります。</span>' +
        '</div>';
      return;
    }
    el.innerHTML = n
      ? '<div class="guard bad" style="margin-top:16px">' +
          '<span class="ttl"><svg viewBox="0 0 24 24"><path d="M12 3.5l9 16H3z"/><path d="M12 9.5v4.5M12 17h.01"/></svg>' +
            '未設定 ' + n + '件</span>' +
          '<span class="always">この行は重複防止の対象外</span>' +
          '<span class="desc">未設定のままだと、予約が入ってももう一方のページの枠を閉じられません。' +
            '載せないなら「このページには出さない」を選んでください。</span>' +
        '</div>'
      : '<div class="guard" style="margin-top:16px">' +
          '<span class="ttl"><svg viewBox="0 0 24 24"><path d="M12 3l7.5 3v5.5c0 4.4-3.1 8.2-7.5 9.5-4.4-1.3-7.5-5.1-7.5-9.5V6z"/><path d="M9 12l2.2 2.2L15.5 10"/></svg>' +
            'ページ間の予約重複防止</span>' +
          '<span class="always">常時有効</span>' +
          '<span class="desc">すべて設定済みです。片方のページに予約が入ると、もう一方の同じ行・同じ時間帯を自動で閉じます。</span>' +
        '</div>';
  }

  function renderTabs(){
    $('tabs').innerHTML = KINDS.map(({k, label}) => {
      const w = unsetCountKind(cur, k);
      return '<button data-k="' + k + '" class="' + (k === kind ? 'on' : '') + '">' + label +
             '<span class="cnt">' + D.ROWS[k].length + '</span>' +
             (w ? '<span class="warnpip" title="未設定 ' + w + '件"></span>' : '') + '</button>';
    }).join('');
    $('tabs').querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => { kind = b.dataset.k; renderTabs(); renderChips(); renderMatrix(); }));
  }

  function renderChips(){
    const ps  = pagesOf(cur);
    const ids = ps.map(p => p.id);
    const counts = { all:0, both:0, one:0, unset:0 };
    D.ROWS[kind].forEach(r => {
      const s = D.rowSummary(links[cur][kind][r.id] || {}, ids);
      counts.all++;
      if (s === 'both') counts.both++;
      else if (s === 'mainonly' || s === 'subonly' || s === 'partial') counts.one++;
      else if (s === 'unset') counts.unset++;
    });

    const defs = [
      { f:'all',   t:'すべて',     n:counts.all },
      { f:'both',  t:'両ページ',   n:counts.both },
      { f:'one',   t:'片方のみ',   n:counts.one },
      { f:'unset', t:'未設定',     n:counts.unset, warn:true },
    ];
    $('chips').innerHTML = '<span class="lb">絞り込み</span>' +
      defs.filter(d => ps.length > 1 || d.f === 'all')
          .map(d => '<button class="chip' + (d.warn ? ' warn' : '') + (filter === d.f ? ' on' : '') +
                    '" data-f="' + d.f + '">' + d.t + ' ' + d.n + '</button>').join('');
    $('chips').querySelectorAll('.chip').forEach(b =>
      b.addEventListener('click', () => { filter = b.dataset.f; renderChips(); renderMatrix(); }));
  }

  function renderMatrix(){
    const ps = pagesOf(cur);
    const L  = links[cur][kind];

    const head =
      '<tr>' +
        '<th style="min-width:190px">SalonOne 側の' + KINDS.find(x => x.k === kind).label + '</th>' +
        ps.map(p =>
          '<th class="pgcol"><div class="ph">' +
            '<span class="pgbadge ' + (p.role === 'sub' ? 'sub' : 'main') + '">' + esc(p.abbr) + '</span>' +
            '<span class="nm">' + esc(p.name) + '</span>' +
            '<button class="menu" data-bulk="' + p.id + '" aria-label="一括設定">&#x25BE;</button>' +
          '</div><div class="gn">' + esc(p.genre) + '</div></th>').join('') +
        (ps.length > 1 ? '<th class="stcol">状態</th>' : '') +
      '</tr>';

    const ids = ps.map(p => p.id);
    const rows = D.ROWS[kind].filter(r => {
      if (filter === 'all') return true;
      const s = D.rowSummary(L[r.id] || {}, ids);
      if (filter === 'both')  return s === 'both';
      if (filter === 'one')   return s === 'mainonly' || s === 'subonly' || s === 'partial';
      if (filter === 'unset') return s === 'unset';
      return true;
    });

    if (!rows.length){
      $('mxBody').innerHTML = '<div class="empty">該当する行はありません。</div>';
      return;
    }

    const body = rows.map(r => {
      const row = L[r.id] || {};
      const sum = D.rowSummary(row, ids);
      const lab = D.SUMMARY_LABEL[sum];
      return '<tr' + (sum === 'unset' ? ' class="unset"' : '') + '>' +
        '<td><div class="rowname">' + esc(r.name) + '</div>' +
          (r.note ? '<div class="rownote">' + esc(r.note) + '</div>' : '') + '</td>' +
        ps.map(p => '<td class="pgcol">' + cellHtml(r.id, p) + '</td>').join('') +
        (ps.length > 1 ? '<td><span class="sm-tag ' + lab.cls + '">' + lab.t + '</span></td>' : '') +
      '</tr>';
    }).join('');

    $('mxBody').innerHTML = '<table class="mx"><thead>' + head + '</thead><tbody>' + body + '</tbody></table>';

    $('mxBody').querySelectorAll('.cellsel').forEach(sel =>
      sel.addEventListener('change', onCellChange));
    $('mxBody').querySelectorAll('[data-bulk]').forEach(b =>
      b.addEventListener('click', e => { e.stopPropagation(); showBulk(b, b.dataset.bulk); }));
  }

  function cellHtml(rowId, p){
    const v  = (links[cur][kind][rowId] || {})[p.id];
    const st = D.cellState(v);
    const cand = (D.CAND[kind] || {})[p.id] || [];
    const opts =
      '<option value="__unset"' + (st === 'unset' ? ' selected' : '') + '>未設定</option>' +
      '<option value="none"' + (st === 'none' ? ' selected' : '') + '>このページには出さない</option>' +
      cand.map(c => '<option value="' + c.code + '"' + (v === c.code ? ' selected' : '') + '>' +
                    esc(c.label) + ' [' + c.code + ']</option>').join('');
    return '<select class="cellsel ' + (st === 'none' ? 'isNone' : st === 'unset' ? 'isUnset' : '') +
           '" data-row="' + rowId + '" data-page="' + p.id + '"' +
           (st === 'unset' ? ' aria-invalid="true"' : '') + '>' + opts + '</select>';
  }

  function onCellChange(e){
    const { row, page } = e.target.dataset;
    const raw = e.target.value;
    links[cur][kind][row][page] = raw === '__unset' ? null : raw;
    renderMxGuard(); renderTabs(); renderChips(); renderMatrix();
    const n = unsetCount(cur);
    $('bfHint').textContent = n
      ? '未設定 ' + n + '件。保存はできますが、未設定の行は重複防止の対象外のままです。'
      : 'すべて設定済みです。';
  }

  /* ---- 列の一括設定 ---- */

  function showBulk(anchor, pageId){
    const p = pages.find(x => x.id === pageId);
    const pop = $('popmenu');
    pop.innerHTML =
      '<div class="cap">' + esc(p.name) + ' の列をまとめて設定</div>' +
      '<button data-a="auto">候補名で自動紐付け</button>' +
      '<button data-a="none">すべて「このページには出さない」</button>' +
      '<div class="sep"></div>' +
      '<button data-a="clear">すべて未設定に戻す</button>';
    const r = anchor.getBoundingClientRect();
    pop.style.left = Math.max(8, Math.min(r.left - 180, window.innerWidth - 230)) + 'px';
    pop.style.top  = (r.bottom + 6) + 'px';
    pop.classList.add('show');
    pop.querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => { bulk(pageId, b.dataset.a); hidePop(); }));
  }
  function hidePop(){ $('popmenu').classList.remove('show'); }

  /**
    名前の一致で自動紐付けする。
    HPB側の表記が "MIURA" のように違うことがあるので当たらない行は未設定のまま残す。
    完全自動にすると、誤った相手に紐付いて別人の枠を閉じてしまう。
  */
  function norm(s){
    return String(s).toLowerCase()
      .replace(/[\s　・（）()［］\[\]【】＋+]/g, '')
      .replace(/[Ａ-Ｚａ-ｚ０-９]/g, c => String.fromCharCode(c.charCodeAt(0) - 0xFEE0));
  }
  function autoMatch(pageId){
    const cand = (D.CAND[kind] || {})[pageId] || [];
    const used = new Set();
    D.ROWS[kind].forEach(r => {
      const v = links[cur][kind][r.id][pageId];
      if (D.cellState(v) === 'linked') used.add(v);
    });

    let hit = 0, miss = 0;
    D.ROWS[kind].forEach(r => {
      if (D.cellState(links[cur][kind][r.id][pageId]) !== 'unset') return;
      const rn = norm(r.name);
      const m = cand.find(c => {
        if (used.has(c.code)) return false;
        const cn = norm(c.label);
        if (!cn) return false;
        return rn.includes(cn) || cn.includes(rn) ||
               (cn.length >= 3 && rn.includes(cn.slice(0, 3))) ||
               (rn.length >= 3 && cn.includes(rn.slice(0, 3)));
      });
      if (m){ links[cur][kind][r.id][pageId] = m.code; used.add(m.code); hit++; }
      else miss++;
    });
    return { hit, miss };
  }

  function bulk(pageId, action){
    if (action === 'auto'){
      const { hit, miss } = autoMatch(pageId);
      toast(hit
        ? hit + '件を自動で紐付けました。' + (miss ? '残り' + miss + '件は候補が見つからないため未設定のままです。' : '')
        : '名前が一致する候補が見つかりませんでした。手動で選んでください。');
    } else if (action === 'none'){
      D.ROWS[kind].forEach(r => {
        if (D.cellState(links[cur][kind][r.id][pageId]) === 'unset') links[cur][kind][r.id][pageId] = 'none';
      });
      toast('未設定だった行を「このページには出さない」にしました');
    } else {
      D.ROWS[kind].forEach(r => { links[cur][kind][r.id][pageId] = null; });
      toast('この列をすべて未設定に戻しました');
    }
    renderModal();
  }

  /* ---- 追加連携 ---- */

  function resetAdd(){
    $('apName').value = ''; $('apId').value = ''; $('apPw').value = '';
    $('apGenre').selectedIndex = 0;
    $('apSync').checked = true; $('apAcc').checked = false;
    $('apMsg').textContent = ''; $('apMsg').classList.remove('err');
    $('apPw').type = 'password';
  }

  function doAdd(){
    const name  = $('apName').value.trim();
    const id    = $('apId').value.trim();
    const pw    = $('apPw').value;
    const msg   = $('apMsg');

    if (!name || !id || !pw){
      msg.textContent = 'ページの呼び名・ログインID・パスワードをすべて入力してください';
      msg.classList.add('err');
      return;
    }
    msg.classList.remove('err');
    msg.textContent = '認証中… サロンボードにログインしてマスタを取得しています';
    $('apGo').disabled = true;

    // 実際は非同期ジョブ。ここでは見た目のためだけに遅らせる
    setTimeout(() => {
      $('apGo').disabled = false;
      const pid = 'pg_new' + (++addSeq);
      const p = {
        id:pid, role:'sub', abbr:'＋' + addSeq,
        name, genre:$('apGenre').value,
        loginId:id, salonId:'H0009' + (10000 + addSeq),
        status:'ok', lastSync:new Date().toLocaleString('ja-JP', { hour12:false }).replace(/\//g, '/'),
        autoSync:$('apSync').checked, autoAccount:$('apAcc').checked, url:'',
      };
      pages.push(p);
      D.shopOf(cur).pageIds.push(pid);

      // 取得したてのページは全セル未設定。ここから紐付ける
      KINDS.forEach(({k}) => D.ROWS[k].forEach(r => { links[cur][k][r.id][pid] = null; }));
      // 取得したマスタ候補（モックなので本ページの候補を流用する）
      KINDS.forEach(({k}) => { D.CAND[k][pid] = (D.CAND[k].pg_sub || D.CAND[k].pg_main || []).slice(); });

      $('addBox').classList.remove('show');
      resetAdd();
      renderModal();
      toast(name + ' を連携しました。マスタを取得したので、続けて紐付けてください');
    }, 900);
  }

  /* ==================================================================
     初期化
     ================================================================== */

  function boot(){
    renderPage();

    $('bigX').addEventListener('click', closeModal);
    $('bigClose').addEventListener('click', closeModal);
    $('bigSave').addEventListener('click', () => {
      const n = unsetCount(cur);
      closeModal();
      toast(n ? '保存しました（未設定 ' + n + '件は重複防止の対象外です）' : '保存しました');
    });
    $('mask').addEventListener('click', e => { if (e.target === $('mask')) closeModal(); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape'){ hidePop(); if ($('mask').classList.contains('show')) closeModal(); }
    });
    document.addEventListener('click', hidePop);
    $('popmenu').addEventListener('click', e => e.stopPropagation());

    $('addBtn').addEventListener('click', () => {
      const b = $('addBox');
      b.classList.toggle('show');
      if (b.classList.contains('show')) { resetAdd(); $('apName').focus(); }
    });
    $('apCancel').addEventListener('click', () => { $('addBox').classList.remove('show'); resetAdd(); });
    $('apGo').addEventListener('click', doAdd);
    $('apEye').addEventListener('click', () => {
      const i = $('apPw');
      i.type = i.type === 'password' ? 'text' : 'password';
    });

    MockBar.init({
      role,
      onRole: r => { role = r; renderPage(); },
      toggles: [],
    });
  }

  boot();
})();
