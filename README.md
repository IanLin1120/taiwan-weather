# 台灣即時天氣預報

- 🌐 網頁版：https://ianlin1120.github.io/taiwan-weather/
- 📱 Android APK：[`apk/`](apk/) 資料夾（`apks.json` 列出所有版本）

## 線上更新怎麼運作

| 檔案 | 用途 |
|---|---|
| `index.html` | 整個 App（網頁版直接執行；APK 開啟時會下載這個檔案來更新介面與功能） |
| `version.json` | `app`＝介面版本、`minApk`＝需要的最低 APK 版本號（versionCode）、`notes`＝更新說明 |

- **小改版**（只改介面、功能）：更新 `index.html` 和 `version.json` 的 `app`，`minApk` 不變 → 手機開 App 時自動下載套用，不用重裝。
- **大改版**（Android 原生程式有改）：`minApk` 改成新 APK 的 versionCode，並在 Releases 發布新 APK → 手機會提示下載新版 APK。
- 每個版本的 APK 都放在 `apk/` 資料夾並記錄在 `apks.json`，App 裡「設定 → 版本與更新 → 下載 APK 到手機」可以選最新版或任一舊版本。

## 原始碼
`src/`：網頁（web/）與 Android 外殼（android/）。簽章金鑰不放在這裡。
