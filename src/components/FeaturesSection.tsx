import React, { useRef } from 'react';
import { motion, useScroll, useTransform, useSpring, useInView } from 'framer-motion';
import {
    Trophy,
    Users,
    Gavel,
    ClipboardCheck,
    BarChart3,
    Smartphone,
    ArrowRight,
    Zap,
    Crown,
    ShieldCheck
} from 'lucide-react';
import SectionHeader from './ui/SectionHeader';

const FeaturesSection: React.FC = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const { scrollYProgress } = useScroll({
        target: containerRef,
        offset: ["start end", "end start"]
    });

    const y = useTransform(scrollYProgress, [0, 1], [100, -100]);

    return (
        <section id="features" ref={containerRef} className="relative w-full min-h-screen bg-black text-white py-24 px-4 overflow-hidden">
            {/* Ambient Background Glow */}
            <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-0 right-1/4 w-[500px] h-[500px] bg-primary/5 rounded-full blur-[120px] pointer-events-none" />

            <div className="container mx-auto max-w-7xl relative z-10">
                {/* Header Section */}
                <div className="mb-20 space-y-6 text-center md:text-left">
                    <SectionHeader
                        title="Built for"
                        highlight="Real Tournaments"

                    />

                    <motion.p
                        initial={{ opacity: 0, y: 20 }}
                        whileInView={{ opacity: 1, y: 0 }}
                        transition={{ duration: 0.8, delay: 0.2, ease: "easeOut" }}
                        viewport={{ once: true }}
                        className="text-gray-400 text-lg md:text-xl font-montserrat max-w-2xl leading-relaxed"
                    >
                        Run structured badminton tournaments with real-world flexibility. Our platform doesn’t try to replace organizers — it empowers them.
                    </motion.p>
                </div>

                {/* Bento Grid Features */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 md:gap-6 auto-rows-[minmax(220px,auto)] md:auto-rows-[minmax(300px,auto)]">

                    {/* Feature 1: Smart Tournament Management (Large Card) */}
                    <FeatureCard
                        className="md:col-span-2 md:row-span-1"
                        icon={<Trophy className="w-10 h-10 text-primary" />}
                        title="Smart Tournament Management"
                        description="Create tournaments with multiple categories like Under-18 Singles or Men’s Doubles. Each category runs independently with its own format."
                        delay={0.1}
                    >
                        <div className="mt-6 flex flex-wrap gap-2">
                            {["League", "Knockout", "Hybrid", "Custom Points"].map((tag, i) => (
                                <span key={i} className="px-3 py-1 bg-primary/10 border border-primary/20 rounded-full text-xs text-primary/80 font-oswald tracking-wide">
                                    {tag}
                                </span>
                            ))}
                        </div>
                    </FeatureCard>

                    {/* Feature 2: Team-Based Structure */}
                    <FeatureCard
                        className="md:col-span-1 md:row-span-2 bg-gradient-to-b from-gray-900 to-black"
                        icon={<Users className="w-10 h-10 text-primary" />}
                        title="Team-Based Structure"
                        description="Teams are defined before registrations open. Add owners, assign players, and track performance in real-time."
                        delay={0.2}
                    >
                        <div className="absolute bottom-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-[40px]" />
                        <div className="mt-8 space-y-3">
                            <div className="flex items-center gap-3 text-sm text-gray-400">
                                <Crown className="w-4 h-4 text-primary" /> <span>Owner Management</span>
                            </div>
                            <div className="flex items-center gap-3 text-sm text-gray-400">
                                <ShieldCheck className="w-4 h-4 text-primary/70" /> <span>Roster Validation</span>
                            </div>
                        </div>
                    </FeatureCard>

                    {/* Feature 3: Assisted Auction System */}
                    <FeatureCard
                        className="md:col-span-1 md:row-span-1"
                        icon={<Gavel className="w-10 h-10 text-primary" />}
                        title="Assisted Auction System"
                        description="Designed for physical auctions. Staff records the winning bid while the live excitement stays offline."
                        delay={0.3}
                    />

                    {/* Feature 4: Staff-Driven Scoring */}
                    <FeatureCard
                        className="md:col-span-1 md:row-span-1"
                        icon={<ClipboardCheck className="w-10 h-10 text-primary" />}
                        title="Staff-Driven Scoring"
                        description="Keep scoring accurate with controlled input. Record match scores quickly and lock results to prevent disputes."
                        delay={0.4}
                    />

                    {/* Feature 5: Leaderboards (Wide) */}
                    <FeatureCard
                        className="md:col-span-2 md:row-span-1"
                        icon={<BarChart3 className="w-10 h-10 text-primary" />}
                        title="Leaderboards That Mean Something"
                        description="Separate team and player performance clearly. No confusing stats. Transparent performance tracking for everyone."
                        delay={0.5}
                    >
                        <div className="absolute right-4 top-4 opacity-10">
                            <BarChart3 className="w-32 h-32 text-primary" />
                        </div>
                    </FeatureCard>

                    {/* Feature 6: One App */}
                    <FeatureCard
                        className="md:col-span-1 md:row-span-1"
                        icon={<Smartphone className="w-10 h-10 text-primary" />}
                        title="One App. Complete Visibility."
                        description="Players, organizers, and staff all rely on a single source of truth. WhatsApp integration included."
                        delay={0.6}
                    />
                </div>
            </div>
        </section>
    );
};

// --- Reusable Feature Card Component ---

interface FeatureCardProps {
    title: string;
    description: string;
    icon: React.ReactNode;
    className?: string;
    children?: React.ReactNode;
    delay?: number;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ title, description, icon, className, children, delay = 0 }) => {
    const ref = useRef(null);
    const isInView = useInView(ref, { once: true, margin: "-50px" });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={isInView ? { opacity: 1, scale: 1, y: 0 } : {}}
            transition={{ duration: 0.5, delay: delay, ease: "easeOut" }}
            whileHover={{ y: -5, boxShadow: "0 20px 40px -15px rgba(0,0,0,0.5)" }}
            className={`
                group relative p-5 md:p-8 rounded-2xl md:rounded-3xl border border-white/10 bg-gray-900/40 backdrop-blur-sm
                hover:border-primary/30 hover:bg-gray-800/60 transition-colors duration-500 overflow-hidden
                flex flex-col justify-between
                ${className}
            `}
        >
            {/* Hover Gradient Overlay */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 pointer-events-none" />

            <div className="relative z-10">
                <div className="mb-4 md:mb-6 p-2 md:p-3 bg-white/5 w-fit rounded-xl md:rounded-2xl border border-white/5 group-hover:scale-110 transition-transform duration-500">
                    {icon}
                </div>

                <h3 className="text-xl md:text-2xl font-oswald font-semibold text-white mb-2 md:mb-3 group-hover:text-primary transition-colors duration-300">
                    {title}
                </h3>

                <p className="text-gray-400 text-sm md:text-base leading-relaxed font-montserrat">
                    {description}
                </p>

                {children}
            </div>

            {/* Decorative Icon Watermark */}
            <div className="absolute -bottom-4 -right-4 text-white/5 transform rotate-12 scale-150 group-hover:scale-[1.75] group-hover:rotate-6 transition-all duration-700 pointer-events-none">
                {icon}
            </div>
        </motion.div>
    );
};

export default FeaturesSection;
