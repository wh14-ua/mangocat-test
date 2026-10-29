import Link from "next/link";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { formatWeek } from "@/lib/commerce/hours";
import { asset } from "@/lib/shang-hai/paths";
import { SHANG_HAI_CREDITS_PATH } from "@/lib/shang-hai/storefronts";
import { ShPhoto } from "@/components/shang-hai/shared/ShPhoto";
import { wokPhotos } from "./photos";

const MARQUEE = [
  "Pedidos para recoger",
  "Cocina china y sushi",
  "Av. Doctor Gómez Pardo Ródenas 5",
  "Orihuela",
];

/** The first screen: SHANG HAI as a night poster, fire burning inside the letters. */
export function Hero() {
  const fire = wokPhotos.fire;
  const fill = fire ? "photo" : "solid";
  const fireVars = fire
    ? ({
        "--wok-fire-sm": `url(${asset(fire.srcSmall ?? fire.src)})`,
        "--wok-fire-lg": `url(${asset(fire.src)})`,
      } as React.CSSProperties)
    : undefined;
  return (
    <section id="inicio" aria-labelledby="wok-title" className="relative">
      <div className="px-4 pt-6 sm:px-6 lg:px-12 lg:pt-10">
        <div className="wok-cond flex items-center justify-between gap-4 text-[0.8125rem] text-[var(--wok-metal-light)]">
          <p>Restaurante asiático / Orihuela</p>
          <p className="hidden sm:block">Pedidos online para recoger</p>
        </div>

        <h1 id="wok-title" className="wok-hero-type mt-5 lg:mt-8" style={fireVars}>
          <span className="wok-rise">
            <span
              className="wok-hero-word wok-hero-word--shang"
              data-fill={fill}
              style={{ ["--i" as string]: 0 } as React.CSSProperties}
            >
              Shang
            </span>
          </span>{" "}
          <span className="wok-rise">
            <span
              className="wok-hero-word wok-hero-word--hai"
              data-fill={fill}
              style={{ ["--i" as string]: 1 } as React.CSSProperties}
            >
              Hai
            </span>
          </span>
        </h1>

        <div className="mt-6 grid gap-5 pb-10 lg:mt-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end lg:gap-10 lg:pb-14">
          <p className="max-w-[36ch] text-[1.125rem] leading-snug lg:text-[1.375rem]">
            Cocina china y sushi para recoger en Orihuela. Eliges en la carta, pagas online y pasas a
            por tu pedido.
          </p>
          <div className="wok-pop flex flex-col gap-3 sm:flex-row">
            <a
              href="#carta"
              data-testid="go-to-menu"
              className="wok-btn wok-btn--hot h-16 px-8 text-[1.375rem] sm:min-w-[15rem]"
            >
              Pide ahora
            </a>
            <a href="#info" className="wok-btn wok-btn--line h-16 px-6 text-[1rem]">
              Recogida y horario
            </a>
          </div>
        </div>
      </div>
      <Marquee />
    </section>
  );
}

function Marquee() {
  const run = (key: string) => (
    <span key={key} className="flex shrink-0 items-center">
      {MARQUEE.map((t) => (
        <span key={t} className="flex items-center">
          <span className="wok-display px-5 text-[2.1rem] lg:px-8 lg:text-[2.75rem]">{t}</span>
          <span className="wok-display text-[2.1rem] lg:text-[2.75rem]">/</span>
        </span>
      ))}
    </span>
  );
  return (
    <div aria-hidden className="wok-marquee border-y-2 border-[var(--wok-petrol)] py-3">
      <div className="wok-marquee-track">
        {run("a")}
        {run("b")}
      </div>
    </div>
  );
}

const STEPS = [
  { n: "01", title: "Elige", text: "Añade platos a tu ticket desde la carta. Puedes cambiar cantidades cuando quieras." },
  { n: "02", title: "Paga online", text: "Pago seguro con tarjeta. Recibes la confirmación al momento." },
  { n: "03", title: "Recoge", text: "El restaurante te confirmará la hora de recogida. Pasa por el local con tu número de pedido." },
];

/** Pickup, contact and how-it-works, set as a poster block. */
export function Info() {
  const r = shangHaiRestaurant;
  const a = r.address.value;
  const week = formatWeek(r.hours.value);
  const street = wokPhotos.street;
  return (
    <section id="info" aria-labelledby="wok-info-title" className="border-t-4 border-[var(--wok-orange)] px-4 pb-20 pt-14 sm:px-6 lg:px-12 lg:pt-20">
      <div className="grid gap-10 lg:grid-cols-[minmax(0,1.15fr)_minmax(0,1fr)] lg:gap-14">
        <div className="min-w-0">
          <p className="wok-cond text-[0.8125rem] text-[var(--wok-orange)]">Dónde recoger</p>
          <h2 id="wok-info-title" className="wok-display mt-3 text-[clamp(3.75rem,15vw,9.5rem)]">
            Recoge en el local
          </h2>
          <address className="mt-8 not-italic">
            <p className="wok-cond-tight text-[1.5rem] leading-tight lg:text-[2rem]">
              {a.street}
              <br />
              {a.postalCode} {a.city} ({a.province})
            </p>
          </address>
          <div className="mt-6 flex flex-wrap gap-3">
            <a
              href={r.directionsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="wok-btn wok-btn--hot"
            >
              Cómo llegar
              <span className="wok-sr"> (se abre Google Maps en una pestaña nueva)</span>
            </a>
            {r.phone.value && (
              <a href={`tel:${r.phone.value.e164}`} className="wok-btn wok-btn--line wok-nums">
                {r.phone.value.display}
              </a>
            )}
          </div>
          <p className="wok-muted mt-3 max-w-[44ch] text-[0.875rem]">
            Teléfono publicado en Just Eat para consultas sobre alérgenos. Pendiente de confirmar
            como teléfono de pedidos.
          </p>
        </div>

        {street && (
          <figure className="relative min-w-0 self-end">
            <div className="wok-slant aspect-[3/2] overflow-hidden bg-[var(--wok-petrol-3)]">
              <ShPhoto photo={street} sizes="(min-width: 1024px) 40vw, 92vw" className="h-full w-full object-cover" />
            </div>
            <figcaption className="wok-cond wok-muted mt-2 text-right text-[0.6875rem]">Imagen ilustrativa</figcaption>
          </figure>
        )}
      </div>

      <div className="mt-16 grid gap-10 lg:mt-24 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)] lg:gap-14">
        <div>
          <h3 className="wok-display text-[clamp(2.75rem,8vw,4.75rem)]">Cómo funciona</h3>
          <ol className="mt-6 grid gap-px bg-[var(--wok-line)] sm:grid-cols-3">
            {STEPS.map((s) => (
              <li key={s.n} className="bg-[var(--wok-petrol)] p-5 sm:pr-6">
                <p className="wok-display text-[3.5rem] text-[var(--wok-orange)]" aria-hidden>
                  {s.n}
                </p>
                <p className="wok-cond-tight mt-3 text-[1.25rem]">{s.title}</p>
                <p className="wok-muted mt-2 text-[0.9375rem] leading-snug">{s.text}</p>
              </li>
            ))}
          </ol>
        </div>
        <div>
          <h3 className="wok-display text-[clamp(2.75rem,8vw,4.75rem)]">Horario</h3>
          <table className="mt-6 w-full border-collapse text-[0.9375rem]">
            <caption className="wok-sr">Horario de recogida publicado en Just Eat</caption>
            <tbody>
              {week.map((d) => (
                <tr key={d.day} className="border-b border-[var(--wok-line)]">
                  <th scope="row" className="wok-cond py-2.5 pr-4 text-left text-[0.8125rem] font-semibold">
                    {d.day}
                  </th>
                  <td className={"wok-nums py-2.5 text-right " + (d.text === "Cerrado" ? "text-[var(--wok-orange)]" : "")}>
                    {d.text}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="wok-muted mt-3 text-[0.875rem]">
            Horario de recogida publicado en Just Eat. Pendiente de confirmar por el restaurante para
            los pedidos de esta web.
          </p>
        </div>
      </div>

      <div className="mt-16 grid gap-px bg-[var(--wok-line)] sm:grid-cols-2">
        <div className="bg-[var(--wok-petrol-2)] p-5 lg:p-7">
          <p className="wok-cond-tight text-[1.125rem] text-[var(--wok-heat)]">¿Alergias o intolerancias?</p>
          <p className="mt-2 text-[0.9375rem] leading-snug">{r.allergens.note}</p>
        </div>
        <div className="bg-[var(--wok-petrol-2)] p-5 lg:p-7">
          <p className="wok-cond-tight text-[1.125rem]">Reparto a domicilio</p>
          <p className="wok-muted mt-2 text-[0.9375rem] leading-snug">
            Todavía no disponible en esta web. De momento, los pedidos online son para recoger en el
            local.
          </p>
        </div>
      </div>
    </section>
  );
}

export function Footer() {
  return (
    <footer className="border-t border-[var(--wok-line)] px-4 pb-28 pt-10 sm:px-6 lg:px-12 lg:pb-32">
      <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <p className="wok-display text-[3rem]">Shang Hai</p>
          <p className="wok-cond wok-muted mt-2 text-[0.75rem]">Restaurante asiático / Orihuela</p>
        </div>
        <div className="wok-muted flex flex-col gap-2 text-[0.8125rem] lg:items-end">
          <p>Carta y precios según la ficha pública del restaurante en Just Eat (29/10/2026).</p>
          <p className="flex flex-wrap gap-x-5 gap-y-1">
            <Link href={SHANG_HAI_CREDITS_PATH} className="underline underline-offset-4 hover:text-[var(--wok-white)]">
              Créditos fotográficos
            </Link>
            <span>Una propuesta de MangoCat Studios</span>
          </p>
        </div>
      </div>
    </footer>
  );
}
