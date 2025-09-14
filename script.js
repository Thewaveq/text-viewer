document.addEventListener('DOMContentLoaded', () => {
    // --- DOM Elements ---
    const playButton = document.getElementById('play-button');
    const recordButton = document.getElementById('record-button');
    const textInput = document.getElementById('text-input');
    const resolutionSelector = document.getElementById('resolution-selector');
    const alignSelector = document.getElementById('align-selector');
    const effectSelector = document.getElementById('effect-selector');
    const canvas = document.getElementById('screen-canvas');
    const ctx = canvas.getContext('2d');

    // --- State ---
    let isAnimating = false;
    let mediaRecorder;
    let recordedChunks = [];
    let animationFrameId;

    // --- Initial Setup ---
    function setCanvasDisplaySize() {
        const rect = canvas.getBoundingClientRect();
        canvas.width = rect.width;
        canvas.height = rect.height;
    }
    setCanvasDisplaySize();

    // --- Event Listeners ---
    playButton.addEventListener('click', () => handleAnimation(false));
    recordButton.addEventListener('click', () => handleAnimation(true));

    // --- Main Handler ---
    function handleAnimation(isRecording) {
        if (isAnimating) return;
        const text = textInput.value;
        if (!text) return;

        isAnimating = true;
        playButton.disabled = true;
        recordButton.disabled = true;

        const resolution = parseInt(resolutionSelector.value, 10);
        canvas.width = resolution;
        canvas.height = resolution;

        if (isRecording) {
            startRecording();
        }

        const paragraphs = text.split('\n\n').filter(p => p.trim() !== '');
        let currentParagraph = 0;

        function animateNextParagraph() {
            if (currentParagraph >= paragraphs.length) {
                setTimeout(stopAnimation, 500);
                return;
            }

            const paragraph = paragraphs[currentParagraph];
            currentParagraph++;

            const effect = effectSelector.value;
            switch (effect) {
                case 'fade':
                    animateFade(paragraph, animateNextParagraph);
                    break;
                case 'fly-in':
                    animateFlyIn(paragraph, animateNextParagraph);
                    break;
                case 'zoom':
                    animateZoom(paragraph, animateNextParagraph);
                    break;
                case 'typewriter':
                default:
                    animateTypewriter(paragraph, animateNextParagraph);
                    break;
            }
        }

        animateNextParagraph();
    }

    // --- Recording ---
    function startRecording() {
        const stream = canvas.captureStream(30);
        mediaRecorder = new MediaRecorder(stream, { mimeType: 'video/webm' });
        mediaRecorder.ondataavailable = e => e.data.size > 0 && recordedChunks.push(e.data);
        mediaRecorder.onstop = () => {
            const blob = new Blob(recordedChunks, { type: 'video/webm' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `text-animation-${canvas.width}p.webm`;
            a.click();
            window.URL.revokeObjectURL(url);
            recordedChunks = [];
            setCanvasDisplaySize();
        };
        mediaRecorder.start();
    }

    function stopAnimation() {
        isAnimating = false;
        playButton.disabled = false;
        recordButton.disabled = false;
        cancelAnimationFrame(animationFrameId);
        if (mediaRecorder && mediaRecorder.state === 'recording') {
            mediaRecorder.stop();
        } else {
            setCanvasDisplaySize();
        }
    }

    // --- Text Layout Engine ---
    function prepareText(text) {
        const font = getOptimalFontSize(text) + 'px monospace';
        ctx.font = font;
        const lines = getWrappedText(text, font);
        const lineHeight = parseFloat(font) * 1.2;
        const alignment = alignSelector.value;

        let words = [];
        const totalTextHeight = lines.length * lineHeight;
        const startY = (canvas.height - totalTextHeight) / 2 + (lineHeight / 2);

        lines.forEach((line, lineIndex) => {
            const y = startY + lineIndex * lineHeight;
            const lineWords = line.split(' ');

            let lineWordsWidth = lineWords.reduce((acc, word) => acc + ctx.measureText(word).width, 0);
            let spaceBetweenWords = ctx.measureText(' ').width; // Use space width as default

            if (alignment === 'justify' && lineIndex < lines.length - 1 && lineWords.length > 1) {
                const totalSpacing = canvas.width - 20 - lineWordsWidth;
                const spaceCount = lineWords.length - 1;
                const calculatedSpace = totalSpacing / spaceCount;
                const maxAllowedSpace = 4 * ctx.measureText(' ').width; // Max 4 spaces width

                if (calculatedSpace > 0 && calculatedSpace < maxAllowedSpace) {
                    spaceBetweenWords = calculatedSpace;
                }
            }

            let x;
            if (alignment === 'left' || alignment === 'justify') {
                x = 10;
            } else {
                const lineWidth = lineWordsWidth + spaceBetweenWords * (lineWords.length - 1);
                if (alignment === 'right') {
                    x = canvas.width - 10 - lineWidth;
                } else { // center
                    x = (canvas.width - lineWidth) / 2;
                }
            }

            lineWords.forEach(word => {
                words.push({ text: word, x: x, y: y, finalX: x, finalY: y });
                x += ctx.measureText(word).width + spaceBetweenWords;
            });
        });
        return words;
    }

    function getWrappedText(text, font) {
        const lines = [];
        const words = text.split(' ');
        if (!words.length) return [];
        let currentLine = words[0];
        ctx.font = font;
        for (let i = 1; i < words.length; i++) {
            const word = words[i];
            if (ctx.measureText(currentLine + " " + word).width < canvas.width - 20) {
                currentLine += " " + word;
            } else {
                lines.push(currentLine);
                currentLine = word;
            }
        }
        lines.push(currentLine);
        return lines;
    }

    function getOptimalFontSize(text) {
        let fontSize = 100;
        while (fontSize > 8) {
            const font = fontSize + 'px monospace';
            const lines = getWrappedText(text, font);
            const totalHeight = lines.length * (fontSize * 1.2);
            if (totalHeight < canvas.height - 20) return fontSize;
            fontSize--;
        }
        return 8;
    }

    // --- Animation Functions ---
    function clearCanvas() {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = '#000000';
    }

    function animateTypewriter(text, onComplete) {
        const words = prepareText(text); // Layout once
        const font = getOptimalFontSize(text) + 'px monospace';
        let wordIndex = 0;
        const interval = 120; // ms per word
        let lastTime = 0;

        function loop(currentTime) {
            if (!isAnimating) return;
            if (!lastTime) lastTime = currentTime;
            const deltaTime = currentTime - lastTime;

            if (deltaTime > interval) {
                lastTime = currentTime;
                wordIndex++;
                draw(wordIndex);
                if (wordIndex > words.length) {
                    setTimeout(onComplete, 500);
                    return;
                }
            }
            animationFrameId = requestAnimationFrame(loop);
        }

        function draw(numWords) {
            clearCanvas();
            ctx.font = font;
            for (let i = 0; i < numWords; i++) {
                if(words[i]) {
                    ctx.fillText(words[i].text, words[i].x, words[i].y);
                }
            }
        }

        draw(0);
        animationFrameId = requestAnimationFrame(loop);
    }

    function animateFade(text, onComplete) {
        const words = prepareText(text);
        let startTime = null;
        const duration = 100; //ms per word

        function loop(currentTime) {
            if (!isAnimating) return;
            if (!startTime) startTime = currentTime;
            const elapsedTime = currentTime - startTime;

            clearCanvas();
            ctx.font = getOptimalFontSize(text) + 'px monospace';

            words.forEach((word, index) => {
                const wordStartTime = index * duration;
                const wordElapsedTime = elapsedTime - wordStartTime;
                const alpha = Math.min(1, Math.max(0, wordElapsedTime / duration));
                ctx.globalAlpha = alpha;
                ctx.fillText(word.text, word.x, word.y);
            });

            ctx.globalAlpha = 1;
            if (elapsedTime > words.length * duration + 500) {
                setTimeout(onComplete, 500);
                return;
            }
            animationFrameId = requestAnimationFrame(loop);
        }
        animationFrameId = requestAnimationFrame(loop);
    }

    function animateFlyIn(text, onComplete) {
        const words = prepareText(text);
        let startTime = null;
        const duration = 400; //ms per word

        function easeOutCubic(t) { return 1 - Math.pow(1 - t, 3); }

        function loop(currentTime) {
            if (!isAnimating) return;
            if (!startTime) startTime = currentTime;
            const elapsedTime = currentTime - startTime;

            clearCanvas();
            ctx.font = getOptimalFontSize(text) + 'px monospace';

            words.forEach((word, index) => {
                const wordStartTime = index * 100; // Stagger start time
                const wordElapsedTime = elapsedTime - wordStartTime;
                const t = Math.min(1, Math.max(0, wordElapsedTime / duration));
                const easedT = easeOutCubic(t);

                const currentY = word.finalY + (canvas.height - word.finalY) * (1 - easedT);
                ctx.fillText(word.text, word.x, currentY);
            });

            if (elapsedTime > words.length * 100 + duration + 500) {
                setTimeout(onComplete, 500);
                return;
            }
            animationFrameId = requestAnimationFrame(loop);
        }
        animationFrameId = requestAnimationFrame(loop);
    }

    function animateZoom(text, onComplete) {
        const words = prepareText(text);
        let startTime = null;
        const duration = 300; //ms per word

        function easeOutBack(t) {
            const c1 = 1.70158;
            const c3 = c1 + 1;
            return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
        }

        function loop(currentTime) {
            if (!isAnimating) return;
            if (!startTime) startTime = currentTime;
            const elapsedTime = currentTime - startTime;

            clearCanvas();
            ctx.font = getOptimalFontSize(text) + 'px monospace';

            words.forEach((word, index) => {
                const wordStartTime = index * 100; // Stagger start time
                const wordElapsedTime = elapsedTime - wordStartTime;
                const t = Math.min(1, Math.max(0, wordElapsedTime / duration));
                const scale = easeOutBack(t);

                ctx.save();
                const wordWidth = ctx.measureText(word.text).width;
                const wordHeight = parseFloat(ctx.font);
                ctx.translate(word.x + wordWidth / 2, word.y + wordHeight / 2);
                ctx.scale(scale, scale);
                ctx.fillText(word.text, -wordWidth / 2, -wordHeight / 2);
                ctx.restore();
            });

            if (elapsedTime > words.length * 100 + duration + 500) {
                setTimeout(onComplete, 500);
                return;
            }
            animationFrameId = requestAnimationFrame(loop);
        }
        animationFrameId = requestAnimationFrame(loop);
    }
});
