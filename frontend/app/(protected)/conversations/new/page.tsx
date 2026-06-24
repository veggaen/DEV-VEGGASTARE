'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, useReducedMotion } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { useCurrentUser } from '@/hooks/use-current-user';
import { 
  FiArrowLeft, FiSearch, FiMessageCircle, FiUsers, 
  FiX, FiCheck, FiPlus
} from 'react-icons/fi';
import Spinner from '@/components/uicustom/spinner';

interface User {
  id: string;
  name: string | null;
  email: string;
  image: string | null;
}

type ConversationType = 'PRIVATE_DM' | 'GROUP';

export default function NewConversationPage() {
  const reduceMotion = useReducedMotion();
  const router = useRouter();
  const currentUser = useCurrentUser();
  
  const [conversationType, setConversationType] = useState<ConversationType>('PRIVATE_DM');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<User[]>([]);
  const [selectedUsers, setSelectedUsers] = useState<User[]>([]);
  const [groupName, setGroupName] = useState('');
  const [initialMessage, setInitialMessage] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  // Search users
  useEffect(() => {
    const searchUsers = async () => {
      if (searchQuery.length < 2) {
        setSearchResults([]);
        return;
      }

      setIsSearching(true);
      try {
        const response = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}`);
        const data = await response.json();
        // Filter out current user and already selected users
        const filtered = (data.users || data || []).filter(
          (u: User) => u.id !== currentUser?.id && !selectedUsers.some(s => s.id === u.id)
        );
        setSearchResults(filtered);
      } catch (error) {
        console.error('Error searching users:', error);
      } finally {
        setIsSearching(false);
      }
    };

    const debounce = setTimeout(searchUsers, 300);
    return () => clearTimeout(debounce);
  }, [searchQuery, currentUser?.id, selectedUsers]);

  const handleSelectUser = (user: User) => {
    if (conversationType === 'PRIVATE_DM') {
      setSelectedUsers([user]);
    } else {
      setSelectedUsers(prev => [...prev, user]);
    }
    setSearchQuery('');
    setSearchResults([]);
  };

  const handleRemoveUser = (userId: string) => {
    setSelectedUsers(prev => prev.filter(u => u.id !== userId));
  };

  const handleCreateConversation = async () => {
    if (selectedUsers.length === 0) return;
    if (conversationType === 'GROUP' && !groupName.trim()) return;

    setIsCreating(true);
    try {
      const response = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: conversationType,
          title: conversationType === 'GROUP' ? groupName : null,
          participants: selectedUsers.map(u => u.id),
          initialMessage: initialMessage.trim() || undefined,
        }),
      });

      const data = await response.json();
      
      if (data.id || data.conversation?.id) {
        router.push(`/conversations/${data.id || data.conversation.id}`);
      } else {
        console.error('Failed to create conversation:', data);
      }
    } catch (error) {
      console.error('Error creating conversation:', error);
    } finally {
      setIsCreating(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Spinner />
      </div>
    );
  }

  return (
    <div className="relative min-h-[calc(100vh-var(--app-header-offset,0px))] overflow-x-hidden">
      {/* Background */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute inset-0 bg-linear-to-b from-black/15 via-transparent to-black/5" />
        <motion.div
          className="absolute -right-20 top-32 h-[480px] w-[480px] rounded-full blur-3xl"
          animate={reduceMotion ? undefined : { x: [0, -10, 0], y: [0, 8, 0], opacity: [0.08, 0.14, 0.08] }}
          transition={{ duration: 14, repeat: Infinity, ease: "easeInOut" }}
          style={{
            background: "radial-gradient(closest-side, rgba(99,102,241,0.12), rgba(168,85,247,0.06), transparent 70%)",
            mixBlendMode: "screen",
          }}
        />
      </div>

      <div className="relative mx-auto w-full max-w-2xl px-6 py-10 lg:py-12">
        <motion.div
          initial={reduceMotion ? undefined : { opacity: 0, y: 14 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: 0.35, ease: "easeOut" }}
        >
          {/* Header */}
          <header className="mb-8">
            <Link
              href="/conversations"
              className="inline-flex items-center gap-2 text-sm text-zinc-500 dark:text-white/50 hover:text-zinc-800 dark:hover:text-white/80 transition-colors mb-4"
            >
              <FiArrowLeft className="h-4 w-4" />
              Back to Messages
            </Link>
            <h1 className="text-3xl font-semibold text-zinc-900 dark:text-white mb-2">New Conversation</h1>
            <p className="text-zinc-500 dark:text-white/60 text-sm">Start a private message or create a group chat</p>
          </header>

          {/* Type Selection */}
          <div className="flex gap-3 mb-6">
            <button
              onClick={() => {
                setConversationType('PRIVATE_DM');
                setSelectedUsers([]);
              }}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl border p-4 transition-all ${
                conversationType === 'PRIVATE_DM'
                  ? 'border-indigo-500/50 bg-indigo-500/10 text-zinc-900 dark:text-white'
                  : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-zinc-500 dark:text-white/60 hover:bg-black/[0.05] dark:hover:bg-white/[0.05]'
              }`}
            >
              <FiMessageCircle className="h-5 w-5" />
              <span className="font-medium">Direct Message</span>
            </button>
            <button
              onClick={() => setConversationType('GROUP')}
              className={`flex-1 flex items-center justify-center gap-2 rounded-xl border p-4 transition-all ${
                conversationType === 'GROUP'
                  ? 'border-indigo-500/50 bg-indigo-500/10 text-zinc-900 dark:text-white'
                  : 'border-black/10 dark:border-white/10 bg-black/[0.02] dark:bg-white/[0.02] text-zinc-500 dark:text-white/60 hover:bg-black/[0.05] dark:hover:bg-white/[0.05]'
              }`}
            >
              <FiUsers className="h-5 w-5" />
              <span className="font-medium">Group Chat</span>
            </button>
          </div>

          {/* Group Name (for groups) */}
          {conversationType === 'GROUP' && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-700 dark:text-white/80 mb-2">Group Name</label>
              <Input
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                placeholder="Enter group name..."
                className="bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/40"
              />
            </div>
          )}

          {/* Selected Users */}
          {selectedUsers.length > 0 && (
            <div className="mb-4">
              <label className="block text-sm font-medium text-zinc-700 dark:text-white/80 mb-2">
                {conversationType === 'PRIVATE_DM' ? 'Recipient' : 'Participants'}
              </label>
              <div className="flex flex-wrap gap-2">
                {selectedUsers.map(user => (
                  <div
                    key={user.id}
                    className="flex items-center gap-2 bg-black/10 dark:bg-white/10 rounded-full pl-1 pr-3 py-1"
                  >
                    <Avatar className="h-6 w-6">
                      <AvatarImage src={user.image || undefined} />
                      <AvatarFallback className="bg-indigo-600 text-white text-xs">
                        {user.name?.[0] || user.email[0]}
                      </AvatarFallback>
                    </Avatar>
                    <span className="text-sm text-zinc-900 dark:text-white">{user.name || user.email}</span>
                    <button
                      onClick={() => handleRemoveUser(user.id)}
                      className="text-zinc-500 dark:text-white/50 hover:text-zinc-800 dark:hover:text-white/80 transition-colors"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* User Search */}
          {(conversationType === 'GROUP' || selectedUsers.length === 0) && (
            <div className="mb-6">
              <label className="block text-sm font-medium text-zinc-700 dark:text-white/80 mb-2">
                {conversationType === 'PRIVATE_DM' ? 'Find someone' : 'Add people'}
              </label>
              <div className="relative">
                <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400 dark:text-white/40" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name or email..."
                  className="pl-10 bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/40"
                />
              </div>

              {/* Search Results */}
              {(searchResults.length > 0 || isSearching) && (
                <div className="mt-2 rounded-xl border border-black/10 dark:border-white/10 bg-white/90 dark:bg-zinc-900/90 overflow-hidden">
                  {isSearching ? (
                    <div className="p-4 text-center text-zinc-500 dark:text-white/50">
                      <Spinner />
                    </div>
                  ) : (
                    searchResults.map(user => (
                      <button
                        key={user.id}
                        onClick={() => handleSelectUser(user)}
                        className="w-full flex items-center gap-3 p-3 hover:bg-black/5 dark:hover:bg-white/5 transition-colors"
                      >
                        <Avatar className="h-10 w-10">
                          <AvatarImage src={user.image || undefined} />
                          <AvatarFallback className="bg-linear-to-br from-sky-500 to-cyan-500 text-white">
                            {user.name?.[0] || user.email[0]}
                          </AvatarFallback>
                        </Avatar>
                        <div className="flex-1 text-left">
                          <div className="font-medium text-zinc-900 dark:text-white">{user.name || 'Unknown'}</div>
                          <div className="text-sm text-zinc-500 dark:text-white/50">{user.email}</div>
                        </div>
                        <FiPlus className="h-5 w-5 text-zinc-400 dark:text-white/40" />
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          {/* Initial Message */}
          <div className="mb-6">
            <label className="block text-sm font-medium text-zinc-700 dark:text-white/80 mb-2">
              Message (optional)
            </label>
            <Textarea
              value={initialMessage}
              onChange={(e) => setInitialMessage(e.target.value)}
              placeholder="Write your first message..."
              rows={3}
              className="bg-black/5 dark:bg-white/5 border-black/10 dark:border-white/10 text-zinc-900 dark:text-white placeholder-zinc-400 dark:placeholder-white/40 resize-none"
            />
          </div>

          {/* Create Button */}
          <Button
            onClick={handleCreateConversation}
            disabled={
              isCreating ||
              selectedUsers.length === 0 ||
              (conversationType === 'GROUP' && !groupName.trim())
            }
            className="w-full h-12 bg-indigo-600 hover:bg-indigo-500 text-white disabled:opacity-50"
          >
            {isCreating ? (
              <>
                <Spinner /> Creating...
              </>
            ) : (
              <>
                <FiCheck className="h-5 w-5 mr-2" />
                Start Conversation
              </>
            )}
          </Button>
        </motion.div>
      </div>
    </div>
  );
}
