import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type ReactNode } from 'react';

/**
 * Minimal windowed list for the History screen (AC-EXP-06). The page scrolls with the window, so we window against
 * window.scrollY. Row heights are measured (ResizeObserver) with an estimate until then; only rows inside the viewport
 * +/- overscan are in the DOM, so 5,000+ entries cost about the same as 30.
 */
export interface VirtualProps<T> {
  rows: T[];
  rowKey: (r: T) => string;
  estimate: (r: T) => number;
  render: (r: T, index: number) => ReactNode;
  overscanPx?: number;
}

export function VirtualList<T>({ rows, rowKey, estimate, render, overscanPx = 600 }: VirtualProps<T>) {
  const host = useRef<HTMLDivElement>(null);
  const heights = useRef(new Map<string, number>());
  const [version, setVersion] = useState(0);
  const [view, setView] = useState({ top: 0, h: 800 });
  const raf = useRef(0);

  const bump = useCallback(() => {
    if (raf.current) return;
    raf.current = requestAnimationFrame(() => {
      raf.current = 0;
      setVersion((v) => v + 1);
    });
  }, []);

  // prefix offsets; recomputed only when rows change or a measured height changed
  const { offsets, total } = useMemo(() => {
    const o = new Float64Array(rows.length + 1);
    for (let i = 0; i < rows.length; i++) o[i + 1] = o[i] + (heights.current.get(rowKey(rows[i])) ?? estimate(rows[i]));
    return { offsets: o, total: o[rows.length] };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, version]);

  useEffect(() => {
    let pending = 0;
    const read = () => {
      pending = 0;
      const el = host.current;
      if (!el) return;
      const top = -el.getBoundingClientRect().top;
      setView((v) => (Math.abs(v.top - top) < 1 && v.h === window.innerHeight ? v : { top, h: window.innerHeight }));
    };
    const onScroll = () => {
      if (!pending) pending = requestAnimationFrame(read);
    };
    read();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('resize', onScroll);
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('resize', onScroll);
      if (pending) cancelAnimationFrame(pending);
    };
  }, []);

  // binary search for the first row ending after the top of the window
  const lo = view.top - overscanPx;
  const hi = view.top + view.h + overscanPx;
  let a = 0;
  let b = rows.length;
  while (a < b) {
    const mid = (a + b) >> 1;
    if (offsets[mid + 1] < lo) a = mid + 1;
    else b = mid;
  }
  const start = a;
  let end = start;
  while (end < rows.length && offsets[end] <= hi) end++;

  const ro = useRef<ResizeObserver | null>(null);
  const nodes = useRef(new Map<Element, string>());
  useLayoutEffect(() => {
    ro.current = new ResizeObserver((entries) => {
      let changed = false;
      for (const e of entries) {
        const k = nodes.current.get(e.target);
        if (!k) continue;
        const h = Math.round(e.borderBoxSize?.[0]?.blockSize ?? (e.target as HTMLElement).offsetHeight);
        if (h && heights.current.get(k) !== h) {
          heights.current.set(k, h);
          changed = true;
        }
      }
      if (changed) bump();
    });
    return () => ro.current?.disconnect();
  }, [bump]);

  const slice: ReactNode[] = [];
  for (let i = start; i < end; i++) {
    const r = rows[i];
    const k = rowKey(r);
    slice.push(
      <div
        key={k}
        role="listitem"
        aria-posinset={i + 1}
        aria-setsize={rows.length}
        style={{ position: 'absolute', insetInline: 0, top: offsets[i] }}
        ref={(n) => {
          if (n) {
            nodes.current.set(n, k);
            ro.current?.observe(n);
          }
        }}
      >
        {render(r, i)}
      </div>,
    );
  }
  return (
    <div ref={host} role="list" data-virtual-rows={rows.length} data-virtual-rendered={slice.length} style={{ position: 'relative', height: total }}>
      {slice}
    </div>
  );
}
