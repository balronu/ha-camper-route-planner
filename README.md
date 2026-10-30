# Camper Route Planner

![Camper Route Planner](assets/logo.svg)

Plane deine Wohnmobilreisen direkt in Home Assistant – mit deinem eigenen
Fahrzeugprofil, individuellen Zwischenzielen und Routen, die auf die
Abmessungen und das Gewicht deines Fahrzeugs abgestimmt werden können.

Camper Route Planner verbindet eine übersichtliche Lovelace-Karte mit der
Routing-Technologie von [NaKordoni](https://nakordoni.eu). So bleiben
Routenplanung, Fahrzeugdaten und Reiseunterlagen an einem Ort.

> **v0.1.5 Stable** ist veröffentlicht. Die Stable-Version wurde automatisiert
> und mit einer echten NaKordoni-v3-Routenberechnung erfolgreich überprüft.
> Die Integration ist ein Planungswerkzeug und ersetzt kein spezialisiertes
> Wohnmobil-Navigationsgerät.
>
> **v0.1.6-beta.6** ist als freiwillige Vorabversion verfügbar. Sie ergänzt
> verständliche NaKordoni-Fehler für nicht routbare Punkte und Zeitüberschreitungen
> sowie sichere Request-IDs in der Admin-Diagnose. Die POI-Unterstützung bleibt
> zunächst ein dokumentiertes Konzept.
> Für produktive Nutzung bleibt v0.1.5 die aktuelle Stable-Version.

[English version](README.en.md) · [Dokumentation](docs/) · [Releases](https://github.com/balronu/ha-camper-route-planner/releases)

![Desktop](assets/screenshots/desktop.png)
![Mobil](assets/screenshots/mobile.png)

## Für deine Reiseplanung

- **Wohnmobilgerechte Fahrzeugprofile:** Hinterlege Fahrzeugtyp, Länge,
  Breite, Höhe, Gewicht, Achszahl und optionale Kraftstoffdaten.
- **Flexible Routen:** Plane Start, Ziel und Zwischenziele und wähle passende
  Routenoptionen, Vermeidungen, Routentypen und optionale Abfahrts- oder
  Ankunftszeiten.
- **NaKordoni-Routing:** Nutze den sichtbaren NaKordoni-Provider mit deinen
  eigenen Zugangsdaten oder den Offline-Mock für Tests.
- **Karte und Reiseübersicht:** Sieh Route, Entfernung, Fahrzeit, Hinweise,
  Grenzübergänge und verfügbare Mautinformationen direkt in Home Assistant.
- **Gespeicherte Routen:** Speichere Planungen, lade sie später wieder und
  berechne sie mit den gespeicherten Eingaben neu. Wenn sich Eingaben ändern
  oder eine Neuberechnung fehlschlägt, wird ein vorhandenes Ergebnis als
  veraltet gekennzeichnet.
- **Reiseunterlagen:** Exportiere Route, Track oder beides als GPX und erzeuge
  einen PDF-Reiseplan. Eine Route kann außerdem an Apple Maps, Google Maps
  oder OpenStreetMap übergeben werden.
- **Kraftstoffplanung:** Berechne auf Basis deiner Fahrzeugdaten Reichweite,
  Verbrauch, Kosten und möglichen zusätzlichen Kraftstoffbedarf.
- **Smartphone und Tablet:** Die Lovelace-Karte ist für Desktop- und mobile
  Home-Assistant-Dashboards ausgelegt.

## Zusammenarbeit mit NaKordoni

Camper Route Planner nutzt die Routing-API von NaKordoni und berücksichtigt die
für die Routenanfrage hinterlegten Fahrzeugdaten. Technischer Austausch mit dem
NaKordoni-Team hat geholfen, die Wohnmobilunterstützung praxisnäher zu machen.
Das ist keine Aussage über eine formelle Partnerschaft oder Empfehlung durch
NaKordoni.

NaKordoni API v2 und v3 werden als getrennte Pfade behandelt. Mautdaten können
je nach Route und API-Version vollständig, geschätzt oder unvollständig sein;
die Oberfläche kennzeichnet diese Unterschiede. Persönliche API-Zugangsdaten
werden über den Home-Assistant-Config-/Options-Flow verwaltet und nicht an den
Browser, Screenshots, GPX-Dateien oder Logs weitergegeben.

## Bedienung und Datenschutz

Die Routenberechnung startet nur nach einer ausdrücklichen Benutzeraktion.
Optionale Abfahrts- und Ankunftszeiten werden nur übertragen, wenn sie gesetzt
sind. Die Entwicklerdiagnose ist standardmäßig ausgeblendet, nur für
Home-Assistant-Administratoren verfügbar und kann pro Karte aktiviert werden.
Eine Request-Diagnose gilt nur für einen einzelnen Backend-Versuch; der
bereinigte Bericht kann anschließend kopiert werden. Standortdaten,
Zwischenziele und Zugangsdaten sind sensible Informationen und sollten nur über
vertrauenswürdige Supportkanäle geteilt werden.

## Bekannte Einschränkungen

- Eine berechnete Route ist keine rechtliche Freigabe. Durchfahrtshöhen,
  Gewichtsgrenzen, Verkehrszeichen, Umweltzonen, Maut- und Fahrvorschriften
  müssen vor und während der Fahrt selbst geprüft werden.
- Externe Navigations-Apps können die Route neu berechnen oder Fahrzeugdaten
  und Zwischenziele nur teilweise übernehmen. Für komplexe Wohnmobilrouten ist
  GPX der zuverlässigere Übergabeweg.
- Maut-, Grenz- und Verkehrsdaten hängen von der Providerantwort ab. Fehlende
  oder geschätzte Werte werden nicht als verbindliche Angaben dargestellt.
- Der NaKordoni-Wohnmobilpfad kann beim Anbieter weiterhin als Beta-Profil
  geführt werden. Es gibt keinen stillen Wechsel auf Truck-Routing und keinen
  automatischen Mock-Fallback bei Providerfehlern.
- Die Kraftstoffplanung ist eine lokale Rechenhilfe. Tankstopps werden nicht
  automatisch gebucht oder als verbindliche Reiseanweisung ausgegeben.

## Installation

Bis zur Aufnahme in den offiziellen HACS-Katalog installierst du Camper Route
Planner als **Custom Repository**:

1. In HACS **Integrationen → ⋮ → Benutzerdefinierte Repositories** öffnen.
2. `balronu/ha-camper-route-planner` als Repository vom Typ **Integration**
   hinzufügen.
3. Für produktive Nutzung die reguläre Stable-Version `v0.1.5` installieren.
   `v0.1.6-beta.6` ist nur über die Vorabversionen bzw. das Release-ZIP für
   Tests vorgesehen. Home Assistant bei Aufforderung neu starten.
4. Unter **Einstellungen → Geräte & Dienste** die Integration einrichten und
   anschließend die Lovelace-Karte in dein Dashboard aufnehmen.

Alternativ kann das Release-ZIP manuell nach
`custom_components/camper_route_planner/` entpackt werden. Die vollständige
[HACS-/Installationsanleitung](docs/HACS-INSTALLATION.md), Konfiguration und
Rollback-Hinweise bleiben in der technischen Dokumentation erhalten. Der
offizielle HACS-Katalogstatus ist in der [HACS-Dokumentation](docs/HACS-INSTALLATION.md)
nachgeführt; eine Katalogaufnahme wird nicht vorausgesetzt.

## Weiterführende Dokumentation

- [Fahrzeugprofile](docs/VEHICLE-PROFILES.md)
- [Lovelace-Karte](docs/LOVELACE-CARD.md)
- [GPX- und PDF-Export](docs/GPX-EXPORT.md)
- [NaKordoni API und Mautdaten](docs/NAKORDONI-API-AUDIT.md)
- [Sicherheit und Datenschutz](docs/SECURITY-AND-PRIVACY.md)
- [Technische Architektur](docs/ARCHITECTURE.md)
- [v0.1.5 Release Notes](docs/releases/v0.1.5.md)
- [v0.1.6-beta.1 Release Notes](docs/releases/v0.1.6-beta.1.md)
- [v0.1.6-beta.2 Release Notes](docs/releases/v0.1.6-beta.2.md)
- [v0.1.6-beta.3 Release Notes](docs/releases/v0.1.6-beta.3.md)
- [v0.1.6-beta.4 Release Notes](docs/releases/v0.1.6-beta.4.md)
- [v0.1.6-beta.5 Release Notes](docs/releases/v0.1.6-beta.5.md)
- [v0.1.6-beta.6 Release Notes](docs/releases/v0.1.6-beta.6.md)
- [NaKordoni-POI-Konzept](docs/NAKORDONI-POI-CONCEPT.md)

## Lizenz

MIT. Siehe [LICENSE](LICENSE).
