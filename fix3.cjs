const fs = require('fs');
let content = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

const target = `      ))}
    
      
    </div>
  )}`;

const repl = `      ))}
    
      
    </div>
  </>
  )}`;

if (content.includes(target)) {
    content = content.replace(target, repl);
    fs.writeFileSync('src/components/AdminDashboard.tsx', content);
    console.log('Fixed missing closing!');
} else {
    console.log('Target not found!');
}
