// MAGTravel · precios reales de vuelos (Travelpayouts / Aviasales)
// El token NO va en la web: se guarda en Netlify → Configuración del sitio → Variables de entorno → TRAVELPAYOUTS_TOKEN
// Uso:  /api/precios?origin=MAD&to=LIS,ROM,RAK            → el vuelo i/v más barato encontrado a cada destino
//       /api/precios?origin=MAD&to=ROM&depart=2026-10-15&return=2026-10-22&limit=5&direct=true  → para una búsqueda concreta
const MARKER = process.env.TRAVELPAYOUTS_MARKER || '781109';
const IATA = /^[A-Z]{3}$/;
const DATE = /^\d{4}-\d{2}(-\d{2})?$/;

export default async (req) => {
  const token = process.env.TRAVELPAYOUTS_TOKEN;
  if (!token) return json({ error: 'Falta la variable TRAVELPAYOUTS_TOKEN en Netlify' }, 500);
  const q = new URL(req.url).searchParams;
  const origin = (q.get('origin') || 'MAD').toUpperCase();
  const dests = (q.get('to') || '').toUpperCase().split(',').filter(c => IATA.test(c)).slice(0, 12);
  if (!IATA.test(origin) || !dests.length) return json({ error: 'Parámetros no válidos' }, 400);
  const depart = DATE.test(q.get('depart') || '') ? q.get('depart') : '';
  const ret = DATE.test(q.get('return') || '') ? q.get('return') : '';
  const oneWay = q.get('one_way') === 'true';
  const direct = q.get('direct') === 'true';
  const limit = Math.min(Math.max(parseInt(q.get('limit') || '1', 10) || 1, 1), 10);

  const results = await Promise.all(dests.map(async (to) => {
    const p = new URLSearchParams({ origin, destination: to, currency: 'eur', sorting: 'price', limit: String(limit), page: '1',
      one_way: String(oneWay), direct: String(direct), market: 'es', token });
    if (depart) p.set('departure_at', depart);
    if (ret && !oneWay) p.set('return_at', ret);
    try {
      const r = await fetch('https://api.travelpayouts.com/aviasales/v3/prices_for_dates?' + p, { headers: { 'Accept-Encoding': 'gzip' } });
      if (!r.ok) return { to, error: r.status };
      const d = await r.json();
      const offers = (d.data || []).map(x => ({
        price: Math.round(x.price), airline: x.airline, transfers: x.transfers, returnTransfers: x.return_transfers,
        depart: (x.departure_at || '').slice(0, 10), ret: (x.return_at || '').slice(0, 10),
        origin: x.origin_airport || x.origin, destination: x.destination_airport || x.destination,
        link: x.link ? 'https://www.aviasales.com' + x.link + (x.link.includes('?') ? '&' : '?') + 'marker=' + MARKER : null
      }));
      return { to, offers };
    } catch (e) { return { to, error: 'red' }; }
  }));
  return json({ origin, currency: 'EUR', updated: new Date().toISOString(), results }, 200, { 'Cache-Control': 'public, max-age=1800' });
};

function json(body, status = 200, headers = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', ...headers } });
}

export const config = { path: '/api/precios' };
