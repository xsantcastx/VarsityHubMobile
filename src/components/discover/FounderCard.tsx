import React from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { 
  Building, 
  MapPin, 
  TrendingUp, 
  MessageCircle,
  Linkedin,
  Target
} from "lucide-react";
import { motion } from "framer-motion";

export default function FounderCard({ founder, onConnect }) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      transition={{ type: "spring", stiffness: 300 }}
    >
      <Card className="h-full border-slate-200 hover:border-purple-200 hover:shadow-lg transition-all duration-300">
        <CardHeader className="pb-4">
          <div className="flex items-start gap-4">
            <div className="w-16 h-16 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full flex items-center justify-center flex-shrink-0">
              {founder.avatar_url ? (
                <img src={founder.avatar_url} alt="Profile" className="w-full h-full rounded-full object-cover" />
              ) : (
                <span className="text-white font-bold text-xl">
                  {founder.company_name?.[0]?.toUpperCase() || 'F'}
                </span>
              )}
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-bold text-lg truncate">{founder.company_name}</h3>
              {founder.tagline && (
                <p className="text-sm text-slate-600 line-clamp-2 mt-1">
                  "{founder.tagline}"
                </p>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <Building className="w-4 h-4" />
              <span>{founder.industry?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <TrendingUp className="w-4 h-4" />
              <span>{founder.funding_stage?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-slate-600">
              <MapPin className="w-4 h-4" />
              <span>{founder.location}</span>
            </div>
          </div>

          {founder.bio && (
            <p className="text-sm text-slate-600 line-clamp-3">
              {founder.bio}
            </p>
          )}

          {founder.looking_for && founder.looking_for.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center gap-1 text-xs font-medium text-slate-500">
                <Target className="w-3 h-3" />
                Looking for:
              </div>
              <div className="flex flex-wrap gap-1">
                {founder.looking_for.slice(0, 3).map(item => (
                  <Badge key={item} variant="outline" className="text-xs">
                    {item.replace(/_/g, ' ')}
                  </Badge>
                ))}
                {founder.looking_for.length > 3 && (
                  <Badge variant="outline" className="text-xs">
                    +{founder.looking_for.length - 3} more
                  </Badge>
                )}
              </div>
            </div>
          )}

          {founder.skills && founder.skills.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-medium text-slate-500">Skills:</div>
              <div className="flex flex-wrap gap-1">
                {founder.skills.slice(0, 4).map(skill => (
                  <Badge key={skill} variant="secondary" className="text-xs">
                    {skill}
                  </Badge>
                ))}
                {founder.skills.length > 4 && (
                  <Badge variant="secondary" className="text-xs">
                    +{founder.skills.length - 4}
                  </Badge>
                )}
              </div>
            </div>
          )}

          <div className="flex gap-2 pt-2">
            <Button 
              onClick={() => onConnect(founder)}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
              size="sm"
            >
              <MessageCircle className="w-4 h-4 mr-2" />
              Connect
            </Button>
            {founder.linkedin_url && (
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.open(founder.linkedin_url, '_blank')}
              >
                <Linkedin className="w-4 h-4" />
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}