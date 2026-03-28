import axios from 'axios'

const api = axios.create({
  baseURL: '/api',
  timeout: 10000,
})

// --- Delivery ---
export const failDelivery = (deliveryId, driverLat, driverLng) =>
  api.post('/delivery/fail', { delivery_id: deliveryId, driver_lat: driverLat, driver_lng: driverLng })

// --- Hubs ---
export const getHub = (hubId) => api.get(`/hubs/${hubId}`)
export const getHubStats = (hubId) => api.get(`/hubs/${hubId}/stats`)
export const getActiveBroadcasts = (hubId) => api.get(`/hubs/${hubId}/active_broadcasts`)

export const getNearbyHubs = (lat, lng, radius = 2000) =>
  api.get('/hubs/nearby', { params: { lat, lng, radius } })

export const acceptBroadcast = (broadcastId, hubId) =>
  api.post('/hub/accept', { broadcast_id: broadcastId, hub_id: hubId })

// --- Driver ---
export const getDriverScore = (driverId) =>
  api.get(`/driver/${driverId}/score`)

export const getActiveDelivery = (driverId) =>
  api.get(`/driver/${driverId}/active_delivery`)

// --- Dashboard ---
export const getDashboardStats = () => api.get('/dashboard/stats')
export const getFleet          = () => api.get('/dashboard/fleet')
export const getHourlyMetrics  = () => api.get('/dashboard/hourly')
export const getLeaderboard    = () => api.get('/dashboard/leaderboard')

export default api
