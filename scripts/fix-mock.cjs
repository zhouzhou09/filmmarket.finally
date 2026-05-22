const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'src', 'data', 'mockData.ts');
let content = fs.readFileSync(file, 'utf-8');

// Replace ccd with point-and-shoot
content = content.replace(/category: 'ccd'/g, "category: 'point-and-shoot'");

// Replace 8.5 with 9
content = content.replace(/condition: '8\.5'/g, "condition: '9'");

fs.writeFileSync(file, content, 'utf-8');
console.log('Fixed mockData.ts');
