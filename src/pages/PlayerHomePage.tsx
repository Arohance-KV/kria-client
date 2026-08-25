import React, { useState } from 'react';
import HoverFooter from '@/components/HoverFooter';
import { PlayerNavigation } from '@/components/PlayerNavigation';
import { PlayerFilterMenu, FilterState } from '@/components/PlayerFilterMenu';
import { FeaturedTournaments } from '@/components/FeaturedTournaments';
import SmoothScroll from '@/components/SmoothScroll';

const PlayerHomePage = () => {
    const [filters, setFilters] = useState<FilterState>({ sport: 'All', city: 'All' });

    return (
        <SmoothScroll>
            <div
                className="min-h-screen text-white font-montserrat flex flex-col items-center"
                style={{
                    background: 'linear-gradient(135deg, #1a1613 0%, #121110 40%, #0a0a0a 100%)',
                }}
            >
                <PlayerNavigation />
                <PlayerFilterMenu filters={filters} onFilterChange={setFilters} />
                <FeaturedTournaments filters={filters} />
                <HoverFooter />
            </div>
        </SmoothScroll>
    );
};

export default PlayerHomePage;
