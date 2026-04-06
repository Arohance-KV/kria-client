import React, { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapContainer, TileLayer, Marker, useMapEvents, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { ArrowLeft, Save, MapPin, Calendar, Users, DollarSign, Settings, Image as ImageIcon, Loader2, Navigation, Search, Upload, X } from 'lucide-react';

import HoverFooter from '@/components/HoverFooter';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { useAppDispatch, useAppSelector } from '../../store/hooks';
import { createTournament } from '../../store/slices/tournamentSlice';
import { uploadImage } from '../../api/upload';

// Fix Leaflet's default icon issue with bundlers
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
});

// Component to handle map clicks and drag events
const LocationMarker: React.FC<{
    lat: string | number;
    lng: string | number;
    onChange: (lat: number, lng: number) => void;
}> = ({ lat, lng, onChange }) => {
    const position = (lat && lng) ? new L.LatLng(Number(lat), Number(lng)) : null;

    useMapEvents({
        click(e) {
            onChange(parseFloat(e.latlng.lat.toFixed(6)), parseFloat(e.latlng.lng.toFixed(6)));
        },
    });

    const markerRef = React.useRef<L.Marker>(null);

    return position === null ? null : (
        <Marker
            position={position}
            draggable={true}
            ref={markerRef}
            eventHandlers={{
                dragend() {
                    const marker = markerRef.current;
                    if (marker != null) {
                        const p = marker.getLatLng();
                        onChange(parseFloat(p.lat.toFixed(6)), parseFloat(p.lng.toFixed(6)));
                    }
                },
            }}
        />
    );
};

const MapController: React.FC<{ lat: string | number; lng: string | number }> = ({ lat, lng }) => {
    const map = useMap();
    React.useEffect(() => {
        if (lat && lng) {
            map.flyTo([Number(lat), Number(lng)], map.getZoom() < 13 ? 14 : map.getZoom(), {
                animate: true,
                duration: 1.5
            });
        }
    }, [lat, lng, map]);
    return null;
};


const CreateTournamentPage = () => {
    const navigate = useNavigate();
    const dispatch = useAppDispatch();
    const { isLoading, error } = useAppSelector((state) => state.tournament);

    // Default state matching ITournament schema
    const [formData, setFormData] = useState({
        name: '',
        description: '',
        sport: 'badminton',
        bannerImage: '',
        startDate: '',
        endDate: '',
        registrationDeadline: '',
        venue: {
            name: '',
            address: '',
            city: '',
            coordinates: {
                lat: '' as string | number,
                lng: '' as string | number,
            },
        },
        settings: {
            maxTeams: 8,
            defaultBudget: 100000,
            auctionType: 'manual',
            allowLateRegistration: false,
        }
    });

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value, type } = e.target;

        if (name.startsWith('venue.coordinates.')) {
            const coordField = name.split('.')[2];
            setFormData(prev => ({
                ...prev,
                venue: {
                    ...prev.venue,
                    coordinates: { ...prev.venue.coordinates, [coordField]: value === '' ? '' : Number(value) }
                }
            }));
        } else if (name.startsWith('venue.')) {
            const venueField = name.split('.')[1];
            setFormData(prev => ({
                ...prev,
                venue: { ...prev.venue, [venueField]: value }
            }));
        } else if (name.startsWith('settings.')) {
            const settingsField = name.split('.')[1];
            let parsedValue: any = value;

            // Handle specific types for settings
            if (type === 'number') parsedValue = Number(value);
            if (type === 'checkbox') parsedValue = (e.target as HTMLInputElement).checked;

            setFormData(prev => ({
                ...prev,
                settings: { ...prev.settings, [settingsField]: parsedValue }
            }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const [bannerUploading, setBannerUploading] = useState(false);
    const bannerInputRef = useRef<HTMLInputElement>(null);

    const handleBannerUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        setBannerUploading(true);
        try {
            const url = await uploadImage(file, 'tournament-banners');
            setFormData(prev => ({ ...prev, bannerImage: url }));
        } catch {
            alert('Failed to upload image. Please try again.');
        } finally {
            setBannerUploading(false);
            if (bannerInputRef.current) bannerInputRef.current.value = '';
        }
    };

    const [geoLoading, setGeoLoading] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchLoading, setSearchLoading] = useState(false);

    const handleGetLocation = () => {
        if (!navigator.geolocation) return;
        setGeoLoading(true);
        navigator.geolocation.getCurrentPosition(
            (pos) => {
                const lat = parseFloat(pos.coords.latitude.toFixed(6));
                const lng = parseFloat(pos.coords.longitude.toFixed(6));
                setFormData(prev => ({
                    ...prev,
                    venue: {
                        ...prev.venue,
                        coordinates: { lat, lng }
                    }
                }));
                setGeoLoading(false);
            },
            () => setGeoLoading(false)
        );
    };

    const handleSearchLocation = async (e?: React.SyntheticEvent) => {
        if (e) e.preventDefault();
        if (!searchQuery.trim()) return;
        setSearchLoading(true);
        try {
            const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&q=${encodeURIComponent(searchQuery)}`);
            const data = await res.json();
            if (data && data.length > 0) {
                const lat = parseFloat(Number(data[0].lat).toFixed(6));
                const lng = parseFloat(Number(data[0].lon).toFixed(6));
                setFormData(prev => ({
                    ...prev,
                    venue: { ...prev.venue, coordinates: { lat, lng } }
                }));
            } else {
                alert('Location not found. Try a different search term.');
            }
        } catch (error) {
            console.error('Failed to search location:', error);
        } finally {
            setSearchLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const result = await dispatch(createTournament(formData));
        if (createTournament.fulfilled.match(result)) {
            navigate('/organizer/home');
        }
    };

    return (
        <div className="min-h-screen bg-[#111] text-white font-montserrat flex flex-col items-center">

            {/* Header */}
            <header className="w-full flex items-center justify-between px-8 py-6 max-w-4xl z-10 sticky top-0 bg-[#111]/80 backdrop-blur-md border-b border-white/5">
                <button
                    onClick={() => navigate('/organizer/home')}
                    className="flex items-center gap-2 px-4 py-2 rounded-full hover:bg-white/5 transition-colors text-white font-medium"
                >
                    <ArrowLeft className="h-4 w-4" />
                    Back
                </button>
                <h1 className="text-xl font-oswald font-bold tracking-widest text-white uppercase">New Tournament</h1>
                <button
                    onClick={handleSubmit}
                    className="flex items-center gap-2 px-6 py-2 rounded-full bg-primary hover:bg-primary/90 text-white font-medium shadow-lg shadow-primary/20 transition-all font-oswald tracking-wide"
                >
                    <Save className="h-4 w-4" />
                    CREATE
                </button>
            </header>

            {/* Form Content */}
            <main className="w-full max-w-4xl px-8 mt-8 mb-24 z-10">
                <form onSubmit={handleSubmit} className="flex flex-col gap-12">

                    {/* Basic Info Section */}
                    <section className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <ImageIcon className="h-5 w-5" />
                            </div>
                            <h2 className="text-2xl font-oswald font-bold text-white tracking-wide">Basic Information</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="name" className="text-gray-400">Tournament Name *</Label>
                                <Input
                                    id="name" name="name" required
                                    placeholder="e.g. Kria Summer Smash 2026"
                                    className="bg-black/50 border-white/10 text-white py-6"
                                    value={formData.name} onChange={handleInputChange}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="sport" className="text-gray-400">Sport *</Label>
                                <select
                                    id="sport" name="sport" required
                                    className="flex h-12 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-white appearance-none"
                                    value={formData.sport} onChange={handleInputChange}
                                >
                                    <option value="badminton">Badminton</option>
                                    <option value="cricket">Cricket</option>
                                    <option value="football">Football</option>
                                    <option value="kabaddi">Kabaddi</option>
                                    <option value="table_tennis">Table Tennis</option>
                                    <option value="tennis">Tennis</option>
                                </select>
                            </div>

                            <div className="space-y-2">
                                <Label className="text-gray-400">Banner Image</Label>
                                <input
                                    ref={bannerInputRef}
                                    type="file"
                                    accept="image/png,image/jpg,image/jpeg,image/gif"
                                    className="hidden"
                                    onChange={handleBannerUpload}
                                />
                                {formData.bannerImage ? (
                                    <div className="relative rounded-xl overflow-hidden border border-white/10">
                                        <img src={formData.bannerImage} alt="Banner preview" className="w-full h-32 object-cover" />
                                        <button
                                            type="button"
                                            onClick={() => setFormData(prev => ({ ...prev, bannerImage: '' }))}
                                            className="absolute top-2 right-2 p-1 rounded-full bg-black/60 text-white hover:bg-red-500/80 transition-colors"
                                        >
                                            <X className="h-4 w-4" />
                                        </button>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={() => bannerInputRef.current?.click()}
                                        disabled={bannerUploading}
                                        className="flex items-center justify-center gap-2 w-full h-24 rounded-xl border border-dashed border-white/20 bg-black/30 text-gray-400 hover:border-primary/50 hover:text-primary transition-colors disabled:opacity-50"
                                    >
                                        {bannerUploading ? <Loader2 className="h-5 w-5 animate-spin" /> : <Upload className="h-5 w-5" />}
                                        <span className="text-sm">{bannerUploading ? 'Uploading...' : 'Upload Banner Image'}</span>
                                    </button>
                                )}
                            </div>

                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="description" className="text-gray-400">Description</Label>
                                <textarea
                                    id="description" name="description"
                                    placeholder="Provide details about the tournament rules, prizes, etc."
                                    className="flex min-h-[120px] w-full rounded-md border border-white/10 bg-black/50 px-3 py-3 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-white"
                                    value={formData.description} onChange={handleInputChange}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Schedule Section */}
                    <section className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <Calendar className="h-5 w-5" />
                            </div>
                            <h2 className="text-2xl font-oswald font-bold text-white tracking-wide">Schedule</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="startDate" className="text-gray-400">Start Date *</Label>
                                <Input
                                    id="startDate" name="startDate" type="date" required
                                    className="bg-black/50 border-white/10 text-white py-6 [color-scheme:dark]"
                                    value={formData.startDate} onChange={handleInputChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="endDate" className="text-gray-400">End Date *</Label>
                                <Input
                                    id="endDate" name="endDate" type="date" required
                                    className="bg-black/50 border-white/10 text-white py-6 [color-scheme:dark]"
                                    value={formData.endDate} onChange={handleInputChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="registrationDeadline" className="text-gray-400">Reg. Deadline *</Label>
                                <Input
                                    id="registrationDeadline" name="registrationDeadline" type="date" required
                                    className="bg-black/50 border-white/10 text-white py-6 [color-scheme:dark]"
                                    value={formData.registrationDeadline} onChange={handleInputChange}
                                />
                            </div>
                        </div>
                    </section>

                    {/* Location Section */}
                    <section className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <MapPin className="h-5 w-5" />
                            </div>
                            <h2 className="text-2xl font-oswald font-bold text-white tracking-wide">Location</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2 md:col-span-2">
                                <Label htmlFor="venue.name" className="text-gray-400">Venue Name *</Label>
                                <Input
                                    id="venue.name" name="venue.name" required
                                    placeholder="e.g. Kanteerava Stadium"
                                    className="bg-black/50 border-white/10 text-white py-6"
                                    value={formData.venue.name} onChange={handleInputChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="venue.city" className="text-gray-400">City *</Label>
                                <Input
                                    id="venue.city" name="venue.city" required
                                    placeholder="e.g. Bangalore"
                                    className="bg-black/50 border-white/10 text-white py-6"
                                    value={formData.venue.city} onChange={handleInputChange}
                                />
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="venue.address" className="text-gray-400">Full Address</Label>
                                <Input
                                    id="venue.address" name="venue.address"
                                    placeholder="Optional detailed address"
                                    className="bg-black/50 border-white/10 text-white py-6"
                                    value={formData.venue.address} onChange={handleInputChange}
                                />
                            </div>
                            {/* Coordinates */}
                            <div className="md:col-span-2 flex flex-col gap-2">
                                <div className="flex items-center justify-between">
                                    <Label className="text-gray-400 flex items-center gap-1.5">
                                        <MapPin className="h-3.5 w-3.5 text-primary" />
                                        Coordinates <span className="text-gray-600 text-xs font-normal">(optional — map drag or search)</span>
                                    </Label>
                                    <button
                                        type="button"
                                        onClick={handleGetLocation}
                                        disabled={geoLoading}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/10 border border-primary/20 text-primary text-xs font-medium hover:bg-primary/20 transition-colors disabled:opacity-50"
                                    >
                                        {geoLoading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Navigation className="h-3 w-3" />}
                                        Get my location
                                    </button>
                                </div>
                                <div className="flex gap-2 w-full mt-2">
                                    <div className="relative flex-1">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
                                        <Input
                                            type="text"
                                            placeholder="Search a location to pin (e.g. Bangalore, Kanteerava)..."
                                            value={searchQuery}
                                            onChange={(e) => setSearchQuery(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && handleSearchLocation(e)}
                                            className="bg-black/50 border-white/10 text-white pl-9 text-sm h-10"
                                        />
                                    </div>
                                    <button
                                        type="button"
                                        onClick={handleSearchLocation}
                                        disabled={searchLoading || !searchQuery.trim()}
                                        className="flex items-center justify-center gap-2 px-4 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm font-medium transition-colors disabled:opacity-50 border border-white/10"
                                    >
                                        {searchLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Search'}
                                    </button>
                                </div>
                                <div className="mt-4 border border-white/10 rounded-xl overflow-hidden shadow-lg shadow-black/20" style={{ height: '300px' }}>
                                    <MapContainer
                                        center={(formData.venue.coordinates.lat && formData.venue.coordinates.lng)
                                            ? [Number(formData.venue.coordinates.lat), Number(formData.venue.coordinates.lng)]
                                            : [20.5937, 78.9629] // Default India center
                                        }
                                        zoom={(formData.venue.coordinates.lat && formData.venue.coordinates.lng) ? 14 : 4}
                                        scrollWheelZoom={true}
                                        className="h-full w-full bg-zinc-900"
                                    >
                                        <TileLayer
                                            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                                            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                                            className="map-tiles"
                                        />
                                        <LocationMarker
                                            lat={formData.venue.coordinates.lat}
                                            lng={formData.venue.coordinates.lng}
                                            onChange={(lat, lng) => setFormData(prev => ({
                                                ...prev,
                                                venue: { ...prev.venue, coordinates: { lat, lng } }
                                            }))}
                                        />
                                        <MapController lat={formData.venue.coordinates.lat} lng={formData.venue.coordinates.lng} />
                                    </MapContainer>
                                </div>
                                <div className="flex gap-3 mt-2 text-xs text-gray-400">
                                    <span className="bg-black/40 px-3 py-1.5 rounded-md border border-white/5">
                                        Lat: {formData.venue.coordinates.lat || '—'}
                                    </span>
                                    <span className="bg-black/40 px-3 py-1.5 rounded-md border border-white/5">
                                        Lng: {formData.venue.coordinates.lng || '—'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </section>

                    {/* Settings Section */}
                    <section className="bg-white/5 border border-white/10 rounded-3xl p-8 flex flex-col gap-6">
                        <div className="flex items-center gap-3 border-b border-white/10 pb-4 mb-2">
                            <div className="p-2 bg-primary/10 rounded-lg text-primary">
                                <Settings className="h-5 w-5" />
                            </div>
                            <h2 className="text-2xl font-oswald font-bold text-white tracking-wide">Tournament Rules & Auction</h2>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                            <div className="space-y-2">
                                <Label htmlFor="settings.maxTeams" className="text-gray-400">Max Teams</Label>
                                <div className="relative">
                                    <Users className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                                    <Input
                                        id="settings.maxTeams" name="settings.maxTeams" type="number" min="2"
                                        className="bg-black/50 border-white/10 text-white py-6 pl-10"
                                        value={formData.settings.maxTeams} onChange={handleInputChange}
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                <Label htmlFor="settings.defaultBudget" className="text-gray-400">Default Auction Budget</Label>
                                <div className="relative">
                                    <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-500" />
                                    <Input
                                        id="settings.defaultBudget" name="settings.defaultBudget" type="number" min="0"
                                        className="bg-black/50 border-white/10 text-white py-6 pl-10"
                                        value={formData.settings.defaultBudget} onChange={handleInputChange}
                                    />
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="settings.auctionType" className="text-gray-400">Auction Type</Label>
                                <select
                                    id="settings.auctionType" name="settings.auctionType"
                                    className="flex h-12 w-full rounded-md border border-white/10 bg-black/50 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 text-white appearance-none"
                                    value={formData.settings.auctionType} onChange={handleInputChange}
                                >
                                    <option value="manual">Manual (Offline Draft)</option>
                                    <option value="live">Live Interactive Auction</option>
                                </select>
                            </div>

                            <div className="space-y-2 flex items-center h-full pt-6">
                                <label className="flex items-center gap-3 cursor-pointer group">
                                    <input
                                        type="checkbox"
                                        name="settings.allowLateRegistration"
                                        className="w-5 h-5 rounded border-white/20 bg-black/50 text-primary focus:ring-primary focus:ring-offset-black"
                                        checked={formData.settings.allowLateRegistration}
                                        onChange={handleInputChange}
                                    />
                                    <span className="text-gray-300 group-hover:text-white transition-colors">Allow Late Registration</span>
                                </label>
                            </div>
                        </div>
                    </section>
                </form>
            </main>

            <HoverFooter />
        </div>
    );
};

export default CreateTournamentPage;
