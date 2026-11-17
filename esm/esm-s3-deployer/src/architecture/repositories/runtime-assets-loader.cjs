const path = require('node:path');
const { parse: parseJavaScript } = require('acorn');
const { init, parse } = require('es-module-lexer');

// Rspack must see the original URL expression to build a worker and its imports.
function workerURLs(code) {
  const urls = [];
  const visit = (node) => {
    if (!node || typeof node !== 'object') return;
    if (
      node.type === 'NewExpression' &&
      node.callee.type === 'Identifier' &&
      ['Worker', 'SharedWorker'].includes(node.callee.name)
    ) {
      const url = node.arguments[0];
      if (url?.type === 'NewExpression' && url.callee.name === 'URL') urls.push(url);
    }
    for (const value of Object.values(node)) {
      if (Array.isArray(value)) value.forEach(visit);
      else if (value && typeof value === 'object') visit(value);
    }
  };
  visit(parseJavaScript(code, { ecmaVersion: 'latest', sourceType: 'module' }));
  return urls;
}

// Bind other runtime URL calculations to the original source directory, even
// when Rspack moves this module into a shared chunk.
module.exports = function (code) {
  const callback = this.async();
  const { sourcePath, prefix } = this.getOptions();
  init()
    .then(() => {
      const meta = parse(code)[0].filter(
        ({ type, end }) => type === 'import-meta' && /^\.url\b/.test(code.slice(end)),
      );
      if (meta.length === 0) return callback(null, code);
      const workers = workerURLs(code);
      const relative = path.relative(sourcePath, this.resourcePath).split(path.sep).join('/');
      const base = JSON.stringify(`${prefix}${relative}`);
      for (const { start: s, end: e } of [...meta].reverse()) {
        if (workers.some(({ start, end }) => start <= s && e < end)) continue;
        this._module.buildInfo.runtimeAssets = sourcePath;
        code = `${code.slice(0, s)}(__webpack_public_path__ + ${base})${code.slice(e + 4)}`;
      }
      callback(null, code);
    })
    .catch(callback);
};
