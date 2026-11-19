export default async function Login({ searchParams }: { searchParams: Promise<{ error?: string; volver?: string }> }) {
  const sp = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form action="/api/auth/login" method="post" className="flex w-full max-w-sm flex-col gap-4 rounded-2xl border border-line bg-panel p-6">
        <div>
          <div className="text-lg font-extrabold tracking-wide">PANEL <span className="text-xs font-semibold tracking-[.2em] text-muted">MELI</span></div>
          <p className="mt-1 text-muted">Ingresá la contraseña del panel.</p>
        </div>
        <input type="hidden" name="volver" value={sp.volver || '/'} />
        <label className="flex flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Contraseña</span>
          <input id="clave" name="clave" type="password" autoFocus required autoComplete="current-password" />
        </label>
        {sp.error && <p className="text-[13px] text-bad">Contraseña incorrecta. Es la que pusiste en APP_PASSWORD en Vercel.</p>}
        <button className="rounded-lg bg-accent py-2 font-semibold text-white">Entrar</button>
      </form>
    </main>
  );
}
