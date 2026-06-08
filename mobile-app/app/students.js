import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  View, Text, TouchableOpacity, StyleSheet, FlatList,
  TextInput, ActivityIndicator, RefreshControl, ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useTranslation } from 'react-i18next';
import { courses as coursesApi } from '@/services/api';
import { Colors, Shadows } from '@/config/theme';
import EmptyState from '@/components/EmptyState';

export default function StudentsScreen() {
  const router = useRouter();
  const { t } = useTranslation();

  const [courseList, setCourseList] = useState([]);
  const [selectedCourseId, setSelectedCourseId] = useState(null);
  const [students, setStudents] = useState([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    coursesApi.list()
      .then((data) => {
        if (cancelled) return;
        const list = Array.isArray(data) ? data : [];
        setCourseList(list);
        if (list.length > 0) {
          setSelectedCourseId(prev => prev ?? list[0].id);
        }
      })
      .catch(() => { if (!cancelled) setCourseList([]); });
    return () => { cancelled = true; };
  }, []);

  const loadRoster = useCallback(async (courseId) => {
    if (!courseId) {
      setStudents([]);
      return;
    }
    const data = await coursesApi.students(courseId);
    setStudents(Array.isArray(data) ? data : []);
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return undefined;
    let cancelled = false;
    setLoading(true);
    loadRoster(selectedCourseId)
      .catch(() => { if (!cancelled) setStudents([]); })
      .finally(() => {
        if (!cancelled) {
          setLoading(false);
          setRefreshing(false);
        }
      });
    return () => { cancelled = true; };
  }, [selectedCourseId, loadRoster]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      const [courseRes] = await Promise.allSettled([
        coursesApi.list(),
        selectedCourseId ? loadRoster(selectedCourseId) : Promise.resolve(),
      ]);
      if (courseRes.status === 'fulfilled') {
        setCourseList(Array.isArray(courseRes.value) ? courseRes.value : []);
      }
    } finally {
      setRefreshing(false);
    }
  }, [selectedCourseId, loadRoster]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students;
    return students.filter(s => (
      (s.name || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.student_number || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q) ||
      (s.department || '').toLowerCase().includes(q)
    ));
  }, [students, search]);

  const selectedCourse = courseList.find(c => c.id === selectedCourseId);

  const renderStudent = ({ item }) => {
    const initials = (item.name || item.username || 'U')
      .split(' ')
      .map(n => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

    return (
      <TouchableOpacity
        style={styles.studentCard}
        activeOpacity={0.75}
        onPress={() => {
          if (!selectedCourse) return;
          router.push({
            pathname: '/class-details',
            params: {
              courseId: selectedCourse.id,
              code: selectedCourse.code || '',
              title: selectedCourse.name || '',
            },
          });
        }}
      >
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>{initials}</Text>
        </View>
        <View style={styles.studentBody}>
          <Text style={styles.studentName}>{item.name || item.username || '—'}</Text>
          <Text style={styles.studentMeta} numberOfLines={1}>
            {[item.student_number, item.department].filter(Boolean).join(' · ') || item.email || '—'}
          </Text>
        </View>
        <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
      </TouchableOpacity>
    );
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.headerText}>
          <Text style={styles.headerTitle}>{t('instructor.studentsTitle')}</Text>
          <Text style={styles.headerSub}>
            {selectedCourse
              ? `${selectedCourse.code} · ${t('common.studentCount', { count: filtered.length })}`
              : t('instructor.studentsSub')}
          </Text>
        </View>
        <TouchableOpacity style={styles.backBtn} onPress={onRefresh}>
          <Ionicons name="refresh-outline" size={20} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {courseList.length === 0 && !loading ? (
        <EmptyState
          icon="school-outline"
          title={t('instructor.noCoursesAssigned')}
          subtitle={t('instructor.studentsSub')}
        />
      ) : (
        <>
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            contentContainerStyle={styles.courseChips}
          >
            {courseList.map(course => {
              const active = course.id === selectedCourseId;
              return (
                <TouchableOpacity
                  key={course.id}
                  style={[styles.chip, active && styles.chipActive]}
                  onPress={() => setSelectedCourseId(course.id)}
                  activeOpacity={0.8}
                >
                  <Text style={[styles.chipCode, active && styles.chipTextActive]}>{course.code}</Text>
                  <Text style={[styles.chipName, active && styles.chipTextActive]} numberOfLines={1}>
                    {course.name}
                  </Text>
                  {course.enrolled_count != null && (
                    <Text style={[styles.chipCount, active && styles.chipTextActive]}>
                      {course.enrolled_count}
                    </Text>
                  )}
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={styles.searchRow}>
            <Ionicons name="search-outline" size={18} color={Colors.textMuted} />
            <TextInput
              style={styles.searchInput}
              placeholder={t('instructor.studentsSearchPlaceholder')}
              placeholderTextColor={Colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoCapitalize="none"
              autoCorrect={false}
            />
            {search.length > 0 && (
              <TouchableOpacity onPress={() => setSearch('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close-circle" size={18} color={Colors.textMuted} />
              </TouchableOpacity>
            )}
          </View>

          {loading ? (
            <View style={styles.centered}>
              <ActivityIndicator size="large" color={Colors.primary} />
            </View>
          ) : (
            <FlatList
              data={filtered}
              keyExtractor={item => String(item.id)}
              renderItem={renderStudent}
              contentContainerStyle={styles.listContent}
              refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
              ListEmptyComponent={
                <EmptyState
                  icon="people-outline"
                  title={search ? t('instructor.studentsNoSearch') : t('instructor.noStudents')}
                  subtitle={search ? undefined : t('instructor.studentsSub')}
                />
              }
            />
          )}
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.bg },

  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 10,
    backgroundColor: Colors.card,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: 12,
    backgroundColor: Colors.bgAlt,
    alignItems: 'center', justifyContent: 'center',
  },
  headerText: { flex: 1 },
  headerTitle: { fontSize: 18, fontWeight: '800', color: Colors.text, letterSpacing: -0.3 },
  headerSub: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },

  courseChips: { paddingHorizontal: 16, paddingVertical: 14, gap: 10 },
  chip: {
    width: 140,
    padding: 12,
    borderRadius: 14,
    backgroundColor: Colors.card,
    borderWidth: 1.5,
    borderColor: Colors.borderLight,
    ...Shadows.xs,
  },
  chipActive: {
    backgroundColor: Colors.primaryMuted,
    borderColor: Colors.primary,
  },
  chipCode: { fontSize: 12, fontWeight: '800', color: Colors.primary, marginBottom: 2 },
  chipName: { fontSize: 12, color: Colors.textSecondary, marginBottom: 6 },
  chipCount: { fontSize: 11, fontWeight: '700', color: Colors.textMuted },
  chipTextActive: { color: Colors.primary },

  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 8,
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: Colors.card,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderLight,
  },
  searchInput: { flex: 1, fontSize: 15, color: Colors.text },

  listContent: { paddingHorizontal: 16, paddingBottom: 24, flexGrow: 1 },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 40 },

  studentCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: Colors.card,
    borderRadius: 14,
    padding: 14,
    marginBottom: 8,
    ...Shadows.xs,
  },
  avatar: {
    width: 44, height: 44, borderRadius: 22,
    backgroundColor: Colors.primaryMuted,
    alignItems: 'center', justifyContent: 'center',
  },
  avatarText: { fontSize: 14, fontWeight: '800', color: Colors.primary },
  studentBody: { flex: 1 },
  studentName: { fontSize: 15, fontWeight: '700', color: Colors.text },
  studentMeta: { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
});
