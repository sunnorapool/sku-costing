import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/NotFound";
import { Route, Switch } from "wouter";
import ErrorBoundary from "./components/ErrorBoundary";
import { ThemeProvider } from "./contexts/ThemeContext";
import SKUTable from "./pages/SKUTable";
import VersionHistory from "./pages/VersionHistory";
import ImportExport from "./pages/ImportExport";
import ChannelPricing from "./pages/ChannelPricing";
import SKUDetail from "./pages/SKUDetail";
import MarginAlerts from "./pages/MarginAlerts";
import ModelLookup from "./pages/ModelLookup";
import DashboardLayout from "./components/DashboardLayout";

function Router() {
  return (
    <DashboardLayout>
      <Switch>
        <Route path={"/"} component={SKUTable} />
        <Route path={"/history"} component={VersionHistory} />
        <Route path={"/import-export"} component={ImportExport} />
        <Route path={"/channel-pricing"} component={ChannelPricing} />
        <Route path={"/alerts"} component={MarginAlerts} />
        <Route path={"/lookup"} component={ModelLookup} />
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
