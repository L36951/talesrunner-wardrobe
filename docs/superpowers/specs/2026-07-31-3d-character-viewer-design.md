# 3D 角色預覽

喺配裝器嘅角色房間中間顯示所選角色嘅 3D 模型。第一版只支援 6 個角色。

## 目標

`.room` 中間目前係空嘅（現有 `.no-model` class 就係為咗呢個位而留）。
放一個靜態 3D 角色入去，揀角色時換模型。

**唔包括**：跟裝備欄換 mesh、旋轉／縮放、動畫。呢啲全部係日後嘅事，
但資產格式（glTF）刻意揀成日後加得落去。

## 範圍：6 個角色

| id | 角色 |
|---:|---|
| 1 | 光光 |
| 44 | Keroro |
| 45 | Tamama |
| 46 | Giroro |
| 47 | Kururu |
| 48 | Dororo |

50 個角色全部 render 過，只有呢 6 隻完整冇瑕疵。其餘角色嘅「基本造型」
客戶端冇統一定義 —— 部件散落喺唔同 `.pt1`、頭部有時拆三件（頭皮／髮型／髮飾）、
mesh 有時要 `_1` 後綴。逐個都要人手對住遊戲截圖核對，唔係跑 script 就得。
詳見 `talesrunner-manifest/data-dictionary/40_model_formats.md`。

日後加角色 = 人手確認咗邊幾件之後，加入生成器嘅角色表，重跑。

## 一、資產生成（離線，喺 repo 外）

生成器：`D:\evoke\talesrunner-tools\wardrobe\build_models.py`
（同 `build_items.py` 並排。解包相關嘅嘢一律唔入公開 repo。）

```bash
python build_models.py            # 出全部 6 隻
python build_models.py --char 1   # 淨係出光光
```

每個角色做四件事：

1. **砌部件清單** — 由一張寫死嘅表攞（mesh 檔名 + 貼圖檔名），
   唔用推導。呢張表係人手核對過嘅結果。
2. **擺 pose** — 讀 `<prefix>_set.ca3` 攞骨架同 bind pose、
   `stand_ready.a1` 攞第 0 幀，做 linear blend skinning，
   **姿勢直接燒入頂點座標**。glb 唔帶骨骼。
3. **導出 glb** — 每個角色一個檔，含 `POSITION` / `NORMAL` / `TEXCOORD_0` / indices。
   NORMAL 一定要有，three.js 靠佢做 smooth shading（冇嘅話低多邊形會起晒角）。
4. **轉貼圖** — 由 `talesrunner-png` 攞（extract 入面嗰啲 `.png` 其實係 DDS），
   轉 webp。

輸出：

```
assets/model/char/1.glb    …  6 個，每個約 60 KB
assets/model/char/1/*.webp …  貼圖，每隻約 80 KB
data/models.json           …  manifest
```

`models.json`：

```json
{ "characters": { "1": "char/1.glb", "44": "char/44.glb" } }
```

**點解另開 manifest 唔塞落 `items.json`**：`items.json` 由 `build_items.py` 生成，
兩個生成器各自管自己輸出。而且支援嘅角色清單會隨住人手核對而變，
獨立一個細檔改起上嚟唔會動到 16,001 件裝備嘅主資料。

**規模**：約 1 MB。repo 由 68 MB 變約 70 MB。

## 二、前端

### three.js 引入

vendored 落 `assets/vendor/`，用 `<script type="importmap">` 指過去。

```html
<script type="importmap">
{ "imports": {
    "three": "/assets/vendor/three.module.min.js",
    "three/addons/": "/assets/vendor/three-addons/" } }
</script>
```

**點解唔用 CDN**：repo README 寫住「直接開啟 index.html」就用得，CDN 會令呢句唔成立；
用戶係港澳台玩家，unpkg / esm.sh 可達性係真風險。代價 700 KB，
相對 68 MB 嘅 icon 等於 1%。

**點解唔加 bundler**：呢個 repo 一個 dependency 都冇、冇 build step，
`vercel.json` 就係 `{"outputDirectory": "."}`。唔想為咗一個功能改成要 build。

### Viewer

`scripts/lib/model-catalog.mjs`（可測邏輯，純函數）：

- `modelPathFor(characterId, manifest)` → glb 路徑或 `null`
- `isSupported(characterId, manifest)`

`index.html` 內嘅 viewer（跟現有風格，JS inline）：

- canvas 絕對定位入 `.room`，`z-index` 喺 rail 之下
- 揀角色 → 查 manifest → 冇就收起 canvas、顯示現有文字提示
- 有就 `GLTFLoader` 載入 → 換 scene → **render 一幀就停**（唔行 render loop）
- 載過嘅 glb 記住喺 Map，唔重複下載

相機：正交，固定正面。角色面向 +X，即係相機擺喺 +X 望向 −X。

### UI 位置

角色圖高度約 300 px，置中。現有兩個元素壓住個位，要挪：

- `#shareLoadoutBtn`（`top:282`）
- `#targetHint`（`top:330`）

移去 `.room` 底部。呢兩個係功能性元件，唔可以刪。

## 三、錯誤處理

| 情況 | 行為 |
|---|---|
| 角色唔喺 manifest（44 個） | 唔顯示 canvas，保留現有文字提示 |
| WebGL 唔支援 | 同上，唔報錯 |
| glb 載入失敗 | 同上，`console.warn` |

一律靜靜回落現有介面 —— 呢個功能係加分項，唔應該整爛原本用得好地地嘅配裝器。

## 四、測試

跟 repo 現有做法（`node --test tests/*.test.mjs`，81 個測試）。

`tests/model-catalog.test.mjs`：

- 支援嘅角色 → 攞到啱嘅路徑
- 唔支援嘅角色 → `null`
- manifest 缺失／壞格式 → 唔會拋錯
- 全部 6 個 id 都喺 manifest 入面

WebGL render 本身唔做單元測試（要真 GPU），改為手動驗：起 server 開頁面，
逐個角色㩒一次，睇模型換唔換到。

## 五、已知限制

- 只支援 6 / 50 個角色
- 靜態一幀，唔郁
- 貼圖用 diffuse + Lambert，冇做遊戲原本嘅 toon ramp（`toon.png` 未用）
- 姿勢燒死咗，要改姿勢就要重跑生成器
