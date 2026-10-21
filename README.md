# Website Leon Schirrmeister Modellbahnen

Statische Website (HTML/CSS/JS) mit Bearbeitungsoberfläche (Decap CMS), gehostet bei Netlify.
Gleiches Prinzip wie die Website des Schützenvereins Oster, Login aber über GitHub.

## Aufbau

| Ordner / Datei | Inhalt |
|---|---|
| `index.html` | Startseite: Hero, Kontakt auf einen Blick, Öffnungszeiten, Anfahrt, neue Artikel, Kontaktformular |
| `shop.html` | Alle eBay-Artikel mit Kategorien, Suche, „Weitere laden“ |
| `impressum.html`, `datenschutz.html` | Rechtstexte (ENTWURF, vor Livegang prüfen) |
| `danke.html`, `404.html` | Danke-Seite nach dem Formular, Fehlerseite |
| `content/*.json` | Alle Texte und Daten, die Leon im CMS ändert |
| `admin/` | Bearbeitungsoberfläche unter `/admin` |
| `netlify/functions/artikel.mjs` | Holt die eBay-Artikel, erreichbar unter `/api/artikel` |
| `assets/` | CSS, JavaScript, Schriften (lokal, kein Google Fonts), Logo, hochgeladene Bilder |

Ohne eBay-Zugangsdaten zeigt die Seite **Beispielartikel** (Demo-Modus).

## Einrichtung (einmalig)

1. **GitHub:** Leon hat das private Repository `LeonSchirrmeister/Website` angelegt und lädt Marvin als Collaborator ein. Marvin lädt diesen Ordner hoch (Branch `main`).
2. **Netlify:** Mit GitHub anmelden → *Add new site → Import an existing project* → Repository wählen. Build-Befehl leer lassen, Publish directory `.`.
3. **CMS-Login über GitHub:**
   - In `admin/config.yml` bei `repo:` Leons GitHub-Namen eintragen, `site_url` / `display_url` auf die Domain setzen.
   - GitHub → Settings → Developer settings → OAuth Apps → *New OAuth App*: Homepage = Website-Adresse, Callback URL = `https://api.netlify.com/auth/done`.
   - Client ID und Secret in Netlify unter *Site configuration → Access & security → OAuth → Install provider → GitHub* eintragen.
4. **Kontaktformular:** Netlify erkennt das Formular `kontakt` automatisch. Unter *Forms → Form notifications → Email notification* Leons Strato-Adresse eintragen.
5. **eBay:** In Netlify unter *Site configuration → Environment variables* eintragen:
   - `EBAY_CLIENT_ID` (App ID, Production)
   - `EBAY_CLIENT_SECRET` (Cert ID, Production, geheim)
   - `EBAY_SELLER` (Leons eBay-Verkäufername)
   - `EBAY_CATEGORY_IDS` (Kategorie-IDs, in denen Leon verkauft, kommagetrennt)
   - optional `EBAY_MARKETPLACE` (Standard `EBAY_DE`)
   Danach neu deployen. Unter `/api/artikel` steht dann `"modus": "live"`.
6. **Domain:** In Netlify die Domain hinzufügen, bei Strato die DNS-Einträge auf Netlify zeigen lassen (wie beim Schützenverein). E-Mail-Einträge (MX) bei Strato nicht anfassen.
7. **Vor dem Livegang:** Platzhalter in eckigen Klammern ersetzen (geht alles im CMS), Impressum und Datenschutz prüfen, Formular testen.

## Für Leon: Inhalte ändern

`https://DEINE-DOMAIN.de/admin` → „Mit GitHub anmelden“ → Bereich wählen (Öffnungszeiten, Hinweisbanner, Kontakt & Adresse, Texte) → ändern → **Veröffentlichen**. Nach ca. einer Minute ist die Änderung online. Den Shop muss niemand pflegen, der kommt automatisch aus eBay.

## Lokal ansehen

```
node dev-server.mjs
```
Dann http://localhost:8080 öffnen (zeigt Beispielartikel).
