// Holt Leons aktive eBay-Angebote über die eBay Browse API und gibt sie als einfache Liste zurück.
// Erreichbar unter /api/artikel. Netlify speichert die Antwort eine Stunde zwischen,
// eBay wird also höchstens etwa einmal pro Stunde gefragt.
//
// Benötigte Umgebungsvariablen (in Netlify unter Site configuration › Environment variables):
//   EBAY_CLIENT_ID      App ID (Client ID) aus dem eBay-Entwicklerkonto, Production
//   EBAY_CLIENT_SECRET  Cert ID (Client Secret), Production – geheim halten
//   EBAY_SELLER         eBay-Verkäufername von Leon
//   EBAY_CATEGORY_IDS   eBay-Kategorie-IDs, in denen Leon verkauft, mit Komma getrennt
//                       (die Browse API verlangt eine Kategorie oder ein Suchwort)
// Optional:
//   EBAY_MARKETPLACE    Standard: EBAY_DE
//   EBAY_MAX            Höchstzahl Artikel, Standard: 1000
//
// Fehlen die Zugangsdaten, liefert die Funktion Beispielartikel (Demo-Modus).

const TOKEN_URL = 'https://api.ebay.com/identity/v1/oauth2/token';
const SEARCH_URL = 'https://api.ebay.com/buy/browse/v1/item_summary/search';
const SCOPE = 'https://api.ebay.com/oauth/api_scope';

let tokenCache = { wert: null, bis: 0 };

async function holeToken(id, secret) {
  if (tokenCache.wert && Date.now() < tokenCache.bis) return tokenCache.wert;
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      Authorization: 'Basic ' + Buffer.from(`${id}:${secret}`).toString('base64'),
    },
    body: new URLSearchParams({ grant_type: 'client_credentials', scope: SCOPE }),
  });
  if (!res.ok) throw new Error(`eBay-Token fehlgeschlagen (${res.status})`);
  const daten = await res.json();
  tokenCache = { wert: daten.access_token, bis: Date.now() + (daten.expires_in - 120) * 1000 };
  return tokenCache.wert;
}

const KAUFART = { FIXED_PRICE: 'Sofort-Kaufen', AUCTION: 'Auktion', BEST_OFFER: 'Preisvorschlag' };

function vereinfache(item) {
  const preis = item.price || item.currentBidPrice || {};
  const bild = item.image?.imageUrl || item.thumbnailImages?.[0]?.imageUrl || item.additionalImages?.[0]?.imageUrl || null;
  return {
    id: item.itemId,
    titel: item.title,
    preis: preis.value != null ? Number(preis.value) : null,
    waehrung: preis.currency || 'EUR',
    bild: bild ? bild.replace(/s-l\d+\./, 's-l500.') : null,
    link: item.itemAffiliateWebUrl || item.itemWebUrl,
    zustand: item.condition || '',
    kategorie: item.categories?.[0]?.categoryName || '',
    kaufart: (item.buyingOptions || []).map((b) => KAUFART[b]).filter(Boolean)[0] || '',
    eingestellt: item.itemCreationDate || null,
  };
}

async function holeArtikel(env) {
  const token = await holeToken(env.EBAY_CLIENT_ID, env.EBAY_CLIENT_SECRET);
  const max = Number(env.EBAY_MAX || 1000);
  const markt = env.EBAY_MARKETPLACE || 'EBAY_DE';
  const ergebnis = [];
  const gesehen = new Set();
  let offset = 0;

  while (ergebnis.length < max) {
    const url = new URL(SEARCH_URL);
    url.searchParams.set('category_ids', env.EBAY_CATEGORY_IDS);
    url.searchParams.set('filter', `sellers:{${env.EBAY_SELLER}}`);
    url.searchParams.set('sort', 'newlyListed');
    url.searchParams.set('limit', '200');
    url.searchParams.set('offset', String(offset));

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}`, 'X-EBAY-C-MARKETPLACE-ID': markt, 'Accept-Language': 'de-DE' },
    });
    if (!res.ok) throw new Error(`eBay-Suche fehlgeschlagen (${res.status}): ${await res.text()}`);
    const daten = await res.json();
    const items = daten.itemSummaries || [];
    for (const item of items) {
      if (gesehen.has(item.itemId)) continue;
      gesehen.add(item.itemId);
      ergebnis.push(vereinfache(item));
    }
    offset += items.length;
    if (!items.length || offset >= (daten.total || 0) || offset >= 9800) break;
  }
  return ergebnis.slice(0, max);
}

// Beispielartikel für den Demo-Modus, solange die eBay-Zugangsdaten fehlen.
export function demoArtikel() {
  const vorlagen = [
    ['Dampflok BR 01 mit Tender, Spur H0, digital', 'Spur H0', 'Gebraucht', 249],
    ['Personenwagen-Set 3-teilig, Epoche III, H0', 'Spur H0', 'Neu', 89.9],
    ['Diesellok V 200 in Originalverpackung, Spur N', 'Spur N', 'Gebraucht', 119],
    ['Gleisset gebogen R2, 12 Stück', 'Gleise', 'Neu', 24.5],
    ['Bausatz Bahnhofsgebäude mit Beleuchtung, H0', 'Zubehör', 'Neu', 54],
    ['Güterwagen-Konvolut, 8 Wagen, Spur H0', 'Spur H0', 'Gebraucht', 65],
    ['E-Lok BR 103 Intercity, Spur TT', 'Spur TT', 'Gebraucht', 139],
    ['Fahrpult / Transformator, geprüft', 'Zubehör', 'Gebraucht', 29],
    ['Weichenset links/rechts, elektrisch, N', 'Gleise', 'Neu', 42],
    ['Figuren-Set Bahnpersonal, 12 Stück, H0', 'Zubehör', 'Neu', 14.95],
    ['Schienenbus VT 98 mit Beiwagen, H0', 'Spur H0', 'Gebraucht', 99],
    ['Containertragwagen 2er-Set, Spur N', 'Spur N', 'Neu', 37.5],
  ];
  return vorlagen.map(([titel, kategorie, zustand, preis], i) => ({
    id: `demo-${i + 1}`,
    titel: `[Beispiel] ${titel}`,
    preis,
    waehrung: 'EUR',
    bild: null,
    link: 'https://www.ebay.de',
    zustand,
    kategorie,
    kaufart: i % 4 === 3 ? 'Auktion' : 'Sofort-Kaufen',
    eingestellt: null,
  }));
}

function antwort(daten, sekunden) {
  return new Response(JSON.stringify(daten), {
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300',
      'Netlify-CDN-Cache-Control': `public, s-maxage=${sekunden}, stale-while-revalidate=86400`,
    },
  });
}

export default async function handler() {
  const env = process.env;
  const fehlt = ['EBAY_CLIENT_ID', 'EBAY_CLIENT_SECRET', 'EBAY_SELLER', 'EBAY_CATEGORY_IDS'].filter((k) => !env[k]);

  if (fehlt.length) {
    return antwort({ modus: 'demo', hinweis: `Demo-Modus, es fehlen: ${fehlt.join(', ')}`, aktualisiert: new Date().toISOString(), artikel: demoArtikel() }, 300);
  }

  try {
    const artikel = await holeArtikel(env);
    return antwort({ modus: 'live', aktualisiert: new Date().toISOString(), artikel }, 3600);
  } catch (err) {
    console.error(err);
    return new Response(JSON.stringify({ modus: 'fehler', artikel: [] }), {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
    });
  }
}

export const config = { path: '/api/artikel' };
