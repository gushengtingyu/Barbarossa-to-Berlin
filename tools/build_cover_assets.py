#!/usr/bin/env python3
"""Build Rally cover variants from the canonical BTB cover.png."""

import hashlib
import json
from pathlib import Path

from PIL import Image, ImageOps


ROOT = Path(__file__).resolve().parent.parent
SOURCE = ROOT / "cover.png"
MANIFEST = ROOT / "cover-assets.json"
VARIANTS = {
    "cover.1x.jpg": (150, 200),
    "cover.2x.jpg": (300, 400),
    "thumbnail.jpg": (108, 144),
}


def build_variant(source: Image.Image, output: Path, size: tuple[int, int]) -> None:
    # Rally renders cover assets at their natural dimensions. Fit to its 3:4
    # convention without stretching; the supplied art only loses a narrow strip
    # at the top and bottom.
    fitted = ImageOps.fit(
        source.convert("RGB"),
        size,
        method=Image.Resampling.LANCZOS,
        centering=(0.5, 0.5),
    )
    fitted.save(
        output,
        format="JPEG",
        quality=92,
        subsampling=0,
        optimize=True,
        progressive=True,
    )


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def main() -> None:
    if not SOURCE.is_file():
        raise SystemExit(f"Missing canonical cover: {SOURCE}")

    with Image.open(SOURCE) as source:
        source.load()
        for name, size in VARIANTS.items():
            output = ROOT / name
            build_variant(source, output, size)
            print(f"Built {output.name}: {size[0]}x{size[1]}")

    manifest = {
        "source": {"file": SOURCE.name, "sha256": sha256(SOURCE)},
        "variants": {
            name: {"width": size[0], "height": size[1], "sha256": sha256(ROOT / name)}
            for name, size in VARIANTS.items()
        },
    }
    MANIFEST.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf-8")
    print(f"Updated {MANIFEST.name}")


if __name__ == "__main__":
    main()
