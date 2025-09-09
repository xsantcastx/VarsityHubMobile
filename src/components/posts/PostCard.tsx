
import React, { useState, useEffect } from "react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { motion } from "framer-motion";
import { ArrowUp, MessageCircle, Star, Video, Image as ImageIcon, Bookmark } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';
import { User, UserInteraction, Post } from '@/api/entities';
import { useToast } from "@/components/ui/use-toast";

const typeIcons = {
    review: Star,
    photo: ImageIcon,
    video_highlight: Video,
}

export default function PostCard({ post, author: initialAuthor }) {
  const [author, setAuthor] = useState(initialAuthor);
  const [currentUser, setCurrentUser] = useState(null);
  const { toast } = useToast();

  useEffect(() => {
    const fetchAuthor = async () => {
        if (!initialAuthor) {
            try {
                const users = await User.filter({ email: post.author_email });
                if (users.length > 0) setAuthor(users[0]);
            } catch (e) { console.error("Failed to fetch author", e); }
        } else {
            setAuthor(initialAuthor);
        }
    };
    
    const fetchUser = async () => {
        try {
            const user = await User.me();
            setCurrentUser(user);
        } catch(e) { /* not logged in */ }
    }

    fetchAuthor();
    fetchUser();
  }, [post.author_email, initialAuthor]);

  const handleLongPress = async () => {
      if (currentUser?.email === post.author_email) {
          if (confirm("Are you sure you want to delete this post?")) {
              try {
                  await Post.delete(post.id);
                   toast({
                      title: "Post Deleted",
                      description: "Your post has been successfully deleted.",
                  });
                  // Optionally, you can add a callback to refresh the feed
              } catch (error) {
                  console.error("Failed to delete post:", error);
                  toast({
                      title: "Error",
                      description: "Failed to delete the post. Please try again.",
                      variant: "destructive",
                  });
              }
          }
      }
  };
  
  const handleSave = async () => {
      if (!currentUser) {
          toast({ title: "Please log in to save posts.", variant: "destructive" });
          return;
      }
      try {
          await UserInteraction.create({
              user_email: currentUser.email,
              interaction_type: 'save',
              target_type: 'post',
              target_id: post.id
          });
          toast({ title: "Post Saved!", description: "You can find it in your Favorites." });
      } catch (error) {
          console.error("Failed to save post:", error);
          toast({ title: "Error", description: "Could not save the post.", variant: "destructive" });
      }
  }

  const engagementCount = post.is_story ? (post.likes?.length || 0) : (post.upvotes?.length || 0);
  const TypeIcon = typeIcons[post.type] || ImageIcon;

  return (
    <motion.div
        onLongPress={handleLongPress}
        whileTap={{ scale: 0.98 }}
    >
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center gap-3 p-4">
        <Avatar>
            <AvatarImage src={author?.avatar_url} />
            <AvatarFallback>{author?.username?.[0] || 'U'}</AvatarFallback>
        </Avatar>
        <div>
            <p className="font-semibold">{author?.username || 'Anonymous'}</p>
            <p className="text-xs text-muted-foreground">
              {formatDistanceToNow(new Date(post.created_date), { addSuffix: true })}
            </p>
        </div>
      </CardHeader>
      
      {post.media_url && (
        <img src={post.media_url} alt={post.title || 'Post media'} className="w-full h-auto max-h-96 object-cover" />
      )}
      
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center gap-2">
          <TypeIcon className="w-4 h-4 text-muted-foreground" />
          <CardTitle className="text-lg">{post.title}</CardTitle>
        </div>
        <p className="text-sm text-muted-foreground">{post.content}</p>
      </CardContent>
      
      <CardFooter className="p-4 flex justify-between items-center bg-secondary/30">
        <div className="flex gap-4">
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <ArrowUp className="w-4 h-4" /> 
            <span>{engagementCount}</span>
          </Button>
          <Button variant="ghost" size="sm" className="flex items-center gap-2">
            <MessageCircle className="w-4 h-4" /> 
            <span>{post.comments?.length || 0}</span>
          </Button>
        </div>
        <Button variant="ghost" size="sm" onClick={handleSave}>
            <Bookmark className="w-4 h-4" />
        </Button>
      </CardFooter>
    </Card>
    </motion.div>
  );
}
