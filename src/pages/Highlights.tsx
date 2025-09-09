
import React, { useState, useEffect } from "react";
import { Post, User, UserInteraction } from "@/api/entities";
import { motion } from "framer-motion";
import PostCard from "../components/posts/PostCard";
import { ArrowUp, TrendingUp } from "lucide-react";

export default function Highlights() {
  const [posts, setPosts] = useState([]);
  const [authors, setAuthors] = useState({});
  const [isLoading, setIsLoading] = useState(true);
  const [user, setUser] = useState(null);

  useEffect(() => {
    const loadPosts = async () => {
      setIsLoading(true);
      try {
        const currentUser = await User.me();
        setUser(currentUser);

        // Get all posts and sort by upvotes (national ranking)
        const allPosts = await Post.list('-created_date');
        const sortedByUpvotes = allPosts.sort((a, b) => {
          const aUpvotes = a.upvotes?.length || 0;
          const bUpvotes = b.upvotes?.length || 0;
          return bUpvotes - aUpvotes;
        });

        // Get top 20 most upvoted posts nationally
        const top20Upvoted = sortedByUpvotes.slice(0, 20);

        // Generate algorithmic posts based on user preferences
        const algorithmicPosts = await generateAlgorithmicPosts(allPosts, currentUser);

        // Apply ranking logic
        const rankedPosts = applyRankingLogic(top20Upvoted, algorithmicPosts);
        const finalPosts = rankedPosts.slice(0, 50); // Limit to 50 posts total
        setPosts(finalPosts);

        // Batch fetch authors
        if (finalPosts.length > 0) {
          const authorEmails = [...new Set(finalPosts.map(p => p.author_email))];
          const authorData = await User.filter({ email: { $in: authorEmails } });
          const authorsMap = authorData.reduce((acc, author) => {
            acc[author.email] = author;
            return acc;
          }, {});
          setAuthors(authorsMap);
        }

      } catch (error) {
        console.error("Error loading highlights:", error);
      }
      setIsLoading(false);
    };
    loadPosts();
  }, []);

  const generateAlgorithmicPosts = async (allPosts, user) => {
    // Get user interactions to understand preferences
    const userInteractions = await UserInteraction.filter({ user_email: user.email });
    
    // Create algorithmic ranking based on:
    // - User's followed accounts (if we had that data)
    // - Previous interactions
    // - Location proximity
    // - Sports interests
    const scoredPosts = allPosts.map(post => {
      let score = 0;
      
      // Boost posts from sports user is interested in
      if (user.sports_interests?.some(sport => 
        post.content.toLowerCase().includes(sport.toLowerCase())
      )) {
        score += 10;
      }
      
      // Boost posts user has interacted with similar content
      const similarInteractions = userInteractions.filter(interaction => 
        interaction.target_type === 'post'
      );
      if (similarInteractions.length > 0) {
        score += 5;
      }
      
      // Boost recent posts
      const postAge = Date.now() - new Date(post.created_date).getTime();
      const daysSincePost = postAge / (1000 * 60 * 60 * 24);
      if (daysSincePost < 7) {
        score += (7 - daysSincePost) * 2;
      }
      
      // Boost posts with some engagement
      const engagement = (post.upvotes?.length || 0) + (post.likes?.length || 0);
      score += engagement * 0.5;
      
      return { ...post, algorithmicScore: score };
    });
    
    return scoredPosts
      .sort((a, b) => b.algorithmicScore - a.algorithmicScore)
      .filter(post => !post.upvotes || post.upvotes.length < 10); // Exclude posts that will be in top upvoted
  };

  const applyRankingLogic = (topUpvoted, algorithmicPosts) => {
    const result = [];
    let upvotedIndex = 0;
    let algorithmicIndex = 0;
    
    // First 3 posts: Top 3 most upvoted nationally
    for (let i = 0; i < 3 && upvotedIndex < topUpvoted.length; i++) {
      result.push(topUpvoted[upvotedIndex++]);
    }
    
    // Next sequence: For every 2 algorithmic posts, insert next highest upvoted (until 10th upvoted)
    while (upvotedIndex < 10 && upvotedIndex < topUpvoted.length) {
      // Add 2 algorithmic posts
      for (let i = 0; i < 2 && algorithmicIndex < algorithmicPosts.length; i++) {
        result.push(algorithmicPosts[algorithmicIndex++]);
      }
      // Add next upvoted post
      if (upvotedIndex < topUpvoted.length) {
        result.push(topUpvoted[upvotedIndex++]);
      }
    }
    
    // After 10th upvoted: For every 3 algorithmic posts, insert next highest upvoted (until 20th)
    while (upvotedIndex < 20 && upvotedIndex < topUpvoted.length) {
      // Add 3 algorithmic posts
      for (let i = 0; i < 3 && algorithmicIndex < algorithmicPosts.length; i++) {
        result.push(algorithmicPosts[algorithmicIndex++]);
      }
      // Add next upvoted post
      if (upvotedIndex < topUpvoted.length) {
        result.push(topUpvoted[upvotedIndex++]);
      }
    }
    
    // Fill remaining slots with algorithmic posts
    while (algorithmicIndex < algorithmicPosts.length && result.length < 50) {
      result.push(algorithmicPosts[algorithmicIndex++]);
    }
    
    return result;
  };

  return (
    <div className="p-4 md:p-6 space-y-6 max-w-3xl mx-auto">
      <header className="pt-4">
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="w-6 h-6 text-primary" />
          <h1 className="text-3xl font-bold text-foreground">Highlights</h1>
        </div>
        <p className="text-muted-foreground">The most upvoted moments from across the nation.</p>
      </header>
      
      {isLoading ? (
        <div className="text-center py-10">Loading highlights...</div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20">
          <TrendingUp className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold text-muted-foreground mb-2">No highlights yet</h3>
          <p className="text-muted-foreground">Be the first to share a moment that gets the community talking!</p>
        </div>
      ) : (
        <div className="space-y-6">
          {posts.map((post, index) => (
            <motion.div
              key={post.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              className="relative"
            >
              {index === 0 && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-yellow-400 to-orange-500 text-white text-xs font-bold px-2 py-1 rounded-full z-10">
                  #1 TRENDING
                </div>
              )}
              {index < 3 && index > 0 && (
                <div className="absolute -top-2 -right-2 bg-gradient-to-r from-blue-400 to-blue-500 text-white text-xs font-bold px-2 py-1 rounded-full z-10">
                  #{index + 1} NATIONAL
                </div>
              )}
              <PostCard post={post} author={authors[post.author_email]} showEngagement={true} />
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
