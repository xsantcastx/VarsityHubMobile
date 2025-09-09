import React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Users, MessageCircle, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function RecentConnections({ connections }) {
  return (
    <Card className="border-slate-200">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Users className="w-5 h-5" />
          Recent Connections
        </CardTitle>
        <Link to={createPageUrl("Messages")}>
          <Button variant="ghost" size="sm">
            View All
            <ArrowRight className="w-4 h-4 ml-1" />
          </Button>
        </Link>
      </CardHeader>
      <CardContent>
        {connections.length > 0 ? (
          <div className="space-y-4">
            {connections.map((connection, index) => (
              <motion.div
                key={connection.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.1 }}
                className="flex items-center justify-between p-3 rounded-lg bg-slate-50 hover:bg-slate-100 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full flex items-center justify-center">
                    <span className="text-white font-semibold text-sm">
                      {connection.founder_2_email[0].toUpperCase()}
                    </span>
                  </div>
                  <div>
                    <p className="font-medium text-sm">{connection.founder_2_email}</p>
                    <p className="text-xs text-slate-500">Connected recently</p>
                  </div>
                </div>
                <Button variant="ghost" size="sm">
                  <MessageCircle className="w-4 h-4" />
                </Button>
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-8">
            <Users className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <p className="text-slate-500 font-medium">No connections yet</p>
            <p className="text-slate-400 text-sm">Start discovering founders to build your network</p>
            <Link to={createPageUrl("Discover")} className="mt-3 inline-block">
              <Button variant="outline" size="sm">
                Discover Founders
              </Button>
            </Link>
          </div>
        )}
      </CardContent>
    </Card>
  );
}