import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Code, Database, Settings, Users, Zap, FileText } from 'lucide-react';

// VarsityHub Project Documentation Component
export default function ProjectReadme() {
  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="text-center mb-8">
        <h1 className="text-4xl font-bold mb-4">VarsityHub</h1>
        <p className="text-xl text-muted-foreground">Sports Community Platform</p>
        <Badge className="mt-2">v1.0.0</Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            Quick Start
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-gray-900 text-green-400 p-4 rounded-lg font-mono text-sm">
            <div># Clone the repository</div>
            <div>git clone https://github.com/your-org/varsityhub.git</div>
            <div>cd varsityhub</div>
            <div></div>
            <div># Install dependencies</div>
            <div>npm install</div>
            <div></div>
            <div># Start development server</div>
            <div>npm run dev</div>
          </div>
          <p className="text-sm text-muted-foreground">
            Visit http://localhost:3000 to see the application running.
          </p>
        </CardContent>
      </Card>

      <div className="grid md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Users className="w-5 h-5" />
              User Account Types
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="border rounded p-3">
              <h4 className="font-semibold">Fan/Parent</h4>
              <p className="text-sm text-muted-foreground">Discover games, follow teams, create events</p>
            </div>
            <div className="border rounded p-3">
              <h4 className="font-semibold">Coach/Organizer</h4>
              <p className="text-sm text-muted-foreground">Manage teams, create official events, assign roles</p>
              <div className="flex gap-1 mt-2">
                <Badge variant="outline" className="text-xs">Rookie $20</Badge>
                <Badge variant="outline" className="text-xs">Veteran $70</Badge>
                <Badge variant="outline" className="text-xs">Legend $150</Badge>
              </div>
            </div>
            <div className="border rounded p-3">
              <h4 className="font-semibold">Team Member</h4>
              <p className="text-sm text-muted-foreground">Join teams, share highlights, connect</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Zap className="w-5 h-5" />
              Core Features
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800">Live</Badge>
              <span className="text-sm">User Authentication & Onboarding</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800">Live</Badge>
              <span className="text-sm">Feed & Discovery</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800">Live</Badge>
              <span className="text-sm">Messaging System</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800">Live</Badge>
              <span className="text-sm">Event Management</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800">Live</Badge>
              <span className="text-sm">Team Management</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge className="bg-green-100 text-green-800">Live</Badge>
              <span className="text-sm">Local Advertising</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            Hidden/Incomplete Features
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground mb-4">
            These features are built but disabled via feature flags:
          </p>
          <div className="grid md:grid-cols-2 gap-3">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Hidden</Badge>
              <span className="text-sm">Freelancer Marketplace</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Hidden</Badge>
              <span className="text-sm">Sponsorship Auctions</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Hidden</Badge>
              <span className="text-sm">Advanced Ad Logic</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Hidden</Badge>
              <span className="text-sm">Media Download System</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Hidden</Badge>
              <span className="text-sm">Promo Code System</span>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary">Hidden</Badge>
              <span className="text-sm">Live Scoring</span>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Database className="w-5 h-5" />
            Environment Variables
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm space-y-1">
            <div># Base44 Platform</div>
            <div>REACT_APP_BASE44_APP_ID=your_app_id_here</div>
            <div>REACT_APP_BASE44_OWNER=your_owner_email_here</div>
            <div></div>
            <div># Stripe Payment Processing</div>
            <div>REACT_APP_STRIPE_PUBLISHABLE_KEY=pk_test_...</div>
            <div>STRIPE_SECRET_KEY=sk_test_...</div>
            <div></div>
            <div># Google Maps</div>
            <div>REACT_APP_GOOGLE_MAPS_API_KEY=your_google_maps_key</div>
            <div></div>
            <div># Feature Flags</div>
            <div>REACT_APP_ENABLE_FREELANCER_FEATURES=false</div>
            <div>REACT_APP_ENABLE_SPONSORSHIP_AUCTIONS=false</div>
            <div>REACT_APP_ENABLE_ADVANCED_ADS=false</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Code className="w-5 h-5" />
            Project Structure
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="bg-gray-50 p-4 rounded-lg font-mono text-sm">
            <div>src/</div>
            <div>├── components/           # Reusable UI components</div>
            <div>│   ├── nav/             # Navigation components</div>
            <div>│   ├── posts/           # Post-related components</div>
            <div>│   ├── games/           # Game/event components</div>
            <div>│   ├── discover/        # Discovery page components</div>
            <div>│   ├── messaging/       # Chat and messaging</div>
            <div>│   ├── settings/        # Settings pages</div>
            <div>│   ├── ads/            # Advertisement components</div>
            <div>│   └── ui/             # Base UI components</div>
            <div>├── pages/              # Main application pages</div>
            <div>├── entities/           # Database schema definitions</div>
            <div>├── integrations/       # External service integrations</div>
            <div>└── Layout.js          # Main app layout wrapper</div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Safety & Age Restrictions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="p-3 bg-yellow-50 border border-yellow-200 rounded">
            <p className="font-medium text-yellow-800">Age-Based Messaging</p>
            <p className="text-sm text-yellow-700">Users under 18 can only message other minors. Adults can only message other adults. Coaches can message anyone in professional context.</p>
          </div>
          <div className="p-3 bg-blue-50 border border-blue-200 rounded">
            <p className="font-medium text-blue-800">Content Moderation</p>
            <p className="text-sm text-blue-700">Automated hate speech detection, community reporting system, and admin review workflow for flagged content.</p>
          </div>
        </CardContent>
      </Card>

      <div className="text-center pt-6">
        <Button size="lg">
          Ready for Development! 🏈⚾🏀
        </Button>
      </div>
    </div>
  );
}