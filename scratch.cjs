const fs = require('fs');
let content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

const lines = content.split('\n');
let modifiedCount = 0;

for (let i = 0; i < lines.length; i++) {
    if (lines[i].includes('opacity-0 group-hover/title:opacity-100') && lines[i].includes('<div className="relative inline-block')) {
        // Find if next line is the button
        if (lines[i+1] && lines[i+1].includes('setTagDropdownOpen(tagDropdownOpen === m.id ? null : m.id)')) {
            // Found a match to replace!
            const indent = lines[i].match(/^\s*/)[0];
            
            // Replace the div
            lines[i] = indent + `<div className={\`relative inline-block \${tagDropdownOpen === m.id ? 'opacity-100 z-50' : 'opacity-0 group-hover/title:opacity-100'}\`}>`;
            
            // Now we need to insert the overlay after the condition
            for (let j = i + 2; j < i + 10; j++) {
                if (lines[j].includes('{tagDropdownOpen === m.id && (')) {
                    lines[j] = lines[j] + '\n' + indent + '  <>\n' + indent + '    <div className="fixed inset-0 z-40" onClick={(e) => { e.stopPropagation(); setTagDropdownOpen(null); }} />';
                    
                    // Now find the closing div of the dropdown and add </>
                    let k = j + 1;
                    while(k < lines.length) {
                         if (lines[k].includes(')}')) {
                             // Check if it is the closing of the map or the condition
                             // The condition closing looks like: `  )}` or `)}`
                             // But wait, there is also `))} ` from the map.
                             if (!lines[k].includes('))}')) {
                                lines[k] = lines[k].replace(')}', '  </>\n' + indent + ')}');
                                break;
                             }
                         }
                         k++;
                    }
                    break;
                }
            }
            modifiedCount++;
        }
    }
}

fs.writeFileSync('src/components/AdminDashboard.tsx', lines.join('\n'));
console.log('Modified ' + modifiedCount + ' occurrences');
