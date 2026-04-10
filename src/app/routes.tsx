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
    path: "*",
    Component: NotFound,
  },
]);
