"use client";

import {
  ArrowUpRight,
  ArrowDownLeft,
  AlertCircle,
  ChevronRight,
} from "lucide-react";
import { Transaction } from "@/lib/api/client";
import { getCategoryColor } from "@/lib/stellar/categoriesContract";

interface TransactionItemProps {
  transaction: Transaction;
  onOpenDrawer: (tx: Transaction) => void;
  category?: string;
}

export default function TransactionItem({
  transaction,
  onOpenDrawer,
  category,
}: TransactionItemProps) {
  const operation = transaction.operations[0];
  const userAccount = "GDQD6A4P422X44QW6UXO6R6AOTHOV4C6A4P422X44QW6UXO6R6AOTHO";
  const isIncoming = operation?.to === userAccount;

  return (
    <tr
      onClick={() => onOpenDrawer(transaction)}
      className="hover:bg-white/3 cursor-pointer transition-all group relative border-l-2 border-transparent hover:border-l-[#e8b84b]"
    >
      {/* Operation Type */}
      <td className="px-8 py-6 whitespace-nowrap">
        <div className="flex items-center gap-4">
          <div
            className={`p-3 rounded-2xl border ${
              !transaction.successful
                ? "bg-red-500/10 text-red-400 border-red-500/20"
                : isIncoming
                  ? "bg-[#4ade80]/10 text-[#4ade80] border-[#4ade80]/20"
                  : "bg-[#f97316]/10 text-[#f97316] border-[#f97316]/20"
            }`}
          >
            {!transaction.successful ? (
              <AlertCircle className="w-5 h-5" />
            ) : isIncoming ? (
              <ArrowDownLeft className="w-5 h-5" />
            ) : (
              <ArrowUpRight className="w-5 h-5" />
            )}
          </div>
          <div>
            <p className="text-sm font-black text-white uppercase tracking-wider group-hover:text-[#e8b84b] transition-colors">
              {operation?.type.replace(/_/g, " ") || "Unknown"}
            </p>
            <p className="text-[10px] font-bold text-[#7a8aaa] uppercase tracking-widest mt-1">
              {transaction.successful ? (
                <span className="flex items-center gap-1.5 text-[#4ade80]/80">
                  <span className="w-1 h-1 rounded-full bg-[#4ade80]" />
                  Verified
                </span>
              ) : (
                <span className="flex items-center gap-1.5 text-red-400/80">
                  <span className="w-1 h-1 rounded-full bg-red-400" />
                  Reverted
                </span>
              )}
            </p>
          </div>
        </div>
      </td>

      {/* Memo & Hash */}
      <td className="px-8 py-6">
        <div className="flex items-center gap-2 flex-wrap">
          <p className="text-sm font-semibold text-[#e8edf8] group-hover:text-white transition-colors">
            {transaction.memo || "Unlabeled"}
          </p>
          {category &&
            (() => {
              const colors = getCategoryColor(category);
              return (
                <span
                  className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase tracking-wider border ${colors.bg} ${colors.text} ${colors.border}`}
                >
                  {category}
                </span>
              );
            })()}
        </div>
        <p className="text-[10px] font-mono text-[#7a8aaa] mt-1 line-clamp-1 opacity-60">
          {transaction.hash.substring(0, 32)}...
        </p>
      </td>

      {/* Amount & Asset */}
      <td className="px-8 py-6 whitespace-nowrap">
        {operation?.amount ? (
          <div className="flex items-center gap-2">
            <span className="text-sm font-black text-white">
              {isIncoming ? "+" : "-"}
              {operation.amount}
            </span>
            <span className="text-[10px] font-bold text-[#e8b84b] uppercase">
              {operation.asset_code}
            </span>
          </div>
        ) : (
          <span className="text-xs font-bold text-[#7a8aaa] uppercase tracking-widest opacity-30">
            Network
          </span>
        )}
      </td>

      {/* Date */}
      <td className="px-8 py-6 whitespace-nowrap">
        <p className="text-sm font-bold text-[#e8edf8]">
          {new Date(transaction.created_at).toLocaleDateString(undefined, {
            month: "short",
            day: "numeric",
          })}
        </p>
        <p className="text-[10px] font-bold text-[#7a8aaa] uppercase tracking-widest mt-0.5">
          {new Date(transaction.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      </td>

      {/* Review Button */}
      <td className="px-8 py-6 text-right">
        <button className="p-2.5 text-[#7a8aaa] hover:text-[#e8b84b] hover:bg-white/5 rounded-xl transition-all opacity-0 group-hover:opacity-100 translate-x-4 group-hover:translate-x-0">
          <ChevronRight className="w-5 h-5" />
        </button>
      </td>
    </tr>
  );
}
