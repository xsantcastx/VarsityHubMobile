from pathlib import Path
from textwrap import dedent

path = Path(r"server/prisma/schema.prisma")
text = path.read_text()

if "enum TeamChoice" in text:
    import re
    text = re.sub(r"enum TeamChoice \{[\s\S]*?\}\s*", "", text, count=1)

text = text.replace("choice     TeamChoice", "team       String")
text = text.replace("  created_at DateTime   @default(now())\n\n  game Game @relation(fields: [game_id], references: [id], onDelete: Cascade)\n  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)\n\n  @@unique([game_id, user_id])\n  @@index([game_id, created_at])\n}\n", dedent('''  created_at DateTime @default(now())
  updated_at DateTime @updatedAt

  game Game @relation(fields: [game_id], references: [id], onDelete: Cascade)
  user User @relation(fields: [user_id], references: [id], onDelete: Cascade)

  @@unique([game_id, user_id])
  @@index([game_id, team])
}
'''))

path.write_text(text)
