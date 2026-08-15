export type VenuePhotoFallback = { url: string; credit: string };

const CLIENT_VENUE_PHOTO_FALLBACKS: Record<string, VenuePhotoFallback> = {
  'amalie arena': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Amalie_Arena_(cropped).jpg',
    credit: 'Indy beetle / Wikimedia Commons, CC BY-SA 4.0',
  },
  'amway center': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Amway_Center_exterior_2023.jpg',
    credit: 'Floydian / Wikimedia Commons, CC BY-SA 4.0',
  },
  'barclays center': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/BarclayCenter-2_(48034233762).jpg',
    credit: 'Ajay Suresh from New York, NY, USA / Wikimedia Commons, CC BY 2.0',
  },
  'bridgestone arena': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Bridgestone_Arena,_Nashville.jpg',
    credit: 'Rhododendrites / Wikimedia Commons, CC BY-SA 4.0',
  },
  'canada life place': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Canada_Life_Place%2C_formly_the_called_Budweiser_Gardens.jpg',
    credit: 'Gogerr / Wikimedia Commons, CC BY 4.0',
  },
  'carefirst arena': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Entertainment_and_Sports_Arena_Exterior.jpg',
    credit: 'Gregory Koch / Wikimedia Commons, CC BY-SA 4.0',
  },
  'climate pledge arena': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Climate_Pledge_Arena%2C_Seattle%2C_2023.jpg',
    credit: 'Another Believer / Wikimedia Commons, CC BY-SA 4.0',
  },
  'coca-cola coliseum': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Ricohcoliseum.jpg',
    credit: 'Diego Torres Silvestre / Wikimedia Commons, CC BY 2.0',
  },
  'college park center': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/University_of_Texas_at_Arlington_March_2021_008_(College_Park_Center).jpg',
    credit: 'Michael Barera / Wikimedia Commons, CC BY-SA 4.0',
  },
  'crypto.com arena': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Crypto.com_Arena_exterior_2023.jpg',
    credit: 'Troutfarm27 / Wikimedia Commons, CC BY-SA 4.0',
  },
  'eaglebank arena': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/EagleBank_Arena_(George_Mason_University).jpg',
    credit: 'Arturandmandi / Wikimedia Commons, CC BY-SA 4.0',
  },
  'entertainment and sports arena': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Entertainment_and_Sports_Arena_Exterior.jpg',
    credit: 'Gregory Koch / Wikimedia Commons, CC BY-SA 4.0',
  },
  'fiserv forum': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Milwaukee_July_2022_022_(Fiserv_Forum).jpg',
    credit: 'Michael Barera / Wikimedia Commons, CC BY-SA 4.0',
  },
  'gateway center arena': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Gateway_Center_Arena%2C_at_night.jpg',
    credit: 'Giccsalescoordinator / Wikimedia Commons, CC BY-SA 4.0',
  },
  'keybank center': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/KeyBank_Center_side_view_from_Main_Street_at_Prime_Street%2C_Buffalo%2C_New_York_-_20210725.jpg',
    credit: 'Andre Carrotflower / Wikimedia Commons, CC BY-SA 4.0',
  },
  'madison square garden': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Madison_Square_Garden_(MSG)_-_Full_(48124330357).jpg',
    credit: 'Ajay Suresh from New York, NY, USA / Wikimedia Commons, CC BY 2.0',
  },
  'michelob ultra arena': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/MandalayBay2010.JPG',
    credit: 'Kris1123 / Wikimedia Commons, CC BY 3.0',
  },
  'moda center': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Moda_Center.JPG',
    credit: 'Lugnuts / Wikimedia Commons, CC BY-SA 3.0',
  },
  'scope arena': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Norfolk_Scope2.JPG',
    credit: 'Cag1970 / Wikimedia Commons, Public domain',
  },
  'snhu arena': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Verizon_Wireless_Arena_front.jpg',
    credit: 'ToddC4176 at English Wikipedia / Wikimedia Commons, CC BY-SA 3.0',
  },
  'spectrum center': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/TWCArena2012.JPG',
    credit: 'HangingCurve / Wikimedia Commons, CC BY-SA 4.0',
  },
  'td garden': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/TD_Garden.JPG',
    credit: 'Nywalton at English Wikipedia / Wikimedia Commons, Public domain',
  },
  'toyota center': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/Toyota_Center_entr.jpg',
    credit: 'Ed Uthman from Houston, TX, USA / Wikimedia Commons, CC BY 2.0',
  },
  'united center': {
    url: 'https://commons.wikimedia.org/wiki/Special:FilePath/United_Center_060716.jpg',
    credit: 'User:JeremyA / Wikimedia Commons, CC BY-SA 2.5',
  },
};

export function getVenuePhotoFallback(location?: string | null): VenuePhotoFallback | null {
  if (!location) return null;
  const venue = location.split(',')[0]?.trim().toLowerCase();
  if (!venue) return null;
  return CLIENT_VENUE_PHOTO_FALLBACKS[venue] ?? null;
}
