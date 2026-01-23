import { render } from '@testing-library/react-native';
import BannerAd from '../app/components/BannerAd';

describe('Banner Ad System', () => {
  it('renders banner ad', () => {
    const { getByTestId } = render(<BannerAd adId="test-ad" />);
    expect(getByTestId('banner-ad-test-ad')).toBeTruthy();
  });
});
