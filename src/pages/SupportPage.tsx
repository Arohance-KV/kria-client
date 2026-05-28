import React, { useState } from 'react';
import Navbar from '@/components/Navbar';
import HoverFooter from '@/components/HoverFooter';
import SmoothScroll from '@/components/SmoothScroll';
import {
    Search,
    HelpCircle,
    BookOpen,
    Zap,
    Shield,
    Trophy,
    Users,
    ChevronDown,
    ChevronUp,
    ExternalLink,
    MessageSquare,
} from 'lucide-react';

// ─────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────
interface FaqItem {
    question: string;
    answer: string;
}

interface FaqCategory {
    icon: React.ReactNode;
    title: string;
    color: string;
    faqs: FaqItem[];
}

// ─────────────────────────────────────────────
// Data
// ─────────────────────────────────────────────
const faqCategories: FaqCategory[] = [
    {
        icon: <Trophy size={20} />,
        title: 'Tournaments',
        color: 'text-yellow-400',
        faqs: [
            {
                question: 'How do I create a tournament on Kria Sports?',
                answer:
                    'Sign in as an Organizer, navigate to your dashboard and click "Create Tournament". Fill in the tournament name, sport (Badminton is active; other sports are coming soon), dates, and venue. Then add teams, categories, and open player registration.',
            },
            {
                question: 'Can I have multiple categories within one tournament?',
                answer:
                    'Yes! Each tournament supports multiple categories (e.g. Under 21 – Women Doubles, Men Singles). Each category is fully independent with its own match format, points system, bracket logic, and leaderboard.',
            },
            {
                question: 'What bracket formats are supported?',
                answer:
                    'Kria Sports supports League, Knockout, and hybrid League → Top N → Knockout brackets. Organisers can choose per category and assign or randomise teams.',
            },
            {
                question: 'Can I edit a tournament after it has started?',
                answer:
                    'Organisers and staff can reassign players, adjust teams, and update scores even after the tournament begins. All changes are logged for transparency and dispute resolution.',
            },
        ],
    },
    {
        icon: <Zap size={20} />,
        title: 'Auctions',
        color: 'text-primary',
        faqs: [
            {
                question: 'What auction modes does Kria Sports support?',
                answer:
                    'We support two modes: (1) Manual-Assisted Auction — staff operate the app at a physical venue, entering final bid amounts after verbal bidding. (2) In-App Live Auction — teams bid directly inside the app with real-time countdown timers.',
            },
            {
                question: 'How does the Manual-Assisted Auction work?',
                answer:
                    'The auction starts, a player card appears, offline verbal bidding happens, your staff selects the winning team and enters the final bid amount. The player is immediately assigned, the team budget auto-deducted, and the auction log updated.',
            },
            {
                question: 'Can I undo an auction assignment?',
                answer:
                    'Yes. Admin users can undo the last auction action. All actions are stored with player ID, team ID, price, timestamp, and auction type for full auditability.',
            },
            {
                question: 'How are team budgets tracked during the auction?',
                answer:
                    "Every bid deducts from the team's budget in real-time. The auction leaderboard shows each team's remaining budget, players bought, and total spent — visible to all viewers.",
            },
        ],
    },
    {
        icon: <Users size={20} />,
        title: 'Players and Registration',
        color: 'text-green-400',
        faqs: [
            {
                question: 'How do I register as a player?',
                answer:
                    "Create an account, choose your tournament and category, submit your profile and wait for organiser approval. You'll receive a notification once approved or auctioned into a team.",
            },
            {
                question: 'What happens after I am auctioned to a team?',
                answer:
                    'You will receive a notification with your team name, teammates, assigned category, WhatsApp group link, and upcoming match schedule — all within the app.',
            },
            {
                question: 'Can an organiser add players manually?',
                answer:
                    'Yes. Organisers and staff can add players manually, approve/reject registrations, and reassign players between teams even after the auction has concluded.',
            },
        ],
    },
    {
        icon: <BookOpen size={20} />,
        title: 'Scoring and Leaderboards',
        color: 'text-blue-400',
        faqs: [
            {
                question: 'Who can update match scores?',
                answer:
                    'Only staff members can update scores. Once a game is confirmed and locked, no public edits are allowed, ensuring accuracy and preventing disputes.',
            },
            {
                question: 'What leaderboard views are available?',
                answer:
                    'There are four distinct views: (1) Team Leaderboard per Category, (2) Team Rankings overall tournament, (3) Player Leaderboard per Category, and (4) Player Rankings overall.',
            },
            {
                question: 'Are scoring rules flexible per category?',
                answer:
                    'Absolutely. Each category overrides global sport config — organisers can set points per game (e.g. 15, 21, 25), best-of format, and bracket type independently.',
            },
        ],
    },
    {
        icon: <Shield size={20} />,
        title: 'Account and Security',
        color: 'text-purple-400',
        faqs: [
            {
                question: 'What roles exist on Kria Sports?',
                answer:
                    "There are three roles: Player (registers and tracks stats), Organiser/Staff (creates tournaments, manages auctions and scoring), and Admin (system-level controls including undo actions and config locking).",
            },
            {
                question: 'Is my data secure?',
                answer:
                    'Yes. All authentication uses JWT tokens, API communication is encrypted, and all audit logs are immutable. Data is stored securely on our servers hosted in India.',
            },
            {
                question: 'How do I reset my password?',
                answer:
                    'Click "Forgot Password" on the login page, enter your registered email, and follow the reset link sent to your inbox.',
            },
        ],
    },
];

// ─────────────────────────────────────────────
// Sub-components
// ─────────────────────────────────────────────
const FaqAccordionItem: React.FC<{ faq: FaqItem; isOpen: boolean; onToggle: () => void }> = ({
    faq,
    isOpen,
    onToggle,
}) => (
    <div
        className={`border rounded-xl overflow-hidden transition-all duration-300 ${
            isOpen ? 'border-primary/40 bg-primary/5' : 'border-white/10 bg-white/[0.02]'
        }`}
    >
        <button
            onClick={onToggle}
            className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left"
            aria-expanded={isOpen}
        >
            <span className="text-white font-medium text-sm leading-relaxed">{faq.question}</span>
            <span className="text-primary shrink-0">
                {isOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
            </span>
        </button>
        <div
            className={`transition-all duration-300 overflow-hidden ${
                isOpen ? 'max-h-96 opacity-100' : 'max-h-0 opacity-0'
            }`}
        >
            <p className="px-6 pb-5 text-gray-400 text-sm leading-relaxed">{faq.answer}</p>
        </div>
    </div>
);

// ─────────────────────────────────────────────
// Page
// ─────────────────────────────────────────────
const SupportPage: React.FC = () => {
    const [searchQuery, setSearchQuery] = useState('');
    const [activeCategory, setActiveCategory] = useState<string>('All');
    const [openFaq, setOpenFaq] = useState<string | null>(null);

    // Build flat list for searching
    const allFaqs = faqCategories.flatMap((cat) =>
        cat.faqs.map((faq) => ({ ...faq, category: cat.title }))
    );

    const filteredCategories =
        activeCategory === 'All'
            ? faqCategories
            : faqCategories.filter((c) => c.title === activeCategory);

    const displayFaqs = searchQuery.trim()
        ? allFaqs.filter(
              (f) =>
                  f.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
                  f.answer.toLowerCase().includes(searchQuery.toLowerCase())
          )
        : null;

    const quickLinks = [
        { label: 'Getting Started Guide', icon: <BookOpen size={16} />, href: '/contact' },
        { label: 'Video Tutorials', icon: <ExternalLink size={16} />, href: '#' },
        { label: 'Contact Support Team', icon: <MessageSquare size={16} />, href: '/contact' },
    ];

    return (
        <SmoothScroll>
            <div className="relative min-h-screen bg-black text-white font-montserrat overflow-x-hidden">
                <Navbar />

                {/* ── Hero Banner ── */}
                <section className="relative pt-32 pb-20 overflow-hidden">
                    <div className="absolute inset-0 pointer-events-none">
                        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[450px] bg-primary/10 rounded-full blur-3xl" />
                        <div className="absolute top-20 left-0 w-72 h-72 bg-primary/5 rounded-full blur-2xl" />
                    </div>

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
                            Help Center
                        </span>
                        <h1 className="font-oswald text-5xl md:text-7xl font-bold uppercase tracking-tight mb-6">
                            How Can We{' '}
                            <span className="text-transparent bg-clip-text bg-gradient-to-r from-primary to-orange-300">
                                Help?
                            </span>
                        </h1>
                        <p className="text-gray-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed mb-10">
                            Browse our frequently asked questions or reach out directly — we're here
                            to make sure your tournament runs flawlessly.
                        </p>

                        {/* Search bar */}
                        <div className="relative max-w-xl mx-auto">
                            <Search
                                size={20}
                                className="absolute left-5 top-1/2 -translate-y-1/2 text-gray-500"
                            />
                            <input
                                type="text"
                                placeholder="Search for answers…"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-14 pr-6 py-4 text-white placeholder-gray-600 focus:outline-none focus:border-primary/60 transition-all duration-200 text-sm"
                            />
                        </div>
                    </div>
                </section>

                {/* ── Quick Links ── */}
                <section className="max-w-7xl mx-auto px-6 pb-12">
                    <div className="flex flex-wrap justify-center gap-4">
                        {quickLinks.map((link, i) => (
                            <a
                                key={i}
                                href={link.href}
                                className="flex items-center gap-2 bg-white/[0.04] border border-white/10 hover:border-primary/40 hover:bg-primary/5 text-gray-300 hover:text-primary text-sm font-medium px-5 py-3 rounded-xl transition-all duration-200"
                            >
                                {link.icon}
                                {link.label}
                            </a>
                        ))}
                    </div>
                </section>

                {/* ── Main FAQ Section ── */}
                <section className="max-w-7xl mx-auto px-6 pb-24">
                    {searchQuery.trim() ? (
                        /* ── Search Results ── */
                        <div className="max-w-3xl mx-auto">
                            <p className="text-gray-500 text-sm mb-6">
                                {displayFaqs!.length} result{displayFaqs!.length !== 1 ? 's' : ''} for{' '}
                                <span className="text-primary font-semibold">"{searchQuery}"</span>
                            </p>
                            {displayFaqs!.length === 0 ? (
                                <div className="text-center py-16">
                                    <HelpCircle size={48} className="text-gray-700 mx-auto mb-4" />
                                    <p className="text-gray-400 text-lg">No results found</p>
                                    <p className="text-gray-600 text-sm mt-2">
                                        Try different keywords or{' '}
                                        <a href="/contact" className="text-primary hover:underline">
                                            contact our team
                                        </a>
                                        .
                                    </p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    {displayFaqs!.map((faq, i) => {
                                        const key = `search-${i}`;
                                        return (
                                            <div key={key}>
                                                <p className="text-xs text-primary font-semibold uppercase tracking-widest mb-1 px-2">
                                                    {faq.category}
                                                </p>
                                                <FaqAccordionItem
                                                    faq={faq}
                                                    isOpen={openFaq === key}
                                                    onToggle={() =>
                                                        setOpenFaq(openFaq === key ? null : key)
                                                    }
                                                />
                                            </div>
                                        );
                                    })}
                                </div>
                            )}
                        </div>
                    ) : (
                        /* ── Category View ── */
                        <div className="flex flex-col lg:flex-row gap-10">
                            {/* Sidebar category filter */}
                            <aside className="lg:w-64 shrink-0">
                                <div className="sticky top-28 space-y-2">
                                    <p className="text-xs text-gray-500 font-semibold uppercase tracking-widest mb-4">
                                        Categories
                                    </p>
                                    <button
                                        onClick={() => setActiveCategory('All')}
                                        className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${
                                            activeCategory === 'All'
                                                ? 'bg-primary text-white font-semibold shadow-lg shadow-primary/20'
                                                : 'text-gray-400 hover:text-white hover:bg-white/5'
                                        }`}
                                    >
                                        <HelpCircle size={16} />
                                        All Topics
                                    </button>
                                    {faqCategories.map((cat) => (
                                        <button
                                            key={cat.title}
                                            onClick={() => setActiveCategory(cat.title)}
                                            className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl text-sm transition-all duration-200 ${
                                                activeCategory === cat.title
                                                    ? 'bg-primary text-white font-semibold shadow-lg shadow-primary/20'
                                                    : 'text-gray-400 hover:text-white hover:bg-white/5'
                                            }`}
                                        >
                                            <span className={activeCategory === cat.title ? 'text-white' : cat.color}>
                                                {cat.icon}
                                            </span>
                                            {cat.title}
                                        </button>
                                    ))}
                                </div>
                            </aside>

                            {/* FAQ List */}
                            <div className="flex-1 space-y-12">
                                {filteredCategories.map((cat) => (
                                    <div key={cat.title}>
                                        <div className="flex items-center gap-3 mb-5">
                                            <span className={cat.color}>{cat.icon}</span>
                                            <h2 className="font-oswald text-2xl font-bold uppercase tracking-wide text-white">
                                                {cat.title}
                                            </h2>
                                        </div>
                                        <div className="space-y-3">
                                            {cat.faqs.map((faq, fi) => {
                                                const key = `${cat.title}-${fi}`;
                                                return (
                                                    <FaqAccordionItem
                                                        key={key}
                                                        faq={faq}
                                                        isOpen={openFaq === key}
                                                        onToggle={() =>
                                                            setOpenFaq(openFaq === key ? null : key)
                                                        }
                                                    />
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </section>

                {/* ── Still Need Help CTA ── */}
                <section className="max-w-7xl mx-auto px-6 pb-24">
                    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/20 p-12 text-center">
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute -top-10 -right-10 w-48 h-48 bg-primary/20 rounded-full blur-3xl" />
                            <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-primary/10 rounded-full blur-3xl" />
                        </div>
                        <div className="relative">
                            <MessageSquare size={40} className="text-primary mx-auto mb-4" />
                            <h2 className="font-oswald text-3xl md:text-4xl font-bold uppercase tracking-wide text-white mb-4">
                                Still Have Questions?
                            </h2>
                            <p className="text-gray-400 text-base max-w-xl mx-auto mb-8 leading-relaxed">
                                Our team is happy to walk you through the platform, answer specific questions, or set up a demo for your club or organisation.
                            </p>
                            <a
                                href="/contact"
                                className="inline-flex items-center gap-3 bg-primary hover:bg-primary/90 text-white font-semibold px-10 py-4 rounded-xl transition-all duration-200 hover:shadow-xl hover:shadow-primary/30 hover:-translate-y-0.5"
                            >
                                <MessageSquare size={18} />
                                Contact Us
                            </a>
                        </div>
                    </div>
                </section>

                <HoverFooter />
            </div>
        </SmoothScroll>
    );
};

export default SupportPage;
