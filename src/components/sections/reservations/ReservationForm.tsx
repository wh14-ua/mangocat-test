"use client";

import { useEffect, useRef, useState } from "react";
import { CheckCircle } from "@phosphor-icons/react/dist/ssr";
import { site } from "@/config";
import { Field, inputBase } from "@/components/ui/Field";
import { formatLongDate, toISODate } from "@/lib/format";
import { cn } from "@/lib/cn";

type Status = "idle" | "submitting" | "done";
type Errors = Partial<Record<"date" | "time" | "name" | "email" | "phone", string>>;

const services = site.reservations.services;
const emailRe = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parseLocalDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function ReservationForm() {
  const [status, setStatus] = useState<Status>("idle");
  const [minDate, setMinDate] = useState("");
  const [date, setDate] = useState("");
  const [serviceId, setServiceId] = useState(services[0].id);
  const [time, setTime] = useState("");
  const [guests, setGuests] = useState(2);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");
  const [errors, setErrors] = useState<Errors>({});

  const dateRef = useRef<HTMLInputElement>(null);
  const timeRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const phoneRef = useRef<HTMLInputElement>(null);
  const confirmRef = useRef<HTMLHeadingElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Client-only: earliest selectable date is today (avoids hydration mismatch).
  useEffect(() => {
    setMinDate(toISODate(new Date()));
  }, []);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
  }, []);

  const times = services.find((s) => s.id === serviceId)?.times ?? [];

  function validate(): Errors {
    const e: Errors = {};
    if (!date) e.date = "Choose a date for your visit.";
    else if (minDate && date < minDate) e.date = "Pick a date that is not in the past.";
    if (!time) e.time = "Choose a time.";
    if (!name.trim()) e.name = "Enter the name for the booking.";
    if (!email.trim()) e.email = "Enter an email so we can confirm.";
    else if (!emailRe.test(email)) e.email = "Enter a valid email address.";
    if (!phone.trim()) e.phone = "Enter a phone number so we can reach you.";
    return e;
  }

  function handleSubmit(ev: React.FormEvent) {
    ev.preventDefault();
    const e = validate();
    setErrors(e);
    if (Object.keys(e).length > 0) {
      // Focus the first invalid field
      if (e.date) dateRef.current?.focus();
      else if (e.time) timeRef.current?.focus();
      else if (e.name) nameRef.current?.focus();
      else if (e.email) emailRef.current?.focus();
      else if (e.phone) phoneRef.current?.focus();
      return;
    }
    setStatus("submitting");
    // Simulated request (demo only). No data leaves the browser.
    timer.current = setTimeout(() => {
      setStatus("done");
    }, 900);
  }

  function reset() {
    setStatus("idle");
    setDate("");
    setTime("");
    setGuests(2);
    setName("");
    setEmail("");
    setPhone("");
    setNotes("");
    setErrors({});
  }

  // Move focus to the confirmation when it appears (screen reader + keyboard).
  useEffect(() => {
    if (status === "done") confirmRef.current?.focus();
  }, [status]);

  if (status === "done") {
    const serviceLabel = services.find((s) => s.id === serviceId)?.label ?? "";
    return (
      <div className="border border-line bg-onyx p-8 md:p-12" aria-live="polite">
        <CheckCircle
          weight="light"
          className="size-10 text-ember"
          aria-hidden="true"
        />
        <h2
          ref={confirmRef}
          tabIndex={-1}
          className="mt-6 font-display text-3xl leading-tight text-porcelain outline-none"
        >
          Your request is noted
        </h2>
        <dl className="mt-8 space-y-3 border-y border-line py-6 font-sans text-sm">
          <div className="flex justify-between gap-4">
            <dt className="text-ash">Date</dt>
            <dd className="nums text-right text-porcelain">
              {date ? formatLongDate(parseLocalDate(date)) : ""}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ash">Service</dt>
            <dd className="text-right text-porcelain">
              {serviceLabel}, {time}
            </dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ash">Guests</dt>
            <dd className="nums text-right text-porcelain">{guests}</dd>
          </div>
          <div className="flex justify-between gap-4">
            <dt className="text-ash">Name</dt>
            <dd className="text-right text-porcelain">{name}</dd>
          </div>
        </dl>
        <p className="mt-6 max-w-prose font-sans text-sm leading-relaxed text-mist">
          This is a demonstration booking flow. No reservation has actually been
          made and no message has been sent. To book a real table, please call{" "}
          <a
            href={site.reservations.phoneHref}
            className="nums text-ember underline-offset-4 hover:underline"
          >
            {site.reservations.phoneDisplay}
          </a>{" "}
          or email{" "}
          <a
            href={`mailto:${site.reservations.email}`}
            className="text-ember underline-offset-4 hover:underline"
          >
            {site.reservations.email}
          </a>
          .
        </p>
        <button
          type="button"
          onClick={reset}
          className="mt-8 inline-flex h-11 items-center border border-line-strong px-6 font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-porcelain transition-colors duration-300 hover:border-porcelain hover:bg-porcelain hover:text-noir touch-manip"
        >
          Start Again
        </button>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      noValidate
      className="border border-line bg-onyx p-6 sm:p-8 md:p-10"
    >
      <fieldset className="border-0 p-0">
        <legend className="mb-6 font-display text-xl text-porcelain">
          Your visit
        </legend>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
          <Field
            label="Date"
            htmlFor="res-date"
            required
            error={errors.date}
          >
            <input
              ref={dateRef}
              id="res-date"
              name="date"
              type="date"
              value={date}
              min={minDate || undefined}
              onChange={(e) => setDate(e.target.value)}
              aria-invalid={errors.date ? true : undefined}
              aria-describedby={errors.date ? "res-date-error" : undefined}
              className={inputBase}
            />
          </Field>

          <Field label="Guests" htmlFor="res-guests" required hint={`Parties above ${site.reservations.partyMax}, please call.`}>
            <select
              id="res-guests"
              name="guests"
              value={guests}
              onChange={(e) => setGuests(Number(e.target.value))}
              className={cn(inputBase, "appearance-none bg-onyx")}
            >
              {Array.from({ length: site.reservations.partyMax }, (_, i) => i + 1).map(
                (n) => (
                  <option key={n} value={n}>
                    {n} {n === 1 ? "guest" : "guests"}
                  </option>
                ),
              )}
            </select>
          </Field>
        </div>

        {/* Service */}
        <fieldset className="mt-6 border-0 p-0">
          <legend className="mb-3 font-sans text-xs font-medium uppercase tracking-[0.12em] text-mist">
            Service
          </legend>
          <div className="flex flex-wrap gap-3">
            {services.map((s) => {
              const checked = serviceId === s.id;
              return (
                <label
                  key={s.id}
                  className={cn(
                    "cursor-pointer border px-5 py-2.5 font-sans text-sm transition-colors duration-200 touch-manip has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember",
                    checked
                      ? "border-ember bg-ember-soft text-ember"
                      : "border-line text-mist hover:border-porcelain hover:text-porcelain",
                  )}
                >
                  <input
                    type="radio"
                    name="service"
                    value={s.id}
                    checked={checked}
                    onChange={() => {
                      setServiceId(s.id);
                      setTime("");
                    }}
                    className="sr-only"
                  />
                  {s.label}
                </label>
              );
            })}
          </div>
        </fieldset>

        {/* Time */}
        <fieldset className="mt-6 border-0 p-0">
          <legend className="mb-3 font-sans text-xs font-medium uppercase tracking-[0.12em] text-mist">
            Time
            <span className="text-ember" aria-hidden="true">
              {" "}
              *
            </span>
          </legend>
          <div className="flex flex-wrap gap-2.5">
            {times.map((t, i) => {
              const checked = time === t;
              return (
                <label
                  key={t}
                  className={cn(
                    "cursor-pointer border px-4 py-2.5 font-sans text-sm tabular-nums transition-colors duration-200 touch-manip has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-2 has-[:focus-visible]:outline-ember",
                    checked
                      ? "border-ember bg-ember-soft text-ember"
                      : "border-line text-mist hover:border-porcelain hover:text-porcelain",
                  )}
                >
                  <input
                    ref={i === 0 ? timeRef : undefined}
                    type="radio"
                    name="time"
                    value={t}
                    checked={checked}
                    onChange={() => setTime(t)}
                    aria-invalid={errors.time ? true : undefined}
                    className="sr-only"
                  />
                  {t}
                </label>
              );
            })}
          </div>
          {errors.time && (
            <p role="alert" className="mt-3 font-sans text-xs text-critical">
              {errors.time}
            </p>
          )}
        </fieldset>
      </fieldset>

      <fieldset className="mt-10 border-0 p-0">
        <legend className="mb-6 font-display text-xl text-porcelain">
          Your details
        </legend>

        <div className="grid grid-cols-1 gap-6">
          <Field label="Name" htmlFor="res-name" required error={errors.name}>
            <input
              ref={nameRef}
              id="res-name"
              name="name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={errors.name ? true : undefined}
              aria-describedby={errors.name ? "res-name-error" : undefined}
              className={inputBase}
            />
          </Field>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <Field label="Email" htmlFor="res-email" required error={errors.email}>
              <input
                ref={emailRef}
                id="res-email"
                name="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                spellCheck={false}
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                aria-invalid={errors.email ? true : undefined}
                aria-describedby={errors.email ? "res-email-error" : undefined}
                className={inputBase}
              />
            </Field>

            <Field label="Phone" htmlFor="res-phone" required error={errors.phone}>
              <input
                ref={phoneRef}
                id="res-phone"
                name="phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                aria-invalid={errors.phone ? true : undefined}
                aria-describedby={errors.phone ? "res-phone-error" : undefined}
                className={inputBase}
              />
            </Field>
          </div>

          <Field
            label="Notes"
            htmlFor="res-notes"
            hint="Allergies, dietary needs or a special occasion."
          >
            <textarea
              id="res-notes"
              name="notes"
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className={cn(inputBase, "h-auto resize-y py-3")}
            />
          </Field>
        </div>
      </fieldset>

      <div className="mt-10">
        <button
          type="submit"
          disabled={status === "submitting"}
          className="inline-flex h-[52px] w-full items-center justify-center gap-x-3 bg-ember px-8 font-sans text-[0.8125rem] font-semibold uppercase tracking-[0.16em] text-on-ember transition-colors duration-300 hover:bg-ember-deep disabled:opacity-70 touch-manip sm:w-auto"
        >
          {status === "submitting" ? (
            <>
              <span
                className="size-4 animate-spin rounded-full border-2 border-on-ember/40 border-t-on-ember"
                aria-hidden="true"
              />
              Reserving…
            </>
          ) : (
            "Request a Table"
          )}
        </button>
        <p className="mt-4 font-sans text-xs leading-relaxed text-ash">
          Demonstration only. Submitting simulates a booking; it does not contact
          the restaurant or send any data.
        </p>
      </div>
    </form>
  );
}
