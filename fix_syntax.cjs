const fs = require('fs');
const lines = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8').split('\n');

lines.forEach((l, i) => { 
  if (l.includes('{tagDropdownOpen === m.id && (')) {
     if (lines[i+1].includes('<div className="fixed inset-0')) {
       // It has the fragment opening `<>`, let's see if it has the closing `</>`
       let hasClosing = false;
       for (let j = i+1; j < i+20; j++) {
         if (lines[j] && lines[j].includes('</>')) hasClosing = true;
       }
       if (!hasClosing) {
         console.log('Missing closing at line ' + i);
         // Find the closing of the condition.
         for (let j = i+1; j < i+20; j++) {
           if (lines[j] && lines[j].includes('</div>') && lines[j+1] && lines[j+1].includes(')}')) {
               lines[j+1] = lines[j+1].replace(')}', '</>\n' + lines[j+1].match(/^\s*/)[0] + ')}');
               break;
           }
         }
       }
     }
  }
});
fs.writeFileSync('src/components/AdminDashboard.tsx', lines.join('\n'));
console.log('Done');
