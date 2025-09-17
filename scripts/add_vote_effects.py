from pathlib import Path

path = Path('app/game-details/GameDetailsScreen.tsx')
text = path.read_text()
if 'useFocusEffect(' in text and 'refreshVotes();' in text and 'setInterval' in text:
    raise SystemExit(0)
use_effect_marker = "  useEffect(() => {\n    load();\n  }, [load]);\n\n"
if use_effect_marker not in text:
    raise SystemExit('useEffect marker missing')
addition = "  useEffect(() => {\n    refreshVotes();\n  }, [refreshVotes]);\n\n  useFocusEffect(\n    useCallback(() => {\n      refreshVotes();\n      const interval = setInterval(() => {\n        refreshVotes();\n      }, 10000);\n      return () => clearInterval(interval);\n    }, [refreshVotes]),\n  );\n\n"
text = text.replace(use_effect_marker, use_effect_marker + addition)
path.write_text(text)
