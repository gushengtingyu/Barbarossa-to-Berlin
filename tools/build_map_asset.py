"""Build the browser-optimized BTB map while retaining the source PNG."""

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "btb map.png"
TARGET = ROOT / "btb map.webp"


def main():
	with Image.open(SOURCE) as image:
		image.convert("RGB").save(TARGET, "WEBP", quality=92, method=6)
	print(f"map: {SOURCE.stat().st_size} -> {TARGET.stat().st_size} bytes")


if __name__ == "__main__":
	main()
