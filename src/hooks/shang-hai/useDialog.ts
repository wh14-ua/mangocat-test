"use client";

import { useEffect, useRef } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Accessible modal behaviour for drawers, sheets and dialogs: focus moves inside on
 * open and returns to the trigger on close, Tab is trapped, Escape closes, and the page
 * behind does not scroll. Visuals are left entirely to each storefront.
 *
 * Usage: const ref = useDialog(open, onClose); <div ref={ref} role="dialog" aria-modal="true">
 */
export function useDialog<T extends HTMLElement = HTMLDivElement>(
  open: boolean,
  onClose: () => void,
  options: { initialFocus?: React.RefObject<HTMLElement | null>; lockScroll?: boolean } = {},
) {
  const ref = useRef<T | null>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);
  const { initialFocus, lockScroll = true } = options;

  useEffect(() => {
    if (!open) return;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    const node = ref.current;

    const focusFirst = () => {
      const target =
        initialFocus?.current ?? node?.querySelector<HTMLElement>(FOCUSABLE) ?? node;
      target?.focus({ preventScroll: true });
    };
    const raf = requestAnimationFrame(focusFirst);

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onCloseRef.current();
        return;
      }
      if (e.key !== "Tab" || !node) return;
      const items = Array.from(node.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (items.length === 0) {
        e.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKeyDown);

    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    const scrollbar = window.innerWidth - html.clientWidth;
    if (lockScroll) {
      html.style.overflow = "hidden";
      if (scrollbar > 0) html.style.paddingRight = `${scrollbar}px`;
    }

    return () => {
      cancelAnimationFrame(raf);
      document.removeEventListener("keydown", onKeyDown);
      if (lockScroll) {
        html.style.overflow = previousOverflow;
        html.style.paddingRight = "";
      }
      previouslyFocused?.focus?.({ preventScroll: true });
    };
  }, [open, initialFocus, lockScroll]);

  return ref;
}
