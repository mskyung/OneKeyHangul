document.addEventListener('DOMContentLoaded', () => {
    const kkotipInput = document.getElementById('kkotipInput');
    const inputButtonContainer = document.getElementById('inputButtons');
    const mainInputButton = document.getElementById('mainInputButton');
    const refreshButton = document.getElementById('refreshButton');
    const debugOutput = document.getElementById('debugOutput');
    const rightHandRadio = document.getElementById('rightHand');
    const leftHandRadio = document.getElementById('leftHand');
	const deleteButton = document.getElementById('deleteButton'); 
	let rawBuffer = '';   
	let tapTimer = null;  
	    
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
            'up-left': { angle: [202.5, 247.5], char: 'ㅈ', doubleTapChar: 'ㅉ', dragChar: '!' }, 
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
            'up_down-right_down': 'ㅙ', 

            'down_left_up': 'ㅞ',  
            'down_up-left_up': 'ㅞ'  
        }
    };
	
    const CHO = ['ㄱ','ㄲ','ㄴ','ㄷ','ㄸ','ㄹ','ㅁ','ㅂ','ㅃ','ㅅ','ㅆ','ㅇ','ㅈ','ㅉ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
    const JUNG = ['ㅏ','ㅐ','ㅑ','ㅒ','ㅓ','ㅔ','ㅕ','ㅖ','ㅗ','ㅘ','ㅙ','ㅚ','ㅛ','ㅜ','ㅝ','ㅞ','ㅟ','ㅠ','ㅡ','ㅢ','ㅣ'];
    const JONG = ['', 'ㄱ','ㄲ','ㄳ','ㄴ','ㄵ','ㄶ','ㄷ','ㄹ','ㄺ','ㄻ','ㄼ','ㄽ','ㄾ','ㄿ','ㅀ','ㅁ','ㅂ','ㅄ','ㅅ','ㅆ','ㅇ','ㅈ','ㅊ','ㅋ','ㅌ','ㅍ','ㅎ'];
	
    const DOUBLE_CONSONANTS = {
        'ㄱ': 'ㄲ', 'ㄷ': 'ㄸ', 'ㅂ': 'ㅃ', 'ㅅ': 'ㅆ', 'ㅈ': 'ㅉ'
    };
	
    function isCho(char) { return CHO.includes(char); }
    function isJung(char) { return JUNG.includes(char); }
    function isJong(char) { return JONG.includes(char); }
	
    function appendCharToBuffer(char) {
        rawBuffer += char;
        kkotipInput.value = combineSmartHangul(rawBuffer); 
    }
	
    function deleteLastCharFromBuffer() {
        rawBuffer = rawBuffer.slice(0, -1);
		kkotipInput.value = combineSmartHangul(rawBuffer);
    }

    function combineSmartHangul(buffer) {
        const result = [];
        let i = 0;

        while (i < buffer.length) {
            const ch1 = buffer[i];
            const ch2 = buffer[i + 1];
            const ch3 = buffer[i + 2];

            const choIdx = CHO.indexOf(ch1);
            const jungIdx = JUNG.indexOf(ch2);

            if (choIdx !== -1 && jungIdx !== -1) {
                // 초성 + 중성
                let jongIdx = 0;
                let nextChar = buffer[i + 3];
                if (isCho(ch3) && isJung(nextChar)) {
                    // 종성을 다음 글자 초성으로 이동해야 할 경우
                    result.push(makeHangul(choIdx, jungIdx, 0));
                    i += 2;
                    continue;
                }
                if (ch3 && (jongIdx = JONG.indexOf(ch3)) > 0) {
                    result.push(makeHangul(choIdx, jungIdx, jongIdx));
                    i += 3;
                } else {
                    result.push(makeHangul(choIdx, jungIdx, 0));
                    i += 2;
                }
            } else {
                result.push(ch1);
                i += 1;
            }
        }

        return result.join('');
    }

    function makeHangul(cho, jung, jong) {
        const code = 0xAC00 + (cho * 21 * 28) + (jung * 28) + jong;
        return String.fromCharCode(code);
    }

	//function handleConsonantTap(direction) {
	//	const singleChar = DIRECTIONS.consonant[direction]?.char;
	//	if (!singleChar) return;

	//	if (tapTimer === null) {
	//		tapTimer = setTimeout(() => {
	//			// 👉 싱글탭이 더블탭에 의해 무효화됐는지 한 번 더 확인
	//			if (isDoubleTapHandledThisCycle) {
	//				tapTimer = null; // 이미 더블탭 처리된 경우, 싱글 입력 무시
	//				return;
	//			}
	//			appendCharToInput(singleChar);
	//			debugOutput.textContent = `싱글탭 입력: ${singleChar}`;
	//			tapTimer = null;
	//		}, 250);
	//	} else {
	//		clearTimeout(tapTimer);
	//		tapTimer = null;
	//		// 더블탭은 handleTap에서 처리됨
	//	}
	//}
	
	function handleConsonantTap(direction) {
		const singleChar = DIRECTIONS.consonant[direction]?.char;
		if (!singleChar) return;

		if (tapTimer === null) {
			let handled = false;
			const localTapTime = Date.now();  // 이 시점에서의 기준을 저장

			tapTimer = setTimeout(() => {
				if (isDoubleTapHandledThisCycle || handled) {
					tapTimer = null;
					return;
				}
				appendCharToInput(singleChar);
				debugOutput.textContent = `싱글탭 입력: ${singleChar}`;
				tapTimer = null;
			}, 250);

			// 더블탭이 감지되면 handled = true로 설정되도록
			setTimeout(() => {
				handled = isDoubleTapHandledThisCycle;
			}, 0);
		} else {
			clearTimeout(tapTimer);
			tapTimer = null;
			// 더블탭은 handleTap에서만 처리
		}
	}
	
	
    deleteButton.addEventListener('click', () => {
        deleteLastCharFromBuffer();
    });
	
    // 추가 유틸리티 함수 (조합 기능과 무관한 것만 유지)
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
    
    // 입력된 문자를 그대로 텍스트 에어리어에 추가하는 핵심 함수
    function appendCharToInput(char) {
        let currentText = kkotipInput.value;
        let cursorPos = kkotipInput.selectionStart;

        if (cursorPos < currentText.length) { // 커서가 중간에 있으면 해당 위치에 삽입
            kkotipInput.value = currentText.substring(0, cursorPos) + char + currentText.substring(cursorPos);
            kkotipInput.selectionStart = cursorPos + char.length;
            kkotipInput.selectionEnd = cursorPos + char.length;
        } else { // 커서가 맨 뒤에 있으면 그냥 추가
            //rawBuffer += char;		
			//kkotipInput.value = combineSmartHangul(rawBuffer);   
            appendCharToBuffer(char);
			kkotipInput.selectionStart = kkotipInput.value.length;
            kkotipInput.selectionEnd = kkotipInput.value.length;
        }
        kkotipInput.focus(); // 입력 후 포커스 유지
    }

    // --- 세 가지 자음 입력 함수 ---
    function handleConsonantSingleTap(direction) {
        const charToInput = DIRECTIONS.consonant[direction]?.char;
        if (charToInput) {
            // 조합 로직 없이 직접 출력
            appendCharToInput(charToInput); 
            debugOutput.textContent = `싱글 탭 입력: ${charToInput}`;
        } else {
            debugOutput.textContent = `싱글 탭 오류: ${direction} 방향에 해당하는 자음을 찾을 수 없음`;
        }
    }

    function handleConsonantDoubleTap(direction) {
        const charToInput = DIRECTIONS.consonant[direction]?.doubleTapChar;
        if (charToInput) {
            // 조합 로직 없이 직접 출력
            appendCharToInput(charToInput); 
            debugOutput.textContent = `더블 탭 입력: ${charToInput}`;
        } else {
            debugOutput.textContent = `더블 탭 오류: ${direction} 방향에 해당하는 자음을 찾을 수 없음`;
        }
    }

    function handleConsonantDrag(direction) {
        const charToInput = DIRECTIONS.consonant[direction]?.dragChar;
        if (charToInput) {
            // 조합 로직 없이 직접 출력
            appendCharToInput(charToInput); 
            debugOutput.textContent = `드래그 입력: ${charToInput}`;
        } else {
            debugOutput.textContent = `드래그 오류: ${direction} 방향에 해당하는 자음을 찾을 수 없음`;
        }
    }

    // --- 실제 입력 처리를 담당하는 함수 (모든 조합 로직 제거, appendCharToInput 직접 호출) ---
    function processInputAndSetTimer(char, finalInputType, totalDragDistance, inputSequenceDebug) {
        // 커서가 중간에 있으면, 조합 로직 무시하고 단순히 삽입
        let currentText = kkotipInput.value;
        let cursorPos = kkotipInput.selectionStart;

        // 항상 입력된 char를 그대로 append
        appendCharToInput(char);
        debugOutput.textContent = `입력 완료 (${finalInputType}): ${char} (총 거리: ${totalDragDistance.toFixed(0)}px, 시퀀스: ${inputSequenceDebug})`;
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
        
        // 모음 복합조합 감지 로직 (handleMove)
        if (!isConsonantModeActive && isDragging) {
            const deltaX_current = currentX - prevX; 
            const deltaY_current = currentY - prevY; 
            const distFromPrev = Math.sqrt(deltaX_current * deltaX_current + deltaY_current * deltaY_current);

            if (distFromPrev > DRAG_THRESHOLD / 2) { 
                let currentSegmentAngle = Math.atan2(deltaY_current, deltaX_current) * (180 / Math.PI);
                if (currentSegmentAngle < 0) currentSegmentAngle += 360;

                const current8Dir = getDirectionStringFromAngle(currentSegmentAngle);

                if (inputSequence.length === 0 || inputSequence[inputSequence.length - 1] !== current8Dir) {
                    if (inputSequence.length < 3) { 
                        inputSequence.push(current8Dir);
                        debugOutput.textContent = `모음 드래그 시퀀스: ${inputSequence.join(' -> ')}`;
                    }
                }
            }
        }
        prevX = currentX;
        prevY = currentY;
    }

    function handleEnd(e) {
        if (!isGestureActive) return;

        // 더블 탭이 이미 처리되었으면, 이 handleEnd는 무시
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
            if (totalDragDistance < DRAG_DISTANCE_THRESHOLD) { 
                handleTap(e, totalDragDistance, duration); 
            } else { 
                handleConsonantDrag(initialConsonantZone); 
            }
        } else { // 모음 모드
            if (totalDragDistance < DRAG_DISTANCE_THRESHOLD) { 
                handleTap(e, totalDragDistance, duration);
            } else { 
                // 모음 드래그 로직 (정확한 복합 모음 매핑)
                if (inputSequence.length === 3) { 
                    const firstDir = inputSequence[0];
                    const secondDir = inputSequence[1]; 
                    const thirdDir = inputSequence[2]; 
                    const key = `${firstDir}_${secondDir}_${thirdDir}`; 
                    charToProcess = DIRECTIONS.multi_complex_vowel_transitions[key];
                    debugOutput.textContent += ` (3단계 패턴 시도: ${key})`;
                    if (!charToProcess) { 
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
                    if (!charToProcess) { 
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
                    // 조합 로직 없이 직접 출력하도록 변경
                    appendCharToInput(charToProcess); 
                    debugOutput.textContent = `모음 드래그 입력: ${charToProcess}`;
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

        if (!isConsonantModeActive) { // 모음 모드 (탭)
            const tappedVowelChar = getPrimaryVowelChar(tapDirection); 
            if (tappedVowelChar) {
                appendCharToInput(tappedVowelChar); // 직접 출력
                debugOutput.textContent = `모음 탭 입력: ${tappedVowelChar}`;
            } else { 
                appendCharToInput(' '); // 직접 출력 (스페이스)
                debugOutput.textContent = `스페이스 입력`;
            }
            lastTapTime = 0; 
            lastTapDirection = null;
            lastTapStartX = 0;
            lastTapStartY = 0;
            return; 
        } 
        // 자음 모드(사각형 바깥) 탭 = 싱글/더블 탭
        else { 
            // 더블 탭 로직:
            if (lastTapDirection === tapDirection && 
                (currentTime - lastTapTime < TAP_DURATION_THRESHOLD) &&
                (Math.abs(startX - lastTapStartX) < DOUBLE_TAP_DISTANCE_THRESHOLD * 2) && 
                (Math.abs(startY - lastTapStartY) < DOUBLE_TAP_DISTANCE_THRESHOLD * 2)
            ) { 
                // 더블 탭 감지!
                isDoubleTapHandledThisCycle = true; 
                
				const currentText = kkotipInput.value;
				const cursorPos = kkotipInput.selectionStart;
				const singleChar = DIRECTIONS.consonant[tapDirection]?.char;
				const doubleChar = DIRECTIONS.consonant[tapDirection]?.doubleTapChar;
				
            //    let currentText = kkotipInput.value;
            //    let cursorPos = kkotipInput.selectionStart;
            //    const singleTapCharForDirection = DIRECTIONS.consonant[tapDirection]?.char; 

                // 직전 글자가 싱글 자음이면 삭제 
                if (cursorPos > 0 && currentText.slice(cursorPos - 1, cursorPos) === singleChar) {
                    kkotipInput.value = currentText.slice(0, cursorPos - 1);
                    kkotipInput.selectionStart = cursorPos - 1;
                    kkotipInput.selectionEnd = cursorPos - 1;
				}	
				if (rawBuffer.endsWith(singleChar)) {
					rawBuffer = rawBuffer.slice(0, -1);
                }
                
				appendCharToInput(doubleChar);  // ✅ 정확히 여기서만 입력
				debugOutput.textContent = `더블탭 입력: ${doubleChar}`;
				
                lastTapTime = 0; 
                lastTapDirection = null;
                lastTapStartX = 0;
                lastTapStartY = 0;
            } else { 
				handleConsonantTap(tapDirection); 
                lastTapTime = currentTime; 
                lastTapDirection = tapDirection;
                lastTapStartX = startX;
                lastTapStartY = startY;
            }
			return;
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
        isDoubleTapHandledThisCycle = false; 
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
});