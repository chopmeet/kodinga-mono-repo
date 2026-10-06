import { 
  ChangeEventHandler,
  forwardRef, 
  InputHTMLAttributes, 
  JSX, 
  SelectHTMLAttributes, 
  useCallback, 
  useEffect, 
  useRef, 
  useState 
} from "react";
import { FieldError } from "react-hook-form";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import { MdOutlineInfo } from 'react-icons/md';
import { ColgateWrapper } from "./wrapper";
import { FiSearch } from "react-icons/fi";


export type PropsType = {
  label?: string;
  error?: string | FieldError;
  customClassContainer?: string;
  customClassInput?: string;
  customClassLabel?: string;
  icon?: JSX.Element;
  iconPosition?: "left"|"right";
  fieldHelp?: string;
};

type InputPropsType = InputHTMLAttributes<HTMLInputElement | HTMLTextAreaElement> & {
  value?: string;
  name?: string;
  onChange?: ChangeEventHandler<HTMLInputElement | HTMLTextAreaElement>;
  rows?: number;
  cols?: number;
} & PropsType;

export type InputTextPropsType = {
  onChange: (val: string) => void;
  value: string;
  name?: string;
  id?: string;
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  fieldHelp?: string;
} & PropsType;

export type InputPhoneTextPropsType = {
  onChange: (val: string, country: any) => void;
  value: string;
  name?: string;
  id?: string;
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  fieldHelp?: string;
} & PropsType;

type SelectInputPropsType = SelectHTMLAttributes<HTMLSelectElement> & {
  placeholder?: string;
  options?: {
    label: string;
    value: any;
  }[];
  fieldHelp?: string;
} & PropsType;

type messageType = {
  message: string;
};

interface SwitchProps extends Omit<React.ComponentProps<"input">, "type" | "value"> {
    checked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
}

interface SearchInputProps extends InputHTMLAttributes<HTMLInputElement> {
  showIcon?: boolean;
  containerClassName?: string;
}

export interface CityPlace {
  name: string;
  region: string;
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
  osm_key: string;
  osm_value: string;
  name?: string;
  city?: string;
  town?: string;
  village?: string;
  municipality?: string;
  country?: string;
  countrycode?: string;
  state?: string;
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

interface CitySearchProps {
  name: string;
  label?: string;
  placeholder?: string;
  lang?: "fr" | "en" | "de" | "it";
  error?: string;
  defaultValue?: string;
  onSelect: (place: CityPlace) => void;
}



export function ErrorMessage({ message }: messageType) {
    return (
        <>
            {!!message && (
                <div className="flex items-center gap-1 mt-1 text-red-400" role="alert">
                    <span className="mb-0.5">
                        <MdOutlineInfo />
                    </span>
                    <span className="text-xs">{message}</span>
                </div>
            )}
        </>
    );
}


export function FormError({ error }: { error?: string | FieldError | any }) {
  const message =
    typeof error === "string" ? error : error ? error.message : error;
  if (!message) return null;

  return <ErrorMessage message={message} />;
}


export const Input = forwardRef<
  HTMLInputElement, 
  InputPropsType
>(
  (props, ref) => {
    const {
      name,
      error,
      id,
      label,
      required,
      readOnly,
      customClassInput,
      customClassLabel,
      customClassContainer,
      icon,
      iconPosition = "left",
      fieldHelp,
      ...rest
    } = props;
    return (
      <>
        <div className={`mb-3 ${customClassContainer ? customClassContainer : ''}`}>
          {label && (
            <label
              htmlFor={id}
              className={`block custom-form-label dark:text-foreground! mb-1 ${customClassLabel} ${required && `after:ml-0.5 after:text-red-500 after:content-['*']`}`}
              aria-labelledby={id}
            >
              {label}
            </label>
          )}
          <div className="relative">
            {!!icon && <span className={`absolute ${iconPosition === 'left' ? 'left-3' : 'right-3'} top-1/2 -translate-y-1/2 text-zinc-400`}>{icon}</span>}
            <input
              className={`w-full block px-4 py-2 custom-form-control border bg-background placeholder:text-gray-400 ${customClassInput} ${icon ? 'pl-9' : ''} ${!!error && 'border-2! border-red-400!'}`}
              name={name}
              id={id}
              ref={ref}
              readOnly={readOnly || false}
              {...rest}
              onWheel={(event) => event.currentTarget.blur()}
            />
          </div>
          {!!fieldHelp && <p className="my-1 text-neutral-400">{fieldHelp}</p>}
          {<FormError error={error} />}
        </div>
      </>
    );
  }
);


export const InputPassword = forwardRef<
  HTMLInputElement, 
  InputPropsType
>(
  (props, ref) => {
    const { 
      name, 
      error, 
      id, 
      label, 
      customClassContainer,
      customClassLabel,
      customClassInput,
      required, 
      readOnly, 
      icon,
      fieldHelp,
      ...rest 
    } = props;
    const [showPassword, setShowPassword] = useState<boolean>(false);
    return (
      <>
        <div className={`mb-3 ${customClassContainer ? customClassContainer : ''}`}>
          {label && (
            <label
              htmlFor={id ?? name}
              className={`block custom-form-label mb-1 ${customClassLabel} ${required && `after:ml-0.5 after:text-red-500 after:content-['*']`}`}
              aria-labelledby={id ?? name}
            >
              {label}
            </label>
          )}
          <div className="input-group custom-input-group relative mb-1">
            <input
              className={`w-full block px-4 py-2 custom-form-control bg-background placeholder:text-gray-400 ${customClassInput} ${icon ? 'pl-9' : ''} ${!!error && 'border-2! border-red-400!'}`}
              name={name}
              id={id}
              ref={ref}
              readOnly={readOnly || false}
              type={showPassword ? "text" : "password"}
              {...rest}
            />
            <span
              className="input-group-icon icon__wrapper"
              id="basic-addon2"
              onClick={() => setShowPassword((showPassword) => !showPassword)}
            >
              {showPassword ? (
                <FaEye className="show_password__icon text-zinc-500" size={16} />
              ) : (
                <FaEyeSlash className="hide_password__icon text-zinc-500" size={16} />
              )}
            </span>
          </div>
          {!!fieldHelp && <p className="my-1 text-neutral-400">{fieldHelp}</p>}
          {<FormError error={error} />}
        </div>
      </>
    );
  }
);

export const SelectInput = forwardRef<
  HTMLSelectElement, 
  SelectInputPropsType
>(
  (props, ref) => {
    const {
      name,
      error,
      label,
      options,
      required,
      customClassContainer,
      customClassLabel,
      customClassInput,
      placeholder,
      icon,
      fieldHelp,
      ...rest
    } = props;
    return (
      <>
        <div className={`mb-3 ${customClassContainer ? customClassContainer : ''}`}>
          {label && (
            <label
              htmlFor={name}
              className={`block custom-form-label dark:text-foreground! mb-1 ${customClassLabel} ${required && `after:ml-0.5 after:text-red-500 after:content-['*']`}`}
              aria-labelledby={name}
            >
              {label}
            </label>
          )}
          <div className="relative">
            {!!icon && <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">{icon}</span>}
            <select
              {...rest}
              name={name}
              id={name}
              ref={ref}
              className={`w-full block px-4 py-2 custom-form-control bg-background mb-2 placeholder:text-gray-400 ${customClassInput} ${icon ? 'pl-9' : ''} ${!!error && 'border-2! border-red-400!'}`}
            >
              {!!placeholder && <option value="">{placeholder}</option>}
              {options?.map((option) => (
                <option value={option.value} key={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
          {!!fieldHelp && <p className="my-1 text-neutral-400">{fieldHelp}</p>}
          {<FormError error={error} />}
        </div>
      </>
    );
  }
);

export const TextareaInput = forwardRef<
  HTMLTextAreaElement, 
  InputPropsType
>(
  (props, ref) => {
    const {
      name,
      error,
      id,
      label,
      required,
      readOnly,
      customClassInput,
      customClassLabel,
      customClassContainer,
      rows = 5,
      cols,
      fieldHelp,
      onChange,
      onBlur,
      placeholder,
      // ...rest
    } = props;
    return (
      <>
        <div className={`mb-3 ${customClassContainer ? customClassContainer : ''}`}>
          {label && (
            <label
              htmlFor={id}
              className={`block custom-form-label mb-1 ${customClassLabel} ${required && `after:ml-0.5 after:text-red-500 after:content-['*']`}`}
              aria-labelledby={id}
            >
              {label}
            </label>
          )}
          <div className="relative">
            <textarea 
              className={`w-full block px-4 py-2 custom-form-control bg-background placeholder:text-gray-400 ${customClassInput} ${!!error && 'border-2! border-red-400!'}`}
              name={name} 
              id={id}
              readOnly={readOnly || false}
              ref={ref}
              onWheel={(event) => event.currentTarget.blur()}
              rows={rows}
              cols={cols}
              onChange={onChange}
              onBlur={onBlur}
              placeholder={placeholder}
            ></textarea>
          </div>
          {!!fieldHelp && <p className="my-1 text-neutral-400">{fieldHelp}</p>}
          {<FormError error={error} />}
        </div>
      </>
    );
  }
);

export const InputSwitch = forwardRef<
  HTMLInputElement, 
  SwitchProps
>(
    ({ 
      className, 
      checked, 
      onCheckedChange, 
      onChange, 
      ...props 
    }, ref) => {
      return (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            ref={ref}
            type="checkbox"
            className="sr-only peer"
            checked={checked}
            onChange={(e) => {
              onChange?.(e);
              onCheckedChange?.(e.target.checked);
            }}
            {...props}
          />
          <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary" />
        </label>
      );
    }
);

export function SearchInput({
  showIcon = true,
  containerClassName = "",
  className = "",
  ...inputProps
}: SearchInputProps) {
  return (
    <div className={`relative w-full ${containerClassName}`}>
      <input
        type="search"
        className={`w-full rounded-xl bg-gray-100 py-3 pl-4 ${
          showIcon ? "pl-10" : "pr-4"
        } text-sm text-gray-700 placeholder:text-gray-400 outline-none focus:ring-2 focus:ring-gray-300 ${className}`}
        {...inputProps}
      />
      {showIcon && (
        <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
      )}
    </div>
  );
}



const PHOTON_URL = import.meta.env.VITE_PHOTON_URL ?? "https://photon.komoot.io/api";

// on ne garde que les résultats "lieu habité" (ville, village...) et on écarte rues/POI
const CITY_OSM_VALUES = ["city", "town", "village", "municipality"];

function parseCity(feature: PhotonFeature): CityPlace {
    const p = feature.properties ?? {};
    const [lng, lat] = feature.geometry?.coordinates ?? [0, 0];

    return {
        name: p.name ?? p.city ?? p.town ?? p.village ?? "",
        region: p.state ?? "",
        country: p.country ?? "",
        countryCode: p.countrycode?.toUpperCase() ?? "",
        lat,
        lng,
    };
}

export function CitySearchInput({
  name,
  label,
  placeholder,
  lang = "fr",
  onSelect,
  error,
  defaultValue,
}: CitySearchProps) {
  const [query, setQuery] = useState(defaultValue ?? "");
  const [suggestions, setSuggestions] = useState<PhotonFeature[]>([]);
  const [loading, setLoading] = useState(false);
  const [open, setOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (defaultValue) setQuery(defaultValue);
  }, [defaultValue]);

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
          if (q.trim().length < 2) {
            setSuggestions([]);
            setOpen(false);
            return;
          }
          setLoading(true);
          try {
            const url = new URL(PHOTON_URL);
            url.searchParams.set("q", q);
            url.searchParams.set("limit", "8");
            url.searchParams.set("lang", lang);
            url.searchParams.set("osm_tag", "place");

            const res = await fetch(url.toString());
            const data: PhotonResponse = await res.json();
            const features = (data.features ?? []).filter((f) =>
              CITY_OSM_VALUES.includes(f.properties?.osm_value)
            );
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
      const place = parseCity(feature);
      setQuery(place.name);
      setOpen(false);
      setSuggestions([]);
      onSelect(place);
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
            onChange={(e) => handleChange(e.target.value)}
            placeholder={placeholder ?? "Rechercher une ville..."}
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
          {/* {!error && (
            <p className="mt-1 text-xs text-gray-400">
              Sélectionnez une ville dans la liste pour renseigner sa position.
            </p>
          )} */}

          {open && suggestions.length > 0 && (
            <ColgateWrapper className="absolute z-50 mt-1 w-full border border-gray-200 dark:border-gray-600 max-h-64 overflow-y-auto">
              <ul>
                {suggestions.map((feature, index) => {
                  const place = parseCity(feature);
                  return (
                    <li
                      key={index}
                      onMouseDown={() => handleSelect(feature)}
                      className="flex items-start gap-2 py-2 px-3 text-sm cursor-pointer hover:bg-blue-50 transition-colors"
                    >
                      <div className="leading-snug">
                        <span className="text-gray-800 dark:text-gray-300 font-medium">
                          {place.name}
                        </span>
                        {place.region && (
                          <span className="text-gray-500 ml-1">
                            — {place.region}
                            {place.country ? `, ${place.country}` : ""}
                          </span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            </ColgateWrapper>
          )}
      </div>
    );
}