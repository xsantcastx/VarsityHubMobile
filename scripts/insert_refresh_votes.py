from pathlib import Path

path = Path('app/game-details/GameDetailsScreen.tsx')
text = path.read_text()
if 'const refreshVotes = useCallback' in text:
    raise SystemExit(0)
marker = "  const handleAddStory = useCallback(async () => {\n    if (!vm?.gameId || storyBusy) return;\n    try {\n      setStoryBusy(true);\n      const pickerOptions: any = {\n        quality: 0.9,\n      };\n"
if marker not in text:
    raise SystemExit('marker not found')
insertion_point = text.index(marker)
# place refreshVotes before load definition
load_marker = "  const load = useCallback(\n    async (isRefresh = false) => {"
if load_marker not in text:
    raise SystemExit('load marker missing')
idx = text.index(load_marker)
refresh_block = "  const refreshVotes = useCallback(async () => {\n    if (!vm?.gameId) {\n      setVoteSummary(null);\n      return;\n    }\n    try {\n      const res: any = await Game.votesSummary(vm.gameId);\n      setVoteSummary(parseVoteSummary(res));\n    } catch (err) {\n      console.warn('Failed to load game votes', err);\n    }\n  }, [vm?.gameId]);\n\n"
text = text[:idx] + refresh_block + text[idx:]
path.write_text(text)
