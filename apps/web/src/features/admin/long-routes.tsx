import type { ComponentType } from "react";
import { ApprovalsAdminPage } from "./approvals/ApprovalsAdminPage";
import { ContractsAdminPage } from "./contracts/ContractsAdminPage";
import { LONG_ADMIN_ROUTE_PATHS } from "./long-route-meta";
import { UnitsAdminPage } from "./units/UnitsAdminPage";

/**
 * Route registration fragment exported by Long for Sơn (shell/router owner)
 * per DELIVERY-PLAN.md Section 5.1.
 */
export interface LongAdminRouteDefinition {
  path: string;
  Component: ComponentType;
}

/**
 * Route definitions consumed by AppRouter. Routes must be instantiated inside
 * its <Routes> tree; rendering a custom component there is rejected by
 * react-router and would leave P06–P08 unreachable.
 */
export const longAdminRouteDefinitions: readonly LongAdminRouteDefinition[] = [
  { path: LONG_ADMIN_ROUTE_PATHS.units, Component: UnitsAdminPage },
  { path: LONG_ADMIN_ROUTE_PATHS.contracts, Component: ContractsAdminPage },
  { path: LONG_ADMIN_ROUTE_PATHS.approvals, Component: ApprovalsAdminPage },
  { path: LONG_ADMIN_ROUTE_PATHS.approvalsDetail, Component: ApprovalsAdminPage },
];
