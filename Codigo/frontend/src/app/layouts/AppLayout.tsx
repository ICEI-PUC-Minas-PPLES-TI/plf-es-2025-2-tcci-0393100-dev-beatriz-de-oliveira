import { useEffect, useMemo, useState } from "react";
import { Outlet, Link, useLocation, useNavigate } from "react-router";
import {
  LayoutDashboard,
  Package,
  Tag,
  Users,
  BarChart3,
  CreditCard,
  MessageSquare,
  Menu,
  LogOut,
  type LucideIcon,
} from "lucide-react";
import { Button } from "../components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "../components/ui/sheet";
import { Avatar, AvatarFallback } from "../components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "../components/ui/dropdown-menu";
import { brandAssets } from "../lib/assets";
import { authService } from "../services/authService";

type NavigationItem = {
  name: string;
  href: string;
  icon: LucideIcon;
  ownerOnly?: boolean;
};

const navigation: NavigationItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Produtos", href: "/produtos", icon: Package },
  { name: "Promo\u00e7\u00f5es", href: "/promocoes", icon: Tag },
  { name: "Leads", href: "/leads", icon: Users },
  { name: "M\u00e9tricas", href: "/metricas", icon: BarChart3, ownerOnly: true },
  { name: "Cobran\u00e7as", href: "/cobrancas", icon: CreditCard },
  { name: "WhatsApp", href: "/whatsapp", icon: MessageSquare },
];

export function AppLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const location = useLocation();
  const navigate = useNavigate();
  const currentUser = authService.getCurrentUser();

  useEffect(() => {
    if (!authService.isAuthenticated()) {
      navigate("/login", { replace: true });
    }
  }, [navigate]);

  const allowedNavigation = useMemo(
    () => navigation.filter((item) => !(item.ownerOnly && currentUser?.role === "VENDEDOR")),
    [currentUser?.role],
  );

  const handleLogout = () => {
    authService.logout();
    navigate("/login", { replace: true });
  };

  const currentPage =
    allowedNavigation.find((item) => location.pathname === item.href || location.pathname.startsWith(`${item.href}/`))?.name ||
    "Dashboard";
  const initials = currentUser?.nome
    ? currentUser.nome
        .split(" ")
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() ?? "")
        .join("")
    : "AD";

  return (
    <div className="min-h-screen bg-gray-50">
      <aside className="hidden md:fixed md:inset-y-0 md:flex md:w-64 md:flex-col">
        <div className="flex flex-col flex-grow border-r border-gray-200 bg-white shadow-sm">
          <div className="flex h-16 items-center justify-center bg-white px-6 shadow-md">
            <img src={brandAssets.logo} alt="Eletro R\u00e1dio Esperan\u00e7a" className="h-12 w-auto object-contain" />
          </div>

          <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
            {allowedNavigation.map((item) => {
              const isActive = location.pathname === item.href;
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                    isActive
                      ? "bg-primary text-white shadow-md"
                      : "text-gray-700 hover:bg-green-50 hover:text-primary"
                  }`}
                >
                  <item.icon className={`mr-3 h-5 w-5 ${isActive ? "text-white" : "text-gray-500"}`} />
                  {item.name}
                </Link>
              );
            })}
          </nav>

          <div className="flex-shrink-0 border-t border-gray-200 p-4">
            <div className="flex items-center">
              <Avatar className="h-10 w-10">
                <AvatarFallback className="bg-primary text-white">{initials}</AvatarFallback>
              </Avatar>
              <div className="ml-3">
                <p className="text-sm font-medium text-gray-700">{currentUser?.nome ?? "Usu\u00e1rio"}</p>
                <p className="text-xs text-gray-500">{currentUser?.login ?? ""}</p>
              </div>
            </div>
          </div>
        </div>
      </aside>

      <div className="md:pl-64">
        <header className="sticky top-0 z-40 border-b border-gray-200 bg-white shadow-sm">
          <div className="flex h-16 items-center justify-between px-4 sm:px-6 lg:px-8">
            <div className="flex items-center">
              <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
                <SheetTrigger asChild className="md:hidden">
                  <Button variant="ghost" size="icon">
                    <Menu className="h-6 w-6" />
                  </Button>
                </SheetTrigger>
                <SheetContent side="left" className="w-64 p-0">
                  <div className="flex h-full flex-col bg-white">
                    <div className="flex h-16 items-center justify-center bg-white px-6 shadow-md">
                      <img src={brandAssets.logo} alt="Eletro R\u00e1dio Esperan\u00e7a" className="h-12 w-auto object-contain" />
                    </div>

                    <nav className="flex-1 space-y-1 overflow-y-auto px-4 py-6">
                      {allowedNavigation.map((item) => {
                        const isActive = location.pathname === item.href;
                        return (
                          <Link
                            key={item.name}
                            to={item.href}
                            onClick={() => setMobileMenuOpen(false)}
                            className={`flex items-center rounded-lg px-4 py-3 text-sm font-medium transition-all ${
                              isActive
                                ? "bg-primary text-white shadow-md"
                                : "text-gray-700 hover:bg-green-50 hover:text-primary"
                            }`}
                          >
                            <item.icon className={`mr-3 h-5 w-5 ${isActive ? "text-white" : "text-gray-500"}`} />
                            {item.name}
                          </Link>
                        );
                      })}
                    </nav>
                  </div>
                </SheetContent>
              </Sheet>

              <h1 className="ml-4 text-xl font-semibold text-gray-900 md:ml-0">{currentPage}</h1>
            </div>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full">
                  <Avatar className="h-10 w-10">
                    <AvatarFallback className="bg-primary text-white">{initials}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-medium leading-none">{currentUser?.nome ?? "Usu\u00e1rio"}</p>
                    <p className="text-xs leading-none text-muted-foreground">{currentUser?.login ?? ""}</p>
                    <p className="text-xs leading-none text-muted-foreground">
                      {currentUser?.role === "VENDEDOR" ? "Vendedor" : "Propriet\u00e1rio"}
                    </p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-red-600">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>Sair</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <main className="p-4 sm:p-6 lg:p-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
