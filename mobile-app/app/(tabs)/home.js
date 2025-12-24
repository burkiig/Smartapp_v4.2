import React, { useState } from 'react';
import { ScrollView, StyleSheet, Alert, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '../context/UserContext';
import { Camera } from 'expo-camera';
import InstructorHome from '../screens/InstructorHome';
import ExcuseModal from '../components/ExcuseModal';
import Header from '../components/home/Header';
import FaceWarning from '../components/home/FaceWarning';
import LiveClassCard from '../components/home/LiveClassCard';
import QuickActions from '../components/home/QuickActions';
import MonthStats from '../components/home/MonthStats';
import RecentActivity from '../components/home/RecentActivity';

export default function HomeScreen() {
  const router = useRouter();
  const { userType, userName } = useUser();
  const [isExcuseModalVisible, setExcuseModalVisible] = useState(false);
  const [hasFaceRegistered] = useState(false);

  if (userType === 'instructor') {
    return <InstructorHome />;
  }

  const liveClass = {
    course: 'CS101',
    title: 'Introduction to Programming',
    time: '09:00 - 10:30',
    room: 'Room 401',
    instructor: 'Dr. Robert Chen',
    attendanceMarked: false,
  };

  const stats = {
    percentage: 92,
    totalDays: 20,
    present: 18,
    absent: 2,
  };

  const recentActivity = {
    course: 'CS101',
    status: 'Present',
    time: 'Today, 09:05 AM',
    method: 'Face ID',
  };

  const requestCameraPermission = async () => {
    try {
      const { status } = await Camera.requestCameraPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error requesting camera permission:', error);
      return false;
    }
  };

  const checkCameraPermission = async () => {
    const { status } = await Camera.getCameraPermissionsAsync();
    return status === 'granted';
  };

  const handleCameraAction = async (action, actionName) => {
    // Check if permission is already granted
    const hasPermission = await checkCameraPermission();
    
    if (hasPermission) {
      action();
      return;
    }

    // Directly request permission
    const granted = await requestCameraPermission();
    
    if (granted) {
      action();
    } else {
      // Permission denied - show alert with settings option
      Alert.alert(
        'Camera Permission Required',
        `${actionName} requires camera access to mark attendance. Please enable camera permission in your device settings.`,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Open Settings', onPress: () => Linking.openSettings() },
        ]
      );
    }
  };

  const handleFaceScan = () => {
    handleCameraAction(
      () => router.push(hasFaceRegistered ? '/face-scan' : '/register-face'),
      'Face Scan'
    );
  };

  const handleQRScan = () => {
    handleCameraAction(
      () => router.push('/qr-scan'),
      'QR Code Scan'
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Header userName={userName} />
        
        {!hasFaceRegistered && (
          <FaceWarning onRegister={() => handleCameraAction(
            () => router.push('/register-face'),
            'Face Registration'
          )} />
        )}
        
        <LiveClassCard liveClass={liveClass} />
        
        <QuickActions
          hasFaceRegistered={hasFaceRegistered}
          onFaceScan={handleFaceScan}
          onQRScan={handleQRScan}
          onExcuse={() => setExcuseModalVisible(true)}
          onHistory={() => router.push('/(tabs)/history')}
        />
        
        <MonthStats stats={stats} />
        
        <RecentActivity 
          activity={recentActivity}
          onViewAll={() => router.push('/(tabs)/history')}
        />
      </ScrollView>

      <ExcuseModal
        visible={isExcuseModalVisible}
        onClose={() => setExcuseModalVisible(false)}
        attendanceRecord={{
          id: 'temp',
          date: new Date().toISOString().split('T')[0],
          status: 'Absent',
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
});