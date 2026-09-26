import { useNavigate, useRouterState } from "@tanstack/react-router";
import { Rocket } from "lucide-react";

export function Header() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const activeRole = pathname.startsWith("/admin") ? "admin" : "user";

  const switchRole = (role: "user" | "admin") => {
    if (role === activeRole) return;
    navigate({ to: role === "admin" ? "/admin" : "/" });
  };



  return (
    <header className="sticky top-0 z-50 flex items-center justify-between border-b border-border bg-card px-6 py-3">
      <div className="flex items-center gap-8">
        <div className="flex items-center gap-2.5">
          <div className="relative flex h-9 w-9 items-center justify-center rounded-lg bg-navy text-navy-foreground">
            <Rocket className="h-5 w-5" />
            <span className="absolute -right-0.5 -top-0.5 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-card" />
          </div>
          <span className="text-xl font-bold tracking-tight text-foreground">
            MeetIQ
          </span>
        </div>

        <div className="flex rounded-lg bg-secondary p-1">
          <button
            onClick={() => switchRole("user")}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-all ${
              activeRole === "user"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            User
          </button>
          <button
            onClick={() => switchRole("admin")}
            className={`rounded-md px-4 py-1.5 text-sm font-semibold transition-all ${
              activeRole === "admin"
                ? "bg-card text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Admin
          </button>
        </div>
      </div>
    </header>
  );
}
