const babel = require('babel-core');
const babelTraverse = require("babel-traverse").default;
const babelGenerator = require('babel-generator').default;

const input = `
  const aa = 123;
  wx.setStorageSync('aa', 123);

  function calc(n) {
    return n * n;
  }
  n;

  const calcArrow = zzz => n * n;
`;

const { ast, metadata } = babel.transform(input, {
  sourceMap: true,
  presets: ["es2015", "stage-0"],
  plugins: [
    './src/babel/diy',
  ],
});
babelTraverse(ast, {
  CallExpression({ node }) {

  },
  VariableDeclarator({ node }) {

  },
});

const { code } = babelGenerator(ast);

console.log(code);