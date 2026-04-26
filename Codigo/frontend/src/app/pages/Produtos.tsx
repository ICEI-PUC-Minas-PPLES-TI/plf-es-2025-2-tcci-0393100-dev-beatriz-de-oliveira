import { type ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import { Download, Plus, Search, Edit, Trash2, Package, Upload } from "lucide-react";
import { toast } from "sonner";
import { EmptyState } from "../components/EmptyState";
import { ImageWithFallback } from "../components/ImageWithFallback";
import { StatusBadge } from "../components/StatusBadge";
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
import { Button } from "../components/ui/button";
import { Input } from "../components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "../components/ui/table";
import { useProdutosData } from "../hooks/useAdminData";
import { adminDataService } from "../services/adminDataService";
import type { Produto } from "../types/domain";

const PRODUCT_CSV_HEADERS = ["nome", "categoria", "descricao", "preco", "quantidade", "disponivel", "imagem"];

function escapeCsvValue(value: unknown): string {
  const text = String(value ?? "");
  return /[",\n\r;]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function downloadCsv(filename: string, rows: unknown[][]): void {
  const csv = rows.map((row) => row.map(escapeCsvValue).join(";")).join("\n");
  const blob = new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function parseCsvLine(line: string, delimiter: ";" | ","): string[] {
  const values: string[] = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === delimiter && !quoted) {
      values.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  values.push(current.trim());
  return values;
}

function parseProductCsv(content: string): Array<Record<string, string>> {
  const lines = content.split(/\r?\n/).filter((line) => line.trim().length > 0);
  if (lines.length < 2) {
    return [];
  }

  const headerLine = lines[0]!;
  const delimiter = (headerLine.match(/;/g)?.length ?? 0) >= (headerLine.match(/,/g)?.length ?? 0) ? ";" : ",";
  const headers = parseCsvLine(headerLine, delimiter).map((header) => header.trim().toLowerCase());
  return lines.slice(1).map((line) => {
    const values = parseCsvLine(line, delimiter);
    return headers.reduce<Record<string, string>>((record, header, index) => {
      record[header] = values[index] ?? "";
      return record;
    }, {});
  });
}

function parseCsvBoolean(value: string): boolean {
  return ["1", "true", "sim", "s", "yes", "disponivel", "disponível"].includes(value.trim().toLowerCase());
}

export function Produtos() {
  const { data: produtos, isLoading, error, reload } = useProdutosData();
  const navigate = useNavigate();
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const pageSize = 20;
  const categorias = useMemo(() => Array.from(new Set(produtos.map((produto) => produto.categoria).filter(Boolean))), [produtos]);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoria, setCategoria] = useState("todas");
  const [disponibilidade, setDisponibilidade] = useState("todas");
  const [deleteDialog, setDeleteDialog] = useState<number | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageInput, setPageInput] = useState("1");

  const handleDelete = async (id: number) => {
    try {
      await adminDataService.deleteProduto(id);
      await reload();
      toast.success("Produto excluído com sucesso");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Falha ao excluir produto";
      toast.error(message);
    } finally {
      setDeleteDialog(null);
    }
  };

  const handleToggleDisponibilidade = async (id: number) => {
    const produto = produtos.find((item) => item.id === id);
    if (!produto) {
      toast.error("Produto não encontrado");
      return;
    }

    try {
      await adminDataService.updateProduto(id, { disponivel: !produto.disponivel });
      await reload();
      toast.success("Disponibilidade atualizada");
    } catch (updateError) {
      const message = updateError instanceof Error ? updateError.message : "Falha ao atualizar disponibilidade";
      toast.error(message);
    }
  };

  const handleExportCsv = () => {
    const rows = [
      PRODUCT_CSV_HEADERS,
      ...filteredProdutos.map((produto) => [
        produto.nome,
        produto.categoria,
        produto.descricao,
        produto.preco,
        produto.quantidade ?? 0,
        produto.disponivel ? "true" : "false",
        produto.imagem,
      ]),
    ];

    downloadCsv("produtos.csv", rows);
    toast.success("CSV de produtos exportado");
  };

  const handleImportCsv = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) {
      return;
    }

    try {
      const rows = parseProductCsv(await file.text());
      if (rows.length === 0) {
        toast.error("CSV vazio ou sem linhas de produto");
        return;
      }

      const produtosCsv: Array<Omit<Produto, "id">> = rows.map((row) => ({
        nome: row.nome?.trim() ?? "",
        categoria: row.categoria?.trim() ?? "",
        descricao: row.descricao?.trim() ?? "",
        preco: row.preco?.trim() ?? "",
        quantidade: Math.max(0, Number.parseInt(row.quantidade || "0", 10) || 0),
        disponivel: parseCsvBoolean(row.disponivel ?? row.disponibilidade ?? "true"),
        imagem: row.imagem?.trim() ?? "",
      }));

      const invalidRows = produtosCsv.filter((produto) => !produto.nome || !produto.categoria || !produto.descricao || !produto.preco || !produto.imagem);
      if (invalidRows.length > 0) {
        toast.error("CSV precisa conter nome, categoria, descricao, preco e imagem em todas as linhas");
        return;
      }

      await Promise.all(produtosCsv.map((produto) => adminDataService.createProduto(produto)));
      await reload();
      toast.success(`${produtosCsv.length} produto(s) importado(s)`);
    } catch (importError) {
      const message = importError instanceof Error ? importError.message : "Falha ao importar CSV";
      toast.error(message);
    }
  };

  const filteredProdutos = useMemo(() => produtos.filter((produto) => {
    const matchesSearch = produto.nome.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategoria = categoria === "todas" || produto.categoria === categoria;
    const matchesDisponibilidade =
      disponibilidade === "todas" ||
      (disponibilidade === "disponivel" && produto.disponivel) ||
      (disponibilidade === "indisponivel" && !produto.disponivel);

    return matchesSearch && matchesCategoria && matchesDisponibilidade;
  }), [categoria, disponibilidade, produtos, searchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredProdutos.length / pageSize));
  const paginatedProdutos = filteredProdutos.slice((currentPage - 1) * pageSize, currentPage * pageSize);
  const startItem = filteredProdutos.length === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, filteredProdutos.length);

  useEffect(() => {
    setCurrentPage(1);
  }, [categoria, disponibilidade, searchTerm]);

  useEffect(() => {
    if (currentPage > totalPages) {
      setCurrentPage(totalPages);
    }
  }, [currentPage, totalPages]);

  useEffect(() => {
    setPageInput(String(currentPage));
  }, [currentPage]);

  const goToPage = (page: number) => {
    const safePage = Math.min(totalPages, Math.max(1, page));
    setCurrentPage(safePage);
  };

  const handlePageSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const parsedPage = Number.parseInt(pageInput, 10);
    if (Number.isNaN(parsedPage)) {
      setPageInput(String(currentPage));
      return;
    }
    goToPage(parsedPage);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Catálogo de Produtos</h2>
          <p className="mt-1 text-muted-foreground">Gerencie móveis e eletrodomésticos da loja</p>
          {error && <p className="mt-2 text-sm text-red-600">Erro ao carregar produtos: {error}</p>}
        </div>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept=".csv,text/csv" className="hidden" onChange={handleImportCsv} />
          <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
            <Upload className="mr-2 h-4 w-4" />
            Importar CSV
          </Button>
          <Button type="button" variant="outline" onClick={handleExportCsv} disabled={filteredProdutos.length === 0}>
            <Download className="mr-2 h-4 w-4" />
            Exportar CSV
          </Button>
          <Link to="/produtos/novo">
            <Button className="shadow-md">
              <Plus className="mr-2 h-4 w-4" />
              Novo Produto
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <div className="relative col-span-1 md:col-span-2">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={categoria} onValueChange={setCategoria}>
          <SelectTrigger>
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas Categorias</SelectItem>
            {categorias.map((categoriaNome) => (
              <SelectItem key={categoriaNome} value={categoriaNome}>
                {categoriaNome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={disponibilidade} onValueChange={setDisponibilidade}>
          <SelectTrigger>
            <SelectValue placeholder="Disponibilidade" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todas">Todas</SelectItem>
            <SelectItem value="disponivel">Disponível</SelectItem>
            <SelectItem value="indisponivel">Indisponível</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="rounded-lg border border-gray-200 bg-white p-6 text-sm text-muted-foreground shadow-md">
          Carregando produtos...
        </div>
      ) : filteredProdutos.length === 0 ? (
        <EmptyState
          icon={Package}
          title="Nenhum produto encontrado"
          description="Nenhum produto corresponde aos filtros selecionados"
          action={{
            label: "Novo Produto",
            onClick: () => navigate("/produtos/novo"),
          }}
        />
      ) : (
        <div className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-md">
          <div className="max-h-[calc(100vh-320px)] overflow-auto">
            <Table className="min-w-[1080px] table-fixed">
              <TableHeader>
                <TableRow className="bg-gray-50">
                  <TableHead className="w-20">Foto</TableHead>
                  <TableHead className="w-[320px]">Nome</TableHead>
                  <TableHead className="w-44">Categoria</TableHead>
                  <TableHead className="w-28">Preço</TableHead>
                  <TableHead className="w-28">Quantidade</TableHead>
                  <TableHead className="w-36">Disponível</TableHead>
                  <TableHead className="sticky right-0 w-28 bg-gray-50 text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.25)]">
                    Ações
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProdutos.map((produto) => (
                  <TableRow key={produto.id} className="hover:bg-gray-50">
                    <TableCell>
                      <ImageWithFallback
                        src={produto.imagem}
                        alt={produto.nome}
                        className="h-16 w-16 rounded-lg object-cover shadow-sm"
                      />
                    </TableCell>
                    <TableCell className="font-medium">
                      <span className="block truncate" title={produto.nome}>{produto.nome}</span>
                    </TableCell>
                    <TableCell>
                      <span className="inline-block max-w-full truncate rounded bg-gray-100 px-2 py-1 text-xs text-gray-700" title={produto.categoria}>
                        {produto.categoria}
                      </span>
                    </TableCell>
                    <TableCell className="font-semibold text-primary">{produto.preco}</TableCell>
                    <TableCell>{produto.quantidade ?? 0}</TableCell>
                    <TableCell>
                      <button type="button" onClick={() => handleToggleDisponibilidade(produto.id)}>
                        <StatusBadge status={produto.disponivel ? "disponivel" : "indisponivel"} />
                      </button>
                    </TableCell>
                    <TableCell className="sticky right-0 bg-white text-right shadow-[-8px_0_8px_-8px_rgba(0,0,0,0.2)]">
                      <div className="flex justify-end gap-2">
                        <Link to={`/produtos/${produto.id}`}>
                          <Button variant="ghost" size="icon" aria-label={`Editar ${produto.nome}`}>
                            <Edit className="h-4 w-4" />
                          </Button>
                        </Link>
                        <Button variant="ghost" size="icon" onClick={() => setDeleteDialog(produto.id)} aria-label={`Excluir ${produto.nome}`}>
                          <Trash2 className="h-4 w-4 text-red-600" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
          <div className="flex flex-col items-center justify-between gap-3 border-t bg-gray-50 px-4 py-3 text-sm text-muted-foreground sm:flex-row">
            <span>
              Mostrando {startItem}-{endItem} de {filteredProdutos.length} produtos
            </span>
            <div className="flex items-center gap-3">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage <= 1}
                onClick={() => goToPage(currentPage - 1)}
              >
                Anterior
              </Button>
              <form onSubmit={handlePageSubmit} className="flex items-center gap-2 font-medium text-gray-700">
                <span>Página</span>
                <Input
                  aria-label="Página atual"
                  className="h-8 w-16 text-center"
                  inputMode="numeric"
                  min={1}
                  max={totalPages}
                  type="number"
                  value={pageInput}
                  onChange={(event) => setPageInput(event.target.value)}
                  onBlur={() => {
                    if (!pageInput.trim()) {
                      setPageInput(String(currentPage));
                      return;
                    }
                    const parsedPage = Number.parseInt(pageInput, 10);
                    if (Number.isNaN(parsedPage)) {
                      setPageInput(String(currentPage));
                      return;
                    }
                    goToPage(parsedPage);
                  }}
                />
                <span>de {totalPages}</span>
              </form>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={currentPage >= totalPages}
                onClick={() => goToPage(currentPage + 1)}
              >
                Próxima
              </Button>
            </div>
          </div>
        </div>
      )}

      <AlertDialog open={deleteDialog !== null} onOpenChange={() => setDeleteDialog(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (deleteDialog !== null) {
                  void handleDelete(deleteDialog);
                }
              }}
              className="bg-red-600 hover:bg-red-700"
            >
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
