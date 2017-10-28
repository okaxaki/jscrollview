var UglifyJsPlugin = require('webpack').optimize.UglifyJsPlugin;

module.exports = {
  context: __dirname + '/src',

  entry: {
    "jscrollview.min": "./library.js",
    "jscrollview": "./library.js"
  },
  devtool: 'source-map',
  
  output: {
    path: __dirname + '/dist',
    library: 'JScrollView',
    libraryTarget: 'var',
    libraryExport: 'default',
    filename: "[name].js"
  },
  plugins: [
    new UglifyJsPlugin({
      include: /\.min\.js$/,
      sourceMap: true
    })
  ],
  module: {
    rules: [
      {
        test: /src\/.*\.js$/,
        exclude: /node_modules/,
        use: [{
          loader: 'babel-loader',
          options: { 
            presets: [['env']]
          }
        }]
      }
    ]
  }
}