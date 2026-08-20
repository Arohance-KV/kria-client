import React, { useState, useEffect } from 'react';
import { MultiStepForm } from '@/components/ui/multi-step-form';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { ArrowUpRight, User, Users, CheckCircle2, AlertTriangle, AlertCircle, Loader2 } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { registerUser, verifyOtp, setPassword, Role, resetRegistration, clearError } from '../../store/slices/authSlice';
import logo from '@/assets/logo.png';

export default function SignUpPage() {
    const [role, setRole] = useState<Role | null>(null);
    const navigate = useNavigate();
    const dispatch = useAppDispatch();

    const {
        isLoading,
        error,
        registrationStep,
        registrationEmail,
        accessToken
    } = useAppSelector((state) => state.auth);

    const totalSteps = 3;

    // Form State
    const [formData, setFormData] = useState({
        firstName: '',
        lastName: '',
        email: '',
        phone: '',
        otp: '',
        pwd: '',
        confirmPassword: ''
    });

    useEffect(() => {
        dispatch(clearError());
    }, [role, dispatch]);

    useEffect(() => {
        if (accessToken) {
            navigate(role === 'player' ? '/player/home' : '/organizer/home');
        }
    }, [accessToken, navigate, role]);

    const handleRoleSelect = (selectedRole: Role) => {
        setRole(selectedRole);
        dispatch(resetRegistration());
    };

    const handleNext = async () => {
        if (!role) return;

        if (registrationStep === 1) {
            dispatch(registerUser({
                role,
                data: {
                    firstName: formData.firstName,
                    lastName: formData.lastName,
                    email: formData.email,
                    phone: formData.phone
                }
            }));
        } else if (registrationStep === 2) {
            if (registrationEmail) {
                dispatch(verifyOtp({
                    role,
                    data: { email: registrationEmail, otp: formData.otp }
                }));
            }
        } else if (registrationStep === 3) {
            if (formData.pwd !== formData.confirmPassword) {
                // You could store a local error here if needed.
                alert("Passwords do not match");
                return;
            }
            if (registrationEmail) {
                dispatch(setPassword({
                    role,
                    data: { email: registrationEmail, password: formData.pwd }
                }));
            }
        }
    };

    const handleBack = () => {
        if (registrationStep > 1) {
            // Ideally backend shouldn't need a "back" step for verification, we just reset Redux state if going back via local state
            // But since step is driven by Redux, going back drops the registration process essentially.
            // A simple implementation:
            dispatch(resetRegistration());
        } else {
            setRole(null);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setFormData({ ...formData, [e.target.id]: e.target.value });
    };

    if (!role) {
        return (
            <div className="flex min-h-screen flex-col items-center justify-center bg-black/95 p-4 py-24 font-montserrat">
                <Link to="/" className="mb-6" aria-label="Back to home">
                    <img src={logo} alt="Kria Sports" className="h-10 w-auto transition-opacity hover:opacity-80" />
                </Link>
                <Card className="w-full max-w-4xl border-white/10 bg-black/50 text-white backdrop-blur-md p-8">
                    <div className="text-center mb-10">
                        <h1 className="text-4xl font-bold font-oswald tracking-wide text-primary mb-2">Join Kria Sports</h1>
                        <p className="text-gray-400">Choose how you want to use the platform</p>
                    </div>

                    <div className="grid md:grid-cols-2 gap-6">
                        <div
                            className="group relative cursor-pointer rounded-xl border border-white/10 bg-white/5 p-8 hover:border-primary/50 hover:bg-white/10 transition-all duration-300"
                            onClick={() => handleRoleSelect('player')}
                        >
                            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary group-hover:scale-110 transition-transform">
                                <User className="h-8 w-8" />
                            </div>
                            <h3 className="text-2xl font-bold font-oswald mb-2">I am a Player</h3>
                            <p className="text-gray-400 text-sm">
                                Register to participate in auctions, view your stats, and manage your profile.
                            </p>
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowUpRight className="h-5 w-5 text-primary" />
                            </div>
                        </div>

                        <div
                            className="group relative cursor-pointer rounded-xl border border-white/10 bg-white/5 p-8 hover:border-primary/50 hover:bg-white/10 transition-all duration-300"
                            onClick={() => handleRoleSelect('organizer')}
                        >
                            <div className="mb-4 inline-flex h-16 w-16 items-center justify-center rounded-full bg-primary/20 text-primary group-hover:scale-110 transition-transform">
                                <Users className="h-8 w-8" />
                            </div>
                            <h3 className="text-2xl font-bold font-oswald mb-2">I am an Organizer</h3>
                            <p className="text-gray-400 text-sm">
                                Host auctions, manage teams, and oversee league operations.
                            </p>
                            <div className="absolute top-4 right-4 opacity-0 group-hover:opacity-100 transition-opacity">
                                <ArrowUpRight className="h-5 w-5 text-primary" />
                            </div>
                        </div>
                    </div>

                    <div className="mt-8 text-center">
                        <p className="text-sm text-gray-400">
                            Already have an account?{" "}
                            <Link to="/login" className="font-semibold text-primary hover:underline">
                                Sign in
                            </Link>
                        </p>
                    </div>
                </Card>
            </div>
        );
    }

    return (
        <div className="flex h-screen w-full items-center justify-center bg-black/95 p-4 py-24">
            <MultiStepForm
                currentStep={registrationStep}
                totalSteps={totalSteps}
                title={`Sign Up as ${role === 'player' ? 'Player' : 'Organizer'}`}
                description="Complete the steps to create your account."
                onBack={handleBack}
                onNext={handleNext}
                onClose={() => navigate('/')}
                className="border-white/10 bg-black/50  backdrop-blur-md"
                nextButtonText={isLoading ? "Processing..." : (registrationStep === totalSteps ? "Create Account" : "Next Step")}
                footerContent={
                    <p className="text-xs text-gray-500 mt-2">
                        By registering, you agree to our Terms & Conditions.
                    </p>
                }
            >
                {isLoading && (
                    <div className="absolute inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm rounded-lg">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                    </div>
                )}

                {error && (
                    <Alert variant="error" className="mb-4 bg-red-900/20 border-red-900/50 text-red-200">
                        <AlertCircle className="h-4 w-4" />
                        <AlertTitle>Error</AlertTitle>
                        <AlertDescription>{error}</AlertDescription>
                    </Alert>
                )}

                {/* Step 1: Basic Info */}
                {registrationStep === 1 && (
                    <div className="space-y-4 text-white">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-2">
                                <Label htmlFor="firstName" className="text-white">First Name</Label>
                                <Input
                                    id="firstName"
                                    placeholder="John"
                                    className="bg-white/5 border-white/10 text-white"
                                    value={formData.firstName}
                                    onChange={handleChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="lastName" className="text-white">Last Name</Label>
                                <Input
                                    id="lastName"
                                    placeholder="Doe"
                                    className="bg-white/5 border-white/10 text-white"
                                    value={formData.lastName}
                                    onChange={handleChange}
                                />
                            </div>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="email" className="text-white">Email</Label>
                            <Input
                                id="email"
                                type="email"
                                placeholder="john@example.com"
                                className="bg-white/5 border-white/10 text-white"
                                value={formData.email}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="phone" className="text-white">Phone Number</Label>
                            <Input
                                id="phone"
                                type="tel"
                                placeholder="+91 98765 43210"
                                className="bg-white/5 border-white/10 text-white"
                                value={formData.phone}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                )}

                {/* Step 2: OTP Verification */}
                {registrationStep === 2 && (
                    <div className="space-y-6 text-center">
                        <div className="flex flex-col items-center justify-center space-y-2">
                            <div className="p-3 bg-primary/20 rounded-full text-primary">
                                <CheckCircle2 className="h-8 w-8" />
                            </div>
                            <h3 className="text-xl font-bold text-white">Verify your Email</h3>
                            <p className="text-gray-400 text-sm">
                                We've sent a verification code to <span className="text-white font-medium">{registrationEmail || formData.email}</span>
                            </p>
                        </div>

                        <div className="space-y-2 max-w-xs mx-auto">
                            <Label htmlFor="otp" className="text-white">Enter OTP</Label>
                            <Input
                                id="otp"
                                placeholder="123456"
                                className="bg-white/5 border-white/10 text-white text-center text-2xl tracking-[0.5em]"
                                maxLength={6}
                                value={formData.otp}
                                onChange={handleChange}
                            />
                        </div>
                        <Button variant="link" className="text-primary text-sm">Resend Code</Button>
                    </div>
                )}

                {/* Step 3: Set Password */}
                {registrationStep === 3 && (
                    <div className="space-y-4">
                        <Alert className="bg-primary/10 border-primary/20 text-primary">
                            <AlertTriangle className="h-4 w-4 text-white" />
                            <AlertDescription>
                                Secure your account with a strong password.
                            </AlertDescription>
                        </Alert>
                        <div className="space-y-2">
                            <Label htmlFor="pwd" className="text-white">Password</Label>
                            <Input
                                id="pwd"
                                type="password"
                                className="bg-white/5 border-white/10 text-white"
                                value={formData.pwd}
                                onChange={handleChange}
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="confirmPassword" className="text-white">Confirm Password</Label>
                            <Input
                                id="confirmPassword"
                                type="password"
                                className="bg-white/5 border-white/10 text-white"
                                value={formData.confirmPassword}
                                onChange={handleChange}
                            />
                        </div>
                    </div>
                )}
            </MultiStepForm>
        </div>
    );
}
