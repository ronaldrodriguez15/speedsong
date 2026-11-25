const fs = require('node:fs');
const vm = require('node:vm');
const assert = require('node:assert/strict');
const html = fs.readFileSync('index.html', 'utf8');
const script = html.match(/<script>([\s\S]*?)<\/script>/)[1];
for (const [saved, systemDark, expected] of [[null,true,true],[null,false,false],['dark',false,true],['light',true,false],['invalid',true,true]]) {
  const state = { style: {}, classList: { toggle: (name, value) => { state.dark = value; assert.equal(name, 'dark'); } } };
  vm.runInNewContext(script, { localStorage: { getItem: () => saved }, matchMedia: () => ({matches:systemDark}), document: {documentElement:state} });
  assert.equal(state.dark, expected);
  assert.equal(state.style.colorScheme, expected ? 'dark' : 'light');
}
const state = { style: {}, classList: { toggle: (_, value) => { state.dark = value; } } };
vm.runInNewContext(script, { localStorage: { getItem: () => { throw Error('blocked'); } }, matchMedia: () => ({matches:true}), document: {documentElement:state} });
assert.equal(state.dark, true);
console.log('PASS: saved preference, system preference, invalid value, blocked storage and initial color scheme.');
