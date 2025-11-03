# Usage Examples - Team & Game Features

## Example 1: Creating a Team with Venue

```javascript
// Frontend - Team Creation Form
const createTeamWithVenue = async () => {
  // Step 1: Check if user can create more teams
  const limits = await fetch('/api/teams/limits', {
    headers: { Authorization: `Bearer ${token}` }
  }).then(r => r.json());
  
  if (!limits.can_create_more) {
    // Show upgrade prompt
    alert(limits.message); // "You've reached your limit of 2 teams..."
    navigation.navigate('Billing');
    return;
  }
  
  // Step 2: Create the team
  const team = await fetch('/api/teams', {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      name: 'Warriors Basketball',
      description: 'High school varsity team'
    })
  }).then(r => r.json());
  
  // Step 3: Update with venue information
  await fetch(`/api/teams/${team.id}`, {
    method: 'PUT',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      venue_address: '123 Main St, Springfield, IL 62701',
      venue_lat: 39.7817,
      venue_lng: -89.6501,
      venue_place_id: 'ChIJOwg_06VPwokRYv534QaPC8g',
      city: 'Springfield',
      state: 'IL'
    })
  });
  
  console.log('Team created with home venue!');
};
```

---

## Example 2: Creating a Home Game (Location Auto-Filled)

```javascript
// Frontend - Game Creation for Home Team
const createHomeGame = async (homeTeamId) => {
  const game = await fetch('/api/games', {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Warriors vs Tigers',
      home_team_id: homeTeamId, // Location will be auto-filled!
      away_team_id: 'team_456', // If opponent exists in system
      date: '2025-11-15T19:00:00Z'
    })
  }).then(r => r.json());
  
  console.log('Game created at:', game.location); // Auto-filled from team venue
  console.log('Maps link:', game.venue_maps_link); // Google Maps link
};
```

---

## Example 3: Creating an Away Game (Manual Opponent)

```javascript
// Frontend - Away game with opponent NOT in system
const createAwayGame = async (homeTeamId) => {
  const game = await fetch('/api/games', {
    method: 'POST',
    headers: { 
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title: 'Warriors @ Barcelona FC',
      home_team_id: homeTeamId,
      away_team_name: 'Barcelona FC', // Manual opponent name
      location: 'Camp Nou, Barcelona, Spain',
      venue_place_id: 'ChIJi8MeVwSipBIRTeUq9JMkRBY',
      venue_lat: 41.3809,
      venue_lng: 2.1228,
      date: '2025-12-01T18:00:00Z'
    })
  }).then(r => r.json());
  
  console.log('Away team:', game.awayTeam);
  // { name: 'Barcelona FC', profile_link: null }
  console.log('Maps link:', game.venue_maps_link);
  // "https://google.com/maps/place/?q=place_id:ChIJi8MeVwSipBIRTeUq9JMkRBY"
};
```

---

## Example 4: Displaying Game Details with Maps Link

```javascript
// Frontend - Game Details Component
const GameDetails = ({ game }) => {
  return (
    <View>
      <Text>{game.title}</Text>
      
      {/* Home Team */}
      <Link to={`/teams/${game.homeTeam.id}`}>
        {game.homeTeam.name}
      </Link>
      
      <Text>vs</Text>
      
      {/* Away Team - Conditional Linking */}
      {game.awayTeam.profile_link ? (
        <Link to={game.awayTeam.profile_link}>
          {game.awayTeam.name}
        </Link>
      ) : (
        <Text>{game.awayTeam.name}</Text>
      )}
      
      {/* Location with Google Maps Link */}
      <Text>{game.location}</Text>
      {game.venueMapsLink && (
        <a href={game.venueMapsLink} target="_blank">
          📍 View on Google Maps
        </a>
      )}
    </View>
  );
};
```

---

## Example 5: Handling Team Creation Limit

```javascript
// Frontend - Team Creation with Limit Handling
const handleCreateTeam = async (teamData) => {
  try {
    const response = await fetch('/api/teams', {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(teamData)
    });
    
    if (!response.ok) {
      const error = await response.json();
      
      if (error.upgrade_required) {
        // User hit team limit - show upgrade prompt
        Alert.alert(
          'Upgrade Required',
          error.message,
          [
            { text: 'Cancel', style: 'cancel' },
            { 
              text: 'Upgrade Now', 
              onPress: () => navigation.navigate('Billing', {
                reason: 'team_limit',
                currentTeams: error.owned_teams,
                maxTeams: error.max_teams
              })
            }
          ]
        );
        return;
      }
      
      throw new Error(error.message);
    }
    
    const team = await response.json();
    console.log('Team created:', team);
    
  } catch (error) {
    console.error('Failed to create team:', error);
  }
};
```

---

## Example 6: Team Limits Dashboard Widget

```javascript
// Frontend - Display team usage
const TeamLimitWidget = () => {
  const [limits, setLimits] = useState(null);
  
  useEffect(() => {
    fetch('/api/teams/limits', {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(r => r.json())
      .then(setLimits);
  }, []);
  
  if (!limits) return null;
  
  return (
    <View style={styles.widget}>
      <Text>Your Teams: {limits.owned_teams} / {limits.max_teams}</Text>
      
      {limits.can_create_more ? (
        <Button 
          title="Create New Team" 
          onPress={showCreateTeamForm}
        />
      ) : (
        <View>
          <Text>You've reached your team limit</Text>
          <Button 
            title="Upgrade to Create More" 
            onPress={() => navigation.navigate('Billing')}
          />
        </View>
      )}
      
      {limits.subscription_tier === 'free' && (
        <Text style={styles.hint}>
          Upgrade to Premium for up to 10 teams!
        </Text>
      )}
    </View>
  );
};
```

---

## Example 7: Google Places Autocomplete for Venue

```javascript
// Frontend - Team Venue Input with Google Places
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';

const VenueInput = ({ teamId, onSave }) => {
  const handlePlaceSelect = async (data, details) => {
    const venue = {
      venue_address: details.formatted_address,
      venue_lat: details.geometry.location.lat,
      venue_lng: details.geometry.location.lng,
      venue_place_id: details.place_id,
      city: details.address_components.find(c => 
        c.types.includes('locality')
      )?.long_name,
      state: details.address_components.find(c => 
        c.types.includes('administrative_area_level_1')
      )?.short_name
    };
    
    await fetch(`/api/teams/${teamId}`, {
      method: 'PUT',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(venue)
    });
    
    onSave(venue);
  };
  
  return (
    <GooglePlacesAutocomplete
      placeholder="Enter home venue address"
      onPress={handlePlaceSelect}
      query={{
        key: GOOGLE_MAPS_API_KEY,
        language: 'en',
        types: 'establishment' // Filter to stadiums, arenas, etc.
      }}
      fetchDetails={true}
    />
  );
};
```

---

## Example 8: Billing/Upgrade Page

```javascript
// Frontend - Subscription Upgrade Page
const BillingPage = ({ route }) => {
  const { reason, message } = route.params || {};
  
  const subscriptionTiers = [
    {
      name: 'Free',
      price: '$0',
      teams: 2,
      features: ['2 teams', 'Basic features']
    },
    {
      name: 'Premium',
      price: '$9.99/mo',
      teams: 10,
      features: ['10 teams', 'Advanced analytics', 'Priority support']
    },
    {
      name: 'Pro',
      price: '$29.99/mo',
      teams: 'Unlimited',
      features: ['Unlimited teams', 'Custom branding', 'API access']
    }
  ];
  
  const handleUpgrade = async (tier) => {
    // Stripe checkout integration
    const session = await fetch('/api/billing/create-checkout', {
      method: 'POST',
      headers: { 
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ tier })
    }).then(r => r.json());
    
    // Redirect to Stripe checkout
    window.location.href = session.url;
  };
  
  return (
    <View>
      {reason === 'team_limit' && (
        <Text style={styles.alert}>{message}</Text>
      )}
      
      <Text>Choose Your Plan</Text>
      
      {subscriptionTiers.map(tier => (
        <View key={tier.name} style={styles.tierCard}>
          <Text style={styles.tierName}>{tier.name}</Text>
          <Text style={styles.price}>{tier.price}</Text>
          <Text>Up to {tier.teams} teams</Text>
          {tier.features.map(f => (
            <Text key={f}>✓ {f}</Text>
          ))}
          <Button 
            title={`Upgrade to ${tier.name}`}
            onPress={() => handleUpgrade(tier.name.toLowerCase())}
          />
        </View>
      ))}
    </View>
  );
};
```

---

## Example 9: Search for Opponent Teams

```javascript
// Frontend - Opponent Team Search
const OpponentTeamSearch = ({ onSelect }) => {
  const [query, setQuery] = useState('');
  const [teams, setTeams] = useState([]);
  const [isManual, setIsManual] = useState(false);
  
  useEffect(() => {
    if (query.length < 2) return;
    
    // Search for teams in the system
    fetch(`/api/teams?q=${encodeURIComponent(query)}`)
      .then(r => r.json())
      .then(setTeams);
  }, [query]);
  
  return (
    <View>
      <TextInput 
        placeholder="Search opponent team..."
        value={query}
        onChangeText={setQuery}
      />
      
      {teams.length > 0 ? (
        <FlatList
          data={teams}
          renderItem={({ item }) => (
            <TouchableOpacity onPress={() => onSelect({ 
              away_team_id: item.id 
            })}>
              <Text>{item.name}</Text>
              <Text>{item.city}, {item.state}</Text>
            </TouchableOpacity>
          )}
        />
      ) : query.length > 2 ? (
        <View>
          <Text>No teams found</Text>
          <Button 
            title={`Use "${query}" as opponent name`}
            onPress={() => onSelect({ 
              away_team_name: query 
            })}
          />
        </View>
      ) : null}
    </View>
  );
};
```

---

## Example 10: Complete Game Creation Flow

```javascript
// Frontend - Full Game Creation Component
const CreateGameScreen = ({ homeTeamId }) => {
  const [gameData, setGameData] = useState({
    title: '',
    home_team_id: homeTeamId,
    away_team_id: null,
    away_team_name: null,
    date: new Date(),
    location: '',
    venue_place_id: null
  });
  
  const handleSubmit = async () => {
    try {
      const response = await fetch('/api/games', {
        method: 'POST',
        headers: { 
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          ...gameData,
          date: gameData.date.toISOString()
        })
      });
      
      const game = await response.json();
      
      Alert.alert(
        'Game Created!',
        `${game.title}\n📍 ${game.location}`,
        [
          { text: 'View Game', onPress: () => navigation.navigate('GameDetail', { id: game.id }) },
          { text: 'View on Maps', onPress: () => Linking.openURL(game.venue_maps_link) }
        ]
      );
      
    } catch (error) {
      Alert.alert('Error', error.message);
    }
  };
  
  return (
    <ScrollView>
      <TextInput 
        placeholder="Game Title"
        value={gameData.title}
        onChangeText={(title) => setGameData({ ...gameData, title })}
      />
      
      <OpponentTeamSearch 
        onSelect={(opponent) => setGameData({ ...gameData, ...opponent })}
      />
      
      <DatePicker 
        value={gameData.date}
        onChange={(date) => setGameData({ ...gameData, date })}
      />
      
      <VenueInput 
        onSelect={(venue) => setGameData({ ...gameData, ...venue })}
      />
      
      <Button title="Create Game" onPress={handleSubmit} />
    </ScrollView>
  );
};
```

---

**All examples use the new API endpoints and features implemented in the backend!**
