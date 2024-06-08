const path = require("path");
const { FlatCompat } = require("@eslint/eslintrc");
const pluginJs = require("@eslint/js");

// Lấy đường dẫn của tệp đang thực thi
const baseDirectory = path.dirname(require.main.filename);
const compat = new FlatCompat({ baseDirectory, recommendedConfig: pluginJs.configs.recommended });

module.exports = [
  ...compat.extends("standard"),
];
