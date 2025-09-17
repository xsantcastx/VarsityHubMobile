from pathlib import Path

path = Path('app/game-details/GameDetailsScreen.tsx')
text = path.read_text()
marker = "  const [viewer, setViewer] = useState<{ visible: boolean; url: string | null; kind: 'photo' | 'video' } | null>(null);\n  const [storyBusy, setStoryBusy] = useState(false);\n\n"
if marker not in text:
    raise SystemExit('marker not found')
insert = "  const [voteSummary, setVoteSummary] = useState<VoteSummary | null>(null);\n  const [voteBusy, setVoteBusy] = useState(false);\n  const voteIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);\n\n"
text = text.replace(marker, marker + insert)
path.write_text(text)
