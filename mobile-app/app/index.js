import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  Alert,
  Animated,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from './context/UserContext';

// Smart Attendance Logo Component with Premium Animations
const SmartAttendanceLogo = () => {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;

  useEffect(() => {
    // Fade-in and scale animation
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        tension: 50,
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Shimmer animation loop
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.delay(1000),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 0,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-250, 250],
  });

  return (
    <Animated.View 
      style={[
        styles.logoContainer,
        { 
          opacity: fadeAnim,
          transform: [{ scale: scaleAnim }]
        }
      ]}
    >
      <View style={styles.logoWrapper}>
        {/* Logo Icon */}
        <View style={styles.logoIconContainer}>
          <Ionicons name="school" size={64} color="#5B7FFF" />
        </View>
        
        {/* Shimmer overlay */}
        <Animated.View
          style={[
            styles.shimmerOverlay,
            {
              transform: [{ translateX: shimmerTranslate }],
            },
          ]}
        />
      </View>
      
      {/* Logo Text */}
      <Animated.View style={{ opacity: fadeAnim }}>
        <Text style={styles.logoTitle}>Smart Attendance</Text>
      </Animated.View>
    </Animated.View>
  );
};

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useUser();
  const [userType, setUserType] = useState('student');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Clear fields when user type changes
  const handleUserTypeChange = (type) => {
    setUserType(type);
    setEmail('');      // Clear email
    setPassword('');   // Clear password
  };

  const handleSignIn = () => {
    // Validate empty fields
    if (!email.trim() && !password.trim()) {
      Alert.alert(
        'Missing Information',
        'Please enter your email and password to continue.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!email.trim()) {
      Alert.alert(
        'Email Required',
        'Please enter your email address.',
        [{ text: 'OK' }]
      );
      return;
    }
    
    if (!password.trim()) {
      Alert.alert(
        'Password Required',
        'Please enter your password.',
        [{ text: 'OK' }]
      );
      return;
    }

    // Login
    const name = userType === 'instructor' ? 'Dr. Robert Chen' : 'John Doe';
    login(userType, email, name);
    
    if (userType === 'instructor') {
      router.push('/(tabs)/dashboard');
    } else {
      router.push('/(tabs)/home');
    }
  };

  const handleForgotPassword = () => {
    console.log('Forgot password clicked');
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.keyboardView}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Logo and Header */}
          <View style={styles.header}>
            <SmartAttendanceLogo />
            <Text style={styles.title}>Welcome Back</Text>
            <Text style={styles.subtitle}>
              {userType === 'instructor' 
                ? 'Sign in to manage your classes' 
                : 'Sign in to mark your attendance'}
            </Text>
          </View>

          {/* Login Form */}
          <View style={styles.formContainer}>
            {/* User Type Selection */}
            <Text style={styles.label}>I am a</Text>
            <View style={styles.userTypeContainer}>
              <TouchableOpacity
                style={[
                  styles.userTypeButton,
                  userType === 'student' && styles.userTypeButtonActive,
                ]}
                onPress={() => handleUserTypeChange('student')} // DEĞİŞTİ
              >
                <Ionicons
                  name="person"
                  size={20}
                  color={userType === 'student' ? '#5B7FFF' : '#6B7280'}
                />
                <Text
                  style={[
                    styles.userTypeText,
                    userType === 'student' && styles.userTypeTextActive,
                  ]}
                >
                  Student
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.userTypeButton,
                  userType === 'instructor' && styles.userTypeButtonActive,
                ]}
                onPress={() => handleUserTypeChange('instructor')} // DEĞİŞTİ
              >
                <Ionicons
                  name="briefcase"
                  size={20}
                  color={userType === 'instructor' ? '#5B7FFF' : '#6B7280'}
                />
                <Text
                  style={[
                    styles.userTypeText,
                    userType === 'instructor' && styles.userTypeTextActive,
                  ]}
                >
                  Instructor
                </Text>
              </TouchableOpacity>
            </View>

            {/* Email Input */}
            <Text style={styles.label}>School Email</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="mail-outline" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder={
                  userType === 'instructor'
                    ? 'instructor@school.edu'
                    : 'student@school.edu'
                }
                placeholderTextColor="#9CA3AF"
                value={email}
                onChangeText={setEmail}
                keyboardType="email-address"
                autoCapitalize="none"
              />
            </View>

            {/* Password Input */}
            <Text style={styles.label}>Password</Text>
            <View style={styles.inputContainer}>
              <Ionicons name="lock-closed-outline" size={20} color="#9CA3AF" />
              <TextInput
                style={styles.input}
                placeholder="Enter your password"
                placeholderTextColor="#9CA3AF"
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity onPress={() => setShowPassword(!showPassword)}>
                <Ionicons
                  name={showPassword ? "eye-outline" : "eye-off-outline"}
                  size={20}
                  color="#9CA3AF"
                />
              </TouchableOpacity>
            </View>

            {/* Forgot Password Link */}
            <TouchableOpacity
              style={styles.forgotPasswordContainer}
              onPress={handleForgotPassword}
            >
              <Text style={styles.forgotPasswordText}>Forgot Password?</Text>
            </TouchableOpacity>

            {/* Sign In Button */}
            <TouchableOpacity
              style={styles.signInButton}
              onPress={handleSignIn}
              activeOpacity={0.8}
            >
              <Text style={styles.signInButtonText}>Sign In</Text>
            </TouchableOpacity>

            {/* Sign Up Link */}
            <View style={styles.signUpContainer}>
              <Text style={styles.signUpText}>Don't have an account? </Text>
              <TouchableOpacity>
                <Text style={styles.signUpLink}>Sign Up</Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
  },
  header: {
    alignItems: 'center',
    paddingVertical: 40,
    paddingHorizontal: 20,
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  logoWrapper: {
    width: 120,
    height: 120,
    borderRadius: 30,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    shadowColor: '#5B7FFF',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 10,
    marginBottom: 16,
  },
  logoIconContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  shimmerOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: 80,
    backgroundColor: 'rgba(91, 127, 255, 0.2)',
    transform: [{ skewX: '-20deg' }],
  },
  logoTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#5B7FFF',
    letterSpacing: 0.5,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: '#1F2937',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
  },
  formContainer: {
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    color: '#374151',
    marginBottom: 8,
  },
  userTypeContainer: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  userTypeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 12,
    backgroundColor: '#fff',
    borderWidth: 2,
    borderColor: '#E5E7EB',
  },
  userTypeButtonActive: {
    borderColor: '#5B7FFF',
    backgroundColor: '#EEF2FF',
  },
  userTypeText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#6B7280',
  },
  userTypeTextActive: {
    color: '#5B7FFF',
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fff',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: '#1F2937',
    marginLeft: 12,
  },
  forgotPasswordContainer: {
    alignItems: 'flex-end',
    marginBottom: 24,
  },
  forgotPasswordText: {
    fontSize: 14,
    color: '#5B7FFF',
    fontWeight: '600',
  },
  signInButton: {
    backgroundColor: '#5B7FFF',
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#5B7FFF',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    marginBottom: 20,
  },
  signInButtonText: {
    fontSize: 16,
    fontWeight: 'bold',
    color: '#fff',
  },
  signUpContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 20,
  },
  signUpText: {
    fontSize: 14,
    color: '#6B7280',
  },
  signUpLink: {
    fontSize: 14,
    color: '#5B7FFF',
    fontWeight: '600',
  },
});