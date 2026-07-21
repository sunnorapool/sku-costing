import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import SKUTable from "./pages/SKUTable";
import SKUDetail from "./pages/SKUDetail";
import SupplySide from "./pages/SupplySide";
import BuySide from "./pages/BuySide";
import Dealers from "./pages/Dealers";
import Reports from "./pages/Reports";
import DashboardLayout from "./components/DashboardLayout";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={SKUTable} />
        <Route path={"/supply-side"} component={SupplySide} />
        <Route path={"/buy-side"} component={BuySide} />
        <Route path={"/dealers"} component={Dealers} />
        <Route path={"/reports"} component={Reports} />
        <Route path={"/sku/:id"}>
          {(params) => <SKUDetail skuId={Number(params.id)} />}
        </Route>
        <Route path={"/404"} component={NotFound} />
        <Route component={NotFound} />
      </Switch>
    </DashboardLayout>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <ThemeProvider defaultTheme="light">
        <TooltipProvider>
          <Toaster />
          <Router />
        </TooltipProvider>
      </ThemeProvider>
    </ErrorBoundary>
  );
}

export default App;
