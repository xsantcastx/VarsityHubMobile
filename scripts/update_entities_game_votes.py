from pathlib import Path
from textwrap import dedent

path = Path(r"src/api/entities.ts")
text = path.read_text()

text = text.replace("import { httpGet, httpPost, httpPut, httpPatch } from './http';", "import { httpGet, httpPost, httpPut, httpPatch, httpDelete } from './http';")

if "votesSummary:" not in text:
    marker = "  media: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/media`),\n"
    if marker not in text:
        raise SystemExit('media marker not found')
    replacement = dedent("""  media: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/media`),\n  votesSummary: (id: string) => httpGet(`/games/${encodeURIComponent(id)}/votes/summary`),\n  castVote: (id: string, team: 'A' | 'B') => httpPost(`/games/${encodeURIComponent(id)}/votes`, { team }),\n  clearVote: (id: string) => httpDelete(`/games/${encodeURIComponent(id)}/votes`),\n""")
    text = text.replace(marker, replacement, 1)

path.write_text(text)
