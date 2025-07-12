document.addEventListener('DOMContentLoaded', () => {
    const kkotipInput = document.getElementById('kkotipInput');
    const inputButtonContainer = document.getElementById('inputButtons');
    const mainInputButton = document.getElementById('mainInputButton');
    const refreshButton = document.getElementById('refreshButton');
    const debugOutput = document.getElementById('debugOutput');
    const rightHandRadio = document.getElementById('rightHand');
    const leftHandRadio = document.getElementById('leftHand');
    
    // 버튼 위치 설정
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

    // 제스처 관련 상태 변수 (최소화)
    let startX = 0;
    let startY = 0;
    let isGestureActive = false; 
    let isDragging = false;     
    let touchStartTime = 0;     
    let isConsonantModeActive = true; 

    let initialConsonantZone = null; 

    // --- 더블 탭 관련 변수 ---
    let lastTapTime = 0;
    let lastTapDirection = null;
    let lastTapStartX = 0;
    let lastTapStartY = 0;
    let isDoubleTapHandledThisCycle = false; 

    // --- 한글 조합 관련 변수 (최소화 및 타자기 모드에 맞게 재정의) ---
    let currentCho = -1; 
    let currentJung = -1;
    let currentJong = -1;
    let inputTimeoutId = null; 
    const INPUT_TIMEOUT_MS = 500; 

    // 한글 자모 데이터
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

    // 유틸리티 함수
    function getCharIndex(char, type) {
        if (type === 'cho') return CHOSUNG.indexOf(char);
        if (type === 'jung') return JUNGSUNG.indexOf(char);
        if (type === 'jong') return JONGSUNG.indexOf(char);
        return -1;
    }

    // 한글 조합 함수
    function combineHangul() {
        if (currentCho === -1) return ''; 

        if (currentJung === -1) {
            return CHOSUNG[currentCho];
        }

        if (currentJong === -1) {
            let combinedCode = HANGUL_BASE_CODE +
                               (currentCho * JUNGSUNG_COUNT * JONGSUNG_COUNT) +
                               (currentJung * JUNGSUNG_COUNT);
            return String.fromCharCode(combinedCode);
        }

        let combinedCode = HANGUL_BASE_CODE +
                           (currentCho * JUNGSUNG_COUNT * JONGSUNG_COUNT) +
                           (currentJung * JUNGSUNG_COUNT) +
                           currentJong;
        return String.fromCharCode(combinedCode);
    }

    // 조합 버퍼 초기화
    function resetCombination() {
        currentCho = -1;
        currentJung = -1;
        currentJong = -1;
    }

    // 한글 분해 함수
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
        if (jongIndex !== -1 && jongIndex !== 0) return { cho: '', jung: '', jong: hangulChar, choIndex: -1, jungIndex: -1, jongIndex: jongIndex, isHangul: false }; 
        
        return null; 
    }

    function splitComplexJongsung(complexJongChar) {
        for (const [key, value] of Object.entries(COMPLEX_JUNGSUNG_MAP)) {
            if (value === complexJongChar) {
                return [key[0], key[1]];
            }
        }
        return null;
    }

    // 제스처 및 탭 인식 임계값
    const DRAG_DISTANCE_THRESHOLD = 8; 
    const TAP_DURATION_THRESHOLD = 250; 
    const DOUBLE_TAP_DISTANCE_THRESHOLD = 15; 

    // DIRECTIONS 객체는 K가 제공한 그대로 유지
    const DIRECTIONS = { 
        'consonant': { 
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

    // 추가 유틸리티 함수 (유지)
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
    
    // K의 지시: 입력된 문자를 그대로 텍스트 에어리어에 추가하는 핵심 함수
    function appendCharToInput(char) {
        let currentText = kkotipInput.value;
        let cursorPos = kkotipInput.selectionStart;

        if (cursorPos < currentText.length) { // 커서가 중간에 있으면 해당 위치에 삽입
            kkotipInput.value = currentText.substring(0, cursorPos) + char + currentText.substring(cursorPos);
            kkotipInput.selectionStart = cursorPos + char.length;
            kkotipInput.selectionEnd = cursorPos + char.length;
        } else { // 커서가 맨 뒤에 있으면 그냥 추가
            kkotipInput.value += char;
            kkotipInput.selectionStart = kkotipInput.value.length;
            kkotipInput.selectionEnd = kkotipInput.value.length;
        }
        kkotipInput.focus(); // 입력 후 포커스 유지
    }

    // --- K가 요청한 세 가지 자음 입력 함수 ---
    function handleConsonantSingleTap(direction) {
        const charToInput = DIRECTIONS.consonant[direction]?.char;
        if (charToInput) {
            processInputAndSetTimer(charToInput, 'consonant', 0, `single-tap-${direction}`); 
        } else {
            debugOutput.textContent = `싱글 탭 오류: ${direction} 방향에 해당하는 자음을 찾을 수 없음`;
        }
    }

    function handleConsonantDoubleTap(direction) {
        const charToInput = DIRECTIONS.consonant[direction]?.doubleTapChar;
        if (charToInput) {
            // K의 지시: 더블 탭 시 직전 글자가 해당 단일 자음이라면 삭제하고 쌍자음으로 대체 (핵심 수정)
            let currentText = kkotipInput.value;
            let cursorPos = kkotipInput.selectionStart;

            if (cursorPos > 0) {
                const lastCharInInput = currentText.slice(cursorPos - 1, cursorPos);
                const disassembledLastChar = disassembleHangul(lastCharInInput);
                
                // 해당 방향의 싱글 탭 자음을 가져옴 (예: 'ㅈ' 방향에서 'ㅉ' 더블 탭 시 싱글 탭 자음은 'ㅈ')
                const singleTapCharForDirection = DIRECTIONS.consonant[direction]?.char;

                // 직전 글자가 한글 완성형이 아니고, 단독 초성이며, 해당 방향의 싱글 탭 자음과 일치할 때
                if (disassembledLastChar && !disassembledLastChar.isHangul && 
                    disassembledLastChar.choIndex !== -1 && 
                    CHOSUNG[disassembledLastChar.choIndex] === singleTapCharForDirection) {
                    
                    // 직전의 단독 초성을 삭제 (예: 'ㅈ'을 지움)
                    kkotipInput.value = currentText.slice(0, cursorPos - 1);
                    kkotipInput.selectionStart = cursorPos - 1;
                    kkotipInput.selectionEnd = cursorPos - 1;
                }
            }
            // 이제 charToInput (쌍자음 또는 특수문자, 예: 'ㅉ')을 새롭게 입력
            processInputAndSetTimer(charToInput, 'consonant', 0, `double-tap-${direction}`); 
        } else {
            debugOutput.textContent = `더블 탭 오류: ${direction} 방향에 해당하는 쌍자음/특수문자를 찾을 수 없음`;
        }
    }

    function handleConsonantDrag(direction) {
        const charToInput = DIRECTIONS.consonant[direction]?.dragChar;
        if (charToInput) {
            processInputAndSetTimer(charToInput, 'consonant', 0, `drag-${direction}`); 
        } else {
            debugOutput.textContent = `드래그 오류: ${direction} 방향에 해당하는 자음을 찾을 수 없음`;
        }
    }


    // --- 한글 조합 기능 (타이머 만료 시 호출) ---
    function combineLastInputtedHangul() {
        let currentText = kkotipInput.value;
        let cursorPos = kkotipInput.selectionStart;

        if (cursorPos < currentText.length) {
            resetCombination(); 
            debugOutput.textContent = `조합 불가: 커서가 맨 뒤에 있지 않음`;
            return;
        }

        // 현재 조합 버퍼가 비어있으면 조합할 내용 없음
        if (currentCho === -1 && currentJung === -1 && currentJong === -1) {
            debugOutput.textContent = `조합할 자모가 버퍼에 없음`;
            return;
        }

        // K의 조합 원칙에 따라 조합 시도 (currentCho, currentJung, currentJong 활용)
        let combinedResult = combineHangul(); // 이 함수는 currentCho/Jung/Jong에 있는 값으로만 조합

        if (combinedResult) {
            let charsToReplaceCount = 0; // 실제 텍스트에서 대체될 자모의 수

            // --- K의 조합 원칙을 바탕으로 charsToReplaceCount 계산 ---
            // '타자기'는 입력된 그대로 표시 후 조합이므로, 조합된 글자를 만들기 위해
            // 실제 몇 개의 자모 문자가 지워져야 하는지 정확히 파악해야 한다.
            
            // 1. 현재 버퍼에 초성, 중성, 종성이 모두 있다면 (예: 'ㄱ', 'ㅏ', 'ㄴ' -> '간')
            if (currentCho !== -1 && currentJung !== -1 && currentJong !== -1) {
                // 겹받침인 경우 (예: 'ㄳ'은 JONGSUNG에서 2글자로 되어있음. 'ㄱ' 'ㅅ' 두 글자 입력 후 'ㄳ'이 되어야 함)
                const jongCharStr = JONGSUNG[currentJong];
                if (jongCharStr.length > 1) { // 겹받침 (예: ㄳ, ㄵ 등)
                    charsToReplaceCount = 4; // 초성1 + 중성1 + 겹받침2 = 4개 자모
                } else { // 단일 종성 (예: ㄱ, ㄴ, ㄷ)
                    charsToReplaceCount = 3; // 초성1 + 중성1 + 단일종성1 = 3개 자모
                }
            } 
            // 2. 현재 버퍼에 초성, 중성만 있다면 (예: 'ㄱ', 'ㅏ' -> '가')
            else if (currentCho !== -1 && currentJung !== -1) {
                charsToReplaceCount = 2; // 초성1 + 중성1 = 2개 자모
            } 
            // 3. 현재 버퍼에 초성만 있다면 (예: 'ㄱ' -> 'ㄱ')
            else if (currentCho !== -1) {
                charsToReplaceCount = 1; // 초성1 = 1개 자모
            } 
            // 4. 현재 버퍼에 중성만 있다면 (예: 'ㅏ' -> 'ㅏ')
            else if (currentJung !== -1) {
                charsToReplaceCount = 1; // 중성1 = 1개 자모
            }

            // 실제 텍스트 대체
            if (charsToReplaceCount > 0 && combinedResult) { 
                // K의 지시: 글자가 스스로 바뀌거나 다른 글자가 입력되지 않아야 한다.
                // 따라서, combineHangul 결과가 유효하고, 실제로 지워야 할 자모가 있을 때만 대체.
                // 만약 현재 텍스트의 마지막 자모들이 실제로 currentCho/Jung/Jong에 해당하는지
                // 정확히 확인하여 `charsToReplaceCount`를 계산하고 대체하는 것이 안전하다.
                // 여기서는 `processInputAndSetTimer`에서 `currentCho` 등이 정확히 채워졌다고 가정하고
                // 그 개수를 바탕으로 지운다.
                kkotipInput.value = currentText.substring(0, cursorPos - charsToReplaceCount) + combinedResult;
                kkotipInput.selectionStart = kkotipInput.value.length;
                kkotipInput.selectionEnd = kkotipInput.value.length;
                debugOutput.textContent = `조합 성공: ${combinedResult} (대체 글자 수: ${charsToReplaceCount})`;
            } else {
                 debugOutput.textContent = `조합 실패 또는 불필요: ${currentText.slice(Math.max(0, cursorPos - charsToReplaceCount), cursorPos)}`;
            }

        } else { // combinedResult가 비었을 경우 (조합 불가능)
             debugOutput.textContent = `조합할 자모가 버퍼에 있지만 조합 불가능.`;
        }

        resetCombination(); // 조합 후 버퍼 초기화
        kkotipInput.focus();
    }


    // --- 실제 입력 처리를 담당하는 함수 ---
    function processInputAndSetTimer(char, finalInputType, totalDragDistance, inputSequenceDebug) {
        let currentText = kkotipInput.value;
        let cursorPos = kkotipInput.selectionStart;

        if (cursorPos < currentText.length) { // 중간 삽입
            appendCharToInput(char);
            debugOutput.textContent = `삽입: ${char}`;
            resetCombination(); 
            clearTimeout(inputTimeoutId); 
            inputTimeoutId = null;
            return;
        }

        if (inputTimeoutId) { // 이전 조합 타이머 클리어
            clearTimeout(inputTimeoutId);
            inputTimeoutId = null;
        }

        if (char === ' ') { // 스페이스바
            appendCharToInput(' ');
            debugOutput.textContent = `스페이스 입력`;
            resetCombination(); 
            return; 
        }

        // 한글 자모는 일단 그대로 출력
        appendCharToInput(char);
        debugOutput.textContent = `직접 입력: ${char}`;

        // ⭐ 조합 버퍼 업데이트 로직 (K의 조합 원칙 반영 및 오류 수정) ⭐
        // 중요한 점: 자모가 들어올 때, 현재 버퍼 상태를 보고 '확정'할지 '추가'할지 결정
        const choIdx = getCharIndex(char, 'cho');
        const jungIdx = getCharIndex(char, 'jung');
        const jongIdx = getCharIndex(char, 'jong');
        
        let shouldCombineAndResetCurrentBuffer = false; // 현재 버퍼를 확정하고 새로 시작할지 결정하는 플래그

        if (choIdx !== -1) { // 입력이 초성일 때 (ㄱ, ㄲ, ㅅ, ㅉ 등)
            // 1. 현재 버퍼가 이미 완성형 글자를 담고 있거나 (초+중+종)
            // 2. 현재 버퍼가 초성+중성만 있고, 새 자음이 종성이 아닌 초성으로 올 때 (예: '가' 다음 'ㄱ'은 새 초성)
            // 3. 현재 버퍼가 초성만 있고, 새 자음이 같은 초성인데 쌍자음이 아니거나 (예: 'ㄱ' 다음 'ㄹ'),
            //    혹은 이미 쌍자음인데 또 같은 쌍자음이 올 때 (예: 'ㄲ' 다음 'ㄲ') -> 즉, 이전 초성 확정 후 새 초성 시작
            if ((currentCho !== -1 && currentJung !== -1) || // 초성+중성이 있는 상태 (종성이 있든 없든)
                (currentCho !== -1 && currentJung === -1 && currentJong === -1) // 초성만 있는 상태에서 또 초성
            ) {
                shouldCombineAndResetCurrentBuffer = true;
            }
            
            if (shouldCombineAndResetCurrentBuffer) {
                combineLastInputtedHangul(); // 이전 버퍼 확정
                resetCombination(); // 버퍼 초기화
            }
            currentCho = choIdx; // 새 초성 설정
        } 
        else if (jungIdx !== -1) { // 입력이 중성일 때 (ㅏ, ㅑ, ㅗ 등)
            // 1. 현재 버퍼에 초성이 없다면 (예: 'ㅏ'만 입력) -> 단독 모음
            // 2. 초성만 있는 상태에서 중성 (예: 'ㄱ' 다음 'ㅏ')
            // 3. 이미 중성 있는데 또 중성 (복합 모음 규칙 따름)
            
            if (currentCho === -1) { // 초성이 없는 상태에서 모음 (K의 지시: 'ㅇ' 없이 단독 모음)
                shouldCombineAndResetCurrentBuffer = true; // 현재 버퍼 확정 (초성만 있던 경우도 포함)
            } else if (currentJung !== -1) { // 이미 중성 있는데 또 중성 (복합 모음 아님)
                const prevJungChar = JUNGSUNG[currentJung];
                const potentialComplexJung = prevJungChar + char;
                const newComplexJungIdx = getCharIndex(COMPLEX_JUNGSUNG_MAP[potentialComplexJung], 'jung');
                if (newComplexJungIdx === -1) { // 복합 모음 불가능
                    shouldCombineAndResetCurrentBuffer = true;
                }
            }

            if (shouldCombineAndResetCurrentBuffer) {
                combineLastInputtedHangul(); // 이전 조합 확정
                resetCombination(); // 버퍼 초기화
            }
            // `currentCho`가 -1인 채로 `currentJung`을 설정하여 단독 모음을 유지.
            // 또는 `currentCho`가 있는 상태에서 `currentJung` 설정.
            if (currentCho === -1 && !shouldCombineAndResetCurrentBuffer) { // 단독 모음 시작 시
                currentJung = jungIdx;
            } else if (currentCho !== -1 && currentJung === -1) { // 초성 다음 첫 중성
                currentJung = jungIdx;
            } else if (currentCho !== -1 && currentJung !== -1 && !shouldCombineAndResetCurrentBuffer) { // 복합모음 성공
                currentJung = jungIdx; // 이미 위에서 newComplexJungIdx로 업데이트됨
            }
            // 이 `currentJung = jungIdx;`는 위 `if/else if` 블록 내부에서 이미 처리되었으므로,
            // 여기서 중복으로 할당하지 않고, `shouldCombineAndResetCurrentBuffer`가 `false`일 때만 버퍼 업데이트.
            if (!shouldCombineAndResetCurrentBuffer) {
                 if (currentCho === -1) { // 'ㅏ' 단독 입력
                    currentJung = jungIdx;
                 } else if (currentJung === -1) { // 'ㄱ' + 'ㅏ'
                    currentJung = jungIdx;
                 } // 복합모음은 이미 위에서 currentJung 업데이트됨
            }


        } 
        // 3. 종성 입력
        else if (jongIdx !== -1) { 
            // 초성+중성 상태에서 종성
            if (currentCho !== -1 && currentJung !== -1 && currentJong === -1) { 
                currentJong = jongIdx;
            } 
            // 이미 종성이 있는데 또 종성 (겹받침 시도)
            else if (currentCho !== -1 && currentJung !== -1 && currentJong !== -1) {
                const prevJongChar = JONGSUNG[currentJong];
                const potentialComplexJong = prevJongChar + char;
                const newComplexJongIdx = getCharIndex(COMPLEX_JONGSUNG_MAP[potentialComplexJong], 'jong');
                if (newComplexJongIdx !== -1) { // 겹받침 가능
                    currentJong = newComplexJongIdx;
                } else { // 겹받침 불가능 -> 이전 글자 확정 후 새 종성 (초성으로) 시작
                    shouldCombineAndResetCurrentBuffer = true;
                }
            }
            // 그 외 (초성만, 모음만 있는 상태에서 종성) -> 이전 조합 확정 후 새 종성을 초성으로 시작
            else { 
                shouldCombineAndResetCurrentBuffer = true;
            }

            if (shouldCombineAndResetCurrentBuffer) {
                combineLastInputtedHangul(); // 이전 조합 확정
                resetCombination(); // 버퍼 초기화
                currentCho = jongIdx; // 종성을 새 초성으로
            }
        }

        // 한글 자모인 경우에만 조합 타이머 설정
        if (/^[ㄱ-ㅎㅏ-ㅣ]$/.test(char)) { 
            inputTimeoutId = setTimeout(() => {
                combineLastInputtedHangul(); 
            }, INPUT_TIMEOUT_MS);
        } else { 
            resetCombination(); 
        }
    }


    // --- 이벤트 핸들러 ---
    function handleStart(e) {
        e.preventDefault(); 
        isGestureActive = true;
        isDragging = false;
        touchStartTime = Date.now();
        initialConsonantZone = null; 
        isDoubleTapHandledThisCycle = false; // 새로운 터치 시작 시 플래그 초기화 (중요)
        
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

        if (isConsonantModeActive) {
            const relativeX = clientX - centerX;
            const relativeY = clientY - centerY;
            let initialAngleForZone = Math.atan2(relativeY, relativeX) * (180 / Math.PI);
            if (initialAngleForZone < 0) initialAngleForZone += 360;
            initialConsonantZone = getDirectionStringFromAngle(initialAngleForZone); 
            debugOutput.textContent = `제스처 시작 (모드: 자음, 구역: ${initialConsonantZone})`;
        } else {
            debugOutput.textContent = `제스처 시작 (모드: 모음, 중앙 원형)`;
        }
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
        
        const DRAG_THRESHOLD = 8; 

        if (!isDragging && distFromStart >= DRAG_THRESHOLD) {   
            isDragging = true;
            
            // 모음 복합 조합을 위한 로직 (기존 유지)
            if (!isConsonantModeActive) {
                let angle = Math.atan2(deltaY_start, deltaX_start) * (180 / Math.PI);
                if (angle < 0) angle += 360;
                const initial8Dir = getDirectionStringFromAngle(angle);
                inputSequence = [initial8Dir]; // 드래그 시작 방향 기록
            }
        }
        
        // ⭐ 모음 복합조합 감지 로직 (handleMove) - K의 복합 모음 입력 문제 해결 핵심 ⭐
        if (!isConsonantModeActive && isDragging) {
            const deltaX_current = currentX - prevX; // 이전 점 대비 이동 거리
            const deltaY_current = currentY - prevY; // 이전 점 대비 이동 거리
            const distFromPrev = Math.sqrt(deltaX_current * deltaX_current + deltaY_current * deltaY_current);

            if (distFromPrev > DRAG_THRESHOLD / 2) { // 충분히 움직였을 때만 방향 감지
                let currentSegmentAngle = Math.atan2(deltaY_current, deltaX_current) * (180 / Math.PI);
                if (currentSegmentAngle < 0) currentSegmentAngle += 360;

                const current8Dir = getDirectionStringFromAngle(currentSegmentAngle);

                // 새로운 방향이 감지되면 inputSequence에 추가 (최대 3단계)
                if (inputSequence.length === 0 || inputSequence[inputSequence.length - 1] !== current8Dir) {
                    if (inputSequence.length < 3) { // 최대 3단계 꺾임 (총 3방향까지)
                        inputSequence.push(current8Dir);
                        debugOutput.textContent = `모음 드래그 시퀀스: ${inputSequence.join(' -> ')}`;
                    }
                }
            }
        }
        // ⭐ prevX, prevY 업데이트 (handleMove에서 중요!) ⭐
        // 이 부분 누락 시 모음 드래그 시퀀스 인식이 안 됨.
        prevX = currentX;
        prevY = currentY;
    }

    function handleEnd(e) {
        if (!isGestureActive) return;

        // ⭐ 더블 탭이 이미 처리되었으면, 이 handleEnd는 무시 ⭐
        if (isDoubleTapHandledThisCycle) {
            debugOutput.textContent += ` (더블 탭 처리 완료, handleEnd 무시됨)`;
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
        
        let charToProcess = null; 

        if (isConsonantModeActive) { 
            if (totalDragDistance < DRAG_DISTANCE_THRESHOLD) { // 탭으로 간주될 만한 경우
                handleTap(e, totalDragDistance, duration); 
            } else { // 드래그
                handleConsonantDrag(initialConsonantZone); 
            }
        } else { // 모음 모드
            if (totalDragDistance < DRAG_DISTANCE_THRESHOLD) { // 탭으로 간주될 만한 경우 (스페이스바 또는 단일 모음)
                handleTap(e, totalDragDistance, duration);
            } else { // 모음 드래그 (복합 모음 포함)
                // ⭐ 모음 드래그 로직 (정확한 복합 모음 매핑) - K의 복합 모음 입력 문제 해결 핵심 ⭐
                if (inputSequence.length === 3) { 
                    const firstDir = inputSequence[0];
                    const secondDir = inputSequence[1]; 
                    const thirdDir = inputSequence[2]; 
                    const key = `${firstDir}_${secondDir}_${thirdDir}`; 
                    charToProcess = DIRECTIONS.multi_complex_vowel_transitions[key];
                    debugOutput.textContent += ` (3단계 패턴 시도: ${key})`;
                    if (!charToProcess) { // 3단계 실패 시 2단계로 재시도 (백업)
                        const key2 = `${firstDir}_${secondDir}`;
                        charToProcess = DIRECTIONS.complex_vowel_transitions[key2];
                        debugOutput.textContent += ` (3단계 실패, 2단계 패턴 시도: ${key2})`;
                    }
                } else if (inputSequence.length === 2) { 
                    const firstDir = inputSequence[0];
                    const secondDir = inputSequence[1];
                    const key = `${firstDir}_${secondDir}`;
                    charToProcess = DIRECTIONS.complex_vowel_transitions[key];
                    debugOutput.textContent += ` (2단계 패턴 시도: ${key})`;
                    if (!charToProcess) { // 'ㅢ' 특수 인식 (오른손/왼손잡이)
                         if (rightHandRadio.checked && firstDir === 'down-left' && secondDir === 'up-right') {
                            charToProcess = 'ㅢ';
                            debugOutput.textContent += ` (오른손잡이 'ㅢ' 특수 인식)`;
                         } 
                         else if (leftHandRadio.checked && firstDir === 'down-right' && secondDir === 'up-left') {
                            charToProcess = 'ㅢ';
                            debugOutput.textContent += ` (왼손잡이 'ㅢ' 특수 인식)`;
                         }
                    }
                } else if (inputSequence.length === 1) {
                    charToProcess = getPrimaryVowelChar(inputSequence[0]);
                    debugOutput.textContent += ` (1단계 패턴 시도: ${inputSequence[0]})`;
                }

                if (charToProcess) {
                    processInputAndSetTimer(charToProcess, 'vowel', totalDragDistance, `gesture: ${inputSequence.join('->')}`);
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

        const currentTime = Date.now();

        if (!isConsonantModeActive) { // 모음 모드
            // ⭐ 모음 모드 탭 시, 스페이스바가 아닌 해당 모음이 출력되도록 수정 ⭐
            const tappedVowelChar = getPrimaryVowelChar(tapDirection); // 탭 방향으로 기본 모음 가져오기
            if (tappedVowelChar) {
                processInputAndSetTimer(tappedVowelChar, 'vowel', totalDragDistance, `tap-vowel-${tapDirection}`);
            } else { // 기본 모음에 해당하지 않으면 스페이스바 처리
                processInputAndSetTimer(' ', 'vowel', totalDragDistance, 'tap-space'); 
            }
            // 탭 후에는 탭 관련 변수 초기화
            lastTapTime = 0; 
            lastTapDirection = null;
            lastTapStartX = 0;
            lastTapStartY = 0;
            return; 
        } 
        // 자음 모드 (사각형 바깥) 탭 = 싱글/더블 탭
        else { 
            // ⭐ 더블 탭 로직:
            if (lastTapDirection === tapDirection && 
                (currentTime - lastTapTime < TAP_DURATION_THRESHOLD) &&
                (Math.abs(startX - lastTapStartX) < DOUBLE_TAP_DISTANCE_THRESHOLD * 2) && 
                (Math.abs(startY - lastTapStartY) < DOUBLE_TAP_DISTANCE_THRESHOLD * 2)
            ) { 
                // 더블 탭 감지!
                isDoubleTapHandledThisCycle = true; // 현재 사이클에서 더블 탭이 처리되었음을 표시 (중요)
                
                // K의 지시: 'ㅉ', 'ㄸ', 'ㅃ'도 ㄲ, ㅆ처럼 이전 단일 자음 삭제 후 대체 (강화된 로직)
                let currentText = kkotipInput.value;
                let cursorPos = kkotipInput.selectionStart;
                
                // 현재 탭 방향의 싱글 탭 자음을 가져옴 (예: 'ㅈ' 방향에서 'ㅉ' 더블 탭 시 싱글 탭 자음은 'ㅈ')
                const singleTapCharForDirection = DIRECTIONS.consonant[tapDirection]?.char; 

                // 직전 글자가 한글 완성형이 아니고, 단독 초성이며, 해당 방향의 싱글 탭 자음과 일치할 때
                if (cursorPos > 0 && currentText.slice(cursorPos - 1, cursorPos) === singleTapCharForDirection) {
                    // 직전의 단독 초성을 삭제 (예: 'ㅈ'을 지움)
                    kkotipInput.value = currentText.slice(0, cursorPos - 1);
                    kkotipInput.selectionStart = cursorPos - 1;
                    kkotipInput.selectionEnd = cursorPos - 1;
                }
                
                handleConsonantDoubleTap(tapDirection); 
                // 더블 탭 후 모든 탭 관련 상태 초기화 (다음 탭이 싱글 탭으로 시작하도록)
                lastTapTime = 0; 
                lastTapDirection = null;
                lastTapStartX = 0;
                lastTapStartY = 0;
            } else { 
                // 싱글 탭
                handleConsonantSingleTap(tapDirection); 
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
        touchStartTime = 0;
        initialConsonantZone = null; 
        inputSequence = []; 
        isDoubleTapHandledThisCycle = false; // 새로운 제스처 시작 시 플래그 초기화
        // lastTapTime 등은 handleTap 내에서만 제어
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
        if (isGestureActive) { 
            handleEnd(e);
        }
    });

    refreshButton.addEventListener('click', () => {
        window.location.reload(); 
    });

    // deleteButton은 index.html에 없으므로, 실제 구현하려면 HTML도 수정해야 함.
    // 기존 백스페이스 로직은 한글 조합 규칙을 따르므로 K의 "타자기" 의도와 다를 수 있음.
    // 여기서는 일단 주석 처리 상태로 유지. 필요시 K의 지시에 따라 구현.
    /*
    deleteButton.addEventListener('click', () => {
        let currentText = kkotipInput.value;
        let cursorPos = kkotipInput.selectionStart;

        if (inputTimeoutId) {
            clearTimeout(inputTimeoutId);
            inputTimeoutId = null;
            combineLastInputtedHangul(); 
        } else {
            resetCombination(); 
        }

        if (cursorPos > 0) {
            // 한글 분해/조합 로직을 이용한 삭제
            let charToDelete = currentText.substring(cursorPos - 1, cursorPos);
            let disassembled = disassembleHangul(charToDelete);

            if (disassembled && disassembled.isHangul) { 
                if (disassembled.jongIndex !== 0) { 
                    let remainingJong = ''; 
                    const splitJong = splitComplexJongsung(disassembled.jong);

                    if (splitJong) { 
                        remainingJong = splitJong[0]; 
                        currentCho = disassembled.choIndex;
                        currentJung = disassembled.jungIndex;
                        currentJong = getCharIndex(remainingJong, 'jong'); 
                        let reCombined = combineHangul(); 
                        kkotipInput.value = currentText.substring(0, cursorPos - 1) + reCombined + currentText.substring(cursorPos);
                        resetCombination(); 
                    } else { 
                        currentCho = disassembled.choIndex;
                        currentJung = disassembled.jungIndex;
                        currentJong = 0; 
                        let reCombined = combineHangul(); 
                        kkotipInput.value = currentText.substring(0, cursorPos - 1) + reCombined + currentText.substring(cursorPos);
                        resetCombination(); 
                    }
                } else { 
                    currentCho = disassembled.choIndex;
                    currentJung = -1; 
                    currentJong = -1; 
                    kkotipInput.value = currentText.substring(0, cursorPos - 1) + CHOSUNG[currentCho] + currentText.substring(cursorPos); 
                    resetCombination(); 
                }
            } else if (disassembled && (disassembled.choIndex !== -1 || disassembled.jungIndex !== -1 || disassembled.jongIndex !== -1)) {
                kkotipInput.value = currentText.substring(0, cursorPos - 1) + currentText.substring(cursorPos);
                resetCombination();
            } else { 
                kkotipInput.value = currentText.substring(0, cursorPos - 1) + currentText.substring(cursorPos);
                resetCombination(); 
            }
            
            cursorPos--; 
            kkotipInput.selectionStart = cursorPos; 
            kkotipInput.selectionEnd = cursorPos;
            kkotipInput.focus(); 
            debugOutput.textContent = `백스페이스: 커서 위치 ${cursorPos}에서 삭제`;

        } else {
            debugOutput.textContent = `백스페이스: 삭제할 글자 없음`;
        }
    });
    */
});