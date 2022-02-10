const fs = require('fs');
const path = require('path');
const newName = process.argv[2];

if (!newName) {
  throw new Error(`Usage: update-package-name.js <new-name>`);
}

const filepath = 'package.json';
const pkg = JSON.parse(fs.readFileSync(filepath));
pkg.name = newName;
fs.writeFileSync(filepath, JSON.stringify(pkg, undefined, 2));
