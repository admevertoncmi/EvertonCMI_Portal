const fs = require('fs');
let code = fs.readFileSync('src/components/AdminDashboard.tsx', 'utf8');

const modalCode = `
      {batchApprovalData && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/80 backdrop-blur-sm p-6 animate-in fade-in duration-300">
          <div className={\`\${tc.bgCard} border \${tc.borderStrong} w-full max-w-md rounded-[32px] md:rounded-[40px] p-6 md:p-10 shadow-2xl space-y-5 md:space-y-6 overflow-hidden flex flex-col max-h-[90vh]\`}>
            <div className="flex justify-between items-center shrink-0">
              <h3 className={\`text-xl md:text-2xl font-black uppercase \${tc.textMain} flex items-center gap-2\`}>
                <Clock size={24} className="text-purple-500" /> Aprovar Lote
              </h3>
              <button onClick={() => setBatchApprovalData(null)} className={\`p-2 \${tc.textMuted} \${tc.bgHover} rounded-full transition-all\`}>
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4 w-full overflow-hidden">
              <p className={\`\${tc.textMuted} text-sm font-medium leading-relaxed px-1\`}>
                Agendar aprovação do lote <strong className={\`\${tc.textMain} break-normal\`}>{batchApprovalData.cicloLabel}</strong>:
              </p>

              <div className="relative group w-full" onClick={(e) => {
                const input = e.currentTarget.querySelector('input');
                if (input && 'showPicker' in input) {
                  try { (input as any).showPicker(); } catch (e) { }
                }
              }}>
                <input
                  type="datetime-local"
                  className={\`w-full py-3.5 px-4 pr-12 \${tc.bgInput} border \${tc.borderStrong} rounded-2xl outline-none font-bold text-sm focus:border-purple-500 transition-all shadow-inner cursor-pointer [color-scheme:dark] appearance-none box-border\`}
                  style={{ WebkitAppearance: 'none', MozAppearance: 'none' }}
                  value={batchScheduleDate}
                  onChange={e => setBatchScheduleDate(e.target.value)}
                />
                <Calendar className="absolute right-4 top-1/2 -translate-y-1/2 text-zinc-400 group-focus-within:text-purple-500 transition-colors pointer-events-none" size={18} />
              </div>

              <div className={\`\${theme === 'dark' ? 'bg-purple-900/10 border-purple-900/20' : 'bg-purple-50 border-purple-100'} border p-4 rounded-2xl\`}>
                <p className="text-purple-600 text-[10px] md:text-xs font-bold flex gap-2 leading-relaxed">
                  <Activity size={16} className="shrink-0" />
                  Deixe a data em branco para aprovar imediatamente.
                </p>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 pt-2 md:pt-4">
              <button
                onClick={() => setBatchApprovalData(null)}
                className={\`w-full sm:flex-1 py-3.5 \${theme === 'dark' ? 'bg-zinc-800' : 'bg-zinc-100'} \${tc.textMuted} rounded-xl md:rounded-2xl font-black uppercase text-[11px] tracking-widest transition-colors\`}
              >
                Voltar
              </button>
              <button
                onClick={() => {
                  handleAprovarLoteParaCliente(batchApprovalData.itens);
                  setBatchApprovalData(null);
                }}
                disabled={loading}
                className="w-full sm:flex-1 py-3.5 bg-purple-600 hover:bg-purple-700 text-white rounded-xl md:rounded-2xl font-black uppercase text-[11px] tracking-widest transition-colors flex justify-center items-center gap-2 shadow-lg shadow-purple-500/20 disabled:opacity-50"
              >
                {loading ? <Loader2 size={16} className="animate-spin" /> : <><CheckCircle2 size={16} /> Confirmar</>}
              </button>
            </div>
          </div>
        </div>
      )}
`;

code = code.replace(/(\{\s*isApproveConfirmModalOpen\s*&&\s*materialToApproveFinal\s*&&\s*\(\s*<div)/, modalCode + '$1');
fs.writeFileSync('src/components/AdminDashboard.tsx', code);
