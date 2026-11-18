import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import HoverFooter from '@/components/HoverFooter';
import SmoothScroll from '@/components/SmoothScroll';
import { deleteWithCode, sendDeletionCode } from '@/api/deleteAccount';

// LAUNCH-AUDIT B7: Google Play needs a public page where a player can delete
// their Kria account without the app. Same rules as in the app.

type Step = 'email' | 'code' | 'done';

const field = 'bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary/60 transition-all duration-200 text-sm';
const label = 'text-xs font-semibold uppercase tracking-widest text-gray-400';
const primary = 'bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200';

const DeleteAccountPage: React.FC = () => {
    const [step, setStep] = useState<Step>('email');
    const [email, setEmail] = useState('');
    const [code, setCode] = useState('');
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');

    const run = async (work: () => Promise<void>, next: Step) => {
        if (busy) return;
        setBusy(true);
        setError('');
        try {
            await work();
            setStep(next);
        } catch (e) {
            setError((e as Error).message);
        } finally {
            setBusy(false);
        }
    };

    const send = (e: React.FormEvent) => {
        e.preventDefault();
        const clean = email.trim().toLowerCase();
        setEmail(clean);
        run(() => sendDeletionCode(clean), 'code');
    };
    const remove = (e: React.FormEvent) => {
        e.preventDefault();
        run(() => deleteWithCode(email, code.trim()), 'done');
    };

    return (
        <SmoothScroll>
            <div className="relative min-h-screen bg-black text-white font-montserrat overflow-x-hidden">
                <Navbar />
                <main className="max-w-xl mx-auto px-6 pt-32 pb-24">
                    <h1 className="font-oswald text-4xl md:text-5xl font-bold uppercase tracking-tight mb-4">Delete your Kria account</h1>

                    {step === 'done' ? (
                        <div className="space-y-3" role="status">
                            <p className="text-lg font-semibold">Your account has been deleted.</p>
                            <p className="text-gray-400">You've been signed out everywhere. You can sign up again with the same email whenever you like.</p>
                        </div>
                    ) : (
                        <>
                            <div className="text-gray-400 space-y-3 mb-8">
                                <p>Your name, email, phone, photo and sign-in go for good. Your match results stay, shown as "Deleted player", so other players' brackets and records still add up. Payment records are kept because the law requires it.</p>
                                <p>You can also do this in the Kria app: Profile, then Settings, then Delete account.</p>
                            </div>

                            {step === 'email' ? (
                                <form onSubmit={send} className="flex flex-col gap-4">
                                    <label htmlFor="delete-email" className={label}>Email</label>
                                    <input id="delete-email" type="email" required autoComplete="email" value={email}
                                        onChange={(e) => setEmail(e.target.value)} placeholder="The email you sign in with" className={field} />
                                    <button type="submit" disabled={busy} className={primary}>{busy ? 'Sending' : 'Send code'}</button>
                                </form>
                            ) : (
                                <form onSubmit={remove} className="flex flex-col gap-4">
                                    <p className="text-sm text-gray-300">We sent a 6-digit code to <span className="text-white font-semibold">{email}</span>.</p>
                                    <label htmlFor="delete-code" className={label}>Code</label>
                                    <input id="delete-code" inputMode="numeric" autoComplete="one-time-code" required maxLength={6} value={code}
                                        onChange={(e) => setCode(e.target.value)} placeholder="123456" className={field} />
                                    <button type="submit" disabled={busy} className={primary}>{busy ? 'Deleting' : 'Delete my account'}</button>
                                    <button type="button" disabled={busy} onClick={() => { setStep('email'); setCode(''); setError(''); }}
                                        className="text-sm text-gray-400 hover:text-white underline self-start">Use a different email</button>
                                </form>
                            )}
                            {error ? <p role="alert" className="mt-4 text-sm text-red-400">{error}</p> : null}
                        </>
                    )}
                </main>
                <HoverFooter />
            </div>
        </SmoothScroll>
    );
};

export default DeleteAccountPage;
