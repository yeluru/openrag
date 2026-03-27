import { BookOpen, Library } from "lucide-react";
import { Link, Outlet, useLocation } from "react-router-dom";

export function AppShell() {
  const loc = useLocation();
  const inLibrary = loc.pathname === "/";
  const inReader = loc.pathname.startsWith("/doc/");

  return (
    <div className="flex min-h-screen flex-col">
      {!inReader ? (
        <header className="sticky top-0 z-40 border-b border-zinc-200/60 bg-white/80 backdrop-blur-xl supports-[backdrop-filter]:bg-white/70">
          <div className="mx-auto flex h-[3.25rem] max-w-[1400px] items-center justify-between px-4 sm:px-8">
            <Link
              to="/"
              className="flex items-center gap-2.5 font-semibold tracking-tight text-zinc-900 transition-opacity hover:opacity-80"
            >
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-600 to-violet-600 text-white shadow-md shadow-indigo-500/25">
                <BookOpen className="h-[18px] w-[18px]" />
              </span>
              <span className="text-[15px]">OpenRAG</span>
            </Link>
            <nav className="flex items-center gap-1">
              <Link
                to="/"
                className={`flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition-colors ${
                  inLibrary ? "bg-zinc-100 text-zinc-900" : "text-zinc-500 hover:bg-zinc-50 hover:text-zinc-800"
                }`}
              >
                <Library className="h-4 w-4" />
                Library
              </Link>
            </nav>
          </div>
        </header>
      ) : null}
      <main className={inReader ? "min-h-dvh flex-1" : "flex-1"}>
        <Outlet />
      </main>
    </div>
  );
}
