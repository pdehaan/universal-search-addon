'use strict';

var fs = require('fs');
var path = require('path');

var _ = require('lodash');

var pkg = require('../package.json');
// Make sure the package.json `version` gets copied into the `rdf` object.
pkg.rdf.meta = {
  version: pkg.version.toString()
};

renderTemplate(path.join(__dirname, 'install.tmpl'), 'install.rdf', pkg.rdf);
renderTemplate(path.join(__dirname, 'update.tmpl'), 'update.rdf', pkg.rdf);

function renderTemplate(input, output, data) {
  var tmpl = fs.readFileSync(input, 'utf-8');
  var compiled = _.template(tmpl);
  fs.writeFile(output, compiled(data).toString());
}
