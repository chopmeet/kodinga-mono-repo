import { toast } from 'sonner';

type ToastOptions = {
    message: string;
    position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
    duration?: number;
    onClose?: () => void;
};


export const customToast = {
    success: ({ message, position = 'top-right', duration = 2000, onClose }: ToastOptions) => {
        toast.success(message, {
            position,
            duration,
            onAutoClose: onClose,
            onDismiss: onClose,
        });
    },

    error: ({ message, position = 'top-right', duration = 3000, onClose }: ToastOptions) => {
        toast.error(message, {
            position,
            duration,
            onAutoClose: onClose,
            onDismiss: onClose,
        });
    },

    warning: ({ message, position = 'top-right', duration = 3000, onClose }: ToastOptions) => {
        toast.warning(message, {
            position,
            duration,
            onAutoClose: onClose,
            onDismiss: onClose,
        });
    },
};