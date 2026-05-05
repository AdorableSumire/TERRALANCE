const TAG_GROUPS = [
    {
        label: "Class",
        tags: ["Guard", "Sniper", "Defender", "Medic", "Supporter", "Caster", "Specialist", "Vanguard"]
    },
    {
        label: "Position",
        tags: ["Melee", "Ranged"]
    },
    {
        label: "Qualification",
        tags: ["Starter", "Senior Operator", "Top Operator"]
    },
    {
        label: "Affix",
        tags: [
            "Crowd Control",
            "Nuker",
            "Healing",
            "Support",
            "DP-Recovery",
            "DPS",
            "Survival",
            "AOE",
            "Defense",
            "Slow",
            "Debuff",
            "Fast Redeploy",
            "Shift",
            "Summon",
            "Robot",
            "Elemental",
            "Soar"
        ]
    }
];

const RARITY_ORDER = [6, 5, 4, 3, 2, 1];
const RARITY_LABELS = {
    6: "6*",
    5: "5*",
    4: "4*",
    3: "3*",
    2: "2*",
    1: "1*"
};
const RARITY_COLORS = {
    6: "rgb(255, 102, 0)",
    5: "rgb(255, 174, 0)",
    4: "rgb(219, 177, 219)",
    3: "rgb(0, 178, 246)",
    2: "rgb(159, 159, 159)",
    1: "rgb(159, 159, 159)"
};
const MODES = [
    { key: "recruitOnly", label: "Recruit Only" },
    { key: "allOperators", label: "All Operators" }
];
const DISPLAY_OPTIONS = [
    { key: "showName", label: "Name" },
    { key: "showImage", label: "Image" }
];
const MAX_TAGS = 6;

const operators = (window.AKHR_OPERATOR_DATA || [])
    .filter((operator) => Number.isInteger(operator.rarity) && operator.rarity >= 1 && operator.rarity <= 6)
    .map((operator) => ({
        ...operator,
        tags: Array.isArray(operator.tags) ? [...new Set(operator.tags)] : [],
        searchName: operator.name.toLowerCase()
    }));

const state = {
    selectedTags: [],
    rarity: new Set(RARITY_ORDER),
    mode: "recruitOnly",
    ignoreLowRarity: false,
    showName: true,
    showImage: true,
    imageSize: 72
};

const selectedCount = document.getElementById("selectedCount");
const selectedTagList = document.getElementById("selectedTagList");
const clearTagsBtn = document.getElementById("clearTagsBtn");
const tagGroupsRoot = document.getElementById("tagGroups");
const rarityFiltersRoot = document.getElementById("rarityFilters");
const modeFiltersRoot = document.getElementById("modeFilters");
const displayTogglesRoot = document.getElementById("displayToggles");
const ignoreLowRarityInput = document.getElementById("ignoreLowRarity");
const imageSizeRange = document.getElementById("imageSizeRange");
const imageSizeNumber = document.getElementById("imageSizeNumber");
const resultSummary = document.getElementById("resultSummary");
const resultList = document.getElementById("resultList");
const IMAGE_EXTENSIONS = [".png", ".jpg", ".jpeg", ".webp"];

function escapeHtml(value) {
    return String(value)
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;");
}

function initialsFromName(name) {
    return name
        .replace(/['".]/g, "")
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0]?.toUpperCase() || "")
        .join("");
}

function getImageCandidates(operator) {
    const candidates = [];

    if (operator.imageLocalBase) {
        IMAGE_EXTENSIONS.forEach((extension) => {
            candidates.push(`${operator.imageLocalBase}${extension}`);
        });
    }

    if (operator.imageRemote) {
        candidates.push(operator.imageRemote);
    } else if (operator.image) {
        candidates.push(operator.image);
    }

    return [...new Set(candidates.filter(Boolean))];
}

function buildFallbackMarkup(operator) {
    return `<div class="operator-fallback">${escapeHtml(initialsFromName(operator.name))}</div>`;
}

function bindOperatorImages() {
    resultList.querySelectorAll(".operator-image").forEach((image) => {
        image.addEventListener("error", () => {
            const rawSources = image.dataset.sources || "[]";
            const sources = JSON.parse(rawSources);
            const nextIndex = Number(image.dataset.sourceIndex || "0") + 1;

            if (nextIndex < sources.length) {
                image.dataset.sourceIndex = String(nextIndex);
                image.src = sources[nextIndex];
                return;
            }

            const container = image.closest(".operator-card");
            if (!container) return;
            image.remove();
            container.insertAdjacentHTML("afterbegin", container.dataset.fallback || "");
        }, { once: false });
    });
}

function isTagSelected(tag) {
    return state.selectedTags.includes(tag);
}

function toggleTag(tag) {
    if (isTagSelected(tag)) {
        state.selectedTags = state.selectedTags.filter((item) => item !== tag);
    } else if (state.selectedTags.length < MAX_TAGS) {
        state.selectedTags = [...state.selectedTags, tag];
    }

    render();
}

function clearTags() {
    state.selectedTags = [];
    render();
}

function toggleRarity(value) {
    if (value === "ALL") {
        if (state.rarity.size === RARITY_ORDER.length) {
            state.rarity.clear();
        } else {
            state.rarity = new Set(RARITY_ORDER);
        }
        render();
        return;
    }

    if (state.rarity.has(value)) {
        state.rarity.delete(value);
    } else {
        state.rarity.add(value);
    }

    render();
}

function setMode(mode) {
    state.mode = mode;
    render();
}

function toggleDisplayOption(key) {
    if (key === "showName" && state.showName && !state.showImage) return;
    if (key === "showImage" && state.showImage && !state.showName) return;

    state[key] = !state[key];
    render();
}

function setImageSize(value) {
    const normalized = Math.max(20, Math.min(128, Number(value) || 72));
    state.imageSize = normalized;
    imageSizeRange.value = String(normalized);
    imageSizeNumber.value = String(normalized);
    renderResults();
}

function getVisibleOperators() {
    let pool = operators;

    if (state.mode === "recruitOnly") {
        pool = pool.filter((operator) => operator.recruitable);
    }

    if (state.ignoreLowRarity) {
        pool = pool.filter((operator) => operator.rarity !== 2 && operator.rarity !== 3);
    }

    if (state.rarity.size > 0) {
        pool = pool.filter((operator) => state.rarity.has(operator.rarity));
    } else {
        pool = [];
    }

    return pool;
}

function createCombinations(source, size, start = 0, prefix = [], combinations = []) {
    if (prefix.length === size) {
        combinations.push(prefix);
        return combinations;
    }

    for (let index = start; index < source.length; index += 1) {
        createCombinations(source, size, index + 1, [...prefix, source[index]], combinations);
    }

    return combinations;
}

function getResults() {
    if (state.selectedTags.length === 0) return [];

    const pool = getVisibleOperators();
    const rows = [];
    let sequence = 1;

    for (let size = state.selectedTags.length; size >= 1; size -= 1) {
        const combinations = createCombinations(state.selectedTags, size);

        combinations.forEach((tags) => {
            const matches = pool
                .filter((operator) => tags.every((tag) => operator.tags.includes(tag)))
                .sort((left, right) => {
                    if (right.rarity !== left.rarity) return right.rarity - left.rarity;
                    return left.name.localeCompare(right.name);
                });

            if (matches.length === 0) return;

            rows.push({
                id: sequence,
                tags,
                matches
            });
            sequence += 1;
        });
    }

    return rows;
}

function renderTagGroups() {
    tagGroupsRoot.innerHTML = TAG_GROUPS.map((group) => {
        const buttons = group.tags.map((tag) => {
            const isActive = isTagSelected(tag);
            const isDisabled = !isActive && state.selectedTags.length >= MAX_TAGS;

            return `
                <button
                    class="tag-toggle${isActive ? " active" : ""}"
                    type="button"
                    data-tag="${tag}"
                    ${isDisabled ? "disabled" : ""}
                >
                    ${tag}
                </button>
            `;
        }).join("");

        return `
            <div class="tag-group">
                <div class="group-label">${group.label}</div>
                <div class="toggle-grid">${buttons}</div>
            </div>
        `;
    }).join("");

    tagGroupsRoot.querySelectorAll("[data-tag]").forEach((button) => {
        button.addEventListener("click", () => toggleTag(button.dataset.tag));
    });
}

function renderRarityFilters() {
    const allActive = state.rarity.size === RARITY_ORDER.length;
    const allButton = `
        <button class="rarity-toggle${allActive ? " active" : ""}" type="button" data-rarity="ALL">ALL</button>
    `;
    const rarityButtons = RARITY_ORDER.map((rarity) => `
        <button
            class="rarity-toggle${state.rarity.has(rarity) ? " active" : ""}"
            type="button"
            data-rarity="${rarity}"
        >
            ${RARITY_LABELS[rarity]}
        </button>
    `).join("");

    rarityFiltersRoot.innerHTML = allButton + rarityButtons;

    rarityFiltersRoot.querySelectorAll("[data-rarity]").forEach((button) => {
        button.addEventListener("click", () => {
            const value = button.dataset.rarity === "ALL" ? "ALL" : Number(button.dataset.rarity);
            toggleRarity(value);
        });
    });
}

function renderModeFilters() {
    modeFiltersRoot.innerHTML = MODES.map((mode) => `
        <button class="mode-toggle${state.mode === mode.key ? " active" : ""}" type="button" data-mode="${mode.key}">
            ${mode.label}
        </button>
    `).join("");

    modeFiltersRoot.querySelectorAll("[data-mode]").forEach((button) => {
        button.addEventListener("click", () => setMode(button.dataset.mode));
    });
}

function renderDisplayToggles() {
    displayTogglesRoot.innerHTML = DISPLAY_OPTIONS.map((option) => `
        <button
            class="display-toggle${state[option.key] ? " active" : ""}"
            type="button"
            data-display="${option.key}"
        >
            ${option.label}
        </button>
    `).join("");

    displayTogglesRoot.querySelectorAll("[data-display]").forEach((button) => {
        button.addEventListener("click", () => toggleDisplayOption(button.dataset.display));
    });
}

function renderSelectionBar() {
    const count = state.selectedTags.length;
    selectedCount.textContent = `${count} / ${MAX_TAGS} tags selected`;

    if (count === 0) {
        selectedTagList.className = "selected-tag-list empty";
        selectedTagList.textContent = "No tags selected yet.";
    } else {
        selectedTagList.className = "selected-tag-list";
        selectedTagList.innerHTML = state.selectedTags
            .map((tag) => `<span class="selected-tag-chip">${escapeHtml(tag)}</span>`)
            .join("");
    }

    clearTagsBtn.disabled = count === 0;
    clearTagsBtn.textContent = count === MAX_TAGS
        ? `Clear ${count} [MAX] Tags`
        : `Clear ${count} Tags`;
}

function renderOperatorCard(operator) {
    const showImage = state.showImage;
    const showName = state.showName;
    const rarityLabel = RARITY_LABELS[operator.rarity] || `${operator.rarity}*`;
    const cardClass = `${showImage ? "" : " name-only"}${showName ? "" : " image-only"}`;
    const imageCandidates = getImageCandidates(operator);
    const fallbackMarkup = buildFallbackMarkup(operator);

    let imageMarkup = "";
    if (showImage) {
        imageMarkup = imageCandidates.length
            ? `<img class="operator-image" src="${escapeHtml(imageCandidates[0])}" alt="${escapeHtml(operator.name)}" data-sources='${escapeHtml(JSON.stringify(imageCandidates))}' data-source-index="0">`
            : fallbackMarkup;
    }

    let copyMarkup = "";
    if (showName) {
        copyMarkup = `
            <div class="operator-copy">
                <div class="operator-name">${escapeHtml(operator.name)}</div>
                <div class="operator-rarity">${rarityLabel}</div>
            </div>
        `;
    }

    return `
        <div class="operator-card${cardClass}" style="--rarity-accent:${RARITY_COLORS[operator.rarity]}; --operator-image-size:${state.imageSize}px;" title="${escapeHtml(operator.name)} (${rarityLabel})" data-fallback='${escapeHtml(fallbackMarkup)}'>
            ${imageMarkup}
            ${copyMarkup}
        </div>
    `;
}

function renderResults() {
    const results = getResults();
    const poolSize = getVisibleOperators().length;

    if (state.selectedTags.length === 0) {
        resultSummary.textContent = "Please select at least one tag.";
        resultList.innerHTML = `<div class="empty-results">Please select at least one tag.</div>`;
        return;
    }

    if (poolSize === 0) {
        resultSummary.textContent = "No operators available under the current rarity and mode filters.";
        resultList.innerHTML = `
            <div class="empty-results">
                No operators are available under the current rarity and mode filters.
            </div>
        `;
        return;
    }

    resultSummary.textContent = `${results.length} matching tag row${results.length === 1 ? "" : "s"} from ${poolSize} operator${poolSize === 1 ? "" : "s"}.`;

    if (results.length === 0) {
        resultList.innerHTML = `
            <div class="empty-results">
                No operator matches your selected tags with the current filters.
            </div>
        `;
        return;
    }

    resultList.innerHTML = results.map((result) => `
        <article class="result-row">
            <div class="result-index">
                <div class="result-number">${result.id}</div>
                <div class="result-count">${result.matches.length} match${result.matches.length === 1 ? "" : "es"}</div>
            </div>
            <div class="result-tags-column">
                <div class="result-tag-list">
                    ${result.tags.map((tag) => `<span class="result-tag">${escapeHtml(tag)}</span>`).join("")}
                </div>
            </div>
            <div class="result-operators-column">
                <div class="operator-list">
                    ${result.matches.map((operator) => renderOperatorCard(operator)).join("")}
                </div>
            </div>
        </article>
    `).join("");

    bindOperatorImages();
}

function render() {
    renderTagGroups();
    renderRarityFilters();
    renderModeFilters();
    renderDisplayToggles();
    renderSelectionBar();
    ignoreLowRarityInput.checked = state.ignoreLowRarity;
    imageSizeRange.value = String(state.imageSize);
    imageSizeNumber.value = String(state.imageSize);
    renderResults();
}

clearTagsBtn.addEventListener("click", clearTags);
ignoreLowRarityInput.addEventListener("change", () => {
    state.ignoreLowRarity = ignoreLowRarityInput.checked;
    renderResults();
});
imageSizeRange.addEventListener("input", () => setImageSize(imageSizeRange.value));
imageSizeNumber.addEventListener("input", () => setImageSize(imageSizeNumber.value));

render();
