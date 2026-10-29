import Link from "next/link";
import { MapPin, Phone } from "@phosphor-icons/react/dist/ssr";
import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { formatWeek } from "@/lib/commerce/hours";
import { CHECKOUT_KIND } from "@/lib/shang-hai/checkout";
import { SHANG_HAI_CREDITS_PATH } from "@/lib/shang-hai/storefronts";

const r = shangHaiRestaurant;

/** Practical information as a tray of labelled compartments. Pending facts say so. */
export function InfoSection() {
  const a = r.address.value;
  const phone = r.phone.value;
  const week = formatWeek(r.hours.value);
  return (
    <section id="info" className="bc-info" aria-labelledby="bc-info-title">
      <h2 id="bc-info-title" className="bc-info__title">
        Información
      </h2>
      <div className="bc-info__grid">
        <div className="bc-info__cell bc-cell--butter">
          <h3 className="bc-info__h">Recogida en el local</h3>
          <p className="bc-info__big">
            {a.street}
            <br />
            {a.postalCode} {a.city} ({a.province})
          </p>
          <a className="bc-linkbtn" href={r.directionsUrl} target="_blank" rel="noopener noreferrer">
            <MapPin size={18} weight="bold" aria-hidden />
            Cómo llegar
            <span className="bc-sr"> (se abre Google Maps)</span>
          </a>
        </div>

        <div className="bc-info__cell bc-cell--black">
          <h3 className="bc-info__h">Cómo funciona</h3>
          <ol className="bc-steps">
            <li>
              <div>
                <strong>Elige en la carta</strong>
                <span>Añade los platos con el botón +.</span>
              </div>
            </li>
            <li>
              <div>
                <strong>Paga online</strong>
                <span>Pago seguro con tarjeta en el último paso.</span>
              </div>
            </li>
            <li>
              <div>
                <strong>Recoge en el local</strong>
                <span>El restaurante te confirmará la hora de recogida.</span>
              </div>
            </li>
          </ol>
        </div>

        <div className="bc-info__cell bc-cell--lime">
          <h3 className="bc-info__h">Horario</h3>
          <span className="bc-flag">Pendiente de confirmar</span>
          <dl className="bc-hours">
            {week.map((row) => (
              <div key={row.day} style={{ display: "contents" }}>
                <dt>{row.day}</dt>
                <dd data-closed={row.text === "Cerrado" || undefined}>{row.text}</dd>
              </div>
            ))}
          </dl>
          <p className="bc-info__note">
            Horario de recogida publicado en Just Eat. El restaurante confirmará el horario de su
            canal propio.
          </p>
        </div>

        <div className="bc-info__cell bc-cell--paper">
          <h3 className="bc-info__h">Teléfono</h3>
          {phone && (
            <a className="bc-linkbtn" href={`tel:${phone.e164}`}>
              <Phone size={18} weight="bold" aria-hidden />
              {phone.display}
            </a>
          )}
          <span className="bc-flag">Por confirmar</span>
          <p className="bc-info__note">
            Número publicado en Just Eat para consultas sobre alérgenos.
          </p>
        </div>

        <div className="bc-info__cell bc-cell--paper">
          <h3 className="bc-info__h">Alérgenos</h3>
          <p className="bc-info__note">{r.allergens.note}</p>
        </div>

        <div className="bc-info__cell bc-cell--tomato">
          <h3 className="bc-info__h">Reparto a domicilio</h3>
          <p className="bc-info__note">
            De momento, los pedidos de esta web son para recoger en el local.
          </p>
        </div>
      </div>
    </section>
  );
}

export function BentoFooter() {
  const a = r.address.value;
  return (
    <footer className="bc-footer">
      <p className="bc-footer__brand">SHANG HAI</p>
      <div className="bc-footer__row">
        <span>Restaurante Asiático · Orihuela</span>
        <span>
          {a.street}, {a.postalCode} {a.city}
        </span>
      </div>
      <div className="bc-footer__row">
        <span>Las fotografías son ilustrativas.</span>
        <Link href={SHANG_HAI_CREDITS_PATH}>Créditos fotográficos</Link>
        {CHECKOUT_KIND === "demo" && <span>Demostración: los pedidos no se envían al restaurante.</span>}
      </div>
      <p className="bc-fine">Una propuesta de MangoCat Studios</p>
    </footer>
  );
}
