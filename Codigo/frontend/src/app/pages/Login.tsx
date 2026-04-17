import { useEffect, useState } from "react";
import { useNavigate } from "react-router";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { brandAssets } from "../lib/assets";
import { authService } from "../services/authService";

export function Login() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (authService.isAuthenticated()) {
      navigate("/", { replace: true });
    }
  }, [navigate]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await authService.login({ email, senha });
      toast.success("Login realizado com sucesso!");
      navigate("/", { replace: true });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha no login";
      toast.error(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-gradient-to-br from-green-50 via-white to-green-50 p-4">
      <div className="absolute inset-0 opacity-5">
        <div className="absolute left-10 top-10 h-72 w-72 rounded-full bg-primary blur-3xl" />
        <div className="absolute bottom-10 right-10 h-96 w-96 rounded-full bg-green-400 blur-3xl" />
      </div>

      <div
        className="absolute inset-0 opacity-10"
        style={{
          backgroundImage:
            "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%2310B981' fill-opacity='0.4'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
        }}
      />

      <Card className="relative z-10 w-full max-w-md border-0 shadow-2xl">
        <CardHeader className="space-y-3 pb-8 text-center">
          <div className="mb-4 flex justify-center">
            <img src={brandAssets.logo} alt="Eletro Rádio Esperança" className="h-32 w-auto object-contain" />
          </div>
          <CardTitle className="text-3xl font-bold">Eletro Rádio Esperança</CardTitle>
          <CardDescription className="text-base">Painel Administrativo</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="senha">Senha</Label>
              <Input
                id="senha"
                type="password"
                placeholder="********"
                value={senha}
                onChange={(e) => setSenha(e.target.value)}
                required
                className="h-11"
              />
            </div>
            <Button type="submit" className="mt-6 h-11 w-full text-base" disabled={loading}>
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Entrando...
                </>
              ) : (
                "Entrar"
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}