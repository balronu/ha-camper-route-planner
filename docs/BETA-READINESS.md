# Beta-Readiness – Planungsstand vor `v0.1.0 Stable`

## Status

**Noch nicht freigegeben.** Die lokale Phase-2E-Implementierung ist für eine
technische nächste Prüfung geeignet, aber noch keine veröffentlichte Beta.
`v0.1.0 Stable` ist als erste geplante Veröffentlichung vorgemerkt. Phase 2F
ist bislang nur als Dokumentationsplanung vorhanden. Der Plan für Phase 2F–2I steht in
`docs/PHASE2F-2I-PLAN.md`.

Vor einer Beta müssen mindestens folgende Punkte nachgewiesen werden:

1. vollständige Home-Assistant-Validierung inklusive Hassfest;
2. reproduzierbare Lovelace-Resource-Registrierung in einer realen HA-Instanz;
3. reale Android-/iOS-Tests für GPX-Übergabe und Sygic-Produkte;
4. Entscheidung, welche CARTO-Zugangsdaten browsergeeignet sind;
5. HACS-/manuelle Installationsstruktur und Versionsprüfung;
6. explizite Nutzerkommunikation, dass Mock-Routing keine verlässliche
   Wohnmobilnavigation ersetzt.

Aktuelle Blocker sind Hassfest, WebKit/iOS, echte HA-Installations-/Update-
/Deinstallationsläufe und der Nachweis einer unterstützten Lovelace-Resource-
Registrierung. Die Matrix steht in `docs/PHASE2E-TEST-REPORT.md`.

Live-Nakordoni-Routing ist für die erste Stable-Vorbereitung nicht erforderlich
und bleibt bis zu einer separaten Freigabe deaktiviert. Es erfolgt in dieser
Phase keine Installation, kein Tag, kein Release und kein Push.

Truck-Routing darf bis zur tatsächlichen Verfügbarkeit und Prüfung von
Nakordonis `vehicle_type=motorhome` nicht als sichere Wohnmobilnavigation
dargestellt werden. Demo-, Truck- und Motorhome-Routing sind getrennte Modi.
