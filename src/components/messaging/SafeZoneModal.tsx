import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Shield, Users, AlertTriangle, X } from 'lucide-react';
import { Badge } from "@/components/ui/badge";

export default function SafeZoneModal({ isOpen, onClose }) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md mx-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Shield className="w-5 h-5 text-green-600" />
            Safe Zone Policy
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Users className="w-4 h-4 text-blue-600" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">DM Policy for Minors</h4>
                <p className="text-xs text-muted-foreground">
                  Users aged 17 and under can only message other minors. Users aged 18 and up can only message other adults.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center flex-shrink-0">
                <Shield className="w-4 h-4 text-green-600" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Coach Exception</h4>
                <p className="text-xs text-muted-foreground">
                  Coaches and Organizers are automatically placed in a group chat with all team members and staff—direct contact outside of this is restricted.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center flex-shrink-0">
                <AlertTriangle className="w-4 h-4 text-red-600" />
              </div>
              <div>
                <h4 className="font-semibold text-sm">Anti-Bullying Reminder</h4>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• No hate speech or harassment of any kind.</p>
                  <p>• Varsity Hub has zero tolerance for bullying.</p>
                  <p>• Users can be blocked or reported for abusive behavior.</p>
                </div>
              </div>
            </div>
          </div>

          <div className="pt-4 border-t">
            <Button onClick={onClose} className="w-full">
              Got it!
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}