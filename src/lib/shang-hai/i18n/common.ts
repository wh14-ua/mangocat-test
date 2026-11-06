import { defineMessages } from "../../i18n/locale";

/**
 * Facts and states every Shang Hai storefront must word the same way, in both languages.
 * Each storefront keeps its own voice for everything else (its own dictionary file next to
 * this one); these strings are about the restaurant, the money and the order, where the
 * three proposals must not contradict each other.
 */
export const COMMON_TEXT = defineMessages({
  es: {
    brand: {
      descriptor: "Restaurante Asiático · Orihuela",
      cuisine: "Cocina china y sushi",
    },
    restaurant: {
      allergens:
        "La carta publicada no detalla alérgenos por plato. Consulta al restaurante antes de pedir si tienes alergias o intolerancias.",
      pendingTag: "por confirmar",
      hoursPending: "Horario publicado en Just Eat, pendiente de confirmar por el restaurante.",
      phonePending: "Teléfono publicado para consultas; pendiente de confirmar para pedidos.",
      pickupOnly: "Solo recogida en el local.",
      directions: "Cómo llegar",
      directionsHint: "(se abre Google Maps)",
      address: "Dirección",
      hours: "Horario",
      phone: "Teléfono",
    },
    pickup: {
      title: "Recogida en el local",
      howItWorks:
        "Pagas online y el restaurante confirma tu pedido. Cuando lo acepte, verás aquí la hora estimada de recogida.",
      timeAfterAcceptance: "La hora estimada aparecerá cuando el restaurante acepte el pedido.",
    },
    payment: {
      holdExplainer:
        "Al pagar, el importe solo se reserva en tu tarjeta. Se cobra cuando el restaurante acepta el pedido; si no puede prepararlo, la reserva se anula y no se te cobra nada.",
      secureBy: "Pago seguro con Stripe",
      linkMaybe: "Puedes pagar con tarjeta y, si está disponible para ti, con Link, Apple Pay o Google Pay.",
      demoNotice: "Demostración — no se realizará ningún cargo",
      cancelledNotice: "Pago cancelado. Tu pedido sigue aquí: puedes revisarlo y volver a intentarlo.",
    },
    status: {
      pageTitle: "Tu pedido",
      orderNumber: "Número de pedido",
      orderFor: (name: string) => `A nombre de ${name}`,
      loading: "Consultando el estado de tu pedido…",
      missingTitle: "No encontramos ningún pedido en este enlace.",
      missingText: "Abre la página de estado a la que llegaste al pagar (desde el historial del navegador) o vuelve a la carta.",
      notFoundTitle: "No encontramos este pedido.",
      notFoundDemo: "Los pedidos de demostración solo existen en el navegador donde se hicieron.",
      notFoundReal: "Revisa que el enlace esté completo.",
      errorTitle: "No hemos podido consultar el estado del pedido.",
      errorText: "Comprueba tu conexión y vuelve a intentarlo.",
      retry: "Reintentar",
      refresh: "Actualizar",
      lastUpdate: (clock: string) => `Actualizado a las ${clock}`,
      connectionLost: "Sin conexión. Mostramos el último estado conocido y seguimos intentándolo.",
      backToOrder: "Volver a tu pedido",
      backToMenu: "Volver a la carta",
      whatYouOrdered: "Lo que has pedido",
      callRestaurant: "Si tienes dudas, llama al restaurante:",
      keepPageOpen: "Esta página se actualiza sola: no hace falta recargarla.",
    },
    photos: {
      illustrative: "Imagen ilustrativa",
      illustrativeNote: "Las fotos de los platos son ilustrativas: muestran cómo suele ser el plato, no la elaboración del restaurante.",
    },
    language: {
      groupLabel: "Idioma · Language",
    },
  },
  en: {
    brand: {
      descriptor: "Asian Restaurant · Orihuela",
      cuisine: "Chinese cuisine and sushi",
    },
    restaurant: {
      allergens:
        "The published menu does not list allergens for each dish. Please ask the restaurant before ordering if you have allergies or intolerances.",
      pendingTag: "to be confirmed",
      hoursPending: "Opening hours published on Just Eat, still to be confirmed by the restaurant.",
      phonePending: "Phone number published for enquiries; still to be confirmed for orders.",
      pickupOnly: "Pickup at the restaurant only.",
      directions: "Get directions",
      directionsHint: "(opens Google Maps)",
      address: "Address",
      hours: "Opening hours",
      phone: "Phone",
    },
    pickup: {
      title: "Pickup at the restaurant",
      howItWorks:
        "You pay online and the restaurant confirms your order. Once it accepts, you will see the estimated pickup time here.",
      timeAfterAcceptance: "The estimated time will appear once the restaurant accepts the order.",
    },
    payment: {
      holdExplainer:
        "When you pay, the amount is only put on hold on your card. It is charged when the restaurant accepts the order; if it cannot prepare it, the hold is released and you are not charged.",
      secureBy: "Secure payment with Stripe",
      linkMaybe: "You can pay by card and, where available to you, with Link, Apple Pay or Google Pay.",
      demoNotice: "Demo — you will not be charged",
      cancelledNotice: "Payment cancelled. Your order is still here: you can review it and try again.",
    },
    status: {
      pageTitle: "Your order",
      orderNumber: "Order number",
      orderFor: (name: string) => `For ${name}`,
      loading: "Checking your order status…",
      missingTitle: "There is no order in this link.",
      missingText: "Open the status page you reached after paying (from your browser history), or go back to the menu.",
      notFoundTitle: "We cannot find this order.",
      notFoundDemo: "Demo orders only exist in the browser where they were placed.",
      notFoundReal: "Please check the link is complete.",
      errorTitle: "We could not check the order status.",
      errorText: "Check your connection and try again.",
      retry: "Try again",
      refresh: "Refresh",
      lastUpdate: (clock: string) => `Updated at ${clock}`,
      connectionLost: "No connection. Showing the last known status while we keep trying.",
      backToOrder: "Back to your order",
      backToMenu: "Back to the menu",
      whatYouOrdered: "What you ordered",
      callRestaurant: "Any questions? Call the restaurant:",
      keepPageOpen: "This page updates by itself: no need to reload it.",
    },
    photos: {
      illustrative: "Illustrative image",
      illustrativeNote: "Dish photos are illustrative: they show how the dish usually looks, not the restaurant's own preparation.",
    },
    language: {
      groupLabel: "Idioma · Language",
    },
  },
});
