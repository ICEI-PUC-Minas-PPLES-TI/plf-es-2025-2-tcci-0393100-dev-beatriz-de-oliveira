import { useMemo, useState } from "react";
import { Plus, Tag, Edit, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "../components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "../components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "../components/ui/alert-dialog";
import { Badge } from "../components/ui/badge";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { useProdutosLookup, usePromocoesData } from "../hooks/useAdminData";
import { adminDataService } from "../services/adminDataService";
import type { Promocao, PromocaoTipo } from "../types/domain";

interface PromocaoFormData {
  produto_id: string;
  tipo: PromocaoTipo;
  desconto: string;
  ativa: boolean;
  inicio_em: string;
  fim_em: string;
}

const EMPTY_FORM: PromocaoFormData = {
  produto_id: "",
  tipo: "PROMOCAO",
  desconto: "0",
  ativa: true,
  inicio_em: "",
  fim_em: "",
};

type PromocaoStatus = "ativa" | "inativa" | "agendada";

function formatDateOnly(value: string): string {
  const [year, month, day] = value.split("-");
  if (!year || !month || !day) {
    return value;
  }

  return `${day}/${month}/${year}`;
}

function getTodayIso(): string {
  const parts = new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const year = parts.find((part) => part.type === "year")?.value ?? "0000";
  const month = parts.find((part) => part.type === "month")?.value ?? "00";
  const day = parts.find((part) => part.type === "day")?.value ?? "00";

  return `${year}-${month}-${day}`;
}

function getPromocaoStatus(promo: Pick<Promocao, "ativa" | "inicio_em" | "fim_em">): PromocaoStatus {
  if (!promo.ativa) {
    return "inativa";
  }

  const today = getTodayIso();
  if (promo.inicio_em && promo.inicio_em > today) {
    return "agendada";
  }

  if (promo.fim_em && promo.fim_em < today) {
    return "inativa";
  }

  return "ativa";
}

function getPromocaoStatusLabel(status: PromocaoStatus): string {
  if (status === "agendada") return "Agendada";
  if (status === "ativa") return "Ativa";
  return "Inativa";
}

function getPromocaoStatusClass(status: PromocaoStatus): string {
  if (status === "agendada") return "bg-blue-500";
  if (status === "ativa") return "bg-green-500";
  return "bg-gray-500";
}

function normalizeDiscount(value: string): string {
  const parsed = Number.parseFloat(value.replace(",", "."));
  if (Number.isNaN(parsed)) {
    return "0";
  }

  return Math.min(100, Math.max(0, parsed)).toString();
}

function formatDiscount(value: string): string {
  const parsed = Number.parseFloat(value);
  if (Number.isNaN(parsed)) {
    return "0";
  }

  return parsed.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}

export function Promocoes() {
  const { data: promocoes, isLoading, error, reload } = usePromocoesData();
  const [filtroTipo, setFiltroTipo] = useState("todos");
  const [filtroAtiva, setFiltroAtiva] = useState("todos");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [produtoSearch, setProdutoSearch] = useState("");
  const { data: produtos } = useProdutosLookup(produtoSearch, dialogOpen);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  const [formData, setFormData] = useState<PromocaoFormData>(EMPTY_FORM);

  const filteredPromocoes = useMemo(
    () =>
      promocoes.filter((promo) => {
        const matchesTipo = filtroTipo === "todos" || promo.tipo === filtroTipo;
        const status = getPromocaoStatus(promo);
        const matchesAtiva = filtroAtiva === "todos" || filtroAtiva === status;
        return matchesTipo && matchesAtiva;
      }),
    [filtroAtiva, filtroTipo, promocoes],
  );

  const isPromocaoTipo = (value: string): value is PromocaoTipo => value === "PROMOCAO" || value === "DESTAQUE";

  const handleOpenDialog = (promocao?: Promocao) => {
    if (promocao) {
      setEditingId(promocao.id);
      setFormData({
        produto_id: promocao.produto_id.toString(),
        tipo: promocao.tipo,
        desconto: promocao.desconto ?? "0",
        ativa: promocao.ativa,
        inicio_em: promocao.inicio_em,
        fim_em: promocao.fim_em,
      });
      setProdutoSearch(promocao.produto);
    } else {
      setEditingId(null);
      setFormData(EMPTY_FORM);
      setProdutoSearch("");
    }
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.produto_id || !formData.inicio_em || !formData.fim_em) {
      toast.error("Preencha os campos obrigatórios");
      return;
    }

    const produtoId = Number(formData.produto_id);
    const produto = produtos.find((item) => item.id === produtoId);
    if (!produto) {
      toast.error("Produto não encontrado");
      return;
    }

    if (formData.fim_em < formData.inicio_em) {
      toast.error("A data final deve ser igual ou posterior à data inicial");
      return;
    }

    const payload = {
      produto_id: produtoId,
      produto: produto.nome,
      imagem: produto.imagem,
      tipo: formData.tipo,
      desconto: normalizeDiscount(formData.desconto),
      ativa: formData.ativa,
      inicio_em: formData.inicio_em,
      fim_em: formData.fim_em,
    };

    setIsSubmitting(true);
    try {
      if (editingId) {
        await adminDataService.updatePromocao(editingId, payload);
        toast.success("Promoção atualizada");
      } else {
        await adminDataService.createPromocao(payload);
        toast.success("Promoção criada");
      }
      await reload();
      setDialogOpen(false);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Falha ao salvar promoção";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: number) => {
    setIsDeleting(true);
    try {
      await adminDataService.deletePromocao(id);
      await reload();
      toast.success("Promoção excluída");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Falha ao excluir promoção";
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setDeleteId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Promoções e Destaques</h2>
          <p className="mt-1 text-muted-foreground">Gerencie ofertas e produtos em destaque</p>
          {error && <p className="mt-2 text-sm text-red-600">Erro ao carregar promoções: {error}</p>}
        </div>
        <Button onClick={() => handleOpenDialog()} className="shadow-md">
          <Plus className="mr-2 h-4 w-4" />
          Nova Promoção
        </Button>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Select value={filtroTipo} onValueChange={setFiltroTipo}>
          <SelectTrigger>
            <SelectValue placeholder="Tipo de promoção" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Tipos</SelectItem>
            <SelectItem value="PROMOCAO">Promoção</SelectItem>
            <SelectItem value="DESTAQUE">Destaque</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filtroAtiva} onValueChange={setFiltroAtiva}>
          <SelectTrigger>
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos</SelectItem>
            <SelectItem value="ativa">Ativas</SelectItem>
            <SelectItem value="agendada">Agendadas</SelectItem>
            <SelectItem value="inativa">Inativas</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-muted-foreground shadow-md">
          Carregando promoções...
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
          {filteredPromocoes.map((promo) => {
            const status = getPromocaoStatus(promo);

            return (
            <Card key={promo.id} className="overflow-hidden shadow-md transition-shadow hover:shadow-lg">
              <div className="relative">
                <ImageWithFallback src={promo.imagem} alt={promo.produto} className="h-48 w-full object-cover" />
                <div className="absolute top-3 right-3">
                  <Badge className={getPromocaoStatusClass(status)}>{getPromocaoStatusLabel(status)}</Badge>
                </div>
                <div className="absolute top-3 left-3">
                  <Badge className={promo.tipo === "PROMOCAO" ? "bg-red-500" : "bg-yellow-500"}>
                    {promo.tipo === "PROMOCAO" ? "PROMOÇÃO" : "DESTAQUE"}
                  </Badge>
                </div>
              </div>
              <CardHeader>
                <CardTitle className="text-lg">{promo.produto}</CardTitle>
                <CardDescription>
                  {formatDateOnly(promo.inicio_em)} até {formatDateOnly(promo.fim_em)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="mb-4 flex items-center justify-between rounded-md bg-gray-50 px-3 py-2 text-sm">
                  <span className="text-muted-foreground">Desconto</span>
                  <span className="font-semibold text-primary">{formatDiscount(promo.desconto)}%</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => handleOpenDialog(promo)} className="flex-1">
                    <Edit className="mr-2 h-4 w-4" />
                    Editar
                  </Button>
                  <Button variant="ghost" size="sm" onClick={() => setDeleteId(promo.id)}>
                    <Trash2 className="h-4 w-4 text-red-600" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          );
          })}
        </div>
      )}

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle className="flex items-center">
              <Tag className="mr-2 h-5 w-5 text-primary" />
              {editingId ? "Editar Promoção" : "Nova Promoção"}
            </DialogTitle>
            <DialogDescription>Configure a promoção ou destaque do produto</DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="produto_search">Produto *</Label>
              <Input
                id="produto_search"
                list="promocoes-produtos-sugestoes"
                value={produtoSearch}
                onChange={(event) => {
                  const value = event.target.value;
                  const produto = produtos.find((item) => item.nome === value);
                  setProdutoSearch(value);
                  setFormData({ ...formData, produto_id: produto ? produto.id.toString() : "" });
                }}
                placeholder="Digite para buscar e selecione um produto"
              />
              <datalist id="promocoes-produtos-sugestoes">
                {produtos.map((produto) => (
                  <option key={produto.id} value={produto.nome} />
                ))}
              </datalist>
            </div>

            <div className="space-y-2">
              <Label htmlFor="tipo">Tipo *</Label>
              <Select
                value={formData.tipo}
                onValueChange={(value) => {
                  if (isPromocaoTipo(value)) {
                    setFormData({ ...formData, tipo: value });
                  }
                }}
              >
                <SelectTrigger id="tipo">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PROMOCAO">Promoção</SelectItem>
                  <SelectItem value="DESTAQUE">Destaque</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="desconto">Desconto (%) *</Label>
              <Input
                id="desconto"
                type="number"
                min="0"
                max="100"
                step="0.01"
                value={formData.desconto}
                onChange={(event) => setFormData({ ...formData, desconto: event.target.value })}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="inicio_em">Data Início *</Label>
                <Input
                  id="inicio_em"
                  type="date"
                  value={formData.inicio_em}
                  onChange={(e) => setFormData({ ...formData, inicio_em: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fim_em">Data Fim *</Label>
                <Input
                  id="fim_em"
                  type="date"
                  value={formData.fim_em}
                  onChange={(e) => setFormData({ ...formData, fim_em: e.target.value })}
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <Switch id="ativa" checked={formData.ativa} onCheckedChange={(checked) => setFormData({ ...formData, ativa: checked })} />
              <Label htmlFor="ativa" className="cursor-pointer">
                Promoção ativa
              </Label>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={() => void handleSubmit()} disabled={isSubmitting}>
              {isSubmitting ? "Salvando..." : editingId ? "Salvar Alterações" : "Criar Promoção"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={deleteId !== null} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir esta promoção? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
              onClick={() => {
                if (deleteId !== null) {
                  void handleDelete(deleteId);
                }
              }}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}



