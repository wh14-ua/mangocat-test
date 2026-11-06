# Avisos por WhatsApp (WhatsApp Business Cloud API)

Canal principal de avisos al restaurante y de códigos de acceso al panel. Telegram queda como
alternativa (se puede activar a la vez o dejar desactivado). Documentación oficial consultada en
noviembre de 2026: developers.facebook.com/documentation/business-messaging/whatsapp (mensajes,
plantillas, códigos de error, límites, webhooks, precios, coexistencia).

## 1. Qué hace

- Cuando un pedido se paga (importe autorizado), el Worker envía al WhatsApp del propietario la
  plantilla **`pedido_nuevo`**: número de pedido, importe, resumen de platos, tipo de entrega,
  estado del pago y un botón **«Ver pedido»** que abre el panel seguro en ese pedido
  (`PANEL_URL?pedido=<id>`). **No se acepta ni se rechaza desde WhatsApp**: el botón solo abre el panel.
- Recordatorio (`pedido_sin_aceptar`), incidencias (`pedido_revision`, también cada hora mientras
  nadie las atiende) y rechazo automático (`pedido_cancelado`).
- Código de acceso al panel por WhatsApp (`codigo_acceso`, plantilla de autenticación de Meta con
  botón «Copiar código»), solo a los números autorizados.
- **Sin datos personales**: nunca nombre, teléfono, correo, notas ni dirección del cliente. Los
  pedidos de prueba lo indican en el propio mensaje («PRUEBA, no preparar»).
- **El panel es la fuente de verdad**: si WhatsApp falla, el pedido está igualmente en el panel,
  se gestiona allí y el fallo aparece en «Estado del sistema».

## 2. Fiabilidad

| Situación | Qué hace el sistema |
|---|---|
| Meta acepta el mensaje | Queda «enviado (sin confirmar entrega)». **Entregado** solo cuando llega el recibo de WhatsApp (webhook `delivered`/`read`). |
| Webhook de estado | `/api/whatsapp/webhook`, firma `X-Hub-Signature-256` (HMAC-SHA256 con el secreto de la app) obligatoria. Duplicados, desorden y reintentos de Meta (hasta 7 días) no deshacen nada. |
| Sin respuesta de la API | Puede haberse enviado: no se reintenta enseguida. El recibo, que trae `biz_opaque_callback_data` con el id del aviso, lo reconcilia sin duplicar; si no llega, reintento a los 90 s. |
| Límite por destinatario (131056) | Cada mensaje a un número (avisos y códigos) toma antes su **turno**: uno cada 6 s, contados desde la respuesta de Meta (Meta mide entre llegadas). El turno se toma en una sola operación de D1, así que varios pedidos pagados a la vez no se pisan. Una ráfaga llega al propietario a razón de uno cada ~6 s (cada envío espera su turno hasta 15 s tras el pago —dentro de los 30 s que Cloudflare deja tras la respuesta— y hasta 40 s en cada pasada del cron; lo que no cabe sale en la siguiente). El código de acceso espera su turno hasta 7 s. Si Meta aun así devuelve 131056, espera 6 s × 4ⁿ. |
| Límite de caudal (130429, 4, 80007) | Reintento con espera creciente. |
| Caída de Meta (5xx, 131000, 131016) | Reintentos 15 s → 30 min. |
| Token caducado o inválido (190) | Reintento cada 30 min; «Credenciales de WhatsApp caducadas: renueva el token» en el panel hasta que un aviso posterior se entregue. |
| Plantilla no aprobada / pausada (132xxx) | Igual: visible en el panel como «Plantilla no aprobada o pausada». |
| Número no autorizado en el número de prueba (131030), emisor = destinatario (131021), permisos o cuenta (10, 368…) | Visible en el panel como configuración a revisar. |
| Número sin WhatsApp (131026) | Fallido sin reintentos; el panel lo muestra. |
| Rechazo automático | Solo cuenta desde que WhatsApp **confirma la entrega** (o el pedido se ve en el panel). Un aviso aceptado pero no entregado no inicia el plazo. |

## 3. ¿Sirve el número de WhatsApp Business que ya tiene el restaurante?

- **Como destinatario de los avisos, no**: Meta no permite que el emisor y el destinatario sean el
  mismo número (error 131021). Los avisos tienen que llegar a **otro** WhatsApp (por ejemplo el
  móvil personal del propietario).
- **Como emisor**, el número que hoy usa la app WhatsApp Business solo puede usarse a la vez con
  Cloud API mediante la **coexistencia** de Meta, que **solo pueden activar Solution Partners y
  Tech Providers** (alta por Embedded Signup); una empresa no puede activarla por su cuenta.
  Además: app 2.24.17 o superior, la app debe abrirse con regularidad (se desconecta tras unos
  14 días sin uso), se desactivan listas de difusión, mensajes temporales, «ver una vez» y
  ubicación en tiempo real, y el caudal queda fijo en 20 mensajes/s.
- **Recomendación**: un número propio para el sistema (nueva línea o virtual que reciba el SMS o
  la llamada de verificación) registrado en Cloud API como emisor, y los avisos al WhatsApp
  personal del propietario. Para probar, el **número de prueba gratuito de Meta** basta (puede
  enviar a hasta 5 destinatarios verificados). Si más adelante MangoCat se registra como Tech
  Provider, podría ofrecer la coexistencia con el número actual de cada restaurante.

## 4. Configuración en Meta (una vez por restaurante)

1. Cuenta de Meta Business y app de tipo «Business» en developers.facebook.com con el producto
   **WhatsApp** → se crea una WhatsApp Business Account (WABA) con un número de prueba.
2. **Número emisor**: el de prueba, o uno propio añadido en WhatsApp Manager (verificación por SMS
   o llamada, nombre visible aprobado). Con el número de prueba, añade el WhatsApp del propietario
   como destinatario permitido (Panel de la app → WhatsApp → API Setup → «To»).
3. **Token permanente**: Business settings → System users → usuario de sistema con acceso a la app
   y a la WABA → generar token con `whatsapp_business_messaging` y `whatsapp_business_management`.
   (El token temporal del panel de la app caduca a las 24 h: sirve para una prueba rápida.)
4. **Plantillas**: `WHATSAPP_ACCESS_TOKEN=… WHATSAPP_WABA_ID=… PANEL_URL=https://<worker>/admin node scripts/setup/whatsapp-templates.mjs --create`
   (las de utilidad suelen aprobarse en minutos; `--check` muestra su estado).
5. **Webhook**: en la app → WhatsApp → Configuration: URL `https://<worker>/api/whatsapp/webhook`,
   token de verificación = `WHATSAPP_WEBHOOK_VERIFY_TOKEN`; suscribir el campo **messages**.
6. **Secretos en el Worker** (nunca en archivos del repositorio):
   `wrangler secret put WHATSAPP_ACCESS_TOKEN`, `wrangler secret put WHATSAPP_APP_SECRET`,
   `wrangler secret put WHATSAPP_WEBHOOK_VERIFY_TOKEN`; y en `wrangler.jsonc`:
   `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_RECIPIENTS` (+34…), `PANEL_URL`.
7. Comprobación: `node scripts/setup/whatsapp-check.mjs --send-test-to +34…` (número, plantillas,
   webhooks y un aviso de prueba); el recibo de entrega aparece en el panel («Último aviso entregado»).

## 5. Costes (para separar del precio del servicio)

Desde el 1 de julio de 2025 Meta cobra **por mensaje de plantilla entregado**. Desde el 1 de octubre
de 2026 también se cobran las plantillas de utilidad enviadas dentro de la ventana de 24 h. Tarifa
orientativa para destinatarios en España (2026): **utilidad ≈ 0,0166 €** y **autenticación ≈
0,0166 €** por mensaje (marketing ≈ 0,0509 €, no se usa). Consultar la tabla vigente de Meta antes
de presupuestar. Ejemplo: 300 pedidos/mes con un aviso cada uno ≈ 5 € al mes por destinatario,
más los códigos de acceso (pocos: la sesión dura 30 días).

## 6. Verificado y pendiente

- **Verificado sin credenciales** (simulador fiel a la documentación de Meta): pruebas unitarias y
  de fallos del proveedor, integración con el Worker real y E2E en navegador (aviso → «Ver pedido» →
  panel → ACEPTAR → Stripe → cliente). Ver `docs/qa/SHANG_HAI_QA_REPORT.md`.
- **No verificado con WhatsApp real**: no se considera funcionando hasta comprobar la **entrega
  efectiva** en un teléfono real (recibo `delivered` en el panel).
