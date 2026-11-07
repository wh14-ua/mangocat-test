# Shang Hai — entorno público de pruebas (demo)

Un entorno completo en Cloudflare para probar desde el móvil y para enseñar el sistema a otros
restaurantes. **Todo es de prueba:** Stripe en modo test (ningún cargo real) y el número de prueba
gratuito de Meta para WhatsApp. No es una versión comercial.

| | URL |
|---|---|
| Tiendas (las tres) | https://shang-hai-demo-tiendas.wt-hu04.workers.dev/ |
| Panel del restaurante | https://shang-hai-demo.wt-hu04.workers.dev/admin |
| Estado de la API | https://shang-hai-demo.wt-hu04.workers.dev/api/health |

Garantías:
- El Worker de la demo (`shang-hai-demo`) solo acepta claves de **prueba** de Stripe
  (`STRIPE_TEST_MODE="true"`, `PAYMENTS_LIVE_ENABLED="false"`); una clave real deja los pagos
  desactivados. Una prueba automática (`deploy-config.test.ts`) impide cambiarlo por error.
- Tiene su propia base de datos (`shang-hai-demo`), separada de cualquier producción.
- Ningún secreto está en el repositorio: se guardan como secretos de Cloudflare con
  `node scripts/setup/demo.mjs secrets`, que los pide con texto oculto en tu terminal.
  Tu número de WhatsApp y el id del número emisor también se guardan como secretos.
- Los buscadores no indexan la demo (`X-Robots-Tag: noindex`).

## 1. Stripe (modo de prueba, 5 min)

1. Entra en https://dashboard.stripe.com (crea la cuenta si no tienes; para el modo de prueba no
   hace falta verificar el negocio).
2. Activa el **modo de prueba** (o abre un *sandbox*): arriba verás «Entorno de prueba».
3. **Desarrolladores → Claves de API** → copia la **clave secreta** `sk_test_…`
   (nunca la `sk_live_…`: el script y el Worker la rechazan).

El webhook de Stripe lo crea el script del paso 3.

## 2. Meta / WhatsApp (número de prueba, 15–20 min)

1. https://developers.facebook.com → **Mis apps → Crear app** → caso de uso **«Conectar con
   clientes a través de WhatsApp»** → elige o crea un portfolio comercial → crear.
2. En la app: **Personalizar caso de uso → WhatsApp → Inicio rápido → Empezar a usar la API**
   (página *API Setup*):
   - **Generar token de acceso** (token temporal, dura 24 h).
   - En **De** está el número de prueba: copia su **Identificador del número de teléfono**
     (*Phone number ID*) y el **Identificador de la cuenta de WhatsApp Business** (*WABA ID*).
   - En **Para → Administrar lista de números**: añade tu móvil y confírmalo con el código que
     te llega por WhatsApp (hasta 5 números; los mensajes del número de prueba no se cobran).
3. **Configuración de la app → Básica → Clave secreta de la app → Mostrar** (*App Secret*).
4. Para que la demo funcione más de 24 h, un **token permanente**: https://business.facebook.com →
   **Configuración del negocio → Usuarios → Usuarios del sistema → Añadir** (administrador) →
   **Asignar activos**: la app y la cuenta de WhatsApp, con control total → **Generar token** →
   la app, caducidad «Nunca», permisos `whatsapp_business_messaging` y
   `whatsapp_business_management` (y `business_management` si lo pide).

## 3. Guardar las credenciales (en tu terminal, no en el chat)

```bash
cd ~/Descargas/mangocat-test-wt/ordering
node scripts/setup/demo.mjs secrets
```

Te pide la clave de Stripe, el WABA ID, el Phone number ID, el token, el App Secret y tu número.
Los secretos se escriben con texto oculto, se comprueban contra Stripe y Meta y van directos a
Cloudflare: no se muestran ni se guardan en archivos. El script además crea el webhook de Stripe,
crea las 5 plantillas de WhatsApp (Meta las revisa, normalmente en minutos), suscribe la app a la
cuenta de WhatsApp y te muestra los dos datos del paso 4.

## 4. Webhook de Meta

**developers.facebook.com → tu app → WhatsApp → Configuración → Webhook → Editar**:
- URL de devolución de llamada: `https://shang-hai-demo.wt-hu04.workers.dev/api/whatsapp/webhook`
- Token de verificación: el que mostró el script.

**Verificar y guardar**, y en **Campos del webhook** suscribe **`messages`** (sin esto, los avisos
quedan como «enviado (sin confirmar)»).

## 5. Prueba completa desde el móvil

1. Comprueba las plantillas: `node scripts/setup/demo.mjs templates` (todas `APPROVED`).
2. Abre las tiendas, haz un pedido y paga con la tarjeta de prueba `4242 4242 4242 4242`
   (fecha futura, cualquier CVC y código postal).
3. Te llega el aviso «Nuevo pedido» por WhatsApp → **Ver pedido** → el panel te pide un código,
   que llega por WhatsApp → **ACEPTAR**. El cliente ve «en preparación» y en Stripe (modo de
   prueba → Pagos) el pago pasa a **cobrado**.
4. Otro pedido → **RECHAZAR**. El cliente ve «rechazado» y en Stripe el pago queda **cancelado**
   (no se cobra nada).

Si nadie decide, a los 60 min del pago el pedido se rechaza solo y se libera el dinero, aunque
WhatsApp no haya funcionado.

## Mantenimiento

| Para | Orden |
|---|---|
| Renovar el token temporal (24 h) | `node scripts/setup/demo.mjs token` |
| Ver qué está publicado y qué secretos hay (solo nombres) | `node scripts/setup/demo.mjs status` |
| Publicar de nuevo tras cambios en el código | `node scripts/setup/demo.mjs deploy` |
| Ver lo que hace el Worker en directo | `cd workers/shang-hai-orders && npx wrangler tail --env demo` |
| Retirar la demo (borra sus datos de prueba) | `npx wrangler delete --env demo`, `npx wrangler delete --name shang-hai-demo-tiendas` y `npx wrangler d1 delete shang-hai-demo` (desde `workers/shang-hai-orders`) |
