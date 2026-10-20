# Interne Beta – Testplan

**Nicht ausgeführt.** Reale Tests beginnen erst nach einer separaten Freigabe
für VM 104 und einen persönlichen Nakordoni-Key.

## Reihenfolge

1. Config Flow, Options Flow, Key-Maskierung, Erneuerung/Entfernung.
2. Neustart-/Reload-/Unload-Verhalten und mehrere unabhängige Config Entries.
3. Carthago-Profil und vollständige Parameterkontrolle ohne automatische
   Requests.
4. Manuelle Route München–Verona; bei Auth-/Schema-/Profilfehler stoppen.
5. Saarbrücken–Basel, Basel–Luzern, Luzern–Bellinzona.
6. Nur verifizierte Restriktionsfälle und nur bei ausreichender Aussagekraft
   eine zusätzliche Mautstrecke.
7. Kartenanzeige, Mautstatus, Warnungen, Speicherung, Laden und GPX.

Maximal acht Routingabfragen insgesamt und innerhalb eines Testtags; keine
Retries, insbesondere nicht bei 429. Jede Antwort wird redigiert dokumentiert.
WebKit/iOS bleibt NOT RUN, falls keine isolierte Umgebung verfügbar ist.
