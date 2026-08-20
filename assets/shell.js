/* ============================================================================
   管理画面シェル（サイドバー＋上部バー）  →  移植先: app/(admin)/layout.tsx 相当
   ----------------------------------------------------------------------------
   現行画面のスクリーンショットに合わせたナビゲーション構造。
   打刻・予約表・勤怠管理はすべてこのシェルの中に入る。

   ■ ロールと可視範囲（権限マトリックスより）
       システム管理者 … 全ブランド・全店舗
       ブランド管理者 … 自ブランドの全店舗
       店舗管理者     … 自店舗のみ
       店舗スタッフ   … 自店舗のみ
     可視範囲が「自店舗のみ」のロールは、ブランド／エリア／店舗のセレクタを
     出さずに所属店舗を固定表示する（誤操作と情報漏れの両方を防ぐ）。

   ■ 勤怠管理の位置
     設定 > 管理設定 > 労務管理 > 勤怠管理 と3階層下。
     打刻漏れのアラートから直接飛べる導線が別途あると運用が楽になるはず（要検討）。
   ========================================================================== */
'use strict';

window.Shell = (function () {

  /* ---- アイコン ---- */
  const I = {
    cal:'<rect x="3.5" y="4.5" width="17" height="16" rx="2.5"/><path d="M3.5 9h17M8 2.5v4M16 2.5v4"/>',
    bell:'<path d="M4 18h16M6 18a6 6 0 0 1 12 0M10 21h4"/>',
    punch:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    users:'<circle cx="9" cy="8" r="3.2"/><path d="M3 20c0-3.3 2.7-5.5 6-5.5s6 2.2 6 5.5M16 5.5a3 3 0 0 1 0 6M17.5 20c0-2.4-.8-4-2-5"/>',
    chat:'<path d="M20 15a2.5 2.5 0 0 1-2.5 2.5H8L4 21V6.5A2.5 2.5 0 0 1 6.5 4h11A2.5 2.5 0 0 1 20 6.5z"/>',
    mail:'<rect x="3" y="5.5" width="18" height="13" rx="2.2"/><path d="M3.6 6.8L12 13l8.4-6.2"/>',
    again:'<path d="M20 12a8 8 0 1 1-2.4-5.7M20 3.5V8h-4.5"/>',
    up:'<path d="M4 17l5-5 3.5 3.5L20 8M20 8h-4.5M20 8v4.5"/>',
    mega:'<path d="M4 10v4a1.5 1.5 0 0 0 1.5 1.5H7l3.5 4V6.5L7 10.5H5.5A1.5 1.5 0 0 0 4 12zM14 8.5a5 5 0 0 1 0 7"/>',
    gear:'<circle cx="12" cy="12" r="3"/><path d="M12 2.5v3M12 18.5v3M21.5 12h-3M5.5 12h-3M18.7 5.3l-2.1 2.1M7.4 16.6l-2.1 2.1M18.7 18.7l-2.1-2.1M7.4 7.4L5.3 5.3"/>',
    brand:'<path d="M4 21V5l8-2v18M12 21h8V9l-8-2M7 9h1M7 13h1M7 17h1M16 12h1M16 16h1"/>',
    pin:'<path d="M12 21s7-6.3 7-11a7 7 0 1 0-14 0c0 4.7 7 11 7 11z"/><circle cx="12" cy="10" r="2.6"/>',
    wrench:'<path d="M15.5 3.5a5.5 5.5 0 0 0-5 8.3L3.5 18.8 5.2 20.5l7-7a5.5 5.5 0 0 0 7.3-7.2l-3 3-2.6-.7-.7-2.6z"/>',
    box:'<path d="M3.5 7.5L12 3.5l8.5 4v9L12 20.5l-8.5-4z"/><path d="M3.5 7.5L12 11.5l8.5-4M12 11.5v9"/>',
    case:'<rect x="3" y="7.5" width="18" height="12.5" rx="2.2"/><path d="M8.5 7.5V6a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2v1.5"/>',
    stop:'<circle cx="12" cy="13.5" r="7"/><path d="M12 10v3.5l2.2 1.5M9.5 3.5h5M12 3.5v3"/>',
    list:'<path d="M9 6.5h11M9 12h11M9 17.5h11M4.5 6.5h.01M4.5 12h.01M4.5 17.5h.01"/>',
    doc:'<path d="M6 3.5h7l5 5V20a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4.5a1 1 0 0 1 1-1z"/><path d="M13 3.5V9h5"/>',
    clock:'<circle cx="12" cy="12" r="8.5"/><path d="M12 7v5l3.5 2"/>',
    globe:'<circle cx="12" cy="12" r="8.5"/><path d="M3.5 12h17M12 3.5c4 4.5 4 12 0 17M12 3.5c-4 4.5-4 12 0 17"/>',
    layers:'<path d="M12 3.5l8.5 4.5-8.5 4.5L3.5 8z"/><path d="M3.5 12.5L12 17l8.5-4.5M3.5 16.5L12 21l8.5-4.5"/>',
    shield:'<path d="M12 3l7 2.8v5.4c0 4.4-3 8-7 9.8-4-1.8-7-5.4-7-9.8V5.8z"/>',
  };
  const icon = k => '<svg viewBox="0 0 24 24">' + (I[k] || '') + '</svg>';

  /* ---- ナビゲーション定義（現行画面より） ---- */
  const NAV = [
    { sec:'打刻・予約管理' },
    { id:'schedule',  label:'予約表',            ic:'cal' },
    { id:'reception', label:'受付',              ic:'bell' },
    { id:'punch',     label:'打刻',              ic:'punch' },
    { sec:'顧客管理' },
    { id:'customers', label:'顧客管理',          ic:'users' },
    { id:'line',      label:'LINEチャット',      ic:'chat' },
    { id:'minimomsg', label:'Minimoメッセージ',  ic:'mail' },
    { id:'revisit',   label:'再来店促進',        ic:'again' },
    { sec:'分析' },
    { id:'sales',     label:'売上',              ic:'up' },
    { id:'marketing', label:'マーケティング',    ic:'mega' },
    { sec:'設定' },
    { id:'admincfg',  label:'管理設定',          ic:'gear', group:true, children:[
        { id:'brand',   label:'ブランド管理', ic:'brand', lv:2 },
        { id:'shop',    label:'店舗管理',     ic:'pin',   lv:2 },
        { id:'staff',   label:'スタッフ管理', ic:'users', lv:2 },
        { id:'equip',   label:'設備管理',     ic:'wrench',lv:2 },
        { id:'stock',   label:'在庫管理',     ic:'box',   lv:2 },
        { id:'labor',   label:'労務管理',     ic:'case',  lv:2, group:true, children:[
            { id:'time-tracking', label:'勤怠管理', ic:'stop', lv:3 },
        ]},
    ]},
    { id:'menucfg',   label:'メニュー設定',      ic:'list' },
    { id:'tplcfg',    label:'テンプレート設定',  ic:'doc' },
    { id:'shiftcfg',  label:'シフト設定',        ic:'clock' },
    { id:'extcfg',    label:'外部連携設定',      ic:'globe' },
    { id:'fixcfg',    label:'定型設定',          ic:'layers' },
    { id:'permcfg',   label:'権限設定',          ic:'shield', group:true, children:[
        { id:'permmatrix', label:'権限マトリックス', ic:'shield', lv:2 },
    ]},
  ];

  /* ---- ロール定義（権限マトリックスより） ---- */
  const ROLES = {
    system: { label:'システム管理者', scope:'全ブランド・全店舗',   who:'システム運用（ROOT）', sub:'全国店舗 / root 様', pickers:true  },
    brand:  { label:'ブランド管理者', scope:'自ブランドの全店舗',   who:'ブランド管理',         sub:"si'se 全店舗 / 管理者 様", pickers:true  },
    shop:   { label:'店舗管理者',     scope:'自店舗のみ',           who:'店舗管理者',           sub:"si'se 町田店 / 店長 様",   pickers:false },
    staff:  { label:'店舗スタッフ',   scope:'自店舗のみ',           who:'店舗スタッフ',         sub:"si'se 町田店 / 三浦 様",   pickers:false },
  };

  /** 可視範囲が「自店舗のみ」のロールは、そのIDが含まれる */
  const isSingleShop = role => role === 'shop' || role === 'staff';

  /* ---- 描画 ---- */

  function navHtml(items, active){
    return items.map(it => {
      if(it.sec) return '<div class="nav-sec">' + it.sec + '</div>';

      const hasActiveChild = it.children && containsActive(it.children, active);
      const on  = it.id === active;
      const lv  = it.lv ? ' lv' + it.lv : '';
      const car = it.group ? '<span class="caret">' + (hasActiveChild ? '▾' : '▸') + '</span>' : '';
      let html = '<a class="nav-item' + lv + (on ? ' on' : '') + '" data-nav="' + it.id + '" href="' +
                 (LINKS[it.id] || '#') + '">' + icon(it.ic) + '<span>' + it.label + '</span>' + car + '</a>';
      // 現在地を含む枝だけ開いた状態で描く（現行画面と同じ挙動）
      if(it.children && hasActiveChild) html += navHtml(it.children, active);
      return html;
    }).join('');
  }
  function containsActive(items, active){
    return items.some(c => c.id === active || (c.children && containsActive(c.children, active)));
  }

  /** モック内で行き来できる画面だけ実リンクにする */
  const LINKS = {
    'punch':'kintai_punch.html',
    'time-tracking':'kintai_admin.html',
    'schedule':'minimo_slots.html',
  };

  const PICKERS =
    '<select aria-label="ブランド"><option>si\'se</option></select>' +
    '<select aria-label="エリア"><option>東京都</option></select>' +
    '<select aria-label="店舗"><option>si\'se 町田店</option><option>si\'se 相模大野店</option></select>';

  /**
   * シェルを描画する
   * @param {{active:string, role:string}} opt
   */
  function render(opt){
    const role = ROLES[opt.role] || ROLES.system;
    const mount = document.getElementById('shell');

    mount.innerHTML =
      '<div class="app">' +
        '<aside class="side" id="side">' +
          '<div class="side-head">' +
            '<img src="../assets/logo-light.png" alt="SalonOne">' +
            '<button class="side-collapse" aria-label="サイドバーを閉じる">&#x2039;</button>' +
          '</div>' +
          (role.pickers ? '<div class="side-picks">' + PICKERS + '</div>' : '') +
          '<nav>' + navHtml(NAV, opt.active) + '</nav>' +
        '</aside>' +
        '<div class="body">' +
          '<header class="topbar">' +
            '<button class="tb-burger" id="burger" aria-label="メニュー">' +
              '<svg viewBox="0 0 24 24"><path d="M4 7h16M4 12h16M4 17h16"/></svg></button>' +
            '<span class="tb-logo"><img src="../assets/logo.png" alt="SalonOne"></span>' +
            (role.pickers ? PICKERS : '') +
            '<div class="tb-right">' +
              '<div class="tb-user">' +
                '<span class="tb-ava">ro</span>' +
                '<div class="tb-who"><b>' + role.who + '</b><br><span>' + role.sub + '</span></div>' +
              '</div>' +
              '<button class="tb-btn">運営管理</button>' +
              '<button class="tb-btn gold">ログアウト</button>' +
            '</div>' +
          '</header>' +
          '<main class="main" id="page"></main>' +
        '</div>' +
      '</div>' +
      '<div class="scrim" id="scrim"></div>';

    // モバイル：ハンバーガーでドロワー開閉
    const side = document.getElementById('side'), scrim = document.getElementById('scrim');
    const close = () => { side.classList.remove('open'); scrim.classList.remove('show'); };
    document.getElementById('burger').addEventListener('click', () => {
      side.classList.add('open'); scrim.classList.add('show');
    });
    scrim.addEventListener('click', close);
    mount.querySelector('.side-collapse').addEventListener('click', close);

    return document.getElementById('page');
  }

  return { render, ROLES, isSingleShop };
})();
