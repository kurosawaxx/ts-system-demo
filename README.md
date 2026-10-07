# ts_system_demo — 勤怠・工数管理システム

> **本リポジトリについて**
> 実際に社内で稼働しているシステムそのものではなく、ポートフォリオ公開のために
> 実データ・社内固有情報を取り除いたうえで再構成したデモリポジトリです。
> 機能・技術構成は実システムに準拠していますが、表示されるデータはすべてダミーです。

## 背景

Salesforce TeamSpirit の利用コスト削減を目的として、社内向けの勤怠・工数管理システムを開発しました。
案件ごとの工数を記録し、人日単価から原価・粗利を自動算出することで、案件の採算をリアルタイムに把握できるようにしています。

## 担当

- 要件整理
- 機能設計
- アーキテクチャ設計
- Next.js 実装
- Laravel / MySQL の設計
- 認証・権限設計
- テスト環境構築
- 本番導入

## 技術スタック

| 領域 | 使用技術 |
|---|---|
| Backend | PHP 8.3 / Laravel 13.34 / Laravel Sanctum / MySQL 8.0 |
| Frontend | Next.js 16.3 (App Router) / React 19.3 / TypeScript 5 / Tailwind CSS 4 / TanStack Query |
| アーキテクチャ | FSD (Feature-Sliced Design) |
| テスト | PHPUnit 12 / Vitest + Testing Library + MSW |
| インフラ | Docker Compose |

## 主な機能

### 3ロールによる権限制御

管理者 / ディレクター / メンバーの3ロールで、画面・ナビゲーション・API レスポンスを出し分けています。

**メンバーには金額を返さない設計**にしている点が特徴です。工数と金額が揃うと他のメンバーの人日単価が逆算できてしまうため、メンバー向け API では工数のみを開示します。この挙動は回帰テストで固定化しています。

### 案件管理

- Excel インポート / エクスポート（出力する列をユーザーが選択可能）
- 多条件フィルタ、列の表示・並び替えのカスタマイズ（`localStorage` に永続化）
- 列ヘッダーのクリックによる昇順 / 降順ソート（列キー名で `localStorage` に保存し、列の追加・並び替えでもずれない）
- 一覧のフィルタ状態を URL クエリと `sessionStorage` に同期し、ブラウザバックでも復元

### 工数入力

- 月間カレンダー UI による日次入力
- 日本の祝日をハイライト

### 収益管理

- 人日単価ベースの原価・粗利・粗利率の自動算出
- 担当者 × 月のクロス集計（予定 / 実績を人日と金額で併記）

### 管理者ダッシュボード

- 請求月ベースの案件サマリー（総案件数 / 受注 / 検討中 / 失注）
- 収益サマリー（受注総額・粗利合計・平均粗利率）

## アーキテクチャ

### フロントエンド（FSD）

依存の方向を `app → widgets → features → shared` の一方向に限定しています。

```
frontend/
├── app/        # ルーティング（Next.js App Router）
├── widgets/    # 複数の feature を束ねる UI ブロック
├── features/   # 機能単位のスライス（auth / project / work-hour / csv-import / csv-export / user）
└── shared/     # 全レイヤーから使える共通部品（ui / api / lib / test）
```

同一レイヤー内で他スライスを直接 import することは禁止し、機能追加は `features/` への新規スライス追加で行います。

### バックエンド

```
backend/app/Http/Controllers/Api/        # 一般ユーザー向け API
backend/app/Http/Controllers/Api/Admin/  # 管理者向け API（role ミドルウェアで保護）
backend/routes/api.php                   # 全 API ルートを一元管理
```

## セットアップ

必要なもの: Docker / Docker Compose

```bash
cp .env.example .env
docker compose up -d --build
```

起動時に以下が自動で実行されます。

- backend の `composer install`
- マイグレーション
- デモデータの投入（案件 20 件 / ユーザー 14 名 / 工数レコード多数）

初回は依存パッケージのインストールとビルドで数分かかります。完了したら http://localhost:3020 を開いてください。

### デモアカウント

| ロール | メールアドレス | パスワード |
|---|---|---|
| 管理者 | admin@example.com | password |
| ディレクター | director@example.com | password |
| メンバー | member1@example.com | password |

### ポート

| サービス | ポート |
|---|---|
| Frontend | 3020 |
| Backend | 8020 |
| MySQL | 3320 |

## テスト

```bash
# バックエンド（SQLite in-memory で実行するため MySQL は不要）
docker exec ts_system_demo-backend-1 php artisan test

# フロントエンド
cd frontend && pnpm test
```

フロントエンドのテストは MSW で API をモックしているため、外部依存なしに実行できます。

### テスト実行時の DB 分離

テスト実行時に開発用 DB へ接続してしまう事故を防ぐため、`phpunit.xml` で
「OS 環境変数レベル（`<server>`）」と「Laravel 設定解決レベル（`<env>`）」の 2 層で
SQLite in-memory を強制し、その状態自体を専用のテストで検証しています。

- `backend/tests/Unit/TestEnvironmentIsolationTest.php`
- `backend/tests/Feature/FrameworkEnvironmentIsolationTest.php`

## CI

`.github/workflows/ci.yml` に、backend（PHPUnit）と frontend（Vitest + ビルド）を検証するワークフローを用意しています。
ただし本リポジトリはデモのため、自動実行は無効化しています（手動実行のみ）。

## 補足

- デモ用途のため、backend は `php artisan serve`（開発用サーバー）で起動しています。
- `.env.example` の `APP_KEY` はこのデモ専用に生成した値です。
- `docs/sample-import.csv` は案件インポート機能を試すためのサンプルです（管理者でログイン後、案件管理画面から取り込めます）。
