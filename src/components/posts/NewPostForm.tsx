import React, { useState } from 'react';
import { Post } from '@/api/entities';
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Send, Image as ImageIcon } from "lucide-react";

export default function NewPostForm({ userGroups, onPostCreated, defaultGroup }) {
  const [content, setContent] = useState("");
  const [selectedGroup, setSelectedGroup] = useState(defaultGroup || "");
  const [isPosting, setIsPosting] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || !selectedGroup) return;
    
    setIsPosting(true);
    try {
      const newPost = await Post.create({
        content,
        group_id: selectedGroup,
      });
      onPostCreated(newPost);
      setContent("");
    } catch (error) {
      console.error("Error creating post:", error);
    }
    setIsPosting(false);
  };

  return (
    <Card>
      <CardContent className="p-4">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Textarea
            placeholder="Share an update, ask a question, or start a discussion..."
            value={content}
            onChange={(e) => setContent(e.target.value)}
            rows={3}
          />
          <div className="flex justify-between items-center">
            <div className="flex gap-2">
              <Select value={selectedGroup} onValueChange={setSelectedGroup} required>
                <SelectTrigger className="w-[200px]">
                  <SelectValue placeholder="Select a group..." />
                </SelectTrigger>
                <SelectContent>
                  {userGroups.map(group => (
                    <SelectItem key={group.id} value={group.id}>{group.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon" type="button">
                <ImageIcon className="w-4 h-4" />
              </Button>
            </div>
            <Button type="submit" disabled={isPosting || !content.trim() || !selectedGroup}>
              {isPosting ? 'Posting...' : 'Post'}
              <Send className="w-4 h-4 ml-2" />
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}