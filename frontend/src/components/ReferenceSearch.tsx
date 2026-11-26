import { useState, useId, type FormEvent } from 'react';
import { Search, Plus, X, Loader2 } from 'lucide-react';
export function ReferenceSearch({ loading, onSearch }: { loading: boolean; onSearch: (search: string) => void }) {
  const helpId = useId();
  const [search, setSearch] = useState('');
  const [references, setReferences] = useState<string[]>([]);
  const [inputError, setInputError] = useState('');
  const splitReferences = (text: string) => text.split(/[,;\r\n]+/).map(value => value.trim()).filter(Boolean);
  function combinedReferences(text = search) {
    return [...new Map([...references, ...splitReferences(text)].map(value => [value.toUpperCase(), value])).values()];
  }
  function validReferences(values: string[]) {
    const valid = values.length <= 20 && values.every(value => value.length <= 100);
    setInputError(valid ? '' : 'Puedes buscar hasta 20 referencias, de máximo 100 caracteres cada una.');
    return valid;
  }
  function addReferences(text = search) {
    const values = combinedReferences(text);
    if (validReferences(values)) { setReferences(values); setSearch(''); }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    const values = combinedReferences();
    if (!validReferences(values)) return;
    if (!values.length) { setInputError('Agrega al menos una referencia.'); return; }
    setReferences(values); setSearch(''); onSearch(values.join(', '));
  }
  return <form onSubmit={submit} className="space-y-4">          <div className="flex flex-col gap-3 sm:flex-row">
            <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-3.5 text-slate-400" size={18}/><input aria-label="Referencias de productos" aria-describedby={helpId} aria-invalid={!!inputError} maxLength={2200} value={search} onChange={e => { setSearch(e.target.value); setInputError(''); }} onKeyDown={e => { if (!e.nativeEvent.isComposing && (e.key === 'Enter' || e.key === ',' || e.key === ';')) { e.preventDefault(); addReferences(); } }} onPaste={e => { const pasted = e.clipboardData.getData('text'); if (/[,;\r\n]/.test(pasted)) { e.preventDefault(); const input = e.currentTarget; addReferences(search.slice(0, input.selectionStart ?? search.length) + pasted + search.slice(input.selectionEnd ?? search.length)); } }} placeholder="Ej. SG 129C, SG 200" className="w-full rounded-xl border border-slate-200 bg-transparent py-3 pl-10 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-100 dark:border-slate-700"/></div>
            <button type="button" onClick={() => addReferences()} disabled={!search.trim()} className="btn-quiet justify-center"><Plus size={17}/>Agregar</button>
          </div>
          <p id={helpId} className="text-xs leading-5 text-slate-500 dark:text-slate-400">Escribe una referencia y pulsa Enter o Agregar. También puedes pegar una lista separada por comas o saltos de línea. Hasta 20 referencias.</p>
          {!!references.length && <div className="flex flex-wrap gap-2">{references.map(reference => <span key={reference.toUpperCase()} className="inline-flex max-w-full items-center gap-2 rounded-xl bg-brand-50 py-2 pl-3 pr-2 text-sm font-medium text-brand-700 dark:bg-brand-900/40 dark:text-brand-200"><span className="break-all">{reference}</span><button type="button" aria-label={`Quitar ${reference}`} onClick={() => { setReferences(values => values.filter(value => value !== reference)); setInputError(''); }} className="rounded-lg p-1 hover:bg-brand-100 focus-visible:ring-2 focus-visible:ring-brand-400 dark:hover:bg-brand-900"><X size={14}/></button></span>)}</div>}
          {inputError && <p role="alert" className="text-sm text-rose-600 dark:text-rose-400">{inputError}</p>}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 pt-4 dark:border-slate-800"><button type="button" disabled={!references.length && !search} onClick={() => { setReferences([]); setSearch(''); setInputError(''); }} className="text-sm text-slate-500 hover:text-brand-600 disabled:opacity-40">Limpiar búsqueda</button><button disabled={loading || !combinedReferences().length} className="btn-primary justify-center">{loading ? <Loader2 size={18} className="animate-spin"/> : <Search size={18}/>}Buscar {combinedReferences().length || ''} {combinedReferences().length === 1 ? 'referencia' : 'referencias'}</button></div>
</form>;
}
