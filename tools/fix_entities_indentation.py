from pathlib import Path

path = Path(r"src/api/entities.ts")
text = path.read_text()
bad_block = "media: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/media`),\nvotesSummary: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/votes/summary`),\ncastVote: (id: string, team: 'A' | 'B') => httpPost(`/games/${encodeURIComponent(id)}/votes`, { team }),\nclearVote: (id: string) => httpDelete(`/games/${encodeURIComponent(id)}/votes`),\n"
good_block = "  media: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/media`),\n  votesSummary: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/votes/summary`),\n  castVote: (id: string, team: 'A' | 'B') => httpPost(`/games/${encodeURIComponent(id)}/votes`, { team }),\n  clearVote: (id: string) => httpDelete(`/games/${encodeURIComponent(id)}/votes`),\n"
if bad_block in text:
    text = text.replace(bad_block, good_block)
else:
    raise SystemExit('block not found for indentation fix')
path.write_text(text)
