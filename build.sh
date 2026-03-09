#!/bin/bash
set -e

echo "Building GLR Internal Tools..."

# Clean output
rm -rf dist
mkdir -p dist

# Build layout tool (Vite)
echo "Building layout tool..."
cd layout-tool
npm install
npm run build
cd ..
mv layout-tool/dist dist/layout

# Copy signature builder
echo "Copying signature builder..."
mkdir -p dist/signatures
cp signature-builder/index.html dist/signatures/index.html

# Copy root landing page
echo "Copying landing page..."
cp index.html dist/index.html

# Write Netlify redirects for React client-side routing
cat > dist/_redirects << 'EOF'
# Layout tool — send all /layout/* paths to the React app
/layout/*  /layout/index.html  200

# Everything else falls through to static files
/*  /:splat  200
EOF

echo "Build complete. Output in dist/"
