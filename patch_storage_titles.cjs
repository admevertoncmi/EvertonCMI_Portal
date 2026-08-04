const fs = require('fs');
let content = fs.readFileSync('src/components/StorageManager.tsx', 'utf8');

const regex = /\/\/ Extrair URLs do Supabase Storage\s*const filesToDelete = new Set<string>\(\);\s*arquivados\.forEach\(m => \{\s*\/\/ Padrão de URL do storage public do supabase\s*const urlRegex = \/https:\\\/\\\/\[\^\/\]\+\\\.supabase\\\.co\\\/storage\\\/v1\\\/object\\\/public\\\/roteiros-midia\\\/\[\^"'\s\]\+\/g;\s*let match;\s*while \(\(match = urlRegex\.exec\(m\.roteiro\)\) !== null\) \{\s*filesToDelete\.add\(match\[1\]\);\s*\}\s*\}\);\s*if \(filesToDelete\.size === 0\) \{\s*toast\.info\("Nenhuma imagem encontrada nos roteiros arquivados\."\);\s*setCleaning\(false\);\s*return;\s*\}\s*if \(confirm\(`Encontramos \$\{filesToDelete\.size\} imagem\(ns\) vinculada\(s\) a tarefas arquivadas\. Deseja apagá-las permanentemente para liberar espaço\?`\)\) \{/s;

const replacement = `// Extrair URLs do Supabase Storage
      const filesToDelete = new Set<string>();
      const affectedTitles = new Set<string>();
      
      arquivados.forEach(m => {
        // Padrão de URL do storage public do supabase
        const urlRegex = /https:\\/\\/[^/]+\\.supabase\\.co\\/storage\\/v1\\/object\\/public\\/roteiros-midia\\/([^"'\\s]+)/g;
        let match;
        let foundAny = false;
        while ((match = urlRegex.exec(m.roteiro)) !== null) {
          filesToDelete.add(match[1]);
          foundAny = true;
        }
        if (foundAny) {
          affectedTitles.add(m.titulo);
        }
      });

      if (filesToDelete.size === 0) {
        toast.info("Nenhuma imagem encontrada nos roteiros arquivados.");
        setCleaning(false);
        return;
      }

      const titulosList = Array.from(affectedTitles).slice(0, 15).map(t => \`- \${t}\`).join('\\n');
      const extraCount = affectedTitles.size > 15 ? \`\\n...e mais \${affectedTitles.size - 15} outras tarefas\` : '';
      
      const confirmMessage = \`Encontramos \${filesToDelete.size} imagem(ns) vinculada(s) nas seguintes tarefas arquivadas:\\n\\n\${titulosList}\${extraCount}\\n\\nDeseja apagá-las permanentemente para liberar espaço?\`;

      if (confirm(confirmMessage)) {`;

if (content.match(regex)) {
  content = content.replace(regex, replacement);
  fs.writeFileSync('src/components/StorageManager.tsx', content, 'utf8');
  console.log("StorageManager.tsx patched successfully!");
} else {
  console.log("Regex failed.");
}
