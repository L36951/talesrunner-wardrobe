# 配裝工具：套裝成員清單同「著晒成套」

2026-07-31

將遊戲背包入面兩個同套裝有關嘅行為搬入配裝工具：

1. 裝備 tooltip 最底列出**同套成員**，著咗嘅綠色、未著嘅灰色
2. 裝備卡片上面一粒掣，**一次過著晒同套裝備**

兩樣都係跟返《跑Online》客戶端本身嘅做法，唔係新發明。

## 背景

`index.html` 而家喺 tooltip 度已經出咗套裝名、生效狀態、成套加成同組合加成
（`getSetTooltipMarkup`）。**唯一欠嘅係「跟住仲爭邊幾件」** —— 用家見到
「・未生效」但唔知去邊度搵餘下嗰幾件。遊戲入面呢個資訊就喺同一個 tooltip 最底。

卡片方面，`index.html` 嘅 `.card-actions` 有兩粒掣：「穿著」同一粒 disabled 嘅
「快捷」。遊戲入面**啱啱就係喺第二粒掣嘅位置**擺「著晒成套」。即係位已經留好咗。

呢個功能對得住網站現有嘅套裝資料規模：1,980 個套裝，1,520 個有成套加成、
222 個有組合加成、7,957 件裝備屬於某個套裝。

## 範圍

只改 `index.html`（SPA 內部）同新增一個測試檔。

**唔改** `data/items.json`、唔改 `build_items.py`、唔改靜態套裝頁
（`scripts/lib/render-set.mjs` 嗰套）。所需資料全部已經喺 `items.json` 度，
而且 `index.html:198` 已經 build 好 `setMembers[setId]`。

明確唔做：

- **唔郁 `wearGroup` 資產推斷層。** 呢層封裝備嘅準確度係一個獨立議題
  （日奈森亞夢因此被封 86% 裝備），2026-07-31 已決定唔郁。本功能只係
  **消費**「邊件著得到」呢個結論，唔負責改善佢。
- 成員清單**唔做得撳**。個 tooltip 係 `mouseenter` 出、`mouseleave` 收
  （`index.html:722-723`），要做 clickable 就要重寫成套 hover 生命週期，
  同遊戲亦都唔一致（遊戲嗰個都係純顯示）。
- 唔加「卸下成套」以外嘅批次操作（例如「著晒收藏」）。

## 一：Tooltip 成員清單

接喺 `getSetTooltipMarkup` 產生嘅 `.tooltip-set` 最底，即組合加成之後 ——
同遊戲一樣擺最底。

每個成員一行，三個狀態：

| 狀態 | 判斷 | 樣式 |
|---|---|---|
| 已著 | `equipped[definition.equipmentType][item.id]` | 綠 `#54f258` |
| 未著 | 以上唔成立，而且著得到 | 灰 `#8b8d94` |
| 呢隻角色著唔到 | `blockedForSelected(item)` | 灰 ＋ `✗` 前綴 |

**「已著」一定要用套裝自己嘅 `equipmentType` 嗰欄，唔可以用 `activeLoadout`。**
理由同 `isSetActive`（`index.html:365`）一致：一個 avatar 套裝淨係喺 Avatar 欄
著齊先會生效。用錯欄，個清單就會同上面嗰句「・生效中／・未生效」互相矛盾。
`getSetTooltipMarkup` 現有嘅 `wornSlotsForSet` 已經係咁做，跟返佢。

### 一個一定會踩到嘅陷阱

`index.html:49` 有：

```css
.tooltip-set.inactive{filter:grayscale(1);opacity:.58}
```

套裝未生效嗰陣，成個 `.tooltip-set` 會去色 —— 即係「已著咗其中一件」呢個綠色訊息
**喺最需要見到嗰陣反而消失**（套裝未齊先至要睇仲爭邊件）。

所以成員清單必須豁免嗰個 filter。

⚠️ **子元素撤銷唔到祖先嘅 `filter`** —— `filter` 落喺祖先度會 rasterize 成個
subtree，後代寫 `filter:none` 冇用。所以唯一做法係**收窄 `.inactive` 規則本身**，
唔好落喺容器度：

```css
/* 由：.tooltip-set.inactive{filter:grayscale(1);opacity:.58}     */
/* 改成：                                                          */
.tooltip-set.inactive>b,.tooltip-set.inactive>span{filter:grayscale(1);opacity:.58}
```

噉套裝標題同能力值照樣去色，但 `.tooltip-members`（一個 `<div>` 子元素）唔受影響。
**測試要守住「`.tooltip-set.inactive` 唔可以有 `filter`／`opacity`」**。

## 二：「著晒成套」按鈕

`index.html:704` 現時：

```js
<button class="disabled">快捷</button>
```

改成三態：

| 情況 | 掣 |
|---|---|
| 件裝備冇 `setId`（或者 `setDefs` 查唔到）| 維持 disabled「快捷」，外觀完全唔變 |
| 有套裝、未著晒 | 可撳，「著晒成套」|
| 有套裝、已著晒 | 可撳，「卸下成套」|

「已著晒」＝該套全部**著得到**嘅成員都已經喺 `activeLoadout` 度著咗。
著唔到嗰啲唔計入分母，否則喺得 1/4 件著得到嘅套裝度粒掣會永遠停喺「著晒成套」。

⚠️ **粒掣同上面個成員清單係睇唔同嘅欄，呢個係故意嘅，唔好夾佢哋一致：**

| | 睇邊欄 | 點解 |
|---|---|---|
| 成員清單嘅綠／灰 | 套裝嘅 `equipmentType` | 要同 `isSetActive` 出嘅「・生效中」對得上 |
| 粒掣嘅「已著晒」 | `activeLoadout` | 粒掣改嘅就係嗰欄，掣面必須反映佢自己會做乜 |

兩者喺 `activeLoadout` ≠ 套裝生效欄嗰陣會唔同步 —— 例如成員全綠（Avatar 欄著齊）
但粒掣仍然寫「著晒成套」（角色欄未著）。呢個唔係 bug，係「唔自動切欄」呢個決定
嘅必然結果，靠 notify 嗰句提示補返。**見到就將其中一邊改去跟另一邊，反而會整爛
「生效中」嘅正確性。**

### 行為

**入邊個欄**：`activeLoadout`，即係用家而家揀緊嗰欄。**唔自動切欄。**

呢個係刻意嘅決定。代價係：如果套裝喺另一欄先生效，著完之後
`isSetActive` 唔會亮，用家會以為壞咗。**所以 notify 必須補一句提示**，例如
「呢套喺 Avatar 欄先生效」。冇咗嗰句提示，呢個決定就會變成一個 bug。

**著唔到嘅成員**：跳過，唔報錯。`blockedForSelected(item)` 為真就 skip。

**撞位**：逐件沿用 `toggleEquipment`（`index.html:711`）現有嘅規則 ——
卸走 `activeLoadout` 入面同部位嘅舊裝備。成員之間理論上唔會互撞，
但唔好假設，照逐件行同一套邏輯。

**收尾**：改完先 `syncLoadoutUrl()` → `notify(...)` → `hideTooltip()` → `renderAll()`，
即係同 `toggleEquipment` 收尾一致，一次過 render，唔好逐件 render。

### notify 文案

- 全部著到：`已著「{套裝名}」4/4 件`
- 有跳過：`已著「{套裝名}」1/4 件・3 件{角色名}著唔到`
- 套裝生效欄同 `activeLoadout` 唔同，另加一句：`呢套喺 Avatar 欄先生效`
- 卸下：`已卸下「{套裝名}」4 件`

## 三：測試

新增 `tests/wear-set.test.mjs`。

呢度要老實講個限制：本功能嘅邏輯住喺 `index.html` 嘅 classic script 入面
（噉樣 `file://` 直接開都用得），**`import` 唔到，跑唔到**。所以只可以行
`tests/stat-cap.test.mjs` 同一套做法 —— 驗 `index.html` 嘅 source pattern，
加上驗真實資料嘅不變式。

| # | 測試 | 類型 | 守住乜 |
|---|---|---|---|
| 1 | 混合可著性嘅套裝仍然存在（2026-07-31 實測 419 / 1,980）| 資料 | 「跳過著唔到成員」唔係防禦死碼，係真係行到嘅路徑 |
| 2 | 每個 `item.setId` 都有對應 `setDefs` entry | 資料 | 粒掣唔會喺查唔到套裝時炸 |
| 3 | 全部 `comboStats` 都係 2 件（2026-07-31 實測 672 條）| 資料 | 組合加成嘅假設冇被上游改走 |
| 4 | 成員清單 markup 唔受 `.inactive` 嘅 `grayscale(1)` 影響 | source | 上面講嗰個陷阱 |

第 4 條係 source 斷言，比較脆。保留佢係因為佢守嘅嘢**冇第二個方法守得住**，
而且係一個實際會靜靜雞壞掉、又唔會有人為意嘅回歸。

第 1 條嘅 419 唔應該寫死做精確數字 —— 上游 patch 之後會浮動。斷言
「大於 0」就夠，數字寫喺註解度做參考。

## 唔喺呢份 spec 但已知嘅嘢

- `setDefs[].special` 由 `index.html:193` 起就永遠係 `[]`，
  tooltip 入面渲染佢嗰段係死碼。唔喺本次範圍，但改 `getSetTooltipMarkup`
  嗰陣會見到，唔好誤會佢有嘢做。
- 套裝生效欄同成員 `equipmentType` 可以唔同（`tests/set-combos.test.mjs`
  有真實資料嘅回歸測試守住）。本功能全程用**套裝**嘅 `equipmentType` 判斷，
  唔好中途攞件裝備嘅嚟用。
