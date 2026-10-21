#!/usr/bin/env python3
"""Build and validate the installable internal-beta ZIP package."""

from __future__ import annotations

import hashlib
import os
from pathlib import Path
import re
import subprocess
import sys
from zipfile import ZIP_DEFLATED, ZipFile

ROOT = Path(__file__).resolve().parents[1]
INTEGRATION = ROOT / "custom_components" / "camper_route_planner"
PACKAGE_VERSION = os.environ.get("PACKAGE_VERSION", "0.1.0-internal-beta.3")
OUTPUT = ROOT / "artifacts" / f"camper-route-planner-{PACKAGE_VERSION}.zip"
EXPECTED = (
    "__init__.py",
    "config_flow.py",
    "config_flow_support.py",
    "const.py",
    "coordinator.py",
    "gpx.py",
    "manifest.json",
    "map_provider.py",
    "models.py",
    "runtime.py",
    "services.yaml",
    "storage.py",
    "strings.json",
    "websocket_api.py",
    "frontend/camper-route-planner-card.js",
    "assets/icon.png",
    "assets/icon.svg",
    "translations/de.json",
    "translations/en.json",
    "providers/__init__.py",
    "providers/base.py",
    "providers/mock.py",
    "providers/nakordoni.py",
    "providers/nakordoni_motorhome.py",
    "providers/oauth.py",
    "providers/usage.py",
)
SECRET_PATTERN = re.compile(r"(?:Bearer\s+[A-Za-z0-9._-]{16,}|NAKORDONI_API_KEY\s*=)")


def git_commit() -> str:
    return subprocess.check_output(
        ["git", "rev-parse", "HEAD"], cwd=ROOT, text=True
    ).strip()


def files_for_package() -> list[Path]:
    files = []
    for path in sorted(INTEGRATION.rglob("*")):
        if not path.is_file() or path.is_symlink():
            continue
        relative = path.relative_to(INTEGRATION).as_posix()
        if relative.endswith((".pyc",)) or "__pycache__/" in relative:
            continue
        files.append(path)
    return files


def validate(files: list[Path]) -> None:
    names = {path.relative_to(INTEGRATION).as_posix() for path in files}
    missing = sorted(set(EXPECTED) - names)
    if missing:
        raise SystemExit(f"missing runtime files: {', '.join(missing)}")
    for path in files:
        if path.is_symlink() or path.is_absolute() is False and ".." in path.parts:
            raise SystemExit(f"unsafe package path: {path}")
        text = path.read_text(encoding="utf-8", errors="ignore")
        if SECRET_PATTERN.search(text):
            raise SystemExit(f"secret-like content found in package file: {path}")


def main() -> int:
    files = files_for_package()
    validate(files)
    commit = git_commit()
    OUTPUT.parent.mkdir(parents=True, exist_ok=True)
    with ZipFile(OUTPUT, "w", compression=ZIP_DEFLATED) as archive:
        for path in files:
            relative = path.relative_to(INTEGRATION).as_posix()
            archive.write(path, f"camper_route_planner/{relative}")
        archive.writestr(
            "camper_route_planner/BETA-COMMIT.txt",
            f"Camper Route Planner internal beta package\nCommit: {commit}\n",
        )
    digest = hashlib.sha256(OUTPUT.read_bytes()).hexdigest()
    checksum = OUTPUT.with_suffix(OUTPUT.suffix + ".sha256")
    checksum.write_text(f"{digest}  {OUTPUT.name}\n", encoding="utf-8")
    with ZipFile(OUTPUT) as archive:
        names = archive.namelist()
        if any(name.startswith("/") or ".." in Path(name).parts for name in names):
            raise SystemExit("unsafe ZIP member path")
        if any(name.endswith("/") for name in names):
            raise SystemExit("unexpected directory member")
        archive.testzip()
    print(f"package: {OUTPUT}")
    print(f"sha256: {digest}")
    print(f"commit: {commit}")
    print(f"files: {len(files) + 1}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
