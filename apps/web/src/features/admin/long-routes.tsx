import { Route } from "react-router-dom";
import { ApprovalsAdminPage } from "./approvals/ApprovalsAdminPage";
import { ContractsAdminPage } from "./contracts/ContractsAdminPage";
import { LONG_ADMIN_ROUTE_PATHS } from "./long-route-meta";
import { UnitsAdminPage } from "./units/UnitsAdminPage";

/**
 * Route registration fragment exported by Long for Sơn (shell/router owner)
 * per DELIVERY-PLAN.md Section 5.1.
 */
export function LongAdminRoutes() {
  return (
    <>
      <Route path={LONG_ADMIN_ROUTE_PATHS.units} element={<UnitsAdminPage />} />
      <Route
        path={LONG_ADMIN_ROUTE_PATHS.contracts}
        element={<ContractsAdminPage />}
      />
      <Route
        path={LONG_ADMIN_ROUTE_PATHS.approvals}
        element={<ApprovalsAdminPage />}
      />
      <Route
        path={LONG_ADMIN_ROUTE_PATHS.approvalsDetail}
        element={<ApprovalsAdminPage />}
      />
    </>
  );
}
