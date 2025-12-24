import React, { useState, useRef, useMemo, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  FlatList,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useUser } from '../context/UserContext';
import BottomSheet, { BottomSheetBackdrop } from '@gorhom/bottom-sheet';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

const { width } = Dimensions.get('window');

export default function ScheduleScreen() {
  const router = useRouter();
  const { userType } = useUser();
  
  // Student ise history göster
  if (userType === 'student') {
    const StudentHistory = require('./history').default;
    return <StudentHistory />;
  }

  const [selectedFilter, setSelectedFilter] = useState('today');
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDay, setSelectedDay] = useState(new Date().getDay()); // Start with today
  
  // Set selected day to today on mount
  useEffect(() => {
    const today = new Date();
    setSelectedDay(today.getDay());
  }, []);
  
  // Bottom Sheet refs
  const bottomSheetRef = useRef(null);
  const snapPoints = useMemo(() => ['65%'], []);
  
  // Callbacks
  const handleOpenCalendar = useCallback(() => {
    bottomSheetRef.current?.expand();
  }, []);
  
  const handleCloseCalendar = useCallback(() => {
    bottomSheetRef.current?.close();
  }, []);
  
  const renderBackdrop = useCallback(
    (props) => (
      <BottomSheetBackdrop
        {...props}
        disappearsOnIndex={-1}
        appearsOnIndex={0}
        opacity={0.5}
      />
    ),
    []
  );

  // All classes data with day of week (0-6)
  const [allClasses] = useState([
    // Wednesday (3)
    {
      id: 1,
      course: 'CS101',
      title: 'Introduction to Programming',
      time: '09:00 - 10:30',
      room: 'Room 401',
      dayOfWeek: 3,
      status: 'completed',
      students: '42/45',
      color: '#10B981'
    },
    {
      id: 2,
      course: 'CS201',
      title: 'Data Structures',
      time: '14:00 - 15:30',
      room: 'Lab 204',
      dayOfWeek: 3,
      status: 'in-progress',
      students: '28/38',
      color: '#F59E0B'
    },
    {
      id: 3,
      course: 'CS301',
      title: 'Algorithms',
      time: '16:00 - 17:30',
      room: 'Room 405',
      dayOfWeek: 3,
      status: 'upcoming',
      students: '0/32',
      color: '#5B7FFF'
    },
    // Monday (1)
    {
      id: 4,
      course: 'CS102',
      title: 'Advanced Programming',
      time: '10:00 - 11:30',
      room: 'Lab 301',
      dayOfWeek: 1,
      status: 'upcoming',
      students: '0/40',
      color: '#5B7FFF'
    },
    {
      id: 5,
      course: 'CS150',
      title: 'Web Development',
      time: '14:00 - 15:30',
      room: 'Lab 205',
      dayOfWeek: 1,
      status: 'upcoming',
      students: '0/35',
      color: '#5B7FFF'
    },
    // Tuesday (2)
    {
      id: 6,
      course: 'CS202',
      title: 'Database Systems',
      time: '13:00 - 14:30',
      room: 'Room 402',
      dayOfWeek: 2,
      status: 'upcoming',
      students: '0/35',
      color: '#5B7FFF'
    },
    // Thursday (4)
    {
      id: 7,
      course: 'CS250',
      title: 'Software Engineering',
      time: '11:00 - 12:30',
      room: 'Room 303',
      dayOfWeek: 4,
      status: 'upcoming',
      students: '0/30',
      color: '#5B7FFF'
    },
    // Friday (5)
    {
      id: 8,
      course: 'CS302',
      title: 'Machine Learning',
      time: '15:00 - 16:30',
      room: 'Lab 401',
      dayOfWeek: 5,
      status: 'upcoming',
      students: '0/25',
      color: '#5B7FFF'
    },
  ]);
  
  // Filter classes by selected day
  const filteredClasses = allClasses.filter(cls => cls.dayOfWeek === selectedDay);

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return 'checkmark-circle';
      case 'in-progress':
        return 'play-circle';
      default:
        return 'calendar';
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return '#10B981';
      case 'in-progress':
        return '#F59E0B';
      default:
        return '#5B7FFF';
    }
  };


  // Calendar helper functions
  const getDaysInMonth = (date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();
    
    return { daysInMonth, startingDayOfWeek };
  };
  
  const formatMonthYear = (date) => {
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 
                    'July', 'August', 'September', 'October', 'November', 'December'];
    return `${months[date.getMonth()]} ${date.getFullYear()}`;
  };
  
  const getDayName = (dayIndex) => {
    const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    return days[dayIndex];
  };
  
  const getDayNumber = (date, dayIndex) => {
    const today = new Date(date);
    const currentDay = today.getDay();
    const diff = dayIndex - currentDay;
    today.setDate(today.getDate() + diff);
    return today.getDate();
  };
  
  const isSameDay = (date1, date2) => {
    return date1.getDate() === date2.getDate() &&
           date1.getMonth() === date2.getMonth() &&
           date1.getFullYear() === date2.getFullYear();
  };
  
  const isToday = (date) => {
    return isSameDay(date, new Date());
  };
  
  const handleDateSelect = (day) => {
    const newDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
    setSelectedDate(newDate);
    setSelectedDay(newDate.getDay()); // Update selected day to match the date
    handleCloseCalendar();
  };
  
  const handleDaySelect = (dayIndex) => {
    setSelectedDay(dayIndex);
    // Update selected date to match the day
    const today = new Date();
    const currentDay = today.getDay();
    const diff = dayIndex - currentDay;
    const newDate = new Date(today);
    newDate.setDate(today.getDate() + diff);
    setSelectedDate(newDate);
  };
  
  const handlePreviousMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1));
  };
  
  const handleNextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1));
  };
  
  const handleToday = () => {
    const today = new Date();
    setCurrentMonth(today);
    setSelectedDate(today);
  };

  const renderClassItem = ({ item }) => (
    <TouchableOpacity 
      style={styles.classCard}
      onPress={() => router.push({
        pathname: '/class-details',
        params: { code: item.course, title: item.title }
      })}
    >
      <View style={styles.classLeft}>
        <View style={[styles.statusIndicator, { backgroundColor: getStatusColor(item.status) + '20' }]}>
          <Ionicons name={getStatusIcon(item.status)} size={24} color={getStatusColor(item.status)} />
        </View>
        <View style={styles.classInfo}>
          <Text style={styles.courseCode}>{item.course}</Text>
          <Text style={styles.courseTitle}>{item.title}</Text>
          <View style={styles.classDetails}>
            <View style={styles.detailItem}>
              <Ionicons name="time-outline" size={14} color="#6B7280" />
              <Text style={styles.detailText}>{item.time}</Text>
            </View>
            <View style={styles.detailItem}>
              <Ionicons name="location-outline" size={14} color="#6B7280" />
              <Text style={styles.detailText}>{item.room}</Text>
            </View>
          </View>
        </View>
      </View>
      <View style={styles.classRight}>
        <Text style={styles.studentCount}>{item.students}</Text>
        <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
      </View>
    </TouchableOpacity>
  );

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaView style={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.headerTitle}>Class Schedule</Text>
            <Text style={styles.headerSubtitle}>Weekly class calendar</Text>
          </View>
          <TouchableOpacity style={styles.calendarButton} onPress={handleOpenCalendar}>
            <Ionicons name="calendar-outline" size={24} color="#5B7FFF" />
          </TouchableOpacity>
        </View>

      {/* Weekly Day Selector */}
      <ScrollView 
        horizontal 
        showsHorizontalScrollIndicator={false}
        style={styles.daySelector}
        contentContainerStyle={styles.daySelectorContent}
      >
        {[0, 1, 2, 3, 4, 5, 6].map((dayIndex) => {
          const today = new Date();
          const isToday = today.getDay() === dayIndex;
          const isSelected = selectedDay === dayIndex;
          
          return (
            <TouchableOpacity
              key={dayIndex}
              style={[
                styles.dayButton,
                isSelected && styles.dayButtonActive,
              ]}
              onPress={() => handleDaySelect(dayIndex)}
            >
              <Text style={[
                styles.dayName,
                isSelected && styles.dayNameActive,
              ]}>
                {getDayName(dayIndex)}
              </Text>
              <Text style={[
                styles.dayNumber,
                isSelected && styles.dayNumberActive,
              ]}>
                {getDayNumber(today, dayIndex)}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Class List */}
      <FlatList
        data={filteredClasses}
        renderItem={renderClassItem}
        keyExtractor={(item) => item.id.toString()}
        contentContainerStyle={styles.listContent}
        showsVerticalScrollIndicator={false}
      />
      
      {/* Bottom Sheet Calendar */}
      <BottomSheet
        ref={bottomSheetRef}
        index={-1}
        snapPoints={snapPoints}
        enablePanDownToClose={true}
        backdropComponent={renderBackdrop}
        backgroundStyle={styles.bottomSheetBackground}
        handleIndicatorStyle={styles.bottomSheetIndicator}
      >
        <View style={styles.calendarContainer}>
          {/* Calendar Header */}
          <View style={styles.calendarHeader}>
            <TouchableOpacity onPress={handlePreviousMonth} style={styles.monthButton}>
              <Ionicons name="chevron-back" size={24} color="#1F2937" />
            </TouchableOpacity>
            <Text style={styles.monthYearText}>{formatMonthYear(currentMonth)}</Text>
            <TouchableOpacity onPress={handleNextMonth} style={styles.monthButton}>
              <Ionicons name="chevron-forward" size={24} color="#1F2937" />
            </TouchableOpacity>
          </View>
          
          {/* Day Names */}
          <View style={styles.dayNamesContainer}>
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day, index) => (
              <View key={index} style={styles.dayNameCell}>
                <Text style={styles.dayNameText}>{day}</Text>
              </View>
            ))}
          </View>
          
          {/* Calendar Grid */}
          <View style={styles.calendarGrid}>
            {(() => {
              const { daysInMonth, startingDayOfWeek } = getDaysInMonth(currentMonth);
              const days = [];
              
              // Empty cells before first day
              for (let i = 0; i < startingDayOfWeek; i++) {
                days.push(
                  <View key={`empty-${i}`} style={styles.dayCell} />
                );
              }
              
              // Days of the month
              for (let day = 1; day <= daysInMonth; day++) {
                const currentDate = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), day);
                const isSelected = isSameDay(currentDate, selectedDate);
                const isTodayDate = isToday(currentDate);
                
                days.push(
                  <TouchableOpacity
                    key={day}
                    style={[
                      styles.dayCell,
                      isSelected && styles.selectedDayCell,
                      isTodayDate && !isSelected && styles.todayDayCell,
                    ]}
                    onPress={() => handleDateSelect(day)}
                  >
                    <Text
                      style={[
                        styles.dayText,
                        isSelected && styles.selectedDayText,
                        isTodayDate && !isSelected && styles.todayDayText,
                      ]}
                    >
                      {day}
                    </Text>
                  </TouchableOpacity>
                );
              }
              
              return days;
            })()}
          </View>
          
          {/* Today Button */}
          <TouchableOpacity style={styles.todayButton} onPress={handleToday}>
            <Ionicons name="today-outline" size={20} color="#5B7FFF" />
            <Text style={styles.todayButtonText}>Go to Today</Text>
          </TouchableOpacity>
        </View>
      </BottomSheet>
    </SafeAreaView>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  calendarButton: {
    width: 44,
    height: 44,
    alignItems: 'center',
    justifyContent: 'center',
  },
  daySelector: {
    marginTop: 16,
    marginBottom: 16,
  },
  daySelectorContent: {
    paddingHorizontal: 20,
    gap: 12,
  },
  dayButton: {
    width: 56,
    height: 72,
    borderRadius: 16,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  dayButtonActive: {
    backgroundColor: '#5B7FFF',
    borderColor: '#5B7FFF',
  },
  dayName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 4,
  },
  dayNameActive: {
    color: '#fff',
  },
  dayNumber: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  dayNumberActive: {
    color: '#fff',
  },
  listContent: {
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  classCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  classLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 12,
  },
  statusIndicator: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  classInfo: {
    flex: 1,
  },
  courseCode: {
    fontSize: 15,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 2,
  },
  courseTitle: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  classDetails: {
    flexDirection: 'row',
    gap: 12,
  },
  detailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  detailText: {
    fontSize: 12,
    color: '#6B7280',
  },
  classRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  studentCount: {
    fontSize: 13,
    fontWeight: '600',
    color: '#5B7FFF',
  },
  // Bottom Sheet Styles
  bottomSheetBackground: {
    backgroundColor: '#fff',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
  },
  bottomSheetIndicator: {
    backgroundColor: '#D1D5DB',
    width: 40,
    height: 4,
  },
  calendarContainer: {
    flex: 1,
    paddingHorizontal: 20,
    paddingBottom: 20,
  },
  calendarHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
    paddingHorizontal: 8,
  },
  monthButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  monthYearText: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  dayNamesContainer: {
    flexDirection: 'row',
    marginBottom: 12,
  },
  dayNameCell: {
    width: (width - 40) / 7,
    alignItems: 'center',
    paddingVertical: 8,
  },
  dayNameText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#6B7280',
  },
  calendarGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    marginBottom: 20,
  },
  dayCell: {
    width: (width - 40) / 7,
    aspectRatio: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  selectedDayCell: {
    backgroundColor: '#5B7FFF',
    borderRadius: 12,
  },
  todayDayCell: {
    borderWidth: 2,
    borderColor: '#5B7FFF',
    borderRadius: 12,
  },
  dayText: {
    fontSize: 15,
    color: '#1F2937',
    fontWeight: '500',
  },
  selectedDayText: {
    color: '#fff',
    fontWeight: '700',
  },
  todayDayText: {
    color: '#5B7FFF',
    fontWeight: '700',
  },
  todayButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EEF2FF',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  todayButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#5B7FFF',
  },
});

