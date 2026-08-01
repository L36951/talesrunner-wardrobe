# 配裝工具：撳左欄裝備，櫥櫃翻去嗰一版

2026-08-01

左邊 Avatar／角色兩欄嘅已著裝備格，撳落去會令右邊櫥櫃翻到嗰件裝備所在嘅
分類／子tab／頁，並且喺卡片上面閃一閃。

## 背景

`renderRail`（`index.html:616-638`）出嘅每個 `.rail-slot` 已經帶住
`data-item-id`，亦已經 `tabindex="0"`，但**只掛咗 hover／focus 嘅 tooltip
listener**（`index.html:632-637`）—— 撳落去乜都唔會發生。

呢個空白喺實際使用上係有代價嘅。櫥櫃一版 16 格（`PAGE_SIZE`，`index.html:269`），
單係「服裝／上衣」一個子tab，一隻角色著得到嘅就有 1,242 件、78 版。
用家喺左欄見到件著咗嘅嘢，想返去櫥櫃搵佢（睇 tooltip 全文、卸下、或者睇隔籬
同款），而家要自己記返佢喺邊個分類、然後揭版。

## 範圍

只改 `index.html` 同新增一個測試檔。唔改 `data/items.json`、唔改 build script、
唔改靜態套裝頁。

明確唔做：

- **唔做去 `/set/…` 靜態頁嘅跳轉。** 呢個站冇單件裝備嘅獨立頁，只有 1,978 個
  套裝頁。由 SPA 跳出去係另一個議題（離開配裝狀態、返唔返到嚟），唔喺本次範圍。
- **唔寫入 URL。** 現有 hash schema（`v/char/avatar/role/view`，
  `applySharedLoadout`，`index.html:311`）係配裝分享專用。加個 `focus=` 落去
  等於要答「分享出去之後嗰個 focus 仲有冇意思」，同本功能無關。
- **唔改撳格以外嘅 rail 行為。** tooltip 照舊 hover 出、`mouseleave` 收。
- **唔郁 `wearGroup` 資產推斷層**（2026-07-31 已決定唔郁）。本功能只係消費
  `blockedForSelected` 呢個結論。

## 一：撳落去做乜

| 撳咩 | 行為 |
|---|---|
| 有裝備嘅格 | 翻去嗰件裝備嗰一版 |
| 「×」被佔用格（例如一件全身裝佔六格）| 翻去**佔用嗰件**嗰一版 |
| 空格 | 唔做嘢 |

被佔用格唔使特別處理 —— `index.html:630` 出 `data-item-id` 嗰陣本身就已經係
佔用嗰件嘅 id，同 tooltip 講嘅「被 X 佔用」一致。

鍵盤：`.rail-slot` 已經 `tabindex="0"`，所以照 `.item-card` 嗰隻做法
（`index.html:813`）補 Enter／Space，同 click 行同一支函數。

**搜尋框有字嘅話一律清走**，回到分類瀏覽模式。理由：搜尋模式係跨分類 filter
（`index.html:732` 條件分支），保留搜尋就要答「件嘢唔喺搜尋結果入面點算」，
兩條分支各有各嘅頁數。一律清走，行為永遠一致。清嘅時候
`equipmentSearch.value` 同 `searchQuery` 兩樣都要清 —— 只清變數嘅話輸入框
會留住舊字，用家會以為個 filter 仲生效緊（參考 `index.html:866` 嘅 Escape
處理，佢兩樣都清）。

## 二：兩支純函數

跟返 `planWearSet`／`setMemberRows`（`index.html:380-408`）嗰個做法：
**頂層 function、縮排四格、冇 closure 依賴**，所有外部嘢（`selectedCharacter`、
`blockedForSelected`）由參數傳入。噉 `tests/` 先可以由 source 抽返出嚟真係跑，
唔使齋斷言 source pattern。

```js
// 櫥櫃實際見到邊幾件。renderGrid 同 locateItem 共用同一支。
function visibleItemsIn(list,{category,subtab,query,character,isBlocked})

// 件裝備喺櫥櫃邊一版。搵唔到回 null。
function locateItem(list,item,{character,isBlocked,pageSize})
  → {category,subtab,page} | null
```

`visibleItemsIn` 就係 `renderGrid`（`index.html:727-735`）現有嗰段 filter
原封不動搬出嚟：角色專屬（`item.character!==0`）→ `isBlocked` → 有 query 就
跨分類搜全文、冇 query 就 `category` ＋ `subcategory` 對位。

**`renderGrid` 必須改成叫呢支，唔可以留返自己嗰份。** 兩份 filter 一日唔同步，
「第幾版」就會計錯，而且係靜靜哋錯 —— 跳完去到一版，件嘢唔喺度。呢個係本設計
最主要嘅改動理由，唔係順手重構。

`locateItem` 用件裝備自己嘅 `category`／`subcategory` 做目標 tab，`query` 當空，
喺結果度 `findIndex`，`Math.floor(index/pageSize)` 就係頁碼。

**分類永遠對得返。** 2026-08-01 實測：有 `slots` 嘅裝備（即會喺 rail 出現嗰啲）
攤開得 15 個 `category / subcategory` 組合，全部喺 `subtabsByCategory`
（`index.html:259-263`）入面搵得返，冇孤兒。順帶亦保證 rail 上件裝備嘅
`category` 只會係服裝／飾品／寵物三者之一，**永遠唔會係「角色」**，所以撞唔到
`renderGrid` 開頭嗰句 `if(selectedCategory==='角色')` 早退（`index.html:725`）。
呢兩件事都要有測試守住，因為佢哋係上游資料嘅性質，唔係代碼保證。

## 三：`revealItem(id)`

唯一掂狀態嗰支，順序寫死：

1. `locateItem(...)` → `null` 就 `notify` 一句，**唔郁任何狀態**，收工（見第五節）
2. 清 `equipmentSearch.value` ＋ `searchQuery`
3. set `selectedCategory` / `selectedSubtab` / `gridPage`
4. `syncCategoryTabs()`（見下）、`hideRailTooltip()`
5. `renderSubtabs()` ＋ `renderGrid()`
6. **render 完之後**先喺新出嗰張卡加 `.revealed`

⚠️ 第 6 步嘅次序係硬性嘅。`renderGrid` 每次都成塊 `grid.innerHTML=` 重建
（`index.html:759`），早過佢加 class 會即刻俾人洗走。

唔叫 `renderAll()` —— 左欄、能力值、3D 模型全部冇變，冇必要重畫。
`renderSubtabs` 內部已經叫咗 `positionSubtabs()`（`index.html:664`），
子tab 會自己捲到啱位，唔使另外處理。

`syncCategoryTabs()`：分類 tab 加 `.active` 嗰句而家 inline 喺 tab 嘅 click
handler 入面（`index.html:871`），要抽做函數畀兩邊叫。唔抽嘅話跳完之後
櫥櫃內容係「飾品」但頂上高亮住嘅仍然係「服裝」。

## 四：閃燈

`.item-card.revealed` 一個 2 秒 `forwards` 嘅動畫，發光邊框自己淡走。

用純 CSS animation、唔留長期狀態，係因為 `.revealed` 唔係一個「選中」概念 ——
grid 一重畫（換版、搜尋、切角色、著／卸任何一件）張卡就冇咗，留住個 class
就要喺以上每條路徑度記得清走佢。閃完即散冇呢個負擔。

## 五：搵唔到嗰陣

`locateItem` 回 `null` 係一條真係行得到嘅路，唔係防禦死碼 —— 入口係**分享 link**。

`applySharedLoadout`（`index.html:311-325`）由 hash 讀配裝嗰陣，淨係 check 個 id
查唔查得到、同已收嘅 slot 撞唔撞位，**完全冇過 `blockedForSelected`**。所以一條
帶住「呢隻角色著唔到」嘅裝備 id 嘅 link，打開之後左欄會照顯示，而櫥櫃係濾走佢嘅
（`index.html:731`）—— 根本冇一版有佢。

2026-08-01 實測：`#v=1&char=13&avatar=140946,…`（阿貝爾 ＋ 聖言小丑組合 8 件）
一開，rail 8 格全亮，8 件全部 `blockedForSelected` 為真。

⚠️ **唔好以為換角色都會製造呢個狀態** —— `pickCharacter`（`index.html:888`）行
`equipped.avatar={};equipped.role={}`，轉角色係清晒重新著過嘅。呢份 spec 初稿寫錯咗
呢一點，實測先發現。

呢時**唔可以靜靜哋乜都唔做**。出一句 `notify`（`index.html:310`）：

```
「{裝備名}」{角色名}著唔到，櫥櫃唔會列出
```

角色名攞 `characters[selectedCharacter]?.name`，攞唔到就用「呢隻角色」墊底 ——
同 `wearWholeSet` 嘅 skipped 文案（`index.html:790`）同一個寫法。
同嗰句「呢套喺角色欄先生效」
（`index.html:794-796`）同一個路數：一個「唔郁」嘅決定要講返出嚟，否則同壞咗
一模一樣。

## 六：測試

新增 `tests/reveal-item.test.mjs`，用 `tests/wear-set.test.mjs` 嘅 `loadFn`
（同一份，由 `index.html` source 抽頂層 function 出嚟 `new Function` 跑）。
新函數要跟足「縮排四格、收尾一行 `    }`」，否則抽唔到。

| # | 測試 | 類型 | 守住乜 |
|---|---|---|---|
| 1 | 第 16 件 → page 0、第 17 件 → page 1 | 純函數 | 分頁邊界，off-by-one |
| 2 | 前面夾住第二隻角色專屬嘅裝備，唔計入 index | 純函數 | 頁數要用**濾完**嘅清單計，唔係原始清單 |
| 3 | `isBlocked` 濾走件嘢 → 回 `null` | 純函數 | 第五節嗰條路 |
| 4 | item 唔喺 list → 回 `null` | 純函數 | 唔會回 `page:-1` 咁跳去負數版 |
| 5 | 有 query 嗰陣係跨分類搜，唔理 category/subtab | 純函數（直接測 `visibleItemsIn`；`locateItem` 永遠傳空 query）| 搬 filter 冇搬漏搜尋分支 |
| 6 | 有 `slots` 嘅裝備，`category/subcategory` 全部喺 `subtabsByCategory` 入面 | 資料 | 第二節嗰個「永遠對得返」嘅前提 |
| 7 | 有 `slots` 嘅裝備冇一件 `category==='角色'` | 資料 | 撞唔到 `renderGrid` 嘅角色早退 |

老實講個限制：`renderGrid` 改用 `visibleItemsIn` 之後，**佢本身係純 DOM，
上面冇一條測試守得住佢**。呢個改動要靠瀏覽器實測頂：跳正常情況、搜尋狀態下跳、
切角色令裝備變 blocked 之後撳。三個 case 都要行過先算完。

## 唔喺呢份 spec 但已知嘅嘢

- `renderGrid` 同 `renderCharacterGrid`（`index.html:699-723`）係兩個唔同嘅
  grid，各有各嘅分頁。本功能只掂前者，理由見第二節（rail 上冇角色）。
- `data-item-id` 喺空格度係空字串（`index.html:630`），唔係 `undefined`。
  判斷要當空字串處理。
