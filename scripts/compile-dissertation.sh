#!/bin/bash

# Dissertation PDF Compilation Script
# Compiles all markdown chapters into a single formatted PDF

set -e

# Derive script directory dynamically
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(cd "$SCRIPT_DIR/.." && pwd)"

# Default research directory - can be overridden by first argument
RESEARCH_DIR="${1:-$PROJECT_ROOT/docs/research/online-communities-adolescent-identity}"
OUTPUT_DIR="${RESEARCH_DIR}/output"
OUTPUT_FILE="${OUTPUT_DIR}/dissertation-final.pdf"
COMBINED_MD="${OUTPUT_DIR}/dissertation-combined.md"

# Create output directory
mkdir -p "${OUTPUT_DIR}"

echo "=== Dissertation PDF Compilation ==="
echo "Source: ${RESEARCH_DIR}"
echo "Output: ${OUTPUT_FILE}"
echo ""

# Create combined markdown file with proper front matter
cat > "${COMBINED_MD}" << 'FRONTMATTER'
---
title: "How Do Online Communities Support or Harm Adolescent Identity Formation?"
subtitle: "A Systematic Review and Theoretical Synthesis"
author: "[Author Name]"
date: "December 2025"
documentclass: report
geometry: margin=1in
fontsize: 12pt
linestretch: 1.5
toc: true
toc-depth: 3
numbersections: true
header-includes:
  - \usepackage{fancyhdr}
  - \pagestyle{fancy}
  - \fancyhead[L]{}
  - \fancyhead[R]{}
  - \fancyfoot[C]{\thepage}
---

\newpage

FRONTMATTER

echo "Combining chapters..."

# Add Abstract
echo "Adding Abstract..."
echo "" >> "${COMBINED_MD}"
cat "${RESEARCH_DIR}/00-abstract.md" >> "${COMBINED_MD}"
echo -e "\n\\newpage\n" >> "${COMBINED_MD}"

# Add chapters in order
for chapter in 01 02 03 04 05 06 07 08 09; do
    CHAPTER_FILE="${RESEARCH_DIR}/chapters/${chapter}-*.md"
    if ls ${CHAPTER_FILE} 1> /dev/null 2>&1; then
        ACTUAL_FILE=$(ls ${CHAPTER_FILE} | grep -v BACKUP | head -1)
        if [ -f "$ACTUAL_FILE" ]; then
            echo "Adding: $(basename $ACTUAL_FILE)"
            echo "" >> "${COMBINED_MD}"
            cat "$ACTUAL_FILE" >> "${COMBINED_MD}"
            echo -e "\n\\newpage\n" >> "${COMBINED_MD}"
        fi
    fi
done

echo ""
echo "Converting to PDF with Pandoc..."

# Try PDF generation with different engines
if pandoc "${COMBINED_MD}" \
    -o "${OUTPUT_FILE}" \
    --pdf-engine=pdflatex \
    -V geometry:margin=1in \
    -V fontsize=12pt \
    -V documentclass=report \
    --toc \
    --toc-depth=3 \
    -N \
    2>/dev/null; then
    echo "PDF created successfully with pdflatex!"
elif pandoc "${COMBINED_MD}" \
    -o "${OUTPUT_FILE}" \
    --pdf-engine=xelatex \
    -V geometry:margin=1in \
    -V fontsize=12pt \
    2>/dev/null; then
    echo "PDF created successfully with xelatex!"
elif pandoc "${COMBINED_MD}" \
    -o "${OUTPUT_FILE}" \
    --pdf-engine=wkhtmltopdf \
    2>/dev/null; then
    echo "PDF created successfully with wkhtmltopdf!"
else
    # Fallback to HTML
    HTML_FILE="${OUTPUT_DIR}/dissertation-final.html"
    echo "LaTeX not available. Creating HTML version instead..."
    pandoc "${COMBINED_MD}" \
        -o "${HTML_FILE}" \
        --standalone \
        --toc \
        --toc-depth=3 \
        -N \
        --metadata title="How Do Online Communities Support or Harm Adolescent Identity Formation?" \
        -c https://cdn.jsdelivr.net/npm/github-markdown-css/github-markdown.min.css
    echo "HTML created: ${HTML_FILE}"
    echo ""
    echo "To convert HTML to PDF, you can:"
    echo "  1. Open in browser and Print to PDF"
    echo "  2. Install wkhtmltopdf: sudo apt install wkhtmltopdf"
    echo "  3. Install texlive: sudo apt install texlive-latex-base texlive-fonts-recommended"
fi

# Generate word count report
echo ""
echo "=== Word Count Summary ==="
wc -w ${RESEARCH_DIR}/chapters/*.md 2>/dev/null | tail -1 || echo "Word count unavailable"

echo ""
echo "=== Compilation Complete ==="
echo "Output directory: ${OUTPUT_DIR}"
ls -la "${OUTPUT_DIR}/"
