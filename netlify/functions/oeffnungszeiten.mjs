// Holt Leons Öffnungszeiten aus seinem Google-Unternehmensprofil (Google Places API, neu).
// Erreichbar unter /api/oeffnungszeiten. Netlify speichert die Antwort 6 Stunden zwischen,
// Google wird also nur wenige Male am Tag gefragt.
//
// Umgebungsvariablen in Netlify:
//   GOOGLE_PLACES_API_KEY  API-Schlüssel aus der Google Cloud Console (nur für "Places API (New)" freigeben)
//   GOOGLE_PLACE_ID        optional: die Place ID des Ladens. Fehlt sie, sucht die Funktion den Laden
//                          einmal über GOOGLE_PLACE_SUCHE (Standard siehe unten).
//
// Fehlt der Schlüssel oder antwortet Google nicht, liefert die Funktion { quelle: "keine" }
// und die Website zeigt die Zeiten aus der Bearbeitungsoberfläche.

const SUCHE_STANDARD = 'Leon Schirrmeister Modellbahn An- und Verkauf, Bült 19, 48143 Münster';
const TAGE = ['Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag', 'Sonntag'];

let placeIdCache = null;

async function findePlaceId(key, suche) {
  if (placeIdCache) return placeIdCache;
  const res = await fetch('https://places.googleapis.com/v1/places:searchText', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'places.id' },
    body: JSON.stringify({ textQuery: suche, languageCode: 'de', regionCode: 'DE' }),
  });
  if (!res.ok) throw new Error(`Google-Suche fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 300)}`);
  const daten = await res.json();
  const id = daten.places?.[0]?.id;
  if (!id) throw new Error('Laden bei Google nicht gefunden');
  placeIdCache = id;
  return id;
}

// "Dienstag: 11:00–13:00, 15:00–18:00" → { tag: "Dienstag", zeit: "11:00 – 13:00, 15:00 – 18:00" }
function zerlege(zeile) {
  const i = zeile.indexOf(':');
  const tag = zeile.slice(0, i).trim();
  let zeit = zeile.slice(i + 1).trim()
    .replace(/ | | /g, ' ')
    .replace(/\s*[–-]\s*/g, ' – ');
  if (/^geschlossen$/i.test(zeit)) zeit = 'geschlossen';
  if (/^24 Stunden geöffnet$/i.test(zeit)) zeit = 'durchgehend geöffnet';
  return { tag, zeit };
}

function nachWochentag(liste) {
  const map = Object.fromEntries(liste.map((t) => [t.tag, t]));
  return TAGE.map((tag) => map[tag]).filter(Boolean);
}

function antwort(daten, sekunden, status = 200) {
  return new Response(JSON.stringify(daten), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=600',
      'Netlify-CDN-Cache-Control': `public, durable, s-maxage=${sekunden}, stale-while-revalidate=86400`,
    },
  });
}

export default async function handler() {
  const key = (process.env.GOOGLE_PLACES_API_KEY || '').trim();
  if (!key) return antwort({ quelle: 'keine', hinweis: 'GOOGLE_PLACES_API_KEY fehlt' }, 600);

  try {
    const placeId = (process.env.GOOGLE_PLACE_ID || '').trim()
      || await findePlaceId(key, (process.env.GOOGLE_PLACE_SUCHE || SUCHE_STANDARD).trim());

    const res = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(placeId)}?languageCode=de&regionCode=DE`, {
      headers: { 'X-Goog-Api-Key': key, 'X-Goog-FieldMask': 'regularOpeningHours.weekdayDescriptions,currentOpeningHours.weekdayDescriptions' },
    });
    if (!res.ok) throw new Error(`Google-Abruf fehlgeschlagen (${res.status}): ${(await res.text()).slice(0, 300)}`);
    const ort = await res.json();

    const regulaer = nachWochentag((ort.regularOpeningHours?.weekdayDescriptions || []).map(zerlege));
    if (regulaer.length !== 7) throw new Error('Google liefert keine vollständigen Öffnungszeiten');

    // Abweichungen in den nächsten 7 Tagen (z. B. Feiertage), die Leon bei Google eingetragen hat
    const aktuell = nachWochentag((ort.currentOpeningHours?.weekdayDescriptions || []).map(zerlege));
    const abweichungen = aktuell.filter((t) => {
      const normal = regulaer.find((r) => r.tag === t.tag);
      return normal && normal.zeit !== t.zeit;
    });

    return antwort({ quelle: 'google', placeId, aktualisiert: new Date().toISOString(), tage: regulaer, abweichungen }, 21600);
  } catch (err) {
    console.error(err);
    return antwort({ quelle: 'keine', fehler: String(err.message || err).slice(0, 400) }, 300, 502);
  }
}

export const config = { path: '/api/oeffnungszeiten' };
