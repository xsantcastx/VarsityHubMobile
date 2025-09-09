import Layout from "./Layout.jsx";

import Profile from "./Profile";

import GameDetail from "./GameDetail";

import Highlights from "./Highlights";

import Feed from "./Feed";

import CreatePost from "./CreatePost";

import TeamProfile from "./TeamProfile";

import Discover from "./Discover";

import EventDetail from "./EventDetail";

import PublicEvent from "./PublicEvent";

import Messages from "./Messages";

import RoleOnboarding from "./RoleOnboarding";

import Onboarding from "./Onboarding";

import CreateFanEvent from "./CreateFanEvent";

import CreateTeam from "./CreateTeam";

import Settings from "./Settings";

import ManageTeams from "./ManageTeams";

import ManageUsers from "./ManageUsers";

import Billing from "./Billing";

import Following from "./Following";

import BlockedUsers from "./BlockedUsers";

import CoreValues from "./CoreValues";

import ReportAbuse from "./ReportAbuse";

import RSVPHistory from "./RSVPHistory";

import AppGuide from "./AppGuide";

import DMRestrictions from "./DMRestrictions";

import Favorites from "./Favorites";

import MyTeam from "./MyTeam";

import ArchiveSeasons from "./ArchiveSeasons";

import EditTeam from "./EditTeam";

import ManageSeason from "./ManageSeason";

import TeamContacts from "./TeamContacts";

import EditProfile from "./EditProfile";

import SubmitAd from "./SubmitAd";

import AdCalendar from "./AdCalendar";

import { BrowserRouter as Router, Route, Routes, useLocation } from 'react-router-dom';

const PAGES = {
    
    Profile: Profile,
    
    GameDetail: GameDetail,
    
    Highlights: Highlights,
    
    Feed: Feed,
    
    CreatePost: CreatePost,
    
    TeamProfile: TeamProfile,
    
    Discover: Discover,
    
    EventDetail: EventDetail,
    
    PublicEvent: PublicEvent,
    
    Messages: Messages,
    
    RoleOnboarding: RoleOnboarding,
    
    Onboarding: Onboarding,
    
    CreateFanEvent: CreateFanEvent,
    
    CreateTeam: CreateTeam,
    
    Settings: Settings,
    
    ManageTeams: ManageTeams,
    
    ManageUsers: ManageUsers,
    
    Billing: Billing,
    
    Following: Following,
    
    BlockedUsers: BlockedUsers,
    
    CoreValues: CoreValues,
    
    ReportAbuse: ReportAbuse,
    
    RSVPHistory: RSVPHistory,
    
    AppGuide: AppGuide,
    
    DMRestrictions: DMRestrictions,
    
    Favorites: Favorites,
    
    MyTeam: MyTeam,
    
    ArchiveSeasons: ArchiveSeasons,
    
    EditTeam: EditTeam,
    
    ManageSeason: ManageSeason,
    
    TeamContacts: TeamContacts,
    
    EditProfile: EditProfile,
    
    SubmitAd: SubmitAd,
    
    AdCalendar: AdCalendar,
    
}

function _getCurrentPage(url) {
    if (url.endsWith('/')) {
        url = url.slice(0, -1);
    }
    let urlLastPart = url.split('/').pop();
    if (urlLastPart.includes('?')) {
        urlLastPart = urlLastPart.split('?')[0];
    }

    const pageName = Object.keys(PAGES).find(page => page.toLowerCase() === urlLastPart.toLowerCase());
    return pageName || Object.keys(PAGES)[0];
}

// Create a wrapper component that uses useLocation inside the Router context
function PagesContent() {
    const location = useLocation();
    const currentPage = _getCurrentPage(location.pathname);
    
    return (
        <Layout currentPageName={currentPage}>
            <Routes>            
                
                    <Route path="/" element={<Profile />} />
                
                
                <Route path="/Profile" element={<Profile />} />
                
                <Route path="/GameDetail" element={<GameDetail />} />
                
                <Route path="/Highlights" element={<Highlights />} />
                
                <Route path="/Feed" element={<Feed />} />
                
                <Route path="/CreatePost" element={<CreatePost />} />
                
                <Route path="/TeamProfile" element={<TeamProfile />} />
                
                <Route path="/Discover" element={<Discover />} />
                
                <Route path="/EventDetail" element={<EventDetail />} />
                
                <Route path="/PublicEvent" element={<PublicEvent />} />
                
                <Route path="/Messages" element={<Messages />} />
                
                <Route path="/RoleOnboarding" element={<RoleOnboarding />} />
                
                <Route path="/Onboarding" element={<Onboarding />} />
                
                <Route path="/CreateFanEvent" element={<CreateFanEvent />} />
                
                <Route path="/CreateTeam" element={<CreateTeam />} />
                
                <Route path="/Settings" element={<Settings />} />
                
                <Route path="/ManageTeams" element={<ManageTeams />} />
                
                <Route path="/ManageUsers" element={<ManageUsers />} />
                
                <Route path="/Billing" element={<Billing />} />
                
                <Route path="/Following" element={<Following />} />
                
                <Route path="/BlockedUsers" element={<BlockedUsers />} />
                
                <Route path="/CoreValues" element={<CoreValues />} />
                
                <Route path="/ReportAbuse" element={<ReportAbuse />} />
                
                <Route path="/RSVPHistory" element={<RSVPHistory />} />
                
                <Route path="/AppGuide" element={<AppGuide />} />
                
                <Route path="/DMRestrictions" element={<DMRestrictions />} />
                
                <Route path="/Favorites" element={<Favorites />} />
                
                <Route path="/MyTeam" element={<MyTeam />} />
                
                <Route path="/ArchiveSeasons" element={<ArchiveSeasons />} />
                
                <Route path="/EditTeam" element={<EditTeam />} />
                
                <Route path="/ManageSeason" element={<ManageSeason />} />
                
                <Route path="/TeamContacts" element={<TeamContacts />} />
                
                <Route path="/EditProfile" element={<EditProfile />} />
                
                <Route path="/SubmitAd" element={<SubmitAd />} />
                
                <Route path="/AdCalendar" element={<AdCalendar />} />
                
            </Routes>
        </Layout>
    );
}

export default function Pages() {
    return (
        <Router>
            <PagesContent />
        </Router>
    );
}