# SalonOne 改善モック 引き渡しメモ v0.1

作成日: 2026-08-20 ／ 対象: `minimo_mobile_mock.html` `kintai_mock.html`

---

## 0. このメモの使い方

モックは**素のHTML1枚 + inline CSS/JS**で作ってあります。Next.js App Router / Tailwind の
現行構成を変えずに移植できるよう、以下の方針で書いています。

- 外部ライブラリ・ビルド不要。ブラウザで開けばそのまま動く
- 状態管理は素のJSだが、**React hooks へそのまま置換できる粒度**で分離
- 色・余白はCSS変数 → Tailwind の design token に1対1で対応（§4）
- ソース冒頭のコメントに、そのファイル固有の仕様・API案を記載

Claude Code へは「このHTMLを参照実装として、既存の `/schedule` `/time-tracking` を
書き換えて」と指示する想定です。指示文の雛形は §6 に置いています。

---

## 1. ファイル一覧

| ファイル | 対象画面 | 内容 |
|---|---|---|
| `minimo_mobile_mock.html` | `/schedule`（スマホ） | minimo連携枠のタッチ操作（移動・伸縮・新規・削除） |
| `kintai_mock.html` | `/punch` `/time-tracking` | 打刻画面＋勤怠管理（修正モーダル・承認・CSV） |

---

## 2. minimo連携枠のモバイルUI

### 2-1. 現状の課題
- ピンクの縦バーが**細く、閲覧専用**。スマホから枠の調整ができない
- タップ判定領域が狭く、誤タップしやすい
- 変更が minimo 側へ同期されたかが画面から分からない

### 2-2. モックで実装した操作
| 操作 | 挙動 |
|---|---|
| ピンクのバーをタップ | 編集モード。列いっぱいの半透明ブロック＋上下ハンドル表示 |
| ブロックをドラッグ | 枠全体を移動（15分スナップ） |
| 上下ハンドルをドラッグ | 開始／終了時刻を伸縮（最小15分） |
| 空き時間を長押し(500ms) | 新規枠を60分で作成し編集モードへ。触覚フィードバックあり |
| 下部の操作バー | 時刻表示／削除／キャンセル／保存 |
| 予約・他枠と重複 | ブロックが赤くなり保存ボタンを無効化 |
| 保存・削除 | 同期ボタンに「未同期件数」バッジ。同期でクリア |

### 2-3. 実装定数
```
DAY_START = 9:00 / DAY_END = 19:00 / SNAP = 15分
PX15 = 26px（通常） / 16px（短縮表示ON）
時刻はすべて「0:00からの分(int)」で保持し、描画時のみpxへ変換
```

### 2-4. データモデル案
```ts
minimo_slot {
  id, store_id, staff_id,
  start_at, end_at,               // 15分単位
  source: 'manual' | 'minimo',    // 手動作成か、minimoから取り込んだ枠か
  synced_at,                      // null = 未同期
  updated_by, updated_at
}
```
バリデーション: `start < end` ／ 15分単位 ／ 同一スタッフの予約・他枠と非重複

### 2-5. API案
```
GET    /api/stores/:sid/minimo-slots?date=YYYY-MM-DD
POST   /api/stores/:sid/minimo-slots
PATCH  /api/minimo-slots/:id
DELETE /api/minimo-slots/:id
POST   /api/stores/:sid/minimo-slots/sync    // minimo側へ反映
```

### 2-6. 移植時の注意
- Pointer Events（`pointerdown/move/up` + `setPointerCapture`）のロジックは
  `useSlotDrag` のようなカスタムフックへそのまま移せます
- **ドラッグ中は再レンダーせず style を直更新**（モックと同じ方針）。
  setState を毎フレーム呼ぶとスマホでカクつきます
- ゴースト／ハンドルには `touch-action: none` 必須（iOSのスクロール暴発防止）
- 楽観更新 + 失敗時ロールバック。同期は非同期ジョブなので「未同期」表示を必ず残す

---

## 3. 打刻・勤怠管理

### 3-1. 現行実装のバグ（最優先で修正）

**① 時間表記が小数のまま出ている**

現状の画面表示:
```
合計 8h43.7166666666667m
休憩 1h1.1666666666666643m
```
原因: APIが `work_minutes: 523.7166666666667`（秒以下を含む float）を返し、
フロント側が `${Math.floor(m/60)}h${m%60}m` をそのまま描画している。

対処:
- API側で**秒を切り捨てて整数分**で返す（`break_minutes` `work_minutes` とも）
- フロントは必ず `fmtHM()` / `fmtJa()` を通す（`utils/attendance.ts` に切り出し）
- 表示統一: 一覧は `8:44` ／ サマリーは `8時間44分`

```ts
export const fmtHM = (min: number | null) => {
  if (min == null) return '—';
  const t = Math.round(min);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};
```

**② 退勤打刻がない行が「—」で終わる** → 打刻漏れに気づけない
→ 「退勤未打刻」バッジ＋画面上部にアラート集約＋修正導線

**③ スタッフ絞り込みがない** → 人数が増えると1つの表が破綻
→ 月／スタッフ／状態の3フィルタ＋スタッフ単位の小計

**④ 打刻の修正手段がない** → 打ち忘れ・押し間違いを直せない
→ 行から修正モーダル（**理由必須**・変更履歴を残す）

**⑤ スマホで横スクロールになる**
→ 768px未満はカードレイアウトへ切替（CSSのみで実装済み）

### 3-2. モックで実装した機能

**[A] 打刻（スタッフ）**
- 大きな時計＋現在ステータス（未出勤／勤務中／休憩中／退勤済み）
- GPS状態カード（範囲内／範囲外で打刻ボタンをロック）
- 出勤／退勤／休憩開始／休憩戻りの4ボタン。**押せるものだけ有効**
- 今日の打刻タイムライン＋実働・休憩の途中経過

ステートマシン:
```
none --clock_in--> working --break_start--> break --break_end--> working --clock_out--> done
```
※ サーバー側でも同じ検証を行い、連打・二重打刻を弾いてください

**[B] 勤怠管理（管理者）**
- KPI: 総勤務時間／出勤日数／休憩合計／残業合計／打刻漏れ件数
- 打刻漏れアラート帯 →「該当だけ表示」で絞り込み
- スタッフ別ブロック＋日別行（土日は曜日を色分け）
- 状態バッジ: 退勤未打刻／修正済／残業◯時間◯分／通常
- 修正モーダル: 出勤・退勤・休憩を編集、実働をリアルタイム再計算、理由必須
- 月次承認（打刻漏れがあると承認不可）
- CSV出力（BOM付きUTF-8・Excelでそのまま開ける）

### 3-3. データモデル案
```ts
time_punches {
  id, staff_id, shop_id,
  type: 'clock_in' | 'break_start' | 'break_end' | 'clock_out',
  recorded_at, lat, lng, distance_m,
  source: 'app' | 'manual', created_by
}

attendance_days {
  staff_id, work_date,
  clock_in, clock_out,
  break_minutes: int,          // ← 小数を持たせない
  work_minutes: int,           // ← 小数を持たせない
  status: 'normal' | 'missing_out' | 'edited' | 'absent',
  is_edited, edit_reason, edited_by, edited_at,
  approved_at, approved_by
}
```

### 3-4. API案
```
POST  /api/punches                              // 打刻（type + 位置情報）
GET   /api/attendance?month=YYYY-MM&staff_id=   // 月次一覧（整数分で返す）
PATCH /api/attendance/:staffId/:date            // 打刻修正（reason必須）
POST  /api/attendance/approve                   // 月次承認
GET   /api/attendance/export?month=YYYY-MM      // CSV
```

### 3-5. 集計ルール（モックの前提）
```
実働 = 退勤 − 出勤 − 休憩合計
残業 = max(0, 実働 − 所定労働時間)     所定労働時間の既定値 = 480分
```
深夜割増・法定休日割増は未計算（§5 の未決事項参照）

---

## 4. デザイントークン対応表

モックのCSS変数 → Tailwind theme への対応。既存トークン名に合わせて調整してください。

| CSS変数 | 値 | 用途 |
|---|---|---|
| `--teal` | `#003737` | brand-sub（サイドバー・主要ボタン） |
| `--teal-3` | `#106258` | フォーカスリング・リンク |
| `--gold` | `#C6A664` | brand（アクセント・トグル・枠線） |
| `--cream` | `#F4F4EF` | base-bg |
| `--paper` | `#FFFFFF` | カード背景 |
| `--line` | `#E4E4DC` | ボーダー |
| `--mut` | `#6E7B78` | 補助テキスト |
| `--pink` | `#F43F5E` | minimo連携枠 |
| `--ok` / `--warn` / `--danger` | `#2E8B5F` / `#B4740B` / `#C4342B` | 状態色 |

---

## 5. 未決事項（決めてから実装したい項目）

### minimo枠
1. **シフト外・営業時間外に枠を作れるか？** モックは9:00–19:00で制限のみ
2. **枠の削除は minimo 側へどう伝わるか？** 既に予約が入った枠を縮めた場合の扱い
3. **同期の方向** SalonOne→minimo の一方向か、双方向か。競合時どちらを優先するか
4. **最小枠の長さ** モックは15分。ジャンルによって30分の方が良いか
5. **PC版も同じ操作にするか** 現状PCはドラッグ非対応。合わせるかどうか

### 勤怠
6. **所定労働時間の設定単位** 店舗ごと／雇用形態ごと／スタッフごと
7. **休憩の自動控除** 6時間超で45分など、法定の自動控除を入れるか
8. **深夜（22:00–5:00）・法定休日の割増** 給与管理と連動させるか
9. **打刻修正の権限** 店舗管理者まで可か、ブランド管理者のみか
10. **承認後のロック** 承認済みの月を修正する場合の差戻しフロー
11. **日跨ぎ勤務** 深夜営業サロン向けに 24:00 を超える退勤を許容するか
12. **GPS範囲外の打刻** 完全ブロックか、理由付きで許可して管理者に通知か

---

## 6. Claude Code への指示文（雛形）

```
SalonOne（Next.js App Router / next-intl / Tailwind）の改修です。
参照実装として minimo_mobile_mock.html と claude_code_handoff.md を読んでください。

【今回の対象】
1. /schedule のスマホ表示に、minimo連携枠のタッチ編集を実装
   - モックの操作仕様（タップ編集・ドラッグ移動・ハンドル伸縮・長押し新規）をそのまま再現
   - ドラッグ処理は useSlotDrag フックに切り出し、ドラッグ中は再レンダーせず style 直更新
   - 既存の予約カード・HPB同期表示は壊さないこと

【制約】
- 依存ライブラリの追加は不可。既存の Tailwind トークンを使う
- 文言は next-intl の messages に追加（ハードコード禁止）
- 型定義は既存の命名規則に合わせる

【進め方】
- まず変更するファイル一覧と実装方針を出して、こちらの確認を取ってから着手
```

勤怠側も同様に、対象を `/punch` `/time-tracking` に差し替えて指示してください。
**時間表記の小数バグ（§3-1①）は独立した修正として先に出す**のが安全です。
