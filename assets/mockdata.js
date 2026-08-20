/* ============================================================================
   モック用ダミーデータ  →  移植時は API レスポンスに置き換わる
   ----------------------------------------------------------------------------
   実装側のデータモデル案は claude_code_handoff.md §3-3 / §2-4 を参照。
   ここの形は、そのモデルから画面が必要とする分だけを抜いたもの。
   ========================================================================== */
'use strict';

window.MockData = (function () {

  /**
    店舗。GPS判定の中心で、distance_m はサーバーで算出する想定。
    gpsEnabled は店舗ごとの設定（GPS打刻を使わない店舗があるため）。
    設定場所は 設定 > 管理設定 > 店舗管理 が自然だが、実装時に要確認。
  */
  const SHOP = {
    id: 'machida',
    name: "si'se 町田店",
    address: '東京都町田市森野１丁目34-12　シェル都VIII　PLUSビル 103号',
    allowedRadiusM: 200,
    gpsEnabled: true,
  };

  /** スタッフ。実装では GET /api/stores/:sid/staff 相当 */
  const STAFF = {
    miura: { id: 'miura', name: '三浦 和真', shop: SHOP.name, role: 'スタイリスト' },
    sato:  { id: 'sato',  name: '佐藤 享哉', shop: SHOP.name, role: 'スタイリスト' },
  };
  const STAFF_ORDER = ['miura', 'sato'];

  /*
    attendance_days 相当。
    brk は「現行APIが返している float そのまま」を意図的に入れてある。
    これを fmtHM()/fmtJa() が丸めきれているか＝小数バグの回帰確認になるため、
    整数に直さないこと（メモ §3-1①）。
  */
  function attendanceDays() {
    return [
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
    ];
  }

  /*
    シフト（shift_assignments 相当）。
    勤怠側では「予定 vs 実績」の突き合わせと、打刻漏れ修正時の初期値に使う。
    休日はキーを持たせない（＝シフトなし）。
  */
  const SHIFTS = {
    'miura|2026-08-01': { start: 540, end: 1140 },   //  9:00–19:00
    'miura|2026-08-02': { start: 570, end: 1140 },   //  9:30–19:00
    'miura|2026-08-04': { start: 600, end: 1170 },   // 10:00–19:30
    'miura|2026-08-05': { start: 600, end: 1140 },   // 10:00–19:00
    'miura|2026-08-07': { start: 600, end: 1140 },   // 10:00–19:00
    'sato|2026-08-01':  { start: 600, end: 1140 },   // 10:00–19:00
    'sato|2026-08-02':  { start: 600, end: 1140 },
    'sato|2026-08-05':  { start: 600, end: 1140 },
    'sato|2026-08-06':  { start: 600, end: 1140 },
  };
  /** その日のシフトを返す。無ければ null */
  const shiftOf = (staff, date) => SHIFTS[staff + '|' + date] || null;

  /* ---- minimo連携枠（/schedule） ---- */

  const SCHEDULE_STAFF = [
    { id:'miura', name:'三浦 和真', shiftLabel:'00:00–00:00' },
    { id:'sato',  name:'佐藤 享哉', shiftLabel:'10:00–19:00' },
  ];

  /** minimo_slot 相当。source/synced_at はモックでは持たせていない */
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

  return { SHOP, STAFF, STAFF_ORDER, attendanceDays, shiftOf,
           SCHEDULE_STAFF, minimoSlots, reservations };
})();
