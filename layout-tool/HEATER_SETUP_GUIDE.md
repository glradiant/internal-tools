# Heater Series Setup Guide

This guide explains the complete process for adding new heater series to the layout tool, including extracting heater blocks from CAD files, organizing SVGs, creating specs files, and integrating with the catalog system.

## Overview

The layout tool's heater catalog system consists of three main components:

1. **SVG Files** - Visual representations of heaters, extracted from DXF/DWG CAD files
2. **Specs Files** - JSON data files containing technical specifications (BTU, watts, clearances, etc.)
3. **Heater Catalog** - JavaScript module that combines SVGs and specs into a browsable tree

---

## Part 1: Extracting Heater Blocks from CAD Files

### Prerequisites

```bash
pip install ezdxf
```

### Step 1: Obtain CAD Files

- Get DXF files from the manufacturer or engineering team
- DXF files contain heater drawings as either **blocks** (named definitions) or **groups** (collections of entities)
- Place DXF files in: `layout-tool/block_conversion/heater_blocks/`

### Step 2: Run the Extraction Script

```bash
cd layout-tool/block_conversion
python extract_blocks.py
```

The script will:
- Read all DXF files from `heater_blocks/`
- Extract named blocks and large groups (50+ entities)
- Output SVG files to `layout-tool/heater_svgs/`
- Create one subfolder per DXF file

### Step 3: Organize SVG Files

After extraction, organize SVGs into the standard folder structure:

```
heater_svgs/
├── {SERIES}_Series_Drawings/     # e.g., HL3_Series_Drawings
│   ├── Straight/                 # Gas tube heaters - straight configuration
│   │   ├── 20ft/
│   │   │   ├── HL3-20-65.svg
│   │   │   └── HL3-20-75.svg
│   │   ├── 30ft/
│   │   └── ...
│   └── U-Bend/                   # Gas tube heaters - U-bend configuration
│       ├── 20ft/
│       │   ├── HL3-20U-65.svg
│       │   └── HL3-20U-75.svg
│       └── ...
└── ELX_Series_Drawings/          # Electric heaters use different structure
    ├── 24in/
    │   ├── ELX-24-1.svg          # 1-lamp
    │   ├── ELX-24-2.svg          # 2-lamp
    │   └── ELX-24-3.svg          # 3-lamp
    └── ...
```

### File Naming Conventions

**Important:** SVG files represent the *physical drawing* only. BTU ratings, wattages, and other variants are generated from the specs file. One SVG per unique physical size.

**Gas Tube Heaters (HL3, LD3, etc.):**
```
{SERIES}-{LENGTH}{U?}.svg

Examples:
- HL3-20.svg   → HL3 series, 20ft straight (all BTU variants share this SVG)
- HL3-30U.svg  → HL3 series, 30ft U-bend (all BTU variants share this SVG)
- LD3-15.svg   → LD3 series, 15ft straight
```

**Electric Heaters (ELX):**
```
ELX-{LENGTH_INCHES}-{LAMP_COUNT}.svg

Examples:
- ELX-24-1.svg  → ELX 24" with 1 lamp (all voltage/wattage variants share this SVG)
- ELX-33-2.svg  → ELX 33" with 2 lamps
- ELX-46-3.svg  → ELX 46" with 3 lamps
```

**Key Concept:** The catalog system reads each SVG once, then generates multiple models from the specs file. For example:
- `HL3-20.svg` + specs → HL3 20' 65kBTU, HL3 20' 75kBTU
- `ELX-24-1.svg` + specs → ELX 24" 120V SW 1500W, ELX 24" 208V MW 750W, etc.

---

## Part 2: Creating Specs Files

Specs files are JSON files in `src/data/` that contain technical specifications for each heater series.

### Required Information from User/Manufacturer

You will need to gather this information from spec sheets, installation manuals, or the manufacturer:

#### For Gas Heaters (HL3, LD3, etc.):

| Data | Description | Where to Find |
|------|-------------|---------------|
| BTU ratings (high/low fire) | Maximum and minimum BTU/h output | Specifications chart |
| Straight/U-tube lengths | Physical lengths in feet-inches | Specifications chart |
| Weights | Standard and stainless steel weights | Specifications chart |
| Mounting heights | Recommended min/max in feet | Specifications chart |
| Materials | Combustion chamber and emitter materials (Alum/Titan) | Specifications chart |
| Gas requirements | Manifold pressure, inlet pressure ranges | Gas requirements chart |
| Electrical requirements | Voltage, current (starting/running) | Electrical requirements section |
| Clearances to combustibles | Distances at various mounting angles and shield configurations | Clearances chart |
| Special notes | Tube clamp requirements, accessory packages needed | Footnotes |

#### For Electric Heaters (ELX):

| Data | Description | Where to Find |
|------|-------------|---------------|
| Wattage per lamp type | Watts for SW/HO/MW at each voltage | Electrical specifications chart |
| BTU equivalent | BTU output (watts × 3.412) | Can be calculated or from chart |
| Amperage | Current draw at each voltage | Electrical specifications chart |
| Clearances | Distances by lamp count and length | Clearances chart |
| Lamp types available | Which lamp types (SW/HO/MW) available per configuration | Electrical specifications chart |

### Specs File Templates

#### Gas Heater Template (HL3/LD3 style):

```json
{
  "series": "XX3",
  "fuelType": "gas",
  "description": "XX3 Series Gas Tube Heaters",
  "gasType": "Natural or Propane",
  "gasRequirements": {
    "natural": {
      "manifoldPressure": 3.5,
      "minInletPressure": 5.0,
      "maxInletPressure": 14.0,
      "unit": "Inches W.C."
    },
    "propane": {
      "manifoldPressure": 10.0,
      "minInletPressure": 11.0,
      "maxInletPressure": 14.0,
      "unit": "Inches W.C."
    }
  },
  "electricalRequirements": {
    "voltage": "120 VAC",
    "frequency": "60 Hz",
    "wiring": "GND, 3-wire",
    "thermostat": "24 VAC",
    "startingCurrent": 4.8,
    "runningCurrent": 1.1,
    "currentUnit": "amps"
  },
  "notes": {
    "tubeClamp": "Description of tube clamp requirements if any",
    "uBendAccessory": "Description of U-bend accessory requirements if any",
    "mountingHeight": "Notes about mounting height guidelines",
    "materials": {
      "Alum": "Black coated aluminized treated steel",
      "Titan": "Black coated titanium stabilized aluminized steel"
    }
  },
  "models": {
    "20": {
      "straightLengthFtIn": "21'-9\"",
      "uTubeLengthFtIn": "13'-1\"",
      "65": {
        "kbtuHigh": 65,
        "kbtuLow": 50,
        "weightStandard": 120,
        "weightStainless": null,
        "mountingHeightMin": 9,
        "mountingHeightMax": 14,
        "combustionChamber": "Alum",
        "radiantEmitter": "Alum",
        "baffleQty36": 5
      },
      "75": { ... }
    },
    "30": { ... }
  },
  "clearances": {
    "note": "Clearances to combustibles in inches.",
    "65-75": {
      "description": "XX3 (20, 30, 40) - (65, 75) [N, P]",
      "tubeLengths": [20, 30, 40],
      "kbtuRatings": [65, 75],
      "configurations": {
        "0deg": { "mountingAngle": 0, "sideFront": 9, "sideBehind": 9, "top": 6, "below": 60 },
        "45deg": { "mountingAngle": 45, "sideFront": 39, "sideBehind": 8, "top": 10, "below": 60 },
        "1SideShield": { "mountingAngle": 0, "sideFront": 29, "sideBehind": 8, "top": 6, "below": 60 },
        "2SideShields": { "mountingAngle": 0, "sideFront": 9, "sideBehind": 9, "top": 6, "below": 60 },
        "20ftFromBurner": { "mountingAngle": 0, "sideFront": 7, "sideBehind": 7, "top": 6, "below": 30 }
      }
    }
  }
}
```

#### Electric Heater Template (ELX style):

```json
{
  "series": "ELX",
  "fuelType": "electric",
  "description": "ELX Electric Infrared Heaters",
  "ELX": {
    "24": {
      "1": {
        "120V": {
          "SW": { "watts": 1500, "btu": 5118, "amps": 12.50 },
          "HO": { "watts": 1360, "btu": 4641, "amps": 11.30 },
          "MW": { "watts": 750, "btu": 2559, "amps": 6.25 }
        },
        "208V": { ... },
        "240V": { ... },
        "277V": { ... },
        "480V": { ... }
      },
      "2": { ... },
      "3": { ... }
    },
    "33": { ... },
    "46": { ... }
  },
  "lampTypes": {
    "SW": "Short Wave",
    "HO": "H.O. Medium Wave",
    "MW": "Medium Wave"
  },
  "clearances": {
    "note": "All clearances in inches except minMountingHeightFt (feet)",
    "1": {
      "24": { "mountingAngle": 0, "front": 16, "behind": 16, "end": 12, "top": 6, "below": 56, "minMountingHeightFt": 6 },
      "33": { ... },
      "46": { ... }
    },
    "2": { ... },
    "3": { ... }
  }
}
```

---

## Part 3: Integrating with the Catalog System

### Step 1: Add the Specs Import

Edit `src/utils/heaterCatalog.js`:

```javascript
// Add import at the top
import newSeriesSpecs from '../data/newSeriesSpecs.json';

// Add to seriesSpecs map
const seriesSpecs = {
  ELX: elxSpecs,
  HL3: hl3Specs,
  LD3: ld3Specs,
  NEW: newSeriesSpecs,  // Add new series
};
```

### Step 2: Handle Special Naming/Structure (if needed)

If your new series has a unique naming convention or folder structure different from the standard gas heater pattern, you may need to add special handling in `buildHeaterCatalog()`.

The ELX electric heater is an example of special handling - see lines 64-152 in `heaterCatalog.js`.

### Step 3: Verify the Catalog Loads

Start the dev server and check the browser console for catalog output:

```bash
npm run dev
```

Look for: `Heater Catalog loaded: { categories: [...], totalModels: X, ... }`

---

## What's Already in the Codebase

### Existing Specs Files

| File | Series | Type | Status |
|------|--------|------|--------|
| `src/data/elxSpecs.json` | ELX | Electric | Complete |
| `src/data/hl3Specs.json` | HL3 | Gas | Complete |
| `src/data/ld3Specs.json` | LD3 | Gas | Complete |

### Existing SVG Files

Located in `heater_svgs/`:
- `ELX_Series_Drawings/` - 9 SVGs (24", 33", 46" × 1-3 lamps) → generates 60+ model variants
- `HL3_Series_Drawings/` - 12 SVGs (20-70ft × Straight/U-Bend) → generates 42 model variants
- `LD3_Series_Drawings/` - 5 SVGs (15-30ft × Straight/U-Bend) → generates 9 model variants

### Catalog System Files

| File | Purpose |
|------|---------|
| `src/utils/heaterCatalog.js` | Main catalog builder - combines SVGs + specs |
| `src/utils/constants.js` | Grid scale, heater scale factors |
| `src/components/sidebar/HeaterModelPicker.jsx` | UI for browsing/selecting heaters |

---

## Adding a New Heater Series - Checklist

### SVG Setup
1. [ ] Obtain DXF files from manufacturer
2. [ ] Place DXFs in `block_conversion/heater_blocks/`
3. [ ] Run `python extract_blocks.py`
4. [ ] **Consolidate SVGs** - keep ONE per unique physical size (remove BTU duplicates)
5. [ ] Rename SVGs to follow naming convention:
   - Gas: `{SERIES}-{LENGTH}.svg` or `{SERIES}-{LENGTH}U.svg`
   - Electric: `{SERIES}-{LENGTH}-{LAMPCOUNT}.svg`
6. [ ] Organize into folder structure: `{SERIES}_Series_Drawings/Type/Length/`

### Specs Setup
7. [ ] Gather specs from manufacturer documentation:
   - [ ] BTU/wattage ratings (all variants per size)
   - [ ] Physical dimensions
   - [ ] Weights
   - [ ] Mounting heights
   - [ ] Gas/electrical requirements
   - [ ] Clearances to combustibles
8. [ ] Create `src/data/{series}Specs.json` using appropriate template
9. [ ] Add import to `heaterCatalog.js` and register in `seriesSpecs` map
10. [ ] Add processing function if naming differs from HL3/LD3/ELX patterns

### Testing
11. [ ] Test catalog loading in dev mode (check console for model count)
12. [ ] Verify heaters appear in model picker with all variants
13. [ ] Test placing heaters on canvas
14. [ ] Test PDF export with heater labels

---

## Troubleshooting

### SVGs not appearing in catalog

1. Check console for errors
2. Verify folder structure matches expected pattern
3. Ensure SVG filenames follow naming convention
4. Check that Vite's glob import can find the files

### Specs not loading

1. Verify JSON is valid (use a JSON validator)
2. Check import path in `heaterCatalog.js`
3. Ensure series name in `seriesSpecs` map matches folder prefix

### Heater displays incorrectly

1. Check SVG viewBox dimensions
2. Verify `dimensions` extraction is working
3. Check `HEATER_SCALE` in constants.js
4. May need to adjust aspect ratio

### BTU/watts showing wrong values

1. Verify specs file has correct values
2. Check `extractKbtu()` function in heaterCatalog.js
3. For electric heaters, verify the voltage/lamp type lookup path

---

## Contact

For questions about heater specifications, contact the engineering or sales team.
For questions about the layout tool code, refer to the codebase or ask the dev team.
