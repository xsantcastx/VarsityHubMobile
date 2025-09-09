import React from 'react';
import { Card, CardContent, CardHeader, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";
import { createPageUrl } from "@/utils";
import { motion } from "framer-motion";

export default function GroupCard({ group }) {
  return (
    <motion.div
      whileHover={{ y: -4, scale: 1.02 }}
      transition={{ type: "spring", stiffness: 300 }}
      className="h-full"
    >
      <Card className="h-full flex flex-col border-slate-200 hover:border-blue-300 hover:shadow-lg transition-all duration-300">
        <CardHeader>
          <div 
            className="h-32 rounded-lg bg-cover bg-center" 
            style={{ backgroundImage: `url(${group.cover_image_url || 'https://images.unsplash.com/photo-1542751371-adc38448a05e?q=80&w=2070&auto=format&fit=crop'})`}}
          ></div>
        </CardHeader>
        <CardContent className="flex-grow space-y-2">
          <h3 className="font-bold text-lg text-slate-800">{group.name}</h3>
          <p className="text-sm text-slate-600">{group.description}</p>
        </CardContent>
        <CardFooter className="flex justify-between items-center">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <Users className="w-4 h-4" />
            <span>{group.members?.length || 0} members</span>
          </div>
          <Link to={createPageUrl(`GroupDetail?id=${group.id}`)}>
            <Button variant="ghost" size="sm">
              View <ArrowRight className="w-4 h-4 ml-1" />
            </Button>
          </Link>
        </CardFooter>
      </Card>
    </motion.div>
  );
}