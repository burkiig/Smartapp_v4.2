import React, { useEffect, useMemo, useRef } from 'react';
import { Animated, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Colors, Shadows } from '../config/theme';

const BANNER_TYPES = {
  warning: {
    bg: Colors.warningLight,
    border: Colors.warning,
    text: Colors.warning,
  },
  error: {
    bg: Colors.errorLight,
    border: Colors.error,
    text: Colors.error,
  },
  info: {
    bg: Colors.primaryLight,
    border: Colors.primary,
    text: Colors.primary,
  },
};

export default function InAppBanner({
  item,
  topInset = 0,
  visible,
  durationMs = 3000,
  onDone,
  onActionPress,
}) {
  const translateY = useRef(new Animated.Value(-60)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const hideTimerRef = useRef(null);
  const palette = useMemo(() => BANNER_TYPES[item?.type] || BANNER_TYPES.info, [item?.type]);

  useEffect(() => {
    if (!visible || !item) return undefined;

    Animated.parallel([
      Animated.timing(translateY, { toValue: 0, duration: 220, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();

    hideTimerRef.current = setTimeout(() => {
      Animated.parallel([
        Animated.timing(translateY, { toValue: -60, duration: 220, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }),
      ]).start(({ finished }) => {
        if (finished) onDone?.();
      });
    }, durationMs);

    return () => {
      if (hideTimerRef.current) clearTimeout(hideTimerRef.current);
      translateY.setValue(-60);
      opacity.setValue(0);
    };
  }, [durationMs, item, onDone, opacity, translateY, visible]);

  if (!visible || !item) return null;

  return (
    <Animated.View
      pointerEvents={item.actionLabel ? 'auto' : 'none'}
      style={[
        styles.wrapper,
        {
          top: topInset + 8,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={[styles.banner, { backgroundColor: palette.bg, borderColor: palette.border }]}>
        <Text style={[styles.message, { color: palette.text }]} numberOfLines={3} ellipsizeMode="tail">
          {item.message}
        </Text>
        {item.actionLabel ? (
          <TouchableOpacity
            style={[styles.actionBtn, { backgroundColor: palette.border }]}
            onPress={() => onActionPress?.(item)}
          >
            <Text style={styles.actionText}>{item.actionLabel}</Text>
          </TouchableOpacity>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    position: 'absolute',
    left: 16,
    right: 16,
    zIndex: 999,
  },
  banner: {
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 12,
    paddingVertical: 10,
    ...Shadows.md,
  },
  message: {
    fontSize: 14,
    fontWeight: '600',
  },
  actionBtn: {
    marginTop: 8,
    borderRadius: 8,
    alignSelf: 'flex-start',
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  actionText: {
    color: Colors.textInverse,
    fontSize: 12,
    fontWeight: '700',
  },
});
