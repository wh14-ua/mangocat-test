# Shang Hai — informe de QA del sistema de pedidos

Fecha: 2026-11-06 · Rama: `feat/shang-hai-ordering` (PR #2) · Pagos: solo modo de pruebas, sin dinero real.

## 1. Resultado

- **Errores críticos o altos conocidos sin resolver: ninguno.** Los dos fallos de la demostración
  (A y B) y los dos fallos altos de la auditoría (bloqueos sin dueño y avisos perdidos) están
  reproducidos con pruebas que fallaban antes de la corrección y pasan después.
- **Verificación automática completa:** `npm run qa:full` termina en verde (tabla del apartado 3).
- **Nivel de verificación:** A (unitarias y simulaciones) y B (navegador + Worker real + D1 local,
  con Stripe y Telegram simulados) completos. **Nivel C (Stripe en modo test y Telegram reales)
  pendiente de credenciales** (apartado 7): nada de este informe se ha comprobado contra los
  servicios reales.

## 2. Cómo reproducirlo

| Comando | Qué hace | Tiempo aprox. |
|---|---|---|
| `npm run qa:quick` | Tipos, lint, migraciones, secretos, dependencias, carta, panel, pruebas unitarias y de propiedades | 1–2 min |
| `npm run qa:full` | Todo lo anterior + integración con el Worker real + 90 E2E del modo demo + E2E del sistema de pedidos real. Código de salida ≠ 0 si falla algo; resumen en `test-results/qa-summary.md` | ~20 min |
| `npm test` | Pruebas unitarias, del Worker y de propiedades (40 secuencias por propiedad) | ~30 s |
| `npm run test:integration` | Reinicios, migraciones y concurrencia con workerd + D1 local | ~5 min |
| `npm run test:e2e:demo` / `npm run test:e2e:ordering` | Navegador: modo demo (390/768/1440 px) / sistema de pedidos real (móvil) | 3 / 8 min |
| `npm run test:coverage` | Cobertura del Worker y del motor de pedidos (`test-results/coverage`) | 1 min |
| `npm run db:verify` · `db:check` · `db:check:remote` | Migraciones intactas · esquema de la base local · esquema de la base desplegada (solo lectura) | segundos |
| `npm run security:audit` | Busca credenciales en archivos versionados y vulnerabilidades en dependencias de producción | segundos |

**Aislamiento.** Las pruebas unitarias usan SQLite en memoria; las de integración, carpetas
temporales nuevas en cada ejecución y puertos propios (884x–892x); la E2E del sistema real,
`.local-stack-e2e/` (se borra al empezar). La demo del propietario (`.local-stack/`) nunca se
toca. `qa:full` se niega a empezar si los puertos de la demo (8787, 8790, 4173, 4174) están en
uso. Ninguna prueba llama a servicios externos. GitHub Actions (`.github/workflows/shang-hai-qa.yml`)
ejecuta las comprobaciones rápidas, la integración y las E2E en cada pull request.

**Reproducir un fallo aleatorio.** Las pruebas de propiedades imprimen `seed` y `path`:
`PROPERTY_SEED=<seed> PROPERTY_PATH=<path> npx vitest run workers/shang-hai-orders/test/properties.test.ts`.

## 3. Última ejecución completa

`npm run qa:full` del 2026-11-06 (13:16 UTC), **todos los pasos en verde (código de salida 0)**:

| Paso | Resultado | Tiempo |
|---|---|---|
| TypeScript (webs y pruebas · Worker · panel) | ✅ | 6 s |
| Lint | ✅ | 10 s |
| Migraciones intactas (`migrations.lock.json`) y esquema generado al día | ✅ | <1 s |
| Búsqueda de credenciales en archivos versionados | ✅ (346 archivos) | <1 s |
| Auditoría de dependencias de producción (alta o crítica) | ✅ 0 vulnerabilidades | 1 s |
| Datos de la carta y bundle del panel al día | ✅ | 1 s |
| Pruebas unitarias, del Worker y de propiedades (300 secuencias por propiedad) | ✅ **308** (24 archivos) | 44 s |
| Worker empaquetado para Cloudflare (dry run) | ✅ 388,7 KiB (105,7 KiB gzip) | 18 s |
| Integración con el Worker real (workerd + D1 local): reinicios (12), migraciones con wrangler (5), concurrencia y carga acotada (6) | ✅ **23** | 291 s |
| E2E de las webs en modo demo (390/768/1440 px, axe, ES/EN, fotos) | ✅ **90** | 121 s |
| E2E del sistema de pedidos real (Worker + D1 + Stripe/Telegram simulados), incl. 6 recorridos completos de 20 pasos (3 diseños × ES/EN) | ✅ **18** | 464 s |

**Total: 439 pruebas automáticas, 0 fallos.** Tras esa ejecución solo cambió la visibilidad de
los fallos del cron en el panel (con su prueba, 309 unitarias en total); `npm run qa:quick` y las
23 de integración se repitieron sobre el código final, en verde.

## 4. Fallos reales encontrados y corregidos

Cada corrección tiene una prueba automática; «antes» indica que la prueba se ejecutó contra el
código anterior y falló.

| Id | Sev. | Síntoma | Causa | Corrección | Prueba (antes → después) |
|---|---|---|---|---|---|
| A | Alta | Demo: «No migrations to apply» y después `D1_ERROR: no such column: staff_seen_at` | La migración 0002 se editó (commit 6c8bff8) después de que la base local la hubiera aplicado; wrangler solo registra el nombre del archivo | Huellas SHA-256 de cada migración (`migrations.lock.json`); detección y reparación aditiva del esquema al arrancar la demo (con copia de seguridad); el Worker responde 503 `schema-outdated` en vez de fallar a medias | `schema.test.ts` (500 con el error exacto → 503); `migrations.test.ts` con wrangler real |
| B | Alta | Demo: pedido #1002 «PROCESANDO — Aceptando» más de 30 min (`order.accept-unknown status:404`) | El Stripe simulado perdía sus datos al reiniciar mientras D1 los conservaba, y el Worker trataba un 404 como fallo temporal sin límite de reintentos | Estado del Stripe/Telegram simulados persistido junto a D1; fallos de Stripe clasificados (404 → EN REVISIÓN al momento; sin respuesta → reintentos y EN REVISIÓN a los 5 min); timeout en cada llamada | `recovery.test.ts` (7 fallaban: 202 en vez de 502…); `restarts.test.ts` |
| B2 | Alta | Tras un error 500 de Stripe, ACEPTAR/RECHAZAR nunca volvía a funcionar | Stripe repite durante 24 h el 500 guardado para la misma clave de idempotencia; las claves eran fijas | Clave nueva por intento, siempre tras leer el estado real en Stripe | `recovery.test.ts`; una prueba existente pasaba solo porque el simulador no imitaba a Stripe |
| PAY-F1 | Alta | Un REINTENTAR de otro móvil o el cron podían deshacer una aceptación con el cobro en curso: tarjeta cobrada, pedido «pendiente» y, más tarde, rechazo automático con reembolso | Los bloqueos accepting/rejecting no tenían dueño ni caducidad | Migración 0003 (aditiva): `lock_token` y `lock_expires_at`; solo el dueño termina el bloqueo; la recuperación solo toma bloqueos caducados, de forma atómica, y lee Stripe antes de actuar | `locks.test.ts` (8 de 10 fallaban) |
| PAY-F3 | Alta | Un pedido que volvía a EN REVISIÓN (p. ej. un reembolso que falla de nuevo días después) no avisaba | Clave única por pedido y tipo + `INSERT OR IGNORE` | Cada incidencia rearma su aviso; el cron recrea avisos perdidos y recuerda cada hora las incidencias sin atender | `alerts.test.ts` (7 de 7 fallaban) |
| PAY-F2 | Media | El rechazo automático podía declinar un pedido justo cuando el personal lo estaba aceptando | El plazo no tenía en cuenta las decisiones del personal | 10 min de gracia tras cualquier ACEPTAR/RECHAZAR; un intento fallido desde EN REVISIÓN vuelve a EN REVISIÓN | `locks.test.ts` |
| — | Media | RECHAZAR pulsado sobre un pedido nuevo cobraba y devolvía si otro móvil lo había aceptado un instante antes | El servidor no sabía qué estado veía el móvil | Las acciones envían el estado mostrado; si cambió, 409 | `locks.test.ts`, `concurrency.test.ts` |
| PAY-F4 | Media | Un aviso cuya escritura fallaba se perdía para siempre | El aviso se encolaba tras confirmar el cambio, sin reconciliación | Reconciliación de avisos en el cron | `alerts.test.ts` |
| PAY-F6 | Media | Un pago «en proceso» se cancelaba a los 75 min y luego se cobraba | El cron no miraba el estado del pago | Solo se cierra si no hay pago en curso | `reconciliation.test.ts` |
| PAY-F7 | Media | ACEPTAR sobre un pago ya cobrado no consultaba Stripe (un reembolso del Dashboard llegaba a cocina como pagado) | — | Se lee Stripe y sus reembolsos antes de aceptar | `reconciliation.test.ts` |
| PAY-F8 | Baja | 20 pedidos que no se podían leer bloqueaban el resto de la cola del cron | Cola sin rotación | Rotación por `updated_at` | `reconciliation.test.ts` |
| PAY-F10/F11/F12 | Baja | Pedido sin sesión de pago nunca cerrado; importe revisado que volvía a revisión; webhooks perdidos con los pagos desactivados | — | Checkout falla de forma segura; comprobación de importe solo antes de aceptar; 5xx para que Stripe reintente | `reconciliation.test.ts` |
| PAY-F5/F9 | Baja | Avisos a móviles retirados; aviso de rechazo automático que decía «no se ha cobrado nada» aunque se hubiera cobrado | — | Destinatarios vigentes; texto según el estado final del pago | `alerts.test.ts` |
| 409 | Media | Un 409 de Stripe (clave en uso) se trataba como rechazo definitivo | — | Resultado incierto: se reconcilia | `failureKind` + propiedades |
| SEC-02/03 | Media | Cualquiera podía pedir códigos de acceso en ráfaga y agotar la cuota (bloqueo del personal durante 1 h); se aceptaban peticiones sin `Origin` | Comprobación no atómica, sin limitador | Inserción atómica, limitador por IP, `Origin` obligatorio | `security.test.ts` (5 fallaban) |
| SEC-01/04/05 | Baja | Más de 5 intentos con peticiones simultáneas; token de seguimiento en `Referer`; limitador que falla en silencio | — | Intento atómico, `no-referrer`, registro | `security.test.ts` |
| FE-01/02 | Alta | La página de estado vaciaba el carrito actual con cualquier pedido antiguo; con precios desactualizados el pago entraba en bucle | — | Se vacía solo el carrito de ese pedido; el mensaje da el total nuevo y lo confirma | E2E + unitarias |
| FE-03/05/06/09/10 | Media/Baja | Motivos en español en la web inglesa; botón de pago bloqueado al volver de Stripe; peticiones sin timeout; hora estimada congelada; paso «Aceptado» antes de aceptar | — | Corregidos | `order-view.test.ts`, `api-gateway.test.ts` |
| FE-04/14 | Media/Baja | En el panel, LISTO/ENTREGADO/REINTENTAR fallaban en silencio; avisos críticos desaparecían; «Procesando» sin hora | — | Aviso de error, avisos críticos fijos, hora de inicio | panel |
| Fuzz | Baja | Un webhook firmado cuyo JSON no es un objeto (`null`) daba 500 | Falta de validación de tipo | 400 | encontrado por `properties.test.ts`; `webhook.test.ts` |

## 5. Garantías comprobadas automáticamente

Las pruebas de propiedades generan secuencias aleatorias de acciones del personal (algunas
simultáneas o sobre una vista desactualizada), ejecuciones del cron, saltos de reloj, fallos de
Stripe (400/404/409/429/500/502/503/504, sin respuesta, respuesta perdida después de actuar),
webhooks tardíos/duplicados/desordenados/perdidos, reembolsos pendientes o fallidos y
autorizaciones caducadas, en los dos modos de captura. Tras **cada paso** se comprueba:

1. nunca se cobra más de lo autorizado ni más que el total del pedido, y nunca se cobra dos veces;
2. nunca se devuelve más de lo cobrado;
3. un pedido nunca aparece como cobrado, ni llega a cocina, sin que Stripe lo confirme;
4. un reembolso nunca aparece como completado sin que Stripe lo confirme;
5. el servidor nunca responde 500.

Y **al estabilizarse** (Stripe sano, webhooks entregados, cron ejecutado): ningún bloqueo
pendiente, ningún pedido rechazado se queda con el dinero ni con la retención en la tarjeta,
toda incidencia EN REVISIÓN tiene su aviso y D1 coincide con Stripe. Comprobación de que estas
pruebas detectan errores reales: tres mutaciones deliberadas del código (reembolso pendiente
mostrado como completado; rechazo sin devolución; bloqueos siempre caducados) fueron detectadas.
El fuzzing de checkout, acciones del personal y webhooks nunca obtiene un 500 ni un precio
distinto al del servidor.

## 6. Cobertura (pruebas unitarias y del Worker)

Medida con `npm run test:coverage` (309 pruebas) sobre el Worker y el motor de pedidos:

| Archivo | Líneas | Ramas |
|---|---|---|
| `workers/shang-hai-orders/src/payments.ts` (reconciliación con Stripe) | 100 % | 92,6 % |
| `workers/shang-hai-orders/src/cron.ts` (recuperación, plazos, avisos) | 96,9 % | 90,9 % |
| `workers/shang-hai-orders/src/actions.ts` (aceptar, rechazar, reembolsar, bloqueos) | 94,5 % | 74,8 % |
| `workers/shang-hai-orders/src/notifications.ts` | 96,6 % | 84,4 % |
| `workers/shang-hai-orders/src/staff-auth.ts` (acceso del personal) | 98,1 % | 81,6 % |
| `workers/shang-hai-orders/src/stripe.ts` | 93,3 % | 87,0 % |
| `workers/shang-hai-orders/src/sync.ts` | 87,5 % | 77,6 % |
| `workers/shang-hai-orders/src/webhook.ts` | 89,5 % | 79,4 % |
| `workers/shang-hai-orders/src/checkout.ts` | 87,7 % | 80,4 % |
| `workers/shang-hai-orders/src/db.ts` | 96,8 % | 75,0 % |
| `workers/shang-hai-orders/src/schema.ts` | 86,8 % | 76,0 % |
| `src/lib/commerce/pricing.ts` · `validation.ts` · `orders.ts` | 95,8 · 97,8 · 100 % | 93,3 · 88,6 · 90 % |
| **Total** | **89,7 %** | **80,2 %** |

Las ramas sin cubrir de `actions.ts` son sobre todo caminos defensivos (pagos sin configurar,
pedido sin pago asociado); los caminos de dinero están cubiertos además por la tabla de decisión,
las propiedades y la integración.

La integración y las E2E ejercitan además el Worker real, pero no cuentan en estas cifras.

## 7. Qué se ha verificado con simuladores y qué no

| Nivel | Estado |
|---|---|
| A — unitarias y simulaciones | Completo |
| B — navegador + Worker real (workerd) + D1 local, Stripe y Telegram simulados | Completo: reinicios, migraciones con wrangler, concurrencia, 90 E2E demo, 18 E2E del sistema real |
| C — Stripe en modo test y Telegram reales | **No ejecutado: faltan credenciales** |

El Stripe simulado imita la semántica documentada de Stripe que importa aquí (autorización y
captura, cancelación, reembolsos pendientes/fallidos, idempotencia con 500 guardados y respuestas
perdidas, 404, webhooks firmados), pero no es Stripe. **Para el nivel C hace falta:**

1. Clave secreta de Stripe **de prueba** (`sk_test_…`) → `wrangler secret put STRIPE_SECRET_KEY`.
2. Secreto del webhook → `node scripts/setup/stripe-webhook.mjs --save`.
3. Token del bot de Telegram (@BotFather) → `wrangler secret put TELEGRAM_BOT_TOKEN`.
4. Ids de los chats del personal → `node scripts/setup/telegram-chat-ids.mjs` → `TELEGRAM_CHAT_IDS`.
5. Base D1 creada en Cloudflare (`wrangler d1 create`) y `PANEL_URL`.

## 8. Pendiente y riesgos residuales

**¿Qué errores podrían seguir apareciendo en una demostración real, y qué evidencia hay?**

- **Diferencias entre el Stripe real y el simulado** (página de pago real, Link, 3-D Secure,
  idioma de Checkout, límites de la API). Evidencia: ninguna con Stripe real; el comportamiento
  del sistema ante cada respuesta posible está cubierto por las pruebas con el simulador.
  Mitigación: primera prueba del nivel C con una tarjeta de prueba antes de enseñarlo.
- **Telegram real** (formato HTML, límites de envío, bot bloqueado). Evidencia: reintentos,
  bloqueos (403) y caídas probados con el simulador; si falla, el pedido sigue en el panel y no
  se rechaza solo.
- **Navegadores reales**: verificado en Chrome (escritorio y emulación móvil). No verificado en
  Safari de iPhone. Riesgo bajo en lo funcional; el panel instalado en pantalla de inicio de
  iPhone no se ha probado.
- **Dos pestañas pagando el mismo pedido**: podría haber dos autorizaciones; ninguna se cobra
  hasta que el restaurante acepta, y el duplicado se rechaza (retención liberada).
- **Pedidos fuera de horario**: hoy se aceptan a cualquier hora; decisión del propietario.
- **Pendientes menores** (no afectan al dinero ni a los pedidos): foco al quitar una línea del
  carrito (accesibilidad), anuncios de cambios de pago para lectores de pantalla en dos diseños,
  el botón «+» al llegar a 60 unidades no avisa, el día del historial del panel en los cambios de
  hora, y los fallos de un paso del cron solo quedan en el registro (no en «Estado del sistema»).

**Decisiones del propietario:** plazo de rechazo automático (30 min) y tiempos de preparación,
horario del canal online, traducciones al inglés, fotos ilustrativas, y la activación de pagos
reales (no activada).

## 9. Estado de los servicios en local

| Servicio | Conserva estado | Dónde |
|---|---|---|
| D1 (pedidos, eventos, sesiones) | Sí | `.local-stack/v3/d1` |
| Stripe simulado (pagos, reembolsos, claves de idempotencia, webhooks pendientes) | Sí | `.local-stack/fake-stripe.json` |
| Telegram simulado (mensajes) | Sí | `.local-stack/fake-telegram.json` |
| Worker, webs, fallos inyectados, cron | No | — |

`npm run demo:local -- --fresh` borra solo `.local-stack/`. Al arrancar, la demo comprueba el
esquema (y lo repara sin perder datos, con copia previa) y la coherencia entre D1 y el Stripe
simulado.

## 10. WhatsApp Business Cloud API (canal principal de avisos)

Implementado sobre la misma cola de avisos (Telegram queda como alternativa). Guía:
[`SHANG_HAI_WHATSAPP.md`](../../SHANG_HAI_WHATSAPP.md).

| Qué se comprueba | Dónde | Resultado |
|---|---|---|
| Plantilla `pedido_nuevo` al WhatsApp del propietario: número, importe, platos, entrega, pago, botón al panel; sin datos personales | `whatsapp.test.ts`, E2E | ✅ |
| «Entregado» solo con el recibo de WhatsApp; recibos repetidos, desordenados o tardíos no deshacen nada | `whatsapp.test.ts`, `integration/whatsapp.test.ts` | ✅ |
| Webhook: firma `X-Hub-Signature-256` obligatoria, verificación de suscripción, mensajes ajenos ignorados | `whatsapp.test.ts` | ✅ |
| Token caducado (190), plantilla no aprobada (132001), número no permitido (131030), emisor = destinatario (131021), sin WhatsApp (131026), caudal (130429), caídas (5xx/131000/2), límite por destinatario (131056) | `whatsapp.test.ts`, integración, E2E | ✅ cada uno con su política de reintento y su aviso en el panel |
| Respuesta perdida: el recibo con `biz_opaque_callback_data` evita el duplicado; sin recibo, reintento a los 90 s | `whatsapp.test.ts` | ✅ |
| Ritmo por destinatario (≈1 mensaje cada 6 s, también tras un código de acceso) | `whatsapp.test.ts` (encontró un fallo real durante el desarrollo, corregido) | ✅ |
| Rechazo automático: solo cuenta un aviso de WhatsApp **entregado** | `whatsapp.test.ts` | ✅ |
| Código de acceso al panel por WhatsApp (plantilla de autenticación con «Copiar código»), solo a números autorizados | `whatsapp.test.ts`, E2E | ✅ |
| Migración 0004 (reconstrucción de avisos y sesiones sin perder datos ni ids) | `migration.test.ts`, migraciones con wrangler | ✅ |
| Recorrido en navegador: aviso en el WhatsApp del propietario → «Ver pedido» → panel → ACEPTAR → Stripe cobra → el cliente lo ve; recibos de entrega y lectura en D1 | E2E del sistema real | ✅ |
| WhatsApp caído (token caducado): el pedido sigue en el panel y «Estado del sistema» dice qué arreglar | E2E del sistema real | ✅ |
| **Entrega real en un teléfono con WhatsApp real** | — | **Pendiente: faltan los datos de Meta** |

Datos de Meta necesarios para la prueba real: id de la cuenta de WhatsApp Business (WABA), id del
número emisor (el número de prueba de Meta basta), token de usuario de sistema con
`whatsapp_business_messaging` y `whatsapp_business_management`, secreto de la app, y el número de
WhatsApp que recibirá los avisos (añadido como destinatario permitido si se usa el número de prueba).
El webhook de Meta necesita una URL pública del Worker (despliegue de prueba o túnel), que requiere
autorización.
