export const carriedDeliveryId = (
  event: Readonly<Record<string, unknown>>,
): { readonly deliveryId: string } | Record<never, never> => {
  const deliveryId = event.delivery_id;
  return typeof deliveryId === "string" ? { deliveryId } : {};
};
