/* ============================================================================
   売上ダッシュボードのダミーデータ  →  移植時は API レスポンスに置き換わる
   ----------------------------------------------------------------------------
   ■ 売上の3つの軸（ここが現行UIで一番混乱する所）
     入金ベース … 実際にお金が入った額。総売上 = 新規 + 継続 + 物販 − 返金
     消化ベース … サービスを提供した額。回数券・サブスクを使った分（回収分）を含む
     予測       … 期間内に見込まれる額

     入金と消化は「別の数え方」であって、足し引きする関係にはない。
     現行UIは6枚のカードを横一列に並べていて、この違いが読み取れなかった。

   ■ 金額はすべて「円・整数」で保持する（勤怠の小数バグと同じ轍を踏まない）
   ========================================================================== */
'use strict';

window.SalesData = (function () {

  const SHOP = { brand:'Mavie', area:'神奈川', name:'Mavie 本厚木店' };

  /** 期間 */
  const PERIOD = { from:'2026-08-01', to:'2026-08-24' };

  const STAFF = [
    { id:'funai',  name:'船井 はる香' },
    { id:'yamash', name:'山下 帆乃花' },
    { id:'yoshiz', name:'吉澤 美愛奈' },
    { id:'kondo',  name:'近藤 舞香' },
  ];

  /* --- 決定的な擬似乱数（Math.randomを使わず、日ごとに再現可能にする） --- */
  const rnd = (n, salt) => {
    const x = Math.sin((n + 1) * 12.9898 + salt * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };

  /**
   * 日次データを組み立てる。
   * 土日と金曜を高め、月曜を低めにして、実際の来店の波に近づけている。
   */
  function daily() {
    const days = [];
    const start = new Date(PERIOD.from + 'T00:00:00');
    const end   = new Date(PERIOD.to   + 'T00:00:00');
    let i = 0;
    for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1), i++) {
      const dow = d.getDay();                       // 0=日
      const weekend = (dow === 0 || dow === 6);
      const base = weekend ? 108000 : dow === 5 ? 96000 : dow === 1 ? 52000 : 72000;
      const jitter = 0.72 + rnd(i, 3) * 0.56;       // 0.72〜1.28

      const total   = Math.round(base * jitter / 100) * 100;
      const shinki  = Math.round(total * (0.38 + rnd(i, 7) * 0.16) / 100) * 100;
      const buppan  = Math.round(total * (0.02 + rnd(i, 11) * 0.06) / 100) * 100;
      const keizoku = total - shinki - buppan;

      const visits  = Math.max(3, Math.round(total / 11500));
      const cancel  = rnd(i, 13) > 0.72 ? Math.round(rnd(i, 17) * 3) : 0;
      const noshow  = rnd(i, 19) > 0.93 ? 1 : 0;
      const refund  = rnd(i, 23) > 0.88 ? Math.round(rnd(i, 29) * 40) * 100 : 0;

      days.push({
        date: d.toISOString().slice(0, 10),
        dow: dow,
        total: total, shinki: shinki, keizoku: keizoku, buppan: buppan,
        refund: refund,
        shouka: Math.round(total * (0.90 + rnd(i, 31) * 0.12) / 100) * 100,
        kaishu: rnd(i, 37) > 0.7 ? Math.round(rnd(i, 41) * 80) * 100 : 0,
        visits: visits, cancel: cancel, noshow: noshow,
        shinkiCount:  Math.max(1, Math.round(visits * (0.3 + rnd(i, 43) * 0.3))),
        keizokuCount: 0,
        rate: Math.round((44 + rnd(i, 47) * 46) * 10) / 10,   // 稼働率 %
        pay:   { 現金: 0, クレジット: 0, QR決済: 0, 事前決済: 0 },
        media: { ホットペッパー: 0, minimo: 0, Google: 0, 紹介: 0 },
      });
    }
    // 決済内訳・媒体別は合計に合わせて按分する
    days.forEach((d, i) => {
      d.keizokuCount = Math.max(0, d.visits - d.shinkiCount);
      const p = [0.18, 0.46, 0.22, 0.14];
      const keys = Object.keys(d.pay);
      let acc = 0;
      keys.forEach((k, j) => {
        const v = j === keys.length - 1 ? d.total - acc : Math.round(d.total * p[j] / 100) * 100;
        d.pay[k] = v; acc += v;
      });
      const m = [0.42, 0.28, 0.18, 0.12];
      const mk = Object.keys(d.media);
      let macc = 0;
      mk.forEach((k, j) => {
        const v = j === mk.length - 1 ? d.shinkiCount - macc : Math.round(d.shinkiCount * m[j]);
        d.media[k] = Math.max(0, v); macc += d.media[k];
      });
    });
    return days;
  }

  /** スタッフ別。日次の合計と辻褄が合うよう按分する */
  function byStaff(days) {
    const share = [0.31, 0.18, 0.39, 0.12];
    const tot = days.reduce((a, d) => ({
      total: a.total + d.total, shinki: a.shinki + d.shinki,
      keizoku: a.keizoku + d.keizoku, buppan: a.buppan + d.buppan,
      shouka: a.shouka + d.shouka, kaishu: a.kaishu + d.kaishu,
      refund: a.refund + d.refund, visits: a.visits + d.visits,
      shinkiCount: a.shinkiCount + d.shinkiCount,
    }), { total:0, shinki:0, keizoku:0, buppan:0, shouka:0, kaishu:0, refund:0, visits:0, shinkiCount:0 });

    const rows = STAFF.map((s, i) => {
      const k = share[i];
      const total = Math.round(tot.total * k / 100) * 100;
      const cnt   = Math.max(1, Math.round(tot.visits * k));
      const open  = [93.75, 81.25, 139.5, 97.5][i] * 60;      // 予約開放時間(分)
      const work  = [37.58, 39.48, 120.5, 49.5][i] * 60;      // 稼働時間(分)
      return {
        id: s.id, name: s.name,
        forecast: Math.round(total * 1.08 / 1000) * 1000,
        total: total,
        shinki:  Math.round(tot.shinki  * k / 100) * 100,
        keizoku: Math.round(tot.keizoku * k / 100) * 100,
        buppan:  Math.round(tot.buppan  * k / 100) * 100,
        shouka:  Math.round(tot.shouka  * k / 100) * 100,
        kaishu:  Math.round(tot.kaishu  * k / 100) * 100,
        refund:  Math.round(tot.refund  * k / 100) * 100,
        count: cnt,
        unit: Math.round(total / cnt),
        openMin: open, workMin: work,
        rate: Math.round(work / open * 1000) / 10,
        shinkiCount: Math.max(1, Math.round(tot.shinkiCount * k)),
        buyCount: Math.max(0, Math.round(cnt * (0.36 + i * 0.03))),
        gReview: [0, 1, 2, 0][i],
        hReview: [1, 0, 1, 0][i],
      };
    });
    /*
      按分の丸め誤差で、スタッフ別の合計が全体の集計とズレる。
      売上画面で合計が合わないのは致命的なので、差分を最終行に寄せて必ず一致させる。
      （実装ではサーバー側で同じ調整を行うか、明細から積み上げること）
    */
    const RECONCILE = { total:'total', shinki:'shinki', keizoku:'keizoku', buppan:'buppan',
                        shouka:'shouka', kaishu:'kaishu', refund:'refund' };
    Object.keys(RECONCILE).forEach(k => {
      const want = tot[k];
      const got  = rows.reduce((a, r) => a + r[k], 0);
      rows[rows.length - 1][k] += want - got;
    });
    const wantCnt = tot.visits;
    rows[rows.length - 1].count += wantCnt - rows.reduce((a, r) => a + r.count, 0);
    const wantNew = tot.shinkiCount;
    rows[rows.length - 1].shinkiCount += wantNew - rows.reduce((a, r) => a + r.shinkiCount, 0);

    rows.forEach(r => {
      r.unit = Math.round(r.total / r.count);
      r.buyRate = Math.round(r.buyCount / r.count * 1000) / 10;
    });
    return rows;
  }

  /**
   * 新規売上の集計対象。
   * 初回に複数日通うコース（整体などの集中プログラム）を扱う店舗で使う。
   * 何日目の売上として計上するかを切り替える。
   * ※ この機能の正確な定義は要確認。使わない店舗は表示項目でオフにできる。
   */
  const NEW_SALES_BASIS = [
    { id:'all', label:'全体', ratio:1 },
    { id:'d1',  label:'1日目', ratio:0.62 },
    { id:'d2',  label:'2日目', ratio:0.24 },
    { id:'d3',  label:'3日目', ratio:0.14 },
  ];

  const DAYS = daily();
  return { SHOP, PERIOD, STAFF, DAYS, byStaff, NEW_SALES_BASIS };
})();
