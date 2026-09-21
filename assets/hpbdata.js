/* ============================================================================
   HPB（サロンボード）連携のダミーデータ  →  移植時は API レスポンスに置き換わる
   ----------------------------------------------------------------------------
   ■ 前提：1店舗に HPB のページが複数ぶら下がる
     1つの物理店舗が、ホットペッパービューティに複数のサロンページを持つことがある。
     典型は「ヘア／美容整体のページ」＋「ネイル＆アイのページ」の2枚。
     ページごとにサロンボードのログインID・パスワードが別なので、
     SalonOne 側も「店舗 : 連携ページ = 1 : N」で持つ必要がある。

       role:'main' … 最初に登録したページ（本ページ）
       role:'sub'  … あとから「追加連携」したページ（サブページ）
     main / sub は登録順のラベルでしかなく、機能差はない。
     予約の重複防止はどちらのページが起点でも同じように働く。

   ■ 紐付け（linkage）
     スタッフ・メニュー・設備は SalonOne 側が正で、各ページの HPB 側IDへ紐付ける。
     1人のスタッフが両方のページに載ることも、片方にしか載らないこともある。

     セルは3状態を区別する。ここを2状態にすると「意図的に載せていない」と
     「設定し忘れ」が同じ見た目になり、重複事故の原因が追えなくなる。

       code文字列  … 紐付け済み
       'none'      … このページには出さない（意図的。対応不要）
       null        … 未設定（要対応。後述のとおりブロックが効かない）

   ■ 重複防止（ページ間ブロック）※常時有効・ON/OFFなし
     片方のページに予約が入ったら、もう一方のページの同じスタッフ・同じ時間帯を
     自動で閉じる。これが無いと、2枚のページが互いの予約を知らないまま
     同じスタッフの同じ枠を売り続ける。

     ただし成立条件がある：**両ページで紐付けが済んでいること**。
     紐付けが未設定（null）だと、閉じるべき相手のIDが分からないのでブロックできない。
     → block.state = 'unmapped'。下條のケースがこれで、実際に二重予約が成立している。

     反映は同期ジョブ経由なので即時ではない（現行10分間隔）。
     反映前の隙間に両ページへ同時着信すると重複しうる → block.state = 'pending'。
     三浦の17時台がこのケース。

   ■ 時刻
     全画面の規約どおり「0:00からの経過分（整数）」で保持する。
     描画時にだけ px / "HH:MM" へ変換する。
   ========================================================================== */
'use strict';

window.HpbData = (function () {

  /* ------------------------------------------------------------------
     連携ページ
     ------------------------------------------------------------------ */

  /**
    店舗。現行画面どおり5店舗を並べる。
    2ページ運用は町田店だけにしてある。残り4店舗は「まだ1ページの状態」で、
    そこから追加連携する導線を確認するためのもの。
  */
  const SHOPS = [
    { id:'machida',   name:"si'se 町田店",   pageIds:['pg_main', 'pg_sub'] },
    { id:'kawaguchi', name:"si'se 川口店",   pageIds:['pg_kawa'] },
    { id:'yamato',    name:"si'se 大和店",   pageIds:['pg_yamato'] },
    { id:'yokohama',  name:"si'se 横浜店",   pageIds:['pg_yokohama'] },
    { id:'atsugi',    name:"si'se 本厚木店", pageIds:['pg_atsugi'] },
  ];
  const SHOP = SHOPS[0];
  const shopOf = id => SHOPS.find(s => s.id === id) || SHOPS[0];

  /**
    ページ定義。
      abbr     予約表のバッジに出す1〜2文字。ページ名が長いのでここで短縮を持つ
      status   'ok' 認証済 / 'expired' 要再認証 / 'none' 未認証
      autoSync / autoAccount  一覧の2つのトグル（現行画面どおり）
  */
  const PAGES = [
    { id:'pg_main', role:'main', abbr:'本',
      name:"si'se 町田店", genre:'ヘア・美容整体',
      loginId:'CD87276', salonId:'H000123456',
      status:'ok', lastSync:'2026/9/21 11:46:35',
      autoSync:true, autoAccount:true,
      url:'https://beauty.hotpepper.jp/slnH000123456/' },

    { id:'pg_sub', role:'sub', abbr:'ネ',
      name:"si'se nail & eye 町田", genre:'ネイル・アイ',
      loginId:'CE90112', salonId:'H000988877',
      status:'ok', lastSync:'2026/9/21 11:52:10',
      autoSync:true, autoAccount:false,
      url:'https://beauty.hotpepper.jp/kr/slnH000988877/' },

    /* --- 1ページ運用の4店舗。追加連携する前の状態 --- */
    { id:'pg_kawa', role:'main', abbr:'本', name:"si'se 川口店", genre:'ヘア・美容整体',
      loginId:'CE24804', salonId:'H000224401', status:'ok',
      lastSync:'2026/9/21 11:48:01', autoSync:true, autoAccount:true, url:'' },
    { id:'pg_yamato', role:'main', abbr:'本', name:"si'se 大和店", genre:'ヘア・美容整体',
      loginId:'CE12140', salonId:'H000224402', status:'ok',
      lastSync:'2026/9/21 11:47:53', autoSync:true, autoAccount:true, url:'' },
    { id:'pg_yokohama', role:'main', abbr:'本', name:"si'se 横浜店", genre:'ヘア・美容整体',
      loginId:'CD04350', salonId:'H000224403', status:'expired',
      lastSync:'2026/9/20 22:10:44', autoSync:false, autoAccount:true, url:'' },
    { id:'pg_atsugi', role:'main', abbr:'本', name:"si'se 本厚木店", genre:'ヘア・美容整体',
      loginId:'CE24810', salonId:'H000224404', status:'ok',
      lastSync:'2026/9/21 11:30:44', autoSync:true, autoAccount:true, url:'' },
  ];

  const pageOf = id => PAGES.find(p => p.id === id) || null;

  /* ------------------------------------------------------------------
     紐付けマトリクス
     ------------------------------------------------------------------ */

  /**
    SalonOne 側のマスタ（マトリクスの行）。
    4パターンが1つずつ入るようにしてある。レビューで全状態を確認できる。

      両方      … 三浦 / 小顔矯正 / 施術ベッド1
      本のみ    … 佐藤 / カット＋カラー / 施術ベッド2
      サブのみ  … 高瀬 / ジェルネイル・まつエク / ネイルブース1
      未設定あり… 下條 / 産後骨盤矯正 / ネイルブース2
  */
  const ROWS = {
    staff: [
      { id:'miura',   name:'三浦 和真', note:'スタイリスト / 整体' },
      { id:'sato',    name:'佐藤 享哉', note:'スタイリスト' },
      { id:'takase',  name:'高瀬 みなみ', note:'ネイリスト / アイリスト' },
      { id:'shimojo', name:'下條 彩花', note:'スタイリスト / ネイリスト' },
    ],
    menu: [
      { id:'m_kogao', name:'小顔矯正＋ヘッドスパ',      note:'45分 / ¥2,200' },
      { id:'m_cut',   name:'カット＋カラー',            note:'120分 / ¥9,800' },
      { id:'m_gel',   name:'ジェルネイル ワンカラー',    note:'60分 / ¥5,800' },
      { id:'m_lash',  name:'LEDフラットラッシュ100本',  note:'50分 / ¥5,990' },
      { id:'m_kotsu', name:'産後骨盤矯正＋全身調整',     note:'45分 / ¥2,200' },
    ],
    equip: [
      { id:'bed1',  name:'施術ベッド1',   note:'2ページ共用' },
      { id:'bed2',  name:'施術ベッド2',   note:'' },
      { id:'nail1', name:'ネイルブース1', note:'' },
      { id:'nail2', name:'ネイルブース2', note:'' },
    ],
  };

  /**
    各ページの HPB 側の候補（セレクトの選択肢）。
    サロンボードからマスタ取得したときに降ってくる想定。
  */
  const CAND = {
    staff: {
      pg_main: [
        { code:'W000998761', label:'三浦' },
        { code:'W001341499', label:'佐藤' },
        { code:'W001882030', label:'下條' },
        { code:'W002014455', label:'小泉' },
      ],
      pg_sub: [
        { code:'W100223344', label:'MIURA' },
        { code:'W100556677', label:'高瀬' },
        { code:'W100889900', label:'SHIMOJO' },
      ],
    },
    menu: {
      pg_main: [
        { code:'MN-1001', label:'小顔矯正＋head spa' },
        { code:'MN-1002', label:'カット＋カラー（シャンプー込）' },
        { code:'MN-1003', label:'【ママ応援】産後骨盤矯正' },
      ],
      pg_sub: [
        { code:'MN-2001', label:'小顔矯正（アイ／ネイルと同時）' },
        { code:'MN-2002', label:'ワンカラー［オフ込］' },
        { code:'MN-2003', label:'LEDフラットラッシュ100本［オフ込］' },
      ],
    },
    equip: {
      pg_main: [
        { code:'EQ-A01', label:'ベッドA' },
        { code:'EQ-A02', label:'ベッドB' },
      ],
      pg_sub: [
        { code:'EQ-B01', label:'BED-1' },
        { code:'EQ-B02', label:'NAIL-1' },
        { code:'EQ-B03', label:'NAIL-2' },
      ],
    },
  };

  /*
    1ページ運用の4店舗ぶんの候補を埋めておく。
    候補が無いとセレクトに選択肢が出ず、紐付け済みの値が「未設定」に見えてしまう。
    モックなので本ページの候補を流用する。
  */
  PAGES.forEach(p => {
    Object.keys(CAND).forEach(kind => {
      if (!CAND[kind][p.id]) CAND[kind][p.id] = CAND[kind].pg_main.slice();
    });
  });

  /**
    現在の紐付け。 LINK[kind][rowId][pageId]
      文字列 … そのHPB側コードに紐付け済み
      'none' … このページには出さない（意図的）
      null   … 未設定（要対応）
  */
  function initialLink() {
    return {
      staff: {
        miura:   { pg_main:'W000998761', pg_sub:'W100223344' },  // 両方
        sato:    { pg_main:'W001341499', pg_sub:'none'       },  // 本のみ（意図的）
        takase:  { pg_main:'none',       pg_sub:'W100556677' },  // サブのみ（意図的）
        shimojo: { pg_main:'W001882030', pg_sub:null         },  // ★未設定 → ブロック不可
      },
      menu: {
        m_kogao: { pg_main:'MN-1001', pg_sub:'MN-2001' },
        m_cut:   { pg_main:'MN-1002', pg_sub:'none'    },
        m_gel:   { pg_main:'none',    pg_sub:'MN-2002' },
        m_lash:  { pg_main:'none',    pg_sub:'MN-2003' },
        m_kotsu: { pg_main:'MN-1003', pg_sub:null      },  // ★未設定
      },
      equip: {
        bed1:  { pg_main:'EQ-A01', pg_sub:'EQ-B01' },       // 両方＝共用。重複の本丸
        bed2:  { pg_main:'EQ-A02', pg_sub:'none'   },
        nail1: { pg_main:'none',   pg_sub:'EQ-B02' },
        nail2: { pg_main:'none',   pg_sub:null     },       // ★未設定
      },
    };
  }

  /** セルの状態を返す： 'linked' | 'none' | 'unset' */
  function cellState(v) {
    if (v === null || v === undefined) return 'unset';
    if (v === 'none') return 'none';
    return 'linked';
  }

  /**
    行の要約。マトリクスの左端に出して「両方／本のみ／サブのみ／未設定」を一目で示す。
    未設定が1つでもあれば 'unset' を優先して返す（対応が必要な行を埋もれさせない）。
  */
  function rowSummary(linkRow, pageIds) {
    const ids = pageIds || PAGES.map(p => p.id);
    if (ids.some(id => cellState(linkRow[id]) === 'unset')) return 'unset';
    const linked = ids.filter(id => cellState(linkRow[id]) === 'linked');
    if (linked.length === 0) return 'nowhere';
    if (linked.length === ids.length) return 'both';
    // 2ページ運用の言い回しに寄せる。3ページ以上なら件数で言う
    if (ids.length === 2) return linked[0] === ids[0] ? 'mainonly' : 'subonly';
    return 'partial';
  }

  const SUMMARY_LABEL = {
    both:     { t:'両ページ',   cls:'both'  },
    mainonly: { t:'本ページのみ', cls:'one' },
    subonly:  { t:'サブページのみ', cls:'one' },
    nowhere:  { t:'どちらにも出さない', cls:'muted' },
    partial:  { t:'一部のページ', cls:'one' },
    unset:    { t:'未設定',     cls:'warn'  },
  };

  /* ------------------------------------------------------------------
     予約表（2026-09-21 月）
     ------------------------------------------------------------------ */

  const DATE = '2026-09-21';
  const DATE_LABEL = '2026年9月21日(月)';

  /** 予約表の行。設備行も同じ構造で描けるようにしてある */
  const LANES = {
    staff: [
      { id:'miura',   name:'三浦 和真',   shift:'出勤 10:00–19:00', avatar:'三' },
      { id:'sato',    name:'佐藤 享哉',   shift:'出勤 11:00–20:00', avatar:'佐' },
      { id:'takase',  name:'高瀬 みなみ', shift:'出勤 10:00–19:00', avatar:'高' },
      { id:'shimojo', name:'下條 彩花',   shift:'出勤 10:00–19:00', avatar:'下' },
    ],
    equip: [
      { id:'bed1',  name:'施術ベッド1',   shift:'2ページ共用', avatar:'B1' },
      { id:'nail1', name:'ネイルブース1', shift:'サブページ専用', avatar:'N1' },
    ],
  };

  /**
    予約。
      page   どのHPBページから入ったか。null は SalonOne 直接入力 / minimo
      src    'hpb' | 'minimo' | 'direct' | 'form'（強制リンク経由）
      state  'booked' | 'done' | 'cancel'
      equip  占有する設備（設備行の描画に使う）
  */
  function reservations() {
    return [
      /* --- 三浦：本ページ2件・サブページ1件。ページをまたいでも1本の列に並ぶ --- */
      { id:'r1', lane:'miura', equip:'bed1', start:600, end:690, page:'pg_main', src:'hpb',
        name:'砂田 章尚', code:'#836', menu:'小顔矯正＋ヘッドスパ',
        tags:['会員','指名'], state:'booked' },

      { id:'r2', lane:'miura', equip:'bed1', start:720, end:810, page:'pg_sub', src:'hpb',
        name:'大川 結衣', code:'#1733', menu:'ワンカラー［オフ込］',
        tags:['新規'], state:'booked' },

      { id:'r3', lane:'miura', equip:'bed1', start:900, end:960, page:'pg_main', src:'hpb',
        name:'八尋 美衣', code:'#981', menu:'小顔矯正＋ヘッドスパ',
        tags:['会員'], state:'booked' },

      /* --- 三浦 17時台：同期ラグ中に両ページへ着信した重複 --- */
      { id:'r10', lane:'miura', equip:'bed1', start:1020, end:1080, page:'pg_main', src:'hpb',
        name:'始澤 汐音', code:'#1204', menu:'小顔矯正＋ヘッドスパ',
        tags:['会員','指名'], state:'booked' },
      { id:'r11', lane:'miura', equip:'bed1', start:1050, end:1110, page:'pg_sub', src:'hpb',
        name:'ZENG XIUMEI', code:'#6436', menu:'LEDフラットラッシュ100本',
        tags:['新規'], state:'booked' },

      /* --- 佐藤：本ページのみ。サブページに載っていないので相手枠を閉じる必要がない --- */
      { id:'r4', lane:'sato', equip:'bed2', start:660, end:735, page:'pg_main', src:'hpb',
        name:'結城 未来', code:'#827', menu:'カット＋カラー',
        tags:['会員'], state:'booked' },
      { id:'r5', lane:'sato', equip:'bed2', start:840, end:930, page:null, src:'minimo',
        name:'栗田 亜希子', code:'#6437', menu:'ミニモ予約',
        tags:['新規'], state:'booked' },

      /* --- 高瀬：サブページのみ --- */
      { id:'r6', lane:'takase', equip:'nail1', start:630, end:720, page:'pg_sub', src:'hpb',
        name:'平山 和佳奈', code:'#805', menu:'LEDフラットラッシュ100本',
        tags:['会員','指名'], state:'booked' },
      { id:'r7', lane:'takase', equip:'nail1', start:780, end:930, page:'pg_sub', src:'hpb',
        name:'相川 真憂', code:'#6339', menu:'ワンカラー［オフ込］',
        tags:['会員'], state:'booked' },

      /* --- 下條：サブページが未紐付け。ブロックできず二重予約が成立している --- */
      { id:'r8', lane:'shimojo', equip:'bed1', start:660, end:720, page:'pg_main', src:'hpb',
        name:'野間 由香', code:'#1120', menu:'カット＋カラー',
        tags:['会員'], state:'booked' },
      { id:'r9', lane:'shimojo', equip:'bed1', start:690, end:780, page:'pg_sub', src:'hpb',
        name:'青木 秋代', code:'#6512', menu:'ワンカラー［オフ込］',
        tags:['新規'], state:'booked' },

      /* --- 強制リンク（特別予約フォーム）からの予約。オフ選択つき --- */
      { id:'r12', lane:'takase', equip:'nail1', start:960, end:1050, page:null, src:'form',
        name:'松尾 亜湖', code:'#6540', menu:'ワンカラー ＋ 自店オフ',
        tags:['新規'], state:'booked' },

      /* --- 休憩 --- */
      { id:'b1', lane:'sato', equip:null, start:960, end:1020, page:null, src:'direct',
        name:'休憩', code:'', menu:'', tags:[], state:'break' },
    ];
  }

  /**
    ページ間ブロック。予約1件につき「もう一方のページを閉じた」記録が1件できる。

      state:'done'     反映済み（相手ページの枠は閉じている）
      state:'pending'  未反映（次の同期で反映。この隙間が重複の発生源）
      state:'unmapped' 紐付け未設定のため反映できない（＝事故る）
      state:'skip'     相手ページにそのスタッフが居ないので不要
  */
  function blocks() {
    return [
      { id:'bk1',  from:'r1',  lane:'miura',   page:'pg_sub',  start:600,  end:690,  state:'done' },
      { id:'bk2',  from:'r2',  lane:'miura',   page:'pg_main', start:720,  end:810,  state:'done' },
      { id:'bk3',  from:'r3',  lane:'miura',   page:'pg_sub',  start:900,  end:960,  state:'done' },
      { id:'bk10', from:'r10', lane:'miura',   page:'pg_sub',  start:1020, end:1080, state:'pending' },
      { id:'bk11', from:'r11', lane:'miura',   page:'pg_main', start:1050, end:1110, state:'pending' },
      { id:'bk4',  from:'r4',  lane:'sato',    page:'pg_sub',  start:660,  end:735,  state:'skip' },
      { id:'bk6',  from:'r6',  lane:'takase',  page:'pg_main', start:630,  end:720,  state:'skip' },
      { id:'bk7',  from:'r7',  lane:'takase',  page:'pg_main', start:780,  end:930,  state:'skip' },
      { id:'bk8',  from:'r8',  lane:'shimojo', page:'pg_sub',  start:660,  end:720,  state:'unmapped' },
      { id:'bk9',  from:'r9',  lane:'shimojo', page:'pg_main', start:690,  end:780,  state:'unmapped' },
    ];
  }

  /* ------------------------------------------------------------------
     判定ロジック（DOMに触らない純粋関数。移植先は utils/hpb.ts 相当）
     ------------------------------------------------------------------ */

  /** 2区間が重なるか（端が接するだけは重複としない） */
  function overlaps(a, b) {
    return a.start < b.end && b.start < a.end;
  }

  /**
    同じ列（スタッフまたは設備）で、別ページの予約どうしが重なっているものを拾う。
    同一ページ内の重複は HPB 側が弾くので、ここではページ跨ぎだけを見る。
  */
  function findConflicts(list, laneKey) {
    const out = [];
    for (let i = 0; i < list.length; i++) {
      for (let j = i + 1; j < list.length; j++) {
        const a = list[i], b = list[j];
        if (a.state === 'break' || b.state === 'break') continue;
        if (a[laneKey] !== b[laneKey] || !a[laneKey]) continue;
        if (!a.page || !b.page || a.page === b.page) continue;
        if (overlaps(a, b)) out.push([a, b]);
      }
    }
    return out;
  }

  /** "0:00からの分" → "H:MM" */
  function hm(min) {
    const h = Math.floor(min / 60), m = min % 60;
    return h + ':' + String(m).padStart(2, '0');
  }

  /**
    店舗の紐付けデータを返す。
    町田以外は1ページ運用なので、本ページ相当の値だけを持つ形に畳んでおく。
  */
  function linkFor(shopId) {
    const base = initialLink();
    if (shopId === 'machida') return base;
    const only = shopOf(shopId).pageIds[0];
    const out = {};
    Object.keys(base).forEach(kind => {
      out[kind] = {};
      Object.keys(base[kind]).forEach(rowId => {
        out[kind][rowId] = { [only]: base[kind][rowId].pg_main };
      });
    });
    return out;
  }

  return {
    SHOP, SHOPS, shopOf, PAGES, pageOf, linkFor,
    ROWS, CAND, initialLink, cellState, rowSummary, SUMMARY_LABEL,
    DATE, DATE_LABEL, LANES, reservations, blocks,
    overlaps, findConflicts, hm,
  };
})();
