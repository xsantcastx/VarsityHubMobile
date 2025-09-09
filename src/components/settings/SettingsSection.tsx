import React from 'react';
import { motion } from 'framer-motion';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";

export default function SettingsSection({ title, icon, children, defaultOpen = false }) {
  const IconComponent = icon;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }} 
      animate={{ opacity: 1, y: 0 }}
      className="border-b"
    >
      <Accordion type="single" collapsible defaultValue={defaultOpen ? "item-1" : ""}>
        <AccordionItem value="item-1" className="border-b-0">
          <AccordionTrigger className="hover:no-underline py-4">
            <div className="flex items-center gap-3">
              {IconComponent && <IconComponent className="w-5 h-5 text-muted-foreground" />}
              <span className="font-semibold text-md">{title}</span>
            </div>
          </AccordionTrigger>
          <AccordionContent className="pb-4">
            <div className="space-y-1 pl-8">
              {children}
            </div>
          </AccordionContent>
        </AccordionItem>
      </Accordion>
    </motion.div>
  );
}