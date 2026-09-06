import { describe, expect, it } from '@jest/globals';
import { venuePhotoFor } from '../lib/proSchedule/venuePhotos.js';

describe('venuePhotoFor', () => {
  it('returns attributed photos for NCAA football venues', () => {
    for (const venue of ['California Memorial Stadium', 'Mackay Stadium']) {
      expect(venuePhotoFor(`${venue}, USA`)).toMatchObject({
        url: expect.stringContaining('https://upload.wikimedia.org/'),
        credit: expect.stringContaining('Wikimedia Commons'),
      });
    }
    expect(venuePhotoFor('Los Angeles Memorial Coliseum, Los Angeles, CA, USA')).toMatchObject({
      url: expect.stringContaining('USC_vs_University_of_Oregon_November_2019.png'),
      credit: expect.stringContaining('Wikimedia Commons'),
    });
    expect(venuePhotoFor('Scott Stadium, Charlottesville, VA, USA')).toMatchObject({
      url: expect.stringContaining('Scott_Stadium_UVa.jpg'),
      credit: expect.stringContaining('Wikimedia Commons'),
    });
  });

  it('returns an attributed photo for tennis tournament venues', () => {
    expect(
      venuePhotoFor('USTA Billie Jean King National Tennis Center, Arthur Ashe Stadium, Queens, NY')
    ).toMatchObject({
      url: expect.stringContaining('USTA_Billie_Jean_King_National_Tennis_Center'),
      credit: expect.stringContaining('Wikimedia Commons'),
    });
  });
});
