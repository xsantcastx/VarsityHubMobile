import React, { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Send, Building, MapPin, TrendingUp } from "lucide-react";

export default function ConnectionModal({ isOpen, onClose, founder, onSend }) {
  const [message, setMessage] = useState("");
  const [isSending, setIsSending] = useState(false);

  const handleSend = async () => {
    if (!message.trim()) return;
    
    setIsSending(true);
    await onSend(message);
    setMessage("");
    setIsSending(false);
  };

  if (!founder) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Send className="w-5 h-5" />
            Connect with {founder.company_name}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-6">
          {/* Founder Preview */}
          <div className="p-4 rounded-lg bg-slate-50 space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-r from-purple-400 to-blue-400 rounded-full flex items-center justify-center">
                <span className="text-white font-bold">
                  {founder.company_name[0].toUpperCase()}
                </span>
              </div>
              <div>
                <h3 className="font-semibold">{founder.company_name}</h3>
                {founder.tagline && (
                  <p className="text-sm text-slate-600">"{founder.tagline}"</p>
                )}
              </div>
            </div>
            
            <div className="grid grid-cols-1 gap-2 text-sm text-slate-600">
              <div className="flex items-center gap-2">
                <Building className="w-4 h-4" />
                <span>{founder.industry?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              </div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                <span>{founder.funding_stage?.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())}</span>
              </div>
              <div className="flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                <span>{founder.location}</span>
              </div>
            </div>
          </div>

          {/* Message Input */}
          <div className="space-y-2">
            <Label htmlFor="message">Connection Message</Label>
            <Textarea
              id="message"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Hi! I'd love to connect and learn more about your journey..."
              rows={4}
              className="resize-none"
            />
            <p className="text-xs text-slate-500">
              Introduce yourself and explain why you'd like to connect
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button variant="outline" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button 
              onClick={handleSend}
              disabled={!message.trim() || isSending}
              className="flex-1 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
            >
              {isSending ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending...
                </>
              ) : (
                <>
                  <Send className="w-4 h-4 mr-2" />
                  Send Request
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}