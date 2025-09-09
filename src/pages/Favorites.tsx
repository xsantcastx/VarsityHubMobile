import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { User, UserInteraction, Post } from '@/api/entities';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { ArrowLeft, Heart } from 'lucide-react';
import PostCard from '../components/posts/PostCard';
import { motion } from 'framer-motion';

export default function Favorites() {
  const [savedInteractions, setSavedInteractions] = useState([]);
  const [posts, setPosts] = useState({});
  const [authors, setAuthors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const loadData = async () => {
      try {
        const currentUser = await User.me();
        
        const saves = await UserInteraction.filter({
          user_email: currentUser.email,
          interaction_type: 'save',
          target_type: 'post'
        });
        setSavedInteractions(saves);

        if (saves.length > 0) {
          const postIds = saves.map(s => s.target_id);
          const savedPosts = await Post.filter({ id: { $in: postIds } });
          const postsMap = savedPosts.reduce((acc, post) => {
            acc[post.id] = post;
            return acc;
          }, {});
          setPosts(postsMap);

          if (savedPosts.length > 0) {
            const authorEmails = [...new Set(savedPosts.map(p => p.author_email))];
            const authorData = await User.filter({ email: { $in: authorEmails } });
            const authorsMap = authorData.reduce((acc, author) => {
              acc[author.email] = author;
              return acc;
            }, {});
            setAuthors(authorsMap);
          }
        }
      } catch (error) {
        console.error("Failed to load favorites:", error);
      } finally {
        setIsLoading(false);
      }
    };
    loadData();
  }, []);

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">My Favorites</h1>
        </div>
      </header>
      
      <main className="max-w-4xl mx-auto p-4 md:p-6">
        {isLoading ? (
          <div className="text-center py-8">Loading favorites...</div>
        ) : savedInteractions.length === 0 ? (
          <Card>
            <CardContent className="text-center py-12">
              <Heart className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No saved posts</h3>
              <p className="text-muted-foreground">Save posts you love to see them here.</p>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {savedInteractions.map((interaction, index) => {
              const post = posts[interaction.target_id];
              if (!post) return null;
              const author = authors[post.author_email];
              return (
                <motion.div
                  key={interaction.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                >
                  <PostCard post={post} author={author} />
                </motion.div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}