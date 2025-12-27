import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    SafeAreaView,
    FlatList,
    Modal,
    Alert,
    ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useUser } from './context/UserContext';
import { getUpcomingClasses, cancelClass } from './services/classService';

export default function CancelClassScreen() {
    const router = useRouter();
    const { userName } = useUser();

    const [upcomingClasses, setUpcomingClasses] = useState([]);
    const [loading, setLoading] = useState(true);
    const [selectedClass, setSelectedClass] = useState(null);
    const [showReasonModal, setShowReasonModal] = useState(false);
    const [showConfirmModal, setShowConfirmModal] = useState(false);
    const [cancelReason, setCancelReason] = useState('Instructor unavailable');
    const [cancelling, setCancelling] = useState(false);

    const reasons = [
        { id: 1, label: 'Instructor unavailable', value: 'Instructor unavailable' },
        { id: 2, label: 'Technical issues', value: 'Technical issues' },
        { id: 3, label: 'Holiday/Event', value: 'Holiday/Event' },
        { id: 4, label: 'Emergency', value: 'Emergency' },
    ];

    useEffect(() => {
        loadUpcomingClasses();
    }, []);

    const loadUpcomingClasses = async () => {
        try {
            setLoading(true);
            const response = await getUpcomingClasses('instructor1'); // TODO: Get from user context
            if (response.success) {
                setUpcomingClasses(response.classes);
            } else {
                Alert.alert('Error', 'Failed to load upcoming classes');
            }
        } catch (error) {
            Alert.alert('Error', 'Could not connect to server');
            console.error('Load classes error:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClassSelect = (classItem) => {
        setSelectedClass(classItem);
        setShowReasonModal(true);
    };

    const handleReasonSelect = (reason) => {
        setCancelReason(reason);
    };

    const handleReasonConfirm = () => {
        setShowReasonModal(false);
        setShowConfirmModal(true);
    };

    const handleCancelClass = async () => {
        try {
            setCancelling(true);
            const response = await cancelClass(
                selectedClass.id,
                cancelReason,
                'instructor1' // TODO: Get from user context
            );

            if (response.success) {
                setShowConfirmModal(false);
                Alert.alert(
                    'Success',
                    'Class has been cancelled successfully',
                    [
                        {
                            text: 'OK',
                            onPress: () => {
                                // Remove cancelled class from list
                                setUpcomingClasses(prev =>
                                    prev.filter(c => c.id !== selectedClass.id)
                                );
                                setSelectedClass(null);
                            }
                        }
                    ]
                );
            } else {
                Alert.alert('Error', response.message || 'Failed to cancel class');
            }
        } catch (error) {
            Alert.alert('Error', 'Could not cancel class. Please try again.');
            console.error('Cancel class error:', error);
        } finally {
            setCancelling(false);
        }
    };

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        const options = { weekday: 'short', month: 'short', day: 'numeric' };
        return date.toLocaleDateString('en-US', options);
    };

    const renderClassItem = ({ item }) => (
        <TouchableOpacity
            style={styles.classCard}
            onPress={() => handleClassSelect(item)}
        >
            <View style={styles.classLeft}>
                <View style={styles.classIcon}>
                    <Ionicons name="calendar" size={24} color="#5B7FFF" />
                </View>
                <View style={styles.classInfo}>
                    <Text style={styles.courseCode}>{item.course}</Text>
                    <Text style={styles.courseTitle}>{item.title}</Text>
                    <View style={styles.classDetails}>
                        <View style={styles.detailItem}>
                            <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                            <Text style={styles.detailText}>{formatDate(item.date)}</Text>
                        </View>
                        <View style={styles.detailItem}>
                            <Ionicons name="time-outline" size={14} color="#6B7280" />
                            <Text style={styles.detailText}>{item.time}</Text>
                        </View>
                    </View>
                    <View style={styles.detailItem}>
                        <Ionicons name="location-outline" size={14} color="#6B7280" />
                        <Text style={styles.detailText}>{item.room}</Text>
                    </View>
                </View>
            </View>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
        </TouchableOpacity>
    );

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                        <Ionicons name="arrow-back" size={24} color="#1F2937" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Cancel Class</Text>
                    <View style={styles.backButton} />
                </View>
                <View style={styles.loadingContainer}>
                    <ActivityIndicator size="large" color="#5B7FFF" />
                    <Text style={styles.loadingText}>Loading classes...</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
                    <Ionicons name="arrow-back" size={24} color="#1F2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Cancel Class</Text>
                <View style={styles.backButton} />
            </View>

            {/* Info Banner */}
            <View style={styles.infoBanner}>
                <Ionicons name="information-circle" size={20} color="#5B7FFF" />
                <Text style={styles.infoText}>
                    Select a class to cancel. Students will be notified.
                </Text>
            </View>

            {/* Classes List */}
            {upcomingClasses.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
                    <Text style={styles.emptyTitle}>No Upcoming Classes</Text>
                    <Text style={styles.emptyText}>
                        You don't have any scheduled classes to cancel.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={upcomingClasses}
                    renderItem={renderClassItem}
                    keyExtractor={(item) => item.id.toString()}
                    contentContainerStyle={styles.listContent}
                    showsVerticalScrollIndicator={false}
                />
            )}

            {/* Reason Selection Modal */}
            <Modal
                visible={showReasonModal}
                transparent
                animationType="slide"
                onRequestClose={() => setShowReasonModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <Text style={styles.modalTitle}>Select Cancellation Reason</Text>
                        <Text style={styles.modalSubtitle}>
                            {selectedClass?.course} - {selectedClass?.title}
                        </Text>

                        {reasons.map((reason) => (
                            <TouchableOpacity
                                key={reason.id}
                                style={[
                                    styles.reasonOption,
                                    cancelReason === reason.value && styles.reasonOptionActive
                                ]}
                                onPress={() => handleReasonSelect(reason.value)}
                            >
                                <Text style={styles.reasonText}>{reason.label}</Text>
                                {cancelReason === reason.value && (
                                    <Ionicons name="checkmark-circle" size={20} color="#5B7FFF" />
                                )}
                            </TouchableOpacity>
                        ))}

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setShowReasonModal(false)}
                            >
                                <Text style={styles.modalCancelText}>Cancel</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalNextButton}
                                onPress={handleReasonConfirm}
                            >
                                <Text style={styles.modalNextText}>Next</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>

            {/* Confirmation Modal */}
            <Modal
                visible={showConfirmModal}
                transparent
                animationType="fade"
                onRequestClose={() => setShowConfirmModal(false)}
            >
                <View style={styles.modalOverlay}>
                    <View style={styles.confirmModalContent}>
                        <View style={styles.confirmIcon}>
                            <Ionicons name="warning" size={48} color="#EF4444" />
                        </View>
                        <Text style={styles.confirmTitle}>Cancel This Class?</Text>
                        <Text style={styles.confirmSubtitle}>
                            {selectedClass?.course} - {selectedClass?.title}
                        </Text>
                        <View style={styles.confirmDetails}>
                            <View style={styles.confirmDetailRow}>
                                <Ionicons name="calendar" size={16} color="#6B7280" />
                                <Text style={styles.confirmDetailText}>
                                    {selectedClass && formatDate(selectedClass.date)}
                                </Text>
                            </View>
                            <View style={styles.confirmDetailRow}>
                                <Ionicons name="time" size={16} color="#6B7280" />
                                <Text style={styles.confirmDetailText}>{selectedClass?.time}</Text>
                            </View>
                            <View style={styles.confirmDetailRow}>
                                <Ionicons name="information-circle" size={16} color="#6B7280" />
                                <Text style={styles.confirmDetailText}>{cancelReason}</Text>
                            </View>
                        </View>
                        <Text style={styles.confirmWarning}>
                            This action cannot be undone. All enrolled students will be notified.
                        </Text>

                        <View style={styles.modalActions}>
                            <TouchableOpacity
                                style={styles.modalCancelButton}
                                onPress={() => setShowConfirmModal(false)}
                                disabled={cancelling}
                            >
                                <Text style={styles.modalCancelText}>Go Back</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                                style={styles.modalConfirmButton}
                                onPress={handleCancelClass}
                                disabled={cancelling}
                            >
                                {cancelling ? (
                                    <ActivityIndicator size="small" color="#fff" />
                                ) : (
                                    <Text style={styles.modalConfirmText}>Cancel Class</Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#EEF2FF',
        marginHorizontal: 20,
        marginTop: 16,
        padding: 12,
        borderRadius: 12,
        gap: 8,
    },
    infoText: {
        flex: 1,
        fontSize: 13,
        color: '#5B7FFF',
    },
    loadingContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
    },
    loadingText: {
        fontSize: 15,
        color: '#6B7280',
    },
    emptyContainer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 40,
    },
    emptyTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#1F2937',
        marginTop: 16,
        marginBottom: 8,
    },
    emptyText: {
        fontSize: 14,
        color: '#6B7280',
        textAlign: 'center',
    },
    listContent: {
        paddingHorizontal: 20,
        paddingTop: 16,
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
    classIcon: {
        width: 48,
        height: 48,
        borderRadius: 12,
        backgroundColor: '#EEF2FF',
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
        marginBottom: 8,
    },
    classDetails: {
        flexDirection: 'row',
        gap: 12,
        marginBottom: 4,
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
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContent: {
        backgroundColor: '#fff',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
        marginBottom: 4,
    },
    modalSubtitle: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 20,
    },
    reasonOption: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: 16,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        marginBottom: 12,
    },
    reasonOptionActive: {
        borderColor: '#5B7FFF',
        backgroundColor: '#EEF2FF',
    },
    reasonText: {
        fontSize: 15,
        color: '#1F2937',
    },
    modalActions: {
        flexDirection: 'row',
        gap: 12,
        marginTop: 8,
    },
    modalCancelButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        alignItems: 'center',
    },
    modalCancelText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6B7280',
    },
    modalNextButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#5B7FFF',
        alignItems: 'center',
    },
    modalNextText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
    confirmModalContent: {
        backgroundColor: '#fff',
        borderRadius: 24,
        padding: 24,
        marginHorizontal: 20,
        marginVertical: 'auto',
    },
    confirmIcon: {
        width: 80,
        height: 80,
        borderRadius: 40,
        backgroundColor: '#FEE2E2',
        alignItems: 'center',
        justifyContent: 'center',
        alignSelf: 'center',
        marginBottom: 16,
    },
    confirmTitle: {
        fontSize: 20,
        fontWeight: '700',
        color: '#1F2937',
        textAlign: 'center',
        marginBottom: 4,
    },
    confirmSubtitle: {
        fontSize: 15,
        color: '#6B7280',
        textAlign: 'center',
        marginBottom: 20,
    },
    confirmDetails: {
        backgroundColor: '#F9FAFB',
        borderRadius: 12,
        padding: 16,
        gap: 12,
        marginBottom: 16,
    },
    confirmDetailRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    confirmDetailText: {
        fontSize: 14,
        color: '#1F2937',
    },
    confirmWarning: {
        fontSize: 13,
        color: '#EF4444',
        textAlign: 'center',
        marginBottom: 20,
    },
    modalConfirmButton: {
        flex: 1,
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#EF4444',
        alignItems: 'center',
    },
    modalConfirmText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#fff',
    },
});
