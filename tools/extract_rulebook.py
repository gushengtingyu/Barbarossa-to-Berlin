"""Build a searchable Markdown rules reference from the official BTB PDF.

The PDF and printed card faces remain authoritative.  This file only performs
layout cleanup: repeated page furniture is removed, wrapped words are joined,
and numbered rules/card lists are converted to Markdown structure.
"""

from __future__ import annotations

import re
import sys
from pathlib import Path

from pypdf import PdfReader


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_INPUT = ROOT / "BtB rules-2006.pdf"
DEFAULT_OUTPUT = ROOT / "docs" / "BTB_RULES_2006_v1.3.md"

PAGE_HEADER = re.compile(r"^\d+\s*WWII:\s*Barbarossa to Berlin$")
COPYRIGHT = re.compile(r"^©\s*2006 GMT Games, LLC$")
TOP_LEVEL = re.compile(r"^(\d{1,2})\.\s+(.+)$")
SUB_RULE = re.compile(r"^(\d{1,2}\.\d+)\s+(.+)$")
NUMBERED = re.compile(r"^(\d+)\.\s+(.+)$")

FIXES = {
    "STA VKA": "STAVKA",
    "V oronezh": "Voronezh",
    "V olkhov": "Volkhov",
    "NA V AL": "NAVAL",
    "A V ALANCHE": "AVALANCHE",
    "W AFFE": "WAFFE",
    "ACTIV ATION": "ACTIVATION",
    "REMOV AL": "REMOVAL",
    "ADV ANCE": "ADVANCE",
    "Restric- tions": "Restrictions",
}

CARD_SECTIONS = {
    "Allied Blitzkrieg Cards",
    "Allied Total War Cards",
    "Axis Blitzkrieg Cards",
    "Axis Total War Cards",
}


def tidy_text(text: str) -> str:
    text = text.replace("\u00ad", "").replace("\ufb01", "fi").replace("\ufb02", "fl")
    for source, target in FIXES.items():
        text = text.replace(source, target)
    return re.sub(r"\s+", " ", text).strip()


def append_wrapped(target: list[str], text: str) -> None:
    if not target:
        target.append(text)
        return
    if target[-1].endswith("-") and text[:1].islower():
        target[-1] = target[-1][:-1] + text
    else:
        target[-1] += " " + text


def flush_paragraph(output: list[str], paragraph: list[str]) -> None:
    if not paragraph:
        return
    output.append(paragraph.pop())
    output.append("")


def extract_lines(pdf_path: Path) -> list[str]:
    reader = PdfReader(str(pdf_path))
    lines: list[str] = []
    # Page 1 is the cover/table of contents. The reference provides a cleaner TOC.
    for page in reader.pages[1:]:
        for raw in (page.extract_text() or "").splitlines():
            line = tidy_text(raw)
            if not line or PAGE_HEADER.match(line) or COPYRIGHT.match(line):
                continue
            lines.append(line)
    return lines


def markdown_body(lines: list[str]) -> list[str]:
    output: list[str] = []
    paragraph: list[str] = []
    active_list: str | None = None
    in_card_list = False
    index = 0

    while index < len(lines):
        line = lines[index]

        if line in CARD_SECTIONS:
            flush_paragraph(output, paragraph)
            if not in_card_list:
                output.extend(["## Appendix A. Strategy Card List", ""])
                in_card_list = True
            output.extend([f"### {line}", ""])
            active_list = None
            index += 1
            continue

        if line in {"Additional Clarifications", "Clarifications"}:
            flush_paragraph(output, paragraph)
            output.extend([f"## {line}", ""])
            active_list = None
            index += 1
            continue

        sub = SUB_RULE.match(line)
        if sub and not in_card_list:
            flush_paragraph(output, paragraph)
            title, separator, prose = sub.group(2).partition(":")
            output.extend([f"### {sub.group(1)} {title.strip()}", ""])
            if separator and prose.strip():
                paragraph.append(prose.strip())
            active_list = None
            index += 1
            continue

        top = TOP_LEVEL.match(line)
        if top and not in_card_list and top.group(2).upper() == top.group(2):
            title = top.group(2)
            while index + 1 < len(lines) and lines[index + 1].upper() == lines[index + 1] and not re.match(r"^\d", lines[index + 1]):
                index += 1
                title += " " + lines[index]
            flush_paragraph(output, paragraph)
            output.extend([f"## {top.group(1)}.0 {title.title()}", ""])
            active_list = None
            index += 1
            continue

        if line.startswith("•"):
            flush_paragraph(output, paragraph)
            output.extend(["- " + line[1:].strip(), ""])
            active_list = "bullet"
            index += 1
            continue

        numbered = NUMBERED.match(line)
        if numbered and (in_card_list or numbered.group(1) in {str(n) for n in range(1, 12)}):
            flush_paragraph(output, paragraph)
            output.extend([f"{numbered.group(1)}. {numbered.group(2)}", ""])
            active_list = "numbered"
            index += 1
            continue

        if active_list and output and output[-1] == "" and not re.match(r"^(?:##|- |\d+\.)", line):
            output[-2] = output[-2][:-1] + line if output[-2].endswith("-") and line[:1].islower() else output[-2] + " " + line
            index += 1
            continue

        active_list = None
        append_wrapped(paragraph, line)
        index += 1

    flush_paragraph(output, paragraph)
    return output


def build(pdf_path: Path, output_path: Path) -> None:
    header = [
        "# WWII: Barbarossa to Berlin - Rules (2006 v1.3)",
        "",
        "> Searchable development reference generated from `BtB rules-2006.pdf`.",
        "> The official PDF, 2006 v1.3 Clarifications, printed card text, and map symbols remain authoritative in that order.",
        "> Line wrapping and headings are normalized; no rules interpretation is added here.",
        "",
        "## Contents",
        "",
    ]
    topics = [
        "Introduction", "Components", "Terminology and Rules Abbreviations", "Game Setup",
        "Determining Victory", "Sequence of Play", "Strategy Cards", "Orders", "Stacking",
        "Movement", "Combat", "Strategic Redeployment", "Supply", "Replacements", "Weather",
        "Partisans", "Neutrals", "Resources", "National Restrictions", "Campaign Scenario",
    ]
    header.extend(f"- {number}. {topic}" for number, topic in enumerate(topics, 1))
    header.extend(["- Additional Clarifications", "- Clarifications", "- Appendix A. Strategy Card List", "", "---", ""])

    output_path.parent.mkdir(parents=True, exist_ok=True)
    output_path.write_text("\n".join(header + markdown_body(extract_lines(pdf_path))).rstrip() + "\n", encoding="utf-8")


if __name__ == "__main__":
    source = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_INPUT
    destination = Path(sys.argv[2]).resolve() if len(sys.argv) > 2 else DEFAULT_OUTPUT
    build(source, destination)
    print(f"Wrote {destination}")
