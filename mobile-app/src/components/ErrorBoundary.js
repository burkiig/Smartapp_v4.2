import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import i18n from '@/i18n';

/**
 * Global hata yakalayıcı.
 * Beklenmedik JavaScript hatalarında beyaz ekran yerine
 * kullanıcı dostu bir mesaj ve "Tekrar Dene" butonu gösterir.
 */
export default class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    console.error('[ErrorBoundary]', error, info?.componentStack || '');
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
  };

  render() {
    if (!this.state.hasError) return this.props.children;

    return (
      <View style={s.container}>
        <Ionicons name="cloud-offline-outline" size={72} color="#CBD5E1" />
        <Text style={s.title}>{i18n.t('errors.boundaryTitle')}</Text>
        <Text style={s.subtitle}>{i18n.t('errors.boundarySubtitle')}</Text>
        <TouchableOpacity style={s.btn} onPress={this.handleRetry}>
          <Ionicons name="refresh" size={18} color="#fff" />
          <Text style={s.btnText}>{i18n.t('errors.reloadConnection')}</Text>
        </TouchableOpacity>
      </View>
    );
  }
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB', alignItems: 'center', justifyContent: 'center', padding: 32 },
  title:     { fontSize: 20, fontWeight: '800', color: '#1E293B', marginTop: 20, textAlign: 'center' },
  subtitle:  { fontSize: 14, color: '#64748B', marginTop: 8, textAlign: 'center', lineHeight: 21 },
  btn:       { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 28, backgroundColor: '#2563EB', paddingHorizontal: 24, paddingVertical: 13, borderRadius: 12 },
  btnText:   { color: '#fff', fontWeight: '700', fontSize: 15 },
});
