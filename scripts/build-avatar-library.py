#!/usr/bin/env python3
"""Build the static Pundit avatar asset library and its QA previews."""

from __future__ import annotations

import argparse
import json
from pathlib import Path
from string import ascii_uppercase

from PIL import Image, ImageDraw, ImageFont


ROOT = Path(__file__).resolve().parents[1]
AVATAR_ROOT = ROOT / "assets" / "avatars"
MASTER_SIZE = 1024
APP_SIZE = 256
CIRCLE_SIZE = 940
CIRCLE_OFFSET = (MASTER_SIZE - CIRCLE_SIZE) // 2

FONT_BLACK = ROOT / "assets" / "fonts" / "gotham-bundle" / "Gotham-Black.otf"
FONT_BOLD = ROOT / "assets" / "fonts" / "gotham-bundle" / "Gotham-Bold.otf"

TEXT_DARK = "#2F2926"
SHEET_BACKGROUND = "#F9F6ED"
LETTER_BACKGROUNDS = (
    "#C3DDCE",  # Pundit green tint
    "#D9E8D7",  # light green
    "#D8DFC2",  # soft olive
    "#EDC8BE",  # terracotta tint
    "#F2C9AA",  # warm orange
    "#D7C4B7",  # soft brown
    "#E7D3B0",  # warm tan
    "#F3EBDD",  # cream
)

SYMBOLS = (
    ("classic-leather-football", "Classic leather football"),
    ("modern-panelled-football", "Modern panelled football"),
    ("football-boot", "Football boot"),
    ("goalkeeper-glove", "Goalkeeper glove"),
    ("football-shirt", "Shirt — green sash"),
    ("football-shirt-black-white-stripes", "Shirt — black/white stripes"),
    ("football-shirt-all-white", "Shirt — all white"),
    ("football-shirt-all-red", "Shirt — all red"),
    ("football-shirt-blue-white-hoops", "Shirt — blue/white hoops"),
    ("supporter-scarf", "Supporter scarf"),
    ("referee-whistle", "Referee whistle"),
    ("tactics-board", "Tactics board"),
    ("trophy", "Trophy"),
    ("winners-medal", "Winner's medal"),
    ("corner-flag", "Corner flag"),
    ("goal-and-net", "Goal and net"),
    ("floodlights", "Floodlights"),
    ("stadium", "Stadium"),
    ("referee-cards", "Referee cards"),
    ("captains-armband", "Captain's armband"),
    ("match-stopwatch", "Match stopwatch"),
    ("match-ticket", "Match ticket"),
    ("turnstile", "Turnstile"),
    ("pundit-microphone", "Pundit microphone"),
    ("commentary-headphones", "Commentary headphones"),
    ("match-day-pie", "Match-day pie"),
    ("away-day-coach", "Away-day coach"),
    ("football-programme", "Football programme"),
    ("manager-side-profile", "Manager — side profile"),
    ("goalkeeper-diving", "Goalkeeper diving"),
    ("dugout", "Dugout"),
    ("training-cone", "Training cone"),
)


def ensure_directories() -> None:
    for path in (
        AVATAR_ROOT / "masters" / "symbols",
        AVATAR_ROOT / "masters" / "letters",
        AVATAR_ROOT / "app" / "symbols",
        AVATAR_ROOT / "app" / "letters",
        AVATAR_ROOT / "previews",
    ):
        path.mkdir(parents=True, exist_ok=True)


def save_png(image: Image.Image, path: Path) -> None:
    image.save(path, format="PNG", optimize=True)


def normalize_symbol(source: Path) -> Image.Image:
    image = Image.open(source).convert("RGBA")
    visible_alpha = image.getchannel("A").point(
        lambda alpha: 255 if alpha >= 16 else 0
    )
    alpha_bbox = visible_alpha.getbbox()
    if alpha_bbox is None:
        raise ValueError(f"No visible artwork found in {source}")

    cropped = image.crop(alpha_bbox)
    normalized = cropped.resize((CIRCLE_SIZE, CIRCLE_SIZE), Image.Resampling.LANCZOS)
    canvas = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), (0, 0, 0, 0))
    canvas.alpha_composite(normalized, (CIRCLE_OFFSET, CIRCLE_OFFSET))

    # Image generation can leave a sub-pixel chroma fringe on the circular edge.
    # Extend the clean inner background through the outer twenty pixels, then apply
    # one shared analytic circle mask so every symbol has the same alpha edge.
    pixels = canvas.load()
    center = (MASTER_SIZE - 1) / 2
    radius = CIRCLE_SIZE / 2
    clean_radius = radius - 20
    for y in range(MASTER_SIZE):
        for x in range(MASTER_SIZE):
            dx = x - center
            dy = y - center
            distance = (dx * dx + dy * dy) ** 0.5
            if clean_radius < distance <= radius + 1:
                scale = clean_radius / distance
                sample_x = round(center + dx * scale)
                sample_y = round(center + dy * scale)
                red, green, blue, _ = pixels[sample_x, sample_y]
                coverage = max(0.0, min(1.0, radius + 0.5 - distance))
                pixels[x, y] = (red, green, blue, round(255 * coverage))
            elif distance > radius + 1:
                pixels[x, y] = (0, 0, 0, 0)
    return canvas


def build_symbols(source_dir: Path) -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for slug, label in SYMBOLS:
        source = source_dir / f"symbol-{slug}.png"
        if not source.exists():
            raise FileNotFoundError(f"Missing symbol source: {source}")

        master = normalize_symbol(source)
        app_image = master.resize((APP_SIZE, APP_SIZE), Image.Resampling.LANCZOS)
        master_path = AVATAR_ROOT / "masters" / "symbols" / f"symbol-{slug}.png"
        app_path = AVATAR_ROOT / "app" / "symbols" / f"symbol-{slug}.png"
        save_png(master, master_path)
        save_png(app_image, app_path)
        records.append(
            {
                "id": f"symbol-{slug}",
                "type": "symbol",
                "label": label,
                "master": str(master_path.relative_to(ROOT)),
                "app": str(app_path.relative_to(ROOT)),
            }
        )
    return records


def centered_letter_image(letter: str, background: str) -> Image.Image:
    canvas = Image.new("RGBA", (MASTER_SIZE, MASTER_SIZE), (0, 0, 0, 0))
    draw = ImageDraw.Draw(canvas)
    draw.ellipse(
        (
            CIRCLE_OFFSET,
            CIRCLE_OFFSET,
            CIRCLE_OFFSET + CIRCLE_SIZE - 1,
            CIRCLE_OFFSET + CIRCLE_SIZE - 1,
        ),
        fill=background,
    )
    font = ImageFont.truetype(str(FONT_BLACK), 500)
    bbox = draw.textbbox((0, 0), letter, font=font)
    width = bbox[2] - bbox[0]
    height = bbox[3] - bbox[1]
    x = (MASTER_SIZE - width) / 2 - bbox[0]
    y = (MASTER_SIZE - height) / 2 - bbox[1] + 8
    draw.text((x, y), letter, font=font, fill=TEXT_DARK)
    return canvas


def letter_svg(letter: str, background: str) -> str:
    return f'''<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <title>Letter {letter} avatar</title>
  <circle cx="512" cy="512" r="470" fill="{background}" />
  <text x="512" y="531" fill="{TEXT_DARK}" font-family="Gotham Black, Gotham, sans-serif" font-size="500" font-weight="900" text-anchor="middle" dominant-baseline="middle">{letter}</text>
</svg>
'''


def build_letters() -> list[dict[str, object]]:
    records: list[dict[str, object]] = []
    for index, letter in enumerate(ascii_uppercase):
        slug = letter.lower()
        background = LETTER_BACKGROUNDS[index % len(LETTER_BACKGROUNDS)]
        master = centered_letter_image(letter, background)
        app_image = master.resize((APP_SIZE, APP_SIZE), Image.Resampling.LANCZOS)
        png_path = AVATAR_ROOT / "masters" / "letters" / f"letter-{slug}.png"
        svg_path = AVATAR_ROOT / "masters" / "letters" / f"letter-{slug}.svg"
        app_path = AVATAR_ROOT / "app" / "letters" / f"letter-{slug}.png"
        save_png(master, png_path)
        svg_path.write_text(letter_svg(letter, background), encoding="utf-8")
        save_png(app_image, app_path)
        records.append(
            {
                "id": f"letter-{slug}",
                "type": "letter",
                "label": letter,
                "background": background,
                "masterPng": str(png_path.relative_to(ROOT)),
                "masterSvg": str(svg_path.relative_to(ROOT)),
                "app": str(app_path.relative_to(ROOT)),
            }
        )
    return records


def fit_label(draw: ImageDraw.ImageDraw, text: str, width: int) -> ImageFont.FreeTypeFont:
    for size in range(28, 17, -1):
        font = ImageFont.truetype(str(FONT_BOLD), size)
        if draw.textlength(text, font=font) <= width:
            return font
    return ImageFont.truetype(str(FONT_BOLD), 17)


def draw_contact_section(
    sheet: Image.Image,
    title: str,
    records: list[dict[str, object]],
    top: int,
    columns: int,
) -> int:
    draw = ImageDraw.Draw(sheet)
    heading = ImageFont.truetype(str(FONT_BLACK), 44)
    draw.text((60, top), title, fill=TEXT_DARK, font=heading)
    top += 74
    cell_width = 280
    cell_height = 310
    thumb_size = 240
    for index, record in enumerate(records):
        row, column = divmod(index, columns)
        x = 60 + column * cell_width + (cell_width - thumb_size) // 2
        y = top + row * cell_height
        avatar = Image.open(ROOT / str(record["app"])).convert("RGBA")
        avatar = avatar.resize((thumb_size, thumb_size), Image.Resampling.LANCZOS)
        sheet.alpha_composite(avatar, (x, y))
        label = str(record["label"])
        label_font = fit_label(draw, label, cell_width - 18)
        bbox = draw.textbbox((0, 0), label, font=label_font)
        label_x = 60 + column * cell_width + (cell_width - (bbox[2] - bbox[0])) / 2
        draw.text((label_x, y + 254), label, fill=TEXT_DARK, font=label_font)
    rows = (len(records) + columns - 1) // columns
    return top + rows * cell_height


def build_contact_sheet(symbols: list[dict[str, object]], letters: list[dict[str, object]]) -> None:
    sheet = Image.new("RGBA", (1800, 3850), SHEET_BACKGROUND)
    draw = ImageDraw.Draw(sheet)
    title_font = ImageFont.truetype(str(FONT_BLACK), 64)
    subtitle_font = ImageFont.truetype(str(FONT_BOLD), 28)
    draw.text((60, 48), "PUNDIT AVATAR LIBRARY", fill=TEXT_DARK, font=title_font)
    draw.text((60, 126), "32 football symbols + A–Z letter collection", fill="#34855B", font=subtitle_font)
    next_top = draw_contact_section(sheet, "FOOTBALL SYMBOLS", symbols, 210, 6)
    draw_contact_section(sheet, "LETTER AVATARS", letters, next_top + 18, 6)
    bbox = sheet.getbbox()
    if bbox:
        sheet = sheet.crop((0, 0, sheet.width, min(sheet.height, bbox[3] + 60)))
    save_png(sheet, AVATAR_ROOT / "previews" / "avatar-library-contact-sheet.png")


def build_size_check(symbols: list[dict[str, object]]) -> None:
    sizes = (24, 36, 64, 100)
    width = 1050
    row_height = 132
    sheet = Image.new("RGBA", (width, 110 + len(symbols) * row_height), "#FFFFFF")
    draw = ImageDraw.Draw(sheet)
    heading = ImageFont.truetype(str(FONT_BLACK), 36)
    label_font = ImageFont.truetype(str(FONT_BOLD), 22)
    draw.text((36, 28), "SYMBOL LEGIBILITY CHECK", fill=TEXT_DARK, font=heading)
    for column, size in enumerate(sizes):
        draw.text((430 + column * 145, 70), f"{size}px", fill="#34855B", font=label_font)
    for row, record in enumerate(symbols):
        y = 110 + row * row_height
        draw.text((36, y + 48), str(record["label"]), fill=TEXT_DARK, font=label_font)
        avatar = Image.open(ROOT / str(record["master"])).convert("RGBA")
        for column, size in enumerate(sizes):
            thumb = avatar.resize((size, size), Image.Resampling.LANCZOS)
            x = 440 + column * 145 + (100 - size) // 2
            sheet.alpha_composite(thumb, (x, y + (100 - size) // 2))
    save_png(sheet, AVATAR_ROOT / "previews" / "symbol-size-check.png")


def validate(records: list[dict[str, object]]) -> None:
    if len(records) != 58:
        raise ValueError(f"Expected 58 avatars, found {len(records)}")
    for record in records:
        master_key = "master" if record["type"] == "symbol" else "masterPng"
        for key, expected in ((master_key, MASTER_SIZE), ("app", APP_SIZE)):
            image = Image.open(ROOT / str(record[key])).convert("RGBA")
            if image.size != (expected, expected):
                raise ValueError(f"Unexpected size for {record['id']} {key}: {image.size}")
            if image.getchannel("A").getextrema()[0] != 0:
                raise ValueError(f"Missing transparent outer area for {record['id']} {key}")
            if image.getbbox() is None:
                raise ValueError(f"Empty avatar image for {record['id']} {key}")


def write_manifest(records: list[dict[str, object]]) -> None:
    manifest = {
        "version": 1,
        "total": len(records),
        "masterSize": MASTER_SIZE,
        "appSize": APP_SIZE,
        "circleDiameter": CIRCLE_SIZE,
        "colorSpace": "sRGB",
        "assets": records,
    }
    (AVATAR_ROOT / "manifest.json").write_text(
        json.dumps(manifest, indent=2) + "\n", encoding="utf-8"
    )


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument(
        "--symbol-source-dir",
        type=Path,
        required=True,
        help="Directory containing chroma-key-removed symbol PNG sources.",
    )
    args = parser.parse_args()

    ensure_directories()
    symbols = build_symbols(args.symbol_source_dir)
    letters = build_letters()
    records = symbols + letters
    validate(records)
    write_manifest(records)
    build_contact_sheet(symbols, letters)
    build_size_check(symbols)
    print(f"Built and validated {len(records)} avatars in {AVATAR_ROOT}")


if __name__ == "__main__":
    main()
