( function ( wp ) {
	const { addFilter } = wp.hooks;
	const { createHigherOrderComponent } = wp.compose;
	const { Fragment, createElement } = wp.element;
	const { InspectorControls, MediaUpload, MediaUploadCheck } = wp.blockEditor;
	const { PanelBody, ToggleControl, TextControl, Button, ButtonGroup, BaseControl } = wp.components;

	const SUPPORTED_BLOCKS = [ 'core/cover', 'core/button' ];
	const fullWidthButtonGroupStyle = { display: 'flex', width: '100%' };
	const fullWidthButtonStyle = { flex: 1, justifyContent: 'center' };

	function addVideoModalAttributes( settings, name ) {
		if ( ! SUPPORTED_BLOCKS.includes( name ) ) {
			return settings;
		}

		settings.attributes = Object.assign( {}, settings.attributes, {
			monkVideoModalEnabled: {
				type: 'boolean',
				default: false,
			},
			monkVideoModalType: {
				type: 'string',
				default: 'youtube',
			},
			monkVideoModalYoutubeUrl: {
				type: 'string',
				default: '',
			},
			monkVideoModalStart: {
				type: 'number',
				default: 0,
			},
			monkVideoModalAutoplay: {
				type: 'boolean',
				default: true,
			},
			monkVideoModalPlayIcon: {
				type: 'string',
				default: 'show',
			},
			monkVideoModalUploadedId: {
				type: 'number',
			},
			monkVideoModalUploadedUrl: {
				type: 'string',
				default: '',
			},
		} );

		return settings;
	}

	addFilter(
		'blocks.registerBlockType',
		'monk/video-modal/add-attributes',
		addVideoModalAttributes
	);

	const withVideoModalEditorClass = createHigherOrderComponent( ( BlockListBlock ) => {
		return ( props ) => {
			if ( ! SUPPORTED_BLOCKS.includes( props.name ) ) {
				return createElement( BlockListBlock, props );
			}

			const attrs = props.attributes || {};
			if ( ! attrs.monkVideoModalEnabled ) {
				return createElement( BlockListBlock, props );
			}

			const classNames = [ props.className || '', 'has-monk-video-modal' ];
			if ( 'core/cover' === props.name ) {
				classNames.push( 'monk-video-icon-' + ( attrs.monkVideoModalPlayIcon || 'show' ) );
			}

			return createElement( BlockListBlock, {
				...props,
				className: classNames.join( ' ' ).trim(),
			} );
		};
	}, 'withVideoModalEditorClass' );

	addFilter( 'editor.BlockListBlock', 'monk/video-modal/editor-class', withVideoModalEditorClass );

	const withVideoModalControls = createHigherOrderComponent( ( BlockEdit ) => {
		return ( props ) => {
			if ( ! SUPPORTED_BLOCKS.includes( props.name ) ) {
				return createElement( BlockEdit, props );
			}

			const { attributes, setAttributes } = props;
			const enabled = !! attributes.monkVideoModalEnabled;
			const modalType = attributes.monkVideoModalType || 'youtube';
			const autoplay = false !== attributes.monkVideoModalAutoplay;
			const playIcon = attributes.monkVideoModalPlayIcon || 'show';
			const isCover = 'core/cover' === props.name;

			return createElement(
				Fragment,
				null,
				createElement( BlockEdit, props ),
				createElement(
					InspectorControls,
					null,
					createElement(
						PanelBody,
						{
							title: 'Video Modal',
							initialOpen: false,
						},
						createElement( ToggleControl, {
							label: 'Add Video Modal',
							checked: enabled,
							onChange: ( value ) => {
								setAttributes( { monkVideoModalEnabled: value } );
							},
						} ),
						enabled &&
							createElement(
								BaseControl,
								{ label: 'Video Source' },
								createElement(
									ButtonGroup,
									{ style: fullWidthButtonGroupStyle },
									createElement(
										Button,
										{
											variant: 'youtube' === modalType ? 'primary' : 'secondary',
											style: fullWidthButtonStyle,
											onClick: () => setAttributes( { monkVideoModalType: 'youtube' } ),
										},
										'YouTube'
									),
									createElement(
										Button,
										{
											variant: 'upload' === modalType ? 'primary' : 'secondary',
											style: fullWidthButtonStyle,
											onClick: () => setAttributes( { monkVideoModalType: 'upload' } ),
										},
										'Media Library'
									)
								)
							),
						enabled &&
							'youtube' === modalType &&
							createElement(
								Fragment,
								null,
								createElement( TextControl, {
									label: 'Youtube Share URL',
									value: attributes.monkVideoModalYoutubeUrl || '',
									onChange: ( value ) => {
										setAttributes( { monkVideoModalYoutubeUrl: value } );
									},
									help: 'Paste a YouTube share URL (for example: https://youtu.be/VIDEO_ID).',
								} ),
								createElement( TextControl, {
									label: 'Video Start (seconds)',
									type: 'number',
									min: 0,
									value: attributes.monkVideoModalStart || 0,
									onChange: ( value ) => {
										const parsed = parseInt( value, 10 );
										setAttributes( { monkVideoModalStart: Number.isFinite( parsed ) && parsed > 0 ? parsed : 0 } );
									},
								} )
							),
						enabled &&
							'upload' === modalType &&
							createElement(
								Fragment,
								null,
								createElement(
									MediaUploadCheck,
									null,
									createElement( MediaUpload, {
										onSelect: ( media ) => {
											setAttributes( {
												monkVideoModalUploadedId: media?.id,
												monkVideoModalUploadedUrl: media?.url || '',
											} );
										},
										allowedTypes: [ 'video' ],
										value: attributes.monkVideoModalUploadedId,
										render: ( { open } ) =>
											createElement(
												Button,
												{
													variant: 'secondary',
													onClick: open,
												},
												attributes.monkVideoModalUploadedUrl ? 'Replace Video' : 'Upload/Select Video'
											),
									} )
								),
								attributes.monkVideoModalUploadedUrl &&
									createElement(
										'p',
										{
											style: {
												marginTop: '8px',
												overflowWrap: 'anywhere',
												wordBreak: 'break-word',
											},
										},
										attributes.monkVideoModalUploadedUrl
									)
							),
						enabled &&
							createElement( ToggleControl, {
								label: 'Autoplay video',
								checked: autoplay,
								onChange: ( value ) => {
									setAttributes( { monkVideoModalAutoplay: value } );
								},
								help: 'Automatically play the video when the modal opens.',
							} ),
						enabled &&
							isCover &&
							createElement(
								BaseControl,
								{ label: 'Play Icon' },
								createElement(
									ButtonGroup,
									{ style: fullWidthButtonGroupStyle },
									createElement(
										Button,
										{
											variant: 'show' === playIcon ? 'primary' : 'secondary',
											style: fullWidthButtonStyle,
											onClick: () => setAttributes( { monkVideoModalPlayIcon: 'show' } ),
										},
										'Show'
									),
									createElement(
										Button,
										{
											variant: 'hover' === playIcon ? 'primary' : 'secondary',
											style: fullWidthButtonStyle,
											onClick: () => setAttributes( { monkVideoModalPlayIcon: 'hover' } ),
										},
										'Hover'
									),
									createElement(
										Button,
										{
											variant: 'hide' === playIcon ? 'primary' : 'secondary',
											style: fullWidthButtonStyle,
											onClick: () => setAttributes( { monkVideoModalPlayIcon: 'hide' } ),
										},
										'Hide'
									)
								)
							)
					)
				)
			);
		};
	}, 'withVideoModalControls' );

	addFilter( 'editor.BlockEdit', 'monk/video-modal/add-controls', withVideoModalControls );
} )( window.wp );
