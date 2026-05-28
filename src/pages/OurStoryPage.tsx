import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useInView } from 'framer-motion';
import {
    Zap,
    Trophy,
    Users,
    Gavel,
    Target,
    ArrowRight,
    Flame,
    Heart,
    Star,
} from 'lucide-react';
import Navbar from '@/components/Navbar';
import HoverFooter from '@/components/HoverFooter';
import SmoothScroll from '@/components/SmoothScroll';
import SectionHeader from '@/components/ui/SectionHeader';
import { Reveal } from '@/components/ui/Reveal';

// ─── Shared ambient glow ───────────────────────────────────────────────────────
const AmbientGlow: React.FC<{ className?: string }> = ({ className = '' }) => (
    <div className={`absolute rounded-full blur-3xl pointer-events-none ${className}`} />
);

// ─── Animated stat card ────────────────────────────────────────────────────────
interface StatCardProps {
    value: string;
    label: string;
    delay?: number;
}

const StatCard: React.FC<StatCardProps> = ({ value, label, delay = 0 }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-60px' });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay, ease: 'easeOut' }}
            className="group relative flex flex-col items-center justify-center p-8 bg-white/[0.03] border border-white/10 rounded-2xl hover:border-primary/40 hover:bg-white/[0.06] transition-all duration-300 text-center overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-b from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl" />
            <span className="font-oswald text-5xl md:text-6xl font-bold text-primary leading-none mb-2 relative z-10">
                {value}
            </span>
            <span className="font-montserrat text-sm text-gray-400 uppercase tracking-widest relative z-10">
                {label}
            </span>
        </motion.div>
    );
};

// ─── Timeline item ─────────────────────────────────────────────────────────────
interface TimelineItemProps {
    year: string;
    title: string;
    description: string;
    icon: React.ReactNode;
    isLast?: boolean;
    delay?: number;
}

const TimelineItem: React.FC<TimelineItemProps> = ({
    year,
    title,
    description,
    icon,
    isLast = false,
    delay = 0,
}) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-60px' });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, x: -30 }}
            animate={isInView ? { opacity: 1, x: 0 } : {}}
            transition={{ duration: 0.6, delay, ease: 'easeOut' }}
            className="flex gap-6 md:gap-10"
        >
            {/* Spine */}
            <div className="flex flex-col items-center shrink-0">
                <div className="w-12 h-12 rounded-full bg-primary/10 border-2 border-primary/40 flex items-center justify-center text-primary shrink-0">
                    {icon}
                </div>
                {!isLast && <div className="w-px flex-1 bg-gradient-to-b from-primary/30 to-transparent mt-3" />}
            </div>

            {/* Content */}
            <div className={`pb-12 ${isLast ? '' : ''}`}>
                <span className="inline-block font-oswald text-primary text-sm font-bold uppercase tracking-widest mb-1">
                    {year}
                </span>
                <h3 className="font-oswald text-xl md:text-2xl font-bold text-white uppercase tracking-wide mb-2">
                    {title}
                </h3>
                <p className="font-montserrat text-gray-400 text-sm md:text-base leading-relaxed max-w-xl">
                    {description}
                </p>
            </div>
        </motion.div>
    );
};

// ─── Value card ────────────────────────────────────────────────────────────────
interface ValueCardProps {
    icon: React.ReactNode;
    title: string;
    description: string;
    delay?: number;
}

const ValueCard: React.FC<ValueCardProps> = ({ icon, title, description, delay = 0 }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-50px' });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay, ease: 'easeOut' }}
            whileHover={{ y: -6 }}
            className="group relative p-7 rounded-2xl border border-white/10 bg-gray-900/40 hover:border-primary/30 hover:bg-gray-800/60 transition-all duration-400 overflow-hidden"
        >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 rounded-2xl pointer-events-none" />
            <div className="absolute -bottom-4 -right-4 text-white/5 scale-150 group-hover:scale-[1.75] group-hover:rotate-6 transition-all duration-700 pointer-events-none">
                {icon}
            </div>
            <div className="relative z-10">
                <div className="mb-5 p-3 bg-white/5 w-fit rounded-xl border border-white/5 group-hover:scale-110 transition-transform duration-500">
                    {icon}
                </div>
                <h3 className="font-oswald text-xl font-semibold text-white mb-2 uppercase tracking-wide group-hover:text-primary transition-colors duration-300">
                    {title}
                </h3>
                <p className="font-montserrat text-gray-400 text-sm leading-relaxed">{description}</p>
            </div>
        </motion.div>
    );
};

// ─── Team member card ──────────────────────────────────────────────────────────
interface TeamMemberProps {
    initials: string;
    name: string;
    role: string;
    color: string;
    delay?: number;
}

const TeamMemberCard: React.FC<TeamMemberProps> = ({ initials, name, role, color, delay = 0 }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: '-50px' });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 30 }}
            animate={isInView ? { opacity: 1, y: 0 } : {}}
            transition={{ duration: 0.6, delay, ease: 'easeOut' }}
            className="group flex flex-col items-center text-center gap-4"
        >
            <div
                className="w-24 h-24 rounded-2xl flex items-center justify-center text-white text-3xl font-oswald font-bold border border-white/10 group-hover:scale-105 transition-transform duration-300"
                style={{ background: color }}
            >
                {initials}
            </div>
            <div>
                <p className="font-oswald text-white font-semibold text-lg uppercase tracking-wide">
                    {name}
                </p>
                <p className="font-montserrat text-gray-500 text-xs uppercase tracking-widest mt-0.5">
                    {role}
                </p>
            </div>
        </motion.div>
    );
};

// ─── Page ──────────────────────────────────────────────────────────────────────
const OurStoryPage: React.FC = () => {
    const heroRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
    const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
    const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

    return (
        <SmoothScroll>
            <div className="relative min-h-screen bg-black text-white font-montserrat overflow-x-hidden">
                <Navbar />

                {/* ══════════════════════════════════════════════════════════════
                    HERO — cinematic parallax banner
                ══════════════════════════════════════════════════════════════ */}
                <section
                    ref={heroRef}
                    className="relative w-full min-h-screen flex items-center justify-center overflow-hidden"
                >
                    {/* Ambient glows */}
                    <AmbientGlow className="top-0 left-1/2 -translate-x-1/2 w-[800px] h-[500px] bg-primary/15" />
                    <AmbientGlow className="bottom-0 left-0 w-72 h-72 bg-primary/8" />
                    <AmbientGlow className="top-20 right-0 w-56 h-56 bg-orange-300/5" />

                    {/* Grid texture */}
                    <div
                        className="absolute inset-0 opacity-[0.04]"
                        style={{
                            backgroundImage:
                                'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
                            backgroundSize: '60px 60px',
                        }}
                    />

                    {/* Large watermark text */}
                    <div className="absolute inset-0 flex items-center justify-center pointer-events-none select-none">
                        <span className="font-oswald text-[22vw] font-black text-white/[0.025] uppercase tracking-tighter leading-none">
                            KRIA
                        </span>
                    </div>

                    <motion.div
                        style={{ y: heroY, opacity: heroOpacity }}
                        className="relative z-10 max-w-5xl mx-auto px-6 text-center"
                    >
                        <motion.span
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6 }}
                            className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-8"
                        >
                            <Flame size={14} />
                            Our Story
                        </motion.span>

                        <motion.h1
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.1 }}
                            className="font-oswald text-[clamp(3rem,10vw,6.5rem)] font-bold uppercase tracking-tight leading-none mb-6"
                        >
                            Built for the{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-300">
                                Court.
                            </span>
                            <br />
                            Made with{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-orange-300 to-primary">
                                Passion.
                            </span>
                        </motion.h1>

                        <motion.p
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.8, delay: 0.25 }}
                            className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10"
                        >
                            We started with a simple frustration, local sports tournaments were chaotic,
                            paper-driven and unfair. So we built the platform we always wished existed.
                        </motion.p>

                        <motion.a
                            href="/contact"
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ duration: 0.6, delay: 0.4 }}
                            className="inline-flex items-center gap-3 bg-primary hover:bg-primary/90 text-white font-oswald font-semibold text-lg uppercase tracking-wider px-10 py-4 rounded-xl transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                        >
                            Join Our Mission
                            <ArrowRight size={20} />
                        </motion.a>
                    </motion.div>

                    {/* Scroll indicator */}
                    <div className="absolute bottom-8 left-1/2 -translate-x-1/2 animate-bounce">
                        <svg className="w-6 h-6 text-white/30" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
                        </svg>
                    </div>
                </section>

                {/* ══════════════════════════════════════════════════════════════
                    STATS STRIP
                ══════════════════════════════════════════════════════════════ */}
                <section className="relative py-20 border-y border-white/5 bg-white/[0.01]">
                    <AmbientGlow className="top-0 right-1/4 w-96 h-48 bg-primary/8" />
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
                            <StatCard value="500+" label="Players Managed" delay={0.0} />
                            <StatCard value="20+" label="Tournaments Run" delay={0.1} />
                            <StatCard value="3" label="Sports Supported" delay={0.2} />
                            <StatCard value="100%" label="Transparency" delay={0.3} />
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════════════════════════════
                    THE PROBLEM WE SOLVED
                ══════════════════════════════════════════════════════════════ */}
                <section className="relative py-24 overflow-hidden">
                    <AmbientGlow className="top-0 left-0 w-[500px] h-[400px] bg-primary/8" />

                    <div className="max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 gap-16 items-center">
                        {/* Left: text */}
                        <div>
                            <SectionHeader
                                title="The Problem"
                                highlight="We Solved"
                                subtitle="Origin Story"
                            />
                            <div className="space-y-6 font-montserrat text-gray-400 leading-relaxed">
                                <Reveal delay={0.1} width="100%">
                                    <p>
                                        Local sports in India are fiercely competitive and completely
                                        disorganised. Spreadsheets break. WhatsApp groups overflow.
                                        Auction records get lost. Players never know where they stand.
                                    </p>
                                </Reveal>
                                <Reveal delay={0.2} width="100%">
                                    <p>
                                        We watched organisers spend more time firefighting logistics than
                                        celebrating sport. We watched talented players get overlooked because
                                        no one was tracking their numbers. We decided that had to change.
                                    </p>
                                </Reveal>
                                <Reveal delay={0.3} width="100%">
                                    <p className="text-white font-semibold">
                                        Kria Sports is the single source of truth for every tournament
                                        from first registration to final trophy.
                                    </p>
                                </Reveal>
                            </div>
                        </div>

                        {/* Right: pain-point cards */}
                        <div className="grid grid-cols-1 gap-4">
                            {[
                                {
                                    num: '01',
                                    title: 'No transparency',
                                    body: 'Auction results were verbal, disputed, and unrecorded. Teams never trusted the process.',
                                },
                                {
                                    num: '02',
                                    title: 'Manual chaos',
                                    body: 'Scores on notepads, brackets on whiteboards, budgets on Excel. Errors everywhere.',
                                },
                                {
                                    num: '03',
                                    title: 'Players in the dark',
                                    body: 'Athletes had no visibility into fixtures, standings, or their own career stats.',
                                },
                            ].map((item, i) => (
                                <Reveal key={i} delay={i * 0.12} width="100%">
                                    <div className="flex gap-5 p-5 bg-white/[0.03] border border-white/10 rounded-2xl hover:border-primary/30 transition-colors duration-300">
                                        <span className="font-oswald text-3xl font-bold text-primary/30 shrink-0">
                                            {item.num}
                                        </span>
                                        <div>
                                            <p className="font-oswald text-white font-semibold uppercase tracking-wide mb-1">
                                                {item.title}
                                            </p>
                                            <p className="font-montserrat text-gray-400 text-sm leading-relaxed">
                                                {item.body}
                                            </p>
                                        </div>
                                    </div>
                                </Reveal>
                            ))}
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════════════════════════════
                    TIMELINE — HOW WE GOT HERE
                ══════════════════════════════════════════════════════════════ */}
                <section className="relative py-24 border-t border-white/5 overflow-hidden">
                    <AmbientGlow className="top-1/2 right-0 w-96 h-96 bg-primary/6" />

                    <div className="max-w-7xl mx-auto px-6">
                        <div className="mb-16">
                            <SectionHeader
                                title="How We Got"
                                highlight="Here"
                                subtitle="Our Journey"
                                align="center"
                            />
                        </div>

                        <div className="max-w-2xl mx-auto">
                            <TimelineItem
                                year="2023 — The Idea"
                                title="Frustration Becomes Inspiration"
                                description="After co-founding a local badminton league in Bangalore and watching the chaos of paper-based auctions, our team asked: why doesn't a proper platform exist for this?"
                                icon={<Zap size={20} />}
                                delay={0.1}
                            />
                            <TimelineItem
                                year="Early 2024 — First Build"
                                title="MVP for Badminton"
                                description="We started small, one sport, one city. Our first tournament ran on an early prototype. Players loved the transparency. Organizers loved the control. We knew we were onto something."
                                icon={<Trophy size={20} />}
                                delay={0.2}
                            />
                            <TimelineItem
                                year="Mid 2024 — Auction Engine"
                                title="Manual-Assisted Auction Goes Live"
                                description="Staff-assisted bidding with real-time leaderboards launched. For the first time, every rupee bid was logged, every team budget tracked live. Zero disputes."
                                icon={<Gavel size={20} />}
                                delay={0.3}
                            />
                            <TimelineItem
                                year="Late 2024 — Growing Community"
                                title="500+ Players. 20+ Tournaments."
                                description="Word spread. More clubs, more cities, more sports. We expanded our team and began building category management, leaderboards, and player career profiles."
                                icon={<Users size={20} />}
                                delay={0.4}
                            />
                            <TimelineItem
                                year="2025 — Today"
                                title="The Vision Sharpens"
                                description="We're building towards a future where every local athlete has access to professional-grade tournament infrastructure, no matter the city, no matter the sport."
                                icon={<Star size={20} />}
                                isLast
                                delay={0.5}
                            />
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════════════════════════════
                    OUR VALUES
                ══════════════════════════════════════════════════════════════ */}
                <section id="values" className="relative py-24 border-t border-white/5 overflow-hidden">
                    <AmbientGlow className="top-0 left-1/4 w-[500px] h-[300px] bg-primary/8" />
                    <AmbientGlow className="bottom-0 right-0 w-64 h-64 bg-primary/5" />

                    <div className="max-w-7xl mx-auto px-6">
                        <div className="mb-16 text-center">
                            <SectionHeader
                                title="What We"
                                highlight="Stand For"
                                subtitle="Our Values"
                                align="center"
                            />
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                            <ValueCard
                                icon={<Target className="w-9 h-9 text-primary" />}
                                title="Transparency"
                                description="Every bid, every score, every decision is logged and visible. Sport deserves honesty."
                                delay={0.1}
                            />
                            <ValueCard
                                icon={<Zap className="w-9 h-9 text-primary" />}
                                title="Empowerment"
                                description="We give organisers real tools and players real visibility, not workarounds."
                                delay={0.2}
                            />
                            <ValueCard
                                icon={<Heart className="w-9 h-9 text-primary" />}
                                title="Community First"
                                description="Local sport is the heartbeat of a city. We exist to make it thrive, not commercialise it."
                                delay={0.3}
                            />
                            <ValueCard
                                icon={<Trophy className="w-9 h-9 text-primary" />}
                                title="Excellence"
                                description="Professional-grade tools at grassroots scale. Because every athlete deserves the best."
                                delay={0.4}
                            />
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════════════════════════════
                    TEAM
                ══════════════════════════════════════════════════════════════ */}
                <section className="relative py-24 border-t border-white/5 overflow-hidden">
                    <AmbientGlow className="top-0 right-1/3 w-96 h-48 bg-primary/8" />

                    <div className="max-w-7xl mx-auto px-6">
                        <div className="mb-16 text-center">
                            <SectionHeader
                                title="The People"
                                highlight="Behind Kria"
                                subtitle="Our Team"
                                align="center"
                            />
                            <Reveal delay={0.2} width="100%">
                                <p className="text-gray-400 text-base md:text-lg max-w-xl mx-auto -mt-8 leading-relaxed">
                                    A small, passionate team of sports enthusiasts, engineers, and designers
                                    who believe technology should serve sport, not the other way around.
                                </p>
                            </Reveal>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-10 justify-items-center max-w-2xl mx-auto">
                            <TeamMemberCard
                                initials="KB"
                                name="Kaivanya Bhandari"
                                role="Co-Founder"
                                color="linear-gradient(135deg, #F97316 0%, #ea580c 100%)"
                                delay={0.1}
                            />
                            <TeamMemberCard
                                initials="NA"
                                name="Neer Ajbani"
                                role="CEO"
                                color="linear-gradient(135deg, #7c3aed 0%, #5b21b6 100%)"
                                delay={0.2}
                            />
                            <TeamMemberCard
                                initials="RS"
                                name="Rohan Sunwar"
                                role="Product Manager & Lead Engineer"
                                color="linear-gradient(135deg, #0891b2 0%, #0e7490 100%)"
                                delay={0.3}
                            />
                        </div>
                    </div>
                </section>

                {/* ══════════════════════════════════════════════════════════════
                    CTA — Join the mission
                ══════════════════════════════════════════════════════════════ */}
                <section className="relative py-24 border-t border-white/5 overflow-hidden">
                    <div className="max-w-7xl mx-auto px-6">
                        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 p-12 md:p-20 text-center">
                            {/* Inner glows */}
                            <AmbientGlow className="-top-10 -right-10 w-60 h-60 bg-primary/25" />
                            <AmbientGlow className="-bottom-10 -left-10 w-48 h-48 bg-primary/15" />

                            <Reveal delay={0.1} width="100%">
                                <span className="inline-flex items-center gap-2 bg-primary/10 border border-primary/20 text-primary text-xs font-semibold uppercase tracking-widest px-4 py-2 rounded-full mb-6">
                                    <Flame size={14} />
                                    Ready to Play?
                                </span>
                            </Reveal>

                            <Reveal delay={0.2} width="100%">
                                <h2 className="font-oswald text-4xl md:text-6xl font-bold uppercase tracking-tight text-white mb-6">
                                    Bring Your Tournament{' '}
                                    <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-300">
                                        to Life
                                    </span>
                                </h2>
                            </Reveal>

                            <Reveal delay={0.3} width="100%">
                                <p className="font-montserrat text-gray-400 text-base md:text-lg max-w-xl mx-auto mb-10 leading-relaxed">
                                    Whether you're organising your first tournament or your fiftieth,
                                    Kria Sports gives you the tools to run it right.
                                </p>
                            </Reveal>

                            <Reveal delay={0.4} width="100%">
                                <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                                    <a
                                        href="/register"
                                        className="inline-flex items-center gap-3 bg-primary hover:bg-primary/90 text-white font-oswald font-semibold text-lg uppercase tracking-wider px-10 py-4 rounded-xl transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                                    >
                                        Get Started Free
                                        <ArrowRight size={20} />
                                    </a>
                                    <a
                                        href="/contact"
                                        className="inline-flex items-center gap-3 border border-white/20 hover:border-primary/50 text-white hover:text-primary font-oswald font-semibold text-lg uppercase tracking-wider px-10 py-4 rounded-xl transition-all duration-200 hover:-translate-y-0.5"
                                    >
                                        Talk to Us
                                    </a>
                                </div>
                            </Reveal>
                        </div>
                    </div>
                </section>

                <HoverFooter />
            </div>
        </SmoothScroll>
    );
};

export default OurStoryPage;
