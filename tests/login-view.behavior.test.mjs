import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
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
  const appSource = await readFile(join(process.cwd(), 'src/App.tsx'), 'utf8');
  assert.match(
    appSource,
    /Array\.isArray\(currentUser\.allowedTabs\)\s*&&\s*currentUser\.allowedTabs\.length\s*>\s*0/,
    'an empty cached permission list must fall back to role defaults instead of hiding all navigation',
  );

  const React = await import('react');
  const { act } = React;
  const { createRoot } = await import('react-dom/client');
  const { default: LoginView } = await import(pathToFileURL(bundle).href + '?t=' + Date.now());
  const rootElement = document.querySelector('#root');
  const root = createRoot(rootElement);
  let authenticatedUser;
  let loginRequest;
  globalThis.fetch = async (url, init) => {
    loginRequest = { url, init };
    return new Response(
      JSON.stringify({
        user: {
          username: 'Branch.User',
          password_raw: '',
          status: 'User',
          branch: '01.ສາຂາ ນະຄອນຫຼວງ',
          allowedTabs: ['dashboard', 'inspections'],
        },
      }),
      { status: 200, headers: { 'content-type': 'application/json' } },
    );
  };

  await act(async () => {
    root.render(React.createElement(LoginView, {
      onLoginSuccess: (user) => {
        authenticatedUser = user;
      },
    }));
  });

  const visibleText = rootElement.textContent.replace(/\s+/g, ' ').trim();
  assert.match(visibleText, /LDB SafeHub/, 'the login identity remains visible');
  assert.match(visibleText, /Lao Development Bank \(LDB\)/, 'the bank identity remains visible');
  assert.doesNotMatch(visibleText, /\b2026\b/, 'the login subtitle must not display a fixed year');
  assert.doesNotMatch(visibleText, /Google Sheets/i, 'demo account helper must not be exposed on login');
  assert.doesNotMatch(visibleText, /Pass:/, 'demo credentials must not be exposed on login');
  assert.equal(rootElement.querySelectorAll('form').length, 1, 'the real login form remains available');
  const branchOptions = [...rootElement.querySelectorAll('select option')]
    .map((option) => option.textContent.trim())
    .filter(Boolean);
  assert.ok(
    branchOptions.length > 2,
    'the login branch selector must use the complete branch master, not only branches assigned to bundled accounts',
  );
  assert.ok(
    branchOptions.some((label) => label.startsWith('01.')),
    'the login branch selector includes branch 01 from master data',
  );

  const [usernameInput, passwordInput] = rootElement.querySelectorAll('input');
  const branchSelect = rootElement.querySelector('select');
  const branchValue = [...branchSelect.options]
    .find((option) => option.textContent.trim().startsWith('01.')).value;
  const setControlValue = (control, value) => {
    const setter = Object.getOwnPropertyDescriptor(
      Object.getPrototypeOf(control),
      'value',
    ).set;
    setter.call(control, value);
    control.dispatchEvent(new Event('input', { bubbles: true }));
    control.dispatchEvent(new Event('change', { bubbles: true }));
  };

  await act(async () => {
    setControlValue(usernameInput, 'Branch.User');
    setControlValue(passwordInput, 'correct-password');
    setControlValue(branchSelect, branchValue);
  });
  await act(async () => {
    rootElement.querySelector('form').dispatchEvent(
      new window.Event('submit', { bubbles: true, cancelable: true }),
    );
  });

  assert.equal(loginRequest?.url, '/api/auth/login', 'login is authenticated by the Worker API');
  assert.deepEqual(
    JSON.parse(loginRequest.init.body),
    {
      username: 'Branch.User',
      password: 'correct-password',
      branch: branchValue,
    },
    'the API receives all three login credentials',
  );
  assert.equal(authenticatedUser?.username, 'Branch.User');

  await act(async () => {
    root.unmount();
  });
  console.log('Login view privacy and subtitle behavior checks passed.');
} finally {
  dom.window.close();
  await rm(temporaryDirectory, { recursive: true, force: true });
}
