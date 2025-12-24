/**
 * Virtualized masonry grid component using FlatList
 * Provides better performance for large datasets with variable heights
 */

import React, { useMemo } from 'react';
import { FlatList, View, ViewStyle } from 'react-native';

interface MasonryProps<T> {
  data: T[];
  numColumns?: number;
  renderItem: (item: T, index: number, column: number) => React.ReactNode;
  keyExtractor?: (item: T, index: number) => string;
  ListHeaderComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListEmptyComponent?: React.ComponentType<any> | React.ReactElement | null;
  ListFooterComponent?: React.ComponentType<any> | React.ReactElement | null;
  contentContainerStyle?: ViewStyle;
  columnWrapperStyle?: ViewStyle;
  onEndReached?: () => void;
  onEndReachedThreshold?: number;
  scrollEnabled?: boolean;
  nestedScrollEnabled?: boolean;
}

/**
 * Masonry FlatList component - virtualized grid layout
 * Organizes items into columns for optimal rendering performance
 */
export const MasonryFlatList = React.forwardRef<FlatList, MasonryProps<any>>(
  (
    {
      data,
      numColumns = 2,
      renderItem,
      keyExtractor,
      ListHeaderComponent,
      ListEmptyComponent,
      ListFooterComponent,
      contentContainerStyle,
      columnWrapperStyle,
      onEndReached,
      onEndReachedThreshold = 0.5,
      scrollEnabled = true,
      nestedScrollEnabled = true,
    },
    ref
  ) => {
    /**
     * Reorganize flat data into columns for masonry layout
     * Example: 6 items with numColumns=3 becomes:
     * [[0,3], [1,4], [2,5]]
     */
    const columnData = useMemo(() => {
      const columns = Array.from({ length: numColumns }, () => [] as any[]);
      data.forEach((item, index) => {
        columns[index % numColumns].push({
          item,
          index,
          column: index % numColumns,
        });
      });
      return columns[0]?.map((_, rowIdx) =>
        columns.map((col) => col[rowIdx]).filter(Boolean)
      ) ?? [];
    }, [data, numColumns]);

    return (
      <FlatList
        ref={ref}
        data={columnData}
        keyExtractor={(row, idx) =>
          `row-${idx}-${row.map((cell) => keyExtractor?.(cell.item, cell.index) || `${cell.index}`).join('-')}`
        }
        renderItem={({ item: row }) => (
          <View style={[{ flexDirection: 'row' }, columnWrapperStyle]}>
            {row.map((cell, cellIdx) => (
              <View key={`${cell.index}`} style={{ flex: 1 }}>
                {renderItem(cell.item, cell.index, cell.column)}
              </View>
            ))}
            {/* Spacer columns for incomplete rows */}
            {row.length < numColumns &&
              Array.from({ length: numColumns - row.length }).map((_, i) => (
                <View key={`spacer-${i}`} style={{ flex: 1 }} />
              ))}
          </View>
        )}
        ListHeaderComponent={ListHeaderComponent}
        ListEmptyComponent={ListEmptyComponent}
        ListFooterComponent={ListFooterComponent}
        contentContainerStyle={contentContainerStyle}
        onEndReached={onEndReached}
        onEndReachedThreshold={onEndReachedThreshold}
        scrollEnabled={scrollEnabled}
        nestedScrollEnabled={nestedScrollEnabled}
        removeClippedSubviews={true}
        maxToRenderPerBatch={10}
        updateCellsBatchingPeriod={50}
        initialNumToRender={20}
      />
    );
  }
);

MasonryFlatList.displayName = 'MasonryFlatList';
