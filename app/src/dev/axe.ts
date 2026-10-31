/**
 * Dev-only accessibility audit. In the running dev server open the browser console and call:
 *   await __axe()            -> prints a compact list of violations for the current screen
 * Never bundled in production (guarded by import.meta.env.DEV in main.tsx).
 */
import axe from 'axe-core';

declare global {
  interface Window {
    __axe?: () => Promise<{ id: string; impact: string | null | undefined; help: string; nodes: string[] }[]>;
  }
}
window.__axe = async () => {
  const r = await axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa', 'best-practice'] } });
  const out = r.violations.map((v) => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 5).map((n) => n.target.join(' ') + ' :: ' + (n.any[0]?.message ?? n.failureSummary ?? '').slice(0, 140)) }));
  console.table(out.map((o) => ({ id: o.id, impact: o.impact, count: o.nodes.length })));
  return out;
};

/** Layout audit: small tap targets, clipped text and horizontal overflow on the current screen. */
declare global {
  interface Window {
    __audit?: () => { small: string[]; clip: string[]; hoverflow: string | null };
    __go?: (route: string) => Promise<void>;
  }
}
window.__go = async (r: string) => {
  history.replaceState(null, '', `#/${r}`);
  window.dispatchEvent(new HashChangeEvent('hashchange'));
  await new Promise((x) => setTimeout(x, 700));
};
window.__audit = () => {
  const out = { small: [] as string[], clip: [] as string[], hoverflow: document.documentElement.scrollWidth > innerWidth + 1 ? `${document.documentElement.scrollWidth}>${innerWidth}` : null };
  const vis = (e: Element) => {
    const r = e.getBoundingClientRect();
    return r.width > 0 && r.height > 0 && getComputedStyle(e).visibility !== 'hidden';
  };
  document.querySelectorAll('button,a[href],input,select,textarea,[role=button],[role=switch]').forEach((e) => {
    if (!vis(e) || e.closest('.sr-only') || e.classList.contains('skip-link')) return;
    const r = e.getBoundingClientRect();
    if (r.width < 44 || r.height < 44) out.small.push(`${e.className || e.tagName} ${Math.round(r.width)}x${Math.round(r.height)} "${(e.getAttribute('aria-label') || e.textContent || '').trim().slice(0, 24)}"`);
  });
  document.querySelectorAll('body *').forEach((e) => {
    if (!vis(e) || e.closest('.sr-only') || e.classList.contains('sr-only')) return;
    const cs = getComputedStyle(e);
    if ((cs.overflow === 'hidden' || cs.textOverflow === 'ellipsis') && e.scrollWidth > e.clientWidth + 1 && e.children.length === 0) out.clip.push(`${e.className || e.tagName} "${(e.textContent ?? '').trim().slice(0, 30)}"`);
  });
  return out;
};

/**
 * Dev-only crawler for the visual pass: visits every main screen, opens every sheet reachable by a plain button and reports layout
 * problems (horizontal overflow, small tap targets, clipped text, controls pushed outside the viewport, axe violations).
 *   await __walk()            -> list of { screen, hoverflow, small, clip, outside, axe }
 * It never clicks switches, radios, the sample-data strip, or anything on Settings (those change or erase data).
 */
declare global {
  interface Window {
    __walk?: (opts?: { routes?: string[]; noAxe?: boolean; max?: number }) => Promise<Record<string, unknown>[]>;
  }
}
window.__walk = async (opts = {}) => {
  const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));
  const report: Record<string, unknown>[] = [];
  const outside = () => {
    const out: string[] = [];
    document.querySelectorAll('body *').forEach((e) => {
      if (e.closest('.sr-only') || e.classList.contains('sr-only') || e.classList.contains('skip-link')) return;
      const r = e.getBoundingClientRect();
      if (r.width === 0 || r.height === 0 || getComputedStyle(e).visibility === 'hidden') return;
      if (e.closest('[data-virtual-rows],.chip-row,.scroller,.tabbar,.sheet') && false) return;
      if (r.right > innerWidth + 1 || r.left < -1) {
        // inside a horizontally scrolling strip is fine
        let p: Element | null = e.parentElement;
        let scroll = false;
        while (p && p !== document.body) {
          const cs = getComputedStyle(p);
          if (/(auto|scroll)/.test(cs.overflowX) && p.scrollWidth > p.clientWidth) { scroll = true; break; }
          p = p.parentElement;
        }
        if (!scroll && e.children.length === 0) out.push(`${e.className || e.tagName} "${(e.textContent ?? '').trim().slice(0, 24)}" ${Math.round(r.left)}..${Math.round(r.right)}`);
      }
    });
    return out.slice(0, 6);
  };
  const snap = async (screen: string) => {
    const a = window.__audit!();
    const row: Record<string, unknown> = { screen, hoverflow: a.hoverflow, small: a.small.slice(0, 5), clip: a.clip.slice(0, 5), outside: outside() };
    if (!opts.noAxe && window.__axe) row.axe = (await window.__axe()).map((v) => `${v.id}:${v.nodes.length}`);
    report.push(row);
  };
  const skip = (b: Element) =>
    !!b.closest('.demo-strip,nav,.tabbar,.rail,.toast,[role=dialog],.skip-link') || ['switch', 'radio', 'tab'].includes(b.getAttribute('role') ?? '') || b.hasAttribute('disabled');
  const routes = opts.routes ?? ['today', 'plan', 'history', 'income', 'payments', 'payments/loans', 'settings', 'settings/data'];
  for (const r of routes) {
    await window.__go!(r);
    await wait(300);
    await snap(r);
    if (r.startsWith('settings')) continue;
    const lab = (b: Element) => (b.getAttribute('aria-label') || b.textContent || '').trim().slice(0, 40);
    const fresh = () => [...document.querySelectorAll('main button, .pane-left button')].filter((b) => !skip(b) && (b as HTMLElement).offsetParent !== null);
    const labels = [...new Set(fresh().map(lab))].slice(0, opts.max ?? 16);
    for (const label of labels) {
      const b = fresh().find((x) => lab(x) === label);
      if (!b) continue;
      (b as HTMLElement).click();
      await wait(550);
      const dlg = document.querySelector('[role=dialog]');
      if (dlg) {
        await snap(`${r} > sheet "${label}" (${dlg.getAttribute('aria-label') || dlg.querySelector('h2')?.textContent || ''})`);
        document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await wait(350);
        if (document.querySelector('[role=dialog]')) document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
        await wait(250);
      } else if (location.hash !== `#/${r}`) {
        await snap(`${r} > page "${label}" (${location.hash})`);
        await window.__go!(r);
        await wait(300);
      }
    }
  }
  return report;
};
