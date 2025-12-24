import React, { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useUser } from '../context/UserContext';
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

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView showsVerticalScrollIndicator={false}>
        <Header userName={userName} />
        
        {!hasFaceRegistered && (
          <FaceWarning onRegister={() => router.push('/register-face')} />
        )}
        
        <LiveClassCard liveClass={liveClass} />
        
        <QuickActions
          hasFaceRegistered={hasFaceRegistered}
          onFaceScan={() => router.push(hasFaceRegistered ? '/face-scan' : '/register-face')}
          onQRScan={() => router.push('/qr-scan')}
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