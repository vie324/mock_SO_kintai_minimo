/* ============================================================================
   メニュー設定 ページスクリプト
   ----------------------------------------------------------------------------
   仕様と設計意図は menu_settings.html 冒頭のコメントに書いてある。

   状態:
     tab      'menu' | 'cat' | 'off'
     MENUS    メニュー。編集モーダルの結果をここに書き戻す
     draft    編集中のメニュー（キャンセルで捨てる）
   ========================================================================== */
'use strict';

(function () {

  const M = window.MenuData;

  let role   = 'system';
  let tab    = 'menu';
  let cat    = 'すべて';
  let q      = '';
  let MENUS  = M.menus();
  let draft  = null;

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  let tt;
  function toast(m){
    const t = $('toast');
    t.textContent = m; t.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2800);
  }

  const CAT_CLS = { 'HPB連携':'hpb', 'minimo連携':'mini', '店頭メニュー':'shop' };

  /* ==================================================================
     ページ
     ================================================================== */

  function render(){
    const page = Shell.render({ active:'menu-settings', role });

    page.innerHTML =
      '<div class="pagehead">' +
        '<span class="ic"><svg viewBox="0 0 24 24"><rect x="5" y="3.5" width="14" height="17" rx="2"/>' +
        '<path d="M9 2.5h6v3H9zM9 10h6M9 14h4"/></svg></span>' +
        '<h1>メニュー</h1>' +
      '</div>' +
      '<div class="tabs" id="tabs">' +
        '<button data-t="menu" class="' + (tab === 'menu' ? 'on' : '') + '">メニュー</button>' +
        '<button data-t="cat" class="'  + (tab === 'cat'  ? 'on' : '') + '">カテゴリー</button>' +
        '<button data-t="off" class="'  + (tab === 'off'  ? 'on' : '') + '">オフ・オプション<span class="new">追加</span></button>' +
      '</div>' +
      '<div id="body"></div>';

    $('tabs').querySelectorAll('button').forEach(b =>
      b.addEventListener('click', () => { tab = b.dataset.t; render(); }));

    if (tab === 'menu') renderMenus();
    else if (tab === 'off') renderOffTab();
    else renderCatTab();
  }

  /* ---- メニュー一覧 ---- */

  function renderMenus(){
    const nOff = MENUS.filter(m => m.offSet).length;

    $('body').innerHTML =
      '<div class="tip">' +
        '<span class="i">!</span>' +
        '<div class="b">オフの条件を<b>メニュー名に書く運用をやめられます</b>。' +
          '<code>（ご新規様/自店オフ無料）</code> のように名前へ書いても、システムはオフを知らないので、' +
          'オフの時間が枠に入らず料金も自動で乗りません。<br>' +
          '編集の<b>「オフの確認」</b>をONにすると、予約時にオフを選んでもらい、' +
          '所要時間と料金が自動で加算されます。現在 <b>' + nOff + ' / ' + MENUS.length + '件</b>が設定済みです。</div>' +
      '</div>' +

      '<div class="lhead">' +
        '<span class="n">' + MENUS.length + '件</span>' +
        '<span class="sp"></span>' +
        '<button class="btn solid" id="addBtn">＋ メニューを追加</button>' +
      '</div>' +

      '<div class="chips" id="chips"></div>' +
      '<div class="search">' +
        '<svg viewBox="0 0 24 24"><circle cx="11" cy="11" r="6.5"/><path d="M16 16l4.5 4.5"/></svg>' +
        '<input id="q" type="search" placeholder="メニュー名で検索..." value="' + esc(q) + '">' +
      '</div>' +

      '<div class="tblwrap"><table class="mt">' +
        '<thead><tr>' +
          '<th></th><th>順位</th><th>メニュー名</th>' +
          '<th>オフ / オプション</th>' +
          '<th>プラン</th><th style="text-align:right">価格</th>' +
          '<th style="text-align:right">施術時間</th><th style="text-align:right">アクション</th>' +
        '</tr></thead><tbody id="rows"></tbody>' +
      '</table></div>';

    const cats = ['すべて'].concat(M.CATEGORIES);
    $('chips').innerHTML = cats.map(c =>
      '<button class="chip' + (cat === c ? ' on' : '') + '" data-c="' + esc(c) + '">' + esc(c) + '</button>').join('');
    $('chips').querySelectorAll('.chip').forEach(b =>
      b.addEventListener('click', () => { cat = b.dataset.c; renderRows(); syncChips(); }));

    $('q').addEventListener('input', e => { q = e.target.value; renderRows(); });
    $('addBtn').addEventListener('click', () => toast('メニューの新規追加（モックでは省略）'));

    renderRows();
  }

  function syncChips(){
    $('chips').querySelectorAll('.chip').forEach(b =>
      b.classList.toggle('on', b.dataset.c === cat));
  }

  function renderRows(){
    const list = MENUS.filter(m =>
      (cat === 'すべて' || m.cat === cat) &&
      (!q || m.name.toLowerCase().indexOf(q.toLowerCase()) >= 0));

    if (!list.length){
      $('rows').innerHTML = '<tr><td colspan="8" style="padding:26px;text-align:center;color:var(--mut)">' +
        '該当するメニューはありません。</td></tr>';
      return;
    }

    $('rows').innerHTML = list.map(m => {
      const off = m.offSet ? M.OFF_SETS[m.offSet] : null;
      return '<tr>' +
        '<td><span class="grip">&#x2059;</span></td>' +
        '<td class="rank">' + m.rank + '</td>' +
        '<td><div class="mname">' + esc(m.name) + '</div>' +
          '<div class="mbadges">' +
            '<span class="bdg ' + (CAT_CLS[m.cat] || '') + '">' + esc(m.cat) + '</span>' +
            (m.showForm ? '' : '<span class="bdg hide">フォーム非表示</span>') +
          '</div></td>' +
        '<td>' +
          (off ? '<span class="bdg off">' + esc(off.name) + 'を聞く</span>'
               : '<span class="bdg hide">オフを聞かない</span>') +
          (m.options.length ? ' <span class="bdg opt">オプション ' + m.options.length + '</span>' : '') +
        '</td>' +
        '<td><span class="plan">' + esc(m.plan) + '</span></td>' +
        '<td class="num">' + M.yen(m.price) + '</td>' +
        '<td class="num">' + m.minutes + '分</td>' +
        '<td><div class="iact">' +
          '<button data-ed="' + m.id + '" aria-label="編集">' +
            '<svg viewBox="0 0 24 24"><path d="M4 20h4L19 9l-4-4L4 16z"/></svg></button>' +
          '<button class="del" data-del="' + m.id + '" aria-label="削除">' +
            '<svg viewBox="0 0 24 24"><path d="M5 7h14M10 7V4.5h4V7M6.5 7l1 13h9l1-13"/></svg></button>' +
        '</div></td>' +
      '</tr>';
    }).join('');

    $('rows').querySelectorAll('[data-ed]').forEach(b =>
      b.addEventListener('click', () => openEdit(b.dataset.ed)));
    $('rows').querySelectorAll('[data-del]').forEach(b =>
      b.addEventListener('click', () => toast('削除（モックでは省略）')));
  }

  /* ==================================================================
     編集モーダル（現行の項目 ＋ オフ / オプション）
     ================================================================== */

  function openEdit(id){
    const src = MENUS.find(m => m.id === id);
    draft = Object.assign({}, src, { options: src.options.slice() });
    renderEdit();
    $('mask').classList.add('show');
  }

  function renderEdit(){
    const d = draft;

    $('eBody').innerHTML =
      /* --- 画像（現行どおり） --- */
      '<label class="fl">画像</label>' +
      '<div class="imgrow">' +
        '<div class="imgbox"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="2"/>' +
          '<circle cx="8.5" cy="10" r="1.6"/><path d="M4 17l5-4.5 4 3.5 3-2.5 4 3.5"/></svg></div>' +
        '<div><button class="btn ghost" style="height:36px" id="imgBtn">画像を投稿</button>' +
          '<div class="imghint">PNG / JPEG / GIF / WebP（最大5MB）。メニュー一覧に小さく表示されます。</div></div>' +
      '</div>' +

      /* --- 基本情報（現行どおり） --- */
      '<label class="fl" for="fName">メニュー名<span class="req">*</span></label>' +
      '<input class="inp" id="fName" type="text" value="' + esc(d.name) + '">' +

      '<label class="fl" for="fCat">カテゴリー</label>' +
      '<select class="inp" id="fCat">' +
        M.CATEGORIES.map(c => '<option' + (c === d.cat ? ' selected' : '') + '>' + esc(c) + '</option>').join('') +
      '</select>' +

      '<div class="two">' +
        '<div><label class="fl" for="fPrice">価格</label>' +
          '<div class="priceRow">' +
            '<input class="inp" id="fPrice" type="number" value="' + d.price + '">' +
            '<select class="inp"><option>日本円</option><option>税込</option></select>' +
          '</div></div>' +
        '<div><label class="fl" for="fMin">施術時間（分）</label>' +
          '<input class="inp" id="fMin" type="number" value="' + d.minutes + '"></div>' +
      '</div>' +

      '<label class="fl" for="fPlan">プラン種別</label>' +
      '<select class="inp" id="fPlan">' +
        M.PLANS.map(p => '<option' + (p === d.plan ? ' selected' : '') + '>' + esc(p) + '</option>').join('') +
      '</select>' +

      /* --- オプション（現行どおりの表示設定） --- */
      '<label class="fl">オプション</label>' +
      '<div class="grp">' +
        '<label class="ck"><input type="checkbox" id="fTilde"' + (d.tildePrice ? ' checked' : '') + '>' +
          '<span class="t">価格を「〜」表示にする</span></label>' +
        '<label class="ck"><input type="checkbox" id="fShow"' + (d.showForm ? ' checked' : '') + '>' +
          '<span class="t">予約作成・公開予約フォームに表示する' +
            '<span class="h">オフにすると、予約作成のメニュー選択と公開予約フォームの両方から外れます（メニュー管理には残ります）。</span>' +
          '</span></label>' +
      '</div>' +

      /* --- ここから追加：オフの確認 --- */
      '<label class="fl">オフの確認<span class="new" style="margin-left:6px;font-size:9.5px;font-weight:700;color:#fff;background:var(--gold);border-radius:4px;padding:1px 5px">追加</span></label>' +
      '<div class="grp acc">' +
        '<label class="ck"><input type="checkbox" id="fOffAsk"' + (d.offSet ? ' checked' : '') + '>' +
          '<span class="t">予約時にオフの選択を必須にする' +
            '<span class="h">ネイル・まつげエクステは、付いているものを外すかどうかで<b>所要時間と料金が変わります</b>。' +
            'ONにすると、お客様が日時を選ぶ前にオフを選ぶ画面が出ます（選ばないと次に進めません）。</span>' +
          '</span></label>' +
        '<div class="offbody' + (d.offSet ? ' show' : '') + '" id="offBody">' +
          '<div style="font-size:11.5px;color:var(--mut);margin-bottom:7px">使うオフの選択肢</div>' +
          '<div class="seg2" id="offSeg">' +
            Object.keys(M.OFF_SETS).map(k =>
              '<button data-os="' + k + '" class="' + (d.offSet === k ? 'on' : '') + '">' +
              esc(M.OFF_SETS[k].genre) + '（' + esc(M.OFF_SETS[k].name) + '）</button>').join('') +
          '</div>' +
          '<div id="offPrev"></div>' +
        '</div>' +
      '</div>' +

      /* --- ここから追加：提案できるオプション --- */
      '<label class="fl">提案できるオプション<span class="new" style="margin-left:6px;font-size:9.5px;font-weight:700;color:#fff;background:var(--gold);border-radius:4px;padding:1px 5px">追加</span></label>' +
      '<div class="grp">' +
        '<div style="font-size:11.5px;color:var(--mut);line-height:1.7">' +
          'このメニューに付けられるオプションを選んでおきます。<br>' +
          '<b>実際に予約時へ出すかどうかは、強制リンクごとの設定で決めます</b>' +
          '（テンプレート設定 &gt; 強制リンク）。ここは「何が付けられるか」だけです。</div>' +
        '<div class="optlist" id="optList"></div>' +
      '</div>';

    $('fOffAsk').addEventListener('change', e => {
      draft.offSet = e.target.checked ? (draft.offSet || 'off_nail') : null;
      $('offBody').classList.toggle('show', !!draft.offSet);
      syncSeg(); renderPrev();
    });
    $('offSeg').querySelectorAll('[data-os]').forEach(b =>
      b.addEventListener('click', () => { draft.offSet = b.dataset.os; syncSeg(); renderPrev(); }));
    $('imgBtn').addEventListener('click', () => toast('画像の投稿（モックでは省略）'));

    ['fName','fCat','fPrice','fMin','fPlan'].forEach(k => {
      $(k).addEventListener('input', () => {
        draft.name = $('fName').value;
        draft.cat  = $('fCat').value;
        draft.price = Number($('fPrice').value) || 0;
        draft.minutes = Number($('fMin').value) || 0;
        draft.plan = $('fPlan').value;
        renderPrev();
      });
    });
    $('fTilde').addEventListener('change', e => { draft.tildePrice = e.target.checked; });
    $('fShow').addEventListener('change', e => { draft.showForm = e.target.checked; });

    syncSeg(); renderPrev(); renderOptList();
  }

  function syncSeg(){
    const seg = $('offSeg');
    if (seg) seg.querySelectorAll('[data-os]').forEach(b =>
      b.classList.toggle('on', b.dataset.os === draft.offSet));
  }

  /** 設定の結果を、お客様に出る形でそのまま見せる */
  function renderPrev(){
    const el = $('offPrev');
    if (!el) return;
    if (!draft.offSet){ el.innerHTML = ''; return; }
    const set = M.OFF_SETS[draft.offSet];

    el.innerHTML =
      '<div class="prev">' +
        '<div class="pt">予約フォームでの見え方</div>' +
        '<div class="q">' + esc(set.question) + '</div>' +
        set.choices.map(c =>
          '<div class="ch"><span class="r"></span><span class="nm">' + esc(c.name) + '</span>' +
          '<span class="pz">' + (c.isNoOff ? '—' :
            (c.price ? '+' + M.yen(c.price) : '¥0') + ' / +' + c.minutes + '分') + '</span></div>').join('') +
        '<div class="note">選んだぶんが所要時間と料金に加算されます。' +
          '例）' + esc(draft.name.slice(0, 18)) + (draft.name.length > 18 ? '…' : '') +
          ' ' + draft.minutes + '分 ' + M.yen(draft.price) +
          ' ＋ ' + esc(set.choices[set.choices.length - 1].name) + ' → ' +
          '<b>' + (draft.minutes + set.choices[set.choices.length - 1].minutes) + '分 ' +
          M.yen(draft.price + set.choices[set.choices.length - 1].price) + '</b><br>' +
          '選択肢そのものは「オフ・オプション」タブで編集します（店舗共通）。</div>' +
      '</div>';
  }

  function renderOptList(){
    const el = $('optList');
    el.innerHTML = M.OPTIONS.map(o =>
      '<label class="optrow"><input type="checkbox" data-op="' + o.id + '"' +
        (draft.options.indexOf(o.id) >= 0 ? ' checked' : '') + '>' +
      '<span class="gn">' + esc(o.genre) + '</span>' +
      '<span class="nm">' + esc(o.name) + '</span>' +
      '<span class="pz">+' + M.yen(o.price) + (o.minutes ? ' / +' + o.minutes + '分' : '') + '</span></label>').join('');

    el.querySelectorAll('[data-op]').forEach(i =>
      i.addEventListener('change', e => {
        const id = e.target.dataset.op;
        if (e.target.checked){ if (draft.options.indexOf(id) < 0) draft.options.push(id); }
        else draft.options = draft.options.filter(x => x !== id);
      }));
  }

  function saveEdit(){
    const i = MENUS.findIndex(m => m.id === draft.id);
    MENUS[i] = draft;
    $('mask').classList.remove('show');
    renderRows();
    toast(draft.offSet
      ? '更新しました。予約時に「' + M.OFF_SETS[draft.offSet].question + '」が出ます'
      : '更新しました');
  }

  /* ==================================================================
     オフ・オプション タブ
     ================================================================== */

  function renderOffTab(){
    const usedBy = setId => MENUS.filter(m => m.offSet === setId);

    const sets = Object.keys(M.OFF_SETS).map(k => {
      const s = M.OFF_SETS[k];
      const used = usedBy(k);
      return '<div class="card setcard">' +
        '<div class="sh"><h2 style="margin:0;font-size:15px">' + esc(s.name) + '</h2>' +
          '<span class="gn">' + esc(s.genre) + '</span>' +
          '<span style="margin-left:auto"><button class="btn ghost" style="height:32px;font-size:12.5px" data-editset="' + k + '">選択肢を編集</button></span>' +
        '</div>' +
        '<div class="sq">予約フォームでの質問：「' + esc(s.question) + '」</div>' +
        '<table class="ct"><thead><tr>' +
          '<th>選択肢</th><th>補足</th><th style="text-align:right">料金</th>' +
          '<th style="text-align:right">所要時間</th></tr></thead><tbody>' +
          s.choices.map(c => '<tr class="' + (c.isNoOff ? 'nooff' : '') + '">' +
            '<td><b>' + esc(c.name) + '</b>' + (c.isNoOff ? '　<span class="bdg hide">加算なし</span>' : '') + '</td>' +
            '<td style="color:var(--mut)">' + esc(c.note || '—') + '</td>' +
            '<td class="num">' + (c.isNoOff ? '—' : (c.price ? '+' + M.yen(c.price) : '¥0')) + '</td>' +
            '<td class="num">' + (c.isNoOff ? '—' : '+' + c.minutes + '分') + '</td>' +
          '</tr>').join('') +
        '</tbody></table>' +
        '<div class="usedby">このセットを使っているメニュー：<b>' + used.length + '件</b>' +
          (used.length ? '　' + used.slice(0, 3).map(m => esc(m.name.slice(0, 20)) + (m.name.length > 20 ? '…' : '')).join(' / ') +
            (used.length > 3 ? ' ほか' + (used.length - 3) + '件' : '') : '') +
        '</div>' +
      '</div>';
    }).join('');

    $('body').innerHTML =
      '<div class="tip"><span class="i">!</span>' +
        '<div class="b"><b>オフは必須、オプションは任意</b>です。' +
          'オフを選ばないと所要時間も料金も確定しないため、予約フォームでは必ず選んでもらいます。' +
          'オプションは付けなくても予約が成立するので、提案するだけにしています。<br>' +
          'どちらも<b>日時を選ぶ前</b>に聞きます。あとから聞くと、所要時間が変わって枠を取り直すことになるためです。</div>' +
      '</div>' +

      '<h2 style="font-size:14px;letter-spacing:.04em;color:var(--teal);margin:0 0 10px">オフの選択肢</h2>' +
      sets +

      '<h2 style="font-size:14px;letter-spacing:.04em;color:var(--teal);margin:22px 0 10px">追加オプション</h2>' +
      '<div class="card">' +
        '<table class="ct"><thead><tr>' +
          '<th>ジャンル</th><th>オプション名</th><th>補足</th>' +
          '<th style="text-align:right">料金</th><th style="text-align:right">所要時間</th>' +
          '<th style="text-align:right">使用メニュー</th></tr></thead><tbody>' +
          M.OPTIONS.map(o => '<tr>' +
            '<td><span class="bdg">' + esc(o.genre) + '</span></td>' +
            '<td><b>' + esc(o.name) + '</b></td>' +
            '<td style="color:var(--mut)">' + esc(o.note || '—') + '</td>' +
            '<td class="num">+' + M.yen(o.price) + '</td>' +
            '<td class="num">' + (o.minutes ? '+' + o.minutes + '分' : '—') + '</td>' +
            '<td class="num">' + MENUS.filter(m => m.options.indexOf(o.id) >= 0).length + '件</td>' +
          '</tr>').join('') +
        '</tbody></table>' +
        '<div class="usedby" style="margin-top:12px">' +
          '「使用メニュー」は、そのオプションを付けられるメニューの数です。' +
          '実際に予約時へ出すかどうかは、<b>テンプレート設定 &gt; 強制リンク</b>で強制リンクごとに決めます。</div>' +
      '</div>';

    $('body').querySelectorAll('[data-editset]').forEach(b =>
      b.addEventListener('click', () => toast('選択肢の編集（モックでは省略）')));
  }

  function renderCatTab(){
    $('body').innerHTML =
      '<div class="card"><h2>カテゴリー<span class="cnt">' + M.CATEGORIES.length + '件</span></h2>' +
        '<table class="ct"><thead><tr><th>カテゴリー名</th><th style="text-align:right">メニュー数</th></tr></thead><tbody>' +
        M.CATEGORIES.map(c => '<tr><td><span class="bdg ' + (CAT_CLS[c] || '') + '">' + esc(c) + '</span></td>' +
          '<td class="num">' + MENUS.filter(m => m.cat === c).length + '件</td></tr>').join('') +
        '</tbody></table>' +
        '<div class="usedby" style="margin-top:12px">現行どおりの画面です。このモックでは変更していません。</div>' +
      '</div>';
  }

  /* ==================================================================
     初期化
     ================================================================== */

  function boot(){
    render();
    $('eClose').addEventListener('click', () => $('mask').classList.remove('show'));
    $('eSave').addEventListener('click', saveEdit);
    $('mask').addEventListener('click', e => { if (e.target === $('mask')) $('mask').classList.remove('show'); });
    document.addEventListener('keydown', e => {
      if (e.key === 'Escape') $('mask').classList.remove('show');
    });

    MockBar.init({ role, onRole: r => { role = r; render(); }, toggles: [] });
  }

  boot();
})();
