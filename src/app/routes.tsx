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
    path: "*",
    Component: NotFound,
  },
]);
