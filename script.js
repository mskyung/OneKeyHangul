document.addEventListener('DOMContentLoaded', () => {
    const kkotipInput = document.getElementById('kkotipInput');
    const inputButtonContainer = document.getElementById('inputButtons');
    const mainInputButton = document.getElementById('mainInputButton');
    const refreshButton = document.getElementById('refreshButton');
    const deleteButton = document.getElementById('deleteButton');
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
    let isGestureActive = false;
    let isDragging = false;
    let touchStartTime = 0;
    let isConsonantModeActive = true; // true: 자음(사각형 바깥), false: 모음(중앙 원형)

    let firstDragAngle = null;
    let lastSegmentAngle = null;
    let inputSequence = []; // 드래그 방향 시퀀스 저장 (예: ['left', 'up'] for ㅓ->ㅔ)
    let initialRecognizedDirection = null; // 제스처 시작 시 첫 8방위 방향

    // --- 더블 탭 관련 변수 ---
    let lastTapTime = 0;
    let lastTapDirection = null;
    let lastTapStartX = 0;
    let lastTapStartY = 0;

    // --- 두 손가락 제스처 관련 변수 (커서 이동용) ---
    let initialTwoFingerDistance = 0;
    let isTwoFingerGesture = false;
    let twoFingerMoveTimer = null;
    const TWO_FINGER_MOVE_INTERVAL = 100;
    const TWO_FINGER_VERTICAL_MOVE_SENSITIVITY = 15;

    // --- 한글 조합 및 타이머 관련 변수 ---
    let currentCho = -1;
    let currentJung = -1;
    let currentJong = -1;
    let inputTimeoutId = null;
    const INPUT_TIMEOUT_MS = 700; 

    const HANGUL_BASE_CODE = 0xAC00;
    const CHOSUNG_COUNT = 19;
    const JUNGSUNG_COUNT = 21;
    const JONGSUNG_COUNT = 28;

    const CHOSUNG = ['ㄱ', 'ㄲ', 'ㄴ', 'ㄷ', 'ㄸ', 'ㄹ', 'ㅁ', 'ㅂ', 'ㅃ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅉ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];
    const JUNGSUNG = ['ㅏ', 'ㅐ', 'ㅑ', 'ㅒ', 'ㅓ', 'ㅔ', 'ㅕ', 'ㅖ', 'ㅗ', 'ㅘ', 'ㅙ', 'ㅚ', 'ㅛ', 'ㅜ', 'ㅝ', 'ㅞ', 'ㅟ', 'ㅠ', 'ㅡ', 'ㅢ', 'ㅣ'];
    const JONGSUNG = ['', 'ㄱ', 'ㄲ', 'ㄳ', 'ㄴ', 'ㄵ', 'ㄶ', 'ㄷ', 'ㄹ', 'ㄺ', 'ㄻ', 'ㄼ', 'ㄽ', 'ㄾ', 'ㄿ', 'ㅀ', 'ㅁ', 'ㅂ', 'ㅄ', 'ㅅ', 'ㅆ', 'ㅇ', 'ㅈ', 'ㅊ', 'ㅋ', 'ㅌ', 'ㅍ', 'ㅎ'];

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

    function getCharIndex(char, type) {
        if (type === 'cho') return CHOSUNG.indexOf(char);
        if (type === 'jung') return JUNGSUNG.indexOf(char);
        if (type === 'jong') return JONGSUNG.indexOf(char);
        return -1;
    }

    function combineHangul() {
        if (currentCho !== -1) {
            if (currentJung !== -1) {
                let combinedCode = HANGUL_BASE_CODE +
                                   (currentCho * JUNGSUNG_COUNT * JONGSUNG_COUNT) +
                                   (currentJung * JONGSUNG_COUNT) +
                                   (currentJong !== -1 ? currentJong : 0);
                return String.fromCharCode(combinedCode);
            } else {
                return CHOSUNG[currentCho];
            }
        }
        return '';
    }

    function resetCombination() {
        currentCho = -1;
        currentJung = -1;
        currentJong = -1;
    }

    function disassembleHangul(hangulChar) {
        const charCode = hangulChar.charCodeAt(0);
        if (charCode >= HANGUL_BASE_CODE && charCode <= HANGUL_BASE_CODE + CHOSUNG_COUNT * JUNGSUNG_COUNT * JONGSUNG_COUNT -1) {
            const relativeCode = charCode - HANGUL_BASE_CODE;
            const jongIndex = relativeCode % JONGSUNG_COUNT;
            const jungIndex = Math.floor((relativeCode / JONGSUNG_COUNT) % JUNGSUNG_COUNT);
            const choIndex = Math.floor(relativeCode / (JUNGSUNG_COUNT * JUNGSUNG_COUNT));

            return {
                cho: CHOSUNG[choIndex],
                jung: JUNGSUNG[jungIndex],
                jong: JONGSUNG[jongIndex],
                choIndex: choIndex,
                jungIndex: jungIndex,
                jongIndex: jongIndex,
                isHangul: true
            };
        }
        let choIndex = CHOSUNG.indexOf(hangulChar);
        let jungIndex = JUNGSUNG.indexOf(hangulChar);
        let jongIndex = JONGSUNG.indexOf(hangulChar); 

        if (choIndex !== -1) return { cho: hangulChar, jung: '', jong: '', choIndex: choIndex, jungIndex: -1, jongIndex: -1, isHangul: false };
        if (jungIndex !== -1) return { cho: '', jung: hangulChar, jong: '', choIndex: -1, jungIndex: jungIndex, jongIndex: -1, isHangul: false };
        if (jongIndex !== -1 && jongIndex !== 0) return { cho: '', jung: hangulChar, jong: '', choIndex: -1, jungIndex: -1, jongIndex: jongIndex, isHangul: false }; 
        
        return null; 
    }

    function splitComplexJongsung(complexJongChar) {
        for (const [key, value] of Object.entries(COMPLEX_JONGSUNG_MAP)) {
            if (value === complexJongChar) {
                return [key[0], key[1]];
            }
        }
        return null;
    }

    const TAP_DURATION_THRESHOLD = 250;
    const DOUBLE_TAP_DISTANCE_THRESHOLD = 15;
    const DRAG_DISTANCE_THRESHOLD = 8; 
    const TWO_FINGER_DRAG_THRESHOLD = 15; 

    const CONSONANT_TURN_ANGLE_MIN = 25; 
    const VOWEL_TURN_ANGLE_MIN = 30; 
    const VOWEL_TURN_ANGLE_MAX = 180; 

    const DIRECTIONS = { 
        'consonant': { 
            'right': { angle: [337.5, 22.5], char: 'ㅇ', doubleTapChar: 'ㅎ', dragChar: 'ㅎ' },
            'up-right': { angle: [292.5, 337.5], char: 'ㄱ', doubleTapChar: 'ㄲ', dragChar: 'ㅋ' },
            'up': { angle: [247.5, 292.5], char: 'ㅅ', doubleTapChar: 'ㅆ', dragChar: 'ㅊ' },
            'up-left': { angle: [202.5, 247.5], char: 'ㅈ', doubleTapChar: 'ㅉ', dragChar: 'ㅊ' },
            'left': { angle: [157.5, 202.5], char: 'ㄷ', doubleTapChar: 'ㄸ', dragChar: 'ㅌ' },
            'down-left': { angle: [112.5, 157.5], char: 'ㄴ', doubleTapChar: 'ㄹ', dragChar: 'ㄹ' },
            'down': { angle: [67.5, 112.5], char: 'ㅂ', doubleTapChar: 'ㅃ', dragChar: 'ㅍ' },
            'down-right': { angle: [22.5, 67.5], char: 'ㅁ', doubleTapChar: 'ㅁ', dragChar: 'ㅁ' }
        },
        'vowel': { // 단일 방향 드래그 모음 (중앙 원형) - 'ㅡ', 'ㅣ'는 getPrimaryVowelChar에서 별도 처리
            'right': { angle: [337.5, 22.5], char: 'ㅏ' },
            'left': { angle: [157.5, 202.5], char: 'ㅓ' },
            'up': { angle: [247.5, 292.5], char: 'ㅗ' },
            'down': { angle: [67.5, 112.5], char: 'ㅜ' },
            // 대각선 방향에 대한 기본 모음은 getPrimaryVowelChar에서 직접 처리.
            // 여기에 명시적으로 포함시키면 getPrimaryVowelChar와 충돌 가능성 있음.
        },
        'complex_vowel_transitions': { // 2단계 복합 모음
            'right_left': 'ㅑ',     
            'left_right': 'ㅕ',     
            'up_down': 'ㅛ',        
            'down_up': 'ㅠ',        
            
            'left_up': 'ㅔ',        
            'left_up-right': 'ㅔ',      

            'right_up': 'ㅐ',       
            'right_up-left': 'ㅐ',      

            'left_down': 'ㅖ',      
            'left_down-right': 'ㅖ',    

            'right_down': 'ㅒ',     
            'right_down-left': 'ㅒ',    
            
            'up_left': 'ㅚ',        
            'up_down-left': 'ㅚ',       

            'up_right': 'ㅘ',       
            'up_down-right': 'ㅘ',      

            'down_right': 'ㅟ',     
            'down_up-right': 'ㅟ',      

            'down_left': 'ㅝ',      
            'down_up-left': 'ㅝ',       

            // 'ㅢ'는 손잡이 모드에 따라 다른 초기 방향을 가짐 (getPrimaryVowelChar에서 이미 처리되고 있음)
            // 여기서는 매핑만 유지하고, getPrimaryVowelChar에서 우선적으로 단일 모음 'ㅡ','ㅣ'가 인식된 후
            // 2단계 조합으로 'ㅢ'가 인식되도록 로직을 정교화할 필요가 있음.
            // 현재는 handleEnd에서 complex_vowel_transitions를 찾고, 못 찾으면 'ㅢ' 특수처리하는 방식.
            'down-left_up-right': 'ㅢ', 
            'down-right_up-left': 'ㅢ'  
        },
        'multi_complex_vowel_transitions': { // 3단계 복합 모음 (ㅙ, ㅞ)
            // key: `${1단계_시작_방향}_${2단계_꺾이는_방향_8방위}_${3단계_꺾이는_방향_8방위}`
            // ㅙ: up -> right -> down
            'up_right_down': 'ㅙ', 
            // ㅙ 추가 패턴: up -> down-right (ㅘ) 에서 다시 down-left (아래 왼쪽으로 꺾임)
            'up_down-right_down-left': 'ㅙ', // ㅗ -> ㅘ 에서 (down-right) -> down-left (3번째 꺾임)

            // ㅞ: down -> left -> up
            'down_left_up': 'ㅞ',  
            // ㅞ 추가 패턴: down -> up-left (ㅝ) 에서 다시 up-right (위 오른쪽으로 꺾임)
            'down_up-left_up-right': 'ㅞ'  // ㅜ -> ㅝ 에서 (up-left) -> up-right (3번째 꺾임)
        }
    };

    // 주 방향의 각도를 가져오는 헬퍼 함수 (0도를 기준으로 상대 각도 계산용)
    function getCardinalAngle(direction) {
        switch (direction) {
            case 'right': return 0;
            case 'up-right': return 315; 
            case 'up': return 270; 
            case 'up-left': return 225; 
            case 'left': return 180;
            case 'down-left': return 135;
            case 'down': return 90;
            case 'down-right': return 45;
            default: return -1;
        }
    }

    // 상대적인 꺾임 각도 계산 함수 (첫 드래그 방향을 0도로 기준)
    function getRelativeTurnAngle(initialAngle, currentAngle) {
        let diff = currentAngle - initialAngle;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return diff;
    }

    // ⭐ 오른손/왼손잡이 모드에 따른 'ㅡ'와 'ㅣ' 모음 결정 함수 강화 ⭐
    function getPrimaryVowelChar(initialDir) {
        // 'ㅏ', 'ㅓ', 'ㅗ', 'ㅜ' (4가지 주 방향)
        const cardinalVowel = DIRECTIONS.vowel[initialDir]?.char;
        if (cardinalVowel) return cardinalVowel;

        // 'ㅡ', 'ㅣ'는 손잡이 모드와 대각선 방향으로 결정
        // 오른손잡이: down-left는 'ㅡ', up-right는 'ㅣ'
        if (rightHandRadio.checked) {
            if (initialDir === 'down-left') return 'ㅡ';
            if (initialDir === 'up-right') return 'ㅣ';
        }
        // 왼손잡이: down-right는 'ㅡ', up-left는 'ㅣ'
        else if (leftHandRadio.checked) {
            if (initialDir === 'down-right') return 'ㅡ';
            if (initialDir === 'up-left') return 'ㅣ';
        }
        
        return null; // 해당하는 모음이 없을 경우
    }


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
    
    function getRelativeAngleDifference(angle1, angle2) {
        let diff = angle2 - angle1;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return diff;
    }

    function moveCursorHorizontal(moveAmount) {
        const currentPos = kkotipInput.selectionStart;
        const newPos = Math.max(0, Math.min(kkotipInput.value.length, currentPos + moveAmount));
        kkotipInput.selectionStart = newPos;
        kkotipInput.selectionEnd = newPos;
    }

    function moveCursorVertical(direction) {
        const currentCursorPos = kkotipInput.selectionStart;
        const text = kkotipInput.value;
        const lines = text.split('\n');
        let currentLine = 0;
        let charsCount = 0;

        for(let i=0; i<lines.length; i++) {
            charsCount += lines[i].length + 1; 
            if (currentCursorPos <= charsCount) {
                currentLine = i;
                break;
            }
        }

        if (direction === 'up' && currentLine > 0) {
            const currentLineStartPos = (currentLine === 0) ? 0 : text.substring(0, charsCount - lines[currentLine].length -1).length + 1;
            const currentLineOffset = currentCursorPos - currentLineStartPos;
            
            const prevLineLength = lines[currentLine - 1].length;
            let newPosInPrevLine = Math.min(prevLineLength, currentLineOffset);
            
            let newCursorPos = 0;
            for (let i = 0; i < currentLine - 1; i++) {
                newCursorPos += lines[i].length + 1;
            }
            newCursorPos += newPosInPrevLine;

            kkotipInput.selectionStart = newCursorPos;
            kkotipInput.selectionEnd = newPos; 
            debugOutput.textContent = `커서 이동: 위로`;
        } else if (direction === 'down' && currentLine < lines.length - 1) {
            const currentLineStartPos = (currentLine === 0) ? 0 : text.substring(0, charsCount - lines[currentLine].length -1).length + 1;
            const currentLineOffset = currentCursorPos - currentLineStartPos;

            const nextLineLength = lines[currentLine + 1].length;
            let newPosInNextLine = Math.min(nextLineLength, currentLineOffset);

            let newCursorPos = 0;
            for (let i = 0; i < currentLine + 1; i++) {
                newCursorPos += lines[i].length + 1;
            }
            newCursorPos += newPosInNextLine;

            kkotipInput.selectionStart = newPos;
            kkotipInput.selectionEnd = newPos;
            debugOutput.textContent = `커서 이동: 아래로`;
        }
    }

    // --- 한글 조합 및 입력 처리 통합 함수 ---
    function processAndDisplayInput(char, finalInputType, totalDragDistance, inputSequenceDebug) {
        let currentText = kkotipInput.value;
        let cursorPosition = kkotipInput.selectionStart;

        // 커서가 맨 뒤가 아니면, 한글 조합 로직 대신 단순히 글자 삽입
        if (cursorPosition < currentText.length) {
            if (!/^[가-힣ㄱ-ㅎㅏ-ㅣ]$/.test(char)) { 
                kkotipInput.value = currentText.substring(0, cursorPosition) + char + currentText.substring(cursorPosition);
                kkotipInput.selectionStart = cursorPosition + char.length;
                kkotipInput.selectionEnd = cursorPosition + char.length;
                resetCombination(); 
                clearTimeout(inputTimeoutId); 
                inputTimeoutId = null;
                debugOutput.textContent = `일반 문자 (삽입): ${char}`;
                return;
            }
        }

        // 새로운 입력이 들어왔으므로 기존 타이머 클리어
        if (inputTimeoutId) {
            clearTimeout(inputTimeoutId);
            inputTimeoutId = null;
        }

        // 스페이스바는 조합 로직과 별개로 처리
        if (char === ' ') { 
            kkotipInput.value += ' ';
            kkotipInput.selectionStart = kkotipInput.value.length;
            kkotipInput.selectionEnd = kkotipInput.value.length;
            resetCombination();
            debugOutput.textContent = `스페이스 입력`;
            return; 
        }

        let tempCharToUpdate = ''; 
        let lastChar = currentText.slice(-1);
        let lastCharDisassembled = disassembleHangul(lastChar);

        // 현재 조합 중이던 글자가 있다면 확정 (새로운 초성/모음이 들어왔을 때)
        if (currentCho !== -1 && currentJung === -1 && finalInputType === 'consonant') { 
            if (currentText.slice(-1) === CHOSUNG[currentCho]) { 
                tempCharToUpdate = combineHangul(); 
                kkotipInput.value = currentText.slice(0, cursorPosition - 1) + tempCharToUpdate; 
                cursorPosition = kkotipInput.value.length; 
                resetCombination(); 
            }
        } 
        else if (currentCho !== -1 && currentJung !== -1 && currentJong === -1 && finalInputType === 'vowel') { 
             if (lastCharDisassembled && lastCharDisassembled.isHangul && lastCharDisassembled.choIndex === currentCho && lastCharDisassembled.jungIndex === currentJung) {
                 tempCharToUpdate = combineHangul(); 
                 kkotipInput.value = currentText.slice(0, cursorPosition - 1) + tempCharToUpdate; 
                 cursorPosition = kkotipInput.value.length; 
                 resetCombination(); 
             }
        }
        
        // --- 핵심 한글 조합 로직 시작 ---
        if (finalInputType === 'consonant') { // 자음이 입력되었을 때
            const choIndex = getCharIndex(char, 'cho');
            const jongIndex = getCharIndex(char, 'jong'); 
            
            if (!/^[ㄱ-ㅎ]$/.test(char)) { 
                tempCharToUpdate = char;
                resetCombination(); 
            } 
            else if (currentCho !== -1 && currentJung !== -1) {
                if (currentJong !== -1) { 
                    const potentialComplexJong = JONGSUNG[currentJong] + char; 
                    const newComplexJong = COMPLEX_JONGSUNG_MAP[potentialComplexJong];
                    
                    if (newComplexJong) { 
                        currentJong = getCharIndex(newComplexJong, 'jong');
                        tempCharToUpdate = combineHangul();
                        kkotipInput.value = currentText.slice(0, cursorPosition - 1) + tempCharToUpdate; 
                    } else { 
                        tempCharToUpdate = combineHangul(); 
                        kkotipInput.value = currentText.slice(0, cursorPosition - 1) + tempCharToUpdate;
                        cursorPosition = kkotipInput.value.length; 
                        resetCombination(); 
                        currentCho = choIndex; 
                        tempCharToUpdate = char; 
                    }
                } else { 
                    currentJong = jongIndex;
                    tempCharToUpdate = combineHangul();
                    kkotipInput.value = currentText.slice(0, cursorPosition - 1) + tempCharToUpdate;
                }
            } 
            else if (currentCho !== -1) { 
                if (char === CHOSUNG[currentCho] && ['ㄱ','ㄷ','ㅂ','ㅅ','ㅈ'].includes(char)) { 
                    if (char === 'ㄱ') currentCho = getCharIndex('ㄲ', 'cho');
                    else if (char === 'ㄷ') currentCho = getCharIndex('ㄸ', 'cho');
                    else if (char === 'ㅂ') currentCho = getCharIndex('ㅃ', 'cho');
                    else if (char === 'ㅅ') currentCho = getCharIndex('ㅆ', 'cho');
                    else if (char === 'ㅈ') currentCho = getCharIndex('ㅉ', 'cho');
                    tempCharToUpdate = CHOSUNG[currentCho]; 
                    kkotipInput.value = currentText.slice(0, cursorPosition - 1) + tempCharToUpdate; 
                } else { 
                    tempCharToUpdate = CHOSUNG[currentCho]; 
                    kkotipInput.value = currentText.slice(0, cursorPosition - 1) + tempCharToUpdate;
                    cursorPosition = kkotipInput.value.length; 
                    resetCombination(); 
                    currentCho = choIndex; 
                    tempCharToUpdate = char; 
                }
            } 
            else { 
                if (lastCharDisassembled && lastCharDisassembled.isHangul && lastCharDisassembled.jongIndex === 0) {
                    currentCho = lastCharDisassembled.choIndex;
                    currentJung = lastCharDisassembled.jungIndex;
                    currentJong = jongIndex; 
                    tempCharToUpdate = combineHangul(); 

                    if (tempCharToUpdate) { 
                        kkotipInput.value = currentText.slice(0, cursorPosition - 1) + tempCharToUpdate; 
                    } else { 
                        resetCombination();
                        currentCho = choIndex;
                        tempCharToUpdate = char;
                    }
                } else { 
                    resetCombination();
                    currentCho = choIndex;
                    tempCharToUpdate = char;
                }
            }
        } else { // Vowel (모음)이 입력되었을 때
            const jungIndex = getCharIndex(char, 'jung');

            if (currentCho !== -1) { // 현재 초성이 있는 경우
                if (currentJung === -1) { // 중성이 아직이라면 현재 모음을 중성으로
                    currentJung = jungIndex;
                    tempCharToUpdate = combineHangul();
                    kkotipInput.value = currentText.slice(0, cursorPosition - 1) + tempCharToUpdate; 
                } else { // 중성까지 있는 상태라면 복합 모음 시도
                    const prevJungChar = JUNGSUNG[currentJung];
                    const potentialComplexJung = prevJungChar + char;
                    const newComplexJung = COMPLEX_JUNGSUNG_MAP[potentialComplexJung];

                    if (newComplexJung) { 
                        currentJung = getCharIndex(newComplexJung, 'jung');
                        tempCharToUpdate = combineHangul();
                        kkotipInput.value = currentText.slice(0, cursorPosition - 1) + tempCharToUpdate;
                    } else { 
                        tempCharToUpdate = combineHangul(); 
                        kkotipInput.value = currentText.slice(0, cursorPosition - 1) + tempCharToUpdate; 
                        cursorPosition = kkotipInput.value.length; 
                        resetCombination(); 
                        currentCho = getCharIndex('ㅇ', 'cho'); 
                        currentJung = jungIndex;
                        tempCharToUpdate = combineHangul(); 
                    }
                }
            } else { 
                if (lastCharDisassembled && lastCharDisassembled.isHangul && lastCharDisassembled.jongIndex > 0) { 
                    let movedJongChar = JONGSUNG[lastCharDisassembled.jongIndex];
                    
                    currentCho = lastCharDisassembled.choIndex;
                    currentJung = lastCharDisassembled.jungIndex;
                    currentJong = 0; 
                    let reCombinedPrevChar = combineHangul();
                    if (reCombinedPrevChar) {
                        kkotipInput.value = currentText.substring(0, cursorPosition - 1) + reCombinedPrevChar;
                    }

                    resetCombination(); 
                    currentCho = getCharIndex(movedJongChar, 'cho'); 
                    currentJung = jungIndex; 
                    tempCharToUpdate = combineHangul(); 

                } 
                else { 
                    resetCombination();
                    currentCho = getCharIndex('ㅇ', 'cho');
                    currentJung = jungIndex;
                    tempCharToUpdate = combineHangul(); 
                }
            }
        }
        
        // 최종적으로 입력 필드에 업데이트
        if (tempCharToUpdate) {
            const inputLastChar = kkotipInput.value.slice(-1);
            const inputLastCharDisassembled = disassembleHangul(inputLastChar);
            
            if (inputLastCharDisassembled && inputLastCharDisassembled.choIndex === currentCho && 
                (inputLastCharDisassembled.jungIndex === currentJung || currentJung === -1) && 
                (inputLastCharDisassembled.jongIndex === currentJong || currentJong === -1)) {
                kkotipInput.value = kkotipInput.value.slice(0, -1) + tempCharToUpdate;
            } else if (currentCho !== -1 && currentJung === -1 && inputLastChar === CHOSUNG[currentCho]) { 
                kkotipInput.value = currentText.slice(0, -1) + tempCharToUpdate;
            }
            else if (cursorPosition === kkotipInput.value.length) { 
                kkotipInput.value += tempCharToUpdate;
            }
        }

        kkotipInput.selectionStart = kkotipInput.value.length;
        kkotipInput.selectionEnd = kkotipInput.value.length;

        debugOutput.textContent = `입력 완료 (${finalInputType}): ${char} -> 현재 글자: ${kkotipInput.value.slice(-1)} (총 거리: ${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequenceDebug})`;
        
        if (/^[가-힣ㄱ-ㅎㅏ-ㅣ]$/.test(char) && (currentCho !== -1 || currentJung !== -1 || currentJong !== -1)) { 
            inputTimeoutId = setTimeout(() => {
                if (currentCho !== -1 && currentJung !== -1) {
                    const combinedChar = combineHangul();
                    if (combinedChar && kkotipInput.value.length > 0) {
                        const lastChar = kkotipInput.value.slice(-1);
                        const lastCharDisassembledForTimer = disassembleHangul(lastChar);

                        if (lastCharDisassembledForTimer && 
                            lastCharDisassembledForTimer.choIndex === currentCho && 
                            lastCharDisassembledForTimer.jungIndex === currentJung &&
                            lastCharDisassembledForTimer.jongIndex === currentJong) {
                        } else { 
                            const currentLastChar = kkotipInput.value.slice(-1);
                            let shouldReplace = false;
                            
                            if (currentCho !== -1 && currentJung !== -1 && combinedChar) { 
                                if (disassembleHangul(currentLastChar)?.choIndex === currentCho && 
                                    (disassembleHangul(currentLastChar)?.jungIndex === -1 || disassembleHangul(currentLastChar)?.jungIndex === currentJung)) {
                                    shouldReplace = true;
                                }
                            } else if (currentCho !== -1 && currentJung === -1) { 
                                if (getCharIndex(currentLastChar, 'cho') === currentCho) {
                                    shouldReplace = true;
                                }
                            }

                            if (shouldReplace) {
                                kkotipInput.value = kkotipInput.value.slice(0, -1) + combinedChar;
                            }
                        }
                    }
                } else if (currentCho !== -1 && currentJung === -1 && kkotipInput.value.length > 0) {
                    if (getCharIndex(kkotipInput.value.slice(-1), 'cho') === currentCho) {
                    } else {
                        kkotipInput.value = kkotipInput.value.slice(0, -1) + CHOSUNG[currentCho];
                    }
                }
                resetCombination(); 
                debugOutput.textContent += " (조합 타이머 만료: 글자 확정)";
                kkotipInput.selectionStart = kkotipInput.value.length;
                kkotipInput.selectionEnd = kkotipInput.value.length;
            }, INPUT_TIMEOUT_MS);
        } else {
            clearTimeout(inputTimeoutId);
            inputTimeoutId = null;
            resetCombination();
        }
    }

    function handleStart(e) {
        e.preventDefault(); 
        if (e.touches && e.touches.length === 2) {
            isTwoFingerGesture = true;
            isGestureActive = true;
            initialTwoFingerDistance = Math.sqrt(
                Math.pow(e.touches[0].clientX - e.touches[1].clientX, 2) +
                Math.pow(e.touches[0].clientY - e.touches[1].clientY, 2)
            );
            startX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
            startY = (e.touches[0].clientY + e.touches[1].clientY) / 2;
            prevX = startX;
            prevY = startY;
            debugOutput.textContent = `두 손가락 제스처 시작.`;
            return; 
        }

        isTwoFingerGesture = false; 
        isGestureActive = true;
        isDragging = false;
        touchStartTime = Date.now();
        firstDragAngle = null;
        lastSegmentAngle = null;
        inputSequence = [];
        initialRecognizedDirection = null;

        let clientX, clientY;
        if (e.touches && e.touches.length > 0) {
            clientX = e.touches[0].clientX;
            clientY = e.touches[0].clientY;
        } else {
            clientX = e.clientX;
            clientY = e.clientY;
        }
        startX = clientX;
        startY = clientY;
        prevX = startX;
        prevY = startY;

        const buttonRect = mainInputButton.getBoundingClientRect();
        const centerX = buttonRect.left + buttonRect.width / 2;
        const centerY = buttonRect.top + buttonRect.height / 2;

        const circleRadiusRatio = 0.25; 
        const circleRadius = Math.min(buttonRect.width, buttonRect.height) * circleRadiusRatio;

        const distanceToCenter = Math.sqrt(
            Math.pow(clientX - centerX, 2) + Math.pow(clientY - centerY, 2)
        );

        isConsonantModeActive = !(distanceToCenter <= circleRadius);

        debugOutput.textContent = `제스처 시작 (모드: ${isConsonantModeActive ? '자음' : '모음'} - ${isConsonantModeActive ? '사각형 바깥' : '중앙 원형'} 시작): (${startX.toFixed(0)}, ${startY.toFixed(0)})`;
    }

    function handleMove(e) {
        if (!isGestureActive) return;

        if (isTwoFingerGesture) { 
            if (e.touches && e.touches.length === 2) {
                const currentX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                const deltaX = currentX - prevX;
                const deltaY = currentY - prevY;

                if (!twoFingerMoveTimer) {
                    twoFingerMoveTimer = setTimeout(() => {
                        const absDeltaX = Math.abs(currentX - startX);
                        const absDeltaY = Math.abs(currentY - startY);

                        if (absDeltaX > TWO_FINGER_DRAG_THRESHOLD && absDeltaX > absDeltaY) {
                            const moveAmount = Math.round((currentX - startX) / 20);
                            moveCursorHorizontal(moveAmount);
                            debugOutput.textContent = `커서 이동: 좌우 (${moveAmount})`;
                            startX = currentX; 
                            startY = currentY;
                        } else if (absDeltaY > TWO_FINGER_DRAG_THRESHOLD && absDeltaY > absDeltaX && absDeltaY > TWO_FINGER_VERTICAL_MOVE_SENSITIVITY) {
                            if (deltaY < 0) {
                                moveCursorVertical('up');
                            } else {
                                moveCursorVertical('down');
                            }
                            startX = currentX; 
                            startY = currentY;
                        }
                        twoFingerMoveTimer = null;
                    }, TWO_FINGER_MOVE_INTERVAL);
                }
                
                prevX = currentX;
                prevY = currentY;
            }
            return;
        }

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
            if (distFromStart >= DRAG_DISTANCE_THRESHOLD) {   
                isDragging = true;
                
                firstDragAngle = Math.atan2(deltaY_start, deltaX_start) * (180 / Math.PI);
                if (firstDragAngle < 0) firstDragAngle += 360;

                initialRecognizedDirection = getDirectionStringFromAngle(firstDragAngle);
                inputSequence.push(initialRecognizedDirection);
                lastSegmentAngle = firstDragAngle;
                
                debugOutput.textContent = `드래그 시작! 첫 방향: ${inputSequence[0]} (각도: ${firstDragAngle.toFixed(1)}°)`;
            } else {
                debugOutput.textContent = `드래그 대기중... 거리: ${distFromStart.toFixed(0)}`;
                return; 
            }
        }
        
        // ⭐ 모음 복합조합 감지 로직 (모음 모드) 강화 ⭐
        if (!isConsonantModeActive && isDragging) {
            const deltaX_current = currentX - prevX;
            const deltaY_current = currentY - prevY;
            const distFromPrev = Math.sqrt(deltaX_current * deltaX_current + deltaY_current * deltaY_current);

            if (distFromPrev > DRAG_DISTANCE_THRESHOLD / 2 && firstDragAngle !== null) { 
                let currentSegmentAngle = Math.atan2(deltaY_current, deltaX_current) * (180 / Math.PI);
                if (currentSegmentAngle < 0) currentSegmentAngle += 360;

                const current8Dir = getDirectionStringFromAngle(currentSegmentAngle);

                // 가장 최근에 기록된 방향(inputSequence의 마지막)과 현재 방향이 다를 때만 새로운 꺾임으로 간주
                if (inputSequence[inputSequence.length - 1] !== current8Dir) {
                    const lastRecordedDirection = inputSequence[inputSequence.length - 1];
                    const angleForTurnComparison = (inputSequence.length === 1) ? firstDragAngle : getCardinalAngle(lastRecordedDirection); 
                    
                    const relativeTurnAngle = getRelativeTurnAngle(angleForTurnComparison, currentSegmentAngle);

                    if (Math.abs(relativeTurnAngle) >= VOWEL_TURN_ANGLE_MIN) {
                        if (inputSequence.length === 1 && Math.abs(relativeTurnAngle) <= VOWEL_TURN_ANGLE_MAX) { // 2단계 꺾임 (30~180도)
                            inputSequence.push(current8Dir);
                            debugOutput.textContent = `모음 복합 드래그 감지 (2단계): ${initialRecognizedDirection} -> ${current8Dir} (상대각도: ${relativeTurnAngle.toFixed(1)}°)`;
                        } else if (inputSequence.length === 2) { // 3단계 꺾임 (2단계 후 또 꺾임)
                            inputSequence.push(current8Dir);
                            debugOutput.textContent = `모음 3단계 복합 드래그 감지: ${inputSequence[0]} -> ${inputSequence[1]} -> ${inputSequence[2]} (상대각도: ${relativeTurnAngle.toFixed(1)}°)`;
                        }
                    }
                }
                lastSegmentAngle = currentSegmentAngle;
            }
        }
        // 자음 모드에서만 복합 자음 드래그 방향 전환 감지 (기존 로직 유지)
        else if (isConsonantModeActive && isDragging) {
            const deltaX_prev = currentX - prevX;
            const deltaY_prev = currentY - prevY;
            const distFromPrev = Math.sqrt(deltaX_prev * deltaX_prev + deltaY_prev * deltaY_prev);

            if (distFromPrev > DRAG_DISTANCE_THRESHOLD / 2) {
                let currentSegmentAngle = Math.atan2(deltaY_prev, deltaX_prev) * (180 / Math.PI);
                if (currentSegmentAngle < 0) currentSegmentAngle += 360;

                const angleFromInitialDirection = getRelativeAngleDifference(firstDragAngle, currentSegmentAngle); 
                const absAngleFromInitialDirection = Math.abs(angleFromInitialDirection);

                if (absAngleFromInitialDirection >= CONSONANT_TURN_ANGLE_MIN) { 
                    const newDirection = getDirectionStringFromAngle(currentSegmentAngle);
                    if (inputSequence.length === 1) { 
                        inputSequence.push(newDirection);
                        debugOutput.textContent = `자음 드래그 방향 전환 감지 (1차): ${inputSequence[0]} -> ${inputSequence[1]} (꺾임: ${absAngleFromInitialDirection.toFixed(1)}°)`;
                    } else if (inputSequence.length > 1 && inputSequence[inputSequence.length - 1] !== newDirection) {
                        inputSequence.push(newDirection);
                        debugOutput.textContent = `연속 방향 전환: ${inputSequence.join(' -> ')}`;
                    }
                }
                lastSegmentAngle = currentSegmentAngle;
            }
        }

        prevX = currentX;
        prevY = currentY;
    }

    function handleEnd(e) {
        if (!isGestureActive) return;

        if (isTwoFingerGesture) { 
            clearTimeout(twoFingerMoveTimer);
            twoFingerMoveTimer = null;
            debugOutput.textContent = `두 손가락 제스처 종료.`;
            resetGestureState();
            return;
        }

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
        
        let char = null;
        let finalInputType = isConsonantModeActive ? 'consonant' : 'vowel';

        if (finalInputType === 'consonant') { // 자음 모드 (사각형 바깥)
            if (totalDragDistance < DRAG_DISTANCE_THRESHOLD) { // 탭
                handleTap(e, totalDragDistance, duration); 
            } else { // 드래그
                char = DIRECTIONS.consonant[initialRecognizedDirection]?.dragChar; 
                if (char) {
                    processAndDisplayInput(char, finalInputType, totalDragDistance, inputSequence.join(' -> '));
                } else {
                    debugOutput.textContent = `입력 실패 (자음 드래그): 총 거리=${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequence.join(' -> ')}`;
                }
            }
        } else { // 모음 모드 (중앙 원형)
            if (totalDragDistance < DRAG_DISTANCE_THRESHOLD) { // 탭 (스페이스)
                handleTap(e, totalDragDistance, duration);
            } else { // 드래그 (직선 모음, 복합 모음, 3단계 복합 모음)
                // ⭐ 모음 패턴 인식 로직 강화 (가장 긴 패턴부터 검사) ⭐
                if (inputSequence.length === 3) { // 3단계 복합 모음 (ㅙ, ㅞ)
                    const firstDir = inputSequence[0];
                    const secondDir = inputSequence[1]; 
                    const thirdDir = inputSequence[2]; 
                    
                    const key = `${firstDir}_${secondDir}_${thirdDir}`; 
                    char = DIRECTIONS.multi_complex_vowel_transitions[key];
                    debugOutput.textContent += ` (3단계 패턴 시도: ${key})`; 
                    
                    if (!char) { // 3단계 패턴 매칭 실패 시 2단계 패턴으로 다시 시도
                        const key2 = `${firstDir}_${secondDir}`;
                        char = DIRECTIONS.complex_vowel_transitions[key2];
                        debugOutput.textContent += ` (3단계 실패, 2단계 패턴 시도: ${key2})`;
                    }
                } else if (inputSequence.length === 2) { // 2단계 복합 모음
                    const firstDir = inputSequence[0];
                    const secondDir = inputSequence[1];
                    const key = `${firstDir}_${secondDir}`;
                    char = DIRECTIONS.complex_vowel_transitions[key];
                    debugOutput.textContent += ` (2단계 패턴 시도: ${key})`; 
                    
                    // 'ㅢ' 모음의 손잡이 구분 (2단계 패턴 매칭 실패 시만 시도)
                    if (!char) { // complex_vowel_transitions에서 'ㅢ' 매칭 못했을 때만 추가 확인
                         // 오른손잡이용 'ㅢ': down-left -> up-right
                         if (rightHandRadio.checked && firstDir === 'down-left' && secondDir === 'up-right') {
                            char = 'ㅢ';
                            debugOutput.textContent += ` (오른손잡이 'ㅢ' 특수 인식)`;
                         } 
                         // 왼손잡이용 'ㅢ': down-right -> up-left
                         else if (leftHandRadio.checked && firstDir === 'down-right' && secondDir === 'up-left') {
                            char = 'ㅢ';
                            debugOutput.textContent += ` (왼손잡이 'ㅢ' 특수 인식)`;
                         }
                    }

                } else if (inputSequence.length === 1) {
                    // 1단계 직선 드래그 모음 (ㅏ, ㅓ, ㅗ, ㅜ, ㅡ, ㅣ)
                    char = getPrimaryVowelChar(initialRecognizedDirection);
                    debugOutput.textContent += ` (1단계 패턴 시도: ${initialRecognizedDirection})`;

                } else {
                    debugOutput.textContent = `패턴 없음: 시퀀스 길이 ${inputSequence.length}`;
                }

                if (char) {
                    processAndDisplayInput(char, finalInputType, totalDragDistance, inputSequence.join(' -> '));
                } else {
                    debugOutput.textContent = `입력 실패 (모음 드래그): 총 거리=${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequence.join(' -> ')}`;
                }
            }
        }

        isConsonantModeActive = true; 
        resetGestureState();
    }
    
    function handleTap(e, totalDragDistance, duration) {
        const buttonRect = mainInputButton.getBoundingClientRect();
        const centerX = buttonRect.left + buttonRect.width / 2;
        const centerY = buttonRect.top + buttonRect.height / 2;

        const tapAngle = Math.atan2(startY - centerY, startX - centerX) * (180 / Math.PI);
        const tapDirection = getDirectionStringFromAngle(tapAngle);

        let charToInput = null;
        const currentTime = Date.now();

        if (!isConsonantModeActive) { 
            processAndDisplayInput(' ', 'vowel', totalDragDistance, 'tap-space'); 
            lastTapTime = 0; 
            lastTapDirection = null;
            lastTapStartX = 0;
            lastTapStartY = 0;
            return; 
        } 
        else { 
            if (lastTapDirection === tapDirection && 
                (currentTime - lastTapTime < TAP_DURATION_THRESHOLD) &&
                (Math.abs(startX - lastTapStartX) < DOUBLE_TAP_DISTANCE_THRESHOLD) &&
                (Math.abs(startY - lastTapStartY) < DOUBLE_TAP_DISTANCE_THRESHOLD)
            ) { // 더블 탭
                charToInput = DIRECTIONS.consonant[tapDirection]?.doubleTapChar || '';
                debugOutput.textContent = `자음 버튼 더블 탭: ${charToInput} 입력! (방향: ${tapDirection})`;
                
                let currentText = kkotipInput.value;
                if (currentText.length > 0 && currentText.slice(-1) === DIRECTIONS.consonant[tapDirection]?.char) {
                    kkotipInput.value = currentText.slice(0, -1); 
                }
                processAndDisplayInput(charToInput, 'consonant', totalDragDistance, `double-tap-${tapDirection}`);

                lastTapTime = 0; 
                lastTapDirection = null;
                lastTapStartX = 0;
                lastTapStartY = 0;
            } else { // 싱글 탭
                charToInput = DIRECTIONS.consonant[tapDirection]?.char || '';
                debugOutput.textContent = `자음 버튼 싱글 탭: ${charToInput} 입력! (방향: ${tapDirection})`;

                processAndDisplayInput(charToInput, 'consonant', totalDragDistance, `single-tap-${tapDirection}`);

                lastTapTime = currentTime; 
                lastTapDirection = tapDirection;
                lastTapStartX = startX;
                lastTapStartY = startY;
            }
        }
    }
    
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
        initialRecognizedDirection = null; 
        
        lastTapTime = 0;
        lastTapDirection = null;
        lastTapStartX = 0;
        lastTapStartY = 0;
        isTwoFingerGesture = false;
        clearTimeout(twoFingerMoveTimer);
        twoFingerMoveTimer = null;
    }

    // --- 이벤트 리스너 등록 ---
    mainInputButton.addEventListener('touchstart', handleStart, { passive: false });
    mainInputButton.addEventListener('mousedown', handleStart);

    mainInputButton.addEventListener('touchmove', handleMove, { passive: false });
    mainInputButton.addEventListener('mousemove', handleMove); 

    mainInputButton.addEventListener('touchend', handleEnd);
    mainInputButton.addEventListener('mouseup', handleEnd);
    mainInputButton.addEventListener('touchcancel', handleEnd);
    mainInputButton.addEventListener('mouseleave', (e) => {
        if (isGestureActive && !isTwoFingerGesture) { 
            handleEnd(e);
        }
    });

    refreshButton.addEventListener('click', () => {
        window.location.reload();
    });

    deleteButton.addEventListener('click', () => {
        let currentText = kkotipInput.value;
        let cursorPos = kkotipInput.selectionStart;

        if (inputTimeoutId) {
            clearTimeout(inputTimeoutId);
            inputTimeoutId = null;
            if (currentCho !== -1 && currentJung !== -1) {
                const combinedChar = combineHangul();
                if (combinedChar) {
                    const lastCharDisassembled = disassembleHangul(currentText.slice(-1));
                    if (lastCharDisassembled && lastCharDisassembled.isHangul &&
                        lastCharDisassembled.choIndex === currentCho &&
                        lastCharDisassembled.jungIndex === currentJung &&
                        lastCharDisassembled.jongIndex === currentJong) {
                        
                        kkotipInput.value = currentText.slice(0, cursorPos - 1) + combinedChar + currentText.substring(cursorPos);
                        currentText = kkotipInput.value; 
                    }
                }
            }
            resetCombination(); 
        }

        if (cursorPos > 0) {
            let charToDelete = currentText.substring(cursorPos - 1, cursorPos);
            let disassembled = disassembleHangul(charToDelete);

            if (disassembled && disassembled.choIndex !== -1) { 
                if (disassembled.isHangul && disassembled.jongIndex !== 0) { 
                    currentCho = disassembled.choIndex;
                    currentJung = disassembled.jungIndex;
                    currentJong = 0; 
                    
                    let reCombined = combineHangul(); 
                    if (reCombined) {
                        kkotipInput.value = currentText.substring(0, cursorPos - 1) + reCombined + currentText.substring(cursorPos);
                    } else { 
                        kkotipInput.value = currentText.substring(0, cursorPos - 1) + currentText.substring(cursorPos);
                        resetCombination(); 
                    }
                    cursorPos--; 
                } else if (disassembled.isHangul && disassembled.jungIndex !== -1) { 
                    currentCho = disassembled.choIndex;
                    currentJung = -1; 
                    currentJong = -1; 
                    
                    kkotipInput.value = currentText.substring(0, cursorPos - 1) + CHOSUNG[currentCho] + currentText.substring(cursorPos);
                    cursorPos--;
                    resetCombination(); 

                } else { 
                    kkotipInput.value = currentText.substring(0, cursorPos - 1) + currentText.substring(cursorPos);
                    cursorPos--;
                    resetCombination();
                }
            } else { 
                kkotipInput.value = currentText.substring(0, cursorPos - 1) + currentText.substring(cursorPos);
                cursorPos--;
                resetCombination(); 
            }
            
            kkotipInput.selectionStart = cursorPos; 
            kkotipInput.selectionEnd = cursorPos;
            kkotipInput.focus(); 
            debugOutput.textContent = `백스페이스: 커서 위치 ${cursorPos}에서 삭제`;

        } else {
            debugOutput.textContent = `백스페이스: 삭제할 글자 없음`;
        }
    });
});