/* ============================================================================
   モック専用の操作パネル  ★このファイルは移植対象外★
   ----------------------------------------------------------------------------
   レビュー中に「ロールを変えたらどう見えるか」「GPS機能をOFFにした店舗では
   どうなるか」を切り替えて確認するための足場。製品には存在しない。
   実UIと混ざらないよう、右下の独立したパネルに隔離してある。
   ========================================================================== */
'use strict';

window.MockBar = (function () {

  const CSS = `
  .mockbar{position:fixed; right:14px; bottom:14px; z-index:95; font-size:12.5px;}
  .mockbar-btn{
    display:flex; align-items:center; gap:7px; height:36px; padding:0 13px; border-radius:999px;
    background:#2A3B38; color:#fff; box-shadow:0 3px 12px rgba(0,0,0,.28); font-weight:600; font-size:12px;
  }
  .mockbar-btn::before{content:''; width:7px; height:7px; border-radius:50%; background:var(--gold);}
  .mockbar-panel{
    display:none; position:absolute; right:0; bottom:44px; width:252px;
    background:#fff; border:1px solid var(--line); border-radius:12px;
    box-shadow:0 10px 30px rgba(0,0,0,.20); padding:13px 14px;
  }
  .mockbar.open .mockbar-panel{display:block;}
  .mockbar-panel h4{margin:0 0 3px; font-size:12px; letter-spacing:.02em;}
  .mockbar-panel .cap{font-size:10.5px; color:var(--mut); margin:0 0 11px; line-height:1.5;}
  .mockbar-panel label.fl{display:block; font-size:10.5px; color:var(--mut); margin:10px 0 4px;}
  .mockbar-panel select{
    width:100%; height:34px; border:1px solid var(--line); border-radius:8px;
    background:#fff; padding:0 8px; font-size:12.5px;
  }
  .mockbar-scope{font-size:10.5px; color:var(--mut); margin-top:5px;}
  .mockbar-tg{display:flex; align-items:center; gap:9px; margin-top:11px; cursor:pointer;}
  .mockbar-tg input{position:absolute; opacity:0; width:0; height:0;}
  .mockbar-tg i{
    width:36px; height:20px; border-radius:999px; background:#D8D8D0; position:relative;
    flex:0 0 auto; transition:background .15s;
  }
  .mockbar-tg i::after{
    content:''; position:absolute; top:2px; left:2px; width:16px; height:16px; border-radius:50%;
    background:#fff; box-shadow:0 1px 3px rgba(0,0,0,.25); transition:left .15s;
  }
  .mockbar-tg input:checked + i{background:var(--ok);}
  .mockbar-tg input:checked + i::after{left:18px;}
  .mockbar-tg span{font-size:12px;}
  .mockbar-note{font-size:10.5px; color:var(--mut); margin-top:9px; line-height:1.5;
    border-top:1px solid var(--line); padding-top:8px;}
  `;

  /**
   * @param {{role:string, onRole:function, toggles:Array<{key,label,value,onChange,note}>}} opt
   */
  function init(opt){
    const st = document.createElement('style');
    st.textContent = CSS;
    document.head.appendChild(st);

    const roleOpts = Object.keys(Shell.ROLES)
      .map(k => '<option value="' + k + '"' + (k === opt.role ? ' selected' : '') + '>' +
                Shell.ROLES[k].label + '</option>').join('');

    const toggles = (opt.toggles || []).map(t =>
      '<label class="mockbar-tg"><input type="checkbox" data-tg="' + t.key + '"' +
      (t.value ? ' checked' : '') + '><i></i><span>' + t.label + '</span></label>' +
      (t.note ? '<div class="mockbar-note">' + t.note + '</div>' : '')
    ).join('');

    const el = document.createElement('div');
    el.className = 'mockbar';
    el.innerHTML =
      '<button class="mockbar-btn" id="mbBtn">モック設定</button>' +
      '<div class="mockbar-panel">' +
        '<h4>モック専用の切替</h4>' +
        '<p class="cap">製品には存在しない、レビュー用の操作です。</p>' +
        '<label class="fl" for="mbRole">ログイン中のロール</label>' +
        '<select id="mbRole">' + roleOpts + '</select>' +
        '<div class="mockbar-scope" id="mbScope"></div>' +
        toggles +
      '</div>';
    document.body.appendChild(el);

    const scope = () => {
      const r = Shell.ROLES[document.getElementById('mbRole').value];
      document.getElementById('mbScope').textContent = '可視範囲：' + r.scope;
    };
    scope();

    document.getElementById('mbBtn').addEventListener('click', () => el.classList.toggle('open'));
    document.getElementById('mbRole').addEventListener('change', e => {
      scope();
      opt.onRole(e.target.value);
    });
    (opt.toggles || []).forEach(t => {
      el.querySelector('[data-tg="' + t.key + '"]').addEventListener('change', e => t.onChange(e.target.checked));
    });
  }

  return { init };
})();
