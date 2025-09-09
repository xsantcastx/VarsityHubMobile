import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Card } from '@/components/ui/card';
import { User } from '@/api/entities';
import { ChevronLeft, ChevronRight } from 'lucide-react';

const MAX_VISIBLE = 5;

const Card3D = ({ post, author, isActive, offset, onClick }) => {
    const scale = isActive ? 1 : 1 - Math.abs(offset) * 0.2;
    const rotateY = offset * 30; // 3D rotation effect
    const zIndex = MAX_VISIBLE - Math.abs(offset);
    const opacity = Math.abs(offset) > 1 ? 0.3 : 1;

    return (
        <motion.div
            className="absolute w-[200px] h-[300px] cursor-pointer"
            style={{
                transformStyle: 'preserve-3d',
                zIndex,
                left: '50%',
                x: `${offset * 100 - 50}%`,
            }}
            animate={{ scale, rotateY, opacity }}
            transition={{ type: 'spring', stiffness: 200, damping: 25 }}
            onClick={onClick}
        >
            <Card className="h-full w-full overflow-hidden relative shadow-xl border-2 border-border/20">
                <img
                    src={post.media_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop'}
                    alt={post.title || 'Story'}
                    className="w-full h-full object-cover"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 text-white">
                    <div className="flex items-center gap-2">
                        {author && (
                            <div className="w-8 h-8 rounded-full bg-slate-400 flex items-center justify-center text-sm font-bold shrink-0">
                                {author.full_name[0]}
                            </div>
                        )}
                        <p className="text-xs font-semibold truncate">{author ? author.full_name : 'User'}</p>
                    </div>
                </div>
            </Card>
        </motion.div>
    );
};

export default function StoryCarousel({ stories }) {
    const [activeIndex, setActiveIndex] = useState(Math.floor(stories.length / 2));
    const [authors, setAuthors] = useState({});

    useEffect(() => {
        const fetchAuthors = async () => {
            const authorEmails = [...new Set(stories.map(s => s.author_email))];
            const fetchedAuthors = await User.filter({ email: { $in: authorEmails } });
            const authorMap = fetchedAuthors.reduce((acc, author) => {
                acc[author.email] = author;
                return acc;
            }, {});
            setAuthors(authorMap);
        };

        if (stories.length > 0) {
            fetchAuthors();
        }
    }, [stories]);

    if (stories.length === 0) {
        return (
             <div className="text-center py-6 px-4 bg-secondary/30 rounded-lg border-2 border-dashed border-border/20">
                <p className="font-semibold text-foreground">No Stories Yet</p>
                <p className="text-sm text-muted-foreground">Be the first to add a story to this event!</p>
            </div>
        )
    }

    const next = () => {
        setActiveIndex((i) => (i + 1) % stories.length);
    };

    const prev = () => {
        setActiveIndex((i) => (i - 1 + stories.length) % stories.length);
    };

    return (
        <div className="relative w-full h-[350px] flex items-center justify-center">
            <div className="absolute left-0 top-1/2 -translate-y-1/2 z-20">
                <button onClick={prev} className="p-2 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80 shadow-lg">
                    <ChevronLeft className="w-6 h-6" />
                </button>
            </div>
            
            <div className="relative w-full h-full">
                {stories.map((post, i) => {
                    const offset = i - activeIndex;
                    if (Math.abs(offset) >= MAX_VISIBLE) return null;
                    return (
                        <Card3D
                            key={post.id}
                            post={post}
                            author={authors[post.author_email]}
                            isActive={i === activeIndex}
                            offset={offset}
                            onClick={() => setActiveIndex(i)}
                        />
                    );
                })}
            </div>
            
            <div className="absolute right-0 top-1/2 -translate-y-1/2 z-20">
                 <button onClick={next} className="p-2 rounded-full bg-background/50 backdrop-blur-sm hover:bg-background/80 shadow-lg">
                    <ChevronRight className="w-6 h-6" />
                </button>
            </div>
        </div>
    );
}