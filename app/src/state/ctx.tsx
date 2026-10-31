import { createContext, useContext, type ReactNode } from 'react';
import type { Model } from './model';

const Ctx = createContext<Model | null>(null);
export function ModelProvider({ m, children }: { m: Model; children: ReactNode }) {
  return <Ctx.Provider value={m}>{children}</Ctx.Provider>;
}
export function useM(): Model {
  const m = useContext(Ctx);
  if (!m) throw new Error('model missing');
  return m;
}
