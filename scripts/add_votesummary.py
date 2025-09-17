from pathlib import Path

path = Path('app/game-details/GameDetailsScreen.tsx')
text = path.read_text()
if 'type VoteSummary = {' in text:
    raise SystemExit(0)
marker = "type SectionKey = 'overview' | 'media' | 'posts';\n\n"
if marker not in text:
    raise SystemExit('marker not found')
insert = "type VoteSummary = {\n  teamA: number;\n  teamB: number;\n  total: number;\n  pctA: number;\n  pctB: number;\n  userVote: \"A\" | \"B\" | null;\n};\n\n"
text = text.replace(marker, marker + insert)
path.write_text(text)
