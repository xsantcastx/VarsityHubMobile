# -*- coding: utf-8 -*-
from pathlib import Path

path = Path('app/game-details/GameDetailsScreen.tsx')
text = path.read_text()
start = text.find('  const renderVoteSection = () => {')
if start == -1:
    raise SystemExit('renderVoteSection not found')
end = text.find('\n  const renderBanner = () => {', start)
if end == -1:
    raise SystemExit('renderBanner marker not found')
old_block = text[start:end]
new_block = """  const renderVoteSection = () => {
    if (!vm?.gameId) return null;
    const summary = voteSummary;
    const hasVotes = !!summary && summary.total > 0;
    const pctA = hasVotes ? summary.pctA : 50;
    const pctB = hasVotes ? summary.pctB : 50;
    const percentALabel = summary ? ${summary.pctA}% : '--';
    const percentBLabel = summary ? ${summary.pctB}% : '--';
    const totalLabel = summary ? ${summary.total} vote : '0 votes';
    const statusLabel = summary
      ? summary.userVote
        ? Your pick: 
        : "You haven't voted"
      : 'Loading votes...';
    const caption = summary ? ${totalLabel} •  : statusLabel;
    const pressDisabled = Boolean(vm?.isPast) || voteBusy;
    const selectedTeam = summary?.userVote ?? null;
    const trackFlexA = pctA === 0 && pctB === 0 ? 1 : Math.max(pctA, 0.1);
    const trackFlexB = pctA === 0 && pctB === 0 ? 1 : Math.max(pctB, 0.1);

    return (
      <View style={styles.voteSection}>
        <View style={styles.voteChipRow}>
          <Pressable
            style={[
              styles.voteChip,
              selectedTeam === 'A' ? styles.voteChipSelected : null,
              pressDisabled ? styles.voteChipDisabled : null,
            ]}
            onPress={() => handleVote('A')}
            onLongPress={selectedTeam === 'A' ? handleClearVote : undefined}
            delayLongPress={300}
            disabled={pressDisabled}
          >
            <View style={styles.voteChipContent}>
              <Text style={[styles.voteChipLabel, selectedTeam === 'A' ? styles.voteChipLabelSelected : null]}>{teamALabel}</Text>
              <Text style={[styles.voteChipPercent, selectedTeam === 'A' ? styles.voteChipLabelSelected : null]}>{percentALabel}</Text>
            </View>
          </Pressable>
          <Pressable
            style={[
              styles.voteChip,
              selectedTeam === 'B' ? styles.voteChipSelected : null,
              pressDisabled ? styles.voteChipDisabled : null,
            ]}
            onPress={() => handleVote('B')}
            onLongPress={selectedTeam === 'B' ? handleClearVote : undefined}
            delayLongPress={300}
            disabled={pressDisabled}
          >
            <View style={styles.voteChipContent}>
              <Text style={[styles.voteChipLabel, selectedTeam === 'B' ? styles.voteChipLabelSelected : null]}>{teamBLabel}</Text>
              <Text style={[styles.voteChipPercent, selectedTeam === 'B' ? styles.voteChipLabelSelected : null]}>{percentBLabel}</Text>
            </View>
          </Pressable>
        </View>
        <View style={styles.voteBar}>
          <View style={[styles.voteBarFillA, { flex: trackFlexA }]} />
          <View style={[styles.voteBarFillB, { flex: trackFlexB }]} />
        </View>
        <Text style={styles.voteCaption}>{caption}</Text>
      </View>
    );
  };

"""
text = text.replace(old_block, new_block)
path.write_text(text)
