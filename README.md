# GLR Internal Tools

A suite of internal web applications for Great Lakes Radiant, designed to streamline workflows and improve productivity for the sales and operations teams.

## Overview

This monorepo contains three applications:

| Application | Description | Path |
|-------------|-------------|------|
| **Heater Layout Tool** | Browser-based CAD tool for designing building layouts with radiant tube heater placement | `/layout` |
| **Dashboard** | Central hub with authentication and navigation to all internal tools | `/` |
| **Email Signature Builder** | Generator for branded email signatures with live preview | `/signatures` |

## Features

### Heater Layout Tool

The primary application — a full-featured drawing tool that replaces manual AutoCAD workflows:

- **Wall Drawing** — Click to place vertices and create building footprints with real-time dimension feedback
- **Door Placement** — Add overhead and man doors with configurable width, position, and swing direction
- **Heater Placement** — Position radiant tube heaters from a catalog of 100+ models (HL3 series, straight and U-bend configurations)
- **Dimension Lines** — Automatic wall dimensions with manual measurement tool
- **Drawing Aids** — Configurable grid, snap-to-grid, north arrow, scale bar
- **Selection & Editing** — Multi-select, copy/paste, undo/redo (50 states), drag-to-move
- **PDF Export** — Professional branded layouts at print resolution (288 DPI)
- **Cloud Sync** — Auto-save to Supabase with project management (create, rename, delete)

### Dashboard

- Unified authentication for all internal tools
- Tool directory with descriptions and quick access
- Session management with automatic logout

### Email Signature Builder

- Form-based input for employee details
- Live preview for Outlook and NetSuite formats
- One-click copy to clipboard

## Tech Stack

| Category | Technologies |
|----------|--------------|
| **Frontend** | React 19, Vite 7, Tailwind CSS 4 |
| **State Management** | Zustand |
| **Backend** | Supabase (PostgreSQL, Auth, Realtime) |
| **PDF Generation** | jsPDF, html2canvas, svg2pdf.js |
| **Routing** | React Router DOM 7 |
| **Testing** | Vitest |
| **Deployment** | Netlify |

## Project Structure

```
internal-tools/
├── layout-tool/              # Heater layout application
│   ├── src/
│   │   ├── components/       # React components
│   │   │   ├── canvas/       # Drawing canvas, glyphs, layers
│   │   │   ├── sidebar/      # Tool panels, settings, pickers
│   │   │   ├── toolbar/      # Top bar, status bar
│   │   │   └── modals/       # Input overlays
│   │   ├── pages/            # Route pages (Home, Layout, Login)
│   │   ├── store/            # Zustand state store
│   │   ├── hooks/            # Custom hooks (autosave)
│   │   ├── utils/            # Geometry, export, constants
│   │   └── lib/              # Supabase client
│   ├── heater_svgs/          # Heater model SVG assets
│   └── package.json
│
├── dashboard/                # Central hub application
│   ├── src/
│   │   ├── pages/            # Dashboard, Login
│   │   └── lib/              # Supabase client
│   └── package.json
│
├── signature-builder/        # Static HTML signature generator
│   └── index.html
│
├── build.sh                  # Production build script
├── index.html                # Root landing page
└── README.md
```

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Supabase project with authentication enabled

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd internal-tools

# Install layout tool dependencies
cd layout-tool
npm install

# Install dashboard dependencies
cd ../dashboard
npm install
```

### Environment Configuration

Create `.env` files in both `layout-tool/` and `dashboard/` directories:

```env
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### Development

Run each application in a separate terminal:

```bash
# Layout tool (http://localhost:5173/layout)
cd layout-tool
npm run dev

# Dashboard (http://localhost:5174)
cd dashboard
npm run dev
```

### Building for Production

```bash
# Build all applications
./build.sh

# Output structure:
# dist/
# ├── index.html          (dashboard)
# ├── layout/             (layout tool)
# ├── signatures/         (signature builder)
# └── _redirects          (Netlify routing)
```

### Linting

```bash
cd layout-tool && npm run lint
cd ../dashboard && npm run lint
```

### Testing

```bash
cd layout-tool
npm run test
```

## Database Schema

The application uses Supabase with the following primary table:

### `layouts`

| Column | Type | Description |
|--------|------|-------------|
| `id` | UUID | Primary key |
| `project_name` | text | Layout project name |
| `customer_name` | text | Customer name |
| `customer_address` | text | Site address |
| `prepared_by` | text | Sales rep name |
| `quote_number` | text | Associated quote number |
| `date` | date | Project date |
| `layout_json` | jsonb | Complete layout geometry (walls, doors, heaters, dimensions) |
| `user_id` | UUID | Owner (foreign key to auth.users) |
| `created_at` | timestamp | Creation timestamp |
| `updated_at` | timestamp | Last modified timestamp |

Row-level security ensures users can only access their own layouts.

## Deployment

The application is configured for Netlify deployment:

1. Connect the repository to Netlify
2. Set build command: `./build.sh`
3. Set publish directory: `dist`
4. Add environment variables in Netlify dashboard
5. Deploy

The `_redirects` file handles client-side routing for the React SPAs.

## Key Components

### State Management

The layout tool uses Zustand for centralized state management (`useLayoutStore.js`):

- **Entities**: walls, doors, heaters, dimension lines
- **UI State**: selected items, active tool, view settings
- **History**: undo/redo stacks (50 state limit)
- **Clipboard**: copy/paste buffer for multi-item operations

### Drawing Engine

The SVG-based canvas (`DrawingCanvas.jsx`) handles:

- Real-time drawing with snap-to-grid (20px = 1 foot)
- Pan and zoom (0.3x to 6x)
- Multi-select with Shift/Ctrl modifiers
- Drag operations for repositioning
- Two-click workflows for doors and dimensions

### Heater Catalog

Dynamic loading system (`heaterCatalog.js`) that:

- Scans `heater_svgs/` folder structure at build time
- Parses Series → Type → Length → Model hierarchy
- Extracts dimensions and metadata from SVG files
- Provides nested tree structure for the UI picker

## License

Internal use only. Proprietary to Great Lakes Radiant.
