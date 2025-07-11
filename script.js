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
    let initialRecognizedDirection = null; // 모음 로직을 위해 유지

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
    const INPUT_TIMEOUT_MS = 10000; 

    const HANGUL_BASE_CODE = 0xAC00;
    const CHOSUNG_COUNT = 19;
    const JUNGSUNG_COUNT = 21;
    const JONGSUNG_COUNT = 28; // 종성 개수 (0번째는 빈칸)

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
                return CHOSUNG[currentCho]; // 중성이 없으면 초성만 반환 (예: ㄱ)
            }
        }
        return ''; // 아무것도 조합할 수 없으면 빈 문자열 반환
    }

    function resetCombination() {
        currentCho = -1;
        currentJung = -1;
        currentJong = -1;
    }

    function disassembleHangul(hangulChar) {
        const charCode = hangulChar.charCodeAt(0);
        // 완성형 한글인 경우
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
                isHangul: true // 완성형 한글 여부
            };
        }
        // 완성형 한글이 아닌 단독 자모인 경우
        let choIndex = CHOSUNG.indexOf(hangulChar);
        let jungIndex = JUNGSUNG.indexOf(hangulChar);
        let jongIndex = JONGSUNG.indexOf(hangulChar); 

        if (choIndex !== -1) return { cho: hangulChar, jung: '', jong: '', choIndex: choIndex, jungIndex: -1, jongIndex: -1, isHangul: false };
        if (jungIndex !== -1) return { cho: '', jung: hangulChar, jong: '', choIndex: -1, jungIndex: jungIndex, jongIndex: -1, isHangul: false };
        if (jongIndex !== -1 && jongIndex !== 0) return { cho: '', jung: '', jong: hangulChar, choIndex: -1, jungIndex: -1, jongIndex: jongIndex, isHangul: false }; 
        
        return null; // 한글 자모가 아닌 경우
    }

    // 겹받침을 두 개의 자음으로 분리 (예: ㄳ -> ㄱ, ㅅ)
    function splitComplexJongsung(complexJongChar) {
        for (const [key, value] of Object.entries(COMPLEX_JONGSUNG_MAP)) {
            if (value === complexJongChar) {
                return [key[0], key[1]];
            }
        }
        return null;
    }

    const TAP_DURATION_THRESHOLD = 250;
    const DOUBLE_TAP_DISTANCE_THRESHOLD = 15; // 더블 탭 간격
    const DRAG_DISTANCE_THRESHOLD = 8; // 드래그 시작으로 인식할 최소 거리
    const TWO_FINGER_DRAG_THRESHOLD = 15; 

    const CONSONANT_TURN_ANGLE_MIN = 25; 
    const VOWEL_TURN_ANGLE_MIN = 30; 
    const VOWEL_TURN_ANGLE_MAX = 180; 

    const DIRECTIONS = { 
        'consonant': { 
            // 각 방향은 이제 '버튼 구역'을 의미하며, dragChar는 해당 구역에서 드래그 시 나오는 자음.
            // (예: 'right'는 'ㅇ' 버튼 구역, 여기서 드래그하면 'ㅇ'이 나옴)
            'right': { angle: [337.5, 22.5], char: 'ㅇ', doubleTapChar: '@', dragChar: 'ㅎ' }, 
            'up-right': { angle: [292.5, 337.5], char: 'ㄱ', doubleTapChar: 'ㄲ', dragChar: 'ㅋ' },
            'up': { angle: [247.5, 292.5], char: 'ㅅ', doubleTapChar: 'ㅆ', dragChar: 'ㅊ' },
            'up-left': { angle: [202.5, 247.5], char: 'ㅈ', doubleTapChar: 'ㅉ', dragChar: 'ㅉ' }, 
            'left': { angle: [157.5, 202.5], char: 'ㄷ', doubleTapChar: 'ㄸ', dragChar: 'ㅌ' },
            'down-left': { angle: [112.5, 157.5], char: 'ㄴ', doubleTapChar: ',', dragChar: 'ㄹ' }, 
            'down': { angle: [67.5, 112.5], char: 'ㅂ', doubleTapChar: 'ㅃ', dragChar: 'ㅍ' },
            'down-right': { angle: [22.5, 67.5], char: 'ㅁ', doubleTapChar: '?', dragChar: '.' } 
        },
        'vowel': { 
            'right': { angle: [337.5, 22.5], char: 'ㅏ' },
            'left': { angle: [157.5, 202.5], char: 'ㅓ' },
            'up': { angle: [247.5, 292.5], char: 'ㅗ' },
            'down': { angle: [67.5, 112.5], char: 'ㅜ' },
        },
        'complex_vowel_transitions': { 
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
            
            'down-left_up-right': 'ㅢ', 
            'down-right_up-left': 'ㅢ'  
        },
        'multi_complex_vowel_transitions': { 
            'up_right_down': 'ㅙ', 
            'up_down-right_down-left': 'ㅙ', 

            'down_left_up': 'ㅞ',  
            'down_up-left_up-right': 'ㅞ'  
        }
    };

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

    function getRelativeTurnAngle(initialAngle, currentAngle) {
        let diff = currentAngle - initialAngle;
        if (diff > 180) diff -= 360;
        if (diff < -180) diff += 360;
        return diff;
    }

    function getPrimaryVowelChar(initialDir) {
        const cardinalVowel = DIRECTIONS.vowel[initialDir]?.char;
        if (cardinalVowel) return cardinalVowel;

        if (rightHandRadio.checked) {
            if (initialDir === 'down-left') return 'ㅡ';
            if (initialDir === 'up-right') return 'ㅣ';
        }
        else if (leftHandRadio.checked) {
            if (initialDir === 'down-right') return 'ㅡ';
            if (initialDir === 'up-left') return 'ㅣ';
        }
        
        return null;
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

        let tempCharToUpdate = ''; // 이 변수에 최종적으로 텍스트 에어리어에 반영될 문자열을 담음.
        let lastChar = currentText.slice(-1);
        let lastCharDisassembled = disassembleHangul(lastChar);
        
        // --- 조합 상태 관리 및 글자 확정 로직 ---
        // 이전에 확정되지 않은 글자가 있다면 먼저 확정 시도 (예: 'ㄱ' 입력 후 바로 'ㄴ' 입력 시 'ㄱ' 확정)
        if (currentCho !== -1) {
            let shouldCommitPrevious = false;
            let currentCombined = combineHangul();

            if (finalInputType === 'consonant') { // 새 입력이 자음일 때
                if (currentJung === -1) { // 현재 '초성'만 있는 상태 (예: 'ㄱ')
                    // 현재 입력 자음이 기존 초성과 같거나 쌍자음이 될 수 있는 자음이 아니면 이전 초성 확정
                    if (char !== CHOSUNG[currentCho] || !['ㄱ','ㄷ','ㅂ','ㅅ','ㅈ'].includes(char)) {
                         shouldCommitPrevious = true;
                    }
                } else if (currentJong !== -1) { // 현재 '초성+중성+종성' 상태 (예: '감')
                    // 겹받침이 될 수 없는 자음이 오면 이전 글자 확정
                    if (!COMPLEX_JONGSUNG_MAP[JONGSUNG[currentJong] + char]) {
                        shouldCommitPrevious = true;
                    }
                }
            } else { // 새 입력이 모음일 때
                if (currentJung !== -1) { // 현재 '초성+중성' 상태 (예: '가')
                    // 복합모음이 될 수 없는 모음이 오면 이전 글자 확정 (예: '가' 다음 'ㅣ'가 오면 '개'가 아니라 '가' 확정 후 'ㅣ' 새로)
                    if (!COMPLEX_JUNGSUNG_MAP[JUNGSUNG[currentJung] + char]) {
                        shouldCommitPrevious = true;
                    }
                }
            }
            
            if (shouldCommitPrevious && currentCombined) {
                kkotipInput.value = currentText.slice(0, cursorPosition - currentCombined.length) + currentCombined;
                cursorPosition = kkotipInput.value.length;
                resetCombination();
            }
        }


        // --- 핵심 한글 조합 및 텍스트 업데이트 로직 ---
        if (finalInputType === 'consonant') { // 자음이 입력되었을 때
            const choIndex = getCharIndex(char, 'cho');
            const jongIndex = getCharIndex(char, 'jong'); 
            
            // 입력된 'char'가 유효한 한글 자음이 아닌 경우 (특수문자, 숫자 등)
            if (choIndex === -1 && jongIndex === -1) { 
                tempCharToUpdate = char;
                resetCombination(); // 조합 상태 초기화
            } 
            // 현재 초성 + 중성까지 조합된 상태일 때 (받침 가능성)
            else if (currentCho !== -1 && currentJung !== -1) {
                if (currentJong !== -1) { // 현재 받침(종성)이 있는 상태
                    const potentialComplexJong = JONGSUNG[currentJong] + char; 
                    const newComplexJong = COMPLEX_JONGSUNG_MAP[potentialComplexJong];
                    
                    if (newComplexJong) { // 겹받침이 가능한 경우 (예: ㄳ)
                        currentJong = getCharIndex(newComplexJong, 'jong');
                        tempCharToUpdate = combineHangul(); // 현재 글자 재조합 (겹받침 포함)
                        kkotipInput.value = kkotipInput.value.slice(0, cursorPosition - 1) + tempCharToUpdate; // 현재 글자 대체
                    } else { 
                        // 겹받침 불가능 -> 현재 글자 확정하고, 새 자음은 다음 글자의 초성으로
                        // (이전 글자 확정은 위에서 이미 처리되었으므로 여기서는 새로운 글자 시작만)
                        resetCombination(); 
                        currentCho = choIndex; // 새 자음을 다음 글자의 초성으로 설정
                        tempCharToUpdate = CHOSUNG[currentCho]; // 새 초성 미리보기
                        kkotipInput.value += tempCharToUpdate; // 새 초성 추가
                    }
                } else { // 현재 받침이 없는 상태 -> 새 자음을 받침으로
                    currentJong = jongIndex;
                    tempCharToUpdate = combineHangul(); // 현재 글자 재조합 (받침 포함)
                    kkotipInput.value = kkotipInput.value.slice(0, cursorPosition - 1) + tempCharToUpdate; // 현재 글자 대체
                }
            } 
            // 현재 초성만 있는 상태일 때 (중성 없음)
            else if (currentCho !== -1) { 
                // 같은 초성 연속 입력 시 쌍자음 처리 (ㄱ -> ㄲ 등)
                if (char === CHOSUNG[currentCho] && ['ㄱ','ㄷ','ㅂ','ㅅ','ㅈ'].includes(char)) { 
                    if (char === 'ㄱ') currentCho = getCharIndex('ㄲ', 'cho');
                    else if (char === 'ㄷ') currentCho = getCharIndex('ㄸ', 'cho');
                    else if (char === 'ㅂ') currentCho = getCharIndex('ㅃ', 'cho');
                    else if (char === 'ㅅ') currentCho = getCharIndex('ㅆ', 'cho');
                    else if (char === 'ㅈ') currentCho = getCharIndex('ㅉ', 'cho');
                    tempCharToUpdate = CHOSUNG[currentCho]; // 쌍자음 초성으로 업데이트
                    kkotipInput.value = kkotipInput.value.slice(0, cursorPosition - 1) + tempCharToUpdate; // 현재 초성 대체
                } else { 
                    // 다른 자음이 들어온 경우 -> 현재 초성 확정하고, 새 자음은 다음 글자의 초성으로
                    // (이전 초성 확정은 위에서 이미 처리되었으므로 여기서는 새로운 글자 시작만)
                    resetCombination(); 
                    currentCho = choIndex; // 새 자음을 다음 글자의 초성으로 설정
                    tempCharToUpdate = CHOSUNG[currentCho]; // 새 초성 미리보기
                    kkotipInput.value += tempCharToUpdate; // 새 초성 추가
                }
            } 
            // 아무것도 조합 중이지 않은 상태 -> 새 글자의 초성으로 시작
            else { 
                resetCombination(); // 혹시 모를 이전 조합 초기화
                currentCho = choIndex; // 입력된 자음을 초성으로 설정
                tempCharToUpdate = CHOSUNG[currentCho]; // 초성만 할당
                kkotipInput.value += tempCharToUpdate; // 새 초성 추가 (미리보기)
            }
        } else { // Vowel (모음)이 입력되었을 때
            const jungIndex = getCharIndex(char, 'jung');

            if (currentCho !== -1) { // 현재 초성이 있는 경우
                if (currentJung === -1) { // 중성이 아직이라면 현재 모음을 중성으로
                    currentJung = jungIndex;
                    tempCharToUpdate = combineHangul(); // 초성+중성 조합 시도
                    kkotipInput.value = kkotipInput.value.slice(0, cursorPosition - 1) + tempCharToUpdate; // 초성만 있던 글자를 초성+중성으로 대체
                } else { // 중성까지 있는 상태라면 복합 모음 시도 또는 모음 단독 출력
                    const prevJungChar = JUNGSUNG[currentJung];
                    const potentialComplexJung = prevJungChar + char;
                    const newComplexJung = COMPLEX_JUNGSUNG_MAP[potentialComplexJung];

                    if (newComplexJung) { // 복합 모음 가능한 경우 (예: ㅗ+ㅏ -> ㅘ)
                        currentJung = getCharIndex(newComplexJung, 'jung');
                        tempCharToUpdate = combineHangul(); // 초성+복합중성 조합 시도
                        kkotipInput.value = kkotipInput.value.slice(0, cursorPosition - 1) + tempCharToUpdate; // 현재 글자를 대체 (복합모음 포함)
                    } else { 
                        // 복합 모음 불가능 -> 현재 글자 확정 후 모음 단독 출력
                        kkotipInput.value = currentText.slice(0, cursorPosition - (combineHangul()).length) + combineHangul(); // 현재 글자 확정
                        
                        // ⭐⭐⭐ 오빠의 셋째 규칙 적용: 모음만 단독 출력 (핵심 변경) ⭐⭐⭐
                        resetCombination(); 
                        tempCharToUpdate = char; // 'ㅇ' 없이 모음만 할당
                        kkotipInput.value += tempCharToUpdate; // 모음만 추가 (예: 'ㅏ'는 'ㅏ' 그대로)
                        cursorPosition = kkotipInput.value.length; // 커서 위치 조정
                    }
                }
            } else { // 현재 초성 없음 -> 연음 처리 또는 모음 단독 출력
                // 직전 글자가 한글 완성형이고 종성이 있는 경우 -> 연음 처리
                if (lastCharDisassembled && lastCharDisassembled.isHangul && lastCharDisassembled.jongIndex > 0) { 
                    let movedJongChar = '';
                    let remainJongIndex = 0;

                    // ⭐ 겹받침 연음 규칙: 첫 번째 자음은 남고 두 번째 자음 이동 ⭐
                    if (splitComplexJongsung(lastCharDisassembled.jong)) { // 겹받침인 경우 (예: ㄺ)
                        const [firstJong, secondJong] = splitComplexJongsung(lastCharDisassembled.jong);
                        movedJongChar = secondJong; // 두 번째 자음만 이동
                        remainJongIndex = getCharIndex(firstJong, 'jong'); // 첫 번째 자음은 남김
                        
                        currentCho = lastCharDisassembled.choIndex;
                        currentJung = lastCharDisassembled.jungIndex;
                        currentJong = remainJongIndex; // 남은 첫 번째 자음으로 종성 설정
                        
                        let reCombinedPrevChar = combineHangul(); // 앞 글자 재조합 (단일 받침으로)
                        kkotipInput.value = currentText.substring(0, cursorPosition - 1) + reCombinedPrevChar; // 이전 글자 대체
                        
                        // 이동된 자음으로 새 글자의 초성 + 입력된 모음 조합
                        resetCombination(); 
                        currentCho = getCharIndex(movedJongChar, 'cho'); // 이동된 자음을 새 초성으로
                        currentJung = jungIndex; 
                        tempCharToUpdate = combineHangul(); // 새 글자 조합
                        kkotipInput.value += tempCharToUpdate; // 새 글자 추가

                    } else { // 단일 받침인 경우
                        movedJongChar = JONGSUNG[lastCharDisassembled.jongIndex]; // 단일 받침 전체 이동
                        
                        currentCho = lastCharDisassembled.choIndex;
                        currentJung = lastCharDisassembled.jungIndex;
                        currentJong = 0; // 앞 글자의 받침 제거
                        
                        let reCombinedPrevChar = combineHangul(); // 앞 글자 재조합 (받침 제거)
                        kkotipInput.value = currentText.substring(0, cursorPosition - 1) + reCombinedPrevChar; // 이전 글자 대체

                        // 이동된 자음으로 새 글자의 초성 + 입력된 모음 조합
                        resetCombination(); 
                        currentCho = getCharIndex(movedJongChar, 'cho'); 
                        currentJung = jungIndex; 
                        tempCharToUpdate = combineHangul(); // 새 글자 조합
                        kkotipInput.value += tempCharToUpdate; // 새 글자 추가
                    }
                } 
                else { // 직전 글자가 한글 완성형이 아니거나 받침이 없는 경우 -> 모음 단독 출력
                    resetCombination();
                    // ⭐⭐⭐ 오빠의 셋째 규칙 적용: 모음만 단독 출력 (핵심 변경) ⭐⭐⭐
                    tempCharToUpdate = char; // 'ㅇ' 없이 모음만 할당
                    kkotipInput.value += tempCharToUpdate; // 모음만 추가
                }
            }
        }
        
        // 커서 위치 조정 (항상 맨 뒤로)
        kkotipInput.selectionStart = kkotipInput.value.length;
        kkotipInput.selectionEnd = kkotipInput.value.length;

        debugOutput.textContent = `입력 완료 (${finalInputType}): ${char} -> 현재 글자: ${kkotipInput.value.slice(-1)} (총 거리: ${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequenceDebug})`;
        
        // 조합 타이머 설정: 한글 자모가 입력된 경우에만 설정
        if (/^[가-힣ㄱ-ㅎㅏ-ㅣ]$/.test(char) && (currentCho !== -1 || currentJung !== -1 || currentJong !== -1)) { 
            if (inputTimeoutId) {
                clearTimeout(inputTimeoutId); 
            }
            inputTimeoutId = setTimeout(() => {
                // 타이머 만료 시 현재 조합 상태를 기반으로 글자를 확정하고 상태 초기화
                // 이 부분은 이미 processAndDisplayInput 내에서 대부분 처리되므로, 단순히 조합 상태만 초기화합니다.
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
        inputSequence = []; // 모음 로직을 위해 유지. 자음은 단방향만 사용
        initialRecognizedDirection = null; // 모음 로직을 위해 유지

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

        // ⭐ 자음 모드일 때, 터치 시작 위치가 어떤 자음 구역에 해당하는지 저장 ⭐
        if (isConsonantModeActive) {
            const relativeX = clientX - centerX;
            const relativeY = clientY - centerY;
            let initialAngleForZone = Math.atan2(relativeY, relativeX) * (180 / Math.PI);
            if (initialAngleForZone < 0) initialAngleForZone += 360;
            // initialConsonantZone 에 'right', 'up-right' 등 8방위 문자열 저장
            initialConsonantZone = getDirectionStringFromAngle(initialAngleForZone); 
            debugOutput.textContent = `자음 구역 시작: ${initialConsonantZone}`;
        } else {
            initialConsonantZone = null; // 모음 모드일 때는 초기화
        }

        debugOutput.textContent = `제스처 시작 (모드: ${isConsonantModeActive ? '자음' : '모음'} - ${isConsonantModeActive ? '사각형 바깥' : '중앙 원형'} 시작): (${startX.toFixed(0)}, ${startY.toFixed(0)})`;
    }

    function handleMove(e) {
        if (!isGestureActive) return;

        if (isTwoFingerGesture) { 
            if (e.touches && e.touches.length === 2) {
                const currentX = (e.touches[0].clientX + e.touches[1].clientX) / 2;
                const currentY = (e.touches[0].clientY + e.touches[1].clientY) / 2;

                const deltaX = currentX - prevX;
                const deltaY = prevY - currentY; // Y축 반전: 위로 드래그 시 양수, 아래로 드래그 시 음수
                
                // 두 손가락 수직 이동 감지 로직 (스크롤 또는 세로 커서 이동)
                if (Math.abs(deltaY) > TWO_FINGER_VERTICAL_MOVE_SENSITIVITY) {
                    if (deltaY > 0) { // 위로 이동
                        moveCursorVertical('up');
                    } else { // 아래로 이동
                        moveCursorVertical('down');
                    }
                    prevX = currentX; 
                    prevY = currentY;
                    return; 
                }

                // 두 손가락 수평 이동 감지 로직 (좌우 커서 이동)
                if (Math.abs(deltaX) > TWO_FINGER_DRAG_THRESHOLD) {
                    const moveAmount = Math.round(deltaX / 10); 
                    moveCursorHorizontal(moveAmount);
                    prevX = currentX;
                    prevY = currentY;
                    return; 
                }
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
                inputSequence = [initialRecognizedDirection]; // 드래그 시작 시 초기 방향만 저장 (자음은 단방향)
                lastSegmentAngle = firstDragAngle;
                
                debugOutput.textContent = `드래그 시작! 첫 방향: ${inputSequence[0]} (각도: ${firstDragAngle.toFixed(1)}°)`;
            } else {
                debugOutput.textContent = `드래그 대기중... 거리: ${distFromStart.toFixed(0)}`;
                return; 
            }
        }
        
        // ⭐ 모음 복합조합 감지 로직 (모음 모드) 강화 ⭐ (기존 로직 유지)
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
        // ⭐ 자음 모드 꺾임 감지 로직 완전히 제거 (오빠의 지시 반영) ⭐
        // 이 블록은 통째로 삭제되어 handleMove 에는 포함되지 않습니다.
        /*
        else if (isConsonantModeActive && isDragging) {
            // 이 블록의 모든 내용이 제거됩니다.
        }
        */ 
        // 자음 꺾임 감지 로직 제거 끝 (확실히 제거됨)

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
            } else { // ⭐ 자음 직선 드래그 로직 (시작 구역 기반) ⭐
                // 오빠의 요청: 자음은 단방향 드래그만 사용할 것.
                // 드래그 시작 시점의 '자음 구역'에 매핑된 dragChar를 사용합니다.
                char = DIRECTIONS.consonant[initialConsonantZone]?.dragChar; 
                if (char) {
                    processAndDisplayInput(char, finalInputType, totalDragDistance, `자음 드래그: ${initialConsonantZone} -> ${char}`);
                } else {
                    debugOutput.textContent = `입력 실패 (자음 드래그): 총 거리=${totalDragDistance.toFixed(0)}px, 시작 구역: ${initialConsonantZone}`;
                }
            }
        } else { // 모음 모드 (중앙 원형) - 기존 로직 유지
            if (totalDragDistance < DRAG_DISTANCE_THRESHOLD) { // 탭 (스페이스)
                handleTap(e, totalDragDistance, duration);
            } else { // 드래그 (직선 모음, 복합 모음, 3단계 복합 모음)
                // ⭐ 모음 패턴 인식 로직 강화 (기존 로직 그대로 유지) ⭐
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
                    
                    if (!char) { 
                         if (rightHandRadio.checked && firstDir === 'down-left' && secondDir === 'up-right') {
                            char = 'ㅢ';
                            debugOutput.textContent += ` (오른손잡이 'ㅢ' 특수 인식)`;
                         } 
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
        else { // ⭐ 자음 모드 탭 (싱글/더블 탭) ⭐
            // 더블 탭 조건 개선: 시간 및 거리 허용 범위 확장
            if (lastTapDirection === tapDirection && 
                (currentTime - lastTapTime < TAP_DURATION_THRESHOLD) &&
                (Math.abs(startX - lastTapStartX) < DOUBLE_TAP_DISTANCE_THRESHOLD * 2) && // 거리 임계값 2배로 늘림 (유연하게)
                (Math.abs(startY - lastTapStartY) < DOUBLE_TAP_DISTANCE_THRESHOLD * 2)
            ) { // 더블 탭
                charToInput = DIRECTIONS.consonant[tapDirection]?.doubleTapChar || '';
                debugOutput.textContent = `자음 버튼 더블 탭: ${charToInput} 입력! (방향: ${tapDirection})`;
                
                let currentText = kkotipInput.value;
                if (currentText.length > 0) {
                    const lastCharInInput = currentText.slice(-1);
                    const disassembledLastChar = disassembleHangul(lastCharInInput);
                    // 마지막 글자가 자음이고, 현재 더블 탭하려는 방향의 싱글 탭 자음과 일치하는 경우
                    if (disassembledLastChar && disassembledLastChar.choIndex !== -1 &&
                        CHOSUNG[disassembledLastChar.choIndex] === DIRECTIONS.consonant[tapDirection]?.char) {
                        kkotipInput.value = currentText.slice(0, -1); 
                    }
                }
                processAndDisplayInput(charToInput, 'consonant', totalDragDistance, `double-tap-${tapDirection}`);

                lastTapTime = 0; // 더블 탭 후 초기화
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
        initialConsonantZone = null; // 새로 추가된 변수 초기화
        
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

        // 타이머가 작동 중이라면 현재 조합 상태를 확정하고 초기화
        if (inputTimeoutId) {
            clearTimeout(inputTimeoutId);
            inputTimeoutId = null;
            resetCombination(); 
        }

        if (cursorPos > 0) {
            let charToDelete = currentText.substring(cursorPos - 1, cursorPos);
            let disassembled = disassembleHangul(charToDelete);

            if (disassembled && disassembled.isHangul) { // 완성형 한글인 경우
                if (disassembled.jongIndex !== 0) { // 받침이 있는 한글 글자
                    let remainingJong = ''; // 겹받침에서 남을 자음
                    const splitJong = splitComplexJongsung(disassembled.jong);

                    if (splitJong) { // 겹받침인 경우 (예: ㄺ)
                        remainingJong = splitJong[0]; 
                        currentCho = disassembled.choIndex;
                        currentJung = disassembled.jungIndex;
                        currentJong = getCharIndex(remainingJong, 'jong'); 
                        let reCombined = combineHangul(); 
                        kkotipInput.value = currentText.substring(0, cursorPos - 1) + reCombined + currentText.substring(cursorPos);
                        resetCombination(); 
                    } else { // 단일 받침인 경우 (예: '간'에서 'ㄴ' 지우기)
                        currentCho = disassembled.choIndex;
                        currentJung = disassembled.jungIndex;
                        currentJong = 0; 
                        let reCombined = combineHangul(); 
                        kkotipInput.value = currentText.substring(0, cursorPos - 1) + reCombined + currentText.substring(cursorPos);
                        resetCombination(); 
                    }
                } else { // 받침이 없는 한글 글자 (초성+중성)
                    currentCho = disassembled.choIndex;
                    currentJung = -1; 
                    currentJong = -1; 
                    kkotipInput.value = currentText.substring(0, cursorPos - 1) + CHOSUNG[currentCho] + currentText.substring(cursorPos); 
                    resetCombination(); 
                }
            } else if (disassembled && (disassembled.choIndex !== -1 || disassembled.jungIndex !== -1 || disassembled.jongIndex !== -1)) {
                // 단독 초성, 단독 모음, 단독 종성 (예: ㄱ, ㅏ)
                kkotipInput.value = currentText.substring(0, cursorPos - 1) + currentText.substring(cursorPos);
                resetCombination();
            } else { // 한글 자모가 아닌 일반 문자 (공백, 숫자, 특수문자 등)
                kkotipInput.value = currentText.substring(0, cursorPos - 1) + currentText.substring(cursorPos);
                resetCombination(); 
            }
            
            cursorPos--; // 커서 한 칸 뒤로 이동
            kkotipInput.selectionStart = cursorPos; 
            kkotipInput.selectionEnd = cursorPos;
            kkotipInput.focus(); 
            debugOutput.textContent = `백스페이스: 커서 위치 ${cursorPos}에서 삭제`;

        } else {
            debugOutput.textContent = `백스페이스: 삭제할 글자 없음`;
        }
    });
});