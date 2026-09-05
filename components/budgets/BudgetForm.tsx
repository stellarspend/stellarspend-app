"use client";

import React from "react";
import { z } from "zod";
import { useForm } from "@/hooks/useForm";
import { Budget } from "@/lib/api/client";
import { isValidStellarAddress } from "@/lib/stellar/sharedBudgetContract";

const budgetSchema = z
  .object({
    name: z
      .string()
      .min(1, "Budget name is required")
      .max(50, "Name is too long"),
    amount: z.coerce
      .number()
      .positive("Amount must be positive")
      .min(0.01, "Minimum amount is 0.01"),
    category: z.string().min(1, "Category is required"),
    asset: z.enum(["XLM", "USDC", "EURC"], {
      message: "Please select a valid asset",
    }),
    period: z.enum(["daily", "monthly", "quarterly"], {
      message: "Please select a valid period",
    }),
    startDate: z.string().min(1, "Start date is required"),
    endDate: z.string().min(1, "End date is required"),
    isShared: z.boolean().default(false),
    coOwners: z
      .array(
        z
          .string()
          .refine((value) => isValidStellarAddress(value), {
            message: "Enter a valid Stellar address",
          })
      )
      .default([]),
    approvalThreshold: z
      .number()
      .int("Threshold must be a whole number")
      .min(1, "Threshold must be at least 1")
      .default(2),
  })
  .refine((data) => new Date(data.endDate) >= new Date(data.startDate), {
    message: "End date must be after start date",
    path: ["endDate"],
  })
  .superRefine((data, ctx) => {
    if (!data.isShared) return;
    const totalMembers = data.coOwners.length + 1;
    if (
      !Number.isInteger(data.approvalThreshold) ||
      data.approvalThreshold < 1 ||
      data.approvalThreshold > totalMembers
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["approvalThreshold"],
        message: `Approval threshold must be between 1 and ${totalMembers} (total members)`,
      });
    }
    const duplicates = data.coOwners.filter(
      (address, index) => data.coOwners.indexOf(address) !== index
    );
    if (duplicates.length > 0) {
      ctx.addIssue({
        code: "custom",
        path: ["coOwners"],
        message: "Duplicate co-owner addresses are not allowed",
      });
    }
  });

type BudgetFormData = z.infer<typeof budgetSchema>;

export type BudgetFormMode = "create" | "edit" | "propose";

interface BudgetFormProps {
    onSubmit: (data: BudgetFormData) => void;
    onCancel?: () => void;
    initialData?: Budget | null;
    isEditing?: boolean;
    mode?: BudgetFormMode;
    budgetCount?: number;
    spent?: number;
}

function getProgressColor(percentage: number): string {
    if (percentage >= 90) {
        return "bg-red-500";
    } else if (percentage >= 75) {
        return "bg-yellow-500";
    }
    return "bg-green-500";
}

function getProgressTextColor(percentage: number): string {
    if (percentage >= 90) {
        return "text-red-600 dark:text-red-400";
    } else if (percentage >= 75) {
        return "text-yellow-600 dark:text-yellow-400";
    }
    return "text-green-600 dark:text-green-400";
}

export default function BudgetForm({ onSubmit, onCancel, initialData, isEditing = false, mode, spent = 0 }: BudgetFormProps) {
    const formMode: BudgetFormMode = mode ?? (isEditing ? 'edit' : 'create');
    const isProposeMode = formMode === 'propose' || (formMode === 'edit' && !!initialData?.isShared);
    const isSharedBudget = isProposeMode || (formMode === 'edit' && !!initialData?.isShared);
    const sharedMemberCount = (initialData?.coOwners?.length ?? 0) + 1;
    const sharedThreshold = initialData?.approvalThreshold ?? 2;

    
    // Calculate default end date once per component mount
    const [defaultEndDate] = React.useState(() => {
        return new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
    });

    // Co-owner address input state (create mode only)
    const [coOwnerInput, setCoOwnerInput] = React.useState('');
    const [coOwnerError, setCoOwnerError] = React.useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isValid, isSubmitting },
        setValue,
        watch,
    } = useForm<BudgetFormData>({
        schema: budgetSchema,
        defaultValues: {
            name: initialData?.name || '',
            amount: initialData?.amount || 0,
            category: initialData?.category || '',
            asset: initialData?.asset || 'XLM',
            startDate: initialData?.startDate || new Date().toISOString().split('T')[0],
            endDate: initialData?.endDate || defaultEndDate,
            isShared: initialData?.isShared ?? false,
            coOwners: initialData?.coOwners ?? [],
            approvalThreshold: initialData?.approvalThreshold ?? 2,
        },
        mode: 'onChange',
    });

    const isShared = watch('isShared') ?? false;
    const coOwners = watch('coOwners') ?? [];
    const approvalThreshold = watch('approvalThreshold') ?? 2;
    const totalMembers = coOwners.length + 1;

    const addCoOwners = () => {
        const candidates = coOwnerInput
            .split(/[\s,]+/)
            .map((s) => s.trim())
            .filter(Boolean);
        if (candidates.length === 0) return;

        const invalid = candidates.find((a) => !isValidStellarAddress(a));
        if (invalid) {
            setCoOwnerError(`"${invalid}" is not a valid Stellar address.`);
            return;
        }
        const duplicates = candidates.filter((a) => coOwners.includes(a));
        if (duplicates.length > 0) {
            setCoOwnerError(`Already added: ${duplicates.join(', ')}`);
            return;
        }
        setValue('coOwners', [...coOwners, ...candidates], { shouldValidate: true });
        setCoOwnerInput('');
        setCoOwnerError(null);
    };

    const removeCoOwner = (address: string) => {
        setValue('coOwners', coOwners.filter((a) => a !== address), { shouldValidate: true });
        setCoOwnerError(null);
    };
    // Calculate budget progress percentage
    const budgetLimit = initialData?.amount || 0;
    const spentPercentage = budgetLimit > 0 ? Math.min(100, (spent / budgetLimit) * 100) : 0;
    const progressColor = getProgressColor(spentPercentage);
    const progressTextColor = getProgressTextColor(spentPercentage);

    return (
        <div className="w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg">
            <h2 className="text-2xl font-bold mb-6 text-gray-900 dark:text-white">
                {isProposeMode ? 'Propose Budget Change' : (isEditing ? 'Edit Budget' : 'Create Budget')}
            </h2>

            {isSharedBudget && (
                <div className="mb-4 p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-700 rounded-lg">
                    <p className="text-xs text-amber-800 dark:text-amber-200">
                        This is a shared budget — changes require {sharedThreshold} of {sharedMemberCount} member approvals before they take effect.
                    </p>
                </div>
            )}

            {isEditing && budgetLimit > 0 && (
                <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-700 rounded-lg">
                    <div className="flex justify-between items-center mb-2">
                        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                            Budget Progress
                        </span>
                        <span className={`text-sm font-semibold ${progressTextColor}`}>
                            {spentPercentage.toFixed(1)}%
                        </span>
                    </div>
                    <div className="relative h-4 w-full overflow-hidden rounded-full bg-gray-200 dark:bg-gray-600">
                        <div
                            className={`h-full transition-all duration-300 ${progressColor}`}
                            style={{ width: `${spentPercentage}%` }}
                            role="progressbar"
                            aria-valuenow={spentPercentage}
                            aria-valuemin={0}
                            aria-valuemax={100}
                            aria-label={`Budget usage: ${spentPercentage.toFixed(1)}%`}
                        />
                    </div>
                    <div className="flex justify-between items-center mt-2 text-xs text-gray-500 dark:text-gray-400">
                        <span>Spent: {spent.toFixed(2)} {initialData?.asset || 'XLM'}</span>
                        <span>Limit: {budgetLimit.toFixed(2)} {initialData?.asset || 'XLM'}</span>
                    </div>
                    {spentPercentage >= 90 && (
                        <p className="mt-2 text-xs text-red-600 dark:text-red-400 font-medium">
                            Warning: You have used over 90% of your budget!
                        </p>
                    )}
                    {spentPercentage >= 75 && spentPercentage < 90 && (
                        <p className="mt-2 text-xs text-yellow-600 dark:text-yellow-400 font-medium">
                            Caution: You have used over 75% of your budget.
                        </p>
                    )}
                </div>
            )}

            <form onSubmit={(handleSubmit as unknown as (handler: (data: BudgetFormData) => void) => React.FormEventHandler<HTMLFormElement>)((data: BudgetFormData) => onSubmit(data))} className="space-y-4" noValidate>
                <div className="space-y-1">
                    <label htmlFor="name" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Budget Name <span className="text-red-500" aria-label="required">*</span>
                    </label>
                    <input
                        id="name"
                        {...register('name')}
                        aria-required="true"
                        aria-invalid={errors.name ? 'true' : 'false'}
                        aria-describedby={errors.name ? 'name-error' : undefined}
                        className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${errors.name ? 'border-red-500 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                            }`}
                        placeholder="e.g. Monthly Groceries"
                    />
                    {errors.name && (
                        <p id="name-error" className="text-xs text-red-500 mt-1" role="alert">{errors.name.message}</p>
                    )}
                </div>

                <div className="space-y-1">
                    <label htmlFor="amount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Amount (XLM) <span className="text-red-500" aria-label="required">*</span>
                    </label>
                    <input
                        id="amount"
                        type="number"
                        step="0.01"
                        inputMode="decimal"
                        {...register('amount')}
                        aria-required="true"
                        aria-invalid={errors.amount ? 'true' : 'false'}
                        aria-describedby={errors.amount ? 'amount-error' : undefined}
                        className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${errors.amount ? 'border-red-500 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                            }`}
                        placeholder="0.00"
                    />
                    {errors.amount && (
                        <p id="amount-error" className="text-xs text-red-500 mt-1" role="alert">{errors.amount.message}</p>
                    )}
                </div>

                <div className="space-y-1">
                    <label htmlFor="category" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Category <span className="text-red-500" aria-label="required">*</span>
                    </label>
                    <select
                        id="category"
                        {...register('category')}
                        aria-required="true"
                        aria-invalid={errors.category ? 'true' : 'false'}
                        aria-describedby={errors.category ? 'category-error' : undefined}
                        className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${errors.category ? 'border-red-500 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                            }`}
                    >
                        <option value="">Select a category</option>
                        <option value="food">Food & Drinks</option>
                        <option value="transport">Transport</option>
                        <option value="housing">Housing</option>
                        <option value="utilities">Utilities</option>
                        <option value="entertainment">Entertainment</option>
                    </select>
                    {errors.category && (
                        <p id="category-error" className="text-xs text-red-500 mt-1" role="alert">{errors.category.message}</p>
                    )}
                </div>

                <div className="space-y-1">
                    <label htmlFor="asset" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Asset
                    </label>
                    <select
                        id="asset"
                        {...register('asset')}
                        className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${errors.asset ? 'border-red-500 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                            }`}
                    >
                        <option value="XLM">XLM (Stellar)</option>
                        <option value="USDC">USDC (USD Coin)</option>
                        <option value="EURC">EURC (Euro Coin)</option>
                    </select>
                    {errors.asset && (
                        <p className="text-xs text-red-500 mt-1">{errors.asset.message}</p>
                    )}
                </div>

                <div className="space-y-1">
    <label
        className="block text-sm font-medium text-gray-700 dark:text-gray-300"
        id="period-label"
    >
        Period <span className="text-red-500" aria-label="required">*</span>
    </label>
    <div
        role="radiogroup"
        aria-labelledby="period-label"
        aria-required="true"
        aria-invalid={errors.period ? 'true' : 'false'}
        aria-describedby={errors.period ? 'period-error' : undefined}
        className="flex space-x-4"
    >
        {(["daily", "monthly", "quarterly"] as const).map((p) => (
            <label key={p} className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                <input
                    type="radio"
                    value={p}
                    {...register('period')}
                    className="text-blue-600 focus:ring-blue-500"
                />
                <span className="capitalize">{p}</span>
            </label>
        ))}
    </div>
    {errors.period && (
        <p id="period-error" className="text-xs text-red-500 mt-1" role="alert">{errors.period.message}</p>
    )}
</div>
{/* 
                <div className="space-y-1">
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Period <span className="text-red-500" aria-label="required">*</span>
                    </label>
                    <div className="flex space-x-4">
                        {(["daily", "monthly", "quarterly"] as const).map((p) => (
                            <label key={p} className="flex items-center space-x-2 text-sm text-gray-700 dark:text-gray-300">
                                <input
                                    type="radio"
                                    value={p}
                                    {...register('period')}
                                    aria-invalid={errors.period ? 'true' : 'false'}
                                    aria-describedby={errors.period ? 'period-error' : undefined}
                                    className="text-blue-600 focus:ring-blue-500"
                                />
                                <span className="capitalize">{p}</span>
                            </label>
                        ))}
                    </div>
                    {errors.period && (
                        <p id="period-error" className="text-xs text-red-500 mt-1" role="alert">{errors.period.message}</p>
                    )}
                </div> */}

                <div className="space-y-1">
                    <label htmlFor="startDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        Start Date
                    </label>
                    <input
                        id="startDate"
                        type="date"
                        {...register('startDate')}
                        className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${errors.startDate ? 'border-red-500 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                            }`}
                    />
                    {errors.startDate && (
                        <p className="text-xs text-red-500 mt-1">{errors.startDate.message}</p>
                    )}
                </div>

                <div className="space-y-1">
                    <label htmlFor="endDate" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                        End Date
                    </label>
                    <input
                        id="endDate"
                        type="date"
                        {...register('endDate')}
                        className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${errors.endDate ? 'border-red-500 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                            }`}
                    />
                    {errors.endDate && (
                        <p className="text-xs text-red-500 mt-1">{errors.endDate.message}</p>
                    )}
                </div>

                {formMode === 'create' && (
                    <div className="space-y-4 border-t border-gray-200 dark:border-gray-600 pt-4">
                        <label className="flex items-center space-x-2 text-sm font-medium text-gray-700 dark:text-gray-300 cursor-pointer">
                            <input
                                type="checkbox"
                                {...register('isShared')}
                                className="text-blue-600 focus:ring-blue-500 rounded"
                            />
                            <span>Shared budget (requires co-owner approval for changes)</span>
                        </label>

                        {isShared && (
                            <>
                                <div className="space-y-1">
                                    <label htmlFor="coOwners" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Co-owner Stellar addresses
                                    </label>
                                    <div className="flex space-x-2">
                                        <input
                                            id="coOwners"
                                            type="text"
                                            value={coOwnerInput}
                                            onChange={(e) => {
                                                setCoOwnerInput(e.target.value);
                                                setCoOwnerError(null);
                                            }}
                                            onKeyDown={(e) => {
                                                if (e.key === 'Enter') {
                                                    e.preventDefault();
                                                    addCoOwners();
                                                }
                                            }}
                                            aria-invalid={errors.coOwners ? 'true' : 'false'}
                                            aria-describedby={errors.coOwners || coOwnerError ? 'co-owners-error' : undefined}
                                            placeholder="G... (comma or space separated)"
                                            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${errors.coOwners || coOwnerError ? 'border-red-500 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                                                }`}
                                        />
                                        <button
                                            type="button"
                                            onClick={addCoOwners}
                                            className="px-4 py-2 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold rounded-lg transition-colors whitespace-nowrap"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    {(errors.coOwners || coOwnerError) && (
                                        <p id="co-owners-error" className="text-xs text-red-500 mt-1" role="alert">
                                            {errors.coOwners?.message || coOwnerError}
                                        </p>
                                    )}

                                    {coOwners.length > 0 && (
                                        <ul className="flex flex-wrap gap-2 mt-2" aria-label="Co-owners">
                                            {coOwners.map((address) => (
                                                <li
                                                    key={address}
                                                    className="inline-flex items-center space-x-1 px-2 py-1 bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-200 text-xs rounded-full"
                                                >
                                                    <span className="font-mono">{`${address.slice(0, 6)}…${address.slice(-4)}`}</span>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeCoOwner(address)}
                                                        aria-label={`Remove co-owner ${address}`}
                                                        className="text-blue-500 hover:text-red-500"
                                                    >
                                                        ×
                                                    </button>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>

                                <div className="space-y-1">
                                    <label htmlFor="approvalThreshold" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                                        Approval threshold (members required to approve changes)
                                    </label>
                                    <input
                                        id="approvalThreshold"
                                        type="number"
                                        min={1}
                                        max={totalMembers}
                                        {...register('approvalThreshold', { valueAsNumber: true })}
                                        aria-invalid={errors.approvalThreshold ? 'true' : 'false'}
                                        aria-describedby={errors.approvalThreshold ? 'approval-threshold-error' : undefined}
                                        className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-blue-500 outline-none transition-colors ${errors.approvalThreshold ? 'border-red-500 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                                            }`}
                                    />
                                    {errors.approvalThreshold && (
                                        <p id="approval-threshold-error" className="text-xs text-red-500 mt-1" role="alert">{errors.approvalThreshold.message}</p>
                                    )}
                                    <p className="text-xs text-gray-500 dark:text-gray-400">
                                        {approvalThreshold} of {totalMembers} members must approve any change before it takes effect.
                                    </p>
                                </div>
                            </>
                        )}
                    </div>
                )}

                <div className="flex space-x-3">
                    {onCancel && (
                        <button
                            type="button"
                            onClick={onCancel}
                            className="flex-1 px-6 py-3 bg-gray-200 hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600 text-gray-800 dark:text-white font-semibold rounded-lg shadow-md transition-colors duration-200"
                        >
                            Cancel
                        </button>
                    )}
                    <button
                        type="submit"
                        disabled={!isValid || isSubmitting}
                        className={`${onCancel ? 'flex-1' : 'w-full'} px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-300 text-white font-semibold rounded-lg shadow-md transition-colors duration-200`}
                    >
                        {isSubmitting ? 'Saving...' : (isProposeMode ? 'Propose Change' : (isEditing ? 'Update Budget' : 'Save Budget'))}
                    </button>
                </div>
                {(!isValid || isSubmitting) && (
                    <p id="submit-help" className="text-xs text-gray-500 mt-1">
                        Please fill all required fields correctly before submitting.
                    </p>
                )}
            </form>
        </div>
    );
}
