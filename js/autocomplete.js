// ================================================================
//  TAGS AUTOCOMPLETE SERVICE
// ================================================================
let activeDropdown = null;
let activeIndex = -1;
let currentInput = null;
let currentMatchStart = -1;

function fetchTagsAPI() {
    return window.CURRICULUM_TAGS || {};
}

function getUserSubject() {
    return localStorage.getItem('userSubject') || '';
}

function getFilteredTags(query) {
    const tagsData = fetchTagsAPI();
    const rawSubject = getUserSubject().trim().toLowerCase();
    
    let subjectTags = [];
    let otherTags = [];
    
    Object.keys(tagsData).forEach(key => {
        if (key.toLowerCase() === rawSubject) {
            subjectTags = tagsData[key];
        } else {
            otherTags = otherTags.concat(tagsData[key]);
        }
    });
    
    otherTags = Array.from(new Set(otherTags)).filter(t => !subjectTags.includes(t));
    
    if (!query) {
        // If empty query, show subject tags if available, otherwise show all
        return subjectTags.length > 0 ? subjectTags : [...subjectTags, ...otherTags];
    }
    
    const lowerQuery = query.toLowerCase();
    
    // Prioritize registered subject matches, then search other subjects
    const subjectMatches = subjectTags.filter(t => t.toLowerCase().includes(lowerQuery));
    const otherMatches = otherTags.filter(t => t.toLowerCase().includes(lowerQuery));
    
    return [...subjectMatches, ...otherMatches];
}

function removeDropdown() {
    if (activeDropdown) {
        activeDropdown.remove();
        activeDropdown = null;
    }
    activeIndex = -1;
    currentInput = null;
    currentMatchStart = -1;
}

function positionDropdown(input, dropdown) {
    const rect = input.getBoundingClientRect();
    const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft;
    const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
    
    // Position just below the input field
    dropdown.style.left = `${rect.left + scrollLeft}px`;
    dropdown.style.top = `${rect.bottom + scrollTop + 4}px`;
    dropdown.style.width = `${Math.max(rect.width, 200)}px`;
}

function handleTagAutocompleteInput(input) {
    const cursorPos = input.selectionStart;
    const textBeforeCursor = input.value.substring(0, cursorPos);
    
    // Match # followed by word characters (or Telugu/Unicode chars) up to the cursor
    const match = textBeforeCursor.match(/#([^\s#]*)$/);
    
    if (!match) {
        removeDropdown();
        return;
    }
    
    const query = match[1];
    currentInput = input;
    currentMatchStart = cursorPos - match[0].length;
    
    const filteredTags = getFilteredTags(query);
    
    if (filteredTags.length === 0) {
        removeDropdown();
        return;
    }
    
    if (!activeDropdown) {
        activeDropdown = document.createElement('div');
        activeDropdown.className = 'autocomplete-dropdown';
        document.body.appendChild(activeDropdown);
    }
    
    activeDropdown.innerHTML = '';
    activeIndex = 0;
    
    filteredTags.forEach((tag, idx) => {
        const item = document.createElement('div');
        item.className = 'autocomplete-item' + (idx === 0 ? ' active' : '');
        item.textContent = `#${tag}`;
        item.addEventListener('click', () => {
            selectTag(tag);
        });
        activeDropdown.appendChild(item);
    });
    
    positionDropdown(input, activeDropdown);
}

function selectTag(tag) {
    if (!currentInput || currentMatchStart === -1) return;
    
    const input = currentInput;
    const val = input.value;
    const cursorPos = input.selectionStart;
    
    // Replace from currentMatchStart to cursorPos with the selected tag
    const before = val.substring(0, currentMatchStart);
    const after = val.substring(cursorPos);
    
    input.value = `${before}#${tag} ${after}`;
    
    // Put cursor right after the tag and space
    const newCursorPos = currentMatchStart + tag.length + 2;
    input.setSelectionRange(newCursorPos, newCursorPos);
    
    removeDropdown();
    input.focus();
    
    // Trigger input event to make sure any height auto-adjust or change listeners run
    input.dispatchEvent(new Event('input', { bubbles: true }));
}

function handleTagAutocompleteKeydown(e, input) {
    if (!activeDropdown) return;
    
    const items = activeDropdown.querySelectorAll('.autocomplete-item');
    if (items.length === 0) return;
    
    if (e.key === 'ArrowDown') {
        e.preventDefault();
        items[activeIndex].classList.remove('active');
        activeIndex = (activeIndex + 1) % items.length;
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        items[activeIndex].classList.remove('active');
        activeIndex = (activeIndex - 1 + items.length) % items.length;
        items[activeIndex].classList.add('active');
        items[activeIndex].scrollIntoView({ block: 'nearest' });
    } else if (e.key === 'Enter' || e.key === 'Tab') {
        e.preventDefault();
        const activeItem = items[activeIndex];
        if (activeItem) {
            // Extract the tag name (remove leading #)
            const tag = activeItem.textContent.substring(1);
            selectTag(tag);
        }
    } else if (e.key === 'Escape') {
        e.preventDefault();
        removeDropdown();
    }
}

// Global Event Listeners using Delegation
document.addEventListener('input', function(e) {
    if (e.target.classList.contains('daily-work') || e.target.classList.contains('daily-home')) {
        handleTagAutocompleteInput(e.target);
    }
});

document.addEventListener('keydown', function(e) {
    if (e.target.classList.contains('daily-work') || e.target.classList.contains('daily-home')) {
        handleTagAutocompleteKeydown(e, e.target);
    }
});

// Close dropdown on click outside
document.addEventListener('click', function(e) {
    if (activeDropdown && !activeDropdown.contains(e.target) && e.target !== currentInput) {
        removeDropdown();
    }
});
