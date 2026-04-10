import { Link, useParams } from "react-router";
import { Button } from "../components/ui/button";
import { Badge } from "../components/ui/badge";
import { GarmentPreview } from "../components/GarmentPreview";
import { Zap, ArrowLeft, Download, Package, Truck, CheckCircle2 } from "lucide-react";

const statusColors: Record<string, string> = {
  submitted: 'bg-blue-100 text-blue-700',
  priced: 'bg-amber-100 text-amber-700',
  accepted: 'bg-teal-100 text-teal-700',
  processing: 'bg-purple-100 text-purple-700',
  shipping: 'bg-blue-100 text-blue-700',
  completed: 'bg-green-100 text-green-700'
};

const mockOrderDetails = {
  'ord-001': {
    id: 'ord-001',
    productName: 'Premium Cotton T-Shirt',
    garmentType: 'tshirt',
    status: 'processing',
    statusLabel: 'Processing',
    orderDate: '14 Mar 2026',
    quantity: 250,
    total: 3247.50,
    specifications: {
      fit: 'Regular',
      color: '#000000',
      colorName: 'Black',
      neckType: 'crew',
      sleeveType: 'set-in',
      sleeveLength: 'short',
      fabricType: 'Jersey',
      gsm: 180
    },
    timeline: [
      { step: 'Submitted', completed: true, date: '14 Mar 2026' },
      { step: 'Priced', completed: true, date: '15 Mar 2026' },
      { step: 'Accepted', completed: true, date: '16 Mar 2026' },
      { step: 'Processing', completed: true, date: '17 Mar 2026', current: true },
      { step: 'Shipping', completed: false },
      { step: 'Completed', completed: false }
    ],
    activityLog: [
      { date: '17 Mar 2026, 10:30', action: 'Order entered production', user: 'System' },
      { date: '16 Mar 2026, 14:20', action: 'Order accepted by manufacturer', user: 'Admin' },
      { date: '15 Mar 2026, 09:15', action: 'Pricing confirmed', user: 'Admin' },
      { date: '14 Mar 2026, 16:45', action: 'Order submitted', user: 'Customer' }
    ]
  }
};

export function OrderDetail() {
  const { id } = useParams();
  const order = id ? mockOrderDetails[id as keyof typeof mockOrderDetails] : null;

  if (!order) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <Package className="w-16 h-16 text-gray-300 mx-auto mb-4" />
          <h2 className="text-2xl font-bold mb-2">Order not found</h2>
          <Button asChild className="mt-4">
            <Link to="/orders">Back to Orders</Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden bg-white">
      {/* Navigation */}
      <nav className="border-b">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-[#534AB7] rounded-lg flex items-center justify-center">
              <Zap className="w-5 h-5 text-white" />
            </div>
            <span className="text-xl font-semibold">Ceriga Studio</span>
          </Link>
          <div className="flex items-center gap-6">
            <Link to="/catalog" className="text-sm hover:text-[#534AB7]">Catalog</Link>
            <Link to="/drafts" className="text-sm hover:text-[#534AB7]">My Drafts</Link>
            <Link to="/orders" className="text-sm hover:text-[#534AB7]">My Orders</Link>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-6 py-12">
        {/* Header */}
        <div className="mb-8">
          <Button variant="ghost" asChild className="mb-4">
            <Link to="/orders">
              <ArrowLeft className="w-4 h-4 mr-2" />
              Back to Orders
            </Link>
          </Button>
          <div className="flex items-start justify-between">
            <div>
              <div className="flex items-center gap-3 mb-2">
                <h1 className="text-3xl font-bold">Order {order.id}</h1>
                <Badge className={statusColors[order.status]}>
                  {order.statusLabel}
                </Badge>
              </div>
              <p className="text-gray-600">Placed on {order.orderDate}</p>
            </div>
            <Button className="bg-[#534AB7] hover:bg-[#534AB7]/90">
              <Download className="w-4 h-4 mr-2" />
              Download Tech Pack
            </Button>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-8">
          {/* Left column - Main content */}
          <div className="lg:col-span-2 space-y-8">
            {/* Status timeline */}
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-6">Order Status</h2>
              <div className="relative">
                <div className="absolute top-4 left-4 bottom-4 w-0.5 bg-gray-200" />
                {order.timeline.map((item, index) => (
                  <div key={index} className="relative flex items-start gap-4 mb-6 last:mb-0">
                    <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center ${
                      item.completed
                        ? 'bg-[#534AB7] text-white'
                        : 'bg-gray-100 text-gray-400'
                    }`}>
                      {item.completed && <CheckCircle2 className="w-4 h-4" />}
                    </div>
                    <div className="flex-1 pt-1">
                      <div className={`font-medium ${item.current ? 'text-[#534AB7]' : ''}`}>
                        {item.step}
                      </div>
                      {item.date && (
                        <div className="text-sm text-gray-500">{item.date}</div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Garment preview */}
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Garment Specification</h2>
              <div className="h-96 mb-6 bg-gray-50 rounded-lg overflow-hidden">
                <GarmentPreview
                  garmentType={order.garmentType}
                  color={order.specifications.color}
                  neckType={order.specifications.neckType}
                  sleeveType={order.specifications.sleeveType}
                  sleeveLength={order.specifications.sleeveLength}
                  mode="techpack"
                  showFront={true}
                />
              </div>
              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-gray-500 mb-1">Fit</div>
                  <div className="font-medium">{order.specifications.fit}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Fabric</div>
                  <div className="font-medium">{order.specifications.fabricType} {order.specifications.gsm}gsm</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Colour</div>
                  <div className="flex items-center gap-2">
                    <div className="w-4 h-4 rounded border" style={{ backgroundColor: order.specifications.color }} />
                    <span className="font-medium">{order.specifications.colorName}</span>
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Neck</div>
                  <div className="font-medium capitalize">{order.specifications.neckType.replace('-', ' ')}</div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Sleeves</div>
                  <div className="font-medium capitalize">
                    {order.specifications.sleeveType} ({order.specifications.sleeveLength})
                  </div>
                </div>
                <div>
                  <div className="text-gray-500 mb-1">Quantity</div>
                  <div className="font-medium">{order.quantity} units</div>
                </div>
              </div>
            </div>

            {/* Activity log */}
            <div className="border rounded-lg p-6">
              <h2 className="text-xl font-semibold mb-4">Activity Log</h2>
              <div className="space-y-4">
                {order.activityLog.map((log, index) => (
                  <div key={index} className="flex items-start gap-4 text-sm">
                    <div className="w-2 h-2 rounded-full bg-[#534AB7] mt-1.5" />
                    <div className="flex-1">
                      <div className="font-medium">{log.action}</div>
                      <div className="text-gray-500">{log.date} · {log.user}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right column - Summary */}
          <div className="space-y-6">
            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Order Summary</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Product</span>
                  <span className="font-medium">{order.productName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Quantity</span>
                  <span className="font-medium">{order.quantity} units</span>
                </div>
                <div className="pt-3 border-t flex justify-between">
                  <span className="font-semibold">Total</span>
                  <span className="font-semibold text-[#534AB7]">€{order.total.toFixed(2)}</span>
                </div>
              </div>
            </div>

            <div className="border rounded-lg p-6">
              <h3 className="font-semibold mb-4">Actions</h3>
              <div className="space-y-2">
                <Button variant="outline" className="w-full justify-start">
                  <Download className="w-4 h-4 mr-2" />
                  Download Tech Pack
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Package className="w-4 h-4 mr-2" />
                  Order Again
                </Button>
                <Button variant="outline" className="w-full justify-start">
                  <Truck className="w-4 h-4 mr-2" />
                  Track Shipment
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
