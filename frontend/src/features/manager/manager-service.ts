import { ApiRequestError, requestFormData, requestJson } from '../../shared/api/client'

export { ApiRequestError as ManagerRequestError }

export type ManagerOrder = {
  id: string
  orderNumber: string
  customerName: string | null
  productName: string | null
  status: string
  destination: string | null
  shipmentStatus: string
  carrier: string | null
  trackingOrVehicleNumber: string | null
  expectedDeliveryAt: string | null
  actualDeliveryAt: string | null
  receivedBy: string | null
  proofAttachments: Array<{ id: string; fileName: string; mediaType: string; sizeBytes: number; createdAt: string }>
}

export async function listManagerOrders() {
  return (await requestJson<{ orders: ManagerOrder[] }>('/api/v1/manager/orders')).orders
}

export async function uploadManagerProof(orderId: string, file: File) {
  const data = new FormData()
  data.append('file', file)
  return (await requestFormData<{ order: ManagerOrder }>(`/api/v1/manager/orders/${orderId}/proof`, data)).order
}

export async function confirmManagerDelivery(orderId: string, input: { actualDeliveryAt: string; receivedBy: string }) {
  return (
    await requestJson<{ order: ManagerOrder }>(`/api/v1/manager/orders/${orderId}/confirm-delivery`, {
      method: 'POST',
      body: JSON.stringify(input),
    })
  ).order
}
