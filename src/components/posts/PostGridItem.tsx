import React from 'react';
import { Card } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { ArrowUp, Trophy, MessageCircle } from 'lucide-react';

export default function PostGridItem({ post }) {

  return (
    <Link to={createPageUrl(`GameDetail?id=${post.game_id}`)} className="block h-full w-full group">
      <Card className="h-full overflow-hidden relative border-border/50 hover:shadow-xl transition-all duration-300">
        {post.media_url ? (
          <img 
            src={post.media_url} 
            alt={post.title || post.content}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
          />
        ) : (
          <div className="h-full w-full bg-secondary flex items-center justify-center p-4">
             <div className="text-center">
                 <MessageCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                 <p className="text-sm font-semibold text-foreground line-clamp-2">{post.title}</p>
                 <p className="text-xs text-muted-foreground mt-1 line-clamp-4">{post.content}</p>
             </div>
          </div>
        )}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
        <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
          <div className="flex justify-between items-end">
            <p className="text-xs font-semibold line-clamp-2">{post.title || post.content}</p>
            <div className="flex items-center gap-1.5 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full text-xs">
              <ArrowUp className="w-3 h-3" />
              <span>{post.upvotes?.length || 0}</span>
            </div>
          </div>
        </div>
        {post.type === 'video_highlight' && (
          <div className="absolute top-2 right-2 bg-black/40 text-white p-1.5 rounded-full backdrop-blur-sm">
            <Trophy className="w-4 h-4" />
          </div>
        )}
      </Card>
    </Link>
  );
}