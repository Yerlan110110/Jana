#!/usr/bin/env python3
import argparse
import hashlib
import json
from pathlib import Path
from xml.sax.saxutils import escape

from reportlab.lib.colors import HexColor
from reportlab.lib.styles import ParagraphStyle
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas
from reportlab.platypus import Paragraph

ROOT = Path(__file__).resolve().parents[2]
WIDTH, HEIGHT = 1600, 1000
INK, MUTED, ACCENT = "#12151a", "#4b5563", "#007a00"


def paragraph(canvas, text, x, top, width, size, height, *, bold=False, color=INK):
    style = ParagraphStyle(
        "JanaMen", fontName="JanaBold" if bold else "JanaRegular",
        fontSize=size, leading=size * 1.3, textColor=HexColor(color),
    )
    item = Paragraph(escape(text).replace("\n", "<br/>"), style)
    _, used = item.wrap(width, height)
    if used > height:
        raise ValueError(f"Text does not fit its {height}-point region: {text}")
    item.drawOn(canvas, x, top - used)


def build(args):
    source = ROOT / "docs/defense/slides.json"
    slides = json.loads(source.read_text())["slides"]
    for name, path in (("JanaRegular", args.regular_font), ("JanaBold", args.bold_font)):
        pdfmetrics.registerFont(TTFont(name, str(path)))
    args.output.parent.mkdir(parents=True, exist_ok=True)
    canvas = Canvas(str(args.output), pagesize=(WIDTH, HEIGHT), invariant=True, pageCompression=1)
    canvas.setTitle("JanaMen | Digital HR")
    canvas.setAuthor("JanaMen")
    canvas.setSubject("Synthetic HR demonstration, 18 October 2026")
    for index, slide in enumerate(slides, 1):
        canvas.setFillColor(HexColor("#ffffff"))
        canvas.rect(0, 0, WIDTH, HEIGHT, fill=1, stroke=0)
        if slide["kind"] == "cover":
            paragraph(canvas, "JanaMen", 112, 820, 1376, 108, 150, bold=True, color=ACCENT)
            paragraph(canvas, slide["title"], 112, 610, 1250, 54, 170, bold=True)
            paragraph(canvas, slide["text"], 112, 385, 1200, 32, 160)
            paragraph(canvas, "Jana Post × Terricon Valley\nDigital HR, 18 октября 2026", 112, 165, 1100, 23, 70, color=MUTED)
        elif slide["kind"] == "screen":
            paragraph(canvas, slide["title"], 112, 967, 1376, 42, 60, bold=True)
            image = ROOT / "docs/defense" / slide["image"]
            canvas.drawImage(str(image), 160, 112, width=1280, height=800, preserveAspectRatio=True, mask="auto")
            paragraph(canvas, slide["text"], 160, 94, 1280, 22, 64)
        elif slide["kind"] == "closing":
            paragraph(canvas, slide["title"], 112, 900, 1376, 54, 90, bold=True)
            for line, top in zip(slide["paragraphs"], (740, 570, 390), strict=True):
                paragraph(canvas, line, 112, top, 1310, 32, 130)
            paragraph(canvas, "Открыть демонстрацию", 112, 185, 650, 29, 50, bold=True, color=ACCENT)
            canvas.linkURL(slide["demo_url"], (112, 140, 770, 187), relative=0)
            paragraph(canvas, "github.com/Yerlan110110/Jana", 112, 115, 1000, 24, 45)
            canvas.linkURL("https://github.com/Yerlan110110/Jana", (112, 77, 1100, 119), relative=0)
        else:
            raise ValueError(f"Unknown page kind: {slide['kind']}")
        canvas.setFont("JanaRegular", 14)
        canvas.setFillColor(HexColor(MUTED))
        canvas.drawString(112, 19, "Демонстрационные данные. Люди, регламенты и учебные кейсы вымышлены.")
        canvas.drawRightString(1488, 19, f"{index} / {len(slides)}")
        canvas.showPage()
    canvas.save()
    images = sorted((ROOT / "docs/defense/assets").glob("*.png"))
    manifest = {
        "pages": len(slides), "page_size": [WIDTH, HEIGHT],
        "pdf_sha256": hashlib.sha256(args.output.read_bytes()).hexdigest(),
        "content_sha256": hashlib.sha256(source.read_bytes()).hexdigest(),
        "images": [{"path": str(p.relative_to(ROOT)), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in images],
        "fonts": [{"path": str(p), "sha256": hashlib.sha256(p.read_bytes()).hexdigest()} for p in (args.regular_font, args.bold_font)],
    }
    print(json.dumps(manifest, indent=2))


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build the offline JanaMen defense PDF from its source and real screenshots")
    parser.add_argument("--output", type=Path, default=ROOT / "docs/defense/JanaMen-defense.pdf")
    parser.add_argument("--regular-font", type=Path, default=Path("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf"))
    parser.add_argument("--bold-font", type=Path, default=Path("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf"))
    build(parser.parse_args())
