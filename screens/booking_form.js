/* ============================================================================
   公開予約フォーム（強制リンク） ページスクリプト
   ----------------------------------------------------------------------------
   仕様と設計意図は booking_form.html 冒頭のコメントに書いてある。

   状態:
     st.menuId     選んだメニュー
     st.offId      選んだオフ。メニューがオフを聞く設定なら必須
     st.optIds     選んだオプション（任意）
     st.slot       選んだ日時 { dayIndex, minutes }
     prevMinutes   直前の所要時間。枠が減ったことを知らせるために持つ
   ========================================================================== */
'use strict';

(function () {

  const M = window.MenuData;

  const LINKS = M.forceLinks();
  const MENUS = M.menus();

  const qs = new URLSearchParams(location.search);
  let fl = LINKS.find(f => f.id === qs.get('fl')) || LINKS[0];

  let step = 1;
  let st = { menuId:null, offId:null, optIds:[], slot:null, name:'', tel:'', memo:'' };
  let prevMinutes = null;
  let lostCount = 0;
  let tried = false;          // 「次へ」を押したか。押すまでエラーは出さない

  const $ = id => document.getElementById(id);
  const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

  let tt;
  function toast(m){
    const t = $('toast');
    t.textContent = m; t.classList.add('show');
    clearTimeout(tt); tt = setTimeout(() => t.classList.remove('show'), 2600);
  }

  /* ---- 導出 ---- */

  const menu     = () => MENUS.find(m => m.id === st.menuId) || null;
  const offSet   = () => { const m = menu(); return m && m.offSet ? M.OFF_SETS[m.offSet] : null; };
  const offChoice= () => { const s = offSet(); return s ? s.choices.find(c => c.id === st.offId) : null; };
  const needsOff = () => !!offSet();
  const offDone  = () => !needsOff() || !!offChoice();

  /** このフォームで提案するオプション（メニュー側の候補 ∩ フォーム側の選択） */
  function shownOptions(){
    if (!fl.recommendOptions) return [];
    const m = menu();
    if (!m) return [];
    let ids = m.options.slice();
    if (fl.recommendOptionIds.length) ids = ids.filter(i => fl.recommendOptionIds.indexOf(i) >= 0);
    return ids.map(M.optionOf).filter(Boolean).sort((a, b) => b.price - a.price);
  }

  const totals = () => menu() ? M.total(menu(), offChoice(), st.optIds) : { minutes:0, price:0 };

  /** 空き枠を数える。所要時間が延びると減る */
  function countFree(duration){
    let n = 0;
    M.DAYS.forEach(d => M.SLOT_TIMES.forEach(t => { if (M.fits(d, t, duration)) n++; }));
    return n;
  }

  /* ==================================================================
     描画
     ================================================================== */

  function render(){
    if (step === 1) renderInput();
    else if (step === 2) renderConfirm();
    else renderDone();
    window.scrollTo(0, 0);
  }

  function headHtml(activeStep){
    const stp = (n, label) =>
      '<div class="st' + (activeStep >= n ? ' on' : '') + '"><div class="c">' + n + '</div>' +
      '<div class="l">' + label + '</div></div>';
    return '<div class="brand">' +
        '<div class="b">si\'se</div>' +
        '<div class="s">' + esc(fl.shop) + '</div>' +
        '<h1>' + esc(fl.name) + '</h1>' +
      '</div>' +
      '<div class="sheet">' +
      '<div class="steps">' + stp(1, '入力') + '<span class="bar"></span>' +
        stp(2, '確認') + '<span class="bar"></span>' + stp(3, '完了') + '</div>';
  }

  /* ---- STEP1 入力 ---- */

  function renderInput(){
    const m = menu(), set = offSet(), opts = shownOptions();
    const t = totals();

    let h = headHtml(1);

    /* --- メニュー --- */
    h += '<div class="sec"><div class="h">ご希望メニュー<span class="req">必須</span></div>' +
      fl.menuIds.map(id => {
        const mm = MENUS.find(x => x.id === id);
        if (!mm) return '';
        const set2 = mm.offSet ? M.OFF_SETS[mm.offSet] : null;
        return '<button class="opt' + (st.menuId === id ? ' on' : '') + '" data-menu="' + id + '">' +
          '<span class="r"></span>' +
          '<span class="tx"><span class="nm">' + esc(mm.name) + '</span>' +
            '<span class="de">' + mm.minutes + '分' +
              (set2 ? '　/　' + esc(set2.genre) + 'オフの選択あり' : '') + '</span></span>' +
          '<span class="pz">' + M.yen(mm.price) + '</span></button>';
      }).join('') + '</div>';

    /* --- オフ（必須） --- */
    if (!m){
      h += '<div class="sec"><div class="h">オフの選択</div>' +
        '<div class="locked"><div class="ic">' + lockSvg() + '</div>' +
        'メニューを選ぶと表示されます</div></div>';
    } else if (set){
      h += '<div class="sec"><div class="h">' + esc(set.question) + '<span class="req">必須</span></div>' +
        '<div class="note">いま付いているものを外すかどうかで、<b>所要時間と料金が変わります</b>。' +
        '当てはまるものを選んでください。</div>' +
        set.choices.map(c =>
          '<button class="opt' + (st.offId === c.id ? ' on' : '') + '" data-off="' + c.id + '">' +
            '<span class="r"></span>' +
            '<span class="tx"><span class="nm">' + esc(c.name) + '</span>' +
              (c.note ? '<span class="de">' + esc(c.note) + '</span>' : '') + '</span>' +
            '<span class="pz' + (!c.isNoOff && !c.price ? ' free' : '') + '">' +
              (c.isNoOff ? '—' : (c.price ? '+' + M.yen(c.price) : '¥0')) +
              (c.isNoOff ? '' : '<span class="m">+' + c.minutes + '分</span>') +
            '</span></button>').join('') +
      '</div>';
    }

    /* --- オプション（任意） --- */
    if (m && fl.recommendOptions && opts.length){
      h += '<div class="sec"><div class="h">オプションの追加' +
        (fl.recommendRequired ? '<span class="req">必須</span>' : '<span class="any">任意</span>') + '</div>' +
        '<div class="note">' + (fl.recommendRequired
          ? 'どれか1つお選びください。'
          : '必要な方だけお選びください。選ばなくても予約できます。') + '</div>' +
        opts.map(o =>
          '<button class="opt' + (st.optIds.indexOf(o.id) >= 0 ? ' on' : '') + '" data-opt="' + o.id + '">' +
            '<span class="r sq"></span>' +
            '<span class="tx"><span class="nm">' + esc(o.name) + '</span>' +
              (o.note ? '<span class="de">' + esc(o.note) + '</span>' : '') + '</span>' +
            '<span class="pz">+' + M.yen(o.price) +
              (o.minutes ? '<span class="m">+' + o.minutes + '分</span>' : '') + '</span></button>').join('') +
      '</div>';
    }

    /* --- 合計 --- */
    if (m){
      const oc = offChoice();
      h += '<div class="total">' +
        '<div class="ln"><span>' + esc(m.name.length > 28 ? m.name.slice(0, 28) + '…' : m.name) + '</span>' +
          '<span class="v">' + M.yen(m.price) + ' / ' + m.minutes + '分</span></div>' +
        (oc && !oc.isNoOff
          ? '<div class="ln"><span>' + esc(oc.name) + '</span><span class="v">+' + M.yen(oc.price) +
            ' / +' + oc.minutes + '分</span></div>' : '') +
        st.optIds.map(id => {
          const o = M.optionOf(id);
          return o ? '<div class="ln"><span>' + esc(o.name) + '</span><span class="v">+' + M.yen(o.price) +
            (o.minutes ? ' / +' + o.minutes + '分' : '') + '</span></div>' : '';
        }).join('') +
        '<div class="ln sum"><span>合計</span><span class="v">' + M.yen(t.price) + '　' + t.minutes + '分</span></div>' +
        (offDone() ? '' : '<div class="dl" style="margin-top:6px">オフを選ぶと確定します</div>') +
      '</div>';
    }

    /* --- 所要時間が変わった知らせ --- */
    if (m && offDone() && lostCount > 0){
      h += '<div class="changed"><span class="i">!</span><div>' +
        '所要時間が <b>' + t.minutes + '分</b> になったため、' +
        '<b>' + lostCount + '件</b>の枠が入らなくなりました。' +
        '下のカレンダーでは<span style="color:#B4740B">△</span>で表しています。</div></div>';
    }

    /* --- 日時 --- */
    h += '<div class="sec"><div class="h">ご希望日時<span class="req">必須</span></div>';
    if (!m){
      h += '<div class="locked"><div class="ic">' + lockSvg() + '</div>' +
        'メニューを選ぶと表示されます</div>';
    } else if (!offDone()){
      h += '<div class="locked"><div class="ic">' + lockSvg() + '</div>' +
        '<b>オフを選ぶと空き枠を表示します</b><br>' +
        'オフの有無で施術時間が変わるため、先に選んでいただいています</div>';
    } else {
      h += calHtml(t.minutes);
    }
    h += '</div>';

    /* --- お客様情報 --- */
    h += '<div class="sec"><div class="h">お客様情報<span class="req">必須</span></div>' +
      '<div class="fld"><label for="iName">お名前</label>' +
        '<input id="iName" type="text" value="' + esc(st.name) + '" placeholder="山田 花子"></div>' +
      '<div class="fld"><label for="iTel">電話番号</label>' +
        '<input id="iTel" type="tel" value="' + esc(st.tel) + '" placeholder="09012345678"></div>' +
      '<div class="fld"><label for="iMemo">ご要望（任意）</label>' +
        '<textarea id="iMemo" placeholder="ご質問やご要望があればご記入ください">' + esc(st.memo) + '</textarea></div>' +
    '</div>';

    /* --- 送信 --- */
    const err = validate();
    h += '<div class="gobar"><button class="gobtn" id="go">この内容で次へ</button>' +
      (tried && err ? '<div class="goerr">' + esc(err) + '</div>' : '') + '</div></div>';

    $('page').innerHTML = h;
    bindInput();
  }

  const lockSvg = () =>
    '<svg viewBox="0 0 24 24"><rect x="5" y="10.5" width="14" height="10" rx="2"/>' +
    '<path d="M8.5 10.5V7.5a3.5 3.5 0 0 1 7 0v3"/></svg>';

  /** カレンダー。duration が長いほど ○ が減る */
  function calHtml(duration){
    const base = menu() ? menu().minutes : duration;

    const head = '<tr><th></th>' + M.DAYS.map(d =>
      '<th class="' + (d.w === '土' ? 'sat' : d.w === '日' ? 'sun' : '') + '">' +
      esc(d.d) + '<small>(' + esc(d.w) + ')</small></th>').join('') + '</tr>';

    const rows = M.SLOT_TIMES.map(t => {
      const cells = M.DAYS.map((d, di) => {
        if (d.closed) return '<td class="cl"><span class="sl ng">—</span></td>';
        const ok = M.fits(d, t, duration);
        // 基本の所要時間なら入ったのに、オフ・オプションで入らなくなった枠
        const lost = !ok && M.fits(d, t, base);
        const on = st.slot && st.slot.di === di && st.slot.t === t;
        if (ok) return '<td><button class="sl ok' + (on ? ' on' : '') +
          '" data-slot="' + di + '|' + t + '" aria-label="' + esc(d.d + ' ' + M.hm(t)) + '">○</button></td>';
        return '<td><span class="sl ' + (lost ? 'lost' : 'ng') + '" title="' +
          (lost ? '所要時間が延びたため入りません' : '空きなし') + '">' + (lost ? '△' : '×') + '</span></td>';
      }).join('');
      return '<tr><td class="tm">' + M.hm(t) + '</td>' + cells + '</tr>';
    }).join('');

    return '<div class="calnav"><button aria-label="前の週">&#x2039;</button>' +
        '<span class="t">9/21 - 9/27</span>' +
        '<button aria-label="次の週">&#x203A;</button></div>' +
      '<div class="calwrap"><table class="cal"><thead>' + head + '</thead><tbody>' + rows + '</tbody></table></div>' +
      '<div class="callegend">' +
        '<span class="k"><b style="color:#5FA733">○</b> 予約できます</span>' +
        '<span class="k"><b style="color:#D9B267">△</b> 所要時間が延びて入りません</span>' +
        '<span class="k"><b style="color:#C9C9BE">×</b> 空きなし</span>' +
        '<span class="k"><b style="color:#C9C9BE">—</b> 定休日</span><br>' +
        '合計 <b>' + duration + '分</b>ぶんの空きがある枠だけを ○ にしています。</div>';
  }

  function validate(){
    if (!st.menuId) return 'メニューを選んでください';
    if (needsOff() && !st.offId) return 'オフの選択は必須です';
    if (fl.recommendRequired && shownOptions().length && !st.optIds.length) return 'オプションを1つ選んでください';
    if (!st.slot) return '日時を選んでください';
    if (!st.name.trim()) return 'お名前を入力してください';
    if (!st.tel.trim()) return '電話番号を入力してください';
    return null;
  }

  function bindInput(){
    $('page').querySelectorAll('[data-menu]').forEach(b =>
      b.addEventListener('click', () => {
        if (st.menuId === b.dataset.menu) return;
        st.menuId = b.dataset.menu;
        // メニューが変わればオフもオプションも作り直し。枠も選び直してもらう
        st.offId = null; st.optIds = []; st.slot = null;
        prevMinutes = null; lostCount = 0;
        render();
      }));

    $('page').querySelectorAll('[data-off]').forEach(b =>
      b.addEventListener('click', () => { st.offId = b.dataset.off; afterDurationChange(); }));

    $('page').querySelectorAll('[data-opt]').forEach(b =>
      b.addEventListener('click', () => {
        const id = b.dataset.opt;
        const i = st.optIds.indexOf(id);
        if (i >= 0) st.optIds.splice(i, 1); else st.optIds.push(id);
        afterDurationChange();
      }));

    $('page').querySelectorAll('[data-slot]').forEach(b =>
      b.addEventListener('click', () => {
        const [di, t] = b.dataset.slot.split('|').map(Number);
        st.slot = { di, t };
        render();
      }));

    ['iName','iTel','iMemo'].forEach(k => {
      const el = $(k);
      if (!el) return;
      el.addEventListener('input', e => {
        st[k === 'iName' ? 'name' : k === 'iTel' ? 'tel' : 'memo'] = e.target.value;
      });
    });

    $('go').addEventListener('click', () => {
      tried = true;
      const err = validate();
      if (err){ render(); toast(err); return; }
      step = 2; render();
    });
  }

  /**
    所要時間が変わったときの後始末。
    黙って枠を消すと壊れて見えるので、減った件数を持っておいて知らせる。
    選んでいた枠が入らなくなったら外す（選べたことにしない）。
  */
  function afterDurationChange(){
    const t = totals();
    if (offDone()){
      // メニュー単体なら入っていたのに、オフ・オプションで入らなくなった枠の数
      lostCount = Math.max(0, countFree(menu().minutes) - countFree(t.minutes));
      if (st.slot && !M.fits(M.DAYS[st.slot.di], st.slot.t, t.minutes)){
        st.slot = null;
        toast('所要時間が変わったため、選んでいた日時を外しました');
      }
    }
    prevMinutes = t.minutes;
    render();
  }

  /* ---- STEP2 確認 ---- */

  function renderConfirm(){
    const m = menu(), oc = offChoice(), t = totals();
    const d = M.DAYS[st.slot.di];

    const ln = (k, v) => '<div class="ln"><div class="k">' + k + '</div><div class="v">' + v + '</div></div>';

    $('page').innerHTML = headHtml(2) +
      '<div class="sec"><div class="h">ご予約内容の確認</div>' +
        '<div class="conf">' +
          ln('メニュー', esc(m.name) + '<span class="sm">' + m.minutes + '分 / ' + M.yen(m.price) + '</span>') +
          (oc ? ln('オフ', esc(oc.name) +
            '<span class="sm">' + (oc.isNoOff ? '加算なし'
              : (oc.price ? '+' + M.yen(oc.price) : '¥0') + ' / +' + oc.minutes + '分') + '</span>') : '') +
          (st.optIds.length
            ? ln('オプション', st.optIds.map(id => {
                const o = M.optionOf(id);
                return esc(o.name) + '<span class="sm">+' + M.yen(o.price) +
                  (o.minutes ? ' / +' + o.minutes + '分' : '') + '</span>';
              }).join('<br>'))
            : ln('オプション', '<span style="color:var(--mut)">なし</span>')) +
          ln('日時', '2026年 ' + esc(d.d) + '(' + esc(d.w) + ') ' + M.hm(st.slot.t) +
            '<span class="sm">〜 ' + M.hm(st.slot.t + t.minutes) + '（' + t.minutes + '分）</span>') +
          ln('お名前', esc(st.name) + ' 様') +
          ln('電話番号', esc(st.tel)) +
          (st.memo ? ln('ご要望', esc(st.memo)) : '') +
        '</div>' +
      '</div>' +
      '<div class="total">' +
        '<div class="ln"><span>施術時間の合計</span><span class="v">' + t.minutes + '分</span></div>' +
        '<div class="ln sum"><span>お支払い予定</span><span class="v">' + M.yen(t.price) + '</span></div>' +
      '</div>' +
      '<div class="gobar"><button class="gobtn" id="go2">この内容で予約する</button>' +
        '<button class="btn ghost" style="width:100%;height:46px;margin-top:9px" id="back2">入力に戻る</button></div>' +
    '</div>';

    $('go2').addEventListener('click', () => { step = 3; render(); });
    $('back2').addEventListener('click', () => { step = 1; render(); });
  }

  /* ---- STEP3 完了 ---- */

  function renderDone(){
    const t = totals();
    const d = M.DAYS[st.slot.di];
    $('page').innerHTML = headHtml(3) +
      '<div class="done">' +
        '<div class="ic"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></div>' +
        '<h2>ご予約を承りました</h2>' +
        '<p>2026年 ' + esc(d.d) + '(' + esc(d.w) + ') ' + M.hm(st.slot.t) + ' 〜 ' +
          M.hm(st.slot.t + t.minutes) + '<br>' +
          esc(st.name) + ' 様　' + M.yen(t.price) + '（' + t.minutes + '分）<br><br>' +
          '確認のご連絡を ' + esc(st.tel) + ' へお送りします。</p>' +
        '<div style="margin-top:20px"><button class="btn ghost" id="again">最初からやり直す</button></div>' +
      '</div>' +
    '</div>';

    $('again').addEventListener('click', () => {
      step = 1; tried = false; lostCount = 0; prevMinutes = null;
      st = { menuId:null, offId:null, optIds:[], slot:null, name:'', tel:'', memo:'' };
      render();
    });
  }

  /* ==================================================================
     初期化
     ================================================================== */

  function boot(){
    const sel = $('flSel');
    sel.innerHTML = LINKS.map(f =>
      '<option value="' + f.id + '"' + (f.id === fl.id ? ' selected' : '') + '>' +
      esc(f.name) + (f.recommendOptions ? '（オプション提案あり）' : '（提案なし）') +
      '</option>').join('');
    sel.addEventListener('change', e => {
      fl = LINKS.find(f => f.id === e.target.value);
      step = 1; tried = false; lostCount = 0; prevMinutes = null;
      st = { menuId:null, offId:null, optIds:[], slot:null, name:'', tel:'', memo:'' };
      render();
    });
    render();
  }

  boot();
})();
