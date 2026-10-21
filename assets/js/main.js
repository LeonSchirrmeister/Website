/* Leon Schirrmeister Modellbahnen – lädt die Inhalte (content/*.json) und die eBay-Artikel. */
(function () {
  'use strict';

  var DATEIEN = ['allgemein', 'oeffnungszeiten', 'hinweis', 'startseite', 'shop'];
  var PRO_SEITE = 24;
  var WOCHENTAGE = ['Sonntag', 'Montag', 'Dienstag', 'Mittwoch', 'Donnerstag', 'Freitag', 'Samstag'];

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function el(tag, attrs, kinder) {
    var e = document.createElement(tag);
    Object.keys(attrs || {}).forEach(function (k) {
      if (k === 'text') e.textContent = attrs[k];
      else if (k === 'class') e.className = attrs[k];
      else e.setAttribute(k, attrs[k]);
    });
    (kinder || []).forEach(function (c) { if (c) e.appendChild(c); });
    return e;
  }
  function holeJson(url) {
    return fetch(url, { cache: 'no-cache' }).then(function (r) {
      if (!r.ok) throw new Error(url + ' ' + r.status);
      return r.json();
    });
  }

  /* ---------- Inhalte aus content/*.json ---------- */

  function ladeInhalte() {
    return Promise.all(DATEIEN.map(function (d) {
      return holeJson('/content/' + d + '.json').catch(function () { return null; });
    })).then(function (liste) {
      var inhalt = {};
      DATEIEN.forEach(function (d, i) { inhalt[d] = liste[i] || {}; });
      return inhalt;
    });
  }

  function wert(inhalt, pfad) {
    return pfad.split('.').reduce(function (o, k) { return o == null ? undefined : o[k]; }, inhalt);
  }

  function telLink(nummer) { return 'tel:' + String(nummer || '').replace(/[^\d+]/g, ''); }

  function fuelleInhalte(inhalt) {
    $$('[data-inhalt]').forEach(function (e) {
      var v = wert(inhalt, e.getAttribute('data-inhalt'));
      if (typeof v === 'string' && v.trim() !== '') e.textContent = v;
      else if (typeof v === 'string' && e.tagName === 'P') e.hidden = true;
    });

    var a = inhalt.allgemein || {};
    if (a.telefon) $$('[data-telefon]').forEach(function (e) { e.textContent = a.telefon; e.href = telLink(a.telefon); });
    if (a.email) $$('[data-email]').forEach(function (e) { e.textContent = a.email; e.href = 'mailto:' + a.email; });
    if (a.ebay_shop_link) $$('[data-ebay-shop]').forEach(function (e) { e.href = a.ebay_shop_link; });

    var route = $('[data-route]');
    if (route && a.strasse) {
      route.href = 'https://www.google.com/maps/dir/?api=1&destination=' +
        encodeURIComponent([a.name, a.strasse, a.plz, a.ort].filter(Boolean).join(', '));
    }

    var karte = $('[data-anfahrt-bild]');
    if (karte && a.anfahrt_bild) {
      karte.textContent = '';
      karte.appendChild(el('img', { src: a.anfahrt_bild, alt: 'Lageplan: So finden Sie den Laden', loading: 'lazy' }));
    }

    var h = inhalt.hinweis || {};
    var banner = $('[data-hinweis]');
    if (banner && h.aktiv && h.text) { banner.textContent = h.text; banner.hidden = false; }

    var tafel = $('[data-oeffnungszeiten]');
    var z = inhalt.oeffnungszeiten || {};
    if (tafel && Array.isArray(z.tage) && z.tage.length) {
      tafel.textContent = '';
      var heute = WOCHENTAGE[new Date().getDay()];
      z.tage.forEach(function (t) {
        var zeile = el('div', { class: 'tafel-zeile' + (t.tag === heute ? ' heute' : '') }, [
          el('dt', { text: t.tag || '' }),
          el('dd', { text: t.zeit || '' })
        ]);
        tafel.appendChild(zeile);
      });
    }
  }

  /* ---------- eBay-Artikel ---------- */

  function preisText(a) {
    if (a.preis == null) return '';
    try {
      return new Intl.NumberFormat('de-DE', { style: 'currency', currency: a.waehrung || 'EUR' }).format(a.preis);
    } catch (e) { return a.preis + ' ' + (a.waehrung || '€'); }
  }

  function artikelKarte(a) {
    var bild = el('div', { class: 'artikel-bild' });
    if (a.bild) bild.appendChild(el('img', { src: a.bild, alt: '', loading: 'lazy', referrerpolicy: 'no-referrer' }));
    else bild.textContent = 'Kein Bild';
    var meta = [a.kategorie === 'Sonstiges' ? a.unterkategorie : a.kategorie, a.zustand].filter(Boolean).join(' · ');
    return el('li', { class: 'artikel' }, [
      bild,
      el('div', { class: 'artikel-body' }, [
        meta ? el('span', { class: 'artikel-meta', text: meta }) : null,
        el('h3', { class: 'artikel-titel', text: a.titel || '' }),
        el('div', { class: 'artikel-fuss' }, [
          el('span', { class: 'artikel-preis', text: preisText(a) }),
          el('span', { class: 'artikel-art', text: a.kaufart || '' })
        ]),
        el('a', { class: 'btn btn-navy-rand', href: a.link, target: '_blank', rel: 'noopener', text: 'Bei eBay ansehen', 'aria-label': 'Bei eBay ansehen: ' + (a.titel || '') })
      ])
    ]);
  }

  function skelett(liste, anzahl) {
    liste.textContent = '';
    for (var i = 0; i < anzahl; i++) {
      liste.appendChild(el('li', { class: 'artikel artikel-skelett', 'aria-hidden': 'true' }, [
        el('div', { class: 'artikel-bild' }),
        el('div', { class: 'artikel-body' }, [el('span', { class: 'artikel-meta', text: ' ' })])
      ]));
    }
  }

  function meldung(liste, text, ebayLink) {
    liste.textContent = '';
    var li = el('li', { class: 'meldung' }, [el('p', { text: text })]);
    if (ebayLink) li.appendChild(el('a', { class: 'btn btn-navy', href: ebayLink, target: '_blank', rel: 'noopener', text: 'Direkt zum eBay-Shop' }));
    liste.appendChild(li);
  }

  function ladeArtikel() {
    return holeJson('/api/artikel');
  }

  function startseiteTeaser(inhalt) {
    var liste = $('[data-artikel-teaser]');
    if (!liste) return;
    skelett(liste, 4);
    ladeArtikel().then(function (daten) {
      var artikel = (daten && daten.artikel) || [];
      if (!artikel.length) { meldung(liste, 'Gerade sind keine Artikel online. Schauen Sie bald wieder vorbei.', inhalt.allgemein.ebay_shop_link); return; }
      liste.textContent = '';
      artikel.slice(0, 4).forEach(function (a) { liste.appendChild(artikelKarte(a)); });
    }).catch(function () {
      meldung(liste, 'Die Artikel können gerade nicht geladen werden.', inhalt.allgemein.ebay_shop_link);
    });
  }

  function shopSeite(inhalt) {
    var liste = $('[data-artikel-liste]');
    if (!liste) return;
    var mehrBtn = $('[data-mehr]');
    var suchfeld = $('[data-suche]');
    var katBox = $('[data-kategorien]');
    var anzahlEl = $('[data-anzahl]');
    var alle = [];
    var gewaehlt = 'Alle';
    var sichtbar = PRO_SEITE;

    skelett(liste, 8);

    function gefiltert() {
      var q = (suchfeld.value || '').trim().toLowerCase();
      return alle.filter(function (a) {
        if (gewaehlt !== 'Alle' && a.kategorie !== gewaehlt) return false;
        if (q && (a.titel || '').toLowerCase().indexOf(q) === -1) return false;
        return true;
      });
    }

    function zeichne() {
      var treffer = gefiltert();
      liste.textContent = '';
      if (!treffer.length) {
        meldung(liste, alle.length ? 'Keine passenden Artikel gefunden.' : 'Gerade sind keine Artikel online.', null);
      } else {
        treffer.slice(0, sichtbar).forEach(function (a) { liste.appendChild(artikelKarte(a)); });
      }
      mehrBtn.hidden = treffer.length <= sichtbar;
    }

    function zeichneKategorien() {
      var namen = [];
      alle.forEach(function (a) { if (a.kategorie && namen.indexOf(a.kategorie) === -1) namen.push(a.kategorie); });
      namen.sort(function (x, y) { return x.localeCompare(y, 'de'); });
      katBox.textContent = '';
      if (namen.length < 2) return;
      ['Alle'].concat(namen).forEach(function (n) {
        var b = el('button', { type: 'button', class: 'pille', 'aria-pressed': String(n === gewaehlt), text: n });
        b.addEventListener('click', function () {
          gewaehlt = n; sichtbar = PRO_SEITE;
          $$('.pille', katBox).forEach(function (p) { p.setAttribute('aria-pressed', String(p.textContent === n)); });
          zeichne();
        });
        katBox.appendChild(b);
      });
    }

    var timer;
    suchfeld.addEventListener('input', function () {
      clearTimeout(timer);
      timer = setTimeout(function () { sichtbar = PRO_SEITE; zeichne(); }, 200);
    });
    mehrBtn.addEventListener('click', function () { sichtbar += PRO_SEITE; zeichne(); });

    ladeArtikel().then(function (daten) {
      alle = (daten && daten.artikel) || [];
      anzahlEl.textContent = String(alle.length);
      zeichneKategorien();
      zeichne();
    }).catch(function () {
      anzahlEl.textContent = '–';
      meldung(liste, 'Die Artikel können gerade nicht geladen werden. Alle Angebote finden Sie direkt bei eBay.', inhalt.allgemein.ebay_shop_link);
    });
  }

  /* ---------- Start ---------- */

  ladeInhalte().then(function (inhalt) {
    fuelleInhalte(inhalt);
    var seite = document.body.getAttribute('data-seite');
    if (seite === 'start') startseiteTeaser(inhalt);
    if (seite === 'shop') shopSeite(inhalt);
  });
})();
