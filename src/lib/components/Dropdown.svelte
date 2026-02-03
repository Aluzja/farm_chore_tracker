<script lang="ts">
	type Option = { value: string; label: string };

	interface Props {
		id?: string;
		value: string;
		options: Option[];
		placeholder?: string;
		allowCustom?: boolean;
		required?: boolean;
		onchange?: (value: string) => void;
	}

	let {
		id,
		value = $bindable(),
		options,
		placeholder = 'Select...',
		allowCustom = false,
		required = false,
		onchange
	}: Props = $props();

	let isOpen = $state(false);
	let customInput = $state('');
	let highlightedIndex = $state(-1);
	let containerRef: HTMLDivElement;
	let inputRef: HTMLInputElement;

	// Generate unique listbox ID for aria-controls
	const listboxId = $derived(
		id ? `${id}-listbox` : `dropdown-listbox-${Math.random().toString(36).slice(2, 9)}`
	);

	// Derive the display value from the selected value or custom input
	const displayValue = $derived.by(() => {
		if (allowCustom && customInput) {
			return customInput;
		}
		const option = options.find((o) => o.value === value);
		return option ? option.label : value;
	});

	// Filter options based on input (only for allowCustom mode)
	const filteredOptions = $derived(
		allowCustom && customInput
			? options.filter((o) => o.label.toLowerCase().includes(customInput.toLowerCase()))
			: options
	);

	function selectOption(option: Option) {
		value = option.value;
		customInput = '';
		isOpen = false;
		highlightedIndex = -1;
		onchange?.(option.value);
	}

	function handleInputChange(e: Event) {
		const target = e.target as HTMLInputElement;
		if (allowCustom) {
			customInput = target.value;
			value = target.value;
			onchange?.(target.value);
		}
		isOpen = true;
		highlightedIndex = -1;
	}

	function handleKeydown(e: KeyboardEvent) {
		if (e.key === 'ArrowDown') {
			e.preventDefault();
			isOpen = true;
			highlightedIndex = Math.min(highlightedIndex + 1, filteredOptions.length - 1);
		} else if (e.key === 'ArrowUp') {
			e.preventDefault();
			highlightedIndex = Math.max(highlightedIndex - 1, 0);
		} else if (e.key === 'Enter' && isOpen && highlightedIndex >= 0) {
			e.preventDefault();
			selectOption(filteredOptions[highlightedIndex]);
		} else if (e.key === 'Escape') {
			isOpen = false;
			highlightedIndex = -1;
		} else if (e.key === 'Tab') {
			isOpen = false;
		}
	}

	function handleFocus() {
		isOpen = true;
	}

	function handleBlur() {
		// Delay to allow click on option
		setTimeout(() => {
			if (!containerRef?.contains(document.activeElement)) {
				isOpen = false;
				highlightedIndex = -1;
				customInput = '';
			}
		}, 150);
	}

	function handleTriggerClick() {
		isOpen = !isOpen;
		if (isOpen) {
			inputRef?.focus();
		}
	}
</script>

<div class="dropdown" bind:this={containerRef}>
	<div class="dropdown-input-wrapper">
		<input
			{id}
			type="text"
			class="dropdown-input"
			{placeholder}
			{required}
			readonly={!allowCustom}
			bind:this={inputRef}
			value={displayValue}
			oninput={handleInputChange}
			onfocus={handleFocus}
			onblur={handleBlur}
			onkeydown={handleKeydown}
			role="combobox"
			aria-expanded={isOpen}
			aria-controls={listboxId}
			aria-haspopup="listbox"
			aria-autocomplete={allowCustom ? 'list' : 'none'}
		/>
		<button
			type="button"
			class="dropdown-trigger"
			tabindex="-1"
			onclick={handleTriggerClick}
			aria-label="Toggle dropdown"
		>
			<svg
				class="dropdown-icon"
				class:open={isOpen}
				viewBox="0 0 24 24"
				fill="none"
				stroke="currentColor"
				stroke-width="2"
				stroke-linecap="round"
				stroke-linejoin="round"
			>
				<polyline points="6 9 12 15 18 9"></polyline>
			</svg>
		</button>
	</div>

	{#if isOpen && filteredOptions.length > 0}
		<ul class="dropdown-menu" role="listbox" id={listboxId}>
			{#each filteredOptions as option, index (option.value)}
				<li
					class="dropdown-option"
					class:highlighted={index === highlightedIndex}
					class:selected={option.value === value}
					role="option"
					aria-selected={option.value === value}
					onmousedown={() => selectOption(option)}
					onmouseenter={() => (highlightedIndex = index)}
				>
					{option.label}
				</li>
			{/each}
		</ul>
	{/if}
</div>

<style>
	.dropdown {
		position: relative;
		width: 100%;
	}

	.dropdown-input-wrapper {
		position: relative;
		display: flex;
		align-items: center;
	}

	.dropdown-input {
		width: 100%;
		padding: 0.625rem 2.5rem 0.625rem 0.75rem;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		font-size: 0.9375rem;
		background-color: white;
		color: #111827;
		transition:
			border-color 0.15s,
			box-shadow 0.15s;
		cursor: pointer;
	}

	.dropdown-input[readonly] {
		cursor: pointer;
	}

	.dropdown-input:not([readonly]) {
		cursor: text;
	}

	.dropdown-input:hover {
		border-color: #9ca3af;
	}

	.dropdown-input:focus {
		outline: none;
		border-color: #22c55e;
		box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.1);
	}

	.dropdown-input::placeholder {
		color: #9ca3af;
	}

	.dropdown-trigger {
		position: absolute;
		right: 0;
		top: 0;
		bottom: 0;
		display: flex;
		align-items: center;
		justify-content: center;
		width: 2.5rem;
		background: none;
		border: none;
		cursor: pointer;
		color: #6b7280;
		padding: 0;
	}

	.dropdown-trigger:hover {
		color: #374151;
	}

	.dropdown-icon {
		width: 1rem;
		height: 1rem;
		transition: transform 0.15s;
	}

	.dropdown-icon.open {
		transform: rotate(180deg);
	}

	.dropdown-menu {
		position: absolute;
		top: calc(100% + 4px);
		left: 0;
		right: 0;
		background: white;
		border: 1px solid #d1d5db;
		border-radius: 0.5rem;
		box-shadow:
			0 4px 6px -1px rgba(0, 0, 0, 0.1),
			0 2px 4px -1px rgba(0, 0, 0, 0.06);
		list-style: none;
		margin: 0;
		padding: 0.25rem 0;
		z-index: 50;
		max-height: 200px;
		overflow-y: auto;
	}

	.dropdown-option {
		padding: 0.5rem 0.75rem;
		font-size: 0.9375rem;
		color: #111827;
		cursor: pointer;
		transition: background-color 0.1s;
	}

	.dropdown-option:hover,
	.dropdown-option.highlighted {
		background-color: #f3f4f6;
	}

	.dropdown-option.selected {
		background-color: #f0fdf4;
		color: #16a34a;
		font-weight: 500;
	}

	.dropdown-option.selected.highlighted {
		background-color: #dcfce7;
	}
</style>
