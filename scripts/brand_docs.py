"""Brand a Markdown file into a MobiCova .docx (teal headings + logo banner),
and build a one-slide budget-summary .pptx. Reusable for the doc kit.

Usage:
  python scripts/brand_docs.py md2docx INPUT.md OUTPUT.docx "Document Title"
  python scripts/brand_docs.py budget-slide OUTPUT.pptx
"""
import sys, subprocess, os
from docx import Document
from docx.shared import RGBColor, Pt, Inches, Emu
from docx.enum.text import WD_ALIGN_PARAGRAPH

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
LOGO = os.path.join(ROOT, "client", "public", "images", "logo.png")
PANDOC = r"C:\Users\Dee\AppData\Local\Pandoc\pandoc.exe"
TEAL = RGBColor(0x0A, 0x7B, 0x7B)
DARK = RGBColor(0x0E, 0x2A, 0x2A)


def add_logo_banner(doc, title):
    # Fresh centered logo paragraph + teal title paragraph, both moved to the top.
    p = doc.add_paragraph()
    p.alignment = WD_ALIGN_PARAGRAPH.CENTER
    run = p.add_run()
    try:
        run.add_picture(LOGO, width=Inches(2.4))
    except Exception:
        run.add_text("MobiCova Health")

    t = doc.add_paragraph()
    t.alignment = WD_ALIGN_PARAGRAPH.CENTER
    tr = t.add_run(title)
    tr.font.size = Pt(20)
    tr.font.bold = True
    tr.font.color.rgb = TEAL
    tr.font.name = "Calibri"

    # Move the banner block to the very top (insert title last so it ends up under the logo).
    body = doc.element.body
    for para in [t._p, p._p]:
        body.remove(para)
        body.insert(0, para)


def recolor_headings(doc):
    for para in doc.paragraphs:
        if para.style.name and para.style.name.startswith("Heading"):
            for run in para.runs:
                run.font.color.rgb = TEAL
                run.font.name = "Calibri"


def md2docx(md, out, title):
    tmp = out + ".tmp.docx"
    subprocess.run([PANDOC, md, "-o", tmp], check=True)
    doc = Document(tmp)
    # base font
    try:
        doc.styles["Normal"].font.name = "Calibri"
        doc.styles["Normal"].font.size = Pt(10.5)
    except Exception:
        pass
    # Drop the markdown's own leading H1 (the banner supplies the title).
    for para in doc.paragraphs:
        if para.style.name == "Title" or para.style.name == "Heading 1":
            para._p.getparent().remove(para._p)
            break
    recolor_headings(doc)
    add_logo_banner(doc, title)
    doc.save(out)
    os.remove(tmp)
    print("wrote", out)


def budget_slide(out):
    from pptx import Presentation
    from pptx.util import Inches as PInches, Pt as PPt, Emu as PEmu
    from pptx.dml.color import RGBColor as PRGB
    from pptx.enum.text import PP_ALIGN

    TEALP = PRGB(0x0A, 0x7B, 0x7B)
    DARKP = PRGB(0x0E, 0x2A, 0x2A)
    GREY = PRGB(0x55, 0x66, 0x66)
    WHITE = PRGB(0xFF, 0xFF, 0xFF)

    prs = Presentation()
    prs.slide_width = PInches(13.333)
    prs.slide_height = PInches(7.5)
    slide = prs.slides.add_slide(prs.slide_layouts[6])  # blank

    # dark header band
    band = slide.shapes.add_shape(1, 0, 0, prs.slide_width, PInches(1.5))
    band.fill.solid(); band.fill.fore_color.rgb = DARKP; band.line.fill.background()
    try:
        slide.shapes.add_picture(LOGO, PInches(0.5), PInches(0.42), height=PInches(0.66))
    except Exception:
        pass
    tb = slide.shapes.add_textbox(PInches(4.7), PInches(0.45), PInches(8.2), PInches(0.7))
    tf = tb.text_frame; tf.text = "Production Platform — Year-One Budget (50k members)"
    r = tf.paragraphs[0].runs[0]; r.font.size = PPt(22); r.font.bold = True; r.font.color.rgb = WHITE
    tf.paragraphs[0].alignment = PP_ALIGN.RIGHT

    rows = [
        ("Bucket", "Year-one (USD)"),
        ("Infra build-out / setup (Tier B, AWS af-south-1)", "$30k - $70k"),
        ("Infra run-rate  (~$2k-$3k/mo x 12)", "$24k - $36k"),
        ("SOC 2 + ISO 27001 + penetration test", "$40k - $90k"),
        ("DevOps / SRE  (~$2k-$6k/mo x 12)", "$24k - $72k"),
        ("SUBTOTAL  (excl. variable comms & payments)", "$118k - $268k"),
        ("Variable comms (WhatsApp/SMS/USSD) + AI", "$18k - $130k+  (usage)"),
    ]
    top = PInches(1.9); left = PInches(0.6)
    w = prs.slide_width - PInches(1.2); rh = PInches(0.62)
    tbl = slide.shapes.add_table(len(rows), 2, left, top, w, rh*len(rows)).table
    tbl.columns[0].width = PInches(8.6); tbl.columns[1].width = PInches(3.53)
    for ri, (a, b) in enumerate(rows):
        for ci, val in enumerate((a, b)):
            cell = tbl.cell(ri, ci)
            cell.text = val
            para = cell.text_frame.paragraphs[0]
            run = para.runs[0]; run.font.size = PPt(13); run.font.name = "Calibri"
            if ri == 0:
                cell.fill.solid(); cell.fill.fore_color.rgb = TEALP
                run.font.color.rgb = WHITE; run.font.bold = True
            elif "SUBTOTAL" in a:
                cell.fill.solid(); cell.fill.fore_color.rgb = PRGB(0xE6, 0xF2, 0xF2)
                run.font.bold = True; run.font.color.rgb = DARKP
            else:
                cell.fill.solid(); cell.fill.fore_color.rgb = WHITE
                run.font.color.rgb = PRGB(0x22, 0x33, 0x33)
            if ci == 1:
                para.alignment = PP_ALIGN.RIGHT

    note = slide.shapes.add_textbox(PInches(0.6), PInches(6.5), w, PInches(0.8))
    nf = note.text_frame; nf.word_wrap = True
    nf.text = ("Planning-grade estimates. At 50k, servers are the small part — setup, compliance, "
               "people and per-message comms drive the budget. Destination: AWS af-south-1 (African "
               "residency + SOC 2 fit). Comms line is highly sensitive to USSD billing model & WhatsApp template mix.")
    nr = nf.paragraphs[0].runs[0]; nr.font.size = PPt(10.5); nr.font.italic = True; nr.font.color.rgb = GREY

    prs.save(out)
    print("wrote", out)


if __name__ == "__main__":
    cmd = sys.argv[1]
    if cmd == "md2docx":
        md2docx(sys.argv[2], sys.argv[3], sys.argv[4])
    elif cmd == "budget-slide":
        budget_slide(sys.argv[2])
