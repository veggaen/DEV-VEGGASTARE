"use client";

import { useState, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";
import {
  Plus,
  Trash2,
  GripVertical,
  ChevronDown,
  ChevronUp,
  FileText,
  Loader2,
  Save,
  Eye,
  X,
  Settings,
  Sliders,
  List,
  Type,
  Image as ImageIcon,
  Hash,
  Upload,
  Shapes,
  GitBranch,
  LayoutGrid,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { PollImportModal, ImportedPoll } from "@/components/uicustom/polls/PollImportModal";

// Types
type QuestionType = "SINGLE_CHOICE" | "MULTI_CHOICE" | "SLIDER" | "SCALE" | "TEXT" | "RANKING" | "SHAPE_MATCH" | "UI_ARRANGE" | "NESTED";
type PollType = "SIMPLE" | "SURVEY" | "QUIZ" | "FEEDBACK" | "REACH_ASSESSMENT";

interface SliderConfig {
  minValue: number;
  maxValue: number;
  step: number;
  minLabel: string;
  maxLabel: string;
  stepLabels: string[];
}

interface QuestionOption {
  id: string;
  text: string;
  description?: string;
  value?: number;
  imageUrl?: string;
}

interface PollQuestion {
  id: string;
  order: number;
  type: QuestionType;
  questionText: string;
  description?: string;
  required: boolean;
  allowImages: boolean;
  sliderConfig?: SliderConfig;
  options: QuestionOption[];
}

interface PollBuilderData {
  title: string;
  description: string;
  type: PollType;
  allowPartialSubmission: boolean;
  showProgressBar: boolean;
  randomizeQuestions: boolean;
  expiresAt?: string;
  questions: PollQuestion[];
}

interface PollBuilderProps {
  initialData?: Partial<PollBuilderData>;
  onSave: (data: PollBuilderData) => Promise<void>;
  onPreview?: (data: PollBuilderData) => void;
  className?: string;
}

// Default values
const DEFAULT_SLIDER_CONFIG: SliderConfig = {
  minValue: 1,
  maxValue: 7,
  step: 1,
  minLabel: "Low",
  maxLabel: "High",
  stepLabels: ["A", "B", "C", "D", "E", "F", "G"],
};

const QUESTION_TYPE_ICONS = {
  SINGLE_CHOICE: List,
  MULTI_CHOICE: List,
  SLIDER: Sliders,
  SCALE: Hash,
  TEXT: Type,
  RANKING: GripVertical,
  SHAPE_MATCH: Shapes,
  UI_ARRANGE: LayoutGrid,
  NESTED: GitBranch,
};

// Generate unique IDs
const generateId = () => Math.random().toString(36).substring(2, 15);

export function PollBuilder({
  initialData,
  onSave,
  onPreview,
  className,
}: PollBuilderProps) {
  const [data, setData] = useState<PollBuilderData>({
    title: initialData?.title || "",
    description: initialData?.description || "",
    type: initialData?.type || "SURVEY",
    allowPartialSubmission: initialData?.allowPartialSubmission ?? true,
    showProgressBar: initialData?.showProgressBar ?? true,
    randomizeQuestions: initialData?.randomizeQuestions ?? false,
    expiresAt: initialData?.expiresAt,
    questions: initialData?.questions || [],
  });

  const [isSaving, setIsSaving] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [importText, setImportText] = useState("");
  const [isImporting, setIsImporting] = useState(false);
  const [expandedQuestion, setExpandedQuestion] = useState<string | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  // Add a new question
  const addQuestion = useCallback((type: QuestionType = "SINGLE_CHOICE") => {
    const newQuestion: PollQuestion = {
      id: generateId(),
      order: data.questions.length + 1,
      type,
      questionText: "",
      required: true,
      allowImages: false,
      options:
        type === "SINGLE_CHOICE" || type === "MULTI_CHOICE"
          ? [
              { id: generateId(), text: "" },
              { id: generateId(), text: "" },
            ]
          : [],
      sliderConfig: type === "SLIDER" ? { ...DEFAULT_SLIDER_CONFIG } : undefined,
    };

    setData((prev) => ({
      ...prev,
      questions: [...prev.questions, newQuestion],
    }));
    setExpandedQuestion(newQuestion.id);
  }, [data.questions.length]);

  // Remove a question
  const removeQuestion = useCallback((questionId: string) => {
    setData((prev) => ({
      ...prev,
      questions: prev.questions
        .filter((q) => q.id !== questionId)
        .map((q, i) => ({ ...q, order: i + 1 })),
    }));
  }, []);

  // Handle import from PollImportModal
  const handleImportFromModal = useCallback((imported: ImportedPoll) => {
    // Map imported question types to our types
    const typeMap: Record<string, QuestionType> = {
      "choice": "SINGLE_CHOICE",
      "multi-choice": "MULTI_CHOICE",
      "text": "TEXT",
      "slider": "SLIDER",
      "scale": "SCALE",
      "ranking": "RANKING",
    };

    const newQuestions: PollQuestion[] = imported.questions.map((q, i) => ({
      id: q.id || generateId(),
      order: data.questions.length + i + 1,
      type: typeMap[q.type] || "TEXT",
      questionText: q.text,
      description: q.description,
      required: q.required ?? true,
      allowImages: false,
      options: q.options?.map((opt) => ({
        id: opt.id || generateId(),
        text: opt.text,
      })) || [],
      sliderConfig: q.sliderConfig ? {
        minValue: q.sliderConfig.min,
        maxValue: q.sliderConfig.max,
        step: q.sliderConfig.step,
        minLabel: "",
        maxLabel: "",
        stepLabels: [],
      } : undefined,
    }));

    setData((prev) => ({
      ...prev,
      title: prev.title || imported.title,
      description: prev.description || imported.description || "",
      type: imported.type as PollType,
      questions: [...prev.questions, ...newQuestions],
    }));
  }, [data.questions.length]);

  // Update a question
  const updateQuestion = useCallback(
    (questionId: string, updates: Partial<PollQuestion>) => {
      setData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === questionId ? { ...q, ...updates } : q
        ),
      }));
    },
    []
  );

  // Add option to a question
  const addOption = useCallback((questionId: string) => {
    setData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: [...q.options, { id: generateId(), text: "" }],
            }
          : q
      ),
    }));
  }, []);

  // Remove option from a question
  const removeOption = useCallback((questionId: string, optionId: string) => {
    setData((prev) => ({
      ...prev,
      questions: prev.questions.map((q) =>
        q.id === questionId
          ? {
              ...q,
              options: q.options.filter((o) => o.id !== optionId),
            }
          : q
      ),
    }));
  }, []);

  // Update option
  const updateOption = useCallback(
    (questionId: string, optionId: string, updates: Partial<QuestionOption>) => {
      setData((prev) => ({
        ...prev,
        questions: prev.questions.map((q) =>
          q.id === questionId
            ? {
                ...q,
                options: q.options.map((o) =>
                  o.id === optionId ? { ...o, ...updates } : o
                ),
              }
            : q
        ),
      }));
    },
    []
  );

  // Move question up/down
  const moveQuestion = useCallback((questionId: string, direction: "up" | "down") => {
    setData((prev) => {
      const questions = [...prev.questions];
      const index = questions.findIndex((q) => q.id === questionId);
      if (
        (direction === "up" && index === 0) ||
        (direction === "down" && index === questions.length - 1)
      ) {
        return prev;
      }

      const newIndex = direction === "up" ? index - 1 : index + 1;
      [questions[index], questions[newIndex]] = [questions[newIndex], questions[index]];

      return {
        ...prev,
        questions: questions.map((q, i) => ({ ...q, order: i + 1 })),
      };
    });
  }, []);

  // Import from text
  const handleImport = useCallback(async () => {
    if (!importText.trim()) return;

    setIsImporting(true);
    try {
      const response = await fetch("/api/advanced-polls/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: importText }),
      });

      if (!response.ok) {
        throw new Error("Failed to parse text");
      }

      const parsed = await response.json();

      // Convert parsed data to our format
      const importedQuestions: PollQuestion[] = parsed.questions.map(
        (q: any, i: number) => ({
          id: generateId(),
          order: data.questions.length + i + 1,
          type: q.type || "SINGLE_CHOICE",
          questionText: q.questionText,
          description: q.description,
          required: q.required ?? true,
          allowImages: false,
          options:
            q.options?.map((opt: any) => ({
              id: generateId(),
              text: typeof opt === "string" ? opt : opt.text,
            })) || [],
          sliderConfig: q.sliderConfig,
        })
      );

      setData((prev) => ({
        ...prev,
        title: prev.title || parsed.title || "",
        description: prev.description || parsed.description || "",
        questions: [...prev.questions, ...importedQuestions],
      }));

      setShowImportModal(false);
      setImportText("");
    } catch (error) {
      console.error("Import error:", error);
      alert("Failed to import. Please check the format.");
    } finally {
      setIsImporting(false);
    }
  }, [importText, data.questions.length]);

  // Save poll
  const handleSave = useCallback(async () => {
    if (!data.title.trim()) {
      alert("Please enter a poll title");
      return;
    }
    if (data.questions.length === 0) {
      alert("Please add at least one question");
      return;
    }

    setIsSaving(true);
    try {
      await onSave(data);
    } catch (error) {
      console.error("Save error:", error);
      alert("Failed to save poll");
    } finally {
      setIsSaving(false);
    }
  }, [data, onSave]);

  return (
    <div className={cn("space-y-6", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-bold">Poll Builder</h2>
        <div className="flex gap-2">
          <Dialog open={showImportModal} onOpenChange={setShowImportModal}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm">
                <FileText className="w-4 h-4 mr-2" />
                Import Text
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-lg">
              <DialogHeader>
                <DialogTitle>Import from Text</DialogTitle>
                <DialogDescription>
                  Paste your poll text. Supports formats like:
                  <br />
                  <code className="text-xs bg-muted px-1 rounded">
                    Question text? Option A, Option B, Option C
                  </code>
                  <br />
                  or structured format with POLL:, Q1:, TYPE:, OPTIONS:
                </DialogDescription>
              </DialogHeader>
              <Textarea
                value={importText}
                onChange={(e) => setImportText(e.target.value)}
                placeholder="Paste your poll text here..."
                className="min-h-[200px]"
              />
              <DialogFooter>
                <Button variant="outline" onClick={() => setShowImportModal(false)}>
                  Cancel
                </Button>
                <Button onClick={handleImport} disabled={isImporting || !importText.trim()}>
                  {isImporting ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Parsing...
                    </>
                  ) : (
                    "Import"
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          <Button variant="outline" size="sm" onClick={() => setShowSettings(!showSettings)}>
            <Settings className="w-4 h-4 mr-2" />
            Settings
          </Button>

          <Button 
            variant={showPreview ? "secondary" : "outline"} 
            size="sm" 
            onClick={() => setShowPreview(!showPreview)}
          >
            <Eye className="w-4 h-4 mr-2" />
            {showPreview ? "Hide Preview" : "Preview"}
          </Button>

          <Button onClick={handleSave} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <Save className="w-4 h-4 mr-2" />
                Save Poll
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Poll Settings */}
      <AnimatePresence>
        {showSettings && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-lg border bg-card space-y-4">
              <h3 className="font-medium">Poll Settings</h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Poll Type</Label>
                  <Select
                    value={data.type}
                    onValueChange={(v) => setData((d) => ({ ...d, type: v as PollType }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SIMPLE">Simple Poll</SelectItem>
                      <SelectItem value="SURVEY">Survey</SelectItem>
                      <SelectItem value="QUIZ">Quiz</SelectItem>
                      <SelectItem value="FEEDBACK">Feedback</SelectItem>
                      <SelectItem value="REACH_ASSESSMENT">Reach Assessment</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label>Expires At (optional)</Label>
                  <Input
                    type="datetime-local"
                    value={data.expiresAt || ""}
                    onChange={(e) =>
                      setData((d) => ({ ...d, expiresAt: e.target.value || undefined }))
                    }
                  />
                </div>
              </div>

              <div className="flex flex-wrap gap-6">
                <div className="flex items-center space-x-2">
                  <Switch
                    id="partial"
                    checked={data.allowPartialSubmission}
                    onCheckedChange={(v) =>
                      setData((d) => ({ ...d, allowPartialSubmission: v }))
                    }
                  />
                  <Label htmlFor="partial">Allow partial submission</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="progress"
                    checked={data.showProgressBar}
                    onCheckedChange={(v) => setData((d) => ({ ...d, showProgressBar: v }))}
                  />
                  <Label htmlFor="progress">Show progress bar</Label>
                </div>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="random"
                    checked={data.randomizeQuestions}
                    onCheckedChange={(v) =>
                      setData((d) => ({ ...d, randomizeQuestions: v }))
                    }
                  />
                  <Label htmlFor="random">Randomize questions</Label>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Live Preview Panel */}
      <AnimatePresence>
        {showPreview && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden"
          >
            <div className="p-4 rounded-lg border bg-gradient-to-br from-violet-500/5 to-indigo-500/5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="font-medium flex items-center gap-2">
                  <Eye className="w-4 h-4" />
                  Live Preview
                </h3>
                <span className="text-xs text-muted-foreground">
                  This is how your poll will appear in the flow
                </span>
              </div>
              
              {/* Poll Card Preview */}
              <div className="rounded-xl border bg-card shadow-sm overflow-hidden max-w-md mx-auto">
                <div className="p-4 space-y-3">
                  {/* Header */}
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-gradient-to-br from-violet-500 to-indigo-500 flex items-center justify-center text-white font-bold text-sm">
                        V
                      </div>
                      <div>
                        <p className="font-semibold text-sm">VeggaStare</p>
                        <p className="text-xs text-muted-foreground">Just now</p>
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded-full text-xs font-medium",
                      data.type === "SURVEY" && "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
                      data.type === "QUIZ" && "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300",
                      data.type === "FEEDBACK" && "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300",
                      data.type === "REACH_ASSESSMENT" && "bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-300",
                      data.type === "SIMPLE" && "bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300"
                    )}>
                      {data.type === "REACH_ASSESSMENT" ? "REACH" : data.type}
                    </span>
                  </div>

                  {/* Title & Description */}
                  <div>
                    <h3 className="font-semibold text-base">
                      {data.title || "Untitled Poll"}
                    </h3>
                    {data.description && (
                      <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                        {data.description}
                      </p>
                    )}
                  </div>

                  {/* Questions Preview */}
                  <div className="space-y-2 py-2">
                    {data.questions.slice(0, 3).map((q, idx) => (
                      <div 
                        key={q.id} 
                        className="flex items-center gap-2 text-sm text-muted-foreground"
                      >
                        <span className="w-5 h-5 rounded-full bg-muted flex items-center justify-center text-xs">
                          {idx + 1}
                        </span>
                        <span className="truncate">
                          {q.questionText || `Question ${idx + 1}`}
                        </span>
                        {q.type === "SLIDER" && <Sliders className="w-3 h-3 shrink-0" />}
                        {(q.type === "SINGLE_CHOICE" || q.type === "MULTI_CHOICE") && <List className="w-3 h-3 shrink-0" />}
                        {q.type === "TEXT" && <Type className="w-3 h-3 shrink-0" />}
                        {q.type === "SCALE" && <Hash className="w-3 h-3 shrink-0" />}
                      </div>
                    ))}
                    {data.questions.length > 3 && (
                      <p className="text-xs text-muted-foreground pl-7">
                        +{data.questions.length - 3} more questions
                      </p>
                    )}
                    {data.questions.length === 0 && (
                      <p className="text-sm text-muted-foreground italic text-center py-4">
                        Add questions to see the preview
                      </p>
                    )}
                  </div>

                  {/* Stats Bar */}
                  <div className="flex items-center justify-between pt-2 border-t">
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>{data.questions.length} questions</span>
                      <span>~{Math.max(1, data.questions.length * 30)} sec</span>
                    </div>
                    <Button size="sm" className="h-8 bg-gradient-to-r from-violet-500 to-indigo-500 hover:from-violet-600 hover:to-indigo-600 text-white">
                      Take Poll
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Basic Info */}
      <div className="space-y-4 p-4 rounded-lg border bg-card">
        <div className="space-y-2">
          <Label>Poll Title *</Label>
          <Input
            value={data.title}
            onChange={(e) => setData((d) => ({ ...d, title: e.target.value }))}
            placeholder="Enter poll title..."
          />
        </div>
        <div className="space-y-2">
          <Label>Description</Label>
          <Textarea
            value={data.description}
            onChange={(e) => setData((d) => ({ ...d, description: e.target.value }))}
            placeholder="Optional description..."
            className="min-h-[80px]"
          />
        </div>
      </div>

      {/* Questions */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="font-medium">Questions ({data.questions.length})</h3>
        </div>

        <AnimatePresence mode="popLayout">
          {data.questions.map((question, index) => (
            <motion.div
              key={question.id}
              layout
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="rounded-lg border bg-card overflow-hidden"
            >
              <Collapsible
                open={expandedQuestion === question.id}
                onOpenChange={(open) =>
                  setExpandedQuestion(open ? question.id : null)
                }
              >
                {/* Question Header */}
                <CollapsibleTrigger asChild>
                  <div className="flex items-center gap-3 p-4 cursor-pointer hover:bg-muted/50">
                    <GripVertical className="w-4 h-4 text-muted-foreground" />
                    <span className="w-8 h-8 rounded-full bg-primary/20 text-primary text-sm font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">
                        {question.questionText || "(Untitled question)"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {question.type.replace("_", " ")} •{" "}
                        {question.required ? "Required" : "Optional"}
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveQuestion(question.id, "up");
                        }}
                        disabled={index === 0}
                      >
                        <ChevronUp className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={(e) => {
                          e.stopPropagation();
                          moveQuestion(question.id, "down");
                        }}
                        disabled={index === data.questions.length - 1}
                      >
                        <ChevronDown className="w-4 h-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          removeQuestion(question.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </CollapsibleTrigger>

                {/* Question Body */}
                <CollapsibleContent>
                  <div className="p-4 pt-0 space-y-4 border-t">
                    {/* Question Type */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Question Type</Label>
                        <Select
                          value={question.type}
                          onValueChange={(v) =>
                            updateQuestion(question.id, {
                              type: v as QuestionType,
                              options:
                                v === "SINGLE_CHOICE" || v === "MULTI_CHOICE"
                                  ? question.options.length > 0
                                    ? question.options
                                    : [
                                        { id: generateId(), text: "" },
                                        { id: generateId(), text: "" },
                                      ]
                                  : [],
                              sliderConfig:
                                v === "SLIDER"
                                  ? question.sliderConfig || { ...DEFAULT_SLIDER_CONFIG }
                                  : undefined,
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="SINGLE_CHOICE">
                              <div className="flex items-center gap-2">
                                <List className="w-4 h-4" />
                                Single Choice
                              </div>
                            </SelectItem>
                            <SelectItem value="MULTI_CHOICE">
                              <div className="flex items-center gap-2">
                                <List className="w-4 h-4" />
                                Multiple Choice
                              </div>
                            </SelectItem>
                            <SelectItem value="SLIDER">
                              <div className="flex items-center gap-2">
                                <Sliders className="w-4 h-4" />
                                Slider (A-G)
                              </div>
                            </SelectItem>
                            <SelectItem value="SCALE">
                              <div className="flex items-center gap-2">
                                <Hash className="w-4 h-4" />
                                Scale (1-10)
                              </div>
                            </SelectItem>
                            <SelectItem value="TEXT">
                              <div className="flex items-center gap-2">
                                <Type className="w-4 h-4" />
                                Text Response
                              </div>
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>

                      <div className="flex items-end gap-4">
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`required-${question.id}`}
                            checked={question.required}
                            onCheckedChange={(v) =>
                              updateQuestion(question.id, { required: v })
                            }
                          />
                          <Label htmlFor={`required-${question.id}`}>Required</Label>
                        </div>
                        <div className="flex items-center space-x-2">
                          <Switch
                            id={`images-${question.id}`}
                            checked={question.allowImages}
                            onCheckedChange={(v) =>
                              updateQuestion(question.id, { allowImages: v })
                            }
                          />
                          <Label htmlFor={`images-${question.id}`}>Allow Images</Label>
                        </div>
                      </div>
                    </div>

                    {/* Question Text */}
                    <div className="space-y-2">
                      <Label>Question Text *</Label>
                      <Input
                        value={question.questionText}
                        onChange={(e) =>
                          updateQuestion(question.id, { questionText: e.target.value })
                        }
                        placeholder="Enter your question..."
                      />
                    </div>

                    <div className="space-y-2">
                      <Label>Description (optional)</Label>
                      <Input
                        value={question.description || ""}
                        onChange={(e) =>
                          updateQuestion(question.id, {
                            description: e.target.value || undefined,
                          })
                        }
                        placeholder="Additional context..."
                      />
                    </div>

                    {/* Choice Options */}
                    {(question.type === "SINGLE_CHOICE" ||
                      question.type === "MULTI_CHOICE") && (
                      <div className="space-y-3">
                        <Label>Options</Label>
                        {question.options.map((option, optIndex) => (
                          <div key={option.id} className="flex items-center gap-2">
                            <span className="w-6 h-6 rounded bg-muted text-xs font-bold flex items-center justify-center">
                              {String.fromCharCode(65 + optIndex)}
                            </span>
                            <Input
                              value={option.text}
                              onChange={(e) =>
                                updateOption(question.id, option.id, {
                                  text: e.target.value,
                                })
                              }
                              placeholder={`Option ${String.fromCharCode(65 + optIndex)}`}
                              className="flex-1"
                            />
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-8 w-8"
                              onClick={() => removeOption(question.id, option.id)}
                              disabled={question.options.length <= 2}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        ))}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => addOption(question.id)}
                        >
                          <Plus className="w-4 h-4 mr-2" />
                          Add Option
                        </Button>
                      </div>
                    )}

                    {/* Slider Config */}
                    {question.type === "SLIDER" && question.sliderConfig && (
                      <div className="space-y-3">
                        <Label>Slider Settings</Label>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-xs">Min Value</Label>
                            <Input
                              type="number"
                              value={question.sliderConfig.minValue}
                              onChange={(e) =>
                                updateQuestion(question.id, {
                                  sliderConfig: {
                                    ...question.sliderConfig!,
                                    minValue: parseInt(e.target.value) || 1,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Max Value</Label>
                            <Input
                              type="number"
                              value={question.sliderConfig.maxValue}
                              onChange={(e) =>
                                updateQuestion(question.id, {
                                  sliderConfig: {
                                    ...question.sliderConfig!,
                                    maxValue: parseInt(e.target.value) || 7,
                                  },
                                })
                              }
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Min Label</Label>
                            <Input
                              value={question.sliderConfig.minLabel}
                              onChange={(e) =>
                                updateQuestion(question.id, {
                                  sliderConfig: {
                                    ...question.sliderConfig!,
                                    minLabel: e.target.value,
                                  },
                                })
                              }
                              placeholder="Low"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-xs">Max Label</Label>
                            <Input
                              value={question.sliderConfig.maxLabel}
                              onChange={(e) =>
                                updateQuestion(question.id, {
                                  sliderConfig: {
                                    ...question.sliderConfig!,
                                    maxLabel: e.target.value,
                                  },
                                })
                              }
                              placeholder="High"
                            />
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Add Question Buttons */}
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={() => addQuestion("SINGLE_CHOICE")}>
            <List className="w-4 h-4 mr-2" />
            Add Choice
          </Button>
          <Button variant="outline" onClick={() => addQuestion("SLIDER")}>
            <Sliders className="w-4 h-4 mr-2" />
            Add Slider
          </Button>
          <Button variant="outline" onClick={() => addQuestion("SCALE")}>
            <Hash className="w-4 h-4 mr-2" />
            Add Scale
          </Button>
          <Button variant="outline" onClick={() => addQuestion("TEXT")}>
            <Type className="w-4 h-4 mr-2" />
            Add Text
          </Button>
          <Button variant="outline" onClick={() => addQuestion("RANKING")}>
            <GripVertical className="w-4 h-4 mr-2" />
            Add Ranking
          </Button>
          <Button variant="outline" onClick={() => addQuestion("SHAPE_MATCH")}>
            <Shapes className="w-4 h-4 mr-2" />
            Add Shape Match
          </Button>
          <Button variant="outline" onClick={() => addQuestion("UI_ARRANGE")}>
            <LayoutGrid className="w-4 h-4 mr-2" />
            Add UI Arrange
          </Button>
          <Button variant="outline" onClick={() => addQuestion("NESTED")}>
            <GitBranch className="w-4 h-4 mr-2" />
            Add Nested
          </Button>
          <Button variant="secondary" onClick={() => setShowImportModal(true)}>
            <Upload className="w-4 h-4 mr-2" />
            Import Questions
          </Button>
        </div>

        {/* Import Modal */}
        <PollImportModal
          open={showImportModal}
          onOpenChange={setShowImportModal}
          onImport={handleImportFromModal}
        />
      </div>
    </div>
  );
}

export default PollBuilder;
