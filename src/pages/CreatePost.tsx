
import React, { useState, useEffect } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Send, Camera, Video, Image, X, ChevronUp, ChevronDown, Edit, MapPin } from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { motion, AnimatePresence } from "framer-motion";
import { Switch } from "@/components/ui/switch"; 
import { Label } from "@/components/ui/label"; 
import { Post, User, Event } from "@/api/entities"; 

const sportQuotes = [
  "Great hustle out there today!",
  "What a display of teamwork.",
  "Respect for every player on the field.",
  "This is what sports are all about.",
  "Win or lose, the effort was incredible.",
  "Celebrating the spirit of the game.",
  "Who showed the most heart today?",
  "Mad respect for the opponent's skill.",
  "Sportsmanship always wins.",
  "Pure class from both teams.",
  "That's how you compete with integrity.",
  "Love seeing this level of dedication.",
  "What was the most sportsmanlike moment?",
  "Shoutout to the coaches for their guidance.",
  "The future of the sport is bright.",
  "A performance to be proud of.",
  "More than a game. It's about character.",
  "Incredible effort from start to finish.",
  "Building character through competition.",
  "This is why we sports.",
  "A true test of skill and spirit.",
  "Both teams left it all out there.",
  "Let's talk about that amazing play!",
  "Who was the unsung hero of the game?",
  "The atmosphere here is electric and positive.",
  "This game is a great example for young athletes.",
  "Hats off to the winners, and respect to the runners-up.",
  "Clean, fair, and intense competition.",
  "The mutual respect is awesome to see.",
  "Let's keep the conversation positive and respectful.",
  "What can we learn from today's game?",
  "Passion and perseverance on full display."
];

export default function CreatePost() {
  const [currentPrompt, setCurrentPrompt] = useState(0);
  const [content, setContent] = useState("");
  const [mode, setMode] = useState('normal'); 
  const [isTyping, setIsTyping] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  const [gameId, setGameId] = useState(null);
  const [eventId, setEventId] = useState(null); // New state for tagging an event
  const [teamId, setTeamId] = useState(null);   // New state for tagging a team
  const [isStoryPost, setIsStoryPost] = useState(false); 
  const [user, setUser] = useState(null); 
  const [nearbyEvents, setNearbyEvents] = useState([]); // New state for nearby events
  const [locationData, setLocationData] = useState(null); // Location data state

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentPrompt((prev) => (prev + 1) % sportQuotes.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const loadData = async () => {
        try {
            const currentUser = await User.me();
            setUser(currentUser);
        } catch (e) {
            console.error("User not logged in:", e);
            // Handle not logged in case, maybe redirect or show a message
        }

        const params = new URLSearchParams(location.search);
        const urlGameId = params.get('gameId');
        // Removed urlIsStory and urlMode as they are no longer handled via URL for initial state
        if (urlGameId) setGameId(urlGameId);
    };
    loadData();
  }, [location.search]); // Depend on location.search to re-run if URL params change
  
  // Location detection and nearby event suggestion
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude, accuracy } = position.coords;
          setLocationData({ latitude, longitude, accuracy });
          
          // Fetch nearby events - simplistic approach
          // A real app would use a backend endpoint for geo-queries
          try {
            const allEvents = await Event.filter({ status: 'approved' }); // Assuming Event.filter exists
            const eventsWithDistance = allEvents.map(event => {
                // Simple Euclidean distance for demonstration. Real apps use Haversine.
                const dist = Math.sqrt(
                    Math.pow((event.latitude || 0) - latitude, 2) + Math.pow((event.longitude || 0) - longitude, 2)
                );
                return { ...event, distance: dist };
            });
            
            const sortedEvents = eventsWithDistance
                .filter(e => e.distance < 0.05) // a rough filter for "nearby" (e.g., within 50km if coords are in degrees)
                .sort((a, b) => a.distance - b.distance);
            
            setNearbyEvents(sortedEvents.slice(0, 3));
          } catch (error) {
              console.error("Failed to fetch events:", error);
          }
        },
        (error) => {
          console.log("Location access denied or failed:", error);
        }
      );
    }
  }, []);

  const handleSubmit = async () => {
    if (!user) {
        alert("Cannot create a post. You must be logged in.");
        return;
    }

    if (!content.trim()) {
        alert("Please add some content to your post.");
        return;
    }

    try {
        await Post.create({
            game_id: gameId,
            event_id: eventId, // Include eventId if selected
            team_id: teamId,   // Include teamId if selected
            author_email: user.email,
            content: content,
            is_story: isStoryPost,
            // For now, type is hardcoded to 'text'. A real implementation would handle media uploads.
            type: 'text', 
            location_data: locationData, // Include location for event tagging
        });
        navigate(-1); // Go back to the previous page (e.g., game detail page or discover feed)
    } catch (error) {
        console.error("Failed to create post:", error);
        alert("There was an error creating your post.");
    }
  };

  const handleContentChange = (e) => {
    setContent(e.target.value);
    setIsTyping(e.target.value.length > 0);
  };

  const handleTextareaFocus = () => {
    setIsTyping(true);
  };

  const handleTextareaBlur = () => {
    setIsTyping(content.length > 0);
  };

  if (mode === 'camera') {
    return (
      <div className="fixed inset-0 bg-black z-50 flex flex-col justify-end">
          <div className="text-center text-white space-y-4 p-8">
            <Button variant="ghost" size="icon" className="absolute top-4 left-4 text-white hover:bg-white/20" onClick={() => setMode('normal')}>
                <X className="w-6 h-6" />
            </Button>
            <div className="w-24 h-24 border-4 border-white rounded-full flex items-center justify-center mx-auto mb-6 cursor-pointer hover:bg-white/10 transition-colors">
              <div className="w-20 h-20 bg-white rounded-full" />
            </div>
            <p className="text-sm opacity-80 font-sans">Tap to take photo • Hold to record video</p>
            <div className="flex justify-center gap-8 mt-8">
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <Image className="w-6 h-6" />
              </Button>
              <Button variant="ghost" size="icon" className="text-white hover:bg-white/20">
                <Video className="w-6 h-6" />
              </Button>
            </div>
          </div>
      </div>);
  }

  return (
    <div className="fixed inset-0 bg-background z-50 flex flex-col">
      {/* Header */}
      <header className="flex justify-between items-center p-4 border-b border-border bg-background/80 backdrop-blur-sm">
        <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
          <X className="w-6 h-6" />
        </Button>
        <Button onClick={handleSubmit} className="bg-primary hover:bg-primary/90 text-primary-foreground rounded-full" disabled={!content.trim()}>
          Post <Send className="w-4 h-4 ml-2" />
        </Button>
      </header>

      {/* Top Half: Input and Suggestions */}
      <div className="flex-1 p-4 flex flex-col">
        {nearbyEvents.length > 0 && (
            <div className="mb-4">
                <p className="text-xs text-muted-foreground mb-2 flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    Nearby Events:
                </p>
                <div className="flex flex-wrap gap-2">
                    {nearbyEvents.map(event => (
                        <Button 
                            key={event.id}
                            variant={eventId === event.id ? 'default' : 'outline'}
                            size="sm"
                            onClick={() => setEventId(eventId === event.id ? null : event.id)}
                            className="bg-primary/10 text-primary hover:bg-primary/20"
                        >
                            {event.title}
                        </Button>
                    ))}
                </div>
            </div>
        )}
        <div className="relative flex-grow">
          <Textarea
            placeholder={sportQuotes[currentPrompt]}
            value={content}
            onChange={handleContentChange}
            onFocus={handleTextareaFocus}
            onBlur={handleTextareaBlur}
            className="w-full h-full text-lg border-none focus-visible:ring-0 resize-none bg-transparent" />
        </div>
         <p className="text-xs text-muted-foreground text-center py-2">Use # to tag teams and @ to mention players</p>
      </div>

      {/* Middle Swipeable Bar */}
      <motion.div
        className="flex-none h-16 bg-gradient-to-r from-primary/80 to-primary flex flex-col items-center justify-center cursor-grab active:cursor-grabbing relative overflow-hidden"
        drag="y"
        dragConstraints={{ top: -100, bottom: 50 }} // Allow dragging a bit down too, for a softer feel
        dragElastic={{ top: 0.2, bottom: 0.2 }}
        onDragEnd={(event, info) => { 
          // Only change mode if dragged significantly upwards
          if (info.offset.y < -50) { 
            setMode('camera');
          } else {
            // Snap back if not dragged enough, or if dragged downwards
            // Or if dragged downwards, can trigger a different action later
            // For now, no specific action on drag down, just reverts
            setMode('normal');
          }
        }}
        whileDrag={{ scale: 1.05 }}>

        <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-primary/20" />
        
        <div className="relative h-12 w-full flex items-center justify-center overflow-hidden">
            {/* Simplified swipe instruction, only "Swipe up for camera" */}
            <div className="bg-sky-300 text-white absolute inset-0 flex items-center justify-center gap-3">
                  <ChevronUp className="w-5 h-5 opacity-60" />
                  <span className="font-medium">Swipe up for camera</span>
            </div>
        </div>

        {/* Visual indicator */}
        <div className="absolute inset-x-0 bottom-0 h-1 bg-white/30" />
      </motion.div>

      {/* Bottom Half: Normal Content */}
      <AnimatePresence mode="wait">
        <motion.div
          key={mode}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
          className={`flex-none bg-background/95 transition-all duration-300 ${
          isTyping ? 'h-0 overflow-hidden' : 'h-1/2'}`
          }>

          {mode === 'normal' && !isTyping &&
          <div className="p-6 space-y-6">
              <div className="grid grid-cols-3 gap-6">
                <motion.div
                className="flex flex-col items-center gap-3"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}>

                  <Button variant="outline" size="icon" className="w-16 h-16 rounded-2xl">
                    <Image className="w-8 h-8" />
                  </Button>
                  <span className="text-sm font-medium text-white">Upload Photo</span>
                </motion.div>
                
                <motion.div
                className="flex flex-col items-center gap-3"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}>

                  <Button
                  variant="outline"
                  size="icon"
                  className="w-20 h-20 rounded-2xl border-primary/50 border-2 text-primary hover:bg-primary/10"
                  onClick={() => setMode('camera')}>

                    <Camera className="w-10 h-10" />
                  </Button>
                  <span className="text-sm font-medium text-white">Live Capture</span>
                </motion.div>
                
                <motion.div
                className="flex flex-col items-center gap-3"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}>

                  <Button variant="outline" size="icon" className="w-16 h-16 rounded-2xl">
                    <Video className="w-8 h-8" />
                  </Button>
                  <span className="text-sm font-medium text-white">Upload Video</span>
                </motion.div>
              </div>
              
              <div className="text-center text-xs text-muted-foreground space-y-1">
                <p className="font-medium text-primary">Respect all the players on the field.</p>
              </div>
            </div>
          }
        </motion.div>
      </AnimatePresence>
    </div>);
}
