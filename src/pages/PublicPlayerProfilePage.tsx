import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, MapPin, Award, Loader2 } from 'lucide-react';
import API from '../api/axios';
import TournamentHistoryView, { sportEmoji } from '../components/TournamentHistoryView';
import { TournamentHistoryEntry } from '../store/slices/registrationSlice';

interface PublicPlayer {
    _id: string;
    firstName: string;
    lastName: string;
    sport?: string;
    location?: string;
    profileImage?: string;
    titles: string[];
}

const PublicPlayerProfilePage = () => {
    const { id } = useParams();
    const navigate = useNavigate();
    const [player, setPlayer] = useState<PublicPlayer | null>(null);
    const [history, setHistory] = useState<TournamentHistoryEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        setLoading(true);
        API.get(`/player/auth/public/${id}`)
            .then(res => {
                const data = res.data?.data?.data || res.data?.data || {};
                setPlayer(data.player || null);
                setHistory(Array.isArray(data.history) ? data.history : []);
            })
            .catch(() => setError('Player not found.'))
            .finally(() => setLoading(false));
    }, [id]);

    if (loading) {
        return (
            <div className="min-h-screen bg-[#111] flex items-center justify-center">
                <Loader2 className="h-8 w-8 text-primary animate-spin" />
            </div>
        );
    }

    if (error || !player) {
        return (
            <div className="min-h-screen bg-[#111] text-white flex flex-col items-center justify-center gap-4">
                <p className="text-gray-400">{error || 'Player not found.'}</p>
                <button onClick={() => navigate('/')} className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-full font-medium">
                    Go Home
                </button>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#111] text-white font-montserrat flex flex-col items-center relative overflow-hidden">
            <div className="absolute top-0 right-0 w-[800px] h-[800px] bg-primary/20 blur-[120px] rounded-full translate-x-1/3 -translate-y-1/3 pointer-events-none" />

            <header className="w-full flex items-center justify-between px-8 py-6 max-w-5xl z-10">
                <button
                    onClick={() => navigate(-1)}
                    className="flex items-center gap-2 px-6 py-2 rounded-full bg-white/5 border border-white/10 hover:bg-primary/20 hover:border-primary hover:text-primary transition-all text-white font-medium"
                >
                    <ArrowLeft className="h-4 w-4" /> Back
                </button>
            </header>

            <main className="w-full max-w-5xl px-8 mt-4 mb-24 flex flex-col gap-10 z-10">
                {/* Profile header */}
                <div className="bg-zinc-900/80 backdrop-blur-xl border border-white/10 rounded-[40px] p-8 flex flex-col sm:flex-row items-center gap-6 shadow-2xl">
                    <div className="relative shrink-0">
                        <div className="h-28 w-28 rounded-full border-2 border-primary bg-black flex items-center justify-center">
                            <div className="h-full w-full rounded-full overflow-hidden bg-zinc-800 flex items-center justify-center font-bold text-4xl">
                                {player.profileImage
                                    ? <img src={player.profileImage} alt={player.firstName} className="h-full w-full object-cover" />
                                    : player.firstName[0]?.toUpperCase()}
                            </div>
                        </div>
                        {player.sport && (
                            <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-zinc-800 border-2 border-zinc-700 flex items-center justify-center text-sm">
                                {sportEmoji(player.sport)}
                            </div>
                        )}
                    </div>

                    <div className="flex flex-col items-center sm:items-start gap-2 text-center sm:text-left">
                        <h1 className="text-3xl font-bold font-oswald tracking-wide text-white">
                            {player.firstName} {player.lastName}
                        </h1>
                        <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 text-sm text-gray-400">
                            {player.sport && <span className="capitalize">{sportEmoji(player.sport)} {player.sport}</span>}
                            {player.location && <span className="flex items-center gap-1"><MapPin className="h-3 w-3" /> {player.location}</span>}
                        </div>
                        {player.titles.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-2 justify-center sm:justify-start">
                                {player.titles.map((t, i) => (
                                    <span key={i} className="flex items-center gap-1.5 bg-gradient-to-r from-primary/20 to-transparent border border-primary/30 px-3 py-1 rounded-full text-xs font-semibold text-white">
                                        <Award className="h-3.5 w-3.5 text-primary" /> {t}
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                {/* Tournament history with per-sport selector */}
                <div className="flex flex-col gap-6">
                    <h2 className="text-2xl font-oswald font-bold tracking-wide">Tournament History</h2>
                    <TournamentHistoryView
                        history={history}
                        emptyMessage="This player has no tournament history yet."
                    />
                </div>
            </main>
        </div>
    );
};

export default PublicPlayerProfilePage;
