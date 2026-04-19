import * as Location from 'expo-location';
import apiAdapter from '../utils/apiAdapter';

/**
 * Request foreground location permission from the user.
 * @returns {{ granted: boolean, canAskAgain: boolean }}
 */
export const requestLocationPermission = async () => {
  const { status, canAskAgain } = await Location.requestForegroundPermissionsAsync();
  return {
    granted: status === 'granted',
    canAskAgain
  };
};

/**
 * Check whether foreground location permission is already granted
 * without prompting the user.
 * @returns {boolean}
 */
export const hasLocationPermission = async () => {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
};

/**
 * Get the device's current GPS coordinates.
 * Throws if permission is not granted or location is unavailable.
 *
 * @param {{ accuracy?: Location.Accuracy, timeout?: number }} options
 * @returns {{ latitude: number, longitude: number, accuracy: number }}
 */
export const getCurrentLocation = async (options = {}) => {
  const granted = await hasLocationPermission();
  if (!granted) {
    const { granted: nowGranted } = await requestLocationPermission();
    if (!nowGranted) {
      throw new Error('Konum izni verilmedi. Ayarlardan izin verin.');
    }
  }

  const location = await Location.getCurrentPositionAsync({
    accuracy: options.accuracy ?? Location.Accuracy.High,
    timeInterval: options.timeout ?? 10000
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
    accuracy: location.coords.accuracy
  };
};

/**
 * Verify that the student is inside the classroom geofence.
 * Calls the Flask backend's POST /api/verify/location endpoint.
 *
 * @param {string} sessionId  - Active attendance session UUID
 * @returns {{
 *   inside: boolean,
 *   distance_m: number|null,
 *   geofence_radius: number|null,
 *   room_name: string,
 *   latitude: number,
 *   longitude: number
 * }}
 */
export const verifyLocation = async (sessionId) => {
  // 1 — Get current GPS coordinates
  const { latitude, longitude, accuracy } = await getCurrentLocation();

  // 2 — Send to backend for geofence check
  const result = await apiAdapter.post('/attendance/verify-location', {
    session_id: sessionId,
    latitude,
    longitude
  });

  return {
    ...result,
    latitude,
    longitude,
    gps_accuracy: accuracy
  };
};
