// Contract checks for Axios feedback without a browser or a live database.
const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const ts = require('typescript');
const axios = require('axios');
const { webcrypto } = require('node:crypto');

const calls = [];
const events = [];
const toast = {
  loading: message => { const id = calls.length; calls.push(['loading', id, message]); return id; },
  update: (id, options) => calls.push(['update', id, options]),
  dismiss: id => calls.push(['dismiss', id]),
  error: message => calls.push(['error', message]),
};
const source = fs.readFileSync('src/services/api.ts', 'utf8')
  .replace('import.meta.env.URL_API_KEY', '"http://localhost:8000/api"');
const compiled = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true },
}).outputText;
const exportsObject = {};
vm.runInNewContext(compiled, {
  exports: exportsObject,
  require: name => name === 'axios' ? axios : { toast },
  window: { dispatchEvent: event => events.push(event) },
  crypto: webcrypto, Event,
  CustomEvent: class { constructor(type, options) { this.type = type; this.detail = options.detail; } },
});
const { api } = exportsObject;
const reset = () => { calls.length = 0; events.length = 0; };
const respond = (status, data) => {
  api.defaults.adapter = async config => {
    const response = { status, data, config, headers: {}, statusText: '' };
    if (status >= 400) throw new axios.AxiosError('Request failed', 'ERR_BAD_REQUEST', config, null, response);
    return response;
  };
};
(async () => {
  respond(201, { id: 1 });
  await api.post('/users', {});
  assert.equal(calls[0][0], 'loading');
  assert.equal(calls[1][2].type, 'success');
  assert.match(events[0].detail.message, /Usuario creado/);

  reset(); respond(422, { errors: { email: ['Correo duplicado.'] } });
  await assert.rejects(api.put('/users/1', {}));
  assert.equal(calls[1][2].render, 'Correo duplicado.');
  assert.equal(events[0].detail.type, 'error');

  reset(); respond(401, {});
  await assert.rejects(api.get('/user', { feedback: { ignoreUnauthorized: true } }));
  assert.equal(calls[1][0], 'dismiss');
  assert.equal(events.filter(event => event.type === 'api:notice').length, 0);
  assert.equal(events[0].type, 'auth:expired');

  reset();
  api.defaults.adapter = async config => { throw new axios.CanceledError('canceled', config); };
  await assert.rejects(api.get('/users'));
  assert.equal(calls[1][0], 'dismiss');
  assert.equal(events.length, 0);

  reset(); respond(204, {});
  await exportsObject.csrf();
  assert.equal(calls[1][2].type, 'success');
  assert.equal(events.length, 0);

  reset(); respond(200, {});
  await api.get('/users', { feedback: false });
  assert.equal(calls.length, 0);
  assert.equal(events.length, 0);
  console.log('PASS: create, validation error, guest session, cancellation, CSRF and silent requests.');
})().catch(error => { console.error(error); process.exitCode = 1; });
