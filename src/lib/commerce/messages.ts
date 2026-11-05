import { defineMessages } from "../i18n/locale";
import type { OrderStatus, PaymentStatus } from "./types";

/**
 * Customer-facing copy of the order engine in every storefront language. Storefronts may
 * word things in their own voice, but these texts are the reference: they say exactly
 * what happened, never more (an authorisation is not a charge, a refund request is not a
 * completed refund).
 */

type StatusText = { label: string; detail: string };

export const ORDER_STATUS_TEXT = defineMessages<Record<OrderStatus, StatusText>>({
  es: {
    pending: {
      label: "Pago pendiente",
      detail: "Estamos esperando la confirmación del pago.",
    },
    awaiting_acceptance: {
      label: "Pendiente de aceptación",
      detail: "El restaurante ha recibido tu pedido y está a punto de confirmarlo.",
    },
    accepting: {
      label: "Pendiente de aceptación",
      detail: "El restaurante está confirmando tu pedido.",
    },
    rejecting: {
      label: "Pedido rechazado",
      detail: "El restaurante no puede preparar tu pedido. Estamos anulando el pago.",
    },
    preparing: {
      label: "En preparación",
      detail: "Pedido aceptado. La cocina lo está preparando.",
    },
    ready: {
      label: "Listo para recoger",
      detail: "Tu pedido está listo. Pasa a recogerlo.",
    },
    completed: {
      label: "Entregado",
      detail: "Pedido entregado. ¡Que aproveche!",
    },
    rejected: {
      label: "Pedido rechazado",
      detail: "El restaurante no puede preparar tu pedido.",
    },
    failed: {
      label: "Pago no completado",
      detail: "El pago no se ha completado. No se ha realizado ningún cargo.",
    },
    cancelled: {
      label: "Pedido cancelado",
      detail: "El pedido se ha cancelado sin cargo.",
    },
    needs_review: {
      label: "En revisión",
      detail: "El restaurante está revisando este pedido y te contactará si hace falta.",
    },
  },
  en: {
    pending: {
      label: "Payment pending",
      detail: "We are waiting for the payment to be confirmed.",
    },
    awaiting_acceptance: {
      label: "Waiting for the restaurant",
      detail: "The restaurant has received your order and is about to confirm it.",
    },
    accepting: {
      label: "Waiting for the restaurant",
      detail: "The restaurant is confirming your order.",
    },
    rejecting: {
      label: "Order declined",
      detail: "The restaurant cannot prepare your order. We are cancelling the payment.",
    },
    preparing: {
      label: "Being prepared",
      detail: "Order accepted. The kitchen is preparing it.",
    },
    ready: {
      label: "Ready for pickup",
      detail: "Your order is ready. Come and collect it.",
    },
    completed: {
      label: "Collected",
      detail: "Order handed over. Enjoy your meal!",
    },
    rejected: {
      label: "Order declined",
      detail: "The restaurant cannot prepare your order.",
    },
    failed: {
      label: "Payment not completed",
      detail: "The payment did not go through. You have not been charged.",
    },
    cancelled: {
      label: "Order cancelled",
      detail: "The order was cancelled. You have not been charged.",
    },
    needs_review: {
      label: "Under review",
      detail: "The restaurant is checking this order and will contact you if needed.",
    },
  },
});

export const PAYMENT_STATUS_TEXT = defineMessages<Record<PaymentStatus, StatusText>>({
  es: {
    unpaid: { label: "Pago pendiente", detail: "Todavía no se ha completado el pago." },
    processing: {
      label: "Pago en proceso",
      detail: "Tu banco está procesando el pago. Te lo confirmaremos aquí.",
    },
    authorized: {
      label: "Pago autorizado",
      detail: "Importe reservado en tu tarjeta, todavía sin cobrar. Solo se cobrará si el restaurante acepta el pedido.",
    },
    captured: { label: "Pago confirmado", detail: "Pago cobrado y confirmado por Stripe." },
    canceled: {
      label: "Pago anulado",
      detail: "La reserva del importe se ha anulado: no se te ha cobrado nada. Según tu banco, puede tardar unos días en desaparecer del extracto.",
    },
    failed: { label: "Pago no completado", detail: "No se ha realizado ningún cargo." },
    refund_pending: {
      label: "Reembolso pendiente",
      detail: "Hemos solicitado la devolución del importe. Te avisaremos aquí cuando Stripe la confirme.",
    },
    refunded: {
      label: "Reembolso completado",
      detail: "Stripe ha confirmado la devolución. El abono puede tardar entre 5 y 10 días hábiles en verse en tu cuenta.",
    },
    refund_failed: {
      label: "Reembolso en revisión",
      detail: "La devolución no se ha podido completar automáticamente. El restaurante la está revisando.",
    },
  },
  en: {
    unpaid: { label: "Payment pending", detail: "The payment has not been completed yet." },
    processing: {
      label: "Payment processing",
      detail: "Your bank is processing the payment. We will confirm it here.",
    },
    authorized: {
      label: "Payment authorised",
      detail: "The amount is on hold on your card, not charged yet. You will only be charged if the restaurant accepts the order.",
    },
    captured: { label: "Payment confirmed", detail: "Payment charged and confirmed by Stripe." },
    canceled: {
      label: "Payment cancelled",
      detail: "The hold on your card has been released: you have not been charged. Depending on your bank, it may take a few days to disappear from your statement.",
    },
    failed: { label: "Payment not completed", detail: "You have not been charged." },
    refund_pending: {
      label: "Refund pending",
      detail: "We have requested the refund. We will let you know here once Stripe confirms it.",
    },
    refunded: {
      label: "Refund completed",
      detail: "Stripe has confirmed the refund. It can take 5 to 10 business days to appear in your account.",
    },
    refund_failed: {
      label: "Refund under review",
      detail: "The refund could not be completed automatically. The restaurant is looking into it.",
    },
  },
});

export type CheckoutErrorCode =
  | "invalid"
  | "not-payable"
  | "price-changed"
  | "age-confirmation-required"
  | "payments-disabled"
  | "rate-limited"
  | "network"
  | "server";

export const CHECKOUT_ERROR_TEXT = defineMessages<Record<CheckoutErrorCode, string>>({
  es: {
    invalid: "Revisa los datos marcados.",
    "not-payable": "Hay productos en el pedido que no se pueden pagar online ahora mismo.",
    "price-changed": "Los precios han cambiado desde que abriste la carta. Revisa el total antes de continuar.",
    "age-confirmation-required": "El pedido incluye bebidas alcohólicas: confirma que eres mayor de 18 años.",
    "payments-disabled":
      "El pago online no está disponible en este momento. Puedes llamar al restaurante para hacer tu pedido.",
    "rate-limited": "Demasiados intentos seguidos. Espera un minuto y vuelve a intentarlo.",
    network: "No hay conexión con el servidor de pedidos. Comprueba tu conexión y vuelve a intentarlo.",
    server:
      "El servidor de pedidos no ha podido guardar el pedido. No se ha realizado ningún cargo. Inténtalo de nuevo en unos minutos.",
  },
  en: {
    invalid: "Please check the highlighted fields.",
    "not-payable": "Some items in your order cannot be paid for online right now.",
    "price-changed": "Prices have changed since you opened the menu. Please check the total before continuing.",
    "age-confirmation-required": "Your order includes alcoholic drinks: please confirm you are 18 or over.",
    "payments-disabled": "Online payment is not available right now. You can call the restaurant to order.",
    "rate-limited": "Too many attempts in a row. Please wait a minute and try again.",
    network: "We cannot reach the order server. Check your connection and try again.",
    server:
      "The order server could not save your order. You have not been charged. Please try again in a few minutes.",
  },
});

export type QuoteIssueCode =
  | "unknown-item"
  | "not-orderable"
  | "invalid-options"
  | "invalid-quantity"
  | "too-many-lines"
  | "too-many-items"
  | "order-total-limit"
  | "empty"
  | "delivery-unavailable"
  | "delivery-minimum";

export const QUOTE_ISSUE_TEXT = defineMessages<Record<QuoteIssueCode, string>>({
  es: {
    "unknown-item": "Un producto ya no está en la carta.",
    "not-orderable": "Un producto no se puede pedir ahora mismo.",
    "invalid-options": "Revisa las opciones elegidas de un producto.",
    "invalid-quantity": "Revisa las cantidades del pedido.",
    "too-many-lines": "El pedido tiene demasiados productos distintos.",
    "too-many-items": "El pedido supera el número máximo de unidades.",
    "order-total-limit": "El importe supera el máximo para pedidos online. Llama al restaurante.",
    empty: "El pedido está vacío.",
    "delivery-unavailable": "El reparto a domicilio propio no está disponible.",
    "delivery-minimum": "No se alcanza el pedido mínimo para reparto.",
  },
  en: {
    "unknown-item": "An item is no longer on the menu.",
    "not-orderable": "An item cannot be ordered right now.",
    "invalid-options": "Please check the options chosen for an item.",
    "invalid-quantity": "Please check the quantities in your order.",
    "too-many-lines": "Your order has too many different items.",
    "too-many-items": "Your order exceeds the maximum number of items.",
    "order-total-limit": "The total exceeds the limit for online orders. Please call the restaurant.",
    empty: "Your order is empty.",
    "delivery-unavailable": "The restaurant's own delivery is not available.",
    "delivery-minimum": "The minimum order for delivery has not been reached.",
  },
});

export type NotOrderableCode = "unavailable" | "price-pending" | "price-conflict" | "duplicate";

export const NOT_ORDERABLE_TEXT = defineMessages<Record<NotOrderableCode, string>>({
  es: {
    unavailable: "No disponible ahora",
    "price-pending": "Precio pendiente de confirmar",
    "price-conflict": "Precio pendiente de confirmar",
    duplicate: "No disponible",
  },
  en: {
    unavailable: "Not available right now",
    "price-pending": "Price to be confirmed",
    "price-conflict": "Price to be confirmed",
    duplicate: "Not available",
  },
});

/** Field validation messages (client and server use the same rules and words). */
export const VALIDATION_TEXT = defineMessages({
  es: {
    body: "Petición no válida.",
    catalogId: "Catálogo no válido.",
    storefront: "Tienda no válida.",
    fulfillment: "Elige recogida o reparto.",
    linesEmpty: "El pedido está vacío.",
    linesTooMany: "El pedido tiene demasiados productos distintos.",
    linesQuantity: "Revisa las cantidades del pedido.",
    expectedTotal: "Importe no válido.",
    locale: "Idioma no válido.",
    name: "Escribe tu nombre para que podamos identificar el pedido.",
    phoneRequired: "Necesitamos un teléfono por si hay que confirmar algo del pedido.",
    phoneInvalid: "Revisa el teléfono: por ejemplo 612 345 678.",
    emailRequired: "Escribe un correo para enviarte la confirmación.",
    emailInvalid: "Revisa el correo: falta algo como nombre@dominio.es.",
    notesTooLong: (max: number) => `Los comentarios admiten hasta ${max} caracteres.`,
    street: "Escribe la dirección completa (calle y número).",
    postalCode: "El código postal tiene 5 cifras.",
    city: "Escribe el municipio.",
    ageConfirmation: "Confirma que eres mayor de 18 años para pedir bebidas alcohólicas.",
  },
  en: {
    body: "Invalid request.",
    catalogId: "Invalid menu.",
    storefront: "Invalid shop.",
    fulfillment: "Choose pickup or delivery.",
    linesEmpty: "Your order is empty.",
    linesTooMany: "Your order has too many different items.",
    linesQuantity: "Please check the quantities in your order.",
    expectedTotal: "Invalid amount.",
    locale: "Invalid language.",
    name: "Please enter your name so we can identify the order.",
    phoneRequired: "We need a phone number in case we have to check something about the order.",
    phoneInvalid: "Please check the phone number, for example 612 345 678.",
    emailRequired: "Please enter an email address for the confirmation.",
    emailInvalid: "Please check the email address: something like name@domain.com is missing.",
    notesTooLong: (max: number) => `Comments can be up to ${max} characters long.`,
    street: "Please enter the full address (street and number).",
    postalCode: "The postcode has 5 digits.",
    city: "Please enter the town.",
    ageConfirmation: "Please confirm you are 18 or over to order alcoholic drinks.",
  },
});
