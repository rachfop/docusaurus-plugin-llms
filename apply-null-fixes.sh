#!/bin/bash

# Script to apply null/undefined handling standardization
# This applies all fixes in a single operation to avoid issues with file watchers

echo "Applying null/undefined handling standardization..."

# Fix 1: processor.ts - Frontmatter validation
sed -i.bak '52s/if (data.title !== undefined && typeof data.title === '\''string'\'') {/if (data.title !== undefined \&\& data.title !== null \&\& typeof data.title === '\''string'\'') {/' src/processor.ts
sed -i.bak '53s/if (!data.title.trim()) {/if (data.title.trim() === '\'''\'') {/' src/processor.ts

sed -i.bak '59s/if (data.description !== undefined && typeof data.description === '\''string'\'') {/if (data.description !== undefined \&\& data.description !== null \&\& typeof data.description === '\''string'\'') {/' src/processor.ts
sed -i.bak '60s/if (!data.description.trim()) {/if (data.description.trim() === '\'''\'') {/' src/processor.ts

sed -i.bak '65s/if (data.slug !== undefined && typeof data.slug === '\''string'\'') {/if (data.slug !== undefined \&\& data.slug !== null \&\& typeof data.slug === '\''string'\'') {/' src/processor.ts
sed -i.bak '66s/if (!data.slug.trim()) {/if (data.slug.trim() === '\'''\'') {/' src/processor.ts

sed -i.bak '71s/if (data.id !== undefined && typeof data.id === '\''string'\'') {/if (data.id !== undefined \&\& data.id !== null \&\& typeof data.id === '\''string'\'') {/' src/processor.ts
sed -i.bak '72s/if (!data.id.trim()) {/if (data.id.trim() === '\'''\'') {/' src/processor.ts

# Fix 2: processor.ts - resolvedUrl check
sed -i.bak '86s/if (resolvedUrl) {/if (resolvedUrl !== undefined \&\& resolvedUrl !== null) {/' src/processor.ts

# Fix 3: processor.ts - pathPrefix check
sed -i.bak '121s/if (pathPrefix && pathTransformation?.ignorePaths?.includes(pathPrefix)) {/if (pathPrefix !== undefined \&\& pathPrefix !== null \&\& pathPrefix !== '\'''\'' \&\& pathTransformation?.ignorePaths?.includes(pathPrefix)) {/' src/processor.ts

# Fix 4: processor.ts - description check
sed -i.bak '170s/if (data.description) {/if (data.description !== undefined \&\& data.description !== null \&\& typeof data.description === '\''string'\'' \&\& data.description.trim() !== '\'''\'') {/' src/processor.ts

# Fix 5: processor.ts - description processing check
sed -i.bak '195s/if (description) {/if (description !== undefined \&\& description !== null \&\& description !== '\'''\'') {/' src/processor.ts

# Fix 6: processor.ts - includeUnmatched check
sed -i.bak '330s/if (includeUnmatched) {/if (includeUnmatched === true) {/' src/processor.ts

# Fix 7: processor.ts - routeMap check
sed -i.bak '350s/if (context.routeMap) {/if (context.routeMap !== undefined \&\& context.routeMap !== null) {/' src/processor.ts

# Fix 8: processor.ts - resolvedUrl checks in route matching
sed -i.bak '371s/if (!resolvedUrl) {/if (resolvedUrl === undefined) {/' src/processor.ts
sed -i.bak '390s/if (!resolvedUrl) {/if (resolvedUrl === undefined) {/' src/processor.ts
sed -i.bak '407s/if (resolvedUrl) break;/if (resolvedUrl !== undefined) break;/' src/processor.ts
sed -i.bak '413s/if (!resolvedUrl && context.routesPaths) {/if (resolvedUrl === undefined \&\& context.routesPaths !== undefined \&\& context.routesPaths !== null) {/' src/processor.ts
sed -i.bak '421s/if (matchingRoute) {/if (matchingRoute !== undefined \&\& matchingRoute !== null) {/' src/processor.ts
sed -i.bak '428s/if (resolvedUrl && resolvedUrl !== /if (resolvedUrl !== undefined \&\& resolvedUrl !== null \&\& resolvedUrl !== /' src/processor.ts

# Clean up backup files
rm src/processor.ts.bak 2>/dev/null || true

echo "Fixes applied successfully!"
echo "Running build to verify..."
npm run build
