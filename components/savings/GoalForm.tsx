"use client";

import React, { useState } from "react";
import { z } from "zod";
import { useForm } from "@/hooks/useForm";
import { useOffline } from "@/components/offline/OfflineProvider";
import useWallet from "@/hooks/useWallet";
import { createGoal, Goal } from "@/lib/stellar/savingsGoalContract";
import { useToast } from "@/components/ui/use-toast";

const goalSchema = z.object({
    title: z.string().min(1, 'Goal title is required').max(100, 'Title is too long'),
    targetAmount: z.coerce
        .number()
        .positive('Target amount must be positive')
        .min(1, 'Minimum target is 1 XLM'),
    deadline: z.string().refine((val) => {
        const date = new Date(val);
        return !isNaN(date.getTime()) && date > new Date();
    }, {
        message: 'Deadline must be a future date',
    }),
    recurrence: z.enum(['once', 'monthly', 'yearly']),
});

type GoalFormData = z.infer<typeof goalSchema>;

interface GoalFormProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onGoalCreated: (goal: Goal) => void;
}

export default function GoalForm({ open, onOpenChange, onGoalCreated }: GoalFormProps) {
    const { isOnline, queueAction } = useOffline();
    const { freighter } = useWallet();
    const { toast } = useToast();
    const publicKey = freighter.publicKey;
    const [txStatus, setTxStatus] = useState<string | null>(null);

    const {
        register,
        handleSubmit,
        formState: { errors, isValid, isSubmitting },
        reset,
    } = useForm<GoalFormData>({
        schema: goalSchema,
        defaultValues: {
            title: '',
            targetAmount: 0,
            deadline: '',
            recurrence: 'once',
        },
        mode: 'onChange',
    });

    const onSubmit = async (data: GoalFormData) => {
        if (!isOnline) {
            queueAction('CREATE_GOAL', `Create goal: ${data.title}`, data);
            toast({
                title: "Goal Queued",
                description: "Offline: Your goal has been queued and will be saved when you reconnect.",
            });
            reset();
            onOpenChange(false);
            return;
        }

        if (!publicKey) {
            toast({
                title: "Wallet Not Connected",
                description: "Please connect your Freighter wallet to persist this savings goal on-chain.",
                variant: "destructive",
            });
            return;
        }

        try {
            setTxStatus('Initializing transaction...');
            const newGoal = await createGoal(publicKey, data, (status) => {
                setTxStatus(status);
            });
            toast({
                title: "Goal Created Successfully",
                description: `Your savings goal "${data.title}" has been created.`,
            });
            onGoalCreated(newGoal);
            reset();
            onOpenChange(false);
        } catch (error: unknown) {
            console.error(error);
            const errMessage = error instanceof Error ? error.message : String(error);
            toast({
                title: "Failed to Create Goal",
                description: errMessage,
                variant: "destructive",
            });
        } finally {
            setTxStatus(null);
        }
    };

    return (
        <div className={`fixed inset-0 z-50 flex items-center justify-center ${open ? 'block' : 'hidden'}`}>
            <div className="absolute inset-0 bg-black bg-opacity-50" onClick={() => onOpenChange(false)}></div>
            <div className="relative w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700">
                <div className="flex items-center space-x-2 mb-6">
                    <div className="p-2 bg-green-100 dark:bg-green-900 rounded-lg">
                        <svg className="w-6 h-6 text-green-600 dark:text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                    </div>
                    <h2 className="text-2xl font-bold text-gray-900 dark:text-white">Create Savings Goal</h2>
                </div>

                <form onSubmit={(handleSubmit as unknown as (handler: (data: GoalFormData) => Promise<void>) => React.FormEventHandler<HTMLFormElement>)((data: GoalFormData) => onSubmit(data))} className="space-y-4">
                    <div className="space-y-1">
                        <label htmlFor="title" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Goal Title
                        </label>
                        <input
                            id="title"
                            aria-required="true"
                            {...register('title')}
                            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none transition-all ${errors.title ? 'border-red-500 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                                }`}
                            placeholder="e.g. New Laptop"
                        />
                        {errors.title && (
                            <p className="text-xs text-red-500 mt-1">{errors.title.message}</p>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="targetAmount" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Target Amount (XLM)
                        </label>
                        <input
                            id="targetAmount"
                            type="number"
                            aria-required="true"
                            {...register('targetAmount')}
                            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none transition-all ${errors.targetAmount ? 'border-red-500 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                                }`}
                            placeholder="500"
                        />
                        {errors.targetAmount && (
                            <p className="text-xs text-red-500 mt-1">{errors.targetAmount.message}</p>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="deadline" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Deadline Date
                        </label>
                        <input
                            id="deadline"
                            type="date"
                            aria-required="true"
                            {...register('deadline')}
                            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none transition-all ${errors.deadline ? 'border-red-500 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                                }`}
                        />
                        {errors.deadline && (
                            <p className="text-xs text-red-500 mt-1">{errors.deadline.message}</p>
                        )}
                    </div>

                    <div className="space-y-1">
                        <label htmlFor="recurrence" className="block text-sm font-medium text-gray-700 dark:text-gray-300">
                            Recurrence
                        </label>
                        <select
                            id="recurrence"
                            aria-required="true"
                            {...register('recurrence')}
                            className={`w-full px-4 py-2 border rounded-md focus:ring-2 focus:ring-green-500 outline-none transition-all ${errors.recurrence ? 'border-red-500 bg-red-50' : 'border-gray-300 dark:border-gray-600 dark:bg-gray-700'
                                }`}
                        >
                            <option value="once">One-time</option>
                            <option value="monthly">Monthly</option>
                            <option value="yearly">Yearly</option>
                        </select>
                        {errors.recurrence && (
                            <p className="text-xs text-red-500 mt-1">{errors.recurrence.message}</p>
                        )}
                    </div>

                    <div className="flex justify-end gap-2 pt-4">
                        {txStatus && (
                            <div className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1.5 mr-auto">
                                <svg className="animate-spin h-3.5 w-3.5 text-blue-600 dark:text-blue-400" fill="none" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                </svg>
                                <span className="font-medium">{txStatus}</span>
                            </div>
                        )}
                        <button
                            type="button"
                            onClick={() => onOpenChange(false)}
                            disabled={!!txStatus}
                            className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-md disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            aria-label="Create savings goal"
                            disabled={!isValid || isSubmitting || !!txStatus}
                            className="px-6 py-2 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold rounded-lg shadow-md transition-colors duration-200"
                        >
                            {txStatus ? 'Processing...' : 'Create Goal'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
