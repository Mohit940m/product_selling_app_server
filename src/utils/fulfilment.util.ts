import { IOrderProduct, IOrderTracking, ORDER_STATUS, OrderStatus } from "../models/orderModels/order.model.js";

/** Stages a seller can move an item through, in order. */
export const FULFILMENT_FLOW: OrderStatus[] = [
    ORDER_STATUS.CONFIRMED,
    ORDER_STATUS.SHIPPED,
    ORDER_STATUS.OUT_FOR_DELIVERY,
    ORDER_STATUS.DELIVERED,
];

const STAGE_RANK: Record<OrderStatus, number> = {
    [ORDER_STATUS.CREATED]: 0,
    [ORDER_STATUS.CONFIRMED]: 1,
    [ORDER_STATUS.SHIPPED]: 2,
    [ORDER_STATUS.OUT_FOR_DELIVERY]: 3,
    [ORDER_STATUS.DELIVERED]: 4,
    [ORDER_STATUS.CANCELLED]: 5,
};

type OrderLike = {
    orderId: string;
    orderStatus: OrderStatus;
    tracking?: IOrderTracking;
    items: IOrderProduct[];
};

const hasTracking = (t?: IOrderTracking) => !!(t && (t.courier || t.trackingId || t.trackingUrl));

/**
 * Items as they should be presented. Orders created before per-item
 * fulfilment have no subOrderId/status/tracking on their lines, so those
 * inherit the order-level values and a positional id.
 */
export const resolveItems = (order: OrderLike) =>
    order.items.map((item, index) => ({
        ...item,
        subOrderId: item.subOrderId || `${order.orderId}-${index + 1}`,
        status: item.status || order.orderStatus,
        tracking: hasTracking(item.tracking) ? item.tracking : hasTracking(order.tracking) ? order.tracking : undefined,
    }));

/**
 * Order-level status summarising its items: the least advanced stage among
 * items that aren't cancelled (an order is only "Delivered" once every item is).
 */
export const deriveOrderStatus = (statuses: OrderStatus[], fallback: OrderStatus): OrderStatus => {
    const active = statuses.filter((s) => s !== ORDER_STATUS.CANCELLED);
    if (statuses.length === 0) return fallback;
    if (active.length === 0) return ORDER_STATUS.CANCELLED;
    return active.reduce((min, s) => (STAGE_RANK[s] < STAGE_RANK[min] ? s : min));
};

/** A plain copy of the order with resolved items and a derived orderStatus. */
export const presentOrder = <T extends OrderLike>(order: T) => {
    const items = resolveItems(order);
    return {
        ...order,
        items,
        orderStatus: deriveOrderStatus(items.map((i) => i.status), order.orderStatus),
    };
};
