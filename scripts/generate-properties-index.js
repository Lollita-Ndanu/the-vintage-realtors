const fs = require('fs');
const path = require('path');

const propertiesDir = path.join(__dirname, '..', 'admin', 'properties');
const outFile = path.join(propertiesDir, 'index.json');

function main(){
  const files = fs.readdirSync(propertiesDir)
    .filter(f => f.endsWith('.md'))
    .sort();

  const all = files.map(filename => ({ filename }));
  fs.writeFileSync(outFile, JSON.stringify({ all }, null, 2), 'utf8');
  console.log('Wrote', outFile);
}

main();
