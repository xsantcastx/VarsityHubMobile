#!/bin/bash

# Queue Monitoring Dashboard
# Run this to see real-time queue statistics

clear
echo "📊 Email Queue Dashboard"
echo "======================="
echo ""
echo "Press Ctrl+C to exit"
echo ""

while true; do
  # Move cursor to top
  tput cup 3 0
  
  echo "🕐 $(date '+%Y-%m-%d %H:%M:%S')"
  echo ""
  echo "Queue Statistics:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  WAITING=$(redis-cli LLEN bull:email:wait 2>/dev/null || echo "0")
  ACTIVE=$(redis-cli LLEN bull:email:active 2>/dev/null || echo "0")
  COMPLETED=$(redis-cli ZCARD bull:email:completed 2>/dev/null || echo "0")
  FAILED=$(redis-cli ZCARD bull:email:failed 2>/dev/null || echo "0")
  DELAYED=$(redis-cli ZCARD bull:email:delayed 2>/dev/null || echo "0")
  
  echo "  ⏳ Waiting:   $WAITING"
  echo "  ⚡ Active:    $ACTIVE"
  echo "  ✅ Completed: $COMPLETED"
  echo "  ❌ Failed:    $FAILED"
  echo "  ⏰ Delayed:   $DELAYED (payment reminders)"
  echo ""
  
  # Check Redis connection
  REDIS_STATUS=$(redis-cli ping 2>/dev/null)
  if [ "$REDIS_STATUS" = "PONG" ]; then
    echo "  🟢 Redis: Connected"
  else
    echo "  🔴 Redis: Disconnected"
  fi
  
  # Check backend
  BACKEND_STATUS=$(curl -s -o /dev/null -w "%{http_code}" http://localhost:4000/health 2>/dev/null)
  if [ "$BACKEND_STATUS" = "200" ]; then
    echo "  🟢 Backend: Running (port 4000)"
  else
    echo "  🔴 Backend: Not responding"
  fi
  
  echo ""
  echo "Recent Job Activity:"
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  
  # Show recent completed jobs (last 3)
  RECENT=$(redis-cli ZREVRANGE bull:email:completed 0 2 WITHSCORES 2>/dev/null)
  if [ -n "$RECENT" ]; then
    echo "$RECENT" | while read -r job_id && read -r timestamp; do
      # Convert timestamp to readable date
      READABLE_DATE=$(date -r "${timestamp%.*}" '+%H:%M:%S' 2>/dev/null || echo "$timestamp")
      echo "  ✓ Completed at $READABLE_DATE"
    done
  else
    echo "  (no completed jobs yet)"
  fi
  
  echo ""
  echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
  echo "Refreshing in 2 seconds..."
  
  sleep 2
done
