( function ( wp ) {
	const { addFilter } = wp.hooks;
	const { createHigherOrderComponent } = wp.compose;
	const {
		Fragment,
		createElement,
		useState,
		useEffect,
		useMemo,
		useCallback,
		useRef,
	} = wp.element;
	const { InspectorControls, store: blockEditorStore } = wp.blockEditor;
	const { useSelect } = wp.data;
	const {
		PanelBody,
		BaseControl,
		TextControl,
		SelectControl,
		Button,
		Flex,
		FlexItem,
		Notice,
	} = wp.components;

	const VStack = wp.components.__experimentalVStack || 'div';
	const ToolsPanelItem =
		wp.components.__experimentalToolsPanelItem || null;
	const { __ } = wp.i18n;

	const SUGGESTED_WIDTHS = [ 600, 768, 1024 ];
	const MAX_GRID = 16;
	const GROUP_BLOCK = 'core/group';
	const PREVIEW_PARENT_STYLE_ID = 'monk-grid-breakpoints-preview-styles';
	const PREVIEW_CHILD_STYLE_ID = 'monk-grid-item-span-preview-styles';

	function parseGridCount( value, fallback ) {
		if ( value === '' || value === null || value === undefined ) {
			return fallback;
		}

		const parsed = parseInt( String( value ), 10 );

		if ( ! Number.isFinite( parsed ) || parsed < 1 ) {
			return fallback;
		}

		return Math.min( parsed, MAX_GRID );
	}

	function rowsEqual( left, right ) {
		return JSON.stringify( left ) === JSON.stringify( right );
	}

	function isGridGroup( attributes, parentLayout ) {
		if ( attributes?.layout?.type === 'grid' ) {
			return true;
		}

		if ( parentLayout?.type === 'grid' ) {
			return true;
		}

		return false;
	}

	function isGridParentLayout( parentLayout ) {
		if ( ! parentLayout || typeof parentLayout !== 'object' ) {
			return false;
		}

		const parentLayoutType = parentLayout.type || 'default';
		const defaultParentLayoutType = parentLayout.default?.type || 'default';

		return parentLayoutType === 'grid' || defaultParentLayoutType === 'grid';
	}

	function blockCanUseGridChildLayout( blockName ) {
		const blockType = wp.blocks.getBlockType( blockName );
		if ( ! blockType ) {
			return false;
		}

		const supports = blockType.supports || {};
		const styleSupportKeys = [
			'color',
			'typography',
			'spacing',
			'dimensions',
			'border',
			'__experimentalBorder',
			'background',
			'shadow',
			'filter',
			'layout',
			'__experimentalLayout',
		];

		if (
			styleSupportKeys.some( ( key ) => !! supports[ key ] ) ||
			( blockType.attributes && blockType.attributes.style )
		) {
			return true;
		}

		return false;
	}

	function isEligibleResponsiveGridChild( blockName, parentLayout, parentContext ) {
		if ( ! parentContext?.parentIsGrid ) {
			return false;
		}

		if ( ! blockCanUseGridChildLayout( blockName ) ) {
			return false;
		}

		if ( parentLayout && isGridParentLayout( parentLayout ) ) {
			return parentLayout.allowSizingOnChildren !== false;
		}

		return true;
	}

	function getDirectGridParentContext( clientId, select ) {
		const editor = select( blockEditorStore );
		const parentClientId = editor.getBlockRootClientId( clientId );

		if ( ! parentClientId ) {
			return {
				parentClientId: null,
				parentIsGrid: false,
				parentBreakpoints: [],
				parentBreakpointsKey: '',
			};
		}

		const parentBlock = editor.getBlock( parentClientId );

		if ( ! parentBlock || parentBlock.name !== GROUP_BLOCK ) {
			return {
				parentClientId,
				parentIsGrid: false,
				parentBreakpoints: [],
				parentBreakpointsKey: '',
			};
		}

		const parentAttributes =
			parentBlock.attributes ||
			editor.getBlockAttributes( parentClientId ) ||
			{};
		const parentIsGrid = isGridGroup( parentAttributes );
		const rawBreakpoints = parentAttributes.monkGridBreakpoints;
		const parentBreakpoints = parentIsGrid
			? normalizeParentBreakpoints( rawBreakpoints )
			: [];

		return {
			parentClientId,
			parentIsGrid,
			parentBreakpoints,
			parentBreakpointsKey: JSON.stringify( rawBreakpoints || [] ),
		};
	}

	function registerGridBreakpointAttributes( settings, name ) {
		if ( name === GROUP_BLOCK ) {
			settings.attributes = Object.assign( {}, settings.attributes, {
				monkGridBreakpoints: {
					type: 'array',
					default: [],
				},
			} );
		}

		settings.attributes = Object.assign( {}, settings.attributes, {
			monkGridItemSpanBreakpoints: {
				type: 'array',
				default: [],
			},
		} );

		return settings;
	}

	addFilter(
		'blocks.registerBlockType',
		'monk/grid-breakpoints/add-attributes',
		registerGridBreakpointAttributes
	);

	/**
	 * Mount responsive span inspector after core style hooks (Grid span) but before
	 * block-specific dimensions controls (e.g. image aspect ratio / focal point).
	 */
	function wrapBlockEditForResponsiveSpanInspector( settings, blockName ) {
		if (
			! settings.edit ||
			! blockCanUseGridChildLayout( blockName ) ||
			settings.edit.monkResponsiveSpanWrapped
		) {
			return settings;
		}

		const OriginalEdit = settings.edit;

		settings.edit = function MonkWrappedBlockEdit( props ) {
			return createElement(
				Fragment,
				null,
				createElement( ChildGridSpanInspectorGate, {
					clientId: props.clientId,
					name: blockName,
					attributes: props.attributes,
					setAttributes: props.setAttributes,
					parentLayout: props.__unstableParentLayout,
				} ),
				createElement( OriginalEdit, props )
			);
		};

		settings.edit.monkResponsiveSpanWrapped = true;

		return settings;
	}

	function applyResponsiveSpanEditWraps() {
		if ( ! wp.blocks || ! wp.blocks.getBlockTypes ) {
			return;
		}

		wp.blocks.getBlockTypes().forEach( function ( blockType ) {
			if ( ! blockType.name || ! blockType.edit ) {
				return;
			}

			const wrapped = wrapBlockEditForResponsiveSpanInspector(
				{ edit: blockType.edit },
				blockType.name
			);

			if ( wrapped.edit !== blockType.edit ) {
				blockType.edit = wrapped.edit;
			}
		} );
	}

	function usesWrappedResponsiveSpanInspector( blockName ) {
		const blockType = wp.blocks.getBlockType( blockName );
		return !! blockType?.edit?.monkResponsiveSpanWrapped;
	}

	addFilter(
		'blocks.registerBlockType',
		'monk/grid-breakpoints/wrap-block-edit',
		wrapBlockEditForResponsiveSpanInspector
	);

	function getDefaultGridSpan( attributes ) {
		const layout = attributes?.style?.layout || {};
		let columnSpan = layout.columnSpan ? parseInt( layout.columnSpan, 10 ) : 1;
		let rowSpan = layout.rowSpan ? parseInt( layout.rowSpan, 10 ) : 1;

		if ( layout.columnStart && layout.columnEnd ) {
			columnSpan =
				parseInt( layout.columnEnd, 10 ) - parseInt( layout.columnStart, 10 ) + 1;
		}
		if ( layout.rowStart && layout.rowEnd ) {
			rowSpan = parseInt( layout.rowEnd, 10 ) - parseInt( layout.rowStart, 10 ) + 1;
		}

		return {
			columnSpan: Number.isFinite( columnSpan ) && columnSpan > 0 ? columnSpan : 1,
			rowSpan: Number.isFinite( rowSpan ) && rowSpan > 0 ? rowSpan : 1,
		};
	}

	function normalizeParentBreakpoints( rows ) {
		if ( ! Array.isArray( rows ) ) {
			return [];
		}

		const byWidth = {};

		rows.forEach( ( row ) => {
			const width = parseInt( row?.width, 10 );
			const columns = parseInt( row?.columns, 10 );

			if ( ! Number.isFinite( width ) || width < 1 ) {
				return;
			}
			if ( ! Number.isFinite( columns ) || columns < 1 ) {
				return;
			}

			const item = {
				width,
				columns: Math.min( columns, MAX_GRID ),
			};

			const rowsCount = parseInt( row?.rows, 10 );
			if ( Number.isFinite( rowsCount ) && rowsCount > 0 ) {
				item.rows = Math.min( rowsCount, MAX_GRID );
			}

			byWidth[ width ] = item;
		} );

		return Object.values( byWidth ).sort( ( a, b ) => a.width - b.width );
	}

	function normalizeChildSpanBreakpoints( rows ) {
		if ( ! Array.isArray( rows ) ) {
			return [];
		}

		const byWidth = {};

		rows.forEach( ( row ) => {
			const width = parseInt( row?.width, 10 );
			const columnSpan = parseInt( row?.columnSpan, 10 );
			const rowSpan = parseInt( row?.rowSpan, 10 );

			if ( ! Number.isFinite( width ) || width < 1 ) {
				return;
			}
			if ( ! Number.isFinite( columnSpan ) || columnSpan < 1 ) {
				return;
			}
			if ( ! Number.isFinite( rowSpan ) || rowSpan < 1 ) {
				return;
			}

			byWidth[ width ] = {
				width,
				columnSpan: Math.min( columnSpan, MAX_GRID ),
				rowSpan: Math.min( rowSpan, MAX_GRID ),
			};
		} );

		return Object.values( byWidth ).sort( ( a, b ) => a.width - b.width );
	}

	function getParentColumnCountAtWidth( parentRows, width ) {
		const match = findParentBreakpointAtWidth( parentRows, width );
		return match ? match.columns : MAX_GRID;
	}

	function findParentBreakpointAtWidth( parentRows, width ) {
		const parsedWidth = parseInt( width, 10 );
		if ( ! Number.isFinite( parsedWidth ) || parsedWidth < 1 ) {
			return null;
		}

		return (
			parentRows.find( ( row ) => row.width === parsedWidth ) || null
		);
	}

	function formatParentBreakpointSummary( row ) {
		const parts = [
			__( 'Columns', 'monk-extensions' ) + ': ' + row.columns,
		];

		if ( row.rows ) {
			parts.push( __( 'Rows', 'monk-extensions' ) + ': ' + row.rows );
		}

		return parts.join( ' · ' );
	}

	function spanRowMatchesDefault( row, defaultSpan ) {
		return (
			parseInt( row.columnSpan, 10 ) === defaultSpan.columnSpan &&
			parseInt( row.rowSpan, 10 ) === defaultSpan.rowSpan
		);
	}

	function resolveChildSpanRowsForRender( childAttributes, parentRows ) {
		if ( ! parentRows.length ) {
			return [];
		}

		const defaultSpan = getDefaultGridSpan( childAttributes );
		const explicitRows = normalizeChildSpanBreakpoints(
			childAttributes.monkGridItemSpanBreakpoints
		).filter( ( row ) =>
			parentRows.some( ( parentRow ) => parentRow.width === row.width )
		);

		const explicitByWidth = {};
		explicitRows.forEach( ( row ) => {
			const maxColumns = getParentColumnCountAtWidth( parentRows, row.width );
			explicitByWidth[ row.width ] = {
				width: row.width,
				columnSpan: Math.min( row.columnSpan, maxColumns ),
				rowSpan: row.rowSpan,
			};
		} );

		return parentRows.map( ( parentRow ) => {
			const explicit = explicitByWidth[ parentRow.width ];
			let columnSpan = explicit ? explicit.columnSpan : defaultSpan.columnSpan;
			let rowSpan = explicit ? explicit.rowSpan : defaultSpan.rowSpan;

			columnSpan = Math.min(
				Math.max( 1, parseInt( columnSpan, 10 ) || 1 ),
				parentRow.columns
			);
			rowSpan = Math.max( 1, parseInt( rowSpan, 10 ) || 1 );

			if ( parentRow.rows ) {
				rowSpan = Math.min( rowSpan, parentRow.rows );
			}

			return {
				width: parentRow.width,
				columnSpan,
				rowSpan,
			};
		} );
	}

	function pruneRedundantChildRows( childAttributes, parentRows ) {
		const defaultSpan = getDefaultGridSpan( childAttributes );
		const rows = normalizeChildSpanBreakpoints(
			childAttributes.monkGridItemSpanBreakpoints
		);

		if ( ! rows.length ) {
			return [];
		}

		const allowedWidths = new Set( parentRows.map( ( row ) => row.width ) );

		return rows
			.filter( ( row ) => {
				if ( parentRows.length && ! allowedWidths.has( row.width ) ) {
					return false;
				}
				return ! spanRowMatchesDefault( row, defaultSpan );
			} )
			.map( ( row ) => {
				if ( ! parentRows.length ) {
					return row;
				}

				const maxColumns = getParentColumnCountAtWidth(
					parentRows,
					row.width
				);

				return {
					...row,
					columnSpan: Math.min( row.columnSpan, maxColumns ),
				};
			} )
			.filter( ( row ) => ! spanRowMatchesDefault( row, defaultSpan ) );
	}

	function flattenBlocks( blockList ) {
		const flat = [];

		const walk = ( blocks ) => {
			blocks.forEach( ( block ) => {
				flat.push( block );
				if ( block.innerBlocks?.length ) {
					walk( block.innerBlocks );
				}
			} );
		};

		walk( blockList );
		return flat;
	}

	function buildParentPreviewCss( blocks, getBlockAttributes ) {
		let css = '';

		flattenBlocks( blocks ).forEach( ( block ) => {
			if ( block.name !== GROUP_BLOCK ) {
				return;
			}

			const attributes = getBlockAttributes( block.clientId );
			if ( ! isGridGroup( attributes ) ) {
				return;
			}

			const rows = normalizeParentBreakpoints( attributes.monkGridBreakpoints );
			if ( ! rows.length ) {
				return;
			}

			const scopeClass = 'monk-grid-breakpoints-preview-' + block.clientId;
			const reversed = rows.slice().reverse();

				reversed.forEach( ( row ) => {
				let rules =
					'grid-template-columns:repeat(' +
					row.columns +
					',minmax(0,1fr))!important';

				if ( row.rows ) {
					rules +=
						';grid-template-rows:repeat(' +
						row.rows +
						',minmax(0,1fr))!important';
				}

				css +=
					'@media (max-width:' +
					row.width +
					'px){.wp-block-group.' +
					scopeClass +
					'.is-layout-grid,.wp-block-group.' +
					scopeClass +
					'{' +
					rules +
					'}}';
			} );
		} );

		return css;
	}

	function buildChildPreviewCss( blocks, getBlockAttributes, getBlockRootClientId ) {
		let css = '';
		const flatBlocks = flattenBlocks( blocks );

		flatBlocks.forEach( ( block ) => {
			if ( ! blockCanUseGridChildLayout( block.name ) ) {
				return;
			}

			const parentClientId = getBlockRootClientId( block.clientId );
			if ( ! parentClientId ) {
				return;
			}

			const parentBlock = flatBlocks.find(
				( item ) => item.clientId === parentClientId
			);
			if ( ! parentBlock || parentBlock.name !== GROUP_BLOCK ) {
				return;
			}

			const parentAttributes = getBlockAttributes( parentClientId );
			if ( ! isGridGroup( parentAttributes ) ) {
				return;
			}

			const parentRows = normalizeParentBreakpoints(
				parentAttributes.monkGridBreakpoints
			);
			if ( ! parentRows.length ) {
				return;
			}

			const childAttributes = getBlockAttributes( block.clientId );
			const childRows = resolveChildSpanRowsForRender(
				childAttributes,
				parentRows
			);

			if ( ! childRows.length ) {
				return;
			}

			const scopeClass = 'monk-grid-item-span-preview-' + block.clientId;
			const reversed = childRows.slice().reverse();

			reversed.forEach( ( row ) => {
				const maxColumns = getParentColumnCountAtWidth( parentRows, row.width );
				const columnSpan = Math.min( row.columnSpan, maxColumns );

				css +=
					'@media (max-width:' +
					row.width +
					'px){.' +
					scopeClass +
					'{grid-column:span ' +
					columnSpan +
					'!important;grid-row:span ' +
					row.rowSpan +
					'!important}}';
			} );
		} );

		return css;
	}

	function updatePreviewStyles() {
		if ( ! wp.data || ! wp.data.select ) {
			return;
		}

		const editor = wp.data.select( blockEditorStore );
		if ( ! editor || ! editor.getBlocks ) {
			return;
		}

		const blocks = editor.getBlocks();
		const getBlockAttributes = editor.getBlockAttributes.bind( editor );
		const getBlockRootClientId = editor.getBlockRootClientId.bind( editor );
		const parentCss = buildParentPreviewCss( blocks, getBlockAttributes );
		const childCss = buildChildPreviewCss(
			blocks,
			getBlockAttributes,
			getBlockRootClientId
		);

		let parentStyle = document.getElementById( PREVIEW_PARENT_STYLE_ID );
		if ( ! parentStyle ) {
			parentStyle = document.createElement( 'style' );
			parentStyle.id = PREVIEW_PARENT_STYLE_ID;
			document.head.appendChild( parentStyle );
		}
		parentStyle.textContent = parentCss;

		let childStyle = document.getElementById( PREVIEW_CHILD_STYLE_ID );
		if ( ! childStyle ) {
			childStyle = document.createElement( 'style' );
			childStyle.id = PREVIEW_CHILD_STYLE_ID;
			document.head.appendChild( childStyle );
		}
		childStyle.textContent = childCss;
	}

	function initPreviewStyleSubscription() {
		if ( ! wp.data || ! wp.data.subscribe || ! wp.data.select ) {
			return;
		}

		const editor = wp.data.select( blockEditorStore );
		if ( ! editor || ! editor.getBlocks ) {
			return;
		}

		let frame = null;
		wp.data.subscribe( function () {
			if ( frame ) {
				return;
			}
			frame = window.requestAnimationFrame( function () {
				frame = null;
				updatePreviewStyles();
			} );
		} );

		updatePreviewStyles();
	}

	function syncDirectChildSpanBreakpoints(
		parentClientId,
		normalizedRows,
		getBlocks,
		updateBlockAttributes
	) {
		const children = getBlocks( parentClientId );

		children.forEach( ( child ) => {
			if ( ! blockCanUseGridChildLayout( child.name ) ) {
				if ( child.attributes.monkGridItemSpanBreakpoints?.length ) {
					updateBlockAttributes( child.clientId, {
						monkGridItemSpanBreakpoints: [],
					} );
				}
				return;
			}

			if ( ! normalizedRows.length ) {
				if ( child.attributes.monkGridItemSpanBreakpoints?.length ) {
					updateBlockAttributes( child.clientId, {
						monkGridItemSpanBreakpoints: [],
					} );
				}
				return;
			}

			const pruned = pruneRedundantChildRows( child.attributes, normalizedRows );
			const current = normalizeChildSpanBreakpoints(
				child.attributes.monkGridItemSpanBreakpoints
			);

			if ( ! rowsEqual( pruned, current ) ) {
				updateBlockAttributes( child.clientId, {
					monkGridItemSpanBreakpoints: pruned,
				} );
			}
		} );
	}

	function ParentGridBreakpointInspector( { clientId, attributes, setAttributes } ) {
		const syncedBreakpointsRef = useRef( '' );

		const breakpoints = useMemo(
			() => normalizeParentBreakpoints( attributes.monkGridBreakpoints ),
			[ attributes.monkGridBreakpoints ]
		);

		const breakpointsSerialized = useMemo(
			() => JSON.stringify( breakpoints ),
			[ breakpoints ]
		);

		const [ widthInput, setWidthInput ] = useState( '' );
		const [ selectedWidth, setSelectedWidth ] = useState( '' );
		const [ columnsInput, setColumnsInput ] = useState( '2' );
		const [ rowsValue, setRowsValue ] = useState( '' );

		const breakpointOptions = useMemo(
			() =>
				breakpoints.map( ( row ) => ( {
					label: row.width + 'px and below',
					value: String( row.width ),
				} ) ),
			[ breakpoints ]
		);

		const effectiveSelectedWidth =
			selectedWidth ||
			( breakpointOptions[ 0 ] ? breakpointOptions[ 0 ].value : '' );

		const selectedRow = useMemo(
			() =>
				breakpoints.find(
					( row ) =>
						String( row.width ) === String( effectiveSelectedWidth )
				),
			[ breakpoints, effectiveSelectedWidth ]
		);

		useEffect( () => {
			if ( breakpointsSerialized === syncedBreakpointsRef.current ) {
				return;
			}

			syncedBreakpointsRef.current = breakpointsSerialized;

			window.setTimeout( function () {
				const { getBlocks, updateBlockAttributes } =
					wp.data.dispatch( blockEditorStore );

				syncDirectChildSpanBreakpoints(
					clientId,
					breakpoints,
					getBlocks,
					updateBlockAttributes
				);
			}, 0 );
		}, [ breakpointsSerialized, breakpoints, clientId ] );

		useEffect( () => {
			if ( ! breakpoints.length ) {
				setSelectedWidth( '' );
				return;
			}

			const exists = breakpoints.some(
				( row ) => String( row.width ) === String( selectedWidth )
			);
			if ( ! exists ) {
				setSelectedWidth( String( breakpoints[ 0 ].width ) );
			}
		}, [ breakpoints, selectedWidth ] );

		useEffect( () => {
			if ( selectedRow ) {
				setColumnsInput( String( selectedRow.columns ) );
				setRowsValue(
					selectedRow.rows ? String( selectedRow.rows ) : ''
				);
			}
		}, [ selectedRow ] );

		const updateBreakpoints = useCallback(
			( nextRows ) => {
				setAttributes( {
					monkGridBreakpoints: normalizeParentBreakpoints( nextRows ),
				} );
			},
			[ setAttributes ]
		);

		const parsedWidth = parseInt( widthInput, 10 );
		const canAddBreakpoint = Number.isFinite( parsedWidth ) && parsedWidth > 0;

		const defaultColumns =
			parseInt( attributes.layout?.columnCount, 10 ) || 2;
		const defaultRows = parseInt( attributes.layout?.rowCount, 10 ) || 0;

		const addBreakpoint = () => {
			if ( ! canAddBreakpoint ) {
				return;
			}

			const newRow = {
				width: parsedWidth,
				columns: defaultColumns,
			};

			if ( defaultRows > 0 ) {
				newRow.rows = defaultRows;
			}

			const next = normalizeParentBreakpoints( [ ...breakpoints, newRow ] );
			updateBreakpoints( next );
			setSelectedWidth( String( parsedWidth ) );
			setWidthInput( '' );
		};

		const updateSelectedRow = ( patch ) => {
			if ( ! effectiveSelectedWidth ) {
				return;
			}

			const next = breakpoints.map( ( row ) => {
				if ( String( row.width ) !== String( effectiveSelectedWidth ) ) {
					return row;
				}

				const updated = { ...row, ...patch };

				if ( patch.rows === undefined ) {
					delete updated.rows;
				}

				return updated;
			} );

			updateBreakpoints( next );
		};

		const updateSelectedColumns = ( value ) => {
			setColumnsInput( value );
		};

		const commitSelectedColumns = () => {
			const columns = parseGridCount(
				columnsInput,
				selectedRow?.columns || defaultColumns
			);
			setColumnsInput( String( columns ) );
			updateSelectedRow( { columns } );
		};

		const updateSelectedRows = ( value ) => {
			setRowsValue( value );
			const parsed = parseInt( value, 10 );

			if ( value === '' || ! Number.isFinite( parsed ) || parsed < 1 ) {
				updateSelectedRow( { rows: undefined } );
				return;
			}

			updateSelectedRow( { rows: Math.min( parsed, MAX_GRID ) } );
		};

		const removeSelectedBreakpoint = () => {
			if ( ! effectiveSelectedWidth ) {
				return;
			}

			const next = breakpoints.filter(
				( row ) => String( row.width ) !== String( effectiveSelectedWidth )
			);
			updateBreakpoints( next );
		};

		const suggestionHelp = createElement(
			Fragment,
			null,
			__(
				'Apply column and row counts at this width and below. Suggested sizes:',
				'monk-extensions'
			),
			' ',
			SUGGESTED_WIDTHS.map( ( width, index ) =>
				createElement(
					Fragment,
					{ key: width },
					index > 0 ? ', ' : null,
					createElement(
						Button,
						{
							variant: 'link',
							onClick: () => setWidthInput( String( width ) ),
						},
						width + 'px'
					)
				)
			)
		);

		return createElement(
			InspectorControls,
			null,
			createElement(
				PanelBody,
				{
					title: __( 'Column breakpoints', 'monk-extensions' ),
					initialOpen: false,
					className: 'monk-grid-breakpoints-panel',
				},
				createElement(
					VStack,
					{
						spacing: 4,
						className: 'monk-grid-breakpoints-panel__stack',
					},
					createElement(
						BaseControl,
						{
							className: 'monk-grid-breakpoints-panel__width',
							label: __( 'Breakpoint width', 'monk-extensions' ),
							help: suggestionHelp,
						},
						createElement( TextControl, {
							type: 'number',
							min: 1,
							value: widthInput,
							onChange: setWidthInput,
							__nextHasNoMarginBottom: true,
						} )
					),
					createElement(
						Button,
						{
							variant: 'primary',
							onClick: addBreakpoint,
							disabled: ! canAddBreakpoint,
							className: 'monk-grid-breakpoints-panel__add',
						},
						__( 'Add breakpoint', 'monk-extensions' )
					),
					breakpoints.length > 0 &&
						effectiveSelectedWidth &&
						createElement(
							Fragment,
							null,
							createElement( SelectControl, {
								label: __( 'Edit breakpoint', 'monk-extensions' ),
								value: effectiveSelectedWidth,
								options: breakpointOptions,
								onChange: setSelectedWidth,
								__nextHasNoMarginBottom: true,
							} ),
							createElement(
								'fieldset',
								{
									className:
										'block-editor-hooks__grid-layout-columns-and-rows-controls monk-grid-breakpoints-panel__grid-controls',
								},
								createElement(
									Flex,
									{ gap: 4 },
									createElement(
										FlexItem,
										{ style: { width: '50%' } },
										createElement(
											BaseControl,
											{
												label: __( 'Columns', 'monk-extensions' ),
											},
											createElement( TextControl, {
												type: 'number',
												min: 1,
												max: MAX_GRID,
												value: columnsInput,
												onChange: updateSelectedColumns,
												onBlur: commitSelectedColumns,
												onKeyDown: ( event ) => {
													if ( event.key === 'Enter' ) {
														event.preventDefault();
														commitSelectedColumns();
													}
												},
												__nextHasNoMarginBottom: true,
											} )
										)
									),
									createElement(
										FlexItem,
										{ style: { width: '50%' } },
										createElement(
											BaseControl,
											{
												label: __( 'Rows (Optional)', 'monk-extensions' ),
											},
											createElement( TextControl, {
												type: 'number',
												min: 1,
												max: MAX_GRID,
												value: rowsValue,
												onChange: updateSelectedRows,
												__nextHasNoMarginBottom: true,
											} )
										)
									)
								)
							),
							createElement(
								Button,
								{
									variant: 'secondary',
									isDestructive: true,
									onClick: removeSelectedBreakpoint,
									disabled: ! selectedWidth,
									className: 'monk-grid-breakpoints-panel__remove',
								},
								__( 'Remove breakpoint', 'monk-extensions' )
							)
						)
				)
			)
		);
	}

	function ChildGridSpanInspector( {
		clientId,
		name,
		attributes,
		setAttributes,
		parentLayout,
		parentContext: parentContextProp,
	} ) {
		const parentContextFromStore = useSelect(
			( select ) => getDirectGridParentContext( clientId, select ),
			[ clientId ]
		);
		const parentContext = parentContextProp || parentContextFromStore;

		const parentBreakpoints = parentContext.parentBreakpoints;

		const childRows = useMemo(
			() =>
				normalizeChildSpanBreakpoints(
					attributes.monkGridItemSpanBreakpoints
				),
			[ attributes.monkGridItemSpanBreakpoints ]
		);

		const [ selectedWidth, setSelectedWidth ] = useState( '' );
		const [ columnSpanValue, setColumnSpanValue ] = useState( 1 );
		const [ rowSpanValue, setRowSpanValue ] = useState( 1 );
		const [ legacyWidthInput, setLegacyWidthInput ] = useState( '' );

		const breakpointOptions = useMemo( () => {
			if ( parentBreakpoints.length ) {
				return parentBreakpoints.map( ( row ) => ( {
					label: row.width + 'px and below',
					value: String( row.width ),
				} ) );
			}

			return childRows.map( ( row ) => ( {
				label: row.width + 'px and below',
				value: String( row.width ),
			} ) );
		}, [ parentBreakpoints, childRows ] );

		const effectiveSelectedWidth =
			selectedWidth ||
			( breakpointOptions[ 0 ] ? breakpointOptions[ 0 ].value : '' );

		useEffect( () => {
			if ( ! breakpointOptions.length ) {
				setSelectedWidth( '' );
				return;
			}

			const exists = breakpointOptions.some(
				( option ) => option.value === String( selectedWidth )
			);
			if ( ! exists ) {
				setSelectedWidth( breakpointOptions[ 0 ].value );
			}
		}, [ breakpointOptions, selectedWidth ] );

		const selectedRow = useMemo(
			() =>
				childRows.find(
					( row ) =>
						String( row.width ) === String( effectiveSelectedWidth )
				),
			[ childRows, effectiveSelectedWidth ]
		);

		const selectedParentBreakpoint = useMemo(
			() =>
				findParentBreakpointAtWidth(
					parentBreakpoints,
					effectiveSelectedWidth
				),
			[ parentBreakpoints, effectiveSelectedWidth ]
		);

		const defaultSpan = useMemo(
			() => getDefaultGridSpan( attributes ),
			[ attributes?.style?.layout ]
		);

		useEffect( () => {
			if ( selectedRow ) {
				setColumnSpanValue( selectedRow.columnSpan );
				setRowSpanValue( selectedRow.rowSpan );
				return;
			}

			setColumnSpanValue( defaultSpan.columnSpan );
			setRowSpanValue( defaultSpan.rowSpan );
		}, [ selectedRow, defaultSpan ] );

		const saveChildRows = ( nextRows ) => {
			const normalized = normalizeChildSpanBreakpoints( nextRows );
			const pruned = normalized.filter(
				( row ) => ! spanRowMatchesDefault( row, defaultSpan )
			);
			setAttributes( { monkGridItemSpanBreakpoints: pruned } );
		};

		const updateSelectedSpan = ( patch ) => {
			if ( ! effectiveSelectedWidth ) {
				return;
			}

			const width = parseInt( effectiveSelectedWidth, 10 );
			const maxColumns = getParentColumnCountAtWidth(
				parentBreakpoints,
				width
			);
			const nextColumnSpan = patch.columnSpan ?? columnSpanValue;
			const nextRowSpan = patch.rowSpan ?? rowSpanValue;

			const nextRow = {
				width,
				columnSpan: Math.min(
					Math.max( 1, parseInt( nextColumnSpan, 10 ) || 1 ),
					maxColumns
				),
				rowSpan: Math.min(
					Math.max( 1, parseInt( nextRowSpan, 10 ) || 1 ),
					MAX_GRID
				),
			};

			const withoutCurrent = childRows.filter(
				( row ) => String( row.width ) !== String( effectiveSelectedWidth )
			);

			saveChildRows( [ ...withoutCurrent, nextRow ] );
		};

		const clearSelectedOverride = () => {
			if ( ! effectiveSelectedWidth ) {
				return;
			}

			saveChildRows(
				childRows.filter(
					( row ) =>
						String( row.width ) !== String( effectiveSelectedWidth )
				)
			);
		};

		const addLegacyBreakpoint = () => {
			const parsed = parseInt( legacyWidthInput, 10 );
			if ( ! Number.isFinite( parsed ) || parsed < 1 ) {
				return;
			}

			saveChildRows( [
				...childRows,
				{
					width: parsed,
					columnSpan: defaultSpan.columnSpan,
					rowSpan: defaultSpan.rowSpan,
				},
			] );
			setSelectedWidth( String( parsed ) );
			setLegacyWidthInput( '' );
		};

		const removeLegacyBreakpoint = () => {
			clearSelectedOverride();
		};

		const hasOverride = !! selectedRow;
		const helpText = hasOverride
			? __( 'Responsive span override for this breakpoint.', 'monk-extensions' )
			: __(
					'Values match Grid span above until you change them.',
					'monk-extensions'
			  );

		const hasChildSpanOverrides = () => childRows.length > 0;

		const resetChildSpanOverrides = () => {
			setAttributes( { monkGridItemSpanBreakpoints: [] } );
		};

		const panelContent = createElement(
			VStack,
			{ spacing: 4, className: 'monk-grid-item-span-panel__stack' },
			! parentBreakpoints.length &&
				createElement(
					Notice,
					{
						status: 'info',
						isDismissible: false,
					},
					__(
						'Add column breakpoints on the parent grid block first, then configure responsive span overrides here.',
						'monk-extensions'
					)
				),
			! parentBreakpoints.length &&
				childRows.length > 0 &&
				createElement(
					Fragment,
					null,
					createElement(
						BaseControl,
						{
							label: __( 'Breakpoint width', 'monk-extensions' ),
							help: __(
								'Legacy mode: the parent grid no longer has column breakpoints. Add a custom width or remove these overrides.',
								'monk-extensions'
							),
						},
						createElement( TextControl, {
							type: 'number',
							min: 1,
							value: legacyWidthInput,
							onChange: setLegacyWidthInput,
							__nextHasNoMarginBottom: true,
						} )
					),
					createElement(
						Button,
						{
							variant: 'secondary',
							onClick: addLegacyBreakpoint,
							className: 'monk-grid-item-span-panel__add',
						},
						__( 'Add breakpoint', 'monk-extensions' )
					)
				),
			breakpointOptions.length > 0 &&
				effectiveSelectedWidth &&
				createElement( SelectControl, {
					label: __( 'Breakpoint', 'monk-extensions' ),
					value: effectiveSelectedWidth,
					options: breakpointOptions,
					onChange: setSelectedWidth,
					__nextHasNoMarginBottom: true,
				} ),
			selectedParentBreakpoint &&
				createElement(
					BaseControl,
					{
						label: __( 'Parent grid at this breakpoint', 'monk-extensions' ),
						className: 'monk-grid-item-span-panel__parent-grid',
					},
					createElement(
						'p',
						{
							className:
								'monk-grid-item-span-panel__parent-grid-summary',
						},
						formatParentBreakpointSummary( selectedParentBreakpoint )
					)
				),
			breakpointOptions.length > 0 &&
				effectiveSelectedWidth &&
				createElement(
					BaseControl,
					{ label: __( 'Responsive grid span', 'monk-extensions' ), help: helpText },
					createElement(
						Flex,
						{ gap: 4 },
						createElement(
							FlexItem,
							{ style: { width: '50%' } },
							createElement(
								BaseControl,
								{
									label: __( 'Column span', 'monk-extensions' ),
								},
								createElement( TextControl, {
									type: 'number',
									min: 1,
									max: getParentColumnCountAtWidth(
										parentBreakpoints,
										parseInt( effectiveSelectedWidth, 10 ) || 0
									),
									value: String( columnSpanValue ),
									onChange: ( value ) => {
										const nextValue = parseGridCount(
											value,
											columnSpanValue
										);
										setColumnSpanValue( nextValue );
										updateSelectedSpan( {
											columnSpan: nextValue,
										} );
									},
									__nextHasNoMarginBottom: true,
								} )
							)
						),
						createElement(
							FlexItem,
							{ style: { width: '50%' } },
							createElement(
								BaseControl,
								{
									label: __( 'Row span', 'monk-extensions' ),
								},
								createElement( TextControl, {
									type: 'number',
									min: 1,
									max: MAX_GRID,
									value: String( rowSpanValue ),
									onChange: ( value ) => {
										const nextValue = parseGridCount(
											value,
											rowSpanValue
										);
										setRowSpanValue( nextValue );
										updateSelectedSpan( { rowSpan: nextValue } );
									},
									__nextHasNoMarginBottom: true,
								} )
							)
						)
					)
				),
			hasOverride &&
				createElement(
					Button,
					{
						variant: 'secondary',
						onClick: clearSelectedOverride,
						className: 'monk-grid-item-span-panel__clear',
					},
					__( 'Clear span override', 'monk-extensions' )
				),
			! parentBreakpoints.length &&
				selectedWidth &&
				createElement(
					Button,
					{
						variant: 'secondary',
						isDestructive: true,
						onClick: removeLegacyBreakpoint,
						className: 'monk-grid-item-span-panel__remove',
					},
					__( 'Remove breakpoint', 'monk-extensions' )
				)
		);

		const panelProps = {
			label: __( 'Responsive grid span', 'monk-extensions' ),
			hasValue: hasChildSpanOverrides,
			onDeselect: resetChildSpanOverrides,
			isShownByDefault: parentBreakpoints.length > 0,
			panelId: clientId,
			className: 'monk-grid-item-span-tools-panel-item',
		};

		return createElement(
			InspectorControls,
			{ group: 'dimensions' },
			ToolsPanelItem
				? createElement( ToolsPanelItem, panelProps, panelContent )
				: createElement(
						PanelBody,
						{
							title: __( 'Responsive grid span', 'monk-extensions' ),
							initialOpen: parentBreakpoints.length > 0,
							className: 'monk-grid-item-span-panel',
						},
						panelContent
				  )
		);
	}

	function ParentGridBreakpointInspectorGate( props ) {
		if ( ! isGridGroup( props.attributes ) ) {
			return null;
		}

		return createElement( ParentGridBreakpointInspector, props );
	}

	function ChildGridSpanInspectorGate( props ) {
		const parentContext = useSelect(
			( select ) => getDirectGridParentContext( props.clientId, select ),
			[ props.clientId, props.parentLayout?.type ]
		);

		if (
			! isEligibleResponsiveGridChild(
				props.name,
				props.parentLayout,
				parentContext
			)
		) {
			return null;
		}

		return createElement( ChildGridSpanInspector, {
			...props,
			parentContext,
		} );
	}

	const withGridBreakpointControls = createHigherOrderComponent( ( BlockEdit ) => {
		return ( props ) => {
			return createElement(
				Fragment,
				null,
				createElement( BlockEdit, props ),
				props.name === GROUP_BLOCK &&
					createElement( ParentGridBreakpointInspectorGate, {
						clientId: props.clientId,
						attributes: props.attributes,
						setAttributes: props.setAttributes,
					} ),
				! usesWrappedResponsiveSpanInspector( props.name ) &&
					createElement( ChildGridSpanInspectorGate, {
						clientId: props.clientId,
						name: props.name,
						attributes: props.attributes,
						setAttributes: props.setAttributes,
						parentLayout: props.__unstableParentLayout,
					} )
			);
		};
	}, 'withGridBreakpointControls' );

	addFilter(
		'editor.BlockEdit',
		'monk/grid-breakpoints/add-controls',
		withGridBreakpointControls
	);

	function GridBreakpointPreviewBlock( { BlockListBlock, ...props } ) {
		const classNames = [ props.className || '' ];

		if ( props.name === GROUP_BLOCK ) {
			const attributes = props.attributes;
			if (
				isGridGroup( attributes ) &&
				normalizeParentBreakpoints( attributes.monkGridBreakpoints ).length
			) {
				classNames.push(
					'monk-grid-breakpoints-preview-' + props.clientId
				);
			}

			return createElement( BlockListBlock, {
				...props,
				className: classNames.join( ' ' ).trim(),
			} );
		}

		const parentAttributes = useSelect(
			( select ) => {
				if ( ! blockCanUseGridChildLayout( props.name ) ) {
					return null;
				}

				const editor = select( blockEditorStore );
				const parentClientId = editor.getBlockRootClientId( props.clientId );

				if ( ! parentClientId ) {
					return null;
				}

				const parentBlock = editor.getBlock( parentClientId );
				return (
					parentBlock?.attributes ||
					editor.getBlockAttributes( parentClientId )
				);
			},
			[ props.clientId, props.name ]
		);

		if ( parentAttributes && isGridGroup( parentAttributes ) ) {
			const parentRows = normalizeParentBreakpoints(
				parentAttributes.monkGridBreakpoints
			);
			const childRows = resolveChildSpanRowsForRender(
				props.attributes,
				parentRows
			);

			if ( parentRows.length && childRows.length ) {
				classNames.push(
					'monk-grid-item-span-preview-' + props.clientId
				);
			}
		}

		return createElement( BlockListBlock, {
			...props,
			className: classNames.join( ' ' ).trim(),
		} );
	}

	const withGridBreakpointPreviewClass = createHigherOrderComponent(
		( BlockListBlock ) => {
			return ( props ) =>
				createElement( GridBreakpointPreviewBlock, {
					...props,
					BlockListBlock,
				} );
		},
		'withGridBreakpointPreviewClass'
	);

	addFilter(
		'editor.BlockListBlock',
		'monk/grid-breakpoints/preview-class',
		withGridBreakpointPreviewClass
	);

	let previewStylesInitialized = false;

	wp.domReady( function () {
		applyResponsiveSpanEditWraps();

		if ( ! previewStylesInitialized ) {
			initPreviewStyleSubscription();
			previewStylesInitialized = true;
		}

		if ( document.getElementById( 'monk-grid-breakpoints-editor-styles' ) ) {
			return;
		}

		const style = document.createElement( 'style' );
		style.id = 'monk-grid-breakpoints-editor-styles';
		style.textContent =
			'.monk-grid-breakpoints-panel__stack,.monk-grid-item-span-panel__stack{display:flex;flex-direction:column;gap:16px;}' +
			'.monk-grid-breakpoints-panel .components-base-control,.monk-grid-item-span-panel .components-base-control{margin-bottom:0;}' +
			'.monk-grid-breakpoints-panel .components-base-control__help,.monk-grid-item-span-panel .components-base-control__help{margin-top:8px;margin-bottom:0;line-height:1.5;}' +
			'.monk-grid-breakpoints-panel .components-base-control__help .components-button.is-link{padding:0;height:auto;min-height:0;vertical-align:baseline;}' +
			'.monk-grid-breakpoints-panel__add,.monk-grid-breakpoints-panel__remove,.monk-grid-item-span-panel__add,.monk-grid-item-span-panel__clear,.monk-grid-item-span-panel__remove{width:100%;justify-content:center;}' +
			'.monk-grid-breakpoints-panel__grid-controls{margin:0;padding:0;border:0;}' +
			'.monk-grid-item-span-panel__parent-grid-summary{margin:0;font-size:13px;line-height:1.4;color:var(--wp-components-color-foreground,#1e1e1e);}';
		document.head.appendChild( style );
	} );
} )( window.wp );
