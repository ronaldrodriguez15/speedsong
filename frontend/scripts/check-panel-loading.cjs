const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
function compile(file, dependencies, globals = {}) {
  const exports = {};
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file, 'utf8'), {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText, { exports, require: name => dependencies[name], AbortController, setTimeout, clearTimeout, ...globals });
  return exports;
}
const summary = compile('src/services/panelSummary.ts', {});
let request;
const dependencies = { './api': { api: { get: (...args) => request(...args) }, apiError: error => error.message }, './panelSummary': summary };
const { loadPanelMetric } = compile('src/services/panelLoader.ts', dependencies);
const sources = [{ id: 'bodega', name: 'Bodega' }, { id: 'villa', name: 'Villa' }];
const sales = { total: 10, sale_count: 1, payments: { cash: 10 } };
const load = (metric = 'sales', points = sources, signal = new AbortController().signal, progress = () => {}) => loadPanelMetric(metric, points, 'today', true, signal, progress);
(async () => {
  let calls = 0;
  request = async () => { calls++; return { data: { data: sales } }; };
  let result = await load();
  assert.equal(result.loading, false); assert.equal(result.data.total, 20); assert.equal(calls, 2);

  calls = 0;
  request = async () => { if (++calls === 1) throw Object.assign(new Error('Temporary'), { response: { status: 503 } }); return { data: { data: sales } }; };
  result = await load('sales', sources.slice(0, 1));
  assert.equal(result.data.total, 10); assert.equal(calls, 2);

  calls = 0;
  request = async () => { calls++; throw Object.assign(new Error('Forbidden'), { response: { status: 403 } }); };
  result = await load('sales', sources.slice(0, 1));
  assert.equal(result.loading, false); assert.equal(calls, 1); assert.match(result.error, /Bodega/);

  request = async () => ({ data: { data: {} } });
  result = await load();
  assert.equal(result.loading, false); assert.equal(result.data, undefined); assert.match(result.error, /incompleta/);

  request = async url => {
    if (url.includes('villa')) throw Object.assign(new Error('Offline'), { response: { status: 501 } });
    return { data: { summary: { amount: 15, customer_count: 1 } } };
  };
  result = await load('receivables');
  assert.equal(result.data.summary.amount, 15); assert.equal(result.loading, false); assert.match(result.note, /parcial.*Villa/);

  result = await load('sales', []);
  assert.equal(result.loading, false); assert.match(result.error, /No hay puntos/);

  const controller = new AbortController();
  let progress = 0;
  request = async (_, config) => new Promise((resolve, reject) => {
    config.signal.addEventListener('abort', () => reject(new Error('Canceled')), { once: true });
  });
  const pending = load('sales', sources, controller.signal, () => progress++);
  controller.abort();
  await pending;
  assert.equal(progress, 0);

  const bounded = compile('src/services/panelLoader.ts', dependencies, { setTimeout: fn => setTimeout(fn, 5) });
  result = await bounded.loadPanelMetric('sales', sources, 'today', true, new AbortController().signal, () => {});
  assert.equal(result.loading, false); assert.match(result.error, /tiempo de espera/);
  console.log('PASS: successful totals, transient retry, permanent errors, malformed data, partial failures, empty sources, cancellation and deadline.');
})().catch(error => { console.error(error); process.exitCode = 1; });
