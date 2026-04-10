import React, { useState, useEffect, useRef } from 'react';
import { MapPin, Calendar, Search, ChevronDown, Dribbble, X } from 'lucide-react';
import { motion, AnimatePresence, Variants } from 'framer-motion';

export interface FilterState {
    sport: string;
    city: string;
}

interface PlayerFilterMenuProps {
    filters: FilterState;
    onFilterChange: (filters: FilterState) => void;
}

const CITIES = ['All', 'Bangalore', 'Mumbai', 'Delhi', 'Chennai', 'Pune', 'Hyderabad', 'Kolkata'];
const SPORTS = ['All', 'badminton', 'bowling', 'cricket', 'football', 'basketball', 'tennis', 'volleyball'];

export const PlayerFilterMenu = ({ filters, onFilterChange }: PlayerFilterMenuProps) => {
    // Local state for the dropdowns
    const [localFilters, setLocalFilters] = useState<FilterState>(filters);
    const [activeDropdown, setActiveDropdown] = useState<'city' | 'sport' | null>(null);

    // Mobile modal state
    const [isMobileModalOpen, setIsMobileModalOpen] = useState(false);

    const menuRef = useRef<HTMLDivElement>(null);

    // Close dropdowns if clicked outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
                setActiveDropdown(null);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Sync if parent updates
    useEffect(() => {
        setLocalFilters(filters);
    }, [filters]);

    const handleApply = () => {
        onFilterChange(localFilters);
        setActiveDropdown(null);
        setIsMobileModalOpen(false);
    };

    const dropdownVariants: Variants = {
        hidden: { opacity: 0, y: 10, scale: 0.95 },
        visible: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 24 } },
        exit: { opacity: 0, y: 10, scale: 0.95, transition: { duration: 0.2 } }
    };

    const modalVariants: Variants = {
        hidden: { opacity: 0, y: '100%' },
        visible: { opacity: 1, y: 0, transition: { type: 'spring', stiffness: 300, damping: 30 } },
        exit: { opacity: 0, y: '100%', transition: { duration: 0.3 } }
    };

    return (
        <div className="w-full max-w-7xl px-4 sm:px-8 mt-6 sm:mt-16" ref={menuRef}>
            {/* ── Desktop: Airbnb-style horizontal pill ───────────────────── */}
            <div className="hidden sm:flex relative w-full max-w-4xl mx-auto bg-[#e5e5e5] rounded-full p-2 items-center shadow-2xl text-black">
                
                {/* Location */}
                <div 
                    className={`relative flex-1 flex items-center gap-3 pl-6 pr-4 cursor-pointer rounded-l-full py-2 transition-all ${activeDropdown === 'city' ? 'bg-white shadow-md' : 'hover:bg-black/5'}`}
                    onClick={() => setActiveDropdown(activeDropdown === 'city' ? null : 'city')}
                >
                    <MapPin className="h-5 w-5 text-black flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold leading-tight">Where</span>
                        <div className="flex items-center gap-1 text-xs text-black/60 font-medium">
                            <span className="truncate">{localFilters.city}</span>
                            <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${activeDropdown === 'city' ? 'rotate-180' : ''}`} />
                        </div>
                    </div>

                    {/* City Dropdown */}
                    <AnimatePresence>
                        {activeDropdown === 'city' && (
                            <motion.div
                                variants={dropdownVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="absolute top-[120%] left-0 w-[300px] bg-white rounded-3xl p-6 shadow-2xl z-50 border border-black/5"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h4 className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-4">Select City</h4>
                                <div className="grid grid-cols-2 gap-2">
                                    {CITIES.map(city => (
                                        <button
                                            key={city}
                                            onClick={() => { setLocalFilters(prev => ({ ...prev, city })); setActiveDropdown(null); }}
                                            className={`px-4 py-3 rounded-xl text-left text-sm font-semibold transition-all ${localFilters.city === city ? 'bg-primary text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-black'}`}
                                        >
                                            {city}
                                        </button>
                                    ))}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="w-px h-10 bg-black/20 flex-shrink-0" />

                {/* Sport */}
                <div 
                    className={`relative flex-[1.2] flex items-center gap-3 px-5 cursor-pointer py-2 transition-all rounded-full ${activeDropdown === 'sport' ? 'bg-white shadow-md' : 'hover:bg-black/5'}`}
                    onClick={() => setActiveDropdown(activeDropdown === 'sport' ? null : 'sport')}
                >
                    <Dribbble className="h-5 w-5 text-black flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold leading-tight">Sport</span>
                        <div className="flex items-center gap-1 text-xs text-black/60 font-medium">
                            <span className="truncate capitalize">{localFilters.sport}</span>
                            <ChevronDown className={`h-3 w-3 flex-shrink-0 transition-transform ${activeDropdown === 'sport' ? 'rotate-180' : ''}`} />
                        </div>
                    </div>

                    {/* Sport Dropdown */}
                    <AnimatePresence>
                        {activeDropdown === 'sport' && (
                            <motion.div
                                variants={dropdownVariants}
                                initial="hidden"
                                animate="visible"
                                exit="exit"
                                className="absolute top-[120%] left-0 w-[350px] bg-white rounded-3xl p-6 shadow-2xl z-50 border border-black/5 flex flex-wrap gap-2"
                                onClick={(e) => e.stopPropagation()}
                            >
                                <h4 className="w-full text-xs font-bold uppercase tracking-widest text-gray-400 mb-2">Select Sport</h4>
                                {SPORTS.map(sport => (
                                    <button
                                        key={sport}
                                        onClick={() => { setLocalFilters(prev => ({ ...prev, sport })); setActiveDropdown(null); }}
                                        className={`px-4 py-2.5 rounded-full text-sm font-semibold capitalize transition-all ${localFilters.sport === sport ? 'bg-primary text-white shadow-md' : 'bg-gray-100 hover:bg-gray-200 text-black border border-gray-200'}`}
                                    >
                                        {sport}
                                    </button>
                                ))}
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div className="w-px h-10 bg-black/20 flex-shrink-0" />

                {/* Date (Static for now as API doesn't filter perfectly by just 'date', requires date ranges) */}
                <div className="flex-1 flex items-center gap-3 px-5 py-2 opacity-50 cursor-not-allowed">
                    <Calendar className="h-5 w-5 text-black flex-shrink-0" />
                    <div className="flex flex-col min-w-0">
                        <span className="text-sm font-bold leading-tight">Date</span>
                        <span className="text-xs text-black/60 font-medium truncate">Any time</span>
                    </div>
                </div>

                {/* Search */}
                <button 
                    onClick={handleApply}
                    className="bg-primary hover:bg-primary/90 text-white p-4 mx-1.5 rounded-full flex items-center justify-center transition-transform hover:scale-105 shadow-md shadow-primary/30 flex-shrink-0 active:scale-95"
                >
                    <Search className="h-5 w-5" />
                </button>
            </div>


            {/* ── Mobile: Floating Action Bar that opens Full Modal ─────────────────── */}
            <div className="sm:hidden w-full backdrop-blur-md bg-white/5 border border-white/10 rounded-2xl p-2 flex items-center justify-between shadow-xl">
                <button 
                    onClick={() => setIsMobileModalOpen(true)}
                    className="flex-1 flex items-center bg-white/10 rounded-xl px-4 py-3 gap-3 active:bg-white/15 transition-all text-left"
                >
                    <Search className="h-4 w-4 text-primary" />
                    <div className="flex flex-col">
                        <span className="text-white text-sm font-semibold leading-tight">Find Tournaments</span>
                        <span className="text-gray-400 text-[11px] truncate">{localFilters.city} • <span className="capitalize">{localFilters.sport}</span></span>
                    </div>
                </button>
            </div>

            {/* Mobile Filter Modal */}
            <AnimatePresence>
                {isMobileModalOpen && (
                    <div className="fixed inset-0 z-[100] sm:hidden flex flex-col justify-end">
                        {/* Backdrop */}
                        <motion.div 
                            initial={{ opacity: 0 }} 
                            animate={{ opacity: 1 }} 
                            exit={{ opacity: 0 }} 
                            onClick={() => setIsMobileModalOpen(false)}
                            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        />
                        
                        {/* Sheet */}
                        <motion.div 
                            variants={modalVariants}
                            initial="hidden"
                            animate="visible"
                            exit="exit"
                            className="relative w-full bg-[#111] rounded-t-[2.5rem] p-6 pb-10 border-t border-white/10 flex flex-col max-h-[90vh] overflow-y-auto"
                        >
                            {/* Handle */}
                            <div className="w-12 h-1.5 bg-white/20 rounded-full mx-auto mb-6" />
                            
                            <div className="flex items-center justify-between mb-8">
                                <h2 className="text-2xl font-oswald font-bold text-white tracking-wide">Filters</h2>
                                <button onClick={() => setIsMobileModalOpen(false)} className="h-9 w-9 rounded-full bg-white/10 flex items-center justify-center text-white active:scale-95">
                                    <X className="h-4 w-4" />
                                </button>
                            </div>

                            <div className="flex flex-col gap-8">
                                {/* City */}
                                <div>
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <MapPin className="h-4 w-4" /> Where
                                    </h3>
                                    <div className="flex flex-wrap gap-2.5">
                                        {CITIES.map(city => (
                                            <button
                                                key={city}
                                                onClick={() => setLocalFilters(prev => ({ ...prev, city }))}
                                                className={`px-5 py-2.5 rounded-full text-sm font-semibold transition-all shadow-sm ${localFilters.city === city ? 'bg-primary text-white border-primary shadow-primary/20' : 'bg-transparent text-gray-300 border border-white/15'}`}
                                            >
                                                {city}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Sport */}
                                <div>
                                    <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                        <Dribbble className="h-4 w-4" /> Sport
                                    </h3>
                                    <div className="flex flex-wrap gap-2.5">
                                        {SPORTS.map(sport => (
                                            <button
                                                key={sport}
                                                onClick={() => setLocalFilters(prev => ({ ...prev, sport }))}
                                                className={`px-5 py-2.5 rounded-full text-sm font-semibold capitalize transition-all shadow-sm ${localFilters.sport === sport ? 'bg-primary text-white border-primary shadow-primary/20' : 'bg-transparent text-gray-300 border border-white/15'}`}
                                            >
                                                {sport}
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Sticky Footer Apply Button */}
                            <div className="mt-10 mb-4">
                                <button 
                                    onClick={handleApply}
                                    className="w-full flex items-center justify-center gap-2 bg-primary text-white font-oswald font-bold tracking-wider py-4 rounded-xl text-lg shadow-lg shadow-primary/30 active:scale-[0.98] transition-all"
                                >
                                    <Search className="h-5 w-5" />
                                    SHOW RESULTS
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>

        </div>
    );
};
