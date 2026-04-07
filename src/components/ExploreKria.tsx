import React from 'react';
import { Iphone } from './ui/iphone';
import appmock1 from '../assets/appmock/appmock1.png';
import appmock2 from '../assets/appmock/appmock2.png';
import { Download, Smartphone, Play } from 'lucide-react';

const ExploreKria: React.FC = () => {
    return (
        <section id="explore" className="relative w-full min-h-screen bg-black flex flex-col items-center justify-center py-20 md:py-32 overflow-hidden">
            <div className="container mx-auto max-w-7xl px-4 mb-16 flex justify-start w-full">
                <h2 className="text-[clamp(2rem,8vw,4.5rem)] font-bold font-oswald text-white uppercase tracking-tight text-left">
                    Explore <span className="text-primary">Kria</span>
                </h2>
            </div>

            {/* Mockups Grid — 2 on mobile, 4 on desktop */}
            <div className="container mx-auto max-w-7xl px-4 grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-8 items-center justify-center mb-16 md:mb-32">
                {/* Iphone Mockup 1 */}
                <div className="flex justify-center lg:translate-y-24 transition-transform duration-500 hover:scale-105">
                    <Iphone src={appmock1} className="w-full max-w-[140px] sm:max-w-[180px] md:max-w-[220px] shadow-2xl" />
                </div>

                {/* Iphone Mockup 2 */}
                <div className="flex justify-center lg:-translate-y-5 transition-transform duration-500 hover:scale-105">
                    <Iphone src={appmock2} className="w-full max-w-[140px] sm:max-w-[180px] md:max-w-[220px] shadow-2xl" />
                </div>

                {/* Iphone Mockup 3 — hidden on mobile */}
                <div className="hidden lg:flex justify-center lg:translate-y-24 transition-transform duration-500 hover:scale-105">
                    <Iphone src={appmock1} className="w-full max-w-[220px] shadow-2xl" />
                </div>

                {/* Iphone Mockup 4 — hidden on mobile */}
                <div className="hidden lg:flex justify-center lg:-translate-y-5 transition-transform duration-500 hover:scale-105">
                    <Iphone src={appmock2} className="w-full max-w-[220px] shadow-2xl" />
                </div>
            </div>

            {/* App Info & Download */}
            <div className="container mx-auto max-w-7xl px-4 flex flex-col items-center text-center space-y-8 z-10 relative">
                <div className="max-w-2xl space-y-4">
                    <h2 className="text-3xl md:text-4xl font-oswald text-white uppercase">
                        The Ultimate Sports Experience
                    </h2>
                    <p className="text-gray-400 text-lg md:text-xl font-montserrat leading-relaxed">
                        Create, manage, and experience sports tournaments like never before.
                        Track detailed stats, manage auctions, and connect with the community all from your phone.
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-4 w-full max-w-sm sm:max-w-none sm:w-auto">
                    {/* App Store Button */}
                    <button className="flex items-center justify-center space-x-3 bg-white/10 active:bg-white/30 hover:bg-white/20 border border-white/20 rounded-xl px-6 py-4 transition-all duration-300 group min-h-[56px] w-full sm:w-auto sm:min-w-[200px]">
                        <Smartphone className="w-7 h-7 text-white group-hover:scale-110 transition-transform shrink-0" />
                        <div className="flex flex-col items-start">
                            <span className="text-xs text-gray-400">Download on the</span>
                            <span className="text-base font-bold text-white leading-none">App Store</span>
                        </div>
                    </button>

                    {/* Play Store Button */}
                    <button className="flex items-center justify-center space-x-3 bg-white/10 active:bg-white/30 hover:bg-white/20 border border-white/20 rounded-xl px-6 py-4 transition-all duration-300 group min-h-[56px] w-full sm:w-auto sm:min-w-[200px]">
                        <Play className="w-7 h-7 text-white fill-white group-hover:scale-110 transition-transform shrink-0" />
                        <div className="flex flex-col items-start">
                            <span className="text-xs text-gray-400">GET IT ON</span>
                            <span className="text-base font-bold text-white leading-none">Google Play</span>
                        </div>
                    </button>
                </div>
            </div>

            {/* Decorative Background Elements */}
            <div className="absolute top-1/4 left-10 w-[300px] h-[300px] bg-primary/10 rounded-full blur-[100px] pointer-events-none"></div>
            <div className="absolute bottom-1/4 right-10 w-[400px] h-[400px] bg-primary/10 rounded-full blur-[120px] pointer-events-none"></div>

        </section>
    );
};

export default ExploreKria;
