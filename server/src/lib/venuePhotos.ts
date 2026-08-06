export type VenuePhoto = {
  url: string;
  credit: string;
};

const VENUE_PHOTOS: Readonly<Record<string, VenuePhoto>> = {
  "Acrisure Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/3/36/Ptr-HeinzField-FILE.jpg", credit: "Fo2grfr / Wikimedia Commons, CC BY-SA 4.0" },
  "Allegiant Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/2/23/Allegiant_Stadium_%28cropped%29.jpg", credit: "Tomás Del Coro / Wikimedia Commons, CC BY-SA 2.0" },
  "American Airlines Center": { url: "https://upload.wikimedia.org/wikipedia/commons/3/35/American_Airlines_Center_02.jpg", credit: "Joe Mabel / Wikimedia Commons, CC BY-SA 3.0" },
  "American Family Field": { url: "https://upload.wikimedia.org/wikipedia/commons/6/6b/Miller_Park0001.jpg", credit: "Spaluch1 / Wikimedia Commons, CC BY-SA 3.0" },
  "Angel Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/a/a0/Angel_Stadium_of_Anaheim.jpg", credit: "Staff Sgt. Chad McMeen / Wikimedia Commons, Public domain" },
  "AT&T Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/1/11/Arlington_June_2020_4_%28AT%26T_Stadium%29.jpg", credit: "Michael Barera / Wikimedia Commons, CC BY-SA 4.0" },
  "Ball Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/d/d4/Denver_Pepsi_Center_1.jpg", credit: "KM Newnham / Wikimedia Commons, CC BY-SA 2.5" },
  "Bank of America Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/0/09/BofAStadium2015.JPG", credit: "HangingCurve / Wikimedia Commons, CC BY-SA 4.0" },
  "Barclays Center": { url: "https://upload.wikimedia.org/wikipedia/commons/d/df/BarclayCenter-2_%2848034233762%29.jpg", credit: "Ajay Suresh from New York, NY, USA / Wikimedia Commons, CC BY 2.0" },
  "Busch Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/f/f4/Busch_Stadium_III_%2816180972535%29.jpg", credit: "redlegsfan21 / Wikimedia Commons, CC BY-SA 2.0" },
  "Caesars Superdome": { url: "https://upload.wikimedia.org/wikipedia/commons/c/c5/Mercedes-Benz_Superdome_Poydras_bike.JPG", credit: "Infrogmation of New Orleans / Wikimedia Commons, CC BY-SA 3.0" },
  "Capital One Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/7/7f/Verizon_Center_wide.jpg", credit: "Cliff from Arlington, VA (Outside Washington DC), USA / Wikimedia Commons, CC BY 2.0" },
  "Chase Center": { url: "https://upload.wikimedia.org/wikipedia/commons/1/1b/Chase_Center_-_July_2019_%287605%29.jpg", credit: "Gregory Varnum / Wikimedia Commons, CC BY-SA 4.0" },
  "Chase Field": { url: "https://upload.wikimedia.org/wikipedia/commons/1/15/Flyover_at_Diamondbacks_season_opener_2010-04-05.JPG", credit: "MSgt. Raheem Moore / Wikimedia Commons, Public domain" },
  "Citi Field": { url: "https://upload.wikimedia.org/wikipedia/commons/0/08/Citi_Field_Night_Game.jpg", credit: "Chris6d / Wikimedia Commons, CC BY-SA 4.0" },
  "Citizens Bank Park": { url: "https://upload.wikimedia.org/wikipedia/commons/f/f6/Citizens_Bank_Park_2021.jpg", credit: "Chris6d / Wikimedia Commons, CC BY-SA 4.0" },
  "Climate Pledge Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/1/1c/KeyArena_%282890740573%29.jpg", credit: "Cliff from Arlington, Virginia, USA / Wikimedia Commons, CC BY 2.0" },
  "Coca-Cola Coliseum": { url: "https://upload.wikimedia.org/wikipedia/commons/8/80/Ricohcoliseum.jpg", credit: "Diego Torres Silvestre / Wikimedia Commons, CC BY 2.0" },
  "College Park Center": { url: "https://upload.wikimedia.org/wikipedia/commons/3/3b/University_of_Texas_at_Arlington_March_2021_008_%28College_Park_Center%29.jpg", credit: "Michael Barera / Wikimedia Commons, CC BY-SA 4.0" },
  "Comerica Park": { url: "https://upload.wikimedia.org/wikipedia/commons/0/06/Detroit_Tigers_opening_game_at_Comerica_Park%2C_2007.jpg", credit: "User MJCdetroit on en.wikipedia / Wikimedia Commons, CC BY-SA 3.0" },
  "Coors Field": { url: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Coors_field_1.JPG", credit: "Matt Kozlowski / Wikimedia Commons, CC BY-SA 3.0" },
  "Crypto.com Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Crypto.com_Arena_exterior_2023.jpg", credit: "Troutfarm27 / Wikimedia Commons, CC BY-SA 4.0" },
  "Daikin Park": { url: "https://upload.wikimedia.org/wikipedia/commons/3/3d/Minute_Maid_Park_2010.JPG", credit: "Delaywaves / Wikimedia Commons, CC BY 3.0" },
  "Delta Center": { url: "https://upload.wikimedia.org/wikipedia/commons/e/ec/Delta_Center_2023.jpg", credit: "Lomrjyo / Wikimedia Commons, CC BY-SA 4.0" },
  "Dodger Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/f/f1/Dodger_Stadium.jpg", credit: "Frederick Dennstedt from los angeles, usa / Wikimedia Commons, CC BY-SA 2.0" },
  "Empower Field at Mile High": { url: "https://upload.wikimedia.org/wikipedia/commons/a/a6/SAF_at_Mile_High_AFC_Championship_interior.jpg", credit: "Thelastcanadian / Wikimedia Commons, CC BY-SA 3.0" },
  "EverBank Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/d/d8/EverBank1.jpg", credit: "AndrewAvitus / Wikimedia Commons, CC BY 3.0" },
  "FedExForum": { url: "https://upload.wikimedia.org/wikipedia/commons/b/ba/FedExForum_at_night.jpg", credit: "Marco Espino-Ovalle / Wikimedia Commons, Public domain" },
  "Fenway Park": { url: "https://upload.wikimedia.org/wikipedia/commons/2/2a/View_of_Fenway_Park_from_the_press_box_in_July_2022.jpg", credit: "Gatorfan252525 / Wikimedia Commons, CC BY-SA 4.0" },
  "Fiserv Forum": { url: "https://upload.wikimedia.org/wikipedia/commons/2/2c/Milwaukee_July_2022_022_%28Fiserv_Forum%29.jpg", credit: "Michael Barera / Wikimedia Commons, CC BY-SA 4.0" },
  "Ford Field": { url: "https://upload.wikimedia.org/wikipedia/commons/9/90/Ford-Field-September-10-2006.jpg", credit: "Wikimedia Commons / Wikimedia Commons, CC BY 2.5" },
  "Frost Bank Center": { url: "https://upload.wikimedia.org/wikipedia/commons/3/34/AT%26T_Center_at_day.jpg", credit: "Atristan 77 / Wikimedia Commons, CC BY-SA 3.0" },
  "Gainbridge Fieldhouse": { url: "https://upload.wikimedia.org/wikipedia/commons/b/bc/ConsecoFieldhouse.jpg", credit: "Durin at English Wikipedia / Wikimedia Commons, CC BY-SA 3.0" },
  "GEHA Field at Arrowhead Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/a/ac/Aerial_view_of_Arrowhead_Stadium_08-31-2013.jpg", credit: "Ichabod / Wikimedia Commons, CC BY-SA 3.0" },
  "Gillette Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/1/12/Gillette_Stadium02.jpg", credit: "Bernard Gagnon / Wikimedia Commons, CC BY-SA 3.0" },
  "Globe Life Field": { url: "https://upload.wikimedia.org/wikipedia/commons/e/e6/Globe_Life_Field_2020.jpg", credit: "Michael Barera / Wikimedia Commons, CC BY-SA 4.0" },
  "Golden 1 Center": { url: "https://upload.wikimedia.org/wikipedia/commons/0/0e/Golden1Center.jpg", credit: "Siebbi / Wikimedia Commons, CC BY 3.0" },
  "Great American Ball Park": { url: "https://upload.wikimedia.org/wikipedia/commons/0/01/Great_American_Ball_Park_%28cropped%29.jpg", credit: "A. Dawson / Wikimedia Commons, CC BY-SA 4.0" },
  "Hard Rock Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/e/e6/Hard_Rock_Stadium_for_Super_Bowl_LIV_%2849606707583%29.jpg", credit: "elisfkc2 / Wikimedia Commons, CC BY-SA 2.0" },
  "Highmark Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/3/35/New_Highmark_Stadium_construction%2C_2025.webp", credit: "James161723 / Wikimedia Commons, CC0" },
  "Huntington Bank Field": { url: "https://upload.wikimedia.org/wikipedia/commons/4/44/Cleveland_National_Air_Show_%2843805784984%29.jpg", credit: "Erik Drost / Wikimedia Commons, CC BY 2.0" },
  "Kauffman Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/9/93/Kauffman_Stadium_2012.jpg", credit: "Kbh3rd / Wikimedia Commons, CC BY-SA 3.0" },
  "Kia Center": { url: "https://upload.wikimedia.org/wikipedia/commons/3/36/Amway_Center.jpg", credit: "Forsaken Fotos / Wikimedia Commons, CC BY 2.0" },
  "Lambeau Field": { url: "https://upload.wikimedia.org/wikipedia/commons/e/e3/Lambeau_Field.jpg", credit: "JL1Row / Wikimedia Commons, CC BY-SA 3.0" },
  "Levi's Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/8/84/Levi%27s_Stadium_interior_1.jpg", credit: "Matthew Roth / Wikimedia Commons, CC BY-SA 2.0" },
  "Lincoln Financial Field": { url: "https://upload.wikimedia.org/wikipedia/commons/0/08/Philly_%2845%29.JPG", credit: "The original uploader was Betp at French Wikipedia . / Wikimedia Commons, CC BY-SA 3.0" },
  "Little Caesars Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/f/f3/Little_Caesars_Arena_panorama.jpg", credit: "Adam Bishop / Wikimedia Commons, CC BY-SA 4.0" },
  "loanDepot park": { url: "https://upload.wikimedia.org/wikipedia/commons/d/dd/Marlins_Park_2012_3.jpg", credit: "Ebyabe / Wikimedia Commons, CC BY-SA 3.0" },
  "Lucas Oil Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/c/c5/LucasOilStadiumTheLuke.jpg", credit: "Josh Hallett from Winter Haven, FL, USA / Wikimedia Commons, CC BY-SA 2.0" },
  "Lumen Field": { url: "https://upload.wikimedia.org/wikipedia/commons/0/00/Qwest_Field_North.jpg", credit: "\"Smart Destinations\", GoSeattleCard.com, and Go Seattle Card Blog / Wikimedia Commons, CC BY-SA 2.0" },
  "Madison Square Garden": { url: "https://upload.wikimedia.org/wikipedia/commons/4/4b/Madison_Square_Garden_%28MSG%29_-_Full_%2848124330357%29.jpg", credit: "Ajay Suresh from New York, NY, USA / Wikimedia Commons, CC BY 2.0" },
  "Mercedes-Benz Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/1/10/Mercedes_Benz_Stadium_time_lapse_capture_2017-08-13.jpg", credit: "Atlanta Falcons / Wikimedia Commons, CC BY 3.0" },
  "MetLife Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/4/47/New_Meadowlands_Stadium_Mezz_Corner.jpg", credit: "babyknight / Wikimedia Commons, CC BY 2.0" },
  "M&T Bank Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/d/dc/M%26T_Bank_Stadium_DoD.jpg", credit: "United States Department of Defense Cherie Cullen / Wikimedia Commons, Public domain" },
  "Michelob ULTRA Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/a/aa/Mandalay_Bay_Events_Center.jpg", credit: "Shawn Benjamin from Las Vegas / Wikimedia Commons, CC BY-SA 2.0" },
  "Moda Center": { url: "https://upload.wikimedia.org/wikipedia/commons/3/37/Rose_Garden_Arena_-_Portland%2C_Oregon.JPG", credit: "Visions of Domino / Wikimedia Commons, CC BY 2.0" },
  "Mohegan Sun Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/7/74/MoheganSunArena.jpg", credit: "Mikedeluca / Wikimedia Commons, CC BY-SA 4.0" },
  "Mortgage Matchup Center": { url: "https://upload.wikimedia.org/wikipedia/commons/5/58/Talking_Stick_Resort_Arena_%2852397805494%29.jpg", credit: "PJT56 / Wikimedia Commons, CC BY-SA 4.0" },
  "Nationals Park": { url: "https://upload.wikimedia.org/wikipedia/commons/a/a7/Nationals_park_123.jpg", credit: "Jackfromdc / Wikimedia Commons, CC BY-SA 3.0" },
  "NRG Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/b/b2/Reliantstadium.jpg", credit: "User eschipul on Flickr / Wikimedia Commons, CC BY-SA 2.0" },
  "Oracle Park": { url: "https://upload.wikimedia.org/wikipedia/commons/f/f4/Oracle_Park_from_the_City.jpg", credit: "Alen Ištoković / Wikimedia Commons, CC BY-SA 4.0" },
  "Oriole Park at Camden Yards": { url: "https://upload.wikimedia.org/wikipedia/commons/a/a5/Camden_yards_panorama.jpg", credit: "Bordplate / Wikimedia Commons, CC BY-SA 3.0" },
  "Paycom Center": { url: "https://upload.wikimedia.org/wikipedia/commons/2/2b/Chesapeake_Energy_Arena.jpg", credit: "Asy1986 / Wikimedia Commons, CC BY-SA 3.0" },
  "Paycor Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/9/9b/Paul_Brown_Stadium_interior_2017.jpg", credit: "JonRidinger / Wikimedia Commons, CC BY-SA 4.0" },
  "Petco Park": { url: "https://upload.wikimedia.org/wikipedia/commons/a/a6/Petco_Park_aerial_view.jpg", credit: "Xetafd / Wikimedia Commons, CC BY-SA 4.0" },
  "PNC Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/0/0a/PNC_Arena_NC_62012.JPG", credit: "Elmito / Wikimedia Commons, CC BY-SA 2.5" },
  "PNC Park": { url: "https://upload.wikimedia.org/wikipedia/commons/8/87/PNC_Park_%2848148719578%29.jpg", credit: "Mx. Granger / Wikimedia Commons, CC BY-SA 4.0" },
  "Progressive Field": { url: "https://upload.wikimedia.org/wikipedia/commons/0/05/Jacobs_Field_-_panoramio.jpg", credit: "Erik Drost / Wikimedia Commons, CC BY 2.0" },
  "Rate Field": { url: "https://upload.wikimedia.org/wikipedia/commons/7/7d/U.S._Cellular_Field%2C_home_of_the_Chicago_White_Sox.jpg", credit: "Eric Allix Rogers / Wikimedia Commons, CC BY-SA 2.0" },
  "Rocket Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/f/fd/Rocket_Mortgage_FieldHouse_%282%29.jpg", credit: "Cards84664 / Wikimedia Commons, CC BY-SA 4.0" },
  "Rogers Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/e/e6/Vancouver_Canucks_hockey_game_at_Rogers_Arena%2C_October_2022.jpg", credit: "GoToVan from Vancouver, Canada / Wikimedia Commons, CC BY 2.0" },
  "Rogers Centre": { url: "https://upload.wikimedia.org/wikipedia/commons/a/ae/Toronto_Rogers_Centre.jpg", credit: "DXR / Wikimedia Commons, CC BY-SA 4.0" },
  "Scotiabank Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/8/83/Air_Canada_Centre_and_CN_Tower_from_Bay_St.jpg", credit: "Secondarywaltz / Wikimedia Commons, Public domain" },
  "Soldier Field": { url: "https://upload.wikimedia.org/wikipedia/commons/4/4c/Soldier_Field_during_Chicago_Bears_home_game_against_the_San_Francisco_49ers_on_October_29%2C_2006.jpg", credit: "Photo by Joon Han Contact: onejoon@hotmail.com / Wikimedia Commons, CC BY-SA 3.0" },
  "SoFi Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/e/e6/SoFi_Stadium_%2851126606022%29.jpg", credit: "Thank You (21 Millions+) views / Wikimedia Commons, CC BY 2.0" },
  "Spectrum Center": { url: "https://upload.wikimedia.org/wikipedia/commons/2/2a/Charlotte_Bobcats_Arena_hbz.jpg", credit: "DwayneSpradlin at English Wikipedia / Wikimedia Commons, CC BY-SA 3.0" },
  "State Farm Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/9/92/2013.01.26.110133_Philips_Arena_Atlanta_Georgia.jpg", credit: "Hermann Luyken / Wikimedia Commons, CC0" },
  "State Farm Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/4/42/Cardinals_stadium_crop.jpg", credit: "Taken by en:Flickr user MCSixth / Wikimedia Commons, CC BY-SA 2.0" },
  "Sutter Health Park": { url: "https://upload.wikimedia.org/wikipedia/commons/9/91/Raley_Field.jpg", credit: "Cheersless / Wikimedia Commons, CC BY-SA 4.0" },
  "TD Garden": { url: "https://upload.wikimedia.org/wikipedia/commons/3/34/TD_Garden.JPG", credit: "Nywalton at English Wikipedia / Wikimedia Commons, Public domain" },
  "Target Center": { url: "https://upload.wikimedia.org/wikipedia/commons/b/b0/Target_Center_from_First_Avenue_-_Minneapolis_1.jpg", credit: "AlexiusHoratius / Wikimedia Commons, CC BY-SA 3.0" },
  "Target Field": { url: "https://upload.wikimedia.org/wikipedia/commons/6/67/Target_Field_2022.jpg", credit: "Farragutful / Wikimedia Commons, CC BY-SA 4.0" },
  "T-Mobile Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/0/0f/T-Mobile_Arena_in_2024.jpg", credit: "Mbyhrtz / Wikimedia Commons, CC BY-SA 4.0" },
  "T-Mobile Park": { url: "https://upload.wikimedia.org/wikipedia/commons/6/64/SafecoFieldMay2021.jpg", credit: "Sea Cow / Wikimedia Commons, CC BY-SA 4.0" },
  "Toyota Center": { url: "https://upload.wikimedia.org/wikipedia/commons/d/db/Toyota_Center_entr.jpg", credit: "Ed Uthman from Houston, TX, USA / Wikimedia Commons, CC BY 2.0" },
  "Tropicana Field": { url: "https://upload.wikimedia.org/wikipedia/commons/e/e1/Tropicana_Field_Playing_Field_Opening_Day_2010.JPG", credit: "EaglesFanInTampa / Wikimedia Commons, CC BY-SA 3.0" },
  "Truist Park": { url: "https://upload.wikimedia.org/wikipedia/commons/8/87/SunTrust_Park_Opening_Day_2017.jpg", credit: "Thechased at English Wikipedia / Wikimedia Commons, CC BY 4.0" },
  "U.S. Bank Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/7/7e/US_Bank_Stadium_-_West_Facade.jpg", credit: "Darb02 / Wikimedia Commons, CC BY-SA 4.0" },
  "United Center": { url: "https://upload.wikimedia.org/wikipedia/commons/4/47/United_Center_060716.jpg", credit: "User:JeremyA / Wikimedia Commons, CC BY-SA 2.5" },
  "Wintrust Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/6/6f/Wintrust-arena-exterior.jpg", credit: "Swinterroth / Wikimedia Commons, CC BY-SA 4.0" },
  "Wrigley Field": { url: "https://upload.wikimedia.org/wikipedia/commons/a/a7/Wrigley_Field_2018_-_42195054760.jpg", credit: "Ryan Dickey / Wikimedia Commons, CC BY 2.0" },
  "Xfinity Mobile Arena": { url: "https://upload.wikimedia.org/wikipedia/commons/5/50/Wells_Fargo_Center_-_2019_OWL_Grand_Finals.jpg", credit: "Jen Smith / Wikimedia Commons, CC BY 3.0" },
  "Yankee Stadium": { url: "https://upload.wikimedia.org/wikipedia/commons/4/44/Yankee_Stadium_upper_deck_2010.jpg", credit: "Matt Boulton / Wikimedia Commons, CC BY-SA 2.0" },
};

const VENUE_ALIASES: Readonly<Record<string, string>> = {
  "air canada centre": "Scotiabank Arena",
  "firstenergy stadium": "Huntington Bank Field",
  "heinz field": "Acrisure Stadium",
  "new meadowlands stadium": "MetLife Stadium",
  "paul brown stadium": "Paycor Stadium",
  "philips arena": "State Farm Arena",
  "reliant stadium": "NRG Stadium",
  "rocket mortgage fieldhouse": "Rocket Arena",
  "sleep train arena": "Golden 1 Center",
  "staples center": "Crypto.com Arena",
  "wells fargo center": "Xfinity Mobile Arena",
};

const NORMALIZED_VENUE_PHOTOS: Readonly<Record<string, VenuePhoto>> = Object.fromEntries(
  Object.entries(VENUE_PHOTOS).map(([name, photo]) => [normalizeVenueName(name), photo])
);

function normalizeVenueName(value: string | null | undefined): string {
  return String(value ?? "")
    .split(",")[0]
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

export function getVenuePhoto(value: string | null | undefined): VenuePhoto | null {
  const normalized = normalizeVenueName(value);
  if (!normalized) return null;
  const canonical = VENUE_ALIASES[normalized];
  return (canonical ? VENUE_PHOTOS[canonical] : NORMALIZED_VENUE_PHOTOS[normalized]) ?? null;
}
