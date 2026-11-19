import { Suspense } from 'react';
import { Sidebar } from '@/components/Sidebar';
import { contadores } from '@/lib/datos';

export const dynamic = 'force-dynamic';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const n = await contadores().catch(() => ({ despachos: 0, urgentes: 0, preguntas: 0, vigilados: 0 }));
  return (
    <div className="lg:flex">
      <Suspense><Sidebar {...n} /></Suspense>
      <main className="min-w-0 flex-1 px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto flex max-w-[1240px] flex-col gap-5">{children}</div>
      </main>
    </div>
  );
}
