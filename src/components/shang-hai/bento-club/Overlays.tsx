"use client";

import { useState } from "react";
import { AnimatePresence, motion, useDragControls, useReducedMotion } from "motion/react";
import { X } from "@phosphor-icons/react/dist/ssr";
import { useDialog } from "@/hooks/shang-hai/useDialog";
import { formatCents } from "@/lib/commerce/money";
import type { MenuItem, OptionSelections } from "@/lib/commerce/types";
import { CartContents } from "./CartContents";

const SHEET_SPRING = { type: "spring", stiffness: 460, damping: 40 } as const;

/** Mobile cart: a bottom sheet with a grab handle (drag down to close, up to expand). */
export function CartSheet({
  open,
  onClose,
  onBrowse,
}: {
  open: boolean;
  onClose: () => void;
  onBrowse: () => void;
}) {
  return (
    <AnimatePresence>
      {open && <SheetBody key="sheet" onClose={onClose} onBrowse={onBrowse} />}
    </AnimatePresence>
  );
}

function SheetBody({ onClose, onBrowse }: { onClose: () => void; onBrowse: () => void }) {
  const ref = useDialog<HTMLDivElement>(true, onClose);
  const reduce = useReducedMotion();
  const controls = useDragControls();
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <motion.div
        className="bc-scrim"
        aria-hidden
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      />
      <motion.div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby="bc-cart-title"
        data-testid="cart-panel"
        className="bc-sheet"
        data-expanded={expanded || undefined}
        tabIndex={-1}
        initial={reduce ? { opacity: 0 } : { y: "100%" }}
        animate={reduce ? { opacity: 1 } : { y: 0 }}
        exit={reduce ? { opacity: 0 } : { y: "100%" }}
        transition={reduce ? { duration: 0.01 } : SHEET_SPRING}
        drag={reduce ? false : "y"}
        dragListener={false}
        dragControls={controls}
        dragConstraints={{ top: 0, bottom: 0 }}
        dragElastic={{ top: 0.06, bottom: 0.85 }}
        onDragEnd={(_, info) => {
          if (info.offset.y > 110 || info.velocity.y > 650) onClose();
          else if (info.offset.y < -40) setExpanded(true);
        }}
      >
        <button
          type="button"
          className="bc-sheet__handle"
          aria-label={expanded ? "Reducir el panel del pedido" : "Ampliar el panel del pedido"}
          aria-expanded={expanded}
          onPointerDown={(e) => controls.start(e)}
          onClick={() => setExpanded((v) => !v)}
        >
          <span />
        </button>
        <CartContents
          variant="sheet"
          onClose={onClose}
          onBrowse={() => {
            onClose();
            onBrowse();
          }}
        />
      </motion.div>
    </>
  );
}

/** Required choices before adding (e.g. the 6-person set menus: dessert or coffee). */
export function OptionChooser({
  item,
  onClose,
  onConfirm,
}: {
  item: MenuItem | null;
  onClose: () => void;
  onConfirm: (item: MenuItem, selections: OptionSelections) => void;
}) {
  return (
    <AnimatePresence>
      {item && <ChooserBody key={item.id} item={item} onClose={onClose} onConfirm={onConfirm} />}
    </AnimatePresence>
  );
}

function ChooserBody({
  item,
  onClose,
  onConfirm,
}: {
  item: MenuItem;
  onClose: () => void;
  onConfirm: (item: MenuItem, selections: OptionSelections) => void;
}) {
  const ref = useDialog<HTMLDivElement>(true, onClose);
  const reduce = useReducedMotion();
  const options = item.options ?? [];
  const [picked, setPicked] = useState<OptionSelections>({});

  const complete = options.every((o) => (picked[o.id]?.length ?? 0) >= o.minChoices);
  const extra = options.reduce(
    (sum, o) =>
      sum +
      (picked[o.id] ?? []).reduce(
        (s, id) => s + (o.choices.find((c) => c.id === id)?.priceDeltaCents ?? 0),
        0,
      ),
    0,
  );
  const unit = (item.priceCents ?? 0) + extra;

  function toggle(optionId: string, choiceId: string, single: boolean) {
    setPicked((prev) => {
      const current = prev[optionId] ?? [];
      if (single) return { ...prev, [optionId]: [choiceId] };
      return {
        ...prev,
        [optionId]: current.includes(choiceId)
          ? current.filter((c) => c !== choiceId)
          : [...current, choiceId],
      };
    });
  }

  return (
    <>
      <motion.div
        className="bc-scrim"
        aria-hidden
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.18 }}
      />
      <div className="bc-modalwrap">
        <motion.div
          ref={ref}
          role="dialog"
          aria-modal="true"
          aria-labelledby="bc-choose-title"
          aria-describedby={item.description ? "bc-choose-desc" : undefined}
          className="bc-modal"
          tabIndex={-1}
          initial={reduce ? { opacity: 0 } : { y: 60, opacity: 0, scale: 0.98 }}
          animate={reduce ? { opacity: 1 } : { y: 0, opacity: 1, scale: 1 }}
          exit={reduce ? { opacity: 0 } : { y: 40, opacity: 0, scale: 0.98 }}
          transition={reduce ? { duration: 0.01 } : SHEET_SPRING}
        >
          <div className="bc-cart__head" style={{ padding: "8px 0 0" }}>
            <h2 id="bc-choose-title" className="bc-modal__title">
              {item.name}
            </h2>
            <button type="button" className="bc-iconbtn" onClick={onClose} aria-label="Cerrar sin añadir">
              <X size={22} weight="bold" aria-hidden />
            </button>
          </div>
          {item.description && (
            <p id="bc-choose-desc" className="bc-modal__desc">
              {item.description}
            </p>
          )}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (complete) onConfirm(item, picked);
            }}
            style={{ display: "grid", gap: 14 }}
          >
            {options.map((option) => {
              const single = option.maxChoices === 1;
              return (
                <fieldset key={option.id} className="bc-choices">
                  <legend>
                    {option.name === "Elige" ? "Elige una opción" : option.name}
                    {option.minChoices > 0 ? " (obligatorio)" : ""}
                  </legend>
                  {option.choices.map((choice) => (
                    <label key={choice.id} className="bc-choice">
                      <input
                        type={single ? "radio" : "checkbox"}
                        name={`bc-opt-${option.id}`}
                        value={choice.id}
                        checked={(picked[option.id] ?? []).includes(choice.id)}
                        onChange={() => toggle(option.id, choice.id, single)}
                      />
                      {choice.name}
                      <small>
                        {choice.priceDeltaCents ? `+${formatCents(choice.priceDeltaCents)}` : "Incluido"}
                      </small>
                    </label>
                  ))}
                </fieldset>
              );
            })}
            <button type="submit" className="bc-primary" disabled={!complete}>
              {complete ? `Añadir al pedido · ${formatCents(unit)}` : "Elige una opción para añadir"}
            </button>
          </form>
        </motion.div>
      </div>
    </>
  );
}
