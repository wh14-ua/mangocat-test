import Link from "next/link";
import { Schibsted_Grotesk } from "next/font/google";
import { shangHaiCatalog } from "@/lib/shang-hai/catalog";
import { asset } from "@/lib/shang-hai/paths";
import {
  SHANG_HAI_CREDITS_PATH,
  STOREFRONTS,
  storefrontRoutes,
  type StorefrontId,
} from "@/lib/shang-hai/storefronts";
import { ProposalSelector } from "./ProposalSelector";

const grotesk = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-compare",
  display: "swap",
});

/** How each proposal frames itself: its own atmosphere around MangoCat's typography. */
const ATMOSPHERE: Record<
  StorefrontId,
  { bg: string; fg: string; muted: string; rule: string; accent: string; accentText: string; onAccent: string; frame: string }
> = {
  "ink-house": {
    bg: "#F1EDE3",
    fg: "#171A17",
    muted: "#5d5a52",
    rule: "rgba(23,26,23,0.14)",
    accent: "#A7342F",
    accentText: "#A7342F",
    onAccent: "#F7F3EA",
    frame: "rgba(23,26,23,0.16)",
  },
  "wok-after-dark": {
    bg: "#101E24",
    fg: "#F6F3EA",
    muted: "#9fb0b7",
    rule: "rgba(246,243,234,0.16)",
    accent: "#FF6B35",
    accentText: "#FF6B35",
    onAccent: "#101E24",
    frame: "rgba(246,243,234,0.18)",
  },
  "bento-club": {
    bg: "#FFF8EA",
    fg: "#22221F",
    muted: "#5b5a52",
    rule: "rgba(34,34,31,0.14)",
    accent: "#B5391F",
    accentText: "#B5391F",
    onAccent: "#FFF8EA",
    frame: "rgba(34,34,31,0.2)",
  },
};

/** What really differs between the three, in the owner's terms. */
const TRAITS: Record<StorefrontId, { label: string; text: string }[]> = {
  "ink-house": [
    { label: "Portada", text: "Composición editorial asimétrica, mucho aire y el sello 上海 en rojo lacre." },
    { label: "Carta", text: "Un libro con índice: capítulos numerados y filas finas con precios alineados." },
    { label: "Pedido", text: "Una comanda de papel que se abre a un lado, sin salir de la carta." },
  ],
  "wok-after-dark": [
    { label: "Portada", text: "Un cartel nocturno: letras gigantes con el fuego del wok dentro." },
    { label: "Carta", text: "Platos como tickets de cocina, con categorías siempre a mano." },
    { label: "Pedido", text: "Un ticket de alto contraste, visible en todo momento." },
  ],
  "bento-club": [
    { label: "Portada", text: "Una bandeja de bento: módulos de color que llevan directo a pedir." },
    { label: "Carta", text: "Buscador destacado y fichas compactas para añadir con un toque." },
    { label: "Pedido", text: "Barra inferior en el móvil y pedido siempre visible en el ordenador." },
  ],
};

function Screens({ id, name }: { id: StorefrontId; name: string }) {
  const a = ATMOSPHERE[id];
  return (
    <div className="relative pb-10 md:pb-16">
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, pre-sized capture */}
      <img
        src={asset(`/images/shang-hai/previews/${id}-desktop.webp`)}
        width={1600}
        height={1000}
        loading="lazy"
        decoding="async"
        alt={`Captura de escritorio de la propuesta ${name}: portada a 1440 píxeles de ancho.`}
        className="block h-auto w-full rounded-[10px]"
        style={{ boxShadow: `0 0 0 1px ${a.frame}, 0 30px 60px -30px rgba(0,0,0,0.45)` }}
      />
      {/* eslint-disable-next-line @next/next/no-img-element -- static export, pre-sized capture */}
      <img
        src={asset(`/images/shang-hai/previews/${id}-mobile.webp`)}
        width={640}
        height={1385}
        loading="lazy"
        decoding="async"
        alt={`Captura móvil de la propuesta ${name}: portada a 390 píxeles de ancho.`}
        className="absolute -bottom-2 right-3 h-auto w-[30%] min-w-[118px] max-w-[230px] rounded-[22px] md:-bottom-4 md:right-[-18px]"
        style={{ boxShadow: `0 0 0 1px ${a.frame}, 0 24px 48px -16px rgba(0,0,0,0.5)` }}
      />
    </div>
  );
}

export function ComparePage() {
  const dishes = shangHaiCatalog.visibleItems.length;
  const categories = shangHaiCatalog.catalog.categories.length;

  return (
    <div
      lang="es"
      className={`${grotesk.variable} sh-compare min-h-[100dvh] bg-[#f6f4ef] text-[#1d1b18]`}
      style={{ fontFamily: "var(--font-compare), ui-sans-serif, system-ui, sans-serif", lineHeight: 1.5 }}
    >
      {/* The root layout paints ATELIER's dark body; match it to this page (also on overscroll). */}
      <style>{`html:has(.sh-compare) body{background:#f6f4ef;color-scheme:light}.sh-compare ::selection{background:#1d1b18;color:#f6f4ef}`}</style>
      <header className="mx-auto flex max-w-[1240px] flex-wrap items-baseline justify-between gap-x-6 gap-y-1 px-4 pt-5 text-[13px] sm:px-8">
        <Link href="/showcase" prefetch={false} className="font-bold text-[#1d1b18] hover:text-[#9c4511]">
          MangoCat Studios
        </Link>
        <p className="text-[#56534c]">Propuesta para Restaurante Shang Hai, Orihuela. Octubre de 2026</p>
      </header>

      <section className="mx-auto max-w-[1240px] px-4 pb-14 pt-16 sm:px-8 md:pb-20 md:pt-24">
        <h1
          className="max-w-[16ch] text-[clamp(2.75rem,8.4vw,7rem)] font-extrabold leading-[0.95] tracking-[-0.035em]"
          style={{ fontFamily: "inherit", color: "inherit", fontWeight: 800 }}
        >
          SHANG HAI — Tres visiones, una identidad.
        </h1>
        <p className="mt-7 max-w-[46ch] text-[clamp(1.125rem,2vw,1.375rem)] leading-snug text-[#3f3c36]">
          Tres propuestas digitales creadas por MangoCat Studios para Restaurante Shang Hai.
        </p>
        <p className="mt-4 max-w-[60ch] text-[15px] text-[#56534c]">
          Las tres funcionan de verdad: carta real, carrito y pedido completo en modo de
          demostración. Ábrelas, pide algo y quédate con la que mejor cuente tu restaurante.
        </p>
      </section>

      <ProposalSelector />

      {STOREFRONTS.map((s) => {
        const a = ATMOSPHERE[s.id];
        const routes = storefrontRoutes(s.id);
        return (
          <section
            key={s.id}
            id={s.id}
            aria-labelledby={`${s.id}-title`}
            className="scroll-mt-14"
            style={{ backgroundColor: a.bg, color: a.fg }}
          >
            <div className="mx-auto grid max-w-[1240px] gap-10 px-4 py-16 sm:px-8 md:grid-cols-12 md:gap-8 md:py-24">
              <div className="md:col-span-5 md:pr-6">
                <p className="text-[15px] font-semibold tabular-nums" style={{ color: a.accentText }}>
                  {s.number}
                </p>
                <h2
                  id={`${s.id}-title`}
                  className="mt-2 text-[clamp(2.25rem,5vw,3.75rem)] font-extrabold leading-[0.98] tracking-[-0.03em]"
                  style={{ fontFamily: "inherit", color: "inherit", fontWeight: 800 }}
                >
                  {s.name.toUpperCase()}
                </h2>
                <p className="mt-3 text-[19px] font-semibold">{s.summary}</p>
                <p className="mt-4 max-w-[44ch] text-[16px]" style={{ color: a.muted }}>
                  {s.personality}
                </p>
                <dl className="mt-8 border-t" style={{ borderColor: a.rule }}>
                  {TRAITS[s.id].map((t) => (
                    <div
                      key={t.label}
                      className="grid grid-cols-[6.5rem_1fr] gap-3 border-b py-3 text-[15px]"
                      style={{ borderColor: a.rule }}
                    >
                      <dt className="font-semibold">{t.label}</dt>
                      <dd style={{ color: a.muted }}>{t.text}</dd>
                    </div>
                  ))}
                </dl>
                <Link
                  href={routes.home}
                  className="mt-9 inline-flex min-h-12 items-center justify-center rounded-full px-7 text-[16px] font-bold transition-transform hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4"
                  style={{ backgroundColor: a.accent, color: a.onAccent, outlineColor: a.accent }}
                >
                  Abrir la propuesta {s.number}
                </Link>
              </div>
              <div className="md:col-span-7">
                <Screens id={s.id} name={s.name} />
              </div>
            </div>
          </section>
        );
      })}

      <section aria-labelledby="engine-title" className="mx-auto max-w-[1240px] px-4 py-16 sm:px-8 md:py-24">
        <div className="grid gap-10 md:grid-cols-12">
          <h2
            id="engine-title"
            className="text-[clamp(1.75rem,3.4vw,2.75rem)] font-extrabold leading-[1.02] tracking-[-0.025em] md:col-span-4"
            style={{ fontFamily: "inherit", color: "inherit", fontWeight: 800 }}
          >
            Tres caras, el mismo motor.
          </h2>
          <ul className="space-y-6 text-[16px] md:col-span-7 md:col-start-6">
            <li>
              <strong className="block text-[17px]">La carta real del Shang Hai.</strong>
              <span className="text-[#4d4a43]">
                {categories} categorías y {dishes} platos tal y como aparecen en vuestra ficha de
                Just Eat (consultada el 29 de octubre de 2026), con sus precios. Ningún plato
                inventado; los precios dudosos aparecen como pendientes de confirmar.
              </span>
            </li>
            <li>
              <strong className="block text-[17px]">Pedido para recoger con pago online.</strong>
              <span className="text-[#4d4a43]">
                En esta demostración el pago es simulado y no se cobra nada. La conexión con
                Stripe está preparada en modo de pruebas y el servidor recalcula cada importe.
              </span>
            </li>
            <li>
              <strong className="block text-[17px]">Pedidos en un panel propio.</strong>
              <span className="text-[#4d4a43]">
                Los pedidos pagados llegan a un panel interno, protegido con acceso autenticado,
                para marcarlos en preparación, listos y entregados.
              </span>
            </li>
            <li>
              <strong className="block text-[17px]">Lo que necesitamos confirmar contigo.</strong>
              <span className="text-[#4d4a43]">
                Teléfono de pedidos, horario del canal propio, tiempo de preparación,
                información de alérgenos, si quieres vender vino online y vuestras propias fotos.
                Las imágenes actuales son ilustrativas.
              </span>
            </li>
          </ul>
        </div>
      </section>

      <footer className="border-t border-[#1d1b18]/10">
        <div className="mx-auto flex max-w-[1240px] flex-wrap items-center justify-between gap-4 px-4 py-8 text-[13px] text-[#56534c] sm:px-8">
          <p>Una propuesta de MangoCat Studios</p>
          <nav aria-label="Enlaces del pie" className="flex gap-5">
            <Link href={SHANG_HAI_CREDITS_PATH} className="underline-offset-4 hover:text-[#1d1b18] hover:underline">
              Créditos fotográficos
            </Link>
            <Link href="/showcase" prefetch={false} className="underline-offset-4 hover:text-[#1d1b18] hover:underline">
              Catálogo de estilos
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}
