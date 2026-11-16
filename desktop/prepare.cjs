// Copies the built web app (../dist) into ./web and gives the desktop app the same version.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const dist = path.join(root, 'dist');
const web = path.join(__dirname, 'web');
if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('No ../dist yet: run "npm run build" in the project folder first.');
  process.exit(1);
}
fs.rmSync(web, { recursive: true, force: true });
fs.cpSync(dist, web, { recursive: true });

const own = path.join(__dirname, 'package.json');
const pkg = JSON.parse(fs.readFileSync(own, 'utf8'));
pkg.version = JSON.parse(fs.readFileSync(path.join(root, 'package.json'), 'utf8')).version;
fs.writeFileSync(own, JSON.stringify(pkg, null, 2) + '\n');
console.log(`Desktop app ${pkg.version}: copied the web app into desktop/web`);
