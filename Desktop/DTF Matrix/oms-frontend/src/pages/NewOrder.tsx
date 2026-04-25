import { useNavigate } from "react-router-dom";
import { OrderForm } from "@/features/new-order";

export function NewOrderPage() {
  const navigate = useNavigate();

  return (
    <div className="py-4">
      <OrderForm
        onCreated={(orderId) => navigate(`/studio-bat/${orderId}`)}
        onStudioBat={() => navigate("/studio-bat")}
        onCancel={() => navigate("/orders")}
      />
    </div>
  );
}
