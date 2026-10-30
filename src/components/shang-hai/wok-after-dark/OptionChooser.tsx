"use client";

import { useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import type { MenuItem, OptionSelections } from "@/lib/commerce/types";
import { formatCents } from "@/lib/commerce/money";
import { useDialog } from "@/hooks/shang-hai/useDialog";
import { useWokUI } from "./WokUI";
import { useWokCartActions } from "./cart-actions";
import { useIsDesktop } from "./CartTicket";

function ChooserBody({ item, onDone }: { item: MenuItem; onDone: () => void }) {
  const actions = useWokCartActions();
  const [picked, setPicked] = useState<OptionSelections>({});
  const [error, setError] = useState<string | null>(null);
  const options = item.options ?? [];
  const extra = options.reduce(
    (sum, o) =>
      sum + (picked[o.id] ?? []).reduce((s, cid) => s + (o.choices.find((c) => c.id === cid)?.priceDeltaCents ?? 0), 0),
    0,
  );

  const toggle = (optionId: string, choiceId: string, single: boolean) => {
    setError(null);
    setPicked((p) => {
      const current = p[optionId] ?? [];
      const next = single
        ? [choiceId]
        : current.includes(choiceId)
          ? current.filter((c) => c !== choiceId)
          : [...current, choiceId];
      return { ...p, [optionId]: next };
    });
  };

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const missing = options.find((o) => (picked[o.id]?.length ?? 0) < o.minChoices);
    if (missing) {
      setError("Elige una de las opciones para añadir este menú.");
      return;
    }
    if (actions.add(item, picked)) onDone();
    else setError("No se ha podido añadir. Revisa la opción elegida.");
  };

  return (
    <form onSubmit={submit} noValidate>
      {options.map((o) => {
        const single = o.maxChoices === 1;
        return (
          <fieldset key={o.id} className="mt-6" aria-describedby={error ? "wok-chooser-error" : undefined}>
            <legend className="wok-label">
              {o.name === "Elige" ? "Elige una opción" : o.name}
              {o.minChoices > 0 ? " (obligatorio)" : ""}
            </legend>
            <div className="mt-2 grid gap-2">
              {o.choices.map((c) => {
                const checked = (picked[o.id] ?? []).includes(c.id);
                return (
                  <label
                    key={c.id}
                    className={
                      "flex min-h-14 cursor-pointer items-center gap-4 px-4 transition-colors " +
                      (checked
                        ? "bg-[var(--wok-petrol-3)] shadow-[inset_0_0_0_2px_var(--wok-orange)]"
                        : "bg-[var(--wok-petrol)] shadow-[inset_0_0_0_1px_var(--wok-line)] hover:bg-[var(--wok-petrol-3)]")
                    }
                  >
                    <input
                      type={single ? "radio" : "checkbox"}
                      name={`opt-${o.id}`}
                      value={c.id}
                      checked={checked}
                      onChange={() => toggle(o.id, c.id, single)}
                      className={single ? "wok-radio" : "wok-check"}
                    />
                    <span className="wok-cond-tight flex-1 text-[1.0625rem]">{c.name}</span>
                    {c.priceDeltaCents > 0 && (
                      <span className="wok-nums text-[var(--wok-orange)]">+{formatCents(c.priceDeltaCents)}</span>
                    )}
                  </label>
                );
              })}
            </div>
          </fieldset>
        );
      })}
      {error && (
        <p id="wok-chooser-error" role="alert" className="wok-error-text">
          {error}
        </p>
      )}
      <button type="submit" className="wok-btn wok-btn--hot mt-7 h-16 w-full justify-between text-[1.125rem]">
        <span>Añadir al ticket</span>
        <span className="wok-nums">{formatCents((item.priceCents ?? 0) + extra)}</span>
      </button>
    </form>
  );
}

/** Option chooser for dishes with real options (the 6-person set menus). */
export function OptionChooser() {
  const { chooserItem, closeChooser } = useWokUI();
  const reduce = useReducedMotion();
  const desktop = useIsDesktop();
  const ref = useDialog<HTMLDivElement>(Boolean(chooserItem), closeChooser);
  const offset = desktop ? { y: 24, opacity: 0 } : { y: "100%" };

  return (
    <AnimatePresence>
      {chooserItem && (
        <div className="fixed inset-0 z-[95] flex items-end justify-center lg:items-center">
          <motion.div
            aria-hidden
            className="absolute inset-0 bg-[rgba(8,15,18,0.8)]"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.2 }}
            onClick={closeChooser}
          />
          <motion.div
            ref={ref}
            role="dialog"
            aria-modal="true"
            aria-labelledby="wok-chooser-title"
            className="wok-ticket relative max-h-[92dvh] w-full overflow-y-auto !pb-6 lg:w-[34rem]"
            initial={reduce ? { opacity: 0 } : offset}
            animate={{ y: 0, opacity: 1 }}
            exit={reduce ? { opacity: 0 } : offset}
            transition={{ duration: reduce ? 0 : 0.3, ease: [0.2, 0.9, 0.15, 1] }}
          >
            <div className="flex items-start justify-between gap-4 px-1">
              <div className="min-w-0">
                <p className="wok-cond text-[0.75rem] text-[var(--wok-orange)]">Elige tu opción</p>
                <h2 id="wok-chooser-title" className="wok-display mt-2 text-[2.6rem]">
                  {chooserItem.name}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeChooser}
                className="wok-cond -mr-2 flex h-11 shrink-0 items-center px-2 text-[0.875rem]"
              >
                Cerrar
              </button>
            </div>
            {chooserItem.description && (
              <p className="wok-muted mt-3 px-1 text-[0.9375rem]">{chooserItem.description}</p>
            )}
            <div className="px-1">
              <ChooserBody key={chooserItem.id} item={chooserItem} onDone={closeChooser} />
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
