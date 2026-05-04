import * as Location from 'expo-location';
import apiAdapter from '@/utils/apiAdapter';

/**
 * Request foreground location permission from the user.
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
 */
export const hasLocationPermission = async () => {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === 'granted';
};

/**
 * Get the device's current GPS coordinates.
 * Throws if permission is not granted or location is unavailable.
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
    accuracy: location.coords.accuracy ?? null,
    is_mocked: location.coords.mocked === true,
  };
};

/**
 * Verify that the student is inside the classroom geofence.
 * Calls the backend's POST /api/verify/location endpoint.
 */
export const verifyLocation = async (sessionId) => {
  const { latitude, longitude, accuracy } = await getCurrentLocation();

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
