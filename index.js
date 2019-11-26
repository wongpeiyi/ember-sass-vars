/* eslint node/no-unpublished-require: off */

'use strict';

const Filter = require('broccoli-persistent-filter');
const sass = require('node-sass');

function SassModule(inputTree, options = {}) {
  if (!(this instanceof SassModule)) {
    return new SassModule(inputTree, options);
  }

  Filter.call(this, inputTree, {
    annotation: options.annotation
  });
}

let includedFiles;

SassModule.prototype = Object.create(Filter.prototype);
SassModule.prototype.constructor = SassModule;

SassModule.prototype.getDestFilePath = function(relativePath) {
  if (includedFiles && includedFiles.includes(relativePath)) {
    return relativePath.replace(/scss|sass$/, 'js');
  }

  return null;
};

SassModule.prototype.processString = function(contents) {
  const vars = parseVars(contents);

  let result = recurseVarsIntoClasses(vars);

  if (result) {
    result = `${contents}\n${result}`;

    const css = sass.renderSync({ data: result }).css.toString();

    result = parseClasses(css);
  }

  return `export default ${JSON.stringify(result || {})};`;
};

module.exports = {
  name: require('./package').name,

  treeForApp() {
    const options = this.app.options['ember-sass-vars'];

    if (options) {
      includedFiles = options['include'];
    }

    return SassModule(this.app.trees.app);
  }
};

function parseVars(contents, inner = false) {
  const result = {};

  const varRegex = /\$(.+?):\s+?([\s\S]+?);/g;
  const mapRegex = /([\S]+?):\s+?([\s\S]+?)\n/g;

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

function parseClasses(contents) {
  const result = {};

  const regex = /([\s\S]+?) \{\s+?value: ([\s\S]+?);\s+}/g;

  let match;

  while ((match = regex.exec(contents))) {
    const [selector, value] = match.slice(1);

    const classes = selector.split(' ');

    let ref = result;

    classes.forEach((name, i) => {
      name = name.replace(/^[\s.]*/, '');

      // Set value
      if (i === classes.length - 1) {
        ref[name] = value;
      }
      // Nest
      else {
        if (!ref[name]) {
          ref[name] = {};
        }

        ref = ref[name];
      }
    });
  }

  return result;
}

function recurseVarsIntoClasses(vars) {
  let str = '';

  for (let name in vars) {
    const value = vars[name];

    if (typeof value === 'object') {
      str += `.${name} {\n`;
      str += recurseVarsIntoClasses(value);
      str += `}\n`;
    } else {
      str += `.${name} { value: ${value}; }\n`;
    }
  }

  return str;
}
