from pathlib import Path

path = Path('app/game-details/GameDetailsScreen.tsx')
text = path.read_text()
marker = "type VoteSummary = {\n  teamA: number;\n  teamB: number;\n  total: number;\n  pctA: number;\n  pctB: number;\n  userVote: \"A\" | \"B\" | null;\n};\n\n"
if marker not in text:
    raise SystemExit('marker missing')
if 'type VoteOption' in text:
    raise SystemExit(0)
helpers = """type VoteOption = 'A' | 'B';\n\nconst buildVoteSummary = (teamA: number, teamB: number, userVote: VoteOption | null): VoteSummary => {\n  const safeA = Math.max(0, teamA);\n  const safeB = Math.max(0, teamB);\n  const total = safeA + safeB;\n  const pctA = total ? Math.round((safeA / total) * 100) : 0;\n  const pctB = total ? 100 - pctA : 0;\n  return { teamA: safeA, teamB: safeB, total, pctA, pctB, userVote };\n};\n\nconst parseVoteSummary = (payload: any): VoteSummary => {\n  const teamA = typeof payload?.teamA === 'number' ? payload.teamA : 0;\n  const teamB = typeof payload?.teamB === 'number' ? payload.teamB : 0;\n  const userVote: VoteOption | null = payload?.userVote === 'A' || payload?.userVote === 'B' ? payload.userVote : null;\n  return buildVoteSummary(teamA, teamB, userVote);\n};\n\n"""
text = text.replace(marker, marker + helpers)
path.write_text(text)
