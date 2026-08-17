# Rechtliche Entwürfe für Klarblick

**Wichtiger Hinweis vorab:** Dies sind Arbeitsentwürfe, keine Rechtsberatung. Bevor die
Seite live geht, sollten ein Anwalt oder ein Tool wie eRecht24 / Trusted Shops einmal
kurz gegenlesen — insbesondere wegen der Verarbeitung personenbezogener
Bewertungsdaten (Namen von Bewertern) ist das kein "nice to have", sondern Pflicht.
Alle `[PLATZHALTER]` müssen vor Veröffentlichung ersetzt werden.

---

## 1. Impressum (§ 5 TMG / § 18 MStV)

```
Angaben gemäß § 5 TMG

[Vollständiger Name / Firmenname]
[Straße Hausnummer]
[PLZ Ort]

Vertreten durch: [Name Geschäftsführer/in bzw. Inhaber/in]

Kontakt:
Telefon: [Telefonnummer]
E-Mail: [E-Mail-Adresse]

Registereintrag: (falls GmbH/UG)
Eintragung im Handelsregister
Registergericht: [Amtsgericht]
Registernummer: [HRB-Nummer]

Umsatzsteuer-ID: (falls vorhanden)
Umsatzsteuer-Identifikationsnummer gemäß §27a Umsatzsteuergesetz: [DE...]

Redaktionell verantwortlich: [Name]

EU-Streitschlichtung:
Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS)
bereit: https://ec.europa.eu/consumers/odr/
Unsere E-Mail-Adresse finden Sie oben im Impressum.

Verbraucherstreitbeilegung:
Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer
Verbraucherschlichtungsstelle teilzunehmen.
```

*Hinweis: Solange du als Kleingewerbe/Einzelunternehmen startest, fällt die
Handelsregister-Zeile weg. Umsatzsteuer-ID nur eintragen, wenn du sie hast — sonst
lieber "Gemäß § 19 UStG wird keine Umsatzsteuer berechnet (Kleinunternehmerregelung)"
angeben, falls zutreffend.*

---

## 2. Datenschutzerklärung (Entwurf, DSGVO)

```
Datenschutzerklärung

1. Verantwortlicher
[Firmenname], [Adresse], [E-Mail] ist verantwortlich für die Datenverarbeitung auf
dieser Website und innerhalb der Klarblick-Anwendung im Sinne der DSGVO.

2. Welche Daten wir verarbeiten

a) Website-Besuch
Beim Aufruf dieser Website werden automatisch technische Informationen erfasst
(IP-Adresse, Browsertyp, Zugriffszeit). [Falls Analytics-Tool genutzt wird: Details
und Einwilligungsmechanismus hier ergänzen, z. B. Cookie-Banner mit Consent-Tool.]

b) Beta-Anmeldung / Kontaktformular
Wenn du dich für die Beta anmeldest, verarbeiten wir deine E-Mail-Adresse, um dich
zu kontaktieren. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO (vorvertragliche
Maßnahme) bzw. lit. a (Einwilligung).

c) Nutzung der Klarblick-Anwendung (nach Vertragsschluss)
Wenn du Klarblick nutzt, verarbeiten wir in deinem Auftrag (Auftragsverarbeitung,
Art. 28 DSGVO):
- Bewertungsdaten deines Google-Unternehmensprofils (Bewertungstext, Sternebewertung,
  Datum, öffentlich sichtbarer Name des Bewerters)
- Von dir eingegebene Firmendaten (Branche, Standort)

Wichtig: Bewertungstexte können personenbezogene Daten Dritter (der Bewerter)
enthalten. Diese Daten sind bereits öffentlich auf Google einsehbar; wir verarbeiten
sie ausschließlich zum Zweck der Musteranalyse zur Betrugserkennung
(Art. 6 Abs. 1 lit. f DSGVO — berechtigtes Interesse an der Aufdeckung von
Bewertungsmanipulation).

3. Weitergabe an Dritte / Auftragsverarbeiter
[Liste aller genutzten Tools ergänzen, typischerweise:]
- Hosting-Anbieter: [z. B. Vercel/Netlify/Hetzner] — AVV erforderlich
- E-Mail-Marketing-Tool: [z. B. Mailchimp/ConvertKit] — AVV erforderlich, bei
  US-Anbietern zusätzlich Standardvertragsklauseln prüfen
- Zahlungsdienstleister: [z. B. Stripe] — eigene Datenschutzerklärung des Anbieters
  verlinken
- KI-Anbieter für den Sichtbarkeits-Check: Anthropic (Claude) — AVV mit Anthropic
  abschließen, sobald produktiv genutzt

4. Speicherdauer
Bewertungsdaten werden für die Dauer der Vertragslaufzeit gespeichert und [X Tage]
nach Kündigung gelöscht, sofern keine gesetzliche Aufbewahrungspflicht entgegensteht.

5. Deine Rechte
Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und
Widerspruch (Art. 21) sowie das Recht auf Beschwerde bei einer Aufsichtsbehörde.

6. Kontakt Datenschutz
[E-Mail-Adresse für Datenschutzanfragen]
```

---

## 3. AGB-Entwurf (B2B-SaaS)

```
Allgemeine Geschäftsbedingungen — Klarblick

§ 1 Geltungsbereich
Diese AGB gelten für alle Verträge zwischen [Firmenname] ("Anbieter") und
Unternehmern (§ 14 BGB) über die Nutzung der Software-as-a-Service-Lösung
"Klarblick".

§ 2 Vertragsgegenstand
Der Anbieter stellt dem Kunden eine webbasierte Anwendung zur Analyse von
Online-Bewertungsmustern und zur Prüfung der KI-Sichtbarkeit zur Verfügung. Der
Anbieter garantiert keine Entfernung von Bewertungen durch Dritte (insbesondere
Google) und keine Garantie für eine bestimmte KI-Sichtbarkeit.

§ 3 Laufzeit und Kündigung
Der Vertrag hat eine monatliche Laufzeit und verlängert sich automatisch um jeweils
einen weiteren Monat, sofern er nicht mit einer Frist von [X Tagen] zum Laufzeitende
gekündigt wird.

§ 4 Preise und Zahlung
Es gelten die zum Zeitpunkt des Vertragsschlusses auf der Website ausgewiesenen
Preise zzgl. gesetzlicher Umsatzsteuer. Die Abrechnung erfolgt monatlich im Voraus
über [Zahlungsdienstleister].

§ 5 Verfügbarkeit
Der Anbieter bemüht sich um eine Verfügbarkeit von [X %] im Jahresmittel, garantiert
diese jedoch nicht als zugesicherte Eigenschaft, insbesondere bei Ausfällen von
Drittanbietern (Google API, KI-Anbieter).

§ 6 Haftung
Der Anbieter haftet unbeschränkt bei Vorsatz und grober Fahrlässigkeit sowie nach
dem Produkthaftungsgesetz. Bei leichter Fahrlässigkeit haftet der Anbieter nur bei
Verletzung wesentlicher Vertragspflichten und begrenzt auf den vertragstypisch
vorhersehbaren Schaden. Der Anbieter übernimmt keine Haftung für die Richtigkeit der
Risikoeinschätzungen der Sabotage-Erkennung — diese sind eine Entscheidungshilfe,
kein Rechtsgutachten.

§ 7 Datenschutz
Es gilt die separate Datenschutzerklärung sowie ein Auftragsverarbeitungsvertrag
(AVV) gemäß Art. 28 DSGVO, der Bestandteil dieses Vertrags wird.

§ 8 Schlussbestimmungen
Es gilt deutsches Recht. Gerichtsstand ist, soweit gesetzlich zulässig, [Sitz des
Anbieters].
```

---

## Nächste Schritte für dich

1. Diese drei Dokumente von einem Anwalt oder über eRecht24 (ca. 10-15€/Monat für
   AGB- und Datenschutz-Generator mit Update-Service) prüfen lassen
2. AVV-Vorlagen bei den Anbietern anfragen, die du tatsächlich nutzt (Hosting,
   E-Mail-Tool, Stripe) — die meisten bieten fertige AVVs zum Download
3. Cookie-Consent-Tool einbauen, sobald du Analytics oder Marketing-Pixel nutzt
   (z. B. Usercentrics, Cookiebot — beide haben kostenlose Einstiegspläne)
