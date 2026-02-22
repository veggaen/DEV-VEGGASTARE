/**
 * @fileOverview Multi-select user search picker for restricting pulse visibility.
 * @stability stable
 *
 * Usage:
 *   <UserPicker
 *     selectedUserIds={['abc', 'def']}
 *     onSelectionChange={(ids) => setSelectedIds(ids)}
 *     placeholder="Search by name or email…"
 *   />
 *
 * Fetches from /api/users/search?q=<query>&excludeSelf=false
 * Shows selected users as removable badges.
 */

'use client';

import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FiX, FiSearch, FiUserPlus } from 'react-icons/fi';
import { cn } from '@/lib/utils';
import Spinner from '@/components/uicustom/spinner';

interface UserResult {
  id: string;
  name: string | null;
  email: string | null;
  image: string | null;
  role?: string;
}

interface UserPickerProps {
  /** Currently selected user IDs */
  selectedUserIds: string[];
  /** Callback when selection changes */
  onSelectionChange: (userIds: string[]) => void;
  /** Placeholder text for the search input */
  placeholder?: string;
  /** Max users that can be selected */
  maxUsers?: number;
  /** Additional class names for the container */
  className?: string;
  /** Whether to exclude the current user from search results */
  excludeSelf?: boolean;
  /** Pre-loaded user data for already-selected users (avoids extra fetch) */
  initialUsers?: UserResult[];
}

export function UserPicker({
  selectedUserIds,
  onSelectionChange,
  placeholder = 'Search users…',
  maxUsers = 200,
  className,
  excludeSelf = false,
  initialUsers = [],
}: UserPickerProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<UserResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [selectedUsers, setSelectedUsers] = useState<Map<string, UserResult>>(
    () => new Map(initialUsers.map((u) => [u.id, u]))
  );
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Keep selectedUsers map in sync with initialUsers prop changes
  useEffect(() => {
    if (initialUsers.length > 0) {
      setSelectedUsers((prev) => {
        const next = new Map(prev);
        for (const u of initialUsers) {
          if (!next.has(u.id)) next.set(u.id, u);
        }
        return next;
      });
    }
  }, [initialUsers]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const searchUsers = useCallback(
    async (q: string) => {
      if (q.length < 2) {
        setResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const params = new URLSearchParams({
          q,
          limit: '10',
          excludeSelf: String(excludeSelf),
        });
        const res = await fetch(`/api/users/search?${params}`);
        if (!res.ok) throw new Error('Search failed');
        const data = await res.json();
        setResults(data.users || []);
      } catch (err) {
        console.error('[UserPicker] Search failed:', err);
        setResults([]);
      } finally {
        setIsSearching(false);
      }
    },
    [excludeSelf]
  );

  const handleInputChange = (value: string) => {
    setQuery(value);
    setShowDropdown(true);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      searchUsers(value);
    }, 300);
  };

  const handleSelect = (user: UserResult) => {
    if (selectedUserIds.includes(user.id)) return; // Already selected
    if (selectedUserIds.length >= maxUsers) return; // At max

    // Store user data for display
    setSelectedUsers((prev) => new Map(prev).set(user.id, user));

    // Notify parent
    onSelectionChange([...selectedUserIds, user.id]);

    // Clear search
    setQuery('');
    setResults([]);
    inputRef.current?.focus();
  };

  const handleRemove = (userId: string) => {
    onSelectionChange(selectedUserIds.filter((id) => id !== userId));
  };

  const getInitials = (name: string | null) => {
    if (!name) return '?';
    return name
      .split(' ')
      .map((w) => w[0])
      .join('')
      .slice(0, 2)
      .toUpperCase();
  };

  // Filter out already-selected users from search results
  const filteredResults = results.filter((u) => !selectedUserIds.includes(u.id));

  return (
    <div ref={containerRef} className={cn('relative w-full', className)}>
      {/* Selected users as badges */}
      {selectedUserIds.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-2">
          {selectedUserIds.map((id) => {
            const user = selectedUsers.get(id);
            return (
              <Badge
                key={id}
                variant="secondary"
                className="flex items-center gap-1.5 pl-1 pr-1.5 py-0.5 text-sm"
              >
                <Avatar className="h-4 w-4">
                  {user?.image && <AvatarImage src={user.image} alt={user?.name || ''} />}
                  <AvatarFallback className="text-[8px]">
                    {getInitials(user?.name ?? null)}
                  </AvatarFallback>
                </Avatar>
                <span className="max-w-30 truncate">
                  {user?.name || user?.email || id.slice(0, 8)}
                </span>
                <button
                  type="button"
                  onClick={() => handleRemove(id)}
                  className="ml-0.5 rounded-full hover:bg-destructive/20 p-0.5 transition-colors"
                  aria-label={`Remove ${user?.name || 'user'}`}
                >
                  <FiX className="h-3 w-3" />
                </button>
              </Badge>
            );
          })}
        </div>
      )}

      {/* Search input */}
      <div className="relative">
        <FiSearch className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleInputChange(e.target.value)}
          onFocus={() => {
            if (query.length >= 2) setShowDropdown(true);
          }}
          placeholder={
            selectedUserIds.length >= maxUsers
              ? `Max ${maxUsers} users reached`
              : placeholder
          }
          disabled={selectedUserIds.length >= maxUsers}
          className="pl-8 h-9 text-sm"
        />
        {isSearching && (
          <Spinner className="absolute right-2.5 top-1/2 -translate-y-1/2 h-4 w-4" />
        )}
      </div>

      {/* Dropdown results */}
      {showDropdown && query.length >= 2 && (
        <div className="absolute z-50 mt-1 w-full rounded-md border bg-popover shadow-md max-h-48 overflow-y-auto">
          {isSearching && filteredResults.length === 0 && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              Searching…
            </div>
          )}
          {!isSearching && filteredResults.length === 0 && query.length >= 2 && (
            <div className="p-3 text-center text-sm text-muted-foreground">
              No users found
            </div>
          )}
          {filteredResults.map((user) => (
            <button
              key={user.id}
              type="button"
              onClick={() => handleSelect(user)}
              className="flex items-center gap-2.5 w-full px-3 py-2 text-left hover:bg-accent transition-colors text-sm"
            >
              <Avatar className="h-7 w-7 shrink-0">
                {user.image && <AvatarImage src={user.image} alt={user.name || ''} />}
                <AvatarFallback className="text-[10px]">
                  {getInitials(user.name)}
                </AvatarFallback>
              </Avatar>
              <div className="flex-1 min-w-0">
                <div className="font-medium truncate">{user.name || 'Unknown'}</div>
                {user.email && (
                  <div className="text-xs text-muted-foreground truncate">{user.email}</div>
                )}
              </div>
              <FiUserPlus className="h-4 w-4 text-muted-foreground shrink-0" />
            </button>
          ))}
        </div>
      )}

      {/* Helper text */}
      {selectedUserIds.length > 0 && (
        <p className="text-xs text-muted-foreground mt-1.5">
          {selectedUserIds.length} user{selectedUserIds.length !== 1 ? 's' : ''} selected
          {maxUsers < 200 ? ` (max ${maxUsers})` : ''}
        </p>
      )}
    </div>
  );
}
