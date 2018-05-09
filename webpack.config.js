/** webpackの設定ファイルです。 */
const webpackConfig = {
  entry: './src/Main.ts',
  // ファイルの出力設定
  output: {
    publicPath: 'js/',
    // 出力ファイル名
    filename: 'script.js'
  },
  resolve: {
    extensions: ['*', '.js', '.ts']
  },
  module: {
    rules: [
      {
        // 拡張子 .ts の場合
        test: /\.ts$/,
        // TypeScript をコンパイルする
        use: 'ts-loader'
      }
    ]

  },

  // ローカル開発用環境を立ち上げる
  // 実行時にブラウザが自動的に localhost を開く
  devServer: {
    contentBase: 'dist',
    open: true
  }
};

module.exports = webpackConfig;
