export const LONG_ADMIN_ROUTE_PATHS = {
  units: "/admin/units",
  contracts: "/admin/contracts",
  approvals: "/admin/approvals",
  approvalsDetail: "/admin/approvals/:tournamentId",
} as const;

export interface LongAdminRouteMeta {
  path: string;
  pageCode: "P06" | "P07" | "P08";
  titleVi: string;
  requiredRole: "ADMIN";
}

export const LONG_ADMIN_ROUTE_META: readonly LongAdminRouteMeta[] = [
  {
    path: LONG_ADMIN_ROUTE_PATHS.units,
    pageCode: "P06",
    titleVi: "Quản lý Đơn vị & Tổ chức",
    requiredRole: "ADMIN",
  },
  {
    path: LONG_ADMIN_ROUTE_PATHS.contracts,
    pageCode: "P07",
    titleVi: "Quản lý Hợp đồng & Hạn mức",
    requiredRole: "ADMIN",
  },
  {
    path: LONG_ADMIN_ROUTE_PATHS.approvals,
    pageCode: "P08",
    titleVi: "Hàng đợi Phê duyệt Giải đấu",
    requiredRole: "ADMIN",
  },
] as const;
