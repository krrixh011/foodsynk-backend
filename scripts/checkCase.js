const fs = require('fs');
const path = require('path');

const walk = (d) =>
  fs.readdirSync(d, { withFileTypes: true }).flatMap((e) =>
    e.isDirectory() ? walk(path.join(d, e.name)) : [path.join(d, e.name)]);

let bad = 0;
for (const f of walk('src').concat(walk('scripts')).filter((f) => f.endsWith('.js'))) {
  for (const m of fs.readFileSync(f, 'utf8').matchAll(/require\(['"](\.[^'"]+)['"]\)/g)) {
    const base = path.resolve(path.dirname(f), m[1]);
    const dir = path.dirname(base);
    const name = path.basename(base);
    const names = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
    if (!names.includes(name) && !names.includes(name + '.js') && !names.includes(name + '.json')) {
      console.log('CASE/PATH PROBLEM in', f, '->', m[1]);
      bad++;
    }
  }
}
console.log(bad ? bad + ' problem(s)' : 'all relative requires match file names exactly');