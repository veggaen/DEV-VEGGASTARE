'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { FiCheck, FiClock, FiUsers, FiLock } from 'react-icons/fi';
import { formatDistanceToNow } from 'date-fns';

interface PollOption {
  id: string;
  text: string;
  order: number;
  voteCount: number;
  percentage: number;
  hasVoted: boolean;
  voters: string[];
}

interface Poll {
  id: string;
  question: string;
  allowMultiple: boolean;
  isAnonymous: boolean;
  expiresAt: string | null;
  isExpired: boolean;
  totalVotes: number;
  userVotedOptionIds: string[];
  options: PollOption[];
}

interface PollDisplayProps {
  conversationId: string;
}

export const PollDisplay: React.FC<PollDisplayProps> = ({ conversationId }) => {
  const [poll, setPoll] = useState<Poll | null>(null);
  const [loading, setLoading] = useState(true);
  const [voting, setVoting] = useState<string | null>(null);

  const fetchPoll = useCallback(async () => {
    try {
      const response = await fetch(`/api/polls?conversationId=${conversationId}`);
      const data = await response.json();
      setPoll(data.poll || null);
    } catch (error) {
      console.error('Failed to fetch poll:', error);
    } finally {
      setLoading(false);
    }
  }, [conversationId]);

  useEffect(() => {
    fetchPoll();
  }, [fetchPoll]);

  const handleVote = async (optionId: string) => {
    setVoting(optionId);
    try {
      const response = await fetch('/api/polls/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ optionId }),
      });
      
      if (response.ok) {
        // Refetch to get updated vote counts
        await fetchPoll();
      }
    } catch (error) {
      console.error('Failed to vote:', error);
    } finally {
      setVoting(null);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-border/50 p-4 animate-pulse">
        <div className="h-4 bg-muted rounded w-3/4 mb-4"></div>
        <div className="space-y-2">
          <div className="h-10 bg-muted rounded"></div>
          <div className="h-10 bg-muted rounded"></div>
        </div>
      </div>
    );
  }

  if (!poll) return null;

  const hasVoted = poll.userVotedOptionIds.length > 0;

  return (
    <div className="rounded-xl border border-border/50 p-4 space-y-4">
      {/* Poll Header */}
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-semibold text-lg">{poll.question}</h3>
        <div className="flex items-center gap-2 flex-shrink-0">
          {poll.isAnonymous && (
            <Badge variant="outline" className="text-xs gap-1">
              <FiLock className="h-3 w-3" />
              Anonymous
            </Badge>
          )}
          {poll.allowMultiple && (
            <Badge variant="secondary" className="text-xs">Multiple</Badge>
          )}
        </div>
      </div>

      {/* Expiry info */}
      {poll.expiresAt && (
        <div className={`flex items-center gap-1 text-xs ${poll.isExpired ? 'text-red-500' : 'text-muted-foreground'}`}>
          <FiClock className="h-3 w-3" />
          {poll.isExpired 
            ? 'Poll ended' 
            : `Ends ${formatDistanceToNow(new Date(poll.expiresAt), { addSuffix: true })}`
          }
        </div>
      )}

      {/* Options */}
      <div className="space-y-2">
        {poll.options.map((option) => {
          const isSelected = option.hasVoted;
          const canVote = !poll.isExpired && (!hasVoted || poll.allowMultiple || isSelected);
          
          return (
            <button
              key={option.id}
              onClick={() => canVote && handleVote(option.id)}
              disabled={!canVote || voting !== null}
              className={`w-full relative overflow-hidden rounded-lg transition-all ${
                isSelected 
                  ? 'bg-blue-500/15 dark:bg-blue-500/20' 
                  : 'bg-muted/40 hover:bg-muted/60'
              } ${!canVote ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
            >
              {/* Progress background */}
              {hasVoted && (
                <div 
                  className={`absolute inset-0 ${isSelected ? 'bg-blue-500/25' : 'bg-muted/60'}`}
                  style={{ width: `${option.percentage}%` }}
                />
              )}
              
              <div className="relative flex items-center justify-between p-3">
                <div className="flex items-center gap-2">
                  {isSelected && <FiCheck className="h-4 w-4 text-blue-500" />}
                  <span className={isSelected ? 'font-medium' : ''}>{option.text}</span>
                </div>
                {hasVoted && (
                  <span className="text-sm text-muted-foreground">
                    {option.percentage}% ({option.voteCount})
                  </span>
                )}
              </div>
            </button>
          );
        })}
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t border-border/40">
        <div className="flex items-center gap-1">
          <FiUsers className="h-3 w-3" />
          {poll.totalVotes} vote{poll.totalVotes !== 1 ? 's' : ''}
        </div>
        {hasVoted && !poll.allowMultiple && (
          <span className="text-blue-500">You voted</span>
        )}
      </div>
    </div>
  );
};

