import type { Metadata } from "next";
import Link from "next/link";
import { ShPhoto } from "@/components/shang-hai/shared/ShPhoto";
import { shangHaiPhotos, type Photo } from "@/data/shang-hai/photos";
import { SHANG_HAI_BASE_PATH, STOREFRONTS } from "@/lib/shang-hai/storefronts";

export const metadata: Metadata = {
  title: { absolute: "Créditos fotográficos · Propuestas SHANG HAI · MangoCat Studios" },
  description: "Autoría y licencias de las fotografías ilustrativas usadas en las propuestas.",
};

const GROUPS: { id: (typeof STOREFRONTS)[number]["id"]; photos: Record<string, Photo> }[] = [
  { id: "ink-house", photos: shangHaiPhotos.inkHouse },
  { id: "wok-after-dark", photos: shangHaiPhotos.wokAfterDark },
  { id: "bento-club", photos: shangHaiPhotos.bentoClub },
];

export default function CreditsPage() {
  return (
    <div
      lang="es"
      className="min-h-[100dvh] bg-[#f4f4f2] px-4 py-10 text-[#1c1c1e] sm:px-8 sm:py-16"
      style={{ fontFamily: "ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif", lineHeight: 1.55 }}
    >
      <main className="mx-auto max-w-[960px]">
        <Link
          href={`${SHANG_HAI_BASE_PATH}/`}
          className="text-[14px] font-medium text-[#1c1c1e] underline underline-offset-4 hover:text-black"
        >
          Volver a las propuestas
        </Link>
        <h1 className="mt-6 text-[32px] font-semibold leading-tight tracking-[-0.01em] sm:text-[40px]" style={{ fontFamily: "inherit", color: "inherit" }}>
          Créditos fotográficos
        </h1>
        <p className="mt-3 max-w-[62ch] text-[16px] text-[#4a4a4f]">
          Las fotografías de las propuestas son ilustrativas y provisionales: ninguna muestra un
          plato preparado por Restaurante Shang Hai. Se sustituirán por fotografía propia del
          restaurante antes de publicar la web definitiva. Todas tienen licencia libre (Wikimedia
          Commons); se han recortado, redimensionado y convertido a WebP.
        </p>

        {GROUPS.map((group) => {
          const shop = STOREFRONTS.find((s) => s.id === group.id)!;
          return (
            <section key={group.id} aria-labelledby={`cred-${group.id}`} className="mt-12">
              <h2 id={`cred-${group.id}`} className="text-[20px] font-semibold" style={{ fontFamily: "inherit", color: "inherit" }}>
                Propuesta {shop.number} · {shop.name}
              </h2>
              <ul className="mt-4 grid gap-4 sm:grid-cols-2">
                {Object.values(group.photos).map((photo) => (
                  <li key={photo.id} className="flex gap-4 rounded-lg bg-white p-3 ring-1 ring-black/8">
                    <ShPhoto
                      photo={photo}
                      sizes="112px"
                      alt=""
                      className="h-24 w-28 shrink-0 rounded object-cover"
                    />
                    <div className="min-w-0 text-[14px]">
                      <p className="font-medium">{photo.alt}</p>
                      <p className="mt-1 text-[#4a4a4f]">
                        {photo.credit.author} ·{" "}
                        {photo.credit.licenseUrl ? (
                          <a href={photo.credit.licenseUrl} className="underline underline-offset-2" rel="license noopener" target="_blank">
                            {photo.credit.license}
                          </a>
                        ) : (
                          photo.credit.license
                        )}{" "}
                        ·{" "}
                        <a href={photo.credit.sourceUrl} className="underline underline-offset-2" rel="noopener" target="_blank">
                          Fuente
                        </a>
                      </p>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}

        <p className="mt-14 text-[13px] text-[#6b6b70]">
          El sello 上海 de la propuesta Ink House usa los contornos de Noto Serif CJK SC (SIL Open
          Font License 1.1). Una propuesta de MangoCat Studios.
        </p>
      </main>
    </div>
  );
}
