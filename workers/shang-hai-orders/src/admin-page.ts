import { base64UrlEncode, randomBytes } from "./crypto";
import { securityHeaders } from "./http";

/**
 * GET /admin — staff order panel (behind Cloudflare Access).
 * Self-contained: no external assets, inline CSS/JS allowed only through a per-request
 * nonce, all order data rendered with textContent (never as HTML).
 */
export function adminPage(): Response {
  const nonce = base64UrlEncode(randomBytes(16));
  const headers = securityHeaders(
    [
      "default-src 'none'",
      `script-src 'nonce-${nonce}'`,
      `style-src 'nonce-${nonce}'`,
      "connect-src 'self'",
      "img-src 'self' data:",
      "base-uri 'none'",
      "form-action 'none'",
      "frame-ancestors 'none'",
    ].join("; "),
  );
  headers.set("Content-Type", "text/html; charset=utf-8");
  return new Response(html(nonce), { status: 200, headers });
}

const html = (nonce: string) => `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Pedidos · SHANG HAI</title>
<style nonce="${nonce}">
  :root { color-scheme: light; --ink:#1d1f22; --muted:#5d636b; --line:#e3e5e8; --bg:#f5f6f7; --card:#fff; --accent:#a7342f; --ok:#1a7f37; --warn:#9a6700; --bad:#b42318; }
  * { box-sizing: border-box; }
  body { margin:0; font: 15px/1.45 ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif; color:var(--ink); background:var(--bg); }
  header { display:flex; flex-wrap:wrap; gap:12px; align-items:center; justify-content:space-between; padding:14px 18px; background:var(--card); border-bottom:1px solid var(--line); position:sticky; top:0; z-index:2; }
  h1 { font-size:18px; margin:0; letter-spacing:.02em; }
  h1 span { color:var(--accent); }
  .controls { display:flex; gap:10px; align-items:center; flex-wrap:wrap; }
  select, button { font:inherit; }
  select { padding:8px 10px; border:1px solid var(--line); border-radius:8px; background:#fff; }
  button { cursor:pointer; border-radius:8px; border:1px solid var(--line); background:#fff; padding:8px 12px; min-height:40px; }
  button.primary { background:var(--ink); color:#fff; border-color:var(--ink); }
  button.danger { color:var(--bad); }
  button:focus-visible, select:focus-visible, a:focus-visible { outline:3px solid #2f6feb; outline-offset:2px; }
  main { display:grid; grid-template-columns:minmax(0, 1.1fr) minmax(0, 1fr); gap:16px; padding:16px; max-width:1400px; margin:0 auto; }
  @media (max-width: 900px) { main { grid-template-columns:1fr; } }
  .card { background:var(--card); border:1px solid var(--line); border-radius:12px; overflow:hidden; }
  table { width:100%; border-collapse:collapse; }
  th, td { text-align:left; padding:10px 12px; border-bottom:1px solid var(--line); vertical-align:top; }
  th { font-size:12px; color:var(--muted); font-weight:600; background:#fafbfc; }
  td.num, th.num { text-align:right; font-variant-numeric:tabular-nums; }
  tr.selected td { background:#fff7f6; }
  .rowbtn { all:unset; cursor:pointer; font-weight:600; }
  .rowbtn:focus-visible { outline:3px solid #2f6feb; outline-offset:2px; }
  .badge { display:inline-block; padding:2px 8px; border-radius:999px; font-size:12px; font-weight:600; background:#eef0f2; }
  .badge.paid { background:#e6f4ea; color:var(--ok); }
  .badge.preparing { background:#fff4d6; color:var(--warn); }
  .badge.ready { background:#e7f0ff; color:#1f4fbf; }
  .badge.failed, .badge.cancelled, .badge.needs_review { background:#fdecea; color:var(--bad); }
  .detail { padding:16px; }
  .detail h2 { margin:0 0 4px; font-size:18px; }
  .muted { color:var(--muted); }
  .lines { margin:12px 0; }
  .actions { display:flex; gap:8px; flex-wrap:wrap; margin-top:12px; }
  dl { display:grid; grid-template-columns:auto 1fr; gap:4px 12px; margin:12px 0; }
  dt { color:var(--muted); }
  dd { margin:0; word-break:break-word; }
  ol.events { padding-left:18px; margin:8px 0 0; font-size:13px; }
  .empty { padding:24px; color:var(--muted); }
  .status-line { font-size:12px; color:var(--muted); }
  .error { color:var(--bad); padding:12px 16px; }
  .list-title { font-size:13px; margin:12px 12px 4px; }
  tr.total td { font-weight:700; }
</style>
</head>
<body>
<header>
  <h1><span>SHANG HAI</span> · Pedidos</h1>
  <div class="controls">
    <label for="filter">Estado</label>
    <select id="filter">
      <option value="">Todos</option>
      <option value="paid">Pagado</option>
      <option value="preparing">En preparación</option>
      <option value="ready">Listo para recoger</option>
      <option value="pending">Pendiente de pago</option>
      <option value="completed">Entregado</option>
      <option value="needs_review">En revisión</option>
      <option value="failed">Pago no completado</option>
      <option value="cancelled">Cancelado</option>
    </select>
    <button type="button" id="refresh">Actualizar</button>
    <span class="status-line" id="updated" aria-live="polite"></span>
  </div>
</header>
<main>
  <section class="card" aria-labelledby="list-title">
    <h2 id="list-title" class="muted list-title">Pedidos recientes</h2>
    <div id="list-error" class="error" role="alert" hidden></div>
    <table>
      <thead><tr><th scope="col">Hora</th><th scope="col">Pedido</th><th scope="col">Cliente</th><th scope="col" class="num">Uds.</th><th scope="col" class="num">Total</th><th scope="col">Estado</th></tr></thead>
      <tbody id="rows"></tbody>
    </table>
    <p class="empty" id="empty" hidden>No hay pedidos con este filtro.</p>
  </section>
  <section class="card" aria-live="polite" aria-labelledby="detail-title">
    <div class="detail" id="detail"><h2 id="detail-title">Detalle</h2><p class="muted">Elige un pedido de la lista.</p></div>
  </section>
</main>
<script nonce="${nonce}">
(() => {
  const euro = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" });
  const time = new Intl.DateTimeFormat("es-ES", { dateStyle: "short", timeStyle: "short", timeZone: "Europe/Madrid" });
  const NEXT = { paid: ["preparing", "Marcar en preparación"], preparing: ["ready", "Marcar listo para recoger"], ready: ["completed", "Marcar entregado"] };
  const CANCELLABLE = ["paid", "preparing"];
  const el = (tag, text, cls) => { const n = document.createElement(tag); if (text != null) n.textContent = String(text); if (cls) n.className = cls; return n; };
  const rows = document.getElementById("rows");
  const detail = document.getElementById("detail");
  const filter = document.getElementById("filter");
  const listError = document.getElementById("list-error");
  let selected = null;

  async function api(path, init) {
    const res = await fetch(path, { credentials: "same-origin", headers: { "Accept": "application/json", ...(init && init.body ? { "Content-Type": "application/json" } : {}) }, ...init });
    const body = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(body.error || res.status), { status: res.status, body });
    return body;
  }

  function badge(status, label) { return el("span", label, "badge " + status); }

  async function loadList() {
    try {
      const q = filter.value ? "?status=" + encodeURIComponent(filter.value) : "";
      const { orders } = await api("/api/admin/orders" + q);
      listError.hidden = true;
      rows.replaceChildren();
      document.getElementById("empty").hidden = orders.length > 0;
      for (const o of orders) {
        const tr = document.createElement("tr");
        if (o.id === selected) tr.className = "selected";
        tr.append(el("td", time.format(new Date(o.createdAt))));
        const idCell = document.createElement("td");
        const b = el("button", o.id, "rowbtn"); b.type = "button";
        b.addEventListener("click", () => { selected = o.id; loadDetail(); loadList(); });
        idCell.append(b); tr.append(idCell);
        tr.append(el("td", o.customerName));
        tr.append(el("td", o.itemCount, "num"));
        tr.append(el("td", euro.format(o.totalCents / 100), "num"));
        const st = document.createElement("td"); st.append(badge(o.status, o.statusLabel)); tr.append(st);
        rows.append(tr);
      }
      document.getElementById("updated").textContent = "Actualizado " + new Date().toLocaleTimeString("es-ES");
    } catch (e) {
      listError.hidden = false;
      listError.textContent = e.status === 503 ? "El panel no está configurado (Cloudflare Access)." : (e.status === 401 || e.status === 403) ? "Sesión no autorizada. Vuelve a iniciar sesión." : "No se pudieron cargar los pedidos. Reintentando…";
    }
  }

  async function setStatus(status) {
    try {
      await api("/api/admin/orders/" + encodeURIComponent(selected) + "/status", { method: "POST", body: JSON.stringify({ status }) });
      await Promise.all([loadDetail(), loadList()]);
    } catch (e) {
      const p = el("p", e.status === 409 ? "Ese cambio de estado no está permitido ahora." : "No se pudo actualizar el pedido.", "error");
      p.setAttribute("role", "alert"); detail.append(p);
    }
  }

  async function loadDetail() {
    if (!selected) return;
    try {
      const { order: o } = await api("/api/admin/orders/" + encodeURIComponent(selected));
      const frag = document.createDocumentFragment();
      const h = el("h2", "Pedido " + o.id); h.id = "detail-title"; frag.append(h);
      const sub = el("p", time.format(new Date(o.createdAt)) + " · " + (o.fulfillment === "pickup" ? "Recogida en el local" : "Reparto") + " · ", "muted");
      sub.append(badge(o.status, o.statusLabel)); frag.append(sub);
      const t = document.createElement("table"); t.className = "lines";
      const head = document.createElement("thead"); const hr = document.createElement("tr");
      for (const [label, cls] of [["Producto", ""], ["Uds.", "num"], ["Precio", "num"], ["Importe", "num"]]) { const th = el("th", label, cls); th.scope = "col"; hr.append(th); }
      head.append(hr); t.append(head);
      const tb = document.createElement("tbody");
      for (const l of o.lines) {
        const tr = document.createElement("tr");
        const name = el("td", l.name); if (l.optionsLabel) name.append(el("div", l.optionsLabel, "muted"));
        tr.append(name, el("td", l.quantity, "num"), el("td", euro.format(l.unitPriceCents / 100), "num"), el("td", euro.format(l.lineTotalCents / 100), "num"));
        tb.append(tr);
      }
      const total = document.createElement("tr"); total.append(el("td", "Total"), el("td", ""), el("td", ""), el("td", euro.format(o.totalCents / 100), "num")); total.className = "total"; tb.append(total);
      t.append(tb); frag.append(t);
      const dl = document.createElement("dl");
      const row = (k, v) => { dl.append(el("dt", k)); const dd = document.createElement("dd"); if (v instanceof Node) dd.append(v); else dd.textContent = v == null || v === "" ? "—" : String(v); dl.append(dd); };
      row("Cliente", o.customer.name);
      const tel = document.createElement("a"); tel.href = "tel:" + o.customer.phone; tel.textContent = o.customer.phone; row("Teléfono", tel);
      row("Correo", o.customer.email);
      row("Comentarios", o.customer.notes);
      if (o.ageConfirmed) row("Bebidas alcohólicas", "Mayoría de edad confirmada por el cliente; comprobar DNI al recoger");
      row("Pago", (o.payment.mode === "stripe-live" ? "Stripe (real)" : "Stripe (pruebas)") + " · " + (o.payment.stripePaymentStatus || "sin confirmar"));
      row("Sesión Stripe", o.payment.stripeSessionId);
      row("Tienda", o.storefront);
      frag.append(dl);
      const actions = el("div", null, "actions");
      if (NEXT[o.status]) { const b = el("button", NEXT[o.status][1], "primary"); b.type = "button"; b.addEventListener("click", () => setStatus(NEXT[o.status][0])); actions.append(b); }
      if (CANCELLABLE.includes(o.status)) {
        const c = el("button", "Cancelar pedido", "danger"); c.type = "button";
        c.addEventListener("click", () => { if (c.dataset.armed) { setStatus("cancelled"); } else { c.dataset.armed = "1"; c.textContent = "Confirmar cancelación"; } });
        actions.append(c);
      }
      frag.append(actions);
      frag.append(el("h3", "Historial", "muted"));
      const ol = el("ol", null, "events");
      for (const ev of o.events) ol.append(el("li", time.format(new Date(ev.at)) + " — " + (ev.from ? ev.from + " → " : "") + ev.to + (ev.note ? " · " + ev.note : "") + (ev.actor ? " (" + ev.actor + ")" : "")));
      frag.append(ol);
      detail.replaceChildren(frag);
    } catch (e) {
      detail.replaceChildren(el("p", "No se pudo cargar el pedido.", "error"));
    }
  }

  filter.addEventListener("change", loadList);
  document.getElementById("refresh").addEventListener("click", () => { loadList(); loadDetail(); });
  loadList();
  setInterval(() => { if (!document.hidden) { loadList(); loadDetail(); } }, 20000);
})();
</script>
</body>
</html>`;
