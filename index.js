/**
 * We are using ESM ECMAScript module loader
 * to use import/export syntax without using babel or any other compiler
 */

require = require('esm')(module);

module.exports = require('./server.js');
