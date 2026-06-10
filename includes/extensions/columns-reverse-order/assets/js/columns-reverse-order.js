(function () {
	'use strict';

	if (typeof wp === 'undefined') {
		setTimeout(arguments.callee, 100);
		return;
	}

	const { __ } = wp.i18n;
	const { createHigherOrderComponent } = wp.compose;
	const { Fragment, createElement } = wp.element;
	const { InspectorControls, store: blockEditorStore } = wp.blockEditor;
	const { ToggleControl } = wp.components;
	const { useSelect } = wp.data;

	const ToolsPanel = wp.components.__experimentalToolsPanel || null;
	const ToolsPanelItem =
		wp.components.__experimentalToolsPanelItem || null;

	const ENABLE_REVERSE_ORDER_ON_BLOCKS = ['core/columns'];

	function classnames() {
		const classes = [];
		for (let i = 0; i < arguments.length; i++) {
			const arg = arguments[i];
			if (!arg) continue;
			const argType = typeof arg;
			if (argType === 'string' || argType === 'number') {
				classes.push(arg);
			} else if (Array.isArray(arg)) {
				classes.push(classnames.apply(null, arg));
			} else if (argType === 'object') {
				for (const key in arg) {
					if (Object.prototype.hasOwnProperty.call(arg, key) && arg[key]) {
						classes.push(key);
					}
				}
			}
		}
		return classes.join(' ');
	}

	const setReverseOrderAttribute = (settings, name) => {
		if (!ENABLE_REVERSE_ORDER_ON_BLOCKS.includes(name)) {
			return settings;
		}
		return {
			...settings,
			attributes: {
				...settings.attributes,
				reverseOrder: {
					type: 'boolean',
					default: false,
				},
			},
		};
	};
	wp.hooks.addFilter(
		'blocks.registerBlockType',
		'monk-extensions/columns-reverse-order/set-reverse-order-attribute',
		setReverseOrderAttribute
	);

	const withReverseOrderToggle = createHigherOrderComponent((BlockEdit) => {
		return (props) => {
			if (!ENABLE_REVERSE_ORDER_ON_BLOCKS.includes(props.name)) {
				return createElement(BlockEdit, props);
			}

			const { attributes, setAttributes, clientId } = props;
			const { reverseOrder } = attributes;
			const hasInnerBlocks = useSelect(
				function (select) {
					return select(blockEditorStore).getBlocks(clientId).length > 0;
				},
				[clientId]
			);

			const reverseOrderToggle = createElement(ToggleControl, {
				label: __('Reverse column order on desktop', 'monk-extensions'),
				help: __(
					'Reverse the order of columns on desktop and tablet layouts. Mobile layout remains unchanged.',
					'monk-extensions'
				),
				checked: !!reverseOrder,
				onChange: function (value) {
					setAttributes({ reverseOrder: value });
				},
				__nextHasNoMarginBottom: true,
			});

			const reverseOrderControl =
				ToolsPanel && ToolsPanelItem
					? createElement(
							ToolsPanel,
							{
								className: 'monk-columns-reverse-order-control',
								label: __(
									'Reverse column order on desktop',
									'monk-extensions'
								),
							},
							createElement(
								ToolsPanelItem,
								{
									label: __(
										'Reverse column order on desktop',
										'monk-extensions'
									),
									isShownByDefault: true,
									hasValue: function () {
										return !!reverseOrder;
									},
									onDeselect: function () {
										setAttributes({ reverseOrder: false });
									},
								},
								reverseOrderToggle
							)
					  )
					: createElement(
							'div',
							{ className: 'monk-columns-reverse-order-control' },
							reverseOrderToggle
					  );

			return createElement(
				Fragment,
				null,
				createElement(BlockEdit, props),
				hasInnerBlocks &&
					createElement(InspectorControls, null, reverseOrderControl)
			);
		};
	}, 'withReverseOrderToggle');

	wp.hooks.addFilter(
		'editor.BlockEdit',
		'monk-extensions/columns-reverse-order/with-reverse-order-toggle',
		withReverseOrderToggle
	);

	const withReverseOrderEditClass = createHigherOrderComponent((BlockListBlock) => {
		return (props) => {
			if (!ENABLE_REVERSE_ORDER_ON_BLOCKS.includes(props.name)) {
				return wp.element.createElement(BlockListBlock, props);
			}
			const { attributes } = props;
			const { reverseOrder } = attributes;
			if (reverseOrder) {
				return wp.element.createElement(BlockListBlock, {
					...props,
					className: classnames(props.className, 'has-reverse-order'),
				});
			}
			return wp.element.createElement(BlockListBlock, props);
		};
	}, 'withReverseOrderEditClass');

	wp.hooks.addFilter(
		'editor.BlockListBlock',
		'monk-extensions/columns-reverse-order/with-reverse-order-edit-class',
		withReverseOrderEditClass
	);

	const saveReverseOrderAttribute = (extraProps, blockType, attributes) => {
		if (ENABLE_REVERSE_ORDER_ON_BLOCKS.includes(blockType.name)) {
			const { reverseOrder } = attributes;
			if (reverseOrder) {
				extraProps.className = classnames(extraProps.className, 'has-reverse-order');
			}
		}
		return extraProps;
	};
	wp.hooks.addFilter(
		'blocks.getSaveContent.extraProps',
		'monk-extensions/columns-reverse-order/save-reverse-order-attribute',
		saveReverseOrderAttribute
	);
})();
