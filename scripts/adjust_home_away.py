from pathlib import Path

path = Path('app/game-details/GameDetailsScreen.tsx')
text = path.read_text()
needle = '      let reviewsCount: number | null = null;\n      let isPast = false;\n      let teams: TeamInfo[] = [];\n      let dateIso: string | null = null;\n      let title = \'\';\n\n      if (summary) {\n'
if needle not in text:
    raise SystemExit('needle not found')
replacement = "      let reviewsCount: number | null = null;\n      let isPast = false;\n      let teams: TeamInfo[] = [];\n      let dateIso: string | null = null;\n      let title = '';\n      let homeTeam: string | null = null;\n      let awayTeam: string | null = null;\n\n      if (summary) {\n"
text = text.replace(needle, replacement)
text = text.replace('        reviewsCount = typeof summary.reviewsCount === \'number\' ? summary.reviewsCount : null;\n        isPast = Boolean(summary.isPast);\n        teams = mapTeams(summary.teams);\n        dateIso = ensureIso(summary.date);\n        title = summary.title ?? \'\';\n', "        reviewsCount = typeof summary.reviewsCount === 'number' ? summary.reviewsCount : null;\n        isPast = Boolean(summary.isPast);\n        teams = mapTeams(summary.teams);\n        dateIso = ensureIso(summary.date);\n        title = summary.title ?? '';\n        homeTeam = summary.homeTeam ?? summary.home_team ?? null;\n        awayTeam = summary.awayTeam ?? summary.away_team ?? null;\n")
text = text.replace('        title = gameRecord.title || \'\';\n        isPast = computeIsPast(dateIso);\n', "        title = gameRecord.title || '';\n        isPast = computeIsPast(dateIso);\n        homeTeam = gameRecord.home_team || null;\n        awayTeam = gameRecord.away_team || null;\n")
text = text.replace('        description = null;\n        bannerUrl: event?.banner_url || null;\n        coverImageUrl: event?.game?.cover_image_url || null;\n        capacity: event?.capacity ?? (typeof rsvp?.capacity === \"number\" ? rsvp?.capacity : null),\n', '        description = null;\n        bannerUrl: event?.banner_url || null;\n        coverImageUrl: event?.game?.cover_image_url || null;\n        homeTeam: null,\n        awayTeam: null,\n        capacity: event?.capacity ?? (typeof rsvp?.capacity === "number" ? rsvp?.capacity : null),\n')
text = text.replace('        coverImageUrl: cover,\n        capacity: capacity ?? null,\n', '        coverImageUrl: cover,\n        homeTeam,\n        awayTeam,\n        capacity: capacity ?? null,\n')
path.write_text(text)
