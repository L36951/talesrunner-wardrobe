# 跑Online 配裝分享器

一個以瀏覽器直接運行的《跑Online》配裝展示及分享工具。使用者可以分別設定 Avatar 與角色裝備，查看裝備能力值，並透過網址 hash 分享同一套配置。

## 本機預覽

直接開啟 `index.html`，或使用任何靜態網站伺服器：

```bash
npx serve .
```

## 分享格式

裝備選擇會即時寫入網址 hash，例如：

```text
#v=1&avatar=craft-agent-hat,craft-agent-outfit,craft-agent-shoes&role=crescent-hair,crescent-outfit,crescent-shoes&view=avatar
```

其他人打開完整連結後，頁面會還原相同嘅 Avatar 裝備、角色裝備及目前檢視模式。

## 部署

本專案為純靜態網站，將 repository 匯入 Vercel 後不需要 build command；輸出目錄使用 repository 根目錄即可。

## 聲明

本專案為非官方玩家製作的配裝分享工具，與《跑Online》及其官方營運或開發團隊無關。遊戲名稱、介面風格、物品圖片及其他相關素材的權利屬其各自權利人所有。

Repository 暫時未附加開放原始碼授權。除非另有清楚標示，第三方遊戲素材不會因存放於本 repository 而獲得任何額外授權。
