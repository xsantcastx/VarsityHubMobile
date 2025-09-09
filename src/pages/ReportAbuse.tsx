
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowLeft, AlertTriangle, Send, Upload } from 'lucide-react';
import { UploadFile } from '@/api/integrations';

export default function ReportAbuse() {
  const [reportData, setReportData] = useState({
    type: '',
    userEmail: '',
    description: '',
    urgency: 'medium',
    file_url: ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [file, setFile] = useState(null); // Added for file handling
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    try {
      let fileUrl = '';
      if (file) {
        // Assuming UploadFile is an async function that returns an object with file_url
        const uploadResult = await UploadFile({ file });
        fileUrl = uploadResult.file_url;
      }
      
      // In a real app, this would create a support ticket with the fileUrl
      console.log("Submitting report with data:", { ...reportData, file_url: fileUrl });
      await new Promise(resolve => setTimeout(resolve, 1000)); // Simulate API call
      setSubmitted(true);
    } catch (error) {
      console.error("Failed to submit report:", error);
      alert("Failed to submit report. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="min-h-screen bg-secondary/30 flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardContent className="text-center py-8">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <Send className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-bold mb-2">Report Submitted</h2>
            <p className="text-muted-foreground mb-4">
              Thank you for helping keep VarsityHub safe. We'll review your report and take appropriate action.
            </p>
            <Button onClick={() => navigate(-1)}>Done</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
        <div className="max-w-4xl mx-auto p-4 flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">Report Abuse</h1>
        </div>
      </header>
      
      <main className="max-w-2xl mx-auto p-4 md:p-6">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-red-600" />
              Report Inappropriate Behavior
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="type">Report Type</Label>
                <Select onValueChange={(value) => setReportData({...reportData, type: value})}>
                  <SelectTrigger>
                    <SelectValue placeholder="Select report type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="harassment">Harassment/Bullying</SelectItem>
                    <SelectItem value="hate_speech">Hate Speech</SelectItem>
                    <SelectItem value="inappropriate_content">Inappropriate Content</SelectItem>
                    <SelectItem value="spam">Spam</SelectItem>
                    <SelectItem value="impersonation">Impersonation</SelectItem>
                    <SelectItem value="other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="userEmail">User/Content to Report</Label>
                <Input
                  id="userEmail"
                  placeholder="Email, username, or content link"
                  value={reportData.userEmail}
                  onChange={(e) => setReportData({...reportData, userEmail: e.target.value})}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  placeholder="Please provide details about the incident..."
                  value={reportData.description}
                  onChange={(e) => setReportData({...reportData, description: e.target.value})}
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="urgency">Urgency Level</Label>
                <Select onValueChange={(value) => setReportData({...reportData, urgency: value})} defaultValue="medium">
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="low">Low - General concern</SelectItem>
                    <SelectItem value="medium">Medium - Needs attention</SelectItem>
                    <SelectItem value="high">High - Immediate safety concern</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="file">Attach File (optional)</Label>
                <Input id="file" type="file" onChange={handleFileChange} />
                <p className="text-xs text-muted-foreground">Attach a screenshot or relevant file.</p>
              </div>

              <Button 
                type="submit" 
                className="w-full" 
                disabled={isSubmitting || !reportData.type || !reportData.description}
              >
                {isSubmitting ? 'Submitting...' : 'Submit Report'}
                <Send className="w-4 h-4 ml-2" />
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
