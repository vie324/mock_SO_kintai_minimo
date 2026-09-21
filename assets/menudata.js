/* ============================================================================
   メニュー / オフ / オプション / 強制リンク のダミーデータ
   →  移植時は API レスポンスに置き換わる
   ----------------------------------------------------------------------------
   ■ 「オフ」とは
     ネイルとまつげエクステには、付いているものを外す（オフする）工程がある。
     外すか外さないか、どこで付けたものかで、所要時間と料金が変わる。
     だから予約の時点で必ず決まっていないと、枠の長さも会計も確定しない。

     ホットペッパーでは、メニューを作るときに「オフを聞く／聞かない」を選び、
     聞く設定のメニューを客が選ぶと、日時を選ぶ前にオフの選択画面が出る。
     SalonOne の公開予約フォーム（強制リンク）にも同じ考え方を入れる。

   ■ なぜ「日時の前」なのか ★ここが実装上いちばん効く
     オフもオプションも所要時間を足す。
     所要時間が決まらないと空き枠を計算できないので、
       メニュー → オフ（必須） → オプション（任意） → 日時
     の順にする。日時のあとに置くと、選び直すたびに枠を取り直すことになる。

   ■ 現状の運用（画像のメニュー一覧より）
     「【NEW OPEN記念】ワンカラー（ご新規様/自店オフ無料）」のように、
     オフの条件をメニュー名に書き込んで運用している。
     これだと
       ・他店オフの人が自店オフ無料のメニューを取ってしまう
       ・オフのぶんの時間が枠に入らず、後ろの予約が押す
       ・会計時に手で足す
     が起きる。オフを構造で持てば、名前に書く必要がなくなる。

   ■ データモデル案
     off_sets            id, shop_id, genre(nail|eye), name, question
     off_choices         id, off_set_id, name, price, minutes, sort, is_no_off
     options             id, shop_id, genre, name, price, minutes
     menus               ... , off_set_id NULL, option_ids[]
                           off_set_id NULL  → オフを聞かない
     force_links         ... , recommend_options BOOL, recommend_option_ids[]
     reservations        ... , off_choice_id, option_ids[]
   ========================================================================== */
'use strict';

window.MenuData = (function () {

  /* ------------------------------------------------------------------
     オフの選択肢（店舗ごとのマスタ）
     ------------------------------------------------------------------ */

  /**
    genre ごとに1セット持つ。
      isNoOff  「オフしない」の行。料金・時間を持たない
      price / minutes  選ぶと予約の合計に足される
    アイのセットは画像4（HPBの実画面）と同じ内容にしてある。
  */
  const OFF_SETS = {
    off_nail: {
      id:'off_nail', genre:'ネイル', name:'ネイルオフ',
      question:'ネイルオフの選択をしてください',
      choices: [
        { id:'n0', name:'オフしない',            price:null, minutes:null, isNoOff:true,
          note:'地爪の方・オフ不要の方' },
        { id:'n1', name:'自店オフ',              price:0,    minutes:15,
          note:'当店で付けたものをオフ' },
        { id:'n2', name:'他店オフ（ジェル）',     price:1100, minutes:20, note:'' },
        { id:'n3', name:'他店オフ（スカルプ）',   price:2200, minutes:30, note:'' },
      ],
    },
    off_eye: {
      id:'off_eye', genre:'アイ', name:'まつげエクステオフ',
      question:'まつげエクステオフの選択をしてください',
      choices: [
        { id:'e0', name:'オフしない',                     price:null, minutes:null, isNoOff:true, note:'' },
        { id:'e1', name:'エクステ付替えオフ',              price:0,    minutes:10, note:'' },
        { id:'e2', name:'LEDから通常エクステ付け替えオフ', price:1100, minutes:10, note:'' },
      ],
    },
  };

  /* ------------------------------------------------------------------
     追加オプション（店舗ごとのマスタ）
     ------------------------------------------------------------------ */

  const OPTIONS = [
    { id:'op1', genre:'ネイル', name:'ケア（甘皮処理）',   price:1100, minutes:15,
      note:'仕上がりと持ちが変わります' },
    { id:'op2', genre:'ネイル', name:'長さ出し（1本）',    price:550,  minutes:10, note:'' },
    { id:'op3', genre:'ネイル', name:'アート（1本）',      price:330,  minutes:5,  note:'' },
    { id:'op4', genre:'ネイル', name:'パラジェルに変更',   price:1100, minutes:0,
      note:'爪を削らない施術です' },
    { id:'op5', genre:'アイ',   name:'まつげ美容液',       price:2200, minutes:0,  note:'' },
    { id:'op6', genre:'アイ',   name:'下まつげエクステ',   price:2750, minutes:20, note:'' },
  ];
  const optionOf = id => OPTIONS.find(o => o.id === id) || null;

  /* ------------------------------------------------------------------
     メニュー（画像のメニュー一覧より）
     ------------------------------------------------------------------ */

  const CATEGORIES = ['HPB連携', 'minimo連携', '店頭メニュー'];
  const PLANS = ['通常', '定額', 'サブスク'];

  /**
    offSet   null なら「オフを聞かない」。文字列なら OFF_SETS のキー
    options  このメニューで提案できるオプション。実際に出すかは強制リンク側で決める
    showForm 予約作成・公開予約フォームに出すか（現行のチェックボックス）
    tildePrice 価格を「〜」表示にするか（現行のチェックボックス）

    先頭6件は現行どおり、オフの条件がメニュー名に書き込まれている。
    オフ設定を入れたあとは名前から外せる（menu_settings.html の注記を参照）。
  */
  function menus() {
    return [
      { id:'mn1', rank:1, name:'【NEW OPEN記念】ワンカラー（ご新規様/自店オフ無料）¥6500→¥4800',
        cat:'HPB連携', plan:'通常', price:4800, minutes:60,
        offSet:'off_nail', options:['op1','op2','op3','op4'], showForm:true, tildePrice:false },

      { id:'mn2', rank:2, name:'【NEW OPEN記念】マグネット（ご新規様/自店オフ無料）¥7500→¥5800',
        cat:'HPB連携', plan:'通常', price:5800, minutes:60,
        offSet:'off_nail', options:['op1','op3','op4'], showForm:true, tildePrice:false },

      { id:'mn3', rank:3, name:'【NEW OPEN記念】持ち込みアート 90分・アート4本（ご新規様/自店オフ無料）¥6,800',
        cat:'HPB連携', plan:'通常', price:6800, minutes:90,
        offSet:'off_nail', options:['op1','op2'], showForm:true, tildePrice:false },

      { id:'mn4', rank:4, name:'【NEW OPEN記念】ハンドつけ放題150分・アート10本（ご新規様/自店オフ無料）¥9,000',
        cat:'HPB連携', plan:'通常', price:9000, minutes:150,
        offSet:'off_nail', options:['op1','op4'], showForm:true, tildePrice:false },

      { id:'mn5', rank:5, name:'【NEW OPEN記念】人気SET★ハンドワンカラー&フットワンカラー ¥11,500',
        cat:'HPB連携', plan:'通常', price:11500, minutes:150,
        offSet:'off_nail', options:['op1'], showForm:true, tildePrice:false },

      { id:'mn6', rank:6, name:'【NEW OPEN記念】ハンド定額120分・アート 4〜6本（ご新規様／自店オフ無料）¥7,000',
        cat:'HPB連携', plan:'定額', price:7000, minutes:120,
        offSet:'off_nail', options:['op1','op3'], showForm:true, tildePrice:false },

      { id:'mn7', rank:7, name:'【ご新規様/自店オフ無料★】ワンカラー',
        cat:'HPB連携', plan:'通常', price:5800, minutes:60,
        offSet:'off_nail', options:['op1','op2','op3'], showForm:true, tildePrice:false },

      /* --- アイのメニュー。オフの聞き方がネイルと違う --- */
      { id:'mn8', rank:8, name:'LEDフラットラッシュ100本［オフ込］',
        cat:'HPB連携', plan:'通常', price:5990, minutes:50,
        offSet:'off_eye', options:['op5','op6'], showForm:true, tildePrice:false },

      { id:'mn9', rank:9, name:'パリジェンヌラッシュリフト',
        cat:'HPB連携', plan:'通常', price:6600, minutes:60,
        offSet:'off_eye', options:['op5'], showForm:true, tildePrice:false },

      /* --- オフの概念がないメニュー。offSet は null --- */
      { id:'mn10', rank:10, name:'フットワンカラー',
        cat:'minimo連携', plan:'通常', price:6500, minutes:75,
        offSet:null, options:['op1'], showForm:true, tildePrice:false },

      { id:'mn11', rank:11, name:'ハンドケア（甘皮処理のみ）',
        cat:'店頭メニュー', plan:'通常', price:3300, minutes:30,
        offSet:null, options:[], showForm:false, tildePrice:false },

      { id:'mn12', rank:12, name:'小顔矯正＋ヘッドスパ',
        cat:'店頭メニュー', plan:'通常', price:2200, minutes:45,
        offSet:null, options:[], showForm:true, tildePrice:true },
    ];
  }

  /* ------------------------------------------------------------------
     強制リンク（公開予約フォーム）
     ------------------------------------------------------------------ */

  /**
    recommendOptions   予約時にオプションを提案するか（ご指示のチェック）
    recommendOptionIds 提案する対象。空なら「メニューに紐づく全部」
    recommendRequired  提案を必須にするか。既定は false（任意）
                       オフは必須、オプションは任意、と性質が違う
  */
  function forceLinks() {
    return [
      { id:'fl1', name:'期間限定／特別予約フォーム',
        shop:"si'se 本厚木店", status:'公開中',
        url:'https://s1.link/f/8kQ2m',
        period:'2026/9/1 〜 2026/9/30',
        menuIds:['mn1','mn2','mn8'],
        recommendOptions:true, recommendOptionIds:['op1','op2','op4','op5'],
        recommendRequired:false,
        views:1284, bookings:63 },

      { id:'fl2', name:'ご新規様限定フォーム',
        shop:"si'se 本厚木店", status:'公開中',
        url:'https://s1.link/f/3xR7p',
        period:'期限なし',
        menuIds:['mn7','mn9'],
        recommendOptions:false, recommendOptionIds:[],
        recommendRequired:false,
        views:642, bookings:28 },

      { id:'fl3', name:'LINE配信用（10月）',
        shop:"si'se 本厚木店", status:'下書き',
        url:'—',
        period:'2026/10/1 〜 2026/10/31',
        menuIds:['mn3','mn4'],
        recommendOptions:true, recommendOptionIds:[],
        recommendRequired:false,
        views:0, bookings:0 },
    ];
  }

  /* ------------------------------------------------------------------
     空き枠（予約フォームのカレンダー用）
     ------------------------------------------------------------------ */

  /**
    その日の受付可能な帯（0:00からの分）。
    所要時間が伸びると入らなくなる枠が出る、というのを見せるためのデータ。
    9/21 は定休、9/23 と 9/26 は満席にしてある（画像5と同じ並び）。
  */
  const DAYS = [
    { d:'9/21', w:'月', closed:true,  free:[] },
    { d:'9/22', w:'火', closed:false, free:[[600, 660], [900, 1020]] },
    { d:'9/23', w:'水', closed:false, free:[] },
    { d:'9/24', w:'木', closed:false, free:[[600, 780], [840, 1140]] },
    { d:'9/25', w:'金', closed:false, free:[[600, 750], [810, 1140]] },
    { d:'9/26', w:'土', closed:false, free:[] },
    { d:'9/27', w:'日', closed:false, free:[[600, 1140]] },
  ];
  const SLOT_TIMES = (() => {
    const out = [];
    for (let m = 600; m <= 1125; m += 15) out.push(m);
    return out;
  })();

  /** その時刻から duration 分ぶん、空き帯に収まるか */
  function fits(day, start, duration) {
    if (day.closed) return false;
    return day.free.some(([a, b]) => start >= a && start + duration <= b);
  }

  /* ------------------------------------------------------------------
     表示ヘルパ（DOMに触らない）
     ------------------------------------------------------------------ */

  const yen = n => '¥' + Number(n).toLocaleString('ja-JP');
  const hm  = m => { const h = Math.floor(m / 60); return h + ':' + String(m % 60).padStart(2, '0'); };

  /** 合計の所要時間と料金。オフとオプションを足すだけだが、必ずここを通す */
  function total(menu, offChoice, optionIds) {
    let min = menu.minutes, yenN = menu.price;
    if (offChoice && !offChoice.isNoOff) { min += offChoice.minutes || 0; yenN += offChoice.price || 0; }
    (optionIds || []).forEach(id => {
      const o = optionOf(id);
      if (o) { min += o.minutes || 0; yenN += o.price || 0; }
    });
    return { minutes:min, price:yenN };
  }

  return {
    OFF_SETS, OPTIONS, optionOf, CATEGORIES, PLANS,
    menus, forceLinks, DAYS, SLOT_TIMES, fits,
    yen, hm, total,
  };
})();
