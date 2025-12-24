import { httpGet } from '@/api/http';
import { Colors } from '@/constants/Colors';
import { useColorScheme } from '@/hooks/useColorScheme';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    Share,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

interface AnalyticsData {
  id: string;
  business_name?: string;
  target_zip_code?: string;
  status: string;
  payment_status: string;
  created_at: string;
  total_impressions: number;
  total_clicks: number;
  click_rate: number;
  avg_session_duration: number;
  total_time_spent: number;
  reservation_dates: { date: string; count: number }[];
  clicks_by_date: { date: string; clicks: number; avg_duration: number }[];
}

export default function AdAnalyticsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const colorScheme = useColorScheme();
  const isDark = colorScheme === 'dark';

  const [analytics, setAnalytics] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchAnalytics = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const data = await httpGet(`/ads/${id}/analytics`);
      setAnalytics(data);
    } catch (err: any) {
      console.error('[AdAnalytics] Error fetching analytics:', err);
      if (err?.status === 403) {
        setError('You do not have permission to view this ad\'s analytics');
      } else if (err?.status === 404) {
        setError('Ad not found');
      } else {
        setError('Failed to load analytics');
      }
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (!id) {
      setError('Ad ID is required');
      setLoading(false);
      return;
    }

    void fetchAnalytics();
  }, [id, fetchAnalytics]);

  const formatDate = (isoString: string) => {
    const date = new Date(isoString);
    return date.toLocaleDateString('en-US', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const formatDuration = (seconds: number) => {
    if (seconds < 60) return `${Math.round(seconds)}s`;
    if (seconds < 3600) return `${Math.round(seconds / 60)}m`;
    return `${Math.round(seconds / 3600)}h`;
  };

  const generateCSV = useCallback(() => {
    if (!analytics) return '';

    const headers = [
      'Metric',
      'Value',
    ];

    const rows = [
      ['Total Impressions', String(analytics.total_impressions)],
      ['Total Clicks', String(analytics.total_clicks)],
      ['Click Rate (%)', String(analytics.click_rate.toFixed(2))],
      ['Avg Session Duration (seconds)', String(Math.round(analytics.avg_session_duration))],
      ['Total Time Spent (seconds)', String(Math.round(analytics.total_time_spent))],
      ['Status', analytics.status],
      ['Payment Status', analytics.payment_status],
      ['Created', formatDate(analytics.created_at)],
      [''],
      ['Click Activity by Date', ''],
      ['Date', 'Clicks', 'Avg Duration (sec)'],
    ];

    // Add click data
    if (analytics.clicks_by_date.length > 0) {
      analytics.clicks_by_date.forEach((item) => {
        rows.push([
          formatDate(item.date),
          String(item.clicks),
          String(Math.round(item.avg_duration)),
        ]);
      });
    }

    // Convert to CSV format
    const csvHeaders = headers.join(',');
    const csvRows = rows
      .map((row) =>
        row
          .map((cell) => {
            // Escape quotes and wrap in quotes if contains comma or quote
            const escaped = String(cell).replace(/"/g, '""');
            return escaped.includes(',') ? `"${escaped}"` : escaped;
          })
          .join(',')
      )
      .join('\n');

    return `${csvHeaders}\n${csvRows}`;
  }, [analytics]);

  const handleExportCSV = useCallback(async () => {
    try {
      const csv = generateCSV();
      if (!csv) {
        Alert.alert('Error', 'No data to export');
        return;
      }


      // Share the CSV (on mobile this will offer download/email options)
      await Share.share({
        message: csv,
        title: 'Ad Analytics Export',
        url: `data:text/csv;charset=utf-8,${encodeURIComponent(csv)}`,
      });
    } catch {
      Alert.alert('Error', 'Failed to export analytics');
    }
  }, [generateCSV]);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active':
        return '#4CAF50';
      case 'draft':
        return '#FFA500';
      case 'paused':
        return '#9E9E9E';
      case 'expired':
        return '#F44336';
      default:
        return '#2196F3';
    }
  };

  const getPaymentStatusColor = (status: string) => {
    return status === 'paid' ? '#4CAF50' : '#FFA500';
  };

  if (loading) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
        <ActivityIndicator size="large" color={Colors[colorScheme].tint} />
      </View>
    );
  }

  if (error || !analytics) {
    return (
      <View style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}>
        <Text style={[styles.errorText, { color: '#F44336' }]}>{error || 'No data available'}</Text>
        <TouchableOpacity
          style={[styles.backButton, { backgroundColor: Colors[colorScheme].tint }]}
          onPress={() => router.back()}
        >
          <Text style={styles.backButtonText}>Go Back</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <ScrollView
      style={[styles.container, { backgroundColor: isDark ? '#1a1a1a' : '#fff' }]}
      contentContainerStyle={styles.contentContainer}
    >
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={[styles.backLink, { color: Colors[colorScheme].tint }]}>← Back</Text>
        </TouchableOpacity>
        <Text style={[styles.title, { color: isDark ? '#fff' : '#000' }]}>Analytics</Text>
        <TouchableOpacity onPress={handleExportCSV} style={[styles.exportButton, { backgroundColor: Colors[colorScheme].tint }]}>
          <Text style={styles.exportButtonText}>Export</Text>
        </TouchableOpacity>
      </View>

      {/* Ad Info Card */}
      <View style={[styles.card, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
        <Text style={[styles.cardTitle, { color: isDark ? '#fff' : '#000' }]}>
          {analytics.business_name || 'Ad'}
        </Text>
        {analytics.target_zip_code && (
          <Text style={[styles.cardSubtitle, { color: isDark ? '#aaa' : '#666' }]}>
            Target: {analytics.target_zip_code}
          </Text>
        )}
        <View style={styles.statusRow}>
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(analytics.status) },
              ]}
            />
            <Text style={[styles.statusText, { color: isDark ? '#fff' : '#000' }]}>
              {analytics.status.charAt(0).toUpperCase() + analytics.status.slice(1)}
            </Text>
          </View>
          <View style={styles.statusBadge}>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getPaymentStatusColor(analytics.payment_status) },
              ]}
            />
            <Text style={[styles.statusText, { color: isDark ? '#fff' : '#000' }]}>
              {analytics.payment_status.charAt(0).toUpperCase() + analytics.payment_status.slice(1)}
            </Text>
          </View>
        </View>
      </View>

      {/* Key Metrics Grid - Row 1: Impressions & Clicks */}
      <View style={[styles.metricsGrid, { gap: 12 }]}>
        <View style={[styles.metricCard, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
          <Text style={[styles.metricValue, { color: Colors[colorScheme].tint }]}>
            {analytics.total_impressions}
          </Text>
          <Text style={[styles.metricLabel, { color: isDark ? '#aaa' : '#666' }]}>
            Impressions
          </Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
          <Text style={[styles.metricValue, { color: Colors[colorScheme].tint }]}>
            {analytics.total_clicks}
          </Text>
          <Text style={[styles.metricLabel, { color: isDark ? '#aaa' : '#666' }]}>
            Clicks
          </Text>
        </View>
      </View>

      {/* Key Metrics Grid - Row 2: Click Rate & Avg Time */}
      <View style={[styles.metricsGrid, { gap: 12 }]}>
        <View style={[styles.metricCard, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
          <Text style={[styles.metricValue, { color: Colors[colorScheme].tint }]}>
            {analytics.click_rate.toFixed(1)}%
          </Text>
          <Text style={[styles.metricLabel, { color: isDark ? '#aaa' : '#666' }]}>
            Click Rate
          </Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
          <Text style={[styles.metricValue, { color: Colors[colorScheme].tint }]}>
            {formatDuration(analytics.avg_session_duration)}
          </Text>
          <Text style={[styles.metricLabel, { color: isDark ? '#aaa' : '#666' }]}>
            Avg Time on Site
          </Text>
        </View>
      </View>

      {/* Total Time Spent Card */}
      <View style={[styles.card, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
        <View style={styles.totalTimeRow}>
          <View>
            <Text style={[styles.cardTitle, { color: isDark ? '#fff' : '#000' }]}>
              Total Time Spent
            </Text>
            <Text style={[styles.cardSubtitle, { color: isDark ? '#aaa' : '#666' }]}>
              {formatDuration(analytics.total_time_spent)}
            </Text>
          </View>
          <Text style={[styles.totalTimeValue, { color: Colors[colorScheme].tint }]}>
            {analytics.total_clicks > 0 ? `${analytics.total_clicks} visits` : 'No visits'}
          </Text>
        </View>
      </View>

      {/* Created Date */}
      <View style={[styles.card, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
        <Text style={[styles.cardTitle, { color: isDark ? '#fff' : '#000' }]}>Created</Text>
        <Text style={[styles.cardSubtitle, { color: isDark ? '#aaa' : '#666' }]}>
          {formatDate(analytics.created_at)}
        </Text>
      </View>

      {/* Reservation Dates Histogram */}
      {analytics.reservation_dates.length > 0 && (
        <View style={[styles.card, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
          <Text style={[styles.cardTitle, { color: isDark ? '#fff' : '#000' }]}>
            Booking Schedule
          </Text>
          <View style={styles.histogram}>
            {analytics.reservation_dates.map((item, idx) => (
              <View key={idx} style={styles.histogramItem}>
                <Text style={[styles.histogramDate, { color: isDark ? '#aaa' : '#666' }]}>
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <View
                  style={[
                    styles.histogramBar,
                    {
                      width: `${Math.min(item.count * 20, 100)}%`,
                      backgroundColor: Colors[colorScheme].tint,
                    },
                  ]}
                />
                <Text style={[styles.histogramCount, { color: isDark ? '#fff' : '#000' }]}>
                  {item.count}
                </Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Clicks by Date Histogram */}
      {analytics.clicks_by_date.length > 0 && (
        <View style={[styles.card, { backgroundColor: isDark ? '#2a2a2a' : '#f5f5f5' }]}>
          <Text style={[styles.cardTitle, { color: isDark ? '#fff' : '#000' }]}>
            Click Activity
          </Text>
          <View style={styles.histogram}>
            {analytics.clicks_by_date.slice(0, 10).map((item, idx) => (
              <View key={idx} style={styles.histogramItem}>
                <Text style={[styles.histogramDate, { color: isDark ? '#aaa' : '#666' }]}>
                  {new Date(item.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </Text>
                <View style={styles.histogramBarContainer}>
                  <View
                    style={[
                      styles.histogramBar,
                      {
                        width: `${Math.min(item.clicks * 15, 100)}%`,
                        backgroundColor: '#FF9800',
                      },
                    ]}
                  />
                </View>
                <View style={styles.clickMetrics}>
                  <Text style={[styles.histogramCount, { color: isDark ? '#fff' : '#000' }]}>
                    {item.clicks}
                  </Text>
                  <Text style={[styles.clickDuration, { color: isDark ? '#999' : '#999' }]}>
                    {formatDuration(item.avg_duration)}
                  </Text>
                </View>
              </View>
            ))}
          </View>
        </View>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 24,
    gap: 8,
  },
  backLink: {
    fontSize: 16,
    fontWeight: '600',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    flex: 1,
  },
  exportButton: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 6,
    alignItems: 'center',
  },
  exportButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 13,
  },
  card: {
    borderRadius: 12,
    padding: 16,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  cardSubtitle: {
    fontSize: 14,
    marginBottom: 12,
  },
  statusRow: {
    flexDirection: 'row',
    gap: 12,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '600',
  },
  metricsGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    borderRadius: 12,
    padding: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  metricValue: {
    fontSize: 32,
    fontWeight: 'bold',
  },
  metricLabel: {
    fontSize: 12,
    marginTop: 8,
    textAlign: 'center',
  },
  histogram: {
    marginTop: 12,
    gap: 12,
  },
  histogramItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  histogramDate: {
    width: 60,
    fontSize: 12,
    fontWeight: '500',
  },
  histogramBar: {
    height: 8,
    borderRadius: 4,
    minWidth: 2,
  },
  histogramBarContainer: {
    flex: 1,
    height: 8,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  histogramCount: {
    width: 30,
    fontSize: 12,
    fontWeight: '600',
    textAlign: 'right',
  },
  clickMetrics: {
    alignItems: 'flex-end',
    gap: 2,
  },
  clickDuration: {
    fontSize: 10,
    marginTop: 2,
  },
  totalTimeRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalTimeValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  errorText: {
    fontSize: 14,
    marginBottom: 16,
    textAlign: 'center',
  },
  backButton: {
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: 'center',
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600',
    fontSize: 16,
  },
});
