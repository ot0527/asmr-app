# ASMR App (Phase3 Android対応準備)

## 前提環境

- Node.js `v24.12.0`
- npm `11.x`
- Android Studio（Windows 64-bit）

## セットアップ

```bash
npm install
```

## Windows環境構築（エミュレータ起動まで）

### 1. Android Studioをインストール

1. Android Studio for Windows（64-bit）をインストールする。
2. 初回セットアップウィザードで推奨コンポーネントを導入する。

### 2. Android SDKの場所を設定

Android Studioの `SDK Manager` で SDK Location を以下に設定する。

```text
C:\Users\<Windowsユーザー名>\AppData\Local\Android\Sdk
```

### 3. SDKコンポーネントをインストール

`SDK Manager` で最低限以下を入れる。

- Android SDK Platform（API 24以上。推奨は最新安定API）
- Android SDK Build-Tools
- Android SDK Platform-Tools
- Android Emulator
- Android SDK Command-line Tools (latest)

### 4. Windows環境変数を設定

システム環境変数を以下のように設定する。

- `ANDROID_HOME` = `C:\Users\<Windowsユーザー名>\AppData\Local\Android\Sdk`
- `ANDROID_SDK_ROOT` = `C:\Users\<Windowsユーザー名>\AppData\Local\Android\Sdk`

`Path` に次を追加する。

- `C:\Users\<Windowsユーザー名>\AppData\Local\Android\Sdk\platform-tools`
- `C:\Users\<Windowsユーザー名>\AppData\Local\Android\Sdk\emulator`
- `C:\Users\<Windowsユーザー名>\AppData\Local\Android\Sdk\cmdline-tools\latest\bin`

環境変数の反映後、新しいターミナルを開く。

### 5. プロジェクトをAndroid向けに同期

```bash
npm install
npm run cap:sync
npm run android:open
```

### 6. エミュレータを作成して起動

Android Studioで以下を実行する。

1. `Device Manager` を開く
2. `Create Device` で端末（例: Pixel）を選ぶ
3. システムイメージ（API 24以上）を選ぶ
4. AVD作成後、起動ボタン（▶）でエミュレータを起動する

### 7. エミュレータ接続確認

```bash
adb devices
```

`emulator-xxxx    device` が表示されれば準備完了。
その後、次でアプリを起動できる。

```bash
npm run android:run
```

## Web版を起動

```bash
npm run dev
```

## Android版を起動

```bash
# Webビルドを反映してAndroid同期
npm run cap:sync

# Android Studioを開く
npm run android:open
```

## 実装済み

- React + TypeScript + Vite のプロジェクト構成
- React Three Fiber による3Dヘッドモデル表示
- OrbitControls による回転操作（ズーム無効、角度制限あり）
- Raycast によるタッチ部位判定（耳・頭頂部・後頭部・おでこ）
- Web Audio API (`PannerNode/HRTF`) による立体音響再生
- ユーザー録音・音源インポート（MediaRecorder + IndexedDB）
- Capacitor導入（Androidプラットフォーム追加済み）
- `@capacitor/screen-orientation` によるネイティブ時の横向きロック
