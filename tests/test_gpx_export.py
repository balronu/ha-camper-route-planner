import unittest
from xml.etree import ElementTree

from custom_components.camper_route_planner.gpx import GpxExportError, export_gpx, filename_for_route

NS = {"g": "http://www.topografix.com/GPX/1/1"}


def route_record() -> dict:
    return {
        "name": "Urlaub & München / Route",
        "created_at": "2026-10-16T12:00:00+00:00",
        "provider": "mock",
        "origin": {"latitude": 49, "longitude": 7, "label": "Start & Hof"},
        "waypoints": [{"latitude": 49.5, "longitude": 7.5, "label": "Zwischenziel ä"}, {"latitude": 49.7, "longitude": 7.7}],
        "destination": {"latitude": 50, "longitude": 8, "label": "Ziel"},
        "geometry": {"format": "geojson", "points": [{"latitude": 49, "longitude": 7}, {"latitude": 49.3, "longitude": 7.3}, {"latitude": 50, "longitude": 8}]},
    }


class GpxExportTests(unittest.TestCase):
    def test_route_order_xml_escaping_unicode_and_filename(self):
        xml = export_gpx(route_record(), "route")
        root = ElementTree.fromstring(xml)
        points = root.findall(".//g:rtept", NS)
        self.assertEqual([(p.attrib["lat"], p.attrib["lon"]) for p in points], [("49", "7"), ("49.5", "7.5"), ("49.7", "7.7"), ("50", "8")])
        self.assertIn("Start &amp; Hof", xml.decode())
        self.assertIn("Zwischenziel ä", xml.decode())
        self.assertEqual(filename_for_route(route_record()), "Urlaub _ München _ Route-2026-10-16.gpx")

    def test_track_and_combined_export_use_only_existing_geometry(self):
        track = ElementTree.fromstring(export_gpx(route_record(), "track"))
        combined = ElementTree.fromstring(export_gpx(route_record(), "combined"))
        self.assertEqual(len(track.findall(".//g:trkpt", NS)), 3)
        self.assertEqual(len(combined.findall(".//g:rtept", NS)), 4)
        self.assertEqual(len(combined.findall(".//g:trkpt", NS)), 3)

    def test_missing_geometry_rejects_track_but_route_still_works(self):
        route = route_record()
        route.pop("geometry")
        self.assertIn("rtept", export_gpx(route, "route").decode())
        with self.assertRaises(GpxExportError):
            export_gpx(route, "track")
        with self.assertRaises(GpxExportError):
            export_gpx(route, "combined")

    def test_invalid_coordinates_empty_route_and_size_limit(self):
        route = route_record()
        route["origin"] = {"latitude": 91, "longitude": 7}
        with self.assertRaises(GpxExportError):
            export_gpx(route, "route")
        with self.assertRaises(GpxExportError):
            export_gpx({}, "route")
        oversized = route_record()
        oversized["geometry"] = {"points": [{"latitude": 49, "longitude": 7}] * 100001}
        with self.assertRaises(GpxExportError):
            export_gpx(oversized, "track")

    def test_deterministic_and_no_secret_or_provider_call(self):
        route = route_record()
        first = export_gpx(route)
        second = export_gpx(route)
        self.assertEqual(first, second)
        self.assertNotIn(b"Bearer", first)
        self.assertNotIn(b"api_key", first)


if __name__ == "__main__":
    unittest.main()
