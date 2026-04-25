import { useNavigate } from "react-router-dom";
import { OrderForm } from "@/features/new-order";

export function NewOrderPage() {
  const navigate = useNavigate();

  return (
    <div className="py-4">
      <OrderForm
        onCreated={() => navigate("/orders")}
        onStudioBat={() => navigate("/studio-bat")}
        onStudioBatForOrder={(orderId) => navigate(`/studio-bat/${orderId}`)}
        onCancel={() => navigate("/orders")}
      />
    </div>
  );
}
