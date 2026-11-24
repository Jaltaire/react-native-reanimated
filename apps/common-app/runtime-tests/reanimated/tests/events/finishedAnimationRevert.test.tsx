import { StyleSheet, View } from 'react-native';
import Animated from 'react-native-reanimated';

import {
  describe,
  expect,
  getTestComponent,
  render,
  test,
  useTestRef,
  wait,
} from '../../../ReJest/RuntimeTestsApi';

const ANIMATED_REF = 'FinishedAnimationRevertAnimated';
const REFERENCE_REF = 'FinishedAnimationRevertReference';
const ANIMATION_MS = 300;
const FINISH_MS = 900;
const REVERT_MS = 400;

const HELD_ANIMATION = {
  animationName: {
    from: { opacity: 0.2, backgroundColor: '#ff0000' },
    to: { opacity: 1, backgroundColor: '#0000ff' },
  },
  animationDuration: `${ANIMATION_MS}ms`,
  animationFillMode: 'forwards',
} as const;

function RevertTest({ animated }: { animated: boolean }) {
  const animatedRef = useTestRef(ANIMATED_REF);
  const referenceRef = useTestRef(REFERENCE_REF);

  return (
    <View>
      <Animated.View
        ref={animatedRef}
        style={[styles.box, animated ? HELD_ANIMATION : null]}
      />
      <Animated.View ref={referenceRef} style={styles.box} />
    </View>
  );
}

async function mountedProps(ref: string) {
  const props = await getTestComponent(ref).getMountedViewProps();
  expect(props).not.toBe(null);
  return props!;
}

describe('removing a finished animation on a still screen', () => {
  test('restores the underlying style with nothing else running', async () => {
    await render(<RevertTest animated />);
    await wait(FINISH_MS);

    const held = await mountedProps(ANIMATED_REF);
    expect(held.opacity).toBe(1);

    await render(<RevertTest animated={false} />);
    await wait(REVERT_MS);

    const reverted = await mountedProps(ANIMATED_REF);
    const reference = await mountedProps(REFERENCE_REF);
    expect(reverted.opacity).toBe(reference.opacity);
    expect(reverted.backgroundColor).toBe(reference.backgroundColor);
  });
});

const styles = StyleSheet.create({
  box: {
    width: 80,
    height: 80,
    opacity: 0.5,
    backgroundColor: '#00ff00',
  },
});
