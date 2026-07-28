import assert from 'node:assert/strict';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { build } from 'esbuild';
import { JSDOM } from 'jsdom';

const temporaryDirectory = await mkdtemp(join(process.cwd(), 'tests', '.login-view-'));
const bundle = join(temporaryDirectory, 'LoginView.mjs');

await build({
  entryPoints: [join(process.cwd(), 'src/components/LoginView.tsx')],
  outfile: bundle,
  bundle: true,
  platform: 'node',
  format: 'esm',
  external: ['react', 'react-dom', 'lucide-react'],
  loader: { '.jpg': 'dataurl' },
  logLevel: 'silent',
});

const dom = new JSDOM('<!doctype html><html><body><main id="root"></main></body></html>', {
  pretendToBeVisual: true,
  url: 'http://localhost/',
});
const { window } = dom;
Object.assign(globalThis, {
  window,
  document: window.document,
  HTMLElement: window.HTMLElement,
  Node: window.Node,
  Event: window.Event,
  IS_REACT_ACT_ENVIRONMENT: true,
});
Object.defineProperty(globalThis, 'navigator', { configurable: true, value: window.navigator });

try {
  const React = await import('react');
  const { act } = React;
  const { createRoot } = await import('react-dom/client');
  const { default: LoginView } = await import(pathToFileURL(bundle).href + '?t=' + Date.now());
  const rootElement = document.querySelector('#root');
  const root = createRoot(rootElement);

  await act(async () => {
    root.render(React.createElement(LoginView, { onLoginSuccess: () => {} }));
  });

  const visibleText = rootElement.textContent.replace(/\s+/g, ' ').trim();
  assert.match(visibleText, /LDB SafeHub/, 'the login identity remains visible');
  assert.match(visibleText, /Lao Development Bank \(LDB\)/, 'the bank identity remains visible');
  assert.doesNotMatch(visibleText, /\b2026\b/, 'the login subtitle must not display a fixed year');
  assert.doesNotMatch(visibleText, /Google Sheets/i, 'demo account helper must not be exposed on login');
  assert.doesNotMatch(visibleText, /Pass:/, 'demo credentials must not be exposed on login');
  assert.equal(rootElement.querySelectorAll('form').length, 1, 'the real login form remains available');

  await act(async () => {
    root.unmount();
  });
  console.log('Login view privacy and subtitle behavior checks passed.');
} finally {
  dom.window.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
