"use client";

import { useId, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "motion/react";
import { useDialog } from "@/hooks/shang-hai/useDialog";
import { formatCents } from "@/lib/commerce/money";
import type { MenuItem, OptionSelections } from "@/lib/commerce/types";
import { useInkUI } from "./InkUI";

/** Chooser for dishes with real options (the 6-person set menus: dessert or coffee). */
export function InkOptionDialog() {
  const ui = useInkUI();
  const reduce = useReducedMotion();
  const item = ui.optionItem;
  return (
    <AnimatePresence>
      {item && (
        <div className="ink-layer ink-layer--center" key={item.id}>
          <motion.div
            className="ink-scrim"
            aria-hidden="true"
            onClick={ui.closeOptions}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduce ? 0 : 0.25 }}
          />
          <OptionSheet item={item} reduce={Boolean(reduce)} />
        </div>
      )}
    </AnimatePresence>
  );
}

function OptionSheet({ item, reduce }: { item: MenuItem; reduce: boolean }) {
  const ui = useInkUI();
  const ref = useDialog<HTMLDivElement>(true, ui.closeOptions);
  const titleId = useId();
  const [selections, setSelections] = useState<OptionSelections>({});
  const [error, setError] = useState<string | null>(null);
  const options = item.options ?? [];

  const extra = options.reduce((sum, o) => {
    const chosen = selections[o.id] ?? [];
    return sum + o.choices.filter((c) => chosen.includes(c.id)).reduce((s, c) => s + c.priceDeltaCents, 0);
  }, 0);

  function confirm() {
    const missing = options.find((o) => (selections[o.id]?.length ?? 0) < o.minChoices);
    if (missing) {
      setError(`Elige una opción en «${missing.name}».`);
      return;
    }
    if (ui.addItem(item, selections)) ui.closeOptions();
  }

  return (
    <motion.div
      ref={ref}
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="ink-sheet"
      initial={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={reduce ? { opacity: 0 } : { opacity: 0, y: 24 }}
      transition={{ duration: reduce ? 0 : 0.32, ease: [0.22, 1, 0.36, 1] }}
    >
      <p className="ink-sheet__kicker">Antes de añadirlo</p>
      <h2 id={titleId} className="ink-sheet__title">
        {item.name}
      </h2>
      {item.description && <p className="ink-sheet__desc">{item.description}</p>}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          confirm();
        }}
      >
        {options.map((option) => (
          <fieldset key={option.id} className="ink-choices" aria-describedby={error ? `${titleId}-err` : undefined}>
            <legend className="ink-choices__legend">
              {option.name === "Elige" ? "Elige una opción" : option.name}
            </legend>
            {option.choices.map((choice) => {
              const checked = selections[option.id]?.includes(choice.id) ?? false;
              return (
                <label key={choice.id} className="ink-choice" data-checked={checked ? "" : undefined}>
                  <input
                    type={option.maxChoices === 1 ? "radio" : "checkbox"}
                    name={option.id}
                    value={choice.id}
                    checked={checked}
                    onChange={(e) => {
                      setError(null);
                      setSelections((prev) => {
                        const current = prev[option.id] ?? [];
                        const next =
                          option.maxChoices === 1
                            ? [choice.id]
                            : e.target.checked
                              ? [...current, choice.id].slice(0, option.maxChoices)
                              : current.filter((id) => id !== choice.id);
                        return { ...prev, [option.id]: next };
                      });
                    }}
                  />
                  <span className="ink-choice__name">{choice.name}</span>
                  <span className="ink-choice__price">
                    {choice.priceDeltaCents > 0 ? `+ ${formatCents(choice.priceDeltaCents)}` : "Incluido"}
                  </span>
                </label>
              );
            })}
          </fieldset>
        ))}
        {error && (
          <p id={`${titleId}-err`} className="ink-error-text" role="alert">
            {error}
          </p>
        )}
        <div className="ink-sheet__actions">
          <button type="submit" className="ink-button ink-button--lacquer">
            Añadir por {formatCents((item.priceCents ?? 0) + extra)}
          </button>
          <button type="button" className="ink-text-button" onClick={ui.closeOptions}>
            Cancelar
          </button>
        </div>
      </form>
    </motion.div>
  );
}
