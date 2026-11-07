/**
 * Compile-time contract, checked by the Worker's `tsc` (npm run typecheck): every card the
 * server builds (orderCard in src/admin.ts) must still fit the shape the panel client
 * reads (panel/client/types.ts). If the API changes, this file stops compiling.
 */
import type { OrderCard, StaffAction as ServerAction } from "../src/admin";
import type { Card, StaffAction } from "./client/types";

type Assert<T extends true> = T;

export type CardFitsPanel = Assert<OrderCard extends Card ? true : false>;
export type ActionsMatch = Assert<ServerAction extends StaffAction ? (StaffAction extends ServerAction ? true : false) : false>;
