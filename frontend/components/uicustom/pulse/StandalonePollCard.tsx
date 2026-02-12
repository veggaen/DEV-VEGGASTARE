"use client";

import { useState } from 'react';
import { FiBarChart2, FiUsers, FiPlay } from 'react-icons/fi';
import { PollTakerModal } from '@/components/uicustom/polls/PollTakerModal';

interface StandalonePollCardProps {
  poll: {
    id: string;
    title: string;
    description?: string | null;
    type: string;
    responseCount: number;
  };
}

/**
 * Standalone Poll Card with "Take this poll" functionality
 * Used on /pulse/[id] standalone page to allow users to participate in polls
 */
export function StandalonePollCard({ poll }: StandalonePollCardProps) {
  const [isPollOpen, setIsPollOpen] = useState(false);
  const [hasCompleted, setHasCompleted] = useState(false);
  const [responseCount, setResponseCount] = useState(poll.responseCount);

  const handleOpenPoll = () => {
    setIsPollOpen(true);
  };

  const handleClosePoll = () => {
    setIsPollOpen(false);
  };

  const handleCompletePoll = (responseId: string) => {
    console.log('Poll completed:', responseId);
    setHasCompleted(true);
    setResponseCount(prev => prev + 1);
    setIsPollOpen(false);
  };

  const pollTypeLabel = poll.type === 'REACH_ASSESSMENT' 
    ? '🎯 REACH Assessment' 
    : poll.type === 'SURVEY' 
      ? '📊 Survey' 
      : poll.type === 'QUIZ'
        ? '🧠 Quiz'
        : poll.type === 'FEEDBACK'
          ? '💬 Feedback'
          : '📊 Poll';

  return (
    <>
      <button
        onClick={handleOpenPoll}
        className="w-full p-5 rounded-xl border border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 hover:border-primary/50 hover:from-primary/10 hover:to-primary/20 transition-all text-left group shadow-sm"
      >
        <div className="flex items-start gap-4">
          <div className="p-3 rounded-lg bg-primary/10 text-primary">
            <FiBarChart2 className="h-6 w-6" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-xs font-medium text-primary/80 uppercase tracking-wide">
                {pollTypeLabel}
              </span>
              {hasCompleted && (
                <span className="text-xs bg-green-500/10 text-green-600 px-2 py-0.5 rounded-full font-medium">
                  ✓ Completed
                </span>
              )}
            </div>
            <h3 className="font-semibold text-foreground group-hover:text-primary transition-colors mb-1">
              {poll.title}
            </h3>
            {poll.description && (
              <p className="text-sm text-muted-foreground line-clamp-2 mb-3">
                {poll.description}
              </p>
            )}
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <FiUsers className="h-3.5 w-3.5" />
                {responseCount} {responseCount === 1 ? 'response' : 'responses'}
              </span>
              <span className="flex items-center gap-1.5 text-primary font-medium group-hover:underline">
                <FiPlay className="h-3.5 w-3.5" />
                {hasCompleted ? 'View your answers' : 'Take this poll'} →
              </span>
            </div>
          </div>
        </div>
      </button>

      {isPollOpen && (
        <PollTakerModal
          pollId={poll.id}
          onClose={handleClosePoll}
          onComplete={handleCompletePoll}
        />
      )}
    </>
  );
}
