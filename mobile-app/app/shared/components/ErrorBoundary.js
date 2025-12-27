import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';

/**
 * Error Boundary Component
 * Catches JavaScript errors anywhere in the child component tree
 */
export class ErrorBoundary extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            hasError: false,
            error: null,
            errorInfo: null
        };
    }

    static getDerivedStateFromError(error) {
        return { hasError: true, error };
    }

    componentDidCatch(error, errorInfo) {
        console.error('Error caught by boundary:', error, errorInfo);
        this.setState({ errorInfo });
    }

    handleReset = () => {
        this.setState({
            hasError: false,
            error: null,
            errorInfo: null
        });
    };

    render() {
        if (this.state.hasError) {
            return (
                <View style={styles.container}>
                    <View style={styles.content}>
                        <Text style={styles.emoji}>⚠️</Text>
                        <Text style={styles.title}>Bir Hata Oluştu</Text>
                        <Text style={styles.message}>
                            {this.state.error?.message || 'Beklenmeyen bir hata oluştu'}
                        </Text>

                        {__DEV__ && this.state.errorInfo && (
                            <View style={styles.debugInfo}>
                                <Text style={styles.debugTitle}>Debug Info:</Text>
                                <Text style={styles.debugText}>
                                    {this.state.errorInfo.componentStack}
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.button}
                            onPress={this.handleReset}
                        >
                            <Text style={styles.buttonText}>Yeniden Dene</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            );
        }

        return this.props.children;
    }
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: '#f8f9fa',
        padding: 20
    },
    content: {
        alignItems: 'center',
        maxWidth: 400
    },
    emoji: {
        fontSize: 64,
        marginBottom: 20
    },
    title: {
        fontSize: 24,
        fontWeight: 'bold',
        color: '#1f2937',
        marginBottom: 12,
        textAlign: 'center'
    },
    message: {
        fontSize: 16,
        color: '#6b7280',
        textAlign: 'center',
        marginBottom: 24,
        lineHeight: 24
    },
    debugInfo: {
        backgroundColor: '#fff',
        padding: 16,
        borderRadius: 8,
        marginBottom: 24,
        width: '100%',
        maxHeight: 200
    },
    debugTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        color: '#ef4444',
        marginBottom: 8
    },
    debugText: {
        fontSize: 12,
        color: '#6b7280',
        fontFamily: 'monospace'
    },
    button: {
        backgroundColor: '#3b82f6',
        paddingHorizontal: 32,
        paddingVertical: 12,
        borderRadius: 8
    },
    buttonText: {
        color: '#fff',
        fontSize: 16,
        fontWeight: '600'
    }
});
