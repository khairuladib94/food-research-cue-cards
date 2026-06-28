from pathlib import Path
import shutil
import subprocess

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]
SITE_ROOT = ROOT / "cue-card-reader"
TMP_ROOT = ROOT / "tmp/pdfs/cue-card-reader"

SESSIONS = {
    "session-5": {
        "source": ROOT / "output/pdf/Session 5 - Speaker Cue Cards.pdf",
        "count": 35,
    },
    "session-6": {
        "source": ROOT / "output/pdf/Session 6 - Speaker Cue Cards.pdf",
        "count": 41,
    },
}


def build_session(session_id, config):
    source_pdf = config["source"]
    expected_count = config["count"]
    session_assets = SITE_ROOT / "assets" / session_id
    cards_dir = session_assets / "cards"
    tmp_dir = TMP_ROOT / session_id

    cards_dir.mkdir(parents=True, exist_ok=True)
    tmp_dir.mkdir(parents=True, exist_ok=True)
    for old in tmp_dir.glob("sheet-*.png"):
        old.unlink()
    for old in cards_dir.glob("*.webp"):
        old.unlink()

    subprocess.run(
        [
            "pdftoppm",
            "-png",
            "-r",
            "132",
            str(source_pdf),
            str(tmp_dir / "sheet"),
        ],
        check=True,
        stdout=subprocess.DEVNULL,
    )

    card_number = 1
    for sheet_path in sorted(tmp_dir.glob("sheet-*.png")):
        sheet = Image.open(sheet_path).convert("RGB")
        midpoint = sheet.height // 2
        halves = (
            sheet.crop((0, 0, sheet.width, midpoint)),
            sheet.crop((0, midpoint, sheet.width, sheet.height)),
        )
        for card in halves:
            if card_number > expected_count:
                break
            card.save(
                cards_dir / f"{card_number:02d}.webp",
                "WEBP",
                quality=84,
                method=6,
            )
            card_number += 1

    if card_number != expected_count + 1:
        raise RuntimeError(
            f"{session_id}: expected {expected_count} cards, created {card_number - 1}"
        )

    shutil.copy2(source_pdf, session_assets / "Speaker Cue Cards.pdf")
    total_bytes = sum(path.stat().st_size for path in cards_dir.glob("*.webp"))
    print(f"{session_id}: {expected_count} cards ({total_bytes / 1024 / 1024:.1f} MiB)")


def main():
    for session_id, config in SESSIONS.items():
        build_session(session_id, config)


if __name__ == "__main__":
    main()
