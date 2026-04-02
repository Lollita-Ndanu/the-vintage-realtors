const fs = require('fs');
const path = require('path');

const files = ['index.html', 'properties.html', 'property.html', 'location.html'];

const spaceId = process.env.CONTENTFUL_SPACE_ID;
const accessToken = process.env.CONTENTFUL_ACCESS_TOKEN;

if (!spaceId || !accessToken) {
  console.error('Error: CONTENTFUL_SPACE_ID and CONTENTFUL_ACCESS_TOKEN must be set');
  process.exit(1);
}

files.forEach(file => {
  const filePath = path.join(__dirname, file);
  
  if (!fs.existsSync(filePath)) {
    console.log(`Skipping ${file} (not found)`);
    return;
  }
  
  let content = fs.readFileSync(filePath, 'utf8');
  
  content = content.replace(/__CONTENTFUL_SPACE_ID__/g, spaceId);
  content = content.replace(/__CONTENTFUL_ACCESS_TOKEN__/g, accessToken);
  
  fs.writeFileSync(filePath, content, 'utf8');
  console.log(`Injected env vars into ${file}`);
});

console.log('Build complete');
