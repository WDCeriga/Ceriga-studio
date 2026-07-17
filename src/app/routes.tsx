import { createBrowserRouter, Navigate } from "react-router";
import { Home } from "./pages/Home";
import { Features } from "./pages/Features";
import { HowItWorks } from "./pages/HowItWorks";
import { PricingPage } from "./pages/PricingPage";
import { Onboarding } from "./pages/Onboarding";
import { Login } from "./pages/Login";
import { Signup } from "./pages/Signup";
import { NotFound } from "./pages/NotFound";
import { SidebarLayout } from "./components/SidebarLayout";

export const router = createBrowserRouter([
  {
    path: "/",
    Component: Home,
  },
  {
    path: "/features",
    Component: Features,
  },
  {
    path: "/how-it-works",
    Component: HowItWorks,
  },
  {
    path: "/pricing",
    Component: PricingPage,
  },
  {
    path: "/onboarding",
    Component: Onboarding,
  },
  {
    path: "/login",
    Component: Login,
  },
  {
    path: "/signup",
    Component: Signup,
  },
  {
    path: "/dashboard",
    lazy: async () => {
      const [{ SidebarLayout: Layout }, { Dashboard }] = await Promise.all([
        import("./components/SidebarLayout"),
        import("./pages/Dashboard"),
      ]);
      return {
        element: (
          <Layout>
            <Dashboard />
          </Layout>
        ),
      };
    },
  },
  {
    path: "/notifications",
    lazy: async () => {
      const [{ SidebarLayout: Layout }, { Notifications }] = await Promise.all([
        import("./components/SidebarLayout"),
        import("./pages/Notifications"),
      ]);
      return {
        element: (
          <Layout>
            <Notifications />
          </Layout>
        ),
      };
    },
  },
  {
    path: "/support",
    lazy: async () => {
      const [{ SidebarLayout: Layout }, { SupportChatPage }] = await Promise.all([
        import("./components/SidebarLayout"),
        import("./pages/SupportChatPage"),
      ]);
      return {
        element: (
          <Layout>
            <SupportChatPage />
          </Layout>
        ),
      };
    },
  },
  {
    path: "/catalog",
    lazy: async () => {
      const [{ SidebarLayout: Layout }, { Catalog }] = await Promise.all([
        import("./components/SidebarLayout"),
        import("./pages/Catalog"),
      ]);
      return {
        element: (
          <Layout>
            <Catalog />
          </Layout>
        ),
      };
    },
  },
  {
    path: "/builder/:productId?",
    lazy: async () => {
      const { Builder } = await import("./pages/Builder");
      return { Component: Builder };
    },
  },
  {
    path: "/drafts",
    lazy: async () => {
      const [{ SidebarLayout: Layout }, { Drafts }] = await Promise.all([
        import("./components/SidebarLayout"),
        import("./pages/Drafts"),
      ]);
      return {
        element: (
          <Layout>
            <Drafts />
          </Layout>
        ),
      };
    },
  },
  {
    path: "/studio",
    lazy: async () => {
      const [{ SidebarLayout: Layout }, { Studio }] = await Promise.all([
        import("./components/SidebarLayout"),
        import("./pages/Studio"),
      ]);
      return {
        element: (
          <Layout>
            <Studio />
          </Layout>
        ),
      };
    },
  },
  {
    path: "/studio/manufacturer",
    lazy: async () => {
      const [{ SidebarLayout: Layout }, { ManufacturerOrder }] = await Promise.all([
        import("./components/SidebarLayout"),
        import("./pages/ManufacturerOrder"),
      ]);
      return {
        element: (
          <Layout>
            <ManufacturerOrder />
          </Layout>
        ),
      };
    },
  },
  {
    path: "/packaging",
    lazy: async () => {
      const [{ SidebarLayout: Layout }, { PackagingOnly }] = await Promise.all([
        import("./components/SidebarLayout"),
        import("./pages/PackagingOnly"),
      ]);
      return {
        element: (
          <Layout>
            <PackagingOnly />
          </Layout>
        ),
      };
    },
  },
  {
    path: "/packaging/:productId",
    element: <Navigate to="/packaging" replace />,
  },
  {
    path: "/orders",
    lazy: async () => {
      const [{ SidebarLayout: Layout }, { Orders }] = await Promise.all([
        import("./components/SidebarLayout"),
        import("./pages/Orders"),
      ]);
      return {
        element: (
          <Layout>
            <Orders />
          </Layout>
        ),
      };
    },
  },
  {
    path: "/orders/:id/checkout/:optionId",
    lazy: async () => {
      const { OrderCheckout } = await import("./pages/OrderCheckout");
      return { element: <OrderCheckout /> };
    },
  },
  {
    path: "/orders/:id",
    lazy: async () => {
      const [{ SidebarLayout: Layout }, { OrderDetail }] = await Promise.all([
        import("./components/SidebarLayout"),
        import("./pages/OrderDetail"),
      ]);
      return {
        element: (
          <Layout>
            <OrderDetail />
          </Layout>
        ),
      };
    },
  },
  {
    path: "/delivery",
    lazy: async () => {
      const { default: Delivery } = await import("./pages/Delivery");
      return { Component: Delivery };
    },
  },
  {
    path: "/settings",
    lazy: async () => {
      const [{ SidebarLayout: Layout }, mod] = await Promise.all([
        import("./components/SidebarLayout"),
        import("./pages/Settings"),
      ]);
      const Settings = mod.default;
      return {
        element: (
          <Layout>
            <Settings />
          </Layout>
        ),
      };
    },
  },
  {
    path: "/superadmin",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminDashboard }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminDashboard"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminDashboard />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/users/:id",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminUserDetail }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminUserDetail"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminUserDetail />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/users",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminUsers }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminUsers"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminUsers />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/orders/review",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminOrderReviewQueue }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminOrderReviewQueue"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminOrderReviewQueue />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/orders/:id",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminOrderDetail }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminOrderDetail"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminOrderDetail />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/orders",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminOrders }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminOrders"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminOrders />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/statistics/:section",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminStatisticsDetail }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/statistics/SuperAdminStatisticsDetail"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminStatisticsDetail />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/statistics",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminStatistics }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminStatistics"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminStatistics />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/time-off",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminTimeOff }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminTimeOff"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminTimeOff />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/assignment",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminAssignmentConsole }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminAssignmentConsole"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminAssignmentConsole />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/shipping-onboard",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminShippingOnboard }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminShippingOnboard"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminShippingOnboard />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/manufacturers/:id",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminManufacturerDetail }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminManufacturerDetail"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminManufacturerDetail />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/manufacturers",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminManufacturers }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminManufacturers"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminManufacturers />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/crm/access/:audience/:userId",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminCRMAccessProfile }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/crm/SuperAdminCRMAccessProfile"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminCRMAccessProfile />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/crm/access/:audience",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminCRMAccessList }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/crm/SuperAdminCRMAccessList"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminCRMAccessList />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/crm/access",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminCRMAccess }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/crm/SuperAdminCRMAccess"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminCRMAccess />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/crm/bases/:baseId",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminCRMBase }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminCRMBase"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminCRMBase />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/crm/products/:productId",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminCRMProduct }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminCRMProduct"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminCRMProduct />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/crm",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminCRM }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminCRM"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminCRM />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/pricing",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminPricing }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminPricing"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminPricing />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/messages",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminMessages }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminMessages"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminMessages />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/notifications",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminNotificationsPage }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminNotificationsPage"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminNotificationsPage />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/superadmin/settings",
    lazy: async () => {
      const [{ SuperAdminLayout }, { SuperAdminSettings }] = await Promise.all([
        import("./components/superadmin/SuperAdminLayout"),
        import("./pages/superadmin/SuperAdminSettings"),
      ]);
      return {
        element: (
          <SuperAdminLayout>
            <SuperAdminSettings />
          </SuperAdminLayout>
        ),
      };
    },
  },
  {
    path: "/manufacturer/onboarding",
    lazy: async () => {
      const [{ ManufacturerLayout }, { ManufacturerOnboarding }] = await Promise.all([
        import("./components/manufacturer/ManufacturerLayout"),
        import("./pages/manufacturer/ManufacturerOnboarding"),
      ]);
      return {
        element: (
          <ManufacturerLayout>
            <ManufacturerOnboarding />
          </ManufacturerLayout>
        ),
      };
    },
  },
  {
    path: "/manufacturer/orders/:id",
    lazy: async () => {
      const [{ ManufacturerLayout }, { ManufacturerOrderDetail }] = await Promise.all([
        import("./components/manufacturer/ManufacturerLayout"),
        import("./pages/manufacturer/ManufacturerOrderDetail"),
      ]);
      return {
        element: (
          <ManufacturerLayout>
            <ManufacturerOrderDetail />
          </ManufacturerLayout>
        ),
      };
    },
  },
  {
    path: "/manufacturer/orders",
    lazy: async () => {
      const [{ ManufacturerLayout }, { ManufacturerOrders }] = await Promise.all([
        import("./components/manufacturer/ManufacturerLayout"),
        import("./pages/manufacturer/ManufacturerOrders"),
      ]);
      return {
        element: (
          <ManufacturerLayout>
            <ManufacturerOrders />
          </ManufacturerLayout>
        ),
      };
    },
  },
  {
    path: "/manufacturer/materials",
    lazy: async () => {
      const [{ ManufacturerLayout }, { ManufacturerMaterials }] = await Promise.all([
        import("./components/manufacturer/ManufacturerLayout"),
        import("./pages/manufacturer/ManufacturerMaterials"),
      ]);
      return {
        element: (
          <ManufacturerLayout>
            <ManufacturerMaterials />
          </ManufacturerLayout>
        ),
      };
    },
  },
  {
    path: "/manufacturer/shipping",
    lazy: async () => {
      const [{ ManufacturerLayout }, { ManufacturerShipping }] = await Promise.all([
        import("./components/manufacturer/ManufacturerLayout"),
        import("./pages/manufacturer/ManufacturerShipping"),
      ]);
      return {
        element: (
          <ManufacturerLayout>
            <ManufacturerShipping />
          </ManufacturerLayout>
        ),
      };
    },
  },
  {
    path: "/manufacturer/production",
    lazy: async () => {
      const [{ ManufacturerLayout }, { ManufacturerProduction }] = await Promise.all([
        import("./components/manufacturer/ManufacturerLayout"),
        import("./pages/manufacturer/ManufacturerProduction"),
      ]);
      return {
        element: (
          <ManufacturerLayout>
            <ManufacturerProduction />
          </ManufacturerLayout>
        ),
      };
    },
  },
  {
    path: "/manufacturer/capacity",
    lazy: async () => {
      const [{ ManufacturerLayout }, { ManufacturerCapacity }] = await Promise.all([
        import("./components/manufacturer/ManufacturerLayout"),
        import("./pages/manufacturer/ManufacturerCapacity"),
      ]);
      return {
        element: (
          <ManufacturerLayout>
            <ManufacturerCapacity />
          </ManufacturerLayout>
        ),
      };
    },
  },
  {
    path: "/manufacturer/statistics",
    lazy: async () => {
      const [{ ManufacturerLayout }, { ManufacturerStatistics }] = await Promise.all([
        import("./components/manufacturer/ManufacturerLayout"),
        import("./pages/manufacturer/ManufacturerStatistics"),
      ]);
      return {
        element: (
          <ManufacturerLayout>
            <ManufacturerStatistics />
          </ManufacturerLayout>
        ),
      };
    },
  },
  {
    path: "/manufacturer/team",
    lazy: async () => {
      const [{ ManufacturerLayout }, { ManufacturerTeam }] = await Promise.all([
        import("./components/manufacturer/ManufacturerLayout"),
        import("./pages/manufacturer/ManufacturerTeam"),
      ]);
      return {
        element: (
          <ManufacturerLayout>
            <ManufacturerTeam />
          </ManufacturerLayout>
        ),
      };
    },
  },
  {
    path: "/manufacturer/messages",
    lazy: async () => {
      const [{ ManufacturerLayout }, { ManufacturerMessages }] = await Promise.all([
        import("./components/manufacturer/ManufacturerLayout"),
        import("./pages/manufacturer/ManufacturerMessages"),
      ]);
      return {
        element: (
          <ManufacturerLayout>
            <ManufacturerMessages />
          </ManufacturerLayout>
        ),
      };
    },
  },
  {
    path: "/manufacturer/notifications",
    lazy: async () => {
      const [{ ManufacturerLayout }, { ManufacturerNotifications }] = await Promise.all([
        import("./components/manufacturer/ManufacturerLayout"),
        import("./pages/manufacturer/ManufacturerNotifications"),
      ]);
      return {
        element: (
          <ManufacturerLayout>
            <ManufacturerNotifications />
          </ManufacturerLayout>
        ),
      };
    },
  },
  {
    path: "/manufacturer/settings",
    lazy: async () => {
      const [{ ManufacturerLayout }, { ManufacturerSettings }] = await Promise.all([
        import("./components/manufacturer/ManufacturerLayout"),
        import("./pages/manufacturer/ManufacturerSettings"),
      ]);
      return {
        element: (
          <ManufacturerLayout>
            <ManufacturerSettings />
          </ManufacturerLayout>
        ),
      };
    },
  },
  {
    path: "/manufacturer",
    lazy: async () => {
      const [{ ManufacturerLayout }, { ManufacturerDashboard }] = await Promise.all([
        import("./components/manufacturer/ManufacturerLayout"),
        import("./pages/manufacturer/ManufacturerDashboard"),
      ]);
      return {
        element: (
          <ManufacturerLayout>
            <ManufacturerDashboard />
          </ManufacturerLayout>
        ),
      };
    },
  },
  {
    path: "*",
    Component: NotFound,
  },
]);
