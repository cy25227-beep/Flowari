# しばよこ DESIGN AI JAM

FigmaデザインをReactで実装するための、Vite + React + TypeScriptプロジェクトです。

## 必要なもの

- Node.js 20以上（推奨: LTS）

## 起動

```powershell
npm install
npm run dev
```

表示されたURL（通常は `http://localhost:5173`）をブラウザで開きます。

## 主な場所

- `src/App.tsx`：画面の起点
- `src/styles.css`：共通スタイル
- `public/`：Figmaから書き出した画像・アイコンの保存先

Figma MCPの利用上限が解消されたら、対象ノードのデザイン情報を取得して `src/App.tsx` を実装に置き換えます。
