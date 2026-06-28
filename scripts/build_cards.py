from pathlib import Path
import shutil
import subprocess

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SOURCE_PDF = ROOT / "output/pdf/Session 5 - Speaker Cue Cards.pdf"
SITE_ROOT = ROOT / "cue-card-reader"
ASSETS = SITE_ROOT / "assets"
CARDS = ASSETS / "cards"
TMP = ROOT / "tmp/pdfs/session5-cue-card-reader"


def main():
    CARDS.mkdir(parents=True, exist_ok=True)
    TMP.mkdir(parents=True, exist_ok=True)
    for old in TMP.glob("sheet-*.png"):
        old.unlink()
    for old in CARDS.glob("*.webp"):
        old.unlink()

    subprocess.run(
        [
            "pdftoppm",
            "-png",
            "-r",
            "132",
            str(SOURCE_PDF),
            str(TMP / "sheet"),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )

    card_number = 1
    for sheet_path in sorted(TMP.glob("sheet-*.png")):
        sheet = Image.open(sheet_path).convert("RGB")
        midpoint = sheet.height // 2
        halves = (
            sheet.crop((0, 0, sheet.width, midpoint)),
            sheet.crop((0, midpoint, sheet.width, sheet.height)),
        )
        for card in halves:
            if card_number > 35:
                break
            destination = CARDS / f"{card_number:02d}.webp"
            card.save(destination, "WEBP", quality=84, method=6)
            card_number += 1

    if card_number != 36:
        raise RuntimeError(f"Expected 35 cards, created {card_number - 1}")

    shutil.copy2(SOURCE_PDF, ASSETS / "Session 5 - Speaker Cue Cards.pdf")
    total_bytes = sum(path.stat().st_size for path in CARDS.glob("*.webp"))
    print(f"Created 35 cards ({total_bytes / 1024 / 1024:.1f} MiB)")


if __name__ == "__main__":
    main()
