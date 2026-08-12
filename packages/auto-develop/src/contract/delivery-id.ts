export const carriedDeliveryId = (
  delivered: Readonly<Record<string, unknown>>,
): { readonly deliveryId: string } | Record<never, never> => {
  const deliveryId = delivered.delivery_id;
  return typeof deliveryId === "string" ? { deliveryId } : {};
};
