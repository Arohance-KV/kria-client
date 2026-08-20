import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Eye, EyeOff, Loader2, AlertCircle } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { loginUser, requestLoginOtp, verifyLoginOtp, clearError, Role } from '../../store/slices/authSlice';
import logo from '@/assets/logo.png';

export default function SignInPage() {
    const [showPassword, setShowPassword] = useState(false);
    const [loginMethod, setLoginMethod] = useState<'password' | 'otp'>('password');
    const [role, setRole] = useState<Role>('player');
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { isLoading, error, accessToken } = useAppSelector((state) => state.auth);

    // Form States
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [otp, setOtp] = useState('');
    const [otpSent, setOtpSent] = useState(false);

    useEffect(() => {
        dispatch(clearError());
    }, [role, loginMethod, dispatch]);

    useEffect(() => {
        if (accessToken) {
            navigate(role === 'player' ? '/player/home' : '/organizer/home');
        }
    }, [accessToken, navigate, role]);

    const handlePasswordLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        dispatch(loginUser({ role, data: { email, password } }));
    };

    const handleSendOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        const action = await dispatch(requestLoginOtp({ role, data: { email } }));
        if (requestLoginOtp.fulfilled.match(action)) {
            setOtpSent(true);
        }
    };

    const handleVerifyOtp = async (e: React.FormEvent) => {
        e.preventDefault();
        dispatch(verifyLoginOtp({ role, data: { email, otp } }));
    };

    return (
        <div className="flex min-h-screen flex-col items-center justify-center bg-black/95 p-4 py-24 font-montserrat">
            <Link to="/" className="mb-6" aria-label="Back to home">
                <img src={logo} alt="Kria Sports" className="h-10 w-auto transition-opacity hover:opacity-80" />
            </Link>
            <Card className="w-full max-w-md border-white/10 bg-black/50 text-white backdrop-blur-md">
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold font-oswald tracking-wide text-primary">Sign in</CardTitle>
                    <CardDescription className="text-gray-400">
                        Enter your email below to sign in to your account
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    {error && (
                        <Alert variant="error" className="mb-6 bg-red-900/20 border-red-900/50 text-red-200">
                            <AlertCircle className="h-4 w-4" />
                            <AlertTitle>Error</AlertTitle>
                            <AlertDescription>{error}</AlertDescription>
                        </Alert>
                    )}

                    <div className="grid w-full grid-cols-2 bg-muted p-1 rounded-lg mb-4 bg-white/5">
                        <button
                            onClick={() => setRole('player')}
                            className={`rounded-md py-2 text-sm font-medium transition-all ${role === 'player'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Player
                        </button>
                        <button
                            onClick={() => setRole('organizer')}
                            className={`rounded-md py-2 text-sm font-medium transition-all ${role === 'organizer'
                                ? 'bg-primary text-white shadow-sm'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Organizer
                        </button>
                    </div>

                    <div className="grid w-full grid-cols-2 bg-muted p-1 rounded-lg mb-6 bg-white/5">
                        <button
                            onClick={() => setLoginMethod('password')}
                            className={`rounded-md py-2 text-sm font-medium transition-all ${loginMethod === 'password'
                                ? 'bg-white/20 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            Password
                        </button>
                        <button
                            onClick={() => setLoginMethod('otp')}
                            className={`rounded-md py-2 text-sm font-medium transition-all ${loginMethod === 'otp'
                                ? 'bg-white/20 text-white shadow-sm'
                                : 'text-gray-400 hover:text-white'
                                }`}
                        >
                            OTP (Passwordless)
                        </button>
                    </div>

                    {loginMethod === 'password' ? (
                        <form onSubmit={handlePasswordLogin} className="space-y-4">
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
                            <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                    <Label htmlFor="password" className="text-white">Password</Label>
                                    <Link to="/forgot-password" className="text-sm text-primary hover:underline">
                                        Forgot password?
                                    </Link>
                                </div>
                                <div className="relative">
                                    <Input
                                        id="password"
                                        type={showPassword ? "text" : "password"}
                                        required
                                        className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary pr-10"
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-2.5 text-gray-400 hover:text-white"
                                    >
                                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                                    </button>
                                </div>
                            </div>
                            <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={isLoading}>
                                {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                Sign In
                            </Button>
                        </form>
                    ) : (
                        <div className="space-y-4">
                            {!otpSent ? (
                                <form onSubmit={handleSendOtp} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="email-otp" className="text-white">Email</Label>
                                        <Input
                                            id="email-otp"
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
                                        Send OTP
                                    </Button>
                                </form>
                            ) : (
                                <form onSubmit={handleVerifyOtp} className="space-y-4">
                                    <div className="space-y-2">
                                        <Label htmlFor="otp" className="text-white">Enter OTP</Label>
                                        <Input
                                            id="otp"
                                            type="text"
                                            placeholder="123456"
                                            required
                                            className="bg-white/5 border-white/10 text-white placeholder:text-gray-500 focus:border-primary text-center tracking-widest text-lg"
                                            value={otp}
                                            onChange={(e) => setOtp(e.target.value)}
                                            maxLength={6}
                                        />
                                    </div>
                                    <Button type="submit" className="w-full bg-primary hover:bg-primary/90 text-white" disabled={isLoading}>
                                        {isLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                        Verify & Login
                                    </Button>
                                    <Button variant="ghost" type="button" onClick={() => setOtpSent(false)} className="w-full text-gray-400 hover:text-white">
                                        Use a different email
                                    </Button>
                                </form>
                            )}
                        </div>
                    )}
                </CardContent>
                <div className="relative mb-6">
                    <div className="absolute inset-0 flex items-center">
                        <span className="w-full border-t border-white/10" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-black px-2 text-gray-400">Or continue with</span>
                    </div>
                </div>
                <CardFooter className="flex flex-col gap-4">
                    <p className="text-center text-sm text-gray-400">
                        Don't have an account?{" "}
                        <Link to="/register" className="font-semibold text-primary hover:underline transition-colors">
                            Sign up
                        </Link>
                    </p>
                </CardFooter>
            </Card>
        </div>
    );
}
