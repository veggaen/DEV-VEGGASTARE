'use client';

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useDropzone } from 'react-dropzone';
import { useEdgeStore } from '@/lib/edgestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import { FiX, FiSearch, FiUsers, FiGlobe, FiLock, FiMessageCircle, FiImage, FiBarChart2, FiPlus, FiTrash2 } from 'react-icons/fi';
import { Switch } from '@/components/ui/switch';
import Spinner from '../spinner';

// Types
interface SearchUser {
  id: string;
  name: string;
  email: string;
  image: string;
  role: string;
}

type ConversationType = 'PUBLIC_THREAD' | 'PRIVATE_DM' | 'GROUP' | 'RESTRICTED';
type ConversationVisibility = 'PUBLIC' | 'PARTICIPANTS' | 'ROLE_BASED' | 'CUSTOM';
type ReplyPermission = 'EVERYONE' | 'PARTICIPANTS' | 'MENTIONED' | 'MODS_ONLY' | 'CREATOR_ONLY';

const CONVERSATION_TYPES: { value: ConversationType; label: string; icon: React.ReactNode; description: string }[] = [
  { value: 'PRIVATE_DM', label: 'Private DM', icon: <FiMessageCircle className="h-4 w-4" />, description: 'Direct message with one person' },
  { value: 'GROUP', label: 'Group Chat', icon: <FiUsers className="h-4 w-4" />, description: 'Private chat with multiple people' },
  { value: 'PUBLIC_THREAD', label: 'Public Thread', icon: <FiGlobe className="h-4 w-4" />, description: 'Anyone can view and reply' },
  { value: 'RESTRICTED', label: 'Restricted', icon: <FiLock className="h-4 w-4" />, description: 'Limited to specific roles or users' },
];

const VISIBILITY_OPTIONS: { value: ConversationVisibility; label: string }[] = [
  { value: 'PUBLIC', label: 'Public - Anyone can read' },
  { value: 'PARTICIPANTS', label: 'Participants only' },
  { value: 'ROLE_BASED', label: 'Role-based access' },
  { value: 'CUSTOM', label: 'Custom viewer list' },
];

const REPLY_PERMISSION_OPTIONS: { value: ReplyPermission; label: string }[] = [
  { value: 'EVERYONE', label: 'Everyone who can view' },
  { value: 'PARTICIPANTS', label: 'Participants only' },
  { value: 'MENTIONED', label: 'Mentioned users only' },
  { value: 'MODS_ONLY', label: 'Moderators only' },
  { value: 'CREATOR_ONLY', label: 'Creator only (Announcements)' },
];

export default function ConversationCreateForm() {
  const router = useRouter();
  const { edgestore } = useEdgeStore();

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [conversationType, setConversationType] = useState<ConversationType>('PRIVATE_DM');
  const [visibility, setVisibility] = useState<ConversationVisibility>('PARTICIPANTS');
  const [replyPermission, setReplyPermission] = useState<ReplyPermission>('PARTICIPANTS');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Participant search state
  const [participants, setParticipants] = useState<SearchUser[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<SearchUser[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  // Initial message state (required for DM/Group)
  const [initialMessage, setInitialMessage] = useState('');

  // Image state for initial message
  const [image, setImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const messageTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Poll state (available for all conversation types)
  const [includePoll, setIncludePoll] = useState(false);
  const [pollQuestion, setPollQuestion] = useState('');
  const [pollOptions, setPollOptions] = useState<string[]>(['', '']);
  const [pollAllowMultiple, setPollAllowMultiple] = useState(false);
  const [pollIsAnonymous, setPollIsAnonymous] = useState(false);
  const [pollExpiresIn, setPollExpiresIn] = useState<string>(''); // e.g., '1d', '7d', 'never'

  // Form state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState('');

  // Poll option helpers
  const addPollOption = () => {
    if (pollOptions.length < 10) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const removePollOption = (index: number) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const updatePollOption = (index: number, value: string) => {
    const updated = [...pollOptions];
    updated[index] = value;
    setPollOptions(updated);
  };

  // Debounced search
  useEffect(() => {
    if (searchQuery.length < 1) {
      setSearchResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setIsSearching(true);
      try {
        const res = await fetch(`/api/users/search?q=${encodeURIComponent(searchQuery)}&limit=8`);
        const data = await res.json();
        // Filter out already added participants
        const filtered = (data.users || []).filter(
          (u: SearchUser) => !participants.some(p => p.id === u.id)
        );
        setSearchResults(filtered);
      } catch (err) {
        console.error('Search error:', err);
      } finally {
        setIsSearching(false);
      }
    }, 200);

    return () => clearTimeout(timer);
  }, [searchQuery, participants]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Update defaults when type changes
  useEffect(() => {
    if (conversationType === 'PUBLIC_THREAD') {
      setVisibility('PUBLIC');
      setReplyPermission('EVERYONE');
    } else if (conversationType === 'PRIVATE_DM' || conversationType === 'GROUP') {
      setVisibility('PARTICIPANTS');
      setReplyPermission('PARTICIPANTS');
    } else if (conversationType === 'RESTRICTED') {
      setVisibility('ROLE_BASED');
      setReplyPermission('PARTICIPANTS');
    }
  }, [conversationType]);

  const addParticipant = useCallback((user: SearchUser) => {
    // For DM, only allow 1 participant (replace if already exists)
    if (conversationType === 'PRIVATE_DM') {
      setParticipants([user]);
    } else {
      setParticipants(prev => [...prev, user]);
    }
    setSearchQuery('');
    setSearchResults([]);
    setShowDropdown(false);
  }, [conversationType]);

  const removeParticipant = useCallback((userId: string) => {
    setParticipants(prev => prev.filter(p => p.id !== userId));
  }, []);

  const addTag = useCallback(() => {
    const trimmed = tagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      setTags(prev => [...prev, trimmed]);
      setTagInput('');
    }
  }, [tagInput, tags]);

  const removeTag = useCallback((tag: string) => {
    setTags(prev => prev.filter(t => t !== tag));
  }, []);

  // Image handling for initial message
  const handleImageDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      const file = acceptedFiles[0];
      setImage(file);
      setImagePreview(URL.createObjectURL(file));
    }
  }, []);

  const handleRemoveImage = useCallback(() => {
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
    }
    setImage(null);
    setImagePreview(null);
  }, [imagePreview]);

  // Handle paste for Ctrl+V image paste
  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          setImage(file);
          setImagePreview(URL.createObjectURL(file));
        }
        break;
      }
    }
  }, []);

  // Dropzone configuration
  const { getRootProps, getInputProps, isDragActive, open: openFilePicker } = useDropzone({
    onDrop: handleImageDrop,
    accept: { 'image/*': [] },
    multiple: false,
    noClick: true, // We'll handle click separately
    noKeyboard: true,
  });

  // Generate a default title based on conversation type, participants, and initial message
  const generateDefaultTitle = useCallback(() => {
    // If there's an initial message, use the first ~50 chars as title
    if (initialMessage.trim()) {
      const msgPreview = initialMessage.trim().slice(0, 50);
      return msgPreview.length < initialMessage.trim().length ? `${msgPreview}...` : msgPreview;
    }
    // If there's a poll question, use it as the title
    if (includePoll && pollQuestion.trim()) {
      const pollPreview = pollQuestion.trim().slice(0, 50);
      return pollPreview.length < pollQuestion.trim().length ? `${pollPreview}...` : pollPreview;
    }
    // Otherwise fallback to participant-based titles
    if (conversationType === 'PRIVATE_DM' && participants.length > 0) {
      return `Chat with ${participants.map(p => p.name).join(', ')}`;
    }
    if (conversationType === 'GROUP' && participants.length > 0) {
      const names = participants.slice(0, 3).map(p => p.name).join(', ');
      return participants.length > 3 ? `${names} +${participants.length - 3}` : names;
    }
    if (conversationType === 'PUBLIC_THREAD') {
      return 'New Thread';
    }
    return `New ${conversationType.replace('_', ' ').toLowerCase()}`;
  }, [conversationType, participants, initialMessage, includePoll, pollQuestion]);

  // Whether initial message is required for this conversation type
  const requiresInitialMessage = conversationType === 'PRIVATE_DM' || conversationType === 'GROUP';
  // Show message input for all types (required for DM/Group, optional for others)
  const showInitialMessage = true;

  const handleSubmit = async () => {
    setError('');

    // For DM and Group, require at least 1 participant (besides self)
    if ((conversationType === 'PRIVATE_DM' || conversationType === 'GROUP') && participants.length < 1) {
      setError('Please add at least one participant');
      return;
    }

    // For DM and Group, require an initial message (text or image)
    if (requiresInitialMessage && !initialMessage.trim() && !image) {
      setError('Please write a message or add an image to start the conversation');
      return;
    }

    // Use provided title or generate one
    const finalTitle = title.trim() || generateDefaultTitle();

    setIsSubmitting(true);
    try {
      // Upload image if present
      let uploadedImageUrl: string | undefined;
      if (image) {
        setIsUploadingImage(true);
        try {
          const res = await edgestore.myPublicImages.upload({ file: image });
          uploadedImageUrl = res.url;
        } catch (uploadErr) {
          console.error('Image upload failed:', uploadErr);
          setError('Failed to upload image. Please try again.');
          setIsSubmitting(false);
          setIsUploadingImage(false);
          return;
        }
        setIsUploadingImage(false);
      }

      const res = await fetch('/api/conversations', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: finalTitle,
          description: description.trim() || undefined,
          participants: participants.map(p => p.id),
          type: conversationType,
          visibility,
          replyPermission,
          tags,
          // Send initial message for any conversation type if provided
          initialMessage: initialMessage.trim() || undefined,
          initialImageUrl: uploadedImageUrl,
          // Send poll question for title fallback if no title/message provided
          pollQuestion: includePoll && pollQuestion.trim() ? pollQuestion.trim() : undefined,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to create conversation');
      }

      const data = await res.json();
      const conversationId = data.id;

      // Create poll if included (available for all conversation types)
      if (includePoll && pollQuestion.trim()) {
        const validOptions = pollOptions.filter(opt => opt.trim());
        if (validOptions.length >= 2) {
          // Calculate expiration date
          let expiresAt: string | undefined;
          if (pollExpiresIn) {
            const now = new Date();
            const expiresDate = new Date(now);
            switch (pollExpiresIn) {
              case '1h': expiresDate.setHours(now.getHours() + 1); break;
              case '6h': expiresDate.setHours(now.getHours() + 6); break;
              case '1d': expiresDate.setDate(now.getDate() + 1); break;
              case '3d': expiresDate.setDate(now.getDate() + 3); break;
              case '7d': expiresDate.setDate(now.getDate() + 7); break;
            }
            expiresAt = expiresDate.toISOString();
          }

          try {
            await fetch('/api/polls', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                conversationId,
                question: pollQuestion.trim(),
                options: validOptions,
                allowMultiple: pollAllowMultiple,
                isAnonymous: pollIsAnonymous,
                expiresAt,
              }),
            });
          } catch (pollErr) {
            console.error('Failed to create poll:', pollErr);
            // Don't fail the whole creation, just log the error
          }
        }
      }

      router.push(`/conversations/${conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create conversation');
    } finally {
      setIsSubmitting(false);
      setIsUploadingImage(false);
    }
  };

  const showAdvancedOptions = conversationType === 'RESTRICTED' || conversationType === 'PUBLIC_THREAD';

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-6">
      <div className="space-y-2">
        <h1 className="text-2xl font-bold">New Conversation</h1>
        <p className="text-sm text-muted-foreground">
          Create a conversation, group chat, or public thread
        </p>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      {/* Conversation Type */}
      <div className="space-y-3">
        <Label>Type</Label>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {CONVERSATION_TYPES.map(type => (
            <button
              key={type.value}
              type="button"
              onClick={() => setConversationType(type.value)}
              className={`flex flex-col items-center gap-1 p-3 rounded-lg border transition-colors ${
                conversationType === type.value
                  ? 'border-primary bg-primary/5'
                  : 'border-border hover:bg-muted'
              }`}
            >
              {type.icon}
              <span className="text-sm font-medium">{type.label}</span>
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground">
          {CONVERSATION_TYPES.find(t => t.value === conversationType)?.description}
        </p>
      </div>

      {/* Title */}
      <div className="space-y-2">
        <div className="flex items-center gap-2">
          <Label htmlFor="title">Title</Label>
          <span className="text-xs text-muted-foreground">(optional - auto-generated if empty)</span>
        </div>
        <Input
          id="title"
          value={title}
          onChange={e => setTitle(e.target.value)}
          placeholder="Give your conversation a name..."
          maxLength={100}
          autoComplete="off"
        />
      </div>

      {/* Description - for public threads */}
      {conversationType === 'PUBLIC_THREAD' && (
        <div className="space-y-2">
          <Label htmlFor="description">Description</Label>
          <Input
            id="description"
            value={description}
            onChange={e => setDescription(e.target.value)}
            placeholder="What's this thread about?"
            maxLength={280}
          />
        </div>
      )}

      {/* Participant Search */}
      {conversationType !== 'PUBLIC_THREAD' && (
        <div className="space-y-2">
          <Label>
            {conversationType === 'PRIVATE_DM' ? 'Participant' : 'Participants'}
          </Label>
          <div ref={searchRef} className="relative">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                placeholder="Search users by name..."
                className="pl-9"
                autoComplete="off"
                autoCorrect="off"
                autoCapitalize="off"
                spellCheck={false}
                data-form-type="other"
                data-lpignore="true"
              />
              {isSearching && (
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <Spinner />
                </div>
              )}
            </div>

            {/* Search Results Dropdown */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-popover border rounded-md shadow-lg max-h-60 overflow-auto">
                {searchResults.map(user => (
                  <button
                    key={user.id}
                    type="button"
                    onClick={() => addParticipant(user)}
                    className="w-full flex items-center gap-3 p-2 hover:bg-muted transition-colors text-left"
                  >
                    <Avatar className="h-8 w-8">
                      <AvatarImage src={user.image} alt={user.name} />
                      <AvatarFallback>{user.name[0]?.toUpperCase()}</AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{user.name}</p>
                      <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Selected Participants */}
          {participants.length > 0 && (
            <div className="flex flex-wrap gap-2 mt-2">
              {participants.map(user => (
                <Badge key={user.id} variant="secondary" className="flex items-center gap-1 pr-1">
                  <Avatar className="h-5 w-5">
                    <AvatarImage src={user.image} alt={user.name} />
                    <AvatarFallback className="text-[10px]">{user.name[0]}</AvatarFallback>
                  </Avatar>
                  <span className="max-w-[100px] truncate">{user.name}</span>
                  <button
                    type="button"
                    onClick={() => removeParticipant(user.id)}
                    className="ml-1 rounded-full p-0.5 hover:bg-muted-foreground/20"
                  >
                    <FiX className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Initial Message - required for DM/Group, optional for others */}
      {showInitialMessage && (
        <div className="space-y-2">
          <Label htmlFor="initialMessage">
            {requiresInitialMessage ? (
              <>Your message <span className="text-destructive">*</span></>
            ) : (
              <>First message <span className="text-muted-foreground text-xs">(optional)</span></>
            )}
          </Label>
          <div
            {...getRootProps()}
            className={`relative rounded-md border bg-background transition-colors ${
              isDragActive ? 'border-primary border-2 bg-primary/5' : 'border-input'
            }`}
          >
            <input {...getInputProps()} />
            {isDragActive && (
              <div className="absolute inset-0 flex items-center justify-center bg-primary/10 rounded-md z-10">
                <p className="text-sm font-medium text-primary">Drop image here...</p>
              </div>
            )}
            <textarea
              ref={messageTextareaRef}
              id="initialMessage"
              value={initialMessage}
              onChange={e => setInitialMessage(e.target.value)}
              onPaste={handlePaste}
              placeholder="Write your first message... (paste or drag an image)"
              className="w-full min-h-[100px] p-3 rounded-md bg-transparent resize-y text-sm focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2"
              maxLength={2000}
            />

            {/* Image Preview */}
            {imagePreview && (
              <div className="px-3 pb-3">
                <div className="relative inline-block">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="max-h-32 rounded-md border"
                  />
                  <button
                    type="button"
                    onClick={handleRemoveImage}
                    className="absolute -top-2 -right-2 p-1 rounded-full bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-sm"
                  >
                    <FiX className="h-3 w-3" />
                  </button>
                </div>
              </div>
            )}

            {/* Image Upload Button */}
            <div className="flex items-center gap-2 px-3 pb-2 border-t">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={openFilePicker}
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
              >
                <FiImage className="h-4 w-4 mr-1" />
                {image ? 'Change image' : 'Add image'}
              </Button>
              {isUploadingImage && (
                <span className="text-xs text-muted-foreground flex items-center gap-1">
                  <Spinner /> Uploading...
                </span>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground">
            This will be the first message in the conversation
            {!title.trim() && initialMessage.trim() && ' and will be used as the title'}
          </p>
        </div>
      )}

      {/* Tags - for public threads */}
      {conversationType === 'PUBLIC_THREAD' && (
        <div className="space-y-2">
          <Label>Tags</Label>
          <div className="flex gap-2">
            <Input
              value={tagInput}
              onChange={e => setTagInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addTag())}
              placeholder="Add tags..."
              className="flex-1"
            />
            <Button type="button" variant="outline" onClick={addTag}>
              Add
            </Button>
          </div>
          {tags.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {tags.map(tag => (
                <Badge key={tag} variant="outline" className="flex items-center gap-1">
                  #{tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    className="ml-0.5 rounded-full hover:bg-muted-foreground/20"
                  >
                    <FiX className="h-3 w-3" />
                  </button>
                </Badge>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Poll Creation - available for all conversation types */}
      <div className="space-y-4 pt-4 border-t">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FiBarChart2 className="h-4 w-4 text-muted-foreground" />
              <Label htmlFor="includePoll" className="cursor-pointer">Add a poll</Label>
            </div>
            <Switch
              id="includePoll"
              checked={includePoll}
              onCheckedChange={setIncludePoll}
            />
          </div>

          {includePoll && (
            <div className="space-y-4 pl-6 border-l-2 border-primary/20">
              {/* Poll Question */}
              <div className="space-y-2">
                <Label htmlFor="pollQuestion">Poll question</Label>
                <Input
                  id="pollQuestion"
                  value={pollQuestion}
                  onChange={(e) => setPollQuestion(e.target.value)}
                  placeholder="What do you want to ask?"
                  maxLength={280}
                />
              </div>

              {/* Poll Options */}
              <div className="space-y-2">
                <Label>Options</Label>
                <div className="space-y-2">
                  {pollOptions.map((option, index) => (
                    <div key={index} className="flex gap-2">
                      <Input
                        value={option}
                        onChange={(e) => updatePollOption(index, e.target.value)}
                        placeholder={`Option ${index + 1}`}
                        maxLength={100}
                      />
                      {pollOptions.length > 2 && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removePollOption(index)}
                          className="flex-shrink-0 text-muted-foreground hover:text-destructive"
                        >
                          <FiTrash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
                {pollOptions.length < 10 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addPollOption}
                    className="mt-2"
                  >
                    <FiPlus className="h-4 w-4 mr-1" />
                    Add option
                  </Button>
                )}
              </div>

              {/* Poll Settings */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center justify-between">
                  <Label htmlFor="pollMultiple" className="cursor-pointer text-sm">
                    Allow multiple choices
                  </Label>
                  <Switch
                    id="pollMultiple"
                    checked={pollAllowMultiple}
                    onCheckedChange={setPollAllowMultiple}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="pollAnonymous" className="cursor-pointer text-sm">
                    Anonymous voting
                  </Label>
                  <Switch
                    id="pollAnonymous"
                    checked={pollIsAnonymous}
                    onCheckedChange={setPollIsAnonymous}
                  />
                </div>
              </div>

              {/* Poll Duration */}
              <div className="space-y-2">
                <Label>Poll duration</Label>
                <Select value={pollExpiresIn || 'never'} onValueChange={(v) => setPollExpiresIn(v === 'never' ? '' : v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="No expiration" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="never">No expiration</SelectItem>
                    <SelectItem value="1h">1 hour</SelectItem>
                    <SelectItem value="6h">6 hours</SelectItem>
                    <SelectItem value="1d">1 day</SelectItem>
                    <SelectItem value="3d">3 days</SelectItem>
                    <SelectItem value="7d">1 week</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
        </div>

      {/* Advanced Options */}
      {showAdvancedOptions && (
        <div className="space-y-4 pt-4 border-t">
          <h3 className="text-sm font-medium text-muted-foreground">Advanced Options</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select value={visibility} onValueChange={(v) => setVisibility(v as ConversationVisibility)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {VISIBILITY_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Who can reply</Label>
              <Select value={replyPermission} onValueChange={(v) => setReplyPermission(v as ReplyPermission)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REPLY_PERMISSION_OPTIONS.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>
                      {opt.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      )}

      {/* Submit */}
      <div className="flex justify-end gap-2 pt-4">
        <Button
          type="button"
          variant="outline"
          onClick={() => router.back()}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          disabled={isSubmitting}
        >
          {isSubmitting ? <Spinner /> : 'Create Conversation'}
        </Button>
      </div>
    </div>
  );
}
