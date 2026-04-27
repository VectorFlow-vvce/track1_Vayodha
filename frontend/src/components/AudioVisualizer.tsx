import React, { useEffect, useRef } from 'react';

interface AudioVisualizerProps {
    isSpeaking: boolean;
    isListening: boolean;
}

export const AudioVisualizer: React.FC<AudioVisualizerProps> = ({ isSpeaking, isListening }) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;

        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let animationId: number;
        let time = 0;

        const draw = () => {
            const width = canvas.width;
            const height = canvas.height;
            const centerY = height / 2;

            ctx.clearRect(0, 0, width, height);

            // Configuration based on state
            let amplitude = 0;
            let frequency = 0;
            let color = '';
            let speed = 0;

            if (isSpeaking) {
                // AI Speaking: Active, high energy
                amplitude = 40;
                frequency = 0.02;
                color = '#a855f7'; // Purple (Lina's color)
                speed = 0.15;
            } else if (isListening) {
                // Listening: Gentle, waiting
                amplitude = 15;
                frequency = 0.01;
                color = '#22c55e'; // Green
                speed = 0.05;
            } else {
                // Idle
                amplitude = 2;
                frequency = 0.005;
                color = '#64748b'; // Gray
                speed = 0.02;
            }

            // Draw 3 waves with slight offsets
            for (let i = 0; i < 3; i++) {
                ctx.beginPath();
                ctx.lineWidth = 2;
                ctx.strokeStyle = color;
                ctx.globalAlpha = 1 - (i * 0.3); // Fade out outer waves

                for (let x = 0; x < width; x++) {
                    const y = centerY +
                        Math.sin(x * frequency + time + (i * 1.5)) * amplitude * Math.sin(time * speed + x * 0.01) +
                        Math.cos(x * 0.03 - time) * (amplitude * 0.5);

                    if (x === 0) ctx.moveTo(x, y);
                    else ctx.lineTo(x, y);
                }

                ctx.stroke();
            }

            time += speed;
            animationId = requestAnimationFrame(draw);
        };

        // Set canvas size (handling high DPI)
        const resize = () => {
            const rect = canvas.getBoundingClientRect();
            const dpr = window.devicePixelRatio || 1;
            canvas.width = rect.width * dpr;
            canvas.height = rect.height * dpr;
            ctx.scale(dpr, dpr);
        };

        resize();
        window.addEventListener('resize', resize);
        draw();

        return () => {
            window.removeEventListener('resize', resize);
            cancelAnimationFrame(animationId);
        };
    }, [isSpeaking, isListening]);

    return (
        <canvas
            ref={canvasRef}
            className="w-full h-32"
            style={{ width: '100%', height: '128px' }}
        />
    );
};
