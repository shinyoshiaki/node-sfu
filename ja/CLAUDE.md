# CLAUDE.md

このファイルは、本リポジトリでコードを扱う際のガイダンスをClaude Code（claude.ai/code）に提供するものです。

## プロジェクト概要

これはTypeScriptで書かれた純粋なNode.js WebRTC SFU（Selective Forwarding Unit）である**node-sfu**です。本プロジェクトでは、Gitサブモジュールとして含まれるwerift WebRTCライブラリを使用してWebRTCプロトコルを実装しています。

## アーキテクチャ

本プロジェクトはnpmワークスペースを使用しており、以下の3つの主要パッケージで構成されています。

* `packages/core/` – WebRTCのコア処理ロジック（WebRTCHandlerクラス）
* `packages/client/` – クライアント側のWebRTC実装（WebRTCClientクラス）
* `packages/e2e/` – Express.jsサーバーを用いたエンドツーエンドテスト基盤

### 主なコンポーネント

1. **WebRTCHandler**（packages/core/src/webrtc-core.ts:1）: サーバー側のWebRTCピアコネクション管理
2. **Client**（packages/client/src/index.ts:1）: ブラウザ側のWebRTCクライアント
3. **E2E Server**（packages/e2e/src/server.ts:1）: WebRTCシグナリングをテストするためのExpressサーバー

## コマンド

```bash
# Gitサブモジュールを初期化（werift依存関係のため必須）
npm run submodule

# 全ワークスペースで型チェックを実行
npm run type

# BiomeによるLint実行
npm run lint

# 個別パッケージのスクリプトを実行
npm run -w packages/core type
npm run -w packages/client type
npm run -w packages/e2e type

# E2Eテストを実行
npm run -w packages/e2e test:e2e
```

## 開発ガイドライン

1. **WebRTC実装**: 本プロジェクトではweriftをWebRTCスタックとして使用しています。詳細なプロトコルガイダンスは`werift/CLAUDE.md`を参照してください。

2. **TypeScript設定**: ES2022ターゲットかつstrictモード有効。すべてのパッケージで共通のtsconfigを共有しています。

3. **コードスタイル**: Biomeで強制。コミット前に`npm run lint`を実行してください。

4. **ワークスペース構造**: 新機能を追加する際は、該当するパッケージを検討してください。

   * コアWebRTCロジック → `packages/core`
   * クライアント側コード → `packages/client`
   * テスト基盤 → `packages/e2e`

5. **現在の実装状況**: 現在、基本的なWebRTC DataChannelでのPing-Pongメッセージングが実装済みです。メディアストリーミング機能は未実装です。

6. **E2Eテスト**:

   * 新機能追加時には、対応するE2Eテストケースを追加して機能を検証してください。
   * 実装完了前に必ずE2Eテストを実行し、回帰が発生していないことを確認してください。
   * E2Eテストは`packages/e2e`内にあり、`npm run -w packages/e2e test:e2e`で実行できます。

## 重要な注意点

* Node.js 18以上が必要です。
* weriftサブモジュールは開発前に初期化してください。
* プロジェクトは開発初期段階であり、基本的な接続確立は動作しますが、完全なSFU機能はまだ実装されていません。
