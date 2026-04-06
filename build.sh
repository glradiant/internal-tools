#!/bin/bash
set -e

echo "Building GLR Internal Tools..."

# Clean output
rm -rf dist
mkdir -p dist

# Build dashboard (root app with auth)
echo "Building dashboard..."
cd dashboard
npm install
npm run build
cd ..
# Move dashboard build to dist root
cp -r dashboard/dist/* dist/

# Copy signature builder
echo "Copying signature builder..."
mkdir -p dist/signatures
cp signature-builder/index.html dist/signatures/index.html

# Write Netlify redirects for React client-side routing
cat > dist/_redirects << 'EOF'
# Domain redirect — .us to .com
https://internal.glradiant.us/* https://internal.glradiant.com/:splat 301!

# Layout tool — redirect to standalone subdomain
/layout/*  https://layout.glradiant.com/:splat 301!

# Signatures — static, no redirect needed

# Dashboard (root) — send all other paths to root index for React routing
/*  /index.html  200
EOF

echo "Build complete. Output in dist/"
