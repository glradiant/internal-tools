#!/usr/bin/env python3
"""
extract_blocks.py
-----------------
Reads DXF files and extracts every block definition as an individual SVG.
One subfolder per DXF file, named after the DXF file.

Setup:
  pip install ezdxf

Usage:
  python extract_blocks.py
"""

import os
import re
import ezdxf
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.svg import SVGBackend
from ezdxf.addons.drawing.config import Configuration
from ezdxf.addons.drawing import layout as drawing_layout

# ── CONFIGURE THESE TWO PATHS ──────────────────────────────────────────────
INPUT_DIR  = r"C:\Users\JoshDunlap\Code\glr_layout_tool\block_conversion\heater_blocks"
OUTPUT_DIR = r"C:\Users\JoshDunlap\Code\glr_layout_tool\heater_svgs"
# ───────────────────────────────────────────────────────────────────────────

# AutoCAD internal block name prefixes — always skip these
SKIP_PREFIXES = ("*", "A$", "_")

# Non-heater blocks from architectural templates — skip these too
SKIP_BLOCK_PREFIXES = (
    "I_FURN_", "I_PLUMB_", "I_ELEC_", "I_DOOR_", "I_WIN_",
    "M_BATH_", "M_Bath_",
    "AecRight", "AecLeft", "AecUp", "AecDown",
    "A3A", "A3B",
)

# Skip anonymous numbered blocks like "block 16", "block 107", etc.
SKIP_BLOCK_NUMBER = re.compile(r'^block\s+\d+$', re.IGNORECASE)


def safe_filename(name: str) -> str:
    """Convert a block name to a safe Windows filename."""
    name = re.sub(r'[\\/*?:"<>|]', "_", name)
    name = re.sub(r"[\s_]+", "_", name.strip())
    return name.strip("_")


def block_to_svg(doc, block_name: str) -> str | None:
    """
    Render a single block definition to an SVG string.
    Builds a temp doc containing all block definitions from the source,
    inserts the target block into modelspace, and renders that.
    """
    try:
        source_block = doc.blocks[block_name]
    except KeyError:
        return None

    drawable = [e for e in source_block if e.dxftype() not in ("ATTDEF", "SEQEND", "ENDBLK")]
    if not drawable:
        return None

    # Build a temp doc with all block defs copied over so INSERT references resolve
    tmp = ezdxf.new()
    tmp.units = doc.units

    # Copy layer table so colours/linetypes survive
    for layer in doc.layers:
        if layer.dxf.name not in ("0",):
            try:
                tmp.layers.new(layer.dxf.name, dxfattribs={"color": layer.dxf.get("color", 7)})
            except Exception:
                pass

    # Copy all block definitions (except model/paper space) into tmp
    skip = {"*Model_Space", "*Paper_Space"}
    for blk in doc.blocks:
        if blk.name in skip or blk.name.startswith("*Paper_Space"):
            continue
        if blk.name not in tmp.blocks:
            try:
                new_blk = tmp.blocks.new(blk.name)
                for e in blk:
                    if e.dxftype() in ("ATTDEF", "SEQEND", "ENDBLK"):
                        continue
                    try:
                        new_blk.add_entity(e.copy())
                    except Exception:
                        pass
            except Exception:
                pass

    # Insert the target block at origin in modelspace
    msp = tmp.modelspace()
    try:
        msp.add_blockref(block_name, (0, 0))
    except Exception:
        return None

    try:
        backend = SVGBackend()
        config = Configuration.defaults()
        ctx = RenderContext(tmp)
        frontend = Frontend(ctx, backend, config=config)
        config = Configuration.defaults()
        frontend.draw_layout(msp, finalize=True)
        page = drawing_layout.Page(0, 0, drawing_layout.Units.mm, margins=drawing_layout.Margins.all(0))
        svg = backend.get_string(page)
        # Remove the background rect ezdxf inserts by default
        import re as _re
        svg = _re.sub(r'<rect[^>]+fill="#[^"]*"[^>]*/>', '', svg, count=1)
        return svg if svg.strip() else None
    except Exception as e:
        print(f"    Warning: render failed for '{block_name}': {e}")
        return None


def process_dxf(dxf_path: str, output_dir: str):
    """Extract all blocks from one DXF into its output subfolder."""
    filename = os.path.splitext(os.path.basename(dxf_path))[0]
    folder = os.path.join(output_dir, safe_filename(filename))
    os.makedirs(folder, exist_ok=True)

    try:
        doc = ezdxf.readfile(dxf_path)
    except Exception as e:
        print(f"   x Could not parse DXF: {e}")
        return

    extracted = 0
    skipped = 0

    for block in doc.blocks:
        name = block.name

        if any(name.startswith(p) for p in SKIP_PREFIXES):
            skipped += 1
            continue

        if any(name.startswith(p) for p in SKIP_BLOCK_PREFIXES):
            skipped += 1
            continue

        if SKIP_BLOCK_NUMBER.match(name):
            skipped += 1
            continue

        svg = block_to_svg(doc, name)
        if svg is None:
            skipped += 1
            continue

        out_path = os.path.join(folder, safe_filename(name) + ".svg")
        with open(out_path, "w", encoding="utf-8") as f:
            f.write(svg)

        print(f"   + {name}")
        extracted += 1

    print(f"   -> {extracted} blocks exported, {skipped} skipped")


def main():
    if not os.path.isdir(INPUT_DIR):
        print(f"ERROR: INPUT_DIR does not exist:")
        print(f"  {INPUT_DIR}")
        raise SystemExit(1)

    os.makedirs(OUTPUT_DIR, exist_ok=True)

    dxf_files = sorted([
        os.path.join(INPUT_DIR, f)
        for f in os.listdir(INPUT_DIR)
        if f.lower().endswith(".dxf")
    ])

    if not dxf_files:
        print(f"No .dxf files found in {INPUT_DIR}")
        raise SystemExit(1)

    # TEMP: filter to one file for testing
    dxf_files = [f for f in dxf_files if "HL3 Series Drawings" in f]

    print(f"Found {len(dxf_files)} DXF file(s). Extracting blocks...\n")

    for dxf_path in dxf_files:
        name = os.path.splitext(os.path.basename(dxf_path))[0]
        print(f"[ {name} ]")
        process_dxf(dxf_path, OUTPUT_DIR)
        print()

    print(f"Done. SVGs written to:")
    print(f"  {OUTPUT_DIR}")


if __name__ == "__main__":
    main()