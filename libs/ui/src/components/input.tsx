import { 
  ChangeEventHandler,
  forwardRef, 
  InputHTMLAttributes, 
  JSX, 
  SelectHTMLAttributes,
  useState 
} from "react";
import { FieldError } from "react-hook-form";
import ReactQuill from "react-quill-new";
import "react-quill-new/dist/quill.snow.css";
import makeAnimated from "react-select/animated";
import { FaEye, FaEyeSlash } from "react-icons/fa6";
import { MdOutlineInfo } from 'react-icons/md';
import PhoneInput from 'react-phone-input-2';
import 'react-phone-input-2/lib/style.css'
import { ColgateWrapper } from "./wrapper";
import { FiSearch } from "react-icons/fi";


export const animatedComponents = makeAnimated();

type PropsType = {
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

type InputTextPropsType = {
  onChange: (val: string) => void;
  value: string;
  name?: string;
  id?: string;
  required?: boolean;
  readOnly?: boolean;
  placeholder?: string;
  fieldHelp?: string;
} & PropsType;

type InputPhoneTextPropsType = {
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


export const InputQuill = forwardRef<
  ReactQuill,
  InputTextPropsType
>((props, ref) => {
  const {
    name,
    error,
    id,
    label,
    required,
    readOnly,
    customClassContainer,
    customClassInput,
    customClassLabel,
    fieldHelp,
    value,
    onChange,
    ...rest
  } = props;
  const modules = {
    toolbar: [
      [{ header: [1, 2, 3, 4, 5, 6, false] }],
      ["bold", "italic", "underline", "strike", "blockquote"],
      [
        { list: "ordered" },
        // { list: "bullet" },
        { indent: "-1" },
        { indent: "+1" },
      ],
      ["link", "image"],
      [
        {
          color: [
            "#4be1b4",
            "#f45b5b",
            "#000000",
            "#e60000",
            "#ff9900",
            "#ffff00",
            "#008a00",
            "#0066cc",
            "#9933ff",
            "#ffffff",
            "#ffcccc",
            "#ffe699",
            "#ffffcc",
            "#cfe2f3",
            "#d9d2e9",
            "#fff1f1",
            "#21a3740d",
            "#f45b5b0d",

            // Couleurs standard WYSIWYG
            "#808080",
            "#C0C0C0",
            "#800000",
            "#FF0000",
            "#808000",
            "#008000",
            "#00FF00",
            "#008080",
            "#00FFFF",
            "#000080",
            "#0000FF",
            "#800080",
            "#FF00FF",
            "#8B0000",
            "#006400",
            "#00008B",
            "#FF8C00",
            "#ADD8E6",
            "#90EE90",
            "#FFC0CB",
            "#87CEEB",
            "#FFD700",
            "#A52A2A",
            "#FF7F50",
            "#40E0D0",
            "#708090",
            "#E6E6FA",
            "#4B0082",
            "#F5F5DC",
            "#FA8072",
            "#F0E68C",
            "#FFB6C1",
            "#DC143C",
            "#2E8B57",
            "#4169E1",
          ],
        },
        {
          background: [
            "#4be1b4",
            "#f45b5b",
            "#000000",
            "#e60000",
            "#ff9900",
            "#ffff00",
            "#008a00",
            "#0066cc",
            "#9933ff",
            "#ffffff",
            "#ffcccc",
            "#ffe699",
            "#ffffcc",
            "#cfe2f3",
            "#d9d2e9",
            "#fff1f1",
            "#21a3740d",
            "#f45b5b0d",

            // Couleurs standard WYSIWYG
            "#808080",
            "#C0C0C0",
            "#800000",
            "#FF0000",
            "#808000",
            "#008000",
            "#00FF00",
            "#008080",
            "#00FFFF",
            "#000080",
            "#0000FF",
            "#800080",
            "#FF00FF",
            "#8B0000",
            "#006400",
            "#00008B",
            "#FF8C00",
            "#ADD8E6",
            "#90EE90",
            "#FFC0CB",
            "#87CEEB",
            "#FFD700",
            "#A52A2A",
            "#FF7F50",
            "#40E0D0",
            "#708090",
            "#E6E6FA",
            "#4B0082",
            "#F5F5DC",
            "#FA8072",
            "#F0E68C",
            "#FFB6C1",
            "#DC143C",
            "#2E8B57",
            "#4169E1",
          ],
        },
      ],
    ],
  };

  const formats = [
    "header",
    "bold",
    "italic",
    "underline",
    "strike",
    "blockquote",
    "list",
    // "bullet",
    "indent",
    "link",
    "image",
    "color",
    "background",
  ];
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
        <ReactQuill
          className={`placeholder:text-gray-200 ${customClassInput}`}
          // name={name}
          id={id}
          readOnly={readOnly || false}
          theme="snow"
          value={value}
          onChange={(val: string) => onChange(val)}
          modules={modules}
          formats={formats}
          ref={ref}
          {...rest}
        ></ReactQuill>
        {!!fieldHelp && <p className="my-1 text-neutral-400">{fieldHelp}</p>}
        {<FormError error={error} />}
      </div>
    </>
  );
});


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

export const InputPhone = forwardRef<
  HTMLInputElement, 
  InputPhoneTextPropsType
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
      fieldHelp,
      value,
      onChange,
      ...rest
    } = props;
    return (
      <>
        <div className={`mb-3 ${customClassContainer ?? ''}`}>
          {label && (
            <label
              htmlFor={id}
              className={`block custom-form-label dark:text-foreground! mb-1 ${customClassLabel} ${required && `after:ml-0.5 after:text-red-500 after:content-['*']`}`}
              aria-labelledby={id}
            >
              {label}
            </label>
          )}
          <PhoneInput
            onlyCountries={['bf', 'ci', 'sn']}
            masks={{
              bf: ".. .. .. ..",
              ci: ".. .. .. .. ..",
              sn: ".. ... .. ..",
            }}
            country={"bf"}
            containerClass="p-0"
            inputClass={`w-full block custom-form-control bg-background! placeholder:text-gray-400 ${customClassInput} ${!!error && 'border-2! border-red-400!'}`}
            placeholder="Numéro de télephone"
            inputProps={{
                name: name,
                required: true,
                autoFocus: true,
            }}
            countryCodeEditable={false}
            enableAreaCodes={true}
            prefix="+"
            value={value}
            onChange={onChange}
            inputStyle={{
                width: "100%",
            }}
            {...rest}
          />
          <span ref={ref}></span>
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