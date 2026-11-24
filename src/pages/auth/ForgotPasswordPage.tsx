import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, ArrowLeft } from 'lucide-react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import API, { serverMessage } from '@/api/axios';

// LAUNCH-AUDIT H24: both steps used to be a setTimeout. The role comes from the
// tab picked on Sign in; organiser when opened without one.
export default function ForgotPasswordPage() {
    const [isLoading, setIsLoading] = useState(false);
    const [step, setStep] = useState<1 | 2>(1); // 1: Email, 2: Reset
    const [error, setError] = useState<string | null>(null);
    const navigate = useNavigate();
    const role = useSearchParams()[0].get('role') === 'player' ? 'player' : 'organizer';

    const [email, setEmail] = useState('');
    const [otp, setOtp] = useState('');
    const [newPassword, setNewPassword] = useState('');

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await API.post(`/${role}/auth/forgot-password`, { email: email.trim() });
            setStep(2);
        } catch (err) {
            setError(serverMessage(err, "Couldn't send the code. Try again."));
        }
        setIsLoading(false);
    };

    const handleResetPassword = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError(null);
        try {
            await API.post(`/${role}/auth/reset-password`, { email: email.trim(), otp: otp.trim(), newPassword });
            navigate('/login');
        } catch (err) {
            setError(serverMessage(err, "Couldn't reset the password. Try again."));
            setIsLoading(false);
        }
    };

    return (
        <div className="flex min-h-screen items-center justify-center bg-black/95 p-4 py-24 font-montserrat">
            <Card className="w-full max-w-md border-white/10 bg-black/50 text-white backdrop-blur-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold font-oswald tracking-wide text-primary">Forgot Password</CardTitle>
                    <CardDescription className="text-gray-400">
                        {step === 1 ? "Enter your email to receive a reset code" : "Enter the code and your new password"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && <p role="alert" className="mb-4 text-sm text-red-300">{error}</p>}
                    {step === 1 ? (
                        <form onSubmit={handleSendOtp} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="email" className="text-white">Email</Label>
                                <Input
                                    id="email"
                                    type="email"
                                    placeholder="m@example.com"
                                    required
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                />
                            </div>
                            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Send Reset Code
                            </Button>
                        </form>
                    ) : (
                        <form onSubmit={handleResetPassword} className="space-y-4">
                            <div className="space-y-2">
                                <Label htmlFor="otp" className="text-white">Enter OTP</Label>
                                <Input
                                    id="otp"
                                    type="text"
                                    placeholder="123456"
                                    required
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary text-center tracking-widest"
                                    value={otp}
                                    onChange={(e) => setOtp(e.target.value)}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="new-password" className="text-white">New Password</Label>
                                <Input
                                    id="new-password"
                                    type="password"
                                    required
                                    className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary"
                                    value={newPassword}
                                    onChange={(e) => setNewPassword(e.target.value)}
                                />
                            </div>
                            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Reset Password
                            </Button>
                        </form>
                    )}
                </CardContent>
                <CardFooter>
                    <Link to="/login" className="flex items-center text-sm text-gray-400 hover:text-white transition-colors">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to Sign In
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}
