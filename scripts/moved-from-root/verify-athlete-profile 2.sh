#!/bin/bash
# Quick test script to verify athlete profile features

echo "🔍 Verifying Athlete Profile Implementation..."
echo ""

# Check JerseyBadge component exists
if [ -f "components/JerseyBadge.tsx" ]; then
  echo "✅ JerseyBadge component exists"
else
  echo "❌ JerseyBadge component missing"
fi

# Check profile.tsx has import
if grep -q "import.*JerseyBadge" app/profile.tsx; then
  echo "✅ profile.tsx imports JerseyBadge"
else
  echo "❌ profile.tsx missing JerseyBadge import"
fi

# Check for athlete logic
if grep -q "isAthlete" app/profile.tsx; then
  echo "✅ profile.tsx has athlete detection logic"
else
  echo "❌ profile.tsx missing athlete logic"
fi

# Check backend schema
if grep -q "grade_level" server/src/routes/auth.ts; then
  echo "✅ Backend has athlete fields"
else
  echo "❌ Backend missing athlete fields"
fi

# Check edit-profile form
if grep -q "gradeLevel" app/edit-profile.tsx; then
  echo "✅ Edit form has athlete fields"
else
  echo "❌ Edit form missing athlete fields"
fi

echo ""
echo "📝 To see athlete features:"
echo "1. Go to Edit Profile"
echo "2. Scroll to 'Team Member Info'"  
echo "3. Enter a Position (e.g., 'Point Guard')"
echo "4. Enter a Jersey Number (e.g., '23')"
echo "5. Fill in Athlete Details below"
echo "6. Save"
echo "7. Return to Profile - you should see:"
echo "   - Jersey badge (top-right)"
echo "   - Position badge below name"
echo "   - Athletic credentials"
echo ""
echo "🔄 If still not visible, try: Cmd+R in simulator to reload"
