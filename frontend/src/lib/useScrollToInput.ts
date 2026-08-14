import { useCallback, useRef } from "react";
import { findNodeHandle, NativeSyntheticEvent, Platform, ScrollView, TargetedEvent, UIManager } from "react-native";

/**
 * Keeps the focused TextInput visible above the keyboard by scrolling its
 * parent ScrollView to bring it into view on focus. RN's ScrollView doesn't
 * do this on its own — without it, fields lower in a form get hidden behind
 * the keyboard with no way to see what you're typing.
 */
export function useScrollToInput(offset = 24) {
  const scrollRef = useRef<ScrollView>(null);

  const handleFocus = useCallback((e: NativeSyntheticEvent<TargetedEvent>) => {
    const target = findNodeHandle(e.target as any);
    const scrollNode = findNodeHandle(scrollRef.current);
    if (!target || !scrollNode) return;
    // Small delay lets the keyboard-open layout pass settle first (Android in particular).
    setTimeout(() => {
      UIManager.measureLayout(
        target,
        scrollNode,
        () => {},
        (_x: number, y: number) => {
          scrollRef.current?.scrollTo({ y: Math.max(0, y - offset), animated: true });
        }
      );
    }, Platform.OS === "android" ? 100 : 0);
  }, [offset]);

  return { scrollRef, handleFocus };
}
