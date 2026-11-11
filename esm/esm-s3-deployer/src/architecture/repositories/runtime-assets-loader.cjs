const path = require('node:path');
const { init, parse } = require('es-module-lexer');

// Bind runtime URL calculations to the original source directory, even when
// Rspack moves this module into a shared chunk.
module.exports = function (code) {
  const callback = this.async();
  const { sourcePath, prefix } = this.getOptions();
  init
    .then(() => {
      const relative = path.relative(sourcePath, this.resourcePath).split(path.sep).join('/');
      const base = JSON.stringify(`${prefix}${relative}`);
      for (const { s, e, d } of [...parse(code)[0]].reverse()) {
        if (d !== -2 || !/^\.url\b/.test(code.slice(e))) continue;
        code = `${code.slice(0, s)}(__webpack_public_path__ + ${base})${code.slice(e + 4)}`;
      }
      callback(null, code);
    })
    .catch(callback);
};
