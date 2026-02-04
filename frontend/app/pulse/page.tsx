"use client";

import { useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Wrench,
  Rocket,
  Sparkles,
  Activity,
  Zap,
  FileText,
  TrendingUp,
  Users,
  BarChart3,
  ChevronRight,
  Star,
  Clock,
} from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { PollBuilder } from "@/components/uicustom/polls/PollBuilder";
import { cn } from "@/lib/utils";

// Template types for quick-start polls
interface PollTemplate {
  id: string;
  name: string;
  description: string;
  icon: React.ElementType;
  category: "feedback" | "engagement" | "assessment" | "custom";
  estimatedTime: string;
  questionCount: number;
  preview?: {
    title: string;
    type: "SIMPLE" | "SURVEY" | "QUIZ" | "FEEDBACK" | "REACH_ASSESSMENT";
  };
}

const POLL_TEMPLATES: PollTemplate[] = [
  {
    id: "product-feedback",
    name: "Product Feedback",
    description: "Gather insights on product features and user experience",
    icon: Star,
    category: "feedback",
    estimatedTime: "3-5 min",
    questionCount: 8,
    preview: {
      title: "Product Feedback Survey",
      type: "FEEDBACK",
    },
  },
  {
    id: "team-pulse",
    name: "Team Pulse Check",
    description: "Quick health check for team morale and engagement",
    icon: Activity,
    category: "engagement",
    estimatedTime: "2-3 min",
    questionCount: 5,
    preview: {
      title: "Team Pulse Survey",
      type: "SURVEY",
    },
  },
  {
    id: "nps-survey",
    name: "NPS Survey",
    description: "Net Promoter Score to measure customer loyalty",
    icon: TrendingUp,
    category: "assessment",
    estimatedTime: "1-2 min",
    questionCount: 3,
    preview: {
      title: "Customer Satisfaction (NPS)",
      type: "SURVEY",
    },
  },
  {
    id: "reach-assessment",
    name: "REACH Assessment",
    description: "Comprehensive platform capability assessment",
    icon: Zap,
    category: "assessment",
    estimatedTime: "15-20 min",
    questionCount: 75,
    preview: {
      title: "REACH System Assessment",
      type: "REACH_ASSESSMENT",
    },
  },
  {
    id: "quick-poll",
    name: "Quick Poll",
    description: "Simple yes/no or multiple choice poll",
    icon: BarChart3,
    category: "engagement",
    estimatedTime: "< 1 min",
    questionCount: 1,
    preview: {
      title: "Quick Poll",
      type: "SIMPLE",
    },
  },
  {
    id: "blank",
    name: "Start from Scratch",
    description: "Create a completely custom poll",
    icon: FileText,
    category: "custom",
    estimatedTime: "Varies",
    questionCount: 0,
    preview: {
      title: "My Custom Poll",
      type: "SURVEY",
    },
  },
];

export default function PulsePage() {
  const [activeTab, setActiveTab] = useState<string>("templates");
  const [selectedTemplate, setSelectedTemplate] = useState<PollTemplate | null>(null);
  const [showBuilder, setShowBuilder] = useState(false);

  const handleSavePoll = useCallback(async (data: any) => {
    console.log("Saving poll:", data);
    // TODO: Implement save to backend
    await new Promise(resolve => setTimeout(resolve, 1000));
  }, []);

  const handlePreviewPoll = useCallback((data: any) => {
    console.log("Preview poll:", data);
    // TODO: Implement preview modal
  }, []);

  const handleSelectTemplate = (template: PollTemplate) => {
    setSelectedTemplate(template);
    setShowBuilder(true);
  };

  const getCategoryColor = (category: PollTemplate["category"]) => {
    switch (category) {
      case "feedback": return "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/30";
      case "engagement": return "bg-purple-500/10 text-purple-600 dark:text-purple-400 border-purple-500/30";
      case "assessment": return "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30";
      case "custom": return "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30";
      default: return "bg-muted text-muted-foreground";
    }
  };

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20 dark:from-background dark:to-muted/10">
        {/* Header */}
        <div className="border-b bg-background/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="max-w-6xl mx-auto px-4 py-6">
            <div className="flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-primary/10">
                    <Rocket className="h-6 w-6 text-primary" />
                  </div>
                  <h1 className="text-3xl font-bold tracking-tight">Pulse</h1>
                  <Badge variant="secondary" className="text-xs">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Beta
                  </Badge>
                </div>
                <p className="text-muted-foreground">
                  Create engaging polls, surveys, and assessments to gather insights from your community
                </p>
              </div>
              
              {showBuilder && (
                <Button 
                  variant="outline" 
                  onClick={() => setShowBuilder(false)}
                >
                  ← Back to Templates
                </Button>
              )}
            </div>
          </div>
        </div>

        <div className="max-w-6xl mx-auto px-4 py-8">
          <AnimatePresence mode="wait">
            {!showBuilder ? (
              <motion.div
                key="templates"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
              >
                <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
                  <TabsList className="grid w-full max-w-md grid-cols-3">
                    <TabsTrigger value="templates" className="gap-2">
                      <FileText className="h-4 w-4" />
                      Templates
                    </TabsTrigger>
                    <TabsTrigger value="my-polls" className="gap-2">
                      <Users className="h-4 w-4" />
                      My Polls
                    </TabsTrigger>
                    <TabsTrigger value="analytics" className="gap-2">
                      <BarChart3 className="h-4 w-4" />
                      Analytics
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="templates" className="space-y-6">
                    {/* Quick Start Section */}
                    <div className="space-y-4">
                      <h2 className="text-xl font-semibold flex items-center gap-2">
                        <Zap className="h-5 w-5 text-amber-500" />
                        Quick Start Templates
                      </h2>
                      
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {POLL_TEMPLATES.map((template) => {
                          const Icon = template.icon;
                          return (
                            <Tooltip key={template.id}>
                              <TooltipTrigger asChild>
                                <motion.div
                                  whileHover={{ scale: 1.02 }}
                                  whileTap={{ scale: 0.98 }}
                                  className={cn(
                                    "relative p-5 rounded-xl border cursor-pointer group",
                                    "bg-card hover:bg-accent/50 transition-colors duration-200",
                                    "hover:border-primary/50 hover:shadow-lg"
                                  )}
                                  onClick={() => handleSelectTemplate(template)}
                                >
                                  <div className="flex items-start gap-4">
                                    <div className={cn(
                                      "p-3 rounded-lg",
                                      getCategoryColor(template.category)
                                    )}>
                                      <Icon className="h-5 w-5" />
                                    </div>
                                    <div className="flex-1 space-y-1">
                                      <h3 className="font-medium group-hover:text-primary transition-colors">
                                        {template.name}
                                      </h3>
                                      <p className="text-sm text-muted-foreground line-clamp-2">
                                        {template.description}
                                      </p>
                                      <div className="flex items-center gap-3 pt-2 text-xs text-muted-foreground">
                                        <span className="flex items-center gap-1">
                                          <Clock className="h-3 w-3" />
                                          {template.estimatedTime}
                                        </span>
                                        <span>•</span>
                                        <span>{template.questionCount} questions</span>
                                      </div>
                                    </div>
                                    <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-primary transition-colors" />
                                  </div>
                                  
                                  {/* Category Badge */}
                                  <Badge
                                    variant="outline"
                                    className={cn(
                                      "absolute top-3 right-3 text-xs capitalize",
                                      getCategoryColor(template.category)
                                    )}
                                  >
                                    {template.category}
                                  </Badge>
                                </motion.div>
                              </TooltipTrigger>
                              <TooltipContent side="bottom" className="max-w-xs">
                                <p className="font-medium">{template.name}</p>
                                <p className="text-xs text-muted-foreground mt-1">
                                  {template.description}
                                </p>
                                <p className="text-xs mt-2 text-primary">
                                  Click to start building with this template
                                </p>
                              </TooltipContent>
                            </Tooltip>
                          );
                        })}
                      </div>
                    </div>

                    {/* Builder Direct Access */}
                    <div className="pt-6 border-t">
                      <h2 className="text-xl font-semibold flex items-center gap-2 mb-4">
                        <Wrench className="h-5 w-5 text-primary" />
                        Poll Builder
                      </h2>
                      <p className="text-muted-foreground mb-4">
                        Jump directly into the full poll builder for complete control over your survey
                      </p>
                      <Button 
                        size="lg" 
                        onClick={() => handleSelectTemplate(POLL_TEMPLATES.find(t => t.id === "blank")!)}
                        className="gap-2"
                      >
                        <Wrench className="h-4 w-4" />
                        Open Poll Builder
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="my-polls" className="space-y-6">
                    <div className="text-center py-12 text-muted-foreground">
                      <Users className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No polls yet</h3>
                      <p className="text-sm mb-4">Create your first poll to see it here</p>
                      <Button onClick={() => setActiveTab("templates")}>
                        Browse Templates
                      </Button>
                    </div>
                  </TabsContent>

                  <TabsContent value="analytics" className="space-y-6">
                    <div className="text-center py-12 text-muted-foreground">
                      <BarChart3 className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <h3 className="text-lg font-medium mb-2">No analytics data</h3>
                      <p className="text-sm mb-4">Create and share polls to start collecting responses</p>
                      <Button onClick={() => setActiveTab("templates")}>
                        Create a Poll
                      </Button>
                    </div>
                  </TabsContent>
                </Tabs>
              </motion.div>
            ) : (
              <motion.div
                key="builder"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -20 }}
                transition={{ duration: 0.3 }}
                className="space-y-6"
              >
                {/* Template Info Banner */}
                {selectedTemplate && selectedTemplate.id !== "blank" && (
                  <div className={cn(
                    "p-4 rounded-lg border flex items-center gap-4",
                    getCategoryColor(selectedTemplate.category)
                  )}>
                    {(() => {
                      const Icon = selectedTemplate.icon;
                      return <Icon className="h-6 w-6" />;
                    })()}
                    <div className="flex-1">
                      <p className="font-medium">Building from: {selectedTemplate.name}</p>
                      <p className="text-sm opacity-80">{selectedTemplate.description}</p>
                    </div>
                  </div>
                )}

                {/* Poll Builder Component */}
                <div className="bg-card rounded-xl border p-6 shadow-sm">
                  <PollBuilder
                    initialData={selectedTemplate?.preview ? {
                      title: selectedTemplate.preview.title,
                      type: selectedTemplate.preview.type,
                    } : undefined}
                    onSave={handleSavePoll}
                    onPreview={handlePreviewPoll}
                  />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </TooltipProvider>
  );
}
