import { shangHaiRestaurant } from "@/data/shang-hai/restaurant";
import { formatWeek } from "@/lib/commerce/hours";
import { ShPhoto } from "@/components/shang-hai/shared/ShPhoto";
import { inkPhotos } from "./ink-photos";

const r = shangHaiRestaurant;
const address = r.address.value;
const phone = r.phone.value;
const week = formatWeek(r.hours.value);

/**
 * Practical information, set like the last pages of a book: where, when, how. Every
 * unconfirmed fact says so in place, instead of being presented as definitive.
 */
export function InkInfo() {
  return (
    <section id="informacion" className="ink-info" aria-labelledby="ink-info-title">
      <h2 id="ink-info-title" className="ink-info__title" tabIndex={-1} data-anchor-focus>
        Información
      </h2>

      <div className="ink-info__grid">
        <div id="contacto" className="ink-info__block ink-info__where">
          <h3 className="ink-info__h" tabIndex={-1} data-anchor-focus>
            Dónde recoger
          </h3>
          <address className="ink-info__address">
            {address.street}
            <br />
            {address.postalCode} {address.city} ({address.province})
          </address>
          <a href={r.directionsUrl} target="_blank" rel="noopener noreferrer" className="ink-link">
            Cómo llegar<span className="ink-sr-only"> (se abre Google Maps en otra pestaña)</span>
          </a>

          <h3 className="ink-info__h ink-info__h--spaced">Teléfono</h3>
          {phone ? (
            <p>
              <a href={`tel:${phone.e164}`} className="ink-link ink-info__phone">
                {phone.display}
              </a>
            </p>
          ) : null}
          <p className="ink-info__pending">
            Publicado como teléfono para consultas sobre alérgenos. Pendiente de confirmar si también
            atiende pedidos.
          </p>
        </div>

        <div className="ink-info__block">
          <h3 className="ink-info__h">Horario de recogida</h3>
          <table className="ink-hours">
            <caption className="ink-sr-only">Horario de recogida publicado</caption>
            <tbody>
              {week.map((row) => (
                <tr key={row.day} data-closed={row.text === "Cerrado" ? "" : undefined}>
                  <th scope="row">{row.day}</th>
                  <td>{row.text}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="ink-info__pending">
            Horario publicado en Just Eat. Pendiente de que el restaurante lo confirme para sus
            pedidos directos.
          </p>
        </div>

        <figure className="ink-info__figure">
          {inkPhotos.tea ? (
            <ShPhoto photo={inkPhotos.tea} sizes="(min-width: 900px) 26vw, 80vw" className="ink-photo ink-info__img" />
          ) : (
            <div className="ink-photo-fallback" aria-hidden="true" />
          )}
          <figcaption className="ink-caption">Imagen ilustrativa</figcaption>
        </figure>
      </div>

      <div id="como-pedir" className="ink-steps">
        <h3 className="ink-info__h">Cómo funciona el pedido</h3>
        <ol className="ink-steps__list">
          <li>
            <span className="ink-steps__num" aria-hidden="true">
              1
            </span>
            <p className="ink-steps__title">Elige en la carta</p>
            <p>Añade los platos que quieras; puedes cambiar cantidades hasta el último paso.</p>
          </li>
          <li>
            <span className="ink-steps__num" aria-hidden="true">
              2
            </span>
            <p className="ink-steps__title">Paga online</p>
            <p>El pago se hace en una página segura. El restaurante recibe el pedido al confirmarse.</p>
          </li>
          <li>
            <span className="ink-steps__num" aria-hidden="true">
              3
            </span>
            <p className="ink-steps__title">Recoge en el local</p>
            <p>El restaurante te confirmará la hora de recogida en {address.street}.</p>
          </li>
        </ol>
      </div>

      <aside className="ink-allergens" aria-labelledby="ink-allergens-title">
        <h3 id="ink-allergens-title" className="ink-info__h">
          Alergias e intolerancias
        </h3>
        <p>{r.allergens.note}</p>
      </aside>
    </section>
  );
}
