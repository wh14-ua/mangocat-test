# Shang Hai — sistema de pedidos online: puesta en marcha, demostración y estado

Cómo funciona el sistema real de pedidos de las tres propuestas (Ink House, Wok After Dark,
Bento Club), qué hay que configurar, cómo probarlo de punta a punta y qué está verificado.
Documentación técnica: [`workers/shang-hai-orders/README.md`](./workers/shang-hai-orders/README.md).

## 1. El recorrido de un pedido

```
Cliente (ES/EN)            Stripe Checkout              Worker (Cloudflare + D1)          Restaurante (móvil)
───────────────            ───────────────              ────────────────────────          ───────────────────
elige platos ─► paga ───►  AUTORIZA el importe  ─webhook─► pedido «pendiente de           🔔 Telegram: «NUEVO PEDIDO #1042»
                           (reservado, sin cobrar)        aceptación»  ───────────────►   panel SHANG HAI — PEDIDOS
                                                                                           ACEPTAR (15/20/30/45 min o el
estado: «Pendiente de      ◄───────────────────────────── estado en vivo                    que se escriba) / RECHAZAR
aceptación · Pago                                          │
autorizado (sin cobrar)»                                   ├─ ACEPTAR  ─► Stripe COBRA ─► «En preparación · listo hacia
                                                           │                               las 14:05»  ─► LISTO ─► ENTREGADO
                                                           └─ RECHAZAR ─► Stripe ANULA la reserva (o DEVUELVE si ya se
                                                                          cobró) ─► «Rechazado · no se te ha cobrado nada»
```

- **Nunca se cobra un pedido que el restaurante no ha aceptado**, y la cocina no ve como
  aceptado un pedido cuyo cobro no se ha confirmado.
- Si nadie decide: recordatorio a los 4 min y, a los 30 min, rechazo automático con la reserva
  anulada (configurable: `ACCEPTANCE_REMINDER_MINUTES`, `ACCEPTANCE_TIMEOUT_MINUTES`).
- El cliente ve el estado real en su pantalla (se actualiza sola): pago pendiente, pendiente de
  aceptación, aceptado con hora estimada, en preparación, listo, entregado, rechazado (con el
  motivo si el restaurante lo indica), reembolso pendiente/completado. La hora solo aparece
  cuando el restaurante la ha indicado.

## 2. Estado real de cada parte

| Parte | Implementado | Probado con simuladores | Probado con servicios reales (modo test) | Desplegado |
|---|---|---|---|---|
| Tres webs en ES/EN, selector, carta traducida | Sí | Sí (unit + E2E) | — | No (rama, sin publicar) |
| Checkout → Stripe Checkout (autorización, `locale` del cliente) | Sí | Sí: Stripe simulado + `wrangler dev` | **No** (faltan claves de prueba) | No |
| Webhooks, conciliación, idempotencia | Sí | Sí (69 tests + recorrido en workerd) | **No** | No |
| Aceptar (cobro) / rechazar (anulación o reembolso) | Sí | Sí | **No** | No |
| Avisos Telegram, reintentos, recordatorio, caducidad | Sí | Sí: Telegram simulado | **No** (falta el bot) | No |
| Panel móvil + acceso con código de Telegram | Sí | Sí | **No** | No |
| Cloudflare Access (opcional) | Sí (verificación JWT) | Sí (JWT firmados en tests) | **No** | No |
| Fotos de platos (20, IA, ilustrativas) | Sí | Sí | — | No |
| Pagos reales | **Desactivados a propósito** | — | — | — |

No hay nada desplegado: ni Worker ni base de datos en Cloudflare (se comprobó que no existen),
y GitHub Pages sigue sirviendo la versión anterior hasta que se fusione la rama.

## 3. Credenciales que tienes que configurar (lista corta)

| Qué | Dónde se consigue | Dónde se guarda |
|---|---|---|
| Clave secreta de Stripe **de prueba** (`sk_test_…`) | Stripe Dashboard → modo de prueba → Desarrolladores → Claves API | `wrangler secret put STRIPE_SECRET_KEY` |
| Secreto del webhook de Stripe (`whsec_…`) | Lo crea `scripts/setup/stripe-webhook.mjs` | `wrangler secret put STRIPE_WEBHOOK_SECRET` (el script lo hace con `--save`) |
| Token del bot de Telegram | @BotFather → `/newbot` | `wrangler secret put TELEGRAM_BOT_TOKEN` |
| Ids de los chats del personal | `scripts/setup/telegram-chat-ids.mjs` | `wrangler.jsonc` → `TELEGRAM_CHAT_IDS` (no es secreto) |
| Cuenta de Cloudflare (ya tienes sesión de `wrangler`) | — | — |

Nada de esto va en archivos del repositorio. Opcional: Cloudflare Access (`ACCESS_TEAM_DOMAIN`,
`ACCESS_AUD`), solo si queréis un segundo método de acceso al panel.

## 4. Puesta en marcha en modo de pruebas (sin dinero real)

```bash
cd workers/shang-hai-orders

# 1) Base de datos y Worker
npx wrangler d1 create shang-hai-orders          # copia el database_id en wrangler.jsonc
npm run db:migrate:remote                         # aplica 0001 y 0002
npm run deploy                                    # primera publicación: anota la URL https://shang-hai-orders.<sub>.workers.dev

# 2) Stripe (modo prueba). Activa Link en Dashboard → Configuración → Métodos de pago (Wallets).
npx wrangler secret put STRIPE_SECRET_KEY         # sk_test_…
cd ../.. && STRIPE_SECRET_KEY=sk_test_… node scripts/setup/stripe-webhook.mjs https://shang-hai-orders.<sub>.workers.dev --save
cd workers/shang-hai-orders

# 3) Telegram: crea el bot con @BotFather; cada persona del restaurante le envía /start
npx wrangler secret put TELEGRAM_BOT_TOKEN
cd ../.. && TELEGRAM_BOT_TOKEN=… node scripts/setup/telegram-chat-ids.mjs && cd workers/shang-hai-orders
#    → pon los ids en wrangler.jsonc: "TELEGRAM_CHAT_IDS": "111,222"
#    → y "PANEL_URL": "https://shang-hai-orders.<sub>.workers.dev/admin"
npm run deploy

# 4) Webs: compila apuntando al Worker (para GitHub Pages, añade la variable al paso
#    "Build static export" de .github/workflows/deploy.yml)
cd ../.. && NEXT_PUBLIC_ORDER_API_BASE_URL=https://shang-hai-orders.<sub>.workers.dev npm run build
```

`CORS_ALLOWED_ORIGIN`, `STRIPE_SUCCESS_URL` y `STRIPE_CANCEL_URL` ya apuntan a
`https://wh14-ua.github.io/mangocat-test/…`. Mientras `NEXT_PUBLIC_ORDER_API_BASE_URL` esté
vacío, las webs siguen en modo demostración (simulador en el navegador).

### Prueba con dos móviles (la demostración para el propietario)

1. Móvil A: abre BENTO CLUB, elige platos, paga con la tarjeta de prueba `4242 4242 4242 4242`
   (cualquier fecha futura y CVC). Verás «Pendiente de aceptación · Pago autorizado».
2. Móvil B: llega el aviso de Telegram «🧪 PRUEBA · NUEVO PEDIDO #1001» → «VER PEDIDO».
3. Móvil B: la primera vez, «ENVIAR CÓDIGO» → llega por Telegram → escríbelo → ya estás dentro
   (30 días). Pulsa ACEPTAR → 20 min.
4. Móvil A: cambia solo a «En preparación · listo hacia las HH:MM».
5. Móvil B: MARCAR COMO LISTO → el móvil A muestra «Listo para recoger».
6. Repite con INK HOUSE y WOK AFTER DARK, y prueba RECHAZAR (el móvil A dirá «no se te ha
   cobrado nada»), una tarjeta rechazada (`4000 0000 0000 0002`) y cancelar el pago.

En el Dashboard de Stripe (modo prueba) verás cada pago como «No capturado» hasta que se acepta.

## 5. Demostración completa sin ninguna cuenta (en tu ordenador)

```bash
npm run demo:local
```

Arranca el Worker real (wrangler dev, base de datos D1 local), un Stripe simulado con su página
de pago y webhooks firmados, un Telegram simulado («móvil del personal») y las tres webs:

- Webs: http://localhost:4174/mangocat-test/showcase/shang-hai/
- Panel: http://localhost:8787/admin (el código de acceso aparece en el móvil simulado)
- Móvil del personal: http://localhost:8790/telegram

## 6. El panel del restaurante

- URL: `https://<worker>/admin`. En el iPhone: Compartir → «Añadir a pantalla de inicio»; en
  Android: menú → «Instalar aplicación». Se abre como una app.
- Acceso: código de 6 cifras enviado por Telegram solo a los chats autorizados; caduca en
  10 min, un solo uso, 5 intentos. Sesión de 30 días por móvil (cookie HttpOnly, nada en
  `localStorage`). «Cerrar sesión en todos los móviles» desde el propio panel.
- Por qué no solo Cloudflare Access: en iPhone, las apps de pantalla de inicio tienen cookies
  separadas de Safari y el inicio de sesión de Access (redirección a otro dominio) falla de
  forma intermitente; además el alta en Zero Trust pide un método de pago. Access sigue
  soportado: si se configura, el panel acepta su JWT (verificado en el servidor).
- Si dos personas pulsan ACEPTAR a la vez, solo una operación cuenta; la otra ve «Este pedido
  ya estaba aceptado». Todo queda en el historial con quién lo hizo.

## 7. Pagos: qué está habilitado y por qué

- **Autorizar ahora, cobrar al aceptar** (`capture_method=manual`). Stripe oculta solo los
  métodos que no permiten reservar el importe. Quedan tarjeta, Apple Pay y Google Pay, y
  **Link** cuando el cliente es elegible y está activado en el Dashboard (no aparece siempre).
- No se envía `payment_method_types`: la versión de API fijada (`2026-09-30.endive`) lo
  rechaza; los métodos se gestionan en el Dashboard.
- `STRIPE_CAPTURE_MODE=per-method` permitiría además métodos sin reserva (p. ej. Bizum, si
  Stripe lo aprueba para la cuenta): se cobran al pagar y, si el restaurante rechaza, se
  devuelven automáticamente (implementado y probado). Por defecto queda desactivado.
- Una reserva de tarjeta dura unos 7 días; el sistema decide en minutos (caducidad a los 30).
- El cliente nunca ve «cobrado» hasta que Stripe confirma la captura, ni «reembolso
  completado» hasta que Stripe confirma el reembolso.

## 8. Cuando algo falla

| Situación | Qué pasa |
|---|---|
| Telegram no entrega | El pedido está igualmente en el panel; reintentos con espera creciente; el fallo se ve en «Estado del sistema» |
| Stripe no responde al aceptar | El pedido queda «Procesando…», no se prepara; un minuto después el sistema mira el estado real en Stripe y lo termina o lo devuelve a pendientes |
| La autorización caducó | ACEPTAR responde «NO prepares este pedido; no se ha cobrado nada» y el pedido se cancela |
| Falla un reembolso | El pedido queda **EN REVISIÓN** (rojo) con el motivo y un aviso por Telegram; RECHAZAR de nuevo lo reintenta |
| Se pierde un webhook | El cron consulta Stripe cada minuto y recupera el estado |
| Webhooks repetidos o desordenados | Sin efecto: cada evento se procesa una vez y el estado se lee siempre de Stripe |

## 9. Qué debe confirmar el restaurante antes de usarlo

1. Tiempos de preparación que quiere ofrecer (por defecto 15/20/30/45 min) y la regla de
   caducidad (30 min sin respuesta → rechazo automático).
2. Revisión de las traducciones al inglés (`src/data/shang-hai/menu-translations.ts`; tres
   puntos marcados para confirmar: «sepia», fideos Singapur, y textos publicados corregidos).
3. Si quiere fotos en la carta y si aprueba las 20 ilustrativas o prefiere fotos propias.
4. Lo ya pendiente: teléfono de pedidos, horario del canal propio, alérgenos, vinos online.
5. Para cobrar de verdad: su propia cuenta de Stripe y su aprobación expresa
   (`STRIPE_TEST_MODE=false` + `PAYMENTS_LIVE_ENABLED=true`). **No está activado.**
