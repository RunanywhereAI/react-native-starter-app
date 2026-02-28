import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';

interface CircularScoreProps {
    /** Score value 0–100 */
    score: number;
    /** Outer diameter in dp (default 120) */
    size?: number;
    /** Stroke width of the donut ring (default 10) */
    strokeWidth?: number;
    /** Color of the progress arc */
    progressColor?: string;
    /** Color of the background track */
    trackColor?: string;
}

const CircularScore: React.FC<CircularScoreProps> = ({
    score,
    size = 120,
    strokeWidth = 10,
    progressColor = '#FFA726',
    trackColor = 'rgba(255,255,255,0.25)',
}) => {
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;
    const clampedScore = Math.min(100, Math.max(0, score));
    const strokeDashoffset = circumference * (1 - clampedScore / 100);

    // Responsive font sizing based on the donut size
    const fontSize = Math.round(size * 0.28);
    const percentFontSize = Math.round(fontSize * 0.55);
    const lineHeight = Math.round(fontSize * 1.1);

    return (
        <View style={[styles.wrapper, { width: size, height: size }]}>
            {/* SVG donut ring */}
            <Svg width={size} height={size}>
                {/* Background track */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={trackColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                />
                {/* Progress arc */}
                <Circle
                    cx={size / 2}
                    cy={size / 2}
                    r={radius}
                    stroke={progressColor}
                    strokeWidth={strokeWidth}
                    fill="none"
                    strokeLinecap="round"
                    strokeDasharray={circumference}
                    strokeDashoffset={strokeDashoffset}
                    rotation={-90}
                    origin={`${size / 2}, ${size / 2}`}
                />
            </Svg>

            {/* Overlay – perfectly centred text */}
            <View style={styles.overlay}>
                <Text
                    style={[
                        styles.scoreText,
                        { fontSize, lineHeight },
                    ]}
                >
                    {clampedScore}
                    <Text style={{ fontSize: percentFontSize, fontWeight: '600' }}>
                        %
                    </Text>
                </Text>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'relative',
    },
    overlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        alignItems: 'center',
        justifyContent: 'center',
    },
    scoreText: {
        fontWeight: '700',
        color: '#FFFFFF',
        textAlign: 'center',
        // Ensure no hidden padding pushes the text off-centre
        includeFontPadding: false,
        textAlignVertical: 'center',
    },
});

export { CircularScore };
export default CircularScore;
