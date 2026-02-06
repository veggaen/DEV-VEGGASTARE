"use client";

import { useCallback, useEffect, useMemo, useState, useRef } from "react";
import { useRouter, useSearchParams, usePathname } from "next/navigation";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PollNavigationState {
  sectionIndex: number;
  questionIndex: number;
  screen: "welcome" | "phase-select" | "question" | "complete" | "results";
}

export interface UsePollNavigationOptions {
  totalSections: number;
  getSectionQuestionCount: (sectionIndex: number) => number;
  pollId?: string;
  onNavigate?: (state: PollNavigationState) => void;
  enableUrlSync?: boolean;
  enableMouseNavigation?: boolean;
  /** If true, intercepts browser back/forward to navigate within poll instead */
  interceptBrowserNavigation?: boolean;
}

export interface UsePollNavigationReturn {
  // Current state
  currentSection: number;
  currentQuestion: number;
  screen: PollNavigationState["screen"];
  
  // Navigation methods
  goToQuestion: (sectionIndex: number, questionIndex: number) => void;
  goToSection: (sectionIndex: number) => void;
  goToScreen: (screen: PollNavigationState["screen"]) => void;
  goNext: () => boolean;
  goPrev: () => boolean;
  goHome: () => void;
  goToResults: () => void;
  restart: () => void;
  
  // History
  canGoBack: boolean;
  canGoForward: boolean;
  historyLength: number;
  
  // URL
  shareableUrl: string;
  copyShareableUrl: () => Promise<boolean>;
  
  // State setters for controlled mode
  setSection: (index: number) => void;
  setQuestion: (index: number) => void;
  setScreen: (screen: PollNavigationState["screen"]) => void;
}

// ─── URL Param Keys ───────────────────────────────────────────────────────────

const URL_PARAMS = {
  SECTION: "s",
  QUESTION: "q",
  SCREEN: "view",
} as const;

// Key for storing poll navigation history in sessionStorage
const POLL_HISTORY_KEY = "veggastare:poll-nav-history";

// ─── Helper Functions ─────────────────────────────────────────────────────────

function parseUrlState(searchParams: URLSearchParams): Partial<PollNavigationState> {
  const section = searchParams.get(URL_PARAMS.SECTION);
  const question = searchParams.get(URL_PARAMS.QUESTION);
  const screen = searchParams.get(URL_PARAMS.SCREEN);

  const state: Partial<PollNavigationState> = {};

  if (section !== null) {
    const sectionIndex = parseInt(section, 10) - 1; // URL is 1-indexed for readability
    if (!isNaN(sectionIndex) && sectionIndex >= 0) {
      state.sectionIndex = sectionIndex;
    }
  }

  if (question !== null) {
    const questionIndex = parseInt(question, 10) - 1; // URL is 1-indexed for readability
    if (!isNaN(questionIndex) && questionIndex >= 0) {
      state.questionIndex = questionIndex;
    }
  }

  if (screen && ["welcome", "phase-select", "question", "complete", "results"].includes(screen)) {
    state.screen = screen as PollNavigationState["screen"];
  }

  return state;
}

function buildUrl(
  pathname: string,
  state: PollNavigationState,
  baseUrl?: string
): string {
  const params = new URLSearchParams();

  if (state.screen !== "welcome") {
    params.set(URL_PARAMS.SCREEN, state.screen);
  }

  if (state.screen === "question" || state.screen === "phase-select") {
    params.set(URL_PARAMS.SECTION, String(state.sectionIndex + 1)); // 1-indexed for readability
    
    if (state.screen === "question") {
      params.set(URL_PARAMS.QUESTION, String(state.questionIndex + 1)); // 1-indexed
    }
  }

  const queryString = params.toString();
  const fullPath = queryString ? `${pathname}?${queryString}` : pathname;

  if (baseUrl) {
    return `${baseUrl}${fullPath}`;
  }

  if (typeof window !== "undefined") {
    return `${window.location.origin}${fullPath}`;
  }

  return fullPath;
}

// ─── Main Hook ────────────────────────────────────────────────────────────────

export function usePollNavigation({
  totalSections,
  getSectionQuestionCount,
  pollId,
  onNavigate,
  enableUrlSync = true,
  enableMouseNavigation = true,
  interceptBrowserNavigation = true,
}: UsePollNavigationOptions): UsePollNavigationReturn {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  
  // Track if we're handling a popstate event to avoid loops
  const isHandlingPopState = useRef(false);
  // Track the history entries we've pushed
  const historyStackSize = useRef(0);

  // ─── State ──────────────────────────────────────────────────────────────────

  const [state, setState] = useState<PollNavigationState>(() => {
    // Initialize from URL if available
    if (enableUrlSync && searchParams) {
      const urlState = parseUrlState(searchParams);
      return {
        sectionIndex: urlState.sectionIndex ?? 0,
        questionIndex: urlState.questionIndex ?? 0,
        screen: urlState.screen ?? "welcome",
      };
    }
    return {
      sectionIndex: 0,
      questionIndex: 0,
      screen: "welcome",
    };
  });

  // Navigation history for back/forward (internal poll history)
  const [history, setHistory] = useState<PollNavigationState[]>([state]);
  const [historyIndex, setHistoryIndex] = useState(0);

  // ─── Browser Navigation Interception ─────────────────────────────────────────
  
  // Push a history entry when poll opens so we can intercept back button
  useEffect(() => {
    if (!interceptBrowserNavigation) return;
    
    // Push an initial state so we have something to go "back" to
    // This creates our own history entry that we can intercept
    const initialState = { pollNav: true, index: 0, pollId };
    window.history.pushState(initialState, "", window.location.href);
    historyStackSize.current = 1;
    
    return () => {
      // Clean up: go back to remove our history entries when unmounting
      // Only if we still have entries we pushed
      if (historyStackSize.current > 0) {
        // We can't reliably clean up history entries, so just reset counter
        historyStackSize.current = 0;
      }
    };
  }, [interceptBrowserNavigation, pollId]);

  // Handle browser back/forward (popstate) - this catches mouse buttons too!
  useEffect(() => {
    if (!interceptBrowserNavigation) return;

    const handlePopState = (event: PopStateEvent) => {
      // Check if this is our poll navigation state
      const isOurState = event.state?.pollNav === true;
      
      // Prevent the default behavior and handle navigation ourselves
      // The browser has already changed the URL, so we need to push it back
      // and handle the navigation in our poll instead
      
      if (isHandlingPopState.current) return;
      isHandlingPopState.current = true;

      // Determine direction based on history index in state
      const newIndex = event.state?.index ?? -1;
      const currentIndex = historyIndex;
      
      if (newIndex < currentIndex || newIndex === -1) {
        // Going back
        if (historyIndex > 0) {
          // Navigate back within poll
          setHistoryIndex((prev) => prev - 1);
          setState(history[historyIndex - 1]);
          onNavigate?.(history[historyIndex - 1]);
          
          // Push state back to stay in poll
          const pollState = { pollNav: true, index: historyIndex - 1, pollId };
          window.history.pushState(pollState, "", window.location.href);
        } else {
          // At beginning of poll history - go back to welcome or close
          if (state.screen !== "welcome") {
            const welcomeState: PollNavigationState = {
              sectionIndex: 0,
              questionIndex: 0,
              screen: "welcome",
            };
            setState(welcomeState);
            onNavigate?.(welcomeState);
            
            // Push state to stay in poll
            const pollState = { pollNav: true, index: 0, pollId };
            window.history.pushState(pollState, "", window.location.href);
          }
          // If already at welcome, let the browser navigate away naturally
          // by not pushing a new state
        }
      } else {
        // Going forward
        if (historyIndex < history.length - 1) {
          setHistoryIndex((prev) => prev + 1);
          setState(history[historyIndex + 1]);
          onNavigate?.(history[historyIndex + 1]);
          
          const pollState = { pollNav: true, index: historyIndex + 1, pollId };
          window.history.pushState(pollState, "", window.location.href);
        }
      }

      // Small delay to prevent rapid-fire events
      setTimeout(() => {
        isHandlingPopState.current = false;
      }, 50);
    };

    window.addEventListener("popstate", handlePopState);

    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [interceptBrowserNavigation, historyIndex, history, state, pollId, onNavigate]);

  // ─── URL Sync ───────────────────────────────────────────────────────────────

  // Sync URL to state changes (using pushState to maintain our history control)
  useEffect(() => {
    if (!enableUrlSync) return;
    if (isHandlingPopState.current) return;

    const newUrl = buildUrl(pathname, state);
    const currentUrl = window.location.pathname + window.location.search;

    if (newUrl !== currentUrl) {
      if (interceptBrowserNavigation) {
        // Use pushState with our poll marker
        const pollState = { pollNav: true, index: historyIndex, pollId };
        window.history.pushState(pollState, "", newUrl);
        historyStackSize.current++;
      } else {
        router.replace(newUrl, { scroll: false });
      }
    }
  }, [state, pathname, router, enableUrlSync, interceptBrowserNavigation, historyIndex, pollId]);

  // Sync state to URL changes (for direct URL access/sharing)
  useEffect(() => {
    if (!enableUrlSync || !searchParams) return;
    if (isHandlingPopState.current) return;

    const urlState = parseUrlState(searchParams);
    
    // Only update if URL has navigation params and they differ from current state
    if (
      urlState.sectionIndex !== undefined ||
      urlState.questionIndex !== undefined ||
      urlState.screen !== undefined
    ) {
      setState((prev) => {
        const newState = {
          sectionIndex: urlState.sectionIndex ?? prev.sectionIndex,
          questionIndex: urlState.questionIndex ?? prev.questionIndex,
          screen: urlState.screen ?? prev.screen,
        };

        // Only update if actually different
        if (
          newState.sectionIndex !== prev.sectionIndex ||
          newState.questionIndex !== prev.questionIndex ||
          newState.screen !== prev.screen
        ) {
          return newState;
        }
        return prev;
      });
    }
  }, [searchParams, enableUrlSync]);

  // ─── Mouse Button Navigation (auxiliary - handled by popstate now) ──────────

  useEffect(() => {
    if (!enableMouseNavigation) return;
    // Mouse buttons 3/4 trigger browser back/forward which fires popstate
    // So we just need to prevent the auxclick default to avoid double-navigation
    
    const handleAuxClick = (event: MouseEvent) => {
      // Buttons 3 and 4 are the back/forward thumb buttons
      if (event.button === 3 || event.button === 4) {
        // Don't prevent default - let popstate handle it
        // But we could prevent here if popstate isn't working
      }
    };

    window.addEventListener("auxclick", handleAuxClick);

    return () => {
      window.removeEventListener("auxclick", handleAuxClick);
    };
  }, [enableMouseNavigation]);

  // ─── Navigation Helpers ─────────────────────────────────────────────────────

  const updateState = useCallback(
    (newState: PollNavigationState) => {
      setState(newState);
      onNavigate?.(newState);

      // Add to internal history
      setHistory((prev) => {
        const newHistory = prev.slice(0, historyIndex + 1);
        newHistory.push(newState);
        return newHistory;
      });
      setHistoryIndex((prev) => {
        const newIndex = prev + 1;
        
        // Also push to browser history if intercepting
        if (interceptBrowserNavigation && typeof window !== "undefined") {
          const pollState = { pollNav: true, index: newIndex, pollId };
          window.history.pushState(pollState, "", window.location.href);
          historyStackSize.current++;
        }
        
        return newIndex;
      });
    },
    [historyIndex, onNavigate, interceptBrowserNavigation, pollId]
  );

  const navigateBack = useCallback(() => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setState(history[newIndex]);
      onNavigate?.(history[newIndex]);
      
      if (interceptBrowserNavigation && typeof window !== "undefined") {
        const pollState = { pollNav: true, index: newIndex, pollId };
        window.history.replaceState(pollState, "", window.location.href);
      }
    }
  }, [historyIndex, history, onNavigate, interceptBrowserNavigation, pollId]);

  const navigateForward = useCallback(() => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setState(history[newIndex]);
      onNavigate?.(history[newIndex]);
      
      if (interceptBrowserNavigation && typeof window !== "undefined") {
        const pollState = { pollNav: true, index: newIndex, pollId };
        window.history.replaceState(pollState, "", window.location.href);
      }
    }
  }, [historyIndex, history, onNavigate, interceptBrowserNavigation, pollId]);

  // ─── Navigation Methods ─────────────────────────────────────────────────────

  const goToQuestion = useCallback(
    (sectionIndex: number, questionIndex: number) => {
      // Validate bounds
      const clampedSection = Math.max(0, Math.min(sectionIndex, totalSections - 1));
      const maxQuestion = getSectionQuestionCount(clampedSection) - 1;
      const clampedQuestion = Math.max(0, Math.min(questionIndex, maxQuestion));

      updateState({
        sectionIndex: clampedSection,
        questionIndex: clampedQuestion,
        screen: "question",
      });
    },
    [totalSections, getSectionQuestionCount, updateState]
  );

  const goToSection = useCallback(
    (sectionIndex: number) => {
      const clampedSection = Math.max(0, Math.min(sectionIndex, totalSections - 1));
      updateState({
        sectionIndex: clampedSection,
        questionIndex: 0,
        screen: "question",
      });
    },
    [totalSections, updateState]
  );

  const goToScreen = useCallback(
    (screen: PollNavigationState["screen"]) => {
      updateState({
        ...state,
        screen,
      });
    },
    [state, updateState]
  );

  const goNext = useCallback((): boolean => {
    const { sectionIndex, questionIndex, screen } = state;

    if (screen === "welcome") {
      updateState({ ...state, screen: "question" });
      return true;
    }

    if (screen === "phase-select") {
      updateState({ ...state, screen: "question" });
      return true;
    }

    if (screen === "question") {
      const currentSectionQuestions = getSectionQuestionCount(sectionIndex);

      // Next question in same section
      if (questionIndex < currentSectionQuestions - 1) {
        updateState({
          sectionIndex,
          questionIndex: questionIndex + 1,
          screen: "question",
        });
        return true;
      }

      // Next section
      if (sectionIndex < totalSections - 1) {
        updateState({
          sectionIndex: sectionIndex + 1,
          questionIndex: 0,
          screen: "question",
        });
        return true;
      }

      // Complete
      updateState({
        ...state,
        screen: "complete",
      });
      return true;
    }

    return false;
  }, [state, totalSections, getSectionQuestionCount, updateState]);

  const goPrev = useCallback((): boolean => {
    const { sectionIndex, questionIndex, screen } = state;

    if (screen === "complete") {
      const lastSection = totalSections - 1;
      const lastQuestion = getSectionQuestionCount(lastSection) - 1;
      updateState({
        sectionIndex: lastSection,
        questionIndex: lastQuestion,
        screen: "question",
      });
      return true;
    }

    if (screen === "question") {
      // Previous question in same section
      if (questionIndex > 0) {
        updateState({
          sectionIndex,
          questionIndex: questionIndex - 1,
          screen: "question",
        });
        return true;
      }

      // Previous section (last question)
      if (sectionIndex > 0) {
        const prevSectionQuestions = getSectionQuestionCount(sectionIndex - 1);
        updateState({
          sectionIndex: sectionIndex - 1,
          questionIndex: prevSectionQuestions - 1,
          screen: "question",
        });
        return true;
      }

      // Back to welcome
      updateState({
        ...state,
        screen: "welcome",
      });
      return true;
    }

    if (screen === "phase-select") {
      updateState({ ...state, screen: "welcome" });
      return true;
    }

    return false;
  }, [state, totalSections, getSectionQuestionCount, updateState]);

  const goHome = useCallback(() => {
    updateState({
      sectionIndex: 0,
      questionIndex: 0,
      screen: "welcome",
    });
  }, [updateState]);

  const goToResults = useCallback(() => {
    updateState({
      ...state,
      screen: "results",
    });
  }, [state, updateState]);

  const restart = useCallback(() => {
    setState({
      sectionIndex: 0,
      questionIndex: 0,
      screen: "welcome",
    });
    setHistory([{
      sectionIndex: 0,
      questionIndex: 0,
      screen: "welcome",
    }]);
    setHistoryIndex(0);
  }, []);

  // ─── Shareable URL ──────────────────────────────────────────────────────────

  const shareableUrl = useMemo(
    () => buildUrl(pathname, state),
    [pathname, state]
  );

  const copyShareableUrl = useCallback(async (): Promise<boolean> => {
    try {
      await navigator.clipboard.writeText(shareableUrl);
      return true;
    } catch {
      return false;
    }
  }, [shareableUrl]);

  // ─── Computed Values ────────────────────────────────────────────────────────

  const canGoBack = useMemo(() => {
    if (historyIndex > 0) return true;
    if (state.screen === "question") {
      return state.questionIndex > 0 || state.sectionIndex > 0;
    }
    return state.screen !== "welcome";
  }, [historyIndex, state]);

  const canGoForward = useMemo(() => {
    if (historyIndex < history.length - 1) return true;
    if (state.screen === "welcome" || state.screen === "phase-select") return true;
    if (state.screen === "question") {
      const currentSectionQuestions = getSectionQuestionCount(state.sectionIndex);
      return (
        state.questionIndex < currentSectionQuestions - 1 ||
        state.sectionIndex < totalSections - 1
      );
    }
    return false;
  }, [historyIndex, history, state, totalSections, getSectionQuestionCount]);

  // ─── Direct Setters ─────────────────────────────────────────────────────────

  const setSection = useCallback(
    (index: number) => {
      goToSection(index);
    },
    [goToSection]
  );

  const setQuestion = useCallback(
    (index: number) => {
      goToQuestion(state.sectionIndex, index);
    },
    [state.sectionIndex, goToQuestion]
  );

  const setScreen = useCallback(
    (screen: PollNavigationState["screen"]) => {
      goToScreen(screen);
    },
    [goToScreen]
  );

  // ─── Return ─────────────────────────────────────────────────────────────────

  return {
    currentSection: state.sectionIndex,
    currentQuestion: state.questionIndex,
    screen: state.screen,
    goToQuestion,
    goToSection,
    goToScreen,
    goNext,
    goPrev,
    goHome,
    goToResults,
    restart,
    canGoBack,
    canGoForward,
    historyLength: history.length,
    shareableUrl,
    copyShareableUrl,
    setSection,
    setQuestion,
    setScreen,
  };
}

export default usePollNavigation;
