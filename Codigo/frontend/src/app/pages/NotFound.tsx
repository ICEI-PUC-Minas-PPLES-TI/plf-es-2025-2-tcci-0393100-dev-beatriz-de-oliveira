import { Link } from "react-router";
import { Button } from "../components/ui/button";
import { Home, AlertCircle } from "lucide-react";

export function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-green-50 via-white to-green-50 p-4">
      <div className="text-center">
        <div className="flex justify-center mb-6">
          <div className="bg-red-100 p-6 rounded-full">
            <AlertCircle className="h-20 w-20 text-red-600" />
          </div>
        </div>
        <h1 className="text-6xl font-bold text-gray-900 mb-4">404</h1>
        <h2 className="text-2xl font-semibold text-gray-700 mb-4">Página não encontrada</h2>
        <p className="text-muted-foreground mb-8 max-w-md">
          A página que você está procurando não existe ou foi movida.
        </p>
        <Link to="/">
          <Button size="lg">
            <Home className="mr-2 h-5 w-5" />
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>
    </div>
  );
}
