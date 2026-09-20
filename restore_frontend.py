from pathlib import Path
import base64
import io
import zipfile

ROOT = Path(__file__).resolve().parent
PARTS = [
    ROOT / "deploy-bundle" / "part-00.b64",
    ROOT / "deploy-bundle" / "part-01.b64",
    ROOT / "deploy-bundle" / "part-02.b64",
    ROOT / "deploy-bundle" / "rest.b64",
]

missing = [str(p) for p in PARTS if not p.exists()]
if missing:
    raise SystemExit("Missing frontend bundle: " + ", ".join(missing))

encoded = "".join(p.read_text(encoding="utf-8").strip() for p in PARTS)
encoded += "=" * (-len(encoded) % 4)

try:
    archive = base64.b64decode(encoded)
except Exception as exc:
    raise SystemExit(f"Could not decode frontend bundle: {exc}")

if not archive.startswith(b"PK"):
    raise SystemExit("Frontend bundle is not a valid ZIP payload.")

with zipfile.ZipFile(io.BytesIO(archive)) as zf:
    root = ROOT.resolve()
    for member in zf.infolist():
        target = (ROOT / member.filename).resolve()
        if target != root and root not in target.parents:
            raise SystemExit(f"Unsafe archive path: {member.filename}")
    zf.extractall(ROOT)

index = ROOT / "frontend" / "index.html"
if not index.exists():
    raise SystemExit("frontend/index.html was not restored.")

print("Full MCQ Campus frontend restored successfully.")
