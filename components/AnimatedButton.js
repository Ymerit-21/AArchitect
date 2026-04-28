// AnimatedButton.js — Reusable button with spring press-scale feedback.
// activeOpacity stays at 1 so the scale animation handles the visual feedback.
// Pass disabled=true during loading to block presses without hiding the button.

import { useRef } from 'react';
import { Animated, TouchableOpacity, Text, ActivityIndicator, View } from 'react-native';

export default function AnimatedButton({ label, style, textStyle, onPress, disabled, loading, spinnerColor }) {
  const scale = useRef(new Animated.Value(1)).current;

  const isDisabled = disabled || loading;

  const onPressIn = () => {
    if (isDisabled) return;
    Animated.spring(scale, { toValue: 0.94, useNativeDriver: true, tension: 200, friction: 10 }).start();
  };

  const onPressOut = () => {
    if (isDisabled) return;
    Animated.spring(scale, { toValue: 1, useNativeDriver: true, tension: 120, friction: 6 }).start();
  };

  return (
    <Animated.View style={{ transform: [{ scale }] }}>
      <TouchableOpacity
        style={[style, isDisabled && { opacity: 0.6 }]}
        onPress={isDisabled ? undefined : onPress}
        onPressIn={onPressIn}
        onPressOut={onPressOut}
        activeOpacity={1}
      >
        {loading ? (
          <ActivityIndicator size="small" color={spinnerColor ?? '#111110'} />
        ) : (
          <Text style={textStyle}>{label}</Text>
        )}
      </TouchableOpacity>
    </Animated.View>
  );
}
