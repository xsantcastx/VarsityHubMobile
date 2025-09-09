
import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { createPageUrl } from '@/utils';
import { LayoutGrid, Video, Compass, User, Plus } from 'lucide-react';

const navItems = [
  { name: 'Feed', path: createPageUrl('Feed'), icon: LayoutGrid },
  { name: 'Highlights', path: createPageUrl('Highlights'), icon: Video },
  { name: 'Post', path: createPageUrl('CreatePost'), icon: Plus },
  { name: 'Discover', path: createPageUrl('Discover'), icon: Compass },
  { name: 'Profile', path: createPageUrl('Profile'), icon: User },
];

export default function BottomNavBar() {
  const location = useLocation();

  return (
    <div className="fixed bottom-0 left-0 right-0 h-16 bg-white/95 backdrop-blur-md border-t border-gray-200 z-50">
      <div className="flex justify-around items-center h-full max-w-lg mx-auto px-4">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path;
          if (item.name === 'Post') {
            return (
              <Link
                key={item.name}
                to={item.path}
                className="relative"
              >
                <div className="w-12 h-12 bg-black rounded-full flex items-center justify-center shadow-sm">
                  <item.icon className="w-6 h-6 text-white" strokeWidth={2.5} />
                </div>
              </Link>
            );
          }
          return (
            <Link
              key={item.name}
              to={item.path}
              className={`flex flex-col items-center justify-center transition-colors duration-200 ${
                isActive ? 'text-black' : 'text-gray-400'
              }`}
            >
              <item.icon className="w-6 h-6" strokeWidth={isActive ? 2.5 : 1.5} />
              <span className="text-xs mt-1 font-medium">{item.name}</span>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
