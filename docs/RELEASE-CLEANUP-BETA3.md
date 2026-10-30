# Release-/Tag-Bereinigung nach v0.1.1-beta.4

Prüfstand: GitHub Releases und Tags am 26.10.2026 nach erfolgreicher Beta.4-Veröffentlichung und grüner Tag-CI. Die ausdrücklich freigegebenen historischen Beta-Releases und Tags wurden entfernt.

## Verbleibende GitHub-Releases und Tags

| Version | Status | Ergebnis |
|---|---|---|
| `v0.1.0` | Stable / Latest | **Behalten** |
| `v0.1.1-beta.3` | Pre-release | **Behalten** – geprüfte Rückfallbasis |
| `v0.1.1-beta.4` | Pre-release | **Behalten** – aktuelle Test-Beta |

## Gelöschte Releases und Tags

| Version | Release | Git-Tag |
|---|---:|---:|
| `v0.1.1-beta.1` | gelöscht | gelöscht |
| `v0.1.1-beta.2` | gelöscht | gelöscht |
| `v0.1.0-beta.4` | kein Release vorhanden | gelöscht |
| `v0.1.0-beta.5` bis `v0.1.0-beta.21` | gelöscht | gelöscht |

Es wurden keine Branches, Commits oder Source-Historie gelöscht. Aktive historische Branches bleiben unabhängig von den gelöschten Tags erhalten. Es gab keine offenen PRs, die auf die gelöschten Releases angewiesen waren.

## HACS-Prüfung

Die öffentliche GitHub-Release-/Tag-Quelle enthält nach der Bereinigung nur die drei oben genannten Versionen. Die produktive HACS-Installation wurde nicht verändert oder automatisch aktualisiert; die nächste HACS-Metadatenaktualisierung sollte diese bereinigte Auswahl übernehmen.

## Rollback-Grenze

`v0.1.0` bleibt Stable. `v0.1.1-beta.3` bleibt die unmittelbar geprüfte Rückfallbasis für Beta.4. Weitere historische Beta-Tags werden nicht ohne neue ausdrückliche Freigabe gelöscht.
