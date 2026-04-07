'use client';
import React from 'react';
import { Button, buttonVariants } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { MenuToggleIcon } from '@/components/ui/menu-toggle-icon';
import { useScroll } from '@/components/ui/use-scroll';
import logo from '@/assets/logo.png';
import { useNavigate } from 'react-router-dom';

export function Header() {
    const [open, setOpen] = React.useState(false);
    const scrolled = useScroll(10);
    const navigate = useNavigate();

    const links = [
        {
            label: 'Features',
            href: '#features',
        },
        {
            label: 'About',
            href: '#about',
        },
        {
            label: 'Explore',
            href: '#explore',
        },
    ];

    React.useEffect(() => {
        if (open) {
            // Disable scroll
            document.body.style.overflow = 'hidden';
        } else {
            // Re-enable scroll
            document.body.style.overflow = '';
        }

        // Cleanup when component unmounts (important for Next.js/React)
        return () => {
            document.body.style.overflow = '';
        };
    }, [open]);

    return (
        <header
            className={cn(
                'fixed top-0 left-0 right-0 z-50 transition-all duration-300 ease-in-out font-montserrat',
                {
                    'h-24 bg-transparent flex justify-center': !scrolled && !open,
                    'h-auto top-4 flex justify-center': scrolled && !open,
                    'h-screen bg-black flex flex-col': open,
                }
            )}
        >
            {/* Top bar — always visible */}
            <nav
                className={cn(
                    'flex items-center justify-between px-6 transition-all duration-300 w-full shrink-0',
                    {
                        'max-w-7xl h-24': !scrolled && !open,
                        'max-w-4xl bg-black/50 backdrop-blur-md rounded-full h-16 shadow-lg shadow-black/20 mt-2': scrolled && !open,
                        'h-16': open,
                    },
                )}
            >
                <a href="/" className="flex items-center gap-2">
                    <img src={logo} alt="Kria Sports Logo" className="h-8 w-auto" />
                </a>

                <div className={cn("hidden md:flex items-center gap-6", { "gap-2": scrolled })}>
                    {links.map((link, i) => (
                        <a
                            key={i}
                            className={cn(
                                buttonVariants({ variant: 'ghost' }),
                                "text-sm font-medium hover:text-primary transition-colors text-white/80 hover:bg-transparent",
                                scrolled ? "text-xs px-3 py-1" : ""
                            )}
                            href={link.href}
                        >
                            {link.label}
                        </a>
                    ))}
                    <Button variant="outline" className="border-primary text-primary hover:bg-primary hover:text-white bg-transparent" onClick={() => navigate('/login')}>
                        Sign In
                    </Button>
                    <Button className="bg-primary hover:bg-primary/90 text-white shadow-lg shadow-primary/20" onClick={() => navigate('/register')}>
                        Get Started
                    </Button>
                </div>

                <div className="md:hidden">
                    <Button size="icon" variant="ghost" onClick={() => setOpen(!open)} className="text-white hover:bg-white/10">
                        <MenuToggleIcon open={open} className="size-6" duration={300} />
                    </Button>
                </div>
            </nav>

            {/* Mobile Menu — fills remaining screen height */}
            {open && (
                <div className="flex flex-col items-center justify-center flex-1 space-y-8 w-full md:hidden">
                    {links.map((link) => (
                        <a
                            key={link.label}
                            className="text-2xl font-oswald text-white hover:text-primary transition-colors min-h-[44px] flex items-center"
                            href={link.href}
                            onClick={() => setOpen(false)}
                        >
                            {link.label}
                        </a>
                    ))}
                    <div className="flex flex-col gap-4 w-full max-w-xs pt-4">
                        <Button variant="outline" className="w-full border-primary text-primary hover:bg-primary hover:text-white bg-transparent h-12 text-lg" onClick={() => { setOpen(false); navigate('/login'); }}>
                            Sign In
                        </Button>
                        <Button className="w-full bg-primary text-white hover:bg-primary/90 h-12 text-lg shadow-lg shadow-primary/20" onClick={() => { setOpen(false); navigate('/register'); }}>
                            Get Started
                        </Button>
                    </div>
                </div>
            )}
        </header>
    );
}

export const WordmarkIcon = (props: React.ComponentProps<"svg">) => (
    <svg viewBox="0 0 84 24" fill="currentColor" {...props}>
        {/* Placeholder SVG content kept for compatibility if needed, but not used in main return */}
        <path d="M45.035 23.984c-1.34-..." />
    </svg>
);
