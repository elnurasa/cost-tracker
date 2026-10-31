import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import '@fontsource-variable/onest/wght.css';
import './styles/tokens.css';
import './styles/app.css';
import App from './App';
import { setUpdateReady } from './state/helpers';

const updateSW = registerSW({
  immediate: true,
  onNeedRefresh() {
    setUpdateReady(updateSW);
  },
});

// Wait (briefly) for the UI font so text never flashes in a fallback face; the boot skeleton in index.html covers the gap.
const fontReady = Promise.race([
  document.fonts?.load('600 1rem "Onest Variable"').catch(() => undefined) ?? Promise.resolve(),
  new Promise((r) => setTimeout(r, 600)),
]);
void fontReady.then(() => {
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
if (import.meta.env.DEV) void import('./dev/axe');
