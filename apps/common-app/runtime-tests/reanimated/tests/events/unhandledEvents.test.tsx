import type { ComponentRef } from 'react';
import { useEffect } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import type { AnimatedRef, SharedValue } from 'react-native-reanimated';
import Animated, {
  useAnimatedRef,
  useAnimatedScrollHandler,
  useAnimatedStyle,
  useSharedValue,
} from 'react-native-reanimated';
import {
  registerEventHandler,
  unregisterEventHandler,
} from 'react-native-reanimated/src/core';
import { runOnUISync, scheduleOnUI } from 'react-native-worklets';

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  getTestComponent,
  render,
  test,
  useTestRef,
  wait,
} from '../../../ReJest/RuntimeTestsApi';

type CountGlobal = typeof globalThis & { __unhandledEventsCount?: number };

const ROW_COUNT = 30;
const ROW_HEIGHT = 80;
const SCROLL_ATTEMPTS = 5;
const SCROLL_STEP = 200;
const SETTLE_MS = 500;
const INITIAL_WIDTH = 40;
const UPDATED_WIDTH = 120;
const STYLED_VIEW = 'StyledView';

let plainScrollRef: { current: ComponentRef<typeof ScrollView> | null } = {
  current: null,
};
let handledScrollRef: AnimatedRef<Animated.ScrollView> | null = null;
let handledOffset: SharedValue<number> | null = null;
let width: SharedValue<number> | null = null;
let tagFreeRegistration: number | null = null;

function noop() {}

function resetCount() {
  runOnUISync(() => {
    'worklet';
    (globalThis as CountGlobal).__unhandledEventsCount = 0;
  });
}

function readCount() {
  return runOnUISync(() => {
    'worklet';
    return (globalThis as CountGlobal).__unhandledEventsCount ?? 0;
  });
}

async function scrollPlainViewUntil(isDone: () => boolean) {
  for (let attempt = 1; attempt <= SCROLL_ATTEMPTS; attempt++) {
    plainScrollRef.current?.scrollTo({
      y: attempt * SCROLL_STEP,
      animated: true,
    });
    await wait(SETTLE_MS);
    if (isDone()) {
      return;
    }
  }
}

describe('events that no handler waits for', () => {
  beforeEach(() => {
    plainScrollRef = { current: null };
    handledScrollRef = null;
    handledOffset = null;
    width = null;
    resetCount();
  });

  afterEach(() => {
    if (tagFreeRegistration !== null) {
      unregisterEventHandler(tagFreeRegistration);
      tagFreeRegistration = null;
    }
  });

  test('still reach a handler registered for their name on every view', async () => {
    tagFreeRegistration = registerEventHandler(() => {
      'worklet';
      const countGlobal = globalThis as CountGlobal;
      countGlobal.__unhandledEventsCount =
        (countGlobal.__unhandledEventsCount ?? 0) + 1;
    }, 'onScroll');
    await render(<PlainScene />);

    await scrollPlainViewUntil(() => readCount() > 0);

    expect(readCount() > 0).toBe(true);
  });

  test('leave the handler of another view to run for its own events', async () => {
    await render(<HandledScene />);

    await scrollPlainViewUntil(() => false);
    const offsetAfterPlainScroll = handledOffset!.value;
    handledScrollRef?.current?.scrollTo({ y: SCROLL_STEP, animated: false });
    await wait(SETTLE_MS);

    expect(offsetAfterPlainScroll).toBe(0);
    expect(handledOffset!.value).toBe(SCROLL_STEP);
  });

  test('leave a style update made outside any event to reach the view', async () => {
    await render(<StyledScene />);
    const styledView = getTestComponent(STYLED_VIEW);
    const updatedWidth = width!;

    plainScrollRef.current?.scrollTo({ y: SCROLL_STEP, animated: true });
    scheduleOnUI(() => {
      'worklet';
      updatedWidth.value = UPDATED_WIDTH;
    });
    await scrollPlainViewUntil(() => false);

    expect(await styledView.getAnimatedStyle('width')).toBe(UPDATED_WIDTH);
  });
});

function Rows() {
  return (
    <>
      {[...Array(ROW_COUNT).keys()].map((i) => (
        <View key={i} style={styles.row} />
      ))}
    </>
  );
}

function PlainScrollView() {
  return (
    <ScrollView
      ref={(ref) => {
        plainScrollRef.current = ref;
      }}
      onScroll={noop}
      scrollEventThrottle={16}
      style={styles.list}>
      <Rows />
    </ScrollView>
  );
}

function PlainScene() {
  return (
    <View style={styles.container}>
      <PlainScrollView />
    </View>
  );
}

function HandledScene() {
  const scrollRef = useAnimatedRef<Animated.ScrollView>();
  handledScrollRef = scrollRef;
  const offset = useSharedValue(0);
  handledOffset = offset;
  const onScroll = useAnimatedScrollHandler((event) => {
    offset.value = event.contentOffset.y;
  });

  return (
    <View style={styles.container}>
      <PlainScrollView />
      <Animated.ScrollView
        ref={scrollRef}
        onScroll={onScroll}
        scrollEventThrottle={16}
        style={styles.list}>
        <Rows />
      </Animated.ScrollView>
    </View>
  );
}

function StyledScene() {
  const styledRef = useTestRef(STYLED_VIEW);
  const sharedWidth = useSharedValue(INITIAL_WIDTH);
  useEffect(() => {
    width = sharedWidth;
  }, [sharedWidth]);
  const animatedStyle = useAnimatedStyle(() => ({ width: sharedWidth.value }));

  return (
    <View style={styles.container}>
      <PlainScrollView />
      <Animated.View ref={styledRef} style={[styles.box, animatedStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  list: {
    height: ROW_HEIGHT * 3,
  },
  row: {
    height: ROW_HEIGHT,
    backgroundColor: 'teal',
    marginBottom: 1,
  },
  box: {
    height: 40,
    backgroundColor: 'navy',
  },
});
