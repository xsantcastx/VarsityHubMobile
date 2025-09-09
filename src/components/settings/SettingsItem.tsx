import React from 'react';
import { ChevronRight } from 'lucide-react';
import { Switch } from '@/components/ui/switch';

export default function SettingsItem({ label, description, control, onClick, checked, onToggle }) {
  const renderControl = () => {
    if (control === 'toggle') {
      return (
        <Switch 
          checked={checked}
          onCheckedChange={onToggle}
        />
      );
    }
    if (control === 'arrow') {
      return <ChevronRight className="w-5 h-5 text-muted-foreground" />;
    }
    return null;
  };

  const handleClick = () => {
    if (control === 'toggle' && onToggle) {
      onToggle(!checked);
    } else if (onClick) {
      onClick();
    }
  };

  return (
    <div
      onClick={handleClick}
      className="flex items-center justify-between py-3 rounded-md -ml-2 px-2 transition-colors hover:bg-secondary/50 cursor-pointer"
    >
      <div className="flex-1">
        <p className="text-sm font-medium text-foreground">{label}</p>
        {description && <p className="text-xs text-muted-foreground">{description}</p>}
      </div>
      {renderControl()}
    </div>
  );
}