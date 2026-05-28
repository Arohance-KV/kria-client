import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import HoverFooter from '@/components/HoverFooter';
import SmoothScroll from '@/components/SmoothScroll';
import { Mail, Phone, MapPin, Send, CheckCircle } from 'lucide-react';

const ContactPage: React.FC = () => {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        phone: '',
        subject: '',
        message: '',
    });
    const [submitted, setSubmitted] = useState(false);
    const [loading, setLoading] = useState(false);

    const handleChange = (
        e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
    ) => {
        setFormData({ ...formData, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        // Simulate API call
        await new Promise((r) => setTimeout(r, 1200));
        setLoading(false);
        setSubmitted(true);
    };

    const contactCards = [
        {
            icon: <Mail size={28} className="text-primary" />,
            title: 'Email Us',
            value: 'info@arohance.com',
            href: 'mailto:info@arohance.com',
            description: 'We typically respond within 24 hours',
        },
        {
            icon: <Phone size={28} className="text-primary" />,
            title: 'Call Us',
            value: '+91 93273 67979',
            href: 'tel:+919327367979',
            description: 'Mon – Sat, 9 AM – 6 PM IST',
        },
        {
            icon: <MapPin size={28} className="text-primary" />,
            title: 'Visit Us',
            value: 'Bangalore, India',
            description: 'Available for in-person demos',
        },
    ];

    const subjects = [
        'General Inquiry',
        'Tournament Setup',
        'Auction Platform',
        'Technical Support',
        'Partnership',
        'Other',
    ];

    return (
        <SmoothScroll>
            <div className="relative min-h-screen bg-black text-white font-montserrat overflow-x-hidden">
                <Navbar />

                {/* ── Hero Banner ── */}
                <section className="relative pt-32 pb-20 overflow-hidden">
                    {/* Background glow */}
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[700px] h-[400px] bg-primary/10 rounded-full blur-3xl" />
                        <div className="absolute top-20 right-0 w-64 h-64 bg-primary/5 rounded-full blur-2xl" />
                    </div>

                    {/* Grid texture */}
                    <div
                        className="absolute inset-0 opacity-[0.03]"
                        style={{
                            backgroundImage:
                                'linear-gradient(rgba(255,255,255,.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.5) 1px, transparent 1px)',
                            backgroundSize: '60px 60px',
                        }}
                    />

                    <div className="relative max-w-7xl mx-auto px-6 text-center">
                        <span className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                            Get In Touch
                        </span>
                        <h1 className="font-oswald text-5xl md:text-7xl font-bold uppercase tracking-tight mb-6">
                            Contact{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-300">
                                Us
                            </span>
                        </h1>
                        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
                            Have a question about Kria Sports? Want to organise a tournament or integrate
                            our auction platform? We'd love to hear from you.
                        </p>
                    </div>
                </section>

                {/* ── Contact Cards ── */}
                <section className="max-w-7xl mx-auto px-6 pb-16">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        {contactCards.map((card, i) => (
                            <div
                                key={i}
                                className="group relative bg-white/[0.03] border border-white/10 rounded-2xl p-8 hover:border-primary/40 hover:bg-white/[0.06] transition-all duration-300"
                            >
                                <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent rounded-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                                <div className="relative">
                                    <div className="bg-primary/10 w-14 h-14 rounded-xl flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                                        {card.icon}
                                    </div>
                                    <h3 className="font-oswald text-xl font-semibold uppercase tracking-wide text-white mb-2">
                                        {card.title}
                                    </h3>
                                    {card.href ? (
                                        <a
                                            href={card.href}
                                            className="text-primary hover:text-orange-300 transition-colors font-semibold text-sm block mb-1"
                                        >
                                            {card.value}
                                        </a>
                                    ) : (
                                        <p className="text-primary font-semibold text-sm mb-1">{card.value}</p>
                                    )}
                                    <p className="text-gray-500 text-xs">{card.description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </section>

                {/* ── Contact Form ── */}
                <section className="max-w-4xl mx-auto px-6 pb-24">
                    <div className="bg-white/[0.03] border border-white/10 rounded-3xl p-8 md:p-14 relative overflow-hidden">
                        {/* Top accent line */}
                        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-gradient-to-r from-transparent via-primary to-transparent" />

                        {submitted ? (
                            <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
                                <div className="w-20 h-20 rounded-full bg-primary/10 border border-primary/30 flex items-center justify-center animate-pulse">
                                    <CheckCircle size={40} className="text-primary" />
                                </div>
                                <h2 className="font-oswald text-3xl font-bold uppercase tracking-wide text-white">
                                    Message Sent!
                                </h2>
                                <p className="text-gray-400 max-w-md">
                                    Thanks for reaching out. Our team will get back to you within 24 hours.
                                </p>
                                <button
                                    onClick={() => { setSubmitted(false); setFormData({ name: '', email: '', phone: '', subject: '', message: '' }); }}
                                    className="mt-4 bg-primary hover:bg-primary/90 text-white font-semibold px-8 py-3 rounded-xl transition-all duration-200 hover:shadow-lg hover:shadow-primary/30"
                                >
                                    Send Another Message
                                </button>
                            </div>
                        ) : (
                            <>
                                <h2 className="font-oswald text-3xl md:text-4xl font-bold uppercase tracking-wide text-white mb-2">
                                    Send a Message
                                </h2>
                                <p className="text-gray-400 text-sm mb-10">
                                    Fill in the form below and we'll get back to you shortly.
                                </p>

                                <form onSubmit={handleSubmit} className="space-y-6">
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                        {/* Name */}
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                                                Full Name <span className="text-primary">*</span>
                                            </label>
                                            <input
                                                type="text"
                                                name="name"
                                                required
                                                value={formData.name}
                                                onChange={handleChange}
                                                placeholder="John Doe"
                                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary/60 focus:bg-white/8 transition-all duration-200 text-sm"
                                            />
                                        </div>

                                        {/* Email */}
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                                                Email Address <span className="text-primary">*</span>
                                            </label>
                                            <input
                                                type="email"
                                                name="email"
                                                required
                                                value={formData.email}
                                                onChange={handleChange}
                                                placeholder="john@example.com"
                                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary/60 focus:bg-white/8 transition-all duration-200 text-sm"
                                            />
                                        </div>

                                        {/* Phone */}
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                                                Phone Number
                                            </label>
                                            <input
                                                type="tel"
                                                name="phone"
                                                value={formData.phone}
                                                onChange={handleChange}
                                                placeholder="+91 98765 43210"
                                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary/60 focus:bg-white/8 transition-all duration-200 text-sm"
                                            />
                                        </div>

                                        {/* Subject */}
                                        <div className="flex flex-col gap-2">
                                            <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                                                Subject <span className="text-primary">*</span>
                                            </label>
                                            <select
                                                name="subject"
                                                required
                                                value={formData.subject}
                                                onChange={handleChange}
                                                className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white focus:outline-none focus:border-primary/60 transition-all duration-200 text-sm appearance-none cursor-pointer"
                                            >
                                                <option value="" disabled className="bg-gray-900">
                                                    Select a subject
                                                </option>
                                                {subjects.map((s) => (
                                                    <option key={s} value={s} className="bg-gray-900">
                                                        {s}
                                                    </option>
                                                ))}
                                            </select>
                                        </div>
                                    </div>

                                    {/* Message */}
                                    <div className="flex flex-col gap-2">
                                        <label className="text-xs font-semibold uppercase tracking-widest text-gray-400">
                                            Message <span className="text-primary">*</span>
                                        </label>
                                        <textarea
                                            name="message"
                                            required
                                            rows={5}
                                            value={formData.message}
                                            onChange={handleChange}
                                            placeholder="Tell us about your tournament or how we can help you..."
                                            className="bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-gray-600 focus:outline-none focus:border-primary/60 focus:bg-white/8 transition-all duration-200 text-sm resize-none"
                                        />
                                    </div>

                                    <button
                                        type="submit"
                                        disabled={loading}
                                        className="flex items-center gap-3 bg-primary hover:bg-primary/90 disabled:opacity-60 text-white font-semibold px-10 py-4 rounded-xl transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5 active:translate-y-0"
                                    >
                                        {loading ? (
                                            <>
                                                <svg className="animate-spin w-5 h-5" viewBox="0 0 24 24" fill="none">
                                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8z" />
                                                </svg>
                                                Sending…
                                            </>
                                        ) : (
                                            <>
                                                <Send size={18} />
                                                Send Message
                                            </>
                                        )}
                                    </button>
                                </form>
                            </>
                        )}
                    </div>
                </section>

                <HoverFooter />
            </div>
        </SmoothScroll>
    );
};

export default ContactPage;
