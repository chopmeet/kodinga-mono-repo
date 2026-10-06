import { useState, useEffect, useRef, useCallback } from "react";
import { ColgateWrapper } from "./wrapper";

export interface PhotonPlace {
    displayName: string;
    city: string;
    street: string;
    country: string;
    countryCode: string;
    lat: number;
    lng: number;
}

interface PhotonGeometry {
    type: "Point";
    coordinates: [number, number]; // [lng, lat]
}
  
interface PhotonProperties {
    osm_id: number;
    osm_type: "N" | "W" | "R";
    osm_key: string;
    osm_value: string;
    name?: string;
    street?: string;
    housenumber?: string;
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    postcode?: string;
    country?: string;
    countrycode?: string;
    state?: string;
    county?: string;
}
  
interface PhotonFeature {
    type: "Feature";
    geometry: PhotonGeometry;
    properties: PhotonProperties;
}
  
interface PhotonResponse {
    type: "FeatureCollection";
    features: PhotonFeature[];
}

interface Props {
    name: string;
    label?: string;
    placeholder?: string;
    lang?: "fr" | "en" | "de" | "it";
    value?: string;
    onChange?: (value: string) => void;
    onSelect?: (place: PhotonPlace) => void;
    error?: string;
}

// --- utilitaire de parsing de la réponse GeoJSON Photon ---
function parsePhoton(feature: PhotonFeature): PhotonPlace {
    const p = feature.properties ?? {};
    const [lng, lat] = feature.geometry?.coordinates ?? [0, 0];

    const streetParts = [p.street, p.housenumber].filter(Boolean).join(" ");

    const displayParts = [
        streetParts || p.name,
        p.city ?? p.town ?? p.village,
        p.postcode,
        p.country,
    ].filter(Boolean);

    return {
        displayName: displayParts.join(", "),
        city: p.city ?? p.town ?? p.village ?? p.municipality ?? "",
        street: streetParts,
        country: p.country ?? "",
        countryCode: p.countrycode?.toUpperCase() ?? "",
        lat,
        lng,
    };
}

export function PhotonInput(
{ 
    name, 
    label, 
    placeholder, 
    lang = "fr", 
    // value,
    onChange,
    onSelect,
    error,
}: Props) {

    const [query, setQuery] = useState("");
    const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (!containerRef.current?.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, []);

    const search = useCallback(
        async (q: string) => {
            if (q.trim().length < 3) {
                setSuggestions([]);
                setOpen(false);
                return;
            }
            setLoading(true);
            try {
                const url = new URL("https://photon.komoot.io/api");
                url.searchParams.set("q", q);
                url.searchParams.set("limit", "6");
                url.searchParams.set("lang", lang);

                const res = await fetch(url.toString());
                const data: PhotonResponse = await res.json();
                const features = data.features ?? [];
                setSuggestions(features);
                setOpen(features.length > 0);
            } catch {
                setSuggestions([]);
            } finally {
                setLoading(false);
            }
        },
        [lang]
    );

    const handleChange = (value: string) => {
        setQuery(value);
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => search(value), 400);
    };

    const handleSelect = (feature: PhotonFeature) => {
        const place = parsePhoton(feature);
        setQuery(place.displayName);
        setOpen(false);
        setSuggestions([]);
        onChange?.(place.displayName);
        onSelect?.(place);
    };

    return (
        <div ref={containerRef} className="relative w-full">
            {label && (
                <label className="block custom-form-label dark:text-foreground! mb-1">
                {label}
                </label>
            )}

            <div className="relative">
                <input
                    name={name}
                    value={query}
                    onChange={(e) => {
                        setQuery(e.target.value);
                        onChange?.(e.target.value);
                        handleChange(e.target.value);
                    }}
                    placeholder={placeholder ?? "Rechercher une adresse..."}
                    autoComplete="off"
                    className={`w-full block px-4 py-2 custom-form-control border bg-background placeholder:text-gray-400 outline-none transition
                        focus:ring-2 focus:ring-blue-500
                        ${error ? "border-red-500" : "border-gray-300"}`}
                />
                {loading && (
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs animate-pulse">
                    ...
                </span>
                )}
            </div>

            {error && <p className="mt-1 text-xs text-red-500">{error}</p>}

            {open && suggestions.length > 0 && (
            <ColgateWrapper className="absolute z-50 mt-1 w-full border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto">
                <ul className="">
                {suggestions.map((feature, index) => {
                    const place = parsePhoton(feature);
                    return (
                        <li
                            key={index}
                            onMouseDown={() => handleSelect(feature)}
                            className="flex items-start gap-2 py-2 text-sm cursor-pointer hover:bg-blue-50 transition-colors"
                        >
                            <span className="mt-0.5 text-gray-400">
                                
                            </span>
                            <div className="leading-snug">
                                <span className="text-gray-800 dark:text-gray-300 font-medium">
                                    {[feature.properties?.street, feature.properties?.housenumber]
                                    .filter(Boolean)
                                    .join(" ") || feature.properties?.name}
                                </span>
                                {place.city && (
                                    <span className="text-gray-500 ml-1">
                                    — {place.city}{place.country ? `, ${place.country}` : ""}
                                    </span>
                                )}
                            </div>
                        </li>
                    );
                })}
                </ul>
            </ColgateWrapper> )}
        </div>
    );
}