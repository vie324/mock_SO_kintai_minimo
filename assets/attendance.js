/* ============================================================================
   勤怠の共通ロジック  →  移植先: utils/attendance.ts
   ----------------------------------------------------------------------------
   ここに置くのは「DOMに触らない純粋関数」だけ。サーバー・クライアントの
   両方から同じ関数を通すことで、表示ブレと再計算ズレを防ぐ。

   ■ 時刻の持ち方（重要）
     画面内の時刻はすべて「0:00からの経過分・整数」で保持する。
     Date や "09:15" 文字列を計算に使わない。表示の瞬間だけ文字列へ変換する。

   ■ 現行バグ（handoffメモ §3-1①）への対処
     APIが work_minutes: 523.7166666666667 のような float を返しており、
     フロントが `${Math.floor(m/60)}h${m%60}m` をそのまま描画して
     「8h43.7166666666667m」になっていた。
     対処は二段構え:
       (1) API側で秒を切り捨てて整数分で返す（本命）
       (2) フロントは必ず fmtHM() / fmtJa() を通す（保険。float が来ても壊れない）
     この2ファイルの関数は (2) を担保する。直接 String(min) を書かないこと。

   ■ ES Modules にしていない理由
     file:// で開いたとき type="module" は CORS で読み込めないため、
     素の <script src> で読める古典スクリプト（window へ生やす形）にしている。
     移植時は素直に export に置き換えてよい。
   ========================================================================== */
'use strict';

window.Attendance = (function () {

  /** 所定労働時間（分）。店舗/雇用形態/スタッフ単位のどれで設定するかは未決（メモ §5-6） */
  const STANDARD_MIN = 480;

  const DOW = ['日', '月', '火', '水', '木', '金', '土'];

  const pad = n => String(n).padStart(2, '0');

  /* ---------------- 表示フォーマット ---------------- */

  /** 分(小数可) → "8:44"。一覧・テーブル用。null は "—" */
  function fmtHM(min) {
    if (min == null) return '—';
    const t = Math.round(min);
    return Math.floor(t / 60) + ':' + pad(t % 60);
  }

  /** 分(小数可) → "8時間44分"。サマリー・KPI用。null は "—" */
  function fmtJa(min) {
    if (min == null) return '—';
    const t = Math.round(min);
    const h = Math.floor(t / 60), m = t % 60;
    if (h && m) return h + '時間' + m + '分';
    if (h) return h + '時間';
    return m + '分';
  }

  /** 分 → "09:15"（時刻表記）。null は空文字（input[type=time] に入れるため） */
  const toStr = m => (m == null ? '' : pad(Math.floor(m / 60)) + ':' + pad(m % 60));

  /** "09:15" → 555。空なら null */
  const toMin = s => {
    if (!s) return null;
    const [h, m] = s.split(':').map(Number);
    if (Number.isNaN(h) || Number.isNaN(m)) return null;
    return h * 60 + m;
  };

  /* ---------------- 集計 ---------------- */

  /**
   * 実働 = 退勤 − 出勤 − 休憩合計
   * 退勤が未打刻なら null（＝「打刻漏れ」。0分として集計に混ぜない）
   */
  function calcWork(inM, outM, breakMin) {
    if (inM == null || outM == null) return null;
    return Math.max(0, outM - inM - (breakMin || 0));
  }

  /** 残業 = max(0, 実働 − 所定労働時間)。深夜・法定休日割増は未計算（メモ §5-8） */
  function calcOvertime(workMin, standardMin) {
    if (workMin == null) return 0;
    return Math.max(0, workMin - (standardMin == null ? STANDARD_MIN : standardMin));
  }

  /**
   * 固定残業（みなし残業）の消化状況。
   * サロン・整体院では固定残業で回す店舗が多いため、月あたりの上限に対して
   * 「収まっているか／超えそうか／超えたか」を判定する。
   *
   *   normal … 通常
   *   warn   … alertRatio（既定80%）以上。超えそうなので管理者に知らせる
   *   over   … 上限超過。超過分は別途支給が要るため、給与計算前に必ず気づかせる
   *
   * limitMin が 0 / null の店舗は固定残業なしの運用 → 判定しない（null を返す）
   */
  function fixedOvertimeState(usedMin, limitMin, alertRatio) {
    if (!limitMin) return null;
    const ratio = usedMin / limitMin;
    return {
      used: usedMin,
      limit: limitMin,
      ratio: ratio,
      percent: Math.round(ratio * 100),
      remain: Math.round(limitMin - usedMin),          // 負なら超過分
      state: usedMin > limitMin ? 'over'
           : ratio >= (alertRatio == null ? 0.8 : alertRatio) ? 'warn'
           : 'normal',
    };
  }

  /** 1日の状態を判定。attendance_days.status に対応 */
  function dayStatus(day) {
    if (day.in == null && day.out == null) return 'absent';
    if (day.out == null) return 'missing_out';
    if (day.edited) return 'edited';
    return 'normal';
  }

  /** 日次配列 → KPI。打刻漏れは work に混ぜず件数だけ数える */
  function summarize(days, standardMin) {
    const std = (standardMin == null ? STANDARD_MIN : standardMin);
    let work = 0, brk = 0, overtime = 0, missing = 0;
    const dates = new Set();
    days.forEach(d => {
      dates.add(d.staff + '|' + d.date);
      brk += d.brk || 0;
      const w = calcWork(d.in, d.out, d.brk);
      if (w == null) { missing++; return; }
      work += w;
      overtime += calcOvertime(w, std);
    });
    return { work, brk, overtime, missing, days: dates.size };
  }

  /* ---------------- 打刻ステートマシン ---------------- */
  /*
     none --clock_in--> working --break_start--> break
                          |  ^                    |
                          |  +---break_end--------+
                          +--clock_out--> done

     ※ サーバー側でも同じ検証を行い、連打・二重打刻・順序違反をAPIで弾くこと。
        画面側の制御は「押させない」ためのもので、防御にはならない。
  */
  const PUNCH_LABEL   = { clock_in:'出勤', break_start:'休憩開始', break_end:'休憩戻り', clock_out:'退勤' };
  const PUNCH_ALLOWED = { none:['clock_in'], working:['break_start','clock_out'], break:['break_end'], done:[] };
  const PUNCH_NEXT    = { clock_in:'working', break_start:'break', break_end:'working', clock_out:'done' };
  const PUNCH_STATUS  = { none:'未出勤', working:'勤務中', break:'休憩中', done:'退勤済み' };

  /**
   * その状態で打てる打刻の種類。
   * 休憩を管理しない店舗（SHOP.breakEnabled=false）では休憩の2種を除く。
   */
  function allowedPunches(state, breakEnabled) {
    const list = PUNCH_ALLOWED[state] || [];
    if (breakEnabled === false) {
      return list.filter(t => t !== 'break_start' && t !== 'break_end');
    }
    return list;
  }

  /** その打刻が今の状態から可能か */
  const canPunch = (state, type, breakEnabled) => allowedPunches(state, breakEnabled).includes(type);

  /**
   * 打刻の並び → その時点の実働・休憩
   * 勤務中/休憩中は nowMin までを途中経過として積む
   */
  function punchProgress(punches, nowMin) {
    const inP  = punches.find(p => p.type === 'clock_in');
    const outP = punches.find(p => p.type === 'clock_out');
    let brk = 0, openBreak = null;
    punches.forEach(p => {
      if (p.type === 'break_start') openBreak = p.at;
      if (p.type === 'break_end' && openBreak != null) { brk += p.at - openBreak; openBreak = null; }
    });
    if (openBreak != null && nowMin != null) brk += Math.max(0, nowMin - openBreak); // 休憩中
    if (!inP) return { work: null, brk: brk, inAt: null, outAt: null };
    const end = outP ? outP.at : nowMin;
    return {
      work: end == null ? null : Math.max(0, end - inP.at - brk),
      brk: brk, inAt: inP.at, outAt: outP ? outP.at : null,
    };
  }

  /* ---------------- CSV ---------------- */

  /** 2次元配列 → BOM付きUTF-8・CRLF のCSV文字列（Excelでそのまま開ける） */
  function toCsv(rows) {
    return '﻿' + rows
      .map(r => r.map(c => '"' + String(c == null ? '' : c).replace(/"/g, '""') + '"').join(','))
      .join('\r\n');
  }

  return {
    STANDARD_MIN, DOW, pad,
    fmtHM, fmtJa, toStr, toMin,
    calcWork, calcOvertime, dayStatus, summarize, fixedOvertimeState,
    PUNCH_LABEL, PUNCH_ALLOWED, PUNCH_NEXT, PUNCH_STATUS, allowedPunches, canPunch, punchProgress,
    toCsv,
  };
})();
