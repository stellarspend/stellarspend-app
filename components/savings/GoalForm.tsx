"use client";

import React, { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
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
    /** Current saved amount toward the goal, used to detect 100 % completion. */
    currentAmount?: number;
    /** Target amount for the goal — required alongside currentAmount. */
    targetAmount?: number;
}

// ---------------------------------------------------------------------------
// Confetti data — deterministic so no hydration mismatch
// ---------------------------------------------------------------------------
const CONFETTI_DOTS = [
    { id: 0,  x: 10, delay: 0,    rotate: 120,  color: "bg-green-400" },
    { id: 1,  x: 20, delay: 0.05, rotate: -90,  color: "bg-yellow-400" },
    { id: 2,  x: 30, delay: 0.1,  rotate: 200,  color: "bg-blue-400" },
    { id: 3,  x: 42, delay: 0.07, rotate: -150, color: "bg-pink-400" },
    { id: 4,  x: 55, delay: 0.03, rotate: 75,   color: "bg-purple-400" },
    { id: 5,  x: 65, delay: 0.12, rotate: -60,  color: "bg-orange-400" },
    { id: 6,  x: 75, delay: 0.04, rotate: 180,  color: "bg-teal-400" },
    { id: 7,  x: 85, delay: 0.09, rotate: -110, color: "bg-red-400" },
    { id: 8,  x: 50, delay: 0.15, rotate: 240,  color: "bg-indigo-400" },
    { id: 9,  x: 35, delay: 0.06, rotate: -30,  color: "bg-emerald-400" },
];

// ---------------------------------------------------------------------------
// CompletionOverlay
// ---------------------------------------------------------------------------
// Rendered inside the modal when the goal reaches 100 %. Fires once per mount
// of the overlay (tracked by the parent via hasAnimatedRef).
// ---------------------------------------------------------------------------

interface CompletionOverlayProps {
    reducedMotion: boolean;
    onDismiss: () => void;
}

function CompletionOverlay({ reducedMotion, onDismiss }: CompletionOverlayProps) {
    return (
        <motion.div
            key="completion-overlay"
            // Full-cover layer that sits on top of the form content
            className="absolute inset-0 z-10 flex flex-col items-center justify-center rounded-xl overflow-hidden bg-white/95 dark:bg-gray-800/95 backdrop-blur-sm"
            initial={reducedMotion ? { opacity: 1 } : { opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={reducedMotion ? { opacity: 0 } : { opacity: 0, scale: 0.92 }}
            transition={
                reducedMotion
                    ? { duration: 0.15 }
                    : { type: "spring", damping: 20, stiffness: 260, duration: 0.45 }
            }
            role="status"
            aria-live="polite"
            aria-label="Goal completed"
        >
            {/* Confetti burst — skip when reduced motion is preferred */}
            {!reducedMotion && (
                <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
                    {CONFETTI_DOTS.map((dot) => (
                        <motion.span
                            key={dot.id}
                            className={`absolute w-2.5 h-2.5 rounded-full ${dot.color}`}
                            style={{ left: `${dot.x}%`, top: "40%" }}
                            initial={{ y: 0, opacity: 1, scale: 0 }}
                            animate={{
                                y: [0, -80, 60],
                                opacity: [1, 1, 0],
                                scale: [0, 1.2, 0.8],
                                rotate: [0, dot.rotate],
                            }}
                            transition={{
                                duration: 1.1,
                                delay: dot.delay,
                                ease: "easeOut",
                            }}
                        />
                    ))}
                </div>
            )}

            {/* Trophy icon */}
            <motion.div
                className="mb-4"
                initial={reducedMotion ? {} : { scale: 0, rotate: -15 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={
                    reducedMotion
                        ? { duration: 0 }
                        : { type: "spring", damping: 12, stiffness: 300, delay: 0.1 }
                }
                aria-hidden="true"
            >
                <div className="p-4 bg-green-100 dark:bg-green-900 rounded-full shadow-lg">
                    <svg
                        className="w-12 h-12 text-green-600 dark:text-green-400"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        aria-hidden="true"
                    >
                        <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth="1.8"
                            d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                        />
                    </svg>
                </div>
            </motion.div>

            {/* Heading & sub-copy */}
            <motion.h3
                className="text-2xl font-bold text-gray-900 dark:text-white mb-1 text-center"
                initial={reducedMotion ? {} : { opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reducedMotion ? 0 : 0.2, duration: 0.3 }}
            >
                Goal Complete! 🎉
            </motion.h3>

            <motion.p
                className="text-sm text-gray-500 dark:text-gray-400 text-center px-6 mb-6"
                initial={reducedMotion ? {} : { opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reducedMotion ? 0 : 0.3, duration: 0.3 }}
            >
                You&apos;ve hit 100% of your savings target. Keep it up!
            </motion.p>

            {/* Dismiss button */}
            <motion.button
                type="button"
                onClick={onDismiss}
                className="px-6 py-2 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg shadow-md transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
                initial={reducedMotion ? {} : { opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: reducedMotion ? 0 : 0.38, duration: 0.25 }}
                aria-label="Dismiss goal completion celebration"
            >
                Awesome!
            </motion.button>
        </motion.div>
    );
}

// ---------------------------------------------------------------------------
// GoalForm
// ---------------------------------------------------------------------------

export default function GoalForm({ open, onOpenChange, onGoalCreated, currentAmount, targetAmount }: GoalFormProps) {
    const { isOnline, queueAction } = useOffline();
    const { freighter } = useWallet();
    const { toast } = useToast();
    const publicKey = freighter.publicKey;
    const [txStatus, setTxStatus] = useState<string | null>(null);

    // --- Completion animation state ---
    const [showCompletion, setShowCompletion] = useState(false);
    // Guard: only fire the animation once per component lifecycle.
    const hasAnimatedRef = useRef(false);

    // Detect user's motion preference once (stable across renders).
    const reducedMotionRef = useRef(
        typeof window !== "undefined"
            ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
            : false,
    );
    const reducedMotion = reducedMotionRef.current;

    // Compute progress and decide whether to show the overlay.
    useEffect(() => {
        if (
            !open ||
            hasAnimatedRef.current ||
            typeof currentAmount !== "number" ||
            typeof targetAmount !== "number" ||
            targetAmount <= 0
        ) {
            return;
        }

        const progress = (currentAmount / targetAmount) * 100;

        if (progress >= 100) {
            hasAnimatedRef.current = true;
            setShowCompletion(true);
        }
    }, [open, currentAmount, targetAmount]);

    // Reset the one-shot guard when the modal is fully closed so it can fire
    // again if the same component instance is reused for a different goal.
    useEffect(() => {
        if (!open) {
            hasAnimatedRef.current = false;
            setShowCompletion(false);
        }
    }, [open]);

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
            <div className="relative w-full max-w-md p-6 bg-white dark:bg-gray-800 rounded-xl shadow-lg border border-gray-100 dark:border-gray-700 overflow-hidden">

                {/* ---------- Completion animation overlay ---------- */}
                <AnimatePresence>
                    {showCompletion && (
                        <CompletionOverlay
                            reducedMotion={reducedMotion}
                            onDismiss={() => setShowCompletion(false)}
                        />
                    )}
                </AnimatePresence>

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
