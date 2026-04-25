import { useParams } from "react-router-dom";
import { StudioBatStudio } from "@/features/studio-bat";

export function StudioBatEditorPage() {
  const { orderId } = useParams<{ orderId: string }>();
  return <StudioBatStudio orderId={orderId} backTo="/studio-bat" />;
}
