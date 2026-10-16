export async function callWebsocket(hass, message) {
  if (!hass?.callWS) throw new Error("Home Assistant WebSocket unavailable");
  return hass.callWS(message);
}

export async function calculateRoute(hass, data) {
  if (!hass?.callWS) throw new Error("Home Assistant WebSocket API unavailable");
  const response = await hass.callWS({ type: "call_service", domain: "camper_route_planner", service: "calculate_route", service_data: data, target: {}, return_response: true });
  return response?.response || response || {};
}

export async function exportGpx(hass, data) {
  return callWebsocket(hass, { type: "camper_route_planner/export_gpx", ...data });
}

export async function deliverGpxExport(payload) {
  const bytes = new TextEncoder().encode(payload.content);
  const blob = new Blob([bytes], { type: payload.mime_type || "application/gpx+xml;charset=utf-8" });
  const file = new File([blob], payload.filename || "camper-route.gpx", { type: blob.type });
  if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
    await navigator.share({ title: payload.filename || "Camper route", files: [file] });
    return "shared";
  }
  const url = URL.createObjectURL(blob);
  try {
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = payload.filename || "camper-route.gpx";
    anchor.rel = "noopener";
    anchor.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
  return "downloaded";
}
