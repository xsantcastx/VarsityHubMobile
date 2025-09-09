
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Advertisement } from '@/api/entities';
import { UploadFile } from '@/api/integrations';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { ArrowLeft, Upload, Calendar, FileImage } from 'lucide-react';
import { createPageUrl } from '@/utils';

export default function SubmitAd() {
    const navigate = useNavigate();
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        business_name: '',
        zip_code: '',
        has_banner: '', // 'yes' or 'no'
        banner_file: null,
        banner_url: '',
        description: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [isUploading, setIsUploading] = useState(false);

    const handleBannerUpload = async (event) => {
        const file = event.target.files[0];
        if (!file) return;

        setIsUploading(true);
        try {
            const { file_url } = await UploadFile({ file });
            setFormData(prev => ({ 
                ...prev, 
                banner_file: file,
                banner_url: file_url 
            }));
        } catch (error) {
            console.error('Error uploading banner:', error);
            alert('Failed to upload banner. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!formData.name || !formData.email || !formData.business_name || !formData.zip_code || !formData.has_banner) {
            alert('Please fill out all required fields.');
            return;
        }

        setIsSubmitting(true);
        try {
            const adRequest = await Advertisement.create({
                business_name: formData.business_name,
                contact_name: formData.name,
                contact_email: formData.email,
                banner_url: formData.banner_url,
                target_zip_code: formData.zip_code,
                radius: 45,
                has_banner_ready: formData.has_banner === 'yes',
                description: formData.description,
                payment_status: 'pending'
            });
            
            // Navigate to calendar page with ad ID
            navigate(createPageUrl(`AdCalendar?adId=${adRequest.id}`));
        } catch (error) {
            console.error('Failed to submit ad:', error);
            alert('Failed to submit ad request. Please try again.');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="min-h-screen bg-secondary/30">
            <header className="sticky top-0 bg-background/80 backdrop-blur-sm z-10 border-b">
                <div className="max-w-2xl mx-auto p-4 flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Submit a Local Ad</h1>
                </div>
            </header>
            
            <main className="max-w-2xl mx-auto p-4 md:p-6 space-y-6">
                <Card>
                    <CardHeader>
                        <CardTitle>Local Business Advertising</CardTitle>
                        <CardDescription>
                            Advertise your business to local sports families and teams within a 45-mile radius of your location.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-6">
                            {/* Contact Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="name">Your Name *</Label>
                                    <Input 
                                        id="name"
                                        value={formData.name} 
                                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                                        placeholder="John Smith"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="email">Email Address *</Label>
                                    <Input 
                                        id="email"
                                        type="email"
                                        value={formData.email} 
                                        onChange={(e) => setFormData({...formData, email: e.target.value})}
                                        placeholder="john@business.com"
                                        required
                                    />
                                </div>
                            </div>

                            {/* Business Information */}
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="business_name">Business Name *</Label>
                                    <Input 
                                        id="business_name"
                                        value={formData.business_name} 
                                        onChange={(e) => setFormData({...formData, business_name: e.target.value})}
                                        placeholder="Smith's Sports Equipment"
                                        required
                                    />
                                </div>
                                <div className="space-y-2">
                                    <Label htmlFor="zip_code">Business ZIP Code *</Label>
                                    <Input 
                                        id="zip_code"
                                        value={formData.zip_code} 
                                        onChange={(e) => setFormData({...formData, zip_code: e.target.value})}
                                        placeholder="12345"
                                        maxLength={5}
                                        required
                                    />
                                    <p className="text-xs text-muted-foreground">
                                        Ads will be shown within 45 miles of this ZIP code
                                    </p>
                                </div>
                            </div>

                            {/* Banner Upload Section */}
                            <div className="space-y-3">
                                <Label>Do you already have a banner ad ready to use? *</Label>
                                <RadioGroup 
                                    value={formData.has_banner} 
                                    onValueChange={(value) => setFormData({...formData, has_banner: value})}
                                >
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="yes" id="yes" />
                                        <Label htmlFor="yes">Yes, I have a banner ready to upload</Label>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <RadioGroupItem value="no" id="no" />
                                        <Label htmlFor="no">No, I need help creating one</Label>
                                    </div>
                                </RadioGroup>

                                {formData.has_banner === 'yes' && (
                                    <div className="border-2 border-dashed border-gray-300 rounded-lg p-6">
                                        <div className="text-center">
                                            <FileImage className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                                            <label htmlFor="banner-upload" className="cursor-pointer">
                                                <span className="text-sm font-medium text-primary">Upload your banner</span>
                                                <input
                                                    id="banner-upload"
                                                    type="file"
                                                    accept="image/*"
                                                    onChange={handleBannerUpload}
                                                    className="sr-only"
                                                />
                                            </label>
                                            <p className="text-xs text-gray-500 mt-1">
                                                Recommended: 728x90 pixels, PNG or JPG
                                            </p>
                                        </div>
                                        {isUploading && (
                                            <p className="text-sm text-blue-600 text-center mt-2">Uploading...</p>
                                        )}
                                        {formData.banner_url && (
                                            <div className="mt-3">
                                                <img 
                                                    src={formData.banner_url} 
                                                    alt="Banner preview" 
                                                    className="max-h-20 mx-auto border rounded"
                                                />
                                                <p className="text-xs text-green-600 text-center mt-1">✓ Banner uploaded</p>
                                            </div>
                                        )}
                                    </div>
                                )}

                                {formData.has_banner === 'no' && (
                                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                                        <p className="text-sm text-blue-800">
                                            <strong>No problem!</strong> We can help you create a professional banner ad. 
                                            We'll reach out to you after you submit this form to discuss design options.
                                        </p>
                                    </div>
                                )}
                            </div>

                            {/* Optional Description */}
                            <div className="space-y-2">
                                <Label htmlFor="description">Short Description or Message (Optional)</Label>
                                <Textarea
                                    id="description"
                                    value={formData.description}
                                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                                    placeholder="Tell us about your business or any specific message you'd like to convey..."
                                    rows={3}
                                />
                            </div>

                            <Button 
                                type="submit" 
                                className="w-full h-12 text-lg" 
                                disabled={isSubmitting}
                            >
                                <Calendar className="w-5 h-5 mr-2" />
                                {isSubmitting ? 'Submitting...' : 'Continue to Calendar'}
                            </Button>
                        </form>
                    </CardContent>
                </Card>
            </main>
        </div>
    );
}
