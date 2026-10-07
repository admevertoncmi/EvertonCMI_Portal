const fs = require('fs');
let content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

// The 2 occurrences look like this:
//       ))}
// </div>
//   )}

let count = 0;
content = content.replace(/      \)\)\}\r?\n<\/div>\r?\n  \)\}/g, () => {
    count++;
    return '      ))}\n</div>\n  </>\n  )}';
});

fs.writeFileSync('src/components/AdminDashboard.tsx', content);
console.log('Fixed ' + count + ' closings');
