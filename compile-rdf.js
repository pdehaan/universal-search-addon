'use strict';

var fs = require('fs');

var _ = require('lodash');

var pkg = require('./package.json');
// Make sure the package.json version gets copied into the `rdf` namespace.
pkg.rdf.version = pkg.version;

renderTemplate('install.hbs', 'install.rdf', pkg.rdf);
renderTemplate('update.hbs', 'update.rdf', pkg.rdf);

function renderTemplate(input, output, data) {
  var tmpl = fs.readFileSync(input, 'utf-8');
  var compiled = _.template(tmpl);
  fs.writeFile(output, compiled(data).toString());
}
