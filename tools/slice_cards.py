from __future__ import annotations

from pathlib import Path

from PIL import Image


ROOT = Path(__file__).resolve().parent.parent
SOURCE_DIR = ROOT / "images"
SHEET_DIR = ROOT / "assets" / "source" / "card-sheets"
SHEETS = {
    "axis": SHEET_DIR / "卡图1.png",
    "allied": SHEET_DIR / "卡图2.png",
}
ENGLISH_PREFIX = {"axis": "X", "allied": "A"}
OUTPUT_DIRS = {"CN": ROOT / "cards.CN", "EN": ROOT / "cards.EN"}
EXPECTED_SHEET_SIZE = (2700, 2654)
CARD_COUNT = 55
COLS = 10
CARD_WIDTH = 270
CARD_HEIGHT = 380


def output_name(side: str, num: int) -> str:
    return f"card_{side}_{num:02d}.webp"


def save_lossless(image: Image.Image, destination: Path) -> None:
    destination.parent.mkdir(parents=True, exist_ok=True)
    image.convert("RGB").save(destination, "WEBP", lossless=True, method=6)


def slice_chinese_cards(side: str, sheet_path: Path) -> None:
    with Image.open(sheet_path) as sheet:
        if sheet.size != EXPECTED_SHEET_SIZE:
            raise ValueError(f"Unexpected sheet size for {sheet_path}: {sheet.size}")
        for index in range(CARD_COUNT):
            row, col = divmod(index, COLS)
            left = col * CARD_WIDTH
            right = left + CARD_WIDTH
            top = row * CARD_HEIGHT
            bottom = top + CARD_HEIGHT
            card = sheet.crop((left, top, right, bottom))
            save_lossless(card, OUTPUT_DIRS["CN"] / output_name(side, index + 1))


def convert_english_cards(side: str) -> None:
    prefix = ENGLISH_PREFIX[side]
    for num in range(1, CARD_COUNT + 1):
        source = SOURCE_DIR / f"{prefix}{num:02d}.jpg"
        if not source.exists():
            raise FileNotFoundError(source)
        with Image.open(source) as card:
            save_lossless(card, OUTPUT_DIRS["EN"] / output_name(side, num))


def convert_backs() -> None:
    backs = {
        "allied": SOURCE_DIR / "AlliedCardBack.png",
        "axis": SOURCE_DIR / "Axis CardBack.png",
    }
    for side, source in backs.items():
        with Image.open(source) as card:
            for language in OUTPUT_DIRS:
                save_lossless(card, OUTPUT_DIRS[language] / f"card_{side}_back.webp")


def remove_stale_cards() -> None:
    for directory in OUTPUT_DIRS.values():
        directory.mkdir(parents=True, exist_ok=True)
        for path in directory.glob("card_*.webp"):
            path.unlink()


def validate() -> None:
    for language, directory in OUTPUT_DIRS.items():
        files = sorted(directory.glob("card_*.webp"))
        if len(files) != 112:
            raise ValueError(f"{language} expected 112 card assets, found {len(files)}")
        for side in SHEETS:
            for num in range(1, CARD_COUNT + 1):
                path = directory / output_name(side, num)
                with Image.open(path) as card:
                    card.verify()


def main() -> None:
    remove_stale_cards()
    for side, sheet in SHEETS.items():
        slice_chinese_cards(side, sheet)
        convert_english_cards(side)
    convert_backs()
    validate()
    print("Generated and verified 112 assets in cards.CN and 112 assets in cards.EN")


if __name__ == "__main__":
    main()
