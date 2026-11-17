// from and to are [longitude, latitude]
async function viaGoogle(from, to) {
  const key = process.env.GOOGLE_MAPS_API_KEY;
  if (!key) return null;
  const url =
    `https://maps.googleapis.com/maps/api/directions/json` +
    `?origin=${from[1]},${from[0]}&destination=${to[1]},${to[0]}&key=${key}`;
  const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
  const data = await res.json();
  if (data.status !== 'OK') throw new Error(`Google returned ${data.status}`);
  const leg = data.routes[0].legs[0];
  return {
    distanceKm: Math.round(leg.distance.value / 100) / 10,
    durationMin: Math.round(leg.duration.value / 60),
    polyline: data.routes[0].overview_polyline.points,
    source: 'google',
  };
}

async function viaOsrm(from, to) {
  const url =
    `https://router.project-osrm.org/route/v1/driving/` +
    `${from[0]},${from[1]};${to[0]},${to[1]}?overview=full&geometries=polyline`;
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  const data = await res.json();
  if (data.code !== 'Ok') throw new Error(`OSRM returned ${data.code}`);
  const r = data.routes[0];
  return {
    distanceKm: Math.round(r.distance / 100) / 10,
    durationMin: Math.round(r.duration / 60),
    polyline: r.geometry,
    source: 'osrm',
  };
}

async function getRoute(from, to) {
  try {
    const g = await viaGoogle(from, to);
    if (g) return g;
  } catch (err) {
    console.warn('Google route failed, trying OSRM:', err.message);
  }

  return viaOsrm(from, to);
}

module.exports = { getRoute };