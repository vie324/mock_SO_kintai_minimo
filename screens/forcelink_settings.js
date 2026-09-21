/* ============================================================================
   強制リンク設定 ページスクリプト
   ----------------------------------------------------------------------------
   仕様と設計意図は forcelink_settings.html 冒頭のコメントに書いてある。

   状態:
     view  'list' | 'edit'
     cur   編集中の強制リンク（そのまま書き換える。モックなので取り消しは持たない）
   ========================================================================== */
'use strict';

(function () {

  const M = window.MenuData;

  let role  = 'system';
  let view  = 'list';
  let LINKS = M.forceLinks();
  let MENUS = M.menus();
  let cur   = null;

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
  const menuOf = id => MENUS.find(m => m.id === id);

  let tt;
  function toast(m){
    const t = $('toast');
    t.textContent = m; t.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2800);
  }

  /** そのフォームで実際に提案されるオプション（メニュー側の候補 ∩ フォーム側の選択） */
  function effectiveOptions(fl){
    const cand = new Set();
    fl.menuIds.forEach(id => {
      const m = menuOf(id);
      if (m) m.options.forEach(o => cand.add(o));
    });
    let ids = Array.from(cand);
    if (fl.recommendOptionIds.length){
      ids = ids.filter(id => fl.recommendOptionIds.indexOf(id) >= 0);
    }
    return ids.map(M.optionOf).filter(Boolean).sort((a, b) => b.price - a.price);
  }

  /* ==================================================================
     一覧
     ================================================================== */

  function render(){
    const page = Shell.render({ active:'forcelink', role });
    page.innerHTML =
      '<div class="pagehead">' +
        '<span class="ic"><svg viewBox="0 0 24 24">' +
        '<path d="M10.5 13.5a4 4 0 0 0 5.7 0l2.8-2.8a4 4 0 1 0-5.7-5.7l-1.3 1.3"/>' +
        '<path d="M13.5 10.5a4 4 0 0 0-5.7 0L5 13.3a4 4 0 1 0 5.7 5.7l1.3-1.3"/></svg></span>' +
        '<h1>強制リンク</h1>' +
      '</div><div id="body"></div>';
    if (view === 'list') renderList(); else renderEdit();
  }

  function renderList(){
    $('body').innerHTML =
      '<p class="lead">メニューを絞った公開予約フォームのURLを発行します。SNS・LINE配信・チラシなどから、' +
        'そのフォームだけに誘導できます。<br>' +
        '<b>オプションの推奨</b>は強制リンクごとに設定します。' +
        'ネイル・アイの<b>オフ</b>は必須項目なので、ここではON/OFFできません' +
        '（メニュー設定の「オフの確認」がそのまま効きます）。</p>' +
      '<div class="flcards">' +
        LINKS.map(fl => {
          const opts = effectiveOptions(fl);
          const nOff = fl.menuIds.filter(id => (menuOf(id) || {}).offSet).length;
          return '<div class="flcard">' +
            '<div class="main">' +
              '<div class="nm">' + esc(fl.name) +
                '<span class="st ' + (fl.status === '公開中' ? 'on' : 'draft') + '">' + esc(fl.status) + '</span>' +
                (fl.recommendOptions
                  ? '<span class="recbadge">オプション提案 ' + opts.length + '件</span>'
                  : '<span class="recbadge off">オプション提案なし</span>') +
              '</div>' +
              '<div class="meta">' + esc(fl.shop) + '　/　' + esc(fl.period) + '<br>' +
                'URL <span class="mono">' + esc(fl.url) + '</span>　' +
                'メニュー ' + fl.menuIds.length + '件（うちオフを聞く ' + nOff + '件）</div>' +
            '</div>' +
            '<div class="kpi">' +
              '<div><div class="k">表示</div><div class="v">' + fl.views.toLocaleString('ja-JP') + '</div></div>' +
              '<div><div class="k">予約</div><div class="v">' + fl.bookings + '</div></div>' +
            '</div>' +
            '<div class="acts">' +
              '<button class="btn ghost" style="height:36px" data-pv="' + fl.id + '">フォームを開く</button>' +
              '<button class="btn solid" style="height:36px" data-ed="' + fl.id + '">編集</button>' +
            '</div>' +
          '</div>';
        }).join('') +
      '</div>';

    $('body').querySelectorAll('[data-ed]').forEach(b =>
      b.addEventListener('click', () => { cur = LINKS.find(f => f.id === b.dataset.ed); view = 'edit'; render(); }));
    $('body').querySelectorAll('[data-pv]').forEach(b =>
      b.addEventListener('click', () => { location.href = 'booking_form.html?fl=' + b.dataset.pv; }));
  }

  /* ==================================================================
     編集
     ================================================================== */

  function renderEdit(){
    const fl = cur;

    $('body').innerHTML =
      '<a class="back" href="#" id="back">' +
        '<svg viewBox="0 0 24 24"><path d="M14 6l-6 6 6 6"/></svg>強制リンクの一覧へ戻る</a>' +
      '<div class="cols">' +
        '<div>' +
          '<div class="card"><h2>基本設定</h2>' +
            '<div class="fldbox"><label class="fl2" for="fName">フォーム名</label>' +
              '<input class="inp" id="fName" type="text" value="' + esc(fl.name) + '"></div>' +
            '<div class="two">' +
              '<div class="fldbox"><label class="fl2" for="fShop">対象店舗</label>' +
                '<select class="inp" id="fShop"><option>' + esc(fl.shop) + '</option></select></div>' +
              '<div class="fldbox"><label class="fl2" for="fPeriod">公開期間</label>' +
                '<input class="inp" id="fPeriod" type="text" value="' + esc(fl.period) + '"></div>' +
            '</div>' +
          '</div>' +

          '<div class="card"><h2>対象メニュー<span class="sub">このフォームから予約できるメニュー</span></h2>' +
            '<div id="menuList"></div>' +
            '<div class="hint">「オフを聞く」はメニュー側の設定です。' +
              'ネイル・アイのメニューで <span class="bdg noff">オフを聞かない</span> になっていると、' +
              '<b>オフのぶんの時間と料金が予約に乗りません</b>。' +
              '<a href="menu_settings.html" style="color:var(--teal-3);font-weight:700">メニュー設定</a>で直せます。</div>' +
          '</div>' +

          '<div class="card"><h2>オプションの推奨' +
            '<span class="sub" style="font-size:9.5px;font-weight:700;color:#fff;background:var(--gold);border-radius:4px;padding:1px 6px">追加</span></h2>' +
            '<div class="grp acc">' +
              '<label class="ck"><input type="checkbox" id="fRec"' + (fl.recommendOptions ? ' checked' : '') + '>' +
                '<span class="t">予約時にオプションを提案する' +
                  '<span class="h">メニューを選んだあと、日時を選ぶ前に追加オプションを提案します。' +
                  '選ばれた<b>ぶんの所要時間と料金が予約に加算</b>されます。</span></span></label>' +
              '<div class="sub-body' + (fl.recommendOptions ? ' show' : '') + '" id="recBody">' +
                '<div style="font-size:11.5px;color:var(--mut);margin-bottom:8px">' +
                  '提案するオプション<br>' +
                  '<span style="font-size:11px">対象メニューに紐づく候補だけが選べます（メニュー設定で決めた候補）。' +
                  'ひとつも選ばなければ、候補すべてを提案します。</span></div>' +
                '<div id="optList"></div>' +
                '<label class="ck" style="margin-top:6px"><input type="checkbox" id="fReq"' +
                  (fl.recommendRequired ? ' checked' : '') + '>' +
                  '<span class="t">提案を必須にする（どれか1つ選ばないと進めない）' +
                    '<span class="h">既定はOFFです。オプションは付けなくても予約が成立するので、' +
                    '必須にすると離脱が増えます。</span></span></label>' +
              '</div>' +
            '</div>' +

            '<div class="hint"><b>オフとオプションは別物です。</b>' +
              '混ぜると「オフを任意にしてしまう」事故が起きるので、表にしておきます。' +
              '<table class="cmp"><thead><tr><th></th><th>決める場所</th><th>予約時</th><th>選ばないと</th></tr></thead><tbody>' +
                '<tr><td><b>オフ</b></td><td>メニュー設定</td><td><b>必須</b></td><td>次に進めない</td></tr>' +
                '<tr><td><b>オプション</b></td><td>この画面</td><td>任意（提案）</td><td>そのまま進める</td></tr>' +
              '</tbody></table></div>' +
          '</div>' +

          '<div class="savebar">' +
            '<span class="sp"></span>' +
            '<button class="btn ghost" id="cancel">キャンセル</button>' +
            '<button class="btn solid" id="save">保存する</button>' +
          '</div>' +
        '</div>' +

        /* ---- プレビュー ---- */
        '<div class="card pvcard"><h2>お客様に出る画面<span class="sub">STEP1</span></h2>' +
          '<div id="preview"></div>' +
          '<div style="margin-top:11px"><button class="btn ghost" style="width:100%" id="openForm">' +
            '実際のフォームを開く</button></div>' +
        '</div>' +
      '</div>';

    $('back').addEventListener('click', e => { e.preventDefault(); view = 'list'; render(); });
    $('cancel').addEventListener('click', () => { view = 'list'; render(); });
    $('save').addEventListener('click', () => {
      fl.name = $('fName').value;
      fl.period = $('fPeriod').value;
      view = 'list'; render();
      toast(fl.recommendOptions
        ? '保存しました。予約時に ' + effectiveOptions(fl).length + '件のオプションを提案します'
        : '保存しました。オプションの提案はしません');
    });
    $('openForm').addEventListener('click', () => { location.href = 'booking_form.html?fl=' + fl.id; });

    $('fRec').addEventListener('change', e => {
      fl.recommendOptions = e.target.checked;
      $('recBody').classList.toggle('show', fl.recommendOptions);
      renderPreview();
    });
    $('fReq').addEventListener('change', e => { fl.recommendRequired = e.target.checked; renderPreview(); });

    renderMenuList(); renderOptList(); renderPreview();
  }

  function renderMenuList(){
    const fl = cur;
    $('menuList').innerHTML = MENUS.filter(m => m.showForm).map(m => {
      const on = fl.menuIds.indexOf(m.id) >= 0;
      const off = m.offSet ? M.OFF_SETS[m.offSet] : null;
      return '<label class="mrow"><input type="checkbox" data-m="' + m.id + '"' + (on ? ' checked' : '') + '>' +
        '<span class="nm">' + esc(m.name) + '</span>' +
        (off ? '<span class="bdg off">' + esc(off.genre) + 'オフを聞く</span>'
             : '<span class="bdg noff">オフを聞かない</span>') +
        (m.options.length ? '<span class="bdg opt">オプション候補 ' + m.options.length + '</span>' : '') +
        '<span class="pz">' + M.yen(m.price) + ' / ' + m.minutes + '分</span></label>';
    }).join('');

    $('menuList').querySelectorAll('[data-m]').forEach(i =>
      i.addEventListener('change', e => {
        const id = e.target.dataset.m;
        if (e.target.checked){ if (fl.menuIds.indexOf(id) < 0) fl.menuIds.push(id); }
        else fl.menuIds = fl.menuIds.filter(x => x !== id);
        renderOptList(); renderPreview();
      }));
  }

  function renderOptList(){
    const fl = cur;
    const el = $('optList');
    if (!el) return;

    // 対象メニューに紐づく候補だけを選べるようにする。
    // ここを全オプションにすると、付けられない組み合わせを選べてしまう
    const cand = new Set();
    fl.menuIds.forEach(id => { const m = menuOf(id); if (m) m.options.forEach(o => cand.add(o)); });

    if (!cand.size){
      el.innerHTML = '<div class="pvnone">対象メニューに紐づくオプションがありません。' +
        'メニュー設定の「提案できるオプション」で候補を選んでください。</div>';
      return;
    }

    el.innerHTML = M.OPTIONS.map(o => {
      const usable = cand.has(o.id);
      const on = fl.recommendOptionIds.indexOf(o.id) >= 0;
      return '<label class="optrow' + (usable ? '' : ' dim') + '">' +
        '<input type="checkbox" data-o="' + o.id + '"' + (on ? ' checked' : '') + (usable ? '' : ' disabled') + '>' +
        '<span class="bdg">' + esc(o.genre) + '</span>' +
        '<span class="nm">' + esc(o.name) + '</span>' +
        '<span class="pz">' + (usable ? '+' + M.yen(o.price) + (o.minutes ? ' / +' + o.minutes + '分' : '')
                                      : '対象メニューになし') + '</span></label>';
    }).join('');

    el.querySelectorAll('[data-o]').forEach(i =>
      i.addEventListener('change', e => {
        const id = e.target.dataset.o;
        if (e.target.checked){ if (fl.recommendOptionIds.indexOf(id) < 0) fl.recommendOptionIds.push(id); }
        else fl.recommendOptionIds = fl.recommendOptionIds.filter(x => x !== id);
        renderPreview();
      }));
  }

  /** 設定がそのまま反映されるプレビュー。STEP1 の一番下だけを出す */
  function renderPreview(){
    const fl = cur;
    const el = $('preview');
    if (!el) return;

    const offMenus = fl.menuIds.map(menuOf).filter(m => m && m.offSet);
    const sets = {};
    offMenus.forEach(m => { sets[m.offSet] = M.OFF_SETS[m.offSet]; });
    const opts = effectiveOptions(fl);

    const offHtml = Object.keys(sets).length
      ? Object.keys(sets).map(k => {
          const s = sets[k];
          return '<div class="pvsec"><div class="t">' + esc(s.question) + '<span class="req">必須</span></div>' +
            s.choices.map(c => '<div class="pvopt"><span class="r"></span><span class="nm">' + esc(c.name) + '</span>' +
              '<span class="pz">' + (c.isNoOff ? '—' :
                (c.price ? '+' + M.yen(c.price) : '¥0') + ' / +' + c.minutes + '分') + '</span></div>').join('') +
          '</div>';
        }).join('')
      : '<div class="pvsec"><div class="t">オフの確認</div>' +
        '<div class="pvnone">対象メニューにオフを聞く設定がありません</div></div>';

    const optHtml = fl.recommendOptions
      ? (opts.length
          ? '<div class="pvsec"><div class="t">オプションの追加' +
              (fl.recommendRequired ? '<span class="req">必須</span>' : '<span class="opt">任意</span>') + '</div>' +
            opts.map(o => '<div class="pvopt"><span class="r sq"></span><span class="nm">' + esc(o.name) + '</span>' +
              '<span class="pz">+' + M.yen(o.price) + (o.minutes ? ' / +' + o.minutes + '分' : '') + '</span></div>').join('') +
            '</div>'
          : '<div class="pvsec"><div class="t">オプションの追加<span class="opt">任意</span></div>' +
            '<div class="pvnone">提案できるオプションがありません</div></div>')
      : '';

    el.innerHTML =
      '<div class="phone">' +
        '<div class="ph-h"><div class="b">' + esc(fl.name) + '</div>' +
          '<div class="s">' + esc(fl.shop) + '</div></div>' +
        '<div class="ph-b">' +
          '<div class="stepbar"><span class="d on">1</span><span class="l"></span>' +
            '<span class="d">2</span><span class="l"></span><span class="d">3</span></div>' +
          '<div class="pvsec"><div class="t">ご希望メニュー<span class="req">必須</span></div>' +
            (fl.menuIds.length
              ? fl.menuIds.map(menuOf).filter(Boolean).map(m =>
                  '<div class="pvopt"><span class="r"></span><span class="nm">' +
                  esc(m.name.length > 26 ? m.name.slice(0, 26) + '…' : m.name) + '</span>' +
                  '<span class="pz">' + M.yen(m.price) + '</span></div>').join('')
              : '<div class="pvnone">メニューが選ばれていません</div>') +
          '</div>' +
          offHtml + optHtml +
          '<div class="pvsec"><div class="t">ご希望日時<span class="req">必須</span></div>' +
            '<div class="pvnone">オフ・オプションで所要時間が決まってから<br>空き枠を出します</div></div>' +
        '</div>' +
      '</div>' +
      '<div class="pvfoot">オフとオプションは<b>日時より前</b>に聞きます。<br>' +
        '所要時間が決まらないと空き枠を計算できないためです。</div>';
  }

  /* ==================================================================
     初期化
     ================================================================== */

  function boot(){
    render();
    MockBar.init({ role, onRole: r => { role = r; render(); }, toggles: [] });
  }

  boot();
})();
