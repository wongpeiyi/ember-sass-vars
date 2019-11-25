/* eslint node/no-unpublished-require: off */

'use strict';

const Filter = require('broccoli-persistent-filter');

function SassModule(inputTree, options = {}) {
  if (!(this instanceof SassModule)) {
    return new SassModule(inputTree, options);
  }

  Filter.call(this, inputTree, {
    annotation: options.annotation
  });
}

SassModule.prototype = Object.create(Filter.prototype);
SassModule.prototype.constructor = SassModule;
SassModule.prototype.extensions = ['scss', 'sass'];
SassModule.prototype.targetExtension = 'js';
SassModule.prototype.processString = function(contents) {
  return `export default ${JSON.stringify(parseVars(contents))};`;
};

module.exports = {
  name: require('./package').name,

  treeForApp() {
    return SassModule(this.app.trees.app);
  }
};

function parseVars(contents, inner = false) {
  const result = {};

  const varRegex = /\$(.+?):\s+?([\s\S]+?);/g;
  const mapRegex = /([\S]+?):\s+?(\S+?),/g;

  const regex = inner ? mapRegex : varRegex;

  let match;

  while ((match = regex.exec(contents))) {
    let [name, value] = match.slice(1);

    // Maps
    if (value.match(/^\([\s\S]+\)$/)) {
      result[name] = parseVars(value, true);
    }
    // Normal vars
    else {
      // Reference other vars
      if (value.startsWith('$')) {
        value = result[value.slice(1)];
      }

      result[name] = value;
    }
  }

  return result;
}
