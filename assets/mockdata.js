/* ============================================================================
   モック用ダミーデータ  →  移植時は API レスポンスに置き換わる
   ----------------------------------------------------------------------------
   実装側のデータモデル案は claude_code_handoff.md §3-3 / §2-4 を参照。
   ========================================================================== */
'use strict';

window.MockData = (function () {

  /**
    店舗設定。サロン・整体院で運用が分かれる項目はここで持つ。

      gpsEnabled    GPS打刻を使うか。使わない店舗があるため
      breakEnabled  休憩打刻を使うか。休憩を取らせない/管理しない店舗があるため
                    OFFのとき: 打刻画面から休憩ボタンを消し、勤怠一覧から休憩列を消す
                              実働 = 退勤 − 出勤（休憩控除なし）

      fixedOvertimeMinutes  固定残業（みなし残業）の月あたり時間。既定30時間。
                            0 を入れると固定残業なしの運用（チェックを行わない）
      overtimeAlertRatio    この割合を超えたら「注意」を出す。既定80%

    設定場所は 設定 > 管理設定 > 店舗管理 が自然だが、実装時に要確認。
    固定残業は雇用形態ごと／スタッフごとに違う可能性が高い（メモ §5-6 と同じ論点）。
  */
  const SHOP = {
    id: 'machida',
    name: "si'se 町田店",
    address: '東京都町田市森野１丁目34-12　シェル都VIII　PLUSビル 103号',
    allowedRadiusM: 200,
    gpsEnabled: true,
    breakEnabled: true,
    fixedOvertimeMinutes: 1800,   // 30時間
    overtimeAlertRatio: 0.8,
  };

  const STAFF = {
    miura: { id: 'miura', name: '三浦 和真', shop: SHOP.name, role: 'スタイリスト' },
    sato:  { id: 'sato',  name: '佐藤 享哉', shop: SHOP.name, role: 'スタイリスト' },
  };
  const STAFF_ORDER = ['miura', 'sato'];

  /*
    attendance_days 相当。

    ■ 先頭の9件は「現行APIが返している値」をそのまま入れてある。
      brk が float なのは意図的で、fmtHM()/fmtJa() が丸めきれているかの
      回帰確認になる（メモ §3-1①）。整数に直さないこと。
      退勤 null の2件は打刻漏れの確認用。

    ■ 残りは固定残業のアラートを確認するための1か月分。
      三浦 残業32時間 → 固定残業30時間を超過（超過表示）
      佐藤 残業26時間 → 30時間の87%（注意表示）
  */
  function attendanceDays() {
    return [
      // --- 現行APIの値をそのまま（小数バグの回帰確認用） ---
      { staff:'miura', date:'2026-08-01', in:555, out:1140, brk:61.1666666666666643, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-02', in:573, out:null, brk:56.46666666666667,   edited:false, reason:'' },
      { staff:'miura', date:'2026-08-04', in:600, out:1170, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-05', in:592, out:1125, brk:45, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-07', in:600, out:1140, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-01', in:600, out:1155, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-02', in:605, out:1140, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-05', in:598, out:null, brk:45, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-06', in:600, out:1230, brk:60, edited:true,
        reason:'退勤打刻を忘れたためシフト終了時刻で登録' },

      // --- 固定残業アラート確認用 ---
      { staff:'miura', date:'2026-08-08', in:610, out:1275, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-09', in:600, out:1260, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-11', in:610, out:1275, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-12', in:610, out:1270, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-14', in:610, out:1275, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-15', in:610, out:1270, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-16', in:595, out:1260, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-18', in:610, out:1270, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-19', in:600, out:1265, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-21', in:610, out:1270, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-22', in:605, out:1270, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-23', in:610, out:1270, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-25', in:610, out:1275, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-26', in:595, out:1255, brk:60, edited:false, reason:'' },
      { staff:'miura', date:'2026-08-28', in:605, out:1268, brk:60, edited:false, reason:'' },

      { staff:'sato',  date:'2026-08-08', in:610, out:1270, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-09', in:610, out:1270, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-12', in:605, out:1265, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-13', in:610, out:1270, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-15', in:605, out:1265, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-16', in:605, out:1265, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-19', in:600, out:1260, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-20', in:610, out:1275, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-22', in:605, out:1265, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-23', in:610, out:1275, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-26', in:610, out:1270, brk:60, edited:false, reason:'' },
      { staff:'sato',  date:'2026-08-27', in:610, out:1275, brk:60, edited:false, reason:'' },
    ];
  }

  /*
    シフト（shift_assignments 相当）。
    勤怠側では打刻漏れ修正時の初期値に使う。
    明示のない日はモックの都合で既定シフトを返す（実装ではシフト表が正）。
  */
  const SHIFTS = {
    'miura|2026-08-01': [540, 1140],   //  9:00–19:00
    'miura|2026-08-02': [570, 1140],   //  9:30–19:00
    'miura|2026-08-04': [600, 1170],   // 10:00–19:30
    'miura|2026-08-05': [600, 1140],
    'miura|2026-08-07': [600, 1140],
    'sato|2026-08-01':  [600, 1140],
    'sato|2026-08-02':  [600, 1140],
    'sato|2026-08-05':  [600, 1140],
    'sato|2026-08-06':  [600, 1140],
  };
  const DEFAULT_SHIFT = [600, 1260];   // 10:00–21:00

  /** その日のシフト { start, end } */
  function shiftOf(staff, date){
    const s = SHIFTS[staff + '|' + date] || DEFAULT_SHIFT;
    return { start: s[0], end: s[1] };
  }

  /* ---- minimo連携（/schedule） ---- */

  const SCHEDULE_STAFF = [
    { id:'miura', name:'三浦 和真', shiftLabel:'00:00–00:00' },
    { id:'sato',  name:'佐藤 享哉', shiftLabel:'10:00–19:00' },
  ];

  /** minimo_slot 相当 */
  function minimoSlots() {
    return [
      { id:'m1', staff:'miura', start:600, end:840 },  // 10:00–14:00
      { id:'s1', staff:'sato',  start:600, end:720 },  // 10:00–12:00
      { id:'s2', staff:'sato',  start:810, end:960 },  // 13:30–16:00
    ];
  }

  /** 既存予約。minimo枠はこれと重複できない */
  function reservations() {
    return [
      { id:'r1', staff:'sato', start:720, end:795,
        name:'小野 未央子', code:'#262', tag:'会員', src:'H' },
    ];
  }

  /*
    minimo掲載メニュー。実画面（Minimo設定 > メニュー設定）の内容に合わせている。
    直前割はこのメニューに対して作成する。
      published  掲載中かどうか（チェックボックス）
      minimoOnly 「ミニモ限定」バッジ
      isNew      「新規」バッジ
      wasPrice   割引前価格（打ち消し線で出す）
  */
  const MINIMO = {
    salonId: '43JfRu',
    accountName: '美容整体 小顔矯正 si\'se【シセ】',
    menus: [
      { id:'mn1', thumb:'産後骨盤矯正', title:'【ママ応援】産後骨盤矯正＋全身調整',
        price:2200, minutes:45, tags:['リラク','腰','肩','脚'],
        published:true, isNew:true, minimoOnly:false },
      { id:'mn2', thumb:'小顔矯正', title:'【当日限定】小顔矯正＋head spa',
        price:2200, minutes:45, tags:['エステ','リラク','顔','頭','首'],
        published:true, isNew:true, minimoOnly:true },
      { id:'mn3', thumb:'NEW OPEN', title:'★Open記念★ 全身整体＋骨盤矯正',
        price:5500, wasPrice:16500, minutes:75, tags:['整体','全身','骨盤'],
        published:true, isNew:true, minimoOnly:true },
    ],
    /** 直前割の割引率の選択肢 */
    discountRates: [10, 20, 30, 50],
    /** 公開タイミングの選択肢 */
    releaseTimings: ['開始2時間前', '開始1時間前', '開始30分前', 'すぐに公開'],
  };

  return { SHOP, STAFF, STAFF_ORDER, attendanceDays, shiftOf,
           SCHEDULE_STAFF, minimoSlots, reservations, MINIMO };
})();
