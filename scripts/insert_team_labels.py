from pathlib import Path

path = Path('app/game-details/GameDetailsScreen.tsx')
text = path.read_text()
if 'teamALabel' in text:
    raise SystemExit(0)
marker = '  const showRsvp = !!vm?.eventId && !vm?.isPast;\n\n'
if marker not in text:
    raise SystemExit('marker not found for team labels')
addition = "  const { teamALabel, teamBLabel } = useMemo(() => {\n    const home = vm?.homeTeam?.trim();\n    const away = vm?.awayTeam?.trim();\n    if (home && away) return { teamALabel: home, teamBLabel: away };\n    const title = (vm?.title || '').replace(/\\s+/g, ' ').trim();\n    if (title) {\n      const parts = title.split(/\\s+vs\\.?\\s+/i).map((part) => part.trim()).filter(Boolean);\n      if (parts.length >= 2) {\n        return { teamALabel: parts[0], teamBLabel: parts[1] };\n      }\n    }\n    return { teamALabel: 'Team A', teamBLabel: 'Team B' };\n  }, [vm?.homeTeam, vm?.awayTeam, vm?.title]);\n\n"
text = text.replace(marker, marker + addition)
path.write_text(text)
