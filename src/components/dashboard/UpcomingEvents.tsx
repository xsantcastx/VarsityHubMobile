import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, MapPin, Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { format } from "date-fns";
import { motion } from "framer-motion";

const eventTypeColors = {
  networking: "bg-purple-100 text-purple-700",
  workshop: "bg-blue-100 text-blue-700",
  pitch_night: "bg-orange-100 text-orange-700",
  panel: "bg-green-100 text-green-700",
  social: "bg-pink-100 text-pink-700",
  conference: "bg-indigo-100 text-indigo-700"
};

export default function UpcomingEvents({ events }) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Calendar className="w-5 h-5" />
          Upcoming Events
        </CardTitle>
        <Link to={createPageUrl("Events")}>
          <Button variant="ghost" size="sm">
            View All
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {events.length > 0 ? (
          <div className="space-y-4">
            {events.slice(0, 3).map((event, index) => (
              <motion.div
                key={event.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.1 }}
                className="p-4 rounded-lg border border-slate-200 hover:border-purple-200 transition-colors"
              >
                <div className="flex items-start justify-between mb-2">
                  <h4 className="font-semibold text-sm">{event.title}</h4>
                  <Badge className={eventTypeColors[event.event_type]}>
                    {event.event_type.replace(/_/g, ' ')}
                  </Badge>
                </div>
                <p className="text-xs text-slate-600 mb-3 line-clamp-2">{event.description}</p>
                <div className="flex items-center gap-4 text-xs text-slate-500">
                  <div className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {format(new Date(event.date), 'MMM d, h:mm a')}
                  </div>
                  <div className="flex items-center gap-1">
                    <MapPin className="w-3 h-3" />
                    {event.location}
                  </div>
                  <div className="flex items-center gap-1">
                    <Users className="w-3 h-3" />
                    {event.attendees?.length || 0} attending
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Calendar className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No upcoming events</p>
            <p className="text-slate-400 text-sm">Check back soon for networking opportunities</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}