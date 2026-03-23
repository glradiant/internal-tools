#!/usr/bin/env python3
"""Extract Heater Builder component SVGs from DXF files."""

import os
import re
import ezdxf
from ezdxf.addons.drawing import RenderContext, Frontend
from ezdxf.addons.drawing.svg import SVGBackend
from ezdxf.addons.drawing.config import Configuration
from ezdxf.addons.drawing import layout as drawing_layout

BUILDER_DIR = os.path.join(os.path.dirname(__file__), "heater_blocks", "Heater Builder")
OUTPUT_DIR = os.path.join(os.path.dirname(__file__), "..", "heater_svgs", "LS3_Builder_Parts")


def block_to_svg(doc, block_name):
    try:
        source_block = doc.blocks[block_name]
    except KeyError:
        return None

    drawable = [e for e in source_block if e.dxftype() not in ("ATTDEF", "SEQEND", "ENDBLK")]
    if not drawable:
        return None

    tmp = ezdxf.new()
    tmp.units = doc.units

    for layer in doc.layers:
        if layer.dxf.name not in ("0",):
            try:
                tmp.layers.new(layer.dxf.name, dxfattribs={"color": layer.dxf.get("color", 7)})
            except Exception:
                pass

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
        frontend.draw_layout(msp, finalize=True)
        page = drawing_layout.Page(0, 0, drawing_layout.Units.mm, margins=drawing_layout.Margins.all(0))
        svg = backend.get_string(page)
        svg = re.sub(r'<rect[^>]+fill="#[^"]*"[^>]*/>', "", svg, count=1)
        return svg if svg.strip() else None
    except Exception as e:
        print(f"  Warning: render failed for '{block_name}': {e}")
        return None


def main():
    os.makedirs(OUTPUT_DIR, exist_ok=True)

    # Extract tube and burner parts from the straight DXF
    straight_dxf = os.path.join(BUILDER_DIR, "10'_Straight_PV.dxf")
    doc = ezdxf.readfile(straight_dxf)

    targets = {
        "4 in - 5 ft Tube": "5ft_Tube.svg",
        "4 in - 10 ft Tube": "10ft_Tube.svg",
        "4 in BURNER BOX": "LS3_Burner_Box.svg",
        "BURNER BOX": "Burner_Box_Alt.svg",
        "4 in - 10 ft Assy": "LS3_10ft_Assy.svg",
        "4 in - 10 ft Tube-RR": "10ft_Tube_RR.svg",
    }

    for block_name, filename in targets.items():
        svg = block_to_svg(doc, block_name)
        if svg:
            path = os.path.join(OUTPUT_DIR, filename)
            with open(path, "w", encoding="utf-8") as f:
                f.write(svg)
            print(f"+ {block_name} -> {filename}")
        else:
            print(f"x {block_name} failed")

    # Extract REP (90-degree turn) from REP_PV.dxf
    rep_dxf = os.path.join(BUILDER_DIR, "REP_PV.dxf")
    doc2 = ezdxf.readfile(rep_dxf)
    svg = block_to_svg(doc2, "REP")
    if svg:
        with open(os.path.join(OUTPUT_DIR, "REP_90.svg"), "w", encoding="utf-8") as f:
            f.write(svg)
        print("+ REP -> REP_90.svg")

    # Also extract the SS variant
    svg = block_to_svg(doc2, "REP-SS - Up")
    if svg:
        with open(os.path.join(OUTPUT_DIR, "REP_SS_90.svg"), "w", encoding="utf-8") as f:
            f.write(svg)
        print("+ REP-SS - Up -> REP_SS_90.svg")

    # Extract RUP (180-degree turn) from RUP_PV.dxf
    rup_dxf = os.path.join(BUILDER_DIR, "RUP_PV.dxf")
    doc3 = ezdxf.readfile(rup_dxf)

    for name, filename in [
        ("RUP - Up", "RUP_180.svg"),
        ("RUP-SS - Up", "RUP_SS_180.svg"),
    ]:
        svg = block_to_svg(doc3, name)
        if svg:
            with open(os.path.join(OUTPUT_DIR, filename), "w", encoding="utf-8") as f:
                f.write(svg)
            print(f"+ {name} -> {filename}")
        else:
            print(f"x {name} failed")

    print(f"\nDone! SVGs written to: {OUTPUT_DIR}")


if __name__ == "__main__":
    main()
