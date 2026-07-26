# 衣櫃 UI 執整 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 把配裝分享器嘅道具視窗版面改到貼近《跑Online》原本 —— 分頁落底、子 tab 靠右、裝備欄改用 SVG 面板、Avatar mode 改成粒掣著燈。

**Architecture:** 全部改動集中喺單一檔案 `index.html`（659 行，CSS 喺 `<style>`、JS 喺 `<script>`），加兩個新 SVG 資產。冇 build step、冇框架 —— 改完直接 reload 就見到。四個任務各自獨立，順序做但唔互相依賴。

**Tech Stack:** 純 HTML/CSS/JS，冇 build tool。本機 `python -m http.server 8899` 睇效果（已經行緊，背景 ID `bfht8jkvk`）。驗證用瀏覽器實機檢查，冇自動化測試框架 —— 所以每個任務嘅「測試」係一段喺 DevTools console 貼得入去嘅 assertion script。

**Spec:** `docs/superpowers/specs/2026-07-26-wardrobe-ui-polish-design.md`

---

## File Structure

| 檔案 | 責任 | 動作 |
|---|---|---|
| `index.html` | 成個 app（CSS + markup + JS） | 修改 4 處 |
| `assets/ui/slot-panel-avatar.svg` | Avatar 裝備欄面板（藍） | 新增 |
| `assets/ui/slot-panel-role.svg` | 角色裝備欄面板（灰） | 新增 |

`index.html` 已經係單檔設計，唔喺呢次範圍內拆。四個任務改嘅位互相唔重疊：

- Task 1 → `renderPager()` + `.grid-pager` CSS + `.wardrobe-grid` 高度
- Task 2 → `.wardrobe-links` markup + `.subtab-list` CSS
- Task 3 → `.rail*` CSS + `renderRail()` + 新 SVG
- Task 4 → `.rail:not(.active-target)` CSS 一條規則

---

### Task 1: 分頁搬落底部、改數字頁碼

**Files:**
- Modify: `index.html` — `renderPager()`（第 508 行起）、`.grid-pager` CSS（第 21 行附近）、`.wardrobe-grid` height（第 13 行）、markup（第 89-90 行）

- [ ] **Step 1: 寫失敗測試**

喺 `d:/evoke/talesrunner-wardrobe/test-pager.js` 新建（呢個檔係臨時嘅，Task 1 完成後刪）：

```js
// 喺瀏覽器 console 貼入去跑。全部 assertion 都要 pass。
(async () => {
  const fail = [];
  const ok = (cond, msg) => { if (!cond) fail.push(msg); };

  // 揀「服裝 > 上衣」，2,374 件 = 149 頁
  document.querySelector('[data-category="服裝"]').click();
  await new Promise(r => setTimeout(r, 300));

  const pager = document.getElementById('gridPager');
  const grid = document.getElementById('wardrobeGrid');

  // 1. 分頁要喺格仔下面（DOM 次序同視覺位置）
  ok(grid.compareDocumentPosition(pager) & Node.DOCUMENT_POSITION_FOLLOWING,
     '分頁應該喺 grid 之後');
  ok(pager.getBoundingClientRect().top > grid.getBoundingClientRect().top,
     '分頁應該喺 grid 下面');

  // 2. 要有數字頁碼掣
  const nums = [...pager.querySelectorAll('[data-goto]')].map(b => b.textContent);
  ok(nums.length > 0, '應該有數字頁碼掣');
  ok(nums.includes('1'), '應該有第 1 頁');

  // 3. 第一頁：唔應該有前導省略號，應該有尾隨省略號
  ok(!nums.slice(0, 2).includes('…'), '第一頁唔應該有前導 …');
  ok(pager.textContent.includes('…'), '149 頁應該有省略號');

  // 4. 撳去中間頁，兩邊都應該有省略號
  const target = [...pager.querySelectorAll('[data-goto]')].find(b => b.textContent === '5');
  if (target) { target.click(); await new Promise(r => setTimeout(r, 300)); }
  const mid = document.getElementById('gridPager').textContent;
  ok(mid.includes('…'), '中間頁應該有省略號');

  // 5. 只有一頁嘅時候唔應該出頁碼
  const search = document.getElementById('equipmentSearch');
  search.value = '工藝代理人帽子(男)';
  search.dispatchEvent(new Event('input'));
  await new Promise(r => setTimeout(r, 350));
  const one = document.getElementById('gridPager');
  ok(one.querySelectorAll('[data-goto]').length === 0, '得一頁唔應該出頁碼');
  ok(one.textContent.includes('件'), '得一頁仍然要顯示件數');

  search.value = ''; search.dispatchEvent(new Event('input'));
  console.log(fail.length ? '❌ FAIL:\n' + fail.join('\n') : '✅ PASS');
  return fail;
})();
```

- [ ] **Step 2: 跑測試確認佢失敗**

開 `http://127.0.0.1:8899/index.html?t=1`，喺 DevTools console 貼上面段 script。

Expected: `❌ FAIL`，列出「分頁應該喺 grid 之後」「應該有數字頁碼掣」等等 —— 因為而家分頁喺 `.wardrobe-links` 入面、只有箭嘴冇數字。

- [ ] **Step 3: 改 markup —— 分頁移出 `.wardrobe-links`**

`index.html` 第 89-90 行，由：

```html
            <div class="wardrobe-links"><div class="subtab-list" id="subtabList"></div><div class="grid-pager" id="gridPager"></div></div>
            <div class="wardrobe-grid" id="wardrobeGrid"></div>
```

改成：

```html
            <div class="wardrobe-links"><div class="subtab-list" id="subtabList"></div></div>
            <div class="wardrobe-grid" id="wardrobeGrid"></div>
            <div class="grid-pager" id="gridPager"></div>
```

- [ ] **Step 4: 改 CSS —— 分頁置中、格仔縮短**

`index.html` 第 21 行附近，將 `.grid-pager` 規則由：

```css
.grid-pager{margin-left:auto;display:flex;align-items:center;gap:4px;flex:0 0 auto;color:#24527b;font-size:9px;white-space:nowrap}
```

改成：

```css
.grid-pager{height:26px;display:flex;align-items:center;justify-content:center;gap:3px;color:#24527b;font-size:9px;white-space:nowrap}
.grid-pager .page-gap{width:14px;text-align:center;color:#7fa0bd}
.grid-pager [data-goto]{min-width:17px;height:18px;padding:0 3px;border:1px solid #8cc7ea;border-radius:4px;color:#1b6ea8;font-size:9px;font-weight:900;background:linear-gradient(#fff,#e3f3fd)}
.grid-pager [data-goto].current{color:#fff;border-color:#0e6ba8;background:linear-gradient(#3fb4ea,#1272b5)}
```

同一行嘅 `.grid-pager button{...}`（箭嘴掣樣式）保留唔郁。

再將 `.wardrobe-grid` 由 `height:464px` 改成 `height:438px`（讓返 26px 畀分頁）：

```css
.wardrobe-grid{height:438px;display:grid;grid-template-columns:repeat(4,1fr);grid-template-rows:repeat(4,1fr);gap:8px 12px}
```

- [ ] **Step 5: 改 `renderPager()` —— 加數字頁碼**

`index.html` 第 508 行起，整個 `renderPager` 換成：

```js
    // 視窗式頁碼：永遠顯示首尾，加當前頁 ±2，斷開處用 …
    function pageWindow(current,pageCount){
      const span=new Set([0,pageCount-1]);
      for(let i=current-2;i<=current+2;i++) if(i>=0&&i<pageCount) span.add(i);
      const sorted=[...span].sort((a,b)=>a-b);
      const out=[];
      sorted.forEach((p,i)=>{ if(i&&p-sorted[i-1]>1)out.push('gap'); out.push(p) });
      return out;
    }
    function renderPager(total,pageCount){
      if(!total){gridPager.innerHTML='<span class="total-note">冇符合嘅裝備</span>';return}
      const nums=pageCount>1?pageWindow(gridPage,pageCount).map(p=>
        p==='gap'?'<span class="page-gap">…</span>'
                 :`<button data-goto="${p}" class="${p===gridPage?'current':''}">${p+1}</button>`).join(''):'';
      gridPager.innerHTML=(pageCount>1?`<button data-page="first" ${gridPage===0?'disabled':''} aria-label="第一頁">«</button>
        <button data-page="prev" ${gridPage===0?'disabled':''} aria-label="上一頁">‹</button>${nums}
        <button data-page="next" ${gridPage>=pageCount-1?'disabled':''} aria-label="下一頁">›</button>
        <button data-page="last" ${gridPage>=pageCount-1?'disabled':''} aria-label="最後一頁">»</button>`:'')
        +`<span class="total-note">共 ${total.toLocaleString('en-US')} 件</span>`;
      gridPager.querySelectorAll('[data-page]').forEach(button=>button.addEventListener('click',()=>{
        const move=button.dataset.page;
        if(move==='first')gridPage=0;
        else if(move==='prev')gridPage-=1;
        else if(move==='next')gridPage+=1;
        else gridPage=pageCount-1;
        hideTooltip();renderGrid();
      }));
      gridPager.querySelectorAll('[data-goto]').forEach(button=>button.addEventListener('click',()=>{
        gridPage=Number(button.dataset.goto);hideTooltip();renderGrid();
      }));
    }
```

- [ ] **Step 6: 跑測試確認 pass**

硬重載 `http://127.0.0.1:8899/index.html?t=2`（改過 CSS/JS，要繞開 cache），重貼 Step 1 段 script。

Expected: `✅ PASS`

- [ ] **Step 7: 目測**

睇「服裝 > 上衣」，分頁應該喺格仔下面置中，樣似 `« ‹ 1 … 4 5 [6] 7 8 … 149 › » 共 2,374 件`。撳數字要跳到嗰頁。

- [ ] **Step 8: Commit**

```bash
cd d:/evoke/talesrunner-wardrobe
rm -f test-pager.js
git add index.html
git commit -m "Move pagination under the grid with numbered pages

The game puts it there, centred, with page numbers rather than just arrows.
With 149 pages of tops the full list would not fit, so the strip shows the
first and last page plus two either side of the current one and elides the
rest."
```

---

### Task 2: 子 tab 右對齊

**Files:**
- Modify: `index.html` — `.subtab-list` CSS（第 13 行）

- [ ] **Step 1: 寫失敗測試**

```js
(async () => {
  const fail = [];
  const ok = (c, m) => { if (!c) fail.push(m); };
  document.querySelector('[data-category="飾品"]').click();
  await new Promise(r => setTimeout(r, 300));

  const list = document.getElementById('subtabList');
  const links = list.parentElement;
  const lr = links.getBoundingClientRect(), sr = list.getBoundingClientRect();

  // 右邊界應該貼住容器右邊（容 2px）
  ok(Math.abs(lr.right - sr.right) <= 2, `子 tab 應該右對齊（差 ${Math.round(lr.right - sr.right)}px）`);
  // 左邊唔應該貼住容器左邊 —— 貼住代表仲係左對齊
  ok(sr.left - lr.left > 10, '子 tab 唔應該左對齊');
  // 10 個子 tab 全部單行
  const btns = [...list.querySelectorAll('button')];
  ok(btns.length === 10, `飾品應該有 10 個子 tab，實際 ${btns.length}`);
  ok(btns.every(b => b.offsetHeight < 20), '子 tab 唔應該斷行');

  console.log(fail.length ? '❌ FAIL:\n' + fail.join('\n') : '✅ PASS');
  return fail;
})();
```

- [ ] **Step 2: 跑測試確認佢失敗**

Expected: `❌ FAIL`，「子 tab 應該右對齊」同「子 tab 唔應該左對齊」兩條 —— 因為而家 `.subtab-list` 冇 `margin-left:auto`，分頁走咗之後佢就攤喺左邊。

- [ ] **Step 3: 改 CSS**

`index.html` 第 13 行，`.subtab-list` 加 `margin-left:auto`：

```css
.subtab-list{margin-left:auto;display:flex;align-items:center;gap:4px;min-width:0;overflow-x:auto;overflow-y:hidden;scrollbar-width:none}
```

其餘（`::-webkit-scrollbar`、`button`、`button.active`）唔郁。

- [ ] **Step 4: 跑測試確認 pass**

硬重載，重貼 Step 1 段 script。Expected: `✅ PASS`

- [ ] **Step 5: Commit**

```bash
cd d:/evoke/talesrunner-wardrobe
git add index.html
git commit -m "Right-align the sub-tabs

Matches where the game puts them — tucked under the category tabs against
the right edge. They were left-aligned because the pager used to share the
row; now that it doesn't, the row was lopsided."
```

---

### Task 3: 裝備欄改用 SVG 面板

**Files:**
- Create: `assets/ui/slot-panel-avatar.svg`（由 `c:/Users/User/Downloads/slotpanel_active (1).svg` 複製）
- Create: `assets/ui/slot-panel-role.svg`（由 `c:/Users/User/Downloads/slotpanel_inactive (1).svg` 複製）
- Modify: `index.html` — `.rail*` CSS（第 12 行）、`renderRail()`（第 481-497 行附近）

- [ ] **Step 1: 複製 SVG 入 repo**

```bash
cd d:/evoke/talesrunner-wardrobe
mkdir -p assets/ui
cp "c:/Users/User/Downloads/slotpanel_active (1).svg"   assets/ui/slot-panel-avatar.svg
cp "c:/Users/User/Downloads/slotpanel_inactive (1).svg" assets/ui/slot-panel-role.svg
ls -la assets/ui/
```

Expected: 兩個檔，各約 28-30 KB。

> 原檔名 `active`/`inactive` **唔係狀態**，係兩條唔同嘅欄（Avatar 藍／角色灰），
> 所以改名。兩條欄各自永遠用自己嗰個檔，唔會因為選中而換圖。

- [ ] **Step 2: 寫失敗測試**

```js
(async () => {
  const fail = [];
  const ok = (c, m) => { if (!c) fail.push(m); };

  const av = document.querySelector('.rail.avatar'), ro = document.querySelector('.rail.role');
  // 1. 兩條欄用 SVG 做背景
  ok(getComputedStyle(av).backgroundImage.includes('slot-panel-avatar.svg'), 'Avatar 欄應該用 slot-panel-avatar.svg');
  ok(getComputedStyle(ro).backgroundImage.includes('slot-panel-role.svg'), '角色欄應該用 slot-panel-role.svg');

  // 2. 比例要跟 SVG（728:3096），容 2%
  const r = av.getBoundingClientRect();
  const ratio = r.height / r.width, want = 3096 / 728;
  ok(Math.abs(ratio - want) / want < 0.02, `Avatar 欄比例應該係 ${want.toFixed(2)}，實際 ${ratio.toFixed(2)}`);

  // 3. 16 格
  const slots = av.querySelectorAll('.rail-slot');
  ok(slots.length === 16, `應該有 16 格，實際 ${slots.length}`);

  // 4. 格位對得準 —— 第 0 格應該喺 left 8.79%、top 9.82%、width 38.46%
  const s0 = slots[0].getBoundingClientRect();
  const relL = (s0.left - r.left) / r.width * 100;
  const relT = (s0.top - r.top) / r.height * 100;
  const relW = s0.width / r.width * 100;
  ok(Math.abs(relL - 8.791) < 1, `第 0 格 left 應該 8.79%，實際 ${relL.toFixed(2)}%`);
  ok(Math.abs(relT - 9.819) < 1, `第 0 格 top 應該 9.82%，實際 ${relT.toFixed(2)}%`);
  ok(Math.abs(relW - 38.462) < 1, `第 0 格 width 應該 38.46%，實際 ${relW.toFixed(2)}%`);

  // 5. 右欄第 1 格 left 應該 52.75%
  const s1 = slots[1].getBoundingClientRect();
  ok(Math.abs((s1.left - r.left) / r.width * 100 - 52.747) < 1, '第 1 格應該喺右欄 52.75%');

  // 6. 最後一行第 14 格（尾）top 應該 = (304+312*7)/3096 = 80.36%
  const s14 = slots[14].getBoundingClientRect();
  ok(Math.abs((s14.top - r.top) / r.height * 100 - 80.362) < 1, '第 14 格 top 應該 80.36%');

  // 7. 空格唔應該再 render unicode 符號
  const empty = [...slots].find(s => !s.dataset.itemId);
  ok(empty && empty.textContent.trim() === '', '空格應該冇文字（靠 SVG 自帶圖示）');

  console.log(fail.length ? '❌ FAIL:\n' + fail.join('\n') : '✅ PASS');
  return fail;
})();
```

- [ ] **Step 3: 跑測試確認佢失敗**

Expected: `❌ FAIL` —— 背景唔係 SVG、比例係 72px 寬嘅舊尺寸、格數係 15 唔係 16、空格有 unicode 符號。

- [ ] **Step 4: 改 CSS —— 面板同格位**

`index.html` 第 12 行，將 `.rail` 到 `.role .rail-slot` 呢段換成：

```css
.rail{position:absolute;z-index:8;top:118px;width:76px;height:323px;padding:0;border:0;border-radius:0;background:no-repeat center/100% 100%;box-shadow:none}
.rail.avatar{left:18px;background-image:url(assets/ui/slot-panel-avatar.svg)}
.rail.role{right:18px;background-image:url(assets/ui/slot-panel-role.svg)}
.rail-grid{position:absolute;inset:0}
.rail-slot{position:absolute;width:38.462%;height:9.044%;display:grid;place-items:center;overflow:hidden;padding:0;border:0;border-radius:14%;background:none;color:transparent;font-size:0}
.rail-slot img{width:100%;height:100%;object-fit:contain}
```

> `width:76px` × `3096/728` = 323px，所以 `height:323px`。呢個比例要同 SVG 一致，
> 否則 16 格會對唔準。

`.rail-slot.equipped`、`.rail-slot.occupied:after`、`.rail-slot.blocked`、
`.rail-title`、`.rail-footer` 全部保留唔郁。

`.rail-footer` 而家係 `.rail` 嘅 flow child，但 `.rail` 變咗固定高度背景，
所以要改成絕對定位喺欄底下面：

```css
.rail-footer{position:absolute;left:0;right:0;top:calc(100% + 4px);width:100%;height:22px;display:flex;align-items:center;justify-content:center;gap:3px;padding:0;border:1px solid #55a8d5;border-radius:5px;color:#4e7188;font-size:8px;background:#fff}
```

- [ ] **Step 5: 改 `renderRail()` —— 16 格、絕對定位、空格唔出符號**

`index.html` 第 481 行起，`renderRail` 換成：

```js
    // SVG 面板幾何：viewBox 728x3096，格位 x=64/384、y=304+312*row、size=280
    const RAIL_SLOT_POS=[...Array(16)].map((_,i)=>({
      left:((i%2?384:64)/728*100).toFixed(3)+'%',
      top:((304+312*Math.floor(i/2))/3096*100).toFixed(3)+'%'
    }));
    function renderRail(target,element){
      const worn=equippedItems(target);
      element.innerHTML=RAIL_SLOT_POS.map((pos,i)=>{
        const def=slotDefs[i];
        const style=`left:${pos.left};top:${pos.top}`;
        if(!def)return `<div class="rail-slot" style="${style}" aria-hidden="true"></div>`;
        const [id,label]=def;
        const item=worn.find(candidate=>candidate.slots.includes(id));
        const isPrimary=item&&item.primarySlot===id;
        const isBlocked=item&&!isPrimary;
        const stateClass=isPrimary?'equipped occupied':isBlocked?'blocked occupied':'';
        const content=isPrimary?`<img src="${item.img}" alt="${item.name}">`:isBlocked?'<span class="block-mark">×</span>':'';
        const stateLabel=isPrimary?label:isBlocked?`${label}已佔用`:'';
        const ariaText=item?`${label}：${isPrimary?item.name:'被'+item.name+'佔用'}`:`${label}：空裝備欄位`;
        return `<div class="rail-slot ${stateClass}" style="${style}" data-label="${stateLabel}" data-slot-label="${label}" data-item-id="${item?item.id:''}" tabindex="0" aria-label="${ariaText}">${content}</div>`;
      }).join('');
      element.querySelectorAll('.rail-slot[data-slot-label]').forEach(slot=>{
        slot.addEventListener('mouseenter',()=>showRailTooltip(slot,target));
        slot.addEventListener('mouseleave',hideRailTooltip);
        slot.addEventListener('focus',()=>showRailTooltip(slot,target));
        slot.addEventListener('blur',hideRailTooltip);
      });
    }
```

> `slotDefs` 有 15 個，第 16 格 `def` 係 `undefined`，所以出一個空 div 佔位 ——
> 同 SVG 最後一格留空一致。

- [ ] **Step 6: 跑測試確認 pass**

硬重載，重貼 Step 2 段 script。Expected: `✅ PASS`

- [ ] **Step 7: 目測對位**

著幾件唔同部位嘅裝備，確認 icon 準確落喺 SVG 畫嘅格入面（唔好偏出框）：

```js
(async () => {
  const s = document.getElementById('equipmentSearch');
  for (const q of ['橙色短袖T恤', '白色運動鞋', '馴鹿角']) {
    s.value = q; s.dispatchEvent(new Event('input'));
    await new Promise(r => setTimeout(r, 350));
    const c = document.querySelector('.item-card');
    if (c) c.querySelector('[data-action="toggle"]').click();
    await new Promise(r => setTimeout(r, 250));
  }
  s.value = ''; s.dispatchEvent(new Event('input'));
  console.log('已著 3 件，肉眼睇下 icon 有冇對準格');
})();
```

- [ ] **Step 8: Commit**

```bash
cd d:/evoke/talesrunner-wardrobe
git add assets/ui index.html
git commit -m "Render the equipment rails from the supplied panels

The two SVGs draw the panel, the slot frames and a pictogram per slot, so
empty slots need nothing rendered on top and the unicode placeholders go
away. Slots are positioned as percentages of the 728x3096 viewBox, which
means the rail has to keep that ratio rather than the artwork being squeezed
into the old 72px box.

Their filenames said active/inactive but they are the Avatar and role rails,
blue and grey, and neither swaps on selection — renamed to say so."
```

---

### Task 4: Avatar mode 改成粒掣著燈

**Files:**
- Modify: `index.html` — 第 16 行 `.rail:not(.active-target)` 規則

- [ ] **Step 1: 寫失敗測試**

```js
(async () => {
  const fail = [];
  const ok = (c, m) => { if (!c) fail.push(m); };

  const av = document.querySelector('.rail.avatar'), ro = document.querySelector('.rail.role');
  const lit = () => document.querySelector('.rail.active-target .rail-title');

  // 切去 Avatar mode
  document.querySelector('[data-loadout-target="avatar"]').click();
  await new Promise(r => setTimeout(r, 250));
  ok(getComputedStyle(av).filter === 'none', 'Avatar 欄唔應該有 filter');
  ok(getComputedStyle(ro).filter === 'none', '角色欄唔應該去色（Avatar mode ON）');
  ok(getComputedStyle(ro).opacity === '1', '角色欄唔應該淡化');
  ok(lit() && lit().closest('.rail').classList.contains('avatar'), 'Avatar 粒掣應該著燈');

  // 切去 role mode
  document.querySelector('[data-loadout-target="role"]').click();
  await new Promise(r => setTimeout(r, 250));
  ok(getComputedStyle(av).filter === 'none', 'Avatar 欄唔應該去色（Avatar mode OFF）');
  ok(getComputedStyle(av).opacity === '1', 'Avatar 欄唔應該淡化');
  ok(lit() && lit().closest('.rail').classList.contains('role'), '角色粒掣應該著燈');

  console.log(fail.length ? '❌ FAIL:\n' + fail.join('\n') : '✅ PASS');
  return fail;
})();
```

- [ ] **Step 2: 跑測試確認佢失敗**

Expected: `❌ FAIL` —— 未選中嗰條欄而家有 `saturate(.55) brightness(.9)` 同 `opacity:.76`。

- [ ] **Step 3: 改 CSS —— 移除整條欄去色，加強粒掣**

`index.html` 第 16 行，將：

```css
.rail{transition:filter .15s,box-shadow .15s,transform .15s}.rail:not(.active-target){filter:saturate(.55) brightness(.9);opacity:.76}.rail.active-target{transform:translateY(-2px);box-shadow:0 0 0 3px rgba(255,255,255,.8),0 0 13px rgba(28,147,224,.72)}.rail-title{cursor:pointer}.rail.active-target .rail-title:after{content:"✓";margin-left:4px;color:#fff}
```

換成：

```css
.rail-title{cursor:pointer;transition:box-shadow .15s,filter .15s}
.rail:not(.active-target) .rail-title{filter:saturate(.45) brightness(.96);opacity:.8}
.rail.active-target .rail-title{filter:none;opacity:1;box-shadow:0 0 0 2px #fff,0 0 10px rgba(255,214,64,.9)}
.rail.active-target .rail-title:after{content:"✓";margin-left:4px}
```

> 兩條欄嘅面板永遠保持自己顏色 —— 著燈與否只表現喺粒掣度，同遊戲一樣。

- [ ] **Step 4: 跑測試確認 pass**

硬重載，重貼 Step 1 段 script。Expected: `✅ PASS`

- [ ] **Step 5: 確認能力值邏輯冇被改壞**

```js
(async () => {
  const fail = [];
  const ok = (c, m) => { if (!c) fail.push(m); };
  const read = n => document.querySelector(`[data-top-value="${n}"]`).textContent;

  // 揀莉娜 1/6/2/5
  for (const g of ['跑者','故事','聯名']) {
    document.querySelector(`#charTabs button`).parentElement
      .querySelectorAll('button').forEach(b => { if (b.textContent === g) b.click(); });
    await new Promise(r => setTimeout(r, 150));
    const s = [...document.querySelectorAll('#charGrid .char-slot')].find(x => x.dataset.char === '3');
    if (s) { s.click(); await new Promise(r => setTimeout(r, 300)); break; }
  }
  ok(read('最高速度') === '1' && read('加速度') === '6', '莉娜基礎值應該係 1/6/2/5');

  document.querySelector('[data-loadout-target="role"]').click();
  await new Promise(r => setTimeout(r, 200));
  const search = document.getElementById('equipmentSearch');
  search.value = '新月交輝鞋子(男)-T'; search.dispatchEvent(new Event('input'));
  await new Promise(r => setTimeout(r, 350));
  document.querySelector('.item-card [data-action="toggle"]').click();
  await new Promise(r => setTimeout(r, 300));
  ok(read('最高速度') === '5', `著鞋後最高速度應該係 5，實際 ${read('最高速度')}`);
  ok(read('加速度') === '9', `著鞋後加速度應該係 9，實際 ${read('加速度')}`);

  console.log(fail.length ? '❌ FAIL:\n' + fail.join('\n') : '✅ PASS');
  return fail;
})();
```

Expected: `✅ PASS` —— `activeLoadout` 對能力值嘅影響完全冇變。

- [ ] **Step 6: Commit**

```bash
cd d:/evoke/talesrunner-wardrobe
git add index.html
git commit -m "Show Avatar mode by which button is lit

In the game the two rail buttons are one toggle: Avatar lit means Avatar
mode on, role lit means it off. Draining the colour out of the whole
opposite rail was my own invention and it made the grey rail nearly
unreadable. The panels now keep their colours and only the button changes.

The mode still drives which stats count; only its presentation changed."
```

---

### Task 5: 收尾

**Files:**
- Modify: `docs/superpowers/plans/2026-07-26-wardrobe-ui-polish.md`（勾晒 checkbox）

- [ ] **Step 1: 全頁回歸測試**

硬重載之後喺 console 跑：

```js
(async () => {
  const fail = [];
  const ok = (c, m) => { if (!c) fail.push(m); };
  const total = () => document.querySelector('#gridPager .total-note')?.textContent;

  for (const cat of ['服裝','飾品','寵物','角色']) {
    document.querySelector(`[data-category="${cat}"]`).click();
    await new Promise(r => setTimeout(r, 400));
    await Promise.all([...document.querySelectorAll('img')].map(i =>
      i.complete ? Promise.resolve() : new Promise(res => { i.onload = i.onerror = res })));
    const imgs = [...document.querySelectorAll('img')];
    ok(imgs.every(i => i.naturalWidth > 0), `${cat} 有爛圖`);
    ok(!!total(), `${cat} 冇件數`);
  }
  ok(document.querySelectorAll('.rail-slot').length === 32, '兩條欄合共應該 32 格');
  console.log(fail.length ? '❌ FAIL:\n' + fail.join('\n') : '✅ PASS');
  return fail;
})();
```

Expected: `✅ PASS`

- [ ] **Step 2: 截圖存檔比對**

用瀏覽器截全頁圖，同 spec 入面嘅遊戲參考圖對照，確認四項都做咗。

- [ ] **Step 3: 勾晒 plan 嘅 checkbox 再 commit**

```bash
cd d:/evoke/talesrunner-wardrobe
git add docs/superpowers/plans/2026-07-26-wardrobe-ui-polish.md
git commit -m "Mark the UI polish plan complete"
```

---

## Self-Review

**Spec coverage：**

| Spec 章節 | 對應任務 |
|---|---|
| 1. 分頁 | Task 1 |
| 2. 子 tab | Task 2 |
| 3. 裝備欄 SVG（幾何、格位對應、空格） | Task 3 |
| 4. Avatar mode 開關 | Task 4 |
| 驗證（分頁省略號／子 tab 捲動／格位／mode） | Task 1 Step 6-7、Task 2 Step 4、Task 3 Step 6-7、Task 4 Step 4-5 |
| 風險（格位對位） | Task 3 Step 4 註明比例，Step 2 測試逐格核百分比 |
| 明確唔做（耐久條、篩選下拉、空 tab） | 冇任務 —— 正確 |

**Placeholder scan：** 冇 TBD／TODO。每個改 code 嘅步驟都有完整 code block。

**Type consistency：** `renderPager(total,pageCount)` 簽名前後一致；`pageWindow` 只喺 `renderPager` 用；`RAIL_SLOT_POS` 只喺 `renderRail` 用；`slotDefs`、`equippedItems`、`showRailTooltip`、`hideRailTooltip`、`gridPage`、`gridPager`、`hideTooltip`、`renderGrid` 全部係現有識別字，冇改名。
