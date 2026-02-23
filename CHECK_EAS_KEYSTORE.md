# Check EAS for Approved Keystore

Run this to see ALL keystores EAS has stored:

```bash
eas credentials --platform android
```

Choose: **production** → **Keystore** → Look for any keystore with SHA-1 matching:
`FD:A8:46:D4:02:0D:4F:6C:85:04:00:59:BB:1E:10:DF:50:FE:BE:AF`

If EAS shows multiple keystores, check each one's SHA-1 fingerprint.
