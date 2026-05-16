import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { ArrowDown, ArrowLeft, ArrowUp, ImagePlus, Save, Star, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { adminDataService } from "../services/adminDataService";
import { useProdutosData } from "../hooks/useAdminData";
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
import { Breadcrumb, BreadcrumbItem, BreadcrumbLink, BreadcrumbList, BreadcrumbPage, BreadcrumbSeparator } from "../components/ui/breadcrumb";
import { Button } from "../components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "../components/ui/card";
import { Input } from "../components/ui/input";
import { Label } from "../components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "../components/ui/select";
import { Switch } from "../components/ui/switch";
import { Textarea } from "../components/ui/textarea";
import { ImageWithFallback } from "../components/ImageWithFallback";
import type { ProductImage } from "../types/domain";

interface ProdutoFormData {
  nome: string;
  categoria: string;
  descricao: string;
  preco: string;
  quantidade: string;
  disponibilidade: boolean;
  images: ProductImage[];
}

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    const objectUrl = URL.createObjectURL(file);
    image.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error("Nao foi possivel carregar a imagem selecionada."));
    };
    image.src = objectUrl;
  });
}

async function optimizeImage(file: File): Promise<string> {
  const image = await loadImage(file);
  const maxWidth = 1280;
  const scale = Math.min(1, maxWidth / image.width);
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Nao foi possivel processar a imagem selecionada.");
  }

  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.82);
}

function normalizeImages(images: ProductImage[]): ProductImage[] {
  const cleaned = images
    .map((image) => image.imageUrl.trim())
    .filter(Boolean)
    .filter((imageUrl, index, all) => all.indexOf(imageUrl) === index)
    .map((imageUrl, index) => ({
      imageUrl,
      ordem: index,
      principal: false,
    }));

  if (cleaned.length > 0) {
    const preferred = images.find((image) => image.principal && image.imageUrl.trim());
    const preferredIndex = preferred ? cleaned.findIndex((image) => image.imageUrl === preferred.imageUrl.trim()) : -1;
    cleaned[preferredIndex >= 0 ? preferredIndex : 0] = {
      ...cleaned[preferredIndex >= 0 ? preferredIndex : 0]!,
      principal: true,
    };
  }

  return cleaned;
}

function isHttpUrl(value: string): boolean {
  try {
    const parsed = new URL(value);
    return parsed.protocol === "http:" || parsed.protocol === "https:";
  } catch {
    return false;
  }
}

export function ProdutoForm() {
  const { id } = useParams();
  const navigate = useNavigate();
  const isEdit = Boolean(id);
  const { data: produtos, isLoading: isLoadingProdutos } = useProdutosData();
  const produtoAtual = useMemo(
    () => produtos.find((produto) => produto.id.toString() === id),
    [id, produtos],
  );
  const categoriaOptions = useMemo(
    () =>
      Array.from(
        new Set([
          ...produtos.map((produto) => produto.categoria),
          "Sofas",
          "Eletrodomesticos",
          "Eletronicos",
          "Mesas",
          "Guarda-Roupas",
          "Camas",
          "Outros",
        ].filter(Boolean)),
      ),
    [produtos],
  );

  const [formData, setFormData] = useState<ProdutoFormData>({
    nome: "",
    categoria: "",
    descricao: "",
    preco: "",
    quantidade: "0",
    disponibilidade: false,
    images: [],
  });
  const [newImageUrl, setNewImageUrl] = useState("");
  const [deleteDialog, setDeleteDialog] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  useEffect(() => {
    if (isEdit && produtoAtual) {
      const productImages =
        produtoAtual.images?.length > 0
          ? produtoAtual.images
          : produtoAtual.imagem
            ? [{ imageUrl: produtoAtual.imagem, ordem: 0, principal: true }]
            : [];

      setFormData({
        nome: produtoAtual.nome,
        categoria: produtoAtual.categoria,
        descricao: produtoAtual.descricao,
        preco: produtoAtual.preco,
        quantidade: String(produtoAtual.quantidade ?? 0),
        disponibilidade: produtoAtual.disponivel,
        images: normalizeImages(productImages),
      });
    }
  }, [isEdit, produtoAtual]);

  useEffect(() => {
    if (!isEdit || isLoadingProdutos) {
      return;
    }

    if (!produtoAtual) {
      toast.error("Produto nao encontrado");
      navigate("/produtos", { replace: true });
    }
  }, [isEdit, isLoadingProdutos, navigate, produtoAtual]);

  const updateImages = (updater: (images: ProductImage[]) => ProductImage[]) => {
    setFormData((current) => ({
      ...current,
      images: normalizeImages(updater(current.images)),
    }));
  };

  const handleImageChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) {
      return;
    }

    const invalidFile = files.find((file) => !file.type.startsWith("image/"));
    if (invalidFile) {
      toast.error("Selecione apenas arquivos de imagem validos.");
      event.target.value = "";
      return;
    }

    setIsUploadingImage(true);
    try {
      const imageDataUrls = await Promise.all(files.map((file) => optimizeImage(file)));
      updateImages((images) => [
        ...images,
        ...imageDataUrls.map((imageUrl) => ({
          imageUrl,
          ordem: images.length,
          principal: images.length === 0,
        })),
      ]);
      toast.success(`${imageDataUrls.length} imagem(ns) adicionada(s)`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Falha ao carregar imagem";
      toast.error(message);
    } finally {
      setIsUploadingImage(false);
      event.target.value = "";
    }
  };

  const handleAddImageUrl = () => {
    const imageUrl = newImageUrl.trim();
    if (!isHttpUrl(imageUrl)) {
      toast.error("Informe uma URL http ou https valida.");
      return;
    }

    updateImages((images) => [
      ...images,
      {
        imageUrl,
        ordem: images.length,
        principal: images.length === 0,
      },
    ]);
    setNewImageUrl("");
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setIsSubmitting(true);

    const images = normalizeImages(formData.images);
    const primaryImage = images.find((image) => image.principal)?.imageUrl ?? images[0]?.imageUrl ?? "";
    if (!primaryImage) {
      toast.error("Adicione pelo menos uma imagem valida para o produto.");
      setIsSubmitting(false);
      return;
    }

    try {
      const quantidade = Math.max(0, Number.parseInt(formData.quantidade || "0", 10));
      const payload = {
        nome: formData.nome,
        categoria: formData.categoria,
        descricao: formData.descricao,
        preco: formData.preco,
        quantidade: Number.isNaN(quantidade) ? 0 : quantidade,
        disponivel: formData.disponibilidade,
        imagem: primaryImage,
        primaryImage,
        images,
      };

      if (isEdit && id) {
        await adminDataService.updateProduto(Number(id), payload);
        toast.success("Produto atualizado com sucesso");
      } else {
        await adminDataService.createProduto(payload);
        toast.success("Produto criado com sucesso");
      }

      navigate("/produtos");
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "Falha ao salvar produto";
      toast.error(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!id) {
      return;
    }

    setIsDeleting(true);
    try {
      await adminDataService.deleteProduto(Number(id));
      toast.success("Produto excluido com sucesso");
      navigate("/produtos");
    } catch (deleteError) {
      const message = deleteError instanceof Error ? deleteError.message : "Falha ao excluir produto";
      toast.error(message);
    } finally {
      setIsDeleting(false);
      setDeleteDialog(false);
    }
  };

  const moveImage = (index: number, direction: -1 | 1) => {
    updateImages((images) => {
      const next = [...images];
      const targetIndex = index + direction;
      if (targetIndex < 0 || targetIndex >= next.length) {
        return next;
      }
      [next[index], next[targetIndex]] = [next[targetIndex]!, next[index]!];
      return next;
    });
  };

  return (
    <div className="space-y-6">
      <Breadcrumb>
        <BreadcrumbList>
          <BreadcrumbItem>
            <BreadcrumbLink asChild>
              <Link to="/produtos">Produtos</Link>
            </BreadcrumbLink>
          </BreadcrumbItem>
          <BreadcrumbSeparator />
          <BreadcrumbItem>
            <BreadcrumbPage>{isEdit ? "Editar Produto" : "Novo Produto"}</BreadcrumbPage>
          </BreadcrumbItem>
        </BreadcrumbList>
      </Breadcrumb>

      <div className="flex flex-col items-start justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">{isEdit ? "Editar Produto" : "Cadastrar Novo Produto"}</h2>
          <p className="mt-1 text-muted-foreground">
            {isEdit ? "Atualize as informacoes do produto" : "Preencha os dados do produto"}
          </p>
        </div>
        <Button variant="outline" onClick={() => navigate("/produtos")}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Voltar
        </Button>
      </div>

      <form onSubmit={handleSubmit}>
        <Card className="shadow-md">
          <CardHeader>
            <CardTitle>Informações do Produto</CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nome">Nome do Produto *</Label>
                <Input
                  id="nome"
                  value={formData.nome}
                  onChange={(event) => setFormData({ ...formData, nome: event.target.value })}
                  required
                  placeholder="Ex: Sofa Retratil Premium"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="categoria">Categoria *</Label>
                <Select
                  value={formData.categoria}
                  onValueChange={(value) => setFormData({ ...formData, categoria: value })}
                >
                  <SelectTrigger id="categoria">
                    <SelectValue placeholder="Selecione uma categoria" />
                  </SelectTrigger>
                  <SelectContent>
                    {categoriaOptions.map((categoriaOption) => (
                      <SelectItem key={categoriaOption} value={categoriaOption}>
                        {categoriaOption}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="descricao">Descrição *</Label>
                <Textarea
                  id="descricao"
                  value={formData.descricao}
                  onChange={(event) => setFormData({ ...formData, descricao: event.target.value })}
                  required
                  placeholder="Descreva o produto..."
                  rows={4}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="preco">Preço (R$) *</Label>
                <Input
                  id="preco"
                  type="number"
                  step="0.01"
                  value={formData.preco}
                  onChange={(event) => setFormData({ ...formData, preco: event.target.value })}
                  required
                  placeholder="0.00"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="quantidade">Quantidade *</Label>
                <Input
                  id="quantidade"
                  type="number"
                  min="0"
                  step="1"
                  value={formData.quantidade}
                  onChange={(event) => setFormData({ ...formData, quantidade: event.target.value })}
                  required
                  placeholder="0"
                />
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label htmlFor="imagem_upload">Imagens do Produto *</Label>
                <Input
                  id="imagem_upload"
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={(event) => {
                    void handleImageChange(event);
                  }}
                  disabled={isUploadingImage}
                />
                <div className="flex flex-col gap-2 sm:flex-row">
                  <Input
                    value={newImageUrl}
                    onChange={(event) => setNewImageUrl(event.target.value)}
                    placeholder="https://exemplo.com/produto.jpg"
                  />
                  <Button type="button" variant="outline" onClick={handleAddImageUrl}>
                    <ImagePlus className="mr-2 h-4 w-4" />
                    Adicionar URL
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  A imagem principal aparece primeiro no Telegram. Fotos extras ficam na galeria do botao Ver mais fotos.
                </p>
              </div>

              <div className="space-y-3 md:col-span-2">
                <Label>Pré-visualização das Imagens</Label>
                {formData.images.length > 0 ? (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                    {formData.images.map((image, index) => (
                      <div key={`${image.imageUrl}-${index}`} className="overflow-hidden rounded-lg border border-gray-200 bg-white">
                        <ImageWithFallback
                          src={image.imageUrl}
                          alt={`${formData.nome || "Produto"} - imagem ${index + 1}`}
                          className="h-44 w-full object-cover"
                        />
                        <div className="space-y-3 p-3">
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate text-sm font-medium">Imagem {index + 1}</span>
                            {image.principal && (
                              <span className="rounded bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
                                Principal
                              </span>
                            )}
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <Button
                              type="button"
                              variant={image.principal ? "default" : "outline"}
                              size="icon"
                              aria-label={`Definir imagem ${index + 1} como principal`}
                              onClick={() =>
                                updateImages((images) =>
                                  images.map((item, itemIndex) => ({ ...item, principal: itemIndex === index })),
                                )
                              }
                            >
                              <Star className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label={`Mover imagem ${index + 1} para cima`}
                              disabled={index === 0}
                              onClick={() => moveImage(index, -1)}
                            >
                              <ArrowUp className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label={`Mover imagem ${index + 1} para baixo`}
                              disabled={index === formData.images.length - 1}
                              onClick={() => moveImage(index, 1)}
                            >
                              <ArrowDown className="h-4 w-4" />
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="icon"
                              aria-label={`Remover imagem ${index + 1}`}
                              onClick={() => updateImages((images) => images.filter((_, itemIndex) => itemIndex !== index))}
                            >
                              <Trash2 className="h-4 w-4 text-red-600" />
                            </Button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex h-32 w-full max-w-sm items-center justify-center rounded-lg border border-dashed border-gray-300 bg-gray-50 text-sm text-muted-foreground">
                    <div className="flex items-center gap-2">
                      <Upload className="h-4 w-4" />
                      Nenhuma imagem selecionada
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center space-x-3 md:col-span-2">
                <Switch
                  id="disponibilidade"
                  checked={formData.disponibilidade}
                  onCheckedChange={(checked) => setFormData({ ...formData, disponibilidade: checked })}
                />
                <Label htmlFor="disponibilidade" className="cursor-pointer">
                  Produto disponível para venda
                </Label>
              </div>
            </div>

            <div className="flex flex-col justify-between gap-4 border-t pt-6 sm:flex-row">
              <div>
                {isEdit && (
                  <Button type="button" variant="destructive" onClick={() => setDeleteDialog(true)} disabled={isDeleting}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Excluir Produto
                  </Button>
                )}
              </div>
              <div className="flex gap-3">
                <Button type="button" variant="outline" onClick={() => navigate("/produtos")}>
                  Cancelar
                </Button>
                <Button type="submit" disabled={isSubmitting || isUploadingImage}>
                  <Save className="mr-2 h-4 w-4" />
                  {isSubmitting || isUploadingImage ? "Salvando..." : isEdit ? "Salvar Alterações" : "Cadastrar Produto"}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </form>

      <AlertDialog open={deleteDialog} onOpenChange={setDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              Tem certeza que deseja excluir este produto? Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                void handleDelete();
              }}
              className="bg-red-600 hover:bg-red-700"
              disabled={isDeleting}
            >
              {isDeleting ? "Excluindo..." : "Excluir"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
