
import React, { useState, useEffect } from 'react';
import { Message, User } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Search, MessageCircle, Send, AlertTriangle, Shield } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { motion, AnimatePresence } from 'framer-motion';
import SafeZoneModal from "../components/messaging/SafeZoneModal";

const getAge = (dateString) => {
    if (!dateString) return null;
    const today = new Date();
    const birthDate = new Date(dateString);
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
};

// Enhanced age-based messaging restrictions
const canUsersMessage = (user1, user2) => {
  // Coaches can be contacted by anyone
  if (user1.user_role === 'coach_organizer' || user2.user_role === 'coach_organizer') {
    return true;
  }
  
  const user1Age = getAge(user1.date_of_birth);
  const user2Age = getAge(user2.date_of_birth);
  
  // If either age is unknown, default to restricted
  if (user1Age === null || user2Age === null) return false;
  
  const user1IsMinor = user1Age < 18;
  const user2IsMinor = user2Age < 18;
  
  // Minors can only message other minors, adults can only message other adults
  return user1IsMinor === user2IsMinor;
};

export default function Messages() {
  const [conversations, setConversations] = useState([]);
  const [activeConversation, setActiveConversation] = useState(null);
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [user, setUser] = useState(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showSafeZoneModal, setShowSafeZoneModal] = useState(false);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const currentUser = await User.me();
      setUser(currentUser);
      
      // Get all messages where user is sender or recipient
      const userMessages = await Message.filter({
        $or: [
          { sender_email: currentUser.email },
          { recipient_email: currentUser.email }
        ]
      }, '-created_date');

      // Group messages by conversation_id
      const conversationMap = {};
      userMessages.forEach(msg => {
        if (!conversationMap[msg.conversation_id]) {
          conversationMap[msg.conversation_id] = [];
        }
        conversationMap[msg.conversation_id].push(msg);
      });

      // Create conversation list with latest message
      const conversationList = Object.keys(conversationMap).map(convId => {
        const msgs = conversationMap[convId];
        const latestMsg = msgs[0]; // Already sorted by -created_date
        const otherUserEmail = latestMsg.sender_email === currentUser.email 
          ? latestMsg.recipient_email 
          : latestMsg.sender_email;
        
        return {
          id: convId,
          otherUserEmail,
          latestMessage: latestMsg,
          unreadCount: msgs.filter(m => !m.read && m.recipient_email === currentUser.email).length
        };
      });
      
      const urlParams = new URLSearchParams(window.location.search);
      const newConversationId = urlParams.get('conversationId');
      const recipientEmail = urlParams.get('recipientEmail');
      let finalConversationList = [...conversationList];

      if (newConversationId && recipientEmail && currentUser.email !== recipientEmail) { // Ensure not messaging self
        const existingConv = finalConversationList.find(c => c.id === newConversationId);
        if (!existingConv) {
            // This is a new conversation, create a virtual one to start with
            const virtualConv = {
                id: newConversationId,
                otherUserEmail: recipientEmail,
                latestMessage: { 
                  content: `Start your conversation with ${recipientEmail.split('@')[0]}`, 
                  created_date: new Date().toISOString() 
                },
                unreadCount: 0,
                isVirtual: true, // Mark as virtual
            };
            finalConversationList.unshift(virtualConv); // Add to the beginning of the list
        }
        setActiveConversation(newConversationId);
        setMessages([]); // Clear messages for the new conversation view
      }

      setConversations(finalConversationList);
    } catch (error) {
      console.error('Error loading messages:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadConversation = async (conversationId) => {
    // If it's a virtual conversation, there are no messages yet
    const conversation = conversations.find(c => c.id === conversationId);
    if (conversation && conversation.isVirtual) {
        setMessages([]);
        setActiveConversation(conversationId);
        return;
    }

    const conversationMessages = await Message.filter(
      { conversation_id: conversationId },
      'created_date'
    );
    setMessages(conversationMessages);
    setActiveConversation(conversationId);

    // Mark messages as read
    const unreadMessages = conversationMessages.filter(
      msg => !msg.read && msg.recipient_email === user.email
    );
    for (const msg of unreadMessages) {
      await Message.update(msg.id, { read: true });
    }
    
    // loadData(); // Refresh conversations to update unread counts - this is handled after sendMessage
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!newMessage.trim() || !activeConversation) return;

    const conversation = conversations.find(c => c.id === activeConversation);
    if (!conversation) return;
    
    // Check if it's a virtual conversation and we need to fetch recipient data
    // Or if it's an existing conversation, we still need to verify age if not already done.
    try {
        const [recipientUser] = await User.filter({ email: conversation.otherUserEmail });
        if (!recipientUser) {
            alert("Could not find recipient user.");
            return;
        }

        // Check if users can message each other based on age
        if (!canUsersMessage(user, recipientUser)) {
            alert("Messaging not allowed due to age restrictions.");
            return;
        }

    } catch (error) {
        console.error("Error during safety verification:", error);
        alert("Could not verify recipient's profile. Message not sent.");
        return;
    }

    try {
      const messagePayload = {
        conversation_id: activeConversation,
        sender_email: user.email,
        recipient_email: conversation.otherUserEmail,
        content: newMessage,
        message_type: 'text',
      };

      // Add participants for the first message of a 1-on-1 chat if it's a virtual conversation
      if (conversation.isVirtual) {
          messagePayload.participants = [user.email, conversation.otherUserEmail];
      }

      await Message.create(messagePayload);

      setNewMessage('');
      
      // Clean up URL params after sending the first message
      // This is crucial if we started from a profile page.
      const url = new URL(window.location.href);
      if (url.searchParams.has('conversationId') || url.searchParams.has('recipientEmail')) {
          url.searchParams.delete('conversationId');
          url.searchParams.delete('recipientEmail');
          window.history.pushState({}, '', url.toString());
      }

      // Reload messages in the active chat and then reload the whole conversation list
      // This ensures the new message appears and the conversation is properly listed/updated.
      await loadConversation(activeConversation); 
      await loadData(); 
    } catch (error) {
      console.error('Error sending message:', error);
    }
  };

  const getUserRoleInfo = (userType) => {
    const roleConfig = {
      fan_parent: { 
        color: 'bg-blue-100 text-blue-700', 
        label: 'Fan/Parent',
        icon: '👨‍👩‍👧‍👦'
      },
      coach_organizer: { 
        color: 'bg-green-100 text-green-700', 
        label: 'Coach',
        icon: '🏃‍♂️'
      },
      athlete: { 
        color: 'bg-purple-100 text-purple-700', 
        label: 'Athlete',
        icon: '⚡'
      },
      freelancer: { 
        color: 'bg-orange-100 text-orange-700', 
        label: 'Freelancer',
        icon: '📸'
      }
    };
    return roleConfig[userType] || roleConfig.fan_parent;
  };

  if (isLoading) {
    return <div className="p-8 text-center">Loading messages...</div>;
  }

  const activeConversationData = conversations.find(c => c.id === activeConversation);

  return (
    <div className="h-screen flex flex-col md:flex-row max-w-6xl mx-auto">
      {/* Conversations List */}
      <div className="w-full md:w-1/3 border-r border-border bg-card">
        <div className="p-4 border-b border-border">
          <div className="flex items-center justify-between mb-4">
            <h1 className="text-xl font-bold">Messages</h1>
            <button 
              onClick={() => setShowSafeZoneModal(true)}
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <Shield className="w-4 h-4" />
              <span>Safe Zone</span>
            </button>
          </div>
          <div className="relative">
            <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
            <Input placeholder="Search conversations..." className="pl-10" />
          </div>
        </div>

        <div className="overflow-y-auto" style={{ maxHeight: 'calc(100vh - 120px)' }}> {/* Adjusted for header height */}
          {conversations.length === 0 && !activeConversationData?.isVirtual ? (
            <div className="p-8 text-center">
              <MessageCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">No conversations yet</p>
              <p className="text-sm text-muted-foreground mt-1">
                Connect with other users to start messaging
              </p>
            </div>
          ) : (
            conversations.map((conversation, index) => (
              <motion.div
                key={conversation.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className={`p-4 border-b border-border cursor-pointer hover:bg-secondary/50 transition-colors ${
                  activeConversation === conversation.id ? 'bg-secondary' : ''
                }`}
                onClick={() => loadConversation(conversation.id)}
              >
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center text-white font-bold flex-shrink-0">
                    {conversation.otherUserEmail[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="font-semibold text-sm truncate">
                        {conversation.otherUserEmail.split('@')[0]}
                      </p>
                      {conversation.unreadCount > 0 && (
                        <Badge className="bg-red-500 text-white text-xs">
                          {conversation.unreadCount}
                        </Badge>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">
                      {conversation.latestMessage.content}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      {formatDistanceToNow(new Date(conversation.latestMessage.created_date), { addSuffix: true })}
                    </p>
                  </div>
                </div>
              </motion.div>
            ))
          )}
        </div>
      </div>

      {/* Chat Area */}
      <div className="flex-1 flex flex-col">
        {activeConversation ? (
          <>
            {/* Chat Header */}
            <div className="p-4 border-b border-border bg-card">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-gradient-to-r from-blue-400 to-purple-400 flex items-center justify-center text-white font-bold">
                  {activeConversationData?.otherUserEmail[0].toUpperCase()}
                </div>
                <div>
                  <p className="font-semibold">
                    {activeConversationData?.otherUserEmail.split('@')[0]}
                  </p>
                  <p className="text-xs text-muted-foreground">Active now</p>
                </div>
              </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              <AnimatePresence>
                {messages.length === 0 && activeConversationData?.isVirtual ? (
                    <div className="text-center text-muted-foreground p-4">
                        <MessageCircle className="w-10 h-10 mx-auto mb-2" />
                        <p>This is a new conversation. Send your first message!</p>
                    </div>
                ) : (
                    messages.map((message, index) => {
                      const isOwnMessage = message.sender_email === user.email;
                      return (
                        <motion.div
                          key={message.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.05 }}
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                            isOwnMessage 
                              ? 'bg-primary text-primary-foreground' 
                              : 'bg-secondary text-secondary-foreground'
                          }`}>
                            <p className="text-sm">{message.content}</p>
                            <p className={`text-xs mt-1 ${
                              isOwnMessage ? 'text-primary-foreground/70' : 'text-muted-foreground'
                            }`}>
                              {formatDistanceToNow(new Date(message.created_date), { addSuffix: true })}
                            </p>
                          </div>
                        </motion.div>
                      );
                    })
                )}
              </AnimatePresence>
            </div>

            {/* Message Input */}
            <div className="p-4 border-t border-border bg-card">
              <div className="flex items-center gap-2 mb-2">
                <AlertTriangle className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-muted-foreground">
                  Keep it respectful. Hate speech will result in immediate account suspension.
                </span>
              </div>
              <form onSubmit={sendMessage} className="flex gap-2">
                <Input
                  placeholder="Type your message..."
                  value={newMessage}
                  onChange={(e) => setNewMessage(e.target.value)}
                  className="flex-1"
                />
                <Button type="submit" disabled={!newMessage.trim()}>
                  <Send className="w-4 h-4" />
                </Button>
              </form>
            </div>
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center">
            <div className="text-center">
              <MessageCircle className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground">Select a conversation to start messaging</p>
            </div>
          </div>
        )}
      </div>

      <SafeZoneModal 
        isOpen={showSafeZoneModal} 
        onClose={() => setShowSafeZoneModal(false)} 
      />
    </div>
  );
}
