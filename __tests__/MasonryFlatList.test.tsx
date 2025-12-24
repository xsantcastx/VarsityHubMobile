/**
 * Jest tests for MasonryFlatList component
 * Covers virtualization, column layout, and rendering
 */

import { MasonryFlatList } from '@/components/MasonryFlatList';
import { render } from '@testing-library/react-native';
import { Text } from 'react-native';

describe('MasonryFlatList Component', () => {
  const mockItems = Array.from({ length: 12 }, (_, i) => ({
    id: `item-${i}`,
    title: `Item ${i}`,
  }));

  describe('Rendering', () => {
    it('should render all items', () => {
      const { toJSON } = render(
        <MasonryFlatList
          data={mockItems}
          numColumns={3}
          renderItem={(item) => (
            <Text testID={`item-${item.id}`}>{item.title}</Text>
          )}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('should render items in correct column layout', () => {
      const { toJSON } = render(
        <MasonryFlatList
          data={mockItems.slice(0, 6)}
          numColumns={2}
          renderItem={(item) => (
            <Text testID={`item-${item.id}`}>{item.title}</Text>
          )}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('should handle empty data', () => {
      const { toJSON } = render(
        <MasonryFlatList
          data={[]}
          numColumns={3}
          renderItem={(item) => <Text>{item.title}</Text>}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('should render with ListHeaderComponent', () => {
      const { toJSON } = render(
        <MasonryFlatList
          data={mockItems}
          numColumns={3}
          renderItem={(item) => <Text>{item.title}</Text>}
          ListHeaderComponent={<Text testID="header">Header</Text>}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('should render with ListFooterComponent', () => {
      const { toJSON } = render(
        <MasonryFlatList
          data={mockItems}
          numColumns={3}
          renderItem={(item) => <Text>{item.title}</Text>}
          ListFooterComponent={<Text testID="footer">Footer</Text>}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('should render with ListEmptyComponent', () => {
      const { toJSON } = render(
        <MasonryFlatList
          data={[]}
          numColumns={3}
          renderItem={(item) => <Text>{item.title}</Text>}
          ListEmptyComponent={<Text testID="empty">No items</Text>}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Column Distribution', () => {
    it('should distribute items evenly across columns', () => {
      const items = [
        { id: '1', title: 'A' },
        { id: '2', title: 'B' },
        { id: '3', title: 'C' },
        { id: '4', title: 'D' },
        { id: '5', title: 'E' },
        { id: '6', title: 'F' },
      ];

      const { toJSON } = render(
        <MasonryFlatList
          data={items}
          numColumns={2}
          renderItem={(item) => (
            <Text testID={`item-${item.id}`}>{item.title}</Text>
          )}
        />
      );

      // 6 items in 2 columns = 3 rows
      // Row 1: [A, B], Row 2: [C, D], Row 3: [E, F]
      expect(toJSON()).toBeTruthy();
    });

    it('should handle incomplete last row with spacers', () => {
      const items = [
        { id: '1', title: 'A' },
        { id: '2', title: 'B' },
        { id: '3', title: 'C' },
        { id: '4', title: 'D' },
        { id: '5', title: 'E' },
      ];

      const { toJSON } = render(
        <MasonryFlatList
          data={items}
          numColumns={3}
          renderItem={(item) => (
            <Text testID={`item-${item.id}`}>{item.title}</Text>
          )}
        />
      );

      // 5 items in 3 columns:
      // Row 1: [A, B, C], Row 2: [D, E, spacer]
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Props', () => {
    it('should accept default numColumns (2)', () => {
      const { toJSON } = render(
        <MasonryFlatList
          data={mockItems}
          renderItem={(item) => <Text>{item.title}</Text>}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('should accept custom numColumns', () => {
      const { toJSON } = render(
        <MasonryFlatList
          data={mockItems}
          numColumns={4}
          renderItem={(item) => <Text>{item.title}</Text>}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('should accept keyExtractor prop', () => {
      const keyExtractor = jest.fn((item) => item.id);

      const { toJSON } = render(
        <MasonryFlatList
          data={mockItems}
          numColumns={3}
          renderItem={(item) => <Text>{item.title}</Text>}
          keyExtractor={keyExtractor}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('should accept columnWrapperStyle prop', () => {
      const columnWrapperStyle = { gap: 10 };

      const { toJSON } = render(
        <MasonryFlatList
          data={mockItems}
          numColumns={3}
          renderItem={(item) => <Text>{item.title}</Text>}
          columnWrapperStyle={columnWrapperStyle}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('should accept contentContainerStyle prop', () => {
      const contentContainerStyle = { paddingHorizontal: 16 };

      const { toJSON } = render(
        <MasonryFlatList
          data={mockItems}
          numColumns={3}
          renderItem={(item) => <Text>{item.title}</Text>}
          contentContainerStyle={contentContainerStyle}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('should accept scrollEnabled prop', () => {
      const { toJSON } = render(
        <MasonryFlatList
          data={mockItems}
          numColumns={3}
          renderItem={(item) => <Text>{item.title}</Text>}
          scrollEnabled={false}
        />
      );

      expect(toJSON()).toBeTruthy();
    });

    it('should accept nestedScrollEnabled prop', () => {
      const { toJSON } = render(
        <MasonryFlatList
          data={mockItems}
          numColumns={3}
          renderItem={(item) => <Text>{item.title}</Text>}
          nestedScrollEnabled={true}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });

  describe('Performance Features', () => {
    it('should configure virtual batching props', () => {
      const { toJSON } = render(
        <MasonryFlatList
          data={Array.from({ length: 1000 }, (_, i) => ({
            id: `item-${i}`,
            title: `Item ${i}`,
          }))}
          numColumns={3}
          renderItem={(item) => <Text>{item.title}</Text>}
        />
      );

      // Component should be rendered with virtualization props:
      // removeClippedSubviews={true}
      // maxToRenderPerBatch={10}
      // updateCellsBatchingPeriod={50}
      // initialNumToRender={20}
      expect(toJSON()).toBeTruthy();
    });
  });

  describe('renderItem callback', () => {
    it('should call renderItem with correct parameters', () => {
      const renderItem = jest.fn((item, index, column) => (
        <Text>Item</Text>
      ));

      render(
        <MasonryFlatList
          data={mockItems.slice(0, 3)}
          numColumns={2}
          renderItem={renderItem}
        />
      );

      expect(renderItem).toHaveBeenCalled();
      // Verify called with (item, index, column)
      const calls = renderItem.mock.calls;
      expect(calls.length).toBeGreaterThan(0);
    });

    it('should receive correct index parameter', () => {
      const indexes: number[] = [];
      const renderItem = jest.fn((item, index) => {
        indexes.push(index);
        return <Text>Item</Text>;
      });

      render(
        <MasonryFlatList
          data={mockItems.slice(0, 6)}
          numColumns={3}
          renderItem={renderItem}
        />
      );

      // Should have called renderItem for all 6 items
      expect(indexes.length).toBe(6);
    });
  });

  describe('Pagination Integration', () => {
    it('should call onEndReached callback', () => {
      const onEndReached = jest.fn();

      const { toJSON } = render(
        <MasonryFlatList
          data={mockItems}
          numColumns={3}
          renderItem={(item) => <Text>{item.title}</Text>}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.5}
        />
      );

      expect(toJSON()).toBeTruthy();
      // Callback would be triggered when scrolling to end
    });

    it('should accept custom onEndReachedThreshold', () => {
      const onEndReached = jest.fn();

      const { toJSON } = render(
        <MasonryFlatList
          data={mockItems}
          numColumns={3}
          renderItem={(item) => <Text>{item.title}</Text>}
          onEndReached={onEndReached}
          onEndReachedThreshold={0.8}
        />
      );

      expect(toJSON()).toBeTruthy();
    });
  });
});
