import { zodResolver } from "@hookform/resolvers/zod";
import {
  useForm as useHookForm,
  UseFormProps as UseHookFormProps,
  UseFormReturn,
  FieldValues,
} from 'react-hook-form';
import { z } from 'zod';

/**
 * Configuration options for the useForm hook.
 */
interface UseFormProps<
  TFieldValues extends FieldValues = FieldValues,
> extends Omit<UseHookFormProps<TFieldValues>, "resolver"> {
  schema: z.ZodType<TFieldValues>;
}

/**
 * A reusable wrapper around react-hook-form and zod for consistent form handling.
 *
 * @param props - Form configuration including the Zod validation schema.
 * @returns An object containing form state, handlers, and errors.
 *
 * @example
 * ```tsx
 * const schema = z.object({ name: z.string().min(1) });
 * const { register, handleSubmit, errors } = useForm({ schema });
 * ```
 *
 * @note Type assertion required due to version mismatch between @hookform/resolvers
 * and react-hook-form. The resolver works correctly at runtime.
 * TODO: Update @hookform/resolvers when compatible version is available.
 */
export function useForm<TFieldValues extends FieldValues = FieldValues>({
  schema,
  ...options
}: UseFormProps<TFieldValues>) {
  return useHookForm<TFieldValues>({
    ...options,
    // @ts-expect-error - Type mismatch between @hookform/resolvers and react-hook-form versions
    resolver: zodResolver(schema),
  });
}

export type { UseFormReturn, FieldValues };
