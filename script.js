document.addEventListener('DOMContentLoaded', () => {
    const kkotipInput = document.getElementById('kkotipInput');
    const inputButtonContainer = document.getElementById('inputButtons');
    const mainInputButton = document.getElementById('mainInputButton'); // 이 변수가 이미 선언되어 있네!
    const refreshButton = document.getElementById('refreshButton');
    const debugOutput = document.getElementById('debugOutput');
    const rightHandRadio = document.getElementById('rightHand');
    const leftHandRadio = document.getElementById('leftHand');
    	
    function setButtonPosition() {
        if (rightHandRadio.checked) {
            inputButtonContainer.classList.remove('left-hand');
            inputButtonContainer.classList.add('right-hand');
            debugOutput.textContent = '버튼 위치: 오른손잡이';
        } else if (leftHandRadio.checked) {
            inputButtonContainer.classList.remove('right-hand');
            inputButtonContainer.classList.add('left-hand');
            debugOutput.textContent = '버튼 위치: 왼손잡이';
        }
    }

    setButtonPosition();
    rightHandRadio.addEventListener('change', setButtonPosition);
    leftHandRadio.addEventListener('change', setButtonPosition);

    let startX = 0;
    let startY = 0;
    let prevX = 0;
    let prevY = 0;
    let isDragging = false;
    let touchStartTime = 0;
    // isConsonantModeActive 변수는 이제 handleStart에서 초기화될 거야.
    let isConsonantModeActive = true; // // 이 부분은 handleStart에서 터치 위치에 따라 동적으로 설정되도록 변경할 예정이야.


    let firstDragAngle = null;
    let lastSegmentAngle = null;
    let inputSequence = [];

    // --- 한글 조합 관련 변수들 ---
    let currentCho = -1; // 현재 조합 중인 초성 인덱스
    let currentJung = -1; // 현재 조합 중인 중성 인덱스
    let currentJong = -1; // 현재 조합 중인 종성 인덱스
    const HANGUL_BASE_CODE = 0xAC00; // '가'의 유니코드 값
    const CHOSUNG_COUNT = 19;
    const JUNGSUNG_COUNT = 21;
    const JONGSUNG_COUNT = 28; // 종성 없음(1) 포함

    // 한글 초성, 중성, 종성 매핑 (순서 중요!)
    const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    const JUNGSUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
    const JONGSUNG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

    // 복합 중성 및 겹받침 조합 맵
    const COMPLEX_JUNGSUNG_MAP = {
        'ㅗㅏ': 'ㅘ', 'ㅗㅐ': 'ㅙ', 'ㅗㅣ': 'ㅚ',
        'ㅜㅓ': 'ㅝ', 'ㅜㅔ': 'ㅞ', 'ㅜㅣ': 'ㅟ',
        'ㅡㅣ': 'ㅢ',
    };
    const COMPLEX_JONGSUNG_MAP = {
        'ㄱㅅ': 'ㄳ', 'ㄴㅈ': 'ㄵ', 'ㄴㅎ': 'ㄶ',
        'ㄹㄱ': 'ㄺ', 'ㄹㅁ': 'ㄻ', 'ㄹㅂ': 'ㄼ', 'ㄹㅅ': 'ㄽ', 'ㄹㅌ': 'ㄾ', 'ㄹㅍ': 'ㄿ', 'ㄹㅎ': 'ㅀ',
        'ㅂㅅ': 'ㅄ',
    };

    // 초성, 중성, 종성의 인덱스를 가져오는 함수
    function getCharIndex(char, type) {
        if (type === 'cho') return CHOSUNG.indexOf(char);
        if (type === 'jung') return JUNGSUNG.indexOf(char);
        if (type === 'jong') return JONGSUNG.indexOf(char);
        return -1;
    }

    // 한글 조합 함수
    function combineHangul() {
        if (currentCho !== -1 && currentJung !== -1) {
            let combinedCode = HANGUL_BASE_CODE +
                               (currentCho * JUNGSUNG_COUNT * JONGSUNG_COUNT) +
                               (currentJung * JONGSUNG_COUNT) +
                               (currentJong !== -1 ? currentJong : 0);
            return String.fromCharCode(combinedCode);
        }
        return ''; // 초성, 중성 없이는 조합 불가
    }

    // 현재 조합 중인 글자 초기화
    function resetCombination() {
        currentCho = -1;
        currentJung = -1;
        currentJong = -1;
    }

    // 새로운 함수: 완성된 한글 글자를 초성, 중성, 종성으로 분해
    function disassembleHangul(hangulChar) {
        const charCode = hangulChar.charCodeAt(0);
        // 한글 음절 범위 확인
        if (charCode < HANGUL_BASE_CODE || charCode > HANGUL_BASE_CODE + CHOSUNG_COUNT * JUNGSUNG_COUNT * JONGSUNG_COUNT) {
            return null; // 유효한 한글 음절이 아님
        }

        const relativeCode = charCode - HANGUL_BASE_CODE;
        const jongIndex = relativeCode % JONGSUNG_COUNT;
        const jungIndex = Math.floor((relativeCode / JONGSUNG_COUNT) % JUNGSUNG_COUNT);
        const choIndex = Math.floor(relativeCode / (JUNGSUNG_COUNT * JONGSUNG_COUNT));

        return {
            cho: CHOSUNG[choIndex],
            jung: JUNGSUNG[jungIndex],
            jong: JONGSUNG[jongIndex],
            choIndex: choIndex,
            jungIndex: jungIndex,
            jongIndex: jongIndex
        };
    }

    // 새로운 함수: 겹받침을 두 개의 자음으로 분리 (예: ㄳ -> ㄱ, ㅅ)
    function splitComplexJongsung(complexJongChar) {
        for (const [key, value] of Object.entries(COMPLEX_JONGSUNG_MAP)) {
            if (value === complexJongChar) {
                return [key[0], key[1]];
            }
        }
        return null; // 겹받침이 아니거나 찾을 수 없음
    }

    const TAP_DURATION_THRESHOLD = 250;
    const DRAG_DISTANCE_THRESHOLD = 8;

    const COMMON_MIN_TURN_ANGLE = 15;
    const COMMON_MAX_TURN_ANGLE = 350;

    const VOWEL_SMALL_TURN_ANGLE_MAX = 135;
    const VOWEL_LARGE_TURN_ANGLE_MIN = 135;

    const ALL_8_DIRECTIONS_NAMES = [
        'right', 'up-right', 'up', 'up-left',
        'left', 'down-left', 'down', 'down-right'
    ];
    const TURN_DIRECTIONS_NAMES = ['left', 'right'];
    const VOWEL_LARGE_TURN_DIRECTIONS = ['left_large', 'right_large'];

    const DIRECTIONS = {
        'consonant': {
            'right': { angle: [337.5, 22.5], char: 'ㄷ' },
            'up-right': { angle: [292.5, 337.5], char: 'ㄴ' },
            'up': { angle: [247.5, 292.5], char: 'ㅅ' },
            'up-left': { angle: [202.5, 247.5], char: 'ㅁ' },
            'left': { angle: [157.5, 202.5], char: 'ㅇ' },
            'down-left': { angle: [112.5, 157.5], char: 'ㄱ' },
            'down': { angle: [67.5, 112.5], char: 'ㅂ' },
            'down-right': { angle: [22.5, 67.5], char: 'ㅈ' }
        },
        'vowel': {
            'right': { angle: [337.5, 22.5], char: 'ㅏ' },
            'up-right': { angle: [292.5, 337.5], char: 'ㅣ' },
            'up': { angle: [247.5, 292.5], char: 'ㅗ' },
            'up-left': { angle: [202.5, 247.5], char: 'ㅣ' },
            'left': { angle: [157.5, 202.5], char: 'ㅓ' },
            'down-left': { angle: [112.5, 157.5], char: 'ㅡ' },
            'down': { angle: [67.5, 112.5], char: 'ㅜ' },
            'down-right': { angle: [22.5, 67.5], char: 'ㅡ' }
        },
        'transitions_consonant': {
            'right_left': 'ㅌ', 'right_right': 'ㄸ',
            'up_left': 'ㅍ', 'up_right': 'ㅃ',
            'left_left': '.', 'left_right': 'ㅎ',
            'down_left': 'ㅆ', 'down_right': 'ㅊ',
            'up-right_left': 'ㄹ', 'up-right_right': 'ㄹ',
            'up-left_left': 'ㅁ', 'up-left_right': 'ㅁ',
            'down-left_left': 'ㅋ', 'down-left_right': 'ㄲ',
            'down-right_left': 'ㅉ', 'down-right_right': 'ㅉ',
        },
        'transitions_vowel': {
            'right_left': 'ㅐ',
	        'right_right': 'ㅒ',
            'up_left': 'ㅚ',
	        'up_right': 'ㅘ',
            'left_left': 'ㅖ',
	        'left_right': 'ㅔ',
            'down_left': 'ㅟ',
	        'down_right': 'ㅝ',
            'right_left_large': 'ㅑ',
            'right_right_large': 'ㅑ',
            'up_left_large': 'ㅛ',
            'up_right_large': 'ㅛ',
            'left_left_large': 'ㅕ',
            'left_right_large': 'ㅕ',
            'down_left_large': 'ㅠ',
            'down_right_large': 'ㅠ',
            'up-right_left_large': 'ㅢ',
            'up-right_right_large': 'ㅢ',
            'up-left_left_large': 'ㅢ',
            'up-left_right_large': 'ㅢ',
            'down-left_left_large': 'ㅢ',
            'down-left_right_large': 'ㅢ',
            'down-right_left_large': 'ㅢ',
            'down-right_right_large': 'ㅢ',
        },
        'multi_transitions_vowel': {
            'up_left_large_right': 'ㅙ',
            'up_left_large_left': 'ㅙ',
            'up_right_large_right': 'ㅙ',
            'up_right_large_left': 'ㅙ',
            'down_left_large_right': 'ㅞ',
            'down_left_large_left': 'ㅞ',
            'down_right_large_right': 'ㅞ',
            'down_right_large_left': 'ㅞ',
        }
    };

    function getDirectionStringFromAngle(angle) {
        let normalizedAngle = (angle + 360) % 360;
        if (normalizedAngle >= 337.5 || normalizedAngle < 22.5) return 'right';
        if (normalizedAngle >= 22.5 && normalizedAngle < 67.5) return 'down-right';
        if (normalizedAngle >= 67.5 && normalizedAngle < 112.5) return 'down';
        if (normalizedAngle >= 112.5 && normalizedAngle < 157.5) return 'down-left';
        if (normalizedAngle >= 157.5 && normalizedAngle < 202.5) return 'left';
        if (normalizedAngle >= 202.5 && normalizedAngle < 247.5) return 'up-left';
        if (normalizedAngle >= 247.5 && normalizedAngle < 292.5) return 'up';
        if (normalizedAngle >= 292.5 && normalizedAngle < 337.5) return 'up-right';
        return null;
    }

    function getCharFromAngle(angle, type) {
        let normalizedAngle = (angle + 360) % 360;
        const targetDirections = DIRECTIONS[type];
        if (!targetDirections) return null;

        for (const dirName in targetDirections) {
            if (targetDirections[dirName].angle) {
                const range = targetDirections[dirName].angle;
                if (range[0] > range[1]) {
                    if (normalizedAngle >= range[0] || normalizedAngle < range[1]) {
                        return targetDirections[dirName].char;
                    }
                } else {
                    if (normalizedAngle >= range[0] && normalizedAngle < range[1]) {
                        return targetDirections[dirName].char;
                    }
                }
            }
        }
        return null;
    }

    function getCharFromDoubleDrag(first8Dir, turnLRDir, type) {
        const key = `${first8Dir}_${turnLRDir}`;
        const targetTransitions = DIRECTIONS[`transitions_${type}`];
        if (!targetTransitions) return null;
        return targetTransitions[key] || null;
    }

    function getRelativeAngleDifference(angle1, angle2) {
        let diff = angle2 - angle1;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return diff;
    }

    let isGestureActive = false;

    function handleStart(e) {
        e.preventDefault();
        isGestureActive = true;
        isDragging = false;
        touchStartTime = Date.now();
        firstDragAngle = null;
        lastSegmentAngle = null;
        inputSequence = [];
		
		let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
			clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
			clientY = e.clientY;
        }
        startX = clientX; // 이제 startX, startY에 제대로 값이 들어갈 거야!
        startY = clientY; //
		prevX = startX;
        prevY = startY;
		
		// --- 오빠의 새 로직 적용 시작! ---
        const buttonRect = mainInputButton.getBoundingClientRect(); // 버튼의 위치와 크기 정보 가져오기
        const centerX = buttonRect.left + buttonRect.width / 2;
        const centerY = buttonRect.top + buttonRect.height / 2;
        
        // 원의 반지름 (style.css의 .center-circle width: 40% 기준으로 계산)
        // 나중에 모바일 미디어 쿼리까지 고려하면 더 정확한 계산이 필요하지만, 일단 PC 기준 40%로
        // CSS에서 원 크기를 %로 설정했으니, 버튼 크기에 따라 상대적으로 계산해야 해.
        // 현재 CSS에서 .center-circle의 width/height가 40% (PC) 또는 50% (모바일)로 설정되어 있어.
        // 여기서는 가장 큰 값인 50%를 기준으로 안전하게 0.25 (반지름 = 지름/2, 지름 = 버튼의 50%이므로 버튼 폭의 25%)로 잡을게.
        // 정확히는 CSS를 파싱해서 가져와야 하지만, 일단 하드코딩으로 가정.
        const circleRadiusRatio = 0.25; // 버튼 너비/높이의 25%가 원의 반지름 (지름 50%의 절반)
        const circleRadius = Math.min(buttonRect.width, buttonRect.height) * circleRadiusRatio;

        const distanceToCenter = Math.sqrt(
            Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2)
        );

        // 원 내부에서 시작했는지 판단
        const isInsideCircle = distanceToCenter <= circleRadius;
        
        // isConsonantModeActive 값 설정
        isConsonantModeActive = !isInsideCircle; // 원 밖에서 시작하면 자음 모드, 원 안에서 시작하면 모음 모드

        // 시각적 피드백을 위한 클래스 추가/제거
        if (isConsonantModeActive) {
            mainInputButton.classList.add('consonant-mode');
            mainInputButton.classList.remove('vowel-mode');
        } else {
            mainInputButton.classList.add('vowel-mode');
            mainInputButton.classList.remove('consonant-mode');
        }
		
        debugOutput.textContent = `제스처 시작 (모드: ${isConsonantModeActive ? '자음' : '모음'}): (${startX.toFixed(0)}, ${startY.toFixed(0)})`;
    }

    function handleMove(e) {
        if (!isGestureActive) return;

        let currentX, currentY;
        if (e.touches && e.touches.length > 0) {
            currentX = e.touches[0].clientX;
            currentY = e.touches[0].clientY;
        } else {
            currentX = e.clientX;
            currentY = e.clientY;
        }

        const deltaX_start = currentX - startX;
        const deltaY_start = currentY - startY;
        const distFromStart = Math.sqrt(deltaX_start * deltaX_start + deltaY_start * deltaY_start);

        if (!isDragging) {
            if (distFromStart < DRAG_DISTANCE_THRESHOLD) {
                debugOutput.textContent = `드래그 대기중... 거리: ${distFromStart.toFixed(0)}`;
                return;
            }
            isDragging = true;

            firstDragAngle = Math.atan2(deltaY_start, deltaX_start) * (180 / Math.PI);
            if (firstDragAngle < 0) firstDragAngle += 360;
            inputSequence.push(getDirectionStringFromAngle(firstDragAngle));
            lastSegmentAngle = firstDragAngle;

            debugOutput.textContent = `드래그 시작! 첫 방향: ${inputSequence[0]} (각도: ${firstDragAngle.toFixed(1)}°)`;
        }

        const deltaX_prev = currentX - prevX;
        const deltaY_prev = currentY - prevY;
        const distFromPrev = Math.sqrt(deltaX_prev * deltaX_prev + deltaY_prev * deltaY_prev);

        if (distFromPrev > DRAG_DISTANCE_THRESHOLD / 2) {
            let currentSegmentAngle = Math.atan2(deltaY_prev, deltaX_prev) * (180 / Math.PI);
            if (currentSegmentAngle < 0) currentSegmentAngle += 360;

            if (lastSegmentAngle !== null) {
                const relativeAngleDiff = getRelativeAngleDifference(lastSegmentAngle, currentSegmentAngle);
                const absAngleDiff = Math.abs(relativeAngleDiff);

                if (absAngleDiff >= COMMON_MIN_TURN_ANGLE && absAngleDiff <= COMMON_MAX_TURN_ANGLE) {
                    let turnDirectionName = null;

                    if (relativeAngleDiff > 0) {
                        if (absAngleDiff <= VOWEL_SMALL_TURN_ANGLE_MAX) {
                            turnDirectionName = 'right';
                        } else {
                            turnDirectionName = 'right_large';
                        }
                    } else {
                        if (absAngleDiff <= VOWEL_SMALL_TURN_ANGLE_MAX) {
                            turnDirectionName = 'left';
                        } else {
                            turnDirectionName = 'left_large';
                        }
                    }

                    if (inputSequence.length === 1 && turnDirectionName) {
                        inputSequence.push(turnDirectionName);
                        debugOutput.textContent = `방향 전환 감지 (1차): ${inputSequence[0]} -> ${inputSequence[1]} (꺾임: ${relativeAngleDiff.toFixed(1)}°)`;
                    }
                    else if (inputSequence.length === 2 && turnDirectionName) {
                        const lastTurnInSequence = inputSequence[inputSequence.length - 1];
                        if (lastTurnInSequence !== turnDirectionName) {
                            inputSequence.push(turnDirectionName);
                            debugOutput.textContent = `방향 전환 감지 (2차): ${inputSequence[0]} -> ${inputSequence[1]} -> ${inputSequence[2]} (꺾임: ${relativeAngleDiff.toFixed(1)}°)`;
                        }
                    }
                }
            }
            lastSegmentAngle = currentSegmentAngle;
        }

        prevX = currentX;
        prevY = currentY;
    }

    function handleEnd(e) {
        if (!isGestureActive) return;

        let endX, endY;
        if (e.changedTouches && e.changedTouches.length > 0) {
            endX = e.changedTouches[0].clientX;
            endY = e.changedTouches[0].clientY;
        } else {
            endX = e.clientX;
            endY = e.clientY;
        }

        const deltaX = endX - startX;
        const deltaY = endY - startY;
        const totalDragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
        const duration = Date.now() - touchStartTime;
		
		// --- 탭으로 인한 모드 전환 로직은 위 handleStart로 이동했으니,
        // 이곳에서는 유효한 드래그가 아닐 경우만 처리하면 돼.
        if (!isDragging || totalDragDistance < DRAG_DISTANCE_THRESHOLD) { // 드래그 시작 조건 불충족 시 (짧은 터치 등)
             debugOutput.textContent = `유효한 제스처 아님. (드래그 거리 부족)`;
             resetGestureState();
             return;
        }		
		
        let char = null;
        let finalInputType = isConsonantModeActive ? 'consonant' : 'vowel'; // 현재 모드에 따라 입력 타입 결정

        // --- 1. '탭' 감지 (모음 모드 전환) ---
        //if (!isDragging && totalDragDistance < DRAG_DISTANCE_THRESHOLD && duration < TAP_DURATION_THRESHOLD) {
        //    isConsonantModeActive = false; // 탭하면 무조건 모음 모드로 전환
        //    debugOutput.textContent = `버튼 탭 감지! 모드: 모음으로 전환! (다음 드래그는 모음 입력)`;
        //    resetGestureState();
        //    return;
        //}
		
		// 드래그로 글자가 입력 완료되면, 다음 제스처를 위해 버튼 클래스 초기화
        mainInputButton.classList.remove('consonant-mode', 'vowel-mode');		
		
        // --- 2. '드래그' (글자 입력) 감지 ---
        if (isDragging || totalDragDistance >= DRAG_DISTANCE_THRESHOLD) {
            let finalOverallAngle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);
            if (finalOverallAngle < 0) finalOverallAngle += 360;

            // Step 1: 제스처로부터 'char' 값 가져오기 (폴백 로직 포함!)
            if (inputSequence.length === 1) { // 단일 방향 드래그
                char = getCharFromAngle(finalOverallAngle, finalInputType);
            } else if (inputSequence.length >= 2) { // 1차 꺾임 이상
                const first8Dir = inputSequence[0];
                const turnLRDir = inputSequence.length > 1 ? inputSequence[1] : null; // Get first turn
                const secondTurn = inputSequence.length > 2 ? inputSequence[2] : null; // Get second turn

                if (finalInputType === 'consonant') {
                    char = getCharFromDoubleDrag(first8Dir, turnLRDir, finalInputType);
                    // 콘솔 모드에서 두 방향 제스처가 특정 겹치기 자음이 아닐 경우, 첫 방향의 단일 자음으로 폴백
                    if (!char && first8Dir) {
                        const firstDirInfo = DIRECTIONS['consonant'][first8Dir];
                        if (firstDirInfo) char = firstDirInfo.char;
                    }
                } else { // Vowel mode
                    if (inputSequence.length === 2) { // 1차 꺾임
                        char = getCharFromDoubleDrag(first8Dir, turnLRDir, finalInputType);
                    } else if (inputSequence.length >= 3) { // 2차 이상 꺾임 (복합 모음)
                        const key = `${first8Dir}_${turnLRDir}_${secondTurn}`;
                        char = DIRECTIONS.multi_transitions_vowel[key] || null;
                    }
                }
            }

            if (char) {
                let currentText = kkotipInput.value;

                // --- 한글 조합 로직 시작 (오빠의 원칙 반영!) ---

                // Case: 입력된 char가 자음일 때 (consonant mode)
                if (finalInputType === 'consonant') {
                    const choIndex = getCharIndex(char, 'cho');
                    const jongIndex = getCharIndex(char, 'jong'); // 종성으로도 쓰일 수 있는 자음인지 확인

                    // 1. 초성+중성 상태에서 종성 추가 (예: 가 -> 간, 라 -> 랑, 뿌 -> 뿐)
                    if (currentCho !== -1 && currentJung !== -1) {
                        if (currentJong === -1) { // 기존 종성 없음: 새 자음을 종성으로 추가
                            if (jongIndex !== -1) { // 입력된 자음이 종성으로 쓰일 수 있다면
                                currentJong = jongIndex;
                                kkotipInput.value = currentText.slice(0, -1) + combineHangul();
                            } else { // 입력된 자음이 종성으로 쓰일 수 없음 (e.g., ㅉ, ㄸ, ㅃ 등) -> 새로운 글자의 초성
                                // 기존 글자 확정하고 새 글자 시작
                                let combinedChar = combineHangul();
                                if(combinedChar) kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                                resetCombination();
                                currentCho = choIndex; // 새 자음은 다음 글자의 초성
                                kkotipInput.value += char;
                            }
                        } else { // 기존 종성 있음: 겹받침 시도 또는 종성 분리 후 새 글자 시작
                            const prevJongChar = JONGSUNG[currentJong];
                            const newComplexJong = COMPLEX_JONGSUNG_MAP[prevJongChar + char];
                            if (newComplexJong) { // 겹받침 성공 (예: 값 + ㅅ -> 값, 만 + ㅎ -> 많)
                                currentJong = getCharIndex(newComplexJong, 'jong');
                                kkotipInput.value = currentText.slice(0, -1) + combineHangul();
                            } else { // 겹받침 실패 (예: 간 + ㄷ -> 간ㄷ) -> 기존 글자 확정, 새 글자 시작
                                let combinedChar = combineHangul();
                                if(combinedChar) kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                                resetCombination();
                                currentCho = choIndex; // 새 자음은 다음 글자의 초성
                                kkotipInput.value += char;
                            }
                        }
                    } else { // 초성이나 중성이 없는 상태에서 자음 입력 -> 새로운 글자의 초성
                        // 이전에 조합 중인 글자가 있다면 확정 (초성만 있는 상태에서 새 초성 입력 시)
                        if (currentCho !== -1 || currentJung !== -1 || currentJong !== -1) {
                            let combinedChar = combineHangul();
                            if (combinedChar) kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                        }
                        resetCombination();
                        currentCho = choIndex; // 새 자음은 새로운 글자의 초성
                        kkotipInput.value += char;
                    }
                } else { // Case: 입력된 char가 모음일 때 (vowel mode)
                    const jungIndex = getCharIndex(char, 'jung'); // 새로 들어온 모음

                    let lastCharInInput = currentText.slice(-1);
                    let disassembledLastChar = disassembleHangul(lastCharInInput); // 마지막 글자 분해 시도

                    // 오빠의 1, 2번 규칙 적용: 종성(단일/겹받침)이 있는 완성형 글자 뒤에 모음이 오면 종성을 다음 초성으로 이동
                    if (disassembledLastChar && disassembledLastChar.jongIndex !== 0) { // 마지막 글자가 완성형이고 종성이 있다면
                        let prevChoChar = disassembledLastChar.cho;
                        let prevJungChar = disassembledLastChar.jung;
                        let prevJongChar = disassembledLastChar.jong; // 이동할 종성

                        let movedChoChar = null; // 다음 글자로 옮겨갈 초성
                        let newJongIndexForPrevChar = 0; // 이전 글자의 새로운 종성 (없음)

                        // 겹받침인 경우 (규칙 2)
                        const splitJong = splitComplexJongsung(prevJongChar);
                        if (splitJong) { // 겹받침이라면
                            newJongIndexForPrevChar = getCharIndex(splitJong[0], 'jong'); // 첫 번째 자음만 남김
                            movedChoChar = splitJong[1]; // 두 번째 자음이 다음 글자의 초성으로
                        } else { // 단일 받침인 경우 (규칙 1)
                            movedChoChar = prevJongChar; // 단일 받침 전체가 다음 글자의 초성으로
                            newJongIndexForPrevChar = 0; // 이전 글자는 받침이 없어짐
                        }

                        // 1. 이전 글자 업데이트 (종성 제거 또는 변경)
                        currentCho = getCharIndex(prevChoChar, 'cho');
                        currentJung = getCharIndex(prevJungChar, 'jung');
                        currentJong = newJongIndexForPrevChar; // 업데이트된 종성

                        let reCombinedPrevChar = combineHangul();
                        if (reCombinedPrevChar) {
                            kkotipInput.value = currentText.slice(0, -1) + reCombinedPrevChar;
                        } else {
                            // 예상치 못한 상황 (초/중이 없으면 combineHangul이 빈 문자열 반환)
                            // 이 경우는 발생하지 않아야 함 (이미 완성된 글자를 분해했으니)
                            // 안전장치: 그냥 새 글자 시작으로 처리
                            resetCombination();
                            currentJung = jungIndex;
                            currentCho = getCharIndex('ㅇ', 'cho');
                            kkotipInput.value += char;
                            debugOutput.textContent += " (오류: 이전 글자 재조합 실패)";
                        }

                        // 2. 새 글자 시작 (이동된 자음이 초성, 입력된 모음이 중성)
                        resetCombination(); // 새 글자 조합을 위해 초기화
                        currentCho = getCharIndex(movedChoChar, 'cho'); // 이동된 자음이 새 초성
                        currentJung = jungIndex; // 입력된 모음이 새 중성
                        
                        // 새로운 글자를 바로 입력 (예: '나' or '하')
                        if (currentCho !== -1 && currentJung !== -1) {
                            kkotipInput.value += combineHangul();
                        } else {
                            // 이 경우도 발생하지 않아야 하지만, 안전장치
                            kkotipInput.value += char;
                        }

                    } else { // 마지막 글자가 완성형 한글이 아니거나 종성이 없는 경우 (기존 모음 처리 로직 유지)
                        if (currentCho !== -1) { // 초성이 있는 상태에서 중성 추가
                            if (currentJung === -1) { // 초성만 있고 중성 처음 입력 (예: ㄱ + ㅏ -> 가)
                                currentJung = jungIndex;
                                kkotipInput.value = currentText.slice(0, -1) + combineHangul();
                            } else { // 초+중 상태에서 새 중성 (복합 중성 시도 또는 중성 교체)
                                const prevJungChar = JUNGSUNG[currentJung];
                                const newComplexJung = COMPLEX_JUNGSUNG_MAP[prevJungChar + char];
                                if (newComplexJung) { // 복합 중성 성공 (예: ㅗ + ㅏ -> ㅘ)
                                    currentJung = getCharIndex(newComplexJung, 'jung');
                                    kkotipInput.value = currentText.slice(0, -1) + combineHangul();
                                } else { // 복합 중성 실패 -> 기존 글자 확정, 새 글자 시작 (암묵적 ㅇ 초성)
                                    let combinedChar = combineHangul();
                                    if(combinedChar) kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                                    resetCombination();
                                    currentJung = jungIndex;
                                    currentCho = getCharIndex('ㅇ', 'cho'); // 모음으로 새 글자 시작 시 암묵적으로 'ㅇ' 초성 추가
                                    kkotipInput.value += char;
                                }
                            }
                        } else { // 초성이 없는 상태에서 모음 입력 -> 암묵적 'ㅇ' 초성으로 새 글자 시작
                            // 이전에 조합 중인 글자가 있다면 확정 (완성된 글자 뒤에 모음만 입력 시)
                            if (currentCho !== -1 || currentJung !== -1 || currentJong !== -1) {
                                let combinedChar = combineHangul();
                                if (combinedChar) kkotipInput.value = currentText.slice(0, -1) + combinedChar;
                            }
                            resetCombination();
                            currentJung = jungIndex;
                            currentCho = getCharIndex('ㅇ', 'cho'); // 암묵적으로 'ㅇ' 초성 추가
                            kkotipInput.value += char;
                        }
                    }
                }

                debugOutput.textContent = `입력 완료 (${finalInputType}): ${char} -> 현재 글자: ${kkotipInput.value.slice(-1)} (총 거리: ${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequence.join(' -> ')})`;
            } else {
                debugOutput.textContent = `입력 실패 (${finalInputType}): 총 거리=${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequence.join(' -> ')}`;
            }
        } else {
            debugOutput.textContent = `유효한 제스처 아님. (드래그도 탭도 아닌 짧은 터치)`;
        }

        // 드래그로 글자가 입력 완료되면 무조건 '자음 입력 모드'로 전환 (Default)
        isConsonantModeActive = true;
        resetGestureState(); // 모든 제스처 완료 후 상태 초기화
    }

    // --- 제스처 상태 초기화 함수 ---
    function resetGestureState() {
        isGestureActive = false;
        isDragging = false;
        startX = 0;
        startY = 0;
        prevX = 0;
        prevY = 0;
        firstDragAngle = null;
        lastSegmentAngle = null;
        inputSequence = [];
        touchStartTime = 0;
		
		// 제스처가 끝나면 버튼의 시각적 상태도 초기화
        mainInputButton.classList.remove('consonant-mode', 'vowel-mode');
    }


    // --- 이벤트 리스너 등록 ---
    mainInputButton.addEventListener('touchstart', handleStart, { passive: false });
    mainInputButton.addEventListener('mousedown', handleStart);

    inputButtonContainer.addEventListener('touchmove', handleMove, { passive: false });
    inputButtonContainer.addEventListener('mousemove', handleMove);
    inputButtonContainer.addEventListener('touchend', handleEnd);
    inputButtonContainer.addEventListener('mouseup', handleEnd);
    inputButtonContainer.addEventListener('touchcancel', handleEnd);
    inputButtonContainer.addEventListener('mouseleave', (e) => {
        if (isGestureActive) {
            handleEnd(e);
        }
    });

    refreshButton.addEventListener('click', () => {
        window.location.reload();
    });
});