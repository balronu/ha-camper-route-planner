from __future__ import annotations

from xml.etree.ElementTree import Element, SubElement, tostring

from .models import Coordinate, RouteResult


def export_gpx(result: RouteResult, name: str = "camper-route") -> bytes:
    root = Element("gpx", {"version": "1.1", "creator": "Camper Route Planner Phase 1",
                             "xmlns": "http://www.topografix.com/GPX/1/1"})
    metadata = SubElement(root, "metadata")
    SubElement(metadata, "name").text = name
    route = SubElement(root, "rte")
    SubElement(route, "name").text = name
    for point in result.geometry:
        SubElement(route, "rtept", {"lat": f"{point.latitude:.6f}", "lon": f"{point.longitude:.6f}"})
    track = SubElement(root, "trk")
    SubElement(track, "name").text = f"{name} track"
    segment = SubElement(track, "trkseg")
    for point in result.geometry:
        SubElement(segment, "trkpt", {"lat": f"{point.latitude:.6f}", "lon": f"{point.longitude:.6f}"})
    return tostring(root, encoding="utf-8", xml_declaration=True)
