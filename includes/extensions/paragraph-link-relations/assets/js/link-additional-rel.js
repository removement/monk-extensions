/**
 * Extends the paragraph link popup in the block editor with an
 * "Additional link relations" option (applied to the attribute).
 *
 * Works by re-registering the core/link format with an extended edit component.
 */
(function (wp) {
	'use strict';

	if (!wp || !wp.richText || !wp.blockEditor) {
		return;
	}
	if (typeof wp.richText.unregisterFormatType !== 'function' || !wp.blockEditor.LinkControl) {
		return;
	}

	const { richText, blockEditor, element, i18n, url, a11y, compose, data } = wp;
	if (!element || !element.createElement) {
		return;
	}
	const { useState, useMemo, useEffect, useLayoutEffect, useRef } = element;
	const { __, sprintf } = i18n;
	const { prependHTTP } = url;
	const { speak } = a11y;
	const { useInstanceId } = compose;
	const { useDispatch, useSelect } = data;
	const {
		create: createRichText,
		insert,
		isCollapsed,
		applyFormat,
		removeFormat,
		slice,
		replace,
		split,
		concat,
		useAnchor,
	} = richText;
	const getTextContent = typeof richText.getTextContent === 'function'
		? richText.getTextContent
		: function (v) { return (v && v.text != null) ? v.text : ''; };
	const LinkControl = blockEditor.LinkControl;
	const RichTextShortcut = blockEditor.RichTextShortcut;
	const RichTextToolbarButton = blockEditor.RichTextToolbarButton;
	const blockEditorStore = blockEditor.store;

	const CORE_REL_VALUES = ['nofollow', 'noreferrer', 'noopener'];

	function parseRel(rel) {
		if (!rel || typeof rel !== 'string') return { core: [], additional: '' };
		const tokens = rel.trim().toLowerCase().split(/\s+/).filter(Boolean);
		const core = tokens.filter((t) => CORE_REL_VALUES.includes(t));
		const additional = tokens.filter((t) => !CORE_REL_VALUES.includes(t)).join(' ');
		return { core, additional };
	}

	function isValidHref(href) {
		if (!href || !href.trim()) return false;
		const trimmed = href.trim();
		if (/^\S+:/.test(trimmed)) {
			const protocol = url.getProtocol(trimmed);
			if (!url.isValidProtocol(protocol)) return false;
			if (protocol.startsWith('http') && !/^https?:\/\/[^/\s]/i.test(trimmed)) return false;
			if (!url.isValidAuthority(url.getAuthority(trimmed))) return false;
			const path = url.getPath(trimmed);
			if (path && !url.isValidPath(path)) return false;
			const qs = url.getQueryString(trimmed);
			if (qs && !url.isValidQueryString(qs)) return false;
			const frag = url.getFragment(trimmed);
			if (frag && !url.isValidFragment(frag)) return false;
		}
		if (trimmed.startsWith('#') && !url.isValidFragment(trimmed)) return false;
		return true;
	}

	function createLinkFormat({
		url: linkUrl,
		type,
		id,
		opensInNewWindow,
		nofollow,
		cssClasses,
		additionalRel,
	}) {
		const format = { type: 'core/link', attributes: { url: linkUrl } };
		if (type) format.attributes.type = type;
		if (id != null) format.attributes.id = String(id);
		if (opensInNewWindow) {
			format.attributes.target = '_blank';
			format.attributes.rel = (format.attributes.rel || '') + ' noreferrer noopener'.trim();
		}
		if (nofollow) {
			format.attributes.rel = ((format.attributes.rel || '') + ' nofollow').trim();
		}
		const extraRel = (additionalRel || '').trim().replace(/\s+/g, ' ');
		if (extraRel) {
			format.attributes.rel = ((format.attributes.rel || '') + ' ' + extraRel).trim();
		}
		const trimmedCss = (cssClasses || '').trim();
		if (trimmedCss.length) format.attributes.class = trimmedCss;
		return format;
	}

	function getFormatBoundary(value, formatType, startIndex = value.start, endIndex = value.end) {
		const empty = { start: null, end: null };
		const formats = value.formats;
		if (!formats?.length) return empty;
		const newFormats = formats.slice();
		const formatAtStart = newFormats[startIndex]?.find((f) => f.type === formatType.type);
		const formatAtEnd = newFormats[endIndex]?.find((f) => f.type === formatType.type);
		const formatAtEndMinus = newFormats[endIndex - 1]?.find((f) => f.type === formatType.type);
		let targetFormat, initialIndex;
		if (formatAtStart) {
			targetFormat = formatAtStart;
			initialIndex = startIndex;
		} else if (formatAtEnd) {
			targetFormat = formatAtEnd;
			initialIndex = endIndex;
		} else if (formatAtEndMinus) {
			targetFormat = formatAtEndMinus;
			initialIndex = endIndex - 1;
		} else {
			return empty;
		}
		const index = newFormats[initialIndex].indexOf(targetFormat);
		function walk(direction) {
			let i = initialIndex;
			const step = direction === 'forwards' ? 1 : -1;
			while (newFormats[i] && newFormats[i][index] === targetFormat) {
				i += step;
			}
			return i + (-step);
		}
		startIndex = walk('backwards');
		endIndex = walk('forwards');
		if (startIndex < 0) startIndex = 0;
		return { start: startIndex, end: endIndex };
	}

	function getRichTextValueFromSelection(value, isActive) {
		let textStart = value.start;
		let textEnd = value.end;
		if (isActive) {
			const boundary = getFormatBoundary(value, { type: 'core/link' });
			textStart = boundary.start;
			textEnd = boundary.end + 1;
		}
		return slice(value, textStart, textEnd);
	}

	function AdditionalRelSettingComponent({ setting, value, onChange }) {
		const relInfo = parseRel(value?.rel);
		const hasAdditional = value?.additionalRel != null
			? String(value.additionalRel).trim().length > 0
			: relInfo.additional.length > 0;
		const [isActive, setIsActive] = useState(hasAdditional);
		const instanceId = useInstanceId(AdditionalRelSettingComponent);
		const regionId = 'additional-rel-setting-' + instanceId;
		const displayValue = value?.additionalRel != null ? value.additionalRel : relInfo.additional;

		function handleTextChange(newVal) {
			const sanitized = typeof newVal === 'string'
				? newVal.replace(/,/g, ' ').replace(/\s+/g, ' ').trim()
				: '';
			const corePart = parseRel(value?.rel).core.join(' ');
			const rel = [corePart, sanitized].filter(Boolean).join(' ').trim();
			onChange({ ...value, additionalRel: sanitized, rel });
		}

		function handleCheckboxChange() {
			if (isActive && hasAdditional) {
				onChange({ ...value, additionalRel: '' });
			}
			setIsActive(!isActive);
		}

		const InputControl = wp.components?.__experimentalInputControl;
		const inputEl = InputControl
			? element.createElement(InputControl, {
				label: __('Link relations', 'monk-extensions'),
				value: displayValue,
				onChange: handleTextChange,
				help: __('e.g. sponsored, ugc. Separate multiple with spaces.', 'monk-extensions'),
				__unstableInputWidth: '100%',
				__next40pxDefaultSize: true,
			})
			: element.createElement('input', {
				type: 'text',
				className: 'components-text-control__input',
				value: displayValue,
				onChange: (e) => handleTextChange(e.target.value),
				placeholder: __('e.g. sponsored, ugc', 'monk-extensions'),
			});

		return element.createElement(
			'fieldset',
			{ 'aria-label': setting.title },
			element.createElement(
				wp.components.VisuallyHidden,
				{ as: 'legend' },
				setting.title
			),
			element.createElement(wp.components.CheckboxControl, {
				__nextHasNoMarginBottom: true,
				label: setting.title,
				checked: isActive || hasAdditional,
				onChange: handleCheckboxChange,
				'aria-expanded': isActive,
				'aria-controls': isActive ? regionId : undefined,
			}),
			isActive && element.createElement('div', { id: regionId, style: { marginTop: 8 } }, inputEl)
		);
	}

	function getLinkIcon() {
		const primitives = wp.primitives;
		if (primitives?.SVG && primitives?.Path) {
			return element.createElement(
				primitives.SVG,
				{ xmlns: 'http://www.w3.org/2000/svg', viewBox: '0 0 24 24' },
				element.createElement(primitives.Path, {
					d: 'M10 17.389H8.444A5.194 5.194 0 1 1 8.444 7H10v1.5H8.444a3.694 3.694 0 0 0 0 7.389H10v1.5ZM14 7h1.556a5.194 5.194 0 0 1 0 10.39H14v-1.5h1.556a3.694 3.694 0 0 0 0-7.39H14V7Zm-4.5 6h5v-1.5h-5V13Z',
				})
			);
		}
		return null;
	}

	const LINK_SETTINGS = [
		...LinkControl.DEFAULT_LINK_SETTINGS,
		{ id: 'nofollow', title: __('Mark as nofollow', 'monk-extensions') },
		{
			id: 'cssClasses',
			title: __('Additional CSS class(es)', 'monk-extensions'),
			render: (setting, value, onChange) => {
				const hasValue = value?.cssClasses?.length > 0;
				const [active, setActive] = useState(hasValue);
				const InputControl = wp.components?.__experimentalInputControl;
				const inputEl = InputControl
					? element.createElement(InputControl, {
						label: __('CSS classes', 'monk-extensions'),
						value: value?.cssClasses || '',
						onChange: (v) => onChange({ ...value, cssClasses: v }),
						help: __('Separate multiple classes with spaces.', 'monk-extensions'),
						__unstableInputWidth: '100%',
						__next40pxDefaultSize: true,
					})
					: element.createElement('input', {
						type: 'text',
						className: 'components-text-control__input',
						value: value?.cssClasses || '',
						onChange: (e) => onChange({ ...value, cssClasses: e.target.value }),
					});
				return element.createElement(
					'fieldset',
					{ 'aria-label': setting.title },
					element.createElement(wp.components.CheckboxControl, {
						__nextHasNoMarginBottom: true,
						label: setting.title,
						checked: active || hasValue,
						onChange: () => {
							if (active && hasValue) onChange({ ...value, cssClasses: '' });
							setActive(!active);
						},
					}),
					active && element.createElement('div', { style: { marginTop: 8 } }, inputEl)
				);
			},
		},
		{
			id: 'additionalRel',
			title: __('Additional link relations', 'monk-extensions'),
			render: (setting, value, onChange) =>
				element.createElement(AdditionalRelSettingComponent, {
					setting,
					value,
					onChange,
				}),
		},
	];

	function InlineLinkUI({
		isActive,
		activeAttributes,
		value,
		onChange,
		onFocusOutside,
		stopAddingLink,
		contentRef,
		focusOnMount,
	}) {
		const richLinkValue = getRichTextValueFromSelection(value, isActive);
		const richTextText = richLinkValue.text;
		const initialSelectionRef = useRef(null);
		if (!isActive && !isCollapsed(value) && initialSelectionRef.current === null) {
			initialSelectionRef.current = { start: value.start, end: value.end };
		}
		const initialSelectionRange = initialSelectionRef.current;
		const { selectionChange } = useDispatch(blockEditorStore);
		const { createPageEntity, userCanCreatePages, selectionStart } = useSelect(
			(select) => {
				const { getSettings, getSelectionStart } = select(blockEditorStore);
				const s = getSettings();
				return {
					createPageEntity: s.__experimentalCreatePageEntity,
					userCanCreatePages: s.__experimentalUserCanCreatePages,
					selectionStart: getSelectionStart(),
				};
			},
			[]
		);

		const relParsed = parseRel(activeAttributes.rel);
		const linkValue = useMemo(
			() => ({
				url: activeAttributes.url,
				type: activeAttributes.type,
				id: activeAttributes.id,
				opensInNewTab: activeAttributes.target === '_blank',
				nofollow: activeAttributes.rel?.includes('nofollow'),
				title: richTextText,
				cssClasses: activeAttributes.class,
				rel: activeAttributes.rel,
				additionalRel: relParsed.additional,
			}),
			[
				activeAttributes.class,
				activeAttributes.id,
				activeAttributes.rel,
				activeAttributes.target,
				activeAttributes.type,
				activeAttributes.url,
				richTextText,
			]
		);

		function removeLink() {
			onChange(removeFormat(value, 'core/link'));
			stopAddingLink();
			speak(__('Link removed.', 'monk-extensions'), 'assertive');
		}

		function onChangeLink(nextValue) {
			const hasLink = linkValue?.url;
			const isNewLink = !hasLink;
			nextValue = { ...linkValue, ...nextValue };
			const newUrl = prependHTTP(nextValue.url);
			const additionalRelValue = nextValue.additionalRel !== undefined && nextValue.additionalRel !== null
				? nextValue.additionalRel
				: (nextValue.rel && parseRel(nextValue.rel).additional) || '';
			const linkFormat = createLinkFormat({
				url: newUrl,
				type: nextValue.type,
				id: nextValue.id != null ? String(nextValue.id) : undefined,
				opensInNewWindow: nextValue.opensInNewTab,
				nofollow: nextValue.nofollow,
				cssClasses: nextValue.cssClasses,
				additionalRel: typeof additionalRelValue === 'string' ? additionalRelValue.trim() : '',
			});
			const newText = nextValue.title || newUrl;

			let newValue;
			if (isCollapsed(value) && !isActive) {
				const inserted = insert(value, newText);
				newValue = applyFormat(inserted, linkFormat, value.start, value.start + newText.length);
				onChange(newValue);
				stopAddingLink();
				selectionChange({
					clientId: selectionStart.clientId,
					identifier: selectionStart.attributeKey,
					start: value.start + newText.length + 1,
				});
				return;
			}
			if (newText === richTextText) {
				if (isActive) {
					const boundary = getFormatBoundary(value, { type: 'core/link' });
					newValue = applyFormat(value, linkFormat, boundary.start, boundary.end + 1);
				} else {
					const start = initialSelectionRange?.start ?? value.start;
					const end = initialSelectionRange?.end ?? value.end;
					newValue = applyFormat(value, linkFormat, start, end);
				}
			} else {
				newValue = applyFormat(createRichText({ text: newText }), linkFormat, 0, newText.length);
				const boundary = getFormatBoundary(value, { type: 'core/link' });
				const [valBefore, valAfter] = split(value, boundary.start, boundary.start);
				const newValAfter = replace(valAfter, richTextText, newValue);
				newValue = concat(valBefore, newValAfter);
			}
			onChange(newValue);
			if (!isNewLink) stopAddingLink();
			if (!isValidHref(newUrl)) {
				speak(__('Warning: the link has been inserted but may have errors. Please test it.', 'monk-extensions'), 'assertive');
			} else if (isActive) {
				speak(__('Link edited.', 'monk-extensions'), 'assertive');
			} else {
				speak(__('Link inserted.', 'monk-extensions'), 'assertive');
			}
		}

		const popoverAnchor = useAnchor({
			editableContentElement: contentRef.current,
			settings: { type: 'core/link', isActive },
		});

		async function handleCreate(pageTitle) {
			const page = await createPageEntity({ title: pageTitle, status: 'draft' });
			return {
				id: page.id,
				type: page.type,
				title: page.title.rendered,
				url: page.link,
				kind: 'post-type',
			};
		}

		function createButtonText(searchTerm) {
			return element.createInterpolateElement(
				sprintf(__('Create page: %s'), searchTerm),
				{ mark: element.createElement('mark') }
			);
		}

		return element.createElement(
			wp.components.Popover,
			{
				anchor: popoverAnchor,
				animate: false,
				onClose: stopAddingLink,
				onFocusOutside,
				placement: 'bottom',
				offset: 8,
				shift: true,
				focusOnMount,
				constrainTabbing: true,
			},
			element.createElement(LinkControl, {
				value: linkValue,
				onChange: onChangeLink,
				onRemove: removeLink,
				hasRichPreviews: true,
				createSuggestion: createPageEntity && handleCreate,
				withCreateSuggestion: userCanCreatePages,
				createSuggestionButtonText: createButtonText,
				hasTextControl: true,
				settings: LINK_SETTINGS,
				showInitialSuggestions: true,
				suggestionsQuery: {
					initialSuggestionsSearchOptions: { type: 'post', subtype: 'page', perPage: 20 },
				},
			})
		);
	}

	function LinkEdit({
		isActive,
		activeAttributes,
		value,
		onChange,
		onFocus,
		contentRef,
	}) {
		const [addingLink, setAddingLink] = useState(false);
		const [openedBy, setOpenedBy] = useState(null);

		useEffect(() => {
			if (!isActive) setAddingLink(false);
		}, [isActive]);

		useLayoutEffect(() => {
			const el = contentRef.current;
			if (!el) return;
			function handleClick(event) {
				const linkEl = event.target.closest('[contenteditable] a');
				if (!linkEl || !isActive) return;
				setAddingLink(true);
				setOpenedBy({ el: linkEl, action: 'click' });
			}
			el.addEventListener('click', handleClick);
			return () => el.removeEventListener('click', handleClick);
		}, [contentRef, isActive]);

		function addLink(target) {
			const text = getTextContent(slice(value));
			if (!isActive && text && url.isURL(text) && isValidHref(text)) {
				onChange(applyFormat(value, { type: 'core/link', attributes: { url: text } }));
				return;
			}
			if (!isActive && text && url.isEmail(text)) {
				onChange(applyFormat(value, { type: 'core/link', attributes: { url: 'mailto:' + text } }));
				return;
			}
			if (!isActive && text && url.isPhoneNumber(text)) {
				onChange(applyFormat(value, {
					type: 'core/link',
					attributes: { url: 'tel:' + text.replace(/\D/g, '') },
				}));
				return;
			}
			if (target) setOpenedBy({ el: target, action: null });
			setAddingLink(true);
		}

		function stopAddingLink() {
			setAddingLink(false);
			if (openedBy?.el?.tagName === 'BUTTON') openedBy.el.focus();
			else onFocus();
			setOpenedBy(null);
		}

		function onRemoveFormat() {
			onChange(removeFormat(value, 'core/link'));
			speak(__('Link removed.', 'monk-extensions'), 'assertive');
		}

		const shouldAutoFocus = !(openedBy?.el?.tagName === 'A' && openedBy?.action === 'click');
		const hasSelection = !isCollapsed(value);

		return element.createElement(
			element.Fragment,
			null,
			hasSelection &&
				element.createElement(RichTextShortcut, {
					type: 'primary',
					character: 'k',
					onUse: addLink,
				}),
			element.createElement(RichTextShortcut, {
				type: 'primaryShift',
				character: 'k',
				onUse: onRemoveFormat,
			}),
			element.createElement(RichTextToolbarButton, {
				name: 'link',
				icon: getLinkIcon(),
				title: isActive ? __('Link', 'monk-extensions') : __('Link', 'monk-extensions'),
				onClick: (event) => addLink(event.currentTarget),
				isActive: isActive || addingLink,
				shortcutType: 'primary',
				shortcutCharacter: 'k',
				'aria-haspopup': 'true',
				'aria-expanded': addingLink,
			}),
			addingLink &&
				element.createElement(InlineLinkUI, {
					stopAddingLink,
					onFocusOutside: () => {
						setAddingLink(false);
						setOpenedBy(null);
					},
					isActive,
					activeAttributes,
					value,
					onChange,
					contentRef,
					focusOnMount: shouldAutoFocus ? 'firstElement' : false,
				})
		);
	}

	try {
		const oldFormat = richText.unregisterFormatType('core/link');
		if (oldFormat) {
			richText.registerFormatType('core/link', {
				...oldFormat,
				edit: LinkEdit,
			});
		}
	} catch (err) {
		if (typeof console !== 'undefined' && console.warn) {
			console.warn('Monk Extensions – Paragraph Link Relations:', err);
		}
	}
})(window.wp);
