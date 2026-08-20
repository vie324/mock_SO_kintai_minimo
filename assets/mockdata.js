/* ============================================================================
   モック用ダミーデータ  →  移植時は API レスポンスに置き換わる
   ----------------------------------------------------------------------------
   実装側のデータモデル案は claude_code_handoff.md §3-3 / §2-4 を参照。
   ここの形は、そのモデルから画面が必要とする分だけを抜いたもの。
   ========================================================================== */
'use strict';

window.MockData = (function () {

  /** 店舗（GPS判定の中心。distance_m はサーバーで算出する想定） */
  const SHOP = { id: 'machida', name: "si'se 町田店", allowedRadiusM: 200 };

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

  return { SHOP, STAFF, STAFF_ORDER, attendanceDays, SCHEDULE_STAFF, minimoSlots, reservations };
})();
