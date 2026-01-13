# Texas Hold'em Poker Game

エレガントなデザインのテキサスホールデムポーカーゲーム。2～9人のプレイヤーが参加可能で、管理者は全プレイヤーのカードをリアルタイムで監視できます。

## 機能

### プレイヤー機能
- **ユーザー認証**: メールアドレスとパスワードによる登録・ログイン
- **ゲームルーム作成**: 2～9人のプレイヤー数を選択可能
- **ゲームルーム参加**: ルームコードで簡単に参加
- **テキサスホールデム**: 完全なゲームロジック実装
  - プリフロップ、フロップ、ターン、リバー、ショーダウン
  - フォールド、チェック、コール、レイズ、オールイン
- **リアルタイム同期**: Socket.ioによる即座の状態更新
- **仮想チップシステム**: 初期チップ1000枚

### 管理者機能
- **全カード監視**: 全プレイヤーのホールカードを表示
- **デッキプレビュー**: 次に配られるカードの確認
- **アクション履歴**: 全プレイヤーのアクションログ
- **リアルタイム監視**: ゲーム状態の自動更新

## 技術スタック

### フロントエンド
- React 18
- TypeScript
- Tailwind CSS
- Socket.io Client
- Wouter (ルーティング)
- Framer Motion (アニメーション)

### バックエンド
- Node.js
- Express
- Socket.io
- PostgreSQL
- JWT認証
- bcrypt (パスワードハッシュ)

## セットアップ

### 前提条件
- Node.js 18以上
- PostgreSQL 15以上
- npm または pnpm

### ローカル開発

1. **リポジトリのクローン**
```bash
git clone https://github.com/system-asayama/poker-app-new.git
cd poker-app-new
```

2. **依存関係のインストール**
```bash
npm install
```

3. **環境変数の設定**
`.env.example`を`.env`にコピーして編集:
```bash
cp .env.example .env
```

`.env`ファイルの内容:
```env
DATABASE_URL=postgresql://username:password@localhost:5432/poker_db
JWT_SECRET=your-super-secret-jwt-key-change-this-in-production
PORT=5000
NODE_ENV=development
CLIENT_URL=http://localhost:3000
```

4. **データベースのセットアップ**
```bash
# PostgreSQLデータベースを作成
createdb poker_db

# マイグレーション実行
npm run migrate
```

5. **開発サーバーの起動**
```bash
npm run dev
```

- フロントエンド: http://localhost:3000
- バックエンド: http://localhost:5000

### GitHub Codespacesでの開発

1. **Codespacesを起動**
   - GitHubリポジトリページで「Code」→「Create codespace on main」をクリック

2. **自動セットアップ**
   - `.devcontainer/devcontainer.json`により自動的に環境が構築されます
   - 依存関係のインストールと`.env`ファイルの作成が自動実行されます

3. **データベースの初期化**
```bash
npm run migrate
```

4. **開発開始**
```bash
npm run dev
```

## Herokuへのデプロイ

### 1. Heroku CLIのインストール
```bash
curl https://cli-assets.heroku.com/install.sh | sh
```

### 2. Herokuにログイン
```bash
heroku login
```

### 3. アプリケーションの作成
```bash
heroku create your-poker-app-name
```

### 4. PostgreSQLアドオンの追加
```bash
heroku addons:create heroku-postgresql:mini
```

### 5. 環境変数の設定
```bash
heroku config:set JWT_SECRET=$(openssl rand -base64 32)
heroku config:set NODE_ENV=production
heroku config:set CLIENT_URL=https://your-poker-app-name.herokuapp.com
```

### 6. デプロイ
```bash
git push heroku main
```

### 7. データベースマイグレーション
マイグレーションは`Procfile`で自動実行されます。

### 8. アプリケーションを開く
```bash
heroku open
```

## 管理者アカウントの作成

最初のユーザーを管理者にするには、データベースで直接更新します:

```sql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
```

Herokuの場合:
```bash
heroku pg:psql
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
\q
```

## 使い方

### プレイヤーとして

1. **アカウント作成**: メールアドレス、ユーザー名、パスワードで登録
2. **ゲーム作成**: 「新しいゲームを作成」からプレイヤー数を選択
3. **ゲーム参加**: 利用可能なゲームリストから参加、またはルームコードで直接参加
4. **ゲーム開始**: 2人以上揃ったらホストが開始
5. **プレイ**: 自分のターンでアクションを選択

### 管理者として

1. **管理画面へ**: ホーム画面の「管理画面」ボタンをクリック
2. **ゲーム選択**: 左側のリストから監視したいゲームを選択
3. **監視**: 全プレイヤーのカード、デッキ、アクション履歴をリアルタイムで確認

## プロジェクト構造

```
poker-app-new/
├── src/
│   ├── server/              # バックエンド
│   │   ├── database/        # データベース関連
│   │   │   ├── db.ts        # データベース接続
│   │   │   └── schema.sql   # スキーマ定義
│   │   ├── game/            # ゲームロジック
│   │   │   ├── deck.ts      # カードデッキ
│   │   │   ├── handEvaluator.ts  # ハンド評価
│   │   │   └── gameManager.ts    # ゲーム管理
│   │   ├── middleware/      # ミドルウェア
│   │   │   └── auth.ts      # 認証
│   │   ├── routes/          # APIルート
│   │   │   ├── auth.ts      # 認証API
│   │   │   └── game.ts      # ゲームAPI
│   │   ├── index.ts         # サーバーエントリーポイント
│   │   └── migrate.ts       # マイグレーションスクリプト
│   ├── client/              # フロントエンド
│   │   ├── components/      # UIコンポーネント
│   │   │   └── Card.tsx     # カードコンポーネント
│   │   ├── contexts/        # Reactコンテキスト
│   │   │   └── AuthContext.tsx  # 認証コンテキスト
│   │   ├── pages/           # ページコンポーネント
│   │   │   ├── Login.tsx    # ログインページ
│   │   │   ├── Home.tsx     # ホームページ
│   │   │   ├── Game.tsx     # ゲームページ
│   │   │   └── Admin.tsx    # 管理者ページ
│   │   ├── utils/           # ユーティリティ
│   │   │   ├── api.ts       # API クライアント
│   │   │   └── socket.ts    # Socket.io クライアント
│   │   ├── App.tsx          # メインアプリ
│   │   ├── main.tsx         # エントリーポイント
│   │   ├── styles.css       # グローバルスタイル
│   │   └── index.html       # HTML テンプレート
│   └── shared/              # 共有型定義
│       └── types.ts         # TypeScript型定義
├── .devcontainer/           # Codespaces設定
│   └── devcontainer.json
├── package.json
├── tsconfig.json
├── vite.config.ts
├── tailwind.config.js
├── Procfile                 # Heroku起動設定
└── README.md
```

## API エンドポイント

### 認証
- `POST /api/auth/register` - ユーザー登録
- `POST /api/auth/login` - ログイン
- `POST /api/auth/logout` - ログアウト
- `GET /api/auth/me` - 現在のユーザー情報取得

### ゲーム
- `GET /api/games` - ゲームリスト取得
- `POST /api/games/create` - ゲーム作成
- `POST /api/games/:id/join` - ゲーム参加
- `POST /api/games/:id/start` - ゲーム開始
- `GET /api/games/:id` - ゲーム状態取得
- `POST /api/games/:id/action` - アクション実行
- `GET /api/games/:id/admin` - 管理者用完全状態取得（要管理者権限）

### Socket.io イベント
- `join-game` - ゲームルームに参加
- `leave-game` - ゲームルームから退出
- `game-update` - ゲーム状態更新通知

## トラブルシューティング

### データベース接続エラー
- `DATABASE_URL`が正しく設定されているか確認
- PostgreSQLサーバーが起動しているか確認

### Socket.io接続エラー
- CORSの設定を確認
- `CLIENT_URL`環境変数が正しいか確認

### ビルドエラー
- `node_modules`を削除して再インストール
```bash
rm -rf node_modules
npm install
```

## ライセンス

MIT

## 作者

system-asayama
