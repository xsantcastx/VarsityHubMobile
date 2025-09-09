import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ArrowLeft, UserX, Plus, Trash2 } from 'lucide-react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';

export default function BlockedUsers() {
  const [user, setUser] = useState(null);
  const [blockedUsers, setBlockedUsers] = useState([]);
  const [newBlockEmail, setNewBlockEmail] = useState('');
  const [showBlockDialog, setShowBlockDialog] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await User.me();
        setUser(currentUser);
        setBlockedUsers(currentUser.blocked_users || []);
      } catch (error) {
        console.error("Failed to load blocked users:", error);
      }
    };
    loadData();
  }, []);

  const handleBlockUser = async () => {
    if (!newBlockEmail.trim()) return;
    
    try {
      const updatedBlocked = [...blockedUsers, newBlockEmail];
      await User.updateMyUserData({ blocked_users: updatedBlocked });
      setBlockedUsers(updatedBlocked);
      setNewBlockEmail('');
      setShowBlockDialog(false);
      alert(`${newBlockEmail} has been blocked`);
    } catch (error) {
      console.error("Failed to block user:", error);
    }
  };

  const handleUnblockUser = async (email) => {
    if (!confirm(`Unblock ${email}?`)) return;
    
    try {
      const updatedBlocked = blockedUsers.filter(e => e !== email);
      await User.updateMyUserData({ blocked_users: updatedBlocked });
      setBlockedUsers(updatedBlocked);
    } catch (error) {
      console.error("Failed to unblock user:", error);
    }
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="w-5 h-5" />
            </Button>
            <h1 className="text-xl font-bold">Blocked Users</h1>
          </div>
          <Dialog open={showBlockDialog} onOpenChange={setShowBlockDialog}>
            <DialogTrigger asChild>
              <Button variant="outline">
                <Plus className="w-4 h-4 mr-2" />
                Block User
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Block User</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <Input
                  placeholder="Enter email or username"
                  value={newBlockEmail}
                  onChange={(e) => setNewBlockEmail(e.target.value)}
                />
                <Button onClick={handleBlockUser} className="w-full">
                  Block User
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        {blockedUsers.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <UserX className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No blocked users</h3>
              <p className="text-muted-foreground">Users you block won't be able to contact you or see your content</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-4">
            {blockedUsers.map((email, index) => (
              <Card key={index}>
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium">{email}</p>
                      <p className="text-sm text-muted-foreground">Blocked user</p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleUnblockUser(email)}
                    >
                      Unblock
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}