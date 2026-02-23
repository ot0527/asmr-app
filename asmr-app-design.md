# ASMR Tingles - 設計ドキュメント

## 1. プロダクト概要

**アプリ名（仮）**: ASMR Tingles  
**コンセプト**: 3Dの人間の頭部モデルをタッチ操作してASMR体験ができるインタラクティブアプリ  
**ターゲット**: ASMR愛好者、リラクゼーション目的のユーザー  
**プラットフォーム**: Web → iOS / Android（段階的展開）

---

## 2. 技術スタック

### なぜこの構成か？

「Web版で試作 → iOS/Androidに展開」という戦略に最もフィットするのは **Web技術ベース + Capacitor** の組み合わせ。理由は以下の通り。

| 選択肢 | メリット | デメリット | 判定 |
|--------|---------|-----------|------|
| **React + Three.js + Capacitor** | Webがそのまま動く。Three.jsの3D描画が強力。Web Audio APIをフル活用可能。コード共有率ほぼ100% | WebView上で動くためネイティブ比で若干の性能差 | **◎ 推奨** |
| Flutter | 高パフォーマンス、ネイティブUI | 3D描画が弱い。Web Audio APIが使えない。Dart学習コスト | △ |
| React Native | ネイティブUI、大きなエコシステム | Three.jsとの統合が面倒。Web版が別実装になる | ○ |

### 最終構成

```
┌─────────────────────────────────────────────┐
│  フロントエンド                                │
│  React 19 + TypeScript + Vite                │
├─────────────────────────────────────────────┤
│  3D レンダリング                               │
│  Three.js + React Three Fiber (@react-three) │
├─────────────────────────────────────────────┤
│  立体音響エンジン                               │
│  Web Audio API (PannerNode / HRTF)           │
├─────────────────────────────────────────────┤
│  クロスプラットフォーム                          │
│  Capacitor 7                                 │
├─────────────────────────────────────────────┤
│  サウンド収録                                  │
│  MediaRecorder API + Capacitor Microphone    │
└─────────────────────────────────────────────┘
```

---

## 3. アーキテクチャ

### 全体構成図

```
                    ┌──────────────┐
                    │   App Shell  │
                    │  (React 19)  │
                    └──────┬───────┘
                           │
            ┌──────────────┼──────────────┐
            │              │              │
     ┌──────▼──────┐ ┌────▼─────┐ ┌──────▼──────┐
     │  3D Scene   │ │  Audio   │ │  Recording  │
     │  Manager    │ │  Engine  │ │  Module     │
     │             │ │          │ │             │
     │ Three.js    │ │ Web Audio│ │ MediaRecorder│
     │ R3F         │ │ API      │ │ API         │
     │ GLB Loader  │ │ HRTF     │ │ + Capacitor │
     └──────┬──────┘ └────┬─────┘ └──────┬──────┘
            │              │              │
            └──────────────┼──────────────┘
                           │
                    ┌──────▼───────┐
                    │  Capacitor   │
                    │  (Native)    │
                    ├──────────────┤
                    │ iOS │Android │ Web
                    └──────────────┘
```

### モジュール構成

```
src/
├── app/                    # アプリのエントリ・ルーティング
│   ├── App.tsx
│   └── main.tsx
├── features/
│   ├── scene/              # 3Dシーン関連
│   │   ├── HeadModel.tsx       # 頭部3Dモデルコンポーネント
│   │   ├── SceneCanvas.tsx     # R3Fキャンバス（横向き）
│   │   ├── TouchHandler.tsx    # タッチ → 3D座標変換
│   │   └── OrbitControl.tsx    # ドラッグ回転制御
│   ├── audio/              # 音響エンジン
│   │   ├── SpatialAudioEngine.ts   # HRTFベース立体音響コア
│   │   ├── SoundBank.ts            # ASMR音源管理
│   │   ├── TriggerMapper.ts        # 頭部位置 → 音源マッピング
│   │   └── AudioMixer.ts           # ミキシング・エフェクト
│   ├── recording/          # 収録機能
│   │   ├── Recorder.ts            # 収録ロジック
│   │   ├── RecordingUI.tsx         # 収録UI
│   │   └── ExportManager.ts       # 書き出し
│   └── ui/                 # UI コンポーネント
│       ├── SoundPalette.tsx        # 音源選択パレット
│       ├── ControlPanel.tsx        # 操作パネル
│       └── SettingsDrawer.tsx      # 設定
├── core/                   # 共通基盤
│   ├── types.ts
│   ├── constants.ts
│   └── utils/
├── assets/
│   ├── models/             # GLB/GLTFヘッドモデル
│   └── sounds/             # ASMR音源ファイル
└── platform/               # プラットフォーム固有
    └── capacitor-plugins/
```

---

## 4. 機能詳細設計

### 4.1 3Dヘッドモデル表示 & 操作

**レンダリング**
- React Three Fiber でシーン構築
- GLB/GLTF形式の頭部モデルをロード（Sketchfab等から取得 or 自作）
- 画面は横向き固定（CSS `orientation: landscape` + Capacitor Screen Orientation plugin）
- ライティング: 柔らかいアンビエントライト + 正面からのキーライト（リラックス感重視）

**ドラッグ回転**
- Three.js の OrbitControls をカスタマイズ
- 水平回転（Y軸）: 自由
- 垂直回転（X軸）: -60° ～ +30° に制限（不自然な角度を防止）
- ズーム: 無効化（距離固定）
- 慣性（イナーシャ）付きでなめらかに回転

**タッチ判定（Raycasting）**

```
ユーザーのタッチ座標
    ↓
スクリーン座標 → NDC（正規化デバイス座標）
    ↓
Three.js Raycaster で3Dモデルとの交差判定
    ↓
交差点の「位置（x,y,z）」と「メッシュ名 or UV座標」を取得
    ↓
頭部の部位を特定（耳・頭頂部・後頭部 etc.）
    ↓
対応するASMR音を立体音響で再生
```

**部位マッピング方式**
- モデルのメッシュを部位ごとに分割してネーミング（`ear_left`, `ear_right`, `top`, `back`, `forehead` 等）
- または UV座標ベースでゾーン判定（メッシュ分割が難しい場合）

### 4.2 立体音響エンジン（HRTF）

**基本原理**
- Web Audio API の `PannerNode` を `panningModel: 'HRTF'` で使用
- 頭部モデル上のタッチ位置を、AudioListener基準の3D座標に変換
- 例: 左耳タッチ → PannerNode の position を `(-1, 0, 0)` 付近に設定

**AudioGraphの構成**

```
AudioBufferSourceNode (ASMR音源)
    │
    ▼
GainNode (音量制御)
    │
    ▼
PannerNode (HRTF空間定位)
    │     panningModel: 'HRTF'
    │     distanceModel: 'inverse'
    │     refDistance: 1
    │     maxDistance: 10
    │     rolloffFactor: 1
    │     position: タッチ位置に連動
    │
    ▼
AudioContext.destination (出力)
```

**タッチ位置 → 音源位置の変換ロジック**

```typescript
// 3Dモデル上のタッチ点（ワールド座標）を音源位置に変換
function touchToAudioPosition(
  intersectPoint: Vector3,  // Raycasterが返す交差点
  headCenter: Vector3,      // 頭部モデルの中心座標
  headRotation: Euler       // 頭部の現在の回転
): { x: number; y: number; z: number } {
  // 頭部中心からの相対ベクトルを計算
  const relative = intersectPoint.clone().sub(headCenter);

  // 頭部の回転を考慮して音源位置を算出
  // ユーザーの「リスナー」は常に正面を向いている前提
  // 頭部モデルが回転しても、音の定位は「頭部上の位置」に固定

  return {
    x: relative.x * AUDIO_SCALE,
    y: relative.y * AUDIO_SCALE,
    z: relative.z * AUDIO_SCALE
  };
}
```

**なぞり操作（ストローク）**
- `pointermove` イベントで連続的にRaycastし、音源位置をリアルタイム更新
- 急激な位置変化を防ぐためスムージング（lerp）を適用
- なぞる速度で音量やピッチを微調整（速い = 強い / 遅い = 優しい）

### 4.3 ASMR音源管理

**音源カテゴリ**

| カテゴリ | 音源例 | トリガー方式 |
|---------|--------|-------------|
| ささやき (Whisper) | 囁き声、ブレス音 | タップ → ループ再生 |
| タッピング (Tapping) | 指タップ、爪タップ | タップ → 単発再生 |
| スクラッチ (Scratching) | 引っかき音、こすり音 | なぞり → 連続再生 |
| ブラッシング (Brushing) | ブラシ、筆 | なぞり → 連続再生 |
| 水音 (Water) | 水滴、泡 | タップ → 単発再生 |
| 耳かき (Ear Cleaning) | 耳かき音 | なぞり → 連続再生 |
| 環境音 (Ambient) | 雨音、焚き火 | 背景ループ |

**音源フォーマット**
- WebM (Opus) をメインに使用（Web Audio APIとの相性が良い）
- フォールバック: MP3（iOS Safari対応）
- サンプルレート: 48kHz
- モノラル（空間化はPannerNodeが担当するため）

### 4.4 サウンド収録機能

**ユースケース**
- ユーザーが自分のASMRトリガー音を録音して使える
- 環境音をキャプチャして素材として使用

**技術実装**

```
Web版: MediaRecorder API + getUserMedia
iOS版: Capacitor @capacitor/microphone plugin
Android版: 同上
```

**録音フロー**

```
録音ボタンタップ
    ↓
マイク許可リクエスト（getUserMedia）
    ↓
MediaRecorder 開始
    ↓
リアルタイム波形表示（AnalyserNode）
    ↓
停止 → AudioBuffer に変換
    ↓
IndexedDB に保存（ユーザー音源ライブラリ）
    ↓
SoundBank に追加 → 3Dシーンで使用可能に
```

### 4.5 UI/UX 設計

**画面レイアウト（横向き）**

```
┌─────────────────────────────────────────────────────────┐
│  ┌──────┐                                    ┌────────┐ │
│  │Sound │     ┌─────────────────────┐        │Control │ │
│  │Palet │     │                     │        │ Panel  │ │
│  │ tte  │     │   3D Head Model     │        │        │ │
│  │      │     │                     │        │ 🔴 REC │ │
│  │ 🔊🔊 │     │   (ドラッグで回転)    │        │ ⚙ 設定 │ │
│  │ 🔊🔊 │     │   (タップでASMR)     │        │ 🎵 BGM │ │
│  │ 🔊🔊 │     │                     │        │        │ │
│  │      │     └─────────────────────┘        │        │ │
│  └──────┘                                    └────────┘ │
│  ◀ ▷ 音源カテゴリ切替                                     │
└─────────────────────────────────────────────────────────┘
```

**操作体系**

| 操作 | 頭部モデル上 | 空白領域 |
|------|-------------|---------|
| 1本指ドラッグ | なぞりASMR再生 | 頭部モデル回転 |
| 2本指ドラッグ | — | 頭部モデル回転 |
| タップ | 単発ASMR再生 | — |
| ロングプレス | ループASMR再生 | — |

※ 1本指ドラッグで「なぞり」と「回転」が競合するので、以下のどちらかで対処：
- **案A**: モデル上は常にASMR。回転は2本指 or 余白ドラッグ **← 推奨**
- 案B: トグルで「操作モード」と「演奏モード」を切替

---

## 5. データフロー

### タッチ → 音再生の流れ

```
[Touch Event]
    │
    ▼
[SceneCanvas] pointer event を検知
    │
    ▼
[TouchHandler] Raycaster でモデルとの交差判定
    │  - 交差点の座標 (Vector3)
    │  - 交差したメッシュ名 (部位)
    │  - UV 座標
    ▼
[TriggerMapper] 部位 + 選択中の音源カテゴリ → 再生する音源を決定
    │
    ▼
[SpatialAudioEngine]
    │  - AudioBufferSourceNode を生成
    │  - PannerNode に位置設定
    │  - GainNode で音量設定
    │  - 再生開始
    ▼
[AudioContext.destination] → ヘッドフォンへ出力
```

### 収録フロー

```
[録音ボタン] → [Recorder]
    │
    ▼
getUserMedia({ audio: true })
    │
    ▼
MediaRecorder → Blob → AudioBuffer
    │
    ▼
IndexedDB に保存
    │
    ▼
[SoundBank] に追加 → UIに反映
```

---

## 6. 開発ロードマップ

### Phase 1: Web プロトタイプ（MVP）〜 4-6週間

- [ ] プロジェクトセットアップ（Vite + React + TypeScript）
- [ ] 3Dヘッドモデル表示（React Three Fiber）
- [ ] ドラッグ回転の実装
- [ ] タッチ → Raycast → 部位判定
- [ ] Web Audio API による HRTF 立体音響再生
- [ ] 基本的な音源パレット（5-10種類）
- [ ] 横向きレイアウト

### Phase 2: 機能強化 〜 3-4週間

- [ ] なぞり操作の実装（連続再生 + スムージング）
- [ ] 音源カテゴリの拡充（30種類以上）
- [ ] 録音機能（MediaRecorder API）
- [ ] ユーザー音源のインポート/管理
- [ ] 環境音BGM（雨、焚き火等）
- [ ] UI/UXの磨き込み

### Phase 3: ネイティブ展開 〜 2-3週間

- [ ] Capacitor セットアップ
- [ ] iOS ビルド & 調整（Safari WebView固有の問題対応）
- [ ] Android ビルド & 調整
- [ ] ネイティブプラグイン統合（マイク権限、画面回転ロック）
- [ ] ストア提出準備

### Phase 4: 成長機能（将来）

- [ ] ユーザー間での音源共有
- [ ] 複数のヘッドモデル（キャラクター）
- [ ] AI音源生成（テキスト → ASMR音）
- [ ] セッション録画 & 再生（操作ログごと保存）
- [ ] Apple Spatial Audio / Dolby Atmos 対応

---

## 7. 技術的注意点

### Web Audio API の注意点
- **iOS Safari**: ユーザーインタラクション（タップ等）が無いと `AudioContext` が起動しない。初回タップで `audioContext.resume()` が必要
- **Chrome**: 同様に自動再生ポリシーあり。初回操作後に resume する設計にする
- **HRTF品質**: ブラウザ内蔵のHRTFはブラウザごとに実装が異なる。高品質を求める場合は、IRCAMのカスタムHRTFデータセットを ConvolverNode で畳み込み処理する方法もある

### 3Dモデルの最適化
- ポリゴン数はモバイル考慮で 10K-50K faces に抑える
- テクスチャは 1024x1024 まで（モバイルGPUメモリ節約）
- GLB形式（バイナリGLTF）で配信してロード時間短縮
- Draco圧縮を検討

### Capacitor 固有
- WebView内のWeb Audio APIはネイティブと比べてレイテンシが大きい場合あり
- 録音機能はCapacitorプラグイン `@capacitor/microphone` で権限管理
- 画面回転ロックは `@capacitor/screen-orientation` プラグイン

### パフォーマンス目標
- 60fps（3Dレンダリング）
- 音声レイテンシ: < 50ms（タッチ → 発音）
- 初回ロード: < 3秒（音源はオンデマンドロード）

---

## 8. 3Dモデルの入手先候補

| ソース | 形式 | ライセンス | 備考 |
|--------|------|-----------|------|
| Sketchfab | GLB/GLTF | CC系 | 無料のHead Base Meshあり |
| Meshy AI | GLB | 独自 | AIで生成可能 |
| Free3D | OBJ→変換 | 個別 | 要Blenderで変換 |
| 自作 | GLB | 自由 | Blenderで頭部モデリング推奨 |

**推奨**: Sketchfabの無料ヘッドモデル（CC0 or CC-BY）をベースに、Blenderで部位分割 + 最適化してGLBエクスポート

---

## 9. 依存ライブラリ一覧

```json
{
  "dependencies": {
    "react": "^19.x",
    "react-dom": "^19.x",
    "@react-three/fiber": "^9.x",
    "@react-three/drei": "^10.x",
    "three": "^0.172.x",
    "zustand": "^5.x",
    "@capacitor/core": "^7.x",
    "@capacitor/cli": "^7.x",
    "@capacitor/ios": "^7.x",
    "@capacitor/android": "^7.x",
    "@capacitor/microphone": "^7.x",
    "@capacitor/screen-orientation": "^7.x",
    "idb-keyval": "^6.x"
  },
  "devDependencies": {
    "typescript": "^5.x",
    "vite": "^6.x",
    "@vitejs/plugin-react": "^4.x"
  }
}
```

---

## 10. 次のステップ

1. **今すぐ**: Vite + React + R3F でプロジェクト初期化
2. **Day 1-3**: GLBヘッドモデルを画面に表示 + ドラッグ回転
3. **Day 4-7**: Raycast タッチ判定 + Web Audio API の HRTF 再生
4. **Day 8-14**: 音源パレット + なぞり操作 + UI整備
5. → **2週間でWeb版のプレイアブルプロトタイプ完成**
