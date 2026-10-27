# Frontend-Cache- und Ressourcenstrategie

- Der Build erzeugt deterministisch `frontend/dist/camper-route-planner-card.js`.
- Eine spätere HA-Ressource verwendet den festen Versionsquery-Parameter
  `?v=0.1.1`; bei einer neuen Version wird der Parameter geändert.
- `window.customCards` wird nur ergänzt, wenn der Kartentyp noch nicht
  vorhanden ist. `customElements.define` wird ebenfalls nur bei fehlender
  Registrierung ausgeführt.
- Die Karte lädt Profile und gespeicherte Routen höchstens einmal je
  `hass.connection`-Identität. Äquivalente `hass`-Updates lösen keine
  WebSocket-Schleife aus.
- Es gibt keine globalen Timer, keine Service Worker, keinen CDN-Import und
  keine Cache-Invalidierung über produktive HA-APIs.
- Beim Upgrade muss die alte versionierte Resource nach einer separat
  autorisierten HA-Prüfung entfernt oder durch die neue URL ersetzt werden;
  historische Bundles werden nicht automatisch umgeschrieben.
