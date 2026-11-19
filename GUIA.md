# Panel MeLi: instalación en Vercel

Lo que vas a tener:

- **Overview**: lo urgente arriba (Flex con cuenta regresiva al corte), ventas, ganancia y reputación de todas tus tiendas.
- **Despachos**: Flex, colecta y correo de todas las tiendas, ordenados por urgencia.
- **Preguntas**: respondés desde el panel, con respuestas rápidas.
- **Ventas y ganancia**: a dónde va la plata (comisión, envío, impuestos, costo) y la ganancia de cada venta.
- **Productos y costos**: cargás el costo y ves la ganancia por unidad de cada publicación.
- **Pricing**: calculadora con la comisión real de MeLi, en Clásica y Premium.
- **Competencia**: si ganás o perdés el catálogo y a qué precio ganás, publicaciones vigiladas con historial de precios, y vendedores competidores.
- **Publicidad**: Product Ads cruzado con tu margen, para saber qué anuncio pierde plata y cuál conviene escalar.
- **Publicaciones masivas**: cambiar precio, stock o estado de muchas publicaciones a la vez, y copiar publicaciones a otra tienda.
- **Alertas** por Telegram, email y WhatsApp.

Todo gratis: Vercel (la página), Neon (la base de datos) y cron-job.org (lo que la despierta cada 5 minutos).

Tiempo: unos 40 minutos, una sola vez.

---

## 1. Base de datos (Neon)

1. Entrá a [neon.tech](https://neon.tech) y creá una cuenta (podés entrar con GitHub).
2. **Create project**. Nombre: `panel-meli`. Región: **AWS São Paulo** (la más cercana).
3. En **Connection string** activá **Pooled connection** y copiá el texto que empieza con `postgresql://…`. Es tu `DATABASE_URL`.

Las tablas se crean solas la primera vez que abrís el panel.

## 2. Subir la app a Vercel

1. Entrá a [vercel.com](https://vercel.com) con tu cuenta de GitHub.
2. **Add New → Project** → elegí el repositorio del panel → **Import**.
3. Antes de tocar Deploy, abrí **Environment Variables** y cargá:

| Nombre | Valor |
|---|---|
| `DATABASE_URL` | El texto de Neon del paso 1 |
| `APP_PASSWORD` | La contraseña para entrar al panel (elegí una larga) |
| `AUTH_SECRET` | Un texto largo y aleatorio, de 32 caracteres o más. Podés generar uno en [1password.com/password-generator](https://1password.com/password-generator) |
| `CRON_SECRET` | Otro texto aleatorio, distinto del anterior |
| `MELI_CLIENT_ID` | Lo completás en el paso 3 (por ahora poné `pendiente`) |
| `MELI_CLIENT_SECRET` | Ídem |
| `APP_URL` | Lo completás después del primer deploy |

4. **Deploy**. Al terminar, Vercel te da una dirección tipo `https://panel-meli-xxxx.vercel.app`.
5. Volvé a **Settings → Environment Variables**, poné esa dirección en `APP_URL` (sin barra al final) y guardá.

## 3. App de MercadoLibre (una sola vez, sirve para todas tus tiendas)

1. Entrá a [developers.mercadolibre.com.ar](https://developers.mercadolibre.com.ar) con tu cuenta principal → **Mis aplicaciones → Crear aplicación**.
2. **URI de redirect**: `https://TU-APP.vercel.app/api/meli/callback` (con tu dirección real).
3. **Permisos**: lectura y escritura, y **acceso offline**. La escritura hace falta para responder preguntas y para las publicaciones masivas.
4. Guardá y copiá el **App ID** y la **Secret Key**.
5. En Vercel cargalos en `MELI_CLIENT_ID` y `MELI_CLIENT_SECRET`.
6. En Vercel, **Deployments → los tres puntitos del último → Redeploy**, para que tome todas las variables.

## 4. Conectar tus tiendas

1. Abrí tu panel y entrá con `APP_PASSWORD`.
2. **Configuración → + Conectar tienda** → entrá con la cuenta de la tienda → **Permitir**.
3. **Para la segunda tienda:** cerrá sesión en mercadolibre.com.ar en ese navegador y repetí. MeLi te pide el usuario de la otra tienda.

La primera vez trae los últimos 30 días de ventas; tarda unos minutos.

## 5. Que se actualice solo (cron-job.org)

Vercel gratis no puede correr tareas cada 5 minutos, así que lo despierta [cron-job.org](https://cron-job.org) (gratis):

1. Creá una cuenta y tocá **Create cronjob**.
2. En el panel, en **Configuración → Actualización automática**, copiá la primera dirección (`…/api/cron/rapido?key=…`).
3. En cron-job.org: pegala en **URL** y elegí **Every 5 minutes**. Guardá.
4. Creá otro cronjob con la segunda dirección (`…/api/cron/lento?key=…`) y elegí **Every hour**.

Esas direcciones llevan tu `CRON_SECRET`: no las compartas.

## 6. Alertas

Se configuran en **Configuración → Canales**. Al final de la pantalla tocá **Guardar cambios**, y arriba **Mandar alerta de prueba**.

**Telegram (recomendado, te llega todo al instante)**

1. En Telegram, escribile a **@BotFather** `/newbot` y elegí un nombre. Copiá el **token**.
2. Abrí tu bot nuevo y mandale "hola".
3. Abrí `https://api.telegram.org/botTU_TOKEN/getUpdates` en el navegador, buscá `"chat":{"id":` y copiá ese número. Es el **chat id**.

**WhatsApp (gratis con CallMeBot)**: seguí los pasos de [callmebot.com](https://www.callmebot.com/blog/free-api-whatsapp-messages/) para conseguir tu apikey. Por defecto por WhatsApp te llega solo lo urgente.

**Email**: creá una cuenta gratis en [resend.com](https://resend.com), generá una API key y cargala en Vercel como `RESEND_API_KEY`, y después hacé un Redeploy. Sin dominio propio, Resend solo deja mandar al email con el que te registraste.

**Qué te avisa:**
- 🛵 Cada venta Flex nueva, y si sale hoy o mañana.
- ⏰ Recordatorios a las horas que elijas, con lo que hay que despachar hoy.
- 🚨 En la última hora antes del corte Flex, cada 15 minutos por todos los canales, hasta que despaches.
- ❌ Si pasa el corte y quedan Flex sin salir.
- ❓ Cada pregunta nueva, y otra vez si pasa 1 hora sin respuesta.
- ⚠️ Cada reclamo nuevo.
- 📦 El stock bajo, una vez por día.
- 🎯 Si perdés el primer lugar en un catálogo, o si una publicación vigilada o un competidor cambia de precio.
- 📊 Un resumen del día a las 21:00.

## 7. Ganancia real

En **Productos y costos** cargá el costo de cada producto: uno por uno en la tabla, o todos de una pegando desde Excel. Si pagás IIBB o retenciones, poné el porcentaje en **Configuración → Impuestos**.

## 8. En el celular

Abrí el panel en el celular → **Agregar a pantalla de inicio**. Queda como una app.

---

## Si algo no anda

- **"No se pudo conectar" al volver de MeLi:** la URI de redirect de tu app de MeLi tiene que ser exactamente `https://TU-APP.vercel.app/api/meli/callback`, y `APP_URL` tiene que ser la misma dirección, sin barra al final.
- **Sale un error rojo en una tienda:** casi siempre se arregla desconectándola y volviéndola a conectar.
- **Publicidad o Competencia muestran un error de MercadoLibre:** MeLi cambia esas partes de su API seguido. Mandame el mensaje exacto y lo ajusto.
- **El panel no se actualiza solo:** en cron-job.org fijate en el historial que los dos cronjobs respondan **200**. Si dicen **401**, la clave de la dirección no coincide con `CRON_SECRET`.
- **Cambié una variable en Vercel y no hace nada:** hay que hacer **Redeploy**.
