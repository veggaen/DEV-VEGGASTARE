"use client";

import { useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { FiSend, FiPlus, FiX, FiZap, FiCheck, FiAlertCircle } from "react-icons/fi";
import { cn } from "@/lib/utils";

export default function SystemUpdatesPage() {
  const { data: session } = useSession();
  const router = useRouter();
  
  const [title, setTitle] = useState("");
  const [changes, setChanges] = useState<string[]>([""]);
  const [tags, setTags] = useState<string[]>(["update", "changelog"]);
  const [newTag, setNewTag] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [result, setResult] = useState<{
    success: boolean;
    message: string;
    conversationId?: string;
  } | null>(null);

  const addChange = () => {
    setChanges([...changes, ""]);
  };

  const removeChange = (index: number) => {
    if (changes.length > 1) {
      setChanges(changes.filter((_, i) => i !== index));
    }
  };

  const updateChange = (index: number, value: string) => {
    const newChanges = [...changes];
    newChanges[index] = value;
    setChanges(newChanges);
  };

  const addTag = () => {
    if (newTag && !tags.includes(newTag.toLowerCase())) {
      setTags([...tags, newTag.toLowerCase()]);
      setNewTag("");
    }
  };

  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setResult(null);

    try {
      const response = await fetch("/api/system/updates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          changes: changes.filter((c) => c.trim() !== ""),
          tags,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: true,
          message: data.message,
          conversationId: data.conversationId,
        });
        // Reset form
        setTitle("");
        setChanges([""]);
      } else {
        setResult({
          success: false,
          message: data.error || "Failed to post update",
        });
      }
    } catch (error) {
      setResult({
        success: false,
        message: "An error occurred while posting the update",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Check if user is admin
  if (session?.user?.role !== "OWNER" && session?.user?.role !== "ADMIN") {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] text-center">
        <FiAlertCircle className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-foreground mb-2">
          Access Denied
        </h1>
        <p className="text-muted-foreground">
          You need admin privileges to post system updates.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
          <FiZap className="text-brand-accent" />
          Post System Update
        </h1>
        <p className="text-muted-foreground mt-2">
          Create a new update pulse as VeggaSystem. All users will be notified.
        </p>
      </div>

      {result && (
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "mb-6 p-4 rounded-lg border flex items-start gap-3",
            result.success
              ? "bg-brand-accent/10 border-brand-accent"
              : "bg-red-50 dark:bg-red-950/30 border-red-200 dark:border-red-800"
          )}
        >
          {result.success ? (
            <FiCheck className="w-5 h-5 text-brand-accent mt-0.5" />
          ) : (
            <FiAlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
          )}
          <div>
            <p className={cn(
              "font-medium",
              result.success ? "text-brand-accent-hover dark:text-brand-accent-light" : "text-red-700 dark:text-red-300"
            )}>
              {result.message}
            </p>
            {result.conversationId && (
              <button
                onClick={() => router.push(`/feed/${result.conversationId}`)}
                className="text-sm text-brand-accent-hover dark:text-brand-accent-light hover:underline mt-1"
              >
                View the pulse →
              </button>
            )}
          </div>
        </motion.div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-foreground/85 mb-2">
            Update Title
          </label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="e.g., Notification System Launch 🔔"
            className={cn(
              "w-full px-4 py-3 rounded-lg",
              "bg-card",
              "border border-border",
              "text-foreground",
              "placeholder:text-muted-foreground/80",
              "focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
            )}
            required
          />
        </div>

        {/* Changes */}
        <div>
          <label className="block text-sm font-medium text-foreground/85 mb-2">
            What&apos;s New (Changelog Items)
          </label>
          <div className="space-y-3">
            {changes.map((change, index) => (
              <div key={index} className="flex gap-2">
                <input
                  type="text"
                  value={change}
                  onChange={(e) => updateChange(index, e.target.value)}
                  placeholder={`Change #${index + 1}...`}
                  className={cn(
                    "flex-1 px-4 py-2.5 rounded-lg",
                    "bg-card",
                    "border border-border",
                    "text-foreground",
                    "placeholder:text-muted-foreground/80",
                    "focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
                  )}
                />
                {changes.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeChange(index)}
                    className="p-2.5 text-muted-foreground hover:text-red-500 transition-colors"
                  >
                    <FiX className="w-5 h-5" />
                  </button>
                )}
              </div>
            ))}
          </div>
          <button
            type="button"
            onClick={addChange}
            className="mt-3 flex items-center gap-2 text-sm text-brand-accent-hover dark:text-brand-accent-light hover:text-brand-accent-hover hover:dark:text-brand-accent-light"
          >
            <FiPlus className="w-4 h-4" />
            Add another change
          </button>
        </div>

        {/* Tags */}
        <div>
          <label className="block text-sm font-medium text-foreground/85 mb-2">
            Tags
          </label>
          <div className="flex flex-wrap gap-2 mb-3">
            {tags.map((tag) => (
              <span
                key={tag}
                className={cn(
                  "px-3 py-1 rounded-full text-sm",
                  "bg-brand-accent/15",
                  "text-brand-accent-hover dark:text-brand-accent-light",
                  "flex items-center gap-1.5"
                )}
              >
                #{tag}
                <button
                  type="button"
                  onClick={() => removeTag(tag)}
                  className="hover:text-red-500 transition-colors"
                >
                  <FiX className="w-3.5 h-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="flex gap-2">
            <input
              type="text"
              value={newTag}
              onChange={(e) => setNewTag(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addTag())}
              placeholder="Add a tag..."
              className={cn(
                "flex-1 px-4 py-2 rounded-lg",
                "bg-card",
                "border border-border",
                "text-foreground",
                "placeholder:text-muted-foreground/80",
                "focus:outline-none focus:ring-2 focus:ring-brand-accent/50"
              )}
            />
            <button
              type="button"
              onClick={addTag}
              className={cn(
                "px-4 py-2 rounded-lg",
                "bg-muted",
                "text-foreground/85",
                "hover:bg-muted",
                "transition-colors"
              )}
            >
              Add
            </button>
          </div>
        </div>

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting || !title.trim() || changes.every((c) => !c.trim())}
          className={cn(
            "w-full py-3 px-6 rounded-lg",
            "bg-brand-accent hover:bg-brand-accent-hover",
            "text-white font-medium",
            "flex items-center justify-center gap-2",
            "transition-colors",
            "disabled:opacity-50 disabled:cursor-not-allowed"
          )}
        >
          {isSubmitting ? (
            <>
              <span className="animate-spin">⟳</span>
              Posting...
            </>
          ) : (
            <>
              <FiSend className="w-4 h-4" />
              Post as VeggaSystem
            </>
          )}
        </button>
      </form>
    </div>
  );
}
