import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/auth/AuthContext";
import { useUserId } from "@/hooks/useUserId";
import { OpenRAGProvider, useOpenRAG } from "./context/OpenRAGContext";
import { GlobalShell } from "./components/GlobalShell";
import { ToastHost } from "./components/ToastHost";
import { LandingView } from "./views/LandingView";
import { LibraryView } from "./views/LibraryView";
import { ReaderView } from "./views/ReaderView";
import { ChatView } from "./views/ChatView";
import { QuizView } from "./views/QuizView";
import {
  ActiveChatsView,
  HighlightsHubView,
  ProgressHubView,
  SettingsView,
} from "./views/HubViews";

function OpenRAGRoutes() {
  const { view } = useOpenRAG();

  const immersive = view === "reader" || view === "quiz";

  if (immersive) {
    return (
      <AnimatePresence mode="wait">
        <motion.div
          key={view}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.35 }}
          className="flex min-h-dvh w-full flex-1 flex-col"
        >
          {view === "reader" ? <ReaderView /> : null}
          {view === "quiz" ? <QuizView /> : null}
        </motion.div>
      </AnimatePresence>
    );
  }

  return (
    <AnimatePresence mode="wait">
      <motion.div
        key={view}
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="flex min-h-0 flex-1 flex-col"
      >
        {view === "library" ? <LibraryView /> : null}
        {view === "chat" ? <ChatView /> : null}
        {view === "active_chats" ? <ActiveChatsView /> : null}
        {view === "highlights_hub" ? <HighlightsHubView /> : null}
        {view === "progress_hub" ? <ProgressHubView /> : null}
        {view === "settings" ? <SettingsView /> : null}
      </motion.div>
    </AnimatePresence>
  );
}

function AuthenticatedApp({ displayName }: { displayName: string }) {
  const [userId] = useUserId();
  return (
    <OpenRAGProvider userId={userId} initialDisplayName={displayName}>
      <GlobalShell>
        <OpenRAGRoutes />
      </GlobalShell>
      <ToastHost />
    </OpenRAGProvider>
  );
}

export default function OpenRAGApp() {
  const { isLoggedIn, displayName } = useAuth();
  if (!isLoggedIn || !displayName) {
    return <LandingView />;
  }
  return <AuthenticatedApp displayName={displayName} />;
}
