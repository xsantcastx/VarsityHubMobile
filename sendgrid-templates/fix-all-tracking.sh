#!/bin/bash
# Batch-add data-analytics="false" to all SendGrid templates

for file in *.html; do
  # Skip backup files
  if [[ "$file" == *"FIXED"* ]] || [[ "$file" == *" 2.html" ]]; then
    continue
  fi
  
  # Check if file already has data-analytics on all anchors
  anchor_count=$(grep -c '<a href=' "$file" 2>/dev/null || echo 0)
  fixed_count=$(grep -c 'data-analytics="false"' "$file" 2>/dev/null || echo 0)
  
  if [ "$anchor_count" -eq "$fixed_count" ] && [ "$anchor_count" -gt 0 ]; then
    echo "✅ $file (already fixed: $anchor_count/$anchor_count)"
    continue
  fi
  
  # Create backup
  cp "$file" "$file.bak"
  
  # Fix: Add data-analytics="false" after href attribute if not present
  # Pattern 1: <a href="..." style= or target=
  sed -i '' 's|<a href="\([^"]*\)" \(style\|target\)=|<a href="\1" data-analytics="false" \2=|g' "$file"
  
  # Pattern 2: <a href="..." > (no other attributes)
  sed -i '' 's|<a href="\([^"]*\)">|<a href="\1" data-analytics="false">|g' "$file"
  
  new_fixed_count=$(grep -c 'data-analytics="false"' "$file" 2>/dev/null || echo 0)
  echo "�� $file (fixed: $new_fixed_count anchors)"
done

echo ""
echo "Summary:"
find . -name "*.html.bak" -type f | wc -l | xargs echo "  Backups created:"
