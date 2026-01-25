'use client';

import React, { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import Spinner from '@/components/uicustom/spinner';
import { FiArrowLeft, FiSave, FiX } from 'react-icons/fi';

interface EditConversationPageProps {
  params: Promise<{ id: string }>;
}

interface Conversation {
  id: string;
  title: string | null;
  description: string | null;
  type: 'PUBLIC_THREAD' | 'PRIVATE_DM' | 'GROUP' | 'RESTRICTED';
  visibility: string;
  replyPermission: string;
  tags: string[];
  isPinned: boolean;
  isLocked: boolean;
}

const VISIBILITY_OPTIONS = [
  { value: 'PUBLIC', label: 'Public' },
  { value: 'PARTICIPANTS', label: 'Participants Only' },
  { value: 'ROLE_BASED', label: 'Role Based' },
  { value: 'CUSTOM', label: 'Custom' },
];

const REPLY_PERMISSION_OPTIONS = [
  { value: 'EVERYONE', label: 'Everyone' },
  { value: 'PARTICIPANTS', label: 'Participants Only' },
  { value: 'MENTIONED', label: 'Mentioned Only' },
  { value: 'MODS_ONLY', label: 'Mods Only' },
  { value: 'CREATOR_ONLY', label: 'Creator Only' },
];

const EditConversationPage: React.FC<EditConversationPageProps> = ({ params }) => {
  const { id: conversationId } = use(params);
  const router = useRouter();

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [conversation, setConversation] = useState<Conversation | null>(null);

  // Form state
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [visibility, setVisibility] = useState('PARTICIPANTS');
  const [replyPermission, setReplyPermission] = useState('PARTICIPANTS');
  const [tags, setTags] = useState<string[]>([]);
  const [tagInput, setTagInput] = useState('');

  // Fetch conversation data
  useEffect(() => {
    const fetchConversation = async () => {
      try {
        const res = await fetch(`/api/conversations/${conversationId}`);
        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.message || 'Failed to fetch conversation');
        }
        const data: Conversation = await res.json();
        setConversation(data);
        setTitle(data.title || '');
        setDescription(data.description || '');
        setVisibility(data.visibility);
        setReplyPermission(data.replyPermission);
        setTags(data.tags || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation');
      } finally {
        setIsLoading(false);
      }
    };
    fetchConversation();
  }, [conversationId]);

  // Handle save
  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSaving(true);
    setError(null);

    try {
      const res = await fetch(`/api/conversations/${conversationId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim() || null,
          description: description.trim() || null,
          visibility,
          replyPermission,
          tags,
        }),
      });

      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Failed to save changes');
      }

      router.push(`/conversations/${conversationId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save changes');
      setIsSaving(false);
    }
  };

  const addTag = () => {
    const tag = tagInput.trim().toLowerCase().replace(/[^a-z0-9-_]/g, '');
    if (tag && !tags.includes(tag) && tags.length < 10) {
      setTags([...tags, tag]);
      setTagInput('');
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter(t => t !== tag));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Spinner />
      </div>
    );
  }

  if (error && !conversation) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <p className="text-destructive">{error}</p>
        <Link href="/conversations">
          <Button variant="outline">
            <FiArrowLeft className="h-4 w-4 mr-2" />
            Back to Conversations
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="flex items-center gap-4">
        <Link href={`/conversations/${conversationId}`}>
          <Button variant="ghost" size="icon">
            <FiArrowLeft className="h-5 w-5" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-bold">Edit Conversation</h1>
          <p className="text-sm text-muted-foreground">
            Update conversation settings
          </p>
        </div>
      </div>

      {error && (
        <div className="p-3 rounded-md bg-destructive/10 text-destructive text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSave} className="space-y-6">
        {/* Title */}
        <div className="space-y-2">
          <Label htmlFor="title">Title</Label>
          <Input
            id="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="Conversation title"
            maxLength={200}
          />
        </div>

        {/* Description - only for PUBLIC_THREAD */}
        {conversation?.type === 'PUBLIC_THREAD' && (
          <div className="space-y-2">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Brief description of the thread..."
              rows={3}
              maxLength={500}
            />
          </div>
        )}

        {/* Visibility */}
        <div className="space-y-2">
          <Label>Visibility</Label>
          <Select value={visibility} onValueChange={setVisibility}>
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

        {/* Reply Permission */}
        <div className="space-y-2">
          <Label>Who can reply</Label>
          <Select value={replyPermission} onValueChange={setReplyPermission}>
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

        {/* Tags - only for PUBLIC_THREAD */}
        {conversation?.type === 'PUBLIC_THREAD' && (
          <div className="space-y-2">
            <Label>Tags</Label>
            <div className="flex gap-2">
              <Input
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                placeholder="Add tags..."
                className="flex-1"
              />
              <Button type="button" variant="outline" onClick={addTag}>
                Add
              </Button>
            </div>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {tags.map(tag => (
                  <Badge key={tag} variant="secondary" className="flex items-center gap-1">
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

        {/* Actions */}
        <div className="flex items-center justify-end gap-3 pt-4 border-t">
          <Link href={`/conversations/${conversationId}`}>
            <Button type="button" variant="outline">
              Cancel
            </Button>
          </Link>
          <Button type="submit" disabled={isSaving}>
            {isSaving ? (
              <>
                <Spinner /> Saving...
              </>
            ) : (
              <>
                <FiSave className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>
      </form>
    </div>
  );
};

export default EditConversationPage;

