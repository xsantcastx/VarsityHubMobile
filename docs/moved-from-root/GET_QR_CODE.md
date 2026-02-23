# How to Get the QR Code for Real-Time Editing

## Quick Answer: Run This in Your Terminal

Open your terminal (bottom panel in VS Code/Cursor) and run:

```bash
npx expo start --dev-client --tunnel
```

**Wait 10-15 seconds** - you'll see:
- A QR code (ASCII art)
- Connection URLs like `exp://...tunnel.exp.direct:80`

---

## Alternative: Use the Simple Command

If the above doesn't work, try:

```bash
npm run start
```

Then press `t` when asked for tunnel mode.

---

## If You Still Don't See QR Code

The QR code **only appears in your terminal** - not in my chat responses.

To make it work:

1. **Open Terminal** (View → Terminal or Cmd+`)
2. **Run the command above**
3. **Wait for QR code** (10-15 seconds)
4. **Scan with your phone** (if you have dev build) or copy the URL

---

## I Can't Show It to You Directly

The QR code is ASCII art that needs to render in your terminal. I can't capture it and display it here because:

- It's interactive output
- It needs your terminal's display
- It's generated dynamically

**You MUST run the command in your own terminal to see it.**

---

**Run this now in your terminal:**
```bash
npx expo start --dev-client --tunnel
```
