# Panel MeLi

Panel para operar varias tiendas de MercadoLibre Argentina: despachos Flex con alertas, preguntas, ventas y ganancia real, pricing, competencia en catálogo, publicidad y publicaciones masivas.

Next.js 15 + Postgres (Neon). Pensado para Vercel gratis + cron-job.org.

**Instalación paso a paso: [GUIA.md](GUIA.md).**

## Desarrollo

```bash
cp .env.example .env.local   # completar
npm install
npm run dev
```

- `src/lib/meli.ts`: cliente de la API de MercadoLibre (OAuth multi-cuenta, tokens cifrados, reintentos).
- `src/lib/sync.ts`: sincronización (ventas, envíos, preguntas, reclamos, publicaciones).
- `src/lib/alertas.ts`: alertas por Telegram, Resend y CallMeBot, sin repetir.
- `src/lib/competencia.ts`, `src/lib/publicidad.ts`, `src/lib/masivo.ts`: competencia, Product Ads y acciones masivas.
- `/api/cron/rapido` (cada 5 min) y `/api/cron/lento` (cada hora), protegidos con una clave (CRON_SECRET o derivada de AUTH_SECRET).
