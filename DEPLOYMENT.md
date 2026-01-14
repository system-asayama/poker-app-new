# デプロイ完了

## アプリケーション情報

- **アプリ名**: poker-app-new
- **URL**: https://poker-app-new-53688fe543c9.herokuapp.com/
- **ステータス**: 正常稼働中
- **デプロイ日時**: 2026-01-14

## 実装された機能

### プレイヤー機能
- ✅ メールアドレス＋パスワード認証システム
- ✅ ユーザー登録・ログイン機能
- ✅ ゲームルーム作成（2～9人）
- ✅ ルームコードによる参加
- ✅ テキサスホールデムゲームロジック
- ✅ フォールド、チェック、コール、レイズ、オールインアクション
- ✅ Socket.ioによるリアルタイム同期
- ✅ 仮想チップシステム

### 管理者機能
- ✅ 全プレイヤーのカード表示
- ✅ デッキのプレビュー
- ✅ アクション履歴表示
- ✅ リアルタイム更新

### 技術スタック
- **フロントエンド**: React 18 + TypeScript + Tailwind CSS
- **バックエンド**: Node.js + Express + Socket.io
- **データベース**: PostgreSQL (Heroku Postgres)
- **認証**: JWT + bcrypt
- **デプロイ**: Heroku

## 環境変数

以下の環境変数が設定されています：

- `DATABASE_URL`: PostgreSQL接続URL（自動設定）
- `JWT_SECRET`: JWT署名用シークレット
- `NODE_ENV`: production
- `PORT`: Herokuが自動設定

## 管理者ログイン

管理者専用のログインページが用意されています。

**管理者ログインURL**: https://poker-app-new-53688fe543c9.herokuapp.com/admin-login

通常のログインページからも「管理者ログイン」リンクでアクセスできます。

**特徴**:
- 管理者権限の自動チェック
- 管理者以外のユーザーはログインできない
- ログイン後、自動的に管理画面にリダイレクト

## 管理者アカウントの作成

最初のユーザーを管理者にするには：

```bash
heroku pg:psql --app poker-app-new
UPDATE users SET role = 'admin' WHERE email = 'your-email@example.com';
\q
```

## トラブルシューティング

### ログの確認
```bash
heroku logs --tail --app poker-app-new
```

### アプリの再起動
```bash
heroku restart --app poker-app-new
```

### データベースのリセット
```bash
heroku pg:reset --app poker-app-new
heroku restart --app poker-app-new
```

## 次のステップ

1. 管理者アカウントを作成
2. テストユーザーでゲームをプレイ
3. 管理者画面で監視機能を確認
4. 必要に応じてカスタマイズ

## GitHubリポジトリ

https://github.com/system-asayama/poker-app-new
