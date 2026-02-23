# ASMR App (Phase1 Prototype)

## セットアップ

```bash
npm install
npm run dev
```

## 実装済み（Phase1）

- React + TypeScript + Vite のプロジェクト構成
- React Three Fiber による3Dヘッドモデル表示
- OrbitControls による回転操作（ズーム無効、角度制限あり）
- Raycast によるタッチ部位判定（耳・頭頂部・後頭部・おでこ）
- Web Audio API (`PannerNode/HRTF`) による立体音響再生
- 基本サウンドパレット（5種類）
- 横向き前提のレイアウト
