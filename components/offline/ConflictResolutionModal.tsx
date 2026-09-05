import React from 'react';
import { Budget } from '@/lib/api/client';

export interface ConflictResolutionModalProps {
  localData: Partial<Budget>;
  remoteData: Partial<Budget>;
  onResolve: (decision: 'local' | 'remote') => void;
  onClose: () => void;
}

export const ConflictResolutionModal: React.FC<ConflictResolutionModalProps> = ({
  localData,
  remoteData,
  onResolve,
  onClose,
}) => {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
      <div className="bg-white rounded-lg p-6 max-w-lg w-full shadow-xl">
        <h2 className="text-xl font-bold mb-4">Sync Conflict Detected</h2>
        <p className="mb-4 text-gray-700">
          This budget was modified on another device while you were offline.
          Please choose which version to keep.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {/* Local Version */}
          <div className="border rounded p-4">
            <h3 className="font-semibold text-blue-600 mb-2">Your Offline Changes</h3>
            <div className="text-sm">
              <p><strong>Name:</strong> {localData.name}</p>
              <p><strong>Amount:</strong> {localData.amount}</p>
              <p><strong>Category:</strong> {localData.category}</p>
            </div>
            <button
              onClick={() => onResolve('local')}
              className="mt-4 w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 transition"
            >
              Keep Mine
            </button>
          </div>

          {/* Remote Version */}
          <div className="border rounded p-4">
            <h3 className="font-semibold text-green-600 mb-2">Other Device&apos;s Changes</h3>
            <div className="text-sm">
              <p><strong>Name:</strong> {remoteData.name}</p>
              <p><strong>Amount:</strong> {remoteData.amount}</p>
              <p><strong>Category:</strong> {remoteData.category}</p>
            </div>
            <button
              onClick={() => onResolve('remote')}
              className="mt-4 w-full bg-green-600 text-white py-2 rounded hover:bg-green-700 transition"
            >
              Keep Theirs
            </button>
          </div>
        </div>

        <div className="text-right">
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 font-medium"
          >
            Cancel Sync for Now
          </button>
        </div>
      </div>
    </div>
  );
};
