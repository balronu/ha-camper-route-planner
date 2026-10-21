const TRANSLATIONS = {
  de: {
    vehicle: "Fahrzeug", start: "Start", destination: "Ziel", waypoint: "Zwischenziel", map: "Karte", search: "Adresse suchen", searchPlaceholder: "Ort, Straße oder Adresse", useVehicleLocation: "Fahrzeugstandort übernehmen", trackerUnavailable: "Fahrzeugstandort nicht verfügbar", geocodingNotConfigured: "Adresssuche nicht konfiguriert; Koordinaten oder Karte verwenden", geocodingPrivacy: "Adresssuche übermittelt die Eingabe an Geoapify.", geocodingAttribution: "Geoapify / OpenStreetMap", addressUnavailable: "Adresse nicht verfügbar – Koordinaten werden verwendet", noSearchResults: "Keine Treffer",
    calculate: "Route berechnen", save: "Route speichern", delete: "Route löschen", load: "Laden",
    distance: "Entfernung", duration: "Fahrzeit", warnings: "Warnungen", noRoute: "Keine Route vorhanden",
    mockRoute: "Mock-Route", motorhomeBeta: "Nakordoni Motorhome – Beta", motorhomeWarning: "Wohnmobil-Routing befindet sich in der Beta-Phase. Verkehrszeichen und geltende Vorschriften haben Vorrang.", dataByNakordoni: "Daten von nakordoni.eu", tolls: "Maut", tollEstimate: "Schätzung", tollIncomplete: "Mautdaten unvollständig", tollUnavailable: "Keine Mautpreisinformation", providerUnavailable: "Provider nicht verfügbar", invalidCoordinates: "Ungültige Koordinaten",
    calculationFailed: "Berechnung fehlgeschlagen", addWaypoint: "Zwischenziel hinzufügen", remove: "Entfernen",
    moveUp: "Nach oben", moveDown: "Nach unten", savedRoutes: "Gespeicherte Routen", profileDetails: "Fahrzeugdaten",
    noProfiles: "Keine Fahrzeugprofile vorhanden", loading: "Laden…", saving: "Speichern…", calculating: "Berechne…",
    geometryFallback: "Beta / Mock-Routing · Berechnung nur nach Klick", manualOnly: "Beta / Mock-Routing · Berechnung nur nach Klick",
    provider: "Provider", calculatedAt: "Berechnet", confirmation: "Route wirklich löschen?", unknown: "Unbekannt", mapLoading: "Karte wird geladen…", mapUnavailable: "Kartenkacheln nicht verfügbar; bitte Kartenanbieter und Key prüfen.", previewLine: "Luftlinien-Vorschau – noch keine Straßenroute",
    vehicleKind: { motorhome: "Wohnmobil", truck: "Lkw", car: "Pkw" }, fuelType: { diesel: "Diesel", petrol: "Benzin", electric: "Elektro", hybrid: "Hybrid", other: "Sonstige" },
    latitude: "Breitengrad", longitude: "Längengrad", mockDataNotice: "Synthetische Testdaten – keine geprüfte Straßenroute",
    configMissing: "Keine Camper-Route-Planner-Instanz gefunden. Bitte die Integration zuerst einrichten.", multipleEntries: "Mehrere Camper-Route-Planner-Instanzen gefunden. Bitte eine auswählen.", entrySelection: "Camper-Route-Planner-Instanz", routeSaved: "Route gespeichert", mapTileError: "CARTO-Kartenkacheln nicht erreichbar; SVG-Fallback wird angezeigt.", navigationExport: "Navigation / Export", exportRoute: "GPX-Route", exportTrack: "GPX-Track", exportCombined: "GPX kombiniert", exportFailed: "GPX-Export fehlgeschlagen", exportNoGeometry: "Für den Track ist keine ausreichende Routengeometrie vorhanden.", shareFailed: "Teilen/Download nicht verfügbar"
  },
  en: {
    vehicle: "Vehicle", start: "Start", destination: "Destination", waypoint: "Waypoint", map: "Map", search: "Search address", searchPlaceholder: "Place, street or address", useVehicleLocation: "Use vehicle location", trackerUnavailable: "Vehicle location unavailable", geocodingNotConfigured: "Address search is not configured; use coordinates or the map", geocodingPrivacy: "Address searches send the query to Geoapify.", geocodingAttribution: "Geoapify / OpenStreetMap", addressUnavailable: "Address unavailable – coordinates are used", noSearchResults: "No results",
    calculate: "Calculate route", save: "Save route", delete: "Delete route", load: "Load",
    distance: "Distance", duration: "Travel time", warnings: "Warnings", noRoute: "No route available",
    mockRoute: "Mock route", motorhomeBeta: "Nakordoni Motorhome – Beta", motorhomeWarning: "Motorhome routing is in beta. Traffic signs and applicable regulations take precedence.", dataByNakordoni: "Data by nakordoni.eu", tolls: "Tolls", tollEstimate: "Estimate", tollIncomplete: "Toll data incomplete", tollUnavailable: "No toll price information", providerUnavailable: "Provider unavailable", invalidCoordinates: "Invalid coordinates",
    calculationFailed: "Calculation failed", addWaypoint: "Add waypoint", remove: "Remove",
    moveUp: "Move up", moveDown: "Move down", savedRoutes: "Saved routes", profileDetails: "Vehicle details",
    noProfiles: "No vehicle profiles", loading: "Loading…", saving: "Saving…", calculating: "Calculating…",
    geometryFallback: "Beta / Mock-Routing · geometry fallback without map tiles", manualOnly: "Beta / Mock-Routing · calculation only after click",
    provider: "Provider", calculatedAt: "Calculated", confirmation: "Delete this route?", unknown: "Unknown", mapLoading: "Loading map…", mapUnavailable: "Map tiles are unavailable; check the map provider and key.", previewLine: "Straight-line preview – not a road route yet",
    vehicleKind: { motorhome: "Motorhome", truck: "Truck", car: "Car" }, fuelType: { diesel: "Diesel", petrol: "Petrol", electric: "Electric", hybrid: "Hybrid", other: "Other" },
    latitude: "Latitude", longitude: "Longitude", mockDataNotice: "Synthetic test data – not a checked road route",
    configMissing: "No Camper Route Planner instance found. Set up the integration first.", multipleEntries: "Multiple Camper Route Planner instances found. Select one.", entrySelection: "Camper Route Planner instance", routeSaved: "Route saved", mapTileError: "CARTO map tiles are unavailable; showing the SVG fallback.", navigationExport: "Navigation / Export", exportRoute: "GPX route", exportTrack: "GPX track", exportCombined: "GPX combined", exportFailed: "GPX export failed", exportNoGeometry: "Track export needs sufficient route geometry.", shareFailed: "Sharing/download is unavailable"
  }
};

export function languageOf(hass) {
  const language = hass?.locale?.language || hass?.language || "en";
  return String(language).toLowerCase().startsWith("de") ? "de" : "en";
}

export function t(language, key) {
  const lookup = (catalog) => String(key).split(".").reduce((value, part) => value?.[part], catalog);
  return lookup(TRANSLATIONS[language]) || lookup(TRANSLATIONS.en) || key;
}
