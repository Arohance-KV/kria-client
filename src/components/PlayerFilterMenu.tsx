import React from 'react';
import { MapPin, Calendar, Search, ChevronDown, Dribbble } from 'lucide-react';

export const PlayerFilterMenu = () => {
    return (
        <div className="w-full max-w-7xl px-4 sm:px-8 mt-6 sm:mt-16">
            {/* ── Desktop: Airbnb-style horizontal pill ───────────────────── */}
            <div className="hidden sm:flex w-full max-w-4xl mx-auto bg-[#e5e5e5] rounded-full p-2 items-center shadow-2xl text-black">
                {/* Location */}
                <div className="flex-1 flex items-center gap-3 pl-6 pr-4 cursor-pointer hover:bg-black/5 rounded-l-full py-2 transition-colors">
                    <MapPin className="h-5 w-5 text-black flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold leading-tight">Where</span>
                        <div className="flex items-center gap-1 text-xs text-black/60 font-medium">
                            <span className="truncate">Bangalore</span>
                            <ChevronDown className="h-3 w-3 flex-shrink-0" />
                        </div>
                    </div>
                </div>

                <div className="w-px h-10 bg-black/20 flex-shrink-0" />

                {/* Sport */}
                <div className="flex-[1.2] flex items-center gap-3 px-5 cursor-pointer hover:bg-black/5 py-2 transition-colors">
                    <Dribbble className="h-5 w-5 text-black flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold leading-tight">Select Sport</span>
                        <div className="flex items-center gap-1 text-xs text-black/60 font-medium">
                            <span className="truncate">e.g. Cricket</span>
                            <ChevronDown className="h-3 w-3 flex-shrink-0" />
                        </div>
                    </div>
                </div>

                <div className="w-px h-10 bg-black/20 flex-shrink-0" />

                {/* Date */}
                <div className="flex-1 flex items-center gap-3 px-5 cursor-pointer hover:bg-black/5 py-2 transition-colors">
                    <Calendar className="h-5 w-5 text-black flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold leading-tight">Date</span>
                        <span className="text-xs text-black/60 font-medium truncate">Any date</span>
                    </div>
                </div>

                {/* Search */}
                <button className="bg-primary hover:bg-primary/90 text-white p-4 mx-1.5 rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-md shadow-primary/30 flex-shrink-0">
                    <Search className="h-5 w-5" />
                </button>
            </div>

            {/* ── Mobile: Dark glassmorphism stacked card ─────────────────── */}
            <div className="sm:hidden w-full rounded-2xl bg-white/[0.04] border border-white/8 overflow-hidden backdrop-blur-sm">
                {/* Location */}
                <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 active:bg-white/8 transition-colors text-left border-b border-white/6">
                    <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <MapPin className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Where</p>
                        <p className="text-white text-sm font-semibold mt-0.5">Bangalore</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-600 flex-shrink-0" />
                </button>

                {/* Sport */}
                <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 active:bg-white/8 transition-colors text-left border-b border-white/6">
                    <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Dribbble className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Sport</p>
                        <p className="text-gray-400 text-sm font-medium mt-0.5">Select a sport</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-600 flex-shrink-0" />
                </button>

                {/* Date */}
                <button className="w-full flex items-center gap-4 px-5 py-4 hover:bg-white/5 active:bg-white/8 transition-colors text-left border-b border-white/6">
                    <div className="h-9 w-9 rounded-xl bg-primary/15 flex items-center justify-center flex-shrink-0">
                        <Calendar className="h-4 w-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                        <p className="text-[10px] uppercase tracking-widest text-gray-500 font-bold">Date</p>
                        <p className="text-gray-400 text-sm font-medium mt-0.5">Any date</p>
                    </div>
                    <ChevronDown className="h-4 w-4 text-gray-600 flex-shrink-0" />
                </button>

                {/* Search CTA */}
                <div className="px-4 py-3 bg-white/[0.02]">
                    <button className="w-full flex items-center justify-center gap-2.5 bg-primary hover:bg-primary/90 active:scale-[0.98] text-white font-oswald font-bold tracking-wider text-sm py-3.5 rounded-xl transition-all shadow-lg shadow-primary/20">
                        <Search className="h-4 w-4" />
                        SEARCH TOURNAMENTS
                    </button>
                </div>
            </div>
        </div>
    );
};
