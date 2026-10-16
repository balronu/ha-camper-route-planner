"""Provider-independent, bounded GPX 1.1 export for normalized route records."""

from __future__ import annotations

import re
from enum import StrEnum
from typing import Any
from xml.etree import ElementTree

from .models import RouteWaypoint, ValidationError

GPX_NAMESPACE = "http://www.topografix.com/GPX/1/1"
MAX_TRACK_POINTS = 100_000
MAX_ROUTE_POINTS = 100


class GpxExportError(ValueError):
    """Raised when a route cannot be represented safely as GPX."""


class GpxExportMode(StrEnum):
    ROUTE = "route"
    TRACK = "track"
    COMBINED = "combined"


def _point(value: Any) -> RouteWaypoint:
    if not isinstance(value, dict):
        raise GpxExportError("waypoint must be an object")
    try:
        return RouteWaypoint.from_dict(value)
    except (KeyError, TypeError, ValueError, ValidationError) as exc:
        raise GpxExportError("invalid GPX coordinate") from exc


def _route_points(route: dict[str, Any]) -> list[tuple[RouteWaypoint, dict[str, Any]]]:
    try:
        origin = route["origin"]
        points = [(_point(origin), origin)]
        points.extend((_point(item), item) for item in route.get("waypoints", route.get("via", [])))
        destination = route["destination"]
        points.append((_point(destination), destination))
    except KeyError as exc:
        raise GpxExportError("GPX route requires origin and destination") from exc
    if len(points) < 2 or len(points) > MAX_ROUTE_POINTS:
        raise GpxExportError("invalid or oversized GPX route")
    return points


def _geometry_points(route: dict[str, Any]) -> list[RouteWaypoint]:
    geometry = route.get("geometry")
    values = geometry.get("points") if isinstance(geometry, dict) else geometry
    if not isinstance(values, list) or len(values) < 2:
        raise GpxExportError("GPX track requires route geometry with at least two points")
    if len(values) > MAX_TRACK_POINTS:
        raise GpxExportError("GPX track geometry is too large")
    return [_point(value) for value in values]


def _number(value: float) -> str:
    return f"{value:.7f}".rstrip("0").rstrip(".")


def _safe_name(value: Any) -> str:
    name = str(value or "camper-route").replace("/", "_").replace("\\", "_")
    name = re.sub(r"[\x00-\x1f\x7f]", "_", name)
    name = re.sub(r"[^\w .-]", "_", name, flags=re.UNICODE).strip(" .")[:80]
    return name or "camper-route"


def filename_for_route(route: dict[str, Any]) -> str:
    """Create a deterministic, path-safe filename from existing route metadata."""
    created = str(route.get("created_at") or "")
    date = created[:10] if re.fullmatch(r"\d{4}-\d{2}-\d{2}", created[:10]) else ""
    name = _safe_name(route.get("name"))
    if name == "camper-route" and date:
        return f"camper-route-{date}.gpx"
    return f"{name}{('-' + date) if date else ''}.gpx"


def _add_point(parent: ElementTree.Element, tag: str, point: RouteWaypoint, label: str | None = None, description: str | None = None) -> None:
    element = ElementTree.SubElement(parent, f"{{{GPX_NAMESPACE}}}{tag}", {"lat": _number(point.latitude), "lon": _number(point.longitude)})
    if label:
        ElementTree.SubElement(element, f"{{{GPX_NAMESPACE}}}name").text = label
    if description:
        ElementTree.SubElement(element, f"{{{GPX_NAMESPACE}}}desc").text = description


def export_gpx(route: dict[str, Any], mode: str = GpxExportMode.COMBINED) -> bytes:
    """Export a saved/current normalized route without recalculating it."""
    try:
        selected = GpxExportMode(mode)
    except ValueError as exc:
        raise GpxExportError("unsupported GPX export mode") from exc
    if not isinstance(route, dict) or not route:
        raise GpxExportError("route data is empty")
    name = _safe_name(route.get("name"))
    ElementTree.register_namespace("", GPX_NAMESPACE)
    root = ElementTree.Element(f"{{{GPX_NAMESPACE}}}gpx", {"version": "1.1", "creator": "Camper Route Planner"})
    metadata = ElementTree.SubElement(root, f"{{{GPX_NAMESPACE}}}metadata")
    ElementTree.SubElement(metadata, f"{{{GPX_NAMESPACE}}}name").text = name

    if selected in (GpxExportMode.ROUTE, GpxExportMode.COMBINED):
        route_points = _route_points(route)
        rte = ElementTree.SubElement(root, f"{{{GPX_NAMESPACE}}}rte")
        ElementTree.SubElement(rte, f"{{{GPX_NAMESPACE}}}name").text = name
        for index, (point, raw) in enumerate(route_points):
            label = raw.get("label") or ("Start" if index == 0 else "Destination" if index == len(route_points) - 1 else f"Waypoint {index}")
            _add_point(rte, "rtept", point, label, raw.get("description"))

    if selected in (GpxExportMode.TRACK, GpxExportMode.COMBINED):
        geometry = _geometry_points(route)
        track = ElementTree.SubElement(root, f"{{{GPX_NAMESPACE}}}trk")
        ElementTree.SubElement(track, f"{{{GPX_NAMESPACE}}}name").text = f"{name} track"
        segment = ElementTree.SubElement(track, f"{{{GPX_NAMESPACE}}}trkseg")
        for point in geometry:
            _add_point(segment, "trkpt", point)

    return ElementTree.tostring(root, encoding="utf-8", xml_declaration=True)
