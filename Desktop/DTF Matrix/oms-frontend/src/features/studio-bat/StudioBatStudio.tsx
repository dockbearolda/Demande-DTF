import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { AxiosError } from "axios";
import { useOrder } from "@/hooks/useOrders";
import { useUploadBat } from "@/hooks/useBats";
import { useToast } from "@/components/Toast";
import { CanvasStage } from "./components/CanvasStage";
import { SidePanel } from "./components/SidePanel";
import { TopBar } from "./components/TopBar";
import { ViewTabs } from "./components/ViewTabs";
import { useStudioStore } from "./store";
import { VIEW_ORDER, type ViewState } from "./types";

interface StudioBatStudioProps {
  orderId: string | undefined;
  backTo: string;
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = (e) => reject(e);
    img.src = src;
  });
}

async function renderView(view: ViewState): Promise<Blob | null> {
  if (!view.mockup) return null;
  const mock = await loadImage(view.mockup.dataUrl);
  const c = document.createElement("canvas");
  const targetW = 2480;
  c.width = targetW;
  c.height = Math.round(targetW * (mock.naturalHeight / mock.naturalWidth));
  const ctx = c.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(mock, 0, 0, c.width, c.height);
  if (view.logo) {
    const logo = await loadImage(view.logo.dataUrl);
    const lw = (view.logoWidthPct / 100) * c.width;
    const lh = lw * (logo.naturalHeight / logo.naturalWidth);
    const cx = (view.positionXPct / 100) * c.width;
    const cy = (view.positionYPct / 100) * c.height;
    ctx.drawImage(logo, cx - lw / 2, cy - lh / 2, lw, lh);
  }
  return new Promise((resolve) => c.toBlob((b) => resolve(b), "image/png", 0.95));
}

export function StudioBatStudio({ orderId, backTo }: StudioBatStudioProps) {
  const navigate = useNavigate();
  const { show } = useToast();
  const { data: order } = useOrder(orderId);
  const upload = useUploadBat();
  const views = useStudioStore((s) => s.views);
  const [isGenerating, setIsGenerating] = useState(false);

  async function handleGenerate() {
    if (!orderId) {
      show("Commande introuvable", "error");
      return;
    }
    const firstWithMockup = VIEW_ORDER.map((id) => views[id]).find((v) => v.mockup);
    if (!firstWithMockup) {
      show("Ajoutez au moins un mockup", "error");
      return;
    }
    setIsGenerating(true);
    try {
      const blob = await renderView(firstWithMockup);
      if (!blob) {
        show("Génération impossible", "error");
        return;
      }
      const file = new File([blob], `bat-${orderId}.png`, { type: "image/png" });
      await upload.mutateAsync({ order_id: orderId, file });
      show("BAT envoyé au client", "success");
      navigate(backTo);
    } catch (err) {
      const e = err as AxiosError<{ detail?: string }>;
      show(`Erreur : ${e.response?.data?.detail ?? "envoi impossible"}`, "error");
    } finally {
      setIsGenerating(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col bg-slate-50 dark:bg-slate-950">
      <TopBar
        order={order}
        backTo={backTo}
        onSkip={() => navigate(backTo)}
        onGenerate={handleGenerate}
        isGenerating={isGenerating || upload.isPending}
      />

      <div className="flex min-h-0 flex-1">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 p-6">
            <CanvasStage />
          </div>
          <ViewTabs />
        </div>
        <SidePanel />
      </div>
    </div>
  );
}
