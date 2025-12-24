import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from './context/UserContext';

export default function SettingsScreen() {
  const router = useRouter();
  const { userName, userEmail } = useUser();

  // Notification Settings
  const [emailNotifications, setEmailNotifications] = useState(true);
  const [pushNotifications, setPushNotifications] = useState(true);
  const [notifyFlagged, setNotifyFlagged] = useState(true);
  const [notifySessionEnds, setNotifySessionEnds] = useState(true);
  const [notifyClassStart, setNotifyClassStart] = useState(false);

  // Preferences
  const [language, setLanguage] = useState('English');
  const [timeFormat, setTimeFormat] = useState('12-hour');
  const [theme, setTheme] = useState('light');

  // Auto Attendance
  const [autoAttendance, setAutoAttendance] = useState(true);
  const [faceRecognition, setFaceRecognition] = useState(true);
  const [qrCode, setQrCode] = useState(true);
  const [gpsVerification, setGpsVerification] = useState(true);

  const handleSave = () => {
    Alert.alert('Success', 'Settings saved!');
  };

  const handleReset = () => {
    Alert.alert(
      'Reset Settings',
      'Are you sure you want to reset all settings to default?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset',
          style: 'destructive',
          onPress: () => {
            setEmailNotifications(true);
            setPushNotifications(true);
            setNotifyFlagged(true);
            setNotifySessionEnds(true);
            setNotifyClassStart(false);
            setLanguage('English');
            setTimeFormat('12-hour');
            setTheme('light');
            setAutoAttendance(true);
            setFaceRecognition(true);
            setQrCode(true);
            setGpsVerification(true);
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <View style={styles.headerCenter}>
          <Text style={styles.headerTitle}>Settings</Text>
          <Text style={styles.headerSubtitle}>Manage your preferences</Text>
        </View>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Notifications Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="notifications" size={24} color="#5B7FFF" />
            <Text style={styles.sectionTitle}>Notifications</Text>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Email Notifications</Text>
                <Text style={styles.settingDescription}>
                  Receive attendance alerts via email
                </Text>
              </View>
              <Switch
                value={emailNotifications}
                onValueChange={setEmailNotifications}
                trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
                thumbColor={emailNotifications ? '#5B7FFF' : '#9CA3AF'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Push Notifications</Text>
                <Text style={styles.settingDescription}>
                  Get notifications for flagged attendance
                </Text>
              </View>
              <Switch
                value={pushNotifications}
                onValueChange={setPushNotifications}
                trackColor={{ false: '#E5E7EB', true: '#93C5FD' }}
                thumbColor={pushNotifications ? '#5B7FFF' : '#9CA3AF'}
              />
            </View>
          </View>

          <View style={styles.subsectionCard}>
            <Text style={styles.subsectionTitle}>Beni bilgilendir</Text>
            
            <TouchableOpacity
              style={styles.checkboxItem}
              onPress={() => setNotifyFlagged(!notifyFlagged)}
            >
              <Ionicons
                name={notifyFlagged ? 'checkbox' : 'square-outline'}
                size={24}
                color={notifyFlagged ? '#5B7FFF' : '#9CA3AF'}
              />
              <Text style={styles.checkboxText}>
                When student attendance is flagged
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxItem}
              onPress={() => setNotifySessionEnds(!notifySessionEnds)}
            >
              <Ionicons
                name={notifySessionEnds ? 'checkbox' : 'square-outline'}
                size={24}
                color={notifySessionEnds ? '#5B7FFF' : '#9CA3AF'}
              />
              <Text style={styles.checkboxText}>When attendance session ends</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.checkboxItem}
              onPress={() => setNotifyClassStart(!notifyClassStart)}
            >
              <Ionicons
                name={notifyClassStart ? 'checkbox' : 'square-outline'}
                size={24}
                color={notifyClassStart ? '#5B7FFF' : '#9CA3AF'}
              />
              <Text style={styles.checkboxText}>When class is about to start</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Preferences Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="settings" size={24} color="#10B981" />
            <Text style={styles.sectionTitle}>Preferences</Text>
          </View>

          <View style={styles.settingCard}>
            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Language</Text>
                <Text style={styles.settingValue}>{language}</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Time Format</Text>
                <Text style={styles.settingValue}>
                  {timeFormat === '12-hour' ? '12 hour (2:30 PM)' : '24 hour (14:30)'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>

            <View style={styles.divider} />

            <TouchableOpacity style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Theme</Text>
                <Text style={styles.settingValue}>
                  {theme === 'light' ? 'Light' : 'Dark'}
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          </View>
        </View>

        {/* Auto Attendance Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="flash" size={24} color="#F59E0B" />
            <Text style={styles.sectionTitle}>Auto Attendance</Text>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Auto Attendance</Text>
                <Text style={styles.settingDescription}>
                  Automatically open/close sessions
                </Text>
              </View>
              <Switch
                value={autoAttendance}
                onValueChange={setAutoAttendance}
                trackColor={{ false: '#E5E7EB', true: '#FCD34D' }}
                thumbColor={autoAttendance ? '#F59E0B' : '#9CA3AF'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>Face Recognition</Text>
                <Text style={styles.settingDescription}>
                  Take attendance with Face ID
                </Text>
              </View>
              <Switch
                value={faceRecognition}
                onValueChange={setFaceRecognition}
                trackColor={{ false: '#E5E7EB', true: '#FCD34D' }}
                thumbColor={faceRecognition ? '#F59E0B' : '#9CA3AF'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>QR Code</Text>
                <Text style={styles.settingDescription}>Take attendance with QR code</Text>
              </View>
              <Switch
                value={qrCode}
                onValueChange={setQrCode}
                trackColor={{ false: '#E5E7EB', true: '#FCD34D' }}
                thumbColor={qrCode ? '#F59E0B' : '#9CA3AF'}
              />
            </View>

            <View style={styles.divider} />

            <View style={styles.settingItem}>
              <View style={styles.settingInfo}>
                <Text style={styles.settingLabel}>GPS Verification</Text>
                <Text style={styles.settingDescription}>
                  Verify with location
                </Text>
              </View>
              <Switch
                value={gpsVerification}
                onValueChange={setGpsVerification}
                trackColor={{ false: '#E5E7EB', true: '#FCD34D' }}
                thumbColor={gpsVerification ? '#F59E0B' : '#9CA3AF'}
              />
            </View>
          </View>
        </View>

        {/* Profile Section */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Ionicons name="person" size={24} color="#A855F7" />
            <Text style={styles.sectionTitle}>Profil Bilgileri</Text>
          </View>

          <View style={styles.settingCard}>
            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>İsim</Text>
              <Text style={styles.profileValue}>{userName || 'Dr. Robert Chen'}</Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Email</Text>
              <Text style={styles.profileValue}>
                {userEmail || 'robert.chen@university.edu'}
              </Text>
            </View>

            <View style={styles.divider} />

            <View style={styles.profileItem}>
              <Text style={styles.profileLabel}>Bölüm</Text>
              <Text style={styles.profileValue}>Computer Science</Text>
            </View>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsSection}>
          <TouchableOpacity style={styles.saveButton} onPress={handleSave}>
            <Ionicons name="checkmark-circle" size={20} color="#fff" />
            <Text style={styles.saveButtonText}>Save Changes</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.resetButton} onPress={handleReset}>
            <Ionicons name="refresh" size={20} color="#EF4444" />
            <Text style={styles.resetButtonText}>Reset Settings</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F7',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 16,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerCenter: {
    flex: 1,
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  headerSubtitle: {
    fontSize: 13,
    color: '#6B7280',
    marginTop: 2,
  },
  placeholder: {
    width: 40,
  },
  section: {
    paddingHorizontal: 20,
    marginTop: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1F2937',
  },
  settingCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  settingItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
    marginRight: 16,
  },
  settingLabel: {
    fontSize: 15,
    fontWeight: '600',
    color: '#1F2937',
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: 13,
    color: '#6B7280',
  },
  settingValue: {
    fontSize: 14,
    color: '#6B7280',
  },
  divider: {
    height: 1,
    backgroundColor: '#E5E7EB',
    marginVertical: 12,
  },
  subsectionCard: {
    backgroundColor: '#fff',
    borderRadius: 12,
    padding: 16,
    marginTop: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  subsectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
    marginBottom: 12,
  },
  checkboxItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  checkboxText: {
    fontSize: 14,
    color: '#1F2937',
    flex: 1,
  },
  profileItem: {
    paddingVertical: 12,
  },
  profileLabel: {
    fontSize: 13,
    color: '#6B7280',
    marginBottom: 6,
  },
  profileValue: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1F2937',
  },
  actionsSection: {
    paddingHorizontal: 20,
    marginTop: 32,
    gap: 12,
  },
  saveButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#5B7FFF',
    borderRadius: 12,
    paddingVertical: 16,
    shadowColor: '#5B7FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  saveButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
  resetButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingVertical: 16,
    borderWidth: 1,
    borderColor: '#FEE2E2',
  },
  resetButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#EF4444',
  },
  bottomPadding: {
    height: 40,
  },
});

