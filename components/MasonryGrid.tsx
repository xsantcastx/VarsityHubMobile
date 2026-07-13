import React, { useMemo } from 'react';
import { Dimensions, StyleSheet, View } from 'react-native';

type MasonryGridProps = {
  data: any[];
  numColumns?: number;
  renderItem: (item: any, index: number) => React.ReactElement;
  gap?: number;
};

export default function MasonryGrid({
  data,
  numColumns = 2,
  renderItem,
  gap = 8,
}: MasonryGridProps) {
  const { width } = Dimensions.get('window');
  const columnWidth = (width - (numColumns + 1) * gap) / numColumns;

  // Distribute items across columns to create a balanced masonry layout
  const columns = useMemo(() => {
    const cols: any[][] = Array.from({ length: numColumns }, () => []);
    const heights: number[] = Array(numColumns).fill(0);

    data.forEach((item, index) => {
      // Find the column with the minimum height
      const minHeight = Math.min(...heights);
      const columnIndex = heights.indexOf(minHeight);

      // Add item to that column
      cols[columnIndex].push({ item, index });

      // Calculate estimated height based on item properties
      const itemHeight = calculateItemHeight(item, columnWidth);
      heights[columnIndex] += itemHeight + gap;
    });

    return cols;
  }, [data, numColumns, columnWidth, gap]);

  return (
    <View style={styles.container}>
      {columns.map((column, columnIndex) => (
        <View
          key={columnIndex}
          style={[
            styles.column,
            { width: columnWidth, marginRight: columnIndex < numColumns - 1 ? gap : 0 },
          ]}
        >
          {column.map(({ item, index }) => {
            // v1.0.2 audit fix: prefer a stable id-based key. Only fall back to a
            // CONTENT-derived key (not index) when id is missing, so reorders don't
            // cause visual ghosting as React reuses DOM nodes for different items.
            const stableKey = item?.id
              ? String(item.id)
              : `c${columnIndex}-${(item as any)?.key || (item as any)?.url || (item as any)?.created_at || index}`;
            return (
              <View key={stableKey} style={{ marginBottom: gap }}>
                {renderItem(item, index)}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// Helper function to estimate item height
function calculateItemHeight(item: any, _width: number): number {
  const hasMedia = item?.media_url;

  // Base heights for different content types
  if (hasMedia) {
    // Random heights to create Pinterest-style varied layout
    const heights = [180, 220, 260, 300, 340];
    const randomHeight = heights[Math.floor(Math.random() * heights.length)];
    return randomHeight + 100; // +100 for footer and padding
  }

  if (item?.poll) {
    // Polls need more height
    const optionsCount = item.poll.options?.length || 2;
    return 200 + optionsCount * 45;
  }

  // Text-only posts
  const contentLength = (item?.content || item?.caption || '').length;
  if (contentLength > 200) return 280;
  if (contentLength > 100) return 220;
  return 180;
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    padding: 8,
  },
  column: {
    flexDirection: 'column',
  },
});
