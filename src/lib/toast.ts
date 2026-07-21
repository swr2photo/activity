/**
 * Toast API compatible with previous notistack usage.
 * Prefer: enqueueSnackbar(msg, { variant: 'success' })
 */
import { toast } from "sonner";

export type SnackbarVariant = "default" | "success" | "error" | "warning" | "info";

export type EnqueueOptions = {
  variant?: SnackbarVariant;
  autoHideDuration?: number;
  preventDuplicate?: boolean;
};

export function enqueueSnackbar(message: string, options?: EnqueueOptions) {
  const variant = options?.variant ?? "default";
  const duration = options?.autoHideDuration ?? 4000;

  switch (variant) {
    case "success":
      toast.success(message, { duration });
      break;
    case "error":
      toast.error(message, { duration });
      break;
    case "warning":
      toast.warning(message, { duration });
      break;
    case "info":
      toast.info(message, { duration });
      break;
    default:
      toast(message, { duration });
  }
}

export function closeSnackbar(id?: string | number) {
  if (id === undefined) toast.dismiss();
  else toast.dismiss(id);
}

/** Drop-in for `const { enqueueSnackbar } = useSnackbar()` */
export function useSnackbar() {
  return { enqueueSnackbar, closeSnackbar };
}
